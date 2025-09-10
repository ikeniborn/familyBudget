"""
Focused test for admin periods endpoint functionality.
Tests the actual endpoint logic with proper mocking.
"""

import pytest
from datetime import datetime
from fastapi import status
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import User, Period
from app.schemas.period import AdminPeriodResponse


class MockUser:
    """Mock User model for testing."""
    def __init__(self, id: int, user_name: str, user_email: str = None, username: str = None, telegram_id: int = None):
        self.id = id
        self.user_name = user_name
        self.user_email = user_email
        self.username = username
        self.telegram_id = telegram_id
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_name": self.user_name,
            "user_email": self.user_email,
            "username": self.username,
            "telegram_id": str(self.telegram_id) if self.telegram_id else None,
            "is_active": True
        }


class MockPeriod:
    """Mock Period model for testing."""
    def __init__(self, id: int, date: datetime, ru_name: str, user_id: int, 
                 start_date: datetime = None, end_date: datetime = None):
        self.id = id
        self.date = date
        self.ru_name = ru_name
        self.user_id = user_id
        self.start_date = start_date
        self.end_date = end_date


class TestAdminPeriodsFocused:
    """Focused tests for admin periods endpoint."""
    
    def test_admin_periods_endpoint_with_data(self, client: TestClient):
        """Test admin periods endpoint returns expected data structure."""
        admin_user = {'user_id': 1, 'username': 'admin', 'user_name': 'Admin User'}
        
        # Mock users and periods data
        mock_users = [
            MockUser(1, "Admin User", "admin@example.com", "admin", 111111),
            MockUser(2, "Regular User", "user@example.com", "user", 222222),
            MockUser(3, "Another User", "another@example.com", "another", 333333)
        ]
        
        mock_periods = [
            MockPeriod(1, datetime(2024, 1, 1), "Январь 2024", 1),
            MockPeriod(2, datetime(2024, 2, 1), "Февраль 2024", 2),
            MockPeriod(3, datetime(2024, 3, 1), "Март 2024", 1),
            MockPeriod(4, datetime(2024, 4, 1), "Апрель 2024", 3)
        ]
        
        # Create period-user pairs for the JOIN query result
        periods_with_users = []
        for period in mock_periods:
            user = next((u for u in mock_users if u.id == period.user_id), None)
            periods_with_users.append((period, user))
        
        # Mock the database query results
        async def mock_execute(stmt):
            mock_result = AsyncMock()
            
            # Check if this is the main query or count query based on statement
            stmt_str = str(stmt)
            if "SELECT" in stmt_str and "JOIN" in stmt_str:
                # Main query - return periods with users
                mock_result.all.return_value = periods_with_users
            else:
                # Count query - return all periods
                mock_result.scalars.return_value.all.return_value = mock_periods
            
            return mock_result
        
        with patch('app.core.session.get_current_user_from_session', return_value=admin_user):
            with patch('app.db.database.get_db') as mock_get_db:
                mock_db = AsyncMock()
                mock_db.execute.side_effect = mock_execute
                mock_get_db.return_value.__aenter__.return_value = mock_db
                
                response = client.get("/api/admin/periods")
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                
                # Validate response structure
                assert "success" in data
                assert data["success"] is True
                assert "data" in data
                assert "total" in data
                assert isinstance(data["data"], list)
                assert data["total"] == len(mock_periods)
                
                # Validate first period has all required fields
                if data["data"]:
                    period = data["data"][0]
                    
                    # Core period fields
                    assert "id" in period
                    assert "date" in period
                    assert "ru_name" in period
                    assert "user_id" in period
                    
                    # User information fields (admin-specific)
                    assert "user_name" in period
                    assert "user_email" in period
                    assert "username" in period
                    assert "telegram_id" in period
                    
                    # Legacy compatibility fields
                    assert "period_id" in period
                    assert "period_name" in period
                    assert "period_year" in period
                    assert "period_month" in period
                    
                    # Validate data values
                    assert period["user_name"] == "Admin User"
                    assert period["user_email"] == "admin@example.com"
                    assert period["username"] == "admin"
                    assert period["telegram_id"] == "111111"
                    assert period["period_year"] == 2024
                    assert period["period_month"] == 1

    def test_admin_periods_authorization_admin_user(self, client: TestClient):
        """Test that admin user (user_id = 1) can access admin periods endpoint."""
        admin_user = {'user_id': 1, 'username': 'admin', 'user_name': 'Admin User'}
        
        with patch('app.core.session.get_current_user_from_session', return_value=admin_user):
            with patch('app.db.database.get_db') as mock_get_db:
                mock_db = AsyncMock()
                mock_result = AsyncMock()
                mock_result.all.return_value = []
                mock_result.scalars.return_value.all.return_value = []
                mock_db.execute.return_value = mock_result
                mock_get_db.return_value.__aenter__.return_value = mock_db
                
                response = client.get("/api/admin/periods")
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["success"] is True

    def test_admin_periods_authorization_regular_user(self, client: TestClient):
        """Test that regular user cannot access admin periods endpoint."""
        regular_user = {'user_id': 2, 'username': 'regular', 'user_name': 'Regular User'}
        
        with patch('app.core.session.get_current_user_from_session', return_value=regular_user):
            response = client.get("/api/admin/periods")
            
            assert response.status_code == status.HTTP_403_FORBIDDEN
            data = response.json()
            assert "Admin access required" in data["detail"]

    def test_admin_periods_authorization_no_user(self, client: TestClient):
        """Test that unauthenticated request cannot access admin periods endpoint."""
        with patch('app.core.session.get_current_user_from_session', return_value=None):
            response = client.get("/api/admin/periods")
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            data = response.json()
            assert "Not authenticated" in data["detail"]

    def test_regular_periods_vs_admin_periods_comparison(self, client: TestClient):
        """Test comparison between regular and admin periods endpoints."""
        admin_user = {'user_id': 1, 'username': 'admin', 'user_name': 'Admin User'}
        regular_user = {'user_id': 2, 'username': 'regular', 'user_name': 'Regular User'}
        
        # Mock data
        mock_user = MockUser(2, "Regular User", "user@example.com", "regular", 222222)
        mock_period = MockPeriod(1, datetime(2024, 1, 1), "Январь 2024", 2)
        
        # Test regular periods endpoint (should only return user's own periods)
        with patch('app.core.session.get_current_user_from_session', return_value=regular_user):
            with patch('app.db.database.get_db') as mock_get_db:
                mock_db = AsyncMock()
                mock_result = AsyncMock()
                mock_result.scalars.return_value.all.return_value = [mock_period]
                mock_db.execute.return_value = mock_result
                mock_get_db.return_value.__aenter__.return_value = mock_db
                
                regular_response = client.get("/api/periods/")
                
                assert regular_response.status_code == status.HTTP_200_OK
                regular_data = regular_response.json()
                
                # Regular endpoint returns array directly
                assert isinstance(regular_data, list)
                if regular_data:
                    period = regular_data[0]
                    assert period["user_id"] == 2  # Only user's own periods
                    # Should NOT have user information from other users
                    assert "user_name" not in period or period.get("user_name") is None
        
        # Test admin periods endpoint (should return all periods with user info)
        with patch('app.core.session.get_current_user_from_session', return_value=admin_user):
            with patch('app.db.database.get_db') as mock_get_db:
                mock_db = AsyncMock()
                
                async def mock_execute(stmt):
                    mock_result = AsyncMock()
                    stmt_str = str(stmt)
                    if "SELECT" in stmt_str and "JOIN" in stmt_str:
                        # Main query with JOIN - return period with user
                        mock_result.all.return_value = [(mock_period, mock_user)]
                    else:
                        # Count query
                        mock_result.scalars.return_value.all.return_value = [mock_period]
                    return mock_result
                
                mock_db.execute.side_effect = mock_execute
                mock_get_db.return_value.__aenter__.return_value = mock_db
                
                admin_response = client.get("/api/admin/periods")
                
                assert admin_response.status_code == status.HTTP_200_OK
                admin_data = admin_response.json()
                
                # Admin endpoint returns structured response with metadata
                assert "success" in admin_data
                assert "data" in admin_data
                assert admin_data["success"] is True
                
                if admin_data["data"]:
                    period = admin_data["data"][0]
                    assert period["user_id"] == 2
                    # Should HAVE user information
                    assert "user_name" in period
                    assert period["user_name"] == "Regular User"
                    assert period["user_email"] == "user@example.com"
                    assert period["username"] == "regular"
                    assert period["telegram_id"] == "222222"

    def test_admin_period_response_schema_creation(self):
        """Test AdminPeriodResponse schema creation."""
        mock_period = MockPeriod(1, datetime(2024, 1, 1), "Январь 2024", 2)
        mock_user = MockUser(2, "Test User", "test@example.com", "testuser", 123456789)
        
        admin_period = AdminPeriodResponse.from_db_models(mock_period, mock_user)
        
        # Validate core fields
        assert admin_period.id == 1
        assert admin_period.ru_name == "Январь 2024"
        assert admin_period.user_id == 2
        
        # Validate user information
        assert admin_period.user_name == "Test User"
        assert admin_period.user_email == "test@example.com"
        assert admin_period.username == "testuser"
        assert admin_period.telegram_id == "123456789"  # Should be string
        
        # Validate legacy fields
        assert admin_period.period_id == 1
        assert admin_period.period_name == "Январь 2024"
        assert admin_period.period_year == 2024
        assert admin_period.period_month == 1
        
        # Convert to dict to validate JSON serialization
        period_dict = admin_period.dict()
        assert isinstance(period_dict, dict)
        assert period_dict["user_name"] == "Test User"
        assert period_dict["telegram_id"] == "123456789"

    def test_admin_periods_pagination(self, client: TestClient):
        """Test admin periods endpoint supports pagination."""
        admin_user = {'user_id': 1, 'username': 'admin', 'user_name': 'Admin User'}
        
        # Mock large dataset
        mock_periods = [
            MockPeriod(i, datetime(2024, i, 1), f"Период {i}", 1) 
            for i in range(1, 21)  # 20 periods
        ]
        mock_user = MockUser(1, "Admin User", "admin@example.com")
        
        periods_with_users = [(p, mock_user) for p in mock_periods]
        
        with patch('app.core.session.get_current_user_from_session', return_value=admin_user):
            with patch('app.db.database.get_db') as mock_get_db:
                mock_db = AsyncMock()
                
                async def mock_execute_paginated(stmt):
                    mock_result = AsyncMock()
                    stmt_str = str(stmt)
                    
                    if "SELECT" in stmt_str and "JOIN" in stmt_str:
                        # Main query - apply pagination
                        if "LIMIT" in stmt_str:
                            # Return first 5 items for pagination test
                            mock_result.all.return_value = periods_with_users[:5]
                        else:
                            mock_result.all.return_value = periods_with_users
                    else:
                        # Count query
                        mock_result.scalars.return_value.all.return_value = mock_periods
                    
                    return mock_result
                
                mock_db.execute.side_effect = mock_execute_paginated
                mock_get_db.return_value.__aenter__.return_value = mock_db
                
                response = client.get("/api/admin/periods?skip=0&limit=5")
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                
                assert data["success"] is True
                assert len(data["data"]) <= 5  # Respects limit
                assert data["total"] == 20  # Total count unchanged

    def test_admin_periods_data_isolation(self, client: TestClient):
        """Test that admin periods shows all users' data while maintaining proper format."""
        admin_user = {'user_id': 1, 'username': 'admin', 'user_name': 'Admin User'}
        
        # Mock multi-user data
        mock_users = [
            MockUser(1, "Admin User", "admin@example.com", "admin"),
            MockUser(2, "User Two", "user2@example.com", "user2"),
            MockUser(3, "User Three", "user3@example.com", "user3")
        ]
        
        mock_periods = [
            MockPeriod(1, datetime(2024, 1, 1), "Январь 2024", 1),  # Admin's period
            MockPeriod(2, datetime(2024, 1, 1), "Январь 2024", 2),  # User 2's period  
            MockPeriod(3, datetime(2024, 1, 1), "Январь 2024", 3),  # User 3's period
        ]
        
        periods_with_users = []
        for period in mock_periods:
            user = next((u for u in mock_users if u.id == period.user_id), None)
            periods_with_users.append((period, user))
        
        with patch('app.core.session.get_current_user_from_session', return_value=admin_user):
            with patch('app.db.database.get_db') as mock_get_db:
                mock_db = AsyncMock()
                
                async def mock_execute(stmt):
                    mock_result = AsyncMock()
                    stmt_str = str(stmt)
                    if "SELECT" in stmt_str and "JOIN" in stmt_str:
                        # Main query - return all periods with users (admin sees all)
                        mock_result.all.return_value = periods_with_users
                    else:
                        # Count query
                        mock_result.scalars.return_value.all.return_value = mock_periods
                    return mock_result
                
                mock_db.execute.side_effect = mock_execute
                mock_get_db.return_value.__aenter__.return_value = mock_db
                
                response = client.get("/api/admin/periods")
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                
                assert data["success"] is True
                assert len(data["data"]) == 3  # All users' periods
                assert data["total"] == 3
                
                # Validate each period has correct user information
                user_names = [p["user_name"] for p in data["data"]]
                assert "Admin User" in user_names
                assert "User Two" in user_names
                assert "User Three" in user_names
                
                # Validate each period has the user_id matching the user info
                for period in data["data"]:
                    user_id = period["user_id"]
                    expected_user = next((u for u in mock_users if u.id == user_id), None)
                    assert period["user_name"] == expected_user.user_name
                    assert period["user_email"] == expected_user.user_email