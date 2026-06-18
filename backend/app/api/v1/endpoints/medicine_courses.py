"""Medicine course + intake REST endpoints."""
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.v1.endpoints.budget_ws import (
    broadcast_medicine_course_changed, broadcast_medicine_intake_marked,
)
from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.medicine_course import (
    MedicineCourseCreate, MedicineCourseListResponse, MedicineCourseResponse,
    MedicineCourseUpdate, StockEstimate,
)
from backend.app.schemas.medicine_intake import (
    IntakeListItem, IntakeListResponse, IntakeMarkRequest, IntakeResponse,
)
from backend.app.services import family_member_service, medicine_course_service, medicine_intake_service, medicine_service
from backend.app.services.medicine_reminder_service import MedicineReminderService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/medicine-courses", tags=["medicine-courses"], responses=get_common_responses())
intakes_router = APIRouter(prefix="/medicine-intakes", tags=["medicine-intakes"], responses=get_common_responses())


async def _with_estimate(session, course) -> MedicineCourseResponse:
    resp = MedicineCourseResponse.model_validate(course)
    resp.estimate = StockEstimate(**await medicine_course_service.course_estimate(session, course))
    return resp


# ---------- Courses ----------
@router.get("", response_model=MedicineCourseListResponse)
async def list_courses(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(True),
    patient_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> MedicineCourseListResponse:
    rows, total = await medicine_course_service.list_courses(
        session, active_only=active_only, patient_id=patient_id, limit=limit, offset=offset)
    courses = [await _with_estimate(session, c) for c in rows]
    return MedicineCourseListResponse(courses=courses, total=total, limit=limit, offset=offset)


@router.get("/{course_id}", response_model=MedicineCourseResponse)
async def get_course(
    course_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    c = await medicine_course_service.get_course(session, course_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Course {course_id} not found")
    return await _with_estimate(session, c)


@router.post("", response_model=MedicineCourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    data: MedicineCourseCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    # Soft link (decision #6): validate medicine + patient EXIST, but do NOT block on empty stock.
    if not await medicine_service.get_medicine(session, data.medicine_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {data.medicine_id} not found")
    if not await family_member_service.get_family_member(session, data.patient_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Patient {data.patient_id} not found")
    c = await medicine_course_service.create_course(session, data.model_dump(), current_user.id)
    # Generate the first horizon window immediately so today's doses appear without waiting for the job.
    await medicine_intake_service.generate_for_course(
        session, c, c.start_date, _horizon_end(c.start_date))
    resp = await _with_estimate(session, c)
    await broadcast_medicine_course_changed(resp.model_dump(mode="json"))
    return resp


@router.patch("/{course_id}", response_model=MedicineCourseResponse)
async def update_course(
    course_id: int, data: MedicineCourseUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    c = await medicine_course_service.get_course(session, course_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Course {course_id} not found")
    c = await medicine_course_service.update_course(session, c, data.model_dump(exclude_unset=True))
    resp = await _with_estimate(session, c)
    await broadcast_medicine_course_changed(resp.model_dump(mode="json"))
    return resp


@router.post("/{course_id}/pause", response_model=MedicineCourseResponse)
async def pause_course(
    course_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    c = await medicine_course_service.get_course(session, course_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Course {course_id} not found")
    c = await medicine_course_service.pause_course(session, c)
    resp = await _with_estimate(session, c)
    await broadcast_medicine_course_changed(resp.model_dump(mode="json"))
    return resp


@router.post("/{course_id}/complete", response_model=MedicineCourseResponse)
async def complete_course(
    course_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    c = await medicine_course_service.get_course(session, course_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Course {course_id} not found")
    c = await medicine_course_service.complete_course(session, c)
    # Intentionally no _with_estimate: a completed course is soft-deleted and drops out
    # of the active list, so estimate is null here (unlike create/update/pause). DELETE
    # delegates to this handler and shares the null-estimate response shape.
    resp = MedicineCourseResponse.model_validate(c)
    await broadcast_medicine_course_changed(resp.model_dump(mode="json"))
    return resp


@router.delete("/{course_id}", response_model=MedicineCourseResponse)
async def delete_course(
    course_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    # Same as complete: soft-delete the course.
    return await complete_course(course_id, session, current_user)


# ---------- Intakes ----------
@intakes_router.get("", response_model=IntakeListResponse)
async def list_intakes(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    patient_id: int | None = Query(None),
    course_id: int | None = Query(None),
    on_date: str | None = Query(None, alias="date", description="'today' or YYYY-MM-DD"),
) -> IntakeListResponse:
    from backend.app.utils.timezone import now_local
    target: date | None = None
    if on_date == "today":
        target = now_local().date()
    elif on_date:
        try:
            target = date.fromisoformat(on_date)
        except ValueError:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                "Invalid date format; use YYYY-MM-DD or 'today'")
    # Lazy-backfill (spec «Генерация intake_log»): if the nightly maintenance job has not run
    # (scheduler idle longer than the horizon), regenerate the horizon when the dashboard opens.
    # generate_all is idempotent (pre-filter + ON CONFLICT), so this is cheap on the common path.
    if on_date in (None, "today"):
        await medicine_intake_service.generate_all(session)
    rows = await medicine_intake_service.list_intakes(
        session, on_date=target, patient_id=patient_id, course_id=course_id)
    items = [IntakeListItem(**r) for r in rows]
    return IntakeListResponse(intakes=items, total=len(items))


@intakes_router.post("/{intake_id}/take", response_model=IntakeResponse)
async def take_intake(
    intake_id: int, body: IntakeMarkRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> IntakeResponse:
    return await _mark(session, intake_id, "taken", body, current_user.id)


@intakes_router.post("/{intake_id}/skip", response_model=IntakeResponse)
async def skip_intake(
    intake_id: int, body: IntakeMarkRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> IntakeResponse:
    return await _mark(session, intake_id, "skipped", body, current_user.id)


@intakes_router.get("/{intake_id}", response_model=IntakeResponse)
async def get_intake_endpoint(
    intake_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> IntakeResponse:
    intake = await medicine_intake_service.get_intake(session, intake_id)
    if not intake:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Intake {intake_id} not found")
    return IntakeResponse.model_validate(intake)


@intakes_router.post("/{intake_id}/snooze", response_model=IntakeResponse)
async def snooze_intake(
    intake_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> IntakeResponse:
    intake = await medicine_intake_service.get_intake(session, intake_id)
    if not intake:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Intake {intake_id} not found")
    await MedicineReminderService().snooze(session, intake_id, current_user.id)
    await session.refresh(intake)
    return IntakeResponse.model_validate(intake)  # intake status unchanged; a new reminder was scheduled


# ---------- helpers ----------
def _horizon_end(start: date) -> date:
    from datetime import timedelta
    from backend.app.services.medicine_intake_service import GENERATION_HORIZON_DAYS
    from backend.app.utils.timezone import now_local
    return max(now_local().date(), start) + timedelta(days=GENERATION_HORIZON_DAYS)


async def _mark(session, intake_id: int, status_value: str, body: IntakeMarkRequest, user_id: int) -> IntakeResponse:
    intake = await medicine_intake_service.get_intake(session, intake_id)
    if not intake:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Intake {intake_id} not found")
    try:
        intake = await medicine_intake_service.mark_intake(
            session, intake, status=status_value, expected_version=body.version,
            user_id=user_id, dose_taken=body.dose_taken, comment=body.comment)
    except medicine_intake_service.IntakeVersionConflict:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Intake was modified by someone else; reload and retry")
    resp = IntakeResponse.model_validate(intake)
    await broadcast_medicine_intake_marked(resp.model_dump(mode="json"))
    return resp
