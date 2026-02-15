# План: Удаление мертвого кода и дублирования модальных окон

## Context

На основе анализа кодовой базы (`docs/explore/modal-plan-reusability-analysis.md`) обнаружено, что модальная форма добавления плана успешно переиспользуется через единый модуль `modalPlan/index.ts` на главной странице и странице планов. Однако выявлены критические проблемы:

**Проблемы:**
1. ❌ **~3360 строк мертвого inline JavaScript** в `plan.html` (строки 938-4297), который ищет несуществующий элемент `#form_modal_add_plan`
2. ❌ **Дублирование модальных окон** на 2 страницах:
   - `index.html` (строки 181, 184): legacy `modal_add_transaction`, `modal_add_plan` не используются
   - `facts.html` (строка 203): legacy `modal_add_transaction` не используется
3. ❌ **Legacy TypeScript модули** (`planForm.ts`, `planHints.ts`) ищут несуществующие селекторы
4. ✅ **Все страницы фактически работают корректно** через новый код v9.0+ (`window.openModalFact()`, `window.openModalPlan()`)

**Почему требуется очистка:**
- Путаница для разработчиков (кажется, что legacy-код работает)
- Увеличение размера HTML файлов (~50KB мертвого кода)
- Риск случайной модификации legacy-кода разработчиками
- Потенциальные конфликты CSS/JavaScript из-за дублирования DOM-элементов

**Текущая архитектура (актуальная v9.0+ - модульная TypeScript):**
- **HTML-шаблон:** `frontend/web/templates/components/modal_plan.html` (Jinja2 макрос)
- **TypeScript модули:** `frontend/web/static/js/dashboard/features/modalPlan/` (модульная структура)
  - `index.ts` - главный entry point, асинхронная загрузка данных, skeleton loader
  - `saveOperations.ts` - роутер для transaction/transfer сохранения
  - `saveTransaction.ts` - логика сохранения transaction
  - `saveTransfer.ts` - lazy loading для transfer сохранения
  - `tabManager.ts` - управление переключением вкладок (transaction/transfer)
  - `typeToggle.ts` - переключение типа категории (income/expense)
  - `dateHelpers.ts` - работа с датами и периодами
  - `recurringSettings.ts` - логика recurring планов (v10.x+)
- **Точка входа:** `window.openModalPlan()` (экспортируется через `dashboard/adapters/windowExports.ts`)
- **Аналогичная структура** для `modalFact/` (7 модулей без recurringSettings.ts)

---

## Critical Files

### HTML Templates (удаление legacy):
- `frontend/web/templates/index.html` - Удалить строки 181, 184 (legacy modals: `modal_add_transaction`, `modal_add_plan`)
- `frontend/web/templates/facts.html` - Удалить строку 203 (legacy modal: `modal_add_transaction`)
- `frontend/web/templates/plan.html` - Удалить строки 938-4297 (мертвый inline JavaScript)

### TypeScript Modules (удаление legacy):
- `frontend/web/static/js/dashboard/features/addPlan/planForm.ts` - Удалить (ищет `#form_modal_add_plan`)
- `frontend/web/static/js/dashboard/features/addPlan/planHints.ts` - Удалить (ищет `#form_modal_add_plan`)
- `frontend/web/static/js/dashboard/adapters/windowExports.ts` - Удалить импорты из legacy модулей (строки 45-64)

### Files to Preserve (актуальный модульный TypeScript код):
- **`frontend/web/static/js/dashboard/features/modalPlan/`** - ✅ Актуальная модульная реализация v9.0+ (8 файлов)
  - `index.ts`, `saveOperations.ts`, `saveTransaction.ts`, `saveTransfer.ts`
  - `tabManager.ts`, `typeToggle.ts`, `dateHelpers.ts`, `recurringSettings.ts`
- **`frontend/web/static/js/dashboard/features/modalFact/`** - ✅ Актуальная модульная реализация v9.0+ (7 файлов)
  - `index.ts`, `saveOperations.ts`, `saveTransaction.ts`, `saveTransfer.ts`
  - `tabManager.ts`, `typeToggle.ts`, `dateHelpers.ts`
