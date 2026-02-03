"""
Telegram Web Apps initData validation service.

⚠️ CRITICAL SECURITY MODULE ⚠️
This module implements Telegram Web Apps initData validation.
Different from Login Widget validation - uses different secret key derivation.

Reference:
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

Security Requirements:
    - HMAC-SHA256 hash validation with "WebAppData" constant
    - auth_date expiration check (< 1 hour)
    - Timing-attack resistant comparison (hmac.compare_digest)
    - Strict adherence to Telegram's algorithm
"""
from typing import Optional

import hashlib
import hmac
import time
from urllib.parse import parse_qs, unquote

from backend.app.core.config import get_settings
from backend.app.core.json_utils import loads as json_loads

settings = get_settings()

# Auth expiration window (1 hour in seconds)
AUTH_DATE_EXPIRATION = 3600


def validate_webapp_initdata(init_data: str) -> tuple[bool, Optional[dict]]:
    """
    Validate Telegram Web App initData string.

    ⚠️ CRITICAL SECURITY FUNCTION ⚠️

    Implements the official Telegram Web Apps validation algorithm:
    1. Parse initData query string
    2. Extract hash and create data_check_string
    3. Compute secret_key = HMAC-SHA256("WebAppData", bot_token)  ← KEY DIFFERENCE!
    4. Compute HMAC-SHA256(secret_key, data_check_string)
    5. Compare computed hash with received hash (timing-attack safe)
    6. Check auth_date expiration (< 1 hour)

    Args:
        init_data: Raw initData string from Telegram.WebApp.initData
                   Format: "query_id=...&user={...}&auth_date=1234567890&hash=..."

    Returns:
        tuple[bool, Optional[Dict]]: (is_valid, user_data)
            - is_valid: True if validation passed
            - user_data: Parsed user dict from initData (if valid), None otherwise

    Example:
        >>> init_data = "query_id=AAH...&user=%7B%22id%22%3A123...&auth_date=1699999999&hash=abc..."
        >>> is_valid, user_data = validate_webapp_initdata(init_data)
        >>> if is_valid:
        ...     print(f"User ID: {user_data['id']}")

    Security Notes:
        - Uses hmac.compare_digest() to prevent timing attacks
        - Secret key derivation: HMAC-SHA256("WebAppData", BOT_TOKEN)
        - Data check string format: "key=value\\nkey=value\\n..." (sorted by key)
        - auth_date must be within last hour

    Algorithm difference from Login Widget:
        - Login Widget: secret_key = SHA256(bot_token)
        - Web Apps: secret_key = HMAC-SHA256("WebAppData", bot_token)  ← Different!
    """
    try:
        # Step 1: Parse initData query string
        parsed_data = parse_qs(init_data, keep_blank_values=True)

        # Convert parse_qs output (lists) to single values
        data_dict = {key: values[0] for key, values in parsed_data.items()}

        # Step 2: Extract hash
        received_hash = data_dict.pop("hash", None)
        if received_hash is None:
            return False, None

        # Step 3: Create data_check_string (sorted by key, excluding hash)
        # Format: "key=value\nkey=value\n..."
        data_check_string = "\n".join(
            [f"{key}={value}" for key, value in sorted(data_dict.items())]
        )

        # Step 4: Compute secret key (HMAC-SHA256 of "WebAppData" with bot_token)
        # ⚠️ This is DIFFERENT from Login Widget validation!
        bot_token = settings.TELEGRAM_BOT_TOKEN
        secret_key = hmac.new(
            key=b"WebAppData", msg=bot_token.encode(), digestmod=hashlib.sha256
        ).digest()

        # Step 5: Compute HMAC-SHA256 hash
        computed_hash = hmac.new(
            key=secret_key, msg=data_check_string.encode(), digestmod=hashlib.sha256
        ).hexdigest()

        # Step 6: Compare hashes (timing-attack resistant)
        if not hmac.compare_digest(computed_hash, received_hash):
            return False, None

        # Step 7: Check auth_date expiration (< 1 hour)
        auth_date = int(data_dict.get("auth_date", 0))
        current_time = int(time.time())
        if current_time - auth_date > AUTH_DATE_EXPIRATION:
            return False, None

        # Step 8: Parse user data from initData
        user_json = data_dict.get("user")
        if user_json is None:
            return False, None

        # URL decode and parse JSON
        user_data = json_loads(unquote(user_json))

        return True, user_data

    except (ValueError, KeyError):
        return False, None


def extract_user_from_initdata(user_data: dict) -> dict:
    """
    Extract user information from parsed initData user object.

    Args:
        user_data: Parsed user dict from initData
                   Example: {"id": 123456789, "first_name": "John", ...}

    Returns:
        Dict: User data in format compatible with get_or_create_user
            {
                "id": telegram_id,
                "first_name": "...",
                "last_name": "...",  # optional
                "username": "...",   # optional
                "photo_url": "..."   # optional (not in initData)
            }

    Example:
        >>> user_data = {"id": 123456789, "first_name": "John", "username": "johndoe"}
        >>> extracted = extract_user_from_initdata(user_data)
        >>> print(extracted)
        {'id': 123456789, 'first_name': 'John', 'username': 'johndoe'}
    """
    return {
        "id": user_data.get("id"),
        "first_name": user_data.get("first_name"),
        "last_name": user_data.get("last_name"),
        "username": user_data.get("username"),
        # photo_url not included in Web Apps initData
        "photo_url": None,
    }
