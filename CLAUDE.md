# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Проект: Family Budget

Полнофункциональная система управления семейным бюджетом с Telegram Bot интерфейсом и веб-аналитикой.

**Версия:** 5.0.0-beta
**Архитектура:** FastAPI (Backend) + Telegram Bot + PostgreSQL + HTMX (Frontend)

---

## Команды для разработки

### Запуск локальной разработки

```bash
# Backend development server
cd backend
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Telegram Bot (требует запущенный backend)
cd bot
python main.py
```

### Docker деплой (production)

```bash
# Базовый деплой (PostgreSQL + Backend)
./deploy.sh

# Полный деплой (+ Bot + Nginx + SSL)
./deploy.sh --profile full

# Пересборка образов
./deploy.sh --build

# Чистый деплой (УДАЛЯЕТ ВСЕ ДАННЫЕ!)
./deploy.sh --clean
```

### Управление сервисами

```bash
# Просмотр статуса
docker compose ps

# Логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f bot
docker compose logs -f postgres

# Перезапуск сервиса
docker compose restart backend

# Остановка всех сервисов
docker compose down
```

### База данных

```bash
# Применить миграции (Alembic)
cd backend
alembic upgrade head

# Создать новую миграцию
alembic revision --autogenerate -m "Description"

# Откатить миграцию
alembic downgrade -1

# Просмотр истории миграций
alembic history

# Доступ к PostgreSQL shell
docker compose exec postgres psql -U familybudget -d familybudget
```

### Тестирование

```bash
# Backend тесты
cd backend
pytest                                    # Все тесты
pytest tests/unit                         # Unit тесты
pytest tests/integration                  # Integration тесты
pytest tests/e2e                          # E2E тесты
pytest --cov=backend --cov-report=html    # С coverage

# Bot валидация синтаксиса
cd bot
python3 -m py_compile bot/handlers/*.py
python3 -m py_compile bot/utils/*.py

# Bot интеграционные тесты
cd bot/tests/integration
pytest -v
```

### Code Quality

```bash
# Linting (backend)
cd backend
ruff check .

# Formatting
black .

# Type checking
mypy .
```

---

## Архитектура проекта

### Общая структура

```
familyBudget/
├── backend/          # FastAPI приложение (REST API + Web UI)
├── bot/              # Telegram Bot (python-telegram-bot)
├── web/              # Статические файлы и шаблоны (HTMX)
├── docs/             # Документация (PRD, API docs)
├── scripts/          # Automation scripts (backup, SSL)
├── .env              # Конфигурация (создается setup.sh)
├── docker-compose.yml
├── install.sh        # Установка системных зависимостей
├── setup.sh          # Интерактивная настройка окружения
└── deploy.sh         # Деплой с Docker Compose
```

### Backend (FastAPI + SQLModel)

**Ключевые компоненты:**

- `backend/app/main.py` - Точка входа, middleware, exception handlers
- `backend/app/api/v1/router.py` - API роутер (объединяет все endpoints)
- `backend/app/api/v1/endpoints/` - REST API endpoints (auth, facts, articles, users, centers)
- `backend/app/api/web/router.py` - Web UI endpoints (HTMX + Jinja2)
- `backend/app/models/` - SQLModel модели (User, Article, Fact, FinancialCenter, CostCenter)
- `backend/app/schemas/` - Pydantic схемы для валидации
- `backend/app/services/` - Бизнес-логика (SCD Type 2, Hierarchy, JWT, TelegramAuth)
- `backend/app/core/` - Конфигурация, аутентификация, исключения, логирование
- `backend/app/middleware/` - JWT auth, logging, error handling, validation
- `backend/app/db/session.py` - Управление сессиями БД (async)

**Паттерны:**

