# Shopping List Deletion - Testing Guide

Инструкции по тестированию синхронизации удаления списков покупок.

## Quick Start

1. Открыть https://fbd.ikeniborn.ru/lists
2. Открыть DevTools Console (F12)
3. Ввести: `window.shoppingListDebug.help()`

## Test Scenarios

### 1. 🐌 Race Condition Test

**Цель:** Проверить, что Dexie cache инвалидируется даже при медленном DELETE запросе.

**Шаги:**
```javascript
// 1. Включить slow network (3 секунды задержки)
window.shoppingListDebug.enableSlowNetwork(3000);

// 2. Проверить текущий список
window.shoppingListDebug.getAllDexieLists();

// 3. Удалить список через UI (кнопка "Удалить")
// Наблюдение: 3 секунды между кликом и удалением

// 4. Проверить, что список удалён из Dexie
window.shoppingListDebug.inspectDexieCache(123);  // ID удалённого списка

// 5. Отключить slow network
window.shoppingListDebug.disableSlowNetwork();
```

**Ожидаемый результат:**
- ✅ Удаление занимает ~3 секунды
- ✅ `inspectDexieCache(123)` показывает "NOT found" или `is_active: false`
- ✅ UI обновляется корректно
- ✅ Нет ошибок в консоли

**Проверка race condition:**
```javascript
// Включить verbose logging для детального анализа
window.shoppingListDebug.enableVerboseLogging();
window.shoppingListDebug.enableSlowNetwork(5000);

// Удалить список
// Смотреть логи:
// [DeleteList] 🐌 Simulating slow network: 5000ms delay
// [DeleteList] Dexie cache invalidated for list: temp_xxx
```

---

### 2. 🔧 Error Resilience Test

**Цель:** Проверить, что удаление работает даже если Dexie недоступен.

**Шаги:**
```javascript
// 1. Отключить Dexie
window.shoppingListDebug.disableDexie();

// 2. Удалить список через UI
// Наблюдение: должно работать без ошибок

// 3. Проверить консоль
// Должно быть: ⚠️ Dexie disabled for testing - skipping cache invalidation

// 4. Включить Dexie обратно
window.shoppingListDebug.enableDexie();
```

**Ожидаемый результат:**
- ✅ Удаление успешно выполняется
- ✅ UI обновляется корректно
- ✅ В консоли warning: "Dexie disabled for testing"
- ✅ Нет ошибок в консоли
- ✅ Успешный toast "Список успешно удален"

**Альтернативный сценарий (симуляция Dexie ошибки):**
```javascript
// Отключить Dexie manager
window.dexieManager = null;

// Удалить список
// Ожидается: UI работает, в консоли warning о failed cache invalidation
```

---

### 3. 🔄 Cross-Tab Sync Test

**Цель:** Проверить синхронизацию удаления между вкладками через WebSocket.

**Шаги:**
```javascript
// TAB 1 (основная вкладка):
// 1. Открыть https://fbd.ikeniborn.ru/lists
window.shoppingListDebug.enableVerboseLogging();

// TAB 2 (вторая вкладка):
// 2. Открыть https://fbd.ikeniborn.ru/lists в новой вкладке
window.shoppingListDebug.enableVerboseLogging();

// TAB 1:
// 3. Удалить список
// Наблюдение: список исчезает немедленно

// TAB 2:
// 4. Наблюдать автоматическое обновление (через WebSocket)
// Проверить консоль:
// [BudgetWS] Handling shopping_list_deleted event
// [ListsManager] Removed shopping list from WebSocket
```

**Ожидаемый результат:**
- ✅ TAB 1: Список исчезает после успешного DELETE
- ✅ TAB 2: Список исчезает автоматически (WebSocket)
- ✅ TAB 2: В консоли логи WebSocket события
- ✅ Нет ошибок в консоли ни в одной вкладке
- ✅ Toast уведомление в TAB 2: "Список удалён: [название]"

**Проверка логов WebSocket:**
```
TAB 2 Console:
[BudgetWS] Handling shopping_list_deleted event {id: 123}
[ListsManager] Removed shopping list from WebSocket: 123
[ListsManager] Deleted list was active, returning to landing view
```

---

### 4. ❌ Async Error Test

**Цель:** Проверить fallback при ошибке загрузки списков.

**Шаги:**
```javascript
// 1. Включить симуляцию ошибки
window.shoppingListDebug.simulateLoadError();
window.shoppingListDebug.enableVerboseLogging();

// 2. Удалить активный список (который сейчас просматриваете)
// Наблюдение: renderLandingView() должна выбросить ошибку

// 3. Проверить консоль
// Должно быть:
// [ListsManager] ❌ Simulating load error (debug mode)
// [ListsManager] Failed to render landing view after list deletion: Error: Simulated load error
// Fallback: renderShoppingListCards()

// 4. Проверить UI
// Должны видеть: grid с карточками списков (fallback сработал)

// 5. Отключить симуляцию
window.shoppingListDebug.disableLoadError();
```

**Ожидаемый результат:**
- ✅ Ошибка loadShoppingLists() логируется
- ✅ Fallback на renderShoppingListCards() срабатывает
- ✅ UI показывает карточки списков (не crash)
- ✅ Console.error с текстом "Failed to render landing view"
- ✅ Приложение остаётся функциональным

**Альтернативный сценарий (удаление неактивного списка):**
```javascript
// Симуляция ошибки НЕ влияет на удаление неактивного списка
window.shoppingListDebug.simulateLoadError();

// Удалить список, который НЕ просматриваете
// Ожидается: renderShoppingListCards() вызывается напрямую (без ошибки)
```

---

## Debug Commands Reference

### Configuration
```javascript
window.shoppingListDebug.showDebugConfig()     // Показать настройки
window.shoppingListDebug.resetDebugConfig()    // Сбросить всё
```

