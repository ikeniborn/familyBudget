"""Slice M5: the dashboard lazy-backfill must not run generate_all on every request."""
import pytest

from backend.app.services import medicine_intake_service as svc


@pytest.mark.asyncio
async def test_maybe_generate_all_debounces(monkeypatch):
    calls = []

    async def fake_generate_all(session):
        calls.append(session)
        return 0

    monkeypatch.setattr(svc, "generate_all", fake_generate_all)
    monkeypatch.setattr(svc, "_last_backfill_at", None)

    ran_first = await svc.maybe_generate_all("session-1", min_interval_seconds=3600)
    ran_second = await svc.maybe_generate_all("session-2", min_interval_seconds=3600)

    assert ran_first is True
    assert ran_second is False
    assert len(calls) == 1  # second call inside the interval is a no-op


@pytest.mark.asyncio
async def test_maybe_generate_all_runs_again_after_interval(monkeypatch):
    calls = []

    async def fake_generate_all(session):
        calls.append(session)
        return 0

    monkeypatch.setattr(svc, "generate_all", fake_generate_all)
    monkeypatch.setattr(svc, "_last_backfill_at", None)

    await svc.maybe_generate_all("s1", min_interval_seconds=0)
    await svc.maybe_generate_all("s2", min_interval_seconds=0)
    assert len(calls) == 2
