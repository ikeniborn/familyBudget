"""
End-to-End tests for Shopping List journey.

Complete user workflows:
1. Happy path: Create list → Add items → Complete → Delete
2. CSV import: Upload → Analyze → Preview → Import
3. Hierarchy view: Navigate tree structure
4. Offline scenario: Create offline → Sync online
"""

import base64
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.user import User

pytestmark = pytest.mark.asyncio


# ============================================================================
# Happy Path Journey
# ============================================================================


async def test_shopping_list_happy_path(
    auth_client: AsyncClient,
    test_user: User,
    test_store,
    test_product_group_root,
):
    """
    Test complete shopping list workflow:
    1. Create shopping list
    2. Add items
    3. Update items
    4. Complete items
    5. Delete items
    6. Delete list
    """

    # Step 1: Create shopping list
    response = await auth_client.post(
        "/api/v1/shopping-lists",
        json={
            "name": "Weekend Shopping",
            "description": "Groceries for the weekend",
        },
    )
    assert response.status_code == 201
    shopping_list = response.json()
    list_id = shopping_list["id"]

    # Step 2: Add items to list
    items_to_add = [
        {"product_name": "Tomatoes", "quantity": "2.5", "unit": "kg"},
        {"product_name": "Potatoes", "quantity": "3.0", "unit": "kg"},
        {"product_name": "Carrots", "quantity": "1.5", "unit": "kg"},
    ]

    item_ids = []
    for item_data in items_to_add:
        response = await auth_client.post(
            f"/api/v1/shopping-lists/{list_id}/items",
            json={
                "store_id": test_store.id,
                "product_group_id": test_product_group_root.id,
                **item_data,
            },
        )
        assert response.status_code == 201
        item_ids.append(response.json()["id"])

    # Verify all items created
    response = await auth_client.get(f"/api/v1/shopping-lists/{list_id}/items")
    assert response.status_code == 200
    assert len(response.json()["items"]) == 3

    # Step 3: Update an item
    response = await auth_client.put(
        f"/api/v1/shopping-list-items/{item_ids[0]}",
        json={"quantity": "3.0", "comment": "Need more"},
    )
    assert response.status_code == 200
    assert float(response.json()["quantity"]) == 3.0

    # Step 4: Complete items (batch operation)
    response = await auth_client.post(
        "/api/v1/shopping-list-items/batch-complete",
        json={"item_ids": item_ids[:2], "is_completed": True},
    )
    assert response.status_code == 200
    assert response.json()["updated_count"] == 2

    # Verify completion status
    response = await auth_client.get(f"/api/v1/shopping-lists/{list_id}/items")
    items = response.json()["items"]
    completed_count = sum(1 for item in items if item["is_completed"])
    assert completed_count == 2

    # Step 5: Delete completed items (batch)
    response = await auth_client.post(
        "/api/v1/shopping-list-items/batch-delete",
        json={"item_ids": item_ids[:2]},
    )
    assert response.status_code == 200
    assert response.json()["deleted_count"] == 2

    # Verify items deleted
    response = await auth_client.get(f"/api/v1/shopping-lists/{list_id}/items")
    assert len(response.json()["items"]) == 1

    # Step 6: Delete shopping list
    response = await auth_client.delete(f"/api/v1/shopping-lists/{list_id}")
    assert response.status_code == 204

    # Verify list deleted
    response = await auth_client.get(f"/api/v1/shopping-lists/{list_id}")
    assert response.status_code == 404


# ============================================================================
# CSV Import Journey
# ============================================================================


