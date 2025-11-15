"""
User session management.

Manages user authentication state and JWT tokens using bot context.
"""

from typing import Optional

from telegram.ext import ContextTypes

from bot.utils.logger import get_logger

logger = get_logger(__name__)


class SessionManager:
    """
    Manages user sessions with JWT token storage.

    Uses context.user_data to persist session information between updates.
    """

    # Keys for context.user_data
    KEY_ACCESS_TOKEN = "access_token"
    KEY_USER_INFO = "user_info"
    KEY_AUTHENTICATED = "authenticated"

    @staticmethod
    def set_session(
        context: ContextTypes.DEFAULT_TYPE,
        access_token: str,
        user_info: dict
    ):
        """
        Store user session data.

        Args:
            context: Bot context
            access_token: JWT access token from backend
            user_info: User information from backend
        """
        context.user_data[SessionManager.KEY_ACCESS_TOKEN] = access_token
        context.user_data[SessionManager.KEY_USER_INFO] = user_info
        context.user_data[SessionManager.KEY_AUTHENTICATED] = True

        user_id = user_info.get("telegram_id")
        username = user_info.get("username")
        logger.info(f"Session stored for user {user_id} (@{username})")

    @staticmethod
    def get_access_token(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
        """
        Get stored access token.

        Args:
            context: Bot context

        Returns:
            str: Access token if authenticated, None otherwise
        """
        return context.user_data.get(SessionManager.KEY_ACCESS_TOKEN)

    @staticmethod
    def get_user_info(context: ContextTypes.DEFAULT_TYPE) -> Optional[dict]:
        """
        Get stored user information.

        Args:
            context: Bot context

        Returns:
            dict: User info if authenticated, None otherwise
        """
        return context.user_data.get(SessionManager.KEY_USER_INFO)

    @staticmethod
    def is_authenticated(context: ContextTypes.DEFAULT_TYPE) -> bool:
        """
        Check if user is authenticated.

        Args:
            context: Bot context

        Returns:
            bool: True if user has valid session, False otherwise
        """
        return context.user_data.get(SessionManager.KEY_AUTHENTICATED, False)

    @staticmethod
    def clear_session(context: ContextTypes.DEFAULT_TYPE):
        """
        Clear user session (logout).

        Args:
            context: Bot context
        """
        context.user_data.pop(SessionManager.KEY_ACCESS_TOKEN, None)
        context.user_data.pop(SessionManager.KEY_USER_INFO, None)
        context.user_data.pop(SessionManager.KEY_AUTHENTICATED, None)

        logger.info("Session cleared")

    @staticmethod
    def get_user_display_name(context: ContextTypes.DEFAULT_TYPE) -> str:
        """
        Get user's display name for messages.

        Args:
            context: Bot context

        Returns:
            str: User's first name, username, or "пользователь"
        """
        user_info = SessionManager.get_user_info(context)

        if not user_info:
            return "пользователь"

        # Try first_name, then username, then fallback
        first_name = user_info.get("first_name")
        if first_name:
            return first_name

        username = user_info.get("username")
        if username:
            return f"@{username}"

        return "пользователь"


# Convenience functions
def get_token(context: ContextTypes.DEFAULT_TYPE) -> Optional[str]:
    """Get access token from session."""
    return SessionManager.get_access_token(context)


def is_authenticated(context: ContextTypes.DEFAULT_TYPE) -> bool:
    """Check if user is authenticated."""
    return SessionManager.is_authenticated(context)


def require_auth(context: ContextTypes.DEFAULT_TYPE) -> bool:
    """
    Check authentication and return status.

    Use this in command handlers that require authentication.

    Returns:
        bool: True if authenticated, False otherwise

    Example:
        >>> if not require_auth(context):
        >>>     await update.message.reply_text("Используйте /start для авторизации")
        >>>     return
    """
    return SessionManager.is_authenticated(context)
