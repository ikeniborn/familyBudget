---
name: Frontend Development
description: Автоматизация создания frontend компонентов (HTMX + Tailwind + DaisyUI + WebSocket)
version: 3.0.0
author: Family Budget Team
tags: [frontend, htmx, tailwind, daisyui, websocket, jinja2]
dependencies: [api-development, websocket-realtime]
architecture_refs:
  - $ref: ../../docs/architecture/web/templates.yaml
  - $ref: ../../docs/architecture/web/htmx-triggers.yaml
  - $ref: ../../docs/architecture/web/js-modules.yaml
  - $ref: ../../docs/architecture/frontend/modal-performance.yaml
user-invocable: false
---

# Frontend Development Skill

Автоматизация создания frontend компонентов с HTMX, Tailwind CSS, DaisyUI и WebSocket интеграцией.

## When to Use

- Создать новый modal dialog
- Добавить HTMX trigger для API endpoint
- Создать новый JavaScript модуль
- Интегрировать WebSocket события
- Добавить Tailwind/DaisyUI компонент

## Architecture Context

**References:**
- Templates: [$ref](../../docs/architecture/web/templates.yaml)
- HTMX Triggers: [$ref](../../docs/architecture/web/htmx-triggers.yaml)
- JS Modules: [$ref](../../docs/architecture/web/js-modules.yaml)
- Performance: [$ref](../../docs/architecture/frontend/modal-performance.yaml)

**Key Patterns:**
- **HTMX partial rendering** - NO full page reload
- **Tailwind utility-first CSS** - NO custom CSS
- **DaisyUI components** - Pre-built UI components
- **WebSocket real-time updates** - Live data sync
- **Offline-first** - IndexedDB for offline support

## TypeScript Development Patterns

**Hybrid Approach (v7.1.0+):**
- **Development**: .ts files for type-checking and IDE support
- **Production**: .js files for minification (backward compatible)
- **Build**: Vite compiles .ts → .js automatically

**Type Checking Commands:**
```bash
# Validate TypeScript (0 errors required)
npm run type-check

# Watch mode (auto-check on file changes)
npm run type-check:watch
```

**Pre-commit Hook:**
- Automatic type-check before every commit
- Blocks commit if TypeScript errors found
- Fix errors → retry commit

**Type Definition Files (types/):**
- `api.d.ts` - API responses, network types (170 lines)
- `models.d.ts` - Domain models (User, BudgetFact, Article) (219 lines)
- `global.d.ts` - Window namespace extensions (144 lines)
- `indexeddb.d.ts` - IndexedDB schema (167 lines)
- `navigator.d.ts` - Browser APIs (Network Information) (165 lines)
- `telegram.d.ts` - Telegram WebApp types (246 lines)

**Common TypeScript Patterns:**
```typescript
// Type-safe API response
interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

// Type-only imports
import type { BudgetFact, Article } from '@shared/types';

// Generic function with constraints
function createItem<T extends { id: number }>(item: T): T {
    return item;
}
```

**Migration Status (v7.1.0):**
- 14 modules migrated (~16,000 lines)
- 473 non-critical errors (acceptable for gradual migration)
- 0 errors in critical modules (offlineManager.ts)

**Window Exports Pattern (for onclick handlers):**

ES Modules не экспортируют функции в глобальную область видимости автоматически. Для использования в inline onclick handlers требуется явный export в `window` объект.

**Quick Reference:**
```typescript
// 1. Export to window
(window as any).openModal = openModal;

// 2. Use in HTML with window. prefix
<button onclick="window.openModal()">Open</button>
```

**Best Practice:**
- ✅ ALWAYS use `window.` prefix в HTML onclick handlers
- ✅ Export функций через dedicated `windowExports.ts` module
- ✅ Prefer addEventListener над inline onclick (когда возможно)

**Resources:**
- **Example**: [window-exports-pattern.md](examples/window-exports-pattern.md) - Полный пример с архитектурой
- **Template**: [windowExports.template.ts](templates/windowExports.template.ts) - Шаблон для новых exports
- **Real Case**: fab_toolbar.html (5 onclick handlers исправлено в v11.1.24)

## Build Commands

**Production Build (v7.0.0+):**
```bash
# Full build (CSS + JS + minify + gzip)
npm run build              # Vite build with TypeScript compilation

# Development mode with HMR
npm run dev                # Vite dev server (instant updates)

# Watch mode (auto-rebuild)
npm run watch              # CSS + JS watch
```

**Type Checking:**
```bash
npm run type-check         # Validate TypeScript (0 errors required)
npm run type-check:watch   # Watch mode
```

**Bundle Analysis:**
```bash
npm run analyze            # Opens bundle-stats.html
```

