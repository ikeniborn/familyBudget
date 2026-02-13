# Shopping Lists: Полная оффлайн-поддержка и синхронизация

## Context

Shopping Lists страдает от трёх критических проблем, блокирующих нормальную работу в оффлайн-режиме и мультиклиентской синхронизации:

1. **Dexie Race Condition**: После создания товара через `createShoppingListItem()`, немедленный query через `queryShoppingListItems()` возвращает пустой массив, т.к. IndexedDB transaction ещё не завершён. Это вызывает ложный API fallback, игнорируя локально созданные данные.

2. **Missing WebSocket Events**: WebSocket реализован только для shopping list ITEMS (`item_created`, `item_updated`, `item_deleted`), но отсутствуют события для самих shopping LISTS. После создания/удаления списка dashboard не обновляется без перезагрузки страницы.

3. **Отсутствие оффлайн-поддержки для списков**: Текущая реализация Dexie хранит только shopping list items, но не сами shopping lists. Это блокирует создание/удаление списков в оффлайне.

**Бизнес-импакт**:
- Пользователи видят пустые списки после добавления товаров (проблема 1)
- Второй пользователь не видит созданные/удалённые списки без refresh (проблема 2)
- Невозможно создать список в метро/самолёте (проблема 3)

**Требования пользователя**:
- ✅ Все три проблемы равноприоритетны - комплексное решение
- ✅ Полная оффлайн-поддержка для создания/удаления списков
- ✅ Last-write-wins для conflict resolution

---

## Problems Analysis

### Problem 1: ID Mapping Bug (НЕ race condition!)

**Файлы**: `frontend/web/static/js/lists/listsManager/core/listOperations.ts`, `frontend/web/static/js/lists/listsManager/core/stateManager.ts`

**РЕАЛЬНАЯ проблема - несоответствие типов ID:**

```typescript
// listOperations.ts:137 - передаётся ЧИСЛОВОЙ ID
await loadShoppingListItems(state.currentListId);  // currentListId = 1 (number)

// stateManager.ts:230 - конвертация числа в строку
const listTempId = String(listId);  // String(1) = "1" (НЕ UUID!)

// stateManager.ts:231 - query с неправильным ID
const localItems = await dataLayer.getShoppingListItems(listTempId);  // "1"

// shoppingOperations.ts:113-115 - query по shopping_list_temp_id
const items = await db.shoppingListItems
  .where('shopping_list_temp_id')
  .equals(shopping_list_temp_id)  // ← Ищет "1", но реальные items имеют UUID!
  .toArray();  // Возвращает [] (пустой массив)

// DataLayer.ts:789 - ложный API fallback
if (result.length === 0) {
  // Items существуют в Dexie, но query их не нашёл из-за неправильного ID
  return await this.getShoppingListItemsFromAPI(listTempId, filters);
}
```

**Root cause**:
- Shopping list items хранятся с `shopping_list_temp_id` (UUID строка типа "290498dc-43d5-41ce-b8de-2af8bf43b941")
- UI передаёт `state.currentListId` (числовое ID типа 1, 2, 3)
- `String(1)` даёт `"1"`, а НЕ UUID
- Query не находит записи → пустой массив → API fallback игнорирует локальные данные

**Доказательство** (ListsState.ts:19):
```typescript
export interface ShoppingList {
  id: number;
  temp_id?: string;  // ✅ УЖЕ ЕСТЬ, но НЕ используется!
```

### Problem 2: Missing WebSocket Events

**Файлы**: `backend/app/api/v1/endpoints/budget_ws.py`, `backend/app/api/v1/endpoints/shopping_lists.py`

**Текущее состояние**:
- ✅ Реализовано: `broadcast_item_created/updated/deleted/completed` (строки 1123-1146)
- ❌ ОТСУТСТВУЕТ: `broadcast_shopping_list_created/updated/deleted`

**Последствия**:
```python
# shopping_lists.py:133 - create endpoint
return ShoppingListResponse.model_validate(shopping_list)
# ❌ НЕТ broadcast - второй клиент не узнает о новом списке
```

### Problem 3: Отсутствие оффлайн-поддержки для списков

**Файлы**: `frontend/shared/db/dexie/database.ts`, `frontend/shared/db/dexie/operations/shoppingOperations.ts`

**Текущее состояние**:
```typescript
// database.ts - ТОЛЬКО items, НЕТ lists
shoppingListItems!: Table<LocalShoppingListItem, number>;

// НЕТ:
// shoppingLists!: Table<LocalShoppingList, number>;
```

**Последствия**:
- Создание списка требует онлайн (POST `/api/v1/shopping-lists`)
- Удаление списка требует онлайн (DELETE `/api/v1/shopping-lists/{id}`)
- В оффлайне нельзя организовать покупки

---

## Solution Design

