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
        - code: Optional, max 50 characters
        - is_global: Optional, defaults to False

    Notes:
        - user_id is set automatically from current_user
        - Global articles (is_global=True) should only be created by admins
        - Parent article must exist and belong to same user (or be global)
    """

    name: str = Field(
        ...,
        max_length=255,
        min_length=1,
        description="Article display name",
        examples=["Food", "Groceries", "Salary"]
    )

    type: Literal["income", "expense"] = Field(
        ...,
        description="Article type: income or expense",
        examples=["expense"]
    )

    parent_id: Optional[int] = Field(
        default=None,
        description="Parent article ID for hierarchy (NULL for root articles)",
        examples=[1, None]
    )

    code: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Business key for article identification (optional)",
        examples=["FOOD", "SAL_BASE", None]
    )

    is_global: bool = Field(
        default=False,
        description="Global articles are shared across all users (admin only)"
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

    @field_validator("code")
    @classmethod
    def code_validation(cls, v: Optional[str]) -> Optional[str]:
        """
        Validate and normalize article code.

        Rules:
        - Must contain only letters, digits, and underscores
        - Converted to uppercase
        - Leading/trailing whitespace is trimmed
        """
        if not v:
            return None

        trimmed = v.strip()

        if not trimmed:
            return None

        # Check for valid characters (letters, digits, underscores only)
        if not re.match(r'^[a-zA-Z0-9_]+$', trimmed):
            raise ValueError(
                "Article code must contain only letters, digits, and underscores"
            )

        return trimmed.upper()

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
    When updated, creates new SCD Type 2 version with is_current=True.

    Validation Rules:
        - At least one field must be provided
        - Same validation as ArticleCreate for provided fields

    Notes:
        - Update creates NEW version with is_current=True
        - Old version gets is_current=False, valid_to=now()
        - Cannot change user_id (articles belong to creator)
        - Global articles can only be updated by admins
    """

    name: Optional[str] = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Article display name",
        examples=["Updated Food Name"]
    )

    type: Optional[Literal["income", "expense"]] = Field(
        default=None,
        description="Article type: income or expense",
        examples=["expense"]
    )

    parent_id: Optional[int] = Field(
        default=None,
        description="Parent article ID for hierarchy",
        examples=[2]
    )

    code: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Business key for article",
        examples=["FOOD_NEW"]
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

    @field_validator("code")
    @classmethod
    def code_validation(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize article code if provided."""
        if not v:
            return None

        trimmed = v.strip()

        if not trimmed:
            return None

        # Check for valid characters
        if not re.match(r'^[a-zA-Z0-9_]+$', trimmed):
            raise ValueError(
                "Article code must contain only letters, digits, and underscores"
            )

        return trimmed.upper()

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
        - Only current versions (is_current=True) are returned by default
        - Historical versions can be queried via /articles/{id}/history endpoint
        - Hierarchy info is optional (can be omitted for performance)
    """

    id: int = Field(
        description="Article ID (surrogate key)",
        examples=[1]
    )

    user_id: Optional[int] = Field(
        description="Owner user ID (NULL for global articles)",
        examples=[123, None]
    )

    parent_id: Optional[int] = Field(
        description="Parent article ID (NULL for root)",
        examples=[1, None]
    )

    code: Optional[str] = Field(
        description="Business key",
        examples=["FOOD", None]
    )

    name: str = Field(
        description="Article display name",
        examples=["Food"]
    )

    type: str = Field(
        description="Article type: income or expense",
        examples=["expense"]
    )

    is_global: bool = Field(
        description="True if article is shared across all users",
        examples=[False]
    )

    # SCD Type 2 fields
    valid_from: datetime = Field(
        description="Start of validity period",
        examples=["2025-10-13T12:00:00Z"]
    )

    valid_to: datetime = Field(
        description="End of validity period (9999-12-31 for current)",
        examples=["9999-12-31T23:59:59Z"]
    )

    is_current: bool = Field(
        description="True if this is the current version",
        examples=[True]
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

    # Optional hierarchy info (populated when include_hierarchy=true)
    hierarchy: Optional[ArticleHierarchyInfo] = Field(
        default=None,
        description="Hierarchy information (optional)"
    )

    model_config = {
        "from_attributes": True,  # Allow ORM mode for SQLModel compatibility
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": 123,
                "parent_id": None,
                "code": "FOOD",
                "name": "Food",
                "type": "expense",
                "is_global": False,
                "valid_from": "2025-10-13T12:00:00Z",
                "valid_to": "9999-12-31T23:59:59Z",
                "is_current": True,
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
