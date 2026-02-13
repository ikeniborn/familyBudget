"""
CSV Analyzer Service

Service for analyzing CSV file structure (encoding, delimiter, headers, sample rows).
Used in multi-bank import workflow to understand CSV format before mapping.

Pattern: Service layer (business logic)
"""

import csv
import io
import logging
from typing import Any

logger = logging.getLogger(__name__)


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
    async def analyze_file(
        file_content: bytes,
        filename: str,
        user_delimiter: str | None = None
    ) -> dict[str, Any]:
        """
        Analyze CSV file structure.

        Detects:
        - Encoding (UTF-8 or Windows-1251)
        - Delimiter (semicolon, comma, or tab) - uses user-specified if provided
        - Headers
        - Sample rows (first 5 rows)
        - Total rows

        Args:
            file_content: Raw file bytes
            filename: Original filename (for logging)
            user_delimiter: Optional user-specified delimiter (';', ',', '\\t').
                           If None, auto-detect.

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

        # Use user-specified delimiter or auto-detect
        if user_delimiter:
            delimiter = user_delimiter
            logger.info(f"Using user-specified delimiter: {repr(delimiter)}")
        else:
            # Auto-detect delimiter using csv.Sniffer (more reliable)
            delimiter = CSVAnalyzer.detect_delimiter(text)
            logger.info(f"Auto-detected delimiter: {repr(delimiter)}")

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
        Detect CSV delimiter using csv.Sniffer.

        Uses Python's csv.Sniffer to intelligently detect the delimiter by
        analyzing the structure of the CSV file. Falls back to manual counting
        if Sniffer fails.

        Supported delimiters:
        - ';' (semicolon) - common for Russian bank exports
        - '\\t' (tab)
        - ',' (comma)
        - '|' (pipe)
        - ':' (colon)
        - ' ' (space)

        Priority for fallback: semicolon > tab > comma > pipe > colon > space

        Args:
            text: CSV file text content

        Returns:
            Detected delimiter (';', '\\t', ',', '|', ':', or ' ')

        Examples:
            >>> CSVAnalyzer.detect_delimiter("Date;Amount\\n2025-01-01;100")
            ';'

            >>> CSVAnalyzer.detect_delimiter("Date,Amount\\n2025-01-01,100")
            ','

            >>> CSVAnalyzer.detect_delimiter("Date\\tAmount\\n2025-01-01\\t100")
            '\\t'

            >>> CSVAnalyzer.detect_delimiter("Date|Amount\\n2025-01-01|100")
            '|'
        """
        # Use sample of first 8KB for Sniffer (enough for structure detection)
        sample = text[:8192]

        # Try csv.Sniffer first (most reliable)
        try:
            sniffer = csv.Sniffer()
            # Extended delimiter list: semicolon, comma, tab, pipe, colon, space
            dialect = sniffer.sniff(sample, delimiters=';,\t|: ')
            detected = dialect.delimiter
            logger.debug(f"csv.Sniffer detected delimiter: {repr(detected)}")
            return detected
        except csv.Error as e:
            logger.warning(f"csv.Sniffer failed: {e}, falling back to heuristic")

        # Fallback: count consistent column counts per delimiter
        # Get first 10 lines for analysis
        lines = sample.split('\n')[:10]
        if not lines:
            return ','

        # Extended candidates list (priority order: most common first)
        candidates = [';', '\t', ',', '|', ':', ' ']
        best_delimiter = ','
        best_score = 0

        for delim in candidates:
            # Count columns per line
            column_counts = []
            for line in lines:
                if line.strip():
                    # Use csv.reader to properly handle quoted fields
                    try:
                        reader = csv.reader(io.StringIO(line), delimiter=delim)
                        row = next(reader, [])
                        if row:
                            column_counts.append(len(row))
                    except csv.Error:
                        continue

            if not column_counts:
                continue

            # Score based on consistency and column count
            # Prefer delimiters that give consistent column counts > 1
            first_count = column_counts[0]
            consistency = sum(1 for c in column_counts if c == first_count) / len(column_counts)
            score = first_count * consistency if first_count > 1 else 0

            logger.debug(f"Delimiter {repr(delim)}: columns={first_count}, consistency={consistency:.2f}, score={score:.2f}")

            if score > best_score:
                best_score = score
                best_delimiter = delim

        logger.info(f"Heuristic detected delimiter: {repr(best_delimiter)} (score={best_score:.2f})")
        return best_delimiter
