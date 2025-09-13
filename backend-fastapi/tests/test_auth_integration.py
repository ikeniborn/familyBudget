"""
Integration tests for authentication and session handling.
Tests the complete authentication flow with real API endpoints.
"""
import pytest
import json
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.session import session_store
from app.core.config import settings


class TestAuthenticationIntegration:
    """Integration tests for authentication flow."""

    @pytest.fixture
    def client_with_mock_redis(self, mock_redis):
        """Create test client with mocked Redis."""
        with patch.object(session_store, 'redis', mock_redis):
            client = TestClient(app)
            yield client

    def test_full_authentication_cycle(self, client_with_mock_redis, test_user_data, mock_redis):
        """Test complete authentication cycle: register -> login -> authenticated request -> logout."""
        client = client_with_mock_redis

        # Step 1: Register user
        register_response = client.post("/api/auth/register", json=test_user_data)
        assert register_response.status_code == 200
        register_data = register_response.json()
        assert register_data["success"] is True

        # Step 2: Login
        login_data = {
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        }
        login_response = client.post("/api/auth/login", json=login_data)
        assert login_response.status_code == 200
        login_response_data = login_response.json()
        assert login_response_data["success"] is True

        # Verify session cookie is set
        cookies = login_response.cookies
        assert settings.SESSION_COOKIE_NAME in cookies
        session_cookie = cookies[settings.SESSION_COOKIE_NAME]

        # Step 3: Make authenticated request
        client.cookies.set(settings.SESSION_COOKIE_NAME, session_cookie)
        profile_response = client.get("/api/auth/profile")
        assert profile_response.status_code == 200
        profile_data = profile_response.json()
        assert profile_data["success"] is True
        assert profile_data["data"]["username"] == test_user_data["username"]

        # Step 4: Logout
        logout_response = client.post("/api/auth/logout")
        assert logout_response.status_code == 200
        logout_data = logout_response.json()
        assert logout_data["success"] is True

        # Step 5: Try authenticated request after logout (should fail)
        profile_response_after_logout = client.get("/api/auth/profile")
        assert profile_response_after_logout.status_code == 401

    def test_invalid_session_auto_cleanup(self, client_with_mock_redis, mock_redis):
        """Test that invalid sessions are automatically cleaned up."""
        client = client_with_mock_redis

        # Create invalid session data in Redis
        invalid_session_data = '{"user": {}}'  # Empty user object
        session_id = "invalid-session-123"
        mock_redis.get = AsyncMock(return_value=invalid_session_data)

        # Set the invalid session cookie
        client.cookies.set(settings.SESSION_COOKIE_NAME, session_id)

        # Try to access protected endpoint
        response = client.get("/api/auth/profile")

        # Should get 401 (not authenticated)
        assert response.status_code == 401

        # Verify that session was deleted from Redis
        mock_redis.delete.assert_called()

    def test_malformed_session_data_handling(self, client_with_mock_redis, mock_redis):
        """Test handling of malformed session data."""
        client = client_with_mock_redis

        # Set up Redis to return malformed JSON
        session_id = "malformed-session-123"
        mock_redis.get = AsyncMock(return_value="invalid json data {")

        client.cookies.set(settings.SESSION_COOKIE_NAME, session_id)

        # Try to access protected endpoint
        response = client.get("/api/auth/profile")

        # Should get 401 and handle gracefully
        assert response.status_code == 401

    def test_session_persistence_across_requests(self, client_with_mock_redis, test_user_data, mock_redis):
        """Test that session persists across multiple requests."""
        client = client_with_mock_redis

        # Login
        client.post("/api/auth/register", json=test_user_data)
        login_data = {
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        }
        login_response = client.post("/api/auth/login", json=login_data)
        assert login_response.status_code == 200

        # Get session cookie
        session_cookie = login_response.cookies[settings.SESSION_COOKIE_NAME]
        client.cookies.set(settings.SESSION_COOKIE_NAME, session_cookie)

        # Make multiple authenticated requests
        for i in range(3):
            response = client.get("/api/auth/profile")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["username"] == test_user_data["username"]

    def test_concurrent_sessions_isolation(self, mock_redis):
        """Test that concurrent sessions are properly isolated."""
        # Create two separate clients
        with patch.object(session_store, 'redis', mock_redis):
            client1 = TestClient(app)
            client2 = TestClient(app)

        # Different user data for each client
        user1_data = {
            "username": "user1",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1@example.com",
            "telegram_id": 111111111
        }

        user2_data = {
            "username": "user2",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2@example.com",
            "telegram_id": 222222222
        }

        # Register and login both users
        client1.post("/api/auth/register", json=user1_data)
        client2.post("/api/auth/register", json=user2_data)

        login1_response = client1.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        login2_response = client2.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })

        assert login1_response.status_code == 200
        assert login2_response.status_code == 200

        # Set cookies for each client
        client1.cookies.set(settings.SESSION_COOKIE_NAME,
                           login1_response.cookies[settings.SESSION_COOKIE_NAME])
        client2.cookies.set(settings.SESSION_COOKIE_NAME,
                           login2_response.cookies[settings.SESSION_COOKIE_NAME])

        # Verify each client gets their own profile
        profile1 = client1.get("/api/auth/profile")
        profile2 = client2.get("/api/auth/profile")

        assert profile1.status_code == 200
        assert profile2.status_code == 200

        profile1_data = profile1.json()["data"]
        profile2_data = profile2.json()["data"]

        assert profile1_data["username"] == "user1"
        assert profile2_data["username"] == "user2"
        assert profile1_data["telegram_id"] != profile2_data["telegram_id"]

    def test_session_expiry_handling(self, client_with_mock_redis, mock_redis):
        """Test handling of expired sessions."""
        client = client_with_mock_redis

        # Simulate expired session (Redis returns None)
        session_id = "expired-session-123"
        mock_redis.get = AsyncMock(return_value=None)

        client.cookies.set(settings.SESSION_COOKIE_NAME, session_id)

        # Try to access protected endpoint
        response = client.get("/api/auth/profile")

        # Should get 401
        assert response.status_code == 401

    def test_invalid_user_id_format_in_session(self, client_with_mock_redis, mock_redis):
        """Test handling of invalid user_id format in session."""
        client = client_with_mock_redis

        # Create session with invalid user_id format
        invalid_session_data = json.dumps({
            "user": {
                "user_id": "not_a_number",
                "username": "testuser"
            }
        })
        session_id = "invalid-userid-session-123"
        mock_redis.get = AsyncMock(return_value=invalid_session_data)

        client.cookies.set(settings.SESSION_COOKIE_NAME, session_id)

        # Try to access protected endpoint
        response = client.get("/api/auth/profile")

        # Should get 401 and session should be cleared
        assert response.status_code == 401
        mock_redis.delete.assert_called()

    def test_api_endpoints_require_authentication(self, client_with_mock_redis):
        """Test that protected API endpoints require authentication."""
        client = client_with_mock_redis

        protected_endpoints = [
            ("/api/auth/profile", "GET"),
            ("/api/periods", "GET"),
            ("/api/financial_centers", "GET"),
            ("/api/cost_centers", "GET"),
            ("/api/nomenclatures", "GET"),
            ("/api/registry", "GET"),
            ("/api/products", "GET"),
        ]

        for endpoint, method in protected_endpoints:
            if method == "GET":
                response = client.get(endpoint)
            elif method == "POST":
                response = client.post(endpoint, json={})

            assert response.status_code == 401, f"Expected 401 for {method} {endpoint}"

    def test_session_data_validation_on_protected_endpoints(self, client_with_mock_redis, mock_redis):
        """Test that protected endpoints validate session data properly."""
        client = client_with_mock_redis

        # Test cases for invalid session data
        invalid_sessions = [
            ("empty_user", '{"user": {}}'),
            ("missing_user_id", '{"user": {"username": "test"}}'),
            ("null_user_id", '{"user": {"user_id": null, "username": "test"}}'),
            ("zero_user_id", '{"user": {"user_id": 0, "username": "test"}}'),  # This is currently invalid due to falsy check
            ("string_user_id", '{"user": {"user_id": "42", "username": "test"}}'),  # This should be valid
        ]

        for test_name, session_data in invalid_sessions:
            session_id = f"{test_name}-session-123"
            mock_redis.get = AsyncMock(return_value=session_data)
            mock_redis.delete = AsyncMock(return_value=1)

            client.cookies.set(settings.SESSION_COOKIE_NAME, session_id)

            response = client.get("/api/auth/profile")

            if test_name in ["string_user_id"]:
                # These should be valid
                assert response.status_code == 200, f"Expected 200 for {test_name}"
            else:
                # These should be invalid (including zero_user_id due to current logic)
                assert response.status_code == 401, f"Expected 401 for {test_name}"

    def test_redis_connection_failure_handling(self, mock_redis):
        """Test that application handles Redis connection failures gracefully."""
        # Configure mock to simulate Redis failures
        mock_redis.get = AsyncMock(side_effect=Exception("Redis connection failed"))
        mock_redis.setex = AsyncMock(side_effect=Exception("Redis connection failed"))

        with patch.object(session_store, 'redis', mock_redis):
            client = TestClient(app)

            # Should still be able to make requests, but sessions won't persist
            response = client.get("/api/auth/login")

            # Should get the login page/endpoint response, not a server error
            assert response.status_code in [200, 405]  # 405 if GET not allowed on login endpoint

    def test_session_middleware_with_real_endpoints(self, client_with_mock_redis, test_user_data, mock_redis):
        """Test session middleware integration with real API endpoints."""
        client = client_with_mock_redis

        # Register and login
        client.post("/api/auth/register", json=test_user_data)
        login_response = client.post("/api/auth/login", json={
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        })

        session_cookie = login_response.cookies[settings.SESSION_COOKIE_NAME]
        client.cookies.set(settings.SESSION_COOKIE_NAME, session_cookie)

        # Test that session works with various endpoints
        endpoints_to_test = [
            "/api/auth/profile",
            "/api/periods",
            "/api/financial_centers",
            "/api/cost_centers",
            "/api/nomenclatures"
        ]

        for endpoint in endpoints_to_test:
            response = client.get(endpoint)
            # Should not get 401 (authentication should work)
            assert response.status_code != 401, f"Authentication failed for {endpoint}"
            # Most endpoints should return 200 (or at least not 401/500)
            assert response.status_code < 500, f"Server error for {endpoint}"

    def test_logout_clears_session_completely(self, client_with_mock_redis, test_user_data, mock_redis):
        """Test that logout completely clears session data."""
        client = client_with_mock_redis

        # Login
        client.post("/api/auth/register", json=test_user_data)
        login_response = client.post("/api/auth/login", json={
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        })

        session_cookie = login_response.cookies[settings.SESSION_COOKIE_NAME]
        client.cookies.set(settings.SESSION_COOKIE_NAME, session_cookie)

        # Verify authenticated
        profile_response = client.get("/api/auth/profile")
        assert profile_response.status_code == 200

        # Logout
        logout_response = client.post("/api/auth/logout")
        assert logout_response.status_code == 200

        # Verify session is completely cleared
        mock_redis.delete.assert_called()

        # Try to use same session cookie - should fail
        profile_response_after = client.get("/api/auth/profile")
        assert profile_response_after.status_code == 401


