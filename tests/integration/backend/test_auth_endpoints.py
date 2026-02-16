"""
Integration tests for authentication endpoints.

Tests logout, refresh, and login flows with database.
"""

import pytest
from httpx import AsyncClient

from backend.app.main import app


@pytest.mark.integration
class TestLogoutEndpoint:
    """Test logout endpoint functionality."""

    async def test_logout_success(self, client: AsyncClient):
        """Test successful logout clears cookies."""
        # Make logout request
        response = await client.post("/api/v1/auth/logout")

        # Should succeed even without valid session
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Logout successful"

        # Check that cookies are cleared
        cookies = response.cookies
        # access_token and refresh_token should be deleted (empty value)
        if "access_token" in cookies:
            assert cookies["access_token"] == "" or cookies.get_dict()["access_token"] == ""
        if "refresh_token" in cookies:
            assert cookies["refresh_token"] == "" or cookies.get_dict()["refresh_token"] == ""

    async def test_logout_idempotent(self, client: AsyncClient):
        """Test logout can be called multiple times (idempotent)."""
        # First logout
        response1 = await client.post("/api/v1/auth/logout")
        assert response1.status_code == 200

        # Second logout (should also succeed)
        response2 = await client.post("/api/v1/auth/logout")
        assert response2.status_code == 200

        # Both should have same success message
        assert response1.json()["message"] == response2.json()["message"]

    async def test_logout_without_cookies(self, client: AsyncClient):
        """Test logout succeeds even without cookies (graceful degradation)."""
        # Use existing client fixture (already configured with app via ASGI transport)
        # No need to create new AsyncClient - fixture handles proper setup
        response = await client.post("/api/v1/auth/logout")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Logout successful"


    async def test_logout_returns_json(self, client: AsyncClient):
        """Test logout returns proper JSON response."""
        response = await client.post("/api/v1/auth/logout")

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/json")

        data = response.json()
        assert isinstance(data, dict)
        assert "message" in data