### Solution 1: Fix ID Mapping Bug - Использовать temp_id вместо ID

**Стратегия**: Передавать правильный UUID `temp_id` в Dexie операции, вместо числового `ID`:

**Изменения**:

**1. Обновить `listOperations.ts:createItem()`** (строка 136-138):
```typescript
// ❌ УБРАТЬ (передаёт числовой ID):
if (state.currentListId) {
  await loadShoppingListItems(state.currentListId);
}

// ✅ ДОБАВИТЬ (передаёт UUID temp_id):
const currentList = state.shoppingLists.find(l => l.id === state.currentListId);
if (currentList?.temp_id) {
  await loadShoppingListItems(currentList.temp_id);
} else {
  // Fallback: если temp_id отсутствует (старые списки), используй API
  console.warn('[LIST_OPS] No temp_id for list, using numeric ID fallback');
  await loadShoppingListItems(state.currentListId);
}
```

**2. Обновить `stateManager.ts:loadShoppingListItems()`** (строка 226-231):
```typescript
export async function loadShoppingListItems(listId: number | string): Promise<void> {
  try {
    // ✅ ИЗМЕНИТЬ: НЕ конвертировать число в строку, передать как есть
    // Если listId уже UUID (строка) - используй его напрямую
    // Если listId число - это fallback для старых списков без temp_id

    const listTempId = typeof listId === 'string' ? listId : String(listId);

    // ⚠️ ВАЖНО: передаём правильный temp_id, а НЕ конвертированное число
    const localItems = await dataLayer.getShoppingListItems(listTempId);
```

**3. Гарантировать наличие temp_id в shopping lists** (обновить `convertShoppingList()`):
```typescript
// stateManager.ts:50+ - убедиться что temp_id сохраняется
function convertShoppingList(local: LocalShoppingList | ShoppingListWithStats): ShoppingList {
  return {
    id: local.id ?? 0,
    temp_id: local.temp_id,  // ✅ КРИТИЧНО: сохранить temp_id!
    name: local.name,
    is_active: local.is_active ?? true,
    created_at: local.created_at?.toISOString() ?? new Date().toISOString(),
    updated_at: local.updated_at?.toISOString() ?? new Date().toISOString(),
    description: local.description,
    total_items: 'total_items' in local ? local.total_items : undefined,
    completed_items: 'completed_items' in local ? local.completed_items : undefined,
    completion_percentage: 'completion_percentage' in local ? local.completion_percentage : undefined
  };
}
```

**Преимущества**:
- ✅ Eliminates ложный API fallback полностью
- ✅ Dexie query находит правильные записи
- ✅ Снижение network calls на 100% (работает полностью offline)
- ✅ Минимальные изменения (3 места, ~10 строк кода)

### Solution 2: Implement WebSocket Events для Shopping Lists

#### Backend Changes

**Файл**: `backend/app/api/v1/endpoints/budget_ws.py`

**Добавить** (после строки 931):
```python
SAFE_SHOPPING_LIST_FIELDS = {
    "id", "name", "description", "creator_id",
    "is_active", "total_items", "completed_items",
    "completion_percentage", "created_at", "updated_at",
}

def _filter_shopping_list_data(list_data: dict) -> dict:
    """Filter shopping list data to include only safe fields."""
    return {k: v for k, v in list_data.items() if k in SAFE_SHOPPING_LIST_FIELDS}
```

**Добавить** (после строки 1147):
```python
async def broadcast_shopping_list_created(list_data: dict):
    """Broadcast shopping list created event."""
    filtered_data = _filter_shopping_list_data(list_data)
    logger.debug(f"broadcast_shopping_list_created: list_id={list_data.get('id')}")
    await _broadcast_and_buffer("shopping_list_created", filtered_data)

async def broadcast_shopping_list_updated(list_data: dict):
    """Broadcast shopping list updated event."""
    filtered_data = _filter_shopping_list_data(list_data)
    logger.debug(f"broadcast_shopping_list_updated: list_id={list_data.get('id')}")
    await _broadcast_and_buffer("shopping_list_updated", filtered_data)

async def broadcast_shopping_list_deleted(list_id: int):
    """Broadcast shopping list deleted event."""
    logger.debug(f"broadcast_shopping_list_deleted: list_id={list_id}")
    await _broadcast_and_buffer("shopping_list_deleted", {"id": list_id})
```

**Файл**: `backend/app/api/v1/endpoints/shopping_lists.py`

**Импорт** (начало файла):
```python
from app.api.v1.endpoints.budget_ws import (
    broadcast_shopping_list_created,
    broadcast_shopping_list_updated,
    broadcast_shopping_list_deleted,
)
```

**Интеграция** (после строки 133 в `create_shopping_list`):
```python
response = ShoppingListResponse.model_validate(shopping_list)

# ✅ ДОБАВИТЬ:
try:
    await broadcast_shopping_list_created(response.model_dump(mode="json"))
except Exception as e:
    logger.warning(f"WebSocket broadcast failed for created list {shopping_list.id}: {e}")

return response
```

