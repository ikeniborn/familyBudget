# Frontend Code Patterns

## Window Exports {#window-exports}

HTML `onclick="fn()"` calls only work if `fn` exists on `window`. ALL public functions must go through `adapters/windowExports.ts`. Never assign directly to `window` in other files.

```typescript
// adapters/windowExports.ts
import { deleteFact, showEditModal } from '../operations/factsController';
import { applyFiltersAction, resetFiltersAction } from '../operations/filterOperations';

export function setupWindowExports(): void {
    // Simple functions — directly on window
    window.applyFilters = () => applyFiltersAction();
    window.resetFilters = () => resetFiltersAction();

    // Namespaced object for feature-specific methods
    window.FactsManager = {
        deleteFact: (id: number) => deleteFact(id),
        showEditModal: (id: number) => showEditModal(id),
    };
}
```

Declare types in `types/globals.d.ts`:
```typescript
declare global {
    interface Window {
        applyFilters: () => void;
        resetFilters: () => void;
        FactsManager: {
            deleteFact: (id: number) => void;
            showEditModal: (id: number) => void;
        };
    }
}
```

Call `setupWindowExports()` at the **top of `index.ts`**, before DOMContentLoaded — onclick may fire before DOM is ready.

In templates:
```html
<button onclick="applyFilters()">Apply</button>
<button onclick="FactsManager.showEditModal({{ fact.id }})">Edit</button>
```

---

## Event Delegation {#event-delegation}

Prefer `data-action` for buttons that don't pass dynamic parameters — avoids onclick proliferation.

```html
<!-- Template -->
<button data-action="apply-filters" class="btn btn-primary">Apply</button>
<button data-action="reset-filters" class="btn btn-ghost">Reset</button>
<button data-action="batch-delete" disabled>Delete Selected</button>
```

```typescript
// adapters/eventDelegation.ts
import { applyFiltersAction, resetFiltersAction } from '../operations/filterOperations';
import { batchDeleteAction } from '../operations/factsController';

export function setupEventDelegation(): void {
    document.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement)
            .closest('[data-action]')
            ?.getAttribute('data-action');

        switch (action) {
            case 'apply-filters': applyFiltersAction(); break;
            case 'reset-filters': resetFiltersAction(); break;
            case 'batch-delete': batchDeleteAction(); break;
        }
    });
}
```

Rule of thumb: use `data-action` when the element has no dynamic parameters. Use `onclick="fn(id)"` only when passing a row-specific value from the template.

---

## State Management {#state}

Single mutable module-level object — no global variables scattered across files.

```typescript
// core/FactsState.ts
export interface FactsState {
    facts: Transaction[];
    filters: FilterState;
    pagination: { page: number; total: number; pageSize: number };
    selectedIds: Set<number>;
    isLoading: boolean;
}

export interface FilterState {
    dateFrom: string | null;
    dateTo: string | null;
    userId: number | null;
    articleId: number | null;
}

export function createInitialState(): FactsState {
    return {
        facts: [],
        filters: { dateFrom: null, dateTo: null, userId: null, articleId: null },
        pagination: { page: 1, total: 0, pageSize: 20 },
        selectedIds: new Set(),
        isLoading: false,
    };
}
```

```typescript
// core/stateManager.ts
import { FactsState, createInitialState } from './FactsState';

let state: FactsState = createInitialState();

export function getState(): FactsState { return state; }

export function updateState(updates: Partial<FactsState>): void {
    state = { ...state, ...updates };
}

export function initializeState(): void {
    state = createInitialState();
}
```

---

## Initialization Order (index.ts) {#init}

Order matters — window exports must be set up before DOMContentLoaded because onclick can fire earlier.

```typescript
// index.ts
import { setupWindowExports } from './adapters/windowExports';
import { setupEventDelegation } from './adapters/eventDelegation';
import { initializeState } from './core/stateManager';
import { registerWSHandlers } from './integration/wsEventHandlers';
import { loadFacts } from './operations/factsController';
import { initDropdowns } from './features/dropdowns';

// 1. Window exports FIRST
setupWindowExports();

document.addEventListener('DOMContentLoaded', async () => {
    // 2. State
    initializeState();

    // 3. WebSocket handlers (register before load so events aren't missed)
    registerWSHandlers();

    // 4. Event delegation
    setupEventDelegation();

    // 5. UI init (dropdowns, datepickers, etc.)
    await initDropdowns();

    // 6. Load initial data
    await loadFacts();
});
```

