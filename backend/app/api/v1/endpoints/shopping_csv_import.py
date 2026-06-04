"""
Shopping List CSV Import API Endpoints

Endpoints:
- POST /api/v1/shopping-lists/import/analyze - Analyze CSV file
- POST /api/v1/shopping-lists/import/preview - Validate and preview
- POST /api/v1/shopping-lists/import/execute - Execute import
"""

import base64

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser
from backend.app.db.session import get_session
from backend.app.models.shopping_list_item import ShoppingListItem
from backend.app.schemas.csv_import import (
    CSVAnalyzeRequest,
    CSVAnalyzeResponse,
    CSVImportRequest,
    CSVImportResponse,
    CSVPreviewRequest,
    CSVPreviewResponse,
)
from backend.app.services.csv_column_matcher import (
    auto_map_columns,
    get_mapping_suggestions,
    validate_mapping,
)
from backend.app.services.csv_detector import detect_csv_format
from backend.app.services.csv_security import sanitize_csv_row
from backend.app.services.csv_validator import (
    aggregate_duplicate_rows,
    validate_csv_rows,
)

router = APIRouter(prefix="/shopping-lists/import", tags=["Shopping CSV Import"])


@router.post("/analyze", response_model=CSVAnalyzeResponse)
async def analyze_csv(
    request: CSVAnalyzeRequest,
    current_user: CurrentUser,
) -> CSVAnalyzeResponse:
    """
    Analyze CSV file and auto-detect format.

    Steps:
    1. Decode base64 file content
    2. Auto-detect delimiter, encoding, date/number formats
    3. Auto-map columns to expected fields
    4. Return suggestions and sample rows

    Args:
        request: CSVAnalyzeRequest with base64 encoded file content
        current_user: Current authenticated user

    Returns:
        CSVAnalyzeResponse with detection results

    Raises:
        HTTPException: If file is invalid or too large
    """
    try:
        # Decode base64
        file_bytes = base64.b64decode(request.file_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 encoding: {str(e)}",
        )

    # Check file size (max 5MB)
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 5MB)",
        )

    # Auto-detect format
    detection = detect_csv_format(file_bytes, max_sample_rows=10)

    if detection.confidence < 0.5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to detect CSV format (low confidence)",
        )

    # Auto-map columns
    auto_mapping = auto_map_columns(detection.detected_columns)

    # Get suggestions with confidence scores
    mapping_suggestions = get_mapping_suggestions(detection.detected_columns)

    # Build response
    return CSVAnalyzeResponse(
        delimiter=detection.delimiter,
        encoding=detection.encoding,
        has_header=detection.has_header,
        date_format=detection.date_format,
        number_format=detection.number_format,
        decimal_separator=detection.decimal_separator,
        thousands_separator=detection.thousands_separator,
        detected_columns=detection.detected_columns,
        auto_mapping=auto_mapping,
        mapping_suggestions=mapping_suggestions,
        sample_rows=detection.sample_rows,
        total_rows=detection.total_rows - 1 if detection.has_header else detection.total_rows,
        confidence=detection.confidence,
    )


