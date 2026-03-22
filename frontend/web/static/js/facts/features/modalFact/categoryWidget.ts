/**
 * Facts Manager - Category Widget for Edit Modal
 *
 * Handles ChoicesCategoryTree initialization and destruction
 * for the Edit Fact modal category selector.
 */

import {
    getEditCategoryTreeSelect,
    setEditCategoryTreeSelect,
} from '../../core/stateManager';

// ============================================================================
// Edit Modal Category Tree
// ============================================================================

/**
 * Initialize ChoicesCategoryTree for the Edit Fact modal.
 *
 * @param articleType - Category type: 'expense' | 'income' | 'debit' | 'credit'
 * @param selectedId  - Pre-selected article ID, or null for no selection
 */
export function initEditCategoryTree(articleType: string, selectedId: number | null): void {
    const ChoicesCategoryTree = (window as any).BudgetShared?.ChoicesCategoryTree;
    if (!ChoicesCategoryTree) return;

    const articleSelect = document.querySelector('#edit-article');
    if (!articleSelect) return;

    // Destroy previous instance if one exists
    const prev = getEditCategoryTreeSelect();
    if (prev) {
        try { prev.destroy(); } catch (_) { /* ignore cleanup errors */ }
        setEditCategoryTreeSelect(null);
    }

    const instance = new ChoicesCategoryTree('#edit-article', {
        type: articleType,
        showLeafOnly: true,
        mode: 'edit',
        selectedId: selectedId,
        onCategoryChange: () => {},
    });

    setEditCategoryTreeSelect(instance);
}

/**
 * Destroy the ChoicesCategoryTree instance for the Edit Fact modal.
 * Should be called when the edit modal closes.
 */
export function destroyEditCategoryTree(): void {
    const inst = getEditCategoryTreeSelect();
    if (inst) {
        try { inst.destroy(); } catch (_) { /* ignore cleanup errors */ }
        setEditCategoryTreeSelect(null);
    }
}
