# Test Coverage Analysis - Shopping List Deletion Sync

**Дата:** 2026-02-16
**Компонент:** Shopping Lists Deletion Synchronization
**PR:** #424

---

## Executive Summary

### ✅ Текущее покрытие тестами

| Тип теста | Статус | Покрытие |
|-----------|--------|----------|
| **Backend Unit** | ❌ Отсутствует | 0% |
| **Backend Integration** | ❌ Отсутствует | 0% |
| **Frontend Unit** | ❌ Отсутствует | 0% |
| **E2E Tests** | ⚠️ Частичное | ~40% |
| **Manual Tests** | ✅ Готово | Debug utilities |

### 🎯 Критичность пробелов

- **CRITICAL:** Нет тестов WebSocket событий
- **HIGH:** Нет backend API тестов для DELETE endpoint
- **HIGH:** Нет тестов для Dexie cache invalidation
- **MEDIUM:** Нет тестов для cross-tab synchronization
- **MEDIUM:** Нет unit тестов для event handlers

---

## Детальный анализ существующих тестов

### 1. E2E Tests (Playwright)

**Файл:** `tests/e2e/webapp/test_shopping_lists.spec.ts`

#### ✅ Покрывает:
- Create shopping list (desktop + mobile)
- Navigate to detail view
- Add item to list
- Mark item as purchased
- Delete item from list
- Dexie enabled check
- IndexedDB existence check

#### ❌ НЕ покрывает:
- **Delete shopping list** (главная функциональность!)
- WebSocket events
- Cross-tab sync
- Race conditions
- Error handling
- 404 response handling
- Dexie cache invalidation

#### 📊 Статистика:
- **Total tests:** 7
- **Relevant to deletion:** 0 (0%)
- **WebSocket tests:** 0
- **Offline sync tests:** 2 (basic)

---

### 2. Backend Tests (Pytest)

#### ❌ Полностью отсутствуют:

**Нет тестов для:**
- `DELETE /api/v1/shopping-lists/{id}` endpoint
- WebSocket broadcast `shopping_list_deleted`
- Permission checks (only owner can delete)
- 404 handling (list not found)
- 403 handling (not owner)
- Cascade deletion (items deleted with list)

#### 📍 Где должны быть:
- `tests/integration/backend/test_shopping_lists.py` (не существует)
- `tests/unit/backend/test_shopping_list_service.py` (не существует)

---

### 3. Frontend Unit Tests

#### ❌ Полностью отсутствуют:

**Нет тестов для:**
- `handleShoppingListDeleted()` event handler
- `confirmDeleteList()` modal logic
- `deleteShoppingList()` Dexie operation
- State management (remove from array)
- UI updates (renderLandingView, renderShoppingListCards)

#### 📍 Где должны быть:
- `tests/unit/frontend/lists/wsEventHandlers.test.ts` (не существует)
- `tests/unit/frontend/lists/modalManager.test.ts` (не существует)
- `tests/unit/frontend/dexie/shoppingOperations.test.ts` (не существует)

---

### 4. WebSocket Tests

**Файл:** `tests/e2e/webapp/test_offline_functionality.spec.ts`

#### ✅ Существует только:
```typescript
test('should have WebSocket connection capability', async ({ page }) => {
  const hasWebSocket = await page.evaluate(() => {
    return 'WebSocket' in window;
  });
  expect(hasWebSocket).toBe(true);
});
```

#### ❌ НЕ покрывает:
- WebSocket event broadcasting
- Event handling (shopping_list_deleted)
- Cross-tab synchronization
- Event data structure
- Error handling for events

---

## Критические пробелы в тестировании

### 🔴 CRITICAL: WebSocket Event Tests

**Проблема:** Главная функциональность (WebSocket sync) не покрыта тестами.

**Риски:**
- Регрессия при изменениях WebSocket кода
- Невозможно проверить cross-tab sync автоматически
- Нет гарантии корректности event data

**Должны быть тесты:**

