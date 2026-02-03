"""
JWT token service for authentication.

This module provides functions for creating and validating JWT tokens
used for user authentication. Supports both access tokens and refresh tokens.

Access Tokens:
    - Uses HS256 (HMAC SHA-256) algorithm
    - Secret key from environment configuration
    - 7-day token lifetime (configurable)
    - Includes exp (expiration) and iat (issued at) claims
    - Stored in httpOnly cookie

Refresh Tokens:
    - Uses HS256 (HMAC SHA-256) algorithm
    - Same secret key as access tokens
    - 30-day token lifetime (configurable)
    - Includes user_id, exp, iat, and token_type claims
    - Stored in httpOnly cookie
    - Hashed (SHA-256) before storing in database for security

Security:
    - Access tokens: Short-lived (7 days)
    - Refresh tokens: Long-lived (30 days)
    - Refresh tokens hashed in database (like password hashing)
    - Token rotation: Old refresh token revoked when used
    - Revocation support: Tokens can be blacklisted on logout
"""
from typing import Optional

import hashlib
from datetime import datetime, timedelta

from jose import JWTError, jwt

from backend.app.core.config import get_settings

settings = get_settings()

# JWT Configuration
ALGORITHM = "HS256"
SECRET_KEY = settings.JWT_SECRET
ACCESS_TOKEN_EXPIRE_DAYS = settings.JWT_EXPIRE_DAYS
REFRESH_TOKEN_EXPIRE_DAYS = 30  # Refresh tokens live longer


def create_access_token(user_id: int, telegram_id: int) -> str:
    """
    Create JWT access token for authenticated user.

    Generates a signed JWT token with user_id and telegram_id claims and expiration time.
    Token should be stored in httpOnly cookie for security.

    Args:
        user_id: Database user ID (surrogate key from t_d_user.id)
        telegram_id: Telegram user ID (business key, stable across SCD Type 2 versions)

    Returns:
        str: Encoded JWT token string

    Example:
        >>> token = create_access_token(user_id=123, telegram_id=740775802)
        >>> print(token)
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

    Notes:
        - Token lifetime: settings.JWT_EXPIRE_DAYS (default 7 days)
        - Algorithm: HS256
        - Claims included: user_id (legacy), telegram_id (SCD Type 2 safe), exp, iat
        - telegram_id is the stable business key used to lookup users across SCD Type 2 versions
    """
    # Calculate expiration time
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)

    # Prepare claims (include both user_id for legacy and telegram_id for SCD Type 2)
    claims = {
        "user_id": user_id,  # Legacy (for backward compatibility)
        "telegram_id": telegram_id,  # Business key (stable across SCD Type 2 versions)
        "exp": expire,
        "iat": datetime.utcnow(),
    }

    # Encode JWT
    token = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)

    return token


# WebSocket token configuration
WS_TOKEN_EXPIRE_MINUTES = 5  # Short-lived token for WebSocket connections


def create_ws_token(user_id: int) -> str:
    """
    Create a short-lived JWT token for WebSocket connection.

    WebSocket tokens are passed via URL query parameter, which can be logged
    or exposed in referrer headers. Therefore, WS tokens:
    - Have short expiration (5 minutes)
    - Include 'type: ws' claim to distinguish from regular tokens
    - Only contain user_id (minimal claims)

    Args:
        user_id: Database user ID

    Returns:
        str: Encoded JWT token string for WebSocket authentication

    Security notes:
        - Token is short-lived to minimize exposure window
        - Token type 'ws' prevents use as regular API token
        - Should only be used for WebSocket initial connection
    """
    expire = datetime.utcnow() + timedelta(minutes=WS_TOKEN_EXPIRE_MINUTES)

    claims = {
        "sub": str(user_id),  # Subject (user ID as string per JWT spec)
        "type": "ws",  # Token type - WebSocket only
        "exp": expire,
        "iat": datetime.utcnow(),
    }

    token = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)
    return token


