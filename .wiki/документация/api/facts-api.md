---
wiki_sources:
  - "docs/architecture/backend/endpoints/facts.yaml"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links:
  - "[[dexie-module]]"
  - "[[websocket-клиент]]"
tags:
  - family-budget
  - architecture
  - api
  - facts
aliases:
  - "facts endpoint"
  - "/api/v1/facts"
  - "transactions API"
---

# Facts API — эндпоинт транзакций

Группа REST-эндпоинтов `/api/v1/facts` для управления транзакциями (фактами) бюджета. Расположена в `backend/app/api/v1/endpoints/facts.py`. Схемы: `backend/app/schemas/fact.py`.

## Обзор эндпоинтов

| Метод | Путь | Назначение |
|-------|------|-----------|
| `GET` | `/api/v1/facts` | Список транзакций с фильтрацией |
| `POST` | `/api/v1/facts` | Создать транзакцию |
| `GET` | `/api/v1/facts/{fact_id}` | Получить транзакцию по ID |
| `PUT` | `/api/v1/facts/{fact_id}` | Обновить транзакцию |
| `DELETE` | `/api/v1/facts/{fact_id}` | Удалить транзакцию |
| `GET` | `/api/v1/facts/recent-html` | Последние транзакции как HTML (HTMX) |

Все эндпоинты требуют аутентификации (`auth: user`).

## GET /api/v1/facts — список транзакций

### Query-параметры фильтрации

| Параметр | Тип | Описание |
|----------|-----|---------|
| `date_from` | `YYYY-MM-DD` | Начало периода (опционально) |
| `date_to` | `YYYY-MM-DD` | Конец периода (опционально) |
| `article_id` | integer | Фильтр по статье бюджета (опционально) |
| `financial_center_id` | integer | Фильтр по финансовому центру (опционально) |
| `cost_center_id` | integer | Фильтр по месту затрат (опционально) |
| `record_type` | `fact` \| `plan` | Тип записи (опционально) |
| `page` | integer | Номер страницы (по умолчанию: 1) |
| `per_page` | integer | Размер страницы (по умолчанию: 50, макс: 100) |

### Ответ 200

```json
{
  "facts": [...],
  "total": 123,
  "limit": 50,
  "offset": 0
}
```

Объект транзакции (`fact_object`):

```json
{
  "id": 1,
  "user_id": 42,
  "article_id": 10,
  "article_name": "Продукты",
  "financial_center_id": 3,
  "cost_center_id": 5,
  "amount": "1500.00",
  "fact_date": "2026-05-01",
  "description": "Магазин",
  "record_type": "fact",
  "transfer_id": null,
  "created_at": "2026-05-01T12:00:00Z"
}
```

`transfer_id` — UUID, не null только для транзакций, созданных через [[transfers-api|Transfers API]].

## POST /api/v1/facts — создание транзакции

### Тело запроса

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|---------|
| `article_id` | integer | да | ID статьи бюджета |
| `amount` | decimal | да | Сумма (> 0) |
| `fact_date` | `YYYY-MM-DD` | да | Дата транзакции |
| `financial_center_id` | integer | да | ID финансового центра |
| `cost_center_id` | integer | нет | ID места затрат |
| `description` | string | нет | Комментарий |
| `record_type` | `fact` \| `plan` | нет | Тип записи (по умолчанию: `fact`) |
| `sync_hash` | string | нет | Хэш для офлайн-дедупликации |

### Правила валидации дат

- `record_type=fact`: `fact_date` не может быть в будущем — допускается до `today + 1 день` (толерантность часового пояса)
- `record_type=plan`: будущие даты разрешены
- Оба типа: дата должна быть в пределах 10 лет от сегодня

Толерантность +1 день позволяет пользователям в часовых поясах опережающих UTC (до UTC+14) создавать транзакции своим «сегодня», когда серверное время (UTC) ещё на предыдущем дне.

### Ответ 201

Полный объект созданной транзакции.

### Ошибки

| Статус | Сообщение | Причина |
|--------|-----------|---------|
| 404 | `Article not found` | Статья не найдена |
| 422 | `Счёт с id=X не найден` | Финансовый центр не существует |
| 422 | `Счёт 'Name' архивирован. Выберите активный счёт.` | Финансовый центр архивирован |
| 422 | `Место затрат с id=X не найдено` | Место затрат не существует |
| 422 | `Место затрат 'Name' архивировано` | Место затрат архивировано |

### Побочные эффекты

1. Создаётся запись `BudgetFactHistory`
2. WebSocket broadcast: событие `fact_created`
3. Обновление агрегатов баланса

### Дедупликация (sync_hash)

Поле `sync_hash` используется для офлайн-дедупликации (интеграция с [[dexie-module]]). Если транзакция с таким `sync_hash` уже существует — запрос игнорируется, возвращается существующая запись. Реализовано через UNIQUE constraint на уровне БД.

## GET /api/v1/facts/{fact_id} — получить транзакцию

Возвращает полный объект транзакции (200) или 404, если не найдена.

## PUT /api/v1/facts/{fact_id} — обновление транзакции

### Тело запроса (все поля опциональны)

`article_id`, `amount`, `fact_date`, `financial_center_id`, `cost_center_id`, `description`

### Ответ 200

Полный обновлённый объект транзакции.

### Побочные эффекты

1. Старая запись `BudgetFactHistory` закрывается (SCD Type 1)
2. Новая запись `BudgetFactHistory` создаётся
3. WebSocket broadcast: событие `fact_updated`

## DELETE /api/v1/facts/{fact_id} — удаление транзакции

### Ответ 200

```json
{ "message": "Transaction deleted" }
```

### Побочные эффекты

1. Запись `BudgetFactHistory` с `change_type=DELETE`
2. WebSocket broadcast: событие `fact_deleted`

## GET /api/v1/facts/recent-html — HTMX-эндпоинт

Возвращает HTML последних транзакций для вставки через HTMX (Content-Type: `text/html`). Использует шаблон `partials/recent_transactions.html`.

| Параметр | Тип | Описание |
|----------|-----|---------|
| `limit` | integer | Количество записей (по умолчанию: 10) |

## Схемы Pydantic

Файл: `backend/app/schemas/fact.py`

| Класс | Назначение |
|-------|-----------|
| `FactCreate` | Тело запроса POST |
| `FactUpdate` | Тело запроса PUT |
| `FactResponse` | Объект транзакции в ответе |
| `FactListResponse` | Ответ GET списка (facts + pagination) |
| `FactFilter` | Query-параметры фильтрации |

## Связанные модели БД

- `t_f_budget_fact` — основная таблица транзакций
- `t_f_budget_fact_history` — история изменений (SCD)

## Связанные концепции

- [[dexie-module]] — офлайн-синхронизация через sync_hash
- [[websocket-клиент]] — real-time события fact_created / fact_updated / fact_deleted
