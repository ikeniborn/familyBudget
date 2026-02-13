"""
Integration tests for admin endpoints.

Tests complete end-to-end admin functionality:
1. Users management (list, view, update, statistics)
2. Articles management (list, create, update, delete)
3. Facts management (list, count, update, delete, batch delete)
4. Permission enforcement (admin-only access)
5. SCD Type 2 behavior for users and articles
6. Error handling (404, 400, 403)

These tests verify the entire admin stack works correctly.
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
# Users Management Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_all_users_as_admin(admin_client: AsyncClient, test_user: User, test_admin: User):
    """
    Test GET /admin/users - admin can see all users.

    Flow:
    1. Admin requests all users
    2. Verify response contains both test_user and test_admin
    3. Verify all user fields present
    """
    response = await admin_client.get("/api/v1/admin/users")

    assert response.status_code == 200

    users = response.json()
    assert len(users) >= 2

    # Find test_user and test_admin in response
    user_ids = [u["id"] for u in users]
    assert test_user.id in user_ids
    assert test_admin.id in user_ids

    # Verify user structure
    test_user_data = [u for u in users if u["id"] == test_user.id][0]
    assert test_user_data["telegram_id"] == test_user.telegram_id
    assert test_user_data["username"] == test_user.username
    assert test_user_data["is_admin"] == test_user.is_admin
    assert test_user_data["is_current"]


@pytest.mark.asyncio
async def test_get_all_users_filter_by_current(admin_client: AsyncClient, session: AsyncSession, test_admin: User):
    """
    Test GET /admin/users with is_current filter.

    Flow:
    1. Create user with two versions (old + current)
    2. Request with is_current=True
    3. Verify only current version returned
    4. Request with is_current=False
    5. Verify both versions returned
    """
    # Create user with old version
    old_user = User(
        telegram_id=111222333,
        username="olduser",
        first_name="Old",
        is_admin=False,
        is_current=False,
        valid_from=datetime(2024, 1, 1),
        valid_to=datetime(2025, 1, 1),
    )
    session.add(old_user)

    # Create current version
    current_user = User(
        telegram_id=111222333,
        username="currentuser",
        first_name="Current",
        is_admin=False,
        is_current=True,
        valid_from=datetime(2025, 1, 1),
        valid_to=None,
    )
    session.add(current_user)
    await session.commit()

    # Test with is_current=True (default)
    response_current = await admin_client.get("/api/v1/admin/users?is_current=true")
    assert response_current.status_code == 200
    users_current = response_current.json()

    # Should only see current version
    user_versions = [u for u in users_current if u["telegram_id"] == 111222333]
    assert len(user_versions) == 1
    assert user_versions[0]["username"] == "currentuser"

    # Test with is_current=False
    response_all = await admin_client.get("/api/v1/admin/users?is_current=false")
    assert response_all.status_code == 200
    users_all = response_all.json()

    # Should see both versions
    user_versions_all = [u for u in users_all if u["telegram_id"] == 111222333]
    assert len(user_versions_all) == 2


@pytest.mark.asyncio
async def test_get_user_by_id_as_admin(admin_client: AsyncClient, test_user: User):
    """
    Test GET /admin/users/{user_id} - admin can view specific user.

    Flow:
    1. Admin requests specific user by ID
    2. Verify correct user returned with all fields
    """
    response = await admin_client.get(f"/api/v1/admin/users/{test_user.id}")

    assert response.status_code == 200

    user_data = response.json()
    assert user_data["id"] == test_user.id
    assert user_data["telegram_id"] == test_user.telegram_id
    assert user_data["username"] == test_user.username
    assert user_data["first_name"] == test_user.first_name
    assert user_data["is_admin"] == test_user.is_admin


@pytest.mark.asyncio
async def test_get_user_by_id_not_found(admin_client: AsyncClient):
    """
    Test GET /admin/users/{user_id} with non-existent ID.

    Flow:
    1. Admin requests non-existent user
    2. Verify 404 Not Found
    """
    response = await admin_client.get("/api/v1/admin/users/999999")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_user_grant_admin(admin_client: AsyncClient, session: AsyncSession, test_user: User):
    """
    Test PUT /admin/users/{user_id} - grant admin privileges.

    Flow:
    1. Admin updates user to grant admin privileges
    2. Verify SCD Type 2: old version closed, new version created
    3. Verify new version has is_admin=True
    """
    response = await admin_client.put(
        f"/api/v1/admin/users/{test_user.id}",
        json={"is_admin": True}
    )

    assert response.status_code == 200

    updated_user = response.json()
    assert updated_user["is_admin"]
    assert updated_user["is_current"]
    assert updated_user["telegram_id"] == test_user.telegram_id

    # Verify SCD Type 2: two versions exist
    query = select(User).where(User.telegram_id == test_user.telegram_id)
    result = await session.execute(query)
    user_versions = result.scalars().all()

    assert len(user_versions) == 2

    # Old version: is_admin=False, is_current=False
    old_version = [u for u in user_versions if not u.is_current][0]
    assert not old_version.is_admin
    assert not old_version.is_current
    assert old_version.valid_to is not None

    # New version: is_admin=True, is_current=True
    new_version = [u for u in user_versions if u.is_current][0]
    assert new_version.is_admin
    assert new_version.is_current
    assert new_version.valid_to is None


@pytest.mark.asyncio
async def test_update_user_revoke_admin_last_admin_fails(admin_client: AsyncClient, test_admin: User):
    """
    Test PUT /admin/users/{user_id} - cannot revoke last admin.

    Flow:
    1. Admin tries to revoke their own admin privileges (last admin)
    2. Verify 400 Bad Request
    """
    response = await admin_client.put(
        f"/api/v1/admin/users/{test_admin.id}",
        json={"is_admin": False}
    )

    assert response.status_code == 400
    assert "last admin" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_users_stats_summary(admin_client: AsyncClient, session: AsyncSession, test_user: User, test_article_root: Article):
    """
    Test GET /admin/users/stats/summary - statistics for all users.

    Flow:
    1. Create facts and articles for test_user
    2. Admin requests user statistics
    3. Verify correct counts returned
    """
    # Create additional article
    article2 = Article(
        user_id=test_user.id,
        parent_id=None,
        name="Transport",
        type="expense",
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(article2)

    # Create facts
    fact1 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
        description="Fact 1",
    )
    fact2 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 14),
        amount=Decimal("200.00"),
        description="Fact 2",
    )
    session.add(fact1)
    session.add(fact2)
    await session.commit()

    # Get stats
    response = await admin_client.get("/api/v1/admin/users/stats/summary")

    assert response.status_code == 200

    stats = response.json()
    assert len(stats) >= 1

    # Find test_user stats
    user_stats = [s for s in stats if s["user_id"] == test_user.id][0]
    assert user_stats["total_facts"] == 2
    assert user_stats["total_articles"] >= 2  # test_article_root + article2
    assert user_stats["last_fact_date"] == "2025-10-14"


@pytest.mark.asyncio
async def test_admin_users_endpoints_forbidden_for_regular_user(auth_client: AsyncClient, test_user: User):
    """
    Test that regular users cannot access admin users endpoints.

    Flow:
    1. Regular user tries to access admin endpoints
    2. Verify 403 Forbidden
    """
    # Try to list all users
    response1 = await auth_client.get("/api/v1/admin/users")
    assert response1.status_code == 403

    # Try to view specific user
    response2 = await auth_client.get(f"/api/v1/admin/users/{test_user.id}")
    assert response2.status_code == 403

    # Try to update user
    response3 = await auth_client.put(
        f"/api/v1/admin/users/{test_user.id}",
        json={"is_admin": True}
    )
    assert response3.status_code == 403

    # Try to get stats
    response4 = await auth_client.get("/api/v1/admin/users/stats/summary")
    assert response4.status_code == 403


# ============================================================================
# Articles Management Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_all_articles_as_admin(admin_client: AsyncClient, test_article_root: Article, test_global_article: Article):
    """
    Test GET /admin/articles - admin can see all articles.

    Flow:
    1. Admin requests all articles
    2. Verify response contains user-specific and global articles
    """
    response = await admin_client.get("/api/v1/admin/articles")

    assert response.status_code == 200

    articles = response.json()
    assert len(articles) >= 2

    # Find articles in response
    article_ids = [a["id"] for a in articles]
    assert test_article_root.id in article_ids
    assert test_global_article.id in article_ids


@pytest.mark.asyncio
async def test_get_all_articles_filter_by_type(admin_client: AsyncClient, test_article_root: Article, test_global_article: Article):
    """
    Test GET /admin/articles with type filter.

    Flow:
    1. Request with type=income
    2. Verify only income articles returned
    3. Request with type=expense
    4. Verify only expense articles returned
    """
    # Test income articles
    response_income = await admin_client.get("/api/v1/admin/articles?type=income")
    assert response_income.status_code == 200
    income_articles = response_income.json()

    assert all(a["type"] == "income" for a in income_articles)
    assert test_global_article.id in [a["id"] for a in income_articles]

    # Test expense articles
    response_expense = await admin_client.get("/api/v1/admin/articles?type=expense")
    assert response_expense.status_code == 200
    expense_articles = response_expense.json()

    assert all(a["type"] == "expense" for a in expense_articles)
    assert test_article_root.id in [a["id"] for a in expense_articles]


@pytest.mark.asyncio
async def test_create_article_as_admin(admin_client: AsyncClient, session: AsyncSession, test_admin: User):
    """
    Test POST /admin/articles - admin can create new shared article.

    Flow:
    1. Admin creates new article (shared reference)
    2. Verify article created with correct data
    3. Verify article exists in database
    """
    response = await admin_client.post(
        "/api/v1/admin/articles",
        json={
            "name": "Healthcare",
            "type": "expense",
            "parent_id": None
        }
    )

    assert response.status_code == 200

    article_data = response.json()
    assert article_data["name"] == "Healthcare"
    assert article_data["type"] == "expense"
    assert article_data["is_current"]

    # Verify in database
    query = select(Article).where(Article.id == article_data["id"])
    result = await session.execute(query)
    article = result.scalar_one()

    assert article.name == "Healthcare"


@pytest.mark.asyncio
async def test_create_article_with_parent(admin_client: AsyncClient, test_article_root: Article):
    """
    Test POST /admin/articles - create article with parent.

    Flow:
    1. Admin creates child article with parent_id
    2. Verify parent and child have same type
    """
    response = await admin_client.post(
        "/api/v1/admin/articles",
        json={
            "name": "Groceries",
            "type": "expense",
            "parent_id": test_article_root.id
        }
    )

    assert response.status_code == 200

    article_data = response.json()
    assert article_data["parent_id"] == test_article_root.id
    assert article_data["type"] == test_article_root.type


@pytest.mark.asyncio
async def test_create_article_parent_type_mismatch(admin_client: AsyncClient, test_article_root: Article):
    """
    Test POST /admin/articles - parent type mismatch fails.

    Flow:
    1. Admin tries to create income article with expense parent
    2. Verify 400 Bad Request
    """
    response = await admin_client.post(
        "/api/v1/admin/articles",
        json={
            "name": "Salary",
            "type": "income",  # Mismatch: parent is expense
            "parent_id": test_article_root.id
        }
    )

    assert response.status_code == 400
    assert "must match" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_article_as_admin(admin_client: AsyncClient, session: AsyncSession, test_article_root: Article):
    """
    Test PUT /admin/articles/{article_id} - admin can update article.

    Flow:
    1. Admin updates article name
    2. Verify SCD Type 2: old version closed, new version created
    """
    response = await admin_client.put(
        f"/api/v1/admin/articles/{test_article_root.id}",
        json={"name": "Food & Beverages"}
    )

    assert response.status_code == 200

    updated_article = response.json()
    assert updated_article["name"] == "Food & Beverages"
    assert updated_article["is_current"]

    # Verify SCD Type 2: two versions exist
    query = select(Article).where(Article.code == test_article_root.code)
    result = await session.execute(query)
    article_versions = result.scalars().all()

    assert len(article_versions) == 2

    # Old version: closed
    old_version = [a for a in article_versions if not a.is_current][0]
    assert old_version.name == test_article_root.name
    assert not old_version.is_current

    # New version: updated name
    new_version = [a for a in article_versions if a.is_current][0]
    assert new_version.name == "Food & Beverages"
    assert new_version.is_current


@pytest.mark.asyncio
async def test_delete_article_as_admin(admin_client: AsyncClient, session: AsyncSession, test_article_root: Article):
    """
    Test DELETE /admin/articles/{article_id} - admin can deactivate article.

    Flow:
    1. Admin deactivates article (soft delete)
    2. Verify article marked as not current
    3. Verify physical record still exists
    """
    response = await admin_client.delete(f"/api/v1/admin/articles/{test_article_root.id}")

    assert response.status_code == 200
    assert "deactivated" in response.json()["message"].lower()

    # Verify soft delete
    query = select(Article).where(Article.id == test_article_root.id)
    result = await session.execute(query)
    article = result.scalar_one()

    assert not article.is_current
    assert article.valid_to is not None


@pytest.mark.asyncio
async def test_delete_article_with_children_fails(admin_client: AsyncClient, test_article_root: Article, test_article_child: Article):
    """
    Test DELETE /admin/articles/{article_id} - cannot delete article with children.

    Flow:
    1. Admin tries to delete article with active children
    2. Verify 400 Bad Request
    """
    response = await admin_client.delete(f"/api/v1/admin/articles/{test_article_root.id}")

    assert response.status_code == 400
    assert "children" in response.json()["detail"].lower()


# ============================================================================
# Facts Management Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_all_facts_as_admin(admin_client: AsyncClient, session: AsyncSession, test_user: User, test_article_root: Article):
    """
    Test GET /admin/facts - admin can see all facts.

    Flow:
    1. Create multiple facts
    2. Admin requests all facts
    3. Verify pagination and response structure
    """
    # Create facts
    facts = [
        BudgetFact(
            user_id=test_user.id,
            article_id=test_article_root.id,
            fact_date=date(2025, 10, i),
            amount=Decimal(str(100.00 * i)),
            description=f"Fact {i}",
        )
        for i in range(1, 6)
    ]
    for fact in facts:
        session.add(fact)
    await session.commit()

    # Get facts with pagination
    response = await admin_client.get("/api/v1/admin/facts?limit=3&offset=0")

    assert response.status_code == 200

    facts_data = response.json()
    assert len(facts_data) == 3

    # Verify structure
    fact_item = facts_data[0]
    assert "id" in fact_item
    assert "user_id" in fact_item
    assert "article_id" in fact_item
    assert "amount" in fact_item
    assert "fact_date" in fact_item
    assert "user_name" in fact_item
    assert "article_name" in fact_item


@pytest.mark.asyncio
async def test_get_facts_with_filters(admin_client: AsyncClient, session: AsyncSession, test_user: User, test_article_root: Article):
    """
    Test GET /admin/facts with various filters.

    Flow:
    1. Create facts with different dates and users
    2. Test user_id filter
    3. Test date_from and date_to filters
    """
    # Create facts
    fact1 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 1),
        amount=Decimal("100.00"),
    )
    fact2 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 15),
        amount=Decimal("200.00"),
    )
    session.add(fact1)
    session.add(fact2)
    await session.commit()

    # Test user_id filter
    response_user = await admin_client.get(f"/api/v1/admin/facts?user_id={test_user.id}")
    assert response_user.status_code == 200
    user_facts = response_user.json()
    assert all(f["user_id"] == test_user.id for f in user_facts)

    # Test date range filter
    response_date = await admin_client.get("/api/v1/admin/facts?date_from=2025-10-01&date_to=2025-10-10")
    assert response_date.status_code == 200
    date_facts = response_date.json()

    # Should only include fact1
    fact_dates = [f["fact_date"] for f in date_facts if f["user_id"] == test_user.id]
    assert "2025-10-01" in fact_dates
    assert "2025-10-15" not in fact_dates


@pytest.mark.asyncio
async def test_get_facts_count(admin_client: AsyncClient, session: AsyncSession, test_user: User, test_article_root: Article):
    """
    Test GET /admin/facts/count - get total count.

    Flow:
    1. Create multiple facts
    2. Request total count
    3. Verify count matches
    """
    # Create 10 facts
    for i in range(10):
        fact = BudgetFact(
            user_id=test_user.id,
            article_id=test_article_root.id,
            fact_date=date(2025, 10, i + 1),
            amount=Decimal("100.00"),
        )
        session.add(fact)
    await session.commit()

    response = await admin_client.get("/api/v1/admin/facts/count")

    assert response.status_code == 200

    count_data = response.json()
    assert count_data["total"] >= 10


@pytest.mark.asyncio
async def test_update_fact_as_admin(admin_client: AsyncClient, session: AsyncSession, test_fact: BudgetFact):
    """
    Test PUT /admin/facts/{fact_id} - admin can update any fact.

    Flow:
    1. Admin updates fact amount and description
    2. Verify changes persisted
    """
    response = await admin_client.put(
        f"/api/v1/admin/facts/{test_fact.id}",
        json={
            "amount": 75.50,
            "description": "Updated description"
        }
    )

    assert response.status_code == 200

    updated_fact = response.json()
    assert updated_fact["amount"] == 75.50
    assert updated_fact["description"] == "Updated description"

    # Verify in database
    query = select(BudgetFact).where(BudgetFact.id == test_fact.id)
    result = await session.execute(query)
    fact = result.scalar_one()

    assert float(fact.amount) == 75.50
    assert fact.description == "Updated description"


@pytest.mark.asyncio
async def test_delete_fact_as_admin(admin_client: AsyncClient, session: AsyncSession, test_fact: BudgetFact):
    """
    Test DELETE /admin/facts/{fact_id} - admin can delete any fact.

    Flow:
    1. Admin deletes fact (physical delete)
    2. Verify fact removed from database
    """
    fact_id = test_fact.id

    response = await admin_client.delete(f"/api/v1/admin/facts/{fact_id}")

    assert response.status_code == 200
    assert "deleted" in response.json()["message"].lower()

    # Verify physical delete
    query = select(BudgetFact).where(BudgetFact.id == fact_id)
    result = await session.execute(query)
    fact = result.scalar_one_or_none()

    assert fact is None


@pytest.mark.asyncio
async def test_batch_delete_facts(admin_client: AsyncClient, session: AsyncSession, test_user: User, test_article_root: Article):
    """
    Test POST /admin/facts/batch-delete - admin can delete multiple facts.

    Flow:
    1. Create multiple facts
    2. Admin batch deletes facts
    3. Verify all deleted
    """
    # Create 5 facts
    fact_ids = []
    for i in range(5):
        fact = BudgetFact(
            user_id=test_user.id,
            article_id=test_article_root.id,
            fact_date=date(2025, 10, i + 1),
            amount=Decimal("100.00"),
        )
        session.add(fact)
        await session.flush()
        fact_ids.append(fact.id)
    await session.commit()

    # Batch delete 3 facts
    delete_ids = fact_ids[:3]
    response = await admin_client.post(
        "/api/v1/admin/facts/batch-delete",
        json=delete_ids
    )

    assert response.status_code == 200

    result_data = response.json()
    assert result_data["deleted_count"] == 3

    # Verify deletion
    for fact_id in delete_ids:
        query = select(BudgetFact).where(BudgetFact.id == fact_id)
        result = await session.execute(query)
        fact = result.scalar_one_or_none()
        assert fact is None


@pytest.mark.asyncio
async def test_batch_delete_empty_list_fails(admin_client: AsyncClient):
    """
    Test POST /admin/facts/batch-delete with empty list.

    Flow:
    1. Admin sends empty fact_ids list
    2. Verify 400 Bad Request
    """
    response = await admin_client.post(
        "/api/v1/admin/facts/batch-delete",
        json=[]
    )

    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_batch_delete_too_many_facts_fails(admin_client: AsyncClient):
    """
    Test POST /admin/facts/batch-delete with too many IDs.

    Flow:
    1. Admin sends more than 500 fact_ids
    2. Verify 400 Bad Request
    """
    large_list = list(range(1, 502))  # 501 items

    response = await admin_client.post(
        "/api/v1/admin/facts/batch-delete",
        json=large_list
    )

    assert response.status_code == 400
    assert "500" in response.json()["detail"]


# ============================================================================
# Permission Enforcement Tests
# ============================================================================


@pytest.mark.asyncio
async def test_admin_articles_endpoints_forbidden_for_regular_user(auth_client: AsyncClient, test_article_root: Article):
    """
    Test that regular users cannot access admin articles endpoints.

    Flow:
    1. Regular user tries to access admin articles endpoints
    2. Verify 403 Forbidden
    """
    # Try to list articles
    response1 = await auth_client.get("/api/v1/admin/articles")
    assert response1.status_code == 403

    # Try to create article
    response2 = await auth_client.post(
        "/api/v1/admin/articles",
        json={"name": "Test", "type": "expense"}
    )
    assert response2.status_code == 403

    # Try to update article
    response3 = await auth_client.put(
        f"/api/v1/admin/articles/{test_article_root.id}",
        json={"name": "Updated"}
    )
    assert response3.status_code == 403

    # Try to delete article
    response4 = await auth_client.delete(f"/api/v1/admin/articles/{test_article_root.id}")
    assert response4.status_code == 403


@pytest.mark.asyncio
async def test_admin_facts_endpoints_forbidden_for_regular_user(auth_client: AsyncClient, test_fact: BudgetFact):
    """
    Test that regular users cannot access admin facts endpoints.

    Flow:
    1. Regular user tries to access admin facts endpoints
    2. Verify 403 Forbidden
    """
    # Try to list all facts
    response1 = await auth_client.get("/api/v1/admin/facts")
    assert response1.status_code == 403

    # Try to get count
    response2 = await auth_client.get("/api/v1/admin/facts/count")
    assert response2.status_code == 403

    # Try to update fact
    response3 = await auth_client.put(
        f"/api/v1/admin/facts/{test_fact.id}",
        json={"amount": 123.45}
    )
    assert response3.status_code == 403

    # Try to delete fact
    response4 = await auth_client.delete(f"/api/v1/admin/facts/{test_fact.id}")
    assert response4.status_code == 403

    # Try to batch delete
    response5 = await auth_client.post("/api/v1/admin/facts/batch-delete", json=[test_fact.id])
    assert response5.status_code == 403


@pytest.mark.asyncio
async def test_admin_endpoints_require_authentication(client: AsyncClient):
    """
    Test that admin endpoints require authentication.

    Flow:
    1. Unauthenticated user tries to access admin endpoints
    2. Verify 401 Unauthorized
    """
    # Users endpoints
    response1 = await client.get("/api/v1/admin/users")
    assert response1.status_code == 401

    # Articles endpoints
    response2 = await client.get("/api/v1/admin/articles")
    assert response2.status_code == 401

    # Facts endpoints
    response3 = await client.get("/api/v1/admin/facts")
    assert response3.status_code == 401


# ============================================================================
# Error Handling Tests
# ============================================================================


@pytest.mark.asyncio
async def test_update_fact_with_invalid_article(admin_client: AsyncClient, test_fact: BudgetFact):
    """
    Test PUT /admin/facts/{fact_id} with invalid article_id.

    Flow:
    1. Admin tries to update fact with non-existent article
    2. Verify 400 Bad Request
    """
    response = await admin_client.put(
        f"/api/v1/admin/facts/{test_fact.id}",
        json={"article_id": 999999}
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_fact_with_invalid_date_format(admin_client: AsyncClient, test_fact: BudgetFact):
    """
    Test PUT /admin/facts/{fact_id} with invalid date format.

    Flow:
    1. Admin tries to update fact with invalid date
    2. Verify 400 Bad Request
    """
    response = await admin_client.put(
        f"/api/v1/admin/facts/{test_fact.id}",
        json={"fact_date": "invalid-date"}
    )

    assert response.status_code == 400
    assert "format" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_article_with_invalid_parent(admin_client: AsyncClient):
    """
    Test POST /admin/articles with non-existent parent_id.

    Flow:
    1. Admin tries to create article with invalid parent
    2. Verify 400 Bad Request
    """
    response = await admin_client.post(
        "/api/v1/admin/articles",
        json={
            "name": "Test",
            "type": "expense",
            "parent_id": 999999
        }
    )

    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()
