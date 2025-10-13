"""
JWT token service for authentication.

This module provides functions for creating and validating JWT tokens
used for user authentication. Tokens are signed with HS256 algorithm
and include user_id claim with configurable expiry time.

Security:
    - Uses HS256 (HMAC SHA-256) algorithm
    - Secret key from environment configuration
    - 7-day token lifetime (configurable)
    - Includes exp (expiration) and iat (issued at) claims
"""

from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt

from backend.app.core.config import get_settings

settings = get_settings()

# JWT Configuration
ALGORITHM = "HS256"
SECRET_KEY = settings.JWT_SECRET
TOKEN_EXPIRE_DAYS = settings.JWT_EXPIRY_DAYS


def create_access_token(user_id: int) -> str:
    """
    Create JWT access token for authenticated user.

    Generates a signed JWT token with user_id claim and expiration time.
    Token should be stored in httpOnly cookie for security.

    Args:
        user_id: Database user ID (surrogate key from t_d_user.id)

    Returns:
        str: Encoded JWT token string

    Example:
        >>> token = create_access_token(user_id=123)
        >>> print(token)
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

    Notes:
        - Token lifetime: settings.JWT_EXPIRY_DAYS (default 7 days)
        - Algorithm: HS256
        - Claims included: user_id, exp (expiration), iat (issued at)
    """
    # Calculate expiration time
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)

    # Prepare claims
    claims = {
        "user_id": user_id,
        "exp": expire,
        "iat": datetime.utcnow(),
    }

    # Encode JWT
    token = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)

    return token


def decode_access_token(token: str) -> Optional[int]:
    """
    Decode and validate JWT access token.

    Verifies token signature, checks expiration, and extracts user_id claim.
    Returns None if token is invalid or expired.

    Args:
        token: JWT token string to decode

    Returns:
        Optional[int]: User ID if token is valid, None otherwise

    Example:
        >>> user_id = decode_access_token("eyJhbGciOiJIUzI1NiIs...")
        >>> if user_id:
        ...     print(f"Authenticated user: {user_id}")
        ... else:
        ...     print("Invalid or expired token")

    Notes:
        - Returns None for expired tokens
        - Returns None for invalid signatures
        - Returns None for malformed tokens
        - Returns None if user_id claim is missing
    """
    try:
        # Decode JWT and verify signature
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        # Extract user_id claim
        user_id: Optional[int] = payload.get("user_id")

        if user_id is None:
            return None

        return user_id

    except JWTError:
        # Token is invalid, expired, or malformed
        return None
