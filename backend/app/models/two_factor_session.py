"""
Two-Factor Authentication Session model.

This module defines the TwoFactorSession model that stores temporary sessions
between password verification and 2FA code entry. Sessions have a 5-minute TTL
and are single-use (consumed after successful 2FA verification).

Security Features:
    - Token stored as SHA-256 hash (never plain text)
    - 5-minute TTL (expires_at field)
    - Single-use (used flag prevents replay attacks)
    - Cascade delete when user is deleted

Flow:
    1. User enters email + password (POST /auth/login)
    2. If valid, create TwoFactorSession (5-min TTL)
    3. Return session_token to client
    4. User enters TOTP code + session_token (POST /auth/verify-2fa)
    5. Verify session is valid (not expired, not used)
    6. Verify TOTP code against user's two_factor_secret
    7. Mark session as used, issue JWT tokens

Table: t_2fa_session
"""
from typing import Optional

from datetime import datetime

from sqlalchemy import Index
from sqlmodel import Field, SQLModel


class TwoFactorSession(SQLModel, table=True):
    """
    Temporary session for 2FA verification.

    Stores hashed session tokens between password verification and 2FA code entry.
    Sessions expire after 5 minutes and are single-use.

    Table: t_2fa_session

    Attributes:
        id: Primary key (auto-increment)
        user_id: Foreign key to t_d_user.id (cascade delete)
        token_hash: SHA-256 hash of session token (unique, for lookup)
        created_at: Session creation timestamp
        expires_at: Session expiration timestamp (created_at + 5 min)
        used: Whether session has been consumed (single-use)

    Security Considerations:
        - Token is generated client-side and stored as SHA-256 hash
        - Original token is returned to client, hash is stored in DB
        - Verification: hash(client_token) == stored_hash
        - TTL of 5 minutes limits attack window
        - used=True prevents session replay

    Examples:
        # Create session after password verification
        >>> import secrets
        >>> import hashlib
        >>> token = secrets.token_urlsafe(32)  # 256 bits of entropy
        >>> token_hash = hashlib.sha256(token.encode()).hexdigest()
        >>> session = TwoFactorSession(
        ...     user_id=user.id,
        ...     token_hash=token_hash,
        ...     created_at=datetime.utcnow(),
        ...     expires_at=datetime.utcnow() + timedelta(minutes=5),
        ... )
        >>> # Return 'token' to client, store 'session' in DB

        # Verify session
        >>> incoming_hash = hashlib.sha256(client_token.encode()).hexdigest()
        >>> session = await session.exec(
        ...     select(TwoFactorSession)
        ...     .where(TwoFactorSession.token_hash == incoming_hash)
        ...     .where(TwoFactorSession.used == False)
        ...     .where(TwoFactorSession.expires_at > datetime.utcnow())
        ... ).first()
        >>> if session:
        ...     session.used = True
        ...     await session.commit()
    """

    __tablename__ = "t_2fa_session"

    # Database indexes
    __table_args__ = (
        # Index for cleanup job (find expired sessions)
        Index(
            "ix_t_2fa_session_expires_at",
            "expires_at",
        ),
    )

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Auto-increment primary key"
    )

    # Foreign key to User (cascade delete)
    user_id: int = Field(
        foreign_key="t_d_user.id",
        nullable=False,
        index=True,
        description="Reference to user who initiated 2FA flow"
    )

    # Token hash (SHA-256 of the actual token)
    token_hash: str = Field(
        max_length=64,  # SHA-256 hex digest = 64 characters
        nullable=False,
        unique=True,
        index=True,
        description="SHA-256 hash of session token (for secure lookup)"
    )

    # Timestamps
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Session creation timestamp"
    )

    expires_at: datetime = Field(
        nullable=False,
        description="Session expiration timestamp (created_at + 5 min)"
    )

    # Single-use flag
    used: bool = Field(
        default=False,
        nullable=False,
        description="Whether session has been consumed (prevents replay)"
    )

    def __repr__(self) -> str:
        """String representation of TwoFactorSession model."""
        return (
            f"TwoFactorSession(id={self.id}, user_id={self.user_id}, "
            f"expires_at={self.expires_at}, used={self.used})"
        )

    def is_valid(self) -> bool:
        """
        Check if session is still valid (not expired, not used).

        Returns:
            bool: True if session can be used for 2FA verification
        """
        return not self.used and self.expires_at > datetime.utcnow()
