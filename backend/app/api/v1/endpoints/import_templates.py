"""
Import Templates API Endpoints

CRUD endpoints for CSV import templates (column mapping configurations).

Templates are USER-SPECIFIC (filtered by user_id).
"""


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser
from backend.app.db.session import get_session
from backend.app.models.import_template import ImportTemplate
from backend.app.schemas.import_template import (
    ImportTemplateCreate,
    ImportTemplateListResponse,
    ImportTemplateResponse,
    ImportTemplateUpdate,
)

router = APIRouter(prefix="/import-templates", tags=["Import Templates"])


@router.get("", response_model=ImportTemplateListResponse)
async def get_import_templates(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> ImportTemplateListResponse:
    """
    Get all import templates for current user.

    Templates are user-specific (filtered by user_id).

    Args:
        current_user: Current authenticated user
        session: Database session
        limit: Maximum number of templates to return
        offset: Offset for pagination

    Returns:
        List of import templates
    """
    # Query templates (USER-SPECIFIC)
    query = (
        select(ImportTemplate)
        .where(ImportTemplate.user_id == current_user.id)
        .where(ImportTemplate.is_active)
        .order_by(ImportTemplate.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(query)
    templates = result.scalars().all()

    # Count total
    count_query = (
        select(ImportTemplate)
        .where(ImportTemplate.user_id == current_user.id)
        .where(ImportTemplate.is_active)
    )
    count_result = await session.execute(count_query)
    total = len(count_result.scalars().all())

    return ImportTemplateListResponse(
        templates=[ImportTemplateResponse.model_validate(t) for t in templates],
        total=total,
    )


@router.get("/{template_id}", response_model=ImportTemplateResponse)
async def get_import_template(
    template_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> ImportTemplateResponse:
    """
    Get import template by ID.

    Only returns template if it belongs to current user.

    Args:
        template_id: Template ID
        current_user: Current authenticated user
        session: Database session

    Returns:
        Import template

    Raises:
        HTTPException: If template not found or access denied
    """
    # Query template (USER-SPECIFIC)
    result = await session.execute(
        select(ImportTemplate)
        .where(ImportTemplate.id == template_id)
        .where(ImportTemplate.user_id == current_user.id)
        .where(ImportTemplate.is_active)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import template not found",
        )

    return ImportTemplateResponse.model_validate(template)


@router.post("", response_model=ImportTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_import_template(
    template_data: ImportTemplateCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> ImportTemplateResponse:
    """
    Create new import template.

    Template will be associated with current user.

    Args:
        template_data: Template data
        current_user: Current authenticated user
        session: Database session

    Returns:
        Created import template
    """
    # Create template
    template = ImportTemplate(
        user_id=current_user.id,
        name=template_data.name,
        description=template_data.description,
        config=template_data.config,
    )

    session.add(template)
    await session.commit()
    await session.refresh(template)

    return ImportTemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=ImportTemplateResponse)
async def update_import_template(
    template_id: int,
    template_data: ImportTemplateUpdate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> ImportTemplateResponse:
    """
    Update import template.

    Only allows updating if template belongs to current user.

    Args:
        template_id: Template ID
        template_data: Updated template data
        current_user: Current authenticated user
        session: Database session

    Returns:
        Updated import template

    Raises:
        HTTPException: If template not found or access denied
    """
    # Get template (USER-SPECIFIC)
    result = await session.execute(
        select(ImportTemplate)
        .where(ImportTemplate.id == template_id)
        .where(ImportTemplate.user_id == current_user.id)
        .where(ImportTemplate.is_active)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import template not found",
        )

    # Update fields
    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    await session.commit()
    await session.refresh(template)

    return ImportTemplateResponse.model_validate(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_import_template(
    template_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """
    Delete import template (soft delete).

    Only allows deleting if template belongs to current user.

    Args:
        template_id: Template ID
        current_user: Current authenticated user
        session: Database session

    Raises:
        HTTPException: If template not found or access denied
    """
    # Get template (USER-SPECIFIC)
    result = await session.execute(
        select(ImportTemplate)
        .where(ImportTemplate.id == template_id)
        .where(ImportTemplate.user_id == current_user.id)
        .where(ImportTemplate.is_active)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import template not found",
        )

    # Soft delete
    template.is_active = False

    await session.commit()
