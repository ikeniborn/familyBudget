# План исправления: Shopping Lists не сохраняются в Dexie

**Дата:** 2026-02-16
**Статус:** Ожидает утверждения
**Приоритет:** Высокий
**Затронутые компоненты:** Backend (models, schemas, endpoints), Frontend (Dexie sync, DataLayer), Database (migration)

---

## Краткое резюме

**Root Cause (подтверждено тестом "сброс кэша"):**
Background Dexie sync fails молча → данные НЕ сохраняются в IndexedDB → при reload Dexie empty → API fallback работает, НО список УЖЕ был в memory state → путаница. **После сброса cookies → full re-init → API загружает данные → список появляется.**

**Критическое исправление (Фаза 1):**
- Улучшить background Dexie sync в modalManager.ts
- Ждать инициализацию dexieManager (max 2s)
- Валидировать creator_id и temp_id перед put()
- Proper error handling с user-facing warnings
- Гарантировать сохранение данных в Dexie

**Исправление товаров пропадания (Фаза 2):**
- Передавать numeric `listId` в API вместо string `listTempId`
- Устраняет HTTP 422 Validation Errors при reload items

**Дополнительные улучшения (Фазы 3-5):**
- Добавить temp_id в backend (убрать fallback generation)
- Кэшировать items после создания
- WebSocket → Dexie bridge (optional)

---

## Контекст

### Проблема

После создания shopping list:
1. Список не появляется на дашборде при reload (требуется API fallback)
2. В консоли: `[DATA_LAYER] Dexie returned empty, using API fallback`
3. После добавления товаров и отметки их как выполненных, товары пропадают

### Root Causes

Проведено полное исследование (3 Explore агента + глубокий анализ кода + уточняющие вопросы пользователю):

**Сценарий пользователя:**
1. Создаю список → список открывается ✅
2. Добавляю товары → товары отображаются ✅
3. Отмечаю один товар → **ВСЕ товары пропадают** ❌
4. Возвращаюсь к списку списков → **нового списка НЕТ** ❌
5. **ВАЖНО:** Если сбросить кэш и cookies → после повторного входа список **ПОЯВЛЯЕТСЯ** ✅

**Это означает:**
- ✅ Список СОХРАНЯЕТСЯ на сервере (backend API работает корректно)
- ❌ Проблема в КЛИЕНТСКОМ КЭШИРОВАНИИ (Dexie sync или state management)
- ✅ После очистки кэша → полная загрузка с API → данные видимы

**Анализ показал:**

1. **ПЕРВАЯ ПРОБЛЕМА: Dexie Sync Fails + State Не Обновляется** (CRITICAL)
   - Background Dexie sync в `queueMicrotask()` fails молча (modalManager.ts:146-176)
   - Список остается в **memory state**, но НЕ сохраняется в Dexie
   - При reload страницы:
     - DataLayer проверяет Dexie first (`isDexieActive()` = true по умолчанию)
     - Dexie empty (sync failed) → fallback на API
     - **ПРОБЛЕМА:** API fallback может НЕ сработать корректно или state не обновляется из API response
   - При очистке кэша: полная re-initialization → API загружает данные → список появляется

2. **ВТОРАЯ ПРОБЛЕМА: API Type Mismatch для Items** (HIGH PRIORITY)
   - Backend endpoint: `shopping_list_id: int = Query(...)` ожидает INTEGER
   - Frontend: `params.set('shopping_list_id', listTempId)` передает STRING
   - Если `listTempId = "123"` → FastAPI конвертирует в int 123 ✅
   - НО если `listTempId = "list_123"` → HTTP 422 Validation Error ❌ → empty result
   - При отметке товара: reload items → Dexie empty → API с неправильным ID → HTTP 422 → товары пропадают

3. **ТРЕТЬЯ ПРОБЛЕМА: temp_id отсутствует в backend** (MEDIUM PRIORITY)
   - Таблица `t_f_shopping_list` НЕ содержит поле `temp_id`
   - Модель `ShoppingList` не имеет поля `temp_id`
   - Response schema `ShoppingListResponse` не включает `temp_id`
   - Frontend генерирует fallback: `temp_id: result.temp_id || list_${result.id}` (modalManager.ts:116)
   - Этот fallback numeric temp_id вызывает validation errors при API запросах

