# Dexie/WS Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate double Dexie writes and three production bugs (duplicate facts, disappearing facts, WS listener detachment) by centralizing all `budgetFacts` access behind a `FactRepository` and adding tab-origin deduplication in the WS handler.

**Architecture:** A `FactRepository` class encapsulates all reads/writes to `db.budgetFacts`. WS events carry a `tab_origin_id` field set by the backend from the `X-Tab-Id` request header; the WS handler skips the write when `tab_origin_id` matches the current tab's UUID. Errors in WS Dexie operations are logged (not silently swallowed) so they become visible without crashing the handler.

**Tech Stack:** TypeScript, Dexie.js 4.x, Vitest + fake-indexeddb (tests), FastAPI (backend), Python

---

## File Map

**New files:**
- `frontend/shared/db/dexie/utils/tabId.ts` — singleton tab UUID from `sessionStorage`
- `frontend/shared/db/dexie/repositories/FactRepository.ts` — all `budgetFacts` CRUD
- `frontend/shared/db/dexie/repositories/__tests__/FactRepository.test.ts` — unit tests

**Modified files:**
- `frontend/shared/db/dexie/types/fact.ts` — add `tab_origin_id: string | null` to `LocalBudgetFact`
- `frontend/shared/db/dexie/utils/apiMapper.ts` — default `tab_origin_id: null` in mapper
- `frontend/shared/db/dexie/core/database.ts` — Dexie schema v5: `created_at` index on `pendingOperations`
- `frontend/shared/db/dexie/operations/factOperations.ts` — `createFact` and `confirmPendingOperation` delegate to repo
- `frontend/shared/db/dexie/operations/bulkOperations.ts` — `bulkInsertFacts` delegates to repo
- `frontend/shared/db/dexie/index.ts` — export `factRepo` singleton
- `frontend/web/static/js/budget/budgetWSClient/types/events.ts` — add `tab_origin_id` to `FactCreatedEvent`/`FactUpdatedEvent`
- `frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts` — replace `upsertFactInDexie` with `factRepo.upsertFromServer`; fix silent catches
- `frontend/web/static/js/dashboard/features/modalFact/saveTransaction.ts` — use `factRepo.createFromAPI`; send `X-Tab-Id` header
- `frontend/web/static/js/dashboard/shared/utils/apiHelpers.ts` — add optional `additionalHeaders` param to `postAPI`
- `frontend/shared/db/dexie/DexieManager.ts` — `bulkSoftDeleteFacts` and `bulkPutFacts` delegate to repo
- `frontend/shared/db/dexie/operations/conflictOperations.ts` — direct `db.budgetFacts` access → repo
- `backend/app/api/v1/endpoints/facts.py` — extract `X-Tab-Id` header; add `tab_origin_id` to `response_data`
- `backend/app/api/v1/endpoints/budget_ws.py` — whitelist `tab_origin_id` in `_filter_fact_data`

---

## Task 1: Type Foundation

**Files:**
- Modify: `frontend/shared/db/dexie/types/fact.ts`
- Modify: `frontend/shared/db/dexie/utils/apiMapper.ts`
- Create: `frontend/shared/db/dexie/utils/tabId.ts`
- Modify: `frontend/web/static/js/budget/budgetWSClient/types/events.ts`

- [ ] **Step 1: Add `tab_origin_id` to `LocalBudgetFact`**

In `frontend/shared/db/dexie/types/fact.ts`, add the new field after `synced_at`:

```typescript
// Sync tracking
sync_status: 'synced' | 'pending' | 'conflict' | 'deleted';
sync_hash: string | null;
content_hash: string | null;

// Timestamps
created_at: Date;
updated_at: Date;
synced_at: Date | null;
tab_origin_id: string | null;  // ← ADD THIS LINE
```

- [ ] **Step 2: Update `mapAPIFactToLocal` to default `tab_origin_id`**

In `frontend/shared/db/dexie/utils/apiMapper.ts`, after the `content_hash` default (around line 127), add:

```typescript
  // 7. Set defaults for nullable fields (to match Dexie schema)
  if (!('sync_hash' in mapped)) {
    mapped.sync_hash = null;
  }
  if (!('content_hash' in mapped)) {
    mapped.content_hash = null;
  }
  if (!('tab_origin_id' in mapped)) {
    mapped.tab_origin_id = null;
  }

  return mapped as LocalBudgetFact;
```

- [ ] **Step 3: Create `tabId.ts`**

