"""
Pytest configuration and fixtures for all tests.

Provides shared fixtures for database, API client, authentication, etc.
"""

import asyncio
import os
from typing import AsyncGenerator, Generator

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

# Set test environment
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = os.getenv(
    "TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/familybudget_test"
)

# Set required settings for tests (dummy values)
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-testing-only")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "0000000000:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
os.environ.setdefault("ADMIN_TELEGRAM_ID", "123456789")
os.environ.setdefault("API_INTERNAL_KEY", "test-internal-api-key")
os.environ.setdefault("TELEGRAM_WEBAPP_URL", "https://test.example.com")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000")

from backend.app.core.config import get_settings
from backend.app.db.session import get_session
from backend.app.main import app

settings = get_settings()


# ==================== Async Test Support ====================


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """
    Create an instance of the default event loop for the test session.

    Required for pytest-asyncio to work properly with session-scoped fixtures.
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ==================== Database Fixtures ====================


@pytest.fixture(scope="session")
async def engine():
    """
    Create test database engine.

    Creates all tables at start, drops them at end.
    Use separate test database to avoid data loss.
    """
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        future=True,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    yield engine

    # Drop all tables (ignore errors in cleanup - safe for test database)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.drop_all)
    except Exception as e:
        # Ignore cleanup errors (e.g., OutOfMemoryError in PostgreSQL)
        # Test database will be cleaned on next run
        print(f"Warning: Failed to drop tables in teardown: {e}")

    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Create a new database session for each test.

    Automatically rolls back changes after test completes.
    """
    connection = await engine.connect()
    transaction = await connection.begin()

    async_session_factory = sessionmaker(
        bind=connection, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_factory() as session:
        yield session

        # Rollback transaction to undo all changes
        await transaction.rollback()

    await connection.close()


# ==================== API Client Fixtures ====================


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Create test HTTP client.

    Overrides database session dependency to use test session.
    """

    async def override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ==================== Authentication Fixtures ====================


@pytest.fixture
def test_user_data():
    """Sample user data for testing."""
    return {
        "telegram_id": 123456789,
        "username": "testuser",
        "first_name": "Test",
        "last_name": "User",
        "is_admin": False,
    }


@pytest.fixture
def admin_user_data():
    """Sample admin user data for testing."""
    return {
        "telegram_id": 987654321,
        "username": "adminuser",
        "first_name": "Admin",
        "last_name": "User",
        "is_admin": True,
    }


@pytest.fixture
async def authenticated_client(client: AsyncClient, test_user_data):
    """
    HTTP client with authenticated user.

    Creates test user and includes JWT token in requests.
    """
    # TODO: Implement user creation and JWT token generation
    # This will be implemented when we add user creation logic
    return client


# ==================== Web Apps Fixtures ====================


@pytest.fixture
def mock_telegram_initdata():
    """
    Mock Telegram Web App initData for testing.

    Note: This is a simplified mock. Real initData validation requires
    proper HMAC-SHA256 signature with bot token.
    """
    return {
        "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
        "user": {
            "id": 123456789,
            "first_name": "Test",
            "last_name": "User",
            "username": "testuser",
            "language_code": "ru",
        },
        "auth_date": "1234567890",
        "hash": "abcdef1234567890",
    }


# ==================== Test Helpers ====================


@pytest.fixture
def anyio_backend():
    """Use asyncio as async backend for tests."""
    return "asyncio"


# ==================== Pytest Configuration ====================


def pytest_configure(config):
    """
    Pytest configuration hook.

    Registers custom markers for test categorization.
    """
    config.addinivalue_line(
        "markers",
        "destructive: marks tests that modify database (write operations - CREATE/UPDATE/DELETE). "
        "These tests are skipped in post-deploy CI to prevent data corruption on test server. "
        "Use: pytest -m 'not destructive' for read-only test execution."
    )
