"""
Import Column Mapping Model

Stores user-defined column mappings for CSV imports (per bank, per user).
Allows reusing mappings for repeated imports.

Pattern: Configuration table (SCD Type 1)
Table: t_import_column_mapping
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


class ImportColumnMapping(SQLModel, table=True):
    """
    User-defined CSV column mapping (per bank).

    Stores column mapping configuration (CSV column → budget field).
    One mapping per bank per user (SCD Type 1 - updates in-place).

    Table: t_import_column_mapping
    Pattern: Configuration table (SCD Type 1)
    Constraint: Unique (bank_provider_id, user_id)

    Mapping structure:
        {
            "fact_date": "Дата операции",       # Required
            "amount": "Сумма операции",          # Required
            "description": "Описание",           # Optional
            "csv_category": "Категория",         # Optional (for filters)
            "csv_mcc": "MCC",                    # Optional (for filters)
            "csv_card": "Номер карты"            # Optional (for filters)
        }

    Transformations structure (optional):
        {
            "date_format": "%d.%m.%Y %H:%M:%S",
            "amount_decimal_separator": ",",
            "amount_thousand_separator": ""
        }

    Examples:
        >>> mapping = ImportColumnMapping(
        ...     bank_provider_id=1,
        ...     user_id=123,
        ...     mapping={
        ...         "fact_date": "Дата операции",
        ...         "amount": "Сумма операции",
        ...         "description": "Описание"
        ...     }
        ... )
    """

    __tablename__ = "t_import_column_mapping"
    __table_args__ = (
        UniqueConstraint('bank_provider_id', 'user_id', name='uq_bank_user_mapping'),
    )

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Auto-incrementing primary key"
    )

    # Business keys (unique constraint)
    bank_provider_id: int = Field(
        nullable=False,
        foreign_key="t_d_bank_provider.id",
        description="Bank provider this mapping applies to"
    )

    user_id: int = Field(
        nullable=False,
        foreign_key="t_d_user.id",
        description="User who created this mapping"
    )

    # Mapping configuration
    mapping: dict = Field(
        sa_column=Column(JSON, nullable=False),
        description="Column mapping (CSV column → budget field)"
    )

    transformations: Optional[dict] = Field(
        default=None,
        sa_column=Column(JSON),
        description="Optional transformations (date format, decimal separator, etc.)"
    )

    # Audit timestamps
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Timestamp when mapping was created (UTC)"
    )

    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Timestamp when mapping was last updated (UTC, SCD Type 1)"
    )
