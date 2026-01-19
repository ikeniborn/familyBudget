/**
 * Facts Manager - Facts Table Rendering
 *
 * Client-side rendering for facts table (desktop + mobile).
 * NOTE: Will be replaced by HTMX server-side rendering in Phase 2.
 *
 * Phase 1.5: Extract Rendering (Temporary Client-Side)
 * Extracted from: frontend/web/templates/facts.html (lines 1371-1516)
 */

import type { BudgetFact } from '../types/models';
import { getBudgetShared } from '../types/dependencies';
import { clearSelection } from '../core/stateManager';

// ============================================================================
// Rendering Logic
// ============================================================================

/**
 * Render facts table (desktop + mobile)
 * Clears selection and updates batch delete button
 */
export function renderFactsTable(facts: BudgetFact[]): void {
    const container = document.getElementById('facts-table-container');
    if (!container) {
        console.warn('[FactsTable] Container not found');
        return;
    }

    // Clear selection
    clearSelection();

    // Empty state
    if (facts.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-base-content/60">📊 Факты не найдены. Измените фильтры или добавьте новые факты.</div>';
        return;
    }

    // Render desktop table + mobile list
    container.innerHTML = renderDesktopTable(facts) + renderMobileList(facts);
}

/**
 * Render desktop table HTML
 */
function renderDesktopTable(facts: BudgetFact[]): string {
    const BudgetShared = getBudgetShared();

    let html = `
        <div class="facts-desktop-table overflow-x-auto hidden md:block">
            <table class="table table-zebra table-sm">
                <thead>
                    <tr>
                        <th><input type="checkbox" class="checkbox checkbox-sm" id="select-all-checkbox" onchange="window.toggleSelectAll(this)"></th>
                        <th>ID</th>
                        <th>📅 Дата</th>
                        <th>🏦 Счет</th>
                        <th>💼 МЗ</th>
                        <th>📁 Категория</th>
                        <th>💵 Сумма</th>
                        <th>📝 Описание</th>
                        <th>👤 Пользователь</th>
                        <th class="text-center" title="Создано offline">☁️</th>
                        <th>⚙️ Действия</th>
                    </tr>
                </thead>
                <tbody>
    `;

    facts.forEach(fact => {
        const amountClass = getArticleTypeColor(fact.article_type) + ' font-bold';
        const description = fact.description || '—';
        const descriptionTruncated = truncateText(description, 30);
        const financialCenter = fact.financial_center_name || '—';
        const costCenter = fact.cost_center_name || '—';
        const formattedDate = BudgetShared.DateFormatter.formatForDisplay(fact.fact_date);

        html += `
            <tr data-fact-id="${fact.id}">
                <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" value="${fact.id}" onchange="window.updateBatchDeleteButton()"></td>
                <td><code class="badge badge-ghost">${fact.id}</code></td>
                <td>${formattedDate}</td>
                <td class="max-w-xs truncate" title="${financialCenter}">${financialCenter}</td>
                <td class="max-w-xs truncate" title="${costCenter}">${costCenter}</td>
                <td>
                    <span class="${getArticleTypeColor(fact.article_type)}">${fact.article_name || '—'}</span>
                    ${(fact as any).transfer_id ? `<span class="badge badge-info badge-sm ml-2" title="Перевод ID: ${(fact as any).transfer_id}">🔁 Перевод</span>` : ''}
                </td>
                <td class="${amountClass}">${formatDesktopAmount(fact.amount, fact.record_type)}</td>
                <td class="max-w-xs truncate" title="${description}">${descriptionTruncated}</td>
                <td>${fact.user_name || '—'}</td>
                <td class="text-center" title="${(fact as any).is_offline_sync ? 'Создано offline' : ''}">${(fact as any).is_offline_sync ? '☁️' : ''}</td>
                <td>
                    <div class="flex gap-1">
                        <button class="btn btn-xs btn-primary gap-1" onclick="window.showEditModal(${fact.id})">✏️</button>
                        <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" data-fact-id="${fact.id}" onclick="event.stopPropagation(); window.deleteFact(${fact.id})" title="Удалить">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}

/**
 * Render mobile list HTML
 */
function renderMobileList(facts: BudgetFact[]): string {
    const BudgetShared = getBudgetShared();

    let html = `<div class="facts-mobile-list divide-y divide-base-200 block md:hidden">`;

    facts.forEach(fact => {
        const mobileAmountClass = getMobileAmountClass(fact.record_type);
        const mobileAmount = formatMobileAmount(fact.amount, fact.record_type);
        const transferBadge = (fact as any).transfer_id ? '🔁' : '';
        const offlineIcon = (fact as any).is_offline_sync ? '<span class="text-xs" title="Создано offline">☁️</span>' : '';
        const formattedDate = BudgetShared.DateFormatter.formatForDisplay(fact.fact_date);
        const shortDate = formattedDate.slice(0, 5); // DD.MM

        html += `
            <div class="transaction-item p-4" data-fact-id="${fact.id}" onclick="window.showEditModal(${fact.id})">
                <div class="flex justify-between items-start mb-1">
                    <span class="font-semibold">${fact.article_name || '—'}</span>
                    <span class="${mobileAmountClass}">${mobileAmount} ${transferBadge} ${offlineIcon}</span>
                </div>
                <div class="text-sm text-base-content/60">
                    ${shortDate} • ${fact.financial_center_name || '—'}
                    ${fact.description ? ` • ${truncateText(fact.description, 40)}` : ''}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    return html;
}

// ============================================================================
// Helpers
// ============================================================================

function getArticleTypeColor(type: string): string {
    const colorMap: Record<string, string> = {
        'expense': 'text-error',      // Расходы - красный
        'income': 'text-success',     // Доходы - зелёный
        'debit': 'text-info',         // Списание - синий
        'credit': 'text-warning'      // Пополнение - оранжевый
    };
    return colorMap[type] || '';
}

function getMobileAmountClass(type: string): string {
    const classMap: Record<string, string> = {
        'spend': 'text-error font-bold',
        'income': 'text-success font-bold',
        'open': 'text-info font-bold',
        'close': 'text-warning font-bold'
    };
    return classMap[type] || 'font-bold';
}

function formatMobileAmount(amount: number, type: string): string {
    const sign = (type === 'spend' || type === 'open') ? '-' : '+';
    return `${sign}${amount.toFixed(2)}`;
}

function formatDesktopAmount(amount: number, type: string): string {
    const sign = (type === 'spend' || type === 'open') ? '-' : '+';
    return `${sign}${amount.toFixed(2)}`;
}

function truncateText(text: string, maxLength: number = 30): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}
