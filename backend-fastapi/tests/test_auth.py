"""
Tests for authentication endpoints.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient


class TestAuthEndpoints:
    """Test authentication endpoints."""
    
    def test_register_success(self, client: TestClient, test_user_data):
        """Test successful user registration."""
        response = client.post("/api/auth/register", json=test_user_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "user" in data["data"]
        assert data["data"]["user"]["username"] == test_user_data["username"]
        assert data["data"]["user"]["email"] == test_user_data["email"]
        assert "password" not in data["data"]["user"]
    
    def test_register_duplicate_username(self, client: TestClient, test_user_data):
        """Test registration with duplicate username."""
        # First registration
        response = client.post("/api/auth/register", json=test_user_data)
        assert response.status_code == status.HTTP_200_OK
        
        # Second registration with same username
        response = client.post("/api/auth/register", json=test_user_data)
        assert response.status_code == status.HTTP_409_CONFLICT
        data = response.json()
        assert "already exists" in data["detail"].lower()
    
    def test_register_invalid_email(self, client: TestClient, test_user_data):
        """Test registration with invalid email."""
        test_user_data["email"] = "invalid-email"
        response = client.post("/api/auth/register", json=test_user_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_register_weak_password(self, client: TestClient, test_user_data):
        """Test registration with weak password."""
        test_user_data["password"] = "weak"
        response = client.post("/api/auth/register", json=test_user_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_login_success(self, client: TestClient, test_user_data):
        """Test successful login."""
        # Register first
        client.post("/api/auth/register", json=test_user_data)
        
        # Login
        login_data = {
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "user" in data["data"]
        assert data["data"]["user"]["username"] == test_user_data["username"]
        
        # Check session cookie
        assert "connect.sid" in response.cookies
    
    def test_login_invalid_credentials(self, client: TestClient, test_user_data):
        """Test login with invalid credentials."""
        # Register first
        client.post("/api/auth/register", json=test_user_data)
        
        # Login with wrong password
        login_data = {
            "username": test_user_data["username"],
            "password": "WrongPassword123!"
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert "Invalid credentials" in data["detail"]
    
    def test_login_nonexistent_user(self, client: TestClient):
        """Test login with non-existent user."""
        login_data = {
            "username": "nonexistentuser",
            "password": "SomePassword123!"
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_current_user_authenticated(self, authenticated_client: TestClient):
        """Test getting current user when authenticated."""
        response = authenticated_client.get("/api/auth/me")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "user" in data["data"]
        assert "id" in data["data"]["user"]
        assert "username" in data["data"]["user"]
    
    def test_get_current_user_unauthenticated(self, client: TestClient):
        """Test getting current user when not authenticated."""
        response = client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_logout_success(self, authenticated_client: TestClient):
        """Test successful logout."""
        response = authenticated_client.post("/api/auth/logout")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        
        # Verify session is cleared
        response = authenticated_client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_logout_unauthenticated(self, client: TestClient):
        """Test logout when not authenticated."""
        response = client.post("/api/auth/logout")
        # Should still return success even if not logged in
        assert response.status_code == status.HTTP_200_OK
    
    def test_password_auth_enabled(self, client: TestClient):
        """Test password authentication status endpoint."""
        response = client.get("/api/auth/password-auth-enabled")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "enabled" in data
        assert isinstance(data["enabled"], bool)


@pytest.mark.asyncio
class TestAuthEndpointsAsync:
    """Async tests for authentication endpoints."""
    
    async def test_register_concurrent_users(self, async_client: AsyncClient):
        """Test concurrent user registrations."""
        import asyncio
        
        async def register_user(username: str):
            user_data = {
                "username": username,
                "password": "TestPassword123!",
                "user_name": f"Test {username}",
                "email": f"{username}@example.com"
            }
            return await async_client.post("/api/auth/register", json=user_data)
        
        # Register multiple users concurrently
        tasks = [register_user(f"user{i}") for i in range(5)]
        responses = await asyncio.gather(*tasks)
        
        # All should succeed
        for response in responses:
            assert response.status_code == status.HTTP_200_OK
    
    async def test_session_persistence(self, authenticated_async_client: AsyncClient):
        """Test session persistence across requests."""
        # First request
        response = await authenticated_async_client.get("/api/auth/me")
        assert response.status_code == status.HTTP_200_OK
        first_user = response.json()["data"]["user"]
        
        # Second request with same session
        response = await authenticated_async_client.get("/api/auth/me")
        assert response.status_code == status.HTTP_200_OK
        second_user = response.json()["data"]["user"]
        
        # Should be the same user
        assert first_user["id"] == second_user["id"]
        assert first_user["username"] == second_user["username"]