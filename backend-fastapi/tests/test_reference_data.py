"""
Tests for reference data endpoints (periods, nomenclatures, etc.).
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient


class TestPeriodEndpoints:
    """Test period CRUD operations."""
    
    def test_create_period(self, authenticated_client: TestClient, test_period_data):
        """Test creating a new period."""
        response = authenticated_client.post("/api/periods", json=test_period_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["period"] == test_period_data["period"]
        assert data["data"]["is_active"] == test_period_data["is_active"]
    
    def test_create_duplicate_period(self, authenticated_client: TestClient, test_period_data):
        """Test creating duplicate period."""
        # Create first
        authenticated_client.post("/api/periods", json=test_period_data)
        
        # Try to create duplicate
        response = authenticated_client.post("/api/periods", json=test_period_data)
        assert response.status_code == status.HTTP_409_CONFLICT
    
    def test_get_periods(self, authenticated_client: TestClient, test_period_data):
        """Test getting all periods."""
        # Create some periods
        for i in range(3):
            period_data = {
                "period": f"2025.0{i+1}",
                "is_active": i == 0
            }
            authenticated_client.post("/api/periods", json=period_data)
        
        # Get all periods
        response = authenticated_client.get("/api/periods")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) == 3
    
    def test_get_period_by_id(self, authenticated_client: TestClient, test_period_data):
        """Test getting period by ID."""
        # Create period
        create_response = authenticated_client.post("/api/periods", json=test_period_data)
        period_id = create_response.json()["data"]["id"]
        
        # Get by ID
        response = authenticated_client.get(f"/api/periods/{period_id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["id"] == period_id
        assert data["data"]["period"] == test_period_data["period"]
    
    def test_update_period(self, authenticated_client: TestClient, test_period_data):
        """Test updating a period."""
        # Create period
        create_response = authenticated_client.post("/api/periods", json=test_period_data)
        period_id = create_response.json()["data"]["id"]
        
        # Update
        update_data = {"is_active": False}
        response = authenticated_client.put(f"/api/periods/{period_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["is_active"] is False
    
    def test_delete_period(self, authenticated_client: TestClient, test_period_data):
        """Test deleting a period."""
        # Create period
        create_response = authenticated_client.post("/api/periods", json=test_period_data)
        period_id = create_response.json()["data"]["id"]
        
        # Delete
        response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert response.status_code == status.HTTP_200_OK
        
        # Verify deleted
        response = authenticated_client.get(f"/api/periods/{period_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_periods_isolation(self, client: TestClient):
        """Test that periods are isolated between users."""
        # Create two users
        user1_data = {
            "username": "user1",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1@example.com"
        }
        user2_data = {
            "username": "user2",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2@example.com"
        }
        
        # Register and login user1
        client.post("/api/auth/register", json=user1_data)
        response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_cookies = response.cookies
        
        # Create period as user1
        client.cookies = user1_cookies
        period_data = {"period": "2025.01", "is_active": True}
        client.post("/api/periods", json=period_data)
        
        # Register and login user2
        client.post("/api/auth/register", json=user2_data)
        response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_cookies = response.cookies
        
        # Get periods as user2 - should be empty
        client.cookies = user2_cookies
        response = client.get("/api/periods")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["data"]) == 0


class TestNomenclatureEndpoints:
    """Test nomenclature CRUD operations."""
    
    def test_create_nomenclature(self, authenticated_client: TestClient, test_nomenclature_data):
        """Test creating a nomenclature."""
        response = authenticated_client.post("/api/nomenclatures", json=test_nomenclature_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == test_nomenclature_data["code"]
        assert data["data"]["name"] == test_nomenclature_data["name"]
    
    def test_create_nomenclature_with_parent(self, authenticated_client: TestClient):
        """Test creating child nomenclature."""
        # Create parent
        parent_data = {
            "code": "001",
            "name": "Родительская категория"
        }
        parent_response = authenticated_client.post("/api/nomenclatures", json=parent_data)
        parent_id = parent_response.json()["data"]["id"]
        
        # Create child
        child_data = {
            "code": "001.001",
            "name": "Дочерняя категория",
            "parent_id": parent_id
        }
        response = authenticated_client.post("/api/nomenclatures", json=child_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["data"]["parent_id"] == parent_id
    
    def test_get_nomenclatures_tree(self, authenticated_client: TestClient):
        """Test getting nomenclatures in tree structure."""
        # Create parent and children
        parent_data = {"code": "001", "name": "Parent"}
        parent_response = authenticated_client.post("/api/nomenclatures", json=parent_data)
        parent_id = parent_response.json()["data"]["id"]
        
        for i in range(2):
            child_data = {
                "code": f"001.00{i+1}",
                "name": f"Child {i+1}",
                "parent_id": parent_id
            }
            authenticated_client.post("/api/nomenclatures", json=child_data)
        
        # Get tree
        response = authenticated_client.get("/api/nomenclatures")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["data"]) >= 3
    
    def test_update_nomenclature(self, authenticated_client: TestClient, test_nomenclature_data):
        """Test updating nomenclature."""
        # Create
        create_response = authenticated_client.post("/api/nomenclatures", json=test_nomenclature_data)
        nom_id = create_response.json()["data"]["id"]
        
        # Update
        update_data = {"name": "Обновленное название"}
        response = authenticated_client.put(f"/api/nomenclatures/{nom_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["data"]["name"] == update_data["name"]
    
    def test_delete_nomenclature_with_children(self, authenticated_client: TestClient):
        """Test that parent nomenclature can't be deleted if it has children."""
        # Create parent
        parent_data = {"code": "001", "name": "Parent"}
        parent_response = authenticated_client.post("/api/nomenclatures", json=parent_data)
        parent_id = parent_response.json()["data"]["id"]
        
        # Create child
        child_data = {
            "code": "001.001",
            "name": "Child",
            "parent_id": parent_id
        }
        authenticated_client.post("/api/nomenclatures", json=child_data)
        
        # Try to delete parent - should fail
        response = authenticated_client.delete(f"/api/nomenclatures/{parent_id}")
        assert response.status_code == status.HTTP_409_CONFLICT


