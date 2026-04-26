"""
Pydantic schemas for Analytics endpoints.

This module defines request/response schemas for analytical data operations,
including plan hints and fact hints for transaction forms.
"""
from enum import Enum

from pydantic import BaseModel, Field


class TransactionFilterEnum(str, Enum):
    """
    Enum for transaction filter values in heatmap endpoint.

    Allowed values:
    - debit: Show only expense transactions (debit)
    - credit: Show only income transactions (credit)
    - all: Show all transactions (default)
    """
    DEBIT = "debit"
    CREDIT = "credit"
    ALL = "all"


class PlanHintsResponse(BaseModel):
    """
    Response schema for plan hints endpoint.

    Returns sum of plans and facts from previous month for the selected category.
    Used to populate hint buttons in plan creation modal.

    Example Usage:
        GET /api/v1/analytics/plan-hints?article_id=45&period=2025-11&article_type=expense

        Response:
        {
            "prev_period_plan_sum": 15000.00,
            "prev_period_fact_sum": 12500.00,
            "prev_period": "2025-10",
            "article_id": 45,
            "article_name": "Продукты",
            "article_type": "expense"
        }
    """

    prev_period_plan_sum: int | None = Field(
        None,
        ge=0,
        description="Sum of plans for the previous month in rubles (NULL if no data)"
    )

    prev_period_fact_sum: int | None = Field(
        None,
        ge=0,
        description="Sum of facts for the previous month in rubles (NULL if no data)"
    )

    prev_period: str = Field(
        ...,
        description="Previous period in YYYY-MM format",
        examples=["2025-10", "2025-11"]
    )

    article_id: int | None = Field(
        None,
        description="Category ID for which hints were calculated"
    )

    article_name: str | None = Field(
        None,
        description="Category name for display"
    )

    article_type: str = Field(
        ...,
        description="Article type: 'expense' or 'income'",
        examples=["expense", "income"]
    )


class FactHintsResponse(BaseModel):
    """
    Response schema for fact hints endpoint.

    Returns sum of plans and facts for the CURRENT month (based on fact_date).
    Used to display hints in fact creation modal (display-only, not clickable).

    Example Usage:
        GET /api/v1/analytics/fact-hints?fact_date=2025-12-15&article_type=expense&article_id=45

        Response:
        {
            "period_plan_sum": 15000.00,
            "period_fact_sum": 8500.00,
            "period": "2025-12",
            "article_id": 45,
            "article_name": "Продукты",
            "article_type": "expense"
        }
    """

    period_plan_sum: int | None = Field(
        None,
        ge=0,
        description="Sum of plans for the month in rubles (NULL if no data)"
    )

    period_fact_sum: int | None = Field(
        None,
        ge=0,
        description="Sum of facts for the month in rubles (NULL if no data)"
    )

    period: str = Field(
        ...,
        description="Period in YYYY-MM format",
        examples=["2025-12", "2025-11"]
    )

    article_id: int | None = Field(
        None,
        description="Category ID for which hints were calculated"
    )

    article_name: str | None = Field(
        None,
        description="Category name for display"
    )

    article_type: str = Field(
        ...,
        description="Article type: 'expense', 'income', 'debit', or 'credit'",
        examples=["expense", "income", "debit", "credit"]
    )


class PlanFilterOptionFC(BaseModel):
    """Financial center option for plan filter."""

    id: int
    name: str


class PlanFilterOptionArticle(BaseModel):
    """Article option for plan filter."""

    id: int
    name: str
    type: str
    parent_id: int | None


class PlanFilterOptionsResponse(BaseModel):
    """
    Response schema for plans/filter-options endpoint.

    Returns distinct filter values present in plan records (record_type='plan').
    Used to populate filter dropdowns with only real data (not full dictionaries).

    Example Usage:
        GET /api/v1/analytics/plans/filter-options

        Response:
        {
            "financial_centers": [{"id": 1, "name": "Sberbank"}],
            "article_types": ["expense", "income"],
            "articles": [{"id": 45, "name": "Продукты", "type": "expense", "parent_id": 10}]
        }
    """

    financial_centers: list[PlanFilterOptionFC]
    article_types: list[str]
    articles: list[PlanFilterOptionArticle]
