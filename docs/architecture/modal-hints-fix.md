# Modal Category Selection & Hints Fix

**Version:** 6.7.0
**Date:** 2025-12-30
**Author:** Claude Code
**Type:** Bug fix + Feature implementation

## Проблема

При работе с модальными окнами создания (modal_add_transaction, modal_add_plan, transfer_modal) обнаружены следующие проблемы:

### 1. Категория автоматически заполняется при первом открытии

**Проявление:**
- Открыть модальное окно создания плана (`modal_add_plan`)
- При первом открытии категория автоматически заполняется первым элементом из списка
- Пользователь не выбирал категорию, но она уже установлена

**Корневая причина:**
- В `openAddPlanModal()` (index.html:4794-4796) НЕ вызывался метод `clearSelection()`
- Сбрасывался только `financialCenterId`, но НЕ очищался визуальный выбор в Choices.js
- `element.value` сохранял старое значение из предыдущей сессии
- При выборе счета метод `updateFinancialCenter()` читал `element.value` и восстанавливал категорию

**Сравнение с другими модальными окнами:**
- ✅ `openAddTransactionModal()` - **РАБОТАЕТ** (вызывает `clearSelection()`)
- ✅ `openFactTransferModal()` - **РАБОТАЕТ** (вызывает `clearSelection()` для обоих деревьев)
- ✅ `openPlanTransferModal()` - **РАБОТАЕТ** (вызывает `clearSelection()` для обоих деревьев)
- ❌ `openAddPlanModal()` - **НЕ РАБОТАЕТ** (НЕ вызывает `clearSelection()`)

### 2. Plan Hints рассчитываются без проверки наличия счета И категории

**Проявление:**
- Открыть модальное окно создания плана
- Выбрать только счет (без категории)
- Plan Hints загружаются и показывают данные (некорректно)

**Корневая причина:**
- В index.html функция `loadPlanHints()` была заглушкой (stub)
- Отсутствовала проверка наличия ОБОИХ полей (financialCenterId + articleId)
- Hints должны рассчитываться только после выбора ОБОИХ полей

**Сравнение с другими hints:**
- ✅ `loadFactHints()` (index.html:3589-3601) - **РАБОТАЕТ** (проверяет FC + article)
- ❌ `loadPlanHints()` (index.html:3556-3558) - **ЗАГЛУШКА** (stub функция)

### 3. При смене счета категория НЕ должна очищаться

**Текущее поведение:** ПРАВИЛЬНОЕ
- При смене счета категория сохраняется (если доступна для нового счета)
- Это реализовано в методе `updateFinancialCenter()` класса `ChoicesCategoryTree`

**Требование:** Оставить как есть (работает корректно)

## Решение

### Архитектурное решение

**Паритет с plan.html:**
- В plan.html все функции реализованы правильно
- Скопировать логику из plan.html в index.html

### 1. Исправить `openAddPlanModal()` в index.html

**Файл:** `frontend/web/templates/index.html:4791-4798`

**Было:**
```javascript
// CRITICAL: Reset FC filter state for create modals (not edit modals)
// This ensures isInitialFiltering works correctly on modal reopening
// Without this, previousFcId persists between modal openings, causing phantom auto-selection
if (typeof planCategoryTreeSelect !== 'undefined' && planCategoryTreeSelect) {
    planCategoryTreeSelect.options.financialCenterId = null;
}
```

**Стало:**
```javascript
// CRITICAL: Reset FC filter state and clear selection for create modals
// This ensures isInitialFiltering works correctly on modal reopening
// Without this, previousFcId persists between modal openings, causing phantom auto-selection
if (typeof planCategoryTreeSelect !== 'undefined' && planCategoryTreeSelect) {
    planCategoryTreeSelect.options.financialCenterId = null;
    planCategoryTreeSelect.clearSelection();
    console.log('[MODAL_CREATE] Plan modal: FC reset and selection cleared');
}
```

**Изменения:**
- ✅ Добавлен вызов `planCategoryTreeSelect.clearSelection()`
- ✅ Добавлено логирование `[MODAL_CREATE]`
- ✅ Обновлен комментарий

### 2. Реализовать `loadPlanHints()` в index.html

**Файл:** `frontend/web/templates/index.html:3551-3690`

**Было:**
```javascript
/**
 * Stub for loadPlanHints - plan hints not implemented on dashboard
 * Full implementation exists in plan.html
 * @param {Object|null} category - Selected category (unused in stub)
 */
function loadPlanHints(category = null) {
    // Plan hints are not shown on dashboard - this is a stub to prevent errors
    debugLog('[loadPlanHints] Stub called on dashboard - hints not displayed');
}
```

**Стало:**
Полная реализация, скопированная из `plan.html:1142-1269`:
- Добавлены переменные debounce: `planHintsTimeout`, `planHintsController`
- ✅ Проверка наличия FC + article (строки 3587-3611)
- Debounce 300ms
- API вызов к `/api/v1/analytics/plan-hints`
- Comprehensive logging с префиксом `[PLAN_HINTS]`

