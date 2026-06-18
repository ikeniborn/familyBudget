"""Medicine catalog + stock REST endpoints (shared across all family users)."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.v1.endpoints.budget_ws import broadcast_medicine_changed
from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.medicine import (
    MedicineCreate, MedicineListResponse, MedicineResponse, MedicineUpdate,
)
from backend.app.schemas.medicine_stock import (
    MedicineAnalyticsResponse, MedicineSpendByMedicine, MedicineStockCreate,
    MedicineStockListResponse, MedicineStockResponse, MedicineStockUpdate,
)
from backend.app.services import medicine_analytics_service, medicine_service, medicine_stock_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/medicines", tags=["medicines"], responses=get_common_responses())
stock_router = APIRouter(prefix="/medicine-stock", tags=["medicine-stock"], responses=get_common_responses())


# ---------- Catalog ----------
@router.get("", response_model=MedicineListResponse, summary="List medicines")
async def list_medicines(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(True),
    q: str | None = Query(None, description="Search by name (ilike)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> MedicineListResponse:
    rows, total = await medicine_service.list_medicines(
        session, active_only=active_only, limit=limit, offset=offset, search=q)
    return MedicineListResponse(
        medicines=[MedicineResponse.model_validate(r) for r in rows],
        total=total, limit=limit, offset=offset)


@router.get("/search", response_model=MedicineListResponse, summary="Search medicines")
async def search_medicines(
    q: str = Query(..., min_length=1),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
) -> MedicineListResponse:
    rows, total = await medicine_service.list_medicines(
        session, active_only=True, limit=limit, offset=0, search=q)
    return MedicineListResponse(
        medicines=[MedicineResponse.model_validate(r) for r in rows],
        total=total, limit=limit, offset=0)


@router.get("/{medicine_id}", response_model=MedicineResponse)
async def get_medicine(
    medicine_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    m = await medicine_service.get_medicine(session, medicine_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {medicine_id} not found")
    return MedicineResponse.model_validate(m)


@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
async def create_medicine(
    data: MedicineCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    m = await medicine_service.create_medicine(session, data.model_dump(), current_user.id)
    resp = MedicineResponse.model_validate(m)
    await broadcast_medicine_changed("catalog", resp.model_dump(mode="json"))
    return resp


@router.patch("/{medicine_id}", response_model=MedicineResponse)
async def update_medicine(
    medicine_id: int, data: MedicineUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    m = await medicine_service.get_medicine(session, medicine_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {medicine_id} not found")
    m = await medicine_service.update_medicine(
        session, m, data.model_dump(exclude_unset=True), current_user.id)
    resp = MedicineResponse.model_validate(m)
    await broadcast_medicine_changed("catalog", resp.model_dump(mode="json"))
    return resp


@router.delete("/{medicine_id}", response_model=MedicineResponse, summary="Soft-archive medicine")
async def delete_medicine(
    medicine_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    m = await medicine_service.get_medicine(session, medicine_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {medicine_id} not found")
    if await medicine_service.has_active_links(session, medicine_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot archive: medicine has active stock")
    m = await medicine_service.archive_medicine(session, m, current_user.id)
    resp = MedicineResponse.model_validate(m)
    await broadcast_medicine_changed("catalog", resp.model_dump(mode="json"))
    return resp


# ---------- Stock ----------
@stock_router.get("", response_model=MedicineStockListResponse, summary="List stock")
async def list_stock(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    expiring_in_days: int | None = Query(None, ge=0),
    medicine_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> MedicineStockListResponse:
    rows, total = await medicine_stock_service.list_stock(
        session, limit=limit, offset=offset,
        expiring_in_days=expiring_in_days, medicine_id=medicine_id)
    return MedicineStockListResponse(
        stock=[MedicineStockResponse.model_validate(r) for r in rows],
        total=total, limit=limit, offset=offset)


@stock_router.get("/analytics", response_model=MedicineAnalyticsResponse, summary="Purchase analytics")
async def stock_analytics(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineAnalyticsResponse:
    data = await medicine_analytics_service.purchase_analytics(session)
    return MedicineAnalyticsResponse(
        total_spent=data["total_spent"],
        by_medicine=[MedicineSpendByMedicine(**r) for r in data["by_medicine"]])


@stock_router.post("", response_model=MedicineStockResponse, status_code=status.HTTP_201_CREATED)
async def create_stock(
    data: MedicineStockCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineStockResponse:
    if not await medicine_service.get_medicine(session, data.medicine_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {data.medicine_id} not found")
    s = await medicine_stock_service.create_stock(session, data.model_dump(), current_user.id)
    resp = MedicineStockResponse.model_validate(s)
    await broadcast_medicine_changed("stock", resp.model_dump(mode="json"))
    return resp


@stock_router.patch("/{stock_id}", response_model=MedicineStockResponse)
async def update_stock(
    stock_id: int, data: MedicineStockUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineStockResponse:
    s = await medicine_stock_service.get_stock(session, stock_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Stock {stock_id} not found")
    s = await medicine_stock_service.update_stock(
        session, s, data.model_dump(exclude_unset=True), current_user.id)
    resp = MedicineStockResponse.model_validate(s)
    await broadcast_medicine_changed("stock", resp.model_dump(mode="json"))
    return resp


@stock_router.delete("/{stock_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stock(
    stock_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    s = await medicine_stock_service.get_stock(session, stock_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Stock {stock_id} not found")
    await medicine_stock_service.soft_delete_stock(session, s, current_user.id)
    await broadcast_medicine_changed("stock", {"id": stock_id, "deleted": True})
    return None
