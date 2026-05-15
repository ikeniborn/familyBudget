import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../frontend/web/static/js/facts/integration/factsAPI', () => ({
    deleteFact: vi.fn(),
}));
vi.mock('../../../frontend/web/static/js/shared/confirmDialog', () => ({
    showConfirmDialog: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../../frontend/web/static/js/shared/toast', () => ({
    showToast: vi.fn(),
}));

import { deleteFact, consumeStatDecrement } from
    '../../../frontend/web/static/js/facts/operations/factsController';
import { deleteFact as apiDelete } from
    '../../../frontend/web/static/js/facts/integration/factsAPI';

describe('deleteFact stat guard', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <span id="stat-total">10</span>
            <tr data-id="42"><td></td></tr>
        `;
        (window as any).BudgetShared = {};
        vi.clearAllMocks();
    });

    it('marks statDecrementedIds before the API await resolves', async () => {
        let consumedDuringAwait: boolean | null = null;
        (apiDelete as any).mockImplementation(async () => {
            consumedDuringAwait = consumeStatDecrement(42);
        });

        await deleteFact(42);

        expect(consumedDuringAwait).toBe(true);
    });

    it('rolls back guard on API error', async () => {
        (apiDelete as any).mockRejectedValue(new Error('boom'));
        await deleteFact(43);
        expect(consumeStatDecrement(43)).toBe(false);
    });

    it('does not add guard when user cancels confirm', async () => {
        // showConfirmDialog in factsController prefers window.showConfirmDialog
        // when defined; override it to simulate user cancel.
        (window as any).showConfirmDialog = vi.fn().mockResolvedValue(false);

        await deleteFact(44);

        expect(consumeStatDecrement(44)).toBe(false);
        expect(apiDelete).not.toHaveBeenCalled();

        delete (window as any).showConfirmDialog;
    });
});
