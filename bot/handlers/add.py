"""
/add command handler for creating budget facts (transactions).

Implements multi-step conversation flow:
1. Article selection (inline keyboard)
2. Amount input (with validation)
3. Date input (with shortcuts: "сегодня", "вчера")
4. Description input (optional, can skip)
5. Confirmation (summary + create fact)
"""

from datetime import date, timedelta
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
from bot.utils.notification_service import get_notification_service
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
SELECT_ARTICLE, ENTER_AMOUNT, ENTER_DATE, ENTER_DESCRIPTION, SELECT_FINANCIAL_CENTER, SELECT_COST_CENTER, CONFIRM = range(7)

# Context keys for storing conversation data
KEY_ARTICLE_ID = "article_id"
KEY_ARTICLE_NAME = "article_name"
KEY_ARTICLE_TYPE = "article_type"
KEY_AMOUNT = "amount"
KEY_DATE = "date"
KEY_DESCRIPTION = "description"
KEY_FINANCIAL_CENTER_ID = "financial_center_id"
KEY_FINANCIAL_CENTER_NAME = "financial_center_name"
KEY_COST_CENTER_ID = "cost_center_id"
KEY_COST_CENTER_NAME = "cost_center_name"


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

        # Ask for date with quick buttons
        article_name = context.user_data.get(KEY_ARTICLE_NAME, "категория")

        # Create inline keyboard with quick date options
        keyboard = [
            [
                InlineKeyboardButton("📅 Сегодня", callback_data="date:today"),
                InlineKeyboardButton("🕐 Вчера", callback_data="date:yesterday"),
            ],
            [
                InlineKeyboardButton("✏️ Ввести дату вручную", callback_data="date:manual"),
            ],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            f"💰 **Добавление транзакции**\n\n"
            f"📋 Шаг 3/4: Введите дату\n\n"
            f"Категория: **{article_name}**\n"
            f"Сумма: **{format_amount(amount)}** ₽\n\n"
            f"Выберите дату транзакции:",
            parse_mode="Markdown",
            reply_markup=reply_markup
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


async def date_button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle date quick selection buttons (Today, Yesterday, Manual).

    Args:
        update: Telegram update (callback query)
        context: Bot context

    Returns:
        int: Next conversation state (ENTER_DESCRIPTION or stay in ENTER_DATE)
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle "Today" button
    if callback_data == "date:today":
        fact_date = date.today()
        context.user_data[KEY_DATE] = fact_date.isoformat()

        logger.info(f"Date selected (today): {fact_date}")

        # Proceed to description
        await proceed_to_description(query, context, fact_date, edit_message=True)
        return ENTER_DESCRIPTION

    # Handle "Yesterday" button
    elif callback_data == "date:yesterday":
        fact_date = date.today() - timedelta(days=1)
        context.user_data[KEY_DATE] = fact_date.isoformat()

        logger.info(f"Date selected (yesterday): {fact_date}")

        # Proceed to description
        await proceed_to_description(query, context, fact_date, edit_message=True)
        return ENTER_DESCRIPTION

    # Handle "Manual entry" button
    elif callback_data == "date:manual":
        await query.edit_message_text(
            f"💰 **Добавление транзакции**\n\n"
            f"📋 Шаг 3/4: Введите дату\n\n"
            f"Введите дату в одном из форматов:\n\n"
            f"• `ДД.ММ.ГГГГ` (например: 15.10.2025)\n"
            f"• `ДД.ММ` (например: 15.10 - текущий год)\n"
            f"• `ДД` (например: 15 - текущий месяц)\n"
            f"• Или текстом: `сегодня`, `вчера`\n\n"
            f"Отправьте /cancel для отмены",
            parse_mode="Markdown"
        )
        logger.info("Date manual entry requested")
        return ENTER_DATE

    return ENTER_DATE


async def proceed_to_description(
    message_or_query,
    context: ContextTypes.DEFAULT_TYPE,
    fact_date: date,
    edit_message: bool = False
):
    """
    Proceed to description step.

    Args:
        message_or_query: Message or CallbackQuery object
        context: Bot context
        fact_date: Selected date
        edit_message: Whether to edit existing message (for callback queries)
    """
    article_name = context.user_data.get(KEY_ARTICLE_NAME, "категория")
    amount_str = context.user_data.get(KEY_AMOUNT, "0")
    amount = Decimal(amount_str)

    # Create inline keyboard with skip button
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("⏭️ Пропустить описание", callback_data="skip_description")]
    ])

    message_text = (
        f"💰 **Добавление транзакции**\n\n"
        f"📋 Шаг 4/4: Добавьте описание (необязательно)\n\n"
        f"Категория: **{article_name}**\n"
        f"Сумма: **{format_amount(amount)}** ₽\n"
        f"Дата: **{format_date(fact_date)}**\n\n"
        f"Введите описание транзакции (до 1000 символов):\n\n"
        f"_Например: Еженедельные покупки продуктов_\n\n"
        f"Или нажмите кнопку ниже, чтобы пропустить.\n"
        f"Отправьте /cancel для отмены"
    )

    # Send or edit message
    if edit_message and hasattr(message_or_query, "edit_message_text"):
        await message_or_query.edit_message_text(
            message_text,
            reply_markup=keyboard,
            parse_mode="Markdown"
        )
    else:
        await message_or_query.reply_text(
            message_text,
            reply_markup=keyboard,
            parse_mode="Markdown"
        )


