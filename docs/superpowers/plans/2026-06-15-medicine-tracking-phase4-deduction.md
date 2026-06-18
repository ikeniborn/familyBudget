---
result_check:
  verdict: OK
  plan_hash: 41bf7639e76aa694
  last_run: 2026-06-18
review:
  plan_hash: 41bf7639e76aa694
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
      section: "## Task 3: Deduct on take + out-of-stock handling"
      section_hash: d90630b8bf336a58
      text: "Списание меняет stock.quantity_remaining через raw UPDATE, но не шлёт broadcast `medicine_stock_changed`. Спека §Сервисы и API (стр.234) и §Frontend: «все мутации → broadcast medicine_*». mark_intake шлёт только medicine_intake_marked — другие клиенты не увидят декремент остатка в реальном времени до перезагрузки."
      verdict: fixed
      verdict_at: 2026-06-15
      fix: "Task 3 Step 3: _mark шлёт broadcast_medicine_stock_changed({id}) при intake.stock_id is not None."
    - id: F-002
      phase: coverage
      severity: WARNING
      section: "## Task 5: Integration tests (deduction, FIFO, out-of-stock, analytics)"
      section_hash: 19858f45ef87acbc
      text: "Спека §Тестирование (стр.358): «FIFO-списание + конкурентность (version)». FOR UPDATE — главный механизм защиты от double-spend, но тестов конкурентности/version-conflict нет. Покрыты только FIFO, out-of-stock, specific stock_id, analytics."
      verdict: fixed
      verdict_at: 2026-06-15
      fix: "Task 5: добавлен test_take_stale_version_conflict_deducts_once (409 + декремент ровно один раз 5→4)."
    - id: F-003
      phase: coverage
      severity: WARNING
      section: "## Task 3: Deduct on take + out-of-stock handling"
      section_hash: d90630b8bf336a58
      text: "Спека §Списание остатков (стр.219): out-of-stock → «уведомление «закончилось X» + автодобавление в shopping_list». План даёт автодобавление (Task 2) + опциональный client-side toast только отметившему (Task 6 Step 1, помечен Optional). Серверного push/broadcast «закончилось X» нет."
      verdict: fixed
      verdict_at: 2026-06-15
      fix: "Task 6 Step 1 деоптионализирован — out-of-stock notification обязателен; Done упоминает уведомление «закончилось»."
    - id: F-004
      phase: consistency
      severity: INFO
      section: "## File Structure (created/modified this phase)"
      section_hash: 8fc981c2a9e40a18
      text: "Таблица File Structure не перечисляет medicine_courses.py (Task 3 Step 3), medicinesManager.ts, lat.md/domain.md, lat.md/api.md (Task 6) — хотя они правятся и коммитятся. Документационная неполнота, коммиты их включают."
      verdict: fixed
      verdict_at: 2026-06-15
      fix: "В таблицу добавлены medicine_courses.py, medicinesManager.ts, lat.md/domain.md, lat.md/api.md."
    - id: F-005
      phase: dependencies
      severity: INFO
      section: "## Task 3: Deduct on take + out-of-stock handling"
      section_hash: d90630b8bf336a58
      text: "Task 3 Step 3 правит helper `_mark` в medicine_courses.py — артефакт Фазы 3, из спеки не верифицируется. Перед реализацией проверить, что endpoint take/skip и `_mark` действительно там (Phases 1–3 merged)."
      verdict: fixed
      verdict_at: 2026-06-15
      fix: "Task 3 Step 3: добавлена заметка «Verify first» с grep по _mark + проверка импорта broadcast-хелпера."
    - id: F-006
      phase: dependencies
      severity: INFO
      section: "## Task 1: Stock deduction service (FIFO / FOR UPDATE)"
      section_hash: 73d490f9adbd90b6
      text: "При заданном preferred_stock_id нет проверки stock.medicine_id == course.medicine_id — теоретически можно списать из упаковки чужого лекарства. Спека не требует, но логический пробел."
      verdict: fixed
      verdict_at: 2026-06-15
      fix: "Task 1: в preferred_stock_id-ветку добавлено AND medicine_id = :mid."
    - id: F-007
      phase: dependencies
      severity: INFO
      section: "## Task 3: Deduct on take + out-of-stock handling"
      section_hash: d90630b8bf336a58
      text: "mark_intake: course = session.get(MedicineCourse, ...); если курс soft-deleted (deleted_at) → course.medicine_id/dose_amount дадут AttributeError на None. Краевой случай, спека не покрывает."
      verdict: fixed
      verdict_at: 2026-06-15
      fix: "Task 3: deduction обёрнут в if course is not None — soft-deleted курс не валит отметку."
