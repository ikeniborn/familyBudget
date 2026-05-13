# Graph Report - frontend/web/static/js/dashboard  (2026-05-13)

## Corpus Check
- Corpus is ~40,179 words - fits in a single context window. You may not need a graph.

## Summary
- 511 nodes · 1004 edges · 31 communities (23 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Modal Context & Periods|Modal Context & Periods]]
- [[_COMMUNITY_Pending Records|Pending Records]]
- [[_COMMUNITY_Plan Period Buttons|Plan Period Buttons]]
- [[_COMMUNITY_Caching Documentation|Caching Documentation]]
- [[_COMMUNITY_Offline Dashboard Rendering|Offline Dashboard Rendering]]
- [[_COMMUNITY_Save Transaction Offline|Save Transaction Offline]]
- [[_COMMUNITY_Dexie Aggregations|Dexie Aggregations]]
- [[_COMMUNITY_Edit Cache & Loaders|Edit Cache & Loaders]]
- [[_COMMUNITY_Plan & Fact Hints|Plan & Fact Hints]]
- [[_COMMUNITY_Dashboard State|Dashboard State]]
- [[_COMMUNITY_Reminders & Calendar|Reminders & Calendar]]
- [[_COMMUNITY_Cache & WebSocket Refresh|Cache & WebSocket Refresh]]
- [[_COMMUNITY_Global Types & Interfaces|Global Types & Interfaces]]
- [[_COMMUNITY_Tab Manager|Tab Manager]]
- [[_COMMUNITY_Date Helpers|Date Helpers]]
- [[_COMMUNITY_Recurring Settings|Recurring Settings]]
- [[_COMMUNITY_Category & Cost Center|Category & Cost Center]]
- [[_COMMUNITY_Plan Management|Plan Management]]
- [[_COMMUNITY_Collapsible Sections|Collapsible Sections]]
- [[_COMMUNITY_Module Initialization|Module Initialization]]
- [[_COMMUNITY_Window Exports & Index|Window Exports & Index]]
- [[_COMMUNITY_Analytics Types|Analytics Types]]
- [[_COMMUNITY_Base Model|Base Model]]
- [[_COMMUNITY_SQL Model|SQL Model]]
- [[_COMMUNITY_HTTP Middleware|HTTP Middleware]]
- [[_COMMUNITY_Exception Handling|Exception Handling]]
- [[_COMMUNITY_HTTP Response|HTTP Response]]
- [[_COMMUNITY_Base Settings|Base Settings]]
- [[_COMMUNITY_String Type|String Type]]
- [[_COMMUNITY_Enum Type|Enum Type]]

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
- `savePlan()` --calls--> `setButtonLoading()`  [INFERRED]
  frontend/web/static/js/dashboard/features/addPlan/planForm.ts → frontend/web/static/js/dashboard/shared/utils/buttonState.ts
- `savePlanOffline()` --calls--> `setButtonLoading()`  [INFERRED]
  frontend/web/static/js/dashboard/features/addPlan/planForm.ts → frontend/web/static/js/dashboard/shared/utils/buttonState.ts
- `saveTransaction()` --calls--> `setButtonLoading()`  [INFERRED]
  frontend/web/static/js/dashboard/features/addTransaction/transactionForm.ts → frontend/web/static/js/dashboard/shared/utils/buttonState.ts
- `saveTransactionOffline()` --calls--> `setButtonLoading()`  [INFERRED]
  frontend/web/static/js/dashboard/features/addTransaction/transactionForm.ts → frontend/web/static/js/dashboard/shared/utils/buttonState.ts
- `loadPendingRecords()` --calls--> `loadPendingRecordsImpl()`  [INFERRED]
  frontend/web/static/js/dashboard/adapters/windowExports.ts → frontend/web/static/js/dashboard/features/pendingRecords/syncOperations.ts

## Communities (31 total, 8 thin omitted)

### Community 0 - "Modal Context & Periods"
Cohesion: 0.07
Nodes (45): setupPlanPeriodButtons(), setupTransferPeriodButtons(), openContextModal(), PAGE_CONTEXT_MAP, CacheEntry, closeModalFact(), formatDateYYYYMMDD(), hideSkeleton() (+37 more)

### Community 2 - "Pending Records"
Cohesion: 0.09
Nodes (33): loadPendingRecords(), getPendingLock(), incrementPendingCallCount(), setPendingLock(), formatAmount(), generateFactPlanHTML(), generateHTMLAsync(), generateHTMLSync() (+25 more)

### Community 3 - "Plan Period Buttons"
Cohesion: 0.12
Nodes (24): syncHiddenFromActive(), syncPlanPeriodFromActive(), saveFactModal(), saveFactTransaction(), saveFactTransfer(), extractRecurringSettings(), extractReminderSettings(), savePlanModal() (+16 more)

### Community 4 - "Caching Documentation"
Cohesion: 0.07
Nodes (33): Backup Operations Documentation, Browser Testing Workarounds Documentation, Cache Busting via PLACEHOLDER, Cache Busting Documentation, Caching Strategy Documentation, CI/CD Build and Deploy Documentation, CI/CD Optimization Documentation, CI/CD Setup Documentation (+25 more)

### Community 5 - "Offline Dashboard Rendering"
Cohesion: 0.13
Nodes (12): buildRecentTransactionsHTML(), loadRecentTransactions(), RecentTransaction, buildAccountBalancesHTML(), buildQuickStatsHTML(), formatMoneyDesktop(), formatMoneyMobile(), isOfflineMode() (+4 more)

