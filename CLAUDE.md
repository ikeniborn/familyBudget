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
# Backend development server (ВАЖНО: запускать из корня проекта!)
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Или если используется virtual environment:
source venv/bin/activate
uvicorn backend.app.main:app --reload

# Telegram Bot (требует запущенный backend)
cd bot && python main.py

# Docker (production) - ВАЖНО: запускать из git repository!
cd ~/familyBudget && ./deploy.sh --profile full

# База данных (development mode - можно редактировать миграции напрямую)
docker compose down -v && docker compose up -d  # Пересоздать БД

# npm окружение (производственная среда - только если нужна переустановка)
sudo ./install.sh  # Создает /opt/budget/.npm-isolated (233 пакета)
```

---

## 🏗️ npm Изолированное окружение (ВАЖНО - Новая архитектура 2025-11-08)

**Расположение:** `/opt/budget/.npm-isolated/` (production-only)

**Архитектурное изменение:**
- ❌ **Старый подход:** npm окружение в `~/familyBudget/.npm-isolated` → копируется через rsync
- ✅ **Новый подход:** npm окружение в `/opt/budget/.npm-isolated` → **НЕ копируется** (excluded from sync)

**Преимущества:**
- Faster deploys (~100-200MB не копируется при каждом deploy)
- Нет permission issues при rsync
- Четкое разделение: source code (repo) vs build tools (production)

**Защита от удаления (КРИТИЧНО):**
- **Проблема:** `rsync --delete` удаляет файлы из destination, которых нет в source
- **Решение:** `--filter='protect .npm-isolated/'` предотвращает удаление
- **Где применяется:** `scripts/lib/sync.sh` - все rsync команды с `--delete` флагом

```bash
# ✅ ПРАВИЛЬНО - с защитой:
rsync -avc --delete \
    --filter='protect .npm-isolated/' \
    --exclude='.npm-isolated/' \
    ~/familyBudget/ /opt/budget/

# ❌ НЕПРАВИЛЬНО - будет удалено:
rsync -avc --delete \
    --exclude='.npm-isolated/' \  # ← НЕ защищает при --delete!
    ~/familyBudget/ /opt/budget/
```

**Установка:**
```bash
sudo ./install.sh  # Создает /opt/budget/.npm-isolated с 233 пакетами
```

**Проверка:**
```bash
ls -la /opt/budget/.npm-isolated/node_modules  # Должно быть 194 директории
cat /opt/budget/.npm-isolated/.npmrc           # Абсолютный путь (не ${PROJECT_DIR})
```

**Pre-flight checks:**
- ДО синхронизации: проверка существования npm environment
- ПОСЛЕ синхронизации: проверка что НЕ был удален
- При ошибке: детальное сообщение с инструкциями по восстановлению

---

## 🧪 Тестирование

### Запуск тестов

```bash
# Все тесты
pytest

# Только unit тесты (быстрые, изолированные)
pytest -m unit

# Только integration тесты (требуют backend/db)
pytest -m integration

# E2E тесты (требуют полный стек)
pytest -m e2e

# Тесты для конкретного модуля
pytest tests/unit/backend/test_webapp_auth.py

# С coverage и HTML репортом
pytest --cov=backend --cov-report=html

# Quality checks
ruff check .          # Linting
black .               # Formatting
mypy .                # Type checking
```

### Структура тестов

```
tests/
├── conftest.py          # Fixtures (AsyncClient, test DB session)
├── unit/                # Изолированные тесты (моки)
│   ├── backend/         # Backend unit tests
│   └── webapp/          # Webapp unit tests
├── integration/         # Тесты с реальным DB
│   ├── backend/         # Backend integration tests
│   └── webapp/          # Webapp integration tests
└── e2e/                 # End-to-end тесты (TODO)
```

### Test Markers

Используй pytest markers для категоризации тестов:

```python
@pytest.mark.unit
def test_fast_isolated_logic():
    """Быстрый тест без внешних зависимостей"""
    pass

@pytest.mark.integration
async def test_with_database(session: AsyncSession):
    """Тест с реальной БД"""
    pass

@pytest.mark.slow
def test_slow_operation():
    """Медленный тест (>1 секунда)"""
    pass