async def date_entered(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle date input (text).

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

        logger.info(f"Date entered: {fact_date}")

        # Proceed to description
        await proceed_to_description(update.message, context, fact_date, edit_message=False)
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

            # Proceed to financial center selection
            await show_financial_center_selection(query, context, edit_message=True)
            return SELECT_FINANCIAL_CENTER

    # Handle text input
    elif update.message:
        user_input = update.message.text.strip()

        try:
            # Validate description
            description = validate_description(user_input)

            # Store in context
            context.user_data[KEY_DESCRIPTION] = description

            logger.info(f"Description entered: {description}")

            # Proceed to financial center selection
            await show_financial_center_selection(update.message, context, edit_message=False)
            return SELECT_FINANCIAL_CENTER

        except ValidationError as e:
            # Validation failed - show error and stay in same state
            await update.message.reply_text(
                f"{e.message}\n\n"
                f"Попробуйте еще раз или нажмите кнопку \"Пропустить\""
            )
            return ENTER_DESCRIPTION

    return ENTER_DESCRIPTION


async def show_financial_center_selection(
    message_or_query,
    context: ContextTypes.DEFAULT_TYPE,
    edit_message: bool = False
):
    """
    Show financial center selection with skip button.

    Args:
        message_or_query: Message or CallbackQuery object
        context: Bot context
        edit_message: Whether to edit existing message (for callback queries)
    """
    try:
        # Fetch financial centers from backend
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()
        response = await api_client.get_financial_centers(
            token=token,
            limit=1000,
            include_global=True
        )

        centers = response.get("financial_centers", [])

        # Build inline keyboard
        keyboard = []

        if centers:
            # Add center buttons (2 per row)
            center_buttons = [
                InlineKeyboardButton(
                    f"{c['name']}" + (" 🌐" if c.get('is_global') else ""),
                    callback_data=f"fc:{c['id']}"
                )
                for c in centers
            ]

            # Split into rows of 2
            for i in range(0, len(center_buttons), 2):
                keyboard.append(center_buttons[i:i + 2])

        # Skip button
        keyboard.append([
            InlineKeyboardButton("⏭️ Пропустить ЦФО", callback_data="skip_financial_center")
        ])

        keyboard_markup = InlineKeyboardMarkup(keyboard)

        message_text = (
            f"💰 **Добавление транзакции**\n\n"
            f"📋 Шаг 5/6: Выберите ЦФО (необязательно)\n\n"
            f"Финансовый центр (ЦФО) - счет, кошелек, наличные:\n\n"
            f"Или нажмите \"Пропустить\", чтобы не указывать.\n"
            f"Отправьте /cancel для отмены"
        )

        # Send or edit message
        if edit_message and hasattr(message_or_query, "edit_message_text"):
            await message_or_query.edit_message_text(
                message_text,
                reply_markup=keyboard_markup,
                parse_mode="Markdown"
            )
        else:
            await message_or_query.reply_text(
                message_text,
                reply_markup=keyboard_markup,
                parse_mode="Markdown"
            )

    except Exception as e:
        logger.error(f"Error fetching financial centers: {e}", exc_info=True)

        # Fallback: show skip button only
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("⏭️ Пропустить ЦФО", callback_data="skip_financial_center")
        ]])

        error_text = (
            "⚠️ Не удалось загрузить список ЦФО.\n\n"
            "Нажмите \"Пропустить\", чтобы продолжить без указания ЦФО."
        )

        if edit_message and hasattr(message_or_query, "edit_message_text"):
            await message_or_query.edit_message_text(error_text, reply_markup=keyboard)
        else:
            await message_or_query.reply_text(error_text, reply_markup=keyboard)


