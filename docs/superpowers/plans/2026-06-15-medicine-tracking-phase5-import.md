---
review:
  plan_hash: cb6e300f88d83f67
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
      section: "## Task 2: Import service (mapping, validation, execute)"
      section_hash: 334fed7cb300baf5
      text: "Главный листинг service (стр.183) содержит заведомо неверный импорт `from backend.app.services.medicine_service import VALID_FORMS`; корректное расположение — `backend/app/schemas/medicine.py` (Phase 1). Исправление только в сноске. Агент, копирующий код пошагово, втянет битый импорт → ImportError."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "Импорт в листинге исправлен на `from backend.app.schemas.medicine import VALID_FORMS`; валидация формы (fallback _DEFAULT_FORM) встроена в `_find_or_create_medicine`; сноска заменена на reuse-note."
    - id: F-002
      phase: coverage
      severity: WARNING
      section: "## Task 2: Import service (mapping, validation, execute)"
      section_hash: 334fed7cb300baf5
      text: "Спека §«Импорт CSV + Google Sheets» прямо называет `csv_column_matcher.py` и `csv_validator.py` среди переиспользуемой инфраструктуры. План их не использует — пишет собственные `auto_map` + `_validate_*`. Дивергенция от спеки без обоснования в плане."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "`csv_validator.validate_required_field`/`validate_quantity` переиспользованы в `_validate_stock_row`/`_validate_course_row`. Невозможность переиспользовать `csv_column_matcher` (shopping-hardcoded EXPECTED_FIELDS, не параметризуем) обоснована в Architecture + reuse-note."
    - id: F-003
      phase: coverage
      severity: WARNING
      section: "## Task 5: Frontend import wizard (one wizard, two entities)"
      section_hash: d57dc8ac1311e647
      text: "Спека-флоу `analyze → (map) → preview → execute` включает шаг ручного маппинга колонок (как в shopping_csv_import: get_mapping_suggestions/validate_mapping). Визард плана авто-применяет auto_mapping и сразу идёт в preview — UI правки маппинга нет. Внутр. рассогласование: проза Task 5 заявляет «confirm mapping» и «5-step», код реализует ~4 шага без confirm."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "Добавлены `renderMapping()` (редактируемая таблица column→field из FIELDS) и `medicineImportPreview()` (собирает правленый mapping → dry-run). state хранит mapping; execute использует state.mapping. Экспорт `medicineImportPreview` добавлен в bundle."
    - id: F-004
      phase: coverage
      severity: WARNING
      section: "## Task 2: Import service (mapping, validation, execute)"
      section_hash: 334fed7cb300baf5
      text: "Спека §«Импорт курсов» (решение #6): строки без активного остатка лекарства «помечаются предупреждением в preview». `_validate_course_row` не формирует такого warning — мягкая связь со стоком в preview не покрыта."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "`preview_courses` стал async(session); добавлен `_has_active_stock` + warning «нет в аптечке»; endpoint `course_preview` получил `session=Depends(get_session)`."
    - id: F-005
      phase: verifiability
      severity: WARNING
      section: "## Task 4: Integration tests (stock + course import)"
      section_hash: 658050c117296dcc
      text: "Спека §Тестирование явно требует тест «санитайзинг CSV-инъекций». Ни unit, ни integration тесты плана не проверяют sanitize_csv_row на CSV-инъекции."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "Добавлен `test_stock_import_sanitizes_csv_injection` — CSV `=1+1` в name → preview.data.name начинается с `'`."
    - id: F-006
      phase: verifiability
      severity: INFO
      section: "## Task 6: Verify + docs"
      section_hash: fcb6644527c3dbab
      text: "Спека §Тестирование перечисляет Vitest «визард импорта (analyze→preview→execute)» и Playwright e2e «импорт курсов через CSV». План покрывает только ручной smoke в Task 6 — авто Vitest/e2e отсутствуют."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "Task 5 Step 5 — Vitest `medicineImportWizard.test.ts`; Task 6 Step 2 — Playwright `medicine-import.spec.ts`. Оба файла добавлены в File Structure."
    - id: F-007
      phase: structure
      severity: INFO
      section: "## File Structure (created/modified this phase)"
      section_hash: 6b48c31aeafdbc6b
      text: "Таблица File Structure не упоминает `tests/unit/backend/test_medicine_import_mapping.py`, создаваемый в Task 2 Step 1."
      verdict: fixed
      verdict_at: 2026-06-15
      resolution: "Строки unit/Vitest/e2e тестов добавлены в таблицу File Structure."
chain:
  intent: null
  spec:   docs/superpowers/specs/2026-06-15-medicine-tracking-design.md
---

# Medicine Tracking — Phase 5: Импорт (CSV + Google Sheets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two independent import wizards — one for stock (аптечка), one for courses — each following the proven `analyze → preview (dry-run) → execute` flow, from a CSV upload or a public Google Sheet. Courses import requires a `patient` column (find-or-create family member).

**Architecture:** Reuse the shopping-list import infrastructure: `csv_detector.detect_csv_format`, `csv_security.sanitize_csv_row`, `csv_validator.validate_required_field`/`validate_quantity`, `google_sheets_parser` (URL → public CSV export → bytes). `csv_column_matcher` is **not** reused — its `EXPECTED_FIELDS`/`REQUIRED_FIELDS` are shopping-specific module-level constants (not parameterizable), so reusing it would mean refactoring working shopping code (out of scope); medicine ships its own `STOCK_FIELDS`/`COURSE_FIELDS` synonym maps. A new `medicine_import_service` holds medicine-specific column synonyms + per-row validation + `execute` (find-or-create medicine/family_member, then insert stock/course). One parameterized frontend wizard drives both. No new tables.

**Tech Stack:** Same as prior phases. Depends only on Phases 1–2 (can ship in parallel with Phases 3–4).

**Depends on:** Phases 1–2 merged (catalog, family_member, stock, course). **No migration** (head stays `m3c4d5e6f7a8`, or `m2b3c4d5e6f7` if Phase 3 not yet merged).

