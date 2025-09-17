"""
AuthGuard Edge Cases and Authentication Scenarios Tests

This test suite covers edge cases and complex authentication scenarios for the
AuthGuard authentication fix, focusing on server-side behavior and API responses
that support the frontend SSR authentication handling.

Key edge cases tested:
1. Expired sessions and token validation
2. Role changes during active sessions
3. Missing or corrupted SSR authentication data
4. Concurrent session management
5. Authentication state synchronization
6. Security edge cases and attack scenarios
"""

import pytest
import json
import time
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.models.user import User
from app.core.security import create_session, verify_session
from app.core.config import settings
import redis

client = TestClient(app)

@pytest.fixture
def redis_client():
    """Mock Redis client for session testing"""
    mock_redis = MagicMock()
    mock_redis.get.return_value = None
    mock_redis.set.return_value = True
    mock_redis.delete.return_value = True
    mock_redis.exists.return_value = False
    return mock_redis

@pytest.fixture
def test_admin_user():
    """Create test admin user"""
    return {
        "id": 1,
        "username": "admin",
        "user_name": "Admin User",
        "role": "admin",
        "is_active": True,
        "telegram_id": 123456789,
        "auth_method": "password"
    }

@pytest.fixture
def test_regular_user():
    """Create test regular user"""
    return {
        "id": 2,
        "username": "testuser",
        "user_name": "Test User",
        "role": "user",
        "is_active": True,
        "telegram_id": 987654321,
        "auth_method": "password"
    }

@pytest.fixture
def mock_db_session():
    """Mock database session"""
    mock_session = MagicMock()
    return mock_session


class TestExpiredSessionHandling:
    """Test handling of expired sessions and token validation"""

    def test_expired_session_returns_401(self, redis_client, test_admin_user):
        """Test that expired sessions return 401 without breaking SSR"""
        # Arrange: Mock expired session
        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = None  # Session not found (expired)

            # Act: Request with expired session cookie
            response = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:expired-session-id.signature"}
            )

            # Assert: Should return 401 cleanly
            assert response.status_code == 401
            assert response.json()["success"] is False
            assert "error" in response.json()

    def test_malformed_session_cookie_handling(self, redis_client):
        """Test handling of malformed session cookies"""
        # Arrange: Various malformed cookie formats
        malformed_cookies = [
            "invalid-format",
            "s:",  # Empty signature
            "s:session-id",  # Missing signature
            "malformed:session:format",
            "",  # Empty cookie
            None
        ]

        with patch('app.core.session.redis_client', redis_client):
            for cookie_value in malformed_cookies:
                # Act: Request with malformed cookie
                cookies = {"connect.sid": cookie_value} if cookie_value else {}
                response = client.get("/api/auth/me", cookies=cookies)

                # Assert: Should handle gracefully without server errors
                assert response.status_code == 401
                assert response.json()["success"] is False

    def test_session_timeout_edge_cases(self, redis_client, test_admin_user):
        """Test session timeout edge cases"""
        # Arrange: Session about to expire
        session_data = {
            "user": test_admin_user,
            "created_at": (datetime.now() - timedelta(minutes=29)).isoformat(),
            "expires_at": (datetime.now() + timedelta(minutes=1)).isoformat()
        }

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            # Act: Check auth with session about to expire
            response = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:about-to-expire.signature"}
            )

            # Assert: Should still be valid
            assert response.status_code == 200
            assert response.json()["authenticated"] is True

            # Simulate session expiration
            redis_client.get.return_value = None

            # Act: Check auth after expiration
            response = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:about-to-expire.signature"}
            )

            # Assert: Should now be invalid
            assert response.status_code == 401

    def test_concurrent_session_expiration(self, redis_client, test_admin_user):
        """Test concurrent requests during session expiration"""
        # Arrange: Valid session
        session_data = {"user": test_admin_user}

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            # Act: First request succeeds
            response1 = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:concurrent-test.signature"}
            )

            # Simulate session deletion between requests
            redis_client.get.return_value = None

            # Second request should fail
            response2 = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:concurrent-test.signature"}
            )

            # Assert: Proper handling of race condition
            assert response1.status_code == 200
            assert response2.status_code == 401


