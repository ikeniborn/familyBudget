/**
 * Facts Manager - Category Widget for modal_fact
 *
 * Initializes ChoicesCategoryTree for transaction and transfer tabs
 * in modal_fact on the /facts page (facts.min.js only, no dashboard.min.js).
 *
 * Mirrors dashboard/features/addTransaction/categoryLoader.ts behaviour.
 */

import {
    getCreateCategoryTreeSelect,
    setCreateCategoryTreeSelect,
    getCreateTransferFromTree,
    setCreateTransferFromTree,
    getCreateTransferToTree,
    setCreateTransferToTree,
    getEditCategoryTreeSelect,
    setEditCategoryTreeSelect
} from '../../core/stateManager';
import { setupMobileModalPositioning } from '../../../utils/mobileModalPositioning';

const TRANSACTION_ARTICLE_SELECTOR = '#modal_fact-tab-transaction select[name="article_id"]';
const TRANSACTION_FC_SELECTOR      = '#modal_fact-tab-transaction select[name="financial_center_id"]';
const TRANSACTION_CC_SELECTOR      = '#modal_fact-tab-transaction select[name="cost_center_id"]';
const FROM_ARTICLE_SELECTOR        = '#modal_fact-tab-transfer select[name="from_article_id"]';
const TO_ARTICLE_SELECTOR          = '#modal_fact-tab-transfer select[name="to_article_id"]';
const FROM_FC_SELECTOR             = '#modal_fact-tab-transfer select[name="from_financial_center_id"]';
const TO_FC_SELECTOR               = '#modal_fact-tab-transfer select[name="to_financial_center_id"]';
const MODAL_FACT_ID                = 'modal_fact'; // bare id for setupMobileModalPositioning (no leading #)

// ============================================================================
// Transaction Tab
// ============================================================================

/**
 * Initialize ChoicesCategoryTree for transaction tab.
 * Called on every modal open (not just once) to handle re-renders.
 */
export function initTransactionCategoryTree(): void {
    const ChoicesCategoryTree = (window as any).BudgetShared?.ChoicesCategoryTree;
    if (!ChoicesCategoryTree) return;

    const articleSelect = document.querySelector(TRANSACTION_ARTICLE_SELECTOR);
    if (!articleSelect) return;

    // Get current type: prefer CSS active button state (persists across form.reset()),
    // fall back to radio value, then default to 'expense'
    const activeBtn = document.querySelector(
        '#modal_fact-tab-transaction .transaction-type-btn.btn-active'
    ) as HTMLElement | null;
    const typeInput = document.querySelector(
        '#modal_fact-tab-transaction input[name="record_type"]:checked'
    ) as HTMLInputElement | null;
    const currentType = (activeBtn?.dataset.type as 'expense' | 'income') || typeInput?.value || 'expense';
    // Sync radio and hidden fact_type to match CSS state (form.reset() resets these but not CSS)
    const radioToSync = document.querySelector(
        `#modal_fact-tab-transaction input[name="record_type"][value="${currentType}"]`
    ) as HTMLInputElement | null;
    if (radioToSync) radioToSync.checked = true;
    syncFactTypeHidden(currentType);

    const prev = getCreateCategoryTreeSelect();
    if (prev) {
        // updateType is cheaper than destroy + recreate
        try { prev.updateType(currentType); } catch (_) {}
        return;
    }

    const instance = new ChoicesCategoryTree(
        TRANSACTION_ARTICLE_SELECTOR,
        {
            type: currentType,
            showLeafOnly: true,
            mode: 'create',
            onCategoryChange: (category: any) => {
                // Sync fact_type hidden field so createFact() receives correct value
                if (category?.type) {
                    syncFactTypeHidden(category.type);
                }
                // Trigger hints update
                if (typeof (window as any).loadFactHints === 'function') {
                    (window as any).loadFactHints(category);
                }
            }
        }
    );

    setCreateCategoryTreeSelect(instance);

    // Initial state: disabled until FC is selected (mirrors dashboard behaviour)
    instance.disable();

    // PWA: reposition modal to top when dropdown opens to keep list visible
    setupMobileModalPositioning(instance, MODAL_FACT_ID);

    // Setup FC change listener to enable/disable category and cost center
    setupTransactionFCListener();
}

