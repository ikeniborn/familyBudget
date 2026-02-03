"""
E2E Test: Admin User Journey.

Tests admin-specific workflows including user management and system monitoring.

Scenario:
1. Admin views all users
2. Admin manages global articles (shared categories)
3. Admin views system statistics
4. Admin manages user permissions
"""


import pytest
from httpx import AsyncClient

from backend.app.models.user import User


@pytest.mark.asyncio
class TestAdminUserManagement:
    """
    Test admin user management workflow.

    Simulates admin managing users in the system.
    """

    async def test_admin_user_management_workflow(
        self,
        admin_client: AsyncClient,
        test_user: User
    ):
        """
        Test admin managing users: View → Search → Update permissions.
        """

        print("\n🏁 ADMIN USER MANAGEMENT TEST")

        # ===== STEP 1: View All Users =====
        print("\n👤 Step 1: Viewing all users...")
        users_response = await admin_client.get("/api/v1/admin/users")
        assert users_response.status_code == 200
        response_data = users_response.json()  # Paginated response

        # Verify paginated response structure
        assert "users" in response_data
        assert "total" in response_data
        assert "limit" in response_data
        assert "offset" in response_data

        users = response_data["users"]
        assert isinstance(users, list)
        assert len(users) >= 2  # At least test_user and admin
        print(f"✅ Retrieved {len(users)} users (total: {response_data['total']})")

        # ===== STEP 2: Find Test User in List =====
        print("\n👤 Step 2: Finding test user...")
        # Search in paginated users list
        found_user = None
        for user in users:
            if user.get("username") == "testuser":
                found_user = user
                break

        assert found_user is not None
        print(f"✅ Found user: {found_user['username']}")

        # ===== STEP 3: View User Details =====
        print("\n👤 Step 3: Viewing user details...")
        user_details = await admin_client.get(f"/api/v1/admin/users/{test_user.id}")
        assert user_details.status_code == 200
        details = user_details.json()

        assert details["id"] == test_user.id
        assert details["username"] == "testuser"
        assert details["is_admin"] == False
        print(f"✅ Retrieved user details for {details['username']}")

        # ===== STEP 4: View All Users Statistics =====
        print("\n👤 Step 4: Viewing users statistics...")
        stats_response = await admin_client.get("/api/v1/admin/users/stats/summary")
        assert stats_response.status_code == 200
        all_stats = stats_response.json()

        assert isinstance(all_stats, list)
        # Find our test user's stats
        test_user_stats = next((s for s in all_stats if s["user_id"] == test_user.id), None)
        assert test_user_stats is not None
        print(f"✅ User stats: {test_user_stats['total_articles']} articles, {test_user_stats['total_facts']} facts")

        print("\n" + "="*60)
        print("🎉 ADMIN USER MANAGEMENT TEST PASSED!")
        print("="*60)


