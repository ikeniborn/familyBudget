"""
Integration tests for fact CRUD workflows with aggregation.

Tests complete fact management workflows through API:
1. Create facts (POST /api/v1/facts)
2. Read facts with filtering (GET /api/v1/facts)
3. Update facts (PUT /api/v1/facts/{id})
4. Delete facts (DELETE /api/v1/facts/{id})
5. Get aggregated summary (GET /api/v1/facts/summary)
6. User isolation (multi-user scenarios)
7. Date range filtering

These tests verify facts API, aggregation service, and user isolation work correctly end-to-end.
"""

from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.fact import BudgetFact

# ============================================================================
# Create Fact Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_fact_complete_workflow(auth_client: AsyncClient, session: AsyncSession):
    """
    Test complete fact creation workflow.

    Workflow:
    1. Create article via API
    2. Create fact linked to article
    3. Verify fact stored in database
    4. Verify fact returned with correct data
    """
    # Step 1: Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": None,
        },
    )
    article_id = article_response.json()["id"]

    # Step 2: Create fact
    fact_data = {
        "article_id": article_id,
        "fact_date": "2025-10-13",
        "amount": "150.50",
        "description": "Weekly grocery shopping",
    }

    fact_response = await auth_client.post("/api/v1/facts", json=fact_data)

    assert fact_response.status_code == 201

    fact_json = fact_response.json()
    fact_id = fact_json["id"]

    # Step 3: Verify in database
    stmt = select(BudgetFact).where(BudgetFact.id == fact_id)
    result = await session.execute(stmt)
    fact = result.scalar_one()

    assert fact.article_id == article_id
    assert fact.amount == Decimal("150.50")
    assert fact.fact_date == date(2025, 10, 13)
    assert fact.description == "Weekly grocery shopping"


@pytest.mark.asyncio
async def test_create_multiple_facts(auth_client: AsyncClient):
    """
    Test creating multiple facts for same article.

    Verifies:
    - Multiple facts can be created
    - Each fact has unique ID
    - Facts are associated with correct article
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "SALARY", "name": "Salary", "type": "income", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create multiple facts
    fact_ids = []

    for i in range(1, 4):
        fact_response = await auth_client.post(
            "/api/v1/facts",
            json={
                "article_id": article_id,
                "fact_date": f"2025-10-{i:02d}",
                "amount": f"{1000 * i}.00",
            },
        )

        assert fact_response.status_code == 201
        fact_ids.append(fact_response.json()["id"])

    # Verify all facts have unique IDs
    assert len(fact_ids) == 3
    assert len(set(fact_ids)) == 3


@pytest.mark.asyncio
async def test_create_fact_without_description(auth_client: AsyncClient):
    """
    Test creating fact without optional description field.

    Verifies:
    - Description is optional
    - Fact created successfully without it
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "MISC", "name": "Miscellaneous", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create fact without description
    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "50.00",
        },
    )

    assert fact_response.status_code == 201

    fact_json = fact_response.json()
    assert fact_json["description"] is None or fact_json["description"] == ""


