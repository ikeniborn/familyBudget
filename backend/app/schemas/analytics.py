"""
Pydantic schemas for Analytics endpoints.

This module defines request/response schemas for analytical data operations.
"""

from decimal import Decimal
from typing import Optional

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

    prev_period_plan_sum: Optional[Decimal] = Field(
        None,
        ge=0,
        description="Sum of plans for the previous month (NULL if no data)"
    )

    prev_period_fact_sum: Optional[Decimal] = Field(
        None,
        ge=0,
        description="Sum of facts for the previous month (NULL if no data)"
    )

    prev_period: str = Field(
        ...,
        description="Previous period in YYYY-MM format",
        examples=["2025-10", "2025-11"]
    )

    article_id: Optional[int] = Field(
        None,
        description="Category ID for which hints were calculated"
    )

    article_name: Optional[str] = Field(
        None,
        description="Category name for display"
    )

    article_type: str = Field(
        ...,
        description="Article type: 'expense' or 'income'",
        examples=["expense", "income"]
    )
