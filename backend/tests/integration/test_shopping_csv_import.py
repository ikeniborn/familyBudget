"""
Integration tests for Shopping List CSV Import.

Tests:
- CSV analysis (auto-detection)
- CSV preview with validation
- CSV import execution
- Import templates CRUD
- Error handling and validation
"""

import base64

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.user import User

pytestmark = pytest.mark.asyncio


# ============================================================================
# CSV Import Tests
# ============================================================================


async def test_analyze_csv_basic(
    auth_client: AsyncClient, test_user: User
):
    """Test CSV analysis with auto-detection."""
    # Sample CSV content
    csv_content = """Store,Category,Product,Qty,Unit
Walmart,Food,Tomatoes,2.5,kg
Walmart,Food,Potatoes,3.0,kg"""

    # Encode to base64
    encoded = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/analyze",
        json={"file_content": encoded},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify detection results
    assert "detected_format" in data
    assert data["detected_format"]["delimiter"] == ","
    assert "column_mapping" in data
    assert "preview_rows" in data


async def test_analyze_csv_semicolon_delimiter(auth_client: AsyncClient):
    """Test CSV analysis with semicolon delimiter."""
    csv_content = """Store;Category;Product;Qty;Unit
Walmart;Food;Tomatoes;2.5;kg"""

    encoded = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/analyze",
        json={"file_content": encoded},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["detected_format"]["delimiter"] == ";"


async def test_analyze_csv_with_synonyms(auth_client: AsyncClient):
    """Test column matching with synonyms."""
    # Use synonym columns
    csv_content = """Shop,Group,Item,Quantity,Measure
Walmart,Food,Tomatoes,2.5,kg"""

    encoded = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/analyze",
        json={"file_content": encoded},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify fuzzy matching
    mapping = data["column_mapping"]
    # "Shop" should map to "store"
    # "Group" should map to "product_group"
    # "Item" should map to "product_name"
    assert "store" in mapping.values()
    assert "product_name" in mapping.values()


async def test_preview_csv_with_validation(
    auth_client: AsyncClient,
    test_shopping_list,
    test_store,
    test_product_group_root,
):
    """Test CSV preview with validation warnings."""
    csv_content = """Store,Category,Product,Qty,Unit
Walmart,Food,Tomatoes,2.5,kg
InvalidStore,Food,Potatoes,3.0,kg"""

    encoded = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/preview",
        json={
            "file_content": encoded,
            "shopping_list_id": test_shopping_list.id,
            "column_mapping": {
                "Store": "store",
                "Category": "product_group",
                "Product": "product_name",
                "Qty": "quantity",
                "Unit": "unit",
            },
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert "preview_rows" in data
    assert len(data["preview_rows"]) == 2

    # First row should be valid
    assert data["preview_rows"][0]["validation_status"] == "valid"

    # Second row should have warning (invalid store)
    assert data["preview_rows"][1]["validation_status"] in ["warning", "error"]


async def test_execute_csv_import(
    auth_client: AsyncClient,
    session: AsyncSession,
    test_shopping_list,
    test_store,
    test_product_group_root,
):
    """Test CSV import execution."""
    csv_content = f"""Store,Category,Product,Qty,Unit
{test_store.name},{test_product_group_root.name},Tomatoes,2.5,kg
{test_store.name},{test_product_group_root.name},Potatoes,3.0,kg"""

    encoded = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/execute",
        json={
            "file_content": encoded,
            "shopping_list_id": test_shopping_list.id,
            "column_mapping": {
                "Store": "store",
                "Category": "product_group",
                "Product": "product_name",
                "Qty": "quantity",
                "Unit": "unit",
            },
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["imported_count"] == 2
    assert data["failed_count"] == 0
    assert len(data["errors"]) == 0


async def test_execute_import_partial_failure(
    auth_client: AsyncClient,
    test_shopping_list,
    test_store,
    test_product_group_root,
):
    """Test CSV import with partial failures."""
    # Mix of valid and invalid rows
    csv_content = f"""Store,Category,Product,Qty,Unit
{test_store.name},{test_product_group_root.name},Tomatoes,2.5,kg
InvalidStore,Food,Potatoes,3.0,kg"""

    encoded = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/execute",
        json={
            "file_content": encoded,
            "shopping_list_id": test_shopping_list.id,
            "column_mapping": {
                "Store": "store",
                "Category": "product_group",
                "Product": "product_name",
                "Qty": "quantity",
                "Unit": "unit",
            },
        },
    )

    assert response.status_code == 200
    data = response.json()

    # One row imported, one failed
    assert data["imported_count"] == 1
    assert data["failed_count"] == 1
    assert len(data["errors"]) > 0


async def test_csv_injection_prevention(auth_client: AsyncClient, test_shopping_list):
    """Test CSV injection attack prevention."""
    # CSV with formula injection attempt
    csv_content = """Store,Category,Product,Qty,Unit
Walmart,Food,=1+1,2.5,kg
Walmart,Food,@SUM(A1:A10),3.0,kg"""

    encoded = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/execute",
        json={
            "file_content": encoded,
            "shopping_list_id": test_shopping_list.id,
            "column_mapping": {
                "Store": "store",
                "Category": "product_group",
                "Product": "product_name",
                "Qty": "quantity",
                "Unit": "unit",
            },
        },
    )

    # Should succeed with sanitized values
    assert response.status_code == 200


