"""
Comprehensive tests for dashboard functionality after database migration fix.

These tests verify that the dashboard and reference data endpoints work correctly
after the database migration fixes that resolved missing columns and field issues.

Tests cover:
1. Dashboard API endpoint (/api/reports/dashboard-stats and /api/dashboard)
2. Nomenclature endpoint (/api/nomenclatures/)
3. Period endpoint (/api/periods/)
4. Financial centers endpoint (/api/financial_centers/)
5. Cost centers endpoint (/api/cost_centers/)

The tests verify:
- Endpoints return 200 status
- Response structure includes new fields (codes, audit fields)
- Data integrity
- User isolation (data filtering by user_id)
"""
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.period import Period
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.financial_center import FinancialCenter
from app.models.cost_center import CostCenter
from app.models.registry import Registry
from app.models.user import User


@pytest.fixture
def sample_period_data():
    """Sample period data for testing."""
    return {
        "period_code": "2025.01",
        "period_dt": "2025-01-15T00:00:00Z",
        "period_ru_name": "2025 Янв",
        "period_start_date": "2025-01-01T00:00:00Z",
        "period_end_date": "2025-01-31T23:59:59Z"
    }


@pytest.fixture
def sample_nomenclature_data():
    """Sample nomenclature data for testing."""
    return {
        "nomenclature_code": "FOOD001",
        "nomenclature_name": "Продукты питания",
        "description": "Категория расходов на продукты",
        "nomenclature_type": "EXPENSE",
        "account_name": "Расходы",
        "bill_name": "Счет расходов",
        "operation_name": "Покупка продуктов",
        "is_budget": True,
        "is_fact": True
    }


@pytest.fixture
def sample_financial_center_data():
    """Sample financial center data for testing."""
    return {
        "financial_center_code": "FC001",
        "financial_center_name": "Семейный бюджет",
        "description": "Основной центр финансовой ответственности"
    }


@pytest.fixture
def sample_cost_center_data():
    """Sample cost center data for testing."""
    return {
        "cost_center_code": "CC001",
        "cost_center_name": "Домашние расходы",
        "description": "Основной центр затрат"
    }


@pytest_asyncio.fixture
async def test_user_with_data(db_session: AsyncSession, authenticated_client):
    """Create a test user with sample reference data."""
    # Create period
    period = Period(
        code="2025.01",
        date=datetime(2025, 1, 15, tzinfo=timezone.utc),
        ru_name="2025 Янв",
        start_date=datetime(2025, 1, 1, tzinfo=timezone.utc),
        end_date=datetime(2025, 1, 31, 23, 59, 59, tzinfo=timezone.utc),
        user_id=1
    )
    db_session.add(period)

    # Create nomenclature
    nomenclature = Nomenclature(
        code="FOOD001",
        name="Продукты питания",
        description="Категория расходов на продукты",
        nomenclature_type=NomenclatureType.EXPENSE,
        account_name="Расходы",
        bill_name="Счет расходов",
        operation="Покупка продуктов",
        is_budget=True,
        is_fact=True,
        user_id=1
    )
    db_session.add(nomenclature)

    # Create financial center
    financial_center = FinancialCenter(
        code="FC001",
        name="Семейный бюджет",
        description="Основной центр финансовой ответственности",
        user_id=1
    )
    db_session.add(financial_center)

    # Create cost center
    cost_center = CostCenter(
        code="CC001",
        name="Домашние расходы",
        description="Основной центр затрат",
        user_id=1
    )
    db_session.add(cost_center)

    await db_session.commit()
    await db_session.refresh(period)
    await db_session.refresh(nomenclature)
    await db_session.refresh(financial_center)
    await db_session.refresh(cost_center)

    # Create some registry data for dashboard
    registry_plan = Registry(
        period_id=period.id,
        financial_center_id=financial_center.id,
        cost_center_id=cost_center.id,
        nomenclature_id=nomenclature.id,
        row_type_id=1,  # Plan
        cost_sum=5000.00,
        comment="Test plan transaction",
        user_id=1
    )
    db_session.add(registry_plan)

    registry_fact = Registry(
        period_id=period.id,
        financial_center_id=financial_center.id,
        cost_center_id=cost_center.id,
        nomenclature_id=nomenclature.id,
        row_type_id=2,  # Fact
        cost_sum=4500.00,
        comment="Test fact transaction",
        user_id=1
    )
    db_session.add(registry_fact)

    await db_session.commit()

    return {
        "period": period,
        "nomenclature": nomenclature,
        "financial_center": financial_center,
        "cost_center": cost_center
    }


