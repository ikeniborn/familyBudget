# Build System Migration Plan: Legacy → Full Vite

## Текущая проблема (v7.0.x)

### Hybrid архитектура:
- **Vite bundles**: budgetShared.bundle.js, bundle.js, webapp.bundle.js, components.bundle.js, sw.min.js
- **Legacy files**: budgetShared.min.js, debugLog.min.js, dateFormatter.min.js (через terser напрямую)

### Дублирование:
```
budgetShared.ts (108KB) → budgetShared.bundle.js (91KB) ❌ НЕ ИСПОЛЬЗУЕТСЯ
budgetShared.js (103KB) → budgetShared.min.js (37KB)    ✓ ИСПОЛЬЗУЕТСЯ в base.html
```

### Почему это плохо:
1. Две параллельные системы сборки
2. Дублирование кода (.ts и .js версии)
3. Неиспользуемые bundles собираются зря
4. Сложность в поддержке (scripts/minify-individual-files.sh)
5. Потеря преимуществ Vite для legacy файлов

## Правильное решение: Full Vite Migration

### Фаза 1: Удалить дублирование (v7.1.0)

**Цель**: Оставить только .ts версии, удалить .js дубликаты

```bash
# Удалить дубликаты
rm frontend/shared/static/js/budgetShared.js
rm frontend/shared/static/js/debugLog.js
rm frontend/shared/static/js/dateFormatter.js

# Обновить build-all.js: добавить entry points для individual файлов
const builds = [
  {
    name: 'budgetShared',
    input: 'frontend/shared/static/js/budgetShared.ts',
    output: 'frontend/shared/static/js/budgetShared.min.js',  // ← изменить на .min.js вместо .bundle.js
    globalName: 'BudgetShared'
  },
  {
    name: 'debugLog',
    input: 'frontend/shared/static/js/debugLog.ts',
    output: 'frontend/shared/static/js/debugLog.min.js',
    globalName: 'DebugLog'
  },
  {
    name: 'dateFormatter',
    input: 'frontend/shared/static/js/dateFormatter.ts',
    output: 'frontend/shared/static/js/dateFormatter.min.js',
    globalName: 'DateFormatter'
  },
  // ... остальные bundles
];
```

**Изменения в HTML**: НЕТ (пути остаются те же: `/shared/static/js/budgetShared.min.js`)

**Удалить**: `scripts/minify-individual-files.sh` (больше не нужен)

**Обновить**: `deploy.sh` - убрать вызов minify-individual-files.sh

### Фаза 2: Мигрировать legacy .js на TypeScript (v7.2.0)

**Создать .ts версии для:**
- `calendar-widget.js` → `calendar-widget.ts`
- `choicesCategoryTree.js` → `choicesCategoryTree.ts`
- `choicesProductGroupTree.js` → `choicesProductGroupTree.ts`
- `reminders.js` → `reminders.ts`

**Добавить в build-all.js:**
```javascript
{
  name: 'calendar-widget',
  input: 'frontend/shared/static/js/calendar-widget.ts',
  output: 'frontend/shared/static/js/calendar-widget.min.js',
  globalName: 'CalendarWidget'
},
// ... и т.д.
```

### Фаза 3: Unified bundle (опционально, v8.0.0)

**Альтернатива**: вместо 7 отдельных bundles создать один:

```typescript
// frontend/shared/static/js/index.ts
export { default as DateFormatter } from './dateFormatter';
export { default as DebugLog } from './debugLog';
export { default as CalendarWidget } from './calendar-widget';
export { default as ChoicesCategoryTree } from './choicesCategoryTree';
export { default as ChoicesProductGroupTree } from './choicesProductGroupTree';
export { default as Reminders } from './reminders';

// Expose as window.BudgetShared
window.BudgetShared = {
  DateFormatter,
  DebugLog,
  CalendarWidget,
  // ...
};
```

**HTML изменения**:
```html
<!-- Было: 7 отдельных <script> тегов -->
<script src="/shared/static/js/debugLog.min.js"></script>
<script src="/shared/static/js/budgetShared.min.js"></script>
<script src="/shared/static/js/calendar-widget.min.js"></script>
<!-- ... -->

<!-- Стало: 1 unified bundle -->
<script src="/shared/static/js/shared.bundle.js"></script>
```

**Преимущества unified bundle**:
- Один HTTP request вместо 7
- Лучший tree-shaking
- Shared chunks между модулями
- Проще поддержка

**Недостатки unified bundle**:
- Более крупный файл (но с gzip не критично)
- Все загружается сразу (но для shared модулей это OK)

## Рекомендация

**Для v7.1.0**: Фаза 1 (удалить дублирование, всё через Vite)
- Минимальные изменения
- Сразу убирает дублирование
- Не требует изменений в HTML

**Для v7.2.0**: Фаза 2 (мигрировать legacy на TypeScript)
- Все файлы в TypeScript
- Единая система сборки (только Vite)
- Полная type safety

**Для v8.0.0** (опционально): Фаза 3 (unified bundle)
- Оптимизация performance
- Упрощение HTML
- Требует больше изменений

## Migration Checklist

### Фаза 1 (v7.1.0):
- [ ] Удалить budgetShared.js (оставить .ts)
- [ ] Удалить debugLog.js (оставить .ts)
- [ ] Удалить dateFormatter.js (оставить .ts)
- [ ] Обновить build-all.js: изменить output на .min.js вместо .bundle.js
- [ ] Удалить scripts/minify-individual-files.sh
- [ ] Обновить deploy.sh: убрать вызов minify-individual-files.sh
- [ ] Тестирование на budget-test
- [ ] Деплой на budget-prod

### Фаза 2 (v7.2.0):
- [ ] Создать calendar-widget.ts
- [ ] Создать choicesCategoryTree.ts
- [ ] Создать choicesProductGroupTree.ts
- [ ] Создать reminders.ts
- [ ] Добавить entry points в build-all.js
- [ ] Удалить .js версии
- [ ] Добавить type definitions
- [ ] Тестирование
- [ ] Деплой

## Риски и митигация

### Риск: Breaking changes в HTML
**Митигация**: В Фазе 1 пути НЕ меняются (по-прежнему .min.js)

### Риск: Увеличение bundle size
**Митигация**: Vite лучше минифицирует, чем terser standalone

### Риск: TypeScript errors в legacy коде
**Митигация**: Использовать `@ts-ignore` или `any` временно, исправить постепенно

## Заключение

**Текущее решение** (scripts/minify-individual-files.sh) - это **workaround**, не финальная архитектура.

**Правильный путь**: Все файлы через Vite, никакой ручной минификации.

**Приоритет**: Фаза 1 в v7.1.0 (быстрое исправление архитектуры без breaking changes).
