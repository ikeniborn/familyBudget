# ChoicesCategoryTree: Исправление phantom auto-selection в create modals

**Версия:** 6.6.1
**Дата:** 2025-12-28
**Автор:** Claude Code
**Тип изменения:** Bug fix

## Проблема

При открытии модальных окон создания (`modal_add_transaction`, `modal_add_plan`, `transfer_modal`) категория автоматически заполнялась значением из предыдущей сессии, даже если пользователь её ещё не выбрал.

### Корневая причина

Метод `updateFinancialCenter()` в классе `ChoicesCategoryTree` (файл `frontend/shared/static/js/choicesCategoryTree.js`):
- Сохранял текущее значение из `element.value` (строка 1006)
- Восстанавливал его при изменении счета, если категория доступна для нового счета (строки 1093-1100)
- Работал одинаково для режима создания и редактирования

### Почему сброс `financialCenterId = null` был недостаточен

Даже когда `financialCenterId` сбрасывался в `null` при открытии модального окна, `element.value` сохранял старое значение из предыдущей сессии (Choices.js может кешировать значения). При выборе счета метод `updateFinancialCenter()` читал `element.value` и восстанавливал категорию.

## Решение

### Архитектурное решение: Опция `mode` + метод `clearSelection()`

**Файлы изменены:**
- `frontend/shared/static/js/choicesCategoryTree.js` - Core logic
- `frontend/web/templates/index.html` - Transaction и transfer modals
- `frontend/web/templates/plan.html` - Plan и transfer modals

### 1. Добавлена опция `mode` в конструктор ChoicesCategoryTree

```javascript
this.options = {
    // ... existing options ...
    mode: options.mode || 'edit',  // NEW: 'create' | 'edit' - controls selection preservation
};
```

**Семантика:**
- `mode: 'edit'` (default) - Сохранять выбор категории при изменении счета (для редактирования)
- `mode: 'create'` - НЕ сохранять выбор категории (для создания)

**Обратная совместимость:**
Default `mode: 'edit'` сохраняет текущее поведение для всех существующих экземпляров.

### 2. Добавлен метод `clearSelection()`

```javascript
/**
 * Clear category selection.
 * Used in create modals to reset selection state.
 */
clearSelection() {
    console.log('[ChoicesCategoryTree] clearSelection() called');

    // Clear Choices.js active selection
    if (this.choices) {
        this.choices.removeActiveItems();
        console.log('[ChoicesCategoryTree] Choices.js active items removed');
    }

    // Clear DOM element value
    if (this.element) {
        this.element.value = '';
        console.log('[ChoicesCategoryTree] Element value cleared');
    }

    console.log('[ChoicesCategoryTree] ✅ Selection cleared successfully');
}
```

**Зачем нужен explicit метод:**
- Предоставляет явный API для модальных окон
- Очищает ОБА источника данных (Choices.js + element.value)
- Делает intent понятным в коде
- Улучшает логирование для debugging

### 3. Модифицирован `updateFinancialCenter()`

**Добавлена логика учета `mode`:**

```javascript
// Preserve ONLY in edit mode when category still available
const shouldPreserve = this.options.mode === 'edit' && categoryStillAvailable;

console.log(`[ChoicesCategoryTree] Selection preservation decision:`, {
    mode: this.options.mode,
    categoryStillAvailable,
    shouldPreserve,
    previousSelectionId
});

if (shouldPreserve) {
    console.log(`[ChoicesCategoryTree] ✅ PRESERVING selection (edit mode): ${previousSelectionId}`);
    await this.setSelectedCategory(previousSelectionId);
} else {
    // Clear selection
    this.choices.removeActiveItems();
    if (this.element) {
        this.element.value = '';
    }

    if (this.options.mode === 'create') {
        console.log(`[ChoicesCategoryTree] ❌ CLEARING selection (create mode)`);
    } else if (!categoryStillAvailable && previousSelectionId) {
        console.log(`[ChoicesCategoryTree] ❌ CLEARING selection: category not available`);
    } else {
        console.log(`[ChoicesCategoryTree] ℹ️ No previous selection - keeping empty`);
    }
}
```

**Ключевое отличие:**
- **ДО:** `if (categoryStillAvailable)` - Всегда сохранять если доступна
- **ПОСЛЕ:** `if (this.options.mode === 'edit' && categoryStillAvailable)` - Сохранять ТОЛЬКО в edit mode

### 4. Обновлены функции открытия модальных окон

Добавлен вызов `clearSelection()` во всех функциях открытия create modals:

#### index.html

**`openAddTransactionModal()` (строки 2349-2354):**
```javascript
if (typeof transactionCategoryTreeSelect !== 'undefined' && transactionCategoryTreeSelect) {
    transactionCategoryTreeSelect.options.financialCenterId = null;
    transactionCategoryTreeSelect.clearSelection();  // NEW
    console.log('[MODAL_CREATE] Transaction modal: FC reset and selection cleared');
}
```