- `frontend/web/static/js/dashboard/features/addPlan/periodButtons.ts` - ✅ Используется новыми модалками
- `frontend/web/static/js/dashboard/features/addPlan/reminderSettings.ts` - ✅ Используется (для reminder mode)

---

## Implementation Plan

### Phase 1: Подготовка и анализ рисков

**1.1. Создать feature branch**
```bash
git checkout -b dev/cleanup_legacy_modal_code_20260211
```

**1.2. Проверить использование legacy селекторов в проекте**

Поиск всех ссылок на legacy селекторы:
```bash
# Проверить использование modal_add_plan
rg "modal_add_plan|form_modal_add_plan" --type html --type ts --type js

# Проверить использование modal_add_transaction
rg "modal_add_transaction|form_modal_add_transaction" --type html --type ts --type js
```

**Критерий успеха:** Все найденные вхождения находятся только в файлах, которые планируется удалить.

**1.3. Зафиксировать baseline для тестирования**

Записать текущее поведение:
- Главная страница: FAB кнопка → открывается `modal_fact` и `modal_plan`
- Страница планов: FAB кнопка → открывается `modal_plan`
- Обе страницы: создание плана/факта работает через табовую архитектуру v9.0+

---

### Phase 2: Удаление дублирования в index.html и facts.html

**2.1. Удалить legacy модальные окна из index.html**

Файл: `frontend/web/templates/index.html`

**Удалить строки:**
```jinja
<!-- Строка 181: Legacy modal_add_transaction -->
{{ modal_fact('modal_add_transaction') }}

<!-- Строка 184: Legacy modal_add_plan -->
{{ modal_plan('modal_add_plan') }}
```

**Сохранить строки (актуальные v9.0):**
```jinja
<!-- Строка 265 -->
{{ modal_fact('modal_fact') }}

<!-- Строка 266 -->
{{ modal_plan('modal_plan') }}
```

**Ожидаемый результат:**
- Уменьшение размера index.html на ~20KB (2 дубликата модальных окон)
- Только актуальные модалки v9.0+ остаются в DOM

---

**2.2. Удалить legacy модальное окно из facts.html**

Файл: `frontend/web/templates/facts.html`

**Удалить строку 203:**
```jinja
<!-- Legacy modal_add_transaction -->
{{ modal_fact('modal_add_transaction') }}
```

**Сохранить строку 209 (актуальная v9.0):**
```jinja
{{ modal_fact('modal_fact') }}
```

**Ожидаемый результат:**
- Уменьшение размера facts.html на ~10KB (1 дубликат модального окна)
- Только актуальная модалка v9.0+ остается в DOM

---

### Phase 3: Удаление мертвого inline JavaScript в plan.html

**3.1. Удалить inline JavaScript код**

Файл: `frontend/web/templates/plan.html`

**Удалить строки 938-4297** (~3360 строк мертвого кода):

**Примеры кода для удаления:**
```javascript
// Строка 938 - Селекторы несуществующих элементов
const cfoSelect = document.querySelector('#form_modal_add_plan select[name="financial_center_id"]');

// Строка 1182 - Инициализация несуществующего modal
const modalId = 'modal_add_plan';

// Строка 1202 - Event listener на несуществующей форме
document.getElementById('form_modal_add_plan').addEventListener('submit', async function(e) {
  // ... ~200 строк логики
});

// Строки 3000-4200 - Функции loadPlanCategories, savePlan, loadPlanHints, initRecurringFields
```

**Сохранить:**
- Строка 124: `{{ modal_plan('modal_plan') }}` - актуальная модалка v9.0
- FAB кнопка, которая вызывает `window.openModalPlan()`

**Ожидаемый результат:**
- Уменьшение размера plan.html с 5780 строк до ~2420 строк (58% reduction)
- Удаление ~50KB мертвого кода

---

### Phase 4: Удаление legacy TypeScript модулей

**4.1. Удалить файлы**