**Интеграция** (после строки 261 в `update_shopping_list`):
```python
response = ShoppingListResponse.model_validate(updated_list)

# ✅ ДОБАВИТЬ:
try:
    await broadcast_shopping_list_updated(response.model_dump(mode="json"))
except Exception as e:
    logger.warning(f"WebSocket broadcast failed for updated list {shopping_list_id}: {e}")

return response
```

**Интеграция** (после строки 416 в `delete_shopping_list`):
```python
await session.commit()

# ✅ ДОБАВИТЬ:
try:
    await broadcast_shopping_list_deleted(shopping_list_id)
except Exception as e:
    logger.warning(f"WebSocket broadcast failed for deleted list {shopping_list_id}: {e}")

logger.info(...)
return None
```

#### Frontend Changes

**Файл**: `frontend/web/static/js/budget/budgetWSClient/types/events.ts`

**Добавить** (новые interfaces):
```typescript
export interface ShoppingListCreatedEvent {
  id: number;
  name: string;
  description: string | null;
  creator_id: number;
  is_active: boolean;
  total_items: number;
  completed_items: number;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListUpdatedEvent extends ShoppingListCreatedEvent {}

export interface ShoppingListDeletedEvent {
  id: number;
}
```

**Файл**: `frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts`

**Добавить** (новые handlers):
```typescript
function handleShoppingListCreated(data: ShoppingListCreatedEvent): void {
  console.log('[WS] Shopping list created:', data);
  notifyHandlers('shopping_list_created', data);

  // Refresh dashboard if on landing view
  if (window.listsManager?.refreshDashboard) {
    window.listsManager.refreshDashboard('created', data);
  }
}

function handleShoppingListUpdated(data: ShoppingListUpdatedEvent): void {
  console.log('[WS] Shopping list updated:', data);
  notifyHandlers('shopping_list_updated', data);

  if (window.listsManager?.refreshDashboard) {
    window.listsManager.refreshDashboard('updated', data);
  }
}

function handleShoppingListDeleted(data: ShoppingListDeletedEvent): void {
  console.log('[WS] Shopping list deleted:', data);
  notifyHandlers('shopping_list_deleted', data);

  if (window.listsManager?.refreshDashboard) {
    window.listsManager.refreshDashboard('deleted', data);
  }
}
```

**Обновить** `dispatchEvent()` switch (после строки 189):
```typescript
case 'shopping_list_created':
  handleShoppingListCreated(eventData as ShoppingListCreatedEvent);
  break;
case 'shopping_list_updated':
  handleShoppingListUpdated(eventData as ShoppingListUpdatedEvent);
  break;
case 'shopping_list_deleted':
  handleShoppingListDeleted(eventData as ShoppingListDeletedEvent);
  break;
```

**Файл**: `frontend/web/static/js/lists/listsManager/rendering/listRenderer.ts`

**Добавить** (новый public метод):
```typescript
/**
 * Refresh dashboard when WebSocket event received
 */
export async function refreshDashboard(
  eventType: 'created' | 'updated' | 'deleted',
  eventData?: any
): Promise<void> {
  const state = getState();

  // Only refresh if on landing view (skip if in detail view)
  const landingView = document.getElementById('landing-view');
  if (!landingView || landingView.classList.contains('hidden')) {
    console.debug('[RENDERER] Skip refresh - not on landing view');
    return;
  }

  console.log(`[RENDERER] Refreshing dashboard for ${eventType} event`, eventData);

  // Reload lists from server (invalidates cache)
  await loadShoppingLists();

  // Re-render cards
  renderShoppingListCards();

  // Show toast notification
  const messages = {
    created: `Новый список создан: ${eventData?.name || 'без названия'}`,
    updated: `Список обновлён: ${eventData?.name || 'без названия'}`,
    deleted: 'Список удалён'
  };
  showToast(messages[eventType], 'info');
}

// Export via window для WebSocket handlers
if (typeof window !== 'undefined') {
  window.listsManager = window.listsManager || {};
  window.listsManager.refreshDashboard = refreshDashboard;
}
```

### Solution 3: Полная оффлайн-поддержка для Shopping Lists

#### Dexie Schema Extension

**Файл**: `frontend/shared/db/dexie/types/shoppingList.ts`

**Создать** новый файл:
```typescript
export interface LocalShoppingList {
  id: number | null;              // Server ID (null before first sync)
  temp_id: string;                 // Client UUID (primary key)
  creator_id: number;              // Who created it
  name: string;                    // List name
  description: string | null;      // Optional description
  is_active: boolean;              // Active or archived
  total_items: number;             // Computed from items count
  completed_items: number;         // Computed from completed items
  completion_percentage: number;   // Computed: (completed/total) * 100
  sync_status: 'pending' | 'synced' | 'conflict' | 'deleted';
  sync_hash: string | null;        // For conflict detection
  deleted_at: Date | null;         // Soft delete marker
  created_at: Date;
  updated_at: Date;
  synced_at: Date | null;
}
```

