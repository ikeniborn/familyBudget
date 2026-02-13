"""
Authentication Pydantic schemas for Telegram OAuth, Email/Password and 2FA.

This module defines request and response schemas for the authentication flow:
- Telegram OAuth data validation
- Email/password registration and login
- Two-Factor Authentication (2FA) setup and verification
- User response data
- Authentication response with user data
"""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class TelegramAuthData(BaseModel):
    """
    Telegram OAuth authentication data.

    This schema validates data received from Telegram Login Widget.
    All fields except 'hash' come from Telegram's authentication response.

    According to Telegram OAuth documentation:
    https://core.telegram.org/widgets/login

    Attributes:
        id: Telegram user ID
        first_name: User's first name
        last_name: User's last name (optional)
        username: Telegram username (optional)
        photo_url: Profile photo URL (optional)
        auth_date: Authentication timestamp (unix timestamp)
        hash: HMAC-SHA256 hash for validation (computed by Telegram)

    Example:
        >>> data = TelegramAuthData(
        ...     id=123456789,
        ...     first_name="John",
        ...     last_name="Doe",
        ...     username="johndoe",
        ...     auth_date=1699999999,
        ...     hash="abc123def456..."
        ... )
    """

    id: int = Field(
        description="Telegram user ID",
        examples=[123456789]
    )
    first_name: str = Field(
        description="User's first name from Telegram",
        examples=["John"]
    )
    last_name: str | None = Field(
        default=None,
        description="User's last name from Telegram (optional)",
        examples=["Doe", None]
    )
    username: str | None = Field(
        default=None,
        description="Telegram username (optional)",
        examples=["johndoe", None]
    )
    photo_url: str | None = Field(
        default=None,
        description="Profile photo URL (optional)",
        examples=["https://t.me/i/userpic/320/johndoe.jpg", None]
    )
    auth_date: int = Field(
        description="Authentication timestamp (unix timestamp)",
        examples=[1699999999]
    )
    hash: str = Field(
        description="HMAC-SHA256 hash from Telegram for validation",
        examples=["abc123def456789abcdef123456789abcdef"]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": 123456789,
                "first_name": "John",
                "last_name": "Doe",
                "username": "johndoe",
                "photo_url": "https://t.me/i/userpic/320/johndoe.jpg",
                "auth_date": 1699999999,
                "hash": "abc123def456789abcdef123456789abcdef"
            }
        }
    }


class UserResponse(BaseModel):
    """
    User data returned in authentication response.

    Contains essential user information without sensitive SCD2 fields.

    Attributes:
        id: User's database ID (surrogate key)
        telegram_id: User's Telegram ID (business key)
        username: Telegram username (optional)
        first_name: User's first name
        last_name: User's last name (optional)
        photo_url: Local path to cached profile photo (optional)
        is_admin: Admin status flag
        is_active: User activation status (controlled by admin)

    Example:
        >>> user = UserResponse(
        ...     id=1,
        ...     telegram_id=123456789,
        ...     username="johndoe",
        ...     first_name="John",
        ...     last_name="Doe",
        ...     photo_url="/static/avatars/1.jpg",
        ...     is_admin=False
        ... )
    """

    id: int = Field(
        description="User's database ID",
        examples=[1]
    )
    telegram_id: int | None = Field(
        default=None,
        description="User's Telegram ID (nullable for email-only users)",
        examples=[123456789, None]
    )
    email: str | None = Field(
        default=None,
        description="User's email (nullable for Telegram-only users)",
        examples=["user@example.com", None]
    )
    username: str | None = Field(
        default=None,
        description="Telegram username",
        examples=["johndoe", None]
    )
    first_name: str | None = Field(
        default=None,
        description="User's first name",
        examples=["John"]
    )
    last_name: str | None = Field(
        default=None,
        description="User's last name",
        examples=["Doe", None]
    )
    photo_url: str | None = Field(
        default=None,
        description="Local path to cached profile photo",
        examples=["/static/avatars/1.jpg", None]
    )
    is_admin: bool = Field(
        default=False,
        description="Admin status flag",
        examples=[False]
    )
    is_active: bool = Field(
        default=False,
        description="User activation status (controlled by admin)",
        examples=[True, False]
    )
    two_factor_enabled: bool = Field(
        default=False,
        description="Whether 2FA is enabled for this user",
        examples=[True, False]
    )
    has_webauthn_credentials: bool = Field(
        default=False,
        description="Whether user has registered WebAuthn biometric credentials (TouchID/FaceID)",
        examples=[True, False]
    )

    model_config = {
        "from_attributes": True,  # Enable ORM mode for SQLModel compatibility
        "json_schema_extra": {
            "example": {
                "id": 1,
                "telegram_id": 123456789,
                "username": "johndoe",
                "first_name": "John",
                "last_name": "Doe",
                "photo_url": "/static/avatars/1.jpg",
                "is_admin": False,
                "is_active": True
            }
        }
    }


