"""
/search command handler for searching transactions.

Allows users to search transactions by:
- Description text (substring match)
- Category name (exact or partial match)
"""

from decimal import Decimal

from telegram import Update
from telegram.ext import CommandHandler, ContextTypes, ConversationHandler, MessageHandler, filters

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.validators import format_amount, format_date

logger = get_logger(__name__)

# State
ENTER_QUERY = 0


async def search_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /search command.

    Asks user for search query.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: Next conversation state (ENTER_QUERY or END)
    """
    user = update.effective_user

    if not user:
        logger.warning("/search called without user context")
        return ConversationHandler.END

    logger.info(f"/search command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /search attempt from user {user.id}")
        return ConversationHandler.END

    await update.message.reply_text(
        "🔍 **Поиск транзакций**\n\n"
        "Введите текст для поиска:\n\n"
        "_Поиск по описанию или названию категории_\n\n"
        "Примеры:\n"
        "• продукты\n"
        "• зарплата\n"
        "• кофе\n\n"
        "Отправьте /cancel для отмены",
        parse_mode="Markdown"
    )

    return ENTER_QUERY


async def query_entered(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle search query input.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: ConversationHandler.END
    """
    query_text = update.message.text.strip()

    if not query_text:
        await update.message.reply_text(
            "❌ Поисковый запрос не может быть пустым.\n\n"
            "Попробуйте еще раз или отправьте /cancel"
        )
        return ENTER_QUERY

    # Send "searching" message
    loading_msg = await update.message.reply_text(
        f"⏳ Поиск транзакций по запросу: \"{query_text}\"..."
    )

    try:
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Fetch all facts (we'll filter client-side since backend doesn't have search)
        facts_response = await api_client.list_facts(token=token, limit=10000)
        facts = facts_response.get("facts", [])

        # Fetch articles
        articles_response = await api_client.list_articles(token=token, limit=1000)
        articles = articles_response.get("articles", [])
        articles_map = {article["id"]: article for article in articles}

        # Filter facts by query (case-insensitive)
        query_lower = query_text.lower()
        matching_facts = []

        for fact in facts:
            # Search in description
            description = fact.get("description", "")
            if description and query_lower in description.lower():
                matching_facts.append(fact)
                continue

            # Search in category name
            article_id = fact.get("article_id")
            article = articles_map.get(article_id, {})
            article_name = article.get("name", "")
            if article_name and query_lower in article_name.lower():
                matching_facts.append(fact)

        # Format results
        if not matching_facts:
            result_text = (
                f"🔍 **Результаты поиска**\n\n"
                f"По запросу \"{query_text}\" ничего не найдено.\n\n"
                f"Попробуйте другой запрос или используйте /list для просмотра всех транзакций"
            )
        else:
            result_text = format_search_results(query_text, matching_facts, articles_map)

        await loading_msg.edit_text(result_text, parse_mode="Markdown")

        logger.info(f"Search query '{query_text}' returned {len(matching_facts)} results")

        return ConversationHandler.END

    except Exception as e:
        logger.error(f"Error searching transactions: {e}", exc_info=True)
        await loading_msg.edit_text(
            "❌ Произошла ошибка при поиске транзакций.\n\n"
            "Попробуйте позже"
        )
        return ConversationHandler.END


def format_search_results(query: str, facts: list, articles_map: dict) -> str:
    """
    Format search results message.

    Args:
        query: Search query
        facts: List of matching facts
        articles_map: Article lookup map

    Returns:
        str: Formatted message (Markdown)
    """
    from datetime import date

    message_parts = [
        f"🔍 **Результаты поиска**",
        f"Запрос: \"{query}\"",
        f"_Найдено: {len(facts)}_",
        ""
    ]

    # Limit to first 20 results
    displayed_facts = facts[:20]

    for fact in displayed_facts:
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

    if len(facts) > 20:
        message_parts.append(f"_...и еще {len(facts) - 20} результатов_")
        message_parts.append("")

    message_parts.append("Используйте /delete для удаления транзакции")

    return "\n".join(message_parts)


async def cancel_search(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /cancel in search conversation.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: ConversationHandler.END
    """
    await update.message.reply_text("❌ Поиск отменён")
    return ConversationHandler.END


# Build ConversationHandler
search_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("search", search_handler)],
    states={
        ENTER_QUERY: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, query_entered)
        ],
    },
    fallbacks=[CommandHandler("cancel", cancel_search)],
    name="search_conversation",
    persistent=False,
)
