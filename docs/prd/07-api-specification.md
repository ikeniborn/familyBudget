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
| `financial_center_id` | integer | Нет | Фильтр по счету |
| `cost_center_id` | integer | Нет | Фильтр по месту затрат |
| `search` | string | Нет | Поиск по описанию (case-insensitive substring, max_length: 200) |
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

#### GET /api/v1/admin/users/check-duplicate

**Описание:** Проверить существование пользователя с указанным telegram_id (admin only)

**Назначение:** Используется admin panel для real-time валидации при создании нового пользователя. Предотвращает попытки создания дубликатов.

**Query Parameters:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `telegram_id` | integer | Да | Telegram ID для проверки (должен быть > 0) |

**Response:**

```json
true
```

или

```json
false
```

**Response Type:** `boolean`
- `true` - пользователь с таким telegram_id существует (дубликат)
- `false` - пользователь не существует (безопасно создавать)

**Примечания:**
- Проверка производится только среди текущих (активных) пользователей (`is_current=True`)
- Учитывает SCD Type 2 историчность данных

**cURL Example:**

```bash
curl -X GET "http://localhost:8000/api/v1/admin/users/check-duplicate?telegram_id=123456789" \
  -H "Authorization: Bearer {admin_token}"
```

**Добавлено в версии:** 5.0.0-beta (2025-11-02)

---

#### POST /api/v1/admin/users

**Описание:** Создать нового пользователя вручную (admin only)

**Назначение:** Позволяет администраторам добавлять пользователей вручную через admin panel без необходимости прохождения Telegram OAuth.

**Request Body:**

```json
{
  "telegram_id": 123456789,
  "username": "johndoe",
  "first_name": "John",
  "last_name": "Doe",
  "is_admin": false
}
```

**Request Schema:**

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `telegram_id` | integer | Да | Telegram ID пользователя (должен быть > 0 и уникальным) |
| `username` | string | Нет | Telegram username (без @, max 255 символов) |
| `first_name` | string | Нет | Имя пользователя (max 255 символов) |
| `last_name` | string | Нет | Фамилия пользователя (max 255 символов) |
| `is_admin` | boolean | Нет | Права администратора (default: false) |

**Validation Rules:**

1. **Уникальность telegram_id:**
   - Проверяется среди текущих пользователей (`is_current=True`)
   - Если найден дубликат → HTTP 400

2. **Telegram API валидация:**
   - Проверяется существование telegram_id через Telegram Bot API (`getChat` method)
   - Если пользователь не найден в Telegram → HTTP 400
   - **Важно:** Bot должен иметь доступ к пользователю (пользователь должен был начать диалог с ботом или иметь публичный профиль)

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

**Error Responses:**

**400 Bad Request (duplicate):**
```json
{
  "detail": "User with telegram_id 123456789 already exists"
}
```

**400 Bad Request (invalid telegram_id):**
```json
{
  "detail": "Invalid telegram_id 123456789. User not found in Telegram or bot hasn't interacted with this user. Please ensure the user has started a conversation with the bot."
}
```

**500 Internal Server Error:**
```json
{
  "detail": "Failed to create user: {error_message}"
}
```

**SCD Type 2 Behavior:**
- Создается новая запись с `valid_from=now()`, `valid_to=None`, `is_current=True`
- Не затрагивает исторические записи других пользователей

**cURL Example:**

```bash
curl -X POST http://localhost:8000/api/v1/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin_token}" \
  -d '{
    "telegram_id": 123456789,
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "is_admin": false
  }'
```

**Добавлено в версии:** 5.0.0-beta (2025-11-02)

---

#### GET /api/v1/admin/users/stats/system

**Описание:** Получить системную статистику (admin only)

**Назначение:** Отображение общей статистики системы на странице администратора. Следует принципу **Shared Family Budget Model** - все метрики глобальные (не фильтруются по user_id).

**Authentication:** Требуется JWT токен + admin права (is_admin=True)

**Response:**

```json
{
  "total_users": 5,
  "total_active_users": 3,
  "total_facts": 150,
  "total_articles": 25,
  "last_fact_date": "2025-11-05"
}
```

**Response Schema:**