class AuthResponse(BaseModel):
    """
    Complete authentication response.

    Returned after successful Telegram OAuth authentication.
    JWT tokens are returned in BOTH response body and httpOnly cookies for compatibility:
    - Response body: For bot clients (Telegram bot needs tokens for API calls)
    - httpOnly cookies: For web clients (secure browser-based authentication)

    Attributes:
        user: User data
        message: Success message
        access_token: JWT access token (7-day expiry, also in httpOnly cookie)
        refresh_token: JWT refresh token (30-day expiry, also in httpOnly cookie)
        token_type: Token type (always "bearer")

    Example:
        >>> response = AuthResponse(
        ...     user=UserResponse(...),
        ...     message="Authentication successful",
        ...     access_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        ...     refresh_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        ...     token_type="bearer"
        ... )
    """

    user: UserResponse = Field(
        description="Authenticated user data"
    )
    message: str = Field(
        default="Authentication successful",
        description="Success message",
        examples=["Authentication successful"]
    )
    access_token: str | None = Field(
        default=None,
        description="JWT access token (7-day expiry). Also set in httpOnly cookie.",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."]
    )
    refresh_token: str | None = Field(
        default=None,
        description="JWT refresh token (30-day expiry). Also set in httpOnly cookie.",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."]
    )
    token_type: str = Field(
        default="bearer",
        description="Token type for Authorization header",
        examples=["bearer"]
    )
    backup_codes: list[str] | None = Field(
        default=None,
        description="Backup codes for 2FA (only returned on first 2FA setup)",
        examples=[["ABCD-1234", "EFGH-5678", "IJKL-9012"]]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "user": {
                    "id": 1,
                    "telegram_id": 123456789,
                    "username": "johndoe",
                    "first_name": "John",
                    "is_admin": False
                },
                "message": "Authentication successful",
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer"
            }
        }
    }


# =============================================================================
# Email Registration & Login Schemas
# =============================================================================


class EmailRegisterRequest(BaseModel):
    """
    Request schema for email registration.

    New users register with email/password and require admin activation.
    2FA must be set up before first login.

    Attributes:
        email: User's email address
        password: Password (min 12 chars, must include upper/lower/digit/special)
        password_confirm: Password confirmation (must match password)
        first_name: User's first name
        last_name: User's last name (optional)
    """

    email: EmailStr = Field(
        description="User's email address",
        examples=["user@example.com"]
    )
    password: str = Field(
        min_length=12,
        max_length=128,
        description="Password (min 12 chars, upper/lower/digit/special)",
        examples=["MySecureP@ss123"]
    )
    password_confirm: str = Field(
        min_length=12,
        max_length=128,
        description="Password confirmation (must match password)"
    )
    first_name: str = Field(
        min_length=1,
        max_length=255,
        description="User's first name",
        examples=["John"]
    )
    last_name: str | None = Field(
        default=None,
        max_length=255,
        description="User's last name (optional)",
        examples=["Doe"]
    )

    @field_validator('password_confirm')
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        """Validate that passwords match."""
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v


class EmailLoginRequest(BaseModel):
    """
    Request schema for email login.

    User must have:
    1. Valid email + password
    2. is_active = True (admin activated)
    3. 2FA enabled (required for email login)

    Returns session_token for 2FA verification step.

    Attributes:
        email: User's email address
        password: User's password
    """

    email: EmailStr = Field(
        description="User's email address",
        examples=["user@example.com"]
    )
    password: str = Field(
        min_length=1,
        description="User's password"
    )


