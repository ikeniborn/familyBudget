"""
Tests for admin-managed shared reference data system
Testing Phase 4 implementation of shared reference management
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch

from app.models.user import User
from app.models.period import Period
from app.models.financial_center import FinancialCenter
from app.models.cost_center import CostCenter
from app.models.nomenclature import Nomenclature


class TestSharedReferencesAdminOnly:
    """Test admin-only operations for shared reference data"""

    @pytest.mark.asyncio
    async def test_admin_can_create_shared_period(self, async_client: AsyncClient, admin_headers: dict):
        """Admin should be able to create shared periods (user_id=NULL)"""
        response = await async_client.post(
            "/api/periods/",
            json={
                "period": "2025.03",
                "period_year": 2025,
                "period_month": 3,
                "period_start_date": "2025-03-01",
                "period_end_date": "2025-03-31",
                "user_id": None  # Shared record
            },
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["user_id"] is None
        assert data["is_shared"] is True

    @pytest.mark.asyncio
    async def test_regular_user_cannot_create_shared_period(self, async_client: AsyncClient, user_headers: dict):
        """Regular user should not be able to create shared periods"""
        response = await async_client.post(
            "/api/periods/",
            json={
                "period": "2025.04",
                "period_year": 2025,
                "period_month": 4,
                "period_start_date": "2025-04-01",
                "period_end_date": "2025-04-30",
                "user_id": None  # Attempting shared record
            },
            headers=user_headers
        )
        # Should either reject with 403 or create user-specific record
        if response.status_code == 200:
            data = response.json()["data"]
            assert data["user_id"] is not None  # Should be user-specific
            assert data["is_shared"] is False
        else:
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_can_update_shared_financial_center(self, async_client: AsyncClient, admin_headers: dict, db_session: AsyncSession):
        """Admin should be able to update shared financial centers"""
        # Create shared financial center first
        fc = FinancialCenter(
            financial_center_code="TEST_FC",
            name="Test Financial Center",
            user_id=None,  # Shared
            created_by=1,
            managed_by=1
        )
        db_session.add(fc)
        await db_session.commit()
        await db_session.refresh(fc)

        # Update via API
        response = await async_client.put(
            f"/api/financial_centers/{fc.id}",
            json={"name": "Updated Financial Center"},
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["name"] == "Updated Financial Center"
        assert data["is_editable"] is True

    @pytest.mark.asyncio
    async def test_regular_user_cannot_delete_shared_cost_center(self, async_client: AsyncClient, user_headers: dict, db_session: AsyncSession):
        """Regular user should not be able to delete shared cost centers"""
        # Create shared cost center
        cc = CostCenter(
            cost_center_code="TEST_CC",
            name="Test Cost Center",
            user_id=None,  # Shared
            created_by=1,
            managed_by=1
        )
        db_session.add(cc)
        await db_session.commit()
        await db_session.refresh(cc)

        # Attempt delete via API
        response = await async_client.delete(
            f"/api/cost_centers/{cc.id}",
            headers=user_headers
        )
        assert response.status_code == 403
        assert "permission" in response.json()["error"].lower()


class TestSharedReferencesGlobalRead:
    """Test global read access for shared reference data"""

    @pytest.mark.asyncio
    async def test_all_users_can_read_shared_periods(self, async_client: AsyncClient, user_headers: dict, db_session: AsyncSession):
        """All users should be able to read shared periods"""
        # Create shared and user-specific periods
        shared_period = Period(
            period="2025.01",
            period_year=2025,
            period_month=1,
            period_start_date="2025-01-01",
            period_end_date="2025-01-31",
            user_id=None,  # Shared
            created_by=1,
            managed_by=1
        )
        user_period = Period(
            period="2025.02",
            period_year=2025,
            period_month=2,
            period_start_date="2025-02-01",
            period_end_date="2025-02-28",
            user_id=2,  # User-specific
            created_by=2,
            managed_by=2
        )
        db_session.add_all([shared_period, user_period])
        await db_session.commit()

        # Get periods as user
        response = await async_client.get("/api/periods/", headers=user_headers)
        assert response.status_code == 200
        periods = response.json()["data"]

        # Should see shared period and own periods
        period_users = [p.get("user_id") for p in periods]
        assert None in period_users  # Should see shared
        assert 2 in period_users or any(p["is_shared"] for p in periods)

    @pytest.mark.asyncio
    async def test_user_cannot_see_other_users_private_nomenclatures(self, async_client: AsyncClient, user_headers: dict, db_session: AsyncSession):
        """Users should not see other users' private nomenclatures"""
        # Create nomenclatures for different users
        user1_nom = Nomenclature(
            nomenclature_code="USER1_NOM",
            name="User 1 Nomenclature",
            user_id=1,  # User 1's private
            created_by=1,
            managed_by=1
        )
        user2_nom = Nomenclature(
            nomenclature_code="USER2_NOM",
            name="User 2 Nomenclature",
            user_id=2,  # User 2's private
            created_by=2,
            managed_by=2
        )
        shared_nom = Nomenclature(
            nomenclature_code="SHARED_NOM",
            name="Shared Nomenclature",
            user_id=None,  # Shared
            created_by=1,
            managed_by=1
        )
        db_session.add_all([user1_nom, user2_nom, shared_nom])
        await db_session.commit()

        # Get nomenclatures as user 2
        response = await async_client.get("/api/nomenclatures/", headers=user_headers)
        assert response.status_code == 200
        nomenclatures = response.json()["data"]

        # Check visibility
        nom_names = [n["name"] for n in nomenclatures]
        assert "Shared Nomenclature" in nom_names  # Should see shared
        assert "User 2 Nomenclature" in nom_names  # Should see own
        assert "User 1 Nomenclature" not in nom_names  # Should NOT see other user's


