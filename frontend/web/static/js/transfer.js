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

// Debounce state for transfer plan hints
let transferHintsFromTimeout = null;
let transferHintsFromController = null;
let transferHintsToTimeout = null;
let transferHintsToController = null;

/**
 * Set transfer record type and update UI accordingly
 * @param {string} type - 'fact' or 'plan'
 */
function setTransferRecordType(type) {
    if (type === 'fact' || type === 'plan') {
        transferRecordType = type;
        updateQuickDateButtonsVisibility();
        updateTransferHintsVisibility();
    }
}

/**
 * Update visibility of hint containers based on transfer type
 * Hints are only shown for plan transfers
 */
function updateTransferHintsVisibility() {
    const fromHints = document.getElementById('transfer-from-hints');
    const toHints = document.getElementById('transfer-to-hints');

    if (transferRecordType === 'plan') {
        // Show hint containers for plan transfers
        if (fromHints) fromHints.classList.remove('hidden');
        if (toHints) toHints.classList.remove('hidden');
        // Load hints for currently selected categories
        loadTransferPlanHints('from');
        loadTransferPlanHints('to');
    } else {
        // Hide hint containers for fact transfers
        if (fromHints) fromHints.classList.add('hidden');
        if (toHints) toHints.classList.add('hidden');
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

    // Reload hints when period changes (only for plan transfers)
    if (transferRecordType === 'plan') {
        loadTransferPlanHints('from');
        loadTransferPlanHints('to');
    }
}

/**
 * Load plan hints for transfer modal (FROM or TO section)
 * @param {string} direction - 'from' (expense) or 'to' (income)
 */
async function loadTransferPlanHints(direction) {
    // Only load hints for plan transfers
    if (transferRecordType !== 'plan') return;

    const isFrom = direction === 'from';
    const timeoutRef = isFrom ? 'transferHintsFromTimeout' : 'transferHintsToTimeout';
    const controllerRef = isFrom ? 'transferHintsFromController' : 'transferHintsToController';
    const categoryTree = isFrom ? fromCategoryTree : toCategoryTree;
    const articleType = isFrom ? 'expense' : 'income';
    const planBtnId = isFrom ? 'transfer-hint-from-plan' : 'transfer-hint-to-plan';
    const factBtnId = isFrom ? 'transfer-hint-from-fact' : 'transfer-hint-to-fact';

    // Clear existing timeout
    if (window[timeoutRef]) clearTimeout(window[timeoutRef]);
    if (window[controllerRef]) window[controllerRef].abort();

    const planBtn = document.getElementById(planBtnId);
    const factBtn = document.getElementById(factBtnId);

    if (!planBtn || !factBtn) return;

    // Show loading state
    planBtn.innerHTML = '<span class="loading loading-spinner loading-xs"></span>';
    planBtn.disabled = true;
    planBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    factBtn.innerHTML = '<span class="loading loading-spinner loading-xs"></span>';
    factBtn.disabled = true;
    factBtn.className = 'btn btn-xs btn-ghost btn-disabled';

    // Get selected category
    const selectedCategory = categoryTree ? categoryTree.getSelectedCategory() : null;
    const articleId = selectedCategory ? selectedCategory.id : null;

    if (!articleId) {
        planBtn.innerHTML = 'План: --';
        factBtn.innerHTML = 'Факт: --';
        return;
    }

    window[timeoutRef] = setTimeout(async () => {
        try {
            window[controllerRef] = new AbortController();

            // Get selected period
            const periodInput = document.getElementById('transfer_plan_month');
            const period = periodInput ? periodInput.value : new Date().toISOString().slice(0, 7);

            // Get financial center ID for the direction
            const fcSelectId = isFrom ? 'from_financial_center' : 'to_financial_center';
            const fcSelect = document.getElementById(fcSelectId);
            const financialCenterId = fcSelect ? fcSelect.value : null;

            const params = new URLSearchParams({
                period: period,
                article_type: articleType
            });
            params.append('article_id', articleId);

            if (financialCenterId) {
                params.append('financial_center_id', financialCenterId);
            }

            const response = await fetch(`/api/v1/analytics/plan-hints?${params}`, {
                signal: window[controllerRef].signal,
                credentials: 'include'
            });

            if (!response.ok) {
                planBtn.innerHTML = 'План: --';
                factBtn.innerHTML = 'Факт: --';
                return;
            }

            const data = await response.json();
            updateTransferHintButtons(direction, data);

        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error(`[loadTransferPlanHints] Failed for ${direction}:`, error);
                planBtn.innerHTML = 'План: --';
                factBtn.innerHTML = 'Факт: --';
            }
        }
    }, 300);
}

/**
 * Update transfer hint buttons with data from API
 * @param {string} direction - 'from' or 'to'
 * @param {object} data - API response data
 */
