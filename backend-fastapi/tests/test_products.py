"""
Tests for product endpoints.
"""
import pytest
from datetime import datetime, timedelta
from fastapi import status
from fastapi.testclient import TestClient


class TestProductEndpoints:
    """Test product CRUD operations."""
    
    def test_create_product(self, authenticated_client: TestClient, test_product_data):
        """Test creating a product."""
        response = authenticated_client.post("/api/products", json=test_product_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == test_product_data["name"]
        assert data["data"]["unit"] == test_product_data["unit"]
        assert data["data"]["category"] == test_product_data["category"]
        assert data["data"]["barcode"] == test_product_data["barcode"]
    
    def test_create_product_without_barcode(self, authenticated_client: TestClient):
        """Test creating product without barcode."""
        product_data = {
            "name": "Хлеб",
            "unit": "шт",
            "category": "Хлебобулочные изделия"
        }
        response = authenticated_client.post("/api/products", json=product_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["data"]["barcode"] is None
    
    def test_get_products(self, authenticated_client: TestClient):
        """Test getting all products."""
        # Create multiple products
        products = [
            {"name": "Молоко", "unit": "л", "category": "Молочные"},
            {"name": "Хлеб", "unit": "шт", "category": "Хлебобулочные"},
            {"name": "Яйца", "unit": "упак", "category": "Яйца"}
        ]
        
        for product in products:
            authenticated_client.post("/api/products", json=product)
        
        # Get all products
        response = authenticated_client.get("/api/products")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["data"]) == 3
    
    def test_search_products(self, authenticated_client: TestClient):
        """Test searching products by name."""
        # Create products
        products = [
            {"name": "Молоко 2.5%", "unit": "л", "category": "Молочные"},
            {"name": "Молоко 3.2%", "unit": "л", "category": "Молочные"},
            {"name": "Кефир", "unit": "л", "category": "Молочные"}
        ]
        
        for product in products:
            authenticated_client.post("/api/products", json=product)
        
        # Search for "молоко"
        response = authenticated_client.get("/api/products?search=молоко")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["data"]) == 2
        for product in data["data"]:
            assert "молоко" in product["name"].lower()
    
    def test_get_products_by_category(self, authenticated_client: TestClient):
        """Test getting products by category."""
        # Create products in different categories
        products = [
            {"name": "Молоко", "unit": "л", "category": "Молочные"},
            {"name": "Кефир", "unit": "л", "category": "Молочные"},
            {"name": "Хлеб", "unit": "шт", "category": "Хлебобулочные"}
        ]
        
        for product in products:
            authenticated_client.post("/api/products", json=product)
        
        # Get products in "Молочные" category
        response = authenticated_client.get("/api/products?category=Молочные")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["data"]) == 2
        for product in data["data"]:
            assert product["category"] == "Молочные"
    
    def test_get_product_by_barcode(self, authenticated_client: TestClient):
        """Test getting product by barcode."""
        # Create product with barcode
        product_data = {
            "name": "Молоко Простоквашино",
            "unit": "л",
            "category": "Молочные",
            "barcode": "4607001234567"
        }
        authenticated_client.post("/api/products", json=product_data)
        
        # Get by barcode
        response = authenticated_client.get(f"/api/products/barcode/{product_data['barcode']}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["barcode"] == product_data["barcode"]
        assert data["data"]["name"] == product_data["name"]
    
    def test_update_product(self, authenticated_client: TestClient, test_product_data):
        """Test updating product."""
        # Create product
        create_response = authenticated_client.post("/api/products", json=test_product_data)
        product_id = create_response.json()["data"]["id"]
        
        # Update
        update_data = {
            "name": "Молоко обезжиренное",
            "unit": "бут"
        }
        response = authenticated_client.put(f"/api/products/{product_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["data"]["name"] == update_data["name"]
        assert data["data"]["unit"] == update_data["unit"]
        # Category should remain unchanged
        assert data["data"]["category"] == test_product_data["category"]
    
    def test_delete_product(self, authenticated_client: TestClient, test_product_data):
        """Test deleting product."""
        # Create product
        create_response = authenticated_client.post("/api/products", json=test_product_data)
        product_id = create_response.json()["data"]["id"]
        
        # Delete
        response = authenticated_client.delete(f"/api/products/{product_id}")
        assert response.status_code == status.HTTP_200_OK
        
        # Verify deleted
        response = authenticated_client.get(f"/api/products/{product_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_duplicate_barcode(self, authenticated_client: TestClient):
        """Test that duplicate barcodes are not allowed."""
        product_data = {
            "name": "Product 1",
            "unit": "шт",
            "category": "Test",
            "barcode": "1234567890123"
        }
        
        # Create first product
        authenticated_client.post("/api/products", json=product_data)
        
        # Try to create second product with same barcode
        product_data["name"] = "Product 2"
        response = authenticated_client.post("/api/products", json=product_data)
        assert response.status_code == status.HTTP_409_CONFLICT


class TestProductPriceEndpoints:
    """Test product price endpoints."""
    
    @pytest.fixture(autouse=True)
    def setup_product(self, authenticated_client: TestClient):
        """Create a product for price tests."""
        product_response = authenticated_client.post("/api/products", json={
            "name": "Test Product",
            "unit": "шт",
            "category": "Test"
        })
        self.product_id = product_response.json()["data"]["id"]
    
    def test_add_price(self, authenticated_client: TestClient):
        """Test adding price to product."""
        price_data = {
            "product_id": self.product_id,
            "price": 99.99,
            "store": "Магазин у дома",
            "date": datetime.now().isoformat()
        }
        
        response = authenticated_client.post("/api/product-prices", json=price_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert float(data["data"]["price"]) == 99.99
        assert data["data"]["store"] == price_data["store"]
    
    def test_get_price_history(self, authenticated_client: TestClient):
        """Test getting price history for a product."""
        # Add multiple prices
        stores = ["Магазин 1", "Магазин 2", "Магазин 3"]
        base_date = datetime.now()
        
        for i, store in enumerate(stores):
            price_data = {
                "product_id": self.product_id,
                "price": 100.00 + i * 10,
                "store": store,
                "date": (base_date - timedelta(days=i)).isoformat()
            }
            authenticated_client.post("/api/product-prices", json=price_data)
        
        # Get price history
        response = authenticated_client.get(f"/api/product-prices/product/{self.product_id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["data"]) == 3
        
        # Prices should be ordered by date (newest first)
        prices = [float(p["price"]) for p in data["data"]]
        assert prices[0] >= prices[-1]
    
    def test_get_latest_price(self, authenticated_client: TestClient):
        """Test getting latest price for a product."""
        # Add prices with different dates
        base_date = datetime.now()
        for i in range(3):
            price_data = {
                "product_id": self.product_id,
                "price": 100.00 - i * 10,
                "store": f"Store {i}",
                "date": (base_date - timedelta(days=i)).isoformat()
            }
            authenticated_client.post("/api/product-prices", json=price_data)
        
        # Get latest price
        response = authenticated_client.get(f"/api/products/{self.product_id}/latest-price")
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert float(data["data"]["price"]) == 100.00  # Latest price
    
    def test_get_average_price(self, authenticated_client: TestClient):
        """Test getting average price for a product."""
        # Add prices
        prices = [100.00, 110.00, 120.00]
        for price in prices:
            price_data = {
                "product_id": self.product_id,
                "price": price,
                "store": "Store",
                "date": datetime.now().isoformat()
            }
            authenticated_client.post("/api/product-prices", json=price_data)
        
        # Get average price
        response = authenticated_client.get(f"/api/products/{self.product_id}/average-price")
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            expected_average = sum(prices) / len(prices)
            assert abs(float(data["data"]["average"]) - expected_average) < 0.01
    
    def test_price_comparison(self, authenticated_client: TestClient):
        """Test price comparison across stores."""
        # Create another product
        product2_response = authenticated_client.post("/api/products", json={
            "name": "Product 2",
            "unit": "шт",
            "category": "Test"
        })
        product2_id = product2_response.json()["data"]["id"]
        
        # Add prices for both products in different stores
        stores = ["Store A", "Store B"]
        for store in stores:
            for product_id, base_price in [(self.product_id, 100), (product2_id, 200)]:
                price_data = {
                    "product_id": product_id,
                    "price": base_price if store == "Store A" else base_price * 1.1,
                    "store": store,
                    "date": datetime.now().isoformat()
                }
                authenticated_client.post("/api/product-prices", json=price_data)
        
        # Compare prices
        response = authenticated_client.get("/api/product-prices/compare?store=Store A&store=Store B")
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            # Verify comparison data structure
            assert "data" in data
    
    def test_delete_price(self, authenticated_client: TestClient):
        """Test deleting a price entry."""
        # Add price
        price_data = {
            "product_id": self.product_id,
            "price": 99.99,
            "store": "Store",
            "date": datetime.now().isoformat()
        }
        price_response = authenticated_client.post("/api/product-prices", json=price_data)
        price_id = price_response.json()["data"]["id"]
        
        # Delete price
        response = authenticated_client.delete(f"/api/product-prices/{price_id}")
        assert response.status_code == status.HTTP_200_OK
        
        # Verify deleted
        response = authenticated_client.get(f"/api/product-prices/{price_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND