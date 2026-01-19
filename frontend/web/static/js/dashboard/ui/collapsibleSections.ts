/**
 * Collapsible Sections for Dashboard
 *
 * Handles mobile-only collapsible sections for Quick Stats and Account Balances.
 */

import { getState, updateState } from '../core/DashboardState';

// ============================================================================
// Constants
// ============================================================================

const MOBILE_BREAKPOINT = 768;
const RESIZE_DEBOUNCE_MS = 100;

// ============================================================================
// State
// ============================================================================

let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// Quick Stats
// ============================================================================

/**
 * Toggle quick stats section (mobile only).
 */
export function toggleQuickStats(): void {
  if (window.innerWidth >= MOBILE_BREAKPOINT) return;

  const state = getState();
  updateState({ quickStatsExpanded: !state.quickStatsExpanded });
  applyQuickStatsState();
}

/**
 * Apply quick stats collapsed/expanded state.
 */
export function applyQuickStatsState(): void {
  const container = document.getElementById('quick-stats');
  const indicator = document.querySelector('#quick-stats-header .expand-indicator') as HTMLElement | null;

  if (!container || !indicator) return;

  const cards = container.querySelectorAll('.stat-card') as NodeListOf<HTMLElement>;
  const hiddenCount = Math.max(0, cards.length - 2);

  // Edge case: if cards ≤ 2, hide indicator
  if (hiddenCount === 0) {
    indicator.style.display = 'none';
    return;
  }

  const state = getState();

  cards.forEach((card, index) => {
    // Show only first 2 cards (Income, Expense) in collapsed state
    // Indices: 0=Income, 1=Expense, 2=Credit, 3=Debit
    if (index >= 2) {
      card.style.display = state.quickStatsExpanded ? '' : 'none';
    }
  });

  // Hide indicator in expanded state, show in collapsed
  indicator.style.display = state.quickStatsExpanded ? 'none' : '';
  const indicatorText = indicator.querySelector('.indicator-text');
  if (indicatorText) {
    indicatorText.textContent = `+${hiddenCount}`;
  }
}

// ============================================================================
// Account Balances
// ============================================================================

/**
 * Toggle account balances section (mobile only).
 */
export function toggleAccountBalances(): void {
  if (window.innerWidth >= MOBILE_BREAKPOINT) return;

  const state = getState();
  updateState({ accountBalancesExpanded: !state.accountBalancesExpanded });
  applyAccountBalancesState();
}

/**
 * Apply account balances collapsed/expanded state.
 */
export function applyAccountBalancesState(): void {
  const container = document.getElementById('account-balances');
  const indicator = document.querySelector('#account-balances-header .expand-indicator') as HTMLElement | null;

  if (!container || !indicator) return;

  // Get all cards and sort by movement (descending)
  const cards = Array.from(container.querySelectorAll('.balance-card')) as HTMLElement[];
  const hiddenCount = Math.max(0, cards.length - 2);

  // Edge case: if accounts ≤ 2, hide indicator
  if (hiddenCount === 0) {
    indicator.style.display = 'none';
    return;
  }

  const sortedCards = cards.sort((a, b) => {
    const movementA = parseFloat(a.dataset.movement || '0') || 0;
    const movementB = parseFloat(b.dataset.movement || '0') || 0;
    return movementB - movementA; // Descending
  });

  const state = getState();

  // Show only top-2 in collapsed state
  sortedCards.forEach((card, index) => {
    if (index >= 2) {
      card.style.display = state.accountBalancesExpanded ? '' : 'none';
    }
  });

  // Hide indicator in expanded state, show in collapsed
  indicator.style.display = state.accountBalancesExpanded ? 'none' : '';
  const indicatorText = indicator.querySelector('.indicator-text');
  if (indicatorText) {
    indicatorText.textContent = `+${hiddenCount}`;
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle HTMX afterSwap event for collapsible sections.
 */
function handleHtmxAfterSwap(event: Event): void {
  if (window.innerWidth >= MOBILE_BREAKPOINT) return;

  const customEvent = event as CustomEvent<{ target: HTMLElement }>;
  const targetId = customEvent.detail?.target?.id;

  if (targetId === 'quick-stats') {
    applyQuickStatsState();
  }

  if (targetId === 'account-balances') {
    applyAccountBalancesState();
  }
}

/**
 * Handle window resize with debounce.
 */
function handleResize(): void {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }

  resizeTimeout = setTimeout(() => {
    if (window.innerWidth >= MOBILE_BREAKPOINT) {
      // Desktop - reset inline styles (CSS !important will show all)
      document.querySelectorAll<HTMLElement>('.stat-card, .balance-card').forEach(card => {
        card.style.display = '';
      });
    } else {
      // Mobile - apply current state
      applyQuickStatsState();
      applyAccountBalancesState();
    }
  }, RESIZE_DEBOUNCE_MS);
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize collapsible sections event listeners.
 */
export function initCollapsibleSections(): void {
  // Listen for HTMX afterSwap to apply state after data loads
  document.addEventListener('htmx:afterSwap', handleHtmxAfterSwap);

  // Listen for resize with debounce
  window.addEventListener('resize', handleResize);

  // Apply initial state on mobile
  if (window.innerWidth < MOBILE_BREAKPOINT) {
    // Delay to ensure DOM is ready
    setTimeout(() => {
      applyQuickStatsState();
      applyAccountBalancesState();
    }, 100);
  }
}

/**
 * Cleanup collapsible sections event listeners.
 */
export function cleanupCollapsibleSections(): void {
  document.removeEventListener('htmx:afterSwap', handleHtmxAfterSwap);
  window.removeEventListener('resize', handleResize);

  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
    resizeTimeout = null;
  }
}
