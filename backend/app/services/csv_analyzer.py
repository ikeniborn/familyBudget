"""
CSV Analyzer Service

Service for analyzing CSV file structure (encoding, delimiter, headers, sample rows).
Used in multi-bank import workflow to understand CSV format before mapping.

Pattern: Service layer (business logic)
"""

import csv
import io
from typing import Any


class CSVAnalyzer:
    """
    Service for analyzing CSV file structure.

    Detects encoding, delimiter, extracts headers and sample rows.
    Used in Step 1 of import workflow (after file upload).

    Examples:
        # Analyze UTF-8 CSV
        >>> content = b"Date;Amount;Description\\n2025-11-20;-100.00;Test\\n"
        >>> result = await CSVAnalyzer.analyze_file(content, "test.csv")
        >>> result["encoding"]
        'utf-8'
        >>> result["delimiter"]
        ';'
        >>> result["headers"]
        ['Date', 'Amount', 'Description']

        # Analyze Windows-1251 CSV
        >>> content = "Дата;Сумма\\n2025-11-20;-100\\n".encode('windows-1251')
        >>> result = await CSVAnalyzer.analyze_file(content, "test.csv")
        >>> result["encoding"]
        'windows-1251'
    """

    @staticmethod
    async def analyze_file(file_content: bytes, filename: str) -> dict[str, Any]:
        """
        Analyze CSV file structure.

        Detects:
        - Encoding (UTF-8 or Windows-1251)
        - Delimiter (semicolon or comma)
        - Headers
        - Sample rows (first 5 rows)
        - Total rows

        Args:
            file_content: Raw file bytes
            filename: Original filename (for logging)

        Returns:
            Dictionary with CSV structure:
            {
                "encoding": "utf-8",
                "delimiter": ";",
                "headers": ["Date", "Amount", ...],
                "sample_rows": [{"Date": "2025-11-20", ...}, ...],
                "total_rows": 152
            }

        Raises:
            UnicodeDecodeError: If file is not UTF-8 or Windows-1251
            csv.Error: If CSV parsing fails

        Examples:
            >>> content = b"Date;Amount\\n2025-11-20;-100.00\\n"
            >>> result = await CSVAnalyzer.analyze_file(content, "test.csv")
            >>> result["headers"]
            ['Date', 'Amount']
            >>> result["total_rows"]
            1
        """
        # Try UTF-8 first
        try:
            text = file_content.decode('utf-8')
            encoding = 'utf-8'
        except UnicodeDecodeError:
            # Fallback to Windows-1251 (common for Russian banks)
            try:
                text = file_content.decode('windows-1251')
                encoding = 'windows-1251'
            except UnicodeDecodeError:
                # Last resort: try CP1251 (alias)
                text = file_content.decode('cp1251')
                encoding = 'cp1251'

        # Detect delimiter (try semicolon first, then comma)
        # Check first 1000 characters for performance
        sample = text[:1000]
        delimiter = ';' if ';' in sample else ','

        # Parse CSV
        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        rows = list(reader)

        # Extract headers
        headers = list(rows[0].keys()) if rows else []

        # Get sample rows (first 5)
        sample_rows = rows[:5]

        # Total rows count
        total_rows = len(rows)

        return {
            "encoding": encoding,
            "delimiter": delimiter,
            "headers": headers,
            "sample_rows": sample_rows,
            "total_rows": total_rows
        }

    @staticmethod
    def detect_encoding(file_content: bytes) -> str:
        """
        Detect file encoding.

        Tries UTF-8, then Windows-1251, then CP1251.

        Args:
            file_content: Raw file bytes

        Returns:
            Detected encoding name

        Raises:
            UnicodeDecodeError: If all encodings fail

        Examples:
            >>> content = b"Date;Amount"
            >>> CSVAnalyzer.detect_encoding(content)
            'utf-8'

            >>> content = "Дата;Сумма".encode('windows-1251')
            >>> CSVAnalyzer.detect_encoding(content)
            'windows-1251'
        """
        for encoding in ['utf-8', 'windows-1251', 'cp1251']:
            try:
                file_content.decode(encoding)
                return encoding
            except UnicodeDecodeError:
                continue
        raise UnicodeDecodeError('unknown', file_content, 0, len(file_content), 'Unable to detect encoding')

    @staticmethod
    def detect_delimiter(text: str) -> str:
        """
        Detect CSV delimiter.

        Checks for semicolon (;) or comma (,) in first 1000 characters.
        Semicolon is prioritized (common for Russian banks).

        Args:
            text: CSV file text content

        Returns:
            Detected delimiter (';' or ',')

        Examples:
            >>> CSVAnalyzer.detect_delimiter("Date;Amount")
            ';'

            >>> CSVAnalyzer.detect_delimiter("Date,Amount")
            ','
        """
        sample = text[:1000]
        return ';' if ';' in sample else ','
