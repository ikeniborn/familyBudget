"""
WebAuthn biometric authentication endpoints.

This module provides REST API endpoints for WebAuthn biometric authentication
(TouchID, FaceID, Windows Hello, etc.).

Endpoints:
    POST /webauthn/register/options - Generate registration challenge
    POST /webauthn/register/verify - Verify credential registration
    POST /webauthn/authenticate/options - Generate authentication challenge
    POST /webauthn/authenticate/verify - Verify authentication and issue tokens
    GET /auth/methods - Check available authentication methods
    GET /webauthn/credentials - List user's credentials
    DELETE /webauthn/credentials/{credential_id} - Revoke credential

Security:
    - Rate limiting (5-10 req/min depending on endpoint)
    - Challenge expiry (10 minutes)
    - Single-use challenges
    - Sign count validation (cloned credential detection)
    - Origin validation (phishing prevention)
    - Comprehensive audit logging
"""
from typing import Optional

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.api.v1.endpoints.budget_ws import (
    broadcast_webauthn_credential_added,
    broadcast_webauthn_credential_revoked,
)
from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.middleware.rate_limiter import limiter
from backend.app.models.webauthn_credential import WebAuthnCredential
from backend.app.schemas.auth import AuthResponse, UserResponse
from backend.app.services.jwt import hash_token
from backend.app.services.password_service import verify_password
from backend.app.services.totp_service import verify_totp as verify_totp_code
from backend.app.services.webauthn_service import (
    create_authentication_challenge,
    create_registration_challenge,
    verify_and_store_credential,
    verify_authentication_and_issue_tokens,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webauthn", tags=["webauthn"])


# ============================================================================
# Request/Response Schemas
# ============================================================================


class WebAuthnErrorResponse(BaseModel):
    """Error response for WebAuthn operations."""

    detail: str
    error_code: Optional[str] = None


class WebAuthnValidationError(BaseModel):
    """Validation error for WebAuthn operations."""

    detail: str
    field: Optional[str] = None


class RegisterVerifyRequest(BaseModel):
    """Request body for credential registration verification."""

    challenge: str
    credential: dict
    device_name: str


class RegisterVerifyResponse(BaseModel):
    """Response for successful credential registration."""

    success: bool = True
    credential_id: str
    message: str = "Credential registered successfully"


class AuthenticateOptionsRequest(BaseModel):
    """Request body for authentication challenge generation."""

    identifier: str  # Email or username


class AuthenticateVerifyRequest(BaseModel):
    """Request body for authentication verification."""

    challenge: str
    credential: dict


class AuthMethodsResponse(BaseModel):
    """Response for available authentication methods."""

    methods: dict


class CredentialResponse(BaseModel):
    """Response for credential metadata."""

    id: int
    credential_id: str
    device_name: Optional[str]
    created_at: str
    last_used_at: Optional[str]
    backup_state: bool


class CredentialListResponse(BaseModel):
    """Response for credential list."""

    credentials: list[CredentialResponse]


class CredentialRevokeRequest(BaseModel):
    """Request body for credential revocation."""

    password: Optional[str] = None
    totp_code: Optional[str] = None


class MessageResponse(BaseModel):
    """Generic message response."""

    message: str


# ============================================================================
# Common Error Responses
# ============================================================================

webauthn_responses = {
    401: {"model": WebAuthnErrorResponse, "description": "Invalid or expired challenge"},
    403: {"model": WebAuthnErrorResponse, "description": "Forbidden (user not active, no auth method, etc.)"},
    404: {"model": WebAuthnErrorResponse, "description": "User or credential not found"},
    409: {"model": WebAuthnErrorResponse, "description": "Credential already registered"},
    422: {"model": WebAuthnValidationError, "description": "Validation error"},
    429: {"model": WebAuthnErrorResponse, "description": "Too many requests"},
}


# ============================================================================
# Endpoints
# ============================================================================


@router.post(
    "/register/options",
    responses=webauthn_responses,
    summary="Generate WebAuthn registration challenge",
)
@limiter.limit("5/minute")
async def register_options(
    request: Request,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """
    Generate WebAuthn registration challenge for credential enrollment.

    Requires: Authenticated user (JWT)
    Rate limit: 5 requests/minute
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    logger.info(
        f"[WEBAUTHN][REGISTER_OPTIONS] Registration challenge requested: "
        f"user_id={current_user.id}, email={current_user.email}, ip={ip_address}"
    )

    try:
        options = await create_registration_challenge(
            session, current_user, ip_address, user_agent
        )

        logger.info(
            f"[WEBAUTHN][REGISTER_OPTIONS] Challenge created successfully: "
            f"user_id={current_user.id}, challenge_id={options.get('challenge', 'N/A')[:16]}..."
        )

        return options
    except Exception as e:
        logger.error(
            f"[WEBAUTHN][REGISTER_OPTIONS] Failed to create challenge: "
            f"user_id={current_user.id}, error={str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate registration options: {str(e)}",
        )


@router.post(
    "/register/verify",
    response_model=RegisterVerifyResponse,
    responses=webauthn_responses,
    summary="Verify credential registration",
)
@limiter.limit("5/minute")
async def register_verify(
    request: Request,
    current_user: CurrentUser,
    data: RegisterVerifyRequest,
    session: AsyncSession = Depends(get_session),
) -> RegisterVerifyResponse:
    """
    Verify WebAuthn registration response and store credential.

    Requires: Authenticated user (JWT) + valid challenge
    Rate limit: 5 requests/minute
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    logger.info(
        f"[WEBAUTHN][REGISTER_VERIFY] Verifying registration: "
        f"user_id={current_user.id}, device_name={data.device_name}, "
        f"challenge={data.challenge[:20]}..."
    )

    try:
        credential = await verify_and_store_credential(
            session,
            current_user,
            data.challenge,
            data.credential,
            data.device_name,
            ip_address,
            user_agent,
        )

        logger.info(
            f"[WEBAUTHN][REGISTER_VERIFY] Registration successful: "
            f"user_id={current_user.id}, credential_id={credential.credential_id}, "
            f"device_name={credential.device_name}"
        )

        # Broadcast credential added event via WebSocket
        logger.debug("[WEBAUTHN][REGISTER_VERIFY] Broadcasting credential_added event via WebSocket")
        await broadcast_webauthn_credential_added(
            user_id=current_user.id,
            credential_data={
                "device_name": credential.device_name,
                "created_at": credential.created_at.isoformat(),
            }
        )

        return RegisterVerifyResponse(
            credential_id=credential.credential_id,
            message=f"Credential registered successfully as '{credential.device_name}'",
        )

    except ValueError as e:
        logger.error(
            f"[WEBAUTHN][REGISTER_VERIFY] Verification failed: "
            f"user_id={current_user.id}, error={str(e)}"
        )
        if "already registered" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e),
            )
        elif "challenge" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
    except Exception as e:
        logger.error(
            f"[WEBAUTHN][REGISTER_VERIFY] Unexpected error: "
            f"user_id={current_user.id}, error={str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration verification failed: {str(e)}",
        )


