"""
Jinja2 Template Filters for HTMX partials.

This module provides custom filters for formatting data in Jinja2 templates,
used by HTMX partial templates in frontend/web/templates/partials/.

Usage:
    from backend.app.utils.template_filters import register_filters
    register_filters(templates.env)
"""

from datetime import date
from decimal import Decimal

from jinja2 import Environment


def format_money_mobile(value: float | Decimal | None) -> str:
    """
    Format money with k/M abbreviations for mobile displays.

    Examples:
        1234 -> "1.2k"
        1234567 -> "1.2M"
        -500 -> "-500"
        None -> "0"
    """
    if value is None:
        return "0"

    num = float(value)
    abs_num = abs(num)
    sign = "-" if num < 0 else ""

    if abs_num >= 1_000_000:
        formatted = f"{abs_num / 1_000_000:.1f}M"
    elif abs_num >= 1_000:
        formatted = f"{abs_num / 1_000:.1f}k"
    else:
        formatted = f"{int(abs_num)}"

    return f"{sign}{formatted}"


def format_money_desktop(value: float | Decimal | None) -> str:
    """
    Format money with space separators for desktop displays.

    Examples:
        1234567 -> "1 234 567"
        -500 -> "-500"
        None -> "0"
    """
    if value is None:
        return "0"

    num = int(float(value))
    formatted = f"{abs(num):,}".replace(",", " ")
    return f"-{formatted}" if num < 0 else formatted


def format_pct(value: float | Decimal | None) -> str:
    """
    Format percentage value.

    Examples:
        85.5 -> "86%"
        100 -> "100%"
        None -> "0%"
    """
    if value is None:
        return "0%"

    return f"{int(round(float(value)))}%"


def balance_color(value: float | Decimal | None) -> str:
    """
    Return CSS class based on balance sign.

    Examples:
        100 -> "text-success"
        -50 -> "text-error"
        0 -> ""
        None -> ""
    """
    if value is None:
        return ""

    num = float(value)
    if num > 0:
        return "text-success"
    elif num < 0:
        return "text-error"
    return ""


def amount_color(article_type: str) -> str:
    """
    Return CSS class based on article type.

    Args:
        article_type: 'expense', 'income', 'debit', 'credit'

    Returns:
        CSS class string
    """
    colors = {
        "expense": "text-error font-bold",
        "income": "text-success font-bold",
        "debit": "text-info font-bold",
        "credit": "text-warning font-bold",
    }
    return colors.get(article_type, "font-bold")


def format_money_recent(value: float | Decimal | None, article_type: str) -> str:
    """
    Format money with +/- sign based on article type.

    Args:
        value: Amount to format
        article_type: 'expense', 'income', 'debit', 'credit'

    Examples:
        (1234, 'expense') -> "-1 234"
        (1234, 'income') -> "+1 234"
    """
    if value is None:
        return "0"

    num = int(float(value))
    formatted = f"{abs(num):,}".replace(",", " ")

    if article_type in ("expense", "debit"):
        return f"-{formatted}"
    elif article_type in ("income", "credit"):
        return f"+{formatted}"
    return formatted


def format_date_full(value: date) -> str:
    """
    Format date as DD.MM.YYYY.

    Examples:
        date(2024, 12, 15) -> "15.12.2024"
    """
    if value is None:
        return ""
    return value.strftime("%d.%m.%Y")


def format_date_short(value: date) -> str:
    """
    Format date as DD.MM.

    Examples:
        date(2024, 12, 15) -> "15.12"
    """
    if value is None:
        return ""
    return value.strftime("%d.%m")


def register_filters(env: Environment) -> None:
    """
    Register all custom filters with Jinja2 environment.

    Args:
        env: Jinja2 Environment object (templates.env)

    Usage:
        from fastapi.templating import Jinja2Templates
        from backend.app.utils.template_filters import register_filters

        templates = Jinja2Templates(directory="templates")
        register_filters(templates.env)
    """
    env.filters["format_money_mobile"] = format_money_mobile
    env.filters["format_money_desktop"] = format_money_desktop
    env.filters["format_pct"] = format_pct
    env.filters["balance_color"] = balance_color
    env.filters["amount_color"] = amount_color
    env.filters["format_money_recent"] = format_money_recent
    env.filters["format_date_full"] = format_date_full
    env.filters["format_date_short"] = format_date_short
