"""
Security-focused tests for reference statistics API endpoint.

Tests the authentication and authorization aspects of /api/reports/reference-stats
which are the most critical security requirements.

These tests focus on:
- Authentication requirements (401 for unauthenticated)
- Invalid session handling
- Basic endpoint availability

This simplified test suite verifies the core security functionality
without complex database setup issues.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from app.main import app


def test_reference_stats_requires_authentication():
    """Test that the reference stats endpoint requires authentication."""
    client = TestClient(app)
    response = client.get("/api/reports/reference-stats")

    assert response.status_code == 401
    response_data = response.json()
    assert "detail" in response_data
    assert "Not authenticated" in response_data["detail"]


def test_reference_stats_rejects_invalid_session():
    """Test that invalid session cookies are rejected."""
    client = TestClient(app)

    # Test with invalid session cookie
    headers = {"Cookie": "connect.sid=invalid_session_id"}
    response = client.get("/api/reports/reference-stats", headers=headers)

    assert response.status_code == 401


def test_reference_stats_rejects_malformed_session():
    """Test that malformed session cookies are rejected."""
    client = TestClient(app)

    # Test with malformed session cookie
    headers = {"Cookie": "connect.sid=malformed.session.data"}
    response = client.get("/api/reports/reference-stats", headers=headers)

    assert response.status_code == 401


def test_reference_stats_endpoint_exists():
    """Test that the reference stats endpoint exists and is routed correctly."""
    client = TestClient(app)

    # Should return 401 (not 404), confirming endpoint exists
    response = client.get("/api/reports/reference-stats")
    assert response.status_code == 401  # Not 404, so endpoint exists

    # Test wrong endpoint returns 404
    response = client.get("/api/reports/non-existent-endpoint")
    assert response.status_code == 404


def test_reference_stats_http_methods():
    """Test that only GET method is allowed for reference stats."""
    client = TestClient(app)

    # GET should return 401 (authentication required)
    response = client.get("/api/reports/reference-stats")
    assert response.status_code == 401

    # POST should return 405 (method not allowed)
    response = client.post("/api/reports/reference-stats")
    assert response.status_code == 405

    # PUT should return 405 (method not allowed)
    response = client.put("/api/reports/reference-stats")
    assert response.status_code == 405

    # DELETE should return 405 (method not allowed)
    response = client.delete("/api/reports/reference-stats")
    assert response.status_code == 405


def test_reference_stats_without_cookies():
    """Test that requests without any cookies are rejected."""
    client = TestClient(app)

    # Explicitly clear any cookies
    client.cookies.clear()

    response = client.get("/api/reports/reference-stats")
    assert response.status_code == 401


def test_reference_stats_with_empty_cookie():
    """Test that requests with empty session cookies are rejected."""
    client = TestClient(app)

    # Test with empty session cookie value
    headers = {"Cookie": "connect.sid="}
    response = client.get("/api/reports/reference-stats", headers=headers)

    assert response.status_code == 401


def test_reference_stats_security_headers():
    """Test that security-related aspects of the response are correct."""
    client = TestClient(app)

    response = client.get("/api/reports/reference-stats")

    # Should require authentication
    assert response.status_code == 401

    # Response should be JSON
    assert response.headers.get("content-type", "").startswith("application/json")

    # Should have proper error structure
    error_data = response.json()
    assert isinstance(error_data, dict)
    assert "detail" in error_data


class TestReferenceStatsEndpointIntegration:
    """Integration tests that verify the endpoint works with the broader API."""

    def test_reference_stats_follows_api_conventions(self):
        """Test that reference stats endpoint follows API conventions."""
        client = TestClient(app)

        # Test the endpoint follows the /api/reports/ pattern
        response = client.get("/api/reports/reference-stats")
        assert response.status_code == 401  # Confirms it's a protected endpoint

        # Error response should follow API conventions
        error_data = response.json()
        assert "detail" in error_data
        assert isinstance(error_data["detail"], str)

    def test_reference_stats_cors_behavior(self):
        """Test CORS behavior for reference stats endpoint."""
        client = TestClient(app)

        # Test preflight request (OPTIONS)
        response = client.options("/api/reports/reference-stats")
        # Should either allow OPTIONS or return 405, but not 401 for preflight
        assert response.status_code in [200, 204, 405]

    def test_reference_stats_api_consistency(self):
        """Test that reference stats behaves consistently with other API endpoints."""
        client = TestClient(app)

        # Compare behavior with other protected endpoints
        endpoints = [
            "/api/reports/reference-stats",
            "/api/periods/",
            "/api/financial_centers/",
            "/api/nomenclatures/"
        ]

        for endpoint in endpoints:
            response = client.get(endpoint)
            # All protected endpoints should return 401 when not authenticated
            assert response.status_code == 401

            # All should return JSON error
            error_data = response.json()
            assert "detail" in error_data