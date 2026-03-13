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
    setCreateTransferToTree
} from '../../core/stateManager';
import { setupMobileModalPositioning } from '../../../utils/mobileModalPositioning';

const TRANSACTION_ARTICLE_SELECTOR = '#modal_fact-tab-transaction select[name="article_id"]';
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

    // Read current type from record_type radio (matches dashboard convention)
    const typeInput = document.querySelector(
        '#modal_fact-tab-transaction input[name="record_type"]:checked'
    ) as HTMLInputElement | null;
    const currentType = typeInput?.value || 'expense';

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

    // PWA: reposition modal to top when dropdown opens to keep list visible
    setupMobileModalPositioning(instance, MODAL_FACT_ID);
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
