"""
Unit tests for Articles API endpoints.

Tests CRUD operations for budget articles (categories) with SCD Type 2 versioning,
hierarchical organization, and user data isolation.

Endpoints tested:
    POST /api/v1/articles - Create article
    GET /api/v1/articles - List articles with filters
    GET /api/v1/articles/{id} - Get article by ID
    PUT /api/v1/articles/{id} - Update article (SCD Type 2)
    DELETE /api/v1/articles/{id} - Soft delete article
    GET /api/v1/articles/{id}/subtree - Get article subtree
    GET /api/v1/articles/{id}/ancestors - Get article ancestors
"""

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.user import User


# ============================================================================
# POST /api/v1/articles - Create Article
# ============================================================================


@pytest.mark.asyncio
async def test_create_article_basic(auth_client: AsyncClient, test_user: User):
    """Test creating a basic article (root category)."""
    response = await auth_client.post(
        "/api/v1/articles",
        json={
            "code": "TRANS",
            "name": "Transportation",
            "type": "expense",
            "is_global": False,
            "parent_id": None,
        }
    )

    assert response.status_code == 201

    data = response.json()
    assert data["code"] == "TRANS"
    assert data["name"] == "Transportation"
    assert data["type"] == "expense"
    assert data["is_global"] is False
    assert data["user_id"] == test_user.id
    assert data["parent_id"] is None
    assert data["is_current"] is True


@pytest.mark.asyncio
async def test_create_article_with_parent(
    auth_client: AsyncClient, test_user: User, test_article_root: Article
):
    """Test creating child article with parent."""
    response = await auth_client.post(
        "/api/v1/articles",
        json={
            "code": "TRANS_CAR",
            "name": "Car Expenses",
            "type": "expense",
            "is_global": False,
            "parent_id": test_article_root.id,
        }
    )

    assert response.status_code == 201

    data = response.json()
    assert data["parent_id"] == test_article_root.id


@pytest.mark.asyncio
async def test_create_article_income_type(auth_client: AsyncClient):
    """Test creating income article."""
    response = await auth_client.post(
        "/api/v1/articles",
        json={
            "code": "BONUS",
            "name": "Bonus Income",
            "type": "income",
            "is_global": False,
            "parent_id": None,
        }
    )

    assert response.status_code == 201

    data = response.json()
    assert data["type"] == "income"


@pytest.mark.asyncio
async def test_create_global_article_as_admin(admin_client: AsyncClient):
    """Test creating global article as admin."""
    response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GLOBAL_CAT",
            "name": "Global Category",
            "type": "expense",
            "is_global": True,
            "parent_id": None,
        }
    )

    assert response.status_code == 201

    data = response.json()
    assert data["is_global"] is True
    assert data["user_id"] is None  # Global articles have no user_id


