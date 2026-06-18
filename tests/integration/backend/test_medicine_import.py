"""Integration tests for Phase 5: medicine stock + course import (analyze/preview/execute)."""
import base64

import pytest


def _b64(csv_text: str) -> str:
    return base64.b64encode(csv_text.encode("utf-8")).decode("ascii")


@pytest.mark.asyncio
async def test_stock_import_full_flow(authenticated_client):
    csv_text = "Название,Кол-во,Ед,Срок годности,Цена\nНурофен,20,шт,2027-01-01,150.00\n"
    content = _b64(csv_text)

    r = await authenticated_client.post("/api/v1/medicine-stock/import/analyze",
        json={"file_content": content})
    assert r.status_code == 200, r.text
    am = r.json()["auto_mapping"]
    assert am["Название"] == "name" and am["Кол-во"] == "quantity"

    mapping = {k: v for k, v in am.items() if v}
    body = {"file_content": content, "delimiter": r.json()["delimiter"],
            "encoding": r.json()["encoding"], "has_header": True, "column_mapping": mapping}

    r = await authenticated_client.post("/api/v1/medicine-stock/import/preview", json=body)
    assert r.json()["is_valid"] is True
    assert r.json()["valid_rows"] == 1

    r = await authenticated_client.post("/api/v1/medicine-stock/import/execute", json=body)
    assert r.json()["imported_count"] == 1

    # medicine + stock created
    meds = (await authenticated_client.get("/api/v1/medicines?q=Нурофен")).json()
    assert meds["total"] >= 1


@pytest.mark.asyncio
async def test_course_import_requires_patient(authenticated_client):
    # missing patient column → preview marks rows invalid
    csv_text = "Лекарство,Доза,Время,Начало\nПарацетамол,1,08:00;20:00,2026-06-15\n"
    content = _b64(csv_text)
    r = await authenticated_client.post("/api/v1/medicine-courses/import/analyze",
        json={"file_content": content})
    am = r.json()["auto_mapping"]
    mapping = {k: v for k, v in am.items() if v}
    body = {"file_content": content, "delimiter": r.json()["delimiter"],
            "encoding": r.json()["encoding"], "has_header": True, "column_mapping": mapping}
    r = await authenticated_client.post("/api/v1/medicine-courses/import/preview", json=body)
    assert r.json()["is_valid"] is False
    assert any(e["field"] == "patient" for row in r.json()["preview_rows"] for e in row["errors"])


@pytest.mark.asyncio
async def test_course_import_full_flow_creates_member(authenticated_client):
    csv_text = ("Пациент,Лекарство,Доза,Время,Начало\n"
                "Бабушка,Эналаприл,1,08:00;20:00,2026-06-15\n")
    content = _b64(csv_text)
    r = await authenticated_client.post("/api/v1/medicine-courses/import/analyze",
        json={"file_content": content})
    am = r.json()["auto_mapping"]
    mapping = {k: v for k, v in am.items() if v}
    body = {"file_content": content, "delimiter": r.json()["delimiter"],
            "encoding": r.json()["encoding"], "has_header": True, "column_mapping": mapping}

    r = await authenticated_client.post("/api/v1/medicine-courses/import/preview", json=body)
    assert r.json()["is_valid"] is True

    r = await authenticated_client.post("/api/v1/medicine-courses/import/execute", json=body)
    assert r.json()["imported_count"] == 1

    members = (await authenticated_client.get("/api/v1/family-members")).json()
    assert any(m["name"] == "Бабушка" for m in members["family_members"])


@pytest.mark.asyncio
async def test_stock_import_sanitizes_csv_injection(authenticated_client):
    # formula-leading cell must be neutralized by sanitize_csv_row (leading apostrophe)
    csv_text = "Название,Кол-во,Ед\n=1+1,5,шт\n"
    content = _b64(csv_text)
    r = await authenticated_client.post("/api/v1/medicine-stock/import/analyze",
        json={"file_content": content})
    am = r.json()["auto_mapping"]
    mapping = {k: v for k, v in am.items() if v}
    body = {"file_content": content, "delimiter": r.json()["delimiter"],
            "encoding": r.json()["encoding"], "has_header": True, "column_mapping": mapping}
    r = await authenticated_client.post("/api/v1/medicine-stock/import/preview", json=body)
    data = r.json()["preview_rows"][0]["data"]
    assert data["name"].startswith("'")   # "'=1+1" — формула обезврежена
