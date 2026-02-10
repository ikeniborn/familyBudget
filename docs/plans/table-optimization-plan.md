# План оптимизации табличных форм Family Budget v2.0

**Версия:** 2.0 (обновлено с учётом security audit)
**Дата:** 2026-02-10
**Статус:** ✅ Ready for approval (критические проблемы исправлены)

---

## Контекст

### Проблема
На основе исследования `/docs/explore/table-implementations-research.md` и security audit выявлены критические проблемы:

1. **🚨 SECURITY: XSS уязвимость в Plan page**
   - Plan page вставляет user input (article_name, description, account names) БЕЗ HTML escaping
   - Критическая уязвимость требует немедленного исправления

2. **Дублирование кода** (~200 строк):
   - Color mapping logic дублируется 3 раза (Dashboard Jinja2 + Facts 2x + Plans)
   - Text truncation дублируется в Facts и Plans
   - Mobile card rendering почти идентичен в обоих модулях
   - Date formatting имеет 3 разные реализации

3. **Неэффективные паттерны**:
   - Dashboard использует server-side rendering (требует roundtrip для обновления)
   - Facts и Plans имеют inline HTML generation вместо template functions
   - Pagination state управляется по-разному в двух модулях
   - Selection state дублирован (Facts хорошая реализация, Plans inline DOM)

4. **Legacy код**:
   - 3 файла HTMX partials не используются (`facts_table.html`, `fact_row_desktop.html`, `fact_row_mobile.html`)
   - Endpoint `/api/v1/facts/table` не существует в backend

### Цель
Создать унифицированную систему табличных компонентов с:
- **Security-first подход:** XSS защита во всех компонентах
- Shared utilities для formatting/rendering
- Consistent responsive design (Plan page как эталон)
- Reusable table components
- Elimination legacy code

### Эталонная структура
Plan page (`/frontend/web/templates/plan.html` + `/frontend/web/static/js/plan/`) выбрана как reference:
- ✅ Модульная TypeScript архитектура (7 файлов: index, helpers, filters, factsTable, analytics, crud, filterAnalyticsSync)
- ✅ Tab-based modals с DaisyUI
- ✅ 3-level hierarchical filters
- ✅ Responsive dual-view (desktop table + mobile cards)
- ✅ Batch operations с Set-based selection
- ✅ Z-index layering compliance
- ⚠️ **XSS protection отсутствует** (будет исправлено в PHASE 0.5)

---

## 🚨 PHASE 0.5: Security Hotfix - Plan Page XSS [CRITICAL]

**КРИТИЧЕСКАЯ УЯЗВИМОСТЬ:** Plan page вставляет user-generated content БЕЗ HTML escaping!

**Приоритет:** HIGHEST (блокирует всё остальное)
**Время:** 30 минут
**Git branch:** `security/plan-xss-fix-20260210`
**Base branch:** `test`

### Проблема

```typescript
// plan/factsTable.ts lines 353-418 (УЯЗВИМО):
const description = fact.description || '—';    // ← User input, NO escaping!
const financialCenter = fact.financial_center_name || '—';  // ← User input, NO escaping!
const articleName = fact.article_name || '—';   // ← User input, NO escaping!

tableHtml += `
  <td class="max-w-xs truncate" title="${description}">${descriptionTruncated}</td>
  //                                  ^^^^^^^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^^
  //                                  XSS в title!      XSS в content!
  <td>${articleName}</td>  // ← XSS!
`;
```

### Решение

**Файл:** `frontend/web/static/js/plan/factsTable.ts`

**Изменения:**

1. **Import htmlSanitizer (after line 11):**
```typescript
import * as PlanHelpers from './helpers';
import * as PlanFilters from './filters';
import { escapeHtml } from '../facts/utilities/htmlSanitizer';  // ← NEW
```

2. **Escape user input в renderFactsTable() (lines 353-418):**
```typescript
// BEFORE (УЯЗВИМО):
const description = fact.description || '—';
const financialCenter = fact.financial_center_name || '—';
const costCenter = fact.cost_center_name || '—';
const articleName = fact.article_name || '—';

// AFTER (ЗАЩИЩЕНО):
const description = escapeHtml(fact.description || '—');
const descriptionTruncated = truncateText(description, 30);  // Already escaped
const financialCenter = escapeHtml(fact.financial_center_name || '—');
const costCenter = escapeHtml(fact.cost_center_name || '—');
const articleName = escapeHtml(fact.article_name || '—');
const userName = escapeHtml(fact.user_name || '—');
```

3. **Update truncateText() to work with pre-escaped content (lines 283-287):**
```typescript
// BEFORE:
function truncateText(text: string | null, maxLength: number = 30): string {
  if (!text || text === '—') return text || '—';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// AFTER:
/**
 * Truncate text with ellipsis
 * NOTE: Input should be ALREADY escaped via escapeHtml()
 */
function truncateText(text: string | null, maxLength: number = 30): string {
  if (!text || text === '—') return text || '—';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
```

### Git Commit

```bash
git add frontend/web/static/js/plan/factsTable.ts
git commit -m "security: fix XSS vulnerability in plan page table rendering

CRITICAL: Plan page was inserting user-generated content (article names,
descriptions, account names, user names) without HTML escaping, allowing
XSS attacks via malicious input.

Fixed by importing escapeHtml() from htmlSanitizer and applying to all
user input fields before rendering.

Affected fields:
- article_name (category names)
- description (transaction descriptions)
- financial_center_name (account names)
- cost_center_name (cost center names)
- user_name (user display names)

All fields now escaped before insertion into HTML.

Internal reference: CVE-internal-001
Security audit date: 2026-02-10

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Verification

```bash
# Test XSS payload (должен отображаться как текст, не выполняться):
# 1. Добавить план с description: <script>alert('XSS')</script>
# 2. Проверить что в HTML: &lt;script&gt;alert('XSS')&lt;/script&gt;
# 3. Проверить что script НЕ выполняется

# Expected в браузере:
# <td class="max-w-xs truncate" title="&lt;script&gt;alert('XSS')&lt;/script&gt;">&lt;script&gt;alert('XSS')&lt;/script&gt;</td>
```

---

## PHASE 1: Создание Shared Utilities Module (Security-First)

### 1.1. Переместить htmlSanitizer в shared

**Цель:** Сделать XSS защиту доступной для всех модулей.

**Действия:**

1. **Переместить файл:**
```bash
mv frontend/web/static/js/facts/utilities/htmlSanitizer.ts \
   frontend/web/static/js/shared/htmlSanitizer.ts
```

2. **Обновить imports в Facts:**
```typescript
// facts/operations/factsController.ts
// BEFORE:
import { escapeHtml, sanitizeErrorMessage } from '../utilities/htmlSanitizer';

// AFTER:
import { escapeHtml, sanitizeErrorMessage } from '../../shared/htmlSanitizer';
```

3. **Обновить imports в Plan:**
```typescript
// plan/factsTable.ts
// BEFORE:
import { escapeHtml } from '../facts/utilities/htmlSanitizer';

// AFTER:
import { escapeHtml } from '../shared/htmlSanitizer';
```

---

### 1.2. Создать `frontend/web/static/js/shared/tableUtils.ts`

**Цель:** Централизовать повторяющуюся логику форматирования с встроенной XSS защитой.

**Функции:**

```typescript
/**
 * Shared utilities for table rendering across Facts/Plans/Dashboard
 *
 * SECURITY: All methods handling user input include XSS protection
 */

import { escapeHtml } from './htmlSanitizer';

// Import BudgetShared from global window
declare const BudgetShared: {
  DateFormatter: {
    formatForDisplay: (isoDate: string) => string;
  };
};

export class TableFormatters {
  /**
   * Get color class for article type
   * SAFE: No user input, returns predefined CSS classes
   *
   * Eliminates 3 duplicate implementations (Dashboard, Facts, Plans)
   */
  static getArticleColorClass(articleType: string, variant: 'text' | 'amount' = 'text'): string {
    const textMap: Record<string, string> = {
      expense: 'text-error',
      income: 'text-success',
      debit: 'text-info',
      credit: 'text-warning'
    };
    const amountMap: Record<string, string> = {
      expense: 'amount-expense',
      income: 'amount-income',
      debit: 'amount-debit',
      credit: 'amount-credit'
    };
    const map = variant === 'text' ? textMap : amountMap;
    return map[articleType] || (variant === 'text' ? 'text-base-content' : 'amount-expense');
  }

