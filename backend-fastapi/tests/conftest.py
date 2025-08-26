"""
Pytest configuration and fixtures for backend tests.
"""
import asyncio
import os
from typing import AsyncGenerator, Generator
from unittest.mock import Mock

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.config import settings
from app.db.database import Base, get_db
from app.core.session import session_store

# Test database URL
if "test" not in settings.DATABASE_URL:
    TEST_DATABASE_URL = settings.DATABASE_URL.replace("budgetdb", "budgetdb_test")
else:
    TEST_DATABASE_URL = settings.DATABASE_URL

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# Create test session factory
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a new database session for tests."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()
        await session.close()


@pytest_asyncio.fixture(scope="function")
async def override_get_db(db_session: AsyncSession):
    """Override the get_db dependency."""
    async def _get_test_db():
        yield db_session
    
    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def mock_redis():
    """Mock Redis client for testing."""
    from unittest.mock import AsyncMock
    mock = AsyncMock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=True)
    mock.setex = AsyncMock(return_value=True)
    mock.delete = AsyncMock(return_value=1)
    mock.exists = AsyncMock(return_value=0)
    mock.expire = AsyncMock(return_value=True)
    return mock


@pytest.fixture(scope="function")
def override_redis(mock_redis):
    """Override Redis client in session store."""
    # Replace the redis client in session_store
    original_redis = session_store.redis
    session_store.redis = mock_redis
    yield
    # Restore original redis
    session_store.redis = original_redis


@pytest.fixture(scope="function")
def client(override_get_db, override_redis) -> TestClient:
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest_asyncio.fixture(scope="function")
async def async_client(override_get_db, override_redis) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client for the FastAPI app."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def test_user_data():
    """Test user data fixture."""
    return {
        "username": "testuser",
        "password": "TestPassword123!",
        "user_name": "Test User",
        "email": "test@example.com",
        "telegram_id": 123456789
    }


@pytest.fixture
def test_period_data():
    """Test period data fixture."""
    return {
        "period": "2025.01",
        "is_active": True
    }


@pytest.fixture
def test_nomenclature_data():
    """Test nomenclature data fixture."""
    return {
        "code": "001",
        "name": "Продукты питания",
        "parent_id": None
    }


@pytest.fixture
def test_financial_center_data():
    """Test financial center data fixture."""
    return {
        "code": "FC001",
        "name": "Семейный бюджет"
    }


@pytest.fixture
def test_cost_center_data():
    """Test cost center data fixture."""
    return {
        "code": "CC001",
        "name": "Домашние расходы"
    }


@pytest.fixture
def test_registry_data():
    """Test registry data fixture."""
    return {
        "period_id": 1,
        "financial_center_id": 1,
        "cost_center_id": 1,
        "nomenclature_id": 1,
        "row_type": 1,  # Plan
        "summ": 5000.00,
        "comment": "Test transaction"
    }


@pytest.fixture
def test_product_data():
    """Test product data fixture."""
    return {
        "name": "Молоко",
        "unit": "л",
        "category": "Молочные продукты",
        "barcode": "1234567890123"
    }


@pytest.fixture
def authenticated_client(client, test_user_data):
    """Create authenticated test client."""
    # Register user
    response = client.post("/api/auth/register", json=test_user_data)
    assert response.status_code == 200
    
    # Login
    login_data = {
        "username": test_user_data["username"],
        "password": test_user_data["password"]
    }
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200
    
    # Get session cookie
    cookies = response.cookies
    client.cookies = cookies
    
    return client


@pytest_asyncio.fixture
async def authenticated_async_client(async_client: AsyncClient, test_user_data):
    """Create authenticated async test client."""
    # Register user
    response = await async_client.post("/api/auth/register", json=test_user_data)
    assert response.status_code == 200
    
    # Login
    login_data = {
        "username": test_user_data["username"],
        "password": test_user_data["password"]
    }
    response = await async_client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200
    
    # Copy cookies
    async_client.cookies = response.cookies
    
    return async_client