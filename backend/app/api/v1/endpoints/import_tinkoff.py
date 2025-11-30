"""
Tinkoff CSV Import endpoints.

This module implements the import workflow for Tinkoff bank CSV files:
1. Upload CSV → Parse → Insert to staging
2. List staging records for user enrichment (category, FC, CC assignment)

Phase 1: Upload + List
Phase 2: Update, Bulk Update, Execute Import, Cleanup
"""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.import_staging import ImportStaging
from backend.app.schemas import get_common_responses
from backend.app.schemas.import_schema import (
    ImportCleanupResponse,
    ImportExecuteResponse,
    ImportStagingBulkUpdate,
    ImportStagingBulkUpdateResponse,
    ImportStagingListResponse,
    ImportStagingResponse,
    ImportStagingUpdate,
    ImportUploadResponse,
)
from backend.app.services.import_executor import ImportExecutor
from backend.app.services.tinkoff_csv_parser import TinkoffCSVParser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["Import"])


@router.post(
    "/tinkoff-csv",
    response_model=ImportUploadResponse,
    status_code=status.HTTP_201_CREATED,
    responses=get_common_responses(include_400=True),
)
async def upload_tinkoff_csv(
    current_user: CurrentUser,
    file: UploadFile = File(..., description="Tinkoff CSV file"),
    session: AsyncSession = Depends(get_session),
    skip_failed: bool = Query(True, description="Skip FAILED transactions"),
    skip_internal_transfers: bool = Query(True, description="Skip internal transfers"),
) -> ImportUploadResponse:
    """
    Upload Tinkoff CSV file and insert transactions into staging.

    **Workflow:**
    1. Parse CSV file (validate format, encoding)
    2. Filter transactions (skip FAILED, internal transfers)
    3. Insert all filtered transactions to staging table
    4. Return summary

    **Access:**
    - All authenticated users can upload

    **Returns:**
    - 201 Created: CSV uploaded and staged successfully
    - 400 Bad Request: Invalid CSV format or encoding
    """
    logger.info(
        f"User {current_user.id} uploading CSV: {file.filename}, "
        f"skip_failed={skip_failed}, skip_internal={skip_internal_transfers}"
    )

    try:
        # Parse and prepare staging records
        staging_data = await TinkoffCSVParser.parse_and_prepare(
            file=file,
            user_id=current_user.id,
            skip_failed=skip_failed,
            skip_internal_transfers=skip_internal_transfers
        )

        total_parsed = len(staging_data)
        logger.info(f"Parsed {total_parsed} transactions from CSV")

        # Insert staging records (batch)
        staging_records = [ImportStaging(**data) for data in staging_data]
        session.add_all(staging_records)
        await session.commit()

        logger.info(f"Inserted {len(staging_records)} staging records for user {current_user.id}")

        # Return summary (simplified - actual counts from parser)
        return ImportUploadResponse(
            total_parsed=total_parsed,  # Assuming all parsed for now
            total_filtered=total_parsed,
            total_inserted=len(staging_records),
            skipped_failed=0,  # TODO: track in parser
            skipped_internal=0  # TODO: track in parser
        )

    except HTTPException:
        # Re-raise HTTP exceptions from parser
        raise
    except Exception as e:
        logger.error(f"Failed to upload CSV for user {current_user.id}: {e}", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process CSV file"
        )


