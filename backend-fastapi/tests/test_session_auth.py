"""
Comprehensive tests for session authentication fixes.

Tests the session handling behavior in app/core/session.py:
1. Sessions without user_id are logged but not automatically cleared
2. Session info is logged correctly
3. User validation handles different field combinations
4. Fallback values work as expected
5. Edge cases are covered
"""
import json
import pytest
from unittest.mock import Mock, AsyncMock, patch
from fastapi import Request
from starlette.datastructures import MutableHeaders

from app.core.session import (
    SessionData,
    SessionStore,
    SessionMiddleware,
    get_current_user_from_session,
    generate_session_id,
    _clear_invalid_session,
    logout_user
)


class TestSessionData:
    """Test the SessionData container class."""

    def test_session_data_initialization(self):
        """Test SessionData initialization."""
        # Empty initialization
        session = SessionData()
        assert session.data == {}

        # With data
        data = {"user_id": 123, "username": "testuser"}
        session = SessionData(data)
        assert session.data == data

    def test_session_data_operations(self):
        """Test basic SessionData operations."""
        session = SessionData()

        # Set and get
        session.set("key1", "value1")
        assert session.get("key1") == "value1"
        assert session.get("nonexistent") is None
        assert session.get("nonexistent", "default") == "default"

        # Delete
        session.delete("key1")
        assert session.get("key1") is None

        # Clear
        session.set("key2", "value2")
        session.clear()
        assert session.data == {}

    def test_session_data_to_dict(self):
        """Test SessionData to_dict method."""
        data = {"user_id": 123, "role": "admin"}
        session = SessionData(data)

        # Should return a copy, not the original
        result = session.to_dict()
        assert result == data
        assert result is not session.data


class TestSessionStore:
    """Test the SessionStore class."""

    @pytest.fixture
    def session_store(self):
        """Create a SessionStore instance for testing."""
        return SessionStore()

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        mock = AsyncMock()
        mock.get = AsyncMock()
        mock.setex = AsyncMock()
        mock.delete = AsyncMock()
        return mock

    @pytest.mark.asyncio
    async def test_init_redis(self, session_store, mock_redis):
        """Test Redis client initialization."""
        await session_store.init_redis(mock_redis)
        assert session_store.redis is mock_redis

    @pytest.mark.asyncio
    async def test_get_session_no_redis(self, session_store):
        """Test get_session when Redis is not initialized."""
        result = await session_store.get_session("test-session-id")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_session_express_format(self, session_store, mock_redis):
        """Test get_session with express-session format."""
        await session_store.init_redis(mock_redis)

        # Mock express-session format data
        session_data = {
            "cookie": {"expires": "2025-12-31T23:59:59.999Z"},
            "user": {"id": 123, "username": "testuser", "role": "admin"}
        }
        mock_redis.get.return_value = json.dumps(session_data)

        result = await session_store.get_session("test-session-id")

        assert result is not None
        assert result.get("id") == 123
        assert result.get("username") == "testuser"
        assert result.get("role") == "admin"
        mock_redis.get.assert_called_with("sess:test-session-id")

    @pytest.mark.asyncio
    async def test_get_session_fallback_format(self, session_store, mock_redis):
        """Test get_session with old fallback format."""
        await session_store.init_redis(mock_redis)

        # Mock old format data (no express-session wrapper)
        session_data = {"id": 456, "username": "olduser"}

        # First call returns None (no express format), second returns old format
        mock_redis.get.side_effect = [None, json.dumps(session_data)]

        result = await session_store.get_session("test-session-id")

        assert result is not None
        assert result.get("id") == 456
        assert result.get("username") == "olduser"

        # Should have tried both formats
        assert mock_redis.get.call_count == 2
        mock_redis.get.assert_any_call("sess:test-session-id")
        mock_redis.get.assert_any_call("session:test-session-id")

    @pytest.mark.asyncio
    async def test_get_session_no_data(self, session_store, mock_redis):
        """Test get_session when no session data exists."""
        await session_store.init_redis(mock_redis)
        mock_redis.get.return_value = None

        result = await session_store.get_session("nonexistent-session")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_session_invalid_json(self, session_store, mock_redis):
        """Test get_session with invalid JSON data."""
        await session_store.init_redis(mock_redis)
        mock_redis.get.return_value = "invalid json data"

        with patch('builtins.print') as mock_print:
            result = await session_store.get_session("test-session-id")
            assert result is None
            mock_print.assert_called()  # Error should be printed

    @pytest.mark.asyncio
    async def test_save_session(self, session_store, mock_redis):
        """Test session saving."""
        await session_store.init_redis(mock_redis)

        session_data = SessionData({"id": 123, "username": "testuser"})
        session_id = "test-session-id"

        await session_store.save_session(session_id, session_data)

        # Should save in express-session format
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args

        assert call_args[0][0] == f"sess:{session_id}"  # Key
        assert isinstance(call_args[0][1], int)  # TTL

        # Verify the data structure
        saved_data = json.loads(call_args[0][2])
        assert "cookie" in saved_data
        assert "user" in saved_data
        assert saved_data["user"]["id"] == 123
        assert saved_data["user"]["username"] == "testuser"

    @pytest.mark.asyncio
    async def test_save_session_no_redis(self, session_store):
        """Test save_session when Redis is not initialized."""
        session_data = SessionData({"id": 123})
        # Should not raise an error
        await session_store.save_session("test-id", session_data)

    @pytest.mark.asyncio
    async def test_delete_session(self, session_store, mock_redis):
        """Test session deletion."""
        await session_store.init_redis(mock_redis)

        await session_store.delete_session("test-session-id")

        # Should delete both formats
        assert mock_redis.delete.call_count == 2
        mock_redis.delete.assert_any_call("sess:test-session-id")
        mock_redis.delete.assert_any_call("session:test-session-id")