### Community 6 - "Save Transaction Offline"
Cohesion: 0.13
Nodes (19): saveTransaction(), saveTransactionOffline(), deleteFactFromDashboard(), deleteFromEditModal(), refreshDashboardWidgets(), showRecurringDeleteDialog(), closeEditModal(), getCurrentEditingPendingId() (+11 more)

### Community 7 - "Dexie Aggregations"
Cohesion: 0.14
Nodes (6): AggregationRow, BalanceRow, DashboardFactsManager, FactRow, factsManager, FinancialCenterRow

### Community 8 - "Edit Cache & Loaders"
Cohesion: 0.18
Nodes (20): setCacheData(), loadCategoriesForEdit(), loadEditCostCenters(), loadEditFinancialCenters(), loadRemindersForEdit(), populateCostCentersDropdown(), populateFinancialCentersDropdown(), populateOfflineDropdowns() (+12 more)

### Community 9 - "Plan & Fact Hints"
Cohesion: 0.11
Nodes (17): loadPlanHints(), updateState(), Article, CacheEntry, Category, EditFactData, EditPlanData, FactHintsData (+9 more)

### Community 10 - "Dashboard State"
Cohesion: 0.15
Nodes (12): createDefaultState(), DashboardState, getState(), resetState(), setEditCategoryTreeSelect(), setTransactionCategoryTreeSelect(), state, initializeStateFromGlobals() (+4 more)

### Community 11 - "Reminders & Calendar"
Cohesion: 0.25
Nodes (14): getCurrentTimeRounded(), initReminderCalendarWidget(), prefillReminderDateTime(), resetReminderFields(), togglePlanMode(), toggleReminderSettings(), updateReminderDatetime(), initializeRecurringDefaults() (+6 more)

### Community 12 - "Cache & WebSocket Refresh"
Cohesion: 0.19
Nodes (8): invalidateCache(), refreshAccountBalances(), refreshDashboard(), refreshDashboardWidgets(), refreshQuickStats(), refreshRecentTransactions(), BatchDeleteEventData, FactEventData

### Community 13 - "Global Types & Interfaces"
Cohesion: 0.12
Nodes (15): BudgetSharedNamespace, BudgetWSClient, CalendarWidgetOptions, CategoryTreeSelectOptions, DashboardExports, DateFormatterStatic, Htmx, HtmxAjaxOptions (+7 more)

### Community 14 - "Tab Manager"
Cohesion: 0.18
Nodes (10): tabManager, TRANSACTION_FIELDS, TRANSFER_FIELDS, tabManager, TRANSACTION_FIELDS, TRANSFER_FIELDS, createTabManager(), TabCache (+2 more)

### Community 15 - "Date Helpers"
Cohesion: 0.24
Nodes (5): setPlanPeriod(), setPlanTransferPeriod(), DateSetterConfig, setDateWithOffset(), updateButtonActiveState()

### Community 16 - "Recurring Settings"
Cohesion: 0.2
Nodes (8): DAY_NAMES, resetRecurringSettings(), updateDurationFields(), updateFrequencyFields(), updateRecurringPreview(), DurationType, FrequencyType, RecurringSettings

### Community 17 - "Category & Cost Center"
Cohesion: 0.29
Nodes (7): enableDisableCategoryAndCostCenter(), loadCostCenters(), loadFinancialCenters(), loadTransactionCategories(), safeShowToast(), setupFinancialCenterListeners(), CostCenter

### Community 18 - "Plan Management"
Cohesion: 0.27
Nodes (8): loadPlanCategories(), openAddPlanModal(), savePlan(), savePlanOffline(), isCacheValid(), setPlanCategoryTreeSelect(), PlanFormData, showModalWithSkeleton()

### Community 19 - "Collapsible Sections"
Cohesion: 0.33
Nodes (5): applyAccountBalancesState(), applyQuickStatsState(), handleHtmxAfterSwap(), toggleAccountBalances(), toggleQuickStats()

### Community 20 - "Module Initialization"
Cohesion: 0.4
Nodes (5): init(), initializeForms(), setupFormInitialization(), setupPendingRecordsListeners(), defineReactiveProperties()

### Community 21 - "Window Exports & Index"
Cohesion: 0.6
Nodes (4): dashboardExports, initWindowExports(), setInitialized(), initModule()

### Community 22 - "Analytics Types"
Cohesion: 0.5
Nodes (3): AccountBalance, QuickStats, RecentFact

## Knowledge Gaps
- **55 isolated node(s):** `FactEventData`, `BatchDeleteEventData`, `FactRow`, `AggregationRow`, `BalanceRow` (+50 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadRecentTransactions()` connect `Offline Dashboard Rendering` to `Transaction CRUD`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `getState()` connect `Dashboard State` to `Modal Context & Periods`, `Transaction CRUD`, `Pending Records`, `Save Transaction Offline`, `Edit Cache & Loaders`, `Plan & Fact Hints`, `Reminders & Calendar`, `Recurring Settings`, `Category & Cost Center`, `Plan Management`, `Collapsible Sections`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `FactEventData`, `BatchDeleteEventData`, `FactRow` to the rest of the system?**
  _55 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Modal Context & Periods` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Transaction CRUD` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Pending Records` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Plan Period Buttons` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._