## 4.7 Additional Features (Phase 1 - NEW)

### NEW Features реализованные в Phase 1 (не планировались в исходном PRD v1.0)

---

#### FR-051: Real-time Monitoring Dashboard

**Phase:** 1 ✅ **РЕАЛИЗОВАНО**
**Приоритет:** High
**Категория:** admin_monitoring

**Описание:**
Real-time dashboard для мониторинга состояния системы, доступный администраторам. Использует Server-Sent Events (SSE) для обновления данных каждые 5 секунд.

**User Story:**
Как администратор, я хочу видеть текущее состояние системы в real-time, чтобы быстро реагировать на проблемы.

**Acceptance Criteria:**
1. ✅ Real-time обновление через SSE (Server-Sent Events)
2. ✅ Отображение статуса Docker контейнеров
3. ✅ Database connection pool metrics
4. ✅ Recent logs (последние 100 строк)
5. ✅ System metrics (CPU, memory, disk)
6. ✅ Quick actions: restart services, view logs

**Технологии:**
- HTMX для dynamic UI
- Server-Sent Events (SSE) для real-time updates
- Jinja2 templates
- TailwindCSS

**Endpoints:**
- GET /admin/monitoring (HTML page)
- GET /admin/monitoring/stream (SSE stream)

**Implementation Status:** ✅ COMPLETED (TASK-054)

---

#### FR-052: Enhanced Health Check Endpoints

**Phase:** 1 ✅ **РЕАЛИЗОВАНО**
**Приоритет:** Medium
**Категория:** operations

**Описание:**
Comprehensive health check endpoints для мониторинга состояния приложения, совместимые с Kubernetes readiness/liveness probes.

**User Story:**
Как DevOps engineer, я хочу проверять здоровье приложения через HTTP endpoints, чтобы автоматизировать мониторинг.

**Acceptance Criteria:**
1. ✅ GET /health - Basic health check (200 OK)
2. ✅ GET /health/detailed - Detailed health info (database, uptime, metrics)
3. ✅ GET /ready - Readiness probe (K8s compatible)
4. ✅ GET /ping - Ping endpoint (response: "pong")
5. ✅ JSON response format
6. ✅ Database connectivity check

**Response Examples:**
```json
// /health
{"status": "ok", "database": true}

// /health/detailed
{
  "status": "healthy",
  "database": {"connected": true, "pool_size": 5},
  "uptime_seconds": 3600,
  "version": "4.4.0"
}
```

**Implementation Status:** ✅ COMPLETED (TASK-053)

---

#### FR-053: Hierarchy API Endpoints

**Phase:** 1 ✅ **РЕАЛИЗОВАНО**
**Приоритет:** Medium
**Категория:** api_extensions

**Описание:**
Специальные API endpoints для работы с иерархией статей, использующие Closure Table pattern для эффективных запросов.

**User Story:**
Как frontend developer, я хочу получать subtree и breadcrumb path через API, чтобы отображать иерархические структуры.

**Acceptance Criteria:**
1. ✅ GET /api/v1/articles/{id}/subtree - Получить все дочерние статьи (любая глубина)
2. ✅ GET /api/v1/articles/{id}/ancestors - Получить путь от корня (breadcrumbs)
3. ✅ Query parameter: include_self (default: true)
4. ✅ Response includes depth level для каждого узла
5. ✅ Efficient queries (O(1) complexity через Closure Table)
6. ✅ User isolation (current_user.id filter)

**Query Examples:**
```
GET /api/v1/articles/5/subtree?include_self=true
→ Returns: [self, all children, all grandchildren, ...]

GET /api/v1/articles/15/ancestors
→ Returns: [root, parent, grandparent, ...]  (ordered by depth DESC)
```

**Implementation Status:** ✅ COMPLETED (TASK-019)

---

### 4.8 Phase 2 Roadmap - ЦФО/МВЗ Integration

#### FR-070: ЦФО/МВЗ Integration (PLANNED)

**Phase:** 2 ⏳ **PLANNED**
**Приоритет:** Medium
**Категория:** database_extension

**Описание:**
Интеграция Cost Centers (МВЗ) и Financial Centers (ЦФО) в API и UI. Таблицы уже созданы в БД, но не используются в Phase 1.

**Текущий статус:**
- ✅ Database tables: t_d_financial_center, t_d_cost_center созданы
- ✅ SCD Type 2 pattern реализован
- ❌ API endpoints: не реализованы
- ❌ UI: не реализованы
- ❌ Facts integration: t_f_budget_fact не содержит FK на ЦФО/МВЗ

