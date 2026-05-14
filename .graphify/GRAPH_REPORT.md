# Graph Report - .  (2026-05-14)

## Corpus Check
- Corpus is ~1,909 words - fits in a single context window. You may not need a graph.

## Summary
- 526 nodes · 1020 edges · 32 communities (24 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_FAB & Period Buttons|FAB & Period Buttons]]
- [[_COMMUNITY_Plan Type & Period Sync|Plan Type & Period Sync]]
- [[_COMMUNITY_Dashboard State & Edit Modal|Dashboard State & Edit Modal]]
- [[_COMMUNITY_Pending Records & Sync|Pending Records & Sync]]
- [[_COMMUNITY_Docs & Concepts|Docs & Concepts]]
- [[_COMMUNITY_Offline Dashboard & Recent Transactions|Offline Dashboard & Recent Transactions]]
- [[_COMMUNITY_Facts Manager Analytics|Facts Manager Analytics]]
- [[_COMMUNITY_Plan Reminder Settings|Plan Reminder Settings]]
- [[_COMMUNITY_Plan Form & State Init|Plan Form & State Init]]
- [[_COMMUNITY_TypeScript Type Definitions|TypeScript Type Definitions]]
- [[_COMMUNITY_Transaction Form Buttons|Transaction Form Buttons]]
- [[_COMMUNITY_Cache Invalidation & WS Events|Cache Invalidation & WS Events]]
- [[_COMMUNITY_Fact Transaction Tab & Category Widget|Fact Transaction Tab & Category Widget]]
- [[_COMMUNITY_Tab Manager|Tab Manager]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]

