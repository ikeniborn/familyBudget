/**
 * Facts Manager - Selection Operations
 *
 * Multi-select logic and batch operations.
 *
 * Phase 1.3: Extract Selection Operations
 * Extracted from: frontend/web/templates/facts.html (lines 1518-1539)
 */

import { getSelectedIds, clearSelection, selectAll, toggleSelection } from '../core/stateManager';
import { getCachedFacts } from '../core/stateManager';

// ============================================================================
// Selection Actions
// ============================================================================

/**
 * Toggle select all checkboxes
 * @param selectAllCheckbox - The "select all" checkbox element
 */
export function toggleSelectAll(selectAllCheckbox: HTMLInputElement): void {
    const checkboxes = document.querySelectorAll('.fact-checkbox') as NodeListOf<HTMLInputElement>;

    if (selectAllCheckbox.checked) {
        // Select all visible facts
        const factIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        selectAll(factIds);

        // Check all checkboxes
        checkboxes.forEach(cb => {
            cb.checked = true;
        });
    } else {
        // Deselect all
        clearSelection();

        // Uncheck all checkboxes
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
    }

    updateBatchDeleteButtonUI();
}

/**
 * Toggle individual fact selection
 * @param factId - Fact ID to toggle
 */
export function toggleFactSelection(factId: number): void {
    toggleSelection(factId);
    updateCheckboxUI(factId);
    updateBatchDeleteButtonUI();
}

/**
 * Sync selection state with UI checkboxes
 * Called after rendering facts table
 */
export function syncSelectionWithUI(): void {
    const checkboxes = document.querySelectorAll('.fact-checkbox:checked') as NodeListOf<HTMLInputElement>;
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    // Update state to match UI
    clearSelection();
    selectAll(selectedIds);

    updateBatchDeleteButtonUI();
}

// ============================================================================
// UI Updates
// ============================================================================

/**
 * Update individual checkbox UI
 */
export function updateCheckboxUI(factId: number): void {
    const selectedIds = getSelectedIds();
    const checkbox = document.querySelector(`.fact-checkbox[value="${factId}"]`) as HTMLInputElement;

    if (checkbox) {
        checkbox.checked = selectedIds.has(factId);
    }
}

/**
 * Update all checkboxes UI to match state
 */
export function updateAllCheckboxesUI(): void {
    const selectedIds = getSelectedIds();
    const checkboxes = document.querySelectorAll('.fact-checkbox') as NodeListOf<HTMLInputElement>;

    checkboxes.forEach(cb => {
        const factId = parseInt(cb.value);
        cb.checked = selectedIds.has(factId);
    });

    // Update "select all" checkbox
    updateSelectAllCheckboxUI();
}

/**
 * Update "select all" checkbox state
 */
export function updateSelectAllCheckboxUI(): void {
    const selectAllCheckbox = document.getElementById('select-all-checkbox') as HTMLInputElement;
    if (!selectAllCheckbox) return;

    const checkboxes = document.querySelectorAll('.fact-checkbox') as NodeListOf<HTMLInputElement>;
    const checkedCount = document.querySelectorAll('.fact-checkbox:checked').length;

    if (checkboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === checkboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

/**
 * Update batch delete button state and text
 */
export function updateBatchDeleteButtonUI(): void {
    const btn = document.getElementById('batch-delete-btn') as HTMLButtonElement;
    if (!btn) return;

    const selectedIds = getSelectedIds();
    const selectedCount = selectedIds.size;

    btn.disabled = selectedCount === 0;
    btn.textContent = selectedCount > 0
        ? `🗑️ Удалить выбранные (${selectedCount})`
        : '🗑️ Удалить выбранные';
}

// ============================================================================
// Selection Queries
// ============================================================================

/**
 * Get count of selected facts
 */
export function getSelectionCount(): number {
    return getSelectedIds().size;
}

/**
 * Check if any facts selected
 */
export function hasSelection(): boolean {
    return getSelectedIds().size > 0;
}

/**
 * Check if all visible facts selected
 */
export function isAllSelected(): boolean {
    const cachedFacts = getCachedFacts();
    const selectedIds = getSelectedIds();

    if (cachedFacts.length === 0) return false;

    return cachedFacts.every(fact => selectedIds.has(fact.id));
}

/**
 * Get selected fact IDs as array
 */
export function getSelectedIdsArray(): number[] {
    return Array.from(getSelectedIds());
}