class EmailLoginResponse(BaseModel):
    """
    Response after successful password verification.

    Two scenarios:
    1. requires_2fa=True: User has 2FA enabled, must verify with TOTP code
    2. requires_2fa_setup=True: User needs to set up 2FA first

    Attributes:
        requires_2fa: True if user has 2FA enabled and must verify
        requires_2fa_setup: True if user needs to set up 2FA first
        session_token: Token for 2FA verification/setup (5-min TTL)
        expires_in: Token expiration in seconds (300 = 5 min)
        totp_secret: TOTP secret for QR code (only when requires_2fa_setup=True)
        totp_uri: TOTP URI for authenticator app (only when requires_2fa_setup=True)
    """

    requires_2fa: bool = Field(
        default=False,
        description="2FA verification required (user has 2FA enabled)"
    )
    requires_2fa_setup: bool = Field(
        default=False,
        description="2FA setup required (user doesn't have 2FA yet)"
    )
    session_token: str = Field(
        description="Session token for 2FA verification/setup (5-min TTL)"
    )
    expires_in: int = Field(
        default=300,
        description="Session token expiration in seconds"
    )
    totp_secret: str | None = Field(
        default=None,
        description="TOTP secret for manual entry (only for setup)"
    )
    totp_uri: str | None = Field(
        default=None,
        description="TOTP URI for QR code (only for setup)"
    )


# =============================================================================
# Two-Factor Authentication (2FA) Schemas
# =============================================================================


class TwoFactorVerifyRequest(BaseModel):
    """
    Request schema for 2FA code verification during login.

    After password verification, user submits TOTP code or backup code.

    Attributes:
        session_token: Session token from /auth/login response
        code: TOTP code (6 digits) or backup code (XXXX-XXXX)
    """

    session_token: str = Field(
        description="Session token from /auth/login response"
    )
    code: str = Field(
        min_length=6,
        max_length=10,
        description="TOTP code (6 digits) or backup code (XXXX-XXXX)",
        examples=["123456", "A1B2-C3D4"]
    )


class TwoFactorSetupAndVerifyRequest(BaseModel):
    """
    Request schema for initial 2FA setup during login.

    Used when user doesn't have 2FA enabled yet.
    Sets up 2FA and completes login in one step.

    Attributes:
        session_token: Session token from /auth/login response
        totp_secret: TOTP secret from /auth/login response
        code: TOTP code (6 digits) from authenticator app
    """

    session_token: str = Field(
        description="Session token from /auth/login response"
    )
    totp_secret: str = Field(
        description="TOTP secret from /auth/login response"
    )
    code: str = Field(
        min_length=6,
        max_length=6,
        description="TOTP code (6 digits) from authenticator app",
        examples=["123456"]
    )


class TwoFactorSetupResponse(BaseModel):
    """
    Response from 2FA setup initiation.

    Contains secret and QR URI for authenticator app setup.
    User must verify with code before 2FA is activated.

    Attributes:
        secret: Base32 secret for manual entry
        qr_uri: otpauth:// URI for QR code generation
    """

    secret: str = Field(
        description="Base32 secret for manual entry into authenticator app"
    )
    qr_uri: str = Field(
        description="otpauth:// URI for QR code generation"
    )


class TwoFactorVerifySetupRequest(BaseModel):
    """
    Request schema to confirm 2FA setup.

    User must enter current TOTP code to verify authenticator is configured.

    Attributes:
        code: Current TOTP code from authenticator app (6 digits)
    """

    code: str = Field(
        min_length=6,
        max_length=6,
        description="Current TOTP code from authenticator app",
        examples=["123456"]
    )

    @field_validator('code')
    @classmethod
    def code_is_digits(cls, v: str) -> str:
        """Validate that code contains only digits."""
        if not v.isdigit():
            raise ValueError('Code must contain only digits')
        return v


class TwoFactorSetupCompleteResponse(BaseModel):
    """
    Response after successful 2FA setup confirmation.

    Contains backup codes that user should save securely.
    Backup codes are shown ONLY ONCE.

    Attributes:
        backup_codes: List of 8 backup codes (format: XXXX-XXXX)
        remaining_codes: Number of backup codes remaining (always 8 on setup)
        message: Success message
    """

    backup_codes: list[str] = Field(
        description="Backup codes (save these securely - shown only once!)"
    )
    remaining_codes: int = Field(
        default=8,
        description="Number of backup codes remaining"
    )
    message: str = Field(
        default="2FA enabled successfully. Save your backup codes securely!",
        description="Success message"
    )


