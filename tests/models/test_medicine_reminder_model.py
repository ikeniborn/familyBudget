"""Unit tests for MedicineReminder model + mark helpers (no DB)."""
from datetime import datetime

from backend.app.models.medicine_reminder import MedicineReminder


def test_reminder_defaults():
    r = MedicineReminder(intake_log_id=1, recipient_user_id=2,
                         reminder_datetime=datetime(2026, 6, 15, 8, 0))
    assert r.status == "pending"
    assert r.telegram_sent is False
    assert r.web_push_sent is False
    assert r.retry_count == 0
    assert r.__tablename__ == "t_medicine_reminder"


def test_mark_sent_and_retry():
    r = MedicineReminder(intake_log_id=1, recipient_user_id=2,
                         reminder_datetime=datetime(2026, 6, 15, 8, 0))
    r.mark_sent()
    assert r.status == "sent"
    assert r.sent_at is not None

    r2 = MedicineReminder(intake_log_id=1, recipient_user_id=3,
                          reminder_datetime=datetime(2026, 6, 15, 8, 0))
    r2.increment_retry("boom")
    assert r2.retry_count == 1
    assert r2.error_message == "boom"
    # 3 failures → failed
    r2.increment_retry("again")
    r2.increment_retry("again2")
    assert r2.status == "failed"
