# Plan: Dexie Diagnostics — Доработки по результатам исследования

**Source:** `docs/explore/dexie-diagnostics-research.md`
**Date:** 2026-02-17
**Branch:** `dev/dexie-diagnostics-improvements`

---

## Context

Исследование диагностической панели Dexie выявило три группы проблем:

1. **Два критических бага** в `DexieDiagnosticModal.ts`: слайдер Plans получает значение в днях вместо месяцев (строка 214), и неверная подпись `days` вместо `months` в таблице статистики (строка 404).

2. **Симметричный диапазон Plans** — один ползунок управляет одновременно глубиной истории прошлых планов и горизонтом будущих. Пользователь не может настроить их независимо.

3. **Диагностика недоступна на большинстве страниц** — `window.openDexieDiagnostic()` зарегистрирована только в bundle'ах dashboard (`dashboard/index.ts:249`) и lists (`lists-bundle.ts:250`). На `/facts`, `/analytics`, `/notifications`, `/security_settings` — ошибка в консоли при тройном клике на индикатор.

---

## Фаза 1 — Критические баги (1 файл)

**Файл:** `frontend/web/static/js/modules/uiComponents/modals/DexieDiagnosticModal.ts`

### Баг 1: строки 212–215

`getDiagnosticData()` в DexieManager уже возвращает правильный `syncPeriod: { facts: getSyncPeriodDays(), plans: getSyncPeriodMonths() }` (DexieManager.ts:985–988). Код в Modal перезаписывает оба поля значением в **днях**:

```typescript
// ТЕКУЩИЙ КОД (строки 212-215):
const data: DiagnosticData = {
  ...baseData,
  syncPeriod: {
    facts: syncPeriodDays,   // ✅ правильно
    plans: syncPeriodDays    // ❌ дни вместо месяцев — baseData уже содержит правильное значение
  },
  // ...
};

// ИСПРАВЛЕНИЕ: убрать syncPeriod из override, использовать из baseData:
const data: DiagnosticData = {
  ...baseData,               // syncPeriod: { facts: дни, plans: месяцы } уже здесь
  websocket: { ... },        // остальные поля-override без syncPeriod
  syncMetadata: { ... }
};
```

Также убрать неиспользуемую переменную `syncPeriodDays` (строка 187) — она больше не нужна.

### Баг 2: строка 404

```typescript
// БЫЛО:
<td>${data.tableStats.plans} <span class="text-xs opacity-60">(${data.syncPeriod.plans} days)</span></td>
// СТАЛО:
<td>${data.tableStats.plans} <span class="text-xs opacity-60">(${data.syncPeriod.plans} months)</span></td>
```

---

## Фаза 2 — Разделение Plans на History + Future (3 файла)

### 2.1 `frontend/shared/db/dexie/DexieManager.ts`

**`migrateSyncPeriodSettings()` (строки 147–177):** добавить шаг 2 — разделение `plans` → `plans_history` + `plans_future`. Запускается однократно. Старый ключ `budget_dexie_sync_period_plans` **не удалять** (он используется как fallback в новых геттерах).

```typescript
// Добавить в конец migrateSyncPeriodSettings(), после существующей логики:
const plansHistoryKey = 'budget_dexie_sync_period_plans_history';
const plansFutureKey = 'budget_dexie_sync_period_plans_future';
if (!localStorage.getItem(plansHistoryKey) && !localStorage.getItem(plansFutureKey)) {
  const base = parseInt(localStorage.getItem(plansKey) ?? '3', 10);
  localStorage.setItem(plansHistoryKey, base.toString());
  localStorage.setItem(plansFutureKey, base.toString());
}
```

**4 новых метода** (добавить после `setSyncPeriodMonths()`, строка 1133):

```typescript
getSyncPeriodPlansHistory(): number
  // localStorage: 'budget_dexie_sync_period_plans_history'
  // fallback: getSyncPeriodMonths() (старый ключ plans)
  // default: 3

setSyncPeriodPlansHistory(months: number): void
  // валидация: 1-6, аналогично setSyncPeriodMonths

getSyncPeriodPlansFuture(): number
  // localStorage: 'budget_dexie_sync_period_plans_future'
  // fallback: getSyncPeriodMonths()
  // default: 3

setSyncPeriodPlansFuture(months: number): void
  // валидация: 1-6, аналогично setSyncPeriodMonths
```

**`getDiagnosticData()` (строки 927–930, 985–988):** расширить тип и возвращаемый объект:

```typescript
// Тип (927-930):
syncPeriod: {
  facts: number;
  plans: number;           // оставить для backward compat
  plansHistory: number;    // НОВОЕ
  plansFuture: number;     // НОВОЕ
};

// Значения (985-988):
syncPeriod: {
  facts: this.getSyncPeriodDays(),
  plans: this.getSyncPeriodMonths(),
  plansHistory: this.getSyncPeriodPlansHistory(),
  plansFuture: this.getSyncPeriodPlansFuture()
}
```

### 2.2 `frontend/shared/db/dexie/operations/referenceSync.ts`

