/**
 * Analytics Worker - Chart data transformation in background thread
 *
 * Actions:
 * - prepareWaterfallData: Build waterfall chart data structure
 * - preparePieData: Process pie chart data (top10 + others logic)
 * - aggregateByPeriod: Aggregate data by time periods
 * - filterByCategory: Filter data by category IDs
 *
 * Performance target: 1000+ rows: 100-200ms (vs 500ms synchronous)
 *
 * @version 1.0.0
 */

/**
 * Prepare waterfall chart data from API response.
 * Builds: Начало → +Income → -Expense → Итого structure
 *
 * @param {Object} data - API response data
 * @param {number} data.initial_balance - Starting balance
 * @param {Array<string>} data.labels - Period labels
 * @param {Array<number>} data.income - Income per period
 * @param {Array<number>} data.expense - Expense per period
 * @param {Array<number>} data.balance - Cumulative balance per period
 * @returns {Object} { waterfallData, labels }
 */
function prepareWaterfallData(data) {
    const startTime = performance.now();

    const waterfallData = [];
    const labels = [];

    // Add starting point
    const initialBalance = data.initial_balance || 0;
    labels.push('Начало');
    waterfallData.push({
        value: initialBalance,
        itemStyle: { color: '#90CAF9' }
    });

    // Add each period's net change
    data.labels.forEach((label, index) => {
        const income = data.income[index];
        const expense = data.expense[index];
        const net = income - expense;

        labels.push(label);
        waterfallData.push({
            value: net,
            itemStyle: {
                color: net >= 0 ? '#4CAF50' : '#f44336'
            }
        });
    });

    // Add final cumulative balance
    labels.push('Итого');
    waterfallData.push({
        value: data.balance[data.balance.length - 1],
        itemStyle: { color: '#2196F3' }
    });

    const duration = Math.round(performance.now() - startTime);

    if (duration > 50) {
        self.postMessage({
            type: 'progress',
            message: `Waterfall data prepared: ${duration}ms (${data.labels.length} periods)`
        });
    }

    return { waterfallData, labels, duration };
}

/**
 * Prepare pie chart data with top 10 + others logic.
 * Handles large datasets by grouping categories beyond top 10 into "Прочее".
 *
 * @param {Object} data - API response data
 * @param {Array<string>} data.categories - Category names
 * @param {Array<number>} data.amounts - Amounts per category
 * @param {Array<number>} data.percentages - Percentages per category
 * @returns {Object} { chartData, othersData, numCategories }
 */
function preparePieData(data) {
    const startTime = performance.now();

    let chartData;
    let othersData = null;

    if (data.categories.length > 10) {
        // Top 10 + "Прочее"
        const top10 = data.categories.slice(0, 10).map((category, index) => ({
            name: category,
            value: data.amounts[index],
            percent: data.percentages[index]
        }));

        const others = data.categories.slice(10).map((category, index) => ({
            name: category,
            value: data.amounts[index + 10],
            percent: data.percentages[index + 10]
        }));

        const othersSum = others.reduce((sum, item) => sum + item.value, 0);
        const othersPercent = others.reduce((sum, item) => sum + item.percent, 0);

        // Sort "Прочее" from highest to lowest
        others.sort((a, b) => b.value - a.value);

        chartData = [...top10, {
            name: 'Прочее',
            value: othersSum,
            percent: othersPercent,
            othersData: others
        }];
        othersData = others;
    } else {
        // If ≤10 categories: show all without "Прочее"
        chartData = data.categories.map((category, index) => ({
            name: category,
            value: data.amounts[index],
            percent: data.percentages[index]
        }));
    }

    const duration = Math.round(performance.now() - startTime);

    if (duration > 50) {
        self.postMessage({
            type: 'progress',
            message: `Pie data prepared: ${duration}ms (${data.categories.length} categories)`
        });
    }

    return {
        chartData,
        othersData,
        numCategories: data.categories.length,
        duration
    };
}

/**
 * Aggregate data by time period (day, week, month, quarter, year).
 * Groups records by period and calculates sum/avg/count.
 *
 * @param {Array<Object>} records - Array of records with date and amount
 * @param {string} period - Period type ('day', 'week', 'month', 'quarter', 'year')
 * @param {string} aggregation - Aggregation type ('sum', 'avg', 'count')
 * @returns {Object} { labels, values, periodCount }
 */