```typescript
// Backend
test_shopping_list_deleted_broadcasts_websocket()
test_websocket_event_has_correct_structure()
test_broadcast_reaches_multiple_clients()

// E2E
test('shopping list deletion syncs across tabs')
test('websocket event triggers UI update')
test('deleted list disappears in other tabs')
```

---

### 🔴 CRITICAL: Backend DELETE Endpoint Tests

**Проблема:** DELETE endpoint не покрыт тестами.

**Риски:**
- Неизвестно, работает ли permission check (only owner)
- Неизвестно, работает ли cascade deletion (items)
- Нет проверки 404/403 responses

**Должны быть тесты:**

```python
# tests/integration/backend/test_shopping_lists.py

async def test_delete_shopping_list_success(client, auth_headers):
    """DELETE /shopping-lists/{id} should return 204"""
    # Given: Shopping list exists, user is owner
    # When: DELETE request
    # Then: 204 No Content, list deleted from DB

async def test_delete_shopping_list_not_owner(client, auth_headers):
    """DELETE /shopping-lists/{id} should return 403 if not owner"""
    # Given: Shopping list exists, user is NOT owner
    # When: DELETE request
    # Then: 403 Forbidden

async def test_delete_shopping_list_not_found(client, auth_headers):
    """DELETE /shopping-lists/{id} should return 404 if not found"""
    # Given: Shopping list does not exist
    # When: DELETE request
    # Then: 404 Not Found

async def test_delete_shopping_list_cascades_items(client, auth_headers):
    """DELETE /shopping-lists/{id} should cascade delete all items"""
    # Given: Shopping list with 5 items
    # When: DELETE list
    # Then: All 5 items deleted from DB

async def test_delete_shopping_list_broadcasts_websocket(client, auth_headers, websocket_client):
    """DELETE /shopping-lists/{id} should broadcast shopping_list_deleted event"""
    # Given: Shopping list exists
    # When: DELETE request
    # Then: WebSocket event "shopping_list_deleted" sent with {"id": list_id}
```

---

### 🟠 HIGH: Dexie Cache Invalidation Tests

**Проблема:** Dexie cache invalidation не покрыта тестами.

**Риски:**
- Stale data в offline mode
- Race conditions не обнаруживаются
- Неизвестно, работает ли soft delete

**Должны быть тесты:**

```typescript
// tests/unit/frontend/dexie/shoppingOperations.test.ts

it('should soft-delete shopping list in Dexie', async () => {
  // Given: List exists with sync_status='synced'
  const list = await db.shoppingLists.add({...});

  // When: deleteShoppingList(temp_id)
  await deleteShoppingList(list.temp_id);

  // Then: List has sync_status='deleted', is_active=false
  const updated = await db.shoppingLists.get(list.temp_id);
  expect(updated.sync_status).toBe('deleted');
  expect(updated.is_active).toBe(false);
});

it('should invalidate cache before DELETE API call', async () => {
  // Given: List in Dexie cache
  // When: DELETE via modalManager
  // Then: Cache invalidated BEFORE API call (race condition test)
});
```

---

### 🟠 HIGH: Frontend Event Handler Tests

**Проблема:** Event handlers не покрыты unit тестами.

**Риски:**
- Логика обработки событий может сломаться
- Неизвестно, корректно ли работает state update
- Нет проверки fallback логики

**Должны быть тесты:**

