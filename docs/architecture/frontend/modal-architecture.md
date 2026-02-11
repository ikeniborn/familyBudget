# Modal Architecture (v10.x+)

## Overview

Family Budget использует табовую архитектуру для модальных окон создания транзакций и планов. Каждая модалка содержит два таба: **Transaction** (обычная транзакция) и **Transfer** (перевод между счетами).

## Tab-Based Modals

### modal_fact (Фактические транзакции)

**Transaction tab:**
- Selector: `#modal_fact-tab-transaction`
- Поля: financial_center, article, cost_center, amount, date
- CategoryTreeSelect: `state.transactionCategoryTreeSelect`

**Transfer tab:**
- Selector: `#modal_fact-tab-transfer`
- Поля: from_financial_center, to_financial_center, from_article, to_article, amount, date
- CategoryTreeSelect FROM: `state.factTransferFromCategoryTree` (expense)
- CategoryTreeSelect TO: `state.factTransferToCategoryTree` (income)

### modal_plan (Планируемые транзакции)

**Transaction tab:**
- Selector: `#modal_plan-tab-transaction`
- Поля: financial_center, article, cost_center, amount, period
- CategoryTreeSelect: `state.planCategoryTreeSelect`

**Transfer tab:**
- Selector: `#modal_plan-tab-transfer`
- Поля: from_financial_center, to_financial_center, from_article, to_article, amount, period
- CategoryTreeSelect FROM: `state.planTransferFromCategoryTree` (expense)
- CategoryTreeSelect TO: `state.planTransferToCategoryTree` (income)

## Dropdown Loading

### Financial Centers (счета)

**Централизованная функция:** `loadFinancialCenters(targetSelectors?: string[])`

**Расположение:** `frontend/web/static/js/dashboard/features/addTransaction/categoryLoader.ts`

**Использование:**
```typescript
// Transaction tabs (default selectors)
await loadFinancialCenters();

// Transfer tabs (explicit selectors)
await loadFinancialCenters([
  '#modal_fact-tab-transfer select[name="from_financial_center_id"]',
  '#modal_fact-tab-transfer select[name="to_financial_center_id"]'
]);
```

**Особенности:**
- Использует DataLayer (PGlite-first с API fallback)
- Поддерживает явные селекторы через параметр `targetSelectors`
- Debug logging для не найденных селекторов
- Автоматическая валидация пустых списков

### Categories (статьи)

**Transaction tabs:**
- Используют `loadTransactionCategories()`
- Один CategoryTreeSelect на форму
- Динамическая смена типа (income/expense) через radio buttons

**Transfer tabs:**
- Используют два независимых `ChoicesCategoryTree`:
  - FROM: всегда expense (расход)
  - TO: всегда income (доход)
- Инициализация в `loadTransferTabData()`

### Cost Centers (места затрат)

**Функция:** `loadCostCenters()`

**Фильтрация:** `filterCostCenterDropdown(formSelector, financialCenterId)`
- Автоматически вызывается при выборе счета
- Whitelist pattern: показывает ЦЗ без ограничений ИЛИ привязанные к выбранному счету

## Legacy Forms (Deprecated)

### Legacy Removal (v11.x+)

**⚠️ Полностью удалены в v11.x:**

**Modal IDs:**
- `#modal_add_transaction` → используйте `#modal_fact`
- `#modal_add_plan` → используйте `#modal_plan`

**Form IDs:**
- `#form_modal_add_transaction` → используйте `#form_modal_fact`
- `#form_modal_add_plan` → используйте `#form_modal_plan`

**TypeScript modules (удалены):**
- `features/addPlan/planForm.ts` → заменён на `modalPlan/saveOperations.ts`
- `features/addPlan/planHints.ts` → заменён на `modalPlan/index.ts`

**Legacy functions (удалены из windowExports.ts):**
- `loadPlanCategories()` → используйте `modalPlan/index.ts` (автоматическая загрузка)
- `savePlan()` → используйте `savePlanModal()`
- `savePlanOffline()` → заменён на Dexie integration в `modalPlan/saveTransaction.ts`
- `loadPlanHints()` → используйте `loadPlanTransactionHints()` в `modalPlan/index.ts`

**Migration completed:**
- Все страницы теперь используют табовую архитектуру v9.0+
- Inline JavaScript удалён из templates
- Единая точка входа: `window.openModalPlan()`, `window.openModalFact()`
- ~3416 строк мертвого кода удалено (plan.html: 5780 → 2364 строк)

