# Анализ переиспользования формы добавления плана

**Дата анализа:** 2026-02-11
**Анализируемые страницы:**
- Главная страница: `/` (https://fbd.ikeniborn.ru/)
- Страница планов: `/plan` (https://fbd.ikeniborn.ru/plan)

## Резюме

Модальная форма добавления плана **успешно переиспользуется** через единый модуль `modalPlan/index.ts` на обеих страницах. Однако обнаружены критические проблемы:

1. ❌ **~1500 строк мертвого кода** в `plan.html` (ищет несуществующий `modal_add_plan`)
2. ❌ **Дублирование модального окна** на главной странице (`modal_add_plan` не используется)
3. ✅ **Обе страницы работают корректно** через новый код `window.openModalPlan()`

**Вердикт:** Форма переиспользуется, но требуется удаление legacy-кода и дубликатов.

---

## 1. HTML-шаблон (переиспользуется ✅)

### Файл: `frontend/web/templates/components/modal_plan.html`

**Структура:**
- Jinja2 макрос с параметром `modal_id` (по умолчанию `'modal_plan'`)
- Две вкладки (tabs):
  - **"Расход/Доход"** (transaction tab)
  - **"Перевод"** (transfer tab)
- Подключает подшаблоны:
  - `components/tabs/plan_transaction_tab.html`
  - `components/tabs/plan_transfer_tab.html`
- Кнопка сохранения вызывает `window.savePlanModal?.(this)`

**Пример использования макроса:**
```jinja
{{ modal_plan('modal_plan') }}
```

### Использование на страницах:

#### **index.html** (главная страница)
```jinja
<!-- Строка 6: Импорт макроса -->
{% from "components/modal_plan.html" import modal_plan %}

<!-- Строка 184: Создание модального окна -->
{{ modal_plan('modal_add_plan') }}

<!-- Строка 266: ДУБЛИРОВАНИЕ! Создание второго окна -->
{{ modal_plan('modal_plan') }}
```

❌ **Проблема:** На главной странице создаются **ДВА экземпляра** модального окна:
- `modal_add_plan` (не используется JavaScript-кодом)
- `modal_plan` (используется модулем `dashboard/modalPlan`)

#### **plan.html** (страница планов)
```jinja
<!-- Строка 11: Импорт макроса -->
{% from "components/modal_plan.html" import modal_plan %}

<!-- Строка 124: Создание модального окна -->
{{ modal_plan('modal_plan') }}
```

✅ Одно модальное окно, используется модулем `plan/crud.ts`

---

## 2. JavaScript-логика (НЕ переиспользуется ❌)

### ✅ Единая реализация управления модальным окном:

| Аспект | Главная страница (`/`) | Страница планов (`/plan`) |
|--------|------------------------|---------------------------|
| **Модуль** | `dashboard/features/modalPlan/index.ts` | `dashboard/features/modalPlan/index.ts` ✅ |
| **Функция открытия** | `window.openModalPlan()` | `window.openModalPlan()` ✅ |
| **Modal ID** | `modal_plan` | `modal_plan` ✅ |
| **Загрузка данных** | Асинхронная загрузка параллельно | Асинхронная загрузка параллельно ✅ |
| **Skeleton loader** | ✅ Да | ✅ Да |
| **Keyboard shortcuts** | ✅ Да (Escape, Ctrl+Enter) | ✅ Да (Escape, Ctrl+Enter) |
| **Recurring plans** | ✅ Да (v10.x+) | ✅ Да (v10.x+) |
| **Transfer hints** | ✅ Да (план предыдущего месяца) | ✅ Да (план предыдущего месяца) |

**Примечание:** Обе страницы используют ОДИНАКОВЫЙ модуль и функционал. Inline JavaScript в `plan.html` - мертвый код.

---

## 3. Детальное сравнение функций

### 3.1. Функция открытия модального окна

#### Dashboard (`openModalPlan()`)
```typescript
// frontend/web/static/js/dashboard/features/modalPlan/index.ts:413
export async function openModalPlan(): Promise<void> {
  const modalId = 'modal_plan';
  const modal = document.getElementById(modalId) as HTMLDialogElement;

  // Проверка на дублирование
  if (modal.open) {
    debugLog('[ModalPlan] Modal already open, skipping re-initialization');
    return;
  }

  modal.showModal();

  // CRITICAL: Двойной requestAnimationFrame для рендера DOM
  await new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );

  // Показать skeleton
  showSkeleton();

  // Загрузка данных параллельно
  await Promise.all([
    loadTransactionTabData(),
    loadTransferTabData()
  ]);

  // Setup функций
  setupRecurringListeners('modal_plan');
  setupPlanTypeToggle();
  hideSkeleton();
  setupPlanPeriodButtons();

  // Keyboard shortcuts
  keyboardShortcutsCleanup = setupModalKeyboardShortcuts(...);
}
```

#### Plan (`openAddPlanModal()`)
```typescript
// frontend/web/static/js/plan/crud.ts:268
export function openAddPlanModal(): void {
  const modalId = 'modal_plan';

  // Сброс состояния кнопки
  const form = document.getElementById('form_modal_plan') as HTMLFormElement | null;
  const submitBtn = form?.querySelector('.save-btn') as HTMLButtonElement | null;
  if (submitBtn) {
    submitBtn.disabled = false;
    delete (submitBtn as any).dataset.originalHtml;
  }

  // Сброс фильтра категорий
  if (typeof createCategoryTreeSelect !== 'undefined' && createCategoryTreeSelect) {
    createCategoryTreeSelect.options.financialCenterId = null;
    createCategoryTreeSelect.clearSelection();
  }

  // Pre-fill reminder datetime
  prefillReminderDateTime(modalId);

  // Открытие модального окна
  const modal = document.getElementById(modalId) as HTMLDialogElement | null;
  if (modal && modal.showModal) {
    modal.showModal();

    // Backdrop click handler
    if (!(modal.dataset.backdropHandlerAdded)) {
      modal.addEventListener('click', (e) => {
        const modalBox = modal.querySelector('.modal-box');
        if (modalBox && !modalBox.contains(e.target as Node)) {
          modal.close();
        }
      });
      modal.dataset.backdropHandlerAdded = 'true';
    }

    // Toggle plan mode
    togglePlanMode(modalId);
  }
}
```

**Различия:**
1. Dashboard - асинхронная функция с параллельной загрузкой данных
2. Plan - синхронная функция с простым открытием
3. Dashboard - использует skeleton loader
4. Plan - использует prefill для reminder datetime

### 3.2. Функция сохранения

#### Dashboard (`savePlanModal()`)
```typescript
// frontend/web/static/js/dashboard/features/modalPlan/saveOperations.ts:44
export async function savePlanModal(button: HTMLElement): Promise<void> {
  if ((button as HTMLButtonElement).disabled) return;

  const form = document.getElementById('form_modal_plan') as HTMLFormElement;
  const activeTab = getCurrentTab(); // 'transaction' | 'transfer'

  setButtonLoading(button, true);

  // v10.1.52: Отключение валидации на неактивных вкладках
  disableInactiveTabValidation(activeTab);

  if (!form.checkValidity()) {
    setButtonLoading(button, false);
    form.reportValidity();
    restoreRequiredValidation();

    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Заполните все обязательные поля', 'warning');
    }
    return;
  }

  try {
    if (activeTab === 'transaction') {
      await savePlanTransaction(form);
    } else {
      // Lazy loading для transfer
      const { savePlanTransfer } = await import('./saveTransfer');
      await savePlanTransfer(form);
    }

    closeModalPlan();

    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('План сохранён', 'success');
    }

  } catch (error) {
    // Error handling...
  } finally {
    setButtonLoading(button, false);
    restoreRequiredValidation();
  }
}
```

#### Plan (используется `createPlan()`)
```typescript
// frontend/web/static/js/plan/crud.ts:1321
export async function createPlan(event: Event): Promise<void> {
  event.preventDefault();
  const form = (event.target as HTMLFormElement);
  setSubmitLoading(form, true);

  const formData = new FormData(form);
  const modalId = 'modal_plan';

  const planMode = formData.get('plan_mode') || 'regular';
  const isRecurring = (planMode === 'recurring');
  const enableReminder = (planMode === 'reminder');

  try {
    if (isRecurring) {
      // Создание recurring плана (200+ строк логики)
      const recurringSettings = collectRecurringSettings(modalId);
      // ... сложная логика recurring планов
    } else {
      // Создание обычного плана
      const planMonth = formData.get('plan_month') as string;
      const factDate = `${planMonth}-01`;

      const data: any = {
        record_type: 'plan',
        amount: parseFloat(formData.get('amount') as string),
        // ... остальные поля
      };

      // Использование OfflineManager для оффлайн-поддержки
      if ((window as any).offlineManager) {
        const result = await (window as any).offlineManager.createPlan(data);
        // ... обработка результата
      }
    }
  } catch (error) {
    // Error handling...
  } finally {
    setSubmitLoading(form, false);
  }
}
```

**Различия:**
1. Dashboard - роутер для transaction/transfer сохранения
2. Plan - полная логика recurring планов и reminder
3. Dashboard - использует lazy loading для transfer модуля
4. Plan - интегрирован с OfflineManager для оффлайн-режима

---

## 4. Проблемы и риски

### 4.1. Мертвый код в plan.html ❌❌❌
**Проблема:** ~1500 строк inline JavaScript ищут несуществующий элемент `#modal_add_plan`

**Примеры мертвого кода:**
```javascript
// Строка 1182: Инициализация несуществующего modal
const modalId = 'modal_add_plan';  // Элемент НЕ существует!

// Строка 1202: Event listener на несуществующей форме
document.getElementById('form_modal_add_plan').addEventListener('submit', ...);
// ↑ Возвращает null → listener НЕ устанавливается

// Строка 1395: querySelector на несуществующих элементах
const createSelect = document.querySelector('#form_modal_add_plan select[name="article_id"]');
// ↑ Возвращает null → код НЕ выполняется
```

**Объем мертвого кода:**
- ~1500 строк JavaScript (строки 938-4297)
- ~50KB HTML файла
- Функции: loadPlanCategories, savePlan, loadPlanHints, initRecurringFields, и др.

**Риск:**
- Путаница для разработчиков (кажется, что код работает)
- Увеличение размера HTML файла
- Ложное ощущение "двух реализаций"

### 4.2. Дублирование HTML-элемента на главной странице ❌
**Проблема:** `index.html` создает два модальных окна с разными ID

```jinja
{{ modal_plan('modal_add_plan') }}  <!-- Строка 184: НЕ используется (legacy) -->
{{ modal_plan('modal_plan') }}      <!-- Строка 266: Используется -->
```

**Риск:**
- Пустой DOM-элемент `#modal_add_plan` занимает ~10KB памяти
- Путаница для разработчиков
- Потенциальные конфликты CSS/JavaScript

### 4.3. Legacy-модули в codebase ❌

| Модуль | Состояние | Используется? |
|--------|-----------|---------------|
| `dashboard/features/addPlan/planForm.ts` | ❌ Legacy | НЕТ (ищет `#form_modal_add_plan`) |
| `dashboard/features/addPlan/planHints.ts` | ❌ Legacy | НЕТ (ищет `#form_modal_add_plan`) |
| `dashboard/features/addPlan/periodButtons.ts` | ✅ Актуальный | ДА (использует `#modal_plan`) |
| `dashboard/features/modalPlan/index.ts` | ✅ Актуальный | ДА (основной модуль) |

**Риск:** Разработчики могут случайно модифицировать legacy-код, думая, что он используется

---

## 5. Рекомендации по очистке кода

### 5.1. Удалить мертвый код из plan.html ❗❗❗

**Цель:** Удалить ~1500 строк неработающего JavaScript

**План действий:**
1. Открыть `frontend/web/templates/plan.html`
2. Найти блок с inline JavaScript (строки 938-4297)
3. Удалить весь код, ссылающийся на `modal_add_plan` и `form_modal_add_plan`
4. Проверить, что FAB кнопка по-прежнему вызывает `window.openModalPlan()`

**Код для удаления:**
```javascript
// ❌ УДАЛИТЬ: Строки 938-4297
const cfoSelect = document.querySelector('#form_modal_add_plan select[name="financial_center_id"]');
// ... ~1500 строк мертвого кода
```

**Код для сохранения:**
```javascript
// ✅ СОХРАНИТЬ: FAB integration (уже работает)
// FAB кнопка вызывает window.openModalPlan() через fab_toolbar.html
```

### 5.2. Удалить дублирование HTML в index.html ❗

**Цель:** Удалить избыточный `modal_add_plan`

**До:**
```jinja
<!-- index.html строка 184 -->
{{ modal_plan('modal_add_plan') }}  <!-- ❌ УДАЛИТЬ -->

<!-- index.html строка 266 -->
{{ modal_plan('modal_plan') }}      <!-- ✅ ОСТАВИТЬ -->
```

**После:**
```jinja
<!-- index.html -->
{{ modal_plan('modal_plan') }}
```

### 5.3. Удалить legacy-модули из codebase ❗

**Цель:** Удалить неиспользуемые файлы

**Файлы для удаления:**
```bash
rm frontend/web/static/js/dashboard/features/addPlan/planForm.ts
rm frontend/web/static/js/dashboard/features/addPlan/planHints.ts
# Также удалить импорты из windowExports.ts (строки 46-64)
```

**Файлы для сохранения:**
```bash
# ✅ АКТУАЛЬНЫЕ модули
frontend/web/static/js/dashboard/features/addPlan/periodButtons.ts
frontend/web/static/js/dashboard/features/modalPlan/index.ts
frontend/web/static/js/dashboard/features/modalPlan/saveOperations.ts
frontend/web/static/js/dashboard/features/modalPlan/tabManager.ts
```

### 5.4. Обновить комментарии в windowExports.ts ✅

**Цель:** Удалить упоминания "backward compatibility"

**Изменить:**
```typescript
// ❌ ДО
// Add Plan imports (Phase 3) - kept for backward compatibility with legacy inline JavaScript
import {
  loadPlanCategories as loadPlanCategoriesImpl,
  savePlan as savePlanImpl,
  // ...
} from '../features/addPlan';

// ✅ ПОСЛЕ (удалить импорты)
// Plan modal uses new implementation from modalPlan/
```

### 5.5. Провести тестирование ✅

**План тестирования:**
1. ✅ Главная страница: Открыть модальное окно через FAB → Создать план (transaction)
2. ✅ Главная страница: Открыть модальное окно через FAB → Создать перевод (transfer)
3. ✅ Страница планов: Открыть модальное окно через FAB → Создать план
4. ✅ Страница планов: Создать recurring plan
5. ✅ Проверить keyboard shortcuts (Escape, Ctrl+Enter)
6. ✅ Проверить skeleton loader при открытии

**Критерии успеха:**
- Все функции работают на обеих страницах
- Нет ошибок в консоли браузера
- Размер `plan.html` уменьшен на ~50KB

---

## 6. Критическая находка: Мертвый код 💀

### Несоответствие в plan.html

**Проблема:** В файле `plan.html` обнаружено критическое несоответствие:

| Аспект | Что создано | Что используется |
|--------|-------------|------------------|
| HTML-шаблон | `{{ modal_plan('modal_plan') }}` (строка 124) | `modal_plan` |
| Inline JavaScript | ❌ Ищет `#form_modal_add_plan` | `modal_add_plan` |
| FAB кнопка | ✅ Вызывает `window.openModalPlan()` | `modal_plan` |

**Последствия:**
- ❌ ~1500 строк inline JavaScript в `plan.html` (строки 938-4297) **НЕ РАБОТАЮТ**
- ❌ Код ищет элемент `#modal_add_plan`, которого НЕ СУЩЕСТВУЕТ на странице
- ❌ Все селекторы `#form_modal_add_plan select[...]` возвращают `null`
- ✅ Страница `/plan` РАБОТАЕТ, потому что FAB использует новый код `window.openModalPlan()`

**Примеры мертвого кода:**
```javascript
// plan.html:1182 - НЕ РАБОТАЕТ (нет элемента #modal_add_plan)
const modalId = 'modal_add_plan';

// plan.html:1202 - НЕ РАБОТАЕТ (нет формы #form_modal_add_plan)
document.getElementById('form_modal_add_plan').addEventListener('submit', async function(e) {
  // ... 200+ строк логики
});

// plan.html:3441 - НЕ РАБОТАЕТ (selector возвращает null)
const createSelect = document.querySelector('#form_modal_add_plan select[name="article_id"]');
```

**Вывод:** План можно создать только через FAB кнопку (`window.openModalPlan()`), но не через inline JavaScript (который не может найти элементы).

---

## 7. Заключение

### Текущее состояние:
- ✅ HTML-шаблон переиспользуется на обеих страницах
- ✅ JavaScript-логика унифицирована через `window.openModalPlan()`
- ❌ На главной странице ДУБЛИРУЕТСЯ модальное окно (`modal_add_plan` не используется)
- ❌ В `plan.html` ~1500 строк МЕРТВОГО кода (ищет несуществующий `modal_add_plan`)
- ✅ Обе страницы ФАКТИЧЕСКИ используют один и тот же модуль (`modalPlan/index.ts`)

### Рекомендуемые действия:
1. **Критический приоритет:**
   - ❗ Удалить ~1500 строк мертвого inline JavaScript из `plan.html` (строки 938-4297)
   - ❗ Удалить дубликат `modal_add_plan` из `index.html` (строка 184)
   - ❗ Удалить устаревшие модули `dashboard/features/addPlan/` (planForm.ts, planHints.ts)

2. **Высокий приоритет:**
   - Провести code review и удалить все ссылки на `modal_add_plan` из codebase
   - Обновить комментарии в `windowExports.ts` (удалить "backward compatibility" заметки)
   - Провести тестирование создания планов на обеих страницах

3. **Средний приоритет:**
   - Документировать миграцию с `modal_add_plan` на `modal_plan`
   - Создать тесты для предотвращения подобных несоответствий в будущем

### Ожидаемые результаты после рефакторинга:
- ✅ Удаление ~1500 строк мертвого кода (уменьшение HTML на ~50KB)
- ✅ Упрощенная поддержка (один модуль вместо двух)
- ✅ Консистентное UX на всех страницах
- ✅ Уменьшение путаницы для разработчиков

---

**Дополнительные файлы для анализа:**
- `frontend/web/templates/components/tabs/plan_transaction_tab.html`
- `frontend/web/templates/components/tabs/plan_transfer_tab.html`
- ~~`frontend/web/static/js/dashboard/features/addPlan/planForm.ts`~~ (удалён в v11.x)
- ~~`frontend/web/static/js/dashboard/features/addPlan/planHints.ts`~~ (удалён в v11.x)

---

## Результаты очистки кода (v11.x)

**Дата выполнения:** 2026-02-11
**Коммит:** 1ae39eee "refactor: remove legacy modal code and duplication"
**Ветка:** dev/cleanup_legacy_modal_code_20260211

### Выполненные работы:

#### 1. Удаление мертвого inline JavaScript

**Файл:** `frontend/web/templates/plan.html`

**Удалено:** Строки 899-4314 (~3416 строк)

**Содержимое удаленного кода:**
- `loadPlanHints(category)` - загрузка подсказок для `#form_modal_add_plan`
- `savePlan(button)` - сохранение плана через `#form_modal_add_plan`
- `initializePlanModal('modal_add_plan')` - инициализация legacy модалки
- `setupModalObserver()` - MutationObserver для `modal_add_plan`
- ~20 вспомогательных функций для recurring планов, reminder настроек

**Почему код был мертвым:**
- Селектор `#form_modal_add_plan` не существовал в DOM (модалка была удалена в v10.x)
- `querySelector()` возвращал `null`
- Event listeners НЕ устанавливались
- FAB кнопка вызывала `window.openModalPlan()` (новый код v9.0+)

**Результат:**
```
plan.html: 5780 строк → 2364 строки (58% reduction, ~50KB saved)
```

#### 2. Удаление дублированных модалок

**Файл:** `frontend/web/templates/index.html`

**Удалено:**
```jinja
{{ modal_fact('modal_add_transaction') }}  # Строка 181
{{ modal_plan('modal_add_plan') }}          # Строка 184
```

**Сохранено (актуальные v9.0+):**
```jinja
{{ modal_fact('modal_fact') }}   # Строка 265
{{ modal_plan('modal_plan') }}   # Строка 266
```

**Результат:** ~20KB saved (2 duplicate modals removed)

---

**Файл:** `frontend/web/templates/facts.html`

**Удалено:**
```jinja
{{ modal_fact('modal_add_transaction') }}  # Строка 203
```

**Сохранено (актуальная v9.0+):**
```jinja
{{ modal_fact('modal_fact') }}  # Строка 209
```

**Результат:** ~10KB saved (1 duplicate modal removed)

#### 3. Удаление legacy TypeScript модулей

**Удалены файлы:**
- ✅ `frontend/web/static/js/dashboard/features/addPlan/planForm.ts` (188 строк)
- ✅ `frontend/web/static/js/dashboard/features/addPlan/planHints.ts` (162 строки)

**Причина удаления:**
- `planForm.ts:29` - ищет `#form_modal_add_plan` (не существует)
- `planHints.ts:18` - ищет `#form_modal_add_plan` (не существует)
- Никогда не вызываются, т.к. селекторы не найдены

**Заменены на:**
- `features/modalPlan/saveOperations.ts` - роутер для transaction/transfer сохранения
- `features/modalPlan/saveTransaction.ts` - логика сохранения transaction
- `features/modalPlan/index.ts` - загрузка данных с skeleton loader

#### 4. Очистка windowExports.ts

**Удалены импорты (строки 47-50):**
```typescript
loadPlanCategories as loadPlanCategoriesImpl,
savePlan as savePlanImpl,
savePlanOffline as savePlanOfflineImpl,
loadPlanHints as loadPlanHintsImpl,
```

**Удалены функции-обертки:**
```typescript
async function loadPlanCategories(): Promise<void> { ... }
function savePlan(button: HTMLElement): void { ... }
async function savePlanOffline(button: HTMLElement): Promise<void> { ... }
async function loadPlanHints(category: Category | null = null): Promise<void> { ... }
```

**Удалены экспорты:**
- `dashboardExports` объект (строки 651-654)
- `window` экспорты (строки 725-726)

**Сохранено:**
- `togglePlanMode(modalId)` - роутинг на новую/старую реализацию
- Reminder и recurring функции (используются новыми модалками)

#### 5. Очистка типов (globals.d.ts)

**Удалены типы:**
```typescript
// Window interface
loadPlanCategories?: () => Promise<void>;
savePlan?: (button: HTMLElement) => void;

// DashboardExports interface
loadPlanCategories(): Promise<void>;
savePlan(button: HTMLElement): void;
savePlanOffline(button: HTMLElement): Promise<void>;
loadPlanHints(category?: Category | null): Promise<void>;
```

#### 6. Очистка periodButtons.ts

**Изменено:**
```typescript
// ❌ Было:
if (window.Dashboard?.loadPlanCategories) {
  window.Dashboard.loadPlanCategories();
}

// ✅ Стало:
// Legacy: loadPlanCategories removed (v11.x+)
// New modal_plan uses typeToggle.ts with categoryTree.updateType()
```

**Обоснование:**
- Новые модалки используют `typeToggle.ts` для переключения типа категории
- `categoryTree.updateType(type)` автоматически перезагружает категории
- Legacy вызов больше не нужен

### Итоговые метрики:

| Метрика | Значение |
|---------|----------|
| **Удалено строк кода** | 3416 (plan.html) + 350 (TypeScript) = **3766 строк** |
| **Удалено файлов** | 2 (planForm.ts, planHints.ts) |
| **Размер plan.html** | 5780 → 2364 строк (**58% reduction**) |
| **Размер index.html** | **~20KB saved** |
| **Размер facts.html** | **~10KB saved** |
| **Общий эффект** | **~80KB** мертвого кода удалено |
| **TypeScript компиляция** | ✅ 0 ошибок |
| **Build размер** | 800.19 KB (gzip: 141.68 KB) |

### Архитектурные улучшения:

**Было (v10.x):**
```
plan.html:
  - 5780 строк (3416 мертвого inline JS)
  - Дублирование модалок на 3 страницах
  - Legacy TypeScript модули (planForm, planHints)
  - Экспорты для обратной совместимости
```

**Стало (v11.x):**
```
plan.html:
  - 2364 строки (только актуальный код)
  - Единые модалки v9.0+ (modal_fact, modal_plan)
  - Модульная архитектура (modalPlan/, modalFact/)
  - Чистые экспорты (только используемые функции)
```

### Преимущества:

1. ✅ **Уменьшение размера:** ~80KB мертвого кода удалено
2. ✅ **Упрощенная поддержка:** Один модуль вместо двух (modalPlan vs planForm)
3. ✅ **Консистентное UX:** Все страницы используют v9.0+ табовую архитектуру
4. ✅ **Уменьшение путаницы:** Нет дублированных модалок и мертвого кода
5. ✅ **Чистый код:** Удалены неиспользуемые импорты и экспорты

### Что НЕ было удалено (и почему):

**Сохраненные файлы:**
- ✅ `periodButtons.ts` - используется новыми модалками (date range selection)
- ✅ `reminderSettings.ts` - используется для reminder mode
- ✅ `recurringSettings.ts` - используется для recurring планов (v10.x+)

**Сохраненные функции:**
- ✅ `togglePlanMode(modalId)` - роутинг для совместимости (modal_plan → новая реализация)
- ✅ Reminder экспорты - используются из inline JavaScript на других страницах
- ✅ Recurring экспорты - используются из inline JavaScript на других страницах

### Тестирование:

**TypeScript компиляция:**
```bash
npm run type-check
✅ No errors found
```

**Build:**
```bash
npm run build
✅ Build completed in 1.71s
✅ dashboard.min.js: 800.19 KB (gzip: 141.68 KB)
```

**Pre-commit hooks:**
```
✅ No console.log found
✅ Type check passed
```

### Документация:

**Обновлены файлы:**
- ✅ `docs/architecture/frontend/modal-architecture.md` - раздел "Legacy Removal (v11.x+)"
- ✅ `docs/explore/modal-plan-reusability-analysis.md` - раздел "Результаты очистки кода"

### Ссылки:

- **План очистки:** `docs/plans/cleanup-legacy-modal-code.md`
- **Коммит:** 1ae39eee "refactor: remove legacy modal code and duplication"
- **Архитектура модалок:** `docs/architecture/frontend/modal-architecture.md`
- **ES Modules миграция:** `docs/architecture/migrations/es-modules-migration.md`