class TestDashboardEndpoints:
    """Tests for dashboard API endpoints after migration fix."""

    def test_dashboard_stats_endpoint_success(self, authenticated_client, test_user_with_data):
        """Test that /api/reports/dashboard-stats returns correct structure."""
        response = authenticated_client.get("/api/reports/dashboard-stats")

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "total_budget" in data
        assert "total_actual" in data
        assert "variance" in data
        assert "variance_percent" in data
        assert "budget_transactions" in data
        assert "actual_transactions" in data
        assert "total_transactions" in data
        assert "active_categories" in data

        # Verify data types and values
        assert isinstance(data["total_budget"], (int, float))
        assert isinstance(data["total_actual"], (int, float))
        assert isinstance(data["variance"], (int, float))
        assert isinstance(data["budget_transactions"], int)
        assert isinstance(data["actual_transactions"], int)
        assert isinstance(data["total_transactions"], int)
        assert isinstance(data["active_categories"], int)

        # Verify calculations are correct
        assert data["total_transactions"] == data["budget_transactions"] + data["actual_transactions"]
        assert data["variance"] == data["total_actual"] - data["total_budget"]

    def test_dashboard_proxy_endpoint_success(self, authenticated_client, test_user_with_data):
        """Test that /api/dashboard proxy endpoint works correctly."""
        response = authenticated_client.get("/api/dashboard")

        assert response.status_code == 200
        data = response.json()

        # Should have the same structure as dashboard-stats
        assert "total_budget" in data
        assert "total_actual" in data
        assert "variance" in data
        assert "budget_transactions" in data
        assert "actual_transactions" in data
        assert "active_categories" in data

    def test_dashboard_with_period_filter(self, authenticated_client, test_user_with_data):
        """Test dashboard with period filter parameter."""
        period_id = test_user_with_data["period"].id
        response = authenticated_client.get(f"/api/reports/dashboard-stats?period_id={period_id}")

        assert response.status_code == 200
        data = response.json()

        # Should still have valid data structure
        assert "total_budget" in data
        assert "total_actual" in data
        assert data["period_id"] == period_id

    def test_dashboard_unauthenticated(self, client):
        """Test that dashboard endpoints require authentication."""
        response = client.get("/api/reports/dashboard-stats")
        assert response.status_code == 401

        response = client.get("/api/dashboard")
        assert response.status_code == 401

    def test_dashboard_user_isolation(self, authenticated_client):
        """Test that dashboard only shows data for the authenticated user."""
        # First call should return empty data (no transactions for user)
        response = authenticated_client.get("/api/reports/dashboard-stats")

        assert response.status_code == 200
        data = response.json()

        # Should return valid structure but with zero values
        assert data["total_budget"] == 0
        assert data["total_actual"] == 0
        assert data["variance"] == 0
        assert data["budget_transactions"] == 0
        assert data["actual_transactions"] == 0
        assert data["active_categories"] == 0


class TestPeriodEndpoints:
    """Tests for period endpoints after migration fix."""

    def test_get_periods_success(self, authenticated_client, test_user_with_data):
        """Test that GET /api/periods/ returns periods with correct structure."""
        response = authenticated_client.get("/api/periods/")

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "success" in data
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)

        # Check if we have at least one period
        if len(data["data"]) > 0:
            period = data["data"][0]

            # Verify period structure includes new database fields
            assert "period_id" in period
            assert "period_code" in period  # New field from migration
            assert "period_ru_name" in period
            assert "period_dt" in period
            assert "period_start_date" in period
            assert "period_end_date" in period
            assert "created_at" in period  # Audit field from migration
            assert "updated_at" in period  # Audit field from migration

    def test_create_period_with_new_fields(self, authenticated_client, sample_period_data):
        """Test creating period with new database fields."""
        response = authenticated_client.post("/api/periods/", json=sample_period_data)

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "success" in data
        assert data["success"] is True
        assert "data" in data

        period = data["data"]
        assert period["period_code"] == sample_period_data["period_code"]
        assert period["period_ru_name"] == sample_period_data["period_ru_name"]
        assert "created_at" in period
        assert "updated_at" in period

    def test_periods_user_isolation(self, authenticated_client, sample_period_data):
        """Test that periods are isolated by user."""
        # Create period for current user
        response = authenticated_client.post("/api/periods/", json=sample_period_data)
        assert response.status_code == 200

        # Get periods - should only see own periods
        response = authenticated_client.get("/api/periods/")
        assert response.status_code == 200

        data = response.json()
        periods = data["data"]

        # All returned periods should belong to the authenticated user
        for period in periods:
            # Periods with user_id should be owned by current user (user_id = 1 for test)
            # or be shared (user_id = None)
            assert period.get("user_id") in [None, 1]


