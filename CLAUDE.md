# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget - это система управления семейным бюджетом с поддержкой Telegram бота и веб-интерфейса. Приложение построено на FastAPI (backend), PostgreSQL (database), и использует Docker для деплоя.

**Ключевые особенности:**
- 🔐 Аутентификация через Telegram OAuth
- 📊 Иерархические категории бюджета (статьи)
- 💰 Отслеживание транзакций (доходы/расходы)
- 🤖 Telegram бот с Web Apps интерфейсом
- 🌐 Веб-интерфейс (HTMX + Tailwind CSS + DaisyUI)
- 📈 Отчеты и статистика
- 🔄 История изменений (SCD Type 1 + History tables)
- 📱 Transfer поддержка (переводы между счетами)

## Терминология (UI ↔ Код)

| UI (русский) | Код (английский) | Таблица БД | Описание |
|--------------|------------------|------------|----------|
| **Счет** | `FinancialCenter` | `t_d_financial_center` | Банковские счета, кошельки, наличные |
| **Место затрат** | `CostCenter` | `t_d_cost_center` | Проекты, отделы, категории расходов |
| **Статья** | `Article` | `t_d_article` | Категории бюджета (иерархические) |
| **Транзакция** | `BudgetFact` | `t_f_budget_fact` | Доходы, расходы, переводы |

**Примечание:** В UI используются русские термины, в коде и БД — английские (industry standard).
Ранее использовались термины "ЦФО" (Центр финансовой ответственности) и "МВЗ" (Место возникновения затрат),
которые были заменены на более понятные "Счет" и "Место затрат" в commit `53b4c284`.

## Архитектура

### Stack
- **Backend**: FastAPI 0.121.2 + SQLModel + asyncpg
- **Database**: PostgreSQL 16 + Alembic migrations
- **Bot**: python-telegram-bot 21.10
- **Frontend**: HTMX + Jinja2 + Tailwind CSS + DaisyUI
- **Deployment**: Docker Compose + bash scripts
- **Authentication**: JWT (httpOnly cookies) + Telegram OAuth

### Структура директорий

```
familyBudget/
├── backend/                 # FastAPI приложение
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   │   ├── v1/         # REST API v1
│   │   │   └── web/        # HTMX web pages
│   │   ├── core/           # Конфигурация, логирование
│   │   ├── db/             # Database session
│   │   ├── models/         # SQLModel модели
│   │   ├── schemas/        # Pydantic схемы
│   │   ├── services/       # Бизнес-логика
│   │   ├── middleware/     # JWT, logging, CSP
│   │   └── utils/          # Вспомогательные функции
│   ├── db/                 # Alembic migrations
│   │   └── migrations/
│   │       └── versions/   # Migration файлы
│   ├── tests/              # Backend тесты
│   └── requirements.txt
├── bot/                     # Telegram бот
│   ├── utils/              # API client, auth, validators
│   ├── jobs/               # Background jobs (scheduler)
│   ├── config/             # Bot settings
│   └── tests/
├── frontend/                # Frontend статика
│   ├── web/                # Веб-интерфейс (HTMX)
│   │   ├── templates/      # Jinja2 шаблоны
│   │   └── static/         # CSS, JS, vendor
│   ├── webapp/             # Telegram Web Apps
│   │   └── static/         # HTML, JS, CSS
│   └── shared/             # Общие модули
│       └── static/js/      # Shared JS (category tree, calendar)
├── scripts/                 # Деплой и утилиты
│   ├── lib/                # Shared bash functions
│   ├── backup.sh           # Backup PostgreSQL
│   ├── restore.sh          # Restore backup
│   └── ssl_certificate_manager.sh
├── sql/                     # SQL скрипты и запросы
│   ├── queries/            # Полезные SQL запросы
│   └── scripts/            # SQL утилиты
├── tests/                   # Интеграционные/E2E тесты
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── nginx/                   # Nginx конфигурация
├── docker-compose.yml       # Docker services
├── install.sh               # Системные зависимости
├── setup.sh                 # Настройка .env
├── deploy.sh                # Деплой приложения
└── logs.sh                  # Диагностика и логи
```

