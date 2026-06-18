---
review:
  plan_hash: dca42ceb73830649
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
      severity: WARNING
      section: "## Task 4: Services (catalog + history, family member, stock)"
      section_hash: 8d0a3e7e303d45a9
      text: "Family member DELETE: спека (строки 236, 329) требует SOFT-archive (блок hard-delete при связанных курсах, «как у medicine»). План делал HARD delete, модель без is_active. Исправлено: добавлено поле is_active (модель+миграция+схема), archive_family_member (soft), endpoint DELETE → soft-archive 200, list active_only, тест обновлён."
      verdict: fixed
      verdict_at: 2026-06-15
    - id: F-002
      phase: coverage
      severity: WARNING
      section: "## Task 9: Frontend — catalog + stock pages"
      section_hash: 54a3f224b37f5715
      text: "Страница stock не имела UI создания в Фазе 1. Исправлено: добавлена форма (select лекарства + qty/unit/expiry/location), loadMedicineOptions + createStockFromForm, колонка «Лекарство», window-exports. Аптечку можно наполнить из UI."
      verdict: fixed
      verdict_at: 2026-06-15
    - id: F-003
      phase: coverage
      severity: WARNING
      section: "## Task 8: Daily expiry-alert maintenance job"
      section_hash: 1e80ae9b798aaadd
      text: "Expiry-алерт слал только Telegram; спека (строка 230) — «telegram + web-push». Исправлено: send_expiry_alerts шлёт оба канала; web-push payload data.type=medicine_expiry, url=/medicines (решение #5)."
      verdict: fixed
      verdict_at: 2026-06-15
    - id: F-004
      phase: dependencies
      severity: WARNING
      section: "## Task 8: Daily expiry-alert maintenance job"
      section_hash: 1e80ae9b798aaadd
      text: "Task 8 предполагал NotificationService/User API без верификации. Исправлено: добавлен Step 3 verify (греп методов NS + колонок User), web-push строки помечены # VERIFY, get_expiring_stock покрыт DB-тестом (F-006)."
      verdict: fixed
      verdict_at: 2026-06-15
    - id: F-005
      phase: consistency
      severity: INFO
      section: "## Conventions (read once, applies to every task)"
      section_hash: d26d80a788fb0e36
      text: "utcnow для audit-колонок vs инвариант «SYSTEM_TIMEZONE во всех полях». Исправлено: Conventions явно фиксирует accepted deviation — behavioral поля в SYSTEM_TIMEZONE, audit-колонки следуют project-wide utcnow; sign-off записан."
      verdict: fixed
      verdict_at: 2026-06-15
    - id: F-006
      phase: verifiability
      severity: INFO
      section: "## Task 8: Daily expiry-alert maintenance job"
      section_hash: 1e80ae9b798aaadd
      text: "get_expiring_stock (raw SQL join) был непротестирован. Исправлено: добавлен test_get_expiring_stock_join в Task 7 (db_session + async_client), проверяет join по name."
      verdict: fixed
      verdict_at: 2026-06-15
    - id: F-007
      phase: consistency
      severity: INFO
      section: "## Task 1: Models (catalog, history, family member, stock)"
      section_hash: b2119541713a9afa
      text: "change_type RESTORE документирован, но не эмитился. Исправлено: update_medicine логирует un-archive (is_active false→true) как RESTORE, archive как ARCHIVE, прочее UPDATE."
      verdict: fixed
      verdict_at: 2026-06-15
    - id: F-008
      phase: structure
      severity: INFO
      section: "## Task 9: Frontend — catalog + stock pages"
      section_hash: 54a3f224b37f5715
      text: "Неиспользуемый confirm-dialog.min.js include + console.error. Исправлено: include удалён из обоих шаблонов; console.error оставлен с пометкой (pre-commit hook ловит только console.log)."
      verdict: fixed
      verdict_at: 2026-06-15
chain:
  intent: null
  spec: docs/superpowers/specs/2026-06-15-medicine-tracking-design.md
result_check:
  verdict: OK
  plan_hash: dca42ceb73830649
  last_run: 2026-06-16
---

# Medicine Tracking — Phase 1: MVP «Аптечка» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working medicine inventory: a shared catalog of medicines, family members, and a stock (аптечка) with expiry alerts — visible on two web pages.

**Architecture:** Mirror the proven `shopping_list` stack (SQLModel models + raw-SQL Alembic migration + module-function services + FastAPI routers + typed WebSocket broadcast + a focused web page). Medicine catalog is a Dimension (SCD Type 1 in-place update + a separate `t_d_medicine_history` SCD Type 2 audit table). Stock mirrors `shopping_list_item` (soft-delete + `version`). A daily scheduler job emits expiry alerts via Telegram + Web Push.

**Tech Stack:** FastAPI 0.121 · SQLModel · PostgreSQL 16 · Alembic (raw SQL) · APScheduler · Vite IIFE bundle · Jinja2 + HTMX + DaisyUI · pytest.

