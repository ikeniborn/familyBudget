---
wiki_sources:
  - "backend/README.md"
wiki_updated: 2026-05-05
wiki_status: developing
tags:
  - FastAPI
  - SQLModel
  - Pydantic
  - uvicorn
  - JWT
  - asyncpg
aliases:
  - "FastAPI app structure"
  - "backend structure"
  - "структура backend"
---

# FastAPI — структура приложения

FastAPI-приложение Family Budget организовано по модульному принципу: маршруты, сервисы, модели и middleware разделены. Точка входа — `backend/app/main.py`. API доступен по `/api/v1/`, документация — `/docs` (Swagger) и `/redoc` (ReDoc).

## Основные характеристики

### Структура директорий

```
backend/
├── app/
│   ├── main.py              # точка входа FastAPI
│   ├── api/v1/router.py     # роутер API v1
│   ├── core/
│   │   ├── config.py        # настройки (Pydantic Settings)
│   │   └── dependencies.py  # зависимости (DB, auth)
│   ├── models/              # SQLModel модели
│   ├── schemas/             # Pydantic схемы валидации
│   ├── services/            # бизнес-логика
│   ├── middleware/          # кастомный middleware
│   └── db/session.py        # управление сессиями БД
├── db/migrations/           # Alembic миграции
└── tests/                   # тесты
```

### Технический стек

| Компонент | Библиотека |
|-----------|-----------|
| Framework | FastAPI 0.109+ |
| ORM | SQLModel 0.0.14 |
| DB драйвер | asyncpg (асинхронный) |
| Сериализация | Pydantic |
| Auth | python-jose (JWT) |
| Telegram | python-telegram-bot 20.7+ |
| Тестирование | pytest, pytest-asyncio, httpx |

### Ключевые API endpoints

**Аутентификация:**
- `POST /api/v1/auth/telegram` — Telegram OAuth login

**Факты (транзакции):**
- `GET/POST /api/v1/facts` — список / создание
- `GET /api/v1/facts/{id}` — детали
- `PUT /api/v1/facts/{id}` — обновление
- `DELETE /api/v1/facts/{id}` — удаление

**Статьи (категории):**
- `GET/POST /api/v1/articles` — список / создание
- `GET /api/v1/articles/{id}/subtree` — иерархия (Closure Table)

**Пользователи:**
- `GET /api/v1/users` — список (только admin)
- `GET /api/v1/users/me` — текущий пользователь

### Переменные окружения

| Переменная | Назначение |
|-----------|-----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Секрет для подписи JWT |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота |
| `CORS_ORIGINS` | Разрешённые CORS-источники |

### Запуск сервера

```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

Сервис доступен на: `http://localhost:8000`

## Связанные концепции

- [[аутентификация]]
- [[alembic-миграции]] <!-- TODO: создать страницу -->

