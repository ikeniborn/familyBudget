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
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

import backend.app.api.v1.endpoints.budget_ws as ws
from backend.app.core.auth import get_current_user
from backend.app.core.json_utils import dumps_for_cache
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
from backend.app.services.cache_service import CacheKey, CacheService
from backend.app.services.recurring_plan_service import RecurringPlanService

logger = get_logger(__name__)

router = APIRouter(prefix="/recurring-plans", tags=["recurring-plans"])


def get_recurring_plan_service() -> RecurringPlanService:
    """Get recurring plan service instance."""
    return RecurringPlanService()


def get_cache_service() -> CacheService:
    """Get cache service instance."""
    return CacheService()


def _generate_filter_hash(filters: dict) -> str:
    """
    Generate MD5 hash from filter parameters for cache isolation.

    Ensures different filter combinations get separate cache entries.

    Args:
        filters: Dictionary of filter parameters

    Returns:
        12-character MD5 hash of filter parameters
    """
    # Sort keys for deterministic hash
    filter_str = dumps_for_cache(filters, default=str)
    return hashlib.md5(filter_str.encode()).hexdigest()[:12]


class RecurringPlanListParams(BaseModel):
    """Query parameters for list_recurring_plans endpoint with date validation."""

    from_date: str | None = Field(
        default=None,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Filter: next_execution_date >= from_date (YYYY-MM-DD)",
    )
    to_date: str | None = Field(
        default=None,
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Filter: next_execution_date <= to_date (YYYY-MM-DD)",
    )

    @field_validator("to_date")
    @classmethod
    def validate_date_range(cls, v: str | None, info) -> str | None:
        """Validate from_date <= to_date when both provided."""
        if v and info.data.get("from_date"):
            if info.data["from_date"] > v:
                raise ValueError("from_date must be <= to_date")
        return v


# NOTE: General route "/" must be defined BEFORE parameterized routes "/{id}"
# to ensure FastAPI matches them correctly (routes are matched in definition order)


