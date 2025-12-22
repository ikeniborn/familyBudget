/**
 * Transfer Modal Logic
 * Handles transfer creation between accounts
 * Supports both fact and plan record types
 */

// Global variables
let transferDateWidget = null;
let fromCategoryTree = null;
let toCategoryTree = null;
let transferRecordType = 'fact'; // Default to fact, can be 'plan' for planned transfers
let allFinancialCenters = []; // Store all accounts for filtering
let allCostCenters = []; // Store all cost centers for filtering

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
 * Hints are shown for BOTH fact and plan transfers
 */
function updateTransferHintsVisibility() {
    const fromHints = document.getElementById('transfer-from-hints');
    const toHints = document.getElementById('transfer-to-hints');

    // Show hints for BOTH fact and plan transfers
    if (fromHints) fromHints.classList.remove('hidden');
    if (toHints) toHints.classList.remove('hidden');

    if (transferRecordType === 'plan') {
        // Load plan hints (previous month data, clickable)
        loadTransferPlanHints('from');
        loadTransferPlanHints('to');
    } else {
        // Load fact hints (current month data, display-only)
        loadTransferFactHints('from');
        loadTransferFactHints('to');
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
        // Skip API call if offline
        if (!navigator.onLine) {
            planBtn.innerHTML = 'План: --';
            factBtn.innerHTML = 'Факт: --';
            return;
        }

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
            // Silently handle abort and network errors (offline mode)
            if (error.name !== 'AbortError') {
                // Only log non-network errors
                if (navigator.onLine && !error.message?.includes('Failed to fetch')) {
                    console.error(`[loadTransferPlanHints] Failed for ${direction}:`, error);
                }
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
        planBtn.innerHTML = `План ${prevMonth}: ${formatAmount(planAmt)}`;
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
        factBtn.innerHTML = `Факт ${prevMonth}: ${formatAmount(factAmt)}`;
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
 * Load fact hints for transfer modal (FROM or TO section)
 * Shows plan/fact sums for the CURRENT month (based on selected date)
 * Buttons are display-only (not clickable)
 * @param {string} direction - 'from' (expense/debit) or 'to' (income/credit)
 */
async function loadTransferFactHints(direction) {
    // Only load hints for fact transfers
    if (transferRecordType !== 'fact') return;

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
        // Skip API call if offline
        if (!navigator.onLine) {
            planBtn.innerHTML = 'План: --';
            factBtn.innerHTML = 'Факт: --';
            return;
        }

        try {
            window[controllerRef] = new AbortController();

            // Get selected date (fact_date determines the month)
            const dateInput = document.getElementById('transfer_date');
            const factDate = dateInput && dateInput.value
                ? BudgetShared.DateFormatter.formatForAPI(dateInput.value)
                : new Date().toISOString().split('T')[0];

            // Get financial center ID for the direction
            const fcSelectId = isFrom ? 'from_financial_center' : 'to_financial_center';
            const fcSelect = document.getElementById(fcSelectId);
            const financialCenterId = fcSelect ? fcSelect.value : null;

            const params = new URLSearchParams({
                fact_date: factDate,
                article_type: articleType
            });
            params.append('article_id', articleId);

            if (financialCenterId) {
                params.append('financial_center_id', financialCenterId);
            }

            const response = await fetch(`/api/v1/analytics/fact-hints?${params}`, {
                signal: window[controllerRef].signal,
                credentials: 'include'
            });

            if (!response.ok) {
                planBtn.innerHTML = 'План: --';
                factBtn.innerHTML = 'Факт: --';
                return;
            }

            const data = await response.json();
            updateTransferFactHintButtons(direction, data);

        } catch (error) {
            // Silently handle abort and network errors (offline mode)
            if (error.name !== 'AbortError') {
                if (navigator.onLine && !error.message?.includes('Failed to fetch')) {
                    console.error(`[loadTransferFactHints] Failed for ${direction}:`, error);
                }
                planBtn.innerHTML = 'План: --';
                factBtn.innerHTML = 'Факт: --';
            }
        }
    }, 300);
}

/**
 * Update transfer hint buttons with fact hints data (display-only)
 * @param {string} direction - 'from' or 'to'
 * @param {object} data - API response from fact-hints endpoint
 */
function updateTransferFactHintButtons(direction, data) {
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
    const monthName = monthNames[parseInt(data.period.split('-')[1]) - 1];

    // Plan button (display-only, not clickable)
    const planAmt = data.period_plan_sum;
    if (planAmt && parseFloat(planAmt) > 0) {
        planBtn.innerHTML = `План ${monthName}: ${formatAmount(planAmt)}`;
        planBtn.className = 'btn btn-xs btn-ghost text-info';
    } else {
        planBtn.innerHTML = `План ${monthName}: --`;
        planBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    }
    planBtn.disabled = true;
    planBtn.onclick = null;

    // Fact button (display-only, not clickable)
    const factAmt = data.period_fact_sum;
    if (factAmt && parseFloat(factAmt) > 0) {
        factBtn.innerHTML = `Факт ${monthName}: ${formatAmount(factAmt)}`;
        factBtn.className = 'btn btn-xs btn-ghost text-success';
    } else {
        factBtn.innerHTML = `Факт ${monthName}: --`;
        factBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    }
    factBtn.disabled = true;
    factBtn.onclick = null;
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
                // Reload FROM hints when category changes
                if (transferRecordType === 'plan') {
                    loadTransferPlanHints('from');
                } else {
                    loadTransferFactHints('from');
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
                // Reload TO hints when category changes
                if (transferRecordType === 'plan') {
                    loadTransferPlanHints('to');
                } else {
                    loadTransferFactHints('to');
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
 * Load Accounts and Cost Locations for Transfer Modal
 * Populates dropdowns with data from API or cache
 * Uses cache for offline mode and as fallback
 */
async function loadTransferData() {
    const CACHE_KEY_FC = 'transfer_financial_centers';
    const CACHE_KEY_CC = 'transfer_cost_centers';
    const CACHE_TTL = 3600; // 1 hour

    try {
        // Try to load Financial Centers from API
        let financialCenters = [];
        let costCenters = [];

        if (navigator.onLine) {
            try {
                const fcResponse = await fetch('/api/v1/financial-centers?limit=1000&include_global=true', {
                    credentials: 'include'
                });
                if (fcResponse.ok) {
                    const fcData = await fcResponse.json();
                    financialCenters = fcData.financial_centers || [];

                    // Cache for offline use
                    if (window.offlineManager && window.offlineManager.db) {
                        await window.offlineManager.db.setCache(CACHE_KEY_FC, financialCenters, CACHE_TTL);
                    }
                }

                const ccResponse = await fetch('/api/v1/cost-centers?limit=1000&include_global=true', {
                    credentials: 'include'
                });
                if (ccResponse.ok) {
                    const ccData = await ccResponse.json();
                    costCenters = ccData.cost_centers || [];

                    // Cache for offline use
                    if (window.offlineManager && window.offlineManager.db) {
                        await window.offlineManager.db.setCache(CACHE_KEY_CC, costCenters, CACHE_TTL);
                    }
                }
            } catch (fetchError) {
                // Network error - try cache
                console.log('[Transfer] API fetch failed, trying cache:', fetchError.message);
            }
        }

        // Fallback to cache if no data loaded
        if (financialCenters.length === 0 && window.offlineManager && window.offlineManager.db) {
            const cached = await window.offlineManager.db.getCache(CACHE_KEY_FC);
            if (cached) {
                financialCenters = cached;
                console.log('[Transfer] Using cached financial centers:', financialCenters.length);
            }
        }

        if (costCenters.length === 0 && window.offlineManager && window.offlineManager.db) {
            const cached = await window.offlineManager.db.getCache(CACHE_KEY_CC);
            if (cached) {
                costCenters = cached;
                console.log('[Transfer] Using cached cost centers:', costCenters.length);
            }
        }

        // Populate Financial Centers
        allFinancialCenters = financialCenters;
        populateFinancialCenterDropdowns();

        // Save all cost centers for filtering
        allCostCenters = costCenters;

        // Populate Cost Centers (TO dropdown only - FROM removed from UI)
        // Note: from_cost_center_id is always null for transfers
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
    } catch (error) {
        console.error('[Transfer] Error loading data:', error);
        // Try cache as last resort
        try {
            if (window.offlineManager && window.offlineManager.db) {
                const cachedFC = await window.offlineManager.db.getCache(CACHE_KEY_FC);
                const cachedCC = await window.offlineManager.db.getCache(CACHE_KEY_CC);

                if (cachedFC) {
                    allFinancialCenters = cachedFC;
                    populateFinancialCenterDropdowns();
                }

                if (cachedCC) {
                    // Note: from_cost_center removed from UI - only populate TO dropdown
                    const toCCSelect = document.querySelector('#to_cost_center');

                    if (toCCSelect) {
                        while (toCCSelect.options.length > 1) toCCSelect.remove(1);
                        cachedCC.forEach(cc => {
                            const option = document.createElement('option');
                            option.value = cc.id;
                            option.textContent = cc.name;
                            toCCSelect.appendChild(option);
                        });
                    }
                }
            }
        } catch (cacheError) {
            console.error('[Transfer] Cache fallback failed:', cacheError);
        }
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
 * Filter cost center dropdown by financial center ID
 * Whitelist pattern: show cost centers without FC restrictions OR linked to this FC
 * @param {string} selectId - ID of the select element (e.g., 'from_cost_center')
 * @param {number|null} financialCenterId - Selected financial center ID
 */
async function filterCostCenterDropdown(selectId, financialCenterId) {
    const select = document.querySelector(`#${selectId}`);
    if (!select) return;

    // Save currently selected value
    const currentValue = select.value;

    // Clear existing options (keep placeholder)
    while (select.options.length > 1) {
        select.remove(1);
    }

    if (!financialCenterId) {
        // No FC selected - show all cost centers
        allCostCenters.forEach(cc => {
            const option = document.createElement('option');
            option.value = cc.id;
            option.textContent = cc.name;
            if (String(cc.id) === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        return;
    }

    // Fetch filtered cost centers from API
    try {
        const response = await fetch(
            `/api/v1/cost-centers?limit=1000&financial_center_id=${financialCenterId}`,
            { credentials: 'include' }
        );
        if (response.ok) {
            const data = await response.json();
            const filteredCostCenters = data.cost_centers || [];
            filteredCostCenters.forEach(cc => {
                const option = document.createElement('option');
                option.value = cc.id;
                option.textContent = cc.name;
                if (String(cc.id) === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        } else {
            // Fallback to showing all
            allCostCenters.forEach(cc => {
                const option = document.createElement('option');
                option.value = cc.id;
                option.textContent = cc.name;
                if (String(cc.id) === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('[Transfer] Error filtering cost centers:', error);
        // Fallback to showing all
        allCostCenters.forEach(cc => {
            const option = document.createElement('option');
            option.value = cc.id;
            option.textContent = cc.name;
            if (String(cc.id) === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
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
        fromFCSelect.addEventListener('change', async () => {
            populateFinancialCenterDropdowns();
            const fcId = fromFCSelect.value ? parseInt(fromFCSelect.value) : null;
            // Filter FROM categories by selected FC
            if (fromCategoryTree) {
                await fromCategoryTree.updateFinancialCenter(fcId);
            }
            // Note: from_cost_center removed from UI (not needed for transfers)
            // Reload FROM hints when account changes
            if (transferRecordType === 'plan') {
                loadTransferPlanHints('from');
            } else {
                loadTransferFactHints('from');
            }
        });
    }

    if (toFCSelect) {
        toFCSelect.addEventListener('change', async () => {
            populateFinancialCenterDropdowns();
            const fcId = toFCSelect.value ? parseInt(toFCSelect.value) : null;
            // Filter TO categories by selected FC
            if (toCategoryTree) {
                await toCategoryTree.updateFinancialCenter(fcId);
            }
            // Filter TO cost center dropdown
            await filterCostCenterDropdown('to_cost_center', fcId);
            // Reload TO hints when account changes
            if (transferRecordType === 'plan') {
                loadTransferPlanHints('to');
            } else {
                loadTransferFactHints('to');
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

    // Setup date change handler for fact hints reload
    dateInput.addEventListener('change', () => {
        if (transferRecordType === 'fact') {
            loadTransferFactHints('from');
            loadTransferFactHints('to');
        }
    });
}

/**
 * Open Transfer Modal
 * Reloads financial centers data to ensure dropdowns are populated
 * Applies category filtering based on currently selected FCs
 */
async function openTransferModal() {
    const modal = document.querySelector('#transfer_modal');
    if (modal) {
        // Ensure financial centers and cost centers are loaded
        // (may not have completed on page load due to race condition)
        await loadTransferData();

        // Apply category filtering based on currently selected FCs
        // This is necessary when reopening modal with previously selected FC
        const fromFCSelect = document.querySelector('#from_financial_center');
        const toFCSelect = document.querySelector('#to_financial_center');

        if (fromCategoryTree && fromFCSelect) {
            const fcId = fromFCSelect.value ? parseInt(fromFCSelect.value) : null;
            await fromCategoryTree.updateFinancialCenter(fcId);
        }
        if (toCategoryTree && toFCSelect) {
            const fcId = toFCSelect.value ? parseInt(toFCSelect.value) : null;
            await toCategoryTree.updateFinancialCenter(fcId);
        }

        // Set today as default date (only for fact transfers, plan uses period buttons)
        // today() already returns DD.MM.YYYY format, no need for formatForDisplay()
        if (transferRecordType === 'fact') {
            document.querySelector('#transfer_date').value = BudgetShared.DateFormatter.today();
        }

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
        from_cost_center_id: null,  // Removed from UI - always null for transfers
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
    setSubmitLoading(event.target, true);
    try {
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

                // Close modal after successful offline save
                document.querySelector('#transfer_modal').close();
                event.target.reset();
            } else {
                // Saved online
                const successMsg = transferRecordType === 'plan'
                    ? 'Плановый перевод создан успешно!'
                    : 'Перевод создан успешно!';
                if (typeof showToast === 'function') {
                    showToast(successMsg, 'success');
                }

                // Update quick stats and recent records (only on index.html)
                if (typeof htmx !== 'undefined') {
                    // Update recent-transactions for all transfer types (now shows both facts and plans)
                    if (document.getElementById('recent-transactions')) {
                        htmx.ajax('GET', '/api/v1/facts/recent-html?limit=10', {
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
                // Update facts table if on facts/plan page
                if (typeof loadFacts === 'function' && document.getElementById('facts-table-container')) {
                    await loadFacts();
                }

                // Close modal after successful online save
                document.querySelector('#transfer_modal').close();
                event.target.reset();
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

            // Update quick stats and recent records (only on index.html)
            if (typeof htmx !== 'undefined') {
                // Update recent-transactions for all transfer types (now shows both facts and plans)
                if (document.getElementById('recent-transactions')) {
                    htmx.ajax('GET', '/api/v1/facts/recent-html?limit=10', {
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
            // Update facts table if on facts/plan page
            if (typeof loadFacts === 'function' && document.getElementById('facts-table-container')) {
                await loadFacts();
            }

            // Close modal after successful fallback save
            document.querySelector('#transfer_modal').close();
            event.target.reset();
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
    } finally {
        setSubmitLoading(event.target, false);
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
