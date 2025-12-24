"""
{ModelName} CRUD endpoints (Dimension Table - Shared References).

**Architecture:**
- Shared References: All users see all {model_name}s (no user isolation)
- Admin-only: CREATE/UPDATE/DELETE operations require admin role
- Audit trail: user_id tracks who created/modified (not for access control)

For detailed implementation see: backend/app/api/v1/endpoints/articles.py
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import (
    CurrentUser,
    get_session,
    get_user_id_for_create,
)
from backend.app.models.{model_name} import {ModelName}
from backend.app.schemas import get_common_responses
from backend.app.schemas.{model_name} import (
    {ModelName}Create,
    {ModelName}ListResponse,
    {ModelName}Response,
    {ModelName}Update,
)
from backend.app.services.{model_name}_service import (
    create_initial_history,
    update_{model_name}_profile,
)
from backend.app.services.cache_service import cache_service

router = APIRouter(prefix="/{model_name}s", tags=["{ModelName}s"])


@router.post(
    "",
    response_model={ModelName}Response,
    status_code=status.HTTP_201_CREATED,
    responses=get_common_responses(include_403=True),
)
async def create_{model_name}(
    {model_name}_data: {ModelName}Create,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Create a new {model_name}.

    **Shared References Architecture:**
    - All {model_name}s are shared across all users
    - Any authenticated user can create {model_name}s
    - {ModelName} is created with current user as creator (audit trail)

    **Admin-Only:** No (all authenticated users can create)

    **Returns:**
    - 201 Created: {ModelName} created successfully
    """

    # Create new {model_name} (SCD Type 1 - no versioning fields)
    {model_name} = {ModelName}(
        **{model_name}_data.model_dump(),
        user_id=get_user_id_for_create(current_user),
    )

    session.add({model_name})
    await session.commit()
    await session.refresh({model_name})

    # Create initial history record (SCD Type 2 for history)
    await create_initial_history(session=session, {model_name}={model_name}, change_type="CREATE")

    # Invalidate cache
    await cache_service.invalidate_{model_name}s()

    return {model_name}


@router.get(
    "",
    response_model={ModelName}ListResponse,
    responses=get_common_responses(),
)
async def list_{model_name}s(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> {ModelName}ListResponse:
    """
    List {model_name}s with pagination.

    **Shared References Architecture:**
    - All users see all {model_name}s (shared model)
    - No user isolation filtering

    **Returns:**
    - List of {model_name}s with pagination metadata
    """

    # ✅ CORRECT - Shared Budget: NO user_id filtering
    stmt = select({ModelName})

    # Pagination
    count_stmt = select(func.count()).select_from({ModelName})
    total = (await session.execute(count_stmt)).scalar()

    stmt = stmt.limit(limit).offset(offset)
    result = await session.execute(stmt)
    {model_name}s = result.scalars().all()

    return {ModelName}ListResponse(
        items={model_name}s,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{{id}}",
    response_model={ModelName}Response,
    responses=get_common_responses(include_404=True),
)
async def get_{model_name}(
    id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Get a single {model_name} by ID.

    **Shared References Architecture:**
    - All users can access all {model_name}s
    - No ownership check (shared model)

    **Returns:**
    - 200 OK: {ModelName} found
    - 404 Not Found: {ModelName} not found
    """

    # ✅ CORRECT - Shared Budget: NO user_id filtering
    stmt = select({ModelName}).where({ModelName}.id == id)
    result = await session.execute(stmt)
    {model_name} = result.scalar_one_or_none()

    if not {model_name}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ModelName} with id={{id}} not found"
        )

    return {model_name}


@router.put(
    "/{{id}}",
    response_model={ModelName}Response,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def update_{model_name}(
    id: int,
    {model_name}_data: {ModelName}Update,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Update a {model_name}.

    **Shared References Architecture:**
    - All users can access all {model_name}s
    - Admin-only operation (controlled in dependency)

    **Admin-Only:** Yes (enforced by middleware or dependency)

    **Returns:**
    - 200 OK: {ModelName} updated successfully
    - 403 Forbidden: User is not admin
    - 404 Not Found: {ModelName} not found
    """

    # Admin check (if required)
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update {model_name}s"
        )

    # Get existing {model_name}
    stmt = select({ModelName}).where({ModelName}.id == id)
    result = await session.execute(stmt)
    {model_name} = result.scalar_one_or_none()

    if not {model_name}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ModelName} with id={{id}} not found"
        )

    # Update {model_name} (SCD Type 1 - in-place update)
    update_data = {model_name}_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr({model_name}, key, value)

    await session.commit()
    await session.refresh({model_name})

    # Create history record
    await update_{model_name}_profile(session=session, {model_name}={model_name}, change_type="UPDATE")

    # Invalidate cache
    await cache_service.invalidate_{model_name}s()

    return {model_name}


@router.delete(
    "/{{id}}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def delete_{model_name}(
    id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Delete a {model_name}.

    **Shared References Architecture:**
    - All users can access all {model_name}s
    - Admin-only operation

    **Admin-Only:** Yes

    **Returns:**
    - 204 No Content: {ModelName} deleted successfully
    - 403 Forbidden: User is not admin
    - 404 Not Found: {ModelName} not found
    """

    # Admin check
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete {model_name}s"
        )

    # Get existing {model_name}
    stmt = select({ModelName}).where({ModelName}.id == id)
    result = await session.execute(stmt)
    {model_name} = result.scalar_one_or_none()

    if not {model_name}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ModelName} with id={{id}} not found"
        )

    # ✅ CRITICAL - Add await!
    await session.delete({model_name})
    await session.commit()

    # Create history record
    await update_{model_name}_profile(session=session, {model_name}={model_name}, change_type="DELETE")

    # Invalidate cache
    await cache_service.invalidate_{model_name}s()
