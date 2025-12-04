/**
 * Transfer Modal Logic
 * Handles transfer creation between financial centers
 * Supports both fact and plan record types
 */

// Global variables
let transferDateWidget = null;
let fromCategoryTree = null;
let toCategoryTree = null;
let transferRecordType = 'fact'; // Default to fact, can be 'plan' for planned transfers
let allFinancialCenters = []; // Store all financial centers for filtering

/**
 * Set transfer record type and update UI accordingly
 * @param {string} type - 'fact' or 'plan'
 */
function setTransferRecordType(type) {
    if (type === 'fact' || type === 'plan') {
        transferRecordType = type;
        updateQuickDateButtonsVisibility();
    }
}

/**
 * Update visibility of date/period sections based on transfer type
 */
function updateQuickDateButtonsVisibility() {
    const factSection = document.getElementById('transfer-date-section-fact');
    const planSection = document.getElementById('transfer-period-section-plan');

    if (!factSection || !planSection) return;

    if (transferRecordType === 'plan') {
        factSection.classList.add('hidden');
        planSection.classList.remove('hidden');
        // Initialize period buttons with month names
        initTransferPeriodButtons();
        // Select first period by default
        selectTransferPeriod(0);
    } else {
        factSection.classList.remove('hidden');
        planSection.classList.add('hidden');
    }
}

/**
 * Initialize transfer period buttons with month names
 */
function initTransferPeriodButtons() {
    const monthNamesShort = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const now = new Date();

    const buttons = [
        { id: 'transfer_period_btn_1', offset: 0 },
        { id: 'transfer_period_btn_2', offset: 1 },
        { id: 'transfer_period_btn_3', offset: 2 }
    ];

    buttons.forEach(btn => {
        const button = document.getElementById(btn.id);
        if (!button) return;

        const targetDate = new Date(now.getFullYear(), now.getMonth() + btn.offset, 1);
        const monthIndex = targetDate.getMonth();
        const year = targetDate.getFullYear();

        button.textContent = `${monthNamesShort[monthIndex]} ${year}`;
        button.dataset.year = year;
        button.dataset.month = String(monthIndex + 1).padStart(2, '0');
    });
}

/**
 * Select transfer period and update hidden input
 * @param {number} offset - Month offset (0 = current, 1 = next, 2 = after next)
 */
function selectTransferPeriod(offset) {
    const buttons = document.querySelectorAll('.transfer-period-btn');
    const hiddenInput = document.getElementById('transfer_plan_month');

    buttons.forEach((btn, index) => {
        if (index === offset) {
            btn.classList.add('btn-active');
            // Set hidden input value
            if (hiddenInput && btn.dataset.year && btn.dataset.month) {
                hiddenInput.value = `${btn.dataset.year}-${btn.dataset.month}`;
            }
        } else {
            btn.classList.remove('btn-active');
        }
    });
}

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
            searchEnabled: true
        });
    }

    // 3. Initialize ChoicesCategoryTree for TO (credit)
    if (typeof BudgetShared !== 'undefined' && BudgetShared.ChoicesCategoryTree) {
        toCategoryTree = new BudgetShared.ChoicesCategoryTree('#to_article', {
            type: 'credit',
            showLeafOnly: true,
            searchEnabled: true
        });
    }

    // 4. Setup quick date buttons
    setupQuickDateButtons();

    // 5. Setup period buttons click handlers
    setupPeriodButtons();

    // 6. Attach form submit handler
    const form = document.querySelector('#form_transfer');
    if (form) {
        form.addEventListener('submit', handleTransferSubmit);
    }

    // 7. Load Financial Centers and Cost Centers dynamically
    loadTransferData();

    // 8. Setup CFO filtering (exclude selected CFO from opposite dropdown)
    setupCFOFiltering();
}

/**
 * Setup period buttons click handlers
 */
function setupPeriodButtons() {
    const periodButtons = document.querySelectorAll('.transfer-period-btn');
    periodButtons.forEach((button, index) => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            selectTransferPeriod(index);
        });
    });
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
            allFinancialCenters = fcData.financial_centers || [];

            // Populate both dropdowns initially
            populateFinancialCenterDropdowns();
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
        }
    } catch (error) {
        // Ignore load errors - user will see empty dropdowns
    }
}

/**
 * Populate Financial Center dropdowns
 * Filters out the selected CFO from the opposite dropdown
 */
