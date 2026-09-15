"""Slice M1: schedule_config must be present and well-formed for non-daily schedules.

Without this validation a course created as every_n_days/weekdays with no config
silently generates zero intakes (_day_active yields an empty weekday set).
"""
import pytest
from pydantic import ValidationError

from backend.app.schemas.medicine_course import MedicineCourseCreate

BASE = {
    "medicine_id": 1, "patient_id": 1, "dose_amount": "1", "dose_unit": "шт",
    "intake_times": ["08:00"], "start_date": "2026-06-15",
}


def _create(**overrides):
    return MedicineCourseCreate(**{**BASE, **overrides})


def test_daily_needs_no_config():
    c = _create(schedule_type="daily")
    assert c.schedule_config is None


def test_every_n_days_without_config_rejected():
    with pytest.raises(ValidationError, match="schedule_config"):
        _create(schedule_type="every_n_days")


def test_every_n_days_requires_positive_int_n():
    with pytest.raises(ValidationError, match="n"):
        _create(schedule_type="every_n_days", schedule_config={"n": 0})
    with pytest.raises(ValidationError, match="n"):
        _create(schedule_type="every_n_days", schedule_config={"days": ["mon"]})
    c = _create(schedule_type="every_n_days", schedule_config={"n": 2})
    assert c.schedule_config == {"n": 2}


def test_weekdays_without_config_rejected():
    with pytest.raises(ValidationError, match="schedule_config"):
        _create(schedule_type="weekdays")


def test_weekdays_requires_valid_nonempty_days():
    with pytest.raises(ValidationError, match="days"):
        _create(schedule_type="weekdays", schedule_config={"days": []})
    with pytest.raises(ValidationError, match="days"):
        _create(schedule_type="weekdays", schedule_config={"days": ["mon", "xyz"]})
    c = _create(schedule_type="weekdays", schedule_config={"days": ["Mon", "wed"]})
    assert c.schedule_config == {"days": ["mon", "wed"]}
