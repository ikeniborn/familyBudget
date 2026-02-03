"""
TOTP (Time-based One-Time Password) service for 2FA.

This module provides TOTP generation and verification for two-factor
authentication, compatible with Google Authenticator, Authy, etc.

Features:
    - TOTP secret generation (RFC 6238)
    - QR code URI generation (otpauth://)
    - Code verification with time window tolerance
    - Backup codes generation and verification

Usage:
    from backend.app.services.totp_service import (
        generate_secret,
        get_totp_uri,
        verify_totp,
        generate_backup_codes,
        verify_backup_code,
    )

    # Generate secret for new user
    secret = generate_secret()

    # Get QR code URI for authenticator app
    uri = get_totp_uri(secret, "user@example.com", "Family Budget")

    # Verify code from authenticator
    is_valid = verify_totp(secret, "123456")

    # Generate backup codes
    plain_codes, hashed_json = generate_backup_codes()
"""
from typing import Optional

import secrets

import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerifyMismatchError

from backend.app.core.json_utils import dumps as json_dumps, loads as json_loads

# TOTP configuration
TOTP_DIGITS = 6           # Number of digits in TOTP code
TOTP_INTERVAL = 30        # Time step in seconds
TOTP_ISSUER = "Family Budget"  # App name shown in authenticator
TOTP_VALID_WINDOW = 1     # Accept codes from ±1 time period (±30 sec)

# Backup codes configuration
BACKUP_CODE_COUNT = 8     # Number of backup codes to generate
BACKUP_CODE_LENGTH = 8    # Characters per backup code (XXXX-XXXX)

# Argon2 hasher for backup codes
_hasher = PasswordHasher()


def generate_secret() -> str:
    """
    Generate a new TOTP secret.

    Returns:
        str: Base32 encoded secret (32 characters)

    Example:
        >>> secret = generate_secret()
        >>> print(len(secret))
        32
    """
    return pyotp.random_base32()


def get_totp_uri(
    secret: str,
    email: str,
    issuer: str = TOTP_ISSUER,
) -> str:
    """
    Generate otpauth:// URI for QR code.

    This URI can be encoded into a QR code for easy setup
    in authenticator apps (Google Authenticator, Authy, etc).

    Args:
        secret: Base32 encoded TOTP secret
        email: User's email (shown as account name in app)
        issuer: Application name (default: "Family Budget")

    Returns:
        str: otpauth:// URI for QR code generation

    Example:
        >>> uri = get_totp_uri("JBSWY3DPEHPK3PXP", "user@example.com")
        >>> print(uri)
        'otpauth://totp/Family%20Budget:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Family%20Budget'
    """
    totp = pyotp.TOTP(secret, digits=TOTP_DIGITS, interval=TOTP_INTERVAL)
    return totp.provisioning_uri(name=email, issuer_name=issuer)


def get_current_totp(secret: str) -> str:
    """
    Get current TOTP code for a secret.

    Primarily used for testing and debugging.

    Args:
        secret: Base32 encoded TOTP secret

    Returns:
        str: Current 6-digit TOTP code

    Example:
        >>> code = get_current_totp("JBSWY3DPEHPK3PXP")
        >>> print(code)
        '123456'
    """
    totp = pyotp.TOTP(secret, digits=TOTP_DIGITS, interval=TOTP_INTERVAL)
    return totp.now()


def verify_totp(secret: str, code: str) -> bool:
    """
    Verify a TOTP code.

    Accepts codes from the current time period and ±1 period
    to account for clock drift and user delay.

    Args:
        secret: Base32 encoded TOTP secret
        code: 6-digit code to verify (can include spaces/dashes)

    Returns:
        bool: True if code is valid, False otherwise

    Example:
        >>> verify_totp("JBSWY3DPEHPK3PXP", "123456")
        True
        >>> verify_totp("JBSWY3DPEHPK3PXP", "123 456")  # Spaces allowed
        True
        >>> verify_totp("JBSWY3DPEHPK3PXP", "000000")
        False
    """
    # Clean code - remove spaces and dashes
    cleaned_code = code.replace(" ", "").replace("-", "")

    # Validate format
    if not cleaned_code.isdigit() or len(cleaned_code) != TOTP_DIGITS:
        return False

    totp = pyotp.TOTP(secret, digits=TOTP_DIGITS, interval=TOTP_INTERVAL)
    return totp.verify(cleaned_code, valid_window=TOTP_VALID_WINDOW)


