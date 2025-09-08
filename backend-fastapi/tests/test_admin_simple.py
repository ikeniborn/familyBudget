"""
Simple tests for admin API endpoints access control.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from unittest.mock import patch


class TestAdminEndpointsSimple:
    """Simple tests for admin endpoints access control."""

    def test_admin_get_all_users_success(self, client: TestClient):
        """Test admin can access all users endpoint."""
        admin_session_data = {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User',
            'user_email': 'admin@example.com'
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data
            
            response = client.get("/api/users/admin/all")
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert isinstance(data, list)
    
    def test_admin_get_all_users_unauthorized(self, client: TestClient):
        """Test unauthenticated user cannot access admin endpoint."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = None
            
            response = client.get("/api/users/admin/all")
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            data = response.json()
            assert "Not authenticated" in data["detail"]
    
    def test_admin_get_all_users_forbidden(self, client: TestClient):
        """Test regular user cannot access admin endpoint."""
        regular_user_session_data = {
            'user_id': 2,
            'username': 'regular',
            'user_name': 'Regular User',
            'user_email': 'user@example.com'
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_session_data
            
            response = client.get("/api/users/admin/all")
            assert response.status_code == status.HTTP_403_FORBIDDEN
            data = response.json()
            assert "Admin access required" in data["detail"]
    
    def test_admin_create_user_success(self, client: TestClient):
        """Test admin can create users."""
        admin_session_data = {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User',
            'user_email': 'admin@example.com'
        }
        
        user_data = {
            "user_name": "New User",
            "user_email": "newuser@example.com",
            "username": "newuser",
            "password": "NewPassword123!",
            "auth_method": "password"
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data
            
            response = client.post("/api/users/admin", json=user_data)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["user_name"] == user_data["user_name"]
            assert data["user_email"] == user_data["user_email"]
            assert "password" not in data
    
    def test_admin_create_user_forbidden(self, client: TestClient):
        """Test regular user cannot create users via admin endpoint."""
        regular_user_session_data = {
            'user_id': 2,
            'username': 'regular',
            'user_name': 'Regular User',
            'user_email': 'user@example.com'
        }
        
        user_data = {
            "user_name": "New User",
            "user_email": "newuser@example.com",
            "username": "newuser",
            "password": "NewPassword123!",
            "auth_method": "password"
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_session_data
            
            response = client.post("/api/users/admin", json=user_data)
            assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_admin_get_users_stats_success(self, client: TestClient):
        """Test admin can get user statistics."""
        admin_session_data = {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User'
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data
            
            response = client.get("/api/users/admin/stats")
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "total" in data
            assert "active" in data
            assert "inactive" in data
            assert "blocked" in data
            assert isinstance(data["total"], int)
            assert isinstance(data["active"], int)
    
    def test_admin_get_users_stats_forbidden(self, client: TestClient):
        """Test regular user cannot access user statistics."""
        regular_user_session_data = {
            'user_id': 2,
            'username': 'regular',
            'user_name': 'Regular User'
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_session_data
            
            response = client.get("/api/users/admin/stats")
            assert response.status_code == status.HTTP_403_FORBIDDEN


class TestSecurityDependency:
    """Test the require_admin_access dependency."""
    
    def test_require_admin_access_with_no_user(self):
        """Test require_admin_access rejects unauthenticated request."""
        from app.core.security import require_admin_access
        from unittest.mock import Mock
        from fastapi import HTTPException
        
        mock_request = Mock()
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = None
            
            # This should raise a 401 exception
            with pytest.raises(HTTPException) as exc_info:
                import asyncio
                asyncio.run(require_admin_access(mock_request))
            
            assert exc_info.value.status_code == 401
            assert "Not authenticated" in str(exc_info.value.detail)
    
    def test_require_admin_access_edge_cases(self):
        """Test require_admin_access with edge cases."""
        from app.core.security import require_admin_access
        from unittest.mock import Mock
        from fastapi import HTTPException
        
        mock_request = Mock()
        
        # Test with user_id = 0
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = {'user_id': 0}
            
            with pytest.raises(HTTPException) as exc_info:
                import asyncio
                asyncio.run(require_admin_access(mock_request))
            
            assert exc_info.value.status_code == 403
        
        # Test with string user_id '1' (should fail - must be integer 1)
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = {'user_id': '1'}
            
            with pytest.raises(HTTPException) as exc_info:
                import asyncio
                asyncio.run(require_admin_access(mock_request))
            
            assert exc_info.value.status_code == 403
        
        # Test with missing user_id
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = {'username': 'admin'}
            
            with pytest.raises(HTTPException) as exc_info:
                import asyncio
                asyncio.run(require_admin_access(mock_request))
            
            assert exc_info.value.status_code == 403
    
    def test_require_admin_access_success(self):
        """Test require_admin_access allows admin user."""
        from app.core.security import require_admin_access
        from unittest.mock import Mock
        
        admin_session_data = {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User'
        }
        
        # Mock request with session
        mock_request = Mock()
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data
            
            # This should not raise an exception
            import asyncio
            result = asyncio.run(require_admin_access(mock_request))
            assert result == admin_session_data