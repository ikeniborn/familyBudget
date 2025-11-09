# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Проект: Family Budget

Полнофункциональная система управления семейным бюджетом с Telegram Bot интерфейсом и веб-аналитикой.

**Версия:** 5.0.0-beta
**Архитектура:** FastAPI (Backend) + Telegram Bot + PostgreSQL + HTMX (Frontend)
**Язык документации:** Русский (ru)

---

## 🎯 Быстрый старт для Claude Code

### Команды для разработки

```bash
# Backend dev server (из корня проекта!)
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Telegram Bot (требует backend)
cd bot && python main.py

# Docker (production) - ТОЛЬКО из git repository!
cd ~/familyBudget && ./deploy.sh --profile full

# Alembic миграции
cd backend/db/migrations
alembic upgrade head    # Применить
alembic current         # Текущая ревизия

# Полный сброс БД (⚠️ УДАЛИТ ВСЕ ДАННЫЕ!)
docker compose down -v && docker compose up -d

# Тестирование
pytest -m unit                    # Быстрые тесты
pytest -m integration             # С БД
pytest --cov=backend --cov-report=html  # Coverage
```

---

## 🏗️ npm Окружение (Production)

**Расположение:** `/opt/budget/.npm-isolated/` - НЕ копируется при deploy

**Защита от удаления:** `rsync --filter='protect .npm-isolated/'` в scripts/lib/sync.sh

```bash
sudo ./install.sh  # Установка (233 пакета)
```

---

## 🧪 Тестирование

```bash
pytest -m unit          # Быстрые (моки)
pytest -m integration   # С БД
pytest -m e2e           # Full stack
pytest --cov=backend --cov-report=html  # Coverage
ruff check . && black . && mypy .       # Quality
```

**Markers:** `@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.slow`

**Ключевые файлы:**
- `backend/app/main.py:39-96` - Lifespan + scheduler
- `backend/app/services/scd2_service.py` - SCD Type 2
- `backend/app/services/hierarchy_service.py` - Closure Table
- `bot/handlers/add.py` - ConversationHandler

---

## 🚀 Deployment Модули (scripts/lib/)

**17+ модулей в 3 фазах загрузки:**

**Phase 1 (Core):** config.sh, utils.sh, validation.sh, status.sh
**Phase 2 (Services):** postgres.sh, services.sh, migrations.sh, firewall.sh
**Phase 3 (Complex):** sync.sh, cache_busting.sh, docker.sh, network.sh, ssl.sh

**Модульная архитектура** - каждый модуль независим, переиспользуется между install.sh/setup.sh/deploy.sh

**КРИТИЧНО:** deploy.sh ТОЛЬКО из git repo (`~/familyBudget`), НЕ из `/opt/budget`

---

## 🏗️ Архитектура Backend (Layered)

**Request Flow:** Middleware → Router → Endpoint → Service → Model

**Слои:**
- **Middleware** (`jwt_middleware.py`) - JWT auth, logging, CSP
- **Router** (`api/v1/router.py`) - URL routing
- **Endpoint** (`endpoints/*.py`) - HTTP handlers
- **Service** (`services/*.py`) - Business logic (SCD2, Hierarchy, JWT)
- **Model** (`models/*.py`) - SQLModel ORM
- **Schema** (`schemas/*.py`) - Pydantic validation

---

## ⚠️ Критически важные паттерны

### 1. SCD Type 2 (Slowly Changing Dimension)

**Назначение:** Полная история изменений с версионированием

**Таблицы:** `t_d_user`, `t_d_article`, `t_d_financial_center`, `t_d_cost_center`

**Алгоритм (scd2_service.py):**
1. Close old version: `is_current=False, valid_to=now`
2. Create new version: `valid_from=now, is_current=True`
3. Atomic commit

```python
# ✅ ПРАВИЛЬНО
from backend.app.services.scd2_service import create_new_version
new_article = await create_new_version(session, old_article, updates)

# ❌ НЕПРАВИЛЬНО - потеря истории
article.name = "New Name"
await session.commit()
```