async def test_csv_import_journey(
    auth_client: AsyncClient,
    test_user: User,
    test_store,
    test_product_group_root,
):
    """
    Test complete CSV import workflow:
    1. Upload CSV file
    2. Analyze and auto-detect format
    3. Preview with validation
    4. Execute import
    5. Save as template
    6. Use template for next import
    """

    # Step 1: Create shopping list
    response = await auth_client.post(
        "/api/v1/shopping-lists",
        json={"name": "Imported List", "description": "From CSV"},
    )
    assert response.status_code == 201
    list_id = response.json()["id"]

    # Step 2: Analyze CSV
    csv_content = f"""Store,Category,Product,Qty,Unit
{test_store.name},{test_product_group_root.name},Tomatoes,2.5,kg
{test_store.name},{test_product_group_root.name},Potatoes,3.0,kg
{test_store.name},{test_product_group_root.name},Carrots,1.5,kg"""

    encoded = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/analyze",
        json={"file_content": encoded},
    )
    assert response.status_code == 200
    analysis = response.json()
    assert analysis["detected_format"]["delimiter"] == ","

    # Step 3: Preview import
    column_mapping = {
        "Store": "store",
        "Category": "product_group",
        "Product": "product_name",
        "Qty": "quantity",
        "Unit": "unit",
    }

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/preview",
        json={
            "file_content": encoded,
            "shopping_list_id": list_id,
            "column_mapping": column_mapping,
        },
    )
    assert response.status_code == 200
    preview = response.json()
    assert len(preview["preview_rows"]) == 3

    # Step 4: Execute import
    response = await auth_client.post(
        "/api/v1/shopping-lists/import/execute",
        json={
            "file_content": encoded,
            "shopping_list_id": list_id,
            "column_mapping": column_mapping,
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["imported_count"] == 3
    assert result["failed_count"] == 0

    # Verify items imported
    response = await auth_client.get(f"/api/v1/shopping-lists/{list_id}/items")
    assert len(response.json()["items"]) == 3

    # Step 5: Save as template
    response = await auth_client.post(
        "/api/v1/import-templates",
        json={
            "name": "Standard CSV Template",
            "config": {
                "delimiter": ",",
                "column_mapping": column_mapping,
            },
        },
    )
    assert response.status_code == 201
    template = response.json()

    # Step 6: Use template for next import
    response = await auth_client.get(
        f"/api/v1/import-templates/{template['id']}"
    )
    assert response.status_code == 200
    saved_mapping = response.json()["config"]["column_mapping"]
    assert saved_mapping == column_mapping


# ============================================================================
# Hierarchy View Journey
# ============================================================================


async def test_hierarchy_view_journey(
    auth_client: AsyncClient,
    session: AsyncSession,
    test_user: User,
    test_shopping_list,
):
    """
    Test hierarchy view:
    1. Create stores
    2. Create product groups (hierarchical)
    3. Create items for different stores/groups
    4. Query hierarchy structure
    """
    from datetime import datetime

    from backend.app.models.product_group import ProductGroup
    from backend.app.models.shopping_list_item import ShoppingListItem
    from backend.app.models.store import Store

    # Step 1: Create stores
    stores = []
    for name in ["Walmart", "Target", "Whole Foods"]:
        store = Store(
            creator_id=test_user.id,
            name=name,
            code=f"STORE-{name}",
            is_active=True,
            is_current=True,
            valid_from=datetime.utcnow(),
            valid_to=datetime(9999, 12, 31, 23, 59, 59),
        )
        session.add(store)
        stores.append(store)
    await session.commit()
    for store in stores:
        await session.refresh(store)

    # Step 2: Create hierarchical product groups
    # Root: Food
    food = ProductGroup(
        creator_id=test_user.id,
        parent_id=None,
        name="Food",
        code="PGRP-FOOD",
        is_active=True,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(food)
    await session.commit()
    await session.refresh(food)

    # Children: Vegetables, Fruits
    vegetables = ProductGroup(
        creator_id=test_user.id,
        parent_id=food.id,
        name="Vegetables",
        code="PGRP-VEG",
        is_active=True,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    fruits = ProductGroup(
        creator_id=test_user.id,
        parent_id=food.id,
        name="Fruits",
        code="PGRP-FRUIT",
        is_active=True,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add_all([vegetables, fruits])
    await session.commit()
    for group in [vegetables, fruits]:
        await session.refresh(group)

    # Step 3: Create items for different stores/groups
    items_data = [
        # Walmart - Vegetables
        {"store": stores[0], "group": vegetables, "product": "Tomatoes", "qty": "2.5"},
        {"store": stores[0], "group": vegetables, "product": "Potatoes", "qty": "3.0"},
        # Target - Fruits
        {"store": stores[1], "group": fruits, "product": "Apples", "qty": "1.5"},
        {"store": stores[1], "group": fruits, "product": "Bananas", "qty": "2.0"},
        # Whole Foods - Vegetables
        {"store": stores[2], "group": vegetables, "product": "Carrots", "qty": "1.0"},
    ]

    for data in items_data:
        item = ShoppingListItem(
            creator_id=test_user.id,
            shopping_list_id=test_shopping_list.id,
            store_id=data["store"].id,
            product_group_id=data["group"].id,
            product_name=data["product"],
            quantity=Decimal(data["qty"]),
            unit="kg",
            is_completed=False,
            sync_status="synced",
        )
        session.add(item)
    await session.commit()

    # Step 4: Query and verify hierarchy
    response = await auth_client.get(
        f"/api/v1/shopping-lists/{test_shopping_list.id}/items"
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 5

    # Verify items grouped by store
    walmart_items = [i for i in items if i["store_id"] == stores[0].id]
    target_items = [i for i in items if i["store_id"] == stores[1].id]
    whole_foods_items = [i for i in items if i["store_id"] == stores[2].id]

    assert len(walmart_items) == 2
    assert len(target_items) == 2
    assert len(whole_foods_items) == 1


# ============================================================================
# Offline Scenario Journey
# ============================================================================


async def test_offline_sync_scenario(
    auth_client: AsyncClient,
    test_user: User,
    test_shopping_list,
    test_store,
    test_product_group_root,
):
    """
    Test offline → online sync workflow:
    1. Create item (simulating offline creation with temp_id)
    2. Mark as pending sync
    3. Sync to server
    4. Verify sync status updated

    Note: This is a simplified E2E test. Real offline sync happens
    in the browser via IndexedDB and is tested in frontend tests.
    """

    # Step 1: Create item with sync_status = 'pending'
    response = await auth_client.post(
        f"/api/v1/shopping-lists/{test_shopping_list.id}/items",
        json={
            "store_id": test_store.id,
            "product_group_id": test_product_group_root.id,
            "product_name": "Offline Item",
            "quantity": "1.0",
            "unit": "kg",
            "sync_status": "pending",  # Simulating offline creation
        },
    )
    assert response.status_code == 201
    item = response.json()
    item_id = item["id"]

    # Step 2: Verify item marked as pending
    assert item["sync_status"] == "pending"

    # Step 3: Update sync status (simulating successful sync)
    response = await auth_client.put(
        f"/api/v1/shopping-list-items/{item_id}",
        json={"sync_status": "synced"},
    )
    assert response.status_code == 200
    updated_item = response.json()
    assert updated_item["sync_status"] == "synced"

    # Step 4: Verify sync completed
    response = await auth_client.get(
        f"/api/v1/shopping-lists/{test_shopping_list.id}/items"
    )
    items = response.json()["items"]
    offline_item = next(i for i in items if i["id"] == item_id)
    assert offline_item["sync_status"] == "synced"


# ============================================================================
# Error Scenarios
# ============================================================================


async def test_concurrent_updates(
    auth_client: AsyncClient,
    test_shopping_list_item,
):
    """Test handling of concurrent updates (conflict scenario)."""

    # Update 1: Change quantity
    response1 = await auth_client.put(
        f"/api/v1/shopping-list-items/{test_shopping_list_item.id}",
        json={"quantity": "5.0"},
    )
    assert response1.status_code == 200

    # Update 2: Change comment (should succeed, no conflict)
    response2 = await auth_client.put(
        f"/api/v1/shopping-list-items/{test_shopping_list_item.id}",
        json={"comment": "Updated comment"},
    )
    assert response2.status_code == 200

    # Verify both updates applied
    final_item = response2.json()
    assert float(final_item["quantity"]) == 5.0
    assert final_item["comment"] == "Updated comment"


async def test_delete_list_with_items(
    auth_client: AsyncClient,
    test_shopping_list,
    test_shopping_list_item,
):
    """Test deleting a shopping list cascades to items."""

    # Verify item exists
    response = await auth_client.get(
        f"/api/v1/shopping-lists/{test_shopping_list.id}/items"
    )
    assert len(response.json()["items"]) == 1

    # Delete list
    response = await auth_client.delete(
        f"/api/v1/shopping-lists/{test_shopping_list.id}"
    )
    assert response.status_code == 204

    # Verify items also deleted (CASCADE)
    response = await auth_client.get(
        f"/api/v1/shopping-list-items/{test_shopping_list_item.id}"
    )
    assert response.status_code == 404
