"""
Unit tests for ImportExecutor service.

Tests import execution from staging to BudgetFact.
"""

from decimal import Decimal

import pytest

from backend.app.models.import_staging import ImportStaging
from backend.app.services.import_executor import ImportExecutor

# ============================================================================
# parse_tinkoff_amount() Tests
# ============================================================================


def test_parse_tinkoff_amount_positive():
    """Test parsing positive amount (income)."""
    amount = ImportExecutor.parse_tinkoff_amount("+500,00")
    assert amount == Decimal("500.00")


def test_parse_tinkoff_amount_negative():
    """Test parsing negative amount (expense)."""
    amount = ImportExecutor.parse_tinkoff_amount("-900,00")
    assert amount == Decimal("-900.00")


def test_parse_tinkoff_amount_with_spaces():
    """Test parsing amount with spaces."""
    amount = ImportExecutor.parse_tinkoff_amount(" +1000,50 ")
    assert amount == Decimal("1000.50")


def test_parse_tinkoff_amount_invalid():
    """Test parsing invalid amount raises ValueError."""
    with pytest.raises(ValueError, match="Invalid amount format"):
        ImportExecutor.parse_tinkoff_amount("invalid")


def test_parse_tinkoff_amount_empty():
    """Test parsing empty amount raises ValueError."""
    with pytest.raises(ValueError):
        ImportExecutor.parse_tinkoff_amount("")


# ============================================================================
# validate_staging_record() Tests
# ============================================================================


def test_validate_staging_record_valid():
    """Test validating valid staging record."""
    from datetime import date
    record = ImportStaging(
        id=1,
        user_id=1,
        tinkoff_date=date(2025, 11, 18),
        tinkoff_amount="-500,00",
        article_id=1,
        financial_center_id=1,
        is_selected=True,
        created_at=None
    )

    is_valid, error_msg = ImportExecutor.validate_staging_record(record)

    assert is_valid is True
    assert error_msg == ""


def test_validate_staging_record_missing_article():
    """Test validation fails when article_id is missing."""
    from datetime import date
    record = ImportStaging(
        id=1,
        user_id=1,
        tinkoff_date=date(2025, 11, 18),
        tinkoff_amount="-500,00",
        article_id=None,  # Missing
        financial_center_id=1,
        is_selected=True,
        created_at=None
    )

    is_valid, error_msg = ImportExecutor.validate_staging_record(record)

    assert is_valid is False
    assert "article_id" in error_msg


def test_validate_staging_record_missing_fc():
    """Test validation fails when financial_center_id is missing."""
    from datetime import date
    record = ImportStaging(
        id=1,
        user_id=1,
        tinkoff_date=date(2025, 11, 18),
        tinkoff_amount="-500,00",
        article_id=1,
        financial_center_id=None,  # Missing
        is_selected=True,
        created_at=None
    )

    is_valid, error_msg = ImportExecutor.validate_staging_record(record)

    assert is_valid is False
    assert "financial_center_id" in error_msg


def test_validate_staging_record_invalid_amount():
    """Test validation fails when amount is invalid."""
    from datetime import date
    record = ImportStaging(
        id=1,
        user_id=1,
        tinkoff_date=date(2025, 11, 18),
        tinkoff_amount="invalid",  # Invalid
        article_id=1,
        financial_center_id=1,
        is_selected=True,
        created_at=None
    )

    is_valid, error_msg = ImportExecutor.validate_staging_record(record)

    assert is_valid is False
    assert "Invalid amount" in error_msg
