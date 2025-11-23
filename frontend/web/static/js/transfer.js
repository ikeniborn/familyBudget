/**
 * Transfer Modal Logic
 * Handles transfer creation between financial centers
 */

// Global variables
let transferDateWidget = null;
let fromCategoryTree = null;
let toCategoryTree = null;

/**
 * Initialize Transfer Modal
 * Call this on page load
 */
function initTransferModal() {
    // 1. Initialize CalendarWidget for date picker
    if (typeof BudgetShared !== 'undefined' && BudgetShared.CalendarWidget) {
        transferDateWidget = new BudgetShared.CalendarWidget({
            mode: 'single',
            inputElement: document.querySelector('#transfer_date'),
            onDateSelect: (date) => {
                document.querySelector('#transfer_date').value =
                    BudgetShared.DateFormatter.formatForDisplay(date);
            }
        });
    }

    // 2. Initialize ChoicesCategoryTree for FROM (expense)
    if (typeof BudgetShared !== 'undefined' && BudgetShared.ChoicesCategoryTree) {
        fromCategoryTree = new BudgetShared.ChoicesCategoryTree('#from_article', {
            type: 'expense',
            showLeafOnly: true,
            searchEnabled: true,
            onSelect: (article) => {
                console.log('Selected FROM article:', article);
            }
        });
    }

    // 3. Initialize ChoicesCategoryTree for TO (income)
    if (typeof BudgetShared !== 'undefined' && BudgetShared.ChoicesCategoryTree) {
        toCategoryTree = new BudgetShared.ChoicesCategoryTree('#to_article', {
            type: 'income',
            showLeafOnly: true,
            searchEnabled: true,
            onSelect: (article) => {
                console.log('Selected TO article:', article);
            }
        });
    }

    // 4. Attach form submit handler
    const form = document.querySelector('#form_transfer');
    if (form) {
        form.addEventListener('submit', handleTransferSubmit);
    }
}

/**
 * Open Transfer Modal
 */
function openTransferModal() {
    const modal = document.querySelector('#transfer_modal');
    if (modal) {
        // Set today as default date
        const today = BudgetShared.DateFormatter.today();
        document.querySelector('#transfer_date').value =
            BudgetShared.DateFormatter.formatForDisplay(today);

        modal.showModal();
    }
}

/**
 * Handle Transfer Form Submit
 */
async function handleTransferSubmit(event) {
    event.preventDefault();

    // 1. Collect form data
    const formData = new FormData(event.target);
    const data = {
        transfer_date: BudgetShared.DateFormatter.formatForAPI(formData.get('transfer_date')),
        amount: parseFloat(formData.get('amount')),
        from_financial_center_id: parseInt(formData.get('from_financial_center_id')),
        from_article_id: parseInt(formData.get('from_article_id')),
        from_cost_center_id: formData.get('from_cost_center_id') ? parseInt(formData.get('from_cost_center_id')) : null,
        to_financial_center_id: parseInt(formData.get('to_financial_center_id')),
        to_article_id: parseInt(formData.get('to_article_id')),
        to_cost_center_id: formData.get('to_cost_center_id') ? parseInt(formData.get('to_cost_center_id')) : null,
        description: formData.get('description') || null
    };

    // 2. Client-side validation
    const validationError = validateTransferData(data);
    if (validationError) {
        showNotification(validationError, 'error');
        return;
    }

    // 3. Submit to backend
    try {
        const response = await fetch('/api/v1/transfers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            credentials: 'include'  // Include cookies for auth
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create transfer');
        }

        const result = await response.json();
        console.log('Transfer created:', result);

        // 4. Show success notification
        showNotification(
            `✅ Перевод создан успешно (ID: ${result.transfer_id})`,
            'success'
        );

        // 5. Close modal and reload page
        document.querySelector('#transfer_modal').close();
        setTimeout(() => {
            window.location.reload();
        }, 1000);

    } catch (error) {
        console.error('Transfer error:', error);
        showNotification(
            `❌ Ошибка: ${error.message}`,
            'error'
        );
    }
}

/**
 * Validate Transfer Data (client-side)
 */
function validateTransferData(data) {
    // Amount validation
    if (data.amount <= 0) {
        return 'Сумма должна быть больше 0';
    }

    // CFO validation
    if (data.from_financial_center_id === data.to_financial_center_id) {
        return 'Финансовые центры "откуда" и "куда" должны быть разными';
    }

    // Required fields
    if (!data.transfer_date) {
        return 'Укажите дату перевода';
    }

    if (!data.from_article_id || !data.to_article_id) {
        return 'Выберите категории для списания и пополнения';
    }

    return null;  // No errors
}

/**
 * Show Notification (reuse existing notification system)
 */
function showNotification(message, type = 'info') {
    // Если на странице есть HTMX notifications, используем их
    if (typeof htmx !== 'undefined') {
        htmx.trigger('#notifications', 'notify', {
            message: message,
            type: type
        });
    } else {
        // Fallback: simple alert
        alert(message);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initTransferModal);
