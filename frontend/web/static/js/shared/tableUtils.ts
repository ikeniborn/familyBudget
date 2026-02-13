/**
 * Shared utilities for table rendering across Facts/Plans/Dashboard
 *
 * SECURITY: All methods handling user input include XSS protection
 *
 * @module shared/tableUtils
 * @version 1.0.0
 */

import { escapeHtml } from './htmlSanitizer';

// Import BudgetShared from global window
declare const BudgetShared: {
  DateFormatter: {
    formatForDisplay: (isoDate: string) => string;
  };
};

// ============================================================================
// TypeScript Interfaces
// ============================================================================

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

// ============================================================================
// TableFormatters Class
// ============================================================================

export class TableFormatters {
  /**
   * Get color class for article type
   * SAFE: No user input, returns predefined CSS classes
   *
   * Eliminates 3 duplicate implementations (Dashboard, Facts, Plans)
   *
   * @param articleType - Article type (expense/income/debit/credit)
   * @param variant - Color variant (text or amount)
   * @returns CSS class name
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

// ============================================================================
// TableRenderer Class
// ============================================================================

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
