"""
Telegram initData validation endpoint.

⚠️ CRITICAL SECURITY MODULE ⚠️
This module implements Telegram Web Apps initData validation.
Proper validation is essential to prevent authentication bypass.

Endpoint:
    POST /api/v1/webapp/validate - Validate Telegram initData and issue JWT token

Security:
    - HMAC-SHA256 validation of initData signature
    - auth_date expiration check (< 1 hour)
    - User data extraction from initData
    - JWT token issuance for authenticated requests

References:
    - https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import get_session
from backend.app.schemas import get_common_responses
from backend.app.schemas.webapp import (
    WebAppInitDataRequest,
    WebAppUser,
    WebAppValidateResponse,
)
from backend.app.services.auth_service import get_or_create_user
from backend.app.services.jwt import create_access_token
from backend.app.services.webapp_auth import (
    extract_user_from_initdata,
    validate_webapp_initdata,
)

router = APIRouter()


@router.post(
    "/validate",
    response_model=WebAppValidateResponse,
    status_code=status.HTTP_200_OK,
    responses=get_common_responses(include_401=True),
    summary="Validate Telegram Web App initData",
    description="""
    Validate Telegram Web App initData and issue JWT access token.

    ⚠️ CRITICAL SECURITY ENDPOINT ⚠️

    This endpoint validates initData received from Telegram.WebApp.initData using
    HMAC-SHA256 signature verification. It ensures that data comes from Telegram
    and hasn't been tampered with.

    Process:
    1. Parse initData query string
    2. Validate HMAC-SHA256 signature (secret: HMAC("WebAppData", BOT_TOKEN))
    3. Check auth_date expiration (< 1 hour)
    4. Extract user data from initData
    5. Get or create user in database (SCD Type 2)
    6. Issue JWT access token (7-day expiry)
    7. Return {valid: true, user: {...}, access_token: "..."}

    Security Features:
    - Timing-attack resistant hash comparison
    - auth_date expiration check (prevents replay attacks)
    - User data isolation (each user sees only own data)
    - JWT token for authenticated API calls

    Usage in Web App:
    ```javascript
    const initData = Telegram.WebApp.initData;
    const response = await fetch('/api/v1/webapp/validate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({initData})
    });
    const {valid, user, access_token} = await response.json();
    // Store access_token for subsequent API calls
    ```

    Error Responses:
    - 401 Unauthorized: Invalid initData signature or expired auth_date
    - 500 Internal Server Error: Database or server error

    Related:
    - All other /api/v1/webapp/* endpoints require this token
    - POST /auth/telegram - Alternative auth for web (Login Widget)
    """,
)
async def validate_initdata(
    request: WebAppInitDataRequest, session: AsyncSession = Depends(get_session)
) -> WebAppValidateResponse:
    """
    Validate Telegram Web App initData and return JWT token.

    Args:
        request: WebAppInitDataRequest with raw initData string
        session: Database session (injected)

    Returns:
        WebAppValidateResponse: {valid, user, access_token}

    Raises:
        HTTPException 401: Invalid initData or expired auth_date
        HTTPException 500: Database error

    Example:
        >>> # POST /api/v1/webapp/validate
        >>> # Body: {"initData": "query_id=...&user={...}&auth_date=...&hash=..."}
        >>> # Response: {"valid": true, "user": {...}, "access_token": "..."}
    """
    # Step 1: Validate initData
    is_valid, user_data = validate_webapp_initdata(request.initData)

    if not is_valid or user_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid initData signature or expired auth_date",
        )

    # Step 2: Extract user info from initData
    user_dict = extract_user_from_initdata(user_data)

    # Step 3: Get or create user (reuse existing auth service)
    user = await get_or_create_user(session, user_dict)

    # Step 4: Create JWT access token (7-day expiry)
    # Note: No refresh token for Web Apps (Telegram handles re-auth)
    access_token = create_access_token(data={"sub": str(user.telegram_id)})

    # Step 5: Build response
    web_app_user = WebAppUser(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=user.is_admin,
    )

    return WebAppValidateResponse(valid=True, user=web_app_user, access_token=access_token)