def decode_ws_token(token: str) -> Optional[int]:
    """
    Decode and validate WebSocket JWT token.

    Only accepts tokens with 'type: ws' claim.

    Args:
        token: JWT token string to decode

    Returns:
        Optional[int]: User ID if token is valid WS token, None otherwise
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Verify this is a WebSocket token
        if payload.get("type") != "ws":
            return None

        # Convert sub back to int (stored as string per JWT spec)
        sub = payload.get("sub")
        return int(sub) if sub else None
    except (JWTError, ValueError, TypeError):
        return None


def decode_access_token(token: str) -> Optional[int]:
    """
    Decode and validate JWT access token.

    Verifies token signature, checks expiration, and extracts telegram_id claim.
    Falls back to user_id if telegram_id is not present (backward compatibility).

    Args:
        token: JWT token string to decode

    Returns:
        Optional[int]: Telegram ID if token is valid, None otherwise

    Example:
        >>> telegram_id = decode_access_token("eyJhbGciOiJIUzI1NiIs...")
        >>> if telegram_id:
        ...     print(f"Authenticated user: {telegram_id}")
        ... else:
        ...     print("Invalid or expired token")

    Notes:
        - Returns None for expired tokens
        - Returns None for invalid signatures
        - Returns None for malformed tokens
        - Prefers telegram_id claim (SCD Type 2 safe), falls back to user_id (legacy)
    """
    try:
        # Decode JWT and verify signature
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Prefer telegram_id (SCD Type 2 safe), fallback to user_id (legacy)
        telegram_id: Optional[int] = payload.get("telegram_id")
        if telegram_id is not None:
            return telegram_id

        # Fallback to user_id for backward compatibility with old tokens
        user_id: Optional[int] = payload.get("user_id")
        return user_id

    except JWTError:
        # Token is invalid, expired, or malformed
        return None


def decode_access_token_full(token: str) -> tuple[Optional[int], Optional[int]]:
    """
    Decode JWT access token and return both user_id and telegram_id.

    This function is used when both values are needed, such as in middleware
    where we need to support both Telegram users (telegram_id) and email-only
    users (user_id without telegram_id).

    Args:
        token: JWT token string to decode

    Returns:
        tuple[Optional[int], Optional[int]]: (user_id, telegram_id)
            - user_id: Always present for valid tokens
            - telegram_id: Present for Telegram users, None for email-only users

    Example:
        >>> user_id, telegram_id = decode_access_token_full("eyJhbGciOiJIUzI1NiIs...")
        >>> if user_id:
        ...     print(f"User ID: {user_id}, Telegram ID: {telegram_id}")
        ... else:
        ...     print("Invalid or expired token")

    Notes:
        - Returns (None, None) for invalid/expired tokens
        - user_id is the database primary key (always set)
        - telegram_id is the Telegram business key (None for email-only users)
    """
    try:
        # Decode JWT and verify signature
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Extract both claims
        user_id: Optional[int] = payload.get("user_id")
        telegram_id: Optional[int] = payload.get("telegram_id")

        return user_id, telegram_id

    except JWTError:
        # Token is invalid, expired, or malformed
        return None, None


def create_refresh_token(user_id: int) -> tuple[str, datetime]:
    """
    Create JWT refresh token for authenticated user.

    Generates a long-lived refresh token that can be used to obtain new access tokens.
    Token is stored as SHA-256 hash in database for security (never stored in plaintext).

    Args:
        user_id: Database user ID (surrogate key from t_d_user.id)

    Returns:
        tuple[str, datetime]: Tuple of (encoded JWT token, expiration datetime)

    Example:
        >>> token, expires_at = create_refresh_token(user_id=123)
        >>> print(token)
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        >>> print(expires_at)
        datetime.datetime(2025, 11, 13, 12, 30, 45)

    Notes:
        - Token lifetime: 30 days (REFRESH_TOKEN_EXPIRE_DAYS)
        - Algorithm: HS256
        - Claims included: user_id, token_type='refresh', exp, iat
        - Token hash (SHA-256) should be stored in database, not the token itself
        - Returns expiration datetime for database storage

    Security:
        - NEVER store the actual refresh token in database
        - Store only SHA-256 hash: hash_token(token)
        - Token is only known to client (in httpOnly cookie)
        - Similar to password hashing for security
    """
    # Calculate expiration time (30 days)
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    # Prepare claims (include token_type to differentiate from access tokens)
    claims = {
        "user_id": user_id,
        "token_type": "refresh",
        "exp": expire,
        "iat": datetime.utcnow(),
    }

    # Encode JWT
    token = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)

    return token, expire


def decode_refresh_token(token: str) -> Optional[int]:
    """
    Decode and validate JWT refresh token.

    Verifies token signature, checks expiration, validates token_type,
    and extracts user_id claim. Returns None if token is invalid.

    Args:
        token: JWT refresh token string to decode

    Returns:
        Optional[int]: User ID if token is valid, None otherwise

    Example:
        >>> user_id = decode_refresh_token("eyJhbGciOiJIUzI1NiIs...")
        >>> if user_id:
        ...     print(f"Valid refresh token for user: {user_id}")
        ... else:
        ...     print("Invalid or expired refresh token")

    Notes:
        - Returns None for expired tokens
        - Returns None for invalid signatures
        - Returns None for malformed tokens
        - Returns None if user_id claim is missing
        - Returns None if token_type != 'refresh'

    Security:
        - This only validates JWT structure and signature
        - Caller must also check database for revocation status
        - Check RefreshToken.is_revoked and RefreshToken.expires_at
    """
    try:
        # Decode JWT and verify signature
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Validate token_type (must be 'refresh')
        token_type = payload.get("token_type")
        if token_type != "refresh":
            return None

        # Extract user_id claim
        user_id: Optional[int] = payload.get("user_id")

        if user_id is None:
            return None

        return user_id

    except JWTError:
        # Token is invalid, expired, or malformed
        return None


def hash_token(token: str) -> str:
    """
    Create SHA-256 hash of token for secure database storage.

    Uses SHA-256 to hash the token before storing in database.
    This ensures the actual token is never stored (similar to password hashing).

    Args:
        token: JWT token string to hash

    Returns:
        str: Hexadecimal SHA-256 hash of token

    Example:
        >>> token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        >>> token_hash = hash_token(token)
        >>> print(token_hash)
        'a3d2f1b8c9e7d6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1'

    Notes:
        - Uses SHA-256 algorithm (secure, one-way hash)
        - Returns hex string (suitable for VARCHAR storage)
        - Hash is deterministic (same token always produces same hash)
        - Used for token lookup in database during refresh/revocation

    Security:
        - One-way hash (cannot reverse to get original token)
        - Protects token if database is compromised
        - Similar to password hashing best practices
    """
    # Create SHA-256 hash of token (encoded as bytes)
    hash_object = hashlib.sha256(token.encode('utf-8'))

    # Return hexadecimal string representation
    return hash_object.hexdigest()


# Backward compatibility alias for old tests
TOKEN_EXPIRE_DAYS = ACCESS_TOKEN_EXPIRE_DAYS