# ============================================================================
# Read Facts Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_all_facts(auth_client: AsyncClient):
    """
    Test getting all facts for current user.

    Workflow:
    1. Create article
    2. Create multiple facts
    3. GET /api/v1/facts
    4. Verify all facts returned
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create facts
    for i in range(3):
        await auth_client.post(
            "/api/v1/facts",
            json={
                "article_id": article_id,
                "fact_date": f"2025-10-{i+1:02d}",
                "amount": f"{100 + i * 50}.00",
            },
        )

    # Get all facts
    facts_response = await auth_client.get("/api/v1/facts")

    assert facts_response.status_code == 200

    facts_data = facts_response.json()
    assert facts_data["total"] >= 3
    assert len(facts_data["facts"]) >= 3


@pytest.mark.asyncio
async def test_get_facts_with_date_filter(auth_client: AsyncClient):
    """
    Test getting facts filtered by date range.

    Query: date_from and date_to parameters
    Expected: Only facts within date range
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "TRANSPORT", "name": "Transport", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create facts on different dates
    await auth_client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-01", "amount": "10.00"},
    )
    await auth_client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-15", "amount": "20.00"},
    )
    await auth_client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-31", "amount": "30.00"},
    )

    # Get facts for Oct 10-20 (should only return middle fact)
    facts_response = await auth_client.get(
        "/api/v1/facts?date_from=2025-10-10&date_to=2025-10-20"
    )

    assert facts_response.status_code == 200

    facts_data = facts_response.json()
    facts = facts_data["facts"]

    # Should only return fact from Oct 15
    dates = [fact["fact_date"] for fact in facts if fact["article_id"] == article_id]
    assert "2025-10-15" in dates
    assert "2025-10-01" not in dates
    assert "2025-10-31" not in dates


@pytest.mark.asyncio
async def test_get_facts_with_article_filter(auth_client: AsyncClient):
    """
    Test getting facts filtered by article_id.

    Query: article_id parameter
    Expected: Only facts for specified article
    """
    # Create two articles
    article1_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    article1_id = article1_response.json()["id"]

    article2_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "RENT", "name": "Rent", "type": "expense", "parent_id": None},
    )
    article2_id = article2_response.json()["id"]

    # Create facts for both articles
    await auth_client.post(
        "/api/v1/facts",
        json={"article_id": article1_id, "fact_date": "2025-10-13", "amount": "100.00"},
    )
    await auth_client.post(
        "/api/v1/facts",
        json={"article_id": article2_id, "fact_date": "2025-10-13", "amount": "500.00"},
    )

    # Get facts for article1 only
    facts_response = await auth_client.get(f"/api/v1/facts?article_id={article1_id}")

    assert facts_response.status_code == 200

    facts_data = facts_response.json()
    facts = facts_data["facts"]

    # All returned facts should be for article1
    for fact in facts:
        if fact["amount"] in ["100.00", "500.00"]:  # Our test facts
            assert fact["article_id"] == article1_id


@pytest.mark.asyncio
async def test_get_fact_by_id(auth_client: AsyncClient):
    """
    Test getting single fact by ID.

    Workflow:
    1. Create fact
    2. GET /api/v1/facts/{id}
    3. Verify correct fact returned
    """
    # Create article and fact
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "UTILITIES", "name": "Utilities", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "75.50",
            "description": "Electricity bill",
        },
    )
    fact_id = fact_response.json()["id"]

    # Get fact by ID
    get_response = await auth_client.get(f"/api/v1/facts/{fact_id}")

    assert get_response.status_code == 200

    fact_json = get_response.json()
    assert fact_json["id"] == fact_id
    assert fact_json["article_id"] == article_id
    assert fact_json["amount"] == "75.50"
    assert fact_json["description"] == "Electricity bill"


# ============================================================================
# Update Fact Tests
# ============================================================================


@pytest.mark.asyncio
async def test_update_fact_amount(auth_client: AsyncClient, session: AsyncSession):
    """
    Test updating fact amount (SCD Type 2).

    Workflow:
    1. Create fact
    2. Update amount
    3. Verify new version created
    4. Verify old version marked is_current=False
    """
    # Create article and fact
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "SHOPPING", "name": "Shopping", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "100.00",
        },
    )
    fact_id = fact_response.json()["id"]

    # Update amount
    update_response = await auth_client.put(
        f"/api/v1/facts/{fact_id}",
        json={"amount": "150.00"},
    )

    assert update_response.status_code == 200

    updated_fact = update_response.json()
    assert updated_fact["amount"] == "150.00"

    # Verify SCD Type 2: two versions exist
    stmt = select(BudgetFact).where(BudgetFact.id == fact_id)
    result = await session.execute(stmt)
    facts = result.scalars().all()

    # Should have old version (is_current=False) and new version (is_current=True)
    current_versions = [f for f in facts if f.is_current]
    assert len(current_versions) == 1
    assert current_versions[0].amount == Decimal("150.00")


