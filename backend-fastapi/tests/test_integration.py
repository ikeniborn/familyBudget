"""
Integration tests for complete user workflows.
"""
import pytest
from datetime import datetime
from decimal import Decimal
from fastapi import status
from fastapi.testclient import TestClient


class TestCompleteUserWorkflow:
    """Test complete user workflow from registration to data management."""
    
    def test_complete_budget_management_flow(self, client: TestClient):
        """Test complete budget management workflow."""
        # Step 1: Register new user
        user_data = {
            "username": "budgetuser",
            "password": "SecurePass123!",
            "user_name": "Budget Manager",
            "email": "budget@example.com"
        }
        
        register_response = client.post("/api/auth/register", json=user_data)
        assert register_response.status_code == status.HTTP_200_OK
        
        # Step 2: Login
        login_response = client.post("/api/auth/login", json={
            "username": user_data["username"],
            "password": user_data["password"]
        })
        assert login_response.status_code == status.HTTP_200_OK
        cookies = login_response.cookies
        client.cookies = cookies
        
        # Step 3: Create period
        period_response = client.post("/api/periods", json={
            "period": "2025.01",
            "is_active": True
        })
        assert period_response.status_code == status.HTTP_200_OK
        period_id = period_response.json()["data"]["id"]
        
        # Step 4: Create financial center
        fc_response = client.post("/api/financial_centers", json={
            "code": "FC001",
            "name": "Family Budget"
        })
        assert fc_response.status_code == status.HTTP_200_OK
        fc_id = fc_response.json()["data"]["id"]
        
        # Step 5: Create cost center
        cc_response = client.post("/api/cost_centers", json={
            "code": "CC001",
            "name": "Household"
        })
        assert cc_response.status_code == status.HTTP_200_OK
        cc_id = cc_response.json()["data"]["id"]
        
        # Step 6: Create nomenclature hierarchy
        parent_nom_response = client.post("/api/nomenclatures", json={
            "code": "01",
            "name": "Living Expenses"
        })
        assert parent_nom_response.status_code == status.HTTP_200_OK
        parent_nom_id = parent_nom_response.json()["data"]["id"]
        
        child_nom_response = client.post("/api/nomenclatures", json={
            "code": "01.01",
            "name": "Food",
            "parent_id": parent_nom_id
        })
        assert child_nom_response.status_code == status.HTTP_200_OK
        child_nom_id = child_nom_response.json()["data"]["id"]
        
        # Step 7: Create plan entries
        plan_entry = {
            "period_id": period_id,
            "financial_center_id": fc_id,
            "cost_center_id": cc_id,
            "nomenclature_id": child_nom_id,
            "row_type": 1,  # Plan
            "summ": 20000.00,
            "comment": "Monthly food budget"
        }
        plan_response = client.post("/api/registry", json=plan_entry)
        assert plan_response.status_code == status.HTTP_200_OK
        
        # Step 8: Create fact entries
        fact_entry = {
            "period_id": period_id,
            "financial_center_id": fc_id,
            "cost_center_id": cc_id,
            "nomenclature_id": child_nom_id,
            "row_type": 2,  # Fact
            "summ": 5500.00,
            "comment": "Grocery shopping week 1"
        }
        fact_response = client.post("/api/registry", json=fact_entry)
        assert fact_response.status_code == status.HTTP_200_OK
        
        # Step 9: Get budget summary report
        report_response = client.get(f"/api/reports/budget-summary?period_id={period_id}")
        assert report_response.status_code == status.HTTP_200_OK
        report_data = report_response.json()["data"]["summary"]
        
        # Verify calculations
        assert float(report_data["total_plan"]) == 20000.00
        assert float(report_data["total_fact"]) == 5500.00
        assert float(report_data["deviation"]) == -14500.00
        
        # Step 10: Verify data isolation (logout and try to access)
        logout_response = client.post("/api/auth/logout")
        assert logout_response.status_code == status.HTTP_200_OK
        
        # Should not be able to access data after logout
        unauthorized_response = client.get(f"/api/registry?period_id={period_id}")
        assert unauthorized_response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_product_management_workflow(self, client: TestClient):
        """Test complete product management workflow."""
        # Setup authenticated session
        user_data = {
            "username": "productuser",
            "password": "SecurePass123!",
            "user_name": "Product Manager",
            "email": "products@example.com"
        }
        
        client.post("/api/auth/register", json=user_data)
        login_response = client.post("/api/auth/login", json={
            "username": user_data["username"],
            "password": user_data["password"]
        })
        client.cookies = login_response.cookies
        
        # Create products
        products = [
            {
                "name": "Milk 2.5%",
                "unit": "л",
                "category": "Dairy",
                "barcode": "4607001234567"
            },
            {
                "name": "Bread",
                "unit": "шт",
                "category": "Bakery",
                "barcode": "4607001234568"
            }
        ]
        
        product_ids = []
        for product_data in products:
            response = client.post("/api/products", json=product_data)
            assert response.status_code == status.HTTP_200_OK
            product_ids.append(response.json()["data"]["id"])
        
        # Add prices
        for product_id in product_ids:
            price_data = {
                "product_id": product_id,
                "price": 85.50 + product_id * 10,
                "store": "Supermarket",
                "date": datetime.now().isoformat()
            }
            price_response = client.post("/api/product-prices", json=price_data)
            assert price_response.status_code == status.HTTP_200_OK
        
        # Search products
        search_response = client.get("/api/products?search=Milk")
        assert search_response.status_code == status.HTTP_200_OK
        search_results = search_response.json()["data"]
        assert len(search_results) == 1
        assert search_results[0]["name"] == "Milk 2.5%"
        
        # Get product by barcode
        barcode_response = client.get("/api/products/barcode/4607001234567")
        assert barcode_response.status_code == status.HTTP_200_OK
        assert barcode_response.json()["data"]["name"] == "Milk 2.5%"
        
        # Get price history
        price_history_response = client.get(f"/api/product-prices/product/{product_ids[0]}")
        assert price_history_response.status_code == status.HTTP_200_OK
        price_history = price_history_response.json()["data"]
        assert len(price_history) > 0
    
    def test_multi_user_data_isolation(self, client: TestClient):
        """Test that data is properly isolated between users."""
        # Create first user
        user1 = {
            "username": "user1",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1@example.com"
        }
        client.post("/api/auth/register", json=user1)
        
        # Login as user1 and create data
        login1 = client.post("/api/auth/login", json={
            "username": user1["username"],
            "password": user1["password"]
        })
        user1_cookies = login1.cookies
        client.cookies = user1_cookies
        
        # Create period for user1
        period1 = client.post("/api/periods", json={
            "period": "2025.01",
            "is_active": True
        })
        user1_period_id = period1.json()["data"]["id"]
        
        # Create financial center for user1
        fc1 = client.post("/api/financial_centers", json={
            "code": "FC001",
            "name": "User1 FC"
        })
        user1_fc_id = fc1.json()["data"]["id"]
        
        # Logout user1
        client.post("/api/auth/logout")
        
        # Create second user
        user2 = {
            "username": "user2",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2@example.com"
        }
        client.post("/api/auth/register", json=user2)
        
        # Login as user2
        login2 = client.post("/api/auth/login", json={
            "username": user2["username"],
            "password": user2["password"]
        })
        user2_cookies = login2.cookies
        client.cookies = user2_cookies
        
        # User2 should not see user1's periods
        periods_response = client.get("/api/periods")
        assert periods_response.status_code == status.HTTP_200_OK
        user2_periods = periods_response.json()["data"]
        assert len(user2_periods) == 0
        
        # User2 should not see user1's financial centers
        fc_response = client.get("/api/financial_centers")
        assert fc_response.status_code == status.HTTP_200_OK
        user2_fcs = fc_response.json()["data"]
        assert len(user2_fcs) == 0
        
        # User2 should not be able to access user1's specific data
        user1_period_response = client.get(f"/api/periods/{user1_period_id}")
        assert user1_period_response.status_code == status.HTTP_404_NOT_FOUND
        
        user1_fc_response = client.get(f"/api/financial_centers/{user1_fc_id}")
        assert user1_fc_response.status_code == status.HTTP_404_NOT_FOUND
        
        # Create data for user2
        period2 = client.post("/api/periods", json={
            "period": "2025.02",
            "is_active": True
        })
        assert period2.status_code == status.HTTP_200_OK
        
        # Switch back to user1
        client.cookies = user1_cookies
        
        # User1 should still see only their data
        periods_response = client.get("/api/periods")
        assert periods_response.status_code == status.HTTP_200_OK
        user1_periods = periods_response.json()["data"]
        assert len(user1_periods) == 1
        assert user1_periods[0]["period"] == "2025.01"
    
    def test_cascade_operations(self, authenticated_client: TestClient):
        """Test cascade delete and update operations."""
        # Create nomenclature hierarchy
        parent = authenticated_client.post("/api/nomenclatures", json={
            "code": "01",
            "name": "Parent Category"
        })
        parent_id = parent.json()["data"]["id"]
        
        child1 = authenticated_client.post("/api/nomenclatures", json={
            "code": "01.01",
            "name": "Child 1",
            "parent_id": parent_id
        })
        child1_id = child1.json()["data"]["id"]
        
        child2 = authenticated_client.post("/api/nomenclatures", json={
            "code": "01.02",
            "name": "Child 2",
            "parent_id": parent_id
        })
        child2_id = child2.json()["data"]["id"]
        
        # Try to delete parent with children - should fail
        delete_response = authenticated_client.delete(f"/api/nomenclatures/{parent_id}")
        assert delete_response.status_code == status.HTTP_409_CONFLICT
        
        # Delete children first
        authenticated_client.delete(f"/api/nomenclatures/{child1_id}")
        authenticated_client.delete(f"/api/nomenclatures/{child2_id}")
        
        # Now parent can be deleted
        delete_response = authenticated_client.delete(f"/api/nomenclatures/{parent_id}")
        assert delete_response.status_code == status.HTTP_200_OK
    
    def test_concurrent_user_sessions(self, client: TestClient):
        """Test handling of concurrent user sessions."""
        # Create user
        user_data = {
            "username": "concurrentuser",
            "password": "Password123!",
            "user_name": "Concurrent User",
            "email": "concurrent@example.com"
        }
        client.post("/api/auth/register", json=user_data)
        
        # Create two login sessions
        login1 = client.post("/api/auth/login", json={
            "username": user_data["username"],
            "password": user_data["password"]
        })
        session1_cookies = login1.cookies
        
        login2 = client.post("/api/auth/login", json={
            "username": user_data["username"],
            "password": user_data["password"]
        })
        session2_cookies = login2.cookies
        
        # Both sessions should work
        client.cookies = session1_cookies
        me1 = client.get("/api/auth/me")
        assert me1.status_code == status.HTTP_200_OK
        
        client.cookies = session2_cookies
        me2 = client.get("/api/auth/me")
        assert me2.status_code == status.HTTP_200_OK
        
        # Logout from session1
        client.cookies = session1_cookies
        client.post("/api/auth/logout")
        
        # Session1 should be invalid
        me1_after = client.get("/api/auth/me")
        assert me1_after.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Session2 should still work
        client.cookies = session2_cookies
        me2_after = client.get("/api/auth/me")
        assert me2_after.status_code == status.HTTP_200_OK