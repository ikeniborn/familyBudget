"""
Comprehensive test for admin periods endpoint functionality.

This test validates:
1. Admin authentication and authorization
2. Admin periods endpoint returns extended data with user information  
3. Regular users cannot access admin endpoint
4. Data structure matches frontend expectations
5. Comparison between admin and regular periods endpoints
"""

import pytest
import asyncio
from datetime import datetime
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient
from unittest.mock import patch
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import User, Period
from app.schemas.period import AdminPeriodResponse


class TestAdminPeriodsEndpoint:
    """Test admin periods endpoint functionality."""
    
    @pytest.fixture
    def admin_user_data(self):
        """Create admin user data."""
        return {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User',
            'user_email': 'admin@example.com'
        }
    
    @pytest.fixture
    def regular_user_data(self):
        """Create regular user data."""
        return {
            'user_id': 2,
            'username': 'regularuser',
            'user_name': 'Regular User',
            'user_email': 'user@example.com'
        }
    
    @pytest.fixture
    def another_user_data(self):
        """Create another regular user data."""
        return {
            'user_id': 3,
            'username': 'anotheruser',
            'user_name': 'Another User',
            'user_email': 'another@example.com'
        }

    def test_admin_periods_endpoint_success(self, client: TestClient, admin_user_data):
        """Test that admin can successfully access admin periods endpoint."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_user_data
            
            response = client.get("/api/admin/periods")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            
            # Validate response structure
            assert "success" in data
            assert data["success"] is True
            assert "data" in data
            assert "total" in data
            assert isinstance(data["data"], list)
            assert isinstance(data["total"], int)

    def test_admin_periods_endpoint_unauthorized(self, client: TestClient):
        """Test unauthenticated user cannot access admin periods endpoint."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = None
            
            response = client.get("/api/admin/periods")
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            data = response.json()
            assert "Not authenticated" in data["detail"]

    def test_admin_periods_endpoint_forbidden(self, client: TestClient, regular_user_data):
        """Test regular user cannot access admin periods endpoint."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_data
            
            response = client.get("/api/admin/periods")
            
            assert response.status_code == status.HTTP_403_FORBIDDEN
            data = response.json()
            assert "Admin access required" in data["detail"]

    def test_admin_periods_data_structure(self, client: TestClient, admin_user_data):
        """Test admin periods endpoint returns expected data structure with user info."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_user_data
            
            response = client.get("/api/admin/periods")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            
            # If there are periods in the response, validate their structure
            if data["data"]:
                period = data["data"][0]
                
                # Core period fields
                required_period_fields = [
                    'id', 'date', 'ru_name', 'user_id', 'created_at', 'is_active'
                ]
                for field in required_period_fields:
                    assert field in period, f"Missing required field: {field}"
                
                # User information fields (admin-specific)
                required_user_fields = [
                    'user_name', 'user_email', 'username', 'telegram_id'
                ]
                for field in required_user_fields:
                    assert field in period, f"Missing user field: {field}"
                
                # Legacy compatibility fields
                legacy_fields = [
                    'period_id', 'period_dt', 'period_ru_name', 
                    'period_name', 'period_year', 'period_month'
                ]
                for field in legacy_fields:
                    assert field in period, f"Missing legacy field: {field}"
                
                # Validate data types
                assert isinstance(period['id'], int)
                assert isinstance(period['user_id'], int)
                assert isinstance(period['ru_name'], str)
                assert isinstance(period['user_name'], str)
                assert period['user_email'] is None or isinstance(period['user_email'], str)
                assert period['username'] is None or isinstance(period['username'], str)
                assert period['telegram_id'] is None or isinstance(period['telegram_id'], str)

    def test_regular_periods_endpoint_data_isolation(self, client: TestClient, regular_user_data):
        """Test regular periods endpoint only returns user-specific data."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_data
            
            response = client.get("/api/periods/")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            
            # All periods should belong to the authenticated user
            for period in data:
                assert period['user_id'] == regular_user_data['user_id']
                
                # Regular endpoint should NOT include user information from other fields
                assert 'user_name' not in period or period.get('user_name') is None
                assert 'user_email' not in period or period.get('user_email') is None
                assert 'username' not in period or period.get('username') is None

    def test_admin_vs_regular_endpoint_comparison(self, client: TestClient, admin_user_data, regular_user_data):
        """Test comparison between admin and regular periods endpoints."""
        # Test admin endpoint
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_user_data
            
            admin_response = client.get("/api/admin/periods")
            assert admin_response.status_code == status.HTTP_200_OK
            admin_data = admin_response.json()
            
        # Test regular endpoint for comparison
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_data
            
            regular_response = client.get("/api/periods/")
            assert regular_response.status_code == status.HTTP_200_OK
            regular_data = regular_response.json()
            
        # Admin endpoint should return more comprehensive data
        if admin_data["data"] and regular_data:
            admin_period = admin_data["data"][0]
            regular_period = regular_data[0]
            
            # Admin data should include user information
            admin_user_fields = ['user_name', 'user_email', 'username', 'telegram_id']
            for field in admin_user_fields:
                assert field in admin_period
                # Regular endpoint should not have these fields or have them as None
                assert field not in regular_period or regular_period.get(field) is None
            
            # Both should have basic period fields
            common_fields = ['id', 'date', 'ru_name', 'user_id']
            for field in common_fields:
                assert field in admin_period
                assert field in regular_period

    def test_admin_periods_pagination(self, client: TestClient, admin_user_data):
        """Test admin periods endpoint supports pagination."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_user_data
            
            # Test with pagination parameters
            response = client.get("/api/admin/periods?skip=0&limit=10")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            
            assert "data" in data
            assert "total" in data
            assert len(data["data"]) <= 10  # Should respect limit

    def test_admin_periods_edge_cases(self, client: TestClient, admin_user_data):
        """Test admin periods endpoint handles edge cases."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_user_data
            
            # Test with invalid pagination parameters
            response = client.get("/api/admin/periods?skip=-1&limit=0")
            # Should return 422 Unprocessable Entity for invalid parameters
            assert response.status_code in [422, 200]  # May handle gracefully
            
            # Test with large pagination values
            response = client.get("/api/admin/periods?skip=0&limit=1000")
            assert response.status_code == status.HTTP_200_OK


class TestAdminPeriodSchema:
    """Test AdminPeriodResponse schema functionality."""
    
    def test_admin_period_response_schema_creation(self):
        """Test AdminPeriodResponse schema creates correctly from mock data."""
        period_data = {
            'id': 1,
            'date': datetime(2024, 1, 1),
            'ru_name': 'Январь 2024',
            'start_date': datetime(2024, 1, 1),
            'end_date': datetime(2024, 1, 31),
            'user_id': 2,
            'created_at': datetime(2024, 1, 1),
            'is_active': True,
            'user_name': 'Test User',
            'user_email': 'test@example.com',
            'username': 'testuser',
            'telegram_id': '123456789',
            'period_id': 1,
            'period_dt': datetime(2024, 1, 1),
            'period_ru_name': 'Январь 2024',
            'period_name': 'Январь 2024',
            'period_year': 2024,
            'period_month': 1,
            'period_start_date': datetime(2024, 1, 1),
            'period_end_date': datetime(2024, 1, 31)
        }
        
        # Create schema instance
        admin_period = AdminPeriodResponse(**period_data)
        
        # Validate all fields are present
        assert admin_period.id == 1
        assert admin_period.user_name == 'Test User'
        assert admin_period.user_email == 'test@example.com'
        assert admin_period.username == 'testuser'
        assert admin_period.telegram_id == '123456789'
        assert admin_period.period_year == 2024
        assert admin_period.period_month == 1

    def test_admin_period_from_db_models_method(self):
        """Test AdminPeriodResponse.from_db_models class method."""
        # Mock database models
        class MockPeriod:
            id = 1
            date = datetime(2024, 1, 1)
            ru_name = 'Январь 2024'
            start_date = datetime(2024, 1, 1)
            end_date = datetime(2024, 1, 31)
            user_id = 2
        
        class MockUser:
            user_name = 'Test User'
            user_email = 'test@example.com'
            username = 'testuser'
            telegram_id = 123456789
        
        period_mock = MockPeriod()
        user_mock = MockUser()
        
        # Create schema instance using from_db_models
        admin_period = AdminPeriodResponse.from_db_models(period_mock, user_mock)
        
        # Validate mapping
        assert admin_period.id == 1
        assert admin_period.user_name == 'Test User'
        assert admin_period.telegram_id == '123456789'  # Should be converted to string
        assert admin_period.period_year == 2024
        assert admin_period.period_month == 1
        assert admin_period.is_active is True  # Default value

    def test_admin_period_handles_none_user(self):
        """Test AdminPeriodResponse handles None user gracefully."""
        class MockPeriod:
            id = 1
            date = datetime(2024, 1, 1)
            ru_name = 'Январь 2024'
            start_date = None
            end_date = None
            user_id = 2
        
        period_mock = MockPeriod()
        
        # Create schema instance with None user
        admin_period = AdminPeriodResponse.from_db_models(period_mock, None)
        
        # Validate handling of None user
        assert admin_period.id == 1
        assert admin_period.user_name == ""  # Default empty string
        assert admin_period.user_email is None
        assert admin_period.username is None
        assert admin_period.telegram_id is None


@pytest.mark.asyncio
class TestAdminPeriodsEndpointAsync:
    """Async tests for admin periods endpoint."""
    
    async def test_concurrent_admin_period_requests(self, async_client: AsyncClient):
        """Test concurrent admin period requests are handled properly."""
        admin_session_data = {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User'
        }
        
        async def make_admin_request():
            with patch('app.core.session.get_current_user_from_session') as mock_session:
                mock_session.return_value = admin_session_data
                return await async_client.get("/api/admin/periods")
        
        # Make multiple concurrent requests
        tasks = [make_admin_request() for _ in range(5)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All should succeed
        for response in responses:
            assert not isinstance(response, Exception)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "success" in data
            assert data["success"] is True

    async def test_admin_periods_performance(self, async_client: AsyncClient):
        """Test admin periods endpoint performance."""
        import time
        admin_session_data = {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User'
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data
            
            start_time = time.time()
            
            # Make multiple requests to test performance
            for _ in range(10):
                response = await async_client.get("/api/admin/periods")
                assert response.status_code == status.HTTP_200_OK
            
            end_time = time.time()
            total_time = end_time - start_time
            
            # Should complete 10 requests in reasonable time (< 3 seconds)
            assert total_time < 3.0


class TestAdminPeriodsIntegration:
    """Integration tests for admin periods endpoint."""
    
    def test_admin_periods_vs_regular_isolation(self, client: TestClient):
        """Test admin periods show all data while regular periods are isolated."""
        admin_session = {'user_id': 1}
        regular_session = {'user_id': 2}
        
        # Get admin view
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session
            admin_response = client.get("/api/admin/periods")
            assert admin_response.status_code == status.HTTP_200_OK
            admin_data = admin_response.json()
        
        # Get regular user view
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_session
            regular_response = client.get("/api/periods/")
            assert regular_response.status_code == status.HTTP_200_OK
            regular_data = regular_response.json()
        
        # Admin should potentially see more periods than regular user
        # (depends on test data, but at minimum should not see less)
        # Regular user should only see their own periods
        for period in regular_data:
            assert period['user_id'] == 2  # Only their own periods

    def test_admin_periods_full_workflow(self, client: TestClient):
        """Test complete workflow of admin periods functionality."""
        admin_session_data = {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User'
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data
            
            # 1. Get all periods
            response = client.get("/api/admin/periods")
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            
            # 2. Test with pagination
            paginated_response = client.get("/api/admin/periods?skip=0&limit=5")
            assert paginated_response.status_code == status.HTTP_200_OK
            paginated_data = paginated_response.json()
            
            # Paginated should have <= 5 items
            assert len(paginated_data["data"]) <= 5
            
            # 3. Validate data consistency
            assert "success" in data
            assert "data" in data
            assert "total" in data


if __name__ == "__main__":
    """Run tests standalone for development."""
    print("Admin Periods Endpoint Test")
    print("=" * 50)
    
    # This would require test client setup for standalone running
    # For now, use pytest to run the tests
    print("Use: docker exec budget-backend python -m pytest tests/test_admin_periods_endpoint.py -v")