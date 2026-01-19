/**
 * Pending Records Feature Module
 *
 * Exports all pending records functionality for the dashboard.
 */

// State management
export {
  isLoadInProgress,
  acquireLoadLock,
  releaseLoadLock,
  waitForExistingLock,
  getNextCallId,
  getCurrentCallCount,
} from './pendingState';

// Renderer
export {
  formatShortDate,
  formatAmount,
  getStatusBadge,
  getStatusBadgeMobile,
  getRecordTypeLabel,
  getRecordTypeLabelXs,
  generateHTMLSync,
  generateHTMLAsync,
  shouldUseWorker,
  getWorkerThreshold,
} from './pendingRenderer';

// Sync operations
export {
  loadPendingRecords,
  retryFailedItems,
  handleSyncResults,
  deletePendingRecord,
  deleteFailedRecords,
  updatePendingCount,
  syncPendingRecords,
  notifyPendingRecords,
} from './syncOperations';

// Transfer split
export {
  splitTransferToFacts,
  handleTransferEditClick,
} from './transferSplit';
