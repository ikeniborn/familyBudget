"""
Tests for admin API endpoints access control.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
import json


class TestAdminEndpointsAccess:
    """Test admin endpoints access control."""
    
    @pytest.fixture
    def admin_session_data(self):
        """Create admin session data."""
        return {
            'user': {
                'user_id': 1,
                'username': 'admin',
                'user_name': 'Admin User',
                'user_email': 'admin@example.com'
            }
        }
    
    @pytest.fixture
    def regular_user_session_data(self):
        """Create regular user session data."""
        return {
            'user': {
                'user_id': 2,
                'username': 'regular',
                'user_name': 'Regular User',
                'user_email': 'user@example.com'
            }
        }
    
    def create_mock_session(self, session_data):
        """Helper to create mock session with given data."""
        async def mock_session(*args, **kwargs):
            return session_data
        return mock_session

    def test_admin_get_all_users_success(self, client: TestClient, admin_session_data):
        """Test admin can access all users endpoint."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data['user']
            
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
    
    def test_admin_get_all_users_forbidden(self, client: TestClient, regular_user_session_data):
        """Test regular user cannot access admin endpoint."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_session_data['user']
            
            response = client.get("/api/users/admin/all")
            assert response.status_code == status.HTTP_403_FORBIDDEN
            data = response.json()
            assert "Admin access required" in data["detail"]
    
    def test_admin_create_user_success(self, client: TestClient, admin_session_data):
        """Test admin can create users."""
        user_data = {
            "user_name": "New User",
            "user_email": "newuser@example.com",
            "username": "newuser",
            "password": "NewPassword123!",
            "auth_method": "password"
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data['user']
            
            response = client.post("/api/users/admin", json=user_data)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["user_name"] == user_data["user_name"]
            assert data["user_email"] == user_data["user_email"]
            assert "password" not in data
    
    def test_admin_create_user_forbidden(self, client: TestClient, regular_user_session_data):
        """Test regular user cannot create users via admin endpoint."""
        user_data = {
            "user_name": "New User",
            "user_email": "newuser@example.com",
            "username": "newuser",
            "password": "NewPassword123!",
            "auth_method": "password"
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_session_data['user']
            
            response = client.post("/api/users/admin", json=user_data)
            assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_admin_update_user_success(self, client: TestClient, admin_session_data):
        """Test admin can update any user."""
        # First create a user to update
        create_data = {
            "user_name": "Test User",
            "user_email": "test@example.com",
            "username": "testuser",
            "password": "TestPassword123!",
            "auth_method": "password"
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data['user']
            
            create_response = client.post("/api/users/admin", json=create_data)
            assert create_response.status_code == status.HTTP_200_OK
            user_id = create_response.json()["id"]
            
            # Update the user
            update_data = {
                "user_name": "Updated User Name",
                "user_email": "updated@example.com"
            }
            
            response = client.put(f"/api/users/admin/{user_id}", json=update_data)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["user_name"] == update_data["user_name"]
            assert data["user_email"] == update_data["user_email"]
    
    def test_admin_update_user_forbidden(self, client: TestClient, regular_user_session_data):
        """Test regular user cannot update users via admin endpoint."""
        update_data = {
            "user_name": "Updated Name",
            "user_email": "updated@example.com"
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_session_data['user']
            
            response = client.put("/api/users/admin/999", json=update_data)
            assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_admin_toggle_user_status_success(self, client: TestClient, admin_session_data):
        """Test admin can toggle user status."""
        # First create a user
        create_data = {
            "user_name": "Test User",
            "user_email": "test@example.com",
            "username": "testuser",
            "password": "TestPassword123!",
            "auth_method": "password"
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data['user']
            
            create_response = client.post("/api/users/admin", json=create_data)
            user_id = create_response.json()["id"]
            
            # Toggle status
            response = client.patch(f"/api/users/admin/{user_id}/toggle-status")
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "is_active" in data
    
    def test_admin_toggle_user_status_forbidden(self, client: TestClient, regular_user_session_data):
        """Test regular user cannot toggle user status."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_session_data['user']
            
            response = client.patch("/api/users/admin/999/toggle-status")
            assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_admin_get_users_stats_success(self, client: TestClient, admin_session_data):
        """Test admin can get user statistics."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data['user']
            
            response = client.get("/api/users/admin/stats")
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "total" in data
            assert "active" in data
            assert "inactive" in data
            assert "blocked" in data
            assert isinstance(data["total"], int)
            assert isinstance(data["active"], int)
    
    def test_admin_get_users_stats_forbidden(self, client: TestClient, regular_user_session_data):
        """Test regular user cannot access user statistics."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_session_data['user']
            
            response = client.get("/api/users/admin/stats")
            assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_admin_endpoint_nonexistent_user(self, client: TestClient, admin_session_data):
        """Test admin endpoints handle non-existent users correctly."""
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data['user']
            
            # Try to update non-existent user
            update_data = {"user_name": "Updated Name"}
            response = client.put("/api/users/admin/99999", json=update_data)
            assert response.status_code == status.HTTP_404_NOT_FOUND
            
            # Try to toggle status of non-existent user
            response = client.patch("/api/users/admin/99999/toggle-status")
            assert response.status_code == status.HTTP_404_NOT_FOUND


