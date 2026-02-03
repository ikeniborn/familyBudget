"""
Pydantic schemas for ImportTemplate endpoints.

This module defines request/response schemas for ImportTemplate CRUD operations.
Import templates store user-specific CSV import configurations.
"""

import re
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class ImportTemplateCreate(BaseModel):
    """
    Schema for creating a new import template.

    Validation Rules:
        - name: Required, max 255 characters
        - config: Required (JSONB dict with import configuration)
        - description: Optional

    Notes:
        - user_id is set automatically from current_user
        - Templates are USER-SPECIFIC (each user has their own)
    """

    name: str = Field(
        ...,
        max_length=255,
        min_length=1,
        description="Template name",
        examples=["Walmart CSV Format", "Costco Format", "Standard CSV"]
    )

    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes",
        examples=["Standard format from Walmart shopping list export", None]
    )

    config: dict[str, Any] = Field(
        ...,
        description="JSONB configuration (delimiter, column mappings, formats)",
        examples=[{
            "delimiter": ",",
            "encoding": "utf-8",
            "has_header": True,
            "date_format": "%Y-%m-%d",
            "number_format": "decimal",
            "column_mapping": {
                "Product": "product_name",
                "Quantity": "quantity",
                "Unit": "unit",
                "Store": "store_id",
                "Category": "product_group_id",
                "Notes": "comment"
            },
            "default_values": {
                "store_id": 1,
                "is_completed": False
            }
        }]
    )

    is_active: bool = Field(
        default=True,
        description="Active status (True = visible in UI, False = archived)",
        examples=[True]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        """
        Validate template name.

        Rules:
        - Cannot be empty or whitespace only
        - Must contain at least one alphanumeric character
        - Leading/trailing whitespace is trimmed
        """
        if not v or not v.strip():
            raise ValueError("Template name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Template name must contain at least one alphanumeric character"
            )

        return trimmed

    @field_validator("config")
    @classmethod
    def config_not_empty(cls, v: dict[str, Any]) -> dict[str, Any]:
        """
        Validate config.

        Rules:
        - Cannot be empty dict
        - Must contain at least 'delimiter' key
        """
        if not v:
            raise ValueError("Config cannot be empty")

        if "delimiter" not in v:
            raise ValueError("Config must contain 'delimiter' key")

        return v


class ImportTemplateUpdate(BaseModel):
    """
    Schema for updating an existing import template.

    All fields are optional (partial update).

    Validation Rules:
        - At least one field should be provided
        - Same validation as ImportTemplateCreate for provided fields

    Notes:
        - Cannot change user_id (templates belong to user)
    """

    name: Optional[str] = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Template name",
        examples=["Updated Walmart CSV Format"]
    )

    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes",
        examples=["Updated description"]
    )

    config: Optional[dict[str, Any]] = Field(
        default=None,
        description="JSONB configuration",
        examples=[{
            "delimiter": ";",
            "encoding": "utf-8"
        }]
    )

    is_active: Optional[bool] = Field(
        default=None,
        description="Active status (True = visible in UI, False = archived)",
        examples=[True, False]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        """Validate template name if provided."""
        if v is None:
            return None

        if not v or not v.strip():
            raise ValueError("Template name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Template name must contain at least one alphanumeric character"
            )

        return trimmed

    @field_validator("config")
    @classmethod
    def config_not_empty(cls, v: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        """Validate config if provided."""
        if v is None:
            return None

        if not v:
            raise ValueError("Config cannot be empty")

        return v


class ImportTemplateResponse(BaseModel):
    """
    Schema for import template responses.

    Includes all import template fields from the database.

    Notes:
        - USER-SPECIFIC: Each user sees only their own templates
        - API must filter by user_id
    """

    id: int = Field(
        description="Import template ID (surrogate key)",
        examples=[1]
    )

    user_id: int = Field(
        description="Owner user ID",
        examples=[123]
    )

    name: str = Field(
        description="Template name",
        examples=["Walmart CSV Format"]
    )

    description: Optional[str] = Field(
        description="Optional description",
        examples=["Standard format from Walmart", None]
    )

    config: dict[str, Any] = Field(
        description="JSONB configuration",
        examples=[{
            "delimiter": ",",
            "encoding": "utf-8",
            "has_header": True,
            "column_mapping": {
                "Product": "product_name",
                "Quantity": "quantity"
            }
        }]
    )

    is_active: bool = Field(
        description="Active status (True = visible in UI, False = archived)",
        examples=[True]
    )

    # Audit fields
    created_at: datetime = Field(
        description="Record creation timestamp",
        examples=["2025-01-10T12:00:00Z"]
    )

    updated_at: datetime = Field(
        description="Record last update timestamp",
        examples=["2025-01-10T12:00:00Z"]
    )

    model_config = {
        "from_attributes": True,  # Allow ORM mode for SQLModel compatibility
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": 123,
                "name": "Walmart CSV Format",
                "description": "Standard format from Walmart shopping list export",
                "config": {
                    "delimiter": ",",
                    "encoding": "utf-8",
                    "has_header": True,
                    "column_mapping": {
                        "Product": "product_name",
                        "Quantity": "quantity",
                        "Store": "store_id"
                    }
                },
                "is_active": True,
                "created_at": "2025-01-10T12:00:00Z",
                "updated_at": "2025-01-10T12:00:00Z"
            }
        }
    }


class ImportTemplateListResponse(BaseModel):
    """
    Schema for paginated import template list responses.

    Returns list of import templates with pagination metadata.
    """

    import_templates: list[ImportTemplateResponse] = Field(
        description="List of import templates",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of import templates (before pagination)",
        examples=[10]
    )

    limit: int = Field(
        description="Maximum number of import templates returned",
        examples=[100]
    )

    offset: int = Field(
        description="Number of import templates skipped",
        examples=[0]
    )