**Файл**: `frontend/shared/db/dexie/database.ts`

**Обновить** schema (добавить после строки 141):
```typescript
shoppingLists!: Table<LocalShoppingList, number>;
```

**Обновить** version definition (increment version, добавить новый schema):
```typescript
this.version(2).stores({
  // Existing tables...
  shoppingListItems: 'temp_id, id, creator_id, shopping_list_temp_id, position, sync_status, [shopping_list_temp_id+position]',

  // ✅ NEW: Shopping lists table
  shoppingLists: 'temp_id, id, creator_id, name, is_active, sync_status',
});
```

#### Dexie Operations

**Файл**: `frontend/shared/db/dexie/operations/shoppingListOps.ts`

**Создать** новый файл с CRUD операциями:
```typescript
import { db } from '../database';
import { LocalShoppingList } from '../types/shoppingList';
import { generateUUID } from '../utils/uuid';
import logger from '../utils/logger';

/**
 * CREATE: Create shopping list in Dexie
 */
export async function createShoppingList(
  list: Omit<LocalShoppingList, 'id' | 'temp_id' | 'sync_status' | 'created_at' | 'updated_at' | 'total_items' | 'completed_items' | 'completion_percentage'>
): Promise<string> {
  logger.debug('[shoppingListOps] createShoppingList', list);

  const temp_id = generateUUID();

  const newList: LocalShoppingList = {
    id: null,
    temp_id,
    ...list,
    is_active: list.is_active ?? true,
    total_items: 0,
    completed_items: 0,
    completion_percentage: 0,
    sync_status: 'pending',
    sync_hash: null,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    synced_at: null
  };

  await db.shoppingLists.add(newList);

  logger.info('[shoppingListOps] ✅ Shopping list created', { temp_id, name: list.name });
  return temp_id;
}

/**
 * READ: Query all shopping lists
 */
export async function queryShoppingLists(
  filters?: { is_active?: boolean; sync_status?: string }
): Promise<LocalShoppingList[]> {
  logger.debug('[shoppingListOps] queryShoppingLists', { filters });

  let query = db.shoppingLists.toCollection();

  if (filters?.is_active !== undefined) {
    query = query.filter(list => list.is_active === filters.is_active);
  }

  if (filters?.sync_status) {
    query = query.filter(list => list.sync_status === filters.sync_status);
  }

  // Exclude soft-deleted
  query = query.filter(list => list.deleted_at === null);

  const lists = await query.toArray();

  // Sort by updated_at DESC (newest first)
  return lists.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
}

/**
 * READ: Query single shopping list by temp_id
 */
export async function getShoppingListByTempId(temp_id: string): Promise<LocalShoppingList | undefined> {
  logger.debug('[shoppingListOps] getShoppingListByTempId', { temp_id });
  return await db.shoppingLists.where('temp_id').equals(temp_id).first();
}

/**
 * UPDATE: Update shopping list
 */
export async function updateShoppingList(
  temp_id: string,
  updates: Partial<Omit<LocalShoppingList, 'id' | 'temp_id' | 'creator_id' | 'created_at'>>
): Promise<void> {
  logger.debug('[shoppingListOps] updateShoppingList', { temp_id, updates });

  await db.shoppingLists.where('temp_id').equals(temp_id).modify({
    ...updates,
    sync_status: 'pending',  // Mark as needing sync
    updated_at: new Date()
  });

  logger.info('[shoppingListOps] ✅ Shopping list updated', { temp_id });
}

/**
 * DELETE: Soft delete shopping list
 */
export async function deleteShoppingList(temp_id: string): Promise<void> {
  logger.debug('[shoppingListOps] deleteShoppingList', { temp_id });

  await db.shoppingLists.where('temp_id').equals(temp_id).modify({
    sync_status: 'deleted',
    deleted_at: new Date(),
    updated_at: new Date()
  });

  logger.info('[shoppingListOps] ✅ Shopping list deleted', { temp_id });
}

/**
 * SYNC: Update statistics (total_items, completed_items)
 */
export async function updateShoppingListStats(shopping_list_temp_id: string): Promise<void> {
  const items = await db.shoppingListItems
    .where('shopping_list_temp_id')
    .equals(shopping_list_temp_id)
    .toArray();

  const total = items.filter(i => i.deleted_at === null).length;
  const completed = items.filter(i => i.is_completed && i.deleted_at === null).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  await db.shoppingLists.where('temp_id').equals(shopping_list_temp_id).modify({
    total_items: total,
    completed_items: completed,
    completion_percentage: percentage,
    updated_at: new Date()
  });

  logger.debug('[shoppingListOps] Stats updated', {
    shopping_list_temp_id,
    total,
    completed,
    percentage
  });
}
```