class TestSecurityDependency:
    """Test the require_admin_access dependency."""
    
    def test_require_admin_access_with_admin_user(self, admin_session_data):
        """Test require_admin_access allows admin user."""
        from app.core.security import require_admin_access
        from unittest.mock import Mock
        
        # Mock request with session
        mock_request = Mock()
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data['user']
            
            # This should not raise an exception
            import asyncio
            result = asyncio.run(require_admin_access(mock_request))
            assert result == admin_session_data['user']
    
    def test_require_admin_access_with_regular_user(self, regular_user_session_data):
        """Test require_admin_access rejects regular user."""
        from app.core.security import require_admin_access
        from unittest.mock import Mock
        from fastapi import HTTPException
        
        mock_request = Mock()
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_user_session_data['user']
            
            # This should raise a 403 exception
            with pytest.raises(HTTPException) as exc_info:
                import asyncio
                asyncio.run(require_admin_access(mock_request))
            
            assert exc_info.value.status_code == 403
            assert "Admin access required" in str(exc_info.value.detail)
    
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


@pytest.mark.asyncio
class TestAdminEndpointsAsync:
    """Async tests for admin endpoints."""
    
    async def test_concurrent_admin_requests(self, async_client: AsyncClient):
        """Test concurrent admin requests are handled properly."""
        import asyncio
        from unittest.mock import patch
        
        admin_session_data = {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User'
        }
        
        async def make_admin_request():
            with patch('app.core.session.get_current_user_from_session') as mock_session:
                mock_session.return_value = admin_session_data
                return await async_client.get("/api/users/admin/stats")
        
        # Make multiple concurrent requests
        tasks = [make_admin_request() for _ in range(10)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All should succeed
        for response in responses:
            assert not isinstance(response, Exception)
            assert response.status_code == status.HTTP_200_OK
    
    async def test_admin_session_validation_performance(self, async_client: AsyncClient):
        """Test admin session validation performance."""
        import time
        from unittest.mock import patch
        
        admin_session_data = {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User'
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data
            
            start_time = time.time()
            
            # Make many requests to test performance
            for _ in range(100):
                response = await async_client.get("/api/users/admin/stats")
                assert response.status_code == status.HTTP_200_OK
            
            end_time = time.time()
            total_time = end_time - start_time
            
            # Should complete 100 requests in reasonable time (< 5 seconds)
            assert total_time < 5.0
    
    async def test_admin_access_session_corruption(self, async_client: AsyncClient):
        """Test admin access handles session corruption gracefully."""
        from unittest.mock import patch
        
        # Test with corrupted session data
        corrupted_sessions = [
            None,  # No session
            {},  # Empty session
            {'user_id': None},  # Null user_id
            {'user_id': 'invalid'},  # Invalid user_id type
            {'other_field': 'value'},  # Missing user_id
        ]
        
        for corrupted_session in corrupted_sessions:
            with patch('app.core.session.get_current_user_from_session') as mock_session:
                mock_session.return_value = corrupted_session
                
                response = await async_client.get("/api/users/admin/stats")
                
                # Should return proper error status, not crash
                assert response.status_code in [401, 403]
                assert response.json()["detail"] in ["Not authenticated", "Admin access required"]


class TestAdminEndpointsIntegration:
    """Integration tests for admin endpoints."""
    
    def test_admin_user_lifecycle(self, client: TestClient):
        """Test complete admin user management lifecycle."""
        admin_session_data = {
            'user_id': 1,
            'username': 'admin',
            'user_name': 'Admin User'
        }
        
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session_data
            
            # 1. Create user
            user_data = {
                "user_name": "Test User",
                "user_email": "test@example.com",
                "username": "testuser",
                "password": "TestPassword123!",
                "auth_method": "password"
            }
            
            create_response = client.post("/api/users/admin", json=user_data)
            assert create_response.status_code == status.HTTP_200_OK
            created_user = create_response.json()
            user_id = created_user["id"]
            
            # 2. Get all users (should include new user)
            get_all_response = client.get("/api/users/admin/all")
            assert get_all_response.status_code == status.HTTP_200_OK
            all_users = get_all_response.json()
            assert any(user["id"] == user_id for user in all_users)
            
            # 3. Update user
            update_data = {"user_name": "Updated Test User"}
            update_response = client.put(f"/api/users/admin/{user_id}", json=update_data)
            assert update_response.status_code == status.HTTP_200_OK
            updated_user = update_response.json()
            assert updated_user["user_name"] == "Updated Test User"
            
            # 4. Toggle user status
            toggle_response = client.patch(f"/api/users/admin/{user_id}/toggle-status")
            assert toggle_response.status_code == status.HTTP_200_OK
            toggled_user = toggle_response.json()
            assert toggled_user["is_active"] != created_user["is_active"]
            
            # 5. Get stats (should reflect changes)
            stats_response = client.get("/api/users/admin/stats")
            assert stats_response.status_code == status.HTTP_200_OK
            stats = stats_response.json()
            assert stats["total"] > 0
    
    def test_admin_vs_regular_endpoints_isolation(self, client: TestClient):
        """Test that admin endpoints don't interfere with regular endpoints."""
        admin_session = {'user_id': 1}
        regular_session = {'user_id': 2}
        
        # Admin can access admin endpoints
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = admin_session
            
            admin_response = client.get("/api/users/admin/all")
            assert admin_response.status_code == status.HTTP_200_OK
            
            # Admin can also access regular endpoints
            regular_response = client.get("/api/users/")
            assert regular_response.status_code == status.HTTP_200_OK
        
        # Regular user can only access regular endpoints
        with patch('app.core.session.get_current_user_from_session') as mock_session:
            mock_session.return_value = regular_session
            
            admin_response = client.get("/api/users/admin/all")
            assert admin_response.status_code == status.HTTP_403_FORBIDDEN
            
            regular_response = client.get("/api/users/")
            assert regular_response.status_code == status.HTTP_200_OK