**Spec:** `docs/superpowers/specs/2026-06-15-medicine-tracking-design.md` (decisions #1, #6 deferred to later phases; this phase is пункты «catalog + stock + expiry alert»).

---

## Conventions (read once, applies to every task)

- **Run all commands from repo root** unless stated: `cd /home/ikeniborn/Documents/Project/familyBudget`.
- **Pure model/unit tests** (no DB):
  `PYTHONPATH=. backend/.venv/bin/pytest tests/models/test_medicine_models.py -v`
- **DB / migration / integration tests** (applies migrations first): `cd tests && ./run-tests.sh backend`
  (this runs `alembic upgrade head` then the full backend pytest suite).
- **Time:** domain/behavioral time fields (`expiry_date` comparisons, alert cutoffs) follow the spec invariant — naive `datetime` in `SYSTEM_TIMEZONE`: in services use `from backend.app.utils.timezone import now_local` → `now_local().replace(tzinfo=None)`. **Accepted deviation:** audit columns `created_at`/`updated_at` use `default_factory=datetime.utcnow` (model) + `CURRENT_TIMESTAMP` (migration), matching **every existing project model** — the spec invariant's "во всех полях" is read as scoping behavioral fields; matching the codebase convention is preferred over a lone-module divergence. Sign-off: keep utcnow for audit columns.
- **Enums** are `VARCHAR + CHECK` in SQL and plain `str` fields in models (project has no Python/PG enum types).
- **Money/quantity:** `NUMERIC(10,3)` for quantities, `NUMERIC(10,2)` for price.
- **Migration head before Phase 1** is `524e09e9f39a`. This phase's migration uses `down_revision = "524e09e9f39a"`.
- **No `.min.js`/`.min.css` commits** — generated by build. Frontend build: `npm run build`.
- **VERSION:** bump one patch step (e.g. `0.x.y` → `0.x.(y+1)`) only when explicitly asked to release; do NOT build on the server.

## File Structure (created/modified this phase)

| File | Responsibility |
|---|---|
| `backend/app/models/medicine.py` | `Medicine` model (catalog) |
| `backend/app/models/medicine_history.py` | `MedicineHistory` SCD2 audit model |
| `backend/app/models/family_member.py` | `FamilyMember` model |
| `backend/app/models/medicine_stock.py` | `MedicineStock` model (one package = one row) |
| `backend/app/models/__init__.py` | register 4 new models |
| `backend/db/migrations/versions/20260615_m1a2b3c4d5e6_add_medicine_phase1_tables.py` | create 4 tables + history |
| `backend/app/schemas/medicine.py` | medicine Create/Update/Response + list |
| `backend/app/schemas/family_member.py` | family member schemas |
| `backend/app/schemas/medicine_stock.py` | stock schemas |
| `backend/app/services/medicine_service.py` | catalog CRUD + history append + delete-guard |
| `backend/app/services/family_member_service.py` | family member CRUD + delete-guard |
| `backend/app/services/medicine_stock_service.py` | stock CRUD (soft-delete) + expiring query |
| `backend/app/api/v1/endpoints/budget_ws.py` | add `broadcast_medicine_*` wrappers |
| `backend/app/api/v1/endpoints/medicines.py` | medicines + medicine-stock routers |
| `backend/app/api/v1/endpoints/family_members.py` | family-members router |
| `backend/app/api/v1/endpoints/__init__.py` | export new routers |
| `backend/app/api/v1/router.py` | include new routers |
| `backend/app/services/medicine_alert_service.py` | expiry-alert send (Telegram broadcast) |
| `backend/app/scheduler.py` | `LOCK_ID_MEDICINE_MAINTENANCE=1010` + daily maintenance job |
| `backend/app/api/web/router.py` | `/medicines/catalog`, `/medicines/stock` routes |
| `frontend/web/templates/medicines_catalog.html` | catalog page |
| `frontend/web/templates/medicines_stock.html` | stock page |
| `frontend/web/static/js/medicines-bundle.ts` | bundle entry |
| `frontend/web/static/js/medicines/medicinesManager.ts` | catalog+stock manager (fetch/render/WS) |
| `build-all.js` | add `medicines` bundle entry |
| `tests/models/test_medicine_models.py` | model field tests |
| `tests/migrations/test_medicine_phase1_migration.py` | table/constraint existence |
| `tests/integration/backend/test_medicines_api.py` | catalog + family + stock API |
| `tests/unit/backend/test_medicine_alert.py` | expiry query + alert formatting |

---

## Task 1: Models (catalog, history, family member, stock)

**Files:**
- Create: `backend/app/models/medicine.py`
- Create: `backend/app/models/medicine_history.py`
- Create: `backend/app/models/family_member.py`
- Create: `backend/app/models/medicine_stock.py`
- Modify: `backend/app/models/__init__.py`
- Test: `tests/models/test_medicine_models.py`

- [ ] **Step 1: Write the failing model test**

Create `tests/models/test_medicine_models.py`:

```python
"""Unit tests for Phase 1 medicine models (no DB)."""
from datetime import date, datetime
from decimal import Decimal

from backend.app.models.medicine import Medicine
from backend.app.models.medicine_history import MedicineHistory
from backend.app.models.family_member import FamilyMember
from backend.app.models.medicine_stock import MedicineStock


def test_medicine_fields():
    m = Medicine(name="Нурофен 200мг", form="tablet", creator_id=1)
    assert m.name == "Нурофен 200мг"
    assert m.form == "tablet"
    assert m.is_active is True          # default active
    assert m.prescription_required is False
    assert m.inn is None
    assert m.__tablename__ == "t_d_medicine"


def test_medicine_history_fields():
    h = MedicineHistory(
        medicine_id=1, creator_id=1, name="Нурофен 200мг", form="tablet",
        prescription_required=False, is_active=True,
        valid_from=datetime(2026, 6, 15), is_current=True, change_type="CREATE",
    )
    assert h.medicine_id == 1
    assert h.change_type == "CREATE"
    assert h.is_current is True
    assert h.__tablename__ == "t_d_medicine_history"


def test_family_member_fields():
    fm = FamilyMember(name="Маша", guardian_user_id=1)
    assert fm.name == "Маша"
    assert fm.guardian_user_id == 1
    assert fm.linked_user_id is None
    assert fm.is_active is True          # default active (soft-archive flag)
    assert fm.__tablename__ == "t_d_family_member"


def test_medicine_stock_fields():
    s = MedicineStock(
        medicine_id=1, quantity_remaining=Decimal("20"),
        quantity_initial=Decimal("20"), unit="шт",
        expiry_date=date(2027, 1, 1), creator_id=1,
    )
    assert s.quantity_remaining == Decimal("20")
    assert s.unit == "шт"
    assert s.version == 1                # optimistic lock default
    assert s.deleted_at is None
    assert s.__tablename__ == "t_f_medicine_stock"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/models/test_medicine_models.py -v`
Expected: FAIL — `ModuleNotFoundError: backend.app.models.medicine`.

- [ ] **Step 3: Create `backend/app/models/medicine.py`**

```python
"""Medicine catalog model (Dimension, SCD Type 1; history in t_d_medicine_history)."""
from datetime import datetime

from sqlmodel import Field, SQLModel


class Medicine(SQLModel, table=True):
    """Shared family medicine catalog. Soft-archive only (is_active=False)."""

    __tablename__ = "t_d_medicine"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(nullable=False, max_length=255, index=True, description="Trade name")
    inn: str | None = Field(default=None, max_length=255, index=True, description="INN — groups analogues")
    form: str = Field(
        nullable=False, max_length=20,
        description="tablet/capsule/syrup/drops/ointment/spray/injection/other",
    )
    dosage: str | None = Field(default=None, max_length=100, description="e.g. '200 mg'")
    prescription_required: bool = Field(default=False, nullable=False)
    notes: str | None = Field(default=None, description="Free text")
    is_active: bool = Field(default=True, nullable=False, index=True, description="Soft-archive flag")
    creator_id: int = Field(foreign_key="t_d_user.id", index=True, nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
```

- [ ] **Step 4: Create `backend/app/models/medicine_history.py`**

```python
"""Medicine SCD Type 2 audit history (mirrors product_group_history)."""
from datetime import datetime, timezone

from sqlalchemy import ARRAY, String
from sqlmodel import Column, Field, SQLModel

FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


class MedicineHistory(SQLModel, table=True):
    """One row per change to a Medicine. Current version has is_current=True."""

    __tablename__ = "t_d_medicine_history"

    history_id: int | None = Field(default=None, primary_key=True)
    medicine_id: int = Field(foreign_key="t_d_medicine.id", index=True, nullable=False)

    # Snapshot of catalog fields
    creator_id: int = Field(nullable=False, index=True)
    name: str = Field(nullable=False, max_length=255, index=True)
    inn: str | None = Field(default=None, max_length=255)
    form: str = Field(nullable=False, max_length=20)
    dosage: str | None = Field(default=None, max_length=100)
    prescription_required: bool = Field(nullable=False)
    notes: str | None = Field(default=None)
    is_active: bool = Field(nullable=False)

    # SCD2 temporal
    valid_from: datetime = Field(nullable=False, index=True)
    valid_to: datetime = Field(default=FAR_FUTURE_DATETIME, nullable=False)
    is_current: bool = Field(nullable=False, index=True)

    # Change metadata
    change_type: str = Field(nullable=False, max_length=50, description="CREATE/UPDATE/ARCHIVE/RESTORE")
    changed_fields: list[str] | None = Field(default=None, sa_column=Column(ARRAY(String), nullable=True))
    changed_by_user_id: int | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
```

- [ ] **Step 5: Create `backend/app/models/family_member.py`**

```python
"""Family member model — including children without an account."""
from datetime import date, datetime

from sqlmodel import Field, SQLModel


class FamilyMember(SQLModel, table=True):
    """A person medicine courses are assigned to. Reminders always go to guardian."""

    __tablename__ = "t_d_family_member"

    id: int | None = Field(default=None, primary_key=True)
    linked_user_id: int | None = Field(default=None, foreign_key="t_d_user.id", index=True,
                                       description="Set if this member has an account")
    guardian_user_id: int = Field(foreign_key="t_d_user.id", index=True, nullable=False,
                                  description="Guardian — reminders always sent here")
    name: str = Field(nullable=False, max_length=255, index=True)
    birth_date: date | None = Field(default=None, description="For age-based dosing")
    notes: str | None = Field(default=None, description="Allergies, specifics")
    is_active: bool = Field(default=True, nullable=False, index=True, description="Soft-archive flag (mirrors Medicine)")
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
```

- [ ] **Step 6: Create `backend/app/models/medicine_stock.py`**

```python
"""Medicine stock — one package = one row (mirrors shopping_list_item: soft-delete + version)."""
from datetime import date, datetime
from decimal import Decimal

from sqlmodel import Field, SQLModel


class MedicineStock(SQLModel, table=True):
    """A single physical package of a medicine on the shelf (аптечка)."""

    __tablename__ = "t_f_medicine_stock"

    id: int | None = Field(default=None, primary_key=True)
    medicine_id: int = Field(foreign_key="t_d_medicine.id", index=True, nullable=False)
    quantity_remaining: Decimal = Field(max_digits=10, decimal_places=3, nullable=False)
    quantity_initial: Decimal = Field(max_digits=10, decimal_places=3, nullable=False)
    unit: str = Field(nullable=False, max_length=50, description="шт/мл/доз")
    expiry_date: date = Field(nullable=False, index=True, description="Alert when < 30 days")
    purchase_date: date | None = Field(default=None)
    purchase_price: Decimal | None = Field(default=None, max_digits=10, decimal_places=2,
                                           description="Module analytics only — NOT budget")
    location: str | None = Field(default=None, max_length=100, description="e.g. 'Кухня, шкаф'")
    creator_id: int = Field(foreign_key="t_d_user.id", index=True, nullable=False)
    version: int = Field(default=1, nullable=False, description="Optimistic locking")
    deleted_at: datetime | None = Field(default=None, index=True, description="Soft delete (NULL = active)")
    last_modified_by: int | None = Field(default=None, foreign_key="t_d_user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
```

- [ ] **Step 7: Register models in `backend/app/models/__init__.py`**

Add these imports next to the existing `from backend.app.models.shopping_list import ShoppingList` block:

```python
from backend.app.models.medicine import Medicine
from backend.app.models.medicine_history import MedicineHistory
from backend.app.models.family_member import FamilyMember
from backend.app.models.medicine_stock import MedicineStock
```

Add these entries to the `__all__` list (after `"ShoppingListItem",`):

```python
    "Medicine",
    "MedicineHistory",
    "FamilyMember",
    "MedicineStock",
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/models/test_medicine_models.py -v`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add backend/app/models/medicine.py backend/app/models/medicine_history.py \
  backend/app/models/family_member.py backend/app/models/medicine_stock.py \
  backend/app/models/__init__.py tests/models/test_medicine_models.py
git commit -m "feat(medicine): phase1 models — catalog, history, family member, stock"
```

---

## Task 2: Migration (4 tables)

**Files:**
- Create: `backend/db/migrations/versions/20260615_m1a2b3c4d5e6_add_medicine_phase1_tables.py`
- Test: `tests/migrations/test_medicine_phase1_migration.py`

- [ ] **Step 1: Write the failing migration test**

Create `tests/migrations/test_medicine_phase1_migration.py`:

```python
"""Verify Phase 1 medicine tables exist after migrations are applied."""
import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_phase1_tables_exist(db_session):
    rows = await db_session.execute(text(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    ))
    names = {r[0] for r in rows}
    assert {"t_d_medicine", "t_d_medicine_history",
            "t_d_family_member", "t_f_medicine_stock"} <= names


@pytest.mark.asyncio
async def test_stock_expiry_index_and_form_check(db_session):
    # expiry_date index present
    idx = await db_session.execute(text(
        "SELECT indexname FROM pg_indexes WHERE tablename='t_f_medicine_stock'"
    ))
    assert any("expiry" in r[0] for r in idx)
    # form CHECK rejects bad value
    with pytest.raises(Exception):
        await db_session.execute(text(
            "INSERT INTO t_d_medicine (name, form, prescription_required, is_active, creator_id) "
            "VALUES ('x', 'NOT_A_FORM', false, true, 1)"
        ))
```

> Uses the `db_session` fixture from `tests/conftest.py` (same fixture `tests/integration/backend/test_shopping_lists.py` uses). If the fixture name differs there, match it.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd tests && ./run-tests.sh backend`
Expected: FAIL — tables do not exist yet (assertion error).

- [ ] **Step 3: Create the migration**

Create `backend/db/migrations/versions/20260615_m1a2b3c4d5e6_add_medicine_phase1_tables.py`:

```python
"""add_medicine_phase1_tables

Revision ID: m1a2b3c4d5e6
Revises: 524e09e9f39a
Create Date: 2026-06-15 00:00:00.000000

Phase 1 of medicine tracking: catalog (+SCD2 history), family members, stock.
"""
from collections.abc import Sequence

from alembic import op


revision: str = "m1a2b3c4d5e6"
down_revision: str | None = "524e09e9f39a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ===== Catalog (SCD Type 1) =====
    op.execute("""
        CREATE TABLE t_d_medicine (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            inn VARCHAR(255),
            form VARCHAR(20) NOT NULL
                CHECK (form IN ('tablet','capsule','syrup','drops','ointment','spray','injection','other')),
            dosage VARCHAR(100),
            prescription_required BOOLEAN NOT NULL DEFAULT FALSE,
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            creator_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX idx_medicine_name ON t_d_medicine(name)")
    op.execute("CREATE INDEX idx_medicine_inn ON t_d_medicine(inn) WHERE inn IS NOT NULL")
    op.execute("CREATE INDEX idx_medicine_creator_id ON t_d_medicine(creator_id)")
    op.execute("CREATE INDEX idx_medicine_active ON t_d_medicine(is_active) WHERE is_active = TRUE")

    # ===== Catalog history (SCD Type 2) =====
    op.execute("""
        CREATE TABLE t_d_medicine_history (
            history_id SERIAL PRIMARY KEY,
            medicine_id INT NOT NULL REFERENCES t_d_medicine(id) ON DELETE CASCADE,
            creator_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            inn VARCHAR(255),
            form VARCHAR(20) NOT NULL,
            dosage VARCHAR(100),
            prescription_required BOOLEAN NOT NULL,
            notes TEXT,
            is_active BOOLEAN NOT NULL,
            valid_from TIMESTAMP NOT NULL,
            valid_to TIMESTAMP NOT NULL DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
            is_current BOOLEAN NOT NULL,
            change_type VARCHAR(50) NOT NULL,
            changed_fields TEXT[],
            changed_by_user_id INT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_medicine_history_valid_dates CHECK (valid_from < valid_to)
        )
    """)
    op.execute("CREATE INDEX idx_medicine_history_medicine_id ON t_d_medicine_history(medicine_id)")
    op.execute("CREATE INDEX idx_medicine_history_valid_from ON t_d_medicine_history(valid_from)")
    op.execute("CREATE INDEX idx_medicine_history_is_current ON t_d_medicine_history(is_current) WHERE is_current = TRUE")

    # ===== Family members =====
    op.execute("""
        CREATE TABLE t_d_family_member (
            id SERIAL PRIMARY KEY,
            linked_user_id INT REFERENCES t_d_user(id) ON DELETE SET NULL,
            guardian_user_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            birth_date DATE,
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX idx_family_member_guardian ON t_d_family_member(guardian_user_id)")
    op.execute("CREATE INDEX idx_family_member_linked ON t_d_family_member(linked_user_id) WHERE linked_user_id IS NOT NULL")
    op.execute("CREATE INDEX idx_family_member_name ON t_d_family_member(name)")
    op.execute("CREATE INDEX idx_family_member_active ON t_d_family_member(is_active) WHERE is_active = TRUE")

    # ===== Stock (one package = one row) =====
    op.execute("""
        CREATE TABLE t_f_medicine_stock (
            id SERIAL PRIMARY KEY,
            medicine_id INT NOT NULL REFERENCES t_d_medicine(id) ON DELETE RESTRICT,
            quantity_remaining NUMERIC(10, 3) NOT NULL,
            quantity_initial NUMERIC(10, 3) NOT NULL,
            unit VARCHAR(50) NOT NULL,
            expiry_date DATE NOT NULL,
            purchase_date DATE,
            purchase_price NUMERIC(10, 2),
            location VARCHAR(100),
            creator_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            version INT NOT NULL DEFAULT 1,
            deleted_at TIMESTAMP,
            last_modified_by INT REFERENCES t_d_user(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_stock_qty_nonneg CHECK (quantity_remaining >= 0)
        )
    """)
    op.execute("CREATE INDEX idx_medicine_stock_medicine_id ON t_f_medicine_stock(medicine_id)")
    op.execute("CREATE INDEX idx_medicine_stock_expiry ON t_f_medicine_stock(expiry_date)")
    op.execute("CREATE INDEX idx_medicine_stock_creator_id ON t_f_medicine_stock(creator_id)")
    op.execute("CREATE INDEX idx_medicine_stock_active ON t_f_medicine_stock(deleted_at) WHERE deleted_at IS NULL")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS t_f_medicine_stock")
    op.execute("DROP TABLE IF EXISTS t_d_family_member")
    op.execute("DROP TABLE IF EXISTS t_d_medicine_history")
    op.execute("DROP TABLE IF EXISTS t_d_medicine")
```

- [ ] **Step 4: Run the migration test to verify it passes**

Run: `cd tests && ./run-tests.sh backend`
Expected: PASS for `test_medicine_phase1_migration.py` (migrations applied, tables/index/CHECK verified). Other suites unaffected.

- [ ] **Step 5: Commit**

```bash
git add backend/db/migrations/versions/20260615_m1a2b3c4d5e6_add_medicine_phase1_tables.py \
  tests/migrations/test_medicine_phase1_migration.py
git commit -m "feat(medicine): phase1 migration — 4 tables + indexes + checks"
```

---

## Task 3: Pydantic schemas

**Files:**
- Create: `backend/app/schemas/medicine.py`
- Create: `backend/app/schemas/family_member.py`
- Create: `backend/app/schemas/medicine_stock.py`

No standalone test — schemas are exercised by Task 7 integration tests. They are imported by Task 6.

- [ ] **Step 1: Create `backend/app/schemas/medicine.py`**

```python
"""Pydantic schemas for the medicine catalog."""
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

VALID_FORMS = {"tablet", "capsule", "syrup", "drops", "ointment", "spray", "injection", "other"}


class MedicineCreate(BaseModel):
    name: str = Field(..., max_length=255, min_length=1)
    form: str = Field(..., description="One of VALID_FORMS")
    inn: str | None = Field(default=None, max_length=255)
    dosage: str | None = Field(default=None, max_length=100)
    prescription_required: bool = Field(default=False)
    notes: str | None = Field(default=None)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Medicine name cannot be empty")
        return v.strip()

    @field_validator("form")
    @classmethod
    def form_valid(cls, v: str) -> str:
        if v not in VALID_FORMS:
            raise ValueError(f"form must be one of {sorted(VALID_FORMS)}")
        return v


class MedicineUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255, min_length=1)
    form: str | None = Field(default=None)
    inn: str | None = Field(default=None, max_length=255)
    dosage: str | None = Field(default=None, max_length=100)
    prescription_required: bool | None = Field(default=None)
    notes: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)

    @field_validator("form")
    @classmethod
    def form_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_FORMS:
            raise ValueError(f"form must be one of {sorted(VALID_FORMS)}")
        return v


class MedicineResponse(BaseModel):
    id: int
    name: str
    inn: str | None
    form: str
    dosage: str | None
    prescription_required: bool
    notes: str | None
    is_active: bool
    creator_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MedicineListResponse(BaseModel):
    medicines: list[MedicineResponse]
    total: int
    limit: int
    offset: int
```

- [ ] **Step 2: Create `backend/app/schemas/family_member.py`**

```python
"""Pydantic schemas for family members."""
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class FamilyMemberCreate(BaseModel):
    name: str = Field(..., max_length=255, min_length=1)
    guardian_user_id: int | None = Field(
        default=None,
        description="Guardian user id; defaults to the current user when omitted",
    )
    linked_user_id: int | None = Field(default=None)
    birth_date: date | None = Field(default=None)
    notes: str | None = Field(default=None)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class FamilyMemberUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255, min_length=1)
    guardian_user_id: int | None = Field(default=None)
    linked_user_id: int | None = Field(default=None)
    birth_date: date | None = Field(default=None)
    notes: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)


class FamilyMemberResponse(BaseModel):
    id: int
    name: str
    guardian_user_id: int
    linked_user_id: int | None
    birth_date: date | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FamilyMemberListResponse(BaseModel):
    family_members: list[FamilyMemberResponse]
    total: int
```

- [ ] **Step 3: Create `backend/app/schemas/medicine_stock.py`**

```python
"""Pydantic schemas for medicine stock (аптечка)."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class MedicineStockCreate(BaseModel):
    medicine_id: int = Field(...)
    quantity_remaining: Decimal = Field(..., ge=0)
    quantity_initial: Decimal = Field(..., ge=0)
    unit: str = Field(..., max_length=50, min_length=1)
    expiry_date: date = Field(...)
    purchase_date: date | None = Field(default=None)
    purchase_price: Decimal | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=100)

    @field_validator("unit")
    @classmethod
    def unit_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("unit cannot be empty")
        return v.strip()


class MedicineStockUpdate(BaseModel):
    quantity_remaining: Decimal | None = Field(default=None, ge=0)
    quantity_initial: Decimal | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, max_length=50, min_length=1)
    expiry_date: date | None = Field(default=None)
    purchase_date: date | None = Field(default=None)
    purchase_price: Decimal | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=100)


class MedicineStockResponse(BaseModel):
    id: int
    medicine_id: int
    quantity_remaining: Decimal
    quantity_initial: Decimal
    unit: str
    expiry_date: date
    purchase_date: date | None
    purchase_price: Decimal | None
    location: str | None
    creator_id: int
    version: int
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MedicineStockListResponse(BaseModel):
    stock: list[MedicineStockResponse]
    total: int
    limit: int
    offset: int
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/medicine.py backend/app/schemas/family_member.py \
  backend/app/schemas/medicine_stock.py
git commit -m "feat(medicine): phase1 pydantic schemas"
```

---

## Task 4: Services (catalog + history, family member, stock)

**Files:**
- Create: `backend/app/services/medicine_service.py`
- Create: `backend/app/services/family_member_service.py`
- Create: `backend/app/services/medicine_stock_service.py`

Module-function services (mirror `shopping_list_service`): each takes `session` per call, `async`/`await`. Verified by Task 7 integration tests.

- [ ] **Step 1: Create `backend/app/services/medicine_service.py`**

```python
"""Medicine catalog service: CRUD + SCD2 history append + delete-guard."""
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import func, select

from backend.app.models.medicine import Medicine
from backend.app.models.medicine_history import FAR_FUTURE_DATETIME, MedicineHistory
from backend.app.models.medicine_stock import MedicineStock
from backend.app.utils.timezone import now_local

_HISTORY_FIELDS = ("name", "inn", "form", "dosage", "prescription_required", "notes", "is_active")


def _now() -> datetime:
    return now_local().replace(tzinfo=None)


async def _append_history(
    session: AsyncSession, medicine: Medicine, change_type: str,
    changed_fields: list[str] | None, user_id: int,
) -> None:
    """Close the current history row (if any) and insert a new current snapshot."""
    now = _now()
    prev = await session.execute(
        select(MedicineHistory).where(
            MedicineHistory.medicine_id == medicine.id,
            MedicineHistory.is_current == True,  # noqa: E712
        )
    )
    for row in prev.scalars().all():
        row.is_current = False
        row.valid_to = now
        session.add(row)

    session.add(MedicineHistory(
        medicine_id=medicine.id, creator_id=medicine.creator_id,
        name=medicine.name, inn=medicine.inn, form=medicine.form, dosage=medicine.dosage,
        prescription_required=medicine.prescription_required, notes=medicine.notes,
        is_active=medicine.is_active,
        valid_from=now, valid_to=FAR_FUTURE_DATETIME, is_current=True,
        change_type=change_type, changed_fields=changed_fields, changed_by_user_id=user_id,
    ))


async def list_medicines(session: AsyncSession, *, active_only: bool, limit: int, offset: int,
                         search: str | None = None) -> tuple[list[Medicine], int]:
    stmt = select(Medicine)
    count_stmt = select(func.count()).select_from(Medicine)
    if active_only:
        stmt = stmt.where(Medicine.is_active == True)  # noqa: E712
        count_stmt = count_stmt.where(Medicine.is_active == True)  # noqa: E712
    if search:
        like = f"%{search}%"
        stmt = stmt.where(Medicine.name.ilike(like))
        count_stmt = count_stmt.where(Medicine.name.ilike(like))
    total = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Medicine.name.asc()).limit(limit).offset(offset)
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows), total


async def get_medicine(session: AsyncSession, medicine_id: int) -> Medicine | None:
    return (await session.execute(
        select(Medicine).where(Medicine.id == medicine_id)
    )).scalar_one_or_none()


async def create_medicine(session: AsyncSession, data: dict, user_id: int) -> Medicine:
    medicine = Medicine(creator_id=user_id, **data)
    session.add(medicine)
    await session.flush()  # assign id before history
    await _append_history(session, medicine, "CREATE", None, user_id)
    await session.commit()
    await session.refresh(medicine)
    return medicine


async def update_medicine(session: AsyncSession, medicine: Medicine, data: dict, user_id: int) -> Medicine:
    changed = [k for k in _HISTORY_FIELDS if k in data and getattr(medicine, k) != data[k]]
    for k, v in data.items():
        setattr(medicine, k, v)
    medicine.updated_at = _now()
    session.add(medicine)
    if changed:
        if "is_active" in changed:
            change_type = "ARCHIVE" if not medicine.is_active else "RESTORE"
        else:
            change_type = "UPDATE"
        await _append_history(session, medicine, change_type, changed, user_id)
    await session.commit()
    await session.refresh(medicine)
    return medicine


async def has_active_links(session: AsyncSession, medicine_id: int) -> bool:
    """True if any non-deleted stock references this medicine (blocks hard delete)."""
    stock = (await session.execute(
        select(func.count()).select_from(MedicineStock).where(
            MedicineStock.medicine_id == medicine_id,
            MedicineStock.deleted_at.is_(None),
        )
    )).scalar_one()
    return stock > 0


async def archive_medicine(session: AsyncSession, medicine: Medicine, user_id: int) -> Medicine:
    """Soft-archive (is_active=False)."""
    return await update_medicine(session, medicine, {"is_active": False}, user_id)
```

> **Phase 2 note:** `has_active_links` will be extended to also count `t_f_medicine_course` rows. Stock-only is correct for Phase 1 (no course table yet).

- [ ] **Step 2: Create `backend/app/services/family_member_service.py`**

```python
"""Family member service: CRUD + delete-guard (block while active courses exist)."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.family_member import FamilyMember
from backend.app.utils.timezone import now_local


def _now():
    return now_local().replace(tzinfo=None)


async def list_family_members(session: AsyncSession, *, active_only: bool = True) -> tuple[list[FamilyMember], int]:
    stmt = select(FamilyMember)
    if active_only:
        stmt = stmt.where(FamilyMember.is_active == True)  # noqa: E712
    rows = (await session.execute(stmt.order_by(FamilyMember.name.asc()))).scalars().all()
    return list(rows), len(rows)


async def get_family_member(session: AsyncSession, member_id: int) -> FamilyMember | None:
    return (await session.execute(
        select(FamilyMember).where(FamilyMember.id == member_id)
    )).scalar_one_or_none()


async def create_family_member(session: AsyncSession, data: dict, default_guardian_id: int) -> FamilyMember:
    data = dict(data)
    if not data.get("guardian_user_id"):
        data["guardian_user_id"] = default_guardian_id
    member = FamilyMember(**data)
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member


async def update_family_member(session: AsyncSession, member: FamilyMember, data: dict) -> FamilyMember:
    for k, v in data.items():
        if v is not None:
            setattr(member, k, v)
    member.updated_at = _now()
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member


async def has_active_links(session: AsyncSession, member_id: int) -> bool:
    """Phase 1: no courses table yet → always False. Phase 2 extends this to count courses."""
    return False


async def archive_family_member(session: AsyncSession, member: FamilyMember) -> FamilyMember:
    """Soft-archive (is_active=False) — mirrors Medicine. No hard delete (spec decision)."""
    member.is_active = False
    member.updated_at = _now()
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member
```

- [ ] **Step 3: Create `backend/app/services/medicine_stock_service.py`**

```python
"""Medicine stock service: CRUD with soft-delete + version; expiring/low-stock queries."""
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import func, select

from backend.app.models.medicine_stock import MedicineStock
from backend.app.utils.timezone import now_local


def _now():
    return now_local().replace(tzinfo=None)


async def list_stock(session: AsyncSession, *, limit: int, offset: int,
                     expiring_in_days: int | None = None,
                     medicine_id: int | None = None) -> tuple[list[MedicineStock], int]:
    stmt = select(MedicineStock).where(MedicineStock.deleted_at.is_(None))
    count_stmt = select(func.count()).select_from(MedicineStock).where(MedicineStock.deleted_at.is_(None))
    if medicine_id is not None:
        stmt = stmt.where(MedicineStock.medicine_id == medicine_id)
        count_stmt = count_stmt.where(MedicineStock.medicine_id == medicine_id)
    if expiring_in_days is not None:
        cutoff = _now().date() + timedelta(days=expiring_in_days)
        stmt = stmt.where(MedicineStock.expiry_date <= cutoff)
        count_stmt = count_stmt.where(MedicineStock.expiry_date <= cutoff)
    total = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(MedicineStock.expiry_date.asc()).limit(limit).offset(offset)
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows), total


async def get_stock(session: AsyncSession, stock_id: int) -> MedicineStock | None:
    return (await session.execute(
        select(MedicineStock).where(
            MedicineStock.id == stock_id, MedicineStock.deleted_at.is_(None)
        )
    )).scalar_one_or_none()


async def create_stock(session: AsyncSession, data: dict, user_id: int) -> MedicineStock:
    stock = MedicineStock(creator_id=user_id, **data)
    session.add(stock)
    await session.commit()
    await session.refresh(stock)
    return stock


async def update_stock(session: AsyncSession, stock: MedicineStock, data: dict, user_id: int) -> MedicineStock:
    for k, v in data.items():
        if v is not None:
            setattr(stock, k, v)
    stock.version += 1
    stock.last_modified_by = user_id
    stock.updated_at = _now()
    session.add(stock)
    await session.commit()
    await session.refresh(stock)
    return stock


async def soft_delete_stock(session: AsyncSession, stock: MedicineStock, user_id: int) -> None:
    stock.deleted_at = _now()
    stock.version += 1
    stock.last_modified_by = user_id
    stock.updated_at = _now()
    session.add(stock)
    await session.commit()
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/medicine_service.py backend/app/services/family_member_service.py \
  backend/app/services/medicine_stock_service.py
git commit -m "feat(medicine): phase1 services — catalog+history, family member, stock"
```

---

## Task 5: WebSocket broadcast wrapper

**Files:**
- Modify: `backend/app/api/v1/endpoints/budget_ws.py`

Add a typed `medicine_*` broadcast wrapper next to the existing `broadcast_shopping_list_*` functions. It reuses `_broadcast_and_buffer(event_type, data)`.

- [ ] **Step 1: Append the wrapper in `budget_ws.py`**

Add after the existing `broadcast_shopping_list_deleted` function:

```python
async def broadcast_medicine_changed(entity: str, data: dict):
    """Broadcast a medicine-domain change. entity ∈ {catalog, family_member, stock}.

    All connected clients receive every event (no channels/subscriptions, like
    shopping_list_*). The client filters by entity/patient on its side.
    """
    event_type = "medicine_stock_changed" if entity == "stock" else f"medicine_{entity}_changed"
    await _broadcast_and_buffer(event_type, data)
```

> Event names: `medicine_catalog_changed`, `medicine_family_member_changed`, `medicine_stock_changed`. Phase 2/3 add `medicine_course_changed`, `medicine_intake_marked`.

- [ ] **Step 2: Verify import compiles**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.api.v1.endpoints.budget_ws"`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/budget_ws.py
git commit -m "feat(medicine): phase1 websocket broadcast wrapper"
```

---

## Task 6: API endpoints + router registration

**Files:**
- Create: `backend/app/api/v1/endpoints/medicines.py`
- Create: `backend/app/api/v1/endpoints/family_members.py`
- Modify: `backend/app/api/v1/endpoints/__init__.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Create `backend/app/api/v1/endpoints/medicines.py`** (catalog + stock routers in one module)

```python
"""Medicine catalog + stock REST endpoints (shared across all family users)."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.v1.endpoints.budget_ws import broadcast_medicine_changed
from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.medicine import (
    MedicineCreate, MedicineListResponse, MedicineResponse, MedicineUpdate,
)
from backend.app.schemas.medicine_stock import (
    MedicineStockCreate, MedicineStockListResponse, MedicineStockResponse, MedicineStockUpdate,
)
from backend.app.services import medicine_service, medicine_stock_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/medicines", tags=["medicines"], responses=get_common_responses())
stock_router = APIRouter(prefix="/medicine-stock", tags=["medicine-stock"], responses=get_common_responses())


# ---------- Catalog ----------
@router.get("", response_model=MedicineListResponse, summary="List medicines")
async def list_medicines(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    active_only: bool = Query(True),
    q: str | None = Query(None, description="Search by name (ilike)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> MedicineListResponse:
    rows, total = await medicine_service.list_medicines(
        session, active_only=active_only, limit=limit, offset=offset, search=q)
    return MedicineListResponse(
        medicines=[MedicineResponse.model_validate(r) for r in rows],
        total=total, limit=limit, offset=offset)


@router.get("/search", response_model=MedicineListResponse, summary="Search medicines")
async def search_medicines(
    q: str = Query(..., min_length=1),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
) -> MedicineListResponse:
    rows, total = await medicine_service.list_medicines(
        session, active_only=True, limit=limit, offset=0, search=q)
    return MedicineListResponse(
        medicines=[MedicineResponse.model_validate(r) for r in rows],
        total=total, limit=limit, offset=0)


@router.get("/{medicine_id}", response_model=MedicineResponse)
async def get_medicine(
    medicine_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    m = await medicine_service.get_medicine(session, medicine_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {medicine_id} not found")
    return MedicineResponse.model_validate(m)


@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
async def create_medicine(
    data: MedicineCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    m = await medicine_service.create_medicine(session, data.model_dump(), current_user.id)
    resp = MedicineResponse.model_validate(m)
    await broadcast_medicine_changed("catalog", resp.model_dump(mode="json"))
    return resp


@router.patch("/{medicine_id}", response_model=MedicineResponse)
async def update_medicine(
    medicine_id: int, data: MedicineUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    m = await medicine_service.get_medicine(session, medicine_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {medicine_id} not found")
    m = await medicine_service.update_medicine(
        session, m, data.model_dump(exclude_unset=True), current_user.id)
    resp = MedicineResponse.model_validate(m)
    await broadcast_medicine_changed("catalog", resp.model_dump(mode="json"))
    return resp


@router.delete("/{medicine_id}", response_model=MedicineResponse, summary="Soft-archive medicine")
async def delete_medicine(
    medicine_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineResponse:
    m = await medicine_service.get_medicine(session, medicine_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {medicine_id} not found")
    if await medicine_service.has_active_links(session, medicine_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot archive: medicine has active stock")
    m = await medicine_service.archive_medicine(session, m, current_user.id)
    resp = MedicineResponse.model_validate(m)
    await broadcast_medicine_changed("catalog", resp.model_dump(mode="json"))
    return resp


# ---------- Stock ----------
@stock_router.get("", response_model=MedicineStockListResponse, summary="List stock")
async def list_stock(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    expiring_in_days: int | None = Query(None, ge=0),
    medicine_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> MedicineStockListResponse:
    rows, total = await medicine_stock_service.list_stock(
        session, limit=limit, offset=offset,
        expiring_in_days=expiring_in_days, medicine_id=medicine_id)
    return MedicineStockListResponse(
        stock=[MedicineStockResponse.model_validate(r) for r in rows],
        total=total, limit=limit, offset=offset)


@stock_router.post("", response_model=MedicineStockResponse, status_code=status.HTTP_201_CREATED)
async def create_stock(
    data: MedicineStockCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineStockResponse:
    if not await medicine_service.get_medicine(session, data.medicine_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {data.medicine_id} not found")
    s = await medicine_stock_service.create_stock(session, data.model_dump(), current_user.id)
    resp = MedicineStockResponse.model_validate(s)
    await broadcast_medicine_changed("stock", resp.model_dump(mode="json"))
    return resp


@stock_router.patch("/{stock_id}", response_model=MedicineStockResponse)
async def update_stock(
    stock_id: int, data: MedicineStockUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineStockResponse:
    s = await medicine_stock_service.get_stock(session, stock_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Stock {stock_id} not found")
    s = await medicine_stock_service.update_stock(
        session, s, data.model_dump(exclude_unset=True), current_user.id)
    resp = MedicineStockResponse.model_validate(s)
    await broadcast_medicine_changed("stock", resp.model_dump(mode="json"))
    return resp


@stock_router.delete("/{stock_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stock(
    stock_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    s = await medicine_stock_service.get_stock(session, stock_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Stock {stock_id} not found")
    await medicine_stock_service.soft_delete_stock(session, s, current_user.id)
    await broadcast_medicine_changed("stock", {"id": stock_id, "deleted": True})
    return None
```

- [ ] **Step 2: Create `backend/app/api/v1/endpoints/family_members.py`**

```python
"""Family member REST endpoints (shared across all family users)."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.v1.endpoints.budget_ws import broadcast_medicine_changed
from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.family_member import (
    FamilyMemberCreate, FamilyMemberListResponse, FamilyMemberResponse, FamilyMemberUpdate,
)
from backend.app.services import family_member_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/family-members", tags=["family-members"], responses=get_common_responses())


@router.get("", response_model=FamilyMemberListResponse)
async def list_family_members(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FamilyMemberListResponse:
    rows, total = await family_member_service.list_family_members(session)
    return FamilyMemberListResponse(
        family_members=[FamilyMemberResponse.model_validate(r) for r in rows], total=total)


@router.post("", response_model=FamilyMemberResponse, status_code=status.HTTP_201_CREATED)
async def create_family_member(
    data: FamilyMemberCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FamilyMemberResponse:
    m = await family_member_service.create_family_member(
        session, data.model_dump(), default_guardian_id=current_user.id)
    resp = FamilyMemberResponse.model_validate(m)
    await broadcast_medicine_changed("family_member", resp.model_dump(mode="json"))
    return resp


@router.patch("/{member_id}", response_model=FamilyMemberResponse)
async def update_family_member(
    member_id: int, data: FamilyMemberUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FamilyMemberResponse:
    m = await family_member_service.get_family_member(session, member_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Family member {member_id} not found")
    m = await family_member_service.update_family_member(
        session, m, data.model_dump(exclude_unset=True))
    resp = FamilyMemberResponse.model_validate(m)
    await broadcast_medicine_changed("family_member", resp.model_dump(mode="json"))
    return resp


@router.delete("/{member_id}", response_model=FamilyMemberResponse, summary="Soft-archive family member")
async def delete_family_member(
    member_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FamilyMemberResponse:
    m = await family_member_service.get_family_member(session, member_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Family member {member_id} not found")
    if await family_member_service.has_active_links(session, member_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot archive: family member has active courses")
    m = await family_member_service.archive_family_member(session, m)
    resp = FamilyMemberResponse.model_validate(m)
    await broadcast_medicine_changed("family_member", resp.model_dump(mode="json"))
    return resp
```

- [ ] **Step 3: Export routers in `backend/app/api/v1/endpoints/__init__.py`**

Add imports (near the other endpoint imports):

```python
from backend.app.api.v1.endpoints.family_members import router as family_members_router
from backend.app.api.v1.endpoints.medicines import router as medicines_router
from backend.app.api.v1.endpoints.medicines import stock_router as medicine_stock_router
```

Add to `__all__`:

```python
    "family_members_router",
    "medicines_router",
    "medicine_stock_router",
```

- [ ] **Step 4: Include routers in `backend/app/api/v1/router.py`**

In the `from backend.app.api.v1.endpoints import (` block, add `family_members_router`, `medicines_router`, `medicine_stock_router` to the imported names. Then near the other `api_router.include_router(...)` calls (e.g. after `api_router.include_router(shopping_csv_import_router)`), add:

```python
api_router.include_router(medicines_router)
api_router.include_router(medicine_stock_router)
api_router.include_router(family_members_router)
```

(Match the indentation of the surrounding `include_router` lines — they are top-level, no leading spaces.)

- [ ] **Step 5: Verify app imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "from backend.app.api.v1.router import api_router; print('ok')"`
Expected: prints `ok` (routers registered, no import errors).

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/endpoints/medicines.py backend/app/api/v1/endpoints/family_members.py \
  backend/app/api/v1/endpoints/__init__.py backend/app/api/v1/router.py
git commit -m "feat(medicine): phase1 API — medicines, medicine-stock, family-members"
```

---

## Task 7: Integration tests (catalog + family + stock)

**Files:**
- Test: `tests/integration/backend/test_medicines_api.py`

Mirror `tests/integration/backend/test_shopping_lists.py` for client/auth fixtures. Inspect that file first and reuse its exact fixture names (the skeleton below uses `async_client` and `auth_headers` — rename to match).

- [ ] **Step 1: Write the integration test**

```python
"""Integration tests for Phase 1 medicine API (catalog, family, stock)."""
import pytest

from backend.app.services.medicine_alert_service import get_expiring_stock


@pytest.mark.asyncio
async def test_medicine_crud_and_history(async_client, auth_headers):
    r = await async_client.post("/api/v1/medicines", headers=auth_headers,
        json={"name": "Нурофен 200мг", "form": "tablet", "dosage": "200 mg"})
    assert r.status_code == 201, r.text
    mid = r.json()["id"]

    r = await async_client.get("/api/v1/medicines", headers=auth_headers)
    assert any(m["id"] == mid for m in r.json()["medicines"])

    r = await async_client.patch(f"/api/v1/medicines/{mid}", headers=auth_headers,
        json={"name": "Нурофен 400мг"})
    assert r.status_code == 200
    assert r.json()["name"] == "Нурофен 400мг"

    r = await async_client.get("/api/v1/medicines/search?q=Нурофен", headers=auth_headers)
    assert r.json()["total"] >= 1


@pytest.mark.asyncio
async def test_bad_form_rejected(async_client, auth_headers):
    r = await async_client.post("/api/v1/medicines", headers=auth_headers,
        json={"name": "X", "form": "powder"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_stock_crud_and_expiring_filter(async_client, auth_headers):
    r = await async_client.post("/api/v1/medicines", headers=auth_headers,
        json={"name": "Парацетамол", "form": "tablet"})
    mid = r.json()["id"]

    r = await async_client.post("/api/v1/medicine-stock", headers=auth_headers, json={
        "medicine_id": mid, "quantity_remaining": "20", "quantity_initial": "20",
        "unit": "шт", "expiry_date": "2026-06-25"})
    assert r.status_code == 201, r.text
    sid = r.json()["id"]

    r = await async_client.get("/api/v1/medicine-stock?expiring_in_days=30", headers=auth_headers)
    assert any(s["id"] == sid for s in r.json()["stock"])

    # Archiving the medicine is blocked while active stock exists → 409
    r = await async_client.delete(f"/api/v1/medicines/{mid}", headers=auth_headers)
    assert r.status_code == 409

    # Soft-delete stock → then archive succeeds
    r = await async_client.delete(f"/api/v1/medicine-stock/{sid}", headers=auth_headers)
    assert r.status_code == 204
    r = await async_client.delete(f"/api/v1/medicines/{mid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_active"] is False


@pytest.mark.asyncio
async def test_family_member_crud(async_client, auth_headers):
    r = await async_client.post("/api/v1/family-members", headers=auth_headers, json={"name": "Маша"})
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    assert r.json()["guardian_user_id"] is not None  # defaulted to current user

    r = await async_client.get("/api/v1/family-members", headers=auth_headers)
    assert any(m["id"] == fid for m in r.json()["family_members"])

    # DELETE = soft-archive (spec): returns 200 + is_active False, drops from active list
    r = await async_client.delete(f"/api/v1/family-members/{fid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_active"] is False
    r = await async_client.get("/api/v1/family-members", headers=auth_headers)
    assert not any(m["id"] == fid for m in r.json()["family_members"])


@pytest.mark.asyncio
async def test_get_expiring_stock_join(async_client, auth_headers, db_session):
    """get_expiring_stock returns the medicine name (SQL join) for stock within the window."""
    r = await async_client.post("/api/v1/medicines", headers=auth_headers,
        json={"name": "Аспирин", "form": "tablet"})
    mid = r.json()["id"]
    await async_client.post("/api/v1/medicine-stock", headers=auth_headers, json={
        "medicine_id": mid, "quantity_remaining": "5", "quantity_initial": "5",
        "unit": "шт", "expiry_date": "2026-06-20"})  # within 30d of 2026-06-15

    rows = await get_expiring_stock(db_session)
    assert any(row["name"] == "Аспирин" and row["unit"] == "шт" for row in rows)
```

- [ ] **Step 2: Run integration tests**

Run: `cd tests && ./run-tests.sh backend`
Expected: PASS for `test_medicines_api.py`. If `auth_headers`/`async_client` names differ, fix to match `test_shopping_lists.py` and re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/backend/test_medicines_api.py
git commit -m "test(medicine): phase1 API integration tests"
```

---

## Task 8: Daily expiry-alert maintenance job

**Files:**
- Create: `backend/app/services/medicine_alert_service.py`
- Modify: `backend/app/scheduler.py`
- Test: `tests/unit/backend/test_medicine_alert.py`

The maintenance job (`LOCK_ID_MEDICINE_MAINTENANCE = 1010`, daily 03:00) holds only the expiry-alert part «в» this phase; Phase 2 adds parts «а»,«б». Expiry alerts broadcast directly via Telegram (no `t_medicine_reminder`), mirroring `NotificationService.check_all_budget_thresholds`.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/backend/test_medicine_alert.py`:

```python
"""Unit tests for expiry-alert message formatting (no scheduler / no DB)."""
from datetime import date

from backend.app.services.medicine_alert_service import format_expiry_message


def test_format_expiry_message_single():
    msg = format_expiry_message([
        {"name": "Нурофен 200мг", "expiry_date": date(2026, 7, 1), "quantity_remaining": 12, "unit": "шт"}
    ])
    assert "Нурофен 200мг" in msg
    assert "2026-07-01" in msg


def test_format_expiry_message_empty_returns_none():
    assert format_expiry_message([]) is None
```

- [ ] **Step 2: Run it to verify it fails**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend/test_medicine_alert.py -v`
Expected: FAIL — module/function not defined.

- [ ] **Step 3: Verify reused API, then create `backend/app/services/medicine_alert_service.py`**

First confirm the `NotificationService` methods and `User` columns this job relies on actually exist (mirrors `check_all_budget_thresholds`). Adjust the code below to the real names if they differ:

```bash
PYTHONPATH=. backend/.venv/bin/python - <<'PY'
from backend.app.services.notification_service import NotificationService
from backend.app.models import User
print("NS methods:", sorted(m for m in dir(NotificationService) if not m.startswith('__')))
print("User cols:", [c.name for c in User.__table__.columns])
PY
```
Expected: `NotificationService` exposes `get_active_users`, `send_telegram_message`, and a web-push sender (e.g. `send_web_push_to_user` / `_send_web_push_to_user`); `User` has `telegram_id`, `enable_telegram_notifications`, and a web-push opt-in flag (e.g. `enable_web_push_notifications`). **Map any name differences into the service below before running the test.** The two web-push lines marked `# VERIFY` are the only spots whose exact symbol depends on this grep.

```python
"""Daily medicine expiry alerts: query expiring stock, format + send via Telegram + Web Push.

Mirrors NotificationService.check_all_budget_thresholds: broadcasts directly to all
active users (no t_medicine_reminder rows — those are only for course intakes).
Web Push payload follows spec decision #5: data.type="medicine_expiry", data.url="/medicines",
no action buttons (click opens the dashboard).
"""
import logging
from datetime import timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.services.notification_service import NotificationService
from backend.app.utils.timezone import now_local

logger = logging.getLogger(__name__)

EXPIRY_WINDOW_DAYS = 30


def format_expiry_message(items: list[dict]) -> str | None:
    """Format an expiry-alert message. Returns None when there is nothing to report."""
    if not items:
        return None
    lines = ["💊 *Скоро истекает срок годности*", "---"]
    for it in items:
        lines.append(f"• {it['name']} — до {it['expiry_date']}, "
                     f"остаток {it['quantity_remaining']} {it['unit']}")
    return "\n".join(lines)


async def get_expiring_stock(session: AsyncSession) -> list[dict]:
    """Stock expiring within EXPIRY_WINDOW_DAYS with remaining > 0 (joined to name)."""
    cutoff = now_local().date() + timedelta(days=EXPIRY_WINDOW_DAYS)
    rows = await session.execute(text("""
        SELECT m.name AS name, s.expiry_date AS expiry_date,
               s.quantity_remaining AS quantity_remaining, s.unit AS unit
        FROM t_f_medicine_stock s
        JOIN t_d_medicine m ON m.id = s.medicine_id
        WHERE s.deleted_at IS NULL
          AND s.quantity_remaining > 0
          AND s.expiry_date <= :cutoff
        ORDER BY s.expiry_date ASC
    """), {"cutoff": cutoff})
    return [dict(r._mapping) for r in rows]


async def send_expiry_alerts(session: AsyncSession, settings) -> int:
    """Broadcast expiry alert to all active users via Telegram + Web Push. Returns total pushes sent."""
    items = await get_expiring_stock(session)
    message = format_expiry_message(items)
    if not message:
        return 0
    svc = NotificationService(settings)
    users = await svc.get_active_users(session)
    sent = 0
    # Telegram
    for u in users:
        if u.telegram_id and u.enable_telegram_notifications:
            if await svc.send_telegram_message(telegram_id=u.telegram_id, message=message):
                sent += 1
    # Web Push (spec decision #5: click opens /medicines, no action buttons)
    web_payload = {
        "title": "💊 Скоро истекает срок годности",
        "body": f"{len(items)} позиций в аптечке требуют внимания.",
        "data": {"type": "medicine_expiry", "url": "/medicines"},
    }
    for u in users:
        if getattr(u, "enable_web_push_notifications", False):                  # VERIFY field name
            if await svc.send_web_push_to_user(session, u, web_payload):        # VERIFY method name
                sent += 1
    logger.info("[MEDICINE] Expiry alert: %s pushes sent (%s items)", sent, len(items))
    return sent
```

> Both delivery paths broadcast directly (no `t_medicine_reminder` rows — those are only for course intakes). The in-app ⏰ badge (Task 9) is the immediate in-page signal. If the web-push sender requires a pre-fetched subscription list instead of a `(session, user, payload)` call, mirror whatever `check_all_budget_thresholds` does — that is the canonical example.

- [ ] **Step 4: Run unit test to verify it passes**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend/test_medicine_alert.py -v`
Expected: PASS.

- [ ] **Step 5: Register the maintenance job in `backend/app/scheduler.py`**

Add the lock constants near the other `LOCK_ID_*` definitions (after `LOCK_ID_WEBAUTHN_CLEANUP = 1008`):

```python
LOCK_ID_MEDICINE_DISPATCH = 1009      # reserved for Phase 3 (every 5 min)
LOCK_ID_MEDICINE_MAINTENANCE = 1010   # daily medicine maintenance (expiry + Phase 2 generation)
```

Add the job function after `generate_recurring_facts_job`:

```python
async def medicine_maintenance_job():
    """Daily medicine maintenance. Phase 1: expiry alerts. Phase 2 adds intake_log generation + scheduled→late."""
    logger.info("[SCHEDULER] Starting medicine maintenance job")
    try:
        async with advisory_xact_lock(LOCK_ID_MEDICINE_MAINTENANCE) as acquired:
            if not acquired:
                logger.info("[SCHEDULER] Medicine maintenance skipped - another worker is executing")
                return
            settings = get_settings()
            from backend.app.services.medicine_alert_service import send_expiry_alerts
            async with get_session_context() as session:
                sent = await send_expiry_alerts(session, settings)
            logger.info("[SCHEDULER] Medicine maintenance done: %s expiry alerts sent", sent)
    except Exception as e:
        logger.error("[SCHEDULER] Error in medicine maintenance job: %s", e, exc_info=True)
        raise
```

Register it inside `init_scheduler()` after Job 7 (`cleanup_expired_webauthn_challenges`), before `return scheduler`:

```python
    # Job 8: Medicine maintenance (daily at 03:00 SYSTEM_TIMEZONE, after recurring facts at 02:00)
    scheduler.add_job(
        medicine_maintenance_job,
        trigger=CronTrigger(hour=3, minute=0),
        id="medicine_maintenance",
        name="Medicine Maintenance (expiry alerts)",
        replace_existing=True,
    )
    logger.info(f"[SCHEDULER] Registered job: medicine_maintenance (daily at 03:00 {settings.SYSTEM_TIMEZONE})")
```

- [ ] **Step 6: Verify scheduler imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.scheduler as s; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/medicine_alert_service.py backend/app/scheduler.py \
  tests/unit/backend/test_medicine_alert.py
git commit -m "feat(medicine): phase1 daily expiry-alert maintenance job"
```

---

## Task 9: Frontend — catalog + stock pages

**Files:**
- Modify: `build-all.js`
- Modify: `backend/app/api/web/router.py`
- Create: `frontend/web/templates/medicines_catalog.html`
- Create: `frontend/web/templates/medicines_stock.html`
- Create: `frontend/web/static/js/medicines-bundle.ts`
- Create: `frontend/web/static/js/medicines/medicinesManager.ts`

Keep frontend minimal (simplicity-first): one manager file with fetch+render+WS for both pages, exported on `window`. No multi-file modular tree.

- [ ] **Step 1: Add the bundle entry in `build-all.js`**

In the `const builds = [` array, after the `plan` entry, add:

```javascript
  {
    name: 'medicines',
    input: 'frontend/web/static/js/medicines-bundle.ts',
    output: 'frontend/web/static/js/medicines.min.js',
    globalName: 'MedicinesApp'
  },
```

- [ ] **Step 2: Create `frontend/web/static/js/medicines/medicinesManager.ts`**

```typescript
// Medicines manager: catalog + stock pages. Fetch via REST, re-render, react to WS events.
// Public functions are attached to window in medicines-bundle.ts.

declare const showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

interface Medicine { id: number; name: string; form: string; dosage: string | null; is_active: boolean; }
interface Stock {
  id: number; medicine_id: number; quantity_remaining: string; unit: string;
  expiry_date: string; location: string | null;
}

async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.status === 204 ? (undefined as T) : res.json();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// ---------- Catalog ----------
export async function loadCatalog(): Promise<void> {
  const data = await api<{ medicines: Medicine[] }>('/api/v1/medicines?active_only=true&limit=500');
  renderCatalog(data.medicines);
}

function renderCatalog(meds: Medicine[]): void {
  const root = document.getElementById('medicines-catalog-body');
  if (!root) return;
  root.innerHTML = meds.map(m => `
    <tr data-id="${m.id}">
      <td>${escapeHtml(m.name)}</td>
      <td>${m.form}</td>
      <td>${escapeHtml(m.dosage ?? '')}</td>
      <td class="text-right">
        <button class="btn btn-ghost btn-xs" onclick="window.medicineArchive(${m.id})">Архив</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="4" class="text-center opacity-60">Пусто</td></tr>`;
}

export async function createMedicineFromForm(): Promise<void> {
  const name = (document.getElementById('med-name') as HTMLInputElement)?.value.trim();
  const form = (document.getElementById('med-form') as HTMLSelectElement)?.value;
  const dosage = (document.getElementById('med-dosage') as HTMLInputElement)?.value.trim() || null;
  if (!name) { showToast('Введите название', 'warning'); return; }
  await api('/api/v1/medicines', { method: 'POST', body: JSON.stringify({ name, form, dosage }) });
  showToast('Лекарство добавлено', 'success');
  await loadCatalog();
}

export async function medicineArchive(id: number): Promise<void> {
  try {
    await api(`/api/v1/medicines/${id}`, { method: 'DELETE' });
    showToast('Архивировано', 'success');
    await loadCatalog();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

// ---------- Stock ----------
const medicineNames = new Map<number, string>();

// Populate the medicine <select> + name cache (used to label stock rows).
export async function loadMedicineOptions(): Promise<void> {
  const sel = document.getElementById('stock-medicine') as HTMLSelectElement | null;
  const data = await api<{ medicines: Medicine[] }>('/api/v1/medicines?active_only=true&limit=500');
  medicineNames.clear();
  for (const m of data.medicines) medicineNames.set(m.id, m.name);
  if (sel) {
    sel.innerHTML = '<option value="">— лекарство —</option>' +
      data.medicines.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  }
}

export async function loadStock(expiringDays?: number): Promise<void> {
  if (medicineNames.size === 0) await loadMedicineOptions();
  const q = expiringDays != null ? `?expiring_in_days=${expiringDays}&limit=500` : '?limit=500';
  const data = await api<{ stock: Stock[] }>(`/api/v1/medicine-stock${q}`);
  renderStock(data.stock);
}

function renderStock(rows: Stock[]): void {
  const root = document.getElementById('medicines-stock-body');
  if (!root) return;
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  root.innerHTML = rows.map(s => {
    const badge = s.expiry_date <= soon
      ? `<span class="badge ${s.expiry_date <= today ? 'badge-error' : 'badge-warning'} badge-sm">⏰</span>` : '';
    const name = medicineNames.get(s.medicine_id) ?? `#${s.medicine_id}`;
    return `<tr data-id="${s.id}">
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(s.unit)} · ${s.quantity_remaining}</td>
      <td>${s.expiry_date} ${badge}</td>
      <td>${escapeHtml(s.location ?? '')}</td>
      <td class="text-right">
        <button class="btn btn-ghost btn-xs" onclick="window.stockDelete(${s.id})">Удалить</button>
      </td></tr>`;
  }).join('') || `<tr><td colspan="5" class="text-center opacity-60">Пусто</td></tr>`;
}

