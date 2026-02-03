"""
Pydantic schemas for Article endpoints.

This module defines request/response schemas for Article CRUD operations.
Articles represent budget categories with hierarchical organization.
"""

import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class ArticleCreate(BaseModel):
    """
    Schema for creating a new article.

    Validation Rules:
        - name: Required, max 255 characters
        - type: Must be 'income' or 'expense'
        - parent_id: Optional, must exist if provided

    Notes:
        - user_id is set automatically from current_user
        - Parent article must exist and belong to same user
    """

    name: str = Field(
        ...,
        max_length=255,
        min_length=1,
        description="Article display name",
        examples=["Food", "Groceries", "Salary"]
    )

    type: Literal["income", "expense", "debit", "credit"] = Field(
        ...,
        description="Article type: income, expense, debit (списание), credit (пополнение)",
        examples=["expense", "debit"]
    )

    parent_id: Optional[int] = Field(
        default=None,
        description="Parent article ID for hierarchy (NULL for root articles)",
        examples=[1, None]
    )

    is_active: bool = Field(
        default=True,
        description="Active status flag (True = visible in UI, False = archived)",
        examples=[True, False]
    )

    financial_center_ids: Optional[list[int]] = Field(
        default=None,
        description="List of financial center IDs this article is available for. "
                    "NULL/empty = available for all. Only valid for leaf articles.",
        examples=[[1, 2, 3], None]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        """
        Validate article name.

        Rules:
        - Cannot be empty or whitespace only
        - Must contain at least one alphanumeric character
        - Leading/trailing whitespace is trimmed
        """
        if not v or not v.strip():
            raise ValueError("Article name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Article name must contain at least one alphanumeric character"
            )

        return trimmed

    @field_validator("parent_id")
    @classmethod
    def parent_id_positive(cls, v: Optional[int]) -> Optional[int]:
        """Validate that parent_id is positive if provided."""
        if v is not None and v <= 0:
            raise ValueError("Parent ID must be a positive integer")
        return v


class ArticleUpdate(BaseModel):
    """
    Schema for updating an existing article.

    All fields are optional (partial update).
    Updates article IN-PLACE (SCD Type 1) and creates history snapshot (SCD Type 2).

    Validation Rules:
        - At least one field must be provided
        - Same validation as ArticleCreate for provided fields

    Notes:
        - Update modifies article IN-PLACE (id remains stable)
        - Creates ArticleHistory snapshot for audit trail
        - Cannot change user_id (articles belong to creator)
    """

    name: Optional[str] = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Article display name",
        examples=["Updated Food Name"]
    )

    type: Optional[Literal["income", "expense", "debit", "credit"]] = Field(
        default=None,
        description="Article type: income, expense, debit (списание), credit (пополнение)",
        examples=["expense", "credit"]
    )

    parent_id: Optional[int] = Field(
        default=None,
        description="Parent article ID for hierarchy",
        examples=[2]
    )

    is_active: Optional[bool] = Field(
        default=None,
        description="Active status flag (True = visible in UI, False = archived)",
        examples=[True, False]
    )

    financial_center_ids: Optional[list[int]] = Field(
        default=None,
        description="List of financial center IDs. Pass empty list [] to clear all links "
                    "(available for all). Only valid for leaf articles.",
        examples=[[1, 2], []]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        """Validate article name if provided."""
        if v is None:
            return None

        if not v or not v.strip():
            raise ValueError("Article name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Article name must contain at least one alphanumeric character"
            )

        return trimmed

    @field_validator("parent_id")
    @classmethod
    def parent_id_positive(cls, v: Optional[int]) -> Optional[int]:
        """Validate that parent_id is positive if provided."""
        if v is not None and v <= 0:
            raise ValueError("Parent ID must be a positive integer")
        return v


class ArticleHierarchyInfo(BaseModel):
    """
    Hierarchy information for an article.

    Provides hierarchical context without loading full parent/child objects.
    """

    has_children: bool = Field(
        description="True if article has child articles",
        examples=[True, False]
    )

    depth: int = Field(
        description="Depth in hierarchy (0 = root)",
        ge=0,
        examples=[0, 1, 2]
    )

    path: list[int] = Field(
        description="Path from root to this article (list of ancestor IDs)",
        examples=[[1, 2, 3], [1]]
    )


class ArticleResponse(BaseModel):
    """
    Schema for article responses.

    Includes all article fields plus optional hierarchy information.

    Notes:
        - SCD Type 1: Returns current data (no versioning)
        - Historical versions are stored in ArticleHistory table
        - Hierarchy info is optional (can be omitted for performance)
    """

    id: int = Field(
        description="Article ID (surrogate key)",
        examples=[1]
    )

    user_id: int = Field(
        description="Owner user ID",
        examples=[123]
    )

    user_name: Optional[str] = Field(
        default=None,
        description="Owner user name (first_name from User model, populated in admin endpoints)",
        examples=["Илья", "Радомир", None]
    )

    parent_id: Optional[int] = Field(
        description="Parent article ID (NULL for root)",
        examples=[1, None]
    )

    name: str = Field(
        description="Article display name",
        examples=["Food"]
    )

    type: str = Field(
        description="Article type: income or expense",
        examples=["expense"]
    )

    code: Optional[str] = Field(
        default=None,
        description="Business code for external integrations",
        examples=["ART-1", "ART-2", None]
    )

    is_active: bool = Field(
        description="Active status flag (True = visible in UI, False = archived)",
        examples=[True, False]
    )

    # Audit fields
    created_at: datetime = Field(
        description="Record creation timestamp",
        examples=["2025-10-13T12:00:00Z"]
    )

    updated_at: datetime = Field(
        description="Record last update timestamp",
        examples=["2025-10-13T12:00:00Z"]
    )

    # Usage statistics (populated from t_article_usage_stats)
    usage_count: int = Field(
        default=0,
        description="Number of times this category is used in transactions (from t_article_usage_stats)",
        examples=[0, 42, 150]
    )

    # Optional hierarchy info (populated when include_hierarchy=true)
    hierarchy: Optional[ArticleHierarchyInfo] = Field(
        default=None,
        description="Hierarchy information (optional)"
    )

    # Financial center links (populated from t_article_financial_center)
    financial_center_ids: list[int] = Field(
        default_factory=list,
        description="List of financial center IDs this article is linked to. "
                    "Empty list = available for all financial centers.",
        examples=[[1, 2], []]
    )

    # Leaf status (calculated from hierarchy)
    is_leaf: bool = Field(
        default=True,
        description="True if article has no children (leaf node in hierarchy). "
                    "Only leaf articles can have financial center restrictions.",
        examples=[True, False]
    )

    model_config = {
        "from_attributes": True,  # Allow ORM mode for SQLModel compatibility
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": 123,
                "parent_id": None,
                "name": "Food",
                "type": "expense",
                "is_active": True,
                "created_at": "2025-10-13T12:00:00Z",
                "updated_at": "2025-10-13T12:00:00Z",
                "hierarchy": {
                    "has_children": True,
                    "depth": 0,
                    "path": [1]
                }
            }
        }
    }


class ArticleListResponse(BaseModel):
    """
    Schema for paginated article list responses.

    Returns list of articles with optional hierarchy information.
    """

    articles: list[ArticleResponse] = Field(
        description="List of articles",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of articles (before pagination)",
        examples=[10]
    )

    limit: int = Field(
        description="Maximum number of articles returned",
        examples=[100]
    )

    offset: int = Field(
        description="Number of articles skipped",
        examples=[0]
    )
