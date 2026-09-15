"""
AI settings service: single-row configuration access with in-process caching.

The settings row (id=1) is created lazily with defaults on first read.
Endpoints own the transaction (get_session); this service never commits.

The provider token is stored Fernet-encrypted ("enc:" prefix, see
token_crypto) and is only ever exposed masked. Legacy plaintext rows are
read as-is and re-encrypted on the next save.
"""
import time

from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.token_crypto import decrypt_token, encrypt_token
from backend.app.models.ai_settings import AI_SETTINGS_ROW_ID, AISettings
from backend.app.schemas.ai import AISettingsUpdate

CACHE_TTL_SECONDS = 60

_cache: AISettings | None = None
_cache_at: float = 0.0


def mask_token(token: str | None) -> str | None:
    """Return a display-safe form of the token: '***…last4' or None."""
    token = decrypt_token(token)
    if not token:
        return None
    tail = token[-4:] if len(token) > 4 else ""
    return f"***{tail}"


def invalidate_cache() -> None:
    global _cache, _cache_at
    _cache = None
    _cache_at = 0.0


async def get_settings(session: AsyncSession) -> AISettings:
    """Load the settings row, creating it with defaults when absent."""
    settings = await session.get(AISettings, AI_SETTINGS_ROW_ID)
    if settings is None:
        settings = AISettings(id=AI_SETTINGS_ROW_ID)
        session.add(settings)
        await session.flush()
        await session.refresh(settings)
    return settings


async def get_settings_cached(session: AsyncSession) -> AISettings:
    """Settings for hot request paths; short TTL keeps admin edits visible."""
    global _cache, _cache_at
    if _cache is not None and (time.monotonic() - _cache_at) < CACHE_TTL_SECONDS:
        return _cache
    settings = await get_settings(session)
    # Detach a plain copy so cached data never binds to an expired session.
    _cache = AISettings.model_validate(settings.model_dump())
    _cache_at = time.monotonic()
    return _cache


async def update_settings(
    session: AsyncSession, data: AISettingsUpdate, updated_by: int
) -> AISettings:
    """Apply a partial update; empty-string token clears it, omitted keeps."""
    settings = await get_settings(session)

    fields = data.model_dump(exclude_unset=True)
    if "api_token" in fields:
        if fields["api_token"] == "":
            fields["api_token"] = None
        elif fields["api_token"] is not None:
            fields["api_token"] = encrypt_token(fields["api_token"])

    for field, value in fields.items():
        setattr(settings, field, value)
    settings.updated_by = updated_by

    await session.flush()
    await session.refresh(settings)
    invalidate_cache()
    return settings
