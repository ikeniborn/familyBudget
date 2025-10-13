"""
Telegram OAuth utilities.

Provides functions for Telegram Login Widget authentication.
Implements HMAC-SHA256 hash computation for secure authentication.
"""

import hashlib
import hmac
import time
from typing import Dict

from telegram import User

from bot.config.settings import get_settings
from bot.utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


def compute_telegram_hash(data: Dict[str, str]) -> str:
    """
    Compute Telegram OAuth hash using HMAC-SHA256.

    This implements the official Telegram Login Widget verification algorithm:
    https://core.telegram.org/widgets/login#checking-authorization

    Algorithm:
    1. Create data_check_string from sorted key=value pairs (excluding 'hash')
    2. Compute secret_key = SHA256(bot_token)
    3. Compute HMAC-SHA256(secret_key, data_check_string)

    Args:
        data: Dictionary with user data (id, first_name, etc.)
              Should NOT include 'hash' key

    Returns:
        str: Computed hash (hexadecimal string)

    Example:
        >>> data = {"id": "123456", "first_name": "John", "auth_date": "1697123456"}
        >>> hash_value = compute_telegram_hash(data)
        >>> # Use this hash when sending to backend
    """
    # Step 1: Create data_check_string (sorted key=value pairs separated by newlines)
    data_check_string = "\n".join(
        [f"{key}={value}" for key, value in sorted(data.items())]
    )

    logger.debug(f"Data check string: {data_check_string}")

    # Step 2: Compute secret_key = SHA256(bot_token)
    bot_token = settings.TELEGRAM_BOT_TOKEN
    secret_key = hashlib.sha256(bot_token.encode()).digest()

    # Step 3: Compute HMAC-SHA256
    computed_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode(),
        digestmod=hashlib.sha256
    ).hexdigest()

    logger.debug(f"Computed hash: {computed_hash}")

    return computed_hash


def prepare_telegram_auth_data(user: User) -> Dict[str, str]:
    """
    Prepare Telegram user data for backend authentication.

    Converts Telegram User object to dictionary format expected by backend,
    including computed HMAC-SHA256 hash.

    Args:
        user: Telegram User object from update.effective_user

    Returns:
        Dict containing:
            - id: Telegram user ID (string)
            - first_name: User's first name
            - last_name: User's last name (if available)
            - username: User's username (if available)
            - auth_date: Current timestamp (string)
            - hash: Computed HMAC-SHA256 hash

    Example:
        >>> from telegram import Update
        >>> user = update.effective_user
        >>> auth_data = prepare_telegram_auth_data(user)
        >>> # Send auth_data to backend /auth/telegram endpoint
    """
    # Current timestamp
    auth_date = str(int(time.time()))

    # Build data dictionary (without hash initially)
    data = {
        "id": str(user.id),
        "first_name": user.first_name,
        "auth_date": auth_date,
    }

    # Add optional fields if available
    if user.last_name:
        data["last_name"] = user.last_name

    if user.username:
        data["username"] = user.username

    # Compute hash
    computed_hash = compute_telegram_hash(data)

    # Add hash to data
    data["hash"] = computed_hash

    logger.info(f"Prepared auth data for user {user.id} (@{user.username})")

    return data


def is_user_allowed(user_id: int) -> bool:
    """
    Check if user is allowed to use the bot.

    If ALLOWED_TELEGRAM_IDS is configured, only those users can use the bot.
    If not configured (empty list), all users are allowed.

    Args:
        user_id: Telegram user ID

    Returns:
        bool: True if user is allowed, False otherwise

    Example:
        >>> if not is_user_allowed(update.effective_user.id):
        >>>     await update.message.reply_text("Access denied")
        >>>     return
    """
    allowed_ids = settings.allowed_telegram_ids_list

    # If no restriction configured, allow everyone
    if not allowed_ids:
        return True

    # Check if user is in allowed list
    is_allowed = user_id in allowed_ids

    if not is_allowed:
        logger.warning(f"Access denied for user {user_id} (not in allowed list)")

    return is_allowed