**Spec:** decision #8 (two separate imports; patient required for courses), «Импорт CSV + Google Sheets (Фаза 5)», API import endpoints.

---

## Conventions

Identical to prior phases. Import-specific:
- File payloads are **base64** strings (`file_content`), like `shopping_csv_import`.
- `preview` is a **strict dry-run** (no DB writes).
- `execute` is idempotent for the reference dimensions (find-or-create medicine + family_member).
- Always run values through `sanitize_csv_row` before use (CSV-injection guard).
- Google Sheet must be "доступен по ссылке" (public CSV export, no API key).

## File Structure (created/modified this phase)

| File | Responsibility |
|---|---|
| `backend/app/schemas/medicine_import.py` | import request/response schemas (stock + course) |
| `backend/app/services/medicine_import_service.py` | column synonyms, mapping, validation, execute (find-or-create) |
| `backend/app/api/v1/endpoints/medicine_import.py` | stock + course analyze/preview/execute/google-sheets routers |
| `backend/app/api/v1/endpoints/__init__.py` | export routers |
| `backend/app/api/v1/router.py` | include routers |
| `frontend/web/static/js/medicines/medicineImportWizard.ts` | 5-step wizard, parameterized by entity |
| `frontend/web/static/js/medicines-bundle.ts` | export wizard openers |
| `frontend/web/templates/medicines_stock.html` | add import button |
| `frontend/web/templates/medicines_courses.html` | add import button |
| `tests/unit/backend/test_medicine_import_mapping.py` | pure unit: `auto_map` + `parse_intake_times` |
| `tests/integration/backend/test_medicine_import.py` | analyze/preview/execute for stock + courses + CSV-injection sanitize |
| `frontend/tests/unit/medicineImportWizard.test.ts` | Vitest: wizard analyze→map→preview→execute |
| `tests/e2e/medicine-import.spec.ts` | Playwright: course import via CSV |

---

## Task 1: Import schemas

**Files:**
- Create: `backend/app/schemas/medicine_import.py`

- [ ] **Step 1: Create `backend/app/schemas/medicine_import.py`**

```python
"""Pydantic schemas for medicine CSV / Google Sheets import (stock + course)."""
from typing import Any

from pydantic import BaseModel, Field


class MedicineAnalyzeRequest(BaseModel):
    file_content: str = Field(..., description="Base64-encoded CSV bytes")


class MedicineAnalyzeResponse(BaseModel):
    delimiter: str
    encoding: str
    has_header: bool
    detected_columns: list[str]
    auto_mapping: dict[str, str | None]   # csv column → field name (or None)
    sample_rows: list[dict[str, Any]]
    total_rows: int
    confidence: float


class MedicinePreviewRequest(BaseModel):
    file_content: str
    delimiter: str
    encoding: str
    has_header: bool
    column_mapping: dict[str, str]         # csv column → field name


class MedicinePreviewResponse(BaseModel):
    is_valid: bool
    valid_rows: int
    invalid_rows: int
    total_rows: int
    preview_rows: list[dict[str, Any]]     # {row_index, data, validation_status, errors, warnings}


class MedicineImportRequest(MedicinePreviewRequest):
    pass


class MedicineImportResponse(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    error_count: int
    total_rows: int
    errors: list[dict[str, Any]] = Field(default_factory=list)


class GoogleSheetsFetchRequest(BaseModel):
    url: str = Field(..., description="Public Google Sheets URL")


class GoogleSheetsFetchResponse(BaseModel):
    file_content: str = Field(..., description="Base64-encoded CSV bytes from the sheet")
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/medicine_import.py
git commit -m "feat(medicine): phase5 import schemas"
```

---

## Task 2: Import service (mapping, validation, execute)

**Files:**
- Create: `backend/app/services/medicine_import_service.py`

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/backend/test_medicine_import_mapping.py`:

```python
"""Pure tests for medicine import column auto-mapping + row parsing (no DB)."""
from backend.app.services.medicine_import_service import (
    auto_map, STOCK_FIELDS, COURSE_FIELDS, parse_intake_times,
)


def test_auto_map_stock_columns():
    mapping = auto_map(["Название", "Кол-во", "Ед", "Срок годности", "Цена"], STOCK_FIELDS)
    assert mapping["Название"] == "name"
    assert mapping["Кол-во"] == "quantity"
    assert mapping["Ед"] == "unit"
    assert mapping["Срок годности"] == "expiry_date"
    assert mapping["Цена"] == "purchase_price"


def test_auto_map_course_columns():
    mapping = auto_map(["Пациент", "Лекарство", "Доза", "Время", "Начало"], COURSE_FIELDS)
    assert mapping["Пациент"] == "patient"
    assert mapping["Лекарство"] == "medicine"
    assert mapping["Доза"] == "dose_amount"
    assert mapping["Время"] == "intake_times"
    assert mapping["Начало"] == "start_date"


def test_parse_intake_times():
    assert parse_intake_times("08:00;20:00") == ["08:00", "20:00"]
    assert parse_intake_times("09:00, 13:00 , 21:00") == ["09:00", "13:00", "21:00"]
    assert parse_intake_times("") == []
```

- [ ] **Step 2: Run it to verify it fails**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend/test_medicine_import_mapping.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/app/services/medicine_import_service.py`**