- **SCD Type 2** для dimension таблиц (t_d_user, t_d_article, t_d_financial_center, t_d_cost_center)
- **Closure Table** для иерархии категорий (t_d_article_hierarchy)
- **User Data Isolation** - каждый пользователь видит только свои данные
- **JWT в httpOnly cookies** для аутентификации
- **Telegram OAuth** с HMAC-SHA256 валидацией
- **Async SQLAlchemy** через asyncpg

### Telegram Bot (python-telegram-bot 20.x)

**Структура:**

- `bot/bot.py` - Класс BotApplication (регистрация handlers, scheduler)
- `bot/main.py` - Точка входа, graceful shutdown
- `bot/handlers/` - Command handlers (start, add, edit, summary, stats, settings, etc.)
- `bot/utils/` - API client, session, auth, scheduler, notification service
- `bot/jobs/` - Background jobs (weekly reports)
- `bot/config/settings.py` - Pydantic Settings

**Основные команды:**

- `/start` - Telegram OAuth аутентификация
- `/add` - Добавить транзакцию (multi-step conversation)
- `/addplan` - Добавить плановую запись
- `/edit` - Редактировать/удалить транзакции
- `/summary` - План vs Факт сравнение
- `/today` / `/stats` - Статистика
- `/settings` - Настройки (еженедельные отчеты, уведомления)

**ConversationHandler:**

Все multi-step команды используют ConversationHandler с states. При добавлении новой команды:

1. Определите states как константы
2. Создайте handler функции для каждого state
3. Зарегистрируйте ConversationHandler в `bot/bot.py`
4. Добавьте fallback для `/cancel`

### База данных (PostgreSQL 16)

**Dimension таблицы (SCD Type 2):**

- `t_d_user` - Пользователи (с историей изменений)
- `t_d_article` - Категории бюджета (иерархические)
- `t_d_article_hierarchy` - Closure Table для категорий
- `t_d_financial_center` - Финансовые центры (ЦФО)
- `t_d_cost_center` - Центры возникновения затрат (МВЗ)

**Fact таблицы:**

- `t_f_budget_fact` - Транзакции (доходы/расходы, факт/план)
  - `record_type`: 'fact' | 'plan'
  - `financial_center_id`: опционально (FK на t_d_financial_center)
  - `cost_center_id`: опционально (FK на t_d_cost_center)
- `t_notification` - История уведомлений о превышении бюджета

**Особенности SCD Type 2:**

- `valid_from` / `valid_to` - период валидности версии
- `is_active` - текущая версия (только одна для каждого business key)
- При UPDATE - старая версия закрывается, создается новая
- Полная история изменений для аудита

**Миграции:**

Используем Alembic. При изменении моделей:

```bash
cd backend
alembic revision --autogenerate -m "Add new column"
# Проверьте migration file в backend/db/migrations/versions/
alembic upgrade head
```

---

## Критически важная информация

### Аутентификация и безопасность

**Telegram OAuth (используется везде):**

1. User отправляет `/start` в боте или нажимает "Login with Telegram" на веб-сайте
2. Telegram отправляет auth данные с hash (HMAC-SHA256)
3. Backend валидирует hash через `backend/app/services/telegram_auth.py`
4. Создается/обновляется User в БД (SCD Type 2)
5. Возвращается JWT токен в httpOnly cookie
6. Bot сохраняет токен в `context.user_data` для API запросов

**JWT токены:**

- Срок действия: 7 дней (настраиваемо через `JWT_EXPIRE_DAYS`)
- Хранятся в httpOnly cookies (защита от XSS)
- Генерируются в `backend/app/services/jwt.py`
- Middleware проверяет в `backend/app/middleware/jwt_middleware.py`

**User Data Isolation:**

ВСЕ endpoints должны фильтровать данные по `current_user.id`:

```python
from backend.app.core.dependencies import get_current_user

@router.get("/facts")
async def get_facts(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    # ОБЯЗАТЕЛЬНО фильтровать по user_id!
    stmt = select(Fact).where(Fact.user_id == current_user.id)
    # ...
```

### Работа с SCD Type 2

