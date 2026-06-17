# Telegram Bot

The `python-telegram-bot` (v21) service that gives users a command-driven and Web App interface to the Family Budget system. It owns no database: every read/write goes through the backend REST API over HTTP using a per-user JWT.

## Bootstrap & Lifecycle

The bot is an async process started by `bot/main.py`, which validates config, builds the `Application`, registers signal handlers (SIGTERM/SIGINT), starts the app, then blocks on an `asyncio.Event`. Shutdown stops the app and closes the API client.

- Entry point: `bot/main.py:44` (`main()`), sync wrapper `run()` at `bot/main.py:94`.
- `BotApplication.start()` (`bot/bot.py:207`) initializes the app, sets the Menu Button, starts the scheduler, inits the notification service, then begins polling or webhook.
- Graceful shutdown: `bot/main.py:25` (`shutdown`) and `BotApplication.stop()` (`bot/bot.py:274`).
- Global singleton via `get_bot_app()` (`bot/bot.py:322`).

## Handler Registration

`BotApplication.build_application()` (`bot/bot.py:39`) builds the PTB `Application` from the token (with optional proxy), attaches an error handler, then calls `register_handlers()`. Handlers are imported lazily inside that method and added to the application.

- Registration: `register_handlers()` at `bot/bot.py:86`.
- Simple `CommandHandler`s: `/start`, `/help`, `/today`, `/export`, `/balance`.
- A `CallbackQueryHandler` with `pattern="^menu:"` for the legacy main-menu (`menu_callback_handler`).
- `ConversationHandler`s: `/addplan`, `/summary`, `/settings`, `/list`, `/delete`, `/search`, `/edit`.
- Error handler `error_handler` (`bot/bot.py:149`) logs sanitized update metadata only (no message content/PII).
- See [[architecture#Docker Topology]] for how the bot fits the wider system.

## Polling vs Webhook

Run mode is chosen by `USE_WEBHOOK`. Polling (default) uses `updater.start_polling(drop_pending_updates=True)`; webhook mode listens on `WEBHOOK_PORT` with the bot token as the URL path. Both run after `start()` finishes setup.

- `start_polling()`: `bot/bot.py:242` — uses `POLL_INTERVAL`, `POLL_TIMEOUT`.
- `start_webhook()`: `bot/bot.py:256` — requires `WEBHOOK_URL`, path is `/{TELEGRAM_BOT_TOKEN}`.

## Backend Communication (APIClient)

The bot is a thin HTTP client over the backend API — it does NOT touch the database directly. `APIClient` wraps an `httpx.AsyncClient` against `BACKEND_API_URL` and sends the user's JWT as a `Bearer` header on each call. A global singleton is shared process-wide.

- Defined in `bot/utils/api_client.py:19`; singleton `get_api_client()` at `:780`.
- User-scoped methods (JWT required): `authenticate_telegram_user`, `list_facts`, `get_facts_summary`, `create_fact`, `get_article(s)`, `get_fact`, `update_fact`, `delete_fact`, `get_financial_centers`, `get_cost_centers`.
- Internal methods (use `X-Api-Key: API_INTERNAL_KEY`, not a user JWT): `check_duplicate_notification`, `create_notification`, `get_all_telegram_ids`.
- Maps to backend endpoints under `/facts`, `/articles`, `/financial-centers`, `/cost-centers`, `/notifications` — see [[api#Domain Endpoints]] and [[api#Domain Endpoints]]. Underlying entities described in [[domain#Budget Facts (Transactions)]].

## Authentication & Sessions

`/start` authenticates the Telegram user against the backend and caches the resulting JWT in PTB's in-memory `context.user_data`. Auth data is signed with the official Telegram Login Widget HMAC-SHA256 algorithm before being POSTed to `/auth/telegram`.

- Hash + payload prep: `bot/utils/telegram_auth.py` (`compute_telegram_hash` `:22`, `prepare_telegram_auth_data` `:69`).
- Optional allowlist gate `is_user_allowed` (`:122`) reads `ALLOWED_TELEGRAM_IDS`.
- Session store: `SessionManager` in `bot/utils/session.py:16` — keys `access_token`, `user_info`, `authenticated`; `is_authenticated()` guards every command.
- Sessions are NOT persisted: a process restart logs everyone out (token lives only in `user_data`). Backend side of Telegram auth: [[auth#Telegram OAuth Login]].

## /start command

Authenticates the user and shows a WebApp launch button. It blocks disallowed IDs, prepares signed OAuth data, calls `authenticate_telegram_user`, stores the JWT, and edits the "authenticating" message into a welcome. A 403 means the user is not registered by an admin.

- Handler: `bot/handlers/start.py:51` (`start_handler`).
- WebApp inline button: `create_webapp_keyboard()` (`:34`) using `get_webapp_url()`.
- `menu_callback_handler` (`:197`) is a legacy no-op kept for backward compatibility.

## /help command

Lists available commands, branching on auth state. Authenticated users see budget commands; unauthenticated users are prompted to `/start`. Static Markdown text only — no API calls.

- Handler: `bot/handlers/help.py:16`; texts built by `format_authenticated_help` / `format_unauthenticated_help`.
- Note: the help text advertises `/cancel`, `/today`, `/list`, `/search`, `/settings`, `/export` (it does not list `/balance`, `/summary`, `/addplan`, `/edit`, `/delete`).

## /today command

Shows today's income/expense totals and lists each transaction grouped by type. Fetches `GET /facts/summary` and `GET /facts` for the current day plus articles for name lookup, then renders Markdown statistics.

- Handler: `bot/handlers/today.py:22`; formatting in `format_today_statistics` (`:109`).
- Read-only; balance shown with +/- sign and per-type counts.

## /balance command

Reports the current calendar month's total income, expenses, and balance. Computes the month range with `calendar.monthrange`, then calls `get_facts_summary` for that range. Handles an expired session explicitly.

- Handler: `bot/handlers/balance.py:22`; formatting in `format_balance_message` (`:81`).
- Read-only; Russian month names rendered inline.

## /summary command (plan vs fact)

A `ConversationHandler` that compares budget plans against actual spending for a chosen period. The user picks today/week/month/year via inline keyboard; the bot fetches all facts for the range, splits them by `record_type` (plan vs fact), and renders a per-article comparison with percentages.

- File: `bot/handlers/summary.py`; entry `summary_command` (`:94`), callback `period_selected` (`:133`).
- Single state `SELECTING_PERIOD`; aggregation in `calculate_summary_by_article` (`:254`).
- Output via `format_plan_vs_fact_summary` (`:304`); plan records use `record_type == "plan"` — see [[domain#Budget Facts (Transactions)]].

## /addplan command

A 5-state `ConversationHandler` to create a budget plan (a fact with `record_type="plan"`). Steps: select article → enter amount → enter date (future dates allowed) → optional description → confirm → `POST /facts`. Amount is sent as a positive value; sign is derived from article type by the backend.

- File: `bot/handlers/add_plan.py`; entry `addplan_command` (`:165`), handler built at `:702`.
- States `SELECT_ARTICLE, ENTER_AMOUNT, ENTER_DATE, ENTER_DESCRIPTION, CONFIRM`.
- Plan-specific date rules in `validate_plan_date` (`:61`): up to 10 years past, 5 years future.
- KNOWN GAP: imports `build_article_keyboard` from `bot.handlers.add` (`:221`), but `bot/handlers/add.py` does not exist in the repo — `/addplan` raises on the article-keyboard step. There is no registered `/add` command, though many handlers reference one in their hint text.

## /list command

Paginated browse of all the user's facts (10 per page). Fetches a page via `list_facts(limit, offset)` plus articles for names, then renders rows with date, category, amount, description, and fact ID. Inline Prev/Next/Close buttons drive navigation.

- File: `bot/handlers/list.py`; entry `list_handler` (`:34`), page render `display_page` (`:73`), nav `pagination_handler` (`:244`).
- Single state `NAVIGATE`; `PAGE_SIZE = 10`.
- Relies on `list_facts` supporting an `offset` kwarg (passed at `:91`).

## /search command

Asks for a query string, then filters facts client-side (case-insensitive substring match on description and category name). The backend has no search endpoint, so the bot fetches up to 10000 facts and filters locally, showing the first 20 matches.

- File: `bot/handlers/search.py`; entry `search_handler` (`:25`), `query_entered` (`:70`).
- Single state `ENTER_QUERY`; results via `format_search_results` (`:151`).

## /edit command

A 4-state `ConversationHandler` to edit or delete one of the last 10 facts. The user picks a fact from an inline list, chooses a field (amount/date/description) or delete, enters a new value, and the bot calls `PUT /facts/{id}` or `DELETE /facts/{id}`. Editing loops back to the action menu.

- File: `bot/handlers/edit.py`; entry `edit_handler` (`:124`).
- States `SELECTING_FACT, SELECT_ACTION, ENTER_VALUE, CONFIRM_DELETE`.
- Field validation reuses `validate_amount`/`validate_date`/`validate_description`; updates via `update_fact` (`:575`).

## /delete command

A 2-state `ConversationHandler` to delete a fact by ID. The user types the ID, the bot fetches the fact + article to show a confirmation card, and on confirm calls `DELETE /facts/{id}`. Handles 404 (not found) and 403 (no access) distinctly.

- File: `bot/handlers/delete.py`; entry `delete_handler` (`:27`), `id_entered` (`:68`), `confirmation_handler` (`:194`).
- States `ENTER_ID, CONFIRM`. (Note: `/edit` also has its own delete flow.)

## /export command

Generates a CSV of all the user's facts and sends it as a Telegram document. Fetches up to 10000 facts plus articles, writes columns Date/Category/Type/Amount/Description/ID, and encodes UTF-8 with BOM for Excel compatibility.

- Handler: `bot/handlers/export.py:22`; CSV builder `generate_csv` (`:120`).
- Filename `budget_export_<YYYY-MM-DD>.csv`; sent via `reply_document`.

## /settings command

A `ConversationHandler` exposing language, currency, date format, notifications toggle, and budget threshold. Selections are stored only in `context.user_data` (in-memory) — they are NOT persisted to the backend and reset on restart; most are not yet consumed elsewhere.

- File: `bot/handlers/settings.py`; entry `settings_handler` (`:43`).
- Single state `SELECT_SETTING`; defaults in `DEFAULT_SETTINGS` (`:34`), threshold default 90%.

## Input Validation & Formatting

Shared helpers validate and format user input across conversation handlers. Per БАГ-5, amounts are integer rubles only (no decimals); dates accept Russian shortcuts and several `DD.MM[.YYYY]` formats.

- File: `bot/utils/validators.py`. `validate_amount` (`:32`, integer rubles, max 1e9), `validate_date` (`:102`, no future), `validate_description` (`:213`, ≤1000 chars).
- `format_amount` (`:261`) renders integers with space thousands separators; `format_date` (`:284`) → `DD.MM.YYYY`.
- Inline callback parsing: `parse_article_callback` (`:301`).

## Scheduler & Weekly Report

An `AsyncIOScheduler` (APScheduler) is created and started in `BotApplication.start()`. `init_scheduler` registers a single cron job — the weekly report (Sunday 20:00) — but the report itself is a stub that returns immediately.

- Scheduler wrapper: `bot/utils/scheduler.py:18` (`BotScheduler`), init at `:169`, weekly job at `add_weekly_report_job` (`:66`).
- Job target: `send_weekly_reports` in `bot/jobs/weekly_report.py:25` — currently logs a debug message and returns (NOT IMPLEMENTED: needs persistent token storage). The report-building helpers (`generate_weekly_report`, `format_weekly_report`) exist but are unreachable.

## Notification Service

A budget-threshold alert service that compares current-month plan vs actual for an article and DMs the owning user when usage crosses a threshold. It is initialized at startup but not wired to any scheduled trigger in this service, so it is effectively dormant unless invoked externally.

- File: `bot/utils/notification_service.py:22` (`NotificationService`), init `init_notification_service` (`:279`).
- `check_budget_threshold` (`:39`) sends to a single `telegram_id` (not broadcast), de-duplicates via `check_duplicate_notification`, and records via `create_notification` using the internal API key.
- Notification persistence/dedup lives in the backend — see [[api#Notifications & Push Endpoints]].

## Telegram Web App Integration

Beyond commands, the bot's primary UI is a Telegram Mini App. The bot sets a persistent Menu Button (and `/start` inline button) pointing at the public WebApp page; the page authenticates itself directly against the backend using Telegram `initData`.

- Menu Button setup: `setup_menu_button()` (`bot/bot.py:170`) → `https://{DOMAIN}/webapp/index.html`. Note `DOMAIN` is the public host, distinct from the internal `BACKEND_API_URL`.
- WebApp pages live in `frontend/webapp/` (`index.html`, `today.html`, `list.html`, `stats.html`, `summary.html`, `add.html`, `addplan.html`, `edit.html`) — see [[frontend#Telegram Web App Pages]].
- WebApp auth is a separate path from the bot's `/auth/telegram`: the page POSTs `initData` to `POST /api/v1/webapp/validate` (`backend/app/api/v1/webapp/validate.py:94`), which HMAC-verifies the signature (secret `HMAC("WebAppData", BOT_TOKEN)`), checks `auth_date` (<1h), and issues a 7-day JWT. Details in [[auth#Telegram Mini App Auth]].

## Configuration & Healthcheck

Configuration is environment-driven via `Settings` (loaded with `python-dotenv`); `validate()` enforces a bot token and a webhook URL when webhook mode is on. The container healthcheck is a stdlib-only import test suited to a distroless image.

- Settings: `bot/config/settings.py:16`. Key vars: `TELEGRAM_BOT_TOKEN`, `BACKEND_API_URL`, `API_INTERNAL_KEY`, `DOMAIN`, `USE_WEBHOOK`/`WEBHOOK_*`, `POLL_*`, `TELEGRAM_PROXY_URL` (no `tg://` MTProxy), `ALLOWED_TELEGRAM_IDS`.
- Healthcheck: `bot/healthcheck.py` — exits 0 if `import bot.main` succeeds, else 1.
- Logging configured in `bot/utils/logger.py` (`get_logger`).
