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
    ImportStagingListResponse,
    ImportStagingResponse,
    ImportUploadResponse,
)
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
    file: UploadFile = File(..., description="Tinkoff CSV file"),
    current_user: CurrentUser = Depends(),
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
    current_user: CurrentUser = Depends(),
    session: AsyncSession = Depends(get_session),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
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
                Article.id == record.article_id,
                Article.is_current == True  # noqa: E712
            )
            article_result = await session.execute(article_stmt)
            article = article_result.scalar_one_or_none()

        # Get financial center (if assigned)
        fc = None
        if record.financial_center_id:
            fc_stmt = select(FinancialCenter).where(
                FinancialCenter.id == record.financial_center_id,
                FinancialCenter.is_current == True  # noqa: E712
            )
            fc_result = await session.execute(fc_stmt)
            fc = fc_result.scalar_one_or_none()

        # Get cost center (if assigned)
        cc = None
        if record.cost_center_id:
            cc_stmt = select(CostCenter).where(
                CostCenter.id == record.cost_center_id,
                CostCenter.is_current == True  # noqa: E712
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
