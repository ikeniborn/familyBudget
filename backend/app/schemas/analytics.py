"""
Pydantic schemas for Analytics endpoints.

This module defines request/response schemas for analytical data operations,
including plan hints and fact hints for transaction forms.
"""
from decimal import Decimal

from pydantic import BaseModel, Field


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

    prev_period_plan_sum: Decimal | None = Field(
        None,
        ge=0,
        description="Sum of plans for the previous month (NULL if no data)"
    )

    prev_period_fact_sum: Decimal | None = Field(
        None,
        ge=0,
        description="Sum of facts for the previous month (NULL if no data)"
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

    period_plan_sum: Decimal | None = Field(
        None,
        ge=0,
        description="Sum of plans for the month (NULL if no data)"
    )

    period_fact_sum: Decimal | None = Field(
        None,
        ge=0,
        description="Sum of facts for the month (NULL if no data)"
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
