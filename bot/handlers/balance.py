"""
/balance command handler for displaying current month's financial summary.

Shows total income vs total expenses vs balance for the current month.
"""

import calendar
from datetime import date
from decimal import Decimal

from telegram import Update
from telegram.ext import ContextTypes

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.validators import format_amount, format_date

logger = get_logger(__name__)


async def balance_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /balance command.

    Shows current month's total income, total expenses, and balance.

    Args:
        update: Telegram update
        context: Bot context
    """
    user = update.effective_user

    if not user:
        logger.warning("/balance called without user context")
        return

    logger.info(f"/balance command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /balance attempt from user {user.id}")
        return

    loading_msg = await update.message.reply_text("⏳ Загружаю баланс за текущий месяц...")

    try:
        today = date.today()
        start_of_month = date(today.year, today.month, 1)
        end_of_month = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])

        token = SessionManager.get_access_token(context)
        if token is None:
            await loading_msg.edit_text("❌ Сессия устарела. Выполните /start заново.")
            return
        api_client = await get_api_client()

        summary = await api_client.get_facts_summary(
            token=token,
            date_from=start_of_month.isoformat(),
            date_to=end_of_month.isoformat(),
        )

        text = format_balance_message(today, start_of_month, end_of_month, summary)
        await loading_msg.edit_text(text, parse_mode="Markdown")

        logger.info(f"Displayed balance for user {user.id}")

    except Exception as e:
        logger.error(f"Error fetching balance: {e}", exc_info=True)
        await loading_msg.edit_text(
            "❌ Произошла ошибка при загрузке баланса.\n\n"
            "Попробуйте позже."
        )


def format_balance_message(
    today: date,
    start_of_month: date,
    end_of_month: date,
    summary: dict,
) -> str:
    """
    Format balance message for current month.

    Args:
        today: Today's date
        start_of_month: First day of current month
        end_of_month: Last day of current month
        summary: Summary dict from API (total_income, total_expense, balance)

    Returns:
        str: Formatted message (Markdown)
    """
    total_income = Decimal(str(summary.get("total_income", "0")))
    total_expense = Decimal(str(summary.get("total_expense", "0")))
    balance = Decimal(str(summary.get("balance", "0")))

    balance_sign = "+" if balance >= 0 else ""
    balance_emoji = "📈" if balance >= 0 else "📉"

    month_names = {
        1: "Январь", 2: "Февраль", 3: "Март", 4: "Апрель",
        5: "Май", 6: "Июнь", 7: "Июль", 8: "Август",
        9: "Сентябрь", 10: "Октябрь", 11: "Ноябрь", 12: "Декабрь",
    }
    month_name = month_names[today.month]

    lines = [
        f"💰 *Баланс: {month_name} {today.year}*",
        f"📅 {format_date(start_of_month)} — {format_date(end_of_month)}",
        "",
        f"💵 Доходы:  *{format_amount(total_income)}*",
        f"💸 Расходы: *{format_amount(total_expense)}*",
        "",
        f"{balance_emoji} Баланс: *{balance_sign}{format_amount(balance)}*",
        "",
        "Используйте /today для статистики за сегодня",
        "или /summary для сводки по периодам",
    ]

    return "\n".join(lines)
