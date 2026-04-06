"""
Multi-Bank Import API Endpoints

Generic import endpoints for multi-bank CSV import workflow.
Supports Tinkoff, Alfabank, Sberbank, VTB, Raiffeisen.

Endpoints:
- GET /import/banks - List active banks
- POST /import/upload - Upload CSV file (100MB limit)
- POST /import/google-sheets/upload - Upload from Google Sheets URL
- GET /import/files/{file_id}/analyze - Get CSV structure
- GET /import/mappings/{bank_provider_id} - Get saved or default mapping
- POST /import/mappings - Save/update mapping
- POST /import/files/{file_id}/parse - Parse CSV with mapping → staging
"""
import logging
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.bank_provider import BankProvider
from backend.app.models.import_column_mapping import ImportColumnMapping
from backend.app.models.import_file_upload import ImportFileUpload
from backend.app.models.import_staging import ImportStaging
from backend.app.schemas.import_multibank_schema import (
    AnalyzeResponse,
    BankProviderResponse,
    CreateBankRequest,
    FileUploadResponse,
    GoogleSheetsUploadRequest,
    MappingResponse,
    MappingSaveRequest,
    ParseRequest,
    ParseResponse,
)
from backend.app.services.bank_provider_service import BankProviderService
from backend.app.services.csv_analyzer import CSVAnalyzer
from backend.app.services.generic_csv_parser import GenericCSVParser
from backend.app.services.google_sheets_parser import (
    GoogleSheetsError,
    fetch_google_sheets_as_csv,
    parse_google_sheets_url,
)
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
    logger.info("Listing banks for user %s", current_user.id)
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
    logger.info("Creating bank '%s' by user %s", request.code, current_user.id)

    # Normalize code: lowercase, replace spaces with underscores
    normalized_code = request.code.lower().strip().replace(" ", "_")

    try:
        bank = await BankProviderService.create_bank(
            session,
            code=normalized_code,
            name=request.name.strip()
        )
        logger.info("Created bank id=%s, code='%s'", bank.id, bank.code)
        return BankProviderResponse(
            id=bank.id,
            code=bank.code,
            name=bank.name,
            active=bank.active
        )
    except ValueError as e:
        logger.warning("Failed to create bank '%s': %s", normalized_code, e)
        raise HTTPException(400, str(e))


