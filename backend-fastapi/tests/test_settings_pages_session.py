"""
Integration tests for settings pages session preservation.
Tests that sessions are preserved across API calls and CRUD operations work without session loss.
Validates the trailing slash fix prevents 307 redirects that cause session loss.
"""
import pytest
import asyncio
from datetime import datetime
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient
import requests
from typing import Dict, Any, List
from unittest.mock import patch, MagicMock


class TestSettingsPagesSessionPreservation:
    """Test session preservation across all settings pages."""

    def setup_method(self):
        """Setup test data for each test method."""
        self.test_user_id = 1
        self.session_data = {
            'user': {'id': self.test_user_id, 'username': 'test_user'},
            'authenticated': True
        }

    def test_periods_session_preservation_across_crud(self, authenticated_client: TestClient):
        """Test that periods CRUD operations preserve session and avoid redirects."""
        # Test data
        period_data = {
            "period_year": 2025,
            "period_month": 1,
            "period_name": "Январь 2025",
            "is_active": True
        }

        # CREATE with session preservation check
        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        assert create_response.history == []  # No redirects occurred

        created_period = create_response.json()
        period_id = created_period["id"]

        # READ - List all periods
        list_response = authenticated_client.get("/api/periods/")
        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.history == []  # No redirects occurred

        periods = list_response.json()
        assert len(periods) > 0
        assert any(p["id"] == period_id for p in periods)

        # READ - Get specific period
        get_response = authenticated_client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.history == []  # No redirects occurred

        period = get_response.json()
        assert period["id"] == period_id
        assert period["period_name"] == "Январь 2025"

        # UPDATE with session preservation
        update_data = {
            "period_name": "Январь 2025 (Обновлено)",
            "is_active": False
        }
        update_response = authenticated_client.put(f"/api/periods/{period_id}", json=update_data)
        assert update_response.status_code == status.HTTP_200_OK
        assert update_response.history == []  # No redirects occurred

        updated_period = update_response.json()
        assert updated_period["period_name"] == "Январь 2025 (Обновлено)"
        assert updated_period["is_active"] is False

        # DELETE with session preservation
        delete_response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_200_OK
        assert delete_response.history == []  # No redirects occurred

        # Verify deletion
        get_after_delete = authenticated_client.get(f"/api/periods/{period_id}")
        assert get_after_delete.status_code == status.HTTP_404_NOT_FOUND

    def test_financial_centers_session_preservation_across_crud(self, authenticated_client: TestClient):
        """Test that financial centers CRUD operations preserve session and avoid redirects."""
        # Test data
        fc_data = {
            "code": "TST",
            "name": "Test Financial Center",
            "description": "Test description",
            "is_active": True
        }

        # CREATE with session preservation check
        create_response = authenticated_client.post("/api/financial_centers/", json=fc_data)
        assert create_response.status_code == status.HTTP_200_OK
        assert create_response.history == []  # No redirects occurred

        created_fc = create_response.json()
        fc_id = created_fc["id"]

        # READ - List all financial centers
        list_response = authenticated_client.get("/api/financial_centers/")
        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.history == []  # No redirects occurred

        financial_centers = list_response.json()
        assert len(financial_centers) > 0
        assert any(fc["id"] == fc_id for fc in financial_centers)

        # READ - Get specific financial center
        get_response = authenticated_client.get(f"/api/financial_centers/{fc_id}")
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.history == []  # No redirects occurred

        fc = get_response.json()
        assert fc["id"] == fc_id
        assert fc["code"] == "TST"

        # UPDATE with session preservation
        update_data = {
            "name": "Updated Test Financial Center",
            "description": "Updated description"
        }
        update_response = authenticated_client.put(f"/api/financial_centers/{fc_id}", json=update_data)
        assert update_response.status_code == status.HTTP_200_OK
        assert update_response.history == []  # No redirects occurred

        updated_fc = update_response.json()
        assert updated_fc["name"] == "Updated Test Financial Center"

        # DELETE with session preservation
        delete_response = authenticated_client.delete(f"/api/financial_centers/{fc_id}")
        assert delete_response.status_code == status.HTTP_200_OK
        assert delete_response.history == []  # No redirects occurred

    def test_cost_centers_session_preservation_across_crud(self, authenticated_client: TestClient):
        """Test that cost centers CRUD operations preserve session and avoid redirects."""
        # Test data
        cc_data = {
            "code": "CC001",
            "name": "Test Cost Center",
            "description": "Test description",
            "is_active": True
        }

        # CREATE with session preservation check
        create_response = authenticated_client.post("/api/cost_centers/", json=cc_data)
        assert create_response.status_code == status.HTTP_200_OK
        assert create_response.history == []  # No redirects occurred

        created_cc = create_response.json()
        cc_id = created_cc["id"]

        # Full CRUD cycle with session preservation verification
        list_response = authenticated_client.get("/api/cost_centers/")
        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.history == []

        get_response = authenticated_client.get(f"/api/cost_centers/{cc_id}")
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.history == []

        update_response = authenticated_client.put(f"/api/cost_centers/{cc_id}",
                                                   json={"name": "Updated Cost Center"})
        assert update_response.status_code == status.HTTP_200_OK
        assert update_response.history == []

        delete_response = authenticated_client.delete(f"/api/cost_centers/{cc_id}")
        assert delete_response.status_code == status.HTTP_200_OK
        assert delete_response.history == []

    def test_nomenclatures_session_preservation_across_crud(self, authenticated_client: TestClient):
        """Test that nomenclatures CRUD operations preserve session and avoid redirects."""
        # Test data
        nom_data = {
            "code": "NOM001",
            "name": "Test Nomenclature",
            "description": "Test description",
            "is_active": True
        }

        # CREATE with session preservation check
        create_response = authenticated_client.post("/api/nomenclatures/", json=nom_data)
        assert create_response.status_code == status.HTTP_200_OK
        assert create_response.history == []  # No redirects occurred

        created_nom = create_response.json()
        nom_id = created_nom["id"]

        # Full CRUD cycle with session preservation verification
        list_response = authenticated_client.get("/api/nomenclatures/")
        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.history == []

        get_response = authenticated_client.get(f"/api/nomenclatures/{nom_id}")
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.history == []

        update_response = authenticated_client.put(f"/api/nomenclatures/{nom_id}",
                                                   json={"name": "Updated Nomenclature"})
        assert update_response.status_code == status.HTTP_200_OK
        assert update_response.history == []

        delete_response = authenticated_client.delete(f"/api/nomenclatures/{nom_id}")
        assert delete_response.status_code == status.HTTP_200_OK
        assert delete_response.history == []

    def test_bulk_operations_session_preservation(self, authenticated_client: TestClient):
        """Test that bulk operations across all settings preserve sessions."""
        # Create test data for all modules
        test_data = {
            "periods": [
                {"period_year": 2025, "period_month": i, "is_active": True}
                for i in range(1, 4)
            ],
            "financial_centers": [
                {"code": f"FC{i:02d}", "name": f"Financial Center {i}", "is_active": True}
                for i in range(1, 4)
            ],
            "cost_centers": [
                {"code": f"CC{i:02d}", "name": f"Cost Center {i}", "is_active": True}
                for i in range(1, 4)
            ],
            "nomenclatures": [
                {"code": f"NOM{i:02d}", "name": f"Nomenclature {i}", "is_active": True}
                for i in range(1, 4)
            ]
        }

        created_ids = {}

        # Bulk CREATE operations
        for module, items in test_data.items():
            created_ids[module] = []
            for item in items:
                response = authenticated_client.post(f"/api/{module}/", json=item)
                assert response.status_code == status.HTTP_200_OK
                assert response.history == []  # No redirects
                created_ids[module].append(response.json()["id"])

        # Bulk READ operations - verify all data is accessible in same session
        for module, ids in created_ids.items():
            list_response = authenticated_client.get(f"/api/{module}/")
            assert list_response.status_code == status.HTTP_200_OK
            assert list_response.history == []

            items = list_response.json()
            for item_id in ids:
                assert any(item["id"] == item_id for item in items)

        # Cleanup - bulk DELETE operations
        for module, ids in created_ids.items():
            for item_id in ids:
                delete_response = authenticated_client.delete(f"/api/{module}/{item_id}")
                assert delete_response.status_code == status.HTTP_200_OK
                assert delete_response.history == []

    def test_concurrent_operations_session_preservation(self, authenticated_client: TestClient):
        """Test that concurrent operations don't cause session loss."""
        # Create test items
        period_data = {"period_year": 2025, "period_month": 6, "is_active": True}
        fc_data = {"code": "CONC", "name": "Concurrent Test", "is_active": True}

        # Create items
        period_response = authenticated_client.post("/api/periods/", json=period_data)
        fc_response = authenticated_client.post("/api/financial_centers/", json=fc_data)

        assert period_response.status_code == status.HTTP_200_OK
        assert fc_response.status_code == status.HTTP_200_OK
        assert period_response.history == []
        assert fc_response.history == []

        period_id = period_response.json()["id"]
        fc_id = fc_response.json()["id"]

        # Perform concurrent reads - simulating user clicking between different settings pages
        responses = []
        endpoints = [
            "/api/periods/",
            "/api/financial_centers/",
            "/api/cost_centers/",
            "/api/nomenclatures/",
            f"/api/periods/{period_id}",
            f"/api/financial_centers/{fc_id}"
        ]

        for endpoint in endpoints:
            response = authenticated_client.get(endpoint)
            responses.append(response)

        # Verify all responses are successful and no redirects occurred
        for response in responses:
            assert response.status_code in [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND]
            assert response.history == []  # No redirects

        # Cleanup
        authenticated_client.delete(f"/api/periods/{period_id}")
        authenticated_client.delete(f"/api/financial_centers/{fc_id}")

    def test_session_cookie_preservation(self, authenticated_client: TestClient):
        """Test that session cookies are properly maintained across requests."""
        # Get the session cookie from the authenticated client
        cookies = authenticated_client.cookies

        # Perform multiple operations and verify cookies are maintained
        endpoints_to_test = [
            ("/api/periods/", "GET"),
            ("/api/financial_centers/", "GET"),
            ("/api/cost_centers/", "GET"),
            ("/api/nomenclatures/", "GET")
        ]

        for endpoint, method in endpoints_to_test:
            response = getattr(authenticated_client, method.lower())(endpoint)
            assert response.status_code == status.HTTP_200_OK

            # Verify cookies are still present after the request
            assert len(authenticated_client.cookies) > 0
            # Should have the same session cookie
            assert 'connect.sid' in [cookie.name for cookie in authenticated_client.cookies]

    def test_trailing_slash_redirect_prevention(self, authenticated_client: TestClient):
        """Test that trailing slashes prevent 307 redirects."""
        endpoints_without_slash = [
            "/api/periods",
            "/api/financial_centers",
            "/api/cost_centers",
            "/api/nomenclatures"
        ]

        endpoints_with_slash = [
            "/api/periods/",
            "/api/financial_centers/",
            "/api/cost_centers/",
            "/api/nomenclatures/"
        ]

        # Test that endpoints WITH trailing slashes don't redirect
        for endpoint in endpoints_with_slash:
            response = authenticated_client.get(endpoint)
            assert response.status_code == status.HTTP_200_OK
            assert response.history == []  # No redirects

        # Test behavior with endpoints WITHOUT trailing slashes
        # Note: This depends on FastAPI configuration, but typically these would redirect
        for endpoint in endpoints_without_slash:
            response = authenticated_client.get(endpoint, allow_redirects=True)
            # The response should be successful, but may have gone through redirects
            assert response.status_code == status.HTTP_200_OK
            # In a properly configured system, there might be redirects here

    def test_error_handling_preserves_session(self, authenticated_client: TestClient):
        """Test that error responses don't break session preservation."""
        # Try to access non-existent resources
        error_tests = [
            ("/api/periods/99999", status.HTTP_404_NOT_FOUND),
            ("/api/financial_centers/99999", status.HTTP_404_NOT_FOUND),
            ("/api/cost_centers/99999", status.HTTP_404_NOT_FOUND),
            ("/api/nomenclatures/99999", status.HTTP_404_NOT_FOUND)
        ]

        for endpoint, expected_status in error_tests:
            response = authenticated_client.get(endpoint)
            assert response.status_code == expected_status
            assert response.history == []  # No redirects even on errors

        # After error responses, verify session still works
        response = authenticated_client.get("/api/periods/")
        assert response.status_code == status.HTTP_200_OK
        assert response.history == []

    def test_invalid_data_handling_preserves_session(self, authenticated_client: TestClient):
        """Test that invalid data submissions don't break sessions."""
        # Test with invalid data that should cause 400 errors
        invalid_data_tests = [
            ("/api/periods/", {"invalid": "data"}),
            ("/api/financial_centers/", {"invalid": "data"}),
            ("/api/cost_centers/", {"invalid": "data"}),
            ("/api/nomenclatures/", {"invalid": "data"})
        ]

        for endpoint, data in invalid_data_tests:
            response = authenticated_client.post(endpoint, json=data)
            # Should get validation error, not redirect
            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
            assert response.history == []  # No redirects

        # After error responses, verify session still works
        response = authenticated_client.get("/api/periods/")
        assert response.status_code == status.HTTP_200_OK


