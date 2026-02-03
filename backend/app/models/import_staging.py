"""
Import Staging Model

Temporary staging table for multi-bank CSV import workflow.
Holds imported transactions before user enrichment (category, FC, CC assignment).

Pattern: Staging table (temporary, deleted after import execution)
Table: t_import_staging
"""

from datetime import date, datetime

from sqlalchemy import JSON, BigInteger, Column, ForeignKey, Text
from sqlmodel import Field, SQLModel


class ImportStaging(SQLModel, table=True):
    """
    Staging table for multi-bank CSV import.

    Stores raw CSV transactions temporarily while user enriches them with:
    - article_id (budget category)
    - financial_center_id (ЦФО)
    - cost_center_id (МВЗ, optional)
    - is_selected flag (whether to import this transaction)

    Workflow:
    1. CSV upload → parse with mapping → insert ALL transactions here
    2. User edits in UI (assign category, FC, mark is_selected)
    3. Execute import → transfer is_selected=true to t_f_budget_fact
    4. Cleanup staging

    Table: t_import_staging
    Pattern: Temporary staging (deleted after import)

    Examples:
        # Generic CSV transaction (from any bank)
        >>> staging = ImportStaging(
        ...     user_id=123,
        ...     file_upload_id=456,
        ...     fact_date=date(2025, 11, 18),
        ...     amount_string="-900,00",
        ...     description="Кафе",
        ...     csv_metadata={"category": "Фастфуд"},
        ...     is_selected=False
        ... )
    """

    __tablename__ = "t_import_staging"

    # Primary key
    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Auto-incrementing primary key (BIGSERIAL in PostgreSQL)"
    )

    # Owner foreign key
    user_id: int = Field(
        nullable=False,
        foreign_key="t_d_user.id",
        index=True,
        description="User who uploaded this CSV import"
    )

    # File upload reference
    file_upload_id: int | None = Field(
        default=None,
        sa_column=Column(BigInteger, ForeignKey("t_import_file_upload.id"), nullable=True),
        description="Reference to file upload metadata"
    )

    # Bank provider reference (for filtering staging by bank)
    bank_provider_id: int | None = Field(
        default=None,
        foreign_key="t_d_bank_provider.id",
        index=True,
        description="Bank provider ID (for filtering staging records by bank)"
    )

    # Generic CSV fields (mapped from any bank's CSV)
    fact_date: date = Field(
        nullable=False,
        description="Transaction date (mapped from CSV column)"
    )

    amount_string: str = Field(
        max_length=20,
        nullable=False,
        description="Raw amount string from CSV with sign and separator (e.g., '-900,00')"
    )

    description: str | None = Field(
        default=None,
        sa_column=Column(Text),
        description="Transaction description from CSV (mapped column)"
    )

    csv_metadata: dict | None = Field(
        default=None,
        sa_column=Column(JSON),
        description="Bank-specific metadata for UI filters. Structure: {category: str}. "
                    "Fields info1/info2 removed in v6.x (replaced by include_all_columns transformation)"
    )

    # User-assigned enrichment fields (mutable via UI)
    budget_description: str | None = Field(
        default=None,
        sa_type=Text,
        description="Custom budget description (overrides tinkoff_description in final import)"
    )

    user_comment: str | None = Field(
        default=None,
        sa_type=Text,
        description="User comment added during enrichment (concatenated with description on import)"
    )

    article_id: int | None = Field(
        default=None,
        foreign_key="t_d_article.id",
        description="Budget category assigned by user (required before import)"
    )

    financial_center_id: int | None = Field(
        default=None,
        foreign_key="t_d_financial_center.id",
        description="Financial center assigned by user (required before import)"
    )

    cost_center_id: int | None = Field(
        default=None,
        foreign_key="t_d_cost_center.id",
        description="Cost center assigned by user (optional)"
    )

    is_selected: bool = Field(
        default=False,
        index=True,
        nullable=False,
        description="Whether to import this transaction (user checkbox in UI)"
    )

    record_type: str = Field(
        default="fact",
        max_length=10,
        nullable=False,
        description="Record type: 'fact' for actual transactions, 'plan' for budget plans"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
        description="Timestamp when this staging record was created (UTC)"
    )
