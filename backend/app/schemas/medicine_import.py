"""Pydantic schemas for medicine CSV / Google Sheets import (stock + course)."""
from typing import Any

from pydantic import BaseModel, Field


class MedicineAnalyzeRequest(BaseModel):
    file_content: str = Field(..., description="Base64-encoded CSV bytes")


class MedicineAnalyzeResponse(BaseModel):
    delimiter: str
    encoding: str
    has_header: bool
    detected_columns: list[str]
    auto_mapping: dict[str, str | None]   # csv column → field name (or None)
    sample_rows: list[dict[str, Any]]
    total_rows: int
    confidence: float


class MedicinePreviewRequest(BaseModel):
    file_content: str
    delimiter: str
    encoding: str
    has_header: bool
    column_mapping: dict[str, str]         # csv column → field name


class MedicinePreviewResponse(BaseModel):
    is_valid: bool
    valid_rows: int
    invalid_rows: int
    total_rows: int
    preview_rows: list[dict[str, Any]]     # {row_index, data, validation_status, errors, warnings}


class MedicineImportRequest(MedicinePreviewRequest):
    pass


class MedicineImportResponse(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    error_count: int
    total_rows: int
    errors: list[dict[str, Any]] = Field(default_factory=list)


class GoogleSheetsFetchRequest(BaseModel):
    url: str = Field(..., description="Public Google Sheets URL")


class GoogleSheetsFetchResponse(BaseModel):
    file_content: str = Field(..., description="Base64-encoded CSV bytes from the sheet")
