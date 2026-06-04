# Shopping List Deletion - Testing Guide

Инструкции по тестированию синхронизации удаления списков покупок.

> **Note:** Dexie/IndexedDB offline cache был удалён. Все операции идут через REST API + WebSocket.

## Quick Start

1. Открыть https://fbd.ikeniborn.ru/lists
2. Открыть DevTools Console (F12)
3. Ввести: `window.shoppingListDebug.help()`

## Test Scenarios

### 1. Slow Network Test

**Цель:** Проверить, что UI корректно обрабатывает медленный DELETE запрос.

**Шаги:**
```javascript
// 1. Включить slow network (3 секунды задержки)
window.shoppingListDebug.enableSlowNetwork(3000);

// 2. Удалить список через UI (кнопка "Удалить")
// Наблюдение: 3 секунды между кликом и удалением

// 3. Отключить slow network
window.shoppingListDebug.disableSlowNetwork();
```

**Ожидаемый результат:**
- ✅ Удаление занимает ~3 секунды
- ✅ UI обновляется корректно после ответа сервера
- ✅ Нет ошибок в консоли

---

### 2. Cross-Tab Sync Test

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

### 3. Async Error Test

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

### Error Simulation
```javascript
window.shoppingListDebug.simulateLoadError()         // Включить ошибку
window.shoppingListDebug.disableLoadError()          // Выключить ошибку
window.shoppingListDebug.shouldSimulateLoadError()   // Проверить статус
```

### Logging
```javascript
window.shoppingListDebug.enableVerboseLogging()   // Детальные логи
window.shoppingListDebug.disableVerboseLogging()  // Стандартные логи
```

---

## Integration Test Scenarios

### Scenario A: Multi-Tab Stress Test
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

---

## Expected Console Output

### Successful Deletion (Normal Flow)
```
[DeleteList] Deleting list: 123
[DeleteList] List deleted successfully: 123
[ListsManager] Loaded shopping lists: 5
```

### Successful Deletion (Slow Network)
```
[DeleteList] Deleting list: 123
[DeleteList] 🐌 Simulating slow network: 3000ms delay
[DeleteList] List deleted successfully: 123
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

- [x] Slow Network Test: UI корректно обрабатывает 3-секундную задержку
- [x] Cross-Tab Sync Test: Список исчезает в Tab 2 автоматически
- [x] Async Error Test: Fallback на renderShoppingListCards() работает
- [x] Нет console.error в любом сценарии
- [x] UI остаётся функциональным после ошибок
- [x] Toast уведомления показываются корректно

---

## Automated Testing (Future)

Эти debug utilities могут быть использованы в Playwright E2E тестах:

```typescript
// tests/e2e/webapp/lists/shopping-list-deletion-sync.spec.ts
test('slow network deletion', async ({ page }) => {
  await page.goto('/lists');

  // Enable slow network via debug utilities
  await page.evaluate(() => {
    (window as any).shoppingListDebug.enableSlowNetwork(3000);
  });

  // Delete list
  await page.click('[data-list-id="1"] .btn-delete');

  // Verify UI updated after slow response
  // Assert...
});
```

---

**Версия:** 2.0 (post-Dexie removal)
**Автор:** Claude Code Team
