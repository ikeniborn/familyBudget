/**
 * Pending Records Renderer
 *
 * Handles HTML generation for pending records table and mobile list.
 * Includes Web Worker integration for performance on large datasets.
 */

import type {
  PendingRecord,
  PendingRecordsRenderResult,
} from '../../types/dashboard.d';
import type { WorkerWrapper } from '../../types/globals.d';



declare const debugLog: (...args: any[]) => void;
// ============================================================================
// Constants
// ============================================================================

/** Threshold for switching to Web Worker rendering */
const WORKER_THRESHOLD = 10;

// ============================================================================
// Worker Management
// ============================================================================

let _workerWrapper: WorkerWrapper | null = null;

/**
 * Initialize Web Worker for pending records HTML generation
 * Lazy initialization - only creates worker when needed
 */
function initializeWorker(): WorkerWrapper | null {
  if (_workerWrapper) return _workerWrapper;

  try {
    // Check if WorkerWrapper is available
    if (typeof window.WorkerWrapper === 'undefined') {
      if (window.DEBUG_MODE) {
        console.warn('[PendingRecords] WorkerWrapper not available, using sync fallback');
      }
      return null;
    }

    // Check feature flag
    const isEnabled = window.FEATURE_FLAGS?.ENABLE_WEB_WORKERS !== false;
    if (!isEnabled) {
      debugLog('[PendingRecords] Web Workers disabled via feature flag');
      return null;
    }

    // Create worker wrapper
    _workerWrapper = new window.WorkerWrapper('/static/js/workers/pendingRecordsWorker.min.js', {
      idleTimeout: 10000,  // 10s (aggressive termination)
      debugMode: window.DEBUG_MODE || false,
    });

    debugLog('[PendingRecords] Worker initialized successfully');

    return _workerWrapper;

  } catch (error) {
    console.warn('[PendingRecords] Worker initialization failed:', error);
    _workerWrapper = null;
    return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format short date (dd.mm from yyyy-mm-dd)
 */
export function formatShortDate(dateStr: string): string {
  if (!dateStr || dateStr === '—') return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}`;
  }
  return dateStr;
}

/**
 * Format amount with +/- sign (without decimals and currency)
 */
export function formatAmount(amount: number | string | undefined, articleType: string): string {
  if (!amount) return '—';
  const value = Math.floor(parseFloat(String(amount)));
  const formatted = value.toLocaleString('ru-RU').replace(/\s/g, ' ');
  if (articleType === 'expense' || articleType === 'debit') {
    return `-${formatted}`;
  } else if (articleType === 'income' || articleType === 'credit') {
    return `+${formatted}`;
  }
  return formatted;
}

/**
 * Get status badge HTML for desktop table
 */
export function getStatusBadge(item: PendingRecord): string {
  if (item.entity === 'transfer') {
    return item.data.record_type === 'plan'
      ? '<span class="badge badge-info badge-sm">План</span>'
      : '<span class="badge badge-success badge-sm">Факт</span>';
  }
  return item.data.record_type === 'plan'
    ? '<span class="badge badge-info badge-sm">План</span>'
    : '<span class="badge badge-success badge-sm">Факт</span>';
}

/**
 * Get status badge HTML (mobile)
 * Returns icon indicators for sync status (failed/retry/pending)
 */
export function getStatusBadgeMobile(item: PendingRecord): string {
  debugLog(`[PENDING_MOBILE] Rendering status badge for item ${item.id}, status=${item.status}, retryCount=${item.retryCount || 0}`);

  if (item.status === 'failed') {
    return '<span class="text-error text-xs" title="Ошибка синхронизации">⚠️</span>';
  }
  if (item.retryCount > 0) {
    return '<span class="text-warning text-xs" title="Повторная попытка">🔄</span>';
  }
  // For pending items, no icon (clean look)
  return '';
}

/**
 * Get record type badge HTML (matching recent-transactions-card style)
 */
export function getRecordTypeLabel(entity: string): string {
  const badges: Record<string, string> = {
    'fact': '<span class="badge badge-success badge-sm">Факт</span>',
    'plan': '<span class="badge badge-info badge-sm">План</span>',
    'recurring': '<span class="badge badge-info badge-sm">План</span>',
    'transfer': '<span class="badge badge-neutral badge-sm">Перевод</span>',
  };
  return badges[entity] || `<span class="badge badge-ghost badge-sm">${entity || '—'}</span>`;
}

/**
 * Get record type badge HTML (xs size for mobile)
 */
export function getRecordTypeLabelXs(entity: string): string {
  const badges: Record<string, string> = {
    'fact': '<span class="badge badge-success badge-xs">Факт</span>',
    'plan': '<span class="badge badge-info badge-xs">План</span>',
    'recurring': '<span class="badge badge-info badge-xs">План</span>',
    'transfer': '<span class="badge badge-neutral badge-xs">Перевод</span>',
  };
  return badges[entity] || `<span class="badge badge-ghost badge-xs">${entity || '—'}</span>`;
}

/**
 * Get color class for amount based on fact type
 */
function getAmountColorClass(factType: string): string {
  switch (factType) {
    case 'expense':
      return 'text-error';
    case 'income':
      return 'text-success';
    case 'debit':
      return 'text-info';
    case 'credit':
      return 'text-warning';
    default:
      return '';
  }
}

// ============================================================================
// HTML Generation
// ============================================================================

/**
 * Generate HTML for transfer item (two rows - debit and credit)
 */
function generateTransferHTML(
  item: PendingRecord,
  statusBadge: string,
  statusBadgeMobile: string,
  date: string,
  shortDate: string,
  description: string,
  notificationCell: string
): { tableRows: string[]; mobileItems: string[] } {
  const tableRows: string[] = [];
  const mobileItems: string[] = [];

  const isPlanTransfer = item.data.record_type === 'plan';
  const typeLabel = isPlanTransfer
    ? '<span class="badge badge-info badge-sm">План</span>'
    : '<span class="badge badge-success badge-sm">Факт</span>';
  const typeLabelXs = isPlanTransfer
    ? '<span class="badge badge-info badge-xs">План</span>'
    : '<span class="badge badge-success badge-xs">Факт</span>';

  // Debit row (FROM side)
  const fromCfo = item.data.from_financial_center_name || `ID: ${item.data.from_financial_center_id || '—'}`;
  const fromCategory = item.data.from_article_name || `ID: ${item.data.from_article_id || '—'}`;
  const debitAmount = formatAmount(item.data.amount, 'debit');

  tableRows.push(`
    <tr>
      <td class="text-center">
        <button class="btn btn-xs btn-primary gap-1" onclick="event.stopPropagation(); handleTransferEditClick(${item.id}, 'from')" title="Редактировать (перевод будет разделён)">✏️</button>
      </td>
      <td>${typeLabel}</td>
      <td>${date}</td>
      <td class="max-w-[100px] truncate" title="${fromCfo}">${fromCfo}</td>
      <td class="max-w-[100px] truncate" title="${fromCategory}">${fromCategory}</td>
      <td class="text-info font-medium">${debitAmount}</td>
      <td class="max-w-[150px] truncate" title="${description}">${description}</td>
      <td class="text-center opacity-30">—</td>
      ${notificationCell}
      <td>${statusBadge}</td>
      <td class="text-center">
        <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" onclick="event.stopPropagation(); deletePendingRecord(${item.id})" title="Удалить">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  `);

  const debitLine2Parts = [shortDate, fromCfo, description].filter(p => p && p !== '—');
  mobileItems.push(`
    <div class="py-2 cursor-pointer hover:bg-base-200 transition-colors rounded-lg px-2 -mx-2"
         onclick="handleTransferEditClick(${item.id}, 'from')">
      <div class="flex items-center gap-2">
        ${typeLabelXs}
        <span class="flex-1 font-medium truncate">${fromCategory}</span>
        <span class="text-info font-bold whitespace-nowrap">${debitAmount}</span>
        ${statusBadgeMobile}
      </div>
      <div class="text-xs text-base-content/60 mt-1 truncate">
        ${debitLine2Parts.join(' • ')}
      </div>
    </div>
  `);

  // Credit row (TO side)
  const toCfo = item.data.to_financial_center_name || `ID: ${item.data.to_financial_center_id || '—'}`;
  const toCategory = item.data.to_article_name || `ID: ${item.data.to_article_id || '—'}`;
  const creditAmount = formatAmount(item.data.amount, 'credit');

  tableRows.push(`
    <tr>
      <td class="text-center">
        <button class="btn btn-xs btn-primary gap-1" onclick="event.stopPropagation(); handleTransferEditClick(${item.id}, 'to')" title="Редактировать (перевод будет разделён)">✏️</button>
      </td>
      <td>${typeLabel}</td>
      <td>${date}</td>
      <td class="max-w-[100px] truncate" title="${toCfo}">${toCfo}</td>
      <td class="max-w-[100px] truncate" title="${toCategory}">${toCategory}</td>
      <td class="text-warning font-medium">${creditAmount}</td>
      <td class="max-w-[150px] truncate" title="${description}">${description}</td>
      <td class="text-center opacity-30">—</td>
      ${notificationCell}
      <td>${statusBadge}</td>
      <td class="text-center">
        <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" onclick="event.stopPropagation(); deletePendingRecord(${item.id})" title="Удалить">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  `);

  const creditLine2Parts = [shortDate, toCfo, description].filter(p => p && p !== '—');
  mobileItems.push(`
    <div class="py-2 cursor-pointer hover:bg-base-200 transition-colors rounded-lg px-2 -mx-2"
         onclick="handleTransferEditClick(${item.id}, 'to')">
      <div class="flex items-center gap-2">
        ${typeLabelXs}
        <span class="flex-1 font-medium truncate">${toCategory}</span>
        <span class="text-warning font-bold whitespace-nowrap">${creditAmount}</span>
        ${statusBadgeMobile}
      </div>
      <div class="text-xs text-base-content/60 mt-1 truncate">
        ${creditLine2Parts.join(' • ')}
      </div>
    </div>
  `);

  return { tableRows, mobileItems };
}

/**
 * Generate HTML for fact/plan item (single row)
 */
function generateFactPlanHTML(
  item: PendingRecord,
  statusBadge: string,
  statusBadgeMobile: string,
  date: string,
  shortDate: string,
  description: string,
  notificationCell: string
): { tableRow: string; mobileItem: string } {
  const typeLabel = getRecordTypeLabel(item.entity);
  const typeLabelXs = getRecordTypeLabelXs(item.entity);
  const cfoName = item.data.financial_center_name ||
    (item.data.financial_center_id ? `ID: ${item.data.financial_center_id}` : '—');
  const categoryName = item.data.article_name ||
    (item.data.article_id ? `ID: ${item.data.article_id}` : '—');

  const factType = item.data.fact_type || item.data.article_type || '';
  const colorClass = getAmountColorClass(factType);

  const formattedAmount = formatAmount(item.data.amount, factType);
  const editButton = `<button class="btn btn-xs btn-primary gap-1" onclick="event.stopPropagation(); openEditPendingRecord(${item.id}, '${item.entity}')" title="Редактировать">✏️</button>`;
  const deleteButton = `
    <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" onclick="event.stopPropagation(); deletePendingRecord(${item.id})" title="Удалить">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  `;

  const isRecurring = item.entity === 'recurring';
  const recurringCell = isRecurring
    ? '<td class="text-center">🔄</td>'
    : '<td class="text-center opacity-30">—</td>';

  const tableRow = `
    <tr>
      <td class="text-center">${editButton}</td>
      <td>${typeLabel}</td>
      <td>${date}</td>
      <td class="max-w-[100px] truncate" title="${cfoName}">${cfoName}</td>
      <td class="max-w-[100px] truncate" title="${categoryName}">${categoryName}</td>
      <td class="${colorClass} font-medium">${formattedAmount}</td>
      <td class="max-w-[150px] truncate" title="${description}">${description}</td>
      ${recurringCell}
      ${notificationCell}
      <td>${statusBadge}</td>
      <td class="text-center">${deleteButton}</td>
    </tr>
  `;

  const line2Parts = [shortDate, cfoName, description].filter(p => p && p !== '—');
  const mobileItem = `
    <div class="py-2 cursor-pointer hover:bg-base-200 transition-colors rounded-lg px-2 -mx-2"
         onclick="openEditPendingRecord(${item.id}, '${item.entity}')">
      <div class="flex items-center gap-2">
        ${typeLabelXs}
        <span class="flex-1 font-medium truncate">${categoryName}</span>
        <span class="${colorClass} font-bold whitespace-nowrap">${formattedAmount}</span>
        ${statusBadgeMobile}
      </div>
      <div class="text-xs text-base-content/60 mt-1 truncate">
        ${line2Parts.join(' • ')}
      </div>
    </div>
  `;

  return { tableRow, mobileItem };
}

/**
 * Generate HTML synchronously (fallback)
 */
export function generateHTMLSync(
  items: PendingRecord[],
  _maxRetries: number = 5
): PendingRecordsRenderResult {
  const startTime = performance.now();

  const tableRows: string[] = [];
  const mobileItems: string[] = [];
  let totalRecords = 0;

  // Bell icon SVG
  const bellIcon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>';

  items.forEach(item => {
    const date = item.data.fact_date || item.data.plan_date || item.data.transfer_date || '—';
    const shortDate = formatShortDate(date);
    const statusBadge = getStatusBadge(item);
    const statusBadgeMobile = getStatusBadgeMobile(item);
    const description = item.data.description || '—';

    // Notification indicator
    const hasNotification = item.data.notification_enabled === true;
    const notificationCell = hasNotification
      ? `<td class="text-center text-success" title="Уведомление включено">${bellIcon}</td>`
      : '<td class="text-center opacity-30">—</td>';

    if (item.entity === 'transfer') {
      const result = generateTransferHTML(
        item, statusBadge, statusBadgeMobile,
        date, shortDate, description, notificationCell
      );
      tableRows.push(...result.tableRows);
      mobileItems.push(...result.mobileItems);
      totalRecords += 2;
    } else {
      const result = generateFactPlanHTML(
        item, statusBadge, statusBadgeMobile,
        date, shortDate, description, notificationCell
      );
      tableRows.push(result.tableRow);
      mobileItems.push(result.mobileItem);
      totalRecords += 1;
    }
  });

  const duration = performance.now() - startTime;
  if (window.DEBUG_MODE) {
    debugLog(`[PendingRecords] Sync rendering: ${items.length} items in ${duration.toFixed(2)}ms`);
  }

  return {
    desktopHTML: tableRows.join(''),
    mobileHTML: mobileItems.join(''),
    itemCount: totalRecords,
  };
}

/**
 * Generate HTML using worker (async)
 * Falls back to sync if worker unavailable
 */
export async function generateHTMLAsync(
  items: PendingRecord[],
  maxRetries: number = 5
): Promise<PendingRecordsRenderResult> {
  const startTime = performance.now();

  try {
    const wrapper = initializeWorker();
    if (!wrapper) {
      // Worker not available, use sync fallback
      return generateHTMLSync(items, maxRetries);
    }

    // Execute in worker
    const result = await wrapper.execute({
      action: 'generatePendingRecordsHTML',
      data: { items, maxRetries },
    });

    const duration = performance.now() - startTime;
    if (window.DEBUG_MODE) {
      debugLog(`[PendingRecords] Worker rendering: ${items.length} items in ${duration.toFixed(2)}ms`);
    }

    return result as PendingRecordsRenderResult;

  } catch (error) {
    console.warn('[PendingRecords] Worker execution failed, using sync fallback:', error);
    return generateHTMLSync(items, maxRetries);
  }
}

/**
 * Check if items count exceeds worker threshold
 */
export function shouldUseWorker(itemCount: number): boolean {
  return itemCount > WORKER_THRESHOLD;
}

/**
 * Get worker threshold value
 */
export function getWorkerThreshold(): number {
  return WORKER_THRESHOLD;
}
