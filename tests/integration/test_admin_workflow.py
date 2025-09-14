"""
Comprehensive integration tests for admin-managed shared reference data workflow.

Tests the complete end-to-end workflow:
1. Admin creates shared data, all users can see it
2. Regular user attempts write operations (should fail)
3. Data consolidation integrity across entities
4. Cross-user data visibility and access control
5. Complete CRUD workflows for admin vs regular users

These tests use real database transactions and full API calls to ensure
the entire system works together correctly.
"""
import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from unittest.mock import AsyncMock

from app.models.user import User
from app.models.period import Period
from app.models.financial_center import FinancialCenter
from app.models.cost_center import CostCenter
from app.models.nomenclature import Nomenclature


class TestAdminWorkflowEndToEnd:
    """Test complete admin workflow from creation to user access."""

    @pytest.mark.asyncio
    async def test_complete_shared_period_workflow(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test complete workflow: admin creates shared period, users access it."""
        # Create admin and two regular users
        admin_user = User(
            user_name="System Administrator",
            username="admin",
            password_hash="hashed_admin",
            role="admin",
            telegram_id=999999999
        )
        user1 = User(
            user_name="User One",
            username="user1",
            password_hash="hashed_user1",
            role="user",
            telegram_id=111111111
        )
        user2 = User(
            user_name="User Two",
            username="user2",
            password_hash="hashed_user2",
            role="user",
            telegram_id=222222222
        )
        db_session.add_all([admin_user, user1, user2])
        await db_session.commit()
        await db_session.refresh(admin_user)
        await db_session.refresh(user1)
        await db_session.refresh(user2)

        # Mock session for admin
        from app.core import session
        original_get_current_user = session.get_current_user_from_session

        try:
            # Step 1: Admin creates shared period
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': admin_user.id,
                'username': admin_user.username,
                'role': 'admin'
            })

            shared_period_data = {
                "date": "2025-01-01T00:00:00",
                "ru_name": "Общий период Январь 2025",
                "start_date": "2025-01-01T00:00:00",
                "end_date": "2025-01-31T23:59:59",
                "user_id": None  # Create shared period
            }

            create_response = await async_client.post("/api/periods/", json=shared_period_data)
            assert create_response.status_code == 201

            create_data = create_response.json()
            assert create_data["success"] is True
            assert create_data["data"]["is_shared"] is True
            assert create_data["data"]["user_id"] is None
            assert create_data["data"]["created_by"] == admin_user.id

            shared_period_id = create_data["data"]["id"]

            # Step 2: Admin can read and edit shared period
            get_response = await async_client.get(f"/api/periods/{shared_period_id}")
            assert get_response.status_code == 200

            get_data = get_response.json()
            assert get_data["success"] is True
            assert get_data["data"]["is_editable"] is True  # Admin can edit

            # Admin updates shared period
            update_data = {"ru_name": "Общий период Январь 2025 (Обновлен)"}
            update_response = await async_client.put(f"/api/periods/{shared_period_id}", json=update_data)
            assert update_response.status_code == 200

            update_result = update_response.json()
            assert update_result["success"] is True
            assert update_result["data"]["ru_name"] == "Общий период Январь 2025 (Обновлен)"

            # Step 3: User1 can see shared period but cannot edit
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': user1.id,
                'username': user1.username,
                'role': 'user'
            })

            # User1 can read shared period
            user1_get_response = await async_client.get(f"/api/periods/{shared_period_id}")
            assert user1_get_response.status_code == 200

            user1_get_data = user1_get_response.json()
            assert user1_get_data["success"] is True
            assert user1_get_data["data"]["is_shared"] is True
            assert user1_get_data["data"]["is_editable"] is False  # User cannot edit

            # User1 cannot update shared period
            user1_update_data = {"ru_name": "User1 trying to update"}
            user1_update_response = await async_client.put(f"/api/periods/{shared_period_id}", json=user1_update_data)
            assert user1_update_response.status_code == 403
            assert "Admin access required" in user1_update_response.json()["detail"]

            # User1 cannot delete shared period
            user1_delete_response = await async_client.delete(f"/api/periods/{shared_period_id}")
            assert user1_delete_response.status_code == 403
            assert "Admin access required" in user1_delete_response.json()["detail"]

            # Step 4: User2 also sees the same shared period
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': user2.id,
                'username': user2.username,
                'role': 'user'
            })

            # User2 gets all periods and should see the shared one
            user2_list_response = await async_client.get("/api/periods/")
            assert user2_list_response.status_code == 200

            user2_list_data = user2_list_response.json()
            assert user2_list_data["success"] is True

            # Should find the shared period
            shared_found = False
            for period in user2_list_data["data"]:
                if period["id"] == shared_period_id:
                    shared_found = True
                    assert period["is_shared"] is True
                    assert period["is_editable"] is False  # User2 also cannot edit
                    break

            assert shared_found, "User2 should see the shared period"

            # Step 5: Clean up - Admin deletes shared period
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': admin_user.id,
                'username': admin_user.username,
                'role': 'admin'
            })

            delete_response = await async_client.delete(f"/api/periods/{shared_period_id}")
            assert delete_response.status_code == 200

            delete_data = delete_response.json()
            assert delete_data["success"] is True

            # Verify deletion
            verify_response = await async_client.get(f"/api/periods/{shared_period_id}")
            assert verify_response.status_code == 404

        finally:
            session.get_current_user_from_session = original_get_current_user

    @pytest.mark.asyncio
    async def test_user_specific_data_isolation(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test that users can only see their own private data plus shared data."""
        # Create admin and two users
        admin_user = User(
            user_name="Admin",
            username="admin",
            password_hash="hashed",
            role="admin",
            telegram_id=999999999
        )
        user1 = User(
            user_name="User 1",
            username="user1",
            password_hash="hashed",
            role="user",
            telegram_id=111111111
        )
        user2 = User(
            user_name="User 2",
            username="user2",
            password_hash="hashed",
            role="user",
            telegram_id=222222222
        )
        db_session.add_all([admin_user, user1, user2])
        await db_session.commit()
        await db_session.refresh(admin_user)
        await db_session.refresh(user1)
        await db_session.refresh(user2)

        from app.core import session
        original_get_current_user = session.get_current_user_from_session

        try:
            # Admin creates shared period
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': admin_user.id,
                'username': admin_user.username,
                'role': 'admin'
            })

            shared_period = Period(
                date="2025-01-01",
                ru_name="Shared Period",
                user_id=None,
                created_by=admin_user.id
            )
            db_session.add(shared_period)
            await db_session.flush()

            # User1 creates private period
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': user1.id,
                'username': user1.username,
                'role': 'user'
            })

            user1_period_data = {
                "date": "2025-02-01T00:00:00",
                "ru_name": "User1 Private Period"
            }

            user1_create_response = await async_client.post("/api/periods/", json=user1_period_data)
            assert user1_create_response.status_code == 201

            user1_create_data = user1_create_response.json()
            assert user1_create_data["data"]["user_id"] == user1.id
            assert user1_create_data["data"]["is_shared"] is False

            # User2 creates private period
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': user2.id,
                'username': user2.username,
                'role': 'user'
            })

            user2_period_data = {
                "date": "2025-03-01T00:00:00",
                "ru_name": "User2 Private Period"
            }

            user2_create_response = await async_client.post("/api/periods/", json=user2_period_data)
            assert user2_create_response.status_code == 201

            # Commit all changes
            await db_session.commit()

            # Test User1 visibility - should see shared + own
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': user1.id,
                'username': user1.username,
                'role': 'user'
            })

            user1_list_response = await async_client.get("/api/periods/")
            assert user1_list_response.status_code == 200

            user1_list_data = user1_list_response.json()
            user1_periods = user1_list_data["data"]

            # Should see exactly 2 periods: shared + own
            assert len(user1_periods) == 2

            period_names = [p["ru_name"] for p in user1_periods]
            assert "Shared Period" in period_names
            assert "User1 Private Period" in period_names
            assert "User2 Private Period" not in period_names

            # Test User2 visibility - should see shared + own
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': user2.id,
                'username': user2.username,
                'role': 'user'
            })

            user2_list_response = await async_client.get("/api/periods/")
            assert user2_list_response.status_code == 200

            user2_list_data = user2_list_response.json()
            user2_periods = user2_list_data["data"]

            # Should see exactly 2 periods: shared + own
            assert len(user2_periods) == 2

            period_names = [p["ru_name"] for p in user2_periods]
            assert "Shared Period" in period_names
            assert "User2 Private Period" in period_names
            assert "User1 Private Period" not in period_names

        finally:
            session.get_current_user_from_session = original_get_current_user

    @pytest.mark.asyncio
    async def test_cross_entity_shared_system_consistency(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test that shared system works consistently across all reference entities."""
        # Create admin user
        admin_user = User(
            user_name="Admin",
            username="admin",
            password_hash="hashed",
            role="admin",
            telegram_id=999999999
        )
        regular_user = User(
            user_name="Regular User",
            username="user",
            password_hash="hashed",
            role="user",
            telegram_id=111111111
        )
        db_session.add_all([admin_user, regular_user])
        await db_session.commit()
        await db_session.refresh(admin_user)
        await db_session.refresh(regular_user)

        from app.core import session
        original_get_current_user = session.get_current_user_from_session

        try:
            # Admin creates shared entities across all types
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': admin_user.id,
                'username': admin_user.username,
                'role': 'admin'
            })

            # Create shared period
            shared_period_data = {
                "date": "2025-01-01T00:00:00",
                "ru_name": "Shared Period",
                "user_id": None
            }
            period_response = await async_client.post("/api/periods/", json=shared_period_data)
            assert period_response.status_code == 201

            # Create shared financial center
            shared_fc_data = {
                "code": "SHARED_FC",
                "name": "Shared Financial Center",
                "description": "Admin-managed financial center",
                "user_id": None
            }
            fc_response = await async_client.post("/api/financial_centers/", json=shared_fc_data)
            assert fc_response.status_code == 201

            # Create shared cost center
            shared_cc_data = {
                "code": "SHARED_CC",
                "name": "Shared Cost Center",
                "description": "Admin-managed cost center",
                "user_id": None
            }
            cc_response = await async_client.post("/api/cost_centers/", json=shared_cc_data)
            assert cc_response.status_code == 201

            # Create shared nomenclature
            shared_nom_data = {
                "code": "SHARED_NOM",
                "name": "Shared Nomenclature",
                "description": "Admin-managed nomenclature",
                "user_id": None
            }
            nom_response = await async_client.post("/api/nomenclatures/", json=shared_nom_data)
            assert nom_response.status_code == 201

            # Verify all entities were created as shared
            for response in [period_response, fc_response, cc_response, nom_response]:
                data = response.json()
                assert data["success"] is True
                assert data["data"]["is_shared"] is True
                assert data["data"]["user_id"] is None

            # Extract IDs for later testing
            shared_ids = {
                'period': period_response.json()["data"]["id"],
                'financial_center': fc_response.json()["data"]["id"],
                'cost_center': cc_response.json()["data"]["id"],
                'nomenclature': nom_response.json()["data"]["id"]
            }

            # Test regular user access - should see all shared entities as read-only
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': regular_user.id,
                'username': regular_user.username,
                'role': 'user'
            })

            endpoints_and_ids = [
                ("/api/periods/", shared_ids['period']),
                ("/api/financial_centers/", shared_ids['financial_center']),
                ("/api/cost_centers/", shared_ids['cost_center']),
                ("/api/nomenclatures/", shared_ids['nomenclature'])
            ]

            for endpoint, entity_id in endpoints_and_ids:
                # Test list access
                list_response = await async_client.get(endpoint)
                assert list_response.status_code == 200

                list_data = list_response.json()
                assert list_data["success"] is True

                # Find the shared entity
                shared_found = False
                for item in list_data["data"]:
                    if item["id"] == entity_id:
                        shared_found = True
                        assert item["is_shared"] is True
                        assert item["is_editable"] is False  # Regular user cannot edit
                        break

                assert shared_found, f"Shared entity not found in {endpoint}"

                # Test individual get access
                get_response = await async_client.get(f"{endpoint.rstrip('/')}/{entity_id}")
                assert get_response.status_code == 200

                get_data = get_response.json()
                assert get_data["success"] is True
                assert get_data["data"]["is_shared"] is True
                assert get_data["data"]["is_editable"] is False

                # Test update fails for regular user
                update_data = {"name": "User Attempted Update"}
                update_response = await async_client.put(f"{endpoint.rstrip('/')}/{entity_id}", json=update_data)
                assert update_response.status_code == 403

            # Test admin retains full access to all shared entities
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': admin_user.id,
                'username': admin_user.username,
                'role': 'admin'
            })

            for endpoint, entity_id in endpoints_and_ids:
                # Admin can read
                get_response = await async_client.get(f"{endpoint.rstrip('/')}/{entity_id}")
                assert get_response.status_code == 200

                get_data = get_response.json()
                assert get_data["data"]["is_editable"] is True  # Admin can edit

                # Admin can update
                update_data = {"name": "Admin Updated"}
                update_response = await async_client.put(f"{endpoint.rstrip('/')}/{entity_id}", json=update_data)
                assert update_response.status_code == 200

                update_result = update_response.json()
                assert update_result["success"] is True

        finally:
            session.get_current_user_from_session = original_get_current_user

    @pytest.mark.asyncio
    async def test_data_consolidation_integrity(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test that shared and user-specific data coexist without conflicts."""
        # Create admin and user
        admin_user = User(
            user_name="Admin",
            username="admin",
            password_hash="hashed",
            role="admin",
            telegram_id=999999999
        )
        regular_user = User(
            user_name="User",
            username="user",
            password_hash="hashed",
            role="user",
            telegram_id=111111111
        )
        db_session.add_all([admin_user, regular_user])
        await db_session.commit()
        await db_session.refresh(admin_user)
        await db_session.refresh(regular_user)

        from app.core import session
        original_get_current_user = session.get_current_user_from_session

        try:
            # Admin creates shared period with specific date
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': admin_user.id,
                'username': admin_user.username,
                'role': 'admin'
            })

            shared_period_data = {
                "date": "2025-01-01T00:00:00",
                "ru_name": "Shared January",
                "user_id": None
            }
            shared_response = await async_client.post("/api/periods/", json=shared_period_data)
            assert shared_response.status_code == 201

            # User creates private period with same date (should be allowed)
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': regular_user.id,
                'username': regular_user.username,
                'role': 'user'
            })

            user_period_data = {
                "date": "2025-01-01T00:00:00",  # Same date as shared period
                "ru_name": "My Personal January"
            }
            user_response = await async_client.post("/api/periods/", json=user_period_data)
            assert user_response.status_code == 201

            user_data = user_response.json()
            assert user_data["data"]["user_id"] == regular_user.id
            assert user_data["data"]["is_shared"] is False

            # Verify both periods exist in database
            stmt = select(func.count(Period.id))
            result = await db_session.execute(stmt)
            total_periods = result.scalar()
            assert total_periods == 2

            # Verify user sees both periods (shared + own)
            list_response = await async_client.get("/api/periods/")
            assert list_response.status_code == 200

            list_data = list_response.json()
            assert len(list_data["data"]) == 2

            # Verify data integrity - shared vs user-specific
            periods_by_type = {"shared": [], "user": []}
            for period in list_data["data"]:
                if period["is_shared"]:
                    periods_by_type["shared"].append(period)
                else:
                    periods_by_type["user"].append(period)

            assert len(periods_by_type["shared"]) == 1
            assert len(periods_by_type["user"]) == 1

            # Verify shared period properties
            shared_period = periods_by_type["shared"][0]
            assert shared_period["ru_name"] == "Shared January"
            assert shared_period["user_id"] is None
            assert shared_period["is_editable"] is False  # User cannot edit

            # Verify user period properties
            user_period = periods_by_type["user"][0]
            assert user_period["ru_name"] == "My Personal January"
            assert user_period["user_id"] == regular_user.id
            assert user_period["is_editable"] is True  # User can edit own

            # User can delete their own period but not shared
            user_period_id = user_period["id"]
            shared_period_id = shared_period["id"]

            # User can delete own period
            delete_user_response = await async_client.delete(f"/api/periods/{user_period_id}")
            assert delete_user_response.status_code == 200

            # User cannot delete shared period
            delete_shared_response = await async_client.delete(f"/api/periods/{shared_period_id}")
            assert delete_shared_response.status_code == 403

            # Verify shared period still exists
            verify_response = await async_client.get(f"/api/periods/{shared_period_id}")
            assert verify_response.status_code == 200

        finally:
            session.get_current_user_from_session = original_get_current_user

    @pytest.mark.asyncio
    async def test_admin_role_change_workflow(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test behavior when user role changes from user to admin and vice versa."""
        # Create user who will have role changes
        changing_user = User(
            user_name="Changing User",
            username="changing",
            password_hash="hashed",
            role="user",  # Start as regular user
            telegram_id=111111111
        )
        db_session.add(changing_user)
        await db_session.commit()
        await db_session.refresh(changing_user)

        from app.core import session
        original_get_current_user = session.get_current_user_from_session

        try:
            # Create shared period as preparation (using direct DB)
            shared_period = Period(
                date="2025-01-01",
                ru_name="Existing Shared Period",
                user_id=None,
                created_by=changing_user.id  # This user created it when they become admin
            )
            db_session.add(shared_period)
            await db_session.commit()
            await db_session.refresh(shared_period)

            # Start with user as regular user
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': changing_user.id,
                'username': changing_user.username,
                'role': 'user'
            })

            # Regular user cannot edit shared period
            update_data = {"ru_name": "User Attempted Update"}
            user_update_response = await async_client.put(f"/api/periods/{shared_period.id}", json=update_data)
            assert user_update_response.status_code == 403

            # Regular user sees shared period as read-only
            get_response = await async_client.get(f"/api/periods/{shared_period.id}")
            assert get_response.status_code == 200

            get_data = get_response.json()
            assert get_data["data"]["is_editable"] is False

            # Change role to admin in database
            changing_user.role = "admin"
            await db_session.commit()

            # Now user has admin role
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': changing_user.id,
                'username': changing_user.username,
                'role': 'admin'
            })

            # Admin can now edit shared period
            admin_update_response = await async_client.put(f"/api/periods/{shared_period.id}", json=update_data)
            assert admin_update_response.status_code == 200

            admin_update_data = admin_update_response.json()
            assert admin_update_data["data"]["ru_name"] == "User Attempted Update"

            # Admin sees shared period as editable
            admin_get_response = await async_client.get(f"/api/periods/{shared_period.id}")
            assert admin_get_response.status_code == 200

            admin_get_data = admin_get_response.json()
            assert admin_get_data["data"]["is_editable"] is True

            # Admin can create new shared periods
            new_shared_data = {
                "date": "2025-02-01T00:00:00",
                "ru_name": "New Admin Created Period",
                "user_id": None
            }
            create_response = await async_client.post("/api/periods/", json=new_shared_data)
            assert create_response.status_code == 201

            create_result = create_response.json()
            assert create_result["data"]["is_shared"] is True

            # Change back to regular user
            changing_user.role = "user"
            await db_session.commit()

            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': changing_user.id,
                'username': changing_user.username,
                'role': 'user'
            })

            # Former admin now cannot edit shared periods again
            back_to_user_update = await async_client.put(f"/api/periods/{shared_period.id}", json={"ru_name": "Back to user"})
            assert back_to_user_update.status_code == 403

        finally:
            session.get_current_user_from_session = original_get_current_user

    @pytest.mark.asyncio
    async def test_concurrent_admin_operations(self, async_client: AsyncClient, db_session: AsyncSession):
        """Test concurrent admin operations on shared data don't cause conflicts."""
        # Create two admin users
        admin1 = User(
            user_name="Admin 1",
            username="admin1",
            password_hash="hashed",
            role="admin",
            telegram_id=111111111
        )
        admin2 = User(
            user_name="Admin 2",
            username="admin2",
            password_hash="hashed",
            role="admin",
            telegram_id=222222222
        )
        db_session.add_all([admin1, admin2])
        await db_session.commit()
        await db_session.refresh(admin1)
        await db_session.refresh(admin2)

        from app.core import session
        original_get_current_user = session.get_current_user_from_session

        try:
            # Admin1 creates shared period
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': admin1.id,
                'username': admin1.username,
                'role': 'admin'
            })

            shared_data = {
                "date": "2025-01-01T00:00:00",
                "ru_name": "Admin1 Shared Period",
                "user_id": None
            }
            create_response = await async_client.post("/api/periods/", json=shared_data)
            assert create_response.status_code == 201

            shared_period_id = create_response.json()["data"]["id"]

            # Admin2 can also see and edit the shared period
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': admin2.id,
                'username': admin2.username,
                'role': 'admin'
            })

            # Admin2 reads shared period created by Admin1
            admin2_get_response = await async_client.get(f"/api/periods/{shared_period_id}")
            assert admin2_get_response.status_code == 200

            admin2_get_data = admin2_get_response.json()
            assert admin2_get_data["data"]["is_editable"] is True  # Admin2 can edit Admin1's shared period

            # Admin2 updates period created by Admin1
            admin2_update = {
                "ru_name": "Updated by Admin2",
                "managed_by": admin2.id
            }
            admin2_update_response = await async_client.put(f"/api/periods/{shared_period_id}", json=admin2_update)
            assert admin2_update_response.status_code == 200

            admin2_update_data = admin2_update_response.json()
            assert admin2_update_data["data"]["ru_name"] == "Updated by Admin2"
            assert admin2_update_data["data"]["created_by"] == admin1.id  # Original creator preserved
            assert admin2_update_data["data"]["managed_by"] == admin2.id  # New manager

            # Admin1 can still see the updated period
            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': admin1.id,
                'username': admin1.username,
                'role': 'admin'
            })

            admin1_verify_response = await async_client.get(f"/api/periods/{shared_period_id}")
            assert admin1_verify_response.status_code == 200

            admin1_verify_data = admin1_verify_response.json()
            assert admin1_verify_data["data"]["ru_name"] == "Updated by Admin2"

            # Both admins can create their own shared periods simultaneously
            # (testing that there's no global locking that would prevent this)
            admin1_period_data = {
                "date": "2025-03-01T00:00:00",
                "ru_name": "Admin1 Second Period",
                "user_id": None
            }
            admin1_create2_response = await async_client.post("/api/periods/", json=admin1_period_data)
            assert admin1_create2_response.status_code == 201

            session.get_current_user_from_session = AsyncMock(return_value={
                'user_id': admin2.id,
                'username': admin2.username,
                'role': 'admin'
            })

            admin2_period_data = {
                "date": "2025-04-01T00:00:00",
                "ru_name": "Admin2 Own Period",
                "user_id": None
            }
            admin2_create_response = await async_client.post("/api/periods/", json=admin2_period_data)
            assert admin2_create_response.status_code == 201

            # Verify both periods exist as shared
            admin2_list_response = await async_client.get("/api/periods/")
            admin2_list_data = admin2_list_response.json()

            shared_periods = [p for p in admin2_list_data["data"] if p["is_shared"]]
            assert len(shared_periods) >= 3  # Original + Admin1's second + Admin2's

        finally:
            session.get_current_user_from_session = original_get_current_user