| Поле | Тип | Описание |
|------|-----|----------|
| `total_users` | integer | Всего зарегистрированных пользователей (is_current=True) |
| `total_active_users` | integer | Пользователей, создавших хотя бы одну транзакцию (audit trail) |
| `total_facts` | integer | Всего транзакций в системе (Shared Family Budget - БЕЗ фильтрации по user_id) |
| `total_articles` | integer | Всего активных категорий (is_current=True, Shared References - БЕЗ фильтрации по user_id) |
| `last_fact_date` | string \| null | Дата последней транзакции в системе (ISO format: YYYY-MM-DD) или null |

**Архитектурные принципы:**

- **Shared Family Budget Model:** Метрики транзакций (`total_facts`) и категорий (`total_articles`) считаются для ВСЕЙ системы, не изолируются по пользователям
- **Audit Trail:** `user_id` в таблицах используется только для отслеживания кто создал запись, но не влияет на видимость данных
- **Target Audience:** Семейный бюджет для 2-5 человек с полной прозрачностью данных

**Пример запроса:**

```bash
curl -X GET "http://localhost:8000/api/v1/admin/users/stats/system" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Cookie: access_token=<jwt_token>"
```

**Error Responses:**

- `401 Unauthorized` - отсутствует или невалидный JWT токен
- `403 Forbidden` - пользователь не является администратором

**См. также:**
- CLAUDE.md - Shared Family Budget Model
- CLAUDE.md - Shared References Architecture

**Добавлено в версии:** 5.0.1-beta (2025-11-06)

---

### 7.9 Notifications Endpoints

#### GET /api/v1/notifications

**Описание:** Получение списка уведомлений с пагинацией и фильтрацией

**Authentication:** Требуется JWT токен (Authorization header или Cookie)

**Query Parameters:**
- `skip` (integer, optional, default: 0) - Количество пропускаемых записей (offset)
- `limit` (integer, optional, default: 50, max: 200) - Количество записей на странице
- `notification_type` (string, optional, max_length: 50) - Фильтр по типу уведомления
  - Допустимые значения: `budget_threshold`, `budget_exceeded`, `weekly_report`
- `date_from` (date, optional) - Фильтр по дате создания (включительно, начало дня)
  - Формат: `YYYY-MM-DD`
  - Пример: `2025-10-01`
- `date_to` (date, optional) - Фильтр по дате создания (включительно, конец дня)
  - Формат: `YYYY-MM-DD`
  - Пример: `2025-10-31`

**Response:**

```json
{
  "items": [
    {
      "id": 1,
      "user_id": null,
      "article_id": 5,
      "notification_type": "budget_threshold",
      "threshold_percent": 90,
      "plan_amount": "10000.00",
      "actual_amount": "9500.00",
      "period_start": "2025-10-01",
      "period_end": "2025-10-31",
      "created_at": "2025-10-15T10:30:00Z"
    }
  ],
  "total": 1,
  "skip": 0,
  "limit": 50
}
```

**Response Fields:**
- `items` - Массив уведомлений
  - `user_id` - ID пользователя (NULL для broadcast уведомлений)
  - `article_id` - ID статьи бюджета
  - `notification_type` - Тип уведомления
  - `threshold_percent` - Процент порога (90% или 100%)
  - `plan_amount` - Плановая сумма
  - `actual_amount` - Фактическая сумма
  - `period_start` / `period_end` - Период бюджета
  - `created_at` - Дата и время создания уведомления
- `total` - Общее количество записей (до пагинации)
- `skip` - Offset (из запроса)
- `limit` - Лимит (из запроса)

**Broadcast Model:**
- Все аутентифицированные пользователи видят **ВСЕ** уведомления
- Уведомления с `user_id = NULL` - broadcast (для всех пользователей)
- НЕТ фильтрации по `user_id` (shared family budget)

**Date Filters Behavior:**
- `date_from` - возвращает уведомления с `created_at >= date_from 00:00:00`
- `date_to` - возвращает уведомления с `created_at <= date_to 23:59:59`
- Оба фильтра можно комбинировать для диапазона дат
- При отсутствии фильтров - возвращаются все уведомления

**cURL Examples:**

