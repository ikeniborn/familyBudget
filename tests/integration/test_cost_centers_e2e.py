"""
Integration tests for cost center creation fix - End-to-End flow.
Tests the complete flow from API request through database operations.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from fastapi import status

from app.models.cost_center import CostCenter
from app.db.database import get_db


class TestCostCenterE2EFlow:
    """Test end-to-end flow for cost center operations with code field fix."""

    def test_complete_cost_center_creation_flow(self, authenticated_client: TestClient):
        """Test complete cost center creation flow from API to database."""
        # Step 1: Create cost center via API with all required fields
        center_data = {
            "code": "E2E_TEST",
            "name": "End-to-End Test Center",
            "description": "Integration test cost center",
            "is_active": True
        }

        # Make API request
        response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response.status_code == status.HTTP_200_OK

        # Step 2: Verify API response structure
        data = response.json()
        assert data["code"] == center_data["code"]
        assert data["name"] == center_data["name"]
        assert data["description"] == center_data["description"]
        assert data["is_active"] is True
        assert "id" in data
        assert "user_id" in data

        created_id = data["id"]

        # Step 3: Verify data was persisted to database
        # Get database session
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            # Query database directly
            db_center = db.query(CostCenter).filter(CostCenter.id == created_id).first()
            assert db_center is not None
            assert db_center.code == center_data["code"]
            assert db_center.name == center_data["name"]
            assert db_center.description == center_data["description"]
            assert db_center.is_active is True
        finally:
            db.close()

        # Step 4: Verify data can be retrieved via API
        get_response = authenticated_client.get(f"/api/cost_centers/{created_id}")
        assert get_response.status_code == status.HTTP_200_OK

        retrieved_data = get_response.json()
        assert retrieved_data["id"] == created_id
        assert retrieved_data["code"] == center_data["code"]
        assert retrieved_data["name"] == center_data["name"]

        # Step 5: Verify data appears in list endpoint
        list_response = authenticated_client.get("/api/cost_centers/")
        assert list_response.status_code == status.HTTP_200_OK

        centers_list = list_response.json()
        created_center_in_list = None
        for center in centers_list:
            if center["id"] == created_id:
                created_center_in_list = center
                break

        assert created_center_in_list is not None
        assert created_center_in_list["code"] == center_data["code"]
        assert created_center_in_list["name"] == center_data["name"]

    def test_cost_center_missing_code_field_e2e_error(self, authenticated_client: TestClient):
        """Test end-to-end error handling when code field is missing."""
        # Attempt to create cost center without required code field
        center_data = {
            "name": "Missing Code Test",
            "description": "This should fail due to missing code",
            "is_active": True
            # Missing required 'code' field
        }

        # Step 1: API should reject the request
        response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        error_data = response.json()
        assert "detail" in error_data

        # Step 2: Verify no data was created in database
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            # Check that no cost center with this name exists
            db_center = db.query(CostCenter).filter(
                CostCenter.name == center_data["name"]
            ).first()
            assert db_center is None
        finally:
            db.close()

        # Step 3: Verify cost center doesn't appear in list
        list_response = authenticated_client.get("/api/cost_centers/")
        assert list_response.status_code == status.HTTP_200_OK

        centers_list = list_response.json()
        for center in centers_list:
            assert center["name"] != center_data["name"]

    def test_cost_center_duplicate_code_e2e_flow(self, authenticated_client: TestClient):
        """Test end-to-end flow for duplicate code handling."""
        # Step 1: Create first cost center successfully
        center_data_1 = {
            "code": "DUPLICATE_E2E",
            "name": "First Center",
            "description": "First cost center",
            "is_active": True
        }

        response1 = authenticated_client.post("/api/cost_centers/", json=center_data_1)
        assert response1.status_code == status.HTTP_200_OK
        center1_id = response1.json()["id"]

        # Step 2: Verify first center is in database
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            db_center1 = db.query(CostCenter).filter(CostCenter.id == center1_id).first()
            assert db_center1 is not None
            assert db_center1.code == "DUPLICATE_E2E"
        finally:
            db.close()

        # Step 3: Attempt to create second center with duplicate code
        center_data_2 = {
            "code": "DUPLICATE_E2E",  # Same code
            "name": "Second Center",
            "description": "Duplicate code center",
            "is_active": True
        }

        response2 = authenticated_client.post("/api/cost_centers/", json=center_data_2)
        assert response2.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_409_CONFLICT
        ]

        # Step 4: Verify second center was not created in database
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            # Should still be only one center with this code
            duplicate_centers = db.query(CostCenter).filter(
                CostCenter.code == "DUPLICATE_E2E"
            ).all()
            assert len(duplicate_centers) == 1
            assert duplicate_centers[0].name == "First Center"
        finally:
            db.close()

        # Step 5: Verify only first center appears in API list
        list_response = authenticated_client.get("/api/cost_centers/")
        assert list_response.status_code == status.HTTP_200_OK

        centers_with_code = [
            center for center in list_response.json()
            if center["code"] == "DUPLICATE_E2E"
        ]
        assert len(centers_with_code) == 1
        assert centers_with_code[0]["name"] == "First Center"

    def test_cost_center_update_with_code_e2e_flow(self, authenticated_client: TestClient):
        """Test end-to-end flow for updating cost center with code field."""
        # Step 1: Create initial cost center
        initial_data = {
            "code": "UPDATE_E2E_ORIG",
            "name": "Original Name",
            "description": "Original description",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/cost_centers/", json=initial_data)
        assert create_response.status_code == status.HTTP_200_OK
        center_id = create_response.json()["id"]

        # Step 2: Update the cost center including code field
        update_data = {
            "code": "UPDATE_E2E_NEW",
            "name": "Updated Name",
            "description": "Updated description",
            "is_active": False
        }

        update_response = authenticated_client.put(f"/api/cost_centers/{center_id}", json=update_data)
        assert update_response.status_code == status.HTTP_200_OK

        updated_data = update_response.json()
        assert updated_data["code"] == update_data["code"]
        assert updated_data["name"] == update_data["name"]
        assert updated_data["description"] == update_data["description"]
        assert updated_data["is_active"] is False

        # Step 3: Verify changes persisted to database
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            db_center = db.query(CostCenter).filter(CostCenter.id == center_id).first()
            assert db_center is not None
            assert db_center.code == update_data["code"]
            assert db_center.name == update_data["name"]
            assert db_center.description == update_data["description"]
            assert db_center.is_active is False
        finally:
            db.close()

        # Step 4: Verify updated data via GET API
        get_response = authenticated_client.get(f"/api/cost_centers/{center_id}")
        assert get_response.status_code == status.HTTP_200_OK

        retrieved_data = get_response.json()
        assert retrieved_data["code"] == update_data["code"]
        assert retrieved_data["name"] == update_data["name"]

        # Step 5: Verify old code no longer exists in database
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            old_code_center = db.query(CostCenter).filter(
                CostCenter.code == initial_data["code"]
            ).first()
            assert old_code_center is None
        finally:
            db.close()

    def test_cost_center_deletion_e2e_flow(self, authenticated_client: TestClient):
        """Test end-to-end flow for cost center deletion."""
        # Step 1: Create cost center to delete
        center_data = {
            "code": "DELETE_E2E",
            "name": "To Be Deleted",
            "description": "This center will be deleted",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert create_response.status_code == status.HTTP_200_OK
        center_id = create_response.json()["id"]

        # Step 2: Verify cost center exists in database
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            db_center = db.query(CostCenter).filter(CostCenter.id == center_id).first()
            assert db_center is not None
        finally:
            db.close()

        # Step 3: Delete via API
        delete_response = authenticated_client.delete(f"/api/cost_centers/{center_id}")
        assert delete_response.status_code == status.HTTP_200_OK

        # Step 4: Verify deletion from database
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            db_center = db.query(CostCenter).filter(CostCenter.id == center_id).first()
            assert db_center is None
        finally:
            db.close()

        # Step 5: Verify cost center no longer accessible via API
        get_response = authenticated_client.get(f"/api/cost_centers/{center_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

        # Step 6: Verify cost center not in list
        list_response = authenticated_client.get("/api/cost_centers/")
        assert list_response.status_code == status.HTTP_200_OK

        centers_list = list_response.json()
        for center in centers_list:
            assert center["id"] != center_id

    def test_cost_center_bulk_operations_e2e_flow(self, authenticated_client: TestClient):
        """Test end-to-end flow for bulk cost center operations."""
        # Step 1: Create multiple cost centers
        centers_data = [
            {
                "code": f"BULK_E2E_{i}",
                "name": f"Bulk Test Center {i}",
                "description": f"Bulk operation test {i}",
                "is_active": True
            }
            for i in range(1, 4)
        ]

        created_ids = []
        for center_data in centers_data:
            response = authenticated_client.post("/api/cost_centers/", json=center_data)
            assert response.status_code == status.HTTP_200_OK
            created_ids.append(response.json()["id"])

        # Step 2: Verify all centers exist in database
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            for center_id in created_ids:
                db_center = db.query(CostCenter).filter(CostCenter.id == center_id).first()
                assert db_center is not None
        finally:
            db.close()

        # Step 3: Perform bulk delete
        bulk_delete_response = authenticated_client.post("/api/cost_centers/bulk-delete", json=created_ids)
        assert bulk_delete_response.status_code == status.HTTP_200_OK

        # Step 4: Verify all centers deleted from database
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            for center_id in created_ids:
                db_center = db.query(CostCenter).filter(CostCenter.id == center_id).first()
                assert db_center is None
        finally:
            db.close()

        # Step 5: Verify centers not accessible via API
        for center_id in created_ids:
            get_response = authenticated_client.get(f"/api/cost_centers/{center_id}")
            assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_cost_center_user_isolation_e2e_flow(self, client: TestClient):
        """Test end-to-end user data isolation for cost centers."""
        # Step 1: Create two separate users
        user1_data = {
            "username": "user1_e2e_isolation",
            "password": "Password123!",
            "user_name": "User One E2E",
            "email": "user1_e2e@example.com"
        }
        user2_data = {
            "username": "user2_e2e_isolation",
            "password": "Password123!",
            "user_name": "User Two E2E",
            "email": "user2_e2e@example.com"
        }

        # Register users
        client.post("/api/auth/register", json=user1_data)
        client.post("/api/auth/register", json=user2_data)

        # Step 2: Login as user1 and create cost center
        login_response1 = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_cookies = login_response1.cookies

        client.cookies = user1_cookies
        center_data = {
            "code": "USER1_E2E",
            "name": "User1 Isolated Center",
            "description": "Should not be visible to user2",
            "is_active": True
        }

        create_response = client.post("/api/cost_centers/", json=center_data)
        assert create_response.status_code == status.HTTP_200_OK
        user1_center_id = create_response.json()["id"]
        user1_user_id = create_response.json()["user_id"]

        # Step 3: Verify user1's center exists in database with correct user_id
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            db_center = db.query(CostCenter).filter(CostCenter.id == user1_center_id).first()
            assert db_center is not None
            assert db_center.user_id == user1_user_id
            assert db_center.code == "USER1_E2E"
        finally:
            db.close()

        # Step 4: Login as user2
        login_response2 = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_cookies = login_response2.cookies

        # Step 5: Verify user2 cannot access user1's cost center
        client.cookies = user2_cookies

        # Cannot get by ID
        get_response = client.get(f"/api/cost_centers/{user1_center_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

        # Cannot see in list
        list_response = client.get("/api/cost_centers/")
        assert list_response.status_code == status.HTTP_200_OK
        centers_list = list_response.json()
        for center in centers_list:
            assert center["id"] != user1_center_id

        # Cannot update
        update_response = client.put(f"/api/cost_centers/{user1_center_id}", json={
            "name": "Hacked Name"
        })
        assert update_response.status_code == status.HTTP_404_NOT_FOUND

        # Cannot delete
        delete_response = client.delete(f"/api/cost_centers/{user1_center_id}")
        assert delete_response.status_code == status.HTTP_404_NOT_FOUND

        # Step 6: Verify user1's data still intact after user2's access attempts
        client.cookies = user1_cookies
        get_response = client.get(f"/api/cost_centers/{user1_center_id}")
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.json()["name"] == "User1 Isolated Center"

        # Step 7: Verify in database that data integrity is maintained
        db_gen = get_db()
        db: Session = next(db_gen)
        try:
            db_center = db.query(CostCenter).filter(CostCenter.id == user1_center_id).first()
            assert db_center is not None
            assert db_center.name == "User1 Isolated Center"
            assert db_center.user_id == user1_user_id
        finally:
            db.close()

    def test_cost_center_validation_edge_cases_e2e(self, authenticated_client: TestClient):
        """Test end-to-end validation edge cases."""
        # Step 1: Test boundary conditions for field lengths
        test_cases = [
            {
                "name": "Max length code",
                "data": {
                    "code": "A" * 20,  # Exactly 20 chars (max)
                    "name": "Max Code Length Test",
                    "is_active": True
                },
                "should_succeed": True
            },
            {
                "name": "Too long code",
                "data": {
                    "code": "A" * 21,  # 21 chars (over limit)
                    "name": "Over Max Code Length",
                    "is_active": True
                },
                "should_succeed": False
            },
            {
                "name": "Max length name",
                "data": {
                    "code": "MAX_NAME",
                    "name": "A" * 255,  # Exactly 255 chars (max)
                    "is_active": True
                },
                "should_succeed": True
            },
            {
                "name": "Too long name",
                "data": {
                    "code": "TOO_LONG_NAME",
                    "name": "A" * 256,  # 256 chars (over limit)
                    "is_active": True
                },
                "should_succeed": False
            },
            {
                "name": "Max length description",
                "data": {
                    "code": "MAX_DESC",
                    "name": "Max Description Test",
                    "description": "A" * 500,  # Exactly 500 chars (max)
                    "is_active": True
                },
                "should_succeed": True
            }
        ]

        successful_ids = []

        for test_case in test_cases:
            response = authenticated_client.post("/api/cost_centers/", json=test_case["data"])

            if test_case["should_succeed"]:
                assert response.status_code == status.HTTP_200_OK, f"Failed: {test_case['name']}"
                successful_ids.append(response.json()["id"])

                # Verify in database
                db_gen = get_db()
                db: Session = next(db_gen)
                try:
                    db_center = db.query(CostCenter).filter(
                        CostCenter.id == response.json()["id"]
                    ).first()
                    assert db_center is not None
                    assert db_center.code == test_case["data"]["code"]
                finally:
                    db.close()
            else:
                assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY, f"Should have failed: {test_case['name']}"

        # Step 2: Cleanup successful creations
        for center_id in successful_ids:
            delete_response = authenticated_client.delete(f"/api/cost_centers/{center_id}")
            assert delete_response.status_code == status.HTTP_200_OK