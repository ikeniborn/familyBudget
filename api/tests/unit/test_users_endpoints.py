import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock


class TestUsersEndpoints:
    """Test users endpoints."""

    @pytest.mark.asyncio
    async def test_get_users_success(self, async_client: AsyncClient, mock_postgres_connection, sample_user):
        """Test successful retrieval of all users."""
        # Setup mock
        mock_postgres_connection.select.return_value = [sample_user, {
            "user_id": 2,
            "user_name": "Another User",
            "user_telegram_id": 987654321
        }]

        # Make request
        response = await async_client.get("/users")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["user_id"] == 1
        assert data[0]["user_name"] == "Test User"
        assert data[0]["user_telegram_id"] == 123456789

        # Verify mock was called correctly
        mock_postgres_connection.select.assert_called_once()
        call_args = mock_postgres_connection.select.call_args[0][0]
        assert "t_d_user" in call_args
        assert "user_id" in call_args
        assert "user_name" in call_args
        assert "user_telegram_id" in call_args

    @pytest.mark.asyncio
    async def test_get_users_empty(self, async_client: AsyncClient, mock_postgres_connection):
        """Test retrieval when no users exist."""
        # Setup mock
        mock_postgres_connection.select.return_value = []

        # Make request
        response = await async_client.get("/users")

        # Assertions
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_user_by_id_success(self, async_client: AsyncClient, mock_postgres_connection, sample_user):
        """Test successful retrieval of user by ID."""
        # Setup mock
        mock_postgres_connection.select.return_value = [sample_user]

        # Make request
        response = await async_client.get("/users/1")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["user_id"] == 1
        assert data[0]["user_name"] == "Test User"
        assert data[0]["user_email"] == "test@example.com"

        # Verify mock was called with correct query
        mock_postgres_connection.select.assert_called_once()
        call_args = mock_postgres_connection.select.call_args[0][0]
        assert "user_id in ('1')" in call_args

    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, async_client: AsyncClient, mock_postgres_connection):
        """Test retrieval of non-existent user."""
        # Setup mock
        mock_postgres_connection.select.return_value = []

        # Make request
        response = await async_client.get("/users/999")

        # Assertions
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_user_invalid_id_type(self, async_client: AsyncClient):
        """Test retrieval with invalid ID type."""
        # Make request
        response = await async_client.get("/users/abc")

        # Assertions
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_get_users_database_error(self, async_client: AsyncClient, mock_postgres_connection):
        """Test handling of database errors."""
        # Setup mock to raise exception
        mock_postgres_connection.select.side_effect = Exception("Database connection error")

        # Make request
        response = await async_client.get("/users")

        # Assertions
        assert response.status_code == 500

    @pytest.mark.asyncio 
    async def test_get_user_sql_injection_attempt(self, async_client: AsyncClient, mock_postgres_connection):
        """Test protection against SQL injection."""
        # Setup mock
        mock_postgres_connection.select.return_value = []

        # Make request with SQL injection attempt
        response = await async_client.get("/users/1'; DROP TABLE t_d_user; --")

        # Should handle the input safely
        assert response.status_code in [200, 422]  # Either processed safely or validation error
        
        # Verify the dangerous SQL was not executed
        if mock_postgres_connection.select.called:
            call_args = mock_postgres_connection.select.call_args[0][0]
            assert "DROP TABLE" not in call_args