Create `frontend/shared/db/dexie/utils/tabId.ts`:

```typescript
const KEY = 'fb_tab_id';
let _id: string | null = null;

export function getTabId(): string {
  if (_id) return _id;
  _id = sessionStorage.getItem(KEY);
  if (!_id) {
    _id = crypto.randomUUID();
    sessionStorage.setItem(KEY, _id);
  }
  return _id;
}

export function resetTabId(): void {
  _id = null;
}
```

`resetTabId` is exported for use in tests only.

- [ ] **Step 4: Add `tab_origin_id` to WS event types**

In `frontend/web/static/js/budget/budgetWSClient/types/events.ts`, update `FactCreatedEvent`:

```typescript
export interface FactCreatedEvent {
  id: number;
  user_id: number;
  article_id: number;
  financial_center_id: number | null;
  cost_center_id: number | null;
  record_type: 'income' | 'expense';
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  transfer_id: number | null;
  sync_hash: string;
  created_at: string;
  updated_at: string;
  tab_origin_id?: string | null;  // ← ADD: set by backend from X-Tab-Id header
}
```

`FactUpdatedEvent extends FactCreatedEvent` so it inherits the field automatically.

- [ ] **Step 5: Run type-check**

```bash
npm run type-check
```

Expected: 0 errors. If errors appear, they will be in files that assign `LocalBudgetFact` without the new field — add `tab_origin_id: null` to those assignments.

- [ ] **Step 6: Commit**

```bash
git add frontend/shared/db/dexie/types/fact.ts \
        frontend/shared/db/dexie/utils/apiMapper.ts \
        frontend/shared/db/dexie/utils/tabId.ts \
        frontend/web/static/js/budget/budgetWSClient/types/events.ts
git commit -m "feat: add tab_origin_id to LocalBudgetFact and WS event types"
```

---

## Task 2: Create `FactRepository`

**Files:**
- Create: `frontend/shared/db/dexie/repositories/FactRepository.ts`
- Create: `frontend/shared/db/dexie/repositories/__tests__/FactRepository.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/shared/db/dexie/repositories/__tests__/FactRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeDatabase } from '../../core/database';
import { FactRepository } from '../FactRepository';
import { resetTabId } from '../../utils/tabId';
import type { LocalBudgetFact } from '../../types/fact';

const MY_TAB = 'tab-abc-123';
const OTHER_TAB = 'tab-xyz-789';

function mockSessionStorage(tabId: string) {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
    key === 'fb_tab_id' ? tabId : null
  );
}

const baseServerFact = {
  id: 42,
  user_id: 1,
  article_id: 5,
  financial_center_id: 2,
  cost_center_id: null,
  record_type: 'expense' as const,
  amount: 500,
  currency: 'RUB',
  date: '2026-05-06',
  description: 'Test purchase',
  transfer_id: null,
  sync_hash: 'abc',
  created_at: '2026-05-06T10:00:00Z',
  updated_at: '2026-05-06T10:00:00Z',
};

describe('FactRepository', () => {
  let repo: FactRepository;

  beforeEach(async () => {
    resetTabId();
    await initializeDatabase();
    repo = new FactRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('upsertFromServer', () => {
    it('returns skipped when tab_origin_id matches own tab', async () => {
      mockSessionStorage(MY_TAB);
      const result = await repo.upsertFromServer({
        ...baseServerFact,
        tab_origin_id: MY_TAB,
      });
      expect(result).toBe('skipped');
    });

    it('returns created when fact does not exist in Dexie', async () => {
      mockSessionStorage(MY_TAB);
      const result = await repo.upsertFromServer({
        ...baseServerFact,
        tab_origin_id: OTHER_TAB,
      });
      expect(result).toBe('created');
    });

    it('returns updated when fact already exists by server id', async () => {
      mockSessionStorage(MY_TAB);
      // First create via API (simulates own tab write)
      await repo.createFromAPI({ ...baseServerFact, tab_origin_id: MY_TAB });

      // Now WS event arrives from other tab with changed fields (fact_updated scenario)
      const result = await repo.upsertFromServer({
        ...baseServerFact,
        amount: 600,
        description: 'Updated description',
        tab_origin_id: OTHER_TAB,
      });
      expect(result).toBe('updated');

      // Verify ALL changed fields applied (not just amount)
      const { db } = await import('../../core/database');
      const fact = await db.budgetFacts.where('id').equals(42).first();
      expect(fact?.amount).toBe(600);
      expect(fact?.comment).toBe('Updated description'); // mapped from description
    });

    it('propagates errors (no silent swallowing)', async () => {
      mockSessionStorage(MY_TAB);
      // Pass null id to trigger Dexie error during lookup
      await expect(
        repo.upsertFromServer({ ...baseServerFact, id: null as any, tab_origin_id: OTHER_TAB })
      ).rejects.toThrow();
    });
  });

  describe('createFromAPI', () => {
    it('stores fact with tab_origin_id set to current tab', async () => {
      mockSessionStorage(MY_TAB);
      const fact = await repo.createFromAPI({ ...baseServerFact });
      expect(fact.tab_origin_id).toBe(MY_TAB);
      expect(fact.sync_status).toBe('synced');
      expect(fact.id).toBe(42);
    });
  });

  describe('confirmPending', () => {
    it('atomically replaces temp_id with server_id', async () => {
      mockSessionStorage(MY_TAB);
      // Create an offline fact first
      const temp_id = await createTestPendingFact(repo);

      await repo.confirmPending(temp_id, 99);

      // Verify using low-level db (not repo) to check state
      const { db } = await import('../../core/database');
      const fact = await db.budgetFacts.where('temp_id').equals(temp_id).first();
      expect(fact?.id).toBe(99);
      expect(fact?.sync_status).toBe('synced');

      const pendingOps = await db.pendingOperations.where('temp_id').equals(temp_id).toArray();
      expect(pendingOps).toHaveLength(0);
    });
  });
});

async function createTestPendingFact(repo: FactRepository): Promise<string> {
  return repo.createOffline({
    user_id: 1,
    article_id: 5,
    financial_center_id: 2,
    cost_center_id: null,
    date: '2026-05-06',
    amount: 300,
    record_type: 'fact',
    comment: null,
    transfer_group_id: null,
    is_transfer: false,
    sync_hash: null,
  });
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:coverage -- --reporter=verbose --run FactRepository
```

