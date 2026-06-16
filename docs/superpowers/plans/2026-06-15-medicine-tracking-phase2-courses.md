---
review:
  plan_hash: 77aac66394f4fd2d
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
      phase: coverage
      severity: CRITICAL
      section: "## Task 7: API endpoints"
      section_hash: 20d6dcfac1df6abd
      text: "lazy-backfill отсутствует. Спека (строки 227, 337) требует «при открытии дашборда сервис догенеривает пропущенные дни». Архитектура плана (строка 7) обещает «dashboard does lazy-backfill on open», но ни один шаг этого не реализует: list_intakes (Task 5/7) только читает, loadDashboard (Task 10) только GET."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "Task 7 list_intakes endpoint вызывает generate_all(session) при on_date in (None,'today') перед чтением; generate_all идемпотентен. DoD + smoke обновлены."
    - id: F-002
      phase: coverage
      severity: WARNING
      section: "## Task 10: Frontend"
      section_hash: 5c3ec056eb71cc5a
      text: "Форма создания/редактирования курса с селектором лекарства (решение #6) отсутствует во фронтенде. Спека (197, 303, 336) требует селектор каталога с пометкой in-stock + кнопка «добавить в аптечку» + предупреждение. Task 10 даёт только dashboard/list/detail; курсы создаются только через API/импорт (строка 1792)."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "Task 10: добавлены openCourseForm/createCourseFromForm/updateStockHint + dialog в medicines_courses.html. Селектор помечает/поднимает in-stock; пустой остаток → предупреждение + «добавить в аптечку», создание не блокируется."
    - id: F-003
      phase: verifiability
      severity: WARNING
      section: "## Task 10: Frontend"
      section_hash: 5c3ec056eb71cc5a
      text: "Страница карточки курса не реализована. Task 10 step 5 создаёт шаблон medicines_course_detail.html + web-route, DoD (строка 1793) и smoke утверждают «card + journal load», но loadCourseDetail описан только прозой-заметкой (строка 1727) без шага/кода. Страница останется на «Загрузка…»."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "Task 10 step 1: loadCourseDetail + renderJournal реализованы; step 2 авто-вызов на DOMContentLoaded по meta[name=course-id]; list_intakes получил фильтр course_id (Task 5/7)."
    - id: F-004
      phase: consistency
      severity: WARNING
      section: "## Task 5: Course + intake services"
      section_hash: 52a2f41bf610a96a
      text: "generate_for_course: flush-per-row + session.rollback() при IntegrityError откатывает ВСЮ транзакцию (все pending-строки текущего вызова), а счётчик created переоценивает. Идемпотентность (спека 225) и частичная догенерация окна хрупкие; интеграционный тест Task 9 проверяет только свежую генерацию, баг не ловится."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "generate_for_course переписан: pre-filter существующих slot'ов + INSERT … ON CONFLICT DO NOTHING, без per-row rollback; точный возврат len(new_slots). Unused IntegrityError import убран. Добавлен тест test_generation_idempotent (Task 9)."
    - id: F-005
      phase: consistency
      severity: INFO
      section: "## Task 8: Maintenance job"
      section_hash: e8f618ddb01792bc
      text: "Спека (строка 292) говорит, что Фаза 2 в (а) генерит «intake_log+reminder»; план откладывает reminder в Фазу 3 (заметка строка 1005). План корректно разрешает внутреннее противоречие спеки (таблица t_medicine_reminder создаётся в Фазе 3, строка 341). Действий не требуется."
      verdict: accepted
      verdict_at: 2026-06-15
      resolution: "Поведение плана верно (reminder-таблица — Фаза 3). Расхождение со спекой — дефект спеки, не плана. Изменений нет."
    - id: F-006
      phase: verifiability
      severity: INFO
      section: "## Task 3: Schemas"
      section_hash: f8141411ce66158c
      text: "Task 3 (схемы) не имеет собственного шага проверки; верификация откладывается на Task 5 step 5 (import check). Минор."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "Task 3: добавлен Step 3 (import-check схем), commit стал Step 4."
chain:
  intent: null
  spec: docs/superpowers/specs/2026-06-15-medicine-tracking-design.md
---

# Medicine Tracking — Phase 2: Курсы Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assign medicine courses to family members, auto-generate the intake schedule (intake_log) 7 days ahead, mark intakes taken/skipped with conflict handling, and show a «Сегодня надо принять» dashboard with a remaining-stock estimate («хватит на N»).

