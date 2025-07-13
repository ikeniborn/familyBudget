import pytest
from httpx import AsyncClient
from datetime import datetime


class TestRegistryEndpoints:
    """Test registry CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_get_registry_all(self, async_client: AsyncClient, mock_postgres_connection, sample_registry):
        """Test retrieval of all registry entries."""
        # Setup mock
        mock_postgres_connection.select.return_value = [sample_registry]

        # Make request
        response = await async_client.get("/registry")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["registry_id"] == 1
        assert data[0]["cost_sum"] == 5000.00

    @pytest.mark.asyncio
    async def test_get_registry_with_filters(self, async_client: AsyncClient, mock_postgres_connection, sample_registry):
        """Test retrieval with multiple filters."""
        # Setup mock
        mock_postgres_connection.select.return_value = [sample_registry]

        # Make request with filters
        response = await async_client.get(
            "/registry?user_id=1&period_id=1&row_type_id=1"
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

        # Verify SQL contains filters
        call_args = mock_postgres_connection.select.call_args[0][0]
        assert "user_id = 1" in call_args
        assert "period_id = 1" in call_args
        assert "row_type_id = 1" in call_args

    @pytest.mark.asyncio
    async def test_get_registry_by_id(self, async_client: AsyncClient, mock_postgres_connection, sample_registry):
        """Test retrieval of specific registry entry."""
        # Setup mock
        mock_postgres_connection.select.return_value = [sample_registry]

        # Make request
        response = await async_client.get("/registry/1")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["registry_id"] == 1
        assert data["comment_description"] == "Тест запись"

    @pytest.mark.asyncio
    async def test_get_registry_not_found(self, async_client: AsyncClient, mock_postgres_connection):
        """Test retrieval of non-existent registry entry."""
        # Setup mock
        mock_postgres_connection.select.return_value = []

        # Make request
        response = await async_client.get("/registry/999")

        # Assertions
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_create_registry_success(self, async_client: AsyncClient, mock_postgres_connection):
        """Test successful creation of registry entry."""
        # Setup mock
        mock_postgres_connection.insert.return_value = 123  # New ID

        # Request data
        new_registry = {
            "user_id": 1,
            "period_id": 1,
            "financial_center_id": 1,
            "cost_center_id": 1,
            "nomenclature_id": 1,
            "row_type_id": 2,
            "cost_sum": 3500.50,
            "comment_description": "Новая запись",
            "operation_dttm": "2024-01-20T15:30:00"
        }

        # Make request
        response = await async_client.post("/registry", json=new_registry)

        # Assertions
        assert response.status_code == 201
        assert response.json()["id"] == 123

        # Verify insert was called
        mock_postgres_connection.insert.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_registry_validation_error(self, async_client: AsyncClient):
        """Test creation with invalid data."""
        # Invalid data (missing required fields)
        invalid_registry = {
            "user_id": 1,
            "cost_sum": "not_a_number"  # Invalid type
        }

        # Make request
        response = await async_client.post("/registry", json=invalid_registry)

        # Assertions
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_registry_success(self, async_client: AsyncClient, mock_postgres_connection, sample_registry):
        """Test successful update of registry entry."""
        # Setup mocks
        mock_postgres_connection.select.return_value = [sample_registry]
        mock_postgres_connection.update.return_value = True

        # Update data
        update_data = {
            "cost_sum": 6000.00,
            "comment_description": "Обновленная запись"
        }

        # Make request
        response = await async_client.put("/registry/1", json=update_data)

        # Assertions
        assert response.status_code == 200
        assert response.json()["message"] == "Updated successfully"

        # Verify update was called
        mock_postgres_connection.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_registry_not_found(self, async_client: AsyncClient, mock_postgres_connection):
        """Test update of non-existent registry entry."""
        # Setup mock
        mock_postgres_connection.select.return_value = []

        # Update data
        update_data = {"cost_sum": 6000.00}

        # Make request
        response = await async_client.put("/registry/999", json=update_data)

        # Assertions
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_registry_success(self, async_client: AsyncClient, mock_postgres_connection, sample_registry):
        """Test successful deletion of registry entry."""
        # Setup mocks
        mock_postgres_connection.select.return_value = [sample_registry]
        mock_postgres_connection.delete.return_value = True

        # Make request
        response = await async_client.delete("/registry/1")

        # Assertions
        assert response.status_code == 200
        assert response.json()["message"] == "Deleted successfully"

        # Verify delete was called
        mock_postgres_connection.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_registry_not_found(self, async_client: AsyncClient, mock_postgres_connection):
        """Test deletion of non-existent registry entry."""
        # Setup mock
        mock_postgres_connection.select.return_value = []

        # Make request
        response = await async_client.delete("/registry/999")

        # Assertions
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_registry_sum_by_period(self, async_client: AsyncClient, mock_postgres_connection):
        """Test aggregation endpoint."""
        # Setup mock
        mock_postgres_connection.select.return_value = [{
            "period_id": 1,
            "row_type_name": "План",
            "total_sum": 50000.00
        }]

        # Make request
        response = await async_client.get("/registry/sum/by-period?user_id=1")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data[0]["total_sum"] == 50000.00