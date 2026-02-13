/**
 * Facts Manager - Analytics API Integration
 *
 * Load analytics data (fact hints, statistics).
 *
 * Phase 1.4: Extract API Integration
 * Extracted from: frontend/web/templates/facts.html (lines 476-592)
 */

// ============================================================================
// Types
// ============================================================================

interface FactHintsParams {
    fact_date: string; // YYYY-MM-DD
    article_type: 'expense' | 'income' | 'debit' | 'credit';
    article_id: number;
    financial_center_id?: number;
}

interface FactHintsResponse {
    period: string; // YYYY-MM (month of fact_date)
    period_plan_sum: number; // Plan amount for the month
    period_fact_sum: number; // Fact amount for the month
}

// ============================================================================
// Fact Hints API
// ============================================================================

/**
 * Load fact hints (plan/fact for current month)
 * Returns plan and fact amounts for the same month as fact_date
 */
export async function loadFactHints(
    params: FactHintsParams,
    signal?: AbortSignal
): Promise<FactHintsResponse> {
    const queryParams = new URLSearchParams({
        fact_date: params.fact_date,
        article_type: params.article_type,
        article_id: String(params.article_id)
    });

    if (params.financial_center_id) {
        queryParams.append('financial_center_id', String(params.financial_center_id));
    }

    const response = await fetch(`/api/v1/analytics/fact-hints?${queryParams}`, {
        signal,
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format amount for display (compact format: 1000 → 1k)
 */
export function formatHintAmount(amount: number | null): string {
    if (!amount) return '--';

    const n = parseFloat(String(amount));

    // Compact format for large numbers
    if (n >= 1000) {
        const thousands = n / 1000;
        const decimals = n % 1000 === 0 ? 0 : 1;
        return thousands.toFixed(decimals) + 'k';
    }

    return n.toFixed(0);
}

/**
 * Get short month name from YYYY-MM period
 */
export function getShortMonthName(period: string): string {
    const monthNames = [
        'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
        'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
    ];

    const monthIndex = parseInt(period.split('-')[1]) - 1;
    return monthNames[monthIndex] || 'Мес';
}

/**
 * Format fact hint for display
 * Example: "План Янв: 10k" or "План Янв: --"
 */
export function formatFactHintText(
    type: 'plan' | 'fact',
    period: string,
    amount: number | null
): string {
    const monthName = getShortMonthName(period);
    const formattedAmount = formatHintAmount(amount);
    const prefix = type === 'plan' ? 'План' : 'Факт';

    return `${prefix} ${monthName}: ${formattedAmount}`;
}

/**
 * Get CSS class for fact hint button
 */
export function getFactHintButtonClass(amount: number | null): string {
    if (!amount || amount <= 0) {
        return 'btn btn-xs btn-ghost btn-disabled';
    }

    // Different colors for plan and fact (caller should specify)
    return 'btn btn-xs btn-ghost';
}