**Architecture:** Course = Header (mirrors `shopping_list`); intake_log = generated rows (one per scheduled dose). A nightly maintenance job (extending Phase 1's `medicine_maintenance_job`) generates intake_log + flips overdue rows `scheduled→late`. The dashboard does lazy-backfill on open. Soft link to stock (decision #6): course references the catalog `medicine_id`; no hard block when no stock exists. Remaining estimate is a read-only aggregate.

**Tech Stack:** Same as Phase 1 (FastAPI · SQLModel · PostgreSQL · APScheduler · Vite IIFE · Jinja2/HTMX/DaisyUI · pytest).

**Depends on:** Phase 1 (`2026-06-15-medicine-tracking-phase1-stock.md`) merged. Migration head before Phase 2 is `m1a2b3c4d5e6`.

**Spec:** `docs/superpowers/specs/2026-06-15-medicine-tracking-design.md` (decisions #6, #7; «Генерация intake_log»; «Отметка приёма и конкурентность»).

---

## Conventions

Identical to Phase 1. Key reminders:
- Repo root: `cd /home/ikeniborn/Documents/Project/familyBudget`.
- Pure tests: `PYTHONPATH=. backend/.venv/bin/pytest <path> -v`. DB/integration: `cd tests && ./run-tests.sh backend`.
- Naive `datetime` in SYSTEM_TIMEZONE; "now" = `now_local().replace(tzinfo=None)`.
- JSON columns use `sa_column=Column(JSON)` in models, `JSONB` in migration.
- `intake_times` are `"HH:MM"` strings in SYSTEM_TIMEZONE; frequency-per-day = `len(intake_times)`.

## File Structure (created/modified this phase)

| File | Responsibility |
|---|---|
| `backend/app/models/medicine_course.py` | `MedicineCourse` model |
| `backend/app/models/medicine_intake_log.py` | `MedicineIntakeLog` model |
| `backend/app/models/__init__.py` | register 2 models |
| `backend/db/migrations/versions/20260615_m2b3c4d5e6f7_add_medicine_phase2_tables.py` | course + intake_log tables |
| `backend/app/schemas/medicine_course.py` | course schemas |
| `backend/app/schemas/medicine_intake.py` | intake_log schemas |
| `backend/app/services/medicine_course_service.py` | course CRUD + pause/complete + remaining estimate |
| `backend/app/services/medicine_intake_service.py` | generation, list, take/skip (status only) |
| `backend/app/services/medicine_service.py` | extend `has_active_links` to count courses |
| `backend/app/services/family_member_service.py` | extend `has_active_links` to count courses |
| `backend/app/api/v1/endpoints/budget_ws.py` | add `medicine_course_changed`, `medicine_intake_marked` |
| `backend/app/api/v1/endpoints/medicine_courses.py` | courses + intakes routers |
| `backend/app/api/v1/endpoints/__init__.py` | export routers |
| `backend/app/api/v1/router.py` | include routers |
| `backend/app/scheduler.py` | maintenance job adds generation + scheduled→late |
| `backend/app/api/web/router.py` | `/medicines` dashboard + `/medicines/courses` + `/medicines/courses/{id}` |
| `frontend/web/templates/medicines_dashboard.html` | today dashboard |
| `frontend/web/templates/medicines_courses.html` | course list |
| `frontend/web/templates/medicines_course_detail.html` | course card + journal |
| `frontend/web/static/js/medicines/medicinesManager.ts` | extend with courses + dashboard |
| `frontend/web/static/js/medicines-bundle.ts` | export new functions |
| `tests/models/test_medicine_course_models.py` | model tests |
| `tests/migrations/test_medicine_phase2_migration.py` | table/constraint tests |
| `tests/unit/backend/test_intake_generation.py` | schedule expansion + estimate (pure) |
| `tests/integration/backend/test_medicine_courses_api.py` | course/intake API |

---

## Task 1: Course + intake_log models

**Files:**
- Create: `backend/app/models/medicine_course.py`
- Create: `backend/app/models/medicine_intake_log.py`
- Modify: `backend/app/models/__init__.py`
- Test: `tests/models/test_medicine_course_models.py`

- [ ] **Step 1: Write the failing model test**

Create `tests/models/test_medicine_course_models.py`:

```python
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/models/test_medicine_course_models.py -v`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `backend/app/models/medicine_course.py`**

```python
"""Medicine course model — an intake plan assigned to a family member."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON
from sqlmodel import Column, Field, SQLModel


class MedicineCourse(SQLModel, table=True):
    """A course of a medicine for one patient (family member)."""

    __tablename__ = "t_f_medicine_course"

    id: int | None = Field(default=None, primary_key=True)
    medicine_id: int = Field(foreign_key="t_d_medicine.id", index=True, nullable=False)
    patient_id: int = Field(foreign_key="t_d_family_member.id", index=True, nullable=False,
                            description="Who the course is for")
    prescribed_by: str | None = Field(default=None, max_length=255, description="Doctor / self")
    dose_amount: Decimal = Field(max_digits=10, decimal_places=3, nullable=False, description="Per intake")
    dose_unit: str = Field(nullable=False, max_length=50)
    intake_times: list[str] = Field(
        sa_column=Column(JSON, nullable=False),
        description='["08:00","14:00","20:00"] in SYSTEM_TIMEZONE; frequency = len(intake_times)',
    )
    with_food: str | None = Field(default=None, max_length=10, description="before/with/after/any")
    start_date: date = Field(nullable=False)
    end_date: date | None = Field(default=None, description="NULL = ongoing")
    schedule_type: str = Field(default="daily", nullable=False, max_length=20,
                               description="daily/every_n_days/weekdays")
    schedule_config: dict | None = Field(
        default=None, sa_column=Column(JSON, nullable=True),
        description='{"n":2} or {"days":["mon","wed","fri"]}',
    )
    is_active: bool = Field(default=True, nullable=False, index=True)
    reminders_enabled: bool = Field(default=True, nullable=False)
    notification_channels: list[str] = Field(
        default_factory=lambda: ["telegram", "web_push"],
        sa_column=Column(JSON, nullable=False),
    )
    snooze_minutes: int = Field(default=30, nullable=False, description="Per-course snooze override")
    comment: str | None = Field(default=None)
    deleted_at: datetime | None = Field(default=None, index=True, description="Soft delete (completed course)")
    creator_id: int = Field(foreign_key="t_d_user.id", index=True, nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
```

- [ ] **Step 4: Create `backend/app/models/medicine_intake_log.py`**

```python
"""Medicine intake log — one row per scheduled dose."""
from datetime import datetime
from decimal import Decimal

from sqlmodel import Field, SQLModel


class MedicineIntakeLog(SQLModel, table=True):
    """A single scheduled (and possibly taken/skipped) dose. Generated by the maintenance job."""

    __tablename__ = "t_f_medicine_intake_log"

    id: int | None = Field(default=None, primary_key=True)
    course_id: int = Field(foreign_key="t_f_medicine_course.id", index=True, nullable=False)
    patient_id: int = Field(foreign_key="t_d_family_member.id", index=True, nullable=False,
                            description="Denormalized for (patient_id, scheduled_at) filter without join")
    scheduled_at: datetime = Field(nullable=False, description="Planned time (naive, SYSTEM_TIMEZONE)")
    taken_at: datetime | None = Field(default=None, description="Actual intake time (NULL = not marked)")
    status: str = Field(default="scheduled", nullable=False, max_length=20,
                        description="scheduled/taken/skipped/late")
    dose_taken: Decimal | None = Field(default=None, max_digits=10, decimal_places=3)
    stock_id: int | None = Field(default=None, foreign_key="t_f_medicine_stock.id",
                                 description="Package the dose was deducted from (Phase 4)")
    comment: str | None = Field(default=None)
    marked_by: int | None = Field(default=None, foreign_key="t_d_user.id",
                                  description="Who marked it (parent for a child)")
    version: int = Field(default=1, nullable=False, description="Optimistic locking for concurrent marks")
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
```

- [ ] **Step 5: Register in `backend/app/models/__init__.py`**

Add imports near the other medicine imports:

```python
from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_intake_log import MedicineIntakeLog
```

Add to `__all__`:

```python
    "MedicineCourse",
    "MedicineIntakeLog",
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/models/test_medicine_course_models.py -v`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/medicine_course.py backend/app/models/medicine_intake_log.py \
  backend/app/models/__init__.py tests/models/test_medicine_course_models.py
git commit -m "feat(medicine): phase2 models — course + intake_log"
```

---

## Task 2: Migration (course + intake_log)

**Files:**
- Create: `backend/db/migrations/versions/20260615_m2b3c4d5e6f7_add_medicine_phase2_tables.py`
- Test: `tests/migrations/test_medicine_phase2_migration.py`

- [ ] **Step 1: Write the failing migration test**

Create `tests/migrations/test_medicine_phase2_migration.py`:

```python
"""Verify Phase 2 medicine tables + UNIQUE(course_id, scheduled_at)."""
import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_phase2_tables_exist(db_session):
    rows = await db_session.execute(text(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    ))
    names = {r[0] for r in rows}
    assert {"t_f_medicine_course", "t_f_medicine_intake_log"} <= names


@pytest.mark.asyncio
async def test_intake_log_unique_course_scheduled(db_session):
    # Seed a user, member, medicine, course
    await db_session.execute(text(
        "INSERT INTO t_d_medicine (id, name, form, prescription_required, is_active, creator_id) "
        "VALUES (9001, 'X', 'tablet', false, true, 1) ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_d_family_member (id, guardian_user_id, name) "
        "VALUES (9001, 1, 'Test') ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_f_medicine_course (id, medicine_id, patient_id, dose_amount, dose_unit, "
        "intake_times, start_date, schedule_type, is_active, reminders_enabled, "
        "notification_channels, snooze_minutes, creator_id) "
        "VALUES (9001, 9001, 9001, 1, 'шт', '[\"08:00\"]'::jsonb, '2026-06-15', 'daily', true, true, "
        "'[\"telegram\"]'::jsonb, 30, 1) ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_f_medicine_intake_log (course_id, patient_id, scheduled_at, status, version) "
        "VALUES (9001, 9001, '2026-06-16 08:00:00', 'scheduled', 1)"))
    with pytest.raises(Exception):  # UNIQUE(course_id, scheduled_at)
        await db_session.execute(text(
            "INSERT INTO t_f_medicine_intake_log (course_id, patient_id, scheduled_at, status, version) "
            "VALUES (9001, 9001, '2026-06-16 08:00:00', 'scheduled', 1)"))
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd tests && ./run-tests.sh backend`
Expected: FAIL — tables missing.

- [ ] **Step 3: Create the migration**

Create `backend/db/migrations/versions/20260615_m2b3c4d5e6f7_add_medicine_phase2_tables.py`:

```python
"""add_medicine_phase2_tables

Revision ID: m2b3c4d5e6f7
Revises: m1a2b3c4d5e6
Create Date: 2026-06-15 00:00:01.000000

Phase 2: medicine courses + intake_log (generated schedule).
"""
from collections.abc import Sequence

from alembic import op


revision: str = "m2b3c4d5e6f7"
down_revision: str | None = "m1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE t_f_medicine_course (
            id SERIAL PRIMARY KEY,
            medicine_id INT NOT NULL REFERENCES t_d_medicine(id) ON DELETE RESTRICT,
            patient_id INT NOT NULL REFERENCES t_d_family_member(id) ON DELETE RESTRICT,
            prescribed_by VARCHAR(255),
            dose_amount NUMERIC(10, 3) NOT NULL,
            dose_unit VARCHAR(50) NOT NULL,
            intake_times JSONB NOT NULL,
            with_food VARCHAR(10) CHECK (with_food IS NULL OR with_food IN ('before','with','after','any')),
            start_date DATE NOT NULL,
            end_date DATE,
            schedule_type VARCHAR(20) NOT NULL DEFAULT 'daily'
                CHECK (schedule_type IN ('daily','every_n_days','weekdays')),
            schedule_config JSONB,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            notification_channels JSONB NOT NULL DEFAULT '["telegram","web_push"]'::jsonb,
            snooze_minutes INT NOT NULL DEFAULT 30,
            comment TEXT,
            deleted_at TIMESTAMP,
            creator_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX idx_medicine_course_medicine_id ON t_f_medicine_course(medicine_id)")
    op.execute("CREATE INDEX idx_medicine_course_patient_id ON t_f_medicine_course(patient_id)")
    op.execute("CREATE INDEX idx_medicine_course_active ON t_f_medicine_course(is_active) WHERE is_active = TRUE")
    op.execute("CREATE INDEX idx_medicine_course_alive ON t_f_medicine_course(deleted_at) WHERE deleted_at IS NULL")

    op.execute("""
        CREATE TABLE t_f_medicine_intake_log (
            id SERIAL PRIMARY KEY,
            course_id INT NOT NULL REFERENCES t_f_medicine_course(id) ON DELETE CASCADE,
            patient_id INT NOT NULL REFERENCES t_d_family_member(id) ON DELETE RESTRICT,
            scheduled_at TIMESTAMP NOT NULL,
            taken_at TIMESTAMP,
            status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','taken','skipped','late')),
            dose_taken NUMERIC(10, 3),
            stock_id INT REFERENCES t_f_medicine_stock(id) ON DELETE SET NULL,
            comment TEXT,
            marked_by INT REFERENCES t_d_user(id) ON DELETE SET NULL,
            version INT NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_intake_course_scheduled UNIQUE (course_id, scheduled_at)
        )
    """)
    op.execute("CREATE INDEX idx_intake_patient_scheduled ON t_f_medicine_intake_log(patient_id, scheduled_at)")
    op.execute("CREATE INDEX idx_intake_course_scheduled ON t_f_medicine_intake_log(course_id, scheduled_at)")
    op.execute("CREATE INDEX idx_intake_status ON t_f_medicine_intake_log(status)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS t_f_medicine_intake_log")
    op.execute("DROP TABLE IF EXISTS t_f_medicine_course")
```

- [ ] **Step 4: Run the migration test to verify it passes**

Run: `cd tests && ./run-tests.sh backend`
Expected: PASS for `test_medicine_phase2_migration.py`.

- [ ] **Step 5: Commit**

```bash
git add backend/db/migrations/versions/20260615_m2b3c4d5e6f7_add_medicine_phase2_tables.py \
  tests/migrations/test_medicine_phase2_migration.py
git commit -m "feat(medicine): phase2 migration — course + intake_log"
```

---

## Task 3: Schemas (course + intake)

**Files:**
- Create: `backend/app/schemas/medicine_course.py`
- Create: `backend/app/schemas/medicine_intake.py`

- [ ] **Step 1: Create `backend/app/schemas/medicine_course.py`**

```python
"""Pydantic schemas for medicine courses."""
import re
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

VALID_SCHEDULE = {"daily", "every_n_days", "weekdays"}
VALID_FOOD = {"before", "with", "after", "any"}
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class MedicineCourseCreate(BaseModel):
    medicine_id: int
    patient_id: int
    dose_amount: Decimal = Field(..., gt=0)
    dose_unit: str = Field(..., max_length=50, min_length=1)
    intake_times: list[str] = Field(..., min_length=1)
    start_date: date
    prescribed_by: str | None = Field(default=None, max_length=255)
    with_food: str | None = Field(default=None)
    end_date: date | None = Field(default=None)
    duration_days: int | None = Field(default=None, ge=1,
        description="If given (and end_date omitted) → end_date computed server-side")
    schedule_type: str = Field(default="daily")
    schedule_config: dict | None = Field(default=None)
    reminders_enabled: bool = Field(default=True)
    notification_channels: list[str] = Field(default_factory=lambda: ["telegram", "web_push"])
    snooze_minutes: int = Field(default=30, ge=1, le=720)
    comment: str | None = Field(default=None)

    @field_validator("intake_times")
    @classmethod
    def times_valid(cls, v: list[str]) -> list[str]:
        for t in v:
            if not _TIME_RE.match(t):
                raise ValueError(f"intake_times entries must be 'HH:MM'; got {t!r}")
        return v

    @field_validator("schedule_type")
    @classmethod
    def schedule_valid(cls, v: str) -> str:
        if v not in VALID_SCHEDULE:
            raise ValueError(f"schedule_type must be one of {sorted(VALID_SCHEDULE)}")
        return v

    @field_validator("with_food")
    @classmethod
    def food_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_FOOD:
            raise ValueError(f"with_food must be one of {sorted(VALID_FOOD)}")
        return v


class MedicineCourseUpdate(BaseModel):
    dose_amount: Decimal | None = Field(default=None, gt=0)
    dose_unit: str | None = Field(default=None, max_length=50, min_length=1)
    intake_times: list[str] | None = Field(default=None, min_length=1)
    prescribed_by: str | None = Field(default=None, max_length=255)
    with_food: str | None = Field(default=None)
    end_date: date | None = Field(default=None)
    schedule_type: str | None = Field(default=None)
    schedule_config: dict | None = Field(default=None)
    reminders_enabled: bool | None = Field(default=None)
    notification_channels: list[str] | None = Field(default=None)
    snooze_minutes: int | None = Field(default=None, ge=1, le=720)
    comment: str | None = Field(default=None)

    @field_validator("intake_times")
    @classmethod
    def times_valid(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        for t in v:
            if not _TIME_RE.match(t):
                raise ValueError(f"intake_times entries must be 'HH:MM'; got {t!r}")
        return v

    @field_validator("schedule_type")
    @classmethod
    def schedule_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_SCHEDULE:
            raise ValueError(f"schedule_type must be one of {sorted(VALID_SCHEDULE)}")
        return v


class StockEstimate(BaseModel):
    """Read-only aggregate: remaining stock and how long it lasts for this course."""
    remaining: Decimal
    intakes_left: int
    days_left: int | None
    in_stock: bool


class MedicineCourseResponse(BaseModel):
    id: int
    medicine_id: int
    patient_id: int
    prescribed_by: str | None
    dose_amount: Decimal
    dose_unit: str
    intake_times: list[str]
    with_food: str | None
    start_date: date
    end_date: date | None
    schedule_type: str
    schedule_config: dict | None
    is_active: bool
    reminders_enabled: bool
    notification_channels: list[str]
    snooze_minutes: int
    comment: str | None
    deleted_at: datetime | None
    creator_id: int
    created_at: datetime
    updated_at: datetime
    estimate: StockEstimate | None = None  # populated on detail/list when requested

    model_config = {"from_attributes": True}


class MedicineCourseListResponse(BaseModel):
    courses: list[MedicineCourseResponse]
    total: int
    limit: int
    offset: int
```

- [ ] **Step 2: Create `backend/app/schemas/medicine_intake.py`**

```python
"""Pydantic schemas for intake_log marking."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class IntakeMarkRequest(BaseModel):
    """take/skip body. version is required for optimistic locking (409 on mismatch)."""
    version: int = Field(..., ge=1)
    dose_taken: Decimal | None = Field(default=None, gt=0)
    comment: str | None = Field(default=None)


class IntakeResponse(BaseModel):
    id: int
    course_id: int
    patient_id: int
    scheduled_at: datetime
    taken_at: datetime | None
    status: str
    dose_taken: Decimal | None
    stock_id: int | None
    comment: str | None
    marked_by: int | None
    version: int

    model_config = {"from_attributes": True}


class IntakeListItem(IntakeResponse):
    """Intake plus denormalized display fields for the dashboard."""
    medicine_name: str
    patient_name: str
    dose_amount: Decimal
    dose_unit: str
    with_food: str | None


class IntakeListResponse(BaseModel):
    intakes: list[IntakeListItem]
    total: int
```

- [ ] **Step 3: Verify schemas import**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.schemas.medicine_course, backend.app.schemas.medicine_intake; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/medicine_course.py backend/app/schemas/medicine_intake.py
git commit -m "feat(medicine): phase2 schemas — course + intake"
```

---

## Task 4: Generation + estimate logic (pure, unit-tested)

**Files:**
- Create: `backend/app/services/medicine_schedule.py` (pure helpers — schedule expansion + estimate)
- Test: `tests/unit/backend/test_intake_generation.py`

Pure functions are isolated here so the date math is unit-tested without a DB.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/backend/test_intake_generation.py`:

```python
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend/test_intake_generation.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/app/services/medicine_schedule.py`**

```python
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
```

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend/test_intake_generation.py -v`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/medicine_schedule.py tests/unit/backend/test_intake_generation.py
git commit -m "feat(medicine): phase2 pure schedule + estimate helpers"
```

---

## Task 5: Course + intake services

**Files:**
- Create: `backend/app/services/medicine_course_service.py`
- Create: `backend/app/services/medicine_intake_service.py`
- Modify: `backend/app/services/medicine_service.py` (extend `has_active_links`)
- Modify: `backend/app/services/family_member_service.py` (extend `has_active_links`)

- [ ] **Step 1: Create `backend/app/services/medicine_course_service.py`**

```python
"""Medicine course service: CRUD + pause/complete + remaining-stock estimate (decision #6/#7)."""
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import func, select

from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_stock import MedicineStock
from backend.app.services.medicine_schedule import estimate_stock
from backend.app.utils.timezone import now_local


def _now():
    return now_local().replace(tzinfo=None)


async def list_courses(session: AsyncSession, *, active_only: bool, patient_id: int | None,
                       limit: int, offset: int) -> tuple[list[MedicineCourse], int]:
    stmt = select(MedicineCourse).where(MedicineCourse.deleted_at.is_(None))
    count_stmt = select(func.count()).select_from(MedicineCourse).where(MedicineCourse.deleted_at.is_(None))
    if active_only:
        stmt = stmt.where(MedicineCourse.is_active == True)  # noqa: E712
        count_stmt = count_stmt.where(MedicineCourse.is_active == True)  # noqa: E712
    if patient_id is not None:
        stmt = stmt.where(MedicineCourse.patient_id == patient_id)
        count_stmt = count_stmt.where(MedicineCourse.patient_id == patient_id)
    total = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(MedicineCourse.created_at.desc()).limit(limit).offset(offset)
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows), total


async def get_course(session: AsyncSession, course_id: int) -> MedicineCourse | None:
    return (await session.execute(
        select(MedicineCourse).where(
            MedicineCourse.id == course_id, MedicineCourse.deleted_at.is_(None))
    )).scalar_one_or_none()


async def create_course(session: AsyncSession, data: dict, user_id: int) -> MedicineCourse:
    data = dict(data)
    duration = data.pop("duration_days", None)
    if data.get("end_date") is None and duration:
        data["end_date"] = data["start_date"] + timedelta(days=duration - 1)
    course = MedicineCourse(creator_id=user_id, **data)
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def update_course(session: AsyncSession, course: MedicineCourse, data: dict) -> MedicineCourse:
    for k, v in data.items():
        if v is not None:
            setattr(course, k, v)
    course.updated_at = _now()
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def pause_course(session: AsyncSession, course: MedicineCourse) -> MedicineCourse:
    course.is_active = False
    course.updated_at = _now()
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def complete_course(session: AsyncSession, course: MedicineCourse) -> MedicineCourse:
    """Mark finished: deactivate + soft-delete (decision: completed courses are soft-deleted)."""
    course.is_active = False
    course.deleted_at = _now()
    course.updated_at = _now()
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def aggregate_remaining(session: AsyncSession, medicine_id: int) -> Decimal:
    """Σ stock.quantity_remaining for the medicine across active packages."""
    total = (await session.execute(
        select(func.coalesce(func.sum(MedicineStock.quantity_remaining), 0)).where(
            MedicineStock.medicine_id == medicine_id,
            MedicineStock.deleted_at.is_(None),
            MedicineStock.quantity_remaining > 0,
        )
    )).scalar_one()
    return Decimal(str(total))


async def course_estimate(session: AsyncSession, course: MedicineCourse) -> dict:
    remaining = await aggregate_remaining(session, course.medicine_id)
    return estimate_stock(
        remaining=remaining, dose_amount=course.dose_amount,
        intake_times=course.intake_times, schedule_type=course.schedule_type,
        schedule_config=course.schedule_config)
```

- [ ] **Step 2: Create `backend/app/services/medicine_intake_service.py`**

```python
"""Intake service: generate intake_log + reminders-stub, list, take/skip (status only this phase)."""
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_intake_log import MedicineIntakeLog
from backend.app.services.medicine_schedule import expand_schedule
from backend.app.utils.timezone import now_local

GENERATION_HORIZON_DAYS = 7


class IntakeVersionConflict(Exception):
    """Raised when take/skip is attempted with a stale version (→ HTTP 409)."""


def _now():
    return now_local().replace(tzinfo=None)


async def generate_for_course(session: AsyncSession, course: MedicineCourse,
                              window_start: date, window_end: date) -> int:
    """Insert intake_log rows for [window_start, window_end]. Idempotent and concurrency-safe:
    pre-filters slots that already exist, and INSERT ... ON CONFLICT DO NOTHING on
    UNIQUE(course_id, scheduled_at) is the backstop against a race with another worker.
    Returns the number of new rows. No per-row rollback (a single rollback would discard the
    whole batch)."""
    slots = expand_schedule(
        intake_times=course.intake_times, schedule_type=course.schedule_type,
        schedule_config=course.schedule_config, start_date=course.start_date,
        end_date=course.end_date, window_start=window_start, window_end=window_end)
    if not slots:
        return 0
    existing = set((await session.execute(
        select(MedicineIntakeLog.scheduled_at).where(
            MedicineIntakeLog.course_id == course.id,
            MedicineIntakeLog.scheduled_at.in_(slots),
        )
    )).scalars().all())
    new_slots = [s for s in slots if s not in existing]
    if not new_slots:
        return 0
    now = _now()
    await session.execute(text("""
        INSERT INTO t_f_medicine_intake_log
            (course_id, patient_id, scheduled_at, status, version, created_at, updated_at)
        VALUES (:cid, :pid, :ts, 'scheduled', 1, :now, :now)
        ON CONFLICT (course_id, scheduled_at) DO NOTHING
    """), [{"cid": course.id, "pid": course.patient_id, "ts": s, "now": now} for s in new_slots])
    await session.commit()
    return len(new_slots)


async def generate_all(session: AsyncSession, *, horizon_days: int = GENERATION_HORIZON_DAYS) -> int:
    """Generate intake_log `horizon_days` ahead for every active, non-deleted course."""
    today = _now().date()
    window_end = today + timedelta(days=horizon_days)
    courses = (await session.execute(
        select(MedicineCourse).where(
            MedicineCourse.is_active == True,  # noqa: E712
            MedicineCourse.deleted_at.is_(None))
    )).scalars().all()
    total = 0
    for course in courses:
        total += await generate_for_course(session, course, today, window_end)
    return total


async def mark_overdue_late(session: AsyncSession) -> int:
    """scheduled → late when scheduled_at < now - 24h. Returns rows updated."""
    cutoff = _now() - timedelta(hours=24)
    result = await session.execute(text("""
        UPDATE t_f_medicine_intake_log
        SET status='late', updated_at=:now
        WHERE status='scheduled' AND scheduled_at < :cutoff
    """), {"cutoff": cutoff, "now": _now()})
    await session.commit()
    return result.rowcount or 0


async def list_intakes(session: AsyncSession, *, on_date: date | None, patient_id: int | None,
                       course_id: int | None = None):
    """Return intake rows joined to medicine + member names for dashboard / course-journal rendering."""
    clauses = ["1=1"]
    params: dict = {}
    if on_date is not None:
        clauses.append("l.scheduled_at >= :day_start AND l.scheduled_at < :day_end")
        params["day_start"] = f"{on_date} 00:00:00"
        params["day_end"] = f"{on_date + timedelta(days=1)} 00:00:00"
    if patient_id is not None:
        clauses.append("l.patient_id = :pid")
        params["pid"] = patient_id
    if course_id is not None:
        clauses.append("l.course_id = :cid")
        params["cid"] = course_id
    where = " AND ".join(clauses)
    rows = await session.execute(text(f"""
        SELECT l.id, l.course_id, l.patient_id, l.scheduled_at, l.taken_at, l.status,
               l.dose_taken, l.stock_id, l.comment, l.marked_by, l.version,
               m.name AS medicine_name, fm.name AS patient_name,
               c.dose_amount, c.dose_unit, c.with_food
        FROM t_f_medicine_intake_log l
        JOIN t_f_medicine_course c ON c.id = l.course_id
        JOIN t_d_medicine m ON m.id = c.medicine_id
        JOIN t_d_family_member fm ON fm.id = l.patient_id
        WHERE {where}
        ORDER BY l.scheduled_at ASC
    """), params)
    return [dict(r._mapping) for r in rows]


async def get_intake(session: AsyncSession, intake_id: int) -> MedicineIntakeLog | None:
    return (await session.execute(
        select(MedicineIntakeLog).where(MedicineIntakeLog.id == intake_id)
    )).scalar_one_or_none()


async def mark_intake(session: AsyncSession, intake: MedicineIntakeLog, *, status: str,
                      expected_version: int, user_id: int,
                      dose_taken=None, comment: str | None = None) -> MedicineIntakeLog:
    """Set status to 'taken' or 'skipped' with optimistic locking. Raises IntakeVersionConflict on mismatch.

    Phase 2 marks status only; Phase 4 adds stock deduction inside the 'taken' branch.
    """
    if intake.version != expected_version:
        raise IntakeVersionConflict()
    intake.status = status
    intake.marked_by = user_id
    intake.version += 1
    intake.updated_at = _now()
    if status == "taken":
        intake.taken_at = _now()
        if dose_taken is not None:
            intake.dose_taken = dose_taken
    if comment is not None:
        intake.comment = comment
    session.add(intake)
    await session.commit()
    await session.refresh(intake)
    return intake
```

> **Reminders:** Phase 2 generates intake_log only. Creating `t_medicine_reminder` rows during generation is Phase 3 — `generate_for_course` gets a hook there. This keeps Phase 2 shippable without the reminder table.

- [ ] **Step 3: Extend `has_active_links` in `backend/app/services/medicine_service.py`**

Replace the Phase 1 `has_active_links` body with a version that also counts active courses. Add the import at the top:

```python
from backend.app.models.medicine_course import MedicineCourse
```

Replace the function:

```python
async def has_active_links(session: AsyncSession, medicine_id: int) -> bool:
    """True if any non-deleted stock OR course references this medicine (blocks hard delete/archive)."""
    stock = (await session.execute(
        select(func.count()).select_from(MedicineStock).where(
            MedicineStock.medicine_id == medicine_id,
            MedicineStock.deleted_at.is_(None),
        )
    )).scalar_one()
    courses = (await session.execute(
        select(func.count()).select_from(MedicineCourse).where(
            MedicineCourse.medicine_id == medicine_id,
            MedicineCourse.deleted_at.is_(None),
        )
    )).scalar_one()
    return (stock + courses) > 0
```

- [ ] **Step 4: Extend `has_active_links` in `backend/app/services/family_member_service.py`**

Add import:

```python
from sqlmodel import func, select
from backend.app.models.medicine_course import MedicineCourse
```

(adjust the existing `from sqlmodel import select` line to include `func`). Replace the function:

```python
async def has_active_links(session: AsyncSession, member_id: int) -> bool:
    """True if the member has any non-deleted course (blocks delete)."""
    courses = (await session.execute(
        select(func.count()).select_from(MedicineCourse).where(
            MedicineCourse.patient_id == member_id,
            MedicineCourse.deleted_at.is_(None),
        )
    )).scalar_one()
    return courses > 0
```

- [ ] **Step 5: Verify imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.services.medicine_course_service, backend.app.services.medicine_intake_service, backend.app.services.medicine_service, backend.app.services.family_member_service; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/medicine_course_service.py backend/app/services/medicine_intake_service.py \
  backend/app/services/medicine_service.py backend/app/services/family_member_service.py
git commit -m "feat(medicine): phase2 services — course, intake generation, link guards"
```

---

## Task 6: WebSocket events for course + intake

**Files:**
- Modify: `backend/app/api/v1/endpoints/budget_ws.py`

- [ ] **Step 1: Extend the wrapper in `budget_ws.py`**

Add two helpers after `broadcast_medicine_changed`:

```python
async def broadcast_medicine_course_changed(data: dict):
    """Course created/updated/paused/completed."""
    await _broadcast_and_buffer("medicine_course_changed", data)


async def broadcast_medicine_intake_marked(data: dict):
    """Intake taken/skipped. Clients filter by patient_id on their side."""
    await _broadcast_and_buffer("medicine_intake_marked", data)
```

- [ ] **Step 2: Verify import**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.api.v1.endpoints.budget_ws"`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/budget_ws.py
git commit -m "feat(medicine): phase2 websocket course/intake events"
```

---

## Task 7: API endpoints (courses + intakes)

**Files:**
- Create: `backend/app/api/v1/endpoints/medicine_courses.py`
- Modify: `backend/app/api/v1/endpoints/__init__.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Create `backend/app/api/v1/endpoints/medicine_courses.py`**

```python
"""Medicine course + intake REST endpoints."""
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.v1.endpoints.budget_ws import (
    broadcast_medicine_course_changed, broadcast_medicine_intake_marked,
)
from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.medicine_course import (
    MedicineCourseCreate, MedicineCourseListResponse, MedicineCourseResponse,
    MedicineCourseUpdate, StockEstimate,
)
from backend.app.schemas.medicine_intake import (
    IntakeListItem, IntakeListResponse, IntakeMarkRequest, IntakeResponse,
)
from backend.app.services import medicine_course_service, medicine_intake_service, medicine_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/medicine-courses", tags=["medicine-courses"], responses=get_common_responses())
intakes_router = APIRouter(prefix="/medicine-intakes", tags=["medicine-intakes"], responses=get_common_responses())


async def _with_estimate(session, course) -> MedicineCourseResponse:
    resp = MedicineCourseResponse.model_validate(course)
    resp.estimate = StockEstimate(**await medicine_course_service.course_estimate(session, course))
    return resp


# ---------- Courses ----------
@router.get("", response_model=MedicineCourseListResponse)
async def list_courses(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(True),
    patient_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> MedicineCourseListResponse:
    rows, total = await medicine_course_service.list_courses(
        session, active_only=active_only, patient_id=patient_id, limit=limit, offset=offset)
    courses = [await _with_estimate(session, c) for c in rows]
    return MedicineCourseListResponse(courses=courses, total=total, limit=limit, offset=offset)


@router.get("/{course_id}", response_model=MedicineCourseResponse)
async def get_course(
    course_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    c = await medicine_course_service.get_course(session, course_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Course {course_id} not found")
    return await _with_estimate(session, c)


@router.post("", response_model=MedicineCourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    data: MedicineCourseCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    # Soft link (decision #6): validate medicine + patient EXIST, but do NOT block on empty stock.
    if not await medicine_service.get_medicine(session, data.medicine_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {data.medicine_id} not found")
    c = await medicine_course_service.create_course(session, data.model_dump(), current_user.id)
    # Generate the first horizon window immediately so today's doses appear without waiting for the job.
    await medicine_intake_service.generate_for_course(
        session, c, c.start_date, _horizon_end(c.start_date))
    resp = await _with_estimate(session, c)
    await broadcast_medicine_course_changed(resp.model_dump(mode="json"))
    return resp


@router.patch("/{course_id}", response_model=MedicineCourseResponse)
async def update_course(
    course_id: int, data: MedicineCourseUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    c = await medicine_course_service.get_course(session, course_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Course {course_id} not found")
    c = await medicine_course_service.update_course(session, c, data.model_dump(exclude_unset=True))
    resp = await _with_estimate(session, c)
    await broadcast_medicine_course_changed(resp.model_dump(mode="json"))
    return resp


@router.post("/{course_id}/pause", response_model=MedicineCourseResponse)
async def pause_course(
    course_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    c = await medicine_course_service.get_course(session, course_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Course {course_id} not found")
    c = await medicine_course_service.pause_course(session, c)
    resp = await _with_estimate(session, c)
    await broadcast_medicine_course_changed(resp.model_dump(mode="json"))
    return resp


@router.post("/{course_id}/complete", response_model=MedicineCourseResponse)
async def complete_course(
    course_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    c = await medicine_course_service.get_course(session, course_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Course {course_id} not found")
    c = await medicine_course_service.complete_course(session, c)
    resp = MedicineCourseResponse.model_validate(c)
    await broadcast_medicine_course_changed(resp.model_dump(mode="json"))
    return resp


@router.delete("/{course_id}", response_model=MedicineCourseResponse)
async def delete_course(
    course_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineCourseResponse:
    # Same as complete: soft-delete the course.
    return await complete_course(course_id, session, current_user)


# ---------- Intakes ----------
@intakes_router.get("", response_model=IntakeListResponse)
async def list_intakes(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    patient_id: int | None = Query(None),
    course_id: int | None = Query(None),
    on_date: str | None = Query(None, alias="date", description="'today' or YYYY-MM-DD"),
) -> IntakeListResponse:
    from backend.app.utils.timezone import now_local
    target: date | None = None
    if on_date == "today":
        target = now_local().date()
    elif on_date:
        target = date.fromisoformat(on_date)
    # Lazy-backfill (spec «Генерация intake_log»): if the nightly maintenance job has not run
    # (scheduler idle longer than the horizon), regenerate the horizon when the dashboard opens.
    # generate_all is idempotent (pre-filter + ON CONFLICT), so this is cheap on the common path.
    if on_date in (None, "today"):
        await medicine_intake_service.generate_all(session)
    rows = await medicine_intake_service.list_intakes(
        session, on_date=target, patient_id=patient_id, course_id=course_id)
    items = [IntakeListItem(**r) for r in rows]
    return IntakeListResponse(intakes=items, total=len(items))


@intakes_router.post("/{intake_id}/take", response_model=IntakeResponse)
async def take_intake(
    intake_id: int, body: IntakeMarkRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> IntakeResponse:
    return await _mark(session, intake_id, "taken", body, current_user.id)


@intakes_router.post("/{intake_id}/skip", response_model=IntakeResponse)
async def skip_intake(
    intake_id: int, body: IntakeMarkRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> IntakeResponse:
    return await _mark(session, intake_id, "skipped", body, current_user.id)


# ---------- helpers ----------
def _horizon_end(start: date) -> date:
    from datetime import timedelta
    from backend.app.services.medicine_intake_service import GENERATION_HORIZON_DAYS
    from backend.app.utils.timezone import now_local
    return max(now_local().date(), start) + timedelta(days=GENERATION_HORIZON_DAYS)


async def _mark(session, intake_id: int, status_value: str, body: IntakeMarkRequest, user_id: int) -> IntakeResponse:
    intake = await medicine_intake_service.get_intake(session, intake_id)
    if not intake:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Intake {intake_id} not found")
    try:
        intake = await medicine_intake_service.mark_intake(
            session, intake, status=status_value, expected_version=body.version,
            user_id=user_id, dose_taken=body.dose_taken, comment=body.comment)
    except medicine_intake_service.IntakeVersionConflict:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Intake was modified by someone else; reload and retry")
    resp = IntakeResponse.model_validate(intake)
    await broadcast_medicine_intake_marked(resp.model_dump(mode="json"))
    return resp
```

> `HTTPException(status_code, detail)` is called positionally here (FastAPI accepts `HTTPException(status_code, detail)`); existing endpoints use the keyword form `status_code=...`. Either is fine — keep this style consistent within the file.

- [ ] **Step 2: Register routers**

In `backend/app/api/v1/endpoints/__init__.py` add:

```python
from backend.app.api.v1.endpoints.medicine_courses import router as medicine_courses_router
from backend.app.api.v1.endpoints.medicine_courses import intakes_router as medicine_intakes_router
```

and to `__all__`:

```python
    "medicine_courses_router",
    "medicine_intakes_router",
```

In `backend/app/api/v1/router.py` add both names to the `from backend.app.api.v1.endpoints import (` block, then near the medicine includes add:

```python
api_router.include_router(medicine_courses_router)
api_router.include_router(medicine_intakes_router)
```

- [ ] **Step 3: Verify app imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "from backend.app.api.v1.router import api_router; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/endpoints/medicine_courses.py \
  backend/app/api/v1/endpoints/__init__.py backend/app/api/v1/router.py
git commit -m "feat(medicine): phase2 API — courses (pause/complete) + intakes (take/skip)"
```

---

## Task 8: Maintenance job — generation + scheduled→late

**Files:**
- Modify: `backend/app/scheduler.py`

- [ ] **Step 1: Extend `medicine_maintenance_job` in `backend/app/scheduler.py`**

Replace the Phase 1 `medicine_maintenance_job` body so it does generation (а) + scheduled→late (б) + expiry alerts (в):

```python
async def medicine_maintenance_job():
    """Daily medicine maintenance: (а) generate intake_log 7d ahead, (б) scheduled→late, (в) expiry alerts."""
    logger.info("[SCHEDULER] Starting medicine maintenance job")
    try:
        async with advisory_xact_lock(LOCK_ID_MEDICINE_MAINTENANCE) as acquired:
            if not acquired:
                logger.info("[SCHEDULER] Medicine maintenance skipped - another worker is executing")
                return
            settings = get_settings()
            from backend.app.services.medicine_alert_service import send_expiry_alerts
            from backend.app.services.medicine_intake_service import generate_all, mark_overdue_late
            async with get_session_context() as session:
                generated = await generate_all(session)
                late = await mark_overdue_late(session)
                sent = await send_expiry_alerts(session, settings)
            logger.info("[SCHEDULER] Medicine maintenance done: generated=%s late=%s expiry_alerts=%s",
                        generated, late, sent)
    except Exception as e:
        logger.error("[SCHEDULER] Error in medicine maintenance job: %s", e, exc_info=True)
        raise
```

- [ ] **Step 2: Verify scheduler imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.scheduler; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/scheduler.py
git commit -m "feat(medicine): phase2 maintenance — intake generation + scheduled→late"
```

---

## Task 9: Integration tests (course/intake)

**Files:**
- Test: `tests/integration/backend/test_medicine_courses_api.py`

Reuse `async_client`/`auth_headers` fixtures from `test_shopping_lists.py` (rename to match).

- [ ] **Step 1: Write the integration test**

```python
"""Integration tests for Phase 2: courses, generation, take/skip, estimate."""
import pytest


async def _seed_medicine_and_member(client, headers, *, with_stock: bool = True):
    r = await client.post("/api/v1/medicines", headers=headers, json={"name": "Курсовое", "form": "tablet"})
    mid = r.json()["id"]
    r = await client.post("/api/v1/family-members", headers=headers, json={"name": "Маша"})
    pid = r.json()["id"]
    if with_stock:
        await client.post("/api/v1/medicine-stock", headers=headers, json={
            "medicine_id": mid, "quantity_remaining": "10", "quantity_initial": "10",
            "unit": "шт", "expiry_date": "2027-01-01"})
    return mid, pid


@pytest.mark.asyncio
async def test_course_create_generates_intakes_and_estimate(async_client, auth_headers):
    mid, pid = await _seed_medicine_and_member(async_client, auth_headers)
    r = await async_client.post("/api/v1/medicine-courses", headers=auth_headers, json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00", "20:00"], "start_date": "2026-06-15", "schedule_type": "daily"})
    assert r.status_code == 201, r.text
    body = r.json()
    # estimate: 10 remaining / 1 dose = 10 intakes; 2 per day → 5 days
    assert body["estimate"]["intakes_left"] == 10
    assert body["estimate"]["days_left"] == 5
    assert body["estimate"]["in_stock"] is True

    # intakes were generated for the start date
    r = await async_client.get("/api/v1/medicine-intakes?date=2026-06-15", headers=auth_headers)
    same_day = [i for i in r.json()["intakes"] if i["course_id"] == body["id"]]
    assert len(same_day) == 2


@pytest.mark.asyncio
async def test_course_without_stock_not_blocked(async_client, auth_headers):
    mid, pid = await _seed_medicine_and_member(async_client, auth_headers, with_stock=False)
    r = await async_client.post("/api/v1/medicine-courses", headers=auth_headers, json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["09:00"], "start_date": "2026-06-15", "schedule_type": "daily"})
    assert r.status_code == 201  # decision #6: no hard block
    assert r.json()["estimate"]["in_stock"] is False


@pytest.mark.asyncio
async def test_take_skip_optimistic_lock(async_client, auth_headers):
    mid, pid = await _seed_medicine_and_member(async_client, auth_headers)
    r = await async_client.post("/api/v1/medicine-courses", headers=auth_headers, json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00"], "start_date": "2026-06-15", "schedule_type": "daily"})
    cid = r.json()["id"]
    r = await async_client.get("/api/v1/medicine-intakes?date=2026-06-15", headers=auth_headers)
    intake = next(i for i in r.json()["intakes"] if i["course_id"] == cid)

    # take with correct version → 200
    r = await async_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        headers=auth_headers, json={"version": intake["version"]})
    assert r.status_code == 200
    assert r.json()["status"] == "taken"

    # take again with stale version → 409
    r = await async_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        headers=auth_headers, json={"version": intake["version"]})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_pause_and_complete(async_client, auth_headers):
    mid, pid = await _seed_medicine_and_member(async_client, auth_headers)
    r = await async_client.post("/api/v1/medicine-courses", headers=auth_headers, json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00"], "start_date": "2026-06-15", "schedule_type": "daily"})
    cid = r.json()["id"]
    r = await async_client.post(f"/api/v1/medicine-courses/{cid}/pause", headers=auth_headers)
    assert r.json()["is_active"] is False
    r = await async_client.post(f"/api/v1/medicine-courses/{cid}/complete", headers=auth_headers)
    assert r.json()["deleted_at"] is not None
    # completed course no longer in active list
    r = await async_client.get("/api/v1/medicine-courses?active_only=true", headers=auth_headers)
    assert all(c["id"] != cid for c in r.json()["courses"])


@pytest.mark.asyncio
async def test_generation_idempotent(async_client, auth_headers, db_session):
    """Re-running generation over an overlapping window adds no duplicate rows (UNIQUE + pre-filter)."""
    from datetime import timedelta

    from backend.app.services import medicine_intake_service as svc
    from backend.app.services.medicine_course_service import get_course

    mid, pid = await _seed_medicine_and_member(async_client, auth_headers)
    r = await async_client.post("/api/v1/medicine-courses", headers=auth_headers, json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00", "20:00"], "start_date": "2026-06-15", "schedule_type": "daily"})
    cid = r.json()["id"]
    course = await get_course(db_session, cid)
    start = course.start_date
    window_end = start + timedelta(days=3)
    first = await svc.generate_for_course(db_session, course, start, window_end)
    second = await svc.generate_for_course(db_session, course, start, window_end)
    assert first > 0
    assert second == 0  # nothing new on the second pass
```

- [ ] **Step 2: Run integration tests**

Run: `cd tests && ./run-tests.sh backend`
Expected: PASS for `test_medicine_courses_api.py`.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/backend/test_medicine_courses_api.py
git commit -m "test(medicine): phase2 course + intake integration tests"
```

---

## Task 10: Frontend — dashboard, courses, course detail

**Files:**
- Modify: `frontend/web/static/js/medicines/medicinesManager.ts`
- Modify: `frontend/web/static/js/medicines-bundle.ts`
- Modify: `backend/app/api/web/router.py`
- Create: `frontend/web/templates/medicines_dashboard.html`
- Create: `frontend/web/templates/medicines_courses.html`
- Create: `frontend/web/templates/medicines_course_detail.html`

- [ ] **Step 1: Append dashboard + course functions to `medicinesManager.ts`**

Append to `frontend/web/static/js/medicines/medicinesManager.ts`:

```typescript
// ---------- Dashboard (today) ----------
interface IntakeItem {
  id: number; course_id: number; patient_id: number; scheduled_at: string;
  status: string; version: number; medicine_name: string; patient_name: string;
  dose_amount: string; dose_unit: string; with_food: string | null;
}

export async function loadDashboard(patientId?: number): Promise<void> {
  const q = patientId != null ? `?date=today&patient_id=${patientId}` : '?date=today';
  const data = await api<{ intakes: IntakeItem[] }>(`/api/v1/medicine-intakes${q}`);
  renderDashboard(data.intakes);
}

function renderDashboard(items: IntakeItem[]): void {
  const root = document.getElementById('medicines-today-body');
  if (!root) return;
  root.innerHTML = items.map(i => {
    const time = i.scheduled_at.slice(11, 16);
    const done = i.status === 'taken' || i.status === 'skipped';
    return `<div class="card bg-base-100 shadow-sm ${done ? 'opacity-60' : ''}" data-id="${i.id}">
      <div class="card-body p-3 flex-row items-center justify-between gap-2">
        <div>
          <div class="font-semibold">${escapeHtml(i.medicine_name)}</div>
          <div class="text-sm opacity-70">👤 ${escapeHtml(i.patient_name)} · ⏰ ${time} · ${i.dose_amount} ${escapeHtml(i.dose_unit)}</div>
          <div class="text-xs ${i.status === 'late' ? 'text-error' : 'opacity-50'}">${i.status}</div>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-success btn-xs" ${done ? 'disabled' : ''}
            onclick="window.intakeTake(${i.id}, ${i.version})">✅</button>
          <button class="btn btn-ghost btn-xs" ${done ? 'disabled' : ''}
            onclick="window.intakeSkip(${i.id}, ${i.version})">⏭</button>
        </div>
      </div>
    </div>`;
  }).join('') || `<div class="text-center opacity-60 py-8">На сегодня ничего нет</div>`;
}

// Reload whichever intake view is mounted (dashboard and/or course journal).
async function refreshIntakeViews(): Promise<void> {
  if (document.getElementById('medicines-today-body')) await loadDashboard();
  if (document.getElementById('medicines-course-journal')) await loadCourseDetail();
}

export async function intakeTake(id: number, version: number): Promise<void> {
  try {
    await api(`/api/v1/medicine-intakes/${id}/take`, { method: 'POST', body: JSON.stringify({ version }) });
    showToast('Принято', 'success');
    await refreshIntakeViews();
  } catch (e) {
    showToast(String((e as Error).message), 'error');
    await refreshIntakeViews();  // reload to resync version on 409
  }
}

export async function intakeSkip(id: number, version: number): Promise<void> {
  try {
    await api(`/api/v1/medicine-intakes/${id}/skip`, { method: 'POST', body: JSON.stringify({ version }) });
    showToast('Пропущено', 'info');
    await refreshIntakeViews();
  } catch (e) {
    showToast(String((e as Error).message), 'error');
    await refreshIntakeViews();
  }
}

// ---------- Courses ----------
interface Course {
  id: number; medicine_id: number; patient_id: number; dose_amount: string; dose_unit: string;
  intake_times: string[]; schedule_type: string; is_active: boolean;
  estimate: { remaining: string; intakes_left: number; days_left: number | null; in_stock: boolean } | null;
}

export async function loadCourses(): Promise<void> {
  const data = await api<{ courses: Course[] }>('/api/v1/medicine-courses?active_only=true&limit=500');
  const root = document.getElementById('medicines-courses-body');
  if (!root) return;
  root.innerHTML = data.courses.map(c => {
    const est = c.estimate;
    const estText = est
      ? (est.in_stock ? `хватит на ${est.intakes_left} приёмов${est.days_left != null ? ` (~${est.days_left} дн.)` : ''}`
                      : '<span class="text-warning">нет в аптечке</span>')
      : '';
    return `<tr data-id="${c.id}">
      <td>${c.intake_times.join(', ')}</td>
      <td>${c.dose_amount} ${escapeHtml(c.dose_unit)}</td>
      <td>${estText}</td>
      <td class="text-right">
        <a class="btn btn-ghost btn-xs" href="/medicines/courses/${c.id}">Открыть</a>
        <button class="btn btn-ghost btn-xs" onclick="window.coursePause(${c.id})">Пауза</button>
      </td></tr>`;
  }).join('') || `<tr><td colspan="4" class="text-center opacity-60">Нет активных курсов</td></tr>`;
}

export async function coursePause(id: number): Promise<void> {
  await api(`/api/v1/medicine-courses/${id}/pause`, { method: 'POST' });
  showToast('Курс приостановлен', 'info');
  await loadCourses();
}

// ---------- Course form (soft link to stock, decision #6) ----------
// NOTE: field names of the Phase 1 list endpoints (medicines / medicine-stock / family-members)
// are assumed below — adjust the response keys to match the Phase 1 schemas if they differ.
interface MedicineOpt { id: number; name: string; }
interface StockRow { medicine_id: number; quantity_remaining: string; }
interface MemberOpt { id: number; name: string; }

let _inStock = new Set<number>();

export async function openCourseForm(): Promise<void> {
  const [meds, stock, members] = await Promise.all([
    api<{ medicines: MedicineOpt[] }>('/api/v1/medicines?limit=1000'),
    api<{ stock: StockRow[] }>('/api/v1/medicine-stock?limit=1000'),
    api<{ members: MemberOpt[] }>('/api/v1/family-members'),
  ]);
  _inStock = new Set(stock.stock.filter(s => Number(s.quantity_remaining) > 0).map(s => s.medicine_id));
  const medSel = document.getElementById('course-medicine') as HTMLSelectElement | null;
  const memSel = document.getElementById('course-patient') as HTMLSelectElement | null;
  if (medSel) {
    // in-stock medicines marked and lifted to the top (spec «селектор … помечены и подняты наверх»).
    const opts = [...meds.medicines].sort((a, b) =>
      Number(_inStock.has(b.id)) - Number(_inStock.has(a.id)) || a.name.localeCompare(b.name));
    medSel.innerHTML = opts.map(m =>
      `<option value="${m.id}">${escapeHtml(m.name)}${_inStock.has(m.id) ? ' · ✓ в аптечке' : ''}</option>`).join('');
    medSel.onchange = updateStockHint;
  }
  if (memSel) memSel.innerHTML = members.members.map(m =>
    `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  updateStockHint();
  (document.getElementById('course-form-dialog') as HTMLDialogElement | null)?.showModal();
}

function updateStockHint(): void {
  const medSel = document.getElementById('course-medicine') as HTMLSelectElement | null;
  const hint = document.getElementById('course-stock-hint');
  if (!medSel || !hint) return;
  const id = Number(medSel.value);
  // No hard block when stock is empty (decision #6): warn + offer to add to the cabinet.
  hint.innerHTML = _inStock.has(id)
    ? '<span class="text-success">✓ есть в аптечке</span>'
    : '<span class="text-warning">нет в аптечке</span> · <a class="link" href="/medicines/stock">добавить в аптечку</a>';
}

export async function createCourseFromForm(): Promise<void> {
  const val = (id: string) =>
    (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
  const times = val('course-times').split(',').map(t => t.trim()).filter(Boolean);
  try {
    await api('/api/v1/medicine-courses', {
      method: 'POST',
      body: JSON.stringify({
        medicine_id: Number(val('course-medicine')),
        patient_id: Number(val('course-patient')),
        dose_amount: val('course-dose'),
        dose_unit: val('course-unit'),
        intake_times: times,
        start_date: val('course-start'),
        schedule_type: val('course-schedule') || 'daily',
      }),
    });
    (document.getElementById('course-form-dialog') as HTMLDialogElement | null)?.close();
    showToast('Курс создан', 'success');
    await loadCourses();
  } catch (e) {
    showToast(String((e as Error).message), 'error');
  }
}

// ---------- Course detail (card + journal) ----------
export async function loadCourseDetail(): Promise<void> {
  const meta = document.querySelector('meta[name="course-id"]') as HTMLMetaElement | null;
  const id = meta ? Number(meta.content) : NaN;
  if (!Number.isFinite(id)) return;
  const c = await api<Course>(`/api/v1/medicine-courses/${id}`);
  const card = document.getElementById('medicines-course-card');
  if (card) {
    const est = c.estimate;
    const estText = est
      ? (est.in_stock ? `хватит на ${est.intakes_left} приёмов${est.days_left != null ? ` (~${est.days_left} дн.)` : ''}`
                      : '<span class="text-warning">нет в аптечке</span>')
      : '';
    card.innerHTML = `<div class="card-body">
      <div class="font-semibold">${c.intake_times.join(', ')} · ${c.dose_amount} ${escapeHtml(c.dose_unit)}</div>
      <div class="text-sm opacity-70">${escapeHtml(c.schedule_type)}</div>
      <div class="text-sm">${estText}</div>
    </div>`;
  }
  const data = await api<{ intakes: IntakeItem[] }>(`/api/v1/medicine-intakes?course_id=${id}`);
  const journal = document.getElementById('medicines-course-journal');
  if (journal) renderJournal(journal, data.intakes);
}

function renderJournal(root: HTMLElement, items: IntakeItem[]): void {
  root.innerHTML = items.map(i => {
    const dt = `${i.scheduled_at.slice(0, 10)} ${i.scheduled_at.slice(11, 16)}`;
    const done = i.status === 'taken' || i.status === 'skipped';
    return `<div class="flex items-center justify-between gap-2 border-b border-base-200 py-1" data-id="${i.id}">
      <span class="text-sm">${dt} · <span class="${i.status === 'late' ? 'text-error' : 'opacity-70'}">${i.status}</span></span>
      <span class="flex gap-1">
        <button class="btn btn-success btn-xs" ${done ? 'disabled' : ''} onclick="window.intakeTake(${i.id}, ${i.version})">✅</button>
        <button class="btn btn-ghost btn-xs" ${done ? 'disabled' : ''} onclick="window.intakeSkip(${i.id}, ${i.version})">⏭</button>
      </span></div>`;
  }).join('') || '<div class="opacity-60">Журнал пуст</div>';
}

// extend WS handler
export function handleMedicineEventV2(eventType: string): void {
  if (eventType === 'medicine_intake_marked') {
    if (document.getElementById('medicines-today-body')) loadDashboard();
    if (document.getElementById('medicines-course-journal')) loadCourseDetail();
  }
  if (eventType === 'medicine_course_changed' && document.getElementById('medicines-courses-body')) loadCourses();
}
```

- [ ] **Step 2: Wire the new functions in `medicines-bundle.ts`**

Update the import + `windowExports` + DOMContentLoaded + WS subscription in `frontend/web/static/js/medicines-bundle.ts`:

```typescript
import {
  loadCatalog, createMedicineFromForm, medicineArchive,
  loadStock, stockDelete, handleMedicineEvent,
  loadDashboard, intakeTake, intakeSkip,
  loadCourses, coursePause, openCourseForm, createCourseFromForm,
  loadCourseDetail, handleMedicineEventV2,
} from './medicines/medicinesManager';

const windowExports = {
  loadCatalog, createMedicineFromForm, medicineArchive,
  loadStock, stockDelete,
  loadDashboard, intakeTake, intakeSkip,
  loadCourses, coursePause, openCourseForm, createCourseFromForm,
};

try {
  if (typeof window !== 'undefined') {
    Object.assign(window, windowExports);
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('medicines-catalog-body')) loadCatalog();
      if (document.getElementById('medicines-stock-body')) loadStock();
      if (document.getElementById('medicines-today-body')) loadDashboard();
      if (document.getElementById('medicines-courses-body')) loadCourses();
      if (document.querySelector('meta[name="course-id"]')) loadCourseDetail();
    });
    const ws = (window as any).budgetWSClient;
    if (ws && typeof ws.addEventListener === 'function') {
      ['medicine_catalog_changed', 'medicine_stock_changed'].forEach(t =>
        ws.addEventListener(t, () => handleMedicineEvent(t)));
      ['medicine_intake_marked', 'medicine_course_changed'].forEach(t =>
        ws.addEventListener(t, () => handleMedicineEventV2(t)));
    }
  }
} catch (e) {
  console.error('[MEDICINES_BUNDLE] init error', e);
}
```

- [ ] **Step 3: Create `frontend/web/templates/medicines_dashboard.html`**

```jinja2
{% extends "base.html" %}

{% block content %}
<div class="space-y-4">
  <h1 class="text-xl font-bold">Сегодня надо принять</h1>
  <div id="medicines-today-body" class="space-y-2"></div>
</div>
{% endblock %}

{% block extra_scripts %}
<script src="/static/js/confirm-dialog.min.js?v=PLACEHOLDER"></script>
<script src="/static/js/medicines.min.js?v=PLACEHOLDER"></script>
{% endblock %}
```

- [ ] **Step 4: Create `frontend/web/templates/medicines_courses.html`**

```jinja2
{% extends "base.html" %}

{% block content %}
<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold">Курсы приёма</h1>
    <button class="btn btn-primary btn-sm" onclick="window.openCourseForm()">+ Новый курс</button>
  </div>
  <div class="overflow-x-auto">
    <table class="table table-sm">
      <thead><tr><th>Время</th><th>Доза</th><th>Остаток</th><th></th></tr></thead>
      <tbody id="medicines-courses-body"></tbody>
    </table>
  </div>
</div>

<dialog id="course-form-dialog" class="modal">
  <div class="modal-box space-y-3">
    <h3 class="font-bold text-lg">Новый курс</h3>
    <label class="form-control">
      <span class="label-text">Лекарство</span>
      <select id="course-medicine" class="select select-bordered select-sm"></select>
    </label>
    <div id="course-stock-hint" class="text-sm"></div>
    <label class="form-control">
      <span class="label-text">Член семьи</span>
      <select id="course-patient" class="select select-bordered select-sm"></select>
    </label>
    <div class="grid grid-cols-2 gap-2">
      <label class="form-control">
        <span class="label-text">Доза</span>
        <input id="course-dose" type="number" step="0.001" class="input input-bordered input-sm" value="1">
      </label>
      <label class="form-control">
        <span class="label-text">Ед.</span>
        <input id="course-unit" class="input input-bordered input-sm" value="шт">
      </label>
    </div>
    <label class="form-control">
      <span class="label-text">Время приёма (через запятую)</span>
      <input id="course-times" class="input input-bordered input-sm" placeholder="08:00, 20:00">
    </label>
    <div class="grid grid-cols-2 gap-2">
      <label class="form-control">
        <span class="label-text">Начало</span>
        <input id="course-start" type="date" class="input input-bordered input-sm">
      </label>
      <label class="form-control">
        <span class="label-text">Расписание</span>
        <select id="course-schedule" class="select select-bordered select-sm">
          <option value="daily">Ежедневно</option>
          <option value="every_n_days">Каждые N дней</option>
          <option value="weekdays">По дням недели</option>
        </select>
      </label>
    </div>
    <div class="modal-action">
      <form method="dialog"><button class="btn btn-ghost btn-sm">Отмена</button></form>
      <button class="btn btn-primary btn-sm" onclick="window.createCourseFromForm()">Создать</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
{% endblock %}

{% block extra_scripts %}
<script src="/static/js/confirm-dialog.min.js?v=PLACEHOLDER"></script>
<script src="/static/js/medicines.min.js?v=PLACEHOLDER"></script>
{% endblock %}
```

- [ ] **Step 5: Create `frontend/web/templates/medicines_course_detail.html`**

```jinja2
{% extends "base.html" %}

{% block extra_head %}
<meta name="course-id" content="{{ course_id }}">
{% endblock %}

{% block content %}
<div class="space-y-4">
  <a href="/medicines/courses" class="btn btn-ghost btn-sm">← Курсы</a>
  <div id="medicines-course-card" class="card bg-base-100 shadow-sm"><div class="card-body">Загрузка…</div></div>
  <h2 class="text-lg font-semibold">Журнал</h2>
  <div id="medicines-course-journal" class="space-y-2"></div>
</div>
{% endblock %}

{% block extra_scripts %}
<script src="/static/js/confirm-dialog.min.js?v=PLACEHOLDER"></script>
<script src="/static/js/medicines.min.js?v=PLACEHOLDER"></script>
{% endblock %}
```

> The detail page is driven by `loadCourseDetail()` (added in Step 1): it reads `<meta name="course-id">`, calls `GET /api/v1/medicine-courses/{id}` (card + estimate) and `GET /api/v1/medicine-intakes?course_id={id}` (journal), and is auto-invoked on `DOMContentLoaded` when the meta tag is present (Step 2). Journal rows reuse `intakeTake`/`intakeSkip`; `refreshIntakeViews` reloads the journal after marking.

- [ ] **Step 6: Add web routes in `backend/app/api/web/router.py`**

Add after the Phase 1 medicine routes:

```python
@web_router.get("/medicines", response_class=HTMLResponse)
async def medicines_dashboard_page(request: Request, current_user: CurrentUser):
    """Medicine dashboard — today's intakes."""
    from backend.app.main import templates
    return templates.TemplateResponse(
        "medicines_dashboard.html",
        {"request": request, "user": current_user, "page_title": "Лекарства"},
    )


@web_router.get("/medicines/courses", response_class=HTMLResponse)
async def medicines_courses_page(request: Request, current_user: CurrentUser):
    """Active/completed courses."""
    from backend.app.main import templates
    return templates.TemplateResponse(
        "medicines_courses.html",
        {"request": request, "user": current_user, "page_title": "Курсы"},
    )


@web_router.get("/medicines/courses/{course_id:int}", response_class=HTMLResponse)
async def medicines_course_detail_page(request: Request, course_id: int, current_user: CurrentUser):
    """Course card + journal."""
    from backend.app.main import templates
    return templates.TemplateResponse(
        "medicines_course_detail.html",
        {"request": request, "user": current_user, "page_title": "Курс", "course_id": course_id},
    )
```

> Route order: define `/medicines/courses` and `/medicines/courses/{course_id:int}` and the Phase 1 `/medicines/catalog`, `/medicines/stock` BEFORE any catch-all. `/medicines` (exact) does not collide with `/medicines/catalog`.

- [ ] **Step 7: Build the frontend**

Run: `npm run build`
Expected: type-check passes, `medicines.min.js` rebuilt.

- [ ] **Step 8: Commit**

```bash
git add frontend/web/static/js/medicines/medicinesManager.ts frontend/web/static/js/medicines-bundle.ts \
  backend/app/api/web/router.py frontend/web/templates/medicines_dashboard.html \
  frontend/web/templates/medicines_courses.html frontend/web/templates/medicines_course_detail.html
git commit -m "feat(medicine): phase2 frontend — dashboard, courses, course detail"
```

---

## Task 11: Verify + docs

- [ ] **Step 1: Full backend suite**

Run: `cd tests && ./run-tests.sh backend`
Expected: green.

- [ ] **Step 2: Manual smoke (375/768/1280px)**

- `/medicines`: today's intakes render per member; ✅ marks taken (row dims), ⏭ skips; a second tab marking the same intake yields a toast + resync (409 path). Open the dashboard after the scheduler has been idle → lazy-backfill regenerates the horizon (intakes appear without waiting for the nightly job).
- `/medicines/courses`: «+ Новый курс» opens the form; the medicine selector marks in-stock items («· ✓ в аптечке») and lifts them to the top; picking a medicine with no stock shows «нет в аптечке» + «добавить в аптечку» but still creates (decision #6). New course shows «хватит на N приёмов (~N дн.)»; Пауза deactivates.
- `/medicines/courses/{id}`: card (dose/schedule/estimate) + journal render; ✅/⏭ in the journal mark the intake and the journal refreshes.

- [ ] **Step 3: Update docs**

Append the 2 new tables + the course/intake endpoints + generation/scheduled→late behavior to `lat.md/database.md`, `lat.md/api.md`, `lat.md/domain.md`.

- [ ] **Step 4: Commit**

```bash
git add lat.md/database.md lat.md/api.md lat.md/domain.md
git commit -m "docs(medicine): phase2 — courses + intake index entries"
```

---

## Phase 2 Done — Definition

- 2 tables migrated; `cd tests && ./run-tests.sh backend` green.
- Course CRUD + pause/complete; soft link to stock (no hard block when stock empty — decision #6).
- Course form (`/medicines/courses`) with a medicine selector that marks/lifts in-stock items and warns + offers «добавить в аптечку» when empty (decision #6) — never blocks create.
- intake_log generated on course create and nightly 7 days ahead; idempotent (pre-filter + `ON CONFLICT`, no batch-discarding rollback).
- Lazy-backfill: opening the dashboard regenerates the horizon if the nightly job has been idle (spec «Генерация intake_log»).
- Overdue `scheduled→late` transition runs nightly.
- take/skip mark status with optimistic-lock 409 on concurrent marks.
- Dashboard shows today's intakes per member with «хватит на N приёмов/дней» estimate (decision #7) covering daily/every_n_days/weekdays.
- Course detail (`/medicines/courses/{id}`) renders card + journal (filtered by `course_id`) with inline take/skip.

**Next:** Phase 3 (`2026-06-15-medicine-tracking-phase3-reminders.md`) — `t_medicine_reminder`, dispatch job, recipient fan-out, Telegram buttons + snooze.
