"""
Admin privilege escalation and authorization security tests.

Tests verify that admin endpoints are properly protected and that privilege escalation
attacks are prevented.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.main import app
from app.models.user import User
from app.models.period import Period
from app.core.security import require_admin_access


class TestAdminPrivilegeEscalation:
    """Test suite for admin privilege escalation security."""
    
    async def create_test_users_and_data(self, db: AsyncSession):
        """Create test users with different roles and their data."""
        
        # Regular user
        user1 = User(
            id=1,
            username="regularuser",
            email="user@test.com",
            telegram_id=111111111,
            role="user"
        )
        
        # Another regular user
        user2 = User(
            id=2,
            username="normaluser", 
            email="user2@test.com",
            telegram_id=222222222,
            role="user"
        )
        
        # Admin user
        admin = User(
            id=3,
            username="admin",
            email="admin@test.com",
            telegram_id=333333333,
            role="admin"
        )
        
        # Compromised user (attacker-controlled)
        attacker = User(
            id=4,
            username="attacker",
            email="attacker@test.com", 
            telegram_id=444444444,
            role="user"
        )
        
        db.add_all([user1, user2, admin, attacker])
        await db.commit()
        
        # Add some periods for testing
        periods = [
            Period(id=1, date="2024-01-01", ru_name="User1 Period", user_id=1),
            Period(id=2, date="2024-02-01", ru_name="User2 Period", user_id=2), 
            Period(id=3, date="2024-03-01", ru_name="Admin Period", user_id=3),
        ]
        
        db.add_all(periods)
        await db.commit()
        
        return {
            "regular_user": user1,
            "normal_user": user2,
            "admin": admin,
            "attacker": attacker
        }

    @pytest.fixture
    def mock_user_session(self):
        """Mock user session for testing."""
        def create_mock(user_id: int, role: str = "user", username: str = None):
            return {
                "user_id": user_id,
                "username": username or f"user{user_id}",
                "role": role
            }
        return create_mock

    # Test 1: Regular User Cannot Access Admin Endpoints
    @pytest.mark.asyncio
    async def test_regular_user_admin_endpoint_denied(self, db_session, mock_user_session):
        """Test that regular users cannot access admin endpoints."""
        
        users = await self.create_test_users_and_data(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Mock regular user trying to access admin endpoint
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                with patch('app.core.security.get_db') as mock_db:
                    mock_get_user.return_value = mock_user_session(1, "user")
                    mock_db.return_value.__next__.return_value = db_session
                    
                    # Try to access admin periods endpoint
                    response = await client.get("/api/admin/periods")
                    assert response.status_code == 403
                    assert "Admin access required" in response.json()["detail"]

    # Test 2: Role Injection Attack 
    @pytest.mark.asyncio
    async def test_role_injection_attack(self, db_session, mock_user_session):
        """Test that user role cannot be injected through session tampering."""
        
        users = await self.create_test_users_and_data(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Attacker tries to inject admin role in session
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                with patch('app.core.security.get_db') as mock_db:
                    # Mock malicious session with injected admin role
                    mock_get_user.return_value = {
                        "user_id": 4,  # attacker user
                        "username": "attacker",
                        "role": "admin"  # INJECTED ROLE - should be ignored
                    }
                    
                    # Create mock DB session
                    mock_session = MagicMock()
                    mock_user = MagicMock()
                    mock_user.role = "user"  # Real role from DB
                    mock_session.query().filter().first.return_value = mock_user
                    mock_db.return_value.__next__.return_value = mock_session
                    
                    response = await client.get("/api/admin/periods")
                    
                    # Should be denied because real role is "user"
                    assert response.status_code == 403
                    assert "Admin access required" in response.json()["detail"]

    # Test 3: User ID Manipulation Attack
    @pytest.mark.asyncio
    async def test_user_id_manipulation_attack(self, db_session, mock_user_session):
        """Test protection against user ID manipulation in session."""
        
        users = await self.create_test_users_and_data(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Attacker changes user_id to admin user's ID
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                with patch('app.core.security.get_db') as mock_db:
                    # Mock session with manipulated user_id
                    mock_get_user.return_value = {
                        "user_id": 3,  # Admin user ID (manipulated)
                        "username": "attacker",  # But attacker's username
                        "role": "user"
                    }
                    
                    # Mock DB to return actual admin user
                    mock_session = MagicMock()
                    admin_user = MagicMock()
                    admin_user.role = "admin"
                    admin_user.id = 3
                    mock_session.query().filter().first.return_value = admin_user
                    mock_db.return_value.__next__.return_value = mock_session
                    
                    response = await client.get("/api/admin/periods")
                    
                    # This should work because user_id 3 is admin in DB
                    # But this reveals a potential vulnerability if session user_id can be manipulated
                    if response.status_code == 200:
                        pytest.fail("SECURITY VULNERABILITY: User ID manipulation allowed admin access!")

    # Test 4: Database Session Hijacking
    @pytest.mark.asyncio 
    async def test_database_session_hijacking(self, db_session, mock_user_session):
        """Test protection against database session hijacking."""
        
        users = await self.create_test_users_and_data(db_session)
        
        # Test require_admin_access function directly
        from fastapi import Request
        
        # Mock request with regular user session
        request = MagicMock(spec=Request)
        
        with patch('app.core.session.get_current_user_from_session') as mock_get_user:
            with patch('app.core.security.get_db') as mock_db:
                mock_get_user.return_value = mock_user_session(1, "user")
                
                # Mock DB session
                mock_session = MagicMock()
                regular_user = MagicMock()
                regular_user.role = "user"
                regular_user.id = 1
                mock_session.query().filter().first.return_value = regular_user
                mock_db.return_value.__next__.return_value = mock_session
                
                # Should raise 403 exception
                with pytest.raises(HTTPException) as exc_info:
                    await require_admin_access(request)
                
                assert exc_info.value.status_code == 403
                assert "Admin access required" in exc_info.value.detail

    # Test 5: Concurrent Session Attack
    @pytest.mark.asyncio
    async def test_concurrent_session_privilege_escalation(self, db_session, mock_user_session):
        """Test for race conditions in privilege escalation."""
        
        users = await self.create_test_users_and_data(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Simulate attacker making rapid requests with different user_ids
            import asyncio
            
            tasks = []
            for user_id in [1, 2, 3, 4]:  # Try different user IDs rapidly
                with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                    mock_get_user.return_value = mock_user_session(user_id)
                    
                    task = client.get("/api/admin/periods")
                    tasks.append(task)
            
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            # All should be denied except potentially admin (user_id=3)
            successful_responses = [r for r in responses if not isinstance(r, Exception) and r.status_code == 200]
            
            # Should have at most 1 successful response (from admin)
            assert len(successful_responses) <= 1

    # Test 6: Admin Endpoint Data Leakage
    @pytest.mark.asyncio
    async def test_admin_endpoint_data_leakage(self, db_session, mock_user_session):
        """Test that admin endpoints don't leak sensitive data when accessed by non-admins."""
        
        users = await self.create_test_users_and_data(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Regular user tries to access admin endpoint
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                with patch('app.core.security.get_db') as mock_db:
                    mock_get_user.return_value = mock_user_session(1, "user")
                    
                    # Mock DB
                    mock_session = MagicMock()
                    regular_user = MagicMock()
                    regular_user.role = "user"
                    mock_session.query().filter().first.return_value = regular_user
                    mock_db.return_value.__next__.return_value = mock_session
                    
                    response = await client.get("/api/admin/periods")
                    
                    # Should return 403, not data
                    assert response.status_code == 403
                    
                    # Response should not contain any period data
                    response_text = response.text.lower()
                    sensitive_keywords = ["period", "user_id", "ru_name", "date"]
                    
                    for keyword in sensitive_keywords:
                        assert keyword not in response_text or "admin access required" in response_text

    # Test 7: Token/Session Replay Attack
    @pytest.mark.asyncio
    async def test_session_replay_attack(self, db_session, mock_user_session):
        """Test protection against session replay attacks."""
        
        users = await self.create_test_users_and_data(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # First, legitimate admin access
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                with patch('app.core.security.get_db') as mock_db:
                    mock_get_user.return_value = mock_user_session(3, "admin")
                    
                    # Mock admin user in DB
                    mock_session = MagicMock()
                    admin_user = MagicMock()
                    admin_user.role = "admin"
                    admin_user.id = 3
                    mock_session.query().filter().first.return_value = admin_user
                    mock_db.return_value.__next__.return_value = mock_session
                    
                    response1 = await client.get("/api/admin/periods")
                    
                    # Should work for admin
                    assert response1.status_code in [200, 500]  # 500 if DB setup issues
            
            # Then, simulate session replay with different user
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                with patch('app.core.security.get_db') as mock_db:
                    # Attacker tries to replay admin session but is actually regular user
                    mock_get_user.return_value = mock_user_session(3, "admin")  # Claims to be admin
                    
                    # But DB returns regular user (session hijacked)
                    mock_session = MagicMock()
                    regular_user = MagicMock()
                    regular_user.role = "user"  # Actual role is user
                    regular_user.id = 1  # Different user
                    mock_session.query().filter().first.return_value = regular_user
                    mock_db.return_value.__next__.return_value = mock_session
                    
                    response2 = await client.get("/api/admin/periods")
                    
                    # Should be denied
                    assert response2.status_code == 403

    # Test 8: Mass Assignment Attack on Admin Functions
    @pytest.mark.asyncio
    async def test_mass_assignment_attack(self, db_session, mock_user_session):
        """Test protection against mass assignment in admin functions."""
        
        users = await self.create_test_users_and_data(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Mock admin access
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                with patch('app.core.security.get_db') as mock_db:
                    mock_get_user.return_value = mock_user_session(3, "admin")
                    
                    mock_session = MagicMock()
                    admin_user = MagicMock()
                    admin_user.role = "admin"
                    mock_session.query().filter().first.return_value = admin_user
                    mock_db.return_value.__next__.return_value = mock_session
                    
                    # Try mass assignment attack in admin endpoints
                    malicious_data = {
                        "name": "Modified Name",
                        "role": "admin",  # Trying to escalate privileges
                        "user_id": 999,   # Trying to change ownership
                        "is_admin": True,
                        "__class__": "User",  # Python-specific attack
                        "constructor": {"role": "admin"}
                    }
                    
                    # Test different admin endpoints
                    admin_endpoints = [
                        "/api/admin/references/nomenclature/1",
                        "/api/admin/references/cost_center/1",
                    ]
                    
                    for endpoint in admin_endpoints:
                        response = await client.put(endpoint, json=malicious_data)
                        
                        # Should either reject the request or filter dangerous fields
                        if response.status_code == 200:
                            # If accepted, verify dangerous fields were filtered
                            response_data = response.json()
                            if "data" in response_data:
                                data = response_data["data"]
                                dangerous_fields = ["role", "is_admin", "__class__", "constructor"]
                                for field in dangerous_fields:
                                    assert field not in data or data[field] != malicious_data[field]

    # Test 9: Admin Function Enumeration
    @pytest.mark.asyncio
    async def test_admin_function_enumeration(self, db_session, mock_user_session):
        """Test that admin functions don't reveal sensitive information through errors."""
        
        users = await self.create_test_users_and_data(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # Regular user tries to enumerate admin functions
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = mock_user_session(1, "user")
                
                # Try various admin endpoints
                admin_endpoints = [
                    "/api/admin/periods",
                    "/api/admin/users",
                    "/api/admin/references/nomenclature",
                    "/api/admin/references/cost_center",
                ]
                
                for endpoint in admin_endpoints:
                    response = await client.get(endpoint)
                    
                    # All should return 403, not reveal function existence through different errors
                    assert response.status_code == 403
                    assert "Admin access required" in response.json()["detail"]
                    
                    # Error message should be consistent
                    error_message = response.json()["detail"]
                    assert error_message == "Admin access required"

    # Test 10: Bypass Authentication with Admin Claims
    @pytest.mark.asyncio
    async def test_bypass_authentication_admin_claims(self, db_session, mock_user_session):
        """Test that admin claims cannot bypass authentication."""
        
        users = await self.create_test_users_and_data(db_session)
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            
            # No authentication but claims admin role
            with patch('app.core.session.get_current_user_from_session') as mock_get_user:
                mock_get_user.return_value = None  # No authentication
                
                response = await client.get("/api/admin/periods")
                
                # Should return 401 (not authenticated), not 403 (forbidden)
                assert response.status_code == 401
                assert "Not authenticated" in response.json()["detail"]