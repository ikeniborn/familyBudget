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
