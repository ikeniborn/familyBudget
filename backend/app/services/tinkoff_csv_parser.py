"""
Tinkoff Bank CSV Parser Service.

This module provides CSV parsing functionality for Tinkoff bank transaction imports.
Handles parsing, validation, and conversion to ImportStaging records.

CSV Format (Tinkoff):
    - Delimiter: semicolon (;)
    - Encoding: UTF-8
    - Headers: 15 columns
    - Date format: DD.MM.YYYY
    - Decimal separator: comma (,)
    - Amount sign: + (income), - (expense)

Key Functions:
    - parse_csv_file(): Parse uploaded CSV file
    - validate_csv_format(): Validate CSV structure
    - filter_transactions(): Remove FAILED and internal transfers
    - convert_to_staging(): Convert CSV rows to ImportStaging records
"""

import csv
import io
from datetime import datetime
from typing import Any

from fastapi import HTTPException, UploadFile


class TinkoffCSVParser:
    """
    Parser for Tinkoff bank CSV transaction exports.

    Handles CSV parsing with Tinkoff-specific format (semicolon delimiter,
    comma as decimal separator, Russian headers).

    Expected CSV columns (15 total):
        0: Дата операции (DateTime: DD.MM.YYYY HH:MM:SS)
        1: Дата платежа (Date: DD.MM.YYYY, may be empty)
        2: Номер карты (String: "*5958", may be empty)
        3: Статус (Enum: "OK", "FAILED")
        4: Сумма операции (Decimal: "900,00" or "-900,00")
        5: Валюта операции (String: "RUB")
        6: Сумма платежа (Decimal: usually same as 4)
        7: Валюта платежа (String: "RUB")
        8: Кэшбэк (Decimal: "", "2", may be empty)
        9: Категория (String: "Переводы", "Фастфуд", etc.)
        10: MCC (String: "9311", "5814", may be empty)
        11: Описание (String: "Между своими счетами", "Кафе", etc.)
        12: Бонусы (Decimal: "0,00", "2,00")
        13: Округление (Decimal: "0,00")
        14: Сумма с округлением (Decimal: same as 4)
    """

    # Expected number of columns in Tinkoff CSV
    EXPECTED_COLUMNS = 15

    # CSV headers (Russian)
    EXPECTED_HEADERS = [
        "Дата операции",
        "Дата платежа",
        "Номер карты",
        "Статус",
        "Сумма операции",
        "Валюта операции",
        "Сумма платежа",
        "Валюта платежа",
        "Кэшбэк",
        "Категория",
        "MCC",
        "Описание",
        "Бонусы (включая кэшбэк)",
        "Округление на инвесткопилку",
        "Сумма операции с округлением"
    ]

    # Internal transfer detection patterns
    INTERNAL_TRANSFER_KEYWORDS = [
        "Между своими счетами",
        "Пополнение вклада",
        "Снятие с вклада",
        "Закрытие вклада"
    ]

    @staticmethod
    async def parse_csv_file(file: UploadFile) -> list[dict[str, Any]]:
        """
        Parse uploaded CSV file from Tinkoff.

        Args:
            file: UploadFile object from FastAPI

        Returns:
            List of dictionaries, each representing a CSV row

        Raises:
            HTTPException: If file is not CSV or encoding is wrong
            HTTPException: If CSV format is invalid (wrong columns)
        """
        if not file.filename.endswith('.csv'):
            raise HTTPException(
                status_code=400,
                detail="Файл должен быть в формате CSV"
            )

        try:
            # Read file content
            content = await file.read()

            # Decode as UTF-8
            try:
                text = content.decode('utf-8')
            except UnicodeDecodeError:
                # Try Windows-1251 as fallback
                text = content.decode('windows-1251')

            # Parse CSV with semicolon delimiter
            reader = csv.DictReader(
                io.StringIO(text),
                delimiter=';',
                quotechar='"'
            )

            # Convert to list of dicts
            rows = list(reader)

            if not rows:
                raise HTTPException(
                    status_code=400,
                    detail="CSV файл пуст"
                )

            # Validate format (check columns)
            TinkoffCSVParser.validate_csv_format(rows[0])

            return rows

        except UnicodeDecodeError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Ошибка кодировки файла: {str(e)}"
            )
        except csv.Error as e:
            raise HTTPException(
                status_code=400,
                detail=f"Ошибка парсинга CSV: {str(e)}"
            )

    @staticmethod
    def validate_csv_format(first_row: dict[str, Any]) -> None:
        """
        Validate CSV format by checking headers.

        Args:
            first_row: First row of CSV data (as dict)

        Raises:
            HTTPException: If headers don't match expected Tinkoff format
        """
        actual_headers = list(first_row.keys())

        # Check number of columns
        if len(actual_headers) != TinkoffCSVParser.EXPECTED_COLUMNS:
            raise HTTPException(
                status_code=400,
                detail=f"Неверный формат CSV. "
                       f"Ожидалось {TinkoffCSVParser.EXPECTED_COLUMNS} колонок, "
                       f"найдено {len(actual_headers)}"
            )

        # Check if headers match (allow some flexibility)
        # Just check a few key columns
        required_keys = ["Дата операции", "Статус", "Сумма операции", "Описание"]
        missing_keys = [key for key in required_keys if key not in actual_headers]

        if missing_keys:
            raise HTTPException(
                status_code=400,
                detail=f"Неверный формат CSV Тинкофф. "
                       f"Отсутствуют колонки: {', '.join(missing_keys)}"
            )

    @staticmethod
    def filter_transactions(
        rows: list[dict[str, Any]],
        skip_failed: bool = True,
        skip_internal_transfers: bool = True
    ) -> list[dict[str, Any]]:
        """
        Filter transactions based on status and type.

        Args:
            rows: List of CSV rows
            skip_failed: Skip transactions with status "FAILED"
            skip_internal_transfers: Skip internal bank transfers

        Returns:
            Filtered list of transactions
        """
        filtered = []

        for row in rows:
            # Skip FAILED transactions
            if skip_failed and row.get("Статус", "").upper() == "FAILED":
                continue

            # Skip internal transfers
            if skip_internal_transfers:
                description = row.get("Описание", "")
                is_internal = any(
                    keyword in description
                    for keyword in TinkoffCSVParser.INTERNAL_TRANSFER_KEYWORDS
                )
                if is_internal:
                    continue

            filtered.append(row)

        return filtered

    @staticmethod
    def convert_to_staging(
        rows: list[dict[str, Any]],
        user_id: int
    ) -> list[dict[str, Any]]:
        """
        Convert CSV rows to ImportStaging-compatible dictionaries.

        Args:
            rows: Filtered list of CSV rows
            user_id: ID of user who uploaded the CSV

        Returns:
            List of dictionaries ready for ImportStaging model creation

        Raises:
            HTTPException: If date parsing fails or required fields are missing
        """
        staging_records = []

        for idx, row in enumerate(rows):
            try:
                # Parse date (DD.MM.YYYY HH:MM:SS → date)
                date_str = row.get("Дата операции", "").strip()
                if not date_str:
                    raise ValueError(f"Пустая дата операции в строке {idx + 1}")

                # Parse datetime and extract date
                dt = datetime.strptime(date_str, "%d.%m.%Y %H:%M:%S")
                transaction_date = dt.date()

                # Get amount (keep as string with comma)
                amount_str = row.get("Сумма операции", "").strip()
                if not amount_str:
                    raise ValueError(f"Пустая сумма в строке {idx + 1}")

                # Create staging record dict
                staging_record = {
                    "user_id": user_id,
                    "tinkoff_date": transaction_date,
                    "tinkoff_amount": amount_str,
                    "tinkoff_category": row.get("Категория", "").strip() or None,
                    "tinkoff_mcc": row.get("MCC", "").strip() or None,
                    "tinkoff_description": row.get("Описание", "").strip() or None,
                    "tinkoff_card": row.get("Номер карты", "").strip() or None,
                    "article_id": None,  # User will assign
                    "financial_center_id": None,  # User will assign
                    "cost_center_id": None,  # User will assign
                    "is_selected": False,  # Default: not selected
                }

                staging_records.append(staging_record)

            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ошибка парсинга строки {idx + 1}: {str(e)}"
                )
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Неожиданная ошибка в строке {idx + 1}: {str(e)}"
                )

        return staging_records

    @staticmethod
    async def parse_and_prepare(
        file: UploadFile,
        user_id: int,
        skip_failed: bool = True,
        skip_internal_transfers: bool = True
    ) -> list[dict[str, Any]]:
        """
        Full pipeline: parse → validate → filter → convert.

        Convenience method that combines all steps.

        Args:
            file: Uploaded CSV file
            user_id: ID of user uploading the file
            skip_failed: Skip FAILED transactions
            skip_internal_transfers: Skip internal bank transfers

        Returns:
            List of ImportStaging-ready dictionaries
        """
        # Parse CSV
        rows = await TinkoffCSVParser.parse_csv_file(file)

        # Filter
        filtered_rows = TinkoffCSVParser.filter_transactions(
            rows,
            skip_failed=skip_failed,
            skip_internal_transfers=skip_internal_transfers
        )

        # Convert to staging format
        staging_records = TinkoffCSVParser.convert_to_staging(
            filtered_rows,
            user_id=user_id
        )

        return staging_records