```bash
rm frontend/web/static/js/dashboard/features/addPlan/planForm.ts
rm frontend/web/static/js/dashboard/features/addPlan/planHints.ts
```

**Обоснование:**
- `planForm.ts:29` - ищет `#form_modal_add_plan` (не существует)
- `planHints.ts:18` - ищет `#form_modal_add_plan` (не существует)
- Никогда не вызываются, т.к. селекторы не найдены

**Сохранить актуальные модули:**
- `periodButtons.ts` - используется новыми модалками
- `reminderSettings.ts` - используется новыми модалками
- `recurringSettings.ts` - используется legacy модалками (пока не удалять)

---

### Phase 5: Очистка windowExports.ts

**5.1. Удалить импорты из legacy модулей**

Файл: `frontend/web/static/js/dashboard/adapters/windowExports.ts`

**Удалить строки 45-64:**
```typescript
// Add Plan imports (Phase 3) - kept for backward compatibility with legacy inline JavaScript
import {
  loadPlanCategories as loadPlanCategoriesImpl,
  savePlan as savePlanImpl,
  savePlanOffline as savePlanOfflineImpl,
  loadPlanHints as loadPlanHintsImpl,
  toggleReminderSettings as toggleReminderSettingsImpl,
  togglePlanMode as togglePlanModeImpl,
  prefillReminderDateTime as prefillReminderDateTimeImpl,
  initReminderCalendarWidget as initReminderCalendarWidgetImpl,
  resetReminderFields as resetReminderFieldsImpl,
  initRecurringFields as initRecurringFieldsImpl,
  resetRecurringOnlyFields as resetRecurringOnlyFieldsImpl,
  resetRecurringSettings as resetRecurringSettingsImpl,
  updateFrequencyFields as updateFrequencyFieldsImpl,
  updateDurationFields as updateDurationFieldsImpl,
  updateRecurringPreview as updateRecurringPreviewImpl,
  collectRecurringSettings as collectRecurringSettingsImpl,
} from '../features/addPlan';
```

**Заменить комментарием:**
```typescript
// Legacy add plan imports removed (v11.x+)
// New implementation in features/modalPlan/ used instead
```

**5.2. Удалить экспортируемые функции (строки 495-577, 667-684, 744-758)**

Удалить функции-обертки:
```typescript
async function loadPlanCategories(): Promise<void> { ... }
function savePlan(button: HTMLElement): void { ... }
async function savePlanOffline(button: HTMLElement): Promise<void> { ... }
async function loadPlanHints(category: Category | null = null): Promise<void> { ... }
// ... и т.д.
```

**5.3. Удалить из dashboardExports объекта (строки 667-684)**

Удалить из экспорта:
```typescript
// Add plan (Phase 3 - IMPLEMENTED, kept for backward compatibility)
loadPlanCategories,
savePlan,
savePlanOffline,
loadPlanHints,
togglePlanMode,
toggleReminderSettings,
// ... и т.д.
```

**5.4. Удалить из window exports (строки 744-758)**

Удалить:
```typescript
// Expose add plan functions globally for onclick handlers
window.loadPlanCategories = loadPlanCategories;
window.savePlan = savePlan;
window.togglePlanMode = togglePlanMode;
// ... и т.д.
```

**IMPORTANT:** Сохранить `togglePlanMode` с роутингом на новую реализацию (строки 511-517):
```typescript
function togglePlanMode(modalId: string): void {
  // Use new implementation for modal_plan, old for legacy modals
  if (modalId === 'modal_plan') {
    return togglePlanModeNewImpl(modalId);
  }
  return togglePlanModeImpl(modalId); // Может использоваться другими страницами
}
```

---

### Phase 6: Проверка TypeScript компиляции

**6.1. Скомпилировать TypeScript**

```bash
cd frontend/web/static
npm run build
```

**Критерий успеха:**
- Нет ошибок TypeScript компиляции
- Build успешно завершается

**6.2. Проверить отсутствие неиспользуемых импортов**

```bash
npm run lint
```

---

### Phase 7: Локальное тестирование

