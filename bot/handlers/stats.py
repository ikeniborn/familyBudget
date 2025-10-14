"""
/stats command handler for displaying general statistics.

Shows all-time statistics including:
- Total income/expense/balance
- Transaction counts
- Top expense categories
- Top income categories
- Period coverage (first to last transaction)
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Dict, List, Tuple

from telegram import Update
from telegram.ext import ContextTypes

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.validators import format_amount, format_date

logger = get_logger(__name__)


async def stats_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /stats command.

    Workflow:
    1. Check authentication
    2. Fetch all-time summary from backend (GET /facts/summary)
    3. Fetch all facts from backend (GET /facts)
    4. Calculate breakdown by categories
    5. Format and display statistics

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        None
    """
    user = update.effective_user

    if not user:
        logger.warning("/stats called without user context")
        return

    logger.info(f"/stats command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /stats attempt from user {user.id}")
        return

    # Send "loading" message
    loading_msg = await update.message.reply_text(
        "⏳ Загружаю общую статистику..."
    )

    try:
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Fetch all-time summary (no date filters)
        summary = await api_client.get_facts_summary(token=token)

        # Fetch all facts (for category breakdown)
        facts_response = await api_client.list_facts(token=token, limit=10000)
        facts = facts_response.get("facts", [])

        # Fetch articles for name lookup
        articles_response = await api_client.list_articles(token=token, limit=1000)
        articles = articles_response.get("articles", [])

        # Create article lookup map
        articles_map = {article["id"]: article for article in articles}

        # Calculate breakdown by categories
        breakdown = calculate_category_breakdown(facts, articles_map)

        # Find date range
        date_range = find_date_range(facts)

        # Format and display statistics
        stats_text = format_general_statistics(summary, breakdown, date_range)

        await loading_msg.edit_text(
            stats_text,
            parse_mode="Markdown"
        )

        logger.info(f"Displayed general statistics for user {user.id}")

    except Exception as e:
        logger.error(f"Error fetching general statistics: {e}", exc_info=True)
        await loading_msg.edit_text(
            "❌ Произошла ошибка при загрузке статистики.\n\n"
            "Попробуйте позже."
        )


def calculate_category_breakdown(
    facts: List[Dict],
    articles_map: Dict[int, Dict]
) -> Dict[str, Dict[str, Decimal]]:
    """
    Calculate spending/income breakdown by categories.

    Args:
        facts: List of fact dictionaries
        articles_map: Dictionary mapping article_id to article data

    Returns:
        Dict with structure:
        {
            "income": {
                "Salary": Decimal("5000.00"),
                "Freelance": Decimal("1500.00")
            },
            "expense": {
                "Groceries": Decimal("3000.00"),
                "Transport": Decimal("500.00")
            }
        }
    """
    income_by_category = defaultdict(Decimal)
    expense_by_category = defaultdict(Decimal)

    for fact in facts:
        article_id = fact.get("article_id")
        article = articles_map.get(article_id, {})

        article_name = article.get("name", f"Article #{article_id}")
        article_type = article.get("type", "unknown")
        amount = Decimal(str(fact.get("amount", "0")))

        if article_type == "income":
            income_by_category[article_name] += amount
        elif article_type == "expense":
            expense_by_category[article_name] += amount

    return {
        "income": dict(income_by_category),
        "expense": dict(expense_by_category)
    }


def find_date_range(facts: List[Dict]) -> Tuple[date | None, date | None]:
    """
    Find first and last transaction dates.

    Args:
        facts: List of fact dictionaries

    Returns:
        Tuple of (first_date, last_date) or (None, None) if no facts
    """
    if not facts:
        return None, None

    dates = []
    for fact in facts:
        fact_date_str = fact.get("fact_date")
        if fact_date_str:
            try:
                fact_date = date.fromisoformat(fact_date_str)
                dates.append(fact_date)
            except (ValueError, TypeError):
                continue

    if not dates:
        return None, None

    return min(dates), max(dates)


