# Frontend

The Family Budget frontend is a Progressive Web App built on server-rendered Jinja2 templates enhanced with HTMX, styled with Tailwind CSS + DaisyUI, and scripted with TypeScript compiled into IIFE bundles by Vite. There is no SPA framework: pages are HTML delivered by FastAPI ([[api]], [[architecture]]), and JavaScript adds interactivity, real-time sync, offline detection, and PWA behavior. This page documents the frontend layout, build system, and the conventions that hold it together.

## Three Frontend Roots

`frontend/` splits into three independent roots that share TypeScript but ship to different surfaces. `web/` is the main PWA (nginx serves `/static/` from `web/static/`); `shared/` holds cross-cutting TS bundled into `web/static/js/`; `webapp/` holds Telegram Mini App pages.

- `frontend/web/` — main Progressive Web App. `templates/` (Jinja2 + HTMX), `static/css/` (CSS sources + `.min.css`), `static/js/` (bundle output + per-module TS).
- `frontend/shared/` — shared TypeScript. `network/` is the network-detection module; `static/js/` holds shared bundles (`budgetShared`, `dateFormatter`, `calendar-widget`, `reminders`, Choices tree helpers).
- `frontend/webapp/` — Telegram Web App pages (`add.html`, `edit.html`, `list.html`, `today.html`, `summary.html`, `stats.html`, `addplan.html`, `index.html`) with their own `static/css` and `static/js`.
- `frontend/tests/` — Vitest unit + integration tests (separate from backend `tests/`).

## Jinja2 + HTMX Templates

`frontend/web/templates/` holds server-rendered Jinja2 templates. `base.html` is the shared shell (head, navbar, FAB toolbar, footer, script loading); feature pages `{% extends "base.html" %}` and fill `{% block content %}`. Interactivity comes from HTMX attributes, not client routing.

- Pages: `index.html`, `analytics.html`, `lists.html`, `plan.html`, `facts.html`, `notifications.html`, the `admin_*.html` set, the `medicines_*.html` set (see [[medicine]]), and auth pages (`login_email.html`, `register.html`, `2fa_*.html`, `telegram_login.html` — see [[auth]]).
- `partials/` — HTMX swap fragments (`quick_stats.html`, `account_balances.html`, `recent_transactions.html`, `navbar_center_menu.html`, plus `facts/`, `lists/`, `plan/` subfolders).
- `components/` — reusable macros and dialogs (`fab_toolbar.html`, `modal_*.html`, `user_dropdown_menu.html`, `cookie_consent_banner.html`, `push_permission_banner.html`, `sw_update_modal.html`, `macros/`).
- `scripts/` — inline script includes (`service-worker-registration.html`, `pwa-splash-screen.html`, `toast-manager.html`, `push-bell-manager.html`).
- HTMX pattern: fragments load via `hx-get` against API HTML endpoints, e.g. `index.html` uses `hx-get="/api/v1/analytics/quick-stats-html" hx-trigger="load" hx-swap="innerHTML"` to lazy-fill cards. HTMX itself is vendored at `/static/js/vendor/htmx.min.js`.

## Vite IIFE Bundles

JavaScript is built by `build-all.js`, which runs `vite build` once per entry point against `config/vite.config.single.ts`. Vite cannot emit multiple IIFE bundles in one config, so the script loops over ~41 entries, each producing a single global (`window.<GlobalName>`). Builds are incremental: MD5 hashes of inputs are cached in `.build-cache/` (gitignored) and unchanged bundles are skipped.

