"""
Generic CSV Parser Service

Service for parsing CSV files using user-defined column mapping.
Converts CSV rows to ImportStaging-ready dictionaries.

Pattern: Service layer (business logic)
"""

import csv
import io
import logging
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


class GenericCSVParser:
    """
    Service for parsing CSV with user-defined mapping.

    Parses CSV file using column mapping (CSV column → budget field)
    and returns list of dicts ready for ImportStaging insertion.

    Examples:
        >>> content = b"Date;Amount;Description\\n20.11.2025;-100,00;Test\\n"
        >>> mapping = {"fact_date": "Date", "amount": "Amount", "description": "Description"}
        >>> result = await GenericCSVParser.parse_with_mapping(
        ...     content, mapping, user_id=1, file_upload_id=1
        ... )
        >>> len(result)
        1
        >>> result[0]["fact_date"]
        datetime.date(2025, 11, 20)
    """

    @staticmethod
    async def parse_with_mapping(
        file_content: bytes,
        mapping: dict,
        user_id: int,
        file_upload_id: int,
        delimiter: str = ';',
        encoding: str = 'utf-8',
        date_format: Optional[str] = None,
        number_format: Optional[str] = None,
        transformations: Optional[dict] = None
    ) -> list[dict[str, Any]]:
        """
        Parse CSV using provided mapping.

        Converts CSV rows to ImportStaging-ready dicts using user-defined mapping.

        Args:
            file_content: Raw CSV file bytes
            mapping: Column mapping (budget field → CSV column name)
                     e.g., {"fact_date": "Дата операции", "amount": "Сумма"}
            user_id: User ID (owner)
            file_upload_id: File upload ID (for reference)
            delimiter: CSV delimiter (default ';')
            encoding: File encoding (default 'utf-8')
            date_format: Specific date format to use (e.g., '%m/%d/%Y %H:%M:%S').
                        If None, auto-detect from multiple formats.
            number_format: Number format for amount parsing:
                        - 'ru': Russian/EU format (space for thousands, comma for decimal: 1 234,56)
                        - 'us': US format (comma for thousands, dot for decimal: 1,234.56)
                        - 'de': German format (dot for thousands, comma for decimal: 1.234,56)
                        - None: auto-detect
            transformations: Optional transformations dict with keys:
                        - 'additional_description_columns': list[str] - List of specific CSV column names
                          to concatenate into description (e.g., ["MCC", "Merchant", "CardLast4"])

        Returns:
            List of dicts ready for ImportStaging insertion

        Examples:
            >>> content = b"Date;Amount;Desc\\n20.11.2025;-100,00;Test\\n"
            >>> mapping = {"fact_date": "Date", "amount": "Amount", "description": "Desc"}
            >>> result = await GenericCSVParser.parse_with_mapping(
            ...     content, mapping, user_id=1, file_upload_id=1
            ... )
            >>> result[0]["fact_date"]
            datetime.date(2025, 11, 20)
            >>> result[0]["amount_string"]
            '-100,00'
        """
        # Log transformation options
        transformations = transformations or {}
        additional_columns = transformations.get("additional_description_columns", [])
        logger.info(
            f"[CSV_PARSER] Starting parse: "
            f"additional_description_columns={additional_columns}, "
            f"encoding={encoding}, delimiter='{delimiter}'"
        )

        # Decode file
        text = file_content.decode(encoding)

        # Parse CSV
        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

        staging_records = []
        skipped_missing = 0
        skipped_date = 0
        skipped_zero = 0

        for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 is header
            try:
                # Extract values using mapping
                fact_date_col = mapping.get("fact_date", "")
                amount_col = mapping.get("amount", "")

                fact_date_str = row.get(fact_date_col, "")
                amount_str = row.get(amount_col, "")
                description = row.get(mapping.get("description", ""), "")

                # Skip rows with missing required fields
                if not fact_date_str or not amount_str:
                    skipped_missing += 1
                    if skipped_missing <= 3:  # Log first 3 skipped rows
                        logger.warning(
                            f"Row {row_num}: missing required fields. "
                            f"fact_date_col='{fact_date_col}', amount_col='{amount_col}', "
                            f"fact_date_str='{fact_date_str}', amount_str='{amount_str}', "
                            f"row_keys={list(row.keys())[:5]}"
                        )
                    continue

                # Parse date (use specified format or try multiple formats)
                fact_date = GenericCSVParser._parse_date(fact_date_str, date_format)
                if not fact_date:
                    skipped_date += 1
                    if skipped_date <= 3:  # Log first 3 unparseable dates
                        logger.warning(
                            f"Row {row_num}: cannot parse date '{fact_date_str}' "
                            f"with format={date_format or 'auto'}"
                        )
                    continue  # Skip invalid dates

                # Build csv_metadata (only category field remains)
                csv_metadata = {}
                if "csv_category" in mapping and mapping["csv_category"]:
                    value = row.get(mapping["csv_category"])
                    if value:
                        csv_metadata["category"] = value

                logger.debug(f"[CSV_MAPPING] Row {row_num}: csv_metadata={csv_metadata}")

                # Normalize amount_string to standard format (Russian: space + comma)
                normalized_amount = GenericCSVParser._normalize_amount(
                    amount_str, number_format
                )

                # Skip zero amounts (violates check_fact_amount_not_zero constraint)
                parsed_amount = GenericCSVParser._parse_amount(normalized_amount)
                if parsed_amount is None or parsed_amount == 0.0:
                    skipped_zero += 1
                    if skipped_zero <= 3:
                        logger.warning(f"Row {row_num}: skipping zero amount '{amount_str}'")
                    continue

                # Build description with optional concatenation
                description_parts = []

                # 1. Mapped description field (if exists)
                if description and str(description).strip():
                    description_parts.append(str(description).strip())

                # 2. Add additional description columns (if specified)
                if additional_columns:
                    logger.debug(
                        f"[CSV_PARSER] Row {row_num}: additional_description_columns={additional_columns}"
                    )

                    # Concatenate ONLY specified columns (skip empty values)
                    additional_parts = []
                    for col_name in additional_columns:
                        col_value = row.get(col_name)
                        if col_value and str(col_value).strip():
                            additional_parts.append(f"{col_name}: {str(col_value).strip()}")

                    if additional_parts:
                        concatenated = "; ".join(additional_parts)
                        description_parts.append(f"[CSV: {concatenated}]")
                        logger.debug(
                            f"[CSV_PARSER] Row {row_num}: concatenated {len(additional_parts)} "
                            f"additional columns"
                        )
                    else:
                        logger.debug(
                            f"[CSV_PARSER] Row {row_num}: additional columns specified but all empty"
                        )

                # 3. Combine parts
                final_description = " | ".join(description_parts) if description_parts else None

                logger.debug(
                    f"[CSV_PARSER] Row {row_num}: final_description length="
                    f"{len(final_description) if final_description else 0}"
                )

                # Build staging record
                staging_record = {
                    "user_id": user_id,
                    "file_upload_id": file_upload_id,
                    "fact_date": fact_date,
                    "amount_string": normalized_amount,
                    "description": final_description,  # Use concatenated description
                    "csv_metadata": csv_metadata or None,
                    "article_id": None,
                    "financial_center_id": None,
                    "cost_center_id": None,
                    "is_selected": False,
                    "budget_description": None
                }
                staging_records.append(staging_record)

            except Exception as e:
                # Skip rows that fail parsing
                logger.error(f"Row {row_num}: parsing error: {e}")
                continue

        # Log summary
        logger.info(
            f"[CSV_PARSER] Parsing complete: {len(staging_records)} records parsed, "
            f"{skipped_missing} skipped (missing fields), "
            f"{skipped_date} skipped (invalid date), "
            f"{skipped_zero} skipped (zero amount), "
            f"additional_description_columns={additional_columns}"
        )

        return staging_records

    @staticmethod
    def _parse_date(date_str: str, date_format: Optional[str] = None) -> Optional[datetime.date]:
        """
        Parse date from string using specified format with fallback to auto-detect.

        If date_format is provided, tries that format first.
        If it fails, falls back to auto-detect with multiple common formats.

        Supported auto-detect formats:
        - DD.MM.YYYY HH:MM:SS (Tinkoff)
        - DD.MM.YYYY
        - YYYY-MM-DD (ISO)
        - DD/MM/YYYY (European)
        - M/D/YYYY H:MM:SS (US with time)
        - M/D/YYYY (US)
        - YYYY.MM.DD

        Args:
            date_str: Date string from CSV
            date_format: Specific strptime format to try first (e.g., '%m/%d/%Y %H:%M:%S').
                        If parsing fails, falls back to auto-detect.

        Returns:
            datetime.date or None if parsing fails

        Examples:
            >>> GenericCSVParser._parse_date("7/4/2025 0:00:00", "%m/%d/%Y %H:%M:%S")
            datetime.date(2025, 7, 4)

            >>> GenericCSVParser._parse_date("20.11.2025 10:30:00")
            datetime.date(2025, 11, 20)

            >>> GenericCSVParser._parse_date("01.01.2026", "%d.%m.%Y %H:%M:%S")  # Fallback
            datetime.date(2026, 1, 1)

            >>> GenericCSVParser._parse_date("invalid")
            None
        """
        # Build list of formats to try
        date_formats = []

        # If specific format provided, try it first
        if date_format:
            date_formats.append(date_format)

        # Then try common formats (auto-detect)
        date_formats.extend([
            "%d.%m.%Y %H:%M:%S",  # Tinkoff: 20.11.2025 10:30:00
            "%d.%m.%Y",           # Common: 20.11.2025
            "%Y-%m-%d",           # ISO: 2025-11-20
            "%d/%m/%Y",           # European: 20/11/2025 (day/month)
            "%m/%d/%Y %H:%M:%S",  # US with time: 7/4/2025 0:00:00
            "%m/%d/%Y",           # US: 7/4/2025 (month/day)
            "%Y.%m.%d",           # Alternative: 2025.11.20
        ])

        for fmt in date_formats:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                return dt.date()
            except ValueError:
                continue

        return None

    @staticmethod
    def _normalize_amount(amount_str: str, number_format: Optional[str] = None) -> str:
        """
        Normalize amount string to standard format for storage.

        Converts various number formats to a normalized format that can be
        parsed by ImportExecutor.parse_amount().

        Supported formats:
        - 'ru': Russian/EU format (space for thousands, comma for decimal: 1 234,56)
        - 'us': US format (comma for thousands, dot for decimal: 1,234.56)
        - 'de': German format (dot for thousands, comma for decimal: 1.234,56)
        - None/auto: Attempt to detect format automatically

        Output format: Standard format with dot as decimal separator (1234.56)
        This format is compatible with Python's Decimal and float parsing.

        Args:
            amount_str: Original amount string from CSV
            number_format: Number format hint ('ru', 'us', 'de', or None for auto)

        Returns:
            Normalized amount string with dot decimal separator

        Examples:
            >>> GenericCSVParser._normalize_amount("-1 234,56", "ru")
            '-1234.56'

            >>> GenericCSVParser._normalize_amount("-1,234.56", "us")
            '-1234.56'

            >>> GenericCSVParser._normalize_amount("-1.234,56", "de")
            '-1234.56'

            >>> GenericCSVParser._normalize_amount("-9,000.00", None)  # auto-detect US
            '-9000.00'
        """
        if not amount_str:
            return amount_str

        # Clean whitespace
        cleaned = amount_str.strip()

        # Handle explicit formats
        if number_format == 'ru':
            # Russian/EU: space for thousands, comma for decimal
            # Example: "1 234,56" or "-1 234,56"
            cleaned = cleaned.replace(" ", "")
            cleaned = cleaned.replace(",", ".")
            return cleaned

        elif number_format == 'us':
            # US: comma for thousands, dot for decimal
            # Example: "1,234.56" or "-1,234.56"
            cleaned = cleaned.replace(",", "")
            return cleaned

        elif number_format == 'de':
            # German: dot for thousands, comma for decimal
            # Example: "1.234,56" or "-1.234,56"
            cleaned = cleaned.replace(".", "")
            cleaned = cleaned.replace(",", ".")
            return cleaned

        # Auto-detect format
        # Count dots and commas to determine format
        dots = cleaned.count('.')
        commas = cleaned.count(',')

        # Remove spaces first (common thousand separator)
        cleaned = cleaned.replace(" ", "")

        # Determine format based on pattern analysis
        if dots == 1 and commas == 0:
            # Simple format with dot decimal: "1234.56" or "-1234.56"
            return cleaned

        elif dots == 0 and commas == 1:
            # Simple format with comma decimal: "1234,56" or "-1234,56"
            return cleaned.replace(",", ".")

        elif dots >= 1 and commas == 1:
            # Check position: if comma is after last dot, it's German format
            # Example: "1.234,56" (German) vs unlikely "1,234.56.78"
            last_dot = cleaned.rfind('.')
            last_comma = cleaned.rfind(',')

            if last_comma > last_dot:
                # German format: dots for thousands, comma for decimal
                cleaned = cleaned.replace(".", "")
                cleaned = cleaned.replace(",", ".")
                return cleaned
            else:
                # Unusual format, try US-like interpretation
                cleaned = cleaned.replace(",", "")
                return cleaned

        elif commas >= 1 and dots == 1:
            # Check position: if dot is after last comma, it's US format
            # Example: "1,234.56" (US)
            last_dot = cleaned.rfind('.')
            last_comma = cleaned.rfind(',')

            if last_dot > last_comma:
                # US format: commas for thousands, dot for decimal
                cleaned = cleaned.replace(",", "")
                return cleaned
            else:
                # Unusual, try German-like interpretation
                cleaned = cleaned.replace(".", "")
                cleaned = cleaned.replace(",", ".")
                return cleaned

        elif dots == 0 and commas >= 1:
            # Multiple commas, likely thousands separators
            # Example: "1,234,567" (US with no decimal)
            # Or single comma as decimal: "1234,56" (already handled above)
            # Assume commas are thousands separators
            cleaned = cleaned.replace(",", "")
            return cleaned

        elif commas == 0 and dots >= 1:
            # Multiple dots, likely thousands separators (rare)
            # Example: "1.234.567" (DE with no decimal)
            # Assume dots are thousands separators
            cleaned = cleaned.replace(".", "")
            return cleaned

        # Fallback: return original with spaces removed
        return cleaned

    @staticmethod
    def _parse_amount(amount_str: str) -> Optional[float]:
        """
        Parse amount from string (handles Russian format).

        Handles:
        - Russian format: "-1 234,56" → -1234.56
        - Comma as decimal separator: "-100,00" → -100.00
        - Space as thousand separator: "1 000" → 1000

        Args:
            amount_str: Amount string from CSV

        Returns:
            float or None if parsing fails

        Examples:
            >>> GenericCSVParser._parse_amount("-100,00")
            -100.0

            >>> GenericCSVParser._parse_amount("-1 234,56")
            -1234.56

            >>> GenericCSVParser._parse_amount("1000.50")
            1000.5

            >>> GenericCSVParser._parse_amount("invalid")
            None
        """
        try:
            # Remove spaces (thousand separator)
            cleaned = amount_str.replace(" ", "")
            # Replace comma with dot (decimal separator)
            cleaned = cleaned.replace(",", ".")
            return float(cleaned)
        except (ValueError, AttributeError):
            return None