@router.get(
    "/staging",
    response_model=ImportStagingListResponse,
    responses=get_common_responses(),
)
async def list_staging(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=10000, description="Items per page (max 10000 for filtering)"),
    is_selected: Optional[bool] = Query(None, description="Filter by is_selected flag"),
) -> ImportStagingListResponse:
    """
    List staging records for current user.

    Returns paginated list with enriched data (article name, FC name, CC name).

    **Access:**
    - Users see only their own staging records

    **Filtering:**
    - is_selected: Filter by selected/unselected

    **Returns:**
    - 200 OK: Staging records retrieved successfully
    """
    # Base query: user's staging records
    stmt = select(ImportStaging).where(
        ImportStaging.user_id == current_user.id
    )

    # Apply filter
    if is_selected is not None:
        stmt = stmt.where(ImportStaging.is_selected == is_selected)

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    # Order by created_at desc (latest first)
    stmt = stmt.order_by(ImportStaging.created_at.desc())

    # Execute query
    result = await session.execute(stmt)
    staging_records = result.scalars().all()

    # Enrich with related entity names
    enriched_items = []
    for record in staging_records:
        # Get article (if assigned)
        article = None
        if record.article_id:
            article_stmt = select(Article).where(
                Article.id == record.article_id
            )
            article_result = await session.execute(article_stmt)
            article = article_result.scalar_one_or_none()

        # Get financial center (if assigned)
        fc = None
        if record.financial_center_id:
            fc_stmt = select(FinancialCenter).where(
                FinancialCenter.id == record.financial_center_id
            )
            fc_result = await session.execute(fc_stmt)
            fc = fc_result.scalar_one_or_none()

        # Get cost center (if assigned)
        cc = None
        if record.cost_center_id:
            cc_stmt = select(CostCenter).where(
                CostCenter.id == record.cost_center_id
            )
            cc_result = await session.execute(cc_stmt)
            cc = cc_result.scalar_one_or_none()

        # Create response item
        item = ImportStagingResponse(
            id=record.id,
            user_id=record.user_id,
            tinkoff_date=record.tinkoff_date,
            tinkoff_amount=record.tinkoff_amount,
            tinkoff_category=record.tinkoff_category,
            tinkoff_mcc=record.tinkoff_mcc,
            tinkoff_description=record.tinkoff_description,
            tinkoff_card=record.tinkoff_card,
            budget_description=record.budget_description,
            article_id=record.article_id,
            article_name=article.name if article else None,
            article_type=article.type if article else None,
            financial_center_id=record.financial_center_id,
            financial_center_name=fc.name if fc else None,
            cost_center_id=record.cost_center_id,
            cost_center_name=cc.name if cc else None,
            is_selected=record.is_selected,
            created_at=record.created_at
        )
        enriched_items.append(item)

    return ImportStagingListResponse(
        items=enriched_items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.put(
    "/staging/{staging_id}",
    response_model=ImportStagingResponse,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def update_staging_record(
    staging_id: int,
    update_data: ImportStagingUpdate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> ImportStagingResponse:
    """
    Update a single staging record.

    Allows user to assign:
    - article_id (budget category)
    - financial_center_id (ЦФО)
    - cost_center_id (МВЗ)
    - is_selected (mark for import)

    **Access:**
    - Users can only update their own staging records

    **Validation:**
    - article_id must exist
    - financial_center_id must exist
    - cost_center_id must exist if provided

    **Returns:**
    - 200 OK: Staging record updated successfully
    - 404 Not Found: Staging record not found
    - 403 Forbidden: Staging record doesn't belong to current user
    """
    # Get staging record
    stmt = select(ImportStaging).where(ImportStaging.id == staging_id)
    result = await session.execute(stmt)
    staging = result.scalar_one_or_none()

    if not staging:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staging record with id={staging_id} not found"
        )

    # Check ownership
    if staging.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own staging records"
        )

    # Validate article_id if provided
    if update_data.article_id is not None:
        article_stmt = select(Article).where(
            Article.id == update_data.article_id
        )
        article_result = await session.execute(article_stmt)
        article = article_result.scalar_one_or_none()

        if not article:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Article with id={update_data.article_id} not found"
            )

    # Validate financial_center_id if provided
    if update_data.financial_center_id is not None:
        fc_stmt = select(FinancialCenter).where(
            FinancialCenter.id == update_data.financial_center_id
        )
        fc_result = await session.execute(fc_stmt)
        fc = fc_result.scalar_one_or_none()

        if not fc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Financial center with id={update_data.financial_center_id} not found"
            )

    # Validate cost_center_id if provided
    if update_data.cost_center_id is not None:
        cc_stmt = select(CostCenter).where(
            CostCenter.id == update_data.cost_center_id
        )
        cc_result = await session.execute(cc_stmt)
        cc = cc_result.scalar_one_or_none()

        if not cc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cost center with id={update_data.cost_center_id} not found"
            )

    # Apply updates
    if update_data.budget_description is not None:
        staging.budget_description = update_data.budget_description
    if update_data.article_id is not None:
        staging.article_id = update_data.article_id
    if update_data.financial_center_id is not None:
        staging.financial_center_id = update_data.financial_center_id
    if update_data.cost_center_id is not None:
        staging.cost_center_id = update_data.cost_center_id
    if update_data.is_selected is not None:
        staging.is_selected = update_data.is_selected

    await session.commit()
    await session.refresh(staging)

    # Enrich response with related entity names
    article = None
    if staging.article_id:
        article_stmt = select(Article).where(
            Article.id == staging.article_id
        )
        article_result = await session.execute(article_stmt)
        article = article_result.scalar_one_or_none()

    fc = None
    if staging.financial_center_id:
        fc_stmt = select(FinancialCenter).where(
            FinancialCenter.id == staging.financial_center_id
        )
        fc_result = await session.execute(fc_stmt)
        fc = fc_result.scalar_one_or_none()

    cc = None
    if staging.cost_center_id:
        cc_stmt = select(CostCenter).where(
            CostCenter.id == staging.cost_center_id
        )
        cc_result = await session.execute(cc_stmt)
        cc = cc_result.scalar_one_or_none()

    return ImportStagingResponse(
        id=staging.id,
        user_id=staging.user_id,
        tinkoff_date=staging.tinkoff_date,
        tinkoff_amount=staging.tinkoff_amount,
        tinkoff_category=staging.tinkoff_category,
        tinkoff_mcc=staging.tinkoff_mcc,
        tinkoff_description=staging.tinkoff_description,
        tinkoff_card=staging.tinkoff_card,
        budget_description=staging.budget_description,
        article_id=staging.article_id,
        article_name=article.name if article else None,
        article_type=article.type if article else None,
        financial_center_id=staging.financial_center_id,
        financial_center_name=fc.name if fc else None,
        cost_center_id=staging.cost_center_id,
        cost_center_name=cc.name if cc else None,
        is_selected=staging.is_selected,
        created_at=staging.created_at
    )


