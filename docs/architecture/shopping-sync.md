# Shopping Lists Sync Protocol (task-012)

**Version:** 1.0
**Last Updated:** 2026-01-22
**Status:** ✅ Implemented

---

## Overview

Shopping Lists используют bidirectional sync протокол для offline-first функциональности:

- **Initial Sync:** Полная загрузка reference data (stores, product groups, hierarchy)
- **Incremental Sync:** Delta changes с момента последней синхронизации (created/updated/deleted)
- **Upload Sync:** Загрузка pending operations на сервер
- **Conflict Resolution:** LWW (Last-Write-Wins) strategy по `updated_at` timestamp

---

## Architecture

### PGlite Schema (v3)

**Reference Data (Read-Only):**
- `local_stores` - Магазины (id, name, address, code, is_active)
- `local_product_groups` - Категории товаров (id, parent_id, name, code, is_active)
- `local_product_group_hierarchy` - Closure Table для иерархии (ancestor_id, descendant_id, depth)

**Transactional Data (User Mutations):**
- `local_shopping_lists` - Списки покупок (id, temp_id, name, description, sync_status)
- `local_shopping_list_items` - Элементы списков (id, temp_id, shopping_list_temp_id, product_name, quantity, sync_status)

**Key Patterns:**
- **temp_id:** UUID для offline creates (пока нет server id)
- **sync_status:** `'synced' | 'pending' | 'conflict' | 'deleted'`
- **sync_hash:** Hash для conflict detection
- **content_hash:** Hash для deduplication
- **version:** Optimistic locking для conflict resolution

---

## Backend API Endpoints

### 1. GET /api/v1/sync/shopping-reference

**Purpose:** Initial sync для reference data

**Authentication:** Required (any authenticated user)

**Query Parameters:** None

**Response:**
```json
{
  "stores": [
    {
      "id": 1,
      "name": "Магазин У Дома",
      "address": "ул. Ленина 10",
      "code": "SHOP001",
      "is_active": true,
      "created_at": "2026-01-01T10:00:00Z"
    }
  ],
  "product_groups": [
    {
      "id": 1,
      "parent_id": null,
      "name": "Продукты",
      "code": "FOOD",
      "is_active": true,
      "created_at": "2026-01-01T10:00:00Z"
    },
    {
      "id": 2,
      "parent_id": 1,
      "name": "Молочные продукты",
      "code": "DAIRY",
      "is_active": true,
      "created_at": "2026-01-01T10:00:00Z"
    }
  ],
  "product_group_hierarchy": [
    {"ancestor_id": 1, "descendant_id": 1, "depth": 0},
    {"ancestor_id": 1, "descendant_id": 2, "depth": 1},
    {"ancestor_id": 2, "descendant_id": 2, "depth": 0}
  ]
}
```

**Implementation:**
- File: `backend/app/api/v1/endpoints/sync.py:172-224`
- Query: `SELECT * FROM t_d_store WHERE is_active = true ORDER BY name`
- Query: `SELECT * FROM t_d_product_group WHERE is_active = true ORDER BY name`
- Query: `SELECT * FROM t_d_product_group_hierarchy ORDER BY ancestor_id, depth`

---

### 2. GET /api/v1/sync/shopping-lists/delta

**Purpose:** Incremental sync для lists и items

**Authentication:** Required (any authenticated user)

**Query Parameters:**
- `since` (optional): Last sync timestamp (ISO 8601). Если не указан, возвращает все активные записи.

**Example Request:**
```
GET /api/v1/sync/shopping-lists/delta?since=2026-01-22T10:00:00Z
```

**Response:**
```json
{
  "created": {
    "lists": [
      {
        "id": 1,
        "creator_id": 1,
        "name": "Weekly Groceries",
        "description": "Shopping for week of 2026-01-22",
        "is_active": true,
        "created_at": "2026-01-22T11:00:00Z",
        "updated_at": "2026-01-22T11:00:00Z"
      }
    ],
    "items": [
      {
        "id": 1,
        "creator_id": 1,
        "shopping_list_id": 1,
        "store_id": 5,
        "product_group_id": 10,
        "product_name": "Milk",
        "quantity": 2.000,
        "unit": "bottles",
        "comment": null,
        "is_completed": false,
        "completed_at": null,
        "deleted_at": null,
        "last_modified_by": null,
        "created_at": "2026-01-22T11:05:00Z",
        "updated_at": "2026-01-22T11:05:00Z"
      }
    ]
  },
  "updated": {
    "lists": [
      {
        "id": 2,
        "creator_id": 1,
        "name": "Updated List Name",
        "description": "Updated description",
        "is_active": true,
        "created_at": "2026-01-20T10:00:00Z",
        "updated_at": "2026-01-22T12:00:00Z"
      }
    ],
    "items": [
      {
        "id": 5,
        "creator_id": 1,
        "shopping_list_id": 2,
        "store_id": 5,
        "product_group_id": 10,
        "product_name": "Bread Updated",
        "quantity": 3.000,
        "unit": "loaves",
        "comment": "Changed quantity",
        "is_completed": true,
        "completed_at": "2026-01-22T12:00:00Z",
        "deleted_at": null,
        "last_modified_by": 1,
        "created_at": "2026-01-20T10:00:00Z",
        "updated_at": "2026-01-22T12:00:00Z"
      }
    ]
  },
  "deleted": {
    "list_ids": [],
    "item_ids": [10, 20]
  },
  "server_time": "2026-01-22T13:00:00Z"
}
```

