"""Parse bank CSV records using a user-defined column mapping."""

import csv
import io
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from backend.app.services.bank_import_amount import normalize_bank_amount


@dataclass
class CSVParseReport:
    records: list[dict[str, Any]] = field(default_factory=list)
    rejected_rows: list[dict[str, Any]] = field(default_factory=list)


class GenericCSVParser:
    @staticmethod
    async def parse_with_mapping(*args, **kwargs) -> list[dict[str, Any]]:
        """Return accepted records for callers that do not consume the report."""
        return (await GenericCSVParser.parse_report(*args, **kwargs)).records

    @staticmethod
    async def parse_report(
        file_content: bytes,
        mapping: dict,
        user_id: int,
        file_upload_id: int,
        delimiter: str = ";",
        encoding: str = "utf-8",
        date_format: str | None = None,
        number_format: str | None = None,
        transformations: dict | None = None,
    ) -> CSVParseReport:
        text = file_content.decode(encoding)
        reader = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter)
        headers = next(reader, [])
        date_column = mapping.get("fact_date")
        amount_column = mapping.get("amount")
        missing_column = date_column not in headers or amount_column not in headers
        additional = (transformations or {}).get("additional_description_columns", [])
        report = CSVParseReport()
        while True:
            source_row = reader.line_num + 1
            values = next(reader, None)
            if values is None:
                break
            if not values:
                continue  # csv.DictReader also omits empty physical lines.
            row = dict(zip(headers, values))
            date_value = row.get(date_column, "").strip()
            amount_value = row.get(amount_column, "").strip()
            reason = None
            if missing_column:
                reason = "missing_column"
            elif not date_value or not amount_value:
                reason = "missing_value"
            elif (fact_date := GenericCSVParser._parse_date(date_value, date_format)) is None:
                reason = "invalid_date"
            else:
                try:
                    amount = normalize_bank_amount(amount_value, number_format)
                    amount_string = str(amount.original)
                    if len(amount_string) > 20:  # t_import_staging.amount_string is VARCHAR(20).
                        raise ValueError("amount_out_of_range")
                except ValueError as error:
                    reason = str(error)
            if reason:
                report.rejected_rows.append({"source_row": source_row, "reason": reason})
                continue

            description = row.get(mapping.get("description"), "").strip()
            details = [
                f"{column}: {row[column].strip()}"
                for column in additional if row.get(column, "").strip()
            ]
            if details:
                description = " | ".join(filter(None, (description, "[CSV: " + "; ".join(details) + "]")))
            category = row.get(mapping.get("csv_category"))
            report.records.append({
                "user_id": user_id,
                "file_upload_id": file_upload_id,
                "source_row": source_row,
                "fact_date": fact_date,
                "amount_string": amount_string,
                "description": description or None,
                "csv_metadata": {"category": category} if category else None,
                "article_id": None,
                "financial_center_id": None,
                "cost_center_id": None,
                "is_selected": False,
                "budget_description": None,
            })
        return report

    @staticmethod
    def _parse_date(date_str: str, date_format: str | None = None) -> date | None:
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
