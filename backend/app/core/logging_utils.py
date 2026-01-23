"""
Logging utilities for secure logging practices.

This module provides utilities to safely log sensitive information
without exposing PII (Personally Identifiable Information).
"""

import hashlib


def hash_email_for_logging(email: str) -> str:
    """
    Hash email address for secure logging.

    Creates a consistent hash of an email address that can be used for
    tracking and correlation in logs without exposing the actual email.
    Uses first 8 characters of SHA256 hash for brevity while maintaining
    sufficient entropy for distinguishing users.

    Args:
        email: The email address to hash

    Returns:
        str: First 8 characters of the SHA256 hash (hexadecimal)

    Example:
        >>> hash_email_for_logging("user@example.com")
        'b4c9a289'
        >>> hash_email_for_logging("USER@EXAMPLE.COM")  # Case-insensitive
        'b4c9a289'
    """
    if not email:
        return "empty_email"

    # Normalize to lowercase for consistent hashing
    normalized_email = email.lower().strip()

    # Use SHA256 for cryptographic strength
    hash_obj = hashlib.sha256(normalized_email.encode('utf-8'))

    # Return first 8 characters (32 bits) - enough for distinguishing users
    # while keeping logs readable
    return hash_obj.hexdigest()[:8]
