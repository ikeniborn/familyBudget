"""
Input validation utilities for bot commands.

Provides validation functions for user input in conversational handlers.
"""

import re
from datetime import date, datetime, timedelta
from typing import Optional, Tuple

from bot.utils.logger import get_logger

logger = get_logger(__name__)


class ValidationError(Exception):
    """Custom exception for validation errors with user-friendly messages."""

    def __init__(self, message: str, field: str = "input"):
        """
        Initialize validation error.

        Args:
            message: User-friendly error message (in Russian)
            field: Field name that failed validation
        """
        self.message = message
        self.field = field
        super().__init__(message)


def validate_amount(amount_str: str) -> int:
    """
    Validate and parse amount input as integer rubles (БАГ-5).

    Accepts formats:
    - "100" → 100
    - "1 000" → 1000 (spaces as thousands separator)

    Validation rules:
    - Must be a whole integer > 0
    - Maximum 1 billion

    Args:
        amount_str: User input string

    Returns:
        int: Validated amount in integer rubles

    Raises:
        ValidationError: If validation fails

    Examples:
        >>> validate_amount("100")
        100
        >>> validate_amount("1 000")
        1000
    """
    if not amount_str or not amount_str.strip():
        raise ValidationError("❌ Сумма не может быть пустой", field="amount")

    # Normalize input: remove spaces (thousands separator)
    normalized = amount_str.strip().replace(" ", "")

    # Validate format: only digits (integer rubles, no decimals)
    if not re.match(r'^\d+$', normalized):
        raise ValidationError(
            "❌ Сумма должна быть целым числом в рублях.\n\n"
            "Примеры:\n"
            "• 100\n"
            "• 1 000\n"
            "• 50000",
            field="amount"
        )

    try:
        amount = int(normalized)
    except ValueError:
        raise ValidationError(
            "❌ Не удалось распознать сумму. Проверьте формат.",
            field="amount"
        )

    if amount <= 0:
        raise ValidationError(
            "❌ Сумма должна быть больше нуля",
            field="amount"
        )

    max_amount = 1_000_000_000
    if amount > max_amount:
        raise ValidationError(
            f"❌ Сумма не может превышать {max_amount:,}".replace(",", " "),
            field="amount"
        )

    logger.debug(f"Amount validated: {amount_str} → {amount}")

    return amount


def validate_date(date_str: str) -> date:
    """
    Validate and parse date input.

    Accepts formats:
    - "сегодня" / "today" → today's date
    - "вчера" / "yesterday" → yesterday's date
    - "DD.MM.YYYY" → specific date (e.g., "13.10.2025")
    - "DD.MM.YY" → specific date (e.g., "13.10.25" → 2025)
    - "DD.MM" → current year (e.g., "13.10" → 13.10.2025)

    Validation rules:
    - Cannot be in the future
    - Cannot be more than 10 years in the past

    Args:
        date_str: User input string

    Returns:
        date: Validated date object

    Raises:
        ValidationError: If validation fails

    Examples:
        >>> validate_date("сегодня")
        date(2025, 10, 13)  # today
        >>> validate_date("13.10.2025")
        date(2025, 10, 13)
        >>> validate_date("13.10")
        date(2025, 10, 13)  # current year
    """
    if not date_str or not date_str.strip():
        raise ValidationError("❌ Дата не может быть пустой", field="date")

    date_str = date_str.strip().lower()
    today = date.today()

    # Handle shortcuts
    if date_str in ("сегодня", "today"):
        return today

    if date_str in ("вчера", "yesterday"):
        return today - timedelta(days=1)

    # Parse date formats: DD.MM.YYYY, DD.MM.YY, DD.MM
    date_patterns = [
        (r'^(\d{1,2})\.(\d{1,2})\.(\d{4})$', '%d.%m.%Y'),  # DD.MM.YYYY
        (r'^(\d{1,2})\.(\d{1,2})\.(\d{2})$', '%d.%m.%y'),  # DD.MM.YY
        (r'^(\d{1,2})\.(\d{1,2})$', None),  # DD.MM (current year)
    ]

    parsed_date = None

    for pattern, date_format in date_patterns:
        match = re.match(pattern, date_str)
        if match:
            if date_format:
                # Parse with format
                try:
                    parsed_date = datetime.strptime(date_str, date_format).date()
                except ValueError as e:
                    raise ValidationError(
                        f"❌ Неверная дата: {e}",
                        field="date"
                    )
            else:
                # DD.MM format - use current year
                day, month = match.groups()
                try:
                    parsed_date = date(today.year, int(month), int(day))
                except ValueError as e:
                    raise ValidationError(
                        f"❌ Неверная дата: {e}",
                        field="date"
                    )
            break

    if not parsed_date:
        raise ValidationError(
            "❌ Неверный формат даты.\n\n"
            "Примеры правильного ввода:\n"
            "• сегодня\n"
            "• вчера\n"
            "• 13.10.2025\n"
            "• 13.10.25\n"
            "• 13.10 (текущий год)",
            field="date"
        )

    # Validate: cannot be in future
    if parsed_date > today:
        raise ValidationError(
            "❌ Дата не может быть в будущем",
            field="date"
        )

    # Validate: cannot be more than 10 years old
    ten_years_ago = today - timedelta(days=365 * 10)
    if parsed_date < ten_years_ago:
        raise ValidationError(
            f"❌ Дата не может быть более 10 лет назад\n"
            f"(минимальная дата: {ten_years_ago.strftime('%d.%m.%Y')})",
            field="date"
        )

    logger.debug(f"Date validated: {date_str} → {parsed_date}")

    return parsed_date