```typescript
// tests/unit/frontend/lists/wsEventHandlers.test.ts

describe('handleShoppingListDeleted', () => {
  it('should remove shopping list from state', () => {
    // Given: State has 3 lists
    const state = {
      shoppingLists: [
        { id: 1, name: 'List 1' },
        { id: 2, name: 'List 2' },
        { id: 3, name: 'List 3' }
      ]
    };

    // When: handleShoppingListDeleted(2)
    handleShoppingListDeleted(2);

    // Then: State has 2 lists, list 2 removed
    expect(getState().shoppingLists).toHaveLength(2);
    expect(getState().shoppingLists.find(l => l.id === 2)).toBeUndefined();
  });

  it('should redirect to landing if deleted list was active', () => {
    // Given: State has currentListId = 2
    // When: handleShoppingListDeleted(2)
    // Then: renderLandingView() called
  });

  it('should refresh cards if deleted list was not active', () => {
    // Given: State has currentListId = 1
    // When: handleShoppingListDeleted(2)
    // Then: renderShoppingListCards() called
  });

  it('should handle error in renderLandingView with fallback', () => {
    // Given: renderLandingView will throw error
    // When: handleShoppingListDeleted(currentListId)
    // Then: renderShoppingListCards() called as fallback
  });
});
```

---

### 🟡 MEDIUM: Cross-Tab Sync E2E Tests

**Проблема:** Нет E2E тестов для multi-tab sync.

**Риски:**
- WebSocket синхронизация может не работать между вкладками
- UI может не обновляться в других вкладках

**Должны быть тесты:**

```typescript
// tests/e2e/webapp/lists/shopping-list-deletion-sync.spec.ts

test('shopping list deletion syncs across tabs', async ({ browser }) => {
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();

  await page1.goto('/lists');
  await page2.goto('/lists');

  // Tab 1: Delete shopping list
  await page1.locator('[data-list-id="1"] .btn-delete-list').click();
  await page1.locator('.btn-error').click();  // Confirm

  // Tab 1: Verify list removed
  await expect(page1.locator('[data-list-id="1"]')).not.toBeVisible();

  // Tab 2: Verify list also removed (WebSocket sync)
  await expect(page2.locator('[data-list-id="1"]')).not.toBeVisible({ timeout: 2000 });
});

test('shopping list deletion works with Dexie cache', async ({ page }) => {
  await page.goto('/lists');

  // Enable Dexie offline mode
  await page.evaluate(() => window.dexieManager.activate());

  // Delete shopping list
  await page.locator('[data-list-id="1"] .btn-delete-list').click();
  await page.locator('.btn-error').click();

  // Verify list removed from UI
  await expect(page.locator('[data-list-id="1"]')).not.toBeVisible();

  // Reload page (should load from fresh API, not stale cache)
  await page.reload();
  await expect(page.locator('[data-list-id="1"]')).not.toBeVisible();
});
```

---

## Рекомендации по приоритетам тестирования

### Priority 1 (MUST HAVE перед мержем):

1. **Backend DELETE endpoint tests** (pytest)
   - Permission checks
   - 404/403 handling
   - WebSocket broadcast

2. **E2E deletion test** (Playwright)
   - Basic deletion flow
   - UI verification

### Priority 2 (SHOULD HAVE перед production):

3. **WebSocket E2E tests** (Playwright)
   - Cross-tab synchronization
   - Event handling

4. **Frontend unit tests** (Jest/Vitest)
   - Event handler logic
   - State management

### Priority 3 (NICE TO HAVE):

5. **Dexie unit tests**
   - Cache invalidation
   - Soft delete

6. **Race condition tests**
   - Slow network simulation
   - Error resilience

---

## Структура тестов (рекомендуемая)

```
tests/
├── integration/
│   └── backend/
│       └── test_shopping_lists.py           # NEW (Priority 1)
│           ├── test_delete_shopping_list_success
│           ├── test_delete_shopping_list_not_owner
│           ├── test_delete_shopping_list_not_found
│           ├── test_delete_shopping_list_cascades_items
│           └── test_delete_shopping_list_broadcasts_websocket
│
├── unit/
│   └── frontend/
│       ├── lists/
│       │   ├── wsEventHandlers.test.ts      # NEW (Priority 2)
│       │   └── modalManager.test.ts         # NEW (Priority 2)
│       └── dexie/
│           └── shoppingOperations.test.ts   # NEW (Priority 3)
│
└── e2e/
    └── webapp/
        ├── test_shopping_lists.spec.ts      # UPDATE (Priority 1)
        │   └── + test('should delete shopping list')
        │
        └── lists/
            └── shopping-list-deletion-sync.spec.ts  # NEW (Priority 2)
                ├── test('cross-tab sync')
                ├── test('Dexie cache invalidation')
                ├── test('race condition with slow network')
                └── test('error resilience without Dexie')
```

