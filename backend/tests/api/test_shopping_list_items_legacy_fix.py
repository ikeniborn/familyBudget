"""
Test shopping list items endpoint with legacy lists (without temp_id).

This test verifies backward compatibility for old shopping lists created
before PR #416 (temp_id unification). These lists have temp_id = NULL in DB.

Frontend hotfix (v11.6.1):
- getListTempId returns server_id instead of 0 for legacy lists
- DataLayer uses heuristic to choose correct API parameter:
  - listId < 10000 → shopping_list_id (legacy)
  - listId >= 10000 → shopping_list_temp_id (new)

Backend supports both parameters (backward compatible).
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.shopping_list import ShoppingList
from backend.app.models.shopping_list_item import ShoppingListItem


@pytest.mark.asyncio
async def test_legacy_list_without_temp_id(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """Test loading items from legacy list (temp_id = NULL)."""
    # Create legacy list WITHOUT temp_id (simulates old data)
    legacy_list = ShoppingList(
        creator_id=test_user.id,
        name="Legacy List (before PR #416)",
        description="Old list without temp_id",
        temp_id=None,  # NULL temp_id (legacy data)
    )
    session.add(legacy_list)
    await session.commit()
    await session.refresh(legacy_list)

    # Create item in legacy list
    item = ShoppingListItem(
        shopping_list_id=legacy_list.id,
        product_name="Legacy Item",
        quantity=1,
        unit="pcs",
        creator_id=test_user.id,
    )
    session.add(item)
    await session.commit()

    # Test: Load items using shopping_list_id (backward compatibility)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_id": legacy_list.id},
    )

    assert response.status_code == 200, f"Failed to load legacy list items: {response.text}"
    data = response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["product_name"] == "Legacy Item"


@pytest.mark.asyncio
async def test_new_list_with_temp_id(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """Test loading items from new list (with temp_id)."""
    import secrets

    temp_id = secrets.randbelow(9007199254740991)  # int53 temp_id

    # Create new list WITH temp_id (post PR #416)
    new_list = ShoppingList(
        creator_id=test_user.id,
        name="New List (after PR #416)",
        description="New list with temp_id",
        temp_id=temp_id,
    )
    session.add(new_list)
    await session.commit()
    await session.refresh(new_list)

    # Create item in new list
    item = ShoppingListItem(
        shopping_list_id=new_list.id,
        product_name="New Item",
        quantity=2,
        unit="kg",
        creator_id=test_user.id,
    )
    session.add(item)
    await session.commit()

    # Test: Load items using shopping_list_temp_id (new parameter)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_temp_id": temp_id},
    )

    assert response.status_code == 200, f"Failed to load new list items: {response.text}"
    data = response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["product_name"] == "New Item"


@pytest.mark.asyncio
async def test_heuristic_parameter_selection(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """
    Test that frontend heuristic correctly selects API parameter.

    Heuristic: listId < 10000 → shopping_list_id (server_id)
               listId >= 10000 → shopping_list_temp_id (temp_id)
    """
    # Create legacy list (server_id will be small, e.g. 1-100)
    legacy_list = ShoppingList(
        creator_id=test_user.id,
        name="Legacy List",
        temp_id=None,
    )
    session.add(legacy_list)
    await session.commit()
    await session.refresh(legacy_list)

    # Verify server_id is small (< 10000)
    assert legacy_list.id < 10000, "Server ID should be small for test database"

    # Test: Load using shopping_list_id (heuristic selects this for legacy)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_id": legacy_list.id},
    )
    assert response.status_code == 200

    # Create new list with temp_id
    import secrets

    temp_id = secrets.randbelow(9007199254740991)
    new_list = ShoppingList(
        creator_id=test_user.id,
        name="New List",
        temp_id=temp_id,
    )
    session.add(new_list)
    await session.commit()

    # Verify temp_id is large (>= 10000)
    assert temp_id >= 10000, "temp_id should be large (int53)"

    # Test: Load using shopping_list_temp_id (heuristic selects this for new)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_temp_id": temp_id},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_migration_scenario(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """
    Test transition from legacy to new lists.

    Simulates user having:
    - Old lists (temp_id = NULL)
    - New lists (temp_id set)

    Both should work simultaneously (backward compatible).
    """
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
    import secrets

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

    # Test: Load ALL legacy lists using shopping_list_id
    for legacy_list in legacy_lists:
        await session.refresh(legacy_list)
        response = await client.get(
            "/api/v1/shopping-list-items",
            params={"shopping_list_id": legacy_list.id},
        )
        assert response.status_code == 200, (
            f"Failed to load legacy list {legacy_list.id}"
        )

    # Test: Load ALL new lists using shopping_list_temp_id
    for new_list in new_lists:
        await session.refresh(new_list)
        response = await client.get(
            "/api/v1/shopping-list-items",
            params={"shopping_list_temp_id": new_list.temp_id},
        )
        assert response.status_code == 200, (
            f"Failed to load new list with temp_id={new_list.temp_id}"
        )