@router.delete("/banks/{bank_id}", status_code=200)
async def delete_bank(
    bank_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Delete bank provider (hard delete with cascade).

    Permanently deletes the bank and all related data:
    - ImportStaging records for this bank
    - ImportFileUpload records for this bank
    - ImportColumnMapping records for all users

    **Parameters:**
    - bank_id: Bank provider ID to delete

    **Returns:**
    - Success message with cascade deletion counts

    **Example:**
    ```
    DELETE /api/v1/import/banks/6
    Response 200: {
        "message": "Bank 'my_bank' deleted successfully",
        "bank_id": 6,
        "cascade_deleted": {
            "staging": 10,
            "uploads": 2,
            "mappings": 1
        }
    }
    ```

    **Errors:**
    - 404: Bank not found
    """
    logger.info("Deleting bank %s by user %s", bank_id, current_user.id)

    try:
        # Get bank name before deletion for response message
        bank = await BankProviderService.get_by_id(session, bank_id)
        if not bank:
            raise HTTPException(404, f"Bank with id={bank_id} not found")

        bank_code = bank.code

        result = await BankProviderService.delete_bank(session, bank_id)

        logger.info(
            "Deleted bank id=%s, code='%s': staging=%s, uploads=%s, mappings=%s",
            bank_id, bank_code, result['deleted_staging'], result['deleted_uploads'], result['deleted_mappings']
        )

        return {
            "message": f"Bank '{bank_code}' deleted successfully",
            "bank_id": bank_id,
            "cascade_deleted": {
                "staging": result["deleted_staging"],
                "uploads": result["deleted_uploads"],
                "mappings": result["deleted_mappings"]
            }
        }
    except ValueError as e:
        logger.warning("Failed to delete bank %s: %s", bank_id, e)
        raise HTTPException(404, str(e))


@router.post("/upload", response_model=FileUploadResponse, status_code=201)
async def upload_file(
    current_user: CurrentUser,
    bank_provider_id: int,
    file: UploadFile = File(...),
    delimiter: str | None = None,
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
    - delimiter: Optional CSV delimiter (';', ',', 'tab'). If not provided, auto-detected.

    **Returns:**
    - file_id, file_name, bank_provider_id, status

    **Example:**
    ```
    POST /api/v1/import/upload?bank_provider_id=1&delimiter=,
    Form Data: file=tinkoff_2025_11.csv
    Response: {
        "file_id": 123,
        "file_name": "tinkoff_2025_11.csv",
        "bank_provider_id": 1,
        "status": "analyzed"
    }
    ```
    """
    # Convert 'tab' to actual tab character
    actual_delimiter = None
    if delimiter:
        if delimiter == 'tab':
            actual_delimiter = '\t'
        else:
            actual_delimiter = delimiter

    logger.info(
        "Uploading file %s for user %s, bank %s, delimiter=%s",
        file.filename, current_user.id, bank_provider_id, actual_delimiter or 'auto'
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
        logger.error("Failed to save temp file %s: %s", temp_file_path, e)
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
        analysis = await CSVAnalyzer.analyze_file(
            content,
            file.filename or "unknown.csv",
            user_delimiter=actual_delimiter
        )
        file_upload.csv_headers = analysis["headers"]
        file_upload.csv_sample_rows = analysis["sample_rows"]
        file_upload.total_rows = analysis["total_rows"]
        file_upload.csv_delimiter = analysis["delimiter"]
        file_upload.csv_encoding = analysis["encoding"]
        file_upload.status = "analyzed"
        file_upload.analyzed_at = datetime.utcnow()
        await session.commit()

        logger.info(
            "Analyzed file %s: %s rows, %s columns",
            file_upload.id, analysis['total_rows'], len(analysis['headers'])
        )

    except Exception as e:
        file_upload.status = "error"
        file_upload.error_message = str(e)
        await session.commit()
        logger.error("Failed to analyze file %s: %s", file_upload.id, e)

        # Clean up temp file on analysis failure
        if temp_file_path.exists():
            try:
                temp_file_path.unlink()
            except Exception as cleanup_error:
                logger.error("Failed to cleanup temp file %s: %s", temp_file_path, cleanup_error)

        raise HTTPException(500, f"Failed to analyze CSV: {str(e)}")

    return FileUploadResponse(
        file_id=file_upload.id,
        file_name=file_upload.file_name,
        bank_provider_id=file_upload.bank_provider_id,
        status=file_upload.status
    )


@router.post("/google-sheets/upload", response_model=FileUploadResponse, status_code=201)
async def upload_from_google_sheets(
    request: GoogleSheetsUploadRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Upload from public Google Sheets URL.

    Fetches the Google Sheets as CSV, saves to temp file, and creates ImportFileUpload record.
    This endpoint returns the same response as /upload, allowing the same workflow for subsequent steps.

    **Requirements:**
    - Google Sheets MUST be public ("Anyone with link → View")
    - URL must be valid Google Sheets URL

    **Workflow:**
    1. Parse Google Sheets URL (extract spreadsheet_id and sheet_gid)
    2. Fetch sheet as CSV via Google's export endpoint
    3. Save CSV to temp file
    4. Create ImportFileUpload record
    5. Analyze CSV structure
    6. Return file_id (same as /upload)

    **Request Body:**
    ```json
    {
        "google_sheets_url": "https://docs.google.com/spreadsheets/d/1ABC.../edit#gid=0",
        "bank_provider_id": 1
    }
    ```

    **Response:** Same as POST /import/upload

    **Example:**
    ```
    POST /api/v1/import/google-sheets/upload
    Body: {"google_sheets_url": "https://docs.google.com/...", "bank_provider_id": 1}
    Response 201: {
        "file_id": 123,
        "file_name": "google_sheets_1ABC123.csv",
        "bank_provider_id": 1,
        "status": "analyzed"
    }
    ```

    **Errors:**
    - 400: Invalid URL or private sheet
    - 404: Bank provider not found
    - 500: Failed to fetch or analyze
    """
    logger.info(
        "Uploading from Google Sheets for user %s, bank %s, URL: %s...",
        current_user.id, request.bank_provider_id, request.google_sheets_url[:50]
    )

    # Validate bank exists
    bank = await BankProviderService.get_by_id(session, request.bank_provider_id)
    if not bank:
        raise HTTPException(404, "Bank provider not found")

    try:
        # Parse Google Sheets URL
        spreadsheet_id, sheet_gid = await parse_google_sheets_url(request.google_sheets_url)

        # Fetch CSV content
        csv_bytes = await fetch_google_sheets_as_csv(spreadsheet_id, sheet_gid)

        logger.info(
            "Fetched Google Sheets: spreadsheet_id=%s, sheet_gid=%s, size=%s bytes",
            spreadsheet_id, sheet_gid or 'default', len(csv_bytes)
        )

    except GoogleSheetsError as e:
        logger.warning("Google Sheets fetch failed for user %s: %s", current_user.id, e)
        raise HTTPException(400, str(e))

    # Save to temp file
    temp_dir = Path("/app/uploads/temp")
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_filename = f"google_sheets_{spreadsheet_id}_{uuid.uuid4().hex[:8]}.csv"
    temp_file_path = temp_dir / temp_filename

    try:
        with open(temp_file_path, "wb") as f:
            f.write(csv_bytes)
    except Exception as e:
        logger.error("Failed to save temp file %s: %s", temp_file_path, e)
        raise HTTPException(500, f"Failed to save file: {str(e)}")

    # Create ImportFileUpload record
    file_upload = ImportFileUpload(
        user_id=current_user.id,
        bank_provider_id=request.bank_provider_id,
        file_name=temp_filename,
        file_size=len(csv_bytes),
        mime_type="text/csv",
        temp_file_path=str(temp_file_path),
        status="uploaded"
    )
    session.add(file_upload)
    await session.commit()
    await session.refresh(file_upload)

    # Analyze CSV structure
    try:
        analysis = await CSVAnalyzer.analyze_file(
            csv_bytes,
            temp_filename,
            user_delimiter=None  # Auto-detect
        )
        file_upload.csv_headers = analysis["headers"]
        file_upload.csv_sample_rows = analysis["sample_rows"]
        file_upload.total_rows = analysis["total_rows"]
        file_upload.csv_delimiter = analysis["delimiter"]
        file_upload.csv_encoding = analysis["encoding"]
        file_upload.status = "analyzed"
        file_upload.analyzed_at = datetime.utcnow()
        await session.commit()

        logger.info(
            "Analyzed Google Sheets file %s: %s rows, %s columns",
            file_upload.id, analysis['total_rows'], len(analysis['headers'])
        )

    except Exception as e:
        file_upload.status = "error"
        file_upload.error_message = str(e)
        await session.commit()
        logger.error("Failed to analyze Google Sheets file %s: %s", file_upload.id, e)

        # Clean up temp file on analysis failure
        if temp_file_path.exists():
            try:
                temp_file_path.unlink()
            except Exception as cleanup_error:
                logger.error("Failed to cleanup temp file %s: %s", temp_file_path, cleanup_error)

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

    NOTE: This endpoint should complete in <1s for most files. If you see
    slow queries here, check CSVAnalyzer performance.

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
    import time
    start_time = time.time()

    logger.info("Analyzing file %s for user %s", file_id, current_user.id)

    file_upload = await session.get(ImportFileUpload, file_id)
    if not file_upload or file_upload.user_id != current_user.id:
        raise HTTPException(404, "File not found")

    if file_upload.status != "analyzed":
        raise HTTPException(400, f"File not analyzed (status: {file_upload.status})")

    elapsed = time.time() - start_time
    if elapsed > 5.0:  # Warn if slower than 5s
        logger.warning(
            "SLOW QUERY: analyze_file took %.2fs for file %s. "
            "This should be <1s. Check database indexes or CSVAnalyzer.",
            elapsed, file_id
        )

    return AnalyzeResponse(
        file_id=file_upload.id,
        headers=file_upload.csv_headers or [],
        sample_rows=file_upload.csv_sample_rows or [],
        total_rows=file_upload.total_rows or 0,
        delimiter=file_upload.csv_delimiter or ";",
        encoding=file_upload.csv_encoding or "utf-8"
    )


@router.get("/files/{file_id}/preview")
async def preview_file(
    file_id: int,
    delimiter: str,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Preview CSV file with specified delimiter.

    Re-parses the uploaded file with the given delimiter and returns
    headers and first 5 sample rows. Used for delimiter selection UI.

    **Parameters:**
    - file_id: File upload ID
    - delimiter: CSV delimiter (';', ',', 'tab')

    **Returns:**
    - headers, sample_rows, delimiter

    **Example:**
    ```
    GET /api/v1/import/files/123/preview?delimiter=,
    Response: {
        "file_id": 123,
        "headers": ["Дата", "Сумма", "Описание"],
        "sample_rows": [{"Дата": "7/4/2025 0:00:00", ...}],
        "delimiter": ","
    }
    ```
    """
    logger.info("Preview file %s with delimiter=%r for user %s", file_id, delimiter, current_user.id)

    file_upload = await session.get(ImportFileUpload, file_id)
    if not file_upload or file_upload.user_id != current_user.id:
        raise HTTPException(404, "File not found")

    # Check temp file exists
    if not file_upload.temp_file_path:
        raise HTTPException(400, "File content not available")

    temp_file_path = Path(file_upload.temp_file_path)
    if not temp_file_path.exists():
        raise HTTPException(404, "Temporary file not found")

    # Convert 'tab' to actual tab character
    actual_delimiter = '\t' if delimiter == 'tab' else delimiter

    # Read and parse file with specified delimiter
    try:
        with open(temp_file_path, "rb") as f:
            content = f.read()

        # Detect encoding
        try:
            text = content.decode('utf-8')
            encoding = 'utf-8'
        except UnicodeDecodeError:
            try:
                text = content.decode('windows-1251')
                encoding = 'windows-1251'
            except UnicodeDecodeError:
                text = content.decode('cp1251')
                encoding = 'cp1251'

        # Parse CSV with specified delimiter
        import csv
        import io
        reader = csv.DictReader(io.StringIO(text), delimiter=actual_delimiter)
        rows = list(reader)

        headers = list(rows[0].keys()) if rows else []
        sample_rows = rows[:5]

        logger.info("Preview: %s columns, %s total rows", len(headers), len(rows))

        return {
            "file_id": file_upload.id,
            "headers": headers,
            "sample_rows": sample_rows,
            "total_rows": len(rows),
            "delimiter": delimiter,
            "encoding": encoding
        }

    except Exception as e:
        logger.error("Failed to preview file %s: %s", file_id, e)
        raise HTTPException(500, f"Failed to preview CSV: {str(e)}")


@router.get("/mappings/{bank_provider_id}", response_model=MappingResponse)
async def get_mapping(
    bank_provider_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Get saved mapping for user+bank (or default if not found).

    Returns saved mapping for this user and bank, or returns 404 with
    default mapping in error response if no saved mapping exists.

    **Parameters:**
    - bank_provider_id: Bank provider ID

    **Returns:**
    - Saved mapping (if exists) or 404 with default_mapping

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
    logger.info("Getting mapping for bank %s, user %s", bank_provider_id, current_user.id)

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
    Save or update mapping (SCD Type 1, per-user per-bank).

    If mapping exists for this (user, bank) → UPDATE in-place
    If mapping doesn't exist → INSERT new record

    Mappings are per-user. Each user has their own mapping which doesn't
    affect other users' mappings.

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
        "Saving mapping for bank %s, user %s", request.bank_provider_id, current_user.id
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
    logger.info("Parsing file %s with mapping %s", file_id, request.mapping_id)

    # Get file upload
    file_upload = await session.get(ImportFileUpload, file_id)
    if not file_upload or file_upload.user_id != current_user.id:
        raise HTTPException(404, "File not found")

    # Get mapping (shared per bank, any user can use)
    mapping_record = await session.get(ImportColumnMapping, request.mapping_id)
    if not mapping_record:
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
        logger.error("Failed to read temp file %s: %s", temp_file_path, e)
        raise HTTPException(500, f"Failed to read temporary file: {str(e)}")

    # Get delimiter, date_format, number_format from mapping transformations (if set)
    # Otherwise fall back to file upload metadata
    transformations = mapping_record.transformations or {}
    delimiter = transformations.get("delimiter") or file_upload.csv_delimiter or ";"
    encoding = file_upload.csv_encoding or "utf-8"
    date_format = transformations.get("date_format")  # None = auto-detect
    number_format = transformations.get("number_format")  # None = auto-detect

    # Convert 'tab' to actual tab character
    if delimiter == 'tab':
        delimiter = '\t'

    logger.info(
        "Parsing with delimiter=%r, encoding=%s, date_format=%s, number_format=%s, transformations=%s",
        delimiter, encoding, date_format or 'auto', number_format or 'auto', mapping_record.transformations or {}
    )

    try:
        staging_records = await GenericCSVParser.parse_with_mapping(
            file_content=file_content,
            mapping=mapping_record.mapping,
            user_id=current_user.id,
            file_upload_id=file_upload.id,
            delimiter=delimiter,
            encoding=encoding,
            date_format=date_format,
            number_format=number_format,
            transformations=mapping_record.transformations
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
            logger.info("Deleted temp file %s after successful parsing", temp_file_path)
        except Exception as cleanup_error:
            logger.error("Failed to cleanup temp file %s: %s", temp_file_path, cleanup_error)

        logger.info(
            "Successfully parsed file %s: %s records inserted to staging",
            file_upload.id, len(staging_records)
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
        logger.error("Failed to parse file %s: %s", file_upload.id, e)
        raise HTTPException(500, f"Failed to parse CSV: {str(e)}")
