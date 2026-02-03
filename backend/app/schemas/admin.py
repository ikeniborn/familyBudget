"""
Pydantic schemas for Admin management endpoints.

This module defines schemas for admin-specific operations and statistics.
"""
from typing import Optional


from pydantic import BaseModel, Field


class SystemStatsResponse(BaseModel):
    """
    System-wide statistics for admin dashboard.

    Follows Shared Family Budget Model principles:
    - All metrics are GLOBAL (not filtered by user_id)
    - Reflects the entire family budget system
    - No per-user isolation for facts and articles

    Notes:
        - total_facts: ALL transactions in the system (Shared Family Budget)
        - total_articles: ALL active categories (Shared References)
        - total_active_users: Users who created at least one transaction (audit trail)
        - last_fact_date: Most recent transaction in the system

    See CLAUDE.md for Shared Family Budget Model details.
    """

    total_users: int = Field(
        description="Total number of registered users (is_current=True)",
        examples=[5],
        ge=0
    )

    total_active_users: int = Field(
        description="Users who created at least one transaction (audit trail)",
        examples=[3],
        ge=0
    )

    total_facts: int = Field(
        description="Total number of transactions in the system (Shared Family Budget)",
        examples=[150],
        ge=0
    )

    total_articles: int = Field(
        description="Total number of active categories (is_current=True, Shared References)",
        examples=[25],
        ge=0
    )

    last_fact_date: Optional[str] = Field(
        default=None,
        description="Date of the most recent transaction (ISO format YYYY-MM-DD)",
        examples=["2025-11-05", None]
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "total_users": 5,
                "total_active_users": 3,
                "total_facts": 150,
                "total_articles": 25,
                "last_fact_date": "2025-11-05"
            }
        }
    }


class UserStatsResponse(BaseModel):
    """
    User statistics response.

    DEPRECATED: This schema is kept for backward compatibility.
    Use SystemStatsResponse for admin dashboard statistics instead.

    This schema was designed for per-user isolation, which violates
    the Shared Family Budget Model documented in CLAUDE.md.
    """

    user_id: int = Field(description="User's database ID")
    username: Optional[str] = Field(default=None, description="Telegram username")
    first_name: Optional[str] = Field(default=None, description="User's first name")
    total_facts: int = Field(description="[DEPRECATED] Transactions created by user")
    total_articles: int = Field(description="[DEPRECATED] Categories created by user")
    last_fact_date: Optional[str] = Field(
        default=None,
        description="[DEPRECATED] Last transaction created by user"
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "user_id": 1,
                "username": "johndoe",
                "first_name": "John",
                "total_facts": 50,
                "total_articles": 10,
                "last_fact_date": "2025-11-05"
            }
        }
    }
