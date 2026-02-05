"""
Avatar caching service for user profile photos.

This module handles downloading and caching user avatars from Telegram.
Avatars are stored locally to prevent broken links when Telegram URLs expire.

Security considerations:
- Validates image content type before saving
- Limits file size to prevent DoS
- Sanitizes filenames to prevent path traversal
- Uses httpOnly for download security
"""
import logging
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

# Configuration
AVATARS_DIR = Path("frontend/web/static/avatars")
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp"}
REQUEST_TIMEOUT = 10.0  # seconds


async def download_user_avatar(
    telegram_photo_url: str,
    user_id: int
) -> str | None:
    """
    Download user avatar from Telegram and save locally.

    Args:
        telegram_photo_url: URL to avatar image from Telegram
        user_id: User's database ID (used for filename)

    Returns:
        Local path to saved avatar (e.g., '/static/avatars/123.jpg')
        or None if download failed

    Example:
        >>> avatar_path = await download_user_avatar(
        ...     "https://t.me/i/userpic/320/user.jpg",
        ...     user_id=123
        ... )
        >>> print(avatar_path)
        '/static/avatars/123.jpg'

    Security:
        - Validates Content-Type header
        - Enforces max file size limit
        - Uses timeout to prevent hanging requests
        - Sanitizes filename (user_id only)

    Notes:
        - Creates avatars directory if not exists
        - Overwrites existing avatar for same user_id
        - Returns None on any error (non-blocking)
        - Logs errors for monitoring

    Related:
        - auth_service.update_user_profile()
        - endpoints/auth.py telegram_callback()
    """
    try:
        # Ensure avatars directory exists
        AVATARS_DIR.mkdir(parents=True, exist_ok=True)

        # Download image from Telegram
        async with httpx.AsyncClient() as client:
            response = await client.get(
                telegram_photo_url,
                timeout=REQUEST_TIMEOUT,
                follow_redirects=True
            )

            # Check HTTP status
            if response.status_code != 200:
                logger.warning(
                    f"Failed to download avatar for user {user_id}: "
                    f"HTTP {response.status_code}"
                )
                return None

            # Validate Content-Type
            content_type = response.headers.get("content-type", "").lower()
            if not any(allowed in content_type for allowed in ALLOWED_CONTENT_TYPES):
                logger.warning(
                    f"Invalid content type for user {user_id} avatar: {content_type}"
                )
                return None

            # Check file size
            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > MAX_FILE_SIZE:
                logger.warning(
                    f"Avatar too large for user {user_id}: {content_length} bytes"
                )
                return None

            # Get image content
            image_data = response.content

            # Enforce size limit on actual content
            if len(image_data) > MAX_FILE_SIZE:
                logger.warning(
                    f"Avatar content too large for user {user_id}: {len(image_data)} bytes"
                )
                return None

        # Determine file extension from content type
        extension_map = {
            "image/jpeg": "jpg",
            "image/jpg": "jpg",
            "image/png": "png",
            "image/webp": "webp"
        }
        ext = "jpg"  # default
        for ct, e in extension_map.items():
            if ct in content_type:
                ext = e
                break

        # Save to local file
        # Filename format: {user_id}.{ext}
        filename = f"{user_id}.{ext}"
        filepath = AVATARS_DIR / filename

        # Write image data
        filepath.write_bytes(image_data)

        # Return web-accessible path
        # Format: /static/avatars/{user_id}.jpg
        web_path = f"/static/avatars/{filename}"

        logger.info(f"Successfully cached avatar for user {user_id}: {web_path}")

        return web_path

    except httpx.TimeoutException:
        logger.error(f"Timeout downloading avatar for user {user_id}")
        return None

    except httpx.HTTPError as e:
        logger.error(f"HTTP error downloading avatar for user {user_id}: {e}")
        return None

    except OSError as e:
        logger.error(f"File system error saving avatar for user {user_id}: {e}")
        return None

    except Exception as e:
        logger.error(f"Unexpected error downloading avatar for user {user_id}: {e}")
        return None


async def delete_user_avatar(user_id: int) -> None:
    """
    Delete cached avatar for a user.

    Removes all avatar files for the given user_id, regardless of extension.

    Args:
        user_id: User's database ID

    Example:
        >>> await delete_user_avatar(123)

    Notes:
        - Silently succeeds if avatar doesn't exist
        - Removes all extensions (.jpg, .png, .webp)
        - Logs errors but doesn't raise exceptions

    Related:
        - Admin user deletion
        - Avatar refresh workflow
    """
    try:
        # Ensure directory exists
        if not AVATARS_DIR.exists():
            return

        # Delete all possible avatar files for this user
        for ext in ["jpg", "jpeg", "png", "webp"]:
            filepath = AVATARS_DIR / f"{user_id}.{ext}"
            if filepath.exists():
                filepath.unlink()
                logger.info(f"Deleted avatar for user {user_id}: {filepath.name}")

    except OSError as e:
        logger.error(f"Error deleting avatar for user {user_id}: {e}")

    except Exception as e:
        logger.error(f"Unexpected error deleting avatar for user {user_id}: {e}")


def get_avatar_path(user_id: int) -> str | None:
    """
    Get local path to user's cached avatar if it exists.

    Args:
        user_id: User's database ID

    Returns:
        Web path to avatar (e.g., '/static/avatars/123.jpg') or None

    Example:
        >>> path = get_avatar_path(123)
        >>> print(path)
        '/static/avatars/123.jpg'

    Notes:
        - Returns first found avatar (checks jpg, png, webp)
        - Returns None if no avatar exists
        - Synchronous function (fast filesystem check)

    Related:
        - User profile display
        - Avatar existence check
    """
    try:
        if not AVATARS_DIR.exists():
            return None

        # Check for avatar with any supported extension
        for ext in ["jpg", "jpeg", "png", "webp"]:
            filepath = AVATARS_DIR / f"{user_id}.{ext}"
            if filepath.exists():
                return f"/static/avatars/{filepath.name}"

        return None

    except Exception as e:
        logger.error(f"Error checking avatar for user {user_id}: {e}")
        return None
