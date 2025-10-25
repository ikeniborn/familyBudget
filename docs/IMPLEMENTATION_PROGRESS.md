# Telegram Web Apps Implementation Progress

**Проект:** Family Budget - Telegram Web Apps Migration
**Начало:** 2025-10-24
**Статус:** 🚧 В разработке

---

## Phase 0: Подготовка инфраструктуры ✅

**Цель:** Создать базовую инфраструктуру для Web Apps (backend API, frontend core, testing setup)

**Статус:** ✅ Завершено
**Начало:** 2025-10-24
**Завершение:** 2025-10-24

### ✅ Завершенные задачи

#### 0.1. Структура директорий
- **Дата:** 2025-10-24
- **Описание:** Создана структура `/webapp/` на root level (рядом с `/web/`, `/backend/`, `/bot/`)
- **Архитектура:** webapp как отдельный компонент, serve через FastAPI backend
- **Файлы:**
  - `/webapp/` - корневая директория Web Apps (root level, НЕ внутри backend!)
  - `/webapp/*.html` - placeholder HTML files (10 pages)
  - `/webapp/static/js/` - JavaScript модули
  - `/webapp/static/css/` - стили
  - `/webapp/static/img/icons/` - иконки для UI
- **Deployment:** Backend FastAPI serve webapp через StaticFiles mount `/webapp/*`
- **Результат:** ✅ Базовая структура готова на root level

#### 0.2. Web Apps API router
- **Дата:** 2025-10-24
- **Описание:** Создан `/backend/app/api/v1/webapp/` router с модулями для всех Web App endpoints
- **Файлы:**
  - `backend/app/api/v1/webapp/__init__.py` - main router setup
  - `backend/app/api/v1/webapp/validate.py` - initData validation (TODO в Phase 0.3)
  - `backend/app/api/v1/webapp/facts.py` - facts wrapper (TODO в Phase 1.3+)
  - `backend/app/api/v1/webapp/articles.py` - articles wrapper (TODO в Phase 1.4+)
  - `backend/app/api/v1/webapp/stats.py` - statistics (TODO в Phase 2+)
  - `backend/app/api/v1/router.py` - webapp_router подключен к main API router
- **Результат:** ✅ Router structure готова, endpoints с TODO для последующих фаз

#### 0.3. initData validation endpoint
- **Дата:** 2025-10-24
- **Описание:** Реализован POST /api/v1/webapp/validate endpoint для Telegram Web Apps authentication
- **Файлы:**
  - `backend/app/schemas/webapp.py` - Pydantic schemas (WebAppInitDataRequest, WebAppUser, WebAppValidateResponse)
  - `backend/app/services/webapp_auth.py` - Validation service (HMAC-SHA256 с "WebAppData" constant)
  - `backend/app/api/v1/webapp/validate.py` - Endpoint implementation
- **Security:**
  - HMAC-SHA256 validation (secret: HMAC("WebAppData", BOT_TOKEN)) - правильный алгоритм для Web Apps!
  - auth_date expiration check (< 1 hour)
  - Timing-attack resistant hash comparison (hmac.compare_digest)
  - JWT access token issuance (7-day expiry)
- **Результат:** ✅ Critical security endpoint готов

#### 0.4. Core JS modules
- **Дата:** 2025-10-24
- **Описание:** Созданы все 7 основных JavaScript модулей для Web Apps frontend
- **Файлы:**
  - `webapp/static/js/auth.js` - Authentication wrapper (validate initData, JWT management)
  - `webapp/static/js/api.js` - API client (facts, articles, stats endpoints)
  - `webapp/static/js/app.js` - Core app initialization (Telegram SDK, theme, auth flow)
  - `webapp/static/js/ui.js` - UI helpers (alerts, loading, formatting, haptic feedback)
  - `webapp/static/js/validators.js` - Form validation (required, amount, date, maxLength)
  - `webapp/static/js/theme.js` - Telegram theme management (CSS variables from themeParams)
  - `webapp/static/js/storage.js` - CloudStorage wrapper (promise-based interface)
- **Архитектура:**
  - Модульная структура, каждый модуль - отдельный ES6 class
  - app.js инициализирует все модули автоматически при DOMContentLoaded
  - auth.js → api.js → app.js dependency chain
- **Результат:** ✅ Полный frontend core ready для использования в HTML pages

