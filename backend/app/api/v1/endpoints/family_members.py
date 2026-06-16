"""Family member REST endpoints (shared across all family users)."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.v1.endpoints.budget_ws import broadcast_medicine_changed
from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.family_member import (
    FamilyMemberCreate, FamilyMemberListResponse, FamilyMemberResponse, FamilyMemberUpdate,
)
from backend.app.services import family_member_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/family-members", tags=["family-members"], responses=get_common_responses())


@router.get("", response_model=FamilyMemberListResponse)
async def list_family_members(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FamilyMemberListResponse:
    rows, total = await family_member_service.list_family_members(session)
    return FamilyMemberListResponse(
        family_members=[FamilyMemberResponse.model_validate(r) for r in rows], total=total)


@router.post("", response_model=FamilyMemberResponse, status_code=status.HTTP_201_CREATED)
async def create_family_member(
    data: FamilyMemberCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FamilyMemberResponse:
    m = await family_member_service.create_family_member(
        session, data.model_dump(), default_guardian_id=current_user.id)
    resp = FamilyMemberResponse.model_validate(m)
    await broadcast_medicine_changed("family_member", resp.model_dump(mode="json"))
    return resp


@router.patch("/{member_id}", response_model=FamilyMemberResponse)
async def update_family_member(
    member_id: int, data: FamilyMemberUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FamilyMemberResponse:
    m = await family_member_service.get_family_member(session, member_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Family member {member_id} not found")
    m = await family_member_service.update_family_member(
        session, m, data.model_dump(exclude_unset=True))
    resp = FamilyMemberResponse.model_validate(m)
    await broadcast_medicine_changed("family_member", resp.model_dump(mode="json"))
    return resp


@router.delete("/{member_id}", response_model=FamilyMemberResponse, summary="Soft-archive family member")
async def delete_family_member(
    member_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FamilyMemberResponse:
    m = await family_member_service.get_family_member(session, member_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Family member {member_id} not found")
    if await family_member_service.has_active_links(session, member_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot archive: family member has active courses")
    m = await family_member_service.archive_family_member(session, m)
    resp = FamilyMemberResponse.model_validate(m)
    await broadcast_medicine_changed("family_member", resp.model_dump(mode="json"))
    return resp