**Implementation:**
- File: `backend/app/api/v1/endpoints/sync.py:227-347`
- Created: `WHERE created_at > $since`
- Updated: `WHERE updated_at > $since AND created_at <= $since`
- Deleted: `WHERE deleted_at > $since` (soft delete)

**IMPORTANT:** Всегда используйте `server_time` из ответа как `since` для следующего sync запроса.

---

### 3. POST /api/v1/shopping-lists

**Purpose:** Create shopping list

**Authentication:** Required

**Request:**
```json
{
  "temp_id": "uuid-abc123",
  "name": "Weekly Groceries",
  "description": "Shopping for week",
  "is_active": true
}
```

**Response:**
```json
{
  "id": 123,
  "creator_id": 1,
  "name": "Weekly Groceries",
  "description": "Shopping for week",
  "is_active": true,
  "created_at": "2026-01-22T10:00:00Z",
  "updated_at": "2026-01-22T10:00:00Z"
}
```

**Implementation:**
- File: `backend/app/api/v1/endpoints/shopping_lists.py`
- Existing endpoint (проверить поддержку temp_id)

---

### 4. PUT /api/v1/shopping-lists/{id}

**Purpose:** Update shopping list

**Authentication:** Required

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated Description",
  "is_active": false
}
```

**Response:**
```json
{
  "id": 123,
  "name": "Updated Name",
  "description": "Updated Description",
  "is_active": false,
  "updated_at": "2026-01-22T11:00:00Z"
}
```

---

### 5. DELETE /api/v1/shopping-lists/{id}

**Purpose:** Delete shopping list (CASCADE items)

**Authentication:** Required

**Response:**
```json
{
  "status": "deleted",
  "id": 123,
  "items_deleted": 5
}
```

---

### 6. POST /api/v1/shopping-list-items/sync/batch

**Purpose:** Batch upload pending operations

**Authentication:** Required

**Request:**
```json
{
  "operations": [
    {
      "operation": "create",
      "temp_id": "uuid-item-1",
      "payload": {
        "shopping_list_id": null,
        "shopping_list_temp_id": "uuid-list-1",
        "store_id": 5,
        "product_group_id": 10,
        "product_name": "Milk",
        "quantity": 2,
        "unit": "bottles",
        "comment": null
      }
    },
    {
      "operation": "update",
      "temp_id": "uuid-item-2",
      "payload": {
        "product_name": "Bread Updated",
        "quantity": 3
      }
    },
    {
      "operation": "delete",
      "temp_id": "uuid-item-3"
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "temp_id": "uuid-item-1",
      "server_id": 456,
      "status": "success"
    },
    {
      "temp_id": "uuid-item-2",
      "server_id": 457,
      "status": "success"
    },
    {
      "temp_id": "uuid-item-3",
      "server_id": 458,
      "status": "conflict",
      "error": "Item was modified on server",
      "conflict_type": "update_update",
      "server_version": 3
    }
  ]
}
```

**Implementation:**
- File: `backend/app/api/v1/endpoints/shopping_list_items.py`
- Existing endpoint с добавленной поддержкой temp_id mapping

---

## Frontend PGlite Integration

### PGliteManager Public Methods

**Reference Data Sync:**
```typescript
// Initial sync for reference data
async syncShoppingReferenceData(
  referenceData: ShoppingReferenceData,
  onProgress?: SyncProgressCallback
): Promise<void>
```

**Incremental Sync:**
```typescript
// Apply delta sync changes with conflict resolution
async applyShoppingDeltaSync(
  delta: ShoppingDeltaSyncResponse,
  onProgress?: SyncProgressCallback
): Promise<number> // Returns conflicts count
```

**Upload Sync:**
```typescript
// Get pending operations ready for upload
async getPendingShoppingOperations(): Promise<LocalPendingOperation[]>

// Confirm successful upload
async confirmPendingShoppingOperation(
  tempId: string,
  serverId: number,
  entityType: 'shopping_list' | 'shopping_list_item'
): Promise<void>