**7.1. Функциональное тестирование**

**Главная страница (index.html):**
1. ✅ Открыть модальное окно факта через FAB → `modal_fact` открывается
2. ✅ Создать факт (transaction tab) → сохраняется, WebSocket обновление
3. ✅ Создать перевод (transfer tab) → сохраняется
4. ✅ Открыть модальное окно плана через FAB → `modal_plan` открывается
5. ✅ Создать план (transaction tab) → сохраняется
6. ✅ Создать план-перевод (transfer tab) → сохраняется
7. ✅ Проверить keyboard shortcuts (Escape, Ctrl+Enter)
8. ✅ Проверить skeleton loader при открытии модалок

**Страница планов (plan.html):**
1. ✅ Открыть модальное окно через FAB → `modal_plan` открывается
2. ✅ Создать обычный план → сохраняется
3. ✅ Создать recurring plan (регулярный платеж) → сохраняется
4. ✅ Создать plan с reminder (напоминание) → сохраняется
5. ✅ Проверить transfer hints (подсказки по переводам)
6. ✅ Проверить keyboard shortcuts

**7.2. Проверить консоль браузера**

**Ожидаемое поведение:**
- ❌ Нет ошибок вида: `#form_modal_add_plan not found`
- ❌ Нет ошибок вида: `modal_add_plan is null`
- ✅ Логи: `[ModalPlan] Modal opened`, `[ModalPlan] Data loaded`

**7.3. Проверить Network tab**

- API запросы к `/api/v1/plans/` должны работать
- API запросы к `/api/v1/hints/plan-hints` должны работать

---

### Phase 8: E2E тестирование (Playwright)

**8.1. Запустить E2E тесты**

```bash
# Все тесты
npm run test:e2e

# Только тесты для планов
npm run test:e2e -- tests/e2e/webapp/test_recurring_plans.spec.ts
```

**Критерий успеха:**
- Все E2E тесты проходят успешно
- Нет новых failing tests

---

### Phase 9: Документация

**9.1. Обновить modal-architecture.md**

Файл: `docs/architecture/frontend/modal-architecture.md`

Добавить в раздел "Legacy Forms (Deprecated)":
```markdown
## Legacy Removal (v11.x+)

**⚠️ Removed in v11.x:**
- `#modal_add_transaction` - удалён (использовать `#modal_fact`)
- `#modal_add_plan` - удалён (использовать `#modal_plan`)
- `#form_modal_add_transaction` - удалён
- `#form_modal_add_plan` - удалён

**Legacy TypeScript modules removed:**
- `features/addPlan/planForm.ts` - удалён (заменён на `modalPlan/saveOperations.ts`)
- `features/addPlan/planHints.ts` - удалён (заменён на `modalPlan/index.ts`)

**Migration completed:**
- Все страницы теперь используют табовую архитектуру v9.0+
- Inline JavaScript удалён из templates
- Единая точка входа: `window.openModalPlan()`
```

**9.2. Обновить исследовательский документ**

Файл: `docs/explore/modal-plan-reusability-analysis.md`

Добавить в конец файла:
```markdown
---

## Результаты очистки кода (v11.x)

**Выполнено:**
- ✅ Удалено ~3360 строк мертвого inline JavaScript из plan.html
- ✅ Удалено дублирование модальных окон в index.html
- ✅ Удалены legacy TypeScript модули (planForm.ts, planHints.ts)
- ✅ Удалены импорты из windowExports.ts