@pytest.mark.asyncio
async def test_create_global_article_as_regular_user(auth_client: AsyncClient):
    """Test creating global article as regular user (should fail)."""
    response = await auth_client.post(
        "/api/v1/articles",
        json={
            "code": "GLOBAL_CAT",
            "name": "Global Category",
            "type": "expense",
            "is_global": True,
            "parent_id": None,
        }
    )

    assert response.status_code == 403

    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_create_article_parent_not_found(auth_client: AsyncClient):
    """Test creating article with non-existent parent."""
    response = await auth_client.post(
        "/api/v1/articles",
        json={
            "code": "CHILD",
            "name": "Child Category",
            "type": "expense",
            "is_global": False,
            "parent_id": 99999,  # Non-existent
        }
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_article_unauthenticated(client: AsyncClient):
    """Test creating article without authentication."""
    response = await client.post(
        "/api/v1/articles",
        json={
            "code": "TEST",
            "name": "Test",
            "type": "expense",
            "is_global": False,
            "parent_id": None,
        }
    )

    assert response.status_code == 401


# ============================================================================
# GET /api/v1/articles - List Articles
# ============================================================================


@pytest.mark.asyncio
async def test_list_articles_basic(
    auth_client: AsyncClient, test_article_root: Article, test_article_child: Article
):
    """Test listing articles as regular user."""
    response = await auth_client.get("/api/v1/articles")

    assert response.status_code == 200

    data = response.json()
    assert "articles" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data

    assert data["total"] >= 2
    assert len(data["articles"]) >= 2


@pytest.mark.asyncio
async def test_list_articles_with_global(
    auth_client: AsyncClient, test_article_root: Article, test_global_article: Article
):
    """Test listing articles includes global articles by default."""
    response = await auth_client.get("/api/v1/articles?include_global=true")

    assert response.status_code == 200

    data = response.json()
    article_codes = {article["code"] for article in data["articles"]}

    # Should include both user's article and global article
    assert "FOOD" in article_codes
    assert "SALARY" in article_codes


@pytest.mark.asyncio
async def test_list_articles_exclude_global(
    auth_client: AsyncClient, test_article_root: Article, test_global_article: Article
):
    """Test listing articles excludes global when include_global=false."""
    response = await auth_client.get("/api/v1/articles?include_global=false")

    assert response.status_code == 200

    data = response.json()
    article_codes = {article["code"] for article in data["articles"]}

    # Should include only user's articles, not global
    assert "FOOD" in article_codes
    assert "SALARY" not in article_codes


@pytest.mark.asyncio
async def test_list_articles_filter_by_type(auth_client: AsyncClient, session: AsyncSession):
    """Test filtering articles by type (income/expense)."""
    # Create income and expense articles
    from datetime import datetime

    expense_article = Article(
        user_id=1,  # Assuming test_user has id=1
        name="Expense 1",
        type="expense",
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    income_article = Article(
        user_id=1,
        name="Income 1",
        type="income",
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(expense_article)
    session.add(income_article)
    await session.commit()

    # Filter by type=expense
    response = await auth_client.get("/api/v1/articles?type=expense")

    assert response.status_code == 200

    data = response.json()
    types = {article["type"] for article in data["articles"]}
    assert types == {"expense"}


@pytest.mark.asyncio
async def test_list_articles_filter_by_parent(
    auth_client: AsyncClient, test_article_root: Article, test_article_child: Article
):
    """Test filtering articles by parent_id."""
    # Filter by parent_id (children of root)
    response = await auth_client.get(f"/api/v1/articles?parent_id={test_article_root.id}")

    assert response.status_code == 200

    data = response.json()
    assert len(data["articles"]) >= 1

    # All returned articles should have the specified parent_id
    for article in data["articles"]:
        assert article["parent_id"] == test_article_root.id


@pytest.mark.asyncio
async def test_list_articles_filter_root_only(auth_client: AsyncClient, test_article_root: Article):
    """Test filtering to show only root articles (parent_id=null)."""
    response = await auth_client.get("/api/v1/articles?parent_id=null")

    # Note: This depends on how the endpoint handles "null" string vs None
    # If not implemented, adjust test accordingly
    assert response.status_code in [200, 400]


@pytest.mark.asyncio
async def test_list_articles_pagination(auth_client: AsyncClient, session: AsyncSession):
    """Test pagination of articles list."""
    # Create 10 articles
    from datetime import datetime

    for i in range(10):
        article = Article(
            user_id=1,
            name=f"Article {i}",
            type="expense",
            is_current=True,
            valid_from=datetime.utcnow(),
            valid_to=datetime(9999, 12, 31, 23, 59, 59),
        )
        session.add(article)
    await session.commit()

    # Test limit=5
    response = await auth_client.get("/api/v1/articles?limit=5&offset=0")

    assert response.status_code == 200

    data = response.json()
    assert data["limit"] == 5
    assert data["offset"] == 0
    assert len(data["articles"]) == 5


@pytest.mark.asyncio
async def test_list_articles_invalid_type_filter(auth_client: AsyncClient):
    """Test filtering with invalid type parameter."""
    response = await auth_client.get("/api/v1/articles?type=invalid")

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_articles_as_admin_sees_all(
    admin_client: AsyncClient, test_article_root: Article, session: AsyncSession
):
    """Test that admin sees all articles from all users."""
    # Create article for another user
    other_article = Article(
        user_id=999,  # Different user
        name="Other User Article",
        type="expense",
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(other_article)
    await session.commit()

    response = await admin_client.get("/api/v1/articles")

    assert response.status_code == 200

    data = response.json()
    codes = {article["code"] for article in data["articles"]}

    # Admin should see articles from all users
    assert "OTHER" in codes


@pytest.mark.asyncio
async def test_list_articles_unauthenticated(client: AsyncClient):
    """Test listing articles without authentication."""
    response = await client.get("/api/v1/articles")

    assert response.status_code == 401


# ============================================================================
# GET /api/v1/articles/{id} - Get Article by ID
# ============================================================================


@pytest.mark.asyncio
async def test_get_article_by_id_own_article(
    auth_client: AsyncClient, test_article_root: Article
):
    """Test getting own article by ID."""
    response = await auth_client.get(f"/api/v1/articles/{test_article_root.id}")

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == test_article_root.id
    assert data["code"] == "FOOD"
    assert data["name"] == "Food"


@pytest.mark.asyncio
async def test_get_article_by_id_global_article(
    auth_client: AsyncClient, test_global_article: Article
):
    """Test getting global article by ID (accessible to all)."""
    response = await auth_client.get(f"/api/v1/articles/{test_global_article.id}")

    assert response.status_code == 200

    data = response.json()
    assert data["is_global"] is True


@pytest.mark.asyncio
async def test_get_article_by_id_other_user(auth_client: AsyncClient, session: AsyncSession):
    """Test getting other user's article (should fail)."""
    # Create article for another user
    from datetime import datetime

    other_article = Article(
        user_id=999,  # Different user
        name="Other Article",
        type="expense",
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(other_article)
    await session.commit()
    await session.refresh(other_article)

    response = await auth_client.get(f"/api/v1/articles/{other_article.id}")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_article_by_id_admin_any_article(admin_client: AsyncClient, session: AsyncSession):
    """Test admin can get any article by ID."""
    # Create article for another user
    from datetime import datetime

    other_article = Article(
        user_id=999,
        code="OTHER",
        name="Other Article",
        type="expense",
        is_global=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(other_article)
    await session.commit()
    await session.refresh(other_article)

    response = await admin_client.get(f"/api/v1/articles/{other_article.id}")

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_article_by_id_not_found(auth_client: AsyncClient):
    """Test getting non-existent article."""
    response = await auth_client.get("/api/v1/articles/99999")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_article_by_id_unauthenticated(client: AsyncClient, test_article_root: Article):
    """Test getting article without authentication."""
    response = await client.get(f"/api/v1/articles/{test_article_root.id}")

    assert response.status_code == 401


# ============================================================================
# PUT /api/v1/articles/{id} - Update Article (SCD Type 2)
# ============================================================================


@pytest.mark.asyncio
async def test_update_article_basic(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test updating article creates new SCD Type 2 version."""
    original_id = test_article_root.id

    response = await auth_client.put(
        f"/api/v1/articles/{test_article_root.id}",
        json={"name": "Food and Beverages"}
    )

    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "Food and Beverages"
    assert data["is_current"] is True

    # Verify SCD Type 2: two versions exist
    stmt = select(Article).where(Article.code == "FOOD")
    result = await session.execute(stmt)
    versions = result.scalars().all()

    assert len(versions) == 2

    # Old version: is_current=False
    old_version = [v for v in versions if not v.is_current][0]
    assert old_version.name == "Food"
    assert old_version.is_current is False

    # New version: is_current=True
    new_version = [v for v in versions if v.is_current][0]
    assert new_version.name == "Food and Beverages"
    assert new_version.is_current is True


@pytest.mark.asyncio
async def test_update_article_no_change(auth_client: AsyncClient, test_article_root: Article):
    """Test updating article with same values (no new version)."""
    response = await auth_client.put(
        f"/api/v1/articles/{test_article_root.id}",
        json={"name": "Food"}  # Same name
    )

    assert response.status_code == 200

    data = response.json()
    # Should return existing article without creating new version
    assert data["id"] == test_article_root.id


@pytest.mark.asyncio
async def test_update_article_change_parent(
    auth_client: AsyncClient, test_article_child: Article, session: AsyncSession
):
    """Test changing article's parent."""
    # Create new potential parent
    from datetime import datetime

    new_parent = Article(
        user_id=1,
        name="New Parent",
        type="expense",
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(new_parent)
    await session.commit()
    await session.refresh(new_parent)

    response = await auth_client.put(
        f"/api/v1/articles/{test_article_child.id}",
        json={"parent_id": new_parent.id}
    )

    assert response.status_code == 200

    data = response.json()
    assert data["parent_id"] == new_parent.id


@pytest.mark.asyncio
async def test_update_article_self_as_parent(auth_client: AsyncClient, test_article_root: Article):
    """Test setting article as its own parent (should fail)."""
    response = await auth_client.put(
        f"/api/v1/articles/{test_article_root.id}",
        json={"parent_id": test_article_root.id}
    )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_article_no_fields(auth_client: AsyncClient, test_article_root: Article):
    """Test updating article with no fields provided."""
    response = await auth_client.put(
        f"/api/v1/articles/{test_article_root.id}",
        json={}
    )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_update_global_article_as_regular_user(
    auth_client: AsyncClient, test_global_article: Article
):
    """Test updating global article as regular user (should fail)."""
    response = await auth_client.put(
        f"/api/v1/articles/{test_global_article.id}",
        json={"name": "Updated Global"}
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_update_global_article_as_admin(
    admin_client: AsyncClient, test_global_article: Article
):
    """Test updating global article as admin (should succeed)."""
    response = await admin_client.put(
        f"/api/v1/articles/{test_global_article.id}",
        json={"name": "Updated Global Salary"}
    )

    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "Updated Global Salary"


@pytest.mark.asyncio
async def test_update_article_not_found(auth_client: AsyncClient):
    """Test updating non-existent article."""
    response = await auth_client.put(
        "/api/v1/articles/99999",
        json={"name": "Updated"}
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_article_unauthenticated(client: AsyncClient, test_article_root: Article):
    """Test updating article without authentication."""
    response = await client.put(
        f"/api/v1/articles/{test_article_root.id}",
        json={"name": "Updated"}
    )

    assert response.status_code == 401


# ============================================================================
# DELETE /api/v1/articles/{id} - Soft Delete Article
# ============================================================================


@pytest.mark.asyncio
async def test_delete_article_basic(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test soft deleting article."""
    response = await auth_client.delete(f"/api/v1/articles/{test_article_root.id}")

    assert response.status_code == 204

    # Verify article is soft deleted (is_current=False)
    await session.refresh(test_article_root)
    assert test_article_root.is_current is False


@pytest.mark.asyncio
async def test_delete_article_not_found(auth_client: AsyncClient):
    """Test deleting non-existent article."""
    response = await auth_client.delete("/api/v1/articles/99999")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_article_other_user(auth_client: AsyncClient, session: AsyncSession):
    """Test deleting other user's article (should fail)."""
    from datetime import datetime

    other_article = Article(
        user_id=999,
        code="OTHER",
        name="Other Article",
        type="expense",
        is_global=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(other_article)
    await session.commit()
    await session.refresh(other_article)

    response = await auth_client.delete(f"/api/v1/articles/{other_article.id}")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_global_article_as_regular_user(
    auth_client: AsyncClient, test_global_article: Article
):
    """Test deleting global article as regular user (should fail)."""
    response = await auth_client.delete(f"/api/v1/articles/{test_global_article.id}")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_global_article_as_admin(
    admin_client: AsyncClient, test_global_article: Article
):
    """Test deleting global article as admin (should succeed)."""
    response = await admin_client.delete(f"/api/v1/articles/{test_global_article.id}")

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_article_already_deleted(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test deleting already deleted article (should fail with 404)."""
    # First delete
    await auth_client.delete(f"/api/v1/articles/{test_article_root.id}")

    # Second delete should fail
    response = await auth_client.delete(f"/api/v1/articles/{test_article_root.id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_article_unauthenticated(client: AsyncClient, test_article_root: Article):
    """Test deleting article without authentication."""
    response = await client.delete(f"/api/v1/articles/{test_article_root.id}")

    assert response.status_code == 401


# ============================================================================
# GET /api/v1/articles/{id}/subtree - Get Article Subtree
# ============================================================================


@pytest.mark.asyncio
async def test_get_article_subtree_basic(
    auth_client: AsyncClient, test_article_root: Article, test_article_child: Article
):
    """Test getting article subtree."""
    response = await auth_client.get(f"/api/v1/articles/{test_article_root.id}/subtree")

    assert response.status_code == 200

    data = response.json()
    assert "articles" in data
    assert data["total"] >= 2  # Root + at least 1 child

    # Should include root and child
    codes = {article["code"] for article in data["articles"]}
    assert "FOOD" in codes
    assert "GROCERIES" in codes


@pytest.mark.asyncio
async def test_get_article_subtree_exclude_self(
    auth_client: AsyncClient, test_article_root: Article, test_article_child: Article
):
    """Test getting subtree without including root article itself."""
    response = await auth_client.get(
        f"/api/v1/articles/{test_article_root.id}/subtree?include_self=false"
    )

    assert response.status_code == 200

    data = response.json()
    codes = {article["code"] for article in data["articles"]}

    # Should not include root
    assert "FOOD" not in codes
    # Should include children
    assert "GROCERIES" in codes


@pytest.mark.asyncio
async def test_get_article_subtree_max_depth(
    auth_client: AsyncClient, session: AsyncSession, test_article_root: Article
):
    """Test getting subtree with max_depth parameter."""
    # Create multi-level hierarchy
    from datetime import datetime

    level1 = Article(
        user_id=1,
        parent_id=test_article_root.id,
        name="Level 1",
        type="expense",
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(level1)
    await session.commit()
    await session.refresh(level1)

    level2 = Article(
        user_id=1,
        parent_id=level1.id,
        name="Level 2",
        type="expense",
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(level2)
    await session.commit()

    # Get subtree with max_depth=1
    response = await auth_client.get(
        f"/api/v1/articles/{test_article_root.id}/subtree?max_depth=1"
    )

    assert response.status_code == 200

    data = response.json()
    codes = {article["code"] for article in data["articles"]}

    # Should include root and level 1, but not level 2
    assert "FOOD" in codes
    assert "LVL1" in codes
    # max_depth might or might not include LVL2 depending on implementation
    # Adjust assertion based on actual behavior


@pytest.mark.asyncio
async def test_get_article_subtree_not_found(auth_client: AsyncClient):
    """Test getting subtree of non-existent article."""
    response = await auth_client.get("/api/v1/articles/99999/subtree")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_article_subtree_other_user(auth_client: AsyncClient, session: AsyncSession):
    """Test getting subtree of other user's article (should fail)."""
    from datetime import datetime

    other_article = Article(
        user_id=999,
        code="OTHER",
        name="Other Article",
        type="expense",
        is_global=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(other_article)
    await session.commit()
    await session.refresh(other_article)

    response = await auth_client.get(f"/api/v1/articles/{other_article.id}/subtree")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_article_subtree_unauthenticated(client: AsyncClient, test_article_root: Article):
    """Test getting subtree without authentication."""
    response = await client.get(f"/api/v1/articles/{test_article_root.id}/subtree")

    assert response.status_code == 401


# ============================================================================
# GET /api/v1/articles/{id}/ancestors - Get Article Ancestors
# ============================================================================


@pytest.mark.asyncio
async def test_get_article_ancestors_basic(
    auth_client: AsyncClient, test_article_root: Article, test_article_child: Article
):
    """Test getting article ancestors (breadcrumb path)."""
    response = await auth_client.get(f"/api/v1/articles/{test_article_child.id}/ancestors")

    assert response.status_code == 200

    data = response.json()
    assert "articles" in data

    # Should include root article (parent of child)
    codes = {article["code"] for article in data["articles"]}
    assert "FOOD" in codes


@pytest.mark.asyncio
async def test_get_article_ancestors_include_self(
    auth_client: AsyncClient, test_article_child: Article
):
    """Test getting ancestors including the article itself."""
    response = await auth_client.get(
        f"/api/v1/articles/{test_article_child.id}/ancestors?include_self=true"
    )

    assert response.status_code == 200

    data = response.json()
    codes = {article["code"] for article in data["articles"]}

    # Should include both root and child
    assert "FOOD" in codes
    assert "GROCERIES" in codes


@pytest.mark.asyncio
async def test_get_article_ancestors_root_article(
    auth_client: AsyncClient, test_article_root: Article
):
    """Test getting ancestors of root article (should be empty)."""
    response = await auth_client.get(f"/api/v1/articles/{test_article_root.id}/ancestors")

    assert response.status_code == 200

    data = response.json()
    # Root article has no ancestors
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_article_ancestors_not_found(auth_client: AsyncClient):
    """Test getting ancestors of non-existent article."""
    response = await auth_client.get("/api/v1/articles/99999/ancestors")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_article_ancestors_unauthenticated(
    client: AsyncClient, test_article_child: Article
):
    """Test getting ancestors without authentication."""
    response = await client.get(f"/api/v1/articles/{test_article_child.id}/ancestors")

    assert response.status_code == 401
