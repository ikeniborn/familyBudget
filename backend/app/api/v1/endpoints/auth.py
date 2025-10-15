"""
Authentication API endpoints.

⚠️ CRITICAL SECURITY MODULE ⚠️
This module implements Telegram OAuth authentication with JWT refresh token support.
Proper validation is essential to prevent authentication bypass (RISK-002).

Endpoints:
    POST /auth/telegram - Telegram OAuth login (generates access + refresh tokens)
    POST /auth/refresh - Refresh access token using refresh token (token rotation)
    POST /auth/logout - Logout user by revoking refresh token

Security Features:
    - Telegram OAuth validation (HMAC-SHA256)
    - JWT access tokens (7-day expiry, httpOnly cookie)
    - JWT refresh tokens (30-day expiry, httpOnly cookie)
    - Token rotation (old refresh token revoked when used)
    - Token blacklist (revoked tokens cannot be reused)
    - Refresh tokens hashed in database (SHA-256, like password hashing)
"""

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import get_session
from backend.app.models.refresh_token import RefreshToken
from backend.app.models.user import User
from backend.app.schemas import get_common_responses
from backend.app.schemas.auth import AuthResponse, TelegramAuthData, UserResponse
from backend.app.services.auth_service import get_or_create_user
from backend.app.services.jwt import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_token,
)
from backend.app.services.telegram_auth import validate_telegram_auth

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/telegram",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Telegram OAuth Login",
    responses=get_common_responses(include_401=True, include_503=True),
    description="""
    Authenticate user via Telegram Login Widget.

    ⚠️ SECURITY CRITICAL ENDPOINT ⚠️

    Process:
    1. Validate Telegram OAuth hash (HMAC-SHA256)
    2. Create or update user in database (SCD Type 2)
    3. Generate JWT access token (7-day expiry)
    4. Generate JWT refresh token (30-day expiry)
    5. Store refresh token hash in database
    6. Set both tokens in httpOnly cookies
    7. Return user data

    Security:
    - HMAC-SHA256 hash validation (RISK-002 mitigation)
    - JWT access token with 7-day expiry (httpOnly cookie)
    - JWT refresh token with 30-day expiry (httpOnly cookie)
    - Refresh token hashed before database storage (SHA-256)
    - httpOnly cookies (XSS protection)
    - SameSite=Lax (CSRF protection)

    Related:
    - RISK-002: Telegram OAuth vulnerability
    - TASK-012: Telegram OAuth endpoint
    - TASK-020: JWT Refresh Token Mechanism
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
        - Both access_token and refresh_token set in httpOnly cookies
        - Tokens NOT returned in response body (only in cookies)
        - access_token: 7-day expiry
        - refresh_token: 30-day expiry, hashed in database
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

    # Step 5: Generate JWT refresh token (30-day expiry)
    refresh_token, refresh_expires = create_refresh_token(user_id=user.id)
    refresh_token_hash = hash_token(refresh_token)

    # Step 6: Store refresh token in database
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_hash,
        expires_at=refresh_expires,
    )
    session.add(db_refresh_token)
    await session.commit()

    # Step 7: Set JWT access token in httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,  # Prevent JavaScript access (XSS protection)
        secure=True,  # HTTPS only (set to False for local development if needed)
        samesite="lax",  # CSRF protection
        max_age=60 * 60 * 24 * 7,  # 7 days in seconds
    )

    # Step 8: Set JWT refresh token in httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,  # Prevent JavaScript access (XSS protection)
        secure=True,  # HTTPS only
        samesite="lax",  # CSRF protection
        max_age=60 * 60 * 24 * 30,  # 30 days in seconds
    )

    # Step 9: Return user data (tokens are in cookies, not in response body)
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


@router.post(
    "/refresh",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh Access Token",
    responses=get_common_responses(include_401=True),
    description="""
    Refresh access token using refresh token.

    ⚠️ SECURITY CRITICAL ENDPOINT ⚠️

    Process:
    1. Extract refresh token from httpOnly cookie
    2. Validate JWT structure and signature
    3. Look up token in database (check revocation status)
    4. Generate new access token
    5. Generate new refresh token (rotation)
    6. Revoke old refresh token in database
    7. Store new refresh token in database
    8. Set both tokens in httpOnly cookies
    9. Return user data

    Security Features:
    - Token rotation: Old refresh token is revoked after use
    - Prevents token replay attacks
    - Checks token blacklist (revoked tokens)
    - httpOnly cookies (XSS protection)
    - SameSite=Lax (CSRF protection)

    Related:
    - TASK-020: JWT Refresh Token Mechanism
    """,
)
async def refresh_access_token(
    response: Response,
    session: AsyncSession = Depends(get_session),
    refresh_token: str | None = Cookie(None, alias="refresh_token"),
) -> AuthResponse:
    """
    Refresh access token using refresh token.

    ⚠️ CRITICAL SECURITY ENDPOINT ⚠️

    Args:
        response: FastAPI response object (for setting cookies)
        session: Async database session
        refresh_token: Refresh token from cookie

    Returns:
        AuthResponse: User data and success message

    Raises:
        HTTPException: 401 if refresh token is missing, invalid, or revoked

    Example Request:
        POST /api/v1/auth/refresh
        Cookies: refresh_token=eyJhbGciOiJIUzI1NiIs...

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
            "message": "Token refreshed successfully"
        }

    Security Notes:
        - Both new access_token and refresh_token set in httpOnly cookies
        - Old refresh token is revoked (cannot be reused)
        - Token rotation prevents replay attacks
    """
    # Step 1: Validate refresh token is present
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required - No token provided"
        )

    # Step 2: Decode and validate JWT structure
    user_id = decode_refresh_token(refresh_token)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token - Token malformed or expired"
        )

    # Step 3: Look up token in database (check revocation status)
    token_hash = hash_token(refresh_token)

    statement = select(RefreshToken).where(
        RefreshToken.token_hash == token_hash,
        RefreshToken.user_id == user_id,
    )
    result = await session.execute(statement)
    db_token = result.scalar_one_or_none()

    if db_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token - Token not found in database"
        )

    # Step 4: Check if token is valid (not revoked, not expired)
    if not db_token.is_valid():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token - Token revoked or expired"
        )

    # Step 5: Load user from database (for response)
    user_statement = select(User).where(
        User.id == user_id,
        User.is_current == True  # noqa: E712
    )
    user_result = await session.execute(user_statement)
    user = user_result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found - Account may have been deleted"
        )

    # Step 6: Generate new access token
    new_access_token = create_access_token(user_id=user.id)

    # Step 7: Generate new refresh token (rotation)
    new_refresh_token, new_refresh_expires = create_refresh_token(user_id=user.id)
    new_refresh_hash = hash_token(new_refresh_token)

    # Step 8: Revoke old refresh token in database
    db_token.revoke()
    db_token.mark_used()  # Update last_used_at before revoking

    # Step 9: Store new refresh token in database
    new_db_token = RefreshToken(
        user_id=user.id,
        token_hash=new_refresh_hash,
        expires_at=new_refresh_expires,
    )
    session.add(new_db_token)

    # Commit changes
    await session.commit()

    # Step 10: Set new access token in httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days in seconds
    )

    # Step 11: Set new refresh token in httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,  # 30 days in seconds
    )

    # Step 12: Return user data
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
        message="Token refreshed successfully"
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout User",
    responses=get_common_responses(),
    description="""
    Logout user by revoking refresh token.

    Process:
    1. Extract refresh token from httpOnly cookie
    2. Hash token and look up in database
    3. Revoke token (set is_revoked=TRUE)
    4. Clear both access_token and refresh_token cookies
    5. Return success message

    Security Features:
    - Revoked tokens cannot be used again
    - Clears cookies on client side
    - Prevents token reuse

    Related:
    - TASK-020: JWT Refresh Token Mechanism
    """,
)
async def logout(
    response: Response,
    session: AsyncSession = Depends(get_session),
    refresh_token: str | None = Cookie(None, alias="refresh_token"),
) -> dict:
    """
    Logout user by revoking refresh token.

    Args:
        response: FastAPI response object (for clearing cookies)
        session: Async database session
        refresh_token: Refresh token from cookie

    Returns:
        dict: Success message

    Example Request:
        POST /api/v1/auth/logout
        Cookies: refresh_token=eyJhbGciOiJIUzI1NiIs...

    Example Response:
        {
            "message": "Logout successful"
        }

    Security Notes:
        - Refresh token is revoked in database
        - Both access_token and refresh_token cookies are cleared
        - Even if token is missing, cookies are still cleared (for safety)
    """
    # If refresh token is provided, revoke it in database
    if refresh_token:
        token_hash = hash_token(refresh_token)

        # Look up token in database
        statement = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash
        )
        result = await session.execute(statement)
        db_token = result.scalar_one_or_none()

        # If token exists and not already revoked, revoke it
        if db_token and not db_token.is_revoked:
            db_token.revoke()
            await session.commit()

    # Clear both cookies (access_token and refresh_token)
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token")

    return {"message": "Logout successful"}