### Основные компоненты

**1. Backend (FastAPI)**
- `backend/app/main.py` - Точка входа приложения
- `backend/app/api/v1/router.py` - API v1 router
- `backend/app/api/web/router.py` - Web pages router
- `backend/app/core/config.py` - Settings (Pydantic Settings)
- `backend/app/db/session.py` - Database connection pool
- `backend/app/middleware/` - JWT auth, logging, CSP, validation

**2. Database Models (SQLModel)**

Все модели используют **SCD Type 1** (in-place updates) + отдельные **History tables** (SCD Type 2):
- `Article` - Категории бюджета (иерархические, shared across users)
- `ArticleHistory` - История изменений Article (SCD Type 2)
- `BudgetFact` - Факты (fact table)
- `BudgetFactHistory` - История изменений BudgetFact (SCD Type 2)
- `User` - Пользователи (SCD Type 1 + UserHistory)
- `FinancialCenter` - Финансовые центры (счета, кошельки)
- `CostCenter` - Центры затрат (проекты, отделы)
- `ArticleHierarchy` - Closure table для иерархии категорий
- `Notification` - Уведомления (broadcast support)
- `ImportStaging` - Staging table для импорта из Tinkoff

**2a. PostgreSQL Data Directory (Docker Managed Volume)**

PostgreSQL использует Docker managed volume для хранения данных:

```yaml
# docker-compose.yml
volumes:
  postgres_data:
    external: true
    name: budget_postgres_data  # Docker managed volume
```

**Преимущества Docker managed volume:**
- Автоматическое управление permissions (нет необходимости в repair-функциях)
- Лучшая изоляция данных от host системы
- Упрощённый deploy без сложной логики восстановления директорий
- Docker гарантирует целостность volume при перезапусках

**Расположение данных:**
- Volume name: `budget_postgres_data`
- Физически: `/var/lib/docker/volumes/budget_postgres_data/_data/`

**Troubleshooting:**

```bash
# Проверить volume
docker volume inspect budget_postgres_data

# Проверить данные в volume
docker run --rm -v budget_postgres_data:/data alpine ls -la /data/

# Логи PostgreSQL
docker compose logs postgres --tail 50

# Создать volume вручную (если отсутствует)
docker volume create budget_postgres_data
```

**История:** v6.0 - миграция с bind mount на Docker managed volume завершена.
Legacy repair функции удалены (см. git history для справки).

**3. Database Migrations (Alembic)**
- `backend/db/migrations/env.py` - Alembic environment
- `backend/db/migrations/versions/` - Migration files
- Формат: `YYYYMMDD_hash_description.py`
- **Важно**: Migration 20251110 - baseline v5.1.0 (consolidated)

**4. Telegram Bot**
- `bot/bot.py` - Основной bot handler
- `bot/utils/api_client.py` - Backend API client
- `bot/utils/telegram_auth.py` - Telegram OAuth
- `bot/utils/notification_service.py` - Push notifications
- `bot/jobs/weekly_report.py` - Weekly report job

**5. Frontend**
- **Web UI**: HTMX + Jinja2 templates + Tailwind CSS + DaisyUI
- **Telegram Web Apps**: Standalone HTML pages для Menu Button
- **Shared modules**: Category tree (Choices.js), calendar widget, date formatter

## Команды для разработки

### Локальная разработка

```bash
# Python виртуальное окружение
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Запуск backend локально (требуется PostgreSQL)
uvicorn backend.app.main:app --reload --port 8000

# Запуск бота локально
cd bot
python bot.py
```

### База данных (Alembic)

