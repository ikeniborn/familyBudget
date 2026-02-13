# Migration Guide: v11.x Modal Cleanup

**Дата:** 2026-02-11
**Версия:** v11.x
**Затронутые модули:** Frontend (modals, TypeScript)

## Обзор изменений

В v11.x выполнена полная очистка legacy кода модальных окон:
- Удалено **~3766 строк** мертвого кода
- Удалены дублированные модалки из HTML templates
- Удалены legacy TypeScript модули (`planForm.ts`, `planHints.ts`)
- Очищены импорты и экспорты в `windowExports.ts`

## Breaking Changes

### 1. Удалены Modal IDs

**❌ Больше НЕ существуют:**
```html
<!-- Legacy modals (удалены) -->
<dialog id="modal_add_transaction">...</dialog>
<dialog id="modal_add_plan">...</dialog>
```

**✅ Используйте:**
```html
<!-- v9.0+ tabbed modals -->
<dialog id="modal_fact">...</dialog>
<dialog id="modal_plan">...</dialog>
```

### 2. Удалены Form IDs

**❌ Больше НЕ существуют:**
```javascript
const form = document.querySelector('#form_modal_add_transaction');
const form = document.querySelector('#form_modal_add_plan');
```

**✅ Используйте:**
```javascript
const form = document.querySelector('#form_modal_fact');
const form = document.querySelector('#form_modal_plan');
```

### 3. Удалены TypeScript функции

**❌ Больше НЕ экспортируются:**
```typescript
// window exports (удалены)
window.Dashboard.loadPlanCategories();
window.Dashboard.savePlan(button);
window.Dashboard.savePlanOffline(button);
window.Dashboard.loadPlanHints(category);
```

**✅ Используйте новые API:**
```typescript
// Открытие модалки (автоматическая загрузка данных)
window.openModalPlan();

// Сохранение (через button onclick)
window.savePlanModal(button);

// Загрузка hints (автоматически при выборе категории)
// Реализовано в modalPlan/index.ts через categoryTree listeners
```

### 4. Удалены TypeScript модули

**❌ Файлы удалены:**
```typescript
// Импорты больше НЕ работают
import { loadPlanCategories } from './features/addPlan/planForm';
import { loadPlanHints } from './features/addPlan/planHints';
```

**✅ Используйте новые модули:**
```typescript
// Новая модульная архитектура
import { openModalPlan } from './features/modalPlan';
import { savePlanModal } from './features/modalPlan/saveOperations';
```

## Non-Breaking Changes

### Сохранены (работают как раньше)

**✅ Функции reminder/recurring:**
```typescript
// Эти функции ВСЕ ЕЩЕ работают
window.togglePlanMode(modalId);
window.toggleReminderSettings(modalId);
window.initRecurringFields(modalId);
window.resetRecurringOnlyFields(modalId);
```

**✅ Period buttons:**
```typescript
// Функции для выбора периода работают
import { setupPlanPeriodButtons } from './features/addPlan/periodButtons';
```

**✅ Window entry points:**
```typescript
// Основные точки входа работают
window.openModalFact();
window.openModalPlan();
window.closeModalFact();
window.closeModalPlan();
```

## Migration Path

### Если у вас есть custom code

#### Сценарий 1: Inline onclick handlers

**❌ Было:**
```html
<button onclick="window.Dashboard.loadPlanCategories()">Reload</button>
```

**✅ Стало:**
```html
<!-- Функция больше не нужна, модалка загружает данные автоматически -->
<button onclick="window.openModalPlan()">Open Modal</button>
```

#### Сценарий 2: JavaScript код

**❌ Было:**
```javascript
// Загрузка категорий
if (window.Dashboard?.loadPlanCategories) {
  window.Dashboard.loadPlanCategories();
}

// Сохранение плана
const button = document.querySelector('.save-plan-btn');
window.Dashboard.savePlan(button);
```

**✅ Стало:**
```javascript
// Открытие модалки (данные загружаются автоматически)
window.openModalPlan();

// Сохранение плана через новый API
const button = document.querySelector('.save-plan-btn');
window.savePlanModal(button);
```

#### Сценарий 3: TypeScript импорты

**❌ Было:**
```typescript
import { loadPlanCategories, savePlan } from './features/addPlan';

// Использование
await loadPlanCategories();
savePlan(button);
```

**✅ Стало:**
```typescript
import { openModalPlan, savePlanModal } from './features/modalPlan';

// Использование (данные загружаются автоматически при открытии)
await openModalPlan();
savePlanModal(button);
```

