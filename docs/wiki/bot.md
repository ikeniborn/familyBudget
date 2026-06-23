# Telegram Bot

The Telegram bot is the conversational front end of Family Budget, built on `python-telegram-bot` 21.10. It authenticates users via Telegram OAuth, runs slash commands for transactions and reports, opens Telegram Web Apps, and calls the backend REST API. It is a stateless client: all data lives behind the API. See `[[architecture]]` for how the bot fits the wider system.

## Entry Point & Polling

`bot/main.py` is the entry point (`python -m bot.main`). `run()` calls `asyncio.run(main())`, which validates settings, builds the app via `get_bot_app()`, registers SIGTERM/SIGINT handlers, starts the bot, then waits on an `asyncio.Event`.

`bot/bot.py` defines `BotApplication`, a wrapper around `telegram.ext.Application`. `build_application()` configures the token and optional proxy (`TELEGRAM_PROXY_URL`; `tg://` MTProxy is rejected), registers the error handler, and wires all command handlers. `start()` then `initialize()`s the app, sets the Web App menu button, starts the APScheduler scheduler, and initializes the notification service.

By default the bot runs **long polling** (`start_polling`) with `POLL_INTERVAL`, `POLL_TIMEOUT`, and `drop_pending_updates=True`. If `USE_WEBHOOK=true`, `start_webhook` listens on `WEBHOOK_PORT` with the URL path set to the bot token. `stop()` shuts the scheduler and updater down gracefully.

## Command Handlers

Handlers live in `bot/handlers/` and are registered in `BotApplication.register_handlers()`. Simple commands use `CommandHandler`; multi-step flows use `ConversationHandler`. The error handler logs only sanitized identifiers (update_id, chat_id, user_id) to avoid leaking PII.

