"""
Scheduled Reminder API endpoints.

CRUD operations for plan reminders:
- Create reminder for a plan
- Get reminder for a plan
- Update reminder datetime
- Delete reminder
- List all user's reminders
"""
from typing import Optional


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import get_current_user
from backend.app.core.logging import get_logger
from backend.app.db.session import get_session
from backend.app.models.user import User
from backend.app.schemas.scheduled_reminder import (
    ReminderCreate,
    ReminderListResponse,
    ReminderResponse,
    ReminderUpdate,
    ReminderWithPlanInfo,
)
from backend.app.services.cache_service import CacheKey, cache_service
from backend.app.services.reminder_service import ReminderService

logger = get_logger(__name__)

router = APIRouter(prefix="/reminders", tags=["reminders"])


def get_reminder_service() -> ReminderService:
    """Get reminder service instance."""
    return ReminderService()


# NOTE: General route "/" must be defined BEFORE parameterized routes "/{fact_id}"
# to ensure FastAPI matches them correctly (routes are matched in definition order)
@router.get("/", response_model=ReminderListResponse)
async def list_reminders(
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: ReminderService = Depends(get_reminder_service),
):
    """
    List all reminders for current user.

    Args:
        status_filter: Optional status filter (pending, sent, failed, cancelled)
        skip: Pagination offset
        limit: Pagination limit (max 100)
        current_user: Authenticated user
        session: Database session
        service: Reminder service

    Returns:
        Paginated list of reminders with plan info
    """
    # Validate status
    if status_filter and status_filter not in ("pending", "sent", "failed", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: {status_filter}. Must be one of: pending, sent, failed, cancelled",
        )

    # Limit max results
    if limit > 100:
        limit = 100

    items, total = await service.list_user_reminders(
        session=session,
        user_id=current_user.id,
        status=status_filter,
        skip=skip,
        limit=limit,
    )

    return ReminderListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("/{fact_id}", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    fact_id: int,
    data: ReminderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: ReminderService = Depends(get_reminder_service),
):
    """
    Create a scheduled reminder for a plan.

    Args:
        fact_id: ID of the plan (BudgetFact with record_type='plan')
        data: Reminder creation data with reminder_datetime
        current_user: Authenticated user
        session: Database session
        service: Reminder service

    Returns:
        Created reminder

    Raises:
        400: If plan not found, not a plan, or reminder already exists
        403: If plan doesn't belong to current user
    """
    try:
        reminder = await service.create_reminder(
            session=session,
            fact_id=fact_id,
            reminder_datetime=data.reminder_datetime,
            user_id=current_user.id,
        )

        logger.info(
            f"[API] User {current_user.id} created reminder for plan {fact_id}"
        )

        # Invalidate recent_html cache (all limits) so reminder icon appears immediately
        for limit in range(1, 21):  # CacheKey.recent_html supports limit 1-20
            cache_key = str(CacheKey.recent_html(limit))
            await cache_service.delete(cache_key)

        return reminder

    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        elif "does not belong" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )


@router.get("/{fact_id}", response_model=ReminderWithPlanInfo)
async def get_reminder(
    fact_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: ReminderService = Depends(get_reminder_service),
):
    """
    Get reminder for a plan with plan info.

    Args:
        fact_id: ID of the plan
        current_user: Authenticated user
        session: Database session
        service: Reminder service

    Returns:
        Reminder with plan info

    Raises:
        404: If reminder not found or plan doesn't belong to user
    """
    reminder_data = await service.get_reminder_with_plan_info(
        session=session,
        fact_id=fact_id,
        user_id=current_user.id,
    )

    if not reminder_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reminder for plan {fact_id} not found",
        )

    return reminder_data


@router.put("/{fact_id}", response_model=ReminderResponse)
async def update_reminder(
    fact_id: int,
    data: ReminderUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: ReminderService = Depends(get_reminder_service),
):
    """
    Update a scheduled reminder.

    Args:
        fact_id: ID of the plan
        data: Update data with new reminder_datetime
        current_user: Authenticated user
        session: Database session
        service: Reminder service

    Returns:
        Updated reminder

    Raises:
        404: If reminder not found
        403: If plan doesn't belong to current user
    """
    try:
        reminder = await service.update_reminder(
            session=session,
            fact_id=fact_id,
            reminder_datetime=data.reminder_datetime,
            user_id=current_user.id,
        )

        logger.info(
            f"[API] User {current_user.id} updated reminder for plan {fact_id}"
        )

        # Invalidate recent_html cache so reminder time update appears immediately
        for limit in range(1, 21):  # CacheKey.recent_html supports limit 1-20
            cache_key = str(CacheKey.recent_html(limit))
            await cache_service.delete(cache_key)

        return reminder

    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        elif "does not belong" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )


@router.delete("/{fact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    fact_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: ReminderService = Depends(get_reminder_service),
):
    """
    Delete a scheduled reminder.

    Args:
        fact_id: ID of the plan
        current_user: Authenticated user
        session: Database session
        service: Reminder service

    Returns:
        No content on success

    Raises:
        404: If reminder not found
        403: If plan doesn't belong to current user
    """
    try:
        await service.delete_reminder(
            session=session,
            fact_id=fact_id,
            user_id=current_user.id,
        )

        logger.info(
            f"[API] User {current_user.id} deleted reminder for plan {fact_id}"
        )

        # Invalidate recent_html cache so reminder icon disappears immediately
        for limit in range(1, 21):  # CacheKey.recent_html supports limit 1-20
            cache_key = str(CacheKey.recent_html(limit))
            await cache_service.delete(cache_key)

    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        elif "does not belong" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