export async function createStockFromForm(): Promise<void> {
  const medicineId = Number((document.getElementById('stock-medicine') as HTMLSelectElement)?.value);
  const qty = (document.getElementById('stock-qty') as HTMLInputElement)?.value.trim();
  const unit = (document.getElementById('stock-unit') as HTMLInputElement)?.value.trim();
  const expiry = (document.getElementById('stock-expiry') as HTMLInputElement)?.value;
  const location = (document.getElementById('stock-location') as HTMLInputElement)?.value.trim() || null;
  if (!medicineId) { showToast('Выберите лекарство', 'warning'); return; }
  if (!qty || Number(qty) <= 0) { showToast('Укажите количество', 'warning'); return; }
  if (!unit) { showToast('Укажите единицу', 'warning'); return; }
  if (!expiry) { showToast('Укажите срок годности', 'warning'); return; }
  try {
    await api('/api/v1/medicine-stock', {
      method: 'POST',
      body: JSON.stringify({
        medicine_id: medicineId, quantity_remaining: qty, quantity_initial: qty,
        unit, expiry_date: expiry, location,
      }),
    });
    showToast('Добавлено в аптечку', 'success');
    await loadStock();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

export async function stockDelete(id: number): Promise<void> {
  await api(`/api/v1/medicine-stock/${id}`, { method: 'DELETE' });
  showToast('Удалено', 'success');
  await loadStock();
}

// ---------- WebSocket ----------
export function handleMedicineEvent(eventType: string): void {
  if (eventType === 'medicine_catalog_changed' && document.getElementById('medicines-catalog-body')) loadCatalog();
  if (eventType === 'medicine_stock_changed' && document.getElementById('medicines-stock-body')) loadStock();
}
```

- [ ] **Step 3: Create `frontend/web/static/js/medicines-bundle.ts`**

```typescript
// Medicines bundle entry — wires the manager onto window for onclick handlers + WS.
import {
  loadCatalog, createMedicineFromForm, medicineArchive,
  loadStock, loadMedicineOptions, createStockFromForm, stockDelete, handleMedicineEvent,
} from './medicines/medicinesManager';

const windowExports = {
  loadCatalog, createMedicineFromForm, medicineArchive,
  loadStock, loadMedicineOptions, createStockFromForm, stockDelete, handleMedicineEvent,
};

try {
  if (typeof window !== 'undefined') {
    Object.assign(window, windowExports);
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('medicines-catalog-body')) loadCatalog();
      if (document.getElementById('medicines-stock-body')) loadStock();
    });
    const ws = (window as any).budgetWSClient;
    if (ws && typeof ws.addEventListener === 'function') {
      ['medicine_catalog_changed', 'medicine_stock_changed'].forEach(t =>
        ws.addEventListener(t, () => handleMedicineEvent(t)));
    }
  }
} catch (e) {
  console.error('[MEDICINES_BUNDLE] init error', e);
}
```

> If `budgetWSClient` does not expose `addEventListener`, inspect `frontend/web/static/js/budget/budgetWSClient.js` for its event-dispatch API (e.g. `onMessage`/`subscribe`) and adapt. WS auto-refresh is an enhancement; pages work without it (reload re-fetches).

- [ ] **Step 4: Create `frontend/web/templates/medicines_catalog.html`**

```jinja2
{% extends "base.html" %}

