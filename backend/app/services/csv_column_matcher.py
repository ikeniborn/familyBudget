"""
CSV Column Matcher Module

Performs fuzzy matching of CSV columns to expected fields using:
- Exact matching
- Lowercase matching
- Synonym matching
- Partial matching (Levenshtein distance)
"""
from typing import Optional


# Expected fields for shopping list items
EXPECTED_FIELDS = {
    "store": ["store", "магазин", "shop", "место"],
    "product_group": [
        "product_group",
        "группа",
        "category",
        "категория",
        "group",
        "группа товаров",
    ],
    "product_name": [
        "product",
        "product_name",
        "товар",
        "название",
        "name",
        "продукт",
        "наименование",
    ],
    "quantity": ["quantity", "количество", "qty", "кол-во", "count", "amount"],
    "unit": ["unit", "единица", "ед", "units", "measure"],
    "comment": ["comment", "комментарий", "note", "примечание", "описание"],
}


def normalize_column_name(column: str) -> str:
    """
    Normalize column name for matching.

    Removes extra spaces, converts to lowercase, removes special chars.

    Args:
        column: Column name to normalize

    Returns:
        Normalized column name

    Example:
        >>> normalize_column_name("  Product Name  ")
        "product name"
        >>> normalize_column_name("Кол-во (шт)")
        "кол-во шт"
    """
    # Lowercase
    normalized = column.lower().strip()

    # Remove parentheses and content
    normalized = normalized.split("(")[0].strip()

    # Replace multiple spaces with single space
    normalized = " ".join(normalized.split())

    # Remove special characters except spaces and hyphens
    normalized = "".join(
        c for c in normalized if c.isalnum() or c in (" ", "-", "_")
    )

    return normalized.strip()


def exact_match(column: str, field_name: str) -> bool:
    """
    Check for exact match (case-insensitive).

    Args:
        column: CSV column name
        field_name: Expected field name

    Returns:
        True if exact match

    Example:
        >>> exact_match("Product Name", "product_name")
        False
        >>> exact_match("product_name", "product_name")
        True
    """
    return normalize_column_name(column) == field_name.lower()


def synonym_match(column: str, field_name: str) -> bool:
    """
    Check if column matches any synonym of the field.

    Args:
        column: CSV column name
        field_name: Expected field name (e.g., "product_name")

    Returns:
        True if matches any synonym

    Example:
        >>> synonym_match("Товар", "product_name")
        True
        >>> synonym_match("Название", "product_name")
        True
    """
    normalized = normalize_column_name(column)
    synonyms = EXPECTED_FIELDS.get(field_name, [])

    for synonym in synonyms:
        if normalized == normalize_column_name(synonym):
            return True

    return False


def partial_match(column: str, field_name: str, threshold: float = 0.8) -> bool:
    """
    Check for partial match using simple string similarity.

    Uses a simple similarity metric: common characters / max length.

    Args:
        column: CSV column name
        field_name: Expected field name
        threshold: Minimum similarity (0.0 to 1.0)

    Returns:
        True if similarity >= threshold

    Example:
        >>> partial_match("product", "product_name", threshold=0.6)
        True
        >>> partial_match("xyz", "product_name", threshold=0.6)
        False
    """
    normalized_col = normalize_column_name(column)
    normalized_field = field_name.lower()

    # Check against field name and synonyms
    candidates = [normalized_field] + [
        normalize_column_name(syn) for syn in EXPECTED_FIELDS.get(field_name, [])
    ]

    for candidate in candidates:
        similarity = simple_similarity(normalized_col, candidate)
        if similarity >= threshold:
            return True

    return False


def simple_similarity(s1: str, s2: str) -> float:
    """
    Calculate simple string similarity (0.0 to 1.0).

    Uses: common_chars / max_length

    Args:
        s1: First string
        s2: Second string

    Returns:
        Similarity score (0.0 to 1.0)

    Example:
        >>> simple_similarity("product", "products")
        0.875  # 7 common chars / 8 max length
    """
    if not s1 or not s2:
        return 0.0

    # Count common characters
    common = sum(1 for c in s1 if c in s2)

    # Normalize by max length
    max_len = max(len(s1), len(s2))

    return common / max_len if max_len > 0 else 0.0


