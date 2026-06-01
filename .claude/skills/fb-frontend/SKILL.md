---
name: fb-frontend
description: >
  Frontend development guide for the Family Budget project. Use this skill whenever you're writing, editing, or debugging
  TypeScript/JavaScript frontend code, Jinja2 templates, or CSS in this project — adding new features, implementing UI components,
  fixing bugs in existing pages (facts, plan, dashboard, lists), or wiring up API calls and WebSocket handlers.
  Trigger on: "add button", "create modal", "implement filter", "fix table", "new page", "update template", "CSS issue",
  "TypeScript error", "bundle", "window.X is not a function", "onclick not working".
version: 2.0.0
author: Family Budget Team
tags:
  - frontend
  - typescript
  - tailwind
  - daisyui
user-invocable: true
---

# Family Budget — Frontend Development

## Stack

| Layer | Technology |
|-------|-----------|
| Bundler | Vite 6 → 41 separate IIFE bundles |
| Language | TypeScript (strict, ES2020) |
| CSS | Tailwind CSS 3 + DaisyUI 4 |
| Templates | Jinja2 (server-side) |
| DB (offline) | Dexie 4 (IndexedDB) |
| Real-time | WebSocket via `window.budgetWSClient` |

## Build Commands

```bash
npm run type-check          # TypeScript validation (pre-commit runs this)
npm run bundle              # Rebuild all JS bundles
npm run build:css           # Tailwind → .min.css
npm run build               # type-check + CSS + bundles + verify
FORCE_REBUILD=true npm run bundle  # bypass hash cache when editing imported modules
```

## File Map

```
frontend/web/
├── static/
│   ├── css/
│   │   ├── tailwind-daisyui.min.css   ← generated, don't edit
│   │   ├── daisyui-overrides.css      ← conflict fixes + fb-* classes
│   │   ├── custom.css                 ← feature-specific styles
│   │   └── [feature].css             ← per-feature (plan.css, lists.css)
│   └── js/
│       ├── [feature]/                ← feature bundle (facts/, plan/, etc.)
│       ├── modules/uiComponents/     ← reusable UI helpers
│       ├── utils/                    ← shared utilities
│       └── data/                    ← API + Dexie data layer
└── templates/
    ├── base.html                     ← master layout (extend this)
    ├── [page].html                   ← page templates
    ├── components/                   ← Jinja2 macros (modals, forms)
    └── partials/[feature]/           ← feature-specific fragments
```

## Feature Folder Structure

Every page feature follows this layout. `facts/` is the canonical reference:

```
js/[feature]/
├── index.ts                 ← entry point, init order matters (see references/patterns.md)
├── core/
│   ├── [Feature]State.ts   ← state interface + createInitialState()
│   └── stateManager.ts     ← getState() / updateState()
├── operations/             ← business logic, table rendering, CRUD
├── integration/
│   ├── [feature]API.ts     ← fetch() calls to /api/v1/...
│   └── wsEventHandlers.ts  ← WebSocket subscriptions
├── adapters/
│   ├── windowExports.ts    ← ALL onclick-callable functions go here
│   └── eventDelegation.ts  ← data-action routing
├── features/               ← complex sub-components (modals, widgets)
└── types/
    ├── models.ts
    └── globals.d.ts        ← window.* type declarations
```

## Key Rules (read these first)

1. **No `console.log`** — use `debugLog()` from `utils/logger.ts` (pre-commit blocks it)
2. **All onclick functions** must go through `adapters/windowExports.ts` — never inline on window
3. **IIFE bundles can't share module state** — cross-bundle calls go through `window.*`
4. **`FORCE_REBUILD=true`** needed when editing imported (non-entry) modules — hash cache won't detect transitive changes
5. CSS load order is fixed: tailwind-daisyui → daisyui-overrides → custom → feature CSS

## Reference Files

Load only what you need:

| Task | Read |
|------|------|
| Implementing onclick handlers / window exports | `references/patterns.md#window-exports` |
| Setting up state management | `references/patterns.md#state` |
| Adding WebSocket handlers | `references/patterns.md#websocket` |
| Writing API calls | `references/patterns.md#api` |
| Adding a new page or feature bundle | `references/new-feature.md` |
| Writing or editing Jinja2 templates / modals | `references/templates.md` |
| CSS — DaisyUI, custom classes, responsive | `references/css.md` |
| Writing unit or E2E tests | `references/testing.md` |
