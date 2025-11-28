"""
/summary command handler for displaying plan vs fact comparison.

Shows budget plan compared to actual spending/income for selected periods.
Includes period selection via inline keyboard.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, Tuple

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes, ConversationHandler

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.validators import format_amount, format_date

logger = get_logger(__name__)

# Conversation states
SELECTING_PERIOD = 1


def get_period_dates(period_key: str) -> Tuple[date, date]:
    """
    Calculate date range for given period.

    Args:
        period_key: Period identifier ('today', 'week', 'month', 'year')

    Returns:
        Tuple of (start_date, end_date)
    """
    today = date.today()

    if period_key == "today":
        return today, today

    elif period_key == "week":
        # Current week (Monday to Sunday)
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        return start_of_week, end_of_week

    elif period_key == "month":
        # Current month
        start_of_month = date(today.year, today.month, 1)
        if today.month == 12:
            end_of_month = date(today.year + 1, 1, 1) - timedelta(days=1)
        else:
            end_of_month = date(today.year, today.month + 1, 1) - timedelta(days=1)
        return start_of_month, end_of_month

    elif period_key == "year":
        # Current year
        start_of_year = date(today.year, 1, 1)
        end_of_year = date(today.year, 12, 31)
        return start_of_year, end_of_year

    else:
        # Default to current month
        return get_period_dates("month")


def build_period_keyboard() -> InlineKeyboardMarkup:
    """
    Build inline keyboard with period selection options.

    Returns:
        InlineKeyboardMarkup with period buttons
    """
    keyboard = [
        [
            InlineKeyboardButton("📅 Сегодня", callback_data="summary_period:today"),
            InlineKeyboardButton("📅 Неделя", callback_data="summary_period:week"),
        ],
        [
            InlineKeyboardButton("📅 Месяц", callback_data="summary_period:month"),
            InlineKeyboardButton("📅 Год", callback_data="summary_period:year"),
        ],
        [InlineKeyboardButton("❌ Отмена", callback_data="summary_cancel")],
    ]

    return InlineKeyboardMarkup(keyboard)


async def summary_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /summary command entry point.

    Shows period selection keyboard.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        SELECTING_PERIOD state
    """
    user = update.effective_user

    if not user:
        logger.warning("/summary called without user context")
        return ConversationHandler.END

    logger.info(f"/summary command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n" "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /summary attempt from user {user.id}")
        return ConversationHandler.END

    # Show period selection keyboard
    await update.message.reply_text(
        "📊 *Сводка: План&Факт*\n\n" "Выберите период для анализа:",
        reply_markup=build_period_keyboard(),
        parse_mode="Markdown",
    )

    return SELECTING_PERIOD