```python
"""Medicine CSV import: column synonyms, mapping, dry-run validation, execute (find-or-create)."""
import base64
import csv
import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from io import StringIO

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.family_member import FamilyMember
from backend.app.models.medicine import Medicine
from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_stock import MedicineStock
from backend.app.schemas.medicine import VALID_FORMS  # Phase 1 — schemas/medicine.py
from backend.app.services.csv_detector import detect_csv_format
from backend.app.services.csv_security import sanitize_csv_row
from backend.app.services.csv_validator import validate_quantity, validate_required_field

logger = logging.getLogger(__name__)

# Synonyms: field → list of accepted column names (lowercased, substring match).
STOCK_FIELDS: dict[str, list[str]] = {
    "name": ["name", "название", "лекарство", "препарат", "medicine"],
    "inn": ["inn", "мнн"],
    "form": ["form", "форма"],
    "dosage": ["dosage", "дозировка", "доза препарата"],
    "quantity": ["quantity", "количество", "кол-во", "остаток", "qty"],
    "unit": ["unit", "единица", "ед", "ед."],
    "expiry_date": ["expiry", "срок", "годен", "годность"],
    "purchase_date": ["purchase_date", "дата покупки", "куплено"],
    "purchase_price": ["price", "цена", "стоимость"],
    "location": ["location", "место", "хранение"],
}
STOCK_REQUIRED = ("name", "quantity", "unit")

COURSE_FIELDS: dict[str, list[str]] = {
    "patient": ["patient", "пациент", "кто", "член семьи", "имя"],
    "medicine": ["medicine", "лекарство", "препарат", "название"],
    "dose_amount": ["dose_amount", "доза", "dose", "разовая"],
    "dose_unit": ["dose_unit", "единица дозы", "ед дозы"],
    "intake_times": ["intake_times", "время", "приёмы", "приемы", "times"],
    "schedule_type": ["schedule", "расписание"],
    "start_date": ["start", "начало", "с "],
    "end_date": ["end", "конец", "по "],
    "with_food": ["food", "еда"],
    "notification_channels": ["channels", "каналы"],
}
COURSE_REQUIRED = ("patient", "medicine", "dose_amount", "intake_times", "start_date")

_DEFAULT_FORM = "other"


def auto_map(columns: list[str], fields: dict[str, list[str]]) -> dict[str, str | None]:
    """Map each CSV column to a field via case-insensitive substring synonym match."""
    mapping: dict[str, str | None] = {}
    for col in columns:
        low = col.strip().lower()
        matched = None
        for field, syns in fields.items():
            if low == field or any(s in low for s in syns):
                matched = field
                break
        mapping[col] = matched
    return mapping


def parse_intake_times(raw: str) -> list[str]:
    """'08:00;20:00' or '09:00, 13:00' → ['08:00','13:00']. Empty → []."""
    if not raw or not raw.strip():
        return []
    parts = [p.strip() for chunk in raw.split(";") for p in chunk.split(",")]
    return [p for p in parts if p]


def analyze(file_content_b64: str) -> dict:
    """Detect format + auto-map for whichever entity the caller passed (mapping done by caller's fields)."""
    raw = base64.b64decode(file_content_b64)
    det = detect_csv_format(raw, max_sample_rows=10)
    return {
        "delimiter": det.delimiter, "encoding": det.encoding, "has_header": det.has_header,
        "detected_columns": det.detected_columns, "sample_rows": det.sample_rows,
        "total_rows": det.total_rows - 1 if det.has_header else det.total_rows,
        "confidence": det.confidence,
    }


def _parse_rows(file_content_b64: str, delimiter: str, encoding: str,
                column_mapping: dict[str, str]) -> list[dict[str, str]]:
    text = base64.b64decode(file_content_b64).decode(encoding)
    reader = csv.DictReader(StringIO(text), delimiter=delimiter)
    out: list[dict[str, str]] = []
    for row in reader:
        mapped: dict[str, str] = {}
        for csv_col, field in column_mapping.items():
            if field and csv_col in row:
                mapped[field] = sanitize_csv_row({csv_col: row[csv_col]})[csv_col]
        if mapped:
            out.append(mapped)
    return out


def _err(idx: int, field: str, msg: str) -> dict:
    return {"row_index": idx, "field": field, "message": msg}


# ---------- STOCK ----------
def _validate_stock_row(idx: int, row: dict) -> tuple[list[dict], list[dict]]:
    errors, warnings = [], []
    for f in STOCK_REQUIRED:
        if validate_required_field(idx, f, row.get(f)):
            errors.append(_err(idx, f, f"'{f}' обязательно"))
    qe = validate_quantity(idx, row.get("quantity"))
    if qe:
        errors.append(_err(idx, "quantity", qe.message))
    if not row.get("expiry_date", "").strip():
        warnings.append(_err(idx, "expiry_date", "срок годности не указан"))
    return errors, warnings


def preview_stock(rows: list[dict]) -> dict:
    return _build_preview(rows, _validate_stock_row)


async def execute_stock(session: AsyncSession, rows: list[dict], user_id: int) -> dict:
    imported = skipped = error = 0
    errors: list[dict] = []
    med_cache: dict[tuple, int] = {}
    for idx, row in enumerate(rows):
        row_errs, _ = _validate_stock_row(idx, row)
        if row_errs:
            error += 1
            errors.extend(row_errs)
            continue
        try:
            med_id = await _find_or_create_medicine(
                session, row["name"].strip(), row.get("dosage"), row.get("form"), user_id, med_cache)
            session.add(MedicineStock(
                medicine_id=med_id, creator_id=user_id,
                quantity_remaining=Decimal(row["quantity"].replace(",", ".")),
                quantity_initial=Decimal(row["quantity"].replace(",", ".")),
                unit=row["unit"].strip(),
                expiry_date=_parse_date(row.get("expiry_date")) or date(9999, 12, 31),
                purchase_date=_parse_date(row.get("purchase_date")),
                purchase_price=_parse_decimal(row.get("purchase_price")),
                location=row.get("location") or None))
            imported += 1
        except Exception as e:  # noqa: BLE001
            error += 1
            errors.append(_err(idx, "general", f"ошибка: {e}"))
    await session.commit()
    return {"imported_count": imported, "skipped_count": skipped, "error_count": error,
            "total_rows": len(rows), "errors": errors, "success": error == 0}


# ---------- COURSES ----------
def _validate_course_row(idx: int, row: dict) -> tuple[list[dict], list[dict]]:
    errors, warnings = [], []
    for f in COURSE_REQUIRED:
        if validate_required_field(idx, f, row.get(f)):
            errors.append(_err(idx, f, f"'{f}' обязательно"))
    de = validate_quantity(idx, row.get("dose_amount"))
    if de:
        errors.append(_err(idx, "dose_amount", de.message.replace("Quantity", "Доза")))
    if row.get("intake_times") and not parse_intake_times(row["intake_times"]):
        errors.append(_err(idx, "intake_times", "не удалось разобрать времена приёма"))
    if row.get("start_date") and _parse_date(row["start_date"]) is None:
        errors.append(_err(idx, "start_date", f"неверная дата: {row['start_date']!r}"))
    return errors, warnings


async def preview_courses(session: AsyncSession, rows: list[dict]) -> dict:
    """Dry-run (no writes). Flags rows whose medicine has no active stock — decision #6 (soft link)."""
    preview_rows, valid, invalid = [], 0, 0
    for idx, row in enumerate(rows):
        errs, warns = _validate_course_row(idx, row)
        if not errs and row.get("medicine", "").strip() \
                and not await _has_active_stock(session, row["medicine"].strip()):
            warns.append(_err(idx, "medicine", "нет в аптечке — курс создаётся без остатка"))
        status = "error" if errs else ("warning" if warns else "valid")
        if errs:
            invalid += 1
        else:
            valid += 1
        preview_rows.append({"row_index": idx, "data": row, "validation_status": status,
                             "errors": errs, "warnings": warns})
    return {"is_valid": invalid == 0, "valid_rows": valid, "invalid_rows": invalid,
            "total_rows": len(rows), "preview_rows": preview_rows}


async def execute_courses(session: AsyncSession, rows: list[dict], user_id: int) -> dict:
    imported = skipped = error = 0
    errors: list[dict] = []
    med_cache: dict[tuple, int] = {}
    member_cache: dict[str, int] = {}
    for idx, row in enumerate(rows):
        row_errs, _ = _validate_course_row(idx, row)
        if row_errs:
            error += 1
            errors.extend(row_errs)
            continue
        try:
            patient_id = await _find_or_create_member(session, row["patient"].strip(), user_id, member_cache)
            med_id = await _find_or_create_medicine(
                session, row["medicine"].strip(), None, None, user_id, med_cache)
            session.add(MedicineCourse(
                medicine_id=med_id, patient_id=patient_id, creator_id=user_id,
                dose_amount=Decimal(row["dose_amount"].replace(",", ".")),
                dose_unit=row.get("dose_unit") or "шт",
                intake_times=parse_intake_times(row["intake_times"]),
                start_date=_parse_date(row["start_date"]),
                end_date=_parse_date(row.get("end_date")),
                schedule_type=(row.get("schedule_type") or "daily").strip().lower(),
                with_food=row.get("with_food") or None,
                notification_channels=parse_intake_times(row.get("notification_channels", "")) or ["telegram", "web_push"]))
            imported += 1
        except Exception as e:  # noqa: BLE001
            error += 1
            errors.append(_err(idx, "general", f"ошибка: {e}"))
    await session.commit()
    return {"imported_count": imported, "skipped_count": skipped, "error_count": error,
            "total_rows": len(rows), "errors": errors, "success": error == 0}


# ---------- shared helpers ----------
def _build_preview(rows: list[dict], validate) -> dict:
    preview_rows, valid, invalid = [], 0, 0
    for idx, row in enumerate(rows):
        errs, warns = validate(idx, row)
        status = "error" if errs else ("warning" if warns else "valid")
        if errs:
            invalid += 1
        else:
            valid += 1
        preview_rows.append({"row_index": idx, "data": row, "validation_status": status,
                             "errors": errs, "warnings": warns})
    return {"is_valid": invalid == 0, "valid_rows": valid, "invalid_rows": invalid,
            "total_rows": len(rows), "preview_rows": preview_rows}


def _parse_date(value: str | None) -> date | None:
    if not value or not value.strip():
        return None
    v = value.strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            from datetime import datetime as _dt
            return _dt.strptime(v, fmt).date()
        except ValueError:
            continue
    return None


def _parse_decimal(value: str | None) -> Decimal | None:
    if not value or not value.strip():
        return None
    try:
        return Decimal(value.replace(",", ".").strip())
    except (InvalidOperation, ValueError):
        return None


async def _find_or_create_medicine(session: AsyncSession, name: str, dosage: str | None,
                                   form: str | None, user_id: int, cache: dict) -> int:
    key = (name.lower(), (dosage or "").lower())
    if key in cache:
        return cache[key]
    stmt = select(Medicine).where(Medicine.name == name)
    if dosage:
        stmt = stmt.where(Medicine.dosage == dosage)
    found = (await session.execute(stmt)).scalars().first()
    if found:
        cache[key] = found.id
        return found.id
    safe_form = (form or _DEFAULT_FORM).strip().lower()
    if safe_form not in VALID_FORMS:
        safe_form = _DEFAULT_FORM
    med = Medicine(name=name, dosage=dosage or None, form=safe_form, creator_id=user_id)
    session.add(med)
    await session.flush()
    cache[key] = med.id
    return med.id


async def _has_active_stock(session: AsyncSession, medicine_name: str) -> bool:
    """True if a non-deleted stock row with quantity_remaining > 0 exists for this medicine name."""
    stmt = (select(MedicineStock.id)
            .join(Medicine, MedicineStock.medicine_id == Medicine.id)
            .where(Medicine.name == medicine_name,
                   MedicineStock.quantity_remaining > 0,
                   MedicineStock.deleted_at.is_(None))
            .limit(1))
    return (await session.execute(stmt)).first() is not None


async def _find_or_create_member(session: AsyncSession, name: str, user_id: int, cache: dict) -> int:
    key = name.lower()
    if key in cache:
        return cache[key]
    found = (await session.execute(
        select(FamilyMember).where(FamilyMember.name == name))).scalars().first()
    if found:
        cache[key] = found.id
        return found.id
    member = FamilyMember(name=name, guardian_user_id=user_id)
    session.add(member)
    await session.flush()
    cache[key] = member.id
    return member.id
```

