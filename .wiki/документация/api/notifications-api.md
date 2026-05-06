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
  - notifications
aliases:
  - "notifications endpoint"
  - "/api/v1/notifications"
---

# Notifications API — эндпоинт уведомлений

Группа REST-эндпоинтов `/api/v1/notifications` для получения бюджетных уведомлений (превышение порогов, еженедельные отчёты).

**Добавлено в версии:** 5.0.0-beta (2025-11-02)

## Broadcast Model

Все аутентифицированные пользователи видят **все** уведомления системы — нет фильтрации по `user_id`. Уведомления с `user_id = NULL` — broadcast (для всех). Это соответствует **Shared Family Budget Model**.

---

## GET /api/v1/notifications

**Authentication:** JWT токен (Authorization header или Cookie).

**Query Parameters:**

| Параметр | Тип | Default | Описание |
|----------|-----|---------|----------|
| `skip` | integer | 0 | Offset (количество пропускаемых записей) |
| `limit` | integer | 50 | Записей на страницу (max: 200) |
| `notification_type` | string | — | Фильтр по типу: `budget_threshold`, `budget_exceeded`, `weekly_report` |
| `date_from` | date | — | Фильтр с даты создания включительно (YYYY-MM-DD) |
| `date_to` | date | — | Фильтр по дату создания включительно (YYYY-MM-DD) |

**Поведение date-фильтров:**
- `date_from` → `created_at >= date_from 00:00:00`
- `date_to` → `created_at <= date_to 23:59:59`
- Фильтры комбинируются; без фильтров — возвращаются все записи.

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

**Поля ответа:**

| Поле | Описание |
|------|----------|
| `user_id` | ID пользователя или NULL (broadcast) |
| `article_id` | ID статьи бюджета |
| `notification_type` | Тип: `budget_threshold` (90%), `budget_exceeded` (100%), `weekly_report` |
| `threshold_percent` | Процент порога (90 или 100) |
| `plan_amount` | Плановая сумма |
| `actual_amount` | Фактическая сумма |
| `period_start` / `period_end` | Период бюджета |
| `created_at` | Время создания уведомления |

---

## cURL Examples

```bash
# Все уведомления
curl -X GET "http://localhost:8000/api/v1/notifications?skip=0&limit=50" \
  -H "Authorization: Bearer {token}"

# Фильтр по типу
curl -X GET "http://localhost:8000/api/v1/notifications?notification_type=budget_threshold" \
  -H "Authorization: Bearer {token}"

# Диапазон дат
curl -X GET "http://localhost:8000/api/v1/notifications?date_from=2025-10-01&date_to=2025-10-31" \
  -H "Authorization: Bearer {token}"

# Комбинация фильтров
curl -X GET "http://localhost:8000/api/v1/notifications?notification_type=budget_exceeded&date_from=2025-10-15&limit=20" \
  -H "Authorization: Bearer {token}"
```

---

## Error Responses

| Код | Причина | Тело |
|-----|---------|------|
| `401 Unauthorized` | Нет токена | `{"detail": "Not authenticated"}` |
| `400 Bad Request` | Неверный формат даты | `{"detail": "Invalid date format. Expected: YYYY-MM-DD"}` |
| `400 Bad Request` | Невалидный limit | `{"detail": "limit must be between 1 and 200"}` |

---

## История изменений

- **5.0.0-beta (2025-11-02)** — добавлен эндпоинт
- **5.0.0-beta (2025-11-06)** — исправлена ошибка 500 с date-фильтрами; добавлено требование аутентификации
- **5.0.0-beta (2025-11-07)** — исправлена ошибка 500 в COUNT query; добавлен CalendarWidget для фильтров дат; конвертация формата ДД.ММ.ГГГГ → YYYY-MM-DD через DateFormatter