### 2. Closure Table (иерархии категорий)

**Назначение:** Эффективные иерархические запросы O(1)

**Таблица:** `t_d_article_hierarchy` - все ancestor-descendant пары (precomputed)

```python
# ✅ ПРАВИЛЬНО - hierarchy_service.py
from backend.app.services.hierarchy_service import get_subtree, get_ancestors
children = await get_subtree(session, parent_id, include_self=False)
path = await get_ancestors(session, article_id)

# ❌ НЕПРАВИЛЬНО - рекурсия (O(N), N+1 queries)
def get_children_recursive(parent_id): ...
```

---

### 3. Shared Family Budget Model

**АРХИТЕКТУРНОЕ РЕШЕНИЕ:** Fact таблицы **SHARED** (НЕ isolated)

**Правила:**
- Все пользователи видят ВСЕ транзакции
- Любой может создавать/редактировать/удалять
- `user_id` только для audit trail
- БЕЗ фильтрации по `user_id` в queries
- БЕЗ ownership checks

```python
# ✅ ПРАВИЛЬНО
statement = select(BudgetFact)  # NO user_id filter
fact = BudgetFact(**data, user_id=current_user.id)  # Audit only

# ❌ НЕПРАВИЛЬНО
statement = select(BudgetFact).where(
    BudgetFact.user_id == current_user.id  # WRONG!
)
if fact.user_id != current_user.id:  # WRONG!
    raise HTTPException(403)
```

**Обоснование:** ПРД - семейная прозрачность (2-5 человек)

---

### 4. Shared References (Dimension Tables)

**Правила:**
- **CREATE/UPDATE/DELETE:** Только админы
- **READ:** Все пользователи
- БЕЗ user_id фильтрации
- `user_id` только для audit trail

**Таблицы:** `t_d_article`, `t_d_financial_center`, `t_d_cost_center`

```python
# ✅ ПРАВИЛЬНО
@router.post("/articles")
async def create_article(data: ArticleCreate, current_user: CurrentUser):
    if not current_user.is_admin:
        raise HTTPException(403)
    article = Article(**data, user_id=current_user.id)  # Audit

@router.get("/articles")
async def list_articles(session: AsyncSession):
    return await session.exec(
        select(Article).where(Article.is_current == True)
    ).all()  # NO user_id filter

# ❌ НЕПРАВИЛЬНО
stmt = select(Article).where(Article.user_id == current_user.id)  # WRONG!
```

---

### 5. Archived Categories (is_active флаг)

**Правила:**
- Архивация **рекурсивная** (parent + все descendants)
- Архивные **видны в аналитике** с badge "(архив)"
- `is_active` изменения **НЕ создают SCD Type 2 версию**

```python
# ✅ ПРАВИЛЬНО - hierarchy_service.py
from backend.app.services.hierarchy_service import archive_recursive
count = await archive_recursive(session, article_id)  # Recursively archives

# Фильтрация в dropdowns
if not include_inactive:
    statement = statement.where(Article.is_active == True)
```

**Обоснование НЕ SCD2:** is_active - это UI visibility, НЕ бизнес-данные

---

## 🛡️ Security Guidelines

### Authentication

**ВСЕГДА используй `CurrentUser` dependency:**

```python
from backend.app.core.dependencies import CurrentUser

@router.get("/facts")
async def list_facts(current_user: CurrentUser):
    # current_user.id, .is_admin, .telegram_id
    pass
```

**Flow:** JWT cookie → `jwt_middleware.py` → `request.state.user` → `CurrentUser`

### Validation

**ВСЕГДА используй Pydantic схемы:**

```python
class FactCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    fact_date: date

    @field_validator('fact_date')
    def validate_not_future(cls, v):
        if v > date.today():
            raise ValueError("Cannot be future")
        return v
```

---

## 🔧 Troubleshooting

