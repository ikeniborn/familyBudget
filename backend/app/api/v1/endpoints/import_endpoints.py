"""
Multi-Bank Import API Endpoints

Generic import endpoints for multi-bank CSV import workflow.
Supports Tinkoff, Alfabank, Sberbank, VTB, Raiffeisen.

Endpoints:
- GET /import/banks - List active banks
- POST /import/upload - Upload CSV file (100MB limit)
- GET /import/files/{file_id}/analyze - Get CSV structure
- GET /import/mappings/{bank_provider_id} - Get saved or default mapping
- POST /import/mappings - Save/update mapping
- POST /import/files/{file_id}/parse - Parse CSV with mapping → staging
"""

import logging
import os
import uuid
from datetime import datetime
from pathlib import Path

from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.bank_provider import BankProvider
from backend.app.models.import_column_mapping import ImportColumnMapping
from backend.app.models.import_file_upload import ImportFileUpload
from backend.app.models.import_staging import ImportStaging
from backend.app.schemas.import_multibank_schema import (
    AnalyzeResponse,
    BankProviderResponse,
    BulkUpdateRequest,
    CreateBankRequest,
    FileUploadResponse,
    ImportExecuteRequest,
    ImportExecuteResponse,
    MappingResponse,
    MappingSaveRequest,
    ParseRequest,
    ParseResponse,
    StagingRecordResponse,
    StagingUpdateRequest,
)
from backend.app.services.bank_provider_service import BankProviderService
from backend.app.services.csv_analyzer import CSVAnalyzer
from backend.app.services.generic_csv_parser import GenericCSVParser
from backend.app.services.mapping_service import MappingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["Import Multi-Bank"])


