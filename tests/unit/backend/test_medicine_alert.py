"""Unit tests for expiry-alert message formatting (no scheduler / no DB)."""
from datetime import date

from backend.app.services.medicine_alert_service import format_expiry_message


def test_format_expiry_message_single():
    msg = format_expiry_message([
        {"name": "Нурофен 200мг", "expiry_date": date(2026, 7, 1), "quantity_remaining": 12, "unit": "шт"}
    ])
    assert "Нурофен 200мг" in msg
    assert "2026-07-01" in msg


def test_format_expiry_message_empty_returns_none():
    assert format_expiry_message([]) is None
