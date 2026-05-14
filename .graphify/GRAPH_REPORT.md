# Graph Report - .  (2026-05-14)

## Corpus Check
- 579 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 579 nodes · 1130 edges · 33 communities (25 shown, 8 thin omitted)
- Extraction: 96% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]

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

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (45): setupPlanPeriodButtons(), setupTransferPeriodButtons(), openContextModal(), PAGE_CONTEXT_MAP, CacheEntry, closeModalFact(), formatDateYYYYMMDD(), hideSkeleton() (+37 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (48): adjustStatTotal(), animateAndRemoveRow(), debouncedReloadFacts(), fetchRowHtml(), handleArticleUpdated(), handleBatchDeleteCompleted(), handleFactCreated(), handleFactDeleted() (+40 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (28): syncHiddenFromActive(), syncPlanPeriodFromActive(), savePlan(), savePlanOffline(), saveTransaction(), saveTransactionOffline(), saveFactModal(), saveFactTransaction() (+20 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (33): loadPendingRecords(), getPendingLock(), incrementPendingCallCount(), setPendingLock(), formatAmount(), generateFactPlanHTML(), generateHTMLAsync(), generateHTMLSync() (+25 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (32): setCacheData(), deleteFactFromDashboard(), deleteFromEditModal(), refreshDashboardWidgets(), showRecurringDeleteDialog(), loadCategoriesForEdit(), loadEditCostCenters(), loadEditFinancialCenters() (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (33): Backup Operations Documentation, Browser Testing Workarounds Documentation, Cache Busting via PLACEHOLDER, Cache Busting Documentation, Caching Strategy Documentation, CI/CD Build and Deploy Documentation, CI/CD Optimization Documentation, CI/CD Setup Documentation (+25 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (12): buildRecentTransactionsHTML(), loadRecentTransactions(), RecentTransaction, buildAccountBalancesHTML(), buildQuickStatsHTML(), formatMoneyDesktop(), formatMoneyMobile(), isOfflineMode() (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (6): AggregationRow, BalanceRow, DashboardFactsManager, FactRow, factsManager, FinancialCenterRow

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (14): getCurrentTimeRounded(), initReminderCalendarWidget(), prefillReminderDateTime(), resetReminderFields(), togglePlanMode(), toggleReminderSettings(), updateReminderDatetime(), initializeRecurringDefaults() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (13): loadPlanCategories(), createDefaultState(), DashboardState, resetState(), setEditCategoryTreeSelect(), setPlanCategoryTreeSelect(), setTransactionCategoryTreeSelect(), state (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (16): RecordType, BudgetSharedNamespace, BudgetWSClient, CalendarWidgetOptions, CategoryTreeSelectOptions, DashboardExports, DateFormatterStatic, Htmx (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (12): Article, CacheEntry, EditFactData, EditPlanData, FactType, FinancialCenter, PendingRecordData, PendingRecordEntity (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.19
Nodes (8): invalidateCache(), refreshAccountBalances(), refreshDashboard(), refreshDashboardWidgets(), refreshQuickStats(), refreshRecentTransactions(), BatchDeleteEventData, FactEventData

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (14): categoryWidget.ts (syncFactTypeHidden), amount input (Сумма), article_id select (Категория, filtered by financial_center_id), cost_center_id select (Место затрат), description textarea (Описание/Комментарий), fact_date input field, fact-hints-container (План/Факт за месяц), fact_type hidden input (synced with record_type) (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (10): tabManager, TRANSACTION_FIELDS, TRANSFER_FIELDS, tabManager, TRANSACTION_FIELDS, TRANSFER_FIELDS, createTabManager(), TabCache (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.24
Nodes (5): setPlanPeriod(), setPlanTransferPeriod(), DateSetterConfig, setDateWithOffset(), updateButtonActiveState()

### Community 17 - "Community 17"
Cohesion: 0.2
Nodes (8): DAY_NAMES, resetRecurringSettings(), updateDurationFields(), updateFrequencyFields(), updateRecurringPreview(), DurationType, FrequencyType, RecurringSettings

### Community 18 - "Community 18"
Cohesion: 0.23
Nodes (8): openAddPlanModal(), loadPlanHints(), loadCostCenters(), isCacheValid(), Category, PlanFormData, PlanHintsData, showModalWithSkeleton()

### Community 19 - "Community 19"
Cohesion: 0.21
Nodes (7): getState(), updateState(), initEditReminderCalendarWidget(), populateEditReminderFields(), toggleEditReminderSettings(), updateEditReminderDatetime(), FactHintsData

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (6): enableDisableCategoryAndCostCenter(), loadFinancialCenters(), loadTransactionCategories(), safeShowToast(), setupFinancialCenterListeners(), CostCenter

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (5): applyAccountBalancesState(), applyQuickStatsState(), handleHtmxAfterSwap(), toggleAccountBalances(), toggleQuickStats()

### Community 22 - "Community 22"
Cohesion: 0.4
Nodes (5): init(), initializeForms(), setupFormInitialization(), setupPendingRecordsListeners(), defineReactiveProperties()

### Community 23 - "Community 23"
Cohesion: 0.6
Nodes (4): dashboardExports, initWindowExports(), setInitialized(), initModule()

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (3): AccountBalance, QuickStats, RecentFact

## Knowledge Gaps
- **69 isolated node(s):** `FactEventData`, `BatchDeleteEventData`, `FactRow`, `AggregationRow`, `BalanceRow` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadRecentTransactions()` connect `Community 7` to `Community 1`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `getState()` connect `Community 19` to `Community 0`, `Community 1`, `Community 4`, `Community 5`, `Community 9`, `Community 10`, `Community 12`, `Community 17`, `Community 18`, `Community 20`, `Community 21`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `FactEventData`, `BatchDeleteEventData`, `FactRow` to the rest of the system?**
  _69 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._