# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

---

## Проект: Family Budget

Полнофункциональная система управления семейным бюджетом с Telegram Bot интерфейсом и веб-аналитикой.

**Версия:** 5.0.0-beta
**Архитектура:** FastAPI (Backend) + Telegram Bot + PostgreSQL + HTMX (Frontend)

---

## ⚠️ ВАЖНО: Фаза разработки

**Текущий статус:** DEVELOPMENT MODE

### Правила работы с миграциями БД

**КРИТИЧНО для разработки:**

✅ **МОЖНО делать:**
- Изменять существующие миграции напрямую (001-012)
- Редактировать SQL файлы в `backend/db/migrations/`
- Менять структуру таблиц в уже созданных миграциях
- НЕ создавать новые миграции для изменений (пока в разработке)

✅ **ОБЯЗАТЕЛЬНО делать:**
- Отражать изменения в ПРД (`docs/prd/06-database-design.md`)
- Согласовывать архитектурные изменения перед реализацией
- Обновлять Changelog в ПРД
- Тестировать миграции на чистой БД

❌ **НЕ нужно:**
- Создавать миграции типа `014_update_xxx.sql` для изменений
- Сохранять backward compatibility для production
- Беспокоиться о существующих данных

**Причина:** При тестировании и deployment вся БД **накатывается с нуля** на чистую систему.

**Workflow изменения БД:**
1. Определить требование → согласовать с командой
2. Изменить существующую миграцию (например, 011_create_notifications_table.sql)
3. Обновить ПРД (docs/prd/06-database-design.md)
4. Обновить CLAUDE.md (этот файл)
5. Тестировать: `docker compose down -v && docker compose up -d`

**Переход в production:**
- Все миграции будут применены к fresh PostgreSQL
- Контрольные точки: alpha → beta → production
- После релиза - переход на версионирование миграций

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

