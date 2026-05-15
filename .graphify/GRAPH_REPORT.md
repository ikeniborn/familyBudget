# Graph Report - .  (2026-05-15)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 621 nodes · 1179 edges · 33 communities (25 shown, 8 thin omitted)
- Extraction: 96% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Facts Manager Analytics|Facts Manager Analytics]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Pending Records & Sync|Pending Records & Sync]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Fact Transaction Tab & Category Widget|Fact Transaction Tab & Category Widget]]
- [[_COMMUNITY_Plan Reminder Settings|Plan Reminder Settings]]
- [[_COMMUNITY_FAB & Period Buttons|FAB & Period Buttons]]
- [[_COMMUNITY_Dashboard State & Edit Modal|Dashboard State & Edit Modal]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Cache Invalidation & WS Events|Cache Invalidation & WS Events]]
- [[_COMMUNITY_Docs & Concepts|Docs & Concepts]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_TypeScript Type Definitions|TypeScript Type Definitions]]
- [[_COMMUNITY_Plan Form & State Init|Plan Form & State Init]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Transaction Form Buttons|Transaction Form Buttons]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Misc|Misc]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Offline Dashboard & Recent Transactions|Offline Dashboard & Recent Transactions]]
- [[_COMMUNITY_Tab Manager|Tab Manager]]
- [[_COMMUNITY_Plan Type & Period Sync|Plan Type & Period Sync]]

## God Nodes (most connected - your core abstractions)
1. `getState()` - 21 edges
2. `DashboardFactsManager` - 20 edges
3. `loadFacts()` - 14 edges
4. `openModalPlan()` - 13 edges
5. `updateState()` - 13 edges
6. `openModalFact()` - 12 edges
7. `loadPendingRecords()` - 11 edges
8. `savePlanModal()` - 11 edges
9. `OfflineDashboardCoordinator` - 11 edges
10. `saveFactModal()` - 10 edges

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

## Communities (33 total, 8 thin omitted)

### Community 7 - "Facts Manager Analytics"
Cohesion: 0.13
Nodes (12): RecentTransaction, loadRecentTransactions(), buildRecentTransactionsHTML(), RecentTransaction, formatMoneyMobile(), formatMoneyDesktop(), moneySpan(), buildQuickStatsHTML() (+4 more)

### Community 23 - "Misc"
Cohesion: 0.6
Nodes (4): initModule(), dashboardExports, initWindowExports(), setInitialized()

### Community 22 - "Misc"
Cohesion: 0.4
Nodes (5): init(), setupPendingRecordsListeners(), setupFormInitialization(), initializeForms(), defineReactiveProperties()

### Community 4 - "Pending Records & Sync"
Cohesion: 0.09
Nodes (33): loadPendingRecords(), splitTransferToFacts(), handleTransferEditClick(), isLoadInProgress(), acquireLoadLock(), releaseLoadLock(), waitForExistingLock(), getNextCallId() (+25 more)

### Community 18 - "Misc"
Cohesion: 0.23
Nodes (8): showModalWithSkeleton(), openAddPlanModal(), loadPlanHints(), loadCostCenters(), isCacheValid(), Category, PlanFormData, PlanHintsData

### Community 13 - "Fact Transaction Tab & Category Widget"
Cohesion: 0.19
Nodes (8): refreshDashboard(), refreshRecentTransactions(), refreshQuickStats(), refreshAccountBalances(), refreshDashboardWidgets(), FactEventData, BatchDeleteEventData, invalidateCache()

### Community 8 - "Plan Reminder Settings"
Cohesion: 0.14
Nodes (6): FactRow, AggregationRow, BalanceRow, FinancialCenterRow, DashboardFactsManager, factsManager

### Community 0 - "FAB & Period Buttons"
Cohesion: 0.03
Nodes (82): CacheEntry, TransferHintsData, TransactionHintsData, isCacheValid(), showSkeleton(), hideSkeleton(), loadTransactionTabData(), setupTransactionFCListener() (+74 more)

### Community 3 - "Dashboard State & Edit Modal"
Cohesion: 0.11
Nodes (28): saveFactTransfer(), saveFactModal(), saveFactTransaction(), savePlan(), savePlanOffline(), syncHiddenFromActive(), syncPlanPeriodFromActive(), saveTransaction() (+20 more)

### Community 16 - "Misc"
Cohesion: 0.24
Nodes (5): setPlanPeriod(), setPlanTransferPeriod(), DateSetterConfig, setDateWithOffset(), updateButtonActiveState()

### Community 15 - "Misc"
Cohesion: 0.18
Nodes (10): TRANSACTION_FIELDS, TRANSFER_FIELDS, tabManager, TRANSACTION_FIELDS, TRANSFER_FIELDS, tabManager, TabCache, TabManagerConfig (+2 more)