@router.post("/preview", response_model=CSVPreviewResponse)
async def preview_csv_import(
    request: CSVPreviewRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> CSVPreviewResponse:
    """
    Validate CSV data and preview import results.

    Steps:
    1. Parse CSV with provided parameters
    2. Apply column mapping
    3. Validate all rows (required fields, references, duplicates)
    4. Return preview with validation status

    Args:
        request: Preview request with file content and mapping
        current_user: Current authenticated user
        session: Database session

    Returns:
        CSVPreviewResponse with validation results

    Raises:
        HTTPException: If parsing fails
    """
    import csv
    from io import StringIO

    try:
        # Decode base64
        file_bytes = base64.b64decode(request.file_content)
        text = file_bytes.decode(request.encoding)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decode file: {str(e)}",
        )

    # Parse CSV
    try:
        reader = csv.DictReader(
            StringIO(text),
            delimiter=request.delimiter,
        )
        rows = list(reader)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}",
        )

    # Apply column mapping and sanitize
    mapped_rows = []
    for idx, row in enumerate(rows):
        if not request.has_header and idx == 0:
            continue  # Skip header if not expected

        mapped_row = {}
        for csv_col, field_name in request.column_mapping.items():
            if csv_col in row and field_name:
                value = row[csv_col]
                # Sanitize for CSV injection
                sanitized_value = sanitize_csv_row({csv_col: value})[csv_col]
                mapped_row[field_name] = sanitized_value

        if mapped_row:  # Only add non-empty rows
            mapped_rows.append(mapped_row)

    # Aggregate duplicates if requested (before validation)
    if request.aggregate_duplicates:
        mapped_rows = aggregate_duplicate_rows(mapped_rows)

    # Validate column mapping
    is_valid, missing_required, mapped_fields = validate_mapping(request.column_mapping)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required fields: {', '.join(missing_required)}",
        )

    # Validate rows
    validation_result = await validate_csv_rows(session, mapped_rows)

    # Filter reference errors if create_missing_references is enabled
    # These are not real errors since references will be created during import
    filtered_errors = validation_result.errors
    if request.create_missing_references:
        filtered_errors = [e for e in validation_result.errors if e.error_type != "reference"]

    # Recalculate valid/invalid counts based on filtered errors
    valid_rows = 0
    invalid_rows = 0
    for idx in range(len(mapped_rows)):
        row_has_error = any(e.row_index == idx for e in filtered_errors)
        if row_has_error:
            invalid_rows += 1
        else:
            valid_rows += 1

    # Build preview rows (ALL rows - filtering/pagination handled on frontend)
    preview_rows = []
    for idx, row in enumerate(mapped_rows):
        # Find errors for this row (filtered)
        row_errors = [
            e.to_dict()
            for e in filtered_errors
            if e.row_index == idx
        ]
        row_warnings = [
            w.to_dict()
            for w in validation_result.warnings
            if w.row_index == idx
        ]

        validation_status = "valid"
        if row_errors:
            validation_status = "error"
        elif row_warnings:
            validation_status = "warning"

        preview_rows.append({
            "row_index": idx,
            "data": row,
            "validation_status": validation_status,
            "errors": row_errors,
            "warnings": row_warnings,
        })

    return CSVPreviewResponse(
        is_valid=len(filtered_errors) == 0,
        valid_rows=valid_rows,
        invalid_rows=invalid_rows,
        total_rows=len(mapped_rows),
        errors=[e.to_dict() for e in filtered_errors],
        warnings=[w.to_dict() for w in validation_result.warnings],
        preview_rows=preview_rows,
    )


