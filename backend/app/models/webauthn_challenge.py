"""
WebAuthn Challenge model for temporary challenge storage.

This module defines the WebAuthnChallenge model that stores temporary
cryptographic challenges used during WebAuthn registration and authentication.

Table: t_f_webauthn_challenge
Pattern: Fact table for temporary challenge data (ephemeral)

Challenge Types:
    - registration: Challenge for credential enrollment (requires JWT auth)
    - authentication: Challenge for login (public endpoint, identifier-first)

Lifecycle:
    1. Challenge created → stored with 10-minute TTL
    2. Challenge consumed → marked with consumed_at timestamp
    3. Challenge expires → deleted by hourly cleanup job

Security:
    - Single-use: consumed_at prevents replay attacks
    - Time-limited: expires_at enforces 10-minute TTL
    - User-scoped: user_id links challenge to specific user (nullable for auth)
    - IP tracking: ip_address for audit trail

Attributes:
    id: Surrogate primary key
    challenge: Base64URL-encoded challenge (unique)
    user_id: Foreign key to t_d_user (nullable for authentication challenges)
    challenge_type: 'registration' or 'authentication'
    created_at: Challenge creation timestamp
    expires_at: Challenge expiration (10-minute TTL)
    consumed_at: Challenge consumption timestamp (single-use)
    ip_address: Client IP address for audit
    user_agent: Client user agent string for audit
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, Index
from sqlmodel import Field, SQLModel


class WebAuthnChallenge(SQLModel, table=True):
    """
    WebAuthn Challenge fact table for temporary challenge storage.

    Stores cryptographic challenges with 10-minute TTL and single-use enforcement.
    Cleaned up hourly by scheduler job.

    Examples:
        # Create registration challenge (user logged in)
        >>> challenge = WebAuthnChallenge(
        ...     challenge="base64url_random_32_bytes",
        ...     user_id=123,
        ...     challenge_type="registration",
        ...     expires_at=datetime.utcnow() + timedelta(minutes=10),
        ...     ip_address="192.168.1.100",
        ...     user_agent="Mozilla/5.0..."
        ... )

        # Create authentication challenge (public endpoint)
        >>> challenge = WebAuthnChallenge(
        ...     challenge="base64url_random_32_bytes",
        ...     user_id=None,  # User not yet identified
        ...     challenge_type="authentication",
        ...     expires_at=datetime.utcnow() + timedelta(minutes=10),
        ...     ip_address="192.168.1.100",
        ...     user_agent="Mozilla/5.0..."
        ... )

        # Consume challenge (single-use)
        >>> challenge.consumed_at = datetime.utcnow()
        >>> await session.commit()
    """

    __tablename__ = "t_f_webauthn_challenge"

    # Database constraints
    __table_args__ = (
        # Enforce valid challenge types
        CheckConstraint(
            "challenge_type IN ('registration', 'authentication')",
            name="chk_webauthn_challenge_type"
        ),
        # Index for efficient expiry cleanup
        Index(
            "ix_webauthn_challenge_expires_at",
            "expires_at"
        ),
    )

    # Primary key
    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Challenge data
    challenge: str = Field(
        max_length=255,
        nullable=False,
        unique=True,
        description="Base64URL-encoded cryptographic challenge (32 bytes = ~43 chars)"
    )

    # User association (nullable for authentication challenges)
    user_id: int | None = Field(
        default=None,
        foreign_key="t_d_user.id",
        nullable=True,
        description="User ID (NULL for authentication challenges, CASCADE on delete)"
    )

    # Challenge metadata
    challenge_type: str = Field(
        max_length=20,
        nullable=False,
        description="Challenge type: 'registration' or 'authentication'"
    )

    # Timestamps
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Challenge creation timestamp"
    )

    expires_at: datetime = Field(
        nullable=False,
        description="Challenge expiration timestamp (10-minute TTL)"
    )

    consumed_at: datetime | None = Field(
        default=None,
        nullable=True,
        description="Challenge consumption timestamp (single-use enforcement)"
    )

    # Audit metadata
    ip_address: str | None = Field(
        default=None,
        max_length=45,  # IPv6 max length
        description="Client IP address for audit trail"
    )

    user_agent: str | None = Field(
        default=None,
        description="Client user agent string for audit trail"
    )

    def __repr__(self) -> str:
        """String representation of WebAuthnChallenge model."""
        return (
            f"WebAuthnChallenge(id={self.id}, challenge={self.challenge[:20]}..., "
            f"user_id={self.user_id}, type={self.challenge_type}, "
            f"expires_at={self.expires_at}, consumed={self.consumed_at is not None})"
        )
