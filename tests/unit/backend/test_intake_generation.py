"""Pure tests for schedule expansion + 'хватит на N' estimate."""
from datetime import date, datetime
from decimal import Decimal

from backend.app.services.medicine_schedule import (
    expand_schedule, intakes_per_day, estimate_stock,
)


def test_expand_daily_two_times():
    slots = expand_schedule(
        intake_times=["08:00", "20:00"], schedule_type="daily", schedule_config=None,
        start_date=date(2026, 6, 15), end_date=None,
        window_start=date(2026, 6, 15), window_end=date(2026, 6, 16),
    )
    assert datetime(2026, 6, 15, 8, 0) in slots
    assert datetime(2026, 6, 15, 20, 0) in slots
    assert datetime(2026, 6, 16, 8, 0) in slots
    assert len(slots) == 4  # 2 days × 2 times


def test_expand_every_n_days_skips():
    slots = expand_schedule(
        intake_times=["09:00"], schedule_type="every_n_days", schedule_config={"n": 2},
        start_date=date(2026, 6, 15), end_date=None,
        window_start=date(2026, 6, 15), window_end=date(2026, 6, 18),
    )
    days = sorted({s.date() for s in slots})
    assert days == [date(2026, 6, 15), date(2026, 6, 17)]  # every 2nd day from start


def test_expand_weekdays_filter():
    slots = expand_schedule(
        intake_times=["09:00"], schedule_type="weekdays", schedule_config={"days": ["mon", "wed"]},
        start_date=date(2026, 6, 15), end_date=None,        # 2026-06-15 is Monday
        window_start=date(2026, 6, 15), window_end=date(2026, 6, 21),
    )
    days = sorted({s.date() for s in slots})
    assert date(2026, 6, 15) in days   # Mon
    assert date(2026, 6, 17) in days   # Wed
    assert date(2026, 6, 16) not in days  # Tue excluded


def test_expand_respects_end_date_and_start():
    slots = expand_schedule(
        intake_times=["09:00"], schedule_type="daily", schedule_config=None,
        start_date=date(2026, 6, 16), end_date=date(2026, 6, 17),
        window_start=date(2026, 6, 15), window_end=date(2026, 6, 20),
    )
    days = sorted({s.date() for s in slots})
    assert days == [date(2026, 6, 16), date(2026, 6, 17)]


def test_intakes_per_day():
    assert intakes_per_day(["08:00", "20:00"], "daily", None) == 2.0
    assert intakes_per_day(["09:00"], "every_n_days", {"n": 2}) == 0.5
    assert intakes_per_day(["09:00", "21:00"], "weekdays", {"days": ["mon", "wed", "fri"]}) == 2 * 3 / 7


def test_estimate_stock():
    est = estimate_stock(remaining=Decimal("10"), dose_amount=Decimal("1"),
                         intake_times=["08:00", "20:00"], schedule_type="daily", schedule_config=None)
    assert est["intakes_left"] == 10
    assert est["days_left"] == 5         # 10 intakes / 2 per day
    assert est["in_stock"] is True

    est0 = estimate_stock(remaining=Decimal("0"), dose_amount=Decimal("1"),
                          intake_times=["08:00"], schedule_type="daily", schedule_config=None)
    assert est0["intakes_left"] == 0
    assert est0["in_stock"] is False