### Import Errors
```python
# ❌ НЕПРАВИЛЬНО
from app.models.article import Article

# ✅ ПРАВИЛЬНО - absolute imports
from backend.app.models.article import Article
```

### Docker Network Conflicts
```bash
./deploy.sh  # Выбрать: [2] Smart cleanup
```

### JWT Token не работает
```bash
# Проверка
grep JWT_SECRET /opt/budget/.env  # 64 hex chars

# Решение
openssl rand -hex 32  # Новый secret
nano /opt/budget/.env
docker compose restart backend
```

### Cache Busting
**Автоматически:** при `./deploy.sh` → `scripts/lib/cache_busting.sh auto`

**НЕ редактируй** `?v=` версии вручную!

### Database Migration Errors
```bash
# Сброс БД (⚠️ УДАЛИТ ВСЕ ДАННЫЕ!)
docker compose down -v && docker compose up -d
```

---

## 🗂️ Структура проекта

```
familyBudget/
├── backend/app/
│   ├── api/v1/endpoints/    # REST API (facts, articles, auth, analytics)
│   ├── models/              # SQLModel ORM (article, fact, user, hierarchy)
│   ├── schemas/             # Pydantic validation
│   ├── services/            # Business logic (scd2, hierarchy, jwt, telegram_auth)
│   ├── middleware/          # JWT auth, logging, CSP
│   ├── core/                # Config, dependencies, auth helpers
│   ├── db/migrations/       # Alembic migrations
│   └── main.py              # FastAPI app + scheduler
├── bot/
│   ├── handlers/            # Command handlers (/start, /add, /summary)
│   ├── utils/               # API client, SessionManager, notifications
│   └── main.py
├── frontend/
│   ├── webapp/              # Telegram Web Apps (8 HTML forms + 7 JS modules)
│   ├── web/                 # Web UI (HTMX + Jinja2 templates)
│   └── shared/              # Shared JS/CSS modules
├── tests/                   # unit/ integration/ e2e/
├── scripts/lib/             # 17+ deployment modules
└── deploy.sh, setup.sh, install.sh
```

---

## 📦 Tech Stack

**Backend:** FastAPI 0.109, SQLModel 0.0.14, asyncpg 0.29, Alembic 1.13, python-telegram-bot 20.7, APScheduler 3.10

**Frontend Web Apps:** Vanilla ES6+ (7 modules: app, api, auth, ui, validators, theme, storage) - ~190KB bundle

**Testing:** pytest, pytest-asyncio, pytest-cov, black, ruff, mypy

**Infrastructure:** Docker, PostgreSQL 16, Nginx, UFW

---

## 📋 Database Management (Alembic v2.0)