```bash
# Создать новую миграцию (из директории backend/)
cd backend
alembic revision --autogenerate -m "описание изменений"

# Применить миграции
alembic upgrade head

# Откатить миграцию
alembic downgrade -1

# Показать текущую версию
alembic current

# Показать историю миграций
alembic history

# ВАЖНО: Перед созданием миграции проверьте env.py - он импортирует все модели
```

### Frontend (Tailwind CSS + JS)

```bash
# Сборка Tailwind CSS
npm run build:css

# Watch режим (автоматическая пересборка)
npm run watch:css

# Минификация JS
npm run minify:js

# Минификация CSS
npm run minify:css

# Полная сборка (CSS + JS + minify)
npm run build

# Валидация минифицированных файлов
npm run validate:minified
```

### PWA Icons (Генерация иконок)

**ВАЖНО:** PWA иконки НЕ хранятся в git - они генерируются автоматически при деплое из SVG файла.

```bash
# Регенерировать PWA иконки локально (для тестирования)
./scripts/generate_pwa_icons.sh

# Или указать конкретный SVG файл
./scripts/generate_pwa_icons.sh path/to/icon.svg
```

**Автоматическая регенерация при деплое:**

1. **Добавить новую иконку в репозиторий:**
   ```bash
   # Скопировать новую SVG иконку в tmp/
   cp new-icon.svg tmp/budget-icon-v3.svg
   git add tmp/budget-icon-v3.svg
   git commit -m "chore: update PWA icon source"
   git push
   ```

2. **При деплое автоматически:**
   - `tmp/budget-icon-v3.svg` копируется в `/opt/budget/tmp/`
   - `deploy.sh` обнаруживает триггер файл
   - Вызывается `generate_pwa_icons.sh` для регенерации всех иконок
   - Триггер файл удаляется после успешной генерации
   - Service Worker cache обновляется с новыми иконками

3. **Сгенерированные файлы:**
   - `frontend/web/static/icons/icon-192.png` (192x192)
   - `frontend/web/static/icons/icon-512.png` (512x512)
   - `frontend/web/static/icons/icon-maskable-512.png` (512x512 с safe zone)
   - `frontend/web/static/icons/apple-touch-icon.png` (180x180)
   - `frontend/web/static/icons/favicon.ico` (16x16, 32x32, 48x48)
   - `frontend/web/static/icons/icon.svg` (копия источника)

**Примечания:**
- Если `tmp/budget-icon-v3.svg` НЕ существует при деплое → иконки не регенерируются
- Это экономит время деплоя когда иконки не изменялись
- Service Worker CACHE_VERSION автоматически обновляется при каждом деплое
- `sw.js` в репозитории содержит `CACHE_VERSION_PLACEHOLDER` - реальная версия генерируется при деплое

### Тестирование

```bash
# Все тесты
pytest

# Только unit тесты
pytest -m unit

# Только integration тесты
pytest -m integration

# E2E тесты (Playwright)
npx playwright test
npx playwright test --ui  # Interactive mode

# С покрытием
pytest --cov=backend --cov=bot --cov-report=html

# Конкретный тест
pytest tests/unit/test_article_service.py::test_create_article

# Verbose режим
pytest -v -s
```

### Code Quality

```bash
# Linting (ruff)
ruff check backend/
ruff check --fix backend/  # Auto-fix

# Formatting (black)
black backend/
black --check backend/  # Check only

# Type checking (mypy)
mypy backend/

# Все проверки сразу
ruff check backend/ && black --check backend/ && mypy backend/
```

### Docker (Деплой)

