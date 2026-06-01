---
name: fb-bot
description: >
  Use when writing, editing, or debugging Telegram bot code in the Family Budget project —
  adding new commands, conversation handlers, scheduled jobs, API client calls, authentication,
  notification service, or bot tests. Trigger on: "add command", "new handler", "telegram bot",
  "bot command", "conversation flow", "ConversationHandler", "add job", "scheduled task",
  "bot notification", "bot auth", "api_client", "session manager", "bot test", "PTB",
  "python-telegram-bot", "webhook", "polling", "bot menu", "WebApp button".
version: 1.0.0
author: Family Budget Team
tags:
  - bot
  - telegram
  - python-telegram-bot
user-invocable: true
---

# Family Budget — Telegram Bot Development

## Stack

| Layer | Technology |
|-------|-----------|
| Bot Framework | python-telegram-bot 21.10 (async) |
| HTTP Client | httpx.AsyncClient |
| Scheduler | APScheduler 3.x (AsyncIOScheduler) |
| Config | python-dotenv + `config/settings.py` |
| Image | Distroless Python 3.11 (multi-stage) |

## Project Structure

```
bot/
├── main.py                      ← entry point: asyncio.run(main())
├── bot.py                       ← BotApplication — builds app, registers handlers
├── healthcheck.py               ← Docker HEALTHCHECK target
├── config/
│   └── settings.py              ← Settings class + get_settings()
├── handlers/                    ← one module per command
│   ├── start.py                 ← /start — auth entry point
│   ├── add_plan.py              ← /addplan — 5-state ConversationHandler
│   ├── summary.py               ← /summary — plan vs fact
│   ├── today.py                 ← /today — daily stats
│   ├── help.py                  ← /help — command reference
│   ├── export.py                ← /export — CSV download
│   ├── delete.py                ← /delete — remove transaction
│   ├── edit.py                  ← /edit — edit transaction
│   ├── list.py                  ← /list — paginated list
│   ├── search.py                ← /search — search by text
│   └── settings.py              ← /settings — user prefs
├── utils/
│   ├── api_client.py            ← APIClient (httpx) — all backend calls
│   ├── session.py               ← SessionManager — JWT in context.user_data
│   ├── telegram_auth.py         ← HMAC-SHA256 OAuth hash computation
│   ├── validators.py            ← ValidationError + validate_*()
│   ├── notification_service.py  ← budget threshold alerts
│   ├── scheduler.py             ← BotScheduler wrapping APScheduler
│   └── logger.py                ← get_logger(name)
└── jobs/
    └── weekly_report.py         ← weekly report (NOT YET IMPLEMENTED)
```

## Key Rules (read first)

1. **Always check auth** — call `SessionManager.is_authenticated(context)` at the start of every handler; redirect to /start if False.
2. **Get token via SessionManager** — `token = SessionManager.get_access_token(context)`; never access `context.user_data` directly for auth keys.
3. **All backend calls go through `api_client`** — import global instance: `from utils.api_client import api_client`. Never use httpx directly in handlers.
4. **Context.user_data for conversation state** — store intermediate data with string constants (e.g. `KEY_AMOUNT = "plan_amount"`). Clear them at start of new conversation.
5. **ConversationHandler per command** — multi-step flows use `ConversationHandler` with `per_user=True, per_chat=True, per_message=False`; always include `fallbacks=[CommandHandler("cancel", cancel_command)]`.
6. **User-facing strings in Russian** — all messages sent to users must be in Russian with emoji.
7. **Validators for user input** — use `validate_amount()`, `validate_date()`, `validate_description()` from `utils/validators.py`; raise `ValidationError`, catch in handler, send friendly message.
8. **Register handler in bot.py** — add every new `CommandHandler` or `ConversationHandler` inside `BotApplication.register_handlers()`.
9. **Never store tokens in logs** — use sanitized logging (IDs only); `logger.error("...", exc_info=True)` for stack traces.
10. **Jobs need service-account auth** — `context.user_data` is ephemeral; scheduled jobs cannot use per-user JWT. Use `API_INTERNAL_KEY` header for internal calls instead.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `per_message=True` (default) | Set `per_message=False` — иначе дублирование состояний при inline-кнопках |
| `context.user_data["access_token"]` напрямую | Всегда через `SessionManager.get_access_token(context)` |
| JWT в scheduled jobs | Jobs не имеют `context.user_data`; использовать `API_INTERNAL_KEY` header |
| Забыть `return ConversationHandler.END` | Conversation зависнет; всегда явно завершать |
| Не чистить state при входе | Данные от предыдущего запуска pollute новый; `context.user_data.pop("key", None)` |
| `httpx` напрямую в handler | Всегда через `api_client`; прямые вызовы обходят единый error handling |

## Reference Files

Load only what you need:

| Task | Read |
|------|------|
| Adding a new command/handler | `references/new-handler.md` |
| ConversationHandler multi-step flow | `references/patterns.md#conversation` |
| API client — calling backend | `references/patterns.md#api-client` |
| Authentication / session | `references/patterns.md#auth` |
| Scheduled jobs | `references/patterns.md#jobs` |
| Notifications | `references/patterns.md#notifications` |
| Input validation | `references/patterns.md#validators` |
| Bot tests | `references/testing.md` |