**СТАТУС:** Alembic-Only с 2025-11-09 (schema/*.sql → DEPRECATED)

```
backend/db/
├── migrations/           # Alembic (CURRENT)
│   ├── versions/        # Migration files
│   └── archive/         # Old migrations
└── deprecated/schema/   # DO NOT USE
```

---

### sql/ vs Alembic

**КРИТИЧНО:**
- **Alembic** - DDL (CREATE/ALTER TABLE, INDEX, PARTITION)
- **sql/queries/** - DML (INSERT данных из CSV)

**НЕ смешивай:** DDL в sql/ вызовет конфликты партиций

---

### Процесс изменения БД

**Создание миграции:**
```bash
cd backend/db/migrations
alembic revision -m "add_table"
# ИЛИ autogenerate
alembic revision --autogenerate -m "sync_model"

# Редактировать
nano versions/YYYYMMDD_*.py

# Тестировать (ВАЖНО!)
alembic upgrade head && alembic downgrade -1 && alembic upgrade head

# Коммит
git add versions/*.py && git commit -m "feat(db): ..."
```

**Применение:**
```bash
# Dev
alembic upgrade head

# Production
cd ~/familyBudget && ./deploy.sh --migrations-only
```

**Откат:**
```bash
alembic downgrade -1  # Последняя
alembic downgrade -2  # 2 миграции
```

### Best Practices

✅ **ВСЕГДА:**
- Тестируй upgrade + downgrade + upgrade
- Пиши полный downgrade() (не `pass`)
- Используй описательные имена

❌ **НИКОГДА:**
- НЕ редактируй примененные миграции
- НЕ используй deprecated schema/
- НЕ пропускай миграции (только `alembic upgrade head`)

---

## 🚀 Deployment

### Первоначальная установка
```bash
cd ~/familyBudget
sudo ./install.sh    # Docker, UFW
./setup.sh           # .env configuration
./deploy.sh --profile full
```

### Обновление
```bash
cd ~/familyBudget && git pull
./deploy.sh --profile full  # Полный деплой (~3 мин)
```

### Варианты деплоя

| Сценарий | Команда | Время |
|----------|---------|-------|
| **Новая миграция БД** | `--migrations-only` | ~10 сек |
| **Обновление кода** | `--no-migrate` | ~2 мин |
| **Полное обновление** | `--profile full` | ~3 мин |

### ⚠️ КРИТИЧНО

**✓ Запускай deploy.sh из git repo:**
```bash
cd ~/familyBudget && ./deploy.sh
```

**✗ НЕ запускай из /opt/budget:**
```bash
cd /opt/budget && ./deploy.sh  # ❌ Модули не найдены!
```

**Почему:** scripts/lib/ модули только в repository

---

## 🎨 Стиль кода

**Python:** PEP 8, type hints, async/await, Black (100 chars), Ruff, mypy

**Naming:**
- Таблицы: `t_d_*` (dimension), `t_f_*` (fact)
- API: kebab-case, Python: snake_case, Classes: PascalCase

**Git:** Conventional Commits (`feat:`, `fix:`, `refactor:`)

**Imports:** stdlib → third-party → local (absolute: `backend.app.*`)

---

## 🤖 Telegram Bot

**Handler Types:**
- **CommandHandler** - `/start`, `/today` (одношаговые)
- **ConversationHandler** - `/add`, `/edit` (multi-step с состоянием)
- **CallbackQueryHandler** - Inline buttons

**API Client:** `bot/utils/api_client.py` - JWT Bearer auth, auto token refresh

---

## 🎯 Claude Skills

**6 Skills для автоматизации:**
- `api-development` - REST API endpoints, Pydantic схемы
- `db-management` - Миграции, SCD2, Closure Table
- `testing` - Unit/integration/e2e, coverage
- `bot-development` - Telegram bot команды
- `deployment` - Production deploy, Docker
- `monitoring` - Логи, performance

📚 **[SKILLS.md](./SKILLS.md)** - Полная документация

---

## ⚡ Важные напоминания

**ВСЕГДА:**
1. ✅ Absolute imports (`from backend.app.*`)
2. ✅ `CurrentUser` dependency для auth
3. ✅ `SCD2Service` для dimension updates
4. ✅ `HierarchyService` для категорий
5. ✅ БЕЗ `user_id` фильтрации (Shared Family Budget)
6. ✅ Admin checks для dimension CREATE/UPDATE/DELETE
7. ✅ Тесты с pytest markers
8. ✅ Alembic для изменений БД

**НИКОГДА НЕ редактируй напрямую:**
- `frontend/**/templates/*.html` - cache busting версии `?v=` (auto)
- `frontend/**/static/**/*.min.js` - minified files (auto)
- `backend/db/deprecated/schema/*.sql` - archived DDL (use Alembic!)
- `/opt/budget/**/*` - production runtime (sync from ~/familyBudget)

**Workflow изменений:**
```bash
# 1. Редактируй в ~/familyBudget (git repo)
# 2. git add . && git commit -m "feat: ..."
# 3. cd ~/familyBudget && ./deploy.sh --profile full
# НЕ редактируй /opt/budget напрямую!
```

---

**Версия:** 5.0 | **Обновлено:** 2025-11-09