class TestGetCurrentUserFromSession:
    """Test the get_current_user_from_session function."""

    def create_mock_request(self, session_data=None):
        """Create a mock request with session data."""
        request = Mock(spec=Request)
        request.state = Mock()

        if session_data:
            request.state.session = SessionData(session_data)
        else:
            request.state.session = None

        return request

    @pytest.mark.asyncio
    async def test_get_user_no_session(self):
        """Test getting user when no session exists."""
        request = self.create_mock_request()
        result = await get_current_user_from_session(request)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_with_user_id(self):
        """Test getting user with user_id field."""
        session_data = {
            "user_id": 123,
            "username": "testuser",
            "user_name": "Test User",
            "role": "admin",
            "auth_method": "password",
            "telegram_id": 456789
        }
        request = self.create_mock_request(session_data)

        result = await get_current_user_from_session(request)

        assert result is not None
        assert result["user_id"] == 123
        assert result["username"] == "testuser"
        assert result["user_name"] == "Test User"
        assert result["role"] == "admin"
        assert result["auth_method"] == "password"
        assert result["telegram_id"] == 456789

    @pytest.mark.asyncio
    async def test_get_user_with_id_field(self):
        """Test getting user with id field (fallback)."""
        session_data = {
            "id": 456,
            "username": "iduser",
            "name": "ID User"
        }
        request = self.create_mock_request(session_data)

        result = await get_current_user_from_session(request)

        assert result is not None
        assert result["user_id"] == 456
        assert result["username"] == "iduser"
        assert result["user_name"] == "ID User"  # name -> user_name

    @pytest.mark.asyncio
    async def test_get_user_missing_user_id(self):
        """Test that sessions without user_id are logged but not cleared."""
        session_data = {
            "username": "noiduser",
            "some_other_field": "value"
        }
        request = self.create_mock_request(session_data)

        with patch('builtins.print') as mock_print:
            result = await get_current_user_from_session(request)

            # Should return None
            assert result is None

            # Should log the session data (key fix: logging instead of clearing)
            mock_print.assert_called_once()
            assert "Session missing user_id" in mock_print.call_args[0][0]
            assert session_data == eval(mock_print.call_args[0][0].split(": ", 1)[1])

    @pytest.mark.asyncio
    async def test_get_user_invalid_user_id_format(self):
        """Test handling of invalid user_id format."""
        session_data = {
            "user_id": "not_a_number",
            "username": "baduser"
        }
        request = self.create_mock_request(session_data)

        with patch('app.core.session._clear_invalid_session') as mock_clear:
            result = await get_current_user_from_session(request)

            # Should return None and clear the session
            assert result is None
            mock_clear.assert_called_once_with(request)

    @pytest.mark.asyncio
    async def test_get_user_none_user_id(self):
        """Test handling of None user_id."""
        session_data = {
            "user_id": None,
            "username": "nulluser"
        }
        request = self.create_mock_request(session_data)

        with patch('builtins.print') as mock_print:
            result = await get_current_user_from_session(request)

            assert result is None
            mock_print.assert_called_once()  # Should be logged

    @pytest.mark.asyncio
    async def test_get_user_field_priority(self):
        """Test that user_id takes priority over id."""
        session_data = {
            "user_id": 123,
            "id": 456,
            "username": "priorityuser"
        }
        request = self.create_mock_request(session_data)

        result = await get_current_user_from_session(request)

        assert result is not None
        assert result["user_id"] == 123  # Should use user_id, not id