function populateFinancialCenterDropdowns() {
    const fromFCSelect = document.querySelector('#from_financial_center');
    const toFCSelect = document.querySelector('#to_financial_center');

    if (!fromFCSelect || !toFCSelect) return;

    const selectedFromId = fromFCSelect.value;
    const selectedToId = toFCSelect.value;

    // Clear existing options (keep placeholder)
    while (fromFCSelect.options.length > 1) {
        fromFCSelect.remove(1);
    }
    while (toFCSelect.options.length > 1) {
        toFCSelect.remove(1);
    }

    // Populate FROM dropdown (exclude selected TO)
    allFinancialCenters.forEach(fc => {
        if (String(fc.id) !== selectedToId) {
            const option = document.createElement('option');
            option.value = fc.id;
            option.textContent = fc.name;
            if (String(fc.id) === selectedFromId) {
                option.selected = true;
            }
            fromFCSelect.appendChild(option);
        }
    });

    // Populate TO dropdown (exclude selected FROM)
    allFinancialCenters.forEach(fc => {
        if (String(fc.id) !== selectedFromId) {
            const option = document.createElement('option');
            option.value = fc.id;
            option.textContent = fc.name;
            if (String(fc.id) === selectedToId) {
                option.selected = true;
            }
            toFCSelect.appendChild(option);
        }
    });
}

/**
 * Setup CFO filtering event listeners
 * When one CFO is selected, remove it from the opposite dropdown
 */
function setupCFOFiltering() {
    const fromFCSelect = document.querySelector('#from_financial_center');
    const toFCSelect = document.querySelector('#to_financial_center');

    if (fromFCSelect) {
        fromFCSelect.addEventListener('change', () => {
            populateFinancialCenterDropdowns();
        });
    }

    if (toFCSelect) {
        toFCSelect.addEventListener('change', () => {
            populateFinancialCenterDropdowns();
        });
    }
}

/**
 * Setup Quick Date Selection Buttons
 * Handles "Today", "Yesterday", "Day Before Yesterday" buttons for facts
 * Handles "Current", "Next", "After Next" month buttons for plans
 */
