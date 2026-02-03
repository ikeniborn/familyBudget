"""
Integration tests for multi-user data isolation.

Tests complete user isolation workflows:
1. Article isolation (users see only their articles)
2. Fact isolation (users see only their facts)
3. Hierarchy isolation (subtrees don't leak between users)
4. Summary isolation (aggregations per user)
5. Concurrent users (multiple users working simultaneously)
6. Cross-user access attempts (verify 404/403 responses)
7. Admin bypass (admin can see all data)

These tests verify multi-tenancy and data isolation work correctly end-to-end.
"""

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.services.jwt import create_access_token

# ============================================================================
# Article Isolation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_users_see_only_own_articles(
    client: AsyncClient, test_user, session: AsyncSession
):
    """
    Test that users can only see their own articles.

    Workflow:
    1. User A creates article
    2. User B creates article
    3. User A queries articles → sees only their own
    4. User B queries articles → sees only their own
    """
    # Create test user B
    from datetime import datetime

    from backend.app.models.user import User

    user_b = User(
        telegram_id=999888777,
        username="user_b",
        first_name="User",
        last_name="B",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31),
    )
    session.add(user_b)
    await session.commit()
    await session.refresh(user_b)

    # User A login and create article
    token_a = create_access_token(test_user.id)
    client.cookies.set("access_token", token_a)

    article_a_response = await client.post(
        "/api/v1/articles",
        json={"code": "USER_A", "name": "User A Article", "type": "expense", "parent_id": None},
    )
    assert article_a_response.status_code == 201
    article_a_id = article_a_response.json()["id"]

    # User B login and create article
    token_b = create_access_token(user_b.id)
    client.cookies.set("access_token", token_b)

    article_b_response = await client.post(
        "/api/v1/articles",
        json={"code": "USER_B", "name": "User B Article", "type": "expense", "parent_id": None},
    )
    assert article_b_response.status_code == 201
    article_b_id = article_b_response.json()["id"]

    # User A queries articles
    client.cookies.set("access_token", token_a)
    articles_a = await client.get("/api/v1/articles")
    articles_a_data = articles_a.json()
    article_a_ids = {a["id"] for a in articles_a_data["articles"]}

    # User A should see only their article
    assert article_a_id in article_a_ids
    assert article_b_id not in article_a_ids

    # User B queries articles
    client.cookies.set("access_token", token_b)
    articles_b = await client.get("/api/v1/articles")
    articles_b_data = articles_b.json()
    article_b_ids = {a["id"] for a in articles_b_data["articles"]}

    # User B should see only their article
    assert article_b_id in article_b_ids
    assert article_a_id not in article_b_ids


