"""
Unit tests for the token_type claim on JWT access tokens.

A refresh token carries a user_id claim, so before this contract existed it
decoded as a perfectly valid access token. These tests pin the three observable
results from the intent:

1. A refresh token presented on the access path is refused.
2. An access token minted without a token_type claim is still accepted, so
   sessions established before the change survive.
3. A newly issued access token carries token_type="access".

They also guard the health metrics: the WebSocket token contract and the
refresh path itself must keep working.
"""

from datetime import datetime, timedelta

from jose import jwt

from backend.app.services.jwt import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    create_refresh_token,
    create_ws_token,
    decode_access_token,
    decode_access_token_full,
    decode_refresh_token,
    decode_ws_token,
)

USER_ID = 4242
TELEGRAM_ID = 740775802


def _legacy_access_token(user_id: int = USER_ID, telegram_id: int = TELEGRAM_ID) -> str:
    """Mint an access token in the pre-change shape: no token_type claim at all."""
    now = datetime.utcnow()
    claims = {
        "user_id": user_id,
        "telegram_id": telegram_id,
        "exp": now + timedelta(days=7),
        "iat": now,
    }
    return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)


class TestRefreshTokenRejectedOnAccessPath:
    """Outcome 1: a refresh token must not authenticate a request."""

    def test_decode_access_token_rejects_refresh_token(self):
        refresh_token, _ = create_refresh_token(user_id=USER_ID)

        assert decode_access_token(refresh_token) is None

    def test_decode_access_token_full_rejects_refresh_token(self):
        refresh_token, _ = create_refresh_token(user_id=USER_ID)

        assert decode_access_token_full(refresh_token) == (None, None)

    def test_middleware_cannot_derive_a_user_from_a_refresh_token(self):
        """The middleware reads decode_access_token_full and sets request.state.user_id
        from its first element. A refresh token must not yield a user id there."""
        refresh_token, _ = create_refresh_token(user_id=USER_ID)

        user_id, telegram_id = decode_access_token_full(refresh_token)

        assert user_id is None
        assert telegram_id is None


class TestLegacyAccessTokenStillAccepted:
    """Outcome 2: sessions established before the change keep working."""

    def test_decode_access_token_accepts_token_without_claim(self):
        token = _legacy_access_token()

        assert decode_access_token(token) == TELEGRAM_ID

    def test_decode_access_token_full_accepts_token_without_claim(self):
        token = _legacy_access_token()

        assert decode_access_token_full(token) == (USER_ID, TELEGRAM_ID)

    def test_email_only_legacy_token_still_yields_user_id(self):
        """Email-only users carry no telegram_id; the middleware relies on user_id."""
        now = datetime.utcnow()
        token = jwt.encode(
            {"user_id": USER_ID, "exp": now + timedelta(days=7), "iat": now},
            SECRET_KEY,
            algorithm=ALGORITHM,
        )

        assert decode_access_token_full(token) == (USER_ID, None)


class TestFreshAccessTokenCarriesClaim:
    """Outcome 3: newly issued access tokens declare their type."""

    def test_created_access_token_has_access_token_type(self):
        token = create_access_token(user_id=USER_ID, telegram_id=TELEGRAM_ID)

        claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        assert claims["token_type"] == "access"

    def test_created_access_token_still_decodes(self):
        token = create_access_token(user_id=USER_ID, telegram_id=TELEGRAM_ID)

        assert decode_access_token_full(token) == (USER_ID, TELEGRAM_ID)
        assert decode_access_token(token) == TELEGRAM_ID


class TestOtherTokenContractsUnchanged:
    """Health metrics: the WebSocket and refresh contracts must not regress."""

    def test_ws_token_is_not_accepted_as_an_access_token(self):
        ws_token = create_ws_token(user_id=USER_ID)

        assert decode_access_token_full(ws_token) == (None, None)

    def test_ws_token_still_decodes_on_its_own_path(self):
        ws_token = create_ws_token(user_id=USER_ID)

        assert decode_ws_token(ws_token) == USER_ID

    def test_refresh_token_still_decodes_on_its_own_path(self):
        refresh_token, expires_at = create_refresh_token(user_id=USER_ID)

        assert decode_refresh_token(refresh_token) == USER_ID
        assert expires_at > datetime.utcnow()

    def test_access_token_is_not_accepted_as_a_refresh_token(self):
        token = create_access_token(user_id=USER_ID, telegram_id=TELEGRAM_ID)

        assert decode_refresh_token(token) is None