---

## WebSocket Handlers {#websocket}

WebSocket client lives at `window.budgetWSClient` (loaded by the `budget` bundle on every page).

```typescript
// integration/wsEventHandlers.ts
import { getState, updateState } from '../core/stateManager';
import { renderFactsTable } from '../operations/factsController';
import type { Transaction } from '../types/models';

export function registerWSHandlers(): void {
    const wsClient = (window as any).budgetWSClient;
    if (!wsClient) {
        console.warn('budgetWSClient not available');
        return;
    }

    wsClient.on('fact_created', (data: { fact: Transaction }) => {
        const { facts } = getState();
        updateState({ facts: [data.fact, ...facts] });
        renderFactsTable();
    });

    wsClient.on('fact_updated', (data: { fact: Transaction }) => {
        updateState({
            facts: getState().facts.map(f =>
                f.id === data.fact.id ? data.fact : f
            ),
        });
        renderFactsTable();
    });

    wsClient.on('fact_deleted', (data: { id: number }) => {
        updateState({
            facts: getState().facts.filter(f => f.id !== data.id),
        });
        renderFactsTable();
    });
}
```

Register handlers **before** loading initial data — the server may emit events during the fetch.

---

## API Calls {#api}

```typescript
// integration/factsAPI.ts
import type { FilterState } from '../core/FactsState';
import type { Transaction, PaginatedResponse } from '../types/models';

export async function fetchFacts(
    filters: FilterState,
    page: number,
    pageSize: number
): Promise<PaginatedResponse<Transaction>> {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters.dateTo) params.append('date_to', filters.dateTo);
    if (filters.userId) params.append('user_id', String(filters.userId));
    params.append('page', String(page));
    params.append('page_size', String(pageSize));

    const resp = await fetch(`/api/v1/facts?${params}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    return resp.json();
}

export async function deleteFact(id: number): Promise<void> {
    const resp = await fetch(`/api/v1/facts/${id}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
}
```

---

## Table Rendering Pattern {#table}

Render dynamic content by setting `innerHTML` on a container element. Never use React/Vue — this is vanilla JS with Jinja2.

```typescript
// operations/factsController.ts
import { getState, updateState } from '../core/stateManager';
import { fetchFacts } from '../integration/factsAPI';

export async function loadFacts(): Promise<void> {
    updateState({ isLoading: true });
    renderLoadingState();

    try {
        const { filters, pagination } = getState();
        const result = await fetchFacts(filters, pagination.page, pagination.pageSize);
        updateState({
            facts: result.items,
            pagination: { ...pagination, total: result.total },
            isLoading: false,
        });
        renderFactsTable();
    } catch (err) {
        updateState({ isLoading: false });
        renderErrorState(err instanceof Error ? err.message : 'Unknown error');
    }
}

export function renderFactsTable(): void {
    const { facts } = getState();
    const container = document.getElementById('facts-table-container');
    if (!container) return;

    if (facts.length === 0) {
        container.innerHTML = '<p class="text-center py-8 text-base-content/50">No records</p>';
        return;
    }

    container.innerHTML = `
        <table class="table table-zebra w-full">
            <thead>
                <tr>
                    <th><input type="checkbox" id="select-all" class="checkbox" /></th>
                    <th>Date</th><th>Amount</th><th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${facts.map(fact => `
                    <tr>
                        <td><input type="checkbox" value="${fact.id}" class="checkbox fact-checkbox" /></td>
                        <td>${fact.date}</td>
                        <td>${fact.amount}</td>
                        <td>
                            <button onclick="FactsManager.showEditModal(${fact.id})"
                                class="btn btn-xs btn-ghost">Edit</button>
                            <button onclick="FactsManager.deleteFact(${fact.id})"
                                class="btn btn-xs btn-error btn-ghost">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}
```