@pytest.mark.asyncio
async def test_user_cannot_access_other_user_article_by_id(
    client: AsyncClient, test_user, session: AsyncSession
):
    """
    Test that user cannot get another user's article by ID.

    Workflow:
    1. User A creates article
    2. User B tries to GET /api/v1/articles/{user_a_article_id}
    3. Verify 404 Not Found (article invisible to User B)
    """
    # Create User B
    from datetime import datetime

    from backend.app.models.user import User

    user_b = User(
        telegram_id=888777666,
        username="user_b_test",
        first_name="User",
        last_name="B",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31),
    )
    session.add(user_b)
    await session.commit()
    await session.refresh(user_b)

    # User A creates article
    token_a = create_access_token(test_user.id)
    client.cookies.set("access_token", token_a)

    article_response = await client.post(
        "/api/v1/articles",
        json={"code": "PRIVATE", "name": "Private Article", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # User B tries to access User A's article
    token_b = create_access_token(user_b.id)
    client.cookies.set("access_token", token_b)

    get_response = await client.get(f"/api/v1/articles/{article_id}")

    # Should be 404 (article invisible to User B)
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_user_cannot_update_other_user_article(
    client: AsyncClient, test_user, session: AsyncSession
):
    """
    Test that user cannot update another user's article.

    Expected: 404 Not Found
    """
    # Create User B
    from datetime import datetime

    from backend.app.models.user import User

    user_b = User(
        telegram_id=777666555,
        username="user_b_update",
        first_name="User",
        last_name="B",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31),
    )
    session.add(user_b)
    await session.commit()
    await session.refresh(user_b)

    # User A creates article
    token_a = create_access_token(test_user.id)
    client.cookies.set("access_token", token_a)

    article_response = await client.post(
        "/api/v1/articles",
        json={"code": "UPDATE_TEST", "name": "Update Test", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # User B tries to update User A's article
    token_b = create_access_token(user_b.id)
    client.cookies.set("access_token", token_b)

    update_response = await client.put(
        f"/api/v1/articles/{article_id}",
        json={"name": "Hacked!"},
    )

    # Should be 404
    assert update_response.status_code == 404


@pytest.mark.asyncio
async def test_user_cannot_delete_other_user_article(
    client: AsyncClient, test_user, session: AsyncSession
):
    """
    Test that user cannot delete another user's article.

    Expected: 404 Not Found
    """
    # Create User B
    from datetime import datetime

    from backend.app.models.user import User

    user_b = User(
        telegram_id=666555444,
        username="user_b_delete",
        first_name="User",
        last_name="B",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31),
    )
    session.add(user_b)
    await session.commit()
    await session.refresh(user_b)

    # User A creates article
    token_a = create_access_token(test_user.id)
    client.cookies.set("access_token", token_a)

    article_response = await client.post(
        "/api/v1/articles",
        json={"code": "DELETE_TEST", "name": "Delete Test", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # User B tries to delete User A's article
    token_b = create_access_token(user_b.id)
    client.cookies.set("access_token", token_b)

    delete_response = await client.delete(f"/api/v1/articles/{article_id}")

    # Should be 404
    assert delete_response.status_code == 404


# ============================================================================
# Fact Isolation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_users_see_only_own_facts(client: AsyncClient, test_user, session: AsyncSession):
    """
    Test that users can only see their own facts.

    Workflow:
    1. User A creates article and fact
    2. User B creates article and fact
    3. User A queries facts → sees only their own
    4. User B queries facts → sees only their own
    """
    # Create User B
    from datetime import datetime

    from backend.app.models.user import User

    user_b = User(
        telegram_id=555444333,
        username="user_b_facts",
        first_name="User",
        last_name="B",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31),
    )
    session.add(user_b)
    await session.commit()
    await session.refresh(user_b)

    # User A creates article and fact
    token_a = create_access_token(test_user.id)
    client.cookies.set("access_token", token_a)

    article_a = await client.post(
        "/api/v1/articles",
        json={"code": "FACT_A", "name": "Fact A", "type": "expense", "parent_id": None},
    )
    article_a_id = article_a.json()["id"]

    fact_a = await client.post(
        "/api/v1/facts",
        json={
            "article_id": article_a_id,
            "fact_date": "2025-10-13",
            "amount": "100.00",
        },
    )
    fact_a_id = fact_a.json()["id"]

    # User B creates article and fact
    token_b = create_access_token(user_b.id)
    client.cookies.set("access_token", token_b)

    article_b = await client.post(
        "/api/v1/articles",
        json={"code": "FACT_B", "name": "Fact B", "type": "expense", "parent_id": None},
    )
    article_b_id = article_b.json()["id"]

    fact_b = await client.post(
        "/api/v1/facts",
        json={
            "article_id": article_b_id,
            "fact_date": "2025-10-13",
            "amount": "200.00",
        },
    )
    fact_b_id = fact_b.json()["id"]

    # User A queries facts
    client.cookies.set("access_token", token_a)
    facts_a = await client.get("/api/v1/facts")
    facts_a_data = facts_a.json()
    fact_a_ids = {f["id"] for f in facts_a_data["facts"]}

    # User A should see only their fact
    assert fact_a_id in fact_a_ids
    assert fact_b_id not in fact_a_ids

    # User B queries facts
    client.cookies.set("access_token", token_b)
    facts_b = await client.get("/api/v1/facts")
    facts_b_data = facts_b.json()
    fact_b_ids = {f["id"] for f in facts_b_data["facts"]}

    # User B should see only their fact
    assert fact_b_id in fact_b_ids
    assert fact_a_id not in fact_b_ids


@pytest.mark.asyncio
async def test_user_cannot_access_other_user_fact_by_id(
    client: AsyncClient, test_user, session: AsyncSession
):
    """
    Test that user cannot get another user's fact by ID.

    Expected: 404 Not Found
    """
    # Create User B
    from datetime import datetime

    from backend.app.models.user import User

    user_b = User(
        telegram_id=444333222,
        username="user_b_fact_access",
        first_name="User",
        last_name="B",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31),
    )
    session.add(user_b)
    await session.commit()
    await session.refresh(user_b)

    # User A creates fact
    token_a = create_access_token(test_user.id)
    client.cookies.set("access_token", token_a)

    article = await client.post(
        "/api/v1/articles",
        json={"code": "PRIVATE_FACT", "name": "Private", "type": "expense", "parent_id": None},
    )
    article_id = article.json()["id"]

    fact = await client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-13", "amount": "150.00"},
    )
    fact_id = fact.json()["id"]

    # User B tries to access User A's fact
    token_b = create_access_token(user_b.id)
    client.cookies.set("access_token", token_b)

    get_response = await client.get(f"/api/v1/facts/{fact_id}")

    # Should be 404
    assert get_response.status_code == 404


# ============================================================================
# Hierarchy Isolation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_hierarchy_queries_isolated_per_user(
    client: AsyncClient, test_user, session: AsyncSession
):
    """
    Test that hierarchy queries (subtree, ancestors) are isolated per user.

    Workflow:
    1. User A creates hierarchy: Food → Groceries
    2. User B creates hierarchy: Food → Restaurants
    3. User A queries subtree of "Food" → sees only Groceries
    4. User B queries subtree of "Food" → sees only Restaurants
    """
    # Create User B
    from datetime import datetime

    from backend.app.models.user import User

    user_b = User(
        telegram_id=333222111,
        username="user_b_hierarchy",
        first_name="User",
        last_name="B",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31),
    )
    session.add(user_b)
    await session.commit()
    await session.refresh(user_b)

    # User A creates hierarchy
    token_a = create_access_token(test_user.id)
    client.cookies.set("access_token", token_a)

    food_a = await client.post(
        "/api/v1/articles",
        json={"code": "FOOD_A", "name": "Food A", "type": "expense", "parent_id": None},
    )
    food_a_id = food_a.json()["id"]

    await client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES_A",
            "name": "Groceries A",
            "type": "expense",
            "parent_id": food_a_id,
        },
    )

    # User B creates hierarchy
    token_b = create_access_token(user_b.id)
    client.cookies.set("access_token", token_b)

    food_b = await client.post(
        "/api/v1/articles",
        json={"code": "FOOD_B", "name": "Food B", "type": "expense", "parent_id": None},
    )
    food_b_id = food_b.json()["id"]

    await client.post(
        "/api/v1/articles",
        json={
            "code": "RESTAURANTS_B",
            "name": "Restaurants B",
            "type": "expense",
            "parent_id": food_b_id,
        },
    )

    # User A queries subtree
    client.cookies.set("access_token", token_a)
    subtree_a = await client.get(f"/api/v1/articles/{food_a_id}/subtree?include_self=true")
    subtree_a_data = subtree_a.json()
    codes_a = {a["code"] for a in subtree_a_data["articles"]}

    # User A should see only their hierarchy
    assert "FOOD_A" in codes_a
    assert "GROCERIES_A" in codes_a
    assert "FOOD_B" not in codes_a
    assert "RESTAURANTS_B" not in codes_a

    # User B queries subtree
    client.cookies.set("access_token", token_b)
    subtree_b = await client.get(f"/api/v1/articles/{food_b_id}/subtree?include_self=true")
    subtree_b_data = subtree_b.json()
    codes_b = {a["code"] for a in subtree_b_data["articles"]}

    # User B should see only their hierarchy
    assert "FOOD_B" in codes_b
    assert "RESTAURANTS_B" in codes_b
    assert "FOOD_A" not in codes_b
    assert "GROCERIES_A" not in codes_b


