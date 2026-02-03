"""
CSV Security Module

Prevents CSV injection attacks (formula injection) by sanitizing values
that start with dangerous characters: =, @, +, -, \t, \r

References:
- OWASP: https://owasp.org/www-community/attacks/CSV_Injection
- CWE-1236: https://cwe.mitre.org/data/definitions/1236.html
"""

import re
from typing import Any

# Dangerous prefixes that can be interpreted as formulas in Excel/Sheets
DANGEROUS_PREFIXES = ("=", "@", "+", "-", "\t", "\r")


def sanitize_csv_value(value: Any) -> str:
    """
    Sanitize a single CSV value to prevent injection attacks.

    Strategy: Prepend single quote (') to escape formula interpretation.

    Args:
        value: Value to sanitize (can be str, int, float, None)

    Returns:
        Sanitized string value

    Examples:
        >>> sanitize_csv_value("=SUM(A1:A10)")
        "'=SUM(A1:A10)"
        >>> sanitize_csv_value("Normal text")
        "Normal text"
        >>> sanitize_csv_value(123)
        "123"
    """
    if value is None:
        return ""

    # Convert to string
    str_value = str(value).strip()

    if not str_value:
        return ""

    # Check if starts with dangerous prefix
    if str_value.startswith(DANGEROUS_PREFIXES):
        # Escape with single quote
        return f"'{str_value}"

    return str_value


def sanitize_csv_row(row: dict[str, Any]) -> dict[str, str]:
    """
    Sanitize all values in a CSV row (dictionary).

    Args:
        row: Dictionary mapping column names to values

    Returns:
        Dictionary with sanitized values

    Example:
        >>> sanitize_csv_row({"name": "Product", "formula": "=1+1"})
        {"name": "Product", "formula": "'=1+1"}
    """
    return {key: sanitize_csv_value(value) for key, value in row.items()}


def is_dangerous_value(value: Any) -> bool:
    """
    Check if value is potentially dangerous (starts with formula prefix).

    Args:
        value: Value to check

    Returns:
        True if dangerous, False otherwise

    Example:
        >>> is_dangerous_value("=SUM(A1:A10)")
        True
        >>> is_dangerous_value("Normal text")
        False
    """
    if value is None:
        return False

    str_value = str(value).strip()
    return str_value.startswith(DANGEROUS_PREFIXES)


def detect_dangerous_rows(rows: list[dict[str, Any]]) -> list[tuple[int, str, str]]:
    """
    Detect rows containing dangerous values.

    Args:
        rows: List of row dictionaries

    Returns:
        List of tuples (row_index, column_name, dangerous_value)

    Example:
        >>> rows = [
        ...     {"name": "Product1", "price": "10"},
        ...     {"name": "=HYPERLINK(...)", "price": "20"}
        ... ]
        >>> detect_dangerous_rows(rows)
        [(1, 'name', '=HYPERLINK(...)')]
    """
    dangerous = []

    for idx, row in enumerate(rows):
        for col_name, value in row.items():
            if is_dangerous_value(value):
                dangerous.append((idx, col_name, str(value)))

    return dangerous


def validate_csv_safety(rows: list[dict[str, Any]]) -> tuple[bool, list[str]]:
    """
    Validate CSV for safety (detect injection attempts).

    Args:
        rows: List of row dictionaries

    Returns:
        Tuple (is_safe, warnings)
        - is_safe: True if no dangerous values found
        - warnings: List of warning messages

    Example:
        >>> rows = [{"name": "=CMD|'/c calc.exe'!A1"}]
        >>> validate_csv_safety(rows)
        (False, ["Row 0, column 'name': dangerous formula detected"])
    """
    dangerous_rows = detect_dangerous_rows(rows)

    if not dangerous_rows:
        return True, []

    warnings = [
        f"Row {idx}, column '{col}': dangerous formula detected (value starts with {value[0]})"
        for idx, col, value in dangerous_rows
    ]

    return False, warnings


# Additional security patterns to detect
SUSPICIOUS_PATTERNS = [
    re.compile(r"=cmd\|", re.IGNORECASE),  # Command execution
    re.compile(r"=dde\|", re.IGNORECASE),  # DDE attack
    re.compile(r"@sum\(", re.IGNORECASE),  # Spreadsheet functions
    re.compile(r"\+cmd\|", re.IGNORECASE),  # Alternative command syntax
]


def detect_suspicious_patterns(value: str) -> list[str]:
    """
    Detect known malicious patterns in CSV values.

    Args:
        value: String value to check

    Returns:
        List of detected pattern names

    Example:
        >>> detect_suspicious_patterns("=CMD|'/c calc.exe'!A1")
        ['Command execution detected']
    """
    if not value:
        return []

    detected = []

    if SUSPICIOUS_PATTERNS[0].search(value):
        detected.append("Command execution detected")
    if SUSPICIOUS_PATTERNS[1].search(value):
        detected.append("DDE attack detected")
    if SUSPICIOUS_PATTERNS[2].search(value):
        detected.append("Spreadsheet function detected")
    if SUSPICIOUS_PATTERNS[3].search(value):
        detected.append("Alternative command syntax detected")

    return detected


def advanced_csv_validation(rows: list[dict[str, Any]]) -> tuple[bool, list[str]]:
    """
    Advanced CSV validation with pattern detection.

    Args:
        rows: List of row dictionaries

    Returns:
        Tuple (is_safe, warnings)

    Example:
        >>> rows = [{"cmd": "=CMD|'/c calc.exe'!A1"}]
        >>> advanced_csv_validation(rows)
        (False, ["Row 0, column 'cmd': Command execution detected"])
    """
    warnings = []

    for idx, row in enumerate(rows):
        for col_name, value in row.items():
            if not value:
                continue

            str_value = str(value)

            # Check for dangerous prefixes
            if is_dangerous_value(str_value):
                warnings.append(
                    f"Row {idx}, column '{col_name}': dangerous prefix detected"
                )

            # Check for suspicious patterns
            patterns = detect_suspicious_patterns(str_value)
            if patterns:
                warnings.append(
                    f"Row {idx}, column '{col_name}': {', '.join(patterns)}"
                )

    is_safe = len(warnings) == 0
    return is_safe, warnings
