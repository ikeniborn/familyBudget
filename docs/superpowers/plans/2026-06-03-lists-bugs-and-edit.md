---
chain:
  intent: docs/superpowers/intents/2026-06-03-lists-bugs-and-edit-intent.md
  spec: docs/superpowers/specs/2026-06-03-lists-bugs-and-edit-design.md
review:
  plan_hash: f60c4c261ae011f0
  spec_hash: c1a9788072d2eff7
  last_run: "2026-06-03"
  phases:
    structure:
      status: passed
    coverage:
      status: passed
    dependencies:
      status: passed
    verifiability:
      status: passed
    consistency:
      status: passed
  findings:
    - id: F-001
      phase: coverage
      severity: WARNING
      section: "## Task 7: Add Edit List Modal — TypeScript Functions"
      section_hash: db5f8e7d150d8b1b
      text: "Spec defines openEditListModal(listId: number) with explicit param; plan implements with no params, reads state.currentListId internally. Template in Task 8 uses window.openEditListModal() (no args) while spec shows window.openEditListModal(currentListId)."
      verdict: wontfix
      verdict_at: "2026-06-03"
    - id: F-002
      phase: coverage
      severity: WARNING
      section: "## Task 8: Add Edit List Modal — HTML Template"
      section_hash: 4b4d1996a5583b23
      text: "Spec says edit button 'placed next to delete button'; plan places it in the breadcrumb navigation area (detail_view.html breadcrumb block)."
      verdict: wontfix
      verdict_at: "2026-06-03"
    - id: F-003
      phase: coverage
      severity: WARNING
      section: "## Task 5: Fix Issues 2 & 4 — Counters + Hierarchy Tree After Import"
      section_hash: 6c5dc9fe1c347f87
      text: "Spec says add loadShoppingLists() after renderItemsTable() call; plan adds it BEFORE renderItemsTable() in executeImport() final order."
      verdict: fixed
      verdict_at: "2026-06-03"
    - id: F-004
      phase: coverage
      severity: WARNING
      section: "## Task 4: Fix Issue 5 — Delete Completed Requires Two Passes"
      section_hash: b2ce1cbf6f1d50d4
      text: "Spec uses db.shoppingListItems in Dexie eviction snippet; plan uses dexieDb.shoppingListItems. Variable name diverges — may cause runtime error if actual variable is named differently."
      verdict: wontfix
      verdict_at: "2026-06-03"
    - id: F-005
      phase: coverage
      severity: INFO
      section: "## Self-Review"
      section_hash: 035ec926470f273f
      text: "handleEditList uses PUT method; spec says PATCH. Plan notes this in Self-Review (existing backend route is PUT). Informational only."
      verdict: wontfix
      verdict_at: "2026-06-03"
    - id: F-006
      phase: coverage
      severity: INFO
      section: "## Task 8: Add Edit List Modal — HTML Template"
      section_hash: 4b4d1996a5583b23
      text: "Plan creates frontend/web/templates/components/lists/modal_edit_list.html (new component) and modifies partials/lists/detail_view.html; spec Files Changed table lists only lists.html for both changes."
      verdict: accepted
      verdict_at: "2026-06-03"
---

# Lists Page — Bug Fixes + Edit List Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 blocking bugs on the `/lists` page and add list editing capability (name + description) in one PR from `dev/lists-bugs-and-edit`.

**Architecture:** Backend adds `google_sheets_url` column to `t_f_shopping_list` plus two new list-scoped endpoints. Frontend adds edit-list modal using existing PATCH infrastructure. Four independent bug fixes touch `csvImporter.ts`, `googleSheetsImporter.js`, `listOperations.ts`, and `hierarchyIntegration.ts`.

**Tech Stack:** FastAPI + SQLModel (backend), TypeScript ES Modules (frontend), Jinja2 macros (templates), Alembic migrations

---

## Task 1: Backend — Migration + Model + Schema (Issue 3, part 1)

