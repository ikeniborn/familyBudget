"""
Google Sheets Import API Endpoints

Endpoints:
- POST /api/v1/shopping-lists/google-sheets/fetch - Fetch Google Sheets as CSV

Usage:
    POST /google-sheets/fetch
    Request:  {"google_sheets_url": "https://docs.google.com/spreadsheets/d/..."}
    Response: {"file_content": "base64_csv", "spreadsheet_id": "...", "sheet_gid": "..."}
"""
from typing import Optional

import base64
import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.core.dependencies import CurrentUser
from backend.app.services.google_sheets_parser import (
    GoogleSheetsError,
    fetch_google_sheets_as_csv,
    parse_google_sheets_url,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shopping-lists/google-sheets", tags=["Google Sheets Import"])


class GoogleSheetsFetchRequest(BaseModel):
    """Request to fetch Google Sheets."""

    google_sheets_url: str = Field(
        description="Public Google Sheets URL",
        examples=[
            "https://docs.google.com/spreadsheets/d/1ABC123.../edit#gid=0",
            "https://docs.google.com/spreadsheets/d/1ABC123.../edit",
        ],
        min_length=10,
    )


class GoogleSheetsFetchResponse(BaseModel):
    """Response with fetched CSV data."""

    file_content: str = Field(
        description="Base64 encoded CSV content (ready for /import/analyze)"
    )
    spreadsheet_id: str = Field(description="Extracted spreadsheet ID")
    sheet_gid: Optional[str] = Field(
        description="Extracted sheet GID (None if not specified)"
    )


@router.post(
    "/fetch",
    response_model=GoogleSheetsFetchResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch public Google Sheets as CSV",
    description=(
        "Fetch public Google Sheets as CSV via export URL. "
        "Returns base64 encoded CSV ready for /import/analyze endpoint."
    ),
)
async def fetch_google_sheets(
    request: GoogleSheetsFetchRequest,
    current_user: CurrentUser,
) -> GoogleSheetsFetchResponse:
    """
    Fetch public Google Sheets as CSV.

    **Steps:**
    1. Parse Google Sheets URL (extract spreadsheet_id and sheet_gid)
    2. Fetch sheet as CSV via Google's export endpoint
    3. Encode to base64
    4. Return (ready for /import/analyze)

    **Requirements:**
    - Google Sheets MUST be public ("Anyone with link → View")
    - URL must be valid Google Sheets URL

    **Supported URL formats:**
    - https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}
    - https://docs.google.com/spreadsheets/d/{ID}/edit

    **Error codes:**
    - 400: Invalid URL or private sheet
    - 401: Unauthorized (missing auth)
    - 500: Unexpected error

    **Example:**
    ```json
    // Request
    {
        "google_sheets_url": "https://docs.google.com/spreadsheets/d/1ABC.../edit#gid=0"
    }

    // Response (200 OK)
    {
        "file_content": "TWFnYXppbixHcnVwcGE...",  // base64
        "spreadsheet_id": "1ABC123...",
        "sheet_gid": "0"
    }

    // Error (400 Bad Request)
    {
        "detail": "Google Sheets не публична. Включите общий доступ..."
    }
    ```

    Args:
        request: Request with google_sheets_url
        current_user: Current authenticated user (from JWT)

    Returns:
        GoogleSheetsFetchResponse with base64 CSV content

    Raises:
        HTTPException: 400 if URL invalid or sheet not public
        HTTPException: 500 if unexpected error
    """
    try:
        # Parse URL
        logger.info(
            f"User {current_user.id} fetching Google Sheets: "
            f"{request.google_sheets_url[:50]}..."
        )

        spreadsheet_id, sheet_gid = await parse_google_sheets_url(
            request.google_sheets_url
        )

        # Fetch CSV
        csv_bytes = await fetch_google_sheets_as_csv(spreadsheet_id, sheet_gid)

        # Encode to base64
        file_content = base64.b64encode(csv_bytes).decode("utf-8")

        logger.info(
            f"Successfully fetched Google Sheets for user {current_user.id}: "
            f"spreadsheet_id={spreadsheet_id}, sheet_gid={sheet_gid or 'default'}, "
            f"size={len(csv_bytes)} bytes"
        )

        return GoogleSheetsFetchResponse(
            file_content=file_content,
            spreadsheet_id=spreadsheet_id,
            sheet_gid=sheet_gid,
        )

    except GoogleSheetsError as e:
        # User-friendly errors from google_sheets_parser
        logger.warning(
            f"Google Sheets fetch failed for user {current_user.id}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )

    except Exception as e:
        # Unexpected errors
        logger.error(
            f"Unexpected error fetching Google Sheets for user {current_user.id}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Неожиданная ошибка: {str(e)[:200]}",
        )
