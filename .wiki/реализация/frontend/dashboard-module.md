---
wiki_sources:
  - "frontend/web/static/js/dashboard/adapters/windowExports.ts"
  - "frontend/web/static/js/dashboard/core/DashboardState.ts"
  - "frontend/web/static/js/dashboard/core/stateManager.ts"
wiki_updated: 2026-05-06
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
  factsManager.ts     — управление списком фактов
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

## Связанные концепции

- [[реализация/frontend/dexie-manager.md]]
- [[реализация/frontend/budget-ws-client.md]]
- [[реализация/api/facts-endpoint.md]]
