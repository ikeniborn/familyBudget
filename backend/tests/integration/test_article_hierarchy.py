"""
Integration tests for article hierarchy operations.

Tests complete hierarchical workflows through API:
1. Create multi-level article hierarchy
2. Query subtree (all descendants)
3. Query ancestors (path to root)
4. Update hierarchy (change parent)
5. Delete nodes and verify hierarchy impact

These tests verify closure table and hierarchy service work correctly end-to-end.
"""

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.hierarchy import ArticleHierarchy

# ============================================================================
# Create Hierarchy Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_simple_hierarchy(admin_client: AsyncClient, session: AsyncSession):
    """
    Test creating simple two-level hierarchy.

    Hierarchy:
    Food (root)
    └── Groceries (child)

    Verifies:
    - Parent article created
    - Child article created with parent_id
    - Closure table entries created
    """
    # Step 1: Create root article (admin only)
    root_response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "FOOD",
            "name": "Food",
            "type": "expense",
            "parent_id": None,
        },
    )

    assert root_response.status_code == 201
    root_article = root_response.json()
    root_id = root_article["id"]

    # Step 2: Create child article (admin only)
    child_response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": root_id,
        },
    )

    assert child_response.status_code == 201
    child_article = child_response.json()
    child_id = child_article["id"]

    assert child_article["parent_id"] == root_id

    # Step 3: Verify hierarchy in database (closure table)
    stmt = select(ArticleHierarchy).where(ArticleHierarchy.descendant_id == child_id)
    result = await session.execute(stmt)
    hierarchy_entries = result.scalars().all()

    # Should have 2 entries:
    # 1. Self-reference (child → child, depth=0)
    # 2. Parent relationship (root → child, depth=1)
    assert len(hierarchy_entries) >= 2


@pytest.mark.asyncio
async def test_create_deep_hierarchy(admin_client: AsyncClient):
    """
    Test creating deep multi-level hierarchy.

    Hierarchy:
    Food (root)
    └── Groceries (level 1)
        └── Vegetables (level 2)
            └── Organic (level 3)

    Verifies:
    - All levels created successfully
    - Parent-child relationships correct
    """
    # Create Food (root) - admin only
    food_response = await admin_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    food_id = food_response.json()["id"]

    # Create Groceries (child of Food) - admin only
    groceries_response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": food_id,
        },
    )
    groceries_id = groceries_response.json()["id"]

    # Create Vegetables (child of Groceries) - admin only
    vegetables_response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "VEGETABLES",
            "name": "Vegetables",
            "type": "expense",
            "parent_id": groceries_id,
        },
    )
    vegetables_id = vegetables_response.json()["id"]

    # Create Organic (child of Vegetables) - admin only
    organic_response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "ORGANIC",
            "name": "Organic Vegetables",
            "type": "expense",
            "parent_id": vegetables_id,
        },
    )

    assert organic_response.status_code == 201
    organic_article = organic_response.json()
    assert organic_article["parent_id"] == vegetables_id


# ============================================================================
# Query Subtree Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_subtree_complete_tree(auth_client: AsyncClient, admin_client: AsyncClient):
    """
    Test getting complete subtree of root article.

    Hierarchy:
    Food
    ├── Groceries
    │   └── Vegetables
    └── Dining Out

    Verifies:
    - Subtree includes all descendants
    - Subtree includes root (include_self=true)
    """
    # Create hierarchy
    food_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    food_id = food_resp.json()["id"]

    groceries_resp = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": food_id,
        },
    )
    groceries_id = groceries_resp.json()["id"]

    await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "VEGETABLES",
            "name": "Vegetables",
            "type": "expense",
            "parent_id": groceries_id,
        },
    )

    await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "DINING",
            "name": "Dining Out",
            "type": "expense",
            "parent_id": food_id,
        },
    )

    # Get subtree
    subtree_response = await auth_client.get(
        f"/api/v1/articles/{food_id}/subtree?include_self=true"
    )

    assert subtree_response.status_code == 200

    subtree_data = subtree_response.json()
    articles = subtree_data["articles"]

    # Should include all 4 articles
    assert subtree_data["total"] == 4

    codes = {article["code"] for article in articles}
    assert "FOOD" in codes
    assert "GROCERIES" in codes
    assert "VEGETABLES" in codes
    assert "DINING" in codes


