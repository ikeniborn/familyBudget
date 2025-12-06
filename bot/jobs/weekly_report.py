"""
Weekly report job.

Sends automated weekly budget reports (plan vs fact) to all users
who have notifications enabled.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List

from telegram import Bot
from telegram.error import TelegramError

from bot.config.settings import get_settings
from bot.utils.api_client import APIClient
from bot.utils.logger import get_logger
from bot.utils.validators import format_amount, format_date

settings = get_settings()
logger = get_logger(__name__)


async def send_weekly_reports(bot: Bot, user_telegram_ids: List[int] = None):
    """
    Send weekly reports to all users with notifications enabled.

    Args:
        bot: Telegram Bot instance
        user_telegram_ids: Optional list of telegram IDs to send reports to.
                          If None, will attempt to get from all users.

    Note:
        This function is called by APScheduler weekly (Sunday 20:00).

    Status:
        NOT IMPLEMENTED - Weekly reports require persistent token storage
        or service account authentication, which is not yet available.
        This job logs a debug message and exits without sending reports.
    """
    # FEATURE NOT IMPLEMENTED: Weekly reports require persistent token management
    # See: https://github.com/your-repo/issues/XXX for tracking
    logger.debug(
        "Weekly report job skipped - feature not implemented. "
        "Requires persistent token storage or service account authentication."
    )
    return

    # The implementation below is preserved for future development reference
    # but is currently unreachable due to the early return above.
    #
    # logger.info("Starting weekly report job")
    #
    # # Calculate date range (last 7 days)
    # today = date.today()
    # week_ago = today - timedelta(days=7)
    #
    # logger.info(f"Report period: {week_ago} to {today}")
    #
    # # Implementation would need:
    # # 1. Persistent token storage or service account
    # # 2. Get user's token from persistent storage
    # # 3. Fetch week's data via API
    # # 4. Generate report using generate_weekly_report()
    # # 5. Send via Telegram bot.send_message()


async def generate_weekly_report(
    api_client: APIClient,
    token: str,
    week_start: date,
    week_end: date,
) -> str:
    """
    Generate weekly report text for a user.

    Args:
        api_client: API client instance
        token: User's access token
        week_start: Start of week
        week_end: End of week

    Returns:
        str: Formatted weekly report (Markdown)
    """
    try:
        # Fetch facts for the week
        facts_response = await api_client.list_facts(
            token=token,
            date_from=week_start.isoformat(),
            date_to=week_end.isoformat(),
            limit=10000,
        )

        facts = facts_response.get("facts", [])

        # Fetch articles
        articles_response = await api_client.list_articles(token=token, limit=1000)
        articles = articles_response.get("articles", [])
        articles_map = {article["id"]: article for article in articles}

        # Separate facts by record_type
        plan_facts = [f for f in facts if f.get("record_type") == "plan"]
        actual_facts = [f for f in facts if f.get("record_type") == "fact"]

        # Calculate summaries
        plan_summary = calculate_summary(plan_facts, articles_map)
        actual_summary = calculate_summary(actual_facts, articles_map)

        # Format report
        report = format_weekly_report(
            week_start, week_end, plan_summary, actual_summary
        )

        return report

    except Exception as e:
        logger.error(f"Error generating weekly report: {e}", exc_info=True)
        raise


def calculate_summary(facts: List[Dict], articles_map: Dict[int, Dict]) -> Dict:
    """
    Calculate summary statistics from facts.

    Args:
        facts: List of fact dictionaries
        articles_map: Dictionary mapping article_id to article data

    Returns:
        Dict with income, expense, top_expenses statistics
    """
    total_income = Decimal("0")
    total_expense = Decimal("0")
    expense_by_article = defaultdict(Decimal)

    for fact in facts:
        article_id = fact.get("article_id")
        article = articles_map.get(article_id, {})
        article_type = article.get("type", "unknown")
        article_name = article.get("name", f"Article #{article_id}")
        amount = Decimal(str(fact.get("amount", "0")))

        # Use absolute amount
        amount_abs = abs(amount)

        if article_type == "income":
            total_income += amount_abs
        elif article_type == "expense":
            total_expense += amount_abs
            expense_by_article[article_name] += amount_abs

    # Get top 3 expense categories
    top_expenses = sorted(
        expense_by_article.items(), key=lambda x: x[1], reverse=True
    )[:3]

    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "balance": total_income - total_expense,
        "top_expenses": top_expenses,
    }


def format_weekly_report(
    week_start: date,
    week_end: date,
    plan_summary: Dict,
    actual_summary: Dict,
) -> str:
    """
    Format weekly report message.

    Args:
        week_start: Start of week
        week_end: End of week
        plan_summary: Plan summary statistics
        actual_summary: Actual summary statistics

    Returns:
        str: Formatted report (Markdown)

    Example output:
        📊 **Еженедельный отчет**
        📅 03.10.2025 - 09.10.2025

        💰 **Итоги недели:**
        План: 50 000.00 ₽
        Факт: 48 500.00 ₽
        ✅ Экономия: 1 500.00 ₽ (3%)

        📊 **Топ-3 расхода:**
        1. Groceries: 10 000.00 ₽
        2. Transport: 5 000.00 ₽
        3. Utilities: 3 000.00 ₽

        Используйте /summary для детального анализа
    """
    date_range = f"{format_date(week_start)} - {format_date(week_end)}"

    plan_balance = plan_summary["balance"]
    actual_balance = actual_summary["balance"]
    difference = actual_balance - plan_balance

    message_parts = ["📊 *Еженедельный отчет*"]
    message_parts.append(f"📅 {date_range}")
    message_parts.append("")

    # Weekly summary
    message_parts.append("💰 *Итоги недели:*")
    message_parts.append(f"План: {format_amount(plan_balance)} ₽")
    message_parts.append(f"Факт: {format_amount(actual_balance)} ₽")

    if plan_balance != 0:
        percent = abs(difference / plan_balance * 100)
        if difference >= 0:
            status = "✅ Экономия"
            sign = "+"
        else:
            status = "⚠️ Перерасход"
            sign = ""
        message_parts.append(
            f"{status}: {sign}{format_amount(abs(difference))} ₽ ({percent:.0f}%)"
        )
    else:
        sign = "+" if difference >= 0 else ""
        message_parts.append(f"Разница: {sign}{format_amount(difference)} ₽")

    # Top expenses
    top_expenses = actual_summary.get("top_expenses", [])
    if top_expenses:
        message_parts.append("")
        message_parts.append("📊 *Топ-3 расхода:*")
        for i, (category, amount) in enumerate(top_expenses, 1):
            message_parts.append(f"{i}. {category}: {format_amount(amount)} ₽")

    # No data message
    if not plan_summary["total_income"] and not plan_summary["total_expense"]:
        message_parts.append("")
        message_parts.append("_На эту неделю бюджет не планировался_")

    if not actual_summary["total_income"] and not actual_summary["total_expense"]:
        message_parts.append("")
        message_parts.append("_Фактических транзакций за неделю не было_")

    # Footer
    message_parts.append("")
    message_parts.append("Используйте /summary для детального анализа")
    message_parts.append("или /settings для управления уведомлениями")

    return "\n".join(message_parts)
