---
wiki_sources:
  - "docs/architecture/frontend/javascript-patterns.yaml"
  - "docs/architecture/overview.yaml"
  - "CLAUDE.md"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links:
  - "[[build-system]]"
tags:
  - family-budget
  - architecture
  - frontend
  - patterns
aliases:
  - "windowExports"
  - "window exports"
  - "публичные функции"
---

# Window Exports Pattern

Паттерн экспорта публичных функций через `window.*` для использования в HTML `onclick`-атрибутах и между несколькими TypeScript-бандлами.

## Основные характеристики

**Проблема:** Vite собирает TypeScript в IIFE-бандлы. Функции внутри бандла недоступны извне (из HTML `onclick="func()"` или из другого бандла).

**Решение:** Централизованный файл `adapters/windowExports.ts` экспортирует нужные функции через `window.functionName = ...`.

## Структура

Для каждого модуля:
```
frontend/web/static/js/{module}/adapters/windowExports.ts
```

**Пример (facts):**
```typescript
// frontend/web/static/js/facts/adapters/windowExports.ts
import { deleteFact, editFact, submitFact } from '../operations/factsController';

window.deleteFact = deleteFact;
window.editFact = editFact;
window.submitFact = submitFact;
```

**Использование в HTML:**
```html
<button onclick="deleteFact({{ fact.id }})">Delete</button>
```

## Когда применять

- Функции, вызываемые из HTML `onclick`/`onchange` атрибутов
- Функции, вызываемые из другого Rollup-бандла (кросс-бандловые вызовы)
- Функции, которые должны быть доступны из browser console для отладки

## Запрещено

- Inline JS в HTML-шаблонах (кроме вызовов `window.func()`)
- Прямой импорт между бандлами (каждый бандл — singleton, два импорта = два экземпляра)

## Singleton проблема

Два бандла, импортирующих одну и ту же библиотеку — два разных singleton. Решение: экспортировать через `window.*` из первого бандла, обращаться через `window.lib` из второго.

```typescript
// dexie.min.js
window.Dexie = DexieConstructor;

// facts.min.js (через Vite external)
import Dexie from 'dexie'; // → resolves to window.Dexie
```

## Эталонные реализации

- `frontend/web/static/js/facts/adapters/windowExports.ts` — reference
- `frontend/web/static/js/plan/adapters/windowExports.ts`
- `frontend/web/static/js/dashboard/adapters/windowExports.ts`
- `frontend/web/static/js/transfers/adapters/windowExports.ts`
