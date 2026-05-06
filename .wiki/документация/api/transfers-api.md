---
wiki_sources:
  - "docs/architecture/features/transfers-system.md"
  - "docs/prd/07-api-specification.md"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links:
  - "[[budget-fact]]"
  - "[[websocket-клиент]]"
tags:
  - family-budget
  - architecture
  - api
  - transfers
aliases:
  - "transfers endpoint"
  - "/api/v1/transfers"
---

# Transfers API — эндпоинт переводов

Группа REST-эндпоинтов `/api/v1/transfers` для создания, обновления и удаления переводов между финансовыми центрами. Расположена в `backend/app/api/v1/endpoints/transfers.py`.

## Основные характеристики

| Метод | Путь | Назначение |
|-------|------|-----------|
| `POST` | `/api/v1/transfers` | Создать перевод (2 записи в t_f_budget_fact) |
| `PUT` | `/api/v1/transfers/{id}` | Обновить перевод |
| `DELETE` | `/api/v1/transfers/{id}` | Удалить перевод |

## Создание перевода (POST)

Payload:
```json
{
  "record_type": "fact|plan",
  "fact_date": "2026-01-01",
  "from_financial_center_id": 1,
  "to_financial_center_id": 2,
  "from_article_id": 10,
  "to_article_id": 20,
  "amount": 5000.00,
  "description": "..."
}
```

Логика на сервере:
1. Pydantic-валидация схемы
2. Проверка бизнес-правила: `from_fc != to_fc`
3. Дедупликация через `sync_hash` (UNIQUE constraint)
4. Создание двух записей в `t_f_budget_fact`:
   - Withdrawal: отрицательная сумма, `from_article_id`, `from_financial_center_id`
   - Deposit: положительная сумма, `to_article_id`, `to_financial_center_id`
5. Обе записи связаны общим `transfer_id`
6. Broadcast WebSocket события `transfer_created`

## Дедупликация

Поля `sync_hash` и `content_hash` предотвращают создание дублей при повторных запросах (например, при офлайн-синхронизации). `sync_hash` имеет UNIQUE constraint на уровне БД.

## WebSocket событие после создания

```python
await broadcast_budget_event(
    user_id=current_user.id,
    event_type="transfer_created",
    data={
        "transfer_id": transfer_id,
        "from_fc": from_fc_id,
        "to_fc": to_fc_id,
        "amount": amount,
        "record_type": record_type
    }
)
```

## POST /api/v1/transfers — полная спецификация

**Добавлено в версии:** v5.1.4+

**Request Body:**
```json
{
  "fact_date": "2025-11-24",
  "amount": 1000.00,
  "from_cfo_id": 1,
  "from_article_id": 42,
  "from_cost_center_id": null,
  "to_cfo_id": 2,
  "to_article_id": 43,
  "to_cost_center_id": null,
  "description": "Перевод из кошелька в банк"
}
```

**Request Schema:**

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `fact_date` | string (date) | Да | Дата перевода (YYYY-MM-DD, не в будущем) |
| `amount` | decimal | Да | Сумма (> 0) |
| `from_cfo_id` | integer | Да | ID финансового центра-источника |
| `from_article_id` | integer | Да | ID категории списания (type='debit') |
| `from_cost_center_id` | integer\|null | Нет | ID центра затрат для списания |
| `to_cfo_id` | integer | Да | ID финансового центра-получателя |
| `to_article_id` | integer | Да | ID категории пополнения (type='credit') |
| `to_cost_center_id` | integer\|null | Нет | ID центра затрат для пополнения |
| `description` | string | Нет | Описание (max 500 символов) |

**Validation Rules:**
1. `from_cfo_id != to_cfo_id` → HTTP 400 "Cannot transfer to the same financial center"
2. `amount > 0` → HTTP 400 "Amount must be positive"
3. `from_article.type == 'debit'`, `to_article.type == 'credit'` → HTTP 400
4. `fact_date <= today()` → HTTP 400 "Transfer date cannot be in the future"
5. Все ID должны существовать с `is_current=true` → HTTP 404

**Response (201 Created):**
```json
{
  "transfer_id": 100,
  "from_fact": {
    "id": 500,
    "user_id": 1,
    "article_id": 42,
    "financial_center_id": 1,
    "cost_center_id": null,
    "amount": 1000.00,
    "record_type": "fact",
    "fact_date": "2025-11-24",
    "description": "Перевод из кошелька в банк",
    "transfer_id": 100,
    "created_at": "2025-11-24T10:30:00Z"
  },
  "to_fact": {
    "id": 501,
    "user_id": 1,
    "article_id": 43,
    "financial_center_id": 2,
    "cost_center_id": null,
    "amount": 1000.00,
    "record_type": "fact",
    "fact_date": "2025-11-24",
    "description": "Перевод из кошелька в банк",
    "transfer_id": 100,
    "created_at": "2025-11-24T10:30:00Z"
  }
}
```

**Atomic Transaction:** обе записи создаются в одной DB-транзакции; при сбое любой — rollback обеих.

**transfer_id Generation:** `MAX(transfer_id) + 1`; PostgreSQL SERIALIZABLE isolation.

**Related Files:**
- `backend/app/api/v1/endpoints/transfers.py`
- `frontend/web/templates/components/modal_transfer.html`
- `frontend/web/static/js/transfer.js`

## Связанные концепции

- [[facts-and-articles-api]] — GET `/api/v1/facts` возвращает переводы в общем списке
- [[websocket-клиент]]
