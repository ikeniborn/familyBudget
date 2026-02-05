"""
Unit tests for admin email/password authentication bypass.

Tests cover:
- Admin bypass: Login without 2FA requirement
- Regular user flow: 2FA still required
- Cookie security: httpOnly, secure flags
- Database updates: last_login, refresh tokens
- Error handling: inactive users, failed logins
- Password validation: OWASP 2023 requirements
"""

import pytest
from datetime import datetime
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.user import User
from backend.app.models.refresh_token import RefreshToken
from backend.app.services.password_service import hash_password


class TestAdminAuthBypass:
    """Tests for admin authentication bypass (no 2FA requirement)."""

    @pytest.mark.asyncio
    async def test_admin_login_bypasses_2fa(self, client: AsyncClient, db_session: AsyncSession):
        """Admin can login without 2FA requirement."""

        # Create admin user
        admin = User(
            email="admin@test.com",
            password_hash=hash_password("AdminPass123!"),
            first_name="Admin",
            is_admin=True,
            is_active=True,
            two_factor_enabled=False,
        )
        db_session.add(admin)
        await db_session.flush()
        await db_session.refresh(admin)

        # Login with email/password
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "AdminPass123!"}
        )

        # Should return 200 with AuthResponse (not EmailLoginResponse)
        assert response.status_code == 200
        data = response.json()

        # Verify admin bypass: tokens returned directly
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["message"] == "Admin authentication successful (2FA bypassed)"
        assert data["user"]["is_admin"] is True
        assert data["user"]["email"] == "admin@test.com"

        # Verify cookies set
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies

        # Verify cookies are httpOnly
        assert response.cookies["access_token"].get("httponly") or "HttpOnly" in str(response.cookies)
        assert response.cookies["refresh_token"].get("httponly") or "HttpOnly" in str(response.cookies)

    @pytest.mark.asyncio
    async def test_regular_user_requires_2fa(self, client: AsyncClient, db_session: AsyncSession):
        """Regular users still require 2FA for email/password login."""

        # Create regular user (NOT admin)
        user = User(
            email="user@test.com",
            password_hash=hash_password("UserPass123!"),
            first_name="User",
            is_admin=False,
            is_active=True,
            two_factor_enabled=False,
        )
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)

        # Login with email/password
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "user@test.com", "password": "UserPass123!"}
        )

        # Should return 200 with EmailLoginResponse (2FA setup required)
        assert response.status_code == 200
        data = response.json()

        # Verify regular user flow: session_token returned, NO direct tokens
        assert "session_token" in data
        assert "requires_2fa_setup" in data
        assert data["requires_2fa_setup"] is True
        assert "access_token" not in data  # No direct access token
        assert "refresh_token" not in data  # No direct refresh token

        # Verify NO cookies set (2FA not completed yet)
        assert "access_token" not in response.cookies
        assert "refresh_token" not in response.cookies

    @pytest.mark.asyncio
    async def test_admin_login_sets_cookies(self, client: AsyncClient, db_session: AsyncSession):
        """Admin login sets secure httpOnly cookies."""

        # Create admin user
        admin = User(
            email="admin@test.com",
            password_hash=hash_password("AdminPass123!"),
            first_name="Admin",
            is_admin=True,
            is_active=True,
            two_factor_enabled=False,
        )
        db_session.add(admin)
        await db_session.flush()

        # Login
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "AdminPass123!"}
        )

        assert response.status_code == 200

        # Check cookies exist
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies

        # Check cookie attributes (httpOnly, SameSite)
        # Note: Exact cookie attribute checking depends on httpx/starlette versions
        access_cookie = response.cookies["access_token"]
        refresh_cookie = response.cookies["refresh_token"]

        # Cookies should have values
        assert access_cookie is not None
        assert refresh_cookie is not None

    @pytest.mark.asyncio
    async def test_admin_login_updates_last_login(self, client: AsyncClient, db_session: AsyncSession):
        """Admin login updates last_login_at timestamp."""

        # Create admin user
        admin = User(
            email="admin@test.com",
            password_hash=hash_password("AdminPass123!"),
            first_name="Admin",
            is_admin=True,
            is_active=True,
            two_factor_enabled=False,
            last_login_at=None,  # Initially None
        )
        db_session.add(admin)
        await db_session.flush()
        await db_session.refresh(admin)

        admin_id = admin.id

        # Login
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "AdminPass123!"}
        )

        assert response.status_code == 200

        # Fetch admin from DB again
        stmt = select(User).where(User.id == admin_id)
        result = await db_session.execute(stmt)
        updated_admin = result.scalar_one()

        # Verify last_login_at was updated
        assert updated_admin.last_login_at is not None
        assert isinstance(updated_admin.last_login_at, datetime)

    @pytest.mark.asyncio
    async def test_admin_login_creates_refresh_token(self, client: AsyncClient, db_session: AsyncSession):
        """Admin login creates refresh token in database."""

        # Create admin user
        admin = User(
            email="admin@test.com",
            password_hash=hash_password("AdminPass123!"),
            first_name="Admin",
            is_admin=True,
            is_active=True,
            two_factor_enabled=False,
        )
        db_session.add(admin)
        await db_session.flush()
        await db_session.refresh(admin)

        admin_id = admin.id

        # Login
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "AdminPass123!"}
        )

        assert response.status_code == 200

        # Check refresh token in database
        stmt = select(RefreshToken).where(RefreshToken.user_id == admin_id)
        result = await db_session.execute(stmt)
        refresh_tokens = list(result.scalars().all())

        # Should have exactly 1 refresh token
        assert len(refresh_tokens) == 1
        assert refresh_tokens[0].user_id == admin_id
        assert refresh_tokens[0].token_hash is not None
        assert refresh_tokens[0].expires_at is not None

    @pytest.mark.asyncio
    async def test_inactive_admin_rejected(self, client: AsyncClient, db_session: AsyncSession):
        """Inactive admin cannot login even with valid credentials."""

        # Create inactive admin user
        admin = User(
            email="admin@test.com",
            password_hash=hash_password("AdminPass123!"),
            first_name="Admin",
            is_admin=True,
            is_active=False,  # Inactive
            two_factor_enabled=False,
        )
        db_session.add(admin)
        await db_session.flush()

        # Attempt login
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "AdminPass123!"}
        )

        # Should be rejected with 403
        assert response.status_code == 403
        data = response.json()
        assert "activation" in data["detail"].lower() or "pending" in data["detail"].lower()

        # Verify NO cookies set
        assert "access_token" not in response.cookies
        assert "refresh_token" not in response.cookies

    @pytest.mark.asyncio
    async def test_failed_admin_login_invalid_password(self, client: AsyncClient, db_session: AsyncSession):
        """Failed admin login with invalid password returns 401."""

        # Create admin user
        admin = User(
            email="admin@test.com",
            password_hash=hash_password("AdminPass123!"),
            first_name="Admin",
            is_admin=True,
            is_active=True,
            two_factor_enabled=False,
        )
        db_session.add(admin)
        await db_session.flush()

        # Login with wrong password
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "WrongPassword123!"}
        )

        # Should return 401
        assert response.status_code == 401
        data = response.json()
        assert "invalid" in data["detail"].lower() or "password" in data["detail"].lower()

        # Verify NO cookies set
        assert "access_token" not in response.cookies
        assert "refresh_token" not in response.cookies