При создании/обновлении dimension записей используйте `SCD2Service`:

```python
from backend.app.services.scd2_service import SCD2Service

# Создание новой записи
new_article = await SCD2Service.create_dimension(
    db=db,
    model=Article,
    business_key_fields={"user_id": user_id, "article_name": name},
    data={"description": "...", "is_income": True}
)

# Обновление (создаст новую версию)
updated = await SCD2Service.update_dimension(
    db=db,
    model=Article,
    business_key_fields={"user_id": user_id, "article_name": name},
    data={"description": "Updated"}
)

# Получение активной версии
current = await SCD2Service.get_active_version(
    db=db,
    model=Article,
    business_key_fields={"user_id": user_id, "article_name": name}
)
```

**ВАЖНО:** Никогда не делайте UPDATE напрямую через SQLAlchemy для SCD Type 2 таблиц!

### Иерархия категорий (Closure Table)

Для работы с иерархией используйте `HierarchyService`:

```python
from backend.app.services.hierarchy_service import HierarchyService

# Создание связи parent-child
await HierarchyService.add_relationship(
    db=db,
    parent_id=parent.id,
    child_id=child.id
)

# Получение всех потомков (рекурсивно)
descendants = await HierarchyService.get_descendants(db=db, article_id=root.id)

# Получение предков (для breadcrumbs)
ancestors = await HierarchyService.get_ancestors(db=db, article_id=leaf.id)

# Получение корневых категорий (без родителя)
roots = await HierarchyService.get_root_articles(db=db, user_id=user.id)
```

### API Client в боте

Bot взаимодействует с backend через `bot/utils/api_client.py`:

```python
from bot.utils.api_client import get_api_client
from bot.utils.session import SessionManager

api_client = await get_api_client()
token = SessionManager.get_token(context)

# GET запрос
response = await api_client.get("/facts", token=token)

# POST запрос
response = await api_client.post(
    "/facts",
    data={"amount": 100.50, "article_id": 1, ...},
    token=token
)
```

**Retry logic:**

API Client автоматически повторяет запросы (3 попытки с экспоненциальной задержкой) при 5xx ошибках.

---

## Deployment и конфигурация

### Три скрипта деплоя

1. **install.sh** - Установка системных зависимостей (Docker, UFW, утилиты)
   ```bash
   sudo ./install.sh
   ```

2. **setup.sh** - Интерактивная настройка окружения
   ```bash
   ./setup.sh
   # Создает .env файл с паролями, токенами, настройками
   ```

3. **deploy.sh** - Деплой приложения
   ```bash
   ./deploy.sh                  # Basic profile (postgres + backend)
   ./deploy.sh --profile full   # Full profile (+ bot + nginx + ssl)
   ./deploy.sh --build          # Rebuild images
   ./deploy.sh --clean          # Clean restart (DELETES DATA!)
   ```

### Переменные окружения (.env)

**Обязательные:**

```bash
POSTGRES_PASSWORD=<strong-password>
JWT_SECRET=<generated-secret>
TELEGRAM_BOT_TOKEN=<from-botfather>
ADMIN_TELEGRAM_ID=<your-telegram-id>
```

**Опциональные:**

```bash
APP_ENV=production
DOMAIN=localhost
BACKEND_PORT=8000
WORKERS=4
LOG_LEVEL=INFO
POSTGRES_EXTERNAL_ACCESS=false
SSL_TYPE=letsencrypt
LETSENCRYPT_EMAIL=admin@example.com
```

### Docker Compose профили

- **default** (no profile): postgres + backend
- **full**: postgres + backend + bot + nginx + certbot

### Networks

- `familybudget_internal` (172.28.0.0/16) - Изолированная сеть (postgres только здесь)
- `familybudget_external` (172.29.0.0/16) - Внешняя сеть (nginx, backend, bot)

**Security:** PostgreSQL НЕ доступен из интернета, только через Docker internal network.

---

