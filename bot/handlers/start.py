"""
/start command handler.

Handles user authentication via Telegram OAuth and welcomes new users.
Uses Menu Button (WebApp) instead of inline keyboard.
"""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ContextTypes

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.telegram_auth import is_user_allowed, prepare_telegram_auth_data

logger = get_logger(__name__)


def get_webapp_url() -> str:
    """
    Get WebApp URL from settings.

    Returns:
        str: Public WebApp URL (e.g., https://budget-dev.ikeniborn.ru/webapp/index.html)
    """
    from bot.config.settings import get_settings

    settings = get_settings()
    protocol = "https" if settings.DOMAIN != "localhost" else "http"
    port_suffix = ":8000" if settings.DOMAIN == "localhost" else ""
    return f"{protocol}://{settings.DOMAIN}{port_suffix}/webapp/index.html"


def create_webapp_keyboard() -> InlineKeyboardMarkup:
    """
    Create inline keyboard with WebApp button.

    Returns:
        InlineKeyboardMarkup: Keyboard with single WebApp button
    """
    webapp_url = get_webapp_url()
    web_app_info = WebAppInfo(url=webapp_url)

    keyboard = [[
        InlineKeyboardButton(text="🚀 Открыть приложение", web_app=web_app_info)
    ]]

    return InlineKeyboardMarkup(keyboard)


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /start command.

    Workflow:
    1. Check if user is allowed (ALLOWED_TELEGRAM_IDS)
    2. Prepare Telegram OAuth data (with HMAC-SHA256 hash)
    3. Authenticate with backend (/auth/telegram)
    4. Store JWT token in session
    5. Send welcome message

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        None
    """
    user = update.effective_user

    if not user:
        logger.warning("/start called without user context")
        return

    logger.info(f"/start command from user {user.id} (@{user.username})")

    # Check if user is allowed
    if not is_user_allowed(user.id):
        await update.message.reply_text(
            "❌ Доступ запрещен.\n\n"
            "Этот бот доступен только для авторизованных пользователей."
        )
        logger.warning(f"Access denied for user {user.id}")
        return

    # Check if already authenticated
    if SessionManager.is_authenticated(context):
        user_name = SessionManager.get_user_display_name(context)
        await update.message.reply_text(
            f"✅ Вы уже авторизованы, {user_name}!\n\n"
            f"Используйте кнопку ниже или кнопку Меню в нижней части экрана.",
            reply_markup=create_webapp_keyboard()
        )
        logger.info(f"User {user.id} already authenticated")
        return

    # Send "authenticating" message
    auth_message = await update.message.reply_text(
        "⏳ Выполняется авторизация..."
    )

    try:
        # Step 1: Prepare Telegram OAuth data
        auth_data = prepare_telegram_auth_data(user)

        # Step 2: Authenticate with backend
        api_client = await get_api_client()
        response = await api_client.authenticate_telegram_user(auth_data)

        # Step 3: Extract user info and token
        # Backend returns: {"user": {...}, "message": "...", "access_token": "..."}
        user_info = response.get("user", {})
        access_token = response.get("access_token")

        if not access_token:
            # Try to get from cookies (some backends return it in cookies only)
            logger.warning("No access_token in response body, this may be an issue")
            raise ValueError("Backend did not return access token")

        # Step 4: Store session
        SessionManager.set_session(
            context=context,
            access_token=access_token,
            user_info=user_info
        )

        # Step 5: Send welcome message
        first_name = user_info.get("first_name", user.first_name)
        is_admin = user_info.get("is_admin", False)

        welcome_text = format_welcome_message(first_name, is_admin)

        # Update the "authenticating" message
        await auth_message.edit_text(
            welcome_text,
            reply_markup=create_webapp_keyboard()
        )

        logger.info(f"User {user.id} authenticated successfully")

    except ValueError as e:
        # Check if error is 403 Forbidden (user not registered)
        error_message = str(e)
        if "403" in error_message or "Access denied" in error_message or "not registered" in error_message:
            # User not registered in database
            logger.warning(f"Access denied for user {user.id}: user not registered by administrator")
            await auth_message.edit_text(
                "❌ Доступ запрещен.\n\n"
                "Вы не зарегистрированы в системе.\n"
                "Пожалуйста, обратитесь к администратору для создания учетной записи.\n\n"
                f"Ваш Telegram ID: {user.id}"
            )
        else:
            # Other authentication errors
            logger.error(f"Authentication failed for user {user.id}: {e}")
            await auth_message.edit_text(
                "❌ Ошибка авторизации.\n\n"
                "Не удалось выполнить вход. Попробуйте позже."
            )

    except Exception as e:
        # Unexpected error
        logger.error(f"Unexpected error during authentication: {e}", exc_info=True)
        await auth_message.edit_text(
            "❌ Произошла ошибка.\n\n"
            "Пожалуйста, попробуйте еще раз позже."
        )


def format_welcome_message(first_name: str, is_admin: bool = False) -> str:
    """
    Format welcome message for authenticated user.

    Args:
        first_name: User's first name
        is_admin: Whether user has admin privileges

    Returns:
        str: Formatted welcome message
    """
    role_text = "👑 Администратор" if is_admin else "👤 Пользователь"

    message = (
        f"✅ Добро пожаловать, {first_name}!\n\n"
        f"Роль: {role_text}\n\n"
        f"💡 Используйте кнопку Start (📱) в нижней части экрана для доступа к приложению.\n\n"
        f"📊 Все функции доступны через удобный WebApp интерфейс:\n"
        f"• Добавление транзакций\n"
        f"• Просмотр статистики\n"
        f"• Планирование бюджета\n"
        f"• И многое другое..."
    )

    return message


async def menu_callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Legacy menu callback handler - no longer used.

    Inline keyboard menu was replaced with Telegram Menu Button (WebApp).
    This handler is kept for backwards compatibility but should not be triggered.
    """
    query = update.callback_query
    await query.answer()

    logger.warning(f"Legacy menu callback triggered: {query.data}")
    await query.edit_message_text(
        "⚠️ Этот интерфейс устарел.\n\n"
        "Используйте кнопку Start (📱) в нижней части экрана для доступа к WebApp."
    )