function updateTransferHintButtons(direction, data) {
    const isFrom = direction === 'from';
    const planBtnId = isFrom ? 'transfer-hint-from-plan' : 'transfer-hint-to-plan';
    const factBtnId = isFrom ? 'transfer-hint-from-fact' : 'transfer-hint-to-fact';

    const planBtn = document.getElementById(planBtnId);
    const factBtn = document.getElementById(factBtnId);

    if (!planBtn || !factBtn) return;

    const formatAmount = (amount) => {
        if (amount === null || amount === undefined) return '--';
        const num = parseFloat(amount);
        if (num >= 1000) return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'k';
        return num.toFixed(0);
    };

    const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const prevMonth = monthNames[parseInt(data.prev_period.split('-')[1]) - 1];

    // Plan button
    const planAmt = data.prev_period_plan_sum;
    if (planAmt && parseFloat(planAmt) > 0) {
        planBtn.innerHTML = `План ${prevMonth}: ${formatAmount(planAmt)}₽`;
        planBtn.disabled = false;
        planBtn.className = 'btn btn-xs btn-outline btn-info';
        planBtn.onclick = () => setTransferAmount(parseFloat(planAmt));
    } else {
        planBtn.innerHTML = `План ${prevMonth}: --`;
        planBtn.disabled = true;
        planBtn.className = 'btn btn-xs btn-ghost btn-disabled';
        planBtn.onclick = null;
    }

    // Fact button
    const factAmt = data.prev_period_fact_sum;
    if (factAmt && parseFloat(factAmt) > 0) {
        factBtn.innerHTML = `Факт ${prevMonth}: ${formatAmount(factAmt)}₽`;
        factBtn.disabled = false;
        factBtn.className = 'btn btn-xs btn-outline btn-success';
        factBtn.onclick = () => setTransferAmount(parseFloat(factAmt));
    } else {
        factBtn.innerHTML = `Факт ${prevMonth}: --`;
        factBtn.disabled = true;
        factBtn.className = 'btn btn-xs btn-ghost btn-disabled';
        factBtn.onclick = null;
    }
}

/**
 * Set transfer amount from hint button click
 * @param {number} amount - Amount to set
 */
function setTransferAmount(amount) {
    const amountInput = document.getElementById('transfer_amount');
    if (amountInput) {
        amountInput.value = amount;
        amountInput.focus();
    }
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
            searchEnabled: true,
            onCategoryChange: (category) => {
                // Reload FROM hints when category changes (only for plan transfers)
                if (transferRecordType === 'plan') {
                    loadTransferPlanHints('from');
                }
            }
        });
    }

    // 3. Initialize ChoicesCategoryTree for TO (credit)
    if (typeof BudgetShared !== 'undefined' && BudgetShared.ChoicesCategoryTree) {
        toCategoryTree = new BudgetShared.ChoicesCategoryTree('#to_article', {
            type: 'credit',
            showLeafOnly: true,
            searchEnabled: true,
            onCategoryChange: (category) => {
                // Reload TO hints when category changes (only for plan transfers)
                if (transferRecordType === 'plan') {
                    loadTransferPlanHints('to');
                }
            }
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
 * Also triggers hint reload for plan transfers
 */
function setupCFOFiltering() {
    const fromFCSelect = document.querySelector('#from_financial_center');
    const toFCSelect = document.querySelector('#to_financial_center');

    if (fromFCSelect) {
        fromFCSelect.addEventListener('change', () => {
            populateFinancialCenterDropdowns();
            // Reload FROM hints when ЦФО changes (only for plan transfers)
            if (transferRecordType === 'plan') {
                loadTransferPlanHints('from');
            }
        });
    }

    if (toFCSelect) {
        toFCSelect.addEventListener('change', () => {
            populateFinancialCenterDropdowns();
            // Reload TO hints when ЦФО changes (only for plan transfers)
            if (transferRecordType === 'plan') {
                loadTransferPlanHints('to');
            }
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

                // Update quick stats and recent transactions (only on index.html)
                if (typeof htmx !== 'undefined') {
                    // Update recent-transactions only for fact transfers (not plan)
                    if (transferRecordType === 'fact' && document.getElementById('recent-transactions')) {
                        htmx.ajax('GET', '/api/v1/facts/recent-html?limit=5', {
                            target: '#recent-transactions',
                            swap: 'innerHTML'
                        });
                    }
                    // Update quick-stats for all transfer types
                    if (document.getElementById('quick-stats')) {
                        htmx.ajax('GET', '/api/v1/analytics/quick-stats-html', {
                            target: '#quick-stats',
                            swap: 'innerHTML'
                        });
                    }
                }
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

            // Update quick stats and recent transactions (only on index.html)
            if (typeof htmx !== 'undefined') {
                // Update recent-transactions only for fact transfers (not plan)
                if (transferRecordType === 'fact' && document.getElementById('recent-transactions')) {
                    htmx.ajax('GET', '/api/v1/facts/recent-html?limit=5', {
                        target: '#recent-transactions',
                        swap: 'innerHTML'
                    });
                }
                // Update quick-stats for all transfer types
                if (document.getElementById('quick-stats')) {
                    htmx.ajax('GET', '/api/v1/analytics/quick-stats-html', {
                        target: '#quick-stats',
                        swap: 'innerHTML'
                    });
                }
            }
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
