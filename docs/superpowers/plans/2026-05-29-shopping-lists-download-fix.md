# Shopping Lists Download Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `/lists` bootstrap pull failure (`❌ Shopping lists download failed: i`) by aligning frontend `downloadShoppingLists` with backend shared-references API contract and current Dexie schema (v3).

**Architecture:** Backend `ShoppingListCardResponse` gains `creator_id` + `is_active` (additive). Frontend `downloadShoppingLists` rewritten: drops `userId` parameter, unwraps `payload.shopping_lists`, maps server cards into `LocalShoppingList` with `sync_status='synced'`, replaces only synced rows (preserves offline `pending`/`deleted` edits). Dead exports (`downloadShoppingListItems`, `fullShoppingSync`) removed. Single caller in `stateManager.ts` updated.

**Tech Stack:** FastAPI 0.121.2 / Pydantic v2 (backend) · TypeScript / Dexie 4 (frontend) · pytest (integration) · Vitest + happy-dom + MSW (unit) · Playwright (E2E).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `backend/app/schemas/shopping_list.py` | Modify | Extend `ShoppingListCardResponse` with `creator_id` + `is_active` |
| `backend/app/services/shopping_list_service.py` | Modify | Include `is_active` in stats dict (`creator_id` already present) |
| `frontend/shared/db/dexie/types/shopping.ts` | Modify | Add `ServerShoppingListCard` type mirroring backend |
| `frontend/shared/db/dexie/operations/shoppingSync.ts` | Modify | Rewrite `downloadShoppingLists` (no `userId`); delete `downloadShoppingListItems` + `fullShoppingSync` |
| `frontend/web/static/js/lists/listsManager/core/stateManager.ts` | Modify | Update caller (drop `userId` gate) |
| `tests/integration/backend/test_shopping_lists_list.py` | Create | Backend assertions on response card fields |
| `tests/unit/dashboard/dexieShoppingSync.test.ts` | Create | Frontend unit tests for `downloadShoppingLists` |
| `tests/e2e/webapp/test_lists_bootstrap_pull.spec.ts` | Create | E2E: bootstrap pull network + console clean |
| `VERSION` | Modify | `0.6.166` → `0.6.167` |

---

### Task 1: Backend — extend ShoppingListCardResponse