- Each entry declares `input`, `output`, and `globalName` (e.g. `network` → `window.NetworkModule`, `bundle` → `window.BudgetApp`, `webapp` → `window.WebApp`, `medicines` → `window.MedicinesApp`).
- The `network` bundle is built first (zero dependencies) and emitted to `web/static/js/` because nginx serves `/static/` from there.
- Application bundles: `bundle`, `components`, `lists`, `transfers`, `plan`, `medicines`, `facts`, `dashboard`, `pushManager`, plus the `sw` service-worker bundle (built from root `sw.js`).
- Vendor libraries are pre-built under `frontend/web/static/js/vendor/` (`htmx`, `choices`, `echarts`, `jsqr`, `qr-creator`), not run through the IIFE loop.
- `FORCE_REBUILD=true` disables incremental skipping; `CACHE_VERSION` / `NODE_ENV=production` control minification.

## Window Exports Pattern

Public functions invoked from inline HTML (`onclick`, HTMX hooks) or from other bundles are not inline JS — they are attached to `window` through a dedicated adapter so the IIFE bundle exposes a stable global surface. The canonical example is `frontend/shared/network/adapters/windowExports.ts`.

- `frontend/shared/network/index.ts` wraps everything in an IIFE and assigns `window.SmartNetworkDetector` (a backward-compatible class) and `window.NetworkModule` (a namespace of functions: `init`, `checkConnectivity`, `enableAutoOfflineMode`, `getDetailedStatus`, etc.).
- `windowExports.ts` defines the `SmartNetworkDetector` class that delegates to the modular `core/`, `features/`, and `utils/` functions, preserving the pre-refactor API surface.
- Templates rely on these globals: `base.html` calls `window.budgetWSClient.showDiagnostics()`, `window.budgetPushManager.requestPermission()`, and toggles `html.offline-mode` from `offline-status-change` events dispatched by the network module.

## Network Layer & API Client

`frontend/shared/network/` is a modular, zero-dependency TypeScript network-detection layer split into `core/` (`NetworkState`, `lifecycle`, `detectionEngine`), `features/` (`heartbeat`, `connectionQuality`, `errorTracking`, `autoOffline`), and `utils/`. It tracks online/offline/degraded status, drives auto-offline mode, and persists state to `localStorage`. The HTTP API client is separate and lives per-surface.

- Network module API: `getStatus()` → `'online' | 'offline' | 'degraded'`, `isFullyOnline()`, `getDetailedStatus()`, plus auto-offline controls. Status changes dispatch the `offline-status-change` event consumed in `base.html`.
- Telegram webapp API client: `frontend/webapp/static/js/api.js` defines `APIClient`, constructed with an `Auth` instance, calling `${origin}/api/v1<endpoint>` with a `Bearer` JWT header. See [[api]] for the backend contract and [[auth]] for token issuance.
- Main PWA data flows mostly through HTMX requests to `/api/v1/*` HTML endpoints plus `fetch()` calls in templates (logout, consent at `/api/v1/consent`).

## WebSocket Client

Real-time budget sync runs through `frontend/web/static/js/budget/budgetWSClient.js`, bundled as `budgetWSClient.min.js` and loaded in `base.html` only for authenticated users. It defines a `BudgetWSClient` class exposing `window.budgetWSClient`. The backend pub/sub side is documented in [[realtime]].

- WebSocket is the primary transport with a Long-Polling fallback (~10s), automatic reconnect with exponential backoff (1s → 30s, max 10 attempts), and client ping/pong health checks.
- Multi-tab coordination uses Web Locks + `BroadcastChannel`; `incrementalUpdates.min.js` applies received deltas to the DOM.
- The navbar `#budget-sse-status-indicator` badge reflects connection state; clicking `#budget-sse-status-wrapper` (debounced 300ms) opens the `#ws-diagnostics-modal` via `showDiagnostics()`.

## Telegram Web Apps

`frontend/webapp/` contains standalone Telegram Mini App pages, each a self-contained HTML file loading the Telegram Web App SDK (`https://telegram.org/js/telegram-web-app.js`) and webapp-specific CSS/JS. These are opened from the Telegram bot ([[bot]]) and authenticate via the bot/JWT flow ([[auth]]).