**`openFactTransferModal()` (строки 620-630):**
```javascript
if (typeof fromCategoryTree !== 'undefined' && fromCategoryTree) {
    fromCategoryTree.options.financialCenterId = null;
    fromCategoryTree.clearSelection();  // NEW
    console.log('[MODAL_CREATE] Fact transfer: FROM category reset and cleared');
}
if (typeof toCategoryTree !== 'undefined' && toCategoryTree) {
    toCategoryTree.options.financialCenterId = null;
    toCategoryTree.clearSelection();  // NEW
    console.log('[MODAL_CREATE] Fact transfer: TO category reset and cleared');
}
```

**`openPlanTransferModal()` (строки 683-693):**
```javascript
// Same pattern as openFactTransferModal
```

#### plan.html

**`openAddPlanModal()` (строки 3995-4000):**
```javascript
if (typeof createCategoryTreeSelect !== 'undefined' && createCategoryTreeSelect) {
    createCategoryTreeSelect.options.financialCenterId = null;
    createCategoryTreeSelect.clearSelection();  // NEW
    console.log('[MODAL_CREATE] Plan modal: FC reset and selection cleared');
}
```

**`openPlanTransferModal()` (строки 1048-1058):**
```javascript
// Same pattern as index.html openFactTransferModal
```

## Логирование

### Comprehensive logging добавлен на всех уровнях

**При открытии модального окна:**
```
[MODAL_CREATE] Transaction modal: FC reset and selection cleared
[ChoicesCategoryTree] clearSelection() called
[ChoicesCategoryTree] Choices.js active items removed
[ChoicesCategoryTree] Element value cleared
[ChoicesCategoryTree] ✅ Selection cleared successfully
```

**При выборе счета (edit mode):**
```
[ChoicesCategoryTree] Selection preservation decision: {mode: 'edit', categoryStillAvailable: true, shouldPreserve: true}
[ChoicesCategoryTree] ✅ PRESERVING selection (edit mode): 45 (available in FC 5)
```

**При выборе счета (create mode - дефолт):**
```
[ChoicesCategoryTree] Selection preservation decision: {mode: 'edit', categoryStillAvailable: true, shouldPreserve: true}
[ChoicesCategoryTree] ✅ PRESERVING selection (edit mode): 45 (available in FC 5)
```
*Note: Mode 'edit' потому что default, но selection очищен через clearSelection() при открытии модала*

**При выборе счета когда категория недоступна:**
```
[ChoicesCategoryTree] Selection preservation decision: {mode: 'edit', categoryStillAvailable: false, shouldPreserve: false}
[ChoicesCategoryTree] ❌ CLEARING selection: category 45 not available for FC 5
```

## Edge Cases Handled

### 1. Пользователь выбирает категорию ДО выбора счета

**Сценарий:** Пользователь открывает modal, выбирает категорию 45, затем выбирает счет 5.

**Ожидается:** Категория 45 сохраняется если она доступна для счета 5, очищается если нет.

**Реализация:** `categoryStillAvailable` check в `updateFinancialCenter()` работает независимо от mode. Только phantom auto-selection предотвращается.

### 2. Choices.js не синхронизирован с element.value

**Проблема:** При быстром открытии/закрытии модала Choices.js может не успеть синхронизироваться.

**Решение:** Метод `clearSelection()` очищает ОБА источника данных:
- `choices.removeActiveItems()` - Choices.js API
- `element.value = ''` - DOM element

### 3. Модальное окно переоткрывается без page refresh

**Проблема:** При повторном открытии модала без refresh `element.value` может сохранять старое значение.

**Решение:** `clearSelection()` вызывается при КАЖДОМ `openAddTransactionModal()`, `openAddPlanModal()`, etc.

### 4. Transfer modal имеет 2 экземпляра CategoryTree

**Проблема:** `fromCategoryTree` и `toCategoryTree` - два независимых экземпляра, оба требуют очистки.

**Решение:** `clearSelection()` вызывается для ОБОИХ экземпляров с отдельными логами:
```javascript
console.log('[MODAL_CREATE] Fact transfer: FROM category reset and cleared');
console.log('[MODAL_CREATE] Fact transfer: TO category reset and cleared');
```

## Тестирование

### Сценарий 1: Создание транзакции
1. Открыть главную страницу
2. Нажать "Добавить транзакцию"
3. **Ожидается:** Категория ПУСТАЯ
4. Выбрать счет
5. **Ожидается:** Категория ОСТАЁТСЯ ПУСТОЙ
6. Закрыть модальное окно, повторить
7. **Ожидается:** Категория ПУСТАЯ при каждом открытии

