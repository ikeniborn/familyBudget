"""Integration tests for Phase 1 medicine API (catalog, family, stock).

Uses the project's `authenticated_client` fixture (cookie-based JWT auth) and `db_session`,
mirroring tests/integration/backend/test_shopping_lists.py.
"""
import pytest

from backend.app.services.medicine_alert_service import get_expiring_stock


@pytest.mark.asyncio
async def test_medicine_crud_and_history(authenticated_client):
    r = await authenticated_client.post("/api/v1/medicines",
        json={"name": "Нурофен 200мг", "form": "tablet", "dosage": "200 mg"})
    assert r.status_code == 201, r.text
    mid = r.json()["id"]

    r = await authenticated_client.get("/api/v1/medicines")
    assert any(m["id"] == mid for m in r.json()["medicines"])

    r = await authenticated_client.patch(f"/api/v1/medicines/{mid}",
        json={"name": "Нурофен 400мг"})
    assert r.status_code == 200
    assert r.json()["name"] == "Нурофен 400мг"

    r = await authenticated_client.get("/api/v1/medicines/search?q=Нурофен")
    assert r.json()["total"] >= 1


@pytest.mark.asyncio
async def test_bad_form_rejected(authenticated_client):
    r = await authenticated_client.post("/api/v1/medicines",
        json={"name": "X", "form": "powder"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_stock_crud_and_expiring_filter(authenticated_client):
    r = await authenticated_client.post("/api/v1/medicines",
        json={"name": "Парацетамол", "form": "tablet"})
    mid = r.json()["id"]

    r = await authenticated_client.post("/api/v1/medicine-stock", json={
        "medicine_id": mid, "quantity_remaining": "20", "quantity_initial": "20",
        "unit": "шт", "expiry_date": "2026-06-25"})
    assert r.status_code == 201, r.text
    sid = r.json()["id"]

    r = await authenticated_client.get("/api/v1/medicine-stock?expiring_in_days=30")
    assert any(s["id"] == sid for s in r.json()["stock"])

    # Archiving the medicine is blocked while active stock exists → 409
    r = await authenticated_client.delete(f"/api/v1/medicines/{mid}")
    assert r.status_code == 409

    # Soft-delete stock → then archive succeeds
    r = await authenticated_client.delete(f"/api/v1/medicine-stock/{sid}")
    assert r.status_code == 204
    r = await authenticated_client.delete(f"/api/v1/medicines/{mid}")
    assert r.status_code == 200
    assert r.json()["is_active"] is False


@pytest.mark.asyncio
async def test_family_member_crud(authenticated_client):
    r = await authenticated_client.post("/api/v1/family-members", json={"name": "Маша"})
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    assert r.json()["guardian_user_id"] is not None  # defaulted to current user

    r = await authenticated_client.get("/api/v1/family-members")
    assert any(m["id"] == fid for m in r.json()["family_members"])

    # DELETE = soft-archive (spec): returns 200 + is_active False, drops from active list
    r = await authenticated_client.delete(f"/api/v1/family-members/{fid}")
    assert r.status_code == 200
    assert r.json()["is_active"] is False
    r = await authenticated_client.get("/api/v1/family-members")
    assert not any(m["id"] == fid for m in r.json()["family_members"])


@pytest.mark.asyncio
async def test_get_expiring_stock_join(authenticated_client, db_session):
    """get_expiring_stock returns the medicine name (SQL join) for stock within the window."""
    r = await authenticated_client.post("/api/v1/medicines",
        json={"name": "Аспирин", "form": "tablet"})
    mid = r.json()["id"]
    await authenticated_client.post("/api/v1/medicine-stock", json={
        "medicine_id": mid, "quantity_remaining": "5", "quantity_initial": "5",
        "unit": "шт", "expiry_date": "2026-06-20"})  # within 30d of mid-June 2026

    rows = await get_expiring_stock(db_session)
    assert any(row["name"] == "Аспирин" and row["unit"] == "шт" for row in rows)