```bash
# ВАЖНО: Запускайте из директории репозитория (~/familyBudget), НЕ из /opt/budget

# Базовый деплой (postgres + backend)
./deploy.sh

# Полный деплой (+ nginx + bot + certbot)
./deploy.sh --profile full

# Пересборка образов
./deploy.sh --build

# Foreground режим (логи в реальном времени)
./deploy.sh --foreground

# Чистый деплой (УДАЛЯЕТ ВСЕ ДАННЫЕ!)
./deploy.sh --clean

# Без миграций
./deploy.sh --no-migrate

# Docker Compose команды (из /opt/budget)
cd /opt/budget
docker compose ps                    # Статус
docker compose logs -f backend       # Логи backend
docker compose restart backend       # Перезапуск
docker compose down                  # Остановка
docker compose exec backend bash     # Shell в контейнере

# Диагностика и логи
./logs.sh                   # Полная диагностика
./logs.sh --save            # Сохранить в файл
./logs.sh --quick           # Только статус
./logs.sh --alert           # Критичные проблемы
./logs.sh --follow backend  # Live tail
```

### Backup & Restore

```bash
# Backup PostgreSQL
./scripts/backup.sh

# Restore backup
./scripts/restore.sh /opt/budget/backups/backup_20251120.sql

# S3 backup (если настроен S3)
./scripts/s3_backup.py
```

### SSL Certificates

```bash
# Управление SSL сертификатами
./scripts/ssl_certificate_manager.sh

# Проверка сертификатов
./scripts/check_certificates.sh

# Очистка старых сертификатов
./scripts/clean_old_certificates.sh
```

## Важные концепции и паттерны

### SCD Type 1 + History Tables

**С версии 5.1.0 изменилась архитектура:**
- **Main tables** (Article, User, etc.) содержат ТОЛЬКО текущее состояние (SCD Type 1)
- **History tables** (ArticleHistory, UserHistory, etc.) хранят ВСЮ историю (SCD Type 2)
- **Преимущества**: Stable PK в fact tables, simple queries, performance

**Примеры:**
```python
# Обновление Article (in-place)
article.name = "New Name"
await session.commit()  # UPDATE, не INSERT

# История автоматически записывается через database triggers или service layer
```

### Hierarchical Categories (Closure Table)

Articles используют **Closure Table** pattern для эффективных иерархических запросов:
- `ArticleHierarchy` - Closure table (ancestor_id, descendant_id, depth)
- Позволяет быстро получить: subtree, ancestors, breadcrumbs, depth

**Примеры:**
```python
# Получить все дочерние категории
subtree = await article_service.get_subtree(article_id)

# Получить все родительские категории
ancestors = await article_service.get_ancestors(article_id)

# Breadcrumbs (от root до article)
breadcrumbs = await article_service.get_breadcrumbs(article_id)
```

### Shared Family Budget Model

**Модель данных:** Проект использует "Shared Family Budget" - все пользователи видят ВСЕ данные.

**Важные особенности:**
- **Articles**: Shared across all users (READ for all, WRITE for admin only)
- **BudgetFact**: Shared - все пользователи видят все транзакции семьи
- **FinancialCenter, CostCenter**: Shared - общие справочники для всей семьи
- **user_id в BudgetFact**: Указывает КТО создал запись, но НЕ ограничивает доступ

**Примеры:**
```python
# ✅ ПРАВИЛЬНО - Shared Budget (все видят всё)
facts = await session.exec(select(BudgetFact))

# ✅ ПРАВИЛЬНО - фильтр по автору (необязательный)
my_facts = await session.exec(
    select(BudgetFact)
    .where(BudgetFact.user_id == current_user.id)
)

# Articles - shared (no filter needed for READ)
articles = await session.exec(select(Article))
```

**При написании тестов:** НЕ ожидать 404 для чужих записей - в Shared Budget все записи доступны всем.

### JWT Authentication

- JWT tokens в **httpOnly cookies** (security)
- Middleware `JWTAuthMiddleware` автоматически проверяет токены
- Refresh tokens в БД (`RefreshToken` model)
- Telegram OAuth для входа (`/auth/telegram` endpoint)

**Защищенные endpoints:**
```python
@router.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    # current_user автоматически из JWT
    return {"user_id": current_user.id}
```

### Background Jobs (Scheduler)

- APScheduler для периодических задач
- `backend/app/scheduler.py` - Конфигурация scheduler
- `bot/jobs/` - Job функции