```bash
# Все уведомления (с пагинацией)
curl -X GET "http://localhost:8000/api/v1/notifications?skip=0&limit=50" \
  -H "Authorization: Bearer {token}"

# Фильтр по типу уведомления
curl -X GET "http://localhost:8000/api/v1/notifications?notification_type=budget_threshold" \
  -H "Authorization: Bearer {token}"

# Фильтр по дате создания (с date_from)
curl -X GET "http://localhost:8000/api/v1/notifications?date_from=2025-10-01" \
  -H "Authorization: Bearer {token}"

# Фильтр по дате создания (с date_to)
curl -X GET "http://localhost:8000/api/v1/notifications?date_to=2025-10-31" \
  -H "Authorization: Bearer {token}"

# Фильтр по диапазону дат (date_from и date_to)
curl -X GET "http://localhost:8000/api/v1/notifications?date_from=2025-10-01&date_to=2025-10-31" \
  -H "Authorization: Bearer {token}"

# Комбинация фильтров
curl -X GET "http://localhost:8000/api/v1/notifications?notification_type=budget_exceeded&date_from=2025-10-15&limit=20" \
  -H "Authorization: Bearer {token}"
```

**Error Responses:**

**401 Unauthorized:**
```json
{
  "detail": "Not authenticated"
}
```

**400 Bad Request (invalid date format):**
```json
{
  "detail": "Invalid date format. Expected: YYYY-MM-DD"
}
```

**400 Bad Request (invalid limit):**
```json
{
  "detail": "limit must be between 1 and 200"
}
```

**Добавлено в версии:** 5.0.0-beta (2025-11-02)

**Исправлено в версии:** 5.0.0-beta (2025-11-06)
- Исправлена ошибка 500 при использовании date фильтров (добавлен импорт datetime)
- Добавлено требование аутентификации (CurrentUser dependency)

**Исправлено в версии:** 5.0.0-beta (2025-11-07)
- Исправлена ошибка 500 в COUNT query (заменен `select(func.count()).select_from(statement.subquery())` на `select(func.count(Notification.id))` с дублированием фильтров)
- Добавлен CalendarWidget для фильтров дат на странице /notifications (консистентность с /facts и /plan)
- Реализована конвертация формата дат: пользовательский ДД.ММ.ГГГГ → API YYYY-MM-DD через DateFormatter

---


### 7.10 Transfer Endpoints

**Добавлено в версии:** v5.1.4+
**Branch:** `feature/ui-improvements-and-transfers`
**Статус:** ✅ IMPLEMENTED

#### POST /api/v1/transfers

**Описание:** Создание перевода между счетами

**Назначение:**
Создает 2 связанные транзакции (списание с источника + пополнение получателя) для отражения движения средств между счетами. Обе транзакции объединены через `transfer_id` и создаются атомарно.

**Authentication:** Требуется JWT токен (Authorization header или Cookie)

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
| `fact_date` | string (date) | Да | Дата перевода (YYYY-MM-DD, не может быть в будущем) |
| `amount` | number (decimal) | Да | Сумма перевода (> 0, до 2 знаков после запятой) |
| `from_cfo_id` | integer | Да | ID финансового центра-источника (откуда) |
| `from_article_id` | integer | Да | ID категории списания (type='debit') |
| `from_cost_center_id` | integer \| null | Нет | ID центра затрат для списания (опционально) |
| `to_cfo_id` | integer | Да | ID финансового центра-получателя (куда) |
| `to_article_id` | integer | Да | ID категории пополнения (type='credit') |
| `to_cost_center_id` | integer \| null | Нет | ID центра затрат для пополнения (опционально) |
| `description` | string | Нет | Описание перевода (max 500 символов) |

**Validation Rules:**

1. **Different CFOs:**
   - `from_cfo_id != to_cfo_id`
   - Нельзя переводить в тот же самый счет
   - Error: HTTP 400 "Cannot transfer to the same financial center"

2. **Positive Amount:**
   - `amount > 0`
   - Error: HTTP 400 "Amount must be positive"

3. **Article Types:**
   - `from_article` MUST have `type='debit'` (списание)
   - `to_article` MUST have `type='credit'` (пополнение)
   - Error: HTTP 400 "FROM article must be type 'debit'" или "TO article must be type 'credit'"

4. **Date Validation:**
   - `fact_date <= today()`
   - Нельзя создавать переводы в будущем
   - Error: HTTP 400 "Transfer date cannot be in the future"

5. **Entity Existence:**
   - Все ID (cfo, article, cost_center) должны существовать и быть актуальными (`is_current=true`)
   - Error: HTTP 404 "Financial center not found" или "Article not found"

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

**Response Schema:**

| Поле | Тип | Описание |
|------|-----|----------|
| `transfer_id` | integer | Уникальный ID перевода (связывает 2 транзакции) |
| `from_fact` | BudgetFact | Факт списания с источника |
| `to_fact` | BudgetFact | Факт пополнения получателя |