/**
 * Update ChoicesCategoryTree type when expense/income radio changes.
 * Also syncs the hidden fact_type field.
 */
export function updateTransactionCategoryTreeType(type: 'expense' | 'income'): void {
    syncFactTypeHidden(type);

    const instance = getCreateCategoryTreeSelect();
    if (instance?.updateType) {
        try { instance.updateType(type); } catch (_) {}
    }
}

/**
 * Sync hidden fact_type input with chosen type.
 * Ensures createFact() (factsController.ts) receives the correct value.
 */
function syncFactTypeHidden(type: string): void {
    const hiddenInput = document.querySelector(
        '#modal_fact-tab-transaction input[name="fact_type"]'
    ) as HTMLInputElement | null;
    if (hiddenInput) hiddenInput.value = type;
}

/**
 * Setup FC change listener for transaction tab.
 * Enables/disables category tree and cost center when a financial center is selected.
 * Mirrors dashboard/features/addTransaction/categoryLoader.ts#setupFinancialCenterListeners().
 */
function setupTransactionFCListener(): void {
    const fcSelect = document.querySelector<HTMLSelectElement>(TRANSACTION_FC_SELECTOR);
    if (!fcSelect || fcSelect.dataset.listenerAttached) return;

    fcSelect.addEventListener('change', () => {
        const fcId = fcSelect.value ? parseInt(fcSelect.value) : null;
        const tree = getCreateCategoryTreeSelect();
        const ccSelect = document.querySelector<HTMLSelectElement>(TRANSACTION_CC_SELECTOR);

        if (fcId) {
            // Enable category tree
            if (tree) {
                tree.enable();
                if (tree.updateFinancialCenter) {
                    tree.updateFinancialCenter(fcId);
                }
            }
            // Enable cost center select
            if (ccSelect) ccSelect.removeAttribute('disabled');
        } else {
            // Disable category tree
            if (tree) {
                tree.clearSelection();
                tree.disable();
            }
            // Disable cost center select
            if (ccSelect) {
                ccSelect.value = '';
                ccSelect.setAttribute('disabled', 'disabled');
            }
        }
    });

    fcSelect.dataset.listenerAttached = 'true';
}

// ============================================================================
// Transfer Tab
// ============================================================================

/**
 * Initialize ChoicesCategoryTree for FROM and TO fields in transfer tab.
 * Called on modal open only when dashboard.min.js is not loaded
 * (i.e., Dashboard.openFactTransferModal is unavailable).
 */
export async function initTransferCategoryTrees(): Promise<void> {
    const ChoicesCategoryTree = (window as any).BudgetShared?.ChoicesCategoryTree;
    if (!ChoicesCategoryTree) return;

    const fromSelect = document.querySelector(FROM_ARTICLE_SELECTOR);
    const toSelect = document.querySelector(TO_ARTICLE_SELECTOR);
    if (!fromSelect || !toSelect) return;

    // FROM tree — debit category
    if (!getCreateTransferFromTree()) {
        const fromInstance = new ChoicesCategoryTree(
            FROM_ARTICLE_SELECTOR,
            {
                type: 'debit',
                showLeafOnly: true,
                mode: 'create'
            }
        );
        setCreateTransferFromTree(fromInstance);
        // Wait for async init (API fetch) before showing modal
        await fromInstance.waitForReady();
        // Initial state: disabled until FC is selected (mirrors dashboard behaviour)
        fromInstance.clearSelection();
        fromInstance.disable();
        // PWA: reposition modal to top when dropdown opens
        setupMobileModalPositioning(fromInstance, MODAL_FACT_ID);
    }

    // TO tree — credit category
    if (!getCreateTransferToTree()) {
        const toInstance = new ChoicesCategoryTree(
            TO_ARTICLE_SELECTOR,
            {
                type: 'credit',
                showLeafOnly: true,
                mode: 'create'
            }
        );
        setCreateTransferToTree(toInstance);
        // Wait for async init (API fetch) before showing modal
        await toInstance.waitForReady();
        // Initial state: disabled until FC is selected (mirrors dashboard behaviour)
        toInstance.clearSelection();
        toInstance.disable();
        // PWA: reposition modal to top when dropdown opens
        setupMobileModalPositioning(toInstance, MODAL_FACT_ID);
    }

    // Setup FC change listeners to enable/disable category trees
    setupTransferFCListeners();
}

