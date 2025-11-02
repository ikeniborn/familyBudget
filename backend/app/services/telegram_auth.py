"""
Telegram OAuth authentication validation service.

⚠️ CRITICAL SECURITY MODULE ⚠️
This module implements Telegram Login Widget hash validation according to
official Telegram documentation. Incorrect implementation can lead to
authentication bypass vulnerabilities (RISK-002).

Reference:
    https://core.telegram.org/widgets/login#checking-authorization

Security Requirements:
    - HMAC-SHA256 hash validation
    - Timing-attack resistant comparison (hmac.compare_digest)
    - Strict adherence to Telegram's algorithm
    - No custom modifications to validation logic
"""

import hashlib
import hmac
import httpx
from typing import Dict, Optional

from backend.app.core.config import get_settings

settings = get_settings()


async def get_bot_username() -> Optional[str]:
    """
    Get bot username from Telegram API using bot token.

    Uses Telegram Bot API method getMe to retrieve bot information.
    This is useful for automatically configuring TELEGRAM_BOT_USERNAME
    instead of requiring manual configuration.

    Returns:
        Optional[str]: Bot username (without @ prefix) or None if failed

    Example:
        >>> bot_username = await get_bot_username()
        >>> print(f"Bot username: @{bot_username}")
        Bot username: @ikenibornbudgetbot

    Raises:
        No exceptions raised - returns None on failure

    Security Notes:
        - Only requires bot token (no additional credentials)
        - Uses official Telegram Bot API
        - Safe to call at application startup

    Related:
        - TELEGRAM_BOT_USERNAME configuration
        - Telegram Login Widget setup
    """
    try:
        # Telegram Bot API endpoint
        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getMe"

        # Make request to Telegram API
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)

        # Check if request was successful
        if response.status_code != 200:
            return None

        # Parse response
        data = response.json()

        # Validate response structure
        if not data.get("ok"):
            return None

        # Extract username from result
        result = data.get("result", {})
        username = result.get("username")

        return username

    except Exception:
        # Silently fail - username can be configured manually if needed
        return None


async def validate_telegram_user(telegram_id: int) -> bool:
    """
    Validate that a telegram_id exists in Telegram using Bot API.

    Uses Telegram Bot API method getChat to check if the user exists.
    This is useful when creating users manually via admin panel to ensure
    the telegram_id is valid before creating the user record.

    Args:
        telegram_id: Telegram user ID to validate

    Returns:
        bool: True if user exists in Telegram, False otherwise

    Example:
        >>> is_valid = await validate_telegram_user(123456789)
        >>> if is_valid:
        ...     print("Valid Telegram user")
        ... else:
        ...     print("Invalid or non-existent Telegram ID")

    Raises:
        No exceptions raised - returns False on any error

    Security Notes:
        - Only requires bot token (no additional credentials)
        - Uses official Telegram Bot API getChat method
        - Bot must have interacted with the user OR user must have a public profile
        - Returns False for:
          - Non-existent Telegram IDs
          - Users who never interacted with the bot (if profile is private)
          - Network/API errors
          - Invalid bot token

    Related:
        - Admin user creation workflow
        - User validation in admin panel
    """
    try:
        # Telegram Bot API getChat endpoint
        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getChat"

        # Make request to Telegram API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                params={"chat_id": telegram_id},
                timeout=10.0
            )

        # Check if request was successful
        if response.status_code != 200:
            return False

        # Parse response
        data = response.json()

        # Validate response structure
        # ok=True means the user exists and bot can access their info
        if not data.get("ok"):
            return False

        # Additional validation: check if result has user data
        result = data.get("result", {})
        if not result:
            return False

        # Verify it's a user (not a group/channel)
        # type should be "private" for individual users
        chat_type = result.get("type")
        if chat_type != "private":
            return False

        return True

    except Exception:
        # Return False on any error (network, parsing, etc.)
        return False


def validate_telegram_auth(data: Dict[str, any]) -> bool:
    """
    Validate Telegram OAuth authentication data.

    ⚠️ CRITICAL SECURITY FUNCTION ⚠️

    Implements the official Telegram Login Widget validation algorithm:
    1. Extract hash from data
    2. Create data_check_string from sorted key-value pairs (excluding hash)
    3. Compute secret_key = SHA256(bot_token)
    4. Compute HMAC-SHA256(secret_key, data_check_string)
    5. Compare computed hash with received hash (timing-attack safe)

    Args:
        data: Dictionary with Telegram OAuth data
              Required keys: hash, id, first_name, auth_date
              Optional keys: last_name, username, photo_url

    Returns:
        bool: True if authentication data is valid, False otherwise

    Example:
        >>> auth_data = {
        ...     "id": "123456789",
        ...     "first_name": "John",
        ...     "last_name": "Doe",
        ...     "username": "johndoe",
        ...     "auth_date": "1699999999",
        ...     "hash": "abc123def456..."
        ... }
        >>> is_valid = validate_telegram_auth(auth_data)
        >>> if is_valid:
        ...     print("Authentication successful")
        ... else:
        ...     print("Authentication failed - invalid hash")

    Security Notes:
        - Uses hmac.compare_digest() to prevent timing attacks
        - All data must be strings for hash computation
        - Data check string format: "key=value\\nkey=value\\n..." (sorted by key)
        - Secret key is SHA256 hash of bot token (not token itself)

    Related:
        - RISK-002: Telegram OAuth Vulnerability
        - TASK-012: Telegram OAuth endpoint
        - TASK-026: Auth unit tests (validation required)
    """
    # Step 1: Extract and remove hash from data
    received_hash = data.pop("hash", None)

    if received_hash is None:
        return False

    # Step 2: Create data check string
    # Format: "key=value\nkey=value\n..." (sorted by key)
    # All values must be strings
    data_check_string = "\n".join(
        [f"{key}={value}" for key, value in sorted(data.items())]
    )

    # Step 3: Compute secret key (SHA256 of bot token)
    bot_token = settings.TELEGRAM_BOT_TOKEN
    secret_key = hashlib.sha256(bot_token.encode()).digest()

    # Step 4: Compute HMAC-SHA256 hash
    computed_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode(),
        digestmod=hashlib.sha256
    ).hexdigest()

    # Step 5: Compare hashes (timing-attack resistant)
    # hmac.compare_digest prevents timing attacks by comparing all bytes
    is_valid = hmac.compare_digest(computed_hash, received_hash)

    return is_valid