```

---

### Ключевые файлы для изучения

**Backend архитектура:**
- `backend/app/main.py:39-96` - Lifespan startup/shutdown с scheduler
- `backend/app/api/v1/router.py` - URL routing всех endpoints
- `backend/app/middleware/jwt_middleware.py:20-50` - JWT authentication

**Критичные паттерны:**
- `backend/app/services/scd2_service.py:34-90` - SCD Type 2 implementation
- `backend/app/services/hierarchy_service.py:31-80` - Closure Table queries
- `backend/app/core/dependencies.py:15-40` - CurrentUser dependency

**Bot:**
- `bot/main.py` - Bot initialization и handlers registration
- `bot/handlers/add.py` - ConversationHandler пример (multi-step)
- `bot/utils/api_client.py` - Backend API client

---

## 🏗️ Архитектура Backend (Layered Pattern)

```
Request Flow:
┌─────────────────────────────────────────────────────────────┐
│ Request → Middleware → Router → Endpoint → Service → Model  │
│            ↓            ↓         ↓          ↓        ↓      │
│         JWT Auth     URL       HTTP       Business  SQLModel │
│         Logging    Routing   Handler      Logic    Database  │
└─────────────────────────────────────────────────────────────┘
```

**Реальная структура по слоям:**

| Слой | Файл | Назначение | Пример |
|------|------|-----------|--------|
| **Middleware** | `backend/app/middleware/jwt_middleware.py` | JWT auth, logging, CSP | `JWTAuthMiddleware` |
| **Router** | `backend/app/api/v1/router.py` | URL routing | `/api/v1/facts` → `facts.py` |
| **Endpoint** | `backend/app/api/v1/endpoints/facts.py` | HTTP handlers | `@router.post("/facts")` |
| **Service** | `backend/app/services/scd2_service.py` | Business logic | `create_new_version()` |
| **Model** | `backend/app/models/fact.py` | SQLModel ORM | `class BudgetFact(SQLModel)` |
| **Schema** | `backend/app/schemas/fact.py` | Pydantic validation | `class FactCreate(BaseModel)` |

**Зачем нужен каждый слой:**
- **Middleware**: Cross-cutting concerns (auth, logging)
- **Router**: URL маршрутизация
- **Endpoint**: HTTP request/response handling
- **Service**: Бизнес-логика (переиспользуемая между endpoints)
- **Model**: Database schema и ORM
- **Schema**: Input/output validation

---

## ⚠️ Критически важные паттерны (с примерами из кода)

### 1. SCD Type 2 (Slowly Changing Dimension Type 2)

**Что это:** Паттерн для хранения полной истории изменений с версионированием.

**Где используется:**
- `t_d_user` - история изменений пользователей (роли, имена)
- `t_d_article` - история изменений категорий бюджета
- `t_d_financial_center` - история изменений ЦФО
- `t_d_cost_center` - история изменений МВЗ

**Реальный код из проекта:**

```python
# backend/app/services/scd2_service.py:34-78
async def create_new_version(
    session: AsyncSession,
    old_instance: T,
    updates: Dict[str, Any],
    changed_fields: Optional[list[str]] = None,
) -> T:
    """
    Create new SCD Type 2 version by closing old version and creating new one.

    Steps:
    1. Closes old version (is_current=False, valid_to=now)
    2. Creates new version with updated fields
    3. Commits atomically
    """
    now = datetime.now()

    # Step 1: Close old version
    old_instance.is_current = False
    old_instance.valid_to = now
    session.add(old_instance)

    # Step 2: Create new version
    new_instance = old_instance.__class__(**{
        **old_instance.model_dump(exclude={'id', 'valid_from', 'valid_to', 'is_current'}),
        **updates,
        'valid_from': now,
        'valid_to': datetime(9999, 12, 31),
        'is_current': True,
    })
    session.add(new_instance)

    # Step 3: Commit atomically
    await session.commit()
    await session.refresh(new_instance)
    return new_instance
```

**Использование в endpoints:**

```python
# ✅ ПРАВИЛЬНО - используй SCD2Service для updates
from backend.app.services.scd2_service import create_new_version

# В endpoint для обновления article:
old_article = await get_current_version(session, Article, article_id)
new_article = await create_new_version(session, old_article, updates)

# ❌ НЕПРАВИЛЬНО - прямой UPDATE
article.name = "New Name"
await session.commit()  # ← Потеряется история изменений!
```

---

### 2. Closure Table (для иерархий категорий)

**Что это:** Паттерн для эффективных иерархических запросов с O(1) сложностью.

**Где используется:**
- `t_d_article_hierarchy` - хранит все ancestor-descendant пары для категорий

**Реальный код из проекта:**

```python
# backend/app/services/hierarchy_service.py:31-56
async def get_subtree(
    session: AsyncSession,
    article_id: int,
    max_depth: Optional[int] = None,
    include_self: bool = True,
) -> list[Article]:
    """
    Get all descendants of an article (subtree).

    Uses closure table for efficient O(1) query.
    No recursive queries needed - all paths precomputed!
    """
    query = (
        select(Article)
        .join(ArticleHierarchy, Article.id == ArticleHierarchy.descendant_id)
        .where(ArticleHierarchy.ancestor_id == article_id)
        .where(Article.is_current == True)
    )

    if not include_self:
        query = query.where(ArticleHierarchy.depth > 0)

    if max_depth is not None:
        query = query.where(ArticleHierarchy.depth <= max_depth)

    query = query.order_by(ArticleHierarchy.depth, Article.name)

    result = await session.exec(query)
    return result.all()