def match_column(column: str) -> Optional[str]:
    """
    Match CSV column to expected field using multiple strategies.

    Tries in order:
    1. Exact match
    2. Synonym match
    3. Partial match (threshold 0.8)

    Args:
        column: CSV column name

    Returns:
        Matched field name (e.g., "product_name") or None

    Example:
        >>> match_column("Товар")
        "product_name"
        >>> match_column("Магазин")
        "store"
        >>> match_column("Unknown Column")
        None
    """
    # Try exact match first
    for field_name in EXPECTED_FIELDS.keys():
        if exact_match(column, field_name):
            return field_name

    # Try synonym match
    for field_name in EXPECTED_FIELDS.keys():
        if synonym_match(column, field_name):
            return field_name

    # Try partial match (threshold 0.8)
    for field_name in EXPECTED_FIELDS.keys():
        if partial_match(column, field_name, threshold=0.8):
            return field_name

    # No match found
    return None


def auto_map_columns(csv_columns: list[str]) -> dict[str, Optional[str]]:
    """
    Automatically map CSV columns to expected fields.

    Args:
        csv_columns: List of CSV column names

    Returns:
        Dictionary mapping CSV column → expected field name

    Example:
        >>> auto_map_columns(["Магазин", "Товар", "Кол-во"])
        {"Магазин": "store", "Товар": "product_name", "Кол-во": "quantity"}
    """
    mapping = {}

    for column in csv_columns:
        matched_field = match_column(column)
        mapping[column] = matched_field

    return mapping


def get_mapping_suggestions(
    csv_columns: list[str],
) -> dict[str, list[tuple[str, float]]]:
    """
    Get field suggestions for each CSV column with confidence scores.

    Args:
        csv_columns: List of CSV column names

    Returns:
        Dictionary mapping CSV column → [(field_name, confidence), ...]

    Example:
        >>> get_mapping_suggestions(["Товар", "Product"])
        {
            "Товар": [("product_name", 1.0)],
            "Product": [("product_name", 0.9), ("product_group", 0.6)]
        }
    """
    suggestions = {}

    for column in csv_columns:
        column_suggestions = []

        for field_name in EXPECTED_FIELDS.keys():
            confidence = 0.0

            # Exact match: confidence 1.0
            if exact_match(column, field_name):
                confidence = 1.0
            # Synonym match: confidence 1.0
            elif synonym_match(column, field_name):
                confidence = 1.0
            # Partial match: confidence = similarity score
            else:
                normalized_col = normalize_column_name(column)
                candidates = [field_name.lower()] + [
                    normalize_column_name(syn)
                    for syn in EXPECTED_FIELDS.get(field_name, [])
                ]

                max_similarity = 0.0
                for candidate in candidates:
                    similarity = simple_similarity(normalized_col, candidate)
                    max_similarity = max(max_similarity, similarity)

                confidence = max_similarity

            if confidence > 0.5:  # Only suggest if confidence > 50%
                column_suggestions.append((field_name, confidence))

        # Sort by confidence (descending)
        column_suggestions.sort(key=lambda x: x[1], reverse=True)

        suggestions[column] = column_suggestions

    return suggestions


def validate_mapping(
    mapping: dict[str, Optional[str]]
) -> tuple[bool, list[str], list[str]]:
    """
    Validate column mapping completeness.

    Args:
        mapping: Dictionary mapping CSV column → field name

    Returns:
        Tuple (is_valid, required_missing, mapped_fields)

    Example:
        >>> mapping = {"Товар": "product_name", "Col2": None}
        >>> validate_mapping(mapping)
        (False, ["store", "product_group"], ["product_name"])
    """
    # Required fields
    REQUIRED_FIELDS = {"store", "product_group", "product_name"}

    # Get mapped fields
    mapped_fields = [field for field in mapping.values() if field is not None]

    # Check required fields
    missing_required = REQUIRED_FIELDS - set(mapped_fields)

    is_valid = len(missing_required) == 0

    return is_valid, list(missing_required), mapped_fields
