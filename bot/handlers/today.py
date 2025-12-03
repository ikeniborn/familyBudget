"""
/today command handler for displaying today's statistics.

Shows summary of income/expense for current day and lists all transactions.
"""

from datetime import date
from decimal import Decimal
from typing import Dict, List

from telegram import Update
from telegram.ext import ContextTypes

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.validators import format_amount, format_date

logger = get_logger(__name__)


async def today_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /today command.

    Workflow:
    1. Check authentication
    2. Fetch today's summary from backend (GET /facts/summary)
    3. Fetch today's facts from backend (GET /facts)
    4. Format and display statistics
    5. List all transactions for today

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        None
    """
    user = update.effective_user

    if not user:
        logger.warning("/today called without user context")
        return

    logger.info(f"/today command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /today attempt from user {user.id}")
        return

    # Send "loading" message
    loading_msg = await update.message.reply_text(
        "⏳ Загружаю статистику за сегодня..."
    )

    try:
        today = date.today()
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Fetch summary for today
        summary = await api_client.get_facts_summary(
            token=token,
            date_from=today.isoformat(),
            date_to=today.isoformat()
        )

        # Fetch all facts for today
        facts_response = await api_client.list_facts(
            token=token,
            date_from=today.isoformat(),
            date_to=today.isoformat(),
            limit=1000  # Get all facts for today
        )

        facts = facts_response.get("facts", [])

        # Fetch articles to get names (needed for display)
        articles_response = await api_client.list_articles(token=token, limit=1000)
        articles = articles_response.get("articles", [])

        # Create article lookup map (id → article)
        articles_map = {article["id"]: article for article in articles}

        # Format and display statistics
        stats_text = format_today_statistics(today, summary, facts, articles_map)

        await loading_msg.edit_text(
            stats_text,
            parse_mode="Markdown"
        )

        logger.info(f"Displayed today's statistics for user {user.id}")

    except Exception as e:
        logger.error(f"Error fetching today's statistics: {e}", exc_info=True)
        await loading_msg.edit_text(
            "❌ Произошла ошибка при загрузке статистики.\n\n"
            "Попробуйте позже."
        )


def format_today_statistics(today: date, summary: Dict, facts: List[Dict], articles_map: Dict[int, Dict]) -> str:
    """
    Format today's statistics message.

    Args:
        today: Today's date
        summary: Summary data from API (income, expense, balance, counts)
        facts: List of fact dictionaries from API
        articles_map: Dictionary mapping article_id to article data

    Returns:
        str: Formatted statistics message (Markdown)

    Example output:
        📊 **Статистика за сегодня**
        📅 13.10.2025

        💰 **Итоги:**
        💵 Доходы: **5 000.00** ₽ (2 шт)
        💸 Расходы: **3 500.00** ₽ (5 шт)
        📈 Баланс: **+1 500.00** ₽

        📋 **Факты:**

        💵 ДОХОДЫ:
        • Salary: 5 000.00 ₽

        💸 РАСХОДЫ:
        • Groceries: 1 250.50 ₽ - _Weekly shopping_
        • Transport: 150.00 ₽
        • Utilities: 2 099.50 ₽
    """
    # Extract summary data
    total_income = Decimal(str(summary.get("total_income", "0")))
    total_expense = Decimal(str(summary.get("total_expense", "0")))
    balance = Decimal(str(summary.get("balance", "0")))
    count_income = summary.get("count_income", 0)
    count_expense = summary.get("count_expense", 0)

    # Format header
    date_str = format_date(today)

    message_parts = [
        "📊 **Статистика за сегодня**",
        f"📅 {date_str}",
        "",
        "💰 **Итоги:**",
        f"💵 Доходы: **{format_amount(total_income)}** ₽ ({count_income} шт)",
        f"💸 Расходы: **{format_amount(total_expense)}** ₽ ({count_expense} шт)",
    ]

    # Format balance with +/- sign
    balance_sign = "+" if balance >= 0 else ""
    balance_emoji = "📈" if balance >= 0 else "📉"
    message_parts.append(
        f"{balance_emoji} Баланс: **{balance_sign}{format_amount(balance)}** ₽"
    )

    # If no transactions, show message and return
    if not facts:
        message_parts.append("")
        message_parts.append("_Сегодня транзакций пока нет_")
        message_parts.append("")
        message_parts.append("Используйте /add для добавления транзакции")
        return "\n".join(message_parts)

    # Group facts by type
    income_facts = []
    expense_facts = []

    for fact in facts:
        article_id = fact.get("article_id")
        article = articles_map.get(article_id, {})

        article_name = article.get("name", f"Article #{article_id}")
        article_type = article.get("type", "unknown")
        amount = Decimal(str(fact.get("amount", "0")))
        description = fact.get("description")

        fact_display = {
            "article_name": article_name,
            "amount": amount,
            "description": description
        }

        if article_type == "income":
            income_facts.append(fact_display)
        elif article_type == "expense":
            expense_facts.append(fact_display)

    # Add transactions section
    message_parts.append("")
    message_parts.append("📋 **Факты:**")

    # Income section
    if income_facts:
        message_parts.append("")
        message_parts.append("💵 **ДОХОДЫ:**")
        for fact in income_facts:
            fact_line = f"• **{fact['article_name']}**: {format_amount(fact['amount'])} ₽"
            if fact['description']:
                fact_line += f" - _{fact['description']}_"
            message_parts.append(fact_line)

    # Expense section
    if expense_facts:
        message_parts.append("")
        message_parts.append("💸 **РАСХОДЫ:**")
        for fact in expense_facts:
            fact_line = f"• **{fact['article_name']}**: {format_amount(fact['amount'])} ₽"
            if fact['description']:
                fact_line += f" - _{fact['description']}_"
            message_parts.append(fact_line)

    # Footer
    message_parts.append("")
    message_parts.append("Используйте /add для добавления транзакции")
    message_parts.append("или /stats для общей статистики")

    return "\n".join(message_parts)