**Acceptance Criteria (для Phase 2):**
1. ⏳ API endpoints для CRUD ЦФО/МВЗ
2. ⏳ UI для управления ЦФО/МВЗ (admin only)
3. ⏳ Добавить FK в t_f_budget_fact: financial_center_id, cost_center_id
4. ⏳ Migration для существующих данных
5. ⏳ Integration tests

**Dependencies:**
- Требуется для полной реализации FR-001, FR-002 (Telegram Bot)

---

### 4.9 Bug Fixes & Improvements (Phase 1)

#### BUG-001: WebApp Form Validation Issues

**Дата:** 2025-10-28
**Приоритет:** Critical
**Категория:** webapp_validation
**Статус:** ✅ FIXED

**Проблема:**
WebApp форма добавления фактов (webapp/add.html) отправляла некорректные данные на backend:
- Валидация `financial_center_id` пропускала falsy значения (0, null, undefined)
- Валидация `categoryId` имела ту же проблему
- Backend возвращал 422 (Unprocessable Entity) при отсутствии обязательного поля ЦФО

**Root Cause:**
JavaScript проверка `if (!formState.financialCenterId)` пропускала `0` как валидный ID.

**Решение:**
Улучшена валидация в функции `validateForm()` (webapp/add.html:681, 675):
```javascript
// Было:
if (!formState.financialCenterId) { ... }

// Стало:
if (!formState.financialCenterId || formState.financialCenterId <= 0) { ... }
```

**Затронутые файлы:**
- `webapp/add.html` (строки 675, 681)

**Acceptance Criteria:**
- ✅ Форма блокирует отправку без выбора ЦФО
- ✅ Форма блокирует отправку без выбора категории
- ✅ Корректная валидация ID (отклоняет 0, null, undefined)

---

#### BUG-002: Web Filter Dropdowns Not Showing Selected Values

**Дата:** 2025-10-28
**Приоритет:** High
**Категория:** web_ui_filters
**Статус:** ✅ FIXED

**Проблема:**
На страницах `/facts` и `/plan` после применения фильтров dropdown элементы возвращались к значению "-- Все --", хотя фильтрация данных работала корректно.

**Root Cause:**
JavaScript сохранял выбранные фильтры в объект `filters`, но не синхронизировал UI элементы (select) после загрузки данных.

**Решение:**
1. Создан общий модуль `web/static/js/admin-facts-common.js` с функцией `syncFiltersUI(filters)`
2. Подключен модуль в `facts.html` и `plan.html`
3. Добавлены вызовы `AdminFactsCommon.syncFiltersUI(filters)` в функции:
   - `applyFilters()` - после применения фильтров
   - `loadFacts()` - после загрузки данных

**Затронутые файлы:**
- `web/static/js/admin-facts-common.js` (NEW)
- `web/templates/facts.html` (строки 203, 409, 466)
- `web/templates/plan.html` (строки 203, 411, 477)

**Acceptance Criteria:**
- ✅ После применения фильтров dropdown показывают выбранные значения
- ✅ После перезагрузки данных фильтры остаются видимыми
- ✅ При сбросе фильтров dropdown возвращаются к "-- Все --"
- ✅ Код переиспользуется между facts.html и plan.html (DRY principle)

**Архитектурное улучшение:**
Рефакторинг дублированного кода (94% совпадения между facts.html и plan.html) путем выделения общей функции в отдельный модуль.

---

#### NOTE-001: WebApp Main Page Already Simplified

**Дата:** 2025-10-28
**Статус:** ✅ NO CHANGES NEEDED

**Контекст:**
Задача упрощения главной страницы WebApp (webapp/index.html) была выполнена ранее в коммите `d47cb4e` (2025-10-28 20:22).

**Текущее состояние:**
- ✅ Удалены кнопки: "Добавить", "План", "Поиск"
- ✅ Оставлены кнопки: "Сегодня", "Список", "Статистика", "План & Факт"
- ✅ Menu grid настроен на 3 колонки (grid-template-columns: repeat(3, 1fr))

**Затронутые файлы:**
- `webapp/index.html` (строки 288-312)

---

#### BUG-003: Web UI - Пустые dropdowns "Категория" в модальных окнах

**Дата:** 2025-10-29
**Приоритет:** CRITICAL
**Категория:** web_ui_dropdowns
**Статус:** ✅ FIXED

**Проблема:**
На странице https://budget-dev.ikeniborn.ru/ в модальных окнах "Добавить транзакцию" и "Добавить план" выпадающие списки "Категория" отображались пустыми, хотя справочник категорий был заполнен.

