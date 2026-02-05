"""
WebAuthn service for biometric authentication.

This module provides comprehensive WebAuthn functionality including:
- Challenge generation and validation
- Credential registration and verification
- Authentication and JWT token issuance
- Audit logging and security enforcement

Security features:
- Challenge expiry (10 minutes)
- Single-use challenges (replay protection)
- Sign count validation (cloned credential detection)
- Origin validation (phishing prevention)
- Comprehensive audit trail

Usage:
    >>> # Registration
    >>> options = await create_registration_challenge(session, user, ip, user_agent)
    >>> credential = await verify_and_store_credential(
    ...     session, user, challenge, credential_data, device_name, ip, user_agent
    ... )

    >>> # Authentication
    >>> options = await create_authentication_challenge(session, identifier)
    >>> user, access_token, refresh_token = await verify_authentication_and_issue_tokens(
    ...     session, challenge, credential_data, ip, user_agent
    ... )
"""
import base64
import logging
import secrets
from datetime import datetime, timedelta

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

# Import broadcast function (avoid circular import by importing at call site)
# from backend.app.api.v1.endpoints.budget_ws import broadcast_webauthn_credential_compromised
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.cose import COSEAlgorithmIdentifier
from webauthn.helpers.structs import (
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    AuthenticatorTransport,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from backend.app.core.config import get_settings
from backend.app.core.json_utils import loads as json_loads
from backend.app.models.user import User
from backend.app.models.webauthn_audit_log import WebAuthnAuditLog
from backend.app.models.webauthn_challenge import WebAuthnChallenge
from backend.app.models.webauthn_credential import WebAuthnCredential
from backend.app.services.jwt import create_access_token, create_refresh_token

logger = logging.getLogger(__name__)
settings = get_settings()

# Challenge configuration
CHALLENGE_TTL_MINUTES = 10
CHALLENGE_BYTES = 32  # 32 bytes = 256 bits


async def create_registration_challenge(
    session: AsyncSession,
    user: User,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict:
    """
    Generate WebAuthn registration challenge for credential enrollment.

    Creates cryptographic challenge with 10-minute TTL and stores in database.
    Challenge is single-use (marked consumed after successful verification).

    Args:
        session: Database session
        user: User requesting credential registration
        ip_address: Client IP address for audit
        user_agent: Client user agent for audit

    Returns:
        dict: PublicKeyCredentialCreationOptions (ready for navigator.credentials.create())

    Raises:
        ValueError: If user is invalid or registration not allowed

    Example:
        >>> options = await create_registration_challenge(session, user)
        >>> # Frontend: navigator.credentials.create({publicKey: options})
    """
    logger.info(
        f"[WEBAUTHN_SERVICE] Creating registration challenge: "
        f"user_id={user.id}, email={user.email}"
    )

    # Generate cryptographic challenge (32 bytes)
    # CRITICAL: Use SAME challenge for both WebAuthn library and database storage
    challenge_bytes = secrets.token_bytes(CHALLENGE_BYTES)
    challenge_base64url = base64.urlsafe_b64encode(challenge_bytes).decode('utf-8').rstrip('=')
    expires_at = datetime.utcnow() + timedelta(minutes=CHALLENGE_TTL_MINUTES)

    # Create challenge record with Base64URL-encoded challenge
    challenge_record = WebAuthnChallenge(
        challenge=challenge_base64url,  # Base64URL (same as sent to frontend)
        user_id=user.id,
        challenge_type="registration",
        expires_at=expires_at,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    session.add(challenge_record)
    await session.commit()
    await session.refresh(challenge_record)

    logger.debug(
        f"[WEBAUTHN_SERVICE] Challenge stored: expires_at={expires_at}, "
        f"challenge={challenge_record.challenge[:20]}..."
    )

    # Generate WebAuthn options
    user_id_bytes = str(user.id).encode("utf-8")
    user_email = user.email or f"user_{user.id}"
    user_display_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user_email

    registration_options = generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_id=user_id_bytes,
        user_name=user_email,
        user_display_name=user_display_name,
        challenge=challenge_bytes,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,  # Platform authenticators only
            resident_key=ResidentKeyRequirement.DISCOURAGED,  # Don't store credentials on device (server-side only)
            user_verification=UserVerificationRequirement.REQUIRED,  # Require biometric/PIN
        ),
        supported_pub_key_algs=[
            COSEAlgorithmIdentifier.ECDSA_SHA_256,  # ES256 (primary)
            COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,  # RS256 (fallback)
        ],
        timeout=300000,  # 5 minutes (generous timeout for user to scan biometric)
    )

    # Convert to JSON-serializable dict
    # Note: options_to_json() returns JSON string, not dict
    options_json_str = options_to_json(registration_options)
    options_dict = json_loads(options_json_str)

    # Store challenge in options for frontend to send back
    options_dict["challenge"] = challenge_record.challenge

    logger.debug(
        f"[WEBAUTHN_SERVICE] Registration options generated: "
        f"RP ID={settings.WEBAUTHN_RP_ID}, user={user_email}"
    )

    return options_dict


async def verify_and_store_credential(
    session: AsyncSession,
    user: User,
    challenge: str,
    credential: dict,
    device_name: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> WebAuthnCredential:
    """
    Verify WebAuthn registration response and store credential.

    Validates challenge, verifies attestation, extracts public key,
    and stores credential metadata.

    Args:
        session: Database session
        user: User registering credential
        challenge: Challenge string from frontend
        credential: Credential response from navigator.credentials.create()
        device_name: User-friendly device name
        ip_address: Client IP address for audit
        user_agent: Client user agent for audit

    Returns:
        WebAuthnCredential: Newly created credential record

    Raises:
        ValueError: If challenge invalid, attestation fails, or credential exists
        HTTPException: If validation fails

    Security checks:
        - Challenge exists, not expired, not consumed
        - Challenge ownership (user_id matches)
        - clientDataJSON validation (type, challenge, origin)
        - attestationObject validation (RP ID hash, flags)
        - Public key algorithm support

    Example:
        >>> credential = await verify_and_store_credential(
        ...     session, user, challenge, credential_data, "iPhone 15 Pro"
        ... )
    """
    logger.info(
        f"[WEBAUTHN_SERVICE] Verifying registration: "
        f"user_id={user.id}, challenge={challenge[:20]}..."
    )

    # 1. Validate challenge
    challenge_record = await _validate_challenge(
        session, challenge, "registration", user.id
    )

    # 2. Verify attestation (using webauthn library)
    # CRITICAL: Decode Base64URL challenge back to original bytes
    challenge_bytes = base64.urlsafe_b64decode(challenge + '==')  # Add padding

    try:
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=challenge_bytes,  # Original bytes (not UTF-8 string!)
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
            require_user_verification=True,
        )

        logger.debug(
            f"[WEBAUTHN_SERVICE] Attestation verified: "
            f"credential_id={verification.credential_id[:20].hex()}..., "
            f"sign_count={verification.sign_count}"
        )

    except Exception as e:
        logger.error(
            f"[WEBAUTHN_SERVICE] Registration verification failed: {str(e)}"
        )
        await _log_audit_event(
            session,
            user.id,
            None,
            "registration_failure",
            ip_address,
            user_agent,
            str(e),
        )
        raise ValueError(f"Registration verification failed: {str(e)}")

    # 3. Check for duplicate credential
    # CRITICAL: Use Base64URL encoding (WebAuthn standard), NOT HEX
    credential_id_base64url = base64.urlsafe_b64encode(verification.credential_id).decode('utf-8').rstrip('=')
    existing_stmt = select(WebAuthnCredential).where(
        WebAuthnCredential.credential_id == credential_id_base64url
    )
    existing = await session.exec(existing_stmt)
    if existing.first():
        logger.warning(
            f"[WEBAUTHN_SERVICE] Credential already registered: {credential_id_base64url[:20]}..."
        )
        await _log_audit_event(
            session,
            user.id,
            credential_id_base64url,
            "registration_failure",
            ip_address,
            user_agent,
            "Credential already registered",
        )
        raise ValueError("Credential already registered")

    # 4. Store credential
    new_credential = WebAuthnCredential(
        user_id=user.id,
        credential_id=credential_id_base64url,  # Base64URL (WebAuthn standard)
        public_key=verification.credential_public_key,  # CBOR-encoded COSE key
        sign_count=verification.sign_count,
        transports=credential.get("transports", []),
        aaguid=verification.aaguid,
        device_name=device_name,
        backup_eligible=verification.credential_backed_up,
        backup_state=verification.credential_backed_up,
    )
    session.add(new_credential)

    # 5. Consume challenge
    challenge_record.consumed_at = datetime.utcnow()
    session.add(challenge_record)

    # 6. Log success
    await _log_audit_event(
        session,
        user.id,
        credential_id_base64url,
        "registration_success",
        ip_address,
        user_agent,
        None,
    )

    await session.commit()
    await session.refresh(new_credential)

    logger.info(
        f"[WEBAUTHN_SERVICE] Credential stored: "
        f"credential_id={credential_id_base64url[:20]}..., device_name={device_name}, "
        f"backup_state={new_credential.backup_state}"
    )

    return new_credential


async def create_authentication_challenge(
    session: AsyncSession,
    identifier: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict:
    """
    Generate WebAuthn authentication challenge for login.

    Creates challenge for identifier-first login flow. Looks up user
    by email/username and fetches active credentials.

    Args:
        session: Database session
        identifier: Email or username
        ip_address: Client IP address for audit
        user_agent: Client user agent for audit

    Returns:
        dict: PublicKeyCredentialRequestOptions (ready for navigator.credentials.get())

    Raises:
        ValueError: If user not found or no active credentials

    Example:
        >>> options = await create_authentication_challenge(session, "user@example.com")
        >>> # Frontend: navigator.credentials.get({publicKey: options})
    """
    logger.info(f"[WEBAUTHN_SERVICE] Creating auth challenge: identifier={identifier}")

    # 1. Find user by email or username
    user_stmt = select(User).where(
        (User.email == identifier) | (User.username == identifier)
    )
    result = await session.exec(user_stmt)
    user = result.first()

    if not user:
        logger.warning(f"[WEBAUTHN_SERVICE] User not found: {identifier}")
        raise ValueError("User not found")

    # 2. Fetch active credentials
    creds_stmt = select(WebAuthnCredential).where(
        WebAuthnCredential.user_id == user.id,
        WebAuthnCredential.is_revoked == False,  # noqa: E712
    )
    result = await session.exec(creds_stmt)
    credentials = result.all()

    if not credentials:
        logger.warning(
            f"[WEBAUTHN_SERVICE] No active credentials: user_id={user.id}"
        )
        raise ValueError("No active WebAuthn credentials found")

    logger.debug(
        f"[WEBAUTHN_SERVICE] User found: user_id={user.id}, credentials_count={len(credentials)}"
    )

    # 3. Generate challenge
    # CRITICAL: Use SAME challenge for both WebAuthn library and database storage
    challenge_bytes = secrets.token_bytes(CHALLENGE_BYTES)
    challenge_base64url = base64.urlsafe_b64encode(challenge_bytes).decode('utf-8').rstrip('=')
    expires_at = datetime.utcnow() + timedelta(minutes=CHALLENGE_TTL_MINUTES)

    challenge_record = WebAuthnChallenge(
        challenge=challenge_base64url,  # Base64URL (same as sent to frontend)
        user_id=user.id,  # Store user_id for ownership validation
        challenge_type="authentication",
        expires_at=expires_at,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    session.add(challenge_record)
    await session.commit()
    await session.refresh(challenge_record)

    logger.debug(
        f"[WEBAUTHN_SERVICE] Challenge generated: {challenge_record.challenge[:20]}... "
        f"(expires in 10 min)"
    )

    # 4. Generate WebAuthn options
    # CRITICAL: Decode Base64URL credential IDs (not HEX!)
    # CRITICAL: Convert transport strings to enum (py-webauthn requirement)
    allow_credentials = [
        PublicKeyCredentialDescriptor(
            id=base64.urlsafe_b64decode(cred.credential_id + '=='),  # Base64URL decode
            transports=[
                AuthenticatorTransport(t) for t in (cred.transports or [])
            ] if cred.transports else [],
        )
        for cred in credentials
    ]

    logger.debug(
        f"[WEBAUTHN_SERVICE] Credentials list: "
        f"{[c.credential_id[:20] for c in credentials]}"
    )

    authentication_options = generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        challenge=challenge_bytes,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.REQUIRED,
        timeout=60000,  # 1 minute (faster timeout for auth vs registration)
    )

    # Convert to JSON-serializable dict
    # Note: options_to_json() returns JSON string, not dict
    options_json_str = options_to_json(authentication_options)
    options_dict = json_loads(options_json_str)

    # Store challenge in options for frontend to send back
    options_dict["challenge"] = challenge_record.challenge

    return options_dict


async def verify_authentication_and_issue_tokens(
    session: AsyncSession,
    challenge: str,
    credential: dict,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[User, str, str]:
    """
    Verify WebAuthn authentication response and issue JWT tokens.

    Validates challenge, verifies signature, checks sign count (cloned detection),
    and generates access/refresh tokens.

    Args:
        session: Database session
        challenge: Challenge string from frontend
        credential: Credential response from navigator.credentials.get()
        ip_address: Client IP address for audit
        user_agent: Client user agent for audit

    Returns:
        tuple: (User, access_token, refresh_token)

    Raises:
        ValueError: If challenge invalid, signature fails, or credential compromised
        HTTPException: If validation fails

    Security checks:
        - Challenge exists, not expired, not consumed
        - Credential exists, not revoked
        - Credential ownership (credential.user_id == challenge.user_id)
        - clientDataJSON validation (type, challenge, origin)
        - authenticatorData validation (RP ID hash, flags)
        - **Sign count regression detection (CRITICAL)**
        - Signature verification

    Example:
        >>> user, access_token, refresh_token = await verify_authentication_and_issue_tokens(
        ...     session, challenge, credential_data
        ... )
    """
    logger.info(f"[WEBAUTHN_SERVICE] Verifying authentication: challenge={challenge[:20]}...")

    # 1. Validate challenge
    challenge_record = await _validate_challenge(
        session, challenge, "authentication", None  # user_id validated later
    )

    # 2. Load credential
    # CRITICAL: Frontend sends Base64URL credential ID (WebAuthn standard)
    credential_id_base64url = credential["id"]
    cred_stmt = select(WebAuthnCredential).where(
        WebAuthnCredential.credential_id == credential_id_base64url,
        WebAuthnCredential.is_revoked == False,  # noqa: E712
    )
    result = await session.exec(cred_stmt)
    cred = result.first()

    if not cred:
        logger.error(
            f"[WEBAUTHN_SERVICE] Credential not found or revoked: {credential_id_base64url[:20]}..."
        )
        await _log_audit_event(
            session,
            challenge_record.user_id,
            credential_id_base64url,
            "authentication_failure",
            ip_address,
            user_agent,
            "Credential not found or revoked",
        )
        raise ValueError("Credential not found or revoked")

    # 3. Verify credential ownership
    if cred.user_id != challenge_record.user_id:
        logger.critical(
            f"[WEBAUTHN_SERVICE] ⚠️ CREDENTIAL OWNERSHIP MISMATCH: "
            f"cred.user_id={cred.user_id}, challenge.user_id={challenge_record.user_id}"
        )
        await _log_audit_event(
            session,
            challenge_record.user_id,
            credential_id_base64url,
            "authentication_failure",
            ip_address,
            user_agent,
            "Credential ownership mismatch",
        )
        raise ValueError("Credential ownership mismatch")

    logger.debug(
        f"[WEBAUTHN_SERVICE] Challenge retrieved: user_id={cred.user_id}, "
        f"credential_id={credential_id_base64url[:20]}..."
    )

    # 4. Load user
    user_stmt = select(User).where(User.id == cred.user_id)
    result = await session.exec(user_stmt)
    user = result.first()

    if not user:
        logger.error(f"[WEBAUTHN_SERVICE] User not found: user_id={cred.user_id}")
        raise ValueError("User not found")

    # 5. Verify authentication (using webauthn library)
    # CRITICAL: Decode Base64URL challenge back to original bytes
    challenge_bytes = base64.urlsafe_b64decode(challenge + '==')  # Add padding

    try:
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=challenge_bytes,  # Original bytes (not UTF-8 string!)
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
            credential_public_key=cred.public_key,
            credential_current_sign_count=cred.sign_count,
            require_user_verification=True,
        )

        logger.info("[WEBAUTHN_SERVICE] Signature verification: PASSED")
        logger.debug(
            f"[WEBAUTHN_SERVICE] Sign count check: stored={cred.sign_count}, "
            f"new={verification.new_sign_count}"
        )

        # CRITICAL: Sign count regression detection (cloned credential)
        if verification.new_sign_count > 0 and verification.new_sign_count <= cred.sign_count:
            logger.critical(
                f"[WEBAUTHN_SERVICE] ⚠️ CLONED CREDENTIAL DETECTED: "
                f"user_id={user.id}, credential_id={credential_id_base64url[:20]}..., "
                f"stored_count={cred.sign_count}, new_count={verification.new_sign_count}"
            )

            # Auto-revoke credential
            cred.is_revoked = True
            cred.revoked_at = datetime.utcnow()
            session.add(cred)

            logger.info(f"[WEBAUTHN_SERVICE] Auto-revoking credential: {credential_id_base64url[:20]}...")

            # Log audit event
            await _log_audit_event(
                session,
                user.id,
                credential_id_base64url,
                "authentication_failure",
                ip_address,
                user_agent,
                f"Sign count regression detected: stored={cred.sign_count}, new={verification.new_sign_count}",
            )
            await _log_audit_event(
                session,
                user.id,
                credential_id_base64url,
                "credential_compromised",
                ip_address,
                user_agent,
                "Auto-revoked due to sign count regression (cloned credential)",
            )

            await session.commit()

            # Broadcast credential compromised event via WebSocket
            logger.debug("[WEBAUTHN_SERVICE] Broadcasting credential_compromised event")
            from backend.app.api.v1.endpoints.budget_ws import broadcast_webauthn_credential_compromised
            await broadcast_webauthn_credential_compromised(
                user_id=user.id,
                credential_id=credential_id_base64url,
                reason="sign_count_regression",
            )

            raise ValueError("Credential compromised (cloned authenticator detected)")

    except Exception as e:
        logger.error(f"[WEBAUTHN_SERVICE] Authentication verification failed: {str(e)}")
        await _log_audit_event(
            session,
            user.id,
            credential_id_base64url,
            "authentication_failure",
            ip_address,
            user_agent,
            str(e),
        )
        raise ValueError(f"Authentication verification failed: {str(e)}")

    # 6. Generate JWT tokens
    access_token = create_access_token(user_id=user.id, telegram_id=user.telegram_id or 0)
    refresh_token, refresh_expires = create_refresh_token(user_id=user.id)

    logger.info(f"[WEBAUTHN_SERVICE] JWT tokens generated: user_id={user.id}")

    # 7. Update credential metadata
    cred.sign_count = verification.new_sign_count
    cred.last_used_at = datetime.utcnow()
    session.add(cred)

    # 8. Consume challenge
    challenge_record.consumed_at = datetime.utcnow()
    session.add(challenge_record)

    # 9. Log success
    await _log_audit_event(
        session,
        user.id,
        credential_id_base64url,
        "authentication_success",
        ip_address,
        user_agent,
        None,
    )

    await session.commit()

    logger.info(
        f"[WEBAUTHN_SERVICE] Credential updated: last_used_at={cred.last_used_at}, "
        f"sign_count={cred.sign_count}"
    )
    logger.info(
        f"[WEBAUTHN_SERVICE] Auth successful: user_id={user.id}, "
        f"credential_id={credential_id_base64url[:20]}..."
    )

    return user, access_token, refresh_token


# ============================================================================
# Helper Functions
# ============================================================================


async def _validate_challenge(
    session: AsyncSession,
    challenge: str,
    challenge_type: str,
    user_id: int | None = None,
) -> WebAuthnChallenge:
    """
    Validate challenge existence, expiry, consumption, and ownership.

    Args:
        session: Database session
        challenge: Challenge string
        challenge_type: Expected challenge type
        user_id: Expected user_id (None = skip ownership check)

    Returns:
        WebAuthnChallenge: Valid challenge record

    Raises:
        ValueError: If challenge invalid, expired, consumed, or ownership mismatch
    """
    # Load challenge
    stmt = select(WebAuthnChallenge).where(WebAuthnChallenge.challenge == challenge)
    result = await session.exec(stmt)
    challenge_record = result.first()

    if not challenge_record:
        raise ValueError("Invalid challenge")

    # Check type
    if challenge_record.challenge_type != challenge_type:
        raise ValueError(
            f"Challenge type mismatch: expected {challenge_type}, got {challenge_record.challenge_type}"
        )

    # Check expiry
    if challenge_record.expires_at < datetime.utcnow():
        raise ValueError("Challenge expired")

    # Check consumption (single-use)
    if challenge_record.consumed_at:
        raise ValueError("Challenge already consumed")

    # Check ownership (if user_id provided)
    if user_id is not None and challenge_record.user_id != user_id:
        raise ValueError("Challenge ownership mismatch")

    return challenge_record


async def _log_audit_event(
    session: AsyncSession,
    user_id: int | None,
    credential_id: str | None,
    event_type: str,
    ip_address: str | None,
    user_agent: str | None,
    error_message: str | None,
) -> None:
    """
    Log WebAuthn audit event.

    Args:
        session: Database session
        user_id: User ID
        credential_id: Credential ID
        event_type: Event type (registration_success, authentication_failure, etc.)
        ip_address: Client IP address
        user_agent: Client user agent
        error_message: Error message (None for success events)
    """
    audit_log = WebAuthnAuditLog(
        user_id=user_id,
        credential_id=credential_id,
        event_type=event_type,
        ip_address=ip_address,
        user_agent=user_agent,
        error_message=error_message,
    )
    session.add(audit_log)
    # Note: Don't commit here - let caller control transaction


async def user_has_webauthn_credentials(session: AsyncSession, user_id: int) -> bool:
    """
    Check if user has any active (non-revoked) WebAuthn credentials.

    Args:
        session: Database session
        user_id: User ID

    Returns:
        bool: True if user has at least one active credential, False otherwise
    """
    stmt = (
        select(WebAuthnCredential)
        .where(
            WebAuthnCredential.user_id == user_id,
            WebAuthnCredential.is_revoked == False,  # noqa: E712
        )
        .limit(1)
    )
    result = await session.exec(stmt)
    return result.first() is not None
