from datetime import date
from backend.app.utils.planning import get_planning_month


def test_before_20th_returns_current_month():
    assert get_planning_month(date(2026, 6, 15)) == date(2026, 6, 1)


def test_on_20th_returns_next_month():
    assert get_planning_month(date(2026, 6, 20)) == date(2026, 7, 1)


def test_after_20th_returns_next_month():
    assert get_planning_month(date(2026, 6, 28)) == date(2026, 7, 1)


def test_december_wraps_to_january():
    assert get_planning_month(date(2026, 12, 25)) == date(2027, 1, 1)


def test_no_arg_uses_today():
    result = get_planning_month()
    assert result.day == 1
