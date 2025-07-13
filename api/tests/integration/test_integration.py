import pytest
from httpx import AsyncClient
from datetime import datetime
import asyncio


class TestIntegration:
    """Integration tests for complete workflows."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_complete_registry_workflow(self, async_client: AsyncClient, mock_postgres_connection):
        """Test complete workflow: create user -> create registry -> update -> delete."""
        # Step 1: Create user
        mock_postgres_connection.insert.return_value = 1
        user_data = {
            "user_name": "Integration Test User",
            "user_telegram_id": 999999999
        }
        response = await async_client.post("/users", json=user_data)
        assert response.status_code == 201
        user_id = response.json()["id"]

        # Step 2: Create registry entry
        mock_postgres_connection.insert.return_value = 100
        registry_data = {
            "user_id": user_id,
            "period_id": 1,
            "financial_center_id": 1,
            "cost_center_id": 1,
            "nomenclature_id": 1,
            "row_type_id": 1,
            "cost_sum": 1000.00,
            "comment_description": "Integration test",
            "operation_dttm": datetime.now().isoformat()
        }
        response = await async_client.post("/registry", json=registry_data)
        assert response.status_code == 201
        registry_id = response.json()["id"]

        # Step 3: Read registry entry
        mock_postgres_connection.select.return_value = [{**registry_data, "registry_id": registry_id}]
        response = await async_client.get(f"/registry/{registry_id}")
        assert response.status_code == 200
        assert response.json()["cost_sum"] == 1000.00

        # Step 4: Update registry entry
        mock_postgres_connection.update.return_value = 1
        update_data = {"cost_sum": 1500.00}
        response = await async_client.put(f"/registry/{registry_id}", json=update_data)
        assert response.status_code == 200

        # Step 5: Delete registry entry
        mock_postgres_connection.delete.return_value = 1
        response = await async_client.delete(f"/registry/{registry_id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_budget_planning_workflow(self, async_client: AsyncClient, mock_postgres_connection):
        """Test budget planning workflow: create plan -> add facts -> compare."""
        user_id = 1
        period_id = 1

        # Step 1: Create budget plan entries
        plan_entries = [
            {"nomenclature_id": 1, "cost_sum": 5000, "row_type_id": 1},  # Food plan
            {"nomenclature_id": 2, "cost_sum": 3000, "row_type_id": 1},  # Transport plan
            {"nomenclature_id": 3, "cost_sum": 2000, "row_type_id": 1},  # Utilities plan
        ]

        for i, entry in enumerate(plan_entries):
            mock_postgres_connection.insert.return_value = i + 1
            data = {
                "user_id": user_id,
                "period_id": period_id,
                "financial_center_id": 1,
                "cost_center_id": 1,
                **entry,
                "operation_dttm": datetime.now().isoformat()
            }
            response = await async_client.post("/registry", json=data)
            assert response.status_code == 201

        # Step 2: Add fact entries
        fact_entries = [
            {"nomenclature_id": 1, "cost_sum": 4500, "row_type_id": 2},  # Food fact
            {"nomenclature_id": 2, "cost_sum": 3500, "row_type_id": 2},  # Transport fact
            {"nomenclature_id": 3, "cost_sum": 1800, "row_type_id": 2},  # Utilities fact
        ]

        for i, entry in enumerate(fact_entries):
            mock_postgres_connection.insert.return_value = i + 10
            data = {
                "user_id": user_id,
                "period_id": period_id,
                "financial_center_id": 1,
                "cost_center_id": 1,
                **entry,
                "operation_dttm": datetime.now().isoformat()
            }
            response = await async_client.post("/registry", json=data)
            assert response.status_code == 201

        # Step 3: Get budget vs actual report
        mock_postgres_connection.select.return_value = [
            {"nomenclature_id": 1, "plan_sum": 5000, "fact_sum": 4500, "variance": -500},
            {"nomenclature_id": 2, "plan_sum": 3000, "fact_sum": 3500, "variance": 500},
            {"nomenclature_id": 3, "plan_sum": 2000, "fact_sum": 1800, "variance": -200},
        ]
        response = await async_client.get(f"/reports/budget-vs-actual?user_id={user_id}&period_id={period_id}")
        assert response.status_code == 200
        report = response.json()
        assert len(report) == 3
        assert report[0]["variance"] == -500  # Saved on food

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_product_price_tracking_workflow(self, async_client: AsyncClient, mock_postgres_connection):
        """Test product price tracking workflow."""
        # Step 1: Create product
        mock_postgres_connection.insert.return_value = 1
        product_data = {
            "product_name": "Test Product",
            "barcode": "1234567890123",
            "category_name": "Test Category",
            "unit_measure": "шт"
        }
        response = await async_client.post("/products", json=product_data)
        assert response.status_code == 201
        product_id = response.json()["id"]

        # Step 2: Add price history
        prices = [
            {"price": 100.00, "date": "2024-01-01"},
            {"price": 105.00, "date": "2024-02-01"},
            {"price": 110.00, "date": "2024-03-01"},
        ]

        for price_data in prices:
            mock_postgres_connection.insert.return_value = 1
            response = await async_client.post(f"/products/{product_id}/prices", json=price_data)
            assert response.status_code == 201

        # Step 3: Get price history
        mock_postgres_connection.select.return_value = [
            {"price": 100.00, "date": "2024-01-01", "change_percent": 0},
            {"price": 105.00, "date": "2024-02-01", "change_percent": 5.0},
            {"price": 110.00, "date": "2024-03-01", "change_percent": 4.76},
        ]
        response = await async_client.get(f"/products/{product_id}/prices")
        assert response.status_code == 200
        history = response.json()
        assert len(history) == 3
        assert history[1]["change_percent"] == 5.0

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_multi_user_isolation(self, async_client: AsyncClient, mock_postgres_connection):
        """Test data isolation between users."""
        # Create data for user 1
        user1_data = {
            "user_id": 1,
            "period_id": 1,
            "financial_center_id": 1,
            "cost_center_id": 1,
            "nomenclature_id": 1,
            "row_type_id": 1,
            "cost_sum": 1000,
            "operation_dttm": datetime.now().isoformat()
        }
        mock_postgres_connection.insert.return_value = 1
        response = await async_client.post("/registry", json=user1_data)
        assert response.status_code == 201

        # Create data for user 2
        user2_data = {**user1_data, "user_id": 2, "cost_sum": 2000}
        mock_postgres_connection.insert.return_value = 2
        response = await async_client.post("/registry", json=user2_data)
        assert response.status_code == 201

        # Query user 1 data - should only see their own
        mock_postgres_connection.select.return_value = [user1_data]
        response = await async_client.get("/registry?user_id=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["cost_sum"] == 1000

        # Verify SQL contains user filter
        call_args = mock_postgres_connection.select.call_args[0][0]
        assert "user_id = 1" in call_args

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_concurrent_operations(self, async_client: AsyncClient, mock_postgres_connection):
        """Test handling of concurrent operations."""
        # Setup mock for concurrent inserts
        insert_count = 0
        
        async def mock_insert(*args, **kwargs):
            nonlocal insert_count
            insert_count += 1
            await asyncio.sleep(0.1)  # Simulate some processing time
            return insert_count

        mock_postgres_connection.insert.side_effect = mock_insert

        # Create multiple concurrent requests
        tasks = []
        for i in range(10):
            data = {
                "user_id": 1,
                "period_id": 1,
                "financial_center_id": 1,
                "cost_center_id": 1,
                "nomenclature_id": 1,
                "row_type_id": 1,
                "cost_sum": 100 * i,
                "operation_dttm": datetime.now().isoformat()
            }
            task = async_client.post("/registry", json=data)
            tasks.append(task)

        # Execute concurrently
        responses = await asyncio.gather(*tasks)

        # All should succeed
        assert all(r.status_code == 201 for r in responses)
        assert insert_count == 10

        # Each should have unique ID
        ids = [r.json()["id"] for r in responses]
        assert len(set(ids)) == 10  # All unique

    @pytest.mark.asyncio
    @pytest.mark.integration
    @pytest.mark.slow
    async def test_performance_large_dataset(self, async_client: AsyncClient, mock_postgres_connection):
        """Test performance with large datasets."""
        # Mock large dataset
        large_dataset = [
            {
                "registry_id": i,
                "user_id": 1,
                "cost_sum": 100 * i,
                "operation_dttm": datetime.now().isoformat()
            }
            for i in range(1000)
        ]

        mock_postgres_connection.select.return_value = large_dataset

        # Measure response time
        start_time = asyncio.get_event_loop().time()
        response = await async_client.get("/registry?user_id=1&limit=1000")
        end_time = asyncio.get_event_loop().time()

        assert response.status_code == 200
        assert len(response.json()) == 1000
        
        # Should respond within reasonable time (e.g., 2 seconds)
        assert end_time - start_time < 2.0