#### Sync Module

**Файл**: `frontend/shared/db/dexie/operations/shoppingListSync.ts`

**Создать** модуль синхронизации:
```typescript
import { db } from '../database';
import { LocalShoppingList } from '../types/shoppingList';
import { fetchWithTimeout } from '../utils/fetch';
import logger from '../utils/logger';

/**
 * Upload pending shopping lists to server
 */
export async function uploadPendingShoppingLists(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  logger.info('[shoppingListSync] Uploading pending shopping lists...');

  const pendingLists = await db.shoppingLists
    .where('sync_status').equals('pending')
    .toArray();

  if (pendingLists.length === 0) {
    logger.info('[shoppingListSync] No pending shopping lists');
    return { success: true, uploaded: 0, failed: 0 };
  }

  logger.info('[shoppingListSync] Found pending lists', { count: pendingLists.length });

  let uploaded = 0;
  let failed = 0;

  for (const list of pendingLists) {
    try {
      await uploadShoppingList(list);
      uploaded++;
    } catch (error) {
      logger.error('[shoppingListSync] ❌ List upload failed:', error);
      failed++;
    }
  }

  logger.info('[shoppingListSync] Upload complete', { uploaded, failed });

  return {
    success: failed === 0,
    uploaded,
    failed
  };
}

/**
 * Upload single shopping list to server
 */
async function uploadShoppingList(list: LocalShoppingList): Promise<void> {
  logger.debug('[shoppingListSync] Uploading shopping list', {
    temp_id: list.temp_id,
    id: list.id,
    name: list.name
  });

  let endpoint: string;
  let method: string;

  if (list.id === null) {
    // CREATE: new list hasn't been synced yet
    endpoint = '/api/v1/shopping-lists';
    method = 'POST';
  } else if (list.sync_status === 'deleted') {
    // DELETE: list marked for deletion
    endpoint = `/api/v1/shopping-lists/${list.id}`;
    method = 'DELETE';
  } else {
    // UPDATE: list already has server ID
    endpoint = `/api/v1/shopping-lists/${list.id}`;
    method = 'PUT';
  }

  const response = await fetchWithTimeout(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method !== 'DELETE' ? JSON.stringify({
      name: list.name,
      description: list.description,
      is_active: list.is_active
    }) : undefined,
    credentials: 'include'
  });

  if (!response.ok) {
    // Last-write-wins: 404 на DELETE означает, что кто-то уже удалил
    if (response.status === 404 && method === 'DELETE') {
      logger.info('[shoppingListSync] List already deleted on server', { temp_id: list.temp_id });
      await db.shoppingLists.where('temp_id').equals(list.temp_id).delete();
      return;
    }

    throw new Error(`Server error: ${response.status}`);
  }

  // Update local list as synced
  if (method === 'DELETE') {
    await db.shoppingLists.where('temp_id').equals(list.temp_id).delete();
  } else if (list.id === null) {
    const result = await response.json();
    await db.shoppingLists.where('temp_id').equals(list.temp_id).modify({
      id: result.id,  // ← Server assigns permanent ID
      sync_status: 'synced',
      synced_at: new Date()
    });
  } else {
    await db.shoppingLists.where('temp_id').equals(list.temp_id).modify({
      sync_status: 'synced',
      synced_at: new Date()
    });
  }

  logger.info('[shoppingListSync] ✅ List uploaded', { temp_id: list.temp_id });
}
```

#### Frontend Integration

**Файл**: `frontend/web/static/js/lists/listsManager/core/listOperations.ts`

