"""
Multi-Bank Import Schemas

Pydantic schemas for multi-bank import API endpoints.
"""

from pydantic import BaseModel, Field


class CreateBankRequest(BaseModel):
    """
    Request schema for creating new bank provider.

    Used in POST /api/v1/import/banks endpoint.
    Any authenticated user can create a bank.

    Examples:
        >>> request = CreateBankRequest(
        ...     code="my_bank",
        ...     name="Мой Банк"
        ... )
    """

    code: str = Field(
        min_length=2,
        max_length=50,
        description="Unique bank code (lowercase, no spaces). E.g., 'my_bank'"
    )
    name: str = Field(
        min_length=2,
        max_length=255,
        description="Bank display name. E.g., 'Мой Банк'"
    )


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
    transformations: dict | None = Field(
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
    transformations: dict | None = Field(
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


class GoogleSheetsUploadRequest(BaseModel):
    """
    Request schema for uploading from Google Sheets URL.

    Used in POST /api/v1/import/google-sheets/upload endpoint.
    Fetches public Google Sheets as CSV and creates ImportFileUpload record.

    Examples:
        >>> request = GoogleSheetsUploadRequest(
        ...     google_sheets_url="https://docs.google.com/spreadsheets/d/1ABC.../edit#gid=0",
        ...     bank_provider_id=1
        ... )
    """

    google_sheets_url: str = Field(
        min_length=10,
        description="Public Google Sheets URL. Must be accessible without authentication.",
        examples=[
            "https://docs.google.com/spreadsheets/d/1ABC123/edit#gid=0",
            "https://docs.google.com/spreadsheets/d/1ABC123/edit",
        ],
    )
    bank_provider_id: int = Field(
        gt=0,
        description="Bank provider ID for column mapping"
    )


class StagingRecordResponse(BaseModel):
    """
    Response schema for staging record.

    Used in GET /api/v1/admin/staging endpoint.

    Examples:
        >>> record = StagingRecordResponse(
        ...     id=1,
        ...     user_id=123,
        ...     file_upload_id=456,
        ...     bank_provider_id=1,
        ...     fact_date="2025-11-18",
        ...     amount_string="-900,00",
        ...     description="Кафе",
        ...     csv_metadata={"category": "Фастфуд"},
        ...     article_id=None,
        ...     financial_center_id=None,
        ...     cost_center_id=None,
        ...     is_selected=False
        ... )
    """

    id: int
    user_id: int
    file_upload_id: int | None
    bank_provider_id: int | None
    fact_date: str
    amount_string: str
    description: str | None
    csv_metadata: dict | None
    budget_description: str | None
    user_comment: str | None = None
    article_id: int | None
    financial_center_id: int | None
    cost_center_id: int | None
    is_selected: bool
    record_type: str = "fact"


class StagingUpdateRequest(BaseModel):
    """
    Request schema for updating staging record fields.

    Used in PATCH /api/v1/admin/staging/{staging_id} endpoint.

    Examples:
        >>> request = StagingUpdateRequest(article_id=5)
        >>> request = StagingUpdateRequest(financial_center_id=3, cost_center_id=7)
    """

    article_id: int | None = None
    financial_center_id: int | None = None
    cost_center_id: int | None = None
    budget_description: str | None = None
    user_comment: str | None = None
    record_type: str | None = None


class BulkUpdateRequest(BaseModel):
    """
    Request schema for bulk updating staging records.

    Used in POST /api/v1/admin/staging/bulk-update endpoint.

    Examples:
        >>> request = BulkUpdateRequest(
        ...     staging_ids=[1, 2, 3],
        ...     article_id=5,
        ...     financial_center_id=3
        ... )
    """

    staging_ids: list[int] = Field(description="List of staging record IDs to update")
    article_id: int | None = None
    financial_center_id: int | None = None
    cost_center_id: int | None = None
    record_type: str | None = None


class ImportExecuteRequest(BaseModel):
    """
    Request schema for executing import from staging to budget facts.

    Used in POST /api/v1/admin/staging/import endpoint.

    Examples:
        >>> request = ImportExecuteRequest(staging_ids=[1, 2, 3, 4, 5])
    """

    staging_ids: list[int] = Field(description="List of staging record IDs to import")


class ImportExecuteResponse(BaseModel):
    """
    Response schema for import execution result.

    Used in POST /api/v1/admin/staging/import endpoint.

    Examples:
        >>> response = ImportExecuteResponse(
        ...     success=True,
        ...     total_imported=5,
        ...     message="Successfully imported 5 transactions"
        ... )
    """

    success: bool
    total_imported: int
    message: str