function setupQuickDateButtons() {
    const dateInput = document.querySelector('#transfer_date');
    if (!dateInput) return;

    // Setup fact date buttons (Today, Yesterday, Day Before)
    const quickDateButtons = document.querySelectorAll('[data-quick-date]');
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

    // Setup plan period buttons (Current, Next, After Next month)
    const quickPeriodButtons = document.querySelectorAll('[data-quick-period]');
    quickPeriodButtons.forEach(button => {
        button.addEventListener('click', function() {
            const quickPeriod = this.dataset.quickPeriod;
            const today = new Date();
            let monthOffset = 0;

            switch (quickPeriod) {
                case 'current':
                    monthOffset = 0;
                    break;
                case 'next':
                    monthOffset = 1;
                    break;
                case 'after-next':
                    monthOffset = 2;
                    break;
                default:
                    return;
            }

            // Calculate target month (first day of the month)
            const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);

            // Convert Date to ISO format (YYYY-MM-DD)
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const isoDate = `${year}-${month}-01`;

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
 * Handle Transfer Form Submit (with offline support)
 */
async function handleTransferSubmit(event) {
    event.preventDefault();

    // 1. Collect form data
    const formData = new FormData(event.target);

    // Helper to get selected option text
    function getSelectedText(selectId) {
        const select = document.querySelector(selectId);
        if (!select) return null;
        const selected = select.options[select.selectedIndex];
        return selected ? selected.text : null;
    }

    // Get article names from category trees or fallback to selected option text
    let fromArticleName = null;
    let toArticleName = null;

    // Try to get from category tree's categoryMap
    if (fromCategoryTree && fromCategoryTree.getSelectedCategory) {
        const selected = fromCategoryTree.getSelectedCategory();
        fromArticleName = selected ? selected.name : null;
    }
    // Fallback: get from Choices.js inner text or select element
    if (!fromArticleName) {
        const fromSelect = document.querySelector('#from_article');
        if (fromSelect) {
            // Try Choices.js selected item text
            const choicesItem = fromSelect.closest('.choices')?.querySelector('.choices__item--selectable[data-value]');
            if (choicesItem) {
                fromArticleName = choicesItem.textContent.trim().split('\n')[0]; // Get first line (category name)
            } else if (fromSelect.selectedIndex >= 0) {
                fromArticleName = fromSelect.options[fromSelect.selectedIndex]?.text;
            }
        }
    }

    if (toCategoryTree && toCategoryTree.getSelectedCategory) {
        const selected = toCategoryTree.getSelectedCategory();
        toArticleName = selected ? selected.name : null;
    }
    // Fallback for TO category
    if (!toArticleName) {
        const toSelect = document.querySelector('#to_article');
        if (toSelect) {
            const choicesItem = toSelect.closest('.choices')?.querySelector('.choices__item--selectable[data-value]');
            if (choicesItem) {
                toArticleName = choicesItem.textContent.trim().split('\n')[0];
            } else if (toSelect.selectedIndex >= 0) {
                toArticleName = toSelect.options[toSelect.selectedIndex]?.text;
            }
        }
    }

    // Handle date/period based on record type
    let transferDate;
    if (transferRecordType === 'plan') {
        // For plans, use the period month (YYYY-MM) and set day to 01
        const planMonth = formData.get('transfer_plan_month');
        transferDate = planMonth ? `${planMonth}-01` : null;
    } else {
        // For facts, use the date picker value
        transferDate = BudgetShared.DateFormatter.formatForAPI(formData.get('transfer_date'));
    }

    const data = {
        transfer_date: transferDate,
        amount: parseFloat(formData.get('amount')),
        record_type: transferRecordType, // 'fact' or 'plan'
        from_financial_center_id: parseInt(formData.get('from_financial_center_id')),
        from_financial_center_name: getSelectedText('#from_financial_center'), // For offline display
        from_article_id: parseInt(formData.get('from_article_id')),
        from_article_name: fromArticleName, // For offline display
        from_cost_center_id: formData.get('from_cost_center_id') ? parseInt(formData.get('from_cost_center_id')) : null,
        to_financial_center_id: parseInt(formData.get('to_financial_center_id')),
        to_financial_center_name: getSelectedText('#to_financial_center'), // For offline display
        to_article_id: parseInt(formData.get('to_article_id')),
        to_article_name: toArticleName, // For offline display
        to_cost_center_id: formData.get('to_cost_center_id') ? parseInt(formData.get('to_cost_center_id')) : null,
        description: formData.get('description') || null
    };

    // 2. Client-side validation
    const validationError = validateTransferData(data);
    if (validationError) {
        if (typeof showToast === 'function') {
            showToast(validationError, 'error');
        } else {
            alert(validationError);
        }
        return;
    }

    // 3. Submit to backend (with offline fallback)
    try {
        // Close modal first (before showing toast)
        document.querySelector('#transfer_modal').close();
        event.target.reset();

        // Use OfflineManager for offline support
        if (window.offlineManager) {
            const result = await window.offlineManager.createTransfer(data);

            if (result._offline) {
                // Saved offline - will sync when online
                const offlineMsg = transferRecordType === 'plan'
                    ? 'Плановый перевод сохранен оффлайн (будет синхронизирован при подключении)'
                    : 'Перевод сохранен оффлайн (будет синхронизирован при подключении)';
                if (typeof showToast === 'function') {
                    showToast(offlineMsg, 'warning');
                }

                // Update pending records table if function exists
                if (typeof loadPendingRecords === 'function') {
                    await loadPendingRecords();
                }
            } else {
                // Saved online
                const successMsg = transferRecordType === 'plan'
                    ? 'Плановый перевод создан успешно!'
                    : 'Перевод создан успешно!';
                if (typeof showToast === 'function') {
                    showToast(successMsg, 'success');
                }

                // Reload page to show new transfer
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } else {
            // Fallback to direct fetch if OfflineManager not available
            const response = await fetch('/api/v1/transfers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || error.message || 'Failed to create transfer');
            }

            const result = await response.json();

            const successMsg = transferRecordType === 'plan'
                ? 'Плановый перевод создан успешно!'
                : 'Перевод создан успешно!';
            if (typeof showToast === 'function') {
                showToast(successMsg, 'success');
            }

            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    } catch (error) {
        const errorPrefix = transferRecordType === 'plan'
            ? 'Ошибка при создании планового перевода: '
            : 'Ошибка при создании перевода: ';
        if (typeof showToast === 'function') {
            showToast(errorPrefix + error.message, 'error');
        } else {
            alert('Ошибка: ' + error.message);
        }
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
        return data.record_type === 'plan'
            ? 'Выберите период планирования'
            : 'Укажите дату перевода';
    }

    if (!data.from_article_id || !data.to_article_id) {
        return 'Выберите категории для списания и пополнения';
    }

    return null;  // No errors
}

// showNotification removed - using global showToast() from base.html

// Initialize on page load
document.addEventListener('DOMContentLoaded', initTransferModal);