// Retry failed upload
async retryPendingShoppingOperation(
  tempId: string,
  error: string
): Promise<void>
```

---

## Sync Flow

### 1. Initial Sync (First Launch)

```typescript
// Step 1: Fetch reference data from server
const response = await fetch('/api/v1/sync/shopping-reference');
const referenceData = await response.json();

// Step 2: Bulk insert into PGlite
await pgliteManager.syncShoppingReferenceData(referenceData, (progress) => {
  console.log(`[SYNC] ${progress.phase}: ${progress.message}`);
});

// Step 3: Update sync metadata
await pgliteManager.updateSyncMetadata('shopping_reference', {
  last_sync_timestamp: new Date(),
  total_records: referenceData.stores.length + referenceData.product_groups.length
});
```

---

### 2. Incremental Sync (Background Sync)

```typescript
// Step 1: Get last sync timestamp
const metadata = await pgliteManager.getSyncMetadata('shopping_lists');
const lastSync = metadata?.last_sync_timestamp || new Date(0);

// Step 2: Fetch delta changes from server
const response = await fetch(
  `/api/v1/sync/shopping-lists/delta?since=${lastSync.toISOString()}`
);
const delta = await response.json();

// Step 3: Apply server changes with conflict resolution
const conflictsCount = await pgliteManager.applyShoppingDeltaSync(delta, (progress) => {
  console.log(`[SYNC] ${progress.phase}: ${progress.message}`);
});

if (conflictsCount > 0) {
  console.warn(`[SYNC] Detected ${conflictsCount} conflicts (LWW applied)`);
}

// Step 4: Update sync metadata (IMPORTANT: use server_time from response)
await pgliteManager.updateSyncMetadata('shopping_lists', {
  last_sync_timestamp: new Date(delta.server_time)
});
```

---

### 3. Upload Sync (Offline Changes Upload)

```typescript
// Step 1: Get pending operations
const pending = await pgliteManager.getPendingShoppingOperations();

if (pending.length === 0) {
  console.log('[SYNC] No pending operations');
  return;
}

// Step 2: Upload in batches (100 ops per batch)
const batchSize = 100;
for (let i = 0; i < pending.length; i += batchSize) {
  const batch = pending.slice(i, i + batchSize);

  const response = await fetch('/api/v1/shopping-list-items/sync/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations: batch })
  });

  const result = await response.json();

  // Step 3: Confirm successful operations
  for (const res of result.results) {
    if (res.status === 'success') {
      const op = batch.find(b => b.temp_id === res.temp_id);
      await pgliteManager.confirmPendingShoppingOperation(
        res.temp_id!,
        res.server_id!,
        op!.entity_type as 'shopping_list' | 'shopping_list_item'
      );
    } else if (res.status === 'conflict') {
      console.warn(`[SYNC] Conflict for ${res.temp_id}: ${res.error}`);
      // LWW will be applied on next incremental sync
    } else {
      // Retry later
      await pgliteManager.retryPendingShoppingOperation(
        res.temp_id!,
        res.error || 'Unknown error'
      );
    }
  }
}
```

---

## Conflict Resolution Strategy

### LWW (Last-Write-Wins)

**Принцип:** Побеждает запись с более поздним `updated_at` timestamp.

**Реализация:**
```typescript
// File: frontend/shared/db/pglite/operations/shoppingSync.ts:380-450

async function applyUpdatedItem(db: PGlite, serverItem: LocalShoppingListItem): Promise<boolean> {
  // Fetch local record
  const result = await db.query(`
    SELECT * FROM local_shopping_list_items WHERE id = $1
  `, [serverItem.id]);

  if (result.rows.length === 0) {
    // No local record - just insert
    await insertServerItem(db, serverItem);
    return false; // No conflict
  }

  const localItem = result.rows[0] as LocalShoppingListItem;

  // Check for conflict (local pending + server updated)
  if (localItem.sync_status === 'pending') {
    const serverTime = new Date(serverItem.updated_at).getTime();
    const localTime = new Date(localItem.updated_at).getTime();

    if (serverTime > localTime) {
      // Server wins - apply server changes
      await db.query(`
        UPDATE local_shopping_list_items
        SET product_name = $2,
            quantity = $3,
            unit = $4,
            comment = $5,
            is_completed = $6,
            completed_at = $7,
            version = $8,
            updated_at = $9,
            sync_status = 'synced',
            synced_at = NOW()
        WHERE id = $1
      `, [
        serverItem.id,
        serverItem.product_name,
        serverItem.quantity,
        serverItem.unit,
        serverItem.comment,
        serverItem.is_completed,
        serverItem.completed_at,
        serverItem.version,
        serverItem.updated_at
      ]);

      logger.info('[CONFLICT] Server wins (newer timestamp)', {
        item_id: serverItem.id,
        server_time: serverItem.updated_at,
        local_time: localItem.updated_at
      });

      return true; // Conflict detected and resolved
    } else {
      // Local wins - keep pending
      logger.info('[CONFLICT] Local wins (newer timestamp)', {
        item_id: serverItem.id,
        temp_id: localItem.temp_id,
        local_time: localItem.updated_at,
        server_time: serverItem.updated_at
      });

      return true; // Conflict detected
    }
  }

  // No conflict - just update
  await updateServerItem(db, serverItem);
  return false;
}
```

**Conflict Types:**
- **update-update:** Local pending update + server update → LWW by timestamp
- **update-delete:** Local pending update + server delete → Server wins (delete)
- **delete-update:** Local pending delete + server update → Server wins (resurrect)

---

## Performance Optimizations

### Batch Operations
- Reference data sync: 100 records per batch
- Delta sync: Single transaction for all changes
- Upload sync: 100 operations per batch

### Indexes
```sql
-- Shopping lists
CREATE INDEX idx_shopping_lists_id ON local_shopping_lists(id) WHERE id IS NOT NULL;
CREATE INDEX idx_shopping_lists_sync_status ON local_shopping_lists(sync_status);