@router.post("/execute", response_model=CSVImportResponse)
async def execute_csv_import(
    request: CSVImportRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> CSVImportResponse:
    """
    Execute CSV import and create shopping list items.

    Steps:
    1. Parse CSV
    2. Apply column mapping and sanitize
    3. Validate rows
    4. Create shopping list items
    5. Handle duplicates and errors

    Args:
        request: Import request with file, mapping, and options
        current_user: Current authenticated user
        session: Database session

    Returns:
        CSVImportResponse with import results

    Raises:
        HTTPException: If import fails
    """
    import csv
    from io import StringIO

    try:
        # Decode base64
        file_bytes = base64.b64decode(request.file_content)
        text = file_bytes.decode(request.encoding)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decode file: {str(e)}",
        )

    # Parse CSV
    try:
        reader = csv.DictReader(
            StringIO(text),
            delimiter=request.delimiter,
        )
        rows = list(reader)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {str(e)}",
        )

    # Apply column mapping and sanitize
    mapped_rows = []
    for idx, row in enumerate(rows):
        if not request.has_header and idx == 0:
            continue

        mapped_row = {}
        for csv_col, field_name in request.column_mapping.items():
            if csv_col in row and field_name:
                value = row[csv_col]
                sanitized_value = sanitize_csv_row({csv_col: value})[csv_col]
                mapped_row[field_name] = sanitized_value

        if mapped_row:
            mapped_rows.append(mapped_row)

    # Aggregate duplicates if requested (before validation)
    if request.aggregate_duplicates:
        mapped_rows = aggregate_duplicate_rows(mapped_rows)

    # Validate rows
    validation_result = await validate_csv_rows(session, mapped_rows)

    # Import results
    imported_count = 0
    skipped_count = 0
    error_count = 0
    errors = []
    warnings = []

    # Get stores and product groups cache from validation
    from backend.app.services.csv_validator import (
        get_or_create_product_group,
        get_or_create_store,
        validate_product_group_reference,
        validate_store_reference,
    )
    stores_cache = {}
    product_groups_cache = {}

    # ✅ NEW: Track created references for response metadata
    created_stores_dict = {}  # name.lower() → Store object
    created_product_groups_dict = {}  # name.lower() → ProductGroup object

    # Import valid rows
    for idx, row in enumerate(mapped_rows):
        # Check if row has errors
        row_errors = [e for e in validation_result.errors if e.row_index == idx]

        # Filter out reference errors if create_missing_references is enabled
        # (references will be created during import, so these are not real errors)
        if request.create_missing_references:
            row_errors = [e for e in row_errors if e.error_type != "reference"]

        if row_errors and request.skip_invalid:
            skipped_count += 1
            errors.extend([e.to_dict() for e in row_errors])
            continue

        if row_errors:
            error_count += 1
            errors.extend([e.to_dict() for e in row_errors])
            continue

        # Check for warnings (duplicates)
        row_warnings = [w for w in validation_result.warnings if w.row_index == idx]

        if row_warnings and request.skip_duplicates:
            skipped_count += 1
            warnings.extend([w.to_dict() for w in row_warnings])
            continue

        # Get store_id and product_group_id
        store_name = row.get("store", "").strip()
        product_group_name = row.get("product_group", "").strip()

        # Get or create store and product group IDs
        try:
            if request.create_missing_references:
                # Auto-create missing stores and product groups

                # Check if store existed before calling get_or_create
                store_exists = store_name.lower() in stores_cache

                store_id = await get_or_create_store(
                    session, store_name, current_user.id, stores_cache
                )

                # ✅ NEW: Track if store was created
                if not store_exists and store_name.lower() not in created_stores_dict:
                    # Fetch full Store object for response
                    from sqlmodel import select

                    from backend.app.models.store import Store

                    store_stmt = select(Store).where(Store.id == store_id)
                    store_result = await session.execute(store_stmt)
                    store_obj = store_result.scalar_one_or_none()
                    if store_obj:
                        created_stores_dict[store_name.lower()] = store_obj

                # Check if product group existed before calling get_or_create
                pg_exists = product_group_name.lower() in product_groups_cache

                product_group_id = await get_or_create_product_group(
                    session, product_group_name, current_user.id, product_groups_cache
                )

                # ✅ NEW: Track if product group was created
                if not pg_exists and product_group_name.lower() not in created_product_groups_dict:
                    # Fetch full ProductGroup object for response
                    from backend.app.models.product_group import ProductGroup

                    pg_stmt = select(ProductGroup).where(ProductGroup.id == product_group_id)
                    pg_result = await session.execute(pg_stmt)
                    pg_obj = pg_result.scalar_one_or_none()
                    if pg_obj:
                        created_product_groups_dict[product_group_name.lower()] = pg_obj
            else:
                # Validate that references exist (old behavior)
                store_error = await validate_store_reference(
                    session, idx, store_name, stores_cache
                )
                if store_error:
                    error_count += 1
                    errors.append(store_error.to_dict())
                    continue

                product_group_error = await validate_product_group_reference(
                    session, idx, product_group_name, product_groups_cache
                )
                if product_group_error:
                    error_count += 1
                    errors.append(product_group_error.to_dict())
                    continue

                # Get IDs from cache (validation already populated cache)
                store_id = stores_cache[store_name]
                product_group_id = product_groups_cache[product_group_name]

        except Exception as e:
            error_count += 1
            errors.append({
                "row_index": idx,
                "field": "general",
                "message": f"Failed to get/create references: {str(e)}",
            })
            continue

        # Create shopping list item
        try:
            # Parse quantity if present
            quantity_str = row.get("quantity")
            quantity = None
            if quantity_str and quantity_str.strip():
                try:
                    # Replace comma with dot for decimal parsing
                    quantity = float(quantity_str.replace(",", "."))
                except ValueError:
                    quantity = None

            # Create item directly (not via endpoint)
            item = ShoppingListItem(
                creator_id=current_user.id,
                shopping_list_id=request.shopping_list_id,
                store_id=store_id,
                product_group_id=product_group_id,
                product_name=row["product_name"],
                quantity=quantity,
                unit=row.get("unit") if row.get("unit") else None,
                comment=row.get("comment") if row.get("comment") else None,
            )

            session.add(item)
            # Note: commit happens after the loop (line ~395)

            imported_count += 1

        except Exception as e:
            error_count += 1
            errors.append({
                "row_index": idx,
                "field": "general",
                "message": f"Failed to create item: {str(e)}",
            })

    # Commit all changes
    try:
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit import: {str(e)}",
        )

    # Prepare metadata for created references
    from backend.app.schemas.product_group import ProductGroupResponse
    from backend.app.schemas.store import StoreResponse

    created_stores_list = [
        StoreResponse.model_validate(store)
        for store in created_stores_dict.values()
    ]
    created_product_groups_list = [
        ProductGroupResponse.model_validate(pg)
        for pg in created_product_groups_dict.values()
    ]

    return CSVImportResponse(
        success=error_count == 0,
        imported_count=imported_count,
        skipped_count=skipped_count,
        error_count=error_count,
        total_rows=len(mapped_rows),
        errors=errors,
        warnings=warnings,
        # ✅ NEW: Return created references metadata
        created_stores=created_stores_list,
        created_product_groups=created_product_groups_list,
    )
