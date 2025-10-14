"""
E2E Test: Complete User Journey.

Tests the complete user experience from registration to viewing analytics.
This test simulates a real user flow through the application.

Scenario:
1. User authenticates via Telegram
2. Creates budget categories (articles)
3. Adds income and expense transactions (facts)
4. Views analytics and dashboards
5. Manages categories and transactions
"""

import pytest
from datetime import date, timedelta
from decimal import Decimal
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.user import User


@pytest.mark.asyncio
class TestCompleteUserJourney:
    """
    Test complete user journey from authentication to analytics.

    This E2E test covers the most common user workflows in the application.
    """

    async def test_complete_user_workflow(
        self,
        auth_client: AsyncClient,
        session: AsyncSession,
        test_user: User
    ):
        """
        Test complete user workflow: Create categories → Add transactions → View analytics.

        This test simulates a new user setting up their budget and using the app.
        """

        # ===== STEP 1: Create Income Category =====
        print("\n🏁 STEP 1: Creating income category...")
        income_category = await auth_client.post(
            "/api/v1/articles",
            json={
                "code": "SALARY",
                "name": "Monthly Salary",
                "type": "income",
                "parent_id": None
            }
        )
        assert income_category.status_code == 201
        salary_id = income_category.json()["id"]
        print(f"✅ Created income category (ID: {salary_id})")

        # ===== STEP 2: Create Expense Categories =====
        print("\n🏁 STEP 2: Creating expense categories...")

        # Main category: Living Expenses
        living_expenses = await auth_client.post(
            "/api/v1/articles",
            json={
                "code": "LIVING",
                "name": "Living Expenses",
                "type": "expense",
                "parent_id": None
            }
        )
        assert living_expenses.status_code == 201
        living_id = living_expenses.json()["id"]

        # Subcategories
        groceries = await auth_client.post(
            "/api/v1/articles",
            json={
                "code": "GROCERIES",
                "name": "Groceries",
                "type": "expense",
                "parent_id": living_id
            }
        )
        assert groceries.status_code == 201
        groceries_id = groceries.json()["id"]

        rent = await auth_client.post(
            "/api/v1/articles",
            json={
                "code": "RENT",
                "name": "Rent",
                "type": "expense",
                "parent_id": living_id
            }
        )
        assert rent.status_code == 201
        rent_id = rent.json()["id"]
        print(f"✅ Created expense categories (Living, Groceries, Rent)")

        # ===== STEP 3: Verify Category Hierarchy =====
        print("\n🏁 STEP 3: Verifying category hierarchy...")
        articles_list = await auth_client.get("/api/v1/articles")
        assert articles_list.status_code == 200
        articles = articles_list.json()
        assert len(articles) >= 4  # At least our 4 categories
        print(f"✅ Category hierarchy verified ({len(articles)} categories total)")

        # ===== STEP 4: Add Income Transaction =====
        print("\n🏁 STEP 4: Adding income transaction...")
        income_fact = await auth_client.post(
            "/api/v1/facts",
            json={
                "article_id": salary_id,
                "fact_date": date.today().isoformat(),
                "amount": "5000.00",
                "description": "October salary"
            }
        )
        assert income_fact.status_code == 201
        print(f"✅ Added income transaction: $5000.00")

        # ===== STEP 5: Add Expense Transactions =====
        print("\n🏁 STEP 5: Adding expense transactions...")

        # Rent payment
        rent_fact = await auth_client.post(
            "/api/v1/facts",
            json={
                "article_id": rent_id,
                "fact_date": date.today().isoformat(),
                "amount": "1500.00",
                "description": "Monthly rent payment"
            }
        )
        assert rent_fact.status_code == 201

        # Grocery purchases
        for i in range(5):
            grocery_date = date.today() - timedelta(days=i)
            grocery_fact = await auth_client.post(
                "/api/v1/facts",
                json={
                    "article_id": groceries_id,
                    "fact_date": grocery_date.isoformat(),
                    "amount": str(50.0 + i * 10),
                    "description": f"Groceries day {i+1}"
                }
            )
            assert grocery_fact.status_code == 201

        print(f"✅ Added expense transactions (1 rent + 5 groceries)")

        # ===== STEP 6: View Quick Stats Dashboard =====
        print("\n🏁 STEP 6: Checking dashboard statistics...")
        stats = await auth_client.get("/api/v1/analytics/quick-stats")
        assert stats.status_code == 200
        stats_data = stats.json()

        # Verify stats structure
        assert "today" in stats_data
        assert "month" in stats_data
        assert stats_data["month"]["income"] > 0
        assert stats_data["month"]["expense"] > 0
        assert stats_data["month"]["balance"] == stats_data["month"]["income"] - stats_data["month"]["expense"]
        print(f"✅ Dashboard stats: Income={stats_data['month']['income']}, Expense={stats_data['month']['expense']}, Balance={stats_data['month']['balance']}")

        # ===== STEP 7: View Spending Trends =====
        print("\n🏁 STEP 7: Viewing spending trends...")
        trends = await auth_client.get("/api/v1/analytics/trends?days=7")
        assert trends.status_code == 200
        trends_data = trends.json()

        assert "dates" in trends_data
        assert "income" in trends_data
        assert "expense" in trends_data
        assert len(trends_data["dates"]) == 8  # 7 days + today
        print(f"✅ Trends data retrieved ({len(trends_data['dates'])} days)")

        # ===== STEP 8: View Category Breakdown =====
        print("\n🏁 STEP 8: Viewing category breakdown...")
        breakdown = await auth_client.get("/api/v1/analytics/category-breakdown?type=expense&period=month")
        assert breakdown.status_code == 200
        breakdown_data = breakdown.json()

        assert "categories" in breakdown_data
        assert "amounts" in breakdown_data
        assert "percentages" in breakdown_data
        assert len(breakdown_data["categories"]) >= 2  # Rent and Groceries
        print(f"✅ Category breakdown: {len(breakdown_data['categories'])} categories")

        # ===== STEP 9: Update a Transaction =====
        print("\n🏁 STEP 9: Updating a transaction...")
        facts_list = await auth_client.get("/api/v1/facts")
        assert facts_list.status_code == 200
        facts = facts_list.json()

        first_fact_id = facts[0]["id"]
        update_response = await auth_client.put(
            f"/api/v1/facts/{first_fact_id}",
            json={
                "article_id": facts[0]["article_id"],
                "fact_date": facts[0]["fact_date"],
                "amount": "99.99",
                "description": "Updated description"
            }
        )
        assert update_response.status_code == 200
        updated_fact = update_response.json()
        assert float(updated_fact["amount"]) == 99.99
        print(f"✅ Updated transaction {first_fact_id}")

        # ===== STEP 10: Delete a Transaction =====
        print("\n🏁 STEP 10: Deleting a transaction...")
        delete_response = await auth_client.delete(f"/api/v1/facts/{first_fact_id}")
        assert delete_response.status_code == 204
        print(f"✅ Deleted transaction {first_fact_id}")

        # ===== STEP 11: Verify Final State =====
        print("\n🏁 STEP 11: Verifying final state...")
        final_facts = await auth_client.get("/api/v1/facts")
        assert final_facts.status_code == 200
        assert len(final_facts.json()) == len(facts) - 1  # One deleted

        final_stats = await auth_client.get("/api/v1/analytics/quick-stats")
        assert final_stats.status_code == 200
        print(f"✅ Final state verified - Journey complete!")

        print("\n" + "="*60)
        print("🎉 COMPLETE USER JOURNEY TEST PASSED!")
        print("="*60)