**Root Cause:**
- Файл: `web/templates/index.html`, строка 390
- API endpoint `/api/v1/articles?is_current=true` возвращает объект формата:
  ```json
  {
    "articles": [...],
    "total": 10,
    "limit": 100,
    "offset": 0
  }
  ```
- Код ожидал массив напрямую: `const categories = await response.json();`
- Итерация по объекту вместо массива: `categories.forEach(cat => ...)` не находила элементы

**Решение:**
- Изменена строка 390 (теперь 394-395):
  ```javascript
  // БЫЛО:
  const categories = await response.json();

  // СТАЛО:
  const data = await response.json();
  const categories = data.articles || [];
  ```
- Добавлен error handling с user-friendly сообщениями:
  - Предупреждение при HTTP ошибке
  - Предупреждение при пустом массиве категорий
  - Toast уведомления для пользователя
  - Console logging для отладки

**Затронутые файлы:**
- `web/templates/index.html` (строки 384-431)

**Acceptance Criteria:**
- ✅ Dropdown "Категория" заполняется корректно в обеих формах
- ✅ При отсутствии категорий показывается warning toast
- ✅ При ошибке загрузки показывается error toast
- ✅ Console logs помогают в debugging

---

#### BUG-004: WebApp - "Ошибка загрузки ЦФО" при добавлении транзакции

**Дата:** 2025-10-29
**Приоритет:** CRITICAL
**Категория:** webapp_api_client
**Статус:** ✅ FIXED

**Проблема:**
В Telegram WebApp на странице добавления транзакции (открывается через FAB) dropdown "Центр финансовой ответственности (ЦФО)" показывал "Ошибка загрузки ЦФО".

**Console Errors:**
```
add.html:535 Failed to load financial centers: TypeError: app.api.get is not a function
    at loadFinancialCenters (add.html:510:46)
    at window.pageInit (add.html:317:19)

add.html:569 Failed to load cost centers: TypeError: app.api.get is not a function
    at loadCostCenters (add.html:544:46)
    at window.pageInit (add.html:318:19)
```

**Root Cause:**
- Файл: `webapp/static/js/api.js`
- Класс `APIClient` НЕ имел метода `get()`
- Файл `webapp/add.html` строки 510 и 544 вызывали несуществующий метод:
  ```javascript
  const result = await app.api.get('/api/v1/financial-centers', { limit: 1000 });
  const result = await app.api.get('/api/v1/cost-centers', { limit: 1000 });
  ```
- Доступные методы: только `request()`, `listFacts()`, `createFact()`, и т.д.

**Решение:**
1. Добавлен метод `get()` в `APIClient` класс (api.js:72-89):
   ```javascript
   /**
    * Generic GET request helper.
    *
    * @param {string} endpoint - Full endpoint path (e.g., '/api/v1/financial-centers')
    * @param {Object} params - Query parameters
    * @returns {Promise<any>} Response data
    * @throws {APIError} On HTTP error
    */
   async get(endpoint, params = {}) {
       // Remove /api/v1 prefix if present (request() adds it automatically)
       const cleanEndpoint = endpoint.replace(/^\/api\/v1/, '');

       // Build query string
       const query = new URLSearchParams(params).toString();
       const fullEndpoint = query ? `${cleanEndpoint}?${query}` : cleanEndpoint;

       return this.request(fullEndpoint);
   }
   ```

2. Улучшен error handling в `add.html` (строки 534-573):
   - Для ЦФО (обязательное поле): показывается user-friendly ошибка через `app.ui.showError()`
   - Для МВЗ (опциональное поле): только console warning, без уведомления пользователя

**Затронутые файлы:**
- `webapp/static/js/api.js` (строки 72-89) - добавлен метод `get()`
- `webapp/add.html` (строки 537, 573) - улучшен error handling

**Acceptance Criteria:**
- ✅ Метод `app.api.get()` существует и работает корректно
- ✅ Dropdown "ЦФО" заполняется списком центров
- ✅ Dropdown "МВЗ" заполняется списком центров
- ✅ Нет ошибок в консоли браузера
- ✅ User-friendly сообщения при ошибках загрузки

---

#### BUG-005: Web UI - Month input отображает английские названия месяцев

**Дата:** 2025-10-29
**Приоритет:** MEDIUM
**Категория:** web_ui_localization
**Статус:** ✅ FIXED

**Проблема:**
На странице https://budget-dev.ikeniborn.ru/ в модальном окне "Добавить план" поле "Период (месяц)" отображало английское название месяца "October 2025" вместо русского "Октябрь 2025".