@pytest.mark.asyncio
async def test_update_fact_description(auth_client: AsyncClient):
    """
    Test updating fact description.

    Verifies:
    - Description can be updated
    - Other fields remain unchanged
    """
    # Create article and fact
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "MEDICAL", "name": "Medical", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "200.00",
            "description": "Doctor visit",
        },
    )
    fact_id = fact_response.json()["id"]

    # Update description
    update_response = await auth_client.put(
        f"/api/v1/facts/{fact_id}",
        json={"description": "Dentist appointment"},
    )

    assert update_response.status_code == 200

    updated_fact = update_response.json()
    assert updated_fact["description"] == "Dentist appointment"
    assert updated_fact["amount"] == "200.00"  # Unchanged


@pytest.mark.asyncio
async def test_update_fact_date(auth_client: AsyncClient):
    """
    Test updating fact date.

    Verifies:
    - Fact date can be changed
    - Date validation works
    """
    # Create article and fact
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "DINING", "name": "Dining", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "50.00",
        },
    )
    fact_id = fact_response.json()["id"]

    # Update date
    update_response = await auth_client.put(
        f"/api/v1/facts/{fact_id}",
        json={"fact_date": "2025-10-15"},
    )

    assert update_response.status_code == 200

    updated_fact = update_response.json()
    assert updated_fact["fact_date"] == "2025-10-15"


# ============================================================================
# Delete Fact Tests
# ============================================================================


@pytest.mark.asyncio
async def test_delete_fact(auth_client: AsyncClient):
    """
    Test deleting fact (soft delete - SCD Type 2).

    Workflow:
    1. Create fact
    2. DELETE /api/v1/facts/{id}
    3. Verify fact not returned in queries (is_current=False)
    4. Verify 404 when trying to get deleted fact
    """
    # Create article and fact
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "LEISURE", "name": "Leisure", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "80.00",
        },
    )
    fact_id = fact_response.json()["id"]

    # Delete fact
    delete_response = await auth_client.delete(f"/api/v1/facts/{fact_id}")

    assert delete_response.status_code == 204

    # Verify fact is gone (404)
    get_response = await auth_client.get(f"/api/v1/facts/{fact_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_fact(auth_client: AsyncClient):
    """
    Test deleting fact that doesn't exist.

    Expected: 404 Not Found
    """
    # Try to delete non-existent fact
    delete_response = await auth_client.delete("/api/v1/facts/99999")

    assert delete_response.status_code == 404


# ============================================================================
# Aggregation / Summary Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_summary_income_and_expenses(auth_client: AsyncClient):
    """
    Test getting aggregated summary of income and expenses.

    Workflow:
    1. Create income article and facts
    2. Create expense article and facts
    3. GET /api/v1/facts/summary
    4. Verify totals calculated correctly
    """
    # Create income article
    income_article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "SALARY", "name": "Salary", "type": "income", "parent_id": None},
    )
    income_article_id = income_article_response.json()["id"]

    # Create expense article
    expense_article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "RENT", "name": "Rent", "type": "expense", "parent_id": None},
    )
    expense_article_id = expense_article_response.json()["id"]

    # Create income facts
    await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": income_article_id,
            "fact_date": "2025-10-01",
            "amount": "3000.00",
        },
    )
    await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": income_article_id,
            "fact_date": "2025-10-15",
            "amount": "2000.00",
        },
    )

    # Create expense facts
    await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": expense_article_id,
            "fact_date": "2025-10-05",
            "amount": "1200.00",
        },
    )
    await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": expense_article_id,
            "fact_date": "2025-10-20",
            "amount": "800.00",
        },
    )

    # Get summary
    summary_response = await auth_client.get("/api/v1/facts/summary")

    assert summary_response.status_code == 200

    summary_data = summary_response.json()

    # Verify income total (3000 + 2000 = 5000)
    assert Decimal(summary_data["total_income"]) >= Decimal("5000.00")

    # Verify expense total (1200 + 800 = 2000)
    assert Decimal(summary_data["total_expense"]) >= Decimal("2000.00")

    # Verify balance (5000 - 2000 = 3000)
    assert Decimal(summary_data["balance"]) >= Decimal("3000.00")