- Pages: `add.html`, `addplan.html`, `edit.html`, `list.html`, `today.html`, `summary.html`, `stats.html`, `index.html`.
- Styling uses Telegram theme variables (`--tg-theme-bg-color`, `--tg-theme-button-color`, etc.) plus `webapp/static/css/telegram-theme.min.css` and shared component CSS.
- JS is mid-migration to TypeScript: `storage.ts` (`TelegramStorage`, a CloudStorage wrapper) is migrated; `auth.js`, `api.js`, `ui.js`, `validators.js`, `theme.js`, `app.js` remain legacy. The `webapp` IIFE bundle entry is `frontend/webapp/static/js/index.ts` → `window.WebApp`.

## CSS & Tailwind

Styling is Tailwind CSS 3.4 + DaisyUI 4.12, configured in `config/tailwind.config.js`. The Tailwind input (`tailwind.input.css`) is compiled to `tailwind-daisyui.css`, then every CSS source is minified to `.min.css` via PostCSS + cssnano. `.min.css` files are gitignored — generated at build time, never committed.

- `content` globs scan `web/templates`, `web/static/js`, `webapp/**`, and `shared/**` for class usage; a `safelist` keeps `fb-*` utility classes (loading states, icon helpers from `daisyui-overrides.css`) in the build despite dynamic JS usage.
- Two DaisyUI themes: a custom `light` (brand `primary` `#4CAF50`) and stock `dark`; theme persists to `localStorage` (`theme`) and is applied via `data-theme` in `base.html`.
- CSS sources include `custom.css`, `daisyui-overrides.css` (centralized DaisyUI fixes), `z-index-variables.css`, `lists.css`, `plan.css`, `calendar-widget.css`, `choices-tailwind.css`. Load order in `base.html`: DaisyUI → overrides → z-index → custom.
- `npm run build:css` chains `build:tailwind` and the `minify:*` PostCSS scripts.

## Cache Busting

Static assets are referenced with a `?v=PLACEHOLDER` query string in templates (e.g. `tailwind-daisyui.min.css?v=PLACEHOLDER`, `network.min.js?v=PLACEHOLDER`). CI rewrites `PLACEHOLDER` to the real release version so browsers re-fetch changed assets. New templates carrying `?v=PLACEHOLDER` scripts must be registered with the cache-busting CI step or the deploy is blocked.

- The pattern applies uniformly to CSS `<link>`, JS `<script>`, and `webapp/` assets.
- App version is also surfaced to JS via `<meta name="app-version" content="{{ config.VERSION }}">` and feature flags via `window.FEATURE_FLAGS`.
- Service worker (`sw.js` → `sw.min.js`) handles PWA caching and aggressive auto-update; the `#update-available-btn` ("new") prompts users to reload into a new version.

## Build & Test

The full frontend build is `npm run build` = `type-check` + `build:prod`, where `build:prod` = `build:css` + `build:vendor` + `bundle`. Type checking is `tsc --noEmit -p config/tsconfig.json` (strict mode, path aliases `@web`/`@webapp`/`@shared`/`@components`). Bundling is `node build-all.js`. Deploy delivers the built artifacts via CI/CD ([[architecture]]).

- Key npm scripts: `npm run type-check`, `npm run build:css`, `npm run build:vendor`, `npm run bundle`, `npm run build`, `npm run lint` (ESLint).
- Unit/integration tests: `npm run test:coverage` (Vitest, `happy-dom` env, MSW mocks, config in `config/vitest.config.ts`); test sources in `frontend/tests/`.
- End-to-end tests: Playwright via `npm run test:e2e:*` (`chromium`, `full` across chromium/firefox/webkit/mobile), config in `config/playwright.config.ts`; specs live in `tests/e2e/`.
- A pre-commit hook blocks `console.log` in `.ts` files (use `debugLog()`) and runs type-check; skip WIP with `SKIP_TESTS=1`.
