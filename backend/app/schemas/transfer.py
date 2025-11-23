"""Transfer schemas for API requests and responses."""

from decimal import Decimal
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, field_validator


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

    @field_validator('transfer_date')
    @classmethod
    def validate_not_future(cls, v):
        """Validate transfer date is not in the future."""
        from datetime import date as dt_date
        if v > dt_date.today():
            raise ValueError("Transfer date cannot be in the future")
        return v


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