## Типичные задачи и как их решать

### Добавить новый REST API endpoint

1. Создайте endpoint в `backend/app/api/v1/endpoints/`:

```python
from fastapi import APIRouter, Depends
from backend.app.core.dependencies import get_current_user, get_async_session

router = APIRouter()

@router.get("/my-endpoint")
async def my_endpoint(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user)
):
    # Ваша логика
    return {"status": "ok"}
```

2. Зарегистрируйте router в `backend/app/api/v1/router.py`:

```python
from backend.app.api.v1.endpoints import my_endpoint

api_router.include_router(
    my_endpoint.router,
    prefix="/my-endpoint",
    tags=["MyTag"]
)
```

3. Проверьте в Swagger: http://localhost:8000/docs

### Добавить новую команду в бота

1. Создайте handler в `bot/handlers/my_command.py`
2. Зарегистрируйте в `bot/bot.py`:

```python
from bot.handlers.my_command import my_command_handler

self.application.add_handler(
    CommandHandler("mycommand", my_command_handler)
)
```

3. Для multi-step команд используйте ConversationHandler (см. примеры в `bot/handlers/add.py`)

### Изменить схему БД

1. Обновите SQLModel модель в `backend/app/models/`
2. Создайте миграцию:
   ```bash
   cd backend
   alembic revision --autogenerate -m "Add column X to table Y"
   ```
3. Проверьте generated migration file
4. Примените:
   ```bash
   alembic upgrade head
   ```

**ВАЖНО:** Для production используйте `deploy.sh` который автоматически применяет миграции.

### Добавить новую dimension таблицу (SCD Type 2)

1. Создайте SQLModel модель с SCD Type 2 полями:

```python
from backend.app.models.base import DimensionBase

class MyDimension(DimensionBase, table=True):
    __tablename__ = "t_d_my_dimension"

    # Business key fields
    user_id: int = Field(foreign_key="t_d_user.id")
    name: str

    # Additional fields
    description: str | None = None
```

2. Используйте `SCD2Service` для CRUD операций
3. Создайте миграцию Alembic

### Работа с иерархией

При работе с `t_d_article` помните:

- Используйте `HierarchyService` для добавления parent-child связей
- Closure Table автоматически поддерживает транзитивные связи
- Для breadcrumbs: `get_ancestors()`
- Для subtree: `get_descendants()`

### Troubleshooting

**Backend не запускается:**

```bash
docker compose logs backend
# Проверьте DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN
```

**Bot не отвечает:**

```bash
docker compose logs bot
# Проверьте TELEGRAM_BOT_TOKEN, доступность backend API
```

**База данных недоступна:**

```bash
docker compose exec postgres pg_isready -U familybudget
# Проверьте healthcheck, логи postgres
```

**Миграции не применяются:**

```bash
docker compose exec backend alembic upgrade head
# Проверьте connection string, права доступа
```

---

## Дополнительные ресурсы

- **README.md** - Полная документация проекта
- **START.md** - Quick start guide на русском
- **docs/prd/** - Product Requirements Documents
- **backend/README.md** - Backend документация
- **bot/README.md** - Bot документация
- **scripts/README.md** - Scripts документация

---

## Стиль кода и конвенции

**Python:**

- PEP 8 style guide
- Type hints обязательны
- Async/await для всех I/O операций
- Black formatter (line length 100)
- Ruff linter

**Commits:**

- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- Включайте Co-Authored-By для Claude Code commits

**Naming:**

- Таблицы: `t_d_*` (dimension), `t_f_*` (fact)
- API endpoints: kebab-case (`/budget-facts`)
- Python: snake_case
- SQLModel классы: PascalCase

**Error handling:**

- Используйте custom exceptions из `backend/app/core/exceptions.py`
- Логируйте все errors с контекстом
- Graceful degradation в боте при ошибках API

---

**Версия документа:** 1.0
**Последнее обновление:** 2025-10-19
