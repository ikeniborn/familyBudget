"""Integration tests for Phase 2: courses, generation, take/skip, estimate.

Uses the project's `authenticated_client` fixture (cookie-based JWT auth, same db_session as app)
and `db_session` — mirrors the pattern from test_medicines_api.py.
"""
import pytest


async def _seed_medicine_and_member(client, *, with_stock: bool = True):
    r = await client.post("/api/v1/medicines", json={"name": "Курсовое", "form": "tablet"})
    assert r.status_code == 201, f"medicine create failed: {r.text}"
    mid = r.json()["id"]
    r = await client.post("/api/v1/family-members", json={"name": "Маша"})
    assert r.status_code == 201, f"family member create failed: {r.text}"
    pid = r.json()["id"]
    if with_stock:
        r = await client.post("/api/v1/medicine-stock", json={
            "medicine_id": mid, "quantity_remaining": "10", "quantity_initial": "10",
            "unit": "шт", "expiry_date": "2027-01-01"})
        assert r.status_code == 201, f"stock create failed: {r.text}"
    return mid, pid


@pytest.mark.asyncio
async def test_course_create_generates_intakes_and_estimate(authenticated_client):
    mid, pid = await _seed_medicine_and_member(authenticated_client)
    r = await authenticated_client.post("/api/v1/medicine-courses", json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00", "20:00"], "start_date": "2026-06-15", "schedule_type": "daily"})
    assert r.status_code == 201, r.text
    body = r.json()
    # estimate: 10 remaining / 1 dose = 10 intakes; 2 per day → 5 days
    assert body["estimate"]["intakes_left"] == 10
    assert body["estimate"]["days_left"] == 5
    assert body["estimate"]["in_stock"] is True
    # intakes were generated for the start date
    r = await authenticated_client.get("/api/v1/medicine-intakes?date=2026-06-15")
    assert r.status_code == 200, r.text
    same_day = [i for i in r.json()["intakes"] if i["course_id"] == body["id"]]
    assert len(same_day) == 2


@pytest.mark.asyncio
async def test_course_without_stock_not_blocked(authenticated_client):
    mid, pid = await _seed_medicine_and_member(authenticated_client, with_stock=False)
    r = await authenticated_client.post("/api/v1/medicine-courses", json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["09:00"], "start_date": "2026-06-15", "schedule_type": "daily"})
    assert r.status_code == 201, r.text  # decision #6: no hard block when stock is empty
    assert r.json()["estimate"]["in_stock"] is False


@pytest.mark.asyncio
async def test_take_skip_optimistic_lock(authenticated_client):
    mid, pid = await _seed_medicine_and_member(authenticated_client)
    r = await authenticated_client.post("/api/v1/medicine-courses", json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00"], "start_date": "2026-06-15", "schedule_type": "daily"})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    r = await authenticated_client.get("/api/v1/medicine-intakes?date=2026-06-15")
    assert r.status_code == 200, r.text
    intake = next(i for i in r.json()["intakes"] if i["course_id"] == cid)
    # take with correct version → 200
    r = await authenticated_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        json={"version": intake["version"]})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "taken"
    # take again with stale version → 409
    r = await authenticated_client.post(f"/api/v1/medicine-intakes/{intake['id']}/take",
        json={"version": intake["version"]})
    assert r.status_code == 409, r.text


@pytest.mark.asyncio
async def test_pause_and_complete(authenticated_client):
    mid, pid = await _seed_medicine_and_member(authenticated_client)
    r = await authenticated_client.post("/api/v1/medicine-courses", json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00"], "start_date": "2026-06-15", "schedule_type": "daily"})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    r = await authenticated_client.post(f"/api/v1/medicine-courses/{cid}/pause")
    assert r.status_code == 200, r.text
    assert r.json()["is_active"] is False
    r = await authenticated_client.post(f"/api/v1/medicine-courses/{cid}/complete")
    assert r.status_code == 200, r.text
    assert r.json()["deleted_at"] is not None
    # completed course no longer in active list
    r = await authenticated_client.get("/api/v1/medicine-courses?active_only=true")
    assert r.status_code == 200, r.text
    assert all(c["id"] != cid for c in r.json()["courses"])


@pytest.mark.asyncio
async def test_generation_idempotent(authenticated_client, db_session):
    """Re-running generation over an overlapping window adds no duplicate rows (UNIQUE + pre-filter)."""
    from datetime import timedelta

    from backend.app.services import medicine_intake_service as svc
    from backend.app.services.medicine_course_service import get_course

    mid, pid = await _seed_medicine_and_member(authenticated_client)
    r = await authenticated_client.post("/api/v1/medicine-courses", json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "1", "dose_unit": "шт",
        "intake_times": ["08:00", "20:00"], "start_date": "2026-06-15", "schedule_type": "daily"})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    # db_session and authenticated_client share the same underlying connection (see conftest),
    # so the course is visible immediately — no isolation issue.
    course = await get_course(db_session, cid)
    assert course is not None, f"Course {cid} not found via db_session"
    start = course.start_date
    window_end = start + timedelta(days=3)
    first = await svc.generate_for_course(db_session, course, start, window_end)
    second = await svc.generate_for_course(db_session, course, start, window_end)
    # The API already generated intake_log rows for start_date on course creation,
    # so first may be 0 if start == today and the window fully overlaps.
    # The key assertion: second run adds nothing (idempotent).
    assert second == 0, f"Second pass produced {second} rows; expected 0 (idempotent)"
    # And we must have *some* intakes for the window (either from API creation or first pass).
    r = await authenticated_client.get(f"/api/v1/medicine-intakes?date=2026-06-15")
    assert r.status_code == 200, r.text
    course_intakes = [i for i in r.json()["intakes"] if i["course_id"] == cid]
    assert len(course_intakes) >= 2  # at least 2 slots on start_date (08:00 + 20:00)
