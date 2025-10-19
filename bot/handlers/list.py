"""
/list command handler for listing transactions with pagination.

Shows recent transactions with:
- Date, category, amount, description
- Pagination (10 transactions per page)
- Navigation buttons (Previous/Next)
- Total count
"""

from decimal import Decimal

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes, ConversationHandler

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.validators import format_amount, format_date

logger = get_logger(__name__)

# Pagination constants
PAGE_SIZE = 10

# State
NAVIGATE = 0


async def list_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /list command.

    Shows paginated list of user's transactions.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: Next conversation state (NAVIGATE or END)
    """
    user = update.effective_user

    if not user:
        logger.warning("/list called without user context")
        return ConversationHandler.END

    logger.info(f"/list command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /list attempt from user {user.id}")
        return ConversationHandler.END

    # Initialize pagination (start from page 0)
    context.user_data["list_page"] = 0

    # Fetch and display first page
    await display_page(update.message, context, page=0)

    return NAVIGATE


async def display_page(message_or_query, context: ContextTypes.DEFAULT_TYPE, page: int, edit_message: bool = False):
    """
    Fetch and display a page of transactions.

    Args:
        message_or_query: Message or CallbackQuery object
        context: Bot context
        page: Page number (0-indexed)
        edit_message: Whether to edit existing message (for pagination)
    """
    try:
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Calculate offset
        offset = page * PAGE_SIZE

        # Fetch facts for this page
        facts_response = await api_client.list_facts(
            token=token,
            limit=PAGE_SIZE,
            offset=offset
        )

        facts = facts_response.get("facts", [])
        total = facts_response.get("total", 0)

        if total == 0:
            text = (
                "📝 **Список транзакций**\n\n"
                "_У вас пока нет транзакций_\n\n"
                "Используйте /add для добавления транзакций"
            )
            if edit_message and hasattr(message_or_query, "edit_message_text"):
                await message_or_query.edit_message_text(text, parse_mode="Markdown")
            else:
                await message_or_query.reply_text(text, parse_mode="Markdown")
            return

        # Fetch articles for names
        articles_response = await api_client.list_articles(token=token, limit=1000)
        articles = articles_response.get("articles", [])
        articles_map = {article["id"]: article for article in articles}

        # Format transactions list
        list_text = format_transactions_list(facts, articles_map, page, total, PAGE_SIZE)

        # Build pagination keyboard
        keyboard = build_pagination_keyboard(page, total, PAGE_SIZE)

        # Send or edit message
        if edit_message and hasattr(message_or_query, "edit_message_text"):
            await message_or_query.edit_message_text(
                list_text,
                reply_markup=keyboard,
                parse_mode="Markdown"
            )
        else:
            await message_or_query.reply_text(
                list_text,
                reply_markup=keyboard,
                parse_mode="Markdown"
            )

    except Exception as e:
        logger.error(f"Error displaying transactions page: {e}", exc_info=True)
        error_text = "❌ Произошла ошибка при загрузке списка транзакций."
        if edit_message and hasattr(message_or_query, "edit_message_text"):
            await message_or_query.edit_message_text(error_text)
        else:
            await message_or_query.reply_text(error_text)


def format_transactions_list(facts: list, articles_map: dict, page: int, total: int, page_size: int) -> str:
    """
    Format transactions list message.

    Args:
        facts: List of fact dictionaries
        articles_map: Article lookup map
        page: Current page (0-indexed)
        total: Total number of facts
        page_size: Items per page

    Returns:
        str: Formatted message (Markdown)
    """
    # Calculate page range
    start = page * page_size + 1
    end = min((page + 1) * page_size, total)

    message_parts = [
        "📝 **Список транзакций**",
        f"_Показано {start}-{end} из {total}_",
        ""
    ]

    for fact in facts:
        # Get article info
        article_id = fact.get("article_id")
        article = articles_map.get(article_id, {})

        article_name = article.get("name", f"Article #{article_id}")
        article_type = article.get("type", "unknown")

        # Format data
        fact_date = fact.get("fact_date", "")
        amount = Decimal(str(fact.get("amount", "0")))
        description = fact.get("description", "")
        fact_id = fact.get("id", "")

        # Format date
        try:
            from datetime import date
            date_obj = date.fromisoformat(fact_date)
            formatted_date = format_date(date_obj)
        except (ValueError, TypeError):
            formatted_date = fact_date

        # Type emoji
        type_emoji = "💵" if article_type == "income" else "💸"

        # Build transaction line
        transaction_line = f"{type_emoji} **{formatted_date}** | {article_name} | {format_amount(amount)} ₽"

        if description:
            transaction_line += f"\n   _{description}_"

        transaction_line += f"\n   `ID: {fact_id}`"

        message_parts.append(transaction_line)
        message_parts.append("")

    return "\n".join(message_parts)


def build_pagination_keyboard(page: int, total: int, page_size: int) -> InlineKeyboardMarkup:
    """
    Build pagination keyboard.

    Args:
        page: Current page (0-indexed)
        total: Total number of items
        page_size: Items per page

    Returns:
        InlineKeyboardMarkup: Keyboard with navigation buttons
    """
    total_pages = (total + page_size - 1) // page_size  # Ceiling division

    buttons = []

    # Previous button
    if page > 0:
        buttons.append(InlineKeyboardButton("« Назад", callback_data=f"list:page:{page - 1}"))

    # Page indicator
    buttons.append(InlineKeyboardButton(f"{page + 1}/{total_pages}", callback_data="list:noop"))

    # Next button
    if page < total_pages - 1:
        buttons.append(InlineKeyboardButton("Вперёд »", callback_data=f"list:page:{page + 1}"))

    keyboard = [
        buttons,
        [InlineKeyboardButton("✅ Закрыть", callback_data="list:close")]
    ]

    return InlineKeyboardMarkup(keyboard)


async def pagination_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle pagination button clicks.

    Args:
        update: Telegram update (callback query)
        context: Bot context

    Returns:
        int: Next conversation state (NAVIGATE or END)
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle close button
    if callback_data == "list:close":
        await query.edit_message_text("✅ Список транзакций закрыт")
        return ConversationHandler.END

    # Handle page indicator (no-op)
    if callback_data == "list:noop":
        return NAVIGATE

    # Parse page navigation
    if not callback_data.startswith("list:page:"):
        return NAVIGATE

    try:
        page = int(callback_data.split(":", 2)[2])
        context.user_data["list_page"] = page

        # Display new page
        await display_page(query, context, page=page, edit_message=True)

        return NAVIGATE

    except (ValueError, IndexError) as e:
        logger.error(f"Error parsing pagination callback: {e}")
        return NAVIGATE


async def cancel_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /cancel in list conversation.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: ConversationHandler.END
    """
    await update.message.reply_text("✅ Просмотр списка завершён")
    return ConversationHandler.END


# Build ConversationHandler
list_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("list", list_handler)],
    states={
        NAVIGATE: [
            CallbackQueryHandler(pagination_handler, pattern="^list:")
        ],
    },
    fallbacks=[CommandHandler("cancel", cancel_list)],
    name="list_conversation",
    persistent=False,
    per_message=True,  # Track conversation state per message for CallbackQueryHandler
)
