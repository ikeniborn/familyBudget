/**
 * Transfer Module - Window Exports (Backward Compatibility)
 *
 * Exports to window for HTML templates using reactive getters.
 * DO NOT export: setTransferRecordType, saveTransfer, createTransfer
 * (these are overridden by HTML templates)
 */

import { getState } from '../core/TransferState';
import { initTransferModal } from '../core/stateManager';
import { openModal } from '../ui/modalManager';

/**
 * Export to window for HTML templates
 */
if (typeof window !== 'undefined') {
  // Reactive getters for widget instances
  Object.defineProperty(window, 'transferDateWidget', {
    get: () => getState().dateWidget,
    enumerable: true,
    configurable: false
  });

  Object.defineProperty(window, 'fromCategoryTree', {
    get: () => getState().fromCategoryTree,
    enumerable: true,
    configurable: false
  });

  Object.defineProperty(window, 'toCategoryTree', {
    get: () => getState().toCategoryTree,
    enumerable: true,
    configurable: false
  });

  Object.defineProperty(window, 'allCostCenters', {
    get: () => getState().costCenters,
    enumerable: true,
    configurable: false
  });

  // Functions
  (window as any).initTransferModal = initTransferModal;
  (window as any).openTransferModal = openModal;

  // DO NOT export: setTransferRecordType, saveTransfer, createTransfer
  // These are overridden by HTML templates (index.html lines 278-326)
}