async def period_selected(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle period selection callback.

    Fetches data and displays plan vs fact comparison.

    Args:
        update: Telegram update with callback query
        context: Bot context

    Returns:
        ConversationHandler.END
    """
    query = update.callback_query
    await query.answer()

    user = query.from_user

    if not user:
        logger.warning("period_selected called without user context")
        return ConversationHandler.END

    # Parse callback data
    callback_data = query.data

    if callback_data == "summary_cancel":
        await query.edit_message_text("❌ Отменено")
        return ConversationHandler.END

    # Extract period key
    if not callback_data.startswith("summary_period:"):
        logger.error(f"Invalid callback data: {callback_data}")
        await query.edit_message_text("❌ Ошибка обработки запроса")
        return ConversationHandler.END

    period_key = callback_data.split(":")[1]

    # Get date range
    date_from, date_to = get_period_dates(period_key)

    # Update message to show loading
    period_names = {
        "today": "Сегодня",
        "week": "Неделя",
        "month": "Месяц",
        "year": "Год",
    }

    period_name = period_names.get(period_key, "Месяц")

    await query.edit_message_text(
        f"⏳ Загружаю сводку за период: *{period_name}*...",
        parse_mode="Markdown",
    )

    try:
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Fetch all facts for period
        facts_response = await api_client.list_facts(
            token=token,
            date_from=date_from.isoformat(),
            date_to=date_to.isoformat(),
            limit=10000,  # Get all facts for period
        )

        facts = facts_response.get("facts", [])

        # Fetch articles for name lookup
        articles_response = await api_client.list_articles(token=token, limit=1000)
        articles = articles_response.get("articles", [])

        # Create article lookup map
        articles_map = {article["id"]: article for article in articles}

        # Separate facts by record_type
        plan_facts = [f for f in facts if f.get("record_type") == "plan"]
        actual_facts = [f for f in facts if f.get("record_type") == "fact"]

        # Calculate summary by top-level articles
        plan_summary = calculate_summary_by_article(plan_facts, articles_map)
        actual_summary = calculate_summary_by_article(actual_facts, articles_map)

        # Format and display summary
        summary_text = format_plan_vs_fact_summary(
            period_name=period_name,
            date_from=date_from,
            date_to=date_to,
            plan_summary=plan_summary,
            actual_summary=actual_summary,
        )

        await query.edit_message_text(summary_text, parse_mode="Markdown")

        logger.info(f"Displayed summary for user {user.id}, period={period_key}")

    except Exception as e:
        logger.error(f"Error fetching summary: {e}", exc_info=True)
        await query.edit_message_text(
            "❌ Произошла ошибка при загрузке сводки.\n\n" "Попробуйте позже."
        )

    return ConversationHandler.END


async def cancel_summary(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /cancel command to exit summary conversation.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        ConversationHandler.END
    """
    await update.message.reply_text("❌ Просмотр сводки отменен")
    return ConversationHandler.END


def calculate_summary_by_article(
    facts: List[Dict], articles_map: Dict[int, Dict]
) -> Dict[str, Dict[str, Decimal]]:
    """
    Calculate summary grouped by top-level articles.

    Args:
        facts: List of fact dictionaries
        articles_map: Dictionary mapping article_id to article data

    Returns:
        Dict with structure:
        {
            "income": {
                "Salary": Decimal("5000.00"),
                "Freelance": Decimal("1500.00"),
                ...
            },
            "expense": {
                "Food": Decimal("3000.00"),
                "Transport": Decimal("500.00"),
                ...
            }
        }
    """
    income_by_article = defaultdict(Decimal)
    expense_by_article = defaultdict(Decimal)

    for fact in facts:
        article_id = fact.get("article_id")
        article = articles_map.get(article_id, {})

        article_name = article.get("name", f"Article #{article_id}")
        article_type = article.get("type", "unknown")
        amount = Decimal(str(fact.get("amount", "0")))

        # Use absolute amount for display (amounts are already signed in DB)
        amount_abs = abs(amount)

        if article_type == "income":
            income_by_article[article_name] += amount_abs
        elif article_type == "expense":
            expense_by_article[article_name] += amount_abs

    return {
        "income": dict(income_by_article),
        "expense": dict(expense_by_article),
    }


def format_plan_vs_fact_summary(
    period_name: str,
    date_from: date,
    date_to: date,
    plan_summary: Dict[str, Dict[str, Decimal]],
    actual_summary: Dict[str, Dict[str, Decimal]],
) -> str:
    """
    Format plan vs fact summary message.

    Args:
        period_name: Period name (e.g., "Месяц")
        date_from: Start date
        date_to: End date
        plan_summary: Plan summary by article type
        actual_summary: Actual summary by article type

    Returns:
        str: Formatted summary message (Markdown)

    Example output:
        📊 **Сводка: План&Факт**
        📅 Месяц: 01.10.2025 - 31.10.2025

        💰 **ИТОГО:**
        План:  50 000.00 ₽
        Факт:  45 500.00 ₽
        Остаток: +4 500.00 ₽ (9%)

        💵 **ДОХОДЫ:**
        • Salary
          План:  50 000.00 ₽
          Факт:  50 000.00 ₽
          ✅ 100% (в рамках плана)

        💸 **РАСХОДЫ:**
        • Food
          План:  15 000.00 ₽
          Факт:  12 500.00 ₽
          ✅ 83% (экономия: 2 500.00 ₽)

        • Transport
          План:  5 000.00 ₽
          Факт:  6 000.00 ₽
          ⚠️ 120% (превышение: 1 000.00 ₽)
    """
    message_parts = ["📊 *Сводка: План&Факт*"]

    # Date range
    if date_from == date_to:
        date_range_str = format_date(date_from)
    else:
        date_range_str = f"{format_date(date_from)} - {format_date(date_to)}"

    message_parts.append(f"📅 {period_name}: {date_range_str}")
    message_parts.append("")

    # Calculate totals
    plan_income_total = sum(plan_summary["income"].values(), Decimal("0"))
    plan_expense_total = sum(plan_summary["expense"].values(), Decimal("0"))
    plan_balance = plan_income_total - plan_expense_total

    actual_income_total = sum(actual_summary["income"].values(), Decimal("0"))
    actual_expense_total = sum(actual_summary["expense"].values(), Decimal("0"))
    actual_balance = actual_income_total - actual_expense_total

    balance_diff = actual_balance - plan_balance

    # Totals section
    message_parts.append("💰 *ИТОГО:*")
    message_parts.append(f"План:  {format_amount(plan_balance)} ₽")
    message_parts.append(f"Факт:  {format_amount(actual_balance)} ₽")

    if plan_balance != 0:
        balance_percent = (actual_balance / plan_balance * 100)
        balance_sign = "+" if balance_diff >= 0 else ""
        message_parts.append(
            f"Остаток: {balance_sign}{format_amount(balance_diff)} ₽ ({balance_percent:.0f}%)"
        )
    else:
        balance_sign = "+" if balance_diff >= 0 else ""
        message_parts.append(f"Остаток: {balance_sign}{format_amount(balance_diff)} ₽")

    # Income breakdown
    if plan_summary["income"] or actual_summary["income"]:
        message_parts.append("")
        message_parts.append("💵 *ДОХОДЫ:*")

        # Combine all income articles
        all_income_articles = set(plan_summary["income"].keys()) | set(
            actual_summary["income"].keys()
        )

        for article_name in sorted(all_income_articles):
            plan_amount = plan_summary["income"].get(article_name, Decimal("0"))
            actual_amount = actual_summary["income"].get(article_name, Decimal("0"))

            message_parts.append(f"• *{article_name}*")
            message_parts.append(f"  План:  {format_amount(plan_amount)} ₽")
            message_parts.append(f"  Факт:  {format_amount(actual_amount)} ₽")

            # Calculate percentage and status
            if plan_amount > 0:
                percent = (actual_amount / plan_amount * 100)
                diff = actual_amount - plan_amount

                if percent >= 100:
                    status = "✅"
                    diff_sign = "+" if diff > 0 else ""
                    message_parts.append(
                        f"  {status} {percent:.0f}% (перевыполнение: {diff_sign}{format_amount(diff)} ₽)"
                    )
                else:
                    status = "⚠️"
                    message_parts.append(
                        f"  {status} {percent:.0f}% (недостаток: {format_amount(abs(diff))} ₽)"
                    )
            else:
                if actual_amount > 0:
                    message_parts.append(
                        f"  ℹ️ Доход без плана: {format_amount(actual_amount)} ₽"
                    )

    # Expense breakdown
    if plan_summary["expense"] or actual_summary["expense"]:
        message_parts.append("")
        message_parts.append("💸 *РАСХОДЫ:*")

        # Combine all expense articles
        all_expense_articles = set(plan_summary["expense"].keys()) | set(
            actual_summary["expense"].keys()
        )

        for article_name in sorted(all_expense_articles):
            plan_amount = plan_summary["expense"].get(article_name, Decimal("0"))
            actual_amount = actual_summary["expense"].get(article_name, Decimal("0"))

            message_parts.append(f"• *{article_name}*")
            message_parts.append(f"  План:  {format_amount(plan_amount)} ₽")
            message_parts.append(f"  Факт:  {format_amount(actual_amount)} ₽")

            # Calculate percentage and status
            if plan_amount > 0:
                percent = (actual_amount / plan_amount * 100)
                diff = actual_amount - plan_amount

                if percent <= 100:
                    status = "✅"
                    message_parts.append(
                        f"  {status} {percent:.0f}% (экономия: {format_amount(abs(diff))} ₽)"
                    )
                else:
                    status = "⚠️"
                    diff_sign = "+" if diff > 0 else ""
                    message_parts.append(
                        f"  {status} {percent:.0f}% (превышение: {diff_sign}{format_amount(diff)} ₽)"
                    )
            else:
                if actual_amount > 0:
                    message_parts.append(
                        f"  ℹ️ Расход без плана: {format_amount(actual_amount)} ₽"
                    )

    # Footer
    if not (plan_summary["income"] or plan_summary["expense"]):
        message_parts.append("")
        message_parts.append("_Нет данных о планах на этот период_")
        message_parts.append("")
        message_parts.append("Используйте /addplan для создания бюджетного плана")

    if not (actual_summary["income"] or actual_summary["expense"]):
        message_parts.append("")
        message_parts.append("_Нет фактических транзакций за этот период_")
        message_parts.append("")
        message_parts.append("Используйте /add для добавления транзакции")

    message_parts.append("")
    message_parts.append("Используйте /summary для просмотра других периодов")

    return "\n".join(message_parts)


# ConversationHandler для /summary command
summary_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("summary", summary_command)],
    states={
        SELECTING_PERIOD: [
            CallbackQueryHandler(period_selected, pattern="^summary_"),
        ],
    },
    fallbacks=[CommandHandler("cancel", cancel_summary)],
)
