# Graph Report - frontend/web/static/js/plan  (2026-06-02)

## Corpus Check
- Corpus is ~22,438 words - fits in a single context window. You may not need a graph.

## Summary
- 239 nodes · 400 edges · 10 communities
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_syncAnalyticsToFilters(options)|syncAnalyticsToFilters(options?)]]
- [[_COMMUNITY_analytics.ts|analytics.ts]]
- [[_COMMUNITY_crud.ts|crud.ts]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_factsTable.ts|factsTable.ts]]
- [[_COMMUNITY_helpers.ts|helpers.ts]]
- [[_COMMUNITY_planModal.ts|planModal.ts]]
- [[_COMMUNITY_filters.ts|filters.ts]]
- [[_COMMUNITY_wsEventHandlers.ts|wsEventHandlers.ts]]
- [[_COMMUNITY_filterAnalyticsSync.ts|filterAnalyticsSync.ts]]

## God Nodes (most connected - your core abstractions)
1. `crud.ts` - 39 edges
2. `analytics.ts` - 34 edges
3. `helpers.ts` - 32 edges
4. `factsTable.ts` - 32 edges
5. `index.ts` - 31 edges
6. `filters.ts` - 20 edges
7. `planModal.ts` - 19 edges
8. `wsEventHandlers.ts` - 13 edges
9. `filterAnalyticsSync.ts` - 12 edges
10. `initialize()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `index_ts` --imports_from--> `helpers_ts`  [EXTRACTED]
   → 
- `index_ts` --imports_from--> `filters_ts`  [EXTRACTED]
   → 
- `index_ts` --imports_from--> `factstable_ts`  [EXTRACTED]
   → 
- `index_ts` --imports_from--> `analytics_ts`  [EXTRACTED]
   → 
- `index_ts` --imports_from--> `filteranalyticssync_ts`  [EXTRACTED]
   → 

## Communities (10 total, 0 thin omitted)

### Community 0 - "syncAnalyticsToFilters(options?)"
Cohesion: 0.09
Nodes (37): window.PlanApp, skipFiltersSync option, applyFiltersAndLoadData(), debouncedSyncFiltersToAnalytics(options?,delay?), fetchAndInjectPlanRow(planId, operation), initAnalyticsArticleChoices(articles, articleType), initialize(), loadAnalyticsArticleFilter(articleType?, allArticles?) (+29 more)

### Community 1 - "analytics.ts"
Cohesion: 0.13
Nodes (28): ARTICLE_TYPE_LABELS, buildCategoriesChartConfig(), buildComparisonChartConfig(), CategoryComparison, initAnalyticsMonthButtons(), initCategoriesChart(), initComparisonChart(), loadAnalyticsArticleFilter() (+20 more)

### Community 2 - "crud.ts"
Cohesion: 0.09
Nodes (24): batchDeleteFacts(), BudgetFact, closeEditModal(), createPlan(), deleteFact(), deleteFromEditModal(), deletingFactIds, getFrequencyDisplayText() (+16 more)

### Community 3 - "index.ts"
Cohesion: 0.11
Nodes (20): applyFilters(), handleClick(), resetFilters(), setupEventDelegation(), setupWindowExports(), applyFiltersAndLoadData(), autoInitialize(), ensureDexieReady() (+12 more)

### Community 4 - "factsTable.ts"
Cohesion: 0.14
Nodes (22): appendFactsToTable(), BudgetFact, buildFactsApiUrl(), clearSelection(), factsData, fetchAndInjectPlanRow(), fetchPlanRowHtml(), isPage1NoExtraFilters() (+14 more)

### Community 5 - "helpers.ts"
Cohesion: 0.09
Nodes (18): AnalyticsFilters, APIListResponse, Article, ArticleNode, BudgetFact, CostCenter, createToastElement(), extractMessageText() (+10 more)

### Community 6 - "planModal.ts"
Cohesion: 0.12
Nodes (14): batchDeleteRecurringPlans(), showConfirmDialogWithCheckbox(), showEditModal(), updateEditCategoryTypeBadge(), getReminderStatusBadge(), allCostCenters, initEditReminderCalendarWidget(), loadRecurringPlans() (+6 more)

### Community 7 - "filters.ts"
Cohesion: 0.16
Nodes (11): applyFilters(), countActiveFilters(), DEFAULT_DATE_FROM, DEFAULT_DATE_TO, filters, PlanFilters, readFiltersFromUI(), resetFilters() (+3 more)

### Community 8 - "wsEventHandlers.ts"
Cohesion: 0.3
Nodes (10): debouncedReloadFacts(), handleFactsBatchDeleted(), handlePlanCreated(), handlePlanDeleted(), handlePlanUpdated(), handleRecurringPlanChanged(), handleTransferCreated(), registerWSHandlers() (+2 more)

### Community 9 - "filterAnalyticsSync.ts"
Cohesion: 0.38
Nodes (5): dateRangeToMonth(), monthToDateRange(), syncAnalyticsToFilters(), syncFiltersToAnalytics(), SyncOptions

## Knowledge Gaps
- **42 isolated node(s):** `Logger`, `log`, `PlanAppGlobal`, `Window`, `planApp` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components.