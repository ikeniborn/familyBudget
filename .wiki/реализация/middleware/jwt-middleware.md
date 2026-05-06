---
wiki_sources:
  - "backend/app/middleware/jwt_middleware.py"
wiki_updated: 2026-05-06
wiki_status: mature
wiki_outgoing_links: []
tags:
  - family-budget
  - implementation
  - middleware
  - security
  - jwt
aliases:
  - "JWTAuthMiddleware"
  - "jwt middleware"
  - "аутентификация middleware"
---

# JWT Auth Middleware — аутентификация запросов

`backend/app/middleware/jwt_middleware.py` — Starlette middleware для JWT-аутентификации.

## Логика dispatch

```
1. Извлечь токен (Cookie: access_token > Authorization: Bearer)
2. Если токен найден → decode_access_token_full() → user_id, telegram_id
3. Если валиден → request.state.user_id = user_id
                  request.state.telegram_id = telegram_id
4. Если публичный путь → continue (независимо от токена)
5. Если защищённый + нет user_id → _create_auth_error_response()
```

**Важно**: токен извлекается ВСЕГДА, даже для публичных путей — чтобы `CurrentUserOptional` мог получить пользователя из cookie.

## Публичные пути

**Точные совпадения** (`PUBLIC_PATHS`):
- `/health`, `/ready`, `/ping`, `/health/detailed`
- `/docs`, `/openapi.json`, `/redoc`
- `/`, `/analytics` (использует `CurrentUserOptional`)
- `/favicon.ico`, `/manifest.json`, `/sw.min.js`
- Страницы email-auth: `/register`, `/login-email`, `/2fa-verify`, `/2fa-setup-login`, `/pending-activation`
- `/api/v1/push/vapid-key` — VAPID публичный ключ
- WebAuthn auth endpoints (login без токена)

**Префиксы** (`PUBLIC_PREFIXES`):
- `/api/v1/auth/`
- `/api/v1/webapp/validate`
- `/static/`, `/shared/`, `/webapp/`

## Типы ответов 401

| Тип запроса | Ответ |
|-------------|-------|
| HTMX (`HX-Request: true`) | 401 + `HX-Redirect: /login` header |
| API (`Accept: application/json` или `Authorization` header) | JSON 401 |
| Browser (`Accept: text/html`) | 303 Redirect → `/login` |
| Неизвестный | JSON 401 |

**Приоритет**: HTMX > API > Browser (HTMX requests тоже содержат `text/html` в Accept).

## Извлечение токена

```python
# 1. Cookie (primary)
token = request.cookies.get("access_token")
# 2. Authorization header (fallback для API клиентов)
auth_header = request.headers.get("Authorization")
if auth_header.startswith("Bearer "):
    token = auth_header[7:]
```

## Инъекция в request.state

- `request.state.user_id` — database PK (всегда есть для валидного токена)
- `request.state.telegram_id` — Telegram ID (None для email-only пользователей)

Downstream endpoints получают пользователя через `CurrentUser` dependency, которая читает из `request.state`.