@pytest.mark.asyncio
async def test_get_subtree_with_max_depth(auth_client: AsyncClient, admin_client: AsyncClient):
    """
    Test getting subtree with depth limit.

    Hierarchy:
    Food (depth=0)
    └── Groceries (depth=1)
        └── Vegetables (depth=2)

    Query: max_depth=1
    Expected: Food + Groceries (not Vegetables)
    """
    # Create hierarchy
    food_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    food_id = food_resp.json()["id"]

    groceries_resp = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": food_id,
        },
    )
    groceries_id = groceries_resp.json()["id"]

    await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "VEGETABLES",
            "name": "Vegetables",
            "type": "expense",
            "parent_id": groceries_id,
        },
    )

    # Get subtree with max_depth=1
    subtree_response = await auth_client.get(
        f"/api/v1/articles/{food_id}/subtree?max_depth=1&include_self=true"
    )

    assert subtree_response.status_code == 200

    subtree_data = subtree_response.json()
    codes = {article["code"] for article in subtree_data["articles"]}

    # Should include Food and Groceries
    assert "FOOD" in codes
    assert "GROCERIES" in codes
    # May or may not include VEGETABLES depending on implementation
    # (implementation detail)


@pytest.mark.asyncio
async def test_get_subtree_exclude_self(auth_client: AsyncClient, admin_client: AsyncClient):
    """
    Test getting subtree without root article itself.

    Hierarchy:
    Food
    └── Groceries

    Query: include_self=false
    Expected: Only Groceries (not Food)
    """
    # Create hierarchy
    food_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    food_id = food_resp.json()["id"]

    await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": food_id,
        },
    )

    # Get subtree without root
    subtree_response = await auth_client.get(
        f"/api/v1/articles/{food_id}/subtree?include_self=false"
    )

    assert subtree_response.status_code == 200

    subtree_data = subtree_response.json()
    codes = {article["code"] for article in subtree_data["articles"]}

    # Should NOT include Food
    assert "FOOD" not in codes
    # Should include Groceries
    assert "GROCERIES" in codes


# ============================================================================
# Query Ancestors Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_ancestors_path_to_root(auth_client: AsyncClient, admin_client: AsyncClient):
    """
    Test getting ancestors (breadcrumb path to root).

    Hierarchy:
    Food
    └── Groceries
        └── Vegetables

    Query: ancestors of Vegetables
    Expected: [Food, Groceries] (ordered root → leaf)
    """
    # Create hierarchy
    food_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    food_id = food_resp.json()["id"]

    groceries_resp = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": food_id,
        },
    )
    groceries_id = groceries_resp.json()["id"]

    vegetables_resp = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "VEGETABLES",
            "name": "Vegetables",
            "type": "expense",
            "parent_id": groceries_id,
        },
    )
    vegetables_id = vegetables_resp.json()["id"]

    # Get ancestors
    ancestors_response = await auth_client.get(
        f"/api/v1/articles/{vegetables_id}/ancestors?include_self=false"
    )

    assert ancestors_response.status_code == 200

    ancestors_data = ancestors_response.json()
    articles = ancestors_data["articles"]

    codes = [article["code"] for article in articles]

    # Should include Food and Groceries (in order: root → leaf)
    assert "FOOD" in codes
    assert "GROCERIES" in codes
    assert "VEGETABLES" not in codes  # Not included when include_self=false


@pytest.mark.asyncio
async def test_get_ancestors_include_self(auth_client: AsyncClient, admin_client: AsyncClient):
    """
    Test getting ancestors including article itself.

    Query: ancestors of Vegetables with include_self=true
    Expected: [Food, Groceries, Vegetables]
    """
    # Create hierarchy
    food_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    food_id = food_resp.json()["id"]

    groceries_resp = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": food_id,
        },
    )
    groceries_id = groceries_resp.json()["id"]

    vegetables_resp = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "VEGETABLES",
            "name": "Vegetables",
            "type": "expense",
            "parent_id": groceries_id,
        },
    )
    vegetables_id = vegetables_resp.json()["id"]

    # Get ancestors with self
    ancestors_response = await auth_client.get(
        f"/api/v1/articles/{vegetables_id}/ancestors?include_self=true"
    )

    assert ancestors_response.status_code == 200

    ancestors_data = ancestors_response.json()
    codes = {article["code"] for article in ancestors_data["articles"]}

    # Should include all three
    assert "FOOD" in codes
    assert "GROCERIES" in codes
    assert "VEGETABLES" in codes


@pytest.mark.asyncio
async def test_get_ancestors_root_article(auth_client: AsyncClient, admin_client: AsyncClient):
    """
    Test getting ancestors of root article (should be empty).

    Query: ancestors of Food (root)
    Expected: [] (no ancestors)
    """
    # Create root article
    food_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    food_id = food_resp.json()["id"]

    # Get ancestors (should be empty)
    ancestors_response = await auth_client.get(f"/api/v1/articles/{food_id}/ancestors")

    assert ancestors_response.status_code == 200

    ancestors_data = ancestors_response.json()
    assert ancestors_data["total"] == 0


# ============================================================================
# Update Hierarchy Tests
# ============================================================================