/**
 * Setup FC change listeners for transfer tab.
 * Enables/disables category trees when a financial center is selected.
 * Mirrors dashboard/features/modalFact/index.ts#setupTransferFCListeners().
 */
function setupTransferFCListeners(): void {
    const fromFcSelect = document.querySelector<HTMLSelectElement>(FROM_FC_SELECTOR);
    const toFcSelect   = document.querySelector<HTMLSelectElement>(TO_FC_SELECTOR);

    if (fromFcSelect && !fromFcSelect.dataset.listenerAttached) {
        fromFcSelect.addEventListener('change', () => {
            const fromTree = getCreateTransferFromTree();
            const fcId = fromFcSelect.value ? parseInt(fromFcSelect.value) : null;
            if (fromTree) {
                if (!fcId) {
                    fromTree.clearSelection();
                    fromTree.disable();
                } else {
                    fromTree.enable();
                }
            }
        });
        fromFcSelect.dataset.listenerAttached = 'true';
    }

    if (toFcSelect && !toFcSelect.dataset.listenerAttached) {
        toFcSelect.addEventListener('change', () => {
            const toTree = getCreateTransferToTree();
            const fcId = toFcSelect.value ? parseInt(toFcSelect.value) : null;
            if (toTree) {
                if (!fcId) {
                    toTree.clearSelection();
                    toTree.disable();
                } else {
                    toTree.enable();
                }
            }
        });
        toFcSelect.dataset.listenerAttached = 'true';
    }
}

// ============================================================================
// Edit Modal Category Tree
// ============================================================================

/**
 * Initialize ChoicesCategoryTree for the Edit Fact modal (#edit-article).
 * Called on each modal open; destroys any previous instance first.
 */
export function initEditCategoryTree(articleType: string, selectedId: number | null): void {
    const ChoicesCategoryTree = (window as any).BudgetShared?.ChoicesCategoryTree;
    if (!ChoicesCategoryTree) return;
    const articleSelect = document.querySelector('#edit-article');
    if (!articleSelect) return;

    const prev = getEditCategoryTreeSelect();
    if (prev) { try { prev.destroy(); } catch (_) {} setEditCategoryTreeSelect(null); }

    const instance = new ChoicesCategoryTree('#edit-article', {
        type: articleType,
        showLeafOnly: true,
        mode: 'edit',
        selectedId: selectedId,
        onCategoryChange: () => {}
    });
    setEditCategoryTreeSelect(instance);
    setupMobileModalPositioning(instance, 'edit-modal');
}

/**
 * Destroy the Edit Fact modal category tree instance.
 * Called on modal close to prevent double-init errors.
 */
export function destroyEditCategoryTree(): void {
    const inst = getEditCategoryTreeSelect();
    if (inst) { try { inst.destroy(); } catch (_) {} setEditCategoryTreeSelect(null); }
}

/**
 * Destroy all category tree instances (called on modal close if needed).
 */
export function destroyCategoryTrees(): void {
    const transaction = getCreateCategoryTreeSelect();
    if (transaction) {
        try { transaction.destroy(); } catch (_) {}
        setCreateCategoryTreeSelect(null);
    }

    const from = getCreateTransferFromTree();
    if (from) {
        try { from.destroy(); } catch (_) {}
        setCreateTransferFromTree(null);
    }

    const to = getCreateTransferToTree();
    if (to) {
        try { to.destroy(); } catch (_) {}
        setCreateTransferToTree(null);
    }
}
