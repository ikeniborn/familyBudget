"""
ImportTemplate configuration table model for CSV import mapping.

This module defines the ImportTemplate model for storing user-specific CSV import templates.
Each user can save their own templates with column mappings, delimiters, and format preferences.

Key features:
- USER-SPECIFIC (each user has their own templates, filtered by user_id)
- JSONB config field for flexible schema
- Used for CSV import wizard (save/load mapping configurations)
"""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON
from sqlmodel import Column, Field, SQLModel


class ImportTemplate(SQLModel, table=True):
    """
    ImportTemplate configuration table (USER-SPECIFIC).

    Stores user-specific CSV import templates with column mappings and format preferences.
    Each user can save multiple templates for different CSV file formats.

    Table: t_d_import_template
    Pattern: Configuration table (USER-SPECIFIC)

    User Isolation:
        - USER-SPECIFIC: Each user sees only their own templates
        - API MUST filter by user_id: .where(ImportTemplate.user_id == current_user.id)
        - This is the ONLY table in shopping lists feature that is user-specific

    JSONB Config Structure:
        {
            "delimiter": ",",              # CSV delimiter (comma, semicolon, tab)
            "encoding": "utf-8",           # File encoding
            "has_header": true,            # First row is header
            "date_format": "%Y-%m-%d",     # Date format (e.g., "2025-01-10", "10/01/2025")
            "number_format": "decimal",    # Number format (decimal, comma)
            "column_mapping": {            # Column name → field mapping
                "Product": "product_name",
                "Quantity": "quantity",
                "Unit": "unit",
                "Store": "store_id",
                "Category": "product_group_id",
                "Notes": "comment"
            },
            "default_values": {            # Default values for missing fields
                "store_id": 1,
                "is_completed": false
            }
        }

    Attributes:
        id: Surrogate primary key
        user_id: Owner user ID (REQUIRED - templates are user-specific)
        name: Template name (required, max 255 chars, e.g., "Walmart CSV Format")
        description: Optional description or notes
        config: JSONB field with import configuration (delimiter, mappings, formats)
        is_active: Active flag (True = visible in UI, False = archived)
        created_at: Timestamp when template was created (immutable)
        updated_at: Timestamp when template was last updated (auto-updated on changes)

    Examples:
        # Create import template
        >>> template = ImportTemplate(
        ...     user_id=123,
        ...     name="Walmart CSV Format",
        ...     description="Standard format from Walmart shopping list export",
        ...     config={
        ...         "delimiter": ",",
        ...         "encoding": "utf-8",
        ...         "has_header": True,
        ...         "column_mapping": {
        ...             "Product": "product_name",
        ...             "Quantity": "quantity",
        ...             "Store": "store_id"
        ...         }
        ...     }
        ... )

        # Query user's templates (MUST filter by user_id)
        >>> result = await session.execute(
        ...     select(ImportTemplate)
        ...     .where(ImportTemplate.user_id == current_user.id)
        ...     .where(ImportTemplate.is_active == True)
        ... )
        >>> templates = result.scalars().all()

    Notes:
        - USER-SPECIFIC: API MUST filter by user_id
        - config is JSONB (flexible schema, stored as JSON)
        - Template names are unique per user (constraint: user_id + name)
        - Used in CSV import wizard for save/load mapping configurations
    """

    __tablename__ = "t_d_import_template"

    # Primary key
    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Foreign keys
    user_id: int = Field(
        foreign_key="t_d_user.id",
        index=True,
        nullable=False,
        description="Owner user ID (REQUIRED - templates are user-specific)"
    )

    # Business attributes
    name: str = Field(
        nullable=False,
        max_length=255,
        index=True,
        description="Template name (e.g., 'Walmart CSV Format')"
    )
    description: str | None = Field(
        default=None,
        description="Optional description or notes about the template"
    )

    # Configuration (JSONB)
    config: dict[str, Any] = Field(
        sa_column=Column(JSON, nullable=False),
        description="JSONB field with import configuration (delimiter, mappings, formats)"
    )

    # Active status flag
    is_active: bool = Field(
        default=True,
        nullable=False,
        index=True,
        description="Active status flag (True = visible in UI, False = archived)"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record creation timestamp (immutable)"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record last update timestamp (auto-updated on changes)"
    )

    def __repr__(self) -> str:
        """String representation of ImportTemplate model."""
        return (
            f"ImportTemplate(id={self.id}, name='{self.name}', "
            f"user_id={self.user_id}, is_active={self.is_active})"
        )
