"""
Refresh Token model for JWT authentication with rotation support.

This module defines the RefreshToken model that stores hashed refresh tokens
with expiration and revocation support for secure JWT authentication.
"""
from datetime import datetime

from sqlmodel import Field, SQLModel


class RefreshToken(SQLModel, table=True):
    """
    Refresh token storage for JWT authentication with rotation support.

    Stores hashed refresh tokens for users with expiration and revocation.
    Supports token rotation (old token revoked when used, new token generated).

    Table: t_f_refresh_token
    Pattern: Transactional fact table (NO SCD Type 2)

    Attributes:
        id: Surrogate primary key (auto-generated)
        user_id: Foreign key to t_d_user.id (token owner)
        token_hash: SHA-256 hash of refresh token (actual token NOT stored)
        expires_at: Token expiration timestamp (typically 30 days)
        is_revoked: Revocation flag (TRUE on logout or security event)
        created_at: Timestamp when token was created
        last_used_at: Last time token was used to refresh access token
        revoked_at: Timestamp when token was revoked (NULL if not revoked)

    Security Notes:
        - NEVER store actual refresh token in database
        - Store only SHA-256 hash of token
        - Actual token is only known to client (in httpOnly cookie)
        - Token rotation: old token revoked after use, new token generated
        - Revocation on logout: set is_revoked=TRUE, clear client cookies
    """

    __tablename__ = "t_f_refresh_token"

    # Primary key
    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Foreign key to user
    user_id: int = Field(
        foreign_key="t_d_user.id",
        nullable=False,
        index=True,
        description="Foreign key to user who owns this token"
    )

    # Token security
    token_hash: str = Field(
        nullable=False,
        unique=True,
        max_length=255,
        index=True,
        description="SHA-256 hash of refresh token (actual token NOT stored)"
    )

    # Token metadata
    expires_at: datetime = Field(
        nullable=False,
        index=True,
        description="Token expiration timestamp (typically 30 days)"
    )
    is_revoked: bool = Field(
        default=False,
        nullable=False,
        index=True,
        description="Revocation flag (TRUE on logout or security event)"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Timestamp when token was created"
    )
    last_used_at: datetime | None = Field(
        default=None,
        nullable=True,
        description="Last time token was used to refresh access token"
    )
    revoked_at: datetime | None = Field(
        default=None,
        nullable=True,
        description="Timestamp when token was revoked (NULL if not revoked)"
    )

    def __repr__(self) -> str:
        """String representation of RefreshToken model."""
        return (
            f"RefreshToken(id={self.id}, user_id={self.user_id}, "
            f"expires_at={self.expires_at}, is_revoked={self.is_revoked})"
        )

    def is_valid(self) -> bool:
        """
        Check if token is valid (not revoked and not expired).

        Returns:
            bool: True if token is valid and can be used
        """
        now = datetime.utcnow()
        return (
            not self.is_revoked
            and self.expires_at > now
        )

    def revoke(self) -> None:
        """
        Revoke this token (mark as revoked with timestamp).

        This is called on logout or security events.
        After revocation, token cannot be used to refresh access tokens.
        """
        self.is_revoked = True
        self.revoked_at = datetime.utcnow()

    def mark_used(self) -> None:
        """
        Update last_used_at timestamp when token is used to refresh.

        This is called each time the token is successfully used
        to generate a new access token.
        """
        self.last_used_at = datetime.utcnow()
