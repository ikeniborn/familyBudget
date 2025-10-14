"""
/edit command handler for editing transactions.

Allows users to edit transaction fields:
- Amount
- Date
- Description
- Category (article)
"""

from datetime import date
from decimal import Decimal

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.validators import (
    ValidationError,
    format_amount,
    format_date,
    validate_amount,
    validate_date,
    validate_description,
)

logger = get_logger(__name__)

# States
ENTER_ID, SELECT_FIELD, ENTER_VALUE = range(3)

# Context keys
KEY_FACT_ID = "edit_fact_id"
KEY_FACT_DATA = "edit_fact_data"
KEY_ARTICLE_DATA = "edit_article_data"
KEY_EDIT_FIELD = "edit_field"


async def edit_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /edit command.

    Asks user for transaction ID to edit.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: Next conversation state (ENTER_ID or END)
    """
    user = update.effective_user

    if not user:
        logger.warning("/edit called without user context")
        return ConversationHandler.END

    logger.info(f"/edit command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /edit attempt from user {user.id}")
        return ConversationHandler.END

    await update.message.reply_text(
        "✏️ **Редактирование транзакции**\n\n"
        "Введите ID транзакции для редактирования:\n\n"
        "_ID можно найти в /list или внизу сообщений о транзакциях_\n\n"
        "Отправьте /cancel для отмены",
        parse_mode="Markdown"
    )

    return ENTER_ID


async def id_entered(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle transaction ID input.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: Next conversation state (SELECT_FIELD or stay in ENTER_ID)
    """
    user_input = update.message.text.strip()

    # Validate ID format
    try:
        fact_id = int(user_input)
    except ValueError:
        await update.message.reply_text(
            "❌ Неверный формат ID.\n\n"
            "ID должен быть числом. Попробуйте еще раз или отправьте /cancel"
        )
        return ENTER_ID

    # Fetch transaction details
    try:
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Get fact by ID
        fact = await api_client.get_fact(token, fact_id)

        # Fetch article for name
        article_id = fact.get("article_id")
        article = await api_client.get_article(token, article_id)

        # Store in context
        context.user_data[KEY_FACT_ID] = fact_id
        context.user_data[KEY_FACT_DATA] = fact
        context.user_data[KEY_ARTICLE_DATA] = article

        # Show field selection menu
        await show_field_selection(update.message, context, fact, article)

        return SELECT_FIELD

    except Exception as e:
        logger.error(f"Error fetching fact {fact_id}: {e}", exc_info=True)

        # Check error type
        error_message = str(e)
        if "404" in error_message or "not found" in error_message.lower():
            await update.message.reply_text(
                f"❌ Транзакция с ID {fact_id} не найдена.\n\n"
                f"Проверьте ID и попробуйте еще раз или отправьте /cancel"
            )
        elif "403" in error_message or "forbidden" in error_message.lower():
            await update.message.reply_text(
                f"❌ У вас нет доступа к транзакции с ID {fact_id}.\n\n"
                f"Попробуйте другой ID или отправьте /cancel"
            )
        else:
            await update.message.reply_text(
                "❌ Произошла ошибка при загрузке транзакции.\n\n"
                "Попробуйте позже или отправьте /cancel"
            )

        return ENTER_ID


async def show_field_selection(message_or_query, context: ContextTypes.DEFAULT_TYPE, fact: dict, article: dict, edit_message: bool = False):
    """
    Show field selection menu.

    Args:
        message_or_query: Message or CallbackQuery object
        context: Bot context
        fact: Fact data
        article: Article data
        edit_message: Whether to edit existing message
    """
    fact_date = fact.get("fact_date", "")
    amount = Decimal(str(fact.get("amount", "0")))
    description = fact.get("description", "")
    article_name = article.get("name", "???")
    article_type = article.get("type", "unknown")

    # Format date
    try:
        date_obj = date.fromisoformat(fact_date)
        formatted_date = format_date(date_obj)
    except (ValueError, TypeError):
        formatted_date = fact_date

    # Type display
    type_emoji = "💵" if article_type == "income" else "💸"
    type_text = "Доход" if article_type == "income" else "Расход"

    description_display = description if description else "_не указано_"

    text = f"""✏️ **Редактирование транзакции**

Текущие данные:

{type_emoji} **{type_text}**
Категория: {article_name}
Сумма: {format_amount(amount)} ₽
Дата: {formatted_date}
Описание: {description_display}

Выберите поле для изменения:"""

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("💰 Изменить сумму", callback_data="edit:field:amount")],
        [InlineKeyboardButton("📅 Изменить дату", callback_data="edit:field:date")],
        [InlineKeyboardButton("📝 Изменить описание", callback_data="edit:field:description")],
        [InlineKeyboardButton("✅ Готово", callback_data="edit:done")],
        [InlineKeyboardButton("❌ Отмена", callback_data="edit:cancel")],
    ])

    if edit_message and hasattr(message_or_query, "edit_message_text"):
        await message_or_query.edit_message_text(text, reply_markup=keyboard, parse_mode="Markdown")
    else:
        await message_or_query.reply_text(text, reply_markup=keyboard, parse_mode="Markdown")


