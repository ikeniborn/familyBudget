"""
/settings command handler for user preferences.

Allows users to configure bot settings:
- Language (Russian/English)
- Currency symbol (₽/$/)
- Date format (DD.MM.YYYY / MM/DD/YYYY)
- Notifications (on/off)
"""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes, ConversationHandler

from bot.utils.logger import get_logger
from bot.utils.session import SessionManager

logger = get_logger(__name__)

# Conversation states
SELECT_SETTING, CONFIRM = range(2)

# Settings keys (stored in context.user_data)
KEY_LANGUAGE = "settings_language"
KEY_CURRENCY = "settings_currency"
KEY_DATE_FORMAT = "settings_date_format"
KEY_NOTIFICATIONS = "settings_notifications"
KEY_BUDGET_THRESHOLD = "settings_budget_threshold"

# Default settings
DEFAULT_SETTINGS = {
    KEY_LANGUAGE: "ru",
    KEY_CURRENCY: "₽",
    KEY_DATE_FORMAT: "DD.MM.YYYY",
    KEY_NOTIFICATIONS: True,
    KEY_BUDGET_THRESHOLD: 90,  # 90% threshold by default
}


async def settings_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /settings command.

    Shows current settings and menu for changing them.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: Next conversation state (SELECT_SETTING or END)
    """
    user = update.effective_user

    if not user:
        logger.warning("/settings called without user context")
        return ConversationHandler.END

    logger.info(f"/settings command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /settings attempt from user {user.id}")
        return ConversationHandler.END

    # Load current settings (or defaults)
    current_settings = get_user_settings(context)

    # Build settings menu keyboard
    keyboard = build_settings_menu(current_settings)

    settings_text = format_settings_display(current_settings)

    await update.message.reply_text(
        settings_text,
        reply_markup=keyboard,
        parse_mode="Markdown"
    )

    return SELECT_SETTING


def get_user_settings(context: ContextTypes.DEFAULT_TYPE) -> dict:
    """
    Get user settings from context (or defaults).

    Args:
        context: Bot context

    Returns:
        dict: User settings
    """
    settings = {}
    for key, default_value in DEFAULT_SETTINGS.items():
        settings[key] = context.user_data.get(key, default_value)
    return settings


def build_settings_menu(current_settings: dict) -> InlineKeyboardMarkup:
    """
    Build inline keyboard for settings menu.

    Args:
        current_settings: Current user settings

    Returns:
        InlineKeyboardMarkup: Settings menu keyboard
    """
    language = current_settings[KEY_LANGUAGE]
    currency = current_settings[KEY_CURRENCY]
    date_format = current_settings[KEY_DATE_FORMAT]
    notifications = current_settings[KEY_NOTIFICATIONS]
    budget_threshold = current_settings[KEY_BUDGET_THRESHOLD]

    keyboard = [
        [InlineKeyboardButton(
            f"🌐 Язык: {get_language_name(language)}",
            callback_data="setting:language"
        )],
        [InlineKeyboardButton(
            f"💱 Валюта: {currency}",
            callback_data="setting:currency"
        )],
        [InlineKeyboardButton(
            f"📅 Формат даты: {date_format}",
            callback_data="setting:date_format"
        )],
        [InlineKeyboardButton(
            f"🔔 Уведомления: {'Вкл' if notifications else 'Выкл'}",
            callback_data="setting:notifications"
        )],
        [InlineKeyboardButton(
            f"⚠️ Порог бюджета: {budget_threshold}%",
            callback_data="setting:budget_threshold"
        )],
        [InlineKeyboardButton("✅ Готово", callback_data="settings:done")],
    ]

    return InlineKeyboardMarkup(keyboard)


def get_language_name(code: str) -> str:
    """Get language display name from code."""
    languages = {
        "ru": "Русский",
        "en": "English"
    }
    return languages.get(code, code)


def format_settings_display(settings: dict) -> str:
    """
    Format settings display message.

    Args:
        settings: User settings dict

    Returns:
        str: Formatted message (Markdown)
    """
    language = get_language_name(settings[KEY_LANGUAGE])
    currency = settings[KEY_CURRENCY]
    date_format = settings[KEY_DATE_FORMAT]
    notifications = "Включены" if settings[KEY_NOTIFICATIONS] else "Выключены"
    budget_threshold = settings[KEY_BUDGET_THRESHOLD]

    return f"""⚙️ **Настройки профиля**