{% block content %}
<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold">Справочник лекарств</h1>
  </div>

  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
      <input id="med-name" class="input input-bordered input-sm" placeholder="Название" />
      <select id="med-form" class="select select-bordered select-sm">
        <option value="tablet">таблетка</option>
        <option value="capsule">капсула</option>
        <option value="syrup">сироп</option>
        <option value="drops">капли</option>
        <option value="ointment">мазь</option>
        <option value="spray">спрей</option>
        <option value="injection">инъекция</option>
        <option value="other">другое</option>
      </select>
      <input id="med-dosage" class="input input-bordered input-sm" placeholder="Дозировка" />
      <button class="btn btn-primary btn-sm" onclick="window.createMedicineFromForm()">Добавить</button>
    </div>
  </div>

  <div class="overflow-x-auto">
    <table class="table table-sm">
      <thead><tr><th>Название</th><th>Форма</th><th>Дозировка</th><th></th></tr></thead>
      <tbody id="medicines-catalog-body"></tbody>
    </table>
  </div>
</div>
{% endblock %}

{% block extra_scripts %}
<script src="/static/js/medicines.min.js?v=PLACEHOLDER"></script>
{% endblock %}
```

- [ ] **Step 5: Create `frontend/web/templates/medicines_stock.html`**

```jinja2
{% extends "base.html" %}