#### Сценарий 4: Селекторы форм

**❌ Было:**
```typescript
const form = document.querySelector('#form_modal_add_plan') as HTMLFormElement;
const fcSelect = form.querySelector('select[name="financial_center_id"]');
```

**✅ Стало:**
```typescript
// Используйте табовые селекторы
const form = document.querySelector('#form_modal_plan') as HTMLFormElement;
const fcSelect = document.querySelector(
  '#modal_plan-tab-transaction select[name="financial_center_id"]'
);
```

## Проверка совместимости

### Автоматическая проверка

```bash
# Поиск использования legacy селекторов
grep -r "modal_add_plan\|modal_add_transaction" frontend/web/

# Поиск использования legacy функций
grep -r "loadPlanCategories\|savePlan\|loadPlanHints" frontend/web/static/js/

# TypeScript компиляция
npm run type-check
```

### Manual checklist

- [ ] Проверить custom inline JavaScript в templates
- [ ] Проверить custom TypeScript модули на использование legacy импортов
- [ ] Проверить onclick handlers на использование `window.Dashboard.loadPlanCategories()` и подобных
- [ ] Запустить E2E тесты
- [ ] Проверить создание фактов и планов в браузере

## Rollback Plan

Если после апгрейда на v11.x обнаружены проблемы:

### Вариант 1: Git revert (рекомендуется)

```bash
# Откатить коммит с очисткой legacy кода
git revert 1ae39eee

# Или откатить на предыдущую версию
git checkout v10.x
```

### Вариант 2: Временный hotfix

Если нужен срочный hotfix, можно временно вернуть legacy функции:

```typescript
// windowExports.ts - временный hotfix (НЕ для продакшена)
function loadPlanCategories() {
  console.warn('[DEPRECATED] loadPlanCategories is deprecated. Use openModalPlan() instead.');
  // Fallback на новую реализацию
  return openModalPlan();
}

window.Dashboard.loadPlanCategories = loadPlanCategories;
```

## FAQ

### Q: Можно ли использовать старые модалки?

**A:** Нет, legacy модалки (`modal_add_transaction`, `modal_add_plan`) полностью удалены из HTML templates в v11.x. Используйте новые модалки v9.0+ (`modal_fact`, `modal_plan`).

### Q: Как открыть модалку плана из custom кода?

**A:** Используйте глобальную функцию:
```javascript
window.openModalPlan();
```

Данные загружаются автоматически при открытии модалки с skeleton loader.

### Q: Где теперь находится логика сохранения плана?

**A:** В модульной архитектуре v9.0+:
- `features/modalPlan/saveOperations.ts` - роутер для transaction/transfer
- `features/modalPlan/saveTransaction.ts` - логика сохранения transaction
- `features/modalPlan/saveTransfer.ts` - lazy loading для transfer

### Q: Сломались ли recurring планы?

**A:** Нет, recurring функционал работает как раньше:
- Функции из `recurringSettings.ts` сохранены
- Экспорты в `window` работают
- Inline JavaScript на других страницах не затронут

### Q: Нужно ли обновлять Telegram bot?

**A:** Нет, бот не затронут. Изменения только в frontend модалках.

## Полезные ссылки

- **План очистки:** `docs/plans/cleanup-legacy-modal-code.md`
- **Результаты:** `docs/explore/modal-plan-reusability-analysis.md` (раздел "Результаты очистки кода")
- **Архитектура модалок:** `docs/architecture/frontend/modal-architecture.md`
- **Коммит:** 1ae39eee "refactor: remove legacy modal code and duplication"

## Changelog

### v11.x (2026-02-11)

**Removed:**
- Legacy modal IDs: `modal_add_transaction`, `modal_add_plan`
- Legacy form IDs: `form_modal_add_transaction`, `form_modal_add_plan`
- TypeScript modules: `planForm.ts`, `planHints.ts`
- Functions: `loadPlanCategories`, `savePlan`, `savePlanOffline`, `loadPlanHints`
- ~3766 lines of dead code

**Preserved:**
- v9.0+ tabbed modals: `modal_fact`, `modal_plan`
- Entry points: `window.openModalPlan()`, `window.openModalFact()`
- Reminder/recurring functions
- Period buttons functionality

**Impact:**
- plan.html: 5780 → 2364 lines (58% reduction)
- index.html: ~20KB saved
- facts.html: ~10KB saved
- Total: ~80KB dead code removed