@router.patch(
    "/staging/bulk",
    response_model=ImportStagingBulkUpdateResponse,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def bulk_update_staging(
    bulk_data: ImportStagingBulkUpdate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> ImportStagingBulkUpdateResponse:
    """
    Bulk update multiple staging records.

    Applies the same updates to all specified staging records.

    **Access:**
    - Users can only update their own staging records

    **Validation:**
    - All IDs must belong to current user
    - article_id must exist if provided
    - financial_center_id must exist if provided
    - cost_center_id must exist if provided

    **Transaction:**
    - All or nothing - if any validation fails, no records are updated

    **Returns:**
    - 200 OK: Staging records updated successfully
    - 404 Not Found: One or more IDs not found or article/FC/CC validation failed
    - 403 Forbidden: One or more IDs don't belong to current user
    """
    logger.info(
        f"User {current_user.id} bulk updating {len(bulk_data.ids)} staging records"
    )

    # Get all staging records by IDs
    stmt = select(ImportStaging).where(
        ImportStaging.id.in_(bulk_data.ids)
    )
    result = await session.execute(stmt)
    staging_records = list(result.scalars().all())

    # Check all IDs exist
    if len(staging_records) != len(bulk_data.ids):
        found_ids = {r.id for r in staging_records}
        missing_ids = set(bulk_data.ids) - found_ids
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staging records not found: {list(missing_ids)}"
        )

    # Check ownership - all records must belong to current user
    non_owned = [r.id for r in staging_records if r.user_id != current_user.id]
    if non_owned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You can only update your own staging records. Non-owned IDs: {non_owned}"
        )

    # Validate article_id if provided (once for all)
    if bulk_data.updates.article_id is not None:
        article_stmt = select(Article).where(
            Article.id == bulk_data.updates.article_id
        )
        article_result = await session.execute(article_stmt)
        article = article_result.scalar_one_or_none()

        if not article:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Article with id={bulk_data.updates.article_id} not found"
            )

    # Validate financial_center_id if provided (once for all)
    if bulk_data.updates.financial_center_id is not None:
        fc_stmt = select(FinancialCenter).where(
            FinancialCenter.id == bulk_data.updates.financial_center_id
        )
        fc_result = await session.execute(fc_stmt)
        fc = fc_result.scalar_one_or_none()

        if not fc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Financial center with id={bulk_data.updates.financial_center_id} not found"
            )

    # Validate cost_center_id if provided (once for all)
    if bulk_data.updates.cost_center_id is not None:
        cc_stmt = select(CostCenter).where(
            CostCenter.id == bulk_data.updates.cost_center_id
        )
        cc_result = await session.execute(cc_stmt)
        cc = cc_result.scalar_one_or_none()

        if not cc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cost center with id={bulk_data.updates.cost_center_id} not found"
            )

    # Apply updates to all records in transaction
    updated_count = 0
    for record in staging_records:
        if bulk_data.updates.budget_description is not None:
            record.budget_description = bulk_data.updates.budget_description
        if bulk_data.updates.article_id is not None:
            record.article_id = bulk_data.updates.article_id
        if bulk_data.updates.financial_center_id is not None:
            record.financial_center_id = bulk_data.updates.financial_center_id
        if bulk_data.updates.cost_center_id is not None:
            record.cost_center_id = bulk_data.updates.cost_center_id
        if bulk_data.updates.is_selected is not None:
            record.is_selected = bulk_data.updates.is_selected
        updated_count += 1

    await session.commit()

    logger.info(
        f"Bulk updated {updated_count} staging records for user {current_user.id}"
    )

    return ImportStagingBulkUpdateResponse(updated_count=updated_count)


