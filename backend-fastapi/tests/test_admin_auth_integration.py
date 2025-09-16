"""
Integration tests for admin settings authorization fix.

This test suite focuses on realistic integration testing without heavy mocking.
Tests cover:
1. /api/auth/me endpoint with real database operations
2. Admin role validation and authorization
3. Session handling in realistic scenarios
4. Data isolation verification
"""

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient


class TestAdminAuthIntegration:
    """Integration tests for admin authorization."""

    def test_auth_me_endpoint_success(self, authenticated_client: TestClient):
        """Test /api/auth/me returns authenticated user data."""
        response = authenticated_client.get("/api/auth/me")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["authenticated"] is True
        assert "user" in data
        assert "id" in data["user"]
        assert "username" in data["user"]
        assert "role" in data["user"]

    def test_auth_me_endpoint_unauthorized(self, client: TestClient):
        """Test /api/auth/me returns 401 for unauthenticated requests."""
        response = client.get("/api/auth/me")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert "Not authenticated" in data["detail"]

    def test_admin_user_creation_and_verification(self, client: TestClient):
        """Test creating an admin user and verifying role through /api/auth/me."""
        # Create admin user
        admin_data = {
            "username": "admin_test",
            "password": "AdminPassword123!",
            "user_name": "Test Admin",
            "email": "admin@test.com"
        }

        # Register admin user
        response = client.post("/api/auth/register", json=admin_data)
        assert response.status_code == status.HTTP_200_OK

        # Login
        login_data = {
            "username": admin_data["username"],
            "password": admin_data["password"]
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == status.HTTP_200_OK

        # Get session cookie
        client.cookies = response.cookies

        # Verify user data through /api/auth/me
        response = client.get("/api/auth/me")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["success"] is True
        assert data["user"]["username"] == admin_data["username"]
        assert data["user"]["user_name"] == admin_data["user_name"]
        assert data["user"]["user_email"] == admin_data["email"]
        # Default role should be 'user' unless explicitly set to admin
        assert data["user"]["role"] in ["user", "admin"]

    def test_regular_user_creation_and_verification(self, client: TestClient):
        """Test creating a regular user and verifying role through /api/auth/me."""
        # Create regular user
        user_data = {
            "username": "user_test",
            "password": "UserPassword123!",
            "user_name": "Test User",
            "email": "user@test.com"
        }

        # Register user
        response = client.post("/api/auth/register", json=user_data)
        assert response.status_code == status.HTTP_200_OK

        # Login
        login_data = {
            "username": user_data["username"],
            "password": user_data["password"]
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == status.HTTP_200_OK

        # Get session cookie
        client.cookies = response.cookies

        # Verify user data through /api/auth/me
        response = client.get("/api/auth/me")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["success"] is True
        assert data["user"]["username"] == user_data["username"]
        assert data["user"]["role"] == "user"  # Default role

    @pytest.mark.asyncio
    async def test_auth_me_with_async_client(self, authenticated_async_client: AsyncClient):
        """Test /api/auth/me with async client."""
        response = await authenticated_async_client.get("/api/auth/me")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["authenticated"] is True
        assert "user" in data

    def test_session_persistence_across_requests(self, client: TestClient, test_user_data):
        """Test that session persists across multiple requests."""
        # Register and login
        client.post("/api/auth/register", json=test_user_data)

        login_response = client.post("/api/auth/login", json={
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        })
        assert login_response.status_code == status.HTTP_200_OK

        # Use the session cookie
        client.cookies = login_response.cookies

        # Make multiple authenticated requests
        for _ in range(3):
            response = client.get("/api/auth/me")
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["authenticated"] is True
            assert data["user"]["username"] == test_user_data["username"]

    def test_data_isolation_verification(self, client: TestClient):
        """Test that user data is properly isolated by user_id."""
        # Create two different users
        user1_data = {
            "username": "user1_isolation",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1@test.com"
        }

        user2_data = {
            "username": "user2_isolation",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2@test.com"
        }

        # Register both users
        client.post("/api/auth/register", json=user1_data)
        client.post("/api/auth/register", json=user2_data)

        # Login as user1
        login_response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        client.cookies = login_response.cookies

        # Verify we get user1 data
        response = client.get("/api/auth/me")
        data = response.json()
        assert data["user"]["username"] == user1_data["username"]
        assert data["user"]["user_name"] == user1_data["user_name"]
        user1_id = data["user"]["id"]

        # Login as user2
        login_response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        client.cookies = login_response.cookies

        # Verify we get user2 data (different from user1)
        response = client.get("/api/auth/me")
        data = response.json()
        assert data["user"]["username"] == user2_data["username"]
        assert data["user"]["user_name"] == user2_data["user_name"]
        user2_id = data["user"]["id"]

        # Verify users have different IDs
        assert user1_id != user2_id

    def test_logout_functionality(self, authenticated_client: TestClient):
        """Test logout clears session and /api/auth/me fails."""
        # Verify we're authenticated
        response = authenticated_client.get("/api/auth/me")
        assert response.status_code == status.HTTP_200_OK

        # Logout
        response = authenticated_client.post("/api/auth/logout")
        assert response.status_code == status.HTTP_200_OK

        # Verify we're no longer authenticated
        response = authenticated_client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_session_handling(self, client: TestClient):
        """Test handling of invalid session cookies."""
        # Set an invalid session cookie
        client.cookies.set("connect.sid", "invalid.session.id")

        # Should return 401
        response = client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_empty_session_handling(self, client: TestClient):
        """Test handling of empty session cookies."""
        # Set an empty session cookie
        client.cookies.set("connect.sid", "")

        # Should return 401
        response = client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_malformed_session_handling(self, client: TestClient):
        """Test handling of malformed session cookies."""
        # Set various malformed session cookies
        malformed_sessions = [
            "malformed",
            "s:",
            "s:malformed",
            "s:malformed.with.too.many.dots.here",
            "completely.invalid.format.here"
        ]

        for session_id in malformed_sessions:
            client.cookies.set("connect.sid", session_id)

            response = client.get("/api/auth/me")
            # Should gracefully handle malformed sessions
            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_auth_status_endpoint(self, authenticated_client: TestClient, client: TestClient):
        """Test /api/auth/status endpoint."""
        # Test authenticated status
        response = authenticated_client.get("/api/auth/status")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["authenticated"] is True
        assert data["user"] is not None

        # Test unauthenticated status
        response = client.get("/api/auth/status")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["authenticated"] is False
        assert data["user"] is None

    def test_password_auth_enabled_endpoint(self, client: TestClient):
        """Test /api/auth/password-auth-enabled endpoint."""
        response = client.get("/api/auth/password-auth-enabled")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "enabled" in data
        assert isinstance(data["enabled"], bool)


class TestRoleBasedAccessControl:
    """Test role-based access control scenarios."""

    def test_role_persistence_across_sessions(self, client: TestClient):
        """Test that user role is correctly maintained across login sessions."""
        user_data = {
            "username": "role_test_user",
            "password": "RoleTest123!",
            "user_name": "Role Test User",
            "email": "roletest@test.com"
        }

        # Register user
        client.post("/api/auth/register", json=user_data)

        # Login and check role
        login_response = client.post("/api/auth/login", json={
            "username": user_data["username"],
            "password": user_data["password"]
        })
        client.cookies = login_response.cookies

        response = client.get("/api/auth/me")
        initial_role = response.json()["user"]["role"]

        # Logout
        client.post("/api/auth/logout")

        # Login again
        login_response = client.post("/api/auth/login", json={
            "username": user_data["username"],
            "password": user_data["password"]
        })
        client.cookies = login_response.cookies

        # Check role is the same
        response = client.get("/api/auth/me")
        assert response.json()["user"]["role"] == initial_role

    def test_role_validation_through_api(self, authenticated_client: TestClient):
        """Test that role information is properly returned by the API."""
        response = authenticated_client.get("/api/auth/me")
        data = response.json()

        # Role should be present and valid
        assert "role" in data["user"]
        assert data["user"]["role"] in ["user", "admin"]

        # Role should be consistent with user creation
        # (Default should be 'user' unless explicitly set)
        assert isinstance(data["user"]["role"], str)
        assert len(data["user"]["role"]) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])