def format_general_statistics(
    summary: Dict,
    breakdown: Dict[str, Dict[str, Decimal]],
    date_range: Tuple[date | None, date | None]
) -> str:
    """
    Format general statistics message.

    Args:
        summary: Summary data from API (income, expense, balance, counts)
        breakdown: Category breakdown (income/expense by category)
        date_range: Tuple of (first_date, last_date)

    Returns:
        str: Formatted statistics message (Markdown)

    Example output:
        📊 **Общая статистика**
        📅 Период: 01.09.2025 - 13.10.2025

        💰 **Итоги:**
        💵 Доходы: **20 000.00** ₽ (10 шт)
        💸 Расходы: **15 500.00** ₽ (65 шт)
        📈 Баланс: **+4 500.00** ₽

        📊 **Топ-5 расходов:**
        1. Groceries: 5 000.00 ₽ (32%)
        2. Transport: 3 000.00 ₽ (19%)
        3. Utilities: 2 500.00 ₽ (16%)
        4. Restaurants: 2 000.00 ₽ (13%)
        5. Entertainment: 1 500.00 ₽ (10%)

        💵 **Доходы по категориям:**
        • Salary: 18 000.00 ₽ (90%)
        • Freelance: 2 000.00 ₽ (10%)
    """
    # Extract summary data
    total_income = Decimal(str(summary.get("total_income", "0")))
    total_expense = Decimal(str(summary.get("total_expense", "0")))
    balance = Decimal(str(summary.get("balance", "0")))
    count_income = summary.get("count_income", 0)
    count_expense = summary.get("count_expense", 0)

    message_parts = ["📊 **Общая статистика**"]

    # Date range
    first_date, last_date = date_range
    if first_date and last_date:
        date_range_str = f"{format_date(first_date)} - {format_date(last_date)}"
        message_parts.append(f"📅 Период: {date_range_str}")
    else:
        message_parts.append("📅 Нет данных")

    message_parts.append("")

    # Summary totals
    message_parts.append("💰 **Итоги:**")
    message_parts.append(
        f"💵 Доходы: **{format_amount(total_income)}** ₽ ({count_income} шт)"
    )
    message_parts.append(
        f"💸 Расходы: **{format_amount(total_expense)}** ₽ ({count_expense} шт)"
    )

    # Balance
    balance_sign = "+" if balance >= 0 else ""
    balance_emoji = "📈" if balance >= 0 else "📉"
    message_parts.append(
        f"{balance_emoji} Баланс: **{balance_sign}{format_amount(balance)}** ₽"
    )

    # If no transactions, show message and return
    if count_income == 0 and count_expense == 0:
        message_parts.append("")
        message_parts.append("_У вас пока нет транзакций_")
        message_parts.append("")
        message_parts.append("Используйте /add для добавления первой транзакции")
        return "\n".join(message_parts)

    # Top expense categories
    expense_breakdown = breakdown.get("expense", {})
    if expense_breakdown:
        message_parts.append("")
        message_parts.append("📊 **Топ-5 расходов:**")

        # Sort by amount (descending) and take top 5
        sorted_expenses = sorted(
            expense_breakdown.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]

        for i, (category, amount) in enumerate(sorted_expenses, 1):
            # Calculate percentage of total expenses
            percentage = (amount / total_expense * 100) if total_expense > 0 else 0
            message_parts.append(
                f"{i}. **{category}**: {format_amount(amount)} ₽ ({percentage:.0f}%)"
            )

    # Income categories
    income_breakdown = breakdown.get("income", {})
    if income_breakdown:
        message_parts.append("")
        message_parts.append("💵 **Доходы по категориям:**")

        # Sort by amount (descending)
        sorted_income = sorted(
            income_breakdown.items(),
            key=lambda x: x[1],
            reverse=True
        )

        for category, amount in sorted_income:
            # Calculate percentage of total income
            percentage = (amount / total_income * 100) if total_income > 0 else 0
            message_parts.append(
                f"• **{category}**: {format_amount(amount)} ₽ ({percentage:.0f}%)"
            )

    # Footer
    message_parts.append("")
    message_parts.append("Используйте /add для добавления транзакции")
    message_parts.append("или /today для статистики за сегодня")

    return "\n".join(message_parts)
