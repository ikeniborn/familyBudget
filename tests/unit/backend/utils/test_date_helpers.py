"""
Unit tests for date_helpers utility functions.

Tests rolling period calculations, ISO week numbers, and proportional budgets
without database or HTTP dependencies.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from backend.app.utils.date_helpers import (
    get_iso_week_number,
    get_month_name_short_ru,
    get_proportional_budget,
    get_quarter_bounds,
    get_rolling_months,
    get_rolling_weeks,
    get_week_bounds,
)


@pytest.mark.unit
class TestGetISOWeekNumber:
    """Test ISO week number formatting."""

    def test_week_45_2025(self):
        """Test week 45 of 2025."""
        result = get_iso_week_number(date(2025, 11, 8))
        assert result == "Н45 25"

    def test_week_1_2025(self):
        """Test first week of 2025."""
        result = get_iso_week_number(date(2025, 1, 1))
        assert result == "Н1 25"

    def test_week_52_2024(self):
        """Test last week of 2024."""
        result = get_iso_week_number(date(2024, 12, 30))
        assert result == "Н1 25"  # ISO week 1 of 2025

    def test_week_53_exists(self):
        """Test year with 53 weeks (e.g., 2020)."""
        result = get_iso_week_number(date(2020, 12, 31))
        assert result == "Н53 20"


@pytest.mark.unit
class TestGetWeekBounds:
    """Test calendar week boundaries (Monday-Sunday)."""

    def test_friday_returns_monday_sunday(self):
        """Test Friday 2025-11-08 returns Mon-Sun bounds."""
        monday, sunday = get_week_bounds(date(2025, 11, 8))
        assert monday == date(2025, 11, 3)  # Monday
        assert sunday == date(2025, 11, 9)  # Sunday

    def test_monday_returns_same_week(self):
        """Test Monday returns same Monday and following Sunday."""
        monday, sunday = get_week_bounds(date(2025, 11, 3))
        assert monday == date(2025, 11, 3)
        assert sunday == date(2025, 11, 9)

    def test_sunday_returns_same_week(self):
        """Test Sunday returns previous Monday and same Sunday."""
        monday, sunday = get_week_bounds(date(2025, 11, 9))
        assert monday == date(2025, 11, 3)
        assert sunday == date(2025, 11, 9)


@pytest.mark.unit
class TestGetRollingWeeks:
    """Test rolling weeks calculation."""

    def test_4_weeks_incomplete(self):
        """Test 4 weeks with incomplete current week."""
        weeks = get_rolling_weeks(4, date(2025, 11, 8), include_incomplete=True)

        assert len(weeks) == 4

        # Week 1: 2025-10-13 to 2025-10-19 (full week, Sunday)
        assert weeks[0][0] == date(2025, 10, 13)
        assert weeks[0][1] == date(2025, 10, 19)
        assert weeks[0][2] == "Н42 25"

        # Week 4: 2025-11-03 to 2025-11-08 (incomplete, ends today)
        assert weeks[3][0] == date(2025, 11, 3)
        assert weeks[3][1] == date(2025, 11, 8)
        assert weeks[3][2] == "Н45 25"

    def test_4_weeks_complete(self):
        """Test 4 weeks with all complete weeks."""
        weeks = get_rolling_weeks(4, date(2025, 11, 8), include_incomplete=False)

        assert len(weeks) == 4

        # All weeks should end on Sunday
        for week_start, week_end, iso_label in weeks:
            assert week_end.weekday() == 6  # Sunday

    def test_single_week_incomplete(self):
        """Test single incomplete week."""
        weeks = get_rolling_weeks(1, date(2025, 11, 8), include_incomplete=True)

        assert len(weeks) == 1
        assert weeks[0][0] == date(2025, 11, 3)  # Monday
        assert weeks[0][1] == date(2025, 11, 8)  # Today (Friday)
        assert weeks[0][2] == "Н45 25"


@pytest.mark.unit
class TestGetRollingMonths:
    """Test rolling months calculation."""

    def test_3_months_incomplete(self):
        """Test 3 months with incomplete current month."""
        months = get_rolling_months(3, date(2025, 11, 8), include_incomplete=True)

        assert len(months) == 3

        # Month 1: September 2025 (full)
        assert months[0][0] == date(2025, 9, 1)
        assert months[0][1] == date(2025, 9, 30)
        assert months[0][2] == "Сен 2025"

        # Month 2: October 2025 (full)
        assert months[1][0] == date(2025, 10, 1)
        assert months[1][1] == date(2025, 10, 31)
        assert months[1][2] == "Окт 2025"

        # Month 3: November 2025 (incomplete, ends today)
        assert months[2][0] == date(2025, 11, 1)
        assert months[2][1] == date(2025, 11, 8)
        assert months[2][2] == "Ноя 2025"

    def test_12_months_for_year(self):
        """Test 12 rolling months for year period."""
        months = get_rolling_months(12, date(2025, 11, 8), include_incomplete=True)

        assert len(months) == 12

        # First month: December 2024
        assert months[0][0] == date(2024, 12, 1)
        assert months[0][1] == date(2024, 12, 31)
        assert months[0][2] == "Дек 2024"

        # Last month: November 2025 (incomplete)
        assert months[11][0] == date(2025, 11, 1)
        assert months[11][1] == date(2025, 11, 8)
        assert months[11][2] == "Ноя 2025"

    def test_single_month_complete(self):
        """Test single month complete (last day of month)."""
        months = get_rolling_months(1, date(2025, 10, 31), include_incomplete=True)

        assert len(months) == 1
        assert months[0][0] == date(2025, 10, 1)
        assert months[0][1] == date(2025, 10, 31)  # Full month
        assert months[0][2] == "Окт 2025"


@pytest.mark.unit
class TestGetProportionalBudget:
    """Test proportional budget calculation."""

    def test_7_days_from_30000(self):
        """Test 7 days from 30000 monthly budget."""
        result = get_proportional_budget(Decimal("30000"), 7, 30)
        assert result == Decimal("7000.00")

    def test_14_days_from_60000(self):
        """Test 14 days from 60000 monthly budget."""
        result = get_proportional_budget(Decimal("60000"), 14, 30)
        assert result == Decimal("28000.00")

    def test_1_day_from_30000(self):
        """Test 1 day from 30000 monthly budget."""
        result = get_proportional_budget(Decimal("30000"), 1, 30)
        assert result == Decimal("1000.00")

    def test_30_days_returns_full_budget(self):
        """Test 30 days returns full budget."""
        result = get_proportional_budget(Decimal("30000"), 30, 30)
        assert result == Decimal("30000.00")

    def test_rounding_to_2_decimals(self):
        """Test result is rounded to 2 decimal places."""
        result = get_proportional_budget(Decimal("10000"), 7, 30)
        # 10000 / 30 * 7 = 2333.333...
        assert result == Decimal("2333.33")

    def test_zero_days_in_month_raises_error(self):
        """Test zero days_in_month raises ValueError."""
        with pytest.raises(ValueError, match="days_in_month must be positive"):
            get_proportional_budget(Decimal("30000"), 7, 0)

    def test_negative_days_in_month_raises_error(self):
        """Test negative days_in_month raises ValueError."""
        with pytest.raises(ValueError, match="days_in_month must be positive"):
            get_proportional_budget(Decimal("30000"), 7, -1)


@pytest.mark.unit
class TestGetMonthNameShortRu:
    """Test Russian month name abbreviations."""

    def test_january(self):
        """Test January returns Янв."""
        assert get_month_name_short_ru(1) == "Янв"

    def test_november(self):
        """Test November returns Ноя."""
        assert get_month_name_short_ru(11) == "Ноя"

    def test_december(self):
        """Test December returns Дек."""
        assert get_month_name_short_ru(12) == "Дек"

    def test_invalid_month_0_raises_error(self):
        """Test month 0 raises ValueError."""
        with pytest.raises(ValueError, match="Invalid month: 0"):
            get_month_name_short_ru(0)

    def test_invalid_month_13_raises_error(self):
        """Test month 13 raises ValueError."""
        with pytest.raises(ValueError, match="Invalid month: 13"):
            get_month_name_short_ru(13)


@pytest.mark.unit
class TestGetQuarterBounds:
    """Test rolling quarter boundaries (3 months)."""

    def test_quarter_from_nov_8(self):
        """Test quarter from 2025-11-08 (Sep-Nov)."""
        start, end, label = get_quarter_bounds(date(2025, 11, 8))

        assert start == date(2025, 9, 1)  # September 1
        assert end == date(2025, 11, 8)   # Today (incomplete November)
        assert label == "Сен — Ноя 2025"

    def test_quarter_from_jan_15(self):
        """Test quarter from 2025-01-15 (Nov 2024 - Jan 2025)."""
        start, end, label = get_quarter_bounds(date(2025, 1, 15))

        assert start == date(2024, 11, 1)  # November 2024
        assert end == date(2025, 1, 15)    # Today (incomplete January)
        assert label == "Ноя — Янв 2025"

    def test_quarter_last_day_of_month(self):
        """Test quarter on last day of month (complete month)."""
        start, end, label = get_quarter_bounds(date(2025, 10, 31))

        assert start == date(2025, 8, 1)   # August 1
        assert end == date(2025, 10, 31)   # October 31 (complete)
        assert label == "Авг — Окт 2025"


@pytest.mark.unit
class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_leap_year_february(self):
        """Test February in leap year."""
        months = get_rolling_months(1, date(2024, 2, 29), include_incomplete=True)
        assert months[0][1] == date(2024, 2, 29)  # 29 days in Feb 2024

    def test_non_leap_year_february(self):
        """Test February in non-leap year."""
        months = get_rolling_months(1, date(2025, 2, 28), include_incomplete=True)
        assert months[0][1] == date(2025, 2, 28)  # 28 days in Feb 2025

    def test_year_boundary_week(self):
        """Test week spanning year boundary."""
        # 2024-12-30 is in ISO week 1 of 2025
        monday, sunday = get_week_bounds(date(2024, 12, 30))
        assert monday == date(2024, 12, 30)
        assert sunday == date(2025, 1, 5)

    def test_zero_budget(self):
        """Test proportional budget with zero budget."""
        result = get_proportional_budget(Decimal("0"), 7, 30)
        assert result == Decimal("0.00")
