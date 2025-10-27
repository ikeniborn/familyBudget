# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

---

## Проект: Family Budget

Полнофункциональная система управления семейным бюджетом с Telegram Bot интерфейсом и веб-аналитикой.

**Версия:** 5.0.0-beta
**Архитектура:** FastAPI (Backend) + Telegram Bot + PostgreSQL + HTMX (Frontend)

---

## 🎯 Claude Skills

Для автоматизации типичных задач используй **Claude Skills** - специализированные инструкции и шаблоны кода:

📚 **[Полная документация по Skills](./SKILLS.md)**

### Доступные Skills:

| Skill | Описание | Когда использовать |
|-------|----------|-------------------|
| **[api-development](/.claude/skills/api-development/SKILL.md)** | Создание REST API endpoints | Создание CRUD endpoints, Pydantic схем, SCD Type 2 интеграция |
| **[db-management](/.claude/skills/db-management/SKILL.md)** | Управление БД и миграциями | Миграции Alembic, dimension модели, Closure Table, backup |
| **[testing](/.claude/skills/testing/SKILL.md)** | Тестирование и quality | Unit/integration/e2e тесты, coverage, linting |
| **[bot-development](/.claude/skills/bot-development/SKILL.md)** | Telegram bot команды | Простые команды, ConversationHandler, inline keyboards |
| **[deployment](/.claude/skills/deployment/SKILL.md)** | Deployment и DevOps | Production deploy, Docker управление, health checks |
| **[monitoring](/.claude/skills/monitoring/SKILL.md)** | Мониторинг и диагностика | Логи, performance, troubleshooting |

**Использование:**

```
Создай REST API endpoint для модели "Budget" используя api-development skill.
```

Claude автоматически вызовет нужный skill на основе запроса.

---

## Команды для разработки

### Быстрый старт

```bash
# Backend development server
cd backend && uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Telegram Bot (требует запущенный backend)
cd bot && python main.py

# Docker (production)
./deploy.sh --profile full
```

### Основные команды

**Docker управление:**
```bash
docker compose ps                    # Статус сервисов
docker compose logs -f backend       # Логи
docker compose restart backend       # Перезапуск
```

**База данных:**
```bash
alembic upgrade head                 # Применить миграции
alembic revision --autogenerate -m "Description"  # Создать миграцию
```

**Тестирование:**
```bash
pytest                               # Все тесты
pytest --cov=backend --cov-report=html  # С coverage
ruff check . && black . && mypy .    # Quality checks
```

### Production Environment (Docker)

**Рабочие каталоги:**
- `/opt/budget` - Production код (используется Docker контейнерами)
- `~/familyBudget` - Development код (для разработки)


**Применение изменений:**

