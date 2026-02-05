"""
Cost Centers API endpoints.

This module provides REST API endpoints for managing cost centers (projects, departments,
budget groups) with SCD Type 2 support.

Endpoints:
    GET    /api/v1/cost-centers      - List all cost centers (user + global)
    POST   /api/v1/cost-centers      - Create new cost center
    GET    /api/v1/cost-centers/{id} - Get cost center by ID
    PUT    /api/v1/cost-centers/{id} - Update cost center (creates new SCD2 version)
    DELETE /api/v1/cost-centers/{id} - Soft delete cost center
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import or_, select

from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import CostCenter, FinancialCenter, User
from backend.app.models.cost_center_financial_center import CostCenterFinancialCenter
from backend.app.schemas.cost_center import (
    CostCenterCreate,
    CostCenterListResponse,
    CostCenterResponse,
    CostCenterUpdate,
)
from backend.app.schemas.errors import get_common_responses
from backend.app.services.cache_service import cache_service
from backend.app.services.cost_center_service import (
    FAR_FUTURE_DATETIME,
    create_initial_history,
    update_cost_center_profile,
)
from backend.app.services.scd2_service import has_changes

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cost-centers",
    tags=["cost-centers"],
    responses=get_common_responses(),
)


@router.get(
    "",
    response_model=CostCenterListResponse,
    summary="List cost centers",
    description="Get list of user's cost centers",
)
async def list_cost_centers(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    include_inactive: bool = Query(False, description="Include archived cost centers"),
    financial_center_id: int | None = Query(
        default=None,
        description="Filter cost centers by financial center ID. "
                    "Returns cost centers with NO FC restrictions OR linked to this specific FC."
    ),
) -> CostCenterListResponse:
    """
    List cost centers for current user.

    Shared references architecture: All users see all cost centers.
    By default, only active cost centers (is_active=True) are returned.

    Filter by financial_center_id (whitelist pattern):
    - If provided: Returns cost centers with NO FC restrictions OR linked to this FC
    - If not provided: Returns all cost centers (no FC filtering)
    """
    # Build query - all cost centers (shared references)
    conditions = []

    # Filter archived if not explicitly requested
    if not include_inactive:
        conditions.append(CostCenter.is_active)

    # Filter by financial_center_id (whitelist pattern)
    if financial_center_id is not None:
        # Subquery: cost_center IDs that have ANY FC restriction
        cc_with_fc_restrictions = select(
            CostCenterFinancialCenter.cost_center_id
        ).distinct()

        # Subquery: cost_center IDs linked to the specified FC
        cc_linked_to_fc = select(
            CostCenterFinancialCenter.cost_center_id
        ).where(
            CostCenterFinancialCenter.financial_center_id == financial_center_id
        )

        # Filter: cost_center has NO restrictions OR is linked to this FC
        conditions.append(
            or_(
                CostCenter.id.not_in(cc_with_fc_restrictions),
                CostCenter.id.in_(cc_linked_to_fc)
            )
        )

    # Count total
    count_query = select(CostCenter).where(*conditions)
    count_result = await session.execute(count_query)
    total = len(count_result.all())

    # Fetch paginated results
    query = (
        select(CostCenter)
        .where(*conditions)
        .order_by(CostCenter.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(query)
    cost_centers = result.scalars().all()

    # Load financial_center_ids for all cost centers
    cc_ids = [cc.id for cc in cost_centers]
    if cc_ids:
        fc_links_query = select(CostCenterFinancialCenter).where(
            CostCenterFinancialCenter.cost_center_id.in_(cc_ids)
        )
        fc_links_result = await session.execute(fc_links_query)
        fc_links = fc_links_result.scalars().all()

        # Build mapping: cost_center_id -> list of financial_center_ids
        fc_map: dict[int, list[int]] = {}
        for link in fc_links:
            if link.cost_center_id not in fc_map:
                fc_map[link.cost_center_id] = []
            fc_map[link.cost_center_id].append(link.financial_center_id)
    else:
        fc_map = {}

    return CostCenterListResponse(
        cost_centers=[
            CostCenterResponse(
                id=cc.id,
                user_id=cc.user_id,
                name=cc.name,
                code=cc.code,
                description=cc.description,
                is_active=cc.is_active,
                created_at=cc.created_at,
                updated_at=cc.updated_at,
                financial_center_ids=fc_map.get(cc.id, [])
            )
            for cc in cost_centers
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=CostCenterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create cost center",
    description="Create a new cost center for current user",
)
async def create_cost_center(
    cost_center_data: CostCenterCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CostCenterResponse:
    """
    Create a new cost center.

    Shared references architecture: All authenticated users can create cost centers.
    Cost center is created with current_user as creator (audit trail).
    """
    # Generate code for cost center
    from backend.app.utils.code_generator import generate_code
    generated_code = await generate_code(session, CostCenter)

    # Create cost center (SCD Type 1 - no versioning fields)
    cost_center = CostCenter(
        user_id=current_user.id,
        name=cost_center_data.name,
        description=cost_center_data.description,
        code=generated_code,
    )

    session.add(cost_center)
    await session.commit()
    await session.refresh(cost_center)

    # Create initial history record (SCD Type 2 for history)
    await create_initial_history(session=session, cost_center=cost_center, change_type="CREATE")

    # Handle financial center links
    financial_center_ids: list[int] = []
    if cost_center_data.financial_center_ids:
        for fc_id in cost_center_data.financial_center_ids:
            # Validate FC exists
            fc_query = select(FinancialCenter).where(FinancialCenter.id == fc_id)
            fc_result = await session.execute(fc_query)
            fc = fc_result.scalar_one_or_none()
            if not fc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Финансовый центр с id={fc_id} не найден"
                )

            link = CostCenterFinancialCenter(
                cost_center_id=cost_center.id,
                financial_center_id=fc_id
            )
            session.add(link)

        await session.commit()
        financial_center_ids = cost_center_data.financial_center_ids

    # Invalidate cost centers cache
    await cache_service.invalidate_cost_centers()

    return CostCenterResponse(
        id=cost_center.id,
        user_id=cost_center.user_id,
        name=cost_center.name,
        code=cost_center.code,
        description=cost_center.description,
        is_active=cost_center.is_active,
        created_at=cost_center.created_at,
        updated_at=cost_center.updated_at,
        financial_center_ids=financial_center_ids
    )


@router.get(
    "/{cost_center_id}",
    response_model=CostCenterResponse,
    summary="Get cost center",
    description="Get a single cost center by ID",
)
async def get_cost_center(
    cost_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CostCenterResponse:
    """
    Get cost center by ID.

    Shared references architecture: All users can access all cost centers.
    """
    query = select(CostCenter).where(
        CostCenter.id == cost_center_id
    )

    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # NO access restrictions - all users can read all cost centers

    # Load financial_center_ids
    fc_links_query = select(CostCenterFinancialCenter.financial_center_id).where(
        CostCenterFinancialCenter.cost_center_id == cost_center_id
    )
    fc_links_result = await session.execute(fc_links_query)
    financial_center_ids = [row[0] for row in fc_links_result.all()]

    return CostCenterResponse(
        id=cost_center.id,
        user_id=cost_center.user_id,
        name=cost_center.name,
        code=cost_center.code,
        description=cost_center.description,
        is_active=cost_center.is_active,
        created_at=cost_center.created_at,
        updated_at=cost_center.updated_at,
        financial_center_ids=financial_center_ids
    )


@router.put(
    "/{cost_center_id}",
    response_model=CostCenterResponse,
    summary="Update cost center",
    description="Update cost center (creates new SCD Type 2 version)",
)
async def update_cost_center(
    cost_center_id: int,
    update_data: CostCenterUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CostCenterResponse:
    """
    Update cost center.

    SCD Type 1 + History:
    - Updates cost center IN-PLACE (id remains stable)
    - Creates CostCenterHistory snapshot (SCD Type 2 for audit)
    - FK in fact tables remain unchanged

    Shared references architecture: All authenticated users can update cost centers.
    """
    # LOG: Request received
    logger.info(
        f"[UPDATE_CC] Request received: cc_id={cost_center_id}, "
        f"user_id={current_user.id}, data={update_data.model_dump(exclude_unset=True)}"
    )

    # Fetch cost center
    query = select(CostCenter).where(
        CostCenter.id == cost_center_id
    )

    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # LOG: Found record
    logger.info(f"[UPDATE_CC] Found: id={cost_center.id}, name='{cost_center.name}'")

    # Get update dict (exclude financial_center_ids - handled separately)
    update_dict = update_data.model_dump(exclude_unset=True, exclude={"financial_center_ids"})

    # Check if base fields changed
    changed, changed_fields = has_changes(cost_center, update_dict)

    # Handle financial_center_ids update
    financial_center_ids: list[int] = []
    fc_ids_changed = False

    if update_data.financial_center_ids is not None:
        fc_ids_changed = True
        # Delete existing links
        delete_links_query = select(CostCenterFinancialCenter).where(
            CostCenterFinancialCenter.cost_center_id == cost_center_id
        )
        links_result = await session.execute(delete_links_query)
        for link in links_result.scalars().all():
            await session.delete(link)

        # Create new links
        for fc_id in update_data.financial_center_ids:
            fc_query = select(FinancialCenter).where(FinancialCenter.id == fc_id)
            fc_result = await session.execute(fc_query)
            fc = fc_result.scalar_one_or_none()
            if not fc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Финансовый центр с id={fc_id} не найден"
                )

            link = CostCenterFinancialCenter(
                cost_center_id=cost_center_id,
                financial_center_id=fc_id
            )
            session.add(link)

        financial_center_ids = update_data.financial_center_ids
    else:
        # Load existing financial_center_ids
        existing_links_query = select(CostCenterFinancialCenter.financial_center_id).where(
            CostCenterFinancialCenter.cost_center_id == cost_center_id
        )
        existing_links_result = await session.execute(existing_links_query)
        financial_center_ids = [row[0] for row in existing_links_result.all()]

    if not changed and not fc_ids_changed:
        logger.info(f"[UPDATE_CC] No changes detected for cc_id={cost_center_id}")
        # No changes, return existing cost center
        return CostCenterResponse(
            id=cost_center.id,
            user_id=cost_center.user_id,
            name=cost_center.name,
            code=cost_center.code,
            description=cost_center.description,
            is_active=cost_center.is_active,
            created_at=cost_center.created_at,
            updated_at=cost_center.updated_at,
            financial_center_ids=financial_center_ids
        )

    # LOG: Detected changes
    logger.info(f"[UPDATE_CC] Detected changes: {changed_fields}, fc_ids_changed={fc_ids_changed}")

    # Use SCD1+History service for update (only if base fields changed)
    if changed:
        updated_cost_center = await update_cost_center_profile(
            session=session,
            cost_center=cost_center,
            updates=update_dict,
            changed_by_user_id=current_user.id,
            change_type="UPDATE",
        )
    else:
        updated_cost_center = cost_center
        # Commit FC link changes if any
        await session.commit()
        await session.refresh(updated_cost_center)

    # LOG: Success
    logger.info(
        f"[UPDATE_CC] Successfully updated cc_id={cost_center_id}, "
        f"new_values: {update_dict}, fc_ids_changed={fc_ids_changed}"
    )

    # Invalidate cost centers cache
    await cache_service.invalidate_cost_centers()

    return CostCenterResponse(
        id=updated_cost_center.id,
        user_id=updated_cost_center.user_id,
        name=updated_cost_center.name,
        code=updated_cost_center.code,
        description=updated_cost_center.description,
        is_active=updated_cost_center.is_active,
        created_at=updated_cost_center.created_at,
        updated_at=updated_cost_center.updated_at,
        financial_center_ids=financial_center_ids
    )


@router.put(
    "/{cost_center_id}/archive",
    response_model=CostCenterResponse,
    summary="Archive cost center",
    description="Archive cost center (simple UPDATE is_active=False, not SCD Type 2)",
)
async def archive_cost_center(
    cost_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CostCenterResponse:
    """
    Archive cost center by setting is_active=False.

    Simple UPDATE operation (NOT SCD Type 2).
    Archived cost centers are hidden from UI dropdowns but remain in analytics.
    Only administrators can archive cost centers.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can archive cost centers",
        )

    query = select(CostCenter).where(
        CostCenter.id == cost_center_id
    )
    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # Simple UPDATE: is_active=False (NOT SCD Type 2)
    cost_center.is_active = False
    cost_center.updated_at = datetime.utcnow()

    session.add(cost_center)
    await session.commit()
    await session.refresh(cost_center)

    # Invalidate cost centers cache
    await cache_service.invalidate_cost_centers()

    return cost_center