**Files:**
- Create: `backend/db/migrations/versions/20260603_a1b2c3d4e5f6_add_google_sheets_url_to_shopping_list.py`
- Modify: `backend/app/models/shopping_list.py`
- Modify: `backend/app/schemas/shopping_list.py`

- [ ] **Step 1: Create migration**

```python
"""add_google_sheets_url_to_shopping_list

Revision ID: a1b2c3d4e5f6
Revises: ebf328b51e19
Create Date: 2026-06-03 12:00:00.000000
"""
from collections.abc import Sequence

from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: str | None = 'ebf328b51e19'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_f_shopping_list'
                  AND column_name = 'google_sheets_url'
            ) THEN
                ALTER TABLE t_f_shopping_list
                ADD COLUMN google_sheets_url VARCHAR(2048) NULL;

                COMMENT ON COLUMN t_f_shopping_list.google_sheets_url IS
                    'Saved Google Sheets URL for this specific shopping list (per-list, not per-user)';
            END IF;
        END $$;
    """)
    print("[MIGRATION] google_sheets_url column added to t_f_shopping_list")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE t_f_shopping_list DROP COLUMN IF EXISTS google_sheets_url;"
    )
    print("[MIGRATION] google_sheets_url column removed from t_f_shopping_list")
```

- [ ] **Step 2: Add field to model**

In `backend/app/models/shopping_list.py`, after the `description` field (line 111), add:

```python
    google_sheets_url: str | None = Field(
        default=None,
        max_length=2048,
        description="Saved Google Sheets URL for this specific shopping list"
    )
```

- [ ] **Step 3: Add field to ShoppingListUpdate schema**

In `backend/app/schemas/shopping_list.py`, inside `ShoppingListUpdate` class after the `is_active` field (after line 101), add:

```python
    google_sheets_url: str | None = Field(
        default=None,
        max_length=2048,
        description="Google Sheets URL for this list (None = not provided, not cleared)",
        examples=["https://docs.google.com/spreadsheets/d/abc123/edit"]
    )
```

- [ ] **Step 4: Verify model loads without error**

```bash
cd /home/ikeniborn/Documents/Project/familyBudget
python -c "from backend.app.models.shopping_list import ShoppingList; print(ShoppingList.__fields__.keys())"
```

Expected: output includes `google_sheets_url`

- [ ] **Step 5: Commit**

```bash
git add backend/db/migrations/versions/20260603_a1b2c3d4e5f6_add_google_sheets_url_to_shopping_list.py \
        backend/app/models/shopping_list.py \
        backend/app/schemas/shopping_list.py
git commit -m "feat(backend): add google_sheets_url column to shopping list model"
```

---

## Task 2: Backend — Google Sheets URL Endpoints (Issue 3, part 2)

**Files:**
- Modify: `backend/app/api/v1/endpoints/shopping_lists.py`

- [ ] **Step 1: Add new Pydantic schemas for the endpoint responses**

In `backend/app/schemas/shopping_list.py`, after the `ShoppingListUpdate` class, add:

```python
class GoogleSheetsUrlResponse(BaseModel):
    """Response schema for google-sheets-url endpoints."""

    google_sheets_url: str | None = Field(
        default=None,
        description="Saved Google Sheets URL for this list",
    )
    has_saved_url: bool = Field(
        description="Whether a URL has been saved for this list"
    )

    model_config = {"from_attributes": True}


class GoogleSheetsUrlUpdate(BaseModel):
    """Request schema for updating google-sheets-url."""

    google_sheets_url: str | None = Field(
        default=None,
        max_length=2048,
        description="New Google Sheets URL (None to clear)",
    )
```

- [ ] **Step 2: Import the new schemas in shopping_lists.py**

In `backend/app/api/v1/endpoints/shopping_lists.py`, add to the existing `ShoppingList` schemas import block (around line 40):

```python
from backend.app.schemas.shopping_list import (
    GoogleSheetsUrlResponse,
    GoogleSheetsUrlUpdate,
    ShoppingListCardResponse,
    ShoppingListCreate,
    ShoppingListListResponse,
    ShoppingListResponse,
    ShoppingListUpdate,
    ShoppingListWithItemsResponse,
)
```