**Root Cause:**
- Файл: `web/templates/index.html`, строка 257 (в HTML template)
- Использовался нативный HTML5 `<input type="month">`
- Браузеры используют СВОЮ локализацию (зависит от настроек браузера/ОС)
- НЕТ стандартного способа принудительно задать язык для `type="month"`
- Атрибут `lang="ru"` НЕ влияет на отображение month picker

**Решение:**
Добавлен JavaScript для динамического обновления label с русским названием месяца (index.html:303-334):

```javascript
// Локализация month input - отображение русского названия месяца в label
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const updateMonthLabel = () => {
    if (!planMonthInput.value) return;

    const [year, month] = planMonthInput.value.split('-');
    const monthIndex = parseInt(month) - 1;

    // Найти label родительского form-control
    const formControl = planMonthInput.closest('.form-control');
    if (formControl) {
        const label = formControl.querySelector('.label-text');
        if (label) {
            label.textContent = `Период (${monthNames[monthIndex]} ${year})`;
        }
    }
};

// Обновить label при смене месяца
planMonthInput.addEventListener('change', updateMonthLabel);

// Инициализировать label сразу
updateMonthLabel();
```

**Поведение:**
- Нативный `<input type="month">` остаётся как есть (может показывать "October 2025")
- Label над полем обновляется на "Период (Октябрь 2025)"
- При смене месяца label автоматически обновляется с новым русским названием
- При открытии модалки label инициализируется с текущим значением

**Затронутые файлы:**
- `web/templates/index.html` (строки 303-334)

**Acceptance Criteria:**
- ✅ Label отображает русское название месяца
- ✅ При смене месяца label обновляется автоматически
- ✅ При открытии модалки label корректен
- ✅ Не требуется сторонних библиотек

**Альтернативные варианты (НЕ реализованы):**
- Вариант Б: Использовать custom date picker с полной русской локализацией (требует библиотеки)
- Вариант В: Использовать два отдельных select (месяц + год) вместо month input

---

#### BUG-006: Общее улучшение error handling в UI

**Дата:** 2025-10-29
**Приоритет:** MEDIUM
**Категория:** ux_improvements
**Статус:** ✅ IMPLEMENTED (в рамках BUG-003, BUG-004)

**Описание:**
В рамках исправления BUG-003, BUG-004, BUG-005 добавлены улучшения error handling:

1. **Web UI (index.html):**
   - Console warnings при HTTP ошибках
   - Console warnings при пустых массивах данных
   - Toast уведомления для пользователя (success/error/warning)
   - Logging для debugging

2. **WebApp (add.html):**
   - User-friendly ошибки через `app.ui.showError()` для критических полей (ЦФО)
   - Console warnings для опциональных полей (МВЗ)
   - Graceful fallback при ошибках API

**Acceptance Criteria:**
- ✅ Пользователь видит понятные сообщения об ошибках
- ✅ Ошибки не блокируют работу приложения полностью
- ✅ Console logs помогают в debugging
- ✅ Различное поведение для обязательных и опциональных полей

---

#### BUG-007: PostgreSQL Corruption при инкрементальном деплое

**Дата:** 2025-10-29
**Приоритет:** CRITICAL
**Категория:** deployment_postgresql_incremental
**Статус:** ✅ FIXED

**Проблема:**
При использовании инкрементального деплоя (Update sync + Safe cleanup) все 10 системных каталогов PostgreSQL удалялись, вызывая 100% corruption:
```
✗ pg_commit_ts
✗ pg_dynshmem
✗ pg_notify
✗ pg_replslot
✗ pg_serial
✗ pg_snapshots
✗ pg_stat
✗ pg_stat_tmp
✗ pg_tblspc
✗ pg_twophase

Corruption level: 100% (10 of 10 directories missing)
```

**Симптомы:**
- "Update only (rsync)" + "Safe cleanup" → данные PostgreSQL удалялись
- Существующие транзакции, таблицы терялись
- PostgreSQL инициализировал чистую БД вместо использования existing data
- "Clean sync + Full cleanup" работал корректно (но это полная переустановка)

**Root Cause:**

Функция `initialize_postgres_directory()` (deploy.sh:838) использовала `chown 999:999` **БЕЗ флага `-R`** (рекурсивно).

**Последовательность проблемы:**

1. **До деплоя:** PostgreSQL работал с Debian образом (UID 70:70):
   ```
   /opt/budget/data/postgres/          owner: 70:70 ✅
   ├── pg_stat_tmp/                    owner: 70:70 ✅
   ├── pg_stat/                        owner: 70:70 ✅
   ├── base/                           owner: 70:70 ✅
   ```