@router.get("/", response_model=RecurringPlanListResponse)
async def list_recurring_plans(
    params: RecurringPlanListParams = Depends(),
    is_active: bool | None = Query(default=None, description="Filter by active status"),
    skip: int = Query(default=0, ge=0, description="Pagination offset"),
    limit: int = Query(default=50, ge=1, le=1000, description="Pagination limit"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
    cache_service: CacheService = Depends(get_cache_service),
):
    """
    List all recurring plans for current user with Redis caching.

    **Optimization (v6.6.0):** Uses Redis caching with 2-minute TTL.
    Cache invalidated after mutations. Different filter combinations cached separately.

    **Date filtering (v11.4.0):** Support from_date/to_date for sync period optimization.

    Args:
        is_active: Optional filter by active status
        from_date: Include plans with next_execution_date >= from_date (YYYY-MM-DD)
        to_date: Include plans with next_execution_date <= to_date (YYYY-MM-DD)
        skip: Pagination offset
        limit: Pagination limit (max 100)
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service
        cache_service: Cache service

    Returns:
        Paginated list of recurring plans with details
    """
    # Generate filter hash for cache isolation
    filters = {
        "skip": skip,
        "limit": limit,
        "is_active": is_active,
        "from_date": params.from_date,
        "to_date": params.to_date,
    }
    filter_hash = _generate_filter_hash(filters) if any(
        [is_active is not None, params.from_date, params.to_date]
    ) else None

    # Try cache first
    cache_key = CacheKey.recurring_plan_list(current_user.id, filter_hash)
    cached = await cache_service.get(cache_key)

    if cached:
        logger.info(
            f"[RECURRING_PLAN_CACHE] List cache HIT: user_id={current_user.id}, "
            f"filter_hash={filter_hash}"
        )
        return RecurringPlanListResponse(**cached)

    logger.info("[RECURRING_PLAN_CACHE] List cache MISS, fetching from DB")

    # Fetch from DB
    items, total = await service.list_recurring_plans(
        session=session,
        user_id=current_user.id,
        is_active=is_active,
        from_date=params.from_date,
        to_date=params.to_date,
        skip=skip,
        limit=limit,
    )

    result = {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

    # Cache with TTL (2 min)
    await cache_service.set(cache_key, result, ttl=120)
    logger.info(f"[RECURRING_PLAN_CACHE] List cached: ttl=120s, filter_hash={filter_hash}")

    return RecurringPlanListResponse(**result)


@router.get("/stats", response_model=RecurringPlanStats)
async def get_recurring_plan_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
    cache_service: CacheService = Depends(get_cache_service),
):
    """
    Get recurring plan statistics for dashboard with Redis caching.

    **Optimization (v6.6.0):** Uses Redis caching with 5-minute TTL.
    Cache invalidated after mutations (create, update, delete, activate).

    Args:
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service
        cache_service: Cache service

    Returns:
        Statistics including active count, paused count, monthly amount, pending count
    """
    # Try cache first
    cache_key = CacheKey.recurring_plan_stats(current_user.id)
    cached = await cache_service.get(cache_key)

    if cached:
        logger.info(f"[RECURRING_PLAN_CACHE] Stats cache HIT: user_id={current_user.id}")
        return RecurringPlanStats(**cached)

    logger.info("[RECURRING_PLAN_CACHE] Stats cache MISS, fetching from DB")

    # Fetch from DB (optimized version from Phase 2.2)
    stats = await service.get_stats(
        session=session,
        user_id=current_user.id,
    )

    # Cache with TTL (5 min per requirements)
    await cache_service.set(cache_key, stats, ttl=300)
    logger.info("[RECURRING_PLAN_CACHE] Stats cached: ttl=300s")

    return RecurringPlanStats(**stats)


@router.post("/", response_model=RecurringPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_recurring_plan(
    data: RecurringPlanCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
    cache_service: CacheService = Depends(get_cache_service),
):
    """
    Create a new recurring plan.

    Creates the plan template and generates initial facts for 3 months ahead.

    Args:
        data: Recurring plan creation data
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service
        cache_service: Cache service

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

        # Invalidate cache after creation
        await cache_service.invalidate_recurring_plans(current_user.id)
        logger.info(f"[RECURRING_PLAN_CACHE] Cache invalidated after CREATE: plan_id={plan.id}")

        # WebSocket broadcast - instant update
        await ws.broadcast_recurring_plan_created(plan_details)
        logger.info(f"[WS] Broadcasted recurring_plan_created: plan_id={plan.id}")

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
    cache_service: CacheService = Depends(get_cache_service),
):
    """
    Get recurring plan details by ID with Redis caching.

    **Optimization (v6.6.0):** Uses Redis caching with 30-minute TTL.
    Cache invalidated after mutations.

    Args:
        plan_id: Recurring plan ID
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service
        cache_service: Cache service

    Returns:
        Recurring plan with full details

    Raises:
        404: If plan not found or doesn't belong to user
    """
    # Try cache first
    cache_key = CacheKey.recurring_plan_detail(plan_id)
    cached = await cache_service.get(cache_key)

    if cached:
        logger.info(f"[RECURRING_PLAN_CACHE] Detail cache HIT: plan_id={plan_id}")
        return RecurringPlanResponse(**cached)

    logger.info("[RECURRING_PLAN_CACHE] Detail cache MISS, fetching from DB")

    # Fetch from DB (optimized version from Phase 2.1)
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

    # Cache with TTL (30 min)
    await cache_service.set(cache_key, plan_details, ttl=1800)
    logger.info("[RECURRING_PLAN_CACHE] Detail cached: ttl=1800s")

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
    cache_service: CacheService = Depends(get_cache_service),
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
        cache_service: Cache service

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

        # Invalidate cache after update
        await cache_service.invalidate_recurring_plans(current_user.id)
        logger.info(f"[RECURRING_PLAN_CACHE] Cache invalidated after UPDATE: plan_id={plan_id}")

        # WebSocket broadcast - instant update
        await ws.broadcast_recurring_plan_updated(plan_details)
        logger.info(f"[WS] Broadcasted recurring_plan_updated: plan_id={plan_id}")

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
    cache_service: CacheService = Depends(get_cache_service),
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
        cache_service: Cache service

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

        # Invalidate cache after deactivation
        await cache_service.invalidate_recurring_plans(current_user.id)
        logger.info(f"[RECURRING_PLAN_CACHE] Cache invalidated after DELETE: plan_id={plan_id}")

        # WebSocket broadcast - instant update
        await ws.broadcast_recurring_plan_deleted(plan_id)
        logger.info(f"[WS] Broadcasted recurring_plan_deleted: plan_id={plan_id}")

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


@router.post(
    "/batch-delete",
    status_code=status.HTTP_200_OK,
)
async def batch_delete_recurring_plans(
    plan_ids: list[int],
    delete_future_facts: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
    cache_service: CacheService = Depends(get_cache_service),
) -> dict:
    """
    Batch deactivate recurring plans (max 100).

    Deactivates multiple recurring plans in a single request, with optional
    deletion of future generated facts.

    **Validation:**
    - plan_ids list cannot be empty
    - Maximum 100 plans per request
    - Duplicate plan IDs automatically deduplicated

    **Partial Success:**
    - Continues processing on errors (doesn't fail entire batch)
    - Returns list of failed plan IDs with error messages
    - Successful deletions are committed even if some fail

    **WebSocket:**
    - Broadcasts single summary event: `recurring_plans_batch_deleted`
    - Reduces toast spam from N toasts to 1 summary toast

    **Performance:**
    - ~2-5 seconds for 100 plans (vs 2-4 minutes for individual requests)
    - Single cache invalidation after all deletions
    - Single database transaction per plan

    Args:
        plan_ids: List of recurring plan IDs to deactivate (1-100)
        delete_future_facts: Whether to delete future generated facts (default=False)
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service
        cache_service: Cache service

    Returns:
        dict: {
            "message": "Deleted N recurring plans",
            "deleted_count": int,
            "failed": list[dict]  # [{plan_id, error}, ...]
        }

    Raises:
        400: Empty list or more than 100 plans
    """
    # Validation
    if not plan_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="plan_ids list cannot be empty"
        )

    if len(plan_ids) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete more than 100 recurring plans at once"
        )

    # Deduplicate plan IDs
    unique_plan_ids = list(set(plan_ids))
    logger.info(
        f"[BULK_DELETE] Starting batch delete: user_id={current_user.id}, "
        f"requested={len(plan_ids)}, unique={len(unique_plan_ids)}, "
        f"delete_future_facts={delete_future_facts}"
    )

    deleted_count = 0
    failed = []

    # Process each plan (using existing service method)
    # Continue on errors to support partial success
    for plan_id in unique_plan_ids:
        try:
            await service.deactivate_recurring_plan(
                session, plan_id, current_user.id, delete_future_facts
            )
            deleted_count += 1
            logger.info(f"[BULK_DELETE] Deactivated recurring plan: plan_id={plan_id}")
        except ValueError as e:
            # Expected errors: not found, doesn't belong to user
            error_msg = str(e)
            logger.warning(f"[BULK_DELETE] Failed to delete plan_id={plan_id}: {error_msg}")
            failed.append({"plan_id": plan_id, "error": error_msg})
        except Exception:
            # Unexpected errors
            # Log full error для debugging (только в логах, не для клиента)
            logger.error(
                f"[BULK_DELETE] Unexpected error for plan_id={plan_id}",
                exc_info=True  # OK для внутренних логов
            )
            # Generic message для клиента (БЕЗ технических деталей)
            failed.append({
                "plan_id": plan_id,
                "error": "An unexpected error occurred. Please try again later."
            })

    logger.info(
        f"[BULK_DELETE] Batch delete completed: deleted={deleted_count}, failed={len(failed)}"
    )

    # Single cache invalidation (after all deletions)
    await cache_service.invalidate_recurring_plans(current_user.id)
    logger.info(f"[BULK_DELETE] Cache invalidated after deleting {deleted_count} plans")

    # Single WebSocket broadcast (SUMMARY EVENT)
    # Broadcasts to all connected clients for auto-reload
    await ws.broadcast_recurring_plans_batch_deleted(unique_plan_ids, deleted_count)
    logger.info(f"[BULK_DELETE] Broadcasted batch delete event: count={deleted_count}")

    # Build response message
    if failed:
        message = f"Deleted {deleted_count} recurring plans, {len(failed)} failed"
    else:
        message = f"Deleted {deleted_count} recurring plans"

    return {
        "message": message,
        "deleted_count": deleted_count,
        "failed": failed,
    }


@router.post("/{plan_id}/activate", response_model=RecurringPlanResponse)
async def activate_recurring_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    service: RecurringPlanService = Depends(get_recurring_plan_service),
    cache_service: CacheService = Depends(get_cache_service),
):
    """
    Reactivate a paused recurring plan.

    Args:
        plan_id: Recurring plan ID
        current_user: Authenticated user
        session: Database session
        service: Recurring plan service
        cache_service: Cache service

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

        # Invalidate cache after activation
        await cache_service.invalidate_recurring_plans(current_user.id)
        logger.info(f"[RECURRING_PLAN_CACHE] Cache invalidated after ACTIVATE: plan_id={plan_id}")

        # WebSocket broadcast - instant update
        await ws.broadcast_recurring_plan_updated(plan_details)
        logger.info(f"[WS] Broadcasted recurring_plan_updated (ACTIVATE): plan_id={plan_id}")

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
