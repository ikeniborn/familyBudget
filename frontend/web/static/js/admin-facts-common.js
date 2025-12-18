/**
 * Admin Facts Common Module
 * Общие функции для страниц facts.html и plan.html
 */

/**
 * Синхронизирует UI фильтров с объектом filters
 * @param {Object} filters - Объект с текущими значениями фильтров
 */
function syncFiltersUI(filters) {
    // User filter
    const userSelect = document.getElementById('filter-user');
    if (userSelect) {
        userSelect.value = filters.user_id || '';
    }

    // Article filter
    const articleSelect = document.getElementById('filter-article');
    if (articleSelect) {
        articleSelect.value = filters.article_id || '';
    }

    // Article type filter
    const articleTypeSelect = document.getElementById('filter-article-type');
    if (articleTypeSelect) {
        articleTypeSelect.value = filters.article_type || '';
    }

    // Date from filter
    const dateFromInput = document.getElementById('filter-date-from');
    if (dateFromInput) {
        // Convert from API format (YYYY-MM-DD) to display format (DD.MM.YYYY)
        const dateFromValue = filters.date_from
            ? DateFormatter.formatForDisplay(filters.date_from)
            : '';
        dateFromInput.value = dateFromValue;
    }

    // Date to filter
    const dateToInput = document.getElementById('filter-date-to');
    if (dateToInput) {
        // Convert from API format (YYYY-MM-DD) to display format (DD.MM.YYYY)
        const dateToValue = filters.date_to
            ? DateFormatter.formatForDisplay(filters.date_to)
            : '';
        dateToInput.value = dateToValue;
    }

    // Financial center filter
    const fcSelect = document.getElementById('filter-financial-center');
    if (fcSelect) {
        fcSelect.value = filters.financial_center_id || '';
    }

    // Cost center filter
    const ccSelect = document.getElementById('filter-cost-center');
    if (ccSelect) {
        ccSelect.value = filters.cost_center_id || '';
    }
}

// Export для использования в других файлах
if (typeof window !== 'undefined') {
    window.AdminFactsCommon = {
        syncFiltersUI: syncFiltersUI
    };
}