@router.get("/banks", response_model=list[BankProviderResponse])
async def list_banks(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    List all active banks.

    Returns list of supported banks for import dropdown.

    **Returns:**
    - List of active BankProvider records

    **Example:**
    ```
    GET /api/v1/import/banks
    Response: [
        {"id": 1, "code": "tinkoff", "name": "Тинькофф Банк", "active": true},
        {"id": 2, "code": "alfabank", "name": "Альфа-Банк", "active": true}
    ]
    ```
    """
    logger.info(f"Listing banks for user {current_user.id}")
    banks = await BankProviderService.list_active_banks(session)
    return [
        BankProviderResponse(
            id=bank.id,
            code=bank.code,
            name=bank.name,
            active=bank.active
        )
        for bank in banks
    ]


@router.post("/banks", response_model=BankProviderResponse, status_code=201)
async def create_bank(
    request: CreateBankRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Create new bank provider.

    Any authenticated user can create a bank.
    Bank code must be unique.

    **Request Body:**
    ```json
    {
        "code": "my_bank",
        "name": "Мой Банк"
    }
    ```

    **Returns:**
    - Created BankProvider record

    **Example:**
    ```
    POST /api/v1/import/banks
    Body: {"code": "my_bank", "name": "Мой Банк"}
    Response 201: {
        "id": 6,
        "code": "my_bank",
        "name": "Мой Банк",
        "active": true
    }
    ```

    **Errors:**
    - 400: Bank with this code already exists
    """
    logger.info(f"Creating bank '{request.code}' by user {current_user.id}")

    # Normalize code: lowercase, replace spaces with underscores
    normalized_code = request.code.lower().strip().replace(" ", "_")

    try:
        bank = await BankProviderService.create_bank(
            session,
            code=normalized_code,
            name=request.name.strip()
        )
        logger.info(f"Created bank id={bank.id}, code='{bank.code}'")
        return BankProviderResponse(
            id=bank.id,
            code=bank.code,
            name=bank.name,
            active=bank.active
        )
    except ValueError as e:
        logger.warning(f"Failed to create bank '{normalized_code}': {e}")
        raise HTTPException(400, str(e))


@router.post("/upload", response_model=FileUploadResponse, status_code=201)
async def upload_file(
    current_user: CurrentUser,
    bank_provider_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session)
):
    """
    Upload CSV file (100MB limit).

    **Workflow:**
    1. Validate file size (max 100MB)
    2. Create ImportFileUpload record
    3. Analyze CSV structure (encoding, delimiter, headers, sample rows)
    4. Return file_id + metadata

    **Note:** File content is NOT stored (metadata only).

    **Parameters:**
    - bank_provider_id: Bank provider ID (from dropdown)
    - file: CSV file (multipart/form-data)

    **Returns:**
    - file_id, file_name, bank_provider_id, status

    **Example:**
    ```
    POST /api/v1/import/upload?bank_provider_id=1
    Form Data: file=tinkoff_2025_11.csv
    Response: {
        "file_id": 123,
        "file_name": "tinkoff_2025_11.csv",
        "bank_provider_id": 1,
        "status": "analyzed"
    }
    ```
    """
    logger.info(
        f"Uploading file {file.filename} for user {current_user.id}, bank {bank_provider_id}"
    )

    # Validate file size (100MB)
    content = await file.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 100MB)")

    # Validate bank exists
    bank = await BankProviderService.get_by_id(session, bank_provider_id)
    if not bank:
        raise HTTPException(404, "Bank provider not found")

    # Save file to /app/uploads/temp with unique filename
    temp_dir = Path("/app/uploads/temp")
    temp_dir.mkdir(parents=True, exist_ok=True)  # Ensure directory exists
    temp_filename = f"import_{uuid.uuid4().hex}_{file.filename or 'unknown.csv'}"
    temp_file_path = temp_dir / temp_filename

    try:
        with open(temp_file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.error(f"Failed to save temp file {temp_file_path}: {e}")
        raise HTTPException(500, f"Failed to save uploaded file: {str(e)}")

    # Create ImportFileUpload record
    file_upload = ImportFileUpload(
        user_id=current_user.id,
        bank_provider_id=bank_provider_id,
        file_name=file.filename or "unknown.csv",
        file_size=len(content),
        mime_type=file.content_type,
        temp_file_path=str(temp_file_path),
        status="uploaded"
    )
    session.add(file_upload)
    await session.commit()
    await session.refresh(file_upload)

    # Analyze CSV structure
    try:
        analysis = await CSVAnalyzer.analyze_file(content, file.filename or "unknown.csv")
        file_upload.csv_headers = analysis["headers"]
        file_upload.csv_sample_rows = analysis["sample_rows"]
        file_upload.total_rows = analysis["total_rows"]
        file_upload.csv_delimiter = analysis["delimiter"]
        file_upload.csv_encoding = analysis["encoding"]
        file_upload.status = "analyzed"
        file_upload.analyzed_at = datetime.utcnow()
        await session.commit()

        logger.info(
            f"Analyzed file {file_upload.id}: {analysis['total_rows']} rows, "
            f"{len(analysis['headers'])} columns"
        )

    except Exception as e:
        file_upload.status = "error"
        file_upload.error_message = str(e)
        await session.commit()
        logger.error(f"Failed to analyze file {file_upload.id}: {e}")

        # Clean up temp file on analysis failure
        if temp_file_path.exists():
            try:
                temp_file_path.unlink()
            except Exception as cleanup_error:
                logger.error(f"Failed to cleanup temp file {temp_file_path}: {cleanup_error}")

        raise HTTPException(500, f"Failed to analyze CSV: {str(e)}")

    return FileUploadResponse(
        file_id=file_upload.id,
        file_name=file_upload.file_name,
        bank_provider_id=file_upload.bank_provider_id,
        status=file_upload.status
    )


@router.get("/files/{file_id}/analyze", response_model=AnalyzeResponse)
async def analyze_file(
    file_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Get CSV structure (headers, sample rows).

    Returns CSV analysis results from file upload metadata.

    **Parameters:**
    - file_id: File upload ID

    **Returns:**
    - headers, sample_rows, total_rows, delimiter, encoding

    **Example:**
    ```
    GET /api/v1/import/files/123/analyze
    Response: {
        "file_id": 123,
        "headers": ["Дата операции", "Сумма операции", "Описание"],
        "sample_rows": [{"Дата операции": "20.11.2025", ...}],
        "total_rows": 152,
        "delimiter": ";",
        "encoding": "utf-8"
    }
    ```
    """
    logger.info(f"Analyzing file {file_id} for user {current_user.id}")

    file_upload = await session.get(ImportFileUpload, file_id)
    if not file_upload or file_upload.user_id != current_user.id:
        raise HTTPException(404, "File not found")

    if file_upload.status != "analyzed":
        raise HTTPException(400, f"File not analyzed (status: {file_upload.status})")

    return AnalyzeResponse(
        file_id=file_upload.id,
        headers=file_upload.csv_headers or [],
        sample_rows=file_upload.csv_sample_rows or [],
        total_rows=file_upload.total_rows or 0,
        delimiter=file_upload.csv_delimiter or ";",
        encoding=file_upload.csv_encoding or "utf-8"
    )


@router.get("/mappings/{bank_provider_id}", response_model=MappingResponse)
async def get_mapping(
    bank_provider_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Get saved mapping for bank (or default).

    Returns user's saved mapping if exists, otherwise returns 404 with default mapping.

    **Parameters:**
    - bank_provider_id: Bank provider ID

    **Returns:**
    - mapping_id, bank_provider_id, mapping, transformations

    **Example (saved mapping exists):**
    ```
    GET /api/v1/import/mappings/1
    Response 200: {
        "mapping_id": 1,
        "bank_provider_id": 1,
        "mapping": {"fact_date": "Date", "amount": "Amount"},
        "transformations": null
    }
    ```

    **Example (no saved mapping):**
    ```
    GET /api/v1/import/mappings/1
    Response 404: {
        "detail": "No saved mapping found",
        "default_mapping": {"fact_date": "Дата операции", "amount": "Сумма операции"}
    }
    ```
    """
    logger.info(f"Getting mapping for bank {bank_provider_id}, user {current_user.id}")

    mapping = await MappingService.get_mapping(session, bank_provider_id, current_user.id)

    if mapping:
        return MappingResponse(
            mapping_id=mapping.id,
            bank_provider_id=mapping.bank_provider_id,
            mapping=mapping.mapping,
            transformations=mapping.transformations
        )
    else:
        # Return default mapping in error response
        bank = await session.get(BankProvider, bank_provider_id)
        if not bank:
            raise HTTPException(404, "Bank not found")

        default_mapping = MappingService.get_default_mapping(bank.code)
        raise HTTPException(
            404,
            detail={
                "message": "No saved mapping found",
                "default_mapping": default_mapping
            }
        )


@router.post("/mappings", response_model=MappingResponse)
async def save_mapping(
    request: MappingSaveRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Save or update mapping (SCD Type 1).

    If mapping exists for this bank+user → UPDATE in-place.
    If mapping doesn't exist → INSERT new record.

    **Request Body:**
    ```json
    {
        "bank_provider_id": 1,
        "mapping": {
            "fact_date": "Date",
            "amount": "Amount",
            "description": "Description"
        },
        "transformations": null
    }
    ```

    **Returns:**
    - mapping_id, bank_provider_id, mapping, transformations

    **Example:**
    ```
    POST /api/v1/import/mappings
    Response 200: {
        "mapping_id": 1,
        "bank_provider_id": 1,
        "mapping": {"fact_date": "Date", "amount": "Amount"},
        "transformations": null
    }
    ```
    """
    logger.info(
        f"Saving mapping for bank {request.bank_provider_id}, user {current_user.id}"
    )

    # Validate bank exists
    bank = await BankProviderService.get_by_id(session, request.bank_provider_id)
    if not bank:
        raise HTTPException(404, "Bank provider not found")

    # Validate mapping has required fields
    if "fact_date" not in request.mapping or "amount" not in request.mapping:
        raise HTTPException(400, "Mapping must include 'fact_date' and 'amount' fields")

    mapping = await MappingService.save_mapping(
        session,
        request.bank_provider_id,
        current_user.id,
        request.mapping,
        request.transformations
    )

    return MappingResponse(
        mapping_id=mapping.id,
        bank_provider_id=mapping.bank_provider_id,
        mapping=mapping.mapping,
        transformations=mapping.transformations
    )


@router.post("/files/{file_id}/parse", response_model=ParseResponse)
async def parse_file(
    file_id: int,
    request: ParseRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Parse CSV with mapping → insert to staging.

    **IMPORTANT:** This endpoint requires file content to be re-uploaded or stored.
    Current implementation assumes file content is available (TODO: implement temp storage).

    **Workflow:**
    1. Get file upload metadata
    2. Get column mapping
    3. Re-read file content (TODO: implement)
    4. Parse CSV with mapping
    5. Insert to ImportStaging
    6. Update file status to "parsed"

    **Parameters:**
    - file_id: File upload ID
    - request.mapping_id: Column mapping ID to use

    **Returns:**
    - success, total_inserted, message

    **Example:**
    ```
    POST /api/v1/import/files/123/parse
    Body: {"mapping_id": 1}
    Response 200: {
        "success": true,
        "total_inserted": 152,
        "message": "Successfully parsed 152 records to staging"
    }
    ```

    **TODO:**
    - Implement temp file storage (currently file content not persisted)
    - Add error handling for parsing failures
    """
    logger.info(f"Parsing file {file_id} with mapping {request.mapping_id}")

    # Get file upload
    file_upload = await session.get(ImportFileUpload, file_id)
    if not file_upload or file_upload.user_id != current_user.id:
        raise HTTPException(404, "File not found")

    # Get mapping
    mapping_record = await session.get(ImportColumnMapping, request.mapping_id)
    if not mapping_record or mapping_record.user_id != current_user.id:
        raise HTTPException(404, "Mapping not found")

    # Check if temp file exists
    if not file_upload.temp_file_path:
        raise HTTPException(400, "File content not available (temp file path not set)")

    temp_file_path = Path(file_upload.temp_file_path)
    if not temp_file_path.exists():
        raise HTTPException(404, "Temporary file not found (may have been deleted)")

    # Read file content from temp storage
    try:
        with open(temp_file_path, "rb") as f:
            file_content = f.read()
    except Exception as e:
        logger.error(f"Failed to read temp file {temp_file_path}: {e}")
        raise HTTPException(500, f"Failed to read temporary file: {str(e)}")

    # Parse CSV with mapping (use stored delimiter/encoding from analysis)
    delimiter = file_upload.csv_delimiter or ";"
    encoding = file_upload.csv_encoding or "utf-8"

    try:
        staging_records = await GenericCSVParser.parse_with_mapping(
            file_content=file_content,
            mapping=mapping_record.mapping,
            user_id=current_user.id,
            file_upload_id=file_upload.id,
            delimiter=delimiter,
            encoding=encoding
        )

        # Insert records to staging
        for record_data in staging_records:
            # Add bank_provider_id from file_upload
            record_data['bank_provider_id'] = file_upload.bank_provider_id
            staging = ImportStaging(**record_data)
            session.add(staging)

        await session.commit()

        # Update file upload status
        file_upload.status = "parsed"
        file_upload.parsed_at = datetime.utcnow()
        file_upload.mapping_id = request.mapping_id
        await session.commit()

        # Clean up temp file after successful parsing
        try:
            temp_file_path.unlink()
            logger.info(f"Deleted temp file {temp_file_path} after successful parsing")
        except Exception as cleanup_error:
            logger.error(f"Failed to cleanup temp file {temp_file_path}: {cleanup_error}")

        logger.info(
            f"Successfully parsed file {file_upload.id}: {len(staging_records)} records inserted to staging"
        )

        return ParseResponse(
            success=True,
            total_inserted=len(staging_records),
            message=f"Successfully parsed {len(staging_records)} records to staging"
        )

    except Exception as e:
        file_upload.status = "error"
        file_upload.error_message = f"Parsing failed: {str(e)}"
        await session.commit()
        logger.error(f"Failed to parse file {file_upload.id}: {e}")
        raise HTTPException(500, f"Failed to parse CSV: {str(e)}")
