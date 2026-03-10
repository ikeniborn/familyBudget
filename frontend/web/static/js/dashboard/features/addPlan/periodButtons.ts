declare const debugLog: (...args: any[]) => void;

/**
 * Plan Period Buttons
 *
 * Handles period selection buttons for plan form (current month, +1 month, +2 months).
 */

// ============================================================================
// Period Buttons Setup
// ============================================================================

/**
 * Update period button texts with current month names
 */
export function updatePlanPeriodButtons(): void {
  const monthNamesShort = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const now = new Date();

  const buttons = [
    { id: 'plan_period_btn_1', offset: 0 },
    { id: 'plan_period_btn_2', offset: 1 },
    { id: 'plan_period_btn_3', offset: 2 },
  ];

  buttons.forEach(btn => {
    const button = document.getElementById(btn.id) as HTMLButtonElement | null;
    if (!button) return;

    const targetDate = new Date(now.getFullYear(), now.getMonth() + btn.offset, 1);
    const monthIndex = targetDate.getMonth();
    const year = targetDate.getFullYear();

    button.textContent = `${monthNamesShort[monthIndex]} ${year}`;
    button.dataset.year = String(year);
    button.dataset.month = String(monthIndex + 1).padStart(2, '0');
  });
}

/**
 * Set up handlers for period selection buttons
 */
export function setupPlanPeriodButtons(): void {
  // v10.1.51: Use v10.x tab-based selectors (modal_plan-tab-transaction)
  const periodButtons = document.querySelectorAll('#modal_plan-tab-transaction .period-btn') as NodeListOf<HTMLButtonElement>;

  const hiddenInput = document.querySelector('#modal_plan-tab-transaction input[name="plan_month"]') as HTMLInputElement | null;

  if (periodButtons.length === 0) {
    console.error('[setupPlanPeriodButtons] ❌ ERROR: No period buttons found!');
    console.error('[setupPlanPeriodButtons] This means modal DOM not ready or selector is wrong');
    return;
  }

  if (!hiddenInput) {
    console.error('[setupPlanPeriodButtons] ❌ ERROR: Hidden input not found!');
    return;
  }

  // Initialize button labels and data attributes (current month +0, +1, +2)
  const today = new Date();

  periodButtons.forEach((btn) => {
    const offset = parseInt(btn.dataset.offset || '0');
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    btn.textContent = label;
    btn.dataset.year = String(date.getFullYear());
    btn.dataset.month = String(date.getMonth() + 1).padStart(2, '0');
  });

  // Set value for first button (active by default)
  const firstButton = periodButtons[0];
  if (firstButton && firstButton.dataset.year && firstButton.dataset.month) {
    const defaultValue = `${firstButton.dataset.year}-${firstButton.dataset.month}`;
    hiddenInput.value = defaultValue;
  } else {
    console.error('[setupPlanPeriodButtons] ❌ ERROR: First button missing data attributes!');
  }

  // Click handlers (avoid duplicates)
  periodButtons.forEach(button => {
    // Skip if listener already attached
    if (button.dataset.listenerAttached === 'true') return;

    button.addEventListener('click', function() {
      // Remove btn-active from all buttons
      periodButtons.forEach(btn => btn.classList.remove('btn-active'));

      // Add btn-active to current button
      this.classList.add('btn-active');

      // Set value in hidden input (YYYY-MM)
      const year = this.dataset.year;
      const month = this.dataset.month;
      hiddenInput.value = `${year}-${month}`;

      debugLog('Selected plan period:', hiddenInput.value);
    });

    // Mark listener as attached
    button.dataset.listenerAttached = 'true';
  });
}

// ============================================================================
// Transfer Period Buttons Setup
// ============================================================================

/**
 * Set up transfer period buttons in plan_transfer_tab with month+year labels.
 * Mirrors setupPlanPeriodButtons() but targets '#modal_plan-tab-transfer .transfer-period-btn'.
 * Called from openModalPlan() after hideSkeleton().
 */
export function setupTransferPeriodButtons(): void {
  const periodButtons = document.querySelectorAll('#modal_plan-tab-transfer .transfer-period-btn') as NodeListOf<HTMLButtonElement>;

  const hiddenInput = document.querySelector('#modal_plan-tab-transfer input[name="transfer_plan_month"]') as HTMLInputElement | null;

  if (periodButtons.length === 0) return;

  if (!hiddenInput) return;

  // Initialize button labels and data attributes (current month +0, +1, +2)
  const today = new Date();
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  periodButtons.forEach((btn) => {
    const offset = parseInt(btn.dataset.offset || '0');
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    btn.textContent = label;
    btn.dataset.year = String(date.getFullYear());
    btn.dataset.month = String(date.getMonth() + 1).padStart(2, '0');
  });

  // Set value for first button (active by default)
  const firstButton = periodButtons[0];
  if (firstButton?.dataset.year && firstButton.dataset.month) {
    hiddenInput.value = `${firstButton.dataset.year}-${firstButton.dataset.month}`;
  }

  // Click handlers (avoid duplicates)
  periodButtons.forEach(button => {
    if (button.dataset.listenerAttached === 'true') return;

    button.addEventListener('click', function() {
      periodButtons.forEach(btn => btn.classList.remove('btn-active'));
      this.classList.add('btn-active');

      const year = this.dataset.year;
      const month = this.dataset.month;
      hiddenInput.value = `${year}-${month}`;

      debugLog('Selected transfer plan period:', hiddenInput.value);
    });

    button.dataset.listenerAttached = 'true';
  });
}

/**
 * Set up handlers for plan type buttons (income/expense)
 */
export function setupPlanTypeButtons(): void {
  const typeButtons = document.querySelectorAll('.plan-type-btn') as NodeListOf<HTMLElement>;

  if (typeButtons.length === 0) return;

  typeButtons.forEach(button => {
    if (button.dataset.listenerAttached === 'true') return;

    button.addEventListener('click', function(this: HTMLElement) {
      // Remove btn-active from all buttons
      typeButtons.forEach(btn => btn.classList.remove('btn-active'));

      // Add btn-active to current button
      this.classList.add('btn-active');

      // Check corresponding radio button
      const radio = this.querySelector('input[type="radio"]') as HTMLInputElement | null;
      if (radio) {
        radio.checked = true;
      }

      // Reload only plan categories with new type
      debugLog('Plan type changed to:', this.dataset.type);

      if ((window as any).Dashboard?.loadPlanCategories) {
        (window as any).Dashboard.loadPlanCategories();
      }
    });

    button.dataset.listenerAttached = 'true';
  });
}
