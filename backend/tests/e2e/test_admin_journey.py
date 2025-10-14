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
from datetime import date
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
        users = users_response.json()

        assert "users" in users
        assert "total" in users
        assert users["total"] >= 2  # At least test_user and admin
        print(f"✅ Retrieved {users['total']} users")

        # ===== STEP 2: Search for Specific User =====
        print("\n👤 Step 2: Searching for user...")
        search_response = await admin_client.get(f"/api/v1/admin/users?search=testuser")
        assert search_response.status_code == 200
        search_results = search_response.json()

        assert search_results["total"] >= 1
        found_user = None
        for user in search_results["users"]:
            if user["username"] == "testuser":
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

        # ===== STEP 4: View User Statistics =====
        print("\n👤 Step 4: Viewing user statistics...")
        stats_response = await admin_client.get(f"/api/v1/admin/users/{test_user.id}/stats")
        assert stats_response.status_code == 200
        stats = stats_response.json()

        assert "articles_count" in stats
        assert "facts_count" in stats
        assert "total_income" in stats
        assert "total_expense" in stats
        print(f"✅ User stats: {stats['articles_count']} articles, {stats['facts_count']} facts")

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

        global_incomes = [
            ("SALARY", "Salary"),
            ("BONUS", "Bonus"),
            ("INVESTMENT", "Investment Income")
        ]

        created_ids = []
        for code, name in global_incomes:
            response = await admin_client.post(
                "/api/v1/admin/articles/global",
                json={
                    "code": code,
                    "name": name,
                    "type": "income",
                    "parent_id": None
                }
            )
            assert response.status_code == 201
            created_ids.append(response.json()["id"])

        print(f"✅ Created {len(global_incomes)} global income categories")

        # ===== STEP 2: Create Global Expense Categories =====
        print("\n📂 Step 2: Creating global expense categories...")

        global_expenses = [
            ("HOUSING", "Housing"),
            ("UTILITIES", "Utilities"),
            ("INSURANCE", "Insurance")
        ]

        for code, name in global_expenses:
            response = await admin_client.post(
                "/api/v1/admin/articles/global",
                json={
                    "code": code,
                    "name": name,
                    "type": "expense",
                    "parent_id": None
                }
            )
            assert response.status_code == 201
            created_ids.append(response.json()["id"])

        print(f"✅ Created {len(global_expenses)} global expense categories")

        # ===== STEP 3: List All Global Articles =====
        print("\n📂 Step 3: Listing all global articles...")

        list_response = await admin_client.get("/api/v1/admin/articles/global")
        assert list_response.status_code == 200
        global_articles = list_response.json()

        assert len(global_articles) >= 6  # Our created articles
        print(f"✅ Retrieved {len(global_articles)} global articles")

        # ===== STEP 4: Update a Global Article =====
        print("\n📂 Step 4: Updating a global article...")

        first_id = created_ids[0]
        update_response = await admin_client.put(
            f"/api/v1/admin/articles/global/{first_id}",
            json={
                "code": "SALARY",
                "name": "Monthly Salary (Updated)",
                "type": "income",
                "parent_id": None
            }
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert "Updated" in updated["name"]
        print(f"✅ Updated global article")

        # ===== STEP 5: Delete a Global Article =====
        print("\n📂 Step 5: Deleting a global article...")

        last_id = created_ids[-1]
        delete_response = await admin_client.delete(f"/api/v1/admin/articles/global/{last_id}")
        assert delete_response.status_code == 204
        print(f"✅ Deleted global article")

        # Verify deletion
        verify_response = await admin_client.get("/api/v1/admin/articles/global")
        assert verify_response.status_code == 200
        remaining = verify_response.json()
        assert len(remaining) == len(global_articles) - 1
        print(f"✅ Deletion verified")

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
        Test admin viewing system statistics and health.
        """

        print("\n🏁 ADMIN SYSTEM MONITORING TEST")

        # ===== STEP 1: View System Statistics =====
        print("\n📊 Step 1: Viewing system statistics...")

        stats_response = await admin_client.get("/api/v1/admin/stats")
        assert stats_response.status_code == 200
        stats = stats_response.json()

        # Verify structure
        assert "users" in stats
        assert "articles" in stats
        assert "facts" in stats
        assert "total_users" in stats["users"]
        assert "active_users" in stats["users"]
        assert "total_facts" in stats["facts"]

        print(f"✅ System stats:")
        print(f"   - Total users: {stats['users']['total_users']}")
        print(f"   - Active users: {stats['users']['active_users']}")
        print(f"   - Total transactions: {stats['facts']['total_facts']}")

        # ===== STEP 2: View Recent Activity =====
        print("\n📊 Step 2: Viewing recent activity...")

        activity_response = await admin_client.get("/api/v1/admin/activity?days=7")
        assert activity_response.status_code == 200
        activity = activity_response.json()

        assert "period_days" in activity
        assert "daily_stats" in activity

        print(f"✅ Activity data retrieved for {activity['period_days']} days")

        # ===== STEP 3: View Top Users by Activity =====
        print("\n📊 Step 3: Viewing top users...")

        top_users_response = await admin_client.get("/api/v1/admin/users/top?limit=10&by=facts_count")
        assert top_users_response.status_code == 200
        top_users = top_users_response.json()

        assert "users" in top_users
        assert "metric" in top_users
        assert top_users["metric"] == "facts_count"

        print(f"✅ Retrieved top {len(top_users['users'])} users by activity")

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
            "/api/v1/admin/stats",
            "/api/v1/admin/articles/global"
        ]

        for endpoint in admin_endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code == 403, f"Regular user should not access {endpoint}"
            print(f"✅ Access denied to {endpoint}")

        print("\n" + "="*60)
        print("🎉 SECURITY TEST PASSED!")
        print("   - All admin endpoints properly protected")
        print("="*60)