Текущие настройки:

🌐 Язык: **{language}**
💱 Валюта: **{currency}**
📅 Формат даты: **{date_format}**
🔔 Уведомления: **{notifications}**
⚠️ Порог бюджета: **{budget_threshold}%**

Выберите настройку для изменения:"""


async def setting_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle setting selection from menu.

    Args:
        update: Telegram update (callback query)
        context: Bot context

    Returns:
        int: Next conversation state
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle "Done" button
    if callback_data == "settings:done":
        current_settings = get_user_settings(context)
        await query.edit_message_text(
            "✅ Настройки сохранены!\n\n"
            f"🌐 Язык: {get_language_name(current_settings[KEY_LANGUAGE])}\n"
            f"💱 Валюта: {current_settings[KEY_CURRENCY]}\n"
            f"📅 Формат даты: {current_settings[KEY_DATE_FORMAT]}\n"
            f"🔔 Уведомления: {'Вкл' if current_settings[KEY_NOTIFICATIONS] else 'Выкл'}"
        )
        return ConversationHandler.END

    # Parse setting selection
    if not callback_data.startswith("setting:"):
        await query.edit_message_text("❌ Ошибка при выборе настройки.")
        return ConversationHandler.END

    setting_key = callback_data.split(":", 1)[1]

    # Show options for selected setting
    if setting_key == "language":
        keyboard = [
            [InlineKeyboardButton("🇷🇺 Русский", callback_data="set:language:ru")],
            [InlineKeyboardButton("🇬🇧 English", callback_data="set:language:en")],
            [InlineKeyboardButton("« Назад", callback_data="settings:back")],
        ]
        await query.edit_message_text(
            "🌐 **Выбор языка**\n\n"
            "Выберите язык интерфейса:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    elif setting_key == "currency":
        keyboard = [
            [InlineKeyboardButton("₽ Рубль", callback_data="set:currency:₽")],
            [InlineKeyboardButton("$ Доллар", callback_data="set:currency:$")],
            [InlineKeyboardButton("€ Евро", callback_data="set:currency:€")],
            [InlineKeyboardButton("« Назад", callback_data="settings:back")],
        ]
        await query.edit_message_text(
            "💱 **Выбор валюты**\n\n"
            "Выберите валюту для отображения:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    elif setting_key == "date_format":
        keyboard = [
            [InlineKeyboardButton("DD.MM.YYYY (13.10.2025)", callback_data="set:date_format:DD.MM.YYYY")],
            [InlineKeyboardButton("MM/DD/YYYY (10/13/2025)", callback_data="set:date_format:MM/DD/YYYY")],
            [InlineKeyboardButton("YYYY-MM-DD (2025-10-13)", callback_data="set:date_format:YYYY-MM-DD")],
            [InlineKeyboardButton("« Назад", callback_data="settings:back")],
        ]
        await query.edit_message_text(
            "📅 **Формат даты**\n\n"
            "Выберите формат отображения дат:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    elif setting_key == "notifications":
        current_notifications = context.user_data.get(KEY_NOTIFICATIONS, DEFAULT_SETTINGS[KEY_NOTIFICATIONS])
        keyboard = [
            [InlineKeyboardButton("🔔 Включить", callback_data="set:notifications:on")],
            [InlineKeyboardButton("🔕 Выключить", callback_data="set:notifications:off")],
            [InlineKeyboardButton("« Назад", callback_data="settings:back")],
        ]
        status = "включены" if current_notifications else "выключены"
        await query.edit_message_text(
            f"🔔 **Уведомления**\n\n"
            f"Текущий статус: **{status}**\n\n"
            f"Уведомления включают:\n"
            f"• Напоминания о бюджете\n"
            f"• Превышение лимитов\n"
            f"• Статистика за период",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    elif setting_key == "budget_threshold":
        current_threshold = context.user_data.get(KEY_BUDGET_THRESHOLD, DEFAULT_SETTINGS[KEY_BUDGET_THRESHOLD])
        keyboard = [
            [InlineKeyboardButton("⚠️ 50%", callback_data="set:budget_threshold:50")],
            [InlineKeyboardButton("⚠️ 70%", callback_data="set:budget_threshold:70")],
            [InlineKeyboardButton("⚠️ 80%", callback_data="set:budget_threshold:80")],
            [InlineKeyboardButton("⚠️ 90% (рекомендуется)", callback_data="set:budget_threshold:90")],
            [InlineKeyboardButton("⚠️ 95%", callback_data="set:budget_threshold:95")],
            [InlineKeyboardButton("« Назад", callback_data="settings:back")],
        ]
        await query.edit_message_text(
            f"⚠️ **Порог уведомлений о бюджете**\n\n"
            f"Текущий порог: **{current_threshold}%**\n\n"
            f"Вы получите уведомление, когда расходы достигнут\n"
            f"указанного процента от запланированного бюджета.\n\n"
            f"Выберите порог уведомлений:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    return SELECT_SETTING


async def setting_value_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle setting value selection.

    Args:
        update: Telegram update (callback query)
        context: Bot context

    Returns:
        int: Next conversation state
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle back button
    if callback_data == "settings:back":
        current_settings = get_user_settings(context)
        keyboard = build_settings_menu(current_settings)
        settings_text = format_settings_display(current_settings)
        await query.edit_message_text(
            settings_text,
            reply_markup=keyboard,
            parse_mode="Markdown"
        )
        return SELECT_SETTING

    # Parse setting value
    if not callback_data.startswith("set:"):
        return SELECT_SETTING

    parts = callback_data.split(":", 2)
    if len(parts) != 3:
        return SELECT_SETTING

    _, setting_key, value = parts

    # Update setting in context
    if setting_key == "language":
        context.user_data[KEY_LANGUAGE] = value
    elif setting_key == "currency":
        context.user_data[KEY_CURRENCY] = value
    elif setting_key == "date_format":
        context.user_data[KEY_DATE_FORMAT] = value
    elif setting_key == "notifications":
        context.user_data[KEY_NOTIFICATIONS] = (value == "on")
    elif setting_key == "budget_threshold":
        context.user_data[KEY_BUDGET_THRESHOLD] = int(value)

    logger.info(f"Setting updated: {setting_key} = {value}")

    # Show updated settings menu
    current_settings = get_user_settings(context)
    keyboard = build_settings_menu(current_settings)
    settings_text = format_settings_display(current_settings)

    await query.edit_message_text(
        settings_text,
        reply_markup=keyboard,
        parse_mode="Markdown"
    )

    return SELECT_SETTING


async def cancel_settings(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /cancel in settings conversation.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: ConversationHandler.END
    """
    await update.message.reply_text(
        "❌ Настройки не изменены."
    )
    return ConversationHandler.END


# Build ConversationHandler
settings_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("settings", settings_handler)],
    states={
        SELECT_SETTING: [
            CallbackQueryHandler(setting_value_selected, pattern="^set:"),
            CallbackQueryHandler(setting_selected, pattern="^setting:"),
            CallbackQueryHandler(setting_value_selected, pattern="^settings:"),
        ],
    },
    fallbacks=[CommandHandler("cancel", cancel_settings)],
    name="settings_conversation",
    persistent=False,
    per_message=True,
)