Expected: FAIL — `FactRepository` does not exist yet.

- [ ] **Step 3: Create `FactRepository.ts`**

Create `frontend/shared/db/dexie/repositories/FactRepository.ts`:

```typescript
import { db } from '../core/database';
import { logger } from '../utils/logger';
import { getTabId } from '../utils/tabId';
import { mapAPIFactToLocal } from '../utils/apiMapper';
import { generateUUID, calculateContentHash } from '../utils/hash';
import { validateFact } from '../utils/validation';
import type { LocalBudgetFact } from '../types/fact';

// Inline type — avoids cross-package import from shared/db into web/static
export interface WsFactPayload {
  id: number;
  user_id: number;
  article_id: number;
  financial_center_id: number | null;
  cost_center_id: number | null;
  record_type: string;
  amount: number;
  date: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  tab_origin_id?: string | null;
  [key: string]: unknown; // allow extra fields from API/WS
}

export type OfflineFactData = Omit<
  LocalBudgetFact,
  'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at' | 'tab_origin_id'
>;

const DEFAULT_MAX_RETRY_ATTEMPTS = 3;

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

export class FactRepository {
  /**
   * Online path: POST /api/facts succeeded → write to Dexie immediately.
   * Stamps tab_origin_id so the WS echo can be skipped.
   */
  async createFromAPI(serverFact: Record<string, any>): Promise<LocalBudgetFact> {
    const local = mapAPIFactToLocal({
      ...serverFact,
      tab_origin_id: getTabId(),
      sync_status: 'synced',
    });
    await db.budgetFacts.put(local);
    logger.debug('[FactRepo] createFromAPI', { id: local.id, tab_origin_id: local.tab_origin_id });
    return local;
  }

  /**
   * Offline path: create pending fact + pending operation in one atomic transaction.
   * Returns the temp_id of the created fact.
   */
  async createOffline(data: OfflineFactData): Promise<string> {
    validateFact({
      amount: data.amount,
      date: data.date,
      record_type: data.record_type,
      user_id: data.user_id,
      article_id: data.article_id,
      is_transfer: data.is_transfer,
    });

    const temp_id = generateUUID();
    const content_hash = await calculateContentHash(data as Record<string, unknown>);
    const now = new Date();

    const newFact: LocalBudgetFact = {
      id: null,
      temp_id,
      ...data,
      sync_status: 'pending',
      content_hash,
      created_at: now,
      updated_at: now,
      synced_at: null,
      tab_origin_id: null,
    };

    await db.transaction('rw', [db.budgetFacts, db.pendingOperations], async () => {
      await db.budgetFacts.add(newFact);
      try {
        await db.pendingOperations.add({
          operation: 'create',
          entity_type: 'fact',
          temp_id,
          server_id: null,
          payload: data as Record<string, unknown>,
          attempts: 0,
          max_attempts: DEFAULT_MAX_RETRY_ATTEMPTS,
          last_error: null,
          next_retry_at: null,
          content_hash,
          created_at: now,
          updated_at: now,
        } as any);
      } catch (error) {
        if ((error as Error).message.includes('content_hash')) {
          logger.warn('[FactRepo] Duplicate pending op (ignored)', { content_hash });
          return;
        }
        throw error;
      }
    });

    logger.info('[FactRepo] createOffline', { temp_id });
    return temp_id;
  }

  /**
   * WS event from server → idempotent upsert.
   * Returns 'skipped' if the event originated from this tab (avoids double write).
   * Errors propagate — caller decides whether to log or rethrow.
   */
  async upsertFromServer(serverFact: WsFactPayload): Promise<'created' | 'updated' | 'skipped'> {
    if (serverFact.tab_origin_id != null && serverFact.tab_origin_id === getTabId()) {
      logger.debug('[FactRepo] upsertFromServer skipped (own tab)', { id: serverFact.id });
      return 'skipped';
    }

    return db.transaction('rw', db.budgetFacts, async () => {
      const existing = await db.budgetFacts
        .where('id').equals(serverFact.id)
        .first();

      if (existing) {
        // Map ALL server fields (handles fact_updated: description, article_id, date, etc.)
        const mapped = mapAPIFactToLocal({ ...serverFact, tab_origin_id: null });
        await db.budgetFacts.where('temp_id').equals(existing.temp_id).modify({
          ...mapped,
          temp_id: existing.temp_id,          // preserve primary key
          sync_status: 'synced',
          synced_at: new Date(),
          tab_origin_id: existing.tab_origin_id, // preserve origin tracking
        });
        return 'updated';
      } else {
        const local = mapAPIFactToLocal({ ...serverFact, tab_origin_id: null });
        await db.budgetFacts.put(local);
        return 'created';
      }
    });
  }

  /**
   * Sync confirmed: replace temp_id with server_id atomically.
   * Removes the pending operation in the same transaction.
   */
  async confirmPending(temp_id: string, server_id: number): Promise<void> {
    await db.transaction('rw', [db.budgetFacts, db.pendingOperations], async () => {
      await db.budgetFacts.where('temp_id').equals(temp_id).modify({
        id: server_id,
        sync_status: 'synced',
        synced_at: new Date(),
      });
      await db.pendingOperations.where('temp_id').equals(temp_id).delete();
    });
    logger.info('[FactRepo] confirmPending', { temp_id, server_id });
  }

  /**
   * Bulk insert/upsert facts from server (initial sync, delta sync).
   * Uses batches of 1000 to avoid locking IndexedDB too long.
   */
  async bulkUpsert(facts: LocalBudgetFact[], onProgress?: (current: number, total: number) => void): Promise<void> {
    const BATCH_SIZE = 1000;
    for (let i = 0; i < facts.length; i += BATCH_SIZE) {
      const batch = facts.slice(i, i + BATCH_SIZE);
      await db.budgetFacts.bulkPut(batch);
      if (onProgress) onProgress(i + batch.length, facts.length);
    }
    logger.info('[FactRepo] bulkUpsert', { total: facts.length });
  }

  /**
   * Physical delete by temp_id (offline cancel, server-confirmed delete).
   */
  async remove(temp_id: string): Promise<void> {
    await db.budgetFacts.where('temp_id').equals(temp_id).delete();
    logger.debug('[FactRepo] remove', { temp_id });
  }
}

export const factRepo = new FactRepository();
```

