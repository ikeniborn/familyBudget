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
            onSelect: (date) => {
                debugLog('Выбрана дата для перевода:', date);
            }
        });
    }

    // 2. Initialize ChoicesCategoryTree for FROM (debit)
    if (typeof BudgetShared !== 'undefined' && BudgetShared.ChoicesCategoryTree) {
        fromCategoryTree = new BudgetShared.ChoicesCategoryTree('#from_article', {
            type: 'debit',
            showLeafOnly: true,
            searchEnabled: true,
            onSelect: (article) => {
                console.log('Selected FROM article:', article);
            }
        });
    }

    // 3. Initialize ChoicesCategoryTree for TO (credit)
    if (typeof BudgetShared !== 'undefined' && BudgetShared.ChoicesCategoryTree) {
        toCategoryTree = new BudgetShared.ChoicesCategoryTree('#to_article', {
            type: 'credit',
            showLeafOnly: true,
            searchEnabled: true,
            onSelect: (article) => {
                console.log('Selected TO article:', article);
            }
        });
    }

    // 4. Setup quick date buttons
    setupQuickDateButtons();

    // 5. Attach form submit handler
    const form = document.querySelector('#form_transfer');
    if (form) {
        form.addEventListener('submit', handleTransferSubmit);
    }

    // 6. Load Financial Centers and Cost Centers dynamically
    loadTransferData();
}

/**
 * Load Financial Centers and Cost Centers for Transfer Modal
 * Populates dropdowns with data from API
 */
async function loadTransferData() {
    try {
        // Load Financial Centers
        const fcResponse = await fetch('/api/v1/financial-centers?limit=1000&include_global=true', {
            credentials: 'include'
        });
        if (fcResponse.ok) {
            const fcData = await fcResponse.json();
            const financialCenters = fcData.financial_centers || [];

            // Populate FROM dropdown
            const fromFCSelect = document.querySelector('#from_financial_center');
            if (fromFCSelect) {
                // Clear existing options (keep placeholder)
                while (fromFCSelect.options.length > 1) {
                    fromFCSelect.remove(1);
                }
                financialCenters.forEach(fc => {
                    const option = document.createElement('option');
                    option.value = fc.id;
                    option.textContent = fc.name;
                    fromFCSelect.appendChild(option);
                });
            }

            // Populate TO dropdown
            const toFCSelect = document.querySelector('#to_financial_center');
            if (toFCSelect) {
                // Clear existing options (keep placeholder)
                while (toFCSelect.options.length > 1) {
                    toFCSelect.remove(1);
                }
                financialCenters.forEach(fc => {
                    const option = document.createElement('option');
                    option.value = fc.id;
                    option.textContent = fc.name;
                    toFCSelect.appendChild(option);
                });
            }
        } else {
            console.error('[Transfer Modal] Failed to load financial centers:', fcResponse.status);
        }

        // Load Cost Centers
        const ccResponse = await fetch('/api/v1/cost-centers?limit=1000&include_global=true', {
            credentials: 'include'
        });
        if (ccResponse.ok) {
            const ccData = await ccResponse.json();
            const costCenters = ccData.cost_centers || [];

            // Populate FROM dropdown
            const fromCCSelect = document.querySelector('#from_cost_center');
            if (fromCCSelect) {
                // Clear existing options (keep placeholder)
                while (fromCCSelect.options.length > 1) {
                    fromCCSelect.remove(1);
                }
                costCenters.forEach(cc => {
                    const option = document.createElement('option');
                    option.value = cc.id;
                    option.textContent = cc.name;
                    fromCCSelect.appendChild(option);
                });
            }

            // Populate TO dropdown
            const toCCSelect = document.querySelector('#to_cost_center');
            if (toCCSelect) {
                // Clear existing options (keep placeholder)
                while (toCCSelect.options.length > 1) {
                    toCCSelect.remove(1);
                }
                costCenters.forEach(cc => {
                    const option = document.createElement('option');
                    option.value = cc.id;
                    option.textContent = cc.name;
                    toCCSelect.appendChild(option);
                });
            }
        } else {
            console.error('[Transfer Modal] Failed to load cost centers:', ccResponse.status);
        }
    } catch (error) {
        console.error('[Transfer Modal] Failed to load data:', error);
    }
}

/**
 * Setup Quick Date Selection Buttons
 * Handles "Today", "Yesterday", "Day Before Yesterday" buttons
 */
function setupQuickDateButtons() {
    const quickDateButtons = document.querySelectorAll('[data-quick-date]');
    const dateInput = document.querySelector('#transfer_date');

    if (quickDateButtons.length === 0 || !dateInput) return;

    quickDateButtons.forEach(button => {
        button.addEventListener('click', function() {
            const quickDate = this.dataset.quickDate;
            const today = new Date();
            let targetDate = new Date(today);

            switch (quickDate) {
                case 'today':
                    // targetDate already set to today
                    break;
                case 'yesterday':
                    targetDate.setDate(today.getDate() - 1);
                    break;
                case 'day-before':
                    targetDate.setDate(today.getDate() - 2);
                    break;
                default:
                    console.warn('Unknown quick date:', quickDate);
                    return;
            }

            // Convert Date to ISO format (YYYY-MM-DD)
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getDate()).padStart(2, '0');
            const isoDate = `${year}-${month}-${day}`;

            // Format for display (DD.MM.YYYY)
            const formattedDate = BudgetShared.DateFormatter.formatForDisplay(isoDate);
            dateInput.value = formattedDate;
        });
    });
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