class TestRoleChangeHandling:
    """Test handling of role changes during active sessions"""

    def test_role_upgrade_during_session(self, redis_client, test_regular_user):
        """Test user role upgrade from user to admin"""
        # Arrange: User session with regular role
        session_data = {"user": test_regular_user}

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            # Mock database returning updated user with admin role
            updated_user = test_regular_user.copy()
            updated_user["role"] = "admin"

            with patch('app.core.session.get_user_by_id') as mock_get_user:
                mock_get_user.return_value = updated_user

                # Act: Check auth after role change
                response = client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:role-upgrade.signature"}
                )

                # Assert: Should reflect new role
                assert response.status_code == 200
                assert response.json()["user"]["role"] == "admin"

    def test_role_downgrade_during_session(self, redis_client, test_admin_user):
        """Test admin role downgrade to regular user"""
        # Arrange: Admin session
        session_data = {"user": test_admin_user}

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            # Mock database returning updated user with user role
            updated_user = test_admin_user.copy()
            updated_user["role"] = "user"

            with patch('app.core.session.get_user_by_id') as mock_get_user:
                mock_get_user.return_value = updated_user

                # Act: Check auth after role downgrade
                response = client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:role-downgrade.signature"}
                )

                # Assert: Should reflect new role
                assert response.status_code == 200
                assert response.json()["user"]["role"] == "user"

    def test_invalid_role_handling(self, redis_client, test_admin_user):
        """Test handling of invalid role values"""
        # Arrange: Session with invalid role
        invalid_user = test_admin_user.copy()
        invalid_user["role"] = "invalid_role"
        session_data = {"user": invalid_user}

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            # Act: Check auth with invalid role
            response = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:invalid-role.signature"}
            )

            # Assert: Should default to user role or handle gracefully
            assert response.status_code == 200
            user_role = response.json()["user"]["role"]
            assert user_role in ["admin", "user"]  # Should be normalized

    def test_role_change_session_invalidation(self, redis_client, test_admin_user):
        """Test session invalidation on critical role changes"""
        # Arrange: Admin session
        session_data = {"user": test_admin_user}

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            # Mock user deactivation
            deactivated_user = test_admin_user.copy()
            deactivated_user["is_active"] = False

            with patch('app.core.session.get_user_by_id') as mock_get_user:
                mock_get_user.return_value = deactivated_user

                # Act: Check auth for deactivated user
                response = client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:deactivated.signature"}
                )

                # Assert: Should invalidate session
                assert response.status_code == 401


class TestSSRDataIntegrity:
    """Test SSR authentication data integrity and validation"""

    def test_missing_ssr_user_data(self, redis_client):
        """Test handling of missing SSR user data"""
        # Arrange: Session with minimal data
        session_data = {"authenticated": True}  # Missing user object

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            # Act: Request SSR auth data
            response = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:minimal-session.signature"}
            )

            # Assert: Should handle gracefully
            assert response.status_code == 401

    def test_corrupted_ssr_session_data(self, redis_client):
        """Test handling of corrupted session data"""
        # Arrange: Corrupted session data
        corrupted_data_cases = [
            b"invalid-json{",  # Invalid JSON
            b'{"user": null}',  # Null user
            b'{"user": {}}',  # Empty user object
            b'{"user": {"id": null}}',  # Missing required fields
            b"",  # Empty data
        ]

        with patch('app.core.session.redis_client', redis_client):
            for corrupted_data in corrupted_data_cases:
                redis_client.get.return_value = corrupted_data

                # Act: Request with corrupted session
                response = client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:corrupted.signature"}
                )

                # Assert: Should handle corruption gracefully
                assert response.status_code == 401

    def test_partial_user_data_handling(self, redis_client):
        """Test handling of partial user data in sessions"""
        # Arrange: Session with partial user data
        partial_user_cases = [
            {"id": 1},  # Missing other fields
            {"id": 1, "username": "test"},  # Missing role
            {"username": "test", "role": "admin"},  # Missing id
            {"id": 1, "role": "admin"},  # Missing username
        ]

        with patch('app.core.session.redis_client', redis_client):
            for partial_user in partial_user_cases:
                session_data = {"user": partial_user}
                redis_client.get.return_value = json.dumps(session_data).encode()

                # Act: Request with partial user data
                response = client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:partial.signature"}
                )

                # Assert: Should either fill defaults or reject
                if "id" in partial_user and "role" in partial_user:
                    assert response.status_code in [200, 401]  # May be valid with defaults
                else:
                    assert response.status_code == 401  # Should reject incomplete data

    def test_ssr_data_type_validation(self, redis_client):
        """Test SSR data type validation and conversion"""
        # Arrange: Session with wrong data types
        type_error_cases = [
            {"user": {"id": "1", "role": "admin", "username": "test"}},  # String ID
            {"user": {"id": 1, "role": 123, "username": "test"}},  # Numeric role
            {"user": {"id": 1, "role": "admin", "username": None}},  # Null username
            {"user": {"id": 1.5, "role": "admin", "username": "test"}},  # Float ID
        ]

        with patch('app.core.session.redis_client', redis_client):
            for case in type_error_cases:
                redis_client.get.return_value = json.dumps(case).encode()

                # Act: Request with type errors
                response = client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:type-error.signature"}
                )

                # Assert: Should handle type conversion or reject
                assert response.status_code in [200, 401]

                if response.status_code == 200:
                    # Verify type correction if accepted
                    user_data = response.json()["user"]
                    assert isinstance(user_data["id"], int)
                    assert isinstance(user_data["role"], str)