**Результаты:**
- Уменьшение plan.html с 5780 строк до ~2420 строк (58% reduction)
- Уменьшение index.html на ~20KB (удаление 2 дублированных модалок)
- Упрощена поддержка (один модуль вместо двух)
- Консистентное UX на всех страницах
```

**9.3. Создать миграционный guide (опционально)**

Файл: `docs/migrations/v11-modal-cleanup.md`

Краткое руководство для команды:
- Какой код был удалён
- Какие функции использовать вместо legacy
- Примеры миграции onclick handlers

---

## Verification

### Success Criteria

**Функциональность:**
1. ✅ Главная страница: создание фактов и планов работает через новые модалки v9.0+
2. ✅ Страница планов: создание планов (regular, recurring, reminder) работает
3. ✅ Нет ошибок в консоли браузера
4. ✅ E2E тесты проходят успешно

**Качество кода:**
1. ✅ TypeScript компиляция без ошибок
2. ✅ Нет неиспользуемых импортов (npm run lint)
3. ✅ Размер plan.html уменьшен на ~50KB (58% reduction)
4. ✅ Размер index.html уменьшен на ~20KB

**Документация:**
1. ✅ modal-architecture.md обновлён (раздел Legacy Removal)
2. ✅ modal-plan-reusability-analysis.md обновлён (раздел Результаты очистки)
3. ✅ Миграционный guide создан (опционально)

### Testing Commands

```bash
# Frontend TypeScript compilation
npm run build

# Frontend linting
npm run lint

# E2E tests (all)
npm run test:e2e

# E2E tests (specific)
npm run test:e2e -- tests/e2e/webapp/test_recurring_plans.spec.ts
```

### Rollback Plan

Если после деплоя обнаружены критические проблемы:

**1. Откатить commit:**
```bash
git revert HEAD
git push origin dev/cleanup_legacy_modal_code_20260211
```

**2. Проверить логи сервера:**
```bash
ssh budget-test
cd /opt/budget
docker-compose logs app --tail=100
```

**3. Проверить browser console:**
- Открыть DevTools → Console
- Искать ошибки вида: `modal_plan not found`, `openModalPlan is not a function`

**4. Если проблема в TypeScript компиляции:**
- Проверить `frontend/web/static/js/dashboard.min.js` существует
- Проверить версию файла (hash в URL)

---

## Risk Assessment

**Low Risk:**
- ✅ Удаление мертвого кода (не выполняется, т.к. селекторы не найдены)
- ✅ Удаление дублирования HTML (не используется JavaScript-кодом)

**Medium Risk:**
- ⚠️ Удаление импортов из windowExports.ts (может сломать inline onclick handlers)
- **Mitigation:** Провести grep поиск всех вхождений legacy функций перед удалением

**Known Issues:**
- Если другие страницы (кроме index.html и plan.html) используют legacy селекторы, они сломаются
- **Mitigation:** Проверить все HTML templates на использование `modal_add_plan` перед удалением

---

## Estimated Impact

**Positive:**
- ✅ Уменьшение размера HTML файлов на ~70KB (plan.html ~50KB + index.html ~20KB)
- ✅ Упрощена поддержка (один модуль вместо двух)
- ✅ Консистентное UX на всех страницах
- ✅ Уменьшение путаницы для разработчиков

**Neutral:**
- Нет изменений в производительности runtime (мертвый код не выполнялся)
- Нет изменений в API

**Potential Issues:**
- Если в проекте есть другие страницы, использующие legacy модалки, они сломаются
- Если есть inline onclick handlers, вызывающие legacy функции, они перестанут работать

---

## Notes

**Почему не удалять recurringSettings.ts:**
- Используется legacy модалками на других страницах (если они есть)
- Используется для миграционного периода
- Будет удалён после полной миграции всех страниц на v9.0+

**Почему сохранять togglePlanMode роутинг:**
- Функция может вызываться из inline JavaScript на других страницах
- Роутинг гарантирует совместимость: `modal_plan` → новая реализация, остальные → старая

**Как убедиться, что код мертвый:**
- Проверка: селектор `#form_modal_add_plan` не существует в HTML
- Проверка: `querySelector()` возвращает `null`
- Проверка: event listeners НЕ устанавливаются (т.к. элемент не найден)
- Проверка: FAB кнопка вызывает `window.openModalPlan()` (новый код)

---

## Related Documents

- `docs/explore/modal-plan-reusability-analysis.md` - Оригинальное исследование
- `docs/architecture/frontend/modal-architecture.md` - Архитектура модальных окон
- `docs/architecture/frontend/responsive-design.md` - Responsive design guidelines