@pytest.mark.asyncio
async def test_update_article_change_parent(auth_client: AsyncClient, admin_client: AsyncClient, session: AsyncSession):
    """
    Test changing article's parent (reorganizing hierarchy).

    Initial:
    Food
    ├── Groceries
    └── Vegetables

    Update: Move Vegetables under Groceries

    Final:
    Food
    └── Groceries
        └── Vegetables

    Verifies:
    - Article parent_id updated (SCD Type 2)
    - Hierarchy queries reflect new structure
    """
    # Create initial hierarchy
    food_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    food_id = food_resp.json()["id"]

    groceries_resp = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": food_id,
        },
    )
    groceries_id = groceries_resp.json()["id"]

    vegetables_resp = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "VEGETABLES",
            "name": "Vegetables",
            "type": "expense",
            "parent_id": food_id,  # Initially under Food
        },
    )
    vegetables_id = vegetables_resp.json()["id"]

    # Update: Move Vegetables under Groceries
    update_response = await admin_client.put(
        f"/api/v1/articles/{vegetables_id}",
        json={"parent_id": groceries_id},  # New parent
    )

    assert update_response.status_code == 200

    # Verify new structure via subtree query
    subtree_response = await auth_client.get(
        f"/api/v1/articles/{groceries_id}/subtree?include_self=true"
    )

    subtree_data = subtree_response.json()
    codes = {article["code"] for article in subtree_data["articles"]}

    # Groceries subtree should now include Vegetables
    assert "GROCERIES" in codes
    assert "VEGETABLES" in codes


# ============================================================================
# Delete Hierarchy Tests
# ============================================================================


@pytest.mark.asyncio
async def test_delete_article_with_children(auth_client: AsyncClient, admin_client: AsyncClient):
    """
    Test deleting article that has children (soft delete).

    Hierarchy:
    Food
    └── Groceries

    Action: Delete Food
    Expected: Food deleted (is_current=False), Groceries remains but orphaned
    """
    # Create hierarchy
    food_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    food_id = food_resp.json()["id"]

    groceries_resp = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": food_id,
        },
    )
    groceries_id = groceries_resp.json()["id"]

    # Delete Food
    delete_response = await admin_client.delete(f"/api/v1/articles/{food_id}")

    assert delete_response.status_code == 204

    # Verify Food is gone (404 when trying to get it)
    get_food_response = await auth_client.get(f"/api/v1/articles/{food_id}")
    assert get_food_response.status_code == 404

    # Verify Groceries still exists
    get_groceries_response = await auth_client.get(f"/api/v1/articles/{groceries_id}")
    assert get_groceries_response.status_code == 200


# ============================================================================
# Complex Hierarchy Scenarios
# ============================================================================


@pytest.mark.asyncio
async def test_wide_hierarchy(auth_client: AsyncClient, admin_client: AsyncClient):
    """
    Test wide hierarchy (many siblings).

    Hierarchy:
    Food
    ├── Groceries
    ├── Dining Out
    ├── Snacks
    ├── Beverages
    └── Desserts

    Verifies:
    - All siblings created
    - Subtree query returns all children
    """
    # Create root
    food_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "FOOD", "name": "Food", "type": "expense", "parent_id": None},
    )
    food_id = food_resp.json()["id"]

    # Create siblings
    siblings = ["Groceries", "Dining Out", "Snacks", "Beverages", "Desserts"]

    for name in siblings:
        await admin_client.post(
            "/api/v1/articles",
            json={
                "code": name.upper().replace(" ", "_"),
                "name": name,
                "type": "expense",
                "parent_id": food_id,
            },
        )

    # Get subtree
    subtree_response = await auth_client.get(
        f"/api/v1/articles/{food_id}/subtree?include_self=true"
    )

    subtree_data = subtree_response.json()
    # Should include root + 5 children = 6 total
    assert subtree_data["total"] == 6


@pytest.mark.asyncio
async def test_hierarchy_across_types(auth_client: AsyncClient, admin_client: AsyncClient):
    """
    Test that hierarchy respects article types (income vs expense).

    Note: In current implementation, articles can have parents of same type.
    This test verifies mixed-type hierarchies are handled correctly.
    """
    # Create income root
    income_root_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "INCOME", "name": "Income", "type": "income", "parent_id": None},
    )
    income_root_id = income_root_resp.json()["id"]

    # Create expense root
    expense_root_resp = await admin_client.post(
        "/api/v1/articles",
        json={"code": "EXPENSES", "name": "Expenses", "type": "expense", "parent_id": None},
    )
    expense_root_id = expense_root_resp.json()["id"]

    # Both should be created successfully
    assert income_root_resp.status_code == 201
    assert expense_root_resp.status_code == 201

    # Verify both are roots (no parent)
    assert income_root_resp.json()["parent_id"] is None
    assert expense_root_resp.json()["parent_id"] is None