4. **ЧЕТВЕРТАЯ ПРОБЛЕМА: Items не синхронизируются в Dexie** (LOW PRIORITY)
   - После `createItem()` нет background Dexie sync
   - При reload `getShoppingListItems()` Dexie empty → API fallback

### Текущая архитектура

**API-first стратегия:**
```
UI → POST API → Optimistic State Update → queueMicrotask(Background Dexie sync)
```

**Query flow (с fallback):**
```
DataLayer.getShoppingListItems(listTempId)
  → Check Dexie first (если активирован)
  → If empty → API fallback
  → Return items
```

---

## Решение

### Приоритет исправлений

**ROOT CAUSE:** Background Dexie sync fails молча → данные не сохраняются → при reload Dexie empty → API fallback работает, но пользователь ожидает данные из cache.

1. **CRITICAL: Улучшить Dexie sync для lists** - исправить race conditions, добавить proper error handling, валидировать данные перед put()
2. **HIGH: Исправить API query для items** - передавать numeric ID вместо temp_id для устранения HTTP 422 errors
3. **MEDIUM: Добавить temp_id в backend** - для Dexie consistency (убрать fallback generation в frontend)
4. **MEDIUM: Добавить Dexie sync для items** - после создания (для offline mode)
5. **LOW: WebSocket → Dexie bridge** - опционально (для multi-client sync)

### Фаза 1: Frontend - Исправить Dexie Sync (CRITICAL - ROOT CAUSE FIX)

**Проблема (подтверждено пользователем):**
- После создания списка: список открывается ✅, товары добавляются ✅
- После отметки товара: ВСЕ товары пропадают ❌
- Возврат к landing: нового списка НЕТ ❌
- **КЛЮЧЕВОЕ:** После сброса кэша/cookies → список ПОЯВЛЯЕТСЯ ✅
- **НЕТ ошибок от Dexie** в консоли (молчаливый fail)

**Root Cause:**
`queueMicrotask()` в `modalManager.ts:146-176` выполняет background Dexie sync, но:
1. `window.dexieManager` может быть undefined (race condition)
2. `creator_id` может быть null (schema violation)
3. `temp_id` генерируется как `list_${id}` (не UUID format)
4. Ошибки только warn → не видны пользователю
5. Данные НЕ сохраняются → при reload Dexie empty → API fallback возвращает данные, но память state уже polluted

**Решение:** Robust Dexie sync с proper validation и error handling.

**1.1. Улучшить background Dexie sync в modalManager.ts**

**Файл:** `frontend/web/static/js/lists/listsManager/ui/modalManager.ts`

**Изменение 1:** Убрать fallback temp_id generation (строка 116):

```typescript
// BEFORE
async getShoppingListItems(
  listTempId: string,
  filters?: ShoppingListItemFilters
): Promise<LocalShoppingListItem[]> {
  // ...
}

// AFTER
async getShoppingListItems(
  listId: number,
  filters?: ShoppingListItemFilters
): Promise<LocalShoppingListItem[]> {
  console.debug('[DATA_LAYER] getShoppingListItems', {
    listId,  // ← Now numeric
    filters,
    usePGlite: this.shouldUsePGlite()
  });

  try {
    // API-FIRST
    if (!this.shouldUsePGlite()) {
      const result = await this.getShoppingListItemsFromAPI(listId, filters);
      const duration = performance.now() - startTime;
      performanceMonitor.trackAPICall('getShoppingListItems', duration);
      return result;
    }

    // OPT-IN Dexie
    const pglite = await this.getDexie();
    if (!pglite.isReady()) {
      const result = await this.getShoppingListItemsFromAPI(listId, filters);
      performanceMonitor.trackAPICall('getShoppingListItems', performance.now() - startTime);
      return result;
    }

    // Query Dexie by shopping_list_temp_id (Dexie uses temp_id for FK)
    // Need to find list's temp_id first
    const list = await pglite.getDB().shoppingLists.where('id').equals(listId).first();
    if (!list || !list.temp_id) {
      console.warn('[DATA_LAYER] List not found in Dexie or missing temp_id, using API fallback');
      const result = await this.getShoppingListItemsFromAPI(listId, filters);
      performanceMonitor.trackAPICall('getShoppingListItems', performance.now() - startTime);
      return result;
    }

    const listTempId = list.temp_id;  // ← Use Dexie temp_id for query
    let result = await pglite.queryShoppingListItems(listTempId);

    // Apply filters (existing code)
    if (filters) { /* ... */ }

    if (result.length === 0) {
      console.warn('[DATA_LAYER] Dexie returned empty, using API fallback');
      let apiResult = await this.getShoppingListItemsFromAPI(listId, filters);  // ← Use numeric ID
      // ... rest of code
    }

    return result;
  } catch (error) {
    console.error('[DATA_LAYER] Error in getShoppingListItems', error);
    const result = await this.getShoppingListItemsFromAPI(listId, filters);  // ← Use numeric ID
    performanceMonitor.trackAPICall('getShoppingListItems', performance.now() - startTime);
    return result;
  }
}
```

