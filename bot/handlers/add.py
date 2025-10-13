"""
/add command handler for creating budget facts (transactions).

Implements multi-step conversation flow:
1. Article selection (inline keyboard)
2. Amount input (with validation)
3. Date input (with shortcuts: "сегодня", "вчера")
4. Description input (optional, can skip)
5. Confirmation (summary + create fact)
"""

from datetime import date
from decimal import Decimal
from typing import Dict, Optional

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
    parse_article_callback,
    validate_amount,
    validate_date,
    validate_description,
)

logger = get_logger(__name__)

# Conversation states
SELECT_ARTICLE, ENTER_AMOUNT, ENTER_DATE, ENTER_DESCRIPTION, CONFIRM = range(5)

# Context keys for storing conversation data
KEY_ARTICLE_ID = "article_id"
KEY_ARTICLE_NAME = "article_name"
KEY_ARTICLE_TYPE = "article_type"
KEY_AMOUNT = "amount"
KEY_DATE = "date"
KEY_DESCRIPTION = "description"


async def add_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Start /add command conversation.

    Workflow:
    1. Check authentication
    2. Fetch user's articles from backend
    3. Display article selection inline keyboard
    4. Enter SELECT_ARTICLE state

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: Next conversation state (SELECT_ARTICLE or END)
    """
    user = update.effective_user

    if not user:
        logger.warning("/add called without user context")
        return ConversationHandler.END

    logger.info(f"/add command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /add attempt from user {user.id}")
        return ConversationHandler.END

    # Send "loading" message
    loading_msg = await update.message.reply_text(
        "⏳ Загружаю список категорий..."
    )

    try:
        # Fetch articles from backend
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()
        response = await api_client.list_articles(token, limit=1000)

        articles = response.get("articles", [])

        if not articles:
            await loading_msg.edit_text(
                "❌ У вас нет категорий для записи транзакций.\n\n"
                "Обратитесь к администратору для создания категорий."
            )
            logger.warning(f"User {user.id} has no articles")
            return ConversationHandler.END

        # Build inline keyboard grouped by type (income/expense)
        keyboard = build_article_keyboard(articles)

        # Clear previous conversation data
        context.user_data.pop(KEY_ARTICLE_ID, None)
        context.user_data.pop(KEY_ARTICLE_NAME, None)
        context.user_data.pop(KEY_ARTICLE_TYPE, None)
        context.user_data.pop(KEY_AMOUNT, None)
        context.user_data.pop(KEY_DATE, None)
        context.user_data.pop(KEY_DESCRIPTION, None)

        # Show article selection keyboard
        await loading_msg.edit_text(
            "💰 **Добавление транзакции**\n\n"
            "📋 Шаг 1/4: Выберите категорию\n\n"
            "Выберите категорию расхода или дохода:",
            reply_markup=keyboard,
            parse_mode="Markdown"
        )

        return SELECT_ARTICLE

    except Exception as e:
        logger.error(f"Error fetching articles: {e}", exc_info=True)
        await loading_msg.edit_text(
            "❌ Произошла ошибка при загрузке категорий.\n\n"
            "Попробуйте позже."
        )
        return ConversationHandler.END


def build_article_keyboard(articles: list[Dict]) -> InlineKeyboardMarkup:
    """
    Build inline keyboard for article selection.

    Groups articles by type (income/expense) and creates buttons.

    Args:
        articles: List of article dictionaries from API

    Returns:
        InlineKeyboardMarkup: Keyboard with article buttons

    Example output:
        💵 ДОХОДЫ
        [Salary] [Freelance]
        💸 РАСХОДЫ
        [Groceries] [Transport] [Utilities]
        [Cancel]
    """
    # Group articles by type
    income_articles = [a for a in articles if a.get("type") == "income"]
    expense_articles = [a for a in articles if a.get("type") == "expense"]

    keyboard = []

    # Income section
    if income_articles:
        # Header (disabled button)
        keyboard.append([
            InlineKeyboardButton("💵 ДОХОДЫ", callback_data="header:income")
        ])

        # Article buttons (2 per row)
        income_buttons = [
            InlineKeyboardButton(
                a["name"],
                callback_data=f"article:{a['id']}"
            )
            for a in income_articles
        ]

        # Split into rows of 2
        for i in range(0, len(income_buttons), 2):
            keyboard.append(income_buttons[i:i + 2])

    # Expense section
    if expense_articles:
        # Header (disabled button)
        keyboard.append([
            InlineKeyboardButton("💸 РАСХОДЫ", callback_data="header:expense")
        ])

        # Article buttons (2 per row)
        expense_buttons = [
            InlineKeyboardButton(
                a["name"],
                callback_data=f"article:{a['id']}"
            )
            for a in expense_articles
        ]

        # Split into rows of 2
        for i in range(0, len(expense_buttons), 2):
            keyboard.append(expense_buttons[i:i + 2])

    # Cancel button
    keyboard.append([
        InlineKeyboardButton("❌ Отмена", callback_data="cancel")
    ])

    return InlineKeyboardMarkup(keyboard)


async def article_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle article selection from inline keyboard.

    Workflow:
    1. Parse callback data to get article_id
    2. Fetch article details (name, type)
    3. Store in context
    4. Ask for amount input
    5. Enter ENTER_AMOUNT state

    Args:
        update: Telegram update (callback query)
        context: Bot context

    Returns:
        int: Next conversation state (ENTER_AMOUNT or END)
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle cancel
    if callback_data == "cancel":
        await query.edit_message_text(
            "❌ Добавление транзакции отменено."
        )
        return ConversationHandler.END

    # Handle header clicks (ignore)
    if callback_data.startswith("header:"):
        await query.answer("Выберите категорию из списка ниже", show_alert=False)
        return SELECT_ARTICLE

    # Parse article selection
    try:
        action, article_id = parse_article_callback(callback_data)

        if action != "article" or not article_id:
            await query.edit_message_text(
                "❌ Ошибка при выборе категории.\n\n"
                "Попробуйте еще раз: /add"
            )
            return ConversationHandler.END

    except ValueError as e:
        logger.error(f"Invalid callback data: {callback_data}, error: {e}")
        await query.edit_message_text(
            "❌ Ошибка при выборе категории."
        )
        return ConversationHandler.END

    try:
        # Fetch article details from backend
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()
        article = await api_client.get_article(token, article_id)

        # Store article info in context
        context.user_data[KEY_ARTICLE_ID] = article["id"]
        context.user_data[KEY_ARTICLE_NAME] = article["name"]
        context.user_data[KEY_ARTICLE_TYPE] = article["type"]

        # Ask for amount
        article_type_ru = "💵 Доход" if article["type"] == "income" else "💸 Расход"

        await query.edit_message_text(
            f"💰 **Добавление транзакции**\n\n"
            f"📋 Шаг 2/4: Введите сумму\n\n"
            f"Категория: **{article['name']}** ({article_type_ru})\n\n"
            f"Введите сумму транзакции:\n\n"
            f"_Примеры: 100, 50.75, 1000,50, 1 500_\n\n"
            f"Отправьте /cancel для отмены",
            parse_mode="Markdown"
        )

        logger.info(f"Article selected: {article['name']} (ID: {article_id})")

        return ENTER_AMOUNT

    except Exception as e:
        logger.error(f"Error fetching article {article_id}: {e}", exc_info=True)
        await query.edit_message_text(
            "❌ Ошибка при загрузке категории.\n\n"
            "Попробуйте позже."
        )
        return ConversationHandler.END


async def amount_entered(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle amount input.

    Workflow:
    1. Validate amount format
    2. Store in context
    3. Ask for date input
    4. Enter ENTER_DATE state

    Args:
        update: Telegram update (message)
        context: Bot context

    Returns:
        int: Next conversation state (ENTER_DATE or stay in ENTER_AMOUNT)
    """
    user_input = update.message.text.strip()

    try:
        # Validate amount
        amount = validate_amount(user_input)

        # Store in context
        context.user_data[KEY_AMOUNT] = str(amount)

        # Ask for date
        article_name = context.user_data.get(KEY_ARTICLE_NAME, "категория")

        await update.message.reply_text(
            f"💰 **Добавление транзакции**\n\n"
            f"📋 Шаг 3/4: Введите дату\n\n"
            f"Категория: **{article_name}**\n"
            f"Сумма: **{format_amount(amount)}** ₽\n\n"
            f"Введите дату транзакции:\n\n"
            f"_Примеры: сегодня, вчера, 13.10.2025, 13.10_\n\n"
            f"Отправьте /cancel для отмены",
            parse_mode="Markdown"
        )

        logger.info(f"Amount entered: {amount}")

        return ENTER_DATE

    except ValidationError as e:
        # Validation failed - show error and stay in same state
        await update.message.reply_text(
            f"{e.message}\n\n"
            f"Попробуйте еще раз или отправьте /cancel для отмены"
        )
        return ENTER_AMOUNT


