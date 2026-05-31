# Bot

Telegram bot built with python-telegram-bot 21.x. Shares DB models with the backend; does not call the REST API internally.

## Architecture

Handler tree in `bot/handlers/`. Each command is a separate module. Bot runs in its own Docker container alongside the backend. Scheduled jobs in `bot/jobs/`.

Entry point: `bot/main.py`. Handlers registered at startup with `Application.add_handler()`.

## Commands

All user-facing bot commands and their handler modules.

| Command | Handler | Purpose |
|---------|---------|---------|
| `/start` | `start.py` | Onboarding, registration link |
| `/today` | `today.py` | Today's facts summary |
| `/list` | `list.py` | Recent transactions |
| `/add_plan` | `add_plan.py` | Add recurring plan |
| `/edit` | `edit.py` | Edit last transaction |
| `/delete` | `delete.py` | Delete transaction |
| `/summary` | `summary.py` | Spending summary |
| `/search` | `search.py` | Search transactions |
| `/export` | `export.py` | Export to file |
| `/settings` | `settings.py` | User settings |
| `/help` | `help.py` | Help message |

## Scheduled Jobs

`bot/jobs/weekly_report.py` — weekly spending summary sent to each user. Runs via APScheduler cron job configured in `bot/main.py`.

## Telegram Web App

Bot buttons can open the PWA as a Telegram Web App (mini-app). Auth uses [[auth#Webapp Auth]] — `initData` validation instead of OAuth widget.

## Security

Bot only processes messages from users who exist in the DB. Unknown users receive a rejection message. No auto-registration. All DB writes go through the same service layer as the backend — same validation rules apply.