@pytest.mark.asyncio
class TestBudgetPlanningJourney:
    """
    Test budget planning and comparison workflow.

    Simulates user planning budget and comparing with actual spending.
    """

    async def test_budget_planning_workflow(
        self,
        auth_client: AsyncClient,
        session: AsyncSession
    ):
        """
        Test budget planning: Set budgets → Track expenses → Compare plan vs actual.
        """

        print("\n🏁 BUDGET PLANNING WORKFLOW TEST")

        # ===== STEP 1: Create Categories for Planning =====
        print("\n📊 Step 1: Creating budget categories...")

        categories = [
            ("FOOD", "Food & Dining"),
            ("TRANSPORT", "Transportation"),
            ("ENTERTAINMENT", "Entertainment"),
        ]

        category_ids = {}
        for code, name in categories:
            response = await auth_client.post(
                "/api/v1/articles",
                json={
                    "code": code,
                    "name": name,
                    "type": "expense",
                    "parent_id": None
                }
            )
            assert response.status_code == 201
            category_ids[code] = response.json()["id"]

        print(f"✅ Created {len(categories)} budget categories")

        # ===== STEP 2: Add Planned vs Actual Spending =====
        print("\n📊 Step 2: Adding transactions...")

        # Add various transactions over the past week
        today = date.today()
        for days_ago in range(7):
            transaction_date = today - timedelta(days=days_ago)

            # Food expenses
            await auth_client.post(
                "/api/v1/facts",
                json={
                    "article_id": category_ids["FOOD"],
                    "fact_date": transaction_date.isoformat(),
                    "amount": str(30.0 + days_ago * 5),
                    "description": f"Food day {days_ago+1}"
                }
            )

            # Transportation (every other day)
            if days_ago % 2 == 0:
                await auth_client.post(
                    "/api/v1/facts",
                    json={
                        "article_id": category_ids["TRANSPORT"],
                        "fact_date": transaction_date.isoformat(),
                        "amount": "15.00",
                        "description": f"Transport day {days_ago+1}"
                    }
                )

        print("✅ Added weekly transactions")

        # ===== STEP 3: View Plan vs Fact Data =====
        print("\n📊 Step 3: Viewing plan vs fact comparison...")

        plan_fact = await auth_client.get("/api/v1/analytics/plan-fact?period=week")
        assert plan_fact.status_code == 200
        plan_data = plan_fact.json()

        assert "labels" in plan_data
        assert "plan" in plan_data
        assert "fact" in plan_data
        assert len(plan_data["labels"]) == 7  # Week

        print(f"✅ Plan vs Fact data retrieved")
        print(f"   - Periods: {len(plan_data['labels'])}")
        print(f"   - Total fact: ${sum(plan_data['fact']):.2f}")
        print(f"   - Total plan: ${sum(plan_data['plan']):.2f}")

        print("\n" + "="*60)
        print("🎉 BUDGET PLANNING WORKFLOW TEST PASSED!")
        print("="*60)


