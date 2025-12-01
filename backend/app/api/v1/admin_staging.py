"""
Admin Staging Endpoints

Provides administrative functionality for managing import staging records.
All endpoints require admin privileges (is_admin=True).

Part of the multi-bank CSV import workflow (FR-080 Enhanced).
"""

import logging
from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentAdmin, get_session
from backend.app.models.fact import BudgetFact
from backend.app.models.budget_fact_history import BudgetFactHistory
from backend.app.models.import_staging import ImportStaging
from backend.app.schemas.import_multibank_schema import (
    BulkUpdateRequest,
    ImportExecuteRequest,
    ImportExecuteResponse,
    StagingRecordResponse,
    StagingUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/staging", tags=["Admin - Import Staging"])


@router.get("", response_model=list[StagingRecordResponse])
async def list_staging_records(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    List all staging records for current user (admin only).

    Returns all records from t_import_staging for the current user.
    Used in Step 4 (Enrichment) of the import workflow.

    **Returns:**
    - List of staging records with all fields

    **Example:**
    ```
    GET /api/v1/admin/staging
    Response: [
        {
            "id": 1,
            "user_id": 123,
            "file_upload_id": 456,
            "fact_date": "2025-11-18",
            "amount_string": "-900,00",
            "description": "Кафе",
            "csv_metadata": {"category": "Фастфуд"},
            "budget_description": null,
            "article_id": null,
            "financial_center_id": null,
            "cost_center_id": null,
            "is_selected": false
        }
    ]
    ```
    """
    logger.info(f"Listing staging records for admin user {current_admin.id}")

    # Get all staging records for current user
    statement = select(ImportStaging).where(
        ImportStaging.user_id == current_admin.id
    ).order_by(ImportStaging.fact_date.desc(), ImportStaging.id)

    result = await session.execute(statement)
    records = result.scalars().all()

    return [
        StagingRecordResponse(
            id=record.id,
            user_id=record.user_id,
            file_upload_id=record.file_upload_id,
            bank_provider_id=record.bank_provider_id,
            fact_date=record.fact_date.isoformat(),
            amount_string=record.amount_string,
            description=record.description,
            csv_metadata=record.csv_metadata,
            budget_description=record.budget_description,
            article_id=record.article_id,
            financial_center_id=record.financial_center_id,
            cost_center_id=record.cost_center_id,
            is_selected=record.is_selected
        )
        for record in records
    ]


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
    logger.info(f"Updating staging record {staging_id} for admin user {current_admin.id}")

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
    logger.info(f"Deleting staging record {staging_id} for admin user {current_admin.id}")

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
    logger.info(f"Clearing all staging records for admin user {current_admin.id}")

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
        f"Bulk updating {len(request.staging_ids)} staging records for admin user {current_admin.id}"
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

        session.add(record)

    await session.commit()

    return {"message": f"Updated {len(records)} staging records"}


@router.post("/import", response_model=ImportExecuteResponse)
async def execute_import(
    request: ImportExecuteRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Execute import from staging to budget facts (admin only).

    Transfers selected staging records to t_f_budget_fact with history tracking.

    **Workflow:**
    1. Validate all staging records exist
    2. Validate all have required fields (article_id, financial_center_id)
    3. Convert amount_string to Decimal
    4. Create BudgetFact records
    5. Create BudgetFactHistory records
    6. Delete staging records
    7. Return success with count

    **Request Body:**
    ```json
    {
        "staging_ids": [1, 2, 3, 4, 5]
    }
    ```

    **Returns:**
    ```json
    {
        "success": true,
        "total_imported": 5,
        "message": "Successfully imported 5 transactions"
    }
    ```

    **Example:**
    ```
    POST /api/v1/admin/staging/import
    Response: {
        "success": true,
        "total_imported": 5,
        "message": "Successfully imported 5 transactions"
    }
    ```
    """
    logger.info(
        f"Executing import of {len(request.staging_ids)} staging records for admin user {current_admin.id}"
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

    if len(records) != len(request.staging_ids):
        raise HTTPException(
            400,
            f"Some staging records not found. Requested: {len(request.staging_ids)}, Found: {len(records)}"
        )

    # Validate all records have required fields
    for record in records:
        if not record.article_id:
            raise HTTPException(
                400,
                f"Staging record {record.id} missing article_id. Please assign category first."
            )
        if not record.financial_center_id:
            raise HTTPException(
                400,
                f"Staging record {record.id} missing financial_center_id. Please assign financial center first."
            )

    # Import records
    imported_count = 0
    now = datetime.utcnow()

    for record in records:
        # Parse amount string (handle both comma and dot as decimal separator)
        # Convert to absolute value since bank CSVs store expenses as negative numbers
        # but database requires positive amounts (check_amount_positive constraint)
        try:
            amount_str = record.amount_string.replace(",", ".")
            amount = abs(Decimal(amount_str))
        except Exception as e:
            logger.error(f"Failed to parse amount '{record.amount_string}' for record {record.id}: {e}")
            raise HTTPException(
                400,
                f"Invalid amount format '{record.amount_string}' in record {record.id}"
            )

        # Create BudgetFact
        fact = BudgetFact(
            user_id=record.user_id,
            article_id=record.article_id,
            financial_center_id=record.financial_center_id,
            cost_center_id=record.cost_center_id,
            amount=amount,
            fact_date=record.fact_date,
            description=record.budget_description or record.description,
            record_type="fact",
            created_at=now,
            updated_at=now
        )
        session.add(fact)
        await session.flush()  # Get fact.id

        # Create BudgetFactHistory (SCD Type 2)
        fact_history = BudgetFactHistory(
            fact_id=fact.id,
            user_id=fact.user_id,
            article_id=fact.article_id,
            financial_center_id=fact.financial_center_id,
            cost_center_id=fact.cost_center_id,
            amount=fact.amount,
            fact_date=fact.fact_date,
            description=fact.description,
            record_type=fact.record_type,
            transfer_id=None,
            valid_from=now,
            is_current=True,
            change_type="CREATE",
            changed_by_user_id=current_admin.id
        )
        session.add(fact_history)

        # Delete staging record
        await session.delete(record)

        imported_count += 1

    await session.commit()

    logger.info(f"Successfully imported {imported_count} transactions from staging for user {current_admin.id}")

    return ImportExecuteResponse(
        success=True,
        total_imported=imported_count,
        message=f"Successfully imported {imported_count} transactions"
    )
