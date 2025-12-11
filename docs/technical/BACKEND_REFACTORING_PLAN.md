# Backend Refactoring Plan

**Дата анализа:** 2025-12-09
**Версия:** 1.0
**Статус:** Draft
**Автор:** Claude Code Analysis

---

## Executive Summary

Анализ кодовой базы `backend/` выявил несколько областей для улучшения. Основные проблемы:
- Монолитный файл `admin.py` (2321 строк)
- Использование deprecated `datetime.utcnow()` (143 вызова)
- Inline Pydantic models в API файлах
- N+1 query problems в admin endpoints

**Общая оценка здоровья кода: 7.5/10**

---

## Table of Contents

1. [Критические проблемы](#1-критические-проблемы)
2. [Средний приоритет](#2-средний-приоритет)
3. [Низкий приоритет](#3-низкий-приоритет)
4. [План выполнения](#4-план-выполнения)
5. [Acceptance Criteria](#5-acceptance-criteria)
6. [Риски и митигация](#6-риски-и-митигация)

---

## 1. Критические проблемы

### 1.1 Разделение admin.py на модули

**Файл:** `backend/app/api/v1/admin.py`
**Текущий размер:** 2321 строк, 25+ endpoints
**Приоритет:** 🔴 Critical

#### Проблема

Один файл смешивает несколько доменов:
- User Management (CRUD, activate, deactivate, merge) - строки 145-1238
- Article Management (CRUD, archive/restore) - строки 1240-1905
- Facts Management (CRUD, batch delete) - строки 1908-2321
- System Settings (timezone) - строки 89-142

#### Решение

Разделить на модульную структуру:

```
backend/app/api/v1/admin/
├── __init__.py           # Router aggregation
├── users.py              # User management (15 endpoints)
├── articles.py           # Article management (4 endpoints)
├── facts.py              # Facts management (5 endpoints)
└── system.py             # System settings (1 endpoint)
```

#### Детальный план

**Шаг 1: Создать структуру директории**
```bash
mkdir -p backend/app/api/v1/admin
touch backend/app/api/v1/admin/__init__.py
```

**Шаг 2: Создать admin/users.py**
- Перенести endpoints: `get_all_users`, `get_user_by_id`, `create_user`, `update_user_role`, `activate_user`, `deactivate_user`, `reset_user_password`, `reset_user_2fa`, `refresh_user_profile_from_telegram`, `merge_users`, `get_telegram_user_info`, `get_users_stats`, `get_user_history`
- Перенести schemas: `UserStatsResponse`
- Импорты на уровне модуля

**Шаг 3: Создать admin/articles.py**
- Перенести endpoints: `get_all_articles`, `create_article`, `update_article`, `delete_article`
- Импорты на уровне модуля

**Шаг 4: Создать admin/facts.py**
- Перенести endpoints: `get_all_facts`, `get_facts_count`, `update_fact`, `delete_fact`, `batch_delete_facts`
- Перенести schemas: `FactResponse`, `FactUpdateRequest`
- Импорты на уровне модуля

**Шаг 5: Создать admin/system.py**
- Перенести endpoints: `get_system_timezone`, `get_system_stats`
- Перенести schemas: `SystemTimezoneResponse`
- Импорты на уровне модуля

**Шаг 6: Обновить admin/__init__.py**
```python
from fastapi import APIRouter
from backend.app.api.v1.admin import users, articles, facts, system

router = APIRouter(prefix="/admin", tags=["Admin"])

router.include_router(users.router)
router.include_router(articles.router)
router.include_router(facts.router)
router.include_router(system.router)
```

**Шаг 7: Обновить v1/router.py**
```python
# Заменить
from backend.app.api.v1.admin import router as admin_router
# На
from backend.app.api.v1.admin import router as admin_router
```

**Шаг 8: Удалить старый admin.py**
```bash
rm backend/app/api/v1/admin.py
```

**Шаг 9: Тестирование**
```bash
# Проверить все admin endpoints
pytest tests/integration/test_admin_endpoints.py -v
pytest tests/endpoints/ -k admin -v

# Проверить что API docs работают
curl http://localhost:8000/docs
```

#### Оценка времени
- Создание файлов: 1 час
- Перенос кода: 1-1.5 часа
- Тестирование: 30 минут
- **Итого: 2.5-3 часа**

---

### 1.2 Замена deprecated datetime.utcnow()

**Проблема:** 143 вызова `datetime.utcnow()` в 43 файлах
**Приоритет:** 🔴 Critical (Python 3.12+ deprecation warning)

#### Решение

**Шаг 1: Создать утилиту**

Создать файл `backend/app/utils/datetime_utils.py`:
```python
"""
Datetime utilities for timezone-aware operations.

Python 3.12+ deprecates datetime.utcnow() in favor of
datetime.now(timezone.utc) for explicit timezone handling.
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """
    Return current UTC time as timezone-aware datetime.

    Replacement for deprecated datetime.utcnow().

    Returns:
        datetime: Current UTC time with tzinfo=timezone.utc

    Example:
        >>> from backend.app.utils.datetime_utils import utcnow
        >>> now = utcnow()
        >>> now.tzinfo
        datetime.timezone.utc
    """
    return datetime.now(timezone.utc)


def utcnow_naive() -> datetime:
    """
    Return current UTC time as naive datetime (no timezone).

    Use only for backward compatibility with existing code
    that expects naive datetimes.

    Returns:
        datetime: Current UTC time without tzinfo

    Note:
        Prefer utcnow() for new code.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
```

**Шаг 2: Массовая замена**

```bash
# Найти все вхождения
grep -rn "datetime.utcnow()" backend/app/ --include="*.py"

# Замена в app/ (основной код)
# Использовать utcnow_naive() для сохранения текущего поведения
sed -i 's/datetime\.utcnow()/utcnow_naive()/g' backend/app/**/*.py

# Добавить импорт в начало файлов
# (Ручная работа или скрипт)
```

**Шаг 3: Обновить импорты**

В каждом файле добавить:
```python
from backend.app.utils.datetime_utils import utcnow_naive
```

**Шаг 4: Тестирование**
```bash
pytest tests/ -v
python -c "from backend.app.main import app; print('OK')"
```

#### Файлы для обновления (топ-10 по количеству)

| Файл | Количество | Приоритет |
|------|------------|-----------|
| `tests/services/test_jwt.py` | 12 | Tests |
| `tests/integration/test_user_isolation.py` | 10 | Tests |
| `admin.py` | 7 | Critical |
| `tests/endpoints/test_articles.py` | 6 | Tests |
| `services/auth_service.py` | 5 | Critical |
| `models/article_history.py` | 5 | Critical |
| `endpoints/facts.py` | 5 | Critical |
| `services/jwt.py` | 4 | Critical |
| `endpoints/auth.py` | 4 | Critical |
| `admin_analytics.py` | 4 | Medium |

#### Оценка времени
- Создание утилиты: 15 минут
- Массовая замена: 30 минут
- Обновление импортов: 30 минут
- Тестирование: 30 минут
- **Итого: 1.5-2 часа**

---

## 2. Средний приоритет

### 2.1 Вынос inline Pydantic models в schemas/

**Проблема:** 8 Pydantic классов определены в API файлах

| Файл | Класс | Куда перенести |
|------|-------|----------------|
| `admin.py:67` | `UserStatsResponse` | `schemas/admin.py` |
| `admin.py:89` | `SystemTimezoneResponse` | `schemas/admin.py` |
| `admin.py:1912` | `FactResponse` | `schemas/admin.py` |
| `admin.py:1933` | `FactUpdateRequest` | `schemas/admin.py` |
| `health.py:33` | `HealthStatus` | `schemas/health.py` |
| `health.py:41` | `ComponentHealth` | `schemas/health.py` |
| `health.py:49` | `DetailedHealthResponse` | `schemas/health.py` |
| `health.py:60` | `ReadinessResponse` | `schemas/health.py` |

#### План

**Шаг 1:** Создать `backend/app/schemas/health.py`
**Шаг 2:** Перенести классы из health.py
**Шаг 3:** Расширить `backend/app/schemas/admin.py`
**Шаг 4:** Обновить импорты в API файлах
**Шаг 5:** Тестирование

#### Оценка времени: 1 час

---

### 2.2 Оптимизация N+1 запросов в admin stats

**Файл:** `backend/app/api/v1/admin.py:264-318`

**Текущий код (N+1 problem):**
```python
for user in users:  # N users
    facts_count = await session.execute(...)      # +1
    articles_count = await session.execute(...)   # +1
    last_fact = await session.execute(...)        # +1
```

**Оптимизированный код:**
```python
# Один агрегированный запрос
stats_query = select(
    User.id,
    User.username,
    User.first_name,
    func.count(distinct(Fact.id)).label("total_facts"),
    func.count(distinct(Article.id)).filter(Article.user_id == User.id).label("total_articles"),
    func.max(Fact.fact_date).label("last_fact_date")
).select_from(User).outerjoin(
    Fact, Fact.user_id == User.id
).group_by(User.id, User.username, User.first_name)

result = await session.execute(stats_query)
stats = [
    UserStatsResponse(
        user_id=row.id,
        username=row.username,
        first_name=row.first_name,
        total_facts=row.total_facts or 0,
        total_articles=row.total_articles or 0,
        last_fact_date=row.last_fact_date.isoformat() if row.last_fact_date else None
    )
    for row in result.all()
]
```

#### Оценка времени: 1-1.5 часа

---

### 2.3 Вынос HTML из analytics.py в Jinja2 шаблоны

**Файл:** `backend/app/api/v1/analytics.py:443-614`
**Проблема:** 170+ строк inline HTML

#### План

**Шаг 1:** Создать шаблон `frontend/web/templates/partials/quick_stats.html`
**Шаг 2:** Передать данные в шаблон
**Шаг 3:** Использовать `templates.TemplateResponse()`

#### Оценка времени: 1.5 часа

---

### 2.4 Рефакторинг inline imports

**Файл:** `backend/app/api/v1/admin.py`
**Проблема:** 20+ imports внутри функций

#### Анализ причин

```python
# admin.py:116 - Circular import avoidance
from backend.app.core.config import get_settings

# admin.py:1773 - Lazy loading
from backend.app.models.hierarchy import ArticleHierarchy
```

#### План

**Шаг 1:** Проанализировать dependency graph
**Шаг 2:** Выявить circular imports
**Шаг 3:** Реорганизовать imports через:
  - Перенос функций в другие модули
  - Использование TYPE_CHECKING для type hints
  - Создание interface modules

#### Оценка времени: 3-4 часа (требует анализа)

---

## 3. Низкий приоритет

### 3.1 Очистка scd2_service.py

**Статус:** Частично устаревший после миграции на SCD Type 1 + History

**Используемые функции:**
- `has_changes()` - активно используется ✅
- `FAR_FUTURE_DATETIME` - активно используется ✅

**Неиспользуемые функции (кандидаты на удаление):**
- `create_new_version()` - старая логика SCD2
- `get_current_version()` - не используется
- `get_version_at_date()` - не используется
- `get_history()` - заменено на History tables
- `validate_scd2_instance()` - старая валидация
- `verify_no_concurrent_update()` - не используется

#### План

**Шаг 1:** Подтвердить неиспользование через grep
**Шаг 2:** Удалить неиспользуемые функции
**Шаг 3:** Переименовать файл в `version_utils.py`

#### Оценка времени: 30 минут

---

### 3.2 Создание stats_service.py

**Проблема:** Дублирование логики подсчёта в admin.py и analytics.py

#### План

Создать `backend/app/services/stats_service.py`:
```python
async def get_total_users_count(session: AsyncSession) -> int:
    ...

async def get_total_facts_count(session: AsyncSession, user_id: int = None) -> int:
    ...

async def get_total_articles_count(session: AsyncSession) -> int:
    ...

async def get_user_stats(session: AsyncSession, user_id: int) -> UserStats:
    ...

async def get_system_stats(session: AsyncSession) -> SystemStats:
    ...
```

#### Оценка времени: 2 часа

---

## 4. План выполнения

### Фаза 1: Критические (Неделя 1-2)

| # | Задача | Оценка | Зависимости |
|---|--------|--------|-------------|
| 1.1 | Разделить admin.py | 3 часа | - |
| 1.2 | Заменить datetime.utcnow() | 2 часа | - |

**Milestone:** Устранены критические проблемы

### Фаза 2: Средний приоритет (Неделя 3-4)

| # | Задача | Оценка | Зависимости |
|---|--------|--------|-------------|
| 2.1 | Вынос Pydantic models | 1 час | 1.1 |
| 2.2 | Оптимизация N+1 | 1.5 часа | 1.1 |
| 2.3 | HTML в Jinja2 | 1.5 часа | - |
| 2.4 | Inline imports | 4 часа | 1.1 |

**Milestone:** Улучшена структура кода

### Фаза 3: Низкий приоритет (Опционально)

| # | Задача | Оценка | Зависимости |
|---|--------|--------|-------------|
| 3.1 | Очистка scd2_service | 30 мин | - |
| 3.2 | Создание stats_service | 2 часа | 2.2 |

**Milestone:** Минимизирован технический долг

---

## 5. Acceptance Criteria

### Фаза 1

- [ ] admin.py разделён на 4 файла (users.py, articles.py, facts.py, system.py)
- [ ] Все admin endpoints работают (проверить через /docs)
- [ ] Все тесты проходят (`pytest tests/`)
- [ ] Нет использования `datetime.utcnow()` в app/ (кроме tests/)
- [ ] Создан `utils/datetime_utils.py` с документацией

### Фаза 2

- [ ] Все Pydantic models в schemas/
- [ ] N+1 запросы оптимизированы (1 запрос вместо N*3)
- [ ] HTML вынесен в Jinja2 шаблоны
- [ ] Не более 5 inline imports в любом API файле

### Фаза 3

- [ ] scd2_service.py содержит только используемые функции
- [ ] Создан stats_service.py с переиспользуемыми методами

---

## 6. Риски и митигация

### Риск 1: Breaking Changes в API

**Вероятность:** Низкая
**Влияние:** Высокое

**Митигация:**
- Сохранить все URL endpoints неизменными
- Тестировать через curl/Postman после каждого изменения
- Не менять response schemas

### Риск 2: Регрессии в тестах

**Вероятность:** Средняя
**Влияние:** Среднее

**Митигация:**
- Запускать полный test suite после каждого шага
- Использовать feature branches
- Code review перед merge

### Риск 3: Circular Imports после рефакторинга

**Вероятность:** Средняя
**Влияние:** Высокое (приложение не запустится)

**Митигация:**
- Проверять `python -c "from backend.app.main import app"` после изменений
- Использовать TYPE_CHECKING для type hints
- Документировать dependency graph

---

## Appendix A: Команды для проверки

```bash
# Проверка приложения
python -c "from backend.app.main import app; print('OK')"

# Запуск тестов
pytest tests/ -v

# Проверка deprecated datetime
grep -rn "datetime.utcnow()" backend/app/ --include="*.py" | wc -l

# Проверка inline models
grep -rn "class.*BaseModel" backend/app/api/ --include="*.py"

# Проверка inline imports
grep -n "^\s\+from\s" backend/app/api/v1/admin.py | wc -l

# Проверка API docs
curl http://localhost:8000/docs -I
```

---

## Appendix B: Структура после рефакторинга

```
backend/app/
├── api/
│   ├── v1/
│   │   ├── admin/              # NEW: Модульная структура
│   │   │   ├── __init__.py
│   │   │   ├── users.py
│   │   │   ├── articles.py
│   │   │   ├── facts.py
│   │   │   └── system.py
│   │   ├── endpoints/
│   │   └── ...
│   └── health.py
├── schemas/
│   ├── admin.py                # UPDATED: + inline models
│   ├── health.py               # NEW: health schemas
│   └── ...
├── services/
│   ├── stats_service.py        # NEW: shared stats queries
│   └── ...
└── utils/
    ├── datetime_utils.py       # NEW: timezone-aware utils
    └── ...
```

---

## Changelog

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 2025-12-09 | Initial analysis and plan |