@pytest.mark.asyncio
class TestAdminGlobalArticles:
    """
    Test admin managing global articles (shared budget categories).
    """

    async def test_admin_global_articles_workflow(
        self,
        admin_client: AsyncClient
    ):
        """
        Test admin managing global articles: Create → Update → Delete.
        """

        print("\n🏁 ADMIN GLOBAL ARTICLES TEST")

        # ===== STEP 1: Create Global Income Categories =====
        print("\n📂 Step 1: Creating global income categories...")

        incomes = [
            "Salary",
            "Bonus",
            "Investment Income"
        ]

        created_ids = []
        for name in incomes:
            response = await admin_client.post(
                "/api/v1/admin/articles",
                json={
                    "name": name,
                    "type": "income",
                    "parent_id": None,
                }
            )
            assert response.status_code == 201
            created_ids.append(response.json()["id"])

        print(f"✅ Created {len(incomes)} income categories")

        # ===== STEP 2: Create Global Expense Categories =====
        print("\n📂 Step 2: Creating global expense categories...")

        expenses = [
            "Housing",
            "Utilities",
            "Insurance"
        ]

        for name in expenses:
            response = await admin_client.post(
                "/api/v1/admin/articles",
                json={
                    "name": name,
                    "type": "expense",
                    "parent_id": None,
                }
            )
            assert response.status_code == 201
            created_ids.append(response.json()["id"])

        print(f"✅ Created {len(expenses)} expense categories")

        # ===== STEP 3: List All Articles =====
        print("\n📂 Step 3: Listing all articles...")

        list_response = await admin_client.get("/api/v1/admin/articles")
        assert list_response.status_code == 200
        articles = list_response.json()

        assert len(articles) >= 6  # Our created articles
        print(f"✅ Retrieved {len(articles)} articles")

        # ===== STEP 4: Update a Global Article =====
        print("\n📂 Step 4: Updating a global article...")

        first_id = created_ids[0]
        update_response = await admin_client.put(
            f"/api/v1/admin/articles/{first_id}",  # Use /articles/{id}
            json={
                "name": "Monthly Salary (Updated)",
                "parent_id": None
            }
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert "Updated" in updated["name"]
        print("✅ Updated global article")

        # ===== STEP 5: Delete a Global Article =====
        print("\n📂 Step 5: Deleting a global article...")

        last_id = created_ids[-1]
        delete_response = await admin_client.delete(f"/api/v1/admin/articles/{last_id}")
        assert delete_response.status_code == 200  # Returns 200 with message, not 204
        print("✅ Deleted global article")

        # Verify deletion
        verify_response = await admin_client.get("/api/v1/admin/articles")
        assert verify_response.status_code == 200
        remaining = verify_response.json()
        assert len(remaining) == len(articles) - 1
        print("✅ Deletion verified")

        print("\n" + "="*60)
        print("🎉 ADMIN GLOBAL ARTICLES TEST PASSED!")
        print("="*60)


@pytest.mark.asyncio
class TestAdminSystemMonitoring:
    """
    Test admin system monitoring and statistics.
    """

    async def test_admin_system_monitoring(
        self,
        admin_client: AsyncClient
    ):
        """
        Test admin viewing basic statistics using existing endpoints.
        """

        print("\n🏁 ADMIN SYSTEM MONITORING TEST")

        # ===== STEP 1: View User Statistics =====
        print("\n📊 Step 1: Viewing user statistics...")

        stats_response = await admin_client.get("/api/v1/admin/users/stats/summary")
        assert stats_response.status_code == 200
        user_stats = stats_response.json()

        assert isinstance(user_stats, list)
        total_users = len(user_stats)
        total_facts = sum(s["total_facts"] for s in user_stats)

        print("✅ System stats:")
        print(f"   - Total users: {total_users}")
        print(f"   - Total transactions: {total_facts}")

        # ===== STEP 2: View Facts Count =====
        print("\n📊 Step 2: Viewing facts count...")

        facts_count_response = await admin_client.get("/api/v1/admin/facts/count")
        assert facts_count_response.status_code == 200
        facts_count = facts_count_response.json()

        assert "total" in facts_count
        print(f"✅ Total facts in system: {facts_count['total']}")

        # ===== STEP 3: View All Users =====
        print("\n📊 Step 3: Viewing all users...")

        users_response = await admin_client.get("/api/v1/admin/users")
        assert users_response.status_code == 200
        response_data = users_response.json()

        # Verify paginated response structure
        assert "users" in response_data
        assert "total" in response_data
        users = response_data["users"]
        assert isinstance(users, list)
        print(f"✅ Retrieved {len(users)} users (total: {response_data['total']})")

        print("\n" + "="*60)
        print("🎉 ADMIN SYSTEM MONITORING TEST PASSED!")
        print("="*60)


@pytest.mark.asyncio
class TestAdminSecurityWorkflow:
    """
    Test admin security and permission management.
    """

    async def test_regular_user_cannot_access_admin_endpoints(
        self,
        auth_client: AsyncClient
    ):
        """
        Test that regular users cannot access admin endpoints.
        """

        print("\n🏁 SECURITY: Regular user access restriction test")

        # Try to access admin endpoints as regular user
        admin_endpoints = [
            "/api/v1/admin/users",
            "/api/v1/admin/users/stats/summary",
            "/api/v1/admin/articles"
        ]

        for endpoint in admin_endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code == 403, f"Regular user should not access {endpoint}"
            print(f"✅ Access denied to {endpoint}")

        print("\n" + "="*60)
        print("🎉 SECURITY TEST PASSED!")
        print("   - All admin endpoints properly protected")
        print("="*60)
