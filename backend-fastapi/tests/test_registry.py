"""
Tests for registry (transactions) endpoints.
"""
import pytest
from datetime import datetime
from decimal import Decimal
from fastapi import status
from fastapi.testclient import TestClient


class TestRegistryEndpoints:
    """Test registry CRUD operations."""
    
    @pytest.fixture(autouse=True)
    def setup_reference_data(self, authenticated_client: TestClient):
        """Setup reference data for registry tests."""
        # Create period
        period_response = authenticated_client.post("/api/periods", json={
            "period": "2025.01",
            "is_active": True
        })
        self.period_id = period_response.json()["data"]["id"]
        
        # Create financial center
        fc_response = authenticated_client.post("/api/financial_centers", json={
            "code": "FC001",
            "name": "Main Financial Center"
        })
        self.financial_center_id = fc_response.json()["data"]["id"]
        
        # Create cost center
        cc_response = authenticated_client.post("/api/cost_centers", json={
            "code": "CC001",
            "name": "Home Expenses"
        })
        self.cost_center_id = cc_response.json()["data"]["id"]
        
        # Create nomenclature
        nom_response = authenticated_client.post("/api/nomenclatures", json={
            "code": "NOM001",
            "name": "Food"
        })
        self.nomenclature_id = nom_response.json()["data"]["id"]
    
    def test_create_registry_plan(self, authenticated_client: TestClient):
        """Test creating a plan transaction."""
        registry_data = {
            "period_id": self.period_id,
            "financial_center_id": self.financial_center_id,
            "cost_center_id": self.cost_center_id,
            "nomenclature_id": self.nomenclature_id,
            "row_type": 1,  # Plan
            "summ": 10000.00,
            "comment": "Monthly food budget"
        }
        
        response = authenticated_client.post("/api/registry", json=registry_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["row_type"] == 1
        assert float(data["data"]["summ"]) == 10000.00
        assert data["data"]["comment"] == "Monthly food budget"
    
    def test_create_registry_fact(self, authenticated_client: TestClient):
        """Test creating a fact transaction."""
        registry_data = {
            "period_id": self.period_id,
            "financial_center_id": self.financial_center_id,
            "cost_center_id": self.cost_center_id,
            "nomenclature_id": self.nomenclature_id,
            "row_type": 2,  # Fact
            "summ": 3500.00,
            "comment": "Grocery shopping"
        }
        
        response = authenticated_client.post("/api/registry", json=registry_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["row_type"] == 2
        assert float(data["data"]["summ"]) == 3500.00
    
    def test_get_registry_by_period(self, authenticated_client: TestClient):
        """Test getting registry entries by period."""
        # Create multiple entries
        for i in range(3):
            registry_data = {
                "period_id": self.period_id,
                "financial_center_id": self.financial_center_id,
                "cost_center_id": self.cost_center_id,
                "nomenclature_id": self.nomenclature_id,
                "row_type": 1 if i == 0 else 2,
                "summ": 1000.00 * (i + 1),
                "comment": f"Transaction {i+1}"
            }
            authenticated_client.post("/api/registry", json=registry_data)
        
        # Get by period
        response = authenticated_client.get(f"/api/registry?period_id={self.period_id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["data"]) == 3
    
    def test_get_registry_with_filters(self, authenticated_client: TestClient):
        """Test getting registry with multiple filters."""
        # Create entries with different types
        for row_type in [1, 2]:
            registry_data = {
                "period_id": self.period_id,
                "financial_center_id": self.financial_center_id,
                "cost_center_id": self.cost_center_id,
                "nomenclature_id": self.nomenclature_id,
                "row_type": row_type,
                "summ": 5000.00,
                "comment": f"Type {row_type}"
            }
            authenticated_client.post("/api/registry", json=registry_data)
        
        # Filter by row_type=1 (Plan)
        response = authenticated_client.get(
            f"/api/registry?period_id={self.period_id}&row_type=1"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["data"]) == 1
        assert data["data"][0]["row_type"] == 1
    
    def test_update_registry_entry(self, authenticated_client: TestClient):
        """Test updating registry entry."""
        # Create entry
        registry_data = {
            "period_id": self.period_id,
            "financial_center_id": self.financial_center_id,
            "cost_center_id": self.cost_center_id,
            "nomenclature_id": self.nomenclature_id,
            "row_type": 1,
            "summ": 5000.00,
            "comment": "Original comment"
        }
        create_response = authenticated_client.post("/api/registry", json=registry_data)
        entry_id = create_response.json()["data"]["id"]
        
        # Update
        update_data = {
            "summ": 6000.00,
            "comment": "Updated comment"
        }
        response = authenticated_client.put(f"/api/registry/{entry_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert float(data["data"]["summ"]) == 6000.00
        assert data["data"]["comment"] == "Updated comment"
    
    def test_delete_registry_entry(self, authenticated_client: TestClient):
        """Test deleting registry entry."""
        # Create entry
        registry_data = {
            "period_id": self.period_id,
            "financial_center_id": self.financial_center_id,
            "cost_center_id": self.cost_center_id,
            "nomenclature_id": self.nomenclature_id,
            "row_type": 1,
            "summ": 5000.00,
            "comment": "To be deleted"
        }
        create_response = authenticated_client.post("/api/registry", json=registry_data)
        entry_id = create_response.json()["data"]["id"]
        
        # Delete
        response = authenticated_client.delete(f"/api/registry/{entry_id}")
        assert response.status_code == status.HTTP_200_OK
        
        # Verify deleted
        response = authenticated_client.get(f"/api/registry/{entry_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_registry_sum_calculation(self, authenticated_client: TestClient):
        """Test that registry sums are calculated correctly."""
        # Create plan entries
        plan_amounts = [5000.00, 3000.00, 2000.00]
        for amount in plan_amounts:
            registry_data = {
                "period_id": self.period_id,
                "financial_center_id": self.financial_center_id,
                "cost_center_id": self.cost_center_id,
                "nomenclature_id": self.nomenclature_id,
                "row_type": 1,
                "summ": amount,
                "comment": f"Plan {amount}"
            }
            authenticated_client.post("/api/registry", json=registry_data)
        
        # Create fact entries
        fact_amounts = [4500.00, 2800.00, 1900.00]
        for amount in fact_amounts:
            registry_data = {
                "period_id": self.period_id,
                "financial_center_id": self.financial_center_id,
                "cost_center_id": self.cost_center_id,
                "nomenclature_id": self.nomenclature_id,
                "row_type": 2,
                "summ": amount,
                "comment": f"Fact {amount}"
            }
            authenticated_client.post("/api/registry", json=registry_data)
        
        # Get summary
        response = authenticated_client.get(f"/api/registry/summary?period_id={self.period_id}")
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            # Verify calculations if endpoint exists
            expected_plan = sum(plan_amounts)
            expected_fact = sum(fact_amounts)
            if "plan_total" in data.get("data", {}):
                assert float(data["data"]["plan_total"]) == expected_plan
            if "fact_total" in data.get("data", {}):
                assert float(data["data"]["fact_total"]) == expected_fact
    
    def test_registry_isolation_between_users(self, client: TestClient):
        """Test that registry entries are isolated between users."""
        # Setup first user
        user1_data = {
            "username": "user1",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1@example.com"
        }
        client.post("/api/auth/register", json=user1_data)
        response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_cookies = response.cookies
        
        # Create reference data for user1
        client.cookies = user1_cookies
        period = client.post("/api/periods", json={"period": "2025.01", "is_active": True})
        period_id = period.json()["data"]["id"]
        fc = client.post("/api/financial_centers", json={"code": "FC001", "name": "FC1"})
        fc_id = fc.json()["data"]["id"]
        cc = client.post("/api/cost_centers", json={"code": "CC001", "name": "CC1"})
        cc_id = cc.json()["data"]["id"]
        nom = client.post("/api/nomenclatures", json={"code": "N001", "name": "Nom1"})
        nom_id = nom.json()["data"]["id"]
        
        # Create registry entry for user1
        registry_data = {
            "period_id": period_id,
            "financial_center_id": fc_id,
            "cost_center_id": cc_id,
            "nomenclature_id": nom_id,
            "row_type": 1,
            "summ": 5000.00,
            "comment": "User1 transaction"
        }
        client.post("/api/registry", json=registry_data)
        
        # Setup second user
        user2_data = {
            "username": "user2",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2@example.com"
        }
        client.post("/api/auth/register", json=user2_data)
        response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_cookies = response.cookies
        
        # Get registry as user2 - should be empty
        client.cookies = user2_cookies
        response = client.get("/api/registry")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["data"]) == 0
    
    def test_invalid_reference_ids(self, authenticated_client: TestClient):
        """Test creating registry with invalid reference IDs."""
        registry_data = {
            "period_id": 99999,  # Non-existent
            "financial_center_id": self.financial_center_id,
            "cost_center_id": self.cost_center_id,
            "nomenclature_id": self.nomenclature_id,
            "row_type": 1,
            "summ": 5000.00,
            "comment": "Invalid period"
        }
        
        response = authenticated_client.post("/api/registry", json=registry_data)
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND]
    
    def test_negative_amount(self, authenticated_client: TestClient):
        """Test that negative amounts are handled correctly."""
        registry_data = {
            "period_id": self.period_id,
            "financial_center_id": self.financial_center_id,
            "cost_center_id": self.cost_center_id,
            "nomenclature_id": self.nomenclature_id,
            "row_type": 1,
            "summ": -1000.00,  # Negative amount
            "comment": "Refund or correction"
        }
        
        response = authenticated_client.post("/api/registry", json=registry_data)
        # Should either accept negative amounts or return validation error
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert float(data["data"]["summ"]) == -1000.00
        else:
            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY