# Bot

Telegram bot built with python-telegram-bot 21.x (async). Runs in its own Docker container and talks to the backend over the REST API via `bot/utils/api_client.py` (`httpx.AsyncClient`, `base_url=settings.BACKEND_API_URL`). Auth uses per-user JWT stored in `context.user_data`.

## Architecture

Handler tree in `bot/handlers/`. Each command is a separate module. Scheduled jobs in `bot/jobs/`, scheduler in `bot/utils/scheduler.py`.

Entry point: `bot/main.py` → builds `BotApplication` (`bot/bot.py`). Handlers registered in `BotApplication.register_handlers()` with `Application.add_handler()`. All backend calls go through the global `api_client` — never `httpx` directly in handlers.

## Commands

All user-facing bot commands and their handler modules.

| Command | Handler | Purpose |
|---------|---------|---------|
| `/start` | `start.py` | Onboarding, registration link |
| `/today` | `today.py` | Today's facts summary (report) |
| `/balance` | `balance.py` | Current month income/expense/balance (report) |
| `/summary` | `summary.py` | Plan vs Fact by article, period picker (report) |
| `/list` | `list.py` | Paginated transactions list (report) |
| `/search` | `search.py` | Search transactions (report) |
| `/export` | `export.py` | Export transactions to CSV (report) |
| `/addplan` | `add_plan.py` | Add budget plan (5-state ConversationHandler) |
| `/edit` | `edit.py` | Edit transaction |
| `/delete` | `delete.py` | Delete transaction |
| `/settings` | `settings.py` | User settings |
| `/help` | `help.py` | Help message |

## Reporting

Six on-demand report commands (`/today`, `/balance`, `/summary`, `/list`, `/export`, `/search`) plus push reports. Full catalog with output examples and known issues: [BOT_REPORTS.md](../docs/BOT_REPORTS.md).

Data model: every report joins **facts** (`amount`, `fact_date`, `record_type` = `plan`|`fact`) with **articles** (`name`, `type` = `income`|`expense`). Typical pipeline: `api_client.list_facts()` → `list_articles()` → build `id→article` map → group → format Markdown.

- `/summary` & weekly report split facts by `record_type` (plan vs fact); status icons mark over/under budget per article.
- `/today`, `/balance` use server aggregate `get_facts_summary`.
- `/search`, `/export`, `/summary` fetch `list_facts(limit=10000)` and process client-side (no server search/aggregation by article).

## Scheduled Jobs & Push Reports

APScheduler (`AsyncIOScheduler`) wrapped by `BotScheduler` (`bot/utils/scheduler.py`), started in `BotApplication.start()`.

- **Weekly report** (`bot/jobs/weekly_report.py`) — plan-vs-fact + top-3 expenses, cron Sun 20:00. **NOT IMPLEMENTED**: `send_weekly_reports()` early-returns. Scheduled jobs have no `context.user_data` (no per-user JWT); needs persistent token storage or service-account auth (`API_INTERNAL_KEY`). Formatting code (`generate_weekly_report`) is written but unreachable.
- **Budget threshold alerts** (`bot/utils/notification_service.py`) — `NotificationService` compares plan vs fact per article for the current month; pushes an alert at ≥90% (⚠️) / ≥100% (🚨). De-duped per (article, period, threshold) via `check_duplicate_notification` (fail-open on error). Sent only to the data owner's `telegram_id`, not broadcast.

## Telegram Web App

Bot buttons can open the PWA as a Telegram Web App (mini-app). Auth uses [[auth#Webapp Auth]] — `initData` validation instead of OAuth widget.

## Security

Bot only processes messages from users who exist in the DB. Unknown users receive a rejection message. No auto-registration. All DB writes go through the same service layer as the backend — same validation rules apply.