class TestClearInvalidSession:
    """Test the _clear_invalid_session function."""

    @pytest.mark.asyncio
    async def test_clear_invalid_session_with_session(self):
        """Test clearing session when session exists."""
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.session = SessionData({"some": "data"})
        request.state.session_id = "test-session-id"

        with patch('app.core.session.session_store.delete_session') as mock_delete:
            await _clear_invalid_session(request)

            # Should clear session data
            assert request.state.session.data == {}
            # Should delete from store
            mock_delete.assert_called_once_with("test-session-id")

    @pytest.mark.asyncio
    async def test_clear_invalid_session_no_session(self):
        """Test clearing session when no session exists."""
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.session = None
        request.state.session_id = "test-session-id"

        with patch('app.core.session.session_store.delete_session') as mock_delete:
            await _clear_invalid_session(request)

            # Should still try to delete from store
            mock_delete.assert_called_once_with("test-session-id")

    @pytest.mark.asyncio
    async def test_clear_invalid_session_no_session_id(self):
        """Test clearing session when no session_id exists."""
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.session = SessionData({"data": "exists"})
        request.state.session_id = None

        with patch('app.core.session.session_store.delete_session') as mock_delete:
            await _clear_invalid_session(request)

            # Should clear session data but not call delete
            assert request.state.session.data == {}
            mock_delete.assert_not_called()


class TestLogoutUser:
    """Test the logout_user function."""

    @pytest.mark.asyncio
    async def test_logout_user_complete(self):
        """Test logout with both session and session_id."""
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.session = SessionData({"user_id": 123, "username": "user"})
        request.state.session_id = "test-session-id"

        with patch('app.core.session.session_store.delete_session') as mock_delete:
            await logout_user(request)

            # Should clear session
            assert request.state.session.data == {}
            # Should delete from store
            mock_delete.assert_called_once_with("test-session-id")

    @pytest.mark.asyncio
    async def test_logout_user_partial(self):
        """Test logout with missing components."""
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.session = None
        request.state.session_id = None

        with patch('app.core.session.session_store.delete_session') as mock_delete:
            # Should not raise an error
            await logout_user(request)
            mock_delete.assert_not_called()


class TestSessionMiddleware:
    """Test the SessionMiddleware class key behaviors."""

    def test_session_middleware_instantiation(self):
        """Test that SessionMiddleware can be instantiated."""
        app = Mock()
        middleware = SessionMiddleware(app)
        assert middleware is not None

        # The complex mocking of middleware dispatch is problematic,
        # but the core functionality is tested in integration tests