### Community 12 - "Cache Invalidation & WS Events"
Cohesion: 0.12
Nodes (12): Article, FinancialCenter, CacheEntry, PendingRecordEntity, PendingRecordStatus, FactType, PendingRecordData, UnsyncedItemsResult (+4 more)

### Community 5 - "Docs & Concepts"
Cohesion: 0.12
Nodes (32): validateFactForm(), buildFactDataFromForm(), getDisplayNamesFromForm(), updatePendingRecord(), updateOnlineRecord(), updateReminder(), showRecurringDeleteDialog(), refreshDashboardWidgets() (+24 more)

### Community 19 - "Misc"
Cohesion: 0.21
Nodes (7): toggleEditReminderSettings(), initEditReminderCalendarWidget(), updateEditReminderDatetime(), populateEditReminderFields(), getState(), updateState(), FactHintsData

### Community 10 - "TypeScript Type Definitions"
Cohesion: 0.18
Nodes (13): loadPlanCategories(), initializeStateFromGlobals(), DashboardState, createDefaultState(), state, resetState(), setTransactionCategoryTreeSelect(), setPlanCategoryTreeSelect() (+5 more)

### Community 9 - "Plan Form & State Init"
Cohesion: 0.25
Nodes (14): getCurrentTimeRounded(), prefillReminderDateTime(), toggleReminderSettings(), initReminderCalendarWidget(), updateReminderDatetime(), resetReminderFields(), togglePlanMode(), togglePlanMode() (+6 more)

### Community 17 - "Misc"
Cohesion: 0.2
Nodes (8): DAY_NAMES, resetRecurringSettings(), updateFrequencyFields(), updateDurationFields(), updateRecurringPreview(), FrequencyType, DurationType, RecurringSettings

### Community 20 - "Misc"
Cohesion: 0.33
Nodes (6): safeShowToast(), loadTransactionCategories(), loadFinancialCenters(), setupFinancialCenterListeners(), enableDisableCategoryAndCostCenter(), CostCenter

### Community 21 - "Misc"
Cohesion: 0.33
Nodes (5): toggleQuickStats(), applyQuickStatsState(), toggleAccountBalances(), applyAccountBalancesState(), handleHtmxAfterSwap()

### Community 11 - "Transaction Form Buttons"
Cohesion: 0.12
Nodes (16): RecordType, CategoryTreeSelectOptions, CalendarWidgetOptions, OfflineManagerDB, NetworkDetector, OfflineManager, BudgetWSClient, DateFormatterStatic (+8 more)

### Community 24 - "Misc"
Cohesion: 0.5
Nodes (3): QuickStats, AccountBalance, RecentFact

### Community 6 - "Offline Dashboard & Recent Transactions"
Cohesion: 0.07
Nodes (33): Dexie Rollback Documentation, CI/CD Setup Documentation, Security Advisories Documentation, Backup Operations Documentation, Testing Phases Summary Documentation, Redis Alternatives Comparison Documentation, Disaster Recovery Documentation, CI/CD Build and Deploy Documentation (+25 more)

### Community 14 - "Tab Manager"
Cohesion: 0.15
Nodes (14): fact_date input field, setFactDate() window function, financial_center_id select (Счет), record_type radio (expense/income), fact_type hidden input (synced with record_type), article_id select (Категория, filtered by financial_center_id), cost_center_id select (Место затрат), fact-hints-container (План/Факт за месяц) (+6 more)

### Community 2 - "Plan Type & Period Sync"
Cohesion: 0.08
Nodes (48): debouncedReloadFacts(), matchesCurrentFilters(), fetchRowHtml(), parseRowHtml(), prependRowToTable(), replaceRowInTable(), animateAndRemoveRow(), adjustStatTotal() (+40 more)

## Knowledge Gaps
- **88 isolated node(s):** `FactEventData`, `BatchDeleteEventData`, `FactRow`, `AggregationRow`, `BalanceRow` (+83 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadRecentTransactions()` connect `Facts Manager Analytics` to `Modal Window Exports`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `getState()` connect `Misc` to `FAB & Period Buttons`, `Modal Window Exports`, `Pending Records & Sync`, `Docs & Concepts`, `Plan Form & State Init`, `TypeScript Type Definitions`, `Cache Invalidation & WS Events`, `Misc`, `Misc`, `Misc`, `Misc`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `FactEventData`, `BatchDeleteEventData`, `FactRow` to the rest of the system?**
  _88 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Facts Manager Analytics` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Modal Window Exports` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Pending Records & Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Plan Reminder Settings` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._