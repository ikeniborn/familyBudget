"""Transfer schemas for API requests and responses."""

from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class TransferCreate(BaseModel):
    """Request schema for creating a transfer between financial centers."""

    transfer_date: date = Field(
        ...,
        description="Transfer date (YYYY-MM-DD)"
    )
    amount: Decimal = Field(
        ...,
        gt=0,
        max_digits=15,
        decimal_places=2,
        description="Transfer amount (must be positive)"
    )
    record_type: Literal["fact", "plan"] = Field(
        default="fact",
        description="Record type: 'fact' for actual transfers, 'plan' for planned transfers"
    )

    # FROM (expense)
    from_financial_center_id: int = Field(
        ...,
        description="Source financial center ID (откуда списываем)"
    )
    from_article_id: int = Field(
        ...,
        description="Expense article ID (категория списания)"
    )
    from_cost_center_id: Optional[int] = Field(
        default=None,
        description="Source cost center ID (optional)"
    )

    # TO (income)
    to_financial_center_id: int = Field(
        ...,
        description="Destination financial center ID (куда зачисляем)"
    )
    to_article_id: int = Field(
        ...,
        description="Income article ID (категория пополнения)"
    )
    to_cost_center_id: Optional[int] = Field(
        default=None,
        description="Destination cost center ID (optional)"
    )

    # Optional
    description: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Transfer description"
    )

    is_offline_sync: bool = Field(
        default=False,
        description="True if transfer created via offline synchronization"
    )

    # Deduplication fields (for offline sync and duplicate request prevention)
    sync_hash: Optional[str] = Field(
        default=None,
        max_length=32,
        description="MD5 hash for offline sync deduplication (content_hash|user_id|created_date)"
    )
    content_hash: Optional[str] = Field(
        default=None,
        max_length=32,
        description="MD5 hash of transfer content (from_cfo|to_cfo|amount|date|description)"
    )

    @field_validator('from_financial_center_id', 'to_financial_center_id')
    @classmethod
    def validate_financial_centers_different(cls, v, info):
        """Validate that from_cfo != to_cfo."""
        if info.field_name == 'to_financial_center_id':
            from_cfo = info.data.get('from_financial_center_id')
            if from_cfo and v == from_cfo:
                raise ValueError(
                    "from_financial_center_id and to_financial_center_id must be different"
                )
        return v

    @model_validator(mode='after')
    def validate_date_for_record_type(self):
        """Validate transfer date based on record_type.

        - fact: date cannot be in the future (with +1 day timezone tolerance)
        - plan: date can be any date (including future)

        Uses SYSTEM_TIMEZONE from config for consistent validation.
        Allows +1 day tolerance for timezone differences (same as FactCreate).
        """
        from datetime import timedelta

        from backend.app.utils.timezone import now_local

        if self.record_type == "fact":
            today = now_local().date()  # Uses SYSTEM_TIMEZONE from config
            # Allow +1 day tolerance for timezone differences
            # (user in UTC+14 can be up to 14 hours ahead of UTC server time)
            if self.transfer_date > today + timedelta(days=1):
                raise ValueError("Transfer date cannot be in the future for record_type='fact'")
        return self


class TransferResponse(BaseModel):
    """Response schema after creating a transfer."""

    transfer_id: int = Field(
        ...,
        description="Unique transfer ID linking both transactions"
    )
    expense_fact_id: int = Field(
        ...,
        description="ID of the expense transaction (списание)"
    )
    income_fact_id: int = Field(
        ...,
        description="ID of the income transaction (пополнение)"
    )
    created_at: str = Field(
        ...,
        description="Timestamp when transfer was created (ISO format)"
    )

    class Config:
        from_attributes = True