**Ключевая валидация (строки 3599-3610):**
```javascript
// If either FC or category NOT selected, show placeholder and return
if (!financialCenterId || !articleId) {
    console.log('[PLAN_HINTS] ⚠️ SKIPPED: Missing required fields', {
        fcSelected: !!financialCenterId,
        categorySelected: !!articleId
    });
    prevPlanBtn.innerHTML = 'План пред. мес: --';
    prevPlanBtn.disabled = true;
    prevPlanBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    prevFactBtn.innerHTML = 'Факт пред. мес: --';
    prevFactBtn.disabled = true;
    prevFactBtn.className = 'btn btn-xs btn-ghost btn-disabled';
    return;
}
```

### 3. Добавить `updatePlanHintButtons()` в index.html

**Файл:** `frontend/web/templates/index.html:3692-3756`

Функция для обновления кнопок hints, скопированная из `plan.html:1276-1324`:

**Ключевые возможности:**
- Форматирование сумм (показывает 'k' для тысяч)
- Кнопки становятся кликабельными и заполняют поле amount
- Разные стили для Plan (btn-info) и Fact (btn-success)
- Показывает название месяца (например, "План Ноя: 50k₽")

**Хелпер `setPlanAmount()` (строки 3720-3727):**
```javascript
const setPlanAmount = (amount) => {
    const amountInput = document.querySelector('#form_modal_add_plan input[name="amount"]');
    if (amountInput) {
        amountInput.value = amount.toFixed(0);
        amountInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('[PLAN_HINTS] Amount set:', amount);
    }
};
```

### 4. Добавить проверку FC + category в plan FC change handler

**Файл:** `frontend/web/templates/index.html:3380-3386`

**Было:**
```javascript
// Update plan hints
const selectedCategory = planCategoryTreeSelect ? planCategoryTreeSelect.getSelectedCategory() : null;
loadPlanHints(selectedCategory);
```

**Стало:**
```javascript
// Update plan hints ONLY if both FC and category selected
const selectedCategory = planCategoryTreeSelect ? planCategoryTreeSelect.getSelectedCategory() : null;
if (fcId && selectedCategory) {
    loadPlanHints(selectedCategory);
} else {
    console.log('[FC_CHANGE] Not loading hints - missing FC or category');
}
```

**Изменения:**
- ✅ Добавлена проверка `if (fcId && selectedCategory)`
- ✅ Добавлено логирование причины пропуска
- ✅ Паритет с transaction modal FC change handler (строки 3344-3349)

## Логирование

### Comprehensive logging добавлен на всех уровнях

**При открытии модального окна:**
```
[MODAL_CREATE] Plan modal: FC reset and selection cleared
[ChoicesCategoryTree] clearSelection() called
[ChoicesCategoryTree] Choices.js active items removed
[ChoicesCategoryTree] Element value cleared
[ChoicesCategoryTree] ✅ Selection cleared successfully
```

**При выборе счета:**
```
[FC_CHANGE] Financial center changed in plan modal: {fcId: 1, timestamp: "..."}
[FC_CHANGE] Stopped event propagation
[FC_CHANGE] Updating category tree with new FC
[FC_CHANGE] Category tree updated successfully
[FC_CHANGE] DOM settled, category dropdown ready
[FC_CHANGE] Not loading hints - missing FC or category
```

**При выборе категории:**
```
[PLAN_HINTS] loadPlanHints() called: {category: 45, categoryName: "Продукты", timestamp: "..."}
[PLAN_HINTS] Validation check: {fcId: "1", articleId: 45, bothSelected: true}
[PLAN_HINTS] ✅ Validation PASSED - proceeding with API call
[PLAN_HINTS] Amount set: 50000
```

**Если FC или category отсутствует:**
```
[PLAN_HINTS] ⚠️ SKIPPED: Missing required fields {fcSelected: true, categorySelected: false}
```

## Edge Cases Handled

### 1. Пользователь выбирает категорию ДО выбора счета

**Сценарий:** Пользователь открывает modal, выбирает категорию 45, затем выбирает счет 1.

**Ожидается:** Категория 45 сохраняется если она доступна для счета 1, очищается если нет.

**Реализация:** `updateFinancialCenter()` проверяет доступность категории для нового счета независимо от mode.

### 2. Модальное окно переоткрывается без page refresh

**Проблема:** При повторном открытии модала без refresh `element.value` может сохранять старое значение.

**Решение:** `clearSelection()` вызывается при КАЖДОМ `openAddPlanModal()`.

### 3. Быстрое переключение между счетами

**Проблема:** При быстром переключении между счетами могут накапливаться pending API запросы.

**Решение:**
- Debounce 300ms (строка 3625)
- AbortController отменяет предыдущий запрос (строки 3574-3576, 3633)

### 4. Offline mode

**Проблема:** API недоступен в offline режиме.