- [ ] **Step 4: Run tests**

```bash
npm run test:coverage -- --reporter=verbose --run FactRepository
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/shared/db/dexie/repositories/
git commit -m "feat: add FactRepository with upsertFromServer, createFromAPI, confirmPending"
```

---

## Task 3: Dexie Schema v5 + Fix Sorted Query

**Files:**
- Modify: `frontend/shared/db/dexie/core/database.ts`
- Modify: `frontend/shared/db/dexie/operations/factOperations.ts`

- [ ] **Step 1: Add schema version 5 to `database.ts`**

In `frontend/shared/db/dexie/core/database.ts`, update the constant and add version 5 after version 4:

```typescript
const DEFAULT_SCHEMA_VERSION = 5;  // Changed from 4
```

After the `this.version(4).stores({});` block, add:

```typescript
    // Version 5: Add created_at index to pendingOperations for efficient sorted queries
    // Without this index, getPendingOperations() loads all ops and sorts in JS
    this.version(5).stores({
      pendingOperations: '++id, content_hash, entity_type, temp_id, server_id, next_retry_at, created_at'
    });
```

No `upgrade()` needed — Dexie adds the index automatically to existing rows.

- [ ] **Step 2: Fix `getPendingOperations` to use index**

In `frontend/shared/db/dexie/operations/factOperations.ts`, replace the `getPendingOperations` function body:

