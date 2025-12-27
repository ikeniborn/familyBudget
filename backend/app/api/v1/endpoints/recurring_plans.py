"""
Recurring Plan API endpoints.

CRUD operations for recurring (scheduled) payments:
- Create recurring plan
- Get recurring plan details
- Update recurring plan
- Deactivate recurring plan
- List user's recurring plans
- Get statistics
"""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import get_current_user
from backend.app.core.logging import get_logger
from backend.app.db.session import get_session
from backend.app.models.user import User
from backend.app.schemas.recurring_plan import (
    RecurringPlanCreate,
    RecurringPlanListResponse,
    RecurringPlanResponse,
    RecurringPlanStats,
    RecurringPlanUpdate,
)
from backend.app.services.recurring_plan_service import RecurringPlanService

logger = get_logger(__name__)

router = APIRouter(prefix="/recurring-plans", tags=["recurring-plans"])


def get_recurring_plan_service() -> RecurringPlanService:
    """Get recurring plan service instance."""
    return RecurringPlanService()


# NOTE: General route "/" must be defined BEFORE parameterized routes "/{id}"
# to ensure FastAPI matches them correctly (routes are matched in definition order)


@router.get("/", response_model=RecurringPlanListResponse)
async def list_recurring_plans(
    is_active: Optional[bool] = Query(default=None, description="Filter by active status"),
    skip: int = Query(default=0, ge=0, description="Pagination offset"),
    limit: int = Query(default=50, ge=1, le=100, description="Pagination limit"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
):
    """
    List all recurring plans for current user.

    Args:
        is_active: Optional filter by active status
        skip: Pagination offset
        limit: Pagination limit (max 100)
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service

    Returns:
        Paginated list of recurring plans with details
    """
    items, total = await service.list_recurring_plans(
        session=session,
        user_id=current_user.id,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )

    return RecurringPlanListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/stats", response_model=RecurringPlanStats)
async def get_recurring_plan_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
):
    """
    Get recurring plan statistics for dashboard.

    Args:
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service

    Returns:
        Statistics including active count, paused count, monthly amount, pending count
    """
    stats = await service.get_stats(
        session=session,
        user_id=current_user.id,
    )

    return RecurringPlanStats(**stats)


@router.post("/", response_model=RecurringPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_recurring_plan(
    data: RecurringPlanCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
):
    """
    Create a new recurring plan.

    Creates the plan template and generates initial facts for 3 months ahead.

    Args:
        data: Recurring plan creation data
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service

    Returns:
        Created recurring plan with details

    Raises:
        400: If validation fails or referenced entities don't exist
    """
    try:
        plan = await service.create_recurring_plan(
            session=session,
            data=data,
            user_id=current_user.id,
        )

        # Get full details
        plan_details = await service.get_plan_with_details(
            session=session,
            plan_id=plan.id,
            user_id=current_user.id,
        )

        logger.info(
            f"[API] User {current_user.id} created recurring plan {plan.id} "
            f"({data.frequency_type})"
        )

        return RecurringPlanResponse(**plan_details)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{plan_id}", response_model=RecurringPlanResponse)
async def get_recurring_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
):
    """
    Get recurring plan details by ID.

    Args:
        plan_id: Recurring plan ID
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service

    Returns:
        Recurring plan with full details

    Raises:
        404: If plan not found or doesn't belong to user
    """
    plan_details = await service.get_plan_with_details(
        session=session,
        plan_id=plan_id,
        user_id=current_user.id,
    )

    if not plan_details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recurring plan with ID {plan_id} not found",
        )

    return RecurringPlanResponse(**plan_details)


@router.put("/{plan_id}", response_model=RecurringPlanResponse)
async def update_recurring_plan(
    plan_id: int,
    data: RecurringPlanUpdate,
    regenerate_future: bool = Query(
        default=False,
        description="Delete future facts and regenerate based on new settings"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
):
    """
    Update a recurring plan.

    Only future-affecting fields can be updated:
    - amount, description, cost_center_id
    - end_date (to stop earlier)
    - is_active (to pause/resume)

    Args:
        plan_id: Recurring plan ID
        data: Update data
        regenerate_future: If True, delete future facts and regenerate
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service

    Returns:
        Updated recurring plan

    Raises:
        404: If plan not found
        403: If plan doesn't belong to current user
        400: If validation fails
    """
    try:
        plan = await service.update_recurring_plan(
            session=session,
            plan_id=plan_id,
            data=data,
            user_id=current_user.id,
            regenerate_future=regenerate_future,
        )

        # Get full details
        plan_details = await service.get_plan_with_details(
            session=session,
            plan_id=plan.id,
            user_id=current_user.id,
        )

        logger.info(
            f"[API] User {current_user.id} updated recurring plan {plan_id}"
        )

        return RecurringPlanResponse(**plan_details)

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


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_recurring_plan(
    plan_id: int,
    delete_future_facts: bool = Query(
        default=False,
        description="Also delete future generated facts"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
):
    """
    Deactivate (soft delete) a recurring plan.

    This stops future fact generation. Existing facts are preserved.

    Args:
        plan_id: Recurring plan ID
        delete_future_facts: If True, also delete future generated facts
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service

    Returns:
        No content on success

    Raises:
        404: If plan not found
        403: If plan doesn't belong to current user
    """
    try:
        await service.deactivate_recurring_plan(
            session=session,
            plan_id=plan_id,
            user_id=current_user.id,
            delete_future_facts=delete_future_facts,
        )

        logger.info(
            f"[API] User {current_user.id} deactivated recurring plan {plan_id}"
        )

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


@router.post("/{plan_id}/activate", response_model=RecurringPlanResponse)
async def activate_recurring_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
):
    """
    Reactivate a paused recurring plan.

    Args:
        plan_id: Recurring plan ID
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service

    Returns:
        Reactivated recurring plan

    Raises:
        404: If plan not found
        403: If plan doesn't belong to current user
    """
    try:
        plan = await service.update_recurring_plan(
            session=session,
            plan_id=plan_id,
            data=RecurringPlanUpdate(is_active=True),
            user_id=current_user.id,
            regenerate_future=True,  # Generate facts for the activated plan
        )

        # Get full details
        plan_details = await service.get_plan_with_details(
            session=session,
            plan_id=plan.id,
            user_id=current_user.id,
        )

        logger.info(
            f"[API] User {current_user.id} activated recurring plan {plan_id}"
        )

        return RecurringPlanResponse(**plan_details)

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