async def financial_center_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle financial center selection or skip.

    Returns:
        int: Next state (SELECT_COST_CENTER)
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle skip
    if callback_data == "skip_financial_center":
        context.user_data[KEY_FINANCIAL_CENTER_ID] = None
        context.user_data[KEY_FINANCIAL_CENTER_NAME] = None
        logger.info("Financial center skipped")

    # Handle selection
    elif callback_data.startswith("fc:"):
        try:
            center_id = int(callback_data.split(":")[1])

            # Fetch center details
            token = SessionManager.get_access_token(context)
            api_client = await get_api_client()
            center = await api_client.get(
                f"/financial-centers/{center_id}",
                token=token
            )

            context.user_data[KEY_FINANCIAL_CENTER_ID] = center["id"]
            context.user_data[KEY_FINANCIAL_CENTER_NAME] = center["name"]

            logger.info(f"Financial center selected: {center['name']} (ID: {center_id})")

        except Exception as e:
            logger.error(f"Error fetching financial center: {e}", exc_info=True)
            context.user_data[KEY_FINANCIAL_CENTER_ID] = None
            context.user_data[KEY_FINANCIAL_CENTER_NAME] = None

    # Proceed to cost center selection
    await show_cost_center_selection(query, context, edit_message=True)
    return SELECT_COST_CENTER


async def show_cost_center_selection(
    message_or_query,
    context: ContextTypes.DEFAULT_TYPE,
    edit_message: bool = False
):
    """
    Show cost center selection with skip button.

    Args:
        message_or_query: Message or CallbackQuery object
        context: Bot context
        edit_message: Whether to edit existing message (for callback queries)
    """
    try:
        # Fetch cost centers from backend
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()
        response = await api_client.get_cost_centers(
            token=token,
            limit=1000,
            include_global=True
        )

        centers = response.get("cost_centers", [])

        # Build inline keyboard
        keyboard = []

        if centers:
            # Add center buttons (2 per row)
            center_buttons = [
                InlineKeyboardButton(
                    f"{c['name']}" + (" 🌐" if c.get('is_global') else ""),
                    callback_data=f"cc:{c['id']}"
                )
                for c in centers
            ]

            # Split into rows of 2
            for i in range(0, len(center_buttons), 2):
                keyboard.append(center_buttons[i:i + 2])

        # Skip button
        keyboard.append([
            InlineKeyboardButton("⏭️ Пропустить МВЗ", callback_data="skip_cost_center")
        ])

        keyboard_markup = InlineKeyboardMarkup(keyboard)

        message_text = (
            f"💰 **Добавление транзакции**\n\n"
            f"📋 Шаг 6/6: Выберите МВЗ (необязательно)\n\n"
            f"Место возникновения затрат (МВЗ) - проект, отдел, группа:\n\n"
            f"Или нажмите \"Пропустить\", чтобы не указывать.\n"
            f"Отправьте /cancel для отмены"
        )

        # Send or edit message
        if edit_message and hasattr(message_or_query, "edit_message_text"):
            await message_or_query.edit_message_text(
                message_text,
                reply_markup=keyboard_markup,
                parse_mode="Markdown"
            )
        else:
            await message_or_query.reply_text(
                message_text,
                reply_markup=keyboard_markup,
                parse_mode="Markdown"
            )

    except Exception as e:
        logger.error(f"Error fetching cost centers: {e}", exc_info=True)

        # Fallback: show skip button only
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("⏭️ Пропустить МВЗ", callback_data="skip_cost_center")
        ]])

        error_text = (
            "⚠️ Не удалось загрузить список МВЗ.\n\n"
            "Нажмите \"Пропустить\", чтобы продолжить без указания МВЗ."
        )

        if edit_message and hasattr(message_or_query, "edit_message_text"):
            await message_or_query.edit_message_text(error_text, reply_markup=keyboard)
        else:
            await message_or_query.reply_text(error_text, reply_markup=keyboard)


