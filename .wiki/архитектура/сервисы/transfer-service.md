---
wiki_sources: ["docs/architecture/features/transfers-system.md"]
wiki_updated: 2026-05-05
wiki_status: stub
tags: ["FastAPI"]
aliases: ["Transfer System", "Transfers API", "Double-Entry Bookkeeping"]
---

# Transfer Service

Сервис перевода средств между финансовыми центрами (счетами) с поддержкой принципов double-entry bookkeeping. Создаёт две связанные записи (расход и приход) с одним `transfer_group_id`.

## Основные характеристики

### API Endpoints

| Метод | Путь | Описание |
|-------|------|---------|
| POST | `/api/v1/transfers` | Создать перевод |
| PUT | `/api/v1/transfers/{id}` | Обновить перевод |
| DELETE | `/api/v1/transfers/{id}` | Удалить перевод |

### Типы переводов

- **fact-transfer**: немедленный перевод с конкретной датой
- **plan-transfer**: запланированный перевод с периодом (месяц)

### Дедупликация

Используются `sync_hash` и `content_hash` для предотвращения дублирования при офлайн-синхронизации.

### Data Flow

```
UI Modal (Transfer таб) → Form Validation → Submit Handler
→ POST /api/v1/transfers → Backend Validation
→ DB (t_f_budget_fact × 2) → WebSocket event (transfer_created)
→ UI Update (IncrementalUpdates)
```

## Связанные концепции

- [[modal-система]]
- [[websocket-realtime]]
- [[recurring-plans-service]]
