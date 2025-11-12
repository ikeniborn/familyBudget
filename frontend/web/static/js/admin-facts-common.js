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
        dateFromInput.value = filters.date_from || '';
    }

    // Date to filter
    const dateToInput = document.getElementById('filter-date-to');
    if (dateToInput) {
        dateToInput.value = filters.date_to || '';
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

/**
 * Update quick amount button labels with new amounts.
 *
 * @param {string} formId - ID модальной формы
 * @param {Array<number>} amounts - Array of 4 recommended amounts
 */
function updateQuickAmountButtons(formId, amounts) {
    if (!amounts || amounts.length !== 4) {
        console.warn('[updateQuickAmountButtons] Invalid amounts array:', amounts);
        return;
    }

    // Find buttons in the specified form
    const form = document.getElementById(formId);
    if (!form) {
        console.warn(`[updateQuickAmountButtons] Form ${formId} not found`);
        return;
    }

    // Find quick amount buttons (need to select parent container then buttons)
    const buttons = form.querySelectorAll('.btn[onclick*="Amount"]');

    amounts.forEach((amount, index) => {
        if (buttons[index]) {
            const amountValue = parseFloat(amount);

            // Update button text with formatted amount
            buttons[index].textContent = formatAmountForButton(amountValue) + ' ₽';

            // Update onclick handler
            const funcName = formId.includes('transaction') ? 'setTransactionAmount' : 'setPlanAmount';
            buttons[index].setAttribute('onclick', `${funcName}(${amountValue})`);
        }
    });
}

/**
 * Format amount for button display.
 *
 * Examples:
 * - 100 → "100"
 * - 1000 → "1k"
 * - 1500 → "1.5k"
 * - 10000 → "10k"
 *
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount string
 */
function formatAmountForButton(amount) {
    if (amount >= 1000) {
        const thousands = amount / 1000;
        // Check if it's a round number
        if (Number.isInteger(thousands)) {
            return `${thousands}k`;
        } else {
            return `${thousands.toFixed(1)}k`;
        }
    }
    return amount.toString();
}

// Export для использования в других файлах
if (typeof window !== 'undefined') {
    window.AdminFactsCommon = {
        syncFiltersUI: syncFiltersUI,
        updateQuickAmountButtons: updateQuickAmountButtons,
        formatAmountForButton: formatAmountForButton
    };
}
