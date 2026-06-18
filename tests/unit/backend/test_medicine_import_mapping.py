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
