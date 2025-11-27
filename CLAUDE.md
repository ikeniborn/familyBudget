# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Проект: Family Budget

Полнофункциональная система управления семейным бюджетом с Telegram Bot интерфейсом и веб-аналитикой.

**Версия:** 5.0.0-beta
**Архитектура:** FastAPI (Backend) + Telegram Bot + PostgreSQL + HTMX (Frontend)
**Язык документации:** Русский (ru)

**Ключевые особенности архитектуры:**
- **Lifespan Events:** Database init, scheduler startup, bot username auto-fetch (main.py:39-96)
- **Exception Handlers:** Ordered chain от specific к generic (main.py:222-240)
- **Background Scheduler:** APScheduler для weekly reports и notifications (запускается при startup)
- **Single Bridge Network:** 172.28.0.0/16 для всех сервисов (docker-compose.yml)

---

## 🌍 Окружения разработки

**Архитектура разработки:**
- **Локальная разработка** (dev machine) - редактирование кода, unit тесты, dev server
- **Тестовый сервер** (205.172.58.179) - integration/e2e тесты, staging deployment

**Workflow:**
1. 💻 **Разработка локально** → редактирование кода, запуск dev server
2. 🧪 **Тестирование на test server** → деплой, integration тесты, проверка в production-like окружении
3. 🚀 **Production** → финальный деплой после прохождения всех тестов

**SSH доступ к тестовому серверу:**
```bash
# Инициализация (один раз за сессию)
budget-ssh

# Подключение
ssh budget-test    # Полный алиас
ssh test          # Короткий алиас
```

