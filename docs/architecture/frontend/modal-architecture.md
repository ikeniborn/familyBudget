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

**⚠️ НЕ используйте:**
- `#form_modal_add_transaction` (удалён в v10.x)
- `#form_modal_add_plan` (удалён в v10.x)

Эти селекторы больше не существуют. Используйте новые табовые селекторы:
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
