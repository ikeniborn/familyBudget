"""
/start command handler.

Handles user authentication via Telegram OAuth and welcomes new users.
"""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.telegram_auth import is_user_allowed, prepare_telegram_auth_data

logger = get_logger(__name__)


def create_main_menu_keyboard() -> InlineKeyboardMarkup:
    """
    Create main menu keyboard with bot commands.

    Returns:
        InlineKeyboardMarkup: Keyboard with 9 command buttons in 3 rows
    """
    keyboard = [
        [
            InlineKeyboardButton("💰 Добавить", callback_data="menu:add"),
            InlineKeyboardButton("📅 Сегодня", callback_data="menu:today"),
            InlineKeyboardButton("📈 Статистика", callback_data="menu:stats"),
        ],
        [
            InlineKeyboardButton("📋 Список", callback_data="menu:list"),
            InlineKeyboardButton("✏️ Редактировать", callback_data="menu:edit"),
            InlineKeyboardButton("🗑️ Удалить", callback_data="menu:delete"),
        ],
        [
            InlineKeyboardButton("📊 План", callback_data="menu:addplan"),
            InlineKeyboardButton("📉 Сравнение", callback_data="menu:summary"),
            InlineKeyboardButton("🔍 Поиск", callback_data="menu:search"),
        ],
    ]
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
        keyboard = create_main_menu_keyboard()
        await update.message.reply_text(
            f"✅ Вы уже авторизованы, {user_name}!\n\n"
            f"Выберите команду из меню ниже:",
            reply_markup=keyboard
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
        keyboard = create_main_menu_keyboard()

        # Update the "authenticating" message
        await auth_message.edit_text(welcome_text, reply_markup=keyboard)

        logger.info(f"User {user.id} authenticated successfully")

    except ValueError as e:
        # Authentication failed (backend error)
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
        f"Выберите команду из меню ниже:"
    )

    return message


async def menu_callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle main menu button clicks.

    Maps menu button callback_data to corresponding bot handlers and executes them directly.

    Args:
        update: Telegram update with callback query
        context: Bot context

    Returns:
        None
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Import handlers
    from bot.handlers.add import add_command
    from bot.handlers.today import today_handler
    from bot.handlers.stats import stats_handler
    from bot.handlers.list import list_handler
    from bot.handlers.edit import edit_handler
    from bot.handlers.delete import delete_handler
    from bot.handlers.add_plan import addplan_command
    from bot.handlers.summary import summary_command
    from bot.handlers.search import search_handler

    # Map callback_data to handlers
    handler_map = {
        "menu:add": add_command,
        "menu:today": today_handler,
        "menu:stats": stats_handler,
        "menu:list": list_handler,
        "menu:edit": edit_handler,
        "menu:delete": delete_handler,
        "menu:addplan": addplan_command,
        "menu:summary": summary_command,
        "menu:search": search_handler,
    }

    handler = handler_map.get(callback_data)

    if not handler:
        logger.warning(f"Unknown menu callback: {callback_data}")
        await query.edit_message_text(
            "❌ Неизвестная команда. Используйте /start для повторного вывода меню."
        )
        return

    # Log the command execution
    user_id = query.from_user.id
    logger.info(f"Menu button '{callback_data}' clicked by user {user_id}, executing handler directly")

    # Create a modified update where message comes from the callback query
    # This allows handlers to use update.message.reply_text() normally
    class UpdateWrapper:
        """Wrapper to make callback query work with command handlers."""
        def __init__(self, original_update, query_message):
            self.update_id = original_update.update_id
            self.message = query_message  # Use query's message for replies
            self.effective_user = original_update.effective_user
            self.effective_chat = original_update.effective_chat
            self.callback_query = None  # Hide callback_query from handler

    fake_update = UpdateWrapper(update, query.message)

    # Call handler directly
    try:
        await handler(fake_update, context)
    except Exception as e:
        logger.error(f"Error executing handler for {callback_data}: {e}", exc_info=True)
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text="❌ Произошла ошибка при выполнении команды. Попробуйте еще раз."
        )