### Network Simulation
```javascript
window.shoppingListDebug.enableSlowNetwork(3000)   // 3 секунды задержки
window.shoppingListDebug.disableSlowNetwork()      // Убрать задержку
window.shoppingListDebug.getNetworkDelay()         // Проверить задержку
```

### Dexie Testing
```javascript
window.shoppingListDebug.disableDexie()                 // Отключить Dexie
window.shoppingListDebug.enableDexie()                  // Включить Dexie
window.shoppingListDebug.isDexieDisabledForTesting()    // Проверить статус
```

### Error Simulation
```javascript
window.shoppingListDebug.simulateLoadError()         // Включить ошибку
window.shoppingListDebug.disableLoadError()          // Выключить ошибку
window.shoppingListDebug.shouldSimulateLoadError()   // Проверить статус
```

### Cache Inspection
```javascript
window.shoppingListDebug.inspectDexieCache(123)   // Проверить список ID=123
window.shoppingListDebug.getAllDexieLists()       // Все списки в Dexie
```

### Logging
```javascript
window.shoppingListDebug.enableVerboseLogging()   // Детальные логи
window.shoppingListDebug.disableVerboseLogging()  // Стандартные логи
```

---

## Integration Test Scenarios

### Scenario A: Full Flow Test
Проверка полного цикла удаления с race condition + error handling.

```javascript
// 1. Setup
window.shoppingListDebug.enableVerboseLogging();
window.shoppingListDebug.enableSlowNetwork(2000);

// 2. Проверить начальное состояние
window.shoppingListDebug.getAllDexieLists();

// 3. Удалить список
// Ожидается: 2 секунды задержки, затем успешное удаление

// 4. Проверить финальное состояние
window.shoppingListDebug.getAllDexieLists();
// Список должен быть помечен is_active: false

// 5. Cleanup
window.shoppingListDebug.resetDebugConfig();
```

### Scenario B: Multi-Tab Stress Test
Проверка синхронизации при быстрых изменениях.

```javascript
// TAB 1 & TAB 2:
window.shoppingListDebug.enableVerboseLogging();

// TAB 1: Быстро удалить 3 списка подряд
// TAB 2: Наблюдать обновления

// Проверка:
// - Все 3 события приходят в TAB 2
// - Нет race conditions
// - UI корректно обновляется
```

### Scenario C: Error Recovery
Проверка восстановления после ошибок.

```javascript
// 1. Симулировать ошибку Dexie
window.shoppingListDebug.disableDexie();

// 2. Удалить список (должно работать)

// 3. Включить Dexie обратно
window.shoppingListDebug.enableDexie();

// 4. Удалить ещё один список (должна быть cache invalidation)

// Проверка логов:
// Первое удаление: warning "Dexie disabled"
// Второе удаление: "Dexie cache invalidated"
```

---

## Expected Console Output

### Successful Deletion (Normal Flow)
```
[DeleteList] Deleting list: 123
[DeleteList] List deleted successfully: 123
[DeleteList] Dexie cache invalidated for list: temp_abc123
[ListsManager] Loaded shopping lists: 5
```

### Successful Deletion (Slow Network)
```
[DeleteList] Deleting list: 123
[DeleteList] 🐌 Simulating slow network: 3000ms delay
[DeleteList] List deleted successfully: 123
[DeleteList] Dexie cache invalidated for list: temp_abc123
```

### Successful Deletion (Dexie Disabled)
```
[DeleteList] Deleting list: 123
[DeleteList] List deleted successfully: 123
[DeleteList] ⚠️ Dexie disabled for testing - skipping cache invalidation
[ListsManager] Loaded shopping lists: 5
```

### Cross-Tab Sync (TAB 2)
```
[BudgetWS] Handling shopping_list_deleted event {id: 123}
[ListsManager] Removed shopping list from WebSocket: 123
[ListsManager] Deleted list was active, returning to landing view
[ListsManager] Loaded shopping lists: 5
```

### Async Error Fallback
```
[ListsManager] ❌ Simulating load error (debug mode)
[ListsManager] Failed to render landing view after list deletion: Error: Simulated load error for testing
// Fallback executed
```

---

## Troubleshooting

### Debug utilities не загружены
```javascript
// Проверить, загружен ли модуль
console.log(window.shoppingListDebug);

// Если undefined, перезагрузить страницу
location.reload();
```

### Dexie cache не обновляется
```javascript
// Проверить, активен ли Dexie
window.dexieManager?.isActive();

// Проверить, есть ли temp_id
window.shoppingListDebug.getAllDexieLists();
// Искать temp_id удалённого списка
```

### WebSocket не работает
```javascript
// Проверить подключение
window.budgetWS?.isConnected();

// Переподключить
window.budgetWS?.reconnect();
```

---

## Acceptance Criteria

После всех тестов должны быть выполнены:

- [x] Race Condition Test: Cache инвалидирован даже при slow network
- [x] Error Resilience Test: Удаление работает без Dexie
- [x] Cross-Tab Sync Test: Список исчезает в Tab 2 автоматически
- [x] Async Error Test: Fallback на renderShoppingListCards() работает
- [x] Нет console.error в любом сценарии
- [x] UI остаётся функциональным после ошибок
- [x] Toast уведомления показываются корректно
- [x] Dexie cache синхронизирован с server state

---

## Automated Testing (Future)

Эти debug utilities могут быть использованы в Playwright E2E тестах:

```typescript
// tests/e2e/webapp/lists/shopping-list-deletion-sync.spec.ts
test('race condition test', async ({ page }) => {
  await page.goto('/lists');

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

  // Assert...
});
```

---

**Версия:** 1.0
**Автор:** Claude Code Team
**Дата:** 2026-02-16