**Обновить** `createList()`:
```typescript
export async function createList(data: { name: string; description?: string }): Promise<any> {
  const pglite = await getDexieManager();

  try {
    let result;

    // Dexie-first strategy (НОВОЕ!)
    if (isDexieActive() && pglite.isReady()) {
      const userId = await getCurrentUserId();

      // Create in Dexie (offline-first)
      const temp_id = await createShoppingList({
        creator_id: userId,
        name: data.name,
        description: data.description ?? null,
        is_active: true,
        sync_hash: null,
        deleted_at: null
      });

      result = await getShoppingListByTempId(temp_id);

      console.log('[LIST_OPS] Shopping list created in Dexie', { temp_id });

      // Background sync (non-blocking)
      queueMicrotask(async () => {
        try {
          await uploadPendingShoppingLists();
        } catch (error) {
          console.error('[LIST_OPS] Background sync failed:', error);
        }
      });
    } else {
      // API fallback (online-only)
      const response = await fetch('/api/v1/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to create shopping list: ${response.status}`);
      }

      result = await response.json();
    }

    // Optimistic UI update
    updateState({
      shoppingLists: [...state.shoppingLists, result]
    });

    return result;

  } catch (error) {
    console.error('[LIST_OPS] Error creating shopping list:', error);
    throw error;
  }
}
```

**Обновить** `deleteList()`:
```typescript
export async function deleteList(listId: number, listTempId: string): Promise<void> {
  const pglite = await getDexieManager();

  try {
    // Optimistic delete (UI update immediately)
    updateState({
      shoppingLists: state.shoppingLists.filter(l => l.id !== listId)
    });

    // Dexie-first strategy
    if (isDexieActive() && pglite.isReady() && listTempId) {
      await deleteShoppingList(listTempId);

      console.log('[LIST_OPS] Shopping list deleted in Dexie', { listTempId });

      // Background sync
      queueMicrotask(async () => {
        try {
          await uploadPendingShoppingLists();
        } catch (error) {
          console.error('[LIST_OPS] Background sync failed:', error);
        }
      });
    } else {
      // API fallback
      const response = await fetch(`/api/v1/shopping-lists/${listId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok && response.status !== 404) {
        // Rollback optimistic delete on error (except 404 - already deleted)
        throw new Error(`Failed to delete shopping list: ${response.status}`);
      }
    }

  } catch (error) {
    console.error('[LIST_OPS] Error deleting shopping list:', error);

    // Rollback optimistic delete
    await loadShoppingLists();
    renderShoppingListCards();

    throw error;
  }
}
```

---

## Implementation Plan

### Phase 1: Backend WebSocket Events (4-6 hours)

**Files**:
- `/backend/app/api/v1/endpoints/budget_ws.py`
- `/backend/app/api/v1/endpoints/shopping_lists.py`

**Tasks**:
1. ✅ Добавить `SAFE_SHOPPING_LIST_FIELDS` constant
2. ✅ Реализовать `_filter_shopping_list_data()`
3. ✅ Реализовать `broadcast_shopping_list_created/updated/deleted()`
4. ✅ Интегрировать broadcasts в `create_shopping_list()` (после строки 133)
5. ✅ Интегрировать broadcasts в `update_shopping_list()` (после строки 261)
6. ✅ Интегрировать broadcasts в `delete_shopping_list()` (после строки 416)
7. ✅ Тестирование: curl POST/PUT/DELETE, проверить WebSocket messages

### Phase 2: Frontend WebSocket Handlers (3-4 hours)

**Files**:
- `/frontend/web/static/js/budget/budgetWSClient/types/events.ts`
- `/frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts`
- `/frontend/web/static/js/lists/listsManager/rendering/listRenderer.ts`

**Tasks**:
1. ✅ Добавить `ShoppingListCreatedEvent/UpdatedEvent/DeletedEvent` interfaces
2. ✅ Реализовать `handleShoppingListCreated/Updated/Deleted()` handlers
3. ✅ Обновить `dispatchEvent()` switch statement
4. ✅ Реализовать `refreshDashboard()` в `listRenderer.ts`
5. ✅ Экспортировать в `window.listsManager.refreshDashboard`
6. ✅ Тестирование: открыть 2 вкладки, создать/удалить список в Tab A → проверить Tab B

### Phase 3: Dexie Shopping Lists Support (8-10 hours)

**Files**:
- `/frontend/shared/db/dexie/types/shoppingList.ts` (НОВЫЙ)
- `/frontend/shared/db/dexie/database.ts`
- `/frontend/shared/db/dexie/operations/shoppingListOps.ts` (НОВЫЙ)
- `/frontend/shared/db/dexie/operations/shoppingListSync.ts` (НОВЫЙ)

**Tasks**:
1. ✅ Создать `LocalShoppingList` interface
2. ✅ Обновить `database.ts` - добавить `shoppingLists` table (version 2)
3. ✅ Реализовать CRUD: `createShoppingList/queryShoppingLists/updateShoppingList/deleteShoppingList`
4. ✅ Реализовать `updateShoppingListStats()` (синхронизация total_items/completed_items)
5. ✅ Реализовать `uploadPendingShoppingLists()` sync модуль
6. ✅ Обработать Last-write-wins (404 на DELETE → удалить локально)
7. ✅ Тестирование: создать список offline → online → проверить sync

### Phase 4: Fix ID Mapping Bug (1-2 hours)

**Files**:
- `/frontend/web/static/js/lists/listsManager/core/listOperations.ts`
- `/frontend/web/static/js/lists/listsManager/core/stateManager.ts`

**Tasks**:
1. ✅ Обновить `listOperations.ts:createItem()` (строки 136-138)
   - Найти `currentList` по `state.currentListId`
   - Передать `currentList.temp_id` вместо `state.currentListId`
   - Добавить fallback для списков без `temp_id`

2. ✅ Обновить `stateManager.ts:convertShoppingList()` (строки 50+)
   - Гарантировать сохранение `temp_id` в `ShoppingList` объектах
   - Проверить что API responses содержат `temp_id`

3. ✅ Добавить логирование для debugging
   - Log `temp_id` vs `id` при вызове `loadShoppingListItems()`
   - Warning если `temp_id` отсутствует

4. ✅ Обновить `createList()` + `deleteList()` аналогично (use temp_id)

5. ✅ Тестирование:
   - Console: проверить ОТСУТСТВИЕ "[DATA_LAYER] Dexie returned empty"
   - Создать item → проверить немедленное отображение без API call
   - Network tab: verify NO API GET request после создания

### Phase 5: Integration Testing (4-5 hours)

**Test scenarios**:

1. **Multi-client sync**:
   - Открыть 2 браузера (Chrome + Firefox)
   - Tab A: создать список "Продукты"
   - Tab B: проверить появление списка через WebSocket (~2 сек)
   - Tab A: удалить список
   - Tab B: проверить исчезновение

2. **Offline mode**:
   - DevTools → Network → Offline
   - Создать список "Оффлайн тест"
   - Добавить 3 товара
   - DevTools → Online
   - Проверить синхронизацию (pending → synced)

3. **Race condition fix**:
   - Создать товар "Молоко"
   - Проверить НЕМЕДЛЕННОЕ отображение (без задержки)
   - Console: проверить ОТСУТСТВИЕ "[DATA_LAYER] Dexie returned empty"

4. **Conflict resolution (Last-write-wins)**:
   - Tab A + Tab B: открыть один список
   - Tab A: DELETE список → success
   - Tab B: DELETE тот же список → 404
   - Tab B: WebSocket получает `shopping_list_deleted` → dashboard обновляется

5. **Optimistic delete**:
   - Создать список с 5 товарами
   - DELETE список
   - Проверить НЕМЕДЛЕННОЕ исчезновение из UI (optimistic)
   - Console: проверить background sync

---

## Critical Files

### Backend (5 files)

1. `/backend/app/api/v1/endpoints/budget_ws.py`
   - Lines 931+: `SAFE_SHOPPING_LIST_FIELDS`
   - Lines 1147+: `broadcast_shopping_list_*` functions

2. `/backend/app/api/v1/endpoints/shopping_lists.py`
   - Import broadcasts (top)
   - Line 133+: integrate `broadcast_shopping_list_created`
   - Line 261+: integrate `broadcast_shopping_list_updated`
   - Line 416+: integrate `broadcast_shopping_list_deleted`

### Frontend (8 files)

3. `/frontend/shared/db/dexie/types/shoppingList.ts` (NEW)
   - `LocalShoppingList` interface

4. `/frontend/shared/db/dexie/database.ts`
   - Add `shoppingLists` table (version 2 schema)

5. `/frontend/shared/db/dexie/operations/shoppingListOps.ts` (NEW)
   - CRUD operations for shopping lists

6. `/frontend/shared/db/dexie/operations/shoppingListSync.ts` (NEW)
   - Sync module with Last-write-wins

7. `/frontend/web/static/js/budget/budgetWSClient/types/events.ts`
   - `ShoppingListCreatedEvent/UpdatedEvent/DeletedEvent` interfaces

8. `/frontend/web/static/js/budget/budgetWSClient/integration/eventHandlers.ts`
   - Lines 160+: new handlers
   - Lines 189+: update `dispatchEvent()` switch

9. `/frontend/web/static/js/lists/listsManager/rendering/listRenderer.ts`
   - New `refreshDashboard()` method
   - Export via `window.listsManager`

10. `/frontend/web/static/js/lists/listsManager/core/listOperations.ts`
    - Lines 84+: fix `createItem()` race condition
    - Update `createList()` - Dexie-first
    - Update `deleteList()` - optimistic delete

---

## Verification

### Unit Tests

**Backend**:
```bash
# Test WebSocket broadcasts
curl -X POST http://localhost:8000/api/v1/shopping-lists \
  -H "Content-Type: application/json" \
  -d '{"name": "Test List", "description": "WS test"}' \
  --cookie "session=..."

# Check logs for broadcast
grep "broadcast_shopping_list_created" backend/logs/app.log
```

**Frontend**:
```javascript
// Browser console
const dexie = await window.getDexieManager();
const tempId = await window.createShoppingList({
  creator_id: 1,
  name: "Dexie Test",
  description: null,
  is_active: true
});
console.log('Created:', tempId);

const lists = await window.queryShoppingLists();
console.log('All lists:', lists);
```

### Integration Tests

**Multi-client sync** (manual):
1. Open Chrome DevTools → Application → IndexedDB → verify `shoppingLists` table
2. Open 2 tabs: localhost:8000/lists
3. Tab A: create list → Tab B: verify WebSocket event in Network tab
4. Tab A: delete list → Tab B: verify immediate UI update

**Offline mode** (manual):
1. DevTools → Network → Offline
2. Create list "Offline Test" → verify success toast
3. DevTools → Application → IndexedDB → verify `sync_status: 'pending'`
4. DevTools → Network → Online
5. Wait 5 seconds → verify `sync_status: 'synced'`

**Performance** (Chrome DevTools):
```javascript
// Measure optimistic UI update speed
console.time('createItem');
await window.listsManager.createItem({
  product_name: 'Test Product',
  store_id: 1,
  product_group_id: 1
});
console.timeEnd('createItem');
// Expected: <100ms (was ~600ms before fix)
```

### E2E Tests (Playwright)

**Добавить** в `tests/e2e/webapp/shopping-lists.spec.ts`:
```typescript
test('Multi-client shopping list sync', async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  await page1.goto('/lists');
  await page2.goto('/lists');

  // Tab 1: create list
  await page1.click('button:has-text("Создать список")');
  await page1.fill('input[name="name"]', 'Sync Test');
  await page1.click('button:has-text("Сохранить")');

  // Tab 2: verify WebSocket sync (max 5 seconds)
  await page2.waitForSelector('text=Sync Test', { timeout: 5000 });

  // Tab 1: delete list
  await page1.click('button[data-list-name="Sync Test"]');

  // Tab 2: verify deletion sync
  await expect(page2.locator('text=Sync Test')).toBeHidden({ timeout: 5000 });
});

test('Offline shopping list creation', async ({ page, context }) => {
  await context.route('**/*', route => route.abort());  // Block all network

  await page.goto('/lists');

  // Create list offline
  await page.click('button:has-text("Создать список")');
  await page.fill('input[name="name"]', 'Offline List');
  await page.click('button:has-text("Сохранить")');

  // Verify optimistic UI
  await expect(page.locator('text=Offline List')).toBeVisible();

  // Restore network
  await context.unroute('**/*');

  // Wait for sync (check network tab for POST request)
  await page.waitForResponse(resp =>
    resp.url().includes('/api/v1/shopping-lists') &&
    resp.request().method() === 'POST'
  );

  // Verify synced
  const syncStatus = await page.evaluate(() => {
    return window.queryShoppingLists().then(lists =>
      lists.find(l => l.name === 'Offline List')?.sync_status
    );
  });
  expect(syncStatus).toBe('synced');
});
```

### Success Criteria

✅ **Problem 1 (ID Mapping Bug)**:
- `createItem()` передаёт правильный UUID `temp_id` в `loadShoppingListItems()`
- Dexie query находит созданные items (no false-positive API fallback)
- Console НЕ содержит "[DATA_LAYER] Dexie returned empty" после создания item
- Network tab: NO GET request `/api/v1/shopping-list-items` после создания

✅ **Problem 2 (WebSocket)**:
- Multi-client dashboard sync происходит в течение 2 секунд
- WebSocket events видны в Network tab: `shopping_list_created/updated/deleted`
- Backend logs содержат "broadcast_shopping_list_*"

✅ **Problem 3 (Offline)**:
- Списки создаются/удаляются в offline mode
- IndexedDB содержит `shoppingLists` table
- `sync_status: 'pending'` → `'synced'` после reconnect
- Last-write-wins: 404 на DELETE → локальное удаление без ошибки

---

## Estimated Timeline

| Phase | Hours | Notes |
|-------|-------|-------|
| Backend WebSocket | 4-6h | Broadcast functions + integration |
| Frontend WebSocket | 3-4h | Event handlers + UI refresh |
| Dexie Shopping Lists | 8-10h | Schema + CRUD + Sync |
| Fix ID Mapping Bug | 1-2h | Use temp_id instead of ID (простое исправление!) |
| Testing | 4-5h | Manual + E2E tests |
| **TOTAL** | **20-27h** | ~3-4 рабочих дня |

---

## Rollback Plan

Если после деплоя возникнут критические проблемы:

1. **Откат Backend** (WebSocket broadcasts):
   - Remove `broadcast_shopping_list_*` calls from `shopping_lists.py`
   - Restart backend container
   - WebSocket events перестанут транслироваться, но API продолжит работать

2. **Откат Frontend** (Dexie schema):
   - Revert `database.ts` to version 1 (remove `shoppingLists` table)
   - Clear IndexedDB: `indexedDB.deleteDatabase('FamilyBudgetDB')`
   - Пользователи вернутся к API-only режиму

3. **Partial Rollback** (только race condition fix):
   - Revert `listOperations.ts` to `loadShoppingListItems()` approach
   - Оставить WebSocket broadcasts активными

**Data Safety**: Все изменения backwards-compatible. Old clients (без Dexie shopping lists) продолжат работать через API.
