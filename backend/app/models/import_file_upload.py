"""
Import File Upload Model

Stores metadata of uploaded CSV files for multi-bank import.
File content is NOT stored (metadata only, files deleted after parsing).

Pattern: Temporary metadata table
Table: t_import_file_upload
"""

from datetime import datetime

from sqlalchemy import JSON, BigInteger, Column, Text
from sqlmodel import Field, SQLModel


class ImportFileUpload(SQLModel, table=True):
    """
    Import file upload metadata.

    Stores CSV file metadata after upload and analysis.
    File content is NOT persisted (only metadata).

    Table: t_import_file_upload
    Pattern: Temporary metadata (files deleted after parsing)

    Workflow:
    1. User uploads CSV → create record with status='uploaded'
    2. Backend analyzes CSV → update status='analyzed', populate csv_headers/csv_sample_rows
    3. User maps columns → save mapping_id
    4. Backend parses CSV → update status='parsed', insert to staging

    Examples:
        >>> upload = ImportFileUpload(
        ...     user_id=123,
        ...     bank_provider_id=1,
        ...     file_name="tinkoff_2025_11.csv",
        ...     file_size=52480,
        ...     mime_type="text/csv",
        ...     status="uploaded"
        ... )
    """

    __tablename__ = "t_import_file_upload"

    # Primary key
    id: int | None = Field(
        default=None,
        sa_column=Column(BigInteger, primary_key=True, autoincrement=True),
        description="Auto-incrementing primary key (BIGSERIAL)"
    )

    # Owner foreign keys
    user_id: int = Field(
        nullable=False,
        foreign_key="t_d_user.id",
        index=True,
        description="User who uploaded this file"
    )

    bank_provider_id: int = Field(
        nullable=False,
        foreign_key="t_d_bank_provider.id",
        description="Bank provider selected by user"
    )

    # File metadata
    file_name: str = Field(
        max_length=255,
        nullable=False,
        description="Original filename (e.g., 'tinkoff_2025_11.csv')"
    )

    file_size: int | None = Field(
        default=None,
        description="File size in bytes"
    )

    mime_type: str | None = Field(
        default=None,
        max_length=100,
        description="MIME type (e.g., 'text/csv')"
    )

    temp_file_path: str | None = Field(
        default=None,
        max_length=500,
        description="Temporary file path in /tmp (deleted after parsing)"
    )

    # CSV structure metadata (populated after analysis)
    csv_headers: dict | None = Field(
        default=None,
        sa_column=Column(JSON),
        description="CSV headers array (e.g., ['Дата', 'Сумма', ...])"
    )

    csv_sample_rows: list | None = Field(
        default=None,
        sa_column=Column(JSON),
        description="Sample rows (first 5 rows) for UI preview"
    )

    total_rows: int | None = Field(
        default=None,
        description="Total number of rows in CSV"
    )

    csv_delimiter: str | None = Field(
        default=None,
        max_length=5,
        description="Detected CSV delimiter (e.g., ';' or ',')"
    )

    csv_encoding: str | None = Field(
        default=None,
        max_length=20,
        description="Detected file encoding (e.g., 'utf-8', 'windows-1251')"
    )

    # Processing status
    status: str = Field(
        default="uploaded",
        max_length=20,
        nullable=False,
        index=True,
        description="Status: uploaded → analyzed → parsed"
    )

    error_message: str | None = Field(
        default=None,
        sa_column=Column(Text),
        description="Error message if analysis/parsing failed"
    )

    # Column mapping reference
    mapping_id: int | None = Field(
        default=None,
        foreign_key="t_import_column_mapping.id",
        description="Reference to column mapping used for this file"
    )

    # Audit timestamps
    uploaded_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Timestamp when file was uploaded (UTC)"
    )

    analyzed_at: datetime | None = Field(
        default=None,
        description="Timestamp when CSV analysis completed (UTC)"
    )

    parsed_at: datetime | None = Field(
        default=None,
        description="Timestamp when CSV was parsed to staging (UTC)"
    )
