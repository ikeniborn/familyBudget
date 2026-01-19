/**
 * Facts Manager - Stats Rendering
 *
 * Client-side rendering for facts statistics widget.
 * NOTE: Will be replaced by HTMX server-side rendering in Phase 2.
 *
 * Phase 1.5: Extract Rendering (Temporary Client-Side)
 * Extracted from: frontend/web/templates/facts.html (lines 1542-1548)
 */

import { getTotalFacts } from '../core/stateManager';
import { getCurrentPageRange } from '../operations/paginationOperations';

// ============================================================================
// Stats UI Update
// ============================================================================

/**
 * Update statistics widget
 * Shows total facts count and current page range
 */
export function updateStats(): void {
    const totalFacts = getTotalFacts();
    const { start, end, total } = getCurrentPageRange();

    // Update total count
    const statTotal = document.getElementById('stat-total');
    if (statTotal) {
        statTotal.textContent = String(totalFacts);
    }

    // Update page info
    const statPageInfo = document.getElementById('stat-page-info');
    if (statPageInfo) {
        if (totalFacts > 0) {
            statPageInfo.textContent = `${start}-${end} из ${total}`;
        } else {
            statPageInfo.textContent = '0-0 из 0';
        }
    }
}
