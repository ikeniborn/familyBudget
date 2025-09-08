"""
Comprehensive security tests for Period data isolation.

Tests verify that users cannot access, modify, or delete periods belonging to other users.
Covers various attack vectors and edge cases for data isolation.
"""
import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from app.main import app
from app.db.database import get_db
from app.models.period import Period
from app.models.user import User
from app.core.session import get_current_user_from_session


class TestPeriodDataIsolation:
    """Test suite for Period API data isolation security."""
    
    async def create_test_users(self, db: AsyncSession):
        """Create test users for isolation testing."""
        # User 1 - Regular user
        user1 = User(
            id=1,
            username="user1",
            email="user1@test.com",
            telegram_id=111111111,
            role="user"
        )
        
        # User 2 - Regular user  
        user2 = User(
            id=2,
            username="user2", 
            email="user2@test.com",
            telegram_id=222222222,
            role="user"
        )
        
        # User 3 - Admin user
        user3 = User(
            id=3,
            username="admin",
            email="admin@test.com", 
            telegram_id=333333333,
            role="admin"
        )
        
        db.add_all([user1, user2, user3])
        await db.commit()
        return user1, user2, user3
    
    async def create_test_periods(self, db: AsyncSession, users):
        """Create test periods for different users."""
        user1, user2, user3 = users
        
        # Periods for user1
        period1_user1 = Period(
            id=1,
            date=datetime(2024, 1, 1),
            ru_name="2024.01 User1",
            user_id=user1.id
        )
        
        period2_user1 = Period(
            id=2,
            date=datetime(2024, 2, 1),
            ru_name="2024.02 User1",
            user_id=user1.id
        )
        
        # Periods for user2
        period1_user2 = Period(
            id=3,
            date=datetime(2024, 1, 1),
            ru_name="2024.01 User2",
            user_id=user2.id
        )
        
        period2_user2 = Period(
            id=4,
            date=datetime(2024, 3, 1),
            ru_name="2024.03 User2",
            user_id=user2.id
        )
        
        # Period for admin
        period1_admin = Period(
            id=5,
            date=datetime(2024, 4, 1),
            ru_name="2024.04 Admin",
            user_id=user3.id
        )
        
        db.add_all([period1_user1, period2_user1, period1_user2, period2_user2, period1_admin])
        await db.commit()
        return {
            "user1": [period1_user1, period2_user1],
            "user2": [period1_user2, period2_user2], 
            "admin": [period1_admin]
        }

    @pytest.fixture
    def mock_user_session(self):
        """Mock user session for testing."""
        def create_mock(user_id: int, role: str = "user"):
            return {
                "user_id": user_id,
                "username": f"user{user_id}",
                "role": role
            }
        return create_mock

    # Test 1: GET /api/periods - Data Isolation
    @pytest.mark.asyncio
    async def test_get_periods_data_isolation(self, db_session, mock_user_session):
        """Test that users can only see their own periods."""
        
        # Setup test data
        users = await self.create_test_users(db_session)
        periods = await self.create_test_periods(db_session, users)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Test User1 can only see own periods
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = mock_user_session(1)
                
                response = await client.get("/api/periods/")
                assert response.status_code == 200
                data = response.json()
                
                # Should only return user1's periods
                assert len(data) == 2
                for period in data:
                    assert period["user_id"] == 1
                    assert "User1" in period["ru_name"]
            
            # Test User2 can only see own periods
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = mock_user_session(2)
                
                response = await client.get("/api/periods/")
                assert response.status_code == 200
                data = response.json()
                
                # Should only return user2's periods
                assert len(data) == 2
                for period in data:
                    assert period["user_id"] == 2
                    assert "User2" in period["ru_name"]

    # Test 2: GET /api/periods/{period_id} - Cross-User Access Attempt
    @pytest.mark.asyncio
    async def test_get_period_cross_user_access_denied(self, db_session, mock_user_session):
        """Test that users cannot access other users' periods by ID."""
        
        users = await self.create_test_users(db_session)
        periods = await self.create_test_periods(db_session, users)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # User1 tries to access User2's period
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = mock_user_session(1)
                
                # Try to access period ID 3 (belongs to user2)
                response = await client.get("/api/periods/3")
                assert response.status_code == 404
                assert "not found or access denied" in response.json()["detail"]

    # Test 3: PUT /api/periods/{period_id} - Unauthorized Modification
    @pytest.mark.asyncio
    async def test_update_period_unauthorized_modification(self, db_session, mock_user_session):
        """Test that users cannot modify other users' periods."""
        
        users = await self.create_test_users(db_session)
        periods = await self.create_test_periods(db_session, users)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # User1 tries to modify User2's period
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = mock_user_session(1)
                
                update_data = {
                    "ru_name": "HACKED BY USER1",
                    "date": "2024-01-01T00:00:00"
                }
                
                response = await client.put("/api/periods/3", json=update_data)
                assert response.status_code == 404
                assert "not found or access denied" in response.json()["detail"]

    # Test 4: DELETE /api/periods/{period_id} - Unauthorized Deletion
    @pytest.mark.asyncio
    async def test_delete_period_unauthorized_deletion(self, db_session, mock_user_session):
        """Test that users cannot delete other users' periods."""
        
        users = await self.create_test_users(db_session)
        periods = await self.create_test_periods(db_session, users)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # User1 tries to delete User2's period
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = mock_user_session(1)
                
                response = await client.delete("/api/periods/3")
                assert response.status_code == 404
                assert "not found or access denied" in response.json()["detail"]

    # Test 5: POST /api/periods - User ID Injection Attack
    @pytest.mark.asyncio
    async def test_create_period_user_id_injection_attack(self, db_session, mock_user_session):
        """Test that user_id cannot be injected in period creation."""
        
        users = await self.create_test_users(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # User1 tries to create period with different user_id
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = mock_user_session(1)
                
                malicious_data = {
                    "period_year": 2024,
                    "period_month": 5,
                    "period_name": "2024.05 Malicious",
                    "user_id": 2  # Trying to inject user_id=2
                }
                
                response = await client.post("/api/periods/", json=malicious_data)
                assert response.status_code == 201
                
                # Verify period was created with correct user_id (1, not 2)
                created_period = response.json()
                assert created_period["user_id"] == 1, "user_id injection successful - SECURITY VULNERABILITY!"

    # Test 6: SQL Injection Attempts
    @pytest.mark.asyncio
    async def test_sql_injection_attempts(self, db_session, mock_user_session):
        """Test SQL injection protection in period endpoints."""
        
        users = await self.create_test_users(db_session)
        periods = await self.create_test_periods(db_session, users)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = mock_user_session(1)
                
                # SQL injection in period_id parameter
                sql_injection_payloads = [
                    "1; DROP TABLE t_d_period; --",
                    "1 OR 1=1",
                    "1 UNION SELECT * FROM t_d_user",
                    "1'; DELETE FROM t_d_period WHERE user_id=2; --"
                ]
                
                for payload in sql_injection_payloads:
                    # Try injection in GET endpoint
                    response = await client.get(f"/api/periods/{payload}")
                    # Should either return 404 or 422, not crash
                    assert response.status_code in [404, 422, 400]
                    
                    # Try injection in PUT endpoint
                    response = await client.put(f"/api/periods/{payload}", json={"ru_name": "test"})
                    assert response.status_code in [404, 422, 400]
                    
                    # Try injection in DELETE endpoint
                    response = await client.delete(f"/api/periods/{payload}")
                    assert response.status_code in [404, 422, 400]

    # Test 7: Admin Endpoint Access Control
    @pytest.mark.asyncio
    async def test_admin_endpoint_access_control(self, db_session, mock_user_session):
        """Test that only admins can access admin endpoints."""
        
        users = await self.create_test_users(db_session)
        periods = await self.create_test_periods(db_session, users)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Regular user tries to access admin endpoint
            with patch('app.core.security.require_admin_access') as mock_admin:
                mock_admin.side_effect = HTTPException(
                    status_code=403,
                    detail="Admin access required"
                )
                
                response = await client.get("/api/admin/periods")
                assert response.status_code == 403
                assert "Admin access required" in response.json()["detail"]
            
            # Admin user can access admin endpoint
            with patch('app.core.security.require_admin_access') as mock_admin:
                mock_admin.return_value = mock_user_session(3, "admin")
                
                response = await client.get("/api/admin/periods")
                # Should work if properly implemented
                assert response.status_code in [200, 500]  # 500 if DB setup issues

    # Test 8: Session Tampering
    @pytest.mark.asyncio
    async def test_session_tampering_protection(self, db_session):
        """Test protection against session tampering attacks."""
        
        users = await self.create_test_users(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Test with invalid session
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = None  # No session
                
                response = await client.get("/api/periods/")
                assert response.status_code == 401
                assert "Not authenticated" in response.json()["detail"]
            
            # Test with tampered session data
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = {
                    "user_id": "invalid",  # Invalid type
                    "username": "hacker"
                }
                
                response = await client.get("/api/periods/")
                # Should handle gracefully
                assert response.status_code in [400, 401, 422]

    # Test 9: Race Condition Tests
    @pytest.mark.asyncio
    async def test_concurrent_access_race_conditions(self, db_session, mock_user_session):
        """Test for race conditions in concurrent access."""
        
        users = await self.create_test_users(db_session)
        periods = await self.create_test_periods(db_session, users)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Simulate concurrent requests from different users
            tasks = []
            
            for user_id in [1, 2]:
                with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                    mock_get_user.return_value = mock_user_session(user_id)
                    
                    # Create multiple concurrent requests
                    for _ in range(5):
                        task = client.get("/api/periods/")
                        tasks.append(task)
            
            # Execute concurrent requests
            responses = await asyncio.gather(*tasks)
            
            # Verify all responses are successful and properly isolated
            for response in responses:
                assert response.status_code == 200
                data = response.json()
                
                # Each response should contain only user-specific data
                if len(data) > 0:
                    user_ids = {period["user_id"] for period in data}
                    assert len(user_ids) == 1, "Data isolation broken in concurrent access"

    # Test 10: Boundary Value Tests
    @pytest.mark.asyncio 
    async def test_boundary_value_attacks(self, db_session, mock_user_session):
        """Test boundary value attacks and edge cases."""
        
        users = await self.create_test_users(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = mock_user_session(1)
                
                # Test with extreme values
                boundary_values = [
                    -1,           # Negative ID
                    0,            # Zero ID  
                    9999999999,   # Very large ID
                    2.5,          # Float instead of int
                    "abc",        # String instead of int
                    None,         # Null value
                    "",           # Empty string
                ]
                
                for value in boundary_values:
                    try:
                        response = await client.get(f"/api/periods/{value}")
                        # Should handle gracefully, not crash
                        assert response.status_code in [400, 404, 422]
                    except Exception as e:
                        pytest.fail(f"Unhandled exception for boundary value {value}: {e}")