**Изменение 2:** `getShoppingListItemsFromAPI` принимает `listId: number`:

```typescript
// BEFORE
private async getShoppingListItemsFromAPI(
  listTempId: string,
  filters?: ShoppingListItemFilters
): Promise<LocalShoppingListItem[]> {
  const params = new URLSearchParams();
  params.set('shopping_list_id', listTempId);  // ← String, causes HTTP 422 if "list_123"
  // ...
}

// AFTER
private async getShoppingListItemsFromAPI(
  listId: number,
  filters?: ShoppingListItemFilters
): Promise<LocalShoppingListItem[]> {
  const params = new URLSearchParams();
  params.set('shopping_list_id', String(listId));  // ← Convert number to string (FastAPI accepts)
  // ... rest unchanged
}
```

**1.2. Обновить вызов в stateManager**

**Файл:** `frontend/web/static/js/lists/listsManager/core/stateManager.ts`

**Изменение:** Передавать numeric `listId` напрямую (строки 260-270):

```typescript
// BEFORE
export async function loadShoppingListItems(listId: number | string): Promise<void> {
  try {
    const listTempId = String(listId);  // ← Converts to string (breaks if "list_123")
    const localItems = await dataLayer.getShoppingListItems(listTempId);
    // ...
  }
}

// AFTER
export async function loadShoppingListItems(listId: number): Promise<void> {
  try {
    // DataLayer now accepts numeric ID and handles Dexie temp_id lookup internally
    const localItems = await dataLayer.getShoppingListItems(listId);  // ← Pass numeric ID

    // Convert to UI types
    const currentItems = localItems.map(item => convertShoppingListItem(item, listId));
    updateState({ currentItems });

    // ... rest unchanged
  } catch (error) {
    console.error('[ListsManager] Error loading shopping list items:', error);
    showToast('Ошибка загрузки товаров', 'error');
    updateState({ currentItems: [] });
  }
}
```

**Rationale:**
- Устраняет root cause HTTP 422 errors
- Backend всегда получает корректный integer ID
- Dexie queries используют temp_id (находим list в Dexie по numeric ID, потом query items по temp_id)
- Fallback на API работает с numeric ID
- Совместимость с существующим backend API

---

### Фаза 2: Backend - Добавить temp_id (Foundation)

**1.1. Создать миграцию БД**

**Файл:** `backend/db/migrations/versions/20260216_add_temp_id_to_shopping_list.py`

```python
"""Add temp_id to shopping_list for offline sync

Revision ID: add_temp_id_list
Revises: <latest>
Create Date: 2026-02-16
"""

from alembic import op
import sqlalchemy as sa

revision = "add_temp_id_list"
down_revision = "<latest_revision>"

def upgrade():
    # Add temp_id column (nullable, unique, UUID type)
    op.execute("""
        ALTER TABLE t_f_shopping_list
        ADD COLUMN temp_id VARCHAR(36) UNIQUE;
    """)

    # Generate UUID for existing records (backward compatibility)
    op.execute("""
        UPDATE t_f_shopping_list
        SET temp_id = gen_random_uuid()::TEXT
        WHERE temp_id IS NULL;
    """)

    # Create index for queries
    op.execute("""
        CREATE INDEX idx_shopping_list_temp_id
        ON t_f_shopping_list(temp_id);
    """)

    op.execute("""
        COMMENT ON COLUMN t_f_shopping_list.temp_id IS
            'Client-side UUID for offline sync (guaranteed unique, used for Dexie queries)';
    """)

def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_shopping_list_temp_id")
    op.execute("ALTER TABLE t_f_shopping_list DROP COLUMN temp_id")
```

