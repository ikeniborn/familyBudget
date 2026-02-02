/**
 * CSV Importer - Preview Table Rendering
 *
 * Renders preview data table with filters, pagination, and validation status.
 *
 * Phase 3: ES Modules Migration (Step 6)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 989-1235
 */

import {
  getGlobalVarName,
  getValidationResult,
  getColumnMapping,
  getAllPreviewRows,
  getPreviewPagination,
  getPreviewFilters,
  updatePreviewPagination,
  updatePreviewFilters
} from '../core/stateManager';
import { escapeHtml, pluralize } from '../utils/formatting';
import { getFieldLabel, getRowValidationClass, getStatusBadge } from '../utils/statusHelpers';
import type { ValidationRow } from '../core/ImportState';

// ============================================================================
// Type Declarations
// ============================================================================

interface FilteredPaginatedResult {
  filteredRows: ValidationRow[];
  totalFiltered: number;
  startIndex: number;
  endIndex: number;
  totalPages: number;
}

// ============================================================================
// Filter Helpers
// ============================================================================

/**
 * Get unique values for filter dropdowns from preview rows.
 *
 * @param field - Field name (store, product_group, product_name)
 * @returns Sorted unique values
 */
export function getUniqueFilterValues(field: string): string[] {
  const values = new Set<string>();
  const allRows = getAllPreviewRows();

  for (const row of allRows) {
    const value = row.data?.[field];
    if (value && value.trim()) {
      values.add(value.trim());
    }
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru'));
}

/**
 * Apply filters and pagination to preview rows.
 *
 * @returns Filtered and paginated rows with metadata
 */
export function getFilteredPaginatedRows(): FilteredPaginatedResult {
  const allRows = getAllPreviewRows();
  const filters = getPreviewFilters();
  const pagination = getPreviewPagination();

  // Apply filters
  const filteredRows = allRows.filter(row => {
    // Store filter (exact match from dropdown)
    if (filters.store) {
      const storeValue = row.data?.store || '';
      if (storeValue !== filters.store) {
        return false;
      }
    }

    // Group filter (exact match from dropdown)
    if (filters.group) {
      const groupValue = row.data?.product_group || '';
      if (groupValue !== filters.group) {
        return false;
      }
    }

    // Product filter (substring search, case-insensitive)
    if (filters.product) {
      const productValue = (row.data?.product_name || '').toLowerCase();
      const searchTerm = filters.product.toLowerCase();
      if (!productValue.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });

  const totalFiltered = filteredRows.length;

  // Apply pagination
  const startIndex = (pagination.currentPage - 1) * pagination.rowsPerPage;
  const endIndex = Math.min(startIndex + pagination.rowsPerPage, totalFiltered);
  const paginatedRows = filteredRows.slice(startIndex, endIndex);

  return {
    filteredRows: paginatedRows,
    totalFiltered,
    startIndex,
    endIndex,
    totalPages: Math.ceil(totalFiltered / pagination.rowsPerPage),
  };
}

// ============================================================================
// Filter Event Handlers
// ============================================================================

/**
 * Handle filter change.
 *
 * @param filterType - Filter type (store, group, product)
 * @param value - Filter value
 */
export function handleFilterChange(filterType: 'store' | 'group' | 'product', value: string): void {
  updatePreviewFilters({ [filterType]: value });

  // Reset to first page when filter changes
  updatePreviewPagination({ currentPage: 1 });

  // Re-render only the table part
  updatePreviewTable();
}

/**
 * Handle rows per page change.
 *
 * @param value - New rows per page value
 */
export function handleRowsPerPageChange(value: string): void {
  const rowsPerPage = parseInt(value, 10);
  updatePreviewPagination({ rowsPerPage, currentPage: 1 });
  updatePreviewTable();
}

/**
 * Handle page change.
 *
 * @param page - New page number
 */
export function handlePageChange(page: number): void {
  const { totalPages } = getFilteredPaginatedRows();
  if (page >= 1 && page <= totalPages) {
    updatePreviewPagination({ currentPage: page });
    updatePreviewTable();
  }
}

/**
 * Clear all filters.
 */
export function clearFilters(): void {
  updatePreviewFilters({ store: '', group: '', product: '' });
  updatePreviewPagination({ currentPage: 1 });
  updatePreviewTable();

  // Reset filter inputs
  const storeFilter = document.getElementById('preview-filter-store') as HTMLSelectElement | null;
  const groupFilter = document.getElementById('preview-filter-group') as HTMLSelectElement | null;
  const productFilter = document.getElementById('preview-filter-product') as HTMLInputElement | null;
  if (storeFilter) storeFilter.value = '';
  if (groupFilter) groupFilter.value = '';
  if (productFilter) productFilter.value = '';
}

// ============================================================================
// Table Rendering
// ============================================================================

/**
 * Update only the preview table (for filter/pagination changes).
 */
export function updatePreviewTable(): void {
  const tableContainer = document.getElementById('preview-table-container');
  if (!tableContainer) return;

  tableContainer.innerHTML = renderPreviewTableHTML();
}

/**
 * Render the preview table HTML with filters and pagination.
 *
 * @returns HTML string for the preview table section
 */
export function renderPreviewTableHTML(): string {
  const varName = getGlobalVarName();
  const result = getValidationResult();
  const filters = getPreviewFilters();
  const pagination = getPreviewPagination();

  if (!result) return '';

  // Get filter options
  const storeOptions = getUniqueFilterValues('store');
  const groupOptions = getUniqueFilterValues('product_group');

  // Get filtered/paginated rows
  const { filteredRows, totalFiltered, startIndex, endIndex, totalPages } = getFilteredPaginatedRows();
  const currentPage = pagination.currentPage;
  const rowsPerPage = pagination.rowsPerPage;

  // Build header cells
  const columnMapping = getColumnMapping();
  const mappedFields = Object.entries(columnMapping)
    .filter(([_, field]) => field)
    .map(([csvCol, field]) => ({ csvCol, field }));

  const headerCells = mappedFields.map(({ csvCol, field }) => {
    const fieldLabel = getFieldLabel(field);
    return `<th title="CSV: ${escapeHtml(csvCol)}">${fieldLabel}</th>`;
  }).join('');

  // Build table rows
  const tableRows = filteredRows.map(row => {
    const rowClass = getRowValidationClass(row.validation_status ?? "");
    const statusBadge = getStatusBadge(row.validation_status ?? "");

    // Build data cells
    const dataCells = mappedFields.map(({ field }) => {
      const value = row.data?.[field] || '';
      const hasError = row.errors?.some((e: any) => e.field === field);
      const hasWarning = row.warnings?.some((w: any) => w.field === field);
      const cellClass = hasError ? 'bg-error/20 text-error' : (hasWarning ? 'bg-warning/20 text-warning' : '');

      return `<td class="${cellClass}">${escapeHtml(value)}</td>`;
    }).join('');

    // Build error/warning tooltip
    const issues = [...(row.errors || []), ...(row.warnings || [])];
    const issueTooltip = issues.length > 0
      ? `title="${issues.map((i: any) => escapeHtml(i.message)).join('; ')}"`
      : '';

    return `
      <tr class="${rowClass}" ${issueTooltip}>
        <td class="text-center sticky left-0 bg-base-100 z-10">${row.rowIndex + 1}</td>
        <td class="text-center">${statusBadge}</td>
        ${dataCells}
      </tr>
    `;
  }).join('');

  // Build rows per page selector
  const rowsPerPageOptions = pagination.rowsPerPageOptions.map(opt =>
    `<option value="${opt}" ${opt === rowsPerPage ? 'selected' : ''}>${opt}</option>`
  ).join('');

  // Build pagination buttons
  let paginationHTML = '';
  if (totalPages > 1) {
    const pageButtons = [];

    // Previous button
    pageButtons.push(`
      <button class="join-item btn btn-sm ${currentPage === 1 ? 'btn-disabled' : ''}"
              onclick="window.${varName}.handlePageChange(${currentPage - 1})"
              ${currentPage === 1 ? 'disabled' : ''}>«</button>
    `);

    // Page numbers with ellipsis
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      pageButtons.push(`
        <button class="join-item btn btn-sm" onclick="window.${varName}.handlePageChange(1)">1</button>
      `);
      if (startPage > 2) {
        pageButtons.push(`<span class="join-item btn btn-sm btn-disabled">...</span>`);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageButtons.push(`
        <button class="join-item btn btn-sm ${i === currentPage ? 'btn-active' : ''}"
                onclick="window.${varName}.handlePageChange(${i})">${i}</button>
      `);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageButtons.push(`<span class="join-item btn btn-sm btn-disabled">...</span>`);
      }
      pageButtons.push(`
        <button class="join-item btn btn-sm" onclick="window.${varName}.handlePageChange(${totalPages})">${totalPages}</button>
      `);
    }

    // Next button
    pageButtons.push(`
      <button class="join-item btn btn-sm ${currentPage === totalPages ? 'btn-disabled' : ''}"
              onclick="window.${varName}.handlePageChange(${currentPage + 1})"
              ${currentPage === totalPages ? 'disabled' : ''}>»</button>
    `);

    paginationHTML = `
      <div class="flex justify-center mt-4">
        <div class="join">${pageButtons.join('')}</div>
      </div>
    `;
  }

  // Check if any filters are active
  const hasActiveFilters = filters.store || filters.group || filters.product;

  return `
    <h4 class="font-bold mb-2">Предпросмотр данных (${result.totalRows} ${pluralize(result.totalRows, 'строка', 'строки', 'строк')}):</h4>

    <!-- Filters -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3 p-3 bg-base-200 rounded-lg">
      <!-- Store filter -->
      <div class="form-control">
        <label class="label py-0.5">
          <span class="label-text text-xs">🏪 Магазин</span>
        </label>
        <select id="preview-filter-store"
                class="select select-bordered select-sm min-h-[3rem]"
                onchange="window.${varName}.handleFilterChange('store', this.value)">
          <option value="">Все магазины</option>
          ${storeOptions.map(opt => `
            <option value="${escapeHtml(opt)}" ${filters.store === opt ? 'selected' : ''}>
              ${escapeHtml(opt)}
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Group filter -->
      <div class="form-control">
        <label class="label py-0.5">
          <span class="label-text text-xs">📦 Группа</span>
        </label>
        <select id="preview-filter-group"
                class="select select-bordered select-sm min-h-[3rem]"
                onchange="window.${varName}.handleFilterChange('group', this.value)">
          <option value="">Все группы</option>
          ${groupOptions.map(opt => `
            <option value="${escapeHtml(opt)}" ${filters.group === opt ? 'selected' : ''}>
              ${escapeHtml(opt)}
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Product filter (substring search) -->
      <div class="form-control">
        <label class="label py-0.5">
          <span class="label-text text-xs">🛒 Товар</span>
        </label>
        <input type="text"
               id="preview-filter-product"
               class="input input-bordered input-sm min-h-[3rem]"
               placeholder="Поиск по названию..."
               value="${escapeHtml(filters.product)}"
               oninput="window.${varName}.handleFilterChange('product', this.value)">
      </div>

      <!-- Rows per page selector -->
      <div class="form-control">
        <label class="label py-0.5">
          <span class="label-text text-xs">📋 Строк на странице</span>
        </label>
        <select id="preview-rows-per-page"
                class="select select-bordered select-sm min-h-[3rem]"
                onchange="window.${varName}.handleRowsPerPageChange(this.value)">
          ${rowsPerPageOptions}
        </select>
      </div>
    </div>

    <!-- Filter status and clear button -->
    ${hasActiveFilters || totalFiltered !== result.totalRows ? `
    <div class="flex items-center justify-between mb-2 text-sm">
      <span class="text-base-content/70">
        Показано ${totalFiltered} из ${result.totalRows} строк
        ${hasActiveFilters ? ' (фильтр применён)' : ''}
      </span>
      ${hasActiveFilters ? `
      <button class="btn btn-xs btn-ghost" onclick="window.${varName}.clearFilters()">
        ✕ Сбросить фильтры
      </button>
      ` : ''}
    </div>
    ` : ''}

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="table table-sm table-zebra">
        <thead>
          <tr>
            <th class="text-center sticky left-0 bg-base-200 z-10">№</th>
            <th class="text-center">Статус</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${tableRows.length > 0 ? tableRows : `
            <tr>
              <td colspan="${mappedFields.length + 2}" class="text-center py-4 text-base-content/50">
                ${hasActiveFilters ? 'Нет записей, соответствующих фильтру' : 'Нет данных для отображения'}
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    <!-- Pagination info and controls -->
    ${totalFiltered > 0 ? `
    <div class="flex flex-col sm:flex-row items-center justify-between mt-3 gap-2">
      <span class="text-sm text-base-content/70">
        Показано ${startIndex + 1}–${endIndex} из ${totalFiltered}
      </span>
      ${paginationHTML}
    </div>
    ` : ''}
  `;
}
