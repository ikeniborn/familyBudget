"""
/help command handler.

Displays list of available commands with descriptions.
"""

from telegram import Update
from telegram.ext import ContextTypes

from bot.utils.logger import get_logger
from bot.utils.session import SessionManager

logger = get_logger(__name__)


async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /help command.

    Shows all available commands with descriptions.
    Different commands shown based on authentication status.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        None
    """
    user = update.effective_user

    if not user:
        logger.warning("/help called without user context")
        return

    logger.info(f"/help command from user {user.id} (@{user.username})")

    # Check if user is authenticated
    is_authenticated = SessionManager.is_authenticated(context)

    if is_authenticated:
        user_name = SessionManager.get_user_display_name(context)
        help_text = format_authenticated_help(user_name)
    else:
        help_text = format_unauthenticated_help()

    await update.message.reply_text(
        help_text,
        parse_mode="Markdown"
    )

    logger.info(f"Help displayed for user {user.id} (authenticated: {is_authenticated})")


def format_authenticated_help(user_name: str) -> str:
    """
    Format help message for authenticated users.

    Args:
        user_name: User's display name

    Returns:
        str: Formatted help message (Markdown)
    """
    return f"""📖 **Справка по командам**

Привет, {user_name}! 👋

Вот список доступных команд:

**📊 Основные команды:**

/start - Авторизация в системе
_Войти в бот через Telegram OAuth_

/today - Статистика за сегодня
_Просмотр доходов и расходов за текущий день_

**📝 Управление транзакциями:**

/list - Список транзакций
_Просмотр последних транзакций_

/search - Поиск транзакций
_Найти транзакцию по описанию или категории_

**⚙️ Настройки:**

/settings - Настройки профиля
_Изменить настройки бота_

/export - Экспорт данных
_Выгрузить транзакции в файл_

**ℹ️ Помощь:**

/help - Показать эту справку
_Список всех команд_

/cancel - Отменить текущую операцию
_Прервать добавление транзакции_

**💡 Советы:**

• /today покажет баланс дня
• В любой момент можно отправить /cancel для отмены

**🆘 Нужна помощь?**
Если у вас возникли вопросы, обратитесь к администратору."""


def format_unauthenticated_help() -> str:
    """
    Format help message for unauthenticated users.

    Returns:
        str: Formatted help message (Markdown)
    """
    return """📖 **Справка по командам**

Добро пожаловать! 👋

Для начала работы с ботом необходимо авторизоваться.

**🔐 Авторизация:**

/start - Войти в систему
_Авторизация через Telegram OAuth_

**ℹ️ Помощь:**

/help - Показать эту справку
_Список доступных команд_

**После авторизации вам будут доступны:**

📊 Добавление транзакций
📅 Просмотр статистики
📝 Управление данными
⚙️ Настройки профиля

**Начните с команды /start** для входа в систему.

**🆘 Нужна помощь?**
Если у вас возникли вопросы, обратитесь к администратору."""