**Примеры jobs:**
- Weekly report (каждый понедельник)
- Database cleanup
- SSL certificate renewal check

### Validation & Error Handling

**Validation layers:**
1. **Pydantic schemas** - Input validation (API level)
2. **Database constraints** - Data integrity (DB level)
3. **Service layer** - Business logic validation

**Error handling:**
- Custom `APIException` для business errors
- Middleware для обработки всех exceptions
- Structured JSON logging с correlation IDs

### CORS & Security

**CORS:**
```bash
# .env
CORS_ORIGINS=["https://your-domain.com","https://web.telegram.org","https://oauth.telegram.org"]
```

**Security middleware:**
- CSP (Content Security Policy)
- XSS protection headers
- HSTS (Strict Transport Security)
- JWT token validation

## Best Practices & Common Pitfalls

### SQLAlchemy 2.0 AsyncSession

**КРИТИЧЕСКИ ВАЖНО:** Всегда используйте `await` для всех async методов AsyncSession.

**Правильно:**
```python
# Async методы требуют await
await session.execute(query)
await session.commit()
await session.delete(obj)
await session.refresh(obj)
```

**НЕПРАВИЛЬНО (RuntimeWarning):**
```python
# ❌ БЕЗ await - корутина создается, но НЕ выполняется!
session.delete(obj)  # RuntimeWarning: coroutine 'AsyncSession.delete' was never awaited
await session.commit()  # Коммит пустой транзакции - ничего не удалено!
```

**Последствия пропуска `await`:**
- RuntimeWarning в логах
- Корутины не выполняются
- `commit()` коммитит пустую транзакцию
- Данные остаются в БД (несмотря на success логи)
- Очень сложно отловить (код работает, логи пишутся, но ничего не происходит)

**См. также:** `backend/app/api/v1/endpoints/facts.py`, `financial_centers.py`, `cost_centers.py` - примеры правильного использования.

---

### History Tables: Полное копирование полей

**Правило:** При создании записей в History tables (`BudgetFactHistory`, `ArticleHistory`, etc.) ОБЯЗАТЕЛЬНО копировать ВСЕ поля из основной таблицы, включая nullable поля.

**Почему это важно:**
- History таблицы должны сохранять snapshot данных на момент изменения
- NOT NULL constraints в History таблице строже, чем в основной (для data quality)
- Пропущенное поле = constraint violation = rollback транзакции

**Пример (BudgetFactHistory):**
```python
# ✅ ПРАВИЛЬНО - все поля скопированы
fact_history = BudgetFactHistory(
    fact_id=fact.id,
    user_id=fact.user_id,
    article_id=fact.article_id,
    financial_center_id=fact.financial_center_id,  # nullable, но копируем
    cost_center_id=fact.cost_center_id,            # nullable, но копируем
    amount=fact.amount,
    fact_date=fact.fact_date,
    description=fact.description,
    record_type=fact.record_type,  # ⚠️ ОБЯЗАТЕЛЬНО! NOT NULL в history
    transfer_id=fact.transfer_id,  # nullable, но копируем для полноты
    valid_from=datetime.utcnow(),
    is_current=True,
    change_type="CREATE",
)

# ❌ НЕПРАВИЛЬНО - пропущено record_type
fact_history = BudgetFactHistory(
    fact_id=fact.id,
    # ... другие поля ...
    # record_type НЕ скопировано → IntegrityError: null value in column "record_type"
)
```

**Checklist при добавлении полей в основную таблицу:**
1. Добавить поле в основную таблицу (например, `BudgetFact`)
2. ✅ Добавить поле в History таблицу (`BudgetFactHistory`)
3. ✅ Обновить ВСЕ места создания History записей
4. ✅ Создать Alembic миграцию для обеих таблиц

**См. также:** `backend/app/models/budget_fact_history.py:64-84` - docstring с примерами.

---

### RuntimeWarnings: Не игнорировать!

