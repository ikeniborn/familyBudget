"""Fixtures for migration tests.

Self-contained db_session using NullPool. Uses asyncio_fixture_loop_scope=function
to ensure both the fixture and the test run in the same (function-scoped) event loop,
avoiding the loop-mismatch that occurs with the session-scoped asyncpg engine in
tests/conftest.py.
"""
import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from backend.app.core.config import get_settings

_DATABASE_URL = os.getenv("TEST_DATABASE_URL") or get_settings().DATABASE_URL


@pytest_asyncio.fixture(loop_scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Async DB session for each migration test, auto-rolled-back after each test."""
    engine = create_async_engine(_DATABASE_URL, echo=False, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            transaction = await conn.begin()
            async with AsyncSession(bind=conn, expire_on_commit=False) as session:
                yield session
                await transaction.rollback()
    finally:
        await engine.dispose()
