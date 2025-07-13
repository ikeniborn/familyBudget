import pytest
from httpx import AsyncClient
from datetime import date


class TestPeriodsEndpoints:
    """Test periods endpoints."""

    @pytest.mark.asyncio
    async def test_get_periods_all(self, async_client: AsyncClient, mock_postgres_connection, sample_period):
        """Test retrieval of all periods."""
        # Setup mock
        mock_postgres_connection.select.return_value = [
            sample_period,
            {
                "period_id": 2,
                "period_name": "202402",
                "period_ru_name": "Февраль 2024",
                "date_start": date(2024, 2, 1),
                "date_end": date(2024, 2, 29),
                "is_open": False
            }
        ]

        # Make request
        response = await async_client.get("/periods")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["period_id"] == 1
        assert data[0]["period_name"] == "202401"
        assert data[0]["is_open"] is True

    @pytest.mark.asyncio
    async def test_get_periods_with_date_filter(self, async_client: AsyncClient, mock_postgres_connection, sample_period):
        """Test retrieval of periods with date filters."""
        # Setup mock
        mock_postgres_connection.select.return_value = [sample_period]

        # Make request with date filters
        response = await async_client.get("/periods?start_date=2024-01-01&end_date=2024-01-31")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

        # Verify SQL contains date filters
        mock_postgres_connection.select.assert_called_once()
        call_args = mock_postgres_connection.select.call_args[0][0]
        assert "date_start >= '2024-01-01'" in call_args
        assert "date_end <= '2024-01-31'" in call_args

    @pytest.mark.asyncio
    async def test_get_periods_invalid_date_format(self, async_client: AsyncClient):
        """Test with invalid date format."""
        # Make request with invalid date
        response = await async_client.get("/periods?start_date=invalid-date")

        # Should handle gracefully
        assert response.status_code in [200, 400, 422]

    @pytest.mark.asyncio
    async def test_get_periods_empty_result(self, async_client: AsyncClient, mock_postgres_connection):
        """Test when no periods match criteria."""
        # Setup mock
        mock_postgres_connection.select.return_value = []

        # Make request
        response = await async_client.get("/periods?start_date=2025-01-01")

        # Assertions
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_periods_only_start_date(self, async_client: AsyncClient, mock_postgres_connection, sample_period):
        """Test with only start_date parameter."""
        # Setup mock
        mock_postgres_connection.select.return_value = [sample_period]

        # Make request
        response = await async_client.get("/periods?start_date=2024-01-01")

        # Assertions
        assert response.status_code == 200
        
        # Verify SQL contains only start date filter
        call_args = mock_postgres_connection.select.call_args[0][0]
        assert "date_start >= '2024-01-01'" in call_args
        assert "date_end <=" not in call_args

    @pytest.mark.asyncio
    async def test_get_periods_only_end_date(self, async_client: AsyncClient, mock_postgres_connection, sample_period):
        """Test with only end_date parameter."""
        # Setup mock
        mock_postgres_connection.select.return_value = [sample_period]

        # Make request
        response = await async_client.get("/periods?end_date=2024-12-31")

        # Assertions
        assert response.status_code == 200
        
        # Verify SQL contains only end date filter
        call_args = mock_postgres_connection.select.call_args[0][0]
        assert "date_end <= '2024-12-31'" in call_args
        assert "date_start >=" not in call_args

    @pytest.mark.asyncio
    async def test_get_periods_database_error(self, async_client: AsyncClient, mock_postgres_connection):
        """Test handling of database errors."""
        # Setup mock to raise exception
        mock_postgres_connection.select.side_effect = Exception("Database connection error")

        # Make request
        response = await async_client.get("/periods")

        # Assertions
        assert response.status_code == 500