**Правило:** RuntimeWarnings в логах Python/FastAPI ВСЕГДА указывают на проблему в коде.

**Типичные warnings и их значения:**

| Warning | Root Cause | Последствия |
|---------|-----------|-------------|
| `coroutine ... was never awaited` | Пропущен `await` для async функции | Код не выполняется |
| `Enable tracemalloc to get the object allocation traceback` | Следствие первого warning | Помогает найти место проблемы |
| `ResourceWarning: unclosed ...` | Не закрыт file/socket/connection | Memory leak |

**Как отлавливать:**
```bash
# Мониторинг логов на warnings
docker compose logs backend | grep -i "warning"

# Включить tracemalloc для debugging (добавить в backend/app/main.py)
import tracemalloc
tracemalloc.start()
```

**⚠️ ВАЖНО:** Если в логах `status_code: 200` И одновременно RuntimeWarning → операция НЕ выполнилась, несмотря на success response!

---

### Testing: Проверять БД после операций

**Правило:** После операций изменения данных (CREATE/UPDATE/DELETE) ВСЕГДА проверять фактическое состояние БД, а не только HTTP статус коды.

**Почему HTTP 200 != Successful Operation:**
- Async корутины могут не выполниться (см. выше)
- Логирование происходит ДО commit (может rollback после)
- Middleware может перехватить ошибки и вернуть 200

**Best practice testing workflow:**

```bash
# 1. Выполнить операцию через API
curl -X DELETE https://example.com/api/v1/admin/articles/45

# 2. ✅ ОБЯЗАТЕЛЬНО: Проверить БД
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT COUNT(*) FROM t_d_article WHERE id = 45;"

# 3. Проверить логи на warnings/errors
docker compose logs backend | grep -A10 "DELETE.*articles/45" | grep -i "warning\|error"

# 4. Для DELETE операций: проверить History tables
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT change_type, COUNT(*) FROM t_d_article_history WHERE article_id = 45 GROUP BY change_type;"
```

**SQL запросы для проверки:**
```sql
-- После DELETE: проверить что записи удалены
SELECT COUNT(*) FROM t_f_budget_fact WHERE article_id = 45;  -- Должно быть 0

-- Проверить что History записи созданы
SELECT COUNT(*) FROM t_f_budget_fact_history
WHERE article_id = 45 AND change_type = 'DELETE';  -- Должно быть > 0

-- Проверить что все поля заполнены (нет NULL в NOT NULL колонках)
SELECT COUNT(*) FROM t_f_budget_fact_history
WHERE article_id = 45 AND record_type IS NULL;  -- Должно быть 0
```

**Integration тесты должны:**
1. ✅ Вызвать API endpoint
2. ✅ Проверить HTTP статус код
3. ✅ **Проверить БД напрямую** (SELECT после INSERT/UPDATE/DELETE)
4. ✅ Проверить History tables (для SCD Type 2)
5. ✅ Проверить логи на warnings

**См. также:** `tests/integration/test_article_deletion.py` (если создан).

---

## Workflow для обновления приложения

**Критически важно понимать три директории:**
1. **Репозиторий** (`~/familyBudget`) - Исходный код, git clone
2. **Deployment** (`/opt/budget`) - Рабочая копия для Docker
3. **Docker volumes** - Данные БД, логи (персистентные)

**Правильный workflow:**
```bash
# 1. Обновить код в репозитории
cd ~/familyBudget
git pull origin main

# 2. Синхронизировать в /opt/budget
./setup.sh

# 3. Применить изменения
./deploy.sh --profile full
```

**Частые ошибки:**
```bash
# ❌ НЕПРАВИЛЬНО (копирует сам в себя)
cd /opt/budget
./setup.sh

# ✅ ПРАВИЛЬНО
cd ~/familyBudget  # Репозиторий
./setup.sh         # Копирует в /opt/budget
```

## Тестирование и деплой на удаленный сервер (SSH)