- [ ] **Step 3: Add two new endpoints at the bottom of shopping_lists.py**

```python
@router.get(
    "/{shopping_list_id}/google-sheets-url",
    response_model=GoogleSheetsUrlResponse,
    summary="Get Google Sheets URL for list",
    description="Get the saved Google Sheets URL for a specific shopping list",
)
async def get_list_google_sheets_url(
    shopping_list_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GoogleSheetsUrlResponse:
    """Get saved Google Sheets URL for a specific shopping list."""
    query = select(ShoppingList).where(ShoppingList.id == shopping_list_id)
    result = await session.execute(query)
    shopping_list = result.scalar_one_or_none()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list {shopping_list_id} not found",
        )

    return GoogleSheetsUrlResponse(
        google_sheets_url=shopping_list.google_sheets_url,
        has_saved_url=shopping_list.google_sheets_url is not None,
    )


@router.patch(
    "/{shopping_list_id}/google-sheets-url",
    response_model=GoogleSheetsUrlResponse,
    summary="Update Google Sheets URL for list",
    description="Save or clear the Google Sheets URL for a specific shopping list",
)
async def update_list_google_sheets_url(
    shopping_list_id: int,
    update_data: GoogleSheetsUrlUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GoogleSheetsUrlResponse:
    """Save or clear Google Sheets URL for a specific shopping list."""
    query = select(ShoppingList).where(ShoppingList.id == shopping_list_id)
    result = await session.execute(query)
    shopping_list = result.scalar_one_or_none()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list {shopping_list_id} not found",
        )

    shopping_list.google_sheets_url = update_data.google_sheets_url
    shopping_list.updated_at = datetime.utcnow()
    session.add(shopping_list)
    await session.commit()
    await session.refresh(shopping_list)

    logger.info(
        "Updated google_sheets_url for list %s by user %s",
        shopping_list_id, current_user.id
    )

    return GoogleSheetsUrlResponse(
        google_sheets_url=shopping_list.google_sheets_url,
        has_saved_url=shopping_list.google_sheets_url is not None,
    )
```

- [ ] **Step 4: Verify import works**

```bash
cd /home/ikeniborn/Documents/Project/familyBudget
python -c "from backend.app.api.v1.endpoints.shopping_lists import router; print([r.path for r in router.routes])"
```

Expected: output includes `/shopping-lists/{shopping_list_id}/google-sheets-url` (twice, GET and PATCH)

- [ ] **Step 5: Run backend integration tests**

```bash
cd /home/ikeniborn/Documents/Project/familyBudget/tests
./run-tests.sh backend
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/endpoints/shopping_lists.py \
        backend/app/schemas/shopping_list.py
git commit -m "feat(backend): add list-scoped google-sheets-url GET/PATCH endpoints"
```

---

## Task 3: Fix Issue 6 — Mark All Completed Fails After Import

**Files:**
- Modify: `frontend/web/static/js/lists/listsManager/core/listOperations.ts:336-344`

- [ ] **Step 1: Change throw to warn+return in toggleItemCompleted**

In `listOperations.ts`, find the `toggleItemCompleted` function (line ~336). Change:

```typescript
  // Find item and get temp_id
  const item = state.currentItems.find(i => i.id === itemId);
  if (!item) {
    throw new Error('Item not found in state');
  }
```

To:

```typescript
  // Find item and get temp_id
  const item = state.currentItems.find(i => i.id === itemId);
  if (!item) {
    // Item may have been reloaded with updated state (e.g. during bulk mark-all)
    debugLog('[LIST_OPS] Item not found in state during toggle, skipping', { itemId });
    return;
  }
```

- [ ] **Step 2: TypeScript type check**

```bash
cd /home/ikeniborn/Documents/Project/familyBudget
npm run type-check
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/web/static/js/lists/listsManager/core/listOperations.ts
git commit -m "fix(lists): mark-all completed no longer aborts on item not found in state"
```

