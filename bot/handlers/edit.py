"""
/edit command handler for editing and deleting transactions.

Allows users to:
- Select from last 10 transactions via inline keyboard
- Edit transaction fields (amount, date, description)
- Delete transactions with confirmation
"""

from datetime import date
from decimal import Decimal
from typing import Dict, List

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
    validate_amount,
    validate_date,
    validate_description,
)

logger = get_logger(__name__)

# States
SELECTING_FACT, SELECT_ACTION, ENTER_VALUE, CONFIRM_DELETE = range(4)

# Context keys
KEY_FACT_ID = "edit_fact_id"
KEY_FACT_DATA = "edit_fact_data"
KEY_ARTICLE_DATA = "edit_article_data"
KEY_EDIT_FIELD = "edit_field"


def format_fact_summary(fact: Dict, article: Dict) -> str:
    """
    Format single fact for display in list.

    Args:
        fact: Fact data
        article: Article data

    Returns:
        str: Formatted fact summary (one line)
    """
    fact_id = fact.get("id")
    fact_date_str = fact.get("fact_date", "")
    amount = Decimal(str(fact.get("amount", "0")))
    article_name = article.get("name", "???")
    article_type = article.get("type", "unknown")
    record_type = fact.get("record_type", "fact")

    # Format date
    try:
        date_obj = date.fromisoformat(fact_date_str)
        formatted_date = format_date(date_obj)
    except (ValueError, TypeError):
        formatted_date = fact_date_str[:10]  # Fallback to first 10 chars

    # Type emoji
    type_emoji = "💵" if article_type == "income" else "💸"

    # Record type marker
    record_marker = "📅" if record_type == "plan" else ""

    # Format amount (show absolute value for display)
    amount_display = format_amount(abs(amount))

    return f"{record_marker}{type_emoji} {formatted_date} | {article_name}: {amount_display} ₽"


def build_facts_keyboard(facts: List[Dict], articles_map: Dict[int, Dict]) -> InlineKeyboardMarkup:
    """
    Build inline keyboard with facts selection.

    Args:
        facts: List of facts
        articles_map: Dictionary mapping article_id to article data

    Returns:
        InlineKeyboardMarkup with fact buttons
    """
    keyboard = []

    for fact in facts:
        fact_id = fact.get("id")
        article_id = fact.get("article_id")
        article = articles_map.get(article_id, {})

        # Format summary
        summary = format_fact_summary(fact, article)

        # Truncate if too long (Telegram limit: 64 bytes for callback_data)
        # Use first 40 chars of summary for button text
        button_text = summary[:50] + "..." if len(summary) > 50 else summary

        keyboard.append([
            InlineKeyboardButton(button_text, callback_data=f"edit_select:{fact_id}")
        ])

    # Add cancel button
    keyboard.append([InlineKeyboardButton("❌ Отмена", callback_data="edit_cancel")])

    return InlineKeyboardMarkup(keyboard)