@router.put(
    "/{cost_center_id}/restore",
    response_model=CostCenterResponse,
    summary="Restore archived cost center",
    description="Restore cost center (simple UPDATE is_active=True, not SCD Type 2)",
)
async def restore_cost_center(
    cost_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CostCenterResponse:
    """
    Restore archived cost center by setting is_active=True.

    Simple UPDATE operation (NOT SCD Type 2).
    Only administrators can restore cost centers.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can restore cost centers",
        )

    query = select(CostCenter).where(
        CostCenter.id == cost_center_id
    )
    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # Simple UPDATE: is_active=True (NOT SCD Type 2)
    cost_center.is_active = True
    cost_center.updated_at = datetime.utcnow()

    session.add(cost_center)
    await session.commit()
    await session.refresh(cost_center)

    # Invalidate cost centers cache
    await cache_service.invalidate_cost_centers()

    return cost_center


@router.delete(
    "/{cost_center_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete cost center",
    description="Physically delete cost center with cascade (deletes related facts)",
)
async def delete_cost_center(
    cost_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Physically delete cost center with cascade deletion.

    Cascade deletion order:
    1. Create DELETE history record (for audit trail)
    2. Delete all BudgetFact records referencing this cost center
    3. Delete the CostCenter record
    4. History records are PRESERVED for audit

    Returns detailed message with count of cascade-deleted records.

    Raises:
        HTTPException: 403 if not admin
        HTTPException: 404 if cost center not found
    """
    from backend.app.models.cost_center_history import CostCenterHistory
    from backend.app.models.fact import BudgetFact

    # Check: Only admins can delete cost centers
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete cost centers",
        )

    # Fetch cost center
    query = select(CostCenter).where(
        CostCenter.id == cost_center_id
    )

    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # 1. Create DELETE history record (for audit trail)
    now = datetime.utcnow()
    delete_history = CostCenterHistory(
        cost_center_id=cost_center.id,
        user_id=cost_center.user_id,
        name=cost_center.name,
        description=cost_center.description,
        code=cost_center.code,
        is_active=cost_center.is_active,
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
        BudgetFact.cost_center_id == cost_center_id
    )
    facts_result = await session.execute(facts_query)
    facts_count = facts_result.scalar()

    # Delete facts with history tracking
    if facts_count > 0:
        from backend.app.models.budget_fact_history import BudgetFactHistory

        delete_facts_query = select(BudgetFact).where(
            BudgetFact.cost_center_id == cost_center_id
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
                cascade_delete_source=f"cost_center_id:{cost_center_id}"
            )
            session.add(delete_fact_history)

            # Delete fact
            await session.delete(fact)

    # 3. Delete cost center
    await session.delete(cost_center)
    await session.commit()

    # Invalidate cost centers cache (and dashboard since facts were deleted)
    await cache_service.invalidate_cost_centers()
    if facts_count > 0:
        await cache_service.invalidate_dashboard()

    logger.info(
        f"Physically deleted cost center {cost_center_id} "
        f"({cost_center.name}) with {facts_count} related facts "
        f"by admin {current_user.id}"
    )

    return {
        "message": "Cost center deleted successfully",
        "cost_center_id": cost_center_id,
        "cascade_deleted": {
            "facts": facts_count
        }
    }