**ВАЖНО**: Всегда тестируйте изменения на тестовом сервере `budget-test` перед деплоем в production.

### Workflow: Обновление существующего деплоя

Используется для тестирования изменений на уже работающем сервере.

```bash
# 1. Подключиться по SSH к тестовому серверу
ssh budget-test

# 2. Обновить код из репозитория
cd ~/familyBudget
git pull origin main
# или для конкретной ветки:
# git pull origin feature-branch

# 3. Деплой с умными опциями
sudo bash deploy.sh --sync-mode update --cleanup-mode smart

# Опции deploy.sh:
# --sync-mode update     - Синхронизировать только измененные файлы
# --cleanup-mode smart   - Умная очистка (удалить старые сети, сохранить данные)
# --profile full         - Запустить все сервисы (backend + bot + nginx)
# --build                - Пересобрать Docker образы
# --no-migrate           - Пропустить миграции БД

# 4. ВАЖНО: Анализ результатов деплоя
# Проанализировать логи терминала процесса установки
# После успешного завершения проанализировать:
cat /opt/budget/logs/deploy.log

# Ключевые моменты в логах:
# - Успешная синхронизация файлов
# - Docker build без ошибок
# - Контейнеры запустились и стали healthy
# - Миграции БД применились без ошибок
# - Health checks проходят

# 5. Запустить полную диагностику
cd ~/familyBudget
sudo bash logs.sh

# Проанализировать вывод:
# ✓ Container Status - все контейнеры в состоянии "healthy"
# ✓ Health Checks - все endpoints отвечают
# ✓ Backend Errors - нет critical errors
# ✓ Database Status - подключение работает
# ✓ Bot Status - бот активен
# ✓ Nginx Status - проксирование работает
# ✓ Resource Usage - нет превышения лимитов
# ⚠ Warnings - проанализировать предупреждения

# 6. Проанализировать логи запущенных контейнеров
cd /opt/budget

# Логи backend (последние 100 строк)
docker compose logs --tail=100 backend

# Логи с ошибками
docker compose logs backend | grep -i error
docker compose logs backend | grep -i critical

# Логи PostgreSQL
docker compose logs --tail=50 postgres

# Логи бота
docker compose logs --tail=50 bot

# Логи Nginx (если используется)
docker compose logs --tail=50 nginx

# Live tail (следить в реальном времени)
docker compose logs -f backend

# 7. Функциональное тестирование
# - Проверить веб-интерфейс: http://<server-ip>:8000
# - Проверить Swagger docs: http://<server-ip>:8000/docs
# - Проверить health endpoint: http://<server-ip>:8000/health
# - Проверить Telegram бота (отправить /start)
# - Проверить Telegram Web Apps (Menu Button)
# - Создать тестовую транзакцию
# - Проверить отчеты и статистику

# 8. Если обнаружены проблемы:
# - Зафиксировать проблемы из логов (скопировать stack traces)
# - Сохранить диагностику: sudo bash logs.sh --save
# - Выйти с сервера (exit)
# - Исправить проблемы локально в скриптах/коде
# - Сделать коммит и пуш:
#   git add .
#   git commit -m "fix: описание исправления"
#   git push origin main
# - Вернуться к шагу 1 (SSH и git pull)

# 9. Если всё работает:
# - Пометить тест как успешный
# - Можно деплоить в production
```

### Типичные проблемы и их диагностика

**1. Контейнер не запускается**
```bash
# Проверить статус
docker compose ps

# Проверить логи
docker compose logs <service-name>

# Проверить конфигурацию
docker compose config

# Проверить переменные окружения
docker compose exec <service-name> env
```

**2. Миграции БД не применяются**
```bash
# Проверить текущую версию БД
docker compose exec backend alembic current

# Применить вручную
docker compose exec backend alembic upgrade head

# Логи миграций
grep -i "alembic\|migration" /opt/budget/logs/deploy.log
```