**Files:**
- Modify: `backend/app/schemas/shopping_list.py:197-254`
- Test: `tests/integration/backend/test_shopping_lists_list.py` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/integration/backend/test_shopping_lists_list.py`:

```python
"""
Integration tests for GET /api/v1/shopping-lists.

Validates response wrapper shape and per-card fields required by the
frontend Dexie sync path. Regression guard for the 2026-05-29 bootstrap
pull bug where Card lacked creator_id + is_active.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.shopping_list import ShoppingList
from backend.app.models.user import User


@pytest.mark.integration
@pytest.mark.backend
class TestShoppingListsListResponse:
    """Test GET /api/v1/shopping-lists payload contract."""

    @pytest.fixture
    async def two_lists(self, db_session: AsyncSession, test_user: User):
        lists = [
            ShoppingList(
                creator_id=test_user.id,
                name=f"List {i}",
                description=None,
                is_active=True,
            )
            for i in range(2)
        ]
        for sl in lists:
            db_session.add(sl)
        await db_session.commit()
        for sl in lists:
            await db_session.refresh(sl)
        return lists

    async def test_response_has_wrapper_shape(
        self,
        authenticated_client: AsyncClient,
        two_lists,
    ):
        """Response is { shopping_lists, total, limit, offset } not a bare array."""
        response = await authenticated_client.get("/api/v1/shopping-lists")
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body, dict)
        assert "shopping_lists" in body
        assert "total" in body
        assert "limit" in body
        assert "offset" in body
        assert isinstance(body["shopping_lists"], list)
        assert body["total"] >= 2

    async def test_card_contains_creator_id_and_is_active(
        self,
        authenticated_client: AsyncClient,
        two_lists,
        test_user: User,
    ):
        """Each card carries creator_id and is_active (required by Dexie sync)."""
        response = await authenticated_client.get("/api/v1/shopping-lists")
        assert response.status_code == 200
        cards = response.json()["shopping_lists"]
        assert len(cards) >= 2
        for card in cards:
            assert "creator_id" in card, f"card missing creator_id: {card}"
            assert "is_active" in card, f"card missing is_active: {card}"
            assert isinstance(card["creator_id"], int)
            assert isinstance(card["is_active"], bool)
        # At least one card belongs to test_user
        assert any(card["creator_id"] == test_user.id for card in cards)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd tests && ./run-tests.sh backend -k TestShoppingListsListResponse -v
```
Expected: FAIL — `test_card_contains_creator_id_and_is_active` raises `AssertionError: card missing is_active` (current schema lacks the field).

- [ ] **Step 3: Extend `ShoppingListCardResponse`**

Edit `backend/app/schemas/shopping_list.py`. Replace the class body (lines 197-254) with:

```python
class ShoppingListCardResponse(BaseModel):
    """
    Schema for shopping list card responses (landing page grid).

    Includes shopping list data plus item count and completion statistics.
    Used for grid of cards on landing page AND for Dexie offline sync
    (LocalShoppingList in frontend).
    """

    id: int = Field(
        description="Shopping list ID",
        examples=[1]
    )

    temp_id: str | None = Field(
        default=None,
        description="Client-side UUID for offline sync"
    )

    creator_id: int = Field(
        description="Creator user ID (owner — used for delete permission)",
        examples=[123]
    )

    name: str = Field(
        description="Shopping list name",
        examples=["Weekly Groceries"]
    )

    description: str | None = Field(
        description="Optional description",
        examples=["Shopping list for week of 2025-01-10"]
    )

    is_active: bool = Field(
        description="Active status (True = visible in UI, False = archived)",
        examples=[True]
    )

    # Statistics
    total_items: int = Field(
        description="Total number of items in list",
        examples=[10]
    )

    completed_items: int = Field(
        description="Number of completed items",
        examples=[5]
    )

    completion_percentage: float = Field(
        description="Completion percentage (0-100)",
        examples=[50.0]
    )

    # Audit
    created_at: datetime = Field(
        description="Creation timestamp",
        examples=["2025-01-10T12:00:00Z"]
    )

    updated_at: datetime = Field(
        description="Last update timestamp",
        examples=["2025-01-10T15:30:00Z"]
    )

    model_config = {
        "from_attributes": True
    }
```

- [ ] **Step 4: Extend service dict**

Edit `backend/app/services/shopping_list_service.py`. Replace the dict append (lines 113-123) with:

```python
        lists_with_stats.append({
            "id": shopping_list.id,
            "name": shopping_list.name,
            "description": shopping_list.description,
            "creator_id": shopping_list.creator_id,
            "is_active": shopping_list.is_active,
            "total_items": total_items,
            "completed_items": completed_items,
            "completion_percentage": round(completion_percentage, 1),
            "created_at": shopping_list.created_at,
            "updated_at": shopping_list.updated_at,
        })
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
cd tests && ./run-tests.sh backend -k TestShoppingListsListResponse -v
```
Expected: both tests PASS.

- [ ] **Step 6: Run full shopping_lists test module (no regressions)**

Run:
```bash
cd tests && ./run-tests.sh backend -k shopping_lists -v
```
Expected: previously-passing tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/shopping_list.py \
        backend/app/services/shopping_list_service.py \
        tests/integration/backend/test_shopping_lists_list.py
git commit -m "feat(shopping-lists): expose creator_id + is_active in card response

Adds creator_id and is_active to ShoppingListCardResponse so the frontend
Dexie sync can build a complete LocalShoppingList from the list endpoint
without a second round-trip. Additive change — existing JS consumers
ignore unknown fields.

Regression test asserts wrapper shape ({shopping_lists, total, limit,
offset}) and per-card presence of both new fields."
```

---

### Task 2: Frontend — add ServerShoppingListCard type

**Files:**
- Modify: `frontend/shared/db/dexie/types/shopping.ts`

- [ ] **Step 1: Add type below `ShoppingListWithStats` (after line 95)**

In `frontend/shared/db/dexie/types/shopping.ts`, append below line 95 (after `ShoppingListWithStats`):

```typescript
/**
 * Raw shopping list card returned by GET /api/v1/shopping-lists.
 *
 * Mirrors backend ShoppingListCardResponse exactly. Used by downloadShoppingLists
 * before mapping into LocalShoppingList (which adds sync_status metadata).
 *
 * Dates arrive as ISO strings over the wire — caller is responsible for
 * `new Date()` parsing when writing into Dexie.
 */
export interface ServerShoppingListCard {
  id: number;
  temp_id: string | null;
  creator_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  total_items: number;
  completed_items: number;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
npm run type-check
```
Expected: PASS (no new errors). Type is exported but not yet imported — that arrives in Task 3.

- [ ] **Step 3: Commit**

```bash
git add frontend/shared/db/dexie/types/shopping.ts
git commit -m "feat(dexie): add ServerShoppingListCard type for shopping sync"
```

---

### Task 3: Frontend — failing unit test for `downloadShoppingLists`

**Files:**
- Create: `tests/unit/dashboard/dexieShoppingSync.test.ts`

This task writes the failing test only. The implementation arrives in Task 4. Splitting them keeps each step under 5 minutes and surfaces the regression-guard test before the rewrite.

- [ ] **Step 1: Write the test file**

Create `tests/unit/dashboard/dexieShoppingSync.test.ts`:

```typescript
/**
 * Dexie unit tests — downloadShoppingLists.
 *
 * Regression guards for the 2026-05-29 production bug:
 * - SchemaError on dropped user_id index (v3 schema)
 * - Treating { shopping_lists, total, limit, offset } as a bare array
 * - Wiping pending/deleted local rows during bootstrap pull
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DexieManager } from '@db/dexie/DexieManager';
import { getDb } from '@db/dexie/core/database';
import { downloadShoppingLists } from '@db/dexie/operations/shoppingSync';
import type { LocalShoppingList } from '@db/dexie/types/shopping';

const SERVER_PAYLOAD = {
  shopping_lists: [
    {
      id: 10,
      temp_id: null,
      creator_id: 1,
      name: 'Groceries',
      description: null,
      is_active: true,
      total_items: 3,
      completed_items: 1,
      completion_percentage: 33.3,
      created_at: '2026-05-29T10:00:00Z',
      updated_at: '2026-05-29T11:00:00Z',
    },
    {
      id: 11,
      temp_id: 'client-uuid-abc',
      creator_id: 2,
      name: 'Party Supplies',
      description: 'For Saturday',
      is_active: true,
      total_items: 0,
      completed_items: 0,
      completion_percentage: 0.0,
      created_at: '2026-05-29T09:00:00Z',
      updated_at: '2026-05-29T09:30:00Z',
    },
  ],
  total: 2,
  limit: 100,
  offset: 0,
};

function mockFetchOk(payload: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

function mockFetchError(status: number): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response('error', { status, headers: { 'Content-Type': 'text/plain' } }),
    ),
  );
}

describe('downloadShoppingLists', () => {
  let manager: DexieManager;

  beforeEach(async () => {
    manager = new DexieManager();
    await manager.init();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (manager.isReady()) {
      await manager.clearAll();
      await manager.close();
    }
  });

  it('unwraps payload.shopping_lists and writes mapped rows into Dexie', async () => {
    mockFetchOk(SERVER_PAYLOAD);

    const result = await downloadShoppingLists();

    expect(result).toEqual({ success: true, count: 2 });

    const stored = await getDb().shoppingLists.toArray();
    expect(stored).toHaveLength(2);

    const byId = new Map(stored.map((row) => [row.id, row]));
    const list10 = byId.get(10) as LocalShoppingList;
    expect(list10.creator_id).toBe(1);
    expect(list10.is_active).toBe(true);
    expect(list10.sync_status).toBe('synced');
    expect(list10.temp_id).toBe('server-10');
    expect(list10.synced_at).toBeInstanceOf(Date);
    expect(list10.created_at).toBeInstanceOf(Date);

    const list11 = byId.get(11) as LocalShoppingList;
    expect(list11.temp_id).toBe('client-uuid-abc');
    expect(list11.total_items).toBe(0);
  });

  it('calls /api/v1/shopping-lists with no query string', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ shopping_lists: [], total: 0, limit: 100, offset: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await downloadShoppingLists();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/v1/shopping-lists');
  });

  it('preserves local rows with sync_status pending or deleted', async () => {
    const now = new Date();
    await getDb().shoppingLists.bulkPut([
      {
        id: null,
        temp_id: 'pending-local',
        creator_id: 1,
        name: 'Pending Local',
        description: null,
        is_active: true,
        sync_status: 'pending',
        sync_hash: null,
        content_hash: null,
        created_at: now,
        updated_at: now,
        synced_at: null,
      },
      {
        id: 99,
        temp_id: 'deleted-local',
        creator_id: 1,
        name: 'Deleted Local',
        description: null,
        is_active: true,
        sync_status: 'deleted',
        sync_hash: null,
        content_hash: null,
        created_at: now,
        updated_at: now,
        synced_at: null,
      },
      {
        id: 50,
        temp_id: 'old-synced',
        creator_id: 1,
        name: 'Old Synced (should be replaced)',
        description: null,
        is_active: true,
        sync_status: 'synced',
        sync_hash: null,
        content_hash: null,
        created_at: now,
        updated_at: now,
        synced_at: now,
      },
    ]);

    mockFetchOk(SERVER_PAYLOAD);
    await downloadShoppingLists();

    const all = await getDb().shoppingLists.toArray();
    const temps = all.map((row) => row.temp_id).sort();
    expect(temps).toContain('pending-local');
    expect(temps).toContain('deleted-local');
    expect(temps).not.toContain('old-synced');
    expect(temps).toContain('server-10');
    expect(temps).toContain('client-uuid-abc');
  });

  it('returns {success: false, count: 0} on 500 without throwing', async () => {
    mockFetchError(500);

    const result = await downloadShoppingLists();
    expect(result).toEqual({ success: false, count: 0 });
  });

  it('does not throw SchemaError when invoked against current v3 schema', async () => {
    // Regression guard: previous code called db.shoppingLists.where('user_id'),
    // which does not exist on v3+ and threw 'KeyPath user_id is not indexed'.
    mockFetchOk({ shopping_lists: [], total: 0, limit: 100, offset: 0 });

    await expect(downloadShoppingLists()).resolves.toEqual({
      success: true,
      count: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run tests/unit/dashboard/dexieShoppingSync.test.ts --config config/vitest.config.ts
```
Expected: FAIL. Failure mode depends on environment, but at minimum:
- `'unwraps payload.shopping_lists'` fails because current code stores the wrapper object via `bulkPut`, producing 0 rows or throwing
- `'calls /api/v1/shopping-lists with no query string'` fails because current code appends `?user_id=undefined`
- Signature mismatch: current `downloadShoppingLists(userId)` requires an argument; calling `downloadShoppingLists()` with no arg either fails type-check or runs with `userId=undefined`

- [ ] **Step 3: Commit failing test**

```bash
git add tests/unit/dashboard/dexieShoppingSync.test.ts
git commit -m "test(dexie): failing unit tests for downloadShoppingLists rewrite"
```

---

### Task 4: Frontend — rewrite `downloadShoppingLists`, delete dead exports

**Files:**
- Modify: `frontend/shared/db/dexie/operations/shoppingSync.ts:162-267`

- [ ] **Step 1: Replace lines 162-267 with the new implementation**

In `frontend/shared/db/dexie/operations/shoppingSync.ts`:

Add a new import at the top (after line 12, before the first function):

```typescript
import type {
  LocalShoppingList,
  LocalShoppingListItem,
  ServerShoppingListCard
} from '../types/shopping';
```

(Replace the existing import block so `ServerShoppingListCard` is included.)

Then replace lines 159-267 (the JSDoc comment for `downloadShoppingLists` through the end of `fullShoppingSync`) with:

```typescript
/**
 * Download shopping lists from server.
 *
 * Shared-references model: returns ALL lists (no user_id filtering).
 * Replaces only rows with sync_status='synced'; pending and deleted
 * local edits are preserved for the next upload pass.
 */
export async function downloadShoppingLists(): Promise<{
  success: boolean;
  count: number;
}> {
  logger.info('[shoppingSync] Downloading shopping lists...');

  try {
    const response = await fetchWithTimeout('/api/v1/shopping-lists', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch shopping lists: ${response.status}`);
    }

    const payload = await response.json();
    const serverLists: ServerShoppingListCard[] = payload.shopping_lists ?? [];

    const now = new Date();
    const localLists: LocalShoppingList[] = serverLists.map(card => ({
      id: card.id,
      temp_id: card.temp_id ?? `server-${card.id}`,
      creator_id: card.creator_id,
      name: card.name,
      description: card.description,
      is_active: card.is_active,
      sync_status: 'synced',
      sync_hash: null,
      content_hash: null,
      created_at: new Date(card.created_at),
      updated_at: new Date(card.updated_at),
      synced_at: now,
      total_items: card.total_items,
      completed_items: card.completed_items,
      completion_percentage: card.completion_percentage,
    }));

    // Shared model: replace only synced rows; preserve pending/deleted local edits.
    await db.shoppingLists.where('sync_status').equals('synced').delete();
    await db.shoppingLists.bulkPut(localLists);

    logger.info('[shoppingSync] ✅ Shopping lists downloaded', { count: localLists.length });
    return { success: true, count: localLists.length };
  } catch (error) {
    logger.error('[shoppingSync] ❌ Shopping lists download failed:', error);
    return { success: false, count: 0 };
  }
}
```

That replacement intentionally removes the previous `downloadShoppingListItems` and `fullShoppingSync` functions (lines 200-267 in the pre-change file). They have no callers (grep-verified) and depended on the same broken assumptions.

The unused `LocalShoppingListItem` import can remain — `uploadPendingShoppingOperations` higher up still uses it.

- [ ] **Step 2: Type-check**

Run:
```bash
npm run type-check
```
Expected: PASS. If TypeScript complains about `LocalShoppingListItem` being unused after the deletion, leave it — it is still used by `uploadShoppingItem` at line 61.

- [ ] **Step 3: Run unit tests, verify they pass**

Run:
```bash
npx vitest run tests/unit/dashboard/dexieShoppingSync.test.ts --config config/vitest.config.ts
```
Expected: all five tests in the suite PASS.

- [ ] **Step 4: Run full vitest suite (no regressions)**

Run:
```bash
npm run test:coverage
```
Expected: PASS overall. If `dexieShoppingLists.test.ts` or any other suite that imports from `@db/dexie` fails on the removed exports, investigate — but grep confirmed no callers exist.

- [ ] **Step 5: Commit**

```bash
git add frontend/shared/db/dexie/operations/shoppingSync.ts
git commit -m "fix(dexie): rewrite downloadShoppingLists for shared model + v3 schema

Three root causes addressed in one change:
- Response shape: backend returns { shopping_lists, total, limit, offset },
  not a bare array. Now unwraps payload.shopping_lists.
- Stale index: dropped where('user_id') query that crashed with SchemaError
  after schema v3 removed the user_id index from shoppingLists.
- Misleading signature: removed userId parameter to reflect shared-references
  model (backend has no user_id filter).

Mapping fills creator_id, is_active, sync_status='synced', synced_at, and
temp_id fallback for server-side rows. Replaces only synced rows so
pending/deleted offline edits survive the bootstrap pull.

Removes downloadShoppingListItems and fullShoppingSync — both dead code
suffering identical defects."
```

---

### Task 5: Update single caller in stateManager.ts

**Files:**
- Modify: `frontend/web/static/js/lists/listsManager/core/stateManager.ts:314-325`

- [ ] **Step 1: Replace the bootstrap pull block**

In `frontend/web/static/js/lists/listsManager/core/stateManager.ts`, replace lines 314-325:

```typescript
    if (!bootstrapPullDone) {
      bootstrapPullDone = true;
      try {
        const { downloadShoppingLists } = await import('@db/dexie');
        await downloadShoppingLists();
      } catch (pullError) {
        debugLog('[ListsManager] Bootstrap forced pull failed (non-fatal)', pullError);
      }
    }
```

- [ ] **Step 2: Type-check**

Run:
```bash
npm run type-check
```
Expected: PASS. No more reference to `window.userData?.id` in this block; if any other code in the file relied on the `userId` const that has been removed, the type checker will flag it.

- [ ] **Step 3: Bundle**

Run:
```bash
npm run bundle
```
Expected: PASS. Verifies Rollup produces the `lists` bundle without errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/lists/listsManager/core/stateManager.ts
git commit -m "fix(lists): drop userId gate from bootstrap pull

downloadShoppingLists is now a no-arg function (shared-references model).
Auth is enforced by the cookie-based fetch — no need to short-circuit on
window.userData.id being absent."
```

---

### Task 6: E2E regression test for bootstrap pull

**Files:**
- Create: `tests/e2e/webapp/test_lists_bootstrap_pull.spec.ts`

- [ ] **Step 1: Write the E2E test**

Create `tests/e2e/webapp/test_lists_bootstrap_pull.spec.ts`:

```typescript
/**
 * E2E: /lists bootstrap pull is silent and well-formed.
 *
 * Regression guard for the 2026-05-29 production bug where
 * downloadShoppingLists threw a SchemaError on every first visit to /lists,
 * logged as "❌ Shopping lists download failed: i" in the console.
 *
 * Authentication: uses storage state from tests/e2e/setup/auth.setup.ts
 */
import { expect, test } from '@playwright/test';

test.describe('Lists page — bootstrap pull', () => {
  test('downloadShoppingLists succeeds on first /lists load', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const shoppingListsRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/v1/shopping-lists') && req.method() === 'GET') {
        shoppingListsRequests.push(url);
      }
    });

    await page.goto('/lists');
    await page.waitForLoadState('domcontentloaded');
    // Wait for bootstrap pull to settle (loadShoppingLists awaits the import + fetch).
    await page.waitForLoadState('networkidle');

    // No download-failed log line on the happy path.
    const downloadErrors = consoleErrors.filter((line) =>
      line.includes('Shopping lists download failed'),
    );
    expect(downloadErrors).toEqual([]);

    // Bootstrap pull issued at least one well-formed request — no user_id query.
    expect(shoppingListsRequests.length).toBeGreaterThan(0);
    for (const url of shoppingListsRequests) {
      expect(url).not.toContain('user_id=');
    }

    // Response shape sanity check on the first bootstrap call.
    const response = await page.request.get('/api/v1/shopping-lists');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('shopping_lists');
    expect(Array.isArray(body.shopping_lists)).toBe(true);
    if (body.shopping_lists.length > 0) {
      const card = body.shopping_lists[0];
      expect(card).toHaveProperty('creator_id');
      expect(card).toHaveProperty('is_active');
    }
  });
});
```

- [ ] **Step 2: Run the E2E test against test environment**

Run (headless):
```bash
npm run test:e2e -- tests/e2e/webapp/test_lists_bootstrap_pull.spec.ts
```
Expected: PASS. Backend + frontend already include the fix from Tasks 1-5, so the request must come through clean.

If the E2E setup requires a running dev server, follow the standard webapp E2E flow used by `test_shopping_lists.spec.ts` (the suite already in the repo).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/webapp/test_lists_bootstrap_pull.spec.ts
git commit -m "test(e2e): guard /lists bootstrap pull network + console"
```

---

### Task 7: Version bump + final verification

**Files:**
- Modify: `VERSION`

- [ ] **Step 1: Bump version**

Edit `VERSION` from `0.6.166` to `0.6.167`.

Run:
```bash
cat VERSION
```
Expected output: `0.6.167`.

- [ ] **Step 2: Full verification matrix**

Run all four verification commands in sequence:

```bash
npm run type-check
```
Expected: PASS.

```bash
npm run test:coverage
```
Expected: PASS (vitest suite green).

```bash
cd tests && ./run-tests.sh backend -k shopping_lists -v && cd ..
```
Expected: PASS.

```bash
npm run build
```
Expected: PASS (`type-check` + CSS + bundles + verify).

- [ ] **Step 3: Commit version bump**

The pre-commit hook will sync `package.json` / `package-lock.json` automatically.

```bash
git add VERSION package.json package-lock.json
git commit -m "chore: bump version to 0.6.167"
```

- [ ] **Step 4: Push branch and open PR**

```bash
git push -u origin dev/fix-shopping-lists-download
gh pr create --base test \
  --title "fix(lists): bootstrap pull SchemaError on /lists" \
  --body "$(cat <<'EOF'
## Summary
- Backend `ShoppingListCardResponse` gains `creator_id` + `is_active` (additive).
- Frontend `downloadShoppingLists` rewritten: drops `userId`, unwraps `shopping_lists`, uses `sync_status='synced'` partial replace, fills full `LocalShoppingList` shape.
- Removed dead exports `downloadShoppingListItems` + `fullShoppingSync` (broken URL + signature, no callers).
- Caller in `stateManager.ts` updated.

Spec: `docs/superpowers/specs/2026-05-29-shopping-lists-download-fix-design.md`.

## Test plan
- [ ] Backend integration: response wrapper + card field assertions
- [ ] Frontend unit: payload unwrap, signature, partial-replace, error path, SchemaError regression
- [ ] E2E: `/lists` bootstrap pull — no console error, no `user_id=` query
- [ ] Manual smoke on https://fbd.ikeniborn.ru/lists after deploy

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:** All five spec sections map to tasks. Section 1 (backend schema) → Task 1. Section 2 (shoppingSync.ts rewrite + dead-code delete) → Task 4 (rewrite test in Task 3). Section 3 (caller) → Task 5. Section 4 (tests) → Tasks 1/3/4/6. Section 5 (migration / rollout / VERSION bump / PR) → Task 7.

**Placeholder scan:** No TBD/TODO. Every code block is complete. Every command shows the expected outcome.

**Type consistency:** `ServerShoppingListCard` defined in Task 2, imported in Task 4 by the same path (`../types/shopping`). `downloadShoppingLists()` (no args) consistent across Tasks 3 / 4 / 5 / 6. `sync_status='synced'` literal consistent with the union in `LocalShoppingList`.

**Out of scope (intentional):**
- Refactor of generic shared-references download helper (premature abstraction, single consumer).
- `downloadShoppingListItems` rewrite (no offline download path in use; list items come via the REST endpoint at view time).