**Добавить `calculatePlansRange`** рядом с `calculateFullMonthsRange` (строки 310–336). Не удалять старую — превратить её в wrapper:

```typescript
function calculatePlansRange(historyMonths: number, futureMonths: number): { fromDate: string; toDate: string } {
  const today = new Date();
  const formatDate = (d: Date) => { /* та же inline функция, строки 325-330 */ };
  const fromDate = new Date(today.getFullYear(), today.getMonth() - historyMonths, 1);
  const toDate = new Date(today.getFullYear(), today.getMonth() + futureMonths + 1, 0);
  return { fromDate: formatDate(fromDate), toDate: formatDate(toDate) };
}

// Старая функция — wrapper для backward compat:
function calculateFullMonthsRange(months: number): { fromDate: string; toDate: string } {
  return calculatePlansRange(months, months);
}
```

**`syncRecurringPlans()` (строка 346–354):** добавить опциональные параметры:

```typescript
export async function syncRecurringPlans(
  userId: number,
  syncPeriodMonths: number = 3,   // legacy param
  historyMonths?: number,          // НОВОЕ (опционально)
  futureMonths?: number            // НОВОЕ (опционально)
): Promise<{ success: boolean; count: number }> {
  const history = historyMonths ?? syncPeriodMonths;
  const future = futureMonths ?? syncPeriodMonths;
  const { fromDate, toDate } = calculatePlansRange(history, future);
  // остальной код без изменений
```

**`initialReferenceSync()` (строки 435, 445):** передавать новые значения:

```typescript
// Строка 435: добавить после getSyncPeriodMonths
const historyMonths = (await dexieManager).getSyncPeriodPlansHistory?.() ?? 3;
const futureMonths = (await dexieManager).getSyncPeriodPlansFuture?.() ?? 3;

// Строка 445: передать параметры
recurringPlans: await syncRecurringPlans(userId, syncPeriodMonths, historyMonths, futureMonths)
```

### 2.3 `frontend/web/static/js/modules/uiComponents/modals/DexieDiagnosticModal.ts` (продолжение)

**Интерфейс `DiagnosticData` (строки 58–61):** добавить новые поля:

```typescript
syncPeriod: {
  facts: number;
  plans: number;           // оставить для backward compat
  plansHistory: number;    // НОВОЕ
  plansFuture: number;     // НОВОЕ
};
```

**Заменить Plans slider (строки 474–491)** двумя новыми слайдерами:

```
<!-- Plans History Slider (months back) -->
input type="range" min="1" max="6" step="1"
  value="${data.syncPeriod.plansHistory}"
  id="sync-period-plans-history-slider"
  oninput="window.updateSyncPeriodPlansHistoryDisplay?.(this.value)"
  onchange="window.updateSyncPeriodPlansHistory?.(this.value)"
  class="range range-xs range-secondary"
display: id="sync-period-plans-history-value" → "${data.syncPeriod.plansHistory} months"

<!-- Plans Future Slider (months ahead) -->
input type="range" min="1" max="6" step="1"
  value="${data.syncPeriod.plansFuture}"
  id="sync-period-plans-future-slider"
  oninput="window.updateSyncPeriodPlansFutureDisplay?.(this.value)"
  onchange="window.updateSyncPeriodPlansFuture?.(this.value)"
  class="range range-xs range-accent"
display: id="sync-period-plans-future-value" → "${data.syncPeriod.plansFuture} months"
```

**Добавить 4 приватных метода** (после `updateSyncPeriodPlans()`, строка 700) по образцу существующих `updateSyncPeriodPlansDisplay`/`updateSyncPeriodPlans` (строки 676–700):

```
updateSyncPeriodPlansHistoryDisplay(months)  — обновляет #sync-period-plans-history-value
updateSyncPeriodPlansHistory(months)          — вызывает setSyncPeriodPlansHistory + reload
updateSyncPeriodPlansFutureDisplay(months)   — обновляет #sync-period-plans-future-value
updateSyncPeriodPlansFuture(months)           — вызывает setSyncPeriodPlansFuture + reload
```

**Добавить 4 новых window-экспорта** в `openDexieDiagnostic()` (строки 717–732):

```typescript
// После существующих updateSyncPeriodPlansDisplay / updateSyncPeriodPlans:
(window as any).updateSyncPeriodPlansHistoryDisplay = ...
(window as any).updateSyncPeriodPlansHistory = ...
(window as any).updateSyncPeriodPlansFutureDisplay = ...
(window as any).updateSyncPeriodPlansFuture = ...
```

---

## Фаза 3 — Доступность диагностики на всех страницах (3 файла + 1 новый)

**Проблема:** `window.openDexieDiagnostic` зарегистрирована только в `dashboard.min.js` и `lists.min.js`. На `/facts`, `/analytics`, `/notifications`, `/security_settings`, admin-страницах — ошибка в консоли.

**Решение:** micro-bundle (~50 KB), подключается в `base.html` глобально для авторизованных пользователей.

### 3.1 Новый файл: `frontend/web/static/js/diagnostics/dexie-diagnostic-entry.ts`

