---
wiki_sources:
  - "backend/app/api/v1/endpoints/auth.py"
wiki_updated: 2026-05-06
wiki_status: mature
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "Auth API"
  - "Аутентификация API"
---

# Auth API — аутентификация (Telegram OAuth, Email+2FA, WebAuthn)

Набор FastAPI-эндпоинтов для аутентификации пользователей. Поддерживает три метода: Telegram OAuth, Email+Password+2FA и WebAuthn biometrics. Все токены хранятся в httpOnly cookies (защита от XSS), ротация refresh-токенов предотвращает replay-атаки.

## Основные характеристики

**Роутер:** `APIRouter(prefix="/auth", tags=["Authentication"])`

**Telegram OAuth:**
- `GET /auth/telegram-login` — страница с виджетом
- `GET /auth/telegram-callback` — callback виджета; rate limit 10/min; HMAC-SHA256 валидация; автосоздание пользователя-администратора при первом входе; обычные пользователи создаются с `is_active=False`
- `POST /auth/telegram` — API-эндпоинт для бота; NO автосоздание — пользователь должен существовать

**Email + 2FA:**
- `POST /auth/register` — регистрация; rate limit 3/hour; пользователь создаётся с `is_active=False`
- `POST /auth/login` — email+password; для admin → прямой AuthResponse (bypass 2FA); для user → `EmailLoginResponse` с `session_token` (5 мин TTL)
- `POST /auth/verify-2fa` — TOTP/backup code; на выходе JWT cookies
- `POST /auth/setup-and-verify-2fa` — первичная настройка 2FA при логине

**Управление 2FA (authenticated):**
- `POST /auth/setup-2fa` → `POST /auth/verify-2fa-setup` — настройка TOTP
- `POST /auth/disable-2fa` — отключение (требует пароль + TOTP код)
- `POST /auth/backup-codes` — генерация новых backup кодов

**Управление аккаунтом:**
- `POST /auth/add-email` — привязка email к Telegram-аккаунту
- `POST /auth/set-password` — установка/смена пароля
- `POST /auth/link-telegram` — привязка Telegram к email-аккаунту
- `GET /auth/methods?identifier=...` — identifier-first flow: какие методы доступны (telegram, email_password, webauthn)

**Token lifecycle:**
- `POST /auth/refresh` — ротация refresh-токена (старый отзывается); access_token: 7 дней, refresh_token: 30 дней
- `POST /auth/logout` — отзыв refresh-токена + очистка cookies

## Детали безопасности

- HMAC-SHA256 валидация Telegram init data
- Refresh-токены хранятся в БД в виде SHA-256 хеша (никогда plain-text)
- httpOnly + SameSite=Lax cookies; secure=True в production
- `hash_email_for_logging()` — PII не попадает в логи
- Admin bypass 2FA: администратор входит без TOTP
- Token rotation: `db_token.revoke()` + `mark_used()` перед созданием нового

## Зависимости

Зависит от: `validate_telegram_auth`, `create_access_token`, `create_refresh_token`, `hash_token`, `decode_refresh_token`, `hash_password`, `verify_password`, `verify_totp`, `generate_backup_codes`, `two_factor_session_service`.

## Связанные концепции

- [[реализация/services/auth-service.md]]
- [[реализация/middleware/jwt-middleware.md]]
- [[реализация/models/user.md]]
