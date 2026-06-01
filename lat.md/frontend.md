# Frontend

Progressive Web App built with HTMX + Tailwind CSS + DaisyUI. TypeScript compiled via Rollup into bundles. Supports offline via Dexie.js IndexedDB.

## Architecture

Jinja2 templates (`frontend/web/templates/`) serve initial HTML. HTMX handles partial updates — no full-page reloads. Complex UI logic lives in TypeScript bundles (`frontend/web/static/js/`).

Each page module: `adapters/windowExports.ts` exports public functions to `window.*` for `onclick` handlers. Never use inline JS in templates. Reference pattern: `frontend/web/static/js/facts/adapters/windowExports.ts`.

## Build System

`npm run build` runs: type-check → CSS minification → Rollup bundles → verify. Bundles committed to `.gitignore` — generated at deploy time. Version substitution: `?v=PLACEHOLDER` in templates, replaced by CI with actual version for cache busting.

Key commands: `npm run type-check`, `npm run bundle`, `npm run build:css`. Pre-commit hook checks for `console.log` in `.ts` files (use `debugLog()` instead).

## Rollup Bundles

Each page has its own bundle entry. Two bundles = two separate singletons — never import from one bundle into another. Cross-bundle calls must go through `window.*` exports to avoid duplicate singleton instances.

Bundle configs: `config/` directory. Output: `frontend/web/static/js/**/*.min.js`.

## HTMX Patterns

Server returns HTML fragments to HTMX `hx-target`. Partial endpoints in `backend/app/api/v1/endpoints/facts_partials.py`. WebSocket events trigger `htmx.trigger()` to refresh specific components. See [[realtime#WebSocket Protocol]].

## Dexie Offline Sync

IndexedDB via Dexie.js 4.0+ for offline-first operations. Shopping lists and facts can be created offline; sync runs on reconnect via [[api#Key Endpoint Groups#Sync]].

Schema defined in TypeScript `frontend/web/static/js/data/`. Delete sync uses soft-delete flags, not physical removal, to avoid sync conflicts. Edit persistence requires re-fetching from IndexedDB after save — not from DOM.

Shopping list item upload (`shoppingSync.ts`): if PUT returns 404 (item deleted server-side), the sync falls back to POST to recreate it. This preserves offline edits that would otherwise be silently lost.

## CSS

Tailwind CSS + DaisyUI component library. Source → minified via PostCSS + cssnano (`npm run build:css`). `.min.css` not committed. Config: `config/tailwind.config.js`.

## Responsive Breakpoints

All features must work at 375px (mobile), 768px (tablet), 1280px (desktop) before marking as done. PWA manifest enables install on iOS/Android. Browser targets: Chrome, Safari 14+, Yandex Browser.

## Admin UI

Admin pages (`templates/admin_*.html`) use same HTMX + DaisyUI stack. Separate JS bundles per admin section.
