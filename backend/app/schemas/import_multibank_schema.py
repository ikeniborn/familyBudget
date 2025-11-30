"""
Multi-Bank Import Schemas

Pydantic schemas for multi-bank import API endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional


class BankProviderResponse(BaseModel):
    """
    Response schema for bank provider.

    Used in GET /api/v1/import/banks endpoint.

    Examples:
        >>> bank = BankProviderResponse(
        ...     id=1,
        ...     code="tinkoff",
        ...     name="Тинькофф Банк",
        ...     active=True
        ... )
    """

    id: int = Field(description="Bank provider ID")
    code: str = Field(description="Bank code (e.g., 'tinkoff', 'alfabank')")
    name: str = Field(description="Bank display name")
    active: bool = Field(description="Whether bank is active for import")


class FileUploadResponse(BaseModel):
    """
    Response schema for file upload.

    Used in POST /api/v1/import/upload endpoint.

    Examples:
        >>> response = FileUploadResponse(
        ...     file_id=123,
        ...     file_name="tinkoff_2025_11.csv",
        ...     bank_provider_id=1,
        ...     status="analyzed"
        ... )
    """

    file_id: int = Field(description="File upload ID")
    file_name: str = Field(description="Original filename")
    bank_provider_id: int = Field(description="Bank provider ID")
    status: str = Field(description="File status (uploaded, analyzed, parsed)")


class AnalyzeResponse(BaseModel):
    """
    Response schema for CSV analysis.

    Used in GET /api/v1/import/files/{file_id}/analyze endpoint.

    Examples:
        >>> response = AnalyzeResponse(
        ...     file_id=123,
        ...     headers=["Дата", "Сумма", "Описание"],
        ...     sample_rows=[{"Дата": "20.11.2025", "Сумма": "-100,00"}],
        ...     total_rows=152,
        ...     delimiter=";",
        ...     encoding="utf-8"
        ... )
    """

    file_id: int = Field(description="File upload ID")
    headers: list[str] = Field(description="CSV column headers")
    sample_rows: list[dict] = Field(description="Sample rows (first 5)")
    total_rows: int = Field(description="Total number of rows in CSV")
    delimiter: str = Field(description="CSV delimiter (; or ,)")
    encoding: str = Field(description="File encoding (utf-8 or windows-1251)")


class MappingResponse(BaseModel):
    """
    Response schema for column mapping.

    Used in GET /api/v1/import/mappings/{bank_provider_id} endpoint.

    Examples:
        >>> response = MappingResponse(
        ...     mapping_id=1,
        ...     bank_provider_id=1,
        ...     mapping={"fact_date": "Дата операции", "amount": "Сумма операции"}
        ... )
    """

    mapping_id: int = Field(description="Mapping ID")
    bank_provider_id: int = Field(description="Bank provider ID")
    mapping: dict = Field(description="Column mapping (budget field → CSV column)")
    transformations: Optional[dict] = Field(
        default=None,
        description="Optional transformations (date format, decimal separator, etc.)"
    )


class MappingSaveRequest(BaseModel):
    """
    Request schema for saving column mapping.

    Used in POST /api/v1/import/mappings endpoint.

    Examples:
        >>> request = MappingSaveRequest(
        ...     bank_provider_id=1,
        ...     mapping={"fact_date": "Date", "amount": "Amount"}
        ... )
    """

    bank_provider_id: int = Field(description="Bank provider ID")
    mapping: dict = Field(description="Column mapping to save")
    transformations: Optional[dict] = Field(
        default=None,
        description="Optional transformations"
    )


class ParseRequest(BaseModel):
    """
    Request schema for parsing CSV file.

    Used in POST /api/v1/import/files/{file_id}/parse endpoint.

    Examples:
        >>> request = ParseRequest(mapping_id=1)
    """

    mapping_id: int = Field(description="Column mapping ID to use for parsing")


class ParseResponse(BaseModel):
    """
    Response schema for parsing result.

    Used in POST /api/v1/import/files/{file_id}/parse endpoint.

    Examples:
        >>> response = ParseResponse(
        ...     success=True,
        ...     total_inserted=152,
        ...     message="Successfully parsed 152 records to staging"
        ... )
    """

    success: bool = Field(description="Whether parsing succeeded")
    total_inserted: int = Field(description="Number of records inserted to staging")
    message: str = Field(description="Success/error message")
