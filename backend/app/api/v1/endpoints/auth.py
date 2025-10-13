"""
Authentication API endpoints.

⚠️ CRITICAL SECURITY MODULE ⚠️
This module implements Telegram OAuth authentication endpoints.
Proper validation is essential to prevent authentication bypass (RISK-002).

Endpoints:
    POST /auth/telegram - Telegram OAuth login
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import get_session
from backend.app.schemas.auth import AuthResponse, TelegramAuthData, UserResponse
from backend.app.services.auth_service import get_or_create_user
from backend.app.services.jwt import create_access_token
from backend.app.services.telegram_auth import validate_telegram_auth

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/telegram",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Telegram OAuth Login",
    description="""
    Authenticate user via Telegram Login Widget.

    ⚠️ SECURITY CRITICAL ENDPOINT ⚠️

    Process:
    1. Validate Telegram OAuth hash (HMAC-SHA256)
    2. Create or update user in database (SCD Type 2)
    3. Generate JWT access token (7-day expiry)
    4. Set token in httpOnly cookie
    5. Return user data

    Security:
    - HMAC-SHA256 hash validation (RISK-002 mitigation)
    - JWT token with 7-day expiry
    - httpOnly cookie (XSS protection)
    - SameSite=Lax (CSRF protection)

    Related:
    - RISK-002: Telegram OAuth vulnerability
    - TASK-012: Telegram OAuth endpoint
    - TASK-026: Auth unit tests
    """,
)
async def telegram_login(
    auth_data: TelegramAuthData,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    """
    Authenticate user via Telegram OAuth.

    ⚠️ CRITICAL SECURITY ENDPOINT ⚠️

    Args:
        auth_data: Telegram OAuth data with hash
        response: FastAPI response object (for setting cookies)
        session: Async database session

    Returns:
        AuthResponse: User data and success message

    Raises:
        HTTPException: 401 if hash validation fails
        HTTPException: 500 if database error occurs

    Example Request:
        POST /api/v1/auth/telegram
        {
            "id": 123456789,
            "first_name": "John",
            "last_name": "Doe",
            "username": "johndoe",
            "auth_date": 1699999999,
            "hash": "abc123def456..."
        }

    Example Response:
        {
            "user": {
                "id": 1,
                "telegram_id": 123456789,
                "username": "johndoe",
                "first_name": "John",
                "last_name": "Doe",
                "is_admin": false
            },
            "message": "Authentication successful"
        }

    Security Notes:
        - JWT token set in httpOnly cookie (not returned in response body)
        - Cookie name: "access_token"
        - Cookie attributes: httpOnly=True, secure=True, samesite="lax"
    """
    # Step 1: Prepare data for hash validation
    # Telegram hash validation requires all values as strings
    validation_data = {
        "id": str(auth_data.id),
        "first_name": auth_data.first_name,
        "auth_date": str(auth_data.auth_date),
        "hash": auth_data.hash,
    }

    # Add optional fields if present
    if auth_data.last_name:
        validation_data["last_name"] = auth_data.last_name
    if auth_data.username:
        validation_data["username"] = auth_data.username
    if auth_data.photo_url:
        validation_data["photo_url"] = auth_data.photo_url

    # Step 2: Validate Telegram OAuth hash (CRITICAL SECURITY)
    is_valid = validate_telegram_auth(validation_data)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication data - hash validation failed",
        )

    # Step 3: Get or create user (SCD Type 2 pattern)
    user = await get_or_create_user(
        session=session,
        telegram_id=auth_data.id,
        first_name=auth_data.first_name,
        last_name=auth_data.last_name,
        username=auth_data.username,
    )

    # Step 4: Generate JWT access token
    access_token = create_access_token(user_id=user.id)

    # Step 5: Set JWT token in httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,  # Prevent JavaScript access (XSS protection)
        secure=True,  # HTTPS only (set to False for local development if needed)
        samesite="lax",  # CSRF protection
        max_age=60 * 60 * 24 * 7,  # 7 days in seconds
    )

    # Step 6: Return user data (token is in cookie, not in response body)
    user_response = UserResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=user.is_admin,
    )

    return AuthResponse(
        user=user_response,
        message="Authentication successful"
    )
