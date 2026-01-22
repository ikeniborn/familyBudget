# PGlite Conflict Resolution (Task-014)

**Created:** 2026-01-22
**Status:** ✅ Implemented
**Complexity:** Complex

## Overview

Advanced merge conflict resolution для Shopping Lists с position-based ordering и smart field merging. Автоматически разрешает конфликты синхронизации между локальной PGlite БД и сервером.

**Ключевые особенности:**
- ✅ Smart merge для `is_completed` (OR logic)
- ✅ Smart merge для `quantity` (MAX value)
- ✅ Position field для явного порядка items
- ✅ Server - source of truth для position
- ✅ Конфликт-резолюция через UI modal

## Merge Strategy Algorithm

### Shopping Lists (Headers)

**Стратегия:** Last-Write-Wins (LWW)

```typescript
if (server.updated_at > local.updated_at) {
  // Server wins
  apply server version
} else {
  // Client wins
  mark as pending for re-upload
}
```

### Shopping List Items (Lines)

**Стратегия:** Smart merge с field-level resolution

```typescript
mergedItem = {
  // Identity fields: Server wins
  id: server.id,
  creator_id: server.creator_id,

  // Reference fields: Server wins
  shopping_list_temp_id: server.shopping_list_temp_id,
  store_id: server.store_id,
  product_group_id: server.product_group_id,

  // Business fields: Server wins
  product_name: server.product_name,
  unit: server.unit,
  comment: server.comment,

  // Smart merge fields
  is_completed: local.is_completed || server.is_completed,  // OR
  quantity: Math.max(local.quantity ?? 0, server.quantity ?? 0),  // MAX
  completed_at: earliest(local.completed_at, server.completed_at),  // Earliest

  // Ordering field: Server wins
  position: server.position,  // Server is source of truth

  // Sync fields
  sync_status: 'synced',
  sync_hash: server.sync_hash,
  content_hash: server.content_hash,
  version: server.version,
}
```

## Position Field

### Rationale

Position field решает проблему неопределенного порядка items при offline создании и merge conflicts.

**До (без position):**
- Сортировка по `created_at` → непредсказуема при offline создании
- Порядок зависит от времени синхронизации
- Конфликты порядка при одновременном создании

**После (с position):**
- Явный порядок через INTEGER field
- Auto-assign при создании: `MAX(position) + 1`
- Server - source of truth при merge

### Auto-Assignment Logic

**Location:** `frontend/shared/db/pglite/operations/shoppingOperations.ts:266-314`

```typescript
// Get max position for shopping list
const maxPosResult = await db.query(`
  SELECT COALESCE(MAX(position), 0) as max_pos
  FROM local_shopping_list_items
  WHERE shopping_list_temp_id = $1 AND deleted_at IS NULL
`, [shopping_list_temp_id]);

const newPosition = (maxPosResult.rows[0].max_pos || 0) + 1;

// Insert with auto-assigned position
await db.query(`
  INSERT INTO local_shopping_list_items (..., position)
  VALUES (..., $10)
`, [..., newPosition]);
```

**Важные особенности:**
- ✅ Учитывает только активные items (`deleted_at IS NULL`)
- ✅ Gaps сохраняются после удаления (не переупорядочивает)
- ✅ Работает корректно при параллельных операциях

### Migration Guide

**Server Migration:** `backend/db/migrations/versions/20260122_a1b2c3d4e5f6_add_position_to_shopping_list_items.py`

```sql
-- Step 1: Add position column
ALTER TABLE t_f_shopping_list_item
ADD COLUMN position INTEGER;

-- Step 2: Auto-assign positions to existing items
UPDATE t_f_shopping_list_item
SET position = subquery.row_num
FROM (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY shopping_list_id ORDER BY created_at) as row_num
  FROM t_f_shopping_list_item
  WHERE position IS NULL
) AS subquery
WHERE t_f_shopping_list_item.id = subquery.id;

-- Step 3: Create composite index
CREATE INDEX idx_shopping_list_item_position
ON t_f_shopping_list_item(shopping_list_id, position);
```

**PGlite Migration:** Автоматически через schema version bump

## Merge Resolution Methods

### Entry Point

**Location:** `frontend/shared/db/pglite/ShoppingConflictManager.ts:339-450`

```typescript
async applyMergeResolution(conflict: ShoppingConflictDetection): Promise<void>
```

**Workflow:**
1. Определяет тип entity (list vs item)
2. Вызывает соответствующий merge метод
3. Логирует результат в `local_sync_conflicts` таблицу

### List Merge

```typescript
private async applyMergeResolutionForList(conflict): Promise<void>
```

**Стратегия:** LWW на основе `updated_at` timestamp

### Item Merge

```typescript
private async applyMergeResolutionForItem(conflict): Promise<void>
```

**Стратегия:** Smart field merge:
- OR для `is_completed`
- MAX для `quantity`
- Server wins для всех остальных полей

### Helper Methods

```typescript
private mergeQuantity(localQty, serverQty): number | null
```
- Null treated as 0 for comparison
- Returns MAX(local, server)

```typescript
private mergeCompletedAt(local, server, mergedIsCompleted): Date | null
```
- If merged is completed → use earliest timestamp
- Fallback to current time if missing

## UI Integration

### Conflict Resolution Modal

**Location:** `frontend/web/static/js/modules/uiComponents/modals/ConflictResolutionModal.ts:300-307`