@pytest.mark.asyncio
class TestAnalyticsJourney:
    """
    Test analytics and reporting workflow.

    Simulates user exploring various analytics views.
    """

    async def test_analytics_exploration(
        self,
        auth_client: AsyncClient
    ):
        """
        Test analytics exploration: Create data → View all chart types.
        """

        print("\n🏁 ANALYTICS EXPLORATION TEST")

        # ===== Setup: Create test data =====
        print("\n📈 Setting up test data...")

        # Create income category
        income = await auth_client.post(
            "/api/v1/articles",
            json={"code": "INCOME", "name": "Income", "type": "income", "parent_id": None}
        )
        income_id = income.json()["id"]

        # Create expense categories
        expenses = ["Housing", "Food", "Transport", "Healthcare", "Entertainment"]
        expense_ids = []
        for name in expenses:
            response = await auth_client.post(
                "/api/v1/articles",
                json={"code": name.upper(), "name": name, "type": "expense", "parent_id": None}
            )
            expense_ids.append(response.json()["id"])

        # Add transactions for the current month
        today = date.today()
        month_start = date(today.year, today.month, 1)

        # Add income
        await auth_client.post(
            "/api/v1/facts",
            json={
                "article_id": income_id,
                "fact_date": month_start.isoformat(),
                "amount": "5000.00",
                "description": "Monthly income"
            }
        )

        # Add expenses
        expense_amounts = [1200, 400, 300, 200, 150]
        for expense_id, amount in zip(expense_ids, expense_amounts):
            await auth_client.post(
                "/api/v1/facts",
                json={
                    "article_id": expense_id,
                    "fact_date": today.isoformat(),
                    "amount": str(amount),
                    "description": f"Monthly {amount}"
                }
            )

        print("✅ Test data created")

        # ===== Test All Analytics Endpoints =====
        print("\n📈 Testing all analytics endpoints...")

        # 1. Quick Stats
        stats = await auth_client.get("/api/v1/analytics/quick-stats")
        assert stats.status_code == 200
        print("✅ Quick stats")

        # 2. Trends
        trends = await auth_client.get("/api/v1/analytics/trends?days=30")
        assert trends.status_code == 200
        assert len(trends.json()["dates"]) == 31
        print("✅ Trends (30 days)")

        # 3. Category Breakdown
        breakdown = await auth_client.get("/api/v1/analytics/category-breakdown?type=expense&period=month")
        assert breakdown.status_code == 200
        assert len(breakdown.json()["categories"]) == 5
        print("✅ Category breakdown")

        # 4. Waterfall Chart
        waterfall = await auth_client.get("/api/v1/analytics/waterfall")
        assert waterfall.status_code == 200
        waterfall_data = waterfall.json()
        assert "labels" in waterfall_data
        assert "income" in waterfall_data
        assert "expense" in waterfall_data
        assert "balance" in waterfall_data
        print("✅ Waterfall chart")

        # 5. Heatmap
        heatmap = await auth_client.get("/api/v1/analytics/heatmap")
        assert heatmap.status_code == 200
        heatmap_data = heatmap.json()
        assert "weeks" in heatmap_data
        assert "day_labels" in heatmap_data
        assert len(heatmap_data["day_labels"]) == 7  # Days of week
        print("✅ Heatmap")

        # 6. Plan vs Fact
        plan_fact = await auth_client.get("/api/v1/analytics/plan-fact?period=month")
        assert plan_fact.status_code == 200
        print("✅ Plan vs fact")

        print("\n" + "="*60)
        print("🎉 ANALYTICS EXPLORATION TEST PASSED!")
        print("   - All 6 analytics endpoints tested successfully")
        print("="*60)
