"""
Financial Centers API endpoints.

This module provides REST API endpoints for managing financial centers (bank accounts,
wallets, cash) with SCD Type 2 support.

Endpoints:
    GET    /api/v1/financial-centers      - List all financial centers (user + global)
    POST   /api/v1/financial-centers      - Create new financial center
    GET    /api/v1/financial-centers/{id} - Get financial center by ID
    PUT    /api/v1/financial-centers/{id} - Update financial center (creates new SCD2 version)
    DELETE /api/v1/financial-centers/{id} - Soft delete financial center
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import FinancialCenter, User
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.financial_center import (
    FinancialCenterCreate,
    FinancialCenterListResponse,
    FinancialCenterResponse,
    FinancialCenterUpdate,
)
from backend.app.services.cache_service import cache_service
from backend.app.services.financial_center_service import (
    FAR_FUTURE_DATETIME,
    create_initial_history,
    update_financial_center_profile,
)
from backend.app.services.scd2_service import has_changes

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/financial-centers",
    tags=["financial-centers"],
    responses=get_common_responses(),
)


@router.get(
    "",
    response_model=FinancialCenterListResponse,
    summary="List financial centers",
    description="Get list of user's financial centers",
)
async def list_financial_centers(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    include_inactive: bool = Query(False, description="Include archived financial centers"),
) -> FinancialCenterListResponse:
    """
    List financial centers for current user.

    Shared references architecture: All users see all financial centers.
    By default, only active financial centers (is_active=True) are returned.
    """
    # Build query - all financial centers (shared references)
    conditions = []

    # Filter archived if not explicitly requested
    if not include_inactive:
        conditions.append(FinancialCenter.is_active)

    # Count total
    count_query = select(FinancialCenter).where(*conditions)
    count_result = await session.execute(count_query)
    total = len(count_result.all())

    # Fetch paginated results
    query = (
        select(FinancialCenter)
        .where(*conditions)
        .order_by(FinancialCenter.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(query)
    financial_centers = result.scalars().all()

    return FinancialCenterListResponse(
        financial_centers=[
            FinancialCenterResponse.model_validate(fc) for fc in financial_centers
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=FinancialCenterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create financial center",
    description="Create a new financial center for current user",
)
async def create_financial_center(
    financial_center_data: FinancialCenterCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FinancialCenterResponse:
    """
    Create a new financial center.

    Shared references architecture: All authenticated users can create financial centers.
    Financial center is created with current_user as creator (audit trail).
    """

    # Generate code for financial center
    from backend.app.utils.code_generator import generate_code
    generated_code = await generate_code(session, FinancialCenter)

    # Create financial center (SCD Type 1 - no versioning fields)
    financial_center = FinancialCenter(
        user_id=current_user.id,
        name=financial_center_data.name,
        description=financial_center_data.description,
        code=generated_code,
    )

    session.add(financial_center)
    await session.commit()
    await session.refresh(financial_center)

    # Create initial history record (SCD Type 2 for history)
    await create_initial_history(session=session, financial_center=financial_center, change_type="CREATE")

    # Invalidate financial centers cache
    await cache_service.invalidate_financial_centers()

    return FinancialCenterResponse.model_validate(financial_center)


@router.get(
    "/{financial_center_id}",
    response_model=FinancialCenterResponse,
    summary="Get financial center",
    description="Get a single financial center by ID",
)
async def get_financial_center(
    financial_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FinancialCenterResponse:
    """
    Get financial center by ID.

    Shared references architecture: All users can access all financial centers.
    """
    query = select(FinancialCenter).where(
        FinancialCenter.id == financial_center_id
    )

    result = await session.execute(query)
    financial_center = result.scalar_one_or_none()

    if not financial_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Financial center {financial_center_id} not found",
        )

    # NO access restrictions - all users can read all financial centers

    return FinancialCenterResponse.model_validate(financial_center)


@router.put(
    "/{financial_center_id}",
    response_model=FinancialCenterResponse,
    summary="Update financial center",
    description="Update financial center (creates new SCD Type 2 version)",
)
async def update_financial_center(
    financial_center_id: int,
    update_data: FinancialCenterUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FinancialCenterResponse:
    """
    Update financial center.

    SCD Type 1 + History:
    - Updates financial center IN-PLACE (id remains stable)
    - Creates FinancialCenterHistory snapshot (SCD Type 2 for audit)
    - FK in fact tables remain unchanged

    Shared references architecture: All authenticated users can update financial centers.
    """
    # LOG: Request received
    logger.info(
        "[UPDATE_FC] Request received: fc_id=%s, user_id=%s, data=%s",
        financial_center_id, current_user.id, update_data.model_dump(exclude_unset=True)
    )

    # Fetch financial center
    query = select(FinancialCenter).where(
        FinancialCenter.id == financial_center_id
    )

    result = await session.execute(query)
    financial_center = result.scalar_one_or_none()

    if not financial_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Financial center {financial_center_id} not found",
        )

    # LOG: Found record
    logger.info("[UPDATE_FC] Found: id=%s, name=%r", financial_center.id, financial_center.name)

    # Get update dict
    update_dict = update_data.model_dump(exclude_unset=True)

    # Check if anything changed
    changed, changed_fields = has_changes(financial_center, update_dict)
    if not changed:
        logger.info("[UPDATE_FC] No changes detected for fc_id=%s", financial_center_id)
        # No changes, return existing financial center
        return FinancialCenterResponse.model_validate(financial_center)

    # LOG: Detected changes
    logger.info("[UPDATE_FC] Detected changes: %s", changed_fields)

    # Use SCD1+History service for update
    updated_financial_center = await update_financial_center_profile(
        session=session,
        financial_center=financial_center,
        updates=update_dict,
        changed_by_user_id=current_user.id,
        change_type="UPDATE",
    )

    # LOG: Success
    logger.info(
        "[UPDATE_FC] Successfully updated fc_id=%s, new_values: %s",
        financial_center_id, update_dict
    )

    # Invalidate financial centers cache
    await cache_service.invalidate_financial_centers()

    return FinancialCenterResponse.model_validate(updated_financial_center)


@router.put(
    "/{financial_center_id}/archive",
    response_model=FinancialCenterResponse,
    summary="Archive financial center",
    description="Archive financial center (simple UPDATE is_active=False, not SCD Type 2)",
)
async def archive_financial_center(
    financial_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FinancialCenterResponse:
    """
    Archive financial center by setting is_active=False.

    Simple UPDATE operation (NOT SCD Type 2).
    Archived financial centers are hidden from UI dropdowns but remain in analytics.
    Only administrators can archive financial centers.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can archive financial centers",
        )

    query = select(FinancialCenter).where(
        FinancialCenter.id == financial_center_id
    )
    result = await session.execute(query)
    financial_center = result.scalar_one_or_none()

    if not financial_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Financial center {financial_center_id} not found",
        )

    # Simple UPDATE: is_active=False (NOT SCD Type 2)
    financial_center.is_active = False
    financial_center.updated_at = datetime.utcnow()

    session.add(financial_center)
    await session.commit()
    await session.refresh(financial_center)

    # Invalidate financial centers cache
    await cache_service.invalidate_financial_centers()

    return financial_center


