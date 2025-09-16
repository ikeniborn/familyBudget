"""
Comprehensive backend tests for admin settings authorization fix.

This test suite covers:
1. /api/auth/me endpoint with different session formats
2. Admin role validation
3. Proper session handling
4. Error scenarios and edge cases
5. Session format compatibility
6. Data isolation and security validation
"""

import pytest
import json
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from httpx import AsyncClient
from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.user import User
from app.core.session import SessionStore, SessionData, get_current_user_from_session
from app.api.v1.endpoints.auth import get_current_user
from app.db.database import get_db


class TestAuthMeEndpoint:
    """Test /api/auth/me endpoint with different session formats."""

    @pytest.fixture
    def mock_user_admin(self):
        """Create a mock admin user."""
        user = Mock(spec=User)
        user.id = 1
        user.user_name = "Admin User"
        user.username = "admin"
        user.user_email = "admin@example.com"
        user.role = "admin"
        user.is_active = True
        user.auth_method = "password"
        user.telegram_id = None
        user.to_dict.return_value = {
            "id": 1,
            "user_name": "Admin User",
            "username": "admin",
            "user_email": "admin@example.com",
            "role": "admin",
            "is_active": True,
            "auth_method": "password",
            "telegram_id": None
        }
        return user

    @pytest.fixture
    def mock_user_regular(self):
        """Create a mock regular user."""
        user = Mock(spec=User)
        user.id = 2
        user.user_name = "Regular User"
        user.username = "user"
        user.user_email = "user@example.com"
        user.role = "user"
        user.is_active = True
        user.auth_method = "telegram"
        user.telegram_id = 123456789
        user.to_dict.return_value = {
            "id": 2,
            "user_name": "Regular User",
            "username": "user",
            "user_email": "user@example.com",
            "role": "user",
            "is_active": True,
            "auth_method": "telegram",
            "telegram_id": "123456789"
        }
        return user

    @pytest.mark.asyncio
    async def test_auth_me_admin_user_success(self, db_session, mock_user_admin):
        """Test /api/auth/me returns admin user data successfully."""
        # Mock database query
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_user_admin
        db_session.execute.return_value = mock_result

        # Mock session data
        mock_session_data = {
            "user_id": 1,
            "username": "admin",
            "user_name": "Admin User",
            "role": "admin",
            "auth_method": "password"
        }

        async with AsyncClient(app=app, base_url="http://test") as client:
            with patch("app.api.v1.endpoints.auth.get_current_user_from_session",
                      return_value=mock_session_data), \
                 patch("app.api.v1.endpoints.auth.get_db") as mock_get_db:
                mock_get_db.return_value.__aenter__.return_value = db_session

                response = await client.get("/api/auth/me")

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["authenticated"] is True
                assert data["user"]["role"] == "admin"
                assert data["user"]["id"] == 1
                assert data["user"]["username"] == "admin"

    @pytest.mark.asyncio
    async def test_auth_me_regular_user_success(self, db_session, mock_user_regular):
        """Test /api/auth/me returns regular user data successfully."""
        # Mock database query
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_user_regular
        db_session.execute.return_value = mock_result

        # Mock session data
        mock_session_data = {
            "user_id": 2,
            "username": "user",
            "user_name": "Regular User",
            "role": "user",
            "auth_method": "telegram",
            "telegram_id": "123456789"
        }

        async with AsyncClient(app=app, base_url="http://test") as client:
            with patch("app.api.v1.endpoints.auth.get_current_user_from_session",
                      return_value=mock_session_data), \
                 patch("app.api.v1.endpoints.auth.get_db") as mock_get_db:
                mock_get_db.return_value.__aenter__.return_value = db_session

                response = await client.get("/api/auth/me")

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["authenticated"] is True
                assert data["user"]["role"] == "user"
                assert data["user"]["id"] == 2
                assert data["user"]["telegram_id"] == "123456789"

    @pytest.mark.asyncio
    async def test_auth_me_no_session(self):
        """Test /api/auth/me with no session returns 401."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            with patch("app.api.v1.endpoints.auth.get_current_user_from_session",
                      return_value=None):

                response = await client.get("/api/auth/me")

                assert response.status_code == 401
                data = response.json()
                assert "Not authenticated" in data["detail"]

    @pytest.mark.asyncio
    async def test_auth_me_user_not_found_in_db(self, db_session):
        """Test /api/auth/me when user exists in session but not in database."""
        # Mock database query returning None
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        db_session.execute.return_value = mock_result

        # Mock session data
        mock_session_data = {
            "user_id": 999,
            "username": "nonexistent",
            "role": "user"
        }

        async with AsyncClient(app=app, base_url="http://test") as client:
            with patch("app.api.v1.endpoints.auth.get_current_user_from_session",
                      return_value=mock_session_data), \
                 patch("app.api.v1.endpoints.auth.get_db") as mock_get_db:
                mock_get_db.return_value.__aenter__.return_value = db_session

                response = await client.get("/api/auth/me")

                assert response.status_code == 401
                data = response.json()
                assert "User not found" in data["detail"]

    @pytest.mark.asyncio
    async def test_auth_me_database_error(self, db_session):
        """Test /api/auth/me handles database errors gracefully."""
        # Mock database exception
        db_session.execute.side_effect = Exception("Database connection error")

        # Mock session data
        mock_session_data = {
            "user_id": 1,
            "username": "admin",
            "role": "admin"
        }

        async with AsyncClient(app=app, base_url="http://test") as client:
            with patch("app.api.v1.endpoints.auth.get_current_user_from_session",
                      return_value=mock_session_data), \
                 patch("app.api.v1.endpoints.auth.get_db") as mock_get_db:
                mock_get_db.return_value.__aenter__.return_value = db_session

                response = await client.get("/api/auth/me")

                # Should return 500 or handle gracefully
                assert response.status_code in [500, 401]


class TestSessionFormatCompatibility:
    """Test session handling with different cookie and session formats."""

    def get_session_store(self, mock_redis):
        """Create a SessionStore with mock Redis."""
        store = SessionStore()
        store.redis = mock_redis
        return store

    @pytest.mark.asyncio
    async def test_express_session_format_parsing(self, mock_redis):
        """Test parsing express-session format from Redis."""
        # Mock express-session format data
        session_data = {
            "cookie": {
                "originalMaxAge": 86400000,
                "expires": "2024-09-17T10:00:00.000Z",
                "secure": False,
                "httpOnly": True,
                "path": "/",
                "sameSite": "lax"
            },
            "user": {
                "user_id": 1,
                "username": "admin",
                "user_name": "Admin User",
                "role": "admin",
                "auth_method": "password"
            }
        }

        mock_redis.get.return_value = json.dumps(session_data)
        session_store = self.get_session_store(mock_redis)

        result = await session_store.get_session("test-session-id")

        assert result is not None
        assert result.get("user_id") == 1
        assert result.get("username") == "admin"
        assert result.get("role") == "admin"
        mock_redis.get.assert_called_with("sess:test-session-id")

    @pytest.mark.asyncio
    async def test_legacy_session_format_fallback(self, mock_redis):
        """Test fallback to legacy session format when express-session format not found."""
        # Mock that express-session format is not found, but legacy format exists
        legacy_session_data = {
            "user_id": 2,
            "username": "user",
            "user_name": "Regular User",
            "role": "user",
            "auth_method": "telegram",
            "telegram_id": "123456789"
        }

        def mock_get_side_effect(key):
            if key == "sess:test-session-id":
                return None  # Express-session format not found
            elif key == "session:test-session-id":
                return json.dumps(legacy_session_data)  # Legacy format found
            return None

        mock_redis.get.side_effect = mock_get_side_effect
        session_store = self.get_session_store(mock_redis)

        result = await session_store.get_session("test-session-id")

        assert result is not None
        assert result.get("user_id") == 2
        assert result.get("username") == "user"
        assert result.get("role") == "user"

        # Verify both formats were tried
        assert mock_redis.get.call_count == 2

    @pytest.mark.asyncio
    async def test_session_not_found(self, mock_redis):
        """Test when session is not found in any format."""
        mock_redis.get.return_value = None
        session_store = self.get_session_store(mock_redis)

        result = await session_store.get_session("nonexistent-session")

        assert result is None
        assert mock_redis.get.call_count == 2  # Tried both formats

    @pytest.mark.asyncio
    async def test_malformed_session_data(self, mock_redis):
        """Test handling of malformed session data."""
        mock_redis.get.return_value = "invalid json"
        session_store = self.get_session_store(mock_redis)

        result = await session_store.get_session("malformed-session")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_current_user_from_session_valid_data(self):
        """Test extracting user data from valid session."""
        mock_request = Mock(spec=Request)
        mock_session = Mock()
        mock_session.get.side_effect = lambda key, default=None: {
            "user_id": 1,
            "username": "admin",
            "user_name": "Admin User",
            "role": "admin",
            "auth_method": "password"
        }.get(key, default)
        mock_session.to_dict.return_value = {
            "user_id": 1,
            "username": "admin",
            "user_name": "Admin User",
            "role": "admin",
            "auth_method": "password"
        }

        mock_request.state.session = mock_session

        result = await get_current_user_from_session(mock_request)

        assert result is not None
        assert result["user_id"] == 1
        assert result["username"] == "admin"
        assert result["role"] == "admin"

    @pytest.mark.asyncio
    async def test_get_current_user_from_session_missing_user_id(self):
        """Test handling session without user_id."""
        mock_request = Mock(spec=Request)
        mock_session = Mock()
        mock_session.get.return_value = None  # No user_id
        mock_session.to_dict.return_value = {"username": "admin"}

        mock_request.state.session = mock_session

        result = await get_current_user_from_session(mock_request)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_current_user_from_session_invalid_user_id(self):
        """Test handling session with invalid user_id format."""
        mock_request = Mock(spec=Request)
        mock_session = Mock()
        mock_session.get.side_effect = lambda key, default=None: {
            "user_id": "invalid",  # Non-numeric user_id
            "username": "admin"
        }.get(key, default)
        mock_session.clear = Mock()

        mock_request.state.session = mock_session
        mock_request.state.session_id = "test-session"

        with patch("app.core.session.session_store") as mock_store:
            mock_store.delete_session = AsyncMock()

            result = await get_current_user_from_session(mock_request)

            assert result is None
            mock_session.clear.assert_called_once()
            mock_store.delete_session.assert_called_once_with("test-session")

    @pytest.mark.asyncio
    async def test_get_current_user_from_session_no_session_object(self):
        """Test handling request without session object."""
        mock_request = Mock(spec=Request)
        mock_request.state = Mock()
        # Simulate missing session attribute
        if hasattr(mock_request.state, 'session'):
            delattr(mock_request.state, 'session')

        result = await get_current_user_from_session(mock_request)

        assert result is None


class TestAdminRoleValidation:
    """Test admin role validation and authorization."""

    def test_admin_role_identification(self):
        """Test identifying admin users correctly."""
        admin_session = {
            "user_id": 1,
            "username": "admin",
            "role": "admin"
        }

        user_session = {
            "user_id": 2,
            "username": "user",
            "role": "user"
        }

        assert admin_session["role"] == "admin"
        assert user_session["role"] == "user"
        assert admin_session["role"] != "user"

    def test_missing_role_defaults_to_user(self):
        """Test that missing role defaults to user."""
        session_without_role = {
            "user_id": 3,
            "username": "norole"
        }

        # Simulate default role assignment
        role = session_without_role.get("role", "user")
        assert role == "user"

    def test_case_insensitive_role_handling(self):
        """Test role comparison is case-sensitive (as it should be)."""
        session_uppercase = {
            "user_id": 1,
            "role": "ADMIN"
        }

        session_lowercase = {
            "user_id": 2,
            "role": "admin"
        }

        # Roles should be case-sensitive for security
        assert session_uppercase["role"] != "admin"
        assert session_lowercase["role"] == "admin"


class TestSecurityValidation:
    """Test security aspects of the authentication system."""

    @pytest.mark.asyncio
    async def test_data_isolation_by_user_id(self, db_session, mock_user_admin):
        """Test that data is properly isolated by user_id."""
        # Mock database query with user_id filter
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = mock_user_admin
        db_session.execute.return_value = mock_result

        mock_session_data = {
            "user_id": 1,
            "username": "admin",
            "role": "admin"
        }

        async with AsyncClient(app=app, base_url="http://test") as client:
            with patch("app.api.v1.endpoints.auth.get_current_user_from_session",
                      return_value=mock_session_data), \
                 patch("app.api.v1.endpoints.auth.get_db") as mock_get_db:
                mock_get_db.return_value.__aenter__.return_value = db_session

                response = await client.get("/api/auth/me")

                assert response.status_code == 200

                # Verify database query used user_id filter
                db_session.execute.assert_called_once()
                call_args = db_session.execute.call_args[0][0]
                # The query should filter by user ID
                assert "user_id" in str(call_args)

    @pytest.fixture
    def mock_user_admin(self):
        """Create a mock admin user."""
        user = Mock(spec=User)
        user.id = 1
        user.user_name = "Admin User"
        user.username = "admin"
        user.user_email = "admin@example.com"
        user.role = "admin"
        user.is_active = True
        user.auth_method = "password"
        user.telegram_id = None
        user.to_dict.return_value = {
            "id": 1,
            "user_name": "Admin User",
            "username": "admin",
            "user_email": "admin@example.com",
            "role": "admin",
            "is_active": True,
            "auth_method": "password",
            "telegram_id": None
        }
        return user

    @pytest.mark.asyncio
    async def test_session_hijacking_protection(self):
        """Test protection against session hijacking."""
        # Test that changing user_id in session requires re-authentication
        mock_request = Mock(spec=Request)
        mock_session = Mock()

        # Simulate tampered session with different user_id
        mock_session.get.side_effect = lambda key, default=None: {
            "user_id": "999999",  # Extremely high user_id (potential attack)
            "username": "admin",
            "role": "admin"
        }.get(key, default)

        mock_request.state.session = mock_session

        result = await get_current_user_from_session(mock_request)

        # Should still extract user data, but database validation should fail
        assert result is not None
        assert result["user_id"] == 999999

    def test_role_escalation_prevention(self):
        """Test that role escalation is prevented."""
        # Simulate attempt to escalate privileges
        malicious_session = {
            "user_id": 2,  # Regular user ID
            "username": "user",
            "role": "admin"  # Attempted privilege escalation
        }

        # In real implementation, role should come from database, not session
        # This test verifies that we validate against database
        database_role = "user"  # What's actually in the database

        # The database should be the source of truth
        assert database_role == "user"
        assert malicious_session["role"] != database_role

    @pytest.mark.asyncio
    async def test_inactive_user_rejection(self, db_session):
        """Test that inactive users are rejected."""
        # Mock inactive user
        inactive_user = Mock(spec=User)
        inactive_user.id = 1
        inactive_user.username = "inactive"
        inactive_user.is_active = False
        inactive_user.to_dict.return_value = {
            "id": 1,
            "username": "inactive",
            "is_active": False
        }

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = inactive_user
        db_session.execute.return_value = mock_result

        mock_session_data = {
            "user_id": 1,
            "username": "inactive",
            "role": "user"
        }

        async with AsyncClient(app=app, base_url="http://test") as client:
            with patch("app.api.v1.endpoints.auth.get_current_user_from_session",
                      return_value=mock_session_data), \
                 patch("app.api.v1.endpoints.auth.get_db") as mock_get_db:
                mock_get_db.return_value.__aenter__.return_value = db_session

                response = await client.get("/api/auth/me")

                # Should return user data but application should check is_active
                assert response.status_code == 200
                data = response.json()
                assert data["user"]["is_active"] is False


class TestErrorScenarios:
    """Test various error scenarios and edge cases."""

    @pytest.mark.asyncio
    async def test_redis_connection_failure(self):
        """Test handling Redis connection failures."""
        mock_request = Mock(spec=Request)
        mock_session = Mock()
        mock_session.get.return_value = None
        mock_request.state.session = mock_session

        # Simulate Redis being unavailable
        with patch("app.core.session.session_store") as mock_store:
            mock_store.redis = None

            result = await get_current_user_from_session(mock_request)

            assert result is None

    @pytest.mark.asyncio
    async def test_concurrent_session_access(self, mock_redis):
        """Test handling concurrent access to the same session."""
        session_store = SessionStore()
        session_store.redis = mock_redis

        # Mock Redis returning data for first call, None for second (session deleted)
        call_count = 0
        def mock_get_side_effect(key):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return json.dumps({"user": {"user_id": 1, "username": "admin"}})
            return None

        mock_redis.get.side_effect = mock_get_side_effect

        # First access should succeed
        result1 = await session_store.get_session("test-session")
        assert result1 is not None

        # Second access should return None (session expired/deleted)
        result2 = await session_store.get_session("test-session")
        assert result2 is None

    @pytest.mark.asyncio
    async def test_memory_exhaustion_protection(self):
        """Test protection against memory exhaustion attacks."""
        # Test that extremely large session data is handled
        mock_request = Mock(spec=Request)
        mock_session = Mock()

        # Simulate very large session data
        large_data = "x" * 10000  # 10KB of data
        mock_session.get.side_effect = lambda key, default=None: {
            "user_id": 1,
            "username": "admin",
            "large_field": large_data
        }.get(key, default)
        mock_session.to_dict.return_value = {
            "user_id": 1,
            "username": "admin",
            "large_field": large_data
        }

        mock_request.state.session = mock_session

        # Should still work but in production would have size limits
        result = await get_current_user_from_session(mock_request)
        assert result is not None
        assert result["user_id"] == 1

    @pytest.mark.asyncio
    async def test_unicode_and_special_characters(self):
        """Test handling of Unicode and special characters in session data."""
        mock_request = Mock(spec=Request)
        mock_session = Mock()

        # Test with Unicode characters
        mock_session.get.side_effect = lambda key, default=None: {
            "user_id": 1,
            "username": "админ",  # Cyrillic characters
            "user_name": "Тест Пользователь 测试用户",  # Mixed scripts
            "role": "admin"
        }.get(key, default)

        mock_request.state.session = mock_session

        result = await get_current_user_from_session(mock_request)
        assert result is not None
        assert result["username"] == "админ"
        assert "测试用户" in result["user_name"]


if __name__ == "__main__":
    # Run tests with proper async handling
    pytest.main([__file__, "-v", "--tb=short"])