# ============================================================================
# Summary/Aggregation Isolation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_summary_isolated_per_user(client: AsyncClient, test_user, session: AsyncSession):
    """
    Test that summary aggregations are isolated per user.

    Workflow:
    1. User A creates fact (amount=1000)
    2. User B creates fact (amount=2000)
    3. User A gets summary → total=1000
    4. User B gets summary → total=2000
    """
    # Create User B
    from datetime import datetime

    from backend.app.models.user import User

    user_b = User(
        telegram_id=222111000,
        username="user_b_summary",
        first_name="User",
        last_name="B",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31),
    )
    session.add(user_b)
    await session.commit()
    await session.refresh(user_b)

    # User A creates fact
    token_a = create_access_token(test_user.id)
    client.cookies.set("access_token", token_a)

    article_a = await client.post(
        "/api/v1/articles",
        json={"code": "INCOME_A", "name": "Income A", "type": "income", "parent_id": None},
    )
    article_a_id = article_a.json()["id"]

    await client.post(
        "/api/v1/facts",
        json={"article_id": article_a_id, "fact_date": "2025-10-13", "amount": "1000.00"},
    )

    # User B creates fact
    token_b = create_access_token(user_b.id)
    client.cookies.set("access_token", token_b)

    article_b = await client.post(
        "/api/v1/articles",
        json={"code": "INCOME_B", "name": "Income B", "type": "income", "parent_id": None},
    )
    article_b_id = article_b.json()["id"]

    await client.post(
        "/api/v1/facts",
        json={"article_id": article_b_id, "fact_date": "2025-10-13", "amount": "2000.00"},
    )

    # User A gets summary
    client.cookies.set("access_token", token_a)
    summary_a = await client.get("/api/v1/facts/summary")
    summary_a_data = summary_a.json()

    # User A should see only their total
    total_income_a = Decimal(summary_a_data["total_income"])
    assert total_income_a == Decimal("1000.00")

    # User B gets summary
    client.cookies.set("access_token", token_b)
    summary_b = await client.get("/api/v1/facts/summary")
    summary_b_data = summary_b.json()

    # User B should see only their total
    total_income_b = Decimal(summary_b_data["total_income"])
    assert total_income_b == Decimal("2000.00")


