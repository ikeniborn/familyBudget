"""
User Staging Endpoints

Provides user-accessible functionality for managing import staging records.
All endpoints require authentication (CurrentUser).

Part of the multi-bank CSV import workflow (FR-080 Enhanced).

This is the user-level counterpart to admin_staging.py - users can only
access and modify their own staging records (filtered by user_id).
"""

import logging
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.budget_fact_history import BudgetFactHistory
from backend.app.models.fact import BudgetFact
from backend.app.models.import_staging import ImportStaging
from backend.app.schemas.import_multibank_schema import (
    BulkUpdateRequest,
    ImportExecuteRequest,
    ImportExecuteResponse,
    StagingRecordResponse,
    StagingUpdateRequest,
)

logger = logging.getLogger(__name__)


def _parse_amount_smart(amount_str: str) -> Decimal:
    """
    Parse amount string with smart format detection.

    Handles various international number formats:
    - Russian/EU: "1 234,56" or "-1 234,56" (space thousands, comma decimal)
    - US: "1,234.56" or "-1,234.56" (comma thousands, dot decimal)
    - German: "1.234,56" or "-1.234,56" (dot thousands, comma decimal)
    - Edge case: "15.100.00" (multiple dots - treat as thousand separators)
    - Simple: "1234.56", "1234,56", "1234"

    The key insight for ambiguous formats like "X.XXX.XX":
    - If the string ends with ".XX" (two digits after last dot), that's likely a decimal
    - The preceding dots are thousand separators

    Args:
        amount_str: Amount string from staging record

    Returns:
        Decimal value

    Raises:
        ValueError: If amount cannot be parsed

    Examples:
        >>> _parse_amount_smart("-15.100.00")  # German-like with dot decimal
        Decimal('-15100.00')

        >>> _parse_amount_smart("-1.234,56")   # German
        Decimal('-1234.56')

        >>> _parse_amount_smart("-1,234.56")   # US
        Decimal('-1234.56')

        >>> _parse_amount_smart("-1 234,56")   # Russian
        Decimal('-1234.56')
    """
    if not amount_str:
        raise ValueError("Empty amount string")

    cleaned = amount_str.strip()

    # Remove currency symbols and extra whitespace
    # Common currency symbols: ₽ $ € £ ¥
    for symbol in ['₽', '$', '€', '£', '¥', 'RUB', 'USD', 'EUR', 'руб', 'руб.']:
        cleaned = cleaned.replace(symbol, '')
    cleaned = cleaned.strip()

    # Remove spaces (thousand separator in Russian format)
    cleaned = cleaned.replace(" ", "").replace("\u00a0", "")  # Also non-breaking space

    # Count separators
    dots = cleaned.count('.')
    commas = cleaned.count(',')

    try:
        # Case 1: No separators - simple integer
        if dots == 0 and commas == 0:
            return Decimal(cleaned)

        # Case 2: Single dot, no commas - standard decimal (1234.56)
        if dots == 1 and commas == 0:
            return Decimal(cleaned)

        # Case 3: Single comma, no dots - Russian decimal (1234,56)
        if dots == 0 and commas == 1:
            return Decimal(cleaned.replace(",", "."))

        # Case 4: Multiple dots, no commas (e.g., "15.100.00" or "1.234.567")
        # Heuristic: if ends with .XX (2 digits), last dot is decimal separator
        if dots >= 2 and commas == 0:
            # Check if it looks like "XXX.XX" at the end (decimal with 2 places)
            last_dot_pos = cleaned.rfind('.')
            after_last_dot = cleaned[last_dot_pos + 1:]

            if len(after_last_dot) == 2 and after_last_dot.isdigit():
                # Treat as: thousand separators + decimal
                # "15.100.00" -> "15100.00"
                # Split at last dot, remove other dots, rejoin
                before_decimal = cleaned[:last_dot_pos].replace(".", "")
                return Decimal(f"{before_decimal}.{after_last_dot}")
            else:
                # All dots are thousand separators: "1.234.567" -> "1234567"
                return Decimal(cleaned.replace(".", ""))

        # Case 5: Dots and comma mixed - determine which is decimal
        # German: "1.234,56" (dot thousands, comma decimal) -> last_comma > last_dot
        # US: "1,234.56" (comma thousands, dot decimal) -> last_dot > last_comma
        if dots >= 1 and commas >= 1:
            last_dot = cleaned.rfind('.')
            last_comma = cleaned.rfind(',')

            if last_comma > last_dot:
                # German format: dots are thousands, comma is decimal
                cleaned = cleaned.replace(".", "")
                cleaned = cleaned.replace(",", ".")
                return Decimal(cleaned)
            else:
                # US format: commas are thousands, dot is decimal
                cleaned = cleaned.replace(",", "")
                return Decimal(cleaned)

        # Case 6: Multiple commas, no dots (e.g., "1,234,567")
        # Commas are thousand separators
        if commas >= 2 and dots == 0:
            return Decimal(cleaned.replace(",", ""))

        # Fallback: try as-is
        return Decimal(cleaned)

    except Exception as e:
        raise ValueError(f"Cannot parse amount: {amount_str}") from e


router = APIRouter(prefix="/staging", tags=["Import Staging"])