-- Shopping list items
CREATE INDEX idx_shopping_list_items_id ON local_shopping_list_items(id) WHERE id IS NOT NULL;
CREATE INDEX idx_shopping_list_items_list ON local_shopping_list_items(shopping_list_temp_id);
CREATE INDEX idx_shopping_list_items_sync_status ON local_shopping_list_items(sync_status);
CREATE INDEX idx_shopping_list_items_deleted ON local_shopping_list_items(deleted_at) WHERE deleted_at IS NULL;
```

### Deduplication
- `content_hash` для предотвращения дублирования pending operations
- `sync_hash` для conflict detection

---

## Testing

### Integration Tests

File: `frontend/shared/db/pglite/__tests__/shoppingSync.test.ts`

**Coverage:**
- ✅ Initial sync (reference data)
- ✅ Incremental sync (created/updated/deleted)
- ✅ Upload sync (pending operations)
- ✅ Conflict resolution (LWW strategy)
- ✅ Confirm/retry operations
- ✅ CASCADE delete

**Run Tests:**
```bash
npm test -- shoppingSync.test.ts
```

**Expected:** 9/9 tests pass

---

## Security Considerations

### Authentication
- Все endpoints требуют аутентификации (`Depends(get_current_user)`)
- JWT token в Authorization header

### Data Isolation
- **Shared Budget:** Все пользователи видят все данные
- `creator_id` используется только для audit, НЕ для фильтрации

### Validation
- Server валидирует все FK (store_id, product_group_id)
- PGlite НЕ имеет FK constraints (offline-first)

---

## Monitoring and Diagnostics

### Logging Prefixes
- `[SHOPPING_SYNC]` - Sync operations
- `[CONFLICT]` - Conflict resolution
- `[SHOPPING]` - CRUD operations

### Metrics
```typescript
// Get conflict metrics
const metrics = await pgliteManager.getConflictMetrics();
console.log(`Total conflicts: ${metrics.totalConflicts}`);
console.log(`Resolved: ${metrics.resolvedConflicts}`);
```

---

## Troubleshooting

### Issue: Pending operations not uploading
**Solution:** Check `attempts < max_attempts` (default: 3)

### Issue: Conflicts not resolving
**Solution:** Check `updated_at` timestamps in server vs local

### Issue: Reference data not syncing
**Solution:** Check `DELETE FROM local_stores` clears old data

### Issue: Items orphaned after list delete
**Solution:** Check CASCADE soft delete in `deleteShoppingList()`

---

## Future Enhancements

### Phase 1 (Completed)
- ✅ Basic sync protocol (initial, incremental, upload)
- ✅ LWW conflict resolution
- ✅ Reference data sync

### Phase 2 (Planned)
- 🔄 Optimistic UI updates
- 🔄 Background sync worker
- 🔄 Retry backoff strategy
- 🔄 Partial sync (chunking large datasets)

### Phase 3 (Future)
- 📋 Multi-device sync
- 📋 Real-time sync via WebSocket
- 📋 Compression for large payloads
- 📋 Offline conflict resolution UI

---

## References

- **Plan:** `/docs/architecture/plans/gleaming-jumping-starfish.md`
- **Backend Code:** `backend/app/api/v1/endpoints/sync.py`
- **Frontend Code:** `frontend/shared/db/pglite/operations/shoppingSync.ts`
- **PGliteManager:** `frontend/shared/db/pglite/PGliteManager.ts:961-1012`
- **Tests:** `frontend/shared/db/pglite/__tests__/shoppingSync.test.ts`

---

**Last Updated:** 2026-01-22
**Author:** Claude Code (task-012)
**Status:** ✅ Implemented and Tested
