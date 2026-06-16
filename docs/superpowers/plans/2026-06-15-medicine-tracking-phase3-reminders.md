---
review:
  plan_hash: d6acb1b3a2a64ae8
  spec_hash: 5354578b794e4c5c
  last_run: 2026-06-15
  phases:
    structure:     { status: passed }
    coverage:      { status: passed }
    dependencies:  { status: passed }
    verifiability: { status: passed }
    consistency:   { status: passed }
  findings:
    - id: F-001
      phase: dependencies
      severity: CRITICAL
      section: "## Task 4"
      section_hash: edb66112856a4bd7
      text: >-
        session.rollback() как idempotency-паттерн в create_reminders_for_intake (Task 3)
        и generate_for_course (Task 4) откатывает ВСЮ транзакцию, не savepoint. Первый же
        IntegrityError (дубль reminder при guardian==linked — decision #3, или дубль intake_log)
        стирает все ранее зафлашенные строки батча до финального commit. Fan-out dedup —
        целевая фича — триггерит баг. Нужен begin_nested()/SAVEPOINT или INSERT ... ON CONFLICT DO NOTHING.
      verdict: fixed
      verdict_at: 2026-06-15
      fix: >-
        Оба цикла переведены на `async with session.begin_nested()` (SAVEPOINT) per-row;
        дубль откатывается только до savepoint, батч сохраняется.
    - id: F-002
      phase: coverage
      severity: WARNING
      section: "## Task 3"
      section_hash: 8eec1def95e19750
      text: >-
        create_reminders_for_intake создаёт reminder-строки только по reminders_enabled,
        игнорируя notification_channels. Spec §224 — «по каналам из course.notification_channels».
        Курс с reminders_enabled=True и пустым notification_channels породит строки, которые
        всегда падают в send() и доходят до status=failed (retry_count=3).
      verdict: fixed
      verdict_at: 2026-06-15
      fix: >-
        Guard расширен: `if not course.reminders_enabled or not course.notification_channels: return 0`.
    - id: F-003
      phase: coverage
      severity: INFO
      section: "## Task 6"
      section_hash: c9b8ae51578462b7
      text: >-
        Web Push для expiry-алертов отнесён к Фазе 3 («Phase 1 deferral»), хотя spec
        Декомпозиция помещает expiry-alert в Фазу 1. Поведение совпадает со spec §230
        (telegram + web-push); расхождение только в размещении по фазам.
      verdict: fixed
      verdict_at: 2026-06-15
      fix: >-
        Добавлен spec-ref блок в Task 6: размещение в Фазе 3 намеренное (зависит от
        reminder-сервиса Task 3), закрывает web-push-половину spec §230.
    - id: F-004
      phase: dependencies
      severity: INFO
      section: "## Task 2"
      section_hash: 9d4333ea0e4ca227
      text: >-
        down_revision=m2b3c4d5e6f7 (Migration head before Phase 3) не верифицируем против
        плана Фазы 2 в рамках этой проверки. Подтвердить, что это head Фазы 2.
      verdict: fixed
      verdict_at: 2026-06-15
      fix: >-
        Верифицировано: phase2-courses.md revision=m2b3c4d5e6f7 — это head Фазы 2. Цепочка корректна.
chain:
  intent: null
  spec: docs/superpowers/specs/2026-06-15-medicine-tracking-design.md
---

# Medicine Tracking — Phase 3: Напоминания Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push a reminder for every scheduled intake to both the patient (if they have an account) and the guardian, with Telegram inline quick-actions (Принял / Пропустить / Отложить) and Web Push that opens `/medicines`; support snooze.

**Architecture:** Mirror `scheduled_reminder` + `reminder_service` + `send_plan_reminders_job`. New table `t_medicine_reminder` (one row per recipient per intake; `UNIQUE(intake_log_id, recipient_user_id)` dedupes guardian==linked). A new `MedicineReminderService` queries due reminders and sends Telegram (with inline buttons) + Web Push. A 5-minute dispatch job (`LOCK_ID_MEDICINE_DISPATCH = 1009`) drives it. Reminder rows are created during intake_log generation (Phase 2 hook). Telegram callbacks are handled by `bot/handlers/medicine.py` calling the backend API with the user's JWT.

**Tech Stack:** Same + python-telegram-bot 21.x (bot handlers), pywebpush (already used by `reminder_service`).

**Depends on:** Phases 1–2 merged. Migration head before Phase 3 is `m2b3c4d5e6f7`.

**Spec:** decisions #2 (snooze 30 min, overridable), #3 (fan-out patient+guardian), #5 (Telegram-only quick actions; Web Push click-to-open), «Получатели напоминаний», «Snooze», «Web Push payload», Scheduler `LOCK_ID_MEDICINE_DISPATCH = 1009`, Bot section.

---

## Conventions

Identical to Phases 1–2. Reminders:
- Repo root: `cd /home/ikeniborn/Documents/Project/familyBudget`.
- Naive datetime in SYSTEM_TIMEZONE; due check `now_local().replace(tzinfo=None)`.
- Telegram client: `from backend.app.services.telegram_auth import make_telegram_client`; API url `f"https://api.telegram.org/bot{token}"`.
- Web Push payload MUST set `data.url="/medicines"` and `data.type="medicine_reminder"` (NEVER `"sync_completed"`).

## File Structure (created/modified this phase)

| File | Responsibility |
|---|---|
| `backend/app/models/medicine_reminder.py` | `MedicineReminder` model + mark helpers |
| `backend/app/models/__init__.py` | register model |
| `backend/db/migrations/versions/20260615_m3c4d5e6f7a8_add_medicine_reminder.py` | reminder table |
| `backend/app/services/medicine_reminder_service.py` | fan-out create, get_due, send (TG buttons + push), snooze |
| `backend/app/services/medicine_intake_service.py` | generation hook → create reminders |
| `backend/app/api/v1/endpoints/medicine_courses.py` | `GET /medicine-intakes/{id}` + `POST /medicine-intakes/{id}/snooze` |
| `backend/app/scheduler.py` | `medicine_reminder_dispatch_job` (LOCK 1009, every 5 min) |
| `bot/handlers/medicine.py` | `/medicines`, `/taken`, `CallbackQueryHandler(^med:)` |
| `bot/bot.py` | register medicine handlers |
| `tests/models/test_medicine_reminder_model.py` | model + mark helpers |
| `tests/migrations/test_medicine_phase3_migration.py` | table + UNIQUE constraint |
| `tests/integration/backend/test_medicine_reminders.py` | fan-out, dedup, snooze, due query |

---

## Task 1: MedicineReminder model

**Files:**
- Create: `backend/app/models/medicine_reminder.py`
- Modify: `backend/app/models/__init__.py`
- Test: `tests/models/test_medicine_reminder_model.py`

- [ ] **Step 1: Write the failing model test**

Create `tests/models/test_medicine_reminder_model.py`:

```python
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/models/test_medicine_reminder_model.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/app/models/medicine_reminder.py`**

```python
"""Medicine reminder model — one push to one recipient for one intake (copy of scheduled_reminder)."""
from datetime import datetime

from sqlmodel import Field, SQLModel


class MedicineReminder(SQLModel, table=True):
    """A scheduled push for one intake_log to one recipient. UNIQUE(intake_log_id, recipient_user_id)."""

    __tablename__ = "t_medicine_reminder"

    id: int | None = Field(default=None, primary_key=True)
    intake_log_id: int = Field(foreign_key="t_f_medicine_intake_log.id", index=True, nullable=False)
    recipient_user_id: int = Field(foreign_key="t_d_user.id", nullable=False, description="Whom to notify")
    reminder_datetime: datetime = Field(nullable=False, index=True,
                                        description="When to send (naive, SYSTEM_TIMEZONE)")
    status: str = Field(default="pending", max_length=20, nullable=False,
                        description="pending/sent/failed/cancelled")
    sent_at: datetime | None = Field(default=None)
    telegram_sent: bool = Field(default=False)
    web_push_sent: bool = Field(default=False)
    error_message: str | None = Field(default=None, max_length=1000)
    retry_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    def can_retry(self) -> bool:
        return self.retry_count < 3

    def mark_sent(self) -> None:
        self.status = "sent"
        self.sent_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def mark_failed(self, error_message: str) -> None:
        self.status = "failed"
        self.error_message = error_message[:1000] if error_message else None
        self.updated_at = datetime.utcnow()

    def increment_retry(self, error_message: str) -> None:
        self.retry_count += 1
        self.error_message = error_message[:1000] if error_message else None
        self.updated_at = datetime.utcnow()
        if not self.can_retry():
            self.mark_failed(error_message)
```

- [ ] **Step 4: Register in `backend/app/models/__init__.py`**

Add import + `__all__` entry:

```python
from backend.app.models.medicine_reminder import MedicineReminder
```
```python
    "MedicineReminder",
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/models/test_medicine_reminder_model.py -v`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/medicine_reminder.py backend/app/models/__init__.py \
  tests/models/test_medicine_reminder_model.py
git commit -m "feat(medicine): phase3 model — t_medicine_reminder"
```

---

## Task 2: Migration (t_medicine_reminder)

**Files:**
- Create: `backend/db/migrations/versions/20260615_m3c4d5e6f7a8_add_medicine_reminder.py`
- Test: `tests/migrations/test_medicine_phase3_migration.py`

- [ ] **Step 1: Write the failing migration test**

Create `tests/migrations/test_medicine_phase3_migration.py`:

```python
"""Verify t_medicine_reminder + UNIQUE(intake_log_id, recipient_user_id)."""
import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_reminder_table_exists(db_session):
    rows = await db_session.execute(text(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
    assert "t_medicine_reminder" in {r[0] for r in rows}


@pytest.mark.asyncio
async def test_reminder_unique_recipient_per_intake(db_session):
    # minimal chain: medicine→member→course→intake
    await db_session.execute(text(
        "INSERT INTO t_d_medicine (id,name,form,prescription_required,is_active,creator_id) "
        "VALUES (9101,'X','tablet',false,true,1) ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_d_family_member (id,guardian_user_id,name) VALUES (9101,1,'T') ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_f_medicine_course (id,medicine_id,patient_id,dose_amount,dose_unit,intake_times,"
        "start_date,schedule_type,is_active,reminders_enabled,notification_channels,snooze_minutes,creator_id) "
        "VALUES (9101,9101,9101,1,'шт','[\"08:00\"]'::jsonb,'2026-06-15','daily',true,true,"
        "'[\"telegram\"]'::jsonb,30,1) ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_f_medicine_intake_log (id,course_id,patient_id,scheduled_at,status,version) "
        "VALUES (9101,9101,9101,'2026-06-16 08:00:00','scheduled',1) ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_medicine_reminder (intake_log_id,recipient_user_id,reminder_datetime,status) "
        "VALUES (9101,1,'2026-06-16 08:00:00','pending')"))
    with pytest.raises(Exception):
        await db_session.execute(text(
            "INSERT INTO t_medicine_reminder (intake_log_id,recipient_user_id,reminder_datetime,status) "
            "VALUES (9101,1,'2026-06-16 08:00:00','pending')"))
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd tests && ./run-tests.sh backend`
Expected: FAIL — table missing.

- [ ] **Step 3: Create the migration**

Create `backend/db/migrations/versions/20260615_m3c4d5e6f7a8_add_medicine_reminder.py`:

```python
"""add_medicine_reminder

Revision ID: m3c4d5e6f7a8
Revises: m2b3c4d5e6f7
Create Date: 2026-06-15 00:00:02.000000

Phase 3: t_medicine_reminder (one push per recipient per intake).
"""
from collections.abc import Sequence

from alembic import op


revision: str = "m3c4d5e6f7a8"
down_revision: str | None = "m2b3c4d5e6f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE t_medicine_reminder (
            id SERIAL PRIMARY KEY,
            intake_log_id INT NOT NULL REFERENCES t_f_medicine_intake_log(id) ON DELETE CASCADE,
            recipient_user_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            reminder_datetime TIMESTAMP NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','sent','failed','cancelled')),
            sent_at TIMESTAMP,
            telegram_sent BOOLEAN NOT NULL DEFAULT FALSE,
            web_push_sent BOOLEAN NOT NULL DEFAULT FALSE,
            error_message VARCHAR(1000),
            retry_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_medicine_reminder_recipient UNIQUE (intake_log_id, recipient_user_id)
        )
    """)
    op.execute("CREATE INDEX idx_medicine_reminder_intake ON t_medicine_reminder(intake_log_id)")
    op.execute("CREATE INDEX idx_medicine_reminder_datetime ON t_medicine_reminder(reminder_datetime)")
    op.execute("CREATE INDEX idx_medicine_reminder_pending ON t_medicine_reminder(status) WHERE status = 'pending'")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS t_medicine_reminder")
```

- [ ] **Step 4: Run the migration test to verify it passes**

Run: `cd tests && ./run-tests.sh backend`
Expected: PASS for `test_medicine_phase3_migration.py`.

- [ ] **Step 5: Commit**

```bash
git add backend/db/migrations/versions/20260615_m3c4d5e6f7a8_add_medicine_reminder.py \
  tests/migrations/test_medicine_phase3_migration.py
git commit -m "feat(medicine): phase3 migration — t_medicine_reminder"
```

---

## Task 3: MedicineReminderService

**Files:**
- Create: `backend/app/services/medicine_reminder_service.py`

- [ ] **Step 1: Create `backend/app/services/medicine_reminder_service.py`**

```python
"""Medicine reminder service: fan-out create, due query, send (Telegram buttons + Web Push), snooze.

Mirrors reminder_service.ReminderService. Reminder rows: one per (intake_log_id, recipient_user_id).
"""
import logging
from datetime import timedelta

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.core.config import Settings, get_settings
from backend.app.core.json_utils import dumps as json_dumps
from backend.app.models.family_member import FamilyMember
from backend.app.models.medicine import Medicine
from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_intake_log import MedicineIntakeLog
from backend.app.models.medicine_reminder import MedicineReminder
from backend.app.models.push_subscription import PushSubscription
from backend.app.models.user import User
from backend.app.services.telegram_auth import make_telegram_client
from backend.app.utils.timezone import now_local

logger = logging.getLogger(__name__)


def _now():
    return now_local().replace(tzinfo=None)


class MedicineReminderService:
    """Dispatch medicine intake reminders via Telegram (inline buttons) + Web Push."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.bot_token = self.settings.TELEGRAM_BOT_TOKEN
        self.telegram_api_url = f"https://api.telegram.org/bot{self.bot_token}"

    # ---------- fan-out ----------
    async def create_reminders_for_intake(
        self, session: AsyncSession, intake: MedicineIntakeLog, course: MedicineCourse,
        patient: FamilyMember,
    ) -> int:
        """Create pending reminders for guardian + linked patient (dedup via UNIQUE). Returns count created."""
        if not course.reminders_enabled or not course.notification_channels:
            return 0  # no channels → send() would never deliver (spec §224: «по каналам»)
        recipients = {patient.guardian_user_id}
        if patient.linked_user_id:
            recipients.add(patient.linked_user_id)
        created = 0
        for uid in recipients:
            try:
                async with session.begin_nested():  # SAVEPOINT: a dup rolls back only this row
                    session.add(MedicineReminder(
                        intake_log_id=intake.id, recipient_user_id=uid,
                        reminder_datetime=intake.scheduled_at, status="pending"))
                created += 1
            except IntegrityError:
                pass  # already exists for this (intake, recipient) — dedup (decision #3)
        return created

    # ---------- due query ----------
    async def get_due(self, session: AsyncSession, batch_size: int = 100) -> list[MedicineReminder]:
        now = _now()
        rows = await session.execute(
            select(MedicineReminder)
            .where(MedicineReminder.status == "pending",
                   MedicineReminder.reminder_datetime <= now)
            .order_by(MedicineReminder.reminder_datetime)
            .limit(batch_size))
        return list(rows.scalars().all())

    # ---------- send ----------
    async def send(self, session: AsyncSession, reminder: MedicineReminder) -> tuple[bool, bool]:
        intake = await session.get(MedicineIntakeLog, reminder.intake_log_id)
        if not intake:
            reminder.mark_failed("intake not found")
            await session.commit()
            return False, False
        course = await session.get(MedicineCourse, intake.course_id)
        medicine = await session.get(Medicine, course.medicine_id) if course else None
        patient = await session.get(FamilyMember, intake.patient_id)
        user = await session.get(User, reminder.recipient_user_id)
        if not (course and medicine and patient and user):
            reminder.mark_failed("missing related rows")
            await session.commit()
            return False, False

        channels = course.notification_channels or []
        time_str = intake.scheduled_at.strftime("%H:%M")
        food = {"before": "до еды", "with": "во время еды", "after": "после еды", "any": ""}.get(course.with_food or "", "")
        message = (
            f"💊 Пора принять: {medicine.name}\n"
            f"👤 {patient.name}  ⏰ {time_str}\n"
            f"{course.dose_amount} {course.dose_unit} {food}".rstrip()
        )

        telegram_sent = False
        if "telegram" in channels and user.telegram_id and getattr(user, "enable_telegram_notifications", True):
            telegram_sent = await self._send_telegram(
                user.telegram_id, message, intake.id, course.snooze_minutes)
            reminder.telegram_sent = telegram_sent

        web_push_sent = False
        if "web_push" in channels and getattr(user, "enable_push_notifications", True):
            web_push_sent = await self._send_web_push(
                session, user.id, title=f"💊 {medicine.name}", body=message)
            reminder.web_push_sent = web_push_sent

        if telegram_sent or web_push_sent:
            reminder.mark_sent()
        else:
            reminder.increment_retry("all channels failed")
        await session.commit()
        return telegram_sent, web_push_sent

    async def _send_telegram(self, telegram_id: int, message: str, log_id: int, snooze_minutes: int) -> bool:
        """Send with inline quick-action buttons (decision #5: Telegram only)."""
        reply_markup = {"inline_keyboard": [[
            {"text": "✅ Принял", "callback_data": f"med:take:{log_id}"},
            {"text": "⏭ Пропустить", "callback_data": f"med:skip:{log_id}"},
            {"text": f"🕐 Отложить {snooze_minutes} мин", "callback_data": f"med:snooze:{log_id}"},
        ]]}
        try:
            async with make_telegram_client() as client:
                resp = await client.post(
                    f"{self.telegram_api_url}/sendMessage",
                    json={"chat_id": telegram_id, "text": message, "reply_markup": reply_markup},
                    timeout=10.0)
                resp.raise_for_status()
                return True
        except httpx.HTTPError as e:
            logger.error("[MED_REMINDER] Telegram send failed to %s: %s", telegram_id, e)
            return False

    async def _send_web_push(self, session: AsyncSession, user_id: int, title: str, body: str) -> bool:
        """Web Push: clicking opens /medicines (no action buttons — decision #5)."""
        if not self.settings.VAPID_PUBLIC_KEY or "PLACEHOLDER" in (self.settings.VAPID_PUBLIC_KEY or ""):
            return False
        subs = (await session.execute(
            select(PushSubscription).where(PushSubscription.user_id == user_id))).scalars().all()
        if not subs:
            return False
        try:
            from pywebpush import WebPushException, webpush
        except ImportError:
            logger.warning("[MED_REMINDER] pywebpush not installed")
            return False
        payload = json_dumps({
            "title": title, "body": body,
            "icon": "/static/icons/icon-192.png", "badge": "/static/icons/icon-192.png",
            "tag": "medicine-reminder",
            "data": {"type": "medicine_reminder", "url": "/medicines"},
        })
        sent = 0
        expired = []
        for sub in subs:
            try:
                webpush(
                    subscription_info={"endpoint": sub.endpoint,
                                       "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key}},
                    data=payload, vapid_private_key=self.settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": f"mailto:{self.settings.VAPID_CONTACT_EMAIL or 'admin@example.com'}"})
                sent += 1
            except WebPushException as e:
                if e.response and e.response.status_code == 410:
                    expired.append(sub)
            except Exception as e:  # noqa: BLE001
                logger.error("[MED_REMINDER] webpush error: %s", e)
        for sub in expired:
            await session.delete(sub)
        return sent > 0

    # ---------- snooze ----------
    async def snooze(self, session: AsyncSession, intake_id: int, recipient_user_id: int) -> MedicineReminder:
        """Mark the recipient's current reminder sent, create a new one at now + course.snooze_minutes."""
        intake = await session.get(MedicineIntakeLog, intake_id)
        course = await session.get(MedicineCourse, intake.course_id) if intake else None
        snooze_minutes = course.snooze_minutes if course else 30

        existing = (await session.execute(
            select(MedicineReminder).where(
                MedicineReminder.intake_log_id == intake_id,
                MedicineReminder.recipient_user_id == recipient_user_id,
                MedicineReminder.status == "pending"))).scalars().all()
        for r in existing:
            r.mark_sent()
            session.add(r)

        new = MedicineReminder(
            intake_log_id=intake_id, recipient_user_id=recipient_user_id,
            reminder_datetime=_now() + timedelta(minutes=snooze_minutes), status="pending")
        session.add(new)
        try:
            await session.commit()
        except IntegrityError:
            # A sent row already occupies (intake, recipient) UNIQUE → reuse it by resetting to pending.
            await session.rollback()
            row = (await session.execute(
                select(MedicineReminder).where(
                    MedicineReminder.intake_log_id == intake_id,
                    MedicineReminder.recipient_user_id == recipient_user_id))).scalar_one()
            row.status = "pending"
            row.reminder_datetime = _now() + timedelta(minutes=snooze_minutes)
            row.sent_at = None
            session.add(row)
            await session.commit()
            return row
        await session.refresh(new)
        return new
```

> **UNIQUE caveat:** `UNIQUE(intake_log_id, recipient_user_id)` means at most one row per recipient per intake. Snooze therefore *reuses/repoints* the existing row (the `IntegrityError` branch) rather than inserting a duplicate. The first send-then-snooze creates the second pending occurrence by resetting the sent row to pending — correct for "remind me again in N minutes".

- [ ] **Step 2: Verify import**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "from backend.app.services.medicine_reminder_service import MedicineReminderService; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/medicine_reminder_service.py
git commit -m "feat(medicine): phase3 reminder service — fan-out, send (TG buttons + push), snooze"
```

---

## Task 4: Hook reminder creation into generation + add intake GET/snooze endpoints

**Files:**
- Modify: `backend/app/services/medicine_intake_service.py`
- Modify: `backend/app/api/v1/endpoints/medicine_courses.py`

- [ ] **Step 1: Update `generate_for_course` in `medicine_intake_service.py`**

Add imports at the top of `medicine_intake_service.py`:

```python
from backend.app.models.family_member import FamilyMember
from backend.app.services.medicine_reminder_service import MedicineReminderService
```

Replace `generate_for_course` so it creates reminders for each new intake (when the course has reminders enabled):

```python
async def generate_for_course(session: AsyncSession, course: MedicineCourse,
                              window_start: date, window_end: date) -> int:
    """Insert intake_log rows for [window_start, window_end] + fan-out reminders.

    Idempotent: UNIQUE(course_id, scheduled_at) skips existing logs;
    UNIQUE(intake_log_id, recipient_user_id) skips existing reminders.
    """
    slots = expand_schedule(
        intake_times=course.intake_times, schedule_type=course.schedule_type,
        schedule_config=course.schedule_config, start_date=course.start_date,
        end_date=course.end_date, window_start=window_start, window_end=window_end)
    patient = await session.get(FamilyMember, course.patient_id)
    reminder_svc = MedicineReminderService()
    created = 0
    for slot in slots:
        log = MedicineIntakeLog(course_id=course.id, patient_id=course.patient_id, scheduled_at=slot)
        try:
            async with session.begin_nested():  # SAVEPOINT: a dup rolls back only this row, not the batch
                session.add(log)  # flush on savepoint release surfaces UNIQUE conflict; log.id populated
        except IntegrityError:
            continue  # row already exists → skip (and its reminders too)
        created += 1
        if patient:
            await reminder_svc.create_reminders_for_intake(session, log, course, patient)
    await session.commit()
    return created
```

- [ ] **Step 2: Add `GET /medicine-intakes/{id}` and `POST /medicine-intakes/{id}/snooze` to `medicine_courses.py`**

Add the reminder-service import near the top:

```python
from backend.app.services.medicine_reminder_service import MedicineReminderService
```

Add these endpoints to the `intakes_router` section:

```python
@intakes_router.get("/{intake_id}", response_model=IntakeResponse)
async def get_intake(
    intake_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> IntakeResponse:
    intake = await medicine_intake_service.get_intake(session, intake_id)
    if not intake:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Intake {intake_id} not found")
    return IntakeResponse.model_validate(intake)


@intakes_router.post("/{intake_id}/snooze", response_model=IntakeResponse)
async def snooze_intake(
    intake_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> IntakeResponse:
    intake = await medicine_intake_service.get_intake(session, intake_id)
    if not intake:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Intake {intake_id} not found")
    await MedicineReminderService().snooze(session, intake_id, current_user.id)
    return IntakeResponse.model_validate(intake)  # intake status unchanged; a new reminder was scheduled
```

- [ ] **Step 3: Verify imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "from backend.app.api.v1.router import api_router; import backend.app.services.medicine_intake_service; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/medicine_intake_service.py backend/app/api/v1/endpoints/medicine_courses.py
git commit -m "feat(medicine): phase3 — reminders on generation + intake GET/snooze endpoints"
```

---

## Task 5: Dispatch job (every 5 min)

**Files:**
- Modify: `backend/app/scheduler.py`

- [ ] **Step 1: Add `medicine_reminder_dispatch_job` in `backend/app/scheduler.py`**

Add the job function (the `LOCK_ID_MEDICINE_DISPATCH = 1009` constant already exists from Phase 1):

```python
async def medicine_reminder_dispatch_job():
    """Send due medicine reminders (Telegram + Web Push). Every 5 minutes. Mirror of send_plan_reminders_job."""
    logger.info("[SCHEDULER] Starting medicine reminder dispatch job")
    try:
        async with advisory_xact_lock(LOCK_ID_MEDICINE_DISPATCH) as acquired:
            if not acquired:
                logger.info("[SCHEDULER] Medicine reminder dispatch skipped - another worker is executing")
                return
            from backend.app.services.medicine_reminder_service import MedicineReminderService
            async with get_session_context() as session:
                svc = MedicineReminderService()
                due = await svc.get_due(session, batch_size=100)
                if not due:
                    logger.debug("[SCHEDULER] No due medicine reminders")
                    return
                sent = 0
                for reminder in due:
                    tg, wp = await svc.send(session, reminder)
                    if tg or wp:
                        sent += 1
                logger.info("[SCHEDULER] Medicine reminders: %s/%s sent", sent, len(due))
    except Exception as e:
        logger.error("[SCHEDULER] Error in medicine reminder dispatch job: %s", e, exc_info=True)
        raise
```

Register it inside `init_scheduler()` (after the medicine maintenance job):

```python
    # Job 9: Medicine reminder dispatch (every 5 minutes)
    scheduler.add_job(
        medicine_reminder_dispatch_job,
        trigger=CronTrigger(minute="*/5"),
        id="medicine_reminder_dispatch",
        name="Medicine Reminder Dispatch (Telegram + Web Push)",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Registered job: medicine_reminder_dispatch (every 5 minutes)")
```

- [ ] **Step 2: Verify scheduler imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.scheduler; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/scheduler.py
git commit -m "feat(medicine): phase3 dispatch job (LOCK 1009, every 5 min)"
```

---

## Task 6: Web Push for expiry alerts (complete the Phase 1 deferral)

**Files:**
- Modify: `backend/app/services/medicine_alert_service.py`

> **Spec ref:** §«Алерты по сроку годности» требует expiry-пуш telegram **+** web-push. Фаза 1 отгрузила telegram-only; эта задача закрывает web-push-половину, переиспользуя `_send_web_push` из Task 3. Размещение в Фазе 3 намеренное (зависит от reminder-сервиса).

- [ ] **Step 1: Add Web Push to expiry alerts**

Update `send_expiry_alerts` in `medicine_alert_service.py` to also push to each active user via the reminder service's `_send_web_push` (so the expiry alert opens `/medicines` with `data.type="medicine_expiry"`). Add a per-user web push call:

```python
async def send_expiry_alerts(session: AsyncSession, settings) -> int:
    """Send a broadcast expiry alert via Telegram + Web Push to all active users. Returns Telegram count."""
    items = await get_expiring_stock(session)
    message = format_expiry_message(items)
    if not message:
        return 0
    from backend.app.services.medicine_reminder_service import MedicineReminderService
    svc = NotificationService(settings)
    push_svc = MedicineReminderService(settings)
    users = await svc.get_active_users(session)
    sent = 0
    for u in users:
        if u.telegram_id and getattr(u, "enable_telegram_notifications", True):
            if await svc.send_telegram_message(telegram_id=u.telegram_id, message=message):
                sent += 1
        if getattr(u, "enable_push_notifications", True):
            await push_svc._send_web_push_expiry(session, u.id, "💊 Срок годности", message)
    logger.info("[MEDICINE] Expiry alert sent: telegram=%s users", sent)
    return sent
```

Add the expiry-specific push helper to `MedicineReminderService` (in `medicine_reminder_service.py`), a copy of `_send_web_push` with `data.type="medicine_expiry"`:

```python
    async def _send_web_push_expiry(self, session: AsyncSession, user_id: int, title: str, body: str) -> bool:
        """Like _send_web_push but data.type='medicine_expiry'. Clicking opens /medicines."""
        if not self.settings.VAPID_PUBLIC_KEY or "PLACEHOLDER" in (self.settings.VAPID_PUBLIC_KEY or ""):
            return False
        subs = (await session.execute(
            select(PushSubscription).where(PushSubscription.user_id == user_id))).scalars().all()
        if not subs:
            return False
        try:
            from pywebpush import WebPushException, webpush
        except ImportError:
            return False
        payload = json_dumps({
            "title": title, "body": body,
            "icon": "/static/icons/icon-192.png", "badge": "/static/icons/icon-192.png",
            "tag": "medicine-expiry",
            "data": {"type": "medicine_expiry", "url": "/medicines"},
        })
        sent = 0
        for sub in subs:
            try:
                webpush(
                    subscription_info={"endpoint": sub.endpoint,
                                       "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key}},
                    data=payload, vapid_private_key=self.settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": f"mailto:{self.settings.VAPID_CONTACT_EMAIL or 'admin@example.com'}"})
                sent += 1
            except WebPushException:
                pass
            except Exception as e:  # noqa: BLE001
                logger.error("[MED_EXPIRY] webpush error: %s", e)
        return sent > 0
```

- [ ] **Step 2: Verify import**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.services.medicine_alert_service; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/medicine_alert_service.py backend/app/services/medicine_reminder_service.py
git commit -m "feat(medicine): phase3 — web push for expiry alerts (data.type=medicine_expiry)"
```

---

## Task 7: Bot handlers (/medicines, /taken, callbacks)

**Files:**
- Create: `bot/handlers/medicine.py`
- Modify: `bot/bot.py`

The bot acts on behalf of the recipient user using their JWT (from `SessionManager`, set on `/start` login), calling the backend API. Inspect `bot/handlers/today.py` and `bot/handlers/start.py` for the exact `SessionManager`/`api_client`/`get_webapp_url` imports and reuse them verbatim — the skeleton below uses the names those handlers use.

- [ ] **Step 1: Create `bot/handlers/medicine.py`**

```python
"""Medicine bot handlers: open Web App, quick /taken, inline med: callbacks."""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes

from bot.handlers.start import get_webapp_url
from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager

logger = get_logger(__name__)


async def medicine_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/medicines — open the medicines Web App."""
    user = update.effective_user
    if not user:
        return
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text("❌ Требуется авторизация.\n\nИспользуйте /start для входа.")
        return
    # Reuse the WebApp base, point at the medicines dashboard.
    base = get_webapp_url().rsplit("/", 1)[0]  # strip '/index.html'
    url = f"{base}/index.html#/medicines"  # WebApp shell; deep route handled client-side
    kb = InlineKeyboardMarkup([[InlineKeyboardButton("💊 Открыть аптечку", web_app=WebAppInfo(url=url))]])
    await update.message.reply_text("Открыть управление лекарствами:", reply_markup=kb)


async def taken_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/taken — mark the nearest scheduled intake today as taken."""
    user = update.effective_user
    if not user or not SessionManager.is_authenticated(context):
        await update.message.reply_text("❌ Требуется авторизация. /start")
        return
    token = SessionManager.get_access_token(context)
    api = await get_api_client()
    data = await api.get("/api/v1/medicine-intakes", token=token, params={"date": "today"})
    pending = [i for i in data.get("intakes", []) if i["status"] in ("scheduled", "late")]
    if not pending:
        await update.message.reply_text("Нет запланированных приёмов на сегодня ✅")
        return
    nearest = pending[0]  # list is ordered by scheduled_at asc
    await api.post(f"/api/v1/medicine-intakes/{nearest['id']}/take", token=token,
                   json={"version": nearest["version"]})
    await update.message.reply_text(f"✅ Отмечено: {nearest['medicine_name']} ({nearest['scheduled_at'][11:16]})")


async def medicine_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle med:take/skip/snooze:{log_id} inline buttons."""
    query = update.callback_query
    await query.answer()
    if not SessionManager.is_authenticated(context):
        await query.edit_message_text("❌ Сессия истекла. /start")
        return
    try:
        _, action, log_id_str = query.data.split(":", 2)
        log_id = int(log_id_str)
    except (ValueError, IndexError):
        return
    token = SessionManager.get_access_token(context)
    api = await get_api_client()
    try:
        if action == "snooze":
            await api.post(f"/api/v1/medicine-intakes/{log_id}/snooze", token=token, json={})
            await query.edit_message_text("🕐 Отложено")
            return
        # take / skip need the current version
        intake = await api.get(f"/api/v1/medicine-intakes/{log_id}", token=token)
        await api.post(f"/api/v1/medicine-intakes/{log_id}/{action}", token=token,
                       json={"version": intake["version"]})
        await query.edit_message_text("✅ Принято" if action == "take" else "⏭ Пропущено")
    except Exception as e:  # noqa: BLE001
        logger.error("med callback %s failed: %s", query.data, e)
        await query.edit_message_text("⚠️ Не удалось обработать. Откройте приложение: /medicines")
```

> If `api_client.post` does not accept a `json=` kwarg, match its real signature (inspect `bot/utils/api_client.py`). If `get_webapp_url` is not importable from `start.py`, build the base URL the same way `start.py` does (`settings.DOMAIN`).

- [ ] **Step 2: Register handlers in `bot/bot.py`**

In `register_handlers()` add the import and registrations (after the existing command handlers):

```python
        from bot.handlers.medicine import medicine_handler, taken_handler, medicine_callback

        self.application.add_handler(CommandHandler("medicines", medicine_handler))
        logger.info("Registered /medicines handler")
        self.application.add_handler(CommandHandler("taken", taken_handler))
        logger.info("Registered /taken handler")
        self.application.add_handler(CallbackQueryHandler(medicine_callback, pattern="^med:"))
        logger.info("Registered medicine callback handler")
```

(`CallbackQueryHandler` and `CommandHandler` are already imported in `bot.py`; if not, add `from telegram.ext import CallbackQueryHandler, CommandHandler`.)

- [ ] **Step 3: Verify bot imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import ast; ast.parse(open('bot/handlers/medicine.py').read()); print('syntax ok')"`
Expected: prints `syntax ok`. (Full bot import may require bot env; syntax check is the gate here. Validate the live bot starts in staging.)

- [ ] **Step 4: Commit**

```bash
git add bot/handlers/medicine.py bot/bot.py
git commit -m "feat(medicine): phase3 bot — /medicines, /taken, med: callbacks"
```

---

## Task 8: Integration tests (fan-out, dedup, due, snooze)

**Files:**
- Test: `tests/integration/backend/test_medicine_reminders.py`

Reuse `async_client`/`auth_headers`/`db_session` fixtures. The current logged-in user is the guardian (course creator's family member guardian defaults to current user).

- [ ] **Step 1: Write the integration test**

```python
"""Integration tests for Phase 3: reminder fan-out, dedup, due query, snooze."""
import pytest
from sqlalchemy import text

from backend.app.services.medicine_reminder_service import MedicineReminderService


async def _course_with_reminders(client, headers):
    r = await client.post("/api/v1/medicines", headers=headers, json={"name": "Рем", "form": "tablet"})
    mid = r.json()["id"]
    r = await client.post("/api/v1/family-members", headers=headers, json={"name": "Маша"})
    pid = r.json()["id"]
    r = await client.post("/api/v1/medicine-courses", headers=headers, json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00"], "start_date": "2026-06-15", "schedule_type": "daily",
        "reminders_enabled": True, "notification_channels": ["telegram"]})
    return r.json()["id"], pid


@pytest.mark.asyncio
async def test_generation_creates_reminders(async_client, auth_headers, db_session):
    cid, pid = await _course_with_reminders(async_client, auth_headers)
    # At least one reminder exists for an intake of this course
    count = (await db_session.execute(text("""
        SELECT COUNT(*) FROM t_medicine_reminder r
        JOIN t_f_medicine_intake_log l ON l.id = r.intake_log_id
        WHERE l.course_id = :cid
    """), {"cid": cid})).scalar_one()
    assert count >= 1


@pytest.mark.asyncio
async def test_due_query_picks_past_pending(async_client, auth_headers, db_session):
    cid, pid = await _course_with_reminders(async_client, auth_headers)
    # Force a reminder into the past
    await db_session.execute(text("""
        UPDATE t_medicine_reminder SET reminder_datetime = '2000-01-01 00:00:00', status='pending'
        WHERE intake_log_id IN (SELECT id FROM t_f_medicine_intake_log WHERE course_id = :cid)
    """), {"cid": cid})
    await db_session.commit()
    svc = MedicineReminderService()
    due = await svc.get_due(db_session)
    assert len(due) >= 1


@pytest.mark.asyncio
async def test_snooze_creates_future_pending(async_client, auth_headers, db_session):
    cid, pid = await _course_with_reminders(async_client, auth_headers)
    intake_id = (await db_session.execute(text(
        "SELECT id FROM t_f_medicine_intake_log WHERE course_id=:cid ORDER BY scheduled_at LIMIT 1"
    ), {"cid": cid})).scalar_one()
    r = await async_client.post(f"/api/v1/medicine-intakes/{intake_id}/snooze", headers=auth_headers)
    assert r.status_code == 200
    pending = (await db_session.execute(text(
        "SELECT COUNT(*) FROM t_medicine_reminder WHERE intake_log_id=:iid AND status='pending'"
    ), {"iid": intake_id})).scalar_one()
    assert pending >= 1
```

> Fan-out dedup (guardian == linked patient → one row) is covered by the DB `UNIQUE` constraint test in Task 2; to assert it at the service level, set the family member's `linked_user_id` equal to its `guardian_user_id` and re-run generation, then assert exactly one reminder row per intake. Add this assertion if the linked-user path is exercised.

- [ ] **Step 2: Run integration tests**

Run: `cd tests && ./run-tests.sh backend`
Expected: PASS for `test_medicine_reminders.py`.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/backend/test_medicine_reminders.py
git commit -m "test(medicine): phase3 reminder fan-out + snooze integration tests"
```

---

## Task 9: Verify + docs

- [ ] **Step 1: Full backend suite**

Run: `cd tests && ./run-tests.sh backend`
Expected: green.

- [ ] **Step 2: Manual staging smoke**

Deploy to dev (`https://fbd.ikeniborn.ru`). With a course that has a due intake:
- the 5-min dispatch sends a Telegram message with three inline buttons;
- ✅/⏭ buttons mark the intake (verify status flips on `/medicines`);
- 🕐 snooze schedules a new reminder ~`snooze_minutes` later (label shows the actual interval);
- Web Push notification click opens `/medicines` (not `/facts`).

- [ ] **Step 3: Update docs**

Append `t_medicine_reminder`, the dispatch job (`LOCK 1009`), fan-out + dedup, snooze, and the bot commands to `lat.md/database.md`, `lat.md/realtime.md`, `lat.md/bot.md`.

- [ ] **Step 4: Commit**

```bash
git add lat.md/database.md lat.md/realtime.md lat.md/bot.md
git commit -m "docs(medicine): phase3 — reminders + bot index entries"
```

---

## Phase 3 Done — Definition

- `t_medicine_reminder` migrated with `UNIQUE(intake_log_id, recipient_user_id)`.
- Generation fans out a reminder to guardian + linked patient; duplicates collapse via UNIQUE (decision #3).
- 5-minute dispatch job sends Telegram (with ✅/⏭/🕐 inline buttons) + Web Push.
- Snooze creates a new pending reminder at `now + course.snooze_minutes` (default 30, per-course override — decision #2); button label shows the real interval.
- Web Push uses `data.type="medicine_reminder"`/`"medicine_expiry"` + `data.url="/medicines"`; click opens dashboard (decision #5).
- Bot `/medicines`, `/taken`, and `med:` callbacks work end-to-end via the backend API.

**Next:** Phase 4 (`2026-06-15-medicine-tracking-phase4-deduction.md`) — stock deduction on take (FIFO / FOR UPDATE), auto-add to shopping_list, purchase analytics.