**Before:**
```typescript
export async function getPendingOperations(): Promise<LocalPendingOperation[]> {
  logger.debug('[Dexie] getPendingOperations');

  const now = new Date();
  const allOperations = await db.pendingOperations.toArray();
  // Sort by created_at in JS (field is not indexed in Dexie schema)
  allOperations.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Filter out operations that are waiting for backoff to expire
  const readyOperations = allOperations.filter(op => {
    if (!op.next_retry_at) return true;
    return new Date(op.next_retry_at) <= now;
  });

  logger.debug('[Dexie] Pending operations filtered', {
    total: allOperations.length,
    ready: readyOperations.length,
    waiting: allOperations.length - readyOperations.length
  });

  return readyOperations;
}
```

**After:**
```typescript
export async function getPendingOperations(): Promise<LocalPendingOperation[]> {
  logger.debug('[Dexie] getPendingOperations');

  const now = new Date();
  // Use created_at index (added in schema v5) — sort happens in IndexedDB, not JS
  const allOperations = await db.pendingOperations
    .orderBy('created_at')
    .toArray();

  const readyOperations = allOperations.filter(op => {
    if (!op.next_retry_at) return true;
    return new Date(op.next_retry_at) <= now;
  });

  logger.debug('[Dexie] Pending operations filtered', {
    total: allOperations.length,
    ready: readyOperations.length,
    waiting: allOperations.length - readyOperations.length
  });

  return readyOperations;
}
```

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/shared/db/dexie/core/database.ts \
        frontend/shared/db/dexie/operations/factOperations.ts
git commit -m "feat: add Dexie schema v5 with created_at index on pendingOperations"
```

---

## Task 4: Export `factRepo` + Update `postAPI`

**Files:**
- Modify: `frontend/shared/db/dexie/index.ts`
- Modify: `frontend/web/static/js/dashboard/shared/utils/apiHelpers.ts`

- [ ] **Step 1: Export `factRepo` from `index.ts`**

In `frontend/shared/db/dexie/index.ts`, add after the existing operations exports (around line 76):

```typescript
// Repository
export { FactRepository, factRepo } from './repositories/FactRepository';
export type { WsFactPayload, OfflineFactData } from './repositories/FactRepository';
```

Also add `getTabId` to utils exports:
```typescript
export { getTabId } from './utils/tabId';
```

- [ ] **Step 2: Add `additionalHeaders` to `postAPI`**

In `frontend/web/static/js/dashboard/shared/utils/apiHelpers.ts`, update `postAPI`:

```typescript
export async function postAPI<T = any>(
  url: string,
  data: any,
  context: string,
  additionalHeaders?: Record<string, string>  // ← ADD
): Promise<T> {
  debugLog(`[${context}] POST ${url}:`, data);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders,  // ← ADD
    },
    body: JSON.stringify(data)
  });
  // rest of function unchanged
```

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: 0 errors (new param is optional, no existing callers break).

- [ ] **Step 4: Commit**

```bash
git add frontend/shared/db/dexie/index.ts \
        frontend/web/static/js/dashboard/shared/utils/apiHelpers.ts
git commit -m "feat: export factRepo singleton; add additionalHeaders to postAPI"
```

---

## Task 5: Wire `saveTransaction.ts`

**Files:**
- Modify: `frontend/web/static/js/dashboard/features/modalFact/saveTransaction.ts`

- [ ] **Step 1: Replace direct Dexie write with `factRepo.createFromAPI`**

Replace the entire contents of `frontend/web/static/js/dashboard/features/modalFact/saveTransaction.ts`:

```typescript
/**
 * Save transaction operation for modal fact
 *
 * @module modalFact/saveTransaction
 */

import { refreshUIAfterFactSave } from '../../shared/utils/uiRefresh';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';
import { isDexieActive, factRepo, getTabId } from '@db/dexie';
import { getCurrentUserId } from '@shared/utils/userHelpers';

