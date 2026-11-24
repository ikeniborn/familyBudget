"""
Admin Staging Endpoints

Provides administrative functionality for managing import staging records.
All endpoints require admin privileges (is_admin=True).

Part of the multi-bank CSV import workflow (FR-080 Enhanced).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentAdmin, get_session
from backend.app.models.import_staging import ImportStaging
from backend.app.schemas.import_multibank_schema import (
    BulkUpdateRequest,
    ImportExecuteRequest,
    ImportExecuteResponse,
    StagingRecordResponse,
    StagingUpdateRequest,
)
from backend.app.services.bank_import_confirmation import confirm_staging, preview_staging

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/admin/staging", tags=["Admin - Import Staging"])


@router.get("", response_model=list[StagingRecordResponse])
async def list_staging_records(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """Review the current user's staging rows against actual budget facts."""
    return await preview_staging(session, current_admin.id)


@router.patch("/{staging_id}")
async def update_staging_record(
    staging_id: int,
    update_data: StagingUpdateRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Update individual staging record field (admin only).

    Allows updating enrichment fields (article_id, financial_center_id, cost_center_id, budget_description).

    **Parameters:**
    - staging_id: Staging record ID

    **Request Body:**
    ```json
    {
        "article_id": 5,
        "financial_center_id": 3,
        "cost_center_id": null,
        "budget_description": "Custom description"
    }
    ```

    **Returns:**
    - Success message

    **Example:**
    ```
    PATCH /api/v1/admin/staging/123
    Body: {"article_id": 5}
    Response: {"message": "Staging record updated successfully"}
    ```
    """
    logger.info("Updating staging record %s for admin user %s", staging_id, current_admin.id)

    # Get staging record
    statement = select(ImportStaging).where(
        ImportStaging.id == staging_id,
        ImportStaging.user_id == current_admin.id
    )
    result = await session.execute(statement)
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(404, "Staging record not found")

    # Update fields (only non-None values)
    if update_data.article_id is not None:
        record.article_id = update_data.article_id
    if update_data.financial_center_id is not None:
        record.financial_center_id = update_data.financial_center_id
    if update_data.cost_center_id is not None:
        record.cost_center_id = update_data.cost_center_id
    if update_data.budget_description is not None:
        record.budget_description = update_data.budget_description
    if update_data.user_comment is not None:
        record.user_comment = update_data.user_comment
    if update_data.record_type is not None:
        record.record_type = update_data.record_type

    session.add(record)
    await session.commit()

    return {"message": "Staging record updated successfully"}


@router.delete("/{staging_id}")
async def delete_staging_record(
    staging_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Delete individual staging record (admin only).

    **Parameters:**
    - staging_id: Staging record ID

    **Returns:**
    - Success message

    **Example:**
    ```
    DELETE /api/v1/admin/staging/123
    Response: {"message": "Staging record deleted successfully"}
    ```
    """
    logger.info("Deleting staging record %s for admin user %s", staging_id, current_admin.id)

    # Get staging record
    statement = select(ImportStaging).where(
        ImportStaging.id == staging_id,
        ImportStaging.user_id == current_admin.id
    )
    result = await session.execute(statement)
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(404, "Staging record not found")

    await session.delete(record)
    await session.commit()

    return {"message": "Staging record deleted successfully"}


@router.delete("")
async def clear_all_staging(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Clear all staging records for current user (admin only).

    Deletes all records from t_import_staging for the current user.

    **Returns:**
    - Success message with count

    **Example:**
    ```
    DELETE /api/v1/admin/staging
    Response: {"message": "Cleared 152 staging records"}
    ```
    """
    logger.info("Clearing all staging records for admin user %s", current_admin.id)

    # Get all staging records for current user
    statement = select(ImportStaging).where(
        ImportStaging.user_id == current_admin.id
    )
    result = await session.execute(statement)
    records = result.scalars().all()

    count = len(records)

    for record in records:
        await session.delete(record)

    await session.commit()

    return {"message": f"Cleared {count} staging records"}


@router.post("/bulk-delete")
async def bulk_delete_staging(
    request: BulkUpdateRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Bulk delete staging records (admin only).

    Deletes multiple staging records by IDs.

    **Request Body:**
    ```json
    {
        "staging_ids": [1, 2, 3, 4, 5]
    }
    ```

    **Returns:**
    - Success message with count

    **Example:**
    ```
    POST /api/v1/admin/staging/bulk-delete
    Response: {"message": "Deleted 5 staging records"}
    ```
    """
    logger.info(
        "Bulk deleting %s staging records for admin user %s", len(request.staging_ids), current_admin.id
    )

    if not request.staging_ids:
        raise HTTPException(400, "staging_ids cannot be empty")

    # Get all staging records
    statement = select(ImportStaging).where(
        ImportStaging.id.in_(request.staging_ids),
        ImportStaging.user_id == current_admin.id
    )
    result = await session.execute(statement)
    records = result.scalars().all()

    if not records:
        raise HTTPException(404, "No staging records found")

    # Delete records
    for record in records:
        await session.delete(record)

    await session.commit()

    return {"message": f"Deleted {len(records)} staging records"}


@router.post("/bulk-update")
async def bulk_update_staging(
    request: BulkUpdateRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Bulk update staging records (admin only).

    Updates multiple staging records with same enrichment values.

    **Request Body:**
    ```json
    {
        "staging_ids": [1, 2, 3],
        "article_id": 5,
        "financial_center_id": 3,
        "cost_center_id": null
    }
    ```

    **Returns:**
    - Success message with count

    **Example:**
    ```
    POST /api/v1/admin/staging/bulk-update
    Response: {"message": "Updated 3 staging records"}
    ```
    """
    logger.info(
        "Bulk updating %s staging records for admin user %s", len(request.staging_ids), current_admin.id
    )

    if not request.staging_ids:
        raise HTTPException(400, "staging_ids cannot be empty")

    # Get all staging records
    statement = select(ImportStaging).where(
        ImportStaging.id.in_(request.staging_ids),
        ImportStaging.user_id == current_admin.id
    )
    result = await session.execute(statement)
    records = result.scalars().all()

    if not records:
        raise HTTPException(404, "No staging records found")

    # Update fields (only non-None values)
    for record in records:
        if request.article_id is not None:
            record.article_id = request.article_id
        if request.financial_center_id is not None:
            record.financial_center_id = request.financial_center_id
        if request.cost_center_id is not None:
            record.cost_center_id = request.cost_center_id
        if request.record_type is not None:
            record.record_type = request.record_type

        session.add(record)

    await session.commit()

    return {"message": f"Updated {len(records)} staging records"}


@router.post("/import", response_model=ImportExecuteResponse)
async def execute_import(
    request: ImportExecuteRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """Commit a reviewed selection and retain its response for safe retries."""
    return await confirm_staging(session, current_admin.id, request)
