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
        date_format: Optional[str] = None
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
        # Decode file
        text = file_content.decode(encoding)

        # Parse CSV
        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

        staging_records = []
        skipped_missing = 0
        skipped_date = 0

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

                # Build csv_metadata (additional info fields for enrichment)
                csv_metadata = {}
                for field in ["csv_category", "csv_info1", "csv_info2"]:
                    if field in mapping and mapping[field]:
                        value = row.get(mapping[field])
                        if value:
                            # Remove "csv_" prefix for metadata key
                            metadata_key = field.replace("csv_", "")
                            csv_metadata[metadata_key] = value

                # Build staging record
                staging_record = {
                    "user_id": user_id,
                    "file_upload_id": file_upload_id,
                    "fact_date": fact_date,
                    "amount_string": amount_str,
                    "description": description or None,
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
            f"Parsing complete: {len(staging_records)} records parsed, "
            f"{skipped_missing} skipped (missing fields), "
            f"{skipped_date} skipped (invalid date)"
        )

        return staging_records

    @staticmethod
    def _parse_date(date_str: str, date_format: Optional[str] = None) -> Optional[datetime.date]:
        """
        Parse date from string using specified format or auto-detect.

        If date_format is provided, uses only that format.
        Otherwise, tries multiple common formats.

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
            date_format: Specific strptime format to use (e.g., '%m/%d/%Y %H:%M:%S').
                        If None, auto-detect from multiple formats.

        Returns:
            datetime.date or None if parsing fails

        Examples:
            >>> GenericCSVParser._parse_date("7/4/2025 0:00:00", "%m/%d/%Y %H:%M:%S")
            datetime.date(2025, 7, 4)

            >>> GenericCSVParser._parse_date("20.11.2025 10:30:00")
            datetime.date(2025, 11, 20)

            >>> GenericCSVParser._parse_date("invalid")
            None
        """
        # If specific format provided, use only that
        if date_format:
            try:
                dt = datetime.strptime(date_str.strip(), date_format)
                return dt.date()
            except ValueError:
                return None

        # Auto-detect: try multiple formats
        date_formats = [
            "%d.%m.%Y %H:%M:%S",  # Tinkoff: 20.11.2025 10:30:00
            "%d.%m.%Y",           # Common: 20.11.2025
            "%Y-%m-%d",           # ISO: 2025-11-20
            "%d/%m/%Y",           # European: 20/11/2025 (day/month)
            "%m/%d/%Y %H:%M:%S",  # US with time: 7/4/2025 0:00:00
            "%m/%d/%Y",           # US: 7/4/2025 (month/day)
            "%Y.%m.%d",           # Alternative: 2025.11.20
        ]

        for fmt in date_formats:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                return dt.date()
            except ValueError:
                continue

        return None

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
