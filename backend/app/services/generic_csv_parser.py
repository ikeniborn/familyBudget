"""
Generic CSV Parser Service

Service for parsing CSV files using user-defined column mapping.
Converts CSV rows to ImportStaging-ready dictionaries.

Pattern: Service layer (business logic)
"""

import csv
import io
from datetime import datetime
from typing import Any, Optional


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
        encoding: str = 'utf-8'
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
        for row in reader:
            try:
                # Extract values using mapping
                fact_date_str = row.get(mapping.get("fact_date", ""), "")
                amount_str = row.get(mapping.get("amount", ""), "")
                description = row.get(mapping.get("description", ""), "")

                # Skip rows with missing required fields
                if not fact_date_str or not amount_str:
                    continue

                # Parse date (try multiple formats)
                fact_date = GenericCSVParser._parse_date(fact_date_str)
                if not fact_date:
                    continue  # Skip invalid dates

                # Build csv_metadata (bank-specific fields)
                csv_metadata = {}
                for field in ["csv_category", "csv_mcc", "csv_card"]:
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
                # TODO: Log error for debugging
                continue

        return staging_records

    @staticmethod
    def _parse_date(date_str: str) -> Optional[datetime.date]:
        """
        Parse date from string (supports multiple formats).

        Tries:
        - DD.MM.YYYY HH:MM:SS
        - DD.MM.YYYY
        - YYYY-MM-DD
        - DD/MM/YYYY

        Args:
            date_str: Date string from CSV

        Returns:
            datetime.date or None if parsing fails

        Examples:
            >>> GenericCSVParser._parse_date("20.11.2025 10:30:00")
            datetime.date(2025, 11, 20)

            >>> GenericCSVParser._parse_date("20.11.2025")
            datetime.date(2025, 11, 20)

            >>> GenericCSVParser._parse_date("2025-11-20")
            datetime.date(2025, 11, 20)

            >>> GenericCSVParser._parse_date("invalid")
            None
        """
        date_formats = [
            "%d.%m.%Y %H:%M:%S",  # Tinkoff: 20.11.2025 10:30:00
            "%d.%m.%Y",           # Common: 20.11.2025
            "%Y-%m-%d",           # ISO: 2025-11-20
            "%d/%m/%Y",           # Alternative: 20/11/2025
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