/**
 * Save fact transaction
 */
export async function saveFactTransaction(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  const displayDate = formData.get('fact_date') as string;
  const apiDate = window.BudgetShared?.DateFormatter.formatForAPI(displayDate);

  if (!apiDate) {
    throw new Error('Failed to convert date to API format');
  }

  const data = {
    record_type: 'fact',
    fact_date: apiDate,
    financial_center_id: parseIntOrNull(formData.get('financial_center_id'))!,
    article_id: parseIntOrNull(formData.get('article_id'))!,
    cost_center_id: parseIntOrNull(formData.get('cost_center_id')),
    amount: Number.parseInt(formData.get('amount') as string, 10),
    description: formData.get('description') || null
  };

  try {
    // Send X-Tab-Id header so the backend can echo it in the WS broadcast,
    // allowing this tab's WS handler to skip the redundant Dexie write.
    const responseData = await postAPI<any>('/api/v1/facts', data, 'SaveFactModal', {
      'X-Tab-Id': getTabId(),
    });

    if (isDexieActive()) {
      // Single Dexie write via repository — WS broadcast will be skipped for this tab
      await factRepo.createFromAPI(responseData);
    }

    await refreshUIAfterFactSave();
  } catch (error) {
    const isOffline = !navigator.onLine
      || (error instanceof TypeError && /fetch/i.test(error.message));

    if (isOffline && isDexieActive()) {
      try {
        const userId = await getCurrentUserId();
        await factRepo.createOffline({
          user_id: userId,
          article_id: data.article_id,
          financial_center_id: data.financial_center_id,
          cost_center_id: data.cost_center_id ?? null,
          date: data.fact_date,
          amount: data.amount,
          record_type: 'fact',
          comment: data.description as string | null,
          transfer_group_id: null,
          is_transfer: false,
          sync_hash: null,
        });
        if (typeof (window as any).showToast === 'function') {
          (window as any).showToast('Сохранено offline — отправится при подключении', 'info');
        }
        await refreshUIAfterFactSave();
        return;
      } catch (offlineError) {
        console.error('[SaveFactModal] Failed to save offline:', offlineError);
      }
    }

    throw error;
  }
}
```

- [ ] **Step 2: Run type-check**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/web/static/js/dashboard/features/modalFact/saveTransaction.ts
git commit -m "feat: saveTransaction uses factRepo.createFromAPI with X-Tab-Id header"
```

---

## Task 6: Wire `eventHandlers.ts`

**Files:**
- Modify: `frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts`

- [ ] **Step 1: Replace `upsertFactInDexie` + fix silent catches**

In `frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts`:

**Replace the import block** — add `factRepo` and `logger`:

```typescript
import { notifyHandlers } from './eventRegistration';
import { db, factRepo, logger as dbLogger } from '@db/dexie';
import type {
  FactCreatedEvent,
  // ... rest unchanged
```

**Replace the entire `upsertFactInDexie` function** (lines 63-83):

```typescript
async function upsertFactInDexie(fact: FactCreatedEvent): Promise<void> {
  try {
    await factRepo.upsertFromServer(fact);
  } catch (error) {
    dbLogger.error('[WS] upsertFromServer failed', { factId: fact.id, error });
    // No re-throw: WS handler must not crash due to Dexie errors
  }
}
```

**Replace `hardDeleteFactInDexie`** — keep the pattern but add logging:

```typescript
async function hardDeleteFactInDexie(factId: number): Promise<void> {
  try {
    await db.budgetFacts.where('id').equals(factId).delete();
  } catch (error) {
    dbLogger.error('[WS] hardDeleteFactInDexie failed', { factId, error });
  }
}
```