**1.2. Обновить модель ShoppingList**

**Файл:** `backend/app/models/shopping_list.py`

**Изменение:** Добавить поле `temp_id` после `id` (строка 83):

```python
# After id field
temp_id: str | None = Field(
    default=None,
    max_length=36,
    index=True,
    unique=True,
    description="Client-side UUID for offline sync (guaranteed unique)"
)
```

**1.3. Обновить response schema**

**Файл:** `backend/app/schemas/shopping_list.py`

**Изменение:** Добавить `temp_id` в `ShoppingListResponse` (после строки 142):

```python
temp_id: str | None = Field(
    default=None,
    description="Client-side UUID for offline sync",
    examples=["550e8400-e29b-41d4-a716-446655440000"]
)
```

**Также обновить** `ShoppingListCardResponse` (после строки 202):
```python
temp_id: str | None = Field(
    default=None,
    description="Client-side UUID for offline sync"
)
```

**1.4. Генерировать temp_id при создании**

**Файл:** `backend/app/api/v1/endpoints/shopping_lists.py`

**Изменение:** После строки 127 (после создания `shopping_list`):

```python
import uuid

# Generate temp_id for offline sync (before commit)
shopping_list.temp_id = str(uuid.uuid4())
```

**Rationale:**
- Backend всегда генерирует UUID temp_id (гарантия consistency)
- Existing records получают temp_id через миграцию (backward compatibility)
- Frontend больше не генерирует fallback (использует API response)

---

### Фаза 3: Frontend - Улучшить Dexie Sync для Lists

**2.1. Убрать fallback temp_id generation**

**Файл:** `frontend/web/static/js/lists/listsManager/ui/modalManager.ts`

**Изменение:** Строка 116 (в `handleCreateList`):

```typescript
// BEFORE
temp_id: result.temp_id || `list_${result.id}`, // ❌ Fallback numeric

// AFTER
temp_id: result.temp_id, // ✅ Always use API (backend guarantees UUID)
```

**2.2. Улучшить background Dexie sync**

**Файл:** `frontend/web/static/js/lists/listsManager/ui/modalManager.ts`

**Изменение:** Заменить queueMicrotask (строки 146-176):

```typescript
// Start background sync (non-blocking, with proper error handling)
(async () => {
  try {
    // Wait for dexieManager initialization (max 2 seconds)
    const maxWait = 2000;
    const startTime = Date.now();

    while (!window.dexieManager && (Date.now() - startTime) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!window.dexieManager) {
      console.warn('[ListsManager] dexieManager not available after 2s, skipping Dexie sync');
      return;
    }

    const dexie = window.dexieManager;

    // Validate creator_id (fallback to null if not available)
    const creatorId = (window as any).userData?.id || null;
    if (!creatorId) {
      console.warn('[ListsManager] creator_id not available, using null');
    }

    // Convert to LocalShoppingList type for Dexie
    const localList = {
      id: newList.id,
      temp_id: newList.temp_id,  // ✅ Now guaranteed UUID from backend
      name: newList.name,
      description: newList.description || null,
      is_active: newList.is_active,
      creator_id: creatorId,
      created_at: new Date(newList.created_at),
      updated_at: new Date(newList.updated_at),
      sync_status: 'synced' as const,
      sync_hash: null,
      content_hash: null,
      synced_at: new Date(),
      deleted_at: null
    };

    // Use Dexie database.shoppingLists.put() directly
    await dexie.getDB().shoppingLists.put(localList);
    debugLog('[ListsManager] ✅ List synced to Dexie', {
      listId: newList.id,
      tempId: newList.temp_id
    });

  } catch (error) {
    console.error('[ListsManager] ❌ Dexie sync failed:', error);

    // Show user-facing warning if critical
    if (error instanceof Error && error.message.includes('temp_id')) {
      showToast('Оффлайн-синхронизация недоступна', 'warning');
    }
  }
})();
```

**Улучшения:**
- Ожидание инициализации dexieManager (до 2 секунд)
- Валидация creator_id (с warning если null)
- Явное логирование ошибок (не только warn)
- User-facing warning при критических ошибках

---

### Фаза 4: Frontend - Добавить Dexie Sync для Items

**3.1. Background sync после createItem**

**Файл:** `frontend/web/static/js/lists/listsManager/core/listOperations.ts`