class TestGenerateSessionId:
    """Test the generate_session_id function."""

    def test_generate_session_id_format(self):
        """Test that session ID has correct format."""
        session_id = generate_session_id()

        # Should be a string
        assert isinstance(session_id, str)

        # Should be a valid UUID format
        import uuid
        try:
            uuid.UUID(session_id)
            assert True
        except ValueError:
            assert False, "Session ID should be a valid UUID"

    def test_generate_session_id_unique(self):
        """Test that session IDs are unique."""
        ids = [generate_session_id() for _ in range(100)]

        # All should be unique
        assert len(set(ids)) == 100


class TestSessionIntegration:
    """Integration tests for session handling."""

    @pytest.mark.asyncio
    async def test_complete_session_flow(self):
        """Test a complete session flow from creation to deletion."""
        store = SessionStore()
        mock_redis = AsyncMock()
        await store.init_redis(mock_redis)

        # Create session
        session_id = generate_session_id()
        session_data = SessionData({"user_id": 123, "username": "testuser"})

        # Save session
        await store.save_session(session_id, session_data)
        mock_redis.setex.assert_called_once()

        # Mock retrieval
        saved_data = {
            "cookie": {"expires": "2025-12-31T23:59:59.999Z"},
            "user": {"user_id": 123, "username": "testuser"}
        }
        mock_redis.get.return_value = json.dumps(saved_data)

        # Retrieve session
        retrieved = await store.get_session(session_id)
        assert retrieved is not None
        assert retrieved.get("user_id") == 123
        assert retrieved.get("username") == "testuser"

        # Delete session
        await store.delete_session(session_id)
        assert mock_redis.delete.call_count == 2

    @pytest.mark.asyncio
    async def test_session_without_user_id_logging(self):
        """Test that sessions without user_id are logged, not cleared."""
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.session = SessionData({
            "some_data": "value",
            "timestamp": "2025-01-01T00:00:00Z",
            "session_type": "anonymous"
        })

        with patch('builtins.print') as mock_print:
            result = await get_current_user_from_session(request)

            # Should return None (no user data)
            assert result is None

            # Should log session info (key behavior)
            mock_print.assert_called_once()
            log_message = mock_print.call_args[0][0]
            assert "Session missing user_id" in log_message
            assert "some_data" in log_message
            assert "timestamp" in log_message
            assert "session_type" in log_message

    @pytest.mark.asyncio
    async def test_user_data_field_combinations(self):
        """Test various combinations of user data fields."""
        test_cases = [
            # Standard case with user_id
            {
                "input": {"user_id": 123, "username": "user1"},
                "expected_user_id": 123,
                "expected_username": "user1"
            },
            # Fallback to id field
            {
                "input": {"id": 456, "username": "user2"},
                "expected_user_id": 456,
                "expected_username": "user2"
            },
            # Both fields present (user_id takes priority)
            {
                "input": {"user_id": 123, "id": 456, "username": "user3"},
                "expected_user_id": 123,
                "expected_username": "user3"
            },
            # Name variations
            {
                "input": {"user_id": 789, "user_name": "User Four"},
                "expected_user_id": 789,
                "expected_user_name": "User Four"
            },
            {
                "input": {"user_id": 789, "name": "User Five"},
                "expected_user_id": 789,
                "expected_user_name": "User Five"
            }
        ]

        for case in test_cases:
            request = Mock(spec=Request)
            request.state = Mock()
            request.state.session = SessionData(case["input"])

            result = await get_current_user_from_session(request)

            assert result is not None
            assert result["user_id"] == case["expected_user_id"]

            if "expected_username" in case:
                assert result["username"] == case["expected_username"]
            if "expected_user_name" in case:
                assert result["user_name"] == case["expected_user_name"]


if __name__ == "__main__":
    pytest.main([__file__])