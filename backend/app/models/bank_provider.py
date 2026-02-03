"""
Bank Provider Model

Reference table for supported banks (Tinkoff, Alfabank, Sberbank, VTB, Raiffeisen).
Seeded during migration, used for multi-bank import functionality.

Pattern: Dimension table (SCD Type 1)
Table: t_d_bank_provider
"""
from typing import Optional

from datetime import datetime

from sqlmodel import Field, SQLModel


class BankProvider(SQLModel, table=True):
    """
    Bank provider reference table.

    Stores supported banks for multi-bank CSV import.
    Seeded with 5 default banks during migration.

    Table: t_d_bank_provider
    Pattern: Dimension table (SCD Type 1)

    Examples:
        >>> tinkoff = BankProvider(
        ...     code="tinkoff",
        ...     name="Тинькофф Банк",
        ...     active=True
        ... )
    """

    __tablename__ = "t_d_bank_provider"

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Auto-incrementing primary key"
    )

    # Business key
    code: str = Field(
        max_length=50,
        unique=True,
        nullable=False,
        description="Unique bank code (e.g., 'tinkoff', 'alfabank')"
    )

    name: str = Field(
        max_length=255,
        nullable=False,
        description="Bank display name (e.g., 'Тинькофф Банк')"
    )

    active: bool = Field(
        default=True,
        nullable=False,
        description="Whether this bank is active for import"
    )

    # Audit field
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Timestamp when this bank was added (UTC)"
    )