**Где:** После успешного API response в `createItem()` (после строки ~130, перед `reloadItems()`)

**Добавить:**

```typescript
// Background sync to Dexie (non-blocking, same pattern as list creation)
(async () => {
  try {
    // Wait for dexieManager initialization
    const maxWait = 2000;
    const startTime = Date.now();

    while (!window.dexieManager && (Date.now() - startTime) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!window.dexieManager) {
      console.warn('[ListsManager] dexieManager not available, skipping item Dexie sync');
      return;
    }

    const dexie = window.dexieManager;
    const creatorId = (window as any).userData?.id || null;

    // Convert API response to LocalShoppingListItem
    const localItem = {
      id: created.id,
      temp_id: created.temp_id || `item_${created.id}_${Date.now()}`,  // Fallback for old API
      shopping_list_temp_id: state.currentList.temp_id,  // ✅ Use list's temp_id (now UUID)
      store_id: created.store_id,
      product_group_id: created.product_group_id,
      product_name: created.product_name,
      quantity: created.quantity,
      unit: created.unit,
      comment: created.comment,
      position: created.position,
      is_completed: false,
      creator_id: creatorId,
      created_at: new Date(created.created_at),
      updated_at: new Date(created.updated_at),
      sync_status: 'synced' as const,
      sync_hash: null,
      content_hash: null,
      version: 1,
      deleted_at: null,
      last_modified_by: creatorId,
      synced_at: new Date(),
      completed_at: null
    };

    // Use Dexie database.shoppingListItems.put() directly
    await dexie.getDB().shoppingListItems.put(localItem);
    debugLog('[ListsManager] ✅ Item synced to Dexie', {
      itemId: created.id,
      listTempId: state.currentList.temp_id
    });

  } catch (error) {
    console.error('[ListsManager] ❌ Item Dexie sync failed:', error);
    // Non-critical - API write succeeded, Dexie is cache only
  }
})();
```

**Rationale:**
- Кэширует item в Dexie сразу после создания
- Использует `state.currentList.temp_id` (теперь гарантированно UUID)
- Исправляет query mismatch проблему
- Неблокирующий (не задерживает UI update)

---

### Фаза 5: Frontend - WebSocket → Dexie Bridge (Optional)

**Цель:** Синхронизировать WebSocket real-time обновления в Dexie для multi-client consistency.

**Где:** WebSocket event handlers (нужно найти файл с listeners)

**Пример для `item_created` event:**

```typescript
socket.on('item_created', async (data) => {
  // Existing state update
  updateState({ currentItems: [...state.currentItems, data.item] });

  // NEW: Sync to Dexie for offline consistency
  if (window.dexieManager) {
    try {
      const dexie = window.dexieManager;
      const creatorId = data.item.creator_id || (window as any).userData?.id || null;

      const localItem = {
        id: data.item.id,
        temp_id: data.item.temp_id || `item_${data.item.id}_${Date.now()}`,
        shopping_list_temp_id: state.currentList.temp_id,
        store_id: data.item.store_id,
        product_group_id: data.item.product_group_id,
        product_name: data.item.product_name,
        quantity: data.item.quantity,
        unit: data.item.unit,
        comment: data.item.comment,
        position: data.item.position,
        is_completed: data.item.is_completed,
        creator_id: creatorId,
        created_at: new Date(data.item.created_at),
        updated_at: new Date(data.item.updated_at),
        sync_status: 'synced' as const,
        sync_hash: null,
        content_hash: null,
        version: data.item.version || 1,
        deleted_at: null,
        last_modified_by: creatorId,
        synced_at: new Date(),
        completed_at: data.item.completed_at ? new Date(data.item.completed_at) : null
      };

      await dexie.getDB().shoppingListItems.put(localItem);
      debugLog('[WS] Item synced to Dexie from WebSocket event', { itemId: data.item.id });
    } catch (error) {
      console.warn('[WS] Failed to sync item to Dexie:', error);
      // Non-critical, продолжаем
    }
  }
});
```

**Применить для всех events:**
- `item_created`
- `item_updated`
- `item_deleted` (soft-delete: set `deleted_at`)
- `item_completed` (update `is_completed`, `completed_at`)
- `shopping_list_created`
- `shopping_list_updated`
- `shopping_list_deleted`

