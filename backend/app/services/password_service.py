"""
Password hashing service using Argon2.

This module provides secure password hashing and verification using the Argon2
algorithm (winner of the Password Hashing Competition).

Security Features:
    - Argon2id variant (hybrid of Argon2i and Argon2d)
    - Memory-hard function (resistant to GPU attacks)
    - Built-in salt generation
    - Timing-safe verification
    - Automatic hash upgrades

Usage:
    from backend.app.services.password_service import (
        hash_password,
        verify_password,
        validate_password_strength,
    )

    # Hash a password
    hashed = hash_password("user_password")

    # Verify a password
    is_valid = verify_password("user_password", hashed)

    # Validate password strength
    is_strong, message = validate_password_strength("weak")
"""
import re

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHash, VerifyMismatchError

# Argon2id configuration (OWASP recommended parameters)
# https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
_hasher = PasswordHasher(
    time_cost=3,        # Number of iterations
    memory_cost=65536,  # 64 MB memory usage
    parallelism=4,      # Number of threads
    hash_len=32,        # Output hash length
    salt_len=16,        # Salt length
    type=Type.ID,       # Argon2id variant (hybrid - recommended)
)

# Dummy hash for timing attack prevention
# Used when user doesn't exist to prevent enumeration via timing
DUMMY_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$"
    "c29tZXJhbmRvbXNhbHQ$"
    "aGFzaGVkX3Bhc3N3b3JkX2hlcmU"
)


def hash_password(password: str) -> str:
    """
    Hash a password using Argon2id.

    Args:
        password: Plain text password to hash

    Returns:
        str: Argon2id hash string (includes algorithm, parameters, salt, hash)

    Example:
        >>> hashed = hash_password("my_secure_password")
        >>> print(hashed)
        '$argon2id$v=19$m=65536,t=3,p=4$...'
    """
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """
    Verify a password against its hash (timing-safe).

    Args:
        password: Plain text password to verify
        password_hash: Argon2id hash to verify against

    Returns:
        bool: True if password matches, False otherwise

    Note:
        This function is timing-safe - it will not reveal whether
        the hash format is valid or the password is wrong.

    Example:
        >>> hashed = hash_password("my_password")
        >>> verify_password("my_password", hashed)
        True
        >>> verify_password("wrong_password", hashed)
        False
    """
    try:
        _hasher.verify(password_hash, password)
        return True
    except (VerifyMismatchError, InvalidHash):
        return False


def verify_password_with_dummy(
    password: str,
    password_hash: str | None,
) -> bool:
    """
    Verify password with timing attack protection.

    This function always performs a hash verification, even if the user
    doesn't exist (password_hash is None). This prevents attackers from
    determining whether an email exists based on response timing.

    Args:
        password: Plain text password to verify
        password_hash: Argon2id hash (None if user doesn't exist)

    Returns:
        bool: True if password matches, False otherwise

    Example:
        # User exists
        >>> verify_password_with_dummy("password", user.password_hash)
        True

        # User doesn't exist (still performs hash operation)
        >>> verify_password_with_dummy("password", None)
        False
    """
    if password_hash is None:
        # User doesn't exist - still perform hash to prevent timing attack
        verify_password(password, DUMMY_HASH)
        return False

    return verify_password(password, password_hash)


def needs_rehash(password_hash: str) -> bool:
    """
    Check if password hash needs to be upgraded.

    Should be called after successful password verification to ensure
    passwords are always hashed with the latest parameters.

    Args:
        password_hash: Current hash to check

    Returns:
        bool: True if hash should be upgraded, False otherwise

    Example:
        >>> if verify_password(password, user.password_hash):
        ...     if needs_rehash(user.password_hash):
        ...         user.password_hash = hash_password(password)
        ...         await session.commit()
    """
    return _hasher.check_needs_rehash(password_hash)


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password meets security requirements.

    Requirements (OWASP 2023 recommendations):
        - Minimum 12 characters (not 8)
        - At least one uppercase letter (A-Z)
        - At least one lowercase letter (a-z)
        - At least one digit (0-9)
        - At least one special character (!@#$%^&*(),.?":{}|<>)
        - Not in common passwords list (top 100)

    Args:
        password: Password to validate

    Returns:
        tuple[bool, str]: (is_valid, error_message)
            - is_valid: True if password meets all requirements
            - error_message: Empty string if valid, error description otherwise

    Example:
        >>> validate_password_strength("weak")
        (False, "Password must be at least 12 characters")

        >>> validate_password_strength("StrongP@ssw0rd!")
        (True, "")
    """
    # Minimum length (OWASP recommends 12+ for modern systems)
    if len(password) < 12:
        return False, "Password must be at least 12 characters"

    # Maximum length (prevent DoS via large passwords)
    if len(password) > 128:
        return False, "Password must be at most 128 characters"

    # Uppercase letter
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"

    # Lowercase letter
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"

    # Digit
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"

    # Special character
    if not re.search(r'[!@#$%^&*(),.?":{}|<>\-_=+\[\]\\;\'`~]', password):
        return False, "Password must contain at least one special character"

    # Check against common passwords (top 100)
    # Remove digits and special characters to check base word
    # Example: "Password123!" -> "password" (blocked)
    password_alpha = re.sub(r'[^a-zA-Z]', '', password).lower()
    if password_alpha in COMMON_PASSWORDS:
        return False, "This password is too common. Please choose a stronger password"

    # Also check full password (for cases like "password")
    if password.lower() in COMMON_PASSWORDS:
        return False, "This password is too common. Please choose a stronger password"

    return True, ""


# Top 100 most common passwords (always blocked)
# Source: Various breach databases, annually updated
COMMON_PASSWORDS = {
    "123456",
    "password",
    "12345678",
    "qwerty",
    "123456789",
    "12345",
    "1234",
    "111111",
    "1234567",
    "dragon",
    "123123",
    "baseball",
    "abc123",
    "football",
    "monkey",
    "letmein",
    "shadow",
    "master",
    "666666",
    "qwertyuiop",
    "123321",
    "mustang",
    "1234567890",
    "michael",
    "654321",
    "superman",
    "1qaz2wsx",
    "7777777",
    "121212",
    "000000",
    "qazwsx",
    "123qwe",
    "killer",
    "trustno1",
    "jordan",
    "jennifer",
    "zxcvbnm",
    "asdfgh",
    "hunter",
    "buster",
    "soccer",
    "harley",
    "batman",
    "andrew",
    "tigger",
    "sunshine",
    "iloveyou",
    "2000",
    "charlie",
    "robert",
    "thomas",
    "hockey",
    "ranger",
    "daniel",
    "starwars",
    "klaster",
    "112233",
    "george",
    "computer",
    "michelle",
    "jessica",
    "pepper",
    "1111",
    "zxcvbn",
    "555555",
    "11111111",
    "131313",
    "freedom",
    "777777",
    "pass",
    "maggie",
    "159753",
    "aaaaaa",
    "ginger",
    "princess",
    "joshua",
    "cheese",
    "amanda",
    "summer",
    "love",
    "ashley",
    "nicole",
    "chelsea",
    "biteme",
    "matthew",
    "access",
    "yankees",
    "987654321",
    "dallas",
    "austin",
    "thunder",
    "taylor",
    "matrix",
    "mobilemail",
    "mom",
    "monitor",
    "monitoring",
    "montana",
    "moon",
    "moscow",
}