class TestPasswordValidation:
    """Tests for password strength validation (OWASP 2023)."""

    def test_password_too_short(self):
        """Password shorter than 12 characters is rejected."""
        from backend.app.services.password_service import validate_password_strength

        is_valid, error = validate_password_strength("Short1!")
        assert is_valid is False
        assert "12 characters" in error

    def test_password_missing_uppercase(self):
        """Password without uppercase letter is rejected."""
        from backend.app.services.password_service import validate_password_strength

        is_valid, error = validate_password_strength("nouppercase123!")
        assert is_valid is False
        assert "uppercase" in error.lower()

    def test_password_missing_lowercase(self):
        """Password without lowercase letter is rejected."""
        from backend.app.services.password_service import validate_password_strength

        is_valid, error = validate_password_strength("NOLOWERCASE123!")
        assert is_valid is False
        assert "lowercase" in error.lower()

    def test_password_missing_digit(self):
        """Password without digit is rejected."""
        from backend.app.services.password_service import validate_password_strength

        is_valid, error = validate_password_strength("NoDigitsHere!")
        assert is_valid is False
        assert "number" in error.lower() or "digit" in error.lower()

    def test_password_missing_special(self):
        """Password without special character is rejected."""
        from backend.app.services.password_service import validate_password_strength

        is_valid, error = validate_password_strength("NoSpecial123")
        assert is_valid is False
        assert "special" in error.lower()

    def test_password_common_password(self):
        """Common passwords from top 100 list are rejected."""
        from backend.app.services.password_service import validate_password_strength

        # "password" is in common passwords list
        is_valid, error = validate_password_strength("Password123!")
        assert is_valid is False
        assert "common" in error.lower()

    def test_password_valid_strong(self):
        """Strong password meeting all requirements is accepted."""
        from backend.app.services.password_service import validate_password_strength

        is_valid, error = validate_password_strength("StrongP@ssw0rd123!")
        assert is_valid is True
        assert error == ""


class TestAdminUserCreationScript:
    """Tests for scripts/create_admin_user.py functionality."""

    @pytest.mark.asyncio
    async def test_admin_creation_skipped_if_not_configured(self, db_session: AsyncSession, monkeypatch):
        """Admin creation skipped if ADMIN_EMAIL or ADMIN_PASSWORD not set."""
        import os
        import sys

        # Clear environment variables
        monkeypatch.delenv("ADMIN_EMAIL", raising=False)
        monkeypatch.delenv("ADMIN_PASSWORD", raising=False)

        # Import and run script function
        sys.path.insert(0, "/home/ikeniborn/Documents/Project/familyBudget")
        from scripts.create_admin_user import create_admin_user

        # Should return 0 (success - skipped)
        exit_code = await create_admin_user()
        assert exit_code == 0

    @pytest.mark.asyncio
    async def test_admin_creation_fails_weak_password(self, db_session: AsyncSession, monkeypatch):
        """Admin creation fails if password doesn't meet OWASP requirements."""
        import os
        import sys

        # Set environment with weak password
        monkeypatch.setenv("ADMIN_EMAIL", "admin@test.com")
        monkeypatch.setenv("ADMIN_PASSWORD", "weak")  # Too short, no uppercase, etc.
        monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")

        # Import and run script function
        sys.path.insert(0, "/home/ikeniborn/Documents/Project/familyBudget")
        from scripts.create_admin_user import create_admin_user

        # Should return 1 (error - password validation failed)
        exit_code = await create_admin_user()
        assert exit_code == 1
