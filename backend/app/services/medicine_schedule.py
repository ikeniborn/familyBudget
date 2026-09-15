"""Pure scheduling helpers: expand a course schedule to datetime slots; estimate stock duration."""
import math
from datetime import date, datetime, time, timedelta
from decimal import Decimal

_WEEKDAY_INDEX = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


def _parse_time(hhmm: str) -> time:
    h, m = hhmm.split(":")
    return time(int(h), int(m))


def expand_schedule(
    *, intake_times: list[str], schedule_type: str, schedule_config: dict | None,
    start_date: date, end_date: date | None,
    window_start: date, window_end: date,
) -> list[datetime]:
    """Return all scheduled datetimes within [window_start, window_end] (inclusive of both
    dates) honoring course start/end and the schedule type. Naive datetimes."""
    lo = max(window_start, start_date)
    hi = window_end if end_date is None else min(window_end, end_date)
    if hi < lo:
        return []

    times = [_parse_time(t) for t in intake_times]
    slots: list[datetime] = []
    day = lo
    while day <= hi:
        if _day_active(day, schedule_type, schedule_config, start_date):
            for t in times:
                slots.append(datetime.combine(day, t))
        day += timedelta(days=1)
    return slots


def _day_active(day: date, schedule_type: str, schedule_config: dict | None, start_date: date) -> bool:
    if schedule_type == "daily":
        return True
    if schedule_type == "every_n_days":
        n = int((schedule_config or {}).get("n", 1)) or 1
        return (day - start_date).days % n == 0
    if schedule_type == "weekdays":
        allowed = {(_WEEKDAY_INDEX.get(d.lower())) for d in (schedule_config or {}).get("days", [])}
        return day.weekday() in allowed
    return False


def intakes_per_day(intake_times: list[str], schedule_type: str, schedule_config: dict | None) -> float:
    """Average intakes per calendar day for the schedule (used by the estimate)."""
    per_active = len(intake_times)
    if schedule_type == "daily":
        return float(per_active)
    if schedule_type == "every_n_days":
        n = int((schedule_config or {}).get("n", 1)) or 1
        return per_active / n
    if schedule_type == "weekdays":
        days = len((schedule_config or {}).get("days", []))
        return per_active * days / 7
    return float(per_active)


def estimate_stock(
    *, remaining: Decimal, dose_amount: Decimal,
    intake_times: list[str], schedule_type: str, schedule_config: dict | None,
) -> dict:
    """'Хватит на N приёмов/дней' read-only aggregate."""
    if dose_amount <= 0:
        return {"remaining": remaining, "intakes_left": 0, "days_left": None, "in_stock": remaining > 0}
    intakes_left = int(remaining // dose_amount)
    per_day = intakes_per_day(intake_times, schedule_type, schedule_config)
    days_left = math.floor(intakes_left / per_day) if per_day > 0 else None
    return {
        "remaining": remaining,
        "intakes_left": intakes_left,
        "days_left": days_left,
        "in_stock": remaining > 0,
    }
