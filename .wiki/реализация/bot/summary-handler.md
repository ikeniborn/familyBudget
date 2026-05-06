---
wiki_sources:
  - "bot/handlers/summary.py"
  - "bot/utils/api_client.py"
  - "bot/utils/session.py"
wiki_updated: 2026-05-06
wiki_status: developing
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "Bot Summary"
  - "/summary команда"
---

# Bot /summary — план vs факт в Telegram

Telegram handler для команды `/summary` — показывает сравнение план/факт за выбранный период через inline keyboard. ConversationHandler с состоянием `SELECTING_PERIOD`.

## Основные характеристики

**Handler:** `ConversationHandler` с `CommandHandler("/summary")` + `CallbackQueryHandler`
**Состояния:** `SELECTING_PERIOD = 1`

**Периоды** (`get_period_dates(period_key)`):
- `today` — текущий день
- `week` — текущая неделя (Пн–Вс)
- `month` — текущий месяц (1-й день — последний)
- `year` — текущий год

**APIClient** (`bot/utils/api_client.py`):
- `httpx.AsyncClient` с `base_url`, `timeout`, `follow_redirects=True`
- `get(endpoint, token, params)` — Universal GET
- `get_api_client()` — фабрика; использует `settings.BACKEND_API_URL` и `settings.BACKEND_TIMEOUT`
- JWT-токен передаётся в заголовке `Authorization: Bearer {token}`

**SessionManager** (`bot/utils/session.py`):
- Управление JWT токенами для бота между командами
- Хранит `access_token` между конверзациями

## Зависимости

- `format_amount()`, `format_date()` — из `bot/utils/validators.py`
- `defaultdict`, `Decimal` для агрегации результатов

## Связанные концепции

- [[реализация/bot/start-handler.md]]
- [[реализация/api/facts-endpoint.md]]