**Решение:** Проверка `navigator.onLine` (строка 3626)

## Тестирование

### Сценарий 1: Создание плана (первое открытие)
1. Открыть главную страницу
2. Нажать "Добавить план"
3. **Ожидается:** Категория ПУСТАЯ ✅
4. Выбрать счет
5. **Ожидается:** Категория ОСТАЁТСЯ ПУСТОЙ ✅
6. **Ожидается:** Plan Hints НЕ загружаются (нет категории) ✅
7. Выбрать категорию
8. **Ожидается:** Plan Hints загружаются и показывают данные ✅
9. Закрыть модальное окно, повторить
10. **Ожидается:** Категория ПУСТАЯ при каждом открытии ✅

### Сценарий 2: Создание плана (категория ДО счета)
1. Открыть "Добавить план"
2. Выбрать категорию (без выбора счета)
3. **Ожидается:** Plan Hints НЕ загружаются (нет счета) ✅
4. Выбрать счет
5. **Ожидается:** Plan Hints загружаются ✅
6. **Ожидается:** Категория сохранилась (если доступна для счета) ✅

### Сценарий 3: Смена счета
1. Открыть "Добавить план"
2. Выбрать счет 1
3. Выбрать категорию 45
4. **Ожидается:** Plan Hints загружаются для счета 1 + категория 45 ✅
5. Изменить счет на 2
6. **Ожидается:** Категория 45 сохранилась (если доступна для счета 2) ✅
7. **Ожидается:** Plan Hints обновились для счета 2 + категория 45 ✅

### Сценарий 4: Offline mode
1. Открыть "Добавить план"
2. Переключить браузер в offline режим (DevTools → Network → Offline)
3. Выбрать счет и категорию
4. **Ожидается:** Plan Hints показывают placeholder "--" ✅

### Проверка логов

Для каждого сценария проверить:
- `[MODAL_CREATE]` при открытии
- `[ChoicesCategoryTree] clearSelection()` при открытии
- `[PLAN_HINTS] Validation check` при выборе счета/категории
- Правильное решение (`bothSelected: true/false`)

## Breaking Changes

**НЕТ BREAKING CHANGES.**

- Default `mode: 'edit'` в ChoicesCategoryTree сохраняет существующее поведение
- Метод `clearSelection()` - существующий API, используется корректно
- Все изменения обратно совместимы

## Связанные файлы

### Изменённые файлы

**1. `frontend/web/templates/index.html`:**
- Строки 4791-4798: Добавлен `clearSelection()` в `openAddPlanModal()`
- Строки 3551-3690: Заменён stub `loadPlanHints()` на полную реализацию
- Строки 3692-3756: Добавлена функция `updatePlanHintButtons()`
- Строки 3380-3386: Добавлена проверка FC + category в plan FC change handler

**2. Minified files (автоматически обновлены):**
- Все файлы frontend/web/static/js/*.min.js
- Все файлы frontend/shared/static/js/*.min.js
- sw.min.js

### Не изменённые файлы (для контекста)

**1. `frontend/web/templates/plan.html`:**
- Используется как reference implementation
- Все функции уже работают правильно

**2. `frontend/shared/static/js/choicesCategoryTree.js`:**
- Класс `ChoicesCategoryTree` с методом `clearSelection()`
- Опция `mode: 'create' | 'edit'` для контроля сохранения выбора
- Метод `updateFinancialCenter()` для фильтрации категорий

**3. `frontend/web/templates/components/modal_plan.html`:**
- HTML structure с hint buttons (hint-prev-plan, hint-prev-fact)

## Commit Message

```
fix(frontend): fix plan modal category auto-selection and implement plan hints

Проблемы:
1. При открытии modal_add_plan категория автоматически заполнялась значением
   из предыдущей сессии (phantom auto-selection)
2. loadPlanHints() была заглушкой, hints не рассчитывались
3. Plan Hints загружались без проверки наличия счета И категории

Решение:
- Добавлен clearSelection() в openAddPlanModal() (index.html:4796)
- Реализован loadPlanHints() вместо заглушки (index.html:3561-3690)
- Добавлен updatePlanHintButtons() (index.html:3698-3756)
- Добавлена проверка FC + category в plan FC change handler (index.html:3382-3385)

Comprehensive logging добавлен для debugging:
- [MODAL_CREATE] - открытие модального окна
- [PLAN_HINTS] - загрузка hints
- [FC_CHANGE] - изменение счета

Скопирована логика из plan.html (строки 1142-1324, 4232-4235).
Все модальные окна теперь работают единообразно.

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## References

- **Issue:** Phantom category auto-selection + Plan Hints stub
- **Root cause:** Missing `clearSelection()` + stub `loadPlanHints()`
- **Architecture pattern:** Паритет с plan.html реализацией
- **Related docs:**
  - `/docs/architecture/category-selection-fix.md` - ChoicesCategoryTree clearSelection()
  - `/docs/architecture/frontend-loading-patterns.md` - Modal button state management