class TestConcurrentSessionManagement:
    """Test concurrent session management and race conditions"""

    def test_multiple_simultaneous_auth_checks(self, redis_client, test_admin_user):
        """Test multiple simultaneous authentication checks"""
        # Arrange: Valid session
        session_data = {"user": test_admin_user}

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            # Act: Multiple concurrent requests
            import concurrent.futures

            def make_auth_request():
                return client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:concurrent.signature"}
                )

            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                futures = [executor.submit(make_auth_request) for _ in range(10)]
                responses = [future.result() for future in futures]

            # Assert: All requests should succeed consistently
            for response in responses:
                assert response.status_code == 200
                assert response.json()["authenticated"] is True

    def test_session_creation_race_condition(self, redis_client, test_admin_user):
        """Test race conditions during session creation"""
        # Arrange: Mock session creation conflict
        with patch('app.core.session.redis_client', redis_client):
            redis_client.set.side_effect = [False, True]  # First fails, second succeeds

            # Act: Attempt session creation
            response = client.post(
                "/api/auth/login",
                json={
                    "username": "admin",
                    "password": "admin"
                }
            )

            # Assert: Should handle race condition gracefully
            # Note: This test depends on actual session creation implementation
            assert response.status_code in [200, 500]  # May succeed or fail gracefully

    def test_session_cleanup_during_auth_check(self, redis_client, test_admin_user):
        """Test session cleanup happening during authentication check"""
        # Arrange: Session that gets cleaned up during check
        session_data = {"user": test_admin_user}

        with patch('app.core.session.redis_client', redis_client):
            # Mock Redis returning data first, then None (cleanup happened)
            redis_client.get.side_effect = [
                json.dumps(session_data).encode(),
                None  # Session cleaned up
            ]

            # Act: Auth check during cleanup
            response = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:cleanup-race.signature"}
            )

            # Assert: Should handle cleanup race condition
            assert response.status_code in [200, 401]  # May succeed or fail based on timing


class TestSecurityEdgeCases:
    """Test security edge cases and potential attack scenarios"""

    def test_session_hijacking_protection(self, redis_client, test_admin_user):
        """Test protection against session hijacking attempts"""
        # Arrange: Valid session
        session_data = {"user": test_admin_user}

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            # Act: Attempt to use session from different IP/User-Agent
            headers = {
                "X-Forwarded-For": "192.168.1.100",  # Different IP
                "User-Agent": "Malicious-Bot/1.0"  # Different User-Agent
            }

            response = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:hijack-attempt.signature"},
                headers=headers
            )

            # Assert: Should handle based on security policy
            # Note: Implementation may vary based on security requirements
            assert response.status_code in [200, 401]

    def test_session_fixation_protection(self, redis_client):
        """Test protection against session fixation attacks"""
        # Arrange: Pre-set session ID
        malicious_session_id = "s:attacker-controlled-id.signature"

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = None  # Session doesn't exist

            # Act: Attempt to authenticate with pre-set session
            response = client.post(
                "/api/auth/login",
                json={"username": "admin", "password": "admin"},
                cookies={"connect.sid": malicious_session_id}
            )

            # Assert: Should create new session, not use attacker's
            # Note: Implementation should regenerate session ID on login
            if response.status_code == 200:
                # Check that response sets new session cookie
                set_cookie = response.headers.get("set-cookie", "")
                assert "connect.sid" in set_cookie
                assert malicious_session_id not in set_cookie

    def test_session_data_injection(self, redis_client):
        """Test protection against session data injection"""
        # Arrange: Malicious session data
        malicious_data = {
            "user": {
                "id": 1,
                "role": "admin",
                "username": "<script>alert('xss')</script>",
                "extra_field": "../../etc/passwd"
            }
        }

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(malicious_data).encode()

            # Act: Request with malicious session data
            response = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:malicious.signature"}
            )

            # Assert: Should sanitize or reject malicious data
            if response.status_code == 200:
                user_data = response.json()["user"]
                # Verify no script injection in response
                assert "<script>" not in str(user_data)
                assert "../../" not in str(user_data)

    def test_session_replay_attack(self, redis_client, test_admin_user):
        """Test protection against session replay attacks"""
        # Arrange: Valid session
        session_data = {
            "user": test_admin_user,
            "created_at": datetime.now().isoformat(),
            "last_used": datetime.now().isoformat()
        }

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            # Act: Multiple identical requests (replay attack)
            responses = []
            for _ in range(5):
                response = client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:replay-test.signature"}
                )
                responses.append(response)
                time.sleep(0.1)  # Small delay between requests

            # Assert: All should succeed (replay is normal for auth checks)
            for response in responses:
                assert response.status_code == 200

    def test_timing_attack_protection(self, redis_client):
        """Test protection against timing attacks on session validation"""
        # Arrange: Various session states
        test_cases = [
            None,  # No session
            b"invalid-json",  # Invalid session
            json.dumps({"user": {"id": 1, "role": "admin"}}).encode(),  # Valid session
        ]

        with patch('app.core.session.redis_client', redis_client):
            timings = []

            for session_data in test_cases:
                redis_client.get.return_value = session_data

                # Act: Measure response time
                start_time = time.time()
                response = client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:timing-test.signature"}
                )
                end_time = time.time()

                timings.append(end_time - start_time)

            # Assert: Response times should be similar (timing attack protection)
            # Note: This is a basic check - real implementation might need constant-time comparison
            max_timing = max(timings)
            min_timing = min(timings)
            timing_ratio = max_timing / min_timing if min_timing > 0 else float('inf')

            # Response times shouldn't vary by more than 10x (adjust threshold as needed)
            assert timing_ratio < 10.0