async def cost_center_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle cost center selection or skip.

    Returns:
        int: Next state (CONFIRM)
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle skip
    if callback_data == "skip_cost_center":
        context.user_data[KEY_COST_CENTER_ID] = None
        context.user_data[KEY_COST_CENTER_NAME] = None
        logger.info("Cost center skipped")

    # Handle selection
    elif callback_data.startswith("cc:"):
        try:
            center_id = int(callback_data.split(":")[1])

            # Fetch center details
            token = SessionManager.get_access_token(context)
            api_client = await get_api_client()
            center = await api_client.get(
                f"/cost-centers/{center_id}",
                token=token
            )

            context.user_data[KEY_COST_CENTER_ID] = center["id"]
            context.user_data[KEY_COST_CENTER_NAME] = center["name"]

            logger.info(f"Cost center selected: {center['name']} (ID: {center_id})")

        except Exception as e:
            logger.error(f"Error fetching cost center: {e}", exc_info=True)
            context.user_data[KEY_COST_CENTER_ID] = None
            context.user_data[KEY_COST_CENTER_NAME] = None

    # Proceed to confirmation
    await show_confirmation(query, context, edit_message=True)
    return CONFIRM


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
    financial_center_name = context.user_data.get(KEY_FINANCIAL_CENTER_NAME)
    cost_center_name = context.user_data.get(KEY_COST_CENTER_NAME)

    # Format values
    amount = Decimal(amount_str)
    fact_date = date.fromisoformat(date_str)

    article_type_ru = "💵 Доход" if article_type == "income" else "💸 Расход"
    description_display = description if description else "_не указано_"
    fc_display = financial_center_name if financial_center_name else "_не указано_"
    cc_display = cost_center_name if cost_center_name else "_не указано_"

    # Build confirmation message
    confirmation_text = (
        f"💰 **Подтверждение транзакции**\n\n"
        f"Проверьте данные перед сохранением:\n\n"
        f"Категория: **{article_name}** ({article_type_ru})\n"
        f"Сумма: **{format_amount(amount)}** ₽\n"
        f"Дата: **{format_date(fact_date)}**\n"
        f"Описание: {description_display}\n"
        f"ЦФО: {fc_display}\n"
        f"МВЗ: {cc_display}\n\n"
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
            article_type = context.user_data.get(KEY_ARTICLE_TYPE)
            amount_str = context.user_data.get(KEY_AMOUNT)
            date_str = context.user_data.get(KEY_DATE)
            description = context.user_data.get(KEY_DESCRIPTION)
            financial_center_id = context.user_data.get(KEY_FINANCIAL_CENTER_ID)
            cost_center_id = context.user_data.get(KEY_COST_CENTER_ID)

            if not all([article_id, article_type, amount_str, date_str]):
                raise ValueError("Missing required data")

            # Apply sign to amount based on article type
            # Convention: income = positive (+), expense = negative (-)
            amount_value = Decimal(amount_str)
            if article_type == "expense":
                amount_value = -abs(amount_value)  # Make negative for expenses
            elif article_type == "income":
                amount_value = abs(amount_value)   # Keep positive for income

            # Create fact via API
            token = SessionManager.get_access_token(context)
            api_client = await get_api_client()

            fact = await api_client.create_fact(
                token=token,
                article_id=article_id,
                fact_date=date_str,
                amount=str(amount_value),  # Send signed amount
                description=description,
                record_type="fact",  # Explicit: this is actual transaction
                financial_center_id=financial_center_id,  # Optional ЦФО
                cost_center_id=cost_center_id  # Optional МВЗ
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

            # Check budget threshold for expenses (if notifications enabled)
            if article_type == "expense":
                try:
                    # Get user's notification settings
                    from bot.handlers.settings import KEY_NOTIFICATIONS, KEY_BUDGET_THRESHOLD, DEFAULT_SETTINGS

                    notifications_enabled = context.user_data.get(
                        KEY_NOTIFICATIONS,
                        DEFAULT_SETTINGS[KEY_NOTIFICATIONS]
                    )

                    if notifications_enabled:
                        threshold_percent = context.user_data.get(
                            KEY_BUDGET_THRESHOLD,
                            DEFAULT_SETTINGS[KEY_BUDGET_THRESHOLD]
                        )

                        # Get notification service
                        notification_service = get_notification_service()

                        if notification_service:
                            user_telegram_id = update.effective_user.id

                            # Check threshold (async, non-blocking)
                            await notification_service.check_budget_threshold(
                                token=token,
                                telegram_id=user_telegram_id,
                                article_id=article_id,
                                threshold_percent=threshold_percent
                            )

                            logger.debug(
                                f"Budget threshold check completed for article {article_id}"
                            )
                        else:
                            logger.warning("Notification service not initialized")

                except Exception as e:
                    # Don't fail transaction if notification check fails
                    logger.error(f"Error checking budget threshold: {e}", exc_info=True)

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
            CallbackQueryHandler(date_button_handler, pattern="^date:(today|yesterday|manual)$"),
            MessageHandler(filters.TEXT & ~filters.COMMAND, date_entered)
        ],
        ENTER_DESCRIPTION: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, description_entered),
            CallbackQueryHandler(description_entered, pattern="^skip_description$")
        ],
        SELECT_FINANCIAL_CENTER: [
            CallbackQueryHandler(financial_center_selected, pattern="^(fc:|skip_financial_center)"),
        ],
        SELECT_COST_CENTER: [
            CallbackQueryHandler(cost_center_selected, pattern="^(cc:|skip_cost_center)"),
        ],
        CONFIRM: [
            CallbackQueryHandler(confirmation_handler, pattern="^confirm_")
        ],
    },
    fallbacks=[CommandHandler("cancel", cancel_command)],
    name="add_fact_conversation",
    persistent=False,
    per_message=True,  # Track conversation state per message for CallbackQueryHandler
)
