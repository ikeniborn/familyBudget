"""
Google Sheets Parser Service

Fetches public Google Sheets as CSV and converts to standardized format.

Usage:
    from backend.app.services.google_sheets_parser import (
        parse_google_sheets_url,
        fetch_google_sheets_as_csv,
        GoogleSheetsError
    )

    # Parse URL
    spreadsheet_id, sheet_gid = await parse_google_sheets_url(url)

    # Fetch CSV
    csv_bytes = await fetch_google_sheets_as_csv(spreadsheet_id, sheet_gid)
"""
import logging
import re

import httpx

logger = logging.getLogger(__name__)


class GoogleSheetsError(Exception):
    """Base exception for Google Sheets operations."""
    pass


async def parse_google_sheets_url(url: str) -> tuple[str, str | None]:
    """
    Extract spreadsheet ID and sheet GID from Google Sheets URL.

    Supported formats:
    - https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}
    - https://docs.google.com/spreadsheets/d/{ID}/edit
    - https://docs.google.com/spreadsheets/d/{ID}

    Args:
        url: Google Sheets URL

    Returns:
        Tuple (spreadsheet_id, sheet_gid or None)

    Raises:
        GoogleSheetsError: Invalid URL format

    Examples:
        >>> url = "https://docs.google.com/spreadsheets/d/1ABC123/edit#gid=456"
        >>> spreadsheet_id, sheet_gid = await parse_google_sheets_url(url)
        >>> print(spreadsheet_id)  # "1ABC123"
        >>> print(sheet_gid)       # "456"
    """
    # Regex pattern to extract spreadsheet ID
    pattern = r'docs\.google\.com/spreadsheets/d/([a-zA-Z0-9-_]+)'
    match = re.search(pattern, url)

    if not match:
        raise GoogleSheetsError(
            "Invalid Google Sheets URL. "
            "Expected format: https://docs.google.com/spreadsheets/d/{ID}"
        )

    spreadsheet_id = match.group(1)

    # Extract GID from hash fragment (#gid=123)
    gid_pattern = r'[#&]gid=(\d+)'
    gid_match = re.search(gid_pattern, url)
    sheet_gid = gid_match.group(1) if gid_match else None

    logger.info(
        f"Parsed Google Sheets URL: spreadsheet_id={spreadsheet_id}, "
        f"sheet_gid={sheet_gid or 'default'}"
    )

    return spreadsheet_id, sheet_gid


async def fetch_google_sheets_as_csv(
    spreadsheet_id: str,
    sheet_gid: str | None = None,
    timeout: int = 30,
    max_redirects: int = 5
) -> bytes:
    """
    Fetch Google Sheets as CSV via export URL.

    Uses Google Sheets' public CSV export endpoint:
    https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}

    Args:
        spreadsheet_id: Google Sheets spreadsheet ID
        sheet_gid: Sheet GID (optional, defaults to first sheet)
        timeout: Request timeout in seconds (default: 30)
        max_redirects: Maximum number of redirects to follow (default: 5)

    Returns:
        CSV file content as bytes

    Raises:
        GoogleSheetsError: If fetch fails (403 Forbidden, 404 Not Found, network error)

    Examples:
        >>> csv_bytes = await fetch_google_sheets_as_csv("1ABC123", "456")
        >>> print(csv_bytes.decode('utf-8'))
        Store,ProductGroup,Product,Quantity
        Пятёрочка,Молочные,Молоко,2
    """
    # Build export URL
    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export"
    params = {"format": "csv"}

    if sheet_gid:
        params["gid"] = sheet_gid

    logger.info(
        f"Fetching Google Sheets as CSV: "
        f"spreadsheet_id={spreadsheet_id}, gid={sheet_gid or 'default'}"
    )

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        try:
            # Manual redirect handling to detect OAuth redirects
            current_url = url
            current_params = params
            redirect_count = 0

            while redirect_count < max_redirects:
                response = await client.get(current_url, params=current_params)

                # Handle redirects manually
                if response.status_code in (301, 302, 303, 307, 308):
                    redirect_url = response.headers.get("Location", "")

                    # Check if redirect is to Google OAuth/login
                    if any(
                        domain in redirect_url.lower()
                        for domain in ["accounts.google.com", "oauth", "login"]
                    ):
                        logger.error(
                            f"OAuth redirect detected for spreadsheet {spreadsheet_id}. "
                            f"Redirect to: {redirect_url[:100]}"
                        )
                        raise GoogleSheetsError(
                            "Google Sheets требует авторизацию. "
                            "Сделайте лист публичным: Файл → Доступ → Доступ по ссылке → Просмотр"
                        )

                    # Follow non-OAuth redirect
                    logger.debug(
                        f"Following redirect {redirect_count + 1}: {redirect_url[:100]}"
                    )
                    current_url = redirect_url
                    current_params = None  # Params already in redirect URL
                    redirect_count += 1
                    continue

                # Not a redirect, break out of loop
                break
            else:
                # Too many redirects
                raise GoogleSheetsError(
                    f"Слишком много редиректов ({max_redirects}). "
                    "Проверьте ссылку на Google Sheets."
                )

            response.raise_for_status()

            # Check for HTML content (login pages)
            content_type = response.headers.get("content-type", "").lower()
            if "html" in content_type:
                logger.error(
                    f"HTML response detected for spreadsheet {spreadsheet_id}. "
                    f"Content-Type: {content_type}"
                )
                raise GoogleSheetsError(
                    "Google Sheets вернул HTML вместо CSV. "
                    "Лист возможно приватный или требует авторизацию."
                )

            # Validate response is text content (CSV)
            if "text" not in content_type:
                logger.error(
                    f"Unexpected content type: {content_type}. "
                    f"Expected text/csv or text/plain"
                )
                raise GoogleSheetsError(
                    f"Unexpected content type: {content_type}. "
                    "The spreadsheet may not be public or does not exist."
                )

            logger.info(
                f"Successfully fetched Google Sheets CSV: "
                f"{len(response.content)} bytes"
            )

            return response.content

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                logger.error(
                    f"401 Unauthorized for spreadsheet {spreadsheet_id}. "
                    "The spreadsheet requires authentication."
                )
                raise GoogleSheetsError(
                    "Google Sheets требует авторизацию. "
                    "Сделайте таблицу публичной: Файл → Доступ → "
                    "Доступ по ссылке → Просмотр для всех"
                )
            elif e.response.status_code == 403:
                logger.error(
                    f"403 Forbidden for spreadsheet {spreadsheet_id}. "
                    "The spreadsheet is likely not public."
                )
                raise GoogleSheetsError(
                    "Google Sheets не публична. "
                    "Пожалуйста, включите общий доступ: "
                    "'Доступ по ссылке → Просмотр для всех, у кого есть ссылка'"
                )
            elif e.response.status_code == 404:
                logger.error(
                    f"404 Not Found for spreadsheet {spreadsheet_id}. "
                    "The spreadsheet may not exist or URL is incorrect."
                )
                raise GoogleSheetsError(
                    "Google Sheets не найдена. "
                    "Проверьте правильность ссылки."
                )
            else:
                logger.error(
                    f"HTTP error {e.response.status_code} "
                    f"fetching spreadsheet {spreadsheet_id}: {e}"
                )
                raise GoogleSheetsError(
                    f"Ошибка HTTP {e.response.status_code}: {e.response.text[:200]}"
                )

        except httpx.RequestError as e:
            logger.error(
                f"Network error fetching spreadsheet {spreadsheet_id}: {e}"
            )
            raise GoogleSheetsError(
                f"Ошибка сети: {str(e)}. Проверьте подключение к интернету."
            )