📚 **Подробности:** См. секцию [Deployment → Тестовый сервер](#тестовый-сервер)

---

## 🎯 Быстрый старт для Claude Code

### Локальная разработка (Dev Machine)

```bash
# Backend dev server (из корня проекта!)
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Telegram Bot (требует backend)
cd bot && python main.py

# Alembic миграции (локальная БД)
cd backend/db/migrations
alembic upgrade head    # Применить
alembic current         # Текущая ревизия

# Полный сброс локальной БД (⚠️ УДАЛИТ ВСЕ ДАННЫЕ!)
docker compose down -v && docker compose up -d

# Unit тесты (быстрые, без внешних зависимостей)
pytest -m unit
pytest --cov=backend --cov-report=html  # Coverage
```

### Тестовый сервер (205.172.58.179)

```bash
# Подключение к тестовому серверу
budget-ssh              # Инициализация ssh-agent (один раз)
ssh budget-test         # Подключение

# На тестовом сервере: Deployment
cd ~/familyBudget
git pull origin main
sudo ./deploy.sh --profile full

# Integration/e2e тесты на test server
ssh budget-test 'cd ~/familyBudget && pytest -m integration'
ssh budget-test 'cd ~/familyBudget && pytest -m e2e'

# Проверка логов
ssh budget-test 'docker compose logs backend -f'
ssh budget-test 'docker compose logs bot --tail=50'

# Миграции БД на test server
ssh budget-test 'cd ~/familyBudget && sudo ./deploy.sh --migrations-only'
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

### Локальные тесты (Dev Machine)

**Unit тесты (быстрые, с моками):**
```bash
pytest -m unit                           # Быстрые unit тесты
pytest -m unit --cov=backend             # С coverage
pytest --cov=backend --cov-report=html   # HTML coverage report
```

**Code Quality:**
```bash
ruff check .                             # Linting
black .                                  # Форматирование
mypy .                                   # Type checking
ruff check . && black . && mypy .        # Все проверки
```

### Тесты на тестовом сервере (205.172.58.179)

**Integration тесты (с реальной БД):**
```bash
# Запуск удалённо
ssh budget-test 'cd ~/familyBudget && pytest -m integration'
ssh budget-test 'cd ~/familyBudget && pytest -m integration -v'

# ИЛИ на сервере
ssh budget-test
cd ~/familyBudget
pytest -m integration
```

**E2E тесты (full stack):**
```bash
# Запуск удалённо
ssh budget-test 'cd ~/familyBudget && pytest -m e2e'

# С детальным выводом
ssh budget-test 'cd ~/familyBudget && pytest -m e2e -v --tb=short'
```

**Coverage на test server:**
```bash
ssh budget-test 'cd ~/familyBudget && pytest --cov=backend --cov-report=html'
# HTML отчёт: /home/ikeniborn/familyBudget/htmlcov/index.html

# Скачать coverage report локально
scp -r budget-test:~/familyBudget/htmlcov ./coverage-report/
```

### Pytest Markers

**Markers:** `@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.e2e`, `@pytest.mark.slow`

**Использование:**
```python
@pytest.mark.unit
def test_validation():
    """Быстрый тест без внешних зависимостей"""
    pass

@pytest.mark.integration
async def test_database_query(async_session):
    """Тест с реальной БД (запускается на test server)"""
    pass

@pytest.mark.e2e
@pytest.mark.slow
async def test_full_workflow(async_client):
    """Full stack тест (запускается на test server)"""
    pass
```

### Ключевые файлы для тестирования

- `backend/app/main.py:39-96` - Lifespan + scheduler
- `backend/app/services/scd2_service.py` - SCD Type 2
- `backend/app/services/hierarchy_service.py` - Closure Table
- `bot/handlers/add.py` - ConversationHandler
- `tests/conftest.py` - Fixtures и test configuration

---

## 🚀 Deployment Модули (scripts/lib/)

**17+ модулей в 3 фазах загрузки:**

**Phase 1 (Core):** config.sh, utils.sh, validation.sh, status.sh
**Phase 2 (Services):** postgres.sh, services.sh, migrations.sh, firewall.sh
**Phase 3 (Complex):** sync.sh, cache_busting.sh, docker.sh, network.sh, ssl.sh

**Модульная архитектура** - каждый модуль независим, переиспользуется между install.sh/setup.sh/deploy.sh

**КРИТИЧНО:** deploy.sh ТОЛЬКО из git repo (`~/familyBudget`), НЕ из `/opt/budget`

**Важные переменные состояния (scripts/lib/config.sh):**
```bash
# State tracking для PostgreSQL race conditions
POSTGRES_WAS_STOPPED=true  # Tracks если PostgreSQL был остановлен при cleanup
                           # true  = safe для integrity checks
                           # false = skip checks (selective restart)

# Health check configuration
MAX_WAIT_TIME=120          # Maximum wait для service healthy (seconds)
CHECK_INTERVAL=5           # Interval между health checks (seconds)

# Deployment options
COMPOSE_PROFILE=""         # "" = postgres+backend, "full" = all services
RUN_MIGRATIONS=true        # Run Alembic migrations после deployment
CLEAN_DEPLOY=false         # ⚠️ DANGEROUS - removes volumes (DELETES DATA!)
```

**State Management Functions:**
```bash
set_postgres_stopped()    # Mark PostgreSQL как stopped
set_postgres_running()    # Mark PostgreSQL как running
is_postgres_was_stopped() # Check если PostgreSQL был stopped
```

**Почему важно:**
- Prevents race conditions в selective service restarts
- Integrity checks запускаются ТОЛЬКО если PostgreSQL was stopped
- Неправильный state → false positives/negatives в health checks

### PostgreSQL Corruption Prevention (Production Safeguards) ✅

**Проблема (до v5.1.4):**
Smart cleanup корректно решал "PostgreSQL will keep running", но `start_services()` игнорировал это решение и вызывал `docker compose up -d` БЕЗ флага `--no-recreate`. Docker Compose ВСЕГДА пересоздаёт контейнеры при наличии изменений, что приводило к corruption data directory (например, отсутствие `pg_notify`).

**Решение (v5.1.4+) - Трёхуровневая защита:**

**1. Container Recreation Prevention (scripts/lib/services.sh:58-95)**
```bash
# Conditional logic на основе POSTGRES_WAS_STOPPED
if [[ "${POSTGRES_WAS_STOPPED:-true}" == "false" ]]; then
    # Selective restart - используем --no-recreate для postgres
    compose_cmd up --build -d --no-recreate postgres
    compose_cmd up --build -d nginx backend bot  # Пересоздаём другие сервисы
else
    # Full restart - пересоздаём все контейнеры
    compose_cmd up --build -d
fi
```

**2. Safety Backup Before Deployment (scripts/lib/postgres.sh:553-619)**
```bash
# Автоматически создаёт backup перед запуском сервисов
create_deployment_safety_backup "pre_start"

# Что делает:
# - Проверяет что PostgreSQL запущен
# - Создаёт pg_dump → gzip (сжатый SQL backup)
# - Сохраняет в /opt/budget/backups/safety_backup_pre_start_<timestamp>.sql.gz
# - Проверяет размер файла (должен быть > 100 bytes)
# - Хранит последние 5 safety backups (автоматически удаляет старые)
# - БЛОКИРУЕТ deployment если backup failed (critical safety failure)
```

**3. Post-Start Integrity Verification (scripts/lib/postgres.sh:412-542)**
```bash
# Выполняется ВСЕГДА после start_services (независимо от POSTGRES_WAS_STOPPED)
verify_postgres_health_post_start

# Что проверяет:
# 1. PostgreSQL container is running (timeout 30s)
# 2. PostgreSQL accepts connections via pg_isready (timeout 60s)
# 3. Corruption indicators в логах (grep "could not open directory|no such file")
# 4. Critical directories exist (pg_notify, pg_dynshmem, pg_stat)

# Если corruption detected:
# - Показывает последние 50 строк логов PostgreSQL
# - Выводит список missing directories
# - Предлагает 3 recovery options:
#   Option 1: Automatic repair (deploy.sh → Full cleanup)
#   Option 2: Restore from backup (restore.sh)
#   Option 3: Manual repair (DANGEROUS)
# - БЛОКИРУЕТ deployment (exit 1) чтобы предотвратить cascade failures
```

**Deployment Flow с Safeguards (deploy.sh:1108-1136):**
```
1. validate_postgres_permissions_always  # ALWAYS runs (fix ownership)
2. create_deployment_safety_backup       # NEW - rollback capability
3. start_services                         # With --no-recreate if selective restart
4. wait_for_services                      # Standard health checks
5. verify_postgres_health_post_start     # NEW - corruption detection
6. configure_docker_firewall              # Security
7. run_alembic_migrations                 # Database schema updates
8. verify_database_schema                 # Post-migration validation
```

**Гарантии Production Safety:**
- ✅ Container recreation ПРЕДОТВРАЩЁН при selective restarts (`--no-recreate`)
- ✅ Safety backup создаётся ПЕРЕД каждым deployment (rollback capability)
- ✅ Corruption detection ПОСЛЕ start (catches edge cases)
- ✅ Deployment БЛОКИРУЕТСЯ при detection corruption (prevents cascade failures)
- ✅ Clear recovery instructions (3 опции для восстановления)

**Тестирование:**
```bash
# Simulate selective restart (код changes, БД не изменена)
cd ~/familyBudget
git pull
sudo bash deploy.sh --profile full

# Что должно произойти:
# 1. Smart cleanup: "PostgreSQL will keep running ✓"
# 2. Safety backup: "Safety backup created: safety_backup_pre_start_<timestamp>.sql.gz"
# 3. Start services: "Using --no-recreate for postgres"
# 4. Health check: "PostgreSQL container is running"
# 5. Health check: "PostgreSQL is accepting connections"
# 6. Integrity: "Data directory structure is valid"
# 7. Success: Deployment продолжается без corruption
```

### npm Build Environment

**КРИТИЧНО:** НЕ используйте симлинки для node_modules при запуске `npm run build`.

**Проблема (до v5.1.4):**
Симлинк `/opt/budget/node_modules` → `.npm-isolated/node_modules` нарушал резолвинг вложенных `require()` в bundled модулях:
- Tailwind CSS → browserslist → `node-releases/data/processed/envs.json` (FAIL)
- Node.js некорректно резолвит относительные пути через симлинки
- Ошибка: `Error: Cannot find module 'node-releases/data/processed/envs.json'`

**Решение (с v5.1.4+):**
Используется `NODE_PATH` и `PATH` environment variables вместо симлинка:

```bash
# deploy.sh автоматически настраивает окружение:
export PATH="/opt/budget/.npm-isolated/node_modules/.bin:$PATH"
export NODE_PATH="/opt/budget/.npm-isolated/node_modules:$NODE_PATH"

npm run build  # Корректно резолвит все модули

# После build восстанавливает PATH и NODE_PATH
```

**Проверка окружения:**
```bash
# Автоматически при deploy:
bash scripts/lib/check_npm_env.sh /opt/budget

# Check 6 проверяет наличие node-releases/data/processed/envs.json
```

**Если симлинк существует (старые деплои до v5.1.4):**
```bash
# deploy.sh автоматически удаляет старый симлинк при следующем деплое
# Ручное удаление (если требуется):
sudo rm /opt/budget/node_modules 2>/dev/null || true
```

**Важно:**
- ✅ NODE_PATH поддерживается всеми версиями Node.js
- ✅ Нет проблем с резолвингом вложенных модулей
- ✅ Работает корректно на чистых системах после install.sh
- ❌ НЕ создавайте симлинк node_modules вручную

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

**Exception Handling Chain (main.py:222-240):**
⚠️ **ПОРЯДОК КРИТИЧЕН** - от specific к generic:
1. `RequestValidationError`, `ValidationError` (Pydantic validation)
2. `APIException` (custom application exceptions)
3. `HTTPException` (FastAPI HTTP errors)
4. `SQLAlchemyError` (database errors)
5. `ValueError` (generic value errors)
6. `Exception` (catch-all для unhandled exceptions)

**НЕ меняй порядок** - generic handlers перехватят specific exceptions!

**Lifespan Events (main.py:39-96):**
```python
# Startup sequence:
1. init_db()              # Database connection pool
2. start_scheduler()      # APScheduler for cron jobs (weekly reports, notifications)
3. get_bot_username()     # Auto-fetch from Telegram API if not configured

# Shutdown sequence:
1. stop_scheduler()       # Graceful scheduler shutdown
2. close_db()             # Close database connections
```

**При debugging startup issues:**
- Проверь логи на этапе lifespan (init_db, scheduler, bot username)
- Scheduler failures блокируют startup
- Database connection errors также блокируют startup

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

## 👥 User Management (NEW: v5.1+)

**User Model Fields:**
- `is_active: bool` - User activation status (controlled by admin, default=False)
- `last_login_at: Optional[datetime]` - Timestamp of last successful login

**NEW: Auto-Create + Activation Flow (PRD FR-030 compliance):**

```python
# Auth Flow (auth.py:198-240)
# 1. User logs in via Telegram Login Widget
# 2. If user NOT exists → auto-create with is_active=False
# 3. If is_active=False → 403 Forbidden "Ожидает активации"
# 4. If is_active=True → update last_login_at, generate JWT

# Admin activation (admin.py:400-451)
PUT /api/v1/admin/users/{user_id}/activate  # Simple UPDATE (NOT SCD Type 2)
PUT /api/v1/admin/users/{user_id}/deactivate  # Cannot deactivate self
PUT /api/v1/admin/users/{user_id}/refresh-profile  # Fetch from Telegram Bot API
GET /api/v1/admin/users?is_active=true/false  # Filter by activation status
```

**Important:**
- ✅ `is_active` changes: Simple UPDATE (НЕ SCD Type 2) - это access control флаг
- ✅ `last_login_at` changes: Simple UPDATE (НЕ SCD Type 2) - это audit trail
- ✅ Profile changes (name, username): SCD Type 2 (business data)
- ✅ Новые пользователи видны админу в `/admin/users` с badge "⏳ Ожидает активации"

**Admin UI Features:**
- Таблица: "Последний вход" колонка, combined status badges (is_active + is_current)
- Фильтры: Активные / Неактивные / Все
- Кнопки: Активировать, Деактивировать, Обновить из Telegram
- Статистика: "⏳ Ожидают активации" badge

---

## 🔧 Troubleshooting

### Import Errors
```python
# ❌ НЕПРАВИЛЬНО
from app.models.article import Article

# ✅ ПРАВИЛЬНО - absolute imports
from backend.app.models.article import Article
```

### Application Won't Start (Lifespan Errors)

**Симптомы:**
- Container crashes immediately after start
- Logs показывают errors в lifespan context manager
- Health checks fail

**Причины (backend/app/main.py:39-96):**

1. **Database Connection Failed:**
   ```bash
   # Check logs
   docker compose logs backend | grep "init_db"

   # Verify DATABASE_URL
   docker compose exec backend env | grep DATABASE_URL

   # Test PostgreSQL
   docker compose exec postgres pg_isready
   ```

2. **Scheduler Failed to Start:**
   ```bash
   # Check logs
   docker compose logs backend | grep "scheduler"

   # APScheduler errors - обычно из-за database connection
   ```

3. **Bot Username Fetch Failed:**
   ```bash
   # Check logs
   docker compose logs backend | grep "bot_username"

   # Verify TELEGRAM_BOT_TOKEN
   grep TELEGRAM_BOT_TOKEN /opt/budget/.env

   # Test token manually
   curl https://api.telegram.org/bot<TOKEN>/getMe
   ```

**Решение:**
```bash
# 1. Проверь зависимости
docker compose ps  # postgres должен быть healthy

# 2. Проверь environment variables
docker compose config | grep -A 20 "backend:"

# 3. Restart с чистыми логами
docker compose logs backend --tail=100 --follow

# 4. Если scheduler fails - check database migrations
cd backend/db/migrations && alembic current
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

**⚠️ КРИТИЧНО - НИКОГДА НЕ ЗАПУСКАЙ CACHE BUSTING ЛОКАЛЬНО!**

Cache busting выполняется **ТОЛЬКО на сервере** при deploy:

```bash
# ✅ ПРАВИЛЬНО - на сервере
cd ~/familyBudget && ./deploy.sh --profile full
# deploy.sh автоматически вызывает: scripts/lib/cache_busting.sh auto

# ❌ НЕПРАВИЛЬНО - локально в репозитории
bash scripts/lib/cache_busting.sh auto  # НЕ ДЕЛАЙ ЭТО!
```

**Правила:**

1. **В репозитории:** ВСЕ статические файлы должны иметь `?v=PLACEHOLDER`
   ```html
   <script src="/static/js/app.js?v=PLACEHOLDER"></script>
   <link href="/static/css/style.css?v=PLACEHOLDER">
   ```

2. **При deploy:** `scripts/lib/cache_busting.sh` **автоматически** заменяет `PLACEHOLDER` → `timestamp`
   ```html
   <!-- После deploy на сервере: -->
   <script src="/static/js/app.js?v=20251110_0725"></script>
   ```

3. **НЕ коммить** файлы с timestamp вместо PLACEHOLDER
4. **НЕ редактировать** `?v=` версии вручную
5. **Добавлять новые HTML templates** в `scripts/lib/cache_busting.sh`:
   - В функцию `update_cache_versions()` (строка ~26)
   - В функцию `check_cache_versions()` (строка ~104)

**Почему важно:**
- Git diff показывает реальные изменения, не шум от версий
- Одна версия для всех статиков = простой откат при проблемах
- Timestamp генерируется на сервере = гарантирует уникальность

### Database Migration Errors
```bash
# Сброс БД (⚠️ УДАЛИТ ВСЕ ДАННЫЕ!)
docker compose down -v && docker compose up -d
```

### CalendarWidget Mobile Display Issues

**Симптомы:**
- Header (месяц/год селекторы + навигация) выходит за границы календаря
- Кнопки дат слишком узкие (не квадратные)
- Навигационные стрелки обрезаны или перекрываются

**Причина:**
- Отсутствие `max-width` на month/year `<select>` элементах
- Отсутствие `min-width` на кнопках дат (только `min-height`)
- Слишком большой `gap` между flex элементами на маленьких экранах

**Решение (v5.1.4):**
```css
/* frontend/web/static/css/calendar-widget.css */

/* Prevent header overflow */
.calendar-widget select[data-action="select-month"],
.calendar-widget select[data-action="select-year"] {
  max-width: 110px;
  min-width: 90px;
  flex-shrink: 1;
}

/* Ensure square date buttons */
.calendar-widget [data-date] {
  min-height: 40px;
  min-width: 40px;  /* NEW - prevents narrow buttons */
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .calendar-widget select[data-action="select-month"],
  .calendar-widget select[data-action="select-year"] {
    max-width: 100px;
    min-width: 80px;
    font-size: 0.8125rem;
  }

  .calendar-widget .flex.items-center.gap-2 {
    gap: 0.25rem; /* Reduce from 8px to 4px */
  }
}
```

**Тестирование:**
1. Открой страницу аналитики
2. Нажми "Произвольный" период
3. Проверь на мобильном (< 768px) - header не должен переполняться
4. Проверь кнопки дат - должны быть квадратными (40x40px, 44x44px на mobile)

### UFW Firewall Validation

**Проблема:**
UFW правила могут устареть после обновления конфигурации или ручных изменений.

**Решение (v5.1.4):**
```bash
# Автоматическая проверка UFW при deploy
cd ~/familyBudget && ./deploy.sh --profile full
# deploy.sh автоматически вызывает: validate_ufw_rules()

# Ручная проверка
sudo ufw status verbose
sudo ufw status numbered
```

**Что проверяет validate_ufw_rules():**
- ✓ UFW активен (`Status: active`)
- ✓ Default incoming: DENY
- ✓ Default outgoing: ALLOW
- ✓ SSH port 22: ALLOWED
- ✓ HTTPS port 443: ALLOWED
- ✓ HTTP port 80: опционально (для Let's Encrypt)
- ✓ PostgreSQL 5432: consistency check (`POSTGRES_EXTERNAL_ACCESS` env vs actual UFW rules)
- ✓ Backend 8000: защищён UFW (не должен быть ALLOW IN)

**Типичные проблемы:**

1. **UFW не активен:**
   ```bash
   sudo ufw enable
   sudo systemctl enable ufw
   ```

2. **Порт 80 постоянно открыт:**
   ```bash
   # Port 80 должен открываться ТОЛЬКО временно для certbot
   sudo ufw delete allow 80/tcp
   # certbot автоматически откроет при renewal
   ```

3. **PostgreSQL несоответствие:**
   ```bash
   # Если POSTGRES_EXTERNAL_ACCESS=true но нет UFW rule:
   sudo ufw allow from <TRUSTED_IP> to any port 5432

   # Если POSTGRES_EXTERNAL_ACCESS=false но есть UFW rule:
   sudo ufw status numbered
   sudo ufw delete <rule_number>
   ```

4. **Backend port 8000 exposed:**
   ```bash
   # Если порт 8000 открыт в UFW (небезопасно):
   sudo ufw delete allow 8000/tcp
   # Доступ через Nginx reverse proxy (port 443)
   ```

**Проверка после изменений:**
```bash
# 1. Проверь UFW status
sudo ufw status verbose

# 2. Проверь открытые порты
sudo netstat -tulpn | grep LISTEN

# 3. Убедись что порты 8000, 5432 НЕ доступны извне
# (должны быть доступны только localhost или защищены UFW)
```

### Docker bypassing UFW (CRITICAL SECURITY ISSUE!)

**Проблема:**
Docker **ОБХОДИТ UFW** добавляя iptables правила в `DOCKER` chain, которые выполняются **ДО** UFW правил.

**Симптомы:**
```bash
sudo ss -tulpn | grep -E '5432|8000'
# Видишь: 0.0.0.0:5432 и 0.0.0.0:8000 (открыто для ВСЕХ!)

sudo ufw status
# Видишь: НЕТ правил для 5432/8000 (UFW их не контролирует)

sudo iptables -L DOCKER -n -v
# Видишь: ACCEPT rules для портов (Docker добавил их сам)
```

**Причина:**
```yaml
# docker-compose.yml
ports:
  - "5432:5432"   # ❌ Биндится на 0.0.0.0 (все интерфейсы)
  - "8000:8000"   # ❌ Биндится на 0.0.0.0
```

Docker создаёт правила: **DOCKER chain → UFW chain**
Результат: UFW видит только SSH и HTTPS, а Docker открыл PostgreSQL и Backend!

**Решение (v5.1.4):**

Используй `DOCKER-USER` chain - выполняется **ДО** `DOCKER` chain:

```bash
# 1. Настрой переменные
nano /opt/budget/.env
# Добавь:
POSTGRES_EXTERNAL_ACCESS=false  # ИЛИ true если нужен внешний доступ
POSTGRES_ALLOWED_IP=203.0.113.45  # Твой внешний IP (если EXTERNAL_ACCESS=true)

# 2. Загрузи модуль firewall
cd ~/familyBudget
git pull
source scripts/lib/config.sh
source scripts/lib/utils.sh
source scripts/lib/firewall.sh

# 3. Примени Docker firewall правила
configure_docker_firewall

# 4. Проверь результат
sudo iptables -L DOCKER-USER -n -v --line-numbers
```

**Что делает configure_docker_firewall():**
1. **Блокирует port 8000** (backend) от внешнего доступа → используй Nginx reverse proxy
2. **Блокирует port 5432** (PostgreSQL) по умолчанию
3. **Разрешает PostgreSQL** только с `POSTGRES_ALLOWED_IP` (если `EXTERNAL_ACCESS=true`)
4. **Разрешает внутренний Docker трафик** (контейнеры могут общаться)

**Проверка блокировки:**
```bash
# На production сервере
sudo iptables -L DOCKER-USER -n -v

# С другого компьютера (должно timeout)
telnet your_server 5432  # Timeout (PostgreSQL заблокирован)
telnet your_server 8000  # Timeout (Backend заблокирован)
curl https://your_server  # OK (Nginx работает через port 443)
```

**⚠️ ВАЖНО: Правила сбрасываются при перезапуске Docker**

После перезапуска Docker (`systemctl restart docker`) правила `DOCKER-USER` chain сбрасываются.

**✅ Решение (РЕАЛИЗОВАНО с v5.1.4):**

`deploy.sh` **автоматически** применяет правила при каждом деплое:

```bash
cd ~/familyBudget && ./deploy.sh --profile full
# configure_docker_firewall() вызывается автоматически после start_services
```

**Workflow:**
1. `start_services()` - Docker создаёт свои iptables правила
2. `wait_for_services()` - Ждём healthy status
3. **`configure_docker_firewall()`** - Блокируем порты (DOCKER-USER chain) ← **АВТОМАТИЧЕСКИ**
4. `run_migrations()` - Применяем миграции БД

**Если deploy.sh не используется (ручной запуск Docker):**
```bash
# После вручную: docker compose up
source scripts/lib/firewall.sh && configure_docker_firewall
```

**Альтернатива (Systemd service) - TODO:**
```bash
# Создать systemd service для автоматического применения правил при старте Docker
# /etc/systemd/system/docker-firewall.service
# ExecStart=/opt/budget/scripts/lib/firewall.sh configure_docker_firewall
```

**Безопасные альтернативы (если не нужен внешний доступ):**

**Вариант A:** Bind только на localhost
```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:5432:5432"  # Только localhost
  - "127.0.0.1:8000:8000"  # Только localhost
```

**Вариант B:** Не expose порты вообще
```yaml
# Удалить ports: секцию полностью
# Доступ только внутри Docker network
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

## 🎨 Frontend Shared Modules (BudgetShared)

**Unified Bundle:** Все переиспользуемые JS модули объединены в `budgetShared.js`

**Расположение:** `frontend/shared/static/js/budgetShared.js` (~56KB source, ~25KB minified, ~7KB gzipped)

### Архитектура

```javascript
window.BudgetShared = {
    DateFormatter: class,      // Форматирование дат (API ↔ UI)
    CalendarWidget: class,     // Интерактивные календари (range/single)
    ChoicesCategoryTree: class, // Иерархические селекторы категорий
    version: '1.0.0'
};
```

**Зависимости:**
- `CalendarWidget` → использует `DateFormatter` внутри
- `ChoicesCategoryTree` → использует Choices.js (подключается отдельно)

### Development vs Production

**Development (локально):**
```html
<!-- Используй source файл -->
<script src="/shared/static/js/budgetShared.js?v=PLACEHOLDER"></script>
```

**Production (после deploy):**
```html
<!-- deploy.sh автоматически создаёт .min.js -->
<script src="/shared/static/js/budgetShared.min.js?v=20251110_0725"></script>
```

**Workflow:**
1. Редактируй `budgetShared.js` (source)
2. При deploy: `scripts/lib/minify.sh` → создаёт `budgetShared.min.js`
3. При deploy: `scripts/lib/cache_busting.sh` → заменяет `PLACEHOLDER` на timestamp

### Использование

**DateFormatter:**
```javascript
// Форматирование для API (YYYY-MM-DD)
const apiDate = BudgetShared.DateFormatter.formatForAPI(new Date());

// Форматирование для отображения (DD.MM.YYYY)
const displayDate = BudgetShared.DateFormatter.formatForDisplay("2025-11-10");

// Получить сегодня (API формат)
const today = BudgetShared.DateFormatter.today();

// Инициализация нативного <input type="date">
BudgetShared.DateFormatter.initNativeDateInput('#fact_date', {
    max: BudgetShared.DateFormatter.today()
});
```

**CalendarWidget:**
```javascript
// Range режим (от - до)
new BudgetShared.CalendarWidget({
    mode: 'range',
    container: '#calendar-container',
    onDateSelect: (from, to) => {
        console.log('Selected:', from, to);
    }
});

// Single режим (одна дата)
new BudgetShared.CalendarWidget({
    mode: 'single',
    container: '#calendar-container',
    onDateSelect: (date) => {
        console.log('Selected:', date);
    }
});
```

**ChoicesCategoryTree:**
```javascript
// Webapp (Bearer token auth)
new BudgetShared.ChoicesCategoryTree('#article_select', {
    type: 'expense',  // 'expense' | 'income'
    token: 'Bearer xxx',
    onSelect: (article) => {
        console.log('Selected:', article);
    }
});

// Web (cookie auth)
new BudgetShared.ChoicesCategoryTree('#article_select', {
    type: 'expense',
    onSelect: (article) => {
        console.log('Selected:', article);
    }
});
```

### Подключение в HTML Templates

**Web templates (base.html):**
```html
<script src="/shared/static/js/budgetShared.min.js?v=PLACEHOLDER"></script>
```

**Webapp templates (add.html, edit.html, addplan.html):**
```html
<script src="/shared/static/js/budgetShared.min.js?v=PLACEHOLDER"></script>
```

### Важные правила

✅ **ВСЕГДА:**
- Используй namespace `BudgetShared.*` для всех классов
- Подключай `budgetShared.min.js` с `?v=PLACEHOLDER`
- Редактируй только source файл (`budgetShared.js`)
- НЕ редактируй `budgetShared.min.js` (auto-generated)

❌ **НИКОГДА:**
- НЕ используй старые прямые импорты (`dateFormatter.min.js`, `calendar-widget.min.js`)
- НЕ создавай инстансы без namespace (`new CalendarWidget()` → WRONG)
- НЕ коммить `.min.js` файлы (создаются при deploy)

### Исходные модули

**Старые файлы остаются как source:**
- `frontend/shared/static/js/dateFormatter.js` (source)
- `frontend/shared/static/js/calendar-widget.js` (source)
- `frontend/shared/static/js/choicesCategoryTree.js` (source)

**НЕ используй напрямую** - только через `budgetShared.js`

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

### Окружения

**Два независимых окружения:**

| Окружение | Назначение | Расположение |
|-----------|-----------|--------------|
| **Локальная разработка** | Редактирование кода, unit тесты, dev server | Dev machine |
| **Тестовый сервер** | Integration/e2e тесты, staging deployment | 205.172.58.179 |

---

### Тестовый сервер

**Сервер:** 205.172.58.179
**Пользователь:** ikeniborn
**Назначение:** Integration/e2e тестирование, staging deployment

#### SSH доступ

**Первоначальная настройка (выполнено):**
- ✅ SSH config (`~/.ssh/config`) с алиасами `budget-test` и `test`
- ✅ Приватный ключ: `/home/ikeniborn/Documents/Hostkey/ikeniborn-dev` (права 600)
- ✅ Bash алиас `budget-ssh` для инициализации
- ✅ Автоматический ssh-agent management

**Подключение к тестовому серверу:**

```bash
# Инициализация (один раз за сессию)
budget-ssh
# - Запускает ssh-agent
# - Добавляет SSH ключ (может запросить passphrase)
# - Проверяет подключение

# Подключение
ssh budget-test    # Полный алиас
ssh test          # Короткий алиас

# Выполнить команду на сервере
ssh budget-test 'docker ps'
ssh budget-test 'cd ~/familyBudget && git status'

# Копирование файлов
scp local-file.txt budget-test:/tmp/
scp budget-test:/opt/budget/.env ./env.backup
```

**Troubleshooting SSH:**

```bash
# Проверить что ключ добавлен в ssh-agent
ssh-add -l

# Проверить доступность сервера
ping 205.172.58.179
nc -zv 205.172.58.179 22

# Verbose SSH для debug
ssh -v budget-test

# Переинициализация ssh-agent
budget-ssh
```

#### Deployment на тестовый сервер

**Workflow:**

```bash
# 1. Подключиться к тестовому серверу
ssh budget-test

# 2. Перейти в git repo
cd ~/familyBudget

# 3. Обновить код
git pull origin main

# 4. Деплой
sudo ./deploy.sh --profile full

# 5. Проверить статус сервисов
docker compose ps
docker compose logs backend --tail=50
```

**Типичные команды на test server:**

```bash
# Проверка статуса
docker compose ps
docker compose logs backend -f

# Миграции БД
cd ~/familyBudget
sudo ./deploy.sh --migrations-only

# Полный перезапуск
cd ~/familyBudget
sudo ./deploy.sh --profile full

# Проверка логов
docker compose logs backend --tail=100
docker compose logs postgres --tail=50
docker compose logs bot -f

# Тестирование
ssh budget-test 'cd ~/familyBudget && pytest -m integration'
```

---

### Локальная разработка

**Для локального dev server:**

```bash
# Backend dev server (из корня проекта!)
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Telegram Bot (требует backend)
cd bot && python main.py

# Unit тесты
pytest -m unit
pytest --cov=backend --cov-report=html
```

---

### Production Deployment (будущее)

**Первоначальная установка:**
```bash
cd ~/familyBudget
sudo ./install.sh    # Docker, UFW
./setup.sh           # .env configuration
./deploy.sh --profile full
```

**Обновление:**
```bash
cd ~/familyBudget && git pull
./deploy.sh --profile full  # Полный деплой (~3 мин)
```

**Варианты деплоя:**

| Сценарий | Команда | Время |
|----------|---------|-------|
| **Новая миграция БД** | `--migrations-only` | ~10 сек |
| **Обновление кода** | `--no-migrate` | ~2 мин |
| **Полное обновление** | `--profile full` | ~3 мин |

---

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

**✓ SSH алиасы для тестового сервера:**
```bash
ssh budget-test    # Правильно
ssh test          # Правильно
```

**✗ НЕ используй прямой IP:**
```bash
ssh ikeniborn@205.172.58.179  # Неудобно, требует указания ключа
```

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

### Development Workflow

**Правильный workflow разработки:**

1. 💻 **Локальная разработка:**
   - Редактирование кода в git repo
   - Unit тесты (`pytest -m unit`)
   - Dev server для быстрой проверки
   - Git commit

2. 🧪 **Тестирование на test server:**
   ```bash
   # Подключиться к test server
   budget-ssh && ssh budget-test

   # Обновить код и задеплоить
   cd ~/familyBudget && git pull origin main
   sudo ./deploy.sh --profile full

   # Запустить integration/e2e тесты
   pytest -m integration
   pytest -m e2e
   ```

3. 🚀 **Production (после успешных тестов):**
   - Только после прохождения всех тестов на test server
   - Merge в main branch
   - Deploy на production

### Coding Standards

**ВСЕГДА:**
1. ✅ Absolute imports (`from backend.app.*`)
2. ✅ `CurrentUser` dependency для auth
3. ✅ `SCD2Service` для dimension updates
4. ✅ `HierarchyService` для категорий
5. ✅ БЕЗ `user_id` фильтрации (Shared Family Budget)
6. ✅ Admin checks для dimension CREATE/UPDATE/DELETE
7. ✅ Тесты с pytest markers (`@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.e2e`)
8. ✅ Alembic для изменений БД
9. ✅ Используй `?v=PLACEHOLDER` для всех статических файлов в HTML
10. ✅ Unit тесты локально, integration/e2e на test server

### SSH и Servers

**✅ ПРАВИЛЬНО - SSH алиасы:**
```bash
budget-ssh              # Инициализация ssh-agent
ssh budget-test         # Подключение к test server
ssh test               # Короткий алиас
```

**❌ НЕПРАВИЛЬНО - Прямой IP:**
```bash
ssh ikeniborn@205.172.58.179  # НЕ используй
```

### Deployment

**✅ ПРАВИЛЬНО - Deploy из git repo:**
```bash
# На test server
ssh budget-test
cd ~/familyBudget && git pull
sudo ./deploy.sh --profile full
```

**❌ НЕПРАВИЛЬНО:**
```bash
cd /opt/budget && ./deploy.sh  # ❌ Модули не найдены!
```

### Static Files и Cache

**НИКОГДА НЕ делай:**
- ❌ НЕ запускай `scripts/lib/cache_busting.sh` локально (только на сервере при deploy!)
- ❌ НЕ коммить HTML с timestamp версиями (`?v=20251110_0725`) - только `?v=PLACEHOLDER`
- ❌ НЕ редактируй `?v=` версии вручную
- ❌ НЕ редактируй `frontend/**/static/**/*.min.js` - minified files (auto)
- ❌ НЕ используй `backend/db/deprecated/schema/*.sql` - archived DDL (use Alembic!)
- ❌ НЕ редактируй `/opt/budget/**/*` напрямую (sync from git repo)

### Quick Reference

**Локальная разработка:**
```bash
uvicorn backend.app.main:app --reload    # Dev server
pytest -m unit                            # Unit тесты
git add . && git commit -m "feat: ..."   # Commit
```

**Тестовый сервер:**
```bash
budget-ssh && ssh budget-test                     # Подключение
cd ~/familyBudget && git pull && sudo ./deploy.sh # Deploy
pytest -m integration && pytest -m e2e            # Тесты
```

---

**Версия:** 5.0.0-beta | **Обновлено:** 2025-11-26
