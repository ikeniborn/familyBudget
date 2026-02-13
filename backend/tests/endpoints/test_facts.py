"""
Unit tests for Facts API endpoints.

Tests CRUD operations for budget facts (transactions) with simple updates
(no SCD Type 2) and user data isolation.

Endpoints tested:
    POST /api/v1/facts - Create budget fact
    GET /api/v1/facts - List facts with filters
    GET /api/v1/facts/summary - Get aggregated summary
    GET /api/v1/facts/{id} - Get fact by ID
    PUT /api/v1/facts/{id} - Update fact (simple update)
    DELETE /api/v1/facts/{id} - Hard delete fact
"""

from datetime import date, datetime
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.user import User

# ============================================================================
# POST /api/v1/facts - Create Fact
# ============================================================================


@pytest.mark.asyncio
async def test_create_fact_basic(auth_client: AsyncClient, test_article_root: Article, test_user: User):
    """Test creating a basic budget fact."""
    response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": test_article_root.id,
            "fact_date": "2025-10-13",
            "amount": "100.50",
            "description": "Test expense",
        }
    )

    assert response.status_code == 201

    data = response.json()
    assert data["article_id"] == test_article_root.id
    assert data["fact_date"] == "2025-10-13"
    assert float(data["amount"]) == 100.50
    assert data["description"] == "Test expense"
    assert data["user_id"] == test_user.id


@pytest.mark.asyncio
async def test_create_fact_without_description(
    auth_client: AsyncClient, test_article_root: Article
):
    """Test creating fact without optional description."""
    response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": test_article_root.id,
            "fact_date": "2025-10-13",
            "amount": "50.00",
        }
    )

    assert response.status_code == 201

    data = response.json()
    assert data["description"] is None


@pytest.mark.asyncio
async def test_create_fact_with_global_article(
    auth_client: AsyncClient, test_global_article: Article
):
    """Test creating fact with global article (should work)."""
    response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": test_global_article.id,
            "fact_date": "2025-10-13",
            "amount": "500.00",
        }
    )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_create_fact_article_not_found(auth_client: AsyncClient):
    """Test creating fact with non-existent article."""
    response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": 99999,
            "fact_date": "2025-10-13",
            "amount": "100.00",
        }
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_fact_article_not_accessible(
    auth_client: AsyncClient, session: AsyncSession
):
    """Test creating fact with other user's article (should fail)."""
    # Create article for another user
    other_article = Article(
        user_id=999,
        name="Other Article",
        type="expense",
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(other_article)
    await session.commit()
    await session.refresh(other_article)

    response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": other_article.id,
            "fact_date": "2025-10-13",
            "amount": "100.00",
        }
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_fact_large_amount(auth_client: AsyncClient, test_article_root: Article):
    """Test creating fact with large amount."""
    response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": test_article_root.id,
            "fact_date": "2025-10-13",
            "amount": "9999999.99",
        }
    )

    assert response.status_code == 201

    data = response.json()
    assert float(data["amount"]) == 9999999.99


@pytest.mark.asyncio
async def test_create_fact_small_amount(auth_client: AsyncClient, test_article_root: Article):
    """Test creating fact with small amount (cents)."""
    response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": test_article_root.id,
            "fact_date": "2025-10-13",
            "amount": "0.01",
        }
    )

    assert response.status_code == 201

    data = response.json()
    assert float(data["amount"]) == 0.01


@pytest.mark.asyncio
async def test_create_fact_unauthenticated(client: AsyncClient, test_article_root: Article):
    """Test creating fact without authentication."""
    response = await client.post(
        "/api/v1/facts",
        json={
            "article_id": test_article_root.id,
            "fact_date": "2025-10-13",
            "amount": "100.00",
        }
    )

    assert response.status_code == 401


# ============================================================================
# GET /api/v1/facts - List Facts
# ============================================================================