class TwoFactorDisableRequest(BaseModel):
    """
    Request schema to disable 2FA.

    Requires current password and TOTP code for security.

    Attributes:
        password: Current password for confirmation
        code: Current TOTP code from authenticator app
    """

    password: str = Field(
        min_length=1,
        description="Current password for confirmation"
    )
    code: str = Field(
        min_length=6,
        max_length=6,
        description="Current TOTP code from authenticator app",
        examples=["123456"]
    )


class BackupCodesResponse(BaseModel):
    """
    Response with new backup codes.

    Old backup codes are invalidated when new ones are generated.

    Attributes:
        backup_codes: List of 8 new backup codes
        message: Success message
    """

    backup_codes: list[str] = Field(
        description="New backup codes (old codes are now invalid)"
    )
    message: str = Field(
        default="New backup codes generated. Old codes are now invalid.",
        description="Success message"
    )


# =============================================================================
# Email & Password Management Schemas
# =============================================================================


class AddEmailRequest(BaseModel):
    """
    Request schema to add email to existing Telegram account.

    Attributes:
        email: Email address to add
    """

    email: EmailStr = Field(
        description="Email address to add",
        examples=["user@example.com"]
    )


class SetPasswordRequest(BaseModel):
    """
    Request schema to set or change password.

    Requires email to be set first.

    Attributes:
        password: New password (min 12 chars)
        password_confirm: Password confirmation
    """

    password: str = Field(
        min_length=12,
        max_length=128,
        description="New password (min 12 chars, upper/lower/digit/special)"
    )
    password_confirm: str = Field(
        min_length=12,
        max_length=128,
        description="Password confirmation"
    )

    @field_validator('password_confirm')
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        """Validate that passwords match."""
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v


class LinkTelegramRequest(BaseModel):
    """
    Request schema to link Telegram to email account.

    Contains Telegram OAuth data for verification.

    Attributes:
        id: Telegram user ID
        first_name: First name from Telegram
        last_name: Last name from Telegram (optional)
        username: Telegram username (optional)
        photo_url: Profile photo URL (optional)
        auth_date: Authentication timestamp
        hash: HMAC-SHA256 hash for validation
    """

    id: int = Field(description="Telegram user ID")
    first_name: str = Field(description="First name from Telegram")
    last_name: str | None = Field(default=None, description="Last name")
    username: str | None = Field(default=None, description="Telegram username")
    photo_url: str | None = Field(default=None, description="Profile photo URL")
    auth_date: int = Field(description="Authentication timestamp")
    hash: str = Field(description="HMAC-SHA256 hash for validation")


# =============================================================================
# Generic Response Schemas
# =============================================================================


class MessageResponse(BaseModel):
    """
    Generic message response.

    Attributes:
        message: Success/status message
    """

    message: str = Field(description="Response message")


class RegistrationSuccessResponse(BaseModel):
    """
    Response after successful email registration.

    User is created but requires admin activation.

    Attributes:
        message: Success message indicating pending activation
        user_id: Created user's ID
    """

    message: str = Field(
        default="Registration successful. Your account is pending admin approval.",
        description="Success message"
    )
    user_id: int = Field(description="Created user's ID")


class WebAuthnCredentialInfo(BaseModel):
    """
    WebAuthn credential metadata for auth methods response.

    Attributes:
        credential_id: WebAuthn credential ID (Base64URL)
        device_name: User-friendly device name
        created_at: Credential creation timestamp
        last_used_at: Last authentication timestamp (optional)
    """

    credential_id: str = Field(description="WebAuthn credential ID")
    device_name: str | None = Field(default=None, description="Device name")
    created_at: datetime = Field(description="Creation timestamp")
    last_used_at: datetime | None = Field(default=None, description="Last used timestamp")


class AuthMethodsResponse(BaseModel):
    """
    Response for available authentication methods check.

    Used in identifier-first login flow to determine which auth methods
    are available for a given user.

    Attributes:
        methods: Dict of available methods (telegram, email_password, webauthn)
    """

    class MethodsData(BaseModel):
        """Authentication methods availability."""
        telegram: bool = Field(description="Telegram OAuth available")
        email_password: bool = Field(description="Email+Password available")
        webauthn: bool = Field(description="WebAuthn biometric available")
        webauthn_credentials: list[WebAuthnCredentialInfo] = Field(
            default_factory=list,
            description="List of WebAuthn credentials (if webauthn=true)"
        )

    methods: MethodsData = Field(description="Available authentication methods")