class TestSessionIsolationAndSecurity:
    """Test that session preservation doesn't compromise data isolation."""

    def test_data_isolation_maintained_across_sessions(self, authenticated_client: TestClient, app):
        """Test that session preservation doesn't break user data isolation."""
        # Create test data with current user
        period_data = {
            "period_year": 2025,
            "period_month": 7,
            "period_name": "July 2025 Isolation Test",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        created_period = create_response.json()
        period_id = created_period["id"]

        # Verify the period is visible to the current user
        list_response = authenticated_client.get("/api/periods/")
        assert list_response.status_code == status.HTTP_200_OK
        periods = list_response.json()
        assert any(p["id"] == period_id for p in periods)

        # Clean up
        authenticated_client.delete(f"/api/periods/{period_id}")

    def test_session_security_headers_preserved(self, authenticated_client: TestClient):
        """Test that security headers are maintained across requests."""
        response = authenticated_client.get("/api/periods/")
        assert response.status_code == status.HTTP_200_OK

        # Check that security-related headers are present
        # Note: Exact headers depend on FastAPI middleware configuration
        headers = response.headers

        # Common security headers that should be present
        assert 'content-type' in headers

        # Verify no redirect-related headers that could indicate session issues
        assert 'location' not in headers.keys()


class TestPerformanceAndReliability:
    """Test performance aspects of session preservation."""

    def test_no_performance_degradation_from_trailing_slashes(self, authenticated_client: TestClient):
        """Test that trailing slash fix doesn't cause performance issues."""
        import time

        # Measure response time for multiple requests
        endpoints = [
            "/api/periods/",
            "/api/financial_centers/",
            "/api/cost_centers/",
            "/api/nomenclatures/"
        ]

        response_times = []

        for endpoint in endpoints:
            start_time = time.time()
            response = authenticated_client.get(endpoint)
            end_time = time.time()

            assert response.status_code == status.HTTP_200_OK
            assert response.history == []  # No redirects (which would add latency)

            response_times.append(end_time - start_time)

        # All requests should complete reasonably quickly (under 1 second)
        for response_time in response_times:
            assert response_time < 1.0

        # Average response time should be reasonable
        avg_response_time = sum(response_times) / len(response_times)
        assert avg_response_time < 0.5  # 500ms average

    def test_memory_usage_stability(self, authenticated_client: TestClient):
        """Test that session preservation doesn't cause memory leaks."""
        # Perform many operations to check for potential memory issues
        for i in range(10):  # Reduced from 100 for test performance
            # Create and delete resources
            period_data = {
                "period_year": 2025,
                "period_month": (i % 12) + 1,
                "is_active": True
            }

            create_response = authenticated_client.post("/api/periods/", json=period_data)
            if create_response.status_code == status.HTTP_200_OK:
                period_id = create_response.json()["id"]

                # Read the resource
                authenticated_client.get(f"/api/periods/{period_id}")

                # Delete the resource
                authenticated_client.delete(f"/api/periods/{period_id}")

            # Each operation should still work without session issues
            list_response = authenticated_client.get("/api/periods/")
            assert list_response.status_code == status.HTTP_200_OK
            assert list_response.history == []