#### 0.5. Base CSS
- **Дата:** 2025-10-24
- **Описание:** Созданы базовые CSS стили для Web Apps frontend
- **Файлы:**
  - `webapp/static/css/telegram-theme.css` - CSS variables для Telegram theme (16 theme colors)
  - `webapp/static/css/app.css` - Base layout, typography, buttons, cards, lists, grid, utilities
  - `webapp/static/css/forms.css` - Form controls (inputs, selects, textareas, toggles, validation)
- **Возможности:**
  - Адаптивный дизайн под Telegram theme (light/dark)
  - Utility classes для быстрой верстки
  - Ripple effect для button interactions
  - Form validation styles (error/success states)
  - Segmented control, toggles, checkboxes
- **Результат:** ✅ Полный CSS framework ready для HTML pages

#### 0.6. Configure serving webapp в main.py
- **Дата:** 2025-10-24
- **Описание:** Настроен serving webapp static files через FastAPI backend
- **Изменения:**
  - `backend/app/main.py` - добавлен mount `/webapp` → `/app/webapp` (html=True)
  - `backend/app/middleware/csp_middleware.py` - CSP headers middleware
  - Security headers: CSP, X-Frame-Options, X-XSS-Protection, X-Content-Type-Options
  - Специальный CSP для /webapp/* (разрешает Telegram scripts)
- **Test page:** `/webapp/test.html` - проверка всех модулей и API
- **Результат:** ✅ Backend готов serve webapp, security headers добавлены

#### 0.7. Menu Button setup
- **Дата:** 2025-10-24
- **Описание:** Настроен Telegram Menu Button для доступа к Web App
- **Файлы:**
  - `bot/bot.py` - добавлен метод `setup_menu_button()` в класс `BotApplication`
  - Menu Button вызывается автоматически при старте бота (в методе `start()`)
- **Конфигурация:**
  - Text: "📱 Открыть приложение"
  - URL: `{BACKEND_API_URL без /api/v1}/webapp/index.html`
  - Автоматическое извлечение base URL из `BACKEND_API_URL` настроек
  - Set для всех пользователей через `bot.set_chat_menu_button()`
- **Error handling:**
  - Non-critical failure (бот продолжает работать с командами если Menu Button setup fails)
  - Логирование успешной установки и ошибок
- **Результат:** ✅ Menu Button готов, доступен в Telegram при старте бота

#### 0.8. Testing infrastructure
- **Дата:** 2025-10-24
- **Описание:** Настроена полная инфраструктура для тестирования (unit, integration, E2E)
- **Файлы:**
  - `pytest.ini` - Pytest configuration (markers, coverage settings)
  - `tests/conftest.py` - Shared fixtures (db_session, client, auth, mock data)
  - `tests/README.md` - Comprehensive testing documentation
  - `playwright.config.ts` - Playwright E2E configuration
- **Test structure:**
  - `tests/unit/backend/` - Unit tests (fast, isolated)
  - `tests/integration/backend/` - Integration tests (API + DB)
  - `tests/e2e/webapp/` - E2E tests (Playwright, full user flows)
- **Example tests created:**
  - `test_webapp_auth.py` - Unit tests для initData validation (4 test cases)
  - `test_webapp_validate_endpoint.py` - Integration tests для validate endpoint (5 test cases)
  - `test_webapp_loading.spec.ts` - E2E tests для Web App loading (4 test cases)
- **Features:**
  - Pytest markers для фильтрации (unit, integration, e2e, webapp, backend, slow)
  - Auto-rollback database fixtures (clean state для каждого теста)
  - Coverage reporting (pytest --cov)
  - Playwright multi-browser support (Chrome, Firefox, Safari, Mobile)
  - Comprehensive test documentation
- **Результат:** ✅ Полная testing infrastructure готова, example tests работают

### 🚧 В процессе

_В данный момент нет задач в процессе_

---

### ⏳ Ожидают выполнения

_Все задачи Phase 0 завершены_

---

## Phase 1: MVP - Menu + Add ✅

**Цель:** Реализовать минимальный рабочий прототип (главное меню + добавление транзакции)

**Статус:** ✅ Завершено
**Начало:** 2025-10-24
**Завершение:** 2025-10-25

### ✅ Завершенные задачи

#### 1.1. Main Menu (index.html)
- **Дата:** 2025-10-25
- **Описание:** Создано главное меню Web App с 3x3 grid layout
- **Файлы:**
  - `webapp/index.html` - Main menu page
- **Features:**
  - 3x3 grid с 9 menu items (Добавить, Сегодня, Статистика, Список, Редактор, Удалить, План, Сводка, Поиск)
  - Primary action (Добавить) highlighted с gradient background
  - Quick Stats widget (доходы/расходы/баланс за сегодня - placeholder)
  - Персонализированное приветствие (user.first_name)
  - Haptic feedback на menu item clicks
  - Полная интеграция с core JS modules
  - Responsive design
- **Результат:** ✅ Главное меню готово, навигация работает

#### 1.2. Add Transaction Form (add.html)
- **Дата:** 2025-10-25
- **Описание:** Создана форма добавления транзакции
- **Файлы:**
  - `webapp/add.html` - Add transaction page
- **Features:**
  - Segmented control для выбора типа (доход/расход)
  - Quick amount buttons (100, 500, 1000, 5000 ₽)
  - Amount input с валидацией и color coding (red для расходов, green для доходов)
  - Category list загружаемый через API (placeholder пока)
  - Description textarea с character counter (max 200)
  - Date picker (default: сегодня, max: сегодня - no future dates)
  - MainButton для save action
  - BackButton navigation
  - Client-side validation (amount > 0, category required, date required)
  - Haptic feedback
- **Результат:** ✅ Форма готова, валидация работает, UX отполирован

#### 1.3. Facts API Endpoints
- **Дата:** 2025-10-25
- **Описание:** Реализованы все CRUD endpoints для transactions
- **Файлы:**
  - `backend/app/api/v1/webapp/facts.py` - Facts API wrapper
- **Endpoints:**
  - POST `/api/v1/webapp/facts` - Create transaction
  - GET `/api/v1/webapp/facts` - List with filters (date_from, date_to, article_id, pagination)
  - GET `/api/v1/webapp/facts/{id}` - Get single transaction
  - PUT `/api/v1/webapp/facts/{id}` - Update transaction
  - DELETE `/api/v1/webapp/facts/{id}` - Delete transaction
- **Features:**
  - User data isolation (только свои транзакции)
  - JWT Bearer token authentication
  - Article validation (must exist + be accessible)
  - Date range filtering для reports
  - Pagination support (limit, offset)
  - Comprehensive error handling (404, 403, 401, 400)
  - Transaction type support (fact/plan via record_type)
- **Результат:** ✅ Full CRUD API готов, проверен на соответствие existing logic

#### 1.4. Articles API Endpoints
- **Дата:** 2025-10-25
- **Описание:** Реализованы endpoints для categories
- **Файлы:**
  - `backend/app/api/v1/webapp/articles.py` - Articles API wrapper
- **Endpoints:**
  - GET `/api/v1/webapp/articles` - List categories (type filter, pagination)
  - GET `/api/v1/webapp/articles/{id}` - Get single category
- **Features:**
  - User isolation: own articles + global articles (ключевое отличие!)
  - Filter by type (income/expense) для форм
  - is_current filter (only current versions, default: true)
  - Order by name (alphabetical для dropdown UI)
  - Default limit: 1000 (для полных dropdown lists без pagination)
  - Parent_id filter (для hierarchy navigation в future phases)
- **Результат:** ✅ Categories API готов для использования в forms

### ⏳ Testing (отложено)
- 1.5-1.7: Unit, Integration, E2E tests будут добавлены в последующих фазах
- Testing infrastructure уже готова (Phase 0.8), example tests созданы

### 🔧 Архитектурные корректировки (2025-10-25)

После Phase 1 были внесены критические изменения в архитектуру на основе уточненных требований:

#### Изменение 1: Webapp перемещен в /bot/
- **Было:** `/webapp/` на root level
- **Стало:** `/bot/webapp/`
- **Причина:** Webapp это часть бота, должен быть внутри bot каталога
- **Файлы изменены:** `backend/app/main.py` (WEBAPP_DIR path)

#### Изменение 2: Удалены дублирующие endpoints
- **Удалены:** `/api/v1/webapp/facts.py`, `/api/v1/webapp/articles.py`
- **Причина:** Webapp использует существующие `/api/v1/facts` и `/api/v1/articles`
- **Оставлены:** `/api/v1/webapp/validate` (уникальный для Web Apps)
- **Файлы изменены:**
  - `backend/app/api/v1/webapp/__init__.py` - убраны импорты
  - `bot/webapp/static/js/api.js` - используется `/api/v1/*`

#### Изменение 3: JWT middleware обновлен
- **Добавлены публичные endpoints:** `/api/v1/webapp/validate`, `/webapp/*`
- **Подтверждена поддержка:** Cookie + Bearer token authentication
- **Файлы изменены:** `backend/app/middleware/jwt_middleware.py`

**Документация:** См. [ARCHITECTURE_CORRECTIONS.md](./ARCHITECTURE_CORRECTIONS.md)

**Результат:** ✅ Архитектура соответствует требованиям, код без дублирования

---

## Phase 2: Core Forms ✅

**Цель:** Реализовать основные формы просмотра и редактирования транзакций

**Статус:** ✅ Завершено
**Начало:** 2025-10-25
**Завершение:** 2025-10-25

### ✅ Завершенные задачи

#### 2.1. Today View (today.html)
- **Дата:** 2025-10-25
- **Описание:** Страница просмотра транзакций за сегодня
- **Файлы:** `bot/webapp/today.html` (14KB)
- **Features:**
  - Summary card (доходы/расходы/баланс за сегодня)
  - Transaction list с группировкой по времени
  - Color coding (green для доходов, red для расходов)
  - Click на транзакцию → открытие edit.html
  - Empty state с кнопкой "Добавить транзакцию"
  - Loading state
  - BackButton → index.html
- **API:** GET `/api/v1/facts?date_from=...&date_to=...&limit=1000`
- **Результат:** ✅ Готово к тестированию

#### 2.2. List View (list.html)
- **Дата:** 2025-10-25
- **Описание:** Список всех транзакций с фильтрами и пагинацией
- **Файлы:** `bot/webapp/list.html` (23KB)
- **Features:**
  - Collapsible filters panel
  - Date range filter
  - Type filter (доход/расход)
  - Category dropdown filter
  - Search input (description)
  - Apply/Clear buttons
  - Pagination (20 items per page)
  - Transaction list
  - Active filters badge (count)
  - Click → edit.html
  - BackButton → index.html
- **API:** GET `/api/v1/facts` с query params
- **Результат:** ✅ Готово к тестированию

#### 2.3. Edit Transaction (edit.html)
- **Дата:** 2025-10-25
- **Описание:** Редактирование и удаление транзакции (unified form)
- **Файлы:** `bot/webapp/edit.html` (23KB)
- **Features:**
  - Load transaction by ID (query param)
  - Pre-fill all fields (type, amount, category, description, date)
  - Same validation as add.html
  - MainButton "Сохранить изменения"
  - Delete button (danger style) внизу формы
  - Confirm dialog перед удалением
  - Loading overlay на инициализации
  - BackButton → history.back()
- **API:**
  - GET `/api/v1/facts` (search by ID)
  - PUT `/api/v1/facts/{id}` (update)
  - DELETE `/api/v1/facts/{id}` (delete)
- **Результат:** ✅ Delete функция интегрирована, separate delete.html удалена

#### 2.4. Statistics View (stats.html)
- **Дата:** 2025-10-25
- **Описание:** Статистика по категориям за выбранный период
- **Файлы:** `bot/webapp/stats.html` (20KB)
- **Features:**
  - Period selector (4 кнопки: Сегодня, Неделя, Месяц, Год)
  - Summary card (доходы/расходы/баланс)
  - Expense breakdown (top 5 categories)
  - Income breakdown (top 5 categories)
  - Progress bars для каждой категории
  - Percentage от total
  - Empty state
  - BackButton → index.html
- **API:**
  - GET `/api/v1/facts?date_from=...&date_to=...&limit=10000`
  - GET `/api/v1/articles` (for category names)
- **Client-side aggregation:** Group by category, calculate totals
- **Результат:** ✅ Готово к тестированию (без графиков Chart.js - Phase 4+)

#### 2.5. Main Menu Update
- **Дата:** 2025-10-25
- **Описание:** Обновление главного меню для Phase 2
- **Файлы:** `bot/webapp/index.html`
- **Изменения:**
  - Grid layout: 2x2 → **2x3** (6 пунктов меню)
  - Добавлены: Сегодня, Список, Статистика, Редактор
  - Quick Stats widget интегрирован с API
- **Результат:** ✅ Навигация ко всем Phase 2 формам работает

### 🚧 Архитектурные решения Phase 2

#### Delete Integration
- **Решение:** Удалить отдельную delete.html, интегрировать в edit.html
- **Обоснование:**
  - UX: Delete естественная часть редактирования
  - Меньше кода и maintenance overhead
  - Один endpoint /api/v1/facts/{id} для GET/PUT/DELETE
- **Файлы:** edit.html содержит delete button + confirm dialog

---

## Phase 3: Advanced Forms ✅

**Цель:** Реализовать расширенные формы планирования и поиска

**Статус:** ✅ Завершено
**Начало:** 2025-10-25
**Завершение:** 2025-10-25

### ✅ Завершенные задачи

#### 3.1. Add Plan Form (addplan.html)
- **Дата:** 2025-10-25
- **Описание:** Форма создания бюджетного плана
- **Файлы:** `bot/webapp/addplan.html` (21KB)
- **Features:**
  - Quick amount buttons (5k, 10k, 20k, 50k)
  - Amount input (number)
  - Category selection (иерархический список)
  - Period selector (4 опции):
    - Месяц (текущий месяц)
    - Квартал (текущий квартал)
    - Год (текущий год)
    - Свой (custom date range picker)
  - Description textarea (опционально, 200 символов)
  - Recurring checkbox (UI готов, backend support TODO Phase 4+)
  - MainButton "Сохранить план"
  - BackButton → tg.close()
- **API:** POST `/api/v1/facts` с `record_type="plan"`
- **Логика:**
  - Client-side period calculations (month/quarter/year)
  - Custom period с валидацией (start < end)
- **Результат:** ✅ Готово к тестированию

#### 3.2. Summary View (summary.html)
- **Дата:** 2025-10-25
- **Описание:** Сводка план vs факт по категориям
- **Файлы:** `bot/webapp/summary.html` (23KB)
- **Features:**
  - Period selector (Месяц/Квартал/Год)
  - Total summary card:
    - Расходы: факт vs план
    - Доходы: факт vs план
    - Color indicators (green/red)
  - Category breakdown sections:
    - Expense categories
    - Income categories
  - Per-category display:
    - План / Факт (side-by-side boxes)
    - Разница: ✅ Экономия / ⚠️ Превышение
    - Progress bar с процентом
  - Empty state: "Создайте план для сравнения"
  - BackButton → index.html
- **API:**
  - GET `/api/v1/facts?date_from=...&date_to=...&limit=10000`
  - GET `/api/v1/articles`
- **Calculation Logic:**
  - Expenses: plan - fact > 0 → экономия (green)
  - Income: fact - plan > 0 → превышение плана (green)
  - Progress bars: percent = (fact / plan) * 100
- **Результат:** ✅ Готово к тестированию

#### 3.3. Search View (search.html)
- **Дата:** 2025-10-25
- **Описание:** Расширенный поиск транзакций с фильтрами и экспортом
- **Файлы:** `bot/webapp/search.html` (22KB)
- **Features:**
  - Advanced filters:
    1. Date range (от/до)
    2. Type checkboxes (Расход/Доход/План)
    3. Category dropdown
    4. Amount range (мин/макс)
    5. Description search (text input)
  - Search button "🔍 Найти транзакции"
  - Results section:
    - Results count header
    - Export button "📥 Экспорт в CSV"
    - Transaction list
    - Click result → edit.html
  - CSV export:
    - Client-side generation
    - BOM для Excel compatibility
    - Columns: Дата, Категория, Описание, Тип, Сумма
  - Empty state для пустых результатов
  - BackButton → index.html
- **API:**
  - GET `/api/v1/facts?date_from=...&date_to=...&article_id=...&limit=10000`
  - GET `/api/v1/articles`
- **Filtering Logic:**
  - Backend: date_from, date_to, article_id
  - Client-side: types, amount range, description search
  - Hybrid approach (backend reduces data, client filters)
- **Результат:** ✅ Готово к тестированию

#### 3.4. Main Menu Update (3x3 Grid)
- **Дата:** 2025-10-25
- **Описание:** Финальное обновление главного меню
- **Файлы:** `bot/webapp/index.html` (9.8KB)
- **Изменения:**
  - Grid layout: 2x3 → **3x3** (9 пунктов меню)
  - Добавлены 3 новых пункта:
    - 📝 План (addplan.html)
    - 📊 Сводка (summary.html)
    - 🔍 Поиск (search.html)
  - Quick Stats интегрирован с API
- **Результат:** ✅ Все 9 форм доступны через меню

### 🚧 Архитектурные решения Phase 3

#### 1. Plan Management
- **Решение:** Use `record_type="plan"` field instead of separate table
- **Обоснование:**
  - Единая таблица `t_f_budget_fact` для факта и плана
  - Упрощенная схема БД
  - Легко сравнивать plan vs fact (одна таблица)
- **TODO:** Recurring plans требуют дополнительную таблицу (Phase 4+)

#### 2. Period Calculations
- **Решение:** Client-side date range calculation for periods
- **Обоснование:**
  - Избегаем усложнения backend
  - Быстрее для пользователя (no API call)
  - Simple JavaScript date math

#### 3. Search Implementation
- **Решение:** Hybrid filtering (backend + client-side)
- **Backend filtering:** date_from, date_to, article_id
- **Client-side filtering:** types, amount range, description
- **Обоснование:**
  - No backend changes required for Phase 3
  - Flexible filter combinations
  - Works with existing `/api/v1/facts` endpoint
- **TODO:** Migrate to backend POST `/api/v1/webapp/facts/search` when needed (Phase 4+)

#### 4. CSV Export
- **Решение:** Client-side CSV generation and download
- **Обоснование:**
  - No backend changes required
  - Works offline (after data loaded)
  - BOM ('\ufeff') для корректного Excel display

---

## Phase 4: Cleanup (Pending)

**Статус:** ⏳ Ожидает начала

**Planned tasks:**
- Remove old ConversationHandlers
- Update /help command
- Performance optimization
- Charts integration (Chart.js)
- Recurring plans backend
- Backend search endpoint
- Hierarchical category selection
- Final testing and documentation

---

## Общая статистика

- **Всего фаз:** 5 (Phase 0-4)
- **Завершено:** 4 (Phase 0, 1, 2, 3) ✅
- **В процессе:** 0
- **Ожидает:** 1 (Phase 4) ⏳

**Прогресс Phase 0:** 8/8 задач (100%) ✅
**Прогресс Phase 1:** 4/4 задач MVP (100%) ✅
**Прогресс Phase 2:** 5/5 задач Core Forms (100%) ✅
**Прогресс Phase 3:** 4/4 задач Advanced Forms (100%) ✅
**Общий прогресс:** ~80%

**Web Apps Status:** ✅ **READY FOR MANUAL TESTING!**

**Реализованные страницы (8 из 9):**
- ✅ index.html - Main menu (3x3 grid)
- ✅ add.html - Add transaction
- ✅ today.html - Today's transactions
- ✅ list.html - Transaction list with filters
- ✅ edit.html - Edit/Delete transaction (unified)
- ✅ stats.html - Statistics by category
- ✅ addplan.html - Create budget plan
- ✅ summary.html - Plan vs Fact comparison
- ✅ search.html - Advanced search with CSV export

**API endpoints:**
- ✅ POST `/api/v1/webapp/validate` - initData validation
- ✅ GET/POST/PUT/DELETE `/api/v1/facts` - transactions CRUD
- ✅ GET `/api/v1/articles` - categories list

**Bundle size:** ~190KB total (HTML + JS + CSS) - отличная производительность!

---

## Проблемы и решения

### Phase 0

_Пока нет зафиксированных проблем_

---

## Заметки

- Используется существующая инфраструктура FastAPI
- JWT auth и user isolation уже реализованы
- Facts и Articles API endpoints существуют, нужны только wrappers для Web Apps
- Backward compatibility с ConversationHandlers поддерживается до Phase 4

### Архитектурные решения

**WebApp структура (исправлено 2025-10-25):**
- `/bot/webapp/` - webapp это часть бота (НЕ на root level!)
- Backend FastAPI serve webapp через StaticFiles mount из `/bot/webapp/`
- URL: `https://domain.com/webapp/index.html`, `https://domain.com/webapp/add.html`, etc.
- Menu Button URL: `https://domain.com/webapp/index.html`

**API Endpoints (без дублирования):**
- `/api/v1/facts` - универсальный для Web UI + Web Apps
- `/api/v1/articles` - универсальный для Web UI + Web Apps
- `/api/v1/webapp/validate` - уникальный для Web Apps (initData validation)
- JWT middleware поддерживает Cookie (Web UI) + Bearer token (Web Apps)

**Bot Migration:**
- Bot контейнер НЕ удаляется - webapp это часть бота
- Phase 0-3: ConversationHandlers работают параллельно с Web Apps
- Phase 4: ConversationHandlers удаляются, остается только Menu Button + Web Apps
- Функциональность переходит с bot commands на Web Apps UI

**Deployment:**
- Backend контейнер serve webapp static files из `/bot/webapp/`
- Nginx gateway routing: `/webapp/*` → backend:8000
- No separate webapp container (served by backend)
- Bot container остается (webapp внутри него)

---

**Последнее обновление:** 2025-10-25 (Phase 0-3 завершены, готово к manual testing)
