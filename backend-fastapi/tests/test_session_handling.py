"""
Tests for session handling functionality.
Tests the core session management logic including get_current_user_from_session.
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from fastapi import Request

from app.core.session import (
    get_current_user_from_session,
    SessionData,
    _clear_invalid_session,
    session_store
)


class TestGetCurrentUserFromSession:
    """Test get_current_user_from_session function."""

    @pytest.fixture
    def mock_request(self):
        """Create a mock request with session state."""
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.session_id = "test-session-123"
        return request

    @pytest.mark.asyncio
    async def test_get_user_from_valid_session_with_user_id(self, mock_request):
        """Test getting user from valid session with user_id field."""
        # Arrange
        session_data = {
            "user_id": 42,
            "username": "testuser",
            "user_name": "Test User",
            "auth_method": "password",
            "telegram_id": 123456789,
            "role": "user"
        }
        mock_request.state.session = SessionData(session_data)

        # Act
        result = await get_current_user_from_session(mock_request)

        # Assert
        assert result is not None
        assert result["user_id"] == 42
        assert result["username"] == "testuser"
        assert result["user_name"] == "Test User"
        assert result["auth_method"] == "password"
        assert result["telegram_id"] == 123456789
        assert result["role"] == "user"

    @pytest.mark.asyncio
    async def test_get_user_from_valid_session_with_id_field(self, mock_request):
        """Test getting user from valid session with id field (legacy format)."""
        # Arrange
        session_data = {
            "id": 42,
            "username": "testuser",
            "name": "Test User",  # Different field name in legacy format
            "auth_method": "telegram"
        }
        mock_request.state.session = SessionData(session_data)

        # Act
        result = await get_current_user_from_session(mock_request)

        # Assert
        assert result is not None
        assert result["user_id"] == 42
        assert result["username"] == "testuser"
        assert result["user_name"] == "Test User"  # Should map from 'name'
        assert result["auth_method"] == "telegram"

    @pytest.mark.asyncio
    async def test_get_user_from_session_string_user_id(self, mock_request):
        """Test getting user from session with string user_id (should convert to int)."""
        # Arrange
        session_data = {
            "user_id": "42",  # String instead of int
            "username": "testuser"
        }
        mock_request.state.session = SessionData(session_data)

        # Act
        result = await get_current_user_from_session(mock_request)

        # Assert
        assert result is not None
        assert result["user_id"] == 42
        assert isinstance(result["user_id"], int)

    @pytest.mark.asyncio
    async def test_get_user_no_session_state(self, mock_request):
        """Test when request has no session state."""
        # Arrange
        mock_request.state.session = None

        # Act
        result = await get_current_user_from_session(mock_request)

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_empty_session(self, mock_request):
        """Test when session exists but is empty (no user_id)."""
        # Arrange
        session_data = {}  # Empty session
        mock_request.state.session = SessionData(session_data)

        # Mock _clear_invalid_session
        with patch('app.core.session._clear_invalid_session') as mock_clear:
            # Act
            result = await get_current_user_from_session(mock_request)

            # Assert
            assert result is None
            mock_clear.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_get_user_invalid_user_id_format(self, mock_request):
        """Test when user_id is not a valid integer."""
        # Arrange
        session_data = {
            "user_id": "invalid_number",
            "username": "testuser"
        }
        mock_request.state.session = SessionData(session_data)

        # Mock _clear_invalid_session
        with patch('app.core.session._clear_invalid_session') as mock_clear:
            # Act
            result = await get_current_user_from_session(mock_request)

            # Assert
            assert result is None
            mock_clear.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_get_user_none_user_id(self, mock_request):
        """Test when user_id is None."""
        # Arrange
        session_data = {
            "user_id": None,
            "username": "testuser"
        }
        mock_request.state.session = SessionData(session_data)

        # Mock _clear_invalid_session
        with patch('app.core.session._clear_invalid_session') as mock_clear:
            # Act
            result = await get_current_user_from_session(mock_request)

            # Assert
            assert result is None
            mock_clear.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_get_user_zero_user_id(self, mock_request):
        """Test when user_id is 0 (should be treated as invalid due to current logic)."""
        # Arrange
        session_data = {
            "user_id": 0,
            "username": "testuser"
        }
        mock_request.state.session = SessionData(session_data)

        # Mock _clear_invalid_session
        with patch('app.core.session._clear_invalid_session') as mock_clear:
            # Act
            result = await get_current_user_from_session(mock_request)

            # Assert - user_id 0 is currently treated as invalid by the logic
            assert result is None
            mock_clear.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_get_user_partial_session_data(self, mock_request):
        """Test with minimal session data (only user_id)."""
        # Arrange
        session_data = {
            "user_id": 42
        }
        mock_request.state.session = SessionData(session_data)

        # Act
        result = await get_current_user_from_session(mock_request)

        # Assert
        assert result is not None
        assert result["user_id"] == 42
        assert result["username"] is None
        assert result["user_name"] is None
        assert result["auth_method"] is None
        assert result["telegram_id"] is None
        assert result["role"] is None


class TestClearInvalidSession:
    """Test _clear_invalid_session function."""

    @pytest.fixture
    def mock_request(self):
        """Create a mock request with session state."""
        request = Mock(spec=Request)
        request.state = Mock()
        request.state.session_id = "test-session-123"
        return request

    @pytest.mark.asyncio
    async def test_clear_invalid_session_with_session(self, mock_request):
        """Test clearing invalid session when session exists."""
        # Arrange
        mock_session = Mock()
        mock_request.state.session = mock_session

        with patch.object(session_store, 'delete_session') as mock_delete:
            mock_delete.return_value = AsyncMock()

            # Act
            await _clear_invalid_session(mock_request)

            # Assert
            mock_session.clear.assert_called_once()
            mock_delete.assert_called_once_with("test-session-123")

    @pytest.mark.asyncio
    async def test_clear_invalid_session_no_session(self, mock_request):
        """Test clearing invalid session when no session exists."""
        # Arrange
        mock_request.state.session = None

        with patch.object(session_store, 'delete_session') as mock_delete:
            mock_delete.return_value = AsyncMock()

            # Act
            await _clear_invalid_session(mock_request)

            # Assert
            mock_delete.assert_called_once_with("test-session-123")

    @pytest.mark.asyncio
    async def test_clear_invalid_session_no_session_id(self, mock_request):
        """Test clearing invalid session when no session_id exists."""
        # Arrange
        mock_session = Mock()
        mock_request.state.session = mock_session
        mock_request.state.session_id = None

        with patch.object(session_store, 'delete_session') as mock_delete:
            mock_delete.return_value = AsyncMock()

            # Act
            await _clear_invalid_session(mock_request)

            # Assert
            mock_session.clear.assert_called_once()
            mock_delete.assert_not_called()


class TestSessionData:
    """Test SessionData class."""

    def test_session_data_init_empty(self):
        """Test SessionData initialization with no data."""
        # Act
        session = SessionData()

        # Assert
        assert session.data == {}

    def test_session_data_init_with_data(self):
        """Test SessionData initialization with data."""
        # Arrange
        data = {"user_id": 42, "username": "test"}

        # Act
        session = SessionData(data)

        # Assert
        assert session.data == data

    def test_session_data_get_existing_key(self):
        """Test getting existing key from session data."""
        # Arrange
        session = SessionData({"user_id": 42})

        # Act
        result = session.get("user_id")

        # Assert
        assert result == 42

    def test_session_data_get_nonexistent_key(self):
        """Test getting non-existent key from session data."""
        # Arrange
        session = SessionData({"user_id": 42})

        # Act
        result = session.get("username")

        # Assert
        assert result is None

    def test_session_data_get_with_default(self):
        """Test getting non-existent key with default value."""
        # Arrange
        session = SessionData({"user_id": 42})

        # Act
        result = session.get("username", "default")

        # Assert
        assert result == "default"

    def test_session_data_set(self):
        """Test setting key in session data."""
        # Arrange
        session = SessionData()

        # Act
        session.set("user_id", 42)

        # Assert
        assert session.data["user_id"] == 42

    def test_session_data_delete(self):
        """Test deleting key from session data."""
        # Arrange
        session = SessionData({"user_id": 42, "username": "test"})

        # Act
        session.delete("username")

        # Assert
        assert "username" not in session.data
        assert "user_id" in session.data

    def test_session_data_delete_nonexistent(self):
        """Test deleting non-existent key (should not raise error)."""
        # Arrange
        session = SessionData({"user_id": 42})

        # Act
        session.delete("username")

        # Assert - no exception should be raised
        assert session.data == {"user_id": 42}

    def test_session_data_clear(self):
        """Test clearing all session data."""
        # Arrange
        session = SessionData({"user_id": 42, "username": "test"})

        # Act
        session.clear()

        # Assert
        assert session.data == {}

    def test_session_data_to_dict(self):
        """Test converting session data to dict."""
        # Arrange
        data = {"user_id": 42, "username": "test"}
        session = SessionData(data)

        # Act
        result = session.to_dict()

        # Assert
        assert result == data
        assert result is not session.data  # Should be a copy