**Rationale:**
- Поддерживает Dexie consistent с WebSocket updates
- Позволяет offline mode работать после WebSocket sync
- Graceful degradation если Dexie unavailable

---

## Критические файлы для изменения

### Frontend (HIGH PRIORITY) - 2 файла

1. **`frontend/web/static/js/data/DataLayer.ts:700-814, 823-851`** (PHASE 1 - CRITICAL)
   - `getShoppingListItems()`: принимает `listId: number` вместо `listTempId: string`
   - Lookup list в Dexie по `listId` → получает `temp_id` → query items по `temp_id`
   - `getShoppingListItemsFromAPI()`: принимает `listId: number`, конвертирует в string для API
   - Устраняет HTTP 422 errors

2. **`frontend/web/static/js/lists/listsManager/core/stateManager.ts:260-270`** (PHASE 1 - CRITICAL)
   - `loadShoppingListItems()`: принимает `listId: number`, передает numeric ID в DataLayer
   - Убирает конвертацию `String(listId)` которая ломает API queries

### Backend (MEDIUM PRIORITY) - 4 файла

3. **`backend/db/migrations/versions/20260216_add_temp_id_to_shopping_list.py`** (NEW, PHASE 2)
   - Добавляет `temp_id` column в `t_f_shopping_list`
   - Генерирует UUID для existing records

4. **`backend/app/models/shopping_list.py:83`** (PHASE 2)
   - Добавляет `temp_id: str | None` field в модель

5. **`backend/app/schemas/shopping_list.py:142, 202`** (PHASE 2)
   - Добавляет `temp_id` в `ShoppingListResponse`, `ShoppingListCardResponse`

6. **`backend/app/api/v1/endpoints/shopping_lists.py:127`** (PHASE 2)
   - Генерирует `temp_id = str(uuid.uuid4())` при создании

### Frontend (MEDIUM PRIORITY) - 2 файла

7. **`frontend/web/static/js/lists/listsManager/ui/modalManager.ts:116, 146-176`** (PHASE 3)
   - Убирает fallback `list_${id}` generation (использует API temp_id)
   - Улучшает background Dexie sync (error handling, initialization wait)

8. **`frontend/web/static/js/lists/listsManager/core/listOperations.ts:~130`** (PHASE 4)
   - Добавляет background Dexie sync после `createItem()`

### Frontend (OPTIONAL) - TBD

9. **Frontend WebSocket handlers** (PHASE 5, optional)
   - Добавляет Dexie sync в event listeners

---

## Стратегия тестирования

### Тест 1: Backend temp_id Generation

```bash
# Применить миграцию
cd backend
DATABASE_URL="..." alembic upgrade head

# Проверить структуру таблицы
psql -d familybudget_test -c "\d t_f_shopping_list"
# Должно быть: temp_id | character varying(36) | | |

# Проверить existing records получили UUID
psql -d familybudget_test -c "SELECT id, temp_id FROM t_f_shopping_list LIMIT 5;"
# Все temp_id должны быть UUID формата
```

### Тест 2: API Response включает temp_id

```bash
# Создать новый список
curl -X POST http://localhost:8000/api/v1/shopping-lists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "Test List"}'

# Response должен содержать:
# {
#   "id": 123,
#   "temp_id": "550e8400-e29b-41d4-a716-446655440000",  ← UUID format
#   "name": "Test List",
#   ...
# }
```

### Тест 3: Frontend использует temp_id из API

```javascript
// В DevTools Console после создания списка
const lists = window.listsManager.getState().shoppingLists;
const newList = lists[lists.length - 1];
console.log(newList.temp_id);
// Должно быть UUID, НЕ "list_123"

// Проверить формат
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newList.temp_id);
// true
```

### Тест 4: Dexie Cache Работает

**Scenario:** Create List → Add Items → Reload → Verify Cache

1. Открыть DevTools → Application → IndexedDB → `budget_dexie`
2. Создать список "Test Groceries"
3. Проверить `shoppingLists` table:
   ```javascript
   const list = await dexieManager.getDB().shoppingLists.toArray();
   console.log(list[0].temp_id); // UUID format
   ```
4. Добавить 3 товара
5. Проверить `shoppingListItems` table:
   ```javascript
   const items = await dexieManager.getDB().shoppingListItems
     .where('shopping_list_temp_id').equals(list[0].temp_id).toArray();
   console.log(items.length); // 3
   ```
