"""
Internal API authentication for bot-to-backend communication.

Provides dependency for validating internal API key.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from backend.app.core.config import Settings, get_settings


async def verify_internal_api_key(
    x_api_key: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings)
) -> None:
    """
    Verify internal API key from request header.

    Args:
        x_api_key: API key from X-Api-Key header
        settings: Application settings with API_INTERNAL_KEY

    Raises:
        HTTPException: 401 if API key is missing or invalid

    Usage:
        @router.post("/internal-endpoint")
        async def internal_endpoint(
            _: None = Depends(verify_internal_api_key)
        ):
            # Endpoint protected by internal API key
            pass
    """
    if x_api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Api-Key header"
        )

    if x_api_key != settings.API_INTERNAL_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )


InternalAPIKey = Annotated[None, Depends(verify_internal_api_key)]