async def field_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle field selection.

    Args:
        update: Telegram update (callback query)
        context: Bot context

    Returns:
        int: Next conversation state
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle cancel
    if callback_data == "edit:cancel":
        await query.edit_message_text("❌ Редактирование отменено")
        return ConversationHandler.END

    # Handle done
    if callback_data == "edit:done":
        await query.edit_message_text(
            "✅ Редактирование завершено!\n\n"
            "Используйте /list для просмотра обновлённой транзакции"
        )
        return ConversationHandler.END

    # Parse field selection
    if not callback_data.startswith("edit:field:"):
        return SELECT_FIELD

    field = callback_data.split(":", 2)[2]
    context.user_data[KEY_EDIT_FIELD] = field

    # Ask for new value
    if field == "amount":
        await query.edit_message_text(
            "💰 **Изменение суммы**\n\n"
            "Введите новую сумму:\n\n"
            "_Примеры: 100, 50.75, 1000,50, 1 500_\n\n"
            "Отправьте /cancel для отмены",
            parse_mode="Markdown"
        )
    elif field == "date":
        await query.edit_message_text(
            "📅 **Изменение даты**\n\n"
            "Введите новую дату:\n\n"
            "_Примеры: сегодня, вчера, 13.10.2025, 13.10_\n\n"
            "Отправьте /cancel для отмены",
            parse_mode="Markdown"
        )
    elif field == "description":
        current_desc = context.user_data[KEY_FACT_DATA].get("description", "")
        current_display = current_desc if current_desc else "_пусто_"
        await query.edit_message_text(
            f"📝 **Изменение описания**\n\n"
            f"Текущее описание: {current_display}\n\n"
            f"Введите новое описание:\n\n"
            f"_Или отправьте '-' для удаления описания_\n\n"
            f"Отправьте /cancel для отмены",
            parse_mode="Markdown"
        )

    return ENTER_VALUE


async def value_entered(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle new value input.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: Next conversation state (SELECT_FIELD or stay in ENTER_VALUE)
    """
    user_input = update.message.text.strip()
    field = context.user_data.get(KEY_EDIT_FIELD)

    if not field:
        await update.message.reply_text("❌ Ошибка: поле не выбрано")
        return ConversationHandler.END

    try:
        # Validate and convert value
        if field == "amount":
            new_value = str(validate_amount(user_input))
        elif field == "date":
            new_value = validate_date(user_input).isoformat()
        elif field == "description":
            if user_input == "-":
                new_value = None
            else:
                new_value = validate_description(user_input)
        else:
            await update.message.reply_text("❌ Неизвестное поле")
            return ConversationHandler.END

        # Update transaction via API
        fact_id = context.user_data.get(KEY_FACT_ID)

        if not fact_id:
            await update.message.reply_text("❌ Ошибка: ID транзакции не найден")
            return ConversationHandler.END

        loading_msg = await update.message.reply_text("⏳ Обновление транзакции...")

        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Prepare update data
        update_data = {field: new_value} if new_value is not None else {field: None}

        # Update fact
        updated_fact = await api_client.update_fact(token, fact_id, **update_data)

        # Fetch updated article (in case it changed)
        article_id = updated_fact.get("article_id")
        article = await api_client.get_article(token, article_id)

        # Update context
        context.user_data[KEY_FACT_DATA] = updated_fact
        context.user_data[KEY_ARTICLE_DATA] = article

        # Delete loading message
        await loading_msg.delete()

        # Show success message and return to field selection
        success_msg = await update.message.reply_text(
            f"✅ {get_field_name(field)} обновлено!\n\n"
            f"Продолжайте редактирование или нажмите \"Готово\"",
            parse_mode="Markdown"
        )

        # Wait a moment then show field selection again
        import asyncio
        await asyncio.sleep(1)
        await success_msg.delete()

        await show_field_selection(update.message, context, updated_fact, article, edit_message=False)

        return SELECT_FIELD

    except ValidationError as e:
        # Validation failed
        await update.message.reply_text(
            f"{e.message}\n\n"
            f"Попробуйте еще раз или отправьте /cancel"
        )
        return ENTER_VALUE

    except Exception as e:
        logger.error(f"Error updating fact: {e}", exc_info=True)
        await update.message.reply_text(
            "❌ Произошла ошибка при обновлении транзакции.\n\n"
            "Попробуйте позже или отправьте /cancel"
        )
        return ENTER_VALUE


def get_field_name(field: str) -> str:
    """Get Russian field name."""
    field_names = {
        "amount": "Сумма",
        "date": "Дата",
        "description": "Описание",
    }
    return field_names.get(field, field)


async def cancel_edit(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /cancel in edit conversation.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: ConversationHandler.END
    """
    await update.message.reply_text("❌ Редактирование отменено")
    return ConversationHandler.END


# Build ConversationHandler
edit_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("edit", edit_handler)],
    states={
        ENTER_ID: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, id_entered)
        ],
        SELECT_FIELD: [
            CallbackQueryHandler(field_selected, pattern="^edit:")
        ],
        ENTER_VALUE: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, value_entered)
        ],
    },
    fallbacks=[CommandHandler("cancel", cancel_edit)],
    name="edit_conversation",
    persistent=False,
)