@router.get("", response_model=list[StagingRecordResponse])
async def list_staging_records(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    List all staging records for current user.

    Returns all records from t_import_staging for the current user.
    Used in Step 4 (Enrichment) of the import workflow.

    **Returns:**
    - List of staging records with all fields

    **Example:**
    ```
    GET /api/v1/staging
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
    logger.info(f"Listing staging records for user {current_user.id}")

    # Get all staging records for current user
    statement = select(ImportStaging).where(
        ImportStaging.user_id == current_user.id
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
            user_comment=record.user_comment,
            article_id=record.article_id,
            financial_center_id=record.financial_center_id,
            cost_center_id=record.cost_center_id,
            is_selected=record.is_selected,
            record_type=record.record_type
        )
        for record in records
    ]


@router.patch("/{staging_id}")
async def update_staging_record(
    staging_id: int,
    update_data: StagingUpdateRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Update individual staging record field.

    Allows updating enrichment fields (article_id, financial_center_id, cost_center_id, budget_description).
    Users can only update their own staging records.

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
    PATCH /api/v1/staging/123
    Body: {"article_id": 5}
    Response: {"message": "Staging record updated successfully"}
    ```
    """
    logger.info(f"Updating staging record {staging_id} for user {current_user.id}")

    # Get staging record - filter by user_id for security
    statement = select(ImportStaging).where(
        ImportStaging.id == staging_id,
        ImportStaging.user_id == current_user.id
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
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Delete individual staging record.

    Users can only delete their own staging records.

    **Parameters:**
    - staging_id: Staging record ID

    **Returns:**
    - Success message

    **Example:**
    ```
    DELETE /api/v1/staging/123
    Response: {"message": "Staging record deleted successfully"}
    ```
    """
    logger.info(f"Deleting staging record {staging_id} for user {current_user.id}")

    # Get staging record - filter by user_id for security
    statement = select(ImportStaging).where(
        ImportStaging.id == staging_id,
        ImportStaging.user_id == current_user.id
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
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Clear all staging records for current user.

    Deletes all records from t_import_staging for the current user.

    **Returns:**
    - Success message with count

    **Example:**
    ```
    DELETE /api/v1/staging
    Response: {"message": "Cleared 152 staging records"}
    ```
    """
    logger.info(f"Clearing all staging records for user {current_user.id}")

    # Get all staging records for current user
    statement = select(ImportStaging).where(
        ImportStaging.user_id == current_user.id
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
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Bulk delete staging records.

    Deletes multiple staging records by IDs.
    Users can only delete their own staging records.

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
    POST /api/v1/staging/bulk-delete
    Response: {"message": "Deleted 5 staging records"}
    ```
    """
    logger.info(
        f"Bulk deleting {len(request.staging_ids)} staging records for user {current_user.id}"
    )

    if not request.staging_ids:
        raise HTTPException(400, "staging_ids cannot be empty")

    # Get all staging records - filter by user_id for security
    statement = select(ImportStaging).where(
        ImportStaging.id.in_(request.staging_ids),
        ImportStaging.user_id == current_user.id
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
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Bulk update staging records.

    Updates multiple staging records with same enrichment values.
    Users can only update their own staging records.

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
    POST /api/v1/staging/bulk-update
    Response: {"message": "Updated 3 staging records"}
    ```
    """
    logger.info(
        f"Bulk updating {len(request.staging_ids)} staging records for user {current_user.id}"
    )

    if not request.staging_ids:
        raise HTTPException(400, "staging_ids cannot be empty")

    # Get all staging records - filter by user_id for security
    statement = select(ImportStaging).where(
        ImportStaging.id.in_(request.staging_ids),
        ImportStaging.user_id == current_user.id
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
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Execute import from staging to budget facts.

    Transfers selected staging records to t_f_budget_fact with history tracking.
    Users can only import their own staging records.

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
    POST /api/v1/staging/import
    Response: {
        "success": true,
        "total_imported": 5,
        "message": "Successfully imported 5 transactions"
    }
    ```
    """
    logger.info(
        f"Executing import of {len(request.staging_ids)} staging records for user {current_user.id}"
    )

    if not request.staging_ids:
        raise HTTPException(400, "staging_ids cannot be empty")

    # Get all staging records - filter by user_id for security
    statement = select(ImportStaging).where(
        ImportStaging.id.in_(request.staging_ids),
        ImportStaging.user_id == current_user.id
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
        # Parse amount string with smart format detection
        # Handles: Russian (1 234,56), US (1,234.56), German (1.234,56), and edge cases
        # Convert to absolute value since bank CSVs store expenses as negative numbers
        # but database requires positive amounts (check_amount_positive constraint)
        try:
            amount = abs(_parse_amount_smart(record.amount_string))
        except ValueError as e:
            logger.error(f"Failed to parse amount '{record.amount_string}' for record {record.id}: {e}")
            raise HTTPException(
                400,
                f"Invalid amount format '{record.amount_string}' in record {record.id}"
            )

        # Validate amount is non-zero (check_fact_amount_not_zero constraint)
        if amount == 0:
            raise HTTPException(
                400,
                f"Zero amount in staging record {record.id} ('{record.amount_string}'). "
                "Zero amounts are not allowed."
            )

        # Build final description: budget_description or description + user_comment (via period)
        base_description = record.budget_description or record.description or ""
        if record.user_comment:
            final_description = f"{base_description}. {record.user_comment}" if base_description else record.user_comment
        else:
            final_description = base_description or None

        # Create BudgetFact
        fact = BudgetFact(
            user_id=record.user_id,
            article_id=record.article_id,
            financial_center_id=record.financial_center_id,
            cost_center_id=record.cost_center_id,
            amount=amount,
            fact_date=record.fact_date,
            description=final_description,
            record_type=record.record_type,
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
            is_offline_sync=False,  # Import is always online
            valid_from=now,
            is_current=True,
            change_type="CREATE",
            changed_by_user_id=current_user.id
        )
        session.add(fact_history)

        # Delete staging record
        await session.delete(record)

        imported_count += 1

    await session.commit()

    logger.info(f"Successfully imported {imported_count} transactions from staging for user {current_user.id}")

    return ImportExecuteResponse(
        success=True,
        total_imported=imported_count,
        message=f"Successfully imported {imported_count} transactions"
    )