{% block content %}
<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold">Аптечка</h1>
    <div class="join">
      <button class="btn btn-sm join-item" onclick="window.loadStock()">Все</button>
      <button class="btn btn-sm join-item" onclick="window.loadStock(30)">Истекает ≤30д</button>
    </div>
  </div>

  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-4 grid grid-cols-1 sm:grid-cols-6 gap-2">
      <select id="stock-medicine" class="select select-bordered select-sm sm:col-span-2">
        <option value="">— лекарство —</option>
      </select>
      <input id="stock-qty" type="number" step="0.001" min="0" class="input input-bordered input-sm" placeholder="Кол-во" />
      <input id="stock-unit" class="input input-bordered input-sm" placeholder="Ед. (шт/мл/доз)" />
      <input id="stock-expiry" type="date" class="input input-bordered input-sm" />
      <input id="stock-location" class="input input-bordered input-sm" placeholder="Место" />
      <button class="btn btn-primary btn-sm sm:col-span-6" onclick="window.createStockFromForm()">Добавить в аптечку</button>
    </div>
  </div>

  <div class="overflow-x-auto">
    <table class="table table-sm">
      <thead><tr><th>Лекарство</th><th>Остаток</th><th>Срок годности</th><th>Место</th><th></th></tr></thead>
      <tbody id="medicines-stock-body"></tbody>
    </table>
  </div>