1. **WebApp файлы** (webapp/*.html, webapp/static/*)
   - Монтируются как volume (read_only)
   - Изменения применяются **сразу** (без пересборки)
   - Но требуется очистка кэша браузера (Ctrl+F5)

2. **Python код** (backend/, bot/) - БЕЗ изменений БД
   - Требуется **пересборка образа** и **перезапуск контейнеров**
   - **ВАЖНО:** Используйте **Smart cleanup (опция [2])** - автоматически определяет стратегию
   ```bash
   cd ~/familyBudget && git pull
   sudo bash deploy.sh
   # Выбрать sync mode: [2] Update only
   # Выбрать cleanup: [2] Smart cleanup (RECOMMENDED) ✓
   # Скрипт автоматически оставит PostgreSQL работающим
   ```

3. **DB schema изменения** (миграции, новые таблицы)
   - Smart cleanup **автоматически определит** что нужен перезапуск PostgreSQL
   ```bash
   cd ~/familyBudget && git pull
   sudo bash deploy.sh
   # Выбрать sync mode: [2] Update only
   # Выбрать cleanup: [2] Smart cleanup
   # Скрипт автоматически остановит PostgreSQL для миграций
   ```

4. **Docker конфигурация** (docker-compose.yml, Dockerfile)
   - Требуется **пересборка** и **перезапуск**
   - Smart cleanup автоматически определяет необходимость перезапуска

**⚡ Cache Busting (АВТОМАТИЗИРОВАНО):**

**КРИТИЧНО:** При изменении статических файлов (JS/CSS) требуется обновление версий для очистки браузерного кэша.

✅ **Автоматически при деплое:**
```bash
cd ~/familyBudget && git pull
sudo ./deploy.sh
# Cache busting выполняется АВТОМАТИЧЕСКИ перед sync_code_to_deploy()
# Генерируется новая версия на основе timestamp: YYYYMMDD_HHMM
```

✅ **Ручное управление версиями:**
```bash
# Проверить текущие версии во всех файлах
./scripts/lib/cache_busting.sh check

# Обновить версии вручную (авто-генерация timestamp)
./scripts/lib/cache_busting.sh auto

# Обновить версии с указанной версией
./scripts/lib/cache_busting.sh manual
```

**Какие файлы затрагиваются:**
- `webapp/add.html`, `webapp/addplan.html`, `webapp/edit.html`
- `web/templates/facts.html`, `web/templates/plan.html`
- Обновляются версии: `tomSelectCategoryTree.js?v=YYYYMMDD_HHMM`

**❌ НЕ НУЖНО вручную править версии:**
```html
<!-- ❌ WRONG: Ручное изменение версии -->
<script src="/static/js/tomSelectCategoryTree.js?v=20251103_1234"></script>

<!-- ✅ CORRECT: Версия обновится автоматически при деплое -->
<script src="/static/js/tomSelectCategoryTree.js?v=GENERATED"></script>
```

**Workflow при изменении JS/CSS:**
1. Изменить файл (например, `webapp/static/js/tomSelectCategoryTree.js`)
2. Закоммитить: `git commit -m "fix: update tomSelect logic"`
3. Push: `git push`
4. На сервере: `cd ~/familyBudget && git pull && sudo ./deploy.sh`
5. ✅ Cache busting сработает автоматически, версии обновятся

**Зачем это нужно:**
- Браузеры кэшируют JS/CSS файлы агрессивно
- Без обновления версии пользователи получают старый код
- Автоматическая генерация версий предотвращает проблемы с кэшем

**Интеграция в deploy.sh:**
```bash
# deploy.sh (строка ~341)
validate_env
echo ""

# Update cache versions before synchronization
run_cache_busting "auto" "$SCRIPT_DIR"  # ← АВТОМАТИЧЕСКИ
echo ""

# Synchronize code from repository to /opt/budget
sync_code_to_deploy
```

**Deployment стратегии (автоматические):**

| Изменения | Cleanup опция | PostgreSQL | Downtime |
|-----------|---------------|------------|----------|
| Frontend/Bot/Backend код | [2] Smart cleanup | Продолжает работать ✓ | ~10 сек |
| DB migrations | [2] Smart cleanup | Автоматически перезапускается | ~30 сек |
| docker-compose.yml | [2] Smart cleanup | Автоматически перезапускается | ~30 сек |
| .env (POSTGRES_*) | [2] Smart cleanup | Автоматически перезапускается | ~30 сек |
| Полная очистка данных | [3] Full cleanup | Удаляется ⚠️ | - |

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
docker exec familybudget-backend cat /app/webapp/add.html | head -20  # Проверка файла в контейнере
```

### Remote Server Execution (ВАЖНО для Claude Code)

⚠️ **Критично:** Production код находится на УДАЛЕННОМ сервере.

**Правила для анализа:**
1. НЕ выполняй команды локально для анализа production
2. Формируй batch команды для одного SSH сеанса
3. Используй только read-only команды для диагностики

**Рабочие каталоги:**
- Локально (`~/familyBudget`): Development, git
- На сервере (`/opt/budget`): Production, Docker

**Пример диагностики:**
```bash
ssh user@server 'bash -s' << 'EOF'
  docker ps
  ls -la /opt/budget/data/postgres
  tail /opt/budget/logs/backend.log
EOF
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

3. **Shared References Architecture** (dimension таблицы)
   - **All dimension records shared** across all users (articles, financial_centers, cost_centers)
   - **Admin-only management:** Only admins can CREATE/UPDATE/DELETE dimension records
   - **All users READ:** All users can view all dimension records
   - **NO user isolation** для dimension таблиц - НЕ фильтруй по `user_id`!
   - `user_id` используется только для audit trail (кто создал запись)
   - 📖 **Детали:** [api-development skill](/.claude/skills/api-development/SKILL.md)

4. **Shared Family Budget Model** (fact таблицы)
   - ⚠️ **ИЗМЕНЕНО 2025-11-02:** Fact таблицы (`t_f_budget_fact`) теперь **SHARED**
   - Все аутентифицированные пользователи видят **ВСЕ транзакции**
   - Analytics endpoints и CRUD endpoints **БЕЗ user_id фильтрации**
   - `user_id` сохраняется только для **audit trail** (кто создал запись)
   - Соответствует принципу "Семейная прозрачность" из ПРД
   - 📖 **Детали:** См. раздел [Shared Family Budget Model](#shared-family-budget-model) ниже

5. **Telegram OAuth**
   - Аутентификация через Telegram с HMAC-SHA256
   - JWT tokens в httpOnly cookies (7 дней)
   - Bot использует `SessionManager` для хранения токенов

---

## Критически важная информация

### Security Guidelines (ОБЯЗАТЕЛЬНО)

✅ **ВСЕГДА делать:**

1. **Dimension tables (Shared References)** - admin-only management:
   ```python
   # CREATE/UPDATE/DELETE - только админы
   if not current_user.is_admin:
       raise HTTPException(403, "Only administrators can modify articles")

   # GET - БЕЗ фильтрации (все пользователи видят все)
   stmt = select(Article).where(Article.is_current == True)  # NO user_id filter!
   ```

2. **Fact tables (Shared Family Budget)** - БЕЗ user_id фильтрации:
   ```python
   # t_f_budget_fact - shared family budget (все видят все)
   stmt = select(BudgetFact)  # NO user_id filter!

   # user_id сохраняется только для audit trail при создании
   fact = BudgetFact(**data, user_id=current_user.id)
   ```

3. **SCD Type 2** - использовать `SCD2Service` для updates:
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
2. **Добавление user_id фильтров к fact таблицам** - Fact tables теперь shared (см. Shared Family Budget Model)
3. **Хранение JWT в localStorage** - ТОЛЬКО httpOnly cookies
4. **Прямая работа с Closure Table** - ТОЛЬКО через `HierarchyService`

📖 **Подробнее:** См. соответствующие [Skills](#-claude-skills)

---

## Notifications (Broadcast Model)

### Ключевые особенности

**Broadcast архитектура** - уведомления отправляются ВСЕМ пользователям:

- `user_id=NULL` → broadcast для всех зарегистрированных пользователей
- Unique constraint предотвращает дубликаты: `(article_id, notification_type, period_start, period_end) WHERE user_id IS NULL`
- Shared budget model: все видят все уведомления (NO user isolation)

### API Endpoints

```python
# Backend API
POST   /api/v1/notifications              # Создать уведомление
GET    /api/v1/notifications              # Список с фильтрацией
GET    /api/v1/notifications/check-duplicate  # Проверка дубликатов
GET    /api/v1/users/telegram-ids         # Список telegram_id для broadcast
GET    /notifications                      # Web UI страница
```

### Bot Integration

```python
# bot/utils/notification_service.py
await notification_service.check_budget_threshold(
    token=token,
    telegram_id=user_id,  # Not used for broadcast
    article_id=article_id,
    threshold_percent=90
)
```

**Workflow:**
1. Проверить дубликат через API: `check_duplicate_notification()`
2. Получить все telegram_ids: `get_all_telegram_ids()`
3. Отправить broadcast ВСЕМ пользователям
4. Сохранить в БД: `create_notification(user_id=None)`

### Database Schema

```sql
CREATE TABLE t_notification (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,  -- NULLABLE: NULL = broadcast
    article_id INTEGER NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    threshold_percent INTEGER DEFAULT 90,
    plan_amount NUMERIC(15,2) NOT NULL,
    actual_amount NUMERIC(15,2) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint for broadcast notifications
    CONSTRAINT idx_notification_unique_broadcast UNIQUE (
        article_id, notification_type, period_start, period_end
    ) WHERE user_id IS NULL
);
```

### Web UI

- `/notifications` - История уведомлений для всех пользователей
- Фильтры: тип (threshold/exceeded/reports), даты
- Статистика: всего, warnings (90%), exceeded (100%+)
- Пагинация: 50 записей на страницу

### ⚠️ ВАЖНО

**NO USER ISOLATION** для notifications:
- Все пользователи видят все уведомления
- Broadcast модель для shared family budget
- НЕ применяй `WHERE user_id = current_user.id` к t_notification!

---

## Shared Family Budget Model

⚠️ **АРХИТЕКТУРНОЕ ИЗМЕНЕНИЕ (2025-11-02):** Переход от isolated к shared модели для fact таблиц.

### Концепция

**Семейная прозрачность** - все члены семьи видят общий бюджет:

- Все аутентифицированные пользователи видят **ВСЕ транзакции**
- Любой пользователь может **создавать, редактировать, удалять** любые транзакции
- `user_id` сохраняется только для **audit trail** (кто создал/изменил запись)
- Соответствует принципу "Семейная прозрачность" из ПРД

### Затронутые endpoints

**Analytics endpoints** (`/api/v1/analytics/*`) - БЕЗ user_id фильтрации:
- `/quick-stats` - быстрая статистика за сегодня и месяц
- `/quick-stats-html` - HTML версия статистики
- `/plan-fact` - план vs факт по периодам
- `/trends` - тренды доходов/расходов
- `/category-breakdown` - разбивка по категориям
- `/waterfall` - кумулятивный поток
- `/heatmap` - тепловая карта расходов

**CRUD endpoints** (`/api/v1/facts/*`) - БЕЗ user_id фильтрации и ownership checks:
- `GET /facts` - список транзакций (все видят все)
- `GET /facts/{id}` - получение транзакции (без проверки ownership)
- `POST /facts` - создание транзакции (`user_id` сохраняется для audit)
- `PUT /facts/{id}` - обновление транзакции (без проверки ownership)
- `DELETE /facts/{id}` - удаление транзакции (без проверки ownership)
- `GET /facts/summary` - агрегированная сводка (все транзакции)
- `GET /facts/recent-html` - недавние транзакции HTML (все транзакции)

### Примеры кода

**✅ ПРАВИЛЬНО (Shared Family Budget):**

```python
# Analytics - БЕЗ фильтрации
query = select(
    func.sum(Fact.amount).label("total")
).select_from(Fact).where(
    # Shared family budget - NO user_id filter
    Fact.fact_date >= start_date
).group_by(Article.type)

# CRUD List - БЕЗ фильтрации
statement = select(BudgetFact)
# Shared family budget - NO user isolation filter
# All authenticated users see all transactions

# CRUD Get - БЕЗ ownership check
fact = await session.get(BudgetFact, fact_id)
if not fact:
    raise HTTPException(404)
# Shared family budget - NO ownership check
return fact

# CRUD Create - user_id для audit trail
fact = BudgetFact(
    **data,
    user_id=current_user.id,  # Audit trail only
)
```

**❌ НЕПРАВИЛЬНО (Старая isolated модель):**

```python
# ❌ НЕ добавляй user_id фильтры!
query = select(Fact).where(
    Fact.user_id == current_user.id  # ❌ WRONG!
)

# ❌ НЕ используй apply_user_filter!
statement = apply_user_filter(statement, current_user)  # ❌ WRONG!

# ❌ НЕ проверяй ownership!
ensure_user_owns_resource(fact.user_id, current_user)  # ❌ WRONG!
```

### Обоснование

**Из ПРД (Product Requirements Document):**
- **Принцип:** "Семейная прозрачность - общий бюджет, личные данные"
- **Target Audience:** Семья из 2-5 человек
- **Use Case:** Все члены семьи должны видеть общий бюджет

**Consistency с другими компонентами:**
- ✅ Dimension tables (articles, financial_centers, cost_centers) - уже shared
- ✅ Notifications - broadcast model (`user_id=NULL`)
- ✅ Fact tables - теперь тоже shared

### Security implications

✅ **Безопасность сохранена:**
- Все пользователи **аутентифицированы** (Telegram OAuth + JWT)
- Доступ только для **членов семьи** (shared family system)
- `user_id` сохраняется для **audit trail**
- Admin-only management для dimension tables (не изменено)

### Migration notes

**NO DATABASE CHANGES** - схема БД не изменилась:
- `user_id` остается в `t_f_budget_fact` (для audit trail)
- Изменения только в **application logic** (backend endpoints)
- **Breaking change** в поведении API endpoints

**Что НЕ изменилось:**
- Database schema - без изменений
- Authentication/Authorization - без изменений
- Dimension tables management - admin-only (как раньше)

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
# Профили
./deploy.sh --profile full          # Full stack (+ bot + nginx)

# Sync modes (non-interactive)
./deploy.sh --sync-mode mirror      # Recommended: rsync --delete
./deploy.sh --sync-mode update      # rsync без удаления старых файлов
./deploy.sh --sync-mode skip        # Deploy без синхронизации кода

# Cleanup options
./deploy.sh --clean                 # Full cleanup (удаляет все данные!)

# Комбинации
./deploy.sh --sync-mode mirror --profile full
./deploy.sh --no-migrate            # Skip database migrations
```

### ⚠️ КРИТИЧНО: Правильный запуск deploy.sh

**✓ ПРАВИЛЬНО:**
```bash
cd ~/familyBudget          # Git repository
sudo ./deploy.sh           # Относительный путь
```

**✗ НЕПРАВИЛЬНО:**
```bash
cd /opt/budget             # Production directory
sudo ./deploy.sh           # ❌ Модули не найдены!

sudo /opt/budget/deploy.sh  # ❌ То же самое
```

**Почему:**
- deploy.sh загружает модули из `scripts/lib/` в repository
- /opt/budget содержит только runtime файлы (создаются синхронизацией)
- SCRIPT_DIR определяется относительно расположения deploy.sh

**Non-interactive режим:**
- Используйте `--sync-mode` для автоматического выбора sync стратегии
- При отсутствии TTY (pipe, automation) используется `mirror` по умолчанию
- `--clean` флаг автоматически выбирает full cleanup без подтверждения

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
2. Соблюдай **Shared References** для dimension таблиц - admin-only management, NO user_id filter
3. Соблюдай **User Data Isolation** для fact таблиц - фильтруй по `current_user.id`
4. Используй **SCD2Service** для dimension таблиц
5. Используй **HierarchyService** для работы с иерархиями
6. Добавляй **тесты** для всех новых features
7. Проверяй **security** - JWT, admin-only access для dimension tables, validation
8. Проверяй **performance** - indexes, N+1 queries
9. Документируй **breaking changes**
10. **НЕ редактируй вручную версии** в `?v=` параметрах - используй автоматический cache busting при деплое

💡 **Не уверен как сделать?** → Посмотри соответствующий [Skill](#-claude-skills)

---

**Версия документа:** 2.1 (+ автоматический cache busting)
**Последнее обновление:** 2025-11-03
**Формат:** Компактный + ссылки на Skills