async def edit_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /edit command entry point.

    Shows last 10 transactions with inline keyboard for selection.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: Next conversation state (SELECTING_FACT or END)
    """
    user = update.effective_user

    if not user:
        logger.warning("/edit called without user context")
        return ConversationHandler.END

    logger.info(f"/edit command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\n\n" "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /edit attempt from user {user.id}")
        return ConversationHandler.END

    # Send loading message
    loading_msg = await update.message.reply_text("⏳ Загружаю последние транзакции...")

    try:
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Fetch last 10 facts
        facts_response = await api_client.list_facts(token=token, limit=10)
        facts = facts_response.get("facts", [])

        if not facts:
            await loading_msg.edit_text(
                "📭 У вас пока нет транзакций.\n\n"
                "Используйте /add для добавления первой транзакции"
            )
            return ConversationHandler.END

        # Fetch articles for display
        articles_response = await api_client.list_articles(token=token, limit=1000)
        articles = articles_response.get("articles", [])
        articles_map = {article["id"]: article for article in articles}

        # Build keyboard
        keyboard = build_facts_keyboard(facts, articles_map)

        await loading_msg.edit_text(
            "✏️ *Редактирование транзакций*\n\n"
            "Выберите транзакцию для редактирования или удаления:\n\n"
            "_Показаны последние 10 транзакций_",
            reply_markup=keyboard,
            parse_mode="Markdown",
        )

        # Store facts in context for later use
        context.user_data["edit_facts"] = facts
        context.user_data["edit_articles_map"] = articles_map

        return SELECTING_FACT

    except Exception as e:
        logger.error(f"Error fetching facts: {e}", exc_info=True)
        await loading_msg.edit_text(
            "❌ Произошла ошибка при загрузке транзакций.\n\n" "Попробуйте позже."
        )
        return ConversationHandler.END


async def fact_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle fact selection callback.

    Args:
        update: Telegram update (callback query)
        context: Bot context

    Returns:
        int: Next conversation state (SELECT_ACTION or END)
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle cancel
    if callback_data == "edit_cancel":
        await query.edit_message_text("❌ Редактирование отменено")
        return ConversationHandler.END

    # Parse fact ID
    if not callback_data.startswith("edit_select:"):
        logger.error(f"Invalid callback data: {callback_data}")
        await query.edit_message_text("❌ Ошибка обработки запроса")
        return ConversationHandler.END

    fact_id_str = callback_data.split(":", 1)[1]

    try:
        fact_id = int(fact_id_str)
    except ValueError:
        logger.error(f"Invalid fact ID: {fact_id_str}")
        await query.edit_message_text("❌ Неверный ID транзакции")
        return ConversationHandler.END

    # Fetch fact details
    try:
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Get fact by ID
        fact = await api_client.get_fact(token, fact_id)

        # Fetch article for name
        article_id = fact.get("article_id")
        article = await api_client.get_article(token, article_id)

        # Store in context
        context.user_data[KEY_FACT_ID] = fact_id
        context.user_data[KEY_FACT_DATA] = fact
        context.user_data[KEY_ARTICLE_DATA] = article

        # Show action selection menu
        await show_action_selection(query, context, fact, article)

        return SELECT_ACTION

    except Exception as e:
        logger.error(f"Error fetching fact {fact_id}: {e}", exc_info=True)

        # Check error type
        error_message = str(e)
        if "404" in error_message or "not found" in error_message.lower():
            await query.edit_message_text(
                f"❌ Транзакция с ID {fact_id} не найдена."
            )
        elif "403" in error_message or "forbidden" in error_message.lower():
            await query.edit_message_text(
                f"❌ У вас нет доступа к транзакции с ID {fact_id}."
            )
        else:
            await query.edit_message_text(
                "❌ Произошла ошибка при загрузке транзакции."
            )

        return ConversationHandler.END


async def show_action_selection(
    query, context: ContextTypes.DEFAULT_TYPE, fact: Dict, article: Dict
):
    """
    Show action selection menu (edit fields or delete).

    Args:
        query: CallbackQuery object
        context: Bot context
        fact: Fact data
        article: Article data
    """
    fact_date = fact.get("fact_date", "")
    amount = Decimal(str(fact.get("amount", "0")))
    description = fact.get("description", "")
    article_name = article.get("name", "???")
    article_type = article.get("type", "unknown")
    record_type = fact.get("record_type", "fact")

    # Format date
    try:
        date_obj = date.fromisoformat(fact_date)
        formatted_date = format_date(date_obj)
    except (ValueError, TypeError):
        formatted_date = fact_date

    # Type display
    type_emoji = "💵" if article_type == "income" else "💸"
    type_text = "Доход" if article_type == "income" else "Расход"

    # Record type display
    record_type_text = "План" if record_type == "plan" else "Факт"

    description_display = description if description else "_не указано_"

    text = f"""✏️ *Редактирование транзакции*

Текущие данные:

