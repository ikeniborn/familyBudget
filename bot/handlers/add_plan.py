"""
/addplan command handler for creating budget plans.

Implements multi-step conversation flow for adding budget plans (future-dated records):
1. Article selection (inline keyboard)
2. Amount input (with validation)
import warnings

# Suppress PTBUserWarning for per_message=False with CallbackQueryHandler
warnings.filterwarnings("ignore", message=".*per_message.*CallbackQueryHandler.*", category=UserWarning)
3. Date input (allows future dates for planning)
4. Description input (optional, can skip)
5. Confirmation (summary + create plan)

Differences from add.py (facts):
- record_type = "plan" (budget planning)
- Allows future dates (for budget periods ahead)
- UI messaging adapted for planning context
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

from backend.app.utils.planning import get_planning_month
from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.validators import (
    ValidationError,
    format_amount,
    format_date,
    parse_article_callback,
    validate_amount,
    validate_description,
)

logger = get_logger(__name__)

# Conversation states
SELECT_ARTICLE, ENTER_AMOUNT, ENTER_DATE, ENTER_DESCRIPTION, CONFIRM = range(5)

# Context keys for storing conversation data
KEY_ARTICLE_ID = "plan_article_id"
KEY_ARTICLE_NAME = "plan_article_name"
KEY_ARTICLE_TYPE = "plan_article_type"
KEY_AMOUNT = "plan_amount"
KEY_DATE = "plan_date"
KEY_DESCRIPTION = "plan_description"


def validate_plan_date(date_str: str) -> date:
    """
    Validate and parse date input for budget plans.

    Accepts formats:
    - "сегодня" / "today" → today's date
    - "DD.MM.YYYY" → specific date (e.g., "13.10.2025")
    - "DD.MM.YY" → specific date (e.g., "13.10.25" → 2025)
    - "DD.MM" → current year (e.g., "13.10" → 13.10.2025)

    Validation rules for PLANS:
    - Can be in the FUTURE (unlike facts)
    - Cannot be more than 10 years in the past
    - Cannot be more than 5 years in the future (reasonable planning horizon)

    Args:
        date_str: User input string

    Returns:
        date: Validated date object

    Raises:
        ValidationError: If validation fails
    """
    import re
    from datetime import datetime, timedelta

    if not date_str or not date_str.strip():
        raise ValidationError("❌ Дата не может быть пустой", field="date")

    date_str = date_str.strip().lower()
    today = date.today()

    # Handle shortcuts
    if date_str in ("сегодня", "today"):
        return today

    # Parse date formats: DD.MM.YYYY, DD.MM.YY, DD.MM
    date_patterns = [
        (r'^(\d{1,2})\.(\d{1,2})\.(\d{4})$', '%d.%m.%Y'),  # DD.MM.YYYY
        (r'^(\d{1,2})\.(\d{1,2})\.(\d{2})$', '%d.%m.%y'),  # DD.MM.YY
        (r'^(\d{1,2})\.(\d{1,2})$', None),  # DD.MM (current year)
    ]

    parsed_date = None

    for pattern, date_format in date_patterns:
        match = re.match(pattern, date_str)
        if match:
            if date_format:
                # Parse with format
                try:
                    parsed_date = datetime.strptime(date_str, date_format).date()
                except ValueError as e:
                    raise ValidationError(
                        f"❌ Неверная дата: {e}",
                        field="date"
                    )
            else:
                # DD.MM format - use current year
                day, month = match.groups()
                try:
                    parsed_date = date(today.year, int(month), int(day))
                except ValueError as e:
                    raise ValidationError(
                        f"❌ Неверная дата: {e}",
                        field="date"
                    )
            break

    if not parsed_date:
        raise ValidationError(
            "❌ Неверный формат даты.\n\n"
            "Примеры правильного ввода:\n"
            "• сегодня\n"
            "• 13.10.2025\n"
            "• 13.11 (ноябрь текущего года)\n"
            "• 01.01.2026 (будущий год)",
            field="date"
        )

    # Validate: cannot be more than 10 years old
    ten_years_ago = today - timedelta(days=365 * 10)
    if parsed_date < ten_years_ago:
        raise ValidationError(
            f"❌ Дата не может быть более 10 лет назад\n"
            f"(минимальная дата: {ten_years_ago.strftime('%d.%m.%Y')})",
            field="date"
        )

    # Validate: cannot be more than 5 years in future (reasonable planning horizon)
    five_years_ahead = today + timedelta(days=365 * 5)
    if parsed_date > five_years_ahead:
        raise ValidationError(
            f"❌ Дата плана не может быть более 5 лет вперед\n"
            f"(максимальная дата: {five_years_ahead.strftime('%d.%m.%Y')})",
            field="date"
        )

    logger.debug(f"Plan date validated: {date_str} → {parsed_date}")

    return parsed_date


async def addplan_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Start /addplan command conversation.

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
        logger.warning("/addplan called without user context")
        return ConversationHandler.END

    logger.info(f"/addplan command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /addplan attempt from user {user.id}")
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
                "❌ У вас нет категорий для планирования бюджета.\n\n"
                "Обратитесь к администратору для создания категорий."
            )
            logger.warning(f"User {user.id} has no articles")
            return ConversationHandler.END

        # Build inline keyboard grouped by type (income/expense)
        from bot.handlers.add import build_article_keyboard
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
            "📊 **Планирование бюджета**\n\n"
            "📋 Шаг 1/4: Выберите категорию\n\n"
            "Выберите категорию для планирования:",
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
            "❌ Планирование бюджета отменено."
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
                "Попробуйте еще раз: /addplan"
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
            f"📊 **Планирование бюджета**\n\n"
            f"📋 Шаг 2/4: Введите плановую сумму\n\n"
            f"Категория: **{article['name']}** ({article_type_ru})\n\n"
            f"Введите плановую сумму:\n\n"
            f"_Примеры: 5000, 1500.00, 10 000_\n\n"
            f"Отправьте /cancel для отмены",
            parse_mode="Markdown"
        )

        logger.info(f"Article selected for plan: {article['name']} (ID: {article_id})")

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

        hint = get_planning_month().strftime("01.%m.%Y")

        await update.message.reply_text(
            f"📊 **Планирование бюджета**\n\n"
            f"📋 Шаг 3/4: Введите период планирования\n\n"
            f"Категория: **{article_name}**\n"
            f"Плановая сумма: **{format_amount(amount)}**\n\n"
            f"Введите дату (период) плана:\n\n"
            f"💡 Рекомендуемый период: {hint}\n\n"
            f"_Примеры: 01.11.2025, 01.12, 2026-01-01_\n"
            f"_Можно указывать будущие даты для планирования_\n\n"
            f"Отправьте /cancel для отмены",
            parse_mode="Markdown"
        )

        logger.info(f"Plan amount entered: {amount}")

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
    1. Validate date format (allows future dates for plans)
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
        # Validate date (allows future dates for planning)
        plan_date = validate_plan_date(user_input)

        # Store in context
        context.user_data[KEY_DATE] = plan_date.isoformat()

        # Ask for description
        article_name = context.user_data.get(KEY_ARTICLE_NAME, "категория")
        amount_str = context.user_data.get(KEY_AMOUNT, "0")
        amount = Decimal(amount_str)

        # Create inline keyboard with skip button
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("⏭️ Пропустить описание", callback_data="skip_description")]
        ])

        await update.message.reply_text(
            f"📊 **Планирование бюджета**\n\n"
            f"📋 Шаг 4/4: Добавьте описание (необязательно)\n\n"
            f"Категория: **{article_name}**\n"
            f"Плановая сумма: **{format_amount(amount)}**\n"
            f"Период: **{format_date(plan_date)}**\n\n"
            f"Введите описание плана (до 1000 символов):\n\n"
            f"_Например: Плановый бюджет на ноябрь_\n\n"
            f"Или нажмите кнопку ниже, чтобы пропустить.\n"
            f"Отправьте /cancel для отмены",
            reply_markup=keyboard,
            parse_mode="Markdown"
        )

        logger.info(f"Plan date entered: {plan_date}")

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
            logger.info("Plan description skipped")

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

            logger.info(f"Plan description entered: {description}")

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
    plan_date = date.fromisoformat(date_str)

    article_type_ru = "💵 Доход" if article_type == "income" else "💸 Расход"
    description_display = description if description else "_не указано_"

    # Build confirmation message
    confirmation_text = (
        f"📊 **Подтверждение плана**\n\n"
        f"Проверьте данные перед сохранением:\n\n"
        f"Категория: **{article_name}** ({article_type_ru})\n"
        f"Плановая сумма: **{format_amount(amount)}**\n"
        f"Период: **{format_date(plan_date)}**\n"
        f"Описание: {description_display}\n\n"
        f"Сохранить план?"
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
    1. If confirmed → create plan via API
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
            "❌ Планирование бюджета отменено."
        )
        return ConversationHandler.END

    # Handle confirmation
    if callback_data == "confirm_create":
        # Show "creating" message
        await query.edit_message_text(
            "⏳ Создание плана..."
        )

        try:
            # Gather data
            article_id = context.user_data.get(KEY_ARTICLE_ID)
            article_type = context.user_data.get(KEY_ARTICLE_TYPE)
            amount_str = context.user_data.get(KEY_AMOUNT)
            date_str = context.user_data.get(KEY_DATE)
            description = context.user_data.get(KEY_DESCRIPTION)

            if not all([article_id, article_type, amount_str, date_str]):
                raise ValueError("Missing required data")

            # Always use positive amount (sign determined by article_type in backend)
            amount_value = abs(Decimal(amount_str))

            # Create plan via API
            token = SessionManager.get_access_token(context)
            api_client = await get_api_client()

            plan = await api_client.create_fact(
                token=token,
                article_id=article_id,
                fact_date=date_str,
                amount=str(amount_value),  # Send signed amount
                description=description,
                record_type="plan"  # CRITICAL: this is a budget plan
            )

            # Show success message
            article_name = context.user_data.get(KEY_ARTICLE_NAME, "категория")
            amount = Decimal(amount_str)
            plan_date = date.fromisoformat(date_str)

            await query.edit_message_text(
                f"✅ **План сохранен!**\n\n"
                f"Категория: **{article_name}**\n"
                f"Плановая сумма: **{format_amount(amount)}**\n"
                f"Период: **{format_date(plan_date)}**\n\n"
                f"ID плана: `{plan['id']}`\n\n"
                f"Используйте /addplan для добавления нового плана\n"
                f"или /summary для просмотра план vs факт",
                parse_mode="Markdown"
            )

            logger.info(f"Plan created successfully: ID={plan['id']}")

            return ConversationHandler.END

        except Exception as e:
            logger.error(f"Error creating plan: {e}", exc_info=True)
            await query.edit_message_text(
                "❌ Ошибка при создании плана.\n\n"
                "Проверьте данные и попробуйте еще раз: /addplan"
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
        "❌ Планирование бюджета отменено.\n\n"
        "Используйте /addplan для повторного запуска"
    )

    logger.info(f"Plan conversation canceled by user {update.effective_user.id}")

    return ConversationHandler.END


# Build ConversationHandler
addplan_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("addplan", addplan_command)],
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
    name="addplan_conversation",
    persistent=False,
    # Explicit conversation tracking parameters (fixes PTBUserWarning)
    # per_user=True: Each user has their own independent conversation state
    # per_chat=True: In group chats, each chat has separate conversation state
    # per_message=False: Callback queries can come from any message (not tied to specific message_id)
    #   - This is correct for our use case: user can interact with different messages during conversation
    #   - Alternative per_message=True would require callbacks ONLY from the original message with keyboard
    per_user=True,
    per_chat=True,
    per_message=False,
)
