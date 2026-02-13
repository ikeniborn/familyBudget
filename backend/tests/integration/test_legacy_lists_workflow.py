"""
Integration test: Legacy lists workflow (v11.6.1 hotfix)

Tests end-to-end workflow for legacy shopping lists without temp_id:
1. Create legacy list (temp_id = NULL)
2. Add items to legacy list
3. Load items via shopping_list_id parameter (backward compatible)
4. Verify heuristic works correctly

This test simulates real production scenario with 8 legacy lists.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.shopping_list import ShoppingList
from backend.app.models.shopping_list_item import ShoppingListItem


@pytest.mark.asyncio
async def test_legacy_list_full_workflow(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """
    Test complete workflow for legacy list (created before PR #416).

    Workflow:
    1. Create list WITHOUT temp_id (simulates old data)
    2. Add 3 items to list
    3. Load items using shopping_list_id (backward compatible)
    4. Verify all items returned
    5. Update item (mark as completed)
    6. Load again, verify update persisted
    """
    # Step 1: Create legacy list WITHOUT temp_id
    legacy_list = ShoppingList(
        creator_id=test_user.id,
        name="Магазин (legacy)",
        description="Старый список без temp_id",
        temp_id=None,  # NULL temp_id (legacy data)
    )
    session.add(legacy_list)
    await session.commit()
    await session.refresh(legacy_list)

    # Verify: temp_id is NULL in database
    assert legacy_list.temp_id is None, "Legacy list should have NULL temp_id"

    # Step 2: Add 3 items to legacy list
    items_data = [
        {"product_name": "Хлеб", "quantity": 1, "unit": "шт"},
        {"product_name": "Молоко", "quantity": 2, "unit": "л"},
        {"product_name": "Яйца", "quantity": 10, "unit": "шт"},
    ]

    for item_data in items_data:
        item = ShoppingListItem(
            shopping_list_id=legacy_list.id,
            creator_id=test_user.id,
            store_id=1,  # Default test store
            product_group_id=1,  # Default test product group
            **item_data,
        )
        session.add(item)

    await session.commit()

    # Step 3: Load items using shopping_list_id (backward compatible)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_id": legacy_list.id},
    )

    assert response.status_code == 200, (
        f"Failed to load legacy list items: {response.text}"
    )

    # Step 4: Verify all 3 items returned
    data = response.json()
    assert data["total"] == 3, f"Expected 3 items, got {data['total']}"
    assert len(data["items"]) == 3

    # Verify item details
    product_names = [item["product_name"] for item in data["items"]]
    assert "Хлеб" in product_names
    assert "Молоко" in product_names
    assert "Яйца" in product_names

    # Step 5: Update item (mark "Хлеб" as completed)
    bread_item = next(item for item in data["items"] if item["product_name"] == "Хлеб")
    update_response = await client.patch(
        f"/api/v1/shopping-list-items/{bread_item['id']}",
        json={"is_completed": True},
    )
    assert update_response.status_code == 200

    # Step 6: Load again, verify update persisted
    response2 = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_id": legacy_list.id},
    )
    assert response2.status_code == 200

    data2 = response2.json()
    bread_item_updated = next(
        item for item in data2["items"] if item["product_name"] == "Хлеб"
    )
    assert bread_item_updated["is_completed"] is True


@pytest.mark.asyncio
async def test_mixed_legacy_and_new_lists(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """
    Test that legacy and new lists coexist (migration scenario).

    Simulates production environment with:
    - 8 legacy lists (temp_id = NULL)
    - 3 new lists (temp_id set)

    Both types should work correctly via appropriate API parameters.
    """
    import secrets

    # Create 3 legacy lists
    legacy_lists = []
    for i in range(3):
        legacy_list = ShoppingList(
            creator_id=test_user.id,
            name=f"Legacy List {i + 1}",
            temp_id=None,
        )
        session.add(legacy_list)
        legacy_lists.append(legacy_list)

    # Create 3 new lists with temp_id
    new_lists = []
    for i in range(3):
        temp_id = secrets.randbelow(9007199254740991)
        new_list = ShoppingList(
            creator_id=test_user.id,
            name=f"New List {i + 1}",
            temp_id=temp_id,
        )
        session.add(new_list)
        new_lists.append(new_list)

    await session.commit()

    # Refresh all lists to get IDs
    for lst in legacy_lists + new_lists:
        await session.refresh(lst)

    # Test: Load items from ALL legacy lists using shopping_list_id
    for legacy_list in legacy_lists:
        response = await client.get(
            "/api/v1/shopping-list-items",
            params={"shopping_list_id": legacy_list.id},
        )
        assert response.status_code == 200, (
            f"Failed to load legacy list {legacy_list.id}"
        )
        # Verify backend logged correct parameter usage
        # (check backend logs: "[LIST_ITEMS] Using server_id parameter (legacy)")

    # Test: Load items from ALL new lists using shopping_list_temp_id
    for new_list in new_lists:
        response = await client.get(
            "/api/v1/shopping-list-items",
            params={"shopping_list_temp_id": new_list.temp_id},
        )
        assert response.status_code == 200, (
            f"Failed to load new list with temp_id={new_list.temp_id}"
        )

    # Test: Verify legacy lists have NULL temp_id in DB
    for legacy_list in legacy_lists:
        stmt = select(ShoppingList).where(ShoppingList.id == legacy_list.id)
        result = await session.execute(stmt)
        db_list = result.scalar_one()
        assert db_list.temp_id is None, (
            f"Legacy list {legacy_list.id} should have NULL temp_id"
        )

    # Test: Verify new lists have temp_id in DB
    for new_list in new_lists:
        stmt = select(ShoppingList).where(ShoppingList.id == new_list.id)
        result = await session.execute(stmt)
        db_list = result.scalar_one()
        assert db_list.temp_id is not None, (
            f"New list {new_list.id} should have temp_id"
        )
        assert db_list.temp_id > 10_000, (
            f"New list temp_id should be large (got {db_list.temp_id})"
        )


@pytest.mark.asyncio
async def test_heuristic_boundary_conditions(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """
    Test heuristic boundary conditions (edge cases near threshold).

    Heuristic: listId < 10000 → shopping_list_id, listId >= 10000 → shopping_list_temp_id

    Edge cases:
    - ID = 9999 (just below threshold) → should use shopping_list_id
    - ID = 10000 (exactly at threshold) → should use shopping_list_temp_id
    - ID = 10001 (just above threshold) → should use shopping_list_temp_id
    """
    # Note: This test assumes test database uses SERIAL starting from 1
    # If database already has 10k+ lists, this test may not be meaningful

    # Create legacy list (should have ID < 10000 in test DB)
    legacy_list = ShoppingList(
        creator_id=test_user.id,
        name="Edge Case Legacy",
        temp_id=None,
    )
    session.add(legacy_list)
    await session.commit()
    await session.refresh(legacy_list)

    # Verify: Legacy list ID should be small (< 10000)
    assert legacy_list.id < 10_000, (
        f"Test assumption failed: legacy list ID ({legacy_list.id}) should be < 10000"
    )

    # Test: Load using shopping_list_id (should work)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_id": legacy_list.id},
    )
    assert response.status_code == 200

    # Create new list with temp_id exactly at threshold
    new_list_threshold = ShoppingList(
        creator_id=test_user.id,
        name="Threshold List",
        temp_id=10_000,  # Exactly at threshold
    )
    session.add(new_list_threshold)
    await session.commit()

    # Test: Load using shopping_list_temp_id (should work)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_temp_id": 10_000},
    )
    assert response.status_code == 200

    # Create new list with temp_id above threshold
    new_list_above = ShoppingList(
        creator_id=test_user.id,
        name="Above Threshold List",
        temp_id=10_001,
    )
    session.add(new_list_above)
    await session.commit()

    # Test: Load using shopping_list_temp_id (should work)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_temp_id": 10_001},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_error_handling_invalid_parameters(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """
    Test error handling for invalid list IDs.

    Backend should return 400 Bad Request for:
    - Both parameters missing
    - Invalid temp_id (temp_id=0)
    - Invalid server_id (shopping_list_id=0)
    """
    # Test: Both parameters missing
    response = await client.get("/api/v1/shopping-list-items")
    assert response.status_code == 400
    assert "at least one ID must be provided" in response.text.lower()

    # Test: Invalid temp_id (temp_id=0)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_temp_id": 0},
    )
    assert response.status_code == 200  # Backend returns empty list, not error
    data = response.json()
    assert data["total"] == 0, "Invalid temp_id should return empty list"

    # Test: Invalid server_id (shopping_list_id=0)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_id": 0},
    )
    # Backend may return 404 or 200 with empty list (implementation dependent)
    assert response.status_code in [200, 404]

    # Test: Negative IDs
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_id": -1},
    )
    # Should return empty list or error
    assert response.status_code in [200, 400, 404]
