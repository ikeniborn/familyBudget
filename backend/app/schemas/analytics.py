"""
Pydantic schemas for Analytics endpoints.

This module defines request/response schemas for analytical data operations,
including recommended amounts for quick selection in transaction forms.
"""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class RecommendedAmountsMetadata(BaseModel):
    """
    Metadata about recommended amounts calculation.

    Provides context about the statistical analysis used to generate recommendations.
    """

    source: str = Field(
        ...,
        description="Data source: 'k_means' (calculated), 'default' (fallback), or 'cached'",
        examples=["k_means", "default", "cached"]
    )

    sample_size: int = Field(
        ...,
        ge=0,
        description="Number of transactions analyzed (0 for default recommendations)",
        examples=[50, 120, 0]
    )

    min_amount: Optional[Decimal] = Field(
        None,
        ge=0,
        description="Minimum transaction amount in the sample",
        examples=["50.00", "100.00"]
    )

    max_amount: Optional[Decimal] = Field(
        None,
        ge=0,
        description="Maximum transaction amount in the sample",
        examples=["10000.00", "50000.00"]
    )

    avg_amount: Optional[Decimal] = Field(
        None,
        ge=0,
        description="Average transaction amount in the sample",
        examples=["1500.00", "25000.00"]
    )

    period_days: int = Field(
        90,  # Default to quarter (90 days) for backward compatibility with cached data
        gt=0,
        description="Analysis period in days (7=week, 30=month, 90=quarter, 365=year)",
        examples=[7, 30, 90, 365]
    )

    algorithm_version: Optional[str] = Field(
        None,
        description="Algorithm version used for calculation (e.g., '1.0')",
        examples=["1.0", "1.1"]
    )

    convergence_iterations: Optional[int] = Field(
        None,
        ge=0,
        description="Number of K-means iterations until convergence",
        examples=[5, 10, 20]
    )

    article_id: Optional[int] = Field(
        None,
        description="Category ID if recommendations are category-specific (NULL for global)",
        examples=[1, 5, 10, None]
    )

    article_name: Optional[str] = Field(
        None,
        description="Category name if recommendations are category-specific",
        examples=["Продукты", "Транспорт", "Зарплата", None]
    )


class RecommendedAmountsResponse(BaseModel):
    """
    Response schema for recommended amounts endpoint.

    Returns 4 recommended amounts calculated via K-means clustering on historical data.
    Used to populate quick selection buttons in transaction entry forms.

    Algorithm:
        - K-means clustering with k=4 clusters
        - Lloyd's algorithm with quantile-based initialization
        - Amounts rounded to "nice" numbers (10, 50, 100, 500, 1000, etc.)
        - Fallback to defaults if insufficient data (<20 transactions)

    Example Usage:
        GET /api/v1/analytics/recommended-amounts?article_id=5&type=expense&record_type=fact

        Response:
        {
            "amounts": [100.00, 500.00, 1000.00, 5000.00],
            "algorithm": "k_means",
            "metadata": {
                "source": "k_means",
                "sample_size": 50,
                "min_amount": 50.00,
                "max_amount": 10000.00,
                "avg_amount": 1500.00,
                "period_days": 90,
                "algorithm_version": "1.0",
                "article_id": 5,
                "article_name": "Продукты"
            }
        }
    """

    amounts: list[Decimal] = Field(
        ...,
        description="Array of 4 recommended amounts in ascending order (rounded to nice numbers)",
        examples=[[100.00, 500.00, 1000.00, 5000.00], [5000.00, 10000.00, 20000.00, 50000.00]],
        min_length=4,
        max_length=4
    )

    algorithm: str = Field(
        ...,
        description="Algorithm used: 'k_means' (calculated) or 'default' (fallback)",
        examples=["k_means", "default"]
    )

    metadata: RecommendedAmountsMetadata = Field(
        ...,
        description="Detailed metadata about the calculation"
    )


class RecommendedAmountsRequest(BaseModel):
    """
    Query parameters for recommended amounts endpoint.

    Used to filter recommendations by category, transaction type, and record type.
    """

    article_id: Optional[int] = Field(
        None,
        gt=0,
        description="Optional category ID filter (omit for global recommendations)",
        examples=[1, 5, 10, None]
    )

    type: Optional[str] = Field(
        None,
        description="Optional transaction type filter: 'income' or 'expense' (omit for all types)",
        examples=["income", "expense", None]
    )

    record_type: str = Field(
        "fact",
        description="Record type: 'fact' (actual transactions) or 'plan' (planned transactions)",
        examples=["fact", "plan"]
    )

    period: str = Field(
        "quarter",
        description="Analysis period: 'week' (7d), 'month' (30d), 'quarter' (90d), 'year' (365d)",
        examples=["week", "month", "quarter", "year"]
    )

    min_sample_size: int = Field(
        20,
        gt=0,
        description="Minimum number of transactions required for calculation (fallback to defaults if below)",
        examples=[10, 20, 50]
    )


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