**Atomic Transaction Behavior:**
- Обе транзакции создаются в одной database transaction
- Если создание любой из транзакций fails → rollback обеих
- Гарантируется консистентность данных (нет "половинных" переводов)

**transfer_id Generation:**
- Используется pattern: `MAX(transfer_id) + 1`
- Thread-safe в PostgreSQL (SERIALIZABLE isolation level)
- Начинается с 1 если это первый перевод

**Error Responses:**

**400 Bad Request (same CFO):**
```json
{
  "detail": "Cannot transfer to the same financial center. FROM and TO must be different."
}
```

**400 Bad Request (invalid article type):**
```json
{
  "detail": "FROM article must be type 'debit' (got 'expense')"
}
```

**400 Bad Request (negative amount):**
```json
{
  "detail": "Amount must be greater than 0"
}
```

**400 Bad Request (future date):**
```json
{
  "detail": "Transfer date cannot be in the future"
}
```

**404 Not Found:**
```json
{
  "detail": "Financial center with id 999 not found"
}
```

**401 Unauthorized:**
```json
{
  "detail": "Not authenticated"
}
```

**500 Internal Server Error:**
```json
{
  "detail": "Failed to create transfer: {error_message}"
}
```

**cURL Example:**

```bash
curl -X POST "http://localhost:8000/api/v1/transfers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{
    "fact_date": "2025-11-24",
    "amount": 1000.00,
    "from_cfo_id": 1,
    "from_article_id": 42,
    "from_cost_center_id": null,
    "to_cfo_id": 2,
    "to_article_id": 43,
    "to_cost_center_id": null,
    "description": "Перевод из кошелька в банк"
  }'
```

**Implementation Notes:**

**Backend (backend/app/api/v1/endpoints/transfers.py):**
```python
@router.post("/", response_model=TransferResponse)
async def create_transfer(
    data: TransferCreate,
    session: AsyncSession,
    current_user: CurrentUser
):
    # 1. Validate from_cfo != to_cfo
    if data.from_cfo_id == data.to_cfo_id:
        raise HTTPException(400, "Cannot transfer to the same CFO")

    # 2. Validate article types
    from_article = await validate_article_type(session, data.from_article_id, 'debit')
    to_article = await validate_article_type(session, data.to_article_id, 'credit')

    # 3. Generate unique transfer_id
    transfer_id = await generate_transfer_id(session)

    # 4. Create FROM fact (списание)
    from_fact = BudgetFact(
        user_id=current_user.id,
        article_id=data.from_article_id,
        financial_center_id=data.from_cfo_id,
        cost_center_id=data.from_cost_center_id,
        amount=data.amount,
        record_type="fact",
        fact_date=data.fact_date,
        description=data.description,
        transfer_id=transfer_id
    )
    session.add(from_fact)

    # 5. Create TO fact (пополнение)
    to_fact = BudgetFact(
        user_id=current_user.id,
        article_id=data.to_article_id,
        financial_center_id=data.to_cfo_id,
        cost_center_id=data.to_cost_center_id,
        amount=data.amount,
        record_type="fact",
        fact_date=data.fact_date,
        description=data.description,
        transfer_id=transfer_id
    )
    session.add(to_fact)

    # 6. Commit atomically
    await session.commit()
    await session.refresh(from_fact)
    await session.refresh(to_fact)

    return TransferResponse(
        transfer_id=transfer_id,
        from_fact=from_fact,
        to_fact=to_fact
    )
```

**Frontend Integration:**
- Modal: `frontend/web/templates/components/modal_transfer.html`
- JavaScript: `frontend/web/static/js/transfer.js`
- Открывается через: `openTransferModal()` function
- ChoicesCategoryTree фильтрует категории по типу (debit/credit)

**Related Documents:**
- docs/prd/04-functional-requirements.md - FR-080: Переводы между счетами
- docs/prd/06-database-design.md - секция 6.3.1 Transfer Support Fields
- docs/prd/08-ui-design.md - Transfer modal UI specification
- CLAUDE.md - Shared Family Budget Model

**См. также:**
- GET `/api/v1/facts` - для получения списка транзакций (включая transfers)
- GET `/api/v1/articles` - для получения списка категорий (включая debit/credit)
- GET `/api/v1/financial_centers` - для получения списка счетов

---
