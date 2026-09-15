"""Integration tests for Phase 4: deduction, FIFO order, out-of-stock auto-restock, analytics.

Uses the project's `authenticated_client` fixture (cookie-based JWT auth, same db_session as app),
mirroring tests/integration/backend/test_medicine_courses_api.py.
"""
import pytest


async def _setup(client, stock_specs):
    """stock_specs: list of (qty, expiry, price). Returns (medicine_id, patient_id, course_id)."""
    r = await client.post("/api/v1/medicines", json={"name": "Спис", "form": "tablet"})
    assert r.status_code == 201, r.text
    mid = r.json()["id"]
    r = await client.post("/api/v1/family-members", json={"name": "Петя"})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    for qty, expiry, price in stock_specs:
        r = await client.post("/api/v1/medicine-stock", json={
            "medicine_id": mid, "quantity_remaining": str(qty), "quantity_initial": str(qty),
            "unit": "шт", "expiry_date": expiry, "purchase_price": str(price)})
        assert r.status_code == 201, r.text
    r = await client.post("/api/v1/medicine-courses", json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00"], "start_date": "2026-06-15", "schedule_type": "daily",
        "reminders_enabled": False})
    assert r.status_code == 201, r.text
    return mid, pid, r.json()["id"]


async def _first_intake(client, course_id):
    r = await client.get("/api/v1/medicine-intakes?date=2026-06-15")
    assert r.status_code == 200, r.text
    return next(i for i in r.json()["intakes"] if i["course_id"] == course_id)


@pytest.mark.asyncio
async def test_take_deducts_fifo_earliest_expiry(authenticated_client):
    # two packages: one expires sooner (should be deducted first)
    mid, pid, cid = await _setup(authenticated_client, [
        (5, "2026-07-01", "100.00"),  # earlier expiry
        (5, "2027-07-01", "120.00"),
    ])
    intake = await _first_intake(authenticated_client, cid)
    r = await authenticated_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        json={"version": intake["version"]})
    assert r.status_code == 200, r.text
    assert r.json()["stock_id"] is not None

    # the earlier-expiry package is now 4
    r = await authenticated_client.get(f"/api/v1/medicine-stock?medicine_id={mid}")
    earliest = min(r.json()["stock"], key=lambda s: s["expiry_date"])
    assert float(earliest["quantity_remaining"]) == 4.0


@pytest.mark.asyncio
async def test_take_out_of_stock_adds_to_shopping_list(authenticated_client):
    mid, pid, cid = await _setup(authenticated_client, [])  # NO stock
    intake = await _first_intake(authenticated_client, cid)
    r = await authenticated_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        json={"version": intake["version"]})
    assert r.status_code == 200, r.text
    assert r.json()["stock_id"] is None  # nothing to deduct from

    # 'Аптечка — докупить' list now has the medicine
    lists = (await authenticated_client.get("/api/v1/shopping-lists")).json()
    restock = next(l for l in lists["shopping_lists"] if l["name"] == "Аптечка — докупить")
    items = (await authenticated_client.get(
        f"/api/v1/shopping-list-items?shopping_list_id={restock['id']}")).json()
    assert any(i["product_name"] == "Спис" for i in items["items"])


@pytest.mark.asyncio
async def test_take_specific_stock_id(authenticated_client):
    mid, pid, cid = await _setup(authenticated_client, [
        (5, "2026-07-01", "100.00"), (5, "2027-07-01", "120.00")])
    stock = (await authenticated_client.get(f"/api/v1/medicine-stock?medicine_id={mid}")).json()
    later = max(stock["stock"], key=lambda s: s["expiry_date"])  # force the non-FIFO package
    intake = await _first_intake(authenticated_client, cid)
    r = await authenticated_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        json={"version": intake["version"], "stock_id": later["id"]})
    assert r.json()["stock_id"] == later["id"]


@pytest.mark.asyncio
async def test_take_stale_version_conflict_deducts_once(authenticated_client):
    # optimistic locking: a second take with a stale version → 409, stock deducted exactly once
    mid, pid, cid = await _setup(authenticated_client, [(5, "2026-07-01", "100.00")])
    intake = await _first_intake(authenticated_client, cid)
    r1 = await authenticated_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        json={"version": intake["version"]})
    assert r1.status_code == 200, r1.text
    # reuse the now-stale original version → conflict
    r2 = await authenticated_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        json={"version": intake["version"]})
    assert r2.status_code == 409, r2.text
    # FOR UPDATE + version guard ⇒ no double-spend: 5 → 4, not 3
    stock = (await authenticated_client.get(f"/api/v1/medicine-stock?medicine_id={mid}")).json()
    assert float(stock["stock"][0]["quantity_remaining"]) == 4.0


@pytest.mark.asyncio
async def test_purchase_analytics(authenticated_client):
    mid, pid, cid = await _setup(authenticated_client, [
        (5, "2026-07-01", "100.00"), (5, "2027-07-01", "120.00")])
    r = await authenticated_client.get("/api/v1/medicine-stock/analytics")
    assert r.status_code == 200, r.text
    body = r.json()
    row = next(m for m in body["by_medicine"] if m["medicine_id"] == mid)
    assert float(row["total_spent"]) == 220.0
    assert row["package_count"] == 2