function aggregateByPeriod(records, period = 'month', aggregation = 'sum') {
    const startTime = performance.now();

    const periodMap = new Map();

    // Group records by period
    records.forEach(record => {
        const date = new Date(record.date || record.fact_date);
        let periodKey;

        switch (period) {
            case 'day':
                periodKey = date.toISOString().split('T')[0];
                break;
            case 'week':
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                periodKey = weekStart.toISOString().split('T')[0];
                break;
            case 'month':
                periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
            case 'quarter':
                const quarter = Math.floor(date.getMonth() / 3) + 1;
                periodKey = `${date.getFullYear()}-Q${quarter}`;
                break;
            case 'year':
                periodKey = String(date.getFullYear());
                break;
            default:
                periodKey = date.toISOString().split('T')[0];
        }

        if (!periodMap.has(periodKey)) {
            periodMap.set(periodKey, []);
        }
        periodMap.get(periodKey).push(record);
    });

    // Calculate aggregation for each period
    const labels = [];
    const values = [];

    for (const [periodKey, periodRecords] of periodMap.entries()) {
        labels.push(periodKey);

        let value;
        switch (aggregation) {
            case 'sum':
                value = periodRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
                break;
            case 'avg':
                value = periodRecords.reduce((sum, r) => sum + (r.amount || 0), 0) / periodRecords.length;
                break;
            case 'count':
                value = periodRecords.length;
                break;
            default:
                value = periodRecords.length;
        }

        values.push(value);
    }

    const duration = Math.round(performance.now() - startTime);

    if (duration > 50) {
        self.postMessage({
            type: 'progress',
            message: `Aggregated ${records.length} records by ${period}: ${duration}ms`
        });
    }

    return {
        labels,
        values,
        periodCount: labels.length,
        recordCount: records.length,
        duration
    };
}

/**
 * Filter records by category IDs.
 * Supports hierarchical categories (checks if record's category is in list or child of list).
 *
 * @param {Array<Object>} records - Array of records with article_id
 * @param {Array<number>} categoryIds - Category IDs to filter by
 * @param {boolean} includeChildren - Include child categories (default: false)
 * @returns {Object} { filteredRecords, filteredCount }
 */
function filterByCategory(records, categoryIds, includeChildren = false) {
    const startTime = performance.now();

    const categoryIdSet = new Set(categoryIds.map(id => Number(id)));

    const filteredRecords = records.filter(record => {
        const articleId = Number(record.article_id);

        if (categoryIdSet.has(articleId)) {
            return true;
        }

        // If includeChildren enabled, check parent chain
        // (requires parent_chain field in record)
        if (includeChildren && record.parent_chain) {
            const parentIds = record.parent_chain.split(',').map(id => Number(id));
            return parentIds.some(id => categoryIdSet.has(id));
        }

        return false;
    });

    const duration = Math.round(performance.now() - startTime);

    if (duration > 50) {
        self.postMessage({
            type: 'progress',
            message: `Filtered ${records.length} records by categories: ${duration}ms (${filteredRecords.length} matches)`
        });
    }

    return {
        filteredRecords,
        filteredCount: filteredRecords.length,
        totalCount: records.length,
        duration
    };
}

/**
 * Worker message handler
 */
self.addEventListener('message', (event) => {
    const { id, action, data, options, timestamp } = event.data;
    const startTime = performance.now();

    try {
        let result;

        switch (action) {
            case 'prepareWaterfallData':
                result = prepareWaterfallData(data);
                break;

            case 'preparePieData':
                result = preparePieData(data);
                break;

            case 'aggregateByPeriod':
                result = aggregateByPeriod(
                    data.records,
                    options?.period || 'month',
                    options?.aggregation || 'sum'
                );
                break;

            case 'filterByCategory':
                result = filterByCategory(
                    data.records,
                    data.categoryIds,
                    options?.includeChildren || false
                );
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        // Send success response
        self.postMessage({
            id,
            success: true,
            result,
            error: null,
            duration: Math.round(performance.now() - startTime),
            timestamp: Date.now()
        });

    } catch (error) {
        // Send error response
        self.postMessage({
            id,
            success: false,
            result: null,
            error: {
                message: error.message,
                code: 'WORKER_ERROR',
                stack: error.stack
            },
            duration: Math.round(performance.now() - startTime),
            timestamp: Date.now()
        });
    }
});

// Worker initialization log (for debugging)
self.postMessage({
    type: 'initialized',
    workerType: 'analytics',
    version: '1.0.0',
    timestamp: Date.now()
});