> **Reuse note:** `VALID_FORMS` comes from `backend.app.schemas.medicine` (Phase 1) and is applied inside `_find_or_create_medicine` (fallback `_DEFAULT_FORM` for unknown forms). Required-field + quantity checks reuse `csv_validator.validate_required_field`/`validate_quantity`; `csv_column_matcher` is intentionally not reused (shopping-hardcoded `EXPECTED_FIELDS` — see Architecture). `preview_courses` is async because the «нет в аптечке» warning (decision #6) needs a stock lookup.

- [ ] **Step 4: Run the mapping unit test to verify it passes**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend/test_medicine_import_mapping.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/medicine_import_service.py tests/unit/backend/test_medicine_import_mapping.py
git commit -m "feat(medicine): phase5 import service — mapping, validation, find-or-create"
```

---

## Task 3: Import endpoints (stock + course)

**Files:**
- Create: `backend/app/api/v1/endpoints/medicine_import.py`
- Modify: `backend/app/api/v1/endpoints/__init__.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Create `backend/app/api/v1/endpoints/medicine_import.py`**

```python
"""Medicine CSV / Google Sheets import endpoints: stock + course (analyze → preview → execute)."""
import base64
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.medicine_import import (
    GoogleSheetsFetchRequest, GoogleSheetsFetchResponse,
    MedicineAnalyzeRequest, MedicineAnalyzeResponse,
    MedicineImportRequest, MedicineImportResponse,
    MedicinePreviewRequest, MedicinePreviewResponse,
)
from backend.app.services import medicine_import_service as svc
from backend.app.services.google_sheets_parser import (
    GoogleSheetsError, fetch_google_sheets_as_csv, parse_google_sheets_url,
)

logger = logging.getLogger(__name__)

stock_import_router = APIRouter(
    prefix="/medicine-stock/import", tags=["medicine-import"], responses=get_common_responses())
stock_gs_router = APIRouter(
    prefix="/medicine-stock/google-sheets", tags=["medicine-import"], responses=get_common_responses())
course_import_router = APIRouter(
    prefix="/medicine-courses/import", tags=["medicine-import"], responses=get_common_responses())
course_gs_router = APIRouter(
    prefix="/medicine-courses/google-sheets", tags=["medicine-import"], responses=get_common_responses())


def _analyze(req: MedicineAnalyzeRequest, fields) -> MedicineAnalyzeResponse:
    try:
        det = svc.analyze(req.file_content)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Не удалось разобрать CSV: {e}")
    return MedicineAnalyzeResponse(
        auto_mapping=svc.auto_map(det["detected_columns"], fields), **det)


async def _fetch_gs(req: GoogleSheetsFetchRequest) -> GoogleSheetsFetchResponse:
    try:
        sid, gid = await parse_google_sheets_url(req.url)
        raw = await fetch_google_sheets_as_csv(sid, gid)
    except GoogleSheetsError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return GoogleSheetsFetchResponse(file_content=base64.b64encode(raw).decode("ascii"))


# ---------- STOCK ----------
@stock_import_router.post("/analyze", response_model=MedicineAnalyzeResponse)
async def stock_analyze(req: MedicineAnalyzeRequest, current_user: User = Depends(get_current_user)):
    return _analyze(req, svc.STOCK_FIELDS)


@stock_import_router.post("/preview", response_model=MedicinePreviewResponse)
async def stock_preview(req: MedicinePreviewRequest, current_user: User = Depends(get_current_user)):
    rows = svc._parse_rows(req.file_content, req.delimiter, req.encoding, req.column_mapping)
    return MedicinePreviewResponse(**svc.preview_stock(rows))


@stock_import_router.post("/execute", response_model=MedicineImportResponse)
async def stock_execute(req: MedicineImportRequest, current_user: User = Depends(get_current_user),
                        session: AsyncSession = Depends(get_session)):
    rows = svc._parse_rows(req.file_content, req.delimiter, req.encoding, req.column_mapping)
    return MedicineImportResponse(**await svc.execute_stock(session, rows, current_user.id))


@stock_gs_router.post("/fetch", response_model=GoogleSheetsFetchResponse)
async def stock_gs_fetch(req: GoogleSheetsFetchRequest, current_user: User = Depends(get_current_user)):
    return await _fetch_gs(req)


# ---------- COURSES ----------
@course_import_router.post("/analyze", response_model=MedicineAnalyzeResponse)
async def course_analyze(req: MedicineAnalyzeRequest, current_user: User = Depends(get_current_user)):
    return _analyze(req, svc.COURSE_FIELDS)


@course_import_router.post("/preview", response_model=MedicinePreviewResponse)
async def course_preview(req: MedicinePreviewRequest, current_user: User = Depends(get_current_user),
                         session: AsyncSession = Depends(get_session)):
    rows = svc._parse_rows(req.file_content, req.delimiter, req.encoding, req.column_mapping)
    return MedicinePreviewResponse(**await svc.preview_courses(session, rows))


@course_import_router.post("/execute", response_model=MedicineImportResponse)
async def course_execute(req: MedicineImportRequest, current_user: User = Depends(get_current_user),
                         session: AsyncSession = Depends(get_session)):
    rows = svc._parse_rows(req.file_content, req.delimiter, req.encoding, req.column_mapping)
    return MedicineImportResponse(**await svc.execute_courses(session, rows, current_user.id))


@course_gs_router.post("/fetch", response_model=GoogleSheetsFetchResponse)
async def course_gs_fetch(req: GoogleSheetsFetchRequest, current_user: User = Depends(get_current_user)):
    return await _fetch_gs(req)
```

> **Route ordering:** these `/medicine-stock/import/*` and `/medicine-stock/google-sheets/*` routers must be registered so they do not shadow `/medicine-stock/{stock_id}`. Because `import` and `google-sheets` are static path segments and `{stock_id}` is an int path param on a different router, FastAPI matches the static segments first regardless of include order. Keep `medicine-stock/analytics` (Phase 4) distinct too. No collision.

- [ ] **Step 2: Register routers**

In `backend/app/api/v1/endpoints/__init__.py` add:

```python
from backend.app.api.v1.endpoints.medicine_import import (
    stock_import_router as medicine_stock_import_router,
    stock_gs_router as medicine_stock_gs_router,
    course_import_router as medicine_course_import_router,
    course_gs_router as medicine_course_gs_router,
)
```

and to `__all__`:

```python
    "medicine_stock_import_router",
    "medicine_stock_gs_router",
    "medicine_course_import_router",
    "medicine_course_gs_router",
```

In `backend/app/api/v1/router.py` add those names to the import block, then:

```python
api_router.include_router(medicine_stock_import_router)
api_router.include_router(medicine_stock_gs_router)
api_router.include_router(medicine_course_import_router)
api_router.include_router(medicine_course_gs_router)
```

- [ ] **Step 3: Verify app imports**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "from backend.app.api.v1.router import api_router; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/endpoints/medicine_import.py \
  backend/app/api/v1/endpoints/__init__.py backend/app/api/v1/router.py
git commit -m "feat(medicine): phase5 import endpoints — stock + course (analyze/preview/execute/gs)"
```

---

## Task 4: Integration tests (stock + course import)

**Files:**
- Test: `tests/integration/backend/test_medicine_import.py`

- [ ] **Step 1: Write the integration test**

```python
"""Integration tests for Phase 5: medicine stock + course import (analyze/preview/execute)."""
import base64

import pytest


def _b64(csv_text: str) -> str:
    return base64.b64encode(csv_text.encode("utf-8")).decode("ascii")


@pytest.mark.asyncio
async def test_stock_import_full_flow(async_client, auth_headers):
    csv_text = "Название,Кол-во,Ед,Срок годности,Цена\nНурофен,20,шт,2027-01-01,150.00\n"
    content = _b64(csv_text)

    r = await async_client.post("/api/v1/medicine-stock/import/analyze",
        headers=auth_headers, json={"file_content": content})
    assert r.status_code == 200, r.text
    am = r.json()["auto_mapping"]
    assert am["Название"] == "name" and am["Кол-во"] == "quantity"

    mapping = {k: v for k, v in am.items() if v}
    body = {"file_content": content, "delimiter": r.json()["delimiter"],
            "encoding": r.json()["encoding"], "has_header": True, "column_mapping": mapping}

    r = await async_client.post("/api/v1/medicine-stock/import/preview", headers=auth_headers, json=body)
    assert r.json()["is_valid"] is True
    assert r.json()["valid_rows"] == 1

    r = await async_client.post("/api/v1/medicine-stock/import/execute", headers=auth_headers, json=body)
    assert r.json()["imported_count"] == 1

    # medicine + stock created
    meds = (await async_client.get("/api/v1/medicines?q=Нурофен", headers=auth_headers)).json()
    assert meds["total"] >= 1


@pytest.mark.asyncio
async def test_course_import_requires_patient(async_client, auth_headers):
    # missing patient column → preview marks rows invalid
    csv_text = "Лекарство,Доза,Время,Начало\nПарацетамол,1,08:00;20:00,2026-06-15\n"
    content = _b64(csv_text)
    r = await async_client.post("/api/v1/medicine-courses/import/analyze",
        headers=auth_headers, json={"file_content": content})
    am = r.json()["auto_mapping"]
    mapping = {k: v for k, v in am.items() if v}
    body = {"file_content": content, "delimiter": r.json()["delimiter"],
            "encoding": r.json()["encoding"], "has_header": True, "column_mapping": mapping}
    r = await async_client.post("/api/v1/medicine-courses/import/preview", headers=auth_headers, json=body)
    assert r.json()["is_valid"] is False
    assert any(e["field"] == "patient" for row in r.json()["preview_rows"] for e in row["errors"])


@pytest.mark.asyncio
async def test_course_import_full_flow_creates_member(async_client, auth_headers):
    csv_text = ("Пациент,Лекарство,Доза,Время,Начало\n"
                "Бабушка,Эналаприл,1,08:00;20:00,2026-06-15\n")
    content = _b64(csv_text)
    r = await async_client.post("/api/v1/medicine-courses/import/analyze",
        headers=auth_headers, json={"file_content": content})
    am = r.json()["auto_mapping"]
    mapping = {k: v for k, v in am.items() if v}
    body = {"file_content": content, "delimiter": r.json()["delimiter"],
            "encoding": r.json()["encoding"], "has_header": True, "column_mapping": mapping}

    r = await async_client.post("/api/v1/medicine-courses/import/preview", headers=auth_headers, json=body)
    assert r.json()["is_valid"] is True

    r = await async_client.post("/api/v1/medicine-courses/import/execute", headers=auth_headers, json=body)
    assert r.json()["imported_count"] == 1

    members = (await async_client.get("/api/v1/family-members", headers=auth_headers)).json()
    assert any(m["name"] == "Бабушка" for m in members["family_members"])


@pytest.mark.asyncio
async def test_stock_import_sanitizes_csv_injection(async_client, auth_headers):
    # formula-leading cell must be neutralized by sanitize_csv_row (leading apostrophe)
    csv_text = "Название,Кол-во,Ед\n=1+1,5,шт\n"
    content = _b64(csv_text)
    r = await async_client.post("/api/v1/medicine-stock/import/analyze",
        headers=auth_headers, json={"file_content": content})
    am = r.json()["auto_mapping"]
    mapping = {k: v for k, v in am.items() if v}
    body = {"file_content": content, "delimiter": r.json()["delimiter"],
            "encoding": r.json()["encoding"], "has_header": True, "column_mapping": mapping}
    r = await async_client.post("/api/v1/medicine-stock/import/preview", headers=auth_headers, json=body)
    data = r.json()["preview_rows"][0]["data"]
    assert data["name"].startswith("'")   # "'=1+1" — формула обезврежена
```

- [ ] **Step 2: Run integration tests**

Run: `cd tests && ./run-tests.sh backend`
Expected: PASS for `test_medicine_import.py`.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/backend/test_medicine_import.py
git commit -m "test(medicine): phase5 import integration tests (stock + course)"
```

---

## Task 5: Frontend import wizard (one wizard, two entities)

**Files:**
- Create: `frontend/web/static/js/medicines/medicineImportWizard.ts`
- Modify: `frontend/web/static/js/medicines-bundle.ts`
- Modify: `frontend/web/templates/medicines_stock.html`
- Modify: `frontend/web/templates/medicines_courses.html`

A single parameterized wizard drives both imports (simplicity-first — no duplicated 5-file tree). It implements upload → analyze → confirm mapping → preview → execute against the entity's endpoint base.

- [ ] **Step 1: Create `frontend/web/static/js/medicines/medicineImportWizard.ts`**

```typescript
// Minimal 5-step medicine import wizard for stock | courses. Mirrors the shopping CSV flow.
declare const showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

type Entity = 'stock' | 'courses';
const BASE: Record<Entity, string> = {
  stock: '/api/v1/medicine-stock',
  courses: '/api/v1/medicine-courses',
};
// Target fields per entity — drives the column-mapping <select> options.
const FIELDS: Record<Entity, string[]> = {
  stock: ['name', 'inn', 'form', 'dosage', 'quantity', 'unit',
          'expiry_date', 'purchase_date', 'purchase_price', 'location'],
  courses: ['patient', 'medicine', 'dose_amount', 'dose_unit', 'intake_times',
            'schedule_type', 'start_date', 'end_date', 'with_food', 'notification_channels'],
};

interface AnalyzeResult {
  delimiter: string; encoding: string; has_header: boolean;
  detected_columns: string[]; auto_mapping: Record<string, string | null>;
  sample_rows: Record<string, unknown>[]; total_rows: number; confidence: number;
}

let state: { entity: Entity; content: string; analyze: AnalyzeResult | null;
             mapping: Record<string, string> } | null = null;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.json();
}

function modal(): HTMLElement {
  let el = document.getElementById('medicine-import-modal');
  if (!el) {
    el = document.createElement('dialog');
    el.id = 'medicine-import-modal';
    el.className = 'modal';
    document.body.appendChild(el);
  }
  return el;
}

export function openImportWizard(entity: Entity): void {
  state = { entity, content: '', analyze: null, mapping: {} };
  const el = modal() as HTMLDialogElement;
  el.innerHTML = `
    <div class="modal-box">
      <h3 class="font-bold text-lg">Импорт (${entity === 'stock' ? 'аптечка' : 'курсы'})</h3>
      <div class="py-2 space-y-2">
        <input type="file" id="med-import-file" accept=".csv" class="file-input file-input-bordered w-full" />
        <div class="divider">или Google Sheets</div>
        <input id="med-import-gs" class="input input-bordered w-full" placeholder="https://docs.google.com/spreadsheets/..." />
        <button class="btn btn-sm" onclick="window.medicineImportGoogleSheets()">Загрузить из Google Sheets</button>
      </div>
      <div id="med-import-step" class="text-sm"></div>
      <div class="modal-action">
        <button class="btn btn-primary btn-sm" onclick="window.medicineImportAnalyze()">Далее</button>
        <form method="dialog"><button class="btn btn-ghost btn-sm">Закрыть</button></form>
      </div>
    </div>`;
  el.showModal();
  const file = el.querySelector('#med-import-file') as HTMLInputElement;
  file.addEventListener('change', async () => {
    if (file.files?.[0]) state!.content = await fileToBase64(file.files[0]);
  });
}

export async function medicineImportGoogleSheets(): Promise<void> {
  if (!state) return;
  const url = (document.getElementById('med-import-gs') as HTMLInputElement)?.value.trim();
  if (!url) { showToast('Вставьте ссылку', 'warning'); return; }
  try {
    const r = await post<{ file_content: string }>(`${BASE[state.entity]}/google-sheets/fetch`, { url });
    state.content = r.file_content;
    showToast('Таблица загружена', 'success');
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

export async function medicineImportAnalyze(): Promise<void> {
  if (!state || !state.content) { showToast('Выберите файл или ссылку', 'warning'); return; }
  try {
    state.analyze = await post<AnalyzeResult>(`${BASE[state.entity]}/import/analyze`, { file_content: state.content });
    renderMapping();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

// Step «map»: editable column→field table, pre-filled from auto_mapping; user can correct before preview.
function renderMapping(): void {
  if (!state?.analyze) return;
  const a = state.analyze;
  state.mapping = Object.fromEntries(
    Object.entries(a.auto_mapping).filter(([, v]) => v)) as Record<string, string>;
  const options = (sel: string | null) =>
    ['<option value="">— пропустить —</option>']
      .concat(FIELDS[state!.entity].map(f =>
        `<option value="${f}" ${f === sel ? 'selected' : ''}>${f}</option>`)).join('');
  const rows = a.detected_columns.map(col => `
    <tr><td class="text-sm">${col}</td>
    <td><select class="select select-bordered select-sm w-full" data-col="${col}">
      ${options(a.auto_mapping[col] ?? null)}</select></td></tr>`).join('');
  const step = document.getElementById('med-import-step');
  if (step) step.innerHTML = `
    <div class="text-sm font-semibold mt-2">Сопоставление колонок</div>
    <table class="table table-xs"><thead><tr><th>CSV</th><th>Поле</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <button class="btn btn-primary btn-sm" onclick="window.medicineImportPreview()">Предпросмотр</button>`;
}

// Step «preview»: collect the (possibly edited) mapping, dry-run, show counts + Import button.
export async function medicineImportPreview(): Promise<void> {
  if (!state?.analyze) return;
  const mapping: Record<string, string> = {};
  document.querySelectorAll('#med-import-step select[data-col]').forEach(s => {
    const el = s as HTMLSelectElement;
    if (el.value) mapping[el.dataset.col as string] = el.value;
  });
  state.mapping = mapping;
  const a = state.analyze;
  const body = { file_content: state.content, delimiter: a.delimiter, encoding: a.encoding,
                 has_header: a.has_header, column_mapping: mapping };
  try {
    const preview = await post<{ valid_rows: number; invalid_rows: number; is_valid: boolean }>(
      `${BASE[state.entity]}/import/preview`, body);
    const step = document.getElementById('med-import-step');
    if (step) step.insertAdjacentHTML('beforeend', `
      <div class="alert ${preview.is_valid ? 'alert-success' : 'alert-warning'} my-2">
        Готово к импорту: ${preview.valid_rows}, ошибок: ${preview.invalid_rows}
      </div>
      <button class="btn btn-success btn-sm" ${preview.valid_rows === 0 ? 'disabled' : ''}
        onclick="window.medicineImportExecute()">Импортировать ${preview.valid_rows}</button>`);
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

export async function medicineImportExecute(): Promise<void> {
  if (!state?.analyze) return;
  const a = state.analyze;
  const body = { file_content: state.content, delimiter: a.delimiter, encoding: a.encoding,
                 has_header: a.has_header, column_mapping: state.mapping };
  try {
    const res = await post<{ imported_count: number }>(`${BASE[state.entity]}/import/execute`, body);
    showToast(`Импортировано: ${res.imported_count}`, 'success');
    (modal() as HTMLDialogElement).close();
    // refresh underlying page
    if (state.entity === 'stock' && (window as any).loadStock) (window as any).loadStock();
    if (state.entity === 'courses' && (window as any).loadCourses) (window as any).loadCourses();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: Export wizard openers in `medicines-bundle.ts`**

Add to the imports + `windowExports` in `frontend/web/static/js/medicines-bundle.ts`:

```typescript
import {
  openImportWizard, medicineImportGoogleSheets, medicineImportAnalyze,
  medicineImportPreview, medicineImportExecute,
} from './medicines/medicineImportWizard';
```

Add to `windowExports`:

```typescript
  openStockImport: () => openImportWizard('stock'),
  openCoursesImport: () => openImportWizard('courses'),
  medicineImportGoogleSheets, medicineImportAnalyze, medicineImportPreview, medicineImportExecute,
```

- [ ] **Step 3: Add import buttons to the stock + courses templates**

In `frontend/web/templates/medicines_stock.html`, add to the header `.join` block:

```html
      <button class="btn btn-sm join-item" onclick="window.openStockImport()">Импорт</button>
```

In `frontend/web/templates/medicines_courses.html`, add next to the `<h1>`:

```html
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold">Курсы приёма</h1>
    <button class="btn btn-sm" onclick="window.openCoursesImport()">Импорт</button>
  </div>
```

(replacing the existing plain `<h1>` line in that template).

- [ ] **Step 4: Build the frontend**

Run: `npm run build`
Expected: type-check passes; `medicines.min.js` rebuilt with the wizard.

- [ ] **Step 5: Vitest — wizard flow (analyze → map → preview → execute)**

Create `frontend/tests/unit/medicineImportWizard.test.ts` (mock `fetch`): `openImportWizard('courses')` opens the modal; `medicineImportAnalyze()` renders the mapping `<select>` table; `medicineImportPreview()` posts the edited `column_mapping` and shows the counts; `medicineImportExecute()` posts to `/medicine-courses/import/execute`.

Run: `npm run test:coverage -- medicineImportWizard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/web/static/js/medicines/medicineImportWizard.ts frontend/web/static/js/medicines-bundle.ts \
  frontend/web/templates/medicines_stock.html frontend/web/templates/medicines_courses.html \
  frontend/tests/unit/medicineImportWizard.test.ts
git commit -m "feat(medicine): phase5 frontend — CSV/Google Sheets import wizard (stock + courses)"
```

---

## Task 6: Verify + docs

- [ ] **Step 1: Full backend suite**

Run: `cd tests && ./run-tests.sh backend`
Expected: green.

- [ ] **Step 2: Playwright e2e — course import via CSV**

Add `tests/e2e/medicine-import.spec.ts`: log in → open `/medicines/courses` → «Импорт» → upload a CSV with a `Пациент` column → confirm the auto-mapping → preview → execute; assert the new course + family member appear and the list refreshes.

Run: `npm run test:e2e:chromium -- medicine-import`
Expected: PASS.

- [ ] **Step 3: Manual smoke (375/768/1280px)**

- Stock page → «Импорт»: upload a CSV → mapping auto-detected (editable) → preview counts → execute creates medicines + stock; list refreshes.
- Courses page → «Импорт»: a CSV missing the patient column shows invalid rows in preview; a row whose medicine isn't in stock shows a «нет в аптечке» warning but still imports; a CSV with `Пациент` executes, creating the family member + course.
- Google Sheets: paste a public sheet URL → «Загрузить» → same flow. A private sheet shows the Russian "сделайте лист публичным" error.

- [ ] **Step 4: Update docs**

Append the 8 import endpoints + the two field-synonym sets + "patient required for courses" + "courses preview flags medicine not in stock" + Google-Sheets-must-be-public to `lat.md/api.md` and `lat.md/domain.md`.

- [ ] **Step 5: Commit**

```bash
git add lat.md/api.md lat.md/domain.md
git commit -m "docs(medicine): phase5 — import endpoints + index entries"
```

---

## Phase 5 Done — Definition

- Two independent wizards (stock + courses), each `analyze → preview (dry-run) → execute`, from CSV upload or public Google Sheet (no API key).
- Reuses `csv_detector`, `csv_security` (injection-safe), `google_sheets_parser`.
- Execute finds-or-creates `t_d_medicine` (by name+dosage) for both; courses also find-or-create `t_d_family_member` by name; `patient` is a required column (preview flags missing it).
- Preview is a strict dry-run (no DB writes); execute is idempotent for the reference dimensions.
- `cd tests && ./run-tests.sh backend` green.

---

## All Phases Complete

With Phases 1–5 merged, the medicine module delivers: catalog + family members + stock with expiry alerts (1), courses with generated schedules + dashboard estimate (2), Telegram/Web-Push reminders with snooze (3), stock deduction + restock + analytics (4), and CSV/Google-Sheets import (5) — mirroring the project's `shopping_list` and `scheduled_reminder` patterns, with no budget integration (decision #1).