2. **initialize_postgres_directory()** менял owner ТОЛЬКО parent directory:
   ```bash
   sudo chown 999:999 "$postgres_data_dir"  # ❌ БЕЗ -R
   ```

   **Результат:**
   ```
   /opt/budget/data/postgres/          owner: 999:999 ← CHANGED!
   ├── pg_stat_tmp/                    owner: 70:70   ← UNCHANGED
   ├── pg_stat/                        owner: 70:70   ← UNCHANGED
   ├── base/                           owner: 70:70   ← UNCHANGED
   ```

3. **Permission mismatch:** Новый PostgreSQL контейнер (Alpine UID 999) не мог прочитать subdirectories с owner 70:70 и permissions 0700 (drwx------).

4. **PostgreSQL behavior:** При обнаружении inaccessible subdirectories PostgreSQL интерпретировал это как corruption и **удалял все каталоги**, создавая чистую структуру.

5. **check_and_repair_postgres_data()** обнаруживал 100% corruption, но было уже поздно - данные удалены.

**Почему "Clean sync + Full cleanup" работал:**
- Полностью удалял `/opt/budget/data/postgres/*` → нет permission mismatch
- PostgreSQL создавал чистую структуру с правильным UID 999:999

**Почему "Update sync + Safe cleanup" НЕ работал:**
- Сохранял subdirectories с owner 70:70 от старого контейнера
- initialize_postgres_directory() менял только parent → permission mismatch
- PostgreSQL не мог читать → удалял всё

**Решение:**

**1. Auto-detect текущего PostgreSQL UID из existing data** (deploy.sh:824-831):
```bash
# Detect current PostgreSQL UID from existing data (if any)
local target_uid=999  # Default: Alpine Linux
local target_gid=999

if [[ -d "$postgres_data_dir/base" ]]; then
    # Data exists - detect current owner from base/ directory
    target_uid=$(stat -c '%u' "$postgres_data_dir/base" 2>/dev/null || echo "999")
    target_gid=$(stat -c '%g' "$postgres_data_dir/base" 2>/dev/null || echo "999")
    info "Detected existing PostgreSQL UID from data: $target_uid:$target_gid"
fi
```

**2. Рекурсивный chown для ВСЕХ subdirectories** (deploy.sh:853, 862):
```bash
# БЫЛО:
sudo chown 999:999 "$postgres_data_dir"

# СТАЛО:
sudo chown -R $target_uid:$target_gid "$postgres_data_dir"
```

**3. Гарантированная верификация subdirectories** (deploy.sh:860-866):
Даже если parent ownership корректен, выполняется рекурсивная верификация всех subdirectories для устранения потенциального permission mismatch.

**Затронутые файлы:**
- `deploy.sh` (строки 815-871) - функция `initialize_postgres_directory()`

**Acceptance Criteria:**
- ✅ Update sync + Safe cleanup работает без потери данных PostgreSQL
- ✅ Permission mismatch между parent и subdirectories устранен
- ✅ Существующие таблицы, транзакции сохраняются при инкрементальном деплое
- ✅ Auto-detect UID обеспечивает совместимость с любым PostgreSQL образом (Alpine 999, Debian 70)
- ✅ Рекурсивный chown гарантирует единообразие ownership для всех файлов

**Тестирование:**

**До исправления:**
```bash
# Инкрементальный деплой
./deploy.sh
# Select: [2] Update sync, [2] Safe cleanup
# РЕЗУЛЬТАТ: 100% corruption, данные потеряны
```

**После исправления:**
```bash
# Инкрементальный деплой
./deploy.sh
# Select: [2] Update sync, [2] Safe cleanup
# РЕЗУЛЬТАТ:
#   [INFO] Detected existing PostgreSQL UID from data: 70:70
#   [SUCCESS] Ownership corrected to 70:70 (recursive)
#   [SUCCESS] PostgreSQL data preserved, no corruption
```

**Benefits:**
- 🚀 Быстрый инкрементальный деплой (без пересоздания БД)
- 💾 Сохранение existing данных при обновлении кода
- 🔄 Универсальность: работает с любым PostgreSQL Docker образом
- 🛡️ Защита от permission mismatch
- ✅ Update sync теперь безопасен для production

**Связанные баги:**
- Связано с BUG-006 (PostgreSQL corruption - неправильный UID 70 vs 999)
- Полностью решает проблему инкрементального обновления без потери данных

---