## God Nodes (most connected - your core abstractions)
1. `getState()` - 21 edges
2. `DashboardFactsManager` - 20 edges
3. `openModalPlan()` - 13 edges
4. `updateState()` - 13 edges
5. `openModalFact()` - 12 edges
6. `loadPendingRecords()` - 11 edges
7. `savePlanModal()` - 11 edges
8. `OfflineDashboardCoordinator` - 11 edges
9. `saveFactModal()` - 10 edges
10. `updateFact()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `loadPendingRecords()` --calls--> `loadPendingRecordsImpl()`  [INFERRED]
  frontend/web/static/js/dashboard/adapters/windowExports.ts → frontend/web/static/js/dashboard/features/pendingRecords/syncOperations.ts
- `loadTransactionTabData()` --calls--> `enableDisableCategoryAndCostCenter()`  [INFERRED]
  frontend/web/static/js/dashboard/features/modalFact/index.ts → frontend/web/static/js/dashboard/features/addTransaction/categoryLoader.ts
- `savePlan()` --calls--> `setButtonLoading()`  [INFERRED]
  frontend/web/static/js/dashboard/features/addPlan/planForm.ts → frontend/web/static/js/dashboard/shared/utils/buttonState.ts
- `savePlanOffline()` --calls--> `setButtonLoading()`  [INFERRED]
  frontend/web/static/js/dashboard/features/addPlan/planForm.ts → frontend/web/static/js/dashboard/shared/utils/buttonState.ts
- `saveTransaction()` --calls--> `setButtonLoading()`  [INFERRED]
  frontend/web/static/js/dashboard/features/addTransaction/transactionForm.ts → frontend/web/static/js/dashboard/shared/utils/buttonState.ts

## Communities (32 total, 8 thin omitted)

### Community 0 - "FAB & Period Buttons"
Cohesion: 0.07
Nodes (45): setupPlanPeriodButtons(), setupTransferPeriodButtons(), openContextModal(), PAGE_CONTEXT_MAP, CacheEntry, closeModalFact(), formatDateYYYYMMDD(), hideSkeleton() (+37 more)

### Community 2 - "Plan Type & Period Sync"
Cohesion: 0.11
Nodes (28): syncHiddenFromActive(), syncPlanPeriodFromActive(), savePlan(), savePlanOffline(), saveTransaction(), saveTransactionOffline(), saveFactModal(), saveFactTransaction() (+20 more)

### Community 3 - "Dashboard State & Edit Modal"
Cohesion: 0.1
Nodes (36): setCacheData(), deleteFactFromDashboard(), deleteFromEditModal(), refreshDashboardWidgets(), showRecurringDeleteDialog(), loadCategoriesForEdit(), loadEditCostCenters(), loadEditFinancialCenters() (+28 more)

### Community 4 - "Pending Records & Sync"
Cohesion: 0.09
Nodes (33): loadPendingRecords(), getPendingLock(), incrementPendingCallCount(), setPendingLock(), formatAmount(), generateFactPlanHTML(), generateHTMLAsync(), generateHTMLSync() (+25 more)

### Community 5 - "Docs & Concepts"
Cohesion: 0.07
Nodes (33): Backup Operations Documentation, Browser Testing Workarounds Documentation, Cache Busting via PLACEHOLDER, Cache Busting Documentation, Caching Strategy Documentation, CI/CD Build and Deploy Documentation, CI/CD Optimization Documentation, CI/CD Setup Documentation (+25 more)

### Community 6 - "Offline Dashboard & Recent Transactions"
Cohesion: 0.13
Nodes (12): buildRecentTransactionsHTML(), loadRecentTransactions(), RecentTransaction, buildAccountBalancesHTML(), buildQuickStatsHTML(), formatMoneyDesktop(), formatMoneyMobile(), isOfflineMode() (+4 more)

### Community 7 - "Facts Manager Analytics"
Cohesion: 0.14
Nodes (6): AggregationRow, BalanceRow, DashboardFactsManager, FactRow, factsManager, FinancialCenterRow

### Community 8 - "Plan Reminder Settings"
Cohesion: 0.25
Nodes (14): getCurrentTimeRounded(), initReminderCalendarWidget(), prefillReminderDateTime(), resetReminderFields(), togglePlanMode(), toggleReminderSettings(), updateReminderDatetime(), initializeRecurringDefaults() (+6 more)

### Community 9 - "Plan Form & State Init"
Cohesion: 0.18
Nodes (13): loadPlanCategories(), createDefaultState(), DashboardState, resetState(), setEditCategoryTreeSelect(), setPlanCategoryTreeSelect(), setTransactionCategoryTreeSelect(), state (+5 more)

### Community 10 - "TypeScript Type Definitions"
Cohesion: 0.12
Nodes (16): UnsyncedItemsResult, BudgetSharedNamespace, BudgetWSClient, CalendarWidgetOptions, CategoryTreeSelectOptions, DashboardExports, DateFormatterStatic, Htmx (+8 more)

### Community 11 - "Transaction Form Buttons"
Cohesion: 0.12
Nodes (12): Article, CacheEntry, EditFactData, EditPlanData, FactType, FinancialCenter, PendingRecordData, PendingRecordEntity (+4 more)

### Community 12 - "Cache Invalidation & WS Events"
Cohesion: 0.19
Nodes (8): invalidateCache(), refreshAccountBalances(), refreshDashboard(), refreshDashboardWidgets(), refreshQuickStats(), refreshRecentTransactions(), BatchDeleteEventData, FactEventData

### Community 13 - "Fact Transaction Tab & Category Widget"
Cohesion: 0.15
Nodes (14): categoryWidget.ts (syncFactTypeHidden), amount input (Сумма), article_id select (Категория, filtered by financial_center_id), cost_center_id select (Место затрат), description textarea (Описание/Комментарий), fact_date input field, fact-hints-container (План/Факт за месяц), fact_type hidden input (synced with record_type) (+6 more)

### Community 14 - "Tab Manager"
Cohesion: 0.18
Nodes (10): tabManager, TRANSACTION_FIELDS, TRANSFER_FIELDS, tabManager, TRANSACTION_FIELDS, TRANSFER_FIELDS, createTabManager(), TabCache (+2 more)

### Community 15 - "Misc"
Cohesion: 0.24
Nodes (5): setPlanPeriod(), setPlanTransferPeriod(), DateSetterConfig, setDateWithOffset(), updateButtonActiveState()

### Community 16 - "Misc"
Cohesion: 0.2
Nodes (8): DAY_NAMES, resetRecurringSettings(), updateDurationFields(), updateFrequencyFields(), updateRecurringPreview(), DurationType, FrequencyType, RecurringSettings

### Community 17 - "Misc"
Cohesion: 0.25
Nodes (7): openAddPlanModal(), loadPlanHints(), isCacheValid(), Category, PlanFormData, PlanHintsData, showModalWithSkeleton()

### Community 18 - "Misc"
Cohesion: 0.29
Nodes (7): enableDisableCategoryAndCostCenter(), loadCostCenters(), loadFinancialCenters(), loadTransactionCategories(), safeShowToast(), setupFinancialCenterListeners(), CostCenter

### Community 19 - "Misc"
Cohesion: 0.33
Nodes (5): applyAccountBalancesState(), applyQuickStatsState(), handleHtmxAfterSwap(), toggleAccountBalances(), toggleQuickStats()

### Community 20 - "Misc"
Cohesion: 0.22
Nodes (3): getState(), updateState(), FactHintsData

### Community 21 - "Misc"
Cohesion: 0.6
Nodes (4): dashboardExports, initWindowExports(), setInitialized(), initModule()

### Community 22 - "Misc"
Cohesion: 0.4
Nodes (5): init(), initializeForms(), setupFormInitialization(), setupPendingRecordsListeners(), defineReactiveProperties()

### Community 23 - "Misc"
Cohesion: 0.5
Nodes (3): AccountBalance, QuickStats, RecentFact

## Knowledge Gaps
- **64 isolated node(s):** `FactEventData`, `BatchDeleteEventData`, `FactRow`, `AggregationRow`, `BalanceRow` (+59 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadRecentTransactions()` connect `Offline Dashboard & Recent Transactions` to `Modal Window Exports`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Why does `getState()` connect `Misc` to `FAB & Period Buttons`, `Modal Window Exports`, `Dashboard State & Edit Modal`, `Pending Records & Sync`, `Plan Reminder Settings`, `Plan Form & State Init`, `Transaction Form Buttons`, `Misc`, `Misc`, `Misc`, `Misc`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **What connects `FactEventData`, `BatchDeleteEventData`, `FactRow` to the rest of the system?**
  _64 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FAB & Period Buttons` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Modal Window Exports` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Plan Type & Period Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Dashboard State & Edit Modal` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._