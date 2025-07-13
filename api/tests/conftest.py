import pytest
import asyncio
from typing import AsyncGenerator, Generator
from fastapi.testclient import TestClient
from httpx import AsyncClient
import os
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, date

# Set test environment variables
os.environ["POSTGRES_HOST"] = "test_host"
os.environ["POSTGRES_DB"] = "test_db"
os.environ["POSTGRES_USER"] = "test_user"
os.environ["POSTGRES_PASSWORD"] = "test_password"
os.environ["BUDGET_API_KEY"] = "test_api_key"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_postgres_connection():
    """Mock Postgres connection."""
    mock_conn = AsyncMock()
    mock_conn.select = AsyncMock()
    mock_conn.insert = AsyncMock()
    mock_conn.update = AsyncMock()
    mock_conn.delete = AsyncMock()
    mock_conn.execute = AsyncMock()
    return mock_conn


@pytest.fixture
def app(mock_postgres_connection, monkeypatch):
    """Create FastAPI app with mocked dependencies."""
    # Mock the Postgres connection before importing the app
    monkeypatch.setattr("utils.postgres.Postgres", lambda **kwargs: mock_postgres_connection)
    
    # Import app after mocking
    from budget_api import app
    return app


@pytest.fixture
def client(app) -> TestClient:
    """Create test client for synchronous tests."""
    return TestClient(app)


@pytest.fixture
async def async_client(app) -> AsyncGenerator[AsyncClient, None]:
    """Create async test client for async tests."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_user():
    """Sample user data."""
    return {
        "user_id": 1,
        "user_name": "Test User",
        "user_telegram_id": 123456789,
        "user_email": "test@example.com"
    }


@pytest.fixture
def sample_period():
    """Sample period data."""
    return {
        "period_id": 1,
        "period_name": "202401",
        "period_ru_name": "Январь 2024",
        "date_start": date(2024, 1, 1),
        "date_end": date(2024, 1, 31),
        "is_open": True
    }


@pytest.fixture
def sample_financial_center():
    """Sample financial center data."""
    return {
        "financial_center_id": 1,
        "financial_center_name": "Семья"
    }


@pytest.fixture
def sample_cost_center():
    """Sample cost center data."""
    return {
        "cost_center_id": 1,
        "cost_center_name": "Муж",
        "financial_center_id": 1
    }


@pytest.fixture
def sample_nomenclature():
    """Sample nomenclature data."""
    return {
        "nomenclature_id": 1,
        "nomenclature_name": "Продукты питания",
        "nomenclature_group": "Расходы",
        "nomenclature_parent_id": None
    }


@pytest.fixture
def sample_row_type():
    """Sample row type data."""
    return {
        "row_type_id": 1,
        "row_type_name": "План"
    }


@pytest.fixture
def sample_registry():
    """Sample registry data."""
    return {
        "registry_id": 1,
        "user_id": 1,
        "period_id": 1,
        "financial_center_id": 1,
        "cost_center_id": 1,
        "nomenclature_id": 1,
        "row_type_id": 1,
        "cost_sum": 5000.00,
        "comment_description": "Тест запись",
        "operation_dttm": datetime(2024, 1, 15, 10, 30, 0)
    }


@pytest.fixture
def sample_product():
    """Sample product data."""
    return {
        "product_id": 1,
        "product_name": "Молоко 3.2%",
        "barcode": "4607177761516",
        "category_name": "Молочные продукты",
        "unit_measure": "л",
        "description": "Молоко пастеризованное",
        "is_active": True
    }


@pytest.fixture
def auth_headers():
    """Authorization headers for secure endpoints."""
    return {"X-API-Key": "test_api_key"}


@pytest.fixture
def invalid_auth_headers():
    """Invalid authorization headers."""
    return {"X-API-Key": "invalid_key"}


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    mock = AsyncMock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=True)
    mock.delete = AsyncMock(return_value=True)
    mock.exists = AsyncMock(return_value=False)
    mock.expire = AsyncMock(return_value=True)
    return mock