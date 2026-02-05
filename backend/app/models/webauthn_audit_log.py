"""
WebAuthn Audit Log model for comprehensive event tracking.

This module defines the WebAuthnAuditLog model that records all WebAuthn
registration, authentication, and revocation events for security monitoring.

Table: t_f_webauthn_audit_log
Pattern: Fact table for immutable audit trail

Event Types:
    - registration_success: Credential successfully registered
    - registration_failure: Credential registration failed
    - authentication_success: Successful login via WebAuthn
    - authentication_failure: Failed login attempt
    - credential_revoked: Credential manually revoked by user
    - credential_compromised: Credential auto-revoked (cloned detection)

Attributes:
    id: Surrogate primary key
    user_id: Foreign key to t_d_user (SET NULL on delete for audit retention)
    credential_id: Base64URL-encoded credential ID
    event_type: Event type (success/failure/revoked/compromised)
    ip_address: Client IP address
    user_agent: Client user agent string
    error_message: Error message for failed events
    created_at: Event timestamp
"""
from datetime import datetime

from sqlalchemy import Index
from sqlmodel import Field, SQLModel


class WebAuthnAuditLog(SQLModel, table=True):
    """
    WebAuthn Audit Log fact table for comprehensive event tracking.

    Immutable audit trail of all WebAuthn events (registration, authentication, revocation).
    Never deleted (user_id SET NULL on user deletion to preserve audit history).

    Examples:
        # Log successful registration
        >>> log = WebAuthnAuditLog(
        ...     user_id=123,
        ...     credential_id="base64url...",
        ...     event_type="registration_success",
        ...     ip_address="192.168.1.100",
        ...     user_agent="Mozilla/5.0...",
        ...     error_message=None
        ... )

        # Log authentication failure
        >>> log = WebAuthnAuditLog(
        ...     user_id=123,
        ...     credential_id="base64url...",
        ...     event_type="authentication_failure",
        ...     ip_address="192.168.1.100",
        ...     user_agent="Mozilla/5.0...",
        ...     error_message="Sign count regression detected (cloned credential)"
        ... )

        # Log credential compromise (auto-revoke)
        >>> log = WebAuthnAuditLog(
        ...     user_id=123,
        ...     credential_id="base64url...",
        ...     event_type="credential_compromised",
        ...     ip_address="192.168.1.100",
        ...     user_agent="Mozilla/5.0...",
        ...     error_message="Sign count regression: stored=100, new=50"
        ... )
    """

    __tablename__ = "t_f_webauthn_audit_log"

    # Database constraints
    __table_args__ = (
        # Index for time-series queries (most recent first)
        Index(
            "ix_webauthn_audit_created_at",
            "created_at",
            postgresql_ops={"created_at": "DESC"}
        ),
        # Index for filtering by event type
        Index(
            "ix_webauthn_audit_event_type",
            "event_type"
        ),
    )

    # Primary key
    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Event metadata
    user_id: int | None = Field(
        default=None,
        foreign_key="t_d_user.id",
        nullable=True,
        description="User ID (SET NULL on delete to preserve audit history)"
    )

    credential_id: str | None = Field(
        default=None,
        max_length=1024,
        description="Base64URL-encoded credential ID (nullable for registration failures)"
    )

    event_type: str = Field(
        max_length=50,
        nullable=False,
        description=(
            "Event type: registration_success, registration_failure, "
            "authentication_success, authentication_failure, "
            "credential_revoked, credential_compromised"
        )
    )

    # Client metadata
    ip_address: str | None = Field(
        default=None,
        max_length=45,  # IPv6 max length
        description="Client IP address"
    )

    user_agent: str | None = Field(
        default=None,
        description="Client user agent string"
    )

    # Error information
    error_message: str | None = Field(
        default=None,
        description="Error message for failed events (NULL for success events)"
    )

    # Timestamp
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Event timestamp"
    )

    def __repr__(self) -> str:
        """String representation of WebAuthnAuditLog model."""
        credential_preview = self.credential_id[:20] if self.credential_id else "None"
        return (
            f"WebAuthnAuditLog(id={self.id}, user_id={self.user_id}, "
            f"event_type={self.event_type}, credential={credential_preview}..., "
            f"created_at={self.created_at})"
        )
