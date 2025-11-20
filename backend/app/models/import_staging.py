"""
Import Staging Model

Temporary staging table for Tinkoff CSV import workflow.
Holds imported transactions before user enrichment (category, FC, CC assignment).

Pattern: Staging table (temporary, deleted after import execution)
Table: t_import_staging
"""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Text
from sqlmodel import Field, SQLModel


class ImportStaging(SQLModel, table=True):
    """
    Staging table for Tinkoff bank CSV import.

    Stores raw CSV transactions temporarily while user enriches them with:
    - article_id (budget category)
    - financial_center_id (ЦФО)
    - cost_center_id (МВЗ, optional)
    - is_selected flag (whether to import this transaction)

    Workflow:
    1. CSV upload → parse → insert ALL transactions here
    2. User edits in UI (assign category, FC, mark is_selected)
    3. Execute import → transfer is_selected=true to t_f_budget_fact
    4. Cleanup staging

    Table: t_import_staging
    Pattern: Temporary staging (deleted after import)

    Examples:
        # Raw Tinkoff CSV transaction
        >>> staging = ImportStaging(
        ...     user_id=123,
        ...     tinkoff_date=date(2025, 11, 18),
        ...     tinkoff_amount="-900,00",
        ...     tinkoff_category="Фастфуд",
        ...     tinkoff_mcc="5814",
        ...     tinkoff_description="Кафе",
        ...     tinkoff_card="*5958",
        ...     is_selected=False
        ... )
    """

    __tablename__ = "t_import_staging"

    # Primary key
    id: Optional[int] = Field(
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

    # Raw Tinkoff CSV fields (immutable)
    tinkoff_date: date = Field(
        nullable=False,
        description="Transaction date from Tinkoff CSV (Дата операции)"
    )

    tinkoff_amount: str = Field(
        max_length=20,
        nullable=False,
        description="Raw amount string from CSV with sign and comma (e.g., '-900,00')"
    )

    tinkoff_category: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Tinkoff's category (e.g., 'Фастфуд', 'Супермаркеты')"
    )

    tinkoff_mcc: Optional[str] = Field(
        default=None,
        max_length=10,
        description="Merchant Category Code from Tinkoff (e.g., '5814')"
    )

    tinkoff_description: Optional[str] = Field(
        default=None,
        sa_type=Text,  # TEXT type
        description="Transaction description from Tinkoff CSV"
    )

    tinkoff_card: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Card number from Tinkoff CSV (e.g., '*5958')"
    )

    # User-assigned enrichment fields (mutable via UI)
    article_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_article.id",
        description="Budget category assigned by user (required before import)"
    )

    financial_center_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_financial_center.id",
        description="Financial center assigned by user (required before import)"
    )

    cost_center_id: Optional[int] = Field(
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

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
        description="Timestamp when this staging record was created (UTC)"
    )
