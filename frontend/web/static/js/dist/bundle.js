(function(pglite) {
  "use strict";
  let state$1 = {
    currentListId: null,
    currentView: "table",
    shoppingLists: [],
    currentItems: [],
    stores: [],
    productGroups: [],
    selectedItemIds: /* @__PURE__ */ new Set(),
    searchQuery: "",
    hideCompleted: false,
    currentSuggestions: [],
    currentDuplicateItem: null,
    choicesInstances: {},
    hierarchyView: null,
    db: null,
    offlineShopping: null,
    debouncedSearch: null,
    quantityChangeHandler: null,
    handleUnitChange: null,
    autocompleteTimer: null
  };
  const getState$1 = () => state$1;
  const updateState$1 = (updates) => {
    state$1 = { ...state$1, ...updates };
  };
  const resetState$1 = () => {
    state$1 = {
      currentListId: null,
      currentView: "table",
      shoppingLists: [],
      currentItems: [],
      stores: [],
      productGroups: [],
      selectedItemIds: /* @__PURE__ */ new Set(),
      searchQuery: "",
      hideCompleted: false,
      currentSuggestions: [],
      currentDuplicateItem: null,
      choicesInstances: {},
      hierarchyView: null,
      db: null,
      offlineShopping: null,
      debouncedSearch: null,
      quantityChangeHandler: null,
      handleUnitChange: null,
      autocompleteTimer: null
    };
  };
  const ListsState = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    getState: getState$1,
    resetState: resetState$1,
    updateState: updateState$1
  });
  class PerformanceMonitor {
    constructor() {
      this.apiMetrics = /* @__PURE__ */ new Map();
      this.pgliteMetrics = /* @__PURE__ */ new Map();
    }
    /**
     * Track an API call
     *
     * @param method - Method name (e.g., 'getArticles')
     * @param durationMs - Call duration in milliseconds
     */
    trackAPICall(method, durationMs) {
      if (!this.apiMetrics.has(method)) {
        this.apiMetrics.set(method, []);
      }
      this.apiMetrics.get(method).push(durationMs);
    }
    /**
     * Track a PGlite call
     *
     * @param method - Method name (e.g., 'getArticles')
     * @param durationMs - Call duration in milliseconds
     */
    trackPGliteCall(method, durationMs) {
      if (!this.pgliteMetrics.has(method)) {
        this.pgliteMetrics.set(method, []);
      }
      this.pgliteMetrics.get(method).push(durationMs);
    }
    /**
     * Calculate metrics for a set of durations
     *
     * @param durations - Array of call durations in milliseconds
     * @returns Call metrics
     */
    calculateMetric(durations) {
      if (durations.length === 0) {
        return {
          count: 0,
          totalDurationMs: 0,
          avgDurationMs: 0,
          minDurationMs: 0,
          maxDurationMs: 0
        };
      }
      const total = durations.reduce((a, b) => a + b, 0);
      return {
        count: durations.length,
        totalDurationMs: total,
        avgDurationMs: total / durations.length,
        minDurationMs: Math.min(...durations),
        maxDurationMs: Math.max(...durations)
      };
    }
    /**
     * Get overall performance statistics
     *
     * @returns Performance statistics comparing API and PGlite
     */
    getStats() {
      const allApiDurations = Array.from(this.apiMetrics.values()).flat();
      const allPgliteDurations = Array.from(this.pgliteMetrics.values()).flat();
      const api = this.calculateMetric(allApiDurations);
      const pglite2 = this.calculateMetric(allPgliteDurations);
      const totalCalls = api.count + pglite2.count;
      const reductionPercent = totalCalls > 0 ? (1 - api.count / totalCalls) * 100 : 0;
      const speedupFactor = api.avgDurationMs > 0 && pglite2.avgDurationMs > 0 ? api.avgDurationMs / pglite2.avgDurationMs : 1;
      return {
        api,
        pglite: pglite2,
        reductionPercent: parseFloat(reductionPercent.toFixed(1)),
        speedupFactor: parseFloat(speedupFactor.toFixed(1))
      };
    }
    /**
     * Classify method by module
     * (task-015 Phase 5)
     *
     * @param method - Method name
     * @returns Module name
     */
    classifyMethod(method) {
      const lower = method.toLowerCase();
      if (lower.includes("shopping") || lower.includes("store") || lower.includes("productgroup")) {
        return "shoppingLists";
      }
      if (lower.includes("fact") || lower.includes("transfer")) {
        return "facts";
      }
      if (lower.includes("recurring") || lower.includes("plan")) {
        return "recurringPlans";
      }
      if (lower.includes("dashboard") || lower.includes("quickstat") || lower.includes("balance")) {
        return "dashboard";
      }
      return "other";
    }
    /**
     * Get detailed statistics with module breakdown
     * (task-015 Phase 5)
     *
     * @returns Detailed performance statistics
     */
    getDetailedStats() {
      const basicStats = this.getStats();
      const breakdown = {
        shoppingLists: { pglite: 0, api: 0, reductionPercent: 0 },
        facts: { pglite: 0, api: 0, reductionPercent: 0 },
        recurringPlans: { pglite: 0, api: 0, reductionPercent: 0 },
        dashboard: { pglite: 0, api: 0, reductionPercent: 0 },
        other: { pglite: 0, api: 0, reductionPercent: 0 }
      };
      const allMethods = /* @__PURE__ */ new Set([...this.apiMetrics.keys(), ...this.pgliteMetrics.keys()]);
      for (const method of allMethods) {
        const module = this.classifyMethod(method);
        breakdown[module].pglite += (this.pgliteMetrics.get(method) || []).length;
        breakdown[module].api += (this.apiMetrics.get(method) || []).length;
      }
      for (const module of Object.keys(breakdown)) {
        const { pglite: pglite2, api } = breakdown[module];
        const total = pglite2 + api;
        breakdown[module].reductionPercent = total > 0 ? parseFloat(((1 - api / total) * 100).toFixed(1)) : 0;
      }
      const BYTES_PER_API_CALL = 5 * 1024;
      const apiCallsReduced = basicStats.pglite.count;
      const totalBandwidthSaved = parseFloat((apiCallsReduced * BYTES_PER_API_CALL / 1024).toFixed(1));
      return {
        ...basicStats,
        breakdown,
        apiCallsReduced,
        totalBandwidthSaved,
        avgSpeedupFactor: basicStats.speedupFactor
      };
    }
    /**
     * Get per-method statistics
     *
     * @returns Per-method statistics
     */
    getMethodStats() {
      const methods = /* @__PURE__ */ new Set([...this.apiMetrics.keys(), ...this.pgliteMetrics.keys()]);
      const result = {};
      for (const method of methods) {
        result[method] = {
          api: this.calculateMetric(this.apiMetrics.get(method) || []),
          pglite: this.calculateMetric(this.pgliteMetrics.get(method) || [])
        };
      }
      return result;
    }
    /**
     * Reset all metrics
     */
    reset() {
      this.apiMetrics.clear();
      this.pgliteMetrics.clear();
    }
  }
  const performanceMonitor = new PerformanceMonitor();
  if (typeof window !== "undefined") {
    window.performanceMonitor = performanceMonitor;
  }
  class DashboardFactsManager {
    /**
     * Safely parse numeric value from PGlite query result
     * @param value - Number or string from query result
     * @returns Parsed float number
     */
    parseNumeric(value) {
      return typeof value === "number" ? value : parseFloat(value);
    }
    /**
     * Get start of current month (cached for performance)
     * @returns Date object set to first day of current month
     */
    getMonthStart() {
      const monthStart = /* @__PURE__ */ new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      return monthStart;
    }
    /**
     * Load recent facts (last N transactions)
     * Backend equivalent: /api/v1/facts/recent-html
     * Query: SELECT * FROM local_budget_facts WHERE fact_date >= today-90
     *        ORDER BY created_at DESC LIMIT {limit}
     */
    async loadRecentFacts(limit = 10) {
      const startTime = performance.now();
      const { db } = pglite.getState();
      if (pglite.isPGliteEnabled() && db) {
        try {
          const cutoffDate = /* @__PURE__ */ new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 90);
          const result = await db.query(
            `
          SELECT
            f.id,
            f.temp_id,
            f.user_id,
            f.article_id,
            a.name as article_name,
            a.type as article_type,
            f.financial_center_id,
            fc.name as financial_center_name,
            f.cost_center_id,
            cc.name as cost_center_name,
            f.date as fact_date,
            f.amount,
            f.record_type,
            f.comment,
            f.transfer_group_id,
            f.is_transfer,
            f.sync_status,
            f.created_at,
            f.updated_at
          FROM local_budget_facts f
          LEFT JOIN local_articles a ON f.article_id = a.id
          LEFT JOIN local_financial_centers fc ON f.financial_center_id = fc.id
          LEFT JOIN local_cost_centers cc ON f.cost_center_id = cc.id
          WHERE f.sync_status != 'deleted'
            AND f.date >= $1
          ORDER BY f.created_at DESC
          LIMIT $2
        `,
            [cutoffDate.toISOString().split("T")[0], limit]
          );
          const duration2 = performance.now() - startTime;
          performanceMonitor.trackPGliteCall("loadRecentFacts", duration2);
          debugLog(`[DASHBOARD] Recent facts from PGlite: ${duration2.toFixed(1)}ms`);
          return this.mapRecentFacts(result.rows);
        } catch (err) {
          console.error("[DASHBOARD] PGlite failed, fallback to API:", err);
        }
      }
      const facts = await this.fetchRecentFactsFromAPI(limit);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall("loadRecentFacts", duration);
      return facts;
    }
    /**
     * Calculate quick statistics (today + month aggregations)
     * Backend equivalent: /api/v1/analytics/quick-stats-html
     * Queries: 3 GROUP BY article.type queries (today_facts, month_facts, month_plans)
     */
    async calculateQuickStats() {
      const startTime = performance.now();
      const { db } = pglite.getState();
      if (pglite.isPGliteEnabled() && db) {
        try {
          const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          const monthStart = this.getMonthStart();
          const monthStartStr = monthStart.toISOString().split("T")[0];
          const todayResult = await db.query(
            `
          SELECT
            a.type,
            SUM(f.amount) as total
          FROM local_budget_facts f
          JOIN local_articles a ON f.article_id = a.id
          WHERE f.date = $1
            AND f.record_type = 'fact'
            AND f.sync_status != 'deleted'
          GROUP BY a.type
        `,
            [today]
          );
          const monthResult = await db.query(
            `
          SELECT
            a.type,
            SUM(f.amount) as total
          FROM local_budget_facts f
          JOIN local_articles a ON f.article_id = a.id
          WHERE f.date >= $1
            AND f.date <= $2
            AND f.record_type = 'fact'
            AND f.sync_status != 'deleted'
          GROUP BY a.type
        `,
            [monthStartStr, today]
          );
          const lastDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
          const monthEndStr = lastDayOfMonth.toISOString().split("T")[0];
          const monthPlanResult = await db.query(
            `
          SELECT
            a.type,
            SUM(f.amount) as total
          FROM local_budget_facts f
          JOIN local_articles a ON f.article_id = a.id
          WHERE f.date >= $1
            AND f.date <= $2
            AND f.record_type = 'plan'
            AND f.sync_status != 'deleted'
          GROUP BY a.type
        `,
            [monthStartStr, monthEndStr]
          );
          const duration2 = performance.now() - startTime;
          performanceMonitor.trackPGliteCall("calculateQuickStats", duration2);
          debugLog(`[DASHBOARD] Quick stats from PGlite: ${duration2.toFixed(1)}ms`);
          return this.mapQuickStats(todayResult.rows, monthResult.rows, monthPlanResult.rows);
        } catch (err) {
          console.error("[DASHBOARD] PGlite failed, fallback to API:", err);
        }
      }
      const stats = await this.fetchQuickStatsFromAPI();
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall("calculateQuickStats", duration);
      return stats;
    }
    /**
     * Load account balances (opening + current)
     * Backend equivalent: /api/v1/analytics/account-balances-html
     * Logic: opening (before month) + movement (month to today) = current
     */
    async loadAccountBalances() {
      const startTime = performance.now();
      const { db } = pglite.getState();
      if (pglite.isPGliteEnabled() && db) {
        try {
          const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          const monthStart = this.getMonthStart();
          const monthStartStr = monthStart.toISOString().split("T")[0];
          const openingResult = await db.query(
            `
          SELECT
            f.financial_center_id as fc_id,
            SUM(
              CASE
                WHEN a.type IN ('income', 'credit') THEN f.amount
                WHEN a.type IN ('expense', 'debit') THEN -f.amount
                ELSE 0
              END
            ) as balance
          FROM local_budget_facts f
          JOIN local_articles a ON f.article_id = a.id
          WHERE f.date < $1
            AND f.sync_status != 'deleted'
            AND f.record_type = 'fact'
            AND f.financial_center_id IS NOT NULL
          GROUP BY f.financial_center_id
        `,
            [monthStartStr]
          );
          const movementResult = await db.query(
            `
          SELECT
            f.financial_center_id as fc_id,
            SUM(
              CASE
                WHEN a.type IN ('income', 'credit') THEN f.amount
                WHEN a.type IN ('expense', 'debit') THEN -f.amount
                ELSE 0
              END
            ) as balance
          FROM local_budget_facts f
          JOIN local_articles a ON f.article_id = a.id
          WHERE f.date >= $1
            AND f.date <= $2
            AND f.sync_status != 'deleted'
            AND f.record_type = 'fact'
            AND f.financial_center_id IS NOT NULL
          GROUP BY f.financial_center_id
        `,
            [monthStartStr, today]
          );
          const fcsResult = await db.query(`
          SELECT id, name, type, currency
          FROM local_financial_centers
          WHERE is_active = true
          ORDER BY name
        `);
          const duration2 = performance.now() - startTime;
          performanceMonitor.trackPGliteCall("loadAccountBalances", duration2);
          debugLog(`[DASHBOARD] Account balances from PGlite: ${duration2.toFixed(1)}ms`);
          return this.mapAccountBalances(fcsResult.rows, openingResult.rows, movementResult.rows);
        } catch (err) {
          console.error("[DASHBOARD] PGlite failed, fallback to API:", err);
        }
      }
      const balances = await this.fetchAccountBalancesFromAPI();
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall("loadAccountBalances", duration);
      return balances;
    }
    /**
     * Initialize dashboard (parallel query execution)
     * Replaces 3 separate HTMX API calls with single parallel PGlite call
     */
    async initDashboard() {
      const startTime = performance.now();
      const [recentFacts, quickStats, accountBalances] = await Promise.all([
        this.loadRecentFacts(10),
        this.calculateQuickStats(),
        this.loadAccountBalances()
      ]);
      const duration = performance.now() - startTime;
      debugLog(`[DASHBOARD] Total load time: ${duration.toFixed(1)}ms`);
      const stats = performanceMonitor.getStats();
      debugLog("[DASHBOARD] Performance:", stats);
      return { recentFacts, quickStats, accountBalances };
    }
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    /**
     * Map PGlite query results to RecentFact objects
     * @param rows - Raw query results from local_budget_facts
     * @returns Array of typed RecentFact objects
     */
    mapRecentFacts(rows) {
      return rows.map((row) => ({
        id: row.id,
        tempId: row.temp_id,
        userId: row.user_id,
        articleId: row.article_id,
        articleName: row.article_name,
        articleType: row.article_type,
        financialCenterId: row.financial_center_id,
        financialCenterName: row.financial_center_name,
        costCenterId: row.cost_center_id,
        costCenterName: row.cost_center_name,
        factDate: row.fact_date,
        amount: this.parseNumeric(row.amount),
        recordType: row.record_type,
        comment: row.comment,
        transferGroupId: row.transfer_group_id,
        isTransfer: row.is_transfer,
        syncStatus: row.sync_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }
    /**
     * Map aggregation results to QuickStats object
     * @param todayRows - Today's aggregations by article type
     * @param monthRows - Current month's aggregations by article type
     * @param monthPlanRows - Current month's plan aggregations by article type
     * @returns QuickStats object with calculated plan execution percentages
     */
    mapQuickStats(todayRows, monthRows, monthPlanRows) {
      const today = this.aggregateByType(todayRows);
      const month = this.aggregateByType(monthRows);
      const monthPlan = this.aggregateByType(monthPlanRows);
      return {
        today,
        month,
        monthPlan,
        planExecution: {
          incomePct: monthPlan.income > 0 && month.income >= 0 ? month.income / monthPlan.income * 100 : 0,
          expensePct: monthPlan.expense > 0 && month.expense >= 0 ? month.expense / monthPlan.expense * 100 : 0,
          creditPct: monthPlan.credit > 0 && month.credit >= 0 ? month.credit / monthPlan.credit * 100 : 0,
          debitPct: monthPlan.debit > 0 && month.debit >= 0 ? month.debit / monthPlan.debit * 100 : 0
        }
      };
    }
    /**
     * Aggregate query results by article type
     * @param rows - Query results with type and total columns
     * @returns Object with income, expense, credit, debit totals
     */
    aggregateByType(rows) {
      const result = { income: 0, expense: 0, credit: 0, debit: 0 };
      for (const row of rows) {
        if (row.type in result) {
          result[row.type] = this.parseNumeric(row.total);
        }
      }
      return result;
    }
    /**
     * Calculate account balances from opening and movement data
     * @param fcs - Financial centers list
     * @param openingRows - Opening balances (before current month)
     * @param movementRows - Month movements (current month to today)
     * @returns Array of account balances with opening/current/movement
     */
    mapAccountBalances(fcs, openingRows, movementRows) {
      const opening = new Map(openingRows.map((r) => [r.fc_id, this.parseNumeric(r.balance)]));
      const movement = new Map(movementRows.map((r) => [r.fc_id, this.parseNumeric(r.balance)]));
      return fcs.map((fc) => {
        const openingBalance = opening.get(fc.id) || 0;
        const monthMovement = movement.get(fc.id) || 0;
        const currentBalance = openingBalance + monthMovement;
        return {
          id: fc.id,
          name: fc.name,
          type: fc.type,
          currency: fc.currency,
          openingBalance,
          currentBalance,
          monthMovement: Math.abs(monthMovement),
          isNegative: currentBalance < 0
        };
      });
    }
    // ============================================================================
    // API Fallback Methods (TODO: Implement)
    // ============================================================================
    async fetchRecentFactsFromAPI(_limit) {
      debugLog("[DASHBOARD] API fallback not implemented for recent facts");
      return [];
    }
    async fetchQuickStatsFromAPI() {
      debugLog("[DASHBOARD] API fallback not implemented for quick stats");
      return {
        today: { income: 0, expense: 0, credit: 0, debit: 0 },
        month: { income: 0, expense: 0, credit: 0, debit: 0 },
        monthPlan: { income: 0, expense: 0, credit: 0, debit: 0 },
        planExecution: { incomePct: 0, expensePct: 0, creditPct: 0, debitPct: 0 }
      };
    }
    async fetchAccountBalancesFromAPI() {
      debugLog("[DASHBOARD] API fallback not implemented for account balances");
      return [];
    }
  }
  const factsManager = new DashboardFactsManager();
  class DataLayer {
    constructor() {
      this.pglite = null;
      this.pglitePromise = null;
    }
    /**
     * Lazy initialize PGlite manager
     * Handles both sync and async getPGliteManager() implementations
     */
    async getPGlite() {
      if (this.pglite) {
        return this.pglite;
      }
      if (this.pglitePromise) {
        return this.pglitePromise;
      }
      this.pglitePromise = Promise.resolve(pglite.getPGliteManager()).then(async (manager) => {
        if (!manager.isReady()) {
          await manager.init();
        }
        this.pglite = manager;
        return manager;
      });
      return this.pglitePromise;
    }
    // =============================================================================
    // Articles
    // =============================================================================
    /**
     * Get articles with optional filters
     *
     * @param filters - Optional filters (user_id, type, parent_id, is_active)
     * @returns Array of articles
     */
    async getArticles(filters) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryArticles(filters);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getArticles", duration2);
            return result2;
          }
        }
        const result = await this.getArticlesFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getArticles", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getArticles failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getArticlesFromAPI(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getArticles", duration);
          return result;
        }
        throw error;
      }
    }
    /**
     * Fetch articles from REST API
     *
     * @param filters - Optional filters
     * @returns Array of articles
     */
    async getArticlesFromAPI(filters) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters?.user_id !== void 0) {
        params.set("user_id", filters.user_id.toString());
      }
      if (filters?.type) {
        params.set("type", filters.type);
      }
      if (filters?.parent_id !== void 0) {
        if (filters.parent_id === null) {
          params.set("parent_id", "null");
        } else {
          params.set("parent_id", filters.parent_id.toString());
        }
      }
      if (filters?.is_active !== void 0) {
        params.set("is_active", filters.is_active.toString());
      }
      const response = await fetch(`/api/v1/articles?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.items || [];
    }
    // =============================================================================
    // Financial Centers
    // =============================================================================
    /**
     * Get financial centers for a user
     *
     * @param userId - User ID
     * @param includeGlobal - Include global centers (default: true)
     * @returns Array of financial centers
     */
    async getFinancialCenters(userId, includeGlobal = true) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryFinancialCenters(userId, true);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getFinancialCenters", duration2);
            return result2;
          }
        }
        const result = await this.getFinancialCentersFromAPI(includeGlobal);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getFinancialCenters", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getFinancialCenters failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getFinancialCentersFromAPI(includeGlobal);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getFinancialCenters", duration);
          return result;
        }
        throw error;
      }
    }
    /**
     * Fetch financial centers from REST API
     *
     * @param includeGlobal - Include global centers
     * @returns Array of financial centers
     */
    async getFinancialCentersFromAPI(includeGlobal) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (includeGlobal) {
        params.set("include_global", "true");
      }
      const response = await fetch(`/api/v1/financial-centers?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.financial_centers || data.items || [];
    }
    // =============================================================================
    // Cost Centers
    // =============================================================================
    /**
     * Get cost centers for a user
     *
     * @param userId - User ID
     * @param financialCenterId - Optional financial center filter (null = no filter)
     * @param includeGlobal - Include global centers (default: true)
     * @returns Array of cost centers
     */
    async getCostCenters(userId, financialCenterId = null, includeGlobal = true) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryFilteredCostCenters(
              userId,
              financialCenterId,
              true
              // only active
            );
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getCostCenters", duration2);
            return result2;
          }
        }
        const result = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getCostCenters", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getCostCenters failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getCostCentersFromAPI(financialCenterId, includeGlobal);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getCostCenters", duration);
          return result;
        }
        throw error;
      }
    }
    /**
     * Fetch cost centers from REST API
     *
     * @param financialCenterId - Optional financial center filter
     * @param includeGlobal - Include global centers
     * @returns Array of cost centers
     */
    async getCostCentersFromAPI(financialCenterId, includeGlobal) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (includeGlobal) {
        params.set("include_global", "true");
      }
      if (financialCenterId !== null) {
        params.set("financial_center_id", financialCenterId.toString());
      }
      const response = await fetch(`/api/v1/cost-centers?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.items || [];
    }
    // =============================================================================
    // Article Hierarchy
    // =============================================================================
    /**
     * Get article hierarchy using closure table
     *
     * @param articleId - Article ID to get hierarchy for
     * @returns Array of hierarchy records (ancestor-descendant pairs)
     */
    async getArticleHierarchy(articleId) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryArticleHierarchy(articleId);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getArticleHierarchy", duration2);
            return result2;
          }
        }
        const result = await this.getArticleHierarchyFromAPI(articleId);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getArticleHierarchy", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getArticleHierarchy failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getArticleHierarchyFromAPI(articleId);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getArticleHierarchy", duration);
          return result;
        }
        throw error;
      }
    }
    /**
     * Fetch article hierarchy from REST API
     *
     * @param articleId - Article ID
     * @returns Array of hierarchy records
     */
    async getArticleHierarchyFromAPI(articleId) {
      const response = await fetch(`/api/v1/articles/${articleId}/hierarchy`);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.items || [];
    }
    // =============================================================================
    // Shopping Lists (task-015 phase 2)
    // =============================================================================
    /**
     * Get shopping lists with optional filters
     *
     * @param filters - Optional filters (is_active, creator_id, etc.)
     * @returns Array of shopping lists
     */
    async getShoppingLists(filters) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryShoppingLists(filters);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getShoppingLists", duration2);
            return result2;
          }
        }
        const result = await this.getShoppingListsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getShoppingLists", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getShoppingLists failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getShoppingListsFromAPI(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getShoppingLists", duration);
          return result;
        }
        throw error;
      }
    }
    /**
     * Fetch shopping lists from REST API
     *
     * @param filters - Optional filters
     * @returns Array of shopping lists
     */
    async getShoppingListsFromAPI(filters) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters?.is_active !== void 0) {
        params.set("is_active", filters.is_active.toString());
      }
      if (filters?.sync_status) {
        params.set("sync_status", filters.sync_status);
      }
      const response = await fetch(`/api/v1/shopping-lists?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.items || [];
    }
    /**
     * Get shopping list items with filters
     *
     * @param listTempId - Shopping list temp_id
     * @param filters - Optional filters
     * @returns Array of shopping list items
     */
    async getShoppingListItems(listTempId, filters) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryShoppingListItems({
              ...filters,
              shopping_list_temp_id: listTempId
            });
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getShoppingListItems", duration2);
            return result2;
          }
        }
        const result = await this.getShoppingListItemsFromAPI(listTempId, filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getShoppingListItems", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getShoppingListItems failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getShoppingListItemsFromAPI(listTempId, filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getShoppingListItems", duration);
          return result;
        }
        throw error;
      }
    }
    /**
     * Fetch shopping list items from REST API
     *
     * @param listTempId - Shopping list temp_id
     * @param filters - Optional filters
     * @returns Array of shopping list items
     */
    async getShoppingListItemsFromAPI(listTempId, filters) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      params.set("shopping_list_temp_id", listTempId);
      if (filters?.is_completed !== void 0) {
        params.set("is_completed", filters.is_completed.toString());
      }
      if (filters?.store_id !== void 0) {
        params.set("store_id", filters.store_id.toString());
      }
      if (filters?.product_group_id !== void 0) {
        params.set("product_group_id", filters.product_group_id.toString());
      }
      const response = await fetch(`/api/v1/shopping-list-items?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.items || [];
    }
    /**
     * Get stores (reference data)
     *
     * @param filters - Optional filters
     * @returns Array of stores
     */
    async getStores(filters) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryStores(filters);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getStores", duration2);
            return result2;
          }
        }
        const result = await this.getStoresFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getStores", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getStores failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getStoresFromAPI(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getStores", duration);
          return result;
        }
        throw error;
      }
    }
    /**
     * Fetch stores from REST API
     *
     * @param filters - Optional filters
     * @returns Array of stores
     */
    async getStoresFromAPI(filters) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters?.is_active !== void 0) {
        params.set("is_active", filters.is_active.toString());
      }
      const response = await fetch(`/api/v1/stores?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.items || [];
    }
    /**
     * Get product groups (reference data)
     *
     * @param filters - Optional filters
     * @returns Array of product groups
     */
    async getProductGroups(filters) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryProductGroups(filters);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getProductGroups", duration2);
            return result2;
          }
        }
        const result = await this.getProductGroupsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getProductGroups", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getProductGroups failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getProductGroupsFromAPI(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getProductGroups", duration);
          return result;
        }
        throw error;
      }
    }
    /**
     * Fetch product groups from REST API
     *
     * @param filters - Optional filters
     * @returns Array of product groups
     */
    async getProductGroupsFromAPI(filters) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters?.is_active !== void 0) {
        params.set("is_active", filters.is_active.toString());
      }
      if (filters?.parent_id !== void 0) {
        if (filters.parent_id === null) {
          params.set("parent_id", "null");
        } else {
          params.set("parent_id", filters.parent_id.toString());
        }
      }
      const response = await fetch(`/api/v1/product-groups?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.items || [];
    }
    // =============================================================================
    // Budget Facts (task-015 phase 2)
    // =============================================================================
    /**
     * Get budget facts with filters
     *
     * @param filters - Optional filters (user_id, article_id, record_type, etc.)
     * @returns Array of budget facts
     */
    async getFacts(filters) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryFacts(filters);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getFacts", duration2);
            return result2;
          }
        }
        const result = await this.getFactsFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getFacts", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getFacts failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getFactsFromAPI(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getFacts", duration);
          return result;
        }
        throw error;
      }
    }
    /**
     * Fetch budget facts from REST API
     *
     * @param filters - Optional filters
     * @returns Array of budget facts
     */
    async getFactsFromAPI(filters) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters?.user_id !== void 0) {
        params.set("user_id", filters.user_id.toString());
      }
      if (filters?.article_id !== void 0) {
        params.set("article_id", filters.article_id.toString());
      }
      if (filters?.financial_center_id !== void 0) {
        params.set("financial_center_id", filters.financial_center_id.toString());
      }
      if (filters?.cost_center_id !== void 0) {
        params.set("cost_center_id", filters.cost_center_id.toString());
      }
      if (filters?.record_type) {
        params.set("record_type", filters.record_type);
      }
      if (filters?.date_from) {
        params.set("date_from", filters.date_from);
      }
      if (filters?.date_to) {
        params.set("date_to", filters.date_to);
      }
      const response = await fetch(`/api/v1/facts?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.items || [];
    }
    /**
     * Get count of budget facts matching filters
     *
     * @param filters - Optional filters
     * @returns Count of matching facts
     */
    async getFactsCount(filters) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const facts = await pglite2.queryFacts(filters);
            const count2 = facts.length;
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getFactsCount", duration2);
            return count2;
          }
        }
        const count = await this.getFactsCountFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getFactsCount", duration);
        return count;
      } catch (error) {
        console.error("[DATA_LAYER] getFactsCount failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const count = await this.getFactsCountFromAPI(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getFactsCount", duration);
          return count;
        }
        throw error;
      }
    }
    /**
     * Fetch budget facts count from REST API
     *
     * @param filters - Optional filters
     * @returns Count of matching facts
     */
    async getFactsCountFromAPI(filters) {
      const params = new URLSearchParams();
      if (filters?.user_id !== void 0) {
        params.set("user_id", filters.user_id.toString());
      }
      if (filters?.article_id !== void 0) {
        params.set("article_id", filters.article_id.toString());
      }
      if (filters?.financial_center_id !== void 0) {
        params.set("financial_center_id", filters.financial_center_id.toString());
      }
      if (filters?.cost_center_id !== void 0) {
        params.set("cost_center_id", filters.cost_center_id.toString());
      }
      if (filters?.record_type) {
        params.set("record_type", filters.record_type);
      }
      if (filters?.date_from) {
        params.set("date_from", filters.date_from);
      }
      if (filters?.date_to) {
        params.set("date_to", filters.date_to);
      }
      const response = await fetch(`/api/v1/facts/count?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.count || 0;
    }
    // =============================================================================
    // Recurring Plans (task-015 phase 2)
    // =============================================================================
    /**
     * Get recurring plans with filters
     *
     * @param filters - Optional filters (user_id, is_active, etc.)
     * @returns Array of recurring plans
     */
    async getRecurringPlans(filters) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryRecurringPlans(filters);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getRecurringPlans", duration2);
            return result2;
          }
        }
        const result = await this.getRecurringPlansFromAPI(filters);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getRecurringPlans", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getRecurringPlans failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getRecurringPlansFromAPI(filters);
          const duration = performance.now() - startTime;
          performanceMonitor.trackAPICall("getRecurringPlans", duration);
          return result;
        }
        throw error;
      }
    }
    /**
     * Fetch recurring plans from REST API
     *
     * @param filters - Optional filters
     * @returns Array of recurring plans
     */
    async getRecurringPlansFromAPI(filters) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters?.user_id !== void 0) {
        params.set("user_id", filters.user_id.toString());
      }
      if (filters?.article_id !== void 0) {
        params.set("article_id", filters.article_id.toString());
      }
      if (filters?.financial_center_id !== void 0) {
        params.set("financial_center_id", filters.financial_center_id.toString());
      }
      if (filters?.cost_center_id !== void 0) {
        params.set("cost_center_id", filters.cost_center_id.toString());
      }
      if (filters?.is_active !== void 0) {
        params.set("is_active", filters.is_active.toString());
      }
      if (filters?.frequency) {
        params.set("frequency", filters.frequency);
      }
      const response = await fetch(`/api/v1/recurring-plans?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.items || [];
    }
    // =============================================================================
    // Dashboard Analytics (task-011)
    // =============================================================================
    /**
     * Get dashboard data (PGlite-first with API fallback)
     * Used for future features requiring dashboard analytics
     *
     * @returns Dashboard data (recent facts, quick stats, account balances)
     */
    async getDashboardData() {
      return await factsManager.initDashboard();
    }
    // =============================================================================
    // Performance Metrics
    // =============================================================================
    /**
     * Get performance statistics
     *
     * @returns Performance stats comparing API and PGlite
     */
    getPerformanceStats() {
      return performanceMonitor.getStats();
    }
    /**
     * Reset performance metrics
     */
    resetPerformanceMetrics() {
      performanceMonitor.reset();
    }
  }
  const dataLayer = new DataLayer();
  if (typeof window !== "undefined") {
    window.dataLayer = dataLayer;
  }
  function convertShoppingList(local) {
    return {
      id: local.id || 0,
      // Use temp_id hash or 0 if no server ID yet
      temp_id: local.temp_id,
      // Preserve PGlite temp_id for write operations (task-015 Phase 4)
      name: local.name,
      is_active: local.is_active,
      created_at: local.created_at.toISOString(),
      updated_at: local.updated_at.toISOString(),
      description: local.description || void 0
      // total_items and completed_items will be calculated by UI
    };
  }
  function convertShoppingListItem(local, listId) {
    return {
      id: local.id || 0,
      list_id: listId,
      temp_id: local.temp_id,
      // Preserve PGlite temp_id for write operations (task-015 Phase 4)
      product_name: local.product_name,
      quantity: local.quantity,
      unit: local.unit,
      is_completed: local.is_completed,
      completed_at: local.completed_at?.toISOString(),
      store_id: local.store_id,
      product_group_id: local.product_group_id,
      notes: local.comment,
      // PGlite uses 'comment', UI uses 'notes'
      created_at: local.created_at.toISOString(),
      updated_at: local.updated_at.toISOString()
    };
  }
  function convertStore(local) {
    return {
      id: local.id,
      name: local.name,
      is_active: local.is_active,
      created_at: local.created_at.toISOString()
      // updated_at is optional in State type
    };
  }
  function convertProductGroup(local) {
    return {
      id: local.id,
      name: local.name,
      parent_id: local.parent_id,
      is_active: local.is_active,
      created_at: local.created_at.toISOString()
      // updated_at is optional in State type
    };
  }
  async function initializeListsManager() {
    debugLog("[ListsManager] Initializing...");
    try {
      if (typeof IndexedDBManager !== "undefined") {
        const db = new IndexedDBManager();
        await db.init();
        updateState$1({ db });
        debugLog("[ListsManager] IndexedDB initialized for offline support");
      } else {
        console.warn("[ListsManager] IndexedDBManager not available, offline mode disabled");
      }
      if (window.offlineManager && typeof OfflineShoppingManager !== "undefined") {
        const offlineShopping = new OfflineShoppingManager(window.offlineManager);
        updateState$1({ offlineShopping });
        debugLog("[ListsManager] OfflineShoppingManager initialized");
      }
      window.addEventListener("offline-status-change", async (event) => {
        const { online } = event.detail || {};
        if (online) {
          debugLog("[ListsManager] Network restored, refreshing data...");
          await loadShoppingLists();
          const currentState = getState$1();
          if (currentState.currentListId) {
            await loadShoppingListItems(currentState.currentListId);
          }
        }
      });
      debugLog("[ListsManager] Initialization complete");
    } catch (error) {
      console.error("[ListsManager] Initialization error:", error);
      throw error;
    }
  }
  function isOnline() {
    if (window.offlineManager && window.offlineManager.networkDetector) {
      return window.offlineManager.networkDetector.getStatus() !== "offline";
    }
    try {
      if (localStorage.getItem("budget_auto_offline_mode") === "true") {
        return false;
      }
    } catch (e) {
    }
    return navigator.onLine;
  }
  async function loadShoppingLists() {
    try {
      const localLists = await dataLayer.getShoppingLists({ is_active: true });
      const shoppingLists = localLists.map(convertShoppingList);
      updateState$1({ shoppingLists });
      debugLog("[ListsManager] Loaded shopping lists:", shoppingLists.length);
    } catch (error) {
      console.error("[ListsManager] Error loading shopping lists:", error);
      showToast("Ошибка загрузки списков", "error");
      updateState$1({ shoppingLists: [] });
    }
  }
  async function loadShoppingListItems(listId) {
    try {
      const listTempId = String(listId);
      const localItems = await dataLayer.getShoppingListItems(listTempId);
      const numericListId = typeof listId === "number" ? listId : parseInt(listId, 10) || 0;
      const currentItems = localItems.map((item) => convertShoppingListItem(item, numericListId));
      updateState$1({ currentItems });
      debugLog("[ListsManager] Loaded items:", currentItems.length);
      await loadStoresAndGroups();
    } catch (error) {
      console.error("[ListsManager] Error loading items:", error);
      showToast("Ошибка загрузки элементов", "error");
      updateState$1({ currentItems: [] });
    }
  }
  async function loadStores() {
    try {
      const localStores = await dataLayer.getStores();
      const stores = localStores.map(convertStore);
      updateState$1({ stores });
      debugLog("[ListsManager] Loaded stores:", stores.length);
    } catch (error) {
      console.error("[ListsManager] Error loading stores:", error);
      updateState$1({ stores: [] });
    }
  }
  async function loadProductGroups() {
    try {
      const localGroups = await dataLayer.getProductGroups();
      const productGroups = localGroups.map(convertProductGroup);
      updateState$1({ productGroups });
      debugLog("[ListsManager] Loaded product groups:", productGroups.length);
    } catch (error) {
      console.error("[ListsManager] Error loading product groups:", error);
      updateState$1({ productGroups: [] });
    }
  }
  async function loadStoresAndGroups() {
    await Promise.all([
      loadStores(),
      loadProductGroups()
    ]);
  }
  async function switchToList(listId) {
    updateState$1({ currentListId: listId });
    await loadShoppingListItems(listId);
  }
  function escapeHtml$2(unsafe) {
    if (!unsafe) return "";
    return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function formatQuantity(quantity, unit) {
    if (quantity === null) return "—";
    const rounded = Math.round(quantity);
    return unit ? `${rounded} ${unit}` : rounded.toString();
  }
  function getProductGroupBreadcrumbs(groupId) {
    if (!groupId) return "";
    const state2 = getState$1();
    const groupMap = {};
    state2.productGroups.forEach((group) => {
      groupMap[group.id] = group;
    });
    const path = [];
    let currentId = groupId;
    while (currentId && groupMap[currentId]) {
      path.unshift(groupMap[currentId].name);
      currentId = groupMap[currentId].parent_id || null;
    }
    return path.join(" → ");
  }
  function filterItemsBySearch() {
    const state2 = getState$1();
    let items = state2.currentItems;
    if (state2.hideCompleted) {
      items = items.filter((item) => !item.is_completed);
    }
    if (!state2.searchQuery || state2.searchQuery.trim() === "") {
      return items;
    }
    const query = state2.searchQuery.toLowerCase().trim();
    debugLog("[SEARCH_FILTER] Starting search", {
      query,
      totalItems: items.length,
      storeCount: state2.stores.length,
      groupCount: state2.productGroups.length,
      hideCompleted: state2.hideCompleted
    });
    const storeMap = {};
    state2.stores.forEach((s) => {
      storeMap[s.id] = s.name || "";
    });
    const groupMap = {};
    state2.productGroups.forEach((g) => {
      groupMap[g.id] = g;
    });
    debugLog("[SEARCH_FILTER] Maps built", {
      storeMapSize: Object.keys(storeMap).length,
      groupMapSize: Object.keys(groupMap).length
    });
    const getGroupAncestorNames = (groupId) => {
      if (!groupId) return [];
      const names = [];
      let currentId = groupId;
      while (currentId && groupMap[currentId]) {
        names.push(groupMap[currentId].name || "");
        currentId = groupMap[currentId].parent_id || null;
      }
      return names;
    };
    const results = items.filter((item) => {
      if ((item.product_name || "").toLowerCase().includes(query)) {
        return true;
      }
      if (item.store_id) {
        const storeName = storeMap[item.store_id] || "";
        if (storeName.toLowerCase().includes(query)) {
          return true;
        }
      }
      if (item.product_group_id) {
        const groupNames = getGroupAncestorNames(item.product_group_id);
        for (const name of groupNames) {
          if (name.toLowerCase().includes(query)) {
            return true;
          }
        }
      }
      if ((item.notes || "").toLowerCase().includes(query)) {
        return true;
      }
      return false;
    });
    debugLog("[SEARCH_FILTER] Search complete", {
      query,
      matchedItems: results.length,
      totalItems: items.length,
      matchRate: `${(results.length / items.length * 100).toFixed(1)}%`,
      sampleResults: results.slice(0, 3).map((r) => ({
        id: r.id,
        product_name: r.product_name,
        store: r.store_id !== null ? storeMap[r.store_id] || "N/A" : "N/A"
      }))
    });
    return results;
  }
  function renderItemsTable() {
    const tbody = document.getElementById("items-table-body");
    const emptyState = document.getElementById("table-empty-state");
    const desktopTable = document.getElementById("desktop-table-container");
    const state2 = getState$1();
    const filteredItems = filterItemsBySearch();
    if (filteredItems.length === 0) {
      if (desktopTable) desktopTable.classList.add("table-content-hidden");
      if (emptyState) emptyState.classList.remove("hidden");
      const emptyTitle = emptyState?.querySelector("h3");
      const emptyText = emptyState?.querySelector("p");
      const emptyButton = emptyState?.querySelector("button");
      const hasCompletedItems = state2.currentItems.some((item) => item.is_completed);
      if (state2.searchQuery && state2.searchQuery.trim() !== "") {
        if (emptyTitle) emptyTitle.textContent = "Ничего не найдено";
        if (emptyText) emptyText.textContent = "Попробуйте изменить поисковый запрос";
        if (emptyButton) {
          emptyButton.textContent = "➕ Добавить товар";
          emptyButton.onclick = () => openAddItemModal();
        }
      } else if (state2.hideCompleted && hasCompletedItems) {
        if (emptyTitle) emptyTitle.textContent = "Все товары выполнены";
        if (emptyText) emptyText.textContent = 'Нажмите "Показать все" чтобы увидеть выполненные товары';
        if (emptyButton) {
          emptyButton.textContent = "👁️ Показать все";
          emptyButton.onclick = () => toggleHideCompleted();
        }
      } else {
        if (emptyTitle) emptyTitle.textContent = "Список пуст";
        if (emptyText) emptyText.textContent = "Добавьте первый товар или импортируйте из CSV";
        if (emptyButton) {
          emptyButton.textContent = "➕ Добавить товар";
          emptyButton.onclick = () => openAddItemModal();
        }
      }
      return;
    }
    if (desktopTable) desktopTable.classList.remove("table-content-hidden");
    if (emptyState) emptyState.classList.add("hidden");
    if (!tbody) return;
    tbody.innerHTML = filteredItems.map((item) => {
      const store = state2.stores.find((s) => s.id === item.store_id);
      const groupPath = getProductGroupBreadcrumbs(item.product_group_id);
      const isCompleted = item.is_completed;
      const productName = item.product_name || "";
      const comment = item.notes || "";
      return `
      <tr class="${isCompleted ? "completed" : ""} cursor-pointer hover:bg-base-200"
          data-item-id="${item.id}"
          onclick="window.listsManager.toggleItemCompleted(${item.id}, ${!isCompleted})">
        <td data-label="Магазин">${store ? escapeHtml$2(store.name) : "N/A"}</td>
        <td data-label="Группа" class="text-xs">${groupPath ? escapeHtml$2(groupPath) : "N/A"}</td>
        <td data-label="Товар">
          <span class="table-item-name ${isCompleted ? "line-through opacity-60" : ""}">
            ${escapeHtml$2(productName)}
          </span>
        </td>
        <td data-label="Кол-во" class="text-right">${item.quantity !== null ? formatQuantity(item.quantity, item.unit) : "—"}</td>
        <td data-label="Ед.">${item.unit ? escapeHtml$2(item.unit) : "—"}</td>
        <td data-label="Комментарий" class="truncate-1-line">${comment ? escapeHtml$2(comment) : "—"}</td>
        <td data-label="Действия" class="text-center" onclick="event.stopPropagation()">
          <div class="action-buttons">
            <button class="btn btn-sm btn-square btn-ghost"
                    onclick="openEditItemModal(${item.id})"
                    title="Редактировать">
              ✏️
            </button>
            <button class="btn btn-sm btn-square btn-ghost text-error"
                    onclick="window.listsManager.deleteItem(${item.id})"
                    title="Удалить">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join("");
    updateSelectionUI$1();
  }
  function updateSelectionUI$1() {
    const state2 = getState$1();
    const tbody = document.getElementById("items-table-body");
    if (!tbody) return;
    const rows = tbody.querySelectorAll("tr[data-item-id]");
    rows.forEach((row) => {
      const itemId = parseInt(row.getAttribute("data-item-id") || "0");
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = state2.selectedItemIds.has(itemId);
      }
    });
  }
  function renderCurrentView() {
    const state2 = getState$1();
    const isMobile = window.innerWidth < 640;
    if (isMobile && state2.currentView === "hierarchy") {
      if (state2.hierarchyView) {
        state2.hierarchyView.render();
      } else {
        debugLog("[ListsManager] Mobile: waiting for hierarchyView initialization (skipping table render)");
        return;
      }
    } else if (state2.currentView === "hierarchy" && state2.hierarchyView) {
      state2.hierarchyView.render();
    } else {
      renderItemsTable();
    }
  }
  function handleSearch(query) {
    updateState$1({ searchQuery: query });
    const clearBtn = document.getElementById("clear-search-btn");
    if (clearBtn) {
      if (query && query.trim() !== "") {
        clearBtn.classList.remove("hidden");
      } else {
        clearBtn.classList.add("hidden");
      }
    }
    const state2 = getState$1();
    if (state2.currentView === "hierarchy" && state2.hierarchyView) {
      state2.hierarchyView.render();
    } else {
      renderCurrentView();
    }
  }
  function clearSearch() {
    const input = document.getElementById("items-search");
    if (input) {
      input.value = "";
    }
    handleSearch("");
  }
  function toggleSearchField() {
    const searchContainer = document.getElementById("search-field-container");
    const searchInput = document.getElementById("items-search");
    if (!searchContainer) return;
    const isHidden = searchContainer.classList.contains("hidden");
    if (isHidden) {
      searchContainer.classList.remove("hidden");
      searchInput?.focus();
    } else {
      searchContainer.classList.add("hidden");
      if (searchInput) searchInput.value = "";
      clearSearch();
    }
  }
  function toggleHideCompleted$1() {
    const state2 = getState$1();
    const newValue = !state2.hideCompleted;
    updateState$1({ hideCompleted: newValue });
    try {
      localStorage.setItem("lists_hide_completed_preference", newValue.toString());
      debugLog("[ListsManager] Saved hide completed preference:", newValue);
    } catch (e) {
    }
    updateHideCompletedButton();
    renderCurrentView();
    updateFABButtons();
  }
  function updateHideCompletedButton() {
    const state2 = getState$1();
    const btn = document.getElementById("toggle-hide-completed-btn");
    if (!btn) return;
    const iconSpan = btn.querySelector("span:first-child");
    const textSpan = btn.querySelector("span:last-child");
    if (state2.hideCompleted) {
      if (iconSpan) iconSpan.textContent = "👁️‍🗨️";
      if (textSpan) textSpan.textContent = "Показать все";
      btn.title = "Показать все товары";
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-outline");
    } else {
      if (iconSpan) iconSpan.textContent = "👁️";
      if (textSpan) textSpan.textContent = "Скрыть выполненные";
      btn.title = "Скрыть выполненные товары";
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-outline");
    }
  }
  function updateFABButtons() {
    const state2 = getState$1();
    if (!state2.currentItems || state2.currentItems.length === 0) {
      document.getElementById("fab-item-delete-completed")?.classList.add("hidden");
      document.getElementById("fab-item-mark-all-completed")?.classList.add("hidden");
      document.getElementById("fab-item-unmark-all-completed")?.classList.add("hidden");
      return;
    }
    const completedCount = state2.currentItems.filter((item) => item.is_completed).length;
    const totalCount = state2.currentItems.length;
    const uncompletedCount = totalCount - completedCount;
    const deleteItem2 = document.getElementById("fab-item-delete-completed");
    if (deleteItem2) {
      if (completedCount > 0) {
        deleteItem2.classList.remove("hidden");
      } else {
        deleteItem2.classList.add("hidden");
      }
    }
    const markAllItem = document.getElementById("fab-item-mark-all-completed");
    if (markAllItem) {
      if (uncompletedCount > 0) {
        markAllItem.classList.remove("hidden");
      } else {
        markAllItem.classList.add("hidden");
      }
    }
    const unmarkAllItem = document.getElementById("fab-item-unmark-all-completed");
    if (unmarkAllItem) {
      if (completedCount > 0) {
        unmarkAllItem.classList.remove("hidden");
      } else {
        unmarkAllItem.classList.add("hidden");
      }
    }
  }
  const scriptRel = "modulepreload";
  const assetsURL = function(dep) {
    return "/" + dep;
  };
  const seen = {};
  const __vitePreload = function preload(baseModule, deps, importerUrl) {
    let promise = Promise.resolve();
    if (false) {
      let allSettled2 = function(promises) {
        return Promise.all(
          promises.map(
            (p) => Promise.resolve(p).then(
              (value) => ({ status: "fulfilled", value }),
              (reason) => ({ status: "rejected", reason })
            )
          )
        );
      };
      document.getElementsByTagName("link");
      const cspNonceMeta = document.querySelector(
        "meta[property=csp-nonce]"
      );
      const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
      promise = allSettled2(
        deps.map((dep) => {
          dep = assetsURL(dep);
          if (dep in seen) return;
          seen[dep] = true;
          const isCss = dep.endsWith(".css");
          const cssSelector = isCss ? '[rel="stylesheet"]' : "";
          if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
            return;
          }
          const link = document.createElement("link");
          link.rel = isCss ? "stylesheet" : scriptRel;
          if (!isCss) {
            link.as = "script";
          }
          link.crossOrigin = "";
          link.href = dep;
          if (cspNonce) {
            link.setAttribute("nonce", cspNonce);
          }
          document.head.appendChild(link);
          if (isCss) {
            return new Promise((res, rej) => {
              link.addEventListener("load", res);
              link.addEventListener(
                "error",
                () => rej(new Error(`Unable to preload CSS for ${dep}`))
              );
            });
          }
        })
      );
    }
    function handlePreloadError(err) {
      const e = new Event("vite:preloadError", {
        cancelable: true
      });
      e.payload = err;
      window.dispatchEvent(e);
      if (!e.defaultPrevented) {
        throw err;
      }
    }
    return promise.then((res) => {
      for (const item of res || []) {
        if (item.status !== "rejected") continue;
        handlePreloadError(item.reason);
      }
      return baseModule().catch(handlePreloadError);
    });
  };
  function escapeHtml$1(unsafe) {
    if (!unsafe) return "";
    return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function isDesktop() {
    return window.innerWidth >= 768;
  }
  async function updateMobileUI() {
    const { updateMobileAddButton: updateMobileAddButton2 } = await __vitePreload(async () => {
      const { updateMobileAddButton: updateMobileAddButton3 } = await Promise.resolve().then(function() {
        return globalHelpers;
      });
      return { updateMobileAddButton: updateMobileAddButton3 };
    }, false ? __VITE_PRELOAD__ : void 0);
    await updateMobileAddButton2();
  }
  function showFAB() {
    const isDesktopResult = isDesktop();
    debugLog("[FAB] showFAB() called", { isDesktop: isDesktopResult });
    if (!isDesktopResult) return;
    const fabMenu = document.getElementById("lists-fab-menu");
    if (fabMenu) fabMenu.classList.remove("hidden");
  }
  function hideFAB() {
    const isDesktopResult = isDesktop();
    debugLog("[FAB] hideFAB() called", { isDesktop: isDesktopResult });
    if (!isDesktopResult) return;
    const fabMenu = document.getElementById("lists-fab-menu");
    if (fabMenu) fabMenu.classList.add("hidden");
  }
  function showAddItemFAB() {
    const isDesktopResult = isDesktop();
    debugLog("[FAB] showAddItemFAB() called", { isDesktop: isDesktopResult });
    if (!isDesktopResult) return;
    const addItemFab = document.getElementById("add-item-fab");
    if (addItemFab) addItemFab.classList.remove("hidden");
  }
  function hideAddItemFAB() {
    const isDesktopResult = isDesktop();
    debugLog("[FAB] hideAddItemFAB() called", { isDesktop: isDesktopResult });
    if (!isDesktopResult) return;
    const addItemFab = document.getElementById("add-item-fab");
    if (addItemFab) addItemFab.classList.add("hidden");
  }
  function showCreateListFAB() {
    const isDesktopResult = isDesktop();
    debugLog("[FAB] showCreateListFAB() called", { isDesktop: isDesktopResult });
    if (!isDesktopResult) return;
    const createListFab = document.getElementById("create-list-fab");
    if (createListFab) createListFab.classList.remove("hidden");
  }
  function hideCreateListFAB() {
    const isDesktopResult = isDesktop();
    debugLog("[FAB] hideCreateListFAB() called", { isDesktop: isDesktopResult });
    if (!isDesktopResult) return;
    const createListFab = document.getElementById("create-list-fab");
    if (createListFab) createListFab.classList.add("hidden");
  }
  function updateFABVisibility() {
    const fabMenu = document.getElementById("lists-fab-menu");
    const fabBackdrop = document.getElementById("lists-fab-backdrop");
    const state2 = getState$1();
    const inDetailView = state2.currentListId !== null;
    const isDesktopResult = isDesktop();
    debugLog("[FAB] updateFABVisibility", {
      inDetailView,
      isDesktop: isDesktopResult,
      currentListId: state2.currentListId
    });
    if (inDetailView && isDesktopResult) {
      if (fabMenu) fabMenu.classList.remove("hidden");
    } else {
      if (fabMenu) fabMenu.classList.add("hidden");
      if (fabBackdrop) fabBackdrop.classList.add("hidden");
    }
  }
  function switchView(viewName, savePreference = true) {
    const isMobile = window.innerWidth < 640;
    if (isMobile && viewName === "table") {
      debugLog("[ListsManager] Mobile detected - ignoring table view switch, forcing hierarchy");
      viewName = "hierarchy";
      savePreference = false;
    }
    if (savePreference) {
      try {
        localStorage.setItem("lists_view_preference", viewName);
        debugLog("[ListsManager] Saved view preference:", viewName);
      } catch (e) {
      }
    } else {
      debugLog("[ListsManager] Switched to", viewName, "view (not saving preference)");
    }
    updateState$1({ currentView: viewName });
    const tableViewContainer = document.getElementById("table-view");
    const hierarchyViewContainer = document.getElementById("hierarchy-view");
    const tableBtn = document.getElementById("table-view-btn");
    const hierarchyBtn = document.getElementById("hierarchy-view-btn");
    const tableControls = document.getElementById("table-controls");
    const hierarchyControls = document.getElementById("hierarchy-controls");
    if (viewName === "hierarchy") {
      if (tableViewContainer) tableViewContainer.classList.add("hidden");
      if (hierarchyViewContainer) hierarchyViewContainer.classList.remove("hidden");
      if (tableBtn) {
        tableBtn.classList.remove("btn-primary");
        tableBtn.classList.add("btn-outline");
      }
      if (hierarchyBtn) {
        hierarchyBtn.classList.remove("btn-outline");
        hierarchyBtn.classList.add("btn-primary");
      }
      if (tableControls) tableControls.classList.add("hidden");
      if (hierarchyControls) hierarchyControls.classList.remove("hidden");
    } else {
      if (tableViewContainer) tableViewContainer.classList.remove("hidden");
      if (hierarchyViewContainer) hierarchyViewContainer.classList.add("hidden");
      if (tableBtn) {
        tableBtn.classList.remove("btn-outline");
        tableBtn.classList.add("btn-primary");
      }
      if (hierarchyBtn) {
        hierarchyBtn.classList.remove("btn-primary");
        hierarchyBtn.classList.add("btn-outline");
      }
      if (tableControls) tableControls.classList.remove("hidden");
      if (hierarchyControls) hierarchyControls.classList.add("hidden");
    }
    renderCurrentView();
    updateFABVisibility();
  }
  function initializeResponsiveView() {
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      debugLog("[ListsManager] Mobile detected (<640px), forcing hierarchy view (not saving)");
      switchView("hierarchy", false);
      return;
    }
    const savedPreference = localStorage.getItem("lists_view_preference");
    if (savedPreference === "hierarchy") {
      debugLog("[ListsManager] Desktop: restoring hierarchy view from preference");
      switchView("hierarchy", false);
    } else {
      debugLog("[ListsManager] Desktop: using table view");
      switchView("table", false);
    }
  }
  function syncViewUI() {
    const state2 = getState$1();
    const viewName = state2.currentView;
    const isMobile = window.innerWidth < 640;
    const tableViewContainer = document.getElementById("table-view");
    const hierarchyViewContainer = document.getElementById("hierarchy-view");
    const tableBtn = document.getElementById("table-view-btn");
    const hierarchyBtn = document.getElementById("hierarchy-view-btn");
    const tableControls = document.getElementById("table-controls");
    const hierarchyControls = document.getElementById("hierarchy-controls");
    if (viewName === "hierarchy" || isMobile) {
      if (tableViewContainer) tableViewContainer.classList.add("hidden");
      if (hierarchyViewContainer) hierarchyViewContainer.classList.remove("hidden");
      if (tableBtn) {
        tableBtn.classList.remove("btn-primary");
        tableBtn.classList.add("btn-outline");
      }
      if (hierarchyBtn) {
        hierarchyBtn.classList.remove("btn-outline");
        hierarchyBtn.classList.add("btn-primary");
      }
      if (tableControls) tableControls.classList.add("hidden");
      if (hierarchyControls) hierarchyControls.classList.remove("hidden");
      if (isMobile) {
        debugLog("[ListsManager] Mobile detected - forcing hierarchy view (table permanently hidden)");
      }
    } else {
      if (tableViewContainer) tableViewContainer.classList.remove("hidden");
      if (hierarchyViewContainer) hierarchyViewContainer.classList.add("hidden");
      if (tableBtn) {
        tableBtn.classList.remove("btn-outline");
        tableBtn.classList.add("btn-primary");
      }
      if (hierarchyBtn) {
        hierarchyBtn.classList.remove("btn-primary");
        hierarchyBtn.classList.add("btn-outline");
      }
      if (tableControls) tableControls.classList.remove("hidden");
      if (hierarchyControls) hierarchyControls.classList.add("hidden");
    }
    debugLog("[ListsManager] Synced view UI:", { viewName, isMobile });
  }
  function renderShoppingListCards() {
    const state2 = getState$1();
    const grid = document.getElementById("lists-grid");
    const emptyState = document.getElementById("empty-state");
    if (state2.shoppingLists.length === 0) {
      if (grid) grid.classList.add("hidden");
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }
    if (grid) grid.classList.remove("hidden");
    if (emptyState) emptyState.classList.add("hidden");
    if (!grid) return;
    grid.innerHTML = state2.shoppingLists.map((list) => {
      const totalItems = list.total_items || 0;
      const completedItems = list.completed_items || 0;
      const progressPercent = totalItems > 0 ? Math.round(completedItems / totalItems * 100) : 0;
      return `
      <div class="shopping-list-card" data-list-id="${list.id}">
        <div class="flex justify-between items-start mb-2">
          <div class="card-title flex-1">${escapeHtml$1(list.name)}</div>
          <button class="btn-delete-list btn btn-ghost btn-sm btn-circle text-error hover:bg-error hover:text-error-content ml-2"
                  data-list-id="${list.id}"
                  data-list-name="${escapeHtml$1(list.name)}"
                  title="Удалить список"
                  aria-label="Удалить список ${escapeHtml$1(list.name)}"
                  style="transform: scale(1.25);">
            🗑️
          </button>
        </div>
        <div class="card-description truncate-2-lines">
          ${list.description ? escapeHtml$1(list.description) : "Без описания"}
        </div>
        <div class="card-progress">
          <div class="card-progress-bar">
            <div class="card-progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="card-progress-text">
            ${completedItems} / ${totalItems} выполнено (${progressPercent}%)
          </div>
        </div>
      </div>
    `;
    }).join("");
    grid.querySelectorAll(".shopping-list-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        const target = e.target;
        if (target && !target.closest(".btn-delete-list")) {
          const htmlCard = card;
          const listId = htmlCard.dataset.listId;
          if (listId && window.listsManager) {
            window.listsManager.showDetailView(parseInt(listId, 10));
          }
        }
      });
    });
    grid.querySelectorAll(".btn-delete-list").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const htmlBtn = btn;
        const listId = htmlBtn.dataset.listId;
        const listName = htmlBtn.dataset.listName;
        if (listId && listName) {
          openDeleteListModal(parseInt(listId, 10), listName);
        }
      });
    });
  }
  async function renderLandingView() {
    debugLog("[ListsManager] Showing landing view");
    updateState$1({
      currentListId: null,
      currentItems: [],
      selectedItemIds: /* @__PURE__ */ new Set()
    });
    closeImportWizard();
    hideFAB();
    hideAddItemFAB();
    showCreateListFAB();
    document.getElementById("landing-view")?.classList.remove("hidden");
    document.getElementById("detail-view")?.classList.add("hidden");
    await loadShoppingLists();
    renderShoppingListCards();
    await updateMobileUI();
  }
  async function renderDetailView(listId) {
    debugLog("[ListsManager] Showing detail view for list:", listId);
    const state2 = getState$1();
    updateState$1({
      currentItems: [],
      selectedItemIds: /* @__PURE__ */ new Set(),
      currentListId: listId,
      searchQuery: "",
      hideCompleted: false
    });
    closeImportWizard();
    const searchInput = document.getElementById("items-search");
    if (searchInput) searchInput.value = "";
    const clearBtn = document.getElementById("clear-search-btn");
    if (clearBtn) clearBtn.classList.add("hidden");
    try {
      const storedHide = localStorage.getItem("lists_hide_completed_preference");
      if (storedHide === "true") {
        updateState$1({ hideCompleted: true });
        debugLog("[ListsManager] Restored hide completed preference:", true);
      }
    } catch (e) {
    }
    updateHideCompletedButton();
    try {
      const searchVisible = localStorage.getItem("lists_search_visible");
      if (searchVisible === "true") {
        const container = document.getElementById("search-field-container");
        const button = document.getElementById("toggle-search-btn");
        if (container && button) {
          container.classList.remove("hidden");
          button.classList.remove("btn-outline");
          button.classList.add("btn-primary");
          debugLog("[SEARCH] Restored search field visibility:", { visible: true });
        }
      }
    } catch (e) {
    }
    if (state2.hierarchyView) {
      state2.hierarchyView.expandedNodes.clear();
    }
    const list = state2.shoppingLists.find((l) => l.id === listId);
    if (!list) {
      showToast("Список не найден", "error");
      return;
    }
    const breadcrumbElement = document.getElementById("breadcrumb-list-name");
    if (breadcrumbElement) breadcrumbElement.textContent = list.name;
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      updateState$1({ currentView: "hierarchy" });
      debugLog("[RENDER_DETAIL] Pre-set hierarchy view for mobile (prevents flicker)");
    } else {
      const savedPreference = localStorage.getItem("lists_view_preference");
      updateState$1({ currentView: savedPreference === "hierarchy" ? "hierarchy" : "table" });
      debugLog("[RENDER_DETAIL] Pre-set desktop view from preference:", savedPreference || "table");
    }
    syncViewUI();
    debugLog("[RENDER_DETAIL] syncViewUI() completed - table-view hidden before detail-view shown");
    const landingView = document.getElementById("landing-view");
    const detailView = document.getElementById("detail-view");
    if (landingView) landingView.classList.add("hidden");
    if (detailView) detailView.classList.remove("hidden");
    debugLog("[RENDER_DETAIL] detail-view shown (table-view already hidden)");
    hideCreateListFAB();
    showFAB();
    showAddItemFAB();
    await loadShoppingListItems(listId);
    renderCurrentView();
    debugLog("[RENDER_DETAIL] renderCurrentView() completed");
    updateFABVisibility();
    if (typeof window.initStoreChoices === "function") {
      window.initStoreChoices();
    }
    if (typeof window.initProductGroupChoices === "function") {
      window.initProductGroupChoices();
    }
    await updateMobileUI();
  }
  const SELECTORS = {
    hierarchyItem: (id) => `.hierarchy-item[data-item-id="${id}"]`,
    hierarchyItemName: ".hierarchy-item-name",
    tableRow: (id) => `#items-table-body tr[data-item-id="${id}"]`,
    tableItemName: ".table-item-name"
  };
  function refreshUI() {
    renderCurrentView();
    updateFABButtons();
    updateFABVisibility();
  }
  async function createItem(data) {
    const state2 = getState$1();
    const pglite$1 = pglite.getPGliteManager();
    try {
      let result;
      if (pglite.isPGliteEnabled() && pglite$1.isReady()) {
        const currentList = state2.shoppingLists.find((l) => l.id === state2.currentListId);
        if (!currentList?.temp_id) {
          throw new Error("Current shopping list not found or missing temp_id");
        }
        const userId = window.offlineManager ? await window.offlineManager.getCurrentUserId() : null;
        if (!userId) {
          throw new Error("User ID not available");
        }
        const temp_id = await pglite$1.addItemToList({
          shopping_list_temp_id: currentList.temp_id,
          creator_id: userId,
          product_name: data.product_name || "",
          quantity: data.quantity ?? null,
          unit: data.unit ?? null,
          comment: data.comment ?? null,
          position: null,
          // Auto-assigned by PGlite
          store_id: data.store_id ?? 0,
          // 0 = no store
          product_group_id: data.product_group_id ?? 0
          // 0 = no group
        });
        result = { tempId: temp_id, id: null };
        debugLog("[LIST_OPS] Item created in PGlite", { temp_id });
        if (state2.currentListId) {
          await loadShoppingListItems(state2.currentListId);
        }
      } else {
        const itemData = {
          ...data,
          shopping_list_id: state2.currentListId
        };
        const response = await fetch("/api/v1/shopping-list-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(itemData)
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        result = await response.json();
        debugLog("[LIST_OPS] Item created via API", { id: result.id });
        if (state2.currentListId) {
          await loadShoppingListItems(state2.currentListId);
        }
      }
      showToast("Товар добавлен", "success");
      refreshUI();
      return result;
    } catch (error) {
      console.error("[LIST_OPS] Error creating item:", error);
      showToast("Ошибка создания товара", "error");
      throw error;
    }
  }
  async function updateItem(itemId, data) {
    const state2 = getState$1();
    const pglite$1 = pglite.getPGliteManager();
    const item = state2.currentItems.find((i) => i.id === itemId);
    if (!item) {
      throw new Error("Item not found in state");
    }
    try {
      let result;
      if (pglite.isPGliteEnabled() && pglite$1.isReady() && item.temp_id) {
        const updates = {};
        if (data.product_name !== void 0) updates.product_name = data.product_name;
        if (data.quantity !== void 0) updates.quantity = data.quantity;
        if (data.unit !== void 0) updates.unit = data.unit;
        if (data.comment !== void 0) updates.comment = data.comment;
        if (data.store_id !== void 0) updates.store_id = data.store_id;
        if (data.product_group_id !== void 0) updates.product_group_id = data.product_group_id;
        await pglite$1.updateItem(item.temp_id, updates);
        result = { tempId: item.temp_id, id: itemId };
        debugLog("[LIST_OPS] Item updated in PGlite", { temp_id: item.temp_id });
        if (state2.currentListId) {
          await loadShoppingListItems(state2.currentListId);
        }
      } else {
        const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        result = await response.json();
        debugLog("[LIST_OPS] Item updated via API", { id: itemId });
        if (state2.currentListId) {
          await loadShoppingListItems(state2.currentListId);
        }
      }
      showToast("Товар обновлен", "success");
      refreshUI();
      return result;
    } catch (error) {
      console.error("[LIST_OPS] Error updating item:", error);
      showToast("Ошибка обновления товара", "error");
      throw error;
    }
  }
  async function toggleItemCompleted(itemId, isCompleted) {
    const state2 = getState$1();
    const pglite$1 = pglite.getPGliteManager();
    const item = state2.currentItems.find((i) => i.id === itemId);
    if (!item) {
      throw new Error("Item not found in state");
    }
    updateItemCompletedDom(itemId, isCompleted);
    try {
      if (pglite.isPGliteEnabled() && pglite$1.isReady() && item.temp_id) {
        await pglite$1.toggleItemCompleted(item.temp_id, isCompleted);
        debugLog("[LIST_OPS] Item completion toggled in PGlite", { temp_id: item.temp_id, isCompleted });
        if (state2.currentListId) {
          await loadShoppingListItems(state2.currentListId);
        }
      } else {
        const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ is_completed: isCompleted })
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        debugLog("[LIST_OPS] Item completion toggled via API", { id: itemId, isCompleted });
        if (state2.currentListId) {
          await loadShoppingListItems(state2.currentListId);
        }
      }
      refreshUI();
    } catch (error) {
      console.error("[LIST_OPS] Error toggling item completed:", error);
      updateItemCompletedDom(itemId, !isCompleted);
      showToast("Ошибка обновления статуса", "error");
    }
  }
  function updateItemCompletedDom(itemId, isCompleted) {
    const hierarchyItem = document.querySelector(SELECTORS.hierarchyItem(itemId));
    if (hierarchyItem) {
      hierarchyItem.classList.toggle("completed", isCompleted);
      hierarchyItem.setAttribute("data-item-completed", String(isCompleted));
      const nameElement = hierarchyItem.querySelector(SELECTORS.hierarchyItemName);
      if (nameElement) {
        nameElement.classList.toggle("line-through", isCompleted);
      }
    }
    const tableRow = document.querySelector(SELECTORS.tableRow(itemId));
    if (tableRow) {
      tableRow.classList.toggle("completed", isCompleted);
      const tableName = tableRow.querySelector(SELECTORS.tableItemName);
      if (tableName) {
        tableName.classList.toggle("line-through", isCompleted);
        tableName.classList.toggle("opacity-60", isCompleted);
      }
    }
  }
  async function deleteItem(itemId, skipConfirm = false) {
    if (!skipConfirm && !confirm("Удалить этот товар?")) {
      return;
    }
    const state2 = getState$1();
    const pglite$1 = pglite.getPGliteManager();
    const item = state2.currentItems.find((i) => i.id === itemId);
    if (!item) {
      throw new Error("Item not found in state");
    }
    try {
      if (pglite.isPGliteEnabled() && pglite$1.isReady() && item.temp_id) {
        await pglite$1.deleteItem(item.temp_id);
        debugLog("[LIST_OPS] Item deleted in PGlite", { temp_id: item.temp_id });
        if (state2.currentListId) {
          await loadShoppingListItems(state2.currentListId);
        }
      } else {
        const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
          method: "DELETE",
          credentials: "same-origin"
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        debugLog("[LIST_OPS] Item deleted via API", { id: itemId });
        if (state2.currentListId) {
          await loadShoppingListItems(state2.currentListId);
        }
      }
      showToast("Товар удален", "success");
      refreshUI();
    } catch (error) {
      console.error("[LIST_OPS] Error deleting item:", error);
      showToast("Ошибка удаления товара", "error");
    }
  }
  async function deleteMultipleItems(itemIds) {
    if (itemIds.length === 0) return;
    if (!confirm(`Удалить выбранные товары (${itemIds.length})?`)) {
      return;
    }
    const state2 = getState$1();
    const pglite$1 = pglite.getPGliteManager();
    try {
      if (pglite.isPGliteEnabled() && pglite$1.isReady()) {
        const itemsToDelete = state2.currentItems.filter((item) => itemIds.includes(item.id));
        const tempIds = itemsToDelete.map((item) => item.temp_id).filter(Boolean);
        if (tempIds.length !== itemIds.length) {
          throw new Error("Some items missing temp_id, cannot delete via PGlite");
        }
        await Promise.all(tempIds.map((temp_id) => pglite$1.deleteItem(temp_id)));
        debugLog("[LIST_OPS] Bulk deleted items in PGlite", { count: tempIds.length });
        if (state2.currentListId) {
          await loadShoppingListItems(state2.currentListId);
        }
      } else {
        const promises = itemIds.map(
          (id) => fetch(`/api/v1/shopping-list-items/${id}`, {
            method: "DELETE",
            credentials: "same-origin"
          })
        );
        await Promise.all(promises);
        debugLog("[LIST_OPS] Bulk deleted items via API", { count: itemIds.length });
        if (state2.currentListId) {
          await loadShoppingListItems(state2.currentListId);
        }
      }
      showToast(`Удалено товаров: ${itemIds.length}`, "success");
      refreshUI();
    } catch (error) {
      console.error("[LIST_OPS] Error deleting multiple items:", error);
      showToast("Ошибка удаления товаров", "error");
    }
  }
  async function updateItemsCache() {
    const state2 = getState$1();
    if (state2.db && state2.currentListId) {
      const CACHE_KEY = `shopping_list_items_${state2.currentListId}`;
      const CACHE_TTL = 86400;
      try {
        await state2.db.setCache(CACHE_KEY, state2.currentItems, CACHE_TTL);
        debugLog("[ListsManager] Items cache updated");
      } catch (error) {
        console.error("[ListsManager] Error updating items cache:", error);
      }
    }
  }
  let autocompleteTimer = null;
  let currentSuggestions = [];
  function setupProductAutocomplete() {
    const input = document.getElementById("item-product-name");
    if (!input) {
      return;
    }
    const handler = () => {
      handleProductInput(input.value);
    };
    input.addEventListener("input", handler);
    input.addEventListener("keyup", handler);
    input.addEventListener("compositionend", handler);
    input._autocompleteInitialized = true;
    setupSuggestionsClickHandler();
    debugLog("[ListsManager] Product autocomplete initialized");
  }
  function setupSuggestionsClickHandler() {
    const dropdown = document.getElementById("product-suggestions-dropdown");
    if (!dropdown || dropdown._clickHandlerInitialized) {
      return;
    }
    const handleSelection = (event, isTouchEvent = false) => {
      const suggestionItem = event.target.closest(".suggestion-item");
      if (!suggestionItem) return;
      if (isTouchEvent) {
        event.preventDefault();
      }
      const index = parseInt(suggestionItem.dataset.index, 10);
      if (!isNaN(index)) {
        selectSuggestion(index);
      }
    };
    dropdown.addEventListener("touchstart", (event) => {
      handleSelection(event, true);
    }, { passive: false });
    dropdown.addEventListener("click", (event) => {
      handleSelection(event, false);
    });
    dropdown._clickHandlerInitialized = true;
    debugLog("[ListsManager] Suggestions click/touch handlers initialized (iOS-compatible)");
  }
  function handleProductInput(value) {
    if (autocompleteTimer) {
      clearTimeout(autocompleteTimer);
    }
    if (!value || value.length < 2) {
      hideProductSuggestions();
      return;
    }
    autocompleteTimer = window.setTimeout(() => {
      showProductSuggestions(value);
    }, 300);
  }
  async function showProductSuggestions(query) {
    if (query.length < 2) {
      hideProductSuggestions();
      return;
    }
    const state2 = getState$1();
    try {
      let suggestions = [];
      if (isOnline()) {
        const params = new URLSearchParams({
          q: query,
          limit: "10"
        });
        if (state2.currentListId) {
          params.append("shopping_list_id", String(state2.currentListId));
          params.append("include_deleted", "true");
        }
        const url = `/api/v1/shopping-list-items/products/suggest?${params}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          suggestions = data.suggestions || [];
          if (state2.db && suggestions.length > 0) {
            await cacheProductSuggestions(
              suggestions.filter((s) => !s.is_deleted)
            );
          }
        }
      } else {
        suggestions = await searchCachedSuggestions(query);
      }
      renderSuggestionsDropdown(suggestions);
    } catch (error) {
      console.error("[Autocomplete] Error fetching suggestions:", error);
      if (state2.db) {
        const cached = await searchCachedSuggestions(query);
        if (cached.length > 0) {
          renderSuggestionsDropdown(cached);
        }
      }
    }
  }
  function renderSuggestionsDropdown(suggestions) {
    const dropdown = document.getElementById("product-suggestions-dropdown");
    if (!dropdown) return;
    if (!suggestions || suggestions.length === 0) {
      hideProductSuggestions();
      return;
    }
    const html = suggestions.map((s, index) => `
    <div class="suggestion-item px-3 py-2 hover:bg-base-200 cursor-pointer ${s.is_deleted ? "bg-base-200/50 border-l-2 border-warning" : ""}"
         data-index="${index}"
         data-is-deleted="${s.is_deleted || false}"
         data-item-id="${s.id || ""}">
      <div class="flex items-center gap-2">
        <span class="font-medium text-sm">${escapeHtml(s.product_name)}</span>
        ${s.is_deleted ? '<span class="badge badge-warning badge-xs">восстановить</span>' : ""}
      </div>
      <div class="text-xs text-base-content/60">
        ${s.store_name ? `<span class="mr-2">🏪 ${escapeHtml(s.store_name)}</span>` : ""}
        ${s.product_group_name ? `<span>📦 ${escapeHtml(s.product_group_name)}</span>` : ""}
        ${s.is_deleted && s.quantity ? `<span class="ml-2">📊 ${s.quantity}${s.unit || ""}</span>` : ""}
      </div>
    </div>
  `).join("");
    dropdown.innerHTML = html;
    const input = document.getElementById("item-product-name");
    if (input) {
      const inputRect = input.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      let top = inputRect.bottom + 4;
      let left = inputRect.left;
      let width = inputRect.width;
      const maxHeight = 240;
      if (top + maxHeight > viewportHeight) {
        top = inputRect.top - maxHeight - 4;
      }
      dropdown.style.top = `${top}px`;
      dropdown.style.left = `${left}px`;
      dropdown.style.width = `${width}px`;
    }
    dropdown.classList.remove("hidden");
    currentSuggestions = suggestions;
    debugLog("[ListsManager] Showing", suggestions.length, "suggestions");
  }
  function hideProductSuggestions() {
    const dropdown = document.getElementById("product-suggestions-dropdown");
    if (dropdown) {
      dropdown.classList.add("hidden");
      dropdown.innerHTML = "";
    }
    currentSuggestions = [];
  }
  async function selectSuggestion(index) {
    const suggestion = currentSuggestions?.[index];
    if (!suggestion) return;
    if (suggestion.is_deleted && suggestion.id) {
      await restoreDeletedItem(suggestion);
      return;
    }
    fillFormFromSuggestion(suggestion);
    hideProductSuggestions();
    debugLog("[ListsManager] Selected suggestion:", suggestion.product_name);
  }
  async function restoreDeletedItem(suggestion) {
    if (!suggestion.id) {
      console.error("[ListsManager] Cannot restore: no item ID");
      return;
    }
    try {
      debugLog("[ListsManager] Restoring deleted item:", suggestion.id, suggestion.product_name);
      const response = await fetch(`/api/v1/shopping-list-items/${suggestion.id}/restore`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin"
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      const restoredItem = await response.json();
      hideProductSuggestions();
      const modal = document.getElementById("item-modal");
      if (modal) modal.close();
      showToast(`Товар "${suggestion.product_name}" восстановлен`, "success");
      const state2 = getState$1();
      if (state2.currentListId) {
        await loadShoppingListItems(state2.currentListId);
      }
      debugLog("[ListsManager] Restored item:", restoredItem);
    } catch (error) {
      console.error("[ListsManager] Error restoring item:", error);
      showToast(`Ошибка восстановления: ${error.message}`, "error");
      fillFormFromSuggestion(suggestion);
      hideProductSuggestions();
    }
  }
  function fillFormFromSuggestion(suggestion) {
    const state2 = getState$1();
    const productNameInput = document.getElementById("item-product-name");
    const storeSelect = document.getElementById("item-store");
    const productGroupSelect = document.getElementById("item-product-group");
    const quantityInput = document.getElementById("item-quantity");
    const unitSelect = document.getElementById("item-unit");
    const commentInput = document.getElementById("item-comment");
    if (productNameInput) {
      productNameInput.value = suggestion.product_name;
    }
    if (suggestion.store_id) {
      if (state2.choicesInstances?.store) {
        state2.choicesInstances.store.setChoiceByValue(String(suggestion.store_id));
      } else if (storeSelect) {
        storeSelect.value = String(suggestion.store_id);
      }
    }
    if (suggestion.product_group_id) {
      if (state2.choicesInstances?.productGroup) {
        state2.choicesInstances.productGroup.setChoiceByValue(String(suggestion.product_group_id));
      } else if (productGroupSelect) {
        productGroupSelect.value = String(suggestion.product_group_id);
      }
    }
    if (suggestion.quantity && quantityInput) {
      quantityInput.value = String(suggestion.quantity);
    }
    if (suggestion.unit && unitSelect) {
      unitSelect.value = suggestion.unit;
    }
    if (suggestion.comment && commentInput) {
      commentInput.value = suggestion.comment;
    }
    console.log("[AUTOCOMPLETE] Form filled from suggestion", {
      productName: suggestion.product_name,
      storeId: suggestion.store_id,
      quantity: suggestion.quantity
    });
    const productName = productNameInput?.value?.trim();
    const storeId = state2.choicesInstances?.store?.getValue(true) || storeSelect?.value;
    if (productName && storeId && state2.currentListId) {
      console.log("[AUTOCOMPLETE] Triggering duplicate check after autocomplete selection");
      if (typeof window.listsManager?.searchDuplicate === "function") {
        window.listsManager.searchDuplicate(productName, parseInt(storeId)).then((duplicate) => {
          if (duplicate) {
            console.log("[AUTOCOMPLETE] Duplicate found after autocomplete, showing warning");
            if (typeof window.listsManager?.showDuplicateWarning === "function") {
              window.listsManager.showDuplicateWarning(duplicate);
            }
            if (quantityInput?.value && typeof window.listsManager?.updateFutureQuantity === "function") {
              console.log("[AUTOCOMPLETE] Quantity already filled, updating future quantity");
              window.listsManager.updateFutureQuantity();
            }
          } else {
            console.log("[AUTOCOMPLETE] No duplicate found after autocomplete");
          }
        }).catch((error) => {
          console.error("[AUTOCOMPLETE] Error checking duplicate after autocomplete:", error);
        });
      }
    }
  }
  async function cacheProductSuggestions(suggestions) {
    const state2 = getState$1();
    if (!state2.db) return;
    try {
      const CACHE_KEY = "product_suggestions";
      const CACHE_TTL = 86400;
      let cached = await state2.db.getCache(CACHE_KEY) || [];
      const existing = new Map(
        cached.map((s) => [`${s.product_name}_${s.store_id}`, s])
      );
      suggestions.forEach((s) => {
        const key = `${s.product_name}_${s.store_id}`;
        existing.set(key, s);
      });
      cached = Array.from(existing.values());
      if (cached.length > 500) {
        cached = cached.slice(-500);
      }
      await state2.db.setCache(CACHE_KEY, cached, CACHE_TTL);
      debugLog("[Autocomplete] Cached", suggestions.length, "suggestions");
    } catch (error) {
      console.error("[Autocomplete] Error caching suggestions:", error);
    }
  }
  async function searchCachedSuggestions(query) {
    const state2 = getState$1();
    if (!state2.db) return [];
    try {
      const CACHE_KEY = "product_suggestions";
      const cached = await state2.db.getCache(CACHE_KEY) || [];
      const lowerQuery = query.toLowerCase();
      const matches = cached.filter(
        (s) => s.product_name.toLowerCase().includes(lowerQuery)
      );
      matches.sort((a, b) => {
        const aStarts = a.product_name.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.product_name.toLowerCase().startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      });
      return matches.slice(0, 10);
    } catch (error) {
      console.error("[Autocomplete] Error searching cached suggestions:", error);
      return [];
    }
  }
  function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function openCreateListModal() {
    const modal = document.getElementById("create-list-modal");
    const form = document.getElementById("create-list-form");
    if (form) form.reset();
    if (modal) modal.showModal();
  }
  function closeCreateListModal() {
    const modal = document.getElementById("create-list-modal");
    if (modal) modal.close();
  }
  async function handleCreateList(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = {
      name: formData.get("name"),
      description: formData.get("description") || null
    };
    try {
      const response = await fetch("/api/v1/shopping-lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      showToast("Список создан", "success");
      closeCreateListModal();
      await loadShoppingLists();
      await renderDetailView(result.id);
    } catch (error) {
      console.error("[ListsManager] Error creating list:", error);
      showToast("Ошибка создания списка", "error");
    }
  }
  function openAddItemModal$1() {
    const modal = document.getElementById("item-modal");
    const form = document.getElementById("item-form");
    if (form) form.reset();
    const itemIdInput = document.getElementById("item-id");
    if (itemIdInput) itemIdInput.value = "";
    const modalTitle = document.getElementById("item-modal-title");
    if (modalTitle) modalTitle.textContent = "📝 Добавить товар";
    initStoreChoices();
    initProductGroupChoices();
    const quantityInput = document.getElementById("item-quantity");
    if (quantityInput) {
      quantityInput.step = "1";
    }
    setupProductAutocomplete();
    initializeDuplicateDetection();
    hideDuplicateWarning();
    const deleteBtn = document.getElementById("item-modal-delete-btn");
    if (deleteBtn) {
      deleteBtn.classList.add("hidden");
      debugLog("[MODAL_ADD] Delete button hidden (new item mode)");
    }
    if (modal) modal.showModal();
  }
  function openEditItemModal$1(itemId) {
    const state2 = getState$1();
    const item = state2.currentItems.find((i) => i.id === itemId);
    if (!item) {
      showToast("Товар не найден", "error");
      return;
    }
    const modal = document.getElementById("item-modal");
    const itemIdInput = document.getElementById("item-id");
    const productNameInput = document.getElementById("item-product-name");
    const quantityInput = document.getElementById("item-quantity");
    const unitSelect = document.getElementById("item-unit");
    const commentInput = document.getElementById("item-comment");
    const modalTitle = document.getElementById("item-modal-title");
    if (itemIdInput) itemIdInput.value = String(item.id);
    if (productNameInput) productNameInput.value = item.product_name;
    if (quantityInput) quantityInput.value = item.quantity !== null ? String(item.quantity) : "";
    if (unitSelect) unitSelect.value = item.unit || "";
    if (commentInput) commentInput.value = item.notes || "";
    if (modalTitle) modalTitle.textContent = "✏️ Редактировать товар";
    const deleteBtn = document.getElementById("item-modal-delete-btn");
    if (deleteBtn) {
      deleteBtn.classList.remove("hidden");
      debugLog("[MODAL_EDIT] Delete button shown", { itemId });
    }
    debugLog("[LISTS_MODAL] Quantity input configured for integers only (step=1)");
    initStoreChoices();
    initProductGroupChoices();
    if (state2.choicesInstances?.store && item.store_id) {
      state2.choicesInstances.store.setChoiceByValue(item.store_id.toString());
    }
    if (state2.choicesInstances?.productGroup && item.product_group_id) {
      state2.choicesInstances.productGroup.setChoiceByValue(item.product_group_id.toString());
    }
    setupProductAutocomplete();
    if (modal) modal.showModal();
  }
  function closeItemModal$1() {
    dropdownZIndexManager.reset();
    const hierarchyView = window.hierarchyView;
    if (hierarchyView?.swipeHandler) {
      const swipeHandler = hierarchyView.swipeHandler;
      if (swipeHandler.modalOpenedBySwipe) {
        const itemId = swipeHandler.modalOpenedBySwipe;
        const swipedElement = document.querySelector(
          `.hierarchy-item[data-item-id="${itemId}"]`
        );
        if (swipedElement) {
          const contentElement = swipedElement.querySelector(".hierarchy-item-content");
          const hadTransform = contentElement?.style.transform || "none";
          debugLog("[MODAL_CLOSE] Cleaning up swipe state", {
            itemId,
            hadTransform,
            timestamp: Date.now(),
            source: "closeItemModal"
          });
          swipeHandler.resetSwipe(itemId, swipedElement);
          const afterTransform = contentElement?.style.transform || "none";
          debugLog("[MODAL_CLOSE] Swipe state cleaned", {
            itemId,
            beforeTransform: hadTransform,
            afterTransform,
            cleared: afterTransform === "translateX(0px)" || afterTransform === "" || afterTransform === "none"
          });
        } else {
          console.warn("[MODAL_CLOSE] Swiped element not found in DOM", { itemId });
        }
        swipeHandler.modalOpenedBySwipe = null;
        debugLog("[MODAL_CLOSE] Swipe flag cleared");
      } else {
        debugLog("[MODAL_CLOSE] Modal not opened by swipe, no cleanup needed");
      }
    } else {
      debugLog("[MODAL_CLOSE] SwipeHandler not available (desktop or hierarchy view not initialized)");
    }
    const modal = document.getElementById("item-modal");
    if (modal) {
      debugLog("[MODAL_CLOSE] Closing item modal");
      modal.close();
    } else {
      console.error("[MODAL_CLOSE] Modal element not found");
    }
  }
  async function handleDeleteFromModal() {
    const itemIdInput = document.getElementById("item-id");
    if (!itemIdInput) return;
    const itemId = parseInt(itemIdInput.value);
    if (!itemId) {
      console.error("[DELETE_MODAL] No item ID found");
      return;
    }
    debugLog("[DELETE_MODAL] Delete initiated", {
      itemId,
      timestamp: Date.now(),
      source: "modal_button"
    });
    closeItemModal$1();
    await deleteItem(itemId);
    debugLog("[DELETE_MODAL] Delete completed", { itemId });
  }
  async function handleSaveItem(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const itemId = formData.get("item_id");
    const isEdit = itemId !== null && itemId !== "";
    const storeId = formData.get("store_id");
    const productGroupId = formData.get("product_group_id");
    const productName = formData.get("product_name");
    const quantityStr = formData.get("quantity");
    const unit = formData.get("unit");
    const comment = formData.get("comment");
    if (!storeId || !productGroupId || !productName) {
      debugLog("[ITEM_SAVE] Missing required fields", {
        storeId: !!storeId,
        productGroupId: !!productGroupId,
        productName: !!productName
      });
      showToast("Заполните обязательные поля", "error");
      return;
    }
    const data = {
      store_id: parseInt(storeId, 10),
      product_group_id: parseInt(productGroupId, 10),
      product_name: productName,
      quantity: quantityStr ? parseFloat(quantityStr) : null,
      unit: unit || null,
      comment: comment || null
    };
    debugLog("[ITEM_SAVE] Starting save", {
      isEdit,
      itemId,
      data
    });
    try {
      if (isEdit) {
        await updateItem(parseInt(itemId, 10), data);
        showToast("Товар обновлён", "success");
      } else {
        await createItem(data);
        showToast("Товар добавлен", "success");
      }
      closeItemModal$1();
      debugLog("[ITEM_SAVE] Save successful", { isEdit, itemId });
    } catch (error) {
      console.error("[ITEM_SAVE] Error:", error);
      showToast("Ошибка сохранения товара", "error");
    }
  }
  function openDeleteListModal$1(listId, listName) {
    window.deleteListId = listId;
    const nameElement = document.getElementById("delete-list-name");
    if (nameElement) nameElement.textContent = listName;
    const modal = document.getElementById("delete-list-modal");
    if (modal) modal.showModal();
    debugLog("[DeleteList] Modal opened for list:", listId);
  }
  function closeDeleteListModal() {
    const modal = document.getElementById("delete-list-modal");
    if (modal) modal.close();
    window.deleteListId = void 0;
    debugLog("[DeleteList] Modal closed");
  }
  async function confirmDeleteList() {
    const listId = window.deleteListId;
    if (!listId) {
      showToast("Ошибка: список не выбран", "error");
      return;
    }
    try {
      closeDeleteListModal();
      showToast("Удаление списка...", "info");
      debugLog("[DeleteList] Deleting list:", listId);
      const response = await fetch(`/api/v1/shopping-lists/${listId}`, {
        method: "DELETE",
        credentials: "same-origin"
      });
      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const error = await response.json();
          errorDetail = error.detail || errorDetail;
        } catch (e) {
        }
        if (response.status === 403) {
          throw new Error("Только создатель списка может его удалить");
        }
        throw new Error(errorDetail);
      }
      showToast("✅ Список успешно удален", "success");
      debugLog("[DeleteList] List deleted successfully:", listId);
      await renderLandingView();
    } catch (error) {
      console.error("[DeleteList] Error deleting list:", error);
      showToast(`❌ Ошибка удаления: ${error.message}`, "error");
    }
  }
  const dropdownZIndexManager = {
    /** Counter for open dropdowns */
    count: 0,
    /**
     * Handle dropdown open event - add z-index fix class to modal
     */
    open() {
      this.count++;
      const modal = document.getElementById("item-modal");
      if (modal) {
        modal.classList.add("store-dropdown-open");
        debugLog("[LISTS_MODAL] Dropdown opened, store-dropdown-open class added", {
          openCount: this.count
        });
      }
    },
    /**
     * Handle dropdown close event - remove z-index fix class when all dropdowns closed
     */
    close() {
      this.count = Math.max(0, this.count - 1);
      if (this.count === 0) {
        const modal = document.getElementById("item-modal");
        if (modal) {
          modal.classList.remove("store-dropdown-open");
          debugLog("[LISTS_MODAL] All dropdowns closed, store-dropdown-open class removed");
        }
      } else {
        debugLog("[LISTS_MODAL] Dropdown closed, other still open", { openCount: this.count });
      }
    },
    /**
     * Reset state - used when modal closes to ensure clean state
     */
    reset() {
      this.count = 0;
      const modal = document.getElementById("item-modal");
      if (modal) {
        modal.classList.remove("store-dropdown-open");
        debugLog("[LISTS_MODAL] Modal closing, store-dropdown-open class removed");
      }
    }
  };
  function setupDropdownZIndexHandlers(choicesInstance, dropdownName) {
    if (!choicesInstance?.passedElement?.element) {
      console.warn(`[LISTS_MODAL] Cannot setup z-index handlers for ${dropdownName} - no element`);
      return;
    }
    const element = choicesInstance.passedElement.element;
    element.addEventListener("showDropdown", () => {
      debugLog(`[LISTS_MODAL] ${dropdownName} showDropdown event`);
      dropdownZIndexManager.open();
    });
    element.addEventListener("hideDropdown", () => {
      debugLog(`[LISTS_MODAL] ${dropdownName} hideDropdown event`);
      dropdownZIndexManager.close();
    });
    debugLog(`[LISTS_MODAL] Z-index event handlers attached for ${dropdownName}`);
  }
  function initStoreChoices() {
    const state2 = getState$1();
    const selectElement = document.getElementById("item-store");
    if (!selectElement) {
      console.warn("[Choices] Store select element not found");
      return;
    }
    if (state2.choicesInstances?.store) {
      state2.choicesInstances.store.destroy();
      delete state2.choicesInstances.store;
    }
    const stores = state2.stores || [];
    selectElement.innerHTML = '<option value="">Выберите магазин</option>' + stores.map((store) => `<option value="${store.id}">${store.name}</option>`).join("");
    try {
      if (typeof Choices !== "undefined") {
        const choices = new Choices(selectElement, {
          searchEnabled: stores.length > 5,
          shouldSort: false,
          itemSelectText: "",
          noResultsText: "Ничего не найдено",
          noChoicesText: "Нет вариантов",
          placeholderValue: "Выберите магазин"
        });
        if (!state2.choicesInstances) {
          updateState$1({ choicesInstances: {} });
        }
        state2.choicesInstances.store = choices;
        setupDropdownZIndexHandlers(choices, "store");
      }
    } catch (error) {
      console.error("[Choices] Error initializing store choices:", error);
    }
  }
  function initProductGroupChoices() {
    const state2 = getState$1();
    const selectElement = document.getElementById("item-product-group");
    if (!selectElement) {
      console.warn("[Choices] Product group select element not found");
      return;
    }
    if (state2.choicesInstances?.productGroup) {
      state2.choicesInstances.productGroup.destroy();
      delete state2.choicesInstances.productGroup;
    }
    const groups = state2.productGroups || [];
    selectElement.innerHTML = '<option value="">Выберите группу</option>' + buildProductGroupOptions(groups);
    try {
      if (typeof Choices !== "undefined") {
        const choices = new Choices(selectElement, {
          searchEnabled: groups.length > 5,
          shouldSort: false,
          itemSelectText: "",
          noResultsText: "Ничего не найдено",
          noChoicesText: "Нет вариантов",
          placeholderValue: "Выберите группу"
        });
        if (!state2.choicesInstances) {
          updateState$1({ choicesInstances: {} });
        }
        state2.choicesInstances.productGroup = choices;
        setupDropdownZIndexHandlers(choices, "productGroup");
      }
    } catch (error) {
      console.error("[Choices] Error initializing product group choices:", error);
    }
  }
  function buildProductGroupOptions(groups) {
    const groupMap = {};
    const rootGroups = [];
    groups.forEach((g) => {
      groupMap[g.id] = { ...g, children: [] };
    });
    groups.forEach((g) => {
      if (g.parent_id && groupMap[g.parent_id]) {
        groupMap[g.parent_id].children.push(groupMap[g.id]);
      } else {
        rootGroups.push(groupMap[g.id]);
      }
    });
    function renderGroup(group, level) {
      const indent = "&nbsp;&nbsp;".repeat(level);
      let html = `<option value="${group.id}">${indent}${group.name}</option>`;
      if (group.children && group.children.length > 0) {
        group.children.forEach((child) => {
          html += renderGroup(child, level + 1);
        });
      }
      return html;
    }
    return rootGroups.map((g) => renderGroup(g, 0)).join("");
  }
  function initializeDuplicateDetection() {
    const state2 = getState$1();
    const productInput = document.getElementById("item-product-name");
    const storeSelect = document.getElementById("item-store");
    const quantityInput = document.getElementById("item-quantity");
    if (!productInput || !storeSelect) {
      console.warn("[LISTS] Duplicate detection inputs not found");
      return;
    }
    if (state2.debouncedSearch) {
      productInput.removeEventListener("input", state2.debouncedSearch);
      storeSelect.removeEventListener("change", state2.debouncedSearch);
      debugLog("[LISTS] Removed old duplicate detection listeners");
    }
    if (state2.quantityChangeHandler && quantityInput) {
      quantityInput.removeEventListener("input", state2.quantityChangeHandler);
      debugLog("[LISTS] Removed old quantity listener");
    }
    let searchTimeout;
    const debouncedSearch = () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const productName = productInput.value.trim();
        const storeId = parseInt(storeSelect.value);
        if (productName && storeId && state2.currentListId) {
          const duplicate = await searchDuplicate(productName, storeId);
          if (duplicate) {
            showDuplicateWarning(duplicate);
          } else {
            hideDuplicateWarning();
          }
        } else {
          hideDuplicateWarning();
        }
      }, 500);
    };
    productInput.addEventListener("input", debouncedSearch);
    storeSelect.addEventListener("change", debouncedSearch);
    if (quantityInput) {
      const quantityChangeHandler = () => {
        debugLog("[FUTURE_QTY] Quantity input changed, updating future quantity display");
        updateFutureQuantity();
      };
      quantityInput.addEventListener("input", quantityChangeHandler);
      debugLog("[LISTS] Future quantity listener initialized");
      updateState$1({ quantityChangeHandler });
    } else {
      console.warn("[LISTS] Quantity input not found (id=item-quantity)");
    }
    updateState$1({ debouncedSearch });
    debugLog("[LISTS] Duplicate detection initialized");
  }
  async function searchDuplicate(productName, storeId) {
    const state2 = getState$1();
    if (!productName || !storeId || !state2.currentListId) {
      return null;
    }
    try {
      debugLog("[DUPLICATE_SEARCH] Searching for duplicate", {
        productName,
        storeId,
        listId: state2.currentListId
      });
      const url = new URL("/api/v1/shopping-list-items/check-duplicate", window.location.origin);
      url.searchParams.set("shopping_list_id", String(state2.currentListId));
      url.searchParams.set("product_name", productName.trim());
      url.searchParams.set("store_id", String(storeId));
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin"
      });
      if (!response.ok) {
        console.error("[DUPLICATE_SEARCH] API error", { status: response.status });
        return null;
      }
      const data = await response.json();
      if (data && data.id) {
        console.warn("[DUPLICATE_SEARCH] Duplicate found", {
          itemId: data.id,
          quantity: data.quantity,
          unit: data.unit
        });
        return data;
      }
      debugLog("[DUPLICATE_SEARCH] No duplicate found");
      return null;
    } catch (error) {
      console.error("[DUPLICATE_SEARCH] Error searching duplicate", { error: error.message });
      return null;
    }
  }
  function showDuplicateWarning(duplicateItem) {
    const container = document.getElementById("duplicate-warning-container");
    const details = document.getElementById("duplicate-details");
    if (!container || !details) {
      console.warn("[DUPLICATE_SEARCH] Warning UI elements not found");
      return;
    }
    let detailsText = `<strong>${duplicateItem.product_name}</strong>`;
    if (duplicateItem.quantity && duplicateItem.unit) {
      detailsText += ` - ${duplicateItem.quantity} ${duplicateItem.unit}`;
    } else if (duplicateItem.quantity) {
      detailsText += ` - количество: ${duplicateItem.quantity}`;
    }
    if (duplicateItem.comment) {
      detailsText += ` <span class="text-gray-600">(${duplicateItem.comment})</span>`;
    }
    details.innerHTML = detailsText;
    container.classList.remove("hidden");
    updateState$1({ currentDuplicateItem: duplicateItem });
    updateFutureQuantity();
    debugLog("[DUPLICATE_SEARCH] Warning displayed", { itemId: duplicateItem.id });
  }
  function hideDuplicateWarning() {
    const container = document.getElementById("duplicate-warning-container");
    if (container) {
      container.classList.add("hidden");
    }
    updateState$1({ currentDuplicateItem: null });
  }
  function updateFutureQuantity() {
    const state2 = getState$1();
    const futureQtyElement = document.getElementById("future-quantity");
    if (!futureQtyElement || !state2.currentDuplicateItem) {
      return;
    }
    const quantityInput = document.getElementById("item-quantity");
    const newQuantity = quantityInput ? parseFloat(quantityInput.value) : 0;
    if (!newQuantity) {
      futureQtyElement.textContent = "";
      return;
    }
    const existingQuantity = state2.currentDuplicateItem.quantity || 0;
    const futureQuantity = existingQuantity + newQuantity;
    const unit = state2.currentDuplicateItem.unit || "";
    futureQtyElement.textContent = ` → ${futureQuantity} ${unit}`;
    debugLog("[FUTURE_QTY] Updated", {
      existing: existingQuantity,
      new: newQuantity,
      future: futureQuantity
    });
  }
  const modalManager = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    closeCreateListModal,
    closeDeleteListModal,
    closeItemModal: closeItemModal$1,
    confirmDeleteList,
    handleCreateList,
    handleDeleteFromModal,
    handleSaveItem,
    initProductGroupChoices,
    initStoreChoices,
    openAddItemModal: openAddItemModal$1,
    openCreateListModal,
    openDeleteListModal: openDeleteListModal$1,
    openEditItemModal: openEditItemModal$1
  });
  class SwipeHandler {
    // 50% of item width
    constructor() {
      this.activeSwipedItemId = null;
      this.modalOpenedBySwipe = null;
      this.startX = null;
      this.startY = null;
      this.currentX = null;
      this.currentY = null;
      this.isDragging = false;
      this.hasMoved = false;
      this.SWIPE_THRESHOLD = 0.5;
    }
    /**
     * Handle touch start event
     */
    handleTouchStart(e, itemId, itemElement) {
      try {
        if (itemElement.classList.contains("completed")) {
          return;
        }
        if (!e.touches || e.touches.length === 0) {
          console.warn("[SwipeHandler] No touch points detected");
          return;
        }
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.currentX = this.startX;
        this.currentY = this.startY;
        this.isDragging = true;
        this.hasMoved = false;
        if (this.activeSwipedItemId && this.activeSwipedItemId !== itemId) {
          this.closeAllSwipes();
        }
        const contentElement = itemElement.querySelector(".hierarchy-item-content");
        if (contentElement) {
          contentElement.classList.add("swiping");
        }
      } catch (error) {
        console.error("[SwipeHandler] Error in handleTouchStart:", error);
        this.isDragging = false;
        this.hasMoved = false;
      }
    }
    /**
     * Handle touch move event
     */
    handleTouchMove(e, _itemId, itemElement) {
      try {
        if (!this.isDragging) return;
        if (!e.touches || e.touches.length === 0) {
          this.isDragging = false;
          return;
        }
        this.currentX = e.touches[0].clientX;
        this.currentY = e.touches[0].clientY;
        const deltaX = this.currentX - (this.startX ?? 0);
        const deltaY = this.currentY - (this.startY ?? 0);
        const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (movementDistance > 5) {
          this.hasMoved = true;
        }
        const contentElement = itemElement.querySelector(".hierarchy-item-content");
        if (!contentElement) return;
        if (deltaX > 0) {
          if (itemElement.classList.contains("swiped")) {
            const swipeDistance2 = Math.min(deltaX, itemElement.offsetWidth * this.SWIPE_THRESHOLD);
            const targetTransform = -(itemElement.offsetWidth * this.SWIPE_THRESHOLD - swipeDistance2);
            contentElement.style.transform = `translateX(${targetTransform}px)`;
          } else {
            contentElement.style.removeProperty("transform");
          }
          return;
        }
        const itemWidth = itemElement.offsetWidth;
        const maxSwipe = itemWidth * this.SWIPE_THRESHOLD;
        const swipeDistance = Math.max(deltaX, -maxSwipe);
        contentElement.style.transform = `translateX(${swipeDistance}px)`;
      } catch (error) {
        console.error("[SwipeHandler] Error in handleTouchMove:", error);
        this.isDragging = false;
      }
    }
    /**
     * Handle touch end event
     */
    handleTouchEnd(_e, itemId, itemElement) {
      try {
        if (!this.isDragging) return;
        this.isDragging = false;
        const deltaX = (this.currentX ?? 0) - (this.startX ?? 0);
        const itemWidth = itemElement.offsetWidth;
        const threshold = itemWidth * this.SWIPE_THRESHOLD;
        const contentElement = itemElement.querySelector(".hierarchy-item-content");
        if (!contentElement) return;
        contentElement.classList.remove("swiping");
        if (!this.hasMoved) {
          this.resetSwipe(itemId, itemElement);
          this.hasMoved = false;
          return;
        }
        if (deltaX < 0 && Math.abs(deltaX) >= threshold) {
          this.openEditModal(itemId, itemElement);
        } else if (deltaX > 0 && Math.abs(deltaX) >= threshold) {
          this.closeModalIfOpen(itemId);
        } else {
          this.resetSwipe(itemId, itemElement);
        }
        this.hasMoved = false;
      } catch (error) {
        console.error("[SwipeHandler] Error in handleTouchEnd:", error);
        this.isDragging = false;
        this.hasMoved = false;
      }
    }
    /**
     * Open edit modal (called after successful left swipe)
     */
    openEditModal(itemId, itemElement) {
      this.resetSwipe(itemId, itemElement);
      this.modalOpenedBySwipe = itemId;
      if (typeof openEditItemModal === "function") {
        openEditItemModal(itemId);
      } else {
        console.error("[SWIPE] openEditItemModal function not found");
      }
    }
    /**
     * Close modal if currently open (for right swipe)
     */
    closeModalIfOpen(itemId) {
      const modal = document.getElementById("item-modal");
      if (modal && modal.open && this.modalOpenedBySwipe === itemId) {
        if (typeof closeItemModal === "function") {
          closeItemModal();
          this.modalOpenedBySwipe = null;
        }
      }
    }
    /**
     * Reset swipe visual state (snap back to original position)
     *
     * CRITICAL: Must remove inline transform completely, not just set to 'translateX(0)'.
     * Reason: Any transform value creates a new containing block, causing
     * absolutely positioned .swipe-indicator to position relative to content
     * instead of .hierarchy-item (breaks right: 0.75rem positioning).
     */
    resetSwipe(itemId, itemElement) {
      const contentElement = itemElement.querySelector(".hierarchy-item-content");
      if (contentElement) {
        contentElement.classList.remove("swiping");
        void contentElement.offsetHeight;
        contentElement.style.removeProperty("transform");
      }
      itemElement.classList.remove("swiped");
      if (this.activeSwipedItemId === itemId) {
        this.activeSwipedItemId = null;
      }
    }
    /**
     * Close all open swipes
     */
    closeAllSwipes() {
      if (this.activeSwipedItemId) {
        const swipedElement = document.querySelector(
          `.hierarchy-item[data-item-id="${this.activeSwipedItemId}"]`
        );
        if (swipedElement) {
          this.resetSwipe(this.activeSwipedItemId, swipedElement);
        }
      }
    }
    /**
     * Setup event listeners for all items
     */
    setupSwipeHandlers() {
      const items = document.querySelectorAll(".hierarchy-item");
      items.forEach((itemElement) => {
        const itemId = parseInt(itemElement.dataset.itemId ?? "0", 10);
        const contentElement = itemElement.querySelector(".hierarchy-item-content");
        const swipeIndicator = itemElement.querySelector(".swipe-indicator");
        if (itemElement._touchStartHandler) {
          itemElement.removeEventListener("touchstart", itemElement._touchStartHandler);
        }
        if (itemElement._touchMoveHandler) {
          itemElement.removeEventListener("touchmove", itemElement._touchMoveHandler);
        }
        if (itemElement._touchEndHandler) {
          itemElement.removeEventListener("touchend", itemElement._touchEndHandler);
        }
        if (contentElement && contentElement._clickHandler) {
          contentElement.removeEventListener("click", contentElement._clickHandler);
        }
        if (swipeIndicator) {
          if (swipeIndicator._blockTouchStart) {
            swipeIndicator.removeEventListener("touchstart", swipeIndicator._blockTouchStart);
          }
          if (swipeIndicator._blockTouchEnd) {
            swipeIndicator.removeEventListener("touchend", swipeIndicator._blockTouchEnd);
          }
          if (swipeIndicator._blockClick) {
            swipeIndicator.removeEventListener("click", swipeIndicator._blockClick);
          }
        }
        itemElement._touchStartHandler = (e) => this.handleTouchStart(e, itemId, itemElement);
        itemElement._touchMoveHandler = (e) => this.handleTouchMove(e, itemId, itemElement);
        itemElement._touchEndHandler = (e) => this.handleTouchEnd(e, itemId, itemElement);
        if (contentElement) {
          contentElement._clickHandler = (e) => {
            const rect = contentElement.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickFromRight = rect.width - clickX;
            if (clickFromRight < 120) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              return;
            }
            if (e.target.closest(".swipe-indicator")) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              return;
            }
            if (itemElement.classList.contains("swiped")) {
              e.preventDefault();
              e.stopPropagation();
              this.resetSwipe(itemId, itemElement);
              return;
            }
            const isCompleted = itemElement.dataset.itemCompleted === "true";
            if (window.listsManager && typeof window.listsManager.toggleItemCompleted === "function") {
              window.listsManager.toggleItemCompleted(itemId, !isCompleted);
            } else {
              console.error("[CONTENT_CLICK] listsManager.toggleItemCompleted not found");
            }
          };
          contentElement.addEventListener("click", contentElement._clickHandler);
        }
        if (swipeIndicator) {
          swipeIndicator._blockTouchStart = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          };
          swipeIndicator._blockTouchEnd = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          };
          swipeIndicator._blockClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          };
          swipeIndicator.addEventListener("touchstart", swipeIndicator._blockTouchStart, {
            passive: false,
            capture: true
          });
          swipeIndicator.addEventListener("touchend", swipeIndicator._blockTouchEnd, {
            passive: false,
            capture: true
          });
          swipeIndicator.addEventListener("click", swipeIndicator._blockClick, { capture: true });
        }
        itemElement.addEventListener("touchstart", itemElement._touchStartHandler, { passive: false });
        itemElement.addEventListener("touchmove", itemElement._touchMoveHandler, { passive: false });
        itemElement.addEventListener("touchend", itemElement._touchEndHandler, { passive: false });
      });
    }
    /**
     * Diagnostic method - call from console to debug swipe state
     * Usage: window.hierarchyView.swipeHandler.diagnoseSwipe()
     */
    diagnoseSwipe() {
      return document.querySelectorAll(".hierarchy-item.swiped");
    }
  }
  class HierarchyView {
    constructor(listsManager2) {
      this.expandedNodes = /* @__PURE__ */ new Set();
      this.listsManager = listsManager2;
      this.expandedNodes = /* @__PURE__ */ new Set();
      this.container = document.getElementById("hierarchy-tree");
      this.swipeHandler = new SwipeHandler();
    }
    /**
     * Render the hierarchy tree
     */
    render() {
      if (!this.container) {
        console.error("[HierarchyView] Container element not found");
        return;
      }
      const items = this.listsManager.filterItemsBySearch();
      const stores = this.listsManager.stores;
      const productGroups = this.listsManager.productGroups;
      if (items.length === 0) {
        this.renderEmpty();
        return;
      }
      const hierarchy = this.buildHierarchy(items, stores, productGroups);
      this.container.innerHTML = this.renderTree(hierarchy);
      debugLog("[HierarchyView] Rendered hierarchy tree");
      this.swipeHandler.setupSwipeHandlers();
      this.listsManager.updateHierarchyToggleButton();
    }
    /**
     * Build a map of product group ID to product group data
     */
    buildProductGroupMap(productGroups) {
      const map = {};
      productGroups.forEach((pg) => {
        map[pg.id] = pg;
      });
      return map;
    }
    /**
     * Get full ancestor path for a product group (from root to leaf)
     * Returns array: [Root, Parent, ..., Child]
     */
    getProductGroupPath(groupId, pgMap) {
      const path = [];
      let currentId = groupId;
      while (currentId && pgMap[currentId]) {
        path.unshift(pgMap[currentId]);
        currentId = pgMap[currentId].parent_id ?? null;
      }
      return path;
    }
    /**
     * Build hierarchy structure: Store → Full ProductGroup Tree → Items
     * Shows complete product group hierarchy for each item
     */
    buildHierarchy(items, stores, productGroups) {
      const hierarchy = {};
      const pgMap = this.buildProductGroupMap(productGroups);
      items.forEach((item) => {
        const store = stores.find((s) => s.id === item.store_id);
        if (!store) return;
        const pgPath = this.getProductGroupPath(item.product_group_id, pgMap);
        if (pgPath.length === 0) return;
        if (!hierarchy[store.id]) {
          hierarchy[store.id] = {
            type: "store",
            id: store.id,
            name: store.name,
            productGroupTree: {}
            // Tree of product groups
          };
        }
        let currentLevel = hierarchy[store.id].productGroupTree;
        pgPath.forEach((pg, index) => {
          const isLeaf = index === pgPath.length - 1;
          if (!currentLevel[pg.id]) {
            currentLevel[pg.id] = {
              type: "product_group",
              id: pg.id,
              name: pg.name,
              store_id: store.id,
              parent_id: pg.parent_id ?? null,
              children: {},
              // Nested product groups
              items: []
              // Items (only for leaves)
            };
          }
          if (isLeaf) {
            currentLevel[pg.id].items.push({
              type: "item",
              ...item
            });
          }
          currentLevel = currentLevel[pg.id].children;
        });
      });
      return hierarchy;
    }
    /**
     * Count all items in a product group tree (including nested children)
     */
    countItemsInTree(pgTree) {
      let total = 0;
      let completed = 0;
      Object.values(pgTree).forEach((pg) => {
        total += pg.items.length;
        completed += pg.items.filter((item) => item.is_completed).length;
        const childCounts = this.countItemsInTree(pg.children);
        total += childCounts.total;
        completed += childCounts.completed;
      });
      return { total, completed };
    }
    /**
     * Render tree HTML - compact design optimized for mobile
     */
    renderTree(hierarchy) {
      let html = '<div class="hierarchy-tree-compact">';
      Object.values(hierarchy).forEach((store) => {
        const storeNodeId = `store-${store.id}`;
        const isExpanded = this.expandedNodes.has(storeNodeId);
        const counts = this.countItemsInTree(store.productGroupTree);
        html += `
                <div class="hierarchy-store" data-node-id="${storeNodeId}">
                    <span class="hierarchy-toggle" onclick="window.hierarchyView.toggleNode('${storeNodeId}')">
                        ${isExpanded ? "▼" : "▶"}
                    </span>
                    <span class="hierarchy-store-icon">🏪</span>
                    <span class="hierarchy-store-name hierarchy-clickable" onclick="window.hierarchyView.toggleNode('${storeNodeId}')">${this.escapeHtml(store.name)}</span>
                    <span class="hierarchy-store-badge">${counts.completed}/${counts.total}</span>
                </div>
            `;
        if (isExpanded) {
          html += this.renderProductGroupTree(store.productGroupTree, storeNodeId, 1);
        }
      });
      html += "</div>";
      return html;
    }
    /**
     * Render product group tree recursively (supports nested product groups)
     * Compact design: dynamic indentation based on depth, supports unlimited nesting
     * @param pgTree - Tree of product groups (keys are IDs)
     * @param parentNodeId - Parent node ID for building unique node IDs
     * @param depth - Current depth level for indentation (supports any depth)
     */
    renderProductGroupTree(pgTree, parentNodeId, depth) {
      let html = '<div class="hierarchy-group-list">';
      const productGroups = Object.values(pgTree);
      productGroups.forEach((productGroup, _index) => {
        const pgNodeId = `${parentNodeId}-pg-${productGroup.id}`;
        const isExpanded = this.expandedNodes.has(pgNodeId);
        const directItemCount = productGroup.items.length;
        const childCounts = this.countItemsInTree(productGroup.children);
        const totalItemCount = directItemCount + childCounts.total;
        const directCompletedCount = productGroup.items.filter((item) => item.is_completed).length;
        const totalCompletedCount = directCompletedCount + childCounts.completed;
        const hasNestedContent = productGroup.items.length > 0 || Object.keys(productGroup.children).length > 0;
        const indentRem = 0.25 + depth * 0.5;
        const indentStyle = `padding-left: ${indentRem}rem;`;
        html += `
                <div class="hierarchy-group" style="${indentStyle}" data-node-id="${pgNodeId}">
                    ${hasNestedContent ? `
                        <span class="hierarchy-toggle" onclick="window.hierarchyView.toggleNode('${pgNodeId}')">
                            ${isExpanded ? "▼" : "▶"}
                        </span>
                    ` : '<span class="hierarchy-toggle-placeholder"></span>'}
                    <span class="hierarchy-group-icon">📦</span>
                    <span class="hierarchy-group-name ${hasNestedContent ? "hierarchy-clickable" : ""}" ${hasNestedContent ? `onclick="window.hierarchyView.toggleNode('${pgNodeId}')"` : ""}>${this.escapeHtml(productGroup.name)}</span>
                    <span class="hierarchy-group-badge">${totalCompletedCount}/${totalItemCount}</span>
                </div>
            `;
        if (isExpanded) {
          if (Object.keys(productGroup.children).length > 0) {
            html += this.renderProductGroupTree(productGroup.children, pgNodeId, depth + 1);
          }
          if (productGroup.items.length > 0) {
            html += this.renderItems(productGroup.items, pgNodeId, depth + 1);
          }
        }
      });
      html += "</div>";
      return html;
    }
    /**
     * Render items at specified depth
     * Items are rendered as a compact list with MINIMAL indentation
     * (shifted to left edge for better mobile viewing)
     * @param items - Array of item objects
     * @param parentNodeId - Parent node ID
     * @param depth - Current depth level (used for styling only)
     */
    renderItems(items, _parentNodeId, _depth = 2) {
      let html = '<div class="hierarchy-items-list">';
      items.forEach((item, _index) => {
        const isCompleted = item.is_completed;
        html += `
                <div class="hierarchy-item ${isCompleted ? "completed" : ""}" data-item-id="${item.id}" data-item-completed="${isCompleted}">
                    <div class="hierarchy-item-content cursor-pointer">
                        <!-- Text group: name + quantity together -->
                        <div class="hierarchy-item-text">
                            <span class="hierarchy-item-name ${isCompleted ? "line-through" : ""}">
                                ${this.escapeHtml(item.product_name)}
                            </span>
                            ${item.quantity ? `<span class="hierarchy-item-qty">${this.formatQuantity(item.quantity, item.unit)}${item.unit ? " " + item.unit : ""}</span>` : ""}
                        </div>

                        <!-- CRITICAL: Swipe indicator INSIDE content to move with swipe (v7.x+) -->
                        <!-- Click blocking: programmatic handler in setupSwipeHandlers() -->
                        <div class="swipe-indicator" aria-hidden="true">
                            <!-- Edit icon (pencil) -->
                            <svg class="swipe-edit-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>

                            <!-- Chevron 1 (left arrow) -->
                            <svg class="swipe-chevron swipe-chevron-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>

                            <!-- Chevron 2 (left arrow) -->
                            <svg class="swipe-chevron swipe-chevron-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>

                            <!-- Chevron 3 (left arrow) -->
                            <svg class="swipe-chevron swipe-chevron-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 18l-6-6 6-6"/>
                            </svg>
                        </div>

                        <!-- Desktop inline actions - buttons with text + icons (v7.x+) -->
                        <div class="hierarchy-item-actions" onclick="event.stopPropagation()">
                            <button class="btn btn-xs btn-primary"
                                    onclick="openEditItemModal(${item.id})"
                                    title="Редактировать товар">
                                <svg class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                <span>Изменить</span>
                            </button>
                            <button class="btn btn-xs btn-error"
                                    onclick="window.listsManager.deleteItem(${item.id})"
                                    title="Удалить товар">
                                <svg class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 6h18"/>
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                </svg>
                                <span>Удалить</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
      });
      html += "</div>";
      return html;
    }
    /**
     * Render empty state
     */
    renderEmpty() {
      if (!this.container) return;
      const hasSearch = this.listsManager.searchQuery && this.listsManager.searchQuery.trim() !== "";
      const hideCompleted = this.listsManager.hideCompleted;
      const hasCompletedItems = this.listsManager.currentItems.some((item) => item.is_completed);
      if (hasSearch) {
        this.container.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">🔍</div>
                    <h3 class="text-2xl font-bold mb-2">Ничего не найдено</h3>
                    <p class="text-base-content/70 mb-4">Попробуйте изменить поисковый запрос</p>
                </div>
            `;
      } else if (hideCompleted && hasCompletedItems) {
        this.container.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">👁️‍🗨️</div>
                    <h3 class="text-2xl font-bold mb-2">Все товары выполнены</h3>
                    <p class="text-base-content/70 mb-4">Нажмите "Показать все" чтобы увидеть выполненные товары</p>
                    <button class="btn btn-primary" onclick="toggleHideCompleted()">
                        👁️ Показать все
                    </button>
                </div>
            `;
      } else {
        this.container.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">🌳</div>
                    <h3 class="text-2xl font-bold mb-2">Список пуст</h3>
                    <p class="text-base-content/70 mb-4">Добавьте товары, чтобы увидеть иерархию</p>
                    <button class="btn btn-primary" onclick="openAddItemModal()">
                        ➕ Добавить товар
                    </button>
                </div>
            `;
      }
    }
    /**
     * Toggle node expansion
     */
    toggleNode(nodeId) {
      if (this.expandedNodes.has(nodeId)) {
        this.expandedNodes.delete(nodeId);
      } else {
        this.expandedNodes.add(nodeId);
      }
      this.render();
    }
    /**
     * Expand all nodes recursively in a product group tree
     * @param pgTree - Tree of product groups
     * @param parentNodeId - Parent node ID
     */
    expandProductGroupTree(pgTree, parentNodeId) {
      Object.values(pgTree).forEach((pg) => {
        const pgNodeId = `${parentNodeId}-pg-${pg.id}`;
        this.expandedNodes.add(pgNodeId);
        if (Object.keys(pg.children).length > 0) {
          this.expandProductGroupTree(pg.children, pgNodeId);
        }
      });
    }
    /**
     * Expand all nodes
     */
    expandAll() {
      const items = this.listsManager.currentItems;
      const stores = this.listsManager.stores;
      const productGroups = this.listsManager.productGroups;
      const hierarchy = this.buildHierarchy(items, stores, productGroups);
      Object.values(hierarchy).forEach((store) => {
        const storeNodeId = `store-${store.id}`;
        this.expandedNodes.add(storeNodeId);
        this.expandProductGroupTree(store.productGroupTree, storeNodeId);
      });
      this.render();
      this.listsManager.updateHierarchyToggleButton();
    }
    /**
     * Collapse all nodes
     */
    collapseAll() {
      this.expandedNodes.clear();
      this.render();
      this.listsManager.updateHierarchyToggleButton();
    }
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
      if (!text) return "";
      const div = document.createElement("div");
      div.textContent = String(text);
      return div.innerHTML;
    }
    /**
     * Format quantity based on unit type
     * - шт, л, мл, уп, пач, г: integer (no decimals)
     * - кг: 1 decimal place with comma separator
     * @param quantity - The quantity value
     * @param unit - The unit type
     * @returns Formatted quantity string
     */
    formatQuantity(quantity, unit) {
      if (quantity === null || quantity === void 0) {
        return null;
      }
      const numQuantity = typeof quantity === "string" ? parseFloat(quantity) : quantity;
      if (isNaN(numQuantity)) {
        return null;
      }
      const oneDecimalUnits = ["кг"];
      if (unit && oneDecimalUnits.includes(unit)) {
        return numQuantity.toFixed(1).replace(".", ",");
      }
      return Math.round(numQuantity).toString();
    }
  }
  function getTotalNodeCount() {
    const state2 = getState$1();
    if (!state2.hierarchyView) return 0;
    const hierarchy = state2.hierarchyView.buildHierarchy(
      state2.currentItems,
      state2.stores,
      state2.productGroups
    );
    let total = 0;
    Object.values(hierarchy).forEach((store) => {
      total++;
      if (store.groups) {
        total += Object.keys(store.groups).length;
      }
    });
    return total;
  }
  function updateHierarchyToggleButton() {
    const btn = document.getElementById("hierarchy-toggle-btn");
    const icon = document.getElementById("hierarchy-toggle-icon");
    const text = document.getElementById("hierarchy-toggle-text");
    if (!btn || !icon || !text) return;
    const state2 = getState$1();
    const totalNodes = getTotalNodeCount();
    const expandedCount = state2.hierarchyView ? state2.hierarchyView.expandedNodes.size : 0;
    debugLog(`[HIERARCHY] Toggle state: ${expandedCount}/${totalNodes} expanded`);
    if (expandedCount === totalNodes && totalNodes > 0) {
      icon.textContent = "⬆️";
      text.textContent = "Свернуть";
      btn.title = "Свернуть все узлы";
      btn.dataset.action = "collapse";
    } else {
      icon.textContent = "⬇️";
      text.textContent = "Развернуть";
      btn.title = "Развернуть все узлы";
      btn.dataset.action = "expand";
    }
  }
  function createListsManagerProxy() {
    return {
      // Method delegation
      filterItemsBySearch,
      updateHierarchyToggleButton,
      loadShoppingListItems,
      loadStores,
      loadProductGroups,
      deleteItem,
      renderItemsTable,
      initStoreChoices,
      initProductGroupChoices,
      // Property getters (dynamic - always return current state)
      get stores() {
        return getState$1().stores;
      },
      get productGroups() {
        return getState$1().productGroups;
      },
      get searchQuery() {
        return getState$1().searchQuery;
      },
      get hideCompleted() {
        return getState$1().hideCompleted;
      },
      get currentItems() {
        return getState$1().currentItems;
      },
      get currentListId() {
        return getState$1().currentListId;
      }
    };
  }
  function initializeHierarchyView() {
    const listsManagerProxy = createListsManagerProxy();
    const hierarchyView = new HierarchyView(listsManagerProxy);
    updateState$1({ hierarchyView });
    window.hierarchyView = hierarchyView;
    debugLog("[HIERARCHY] ✅ HierarchyView initialized with listsManager proxy");
    const state2 = getState$1();
    const isMobile = window.innerWidth < 640;
    if (isMobile && state2.currentView === "hierarchy" && state2.currentListId !== null) {
      debugLog("[HIERARCHY] Mobile detected - rendering hierarchy view immediately");
      hierarchyView.render();
    }
  }
  function toggleSelectAll() {
    const state2 = getState$1();
    const allSelected = state2.selectedItemIds.size === state2.currentItems.length && state2.currentItems.length > 0;
    if (allSelected) {
      updateState$1({ selectedItemIds: /* @__PURE__ */ new Set() });
    } else {
      const newSelectedIds = /* @__PURE__ */ new Set();
      state2.currentItems.forEach((item) => {
        newSelectedIds.add(item.id);
      });
      updateState$1({ selectedItemIds: newSelectedIds });
    }
    renderCurrentView();
  }
  function selectCompleted() {
    const state2 = getState$1();
    const newSelectedIds = /* @__PURE__ */ new Set();
    state2.currentItems.filter((item) => item.is_completed).forEach((item) => {
      newSelectedIds.add(item.id);
    });
    updateState$1({ selectedItemIds: newSelectedIds });
    renderCurrentView();
    showToast(`Выбрано ${newSelectedIds.size} выполненных товаров`, "info");
  }
  async function deleteSelected() {
    const state2 = getState$1();
    if (state2.selectedItemIds.size === 0) {
      return;
    }
    const count = state2.selectedItemIds.size;
    if (!confirm(`Удалить выбранные товары (${count})?`)) {
      return;
    }
    try {
      const itemIds = Array.from(state2.selectedItemIds);
      const response = await fetch("/api/v1/shopping-list-items/batch-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ item_ids: itemIds })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const newItems = state2.currentItems.filter((item) => !state2.selectedItemIds.has(item.id));
      updateState$1({
        currentItems: newItems,
        selectedItemIds: /* @__PURE__ */ new Set()
      });
      if (state2.currentView === "hierarchy" && state2.hierarchyView) {
        state2.hierarchyView.render();
      } else {
        renderCurrentView();
      }
      showToast(`Удалено товаров: ${count}`, "success");
    } catch (error) {
      console.error("[ListsManager] Error deleting selected items:", error);
      showToast("Ошибка удаления товаров", "error");
    }
  }
  function updateSelectionUI() {
    const state2 = getState$1();
    const deleteBtn = document.getElementById("delete-selected-btn");
    const selectAllBtn = document.getElementById("select-all-btn");
    if (deleteBtn) {
      if (state2.selectedItemIds.size > 0) {
        deleteBtn.disabled = false;
        const textSpan = deleteBtn.querySelector("span:last-child");
        if (textSpan && textSpan.classList.contains("hidden")) {
          const iconSpan = deleteBtn.querySelector("span:first-child");
          if (iconSpan) iconSpan.textContent = `🗑️${state2.selectedItemIds.size}`;
        } else if (textSpan) {
          textSpan.textContent = `Удалить (${state2.selectedItemIds.size})`;
        }
      } else {
        deleteBtn.disabled = true;
        const textSpan = deleteBtn.querySelector("span:last-child");
        if (textSpan && textSpan.classList.contains("hidden")) {
          const iconSpan = deleteBtn.querySelector("span:first-child");
          if (iconSpan) iconSpan.textContent = "🗑️";
        } else if (textSpan) {
          textSpan.textContent = "Удалить";
        }
      }
    }
    if (selectAllBtn) {
      const selectAllTextSpan = selectAllBtn.querySelector("span:last-child");
      const selectAllIconSpan = selectAllBtn.querySelector("span:first-child");
      if (state2.selectedItemIds.size === state2.currentItems.length && state2.currentItems.length > 0) {
        if (selectAllIconSpan) selectAllIconSpan.textContent = "☐";
        if (selectAllTextSpan) selectAllTextSpan.textContent = "Снять выделение";
      } else {
        if (selectAllIconSpan) selectAllIconSpan.textContent = "☑️";
        if (selectAllTextSpan) selectAllTextSpan.textContent = "Выделить все";
      }
    }
  }
  let pendingDeleteIds = [];
  async function confirmDelete() {
    if (pendingDeleteIds.length === 0) {
      debugLog("[BULK_DELETE] No pending delete IDs");
      return;
    }
    debugLog("[BULK_DELETE] Confirming deletion of", pendingDeleteIds.length, "items");
    try {
      const response = await fetch("/api/v1/shopping-list-items/batch-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ item_ids: pendingDeleteIds })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const state2 = getState$1();
      const deletedIds = new Set(pendingDeleteIds);
      const newItems = state2.currentItems.filter((item) => !deletedIds.has(item.id));
      updateState$1({
        currentItems: newItems,
        selectedItemIds: /* @__PURE__ */ new Set()
      });
      if (state2.currentView === "hierarchy" && state2.hierarchyView) {
        state2.hierarchyView.render();
      } else {
        renderCurrentView();
      }
      showToast(`Удалено товаров: ${pendingDeleteIds.length}`, "success");
    } catch (error) {
      debugLog("[BULK_DELETE] Error:", error);
      showToast("Ошибка удаления товаров", "error");
    } finally {
      closeDeleteConfirmModal();
    }
  }
  function closeDeleteConfirmModal() {
    const modal = document.getElementById("delete-confirm-modal");
    if (modal) {
      modal.close();
    }
    pendingDeleteIds = [];
    debugLog("[BULK_DELETE] Modal closed, pending IDs cleared");
  }
  async function markAllCompleted() {
    const state2 = getState$1();
    const uncompleted = state2.currentItems.filter((item) => !item.is_completed);
    if (uncompleted.length === 0) {
      showToast("Все товары уже отмечены", "info");
      return;
    }
    for (const item of uncompleted) {
      await toggleItemCompleted(item.id, true);
    }
    renderCurrentView();
    showToast(`Отмечено: ${uncompleted.length}`, "success");
  }
  async function unmarkAllCompleted() {
    const state2 = getState$1();
    const completed = state2.currentItems.filter((item) => item.is_completed);
    if (completed.length === 0) {
      showToast("Нет отмеченных товаров", "info");
      return;
    }
    for (const item of completed) {
      await toggleItemCompleted(item.id, false);
    }
    renderCurrentView();
    showToast(`Снято отметок: ${completed.length}`, "success");
  }
  async function deleteCompleted() {
    const state2 = getState$1();
    const completedItems = state2.currentItems.filter((item) => item.is_completed);
    if (completedItems.length === 0) {
      showToast("Нет выполненных товаров", "info");
      return;
    }
    const itemIds = completedItems.map((i) => i.id);
    await deleteMultipleItems(itemIds);
    renderCurrentView();
    showToast(`Удалено: ${completedItems.length}`, "success");
  }
  function toggleListsFAB() {
    const menu = document.getElementById("lists-fab-menu");
    const backdrop = document.getElementById("lists-fab-backdrop");
    const addItemFAB = document.getElementById("add-item-fab");
    if (!menu || !backdrop) return;
    const isOpen = menu.classList.contains("open");
    if (isOpen) {
      menu.classList.remove("open");
      menu.classList.add("closed");
      backdrop.classList.add("opacity-0", "pointer-events-none", "hidden");
      if (addItemFAB) {
        addItemFAB.classList.remove("hidden");
        debugLog("[FAB] add-item-fab shown (Speed Dial closed)");
      }
    } else {
      menu.classList.remove("closed");
      menu.classList.add("open");
      backdrop.classList.remove("opacity-0", "pointer-events-none", "hidden");
      if (addItemFAB) {
        addItemFAB.classList.add("hidden");
        debugLog("[FAB] add-item-fab hidden (Speed Dial opened)");
      }
    }
  }
  function handleItemCreated(item) {
    if (!item || !item.id) {
      debugLog("[ListsManager] Invalid item for handleItemCreated");
      return;
    }
    const state2 = getState$1();
    if (item.shopping_list_id !== state2.currentListId) {
      debugLog("[ListsManager] Item from different list, ignoring:", item.shopping_list_id, "current:", state2.currentListId);
      return;
    }
    const exists = state2.currentItems.some((i) => i.id === item.id);
    if (exists) {
      debugLog("[ListsManager] Item already exists, updating instead:", item.id);
      handleItemUpdated(item);
      return;
    }
    updateState$1({
      currentItems: [...state2.currentItems, item]
    });
    debugLog("[ListsManager] Added item from WebSocket:", item.id);
    renderCurrentView();
    updateFABVisibility();
    updateFABButtons();
    updateItemsCache();
    showToast(`Добавлен товар: ${item.product_name}`, "info");
  }
  function handleItemUpdated(item) {
    if (!item || !item.id) {
      debugLog("[ListsManager] Invalid item for handleItemUpdated");
      return;
    }
    const state2 = getState$1();
    if (item.shopping_list_id !== state2.currentListId) {
      debugLog("[ListsManager] Item from different list, ignoring update:", item.shopping_list_id, "current:", state2.currentListId);
      return;
    }
    const index = state2.currentItems.findIndex((i) => i.id === item.id);
    if (index === -1) {
      debugLog("[ListsManager] Item not found for update:", item.id);
      handleItemCreated(item);
      return;
    }
    const newItems = [...state2.currentItems];
    newItems[index] = { ...newItems[index], ...item };
    updateState$1({ currentItems: newItems });
    debugLog("[ListsManager] Updated item from WebSocket:", item.id);
    renderCurrentView();
    updateFABButtons();
    updateFABVisibility();
    updateItemsCache();
  }
  function handleItemDeleted(itemId, shoppingListId) {
    if (!itemId) {
      debugLog("[ListsManager] Invalid itemId for handleItemDeleted");
      return;
    }
    const state2 = getState$1();
    if (shoppingListId !== void 0 && shoppingListId !== state2.currentListId) {
      debugLog("[ListsManager] Item from different list, ignoring removal:", shoppingListId, "current:", state2.currentListId);
      return;
    }
    const index = state2.currentItems.findIndex((i) => i.id === itemId);
    if (index === -1) {
      debugLog("[ListsManager] Item not found for removal:", itemId);
      return;
    }
    const removedItem = state2.currentItems[index];
    const newItems = [...state2.currentItems];
    newItems.splice(index, 1);
    const newSelection = new Set(state2.selectedItemIds);
    newSelection.delete(itemId);
    updateState$1({
      currentItems: newItems,
      selectedItemIds: newSelection
    });
    debugLog("[ListsManager] Removed item from WebSocket:", itemId);
    renderCurrentView();
    updateFABButtons();
    updateFABVisibility();
    updateItemsCache();
    showToast(`Удалён товар: ${removedItem.product_name}`, "info");
  }
  function handleItemCompletedToggled(itemId, isCompleted, shoppingListId) {
    if (!itemId) {
      debugLog("[ListsManager] Invalid itemId for handleItemCompletedToggled");
      return;
    }
    const state2 = getState$1();
    if (shoppingListId !== void 0 && shoppingListId !== state2.currentListId) {
      debugLog("[ListsManager] Item from different list, ignoring toggle:", shoppingListId, "current:", state2.currentListId);
      return;
    }
    const item = state2.currentItems.find((i) => i.id === itemId);
    if (!item) {
      debugLog("[ListsManager] Item not found for toggle:", itemId);
      return;
    }
    const newItems = [...state2.currentItems];
    const index = newItems.findIndex((i) => i.id === itemId);
    if (index !== -1) {
      newItems[index] = {
        ...newItems[index],
        is_completed: isCompleted,
        completed_at: isCompleted ? (/* @__PURE__ */ new Date()).toISOString() : void 0
      };
    }
    updateState$1({ currentItems: newItems });
    debugLog("[ListsManager] Toggled item from WebSocket:", itemId, isCompleted);
    renderCurrentView();
    updateFABButtons();
    updateFABVisibility();
    updateItemsCache();
  }
  function initializeImportManager() {
    if (typeof window.ImportManager === "undefined") {
      debugLog("[IMPORT] WARNING: ImportManager class not available");
      return;
    }
    const listsManagerProxy = createListsManagerProxy();
    const importManager = new window.ImportManager(listsManagerProxy);
    window.importManager = importManager;
    debugLog("[IMPORT] ✅ ImportManager initialized with listsManager proxy");
  }
  function openModal(modalId) {
    debugLog(`[LISTS_GLOBAL] openModal('${modalId}') called - feature not fully implemented`);
    debugLog("[LISTS_GLOBAL] These modals are available on the main budget page, not lists page");
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      window.Telegram.WebApp.showAlert("Эту функцию можно использовать на главной странице бюджета");
    } else if (typeof alert !== "undefined") {
      alert("Эту функцию можно использовать на главной странице бюджета");
    }
  }
  function navigateHomeOfflineFriendly() {
    const isOnline2 = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline2) {
      debugLog("[LISTS_GLOBAL] Offline - using direct navigation fallback");
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  }
  async function handleMobileAddButton() {
    const { getState: getState2 } = await __vitePreload(async () => {
      const { getState: getState3 } = await Promise.resolve().then(function() {
        return ListsState;
      });
      return { getState: getState3 };
    }, false ? __VITE_PRELOAD__ : void 0);
    const { openCreateListModal: openCreateListModal2, openAddItemModal: openAddItemModal2 } = await __vitePreload(async () => {
      const { openCreateListModal: openCreateListModal3, openAddItemModal: openAddItemModal3 } = await Promise.resolve().then(function() {
        return modalManager;
      });
      return { openCreateListModal: openCreateListModal3, openAddItemModal: openAddItemModal3 };
    }, false ? __VITE_PRELOAD__ : void 0);
    const state2 = getState2();
    const isLandingView = state2.currentListId == null;
    debugLog("[MOBILE_MENU] handleMobileAddButton() called");
    debugLog("[MOBILE_MENU] Current view:", isLandingView ? "Landing" : "Detail");
    if (isLandingView) {
      debugLog("[MOBILE_MENU] Opening create list modal (Landing View)");
      if (typeof openCreateListModal2 === "function") {
        openCreateListModal2();
      } else {
        console.error("[MOBILE_MENU] openCreateListModal is not a function");
      }
    } else {
      debugLog("[MOBILE_MENU] Opening add item modal (Detail View, list:", state2.currentListId, ")");
      if (typeof openAddItemModal2 === "function") {
        openAddItemModal2();
      } else {
        console.error("[MOBILE_MENU] openAddItemModal is not a function");
      }
    }
  }
  async function updateMobileAddButton() {
    const { getState: getState2 } = await __vitePreload(async () => {
      const { getState: getState3 } = await Promise.resolve().then(function() {
        return ListsState;
      });
      return { getState: getState3 };
    }, false ? __VITE_PRELOAD__ : void 0);
    const state2 = getState2();
    const isLandingView = state2.currentListId == null;
    const button = document.getElementById("mobile-add-button");
    const iconSpan = document.getElementById("mobile-add-icon");
    if (!button || !iconSpan) {
      debugLog("[MOBILE_MENU] Button elements not found - likely desktop view or not yet rendered");
      return;
    }
    if (isLandingView) {
      iconSpan.textContent = "➕";
      button.setAttribute("title", "Создать список");
      button.setAttribute("aria-label", "Создать список");
      debugLog("[MOBILE_MENU] Updated button UI for Landing View (➕ Создать список)");
    } else {
      iconSpan.textContent = "🛒";
      button.setAttribute("title", "Добавить товар");
      button.setAttribute("aria-label", "Добавить товар");
      debugLog("[MOBILE_MENU] Updated button UI for Detail View (🛒 Добавить товар)");
    }
  }
  const globalHelpers = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    handleMobileAddButton,
    navigateHomeOfflineFriendly,
    openModal,
    updateMobileAddButton
  });
  const listsManager = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    HierarchyView,
    SwipeHandler,
    clearSearch,
    closeCreateListModal,
    closeDeleteConfirmModal,
    closeDeleteListModal,
    closeItemModal: closeItemModal$1,
    confirmDelete,
    confirmDeleteList,
    createItem,
    deleteCompleted,
    deleteItem,
    deleteMultipleItems,
    deleteSelected,
    filterItemsBySearch,
    getProductGroupBreadcrumbs,
    getState: getState$1,
    handleCreateList,
    handleDeleteFromModal,
    handleItemCompletedToggled,
    handleItemCreated,
    handleItemDeleted,
    handleItemUpdated,
    handleMobileAddButton,
    handleSaveItem,
    handleSearch,
    hideProductSuggestions,
    initializeHierarchyView,
    initializeImportManager,
    initializeListsManager,
    initializeResponsiveView,
    isOnline,
    loadShoppingListItems,
    loadShoppingLists,
    markAllCompleted,
    navigateHomeOfflineFriendly,
    openAddItemModal: openAddItemModal$1,
    openCreateListModal,
    openDeleteListModal: openDeleteListModal$1,
    openEditItemModal: openEditItemModal$1,
    openModal,
    renderCurrentView,
    renderDetailView,
    renderItemsTable,
    renderLandingView,
    renderShoppingListCards,
    resetState: resetState$1,
    selectCompleted,
    setupProductAutocomplete,
    switchToList,
    switchView,
    toggleHideCompleted: toggleHideCompleted$1,
    toggleItemCompleted,
    toggleListsFAB,
    toggleSearchField,
    toggleSelectAll,
    unmarkAllCompleted,
    updateFABButtons,
    updateFABVisibility,
    updateHierarchyToggleButton,
    updateItem,
    updateItemsCache,
    updateMobileAddButton,
    updateSelectionUI,
    updateState: updateState$1
  });
  function createInitialState(listsManager2) {
    return {
      // Wizard navigation
      currentStep: 1,
      totalSteps: 5,
      // File data
      file: null,
      fileContent: null,
      // Detection results
      detectionResult: null,
      // Column mapping
      columnMapping: {},
      // Validation results
      validationResult: null,
      // Import options
      importOptions: {
        skipInvalid: true,
        skipDuplicates: false,
        createMissingReferences: true,
        aggregateDuplicates: false
      },
      // Preview state
      previewPagination: {
        currentPage: 1,
        rowsPerPage: 10,
        rowsPerPageOptions: [10, 25, 50, 100]
      },
      previewFilters: {
        store: "",
        group: "",
        product: ""
      },
      allPreviewRows: [],
      // UI references
      container: null,
      onBackToStep1: null,
      globalVarName: "csvImporter",
      // listsManager reference
      listsManager: listsManager2
    };
  }
  let state = null;
  const getState = () => {
    if (!state) {
      throw new Error("[CSVState] State not initialized. Call createInitialState() first.");
    }
    return state;
  };
  const updateState = (updates) => {
    if (!state) {
      throw new Error("[CSVState] State not initialized. Call createInitialState() first.");
    }
    state = { ...state, ...updates };
  };
  const resetState = (listsManager2) => {
    state = createInitialState(listsManager2);
  };
  const initializeState = (listsManager2) => {
    state = createInitialState(listsManager2);
  };
  const csvImporter = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    createInitialState,
    getState,
    initializeState,
    resetState,
    updateState
  });
  async function initializeApp() {
    debugLog("[APP] Initializing Family Budget application...");
    try {
      debugLog("[APP] listsManager module loaded");
      debugLog("[APP] listsManager state functions available:", {
        getState: typeof getState$1,
        updateState: typeof updateState$1,
        resetState: typeof resetState$1
      });
      debugLog("[APP] csvImporter module loaded");
      debugLog("[APP] csvImporter state functions available:", {
        getState: typeof getState,
        updateState: typeof updateState,
        resetState: typeof resetState
      });
      window.listsManager = listsManager;
      window.csvImporter = csvImporter;
      debugLog("[APP] Application initialized successfully (Phase 2.1-2.4 complete)");
    } catch (error) {
      console.error("[APP] Application initialization failed", error);
      throw error;
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
  } else {
    initializeApp();
  }
})(PGlite);
//# sourceMappingURL=bundle.js.map
