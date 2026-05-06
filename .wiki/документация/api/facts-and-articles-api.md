---
wiki_sources:
  - "docs/prd/07-api-specification.md"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links: []
tags:
  - family-budget
  - architecture
  - api
  - facts
  - articles
aliases:
  - "facts endpoint"
  - "articles endpoint"
  - "/api/v1/facts"
  - "/api/v1/articles"
  - "dictionary api"
---

# Facts & Articles API — транзакции и справочник категорий

Две взаимосвязанные группы эндпоинтов: `/api/v1/articles` (справочник категорий, SCD Type 2) и `/api/v1/facts` (бюджетные транзакции).

## Articles (справочник категорий)

Категории хранятся по паттерну **SCD Type 2**: каждое изменение создаёт новую запись с `valid_from`/`valid_to`, актуальная запись имеет `is_current=true`.

| Метод | Путь | Назначение |
|-------|------|-----------|
| `GET`    | `/api/v1/articles` | Получить дерево актуальных категорий |
| `POST`   | `/api/v1/articles` | Создать новую категорию |
| `PUT`    | `/api/v1/articles/{id}` | Обновить категорию (SCD2: новая версия) |
| `DELETE` | `/api/v1/articles/{id}` | Деактивировать категорию (`valid_to=NOW()`) |

### GET /api/v1/articles

Возвращает дерево актуальных статей (`is_current=true`) с вложенными children.

**Query Parameters:**
- `user_id` (optional, admin only) — фильтр по пользователю

**Response:**
```json
[
  {
    "id": 1,
    "code": "PROD",
    "name": "Продукты",
    "parent_id": null,
    "children": [
      {
        "id": 2,
        "code": "FOOD",
        "name": "Еда",
        "parent_id": 1
      }
    ]
  }
]
```

### POST /api/v1/articles

**Request Body:**
```json
{
  "code": "SUBS",
  "name": "Подписки",
  "parent_id": 5
}
```

**Response (201 Created):**
```json
{
  "id": 25,
  "code": "SUBS",
  "name": "Подписки",
  "parent_id": 5,
  "is_current": true,
  "valid_from": "2025-10-08T15:30:00Z"
}
```

### PUT /api/v1/articles/{id}

SCD2: не обновляет существующую запись, а создаёт новую версию с новым `valid_from`.

**Request Body:**
```json
{
  "name": "Продукты питания"
}
```

**Response:** `200 OK` с новой записью.

### DELETE /api/v1/articles/{id}

Мягкое удаление: устанавливает `valid_to=NOW()`, `is_current=false`.

**Response:** `204 No Content`

---

## Facts (бюджетные транзакции)

| Метод | Путь | Назначение |
|-------|------|-----------|
| `GET`  | `/api/v1/facts` | Получить список транзакций с фильтрацией |
| `POST` | `/api/v1/facts` | Создать транзакцию (факт или план) |

### GET /api/v1/facts

**Query Parameters:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `period_id` | integer | Фильтр по периоду |
| `article_id` | integer | Фильтр по категории |
| `record_type` | string | `"plan"` или `"fact"` |
| `limit` | integer | Количество записей (default: 50) |
| `offset` | integer | Смещение для пагинации |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "user_id": 1,
      "article_id": 2,
      "financial_center_id": 1,
      "cost_center_id": 1,
      "period_id": 1,
      "record_type": "fact",
      "amount": 1500.00,
      "transaction_date": "2025-10-08",
      "comment": "Покупка продуктов"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### POST /api/v1/facts

**Request Body:**
```json
{
  "article_id": 2,
  "financial_center_id": 1,
  "cost_center_id": 1,
  "period_id": 1,
  "record_type": "fact",
  "amount": 1500.00,
  "transaction_date": "2025-10-08",
  "comment": "Покупка продуктов"
}
```

**Response:** `201 Created`

---

## Связанные концепции

- SCD Type 2 — паттерн версионирования для Articles
- [[transfers-api]] — переводы между счетами (создают пары фактов)
