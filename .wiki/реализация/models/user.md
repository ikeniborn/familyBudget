---
wiki_sources:
  - "backend/app/models/user.py"
wiki_updated: 2026-05-06
wiki_status: mature
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "User Model"
  - "Модель User"
---

# User — модель пользователя (SCD Type 1 + History)

SQLModel модель для хранения текущих данных пользователя. Использует паттерн SCD Type 1: обновления in-place (без версионирования в основной таблице). Полная история изменений хранится в отдельной таблице `t_d_user_history` (SCD Type 2).

## Основные характеристики

**Таблица:** `t_d_user`
**Паттерн:** SCD Type 1 (текущие данные) + отдельная history table (SCD Type 2)

**Ключевые поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | int PK | Суррогатный ключ — НИКОГДА не меняется |
| `telegram_id` | BigInteger nullable | Business key (nullable для email-only юзеров) |
| `email` | str(320) nullable | Уникальный через partial index (nullable для Telegram-only) |
| `password_hash` | str nullable | Argon2id hash (required для email auth) |
| `two_factor_secret` | str(64) nullable | TOTP base32 secret |
| `two_factor_enabled` | bool | Обязателен для email login |
| `backup_codes` | str nullable | JSON массив Argon2-хешированных backup кодов |
| `username` | str nullable | Telegram username (SCD1 — in-place) |
| `first_name` | str nullable | (SCD1 — in-place) |
| `last_name` | str nullable | (SCD1 — in-place) |
| `photo_url` | str nullable | Локальный путь к кэшированному фото |
| `is_admin` | bool | Флаг администратора |
| `is_active` | bool default=False | Требует активации администратором |
| `last_login_at` | datetime nullable | |
| `created_at` | datetime | Иммутабельный |
| `updated_at` | datetime | Авто-обновляется |

**Constraint:** `chk_user_has_auth_method` — `telegram_id IS NOT NULL OR email IS NOT NULL`
**Partial unique index:** `ix_t_d_user_email_unique` — unique по email, только для non-null значений

## Методы аутентификации

1. Telegram OAuth only (`telegram_id NOT NULL, email NULL`)
2. Email + Password + 2FA (`telegram_id NULL, email NOT NULL`)
3. Оба (`telegram_id NOT NULL, email NOT NULL`)

## Lifecycle

- Новые пользователи создаются с `is_active=False` — требуют активации admin
- Исключение: admin-пользователь (`telegram_id == ADMIN_TELEGRAM_ID`) создаётся с `is_active=True`
- Обновление профиля → `user_service.update_user_profile()` → создаёт UserHistory запись
- `last_login_at` обновляется напрямую (без UserHistory) — audit trail, не бизнес-данные

## Связанные концепции

- [[реализация/models/budget-fact.md]]
- [[реализация/services/auth-service.md]]
- [[реализация/services/scd2-service.md]]
- [[реализация/middleware/jwt-middleware.md]]