async def date_entered(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle date input.

    Workflow:
    1. Validate date format
    2. Store in context
    3. Ask for description (optional)
    4. Enter ENTER_DESCRIPTION state

    Args:
        update: Telegram update (message)
        context: Bot context

    Returns:
        int: Next conversation state (ENTER_DESCRIPTION or stay in ENTER_DATE)
    """
    user_input = update.message.text.strip()

    try:
        # Validate date
        fact_date = validate_date(user_input)

        # Store in context
        context.user_data[KEY_DATE] = fact_date.isoformat()

        # Ask for description
        article_name = context.user_data.get(KEY_ARTICLE_NAME, "категория")
        amount_str = context.user_data.get(KEY_AMOUNT, "0")
        amount = Decimal(amount_str)

        # Create inline keyboard with skip button
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("⏭️ Пропустить описание", callback_data="skip_description")]
        ])

        await update.message.reply_text(
            f"💰 **Добавление транзакции**\n\n"
            f"📋 Шаг 4/4: Добавьте описание (необязательно)\n\n"
            f"Категория: **{article_name}**\n"
            f"Сумма: **{format_amount(amount)}** ₽\n"
            f"Дата: **{format_date(fact_date)}**\n\n"
            f"Введите описание транзакции (до 1000 символов):\n\n"
            f"_Например: Еженедельные покупки продуктов_\n\n"
            f"Или нажмите кнопку ниже, чтобы пропустить.\n"
            f"Отправьте /cancel для отмены",
            reply_markup=keyboard,
            parse_mode="Markdown"
        )

        logger.info(f"Date entered: {fact_date}")

        return ENTER_DESCRIPTION

    except ValidationError as e:
        # Validation failed - show error and stay in same state
        await update.message.reply_text(
            f"{e.message}\n\n"
            f"Попробуйте еще раз или отправьте /cancel для отмены"
        )
        return ENTER_DATE


async def description_entered(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle description input (or skip).

    Workflow:
    1. Validate description (if provided)
    2. Store in context
    3. Show confirmation summary
    4. Enter CONFIRM state

    Args:
        update: Telegram update (message or callback query for skip)
        context: Bot context

    Returns:
        int: Next conversation state (CONFIRM)
    """
    # Handle skip button
    if update.callback_query:
        query = update.callback_query
        await query.answer()

        if query.data == "skip_description":
            context.user_data[KEY_DESCRIPTION] = None
            logger.info("Description skipped")

            # Show confirmation
            await show_confirmation(query, context, edit_message=True)
            return CONFIRM

    # Handle text input
    elif update.message:
        user_input = update.message.text.strip()

        try:
            # Validate description
            description = validate_description(user_input)

            # Store in context
            context.user_data[KEY_DESCRIPTION] = description

            logger.info(f"Description entered: {description}")

            # Show confirmation
            await show_confirmation(update.message, context, edit_message=False)
            return CONFIRM

        except ValidationError as e:
            # Validation failed - show error and stay in same state
            await update.message.reply_text(
                f"{e.message}\n\n"
                f"Попробуйте еще раз или нажмите кнопку \"Пропустить\""
            )
            return ENTER_DESCRIPTION

    return ENTER_DESCRIPTION


async def show_confirmation(
    message_or_query,
    context: ContextTypes.DEFAULT_TYPE,
    edit_message: bool = False
):
    """
    Show confirmation summary with create/cancel buttons.

    Args:
        message_or_query: Message or CallbackQuery object
        context: Bot context
        edit_message: Whether to edit existing message (for callback queries)
    """
    # Gather data from context
    article_name = context.user_data.get(KEY_ARTICLE_NAME, "???")
    article_type = context.user_data.get(KEY_ARTICLE_TYPE, "")
    amount_str = context.user_data.get(KEY_AMOUNT, "0")
    date_str = context.user_data.get(KEY_DATE, "")
    description = context.user_data.get(KEY_DESCRIPTION)

    # Format values
    amount = Decimal(amount_str)
    fact_date = date.fromisoformat(date_str)

    article_type_ru = "💵 Доход" if article_type == "income" else "💸 Расход"
    description_display = description if description else "_не указано_"

    # Build confirmation message
    confirmation_text = (
        f"💰 **Подтверждение транзакции**\n\n"
        f"Проверьте данные перед сохранением:\n\n"
        f"Категория: **{article_name}** ({article_type_ru})\n"
        f"Сумма: **{format_amount(amount)}** ₽\n"
        f"Дата: **{format_date(fact_date)}**\n"
        f"Описание: {description_display}\n\n"
        f"Сохранить транзакцию?"
    )

    # Create inline keyboard
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Сохранить", callback_data="confirm_create"),
            InlineKeyboardButton("❌ Отменить", callback_data="confirm_cancel")
        ]
    ])

    # Send or edit message
    if edit_message and hasattr(message_or_query, "edit_message_text"):
        await message_or_query.edit_message_text(
            confirmation_text,
            reply_markup=keyboard,
            parse_mode="Markdown"
        )
    else:
        await message_or_query.reply_text(
            confirmation_text,
            reply_markup=keyboard,
            parse_mode="Markdown"
        )


