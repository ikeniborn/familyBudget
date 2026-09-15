"""Medicine CSV / Google Sheets import endpoints: stock + course (analyze → preview → execute)."""
import base64
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.v1.endpoints.budget_ws import (
    broadcast_medicine_changed, broadcast_medicine_course_changed,
)
from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.medicine_import import (
    GoogleSheetsFetchRequest, GoogleSheetsFetchResponse,
    MedicineAnalyzeRequest, MedicineAnalyzeResponse,
    MedicineImportRequest, MedicineImportResponse,
    MedicinePreviewRequest, MedicinePreviewResponse,
)
from backend.app.services import medicine_import_service as svc
from backend.app.services.google_sheets_parser import (
    GoogleSheetsError, fetch_google_sheets_as_csv, parse_google_sheets_url,
)

logger = logging.getLogger(__name__)

stock_import_router = APIRouter(
    prefix="/medicine-stock/import", tags=["medicine-import"], responses=get_common_responses())
stock_gs_router = APIRouter(
    prefix="/medicine-stock/google-sheets", tags=["medicine-import"], responses=get_common_responses())
course_import_router = APIRouter(
    prefix="/medicine-courses/import", tags=["medicine-import"], responses=get_common_responses())
course_gs_router = APIRouter(
    prefix="/medicine-courses/google-sheets", tags=["medicine-import"], responses=get_common_responses())


def _analyze(req: MedicineAnalyzeRequest, fields) -> MedicineAnalyzeResponse:
    try:
        det = svc.analyze(req.file_content)
    except Exception:  # noqa: BLE001
        logger.exception("medicine import: CSV analyze failed")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Не удалось разобрать CSV")
    return MedicineAnalyzeResponse(
        auto_mapping=svc.auto_map(det["detected_columns"], fields), **det)


async def _fetch_gs(req: GoogleSheetsFetchRequest) -> GoogleSheetsFetchResponse:
    try:
        sid, gid = await parse_google_sheets_url(req.url)
        raw = await fetch_google_sheets_as_csv(sid, gid)
    except GoogleSheetsError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return GoogleSheetsFetchResponse(file_content=base64.b64encode(raw).decode("ascii"))


# ---------- STOCK ----------
@stock_import_router.post("/analyze", response_model=MedicineAnalyzeResponse)
async def stock_analyze(req: MedicineAnalyzeRequest, current_user: User = Depends(get_current_user)):
    return _analyze(req, svc.STOCK_FIELDS)


@stock_import_router.post("/preview", response_model=MedicinePreviewResponse)
async def stock_preview(req: MedicinePreviewRequest, current_user: User = Depends(get_current_user)):
    rows = svc.parse_rows(req.file_content, req.delimiter, req.encoding, req.column_mapping, req.has_header)
    return MedicinePreviewResponse(**svc.preview_stock(rows))


@stock_import_router.post("/execute", response_model=MedicineImportResponse)
async def stock_execute(req: MedicineImportRequest, current_user: User = Depends(get_current_user),
                        session: AsyncSession = Depends(get_session)):
    rows = svc.parse_rows(req.file_content, req.delimiter, req.encoding, req.column_mapping, req.has_header)
    result = await svc.execute_stock(session, rows, current_user.id)
    if result.get("imported_count"):
        # Other clients refresh their stock views (catalog may have gained medicines too).
        await broadcast_medicine_changed("stock", {"imported": result["imported_count"]})
        await broadcast_medicine_changed("catalog", {"imported": result["imported_count"]})
    return MedicineImportResponse(**result)


@stock_gs_router.post("/fetch", response_model=GoogleSheetsFetchResponse)
async def stock_gs_fetch(req: GoogleSheetsFetchRequest, current_user: User = Depends(get_current_user)):
    return await _fetch_gs(req)


# ---------- COURSES ----------
@course_import_router.post("/analyze", response_model=MedicineAnalyzeResponse)
async def course_analyze(req: MedicineAnalyzeRequest, current_user: User = Depends(get_current_user)):
    return _analyze(req, svc.COURSE_FIELDS)


@course_import_router.post("/preview", response_model=MedicinePreviewResponse)
async def course_preview(req: MedicinePreviewRequest, current_user: User = Depends(get_current_user),
                         session: AsyncSession = Depends(get_session)):
    rows = svc.parse_rows(req.file_content, req.delimiter, req.encoding, req.column_mapping, req.has_header)
    return MedicinePreviewResponse(**await svc.preview_courses(session, rows))


@course_import_router.post("/execute", response_model=MedicineImportResponse)
async def course_execute(req: MedicineImportRequest, current_user: User = Depends(get_current_user),
                         session: AsyncSession = Depends(get_session)):
    rows = svc.parse_rows(req.file_content, req.delimiter, req.encoding, req.column_mapping, req.has_header)
    result = await svc.execute_courses(session, rows, current_user.id)
    if result.get("imported_count"):
        await broadcast_medicine_course_changed({"imported": result["imported_count"]})
    return MedicineImportResponse(**result)


@course_gs_router.post("/fetch", response_model=GoogleSheetsFetchResponse)
async def course_gs_fetch(req: GoogleSheetsFetchRequest, current_user: User = Depends(get_current_user)):
    return await _fetch_gs(req)