  /**
   * Format amount with sign and locale
   * SAFE: Numeric input only, no user-generated strings
   *
   * Replaces hardcoded .toFixed(2) in Facts
   *
   * @param amount - Numeric value from database
   * @param type - Article type (expense/income/debit/credit)
   * @returns Formatted amount string (e.g., "+1 500,50" or "-2 300,00")
   */
  static formatAmount(amount: number, type: string): string {
    // Safe: Number.toLocaleString() doesn't produce executable code
    const value = Number(amount).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const sign = (type === 'income' || type === 'credit') ? '+' : '-';
    return `${sign}${value}`;
  }

  /**
   * Truncate text with ellipsis + XSS protection
   * ⚠️ SECURITY: Always escapes HTML to prevent XSS
   *
   * Eliminates duplicate in Facts/Plans
   *
   * @param text - User input text (UNTRUSTED)
   * @param maxLength - Maximum length before truncation
   * @returns HTML-safe truncated text
   *
   * @example
   * ```typescript
   * TableFormatters.truncateText('<script>alert("XSS")</script>', 20)
   * // Returns: "&lt;script&gt;alert(&quot;X..."
   * ```
   */
  static truncateText(text: string | null | undefined, maxLength: number = 30): string {
    if (!text || text === '—') return text || '—';

    const truncated = text.length <= maxLength
      ? text
      : text.substring(0, maxLength) + '...';

    // ✅ XSS protection: Always escape HTML
    return escapeHtml(truncated);
  }

  /**
   * Format date for display (DD.MM.YYYY)
   * SAFE: Uses trusted BudgetShared.DateFormatter
   *
   * @param isoDate - ISO date string (YYYY-MM-DD)
   * @returns Formatted date (DD.MM.YYYY)
   */
  static formatDate(isoDate: string): string {
    // BudgetShared.DateFormatter output is trusted (no user input)
    return BudgetShared.DateFormatter.formatForDisplay(isoDate);
  }

  /**
   * Escape HTML for user-generated content
   * Re-export from htmlSanitizer for convenience
   *
   * @param text - User input to escape
   * @returns HTML-safe string
   */
  static escapeHtml(text: string | null | undefined): string {
    return escapeHtml(text);
  }
}
```

**Файлы для изменения:**
- `frontend/web/static/js/facts/operations/factsController.ts` (lines 635-644, 707-718, 745-749) - заменить на TableFormatters
- `frontend/web/static/js/plan/helpers.ts` (lines 350-358, 366-388) - заменить на TableFormatters
- `frontend/web/templates/partials/recent_transactions.html` - мигрировать Jinja2 filters на TypeScript

---

### 1.3. Создать `frontend/web/static/js/shared/tableRenderer.ts`

**Цель:** Унифицировать рендеринг desktop table + mobile cards с XSS защитой.

**Интерфейсы:**

```typescript
/**
 * Table rendering utilities with XSS protection
 *
 * SECURITY NOTICE:
 * - Column render functions MUST return HTML-safe content
 * - Use TableFormatters methods which include escaping
 * - Mobile card config fields MUST be pre-escaped
 */

export interface BudgetFact {
  id: number;
  fact_date: string;
  article_id: number;
  article_name: string;
  article_type: 'expense' | 'income' | 'debit' | 'credit';
  amount: number;
  financial_center_id?: number;
  financial_center_name?: string;
  cost_center_id?: number;
  cost_center_name?: string;
  description?: string;
  user_name?: string;
  is_offline_sync?: boolean;
  recurring_plan_id?: number;
}

export interface TableColumn {
  key: string;
  header: string;
  /**
   * Render function MUST return HTML-safe content!
   * Use TableFormatters.escapeHtml() for user input.
   */
  render: (fact: BudgetFact) => string;
  headerClass?: string;
  cellClass?: string;
  mobileVisible?: boolean; // Show in mobile card line 2
}

export interface MobileCardConfig {
  badgeText: string;           // Safe: predefined text
  badgeClass: string;           // Safe: CSS class
  categoryName: string;         // ⚠️ MUST be pre-escaped via TableFormatters.truncateText()
  amount: string;               // Safe: formatted number
  amountClass: string;          // Safe: CSS class
  line2Parts: string[];         // ⚠️ MUST be pre-escaped array
  icons?: string[];             // Safe: emoji or HTML entities
  onClick: string;              // Safe: function call with numeric ID
}

