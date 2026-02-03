"""
Pydantic schemas for Tinkoff CSV Import endpoints.

This module defines request/response schemas for CSV import workflow:
- Upload CSV → Staging
- Edit staging (category, FC, CC assignment)
- Execute import → BudgetFact
- Cleanup staging
"""

from datetime import date, datetime

from pydantic import BaseModel, Field

# Response schemas

class ImportUploadResponse(BaseModel):
    """
    Response after CSV file upload.

    Returns summary of parsed and filtered transactions.
    """

    total_parsed: int = Field(
        ...,
        ge=0,
        description="Total number of rows parsed from CSV"
    )

    total_filtered: int = Field(
        ...,
        ge=0,
        description="Number of rows after filtering (skipped FAILED, internal transfers)"
    )

    total_inserted: int = Field(
        ...,
        ge=0,
        description="Number of rows inserted into staging table"
    )

    skipped_failed: int = Field(
        default=0,
        ge=0,
        description="Number of FAILED transactions skipped"
    )

    skipped_internal: int = Field(
        default=0,
        ge=0,
        description="Number of internal transfers skipped"
    )


class ImportStagingResponse(BaseModel):
    """
    Single staging record with enriched data.

    Includes related entity names (article, FC, CC) for UI display.
    """

    id: int = Field(..., description="Staging record ID")

    # Owner
    user_id: int = Field(..., description="User who uploaded this CSV")

    # Raw Tinkoff CSV data
    tinkoff_date: date = Field(..., description="Transaction date from CSV")
    tinkoff_amount: str = Field(..., description="Raw amount from CSV (e.g., '-900,00')")
    tinkoff_category: str | None = Field(None, description="Tinkoff's category")
    tinkoff_mcc: str | None = Field(None, description="MCC code")
    tinkoff_description: str | None = Field(None, description="Transaction description")
    tinkoff_card: str | None = Field(None, description="Card number (e.g., '*5958')")

    # User-assigned enrichment
    budget_description: str | None = Field(None, description="Custom budget description (user-assigned)")

    article_id: int | None = Field(None, description="Budget category ID (assigned by user)")
    article_name: str | None = Field(None, description="Budget category name (enriched)")
    article_type: str | None = Field(None, description="Article type: income/expense (enriched)")

    financial_center_id: int | None = Field(None, description="Financial center ID (assigned by user)")
    financial_center_name: str | None = Field(None, description="FC name (enriched)")

    cost_center_id: int | None = Field(None, description="Cost center ID (optional)")
    cost_center_name: str | None = Field(None, description="CC name (enriched)")

    is_selected: bool = Field(..., description="Whether to import this transaction")

    # Audit
    created_at: datetime = Field(..., description="Staging record creation timestamp")


class ImportStagingListResponse(BaseModel):
    """
    Paginated list of staging records.
    """

    items: list[ImportStagingResponse] = Field(..., description="Staging records")
    total: int = Field(..., ge=0, description="Total number of staging records for this user")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=10000, description="Page size (max 10000 for client-side filtering)")


# Update schemas

class ImportStagingUpdate(BaseModel):
    """
    Schema for updating a single staging record.

    Allows user to assign category, FC, CC, budget description and mark as selected.
    """

    budget_description: str | None = Field(
        None,
        description="Custom budget description to override tinkoff_description"
    )

    article_id: int | None = Field(
        None,
        gt=0,
        description="Budget category ID to assign"
    )

    financial_center_id: int | None = Field(
        None,
        gt=0,
        description="Financial center ID to assign"
    )

    cost_center_id: int | None = Field(
        None,
        gt=0,
        description="Cost center ID to assign (optional)"
    )

    is_selected: bool | None = Field(
        None,
        description="Mark transaction for import"
    )


class ImportStagingBulkUpdate(BaseModel):
    """
    Schema for bulk updating multiple staging records.

    Applies same updates to all specified IDs.
    """

    ids: list[int] = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="List of staging record IDs to update"
    )

    updates: ImportStagingUpdate = Field(
        ...,
        description="Updates to apply to all selected records"
    )


class ImportStagingBulkUpdateResponse(BaseModel):
    """
    Response after bulk update.
    """

    updated_count: int = Field(
        ...,
        ge=0,
        description="Number of records successfully updated"
    )


# Execute schemas

class ImportExecuteResponse(BaseModel):
    """
    Response after import execution.

    Returns summary of imported/skipped/failed transactions.
    """

    success_count: int = Field(
        ...,
        ge=0,
        description="Number of transactions successfully imported"
    )

    skipped_count: int = Field(
        default=0,
        ge=0,
        description="Number of transactions skipped (validation errors)"
    )

    error_count: int = Field(
        default=0,
        ge=0,
        description="Number of transactions failed with errors"
    )

    errors: list[str] = Field(
        default_factory=list,
        description="List of error messages for failed imports"
    )


class ImportCleanupResponse(BaseModel):
    """
    Response after staging cleanup.
    """

    deleted_count: int = Field(
        ...,
        ge=0,
        description="Number of staging records deleted"
    )
