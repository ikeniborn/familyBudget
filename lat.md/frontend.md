# Frontend

Progressive Web App built with HTMX + Tailwind CSS + DaisyUI. TypeScript compiled via Rollup into bundles. Real-time sync via WebSocket + Redis Pub/Sub.

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

## Real-Time Sync

WebSocket client (`budgetWSClient.js`) handles all real-time events. Multi-tab sync via Redis Pub/Sub — events from any tab/device propagate to all open sessions instantly. No local IndexedDB — all data fetched from REST API. See [[realtime#WebSocket Protocol]].

## CSS

Tailwind CSS + DaisyUI component library. Source → minified via PostCSS + cssnano (`npm run build:css`). `.min.css` not committed. Config: `config/tailwind.config.js`.

## Responsive Breakpoints

All features must work at 375px (mobile), 768px (tablet), 1280px (desktop) before marking as done. PWA manifest enables install on iOS/Android. Browser targets: Chrome, Safari 14+, Yandex Browser.

## Plan Page Analytics Sync

Bidirectional filter↔analytics sync on the plan page. Module: `frontend/web/static/js/plan/filterAnalyticsSync.ts`.

**Filters → Analytics** (`syncFiltersToAnalytics`): propagates date range, article type, article, financial center from the filter section to the analytics section, then reloads charts.

**Analytics → Filters** (`syncAnalyticsToFilters`): propagates analytics UI state back to the filter section, then reloads the facts table.

**Mutex**: `isSyncInProgress` flag prevents cascading loops. **Debounce**: `debouncedSyncFiltersToAnalytics` delays 300ms.

**`SyncOptions.skipFiltersSync`**: when `true`, `syncAnalyticsToFilters` only updates the date range — article type, article, and financial center are NOT carried over. Used by `selectAnalyticsMonth` so switching a month doesn't silently apply analytics filters to the facts table. Without this guard, selecting June 2026 would propagate e.g. `article_id=484` and reduce visible plan records.

## Admin UI

Admin pages (`templates/admin_*.html`) use same HTMX + DaisyUI stack. Separate JS bundles per admin section.
