"""Decimal parsing and whole-ruble conversion for bank statements."""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation


@dataclass(frozen=True)
class BankAmount:
    original: Decimal
    whole: int
    stored: int
    difference: Decimal


def _ungroup(value: str, thousands: str, decimal: str) -> str:
    integer, separator, fraction = value.partition(decimal)
    if thousands in integer:
        groups = integer.lstrip("+-").split(thousands)
        if not (
            groups[0].isdecimal()
            and 1 <= len(groups[0]) <= 3
            and all(group.isdecimal() and len(group) == 3 for group in groups[1:])
        ):
            raise ValueError("invalid_amount")
        integer = integer.replace(thousands, "")
    return integer + ("." + fraction if separator else "")


def parse_bank_decimal(value: str, number_format: str | None = None) -> Decimal:
    """Read locale-specific CSV values as well as older staging strings."""
    cleaned = value.strip()
    for symbol in ("руб.", "руб", "₽", "$", "€", "£", "¥", "RUB", "USD", "EUR"):
        cleaned = cleaned.removeprefix(symbol).removesuffix(symbol).strip()
    cleaned = cleaned.replace(" ", "").replace("\u00a0", "").replace("\u202f", "")
    if number_format == "ru":
        cleaned = cleaned.replace(",", ".")
    elif number_format == "us":
        cleaned = _ungroup(cleaned, ",", ".")
    elif number_format == "de":
        cleaned = _ungroup(cleaned, ".", ",")
    elif "." in cleaned and "," in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = _ungroup(cleaned, ".", ",")
        else:
            cleaned = _ungroup(cleaned, ",", ".")
    elif cleaned.count(".") > 1:
        grouped, _, last = cleaned.rpartition(".")
        # Legacy staging also contains values such as 15.100.00.
        if len(last) == 2:
            cleaned = _ungroup(grouped, ".", ",") + "." + last
        else:
            cleaned = _ungroup(cleaned, ".", ",")
    elif cleaned.count(",") > 1:
        cleaned = _ungroup(cleaned, ",", ".")
    else:
        cleaned = cleaned.replace(",", ".")
    try:
        original = Decimal(cleaned)
    except InvalidOperation as error:
        raise ValueError("invalid_amount") from error
    if not original.is_finite() or "_" in cleaned:
        raise ValueError("invalid_amount")
    return original


def normalize_bank_amount(value: str, number_format: str | None = None) -> BankAmount:
    original = parse_bank_decimal(value, number_format)
    # Compare before converting to int. Scientific notation may have huge exponents.
    if original.copy_abs() >= 2**63:
        raise ValueError("amount_out_of_range")
    whole = int(original)
    if whole == 0:
        raise ValueError("zero_after_truncation")
    return BankAmount(original, whole, abs(whole), whole - original)
