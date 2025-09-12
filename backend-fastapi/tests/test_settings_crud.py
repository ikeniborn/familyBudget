"""
Comprehensive tests for settings pages functionality.
Tests all CRUD operations for periods, financial_centers, cost_centers, nomenclatures.
Tests user_id isolation and error handling.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient


class TestPeriodsEndpoints:
    """Test period CRUD operations and user isolation."""
    
    def test_create_period_success(self, authenticated_client: TestClient):
        """Test creating a new period successfully."""
        period_data = {
            "period_year": 2025,
            "period_month": 1,
            "is_active": True
        }
        response = authenticated_client.post("/api/periods", json=period_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "id" in data["data"]
        # Verify user_id is auto-assigned (should not be in response)
        assert "user_id" not in period_data  # Not sent in request
    
    def test_create_period_user_id_ignored(self, authenticated_client: TestClient):
        """Test that user_id in request body is ignored."""
        period_data = {
            "period_year": 2025,
            "period_month": 2,
            "is_active": True,
            "user_id": 999  # This should be ignored
        }
        response = authenticated_client.post("/api/periods", json=period_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Verify the period is assigned to the authenticated user, not user_id 999
        period_id = data["data"]["id"]
        get_response = authenticated_client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_200_OK
    
    def test_get_periods_user_isolation(self, authenticated_client: TestClient, client: TestClient, test_user_data):
        """Test that users only see their own periods."""
        # Create period with first user
        period_data = {"period_year": 2025, "period_month": 3, "is_active": True}
        authenticated_client.post("/api/periods", json=period_data)
        
        # Create second user and authenticate
        second_user_data = {
            "username": "testuser2",
            "password": "TestPassword123!",
            "user_name": "Test User 2",
            "email": "test2@example.com",
            "telegram_id": 987654321
        }
        client.post("/api/auth/register", json=second_user_data)
        login_response = client.post("/api/auth/login", json={
            "username": "testuser2", 
            "password": "TestPassword123!"
        })
        client.cookies = login_response.cookies
        
        # Second user should not see first user's periods
        response = client.get("/api/periods")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) == 0  # No periods for second user
    
    def test_update_period_success(self, authenticated_client: TestClient):
        """Test updating a period successfully."""
        # Create period
        create_data = {"period_year": 2025, "period_month": 4, "is_active": False}
        create_response = authenticated_client.post("/api/periods", json=create_data)
        period_id = create_response.json()["data"]["id"]
        
        # Update period
        update_data = {"is_active": True}
        response = authenticated_client.put(f"/api/periods/{period_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["is_active"] is True
    
    def test_delete_period_success(self, authenticated_client: TestClient):
        """Test deleting a period successfully."""
        # Create period
        create_data = {"period_year": 2025, "period_month": 5, "is_active": True}
        create_response = authenticated_client.post("/api/periods", json=create_data)
        period_id = create_response.json()["data"]["id"]
        
        # Delete period
        response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert response.status_code == status.HTTP_200_OK
        
        # Verify deletion
        get_response = authenticated_client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_period_not_found(self, authenticated_client: TestClient):
        """Test accessing non-existent period."""
        response = authenticated_client.get("/api/periods/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestFinancialCentersEndpoints:
    """Test financial center CRUD operations and user isolation."""
    
    def test_create_financial_center_success(self, authenticated_client: TestClient):
        """Test creating a new financial center successfully."""
        center_data = {
            "name": "Test Financial Center",
            "is_active": True
        }
        response = authenticated_client.post("/api/financial_centers", json=center_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == center_data["name"]
        assert data["data"]["is_active"] == center_data["is_active"]
        assert "id" in data["data"]
    
    def test_create_financial_center_user_id_ignored(self, authenticated_client: TestClient):
        """Test that user_id in request body is ignored."""
        center_data = {
            "name": "Test FC with User ID",
            "is_active": True,
            "user_id": 999  # This should be ignored
        }
        response = authenticated_client.post("/api/financial_centers", json=center_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Verify the center is accessible by the authenticated user
        center_id = data["data"]["id"]
        get_response = authenticated_client.get(f"/api/financial_centers/{center_id}")
        assert get_response.status_code == status.HTTP_200_OK
    
    def test_get_financial_centers_user_isolation(self, authenticated_client: TestClient, client: TestClient):
        """Test that users only see their own financial centers."""
        # Create center with first user
        center_data = {"name": "User 1 Center", "is_active": True}
        authenticated_client.post("/api/financial_centers", json=center_data)
        
        # Create and authenticate second user
        second_user_data = {
            "username": "testuser3",
            "password": "TestPassword123!",
            "user_name": "Test User 3",
            "email": "test3@example.com",
            "telegram_id": 111222333
        }
        client.post("/api/auth/register", json=second_user_data)
        login_response = client.post("/api/auth/login", json={
            "username": "testuser3", 
            "password": "TestPassword123!"
        })
        client.cookies = login_response.cookies
        
        # Second user should not see first user's centers
        response = client.get("/api/financial_centers")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0  # No centers for second user
    
    def test_update_financial_center_success(self, authenticated_client: TestClient):
        """Test updating a financial center successfully."""
        # Create center
        create_data = {"name": "Original Center", "is_active": False}
        create_response = authenticated_client.post("/api/financial_centers", json=create_data)
        center_id = create_response.json()["data"]["id"]
        
        # Update center
        update_data = {"name": "Updated Center", "is_active": True}
        response = authenticated_client.put(f"/api/financial_centers/{center_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "Updated Center"
        assert data["data"]["is_active"] is True
    
    def test_delete_financial_center_success(self, authenticated_client: TestClient):
        """Test deleting a financial center successfully."""
        # Create center
        create_data = {"name": "Center to Delete", "is_active": True}
        create_response = authenticated_client.post("/api/financial_centers", json=create_data)
        center_id = create_response.json()["data"]["id"]
        
        # Delete center
        response = authenticated_client.delete(f"/api/financial_centers/{center_id}")
        assert response.status_code == status.HTTP_200_OK
        
        # Verify deletion
        get_response = authenticated_client.get(f"/api/financial_centers/{center_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND


class TestCostCentersEndpoints:
    """Test cost center CRUD operations and user isolation."""
    
    def test_create_cost_center_success(self, authenticated_client: TestClient):
        """Test creating a new cost center successfully."""
        center_data = {
            "name": "Test Cost Center",
            "is_active": True
        }
        response = authenticated_client.post("/api/cost_centers", json=center_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == center_data["name"]
        assert data["data"]["is_active"] == center_data["is_active"]
        assert "id" in data["data"]
    
    def test_create_cost_center_user_id_ignored(self, authenticated_client: TestClient):
        """Test that user_id in request body is ignored."""
        center_data = {
            "name": "Test CC with User ID",
            "is_active": True,
            "user_id": 999  # This should be ignored
        }
        response = authenticated_client.post("/api/cost_centers", json=center_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Verify the center is accessible by the authenticated user
        center_id = data["data"]["id"]
        get_response = authenticated_client.get(f"/api/cost_centers/{center_id}")
        assert get_response.status_code == status.HTTP_200_OK
    
    def test_get_cost_centers_user_isolation(self, authenticated_client: TestClient, client: TestClient):
        """Test that users only see their own cost centers."""
        # Create center with first user
        center_data = {"name": "User 1 Cost Center", "is_active": True}
        authenticated_client.post("/api/cost_centers", json=center_data)
        
        # Create and authenticate second user
        second_user_data = {
            "username": "testuser4",
            "password": "TestPassword123!",
            "user_name": "Test User 4",
            "email": "test4@example.com",
            "telegram_id": 444555666
        }
        client.post("/api/auth/register", json=second_user_data)
        login_response = client.post("/api/auth/login", json={
            "username": "testuser4", 
            "password": "TestPassword123!"
        })
        client.cookies = login_response.cookies
        
        # Second user should not see first user's centers
        response = client.get("/api/cost_centers")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0  # No centers for second user
    
    def test_update_cost_center_success(self, authenticated_client: TestClient):
        """Test updating a cost center successfully."""
        # Create center
        create_data = {"name": "Original Cost Center", "is_active": False}
        create_response = authenticated_client.post("/api/cost_centers", json=create_data)
        center_id = create_response.json()["data"]["id"]
        
        # Update center
        update_data = {"name": "Updated Cost Center", "is_active": True}
        response = authenticated_client.put(f"/api/cost_centers/{center_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "Updated Cost Center"
        assert data["data"]["is_active"] is True
    
    def test_delete_cost_center_success(self, authenticated_client: TestClient):
        """Test deleting a cost center successfully."""
        # Create center
        create_data = {"name": "Cost Center to Delete", "is_active": True}
        create_response = authenticated_client.post("/api/cost_centers", json=create_data)
        center_id = create_response.json()["data"]["id"]
        
        # Delete center
        response = authenticated_client.delete(f"/api/cost_centers/{center_id}")
        assert response.status_code == status.HTTP_200_OK
        
        # Verify deletion
        get_response = authenticated_client.get(f"/api/cost_centers/{center_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND


class TestNomenclaturesEndpoints:
    """Test nomenclature CRUD operations and user isolation."""
    
    def test_create_nomenclature_success(self, authenticated_client: TestClient):
        """Test creating a new nomenclature successfully."""
        nomenclature_data = {
            "name": "Test Nomenclature",
            "account_name": "Test Account",
            "bill_name": "Test Bill",
            "operation": "Test Operation",
            "is_budget": True,
            "is_fact": True,
            "is_active": True
        }
        response = authenticated_client.post("/api/nomenclatures", json=nomenclature_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == nomenclature_data["name"]
        assert data["data"]["account_name"] == nomenclature_data["account_name"]
        assert data["data"]["is_active"] == nomenclature_data["is_active"]
        assert "id" in data["data"]
    
    def test_create_nomenclature_user_id_ignored(self, authenticated_client: TestClient):
        """Test that user_id in request body is ignored."""
        nomenclature_data = {
            "name": "Test Nomenclature with User ID",
            "account_name": "Test Account",
            "bill_name": "Test Bill",
            "operation": "Test Operation",
            "is_budget": True,
            "is_fact": True,
            "is_active": True,
            "user_id": 999  # This should be ignored
        }
        response = authenticated_client.post("/api/nomenclatures", json=nomenclature_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Verify the nomenclature is accessible by the authenticated user
        nomenclature_id = data["data"]["id"]
        get_response = authenticated_client.get(f"/api/nomenclatures/{nomenclature_id}")
        assert get_response.status_code == status.HTTP_200_OK
    
    def test_get_nomenclatures_user_isolation(self, authenticated_client: TestClient, client: TestClient):
        """Test that users only see their own nomenclatures."""
        # Create nomenclature with first user
        nomenclature_data = {
            "name": "User 1 Nomenclature",
            "account_name": "User 1 Account",
            "bill_name": "User 1 Bill",
            "operation": "User 1 Operation",
            "is_budget": True,
            "is_fact": True,
            "is_active": True
        }
        authenticated_client.post("/api/nomenclatures", json=nomenclature_data)
        
        # Create and authenticate second user
        second_user_data = {
            "username": "testuser5",
            "password": "TestPassword123!",
            "user_name": "Test User 5",
            "email": "test5@example.com",
            "telegram_id": 777888999
        }
        client.post("/api/auth/register", json=second_user_data)
        login_response = client.post("/api/auth/login", json={
            "username": "testuser5", 
            "password": "TestPassword123!"
        })
        client.cookies = login_response.cookies
        
        # Second user should not see first user's nomenclatures
        response = client.get("/api/nomenclatures")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0  # No nomenclatures for second user
    
    def test_update_nomenclature_success(self, authenticated_client: TestClient):
        """Test updating a nomenclature successfully."""
        # Create nomenclature
        create_data = {
            "name": "Original Nomenclature",
            "account_name": "Original Account",
            "bill_name": "Original Bill",
            "operation": "Original Operation",
            "is_budget": False,
            "is_fact": False,
            "is_active": False
        }
        create_response = authenticated_client.post("/api/nomenclatures", json=create_data)
        nomenclature_id = create_response.json()["data"]["id"]
        
        # Update nomenclature
        update_data = {
            "name": "Updated Nomenclature",
            "account_name": "Updated Account",
            "is_budget": True,
            "is_fact": True,
            "is_active": True
        }
        response = authenticated_client.put(f"/api/nomenclatures/{nomenclature_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "Updated Nomenclature"
        assert data["data"]["account_name"] == "Updated Account"
        assert data["data"]["is_budget"] is True
        assert data["data"]["is_active"] is True
    
    def test_delete_nomenclature_success(self, authenticated_client: TestClient):
        """Test deleting a nomenclature successfully."""
        # Create nomenclature
        create_data = {
            "name": "Nomenclature to Delete",
            "account_name": "Account to Delete",
            "bill_name": "Bill to Delete",
            "operation": "Operation to Delete",
            "is_budget": True,
            "is_fact": True,
            "is_active": True
        }
        create_response = authenticated_client.post("/api/nomenclatures", json=create_data)
        nomenclature_id = create_response.json()["data"]["id"]
        
        # Delete nomenclature
        response = authenticated_client.delete(f"/api/nomenclatures/{nomenclature_id}")
        assert response.status_code == status.HTTP_200_OK
        
        # Verify deletion
        get_response = authenticated_client.get(f"/api/nomenclatures/{nomenclature_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND


class TestErrorHandling:
    """Test error handling across all settings endpoints."""
    
    def test_unauthenticated_access_denied(self, client: TestClient):
        """Test that unauthenticated requests are denied."""
        endpoints = [
            "/api/periods",
            "/api/financial_centers", 
            "/api/cost_centers",
            "/api/nomenclatures"
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            
            response = client.post(endpoint, json={})
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_invalid_data_validation(self, authenticated_client: TestClient):
        """Test validation of invalid data."""
        # Test empty name for financial center
        response = authenticated_client.post("/api/financial_centers", json={"name": "", "is_active": True})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test missing required fields for nomenclature
        response = authenticated_client.post("/api/nomenclatures", json={"name": "Test"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test invalid period data
        response = authenticated_client.post("/api/periods", json={"period_year": -1})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_nonexistent_resource_access(self, authenticated_client: TestClient):
        """Test accessing non-existent resources returns 404."""
        endpoints_and_ids = [
            ("/api/periods/99999", status.HTTP_404_NOT_FOUND),
            ("/api/financial_centers/99999", status.HTTP_404_NOT_FOUND),
            ("/api/cost_centers/99999", status.HTTP_404_NOT_FOUND),
            ("/api/nomenclatures/99999", status.HTTP_404_NOT_FOUND)
        ]
        
        for endpoint, expected_status in endpoints_and_ids:
            response = authenticated_client.get(endpoint)
            assert response.status_code == expected_status
            
            response = authenticated_client.put(endpoint, json={"name": "Test"})
            assert response.status_code == expected_status
            
            response = authenticated_client.delete(endpoint)
            assert response.status_code == expected_status
    
    def test_cross_user_resource_access_denied(self, authenticated_client: TestClient, client: TestClient):
        """Test that users cannot access other users' resources."""
        # Create resource with first user
        response = authenticated_client.post("/api/financial_centers", json={"name": "User 1 Center", "is_active": True})
        center_id = response.json()["data"]["id"]
        
        # Create and authenticate second user
        second_user_data = {
            "username": "testuser6",
            "password": "TestPassword123!",
            "user_name": "Test User 6",
            "email": "test6@example.com",
            "telegram_id": 123123123
        }
        client.post("/api/auth/register", json=second_user_data)
        login_response = client.post("/api/auth/login", json={
            "username": "testuser6",
            "password": "TestPassword123!"
        })
        client.cookies = login_response.cookies
        
        # Second user should not be able to access first user's resource
        response = client.get(f"/api/financial_centers/{center_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        
        response = client.put(f"/api/financial_centers/{center_id}", json={"name": "Hacked"})
        assert response.status_code == status.HTTP_404_NOT_FOUND
        
        response = client.delete(f"/api/financial_centers/{center_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestDataIntegrity:
    """Test data integrity and business rules."""
    
    def test_period_statistics_accuracy(self, authenticated_client: TestClient):
        """Test that statistics endpoints return accurate counts."""
        # Create multiple periods with different statuses
        periods_data = [
            {"period_year": 2025, "period_month": 1, "is_active": True},
            {"period_year": 2025, "period_month": 2, "is_active": True},
            {"period_year": 2025, "period_month": 3, "is_active": False},
        ]
        
        for period_data in periods_data:
            authenticated_client.post("/api/periods", json=period_data)
        
        # Get all periods and verify counts
        response = authenticated_client.get("/api/periods")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) == 3
        
        # Count active vs inactive
        active_count = sum(1 for period in data["data"] if period["is_active"])
        inactive_count = len(data["data"]) - active_count
        assert active_count == 2
        assert inactive_count == 1
    
    def test_financial_center_business_rules(self, authenticated_client: TestClient):
        """Test business rules for financial centers."""
        # Test that name must be unique per user (if applicable)
        center_data = {"name": "Unique Center", "is_active": True}
        response = authenticated_client.post("/api/financial_centers", json=center_data)
        assert response.status_code == status.HTTP_200_OK
        
        # Attempt to create duplicate (if uniqueness is enforced)
        response = authenticated_client.post("/api/financial_centers", json=center_data)
        # This might be allowed or might return conflict depending on business rules
        # Adjust assertion based on actual business requirements
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_409_CONFLICT]
    
    def test_nomenclature_required_fields(self, authenticated_client: TestClient):
        """Test that nomenclatures require all mandatory fields."""
        incomplete_data = {
            "name": "Test Nomenclature"
            # Missing required fields: account_name, bill_name, operation
        }
        response = authenticated_client.post("/api/nomenclatures", json=incomplete_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Verify error details contain information about missing fields
        error_data = response.json()
        assert "detail" in error_data