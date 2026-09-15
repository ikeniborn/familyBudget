"""
Integration tests for AI module admin endpoints (phase 1).

Covers the settings lifecycle (lazy default row, partial update, token
masking and clearing), admin-only access, and the health check with
unconfigured slots (no provider network calls involved).
"""

import pytest
from httpx import AsyncClient

from backend.app.core import token_crypto
from backend.app.services import ai_settings_service


@pytest.mark.integration
class TestAISettings:
    async def test_get_settings_creates_defaults(
        self, authenticated_admin_client: AsyncClient
    ):
        response = await authenticated_admin_client.get("/api/v1/ai/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False
        # No baked-in default endpoint: the admin must configure it explicitly.
        assert data["endpoint_url"] == ""
        assert data["token_masked"] is None
        assert data["model_text"] is None

    async def test_settings_requires_admin(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/ai/settings")
        assert response.status_code == 403

    @pytest.mark.destructive
    async def test_update_settings_masks_token(
        self, authenticated_admin_client: AsyncClient
    ):
        response = await authenticated_admin_client.put(
            "/api/v1/ai/settings",
            json={
                "enabled": True,
                "api_token": "frameworkEdgeToken-abcd1234",
                "model_text": "ollama-qwen3-5-cloud",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is True
        assert data["model_text"] == "ollama-qwen3-5-cloud"
        # Full token never returned; only the masked tail is exposed.
        assert data["token_masked"] == "***1234"
        assert "api_token" not in data

    @pytest.mark.destructive
    async def test_update_empty_token_clears_it(
        self, authenticated_admin_client: AsyncClient
    ):
        await authenticated_admin_client.put(
            "/api/v1/ai/settings", json={"api_token": "tok-secret-1"}
        )
        response = await authenticated_admin_client.put(
            "/api/v1/ai/settings", json={"api_token": ""}
        )
        assert response.status_code == 200
        assert response.json()["token_masked"] is None

    @pytest.mark.destructive
    async def test_update_omitted_token_keeps_it(
        self, authenticated_admin_client: AsyncClient
    ):
        await authenticated_admin_client.put(
            "/api/v1/ai/settings", json={"api_token": "tok-keep-9876"}
        )
        response = await authenticated_admin_client.put(
            "/api/v1/ai/settings", json={"enabled": False}
        )
        assert response.status_code == 200
        assert response.json()["token_masked"] == "***9876"

    async def test_update_requires_admin(self, authenticated_client: AsyncClient):
        response = await authenticated_client.put(
            "/api/v1/ai/settings", json={"enabled": True}
        )
        assert response.status_code == 403

    @pytest.mark.destructive
    async def test_token_stored_encrypted_at_rest(
        self, authenticated_admin_client: AsyncClient, db_session
    ):
        await authenticated_admin_client.put(
            "/api/v1/ai/settings", json={"api_token": "tok-at-rest-5678"}
        )
        settings = await ai_settings_service.get_settings(db_session)
        assert settings.api_token is not None
        assert settings.api_token.startswith("enc:")
        assert "tok-at-rest-5678" not in settings.api_token
        # Masking still shows the plaintext tail.
        assert ai_settings_service.mask_token(settings.api_token) == "***5678"


@pytest.mark.integration
class TestAIHealthCheck:
    async def test_health_check_unconfigured_slots(
        self, authenticated_admin_client: AsyncClient
    ):
        """Fresh settings have no models: every slot is not_configured and
        no provider call is attempted."""
        response = await authenticated_admin_client.post("/api/v1/ai/health-check")
        assert response.status_code == 200
        data = response.json()
        for slot in ("text", "image", "voice"):
            assert data[slot]["status"] == "not_configured"

    async def test_health_check_requires_admin(
        self, authenticated_client: AsyncClient
    ):
        response = await authenticated_client.post("/api/v1/ai/health-check")
        assert response.status_code == 403


def test_mask_token_shapes():
    assert ai_settings_service.mask_token(None) is None
    assert ai_settings_service.mask_token("") is None
    assert ai_settings_service.mask_token("ab") == "***"
    assert ai_settings_service.mask_token("frameworkEdgeToken-abcd1234") == "***1234"


def test_token_crypto_roundtrip():
    enc = token_crypto.encrypt_token("tok-secret-42")
    assert enc.startswith("enc:")
    assert "tok-secret-42" not in enc
    assert token_crypto.decrypt_token(enc) == "tok-secret-42"


def test_token_crypto_legacy_and_invalid():
    # Legacy plaintext rows pass through unchanged; garbage decrypts to None.
    assert token_crypto.decrypt_token(None) is None
    assert token_crypto.decrypt_token("plain-legacy-token") == "plain-legacy-token"
    assert token_crypto.decrypt_token("enc:not-a-fernet-token") is None
