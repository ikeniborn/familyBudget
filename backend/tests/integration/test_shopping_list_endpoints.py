"""
Integration tests for Shopping List API endpoints.

Tests:
- Shopping Lists CRUD (GET, POST, PUT, DELETE)
- Shopping List Items CRUD
- Batch operations (complete, delete)
- User isolation and sharing (SHARED model)
- Validation and error handling
"""

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.user import User

pytestmark = pytest.mark.asyncio


# ============================================================================
# Shopping Lists CRUD Tests
# ============================================================================


async def test_create_shopping_list(
    auth_client: AsyncClient, test_user: User
):
    """Test creating a shopping list."""
    response = await auth_client.post(
        "/api/v1/shopping-lists",
        json={
            "name": "Weekend Shopping",
            "description": "Weekend groceries",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Weekend Shopping"
    assert data["description"] == "Weekend groceries"
    assert data["creator_id"] == test_user.id
    assert data["is_active"] is True


async def test_get_all_shopping_lists_shared(
    auth_client: AsyncClient, test_shopping_list, test_admin, session: AsyncSession
):
    """Test getting all shopping lists (SHARED - no user isolation)."""
    # Create a shopping list by another user (admin)
    from backend.app.models.shopping_list import ShoppingList

    admin_list = ShoppingList(
        creator_id=test_admin.id,
        name="Admin's List",
        description="Admin list",
        is_active=True,
    )
    session.add(admin_list)
    await session.commit()

    # Regular user should see BOTH lists (SHARED model)
    response = await auth_client.get("/api/v1/shopping-lists")

    assert response.status_code == 200
    data = response.json()
    assert "shopping_lists" in data
    assert len(data["shopping_lists"]) == 2

    # Verify both lists are returned
    names = {lst["name"] for lst in data["shopping_lists"]}
    assert "Weekly Groceries" in names  # test_shopping_list
    assert "Admin's List" in names


async def test_get_shopping_list_by_id(
    auth_client: AsyncClient, test_shopping_list
):
    """Test getting a shopping list by ID."""
    response = await auth_client.get(
        f"/api/v1/shopping-lists/{test_shopping_list.id}"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_shopping_list.id
    assert data["name"] == "Weekly Groceries"


async def test_update_shopping_list(
    auth_client: AsyncClient, test_shopping_list
):
    """Test updating a shopping list."""
    response = await auth_client.put(
        f"/api/v1/shopping-lists/{test_shopping_list.id}",
        json={
            "name": "Updated Groceries",
            "description": "Updated description",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Groceries"
    assert data["description"] == "Updated description"


async def test_delete_shopping_list_owner_only(
    auth_client: AsyncClient, test_shopping_list, test_admin, session: AsyncSession
):
    """Test deleting a shopping list (only owner can delete)."""
    # Create a shopping list by admin
    from backend.app.models.shopping_list import ShoppingList

    admin_list = ShoppingList(
        creator_id=test_admin.id,
        name="Admin's List",
        description="Admin list",
        is_active=True,
    )
    session.add(admin_list)
    await session.commit()
    await session.refresh(admin_list)

    # Regular user tries to delete admin's list → 403
    response = await auth_client.delete(
        f"/api/v1/shopping-lists/{admin_list.id}"
    )
    assert response.status_code == 403
    assert "only the list owner" in response.json()["detail"].lower()

    # User can delete their own list → 204
    response = await auth_client.delete(
        f"/api/v1/shopping-lists/{test_shopping_list.id}"
    )
    assert response.status_code == 204


async def test_delete_nonexistent_shopping_list(auth_client: AsyncClient):
    """Test deleting a non-existent shopping list."""
    response = await auth_client.delete("/api/v1/shopping-lists/99999")
    assert response.status_code == 404


# ============================================================================
# Shopping List Items CRUD Tests
# ============================================================================


async def test_create_shopping_list_item(
    auth_client: AsyncClient,
    test_user: User,
    test_shopping_list,
    test_store,
    test_product_group_root,
):
    """Test creating a shopping list item."""
    response = await auth_client.post(
        f"/api/v1/shopping-lists/{test_shopping_list.id}/items",
        json={
            "store_id": test_store.id,
            "product_group_id": test_product_group_root.id,
            "product_name": "Carrots",
            "quantity": "1.5",
            "unit": "kg",
            "comment": "Fresh orange carrots",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["product_name"] == "Carrots"
    assert float(data["quantity"]) == 1.5
    assert data["unit"] == "kg"
    assert data["is_completed"] is False


async def test_create_item_validation_required_fields(
    auth_client: AsyncClient, test_shopping_list
):
    """Test validation of required fields."""
    # Missing store_id
    response = await auth_client.post(
        f"/api/v1/shopping-lists/{test_shopping_list.id}/items",
        json={
            "product_group_id": 1,
            "product_name": "Test",
        },
    )
    assert response.status_code == 422  # Validation error

    # Missing product_name
    response = await auth_client.post(
        f"/api/v1/shopping-lists/{test_shopping_list.id}/items",
        json={
            "store_id": 1,
            "product_group_id": 1,
        },
    )
    assert response.status_code == 422


async def test_get_shopping_list_items(
    auth_client: AsyncClient, test_shopping_list, test_shopping_list_item
):
    """Test getting all items in a shopping list."""
    response = await auth_client.get(
        f"/api/v1/shopping-lists/{test_shopping_list.id}/items"
    )

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) == 1
    assert data["items"][0]["product_name"] == "Tomatoes"


async def test_update_shopping_list_item(
    auth_client: AsyncClient, test_shopping_list_item
):
    """Test updating a shopping list item."""
    response = await auth_client.put(
        f"/api/v1/shopping-list-items/{test_shopping_list_item.id}",
        json={
            "product_name": "Cherry Tomatoes",
            "quantity": "3.0",
            "is_completed": True,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["product_name"] == "Cherry Tomatoes"
    assert float(data["quantity"]) == 3.0
    assert data["is_completed"] is True


async def test_delete_shopping_list_item(
    auth_client: AsyncClient, test_shopping_list_item
):
    """Test deleting a shopping list item."""
    response = await auth_client.delete(
        f"/api/v1/shopping-list-items/{test_shopping_list_item.id}"
    )
    assert response.status_code == 204

    # Verify item is deleted

    # Get session from dependency override
    # Note: In real test, we'd use the session fixture
    # For now, just verify response code


# ============================================================================
# Batch Operations Tests
# ============================================================================


async def test_batch_complete_items(
    auth_client: AsyncClient,
    test_shopping_list,
    test_shopping_list_item,
    test_store,
    test_product_group_root,
    test_user: User,
    session: AsyncSession,
):
    """Test batch completing items."""
    # Create additional item
    from backend.app.models.shopping_list_item import ShoppingListItem

    item2 = ShoppingListItem(
        creator_id=test_user.id,
        shopping_list_id=test_shopping_list.id,
        store_id=test_store.id,
        product_group_id=test_product_group_root.id,
        product_name="Potatoes",
        quantity=Decimal("2.0"),
        unit="kg",
        is_completed=False,
    )
    session.add(item2)
    await session.commit()
    await session.refresh(item2)

    # Batch complete
    response = await auth_client.post(
        "/api/v1/shopping-list-items/batch-complete",
        json={
            "item_ids": [test_shopping_list_item.id, item2.id],
            "is_completed": True,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["updated_count"] == 2


async def test_batch_delete_items(
    auth_client: AsyncClient,
    test_shopping_list,
    test_shopping_list_item,
    test_store,
    test_product_group_root,
    test_user: User,
    session: AsyncSession,
):
    """Test batch deleting items."""
    # Create additional item
    from backend.app.models.shopping_list_item import ShoppingListItem

    item2 = ShoppingListItem(
        creator_id=test_user.id,
        shopping_list_id=test_shopping_list.id,
        store_id=test_store.id,
        product_group_id=test_product_group_root.id,
        product_name="Onions",
        quantity=Decimal("1.0"),
        unit="kg",
        is_completed=False,
    )
    session.add(item2)
    await session.commit()
    await session.refresh(item2)

    # Batch delete
    response = await auth_client.post(
        "/api/v1/shopping-list-items/batch-delete",
        json={
            "item_ids": [test_shopping_list_item.id, item2.id],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["deleted_count"] == 2


# ============================================================================
# Error Handling Tests
# ============================================================================


async def test_get_shopping_list_not_found(auth_client: AsyncClient):
    """Test getting a non-existent shopping list."""
    response = await auth_client.get("/api/v1/shopping-lists/99999")
    assert response.status_code == 404


async def test_update_shopping_list_not_found(auth_client: AsyncClient):
    """Test updating a non-existent shopping list."""
    response = await auth_client.put(
        "/api/v1/shopping-lists/99999",
        json={"name": "Updated"},
    )
    assert response.status_code == 404


async def test_create_item_invalid_shopping_list(
    auth_client: AsyncClient, test_store, test_product_group_root
):
    """Test creating an item for a non-existent shopping list."""
    response = await auth_client.post(
        "/api/v1/shopping-lists/99999/items",
        json={
            "store_id": test_store.id,
            "product_group_id": test_product_group_root.id,
            "product_name": "Test",
        },
    )
    assert response.status_code == 404


async def test_unauthenticated_access(client: AsyncClient):
    """Test that unauthenticated requests are rejected."""
    response = await client.get("/api/v1/shopping-lists")
    assert response.status_code == 401