# ============================================================================
# Import Templates Tests
# ============================================================================


async def test_create_import_template(auth_client: AsyncClient, test_user: User):
    """Test creating an import template."""
    response = await auth_client.post(
        "/api/v1/import-templates",
        json={
            "name": "My CSV Template",
            "config": {
                "delimiter": ",",
                "column_mapping": {
                    "store": "Store",
                    "product_group": "Category",
                    "product_name": "Product",
                },
            },
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My CSV Template"
    assert data["user_id"] == test_user.id
    assert "column_mapping" in data["config"]


async def test_get_import_templates_user_specific(
    auth_client: AsyncClient,
    test_import_template,
    test_admin,
    session: AsyncSession,
):
    """Test getting import templates (user-specific filtering)."""
    # Create a template for another user (admin)
    from backend.app.models.import_template import ImportTemplate

    admin_template = ImportTemplate(
        user_id=test_admin.id,
        name="Admin Template",
        config={"delimiter": ";"},
    )
    session.add(admin_template)
    await session.commit()

    # Regular user should see ONLY their own template
    response = await auth_client.get("/api/v1/import-templates")

    assert response.status_code == 200
    data = response.json()

    # Should only see 1 template (user's own)
    assert len(data["templates"]) == 1
    assert data["templates"][0]["name"] == "My CSV Template"


async def test_update_import_template(
    auth_client: AsyncClient, test_import_template
):
    """Test updating an import template."""
    response = await auth_client.put(
        f"/api/v1/import-templates/{test_import_template.id}",
        json={
            "name": "Updated Template",
            "config": {"delimiter": ";"},
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Template"
    assert data["config"]["delimiter"] == ";"


async def test_delete_import_template(
    auth_client: AsyncClient, test_import_template
):
    """Test deleting an import template."""
    response = await auth_client.delete(
        f"/api/v1/import-templates/{test_import_template.id}"
    )
    assert response.status_code == 204


# ============================================================================
# Error Handling Tests
# ============================================================================


async def test_analyze_invalid_base64(auth_client: AsyncClient):
    """Test analyzing invalid base64 content."""
    response = await auth_client.post(
        "/api/v1/shopping-lists/import/analyze",
        json={"file_content": "not-valid-base64!!!"},
    )
    assert response.status_code == 400


async def test_import_empty_csv(auth_client: AsyncClient, test_shopping_list):
    """Test importing empty CSV."""
    csv_content = ""
    encoded = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/execute",
        json={
            "file_content": encoded,
            "shopping_list_id": test_shopping_list.id,
            "column_mapping": {},
        },
    )
    assert response.status_code in [400, 422]  # Validation error


async def test_import_malformed_csv(auth_client: AsyncClient, test_shopping_list):
    """Test importing malformed CSV."""
    csv_content = """Store,Category,Product
Walmart,Food,Tomatoes,ExtraColumn,TooMany
Walmart,Food"""  # Inconsistent columns

    encoded = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")

    response = await auth_client.post(
        "/api/v1/shopping-lists/import/execute",
        json={
            "file_content": encoded,
            "shopping_list_id": test_shopping_list.id,
            "column_mapping": {
                "Store": "store",
                "Category": "product_group",
                "Product": "product_name",
            },
        },
    )

    # Should handle gracefully
    assert response.status_code == 200
    data = response.json()
    # Likely some rows failed
    assert data["failed_count"] > 0


async def test_unauthenticated_import(client: AsyncClient):
    """Test that unauthenticated requests are rejected."""
    response = await client.post(
        "/api/v1/shopping-lists/import/analyze",
        json={"file_content": "dGVzdA=="},
    )
    assert response.status_code == 401