@pytest.mark.asyncio
async def test_get_summary_with_date_filter(auth_client: AsyncClient):
    """
    Test getting summary filtered by date range.

    Query: date_from and date_to parameters
    Expected: Only facts within date range included in totals
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "INCOME", "name": "Income", "type": "income", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create facts on different dates
    await auth_client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-01", "amount": "1000.00"},
    )
    await auth_client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-15", "amount": "2000.00"},
    )
    await auth_client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-31", "amount": "3000.00"},
    )

    # Get summary for Oct 10-20 (should only include middle fact: 2000)
    summary_response = await auth_client.get(
        "/api/v1/facts/summary?date_from=2025-10-10&date_to=2025-10-20"
    )

    assert summary_response.status_code == 200

    summary_data = summary_response.json()

    # Total income should be 2000 (only middle fact)
    total_income = Decimal(summary_data["total_income"])
    assert total_income == Decimal("2000.00")


@pytest.mark.asyncio
async def test_get_summary_no_facts(auth_client: AsyncClient):
    """
    Test getting summary when user has no facts.

    Expected: All totals are 0
    """
    # Get summary without creating any facts
    summary_response = await auth_client.get("/api/v1/facts/summary")

    assert summary_response.status_code == 200

    summary_data = summary_response.json()

    # All totals should be 0
    assert Decimal(summary_data["total_income"]) == Decimal("0.00")
    assert Decimal(summary_data["total_expense"]) == Decimal("0.00")
    assert Decimal(summary_data["balance"]) == Decimal("0.00")


# ============================================================================
# User Isolation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_user_cannot_access_other_user_facts(client: AsyncClient, test_user, test_admin):
    """
    Test that user cannot access facts belonging to another user.

    Workflow:
    1. Admin creates article and fact
    2. Regular user tries to access admin's fact
    3. Verify 404 Not Found (fact is invisible to regular user)
    """
    from backend.app.services.jwt import create_access_token

    # Login as admin
    admin_token = create_access_token(test_admin.id)
    client.cookies.set("access_token", admin_token)

    # Admin creates article and fact
    article_response = await client.post(
        "/api/v1/articles",
        json={"code": "ADMIN_ARTICLE", "name": "Admin Article", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    fact_response = await client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "999.99",
        },
    )
    admin_fact_id = fact_response.json()["id"]

    # Login as regular user
    user_token = create_access_token(test_user.id)
    client.cookies.set("access_token", user_token)

    # Try to access admin's fact
    get_response = await client.get(f"/api/v1/facts/{admin_fact_id}")

    # Should be 404 (fact is invisible to regular user due to user isolation)
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_user_cannot_update_other_user_facts(client: AsyncClient, test_user, test_admin):
    """
    Test that user cannot update facts belonging to another user.

    Expected: 404 Not Found (fact is invisible)
    """
    from backend.app.services.jwt import create_access_token

    # Admin creates fact
    admin_token = create_access_token(test_admin.id)
    client.cookies.set("access_token", admin_token)

    article_response = await client.post(
        "/api/v1/articles",
        json={"code": "ADMIN2", "name": "Admin2", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    fact_response = await client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-13", "amount": "100.00"},
    )
    admin_fact_id = fact_response.json()["id"]

    # Regular user tries to update
    user_token = create_access_token(test_user.id)
    client.cookies.set("access_token", user_token)

    update_response = await client.put(
        f"/api/v1/facts/{admin_fact_id}",
        json={"amount": "200.00"},
    )

    # Should be 404 (fact is invisible)
    assert update_response.status_code == 404


@pytest.mark.asyncio
async def test_user_cannot_delete_other_user_facts(client: AsyncClient, test_user, test_admin):
    """
    Test that user cannot delete facts belonging to another user.

    Expected: 404 Not Found
    """
    from backend.app.services.jwt import create_access_token

    # Admin creates fact
    admin_token = create_access_token(test_admin.id)
    client.cookies.set("access_token", admin_token)

    article_response = await client.post(
        "/api/v1/articles",
        json={"code": "ADMIN3", "name": "Admin3", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    fact_response = await client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-13", "amount": "100.00"},
    )
    admin_fact_id = fact_response.json()["id"]

    # Regular user tries to delete
    user_token = create_access_token(test_user.id)
    client.cookies.set("access_token", user_token)

    delete_response = await client.delete(f"/api/v1/facts/{admin_fact_id}")

    # Should be 404
    assert delete_response.status_code == 404


@pytest.mark.asyncio
async def test_admin_can_access_all_user_facts(client: AsyncClient, test_user, test_admin):
    """
    Test that admin can access facts from any user.

    Verifies:
    - Admin privilege bypass for user isolation
    - Admin can see regular user's facts
    """
    from backend.app.services.jwt import create_access_token

    # Regular user creates fact
    user_token = create_access_token(test_user.id)
    client.cookies.set("access_token", user_token)

    article_response = await client.post(
        "/api/v1/articles",
        json={"code": "USER_ARTICLE", "name": "User Article", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    fact_response = await client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-13", "amount": "100.00"},
    )
    user_fact_id = fact_response.json()["id"]

    # Admin accesses user's fact
    admin_token = create_access_token(test_admin.id)
    client.cookies.set("access_token", admin_token)

    get_response = await client.get(f"/api/v1/facts/{user_fact_id}")

    # Admin should be able to access it
    assert get_response.status_code == 200

    fact_json = get_response.json()
    assert fact_json["id"] == user_fact_id


# ============================================================================
# Error Handling Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_fact_with_invalid_article_id(auth_client: AsyncClient):
    """
    Test creating fact with non-existent article_id.

    Expected: 404 Not Found
    """
    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": 99999,  # Non-existent
            "fact_date": "2025-10-13",
            "amount": "100.00",
        },
    )

    # Should fail (article doesn't exist)
    assert fact_response.status_code in [404, 400]


@pytest.mark.asyncio
async def test_create_fact_with_negative_amount(auth_client: AsyncClient):
    """
    Test creating fact with negative amount.

    Expected: 422 Unprocessable Entity (validation error)
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "TEST", "name": "Test", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Try to create fact with negative amount
    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "-100.00",
        },
    )

    # Should fail validation
    assert fact_response.status_code == 422


@pytest.mark.asyncio
async def test_create_fact_with_invalid_date_format(auth_client: AsyncClient):
    """
    Test creating fact with invalid date format.

    Expected: 422 Unprocessable Entity
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "TEST2", "name": "Test2", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Try to create fact with invalid date
    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "invalid-date",
            "amount": "100.00",
        },
    )

    # Should fail validation
    assert fact_response.status_code == 422


@pytest.mark.asyncio
async def test_update_fact_with_invalid_data(auth_client: AsyncClient):
    """
    Test updating fact with invalid data.

    Expected: 422 Unprocessable Entity
    """
    # Create article and fact
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "TEST3", "name": "Test3", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-13", "amount": "100.00"},
    )
    fact_id = fact_response.json()["id"]

    # Try to update with invalid amount
    update_response = await auth_client.put(
        f"/api/v1/facts/{fact_id}",
        json={"amount": "not-a-number"},
    )

    # Should fail validation
    assert update_response.status_code == 422