**Используйте новые табовые селекторы:**
- `#modal_fact-tab-transaction`
- `#modal_fact-tab-transfer`
- `#modal_plan-tab-transaction`
- `#modal_plan-tab-transfer`

## Validation

**Critical checks после загрузки данных:**
```typescript
const fcSelect = document.querySelector('#modal_fact-tab-transaction select[name="financial_center_id"]') as HTMLSelectElement | null;
if (!fcSelect || fcSelect.options.length <= 1) {
  console.error('[ModalFact] Financial center select not populated');
  showToast('Ошибка загрузки счетов. Обновите страницу.', 'error');
}
```

**Где валидируется:**
- `modalFact/index.ts:loadTransactionTabData()` - после `Promise.all`
- `modalPlan/index.ts:loadTransactionTabData()` - после `Promise.all`

## Data Loading Flow

### Transaction Tab

1. **Check cache validity** (`dropdownCache.categories`, `financialCenters`, `costCenters`)
2. **Load dropdowns in parallel** (если кэш устарел):
   - `loadTransactionCategories()` - CategoryTreeSelect
   - `loadFinancialCenters()` - Счета
   - `loadCostCenters()` - Места затрат
3. **Validate** критические селекты (финансовые центры)
4. **Setup listeners** для фильтрации

### Transfer Tab

1. **Check initialization** (CategoryTreeSelect instances в state)
2. **Load financial centers** с явными селекторами (FROM/TO)
3. **Initialize CategoryTreeSelect** для FROM (expense) и TO (income)
4. **Setup FC change listeners** для transfer hints
5. **Save instances to state**

## Loading Sequence Best Practices

### Critical Dependencies

При загрузке данных для modal табов необходимо соблюдать правильную последовательность:

1. **Загружать критические зависимости ПЕРВЫМИ** (например, financial centers)
2. **Валидировать сразу после** критических загрузок (fail-fast pattern)
3. **Загружать независимые данные параллельно** (например, categories, cost centers)

**Пример правильной последовательности:**
```typescript
async function loadTransactionTabData(): Promise<void> {
  // Загрузить FC первыми (критическая зависимость)
  await loadFinancialCenters();

  // Валидировать СРАЗУ после загрузки (fail-fast)
  const fcSelect = document.querySelector('select[name="financial_center_id"]');
  if (!fcSelect || fcSelect.options.length <= 1) {
    throw new Error('Failed to load financial centers');
  }

  // Загрузить остальное параллельно (безопасно - независимые операции)
  await Promise.all([
    loadTransactionCategories(),
    loadCostCenters()
  ]);
}
```

**Почему это важно:**
- ✅ Гарантирует правильный порядок выполнения
- ✅ Fails fast если критические данные недоступны
- ✅ Сохраняет параллельность для независимых операций
- ✅ Предотвращает race conditions при загрузке

**Применяется в:**
- `modalFact/index.ts:loadTransactionTabData()` (lines 75-113)
- `modalPlan/index.ts:loadTransactionTabData()` (lines 76-115)

## Hints System

### Transaction Hints

**Когда обновляются:**
- При выборе категории (если счёт уже выбран)
- При выборе счёта (если категория уже выбрана)

**API endpoint:**
- Fact: `/api/v1/hints/fact-hints?fact_date={date}&article_id={id}&article_type={type}&financial_center_id={fc_id}`
- Plan: `/api/v1/hints/plan-hints?period={period}&article_id={id}&article_type={type}&financial_center_id={fc_id}`

### Transfer Hints

**Направления:**
- FROM: hints для счёта откуда (expense)
- TO: hints для счёта куда (income)

**Обновление:**
- При изменении FROM/TO счёта
- При изменении FROM/TO категории

**Кнопки:**
- Fact: `#from-hint-period-plan`, `#from-hint-period-fact` (display-only)
- Plan: `#from-hint-prev-plan`, `#from-hint-prev-fact` (clickable, заполняют amount)

## State Management

**Dashboard State хранит:**
```typescript
interface DashboardState {
  // Transaction tabs
  transactionCategoryTreeSelect: ChoicesCategoryTree | null;
  planCategoryTreeSelect: ChoicesCategoryTree | null;

  // Transfer tabs
  factTransferFromCategoryTree: ChoicesCategoryTree | null;
  factTransferToCategoryTree: ChoicesCategoryTree | null;
  planTransferFromCategoryTree: ChoicesCategoryTree | null;
  planTransferToCategoryTree: ChoicesCategoryTree | null;

  // Caching
  dropdownCache: {
    categories: CacheEntry | null;
    financialCenters: CacheEntry | null;
    costCenters: CacheEntry | null;
  };

  // Cost centers (for filtering)
  allCostCenters: CostCenter[];
}
```