def generate_backup_codes(count: int = BACKUP_CODE_COUNT) -> tuple[list[str], str]:
    """
    Generate backup codes for 2FA recovery.

    Generates random backup codes and returns both the plain codes
    (to show to user once) and hashed JSON (to store in database).

    Args:
        count: Number of backup codes to generate (default: 8)

    Returns:
        tuple[list[str], str]:
            - list of plain backup codes (show to user ONCE, format: XXXX-XXXX)
            - JSON string of Argon2 hashed codes (store in database)

    Example:
        >>> plain_codes, hashed_json = generate_backup_codes()
        >>> print(plain_codes[0])
        'A1B2-C3D4'
        >>> print(len(plain_codes))
        8
    """
    plain_codes: list[str] = []
    hashed_codes: list[str] = []

    for _ in range(count):
        # Generate 8 random hex characters (4 bytes = 32 bits of entropy each)
        raw_code = secrets.token_hex(4).upper()  # e.g., "A1B2C3D4"
        formatted_code = f"{raw_code[:4]}-{raw_code[4:]}"  # "A1B2-C3D4"

        plain_codes.append(formatted_code)
        hashed_codes.append(_hasher.hash(formatted_code))

    return plain_codes, json_dumps(hashed_codes)


def verify_backup_code(
    code: str,
    hashed_codes_json: str,
) -> tuple[bool, Optional[str]]:
    """
    Verify a backup code and remove it if valid.

    Backup codes are one-time use. Once verified, the code is removed
    from the list and the updated JSON is returned.

    Args:
        code: Backup code to verify (format: XXXX-XXXX or XXXXXXXX)
        hashed_codes_json: JSON array of Argon2 hashed codes from database

    Returns:
        tuple[bool, Optional[str]]:
            - is_valid: True if code was valid and consumed
            - updated_json: Updated JSON with code removed (None if invalid)

    Example:
        >>> is_valid, new_json = verify_backup_code("A1B2-C3D4", user.backup_codes)
        >>> if is_valid:
        ...     user.backup_codes = new_json
        ...     await session.commit()
    """
    # Clean code - remove dashes
    cleaned_code = code.upper().replace("-", "")
    if len(cleaned_code) == 8:
        # Reformat to standard format
        formatted_code = f"{cleaned_code[:4]}-{cleaned_code[4:]}"
    else:
        formatted_code = code.upper()

    try:
        hashed_codes = json_loads(hashed_codes_json)
    except (ValueError, TypeError):
        return False, None

    if not isinstance(hashed_codes, list):
        return False, None

    # Try to find matching code
    for i, hashed in enumerate(hashed_codes):
        try:
            _hasher.verify(hashed, formatted_code)
            # Found! Remove used code
            del hashed_codes[i]
            return True, json_dumps(hashed_codes)
        except (VerifyMismatchError, InvalidHash):
            continue

    return False, None


def get_remaining_backup_codes_count(hashed_codes_json: Optional[str]) -> int:
    """
    Get count of remaining backup codes.

    Args:
        hashed_codes_json: JSON array of hashed codes (or None)

    Returns:
        int: Number of remaining backup codes

    Example:
        >>> count = get_remaining_backup_codes_count(user.backup_codes)
        >>> print(f"You have {count} backup codes remaining")
    """
    if not hashed_codes_json:
        return 0

    try:
        hashed_codes = json_loads(hashed_codes_json)
        return len(hashed_codes) if isinstance(hashed_codes, list) else 0
    except (ValueError, TypeError):
        return 0