- [ ] **Step 2: Run type-check**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts
git commit -m "fix: replace upsertFactInDexie with factRepo.upsertFromServer; log WS Dexie errors"
```

---

## Task 7: Migrate Remaining Consumers

**Files:**
- Modify: `frontend/shared/db/dexie/operations/factOperations.ts`
- Modify: `frontend/shared/db/dexie/operations/bulkOperations.ts`
- Modify: `frontend/shared/db/dexie/DexieManager.ts`
- Modify: `frontend/shared/db/dexie/operations/conflictOperations.ts`
- Modify: `frontend/shared/db/dexie/operations/factSync.ts`

- [ ] **Step 1: Delegate `createFact` to repo in `factOperations.ts`**

In `frontend/shared/db/dexie/operations/factOperations.ts`, add import for `factRepo` at the top:

```typescript
import { factRepo } from '../repositories/FactRepository';
```

Replace the body of `createFact` (keep the same signature for backward compatibility):

```typescript
export async function createFact(
  fact: Omit<LocalBudgetFact, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at' | 'tab_origin_id'>
): Promise<string> {
  return factRepo.createOffline(fact);
}
```

- [ ] **Step 2: Delegate `confirmPendingOperation` to repo**

In the same `factOperations.ts`, replace the body of `confirmPendingOperation`:

```typescript
export async function confirmPendingOperation(
  temp_id: string,
  server_id: number
): Promise<void> {
  return factRepo.confirmPending(temp_id, server_id);
}
```

(Keep `addPendingOperation`, `getPendingOperations`, `failPendingOperation` unchanged — they are not being moved to the repo in this iteration.)

- [ ] **Step 3: Delegate `bulkInsertFacts` to repo**

In `frontend/shared/db/dexie/operations/bulkOperations.ts`, add import:

```typescript
import { factRepo } from '../repositories/FactRepository';
```

Replace the body of `bulkInsertFacts`:

```typescript
export async function bulkInsertFacts(
  facts: LocalBudgetFact[],
  onProgress?: BulkProgressCallback
): Promise<void> {
  logger.info('[bulkOps] bulkInsertFacts', { count: facts.length });
  await factRepo.bulkUpsert(facts, onProgress);
  logger.info('[bulkOps] ✅ Bulk insert complete', { total: facts.length });
}
```

- [ ] **Step 4: Update `DexieManager.ts`**

In `frontend/shared/db/dexie/DexieManager.ts`, find `bulkInsertFacts` (around line 447). Replace:

```typescript
  async bulkInsertFacts(facts: LocalBudgetFact[], onProgress?: ProgressCallback): Promise<void> {
    logger.info('[DexieManager] bulkInsertFacts', { count: facts.length });
    await factRepo.bulkUpsert(facts, onProgress);
    logger.info('[DexieManager] ✅ Bulk insert complete', { total: facts.length });
  }
```

Add import at the top of DexieManager.ts (after existing imports):
```typescript
import { factRepo } from './repositories/FactRepository';
```

Leave `bulkSoftDeleteFacts` unchanged — it performs soft deletes (status updates), not creates, and is not part of the double-write problem.

- [ ] **Step 5: Update `conflictOperations.ts`**

In `frontend/shared/db/dexie/operations/conflictOperations.ts`, find the single `db.budgetFacts` access (around line 180). It reads `synced` count for diagnostics — this is a read, not a write, and is not part of the double-write problem. Leave it as-is.

- [ ] **Step 6: Verify `factSync.ts` calls `confirmPendingOperation` from `factOperations`**

`factSync.ts` already imports and calls `confirmPendingOperation` from `factOperations.ts`. Since we delegated that function to the repo in Step 2, `factSync.ts` does not need changes — it gets the new behavior automatically.

- [ ] **Step 7: Run type-check and tests**

```bash
npm run type-check && npm run test:coverage -- --run
```

Expected: 0 type errors, all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/shared/db/dexie/operations/factOperations.ts \
        frontend/shared/db/dexie/operations/bulkOperations.ts \
        frontend/shared/db/dexie/DexieManager.ts
git commit -m "refactor: delegate createFact, confirmPending, bulkInsertFacts to FactRepository"
```

---

## Task 8: Backend — `X-Tab-Id` → `tab_origin_id` in WS Broadcast

**Files:**
- Modify: `backend/app/api/v1/endpoints/facts.py`
- Modify: `backend/app/api/v1/endpoints/budget_ws.py`

- [ ] **Step 1: Extract `X-Tab-Id` header in `create_fact`**

In `backend/app/api/v1/endpoints/facts.py`, find the existing FastAPI import line (it contains `APIRouter`, `Depends`, `HTTPException`, etc.) and add `Header` to it. Do NOT add a separate `from fastapi import Header` line — merge into the existing import:

```python
# Before:
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
# After:
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
```

Then update the `create_fact` function signature (line ~180):