**Deprecated Commands (v7.0.0+):**
```bash
# ❌ REMOVED - Do not use!
npm run bundle             # Use: npm run build
npm run bundle:dev         # Use: npm run dev
npm run minify:js          # Use: npm run build (automatic)
npm run minify:css         # Use: npm run build (automatic)
```

**Build System:**
- **Vite** (v7.0.0+) - Modern bundler with TypeScript support
- **Previous**: Rollup + bash scripts (removed in v7.0.0)
- **Performance**: 75% faster builds (15-20s → 13-17s)

## Commands

### Command: create-modal

**Usage:**
```
Создай modal dialog для создания/редактирования <ResourceName> с HTMX и WebSocket интеграцией.
```

**What It Does:**
1. Creates Jinja2 template extending base.html
2. Adds HTMX attributes (hx-post, hx-target, hx-swap)
3. Adds DaisyUI modal structure
4. Integrates WebSocket broadcast listener
5. Adds loading states (hx-indicator)

**Template Reference:**
- `templates/htmx-template.html` - Base Jinja2 + HTMX template
- `templates/tailwind-component.html` - Tailwind/DaisyUI modal

**Example:**
- `examples/modal-implementation.md` - Real Article modal

### Command: add-htmx-trigger

**Usage:**
```
Добавь HTMX trigger для endpoint POST /api/v1/<resource> с WebSocket broadcast.
```

**What It Does:**
1. Add hx-post/hx-get attribute to HTML element
2. Configure hx-target for partial update
3. Add hx-swap strategy (innerHTML/outerHTML/beforeend)
4. Integrate WebSocket listener for real-time updates
5. Add loading states

**Template Reference:**
- `templates/htmx-trigger-example.html`

### Command: add-ws-integration

**Usage:**
```
Интегрируй WebSocket события для <event-name> в frontend.
```

**What It Does:**
1. Add event handler to budgetWSClient.js
2. Update UI elements on event receive
3. Handle offline queue if needed

**Template Reference:**
- `templates/ws-client-integration.js`

## Validation Checklist

- [ ] Template extends base.html
- [ ] HTMX attributes configured (hx-*, hx-target, hx-swap)
- [ ] Tailwind classes used (NO custom CSS)
- [ ] DaisyUI components used correctly
- [ ] WebSocket integration added if needed
- [ ] Responsive design (mobile-first)
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] TypeScript type-check passes (`npm run type-check`)
- [ ] Production build succeeds (`npm run build`)
- [ ] No TypeScript errors in critical modules
- [ ] HTMX trigger registered in htmx-triggers.yaml

## Common Mistakes

**Pre-commit hook fails with TypeScript errors:**
- **Symptom**: Commit blocked with "npm run type-check failed"
- **Fix**: Run `npm run type-check` locally, fix errors, retry commit
- **Reference**: [$ref](../../docs/architecture/typescript-integration.md)

**Editing .js files instead of .ts:**
- **Symptom**: Changes lost after build, type-check doesn't catch errors
- **Fix**: Edit .ts files (source), not .js files (generated output)
- **Note**: Vite compiles .ts → .js automatically

**Using old build commands:**
- **Symptom**: "npm run bundle: command not found"
- **Fix**: Use `npm run build` (v7.0.0+)
- **Reference**: [$ref](../../docs/architecture/build-system.md#migration-notes)

**HTMX trigger without target:**
- **Symptom**: Full page reload instead of partial update
- **Fix**: Add `hx-target="#element-id"`

**Custom CSS instead of Tailwind:**
- **Symptom**: Inconsistent styling, CSS bloat
- **Fix**: Use Tailwind utility classes

**Onclick handlers without window. prefix:**
- **Symptom**: `ReferenceError: <functionName> is not defined` при клике на кнопки
- **Root Cause**: ES Modules не экспортируют функции в global scope
- **Fix**: Добавить `window.` prefix: `onclick="window.openModal()"`
- **Prevention**: Используй dedicated `windowExports.ts` module
- **Details**: См. [window-exports-pattern.md](examples/window-exports-pattern.md)
- **Template**: [windowExports.template.ts](templates/windowExports.template.ts)
- **Real Case**: fab_toolbar.html v11.1.24 (5 handlers исправлено)

## Related Skills

- **api-development**: Create API endpoints first
- **websocket-realtime**: Add real-time updates
- **testing**: Create e2e tests with Playwright

## Quick Links

- Modal Performance Optimization: [$ref](../../docs/architecture/frontend/modal-performance.yaml)
- HTMX Triggers Mapping: [$ref](../../docs/architecture/web/htmx-triggers.yaml)
- JS Modules: [$ref](../../docs/architecture/web/js-modules.yaml)