export class TableRenderer {
  /**
   * Render desktop table with XSS-safe columns
   *
   * ⚠️ SECURITY: Column render functions MUST escape user input!
   * Use TableFormatters methods which include escaping.
   *
   * @param facts - Array of facts
   * @param columns - Column configuration (render functions must be safe)
   * @returns HTML string for desktop table
   */
  static renderDesktopTable(facts: BudgetFact[], columns: TableColumn[]): string {
    let html = `
      <div class="facts-desktop-table overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead><tr>
    `;

    columns.forEach(col => {
      // Header text is developer-controlled, safe
      html += `<th class="${col.headerClass || ''}">${col.header}</th>`;
    });

    html += `</tr></thead><tbody>`;

    facts.forEach(fact => {
      html += `<tr>`;
      columns.forEach(col => {
        // col.render() MUST return escaped content!
        html += `<td class="${col.cellClass || ''}">${col.render(fact)}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
  }

  /**
   * Render mobile card (Two-Line List pattern)
   *
   * ⚠️ SECURITY: All config fields MUST be pre-escaped!
   * - categoryName: Use TableFormatters.truncateText()
   * - line2Parts: Each part must be escaped
   *
   * Eliminates duplicate in Facts/Plans
   *
   * @param config - Mobile card configuration (pre-escaped fields)
   * @returns HTML string for mobile card
   */
  static renderMobileCard(config: MobileCardConfig): string {
    const iconsHtml = config.icons ? config.icons.join(' ') : '';
    return `
      <div class="transaction-item py-2" onclick="${config.onClick}">
        <div class="flex items-center gap-2">
          <span class="badge ${config.badgeClass} badge-xs">${config.badgeText}</span>
          <span class="flex-1 font-medium truncate">${config.categoryName}</span>
          <!-- ↑ MUST be pre-escaped via TableFormatters.truncateText() -->
          <span class="${config.amountClass} font-bold">${config.amount}</span>
          ${iconsHtml ? `<span class="text-xs">${iconsHtml}</span>` : ''}
        </div>
        <div class="text-xs text-base-content/60 mt-1 truncate">
          ${config.line2Parts.join(' • ')}
          <!-- ↑ MUST be pre-escaped array -->
        </div>
      </div>
    `;
  }

  /**
   * Render empty state (no facts found)
   * SAFE: Developer-controlled strings only
   *
   * @param icon - Emoji icon
   * @param message - Title message
   * @param description - Optional description
   * @returns HTML string for empty state
   */
  static renderEmptyState(icon: string, message: string, description?: string): string {
    return `
      <div class="text-center py-8">
        <div class="text-4xl mb-2">${icon}</div>
        <div class="text-lg font-medium">${message}</div>
        ${description ? `<div class="text-sm text-base-content/60 mt-1">${description}</div>` : ''}
      </div>
    `;
  }
}
```

**Пример БЕЗОПАСНОГО использования:**

```typescript
import { TableRenderer, TableFormatters } from '../shared/tableUtils';

// ✅ ПРАВИЛЬНО:
const factsColumns: TableColumn[] = [
  {
    key: 'category',
    header: '📁 Категория',
    render: (f) => {
      const colorClass = TableFormatters.getArticleColorClass(f.article_type, 'text');
      const name = TableFormatters.truncateText(f.article_name, 30);  // ✅ Escapes inside
      return `<span class="${colorClass}">${name}</span>`;
    }
  },
  {
    key: 'description',
    header: '📝 Описание',
    render: (f) => TableFormatters.truncateText(f.description, 40)  // ✅ Escapes inside
  }
];

// ❌ НЕПРАВИЛЬНО (УЯЗВИМО):
const badColumn: TableColumn = {
  key: 'category',
  render: (f) => `<span>${f.article_name}</span>`  // ❌ NO ESCAPING!
};
```

---

### 1.4. Создать `frontend/web/static/js/shared/paginationManager.ts`

**Цель:** Унифицировать pagination logic между Facts и Plans.

```typescript
export class PaginationManager {
  private currentPage = 0;
  private pageSize = 50;
  private totalRecords = 0;

  constructor(pageSize: number = 50) {
    this.pageSize = pageSize;
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  setCurrentPage(page: number): void {
    const totalPages = this.getTotalPages();
    this.currentPage = Math.max(0, Math.min(page, totalPages - 1));
  }

  nextPage(): void {
    this.setCurrentPage(this.currentPage + 1);
  }

  previousPage(): void {
    this.setCurrentPage(this.currentPage - 1);
  }

  getTotalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize);
  }

  getPageStart(): number {
    return this.currentPage * this.pageSize + 1;
  }

  getPageEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalRecords);
  }

  setTotalRecords(total: number): void {
    this.totalRecords = total;
  }

  /**
   * Update pagination UI controls
   * @param controlsId - Container element ID
   */
  updateUI(controlsId: string): void {
    const container = document.getElementById(controlsId);
    if (!container) return;

    const prevBtn = container.querySelector('[data-action="prev"]') as HTMLButtonElement;
    const nextBtn = container.querySelector('[data-action="next"]') as HTMLButtonElement;
    const pageInfo = container.querySelector('[data-role="page-info"]');

    if (prevBtn) prevBtn.disabled = this.currentPage === 0;
    if (nextBtn) prevBtn.disabled = this.currentPage >= this.getTotalPages() - 1;
    if (pageInfo) {
      pageInfo.textContent = `Страница ${this.currentPage + 1} из ${this.getTotalPages()}`;
    }
  }

  /**
   * Get offset for API calls
   * @returns Offset value for limit/offset pagination
   */
  getOffset(): number {
    return this.currentPage * this.pageSize;
  }
}
```

**Интеграция:**
- Facts: заменить `paginationOperations.ts` на PaginationManager
- Plans: заменить local variables в `factsTable.ts` на PaginationManager

---

### 1.5. Создать `frontend/web/static/js/shared/selectionManager.ts`

**Цель:** Унифицировать checkbox selection logic.

```typescript
export class SelectionManager {
  private selectedIds: Set<number> = new Set();
  private onSelectionChange?: (selectedCount: number) => void;

  constructor(onSelectionChange?: (selectedCount: number) => void) {
    this.onSelectionChange = onSelectionChange;
  }

  toggleSelection(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.notifyChange();
  }

  selectAll(ids: number[]): void {
    ids.forEach(id => this.selectedIds.add(id));
    this.notifyChange();
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.notifyChange();
  }

  getSelectedIds(): number[] {
    return Array.from(this.selectedIds);
  }

  getSelectedCount(): number {
    return this.selectedIds.size;
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  private notifyChange(): void {
    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedIds.size);
    }
  }

  /**
   * Update batch action button UI
   * @param buttonId - Button element ID
   */
  updateBatchButtonUI(buttonId: string): void {
    const button = document.getElementById(buttonId) as HTMLButtonElement;
    if (!button) return;

    const count = this.selectedIds.size;
    button.disabled = count === 0;

    const countBadge = button.querySelector('[data-role="count"]');
    if (countBadge) {
      countBadge.textContent = count > 0 ? `(${count})` : '';
    }
  }
}
```

**Интеграция:**
- Facts: использовать вместо `stateManager.ts` + `selectionOperations.ts`
- Plans: заменить inline DOM manipulation на SelectionManager

---

## 🔀 PHASE 1.5: Git Branch Setup [MANDATORY]

⚠️ **CHECKPOINT:** Выполнить ПЕРЕД approval (PHASE 2)

**CLAUDE.md требует:**
> "YOU MUST execute PHASE 1.5 (branch creation) BEFORE approval (PHASE 2)"

### Действия:

```bash
# 1. Switch to base branch
git checkout test

# 2. Create development branch with timestamp
BRANCH_NAME="dev/table_optimization_$(date +%Y%m%d%H%M%S)"
git checkout -b "$BRANCH_NAME"

# 3. Verify branch
git branch --show-current
# Expected output: dev/table_optimization_20260210123456

# 4. Set upstream (for future push)
git push -u origin "$BRANCH_NAME"
```

**Branch naming convention:**
```
dev/<feature_name>_<YYYYMMDDhhmmss>
```

**Example:**
```
dev/table_optimization_20260210143022
```

### Commit Strategy

**Conventional Commits format с Co-Authored-By:**

```bash
# Phase 0.5: Security hotfix
git commit -m "security: fix XSS in plan page (CVE-internal-001)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Phase 1: Shared utilities
git commit -m "feat: add shared table utilities with XSS protection

- TableFormatters (color, amount, truncate, date)
- TableRenderer (desktop table + mobile cards)
- PaginationManager (unified pagination)
- SelectionManager (checkbox management)
- htmlSanitizer moved to shared

All utilities include XSS protection via escapeHtml()

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Phase 2: Facts refactoring
git commit -m "refactor(facts): migrate to shared table utilities

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Phase 3: Plans refactoring
git commit -m "refactor(plan): migrate to shared table utilities

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Phase 4: Dashboard migration
git commit -m "feat(dashboard): migrate to TypeScript client-side rendering

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Phase 5: Legacy cleanup
git commit -m "chore: remove legacy HTMX facts table partials

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Phase 6: Documentation
git commit -m "docs: add table optimization architecture

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Verification:**
- [ ] Branch created: `dev/table_optimization_YYYYMMDD*`
- [ ] Base branch: `test`
- [ ] Pushed to remote
- [ ] Conventional Commits format used
- [ ] Co-Authored-By в каждом commit

---

## PHASE 2: Рефакторинг Facts Page

### 2.1. Обновить `factsController.ts`

**Изменения:**

1. **Import shared utilities:**
```typescript
import { TableFormatters, TableRenderer } from '../../shared/tableUtils';
import { PaginationManager } from '../../shared/paginationManager';
import { SelectionManager } from '../../shared/selectionManager';
import { escapeHtml } from '../../shared/htmlSanitizer';  // Update path
```

2. **Replace local utilities:**
- ❌ Удалить `truncateText()` (lines 745-749) → используется `TableFormatters.truncateText()`
- ❌ Удалить inline color mapping (lines 635-644, 707-718) → `TableFormatters.getArticleColorClass()`

3. **Refactor rendering functions:**

```typescript
// BEFORE: renderFactRow() inline if-else chains
let articleColorClass = '';
if (fact.article_type === 'expense') {
  articleColorClass = 'text-error';
} else if ...

// AFTER: Use TableFormatters
const articleColorClass = TableFormatters.getArticleColorClass(fact.article_type, 'text');
const articleName = TableFormatters.truncateText(fact.article_name, 30);  // Already escaped
```

4. **Replace pagination:**
```typescript
// BEFORE: Local state variables
let currentPage = 0;
let pageSize = 50;
let totalFacts = 0;

// AFTER:
const paginationManager = new PaginationManager(50);
paginationManager.setTotalRecords(total);
paginationManager.updateUI('pagination-controls');
```

5. **Replace selection:**
```typescript
// BEFORE: stateManager + selectionOperations
import { toggleSelection, getSelectedIds } from '../core/stateManager';
import { toggleSelectAll, updateBatchDeleteButtonUI } from './selectionOperations';

// AFTER:
const selectionManager = new SelectionManager((count) => {
  // Callback when selection changes
  updateBatchDeleteButton(count);
});

selectionManager.toggleSelection(factId);
selectionManager.updateBatchButtonUI('batch-delete-btn');
```

**Ожидаемый результат:**
- Удалено ~80 строк дублированного кода
- Improved maintainability
- Consistent с Plan page patterns

---

### 2.2. Обновить `facts.html` template

**Изменения:**

1. **Consistent column structure:**
```html
<!-- Use Plan page column order -->
<thead>
  <tr>
    <th><input type="checkbox" ...></th>
    <th>📅 Дата</th>
    <th>📁 Категория</th>
    <th>💵 Сумма</th>
    <th>🏦 Счет</th>
    <th>💼 МЗ</th>
    <th>📝 Комментарий</th>
    <th class="text-center" title="Создано offline">☁️</th>  <!-- NEW: consistent с Plan -->
    <th>⚙️ Действия</th>
  </tr>
</thead>
```

2. **Empty state унификация:**
```html
<div id="facts-empty-state" class="hidden">
  <div class="text-center py-8">
    <div class="text-4xl mb-2">📭</div>
    <div class="text-lg font-medium">Факты не найдены</div>
    <div class="text-sm text-base-content/60 mt-1">Попробуйте изменить фильтры или добавьте новые записи</div>
  </div>
</div>
```

---

## PHASE 3: Рефакторинг Plans Page

### 3.1. Обновить `plan/factsTable.ts`

**Изменения:**

1. **Import shared utilities:**
```typescript
import * as PlanHelpers from './helpers';
import * as PlanFilters from './filters';
import { escapeHtml } from '../shared/htmlSanitizer';  // Already added in PHASE 0.5
import { TableFormatters, TableRenderer } from '../shared/tableUtils';  // NEW
import { PaginationManager } from '../shared/paginationManager';  // NEW
import { SelectionManager } from '../shared/selectionManager';  // NEW
```

2. **Replace inline HTML generation:**

```typescript
// BEFORE: Inline if-else chains (lines 341-350)
let articleColorClass = '';
if (fact.article_type === 'expense') {
  articleColorClass = 'text-error';
} else if ...

// AFTER:
const articleColorClass = TableFormatters.getArticleColorClass(fact.article_type, 'text');
```

3. **Replace truncateText:**
```typescript
// BEFORE: Local function (lines 283-287)
function truncateText(text: string | null, maxLength: number = 30): string { ... }

// AFTER: Remove function, use TableFormatters
const descriptionTruncated = TableFormatters.truncateText(description, 30);
```

4. **Replace selection state:**
```typescript
// BEFORE: Local Set<number>
let selectedFactIds: Set<number> = new Set();

// AFTER:
const selectionManager = new SelectionManager();
```

5. **Replace pagination:**
```typescript
// BEFORE: Local variables
let currentPage = 0;
const pageSize = 50;
let totalFacts = 0;

// AFTER:
const paginationManager = new PaginationManager(50);
```

**Ожидаемый результат:**
- Удалено ~120 строк inline HTML generation
- Consistent с Facts page patterns
- Shared utilities используются вместо local implementations

---

### 3.2. Consolidate с helpers.ts

**Удалить из helpers.ts:**

```typescript
// ❌ DELETE (lines 350-358):
export function getMobileAmountClass(type: string): string { ... }

// ❌ DELETE (lines 366-388):
export function formatMobileAmount(amount: number, type: string): string { ... }
export function formatDesktopAmount(amount: number, type: string): string { ... }
```

**Заменить на:**
```typescript
import { TableFormatters } from '../shared/tableUtils';

// Use in plan/factsTable.ts:
const mobileAmountClass = TableFormatters.getArticleColorClass(fact.article_type, 'amount');
const mobileAmount = TableFormatters.formatAmount(fact.amount, fact.article_type);
```

---

## PHASE 4: Миграция Dashboard на TypeScript

### 4.1. Создать `frontend/web/static/js/dashboard/recentTransactions.ts`

**Цель:** Заменить server-side rendering на client-side с offline support.

**Структура:**

```typescript
import { TableFormatters, TableRenderer, BudgetFact } from '../shared/tableUtils';
import type { TableColumn } from '../shared/tableUtils';

interface RecentTransaction extends BudgetFact {
  record_type: 'fact' | 'plan';
}

export async function loadRecentTransactions(): Promise<void> {
  const container = document.getElementById('recent-transactions');
  if (!container) return;

  // ✅ Check offline mode
  const isOffline = document.documentElement.classList.contains('offline-mode');
  if (isOffline) {
    console.log('[RecentTransactions] Offline mode - skipping load');
    return;
  }

  try {
    // Fetch JSON instead of HTML
    const response = await fetch('/api/v1/facts/recent?limit=10');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const facts: RecentTransaction[] = await response.json();

    if (facts.length === 0) {
      container.innerHTML = TableRenderer.renderEmptyState(
        '📭',
        'Нет последних транзакций',
        'Добавьте первую транзакцию'
      );
      return;
    }

    // Use shared TableRenderer
    const columns = buildRecentTransactionsColumns();
    container.innerHTML = TableRenderer.renderDesktopTable(facts, columns);

  } catch (error) {
    console.error('[RecentTransactions] Load error:', error);
    container.innerHTML = `
      <div class="alert alert-error">
        <span>❌ Ошибка загрузки транзакций</span>
      </div>
    `;
  }
}

function buildRecentTransactionsColumns(): TableColumn[] {
  return [
    {
      key: 'type',
      header: 'Тип',
      render: (f: RecentTransaction) => {
        const badgeClass = f.record_type === 'fact' ? 'badge-primary' : 'badge-secondary';
        const text = f.record_type === 'fact' ? 'Факт' : 'План';
        return `<span class="badge ${badgeClass} badge-xs">${text}</span>`;
      }
    },
    {
      key: 'date',
      header: 'Дата',
      render: (f) => TableFormatters.formatDate(f.fact_date)
    },
    {
      key: 'account',
      header: 'Счёт',
      render: (f) => TableFormatters.truncateText(f.financial_center_name, 20)
    },
    {
      key: 'category',
      header: 'Категория',
      render: (f) => {
        const colorClass = TableFormatters.getArticleColorClass(f.article_type, 'text');
        const name = TableFormatters.truncateText(f.article_name, 30);
        return `<span class="${colorClass}">${name}</span>`;
      }
    },
    {
      key: 'amount',
      header: 'Сумма',
      render: (f) => {
        const colorClass = TableFormatters.getArticleColorClass(f.article_type, 'amount');
        const formatted = TableFormatters.formatAmount(f.amount, f.article_type);
        return `<span class="${colorClass}">${formatted}</span>`;
      }
    },
    {
      key: 'description',
      header: 'Описание',
      render: (f) => TableFormatters.truncateText(f.description, 30)
    },
    {
      key: 'sync',
      header: '☁️',
      render: (f) => f.is_offline_sync ? '☁️' : ''
    },
    {
      key: 'actions',
      header: 'Действия',
      render: (f) => `
        <button class="btn btn-xs btn-ghost" onclick="editTransaction(${f.id})">✏️</button>
        <button class="btn btn-xs btn-ghost text-error" onclick="deleteTransaction(${f.id})">🗑️</button>
      `
    }
  ];
}
```

---

### 4.2. Проверить/создать backend endpoint `/api/v1/facts/recent` (JSON)

**ВАЖНО:** Проверить существование endpoint перед созданием!

**Шаг 1: Проверка существования**

```bash
grep -A10 "@router.get.*recent" backend/app/api/v1/endpoints/facts.py
```

**Если endpoint существует:**
- ✅ Использовать существующий
- ✅ Обновить plan (убрать создание)

**Если НЕ существует (только `/recent-html`):**

**Файл:** `backend/app/api/v1/endpoints/facts.py`

**Добавить:**
```python
from typing import List
from app.api.v1.schemas.fact import FactResponse

@router.get("/recent", response_model=List[FactResponse])
async def get_recent_facts(
    limit: int = Query(10, ge=1, le=50, description="Количество записей"),
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    """
    Get recent facts (JSON endpoint for TypeScript client)

    Returns latest facts ordered by date DESC.
    """
    stmt = (
        select(BudgetFact)
        .where(BudgetFact.user_id == current_user.id)
        .order_by(BudgetFact.fact_date.desc(), BudgetFact.id.desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    facts = result.scalars().all()

    return [FactResponse.from_orm(fact) for fact in facts]
```

**Сохранить `/recent-html` для обратной совместимости:**
- Не удалять существующий HTML endpoint
- Legacy код может использовать его

---

### 4.3. Обновить `index.html`

**Изменения:**

1. **Replace HTMX partial:**
```html
<!-- BEFORE -->
<div hx-get="/api/v1/facts/recent-html?limit=10"
     hx-trigger="load"
     hx-swap="innerHTML">
  <span class="loading loading-spinner"></span>
</div>

<!-- AFTER -->
<div id="recent-transactions" data-offline-hidden="true">
  <!-- ↑ ВАЖНО: Сохранить data-offline-hidden для offline mode -->
  <span class="loading loading-spinner"></span>
</div>
```

2. **Add TypeScript module import:**
```html
<script type="module">
  import { loadRecentTransactions } from '/static/js/dashboard/recentTransactions.js';

  document.addEventListener('DOMContentLoaded', async () => {
    await loadRecentTransactions();
  });

  // Reload on WebSocket update (optional)
  window.addEventListener('fact:created', async () => {
    await loadRecentTransactions();
  });
</script>
```

**Ожидаемый результат:**
- Dashboard миgrирован на client-side rendering
- Используются shared utilities (consistent с Facts/Plans)
- Offline mode поддерживается
- Нет server roundtrip для обновления таблицы

---

## PHASE 5: Удаление Legacy Code

### 5.1. Удалить неиспользуемые HTMX partials

**Файлы для удаления:**

```bash
git rm frontend/web/templates/partials/facts/facts_table.html
git rm frontend/web/templates/components/facts/fact_row_desktop.html
git rm frontend/web/templates/components/facts/fact_row_mobile.html
```

**Git commit message:**
```bash
git commit -m "chore: remove legacy HTMX facts table partials

These files were replaced by TypeScript client-side rendering in PR #336.
The endpoint /api/v1/facts/table no longer exists.

Legacy files removed:
- facts_table.html (HTMX partial)
- fact_row_desktop.html (Jinja2 macro)
- fact_row_mobile.html (Jinja2 macro)

Active implementation:
- facts.html → factsController.ts (client-side rendering)
- plan.html → plan/factsTable.ts (client-side rendering)
- index.html → recentTransactions.ts (NEW: client-side)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 5.2. Удалить deprecated backend endpoint (если существует)

**Проверить наличие:**
```bash
grep -r "facts/table" backend/app/api/
```

Если endpoint существует — удалить. Если нет — документировать что endpoint никогда не был реализован.

---

## PHASE 6: Документация и Тестирование

### 6.1. Обновить архитектурную документацию

**Файл:** `/docs/architecture/frontend/table-optimization.md` (NEW)

**Содержание:**
```markdown
# Table Optimization Architecture v2.0

## Overview

Унифицированная система табличных компонентов с встроенной XSS защитой.

**Ключевые принципы:**
- **Security-first:** Все user input escaped через `escapeHtml()`
- **DRY:** Shared utilities вместо дублирования
- **Consistent:** Единый подход для Facts/Plans/Dashboard
- **Maintainable:** Централизованная логика

## Shared Utilities Module

### Location

```
frontend/web/static/js/shared/
├── htmlSanitizer.ts      # XSS protection (moved from facts/utilities)
├── tableUtils.ts         # TableFormatters + TableRenderer
├── paginationManager.ts  # Unified pagination
└── selectionManager.ts   # Checkbox management
```

### TableFormatters

**Purpose:** Format data for display with XSS protection.

**Methods:**
- `getArticleColorClass(type, variant)` - Color mapping (safe: no user input)
- `formatAmount(amount, type)` - Locale-aware formatting (safe: numeric)
- `truncateText(text, maxLength)` - ⚠️ XSS-protected truncation
- `formatDate(isoDate)` - DD.MM.YYYY format (safe: trusted formatter)
- `escapeHtml(text)` - Re-export from htmlSanitizer

**Security:**
- `truncateText()` ALWAYS escapes HTML via `escapeHtml()`
- Numeric/enum methods safe by design (no user strings)

**Example:**
```typescript
const name = TableFormatters.truncateText(fact.article_name, 30);
// Input: <script>alert('XSS')</script>
// Output: &lt;script&gt;alert('XSS')&lt;/script&gt;
```

### TableRenderer

**Purpose:** Generate HTML for desktop tables and mobile cards.

**Methods:**
- `renderDesktopTable(facts, columns)` - Column-based table
- `renderMobileCard(config)` - Two-Line List mobile card
- `renderEmptyState(icon, message, description)` - No data placeholder

**Security:**
- Column `render()` functions MUST return escaped content
- Mobile card config fields MUST be pre-escaped
- Use TableFormatters methods which include escaping

**Example:**
```typescript
const columns: TableColumn[] = [
  {
    key: 'category',
    header: '📁 Категория',
    render: (f) => {
      const colorClass = TableFormatters.getArticleColorClass(f.article_type, 'text');
      const name = TableFormatters.truncateText(f.article_name, 30);  // ✅ Escaped
      return `<span class="${colorClass}">${name}</span>`;
    }
  }
];

const html = TableRenderer.renderDesktopTable(facts, columns);
```

### PaginationManager

**Purpose:** Unified pagination state management.

**Methods:**
- `getCurrentPage()`, `setCurrentPage(page)`
- `nextPage()`, `previousPage()`
- `getTotalPages()`, `getPageStart()`, `getPageEnd()`
- `setTotalRecords(total)`
- `updateUI(controlsId)` - Update pagination buttons
- `getOffset()` - Calculate API offset

**Example:**
```typescript
const pagination = new PaginationManager(50);
pagination.setTotalRecords(150);
pagination.updateUI('pagination-controls');
```

### SelectionManager

**Purpose:** Checkbox selection for batch operations.

**Methods:**
- `toggleSelection(id)`, `selectAll(ids)`, `clearSelection()`
- `getSelectedIds()`, `getSelectedCount()`, `isSelected(id)`
- `updateBatchButtonUI(buttonId)` - Enable/disable batch button

**Example:**
```typescript
const selection = new SelectionManager((count) => {
  console.log(`Selected: ${count}`);
});

selection.toggleSelection(1);
selection.updateBatchButtonUI('batch-delete-btn');
```

## Usage Examples

### Facts Page

```typescript
import { TableFormatters, TableRenderer } from '../shared/tableUtils';

// Color mapping
const colorClass = TableFormatters.getArticleColorClass('expense', 'text');
// Returns: 'text-error'

// Truncation with escaping
const name = TableFormatters.truncateText(fact.article_name, 30);
// Automatically escaped for XSS protection
```

### Plans Page

```typescript
import { TableFormatters } from '../shared/tableUtils';
import { escapeHtml } from '../shared/htmlSanitizer';

// Escape before truncation
const description = escapeHtml(fact.description || '—');
const truncated = TableFormatters.truncateText(description, 30);
```

### Dashboard

```typescript
import { TableRenderer, TableFormatters } from '../shared/tableUtils';

const columns = buildRecentTransactionsColumns();
const html = TableRenderer.renderDesktopTable(facts, columns);
container.innerHTML = html;
```

## Migration from Legacy

| ❌ Legacy | ✅ Shared Utilities |
|----------|---------------------|
| Facts: inline if-else color mapping | `TableFormatters.getArticleColorClass()` |
| Plans: `getMobileAmountClass()` | `TableFormatters.getArticleColorClass(type, 'amount')` |
| Facts: local `truncateText()` | `TableFormatters.truncateText()` (with escaping) |
| Plans: local `truncateText()` | `TableFormatters.truncateText()` (with escaping) |
| Facts: hardcoded `.toFixed(2)` | `TableFormatters.formatAmount()` |
| Plans: `formatMobileAmount()` | `TableFormatters.formatAmount()` |
| Dashboard: Jinja2 `format_date_full` | `TableFormatters.formatDate()` |

## Security Considerations

### XSS Protection

**ALL user input MUST be escaped:**

```typescript
// ✅ SAFE:
const name = TableFormatters.truncateText(fact.article_name, 30);  // Escapes inside
const description = TableFormatters.truncateText(fact.description, 40);

// ❌ UNSAFE:
const name = fact.article_name.substring(0, 30) + '...';  // NO escaping!
```

### Safe by Design

**These methods DON'T need escaping:**
- `formatAmount()` - Numeric input only
- `getArticleColorClass()` - Returns predefined CSS classes
- `formatDate()` - Uses trusted BudgetShared.DateFormatter

**These methods NEED escaping:**
- `truncateText()` - User input → ALWAYS escapes
- Any custom `render()` function with user data → MUST escape

### Testing XSS

```typescript
// Test with malicious input
const malicious = '<script>alert("XSS")</script>';
const result = TableFormatters.truncateText(malicious, 50);

// Expected: &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
// NOT: <script>alert("XSS")</script>
```

## Performance Metrics

**Before optimization:**
- Duplicated code: ~200 lines
- Bundle size: baseline

**After optimization:**
- Shared utilities: ~50 lines
- Code reduction: 75%
- Bundle size: -10-15KB (estimated)
- Table render time: ≤50ms for 50 items
- First paint: ≤200ms

## Backward Compatibility

**Breaking changes:**
- None - all changes internal to modules
- External APIs unchanged

**Deprecated:**
- Legacy HTMX partials (removed)
- Local utility functions (replaced by shared)

## Related Documentation

- XSS Protection: `/docs/security/xss-prevention.md`
- Responsive Design: `/docs/architecture/frontend/responsive-design.md`
- Modal Architecture: `/docs/architecture/frontend/modal-architecture.md`
- Z-Index Layering: `/docs/architecture/frontend/z-index-layering.md`
```

---

### 6.2. Обновить `table-implementations-research.md`

**Добавить секцию:**
```markdown
## Post-Optimization Architecture (v12.0+)

### Shared Utilities (NEW)

**Location:** `frontend/web/static/js/shared/`

| Utility | Purpose | Lines | Replaces |
|---------|---------|-------|----------|
| `htmlSanitizer.ts` | XSS protection | 80 | facts/utilities/htmlSanitizer.ts (moved) |
| `tableUtils.ts` | TableFormatters + TableRenderer | ~200 | 3 duplicate implementations |
| `paginationManager.ts` | Unified pagination | ~80 | 2 different patterns |
| `selectionManager.ts` | Checkbox selection | ~70 | Facts + Plans local implementations |

### Code Reduction

**Before:**
- Facts color mapping: 10 lines (if-else chain)
- Plans color mapping: 10 lines (if-else chain)
- Dashboard color mapping: Jinja2 filter
- Facts truncation: 5 lines
- Plans truncation: 5 lines
- Total duplicated: **~200 lines**

**After:**
- Shared TableFormatters: ~50 lines
- Savings: **~150 lines (75% reduction)**

### Migration Status

- ✅ **PHASE 0.5:** Plan page XSS fixed (security hotfix)
- ✅ **PHASE 1:** Shared utilities created
- ✅ **PHASE 2:** Facts page migrated
- ✅ **PHASE 3:** Plans page migrated
- ✅ **PHASE 4:** Dashboard migrated to TypeScript
- ✅ **PHASE 5:** Legacy HTMX partials removed
- ✅ **PHASE 6:** Documentation updated

### Security Improvements

**CRITICAL FIX:** Plan page XSS vulnerability patched in PHASE 0.5.

**Before:**
```typescript
// ❌ VULNERABLE:
const articleName = fact.article_name || '—';
tableHtml += `<td>${articleName}</td>`;  // NO escaping!
```

**After:**
```typescript
// ✅ PROTECTED:
const articleName = escapeHtml(fact.article_name || '—');
tableHtml += `<td>${articleName}</td>`;  // Escaped
```

**All shared utilities include XSS protection:**
- `TableFormatters.truncateText()` - Always escapes
- `TableRenderer` methods - Require pre-escaped input
- Security tests added (10+ test cases)
```

---

### 6.3. Создать тесты

**Файл 1:** `frontend/web/static/js/shared/__tests__/tableUtils.test.ts`

```typescript
import { TableFormatters } from '../tableUtils';

describe('TableFormatters - Functionality', () => {
  describe('getArticleColorClass', () => {
    test('returns correct text color for expense', () => {
      expect(TableFormatters.getArticleColorClass('expense', 'text')).toBe('text-error');
    });

    test('returns correct amount color for income', () => {
      expect(TableFormatters.getArticleColorClass('income', 'amount')).toBe('amount-income');
    });

    test('returns default for unknown type', () => {
      expect(TableFormatters.getArticleColorClass('unknown', 'text')).toBe('text-base-content');
    });
  });

  describe('formatAmount', () => {
    test('formats positive amount with plus sign for income', () => {
      expect(TableFormatters.formatAmount(1500.5, 'income')).toBe('+1 500,50');
    });

    test('formats negative amount with minus sign for expense', () => {
      expect(TableFormatters.formatAmount(2300, 'expense')).toBe('-2 300,00');
    });

    test('handles zero amount', () => {
      expect(TableFormatters.formatAmount(0, 'expense')).toBe('-0,00');
    });
  });

  describe('truncateText', () => {
    test('truncates long text with ellipsis', () => {
      const long = 'This is a very long description that should be truncated';
      const result = TableFormatters.truncateText(long, 20);
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(30);  // 20 + '...' + escaping overhead
    });

    test('preserves short text', () => {
      const short = 'Short text';
      const result = TableFormatters.truncateText(short, 20);
      expect(result).not.toContain('...');
    });

    test('handles null text', () => {
      expect(TableFormatters.truncateText(null, 20)).toBe('');
    });

    test('handles em dash', () => {
      expect(TableFormatters.truncateText('—', 20)).toBe('—');
    });
  });

  describe('formatDate', () => {
    test('formats ISO date to display format', () => {
      // Mock BudgetShared.DateFormatter
      (global as any).BudgetShared = {
        DateFormatter: {
          formatForDisplay: (iso: string) => '09.02.2026'
        }
      };

      expect(TableFormatters.formatDate('2026-02-09')).toBe('09.02.2026');
    });
  });
});
```

**Файл 2:** `frontend/web/static/js/shared/__tests__/tableUtils.security.test.ts`

```typescript
import { TableFormatters } from '../tableUtils';

describe('TableFormatters - XSS Protection', () => {
  describe('truncateText XSS prevention', () => {
    test('escapes script tags', () => {
      const malicious = '<script>alert("XSS")</script>';
      const result = TableFormatters.truncateText(malicious, 50);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&quot;');
    });

    test('escapes img onerror', () => {
      const malicious = '<img src=x onerror=alert("XSS")>';
      const result = TableFormatters.truncateText(malicious, 50);

      expect(result).not.toContain('onerror=');
      expect(result).toContain('&lt;img');
      expect(result).toContain('&gt;');
    });

    test('escapes quotes in attributes', () => {
      const malicious = '" onclick="alert(\'XSS\')" x="';
      const result = TableFormatters.truncateText(malicious, 50);

      expect(result).not.toContain('onclick=');
      expect(result).toContain('&quot;');
    });

    test('escapes HTML entities', () => {
      const malicious = '&lt;already&gt; &amp; &quot;escaped&quot;';
      const result = TableFormatters.truncateText(malicious, 50);

      // Should double-escape
      expect(result).toContain('&amp;lt;');
      expect(result).toContain('&amp;gt;');
      expect(result).toContain('&amp;amp;');
    });

    test('handles mixed content', () => {
      const malicious = 'Normal text <b>bold</b> <script>evil</script>';
      const result = TableFormatters.truncateText(malicious, 50);

      expect(result).not.toContain('<b>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;b&gt;');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('formatAmount safety', () => {
    test('numeric values cannot contain XSS', () => {
      // Numeric input is safe by design
      const result = TableFormatters.formatAmount(1500.5, 'income');
      expect(result).toBe('+1 500,50');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    test('handles NaN gracefully', () => {
      const result = TableFormatters.formatAmount(NaN, 'expense');
      expect(result).toContain('NaN');  // Browser-safe representation
    });
  });

  describe('getArticleColorClass safety', () => {
    test('returns predefined classes only', () => {
      const result = TableFormatters.getArticleColorClass('expense', 'text');
      expect(result).toBe('text-error');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    test('malicious input returns safe default', () => {
      const malicious = '<script>alert("XSS")</script>';
      const result = TableFormatters.getArticleColorClass(malicious, 'text');
      expect(result).toBe('text-base-content');  // Safe default
    });
  });
});

describe('TableRenderer - XSS Protection', () => {
  test('renderDesktopTable with escaped column render', () => {
    const maliciousFact = {
      id: 1,
      article_name: '<script>alert("XSS")</script>',
      amount: 100,
      article_type: 'expense' as const,
      fact_date: '2026-02-09'
    };

    const columns = [
      {
        key: 'category',
        header: 'Category',
        render: (f: any) => TableFormatters.truncateText(f.article_name, 30)
      }
    ];

    const html = TableRenderer.renderDesktopTable([maliciousFact], columns);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('renderEmptyState with safe strings', () => {
    const html = TableRenderer.renderEmptyState('📭', 'No data', 'Try again');

    // Developer-controlled strings are safe
    expect(html).toContain('📭');
    expect(html).toContain('No data');
    expect(html).toContain('Try again');
  });
});
```

**Файл 3:** `frontend/web/static/js/shared/__tests__/paginationManager.test.ts`

```typescript
import { PaginationManager } from '../paginationManager';

describe('PaginationManager', () => {
  test('initializes with correct defaults', () => {
    const pm = new PaginationManager(50);

    expect(pm.getCurrentPage()).toBe(0);
    expect(pm.getTotalPages()).toBe(0);
  });

  test('calculates total pages correctly', () => {
    const pm = new PaginationManager(50);
    pm.setTotalRecords(150);

    expect(pm.getTotalPages()).toBe(3);
  });

  test('calculates page start/end correctly', () => {
    const pm = new PaginationManager(50);
    pm.setTotalRecords(150);

    expect(pm.getPageStart()).toBe(1);
    expect(pm.getPageEnd()).toBe(50);

    pm.nextPage();
    expect(pm.getPageStart()).toBe(51);
    expect(pm.getPageEnd()).toBe(100);

    pm.nextPage();
    expect(pm.getPageStart()).toBe(101);
    expect(pm.getPageEnd()).toBe(150);
  });

  test('does not go beyond last page', () => {
    const pm = new PaginationManager(50);
    pm.setTotalRecords(150);

    pm.setCurrentPage(999);  // Try to go beyond
    expect(pm.getCurrentPage()).toBe(2);  // Should clamp to last page
  });

  test('does not go below first page', () => {
    const pm = new PaginationManager(50);
    pm.setTotalRecords(150);

    pm.setCurrentPage(-999);  // Try to go negative
    expect(pm.getCurrentPage()).toBe(0);  // Should clamp to first page
  });

  test('calculates offset for API correctly', () => {
    const pm = new PaginationManager(50);
    pm.setTotalRecords(150);

    expect(pm.getOffset()).toBe(0);

    pm.nextPage();
    expect(pm.getOffset()).toBe(50);

    pm.nextPage();
    expect(pm.getOffset()).toBe(100);
  });
});
```

**Файл 4:** `frontend/web/static/js/shared/__tests__/selectionManager.test.ts`

```typescript
import { SelectionManager } from '../selectionManager';

describe('SelectionManager', () => {
  test('initializes empty', () => {
    const sm = new SelectionManager();

    expect(sm.getSelectedCount()).toBe(0);
    expect(sm.getSelectedIds()).toEqual([]);
  });

  test('toggles selection on/off', () => {
    const sm = new SelectionManager();

    sm.toggleSelection(1);
    expect(sm.isSelected(1)).toBe(true);
    expect(sm.getSelectedCount()).toBe(1);

    sm.toggleSelection(1);
    expect(sm.isSelected(1)).toBe(false);
    expect(sm.getSelectedCount()).toBe(0);
  });

  test('selects all items', () => {
    const sm = new SelectionManager();

    sm.selectAll([1, 2, 3, 4, 5]);
    expect(sm.getSelectedCount()).toBe(5);
    expect(sm.getSelectedIds()).toEqual([1, 2, 3, 4, 5]);
  });

  test('clears selection', () => {
    const sm = new SelectionManager();

    sm.selectAll([1, 2, 3]);
    sm.clearSelection();

    expect(sm.getSelectedCount()).toBe(0);
    expect(sm.getSelectedIds()).toEqual([]);
  });

  test('calls onChange callback', () => {
    const onChangeCallback = jest.fn();
    const sm = new SelectionManager(onChangeCallback);

    sm.toggleSelection(1);
    expect(onChangeCallback).toHaveBeenCalledWith(1);

    sm.toggleSelection(2);
    expect(onChangeCallback).toHaveBeenCalledWith(2);

    sm.clearSelection();
    expect(onChangeCallback).toHaveBeenCalledWith(0);
  });

  test('prevents duplicate selections', () => {
    const sm = new SelectionManager();

    sm.toggleSelection(1);
    sm.toggleSelection(1);
    sm.toggleSelection(1);

    // Set prevents duplicates
    expect(sm.getSelectedCount()).toBe(0);  // Toggled back off
  });
});
```

**Запуск тестов:**
```bash
# All tests
npm run test

# Specific test file
npm run test -- tableUtils.test.ts
npm run test -- tableUtils.security.test.ts

# Security tests only
npm run test -- tableUtils.security.test.ts

# With coverage
npm run test -- --coverage
```

**Expected coverage:**
- TableFormatters: 100%
- TableRenderer: 100%
- PaginationManager: 100%
- SelectionManager: 100%

---

## Критические файлы для изменений

### Backend
- `backend/app/api/v1/endpoints/facts.py` (ОПЦИОНАЛЬНО: добавить `/recent` JSON endpoint если не существует)

### Frontend TypeScript

**NEW файлы:**
- `frontend/web/static/js/shared/htmlSanitizer.ts` (переместить из facts/utilities)
- `frontend/web/static/js/shared/tableUtils.ts` (TableFormatters + TableRenderer)
- `frontend/web/static/js/shared/paginationManager.ts`
- `frontend/web/static/js/shared/selectionManager.ts`
- `frontend/web/static/js/dashboard/recentTransactions.ts`
- `frontend/web/static/js/shared/__tests__/tableUtils.test.ts`
- `frontend/web/static/js/shared/__tests__/tableUtils.security.test.ts`
- `frontend/web/static/js/shared/__tests__/paginationManager.test.ts`
- `frontend/web/static/js/shared/__tests__/selectionManager.test.ts`

**MODIFIED файлы:**
- `frontend/web/static/js/plan/factsTable.ts` (PHASE 0.5: XSS fix + PHASE 3: migrate to shared)
- `frontend/web/static/js/facts/operations/factsController.ts` (PHASE 2: migrate to shared)
- `frontend/web/static/js/plan/helpers.ts` (PHASE 3: remove duplicate utilities)

### Frontend Templates

**MODIFIED файлы:**
- `frontend/web/templates/index.html` (PHASE 4: replace HTMX с TypeScript module + offline mode)
- `frontend/web/templates/facts.html` (PHASE 2: minor updates)
- `frontend/web/templates/plan.html` (PHASE 3: minor updates если нужно)

**DELETED файлы:**
- `frontend/web/templates/partials/facts/facts_table.html`
- `frontend/web/templates/components/facts/fact_row_desktop.html`
- `frontend/web/templates/components/facts/fact_row_mobile.html`

### Documentation

**NEW файлы:**
- `docs/architecture/frontend/table-optimization.md`

**MODIFIED файлы:**
- `docs/explore/table-implementations-research.md` (добавить Post-Optimization Architecture секцию)

---

## Verification Steps

### 1. Build проверка

```bash
# TypeScript compilation
npm run build

# Check for errors
echo $?  # Should be 0

# Check bundle size (should decrease after removing duplicates)
ls -lh frontend/web/static/dist/
```

**Expected:**
- Build success без ошибок
- Bundle size reduction ~10-15KB

---

### 2. Security testing (XSS)

**Test XSS payloads в каждой таблице:**

```javascript
// Test inputs для description/article_name:
const xssPayloads = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  'javascript:alert("XSS")',
  '" onclick="alert(\'XSS\')" x="',
  '<iframe src="javascript:alert(\'XSS\')">',
  '<svg onload=alert("XSS")>',
];

// Expected behavior:
// 1. HTML tags escaped: &lt;script&gt;
// 2. JavaScript не выполняется
// 3. Отображается как plain text
```

**Verification:**
- [ ] Facts page: XSS payloads escaped
- [ ] Plans page: XSS payloads escaped
- [ ] Dashboard: XSS payloads escaped
- [ ] Mobile cards: XSS payloads escaped
- [ ] Empty states: Safe (developer-controlled strings)

---

### 3. Функциональное тестирование

**Facts page (`/facts`):**
- [ ] Таблица рендерится корректно (desktop + mobile views)
- [ ] Color coding работает (expense=red, income=green, debit=blue, credit=amber)
- [ ] Pagination работает (50 items per page, prev/next buttons)
- [ ] Batch selection работает (checkbox + "Удалить выбранные")
- [ ] Filters применяются корректно
- [ ] Empty state отображается когда нет фактов
- [ ] Offline sync icon (☁️) отображается для offline records

**Plans page (`/plan`):**
- [ ] Таблица рендерится с 13 колонками
- [ ] Reminder icons (🔔) отображаются
- [ ] Recurring icons (🔄) отображаются
- [ ] Offline sync icons (☁️) работают
- [ ] Analytics section обновляется
- [ ] Batch delete с recurring confirmation работает

**Dashboard (`/`):**
- [ ] Recent Transactions загружаются через JSON API (не HTML)
- [ ] Таблица обновляется без browser reload
- [ ] Mobile cards рендерятся корректно
- [ ] Empty state отображается если нет транзакций
- [ ] Offline mode: таблица скрыта (data-offline-hidden="true")

---

### 4. Responsive testing

**Breakpoints:**
- [ ] Mobile (<768px): Two-line list cards отображаются
- [ ] Tablet (768-1023px): Table view на landscape
- [ ] Desktop (≥1024px): Full table с всеми колонками

**iOS Safari:**
- [ ] Safe-area-inset не перекрывается
- [ ] Swipe gestures работают (если применимо)
- [ ] No horizontal scroll overflow

**Chrome DevTools Device Mode:**
- [ ] iPhone SE (375px): Mobile cards
- [ ] iPad (768px): Table view
- [ ] MacBook (1440px): Full table

---

### 5. Performance benchmarks

**Metrics to track:**
- Bundle size: Ожидается reduction ~10-15KB после удаления duplicates
- First paint time: Должно остаться ≤ 200ms
- Table render time: ≤ 50ms для 50 items

**Measurement:**
```javascript
// В браузере console:
console.time('renderFactsTable');
window.FactsManager.loadFacts();
console.timeEnd('renderFactsTable');
// Expected: < 50ms
```

**Chrome DevTools Performance:**
- [ ] No long tasks (>50ms)
- [ ] First Contentful Paint < 200ms
- [ ] Time to Interactive < 500ms

---

### 6. Offline mode testing

**Dashboard:**
```javascript
// Simulate offline
document.documentElement.classList.add('offline-mode');

// Reload page
location.reload();

// Expected:
// - #recent-transactions должен быть скрыт (data-offline-hidden="true")
// - loadRecentTransactions() должен выйти early (console.log)
```

**Facts/Plans:**
- [ ] Offline sync icon (☁️) отображается для offline-created records
- [ ] Tables загружаются из PGlite (не скрыты в offline)

---

### 7. Git verification

**Branch:**
- [ ] Branch created: `dev/table_optimization_YYYYMMDD*`
- [ ] Base branch: `test`
- [ ] Pushed to remote

**Commits:**
- [ ] Conventional Commits format:
  - `security: fix XSS in plan page`
  - `feat: add shared table utilities`
  - `refactor(facts): migrate to shared utilities`
  - `refactor(plan): migrate to shared utilities`
  - `feat(dashboard): migrate to TypeScript`
  - `chore: remove legacy partials`
  - `docs: add table optimization docs`
- [ ] Co-Authored-By в каждом commit
- [ ] Commit messages детальны и понятны

---

## Rollback Plan

Если критические проблемы обнаружены:

### Rollback Step 1: Revert последнего проблемного commit
```bash
git revert <commit-hash>
git push origin dev/table_optimization_*
```

### Rollback Step 2: Полный rollback до начала
```bash
# Откатить все изменения
git reset --hard origin/test

# Force push (ОСТОРОЖНО!)
# git push -f origin dev/table_optimization_*
```

### Rollback Step 3: Selective revert

**Если проблема только в одной фазе:**

```bash
# Revert только Dashboard migration
git revert <dashboard-commit-hash>

# Revert только Plans refactoring
git revert <plans-commit-hash>

# etc.
```

**Critical files to preserve:**
- PHASE 0.5 (Security Hotfix) должен остаться ВСЕГДА
- Facts/Plans modules работают независимо - можно revert по отдельности
- Dashboard может fallback на старый HTML endpoint `/recent-html`

---

## Success Criteria

**Code Quality:**
- ✅ Удалено ≥150 строк дублированного кода
- ✅ Все таблицы используют shared utilities
- ✅ TypeScript type safety для всех rendering functions
- ✅ XSS protection во ВСЕХ user input местах

**Security:**
- ✅ Plan page XSS уязвимость исправлена
- ✅ Все shared utilities используют escapeHtml для user input
- ✅ XSS test suite добавлен (10+ тестов)
- ✅ Security audit passed

**Performance:**
- ✅ Bundle size уменьшен ≥10KB
- ✅ Table render time ≤50ms для 50 items
- ✅ First paint ≤200ms

**Consistency:**
- ✅ Facts, Plans, Dashboard используют одинаковые formatting patterns
- ✅ Responsive design работает на всех breakpoints
- ✅ Z-index layering соответствует guidelines
- ✅ Offline mode поддерживается

**Maintainability:**
- ✅ Shared utilities покрыты unit tests (100% coverage)
- ✅ Документация актуализирована
- ✅ Legacy код удалён
- ✅ Git branch + commits соответствуют CLAUDE.md requirements

**Testing:**
- ✅ All unit tests pass (4 test suites)
- ✅ XSS tests pass (10+ security tests)
- ✅ Manual testing completed (Facts, Plans, Dashboard)
- ✅ Responsive testing на 3 breakpoints
- ✅ Offline mode tested

---

## Timeline Estimate

**PHASE 0.5: Security Hotfix (Plan XSS)** - 30 минут
- Import htmlSanitizer
- Add escaping to 5 fields
- Commit + verify XSS fixed

**PHASE 1: Shared Utilities** - 5 часов
- Move htmlSanitizer to shared (15 min)
- tableUtils.ts implementation + XSS protection (2h)
- paginationManager.ts implementation (1h)
- selectionManager.ts implementation (1h)
- Unit tests + security tests (1h)

**PHASE 1.5: Git Branch Setup** - 15 минут
- Create dev branch
- Verify branch name
- Set base branch to test
- Push to remote

**PHASE 2: Facts Refactoring** - 3 часа
- factsController.ts migration (1.5h)
- facts.html updates (30 min)
- Testing (1h)

**PHASE 3: Plans Refactoring** - 3 часа
- factsTable.ts migration (1.5h)
- helpers.ts cleanup (30 min)
- Testing (1h)

**PHASE 4: Dashboard Migration** - 5 часов
- recentTransactions.ts implementation (2h)
- Backend JSON endpoint check/creation (1h)
- index.html updates + offline mode (1h)
- Testing (1h)

**PHASE 5: Legacy Cleanup** - 1 час
- Delete HTMX partials (15 min)
- Git commit (15 min)
- Verification (30 min)

**PHASE 6: Documentation** - 2 часа
- Architecture docs (1h)
- Update research doc (30 min)
- Test suite completion (30 min)

**Total: ~20 часов** (было ~17 в v1.0)

**Увеличение времени:**
- +30 min: PHASE 0.5 (Security Hotfix)
- +15 min: PHASE 1.5 (Git Branch - mandatory)
- +1h: PHASE 1 (Security tests)
- +1h: PHASE 4 (Offline mode + endpoint verification)

---

## Security Checklist (перед каждым коммитом)

- [ ] Все user input поля escaped через `TableFormatters.truncateText()` или `escapeHtml()`
- [ ] Numeric/enum values НЕ escaped (безопасны по природе)
- [ ] HTML attributes используют `escapeHtmlAttribute()` если содержат user input
- [ ] `onclick` handlers НЕ содержат user input напрямую (только numeric IDs)
- [ ] XSS tests проходят для изменённых компонентов
- [ ] Manual XSS testing выполнен (test payloads)
- [ ] No `innerHTML` без pre-escaping
- [ ] `setInnerHTML()` helper не используется как sanitizer

---

## Code Review Checklist

**Security:**
- [ ] XSS protection на месте (используется escapeHtml)
- [ ] No inline HTML strings с user input без escaping
- [ ] Test payloads не выполняются (< script >, < img onerror >)

**Architecture:**
- [ ] Shared utilities используются вместо local duplicates
- [ ] TypeScript types корректны
- [ ] No circular dependencies

**UX:**
- [ ] Responsive design сохранён (desktop table + mobile cards)
- [ ] Z-index layering compliance
- [ ] Offline mode учтён где необходимо
- [ ] Empty states отображаются корректно

**Git:**
- [ ] Branch соответствует naming convention (`dev/*_YYYYMMDD*`)
- [ ] Conventional Commits format
- [ ] Co-Authored-By в каждом commit
- [ ] Commit messages детальны

**Testing:**
- [ ] Unit tests покрывают новый код (≥80% coverage)
- [ ] Security tests добавлены для XSS protection
- [ ] Manual testing completed
- [ ] No console errors

---

## Контактная информация для вопросов

**Документация:**
- Исходный план v1.0: `/docs/plans/table-optimization-plan.md`
- Security audit: `/docs/plans/table-optimization-plan-REVIEW.md`
- Текущий план v2.0: `/docs/plans/table-optimization-plan-v2.md`

**Связанные документы:**
- XSS Protection: `/docs/security/xss-prevention.md` (to be created)
- Table Research: `/docs/explore/table-implementations-research.md`
- Modal Architecture: `/docs/architecture/frontend/modal-architecture.md`
- Z-Index Layering: `/docs/architecture/frontend/z-index-layering.md`

---

**Подготовлено:** Claude Sonnet 4.5
**Дата:** 2026-02-10
**Версия:** 2.0 (обновлено с учётом security audit)
**Статус:** ✅ Ready for approval