Plain command handlers:
- `/start` — `start.py`: Telegram OAuth login (see `[[auth]]`), stores the session, shows the Web App button.
- `/help` — `help.py`: lists commands; output differs for authenticated vs. unauthenticated users.
- `/today` — `today.py`: today's income/expense summary plus the day's facts.
- `/balance` — `balance.py`: current-month total income, expense, and balance.
- `/export` — `export.py`: exports all facts to a UTF-8-BOM CSV document.
- `/medicines`, `/taken` — `medicine.py` (see [[bot#Medicine Commands]]).

`ConversationHandler` flows (each with a `/cancel` fallback):
- `/addplan` — `add_plan.py`: 5-state flow (select article → amount → date → description → confirm) creating a `record_type="plan"` record.
- `/summary` — `summary.py`: pick a period, show aggregated stats.
- `/settings` — `settings.py`: language, currency, date format, notifications toggle, budget threshold (%).
- `/list` — `list.py`: paginated list of recent facts (`list:` callbacks).
- `/delete` — `delete.py`: pick a fact, confirm, delete.
- `/search` — `search.py`: find facts by text.
- `/edit` — `edit.py`: pick a fact and edit fields or delete it.

Inline callbacks are routed by `pattern`: `menu:` (legacy, deprecated), `med:` (medicine), and per-conversation prefixes (`summary_`, `setting:`/`set:`/`settings:`, `list:`, `delete:`, `edit_*`, `confirm_`, `skip_description`).

## Authentication & Sessions

`/start` authenticates the user. `bot/utils/telegram_auth.py` builds the OAuth payload from `update.effective_user` and signs it with HMAC-SHA256 over `SHA256(bot_token)` — the official Telegram Login Widget algorithm. `is_user_allowed()` enforces the optional `ALLOWED_TELEGRAM_IDS` allowlist before any backend call.

The signed payload is POSTed to `/auth/telegram`; the backend returns a JWT `access_token` and user info (full flow in `[[auth]]`). `bot/utils/session.py` `SessionManager` stores the token, user info, and an `authenticated` flag in `context.user_data` — per-user, in-memory, lost on restart. Every authenticated command checks `SessionManager.is_authenticated(context)` and passes `get_access_token(context)` to the API client as a `Bearer` token.

## Web App Integration

The bot surfaces the PWA as a Telegram Web App rather than rebuilding the UI inline. `BotApplication.setup_menu_button()` sets a persistent `MenuButtonWebApp` ("Start") pointing at `{protocol}://{DOMAIN}/webapp/index.html`. The URL is derived from `DOMAIN` (the public host), never `BACKEND_API_URL` (an internal Docker name).

`start.py` `get_webapp_url()` produces the same URL for inline `WebAppInfo` buttons (e.g. the "Открыть приложение" button after login). The medicines handler reuses it, appending the SPA hash route `#/medicines`. The Web App front end is documented in `[[frontend]]`.

## Backend API Client

`bot/utils/api_client.py` `APIClient` wraps an `httpx.AsyncClient` for all backend calls. A single global instance is created at import; `get_api_client()` returns it and `close()` is called on shutdown. See `[[api]]` for the endpoints themselves.

The client's `base_url` is `settings.BACKEND_API_URL`, which **already includes the `/api/v1` prefix** (default `http://localhost:8000/api/v1`). Endpoint paths passed to the client are therefore base-relative — e.g. `/facts`, `/articles`, `/facts/summary`, `/medicine-intakes` — and must NOT repeat `/api/v1`. A regression where medicine callbacks double-prefixed the path to `/api/v1/api/v1/...` produced 404s and was fixed by keeping handler paths base-relative.

Auth is sent via the `Authorization: Bearer <token>` header (deliberately not cookies, to keep tokens out of access logs). Internal endpoints (`/notifications`, `/notifications/check-duplicate`, `/users/telegram-ids`) use the `X-Api-Key: API_INTERNAL_KEY` header instead of a user JWT. Typed helpers include `authenticate_telegram_user`, `list_facts`, `get_facts_summary`, `create_fact`, `get_articles`, `update_fact`, `delete_fact`, `get_financial_centers`, `get_cost_centers`, plus generic `get`/`post`.

## Scheduled Jobs

`bot/utils/scheduler.py` `BotScheduler` wraps an APScheduler `AsyncIOScheduler`, started during `BotApplication.start()`. `init_scheduler(bot)` registers the default jobs and the scheduler is shut down (waiting for jobs) when the bot stops.

The only registered job is the **weekly report** (`bot/jobs/weekly_report.py`), scheduled via a `CronTrigger` for Sunday 20:00. `send_weekly_reports()` is currently a **no-op** that logs a debug message and returns early — full weekly reports need persistent token storage / a service account, which does not yet exist. The report-building helpers (`generate_weekly_report`, `calculate_summary`, `format_weekly_report` — plan vs. fact, top-3 expenses) are implemented but unreachable behind the early return.

`bot/utils/notification_service.py` `NotificationService` is separate from the scheduler: `check_budget_threshold()` compares current-month plan vs. actual for an article and, when actual ≥ threshold (default 90%), sends a Markdown alert to the owning user and records it via the internal notifications API, de-duplicating per period with `check_duplicate_notification`.

## Medicine Commands

`bot/handlers/medicine.py` adds the medicine-reminder surface; full domain rules are in `[[medicine]]`. All three handlers require an authenticated session and call the `/medicine-intakes` API.

- `/medicines` (`medicine_handler`) — opens the medicines Web App via a `WebAppInfo` button at `…/webapp/index.html#/medicines`.
- `/taken` (`taken_handler`) — GETs `/medicine-intakes?date=today`, finds the nearest `scheduled`/`late` intake, and POSTs `/medicine-intakes/{id}/take` with the intake's optimistic-locking `version`.
- Inline `med:` callbacks (`medicine_callback`) — handle `take` / `skip` / `snooze` for a given intake id. `snooze` POSTs `/snooze`; `take`/`skip` re-fetch the intake to read its current `version` before POSTing the action, satisfying optimistic concurrency.

## Configuration

`bot/config/settings.py` `Settings` loads everything from environment variables (via `python-dotenv`); `get_settings()` returns the global instance and `validate()` enforces required values.

- `TELEGRAM_BOT_TOKEN` — required; `validate()` raises if missing.
- `BACKEND_API_URL` — backend base incl. `/api/v1` (default `http://localhost:8000/api/v1`); `BACKEND_TIMEOUT` (30s); `API_INTERNAL_KEY` for internal endpoints.
- `DOMAIN` — public host for Web App URLs (default `localhost`).
- `USE_WEBHOOK` / `WEBHOOK_URL` / `WEBHOOK_PORT` / `WEBHOOK_LISTEN` — webhook mode (`WEBHOOK_URL` required when enabled); `POLL_INTERVAL` / `POLL_TIMEOUT` for polling.
- `TELEGRAM_PROXY_URL` — optional `http(s)://` or `socks5://` proxy (no `tg://`).
- `ALLOWED_TELEGRAM_IDS` — comma-separated allowlist; empty means everyone is allowed.
- `LOG_LEVEL` / `LOG_FORMAT` — logging.

## Health Check

`bot/healthcheck.py` is a stdlib-only liveness probe for the distroless container. `check_health()` simply attempts `import bot.main`; success means Python runs, the bot code is valid, and dependencies are installed. It exits `0` (healthy) or `1` (unhealthy).

The distroless image has no shell or shebang support, so the Dockerfile invokes it explicitly: `HEALTHCHECK … CMD ["python3", "/app/healthcheck.py"]`, while the container's run command is `CMD ["-m", "bot.main"]` against the inherited `python3.11` entrypoint.