class TestNomenclatureEndpoints:
    """Tests for nomenclature endpoints after migration fix."""

    def test_get_nomenclatures_success(self, authenticated_client, test_user_with_data):
        """Test that GET /api/nomenclatures/ returns nomenclatures with correct structure."""
        response = authenticated_client.get("/api/nomenclatures/")

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "success" in data
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)

        # Check if we have nomenclatures
        if len(data["data"]) > 0:
            nomenclature = data["data"][0]

            # Verify nomenclature structure includes new database fields
            assert "nomenclature_id" in nomenclature
            assert "nomenclature_code" in nomenclature  # New field from migration
            assert "nomenclature_name" in nomenclature
            assert "description" in nomenclature
            assert "nomenclature_type" in nomenclature
            assert "account_name" in nomenclature
            assert "bill_name" in nomenclature
            assert "operation_name" in nomenclature
            assert "is_budget" in nomenclature
            assert "is_fact" in nomenclature
            assert "is_active" in nomenclature
            assert "created_at" in nomenclature  # Audit field from migration
            assert "updated_at" in nomenclature  # Audit field from migration

    def test_create_nomenclature_with_new_fields(self, authenticated_client, sample_nomenclature_data):
        """Test creating nomenclature with new database fields."""
        response = authenticated_client.post("/api/nomenclatures/", json=sample_nomenclature_data)

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "success" in data
        assert data["success"] is True
        assert "data" in data

        nomenclature = data["data"]
        assert nomenclature["nomenclature_code"] == sample_nomenclature_data["nomenclature_code"]
        assert nomenclature["nomenclature_name"] == sample_nomenclature_data["nomenclature_name"]
        assert nomenclature["nomenclature_type"] == sample_nomenclature_data["nomenclature_type"]
        assert "created_at" in nomenclature
        assert "updated_at" in nomenclature

    def test_nomenclatures_user_isolation(self, authenticated_client):
        """Test that nomenclatures are isolated by user."""
        response = authenticated_client.get("/api/nomenclatures/")
        assert response.status_code == 200

        data = response.json()
        nomenclatures = data["data"]

        # All returned nomenclatures should belong to current user or be shared
        for nomenclature in nomenclatures:
            assert nomenclature.get("user_id") in [None, 1]


class TestFinancialCenterEndpoints:
    """Tests for financial center endpoints after migration fix."""

    def test_get_financial_centers_success(self, authenticated_client, test_user_with_data):
        """Test that GET /api/financial_centers/ returns financial centers with correct structure."""
        response = authenticated_client.get("/api/financial_centers/")

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "success" in data
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)

        # Check if we have financial centers
        if len(data["data"]) > 0:
            fc = data["data"][0]

            # Verify financial center structure includes new database fields
            assert "financial_center_id" in fc
            assert "financial_center_code" in fc  # New field from migration
            assert "financial_center_name" in fc
            assert "description" in fc
            assert "is_active" in fc
            assert "created_at" in fc  # Audit field from migration
            assert "updated_at" in fc  # Audit field from migration

    def test_create_financial_center_with_new_fields(self, authenticated_client, sample_financial_center_data):
        """Test creating financial center with new database fields."""
        response = authenticated_client.post("/api/financial_centers/", json=sample_financial_center_data)

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "success" in data
        assert data["success"] is True
        assert "data" in data

        fc = data["data"]
        assert fc["financial_center_code"] == sample_financial_center_data["financial_center_code"]
        assert fc["financial_center_name"] == sample_financial_center_data["financial_center_name"]
        assert "created_at" in fc
        assert "updated_at" in fc

    def test_financial_centers_user_isolation(self, authenticated_client):
        """Test that financial centers are isolated by user."""
        response = authenticated_client.get("/api/financial_centers/")
        assert response.status_code == 200

        data = response.json()
        financial_centers = data["data"]

        # All returned financial centers should belong to current user or be shared
        for fc in financial_centers:
            assert fc.get("user_id") in [None, 1]


