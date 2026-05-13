---
wiki_sources:
  - "frontend/web/static/js/dashboard/adapters/windowExports.ts"
  - "frontend/web/static/js/dashboard/core/DashboardState.ts"
  - "frontend/web/static/js/dashboard/core/stateManager.ts"
  - "frontend/web/static/js/dashboard/features/offlineDashboard.ts"
  - "frontend/web/static/js/dashboard/features/factsManager.ts"
wiki_updated: 2026-05-13
wiki_status: developing
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "Dashboard Module"
  - "Dashboard Frontend"
---

# Dashboard — TypeScript-модуль главной страницы

TypeScript-модуль для главной страницы приложения. Экспортирует все публичные функции через `window.Dashboard.*` для использования в HTML onclick. Организован по фичам (addTransaction, addPlan, editModal, modalFact и т.д.).

## Основные характеристики

**Расположение:** `frontend/web/static/js/dashboard/`
**Bundle:** `dashboard.bundle.js` (или аналог)

**Структура:**
```
core/
  DashboardState.ts   — getState(), isCacheValid()
  stateManager.ts     — defineReactiveProperties(), initializeStateFromGlobals()
features/
  addTransaction/     — loadTransactionCategories, loadFinancialCenters, loadCostCenters,
                        filterCostCenterDropdown, loadFactHints, saveTransaction,
                        saveTransactionOffline, setTransactionDate
  addPlan/            — loadPlanCategories, savePlan, savePlanOffline, loadPlanHints,
                        toggleReminderSettings, togglePlanMode, prefillReminderDateTime,
                        initReminderCalendarWidget, resetReminderFields, initRecurringFields,
                        updateFrequencyFields, updateDurationFields, updateRecurringPreview,
                        collectRecurringSettings
  editModal/          — openEditModal, openEditPendingRecord, closeEditModal, updateFact,
                        deleteFromEditModal, deleteFactFromDashboard, toggleEditReminderSettings,
                        handleRecurringDeleteChoice, setupEditCategoryTypeButtons
  pendingRecords/     — loadPendingRecords, deletePendingRecord, retryFailedItems,
                        deleteFailedRecords, handleTransferEditClick
  factsManager.ts     — Dexie-агрегации: loadRecentFacts, calculateQuickStats, loadAccountBalances
  offlineDashboard.ts — OfflineDashboardCoordinator (добавлен 2026-05-13)
  modalFact/          — tabbed modal для добавления транзакции/плана (v9.0+)
  modalPlan/          — отдельный modal для плана (legacy-совместимость)
adapters/
  windowExports.ts    — экспорт в window.Dashboard.* для HTML onclick
```

**window.Dashboard namespace** — все функции из features/ экспортируются через `window.Dashboard = { saveTransaction, savePlan, openEditModal, ... }`.

**Зависимости:**
- `@db/dexie` — `getDexieManager()`, `isDexieActive()`
- `@components/index` — `openDexieDiagnostic()`
- Глобалы: `debugLog()`, `showToast()`

## Offline поддержка

- `saveTransactionOffline()` — сохраняет факт через DexieManager при отсутствии сети
- `savePlanOffline()` — аналогично для планов
- `pendingRecords` — отображение и повторная отправка офлайн-записей

### OfflineDashboardCoordinator (2026-05-13)

`features/offlineDashboard.ts` — singleton `offlineDashboard`, инициализируется в `initModule()`.

**Два слоя инициализации:**
1. **Layer 1 (proactive)**: если `html.offline-mode` присутствует при `init()` → немедленный `renderAll()`
2. **Layer 2 (reactive)**: `htmx:beforeRequest` — отменяет запросы для `#quick-stats` / `#account-balances` через `event.detail.cancel = true` (не `preventDefault`)

**Реакция на события:**
- `offline-status-change` с `{online: false}` → `renderAll()` из Dexie
- `offline-status-change` с `{online: true}` → `clearAll()`, восстанавливает спиннеры, перезапускает HTMX

**Защита от гонки:** `this.rendering = true` устанавливается до `isDexieActive()` проверки — предотвращает двойной вызов.

**`isDexieActive() = false`:** показывает `📴 Данные недоступны`, без нулевых данных.

**HTML:** CSS совпадает с `analytics_rendering.py` (_get_quick_stats_css, _get_balances_css). Бейдж: `📴 Данные из локального хранилища`.

### factsManager — Dexie агрегации (2026-05-13)

`features/factsManager.ts` — singleton `factsManager`. Три публичных метода:

| Метод | Описание |
|-------|----------|
| `loadRecentFacts(limit)` | Факты за 90 дней, сортировка по `created_at` desc, фильтр `sync_status !== 'deleted'` |
| `calculateQuickStats()` | Сумма по типам статей (income/expense/credit/debit): today, month, monthPlan, planExecution% |
| `loadAccountBalances()` | Баланс по счетам: opening (до текущего месяца) + movement (текущий месяц) |

**Критично:** `queryFinancialCenters(userId, true)` — `includeGlobal=true` обязателен (семейный бюджет, BUG-001).

**Знак транзакции:** income/credit → +, expense/debit → −.

**Производительность:** использует `trackDexieCall()` (не `trackAPICall`).

## Связанные концепции

- [[реализация/frontend/dexie-manager.md]]
- [[реализация/frontend/budget-ws-client.md]]
- [[реализация/api/facts-endpoint.md]]