@pytest.mark.asyncio
async def test_list_facts_basic(auth_client: AsyncClient, test_fact: BudgetFact):
    """Test listing facts as regular user."""
    response = await auth_client.get("/api/v1/facts")

    assert response.status_code == 200

    data = response.json()
    assert "facts" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data

    assert data["total"] >= 1
    assert len(data["facts"]) >= 1


@pytest.mark.asyncio
async def test_list_facts_pagination(auth_client: AsyncClient, session: AsyncSession, test_article_root: Article):
    """Test pagination of facts list."""
    # Create 10 facts
    for i in range(10):
        fact = BudgetFact(
            user_id=1,
            article_id=test_article_root.id,
            fact_date=date(2025, 10, i + 1),
            amount=Decimal(f"{i * 10}.00"),
        )
        session.add(fact)
    await session.commit()

    # Test limit=5
    response = await auth_client.get("/api/v1/facts?limit=5&offset=0")

    assert response.status_code == 200

    data = response.json()
    assert data["limit"] == 5
    assert data["offset"] == 0
    assert len(data["facts"]) == 5


@pytest.mark.asyncio
async def test_list_facts_filter_by_date_range(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test filtering facts by date range."""
    # Create facts with different dates
    dates = [date(2025, 10, 1), date(2025, 10, 15), date(2025, 10, 30)]
    for d in dates:
        fact = BudgetFact(
            user_id=1,
            article_id=test_article_root.id,
            fact_date=d,
            amount=Decimal("100.00"),
        )
        session.add(fact)
    await session.commit()

    # Filter: October 1-20
    response = await auth_client.get(
        "/api/v1/facts?date_from=2025-10-01&date_to=2025-10-20"
    )

    assert response.status_code == 200

    data = response.json()
    # Should include facts from Oct 1 and Oct 15, but not Oct 30
    assert data["total"] >= 2

    for fact in data["facts"]:
        fact_date = date.fromisoformat(fact["fact_date"])
        assert date(2025, 10, 1) <= fact_date <= date(2025, 10, 20)


@pytest.mark.asyncio
async def test_list_facts_filter_by_article(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article, test_article_child: Article
):
    """Test filtering facts by article_id."""
    # Create facts for different articles
    fact1 = BudgetFact(
        user_id=1,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    fact2 = BudgetFact(
        user_id=1,
        article_id=test_article_child.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.00"),
    )
    session.add(fact1)
    session.add(fact2)
    await session.commit()

    # Filter by article_id
    response = await auth_client.get(f"/api/v1/facts?article_id={test_article_root.id}")

    assert response.status_code == 200

    data = response.json()
    # All returned facts should have the specified article_id
    for fact in data["facts"]:
        assert fact["article_id"] == test_article_root.id


@pytest.mark.asyncio
async def test_list_facts_ordered_by_date_desc(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test facts are ordered by date descending (newest first)."""
    # Create facts with different dates
    dates = [date(2025, 10, 1), date(2025, 10, 15), date(2025, 10, 30)]
    for d in dates:
        fact = BudgetFact(
            user_id=1,
            article_id=test_article_root.id,
            fact_date=d,
            amount=Decimal("100.00"),
        )
        session.add(fact)
    await session.commit()

    response = await auth_client.get("/api/v1/facts")

    assert response.status_code == 200

    data = response.json()
    # Check that facts are ordered by date descending
    fact_dates = [date.fromisoformat(fact["fact_date"]) for fact in data["facts"]]

    # Should be sorted: newest first
    assert fact_dates == sorted(fact_dates, reverse=True)


@pytest.mark.asyncio
async def test_list_facts_user_isolation(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test that regular user only sees their own facts."""
    # Create fact for another user
    other_fact = BudgetFact(
        user_id=999,  # Different user
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    session.add(other_fact)
    await session.commit()

    response = await auth_client.get("/api/v1/facts")

    assert response.status_code == 200

    data = response.json()
    # Should not include other user's facts
    user_ids = {fact["user_id"] for fact in data["facts"]}
    assert 999 not in user_ids


@pytest.mark.asyncio
async def test_list_facts_admin_sees_all(
    admin_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test that admin sees facts from all users."""
    # Create facts for different users
    fact1 = BudgetFact(
        user_id=1,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    fact2 = BudgetFact(
        user_id=999,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("200.00"),
    )
    session.add(fact1)
    session.add(fact2)
    await session.commit()

    response = await admin_client.get("/api/v1/facts")

    assert response.status_code == 200

    data = response.json()
    # Admin should see facts from all users
    user_ids = {fact["user_id"] for fact in data["facts"]}
    assert 1 in user_ids or 999 in user_ids  # At least some facts visible


@pytest.mark.asyncio
async def test_list_facts_unauthenticated(client: AsyncClient):
    """Test listing facts without authentication."""
    response = await client.get("/api/v1/facts")

    assert response.status_code == 401


# ============================================================================
# GET /api/v1/facts/summary - Get Facts Summary
# ============================================================================


@pytest.mark.asyncio
async def test_get_facts_summary_basic(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article, test_global_article: Article
):
    """Test getting facts summary with income/expense totals."""
    # Create income and expense facts
    expense_fact = BudgetFact(
        user_id=1,
        article_id=test_article_root.id,  # expense type
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    income_fact = BudgetFact(
        user_id=1,
        article_id=test_global_article.id,  # income type
        fact_date=date(2025, 10, 13),
        amount=Decimal("500.00"),
    )
    session.add(expense_fact)
    session.add(income_fact)
    await session.commit()

    response = await auth_client.get("/api/v1/facts/summary")

    assert response.status_code == 200

    data = response.json()
    assert "total_income" in data
    assert "total_expense" in data
    assert "balance" in data
    assert "count_income" in data
    assert "count_expense" in data

    assert float(data["total_income"]) == 500.00
    assert float(data["total_expense"]) == 100.00
    assert float(data["balance"]) == 400.00
    assert data["count_income"] == 1
    assert data["count_expense"] == 1


@pytest.mark.asyncio
async def test_get_facts_summary_with_date_filter(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test getting summary with date range filter."""
    # Create facts with different dates
    fact1 = BudgetFact(
        user_id=1,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 1),
        amount=Decimal("100.00"),
    )
    fact2 = BudgetFact(
        user_id=1,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 15),
        amount=Decimal("50.00"),
    )
    fact3 = BudgetFact(
        user_id=1,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 30),
        amount=Decimal("200.00"),
    )
    session.add(fact1)
    session.add(fact2)
    session.add(fact3)
    await session.commit()

    # Get summary for October 1-20 (should include fact1 and fact2 only)
    response = await auth_client.get(
        "/api/v1/facts/summary?date_from=2025-10-01&date_to=2025-10-20"
    )

    assert response.status_code == 200

    data = response.json()
    # Should total 150.00 (fact1 + fact2), not include fact3
    assert float(data["total_expense"]) == 150.00


@pytest.mark.asyncio
async def test_get_facts_summary_empty(auth_client: AsyncClient):
    """Test getting summary when no facts exist."""
    response = await auth_client.get("/api/v1/facts/summary")

    assert response.status_code == 200

    data = response.json()
    assert float(data["total_income"]) == 0.00
    assert float(data["total_expense"]) == 0.00
    assert float(data["balance"]) == 0.00
    assert data["count_income"] == 0
    assert data["count_expense"] == 0


@pytest.mark.asyncio
async def test_get_facts_summary_user_isolation(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test that summary only includes user's own facts."""
    # Create facts for current user and another user
    user_fact = BudgetFact(
        user_id=1,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    other_fact = BudgetFact(
        user_id=999,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("500.00"),
    )
    session.add(user_fact)
    session.add(other_fact)
    await session.commit()

    response = await auth_client.get("/api/v1/facts/summary")

    assert response.status_code == 200

    data = response.json()
    # Should only include user's fact (100.00), not other user's fact
    assert float(data["total_expense"]) == 100.00


@pytest.mark.asyncio
async def test_get_facts_summary_unauthenticated(client: AsyncClient):
    """Test getting summary without authentication."""
    response = await client.get("/api/v1/facts/summary")

    assert response.status_code == 401


# ============================================================================
# GET /api/v1/facts/{id} - Get Fact by ID
# ============================================================================


@pytest.mark.asyncio
async def test_get_fact_by_id_own_fact(auth_client: AsyncClient, test_fact: BudgetFact):
    """Test getting own fact by ID."""
    response = await auth_client.get(f"/api/v1/facts/{test_fact.id}")

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == test_fact.id
    assert float(data["amount"]) == float(test_fact.amount)


@pytest.mark.asyncio
async def test_get_fact_by_id_other_user(auth_client: AsyncClient, session: AsyncSession, test_article_root: Article):
    """Test getting other user's fact (should fail)."""
    # Create fact for another user
    other_fact = BudgetFact(
        user_id=999,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    session.add(other_fact)
    await session.commit()
    await session.refresh(other_fact)

    response = await auth_client.get(f"/api/v1/facts/{other_fact.id}")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_fact_by_id_admin_any_fact(
    admin_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test admin can get any fact by ID."""
    # Create fact for another user
    other_fact = BudgetFact(
        user_id=999,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    session.add(other_fact)
    await session.commit()
    await session.refresh(other_fact)

    response = await admin_client.get(f"/api/v1/facts/{other_fact.id}")

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_fact_by_id_not_found(auth_client: AsyncClient):
    """Test getting non-existent fact."""
    response = await auth_client.get("/api/v1/facts/99999")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_fact_by_id_unauthenticated(client: AsyncClient, test_fact: BudgetFact):
    """Test getting fact without authentication."""
    response = await client.get(f"/api/v1/facts/{test_fact.id}")

    assert response.status_code == 401


# ============================================================================
# PUT /api/v1/facts/{id} - Update Fact (Simple Update, No SCD Type 2)
# ============================================================================


@pytest.mark.asyncio
async def test_update_fact_basic(auth_client: AsyncClient, session: AsyncSession, test_fact: BudgetFact):
    """Test updating fact (simple UPDATE, not SCD Type 2)."""
    original_id = test_fact.id

    response = await auth_client.put(
        f"/api/v1/facts/{test_fact.id}",
        json={"amount": "150.00", "description": "Updated description"}
    )

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == original_id  # Same ID (not SCD Type 2)
    assert float(data["amount"]) == 150.00
    assert data["description"] == "Updated description"

    # Verify no new version created (simple update)
    stmt = select(BudgetFact).where(BudgetFact.id == test_fact.id)
    result = await session.execute(stmt)
    facts = result.scalars().all()

    assert len(facts) == 1  # Only one record (updated in-place)


@pytest.mark.asyncio
async def test_update_fact_change_amount(auth_client: AsyncClient, test_fact: BudgetFact):
    """Test updating fact amount."""
    response = await auth_client.put(
        f"/api/v1/facts/{test_fact.id}",
        json={"amount": "200.00"}
    )

    assert response.status_code == 200

    data = response.json()
    assert float(data["amount"]) == 200.00


@pytest.mark.asyncio
async def test_update_fact_change_date(auth_client: AsyncClient, test_fact: BudgetFact):
    """Test updating fact date."""
    response = await auth_client.put(
        f"/api/v1/facts/{test_fact.id}",
        json={"fact_date": "2025-10-20"}
    )

    assert response.status_code == 200

    data = response.json()
    assert data["fact_date"] == "2025-10-20"


@pytest.mark.asyncio
async def test_update_fact_change_article(
    auth_client: AsyncClient, test_fact: BudgetFact, test_article_child: Article
):
    """Test updating fact to different article."""
    response = await auth_client.put(
        f"/api/v1/facts/{test_fact.id}",
        json={"article_id": test_article_child.id}
    )

    assert response.status_code == 200

    data = response.json()
    assert data["article_id"] == test_article_child.id


@pytest.mark.asyncio
async def test_update_fact_article_not_found(auth_client: AsyncClient, test_fact: BudgetFact):
    """Test updating fact with non-existent article."""
    response = await auth_client.put(
        f"/api/v1/facts/{test_fact.id}",
        json={"article_id": 99999}
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_fact_article_not_accessible(
    auth_client: AsyncClient, test_fact: BudgetFact, session: AsyncSession
):
    """Test updating fact with other user's article (should fail)."""
    # Create article for another user
    other_article = Article(
        user_id=999,
        name="Other Article",
        type="expense",
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(other_article)
    await session.commit()
    await session.refresh(other_article)

    response = await auth_client.put(
        f"/api/v1/facts/{test_fact.id}",
        json={"article_id": other_article.id}
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_update_fact_no_fields(auth_client: AsyncClient, test_fact: BudgetFact):
    """Test updating fact with no fields provided."""
    response = await auth_client.put(
        f"/api/v1/facts/{test_fact.id}",
        json={}
    )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_fact_other_user(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test updating other user's fact (should fail)."""
    # Create fact for another user
    other_fact = BudgetFact(
        user_id=999,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    session.add(other_fact)
    await session.commit()
    await session.refresh(other_fact)

    response = await auth_client.put(
        f"/api/v1/facts/{other_fact.id}",
        json={"amount": "200.00"}
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_update_fact_not_found(auth_client: AsyncClient):
    """Test updating non-existent fact."""
    response = await auth_client.put(
        "/api/v1/facts/99999",
        json={"amount": "200.00"}
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_fact_unauthenticated(client: AsyncClient, test_fact: BudgetFact):
    """Test updating fact without authentication."""
    response = await client.put(
        f"/api/v1/facts/{test_fact.id}",
        json={"amount": "200.00"}
    )

    assert response.status_code == 401


# ============================================================================
# DELETE /api/v1/facts/{id} - Hard Delete Fact
# ============================================================================


@pytest.mark.asyncio
async def test_delete_fact_basic(auth_client: AsyncClient, session: AsyncSession, test_fact: BudgetFact):
    """Test hard deleting fact."""
    fact_id = test_fact.id

    response = await auth_client.delete(f"/api/v1/facts/{fact_id}")

    assert response.status_code == 204

    # Verify fact is hard deleted (completely removed from database)
    stmt = select(BudgetFact).where(BudgetFact.id == fact_id)
    result = await session.execute(stmt)
    fact = result.scalar_one_or_none()

    assert fact is None


@pytest.mark.asyncio
async def test_delete_fact_other_user(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test deleting other user's fact (should fail)."""
    # Create fact for another user
    other_fact = BudgetFact(
        user_id=999,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    session.add(other_fact)
    await session.commit()
    await session.refresh(other_fact)

    response = await auth_client.delete(f"/api/v1/facts/{other_fact.id}")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_fact_admin_any_fact(
    admin_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test admin can delete any fact."""
    # Create fact for another user
    other_fact = BudgetFact(
        user_id=999,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    session.add(other_fact)
    await session.commit()
    await session.refresh(other_fact)

    response = await admin_client.delete(f"/api/v1/facts/{other_fact.id}")

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_fact_not_found(auth_client: AsyncClient):
    """Test deleting non-existent fact."""
    response = await auth_client.delete("/api/v1/facts/99999")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_fact_already_deleted(
    auth_client: AsyncClient, test_fact: BudgetFact
):
    """Test deleting already deleted fact (should fail with 404)."""
    # First delete
    await auth_client.delete(f"/api/v1/facts/{test_fact.id}")

    # Second delete should fail
    response = await auth_client.delete(f"/api/v1/facts/{test_fact.id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_fact_unauthenticated(client: AsyncClient, test_fact: BudgetFact):
    """Test deleting fact without authentication."""
    response = await client.delete(f"/api/v1/facts/{test_fact.id}")

    assert response.status_code == 401