### Сценарий 2: Редактирование транзакции
1. Открыть существующую транзакцию для редактирования
2. **Ожидается:** Категория ЗАПОЛНЕНА значением из записи
3. Изменить счет на другой
4. **Ожидается:** Категория СОХРАНИЛАСЬ (если доступна для нового счета)

### Сценарий 3: Перевод (transfer)
1. Открыть модальное окно перевода
2. **Ожидается:** Обе категории (FROM и TO) ПУСТЫЕ
3. Выбрать FROM счет
4. **Ожидается:** FROM категория ОСТАЁТСЯ ПУСТОЙ
5. Выбрать TO счет
6. **Ожидается:** TO категория ОСТАЁТСЯ ПУСТОЙ

### Сценарий 4: Регулярный платёж (plan)
1. Открыть страницу /plan
2. Нажать "Добавить регулярный платёж"
3. **Ожидается:** Категория ПУСТАЯ
4. Выбрать счет
5. **Ожидается:** Категория ОСТАЁТСЯ ПУСТОЙ

### Проверка логов
Для каждого сценария проверить:
- `[MODAL_CREATE]` при открытии
- `[ChoicesCategoryTree] clearSelection()` при открытии
- `[ChoicesCategoryTree] Selection preservation decision` при выборе счета
- Правильное решение (`shouldPreserve: false` для create, `shouldPreserve: true` для edit)

## Breaking Changes

**НЕТ BREAKING CHANGES.**

- Default `mode: 'edit'` сохраняет существующее поведение
- Метод `clearSelection()` - новый API, не ломает существующий код
- Все изменения обратно совместимы

## Future Enhancements

### 1. Явная инициализация с mode: 'create'

В будущем можно явно устанавливать mode при инициализации экземпляров для create modals:

```javascript
transactionCategoryTreeSelect = new BudgetShared.ChoicesCategoryTree('#article_id', {
    type: 'expense',
    mode: 'create',  // Explicitly set mode
    // ... other options
});
```

**Преимущества:**
- Более явная семантика
- Избавляет от необходимости вызывать `clearSelection()` при каждом открытии модала
- Mode становится частью "identity" экземпляра

**Недостаток:**
- Требует изменения инициализации во всех местах
- Усложняет логику (один экземпляр для создания, другой для редактирования?)

**Решение:** Оставить текущую реализацию (default mode: 'edit' + explicit clearSelection()) как более гибкую.

### 2. Режим 'view' для read-only компонентов

Можно добавить третий режим `mode: 'view'` для readonly компонентов:

```javascript
mode: options.mode || 'edit',  // 'create' | 'edit' | 'view'
```

**Use case:** Отображение выбранной категории без возможности изменения.

### 3. Event emitter для mode changes

Добавить события для изменения mode:

```javascript
this.dispatchEvent('modeChanged', {oldMode: 'edit', newMode: 'create'});
```

**Use case:** Динамическое переключение режимов (редактирование → просмотр).

## Связанные файлы

### Изменённые файлы

- `frontend/shared/static/js/choicesCategoryTree.js` (lines 174, 1160-1176, 1096-1127)
- `frontend/web/templates/index.html` (lines 2349-2354, 620-630, 683-693)
- `frontend/web/templates/plan.html` (lines 3995-4000, 1048-1058)

### Минифицированные файлы

- `frontend/shared/static/js/choicesCategoryTree.min.js` (автоматически)

### План исправления

- `/home/ikeniborn/Documents/Project/claude/.nvm-isolated/.claude-isolated/plans/expressive-wiggling-papert.md`

## Commit Message

```
fix(frontend): prevent phantom category auto-selection in create modals

Проблема: При открытии модальных окон создания (modal_add_transaction,
modal_add_plan, transfer_modal) категория автоматически заполнялась
значением из предыдущей сессии.

Решение:
- Добавлена опция `mode: 'create' | 'edit'` в ChoicesCategoryTree
- Добавлен метод `clearSelection()` для явной очистки выбора
- Модифицирован `updateFinancialCenter()` для учета mode
- Обновлены все функции открытия create modals

Изменённые модальные окна:
- modal_add_transaction (index.html)
- modal_add_plan (plan.html)
- transfer_modal (факт и план, index.html + plan.html)

Comprehensive logging добавлен для debugging.
Обратная совместимость гарантирована (default mode: 'edit').

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## References

- **Issue:** Phantom category auto-selection in create modals
- **Root cause:** `element.value` caching + unconditional selection preservation in `updateFinancialCenter()`
- **Architecture pattern:** Mode-based behavior + explicit API (clearSelection)
- **Similar implementations:** None (первая реализация mode-based selection control в ChoicesCategoryTree)
