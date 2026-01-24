(function(pglite) {
  "use strict";
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
    async getArticles(filters2) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryArticles(filters2);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getArticles", duration2);
            return result2;
          }
        }
        const result = await this.getArticlesFromAPI(filters2);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getArticles", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getArticles failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getArticlesFromAPI(filters2);
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
    async getArticlesFromAPI(filters2) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters2?.user_id !== void 0) {
        params.set("user_id", filters2.user_id.toString());
      }
      if (filters2?.type) {
        params.set("type", filters2.type);
      }
      if (filters2?.parent_id !== void 0) {
        if (filters2.parent_id === null) {
          params.set("parent_id", "null");
        } else {
          params.set("parent_id", filters2.parent_id.toString());
        }
      }
      if (filters2?.is_active !== void 0) {
        params.set("is_active", filters2.is_active.toString());
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
    async getShoppingLists(filters2) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryShoppingLists(filters2);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getShoppingLists", duration2);
            return result2;
          }
        }
        const result = await this.getShoppingListsFromAPI(filters2);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getShoppingLists", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getShoppingLists failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getShoppingListsFromAPI(filters2);
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
    async getShoppingListsFromAPI(filters2) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters2?.is_active !== void 0) {
        params.set("is_active", filters2.is_active.toString());
      }
      if (filters2?.sync_status) {
        params.set("sync_status", filters2.sync_status);
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
    async getShoppingListItems(listTempId, filters2) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryShoppingListItems({
              ...filters2,
              shopping_list_temp_id: listTempId
            });
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getShoppingListItems", duration2);
            return result2;
          }
        }
        const result = await this.getShoppingListItemsFromAPI(listTempId, filters2);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getShoppingListItems", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getShoppingListItems failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getShoppingListItemsFromAPI(listTempId, filters2);
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
    async getShoppingListItemsFromAPI(listTempId, filters2) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      params.set("shopping_list_temp_id", listTempId);
      if (filters2?.is_completed !== void 0) {
        params.set("is_completed", filters2.is_completed.toString());
      }
      if (filters2?.store_id !== void 0) {
        params.set("store_id", filters2.store_id.toString());
      }
      if (filters2?.product_group_id !== void 0) {
        params.set("product_group_id", filters2.product_group_id.toString());
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
    async getStores(filters2) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryStores(filters2);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getStores", duration2);
            return result2;
          }
        }
        const result = await this.getStoresFromAPI(filters2);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getStores", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getStores failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getStoresFromAPI(filters2);
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
    async getStoresFromAPI(filters2) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters2?.is_active !== void 0) {
        params.set("is_active", filters2.is_active.toString());
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
    async getProductGroups(filters2) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryProductGroups(filters2);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getProductGroups", duration2);
            return result2;
          }
        }
        const result = await this.getProductGroupsFromAPI(filters2);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getProductGroups", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getProductGroups failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getProductGroupsFromAPI(filters2);
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
    async getProductGroupsFromAPI(filters2) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters2?.is_active !== void 0) {
        params.set("is_active", filters2.is_active.toString());
      }
      if (filters2?.parent_id !== void 0) {
        if (filters2.parent_id === null) {
          params.set("parent_id", "null");
        } else {
          params.set("parent_id", filters2.parent_id.toString());
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
    async getFacts(filters2) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryFacts(filters2);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getFacts", duration2);
            return result2;
          }
        }
        const result = await this.getFactsFromAPI(filters2);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getFacts", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getFacts failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getFactsFromAPI(filters2);
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
    async getFactsFromAPI(filters2) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters2?.user_id !== void 0) {
        params.set("user_id", filters2.user_id.toString());
      }
      if (filters2?.article_id !== void 0) {
        params.set("article_id", filters2.article_id.toString());
      }
      if (filters2?.financial_center_id !== void 0) {
        params.set("financial_center_id", filters2.financial_center_id.toString());
      }
      if (filters2?.cost_center_id !== void 0) {
        params.set("cost_center_id", filters2.cost_center_id.toString());
      }
      if (filters2?.record_type) {
        params.set("record_type", filters2.record_type);
      }
      if (filters2?.date_from) {
        params.set("date_from", filters2.date_from);
      }
      if (filters2?.date_to) {
        params.set("date_to", filters2.date_to);
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
    async getFactsCount(filters2) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const facts = await pglite2.queryFacts(filters2);
            const count2 = facts.length;
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getFactsCount", duration2);
            return count2;
          }
        }
        const count = await this.getFactsCountFromAPI(filters2);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getFactsCount", duration);
        return count;
      } catch (error) {
        console.error("[DATA_LAYER] getFactsCount failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const count = await this.getFactsCountFromAPI(filters2);
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
    async getFactsCountFromAPI(filters2) {
      const params = new URLSearchParams();
      if (filters2?.user_id !== void 0) {
        params.set("user_id", filters2.user_id.toString());
      }
      if (filters2?.article_id !== void 0) {
        params.set("article_id", filters2.article_id.toString());
      }
      if (filters2?.financial_center_id !== void 0) {
        params.set("financial_center_id", filters2.financial_center_id.toString());
      }
      if (filters2?.cost_center_id !== void 0) {
        params.set("cost_center_id", filters2.cost_center_id.toString());
      }
      if (filters2?.record_type) {
        params.set("record_type", filters2.record_type);
      }
      if (filters2?.date_from) {
        params.set("date_from", filters2.date_from);
      }
      if (filters2?.date_to) {
        params.set("date_to", filters2.date_to);
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
    async getRecurringPlans(filters2) {
      const startTime = performance.now();
      try {
        if (pglite.isPGliteEnabled()) {
          const pglite2 = await this.getPGlite();
          if (pglite2.isReady()) {
            const result2 = await pglite2.queryRecurringPlans(filters2);
            const duration2 = performance.now() - startTime;
            performanceMonitor.trackPGliteCall("getRecurringPlans", duration2);
            return result2;
          }
        }
        const result = await this.getRecurringPlansFromAPI(filters2);
        const duration = performance.now() - startTime;
        performanceMonitor.trackAPICall("getRecurringPlans", duration);
        return result;
      } catch (error) {
        console.error("[DATA_LAYER] getRecurringPlans failed:", error);
        if (pglite.isPGliteEnabled()) {
          console.warn("[DATA_LAYER] PGlite failed, falling back to API");
          const result = await this.getRecurringPlansFromAPI(filters2);
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
    async getRecurringPlansFromAPI(filters2) {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (filters2?.user_id !== void 0) {
        params.set("user_id", filters2.user_id.toString());
      }
      if (filters2?.article_id !== void 0) {
        params.set("article_id", filters2.article_id.toString());
      }
      if (filters2?.financial_center_id !== void 0) {
        params.set("financial_center_id", filters2.financial_center_id.toString());
      }
      if (filters2?.cost_center_id !== void 0) {
        params.set("cost_center_id", filters2.cost_center_id.toString());
      }
      if (filters2?.is_active !== void 0) {
        params.set("is_active", filters2.is_active.toString());
      }
      if (filters2?.frequency) {
        params.set("frequency", filters2.frequency);
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
  async function getCurrentUserId() {
    if (typeof window !== "undefined" && window.currentUser?.id) {
      return window.currentUser.id;
    }
    try {
      const response = await fetch("/api/v1/users/me", {
        credentials: "include",
        signal: AbortSignal.timeout(2e3)
        // 2s timeout
      });
      if (response.ok) {
        const user = await response.json();
        if (user && typeof user.id === "number") {
          return user.id;
        }
      }
    } catch (error) {
      console.warn("[userHelpers] Failed to fetch user from API:", error);
    }
    throw new Error("Cannot determine user ID for offline operation. User must be authenticated.");
  }
  async function loadUsers() {
    try {
      const response = await fetch("/api/v1/users");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const users = data.users || data;
      return users;
    } catch (error) {
      console.error("[PlanHelpers] Error loading users:", error);
      throw error;
    }
  }
  async function loadArticles() {
    try {
      const articles = await dataLayer.getArticles();
      return articles;
    } catch (error) {
      console.error("[PlanHelpers] Error loading articles:", error);
      throw error;
    }
  }
  async function loadFinancialCenters$1(includeGlobal = true) {
    try {
      const userId = await getCurrentUserId();
      const centers = await dataLayer.getFinancialCenters(userId, includeGlobal);
      return centers;
    } catch (error) {
      console.error("[PlanHelpers] Error loading financial centers:", error);
      throw error;
    }
  }
  async function loadCostCenters$1(includeGlobal = true) {
    try {
      const userId = await getCurrentUserId();
      const centers = await dataLayer.getCostCenters(userId, null, includeGlobal);
      return centers;
    } catch (error) {
      console.error("[PlanHelpers] Error loading cost centers:", error);
      throw error;
    }
  }
  function buildArticleTree(articles) {
    const sortedArticles = [...articles].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const roots = sortedArticles.filter((a) => !a.parent_id);
    function buildNode(article, level = 0) {
      const children = sortedArticles.filter((a) => a.parent_id === article.id).map((child) => buildNode(child, level + 1));
      return {
        ...article,
        level,
        children,
        isLeaf: children.length === 0
      };
    }
    return roots.map((root) => buildNode(root));
  }
  function flattenArticleTree(nodes) {
    const result = [];
    function traverse(node) {
      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        parent_id: node.parent_id,
        is_leaf: node.is_leaf,
        level: node.level,
        isLeaf: node.isLeaf,
        financial_center_id: node.financial_center_id
      });
      if (node.children && node.children.length > 0) {
        node.children.forEach(traverse);
      }
    }
    nodes.forEach(traverse);
    return result;
  }
  function getMobileAmountClass(type) {
    const colorMap = {
      "expense": "amount-expense",
      "income": "amount-income",
      "debit": "amount-debit",
      "credit": "amount-credit"
    };
    return colorMap[type] || "amount-expense";
  }
  function formatMobileAmount(amount, type) {
    const value = parseFloat(String(amount)).toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    const sign = type === "income" || type === "credit" ? "+" : "-";
    return `${sign}${value}`;
  }
  function formatDesktopAmount(amount, type) {
    const value = parseFloat(String(amount)).toLocaleString("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    const sign = type === "income" || type === "credit" ? "+" : "-";
    return `${sign}${value}`;
  }
  function updateToastPosition(container) {
    if (window.innerWidth > 768) {
      container.style.top = "80px";
      container.style.right = "20px";
      container.style.left = "auto";
      container.style.transform = "none";
    } else {
      container.style.top = "50%";
      container.style.left = "50%";
      container.style.right = "auto";
      container.style.transform = "translate(-50%, -50%)";
    }
  }
  function getOrCreateToastContainer() {
    let toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toast-container";
      toastContainer.style.cssText = `
      position: fixed;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
      document.body.appendChild(toastContainer);
      window.addEventListener("resize", () => updateToastPosition(toastContainer));
    }
    return toastContainer;
  }
  function createToastElement(messageText, type) {
    const toast = document.createElement("div");
    const alertClass = type === "error" ? "alert-error" : type === "success" ? "alert-success" : type === "warning" ? "alert-warning" : "alert-info";
    toast.className = `alert ${alertClass} shadow-lg max-w-md`;
    const wrapper = document.createElement("div");
    const span = document.createElement("span");
    span.textContent = messageText;
    wrapper.appendChild(span);
    toast.appendChild(wrapper);
    return toast;
  }
  function extractMessageText(message) {
    if (typeof message === "object" && message !== null) {
      if (message instanceof Error) {
        return message.message;
      }
      return message.detail || message.message || JSON.stringify(message);
    }
    return message;
  }
  function showNotification$1(message, type = "info") {
    const messageText = extractMessageText(message);
    const toastContainer = getOrCreateToastContainer();
    updateToastPosition(toastContainer);
    const toast = createToastElement(messageText, type);
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
      if (toastContainer.children.length === 0) {
        toastContainer.remove();
      }
    }, 3e3);
  }
  function showToast$1(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `alert alert-${type} fixed top-4 right-4 w-96 z-[100] shadow-lg`;
    const span = document.createElement("span");
    span.textContent = message;
    toast.appendChild(span);
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3e3);
  }
  function getReminderStatusBadge$1(status) {
    const statusMap = {
      "pending": { text: "Ожидает", class: "badge-info" },
      "sent": { text: "Отправлено", class: "badge-success" },
      "failed": { text: "Ошибка", class: "badge-error" },
      "cancelled": { text: "Отменено", class: "badge-ghost" }
    };
    return statusMap[status] || { text: status, class: "badge-ghost" };
  }
  const PlanHelpers = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    buildArticleTree,
    flattenArticleTree,
    formatDesktopAmount,
    formatMobileAmount,
    getMobileAmountClass,
    getReminderStatusBadge: getReminderStatusBadge$1,
    loadArticles,
    loadCostCenters: loadCostCenters$1,
    loadFinancialCenters: loadFinancialCenters$1,
    loadUsers,
    showNotification: showNotification$1,
    showToast: showToast$1
  });
  const DEFAULT_DATE_FROM = (() => {
    const now = /* @__PURE__ */ new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  })();
  const DEFAULT_DATE_TO = (() => {
    const now = /* @__PURE__ */ new Date();
    const futureDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    const year = futureDate.getFullYear();
    const month = String(futureDate.getMonth() + 1).padStart(2, "0");
    const day = String(futureDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();
  let filters = {
    user_id: null,
    article_id: null,
    article_type: null,
    date_from: DEFAULT_DATE_FROM,
    date_to: DEFAULT_DATE_TO,
    financial_center_id: null,
    cost_center_id: null,
    search: null,
    has_recurring_plan: null,
    has_reminder: null
  };
  function getFilters() {
    return { ...filters };
  }
  function setFilters(newFilters) {
    filters = { ...filters, ...newFilters };
    console.log("[PlanFilters] Filters updated:", filters);
    window.dispatchEvent(new CustomEvent("filtersChanged", { detail: filters }));
  }
  function resetFilterState() {
    filters = {
      user_id: null,
      article_id: null,
      article_type: null,
      date_from: DEFAULT_DATE_FROM,
      date_to: DEFAULT_DATE_TO,
      financial_center_id: null,
      cost_center_id: null,
      search: null,
      has_recurring_plan: null,
      has_reminder: null
    };
    console.log("[PlanFilters] Filters reset to default:", filters);
    window.dispatchEvent(new CustomEvent("filtersChanged", { detail: filters }));
  }
  function readFiltersFromUI() {
    const userSelect = document.getElementById("filter-user");
    const articleSelect = document.getElementById("filter-article");
    const articleTypeSelect = document.getElementById("filter-article-type");
    const fcSelect = document.getElementById("filter-financial-center");
    const ccSelect = document.getElementById("filter-cost-center");
    const searchInput = document.getElementById("filter-search");
    filters.user_id = userSelect?.value ? Number(userSelect.value) : null;
    filters.article_id = articleSelect?.value ? Number(articleSelect.value) : null;
    filters.article_type = articleTypeSelect?.value || null;
    filters.financial_center_id = fcSelect?.value ? Number(fcSelect.value) : null;
    filters.cost_center_id = ccSelect?.value ? Number(ccSelect.value) : null;
    filters.search = searchInput?.value.trim() || null;
    const dateFromInput = document.getElementById("filter-date-from");
    const dateToInput = document.getElementById("filter-date-to");
    if (dateFromInput?.value) {
      filters.date_from = BudgetShared.DateFormatter.formatForAPI(dateFromInput.value);
    }
    if (dateToInput?.value) {
      filters.date_to = BudgetShared.DateFormatter.formatForAPI(dateToInput.value);
    }
    const filterRecurring = document.getElementById("filter-recurring");
    const filterWithReminder = document.getElementById("filter-with-reminder");
    filters.has_recurring_plan = filterRecurring?.checked ? true : null;
    filters.has_reminder = filterWithReminder?.checked ? true : null;
    console.log("[PlanFilters] Filters read from UI:", filters);
    window.dispatchEvent(new CustomEvent("filtersChanged", { detail: filters }));
  }
  function writeFiltersToUI() {
    const userSelect = document.getElementById("filter-user");
    const articleSelect = document.getElementById("filter-article");
    const articleTypeSelect = document.getElementById("filter-article-type");
    const fcSelect = document.getElementById("filter-financial-center");
    const ccSelect = document.getElementById("filter-cost-center");
    const searchInput = document.getElementById("filter-search");
    if (userSelect) userSelect.value = filters.user_id ? String(filters.user_id) : "";
    if (articleSelect) articleSelect.value = filters.article_id ? String(filters.article_id) : "";
    if (articleTypeSelect) articleTypeSelect.value = filters.article_type || "";
    if (fcSelect) fcSelect.value = filters.financial_center_id ? String(filters.financial_center_id) : "";
    if (ccSelect) ccSelect.value = filters.cost_center_id ? String(filters.cost_center_id) : "";
    if (searchInput) searchInput.value = filters.search || "";
    const dateFromInput = document.getElementById("filter-date-from");
    const dateToInput = document.getElementById("filter-date-to");
    if (dateFromInput && filters.date_from) {
      dateFromInput.value = BudgetShared.DateFormatter.formatForDisplay(filters.date_from);
    }
    if (dateToInput && filters.date_to) {
      dateToInput.value = BudgetShared.DateFormatter.formatForDisplay(filters.date_to);
    }
    const filterRecurring = document.getElementById("filter-recurring");
    const filterWithReminder = document.getElementById("filter-with-reminder");
    if (filterRecurring) filterRecurring.checked = !!filters.has_recurring_plan;
    if (filterWithReminder) filterWithReminder.checked = !!filters.has_reminder;
    console.log("[PlanFilters] Filters written to UI");
  }
  function initDefaultPeriodFilter() {
    const dateFromInput = document.getElementById("filter-date-from");
    const dateToInput = document.getElementById("filter-date-to");
    if (dateFromInput) {
      dateFromInput.value = BudgetShared.DateFormatter.formatForDisplay(DEFAULT_DATE_FROM);
    }
    if (dateToInput) {
      dateToInput.value = BudgetShared.DateFormatter.formatForDisplay(DEFAULT_DATE_TO);
    }
    console.log("[PlanFilters] Default period initialized:", DEFAULT_DATE_FROM, "to", DEFAULT_DATE_TO);
  }
  function countActiveFilters() {
    let count = 0;
    if (filters.date_from || filters.date_to) {
      count++;
    }
    if (filters.user_id) count++;
    if (filters.article_id) count++;
    if (filters.article_type) count++;
    if (filters.financial_center_id) count++;
    if (filters.cost_center_id) count++;
    if (filters.search) count++;
    if (filters.has_recurring_plan) count++;
    if (filters.has_reminder) count++;
    return count;
  }
  function updateFilterIndicator() {
    const indicator = document.getElementById("filter-indicator");
    if (!indicator) return;
    const activeFilters = countActiveFilters();
    if (activeFilters > 0) {
      indicator.textContent = activeFilters === 1 ? "1 активен" : `${activeFilters} активно`;
      indicator.classList.remove("hidden");
    } else {
      indicator.classList.add("hidden");
    }
  }
  function collapseFilters() {
    const checkbox = document.getElementById("filters-toggle");
    if (checkbox) {
      checkbox.checked = false;
    }
  }
  async function applyFilters() {
    readFiltersFromUI();
    if (typeof AdminFactsCommon !== "undefined") {
      AdminFactsCommon.syncFiltersUI(filters);
    }
    updateFilterIndicator();
    console.log("[PlanFilters] Filters applied, ready for data reload");
  }
  async function resetFilters() {
    resetFilterState();
    writeFiltersToUI();
    updateFilterIndicator();
    console.log("[PlanFilters] Filters reset, ready for data reload");
  }
  const PlanFilters = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    DEFAULT_DATE_FROM,
    DEFAULT_DATE_TO,
    applyFilters,
    collapseFilters,
    countActiveFilters,
    getFilters,
    initDefaultPeriodFilter,
    readFiltersFromUI,
    resetFilterState,
    resetFilters,
    setFilters,
    updateFilterIndicator,
    writeFiltersToUI
  });
  let currentPage = 0;
  const pageSize = 50;
  let totalFacts = 0;
  let factsData = [];
  let selectedFactIds$1 = /* @__PURE__ */ new Set();
  let remindersMap$1 = /* @__PURE__ */ new Map();
  function getCurrentPage() {
    return currentPage;
  }
  function setCurrentPage(page) {
    currentPage = page;
  }
  function getFactsData() {
    return factsData;
  }
  function getSelectedFactIds() {
    return new Set(selectedFactIds$1);
  }
  function clearSelection() {
    selectedFactIds$1.clear();
    updateBatchDeleteButton();
  }
  function setInnerHTML(element, htmlString) {
    element.textContent = "";
    const template = document.createElement("template");
    template.innerHTML = htmlString.trim();
    element.appendChild(template.content);
  }
  async function loadRemindersForFacts(factIds) {
    remindersMap$1.clear();
    if (!factIds || factIds.length === 0) return;
    try {
      const now = /* @__PURE__ */ new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];
      const params = new URLSearchParams({
        date_from: startDate,
        date_to: endDate,
        limit: "50"
      });
      const response = await fetch(`/api/v1/reminders/?${params}`, {
        credentials: "include"
      });
      if (!response.ok) {
        console.warn("[PlanFactsTable] Failed to load reminders:", response.status);
        return;
      }
      const data = await response.json();
      const factIdSet = new Set(factIds);
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((reminder) => {
          if (reminder && reminder.fact_id && factIdSet.has(reminder.fact_id)) {
            remindersMap$1.set(reminder.fact_id, reminder);
          }
        });
      }
    } catch (error) {
      console.error("[PlanFactsTable] Error loading reminders:", error);
    }
  }
  async function loadFacts$1() {
    const container = document.getElementById("facts-table-container");
    if (!container) {
      console.warn("[PlanFactsTable] Container not found");
      return;
    }
    setInnerHTML(
      container,
      '<div class="flex items-center justify-center py-8"><span class="loading loading-spinner loading-lg text-primary"></span></div>'
    );
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(currentPage * pageSize),
        record_type: "plan"
        // Filter by plan records only
      });
      const filters2 = getFilters();
      if (filters2.user_id) params.append("user_id", String(filters2.user_id));
      if (filters2.article_id) params.append("article_id", String(filters2.article_id));
      if (filters2.article_type) params.append("article_type", filters2.article_type);
      if (filters2.date_from) params.append("date_from", filters2.date_from);
      if (filters2.date_to) params.append("date_to", filters2.date_to);
      if (filters2.financial_center_id)
        params.append("financial_center_id", String(filters2.financial_center_id));
      if (filters2.cost_center_id) params.append("cost_center_id", String(filters2.cost_center_id));
      if (filters2.search) params.append("search", filters2.search);
      if (filters2.has_recurring_plan) params.append("has_recurring_plan", "true");
      if (filters2.has_reminder) params.append("has_reminder", "true");
      const [factsResponse, countResponse] = await Promise.all([
        fetch(`/api/v1/facts?${params}`),
        fetch(`/api/v1/facts/count?${params}`)
      ]);
      if (!factsResponse.ok || !countResponse.ok) {
        throw new Error("Failed to load facts");
      }
      const factsResponseData = await factsResponse.json();
      factsData = factsResponseData.facts || [];
      const countData = await countResponse.json();
      totalFacts = countData.total;
      await loadRemindersForFacts(factsData.map((f) => f.id));
      renderFactsTable(factsData);
      updateStats();
      updatePagination();
      if (typeof AdminFactsCommon !== "undefined") {
        AdminFactsCommon.syncFiltersUI(filters2);
      }
      if (typeof window.loadStats === "function") {
        window.loadStats();
      }
    } catch (error) {
      console.error("[PlanFactsTable] Error loading facts:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      container.textContent = "";
      const alert2 = document.createElement("div");
      alert2.className = "alert alert-error";
      const span = document.createElement("span");
      span.textContent = `❌ Ошибка загрузки: ${errorMessage}`;
      alert2.appendChild(span);
      container.appendChild(alert2);
    }
  }
  function truncateText(text, maxLength = 30) {
    if (text === "—") return text;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }
  function renderFactsTable(facts) {
    const container = document.getElementById("facts-table-container");
    if (!container) return;
    selectedFactIds$1.clear();
    updateBatchDeleteButton();
    if (facts.length === 0) {
      container.textContent = "";
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "text-center py-8 text-base-content/60";
      emptyDiv.textContent = "📅 Плановые записи не найдены. Измените фильтры или добавьте новые плановые записи.";
      container.appendChild(emptyDiv);
      return;
    }
    let tableHtml = `
    <div class="facts-desktop-table overflow-x-auto">
      <table class="table table-zebra table-sm">
        <thead>
          <tr>
            <th><input type="checkbox" class="checkbox checkbox-sm" id="select-all" onchange="window.PlanApp.FactsTable.toggleSelectAll(this)"></th>
            <th>ID</th>
            <th>📅 Дата</th>
            <th>🏦 Счет</th>
            <th>💼 МЗ</th>
            <th>📁 Категория</th>
            <th>💵 Сумма</th>
            <th>📝 Описание</th>
            <th>👤 Пользователь</th>
            <th class="text-center" title="Напоминание">🔔</th>
            <th class="text-center" title="Регламентный платеж">🔄</th>
            <th class="text-center" title="Создано offline">☁️</th>
            <th>⚙️ Действия</th>
          </tr>
        </thead>
        <tbody>
  `;
    let mobileHtml = `<div class="facts-mobile-list divide-y divide-base-200">`;
    facts.forEach((fact) => {
      let articleColorClass = "";
      if (fact.article_type === "expense") {
        articleColorClass = "text-error";
      } else if (fact.article_type === "income") {
        articleColorClass = "text-success";
      } else if (fact.article_type === "debit") {
        articleColorClass = "text-info";
      } else if (fact.article_type === "credit") {
        articleColorClass = "text-warning";
      }
      const description = fact.description || "—";
      const descriptionTruncated = truncateText(description, 30);
      const financialCenter = fact.financial_center_name || "—";
      const costCenter = fact.cost_center_name || "—";
      const formattedDate = BudgetShared.DateFormatter.formatForDisplay(fact.fact_date);
      const shortDate = formattedDate.slice(0, 5);
      const articleName = fact.article_name || "—";
      tableHtml += `
      <tr data-plan-id="${fact.id}">
        <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" value="${fact.id}" onchange="window.PlanApp.FactsTable.updateBatchDeleteButton()"></td>
        <td><code class="badge badge-ghost">${fact.id}</code></td>
        <td>${formattedDate}</td>
        <td class="max-w-xs truncate" title="${financialCenter}">${financialCenter}</td>
        <td class="max-w-xs truncate" title="${costCenter}">${costCenter}</td>
        <td><span class="${articleColorClass}">${articleName}</span></td>
        <td class="${articleColorClass} font-bold">${formatDesktopAmount(fact.amount, fact.article_type)}</td>
        <td class="max-w-xs truncate" title="${description}">${descriptionTruncated}</td>
        <td>${fact.user_name || "—"}</td>
        <td class="text-center">${remindersMap$1.has(fact.id) ? '<span class="text-info" title="Напоминание установлено">🔔</span>' : ""}</td>
        <td class="text-center">${fact.recurring_plan_id ? '<span class="text-secondary" title="Регламентный платеж">🔄</span>' : ""}</td>
        <td class="text-center" title="${fact.is_offline_sync ? "Создано offline" : ""}">${fact.is_offline_sync ? "☁️" : ""}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-xs btn-primary gap-1" onclick="showEditModal(${fact.id})">✏️</button>
            <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" data-fact-id="${fact.id}" onclick="event.stopPropagation(); deleteFact(${fact.id})" title="Удалить">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
      const mobileAmountClass = getMobileAmountClass(fact.article_type);
      const mobileAmount = formatMobileAmount(fact.amount, fact.article_type);
      const reminderIcon = remindersMap$1.has(fact.id) ? '<span class="text-info text-xs" title="Напоминание">🔔</span>' : "";
      const offlineIcon = fact.is_offline_sync ? '<span class="text-xs" title="Создано offline">☁️</span>' : "";
      const recurringIcon = fact.recurring_plan_id ? '<span class="text-secondary text-xs" title="Регламентный">🔄</span>' : "";
      mobileHtml += `
      <div class="transaction-item py-2" data-plan-id="${fact.id}" onclick="showEditModal(${fact.id})">
        <!-- Line 1: Badge + Category + Amount -->
        <div class="flex items-center gap-2">
          <span class="badge badge-info badge-xs shrink-0">План</span>
          <span class="flex-1 font-medium truncate">${articleName}</span>
          <span class="${mobileAmountClass} font-bold whitespace-nowrap">${mobileAmount}</span>
          ${recurringIcon}
          ${reminderIcon}
          ${offlineIcon}
        </div>
        <!-- Line 2: Date • Account • Description -->
        <div class="text-xs text-base-content/60 mt-1 truncate">
          ${shortDate} • ${financialCenter} • ${description}
        </div>
      </div>
    `;
    });
    tableHtml += `
        </tbody>
      </table>
    </div>
  `;
    mobileHtml += `</div>`;
    setInnerHTML(container, tableHtml + mobileHtml);
  }
  function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll(".fact-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = checkbox.checked;
      if (checkbox.checked) {
        selectedFactIds$1.add(parseInt(cb.value));
      } else {
        selectedFactIds$1.delete(parseInt(cb.value));
      }
    });
    updateBatchDeleteButton();
  }
  function updateBatchDeleteButton() {
    const checkboxes = document.querySelectorAll(".fact-checkbox:checked");
    selectedFactIds$1 = new Set(Array.from(checkboxes).map((cb) => parseInt(cb.value)));
    const btn = document.getElementById("batch-delete-btn");
    if (btn) {
      btn.disabled = selectedFactIds$1.size === 0;
      btn.textContent = selectedFactIds$1.size > 0 ? `🗑️ Удалить выбранные (${selectedFactIds$1.size})` : "🗑️ Удалить выбранные";
    }
  }
  function updateStats() {
    const totalElem = document.getElementById("stat-total");
    const pageInfoElem = document.getElementById("stat-page-info");
    if (totalElem) {
      totalElem.textContent = String(totalFacts);
    }
    if (pageInfoElem) {
      const startIdx = currentPage * pageSize + 1;
      const endIdx = Math.min((currentPage + 1) * pageSize, totalFacts);
      pageInfoElem.textContent = totalFacts > 0 ? `${startIdx}-${endIdx} из ${totalFacts}` : "0-0 из 0";
    }
  }
  function updatePagination() {
    const controls = document.getElementById("pagination-controls");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const pageInfo = document.getElementById("page-info");
    if (!controls) return;
    if (totalFacts > pageSize) {
      controls.style.display = "flex";
      if (prevBtn) prevBtn.disabled = currentPage === 0;
      if (nextBtn) nextBtn.disabled = (currentPage + 1) * pageSize >= totalFacts;
      if (pageInfo) {
        const totalPages = Math.ceil(totalFacts / pageSize);
        pageInfo.textContent = `Страница ${currentPage + 1} из ${totalPages}`;
      }
    } else {
      controls.style.display = "none";
    }
  }
  function previousPage() {
    if (currentPage > 0) {
      currentPage--;
      loadFacts$1();
    }
  }
  function nextPage() {
    if ((currentPage + 1) * pageSize < totalFacts) {
      currentPage++;
      loadFacts$1();
    }
  }
  const PlanFactsTable = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    clearSelection,
    getCurrentPage,
    getFactsData,
    getSelectedFactIds,
    loadFacts: loadFacts$1,
    nextPage,
    previousPage,
    setCurrentPage,
    toggleSelectAll,
    updateBatchDeleteButton
  });
  let currentAnalyticsMonth = null;
  let analyticsComparisonChart = null;
  let analyticsCategoriesChart = null;
  let analyticsData = null;
  function getCurrentAnalyticsMonth() {
    return currentAnalyticsMonth;
  }
  function setCurrentAnalyticsMonth(month) {
    currentAnalyticsMonth = month;
  }
  const MONTH_NAMES = [
    "Янв",
    "Фев",
    "Мар",
    "Апр",
    "Май",
    "Июн",
    "Июл",
    "Авг",
    "Сен",
    "Окт",
    "Ноя",
    "Дек"
  ];
  function initAnalyticsMonthButtons() {
    const container = document.getElementById("analytics-month-buttons");
    if (!container) return;
    const today = /* @__PURE__ */ new Date();
    for (let offset = 0; offset < 3; offset++) {
      const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
      const btn = document.createElement("button");
      btn.className = offset === 0 ? "join-item btn btn-primary" : "join-item btn btn-outline";
      btn.style.height = "3rem";
      btn.textContent = label;
      btn.dataset.month = yearMonth;
      btn.onclick = () => selectAnalyticsMonth(yearMonth, btn);
      container.appendChild(btn);
      if (offset === 0) {
        currentAnalyticsMonth = yearMonth;
      }
    }
  }
  async function selectAnalyticsMonth(month, clickedBtn) {
    currentAnalyticsMonth = month;
    const buttons = document.querySelectorAll("#analytics-month-buttons button");
    buttons.forEach((btn) => {
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-outline");
    });
    clickedBtn.classList.remove("btn-outline");
    clickedBtn.classList.add("btn-primary");
    await loadPlanAnalytics();
    if (typeof window.syncAnalyticsToFilters === "function") {
      await window.syncAnalyticsToFilters();
    }
  }
  function groupArticlesByType$1(flatNodes) {
    const groupedByType = {
      expense: [],
      income: [],
      debit: [],
      credit: []
    };
    flatNodes.forEach((node) => {
      if (groupedByType[node.type]) {
        groupedByType[node.type].push(node);
      }
    });
    return [
      ...groupedByType.expense,
      ...groupedByType.income,
      ...groupedByType.debit,
      ...groupedByType.credit
    ];
  }
  function buildArticleOptions(select, sortedNodes) {
    const colorMap = {
      expense: "rgb(239, 68, 68)",
      // Red
      income: "rgb(34, 197, 94)",
      // Green
      debit: "rgb(59, 130, 246)",
      // Blue
      credit: "rgb(251, 146, 60)"
      // Orange
    };
    sortedNodes.forEach((node) => {
      const option = document.createElement("option");
      option.value = String(node.id);
      const indent = "›  ".repeat(node.level);
      const icon = node.isLeaf ? "▸" : "📂";
      option.textContent = `${indent}${icon} ${node.name}`;
      option.dataset.type = node.type;
      if (colorMap[node.type]) {
        option.style.color = colorMap[node.type];
      }
      if (!node.isLeaf) {
        option.style.fontWeight = "bold";
        option.style.opacity = "0.7";
      }
      select.appendChild(option);
    });
  }
  async function loadAnalyticsCFOFilter() {
    try {
      const centers = await loadFinancialCenters$1();
      const select = document.getElementById("analytics-cfo-filter");
      if (!select) return;
      centers.forEach((center) => {
        const option = document.createElement("option");
        option.value = String(center.id);
        option.textContent = center.name;
        select.appendChild(option);
      });
    } catch (error) {
      console.error("[PlanAnalytics] Error loading CFO filter:", error);
    }
  }
  async function loadAnalyticsArticleFilter(articleType = null) {
    try {
      let url = "/api/v1/articles?limit=1000&sort_by=usage_count";
      if (articleType) {
        url += `&type=${articleType}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        console.warn("[PlanAnalytics] Failed to load articles:", response.status);
        return;
      }
      const data = await response.json();
      const articles = Array.isArray(data) ? data : data.articles || [];
      const select = document.getElementById("analytics-article");
      if (!select) return;
      const currentValue = select.value;
      select.textContent = "";
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Все категории";
      select.appendChild(defaultOption);
      const tree = buildArticleTree(articles);
      const flatNodes = flattenArticleTree(tree);
      const sortedNodes = groupArticlesByType$1(flatNodes);
      buildArticleOptions(select, sortedNodes);
      if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
        select.value = currentValue;
      }
    } catch (error) {
      console.error("[PlanAnalytics] Error loading article filter:", error);
    }
  }
  async function loadPlanAnalytics() {
    if (!currentAnalyticsMonth) {
      console.warn("[PlanAnalytics] No analytics month selected");
      return;
    }
    try {
      let url = `/api/v1/analytics/plans/monthly-comparison?planning_month=${currentAnalyticsMonth}`;
      const cfoFilter = document.getElementById("analytics-cfo-filter");
      if (cfoFilter && cfoFilter.value) {
        url += `&financial_center_id=${cfoFilter.value}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      analyticsData = await response.json();
      if (analyticsData) {
        updateAnalyticsSummary(analyticsData);
      }
      const hasData = analyticsData ? analyticsData.current_month.total_records > 0 || analyticsData.previous_month.total_records > 0 : false;
      const emptyState = document.getElementById("analytics-empty-state");
      const chartsGrid = document.getElementById("analytics-charts-grid");
      if (!hasData) {
        emptyState?.classList.remove("hidden");
        chartsGrid?.classList.add("hidden");
      } else {
        emptyState?.classList.add("hidden");
        chartsGrid?.classList.remove("hidden");
        if (analyticsData) {
          initComparisonChart();
          updateComparisonChart(analyticsData);
          initCategoriesChart();
          updateCategoriesChart(analyticsData);
        }
      }
    } catch (error) {
      console.error("[PlanAnalytics] Error loading plan analytics:", error);
      showToast$1("Ошибка загрузки аналитики: " + error.message, "error");
    }
  }
  async function loadCategoriesChartData() {
    if (!currentAnalyticsMonth) {
      console.warn("[PlanAnalytics] No analytics month selected");
      return;
    }
    try {
      let url = `/api/v1/analytics/plans/monthly-comparison?planning_month=${currentAnalyticsMonth}`;
      const cfoFilter = document.getElementById("analytics-cfo-filter");
      if (cfoFilter && cfoFilter.value) {
        url += `&financial_center_id=${cfoFilter.value}`;
      }
      const typeFilter = document.getElementById("analytics-article-type");
      if (typeFilter && typeFilter.value) {
        url += `&article_type=${typeFilter.value}`;
      }
      const articleFilter = document.getElementById("analytics-article");
      if (articleFilter && articleFilter.value) {
        url += `&article_id=${articleFilter.value}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (!analyticsCategoriesChart) {
        initCategoriesChart();
      }
      updateCategoriesChart(data);
    } catch (error) {
      console.error("[PlanAnalytics] Error loading categories chart data:", error);
    }
  }
  function updateAnalyticsSummary(data) {
    const formatAmount = (amount) => {
      return new Intl.NumberFormat("ru-RU", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    };
    const byType = data.current_month.by_type || {};
    const expenseElem = document.getElementById("analytics-expense");
    const incomeElem = document.getElementById("analytics-income");
    const debitElem = document.getElementById("analytics-debit");
    const creditElem = document.getElementById("analytics-credit");
    if (expenseElem) expenseElem.textContent = formatAmount(byType.expense || 0);
    if (incomeElem) incomeElem.textContent = formatAmount(byType.income || 0);
    if (debitElem) debitElem.textContent = formatAmount(byType.debit || 0);
    if (creditElem) creditElem.textContent = formatAmount(byType.credit || 0);
  }
  function initComparisonChart() {
    const chartDom = document.getElementById("chart-plan-comparison");
    if (!chartDom) return;
    if (analyticsComparisonChart) {
      analyticsComparisonChart.dispose();
    }
    analyticsComparisonChart = echarts.init(chartDom);
  }
  function initCategoriesChart() {
    const chartDom = document.getElementById("chart-plan-categories");
    if (!chartDom) return;
    if (analyticsCategoriesChart) {
      analyticsCategoriesChart.dispose();
    }
    analyticsCategoriesChart = echarts.init(chartDom);
  }
  function buildComparisonChartConfig(data) {
    const typeLabels = {
      expense: "Расходы",
      income: "Доходы",
      debit: "Списание",
      credit: "Пополнение"
    };
    const typeColors = {
      expense: "#ef4444",
      income: "#22c55e",
      debit: "#f59e0b",
      credit: "#3b82f6"
    };
    const types = ["expense", "income", "debit", "credit"];
    const currentByType = data.current_month.by_type || {};
    const previousByType = data.previous_month.by_type || {};
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: function(params) {
          let result = params[0].axisValue + "<br/>";
          params.forEach((param) => {
            const value = new Intl.NumberFormat("ru-RU").format(param.value);
            result += `${param.marker} ${param.seriesName}: ${value} ₽<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: [data.previous_month.month_name, data.current_month.month_name],
        bottom: 0
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "20%",
        top: "10%",
        containLabel: true
      },
      xAxis: {
        type: "category",
        data: types.map((t) => typeLabels[t]),
        axisLine: { lineStyle: { color: "#e5e7eb" } },
        axisTick: { lineStyle: { color: "#e5e7eb" } },
        axisLabel: { color: "#374151" }
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#374151",
          formatter: function(value) {
            if (value >= 1e6) return (value / 1e6).toFixed(1) + "M";
            if (value >= 1e3) return (value / 1e3).toFixed(0) + "K";
            return value;
          }
        },
        splitLine: {
          show: true,
          lineStyle: { color: "#e5e7eb", type: "dashed" }
        },
        axisLine: { show: true, lineStyle: { color: "#e5e7eb" } }
      },
      series: [
        {
          name: data.previous_month.month_name,
          type: "bar",
          data: types.map((t) => ({
            value: previousByType[t] || 0,
            itemStyle: { color: typeColors[t], opacity: 0.25 }
          })),
          barWidth: "30%"
        },
        {
          name: data.current_month.month_name,
          type: "bar",
          data: types.map((t) => ({
            value: currentByType[t] || 0,
            itemStyle: { color: typeColors[t] }
          })),
          barWidth: "30%"
        }
      ]
    };
  }
  function updateComparisonChart(data) {
    if (!analyticsComparisonChart) return;
    const option = buildComparisonChartConfig(data);
    analyticsComparisonChart.setOption(option);
  }
  function buildCategoriesChartConfig(data) {
    const categories = data.categories_comparison || [];
    if (categories.length === 0) {
      return {
        title: {
          text: "Нет данных",
          subtext: "Планы по категориям не найдены",
          left: "center",
          top: "center",
          textStyle: { fontSize: 14, color: "#999" }
        },
        xAxis: { show: false },
        yAxis: { show: false },
        series: []
      };
    }
    const topCategories = categories.slice(0, 10);
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: function(params) {
          let result = params[0].axisValue + "<br/>";
          params.forEach((param) => {
            const value = new Intl.NumberFormat("ru-RU").format(param.value);
            result += `${param.marker} ${param.seriesName}: ${value} ₽<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: [data.previous_month.month_name, data.current_month.month_name],
        bottom: 0
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "15%",
        top: "10%",
        containLabel: true
      },
      xAxis: {
        type: "category",
        data: topCategories.map((c) => c.category_name),
        axisLabel: {
          rotate: 30,
          interval: 0,
          fontSize: 10,
          formatter: function(value) {
            return value.length > 12 ? value.substring(0, 12) + "..." : value;
          }
        }
      },
      yAxis: {
        type: "value",
        axisLabel: {
          formatter: function(value) {
            if (value >= 1e6) return (value / 1e6).toFixed(1) + "M";
            if (value >= 1e3) return (value / 1e3).toFixed(0) + "K";
            return value;
          }
        }
      },
      series: [
        {
          name: data.previous_month.month_name,
          type: "bar",
          data: topCategories.map((c) => c.previous_month_total),
          itemStyle: { color: "#94a3b8", opacity: 0.5 }
        },
        {
          name: data.current_month.month_name,
          type: "bar",
          data: topCategories.map((c) => c.current_month_total),
          itemStyle: { color: "#3b82f6" }
        }
      ]
    };
  }
  function updateCategoriesChart(data) {
    if (!analyticsCategoriesChart) return;
    const option = buildCategoriesChartConfig(data);
    const categories = data.categories_comparison || [];
    analyticsCategoriesChart.setOption(option, categories.length === 0);
  }
  const PlanAnalytics = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    getCurrentAnalyticsMonth,
    initAnalyticsMonthButtons,
    loadAnalyticsArticleFilter,
    loadAnalyticsCFOFilter,
    loadCategoriesChartData,
    loadPlanAnalytics,
    selectAnalyticsMonth,
    setCurrentAnalyticsMonth
  });
  let isSyncInProgress = false;
  let syncDebounceTimer = null;
  function monthToDateRange(yearMonth) {
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      console.warn("[monthToDateRange] Invalid yearMonth format:", yearMonth);
      return { from: DEFAULT_DATE_FROM, to: DEFAULT_DATE_TO };
    }
    const [year, month] = yearMonth.split("-").map(Number);
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDayDate = new Date(year, month, 0);
    const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;
    return { from: firstDay, to: lastDay };
  }
  function dateRangeToMonth(dateFrom, dateTo) {
    if (!dateFrom || !dateTo) return null;
    const fromParts = dateFrom.split("-");
    const toParts = dateTo.split("-");
    if (fromParts.length !== 3 || toParts.length !== 3) return null;
    const [fromYear, fromMonth, fromDay] = fromParts;
    const [toYear, toMonth, toDay] = toParts;
    if (fromYear !== toYear || fromMonth !== toMonth) return null;
    if (fromDay !== "01") return null;
    const year = parseInt(fromYear);
    const month = parseInt(fromMonth);
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    if (parseInt(toDay) !== lastDayOfMonth) return null;
    return `${fromYear}-${fromMonth}`;
  }
  function debouncedSyncFiltersToAnalytics(options = {}, delay = 300) {
    if (syncDebounceTimer !== null) {
      clearTimeout(syncDebounceTimer);
      console.log("[FILTER_SYNC] Debounced - canceling pending sync");
    }
    syncDebounceTimer = window.setTimeout(() => {
      syncDebounceTimer = null;
      syncFiltersToAnalytics(options);
    }, delay);
  }
  async function syncFiltersToAnalytics(options = {}) {
    const { skipReload = false, updateMonth = true } = options;
    if (isSyncInProgress) {
      console.log("[syncFiltersToAnalytics] Sync already in progress, skipping");
      return;
    }
    isSyncInProgress = true;
    let needsReload = false;
    try {
      const filters2 = getFilters();
      if (updateMonth) {
        const monthFromRange = dateRangeToMonth(filters2.date_from, filters2.date_to);
        const currentAnalyticsMonth2 = getCurrentAnalyticsMonth();
        if (monthFromRange && monthFromRange !== currentAnalyticsMonth2) {
          console.log(
            "[syncFiltersToAnalytics] Month changed:",
            currentAnalyticsMonth2,
            "→",
            monthFromRange
          );
          setCurrentAnalyticsMonth(monthFromRange);
          const buttons = document.querySelectorAll("#analytics-month-buttons button");
          buttons.forEach((btn) => {
            const isSelected = btn.dataset.month === monthFromRange;
            btn.classList.toggle("btn-primary", isSelected);
            btn.classList.toggle("btn-outline", !isSelected);
          });
          needsReload = true;
        } else if (!monthFromRange && currentAnalyticsMonth2) {
          console.log("[syncFiltersToAnalytics] Partial/multi-month range detected, clearing month selection");
          const buttons = document.querySelectorAll("#analytics-month-buttons button");
          buttons.forEach((btn) => {
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-outline");
          });
        }
      }
      const filterArticleType = document.getElementById("filter-article-type");
      const analyticsArticleType = document.getElementById("analytics-article-type");
      if (filterArticleType && analyticsArticleType) {
        const newValue = filterArticleType.value || "";
        if (analyticsArticleType.value !== newValue) {
          console.log(
            "[syncFiltersToAnalytics] Article type changed:",
            analyticsArticleType.value,
            "→",
            newValue
          );
          analyticsArticleType.value = newValue;
          await loadAnalyticsArticleFilter(newValue || null);
          needsReload = true;
        }
      }
      const filterArticle = document.getElementById("filter-article");
      const analyticsArticle = document.getElementById("analytics-article");
      if (filterArticle && analyticsArticle) {
        const newValue = filterArticle.value || "";
        const optionExists = analyticsArticle.querySelector(`option[value="${newValue}"]`);
        if (optionExists && analyticsArticle.value !== newValue) {
          console.log("[syncFiltersToAnalytics] Article changed:", analyticsArticle.value, "→", newValue);
          analyticsArticle.value = newValue;
          needsReload = true;
        } else if (!optionExists && newValue) {
          console.log("[syncFiltersToAnalytics] Article option not found in analytics dropdown, skipping");
        }
      }
      const filterFC = document.getElementById("filter-financial-center");
      const analyticsCFO = document.getElementById("analytics-cfo-filter");
      if (filterFC && analyticsCFO) {
        const newValue = filterFC.value || "";
        if (analyticsCFO.value !== newValue) {
          console.log("[syncFiltersToAnalytics] CFO changed:", analyticsCFO.value, "→", newValue);
          analyticsCFO.value = newValue;
          needsReload = true;
        }
      }
      if (needsReload && !skipReload) {
        console.log("[syncFiltersToAnalytics] Reloading charts...");
        await loadPlanAnalytics();
      }
    } catch (error) {
      console.error("[syncFiltersToAnalytics] Error during sync:", error);
    } finally {
      isSyncInProgress = false;
    }
  }
  async function syncAnalyticsToFilters(options = {}) {
    const { skipReload = false, updateDateRange = true } = options;
    if (isSyncInProgress) {
      console.log("[syncAnalyticsToFilters] Sync already in progress, skipping");
      return;
    }
    isSyncInProgress = true;
    let needsReload = false;
    try {
      const currentAnalyticsMonth2 = getCurrentAnalyticsMonth();
      if (updateDateRange && currentAnalyticsMonth2) {
        const { from, to } = monthToDateRange(currentAnalyticsMonth2);
        const filters2 = getFilters();
        if (filters2.date_from !== from || filters2.date_to !== to) {
          console.log(
            "[syncAnalyticsToFilters] Date range changed:",
            filters2.date_from,
            "-",
            filters2.date_to,
            "→",
            from,
            "-",
            to
          );
          setFilters({ date_from: from, date_to: to });
          const dateFromInput = document.getElementById("filter-date-from");
          const dateToInput = document.getElementById("filter-date-to");
          if (dateFromInput) {
            dateFromInput.value = BudgetShared.DateFormatter.formatForDisplay(from);
          }
          if (dateToInput) {
            dateToInput.value = BudgetShared.DateFormatter.formatForDisplay(to);
          }
          needsReload = true;
        }
      }
      const analyticsArticleType = document.getElementById("analytics-article-type");
      const filterArticleType = document.getElementById("filter-article-type");
      const filterArticle = document.getElementById("filter-article");
      if (analyticsArticleType && filterArticleType) {
        const newValue = analyticsArticleType.value || "";
        if (filterArticleType.value !== newValue) {
          console.log("[syncAnalyticsToFilters] Article type changed:", filterArticleType.value, "→", newValue);
          filterArticleType.value = newValue;
          setFilters({ article_type: newValue || null });
          if (filterArticle) {
            filterArticle.value = "";
            setFilters({ article_id: null });
            console.log("[syncAnalyticsToFilters] Article filter reset due to type change");
          }
          needsReload = true;
        }
      }
      const analyticsArticle = document.getElementById("analytics-article");
      if (analyticsArticle && filterArticle) {
        const newValue = analyticsArticle.value || "";
        const optionExists = filterArticle.querySelector(`option[value="${newValue}"]`);
        if (optionExists && filterArticle.value !== newValue) {
          console.log("[syncAnalyticsToFilters] Article changed:", filterArticle.value, "→", newValue);
          filterArticle.value = newValue;
          setFilters({ article_id: parseInt(newValue) || null });
          needsReload = true;
        } else if (!optionExists && newValue) {
          console.log("[syncAnalyticsToFilters] Article option not found in filter dropdown, skipping");
        }
      }
      const analyticsCFO = document.getElementById("analytics-cfo-filter");
      const filterFC = document.getElementById("filter-financial-center");
      if (analyticsCFO && filterFC) {
        const newValue = analyticsCFO.value || "";
        if (filterFC.value !== newValue) {
          console.log("[syncAnalyticsToFilters] CFO changed:", filterFC.value, "→", newValue);
          filterFC.value = newValue;
          setFilters({ financial_center_id: parseInt(newValue) || null });
          needsReload = true;
        }
      }
      if (needsReload && !skipReload) {
        console.log("[syncAnalyticsToFilters] Reloading facts table with filters:", {
          article_type: filterArticleType?.value || null,
          article_id: filterArticle?.value || null,
          financial_center_id: filterFC?.value || null
        });
        setCurrentPage(0);
        await loadFacts$1();
        updateFilterIndicator();
      }
    } catch (error) {
      console.error("[syncAnalyticsToFilters] Error during sync:", error);
    } finally {
      isSyncInProgress = false;
    }
  }
  const FilterAnalyticsSync = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    dateRangeToMonth,
    debouncedSyncFiltersToAnalytics,
    monthToDateRange,
    syncAnalyticsToFilters,
    syncFiltersToAnalytics
  });
  const logCrud = new Logger("[PLAN_CRUD]", "PLAN");
  let currentRecurringPlan = null;
  const deletingFactIds = /* @__PURE__ */ new Set();
  let recurringDeleteResolveCallback = null;
  let recurringEndDateCalendarWidget = null;
  function getCurrentRecurringPlan() {
    return currentRecurringPlan;
  }
  function setCurrentRecurringPlan(plan) {
    currentRecurringPlan = plan;
  }
  function populateRecurringPlanInfo(plan) {
    logCrud.debug("[POPULATE] populating recurring plan info:", plan);
    if (!plan) {
      logCrud.warn("[POPULATE] Plan is null/undefined, skipping");
      return;
    }
    const statusBadge = document.getElementById("edit-recurring-status");
    if (statusBadge) {
      if (plan.is_active) {
        statusBadge.textContent = "Активен";
        statusBadge.className = "badge badge-sm badge-success";
      } else {
        statusBadge.textContent = "Приостановлен";
        statusBadge.className = "badge badge-sm badge-warning";
      }
    }
    const frequencyEl = document.getElementById("edit-recurring-frequency");
    if (frequencyEl) {
      frequencyEl.textContent = plan.frequency_display || getFrequencyDisplayText(plan.frequency_type, plan.frequency_value);
    }
    const nextDateEl = document.getElementById("edit-recurring-next-date");
    if (nextDateEl) {
      if (plan.next_generation_date) {
        nextDateEl.textContent = BudgetShared.DateFormatter.formatForDisplay(plan.next_generation_date);
      } else {
        nextDateEl.textContent = plan.is_active ? "—" : "Приостановлено";
      }
    }
    const periodEl = document.getElementById("edit-recurring-period");
    if (periodEl) {
      const startStr = BudgetShared.DateFormatter.formatForDisplay(plan.start_date);
      if (plan.end_date) {
        const endStr = BudgetShared.DateFormatter.formatForDisplay(plan.end_date);
        periodEl.textContent = `${startStr} — ${endStr}`;
      } else if (plan.occurrences_count) {
        periodEl.textContent = `с ${startStr} (${plan.occurrences_count} повторений)`;
      } else {
        periodEl.textContent = `с ${startStr} (бессрочно)`;
      }
    }
    const generatedEl = document.getElementById("edit-recurring-generated");
    if (generatedEl) {
      if (plan.occurrences_count) {
        generatedEl.textContent = `${plan.occurrences_generated} / ${plan.occurrences_count}`;
      } else {
        generatedEl.textContent = String(plan.occurrences_generated);
      }
    }
    const endDateInput = document.getElementById("edit-template-end-date");
    if (endDateInput && plan.end_date) {
      endDateInput.value = BudgetShared.DateFormatter.formatForDisplay(plan.end_date);
    } else if (endDateInput) {
      endDateInput.value = "";
    }
    const isActiveCheckbox = document.getElementById("edit-template-is-active");
    if (isActiveCheckbox) {
      isActiveCheckbox.checked = plan.is_active;
    }
  }
  function updateEditCategoryTypeBadge(type) {
    const badge = document.getElementById("edit-category-type-label");
    if (!badge) return;
    const typeConfig = {
      expense: { text: "Расход", class: "badge-error" },
      income: { text: "Доход", class: "badge-success" },
      debit: { text: "Списание", class: "badge-info" },
      credit: { text: "Пополнение", class: "badge-warning" }
    };
    const config = typeConfig[type] || typeConfig.expense;
    badge.textContent = config.text;
    badge.className = `badge badge-sm ${config.class}`;
  }
  function openAddPlanModal() {
    const modalId = "modal_add_plan";
    const form = document.getElementById("form_modal_add_plan");
    const submitBtn = form?.querySelector(".save-btn");
    if (submitBtn) {
      submitBtn.disabled = false;
      delete submitBtn.dataset.originalHtml;
    }
    if (typeof createCategoryTreeSelect !== "undefined" && createCategoryTreeSelect) {
      createCategoryTreeSelect.options.financialCenterId = null;
      createCategoryTreeSelect.clearSelection();
      logCrud.debug("[MODAL_CREATE] Plan modal: FC reset and selection cleared");
    }
    prefillReminderDateTime(modalId);
    const modal = document.getElementById(modalId);
    if (modal && modal.showModal) {
      modal.showModal();
      if (!modal.dataset.backdropHandlerAdded) {
        modal.addEventListener("click", (e) => {
          const modalBox = modal.querySelector(".modal-box");
          if (modalBox && !modalBox.contains(e.target)) {
            modal.close();
          }
        });
        modal.dataset.backdropHandlerAdded = "true";
      }
      togglePlanMode(modalId);
    }
  }
  async function showEditModal(factId) {
    logCrud.debug("[SHOW_EDIT_MODAL] Called with factId:", factId);
    const factsData2 = getFactsData();
    logCrud.debug("[SHOW_EDIT_MODAL] factsData length:", factsData2?.length);
    const fact = factsData2.find((f) => f.id === factId);
    if (!fact) {
      logCrud.error("[SHOW_EDIT_MODAL] Fact not found in factsData! factId:", factId);
      logCrud.error("[SHOW_EDIT_MODAL] Available fact IDs:", factsData2?.map((f) => f.id));
      return;
    }
    logCrud.debug("[SHOW_EDIT_MODAL] Fact found:", fact);
    document.getElementById("edit-id").value = String(fact.id);
    document.getElementById("edit-amount").value = String(parseFloat(String(fact.amount)));
    document.getElementById("edit-date").value = BudgetShared.DateFormatter.formatForDisplay(fact.fact_date);
    document.getElementById("edit-description").value = fact.description || "";
    const fcDropdown = document.getElementById("edit-financial-center");
    if (fcDropdown.options.length <= 1) {
      logCrud.debug("[Edit Modal] Financial center dropdown not loaded, loading now...");
      await loadFinancialCenters();
    }
    if (fact.financial_center_id) {
      const fcOption = Array.from(fcDropdown.options).find((opt) => Number(opt.value) === fact.financial_center_id);
      if (fcOption) {
        fcDropdown.value = String(fact.financial_center_id);
        logCrud.debug("[Edit Modal] Set financial center to:", fact.financial_center_id);
      } else {
        logCrud.warn("[Edit Modal] Financial center not found in dropdown:", fact.financial_center_id, "(may be archived/inactive)");
      }
    } else {
      fcDropdown.value = "";
    }
    const ccDropdown = document.getElementById("edit-cost-center");
    if (ccDropdown.options.length <= 1) {
      logCrud.debug("[Edit Modal] Cost center dropdown not loaded, loading now...");
      await loadCostCenters();
    }
    if (fact.cost_center_id) {
      const ccOption = Array.from(ccDropdown.options).find((opt) => Number(opt.value) === fact.cost_center_id);
      if (ccOption) {
        ccDropdown.value = String(fact.cost_center_id);
        logCrud.debug("[Edit Modal] Set cost center to:", fact.cost_center_id);
      } else {
        logCrud.warn("[Edit Modal] Cost center not found in dropdown:", fact.cost_center_id, "(may be archived/inactive)");
      }
    } else {
      ccDropdown.value = "";
    }
    const recurringPlanIdField = document.getElementById("edit-recurring-plan-id");
    const recurringInfoDiv = document.getElementById("edit-recurring-info");
    const reminderContainer = document.getElementById("edit-reminder-container");
    const templateFieldsDiv = document.getElementById("edit-template-fields");
    currentRecurringPlan = null;
    if (recurringPlanIdField) {
      recurringPlanIdField.value = fact.recurring_plan_id ? String(fact.recurring_plan_id) : "";
    }
    logCrud.debug("[EDIT MODAL] Fact loaded:", fact);
    logCrud.debug("[EDIT MODAL] record_type:", fact.record_type);
    logCrud.debug("[EDIT MODAL] recurring_plan_id:", fact.recurring_plan_id);
    logCrud.debug("[SHOW_EDIT_MODAL] Opening modal...");
    const modal = document.getElementById("edit-modal");
    if (!modal) {
      logCrud.error("[SHOW_EDIT_MODAL] CRITICAL: Modal element not found! #edit-modal");
      return;
    }
    logCrud.debug("[SHOW_EDIT_MODAL] Modal element found, calling showModal()");
    modal.showModal();
    logCrud.debug("[SHOW_EDIT_MODAL] Modal opened successfully");
    if (!modal.dataset.backdropHandlerAdded) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.close();
        }
      });
      modal.dataset.backdropHandlerAdded = "true";
    }
    if (!fact.recurring_plan_id) {
      logCrud.debug("[EDIT_MODAL] Fact has NO recurring_plan_id, hiding recurring info");
      if (recurringInfoDiv) {
        recurringInfoDiv.classList.add("hidden");
      }
      if (reminderContainer) reminderContainer.classList.remove("hidden");
      if (templateFieldsDiv) templateFieldsDiv.classList.add("hidden");
    } else {
      logCrud.debug("[EDIT_MODAL] Fact has recurring_plan_id, loading plan details asynchronously...");
      if (reminderContainer) reminderContainer.classList.add("hidden");
      if (templateFieldsDiv) templateFieldsDiv.classList.add("hidden");
      const singleRadio = document.querySelector('input[name="edit_scope"][value="single"]');
      if (singleRadio) singleRadio.checked = true;
      if (recurringInfoDiv) {
        recurringInfoDiv.innerHTML = `
        <div class="flex items-center justify-center py-4">
          <span class="loading loading-spinner loading-md text-primary"></span>
          <span class="ml-2">Загрузка данных регламентного платежа...</span>
        </div>
      `;
        recurringInfoDiv.classList.remove("hidden");
      }
      (async () => {
        try {
          logCrud.debug("[EDIT_MODAL] Fetching recurring plan:", fact.recurring_plan_id);
          const planResponse = await fetch(
            `/api/v1/recurring-plans/${fact.recurring_plan_id}`,
            { credentials: "include" }
          );
          logCrud.debug("[EDIT_MODAL] Recurring plan API response status:", planResponse.status);
          if (!planResponse.ok) {
            logCrud.error("[EDIT_MODAL] Failed to load recurring plan:", planResponse.status, planResponse.statusText);
            if (recurringInfoDiv) {
              recurringInfoDiv.innerHTML = `
              <div class="alert alert-warning">
                <span>⚠️ Не удалось загрузить данные регламентного платежа</span>
              </div>
            `;
            }
            return;
          }
          currentRecurringPlan = await planResponse.json();
          logCrud.debug("[EDIT_MODAL] Recurring plan loaded successfully:", currentRecurringPlan);
          if (recurringInfoDiv) {
            recurringInfoDiv.innerHTML = "";
          }
          populateRecurringPlanInfo(currentRecurringPlan);
          logCrud.debug("[EDIT_MODAL] Recurring plan info populated");
        } catch (error) {
          logCrud.error("[EDIT_MODAL] Error loading recurring plan:", error);
          if (recurringInfoDiv) {
            recurringInfoDiv.innerHTML = `
            <div class="alert alert-error">
              <span>❌ Ошибка: ${escapeHtml(error.message)}</span>
            </div>
          `;
          }
        }
      })();
    }
    const selectedArticle = allCategories.find((a) => a.id === fact.article_id);
    const categoryType = selectedArticle ? selectedArticle.type : "expense";
    updateEditCategoryTypeBadge(categoryType);
    if (editCategoryTreeSelect) {
      editCategoryTreeSelect.destroy();
      editCategoryTreeSelect = null;
    }
    const editSelect = document.getElementById("edit-article");
    if (editSelect) {
      editSelect.innerHTML = '<option value="" disabled hidden>-- Выберите категорию --</option>';
      editCategoryTreeSelect = new BudgetShared.ChoicesCategoryTree("#edit-article", {
        type: categoryType,
        showLeafOnly: true,
        mode: "edit",
        // ✅ Edit mode - preserves category even on initial FC filter
        financialCenterId: fact.financial_center_id,
        onCategoryChange: (category) => {
          logCrud.debug("Category changed in edit modal:", category);
        }
      });
      const initCheckInterval = setInterval(async () => {
        if (editCategoryTreeSelect && editCategoryTreeSelect.choices && editCategoryTreeSelect.categoryMap && editCategoryTreeSelect.categoryMap.size > 0) {
          const choicesStore = editCategoryTreeSelect.choices._store?.choices || [];
          logCrud.debug("[Edit Modal] Init check - choices loaded:", choicesStore.length, "article_id:", fact.article_id);
          if (choicesStore.length > 0) {
            clearInterval(initCheckInterval);
            if (editCategoryTreeSelect.categoryMap.has(fact.article_id)) {
              logCrud.debug("[Edit Modal] Setting category to:", fact.article_id);
              await editCategoryTreeSelect.setSelectedCategory(fact.article_id);
              const selectedValue = editSelect.value;
              logCrud.debug("[Edit Modal] Category set. Dropdown value:", selectedValue);
            } else {
              logCrud.warn("[Edit Modal] Category not found in map:", fact.article_id, "(may be archived/inactive)");
            }
            await filterCostCenterDropdown("#edit-form", fact.financial_center_id);
          }
        }
      }, 150);
      setTimeout(() => {
        clearInterval(initCheckInterval);
        logCrud.warn("[Edit Modal] Initialization timeout - giving up after 10 seconds");
      }, 1e4);
    }
    const editFcSelect = document.getElementById("edit-financial-center");
    if (editFcSelect && editCategoryTreeSelect) {
      ModalListenerManager.registerListener(editFcSelect, "change", async (e) => {
        const fcId = editFcSelect.value ? parseInt(editFcSelect.value) : null;
        logCrud.debug(`[plan.html] 🔄 Financial Center changed in edit modal:`, {
          newFcId: fcId,
          currentCategoryValue: editCategoryTreeSelect ? editCategoryTreeSelect.element ? editCategoryTreeSelect.element.value : null : null
        });
        e.stopPropagation();
        e.stopImmediatePropagation();
        logCrud.debug("[FC_CHANGE] Stopped event propagation");
        if (editCategoryTreeSelect) {
          logCrud.debug("[FC_CHANGE] Updating category tree with new FC");
          await editCategoryTreeSelect.updateFinancialCenter(fcId);
          logCrud.debug("[FC_CHANGE] Category tree updated successfully");
        }
        await filterCostCenterDropdown("#edit-form", fcId);
        await new Promise((resolve) => setTimeout(resolve, 50));
        logCrud.debug("[FC_CHANGE] DOM settled, category dropdown ready");
      });
    }
    const editDateInput = document.getElementById("edit-date");
    if (editDateInput) {
      if (editDateCalendar) {
        editDateCalendar.destroy();
        editDateCalendar = null;
      }
      editDateCalendar = new BudgetShared.CalendarWidget({
        mode: "single",
        inputElement: editDateInput,
        onSelect: (date) => {
          logCrud.debug("Выбрана дата для edit modal:", date);
        }
      });
    }
    const reminderCheckbox = document.getElementById("edit-enable-reminder");
    const reminderSettingsDiv = document.getElementById("edit-reminder-settings");
    const reminderStatusBadge = document.getElementById("edit-reminder-status");
    if (reminderCheckbox) reminderCheckbox.checked = false;
    resetEditReminderFields();
    if (reminderSettingsDiv) reminderSettingsDiv.classList.add("hidden");
    if (reminderStatusBadge) {
      reminderStatusBadge.classList.add("hidden");
      reminderStatusBadge.className = "badge badge-sm badge-ghost hidden";
      reminderStatusBadge.textContent = "";
    }
    const reminder = remindersMap.get(factId);
    if (reminder) {
      if (reminderCheckbox) reminderCheckbox.checked = true;
      populateEditReminderFields(reminder.reminder_datetime);
      if (reminderSettingsDiv) reminderSettingsDiv.classList.remove("hidden");
      initEditReminderCalendarWidget();
      if (reminderStatusBadge && reminder.status) {
        const badge = getReminderStatusBadge(reminder.status);
        reminderStatusBadge.textContent = badge.text;
        reminderStatusBadge.className = `badge badge-sm ${badge.class}`;
        reminderStatusBadge.classList.remove("hidden");
      }
    }
  }
  function closeEditModal() {
    const modal = document.getElementById("edit-modal");
    const form = document.getElementById("edit-form");
    if (modal) {
      modal.close();
    }
    if (form) {
      form.reset();
    }
    currentRecurringPlan = null;
    logCrud.debug("[CRUD] Edit modal closed and cleaned up");
  }
  async function deleteFact(factId) {
    if (deletingFactIds.has(factId)) {
      logCrud.warn("[CRUD] Delete already in progress for fact:", factId);
      return;
    }
    const factsData2 = getFactsData();
    const fact = factsData2.find((f) => f.id === factId);
    let deleteMode = "single";
    if (fact && fact.recurring_plan_id) {
      const choice = await showRecurringDeleteDialog();
      if (!choice) {
        return;
      }
      deleteMode = choice;
    } else {
      const confirmed = await showConfirmDialog(
        "Вы уверены, что хотите удалить эту транзакцию? Это действие необратимо.",
        "🗑️ Удаление транзакции"
      );
      if (!confirmed) {
        return;
      }
    }
    const button = document.querySelector(`button[data-fact-id="${factId}"]`);
    deletingFactIds.add(factId);
    if (button) {
      button.disabled = true;
      button.classList.add("loading", "loading-spinner");
    }
    try {
      if (deleteMode === "all" && fact && fact.recurring_plan_id) {
        const recurringPlanId = fact.recurring_plan_id;
        const factIdsToDelete = factsData2.filter((f) => f.recurring_plan_id === recurringPlanId).map((f) => f.id);
        logCrud.debug(`[CRUD] Deleting ${factIdsToDelete.length} recurring facts with recurring_plan_id=${recurringPlanId}`);
        const response = await fetch("/api/v1/facts/batch-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(factIdsToDelete)
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || `HTTP error! status: ${response.status}`);
        }
        deletingFactIds.delete(factId);
        await loadFacts$1();
        showToast$1(`Удалено ${factIdsToDelete.length} регламентных записей`, "success");
      } else {
        const response = await fetch(`/api/v1/facts/${factId}`, {
          method: "DELETE"
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || `HTTP error! status: ${response.status}`);
        }
        deletingFactIds.delete(factId);
        await loadFacts$1();
        showToast$1("Факт успешно удален", "success");
      }
    } catch (error) {
      logCrud.error("[CRUD] Error deleting fact:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      deletingFactIds.delete(factId);
      await loadFacts$1();
      showToast$1("Ошибка: " + errorMessage, "error");
    }
  }
  async function deleteFromEditModal() {
    const factIdInput = document.getElementById("edit-id");
    if (!factIdInput || !factIdInput.value) {
      logCrud.warn("[CRUD] deleteFromEditModal - No fact ID found");
      return;
    }
    const factId = parseInt(factIdInput.value);
    if (isNaN(factId)) {
      logCrud.error("[CRUD] deleteFromEditModal - Invalid fact ID:", factIdInput.value);
      return;
    }
    closeEditModal();
    await deleteFact(factId);
  }
  function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  async function showConfirmDialog(message, title) {
    return await BudgetShared.ConfirmDialog.show({
      title,
      message,
      confirmText: "Удалить",
      cancelText: "Отмена",
      confirmClass: "btn-error"
    });
  }
  async function showConfirmDialogWithCheckbox(message, title, options = {}) {
    logCrud.debug("[CONFIRM_DIALOG] Showing confirmation dialog:", title);
    return new Promise((resolve) => {
      const modalId = "confirm-dialog-checkbox-modal";
      const checkboxId = options.checkboxId || "confirm-checkbox";
      const modalHTML = `
      <div class="modal modal-open" id="${modalId}">
        <div class="modal-box">
          <h2 class="text-base sm:text-lg font-semibold mb-1 sm:mb-2">${escapeHtml(title)}</h2>
          <p class="py-4">${escapeHtml(message)}</p>
          ${options.checkboxLabel ? `
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-2">
                <input type="checkbox" id="${checkboxId}" class="checkbox checkbox-primary"
                       ${options.checkboxDefault ? "checked" : ""}>
                <span class="label-text">${escapeHtml(options.checkboxLabel)}</span>
              </label>
            </div>
          ` : ""}
          <div class="modal-action">
            <button class="btn" id="confirm-cancel-btn">Отмена</button>
            <button class="btn btn-error" id="confirm-ok-btn">Удалить</button>
          </div>
        </div>
      </div>
    `;
      document.body.insertAdjacentHTML("beforeend", modalHTML);
      const modal = document.getElementById(modalId);
      const okBtn = document.getElementById("confirm-ok-btn");
      const cancelBtn = document.getElementById("confirm-cancel-btn");
      const checkbox = document.getElementById(checkboxId);
      const cleanup = () => {
        logCrud.debug("[CONFIRM_DIALOG] Cleaning up confirmation dialog");
        modal.remove();
      };
      okBtn.addEventListener("click", () => {
        cleanup();
        const checkboxValue = checkbox ? checkbox.checked : false;
        logCrud.debug("[CONFIRM_DIALOG] User confirmed, checkbox:", checkboxValue);
        resolve({ result: true, checkboxValue });
      });
      cancelBtn.addEventListener("click", () => {
        cleanup();
        logCrud.debug("[CONFIRM_DIALOG] User cancelled");
        resolve({ result: false, checkboxValue: false });
      });
    });
  }
  function showRecurringDeleteDialog() {
    return new Promise((resolve) => {
      const modal = document.getElementById("recurring-delete-modal");
      if (!modal) {
        logCrud.error("[CRUD] Recurring delete modal not found");
        resolve(null);
        return;
      }
      recurringDeleteResolveCallback = resolve;
      modal.showModal();
    });
  }
  function recurringDeleteResolve(choice) {
    const modal = document.getElementById("recurring-delete-modal");
    if (modal) {
      modal.close();
    }
    if (recurringDeleteResolveCallback) {
      recurringDeleteResolveCallback(choice);
      recurringDeleteResolveCallback = null;
    }
  }
  function getFrequencyDisplayText(type, value) {
    logCrud.debug(`[CRUD] getFrequencyDisplayText: type=${type}, value=${value}`);
    switch (type) {
      case "monthly":
        return value ? `Каждое ${value}-е число месяца` : "Ежемесячно";
      case "quarterly":
        return value ? `Каждое ${value}-е число квартала` : "Ежеквартально";
      case "yearly":
        if (!value) return "Ежегодно";
        const month = Math.floor(value / 100);
        const day = value % 100;
        const monthNames = [
          "января",
          "февраля",
          "марта",
          "апреля",
          "мая",
          "июня",
          "июля",
          "августа",
          "сентября",
          "октября",
          "ноября",
          "декабря"
        ];
        const monthName = monthNames[month - 1] || "";
        logCrud.debug(`[CRUD] Yearly decoded: ${value} → ${day} ${monthName}`);
        return `Ежегодно, ${day} ${monthName}`;
      default:
        logCrud.warn(`[CRUD] Unknown frequency type: ${type}`);
        return type;
    }
  }
  function updateFrequencyFields(modalId) {
    const frequencySelect = document.querySelector(
      `#${modalId} select[name="frequency_type"]`
    );
    const monthdayPicker = document.getElementById(`monthday-picker-${modalId}`);
    const yearlyPicker = document.getElementById(`yearly-picker-${modalId}`);
    logCrud.debug("[CRUD] updateFrequencyFields called, modalId:", modalId);
    if (!frequencySelect) return;
    const frequency = frequencySelect.value;
    logCrud.debug("[CRUD] Selected frequency:", frequency);
    if (monthdayPicker) {
      monthdayPicker.classList.toggle("hidden", frequency !== "monthly" && frequency !== "quarterly");
    }
    if (yearlyPicker) {
      yearlyPicker.classList.toggle("hidden", frequency !== "yearly");
    }
    updateRecurringPreview(modalId);
  }
  function updateYearlyFrequencyValue(modalId) {
    const monthSelect = document.querySelector(
      `#${modalId} select[name="frequency_value_month"]`
    );
    const daySelect = document.querySelector(
      `#${modalId} select[name="frequency_value_day"]`
    );
    const hiddenInput = document.querySelector(
      `#${modalId} input[name="frequency_value_yearly"]`
    );
    if (!monthSelect || !daySelect || !hiddenInput) return;
    const month = parseInt(monthSelect.value);
    const day = parseInt(daySelect.value);
    logCrud.debug(`[CRUD] updateYearlyFrequencyValue: month=${month}, day=${day}`);
    if (!month || !day) {
      hiddenInput.value = "";
      updateRecurringPreview(modalId);
      return;
    }
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const maxDay = daysInMonth[month - 1];
    if (day > maxDay) {
      const monthNames = [
        "Январь",
        "Февраль",
        "Март",
        "Апрель",
        "Май",
        "Июнь",
        "Июль",
        "Август",
        "Сентябрь",
        "Октябрь",
        "Ноябрь",
        "Декабрь"
      ];
      alert(`${monthNames[month - 1]} имеет только ${maxDay} дней. Выберите день 1-${maxDay}.`);
      daySelect.value = "";
      hiddenInput.value = "";
      logCrud.warn(`[CRUD] Invalid day ${day} for month ${month}`);
      return;
    }
    const frequencyValue = month * 100 + day;
    hiddenInput.value = String(frequencyValue);
    logCrud.debug(`[CRUD] Encoded frequency_value: ${frequencyValue} (MMDD format)`);
    updateRecurringPreview(modalId);
  }
  function updateDurationFields(modalId) {
    const durationSelect = document.querySelector(
      `#${modalId} select[name="duration_type"]`
    );
    const occurrencesField = document.getElementById(`occurrences-field-${modalId}`);
    const endDateField = document.getElementById(`end-date-field-${modalId}`);
    if (!durationSelect) return;
    const type = durationSelect.value;
    logCrud.debug("[CRUD] updateDurationFields - Duration type selected:", type);
    if (!type || type === "") {
      if (occurrencesField) occurrencesField.classList.add("hidden");
      if (endDateField) endDateField.classList.add("hidden");
      return;
    }
    if (occurrencesField) {
      occurrencesField.classList.toggle("hidden", type !== "count");
    }
    if (endDateField) {
      endDateField.classList.toggle("hidden", type !== "end_date");
      const endDateInput = document.getElementById(`recurring_end_date_${modalId}`);
      if (type === "end_date" && endDateInput) {
        if (!recurringEndDateCalendarWidget && typeof BudgetShared !== "undefined" && BudgetShared.CalendarWidget) {
          recurringEndDateCalendarWidget = new BudgetShared.CalendarWidget({
            inputElement: endDateInput,
            mode: "single",
            minDate: /* @__PURE__ */ new Date(),
            onSelect: () => updateRecurringPreview(modalId)
          });
        }
      } else {
        if (recurringEndDateCalendarWidget) {
          recurringEndDateCalendarWidget.destroy();
          recurringEndDateCalendarWidget = null;
        }
      }
    }
    updateRecurringPreview(modalId);
  }
  function updateRecurringPreview(modalId) {
    const previewText = document.getElementById(`recurring-preview-text-${modalId}`);
    if (!previewText) return;
    const frequencySelect = document.querySelector(
      `#${modalId} select[name="frequency_type"]`
    );
    const frequency = frequencySelect ? frequencySelect.value : "monthly";
    let frequencyText = "";
    switch (frequency) {
      case "monthly":
        const monthdaySelect = document.querySelector(
          `#${modalId} select[name="frequency_value_monthday"]`
        );
        const monthDay = monthdaySelect ? monthdaySelect.value : "1";
        frequencyText = `Ежемесячно, ${monthDay}-го числа`;
        break;
      case "quarterly":
        const qMonthdaySelect = document.querySelector(
          `#${modalId} select[name="frequency_value_monthday"]`
        );
        const qMonthDay = qMonthdaySelect ? qMonthdaySelect.value : "1";
        frequencyText = `Ежеквартально, ${qMonthDay}-го числа`;
        break;
      case "yearly":
        const yearlyHiddenInput = document.querySelector(
          `#${modalId} input[name="frequency_value_yearly"]`
        );
        const yearlyValue = yearlyHiddenInput ? parseInt(yearlyHiddenInput.value) : null;
        if (yearlyValue) {
          frequencyText = getFrequencyDisplayText("yearly", yearlyValue);
        } else {
          frequencyText = "Ежегодно (выберите дату)";
        }
        break;
    }
    let durationText = "";
    const durationSelect = document.querySelector(
      `#${modalId} select[name="duration_type"]`
    );
    const type = durationSelect ? durationSelect.value : "indefinite";
    switch (type) {
      case "indefinite":
        durationText = "бессрочно";
        break;
      case "count":
        const occurrencesInput = document.querySelector(
          `#${modalId} input[name="occurrences_count"]`
        );
        const count = occurrencesInput ? occurrencesInput.value : "";
        durationText = count ? `${count} повторений` : "укажите количество";
        break;
      case "end_date":
        const endDateInput = document.getElementById(`recurring_end_date_${modalId}`);
        const endDate = endDateInput ? endDateInput.value : "";
        durationText = endDate ? `до ${endDate}` : "укажите дату";
        break;
    }
    previewText.textContent = `${frequencyText}, ${durationText}`;
  }
  function updateReminderDatetime(modalId) {
    const dateInput = document.getElementById(`reminder_date_${modalId}`);
    const hourSelect = document.getElementById(`reminder_hour_${modalId}`);
    const minuteSelect = document.getElementById(`reminder_minute_${modalId}`);
    const hiddenInput = document.getElementById(`reminder_datetime_${modalId}`);
    if (!dateInput || !hourSelect || !minuteSelect || !hiddenInput) return;
    const dateValue = dateInput.value;
    const hourValue = hourSelect.value;
    const minuteValue = minuteSelect.value;
    if (dateValue && hourValue && minuteValue) {
      const isoDate = BudgetShared.DateFormatter.formatForAPI(dateValue);
      if (isoDate) {
        hiddenInput.value = `${isoDate}T${hourValue}:${minuteValue}`;
      }
    } else {
      hiddenInput.value = "";
    }
  }
  function updateEditReminderDatetime() {
    const dateInput = document.getElementById("edit-reminder-date");
    const hourSelect = document.getElementById("edit-reminder-hour");
    const minuteSelect = document.getElementById("edit-reminder-minute");
    const hiddenInput = document.getElementById("edit-reminder-datetime");
    if (!dateInput || !hourSelect || !minuteSelect || !hiddenInput) return;
    const dateValue = dateInput.value;
    const hourValue = hourSelect.value;
    const minuteValue = minuteSelect.value;
    if (dateValue && hourValue && minuteValue) {
      const isoDate = BudgetShared.DateFormatter.formatForAPI(dateValue);
      if (isoDate) {
        hiddenInput.value = `${isoDate}T${hourValue}:${minuteValue}`;
      }
    } else {
      hiddenInput.value = "";
    }
  }
  async function createPlan(event) {
    event.preventDefault();
    const form = event.target;
    setSubmitLoading(form, true);
    const formData = new FormData(form);
    const modalId = "modal_add_plan";
    const planMode = formData.get("plan_mode") || "regular";
    const isRecurring = planMode === "recurring";
    const enableReminder = planMode === "reminder";
    const reminderDatetime = enableReminder ? formData.get("reminder_datetime") : null;
    logCrud.debug("[createPlan] Form submitted:", {
      planMode,
      isRecurring,
      enableReminder,
      amount: formData.get("amount"),
      article_id: formData.get("article_id"),
      plan_month: formData.get("plan_month")
    });
    try {
      if (isRecurring) {
        logCrud.debug("[createPlan] Collecting recurring settings for modalId:", modalId);
        const recurringSettings = collectRecurringSettings(modalId);
        logCrud.debug("[createPlan] Collected recurringSettings:", recurringSettings);
        if (!recurringSettings) {
          logCrud.error("[createPlan] collectRecurringSettings() returned null!");
          showToast("Ошибка: не удалось собрать настройки регулярного платежа", "error");
          setSubmitLoading(form, false);
          return;
        }
        const planMonth2 = formData.get("plan_month");
        const startDate = `${planMonth2}-01`;
        const articleId = parseInt(formData.get("article_id"));
        const financialCenterId = parseInt(formData.get("financial_center_id"));
        const costCenterId = formData.get("cost_center_id") ? parseInt(formData.get("cost_center_id")) : null;
        const articleSelect = document.querySelector(`#${modalId} select[name="article_id"]`);
        const financialCenterSelect = document.querySelector(`#${modalId} select[name="financial_center_id"]`);
        const costCenterSelect = document.querySelector(`#${modalId} select[name="cost_center_id"]`);
        const articleName = articleSelect?.selectedOptions[0]?.textContent || null;
        const financialCenterName = financialCenterSelect?.selectedOptions[0]?.textContent || null;
        const costCenterName = costCenterId ? costCenterSelect?.selectedOptions[0]?.textContent || null : null;
        let articleType = articleSelect?.selectedOptions[0]?.dataset?.type || null;
        if (!articleType && articleId) {
          try {
            const articleResp = await fetch(`/api/v1/articles/${articleId}`, { credentials: "include" });
            if (articleResp.ok) {
              const articleData = await articleResp.json();
              articleType = articleData.type;
            }
          } catch (err) {
            logCrud.warn("[createPlan] Failed to fetch article type:", err);
          }
        }
        const recurringData = {
          article_id: articleId,
          financial_center_id: financialCenterId,
          cost_center_id: costCenterId,
          amount: parseFloat(formData.get("amount")),
          description: formData.get("description") || null,
          record_type: "plan",
          frequency_type: recurringSettings.frequency_type,
          frequency_value: recurringSettings.frequency_value,
          start_date: startDate,
          end_date: recurringSettings.end_date,
          occurrences_count: recurringSettings.occurrences_count,
          // Add names, type, and date for offline display in pending-records-card
          article_name: articleName,
          article_type: articleType,
          financial_center_name: financialCenterName,
          cost_center_name: costCenterName,
          plan_date: startDate,
          // For pending records date display
          // Reminder settings
          enable_reminder: formData.get("recurring_enable_reminder") === "on",
          reminder_hour: formData.get("recurring_enable_reminder") === "on" ? parseInt(formData.get("recurring_reminder_hour")) : null,
          reminder_minute: formData.get("recurring_enable_reminder") === "on" ? parseInt(formData.get("recurring_reminder_minute")) : null
        };
        if (recurringData.enable_reminder) {
          if (recurringData.reminder_hour === null || recurringData.reminder_minute === null || isNaN(recurringData.reminder_hour) || isNaN(recurringData.reminder_minute)) {
            showToast("Укажите время напоминания для регулярного платежа", "warning");
            setSubmitLoading(form, false);
            return;
          }
          logCrud.debug(`[createPlan] Reminder enabled: ${recurringData.reminder_hour.toString().padStart(2, "0")}:${recurringData.reminder_minute.toString().padStart(2, "0")}`);
        }
        logCrud.debug("[createPlan] Recurring data with reminders:", recurringData);
        logCrud.debug("[createPlan] Creating recurring plan:", recurringData);
        if (window.offlineManager) {
          const result = await window.offlineManager.createRecurringPlan(recurringData);
          if (result._offline) {
            showToast("Регулярный платеж сохранён оффлайн (будет создан при подключении)", "warning");
            logCrud.debug("[createPlan] Recurring plan saved offline:", result);
          } else {
            let message = `Регулярный платеж создан! Сгенерировано записей: ${result.occurrences_generated}`;
            if (result.enable_reminder && result.reminder_time_display) {
              message += `. Напоминания в ${result.reminder_time_display}`;
            }
            showToast(message, "success");
            logCrud.debug("[createPlan] Recurring plan created:", result);
          }
          document.getElementById("modal_add_plan").close();
          form.reset();
          resetRecurringSettings(modalId);
          const reminderSettings = document.getElementById("reminder-settings-modal_add_plan");
          if (reminderSettings) reminderSettings.classList.add("hidden");
          resetReminderFields(modalId);
          await loadFacts();
          setupCreatePlanPeriodButtons();
        } else {
          const response = await fetch("/api/v1/recurring-plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(recurringData)
          });
          if (response.ok) {
            const createdPlan = await response.json();
            let message = `Регулярный платеж создан! Сгенерировано записей: ${createdPlan.occurrences_generated}`;
            if (createdPlan.enable_reminder && createdPlan.reminder_time_display) {
              message += `. Напоминания в ${createdPlan.reminder_time_display}`;
            }
            showToast(message, "success");
            logCrud.debug("[createPlan] Recurring plan created:", createdPlan);
            document.getElementById("modal_add_plan").close();
            form.reset();
            resetRecurringSettings(modalId);
            const reminderSettings = document.getElementById("reminder-settings-modal_add_plan");
            if (reminderSettings) reminderSettings.classList.add("hidden");
            resetReminderFields(modalId);
            await loadFacts();
            setupCreatePlanPeriodButtons();
          } else {
            const error = await response.json();
            showToast("Ошибка: " + (error.detail || "Не удалось создать регулярный платеж"), "error");
          }
        }
        return;
      }
      const planMonth = formData.get("plan_month");
      const factDate = `${planMonth}-01`;
      const data = {
        record_type: "plan",
        amount: parseFloat(formData.get("amount")),
        article_id: parseInt(formData.get("article_id")),
        financial_center_id: parseInt(formData.get("financial_center_id")),
        cost_center_id: formData.get("cost_center_id") ? parseInt(formData.get("cost_center_id")) : null,
        fact_date: factDate,
        // Обязательное поле - первое число месяца плана
        description: formData.get("description") || null
      };
      if (window.offlineManager) {
        const result = await window.offlineManager.createPlan(data);
        if (result._offline) {
          showToast("План сохранён оффлайн (будет синхронизирован при подключении)", "warning");
          logCrud.debug("[createPlan] Saved offline:", result);
        } else {
          showToast("План успешно создан!", "success");
          logCrud.debug("[createPlan] Saved online:", result);
          if (enableReminder && reminderDatetime && result.id) {
            const reminderCreated = await BudgetShared.Reminders.createReminder(result.id, reminderDatetime);
            if (reminderCreated) {
              remindersMap.set(result.id, reminderCreated);
              showToast("Напоминание установлено", "success");
            } else {
              showToast("Предупреждение: план создан, но напоминание не установлено", "warning");
            }
          }
        }
        document.getElementById("modal_add_plan").close();
        form.reset();
        const reminderSettings = document.getElementById("reminder-settings-modal_add_plan");
        if (reminderSettings) reminderSettings.classList.add("hidden");
        resetReminderFields("modal_add_plan");
        await loadFacts();
        setupCreatePlanPeriodButtons();
      } else {
        const response = await fetch("/api/v1/facts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        });
        if (response.ok) {
          const createdPlan = await response.json();
          showToast("План успешно создан!", "success");
          if (enableReminder && reminderDatetime && createdPlan.id) {
            const reminderCreated = await BudgetShared.Reminders.createReminder(createdPlan.id, reminderDatetime);
            if (reminderCreated) {
              remindersMap.set(createdPlan.id, reminderCreated);
              showToast("Напоминание установлено", "success");
            } else {
              showToast("Предупреждение: план создан, но напоминание не установлено", "warning");
            }
          }
          document.getElementById("modal_add_plan").close();
          form.reset();
          const reminderSettings = document.getElementById("reminder-settings-modal_add_plan");
          if (reminderSettings) reminderSettings.classList.add("hidden");
          resetReminderFields("modal_add_plan");
          await loadFacts();
          setupCreatePlanPeriodButtons();
        } else {
          const error = await response.json();
          showToast("Ошибка: " + (error.detail || "Не удалось создать план"), "error");
        }
      }
    } catch (error) {
      logCrud.error("Error creating plan:", error);
      showToast("Ошибка при создании плана: " + error.message, "error");
    } finally {
      setSubmitLoading(form, false);
    }
  }
  async function updateFact(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const factId = formData.get("id");
    const displayDate = formData.get("fact_date");
    const recurringPlanId = formData.get("recurring_plan_id");
    const editScope = formData.get("edit_scope");
    if (editScope !== "template") {
      if (!displayDate || !BudgetShared.DateFormatter.isValidDisplayFormat(displayDate)) {
        showNotification("❌ Неверный формат даты. Используйте формат ДД.ММ.ГГГГ (например, 12.12.2025)", "error");
        return;
      }
    }
    setSubmitLoading(event.target, true);
    const data = {
      amount: parseFloat(formData.get("amount")),
      fact_date: editScope !== "template" ? BudgetShared.DateFormatter.formatForAPI(displayDate) : null,
      article_id: parseInt(formData.get("article_id")),
      description: formData.get("description") || null
    };
    const financialCenterId = formData.get("financial_center_id");
    const costCenterId = formData.get("cost_center_id");
    if (financialCenterId) {
      data.financial_center_id = parseInt(financialCenterId);
    }
    if (costCenterId) {
      data.cost_center_id = parseInt(costCenterId);
    }
    const enableReminder = formData.get("enable_reminder") === "on";
    const reminderDatetime = formData.get("reminder_datetime");
    try {
      const factsData2 = getFactsData();
      logCrud.debug("[EDIT MODAL] updateFact called:", {
        factId,
        recordType: factsData2.find((f) => f.id == Number(factId))?.record_type,
        recurringPlanId,
        editScope
      });
      let response;
      let successMessage = "✅ Факт успешно обновлен!";
      if (recurringPlanId && editScope === "template") {
        logCrud.debug("[EDIT MODAL] Updating RECURRING PLAN TEMPLATE");
        const templateData = {
          amount: data.amount,
          description: data.description
        };
        if (costCenterId) {
          templateData.cost_center_id = parseInt(costCenterId);
        } else {
          templateData.cost_center_id = null;
        }
        const templateEndDate = formData.get("template_end_date");
        const templateIsActive = formData.get("template_is_active") === "on";
        if (templateEndDate && BudgetShared.DateFormatter.isValidDisplayFormat(templateEndDate)) {
          templateData.end_date = BudgetShared.DateFormatter.formatForAPI(templateEndDate);
        }
        templateData.is_active = templateIsActive;
        response = await fetch(`/api/v1/recurring-plans/${recurringPlanId}?regenerate_future=true`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(templateData)
        });
        successMessage = "✅ Шаблон обновлен, будущие записи пересозданы!";
      } else {
        logCrud.debug("[EDIT MODAL] Updating SINGLE FACT");
        response = await fetch(`/api/v1/facts/${factId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data)
        });
      }
      if (!response.ok) {
        const error = await response.json();
        logCrud.error("Validation errors:", error);
        let errorMsg = "Ошибка сохранения";
        if (error.detail && typeof error.detail === "object") {
          if (Array.isArray(error.detail.errors) && error.detail.errors.length > 0) {
            errorMsg = error.detail.errors.map((e) => e.message || e.msg || "Unknown error").join("; ");
          } else if (typeof error.detail.message === "string") {
            errorMsg = error.detail.message;
          } else if (typeof error.detail === "string") {
            errorMsg = error.detail;
          } else if (Array.isArray(error.detail)) {
            errorMsg = error.detail.map((e) => `${e.loc.join(".")}: ${e.msg}`).join(", ");
          } else {
            errorMsg = JSON.stringify(error.detail);
          }
        } else if (typeof error.detail === "string") {
          errorMsg = error.detail;
        } else {
          errorMsg = `HTTP error! status: ${response.status}`;
        }
        throw new Error(errorMsg);
      }
      if (editScope !== "template") {
        const existingReminder = remindersMap.get(parseInt(factId));
        if (enableReminder && reminderDatetime) {
          if (existingReminder) {
            const updated = await BudgetShared.Reminders.updateReminder(factId, reminderDatetime);
            if (!updated) {
              showNotification("⚠️ Предупреждение: не удалось обновить напоминание", "warning");
            }
          } else {
            const created = await BudgetShared.Reminders.createReminder(factId, reminderDatetime);
            if (!created) {
              showNotification("⚠️ Предупреждение: не удалось создать напоминание", "warning");
            }
          }
        } else if (!enableReminder && existingReminder) {
          const deleted = await BudgetShared.Reminders.deleteReminder(factId);
          if (!deleted) {
            showNotification("⚠️ Предупреждение: не удалось удалить напоминание", "warning");
          }
        }
      }
      closeEditModal();
      await loadFacts();
      showNotification(successMessage, "success");
    } catch (error) {
      logCrud.error("Error updating fact:", error);
      const errorMessage = error?.message || String(error);
      showNotification(`❌ Ошибка: ${errorMessage}`, "error");
    } finally {
      setSubmitLoading(event.target, false);
    }
  }
  async function batchDeleteFacts() {
    if (selectedFactIds.size === 0) return;
    const count = selectedFactIds.size;
    const confirmed = await showConfirmDialog(
      `Вы уверены, что хотите удалить ${count} транзакций? Это действие необратимо.`,
      "🗑️ Массовое удаление транзакций"
    );
    if (!confirmed) {
      return;
    }
    const btn = document.getElementById("batch-delete-btn");
    if (!btn) return;
    const originalText = btn.textContent || "";
    btn.disabled = true;
    btn.classList.add("loading", "loading-spinner");
    btn.textContent = `Удаление... (${count})`;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const response = await fetch("/api/v1/facts/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Array.from(selectedFactIds))
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      await loadFacts();
      showNotification(`✅ Удалено транзакций: ${result.deleted_count}`, "success");
    } catch (error) {
      logCrud.error("Error batch deleting facts:", error);
      const errorMessage = error?.message || String(error);
      showNotification(`❌ Ошибка: ${errorMessage}`, "error");
    } finally {
      btn.classList.remove("loading", "loading-spinner");
      btn.textContent = originalText;
    }
  }
  async function batchDeleteRecurringPlans() {
    logCrud.debug("[RECURRING_DELETE] Starting batch delete, selectedIds:", Array.from(selectedRecurringPlanIds));
    if (selectedRecurringPlanIds.size === 0) {
      logCrud.warn("[RECURRING_DELETE] No plans selected");
      return;
    }
    const count = selectedRecurringPlanIds.size;
    const confirmed = await showConfirmDialogWithCheckbox(
      `Вы уверены, что хотите удалить ${count} регламентных платежей?`,
      "🗑️ Массовое удаление регламентных платежей",
      {
        checkboxLabel: "Также удалить все будущие записи",
        checkboxId: "batch-delete-future-facts",
        checkboxDefault: false
      }
    );
    if (!confirmed.result) {
      logCrud.debug("[RECURRING_DELETE] User cancelled batch delete");
      return;
    }
    const deleteFutureFacts = confirmed.checkboxValue || false;
    logCrud.debug("[RECURRING_DELETE] User confirmed, delete_future_facts:", deleteFutureFacts);
    const btn = document.getElementById("batch-delete-recurring-plans-btn");
    if (!btn) return;
    const originalText = btn.textContent || "";
    btn.disabled = true;
    btn.classList.add("loading", "loading-spinner");
    btn.textContent = `Удаление... (${count})`;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const response = await fetch(
        `/api/v1/recurring-plans/batch-delete?delete_future_facts=${deleteFutureFacts}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(Array.from(selectedRecurringPlanIds))
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Batch delete failed");
      }
      const result = await response.json();
      logCrud.debug("[RECURRING_DELETE] Batch delete result:", result);
      await loadRecurringPlans();
      await loadFacts();
      const message = result.failed && result.failed.length > 0 ? `✅ Удалено: ${result.deleted_count}, ошибок: ${result.failed.length}` : `✅ Удалено регламентных платежей: ${result.deleted_count}`;
      showNotification(message, "success");
      logCrud.debug("[RECURRING_DELETE] Batch delete completed successfully");
      selectedRecurringPlanIds.clear();
      updateBatchDeleteRecurringPlansButtonState();
    } catch (error) {
      logCrud.error("[RECURRING_DELETE] Batch delete error:", error);
      showNotification(`❌ Ошибка массового удаления: ${error?.message}`, "error");
    } finally {
      btn.classList.remove("loading", "loading-spinner");
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
  logCrud.debug("[CRUD] Plan CRUD module loaded (Phase 3: Week 4 complete)");
  const PlanCRUD = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    batchDeleteFacts,
    batchDeleteRecurringPlans,
    closeEditModal,
    createPlan,
    deleteFact,
    deleteFromEditModal,
    getCurrentRecurringPlan,
    openAddPlanModal,
    recurringDeleteResolve,
    setCurrentRecurringPlan,
    showEditModal,
    showRecurringDeleteDialog,
    updateDurationFields,
    updateEditReminderDatetime,
    updateFact,
    updateFrequencyFields,
    updateRecurringPreview,
    updateReminderDatetime,
    updateYearlyFrequencyValue
  });
  async function initialize() {
    console.log("[PLAN] Initializing plan page (Phase 2: Complete)...");
    try {
      initDefaultPeriodFilter();
      initAnalyticsMonthButtons();
      console.log("[PLAN] Loading dropdown data...");
      await Promise.all([
        loadUsersDropdown(),
        loadArticlesDropdown(),
        loadFinancialCentersDropdown(),
        loadCostCentersDropdown(),
        loadAnalyticsCFOFilter(),
        loadAnalyticsArticleFilter()
      ]);
      console.log("[PLAN] Applying initial filters...");
      await applyFiltersAndLoadData();
      console.log("[PLAN] Loading analytics...");
      await loadPlanAnalytics();
      updateFilterIndicator();
      console.log("[PLAN] ✅ Plan page initialized successfully");
    } catch (error) {
      console.error("[PLAN] ❌ Error initializing plan page:", error);
      showNotification$1("Ошибка инициализации страницы: " + error.message, "error");
    }
  }
  async function loadUsersDropdown() {
    try {
      const users = await loadUsers();
      const select = document.getElementById("filter-user");
      if (!select) {
        console.warn("[PLAN] User dropdown not found");
        return;
      }
      users.forEach((user) => {
        const option = document.createElement("option");
        option.value = String(user.id);
        option.textContent = user.username || user.first_name || `User ${user.telegram_id}`;
        select.appendChild(option);
      });
      console.log(`[PLAN] Loaded ${users.length} users`);
    } catch (error) {
      console.error("[PLAN] Error loading users:", error);
    }
  }
  function groupArticlesByType(flatNodes) {
    const groupedByType = {
      "expense": [],
      "income": [],
      "debit": [],
      "credit": []
    };
    flatNodes.forEach((node) => {
      if (groupedByType[node.type]) {
        groupedByType[node.type].push(node);
      }
    });
    return [
      ...groupedByType["expense"],
      ...groupedByType["income"],
      ...groupedByType["debit"],
      ...groupedByType["credit"]
    ];
  }
  function createArticleOption(node) {
    const option = document.createElement("option");
    option.value = String(node.id);
    const indent = "›  ".repeat(node.level);
    const icon = node.isLeaf ? "▸" : "📂";
    option.textContent = `${indent}${icon} ${node.name}`;
    if (node.type) {
      option.dataset.type = node.type;
    }
    const colorMap = {
      "expense": "rgb(239, 68, 68)",
      // Red (DaisyUI error)
      "income": "rgb(34, 197, 94)",
      // Green (DaisyUI success)
      "debit": "rgb(59, 130, 246)",
      // Blue (DaisyUI info)
      "credit": "rgb(251, 146, 60)"
      // Orange (DaisyUI warning)
    };
    if (colorMap[node.type]) {
      option.style.color = colorMap[node.type];
    }
    if (!node.isLeaf) {
      option.disabled = true;
      option.classList.add("category-parent");
      option.style.fontWeight = "bold";
      option.style.opacity = "0.7";
    } else {
      option.classList.add("category-leaf");
    }
    return option;
  }
  async function loadArticlesDropdown() {
    try {
      const articles = await loadArticles();
      const tree = buildArticleTree(articles);
      const flatNodes = flattenArticleTree(tree);
      const sortedNodes = groupArticlesByType(flatNodes);
      const filterSelect = document.getElementById("filter-article");
      if (!filterSelect) {
        console.warn("[PLAN] Article dropdown not found");
        return;
      }
      sortedNodes.forEach((node) => {
        const option = createArticleOption(node);
        filterSelect.appendChild(option);
      });
      console.log(`[PLAN] Loaded ${sortedNodes.length} articles (${articles.length} total)`);
    } catch (error) {
      console.error("[PLAN] Error loading articles:", error);
    }
  }
  async function loadFinancialCentersDropdown() {
    try {
      const centers = await loadFinancialCenters$1();
      const filterSelect = document.getElementById("filter-financial-center");
      if (!filterSelect) {
        console.warn("[PLAN] Financial center dropdown not found");
        return;
      }
      centers.forEach((center) => {
        const option = document.createElement("option");
        option.value = String(center.id);
        option.textContent = center.name;
        filterSelect.appendChild(option);
      });
      console.log(`[PLAN] Loaded ${centers.length} financial centers`);
    } catch (error) {
      console.error("[PLAN] Error loading financial centers:", error);
      showToast$1("Ошибка загрузки счетов: " + error.message, "error");
    }
  }
  async function loadCostCentersDropdown() {
    try {
      const centers = await loadCostCenters$1();
      const filterSelect = document.getElementById("filter-cost-center");
      if (!filterSelect) {
        console.warn("[PLAN] Cost center dropdown not found");
        return;
      }
      centers.forEach((center) => {
        const option = document.createElement("option");
        option.value = String(center.id);
        option.textContent = center.name;
        filterSelect.appendChild(option);
      });
      console.log(`[PLAN] Loaded ${centers.length} cost centers`);
    } catch (error) {
      console.error("[PLAN] Error loading cost centers:", error);
      showToast$1("Ошибка загрузки мест затрат: " + error.message, "error");
    }
  }
  async function applyFiltersAndLoadData() {
    try {
      await applyFilters();
      await loadFacts$1();
      debouncedSyncFiltersToAnalytics();
      console.log("[PLAN] Filters applied and data reloaded");
    } catch (error) {
      console.error("[PLAN] Error applying filters:", error);
      showNotification$1("Ошибка применения фильтров: " + error.message, "error");
    }
  }
  async function resetFiltersAndLoadData() {
    try {
      await resetFilters();
      await loadFacts$1();
      debouncedSyncFiltersToAnalytics();
      console.log("[PLAN] Filters reset and data reloaded");
    } catch (error) {
      console.error("[PLAN] Error resetting filters:", error);
      showNotification$1("Ошибка сброса фильтров: " + error.message, "error");
    }
  }
  function collapseFiltersAction() {
    collapseFilters();
  }
  window.PlanApp = {
    // Initialization
    initialize,
    // Modules
    Helpers: PlanHelpers,
    Filters: PlanFilters,
    FactsTable: PlanFactsTable,
    Analytics: PlanAnalytics,
    FilterAnalyticsSync,
    CRUD: PlanCRUD,
    // Filter Actions (for onclick handlers)
    applyFilters: applyFiltersAndLoadData,
    resetFilters: resetFiltersAndLoadData,
    collapseFilters: collapseFiltersAction,
    // Facts Table Actions (for onclick handlers)
    loadFacts: loadFacts$1,
    previousPage,
    nextPage,
    // Analytics Actions (for onclick handlers)
    selectAnalyticsMonth,
    // Sync Actions (for onclick handlers)
    syncFiltersToAnalytics,
    syncAnalyticsToFilters,
    // CRUD Actions (for onclick handlers - Phase 3: Week 3-4)
    closeEditModal,
    deleteFact,
    deleteFromEditModal,
    showEditModal,
    openAddPlanModal,
    createPlan,
    updateFact,
    batchDeleteFacts,
    batchDeleteRecurringPlans,
    // Recurring Plan Helpers (for onclick handlers - Phase 3: Week 4)
    recurringDeleteResolve,
    updateFrequencyFields,
    updateYearlyFrequencyValue,
    updateDurationFields,
    updateRecurringPreview,
    // Reminder Helpers (for onclick handlers - Phase 3: Week 4)
    updateReminderDatetime,
    updateEditReminderDatetime
  };
  console.log("[PLAN] PlanApp exposed to window object (Phase 3: Week 4 complete)");
})(PGlite);
//# sourceMappingURL=plan.bundle.js.map