class TestCostCenterEndpoints:
    """Tests for cost center endpoints after migration fix."""

    def test_get_cost_centers_success(self, authenticated_client, test_user_with_data):
        """Test that GET /api/cost_centers/ returns cost centers with correct structure."""
        response = authenticated_client.get("/api/cost_centers/")

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "success" in data
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)

        # Check if we have cost centers
        if len(data["data"]) > 0:
            cc = data["data"][0]

            # Verify cost center structure includes new database fields
            assert "cost_center_id" in cc
            assert "cost_center_code" in cc  # New field from migration
            assert "cost_center_name" in cc
            assert "description" in cc
            assert "is_active" in cc
            assert "created_at" in cc  # Audit field from migration
            assert "updated_at" in cc  # Audit field from migration

    def test_create_cost_center_with_new_fields(self, authenticated_client, sample_cost_center_data):
        """Test creating cost center with new database fields."""
        response = authenticated_client.post("/api/cost_centers/", json=sample_cost_center_data)

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "success" in data
        assert data["success"] is True
        assert "data" in data

        cc = data["data"]
        assert cc["cost_center_code"] == sample_cost_center_data["cost_center_code"]
        assert cc["cost_center_name"] == sample_cost_center_data["cost_center_name"]
        assert "created_at" in cc
        assert "updated_at" in cc

    def test_cost_centers_user_isolation(self, authenticated_client):
        """Test that cost centers are isolated by user."""
        response = authenticated_client.get("/api/cost_centers/")
        assert response.status_code == 200

        data = response.json()
        cost_centers = data["data"]

        # All returned cost centers should belong to current user or be shared
        for cc in cost_centers:
            assert cc.get("user_id") in [None, 1]


