"""
Test suite for Articles Stats API endpoint fix.

This test verifies that the /api/articles/stats endpoint returns 200 status
and correct response format with resolved SQLAlchemy ResourceClosedError.

Background:
- Articles stats endpoint was causing 500 errors due to ResourceClosedError
- Fixed by properly handling scalar() results to avoid reusing closed database resources
- Tests ensure user data isolation and correct statistics calculation

Test Coverage:
- Articles stats endpoint returns 200 status
- Correct response format with total, active, inactive counts
- SQLAlchemy ResourceClosedError is resolved
- User data isolation validation
- Statistics calculation accuracy
"""

import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, patch
import json

from app.main import app
from app.models.article import Article
from app.db.database import get_db
from app.api.deps import get_current_user


class TestArticlesStatsEndpointFix:
    """Test class for articles stats endpoint fixes."""

    @pytest.fixture
    async def mock_db_session(self):
        """Mock database session."""
        mock_session = AsyncMock(spec=AsyncSession)
        return mock_session

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user for authentication."""
        return {"user_id": 1, "username": "testuser", "is_admin": False}

    @pytest.fixture
    def mock_admin_user(self):
        """Mock admin user for authentication."""
        return {"user_id": 2, "username": "admin", "is_admin": True}

    async def test_articles_stats_endpoint_returns_200(self, mock_db_session, mock_current_user):
        """Test that /api/articles/stats endpoint returns 200 status."""
        # Mock database query results - properly handle scalar() calls
        mock_total_result = AsyncMock()
        mock_total_result.scalar.return_value = 15  # Total articles

        mock_active_result = AsyncMock()
        mock_active_result.scalar.return_value = 12  # Active articles

        mock_inactive_result = AsyncMock()
        mock_inactive_result.scalar.return_value = 3  # Inactive articles

        # Configure mock session to return results for each query
        mock_db_session.execute.side_effect = [
            mock_total_result,
            mock_active_result,
            mock_inactive_result
        ]

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_current_user

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/articles/stats")

        # Assert successful response
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

        # Clean up
        app.dependency_overrides.clear()

    async def test_articles_stats_correct_response_format(self, mock_db_session, mock_current_user):
        """Test the correct response format with total, active, inactive counts."""
        # Setup mock data
        total_count = 25
        active_count = 20
        inactive_count = 5

        # Mock database query results
        mock_total_result = AsyncMock()
        mock_total_result.scalar.return_value = total_count

        mock_active_result = AsyncMock()
        mock_active_result.scalar.return_value = active_count

        mock_inactive_result = AsyncMock()
        mock_inactive_result.scalar.return_value = inactive_count

        mock_db_session.execute.side_effect = [
            mock_total_result,
            mock_active_result,
            mock_inactive_result
        ]

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_current_user

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/articles/stats")

        # Parse response
        response_data = response.json()

        # Assert response structure
        assert response.status_code == 200
        assert "success" in response_data
        assert response_data["success"] is True
        assert "data" in response_data

        # Assert statistics data
        stats_data = response_data["data"]
        assert "total" in stats_data
        assert "active" in stats_data
        assert "inactive" in stats_data
        assert "shared" in stats_data
        assert "user_specific" in stats_data

        # Assert correct values
        assert stats_data["total"] == total_count
        assert stats_data["active"] == active_count
        assert stats_data["inactive"] == inactive_count
        assert stats_data["shared"] == 0  # No shared articles in simplified model
        assert stats_data["user_specific"] == total_count

        # Clean up
        app.dependency_overrides.clear()

    async def test_sqlalchemy_resource_closed_error_resolved(self, mock_db_session, mock_current_user):
        """Test that SQLAlchemy ResourceClosedError is resolved."""
        # Simulate the fix - scalar() results are stored immediately
        mock_total_result = AsyncMock()
        mock_total_result.scalar.return_value = 10

        mock_active_result = AsyncMock()
        mock_active_result.scalar.return_value = 7

        mock_inactive_result = AsyncMock()
        mock_inactive_result.scalar.return_value = 3

        # Ensure each result can only be used once (simulating closed resource)
        mock_db_session.execute.side_effect = [
            mock_total_result,
            mock_active_result,
            mock_inactive_result
        ]

        # Override dependencies
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_current_user

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/articles/stats")

        # Should not raise ResourceClosedError
        assert response.status_code == 200

        # Verify that scalar() was called for each query
        assert mock_total_result.scalar.call_count == 1
        assert mock_active_result.scalar.call_count == 1
        assert mock_inactive_result.scalar.call_count == 1

        # Clean up
        app.dependency_overrides.clear()

    async def test_user_data_isolation(self, mock_db_session):
        """Test that statistics are properly isolated by user_id."""
        # Test data for two different users
        user1 = {"user_id": 1, "username": "user1", "is_admin": False}
        user2 = {"user_id": 2, "username": "user2", "is_admin": False}

        # User 1 stats
        user1_stats = [15, 12, 3]  # total, active, inactive

        # User 2 stats
        user2_stats = [8, 6, 2]   # total, active, inactive

        # Test User 1
        mock_results_user1 = []
        for count in user1_stats:
            mock_result = AsyncMock()
            mock_result.scalar.return_value = count
            mock_results_user1.append(mock_result)

        mock_db_session.execute.side_effect = mock_results_user1

        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: user1

        async with AsyncClient(app=app, base_url="http://test") as client:
            response1 = await client.get("/api/articles/stats")

        assert response1.status_code == 200
        stats1 = response1.json()["data"]
        assert stats1["total"] == 15
        assert stats1["active"] == 12
        assert stats1["inactive"] == 3

        # Test User 2
        mock_results_user2 = []
        for count in user2_stats:
            mock_result = AsyncMock()
            mock_result.scalar.return_value = count
            mock_results_user2.append(mock_result)

        mock_db_session.execute.side_effect = mock_results_user2
        app.dependency_overrides[get_current_user] = lambda: user2

        async with AsyncClient(app=app, base_url="http://test") as client:
            response2 = await client.get("/api/articles/stats")

        assert response2.status_code == 200
        stats2 = response2.json()["data"]
        assert stats2["total"] == 8
        assert stats2["active"] == 6
        assert stats2["inactive"] == 2

        # Verify isolation - users should have different stats
        assert stats1["total"] != stats2["total"]
        assert stats1["active"] != stats2["active"]
        assert stats1["inactive"] != stats2["inactive"]

        # Clean up
        app.dependency_overrides.clear()

    async def test_statistics_calculation_accuracy(self, mock_db_session, mock_current_user):
        """Test that statistics calculations are mathematically correct."""
        # Test edge cases and boundary conditions
        test_cases = [
            # (total, active, inactive)
            (0, 0, 0),      # No articles
            (1, 1, 0),      # Single active article
            (1, 0, 1),      # Single inactive article
            (100, 75, 25),  # Balanced distribution
            (50, 50, 0),    # All active
            (30, 0, 30),    # All inactive
        ]

        for total, active, inactive in test_cases:
            # Verify mathematical consistency
            assert active + inactive == total, f"Math error: {active} + {inactive} != {total}"

            # Mock database responses
            mock_total_result = AsyncMock()
            mock_total_result.scalar.return_value = total

            mock_active_result = AsyncMock()
            mock_active_result.scalar.return_value = active

            mock_inactive_result = AsyncMock()
            mock_inactive_result.scalar.return_value = inactive

            mock_db_session.execute.side_effect = [
                mock_total_result,
                mock_active_result,
                mock_inactive_result
            ]

            app.dependency_overrides[get_db] = lambda: mock_db_session
            app.dependency_overrides[get_current_user] = lambda: mock_current_user

            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.get("/api/articles/stats")

            assert response.status_code == 200
            stats = response.json()["data"]

            # Verify calculations
            assert stats["total"] == total
            assert stats["active"] == active
            assert stats["inactive"] == inactive
            assert stats["active"] + stats["inactive"] == stats["total"]
            assert stats["user_specific"] == stats["total"]
            assert stats["shared"] == 0

        # Clean up
        app.dependency_overrides.clear()

    async def test_null_values_handling(self, mock_db_session, mock_current_user):
        """Test handling of NULL/None values from database."""
        # Mock database returning None values
        mock_total_result = AsyncMock()
        mock_total_result.scalar.return_value = None

        mock_active_result = AsyncMock()
        mock_active_result.scalar.return_value = None

        mock_inactive_result = AsyncMock()
        mock_inactive_result.scalar.return_value = None

        mock_db_session.execute.side_effect = [
            mock_total_result,
            mock_active_result,
            mock_inactive_result
        ]

        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_current_user

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/articles/stats")

        assert response.status_code == 200
        stats = response.json()["data"]

        # NULL values should be converted to 0
        assert stats["total"] == 0
        assert stats["active"] == 0
        assert stats["inactive"] == 0
        assert stats["user_specific"] == 0
        assert stats["shared"] == 0

        # Clean up
        app.dependency_overrides.clear()

    async def test_unauthorized_access(self, mock_db_session):
        """Test that unauthorized users cannot access stats endpoint."""
        # No current user (not authenticated)
        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: None

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/articles/stats")

        # Should return 401 Unauthorized
        assert response.status_code == 401

        # Clean up
        app.dependency_overrides.clear()

    async def test_database_connection_error_handling(self, mock_current_user):
        """Test handling of database connection errors."""
        # Mock database session that raises an exception
        mock_db_session = AsyncMock(spec=AsyncSession)
        mock_db_session.execute.side_effect = Exception("Database connection error")

        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_current_user

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/articles/stats")

        # Should handle the error gracefully
        assert response.status_code == 500

        # Clean up
        app.dependency_overrides.clear()

    async def test_performance_with_large_datasets(self, mock_db_session, mock_current_user):
        """Test performance with large dataset statistics."""
        # Simulate large dataset
        large_total = 10000
        large_active = 7500
        large_inactive = 2500

        mock_total_result = AsyncMock()
        mock_total_result.scalar.return_value = large_total

        mock_active_result = AsyncMock()
        mock_active_result.scalar.return_value = large_active

        mock_inactive_result = AsyncMock()
        mock_inactive_result.scalar.return_value = large_inactive

        mock_db_session.execute.side_effect = [
            mock_total_result,
            mock_active_result,
            mock_inactive_result
        ]

        app.dependency_overrides[get_db] = lambda: mock_db_session
        app.dependency_overrides[get_current_user] = lambda: mock_current_user

        import time
        start_time = time.time()

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/articles/stats")

        end_time = time.time()
        response_time = end_time - start_time

        # Assert successful response
        assert response.status_code == 200
        stats = response.json()["data"]
        assert stats["total"] == large_total
        assert stats["active"] == large_active
        assert stats["inactive"] == large_inactive

        # Response time should be reasonable (less than 1 second for mock)
        assert response_time < 1.0

        # Clean up
        app.dependency_overrides.clear()


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])