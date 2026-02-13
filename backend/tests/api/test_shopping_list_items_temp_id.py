"""
Unit tests for shopping list items temp_id unification (v11.7.0)

Tests the new shopping_list_temp_id parameter support for
preventing INTEGER overflow when querying items.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.shopping_list import ShoppingList
from backend.app.models.shopping_list_item import ShoppingListItem


@pytest.mark.asyncio
async def test_list_items_by_temp_id(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """Test querying items by shopping_list_temp_id"""
    # Create shopping list with temp_id
    shopping_list = ShoppingList(
        creator_id=test_user.id,
        name="Test List",
        temp_id=4508494054591253,  # Large BIGINT (int53)
        family_id=1,
    )
    session.add(shopping_list)
    await session.commit()
    await session.refresh(shopping_list)

    # Create item
    item = ShoppingListItem(
        creator_id=test_user.id,
        shopping_list_id=shopping_list.id,
        temp_id=1234567890123456,
        store_id=1,
        product_group_id=1,
        product_name="Test Product",
        quantity=1,
    )
    session.add(item)
    await session.commit()

    # Query by temp_id
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_temp_id": shopping_list.temp_id}
    )

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] == 1
    assert data["items"][0]["product_name"] == "Test Product"


@pytest.mark.asyncio
async def test_list_items_by_server_id_backward_compat(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """Test backward compatibility with shopping_list_id"""
    # Create shopping list
    shopping_list = ShoppingList(
        creator_id=test_user.id,
        name="Test List 2",
        temp_id=9999999999999999,
        family_id=1,
    )
    session.add(shopping_list)
    await session.commit()
    await session.refresh(shopping_list)

    # Query by server_id (old parameter)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_id": shopping_list.id}
    )

    assert response.status_code == 200
    data = response.json()
    assert "items" in data


@pytest.mark.asyncio
async def test_list_items_no_id_error(client: AsyncClient):
    """Test error when neither ID provided"""
    response = await client.get("/api/v1/shopping-list-items")

    assert response.status_code == 400
    data = response.json()
    assert "must be provided" in data["detail"]


@pytest.mark.asyncio
async def test_list_items_temp_id_priority(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """Test temp_id takes precedence when both provided"""
    # Create shopping list 1
    list1 = ShoppingList(
        creator_id=test_user.id,
        name="List 1",
        temp_id=1111111111111111,
        family_id=1,
    )
    session.add(list1)
    await session.commit()
    await session.refresh(list1)

    # Create shopping list 2
    list2 = ShoppingList(
        creator_id=test_user.id,
        name="List 2",
        temp_id=2222222222222222,
        family_id=1,
    )
    session.add(list2)
    await session.commit()
    await session.refresh(list2)

    # Create item in list1
    item = ShoppingListItem(
        creator_id=test_user.id,
        shopping_list_id=list1.id,
        temp_id=3333333333333333,
        store_id=1,
        product_group_id=1,
        product_name="Product in List1",
        quantity=1,
    )
    session.add(item)
    await session.commit()

    # Query with temp_id=list1, but server_id=list2 (wrong)
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={
            "shopping_list_temp_id": list1.temp_id,
            "shopping_list_id": list2.id  # Wrong server_id
        }
    )

    # Should succeed because temp_id takes precedence
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["product_name"] == "Product in List1"


@pytest.mark.asyncio
async def test_list_items_temp_id_not_found(client: AsyncClient):
    """Test empty response when temp_id not found"""
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={"shopping_list_temp_id": 9999999999999999}
    )

    # Should return empty (not 404)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_list_items_filters_with_temp_id(
    client: AsyncClient,
    session: AsyncSession,
    test_user,
):
    """Test filters work correctly with temp_id parameter"""
    # Create shopping list
    shopping_list = ShoppingList(
        creator_id=test_user.id,
        name="Test List",
        temp_id=5555555555555555,
        family_id=1,
    )
    session.add(shopping_list)
    await session.commit()
    await session.refresh(shopping_list)

    # Create completed item
    item1 = ShoppingListItem(
        creator_id=test_user.id,
        shopping_list_id=shopping_list.id,
        temp_id=6666666666666666,
        store_id=1,
        product_group_id=1,
        product_name="Completed Product",
        quantity=1,
        is_completed=True,
    )
    session.add(item1)

    # Create incomplete item
    item2 = ShoppingListItem(
        creator_id=test_user.id,
        shopping_list_id=shopping_list.id,
        temp_id=7777777777777777,
        store_id=1,
        product_group_id=1,
        product_name="Incomplete Product",
        quantity=1,
        is_completed=False,
    )
    session.add(item2)
    await session.commit()

    # Query incomplete items only
    response = await client.get(
        "/api/v1/shopping-list-items",
        params={
            "shopping_list_temp_id": shopping_list.temp_id,
            "is_completed": "false"
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["product_name"] == "Incomplete Product"