class TestFinancialCenterEndpoints:
    """Test financial center CRUD operations."""
    
    def test_create_financial_center(self, authenticated_client: TestClient, test_financial_center_data):
        """Test creating financial center."""
        response = authenticated_client.post("/api/financial_centers", json=test_financial_center_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == test_financial_center_data["code"]
        assert data["data"]["name"] == test_financial_center_data["name"]
    
    def test_get_financial_centers(self, authenticated_client: TestClient):
        """Test getting all financial centers."""
        # Create multiple centers
        for i in range(3):
            data = {
                "code": f"FC00{i+1}",
                "name": f"Центр {i+1}"
            }
            authenticated_client.post("/api/financial_centers", json=data)
        
        # Get all
        response = authenticated_client.get("/api/financial_centers")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["data"]) == 3


class TestCostCenterEndpoints:
    """Test cost center CRUD operations."""
    
    def test_create_cost_center(self, authenticated_client: TestClient, test_cost_center_data):
        """Test creating cost center."""
        response = authenticated_client.post("/api/cost_centers", json=test_cost_center_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == test_cost_center_data["code"]
        assert data["data"]["name"] == test_cost_center_data["name"]
    
    def test_unique_code_per_user(self, authenticated_client: TestClient, test_cost_center_data):
        """Test that cost center codes must be unique per user."""
        # Create first
        authenticated_client.post("/api/cost_centers", json=test_cost_center_data)
        
        # Try to create with same code
        response = authenticated_client.post("/api/cost_centers", json=test_cost_center_data)
        assert response.status_code == status.HTTP_409_CONFLICT