</div>
{% endblock %}

{% block extra_scripts %}
<script src="/static/js/medicines.min.js?v=PLACEHOLDER"></script>
{% endblock %}
```

> The stock page supports manual add (medicine select + qty/unit/expiry/location), list, expiry filter, and soft-delete in Phase 1 — so the аптечка can be populated entirely from the UI (the Phase 1 goal "видим что есть дома"). Bulk CSV / Google Sheets import is the Phase 5 wizard. `quantity_initial` is set equal to `quantity_remaining` on manual add. Note: `console.error` in `medicines-bundle.ts` is intentional — the pre-commit hook only blocks `console.log`.

- [ ] **Step 6: Add web routes in `backend/app/api/web/router.py`**

Add after the shopping-list page routes (`shopping_list_detail_page`):

```python
@web_router.get("/medicines/catalog", response_class=HTMLResponse)
async def medicines_catalog_page(request: Request, current_user: CurrentUser):
    """Medicine catalog page."""
    from backend.app.main import templates
    return templates.TemplateResponse(
        "medicines_catalog.html",
        {"request": request, "user": current_user, "page_title": "Справочник лекарств"},
    )


@web_router.get("/medicines/stock", response_class=HTMLResponse)
async def medicines_stock_page(request: Request, current_user: CurrentUser):
    """Medicine stock (аптечка) page."""
    from backend.app.main import templates
    return templates.TemplateResponse(
        "medicines_stock.html",
        {"request": request, "user": current_user, "page_title": "Аптечка"},
    )
```

- [ ] **Step 7: Build the frontend**

Run: `npm run build`
Expected: type-check passes, `frontend/web/static/js/medicines.min.js` produced. Fix any TS errors from `npm run type-check`.

- [ ] **Step 8: Commit**

```bash
git add build-all.js backend/app/api/web/router.py \
  frontend/web/templates/medicines_catalog.html frontend/web/templates/medicines_stock.html \
  frontend/web/static/js/medicines-bundle.ts frontend/web/static/js/medicines/medicinesManager.ts
git commit -m "feat(medicine): phase1 frontend — catalog + stock pages"
```

---

## Task 10: Manual verification + docs

**Files:**
- Modify: `lat.md/database.md`, `lat.md/api.md`

- [ ] **Step 1: Run the full backend suite**

Run: `cd tests && ./run-tests.sh backend`
Expected: all green (migrations apply; medicine tests pass; nothing else broke).

- [ ] **Step 2: Manual smoke (dev)**

Open `https://fbd.ikeniborn.ru/medicines/catalog` and `/medicines/stock` after deploy, OR run locally. Verify on breakpoints 375px / 768px / 1280px:
- catalog: add a medicine, it appears; archive removes it from the active list.
- stock: list renders; «Истекает ≤30д» filter narrows rows; expiring rows show ⏰ badge; delete removes a row.

- [ ] **Step 3: Update docs**

Append to `lat.md/database.md` a short section listing the 4 new tables + key columns/constraints. Append to `lat.md/api.md` the new endpoints (`/api/v1/medicines`, `/medicine-stock`, `/family-members`). Keep entries terse and consistent with existing style.

- [ ] **Step 4: Commit**

```bash
git add lat.md/database.md lat.md/api.md
git commit -m "docs(medicine): phase1 — db + api index entries"
```

---

## Phase 1 Done — Definition

- 4 tables migrated; `cd tests && ./run-tests.sh backend` green.
- Catalog + family + stock CRUD work via API with shared visibility, soft-archive, delete-guards, 409 on blocked archive.
- Catalog edits append SCD2 history rows (CREATE/UPDATE/ARCHIVE).
- Daily 03:00 maintenance job sends an expiry-alert broadcast via Telegram + Web Push; stock page shows ⏰ badges.
- Two web pages render and respond on mobile/tablet/desktop.
- WebSocket `medicine_catalog_changed` / `medicine_stock_changed` events broadcast on mutation.

**Next:** Phase 2 (`2026-06-15-medicine-tracking-phase2-courses.md`) — courses, intake_log generation, dashboard with «хватит на N».
