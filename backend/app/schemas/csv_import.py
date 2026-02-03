"""
CSV Import Schemas

Pydantic models for CSV import API endpoints
"""

from typing import Any, Optional

from pydantic import BaseModel, Field

from backend.app.schemas.product_group import ProductGroupResponse
from backend.app.schemas.store import StoreResponse


class CSVAnalyzeRequest(BaseModel):
    """Request to analyze CSV file."""

    file_content: str = Field(description="Base64 encoded CSV file content")

    class Config:
        json_schema_extra = {
            "example": {
                "file_content": "TWFnYXppbjtHcnVwcGU7VG92YXI=...",
            }
        }


class CSVAnalyzeResponse(BaseModel):
    """Response from CSV analyze endpoint."""

    # Detection results
    delimiter: str = Field(description="Detected delimiter")
    encoding: str = Field(description="Detected encoding")
    has_header: bool = Field(description="Whether first row is header")
    date_format: Optional[str] = Field(None, description="Detected date format")
    number_format: Optional[str] = Field(None, description="Detected number format")
    decimal_separator: str = Field(description="Decimal separator")
    thousands_separator: str = Field(description="Thousands separator")

    # Columns
    detected_columns: list[str] = Field(description="Detected column names")
    auto_mapping: dict[str, Optional[str]] = Field(
        description="Auto-mapped columns (CSV column → field name)"
    )
    mapping_suggestions: dict[str, list[tuple[str, float]]] = Field(
        description="Mapping suggestions with confidence"
    )

    # Sample data
    sample_rows: list[dict[str, Any]] = Field(description="Sample rows (max 10)")
    total_rows: int = Field(description="Total rows in file")

    # Quality
    confidence: float = Field(description="Detection confidence (0.0 to 1.0)")

    class Config:
        json_schema_extra = {
            "example": {
                "delimiter": ";",
                "encoding": "utf-8",
                "has_header": True,
                "date_format": "DD.MM.YYYY",
                "number_format": "1,234.56",
                "decimal_separator": ".",
                "thousands_separator": ",",
                "detected_columns": ["Магазин", "Группа", "Товар"],
                "auto_mapping": {
                    "Магазин": "store",
                    "Группа": "product_group",
                    "Товар": "product_name",
                },
                "mapping_suggestions": {
                    "Магазин": [("store", 1.0)],
                    "Группа": [("product_group", 1.0)],
                },
                "sample_rows": [
                    {"Магазин": "Пятёрочка", "Группа": "Молочные", "Товар": "Молоко"}
                ],
                "total_rows": 15,
                "confidence": 1.0,
            }
        }


class CSVImportRequest(BaseModel):
    """Request to execute CSV import."""

    # File data (base64 encoded)
    file_content: str = Field(description="Base64 encoded CSV file content")

    # Detected parameters (from analyze)
    delimiter: str = Field(description="CSV delimiter")
    encoding: str = Field(description="File encoding")
    has_header: bool = Field(description="Whether first row is header")

    # Column mapping
    column_mapping: dict[str, str] = Field(
        description="Column mapping (CSV column → field name)"
    )

    # Shopping list ID
    shopping_list_id: int = Field(description="Target shopping list ID")

    # Optional: behavior flags
    skip_duplicates: bool = Field(
        default=False, description="Skip duplicate products"
    )
    skip_invalid: bool = Field(
        default=False, description="Skip rows with validation errors"
    )
    create_missing_references: bool = Field(
        default=False, description="Auto-create missing stores and product groups"
    )
    aggregate_duplicates: bool = Field(
        default=False,
        description="Aggregate duplicates: sum quantity, merge comments",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "file_content": "TWFnYXppbjtHcnVwcGU7VG92YXI=...",
                "delimiter": ";",
                "encoding": "utf-8",
                "has_header": True,
                "column_mapping": {
                    "Магазин": "store",
                    "Группа": "product_group",
                    "Товар": "product_name",
                    "Кол-во": "quantity",
                },
                "shopping_list_id": 1,
                "skip_duplicates": False,
                "skip_invalid": False,
                "create_missing_references": False,
            }
        }


class CSVImportResponse(BaseModel):
    """Response from CSV import execution."""

    success: bool = Field(description="Whether import was successful")
    imported_count: int = Field(description="Number of rows imported")
    skipped_count: int = Field(description="Number of rows skipped")
    error_count: int = Field(description="Number of rows with errors")
    total_rows: int = Field(description="Total rows processed")

    # Detailed results
    errors: list[dict[str, Any]] = Field(default_factory=list, description="Errors")
    warnings: list[dict[str, Any]] = Field(default_factory=list, description="Warnings")

    # ✅ NEW: Metadata about created references
    created_stores: list[StoreResponse] = Field(
        default_factory=list,
        description="Stores created during import (if create_missing_references=true)"
    )
    created_product_groups: list[ProductGroupResponse] = Field(
        default_factory=list,
        description="Product groups created during import (if create_missing_references=true)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "imported_count": 14,
                "skipped_count": 1,
                "error_count": 0,
                "total_rows": 15,
                "errors": [],
                "warnings": [
                    {
                        "row_index": 5,
                        "field": "product_name",
                        "message": "Duplicate product",
                    }
                ],
            }
        }


class CSVPreviewRequest(BaseModel):
    """Request for CSV validation preview."""

    # File data (base64 encoded)
    file_content: str = Field(description="Base64 encoded CSV file content")

    # Detected parameters
    delimiter: str = Field(description="CSV delimiter")
    encoding: str = Field(description="File encoding")
    has_header: bool = Field(description="Whether first row is header")

    # Column mapping
    column_mapping: dict[str, str] = Field(
        description="Column mapping (CSV column → field name)"
    )

    # Optional: behavior flags for preview calculation
    create_missing_references: bool = Field(
        default=False,
        description="If true, reference errors won't count as invalid rows",
    )
    aggregate_duplicates: bool = Field(
        default=False,
        description="If true, duplicates will be aggregated before validation",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "file_content": "TWFnYXppbjtHcnVwcGU7VG92YXI=...",
                "delimiter": ";",
                "encoding": "utf-8",
                "has_header": True,
                "column_mapping": {
                    "Магазин": "store",
                    "Группа": "product_group",
                    "Товар": "product_name",
                },
                "create_missing_references": False,
                "aggregate_duplicates": False,
            }
        }


class CSVPreviewResponse(BaseModel):
    """Response with validation preview."""

    is_valid: bool = Field(description="Whether all rows are valid")
    valid_rows: int = Field(description="Number of valid rows")
    invalid_rows: int = Field(description="Number of invalid rows")
    total_rows: int = Field(description="Total rows")

    # Errors and warnings
    errors: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[dict[str, Any]] = Field(default_factory=list)

    # Preview rows (with validation status)
    preview_rows: list[dict[str, Any]] = Field(description="Preview rows (max 20)")

    class Config:
        json_schema_extra = {
            "example": {
                "is_valid": False,
                "valid_rows": 14,
                "invalid_rows": 1,
                "total_rows": 15,
                "errors": [
                    {
                        "row_index": 3,
                        "field": "store",
                        "message": "Store 'Unknown' not found",
                    }
                ],
                "warnings": [],
                "preview_rows": [
                    {
                        "row_index": 0,
                        "data": {"store": "Пятёрочка", "product_name": "Молоко"},
                        "validation_status": "valid",
                    }
                ],
            }
        }
