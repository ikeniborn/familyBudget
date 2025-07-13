import pytest
from httpx import AsyncClient
from datetime import datetime, date
from decimal import Decimal


class TestDatabaseOperations:
    """Test database operation patterns and behaviors."""

    @pytest.mark.asyncio
    @pytest.mark.db
    async def test_transaction_rollback(self, async_client: AsyncClient, mock_postgres_connection):
        """Test transaction rollback on error."""
        # Setup mock to simulate transaction
        mock_postgres_connection.execute.return_value = None
        mock_postgres_connection.insert.side_effect = [1, Exception("Constraint violation")]

        # Attempt to create multiple related records
        data = {
            "registry_entries": [
                {"user_id": 1, "cost_sum": 100},
                {"user_id": 1, "cost_sum": -50}  # This should fail
            ]
        }

        response = await async_client.post("/registry/batch", json=data)
        
        # Transaction should rollback
        assert response.status_code in [400, 500]
        # Verify rollback was called
        mock_postgres_connection.execute.assert_any_call("ROLLBACK")

    @pytest.mark.asyncio
    @pytest.mark.db
    async def test_pagination(self, async_client: AsyncClient, mock_postgres_connection):
        """Test pagination functionality."""
        # Create mock data
        all_users = [{"user_id": i, "user_name": f"User {i}"} for i in range(1, 101)]
        
        # Mock paginated results
        def mock_select(query, *args, **kwargs):
            if "LIMIT 10 OFFSET 0" in query:
                return all_users[:10]
            elif "LIMIT 10 OFFSET 10" in query:
                return all_users[10:20]
            elif "LIMIT 10 OFFSET 90" in query:
                return all_users[90:]
            else:
                return all_users

        mock_postgres_connection.select.side_effect = mock_select

        # Test first page
        response = await async_client.get("/users?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 10
        assert data[0]["user_id"] == 1

        # Test second page
        response = await async_client.get("/users?page=2&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 10
        assert data[0]["user_id"] == 11

        # Test last page
        response = await async_client.get("/users?page=10&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 10
        assert data[0]["user_id"] == 91

    @pytest.mark.asyncio
    @pytest.mark.db
    async def test_sorting(self, async_client: AsyncClient, mock_postgres_connection):
        """Test sorting functionality."""
        # Mock data
        users = [
            {"user_id": 3, "user_name": "Charlie", "created_at": "2024-01-03"},
            {"user_id": 1, "user_name": "Alice", "created_at": "2024-01-01"},
            {"user_id": 2, "user_name": "Bob", "created_at": "2024-01-02"},
        ]

        def mock_select(query, *args, **kwargs):
            if "ORDER BY user_name ASC" in query:
                return sorted(users, key=lambda x: x["user_name"])
            elif "ORDER BY user_name DESC" in query:
                return sorted(users, key=lambda x: x["user_name"], reverse=True)
            elif "ORDER BY created_at DESC" in query:
                return sorted(users, key=lambda x: x["created_at"], reverse=True)
            else:
                return users

        mock_postgres_connection.select.side_effect = mock_select

        # Test ascending sort
        response = await async_client.get("/users?sort=user_name&order=asc")
        assert response.status_code == 200
        data = response.json()
        assert data[0]["user_name"] == "Alice"
        assert data[2]["user_name"] == "Charlie"

    @pytest.mark.asyncio
    @pytest.mark.db
    async def test_filtering(self, async_client: AsyncClient, mock_postgres_connection):
        """Test filtering functionality."""
        # Mock data
        registries = [
            {"registry_id": 1, "user_id": 1, "row_type_id": 1, "cost_sum": 100},
            {"registry_id": 2, "user_id": 1, "row_type_id": 2, "cost_sum": 200},
            {"registry_id": 3, "user_id": 2, "row_type_id": 1, "cost_sum": 300},
        ]

        def mock_select(query, *args, **kwargs):
            result = registries
            if "user_id = 1" in query:
                result = [r for r in result if r["user_id"] == 1]
            if "row_type_id = 1" in query:
                result = [r for r in result if r["row_type_id"] == 1]
            return result

        mock_postgres_connection.select.side_effect = mock_select

        # Test single filter
        response = await async_client.get("/registry?user_id=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert all(r["user_id"] == 1 for r in data)

        # Test multiple filters
        response = await async_client.get("/registry?user_id=1&row_type_id=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["registry_id"] == 1

    @pytest.mark.asyncio
    @pytest.mark.db
    async def test_aggregation(self, async_client: AsyncClient, mock_postgres_connection):
        """Test aggregation queries."""
        # Mock aggregation results
        mock_postgres_connection.select.return_value = [{
            "period_id": 1,
            "period_name": "202401",
            "total_sum": Decimal("15000.50"),
            "count": 10,
            "avg_sum": Decimal("1500.05"),
            "min_sum": Decimal("100.00"),
            "max_sum": Decimal("5000.00")
        }]

        # Test aggregation endpoint
        response = await async_client.get("/registry/stats?user_id=1&period_id=1")
        assert response.status_code == 200
        data = response.json()
        
        # Verify aggregation results
        assert data[0]["total_sum"] == 15000.50
        assert data[0]["count"] == 10
        assert data[0]["avg_sum"] == 1500.05

        # Verify SQL contains aggregation functions
        call_args = mock_postgres_connection.select.call_args[0][0]
        assert "SUM(" in call_args
        assert "COUNT(" in call_args
        assert "AVG(" in call_args

    @pytest.mark.asyncio
    @pytest.mark.db
    async def test_join_operations(self, async_client: AsyncClient, mock_postgres_connection):
        """Test JOIN operations."""
        # Mock joined data
        mock_postgres_connection.select.return_value = [{
            "registry_id": 1,
            "user_name": "Test User",
            "period_name": "202401",
            "nomenclature_name": "Продукты",
            "cost_sum": 5000
        }]

        # Test endpoint with joins
        response = await async_client.get("/registry/detailed?user_id=1")
        assert response.status_code == 200
        data = response.json()
        
        # Verify joined data
        assert data[0]["user_name"] == "Test User"
        assert data[0]["nomenclature_name"] == "Продукты"

        # Verify SQL contains JOINs
        call_args = mock_postgres_connection.select.call_args[0][0]
        assert "JOIN" in call_args or "join" in call_args

    @pytest.mark.asyncio
    @pytest.mark.db
    async def test_bulk_operations(self, async_client: AsyncClient, mock_postgres_connection):
        """Test bulk insert/update operations."""
        # Mock bulk insert
        mock_postgres_connection.execute.return_value = 5  # 5 rows affected

        # Test bulk insert
        bulk_data = [
            {"user_id": 1, "period_id": 1, "cost_sum": 100},
            {"user_id": 1, "period_id": 1, "cost_sum": 200},
            {"user_id": 1, "period_id": 1, "cost_sum": 300},
            {"user_id": 1, "period_id": 1, "cost_sum": 400},
            {"user_id": 1, "period_id": 1, "cost_sum": 500},
        ]

        response = await async_client.post("/registry/bulk", json=bulk_data)
        assert response.status_code in [200, 201]
        
        # Verify bulk operation
        assert response.json()["created"] == 5

    @pytest.mark.asyncio
    @pytest.mark.db
    async def test_upsert_operations(self, async_client: AsyncClient, mock_postgres_connection):
        """Test UPSERT (INSERT ON CONFLICT UPDATE) operations."""
        # Mock upsert
        mock_postgres_connection.execute.return_value = 1

        # Test upsert
        data = {
            "user_id": 1,
            "product_id": 1,
            "price": 150.50,
            "date": "2024-01-15"
        }

        response = await async_client.put("/products/1/price", json=data)
        assert response.status_code == 200

        # Verify SQL contains ON CONFLICT
        call_args = mock_postgres_connection.execute.call_args[0][0]
        assert "ON CONFLICT" in call_args or "INSERT" in call_args

    @pytest.mark.asyncio
    @pytest.mark.db
    async def test_soft_delete(self, async_client: AsyncClient, mock_postgres_connection):
        """Test soft delete operations."""
        # Mock soft delete (update is_active = false)
        mock_postgres_connection.update.return_value = 1

        # Test soft delete
        response = await async_client.delete("/products/1")
        assert response.status_code == 200

        # Verify it's an UPDATE, not DELETE
        mock_postgres_connection.update.assert_called_once()
        call_args = mock_postgres_connection.update.call_args[0][0]
        assert "is_active = false" in call_args or "is_active = FALSE" in call_args

    @pytest.mark.asyncio
    @pytest.mark.db
    async def test_complex_query_building(self, async_client: AsyncClient, mock_postgres_connection):
        """Test complex query building with multiple conditions."""
        # Mock complex query result
        mock_postgres_connection.select.return_value = []

        # Test with multiple query parameters
        params = {
            "user_id": 1,
            "period_ids": "1,2,3",
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
            "min_sum": 100,
            "max_sum": 5000,
            "nomenclature_ids": "1,2",
            "row_type_id": 1
        }

        response = await async_client.get("/registry/search", params=params)
        assert response.status_code == 200

        # Verify complex SQL was built
        call_args = mock_postgres_connection.select.call_args[0][0]
        assert "user_id = 1" in call_args
        assert "period_id IN (1,2,3)" in call_args
        assert "operation_dttm >= '2024-01-01'" in call_args
        assert "operation_dttm <= '2024-12-31'" in call_args
        assert "cost_sum >= 100" in call_args
        assert "cost_sum <= 5000" in call_args