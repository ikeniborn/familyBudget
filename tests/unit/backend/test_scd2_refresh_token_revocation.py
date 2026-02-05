"""
Unit tests for SCD Type 2 and RefreshToken revocation.

Tests that when user profile data changes (triggering SCD Type 2 versioning),
all old refresh tokens are automatically revoked to prevent "zombie tokens".
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

from backend.app.services.user_service import update_user_profile
from backend.app.models.user import User
from backend.app.models.refresh_token import RefreshToken


@pytest.mark.unit
@pytest.mark.skip(reason="SCD Type 2 refresh token revocation not implemented in current update_user_profile API (changed in v11.x)")
class TestSCD2RefreshTokenRevocation:
    """Test that SCD Type 2 revokes old refresh tokens."""

    @pytest.mark.asyncio
    async def test_scd2_revokes_old_refresh_tokens(self, monkeypatch):
        """
        Test that when user profile changes (SCD Type 2), all old refresh tokens
        are automatically revoked.

        Scenario:
            1. User exists with id=1, username='olduser'
            2. User has 2 active RefreshTokens (device A and device B)
            3. User changes username to 'newuser' (SCD Type 2 triggered)
            4. New user version created with id=2
            5. Old RefreshTokens (linked to user_id=1) should be revoked
            6. This prevents "zombie tokens" that reference inactive user
        """
        # Mock database session
        mock_session = AsyncMock()

        # Mock existing user (old version)
        existing_user = User(
            id=1,
            telegram_id=123456789,
            username="olduser",
            first_name="Old",
            last_name="User",
            is_admin=False,
            is_current=True,
            valid_from=datetime(2025, 1, 1),
            valid_to=datetime(9999, 12, 31),
            created_at=datetime(2025, 1, 1),
            updated_at=datetime(2025, 1, 1),
        )

        # Mock active refresh tokens for old user
        token1 = RefreshToken(
            id=1,
            user_id=1,  # Linked to old user
            token_hash="hash1",
            expires_at=datetime.utcnow() + timedelta(days=30),
            is_revoked=False,
        )
        token2 = RefreshToken(
            id=2,
            user_id=1,  # Linked to old user
            token_hash="hash2",
            expires_at=datetime.utcnow() + timedelta(days=30),
            is_revoked=False,
        )

        # Mock get_user_by_telegram_id to return existing user
        async def mock_get_user(session, telegram_id):
            return existing_user

        monkeypatch.setattr(
            "backend.app.services.auth_service.get_user_by_telegram_id",
            mock_get_user
        )

        # Mock session.exec to return old tokens
        mock_exec_result = MagicMock()
        mock_exec_result.all.return_value = [token1, token2]
        mock_session.exec.return_value = mock_exec_result

        # Mock session.flush to assign new user id
        async def mock_flush():
            # Simulate new user getting id=2
            existing_user.id = 2

        mock_session.flush = mock_flush

        # Call update_user_profile with changed username
        result = await update_user_profile(
            session=mock_session,
            telegram_id=123456789,
            first_name="Old",
            last_name="User",
            username="newuser",  # Changed username triggers SCD Type 2
        )

        # Assertions
        # 1. New version should be created
        assert result is not None
        assert result.username == "newuser"
        assert result.is_current == True  # noqa: E712

        # 2. Old user version should be closed
        assert existing_user.is_current == False  # noqa: E712
        assert existing_user.valid_to is not None

        # 3. All old refresh tokens should be revoked
        assert token1.is_revoked == True  # noqa: E712
        assert token1.revoked_at is not None

        assert token2.is_revoked == True  # noqa: E712
        assert token2.revoked_at is not None

        # 4. Session.add should be called for revoked tokens
        # (token1, token2, existing_user, new_version)
        assert mock_session.add.call_count >= 4

    @pytest.mark.asyncio
    async def test_scd2_no_revocation_if_data_unchanged(self, monkeypatch):
        """
        Test that if user data hasn't changed, SCD Type 2 is NOT triggered
        and refresh tokens are NOT revoked.
        """
        # Mock database session
        mock_session = AsyncMock()

        # Mock existing user
        existing_user = User(
            id=1,
            telegram_id=123456789,
            username="sameuser",
            first_name="Same",
            last_name="User",
            is_admin=False,
            is_current=True,
            valid_from=datetime(2025, 1, 1),
            valid_to=datetime(9999, 12, 31),
            created_at=datetime(2025, 1, 1),
            updated_at=datetime(2025, 1, 1),
        )

        # Mock get_user_by_telegram_id
        async def mock_get_user(session, telegram_id):
            return existing_user

        monkeypatch.setattr(
            "backend.app.services.auth_service.get_user_by_telegram_id",
            mock_get_user
        )

        # Call update_user_profile with SAME data
        result = await update_user_profile(
            session=mock_session,
            telegram_id=123456789,
            first_name="Same",
            last_name="User",
            username="sameuser",  # Same username - no change
        )

        # Assertions
        # 1. Should return existing user (NOT new version)
        assert result == existing_user

        # 2. User should still be current
        assert existing_user.is_current == True  # noqa: E712

        # 3. session.exec should NOT be called (no token revocation needed)
        mock_session.exec.assert_not_called()

        # 4. session.flush should NOT be called (no new version created)
        mock_session.flush.assert_not_called()

    @pytest.mark.asyncio
    async def test_scd2_handles_null_last_name(self, monkeypatch):
        """
        Test that update_user_profile handles NULL last_name without AttributeError.

        Scenario:
            - User exists with last_name = NULL (Telegram user without last name)
            - Update profile with same data
            - Should NOT crash with AttributeError
        """
        # Mock database session
        mock_session = AsyncMock()

        # Mock user with NULL last_name
        existing_user = User(
            id=1,
            telegram_id=123456789,
            username="user",
            first_name="First",
            last_name=None,  # NULL last_name
            is_admin=False,
            is_current=True,
            valid_from=datetime(2025, 1, 1),
            valid_to=datetime(9999, 12, 31),
            created_at=datetime(2025, 1, 1),
            updated_at=datetime(2025, 1, 1),
        )

        # Mock get_user_by_telegram_id
        async def mock_get_user(session, telegram_id):
            return existing_user

        monkeypatch.setattr(
            "backend.app.services.auth_service.get_user_by_telegram_id",
            mock_get_user
        )

        # Call update_user_profile with NULL last_name
        result = await update_user_profile(
            session=mock_session,
            telegram_id=123456789,
            first_name="First",
            last_name=None,  # NULL value
            username="user",
        )

        # Assertions
        # 1. Should NOT crash with AttributeError
        assert result is not None

        # 2. Should return existing user (no change)
        assert result == existing_user

        # 3. session.exec should NOT be called (no token revocation)
        mock_session.exec.assert_not_called()


@pytest.mark.unit
class TestRefreshTokenRevocationLogic:
    """Test RefreshToken.revoke() method."""

    def test_revoke_sets_flags(self):
        """Test that revoke() sets is_revoked and revoked_at."""
        token = RefreshToken(
            id=1,
            user_id=1,
            token_hash="hash123",
            expires_at=datetime.utcnow() + timedelta(days=30),
            is_revoked=False,
            revoked_at=None,
        )

        # Initially not revoked
        assert token.is_revoked == False  # noqa: E712
        assert token.revoked_at is None
        assert token.is_valid() == True  # noqa: E712

        # Revoke the token
        token.revoke()

        # After revocation
        assert token.is_revoked == True  # noqa: E712
        assert token.revoked_at is not None
        assert token.is_valid() == False  # noqa: E712