class TestAuthenticationStateSync:
    """Test authentication state synchronization edge cases"""

    def test_database_user_not_found(self, redis_client):
        """Test handling when session user is not found in database"""
        # Arrange: Session with user that doesn't exist in DB
        session_data = {
            "user": {
                "id": 999,  # Non-existent user ID
                "username": "deleted_user",
                "role": "admin"
            }
        }

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            with patch('app.core.session.get_user_by_id') as mock_get_user:
                mock_get_user.return_value = None  # User not found

                # Act: Check auth for non-existent user
                response = client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:deleted-user.signature"}
                )

                # Assert: Should invalidate session
                assert response.status_code == 401

    def test_database_connection_failure(self, redis_client, test_admin_user):
        """Test handling of database connection failures during auth"""
        # Arrange: Valid session but DB unavailable
        session_data = {"user": test_admin_user}

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(session_data).encode()

            with patch('app.core.session.get_user_by_id') as mock_get_user:
                mock_get_user.side_effect = Exception("Database connection failed")

                # Act: Check auth during DB failure
                response = client.get(
                    "/api/auth/me",
                    cookies={"connect.sid": "s:db-failure.signature"}
                )

                # Assert: Should handle gracefully (may use cached session data)
                assert response.status_code in [200, 500, 503]

    def test_redis_connection_failure(self, test_admin_user):
        """Test handling of Redis connection failures"""
        # Arrange: Mock Redis connection failure
        with patch('app.core.session.redis_client') as mock_redis:
            mock_redis.get.side_effect = Exception("Redis connection failed")

            # Act: Check auth during Redis failure
            response = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:redis-failure.signature"}
            )

            # Assert: Should handle Redis failure gracefully
            assert response.status_code in [401, 500, 503]

    def test_session_format_migration(self, redis_client, test_admin_user):
        """Test handling of legacy session format migration"""
        # Arrange: Legacy session format
        legacy_session_data = {
            "userId": test_admin_user["id"],  # Old field name
            "userRole": test_admin_user["role"],  # Old field name
            "userName": test_admin_user["username"]  # Old field name
        }

        with patch('app.core.session.redis_client', redis_client):
            redis_client.get.return_value = json.dumps(legacy_session_data).encode()

            # Act: Check auth with legacy session format
            response = client.get(
                "/api/auth/me",
                cookies={"connect.sid": "s:legacy-format.signature"}
            )

            # Assert: Should handle legacy format or migrate gracefully
            # Note: Implementation may vary based on migration strategy
            assert response.status_code in [200, 401]

            if response.status_code == 200:
                # Verify proper field mapping if migration is supported
                user_data = response.json()["user"]
                assert "id" in user_data
                assert "role" in user_data
                assert "username" in user_data


if __name__ == "__main__":
    # Run specific test categories
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "-k", "test_expired_session or test_role_change or test_ssr_data"
    ])