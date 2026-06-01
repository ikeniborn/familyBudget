# Bot Patterns Reference

## Table of Contents
- [Conversation Handler](#conversation)
- [API Client](#api-client)
- [Authentication / Session](#auth)
- [Scheduled Jobs](#jobs)
- [Notifications](#notifications)
- [Validators](#validators)

---

## Conversation

`ConversationHandler` is the standard pattern for any multi-step input flow.

```python
ConversationHandler(
    entry_points=[CommandHandler("cmd", entry_fn)],
    states={
        STATE_1: [CallbackQueryHandler(fn1)],
        STATE_2: [MessageHandler(filters.TEXT & ~filters.COMMAND, fn2)],
        STATE_3: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, fn3),
            CallbackQueryHandler(fn3_skip, pattern="^skip_.*$"),
        ],
        CONFIRM: [CallbackQueryHandler(confirm_fn, pattern="^confirm_")],
    },
    fallbacks=[CommandHandler("cancel", cancel_fn)],
    per_user=True,
    per_chat=True,
    per_message=False,  # important — avoids duplicate state entries
)
```

**State transitions**: return `STATE_X` constant to move forward, `ConversationHandler.END` to finish.

**Clear state on entry** (prevents stale data from previous runs):
```python
async def entry_fn(update, context):
    context.user_data.pop("my_key", None)
    ...
```

**Edit vs reply**: prefer `query.edit_message_text()` in callback handlers to avoid message accumulation; use `update.message.reply_text()` for new messages from command entry.

---

## API Client

Global singleton lives in `bot/utils/api_client.py`. Get it via the async getter:

```python
from bot.utils.api_client import get_api_client

# inside handler:
api_client = await get_api_client()
```

**Get token in every handler** (guard against None — is_authenticated() doesn't make type narrowing):
```python
token = SessionManager.get_access_token(context)
if token is None:
    await update.message.reply_text("❌ Сессия устарела. Выполните /start заново.")
    return
```

**Standard error handling**:
```python
try:
    result = await api_client.some_method(token, ...)
except Exception as e:
    logger.error(f"some_method failed: {e}", exc_info=True)
    await update.message.reply_text("❌ Ошибка. Попробуйте позже.")
    return ConversationHandler.END
```

**Key methods on `APIClient`**:
| Method | Backend endpoint |
|--------|-----------------|
| `authenticate_telegram_user(data)` | `POST /auth/telegram` |
| `list_facts(token, date_from, date_to, limit)` | `GET /facts` |
| `get_facts_summary(token, date_from, date_to)` | `GET /facts/summary` |
| `create_fact(token, article_id, fact_date, amount, record_type)` | `POST /facts` |
| `update_fact(token, fact_id, **kwargs)` | `PUT /facts/{id}` |
| `delete_fact(token, fact_id)` | `DELETE /facts/{id}` |
| `list_articles(token, limit)` | `GET /articles` |
| `get_financial_centers(token)` | `GET /financial-centers` |
| `get_cost_centers(token)` | `GET /cost-centers` |

**Adding a new API method**: add it to `APIClient` in `utils/api_client.py`:
```python
async def get_something(self, token: str, param: str) -> dict:
    response = await self.client.get(
        "/something",
        params={"param": param},
        headers={"Authorization": f"Bearer {token}"},
    )
    response.raise_for_status()
    return response.json()
```

---

## Auth

### Check authentication at handler start
```python
if not SessionManager.is_authenticated(context):
    await update.message.reply_text("❌ Сначала выполните /start для авторизации.")
    return  # or return ConversationHandler.END
```

### Get token
```python
token = SessionManager.get_access_token(context)
```

### Full session API (`utils/session.py`)
```python
SessionManager.set_session(context, access_token, user_info)  # called in start_handler
SessionManager.is_authenticated(context) -> bool
SessionManager.get_access_token(context) -> str | None
SessionManager.get_user_info(context) -> dict | None
SessionManager.get_user_display_name(context) -> str  # first_name or username
SessionManager.clear_session(context)  # logout
```

### Telegram OAuth flow (in `start_handler`)
```python
from utils.telegram_auth import prepare_telegram_auth_data, is_user_allowed

user = update.effective_user

if not is_user_allowed(user.id):
    await update.message.reply_text("❌ Доступ запрещён.")
    return

auth_data = prepare_telegram_auth_data(user)
response = await api_client.authenticate_telegram_user(auth_data)
SessionManager.set_session(context, response["access_token"], response["user"])
```

### Session storage
Tokens live in `context.user_data` (PTB in-memory dict, per user). They are **ephemeral** — lost on bot restart. Scheduled/background jobs cannot use per-user tokens; use `API_INTERNAL_KEY` instead.

---

## Jobs

APScheduler is configured in `utils/scheduler.py`. Global instance via `get_scheduler()`.

### Adding a new scheduled job

1. Write the job function in `jobs/` (or `utils/`):
```python
# jobs/daily_digest.py
from telegram import Bot

async def send_daily_digest(bot: Bot):
    # Use API_INTERNAL_KEY for backend calls (no per-user token)
    headers = {"X-Api-Key": settings.API_INTERNAL_KEY}
    # get all telegram IDs
    # iterate, send messages
    pass
```

2. Schedule it in `BotApplication.start()` inside `bot.py`:
```python
from apscheduler.triggers.cron import CronTrigger

scheduler = get_scheduler()
scheduler.add_job(
    send_daily_digest,
    trigger=CronTrigger(hour=9, minute=0),  # 09:00 daily
    id="daily_digest",
    kwargs={"bot": self.application.bot},
    replace_existing=True,
)
```

**Important**: jobs run outside user conversation context — never access `context.user_data`. Use `API_INTERNAL_KEY` for privileged backend requests.

---

## Notifications

`NotificationService` in `utils/notification_service.py` sends budget threshold alerts.

```python
from utils.notification_service import get_notification_service

notif = get_notification_service()

# Check if article has exceeded threshold (default 90%)
await notif.check_budget_threshold(
    token=token,
    telegram_id=update.effective_user.id,
    article_id=article_id,
    threshold_percent=90,
)
```

Internally it:
1. Fetches current month plan vs actual for the article
2. If `actual / plan >= threshold_percent / 100` → sends user a message
3. Calls `POST /notifications` to create a record (deduplication via `/notifications/check-duplicate`)

Call this after creating a fact to give the user immediate feedback.

---

## Validators

All validators live in `utils/validators.py`.

```python
from utils.validators import (
    validate_amount,
    validate_date,
    validate_plan_date,
    validate_description,
    format_amount,
    format_date,
    ValidationError,
)
```

### Usage pattern
```python
try:
    amount = validate_amount(update.message.text)
except ValidationError as e:
    await update.message.reply_text(f"❌ {e.message}\nПопробуйте ещё раз:")
    return CURRENT_STATE  # stay in same state
```

### What each validator accepts

| Validator | Accepts | Rejects |
|-----------|---------|---------|
| `validate_amount(s)` | `"100"`, `"1 000"`, `"999999999"` | decimals, negatives, >1B |
| `validate_date(s)` | `"сегодня"`, `"DD.MM.YYYY"`, `"DD.MM"` | future dates, >10y ago |
| `validate_plan_date(s)` | same + future dates up to 5y | >10y ago, >5y future |
| `validate_description(s)` | any string ≤1000 chars | >1000 chars |

### Formatting helpers
```python
format_amount(decimal_value) -> "1 234.56 ₽"
format_date(date_obj)        -> "15.06.2025"
```
