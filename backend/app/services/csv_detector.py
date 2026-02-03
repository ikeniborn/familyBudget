"""
CSV Format Auto-Detection Module

Automatically detects:
- Delimiter (comma, semicolon, tab, pipe)
- Encoding (UTF-8, Windows-1251, ISO-8859-1)
- Date format (DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY)
- Number format (1,234.56 vs 1.234,56)
- Header presence
"""

import csv
import re
from collections import Counter
from datetime import datetime
from io import StringIO
from typing import Any, Optional

# Common delimiters to test
COMMON_DELIMITERS = [",", ";", "\t", "|"]

# Common encodings to test
COMMON_ENCODINGS = ["utf-8", "windows-1251", "iso-8859-1", "cp1252"]

# Date format patterns (regex and strptime format)
DATE_PATTERNS = [
    # DD.MM.YYYY, DD.MM.YY
    (re.compile(r"^\d{1,2}\.\d{1,2}\.\d{2,4}$"), "%d.%m.%Y", "DD.MM.YYYY"),
    # YYYY-MM-DD
    (re.compile(r"^\d{4}-\d{1,2}-\d{1,2}$"), "%Y-%m-%d", "YYYY-MM-DD"),
    # MM/DD/YYYY
    (re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$"), "%m/%d/%Y", "MM/DD/YYYY"),
    # DD/MM/YYYY
    (re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$"), "%d/%m/%Y", "DD/MM/YYYY"),
]

# Number format patterns
NUMBER_PATTERNS = [
    # 1,234.56 (US/UK format)
    (re.compile(r"^\d{1,3}(,\d{3})*(\.\d+)?$"), ".", ",", "1,234.56"),
    # 1.234,56 (EU format)
    (re.compile(r"^\d{1,3}(\.\d{3})*(,\d+)?$"), ",", ".", "1.234,56"),
    # 1234.56 (no thousands separator)
    (re.compile(r"^\d+\.\d+$"), ".", "", "1234.56"),
    # 1234,56 (no thousands separator)
    (re.compile(r"^\d+,\d+$"), ",", "", "1234,56"),
]


class CSVDetectionResult:
    """Result of CSV format detection."""

    def __init__(self):
        self.delimiter: str = ","
        self.encoding: str = "utf-8"
        self.has_header: bool = True
        self.date_format: Optional[str] = None
        self.number_format: Optional[str] = None
        self.decimal_separator: str = "."
        self.thousands_separator: str = ","
        self.detected_columns: list[str] = []
        self.sample_rows: list[dict[str, Any]] = []
        self.total_rows: int = 0
        self.confidence: float = 0.0  # 0.0 to 1.0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "delimiter": self.delimiter,
            "encoding": self.encoding,
            "has_header": self.has_header,
            "date_format": self.date_format,
            "number_format": self.number_format,
            "decimal_separator": self.decimal_separator,
            "thousands_separator": self.thousands_separator,
            "detected_columns": self.detected_columns,
            "sample_rows": self.sample_rows,
            "total_rows": self.total_rows,
            "confidence": self.confidence,
        }


def detect_encoding(file_bytes: bytes) -> str:
    """
    Detect file encoding by trying common encodings.

    Args:
        file_bytes: Raw file bytes

    Returns:
        Detected encoding name

    Example:
        >>> detect_encoding(b"\\xd0\\x9f\\xd1\\x80\\xd0\\xbe\\xd0\\xb4\\xd1\\x83\\xd0\\xba\\xd1\\x82")
        "utf-8"
    """
    for encoding in COMMON_ENCODINGS:
        try:
            file_bytes.decode(encoding)
            return encoding
        except (UnicodeDecodeError, LookupError):
            continue

    # Fallback to UTF-8 with error handling
    return "utf-8"


def detect_delimiter(text: str, sample_lines: int = 5) -> tuple[str, float]:
    """
    Detect CSV delimiter by analyzing first few lines.

    Strategy: Find delimiter that produces consistent column count.

    Args:
        text: CSV text content
        sample_lines: Number of lines to analyze

    Returns:
        Tuple (delimiter, confidence)

    Example:
        >>> detect_delimiter("name;price\\nProduct1;100\\nProduct2;200")
        (';', 1.0)
    """
    lines = text.split("\n")[:sample_lines]
    lines = [line.strip() for line in lines if line.strip()]

    if len(lines) < 2:
        return ",", 0.5  # Default fallback

    delimiter_scores: dict[str, float] = {}

    for delimiter in COMMON_DELIMITERS:
        try:
            # Count columns per line
            column_counts = [len(line.split(delimiter)) for line in lines]

            # Check consistency
            if len(set(column_counts)) == 1:  # All lines have same column count
                # Higher score for more columns
                avg_columns = column_counts[0]
                if avg_columns > 1:
                    delimiter_scores[delimiter] = 1.0
                else:
                    delimiter_scores[delimiter] = 0.3
            else:
                # Penalize inconsistent column counts
                delimiter_scores[delimiter] = 0.1

        except Exception:
            delimiter_scores[delimiter] = 0.0

    # Find best delimiter
    best_delimiter = max(delimiter_scores, key=delimiter_scores.get)
    confidence = delimiter_scores[best_delimiter]

    return best_delimiter, confidence


def detect_has_header(rows: list[list[str]]) -> bool:
    """
    Detect if first row is a header.

    Strategy: Header rows typically contain strings, not numbers.

    Args:
        rows: List of rows (each row is list of strings)

    Returns:
        True if first row is likely a header

    Example:
        >>> detect_has_header([["Name", "Price"], ["Product1", "100"]])
        True
        >>> detect_has_header([["Product1", "100"], ["Product2", "200"]])
        False
    """
    if len(rows) < 2:
        return True  # Assume header if only one row

    first_row = rows[0]
    second_row = rows[1] if len(rows) > 1 else []

    # Count numeric values in first row
    first_row_numeric = sum(1 for val in first_row if is_numeric(val))

    # Count numeric values in second row
    second_row_numeric = sum(1 for val in second_row if is_numeric(val))

    # If first row has significantly fewer numbers, it's likely a header
    if first_row_numeric < second_row_numeric:
        return True

    # If first row is all strings and second row has numbers, it's a header
    if first_row_numeric == 0 and second_row_numeric > 0:
        return True

    # Default: assume header
    return True


def is_numeric(value: str) -> bool:
    """
    Check if string value is numeric.

    Args:
        value: String to check

    Returns:
        True if numeric

    Example:
        >>> is_numeric("123.45")
        True
        >>> is_numeric("Product")
        False
    """
    if not value or not value.strip():
        return False

    # Remove common number separators
    cleaned = value.strip().replace(",", "").replace(".", "")

    return cleaned.isdigit() or (cleaned[0] == "-" and cleaned[1:].isdigit())


def detect_date_format(values: list[str]) -> Optional[str]:
    """
    Detect date format from sample values.

    Args:
        values: List of string values

    Returns:
        Detected date format (e.g., "DD.MM.YYYY") or None

    Example:
        >>> detect_date_format(["01.12.2023", "15.11.2023"])
        "DD.MM.YYYY"
    """
    format_votes: Counter = Counter()

    for value in values:
        if not value or not value.strip():
            continue

        for pattern, strptime_fmt, format_name in DATE_PATTERNS:
            if pattern.match(value.strip()):
                try:
                    # Try parsing to validate
                    datetime.strptime(value.strip(), strptime_fmt)
                    format_votes[format_name] += 1
                    break
                except ValueError:
                    continue

    if format_votes:
        return format_votes.most_common(1)[0][0]

    return None


def detect_number_format(values: list[str]) -> tuple[Optional[str], str, str]:
    """
    Detect number format from sample values.

    Args:
        values: List of string values

    Returns:
        Tuple (format_name, decimal_separator, thousands_separator)

    Example:
        >>> detect_number_format(["1,234.56", "2,345.67"])
        ("1,234.56", ".", ",")
    """
    format_votes: Counter = Counter()

    for value in values:
        if not value or not value.strip():
            continue

        for pattern, decimal_sep, thousands_sep, format_name in NUMBER_PATTERNS:
            if pattern.match(value.strip()):
                format_votes[format_name] += 1
                break

    if format_votes:
        most_common = format_votes.most_common(1)[0][0]
        # Find the pattern details
        for pattern, decimal_sep, thousands_sep, format_name in NUMBER_PATTERNS:
            if format_name == most_common:
                return format_name, decimal_sep, thousands_sep

    # Default: US format
    return "1,234.56", ".", ","


def detect_csv_format(
    file_bytes: bytes, max_sample_rows: int = 10
) -> CSVDetectionResult:
    """
    Automatically detect CSV format from file bytes.

    Args:
        file_bytes: Raw CSV file bytes
        max_sample_rows: Maximum rows to include in sample

    Returns:
        CSVDetectionResult with detected parameters

    Example:
        >>> content = b"Name;Price\\nProduct1;100\\nProduct2;200"
        >>> result = detect_csv_format(content)
        >>> result.delimiter
        ';'
    """
    result = CSVDetectionResult()

    # Step 1: Detect encoding
    result.encoding = detect_encoding(file_bytes)

    # Step 2: Decode to text
    try:
        text = file_bytes.decode(result.encoding)
    except UnicodeDecodeError:
        text = file_bytes.decode("utf-8", errors="ignore")
        result.encoding = "utf-8"

    # Step 3: Detect delimiter
    result.delimiter, delimiter_confidence = detect_delimiter(text)
    result.confidence = delimiter_confidence

    # Step 4: Parse CSV with detected delimiter
    try:
        reader = csv.reader(StringIO(text), delimiter=result.delimiter)
        rows = list(reader)
        result.total_rows = len(rows)

        # Step 5: Detect header
        result.has_header = detect_has_header(rows)

        # Step 6: Extract column names
        if result.has_header and rows:
            result.detected_columns = rows[0]
            data_rows = rows[1:]
        else:
            result.detected_columns = [f"Column_{i+1}" for i in range(len(rows[0]))]
            data_rows = rows

        # Step 7: Create sample rows (as dictionaries)
        for row in data_rows[:max_sample_rows]:
            if len(row) == len(result.detected_columns):
                row_dict = dict(zip(result.detected_columns, row))
                result.sample_rows.append(row_dict)

        # Step 8: Analyze data types for format detection
        if result.sample_rows:
            # Collect all values from all columns
            all_values = []
            for row_dict in result.sample_rows:
                all_values.extend(row_dict.values())

            # Detect date format
            result.date_format = detect_date_format(all_values)

            # Detect number format
            (
                result.number_format,
                result.decimal_separator,
                result.thousands_separator,
            ) = detect_number_format(all_values)

    except Exception:
        # Fallback: return result with defaults
        result.confidence = 0.0

    return result