@router.post(
    "/authenticate/options",
    responses=webauthn_responses,
    summary="Generate WebAuthn authentication challenge",
)
@limiter.limit("10/minute")
async def authenticate_options(
    request: Request,
    data: AuthenticateOptionsRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """
    Generate WebAuthn authentication challenge for login.

    Public endpoint (no authentication required).
    Rate limit: 10 requests/minute

    Why POST not GET?: Creates challenge in DB (side effect). GET should be idempotent.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    logger.info(f"[WEBAUTHN] Auth options requested: identifier={data.identifier}")

    try:
        options = await create_authentication_challenge(
            session, data.identifier, ip_address, user_agent
        )
        return options
    except ValueError as e:
        logger.warning(f"[WEBAUTHN] Auth options failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"[WEBAUTHN] Auth options error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate authentication options: {str(e)}",
        )


@router.post(
    "/authenticate/verify",
    response_model=AuthResponse,
    responses=webauthn_responses,
    summary="Verify authentication and issue JWT tokens",
)
@limiter.limit("10/minute")
async def authenticate_verify(
    request: Request,
    response: Response,
    data: AuthenticateVerifyRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    """
    Verify WebAuthn authentication response and issue JWT tokens.

    Public endpoint (challenge-response validates identity).
    Rate limit: 10 requests/minute
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    logger.info(f"[WEBAUTHN] Auth verification started: challenge={data.challenge[:20]}...")

    try:
        user, access_token, refresh_token = await verify_authentication_and_issue_tokens(
            session, data.challenge, data.credential, ip_address, user_agent
        )

        # Set httpOnly cookies (same as Telegram OAuth)
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=7 * 24 * 60 * 60,  # 7 days
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=30 * 24 * 60 * 60,  # 30 days
        )

        # Store refresh token hash in database (same as Telegram OAuth)
        from datetime import datetime, timedelta

        from backend.app.models.refresh_token import RefreshToken

        refresh_token_record = RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        session.add(refresh_token_record)
        await session.commit()

        logger.info(f"[WEBAUTHN] Auth successful: user_id={user.id}")

        return AuthResponse(
            user=UserResponse(
                id=user.id,
                telegram_id=user.telegram_id,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                photo_url=user.photo_url,
                is_admin=user.is_admin,
                is_active=user.is_active,
            ),
            message="WebAuthn authentication successful",
            access_token=access_token,
            refresh_token=refresh_token,
        )

    except ValueError as e:
        logger.error(f"[WEBAUTHN] Auth verification failed: {str(e)}")
        if "challenge" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
            )
        elif "credential" in str(e).lower() or "compromised" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(e),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
    except Exception as e:
        logger.error(f"[WEBAUTHN] Auth verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication verification failed: {str(e)}",
        )