class TestIntegratedDashboardWorkflow:
    """Integration tests for complete dashboard workflow."""

    def test_complete_dashboard_workflow(self, authenticated_client):
        """Test complete workflow: create data -> verify dashboard shows it correctly."""
        # Create period
        period_data = {
            "period_code": "2025.02",
            "period_dt": "2025-02-15T00:00:00Z",
            "period_ru_name": "2025 Фев",
            "period_start_date": "2025-02-01T00:00:00Z",
            "period_end_date": "2025-02-28T23:59:59Z"
        }
        period_response = authenticated_client.post("/api/periods/", json=period_data)
        assert period_response.status_code == 200
        period_id = period_response.json()["data"]["period_id"]

        # Create nomenclature
        nomenclature_data = {
            "nomenclature_code": "RENT001",
            "nomenclature_name": "Аренда жилья",
            "description": "Ежемесячная аренда",
            "nomenclature_type": "EXPENSE",
            "account_name": "Расходы",
            "bill_name": "Счет аренды",
            "operation_name": "Оплата аренды",
            "is_budget": True,
            "is_fact": True
        }
        nom_response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert nom_response.status_code == 200
        nomenclature_id = nom_response.json()["data"]["nomenclature_id"]

        # Create financial center
        fc_data = {
            "financial_center_code": "FC002",
            "financial_center_name": "Жилищные расходы",
            "description": "ЦФО для жилищных расходов"
        }
        fc_response = authenticated_client.post("/api/financial_centers/", json=fc_data)
        assert fc_response.status_code == 200
        fc_id = fc_response.json()["data"]["financial_center_id"]

        # Create cost center
        cc_data = {
            "cost_center_code": "CC002",
            "cost_center_name": "Жилье",
            "description": "МВЗ для жилищных расходов"
        }
        cc_response = authenticated_client.post("/api/cost_centers/", json=cc_data)
        assert cc_response.status_code == 200
        cc_id = cc_response.json()["data"]["cost_center_id"]

        # Verify dashboard shows updated data structure
        dashboard_response = authenticated_client.get("/api/reports/dashboard-stats")
        assert dashboard_response.status_code == 200

        dashboard_data = dashboard_response.json()

        # Should have valid structure even with no transaction data
        assert "total_budget" in dashboard_data
        assert "total_actual" in dashboard_data
        assert "variance" in dashboard_data
        assert "active_categories" in dashboard_data

        # Test dashboard with period filter
        period_dashboard = authenticated_client.get(f"/api/reports/dashboard-stats?period_id={period_id}")
        assert period_dashboard.status_code == 200
        assert period_dashboard.json()["period_id"] == period_id

    def test_error_handling_robustness(self, authenticated_client):
        """Test that endpoints handle errors gracefully after migration."""
        # Test invalid period_id in dashboard
        response = authenticated_client.get("/api/reports/dashboard-stats?period_id=99999")
        assert response.status_code == 200  # Should still work, just filter out data

        # Test invalid data in create endpoints
        invalid_period = {"invalid": "data"}
        response = authenticated_client.post("/api/periods/", json=invalid_period)
        assert response.status_code in [400, 422]  # Should return validation error

        invalid_nomenclature = {"nomenclature_name": ""}  # Missing required fields
        response = authenticated_client.post("/api/nomenclatures/", json=invalid_nomenclature)
        assert response.status_code in [400, 422]  # Should return validation error

    def test_concurrent_access_safety(self, authenticated_client):
        """Test that endpoints handle concurrent access safely."""
        # This test verifies that the migration didn't introduce race conditions
        import concurrent.futures
        import threading

        def make_dashboard_request():
            return authenticated_client.get("/api/reports/dashboard-stats")

        # Make multiple concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_dashboard_request) for _ in range(10)]
            results = [future.result() for future in futures]

        # All requests should succeed
        for response in results:
            assert response.status_code == 200
            data = response.json()
            assert "total_budget" in data
            assert "total_actual" in data


# Additional fixtures and utilities for testing

@pytest.fixture
def multiple_users_data():
    """Fixture providing data for multiple users to test isolation."""
    return {
        "user1": {
            "username": "testuser1",
            "password": "TestPassword123!",
            "user_name": "Test User 1",
            "email": "test1@example.com",
            "telegram_id": 123456781
        },
        "user2": {
            "username": "testuser2",
            "password": "TestPassword123!",
            "user_name": "Test User 2",
            "email": "test2@example.com",
            "telegram_id": 123456782
        }
    }


def test_cross_user_data_isolation(client, multiple_users_data):
    """Test that users cannot access each other's data after migration fix."""
    # Register and login user1
    client.post("/api/auth/register", json=multiple_users_data["user1"])
    login1_response = client.post("/api/auth/login", json={
        "username": multiple_users_data["user1"]["username"],
        "password": multiple_users_data["user1"]["password"]
    })
    user1_cookies = login1_response.cookies

    # Create data as user1
    client.cookies = user1_cookies
    period_data = {
        "period_code": "2025.03",
        "period_dt": "2025-03-15T00:00:00Z",
        "period_ru_name": "2025 Мар",
        "period_start_date": "2025-03-01T00:00:00Z",
        "period_end_date": "2025-03-31T23:59:59Z"
    }
    client.post("/api/periods/", json=period_data)

    # Register and login user2
    client.post("/api/auth/register", json=multiple_users_data["user2"])
    login2_response = client.post("/api/auth/login", json={
        "username": multiple_users_data["user2"]["username"],
        "password": multiple_users_data["user2"]["password"]
    })
    user2_cookies = login2_response.cookies

    # Switch to user2 and verify they can't see user1's data
    client.cookies = user2_cookies
    periods_response = client.get("/api/periods/")
    assert periods_response.status_code == 200

    periods_data = periods_response.json()
    user2_periods = periods_data["data"]

    # User2 should not see user1's period (2025.03)
    user2_period_codes = [p.get("period_code") for p in user2_periods if p.get("period_code")]
    assert "2025.03" not in user2_period_codes