{type_emoji} *{type_text}* ({record_type_text})
Категория: {article_name}
Сумма: {format_amount(abs(amount))} ₽
Дата: {formatted_date}
Описание: {description_display}

Выберите действие:"""

    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "💰 Изменить сумму", callback_data="edit_field:amount"
                )
            ],
            [
                InlineKeyboardButton(
                    "📅 Изменить дату", callback_data="edit_field:date"
                )
            ],
            [
                InlineKeyboardButton(
                    "📝 Изменить описание", callback_data="edit_field:description"
                )
            ],
            [
                InlineKeyboardButton(
                    "🗑 Удалить транзакцию", callback_data="edit_action:delete"
                )
            ],
            [InlineKeyboardButton("✅ Готово", callback_data="edit_action:done")],
            [InlineKeyboardButton("❌ Отмена", callback_data="edit_action:cancel")],
        ]
    )

    await query.edit_message_text(text, reply_markup=keyboard, parse_mode="Markdown")


async def action_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle action selection (edit field or delete).

    Args:
        update: Telegram update (callback query)
        context: Bot context

    Returns:
        int: Next conversation state
    """
    query = update.callback_query
    await query.answer()

    callback_data = query.data

    # Handle cancel
    if callback_data == "edit_action:cancel":
        await query.edit_message_text("❌ Редактирование отменено")
        return ConversationHandler.END

    # Handle done
    if callback_data == "edit_action:done":
        await query.edit_message_text(
            "✅ Редактирование завершено!\n\n"
            "Используйте /list для просмотра обновлённых транзакций"
        )
        return ConversationHandler.END

    # Handle delete
    if callback_data == "edit_action:delete":
        fact = context.user_data.get(KEY_FACT_DATA, {})
        article = context.user_data.get(KEY_ARTICLE_DATA, {})

        # Show confirmation
        amount = Decimal(str(fact.get("amount", "0")))
        article_name = article.get("name", "???")
        fact_date = fact.get("fact_date", "")

        try:
            date_obj = date.fromisoformat(fact_date)
            formatted_date = format_date(date_obj)
        except (ValueError, TypeError):
            formatted_date = fact_date

        await query.edit_message_text(
            f"🗑 *Удаление транзакции*\n\n"
            f"Вы уверены, что хотите удалить эту транзакцию?\n\n"
            f"Категория: {article_name}\n"
            f"Сумма: {format_amount(abs(amount))} ₽\n"
            f"Дата: {formatted_date}\n\n"
            f"⚠️ *Это действие нельзя отменить!*",
            reply_markup=InlineKeyboardMarkup(
                [
                    [
                        InlineKeyboardButton(
                            "✅ Да, удалить", callback_data="delete_confirm:yes"
                        ),
                        InlineKeyboardButton(
                            "❌ Отмена", callback_data="delete_confirm:no"
                        ),
                    ]
                ]
            ),
            parse_mode="Markdown",
        )

        return CONFIRM_DELETE

    # Handle field edit
    if callback_data.startswith("edit_field:"):
        field = callback_data.split(":", 1)[1]
        context.user_data[KEY_EDIT_FIELD] = field

        # Ask for new value
        if field == "amount":
            await query.edit_message_text(
                "💰 *Изменение суммы*\n\n"
                "Введите новую сумму:\n\n"
                "_Примеры: 100, 50.75, 1000,50, 1 500_\n\n"
                "Отправьте /cancel для отмены",
                parse_mode="Markdown",
            )
        elif field == "date":
            await query.edit_message_text(
                "📅 *Изменение даты*\n\n"
                "Введите новую дату:\n\n"
                "_Примеры: сегодня, вчера, 13.10.2025, 13.10_\n\n"
                "Отправьте /cancel для отмены",
                parse_mode="Markdown",
            )
        elif field == "description":
            current_desc = context.user_data[KEY_FACT_DATA].get("description", "")
            current_display = current_desc if current_desc else "_пусто_"
            await query.edit_message_text(
                f"📝 *Изменение описания*\n\n"
                f"Текущее описание: {current_display}\n\n"
                f"Введите новое описание:\n\n"
                f"_Или отправьте '-' для удаления описания_\n\n"
                f"Отправьте /cancel для отмены",
                parse_mode="Markdown",
            )

        return ENTER_VALUE

    return SELECT_ACTION


