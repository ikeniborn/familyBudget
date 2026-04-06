/**
 * Transfer FC Exclusion Utility
 * Prevents selecting the same financial center for FROM and TO in transfer forms
 *
 * @module transferFCExclusion
 */

declare const debugLog: (...args: any[]) => void;

interface TransferFCExclusionOptions {
  fromSelect: HTMLSelectElement;
  toSelect: HTMLSelectElement;
  /** Called when TO value is programmatically cleared due to FROM change */
  onToClear: () => void;
}

/** WeakMap to store AbortController per fromSelect element for listener cleanup */
const exclusionControllers = new WeakMap<HTMLSelectElement, AbortController>();

/**
 * Create a standard onToClear callback for transfer modals.
 * Clears selection and disables the TO category tree, then reloads hints.
 */
export function createToClearCallback(
  getToTree: () => { clearSelection(): void; disable(): void } | null | undefined,
  loadHints: (direction: 'from' | 'to') => void
): () => void {
  return () => {
    const toTree = getToTree();
    if (toTree) {
      toTree.clearSelection();
      toTree.disable();
    }
    loadHints('to');
  };
}

/**
 * Setup mutual exclusion between FROM and TO financial center selects.
 *
 * - FROM always shows all accounts (source of truth for the full list)
 * - TO excludes whichever account is currently selected in FROM
 * - When FROM changes to a value that matches current TO, TO is reset and onToClear fires
 *
 * Safe to call multiple times — uses dataset.exclusionAttached guard.
 */
export function setupTransferFCExclusion({ fromSelect, toSelect, onToClear }: TransferFCExclusionOptions): void {
  if (fromSelect.dataset.exclusionAttached) return;

  const controller = new AbortController();
  exclusionControllers.set(fromSelect, controller);

  fromSelect.addEventListener('change', () => {
    const fromValue = fromSelect.value;
    const currentToValue = toSelect.value;

    // Collect full option list from FROM (always has all accounts)
    if (fromSelect.options.length === 0) return;

    const allOptions: Array<{ value: string; text: string }> = [];
    for (const opt of Array.from(fromSelect.options)) {
      allOptions.push({ value: opt.value, text: opt.text });
    }

    // Rebuild TO options excluding selected FROM
    toSelect.length = 0;

    for (const opt of allOptions) {
      // Keep placeholder (empty value) and all options except the selected FROM
      if (opt.value === '' || opt.value !== fromValue) {
        const newOpt = document.createElement('option');
        newOpt.value = opt.value;
        newOpt.text = opt.text;
        toSelect.add(newOpt);
      }
    }

    // Try to restore previous TO selection
    if (currentToValue && currentToValue !== fromValue) {
      toSelect.value = currentToValue;
    } else if (currentToValue && currentToValue === fromValue) {
      // TO had the same value as the new FROM — reset it
      toSelect.value = '';
      try { onToClear(); } catch (e) { debugLog('[TransferFCExclusion] onToClear error:', e); }
      debugLog('[TransferFCExclusion] TO cleared — matched new FROM value');
    }
  }, { signal: controller.signal });

  fromSelect.dataset.exclusionAttached = 'true';
  debugLog('[TransferFCExclusion] Listener attached');
}

/**
 * Remove the exclusion listener and clear the guard flag on modal close.
 * Call this when destroying transfer trees so the next open starts fresh.
 */
export function cleanupExclusionFlag(fromSelect: HTMLSelectElement | null): void {
  if (!fromSelect) return;

  const controller = exclusionControllers.get(fromSelect);
  if (controller) {
    controller.abort();
    exclusionControllers.delete(fromSelect);
    debugLog('[TransferFCExclusion] Listener removed');
  }

  delete fromSelect.dataset.exclusionAttached;
}
