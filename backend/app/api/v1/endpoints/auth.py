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

# Standard library imports
import logging
from datetime import datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.config import get_settings
from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.core.logging_utils import hash_email_for_logging
from backend.app.middleware.rate_limiter import limiter
from backend.app.models.refresh_token import RefreshToken
from backend.app.models.user import User
from backend.app.models.webauthn_credential import WebAuthnCredential
from backend.app.schemas import get_common_responses
from backend.app.schemas.auth import (
    AddEmailRequest,
    AuthMethodsResponse,
    AuthResponse,
    BackupCodesResponse,
    EmailLoginRequest,
    EmailLoginResponse,
    EmailRegisterRequest,
    LinkTelegramRequest,
    MessageResponse,
    RegistrationSuccessResponse,
    SetPasswordRequest,
    TelegramAuthData,
    TwoFactorDisableRequest,
    TwoFactorSetupAndVerifyRequest,
    TwoFactorSetupCompleteResponse,
    TwoFactorSetupResponse,
    TwoFactorVerifyRequest,
    TwoFactorVerifySetupRequest,
    UserResponse,
    WebAuthnCredentialInfo,
)
from backend.app.services.auth_service import (
    add_email_to_user,
    authenticate_with_password,
    get_user_by_email,
    get_user_by_id,
    get_user_by_telegram_id,
    link_telegram_to_user,
    set_user_password,
)
from backend.app.services.avatar_service import download_user_avatar
from backend.app.services.jwt import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_token,
)
from backend.app.services.password_service import (
    hash_password,
    validate_password_strength,
    verify_password,
)
from backend.app.services.telegram_auth import validate_telegram_auth
from backend.app.services.totp_service import (
    generate_backup_codes,
    generate_secret,
    get_totp_uri,
    verify_backup_code,
    verify_totp,
)
from backend.app.services.two_factor_session_service import (
    consume_session as consume_2fa_session,
    create_session as create_2fa_session,
    verify_session as verify_2fa_session,
)
from backend.app.services.user_service import (
    create_initial_history,
)
from backend.app.services.webauthn_service import user_has_webauthn_credentials

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()
logger = logging.getLogger(__name__)


@router.get(
    "/telegram-login",
    response_class=HTMLResponse,
    summary="Telegram Login Page",
    description="""
    Display Telegram Login Widget page for web authentication.

    This page renders the official Telegram Login Widget which allows users
    to authenticate using their Telegram account.

    Process:
    1. User visits this page
    2. Telegram Widget is displayed
    3. User clicks "Login with Telegram"
    4. Telegram authenticates user
    5. Widget redirects to /auth/telegram-callback with auth data
    6. Callback processes auth and sets JWT cookies
    7. User is redirected to dashboard

    Security:
    - Uses official Telegram Login Widget
    - Callback validates HMAC-SHA256 hash
    - No credentials stored on our servers

    Related:
    - GET /auth/telegram-callback - Handles widget callback
    - POST /auth/telegram - API endpoint for direct auth
    """,
)
async def telegram_login_page(request: Request) -> HTMLResponse:
    """
    Display Telegram Login Widget page.

    Args:
        request: FastAPI request object

    Returns:
        HTMLResponse: Telegram login page with widget

    Example:
        GET /api/v1/auth/telegram-login
        Returns HTML page with Telegram Login Widget
    """
    from backend.app.main import templates

    # Build callback URL (full URL including domain)
    # In production: https://your-domain.com/api/v1/auth/telegram-callback
    # In development: http://localhost:8000/api/v1/auth/telegram-callback
    callback_url = str(request.url_for("telegram_callback"))

    return templates.TemplateResponse(
        "telegram_login.html",
        {
            "request": request,
            "bot_username": settings.TELEGRAM_BOT_USERNAME,
            "callback_url": callback_url,
            "page_title": "Вход через Telegram",
        },
    )