def validate_description(description_str: Optional[str]) -> Optional[str]:
    """
    Validate and normalize description input.

    Validation rules:
    - Trim leading/trailing whitespace
    - Return None if empty after trimming
    - Maximum 1000 characters

    Args:
        description_str: User input string (can be None)

    Returns:
        str | None: Validated description or None if empty

    Raises:
        ValidationError: If validation fails

    Examples:
        >>> validate_description("  Weekly groceries  ")
        'Weekly groceries'
        >>> validate_description("   ")
        None
        >>> validate_description(None)
        None
    """
    if not description_str:
        return None

    # Trim whitespace
    trimmed = description_str.strip()

    if not trimmed:
        return None

    # Validate: max 1000 characters
    if len(trimmed) > 1000:
        raise ValidationError(
            f"❌ Описание слишком длинное ({len(trimmed)} символов)\n"
            f"Максимум: 1000 символов",
            field="description"
        )

    logger.debug(f"Description validated: {len(trimmed)} chars")

    return trimmed


def format_amount(amount) -> str:
    """
    Format amount for display (integer rubles, with thousands separator).

    Accepts int, Decimal, or numeric string — all rendered as integer rubles
    after БАГ-5 (rounded to int for display).

    Args:
        amount: numeric amount in rubles (int, Decimal, str)

    Returns:
        str: Formatted amount string (e.g., "1 000")

    Examples:
        >>> format_amount(1000)
        '1 000'
        >>> format_amount(50)
        '50'
    """
    # Coerce through int — handles int, Decimal, float, numeric string
    return f"{int(amount):,}".replace(",", " ")


def format_date(date_obj: date) -> str:
    """
    Format date for display (Russian format).

    Args:
        date_obj: Date object

    Returns:
        str: Formatted date string (e.g., "13.10.2025")

    Examples:
        >>> format_date(date(2025, 10, 13))
        '13.10.2025'
    """
    return date_obj.strftime("%d.%m.%Y")


def parse_article_callback(callback_data: str) -> Tuple[str, Optional[int]]:
    """
    Parse inline keyboard callback data for article selection.

    Expected formats:
    - "article:123" → ("article", 123)
    - "cancel" → ("cancel", None)
    - "skip" → ("skip", None)

    Args:
        callback_data: Callback data from inline button

    Returns:
        Tuple of (action, article_id)

    Raises:
        ValueError: If format is invalid

    Examples:
        >>> parse_article_callback("article:123")
        ('article', 123)
        >>> parse_article_callback("cancel")
        ('cancel', None)
    """
    parts = callback_data.split(":")

    if len(parts) == 1:
        # Simple action: cancel, skip, etc.
        return parts[0], None

    if len(parts) == 2 and parts[0] == "article":
        # Article selection: article:ID
        try:
            article_id = int(parts[1])
            return "article", article_id
        except ValueError:
            raise ValueError(f"Invalid article ID in callback: {callback_data}")

    raise ValueError(f"Unknown callback format: {callback_data}")