```typescript
import { openDexieDiagnostic } from '../modules/uiComponents/modals/DexieDiagnosticModal';

// Не перезаписывать, если dashboard/lists уже зарегистрировали
if (typeof window !== 'undefined' && !(window as any).openDexieDiagnostic) {
  (window as any).openDexieDiagnostic = openDexieDiagnostic;
}
```

### 3.2 `build-all.js`

Добавить бандл после существующего `dexie` бандла:

```javascript
{
  name: 'dexieDiagnostic',
  input: 'frontend/web/static/js/diagnostics/dexie-diagnostic-entry.ts',
  output: 'frontend/web/static/js/diagnostics/dexie-diagnostic.min.js',
  globalName: 'DexieDiagnostic'
}
```

### 3.3 `frontend/web/templates/base.html`

Добавить после `dexie.min.js` (строки ~459):

```html
{% if user %}
<script src="/static/js/diagnostics/dexie-diagnostic.min.js?v=PLACEHOLDER"></script>
{% endif %}
```

---

## Критические файлы

| Файл | Фаза | Что меняется |
|------|------|-------------|
| `frontend/web/static/js/modules/uiComponents/modals/DexieDiagnosticModal.ts` | 1, 2 | Строки 58-61, 187, 212-215, 404, 474-491, 676-700+, 717-734 |
| `frontend/shared/db/dexie/DexieManager.ts` | 2 | Строки 147-177 (migrate), 927-930, 985-988 (getDiagnostic), +4 метода после 1133 |
| `frontend/shared/db/dexie/operations/referenceSync.ts` | 2 | Строки 310-336 (новая calculatePlansRange), 346-354 (сигнатура), 435, 445 |
| `frontend/web/static/js/diagnostics/dexie-diagnostic-entry.ts` | 3 | **НОВЫЙ** entry point |
| `build-all.js` | 3 | +1 бандл dexieDiagnostic |
| `frontend/web/templates/base.html` | 3 | +1 тег `<script>` после dexie.min.js |

---

## Повторно использовать существующий код

| Что реиспользовать | Где находится |
|-------------------|---------------|
| `getSyncPeriodDays()` / `setSyncPeriodDays()` | `DexieManager.ts:1092, 1115` |
| `getSyncPeriodMonths()` / `setSyncPeriodMonths()` | `DexieManager.ts:1106, 1127` — шаблон для новых методов |
| `migrateSyncPeriodSettings()` | `DexieManager.ts:147` — расширить, не переписывать |
| `calculateFullMonthsRange()` | `referenceSync.ts:310` — превратить в wrapper |
| `updateSyncPeriodPlansDisplay` / `updateSyncPeriodPlans` | `DexieDiagnosticModal.ts:676, 689` — шаблон для 4 новых методов |
| Window-экспорты в `openDexieDiagnostic()` | `DexieDiagnosticModal.ts:717-732` — дополнить, не заменять |
| Инлайн `formatDate()` в `calculateFullMonthsRange` | `referenceSync.ts:325-330` — скопировать в новую функцию |

---

## Backward Compatibility

- Старый ключ `budget_dexie_sync_period_plans` **не удаляется**
- `getSyncPeriodPlansHistory/Future` читают из нового ключа, fallback на старый `plans`
- Миграция в `migrateSyncPeriodSettings()` запускается однократно (guard через `if (!localStorage.getItem(...))`)
- `calculateFullMonthsRange()` остаётся рабочей функцией (wrapper над новой)
- `syncPeriod.plans` в `DiagnosticData` сохраняется
- Существующие `updateSyncPeriodPlans*` методы и window-экспорты остаются (не удалять)

---

## Верификация

### Фаза 1
1. Открыть `/` → тройной клик на Dexie-индикатор
2. Таблица Stats, строка Plans: значение **в месяцах** (3), не в днях (90)
3. Подпись: **months**, не days
4. Слайдер Plans не застрял в крайнем правом положении (раньше получал 90 при max=6)

### Фаза 2
1. Диагностический модал: **3 слайдера** — Facts, Plans History, Plans Future
2. Установить History=2, Future=4 → DevTools Network → запрос `/api/v1/recurring-plans`:
   - `from_date=2025-12-01` (2 месяца назад от 2026-02-17)
   - `to_date=2026-06-30` (4 месяца вперёд)
3. Перезагрузить страницу — значения сохранились из localStorage
4. У пользователя с существующим `plans=3`: автоматически `plans_history=3, plans_future=3`

### Фаза 3
1. Открыть `/facts` → тройной клик на Dexie-индикатор → модал открывается ✅
2. Аналогично на `/analytics`, `/notifications`, `/security_settings`
3. DevTools Console: нет `[DEXIE_INDICATOR] openDexieDiagnostic not available on window`
4. На `/` и `/lists` — без регрессий, модал работает как прежде

### Сборка и типы
```bash
# TypeScript компиляция (проверить DiagnosticData, новые методы)
cd frontend && npx tsc --noEmit

# Сборка бандлов (включая новый dexieDiagnostic)
node build-all.js
```
