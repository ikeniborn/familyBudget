---
wiki_sources:
  - "backend/app/services/auth_service.py"
  - "backend/app/services/jwt.py"
  - "backend/app/services/password_service.py"
  - "backend/app/services/telegram_auth.py"
wiki_updated: 2026-05-06
wiki_status: developing
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "Auth Service"
---

# Auth Service — сервисный слой аутентификации

Набор сервисных функций для аутентификации и управления пользователями. Содержит три основных модуля: `auth_service.py` (lookups, email auth), `jwt.py` (JWT tokens), `password_service.py` (Argon2id хеширование).

## Основные характеристики

### auth_service.py — User lookups и email-аутентификация

- `get_user_by_telegram_id(session, telegram_id)` — поиск по Telegram ID; не создаёт пользователей (security critical)
- `get_user_by_email(session, email)` — поиск по email (lower-cased)
- `get_user_by_id(session, user_id)` — поиск по суррогатному ключу
- `authenticate_with_password(session, email, password)` — timing-safe: всегда вызывает `verify_password_with_dummy()` даже если пользователь не найден
- `add_email_to_user(session, user, email)` → bool
- `link_telegram_to_user(session, user, telegram_id, ...)` → bool
- `set_user_password(session, user, password)`

Обновление профиля (`update_user_profile`) и история (`create_initial_history`, `get_user_history`) вынесены в `user_service.py`.

### jwt.py — JWT tokens

**Алгоритм:** HS256 (HMAC SHA-256), ключ из `settings.JWT_SECRET`

- `create_access_token(user_id, telegram_id)` → str; TTL = `JWT_EXPIRE_DAYS` (default 7 дней); claims: `user_id`, `telegram_id`, `exp`, `iat`
- `create_refresh_token(user_id)` → (token_str, expires_datetime); TTL = 30 дней; claims: `user_id`, `token_type="refresh"`, `exp`, `iat`
- `decode_refresh_token(token)` → user_id | None
- `hash_token(token)` → SHA-256 hex; используется перед сохранением в БД

**Примечание:** `telegram_id` включён в access_token как stable business key для SCD Type 2 совместимости.

### password_service.py — Argon2id хеширование

- `hash_password(password)` → argon2 hash
- `verify_password(password, hash)` → bool
- `verify_password_with_dummy(password, hash | None)` — always runs argon2 even if hash=None (prevents timing attacks)
- `validate_password_strength(password)` → (is_strong: bool, error_message: str)

## Связанные концепции

- [[реализация/api/auth-endpoint.md]]
- [[реализация/middleware/jwt-middleware.md]]
- [[реализация/models/user.md]]