## Cache TTL

**Default:** 5 минут (300000 ms)

**Проверка:**
```typescript
function isCacheValid<T>(cache: CacheEntry<T> | null): boolean {
  if (!cache || !cache.timestamp) return false;
  const age = Date.now() - cache.timestamp;
  return age < (cache.ttl || 5 * 60 * 1000);
}
```

## Debugging

**Enable debug logs:**
```javascript
window.DEBUG_MODE = true;
```

**Ожидаемые логи:**
```
[loadFinancialCenters] Populated: #modal_fact-tab-transaction select[name="financial_center_id"] (5 accounts)
[loadFinancialCenters] Populated: #modal_fact-tab-transfer select[name="from_financial_center_id"] (5 accounts)
[ModalFact] Transaction data loaded
[ModalFact] Transfer data loaded
```

**НЕ должно быть:**
```
No accounts returned  ← Эта ошибка указывает на проблему с DataLayer
[loadFinancialCenters] Selector not found: ...  ← Проблема с HTML структурой
```

## Migration from Legacy Forms

**Если вы видите старые селекторы:**

| ❌ Legacy (v9.x) | ✅ New (v10.x+) |
|-----------------|----------------|
| `#form_modal_add_transaction select[name="financial_center_id"]` | `#modal_fact-tab-transaction select[name="financial_center_id"]` |
| `#form_modal_add_plan select[name="financial_center_id"]` | `#modal_plan-tab-transaction select[name="financial_center_id"]` |
| `#form_modal_add_transaction select[name="article_id"]` | `#modal_fact-tab-transaction select[name="article_id"]` |
| `#form_modal_add_plan select[name="article_id"]` | `#modal_plan-tab-transaction select[name="article_id"]` |

**Для transfer табов:**
- Используйте `#modal_fact-tab-transfer` и `#modal_plan-tab-transfer`
- FROM/TO financial centers: `select[name="from_financial_center_id"]` и `select[name="to_financial_center_id"]`
- FROM/TO articles: `select[name="from_article_id"]` и `select[name="to_article_id"]`

## Related Files

**Core logic:**
- `frontend/web/static/js/dashboard/features/addTransaction/categoryLoader.ts` - Централизованная загрузка dropdown'ов
- `frontend/web/static/js/dashboard/features/modalFact/index.ts` - Fact modal entry point
- `frontend/web/static/js/dashboard/features/modalPlan/index.ts` - Plan modal entry point

**State management:**
- `frontend/web/static/js/dashboard/core/DashboardState.ts` - Глобальное состояние

**Utilities:**
- `frontend/web/static/js/data/DataLayer.ts` - PGlite-first data access
- `frontend/web/static/js/offline/offlineManager/utils/userHelpers.ts` - User ID helpers

## Modal Data Loading Strategy (v10.x+)

### Financial Centers Loading (Retry Pattern)

**Problem:** Race condition между открытием модального окна и завершением инициализации PGlite.

**Solution:**
1. **PGlite readiness polling** - DataLayer ждёт до 5 секунд пока PGlite станет готовым
2. **Retry logic** - categoryLoader делает до 3 попыток с exponential backoff (500мс, 1000мс)
3. **Automatic fallback** - если PGlite не готов, используется REST API

**Implementation:**
- `DataLayer.ts:198-235` - PGlite readiness polling
- `categoryLoader.ts:94-155` - Retry logic
- `modalFact/index.ts:75-115` - Modal integration
- `modalPlan/index.ts:76-117` - Modal integration

**Retry sequence:**
```
Attempt 1: Immediate (0ms delay)
Attempt 2: +500ms delay
Attempt 3: +1000ms delay
→ Fallback to API or show error
```

**Logging:**
```
[loadFinancialCenters] Attempt 1/3
[DATA_LAYER] PGlite not ready, waiting...
[DATA_LAYER] PGlite ready after wait
[loadFinancialCenters] ✅ Loaded 5 financial centers on attempt 1
```

**См. также:** `docs/architecture/pglite-race-conditions.md` для полного описания решения race condition

## UI Enhancements (v11.2.37+)

### Date Button Active State Management

**Problem:** Кнопки "Сегодня/Вчера/Позавчера" не подсвечивались при установке даты.

**Solution:** Добавлена логика управления состоянием кнопок в `dateHelpers.ts`:

```typescript
// dateHelpers.ts:setFactDate()
buttons.forEach((btn, index) => {
  const isActive = index === Math.abs(daysOffset);
  btn.classList.toggle('btn-active', isActive);
  btn.classList.toggle('btn-outline', !isActive);
});
```