@router.put(
    "/{financial_center_id}/restore",
    response_model=FinancialCenterResponse,
    summary="Restore archived financial center",
    description="Restore financial center (simple UPDATE is_active=True, not SCD Type 2)",
)
async def restore_financial_center(
    financial_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FinancialCenterResponse:
    """
    Restore archived financial center by setting is_active=True.

    Simple UPDATE operation (NOT SCD Type 2).
    Only administrators can restore financial centers.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can restore financial centers",
        )

    query = select(FinancialCenter).where(
        FinancialCenter.id == financial_center_id
    )
    result = await session.execute(query)
    financial_center = result.scalar_one_or_none()

    if not financial_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Financial center {financial_center_id} not found",
        )

    # Simple UPDATE: is_active=True (NOT SCD Type 2)
    financial_center.is_active = True
    financial_center.updated_at = datetime.utcnow()

    session.add(financial_center)
    await session.commit()
    await session.refresh(financial_center)

    # Invalidate financial centers cache
    await cache_service.invalidate_financial_centers()

    return financial_center


@router.delete(
    "/{financial_center_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete financial center",
    description="Physically delete financial center with cascade (deletes related facts)",
)
async def delete_financial_center(
    financial_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Physically delete financial center with cascade deletion.

    Cascade deletion order:
    1. Create DELETE history record (for audit trail)
    2. Delete all BudgetFact records referencing this financial center
    3. Delete the FinancialCenter record
    4. History records are PRESERVED for audit

    Returns detailed message with count of cascade-deleted records.

    Raises:
        HTTPException: 403 if not admin
        HTTPException: 404 if financial center not found
    """
    from backend.app.models.fact import BudgetFact
    from backend.app.models.financial_center_history import FinancialCenterHistory

    # Check: Only admins can delete financial centers
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete financial centers",
        )

    # Fetch financial center
    query = select(FinancialCenter).where(
        FinancialCenter.id == financial_center_id
    )

    result = await session.execute(query)
    financial_center = result.scalar_one_or_none()

    if not financial_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Financial center {financial_center_id} not found",
        )

    # 1. Create DELETE history record (for audit trail)
    now = datetime.utcnow()
    delete_history = FinancialCenterHistory(
        financial_center_id=financial_center.id,
        user_id=financial_center.user_id,
        name=financial_center.name,
        description=financial_center.description,
        code=financial_center.code,
        is_active=financial_center.is_active,
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=False,  # Deleted records are never current
        change_type="DELETE",
        changed_fields=None,  # Full deletion
        changed_by_user_id=current_user.id,
    )
    session.add(delete_history)

    # 2. Count and delete related BudgetFact records (cascade)
    facts_query = select(func.count(BudgetFact.id)).where(
        BudgetFact.financial_center_id == financial_center_id
    )
    facts_result = await session.execute(facts_query)
    facts_count = facts_result.scalar()

    # Delete facts with history tracking
    if facts_count > 0:
        from backend.app.models.budget_fact_history import BudgetFactHistory

        delete_facts_query = select(BudgetFact).where(
            BudgetFact.financial_center_id == financial_center_id
        )
        delete_facts_result = await session.execute(delete_facts_query)
        facts_to_delete = delete_facts_result.scalars().all()

        # Create DELETE history record for each fact (audit trail)
        for fact in facts_to_delete:
            delete_fact_history = BudgetFactHistory(
                fact_id=fact.id,
                user_id=fact.user_id,
                article_id=fact.article_id,
                financial_center_id=fact.financial_center_id,
                cost_center_id=fact.cost_center_id,
                fact_date=fact.fact_date,
                amount=fact.amount,
                description=fact.description,
                record_type=fact.record_type,
                transfer_id=fact.transfer_id,
                is_offline_sync=fact.is_offline_sync,
                valid_from=now,
                valid_to=FAR_FUTURE_DATETIME,
                is_current=False,  # Deleted records are never current
                change_type="DELETE",
                changed_fields=None,  # Full deletion
                changed_by_user_id=current_user.id,
                cascade_delete_source=f"financial_center_id:{financial_center_id}"
            )
            session.add(delete_fact_history)

            # Delete fact
            await session.delete(fact)

    # 3. Delete financial center
    await session.delete(financial_center)
    await session.commit()

    # Invalidate financial centers cache (and dashboard since facts were deleted)
    await cache_service.invalidate_financial_centers()
    if facts_count > 0:
        await cache_service.invalidate_dashboard()

    logger.info(
        "Physically deleted financial center %s (%s) with %s related facts by admin %s",
        financial_center_id, financial_center.name, facts_count, current_user.id
    )

    return {
        "message": "Financial center deleted successfully",
        "financial_center_id": financial_center_id,
        "cascade_deleted": {
            "facts": facts_count
        }
    }