---

## Существующие debug utilities

✅ **Уже реализовано** (Commit faf9c5c6):

- `window.shoppingListDebug` - Debug utilities для ручного тестирования
- `testing/TESTING.md` - Руководство по ручному тестированию
- Network delay simulation
- Dexie disable support
- Load error simulation
- Cache inspection tools

**Использование для автоматических тестов:**

```typescript
// E2E tests can use debug utilities
test('race condition test', async ({ page }) => {
  // Enable slow network via debug utilities
  await page.evaluate(() => {
    (window as any).shoppingListDebug.enableSlowNetwork(3000);
  });

  // Delete list
  await page.click('[data-list-id="1"] .btn-delete');

  // Verify cache invalidation
  const cacheResult = await page.evaluate((listId) => {
    return (window as any).shoppingListDebug.inspectDexieCache(listId);
  }, 1);
});
```

---

## Метрики покрытия (оценка)

### Текущее покрытие:

| Компонент | Unit | Integration | E2E | Total |
|-----------|------|-------------|-----|-------|
| **Backend DELETE** | 0% | 0% | 0% | 0% |
| **WebSocket broadcast** | 0% | 0% | 0% | 0% |
| **Frontend handlers** | 0% | N/A | ~20% | ~5% |
| **Dexie operations** | 0% | N/A | ~30% | ~10% |
| **UI updates** | 0% | N/A | ~40% | ~15% |
| **Overall** | **0%** | **0%** | **~25%** | **~10%** |

### Целевое покрытие (после всех тестов):

| Компонент | Unit | Integration | E2E | Total |
|-----------|------|-------------|-----|-------|
| **Backend DELETE** | N/A | 90% | 80% | 85% |
| **WebSocket broadcast** | N/A | 80% | 90% | 85% |
| **Frontend handlers** | 80% | N/A | 70% | 75% |
| **Dexie operations** | 85% | N/A | 60% | 70% |
| **UI updates** | N/A | N/A | 90% | 90% |
| **Overall** | **60%** | **85%** | **80%** | **75%** |

---

## Action Items

### Для разработчиков:

- [ ] **P1:** Написать backend integration тесты (test_shopping_lists.py)
- [ ] **P1:** Добавить E2E тест для deletion в test_shopping_lists.spec.ts
- [ ] **P2:** Создать frontend unit тесты (wsEventHandlers, modalManager)
- [ ] **P2:** Написать E2E тесты для cross-tab sync
- [ ] **P3:** Добавить Dexie unit тесты

### Для QA:

- [ ] Выполнить ручное тестирование по TESTING.md
- [ ] Проверить все 4 test scenarios
- [ ] Документировать найденные проблемы
- [ ] Верифицировать fixes в PR #424

### Для DevOps:

- [ ] Настроить coverage reporting в CI/CD
- [ ] Добавить минимальный порог coverage (70%)
- [ ] Настроить автоматический запуск E2E тестов

---

## Заключение

**Общая оценка тестового покрытия: 🔴 НЕДОСТАТОЧНАЯ**

### Критические проблемы:
1. Отсутствуют backend тесты для DELETE endpoint
2. Нет тестов WebSocket событий
3. Нет frontend unit тестов для event handlers
4. Минимальное E2E покрытие (25%)

### Рекомендация:
**НЕ мержить PR #424 без Priority 1 тестов** (backend DELETE + basic E2E).

### Минимальные требования для мержа:
- ✅ Backend integration tests (5+ tests)
- ✅ E2E deletion test (1+ test)
- ✅ Ручное тестирование пройдено (4 scenarios)
- ✅ Code review approved

---

**Версия:** 1.0
**Автор:** Claude Code Team
**Дата:** 2026-02-16
