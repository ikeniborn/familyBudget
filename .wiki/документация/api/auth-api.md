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
  - authentication
aliases:
  - "auth endpoint"
  - "/api/v1/auth"
  - "authentication api"
---

# Auth API — эндпоинты аутентификации

Группа REST-эндпоинтов `/api/v1/auth` для аутентификации пользователей. Base URL: `/api/v1`. Поддерживает Telegram OAuth и JWT.

## Обзор

| Метод | Путь | Назначение |
|-------|------|-----------|
| `POST` | `/api/v1/auth/telegram` | Авторизация через Telegram Login Widget |
| `GET`  | `/api/v1/auth/me` | Получение текущего пользователя |

**Общее:** JWT токен передаётся в `Authorization: Bearer {token}` или Cookie. Все ответы в формате JSON.

**Стандартный формат ошибки:**
```json
{
  "error": "ErrorType",
  "detail": "Detailed error message",
  "timestamp": "2025-10-08T15:30:00Z"
}
```

---

## POST /api/v1/auth/telegram

Авторизация через Telegram Login Widget. Принимает данные виджета, проверяет HMAC-подпись (`hash`) и выдаёт JWT.

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

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 604800
}
```

`expires_in` — срок действия токена в секундах (604800 = 7 суток).

**cURL:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"id": 123456789, "first_name": "Иван", "hash": "..."}'
```

---

## GET /api/v1/auth/me

Возвращает профиль текущего аутентифицированного пользователя.

**Headers:**
- `Authorization: Bearer {token}`

**Response (200 OK):**
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

## Коды ответов

| Код | Описание |
|-----|----------|
| `200 OK` | Успешный запрос |
| `401 Unauthorized` | Отсутствует или невалидный JWT токен |
| `403 Forbidden` | Нет прав доступа |
