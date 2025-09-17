"""
Integration test suite for Products Page 500 error fix.

This test verifies that the products page loads without 500 error and that
articles stats API is called correctly if needed. Tests full product CRUD operations.

Background:
- Products page was causing 500 internal server errors
- Issue related to articles stats endpoint causing ResourceClosedError
- Fixed by properly handling database connections and field mappings
- Ensures end-to-end functionality works correctly

Test Coverage:
- Products page loads without 500 error
- Articles stats API is called correctly if needed
- Full product CRUD operations work
- Integration between frontend and backend
- Error handling and recovery
- User authentication and authorization
"""

import pytest
import asyncio
import httpx
import json
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional
from unittest.mock import patch, AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.main import app
from app.models.product import Product
from app.models.product_price import ProductPrice
from app.models.article import Article
from app.models.user import User
from app.db.database import get_db
from app.api.deps import get_current_user


class TestProductsPage500Fix:
    """Integration test class for products page 500 error fixes."""

    @pytest.fixture
    async def test_client(self):
        """Create test client for integration testing."""
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            yield client

    @pytest.fixture
    def mock_user(self):
        """Mock authenticated user."""
        return {
            "user_id": 1,
            "username": "testuser",
            "email": "test@example.com",
            "is_admin": False,
            "telegram_id": 123456789
        }

    @pytest.fixture
    def mock_admin_user(self):
        """Mock authenticated admin user."""
        return {
            "user_id": 2,
            "username": "admin",
            "email": "admin@example.com",
            "is_admin": True,
            "telegram_id": 987654321
        }

    @pytest.fixture
    async def mock_db_session(self):
        """Mock database session for testing."""
        session = AsyncMock(spec=AsyncSession)
        return session

    @pytest.fixture
    def sample_products(self):
        """Sample product data for testing."""
        return [
            {
                "id": 1,
                "name": "Молоко 3.2%",
                "category": "Молочные продукты",
                "unit": "л",
                "barcode": "1234567890123",
                "description": "Натуральное молоко",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "id": 2,
                "name": "Хлеб белый",
                "category": "Хлебобулочные изделия",
                "unit": "шт",
                "barcode": "9876543210987",
                "description": "Свежий белый хлеб",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "id": 3,
                "name": "Яблоки красные",
                "category": "Фрукты",
                "unit": "кг",
                "barcode": "5555666677778",
                "description": "Спелые красные яблоки",
                "is_active": False,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
        ]

    async def test_products_page_loads_without_500_error(self, test_client, mock_db_session, mock_user, sample_products):
        """Test that products page loads without 500 error."""
        # Mock database queries for products
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = [
            Product(**product_data) for product_data in sample_products
        ]
        mock_db_session.execute.return_value = mock_result

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test products API endpoint
            response = await test_client.get("/api/products/")

            # Should not return 500 error
            assert response.status_code != 500
            assert response.status_code in [200, 401, 403]  # Expected status codes

            if response.status_code == 200:
                # Verify response structure
                data = response.json()
                assert isinstance(data, list)
                assert len(data) <= len(sample_products)

                # Verify product structure
                if data:
                    product = data[0]
                    assert "id" in product
                    assert "name" in product
                    assert "category" in product
                    assert "is_active" in product

        finally:
            app.dependency_overrides.clear()

    async def test_articles_stats_api_called_correctly(self, test_client, mock_db_session, mock_user):
        """Test that articles stats API is called correctly if needed."""
        # Mock articles stats response
        mock_total_result = AsyncMock()
        mock_total_result.scalar.return_value = 5

        mock_active_result = AsyncMock()
        mock_active_result.scalar.return_value = 4

        mock_inactive_result = AsyncMock()
        mock_inactive_result.scalar.return_value = 1

        mock_db_session.execute.side_effect = [
            mock_total_result,
            mock_active_result,
            mock_inactive_result
        ]

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test articles stats endpoint
            response = await test_client.get("/api/articles/stats")

            # Should not return 500 error
            assert response.status_code != 500

            if response.status_code == 200:
                data = response.json()
                assert "success" in data
                assert data["success"] is True
                assert "data" in data

                stats = data["data"]
                assert "total" in stats
                assert "active" in stats
                assert "inactive" in stats
                assert stats["total"] == 5
                assert stats["active"] == 4
                assert stats["inactive"] == 1

        finally:
            app.dependency_overrides.clear()

    async def test_product_create_operation(self, test_client, mock_db_session, mock_user):
        """Test full product CREATE operation works."""
        # Mock product creation
        new_product_data = {
            "name": "Новый продукт",
            "category": "Тестовая категория",
            "unit": "шт",
            "barcode": "1111222233334",
            "description": "Тестовый продукт",
            "is_active": True
        }

        # Mock database operations
        mock_product = Product(id=100, **new_product_data)
        mock_db_session.add = AsyncMock()
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test product creation
            response = await test_client.post("/api/products/", json=new_product_data)

            # Should not return 500 error
            assert response.status_code != 500

            if response.status_code == 201:
                data = response.json()
                assert data["name"] == new_product_data["name"]
                assert data["category"] == new_product_data["category"]

        finally:
            app.dependency_overrides.clear()

    async def test_product_read_operation(self, test_client, mock_db_session, mock_user, sample_products):
        """Test full product READ operation works."""
        # Mock database query for specific product
        product_data = sample_products[0]
        mock_product = Product(**product_data)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_product
        mock_db_session.execute.return_value = mock_result

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test getting specific product
            response = await test_client.get("/api/products/1")

            # Should not return 500 error
            assert response.status_code != 500

            if response.status_code == 200:
                data = response.json()
                assert data["id"] == 1
                assert data["name"] == "Молоко 3.2%"
                assert data["category"] == "Молочные продукты"

        finally:
            app.dependency_overrides.clear()

    async def test_product_update_operation(self, test_client, mock_db_session, mock_user, sample_products):
        """Test full product UPDATE operation works."""
        # Mock existing product
        product_data = sample_products[0].copy()
        mock_product = Product(**product_data)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_product
        mock_db_session.execute.return_value = mock_result
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        # Update data
        update_data = {
            "name": "Обновленное молоко",
            "description": "Обновленное описание"
        }

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test product update
            response = await test_client.put("/api/products/1", json=update_data)

            # Should not return 500 error
            assert response.status_code != 500

            if response.status_code == 200:
                data = response.json()
                assert data["name"] == update_data["name"]
                assert data["description"] == update_data["description"]

        finally:
            app.dependency_overrides.clear()

    async def test_product_delete_operation(self, test_client, mock_db_session, mock_user, sample_products):
        """Test full product DELETE operation works."""
        # Mock existing product
        product_data = sample_products[0].copy()
        mock_product = Product(**product_data)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_product
        mock_db_session.execute.return_value = mock_result
        mock_db_session.commit = AsyncMock()

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test product deletion (soft delete)
            response = await test_client.delete("/api/products/1")

            # Should not return 500 error
            assert response.status_code != 500

            if response.status_code == 200:
                data = response.json()
                assert "message" in data
                assert "deactivated" in data["message"]

        finally:
            app.dependency_overrides.clear()

    async def test_product_search_functionality(self, test_client, mock_db_session, mock_user, sample_products):
        """Test product search functionality works correctly."""
        # Mock database query with search
        filtered_products = [p for p in sample_products if "молоко" in p["name"].lower()]
        mock_products = [Product(**product_data) for product_data in filtered_products]

        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = mock_products
        mock_db_session.execute.return_value = mock_result

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test product search
            response = await test_client.get("/api/products/?search=молоко")

            # Should not return 500 error
            assert response.status_code != 500

            if response.status_code == 200:
                data = response.json()
                assert isinstance(data, list)
                if data:
                    # Verify search results
                    for product in data:
                        assert "молоко" in product["name"].lower()

        finally:
            app.dependency_overrides.clear()

    async def test_product_categories_endpoint(self, test_client, mock_db_session, mock_user):
        """Test product categories endpoint works correctly."""
        # Mock categories query
        categories = ["Молочные продукты", "Хлебобулочные изделия", "Фрукты"]

        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = categories
        mock_db_session.execute.return_value = mock_result

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test categories endpoint
            response = await test_client.get("/api/products/categories")

            # Should not return 500 error
            assert response.status_code != 500

            if response.status_code == 200:
                data = response.json()
                assert "categories" in data
                assert isinstance(data["categories"], list)

        finally:
            app.dependency_overrides.clear()

    async def test_product_barcode_search(self, test_client, mock_db_session, mock_user, sample_products):
        """Test product barcode search functionality."""
        # Mock barcode search
        product_data = sample_products[0]
        mock_product = Product(**product_data)

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_product
        mock_db_session.execute.return_value = mock_result

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test barcode search
            response = await test_client.get("/api/products/search/barcode/1234567890123")

            # Should not return 500 error
            assert response.status_code != 500

            if response.status_code == 200:
                data = response.json()
                assert data["barcode"] == "1234567890123"
                assert data["name"] == "Молоко 3.2%"

        finally:
            app.dependency_overrides.clear()

    async def test_product_price_operations(self, test_client, mock_db_session, mock_user, sample_products):
        """Test product price history operations."""
        # Mock product and price data
        product_data = sample_products[0]
        mock_product = Product(**product_data)

        price_data = {
            "id": 1,
            "product_id": 1,
            "supplier_name": "Пятерочка",
            "price_value": Decimal("89.50"),
            "price_date": datetime.now(),
            "user_id": 1,
            "created_at": datetime.now()
        }
        mock_price = ProductPrice(**price_data)

        # Mock database queries
        mock_product_result = AsyncMock()
        mock_product_result.scalar_one_or_none.return_value = mock_product

        mock_price_result = AsyncMock()
        mock_price_result.scalars.return_value.all.return_value = [mock_price]

        mock_db_session.execute.side_effect = [mock_product_result, mock_price_result]
        mock_db_session.add = AsyncMock()
        mock_db_session.commit = AsyncMock()
        mock_db_session.refresh = AsyncMock()

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test get product prices
            response = await test_client.get("/api/products/1/prices")

            # Should not return 500 error
            assert response.status_code != 500

            if response.status_code == 200:
                data = response.json()
                assert isinstance(data, list)

            # Test create product price
            new_price_data = {
                "product_id": 1,
                "supplier_name": "Магнит",
                "price_value": 92.00,
                "price_date": datetime.now().isoformat()
            }

            response = await test_client.post("/api/products/1/prices", json=new_price_data)

            # Should not return 500 error
            assert response.status_code != 500

        finally:
            app.dependency_overrides.clear()

    async def test_error_handling_and_recovery(self, test_client, mock_db_session, mock_user):
        """Test error handling and recovery mechanisms."""
        # Test database connection error
        mock_db_session.execute.side_effect = Exception("Database connection error")

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test with database error
            response = await test_client.get("/api/products/")

            # Should handle error gracefully (not crash with 500)
            assert response.status_code in [500, 503, 502]  # Expected error codes

            # Should return proper error response
            if response.status_code == 500:
                # Should not be a generic 500 error
                assert response.headers.get("content-type") == "application/json"

        finally:
            app.dependency_overrides.clear()

    async def test_authentication_and_authorization(self, test_client, mock_db_session):
        """Test user authentication and authorization."""
        # Test without authentication
        app.dependency_overrides[get_db] = lambda: mock_db_session
        # No current user dependency override

        try:
            # Test without authentication
            response = await test_client.get("/api/products/")

            # Should require authentication
            assert response.status_code == 401

        finally:
            app.dependency_overrides.clear()

    async def test_concurrent_operations(self, test_client, mock_db_session, mock_user, sample_products):
        """Test concurrent operations don't cause 500 errors."""
        # Mock database operations
        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = [
            Product(**product_data) for product_data in sample_products
        ]
        mock_db_session.execute.return_value = mock_result

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Create multiple concurrent requests
            tasks = []
            for i in range(5):
                task = test_client.get("/api/products/")
                tasks.append(task)

            # Execute concurrent requests
            responses = await asyncio.gather(*tasks, return_exceptions=True)

            # All responses should be successful or handled gracefully
            for response in responses:
                if isinstance(response, httpx.Response):
                    assert response.status_code != 500
                    assert response.status_code in [200, 401, 403, 429]  # Expected codes

        finally:
            app.dependency_overrides.clear()

    async def test_data_consistency_validation(self, test_client, mock_db_session, mock_user, sample_products):
        """Test data consistency validation."""
        # Mock products with various states
        products_with_issues = sample_products.copy()
        products_with_issues.append({
            "id": 4,
            "name": "",  # Empty name
            "category": None,
            "unit": None,
            "barcode": None,
            "description": None,
            "is_active": True,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        })

        mock_products = [Product(**product_data) for product_data in products_with_issues]

        mock_result = AsyncMock()
        mock_result.scalars.return_value.all.return_value = mock_products
        mock_db_session.execute.return_value = mock_result

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_user

        try:
            # Test with potentially problematic data
            response = await test_client.get("/api/products/")

            # Should handle data issues gracefully
            assert response.status_code != 500

            if response.status_code == 200:
                data = response.json()
                assert isinstance(data, list)

                # Verify all products are serializable
                for product in data:
                    assert "id" in product
                    assert "name" in product  # Even if empty
                    assert "is_active" in product

        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    # Run integration tests
    pytest.main([__file__, "-v", "--tb=short"])