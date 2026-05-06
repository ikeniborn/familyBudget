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
  - analytics
  - admin
aliases:
  - "analytics endpoint"
  - "admin endpoint"
  - "/api/v1/analytics"
  - "/api/v1/admin"
---

# Analytics & Admin API

Два блока эндпоинтов: `/api/v1/analytics` (отчёты план-факт, доступны всем пользователям) и `/api/v1/admin` (управление пользователями и расширенный просмотр транзакций, только для `is_admin=true`).

---

## Analytics Endpoints

| Метод | Путь | Назначение |
|-------|------|-----------|
| `GET` | `/api/v1/analytics/plan_fact` | План-факт анализ по периоду |
| `GET` | `/api/v1/analytics/weekly_summary` | Еженедельный отчёт (для Telegram бота) |

### GET /api/v1/analytics/plan_fact

**Query Parameters:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `period_id` | integer | ID периода (обязательный) |
| `group_by` | string | Группировка: `"period"` или `"article"` (default: `"article"`) |

**Response:**
```json
{
  "period": "Октябрь 2025",
  "data": [
    {
      "article": "Продукты",
      "plan": 15000.00,
      "fact": 12500.00,
      "deviation": -2500.00,
      "deviation_percent": -16.67
    }
  ]
}
```

`deviation` = `fact - plan`. Отрицательное значение означает экономию (факт меньше плана).

### GET /api/v1/analytics/weekly_summary

Используется Telegram ботом для еженедельных отчётов.

**Response:**
```json
{
  "week": "41-2025",
  "total_plan": 20000.00,
  "total_fact": 18500.00,
  "top_expenses": [
    {"article": "Продукты", "amount": 8000.00},
    {"article": "Транспорт", "amount": 5000.00},
    {"article": "Развлечения", "amount": 3500.00}
  ]
}
```

---

## Admin Endpoints

Все эндпоинты требуют JWT токен + `is_admin=true`. При отсутствии прав — `403 Forbidden`.

| Метод | Путь | Назначение |
|-------|------|-----------|
| `GET`  | `/api/v1/admin/facts` | Список всех транзакций (расширенная фильтрация) |
| `GET`  | `/api/v1/admin/facts/count` | Количество транзакций с учётом фильтров |
| `GET`  | `/api/v1/admin/users/check-duplicate` | Проверить дубликат по telegram_id |
| `POST` | `/api/v1/admin/users` | Создать пользователя вручную |
| `GET`  | `/api/v1/admin/users/stats/system` | Системная статистика |

**Добавлено в версии:** 5.0.0-beta (2025-11-02)

### GET /api/v1/admin/facts

**Query Parameters:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `user_id` | integer | Фильтр по пользователю |
| `article_id` | integer | Фильтр по категории |
| `date_from` | string | Дата от (YYYY-MM-DD) |
| `date_to` | string | Дата до (YYYY-MM-DD) |
| `record_type` | string | `"fact"`, `"plan"`, или null (все) |
| `financial_center_id` | integer | Фильтр по счёту |
| `cost_center_id` | integer | Фильтр по месту затрат |
| `search` | string | Поиск по описанию (case-insensitive, max 200 символов) |
| `limit` | integer | Записей на страницу (default: 50, max: 500) |
| `offset` | integer | Offset пагинации (default: 0) |

**Response** — массив объектов с денормализованными именами:
```json
[
  {
    "id": 1,
    "user_id": 1,
    "article_id": 5,
    "amount": 1500.00,
    "fact_date": "2025-11-02",
    "description": "Продукты в Магните",
    "record_type": "fact",
    "financial_center_id": 1,
    "cost_center_id": 2,
    "user_name": "ivan_ivanov",
    "article_name": "Продукты",
    "article_type": "expense",
    "financial_center_name": "Семейный бюджет",
    "cost_center_name": "Ежедневные расходы"
  }
]
```

### GET /api/v1/admin/facts/count

Принимает те же параметры фильтрации, что `/api/v1/admin/facts` (кроме `limit`/`offset`).

**Response:**
```json
{ "total": 150 }
```

### GET /api/v1/admin/users/check-duplicate

Используется admin panel для real-time валидации при создании пользователя.

**Query Parameters:**
- `telegram_id` (integer, обязательный) — Telegram ID для проверки (> 0)

**Response:** `true` (дубликат существует) или `false` (безопасно создавать).

Проверка производится только среди `is_current=True` записей (SCD Type 2).

**cURL:**
```bash
curl -X GET "http://localhost:8000/api/v1/admin/users/check-duplicate?telegram_id=123456789" \
  -H "Authorization: Bearer {admin_token}"
```

### POST /api/v1/admin/users

Создать пользователя вручную без прохождения Telegram OAuth.

**Request Body:**

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `telegram_id` | integer | Да | Telegram ID (> 0, уникальный среди `is_current`) |
| `username` | string | Нет | Username без @ (max 255) |
| `first_name` | string | Нет | Имя (max 255) |
| `last_name` | string | Нет | Фамилия (max 255) |
| `is_admin` | boolean | Нет | Права администратора (default: false) |

**Validation:**
1. Уникальность `telegram_id` среди `is_current=True` → HTTP 400 при дубликате
2. Проверка через Telegram Bot API (`getChat`) — пользователь должен начать диалог с ботом → HTTP 400 если не найден

**Response (201 Created):**
```json
{
  "id": 5,
  "telegram_id": 123456789,
  "username": "johndoe",
  "first_name": "John",
  "last_name": "Doe",
  "is_admin": false,
  "is_current": true,
  "valid_from": "2025-11-02T15:30:00",
  "valid_to": null
}
```

SCD Type 2: создаётся запись с `valid_from=now()`, `valid_to=null`, `is_current=true`.

### GET /api/v1/admin/users/stats/system

Системная статистика. Следует **Shared Family Budget Model** — все метрики глобальные, без фильтрации по `user_id`.

**Response:**

| Поле | Тип | Описание |
|------|-----|----------|
| `total_users` | integer | Зарегистрированных пользователей (`is_current=True`) |
| `total_active_users` | integer | Пользователей с хотя бы одной транзакцией |
| `total_facts` | integer | Всего транзакций (вся система, без фильтра по user_id) |
| `total_articles` | integer | Активных категорий (`is_current=True`, без фильтра по user_id) |
| `last_fact_date` | string\|null | Дата последней транзакции (YYYY-MM-DD) или null |

```json
{
  "total_users": 5,
  "total_active_users": 3,
  "total_facts": 150,
  "total_articles": 25,
  "last_fact_date": "2025-11-05"
}
```

**Добавлено в версии:** 5.0.1-beta (2025-11-06)

---

## Связанные концепции

- Shared Family Budget Model — данные видны всем участникам семьи
- SCD Type 2 — версионирование пользователей и категорий