**Affects:**
- `setFactDate()` - transaction tab
- `setFactTransferDate()` - transfer tab

**Visual result:**
- Active button: solid color (DaisyUI `btn-active`)
- Inactive buttons: outlined (DaisyUI `btn-outline`)

### Recent Transactions HTMX Refresh Pattern

**Problem:** Таблица Recent Transactions не обновлялась после добавления факта/перевода.

**Root cause:** `htmx.trigger(el, 'load')` не перезапускает `hx-get` директивы.

**Solution:** Использовать `htmx.ajax()` для явного HTTP запроса:

```typescript
// uiRefresh.ts:72-76
htmx.ajax('GET', '/api/v1/facts/recent-html?limit=10', {
  target: '#recent-transactions',
  swap: 'innerHTML'
});
```

**Why this works:**
- `htmx.ajax()` делает прямой HTTP запрос и обновляет DOM
- `htmx.trigger()` только вызывает event listeners, но НЕ `hx-get`

**Endpoint:** `/api/v1/facts/recent-html?limit=10`

### Transaction Hints Loading (v11.2.37+)

**Feature:** Автоматическое обновление подсказок "План/Факт за месяц" при выборе счета/категории/типа операции.

**Implementation:**

**1. Function:** `loadFactTransactionHints()` в `modalFact/index.ts:335-391`

```typescript
async function loadFactTransactionHints(): Promise<void> {
  const categoryId = categoryTree?.getSelectedCategory()?.id;
  const fcId = fcSelect?.value ? parseInt(fcSelect.value) : null;

  if (!categoryId || !fcId) {
    updateTransactionHintButtons(null); // Reset to placeholder
    return;
  }

  // API call: /api/v1/analytics/fact-hints
  const data = await fetch(url).then(r => r.json());
  updateTransactionHintButtons(data);
}
```

**2. Integration points:**

| Trigger | Location | Implementation |
|---------|----------|----------------|
| Financial center change | `modalFact/index.ts:121-133` | `setupTransactionFCListener()` |
| Category change | `categoryLoader.ts:88-99` | `loadFactHintsForCategory()` callback |
| Transaction type change | `typeToggle.ts:89-95` | After `categoryTree.updateType()` |

**3. API Endpoint:**
```
GET /api/v1/analytics/fact-hints
Query params:
  - fact_date: YYYY-MM-DD
  - article_id: int
  - article_type: expense|income
  - financial_center_id: int

Response:
{
  "period_plan_sum": 50000,
  "period_fact_sum": 32500
}
```

**4. UI States:**

| State | Display |
|-------|---------|
| Loading | Spinner (`loading loading-spinner loading-xs`) |
| No data | "План мес: --", "Факт мес: --" (disabled) |
| With data | "План мес: 50 000", "Факт мес: 32 500" (enabled) |

**Limitations:**
- Legacy modal (`modal_add_transaction`) uses old hints system
- New modal (`modal_fact`) uses this implementation

### Recurring Plan Form Initialization (Enhanced Debug Logging)

**Feature:** Debug логирование для диагностики проблем видимости формы "Регулярный платеж".

**Implementation:** `recurringSettings.ts:togglePlanMode()`

```typescript
export function togglePlanMode(modalId: string): void {
  console.log(`[togglePlanMode] Called with modalId: ${modalId}`);

  // 1. Validate form exists
  if (!form) {
    console.error(`[togglePlanMode] Form not found: form_${modalId}`);
    return;
  }

  // 2. Log selected mode
  console.log(`[togglePlanMode] Selected mode: ${selectedMode}`);

  // 3. Validate sections exist
  if (!recurringSettings || !onetimeReminderSection) {
    console.error('[togglePlanMode] Missing sections:', {
      recurringSettings: !!recurringSettings,
      onetimeReminderSection: !!onetimeReminderSection,
      expectedIds: {
        recurring: `recurring-settings-${modalId}`,
        reminder: `onetime-reminder-section-${modalId}`
      }
    });
    return;
  }

  // 4. Log state transitions
  console.log('[togglePlanMode] All sections hidden');
  console.log('[togglePlanMode] Recurring settings shown');
}
```

**Debug output example:**
```
[togglePlanMode] Called with modalId: modal_plan
[togglePlanMode] Selected mode: recurring
[togglePlanMode] All sections hidden
[togglePlanMode] Recurring settings shown
```

**Benefits:**
- Entry/exit points tracked
- Element ID validation logged
- State transitions visible
- Future debugging easier
