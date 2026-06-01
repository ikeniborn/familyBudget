# Adding a New Command Handler

## Checklist

1. Create `bot/handlers/<command>.py`
2. Write handler function(s)
3. Register in `bot/bot.py` → `BotApplication.register_handlers()`
4. (Optional) Add command to bot menu via BotFather

---

## Simple Command (no conversation)

```python
# bot/handlers/stats.py
from telegram import Update
from telegram.ext import ContextTypes
from bot.utils.api_client import get_api_client
from bot.utils.session import SessionManager
from bot.utils.logger import get_logger

logger = get_logger(__name__)

async def stats_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text("❌ Сначала выполните /start для авторизации.")
        return

    token = SessionManager.get_access_token(context)
    if token is None:
        await update.message.reply_text("❌ Сессия устарела. Выполните /start заново.")
        return
    try:
        api_client = await get_api_client()
        data = await api_client.get_facts_summary(token)
        text = (
            f"📊 *Итоги*\n"
            f"💵 Доходы: {data['total_income']} ₽\n"
            f"💸 Расходы: {data['total_expense']} ₽\n"
            f"📈 Баланс: {data['balance']} ₽"
        )
        await update.message.reply_text(text, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"stats_handler error: {e}", exc_info=True)
        await update.message.reply_text("❌ Ошибка получения данных. Попробуйте позже.")
```

### Register in bot.py

```python
from handlers.stats import stats_handler
# inside register_handlers():
self.application.add_handler(CommandHandler("stats", stats_handler))
```

---

## ConversationHandler (multi-step)

```python
# bot/handlers/add_something.py
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ContextTypes, ConversationHandler,
    CommandHandler, MessageHandler, CallbackQueryHandler, filters
)
from bot.utils.api_client import get_api_client
from bot.utils.session import SessionManager
from bot.utils.validators import validate_amount, ValidationError
from bot.utils.logger import get_logger

logger = get_logger(__name__)

# State constants (integers)
SELECT_TYPE, ENTER_AMOUNT, CONFIRM = range(3)

# Context key constants
KEY_TYPE = "thing_type"
KEY_AMOUNT = "thing_amount"


async def add_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry point."""
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text("❌ Сначала выполните /start.")
        return ConversationHandler.END

    # Clear previous state
    context.user_data.pop(KEY_TYPE, None)
    context.user_data.pop(KEY_AMOUNT, None)

    keyboard = [
        [InlineKeyboardButton("Тип А", callback_data="type_a")],
        [InlineKeyboardButton("Тип Б", callback_data="type_b")],
    ]
    await update.message.reply_text(
        "Выберите тип:", reply_markup=InlineKeyboardMarkup(keyboard)
    )
    return SELECT_TYPE


async def type_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    context.user_data[KEY_TYPE] = query.data
    await query.edit_message_text("Введите сумму (целое число, рублей):")
    return ENTER_AMOUNT


async def amount_entered(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        amount = validate_amount(update.message.text)
    except ValidationError as e:
        await update.message.reply_text(f"❌ {e.message}\nПопробуйте ещё раз:")
        return ENTER_AMOUNT

    context.user_data[KEY_AMOUNT] = amount
    keyboard = [
        [
            InlineKeyboardButton("✅ Сохранить", callback_data="confirm_yes"),
            InlineKeyboardButton("❌ Отмена", callback_data="confirm_no"),
        ]
    ]
    await update.message.reply_text(
        f"Тип: {context.user_data[KEY_TYPE]}\nСумма: {amount} ₽\n\nСохранить?",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )
    return CONFIRM


async def confirm_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    if query.data == "confirm_no":
        await query.edit_message_text("❌ Операция отменена.")
        return ConversationHandler.END

    token = SessionManager.get_access_token(context)
    if token is None:
        await query.edit_message_text("❌ Сессия устарела. Выполните /start заново.")
        return ConversationHandler.END
    try:
        api_client = await get_api_client()
        result = await api_client.create_fact(
            token=token,
            article_id=1,  # replace with real value
            fact_date=...,
            amount=context.user_data[KEY_AMOUNT],
        )
        await query.edit_message_text(f"✅ Сохранено! ID: {result['id']}")
    except Exception as e:
        logger.error(f"confirm_handler error: {e}", exc_info=True)
        await query.edit_message_text("❌ Ошибка сохранения. Попробуйте позже.")

    return ConversationHandler.END


async def cancel_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("❌ Операция отменена.")
    return ConversationHandler.END


def get_add_something_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CommandHandler("addsomething", add_command)],
        states={
            SELECT_TYPE: [CallbackQueryHandler(type_selected)],
            ENTER_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, amount_entered)],
            CONFIRM: [CallbackQueryHandler(confirm_handler, pattern="^confirm_")],
        },
        fallbacks=[CommandHandler("cancel", cancel_command)],
        per_user=True,
        per_chat=True,
        per_message=False,
    )
```

### Register in bot.py

```python
from handlers.add_something import get_add_something_handler
# inside register_handlers():
self.application.add_handler(get_add_something_handler())
```