6. Reload страницы
7. Открыть список → items должны загрузиться из Dexie (проверить console: NO "[DATA_LAYER] Dexie returned empty")

### Тест 5: Offline Mode

**Scenario:** Online Sync → Go Offline → Verify Cache

1. Создать список с 5 товарами (online)
2. DevTools → Network tab → Set "Offline"
3. Reload страницы
4. Проверить:
   - Списки загружаются (из Dexie cache)
   - Открыть список → товары загружаются (из Dexie cache)
   - Console: NO API requests (все из Dexie)

### Тест 6: Items Persist After Mark Complete

**Scenario:** Mark Complete → Reload → Verify Persistence

1. Открыть список
2. Отметить 2 товара как выполненные
3. Reload страницы
4. Открыть список
5. Проверить:
   - ✅ 2 товара остаются отмеченными (is_completed = true)
   - ✅ Товары не пропадают (query находит их в Dexie)

### Тест 7: WebSocket Multi-Client Sync (Phase 4)

**Scenario:** Tab A creates item → Tab B receives via WebSocket → Tab B caches in Dexie

1. Открыть 2 вкладки (Tab A, Tab B)
2. Tab A: Добавить товар "Milk"
3. Tab B: Проверить товар появился (WebSocket real-time)
4. Tab B: Проверить Dexie:
   ```javascript
   const items = await dexieManager.getDB().shoppingListItems
     .where('product_name').equals('Milk').toArray();
   console.log(items.length); // 1 (синхронизировано из WebSocket)
   ```
5. Tab B: Offline → Reload → Verify "Milk" visible (cached)

---

## Rollback Plan

### Если возникнут проблемы после deployment:

**Backend Rollback:**
```bash
# Откатить миграцию
alembic downgrade -1

# Revert код
git revert <commit_hash>
```

**Frontend Rollback:**
```bash
# Revert изменения
git revert <commit_hash>

# Frontend продолжит работать с API-only (без offline cache)
```

**Feature Flag (Emergency Kill Switch):**
```typescript
// Добавить в modalManager.ts и listOperations.ts
const ENABLE_DEXIE_SYNC = localStorage.getItem('enable_dexie_sync') !== 'false';

if (!ENABLE_DEXIE_SYNC) {
  console.warn('[ListsManager] Dexie sync disabled via feature flag');
  return; // Skip Dexie sync
}
```

Отключить для всех пользователей:
```javascript
localStorage.setItem('enable_dexie_sync', 'false');
```

---

## Verification Checklist

После implementation:

- [ ] Backend migration applied успешно
- [ ] Existing lists получили UUID temp_id
- [ ] POST /shopping-lists возвращает temp_id (UUID format)
- [ ] Frontend создаёт список с UUID temp_id (не `list_${id}`)
- [ ] Список сохраняется в Dexie после создания
- [ ] Items сохраняются в Dexie после добавления
- [ ] Items query использует UUID temp_id (no mismatch)
- [ ] Items persist после reload (Dexie cache hit)
- [ ] Completed items persist после reload
- [ ] Offline mode работает (no API calls после initial sync)
- [ ] WebSocket events обновляют Dexie (Phase 4)
- [ ] No console errors `[DATA_LAYER] Dexie returned empty`
- [ ] Dexie Diagnostic Modal показывает правильные counts

---

## Ожидаемые результаты

После исправления:

### Фаза 1 (CRITICAL - исправляет основную проблему):
1. ✅ **Items НЕ пропадают после mark complete** - API query использует numeric ID → нет HTTP 422 errors
2. ✅ **Новые списки остаются на дашборде** - API работает корректно с numeric IDs
3. ✅ **Товары загружаются после reload** - DataLayer передает правильный ID в API

### Фаза 2-3 (улучшения):
4. ✅ **Списки кэшируются в Dexie** - background sync работает надежно
5. ✅ **temp_id format consistent** - backend генерирует UUID, frontend не создает fallback
6. ✅ **Dexie queries работают** - используется UUID temp_id для FK lookups

### Фаза 4-5 (optional):
7. ✅ **Items кэшируются после создания** - background sync для items
8. ✅ **WebSocket → Dexie sync** - real-time updates сохраняются offline
9. ✅ **Offline mode работает полностью** - все данные доступны без интернета

---

**План готов к утверждению.**