async def delete_confirmed(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle delete confirmation.

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
    if callback_data == "delete_confirm:no":
        # Return to action selection
        fact = context.user_data.get(KEY_FACT_DATA, {})
        article = context.user_data.get(KEY_ARTICLE_DATA, {})
        await show_action_selection(query, context, fact, article)
        return SELECT_ACTION

    # Handle delete confirmation
    if callback_data == "delete_confirm:yes":
        fact_id = context.user_data.get(KEY_FACT_ID)

        if not fact_id:
            await query.edit_message_text("❌ Ошибка: ID транзакции не найден")
            return ConversationHandler.END

        try:
            token = SessionManager.get_access_token(context)
            api_client = await get_api_client()

            # Delete fact
            await api_client.delete_fact(token, fact_id)

            await query.edit_message_text(
                "✅ Транзакция успешно удалена!\n\n"
                "Используйте /list для просмотра оставшихся транзакций"
            )

            logger.info(f"User deleted fact {fact_id}")

            return ConversationHandler.END

        except Exception as e:
            logger.error(f"Error deleting fact {fact_id}: {e}", exc_info=True)
            await query.edit_message_text(
                "❌ Произошла ошибка при удалении транзакции.\n\n" "Попробуйте позже."
            )
            return ConversationHandler.END

    return ConversationHandler.END


async def value_entered(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle new value input for field edit.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: Next conversation state (SELECT_ACTION or stay in ENTER_VALUE)
    """
    user_input = update.message.text.strip()
    field = context.user_data.get(KEY_EDIT_FIELD)

    if not field:
        await update.message.reply_text("❌ Ошибка: поле не выбрано")
        return ConversationHandler.END

    try:
        # Validate and convert value
        if field == "amount":
            # Validate amount (always use positive value)
            validated_amount = validate_amount(user_input)
            new_value = str(abs(validated_amount))

        elif field == "date":
            new_value = validate_date(user_input).isoformat()
        elif field == "description":
            if user_input == "-":
                new_value = None
            else:
                new_value = validate_description(user_input)
        else:
            await update.message.reply_text("❌ Неизвестное поле")
            return ConversationHandler.END

        # Update transaction via API
        fact_id = context.user_data.get(KEY_FACT_ID)

        if not fact_id:
            await update.message.reply_text("❌ Ошибка: ID транзакции не найден")
            return ConversationHandler.END

        loading_msg = await update.message.reply_text("⏳ Обновление транзакции...")

        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        # Prepare update data
        update_data = {field: new_value} if new_value is not None else {field: None}

        # Update fact
        updated_fact = await api_client.update_fact(token, fact_id, **update_data)

        # Fetch updated article (in case it changed)
        article_id = updated_fact.get("article_id")
        article = await api_client.get_article(token, article_id)

        # Update context
        context.user_data[KEY_FACT_DATA] = updated_fact
        context.user_data[KEY_ARTICLE_DATA] = article

        # Delete loading message
        await loading_msg.delete()

        # Show success message
        success_msg = await update.message.reply_text(
            f"✅ {get_field_name(field)} обновлено!\n\n"
            f"Продолжайте редактирование или нажмите \"Готово\"",
            parse_mode="Markdown",
        )

        # Wait a moment then show action selection again
        import asyncio

        await asyncio.sleep(1)
        await success_msg.delete()

        # Create a pseudo-query object to reuse show_action_selection
        # We'll send a new message instead of editing
        new_msg = await update.message.reply_text("⏳ Обновление...")

        # Store message to edit it
        context.user_data["last_message"] = new_msg

        await show_action_selection_for_message(new_msg, context, updated_fact, article)

        return SELECT_ACTION

    except ValidationError as e:
        # Validation failed
        await update.message.reply_text(
            f"{e.message}\n\n" f"Попробуйте еще раз или отправьте /cancel"
        )
        return ENTER_VALUE

    except Exception as e:
        logger.error(f"Error updating fact: {e}", exc_info=True)
        await update.message.reply_text(
            "❌ Произошла ошибка при обновлении транзакции.\n\n"
            "Попробуйте позже или отправьте /cancel"
        )
        return ENTER_VALUE


async def show_action_selection_for_message(
    message, context: ContextTypes.DEFAULT_TYPE, fact: Dict, article: Dict
):
    """
    Show action selection menu for a regular message (not callback query).

    Args:
        message: Message object
        context: Bot context
        fact: Fact data
        article: Article data
    """
    fact_date = fact.get("fact_date", "")
    amount = Decimal(str(fact.get("amount", "0")))
    description = fact.get("description", "")
    article_name = article.get("name", "???")
    article_type = article.get("type", "unknown")
    record_type = fact.get("record_type", "fact")

    # Format date
    try:
        date_obj = date.fromisoformat(fact_date)
        formatted_date = format_date(date_obj)
    except (ValueError, TypeError):
        formatted_date = fact_date

    # Type display
    type_emoji = "💵" if article_type == "income" else "💸"
    type_text = "Доход" if article_type == "income" else "Расход"

    # Record type display
    record_type_text = "План" if record_type == "plan" else "Факт"

    description_display = description if description else "_не указано_"

    text = f"""✏️ *Редактирование транзакции*

Текущие данные:

{type_emoji} *{type_text}* ({record_type_text})
Категория: {article_name}
Сумма: {format_amount(abs(amount))} ₽
Дата: {formatted_date}
Описание: {description_display}

Выберите действие:"""

    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "💰 Изменить сумму", callback_data="edit_field:amount"
                )
            ],
            [
                InlineKeyboardButton(
                    "📅 Изменить дату", callback_data="edit_field:date"
                )
            ],
            [
                InlineKeyboardButton(
                    "📝 Изменить описание", callback_data="edit_field:description"
                )
            ],
            [
                InlineKeyboardButton(
                    "🗑 Удалить транзакцию", callback_data="edit_action:delete"
                )
            ],
            [InlineKeyboardButton("✅ Готово", callback_data="edit_action:done")],
            [InlineKeyboardButton("❌ Отмена", callback_data="edit_action:cancel")],
        ]
    )

    await message.edit_text(text, reply_markup=keyboard, parse_mode="Markdown")


def get_field_name(field: str) -> str:
    """Get Russian field name."""
    field_names = {
        "amount": "Сумма",
        "date": "Дата",
        "description": "Описание",
    }
    return field_names.get(field, field)


async def cancel_edit(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle /cancel in edit conversation.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        int: ConversationHandler.END
    """
    await update.message.reply_text("❌ Редактирование отменено")
    return ConversationHandler.END


# Build ConversationHandler
edit_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("edit", edit_handler)],
    states={
        SELECTING_FACT: [
            CallbackQueryHandler(fact_selected, pattern="^edit_select:"),
            CallbackQueryHandler(fact_selected, pattern="^edit_cancel$"),
        ],
        SELECT_ACTION: [
            CallbackQueryHandler(action_selected, pattern="^edit_field:"),
            CallbackQueryHandler(action_selected, pattern="^edit_action:"),
        ],
        ENTER_VALUE: [MessageHandler(filters.TEXT & ~filters.COMMAND, value_entered)],
        CONFIRM_DELETE: [
            CallbackQueryHandler(delete_confirmed, pattern="^delete_confirm:"),
        ],
    },
    fallbacks=[CommandHandler("cancel", cancel_edit)],
    name="edit_conversation",
    persistent=False,
    per_message=True,
)
