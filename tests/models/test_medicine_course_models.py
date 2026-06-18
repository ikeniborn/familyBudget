"""Unit tests for Phase 2 medicine models (no DB)."""
from datetime import date, datetime
from decimal import Decimal

from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_intake_log import MedicineIntakeLog


def test_course_fields_and_defaults():
    c = MedicineCourse(
        medicine_id=1, patient_id=2, dose_amount=Decimal("1"), dose_unit="таблетка",
        intake_times=["08:00", "20:00"], start_date=date(2026, 6, 15),
        schedule_type="daily", creator_id=1,
    )
    assert c.intake_times == ["08:00", "20:00"]
    assert c.schedule_type == "daily"
    assert c.is_active is True
    assert c.reminders_enabled is True
    assert c.snooze_minutes == 30          # new field default
    assert c.notification_channels == ["telegram", "web_push"]
    assert c.__tablename__ == "t_f_medicine_course"


def test_intake_log_fields_and_defaults():
    log = MedicineIntakeLog(
        course_id=1, patient_id=2, scheduled_at=datetime(2026, 6, 15, 8, 0),
    )
    assert log.status == "scheduled"
    assert log.taken_at is None
    assert log.stock_id is None
    assert log.version == 1
    assert log.__tablename__ == "t_f_medicine_intake_log"
