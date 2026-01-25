# Прогресс реализации: Объединение модальных окон с вкладками

## ✅ PHASE 1: HTML Templates (ЗАВЕРШЕНО)

### Созданные файлы:

**Tab Templates:**
- ✅ `frontend/web/templates/components/tabs/fact_transaction_tab.html`
- ✅ `frontend/web/templates/components/tabs/fact_transfer_tab.html`
- ✅ `frontend/web/templates/components/tabs/plan_transaction_tab.html`
- ✅ `frontend/web/templates/components/tabs/plan_transfer_tab.html`

**Modal Templates:**
- ✅ `frontend/web/templates/components/modal_fact.html`
- ✅ `frontend/web/templates/components/modal_plan_new.html`

**CSS Styles:**
- ✅ Добавлены стили для вкладок в `frontend/web/static/css/custom.css`
- ✅ Добавлены стили для упрощенного FAB

### Структура модалов:

**modal_fact.html:**
- Header с badge "Факт"
- 2 вкладки: "Расход/Доход" и "Перевод"
- Skeleton loader
- Кнопка сохранения вызывает `saveFactModal(this)`

**modal_plan_new.html:**
- Header с badge "План"
- 2 вкладки: "Расход/Доход" и "Перевод"
- Включает режимы плана (regular/recurring/reminder)
- Skeleton loader
- Кнопка сохранения вызывает `savePlanModal(this)`

---

## ✅ PHASE 2: TypeScript Modules (ЗАВЕРШЕНО)

### Созданные модули:

**modalFact/**
- ✅ `tabManager.ts` - Управление вкладками с кэшированием FormData
- ✅ `index.ts` - Главный модуль, открытие/закрытие модала
- ✅ `saveOperations.ts` - Сохранение транзакций и переводов

**modalPlan/**
- ✅ `tabManager.ts` - Управление вкладками для планов
- ✅ `index.ts` - Главный модуль для modal_plan
- ✅ `saveOperations.ts` - Сохранение планов и переводов планов

**fab/**
- ✅ `contextModal.ts` - Определение контекстного модала по текущей странице

### Обновленные файлы:

- ✅ `frontend/web/static/js/dashboard/adapters/windowExports.ts`
  - Добавлены импорты новых модулей
  - Добавлены экспорты функций в window
  - Добавлены функции в dashboardExports

---

## ✅ PHASE 3: FAB Упрощение (ЗАВЕРШЕНО)

### Что сделано:

- ✅ Создан CSS для упрощенного FAB
- ✅ Создан модуль `contextModal.ts`
- ✅ Экспорт `openContextModal()` в window
- ✅ Обновлён `frontend/web/templates/components/fab_toolbar.html`
  - Упрощён до 1 универсальной кнопки
  - Удалён speed dial menu (desktop и mobile)
  - Удалён backdrop
  - Добавлен вызов `openContextModal()`
  - Упрощена JavaScript логика (убраны toggleDesktopFAB/toggleMobileFAB)

---

## ✅ PHASE 4: Интеграция в страницы (ЗАВЕРШЕНО)

### Обновлённые файлы:

**index.html:**
- ✅ Добавлен импорт `{% from "components/modal_fact.html" import modal_fact %}`
- ✅ Добавлен импорт `{% from "components/modal_plan_new.html" import modal_plan as modal_plan_new %}`
- ✅ Вставлены вызовы `{{ modal_fact('modal_fact') }}` и `{{ modal_plan_new('modal_plan') }}`

**facts.html:**
- ✅ Добавлен импорт `{% from "components/modal_fact.html" import modal_fact %}`
- ✅ Вставлен вызов `{{ modal_fact('modal_fact') }}`

**plan.html:**
- ✅ Добавлен импорт `{% from "components/modal_plan_new.html" import modal_plan as modal_plan_new %}`
- ✅ Вставлен вызов `{{ modal_plan_new('modal_plan') }}`

**Примечание:**
Старые модалы (`modal_transaction.html`, `modal_plan.html`, `modal_transfer.html`) пока оставлены для обратной совместимости. Удалить после успешного тестирования новых модалов.

---

## ⏳ PHASE 5: Доработка функциональности (85% ЗАВЕРШЕНО)

### Критические доработки:

**modalFact/index.ts:**
- ✅ Доработать `loadTransferTabData()` - реализовано полностью
- ✅ Реализовать кэширование для transfer tab
- ✅ Инициализация CategoryTreeSelect для FROM/TO
- ✅ Фильтрация категорий по счёту (работает через transactionCategoryTreeSelect)
- ✅ Загрузка hints для transaction tab (loadFactHints автоматически)
- ✅ Transfer hints (полная интеграция с API, display-only кнопки)

**modalFact/saveOperations.ts:**
- ✅ Реализовано обновление UI после сохранения
  - HTMX triggers для quick stats, account balances, recent transactions
  - reloadFacts() для facts.html
- ✅ Добавлен реальный toast (window.showToast)
- ⏳ Добавить offline save support (отложено)

**modalPlan/index.ts:**
- ✅ Реализовать загрузку данных для обеих вкладок (transaction + transfer)
- ✅ Инициализация CategoryTreeSelect для transfer tab
- ✅ Загрузка plan hints для transaction tab (loadPlanHints автоматически)
- ✅ Transfer hints (полная интеграция с API, кликабельные кнопки заполняют сумму)

**modalPlan/saveOperations.ts:**
- ✅ Реализовано сохранение плана (one-time plan через recurring-plans API)
- ✅ Реализовано сохранение transfer плана
- ✅ Добавлено обновление UI (HTMX triggers + reloadPlans)
- ✅ Full recurring/reminder support (recurring settings UI manager полностью интегрирован)

**Общие доработки:**
- ⏳ Choices.js integration для категорий
- ⏳ Calendar widget для дат
- ⏳ Валидация форм
- ⏳ Обработка ошибок
- ⏳ Loading states для кнопок

---

## ⏳ PHASE 6: Тестирование (НЕ НАЧАТО)

### Сценарии для тестирования:

**Desktop:**
- ⏳ Открытие modal_fact на /, /facts
- ⏳ Открытие modal_plan на /plan
- ⏳ Переключение вкладок с сохранением данных
- ⏳ Сохранение транзакций
- ⏳ Сохранение переводов
- ⏳ Сохранение планов (regular/recurring/reminder)
- ⏳ Skeleton loader

**Mobile:**
- ⏳ FAB позиционирование
- ⏳ Вкладки кликабельны (≥44px)
- ⏳ Modal адаптивен (max-h-[90vh])
- ⏳ Переключение вкладок

**Регрессия:**
- ⏳ Fact Hints работают
- ⏳ Plan Hints работают
- ⏳ Категории фильтруются по счёту
- ⏳ Quick date buttons
- ⏳ Period buttons
- ⏳ Offline mode

---

## ⏳ PHASE 7: Очистка (НЕ НАЧАТО)

После успешного тестирования:

**Удалить старые файлы:**
- ⏳ `frontend/web/templates/components/modal_transaction.html`
- ⏳ `frontend/web/templates/components/modal_plan.html` (старый)
- ⏳ `frontend/web/templates/components/modal_transfer.html`

**Удалить старые TypeScript модули (если не переиспользуются):**
- ⏳ `frontend/web/static/js/dashboard/features/addTransaction/` (части могут быть переиспользованы)
- ⏳ `frontend/web/static/js/dashboard/features/addPlan/` (части могут быть переиспользованы)

**Обновить документацию:**
- ⏳ `docs/architecture/frontend/responsive-design.md`
- ⏳ `docs/architecture/pwa.md`
- ⏳ Создать `docs/architecture/frontend/tabbed-modals.md`

---

## 🎯 Следующие шаги (Приоритет)

### Шаг 1: Упростить FAB (30 минут)
Обновить `fab_toolbar.html` для использования `openContextModal()`.

### Шаг 2: Интегрировать модалы в страницы (1 час)
Добавить новые модалы в index.html, facts.html, plan.html.

### Шаг 3: Тестирование базовой функциональности (2 часа)
- Проверить открытие модалов
- Проверить переключение вкладок
- Проверить сохранение данных в cache

### Шаг 4: Доработка функциональности (4-6 часов)
- Загрузка данных для transfer tabs
- Fact/Plan hints
- Choices.js integration
- Сохранение с обновлением UI

### Шаг 5: Полное тестирование (2-3 часа)
- Desktop/Mobile
- Регрессия
- Edge cases

### Шаг 6: Очистка и документация (1-2 часа)

---

## 📝 Известные ограничения

1. ✅ ~~**Transfer tab data loading**~~ - реализовано полностью (CategoryTreeSelect + FC dropdowns)
2. **Toast notifications** - используется console.log, нужна интеграция с showToast()
3. **Offline support** - не реализован в saveOperations
4. **UI refresh** - после сохранения UI не обновляется автоматически
5. **Choices.js для transaction tab** - не интегрирован (transfer tab использует CategoryTreeSelect)
6. **Calendar widgets** - не интегрированы для выбора дат (используются text inputs с quick buttons)

---

## ⚠️ Критические моменты

1. **Переименование modal_plan_new.html → modal_plan.html**
   - Сейчас создан `modal_plan_new.html` чтобы не конфликтовать со старым
   - После успешного тестирования переименовать:
     ```bash
     mv frontend/web/templates/components/modal_plan.html frontend/web/templates/components/modal_plan_old.html
     mv frontend/web/templates/components/modal_plan_new.html frontend/web/templates/components/modal_plan.html
     ```

2. **TypeScript компиляция**
   - После создания новых модулей нужно запустить:
     ```bash
     cd frontend/web/static/js
     npm run build
     ```

3. **Тестирование на реальном окружении**
   - Развернуть на budget-test для полного тестирования
   - Проверить WebSocket, offline mode, PWA

---

## 📊 Прогресс

**Общий прогресс:** ~85% ✅

- PHASE 1: ✅ 100% (HTML Templates)
- PHASE 2: ✅ 100% (TypeScript Modules - базовая структура)
- PHASE 3: ✅ 100% (FAB упрощение)
- PHASE 4: ✅ 100% (Интеграция в страницы)
- PHASE 5: ⏳ 85% (Доработка функциональности)
  - ✅ TypeScript компилируется успешно (257.91 kB dashboard bundle)
  - ✅ Date helpers (setFactDate, setPlanPeriod)
  - ✅ Transfer tab data loading (CategoryTreeSelect + FC dropdowns)
  - ✅ Transaction tab hints (loadFactHints, loadPlanHints)
  - ✅ Choices.js уже работает (transactionCategoryTreeSelect, planCategoryTreeSelect)
  - ✅ Transfer tab hints (100% - полная интеграция для modalFact + modalPlan)
  - ✅ Save operations с UI refresh (100% - HTMX triggers + toast + validation)
  - ✅ Recurring settings UI manager (100% - togglePlanMode, updateFrequencyFields, extractRecurringSettings)
  - ⏳ Offline support (0% - отложено)
- PHASE 6: ⏳ 0% (Тестирование)
- PHASE 7: ⏳ 0% (Очистка)

**Оценка оставшегося времени:** 30-60 минут работы (event listeners, validation) или можно начать тестирование