async def create_fact(
    fact_data: FactCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    x_tab_id: str | None = Header(default=None),  # ← ADD
) -> BudgetFact:
```

Then find where `response_data` is built (around line 480) and add `tab_origin_id` before the WS broadcast:

```python
    response_data = {
        "id": fact.id,
        # ... existing fields unchanged ...
        "created_at": fact.created_at,
        "updated_at": fact.updated_at,
        "tab_origin_id": x_tab_id,  # ← ADD (None if header not sent)
    }

    # WebSocket Broadcast: Notify all connected clients about new fact
    try:
        ws = _get_budget_ws_broadcast()
        if fact.record_type == "plan":
            await ws.broadcast_plan_created(response_data)
        else:
            await ws.broadcast_fact_created(response_data)
```

- [ ] **Step 2: Add `tab_origin_id` to `SAFE_FACT_FIELDS`**

In `backend/app/api/v1/endpoints/budget_ws.py`, find `SAFE_FACT_FIELDS` (around line 918):

```python
SAFE_FACT_FIELDS = {
    "id", "article_id", "financial_center_id", "cost_center_id",
    "amount", "fact_date", "description", "record_type", "transfer_id",
}
```

Replace with:

```python
SAFE_FACT_FIELDS = {
    "id", "article_id", "financial_center_id", "cost_center_id",
    "amount", "fact_date", "description", "record_type", "transfer_id",
    "tab_origin_id",  # ← ADD: echoed from X-Tab-Id header for client-side dedup
}
```

`_filter_fact_data` uses this set — no changes to the function itself needed.

- [ ] **Step 3: Verify `broadcast_plan_created` also gets `tab_origin_id`**

Plans use `broadcast_plan_created` which calls the same `_filter_fact_data`. No extra change needed — the whitelist addition covers both.

- [ ] **Step 4: Run backend syntax check**

```bash
cd /home/ikeniborn/Documents/Project/familyBudget && python -m py_compile backend/app/api/v1/endpoints/facts.py && python -m py_compile backend/app/api/v1/endpoints/budget_ws.py && echo "OK"
```

Expected: `OK` with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/endpoints/facts.py \
        backend/app/api/v1/endpoints/budget_ws.py
git commit -m "feat: pass X-Tab-Id through WS broadcast as tab_origin_id"
```

---

## Task 9: Build + Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Full type-check**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 2: Full test suite**

```bash
npm run test:coverage -- --run
```

Expected: All tests PASS. Coverage for `FactRepository.ts` should be >80%.

- [ ] **Step 3: Build bundles**

```bash
npm run build
```

Expected: Build succeeds, no TypeScript errors, no missing exports.

- [ ] **Step 4: Verify no direct `db.budgetFacts` writes remain outside repository**

```bash
grep -rn "db\.budgetFacts\.\(put\|add\|bulkPut\|bulkAdd\|modify\|delete\)" \
  frontend/ --include="*.ts" \
  | grep -v "FactRepository.ts" \
  | grep -v "__tests__" \
  | grep -v "node_modules"
```

Expected output: only reads (`where`, `count`, `toArray`) from `conflictOperations.ts` and `bulkOperations.ts` (the diagnostic `where('sync_status')` reads). No write operations (`put`, `add`, `modify`, `delete`) outside `FactRepository.ts`.

If writes remain, migrate them to the appropriate repo method before committing.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify Dexie/WS optimization complete — all budgetFacts writes via FactRepository"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `tab_origin_id` added to `LocalBudgetFact` (Task 1)
- ✅ `tabId.ts` singleton (Task 1)
- ✅ `FactRepository` with 6 methods (Task 2)
- ✅ `upsertFromServer` skips own-tab events (Task 2)
- ✅ WS errors logged, not swallowed (Task 6)
- ✅ `createFromAPI` stamps `tab_origin_id` (Task 2, Task 5)
- ✅ `createOffline` atomic transaction (Task 2)
- ✅ `confirmPending` atomic transaction (Task 2)
- ✅ `bulkUpsert` (Task 2)
- ✅ Schema v5 `created_at` index (Task 3)
- ✅ `getPendingOperations` uses indexed sort (Task 3)
- ✅ `saveTransaction.ts` sends `X-Tab-Id`, uses repo (Task 5)
- ✅ `eventHandlers.ts` uses repo, visible errors (Task 6)
- ✅ `factOperations.ts` delegates to repo (Task 7)
- ✅ `bulkOperations.ts` delegates to repo (Task 7)
- ✅ Backend `X-Tab-Id` extraction + WS whitelist (Task 8)
- ✅ `DexieManager.ts` `bulkPutFacts` delegates to repo (Task 7)

**Out-of-scope confirmed excluded:**
- `fact_updated`/`fact_deleted` tab-origin dedup (follow-up)
- Shopping list operations
- Conflict resolution changes