@router.get(
    "/credentials",
    response_model=CredentialListResponse,
    responses=webauthn_responses,
    summary="List user's WebAuthn credentials",
)
async def list_credentials(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> CredentialListResponse:
    """
    List WebAuthn credentials for current user.

    Requires: Authenticated user (JWT)
    """
    logger.info(
        f"[WEBAUTHN][LIST_CREDENTIALS] Listing credentials: "
        f"user_id={current_user.id}"
    )

    stmt = (
        select(WebAuthnCredential)
        .where(
            WebAuthnCredential.user_id == current_user.id,
            WebAuthnCredential.is_revoked == False,  # noqa: E712
        )
        .order_by(WebAuthnCredential.created_at.desc())
    )
    result = await session.exec(stmt)
    credentials = result.all()

    logger.info(
        f"[WEBAUTHN][LIST_CREDENTIALS] Found {len(credentials)} credentials: "
        f"user_id={current_user.id}"
    )

    return CredentialListResponse(
        credentials=[
            CredentialResponse(
                id=cred.id,
                credential_id=cred.credential_id,
                device_name=cred.device_name,
                created_at=cred.created_at.isoformat(),
                last_used_at=cred.last_used_at.isoformat() if cred.last_used_at else None,
                backup_state=cred.backup_state,
            )
            for cred in credentials
        ]
    )


@router.delete(
    "/credentials/{credential_id}",
    response_model=MessageResponse,
    responses=webauthn_responses,
    summary="Revoke WebAuthn credential",
)
async def revoke_credential(
    request: Request,
    current_user: CurrentUser,
    credential_id: str,
    data: CredentialRevokeRequest,
    session: AsyncSession = Depends(get_session),
) -> MessageResponse:
    """
    Revoke WebAuthn credential.

    Requires: Authenticated user (JWT) + password OR TOTP code

    Confirmation required:
    - Email users: password
    - Telegram-only users with 2FA: TOTP code
    - Users without password AND 2FA: Must setup one first
    """
    logger.info(
        f"[WEBAUTHN][REVOKE_CREDENTIAL] Revoke requested: "
        f"user_id={current_user.id}, credential_id={credential_id[:20]}..."
    )

    # Verification logic depends on user auth method
    if current_user.password_hash and data.password:
        logger.debug("[WEBAUTHN][REVOKE_CREDENTIAL] Verifying password for email user...")
        if not verify_password(data.password, current_user.password_hash):
            logger.warning(
                f"[WEBAUTHN][REVOKE_CREDENTIAL] Password verification failed: "
                f"user_id={current_user.id}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid password",
            )
        logger.debug("[WEBAUTHN][REVOKE_CREDENTIAL] Password verification: PASSED")

    elif current_user.two_factor_enabled and data.totp_code:
        logger.debug("[WEBAUTHN][REVOKE_CREDENTIAL] Verifying TOTP code for Telegram user...")
        if not verify_totp_code(current_user.two_factor_secret, data.totp_code):
            logger.warning(
                f"[WEBAUTHN][REVOKE_CREDENTIAL] TOTP verification failed: "
                f"user_id={current_user.id}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid TOTP code",
            )
        logger.debug("[WEBAUTHN][REVOKE_CREDENTIAL] TOTP verification: PASSED")

    else:
        logger.warning(
            f"[WEBAUTHN][REVOKE_CREDENTIAL] User has no password and no 2FA: "
            f"user_id={current_user.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Setup password or 2FA first to revoke credentials",
        )

    # Load credential
    stmt = select(WebAuthnCredential).where(
        WebAuthnCredential.credential_id == credential_id,
        WebAuthnCredential.user_id == current_user.id,
        WebAuthnCredential.is_revoked == False,  # noqa: E712
    )
    result = await session.exec(stmt)
    credential = result.first()

    if not credential:
        logger.error(
            f"[WEBAUTHN][REVOKE_CREDENTIAL] Credential not found: "
            f"user_id={current_user.id}, credential_id={credential_id[:20]}..."
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found",
        )

    # Revoke credential
    from datetime import datetime

    credential.is_revoked = True
    credential.revoked_at = datetime.utcnow()
    session.add(credential)

    # Log audit event
    from backend.app.models.webauthn_audit_log import WebAuthnAuditLog

    audit_log = WebAuthnAuditLog(
        user_id=current_user.id,
        credential_id=credential_id,
        event_type="credential_revoked",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        error_message=None,
    )
    session.add(audit_log)

    await session.commit()

    logger.info(
        f"[WEBAUTHN][REVOKE_CREDENTIAL] Credential revoked successfully: "
        f"user_id={current_user.id}, credential_id={credential_id[:20]}..., "
        f"revoked_at={credential.revoked_at}"
    )

    # Broadcast credential revoked event via WebSocket
    logger.debug("[WEBAUTHN][REVOKE_CREDENTIAL] Broadcasting credential_revoked event via WebSocket")
    await broadcast_webauthn_credential_revoked(
        user_id=current_user.id,
        credential_id=credential_id,
    )

    return MessageResponse(message="Credential revoked successfully")
