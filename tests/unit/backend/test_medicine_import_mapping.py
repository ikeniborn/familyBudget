"""Pure tests for medicine import column auto-mapping + row parsing (no DB)."""
import base64

from backend.app.services.medicine_import_service import (
    auto_map, STOCK_FIELDS, COURSE_FIELDS, parse_intake_times,
    _parse_rows, _len_errors, _STOCK_MAXLEN,
)


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


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


def test_parse_rows_with_header():
    content = _b64("Название,Кол-во\nНурофен,20\n")
    rows = _parse_rows(content, ",", "utf-8", {"Название": "name", "Кол-во": "quantity"}, True)
    assert rows == [{"name": "Нурофен", "quantity": "20"}]


def test_parse_rows_headerless_uses_positional_columns():
    # has_header=False → cells keyed Column_1.. to mirror csv_detector.detected_columns
    content = _b64("Нурофен,20\n")
    rows = _parse_rows(content, ",", "utf-8", {"Column_1": "name", "Column_2": "quantity"}, False)
    assert rows == [{"name": "Нурофен", "quantity": "20"}]


def test_len_errors_flag_overflow():
    over = {"name": "x" * (_STOCK_MAXLEN["name"] + 1), "unit": "шт"}
    errs = _len_errors(0, over, _STOCK_MAXLEN)
    assert any(e["field"] == "name" for e in errs)
    # within-limit values produce no error
    assert _len_errors(0, {"unit": "шт", "name": "Нурофен"}, _STOCK_MAXLEN) == []