@router.get(
    "/telegram-callback",
    response_class=HTMLResponse,
    summary="Telegram Widget Callback",
    description="""
    Handle callback from Telegram Login Widget.

    ⚠️ SECURITY CRITICAL ENDPOINT ⚠️

    This endpoint is called by the Telegram Login Widget after user authentication.
    It receives user data as query parameters and validates the HMAC hash.

    Process:
    1. Extract auth data from query parameters
    2. Validate Telegram OAuth hash (HMAC-SHA256)
    3. Create or update user in database
    4. Generate JWT access + refresh tokens
    5. Set tokens in httpOnly cookies
    6. Redirect to dashboard

    Query Parameters (from Telegram Widget):
        id: Telegram user ID
        first_name: User's first name
        last_name: User's last name (optional)
        username: Telegram username (optional)
        photo_url: Profile photo URL (optional)
        auth_date: Authentication timestamp
        hash: HMAC-SHA256 hash for validation

    Security:
    - Validates HMAC-SHA256 hash using bot token
    - Prevents authentication bypass (RISK-002)
    - Sets httpOnly cookies (XSS protection)
    - SameSite=Lax (CSRF protection)
    - Rate limited: 10 requests per minute (OAuth abuse prevention)

    Related:
    - GET /auth/telegram-login - Login page with widget
    - POST /auth/telegram - Direct API authentication
    """,
)
@limiter.limit("10/minute")
async def telegram_callback(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> HTMLResponse:
    """
    Handle Telegram Login Widget callback.

    ⚠️ CRITICAL SECURITY ENDPOINT ⚠️

    Args:
        request: FastAPI request object (contains query params from widget)
        response: FastAPI response object (for setting cookies)
        session: Async database session

    Returns:
        HTMLResponse: Redirect template to dashboard on success

    Raises:
        HTTPException: 401 if hash validation fails
        HTTPException: 500 if database error occurs

    Example:
        GET /api/v1/auth/telegram-callback?id=123456789&first_name=John&username=johndoe&auth_date=1699999999&hash=abc123...
        -> Validates auth data
        -> Sets JWT cookies
        -> Redirects to /
    """
    # Step 1: Extract auth data from query parameters
    query_params = dict(request.query_params)

    # Validate required parameters
    required_fields = ["id", "first_name", "auth_date", "hash"]
    missing_fields = [field for field in required_fields if field not in query_params]

    if missing_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required parameters: {', '.join(missing_fields)}",
        )

    # Step 2: Validate Telegram OAuth hash (CRITICAL SECURITY)
    is_valid = validate_telegram_auth(query_params)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication data - hash validation failed",
        )

    # Step 3: Get existing user OR create new inactive user ⚠️ SECURITY CRITICAL
    telegram_id = int(query_params["id"])
    user = await get_user_by_telegram_id(
        session=session,
        telegram_id=telegram_id,
    )

    # Step 3.1: Auto-create new user if not exists (PRD FR-030 compliance)
    if user is None:
        # Check if this is the admin user
        is_admin_user = (telegram_id == settings.ADMIN_TELEGRAM_ID)

        # Create new user (SCD Type 1 - no versioning fields)
        # Admin is auto-activated (is_admin=True, is_active=True)
        # Regular users are inactive by default (admin must activate)
        user = User(
            telegram_id=telegram_id,
            username=query_params.get("username"),
            first_name=query_params["first_name"],
            last_name=query_params.get("last_name"),
            is_admin=is_admin_user,
            is_active=is_admin_user,  # Admin auto-activated, others inactive
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        # Create initial UserHistory record (SCD Type 2)
        from backend.app.services.user_service import create_initial_history
        await create_initial_history(session=session, user=user, change_type="CREATE")

    # Step 3.2: Check if user is active (admin auto-activated, others require activation)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your account is pending activation. "
                "Please contact admin or start the bot @ikenibornbudgetbot to request access."
            ),
        )

    # Step 3.1.5: Download and cache avatar if provided
    local_photo_path = None
    if query_params.get("photo_url"):
        local_photo_path = await download_user_avatar(
            telegram_photo_url=query_params["photo_url"],
            user_id=user.id
        )

    # Step 3.2: Update user profile if data changed (Hybrid SCD1 + History SCD2)
    # Check if profile data changed (username, first_name, last_name, photo_url)
    profile_updates = {}
    if query_params.get("first_name") and query_params.get("first_name") != user.first_name:
        profile_updates["first_name"] = query_params["first_name"]
    if query_params.get("last_name") and query_params.get("last_name") != user.last_name:
        profile_updates["last_name"] = query_params.get("last_name")
    if query_params.get("username") and query_params.get("username") != user.username:
        profile_updates["username"] = query_params.get("username")
    if local_photo_path and local_photo_path != user.photo_url:
        profile_updates["photo_url"] = local_photo_path

    # Only create history record if profile actually changed
    if profile_updates:
        from backend.app.services.user_service import update_user_profile as update_profile_scd1
        user = await update_profile_scd1(
            session=session,
            user=user,
            updates=profile_updates,
            changed_by_user_id=None,  # Automatic update (from Telegram OAuth)
            change_type="LOGIN",  # Profile refresh during login
        )

    # Step 3.3: Update last_login_at (Simple UPDATE - NO history record)
    # This is audit trail, not business data - no need to track in history
    from datetime import datetime
    user.last_login_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Step 4: Generate JWT access token (using telegram_id for SCD Type 2 compatibility)
    access_token = create_access_token(user_id=user.id, telegram_id=user.telegram_id)

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

    # Step 7: Create redirect template response to enable PGlite BEFORE dashboard loads
    # This prevents race condition where PGlite tries to init before localStorage flag is set
    from backend.app.main import templates
    response = templates.TemplateResponse("auth_redirect.html", {
        "request": request,
        "target_url": "/"
    })

    # Step 7.5: Determine secure cookie flag based on environment
    # In production with SSL, cookies should be secure=True (HTTPS only)
    # In development (HTTP), secure=False to allow cookies to work
    secure_cookie = settings.APP_ENV == "production" and settings.SSL_TYPE != "none"

    # Step 8: Set JWT access token in httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,  # Prevent JavaScript access (XSS protection)
        secure=secure_cookie,  # HTTPS only in production with SSL
        samesite="lax",  # CSRF protection
        max_age=60 * 60 * 24 * 7,  # 7 days in seconds
    )

    # Step 9: Set JWT refresh token in httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,  # Prevent JavaScript access (XSS protection)
        secure=secure_cookie,  # HTTPS only in production with SSL
        samesite="lax",  # CSRF protection
        max_age=60 * 60 * 24 * 30,  # 30 days in seconds
    )

    return response


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
    - Rate limited: 10 requests per minute (OAuth abuse prevention)

    Related:
    - RISK-002: Telegram OAuth vulnerability
    - TASK-012: Telegram OAuth endpoint
    - TASK-020: JWT Refresh Token Mechanism
    """,
)
@limiter.limit("10/minute")
async def telegram_login(
    request: Request,  # Required for rate limiting
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
            "message": "Authentication successful",
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "token_type": "bearer"
        }

    Security Notes:
        - Both access_token and refresh_token returned in BOTH response body AND httpOnly cookies
        - Response body: For bot clients (bot needs tokens for API calls)
        - httpOnly cookies: For web clients (secure browser-based authentication)
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

    # Step 3: Get existing user (NO auto-creation) ⚠️ SECURITY CRITICAL
    user = await get_user_by_telegram_id(
        session=session,
        telegram_id=auth_data.id,
    )

    # Step 3.1: Check if user exists in database
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied - user not registered by administrator. Please contact admin to create your account.",
        )

    # Step 3.1.5: Download and cache avatar if provided
    local_photo_path = None
    if auth_data.photo_url:
        local_photo_path = await download_user_avatar(
            telegram_photo_url=auth_data.photo_url,
            user_id=user.id
        )

    # Step 3.2: Update user profile if data changed (Hybrid SCD1 + History SCD2)
    # Check if profile data changed (username, first_name, last_name, photo_url)
    profile_updates = {}
    if auth_data.first_name and auth_data.first_name != user.first_name:
        profile_updates["first_name"] = auth_data.first_name
    if auth_data.last_name and auth_data.last_name != user.last_name:
        profile_updates["last_name"] = auth_data.last_name
    if auth_data.username and auth_data.username != user.username:
        profile_updates["username"] = auth_data.username
    if local_photo_path and local_photo_path != user.photo_url:
        profile_updates["photo_url"] = local_photo_path

    # Only create history record if profile actually changed
    if profile_updates:
        from backend.app.services.user_service import update_user_profile as update_profile_scd1
        user = await update_profile_scd1(
            session=session,
            user=user,
            updates=profile_updates,
            changed_by_user_id=None,  # Automatic update (from Telegram OAuth)
            change_type="LOGIN",  # Profile refresh during login
        )

    # Step 3.3: Update last_login_at (Simple UPDATE - NO history record)
    # This is audit trail, not business data - no need to track in history
    from datetime import datetime
    user.last_login_at = datetime.utcnow()
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Step 4: Generate JWT access token (using telegram_id for SCD Type 2 compatibility)
    access_token = create_access_token(user_id=user.id, telegram_id=user.telegram_id)

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

    # Step 9: Return user data with tokens in BOTH response body AND cookies
    # Response body: For bot clients (bot needs tokens for API calls)
    # httpOnly cookies: For web clients (secure browser-based auth)
    user_response = UserResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        photo_url=user.photo_url,
        is_admin=user.is_admin,
    )

    return AuthResponse(
        user=user_response,
        message="Authentication successful",
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
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
        User.id == user_id
    )
    user_result = await session.execute(user_statement)
    user = user_result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found - Account may have been deleted"
        )

    # Step 6: Generate new access token (using telegram_id for SCD Type 2 compatibility)
    new_access_token = create_access_token(user_id=user.id, telegram_id=user.telegram_id)

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
        photo_url=user.photo_url,
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


# =============================================================================
# Email Registration & Login Endpoints
# =============================================================================


@router.post(
    "/register",
    response_model=RegistrationSuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user with email",
    responses=get_common_responses(include_401=False),
    description="""
    Register a new user with email and password.

    Process:
    1. Validate email format and password strength
    2. Check if email is already in use
    3. Create user with is_active=False (requires admin activation)
    4. Create initial history record

    After registration:
    - User must wait for admin to activate their account
    - User must set up 2FA before first login

    Rate limited: 3 registrations per hour per IP.
    """,
)
@limiter.limit("3/hour")
async def register_email(
    request: Request,
    data: EmailRegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> RegistrationSuccessResponse:
    """Register new user with email/password."""
    # Step 1: Check if email already in use
    existing_user = await get_user_by_email(session, data.email)
    if existing_user:
        # Generic error to prevent email enumeration
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. Please try again or contact support."
        )

    # Step 2: Validate password strength
    is_strong, error_message = validate_password_strength(data.password)
    if not is_strong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )

    # Step 3: Create user (email-only, requires admin activation)
    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        is_admin=False,
        is_active=False,  # Requires admin activation
        two_factor_enabled=False,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Step 4: Create initial history record
    await create_initial_history(session=session, user=user, change_type="CREATE")

    return RegistrationSuccessResponse(user_id=user.id)


@router.post(
    "/login",
    response_model=EmailLoginResponse | AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Login with email and password",
    responses=get_common_responses(include_401=True),
    description="""
    Login with email and password.

    Process:
    1. Validate email and password
    2. Check if user is active (admin activated)
    3. Check if 2FA is enabled (required for email login)
    4. Create 2FA session (5-min TTL)
    5. Return session_token for 2FA verification

    Admin bypass: Admins receive direct AuthResponse with JWT tokens (skip 2FA).
    Regular users: Receive EmailLoginResponse with session_token for 2FA verification.

    Next step: POST /auth/verify-2fa with session_token and TOTP code.

    Rate limited: 5 attempts per minute per IP.
    """,
)
@limiter.limit("5/minute")
async def login_email(
    request: Request,
    response: Response,
    data: EmailLoginRequest,
    session: AsyncSession = Depends(get_session),
) -> EmailLoginResponse | AuthResponse:
    """Login with email/password, returns 2FA session token or direct auth for admin."""
    # Step 1: Authenticate with email/password (timing-safe)
    user = await authenticate_with_password(session, data.email, data.password)

    if user is None:
        logger.warning(
            f"[AUTH_EMAIL] Failed login attempt: email_hash={hash_email_for_logging(data.email)}, "
            f"reason=invalid_credentials, "
            f"ip={request.client.host if request.client else 'unknown'}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Step 2: Check if user is active
    if not user.is_active:
        logger.warning(
            f"[AUTH_EMAIL] Inactive user login attempt: user_id={user.id}, "
            f"email_hash={hash_email_for_logging(data.email)}, "
            f"ip={request.client.host if request.client else 'unknown'}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending activation. Please contact administrator."
        )

    # ========================================================================
    # ADMIN BYPASS: Skip 2FA for admin users (SECURITY EXCEPTION)
    # ========================================================================
    if user.is_admin:
        logger.info(
            f"[AUTH_EMAIL] Admin login bypass: user_id={user.id}, "
            f"bypassing 2FA requirement, "
            f"ip={request.client.host if request.client else 'unknown'}"
        )

        # Generate JWT tokens directly (skip 2FA session)
        access_token = create_access_token(
            user_id=user.id,
            telegram_id=user.telegram_id
        )
        refresh_token, refresh_expires = create_refresh_token(user_id=user.id)
        refresh_token_hash = hash_token(refresh_token)

        # Store refresh token in database
        db_refresh_token = RefreshToken(
            user_id=user.id,
            token_hash=refresh_token_hash,
            expires_at=refresh_expires,
        )
        session.add(db_refresh_token)

        # Update last login timestamp
        user.last_login_at = datetime.utcnow()
        user.updated_at = datetime.utcnow()
        session.add(user)

        await session.commit()

        # Set JWT cookies (same as /verify-2fa endpoint)
        secure_cookie = settings.APP_ENV == "production" and settings.SSL_TYPE != "none"
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=secure_cookie,
            samesite="lax",
            max_age=60 * 60 * 24 * 7,  # 7 days
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=secure_cookie,
            samesite="lax",
            max_age=60 * 60 * 24 * 30,  # 30 days
        )

        logger.info(
            f"[AUTH_EMAIL] Admin login successful: user_id={user.id}, "
            f"email={data.email}, 2FA bypassed"
        )

        # Check if user has WebAuthn credentials
        from backend.app.models.webauthn_credential import WebAuthnCredential
        has_webauthn = await session.scalar(
            select(func.count(WebAuthnCredential.id))
            .where(
                WebAuthnCredential.user_id == user.id,
                WebAuthnCredential.is_revoked == False  # noqa: E712
            )
        )

        # Return AuthResponse (tokens included)
        user_response = UserResponse(
            id=user.id,
            telegram_id=user.telegram_id,
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            photo_url=user.photo_url,
            is_admin=user.is_admin,
            is_active=user.is_active,
            two_factor_enabled=user.two_factor_enabled,
            has_webauthn_credentials=bool(has_webauthn),
        )

        return AuthResponse(
            user=user_response,
            message="Admin authentication successful (2FA bypassed)",
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
        )

    # ========================================================================
    # REGULAR USER FLOW: Require 2FA (existing logic, no changes)
    # ========================================================================

    logger.info(
        f"[AUTH_EMAIL] Regular user login: user_id={user.id}, "
        f"2FA required"
    )

    # Step 3: Create 2FA session (5-min TTL)
    session_token = await create_2fa_session(session, user.id)

    # Step 4: Check if 2FA is enabled
    if not user.two_factor_enabled:
        # User needs to set up 2FA first - generate TOTP secret
        totp_secret = generate_secret()
        totp_uri = get_totp_uri(totp_secret, user.email)

        # Store temporary secret in session for later verification
        # We'll validate and save it when user completes setup
        # For now, we pass it to the frontend (will be stored in the next step)

        return EmailLoginResponse(
            requires_2fa=False,
            requires_2fa_setup=True,
            session_token=session_token,
            expires_in=300,
            totp_secret=totp_secret,
            totp_uri=totp_uri,
        )

    # User has 2FA enabled - requires verification
    return EmailLoginResponse(
        requires_2fa=True,
        requires_2fa_setup=False,
        session_token=session_token,
        expires_in=300,
    )


@router.post(
    "/verify-2fa",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify 2FA code and complete login",
    responses=get_common_responses(include_401=True),
    description="""
    Verify TOTP code and complete email login.

    Process:
    1. Validate session_token (from /auth/login)
    2. Verify TOTP code or backup code
    3. Mark session as consumed (single-use)
    4. Generate JWT access and refresh tokens
    5. Set tokens in httpOnly cookies

    Accepts:
    - TOTP code: 6 digits from authenticator app
    - Backup code: XXXX-XXXX format (one-time use)

    Rate limited: 5 attempts per minute per IP.
    """,
)
@limiter.limit("5/minute")
async def verify_2fa(
    request: Request,
    response: Response,
    data: TwoFactorVerifyRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    """Verify 2FA code and complete login."""
    # Step 1: Verify session token
    user_id = await verify_2fa_session(session, data.session_token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please login again."
        )

    # Step 2: Load user
    user = await get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Step 3: Verify TOTP or backup code
    code = data.code.strip()
    is_valid = False

    # Try TOTP code first (6 digits)
    if code.isdigit() and len(code) == 6:
        if user.two_factor_secret:
            is_valid = verify_totp(user.two_factor_secret, code)
    else:
        # Try backup code
        if user.backup_codes:
            is_valid, new_backup_codes = verify_backup_code(code, user.backup_codes)
            if is_valid:
                # Update backup codes (remove used one)
                user.backup_codes = new_backup_codes
                session.add(user)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA code"
        )

    # Step 4: Consume 2FA session (single-use)
    await consume_2fa_session(session, data.session_token)

    # Step 5: Generate JWT tokens
    access_token = create_access_token(user_id=user.id, telegram_id=user.telegram_id)
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

    # Step 7: Set JWT cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,  # 30 days
    )

    # Step 8: Return user data
    user_response = UserResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        photo_url=user.photo_url,
        is_admin=user.is_admin,
        is_active=user.is_active,
        two_factor_enabled=user.two_factor_enabled,
    )

    return AuthResponse(
        user=user_response,
        message="Authentication successful",
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


# =============================================================================
# Two-Factor Authentication (2FA) Initial Setup (during login)
# =============================================================================


@router.post(
    "/setup-and-verify-2fa",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Set up 2FA and complete login (first-time setup)",
    responses=get_common_responses(include_401=True),
    description="""
    Set up 2FA for the first time and complete login.

    Used when user logs in with email/password but doesn't have 2FA enabled yet.

    Process:
    1. Validate session_token (from /auth/login)
    2. Verify TOTP code matches provided secret
    3. Save TOTP secret and enable 2FA for user
    4. Generate backup codes
    5. Consume session (single-use)
    6. Generate JWT tokens and set cookies

    Rate limited: 5 attempts per minute per IP.
    """,
)
@limiter.limit("5/minute")
async def setup_and_verify_2fa(
    request: Request,
    response: Response,
    data: TwoFactorSetupAndVerifyRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    """Set up 2FA and complete login for first-time users."""
    # Step 1: Verify session token
    user_id = await verify_2fa_session(session, data.session_token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please login again."
        )

    # Step 2: Load user
    user = await get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Step 3: Check if user already has 2FA enabled
    if user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is already enabled. Use /verify-2fa instead."
        )

    # Step 4: Verify TOTP code with provided secret
    code = data.code.strip()
    if not code.isdigit() or len(code) != 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code format. Must be 6 digits."
        )

    if not verify_totp(data.totp_secret, code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA code. Please try again."
        )

    # Step 5: Enable 2FA for user
    user.two_factor_secret = data.totp_secret
    user.two_factor_enabled = True

    # Step 6: Generate backup codes
    plain_codes, hashed_codes_json = generate_backup_codes()
    user.backup_codes = hashed_codes_json
    session.add(user)

    # Step 7: Consume 2FA session
    await consume_2fa_session(session, data.session_token)

    # Step 8: Generate JWT tokens
    access_token = create_access_token(user_id=user.id, telegram_id=user.telegram_id)
    refresh_token, refresh_expires = create_refresh_token(user_id=user.id)
    refresh_token_hash = hash_token(refresh_token)

    # Step 9: Store refresh token in database
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_hash,
        expires_at=refresh_expires,
    )
    session.add(db_refresh_token)
    await session.commit()

    # Step 10: Set JWT cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,  # 30 days
    )

    # Step 11: Return user data with backup codes
    user_response = UserResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        photo_url=user.photo_url,
        is_admin=user.is_admin,
        is_active=user.is_active,
        two_factor_enabled=user.two_factor_enabled,
    )

    return AuthResponse(
        user=user_response,
        message="2FA enabled successfully. Save your backup codes!",
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        backup_codes=plain_codes,
    )


# =============================================================================
# Two-Factor Authentication (2FA) Setup Endpoints (authenticated users)
# =============================================================================


@router.post(
    "/setup-2fa",
    response_model=TwoFactorSetupResponse,
    status_code=status.HTTP_200_OK,
    summary="Start 2FA setup",
    responses=get_common_responses(include_401=True),
    description="""
    Start 2FA setup process.

    Process:
    1. Generate TOTP secret
    2. Generate QR code URI
    3. Store secret temporarily (not activated yet)
    4. Return secret and QR URI

    Next step: POST /auth/verify-2fa-setup with code from authenticator.

    Requires: Authenticated user (via JWT cookie).
    """,
)
async def setup_2fa(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TwoFactorSetupResponse:
    """Start 2FA setup, returns secret and QR code URI."""
    # Get current user from request.state (set by JWT middleware)
    # Use user_id which is always set for both Telegram and email users
    if not hasattr(request.state, 'user_id'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    # Load user by user_id (works for both Telegram and email-only users)
    user_id = request.state.user_id
    user = await get_user_by_id(session, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Check if user has email set (required for 2FA)
    if not user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email required. Please add email before setting up 2FA."
        )

    # Check if user has password set (required for 2FA)
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password required. Please set password before setting up 2FA."
        )

    # Generate new TOTP secret
    secret = generate_secret()

    # Store secret temporarily (will be activated after verification)
    user.two_factor_secret = secret
    user.two_factor_enabled = False  # Not activated yet
    session.add(user)
    await session.commit()

    # Generate QR code URI
    qr_uri = get_totp_uri(secret, user.email, "Family Budget")

    return TwoFactorSetupResponse(
        secret=secret,
        qr_uri=qr_uri,
    )


@router.post(
    "/verify-2fa-setup",
    response_model=TwoFactorSetupCompleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Complete 2FA setup",
    responses=get_common_responses(include_401=True),
    description="""
    Complete 2FA setup by verifying TOTP code.

    Process:
    1. Verify TOTP code from authenticator
    2. Activate 2FA for user
    3. Generate backup codes
    4. Return backup codes (show only once!)

    Requires: Authenticated user + 2FA secret already set.
    """,
)
async def verify_2fa_setup(
    request: Request,
    data: TwoFactorVerifySetupRequest,
    session: AsyncSession = Depends(get_session),
) -> TwoFactorSetupCompleteResponse:
    """Complete 2FA setup, returns backup codes."""
    # Get current user by user_id (works for both Telegram and email-only users)
    if not hasattr(request.state, 'user_id'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    user_id = request.state.user_id
    user = await get_user_by_id(session, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Check if 2FA secret is set
    if not user.two_factor_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA not initiated. Please call /auth/setup-2fa first."
        )

    # Verify TOTP code
    if not verify_totp(user.two_factor_secret, data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code. Please check your authenticator app."
        )

    # Generate backup codes
    plain_codes, hashed_codes_json = generate_backup_codes()

    # Activate 2FA
    user.two_factor_enabled = True
    user.backup_codes = hashed_codes_json
    session.add(user)
    await session.commit()

    return TwoFactorSetupCompleteResponse(
        backup_codes=plain_codes,
        remaining_codes=len(plain_codes),
    )


@router.post(
    "/disable-2fa",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Disable 2FA",
    responses=get_common_responses(include_401=True),
    description="""
    Disable two-factor authentication.

    Requires current password and TOTP code for security.

    WARNING: This reduces account security.
    """,
)
async def disable_2fa(
    request: Request,
    data: TwoFactorDisableRequest,
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """Disable 2FA for current user."""
    # Get current user by user_id (works for both Telegram and email-only users)
    if not hasattr(request.state, 'user_id'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    user_id = request.state.user_id
    user = await get_user_by_id(session, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Verify password
    if not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )

    # Verify TOTP code
    if not user.two_factor_secret or not verify_totp(user.two_factor_secret, data.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA code"
        )

    # Disable 2FA
    user.two_factor_enabled = False
    user.two_factor_secret = None
    user.backup_codes = None
    session.add(user)
    await session.commit()

    return MessageResponse(message="2FA disabled successfully")


@router.post(
    "/backup-codes",
    response_model=BackupCodesResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate new backup codes",
    responses=get_common_responses(include_401=True),
    description="""
    Generate new backup codes.

    Old backup codes are invalidated when new ones are generated.

    Requires: Authenticated user with 2FA enabled.
    """,
)
async def regenerate_backup_codes(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> BackupCodesResponse:
    """Generate new backup codes, invalidating old ones."""
    # Get current user by user_id (works for both Telegram and email-only users)
    if not hasattr(request.state, 'user_id'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    user_id = request.state.user_id
    user = await get_user_by_id(session, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA not enabled"
        )

    # Generate new backup codes
    plain_codes, hashed_codes_json = generate_backup_codes()

    # Save to database (old codes are replaced)
    user.backup_codes = hashed_codes_json
    session.add(user)
    await session.commit()

    return BackupCodesResponse(backup_codes=plain_codes)


# =============================================================================
# Email & Password Management Endpoints
# =============================================================================


@router.post(
    "/add-email",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Add email to Telegram account",
    responses=get_common_responses(include_401=True),
    description="""
    Add email to existing Telegram account.

    Allows Telegram users to add email for alternative login method.

    Requires: Authenticated user (via Telegram).
    """,
)
async def add_email_endpoint(
    request: Request,
    data: AddEmailRequest,
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """Add email to current user account."""
    # Get current user by user_id (works for both Telegram and email-only users)
    if not hasattr(request.state, 'user_id'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    user_id = request.state.user_id
    user = await get_user_by_id(session, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Add email
    success = await add_email_to_user(session, user, data.email)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already in use by another account"
        )

    return MessageResponse(message="Email added successfully")


@router.post(
    "/set-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Set or change password",
    responses=get_common_responses(include_401=True),
    description="""
    Set or change password.

    Requires email to be set first.

    Requires: Authenticated user.
    """,
)
async def set_password_endpoint(
    request: Request,
    data: SetPasswordRequest,
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """Set or change password for current user."""
    # Get current user by user_id (works for both Telegram and email-only users)
    if not hasattr(request.state, 'user_id'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    user_id = request.state.user_id
    user = await get_user_by_id(session, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Check if email is set
    if not user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email required. Please add email first."
        )

    # Validate password strength
    is_strong, error_message = validate_password_strength(data.password)
    if not is_strong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )

    # Set password
    await set_user_password(session, user, data.password)

    return MessageResponse(message="Password set successfully")


@router.post(
    "/link-telegram",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Link Telegram to email account",
    responses=get_common_responses(include_401=True),
    description="""
    Link Telegram account to existing email user.

    Validates Telegram OAuth data and links to current user.

    Requires: Authenticated user (via email).
    """,
)
@limiter.limit("10/minute")
async def link_telegram_endpoint(
    request: Request,
    data: LinkTelegramRequest,
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """Link Telegram to current user account."""
    # Get current user by user_id (works for both Telegram and email-only users)
    if not hasattr(request.state, 'user_id'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    user_id = request.state.user_id
    user = await get_user_by_id(session, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Check if user already has Telegram linked
    if user.telegram_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram already linked to this account"
        )

    # Validate Telegram auth data
    from backend.app.services.telegram_auth import validate_telegram_auth

    auth_data = {
        "id": data.id,
        "first_name": data.first_name,
        "last_name": data.last_name,
        "username": data.username,
        "photo_url": data.photo_url,
        "auth_date": data.auth_date,
        "hash": data.hash,
    }

    if not validate_telegram_auth(auth_data):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram authentication data"
        )

    # Check if this Telegram ID is already linked to another account
    existing_user = await get_user_by_telegram_id(session, data.id)
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This Telegram account is already linked to another user"
        )

    # Link Telegram to user
    success = await link_telegram_to_user(
        session=session,
        user=user,
        telegram_id=data.id,
        username=data.username,
        first_name=data.first_name,
        last_name=data.last_name,
        photo_url=data.photo_url,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to link Telegram account"
        )

    return MessageResponse(message="Telegram linked successfully")


@router.get(
    "/methods",
    response_model=AuthMethodsResponse,
    status_code=status.HTTP_200_OK,
    summary="Check available authentication methods",
    responses={
        404: {"description": "User not found"},
    },
    description="""
    Check available authentication methods for a user.

    Used in identifier-first login flow to determine which auth methods
    are available (Telegram OAuth, Email+Password, WebAuthn biometric).

    Public endpoint (no authentication required).

    Query Parameters:
        identifier: Email or username

    Returns:
        methods:
            telegram: bool - Telegram OAuth available
            email_password: bool - Email+Password available
            webauthn: bool - WebAuthn biometric available
            webauthn_credentials: list - WebAuthn credentials (if webauthn=true)
    """,
)
async def check_auth_methods(
    identifier: str,
    session: AsyncSession = Depends(get_session),
) -> AuthMethodsResponse:
    """Check available authentication methods for user."""
    logger.info(f"[AUTH_METHODS] Checking methods for identifier_hash: {hash_email_for_logging(identifier)}")

    # Try to find user by email first
    user = await get_user_by_email(session, identifier)

    # If not found by email, try by username (for Telegram users)
    if user is None:
        stmt = select(User).where(User.username == identifier)
        result = await session.exec(stmt)
        user = result.first()

    if user is None:
        logger.warning(f"[AUTH_METHODS] User not found: identifier_hash={hash_email_for_logging(identifier)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check available methods
    has_telegram = user.telegram_id is not None
    has_password = user.password_hash is not None
    logger.debug(
        f"[AUTH_METHODS] User found: user_id={user.id}, "
        f"has_telegram={has_telegram}, has_password={has_password}"
    )

    # Check for WebAuthn credentials
    stmt = select(WebAuthnCredential).where(
        WebAuthnCredential.user_id == user.id,
        WebAuthnCredential.is_revoked == False,  # noqa: E712
    ).order_by(WebAuthnCredential.created_at.desc())
    result = await session.exec(stmt)
    credentials = result.all()

    has_webauthn = len(credentials) > 0
    logger.debug(f"[AUTH_METHODS] WebAuthn credentials: {len(credentials)}")

    # Build response
    webauthn_credentials_list = [
        WebAuthnCredentialInfo(
            credential_id=cred.credential_id,
            device_name=cred.device_name,
            created_at=cred.created_at,
            last_used_at=cred.last_used_at,
        )
        for cred in credentials
    ]

    logger.info(
        f"[AUTH_METHODS] Methods available: telegram={has_telegram}, "
        f"email_password={has_password}, webauthn={has_webauthn}"
    )

    return AuthMethodsResponse(
        methods=AuthMethodsResponse.MethodsData(
            telegram=has_telegram,
            email_password=has_password,
            webauthn=has_webauthn,
            webauthn_credentials=webauthn_credentials_list,
        )
    )


# =============================================================================
# WebAuthn Status Check (for onboarding flow)
# =============================================================================


@router.get(
    "/webauthn-status",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Check WebAuthn registration status",
    responses=get_common_responses(include_401=True),
    description="""
    Check if current user has registered WebAuthn biometric credentials.
    
    Used for onboarding flow after successful login:
    - If has_credentials=False → show onboarding modal
    - If has_credentials=True → skip onboarding
    
    Requires: JWT authentication
    """,
)
async def webauthn_status(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Check if user has WebAuthn credentials for onboarding flow."""
    logger.info(
        f"[AUTH][WEBAUTHN_STATUS] Status check requested: "
        f"user_id={current_user.id}, email={current_user.email}"
    )

    has_credentials = await user_has_webauthn_credentials(session, current_user.id)

    logger.info(
        f"[AUTH][WEBAUTHN_STATUS] Status result: "
        f"user_id={current_user.id}, has_credentials={has_credentials}"
    )

    return {
        "has_credentials": has_credentials,
        "user_id": current_user.id,
    }
