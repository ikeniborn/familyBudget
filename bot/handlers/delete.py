"""
/delete command handler for deleting transactions.

Allows users to delete a transaction by ID with confirmation.
"""

from decimal import Decimal

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes, ConversationHandler, MessageHandler, filters

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.validators import format_amount, format_date

logger = get_logger(__name__)

# States
ENTER_ID, CONFIRM = range(2)


async def delete_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /delete command.

    Asks user for transaction ID to delete.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: Next conversation state (ENTER_ID or END)
    """
    user = update.effective_user

    if not user:
        logger.warning("/delete called without user context")
        return ConversationHandler.END

    logger.info(f"/delete command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /delete attempt from user {user.id}")
        return ConversationHandler.END

    await update.message.reply_text(
        "🗑️ **Удаление транзакции**\n\n"
        "Введите ID транзакции для удаления:\n\n"
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
        int: Next conversation state (CONFIRM or stay in ENTER_ID)
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

        # Store fact_id in context
        context.user_data["delete_fact_id"] = fact_id

        # Show confirmation
        confirmation_text = format_delete_confirmation(fact, article)

        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🗑️ Удалить", callback_data="delete:confirm"),
                InlineKeyboardButton("❌ Отмена", callback_data="delete:cancel")
            ]
        ])

        await update.message.reply_text(
            confirmation_text,
            reply_markup=keyboard,
            parse_mode="Markdown"
        )

        return CONFIRM

    except Exception as e:
        logger.error(f"Error fetching fact {fact_id}: {e}", exc_info=True)

        # Check if it's a 404 error (fact not found)
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


def format_delete_confirmation(fact: dict, article: dict) -> str:
    """
    Format delete confirmation message.

    Args:
        fact: Fact dictionary
        article: Article dictionary

    Returns:
        str: Formatted message (Markdown)
    """
    from datetime import date

    article_name = article.get("name", "???")
    article_type = article.get("type", "unknown")
    amount = Decimal(str(fact.get("amount", "0")))
    fact_date = fact.get("fact_date", "")
    description = fact.get("description", "")
    fact_id = fact.get("id", "")

    # Format date
    try:
        date_obj = date.fromisoformat(fact_date)
        formatted_date = format_date(date_obj)
    except (ValueError, TypeError):
        formatted_date = fact_date

    # Type display
    type_emoji = "💵" if article_type == "income" else "💸"
    type_text = "Доход" if article_type == "income" else "Расход"

    description_display = f"\nОписание: _{description}_" if description else ""

    return f"""🗑️ **Подтверждение удаления**

Вы действительно хотите удалить эту транзакцию?

{type_emoji} **{type_text}**
Категория: {article_name}
Сумма: {format_amount(amount)} ₽
Дата: {formatted_date}{description_display}
ID: `{fact_id}`

⚠️ **Внимание:** Это действие необратимо!"""


async def confirmation_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle confirmation (delete or cancel).

    Args:
        update: Telegram update (callback query)
        context: Bot context

    Returns:
        int: ConversationHandler.END
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle cancel
    if callback_data == "delete:cancel":
        await query.edit_message_text("❌ Удаление отменено")
        return ConversationHandler.END

    # Handle confirmation
    if callback_data == "delete:confirm":
        fact_id = context.user_data.get("delete_fact_id")

        if not fact_id:
            await query.edit_message_text("❌ Ошибка: ID транзакции не найден")
            return ConversationHandler.END

        # Show "deleting" message
        await query.edit_message_text("⏳ Удаление транзакции...")

        try:
            token = SessionManager.get_access_token(context)
            api_client = await get_api_client()

            # Delete fact
            await api_client.delete_fact(token, fact_id)

            await query.edit_message_text(
                f"✅ **Транзакция удалена!**\n\n"
                f"ID транзакции: `{fact_id}`\n\n"
                f"Используйте /list для просмотра оставшихся транзакций",
                parse_mode="Markdown"
            )

            logger.info(f"Fact {fact_id} deleted successfully")

            return ConversationHandler.END

        except Exception as e:
            logger.error(f"Error deleting fact {fact_id}: {e}", exc_info=True)
            await query.edit_message_text(
                "❌ Произошла ошибка при удалении транзакции.\n\n"
                "Попробуйте позже"
            )
            return ConversationHandler.END

    return ConversationHandler.END


async def cancel_delete(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /cancel in delete conversation.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: ConversationHandler.END
    """
    await update.message.reply_text("❌ Удаление отменено")
    return ConversationHandler.END


# Build ConversationHandler
delete_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("delete", delete_handler)],
    states={
        ENTER_ID: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, id_entered)
        ],
        CONFIRM: [
            CallbackQueryHandler(confirmation_handler, pattern="^delete:")
        ],
    },
    fallbacks=[CommandHandler("cancel", cancel_delete)],
    name="delete_conversation",
    persistent=False,
    # Explicit conversation tracking parameters (fixes PTBUserWarning)
    per_user=True,     # Each user has independent deletion flow
    per_chat=True,     # Each chat has separate delete state
    per_message=False,  # Confirmation callbacks from any message
)