**Changes (Task-014):**
```typescript
// Before:
mergeBtn.disabled = true;
mergeBtn.textContent = '🔀 Объединить (скоро)';

// After:
mergeBtn.disabled = false;
mergeBtn.textContent = '🔀 Объединить изменения';
mergeBtn.addEventListener('click', () => this.handleResolve('merge'));
```

**Кнопки resolution:**
- 🌐 Использовать версию сервера (server strategy)
- 💻 Сохранить мою версию (client strategy)
- 🔀 Объединить изменения (merge strategy) ← **NEW**

### Conflict Handler

**Location:** `frontend/web/static/js/lists/listsManager/ui/conflictHandler.ts:116-143`

**Changes (Task-014):**
```typescript
if (strategy === 'merge') {
  // Before: throw new Error('Merge strategy not implemented')
  // After:
  await conflictManager.applyMergeResolution(conflict);
}
```

## Edge Cases

### Edge Case 1: Null Position

**Scenario:** Old records before migration have position=null

**Solution:** Auto-assign в read queries:
```sql
SELECT *, COALESCE(position, 999999) as sort_position
FROM local_shopping_list_items
ORDER BY sort_position
```

### Edge Case 2: Position Collision

**Scenario:** Two offline clients assign same position

**Solution:** Server is source of truth - client accepts server position during merge

### Edge Case 3: Quantity Overflow

**Scenario:** MAX exceeds NUMERIC(10,3) limit

**Solution:** Validate in merge, cap at 9999999.999

```typescript
const mergedQuantity = Math.min(
  Math.max(local.quantity ?? 0, server.quantity ?? 0),
  9999999.999
);
```

### Edge Case 4: Missing completed_at

**Scenario:** `is_completed=true` but `completed_at=null`

**Solution:** mergeCompletedAt() sets current time as fallback

### Edge Case 5: Delete-Update Conflict

**Scenario:** Client deletes, server updates

**Solution:** Merge not applicable - force user to choose server/client

## Performance Considerations

**Position Index:**
- Composite index: `(shopping_list_temp_id, position)`
- Fast ORDER BY queries: O(log n)

**MAX Query:**
- Single index lookup: O(log n)
- Only scans active items (`deleted_at IS NULL`)

**Merge UPDATE:**
- Single row update: O(1) with primary key
- No cascading updates

**Memory Overhead:**
- 4 bytes per item (position INTEGER)
- 1000 items = 4KB overhead

## Testing

**Unit Tests:** `frontend/shared/db/pglite/__tests__/ShoppingConflictManager.test.ts`

**Merge Resolution Tests:**
1. ✅ merge is_completed using OR (both true)
2. ✅ merge is_completed using OR (local true, server false)
3. ✅ merge is_completed using OR (both false)
4. ✅ merge quantity using MAX
5. ✅ handle null quantities in MAX
6. ✅ use server position (source of truth)
7. ✅ merge completed_at with earliest timestamp
8. ✅ log merge resolution to conflicts table

**Position Auto-Assignment Tests:**
1. ✅ auto-assign position on item creation (1, 2, 3)
2. ✅ handle gaps after deletion (preserve gaps, no reordering)

**Run tests:**
```bash
npm run test:unit -- ShoppingConflictManager
```

## Rollback Plan

### If Merge Logic Has Bugs

1. Disable merge button:
```typescript
mergeBtn.disabled = true;
mergeBtn.textContent = '🔀 Объединить (в разработке)';
```

2. Fallback to server/client only
3. Fix bugs, re-enable

### If Position Field Issues

**Server:**
```sql
DROP INDEX idx_shopping_list_item_position;
ALTER TABLE t_f_shopping_list_item DROP COLUMN position;
```

**PGlite:**
- Remove from schema (version bump)
- Remove from TypeScript types

## Future Improvements

### Phase 3 Enhancements (Optional)

1. **User-Controlled Ordering:**
   - Drag-and-drop reordering
   - Update position via UI

2. **Smart Position Rebalancing:**
   - Compact gaps periodically
   - Prevent integer overflow

3. **Position Conflict Resolution:**
   - If collision detected → interpolate between neighbors
   - Example: positions [1, 3] → new item gets 2

4. **Multi-List Position Sync:**
   - Preserve position when moving items between lists
   - Copy position from source list

## References

**Code:**
- `frontend/shared/db/pglite/ShoppingConflictManager.ts:339-450` - Merge methods
- `frontend/shared/db/pglite/operations/shoppingOperations.ts:266-314` - Auto-assign
- `frontend/web/static/js/modules/uiComponents/modals/ConflictResolutionModal.ts:300-307` - UI
- `frontend/web/static/js/lists/listsManager/ui/conflictHandler.ts:116-143` - Handler

**Database:**
- `frontend/shared/db/pglite/schemas/v3_shopping.sql:82` - PGlite schema
- `backend/db/migrations/versions/20260122_a1b2c3d4e5f6_add_position_to_shopping_list_items.py` - Server migration
- `backend/app/models/shopping_list_item.py:166-170` - Server model
- `backend/app/schemas/shopping_list_item.py` - Pydantic schemas

**Tests:**
- `frontend/shared/db/pglite/__tests__/ShoppingConflictManager.test.ts:324-523` - Unit tests

**Documentation:**
- `CLAUDE.md` - Development patterns
- This file - Complete architecture guide