class TestSharedReferencesDataIsolation:
    """Test data isolation and uniqueness constraints"""

    @pytest.mark.asyncio
    async def test_code_uniqueness_globally(self, async_client: AsyncClient, admin_headers: dict):
        """Code fields should be unique globally across all users"""
        # Create first financial center with code
        response1 = await async_client.post(
            "/api/financial_centers/",
            json={
                "financial_center_code": "UNIQUE_CODE",
                "name": "First FC",
                "user_id": None
            },
            headers=admin_headers
        )
        assert response1.status_code == 200

        # Try to create second with same code
        response2 = await async_client.post(
            "/api/financial_centers/",
            json={
                "financial_center_code": "UNIQUE_CODE",
                "name": "Second FC",
                "user_id": None
            },
            headers=admin_headers
        )
        assert response2.status_code == 409  # Conflict
        assert "already exists" in response2.json()["error"].lower()

    @pytest.mark.asyncio
    async def test_user_specific_records_remain_isolated(self, async_client: AsyncClient, user_headers: dict, another_user_headers: dict):
        """User-specific records should remain isolated between users"""
        # User 1 creates a cost center
        response1 = await async_client.post(
            "/api/cost_centers/",
            json={
                "cost_center_code": "USER_CC",
                "name": "User 1 Cost Center"
            },
            headers=user_headers
        )
        assert response1.status_code == 200
        user1_cc_id = response1.json()["data"]["id"]

        # User 2 tries to access User 1's cost center
        response2 = await async_client.get(
            f"/api/cost_centers/{user1_cc_id}",
            headers=another_user_headers
        )
        # Should either return 404 or 403
        assert response2.status_code in [403, 404]


class TestSharedReferencesAllEntities:
    """Test shared reference system across all entity types"""

    @pytest.mark.asyncio
    async def test_all_entities_support_shared_model(self, async_client: AsyncClient, admin_headers: dict):
        """All reference entities should support the shared data model"""
        entities = [
            ("/api/periods/", {
                "period": "2025.05",
                "period_year": 2025,
                "period_month": 5,
                "period_start_date": "2025-05-01",
                "period_end_date": "2025-05-31",
                "user_id": None
            }),
            ("/api/financial_centers/", {
                "financial_center_code": "TEST_FC_SHARED",
                "name": "Shared Financial Center",
                "user_id": None
            }),
            ("/api/cost_centers/", {
                "cost_center_code": "TEST_CC_SHARED",
                "name": "Shared Cost Center",
                "user_id": None
            }),
            ("/api/nomenclatures/", {
                "nomenclature_code": "TEST_NOM_SHARED",
                "name": "Shared Nomenclature",
                "nomenclature_type": 1,
                "user_id": None
            })
        ]

        for endpoint, data in entities:
            response = await async_client.post(endpoint, json=data, headers=admin_headers)
            assert response.status_code == 200
            result = response.json()["data"]
            assert result["user_id"] is None
            assert result.get("is_shared") is True
            assert result.get("is_editable") is True  # Admin can edit

    @pytest.mark.asyncio
    async def test_is_editable_flag_per_role(self, async_client: AsyncClient, admin_headers: dict, user_headers: dict, db_session: AsyncSession):
        """is_editable flag should reflect user's permissions"""
        # Create shared period
        period = Period(
            period="2025.06",
            period_year=2025,
            period_month=6,
            period_start_date="2025-06-01",
            period_end_date="2025-06-30",
            user_id=None,  # Shared
            created_by=1,
            managed_by=1
        )
        db_session.add(period)
        await db_session.commit()
        await db_session.refresh(period)

        # Check as admin
        admin_response = await async_client.get(f"/api/periods/{period.id}", headers=admin_headers)
        assert admin_response.status_code == 200
        admin_data = admin_response.json()["data"]
        assert admin_data["is_editable"] is True  # Admin can edit

        # Check as regular user
        user_response = await async_client.get(f"/api/periods/{period.id}", headers=user_headers)
        assert user_response.status_code == 200
        user_data = user_response.json()["data"]
        assert user_data["is_editable"] is False  # User cannot edit shared


# Fixtures for testing
@pytest.fixture
async def admin_headers(async_client: AsyncClient):
    """Get headers for admin user"""
    # Login as admin
    response = await async_client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"}
    )
    token = response.cookies.get("connect.sid")
    return {"Cookie": f"connect.sid={token}"}


@pytest.fixture
async def user_headers(async_client: AsyncClient):
    """Get headers for regular user"""
    # Login as regular user
    response = await async_client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "test123"}
    )
    token = response.cookies.get("connect.sid")
    return {"Cookie": f"connect.sid={token}"}


@pytest.fixture
async def another_user_headers(async_client: AsyncClient):
    """Get headers for another regular user"""
    # Login as another user
    response = await async_client.post(
        "/api/auth/login",
        json={"username": "testuser2", "password": "test123"}
    )
    token = response.cookies.get("connect.sid")
    return {"Cookie": f"connect.sid={token}"}