**3. Backend возвращает 500 ошибки**
```bash
# Проверить логи backend
docker compose logs backend | grep -i "error\|exception"

# Проверить подключение к БД
docker compose exec backend env | grep DATABASE_URL
docker compose exec postgres psql -U familybudget -c "SELECT 1;"

# Проверить health endpoint
curl http://localhost:8000/health
```

**4. Telegram бот не отвечает**
```bash
# Проверить статус бота
docker compose logs bot | tail -50

# Проверить токен
docker compose exec bot env | grep TELEGRAM_BOT_TOKEN

# Проверить подключение к backend
docker compose exec bot curl http://backend:8000/health
```

**5. Frontend не обновляется после изменений**
```bash
# Проверить синхронизацию файлов
ls -la /opt/budget/frontend/web/static/css/

# Пересобрать образы
cd ~/familyBudget
./deploy.sh --build --profile full

# Очистить кеш браузера (Ctrl+Shift+R)
```

### Чеклист перед деплоем в production

После успешного тестирования на `budget-test`:

- [ ] Все контейнеры запустились и healthy
- [ ] Health checks проходят (/health, /ready, /ping)
- [ ] Нет critical/error в логах backend
- [ ] PostgreSQL подключение работает
- [ ] Миграции БД применились успешно
- [ ] Telegram бот отвечает на команды
- [ ] Telegram Web Apps открываются
- [ ] Можно создать/прочитать транзакцию
- [ ] Отчеты и статистика загружаются
- [ ] SSL сертификаты валидны (если используется)
- [ ] Resource usage в пределах нормы
- [ ] Логи не содержат memory leaks/performance issues
- [ ] Backup/restore работают

**После прохождения всех проверок** - можно деплоить в production.

## База данных

### Важные таблицы

```sql
-- Dimensions (SCD Type 1 + History)
t_d_article                -- Категории (current)
t_d_article_history        -- Категории (history)
t_d_user                   -- Пользователи (current)
t_d_user_history           -- Пользователи (history)
t_d_financial_center       -- Финансовые центры
t_d_cost_center            -- Центры затрат

-- Facts
t_f_budget_fact            -- Транзакции
t_f_budget_fact_history    -- Транзакции (history)

-- Hierarchy
t_d_article_hierarchy      -- Closure table

-- Service tables
t_refresh_token            -- JWT refresh tokens
t_notification             -- Уведомления
t_import_staging           -- Staging для импорта
```

### Полезные SQL запросы

```sql
-- Проверить миграции
SELECT version_num FROM alembic_version;

-- Размеры таблиц
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Медленные запросы (требуется pg_stat_statements)
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Неиспользуемые индексы
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE 'pg_toast%';
```

## API Endpoints

### Authentication
- `POST /auth/telegram` - Telegram OAuth login
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout

### REST API v1
- `/api/v1/articles` - CRUD категорий
- `/api/v1/facts` - CRUD транзакций
- `/api/v1/financial-centers` - CRUD финансовых центров
- `/api/v1/cost-centers` - CRUD центров затрат
- `/api/v1/users` - User management (admin)

### Web Pages (HTMX)
- `/` - Home page
- `/transactions` - Transactions list
- `/statistics` - Statistics dashboard
- `/admin` - Admin panel

### Telegram Web Apps
- `/webapp/` - Main menu
- `/webapp/add.html` - Add transaction
- `/webapp/history.html` - Transaction history
- `/webapp/stats.html` - Statistics

### Health Checks
- `/ping` - Simple ping
- `/health` - Basic health check
- `/ready` - Readiness probe
- `/health/detailed` - Detailed diagnostics

## Дополнительные ресурсы

- **START.md** - Полная инструкция по деплою
- **docs/prd/** - Product Requirements Documents
- **docs/api/API_DOCUMENTATION.md** - API документация
- **scripts/README.md** - Документация скриптов
- **tests/README.md** - Testing guide
- **sql/README.md** - SQL queries documentation