@router.post(
    "/staging/execute",
    response_model=ImportExecuteResponse,
    responses=get_common_responses(),
)
async def execute_import(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> ImportExecuteResponse:
    """
    Execute import from staging to BudgetFact.

    Imports all selected staging records (is_selected=True) into BudgetFact table.

    **Workflow:**
    1. Get all selected staging records
    2. Validate each record (article_id, financial_center_id required)
    3. Convert amount from string to Decimal
    4. Create BudgetFact records
    5. Return summary (success/failed counts + error messages)

    **Validation:**
    - article_id must be assigned (required)
    - financial_center_id must be assigned (required)
    - amount must be parseable

    **Access:**
    - All authenticated users can execute import for their own staging records

    **Returns:**
    - 200 OK: Import executed (check success_count and errors for details)
    """
    logger.info(f"User {current_user.id} executing import from staging")

    # Execute import
    success_count, failed_count, error_messages = await ImportExecutor.execute_import(
        session=session,
        user_id=current_user.id,
        selected_only=True
    )

    logger.info(
        f"Import execution completed for user {current_user.id}: "
        f"{success_count} success, {failed_count} failed"
    )

    return ImportExecuteResponse(
        success_count=success_count,
        skipped_count=failed_count,  # Failed = skipped due to validation errors
        error_count=0,  # No unexpected errors (all handled)
        errors=error_messages
    )


@router.delete(
    "/staging",
    response_model=ImportCleanupResponse,
    responses=get_common_responses(),
)
async def cleanup_staging(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    selected_only: bool = Query(
        True,
        description="If True, delete only selected records. If False, delete all."
    )
) -> ImportCleanupResponse:
    """
    Delete staging records after import.

    **Usage:**
    - Call after successful import execution to cleanup staging table
    - By default deletes only selected records (is_selected=True)
    - Can delete all staging records if selected_only=False

    **Access:**
    - Users can only delete their own staging records

    **Returns:**
    - 200 OK: Staging records deleted successfully
    """
    logger.info(
        f"User {current_user.id} cleaning up staging, selected_only={selected_only}"
    )

    # Cleanup staging
    deleted_count = await ImportExecutor.cleanup_staging(
        session=session,
        user_id=current_user.id,
        selected_only=selected_only
    )

    logger.info(
        f"Cleanup completed for user {current_user.id}: {deleted_count} records deleted"
    )

    return ImportCleanupResponse(deleted_count=deleted_count)
