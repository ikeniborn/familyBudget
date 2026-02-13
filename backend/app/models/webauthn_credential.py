"""
WebAuthn Credential model for biometric authentication.

This module defines the WebAuthnCredential model that stores public keys
and metadata for registered WebAuthn authenticators (TouchID, FaceID, etc.).

Table: t_d_webauthn_credential
Pattern: Dimension table with credential metadata

Attributes:
    id: Surrogate primary key
    user_id: Foreign key to t_d_user (CASCADE on delete)
    credential_id: Base64URL-encoded credential ID (unique)
    public_key: CBOR-encoded COSE public key (binary)
    sign_count: Signature counter for replay detection
    transports: Supported transports (['internal', 'usb', 'nfc', 'ble'])
    aaguid: Authenticator AAID (UUID format)
    device_name: User-friendly device name
    backup_eligible: Passkey support (iCloud Keychain, Google Password Manager)
    backup_state: Currently backed up to cloud
    created_at: Credential registration timestamp
    last_used_at: Last successful authentication timestamp
    is_revoked: Revocation flag (soft delete)
    revoked_at: Revocation timestamp
"""
from datetime import datetime

from sqlalchemy import BigInteger, Column, Index, LargeBinary
from sqlmodel import Field, SQLModel


class WebAuthnCredential(SQLModel, table=True):
    """
    WebAuthn Credential dimension table.

    Stores public keys and metadata for registered WebAuthn authenticators.
    Each user can have multiple credentials (e.g., iPhone + iPad).

    Security:
        - Public key stored as BYTEA (CBOR-encoded COSE key)
        - Sign count validation detects cloned credentials
        - Soft delete via is_revoked flag (preserves audit trail)

    Examples:
        # Create new credential
        >>> credential = WebAuthnCredential(
        ...     user_id=123,
        ...     credential_id="base64url...",
        ...     public_key=b"\\x04\\xa5...",  # CBOR bytes
        ...     sign_count=0,
        ...     device_name="iPhone 15 Pro",
        ...     backup_state=True
        ... )

        # Revoke credential
        >>> credential.is_revoked = True
        >>> credential.revoked_at = datetime.utcnow()
        >>> await session.commit()
    """

    __tablename__ = "t_d_webauthn_credential"

    # Database constraints
    __table_args__ = (
        # Partial unique index for credential_id (enforced by unique=True in Field)
        # Partial index for active credentials (WHERE is_revoked = FALSE)
        Index(
            "ix_webauthn_credential_active",
            "user_id",
            postgresql_where="is_revoked = FALSE"
        ),
    )

    # Primary key
    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Foreign key to User
    user_id: int = Field(
        foreign_key="t_d_user.id",
        nullable=False,
        index=True,
        description="User ID (CASCADE on delete)"
    )

    # WebAuthn credential data
    credential_id: str = Field(
        max_length=1024,
        nullable=False,
        unique=True,
        index=True,
        description="Base64URL-encoded credential ID (unique across all users)"
    )

    public_key: bytes = Field(
        sa_column=Column(LargeBinary, nullable=False),
        description="CBOR-encoded COSE public key (binary format)"
    )

    sign_count: int = Field(
        sa_column=Column(BigInteger, nullable=False, default=0),
        description="Signature counter for replay/clone detection (BigInt for large values)"
    )

    # Authenticator metadata
    transports: list[str] | None = Field(
        default=None,
        sa_column=Column("transports", nullable=True),
        description="Supported transports as string array: ['internal', 'usb', 'nfc', 'ble']"
    )

    aaguid: str | None = Field(
        default=None,
        max_length=36,
        description="Authenticator AAID in UUID format (e.g., '00000000-0000-0000-0000-000000000000')"
    )

    device_name: str | None = Field(
        default=None,
        max_length=255,
        description="User-friendly device name (e.g., 'iPhone 15 Pro')"
    )

    # Passkey (cloud backup) metadata
    backup_eligible: bool = Field(
        default=False,
        nullable=False,
        description="Credential can be backed up to cloud (iCloud Keychain, Google Password Manager)"
    )

    backup_state: bool = Field(
        default=False,
        nullable=False,
        description="Credential is currently backed up to cloud"
    )

    # Audit timestamps
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Credential registration timestamp"
    )

    last_used_at: datetime | None = Field(
        default=None,
        nullable=True,
        description="Last successful authentication timestamp"
    )

    # Revocation (soft delete)
    is_revoked: bool = Field(
        default=False,
        nullable=False,
        description="Credential revocation flag (soft delete)"
    )

    revoked_at: datetime | None = Field(
        default=None,
        nullable=True,
        description="Credential revocation timestamp"
    )

    def __repr__(self) -> str:
        """String representation of WebAuthnCredential model."""
        return (
            f"WebAuthnCredential(id={self.id}, user_id={self.user_id}, "
            f"credential_id={self.credential_id[:20]}..., device_name={self.device_name}, "
            f"is_revoked={self.is_revoked})"
        )