---

## Task 4: Fix Issue 5 — Delete Completed Requires Two Passes

**Files:**
- Modify: `frontend/web/static/js/lists/listsManager/core/listOperations.ts` (the API-only fallback inside `deleteMultipleItems`)

- [ ] **Step 1: Add Dexie eviction after API-only bulk delete**

In `listOperations.ts`, find the API-only fallback path in `deleteMultipleItems` (around line 556). The block ends with:

```typescript
        // Reload from server to sync state
        if (state.currentListId) {
          await loadShoppingListItems(state.currentListId);
        }
        renderCurrentView();
        return;
```

Change to:

```typescript
        // Reload from server to sync state
        if (state.currentListId) {
          await loadShoppingListItems(state.currentListId);
        }

        // Evict from Dexie by server id — items may lack temp_id if created
        // via import before Dexie sync completed
        if (isDexieActive()) {
          try {
            await dexieDb.shoppingListItems.where('id').anyOf(itemIds).delete();
            debugLog('[LIST_OPS] Evicted API-deleted items from Dexie', { count: itemIds.length });
          } catch (dexieErr) {
            console.warn('[LIST_OPS] Dexie eviction failed (non-critical):', dexieErr);
          }
        }

        renderCurrentView();
        return;
```

- [ ] **Step 2: TypeScript type check**

```bash
npm run type-check
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/web/static/js/lists/listsManager/core/listOperations.ts
git commit -m "fix(lists): evict API-deleted items from Dexie in bulk delete fallback path"
```

---

## Task 5: Fix Issues 2 & 4 — Counters + Hierarchy Tree After Import

**Files:**
- Modify: `frontend/web/static/js/lists/listsManager/rendering/hierarchyIntegration.ts`
- Modify: `frontend/web/static/js/lists/csvImporter.ts`

- [ ] **Step 1: Add loadShoppingLists to hierarchyIntegration proxy**

In `hierarchyIntegration.ts`, find the import at the top:

```typescript
import { loadShoppingListItems, loadStores, loadProductGroups } from '../core/stateManager';
```

Change to:

```typescript
import { loadShoppingListItems, loadShoppingLists, loadStores, loadProductGroups } from '../core/stateManager';
```

Then in `createListsManagerProxy()`, after `loadProductGroups,`, add:

```typescript
    loadShoppingLists,
```

- [ ] **Step 2: Fix executeImport call order in csvImporter.ts (Issue 4)**

In `csvImporter.ts`, find `executeImport()` around line 1644. The current order is:

```typescript
                if (result.created_stores && result.created_stores.length > 0) {
                    debugLog('[CSVImporter] Reloading stores (before render)...', result.created_stores);
                    await this.listsManager.loadStores();
                }

                if (result.created_product_groups && result.created_product_groups.length > 0) {
                    debugLog('[CSVImporter] Reloading product groups (before render)...', result.created_product_groups);
                    await this.listsManager.loadProductGroups();
                }

                // Reload shopping list items
                await this.listsManager.loadShoppingListItems(currentListId);

                // Re-render items table (now with updated stores/productGroups cache)
                this.listsManager.renderItemsTable();
```

Change to (items first, then overwrite with fresh stores/groups):

```typescript
                // Reload shopping list items FIRST (loads stale groups from Dexie)
                await this.listsManager.loadShoppingListItems(currentListId);

                // Overwrite with fresh data AFTER items load (fixes hierarchy tree)
                if (result.created_stores && result.created_stores.length > 0) {
                    debugLog('[CSVImporter] Reloading stores (after items load)...', result.created_stores);
                    await this.listsManager.loadStores();
                }

                if (result.created_product_groups && result.created_product_groups.length > 0) {
                    debugLog('[CSVImporter] Reloading product groups (after items load)...', result.created_product_groups);
                    await this.listsManager.loadProductGroups();
                }

                // Re-render items table (now with updated stores/productGroups cache)
                this.listsManager.renderItemsTable();

                // Refresh landing page counters AFTER render (total_items/completed_items/completion_percentage)
                if (typeof this.listsManager.loadShoppingLists === 'function') {
                    await this.listsManager.loadShoppingLists();
                }
```