async def confirmation_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle confirmation (create or cancel).

    Workflow:
    1. If confirmed → create fact via API
    2. If canceled → end conversation
    3. Show success/error message

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
    if callback_data == "confirm_cancel":
        await query.edit_message_text(
            "❌ Добавление транзакции отменено."
        )
        return ConversationHandler.END

    # Handle confirmation
    if callback_data == "confirm_create":
        # Show "creating" message
        await query.edit_message_text(
            "⏳ Создание транзакции..."
        )

        try:
            # Gather data
            article_id = context.user_data.get(KEY_ARTICLE_ID)
            amount_str = context.user_data.get(KEY_AMOUNT)
            date_str = context.user_data.get(KEY_DATE)
            description = context.user_data.get(KEY_DESCRIPTION)

            if not all([article_id, amount_str, date_str]):
                raise ValueError("Missing required data")

            # Create fact via API
            token = SessionManager.get_access_token(context)
            api_client = await get_api_client()

            fact_data = {
                "article_id": article_id,
                "amount": amount_str,
                "fact_date": date_str,
                "description": description
            }

            fact = await api_client.create_fact(
                token=token,
                article_id=article_id,
                fact_date=date_str,
                amount=amount_str,
                description=description
            )

            # Show success message
            article_name = context.user_data.get(KEY_ARTICLE_NAME, "категория")
            amount = Decimal(amount_str)
            fact_date = date.fromisoformat(date_str)

            await query.edit_message_text(
                f"✅ **Транзакция сохранена!**\n\n"
                f"Категория: **{article_name}**\n"
                f"Сумма: **{format_amount(amount)}** ₽\n"
                f"Дата: **{format_date(fact_date)}**\n\n"
                f"ID транзакции: `{fact['id']}`\n\n"
                f"Используйте /add для добавления новой транзакции\n"
                f"или /today для просмотра статистики за сегодня",
                parse_mode="Markdown"
            )

            logger.info(f"Fact created successfully: ID={fact['id']}")

            return ConversationHandler.END

        except Exception as e:
            logger.error(f"Error creating fact: {e}", exc_info=True)
            await query.edit_message_text(
                "❌ Ошибка при создании транзакции.\n\n"
                "Проверьте данные и попробуйте еще раз: /add"
            )
            return ConversationHandler.END

    return ConversationHandler.END


async def cancel_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /cancel command - abort conversation.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: ConversationHandler.END
    """
    await update.message.reply_text(
        "❌ Добавление транзакции отменено.\n\n"
        "Используйте /add для повторного запуска"
    )

    logger.info(f"Conversation canceled by user {update.effective_user.id}")

    return ConversationHandler.END


# Build ConversationHandler
add_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("add", add_command)],
    states={
        SELECT_ARTICLE: [
            CallbackQueryHandler(article_selected)
        ],
        ENTER_AMOUNT: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, amount_entered)
        ],
        ENTER_DATE: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, date_entered)
        ],
        ENTER_DESCRIPTION: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, description_entered),
            CallbackQueryHandler(description_entered, pattern="^skip_description$")
        ],
        CONFIRM: [
            CallbackQueryHandler(confirmation_handler, pattern="^confirm_")
        ],
    },
    fallbacks=[CommandHandler("cancel", cancel_command)],
    name="add_fact_conversation",
    persistent=False,
)
