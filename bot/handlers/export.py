"""
/export command handler for data export.

Allows users to export their transactions to CSV format.
"""

import csv
import io
from datetime import date
from decimal import Decimal

from telegram import Update
from telegram.ext import ContextTypes

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager

logger = get_logger(__name__)


async def export_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /export command.

    Workflow:
    1. Check authentication
    2. Fetch all user's facts from backend
    3. Fetch articles for names
    4. Generate CSV file
    5. Send file to user

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        None
    """
    user = update.effective_user

    if not user:
        logger.warning("/export called without user context")
        return

    logger.info(f"/export command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /export attempt from user {user.id}")
        return

    # Send "generating" message
    loading_msg = await update.message.reply_text(
        "⏳ Генерирую CSV файл с вашими транзакциями..."
    )

    try:
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Fetch all facts
        facts_response = await api_client.list_facts(token=token, limit=10000)
        facts = facts_response.get("facts", [])

        if not facts:
            await loading_msg.edit_text(
                "📁 У вас пока нет транзакций для экспорта.\n\n"
                "Используйте /add для добавления транзакций."
            )
            return

        # Fetch articles for names
        articles_response = await api_client.list_articles(token=token, limit=1000)
        articles = articles_response.get("articles", [])

        # Create article lookup map
        articles_map = {article["id"]: article for article in articles}

        # Generate CSV
        csv_content = generate_csv(facts, articles_map)

        # Get today's date for filename
        today = date.today()
        filename = f"budget_export_{today.isoformat()}.csv"

        # Send file
        csv_file = io.BytesIO(csv_content.encode('utf-8-sig'))  # UTF-8 with BOM for Excel
        csv_file.name = filename

        await update.message.reply_document(
            document=csv_file,
            filename=filename,
            caption=(
                f"📊 **Экспорт транзакций**\n\n"
                f"Всего транзакций: **{len(facts)}**\n"
                f"Дата экспорта: **{today.strftime('%d.%m.%Y')}**\n\n"
                f"Файл готов для открытия в Excel, Google Sheets и других программах."
            ),
            parse_mode="Markdown"
        )

        # Delete loading message
        await loading_msg.delete()

        logger.info(f"Exported {len(facts)} transactions for user {user.id}")

    except Exception as e:
        logger.error(f"Error exporting data: {e}", exc_info=True)
        await loading_msg.edit_text(
            "❌ Произошла ошибка при экспорте данных.\n\n"
            "Попробуйте позже."
        )


def generate_csv(facts: list, articles_map: dict) -> str:
    """
    Generate CSV content from facts.

    Args:
        facts: List of fact dictionaries
        articles_map: Dictionary mapping article_id to article data

    Returns:
        str: CSV content

    CSV Format:
        Date,Category,Type,Amount,Description,ID
        13.10.2025,Groceries,Expense,1250.50,Weekly shopping,123
    """
    # Create StringIO for CSV writing
    output = io.StringIO()
    writer = csv.writer(output, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)

    # Write header
    writer.writerow([
        'Date',
        'Category',
        'Type',
        'Amount',
        'Description',
        'ID'
    ])

    # Write data rows
    for fact in facts:
        article_id = fact.get("article_id")
        article = articles_map.get(article_id, {})

        # Extract data
        fact_date = fact.get("fact_date", "")
        category = article.get("name", f"Article #{article_id}")
        article_type = article.get("type", "unknown")
        amount = fact.get("amount", "0")
        description = fact.get("description", "")
        fact_id = fact.get("id", "")

        # Format date (YYYY-MM-DD → DD.MM.YYYY)
        try:
            date_obj = date.fromisoformat(fact_date)
            formatted_date = date_obj.strftime("%d.%m.%Y")
        except (ValueError, TypeError):
            formatted_date = fact_date

        # Format type
        type_display = "Income" if article_type == "income" else "Expense"

        # Format amount
        try:
            amount_decimal = Decimal(str(amount))
            formatted_amount = f"{amount_decimal:.2f}"
        except (ValueError, TypeError):
            formatted_amount = str(amount)

        # Write row
        writer.writerow([
            formatted_date,
            category,
            type_display,
            formatted_amount,
            description,
            fact_id
        ])

    csv_content = output.getvalue()
    output.close()

    return csv_content