- [ ] **Step 3: Rebuild csvImporter bundle**

```bash
cd /home/ikeniborn/Documents/Project/familyBudget
npm run type-check
npm run bundle
```

Expected: type-check passes, bundle builds successfully

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/lists/listsManager/rendering/hierarchyIntegration.ts \
        frontend/web/static/js/lists/csvImporter.ts \
        frontend/web/static/js/lists/csvImporter.js \
        frontend/web/static/js/lists/csvImporter.js.map
git commit -m "fix(lists): fix hierarchy tree and counters after CSV import"
```

---

## Task 6: Fix Issue 3 — Google Sheets URL Per List (Frontend)

**Files:**
- Modify: `frontend/web/static/js/lists/googleSheetsImporter.js`

- [ ] **Step 1: Update fetchSavedGoogleSheetsUrl to use list-level endpoint**

In `googleSheetsImporter.js`, find `fetchSavedGoogleSheetsUrl()` (around line 61). Change:

```javascript
    async fetchSavedGoogleSheetsUrl() {
        try {
            const response = await fetch('/api/v1/users/me/google-sheets-url', {
                method: 'GET',
                credentials: 'same-origin',
            });
```

To:

```javascript
    async fetchSavedGoogleSheetsUrl() {
        try {
            const listId = this.listsManager.currentListId;
            if (!listId) {
                debugLog('[GoogleSheetsImporter] No currentListId, skipping URL fetch');
                return;
            }
            const response = await fetch(`/api/v1/shopping-lists/${listId}/google-sheets-url`, {
                method: 'GET',
                credentials: 'same-origin',
            });
```

- [ ] **Step 2: Update saveGoogleSheetsUrl to use list-level endpoint**

In `googleSheetsImporter.js`, find `saveGoogleSheetsUrl(url)` (around line 90). Change:

```javascript
    async saveGoogleSheetsUrl(url) {
        try {
            const response = await fetch('/api/v1/users/me/google-sheets-url', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    google_sheets_url: url
                })
```

To:

```javascript
    async saveGoogleSheetsUrl(url) {
        try {
            const listId = this.listsManager.currentListId;
            if (!listId) {
                debugLog('[GoogleSheetsImporter] No currentListId, cannot save URL');
                return false;
            }
            const response = await fetch(`/api/v1/shopping-lists/${listId}/google-sheets-url`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    google_sheets_url: url
                })
```

- [ ] **Step 3: Verify no console.log added (pre-commit hook)**

```bash
grep -n "console\.log" frontend/web/static/js/lists/googleSheetsImporter.js | head -5
```

Expected: no output (no console.log calls added)

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/lists/googleSheetsImporter.js
git commit -m "fix(lists): save google sheets URL per list instead of per user"
```

---

## Task 7: Add Edit List Modal — TypeScript Functions (Issue 1, part 1)

**Files:**
- Modify: `frontend/web/static/js/lists/listsManager/ui/modalManager.ts`
- Modify: `frontend/web/static/js/lists/listsManager/adapters/windowExports.ts`

- [ ] **Step 1: Add edit list functions to modalManager.ts**

In `modalManager.ts`, at the end of the file (after the last export), add:

```typescript
// ============================================================================
// Edit List Modal
// ============================================================================

/**
 * Open edit list modal — reads current list from state, fills name/description
 */
export function openEditListModal(): void {
  const state = getState();
  const listId = state.currentListId;
  if (!listId) {
    showToast('Список не выбран', 'error');
    return;
  }

  const list = state.shoppingLists.find(l => l.id === listId);
  if (!list) {
    showToast('Список не найден', 'error');
    return;
  }

  const modal = document.getElementById('edit-list-modal') as HTMLDialogElement | null;
  const nameInput = document.getElementById('edit-list-name') as HTMLInputElement | null;
  const descInput = document.getElementById('edit-list-description') as HTMLTextAreaElement | null;
  const hiddenId = document.getElementById('edit-list-id') as HTMLInputElement | null;

  if (nameInput) nameInput.value = list.name;
  if (descInput) descInput.value = list.description || '';
  if (hiddenId) hiddenId.value = String(listId);

  if (modal) modal.showModal();
}

/**
 * Close edit list modal
 */
export function closeEditListModal(): void {
  const modal = document.getElementById('edit-list-modal') as HTMLDialogElement | null;
  if (modal) modal.close();
}

/**
 * Handle edit list form submission — PATCH /api/v1/shopping-lists/{id}
 */
export async function handleEditList(event: Event): Promise<void> {
  event.preventDefault();

  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);

  const listId = parseInt(formData.get('list_id') as string, 10);
  const name = (formData.get('name') as string).trim();
  const description = (formData.get('description') as string).trim() || null;

  if (!listId || !name) {
    showToast('Название обязательно', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/v1/shopping-lists/${listId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, description })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const updated = await response.json();

    // Update in-memory state
    const state = getState();
    const idx = state.shoppingLists.findIndex(l => l.id === listId);
    if (idx >= 0) {
      const updatedList = { ...state.shoppingLists[idx], name: updated.name, description: updated.description };
      const lists = [...state.shoppingLists];
      lists[idx] = updatedList;
      updateState({ shoppingLists: lists });
    }

    // Update breadcrumb title in detail view
    const breadcrumb = document.getElementById('breadcrumb-list-name');
    if (breadcrumb) breadcrumb.textContent = updated.name;

    // Refresh landing page cards (for when user navigates back)
    const { renderShoppingListCards } = await import('../rendering/listRenderer');
    renderShoppingListCards();

    closeEditListModal();
    showToast('Список обновлён', 'success');

  } catch (error) {
    console.error('[EDIT_LIST] Error updating list:', error);
    showToast('Ошибка обновления списка', 'error');
  }
}
```

- [ ] **Step 2: Add window exports**

In `windowExports.ts`, add the imports and exports. Current file imports from `'../index'`. Add to the top imports section:

```typescript
import {
  openEditListModal,
  closeEditListModal,
  handleEditList
} from '../ui/modalManager';
```

And at the end of the file, add:

```typescript
// Edit list modal exports
(window as any).openEditListModal = openEditListModal;
(window as any).closeEditListModal = closeEditListModal;
(window as any).handleEditList = handleEditList;
```

- [ ] **Step 3: TypeScript type check**

```bash
npm run type-check
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/web/static/js/lists/listsManager/ui/modalManager.ts \
        frontend/web/static/js/lists/listsManager/adapters/windowExports.ts
git commit -m "feat(lists): add edit list modal TypeScript functions"
```

---

## Task 8: Add Edit List Modal — HTML Template (Issue 1, part 2)

**Files:**
- Create: `frontend/web/templates/components/lists/modal_edit_list.html`
- Modify: `frontend/web/templates/lists.html`
- Modify: `frontend/web/templates/partials/lists/detail_view.html`

- [ ] **Step 1: Create edit list modal component**

Create `frontend/web/templates/components/lists/modal_edit_list.html`:

```html
{#
  COMPONENT: Edit Shopping List Modal
  Purpose: Form for editing existing shopping list name and description
  Used in: lists.html
#}

{% macro edit_list_modal() %}
<!-- Edit Shopping List Modal - compact on mobile -->
<dialog id="edit-list-modal" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box p-4 sm:p-6">
        <h3 class="text-base sm:text-lg font-semibold mb-1 sm:mb-2">✏️ Редактировать список</h3>
        <form id="edit-list-form" onsubmit="window.handleEditList(event)">
            <input type="hidden" id="edit-list-id" name="list_id" value="">

            <div class="form-control mb-3 sm:mb-4">
                <label class="label py-1">
                    <span class="label-text font-medium text-sm">Название <span class="text-error">*</span></span>
                </label>
                <input type="text" id="edit-list-name" name="name" class="input input-bordered input-sm sm:input-md" placeholder="Название списка" required>
            </div>

            <div class="form-control mb-3 sm:mb-4">
                <label class="label py-1">
                    <span class="label-text font-medium text-sm">Описание</span>
                </label>
                <textarea id="edit-list-description" name="description" class="textarea textarea-bordered textarea-sm sm:textarea-md" rows="2" placeholder="Опционально"></textarea>
            </div>

            <div class="modal-action mt-3 sm:mt-4 gap-2">
                <button type="button" class="btn btn-ghost btn-sm sm:btn-md" onclick="window.closeEditListModal()">Отмена</button>
                <button type="submit" class="btn btn-primary btn-sm sm:btn-md flex-1 sm:flex-initial">Сохранить</button>
            </div>
        </form>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button>close</button>
    </form>
</dialog>
{% endmacro %}
```

- [ ] **Step 2: Import and render modal in lists.html**

In `frontend/web/templates/lists.html`, after the existing `{% from "components/lists/modal_delete_list.html" import delete_list_modal %}` line (line 7), add:

```jinja2
{% from "components/lists/modal_edit_list.html" import edit_list_modal %}
```

And after `{{ delete_list_modal() }}` (line 55), add:

```jinja2
{# Edit Shopping List Modal #}
{{ edit_list_modal() }}
```

- [ ] **Step 3: Add edit button to detail view breadcrumb**

In `frontend/web/templates/partials/lists/detail_view.html`, change the breadcrumb block:

```html
    <!-- Breadcrumb Navigation -->
    <div class="text-sm breadcrumbs">
        <ul>
            <li><a href="#" onclick="showLandingView(); return false;">🛒 Списки покупок</a></li>
            <li id="breadcrumb-list-name">Loading...</li>
        </ul>
    </div>
```

To:

```html
    <!-- Breadcrumb Navigation -->
    <div class="flex items-center gap-2">
        <div class="text-sm breadcrumbs flex-1 min-w-0">
            <ul>
                <li><a href="#" onclick="showLandingView(); return false;">🛒 Списки покупок</a></li>
                <li id="breadcrumb-list-name" class="truncate max-w-48 sm:max-w-none">Loading...</li>
            </ul>
        </div>
        <button
            onclick="window.openEditListModal()"
            class="btn btn-ghost btn-sm btn-circle flex-shrink-0"
            title="Редактировать список"
            aria-label="Редактировать список">
            ✏️
        </button>
    </div>
```

- [ ] **Step 4: Build frontend and verify no type errors**

```bash
npm run type-check
npm run build:css
npm run bundle
```

Expected: all pass without errors

- [ ] **Step 5: Start dev server and test edit list flow manually**

```bash
# In terminal 1: start backend
ssh budget-test -t "cd /opt/budget && docker compose up"
# Or use local dev setup
```

Manual test checklist:
- Open `/lists`, navigate into any list
- Breadcrumb shows list name with ✏️ button
- Click ✏️ → modal opens with current name/description prefilled
- Change name → Save → breadcrumb updates immediately
- Navigate back to landing page → card shows updated name
- Click ✏️ → Cancel → no changes made
- Test on mobile (375px): modal appears from bottom

- [ ] **Step 6: Commit**

```bash
git add frontend/web/templates/components/lists/modal_edit_list.html \
        frontend/web/templates/lists.html \
        frontend/web/templates/partials/lists/detail_view.html
git commit -m "feat(lists): add edit list modal with name and description fields"
```

---

## Task 9: Bundle + Final Verification

**Files:**
- Rebuild JS bundles after all TS changes

- [ ] **Step 1: Full build**

```bash
cd /home/ikeniborn/Documents/Project/familyBudget
npm run build
```

Expected: `type-check`, `build:css`, `bundle`, `verify` all pass

- [ ] **Step 2: Run all tests**

```bash
cd tests && ./run-tests.sh all
```

Expected: no regressions

- [ ] **Step 3: Open `/lists` in browser and exercise all 6 fixes**

Test matrix:
1. **Edit list**: ✏️ button → edit name → save → breadcrumb + card update
2. **Counters after import**: CSV import → close wizard → landing page shows correct X/Y counter
3. **Google Sheets URL per list**: open list A → import via GSheets → URL saved; open list B → GSheets modal shows empty
4. **Hierarchy tree after import**: CSV with new product groups → hierarchy tree shows new groups immediately (no reload)
5. **Delete completed (one pass)**: CSV import → mark all completed → delete completed → items gone (single pass)
6. **Mark all after import**: CSV import → Mark All → no error toast, all items marked

- [ ] **Step 4: Create PR**

```bash
git push origin dev/lists-bugs-and-edit
gh pr create --base test --title "fix(lists): 6 bug fixes + edit list modal" \
  --body "$(cat <<'EOF'
## Summary
- Fixes 6 blocking bugs on /lists page (counters, Sheets URL, hierarchy tree, delete completed two passes, mark-all abort)
- Adds edit list modal (name + description) with ✏️ button in detail view header
- Backend: adds google_sheets_url column to t_f_shopping_list + 2 new list-scoped endpoints

## Changes
- **Issue 1**: Edit list modal (new modal component + 3 TS functions + window exports)
- **Issue 2**: Landing page counters refresh after import (loadShoppingLists in proxy + executeImport)
- **Issue 3**: Google Sheets URL saved per list, not per user (migration + model + schema + 2 endpoints + googleSheetsImporter.js)
- **Issue 4**: Hierarchy tree shows new groups after import (reorder executeImport calls)
- **Issue 5**: Delete completed works in single pass (Dexie eviction in API fallback)
- **Issue 6**: Mark all completed no longer aborts (warn+return instead of throw)

## Test plan
- [ ] Edit list: ✏️ → change name → breadcrumb + landing card update
- [ ] Counters: CSV import → landing page shows correct X/Y immediately
- [ ] GSheets URL: per-list isolation verified (list A URL not visible in list B)
- [ ] Hierarchy: new groups appear in tree without page reload
- [ ] Delete completed: single pass after CSV import
- [ ] Mark all: works after import with no error

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task | Covered? |
|------------|------|----------|
| Edit list modal (name + description) | Tasks 7, 8 | ✅ |
| openEditListModal, closeEditListModal, handleEditList | Task 7 | ✅ |
| window exports for edit functions | Task 7 | ✅ |
| Edit button in detail view header | Task 8 | ✅ |
| Breadcrumb title updates from API response | Task 7 | ✅ |
| Landing page counters after import (Issue 2) | Task 5 | ✅ |
| loadShoppingLists added to proxy | Task 5 | ✅ |
| google_sheets_url column migration | Task 1 | ✅ |
| google_sheets_url in model | Task 1 | ✅ |
| google_sheets_url in ShoppingListUpdate | Task 1 | ✅ |
| GET/PATCH endpoints for list-scoped URL | Task 2 | ✅ |
| googleSheetsImporter uses list endpoints | Task 6 | ✅ |
| Hierarchy tree reorder in executeImport | Task 5 | ✅ |
| Dexie eviction in deleteMultipleItems fallback | Task 4 | ✅ |
| toggleItemCompleted warn not throw | Task 3 | ✅ |
| User-level google-sheets-url NOT modified | Tasks 1-6 | ✅ |
| Offline sync internals NOT touched | All tasks | ✅ |
| Soft delete pattern preserved | Task 4 | ✅ |

### Notes
- `handleEditList` uses `PUT` method (not PATCH) — the existing backend endpoint is `PUT /api/v1/shopping-lists/{id}`. The spec says "PATCH" but the actual backend route is PUT.
- The `openEditListModal()` takes no parameters — reads `state.currentListId` internally. Template uses `window.openEditListModal()` (no args).
- `googleSheetsImporter.js` is plain JS — edited directly, not compiled.
- `csvImporter.ts` compiles to `csvImporter.js` — both files must be committed (Task 5, Step 4).
