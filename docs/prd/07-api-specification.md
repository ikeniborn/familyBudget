## 7. API Specification

### 7.1 API Overview

**Base URL:** `/api/v1`

**Authentication:** JWT токен в Authorization header или Cookie

**Response Format:** JSON

**Status Codes:**
- `200 OK` - Успешный запрос
- `201 Created` - Ресурс создан
- `400 Bad Request` - Ошибка валидации
- `401 Unauthorized` - Не авторизован
- `403 Forbidden` - Нет прав доступа
- `404 Not Found` - Ресурс не найден
- `500 Internal Server Error` - Серверная ошибка

**Error Response Format:**

```json
{
  "error": "ErrorType",
  "detail": "Detailed error message",
  "timestamp": "2025-10-08T15:30:00Z"
}
```

### 7.2 Authentication Endpoints

#### POST /api/v1/auth/telegram

**Описание:** Авторизация через Telegram Login Widget

**Request Body:**

```json
{
  "id": 123456789,
  "first_name": "Иван",
  "last_name": "Иванов",
  "username": "ivan_ivanov",
  "photo_url": "https://...",
  "auth_date": 1696780800,
  "hash": "abc123def456..."
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 604800
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:8000/api/v1/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"id": 123456789, "first_name": "Иван", "hash": "..."}'
```

---

#### GET /api/v1/auth/me

**Описание:** Получение текущего пользователя

**Headers:**
- `Authorization: Bearer {token}`

**Response:**

```json
{
  "id": 1,
  "telegram_id": 123456789,
  "username": "ivan_ivanov",
  "first_name": "Иван",
  "last_name": "Иванов",
  "is_admin": false
}
```

---

### 7.3 Dictionary Endpoints

#### GET /api/v1/articles

**Описание:** Получение списка статей (актуальные SCD2)

**Query Parameters:**
- `user_id` (optional, admin only) - фильтр по пользователю

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

---

#### POST /api/v1/articles

**Описание:** Создание новой статьи

**Request Body:**

```json
{
  "code": "SUBS",
  "name": "Подписки",
  "parent_id": 5
}
```

**Response:** `201 Created`

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

---

#### PUT /api/v1/articles/{id}

**Описание:** Обновление статьи (SCD2: создает новую версию)

**Request Body:**

```json
{
  "name": "Продукты питания"
}
```

**Response:** `200 OK` с новой записью

---

#### DELETE /api/v1/articles/{id}

**Описание:** Деактивация статьи (SCD2: устанавливает valid_to=NOW())

**Response:** `204 No Content`

---

### 7.4 Facts Endpoints

#### GET /api/v1/facts

**Описание:** Получение фактов с фильтрацией

**Query Parameters:**
- `period_id` - фильтр по периоду
- `article_id` - фильтр по статье
- `record_type` - фильтр по типу (plan/fact)
- `limit` - количество записей (default: 50)
- `offset` - смещение для пагинации

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

---

#### POST /api/v1/facts

**Описание:** Создание факта/плана

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

### 7.5 Analytics Endpoints

#### GET /api/v1/analytics/plan_fact

**Описание:** План-факт анализ

**Query Parameters:**
- `period_id` - ID периода
- `group_by` - группировка: "period" или "article" (default: "article")

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

---

#### GET /api/v1/analytics/weekly_summary

**Описание:** Еженедельный отчет (для бота)

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

### 7.5 Admin Endpoints

#### GET /api/v1/admin/facts

**Описание:** Получить список всех фактов с расширенной фильтрацией (admin only)

**Query Parameters:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `user_id` | integer | Нет | Фильтр по пользователю |
| `article_id` | integer | Нет | Фильтр по категории/статье |
| `date_from` | string | Нет | Фильтр по дате от (ISO format: YYYY-MM-DD) |
| `date_to` | string | Нет | Фильтр по дате до (ISO format: YYYY-MM-DD) |
| `record_type` | string | Нет | Фильтр по типу: "fact", "plan", null (все) |
| `financial_center_id` | integer | Нет | Фильтр по финансовому центру (ЦФО) |
| `cost_center_id` | integer | Нет | Фильтр по центру затрат (МВЗ) |
| `limit` | integer | Нет | Записей на страницу (default: 50, max: 500) |
| `offset` | integer | Нет | Offset для пагинации (default: 0) |

**Response:**

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

**Добавлено в версии:** 5.0.0-beta (2025-11-02)

---

#### GET /api/v1/admin/facts/count

**Описание:** Получить общее количество фактов с учётом фильтров (admin only)

**Query Parameters:** Те же что и для `/api/v1/admin/facts` (кроме limit/offset)

**Response:**

```json
{
  "total": 150
}
```

**Добавлено в версии:** 5.0.0-beta (2025-11-02)

---