# ============================================================================
# Admin Bypass Tests
# ============================================================================


@pytest.mark.asyncio
async def test_admin_can_see_all_users_articles(
    client: AsyncClient, test_user, test_admin, session: AsyncSession
):
    """
    Test that admin can see articles from all users.

    Workflow:
    1. Regular user creates article
    2. Admin queries all articles
    3. Verify admin sees regular user's article
    """
    # Regular user creates article
    token_user = create_access_token(test_user.id)
    client.cookies.set("access_token", token_user)

    article = await client.post(
        "/api/v1/articles",
        json={"code": "USER_ARTICLE", "name": "User Article", "type": "expense", "parent_id": None},
    )
    article_id = article.json()["id"]

    # Admin queries articles
    token_admin = create_access_token(test_admin.id)
    client.cookies.set("access_token", token_admin)

    articles = await client.get("/api/v1/articles")
    articles_data = articles.json()
    article_ids = {a["id"] for a in articles_data["articles"]}

    # Admin should see user's article
    assert article_id in article_ids


@pytest.mark.asyncio
async def test_admin_can_access_any_user_article_by_id(
    client: AsyncClient, test_user, test_admin
):
    """
    Test that admin can access any user's article by ID.

    Workflow:
    1. Regular user creates article
    2. Admin gets article by ID
    3. Verify success
    """
    # Regular user creates article
    token_user = create_access_token(test_user.id)
    client.cookies.set("access_token", token_user)

    article = await client.post(
        "/api/v1/articles",
        json={"code": "ADMIN_ACCESS", "name": "Admin Access", "type": "expense", "parent_id": None},
    )
    article_id = article.json()["id"]

    # Admin accesses article
    token_admin = create_access_token(test_admin.id)
    client.cookies.set("access_token", token_admin)

    get_response = await client.get(f"/api/v1/articles/{article_id}")

    # Admin should be able to access
    assert get_response.status_code == 200
    assert get_response.json()["id"] == article_id


@pytest.mark.asyncio
async def test_admin_can_update_any_user_article(client: AsyncClient, test_user, test_admin):
    """
    Test that admin can update any user's article.

    Workflow:
    1. Regular user creates article
    2. Admin updates article
    3. Verify success
    """
    # Regular user creates article
    token_user = create_access_token(test_user.id)
    client.cookies.set("access_token", token_user)

    article = await client.post(
        "/api/v1/articles",
        json={"code": "ADMIN_UPDATE", "name": "Original", "type": "expense", "parent_id": None},
    )
    article_id = article.json()["id"]

    # Admin updates article
    token_admin = create_access_token(test_admin.id)
    client.cookies.set("access_token", token_admin)

    update_response = await client.put(
        f"/api/v1/articles/{article_id}",
        json={"name": "Updated by Admin"},
    )

    # Admin should be able to update
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated by Admin"