chain:
  intent: null
  spec: docs/superpowers/specs/2026-06-15-medicine-tracking-design.md
---

# Medicine Tracking — Phase 4: Списание остатков Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an intake is marked taken, atomically deduct the dose from stock (a chosen package, else FIFO by expiry); when nothing is left, auto-add the medicine to a shopping list. Add in-module purchase analytics from `purchase_price`.

**Architecture:** No new tables — uses `intake_log.stock_id` (Phase 2) and `stock.purchase_price` (Phase 1). Deduction runs inside the same transaction as the `taken` status mark (`SELECT … FOR UPDATE`). Out-of-stock triggers a find-or-create insert into `shopping_list` (reusing `csv_validator.get_or_create_store/product_group`). Analytics is a read-only aggregate over `purchase_price`. **No budget integration** (decision #1: no `t_f_budget_fact`).

**Tech Stack:** Same as prior phases.

**Depends on:** Phases 1–3 merged. **No migration** (migration head stays `m3c4d5e6f7a8`).

**Spec:** decision #1 (no budget), «Списание остатков (Фаза 4)», «Фактическое списание», Декомпозиция Фаза 4.

---

## Conventions

Identical to prior phases. Reminders:
- Repo root: `cd /home/ikeniborn/Documents/Project/familyBudget`.
- `_now()` = `now_local().replace(tzinfo=None)`.
- Decimal arithmetic for quantities; never float.

## File Structure (created/modified this phase)

| File | Responsibility |
|---|---|
| `backend/app/services/medicine_deduction_service.py` | FIFO / FOR UPDATE stock deduction for an intake |
| `backend/app/services/medicine_shopping_integration.py` | auto-add out-of-stock medicine to shopping_list |
| `backend/app/services/medicine_intake_service.py` | `mark_intake` deducts on `taken` + out-of-stock handling |
| `backend/app/schemas/medicine_intake.py` | `IntakeMarkRequest.stock_id` |
| `backend/app/api/v1/endpoints/medicine_courses.py` | `_mark` forwards `stock_id` + broadcasts `medicine_stock_changed` |
| `backend/app/services/medicine_analytics_service.py` | purchase-price analytics (module-only) |
| `backend/app/api/v1/endpoints/medicines.py` | `GET /medicine-stock/analytics` |
| `backend/app/schemas/medicine_stock.py` | analytics response schema |
| `tests/integration/backend/test_medicine_deduction.py` | deduction, FIFO, out-of-stock, version conflict, analytics |
| `frontend/web/static/js/medicines/medicinesManager.ts` | out-of-stock notification on take |
| `lat.md/domain.md`, `lat.md/api.md` | deduction rule + analytics endpoint docs |

---

## Task 1: Stock deduction service (FIFO / FOR UPDATE)

**Files:**
- Create: `backend/app/services/medicine_deduction_service.py`

- [ ] **Step 1: Create `backend/app/services/medicine_deduction_service.py`**

```python
"""Atomic stock deduction for an intake: chosen package, else FIFO by expiry. SELECT ... FOR UPDATE."""
import logging
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_intake_log import MedicineIntakeLog
from backend.app.utils.timezone import now_local

logger = logging.getLogger(__name__)

DEDUCTED = "deducted"
OUT_OF_STOCK = "out_of_stock"


def _now():
    return now_local().replace(tzinfo=None)


async def deduct_for_intake(
    session: AsyncSession, intake: MedicineIntakeLog, course: MedicineCourse,
    dose: Decimal, preferred_stock_id: int | None,
) -> str:
    """Deduct `dose` from a package and set intake.stock_id. Returns DEDUCTED or OUT_OF_STOCK.

    Locks the chosen row FOR UPDATE so concurrent takes can't double-spend.
    Caller commits (this runs inside mark_intake's transaction).
    """
    if preferred_stock_id is not None:
        # medicine_id guard: a chosen package must belong to the course's medicine
        row = (await session.execute(text("""
            SELECT id, quantity_remaining FROM t_f_medicine_stock
            WHERE id = :sid AND medicine_id = :mid AND deleted_at IS NULL
            FOR UPDATE
        """), {"sid": preferred_stock_id, "mid": course.medicine_id})).first()
    else:
        row = (await session.execute(text("""
            SELECT id, quantity_remaining FROM t_f_medicine_stock
            WHERE medicine_id = :mid AND quantity_remaining > 0 AND deleted_at IS NULL
            ORDER BY expiry_date ASC
            LIMIT 1
            FOR UPDATE
        """), {"mid": course.medicine_id})).first()

    if not row or Decimal(str(row.quantity_remaining)) <= 0:
        return OUT_OF_STOCK

    remaining = Decimal(str(row.quantity_remaining))
    new_qty = remaining - dose
    if new_qty < 0:
        new_qty = Decimal("0")  # deduct what's available (partial package)
    await session.execute(text("""
        UPDATE t_f_medicine_stock SET quantity_remaining = :q, updated_at = :now WHERE id = :id
    """), {"q": new_qty, "now": _now(), "id": row.id})
    intake.stock_id = row.id
    logger.info("[MED_DEDUCT] intake=%s stock=%s %s→%s", intake.id, row.id, remaining, new_qty)
    return DEDUCTED
```

- [ ] **Step 2: Verify import**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.services.medicine_deduction_service; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/medicine_deduction_service.py
git commit -m "feat(medicine): phase4 deduction service (FIFO / FOR UPDATE)"
```

---

## Task 2: Shopping-list auto-add integration

**Files:**
- Create: `backend/app/services/medicine_shopping_integration.py`

- [ ] **Step 1: Create `backend/app/services/medicine_shopping_integration.py`**

```python
"""When a medicine runs out, add it to a 'докупить' shopping list (reuses shopping infrastructure)."""
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.medicine import Medicine
from backend.app.models.shopping_list import ShoppingList
from backend.app.models.shopping_list_item import ShoppingListItem
from backend.app.services.csv_validator import get_or_create_product_group, get_or_create_store

logger = logging.getLogger(__name__)

PHARMACY_STORE = "Аптека"
MEDICINE_GROUP = "Лекарства"
RESTOCK_LIST = "Аптечка — докупить"


async def _get_or_create_restock_list(session: AsyncSession, user_id: int) -> int:
    existing = (await session.execute(
        select(ShoppingList).where(
            ShoppingList.name == RESTOCK_LIST, ShoppingList.is_active == True)  # noqa: E712
    )).scalars().first()
    if existing:
        return existing.id
    lst = ShoppingList(creator_id=user_id, name=RESTOCK_LIST, is_active=True)
    session.add(lst)
    await session.flush()
    return lst.id


async def add_to_shopping_list(session: AsyncSession, medicine: Medicine, user_id: int) -> None:
    """Idempotent-ish add: skips if an active (non-completed, non-deleted) item already exists."""
    list_id = await _get_or_create_restock_list(session, user_id)
    store_id = await get_or_create_store(session, PHARMACY_STORE, user_id, {})
    group_id = await get_or_create_product_group(session, MEDICINE_GROUP, user_id, {})

    dup = (await session.execute(
        select(ShoppingListItem).where(
            ShoppingListItem.shopping_list_id == list_id,
            ShoppingListItem.product_name == medicine.name,
            ShoppingListItem.is_completed == False,  # noqa: E712
            ShoppingListItem.deleted_at.is_(None),
        )
    )).scalars().first()
    if dup:
        return

    session.add(ShoppingListItem(
        creator_id=user_id, shopping_list_id=list_id, store_id=store_id,
        product_group_id=group_id, product_name=medicine.name, quantity=1, unit="шт",
        comment="Закончилось — автодобавление из аптечки"))
    logger.info("[MED_RESTOCK] added '%s' to shopping list %s", medicine.name, list_id)
    # caller commits
```

> `shopping_list_item` requires `store_id` + `product_group_id` (NOT NULL FKs), so we find-or-create an "Аптека" store and "Лекарства" group. Reusing `get_or_create_store/product_group` keeps it consistent with CSV import. The caller (`mark_intake`) commits.

- [ ] **Step 2: Verify import**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.services.medicine_shopping_integration; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/medicine_shopping_integration.py
git commit -m "feat(medicine): phase4 auto-add out-of-stock medicine to shopping list"
```

---

## Task 3: Deduct on take + out-of-stock handling

**Files:**
- Modify: `backend/app/schemas/medicine_intake.py`
- Modify: `backend/app/services/medicine_intake_service.py`

- [ ] **Step 1: Add `stock_id` to `IntakeMarkRequest`**

In `backend/app/schemas/medicine_intake.py`, add a field to `IntakeMarkRequest`:

```python
class IntakeMarkRequest(BaseModel):
    """take/skip body. version is required for optimistic locking (409 on mismatch)."""
    version: int = Field(..., ge=1)
    dose_taken: Decimal | None = Field(default=None, gt=0)
    stock_id: int | None = Field(default=None, description="Deduct from this package; else FIFO by expiry")
    comment: str | None = Field(default=None)
```

- [ ] **Step 2: Update `mark_intake` in `medicine_intake_service.py`**

Add the new param and the deduction call. Add imports at the top:

```python
from backend.app.models.medicine import Medicine
```

Replace `mark_intake` with:

```python
async def mark_intake(session: AsyncSession, intake: MedicineIntakeLog, *, status: str,
                      expected_version: int, user_id: int,
                      dose_taken=None, stock_id: int | None = None,
                      comment: str | None = None) -> MedicineIntakeLog:
    """Set status 'taken'/'skipped' with optimistic locking. On 'taken', deduct stock (FIFO/FOR UPDATE);
    if out of stock, auto-add the medicine to a shopping list. Single transaction.
    Raises IntakeVersionConflict on a stale version.
    """
    if intake.version != expected_version:
        raise IntakeVersionConflict()

    intake.status = status
    intake.marked_by = user_id
    intake.version += 1
    intake.updated_at = _now()
    if comment is not None:
        intake.comment = comment

    if status == "taken":
        from backend.app.services.medicine_deduction_service import (
            OUT_OF_STOCK, deduct_for_intake,
        )
        from backend.app.services.medicine_shopping_integration import add_to_shopping_list

        intake.taken_at = _now()
        course = await session.get(MedicineCourse, intake.course_id)
        if course is not None:  # course may be soft-deleted; still record the take, skip deduction
            dose = dose_taken if dose_taken is not None else course.dose_amount
            intake.dose_taken = dose
            result = await deduct_for_intake(session, intake, course, dose, stock_id)
            if result == OUT_OF_STOCK:
                medicine = await session.get(Medicine, course.medicine_id)
                if medicine:
                    await add_to_shopping_list(session, medicine, user_id)

    session.add(intake)
    await session.commit()
    await session.refresh(intake)
    return intake
```

- [ ] **Step 3: Pass `stock_id` from the take endpoint + broadcast the stock change**

> **Verify first:** the take/skip endpoint and the `_mark` helper were created in Phase 3. Confirm their location (`grep -rn "def _mark" backend/app/api/v1/endpoints/`) before editing; the plan assumes `medicine_courses.py`. Also confirm `broadcast_medicine_intake_marked` is already imported there (Phase 3).

In `backend/app/api/v1/endpoints/medicine_courses.py`, update the `_mark` helper to forward `stock_id` **and** broadcast `medicine_stock_changed` when a deduction touched a package (spec §Сервисы и API / §Frontend: every mutation → typed `medicine_*` broadcast):

```python
from backend.app.services.medicine_ws import (  # match the Phase 1/3 helper module/names
    broadcast_medicine_intake_marked, broadcast_medicine_stock_changed,
)


async def _mark(session, intake_id: int, status_value: str, body: IntakeMarkRequest, user_id: int) -> IntakeResponse:
    intake = await medicine_intake_service.get_intake(session, intake_id)
    if not intake:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Intake {intake_id} not found")
    try:
        intake = await medicine_intake_service.mark_intake(
            session, intake, status=status_value, expected_version=body.version,
            user_id=user_id, dose_taken=body.dose_taken, stock_id=body.stock_id, comment=body.comment)
    except medicine_intake_service.IntakeVersionConflict:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Intake was modified by someone else; reload and retry")
    resp = IntakeResponse.model_validate(intake)
    await broadcast_medicine_intake_marked(resp.model_dump(mode="json"))
    if intake.stock_id is not None:  # deduction changed quantity_remaining → push so stock views refresh
        await broadcast_medicine_stock_changed({"id": intake.stock_id})
    return resp
```

> Phase 1 stock CRUD already emits `medicine_stock_changed` on every stock mutation; reuse that exact helper name. An `{"id": ...}` payload is enough to trigger the frontend stock-list refetch (the handler refetches on the event, like `shopping_list_*`). If the Phase 1 helper expects a full serialized stock dict instead, load the row and pass `StockResponse.model_validate(...).model_dump(mode="json")`.

- [ ] **Step 4: Verify imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "from backend.app.api.v1.router import api_router; import backend.app.services.medicine_intake_service; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/medicine_intake.py backend/app/services/medicine_intake_service.py \
  backend/app/api/v1/endpoints/medicine_courses.py
git commit -m "feat(medicine): phase4 deduct stock on take + out-of-stock auto-restock"
```

---

## Task 4: Purchase analytics (module-only, no budget)

**Files:**
- Create: `backend/app/services/medicine_analytics_service.py`
- Modify: `backend/app/schemas/medicine_stock.py`
- Modify: `backend/app/api/v1/endpoints/medicines.py`

- [ ] **Step 1: Add the analytics schema to `medicine_stock.py`**

Append to `backend/app/schemas/medicine_stock.py`:

```python
class MedicineSpendByMedicine(BaseModel):
    medicine_id: int
    medicine_name: str
    total_spent: Decimal
    package_count: int


class MedicineAnalyticsResponse(BaseModel):
    total_spent: Decimal
    by_medicine: list[MedicineSpendByMedicine]
```

- [ ] **Step 2: Create `backend/app/services/medicine_analytics_service.py`**

```python
"""Module-only purchase analytics over stock.purchase_price (NO budget integration — decision #1)."""
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def purchase_analytics(session: AsyncSession) -> dict:
    """Total spent + per-medicine breakdown from purchase_price (counts every package ever added)."""
    rows = await session.execute(text("""
        SELECT m.id AS medicine_id, m.name AS medicine_name,
               COALESCE(SUM(s.purchase_price), 0) AS total_spent,
               COUNT(*) AS package_count
        FROM t_f_medicine_stock s
        JOIN t_d_medicine m ON m.id = s.medicine_id
        WHERE s.purchase_price IS NOT NULL
        GROUP BY m.id, m.name
        ORDER BY total_spent DESC
    """))
    by_medicine = [dict(r._mapping) for r in rows]
    total = sum((Decimal(str(r["total_spent"])) for r in by_medicine), Decimal("0"))
    return {"total_spent": total, "by_medicine": by_medicine}
```

- [ ] **Step 3: Add the analytics endpoint to `medicines.py`**

Add the import + endpoint to `stock_router` in `backend/app/api/v1/endpoints/medicines.py`:

```python
from backend.app.schemas.medicine_stock import (
    MedicineAnalyticsResponse, MedicineSpendByMedicine,
)
from backend.app.services import medicine_analytics_service
```

```python
@stock_router.get("/analytics", response_model=MedicineAnalyticsResponse, summary="Purchase analytics")
async def stock_analytics(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> MedicineAnalyticsResponse:
    data = await medicine_analytics_service.purchase_analytics(session)
    return MedicineAnalyticsResponse(
        total_spent=data["total_spent"],
        by_medicine=[MedicineSpendByMedicine(**r) for r in data["by_medicine"]])
```

> **Route ordering:** `/medicine-stock/analytics` is a static path; it must be declared BEFORE any `/{stock_id}`-style route on `stock_router`. The Phase 1 `stock_router` has no `/{...}` GET (only PATCH/DELETE with `{stock_id}`), so a plain `GET /analytics` does not collide. Keep it above any future `GET /{stock_id}`.

- [ ] **Step 4: Verify imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "from backend.app.api.v1.router import api_router; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/medicine_analytics_service.py backend/app/schemas/medicine_stock.py \
  backend/app/api/v1/endpoints/medicines.py
git commit -m "feat(medicine): phase4 purchase analytics (module-only)"
```

---

## Task 5: Integration tests (deduction, FIFO, out-of-stock, analytics)

**Files:**
- Test: `tests/integration/backend/test_medicine_deduction.py`

- [ ] **Step 1: Write the integration test**

```python
"""Integration tests for Phase 4: deduction, FIFO order, out-of-stock auto-restock, analytics."""
import pytest


async def _setup(client, headers, stock_specs):
    """stock_specs: list of (qty, expiry, price). Returns (medicine_id, patient_id, course_id)."""
    r = await client.post("/api/v1/medicines", headers=headers, json={"name": "Спис", "form": "tablet"})
    mid = r.json()["id"]
    r = await client.post("/api/v1/family-members", headers=headers, json={"name": "Петя"})
    pid = r.json()["id"]
    for qty, expiry, price in stock_specs:
        await client.post("/api/v1/medicine-stock", headers=headers, json={
            "medicine_id": mid, "quantity_remaining": str(qty), "quantity_initial": str(qty),
            "unit": "шт", "expiry_date": expiry, "purchase_price": str(price)})
    r = await client.post("/api/v1/medicine-courses", headers=headers, json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00"], "start_date": "2026-06-15", "schedule_type": "daily",
        "reminders_enabled": False})
    return mid, pid, r.json()["id"]


async def _first_intake(client, headers, course_id):
    r = await client.get("/api/v1/medicine-intakes?date=2026-06-15", headers=headers)
    return next(i for i in r.json()["intakes"] if i["course_id"] == course_id)


@pytest.mark.asyncio
async def test_take_deducts_fifo_earliest_expiry(async_client, auth_headers):
    # two packages: one expires sooner (should be deducted first)
    mid, pid, cid = await _setup(async_client, auth_headers, [
        (5, "2026-07-01", "100.00"),  # earlier expiry
        (5, "2027-07-01", "120.00"),
    ])
    intake = await _first_intake(async_client, auth_headers, cid)
    r = await async_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        headers=auth_headers, json={"version": intake["version"]})
    assert r.status_code == 200
    assert r.json()["stock_id"] is not None

    # the earlier-expiry package is now 4
    r = await async_client.get(f"/api/v1/medicine-stock?medicine_id={mid}", headers=auth_headers)
    earliest = min(r.json()["stock"], key=lambda s: s["expiry_date"])
    assert float(earliest["quantity_remaining"]) == 4.0


@pytest.mark.asyncio
async def test_take_out_of_stock_adds_to_shopping_list(async_client, auth_headers):
    mid, pid, cid = await _setup(async_client, auth_headers, [])  # NO stock
    intake = await _first_intake(async_client, auth_headers, cid)
    r = await async_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        headers=auth_headers, json={"version": intake["version"]})
    assert r.status_code == 200
    assert r.json()["stock_id"] is None  # nothing to deduct from

    # 'Аптечка — докупить' list now has the medicine
    lists = (await async_client.get("/api/v1/shopping-lists", headers=auth_headers)).json()
    restock = next(l for l in lists["shopping_lists"] if l["name"] == "Аптечка — докупить")
    items = (await async_client.get(
        f"/api/v1/shopping-list-items?shopping_list_id={restock['id']}", headers=auth_headers)).json()
    assert any(i["product_name"] == "Спис" for i in items["items"])


@pytest.mark.asyncio
async def test_take_specific_stock_id(async_client, auth_headers):
    mid, pid, cid = await _setup(async_client, auth_headers, [
        (5, "2026-07-01", "100.00"), (5, "2027-07-01", "120.00")])
    stock = (await async_client.get(f"/api/v1/medicine-stock?medicine_id={mid}", headers=auth_headers)).json()
    later = max(stock["stock"], key=lambda s: s["expiry_date"])  # force the non-FIFO package
    intake = await _first_intake(async_client, auth_headers, cid)
    r = await async_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        headers=auth_headers, json={"version": intake["version"], "stock_id": later["id"]})
    assert r.json()["stock_id"] == later["id"]


@pytest.mark.asyncio
async def test_take_stale_version_conflict_deducts_once(async_client, auth_headers):
    # optimistic locking: a second take with a stale version → 409, stock deducted exactly once
    mid, pid, cid = await _setup(async_client, auth_headers, [(5, "2026-07-01", "100.00")])
    intake = await _first_intake(async_client, auth_headers, cid)
    r1 = await async_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        headers=auth_headers, json={"version": intake["version"]})
    assert r1.status_code == 200
    # reuse the now-stale original version → conflict
    r2 = await async_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        headers=auth_headers, json={"version": intake["version"]})
    assert r2.status_code == 409
    # FOR UPDATE + version guard ⇒ no double-spend: 5 → 4, not 3
    stock = (await async_client.get(f"/api/v1/medicine-stock?medicine_id={mid}", headers=auth_headers)).json()
    assert float(stock["stock"][0]["quantity_remaining"]) == 4.0


@pytest.mark.asyncio
async def test_purchase_analytics(async_client, auth_headers):
    mid, pid, cid = await _setup(async_client, auth_headers, [
        (5, "2026-07-01", "100.00"), (5, "2027-07-01", "120.00")])
    r = await async_client.get("/api/v1/medicine-stock/analytics", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    row = next(m for m in body["by_medicine"] if m["medicine_id"] == mid)
    assert float(row["total_spent"]) == 220.0
    assert row["package_count"] == 2
```

- [ ] **Step 2: Run integration tests**

Run: `cd tests && ./run-tests.sh backend`
Expected: PASS for `test_medicine_deduction.py`.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/backend/test_medicine_deduction.py
git commit -m "test(medicine): phase4 deduction + FIFO + restock + analytics"
```

---

## Task 6: Frontend dose-source hint + verify + docs

**Files:**
- Modify: `frontend/web/static/js/medicines/medicinesManager.ts` (optional dose hint)
- Modify: `lat.md/domain.md`, `lat.md/api.md`

- [ ] **Step 1: Surface the out-of-stock notification on the dashboard**

This is the spec's «уведомление «закончилось X»» (§Списание остатков) — required, not optional. In `intakeTake` (in `medicinesManager.ts`), after a successful take, show whether stock ran out. The take response includes `stock_id`; when `null`, notify that the medicine ran out and was added to the restock list:

```typescript
export async function intakeTake(id: number, version: number): Promise<void> {
  try {
    const res = await api<{ stock_id: number | null }>(
      `/api/v1/medicine-intakes/${id}/take`, { method: 'POST', body: JSON.stringify({ version }) });
    showToast(res.stock_id == null ? 'Принято. Лекарство закончилось — добавлено в список покупок'
                                   : 'Принято', res.stock_id == null ? 'warning' : 'success');
    await loadDashboard();
  } catch (e) {
    showToast(String((e as Error).message), 'error');
    await loadDashboard();
  }
}
```

(`api<T>` already returns parsed JSON; this replaces the Phase 2 fire-and-forget call.)

- [ ] **Step 2: Build the frontend**

Run: `npm run build`
Expected: type-check passes.

- [ ] **Step 3: Full backend suite**

Run: `cd tests && ./run-tests.sh backend`
Expected: green.

- [ ] **Step 4: Manual smoke**

- Take an intake with stock present → `stock_id` set, the FIFO (earliest-expiry) package drops by the dose.
- Take an intake with no stock → `stock_id` null, medicine appears in «Аптечка — докупить» shopping list, dashboard toast warns.
- `GET /api/v1/medicine-stock/analytics` returns total + per-medicine spend.

- [ ] **Step 5: Update docs**

Note in `lat.md/domain.md` the deduction rule (chosen package else FIFO by expiry; partial allowed; out-of-stock → shopping_list) and the explicit non-integration with budget (decision #1). Add the analytics endpoint to `lat.md/api.md`.

- [ ] **Step 6: Commit**

```bash
git add frontend/web/static/js/medicines/medicinesManager.ts lat.md/domain.md lat.md/api.md
git commit -m "feat(medicine): phase4 frontend restock hint + docs"
```

---

## Phase 4 Done — Definition

- Marking an intake taken deducts the dose atomically (`SELECT … FOR UPDATE`) from the chosen package, else FIFO by `expiry_date`; a chosen `stock_id` must belong to the course's medicine. Concurrent/stale-version takes get `409` and never double-spend (covered by test).
- The deduction broadcasts `medicine_stock_changed` so other clients refresh the stock view in real time.
- Out of stock → intake recorded with `stock_id = NULL`, medicine auto-added to the «Аптечка — докупить» shopping list (find-or-create store/group/list), and the dashboard shows the «закончилось» notification.
- `GET /api/v1/medicine-stock/analytics` reports module-only purchase totals from `purchase_price`.
- No `t_f_budget_fact` writes anywhere (decision #1 honored).
- `cd tests && ./run-tests.sh backend` green.

**Next:** Phase 5 (`2026-06-15-medicine-tracking-phase5-import.md`) — CSV / Google Sheets import wizards for stock and courses.