class TestEdgeCasesAndErrorHandling:
    """Test edge cases and error handling in authentication."""

    def test_multiple_rapid_login_logout_cycles(self, mock_redis):
        """Test rapid login/logout cycles don't cause issues."""
        with patch.object(session_store, 'redis', mock_redis):
            client = TestClient(app)

        user_data = {
            "username": "rapiduser",
            "password": "Password123!",
            "user_name": "Rapid User",
            "email": "rapid@example.com",
            "telegram_id": 999999999
        }

        # Register once
        client.post("/api/auth/register", json=user_data)

        # Multiple rapid login/logout cycles
        for i in range(5):
            # Login
            login_response = client.post("/api/auth/login", json={
                "username": user_data["username"],
                "password": user_data["password"]
            })
            assert login_response.status_code == 200

            session_cookie = login_response.cookies[settings.SESSION_COOKIE_NAME]
            client.cookies.set(settings.SESSION_COOKIE_NAME, session_cookie)

            # Verify login worked
            profile_response = client.get("/api/auth/profile")
            assert profile_response.status_code == 200

            # Logout
            logout_response = client.post("/api/auth/logout")
            assert logout_response.status_code == 200

            # Verify logout worked
            profile_response_after = client.get("/api/auth/profile")
            assert profile_response_after.status_code == 401

    def test_large_session_data_handling(self, client_with_mock_redis, mock_redis):
        """Test handling of large session data (shouldn't happen in normal flow)."""
        client = client_with_mock_redis

        # Create very large session data
        large_session_data = {
            "user": {
                "user_id": 42,
                "username": "testuser",
                "large_data": "x" * 10000  # Large string
            }
        }
        session_id = "large-session-123"
        mock_redis.get = AsyncMock(return_value=json.dumps(large_session_data))

        client.cookies.set(settings.SESSION_COOKIE_NAME, session_id)

        # Should handle large data gracefully
        response = client.get("/api/auth/profile")

        # Should either work or fail gracefully (not cause server error)
        assert response.status_code in [200, 401]
        assert response.status_code != 500

    def test_special_characters_in_session_data(self, client_with_mock_redis, mock_redis):
        """Test handling of special characters in session data."""
        client = client_with_mock_redis

        # Session with special characters
        special_session_data = {
            "user": {
                "user_id": 42,
                "username": "test_user_спец_символы",
                "user_name": "Test User 特殊字符 🚀"
            }
        }
        session_id = "special-session-123"
        mock_redis.get = AsyncMock(return_value=json.dumps(special_session_data, ensure_ascii=False))

        client.cookies.set(settings.SESSION_COOKIE_NAME, session_id)

        response = client.get("/api/auth/profile")

        # Should handle special characters properly
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True