1. **WebApp файлы** (bot/webapp/*.html, bot/webapp/static/*)
   - Монтируются как volume (read_only)
   - Изменения применяются **сразу** (без пересборки)
   - Но требуется очистка кэша браузера (Ctrl+F5)

2. **Python код** (backend/, bot/)
   - Требуется **пересборка образа** и **перезапуск контейнеров**
   ```bash
   cd /opt/budget
   ./deploy.sh --build --sync-mode skip
   ```

3. **Docker конфигурация** (docker-compose.yml, Dockerfile)
   - Требуется **пересборка** и **перезапуск**

**Логи контейнеров:**
```bash
# В production (рабочий каталог /opt/budget)
cd /opt/budget
docker compose logs -f backend       # Backend логи
docker compose logs -f bot           # Bot логи
docker compose logs --tail=100 backend  # Последние 100 строк

# Из любого каталога
docker compose -f /opt/budget/docker-compose.yml logs -f backend
docker exec familybudget-backend cat /app/logs/backend.log

# Все сервисы
docker compose -f /opt/budget/docker-compose.yml logs -f
```

**Проверка статуса:**
```bash
cd /opt/budget
docker compose ps                    # Статус всех контейнеров
docker compose ps backend            # Статус backend
docker exec familybudget-backend cat /app/bot/webapp/add.html | head -20  # Проверка файла в контейнере
```

📖 **Детальные инструкции:** См. соответствующие [Skills](#-claude-skills)

---

## Архитектура проекта

### Структура

```
familyBudget/
├── .claude/skills/      # Claude Skills для автоматизации
├── backend/             # FastAPI (REST API + Web UI)
│   ├── app/
│   │   ├── api/v1/endpoints/  # REST API endpoints
│   │   ├── models/            # SQLModel модели
│   │   ├── schemas/           # Pydantic схемы
│   │   ├── services/          # Бизнес-логика (SCD2, Hierarchy, JWT)
│   │   └── core/              # Config, auth, exceptions
│   └── db/migrations/   # Alembic миграции
├── bot/                 # Telegram Bot (python-telegram-bot 20.x)
│   ├── handlers/        # Command handlers
│   ├── utils/           # API client, session, validators
│   └── jobs/            # Background jobs
├── scripts/             # Automation (backup, SSL)
├── docker-compose.yml
└── deploy.sh            # Deployment script
```

### Ключевые технологии

**Backend:**
- FastAPI + SQLModel + PostgreSQL 16
- Async SQLAlchemy (asyncpg)
- JWT в httpOnly cookies
- HTMX для Web UI

**Bot:**
- python-telegram-bot 20.x
- ConversationHandler для multi-step команд
- API client для взаимодействия с backend

**Infrastructure:**
- Docker & Docker Compose
- UFW firewall
- Alembic для миграций

### Архитектурные паттерны

⚠️ **Критично важные паттерны:**

1. **SCD Type 2** для dimension таблиц
   - `t_d_user`, `t_d_article`, `t_d_financial_center`, `t_d_cost_center`
   - Полная история изменений: `valid_from`, `valid_to`, `is_current`
   - 📖 **Детали:** [db-management skill](/.claude/skills/db-management/SKILL.md)

2. **Closure Table** для иерархий
   - `t_d_article_hierarchy` - хранит все ancestor-descendant пары
   - O(1) сложность для иерархических запросов
   - 📖 **Детали:** [db-management skill](/.claude/skills/db-management/SKILL.md)

3. **User Data Isolation**
   - Каждый endpoint фильтрует по `current_user.id`
   - Используй `apply_user_filter()` или `WHERE user_id = current_user.id`
   - 📖 **Детали:** [api-development skill](/.claude/skills/api-development/SKILL.md)

4. **Telegram OAuth**
   - Аутентификация через Telegram с HMAC-SHA256
   - JWT tokens в httpOnly cookies (7 дней)
   - Bot использует `SessionManager` для хранения токенов

---

## Критически важная информация

### Security Guidelines (ОБЯЗАТЕЛЬНО)

✅ **ВСЕГДА делать:**

1. **User isolation** - фильтровать по `current_user.id`:
   ```python
   stmt = select(Model).where(Model.user_id == current_user.id)
   ```

2. **SCD Type 2** - использовать `SCD2Service` для updates:
   ```python
   from backend.app.services.scd2_service import create_new_version
   new_version = await create_new_version(session, old_instance, updates)
   ```

3. **Authentication** - использовать `CurrentUser` dependency:
   ```python
   from backend.app.core.dependencies import CurrentUser
   async def endpoint(current_user: CurrentUser):
       # endpoint code
   ```

4. **Validation** - использовать Pydantic схемы для всех inputs

❌ **НИКОГДА не делать:**

1. **Прямой UPDATE** для SCD Type 2 таблиц - ТОЛЬКО через `SCD2Service`
2. **Пропуск user_id фильтра** - ВСЕГДА проверяй user isolation
3. **Хранение JWT в localStorage** - ТОЛЬКО httpOnly cookies
4. **Прямая работа с Closure Table** - ТОЛЬКО через `HierarchyService`

📖 **Подробнее:** См. соответствующие [Skills](#-claude-skills)

---

## Быстрые ссылки на типичные задачи

| Задача | Где найти инструкцию |
|--------|---------------------|
| Создать REST API endpoint | [api-development skill](/.claude/skills/api-development/SKILL.md) |
| Создать миграцию БД | [db-management skill](/.claude/skills/db-management/SKILL.md) |
| Создать dimension таблицу | [db-management skill](/.claude/skills/db-management/SKILL.md) |
| Работа с SCD Type 2 | [db-management skill](/.claude/skills/db-management/SKILL.md) |
| Работа с Closure Table | [db-management skill](/.claude/skills/db-management/SKILL.md) |
| Создать unit тесты | [testing skill](/.claude/skills/testing/SKILL.md) |
| Запустить тесты с coverage | [testing skill](/.claude/skills/testing/SKILL.md) |
| Создать bot команду | [bot-development skill](/.claude/skills/bot-development/SKILL.md) |
| ConversationHandler | [bot-development skill](/.claude/skills/bot-development/SKILL.md) |
| Задеплоить на production | [deployment skill](/.claude/skills/deployment/SKILL.md) |
| Управление Docker сервисами | [deployment skill](/.claude/skills/deployment/SKILL.md) |
| Просмотр логов | [monitoring skill](/.claude/skills/monitoring/SKILL.md) |
| Troubleshooting | [monitoring skill](/.claude/skills/monitoring/SKILL.md) |
| Performance анализ | [monitoring skill](/.claude/skills/monitoring/SKILL.md) |

---

## Deployment (Quick Reference)

### Первоначальная установка

```bash
git clone <repo-url> ~/familyBudget && cd ~/familyBudget
sudo ./install.sh     # Системные зависимости (один раз)
./setup.sh            # Настройка .env
./deploy.sh           # Деплой
```

### Обновление кода

```bash
cd ~/familyBudget && git pull
./deploy.sh --sync-mode mirror
```

### Deployment опции

```bash
./deploy.sh --profile full          # Full stack (+ bot + nginx)
./deploy.sh --build                 # Rebuild images
./deploy.sh --sync-mode skip        # Deploy без синхронизации кода
```

📖 **Полное руководство:** [deployment skill](/.claude/skills/deployment/SKILL.md)

---

## База данных (Quick Reference)

### Структура

**Dimension таблицы (SCD Type 2):**
- `t_d_user` - Пользователи
- `t_d_article` - Категории (с иерархией)
- `t_d_financial_center` - Финансовые центры (ЦФО)
- `t_d_cost_center` - Центры затрат (МВЗ)

**Fact таблицы:**
- `t_f_budget_fact` - Транзакции (record_type: 'fact' | 'plan')
- `t_notification` - История уведомлений

**Иерархия:**
- `t_d_article_hierarchy` - Closure Table для категорий

### Основные сервисы

```python
# SCD Type 2
from backend.app.services.scd2_service import (
    create_new_version,
    get_current_version,
    has_changes
)

# Hierarchy (Closure Table)
from backend.app.services.hierarchy_service import HierarchyService
```

📖 **Детальное руководство:** [db-management skill](/.claude/skills/db-management/SKILL.md)

---

## Стиль кода и конвенции

**Python:**
- PEP 8, type hints обязательны
- Async/await для I/O
- Black (line length 100) + Ruff + mypy

**Naming:**
- Таблицы: `t_d_*` (dimension), `t_f_*` (fact)
- API endpoints: kebab-case (`/budget-facts`)
- Python: snake_case, SQLModel: PascalCase

**Commits:**
- Conventional Commits: `feat:`, `fix:`, `docs:`, etc.
- Co-Authored-By: Claude для Claude Code commits

---

## Дополнительные ресурсы

- **[SKILLS.md](./SKILLS.md)** - Comprehensive Skills guide
- **[README.md](./README.md)** - Полная документация проекта
- **[START.md](./START.md)** - Quick start guide
- **backend/README.md** - Backend документация
- **bot/README.md** - Bot документация

---

## Примеры использования Skills

### Пример 1: Новый feature (end-to-end)

```
Создай feature "Recurring Transactions":
1. Dimension таблица с SCD Type 2 (db-management)
2. REST API endpoint (api-development)
3. Unit и integration тесты (testing)
4. Bot команда /recurring (bot-development)
```

Claude автоматически использует нужные skills.

### Пример 2: Bug fix workflow

```
Backend медленно работает:
1. Проанализируй slow queries (monitoring)
2. Добавь indexes (db-management)
3. Оптимизируй код (api-development)
4. Создай performance тест (testing)
5. Задеплой hotfix (deployment)
```

### Пример 3: Production incident

```
Backend упал на production:
1. Диагностируй проблему (monitoring)
2. Проверь health всех сервисов (deployment)
3. Восстанови сервис (deployment)
```

---

## Важные напоминания

⚠️ **При разработке всегда:**

1. Используй **Claude Skills** для типичных задач (см. [таблицу выше](#-claude-skills))
2. Соблюдай **User Data Isolation** - фильтруй по `current_user.id`
3. Используй **SCD2Service** для dimension таблиц
4. Используй **HierarchyService** для работы с иерархиями
5. Добавляй **тесты** для всех новых features
6. Проверяй **security** - JWT, user isolation, validation
7. Проверяй **performance** - indexes, N+1 queries
8. Документируй **breaking changes**

💡 **Не уверен как сделать?** → Посмотри соответствующий [Skill](#-claude-skills)

---

**Версия документа:** 2.0 (оптимизированная)
**Последнее обновление:** 2025-10-22
**Формат:** Компактный + ссылки на Skills