@pytest.mark.asyncio
async def test_admin_can_see_all_users_facts(client: AsyncClient, test_user, test_admin):
    """
    Test that admin can see facts from all users.

    Workflow:
    1. Regular user creates fact
    2. Admin queries facts
    3. Verify admin sees regular user's fact
    """
    # Regular user creates fact
    token_user = create_access_token(test_user.id)
    client.cookies.set("access_token", token_user)

    article = await client.post(
        "/api/v1/articles",
        json={"code": "FACT_ADMIN", "name": "Fact Admin", "type": "expense", "parent_id": None},
    )
    article_id = article.json()["id"]

    fact = await client.post(
        "/api/v1/facts",
        json={"article_id": article_id, "fact_date": "2025-10-13", "amount": "500.00"},
    )
    fact_id = fact.json()["id"]

    # Admin queries facts
    token_admin = create_access_token(test_admin.id)
    client.cookies.set("access_token", token_admin)

    facts = await client.get("/api/v1/facts")
    facts_data = facts.json()
    fact_ids = {f["id"] for f in facts_data["facts"]}

    # Admin should see user's fact
    assert fact_id in fact_ids


# ============================================================================
# Concurrent Users Tests
# ============================================================================


@pytest.mark.asyncio
async def test_concurrent_users_creating_same_article_code(
    client: AsyncClient, test_user, session: AsyncSession
):
    """
    Test that different users can create articles with same code.

    Workflow:
    1. User A creates article with code "FOOD"
    2. User B creates article with code "FOOD"
    3. Both succeed (code uniqueness per user, not global)
    """
    # Create User B
    from datetime import datetime

    from backend.app.models.user import User

    user_b = User(
        telegram_id=111000999,
        username="user_b_concurrent",
        first_name="User",
        last_name="B",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31),
    )
    session.add(user_b)
    await session.commit()
    await session.refresh(user_b)

    # User A creates "FOOD"
    token_a = create_access_token(test_user.id)
    client.cookies.set("access_token", token_a)

    article_a = await client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food A", "type": "expense", "parent_id": None},
    )
    assert article_a.status_code == 201

    # User B creates "FOOD" (same code, different user)
    token_b = create_access_token(user_b.id)
    client.cookies.set("access_token", token_b)

    article_b = await client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food B", "type": "expense", "parent_id": None},
    )

    # Should succeed (code uniqueness per user)
    assert article_b.status_code == 201


@pytest.mark.asyncio
async def test_concurrent_users_working_simultaneously(
    client: AsyncClient, test_user, session: AsyncSession
):
    """
    Test multiple users working simultaneously without interference.

    Workflow:
    1. User A creates articles and facts
    2. User B creates articles and facts (simultaneously)
    3. Verify both users' data correct and isolated
    """
    # Create User B
    from datetime import datetime

    from backend.app.models.user import User

    user_b = User(
        telegram_id=999888000,
        username="user_b_simultaneous",
        first_name="User",
        last_name="B",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31),
    )
    session.add(user_b)
    await session.commit()
    await session.refresh(user_b)

    # User A workflow
    token_a = create_access_token(test_user.id)
    client.cookies.set("access_token", token_a)

    article_a = await client.post(
        "/api/v1/articles",
        json={"code": "SIMULTANEOUS_A", "name": "A", "type": "income", "parent_id": None},
    )
    article_a_id = article_a.json()["id"]

    fact_a = await client.post(
        "/api/v1/facts",
        json={"article_id": article_a_id, "fact_date": "2025-10-13", "amount": "1000.00"},
    )

    # User B workflow
    token_b = create_access_token(user_b.id)
    client.cookies.set("access_token", token_b)

    article_b = await client.post(
        "/api/v1/articles",
        json={"code": "SIMULTANEOUS_B", "name": "B", "type": "income", "parent_id": None},
    )
    article_b_id = article_b.json()["id"]

    fact_b = await client.post(
        "/api/v1/facts",
        json={"article_id": article_b_id, "fact_date": "2025-10-13", "amount": "2000.00"},
    )

    # Verify User A's summary
    client.cookies.set("access_token", token_a)
    summary_a = await client.get("/api/v1/facts/summary")
    assert Decimal(summary_a.json()["total_income"]) == Decimal("1000.00")

    # Verify User B's summary
    client.cookies.set("access_token", token_b)
    summary_b = await client.get("/api/v1/facts/summary")
    assert Decimal(summary_b.json()["total_income"]) == Decimal("2000.00")