```

**Использование в endpoints:**

```python
# ✅ ПРАВИЛЬНО - используй HierarchyService
from backend.app.services.hierarchy_service import get_subtree, get_ancestors

# Получить все подкатегории:
children = await get_subtree(session, parent_id, include_self=False)

# Получить breadcrumbs:
path = await get_ancestors(session, article_id, include_self=True)

# ❌ НЕПРАВИЛЬНО - рекурсивные запросы
def get_children_recursive(parent_id):  # ← O(N) сложность, N+1 queries!
    for child in children:
        get_children_recursive(child.id)
```

---

### 3. Shared Family Budget Model

**АРХИТЕКТУРНОЕ ИЗМЕНЕНИЕ (2025-11-02):** Fact таблицы теперь **SHARED** (не isolated).

**Концепция:**
- Все аутентифицированные пользователи видят **ВСЕ транзакции**
- Любой может создавать/редактировать/удалять любые транзакции
- `user_id` сохраняется только для **audit trail**

**Затронутые endpoints:**
- `/api/v1/analytics/*` - БЕЗ user_id фильтрации
- `/api/v1/facts/*` - БЕЗ user_id фильтрации и ownership checks

**Реальные примеры из кода:**

```python
# ✅ ПРАВИЛЬНО (Shared Family Budget)

# Пример 1: Analytics endpoint - БЕЗ фильтрации
# backend/app/api/v1/analytics.py
query = select(
    func.sum(BudgetFact.amount).label("total")
).select_from(BudgetFact).where(
    BudgetFact.fact_date >= start_date  # NO user_id filter!
).group_by(Article.type)

# Пример 2: CRUD List - БЕЗ фильтрации
# backend/app/api/v1/endpoints/facts.py:50-60
@router.get("/facts")
async def list_facts(
    session: AsyncSession = Depends(get_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    statement = select(BudgetFact)
    # Shared family budget - NO user isolation filter
    # All authenticated users see all transactions
    facts = await session.exec(statement)
    return facts.all()

# Пример 3: CRUD Get - БЕЗ ownership check
fact = await session.get(BudgetFact, fact_id)
if not fact:
    raise HTTPException(404)
# Shared family budget - NO ownership check
return fact

# Пример 4: CRUD Create - user_id для audit trail
fact = BudgetFact(
    **data,
    user_id=current_user.id,  # Audit trail only - кто создал запись
)

# Пример 5: Admin System Stats - БЕЗ фильтрации (глобальные метрики)
# backend/app/api/v1/admin.py:468-531
@router.get("/users/stats/system", response_model=SystemStatsResponse)
async def get_system_stats(current_admin: CurrentAdmin, session: AsyncSession):
    # Total facts (Shared Family Budget - NO user_id filter!)
    facts_count_query = select(func.count(Fact.id))
    total_facts = (await session.execute(facts_count_query)).scalar() or 0

    # Total articles (Shared References - NO user_id filter!)
    articles_count_query = select(func.count(Article.id)).where(
        Article.is_current == True
    )
    total_articles = (await session.execute(articles_count_query)).scalar() or 0

    return SystemStatsResponse(
        total_facts=total_facts,  # ALL transactions in the system
        total_articles=total_articles,  # ALL active categories
        ...
    )
```

```python
# ❌ НЕПРАВИЛЬНО (Старая isolated модель - НЕ ИСПОЛЬЗУЙ!)

# Пример 1: НЕ добавляй user_id фильтры
query = select(BudgetFact).where(
    BudgetFact.user_id == current_user.id  # ❌ WRONG! Fact tables are shared!
)

# Пример 2: НЕ проверяй ownership
if fact.user_id != current_user.id:  # ❌ WRONG!
    raise HTTPException(403)

# Пример 3: НЕ используй apply_user_filter
statement = apply_user_filter(statement, current_user)  # ❌ WRONG!
```

**Почему Shared Model:**
- **Из ПРД:** "Семейная прозрачность - общий бюджет"
- **Target Audience:** Семья из 2-5 человек
- **Consistency:** Dimension tables уже shared, notifications broadcast

---

### 4. Shared References Architecture (Dimension Tables)

**Концепция:**
- **Admin-only management:** Только админы могут CREATE/UPDATE/DELETE dimension records
- **All users READ:** Все пользователи видят все dimension records
- **NO user isolation:** НЕ фильтруй по `user_id`!
- `user_id` только для **audit trail**

**Где применяется:**
- `t_d_article` - категории бюджета (shared для всех пользователей)
- `t_d_financial_center` - ЦФО (shared)
- `t_d_cost_center` - МВЗ (shared)

**Реальные примеры:**

```python
# ✅ ПРАВИЛЬНО

# Пример 1: CREATE/UPDATE/DELETE - только админы
# backend/app/api/v1/endpoints/articles.py:80-95
@router.post("/articles")
async def create_article(
    data: ArticleCreate,
    current_user: CurrentUser,
):
    if not current_user.is_admin:
        raise HTTPException(403, "Only administrators can create articles")

    article = Article(**data, user_id=current_user.id)  # Audit trail
    # ... create logic

# Пример 2: GET - БЕЗ фильтрации (все видят все)
@router.get("/articles")
async def list_articles(session: AsyncSession):
    stmt = select(Article).where(Article.is_current == True)
    # NO user_id filter - all users see all articles
    articles = await session.exec(stmt)
    return articles.all()
```

```python
# ❌ НЕПРАВИЛЬНО

# Пример 1: НЕ фильтруй dimension tables по user_id
stmt = select(Article).where(
    Article.user_id == current_user.id  # ❌ WRONG! Articles are shared!
)

# Пример 2: НЕ позволяй обычным юзерам создавать
@router.post("/articles")
async def create_article(current_user: CurrentUser):
    # ❌ Missing admin check!
    article = Article(**data)
```

---

### 5. Archived Categories (Inactive Articles)

**АРХИТЕКТУРНОЕ РЕШЕНИЕ (2025-11-08):** is_active флаг для архивирования категорий.

**Концепция:**
- Категории можно архивировать (скрыть из выбора)
- Архивация **рекурсивная** - архивируется категория и все потомки
- Архивные категории **остаются в аналитике** с пометкой "(архив)"
- is_active изменения **НЕ создают SCD Type 2 версию**

**Где применяется:**
- `t_d_article.is_active` - флаг активности категории
- `backend/app/services/hierarchy_service.py` - archive_recursive(), restore_recursive()
- `backend/app/api/v1/endpoints/articles.py` - обработка is_active в update

**Реальные примеры из кода:**

```python
# ✅ ПРАВИЛЬНО - рекурсивное архивирование

# Пример 1: Архивирование через hierarchy service
# backend/app/services/hierarchy_service.py:413-469
async def archive_recursive(session: AsyncSession, article_id: int) -> int:
    """Archive article and ALL descendants recursively."""
    articles_to_archive = await get_subtree(
        session=session,
        article_id=article_id,
        include_self=True,
    )

    archived_count = 0
    for article in articles_to_archive:
        article.is_active = False
        session.add(article)
        archived_count += 1

    await session.commit()
    return archived_count

# Пример 2: Обработка is_active в update endpoint
# backend/app/api/v1/endpoints/articles.py:379-426
if "is_active" in update_data and "is_active" in changed_fields:
    new_is_active = update_data["is_active"]
    is_active_change = new_is_active

    # Remove from update_data - handle separately
    del update_data["is_active"]

if is_active_change is not None:
    if is_active_change is False:
        archived_count = await archive_recursive(session, article_id)
    else:
        restored_count = await restore_recursive(session, article_id)

# Пример 3: Фильтрация при выборе категорий (dropdowns)
# backend/app/api/v1/endpoints/articles.py:182-183
if not include_inactive:
    statement = statement.where(Article.is_active == True)

# Пример 4: НЕ фильтровать в аналитике (показывать с пометкой)
# frontend/web/templates/admin_articles.html:268-270
const archivedBadge = !node.is_active
    ? '<span class="badge badge-warning ml-2">📦 Архивная</span>'
    : '';
```

**Ключевые правила:**

| Правило | Описание |
|---------|----------|
| **Рекурсивность** | При архивировании parent_id → архивируются ВСЕ дети |
| **НЕ SCD2** | Изменение is_active НЕ создает новую версию |
| **Видимость** | Archived = скрыто из dropdowns, но видно в аналитике |
| **Восстановление** | restore_recursive() также рекурсивен |

**Frontend интеграция:**

```javascript
// ✅ ПРАВИЛЬНО - Скрывать архивные в выборе категорий
// frontend/shared/static/js/choicesCategoryTree.js:116
const url = `/articles?type=${type}&include_inactive=${showInactive}`;

// ✅ ПРАВИЛЬНО - Показывать badge для архивных в админке
// frontend/web/templates/admin_articles.html:287
<td class="font-medium">${indent}${prefix}${node.name}${archivedBadge}</td>

// ✅ ПРАВИЛЬНО - Условные кнопки (Archive vs Restore)
const actionButtons = node.is_active
    ? `<button onclick="archiveArticle(${id})">📦 Архивировать</button>`
    : `<button onclick="restoreArticle(${id})">♻️ Восстановить</button>`;
```

**Почему НЕ SCD Type 2 для is_active:**
- Архивация - это изменение видимости, НЕ бизнес-данных
- is_active можно toggle многократно без создания версий
- Исторический audit trail НЕ требуется для флага видимости
- Рекурсивное применение упрощается без версионирования

---

## 🛡️ Security Guidelines (ОБЯЗАТЕЛЬНО)

### Authentication Pattern

**ВСЕГДА используй `CurrentUser` dependency:**

```python
# backend/app/core/dependencies.py:15-40
from backend.app.core.dependencies import CurrentUser

@router.get("/facts")
async def list_facts(current_user: CurrentUser):
    # current_user.id - user ID
    # current_user.is_admin - admin flag
    # current_user.telegram_id - Telegram ID
    pass
```

**Как это работает:**
1. JWT token извлекается из httpOnly cookie
2. Token валидируется в `backend/app/middleware/jwt_middleware.py:20-50`
3. User добавляется в `request.state.user`
4. `CurrentUser` dependency извлекает user из `request.state`

### Validation Pattern

**ВСЕГДА используй Pydantic схемы:**

```python
# backend/app/schemas/fact.py
class FactCreate(BaseModel):
    amount: Decimal = Field(gt=0, description="Amount must be positive")
    fact_date: date = Field(description="Transaction date")
    article_id: int

    @field_validator('fact_date')
    def validate_not_future(cls, v):
        if v > date.today():
            raise ValueError("Fact date cannot be in the future")
        return v

# В endpoint:
@router.post("/facts")
async def create_fact(data: FactCreate):  # ← Pydantic автовалидация
    # data уже провалидирован
    pass
```

---

## 🔧 Troubleshooting (типичные ошибки)

### 1. Import Errors в Backend

**Ошибка:**
```
ModuleNotFoundError: No module named 'app'
```

**Причина:** Relative imports вместо absolute.

**Решение:**
```python
# ❌ НЕПРАВИЛЬНО
from app.models.article import Article

# ✅ ПРАВИЛЬНО - всегда absolute imports от backend.*
from backend.app.models.article import Article
```

---

### 2. "Pool overlaps with other one" при docker compose

**Ошибка:**
```
ERROR: Pool overlaps with other one on this address space
```

**Причина:** Конфликт Docker сетей от старых deployments.

**Решение:**
```bash
./deploy.sh
# Выбрать: [2] Smart cleanup (RECOMMENDED)
# Скрипт автоматически очистит старые сети и найдет свободные подсети
```

---

### 3. JWT Token не работает

**Симптомы:**
- 401 Unauthorized на защищенных endpoints
- "Invalid token" в логах

**Диагностика:**
```bash
# Проверь JWT_SECRET в .env
grep JWT_SECRET /opt/budget/.env
# Должен быть 64 hex chars (автогенерирован setup.sh)

# Проверь JWT cookie в браузере (DevTools → Application → Cookies)
# Должен быть: access_token, httpOnly=true
```

**Решение:**
```bash
# Регенерировать JWT_SECRET
openssl rand -hex 32

# Обновить в .env
nano /opt/budget/.env

# Перезапустить backend
docker compose restart backend
```

---

### 4. Cache Busting не работает (старые JS/CSS)

**ВАЖНО:** Cache busting происходит **АВТОМАТИЧЕСКИ** при `./deploy.sh`!

**Как это работает:**
1. `deploy.sh` вызывает `scripts/lib/cache_busting.sh auto`
2. Скрипт обновляет версии в HTML: `?v=20251104_1430`
3. Браузеры автоматически загружают новые файлы

**Ручной запуск НЕ требуется** (только для отладки):
```bash
cd ~/familyBudget
./scripts/lib/cache_busting.sh auto

# Проверить что версии обновились
grep "?v=" webapp/index.html
# Должно быть: script.js?v=20251105_1430 (новый timestamp)
```

**❌ НЕ редактируй версии вручную** - они перезаписываются скриптом!

---

### 5. Database Migration Errors

**Ошибка:**
```
ERROR: relation "t_d_article" does not exist
```

**Причина:** Миграции не применены или PostgreSQL data directory corrupted.

**Решение (Development Mode):**
```bash
# Пересоздать БД с нуля (УДАЛИТ ВСЕ ДАННЫЕ!)
docker compose down -v
docker compose up -d

# Или применить миграции вручную
docker compose exec postgres psql -U familybudget -d familybudget -f /docker-entrypoint-initdb.d/001_xxx.sql
```

---

## 🗂️ Структура проекта

```
familyBudget/
├── backend/                      # FastAPI Backend
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/   # REST API endpoints
│   │   │   │   │   ├── facts.py         # Transactions CRUD
│   │   │   │   │   ├── articles.py      # Categories CRUD (admin-only)
│   │   │   │   │   ├── auth.py          # Telegram OAuth
│   │   │   │   │   └── ...
│   │   │   │   ├── analytics.py         # Analytics endpoints
│   │   │   │   └── router.py            # Main API router
│   │   │   └── web/
│   │   │       └── router.py             # Web UI routes
│   │   ├── models/               # SQLModel ORM models
│   │   │   ├── article.py               # Article (SCD Type 2)
│   │   │   ├── fact.py                  # BudgetFact
│   │   │   ├── user.py                  # User (SCD Type 2)
│   │   │   └── hierarchy.py             # ArticleHierarchy (Closure Table)
│   │   ├── schemas/              # Pydantic validation schemas
│   │   ├── services/             # Business logic layer
│   │   │   ├── scd2_service.py          # SCD Type 2 implementation
│   │   │   ├── hierarchy_service.py     # Closure Table queries
│   │   │   ├── jwt.py                   # JWT token generation
│   │   │   └── telegram_auth.py         # Telegram OAuth
│   │   ├── middleware/           # FastAPI middleware
│   │   │   ├── jwt_middleware.py        # JWT authentication
│   │   │   ├── logging_middleware.py    # Request logging
│   │   │   └── csp_middleware.py        # Security headers
│   │   ├── core/                 # Core utilities
│   │   │   ├── config.py                # Settings (Pydantic BaseSettings)
│   │   │   ├── dependencies.py          # FastAPI dependencies
│   │   │   ├── auth.py                  # Auth helpers
│   │   │   └── exceptions.py            # Custom exceptions
│   │   ├── db/
│   │   │   ├── session.py               # AsyncSession factory
│   │   │   └── migrations/              # SQL migrations (raw SQL)
│   │   ├── scheduler.py          # Background jobs (APScheduler)
│   │   └── main.py               # FastAPI app initialization
│   ├── Dockerfile
│   └── requirements.txt
├── bot/                          # Telegram Bot
│   ├── handlers/                 # Command handlers
│   │   ├── start.py                     # /start - OAuth
│   │   ├── add.py                       # /add - ConversationHandler
│   │   ├── summary.py                   # /summary - Plan vs Fact
│   │   └── ...
│   ├── utils/
│   │   ├── api_client.py                # Backend API client
│   │   ├── session.py                   # SessionManager (JWT storage)
│   │   └── notification_service.py      # Budget alerts
│   ├── jobs/
│   │   └── weekly_report.py             # Weekly summary job
│   ├── Dockerfile
│   ├── main.py                   # Bot initialization
│   └── requirements.txt
├── webapp/                       # Telegram Web Apps (static)
│   ├── static/
│   │   ├── js/                          # Modular ES6+ JavaScript
│   │   └── css/                         # Telegram theme CSS
│   └── *.html                    # Web Apps HTML (8 forms)
├── web/                          # Web UI (HTMX)
│   ├── static/                          # CSS, JS for web
│   └── templates/                       # Jinja2 templates
├── tests/                        # Test suite
│   ├── conftest.py                      # Pytest fixtures
│   ├── unit/                            # Unit tests (fast, isolated)
│   ├── integration/                     # Integration tests (with DB)
│   └── e2e/                             # End-to-end tests
├── scripts/                      # Automation scripts
│   ├── lib/
│   │   └── cache_busting.sh             # Cache versioning
│   └── ...
├── .claude/skills/               # Claude Skills automation
├── docker-compose.yml
├── pytest.ini                    # Pytest configuration
├── deploy.sh                     # Main deployment script
└── CLAUDE.md                     # This file
```

---

## 📦 Ключевые модули и зависимости

### Backend Dependencies

```python
# Web Framework
fastapi==0.109.0          # Async web framework
uvicorn[standard]==0.27.0 # ASGI server

# Database
sqlmodel==0.0.14          # ORM (Pydantic + SQLAlchemy)
asyncpg==0.29.0           # Async PostgreSQL driver
alembic==1.13.1           # Migrations (НЕ используется в dev mode)

# Auth
python-jose[cryptography] # JWT tokens
python-telegram-bot==20.7 # Telegram bot framework

# Background Jobs
apscheduler==3.10.4       # Scheduler (weekly reports, threshold checks)

# Export
openpyxl==3.1.2          # Excel generation
reportlab==4.0.9         # PDF generation

# Testing
pytest==7.4.4
pytest-asyncio==0.23.3
pytest-cov==4.1.0
httpx==0.25.2

# Development
black==24.1.1            # Code formatter
ruff==0.1.14             # Fast linter
```

### Telegram Web Apps (Vanilla JS)

**НЕТ фреймворков!** Весь код на ES6+ modules:

```
webapp/static/js/
├── app.js         # Main entry point, initialization
├── api.js         # Backend API client (fetch wrapper)
├── auth.js        # JWT authentication, token refresh
├── ui.js          # UI helpers, modals, toasts
├── validators.js  # Form validation
├── theme.js       # Telegram theme integration
└── storage.js     # LocalStorage wrapper
```

**Bundle size:** ~190KB (отличная производительность для mobile)

**Key features:**
- JWT Bearer token authentication
- Telegram Web Apps SDK integration
- Telegram theme support (auto light/dark)
- Client-side validation
- Modular architecture (7 core modules)

---

## 📋 Development Mode (Database Migrations)

**ТЕКУЩАЯ ФАЗА:** Development (v5.0.0-beta)

### Правила работы с миграциями

✅ **РАЗРЕШЕНО:**
- Прямое редактирование существующих миграций (001-012)
- Изменение SQL в `backend/db/migrations/*.sql`
- Изменение структуры таблиц

❌ **ЗАПРЕЩЕНО:**
- Создание новых миграций типа `014_update_xxx.sql`
- Backward compatibility (БД накатывается с нуля)

**Workflow изменения БД:**
```bash
# 1. Изменить миграцию
nano backend/db/migrations/011_create_notifications_table.sql

# 2. Обновить ПРД
nano docs/prd/06-database-design.md

# 3. Пересоздать БД для теста
docker compose down -v && docker compose up -d

# 4. Проверить что всё работает
curl http://localhost:8000/health
```

**Переход в production:**
- После релиза → версионирование миграций (Alembic)
- Alpha → Beta → Production

---

## 🚀 Deployment (Quick Reference)

### Первоначальная установка

```bash
# 1. Системные зависимости (Docker, UFW)
git clone <repo-url> ~/familyBudget && cd ~/familyBudget
sudo ./install.sh

# 2. Настройка .env (интерактивная)
./setup.sh

# 3. Деплой
./deploy.sh --profile full
```

### Обновление кода

```bash
cd ~/familyBudget && git pull
./deploy.sh --sync-mode mirror --profile full
```

### Production Deployment Process

**КРИТИЧНО - Последовательность важна:**

```bash
# 1. Из git repository (~/familyBudget)
cd ~/familyBudget
git pull

# 2. Запустить deploy.sh ИЗ repository (использует scripts/lib/)
./deploy.sh --sync-mode mirror --profile full

# 3. deploy.sh автоматически:
#    - Синхронизирует ~/familyBudget → /opt/budget
#    - Запускает cache busting (обновляет ?v= версии)
#    - Выполняет docker compose up -d
#    - Ждет healthy status всех сервисов
```

**Почему нельзя запускать из /opt/budget:**
- `deploy.sh` загружает модули из `scripts/lib/` (только в repository)
- `/opt/budget` содержит только синхронизированные runtime файлы
- Скрипты в `/opt/budget` не имеют доступа к библиотекам

### ⚠️ КРИТИЧНО: Правильный запуск deploy.sh

**✓ ПРАВИЛЬНО:**
```bash
cd ~/familyBudget          # Git repository
./deploy.sh                # Относительный путь
```

**✗ НЕПРАВИЛЬНО:**
```bash
cd /opt/budget             # Production directory
./deploy.sh                # ❌ Модули не найдены!
```

**Почему:**
- `deploy.sh` загружает модули из `scripts/lib/` в repository
- `/opt/budget` - только runtime файлы (создаются синхронизацией)

---

## 🎨 Стиль кода

**Python:**
- PEP 8, type hints обязательны
- Async/await для I/O операций
- Black (line length 100) + Ruff + mypy

**Naming Conventions:**
- Таблицы: `t_d_*` (dimension), `t_f_*` (fact)
- API endpoints: kebab-case (`/budget-facts`)
- Python functions: `snake_case`
- SQLModel classes: `PascalCase`

**Git Commits:**
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- Co-Authored-By: Claude для Claude Code commits

**Import Order:**
```python
# 1. Standard library
import os
from datetime import datetime

# 2. Third-party
from fastapi import FastAPI
from sqlmodel import select

# 3. Local (absolute imports!)
from backend.app.models.article import Article
from backend.app.services.scd2_service import create_new_version
```

---

## 🤖 Telegram Bot Handlers

### Handler Types

| Handler Type | Пример | Назначение |
|--------------|--------|------------|
| **CommandHandler** | `/start`, `/today`, `/stats` | Одношаговые команды |
| **ConversationHandler** | `/add`, `/addplan`, `/edit` | Multi-step workflows с состоянием |
| **CallbackQueryHandler** | Inline keyboards | Обработка кнопок |

### ConversationHandler Pattern (пример: /add)

```python
# bot/handlers/add.py
CATEGORY, AMOUNT, DATE, DESCRIPTION, CONFIRM = range(5)

conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("add", start_add)],
    states={
        CATEGORY: [CallbackQueryHandler(category_selected)],
        AMOUNT: [MessageHandler(filters.TEXT, amount_entered)],
        DATE: [CallbackQueryHandler(date_selected)],
        DESCRIPTION: [MessageHandler(filters.TEXT, description_entered)],
        CONFIRM: [CallbackQueryHandler(confirm_transaction)],
    },
    fallbacks=[CommandHandler("cancel", cancel)],
)
```

**Состояние хранится в memory** (context.user_data) - НЕ в БД.

**Таймаут:** 5 минут бездействия → auto-cancel.

### Bot API Client Pattern

```python
# bot/utils/api_client.py
class APIClient:
    """Backend API client с JWT authentication"""

    def __init__(self, base_url: str, jwt_token: str):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {jwt_token}"}

    async def get_articles(self) -> List[dict]:
        """GET /api/v1/articles - категории бюджета"""
        response = await self.session.get(
            f"{self.base_url}/articles",
            headers=self.headers
        )
        return response.json()

    async def create_fact(self, data: dict) -> dict:
        """POST /api/v1/facts - создать транзакцию"""
        response = await self.session.post(
            f"{self.base_url}/facts",
            json=data,
            headers=self.headers
        )
        return response.json()
```

**Важно:**
- JWT token хранится в `SessionManager` (bot/utils/session.py)
- Token автоматически обновляется при получении 401
- Все API calls идут через `APIClient` (централизованная обработка ошибок)

---

## 🎯 Claude Skills (Automation)

Для автоматизации типичных задач используй **Claude Skills**:

| Skill | Когда использовать |
|-------|-------------------|
| **[api-development](/.claude/skills/api-development/SKILL.md)** | Создание REST API endpoints, Pydantic схем |
| **[db-management](/.claude/skills/db-management/SKILL.md)** | Миграции, dimension модели, Closure Table |
| **[testing](/.claude/skills/testing/SKILL.md)** | Unit/integration/e2e тесты, coverage |
| **[bot-development](/.claude/skills/bot-development/SKILL.md)** | Telegram bot команды, ConversationHandler |
| **[deployment](/.claude/skills/deployment/SKILL.md)** | Production deploy, Docker управление |
| **[monitoring](/.claude/skills/monitoring/SKILL.md)** | Логи, performance, troubleshooting |

📚 **[Полная документация по Skills](./SKILLS.md)**

**Использование:**
```
Создай REST API endpoint для модели "Budget" используя api-development skill.
```

---

## 📚 Дополнительные ресурсы

- **[SKILLS.md](./SKILLS.md)** - Comprehensive Skills guide
- **[README.md](./README.md)** - Полная документация проекта
- **[START.md](./START.md)** - Quick start guide
- **backend/README.md** - Backend документация
- **bot/README.md** - Bot документация
- **docs/prd/** - Product Requirements Document

---

## ⚡ Важные напоминания

При разработке **ВСЕГДА:**

1. ✅ Используй **absolute imports**: `from backend.app.models...`
2. ✅ Используй **CurrentUser dependency** для auth
3. ✅ Используй **SCD2Service** для dimension tables updates
4. ✅ Используй **HierarchyService** для работы с категориями
5. ✅ **НЕ фильтруй** fact tables по `user_id` (Shared Family Budget)
6. ✅ **НЕ фильтруй** dimension tables по `user_id` (Shared References)
7. ✅ Admin checks для CREATE/UPDATE/DELETE dimension tables
8. ✅ Добавляй **тесты** для новых features (используй pytest markers)
9. ✅ Проверяй **security** (JWT, validation, admin-only)
10. ✅ **НЕ редактируй** версии `?v=` вручную (используй автоматический cache busting)

💡 **Не уверен как сделать?** → Посмотри соответствующий [Claude Skill](#-claude-skills-automation)

---

**Версия документа:** 4.0 (Claude Code optimized)
**Последнее обновление:** 2025-11-05
**Формат:** Practical examples from real codebase
