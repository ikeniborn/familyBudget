---
wiki_sources:
  - "backend/app/api/v1/endpoints/transfers.py"
wiki_updated: 2026-05-06
wiki_status: developing
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "Transfers API"
  - "Переводы API"
---

# Transfers API — переводы между финансовыми центрами

FastAPI роутер для создания и удаления внутренних переводов между FinancialCenter. Перевод атомарно создаёт две BudgetFact-записи (debit + credit) с одним `transfer_id`. Поддерживает дедупликацию offline-sync через `sync_hash`.

## Основные характеристики

**Роутер:** `APIRouter(prefix="/transfers", tags=["Transfers"])`

**Эндпоинты:**
- `POST /transfers` — создание перевода (201); поддерживает `sync_hash` дедупликацию
- `DELETE /transfers/{transfer_id}` — удаление (204); создаёт DELETE-записи в BudgetFactHistory

**Логика создания (POST /transfers):**
1. Дедупликация: если `sync_hash` задан — проверяет наличие записи с тем же хешем за последние 24 часа; если найдена → idempotent ответ (возвращает существующий transfer_id, без INSERT)
2. Валидация articles: `from_article_id` должен иметь тип `debit`, `to_article_id` — тип `credit`
3. Валидация FinancialCenter — оба CFO должны существовать
4. `generate_transfer_id()` — `MAX(transfer_id) + 1` (не последовательность)
5. Атомарный INSERT двух BudgetFact (expense + income) в одной транзакции
6. WebSocket broadcast: `broadcast_transfer_created()` / `broadcast_transfer_deleted()` — lazy import через `_get_budget_ws_broadcast()` для избежания circular imports

**Удаление (DELETE /transfers/{transfer_id}):**
- Загружает все факты с данным `transfer_id`
- Для каждого факта создаёт BudgetFactHistory с `change_type="DELETE"` (SCD Type 2 audit trail)
- Атомарный DELETE
- SSE broadcast

## Особенности

- Broadcast не блокирует запрос — `except Exception: logger.warning` без reraise
- `sync_hash` и `content_hash` копируются в историю при удалении
- `record_type` прокидывается из запроса в обе facts-записи
- `is_offline_sync` флаг сохраняется в BudgetFact

## Связанные концепции

- [[реализация/models/budget-fact.md]]
- [[реализация/api/budget-websocket.md]]
- [[реализация/api/facts-endpoint.md]]
