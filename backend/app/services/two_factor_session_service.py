"""
Two-Factor Authentication Session Service.

This module manages temporary 2FA sessions that bridge the gap between
password verification and TOTP code entry.

Flow:
    1. User enters email + password
    2. If valid, create_session() generates a session token
    3. Token is returned to client, hash is stored in DB
    4. User enters TOTP code + session token
    5. verify_session() validates the token
    6. consume_session() marks it as used
    7. JWT tokens are issued

Security Features:
    - 5-minute TTL (short window for attacks)
    - Single-use tokens (prevents replay)
    - SHA-256 hashed storage (token never stored plain)
    - Automatic cleanup of expired sessions

Usage:
    from backend.app.services.two_factor_session_service import (
        create_session,
        verify_session,
        consume_session,
        cleanup_expired_sessions,
    )

    # After password verification
    token = await create_session(session, user_id)

    # Return token to client, then on 2FA verification
    user_id = await verify_session(session, token)
    if user_id:
        await consume_session(session, token)
        # Issue JWT tokens
"""
import hashlib
import secrets
from datetime import datetime, timedelta

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.two_factor_session import TwoFactorSession

# Session configuration
SESSION_TTL_MINUTES = 5          # Session expires after 5 minutes
SESSION_TOKEN_BYTES = 32         # 256 bits of entropy


def _hash_token(token: str) -> str:
    """
    Hash a session token using SHA-256.

    Args:
        token: Plain session token

    Returns:
        str: SHA-256 hex digest (64 characters)
    """
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session(
    session: AsyncSession,
    user_id: int,
) -> str:
    """
    Create a new 2FA session after password verification.

    Generates a secure random token, stores its hash in the database,
    and returns the plain token to be sent to the client.

    Args:
        session: Database session
        user_id: ID of the user who passed password verification

    Returns:
        str: Session token (URL-safe base64, 43 chars)

    Example:
        >>> token = await create_session(db_session, user.id)
        >>> # Return token to client
        >>> return {"session_token": token, "expires_in": 300}
    """
    # Generate secure random token
    token = secrets.token_urlsafe(SESSION_TOKEN_BYTES)
    token_hash = _hash_token(token)

    # Calculate expiration time
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=SESSION_TTL_MINUTES)

    # Create session record
    two_fa_session = TwoFactorSession(
        user_id=user_id,
        token_hash=token_hash,
        created_at=now,
        expires_at=expires_at,
        used=False,
    )

    session.add(two_fa_session)
    await session.commit()

    return token


async def verify_session(
    session: AsyncSession,
    token: str,
) -> int | None:
    """
    Verify a 2FA session token.

    Checks that the token exists, is not expired, and has not been used.
    Does NOT mark the session as used - call consume_session() after
    successful TOTP verification.

    Args:
        session: Database session
        token: Session token from client

    Returns:
        Optional[int]: User ID if session is valid, None otherwise

    Example:
        >>> user_id = await verify_session(db_session, token)
        >>> if user_id is None:
        ...     raise HTTPException(401, "Invalid or expired session")
    """
    token_hash = _hash_token(token)

    # Find session by token hash
    statement = select(TwoFactorSession).where(
        TwoFactorSession.token_hash == token_hash,
        not TwoFactorSession.used,
        TwoFactorSession.expires_at > datetime.utcnow(),
    )
    result = await session.execute(statement)
    two_fa_session = result.scalar_one_or_none()

    if two_fa_session is None:
        return None

    return two_fa_session.user_id


async def consume_session(
    session: AsyncSession,
    token: str,
) -> bool:
    """
    Mark a 2FA session as used (consumed).

    Should be called after successful TOTP verification.
    Once consumed, the session cannot be reused.

    Args:
        session: Database session
        token: Session token from client

    Returns:
        bool: True if session was found and consumed, False otherwise

    Example:
        >>> # After TOTP verification
        >>> if verify_totp(user.two_factor_secret, totp_code):
        ...     await consume_session(db_session, token)
        ...     # Issue JWT tokens
    """
    token_hash = _hash_token(token)

    # Find and update session
    statement = select(TwoFactorSession).where(
        TwoFactorSession.token_hash == token_hash,
        not TwoFactorSession.used,
    )
    result = await session.execute(statement)
    two_fa_session = result.scalar_one_or_none()

    if two_fa_session is None:
        return False

    two_fa_session.used = True
    session.add(two_fa_session)
    await session.commit()

    return True


async def cleanup_expired_sessions(
    session: AsyncSession,
) -> int:
    """
    Delete expired and used 2FA sessions.

    Should be called periodically (e.g., by a background job)
    to clean up old sessions and reduce database size.

    Args:
        session: Database session

    Returns:
        int: Number of sessions deleted

    Example:
        >>> # In a background job
        >>> deleted = await cleanup_expired_sessions(db_session)
        >>> logger.info(f"Cleaned up {deleted} expired 2FA sessions")
    """
    from sqlalchemy import delete

    # Delete sessions that are expired OR used
    # Keep unused, non-expired sessions for legitimate users
    now = datetime.utcnow()

    statement = delete(TwoFactorSession).where(
        (TwoFactorSession.expires_at < now) |
        (TwoFactorSession.used)
    )

    result = await session.execute(statement)
    await session.commit()

    return result.rowcount


async def get_session_by_user_id(
    session: AsyncSession,
    user_id: int,
) -> TwoFactorSession | None:
    """
    Get active (non-expired, non-used) session for a user.

    Useful for checking if user already has an active session
    before creating a new one.

    Args:
        session: Database session
        user_id: User ID to search for

    Returns:
        Optional[TwoFactorSession]: Active session if exists, None otherwise
    """
    statement = select(TwoFactorSession).where(
        TwoFactorSession.user_id == user_id,
        not TwoFactorSession.used,
        TwoFactorSession.expires_at > datetime.utcnow(),
    )
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def invalidate_user_sessions(
    session: AsyncSession,
    user_id: int,
) -> int:
    """
    Invalidate all active 2FA sessions for a user.

    Should be called when user changes password, disables 2FA,
    or for security reasons.

    Args:
        session: Database session
        user_id: User ID whose sessions should be invalidated

    Returns:
        int: Number of sessions invalidated

    Example:
        >>> # User changes password
        >>> await invalidate_user_sessions(db_session, user.id)
    """
    from sqlalchemy import update

    statement = (
        update(TwoFactorSession)
        .where(
            TwoFactorSession.user_id == user_id,
            not TwoFactorSession.used,
        )
        .values(used=True)
    )

    result = await session.execute(statement)
    await session.commit()

    return result.rowcount
