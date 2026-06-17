# Frontend

The web frontend is a server-rendered HTMX PWA styled with Tailwind/DaisyUI, plus a Telegram Mini App. TypeScript sources across three roots are bundled into 41 IIFE bundles by Vite. See [[architecture]] for the system view.

## Frontend Roots

Three source roots under `frontend/`, each with a distinct role. `shared/` is bundled into `web/static/js` because nginx serves `/static/` from the `web/` tree.

- `frontend/web/` — main PWA. Jinja2 templates (`templates/`), CSS sources (`static/css/`), TS/JS bundle output (`static/js/`).
- `frontend/shared/` — shared TS reused by web/webapp: `network/` (connectivity detection) and `static/js/` (budgetShared, dateFormatter, calendar-widget, choices trees, reminders).
- `frontend/webapp/` — Telegram Web App HTML pages + own `static/`.
- TS path aliases (`@web`, `@webapp`, `@shared`, `@components`) defined in `tsconfig.json:26-31`.

## HTMX + Tailwind/DaisyUI Stack

Pages are server-rendered Jinja2 templates enhanced with HTMX attributes; styling is Tailwind 3.4 + DaisyUI 4.12. No SPA framework. HTMX and Choices are vendored under `static/js/vendor/`.

- `frontend/web/templates/base.html` defines the layout via Jinja2 blocks (`title`, `content`, `extra_scripts`, `fab_buttons`); feature pages `{% extends "base.html" %}` (e.g. `facts.html`, `lists.html`).
- Template parts: `templates/components/` (modals, FAB toolbar, banners), `templates/partials/` (HTMX swap fragments), `templates/scripts/` (SW registration, toast/push managers).
- Vendor HTMX loaded at `base.html:372`; theme colors + DaisyUI themes in `config/tailwind.config.js`.

## Vite IIFE Bundle Pipeline

`build-all.js` runs `npx vite build` once per entry point against `config/vite.config.single.ts`, because Vite cannot emit multiple IIFE bundles in one config. 41 entry points, each producing a global-named IIFE.

- Entry list: `build-all.js:27-241` (network, shared modules, legacy utils/budget/workers, app bundles, service worker). Env vars `VITE_ENTRY_*` / `VITE_GLOBAL_NAME` parametrize each run (`build-all.js:321-331`).
- App bundles include `bundle` (BudgetApp), `webapp`, `lists`, `medicines` ([[medicine#Stock Page (Frontend)]]), `facts`, `dashboard`, `plan`, `transfers`, `pushManager`.
- Incremental builds: MD5-hash of each input cached in `.build-cache/<name>.hash`; unchanged inputs skipped unless `FORCE_REBUILD=true` (`build-all.js:255-302`).
- Invoke via `npm run bundle`.

## CSS Minification Flow

CSS is built in two stages: Tailwind compiles `tailwind.input.css` → `tailwind-daisyui.css`, then PostCSS + cssnano minifies each source `.css` → `.min.css`. Only `.min.css` is referenced in templates; `.min.css`/`.min.js` are gitignored (built artifacts).

- `npm run build:css` chains `build:tailwind` + per-file `minify:*` scripts (`package.json:9-20`).
- Sources in `frontend/web/static/css/*.css`; outputs like `tailwind-daisyui.min.css`, `daisyui-overrides.min.css`, `custom.min.css`, `lists.min.css`, `plan.min.css`.
- `build:vendor` minifies vendor CSS + JS (`package.json:21`).

## Window-Exports Pattern

Public functions used by inline `onclick` handlers in templates are attached to `window` through a per-module `adapters/windowExports.ts`, rather than inline JS. A `setupWindowExports()` runs before HTML with handlers renders.

- Examples: `frontend/web/static/js/facts/adapters/windowExports.ts` (`window.applyFilters`, `window.deleteFact`, …), plus `plan/`, `dashboard/`, `transfers/`, `lists/listsManager/`, `webauthn/WebAuthnManager/`, `budget/budgetWSClient/` adapters.
- `frontend/shared/network/adapters/windowExports.ts` re-exposes the legacy `window.SmartNetworkDetector` class for backward compatibility.
- Window type declarations live in each module's `types/globals.d.ts`.

## PWA: Manifest + Service Worker

A standalone PWA: `manifest.json` (root) declares name, icons, theme `#4CAF50`, and app shortcuts; `sw.js` is the service worker, bundled to `frontend/web/static/sw.min.js`.

- Caching strategy: static (CSS/JS with cache-busting) Cache-First with `ignoreSearch`; API + HTML Network-First (`sw.js:1-16`).
- `CACHE_VERSION` is the literal `PLACEHOLDER`, replaced in CI by `scripts/ci/cache_busting_ci.sh` from the `VERSION` file (`sw.js:22-41`); same `?v=PLACEHOLDER` busting is applied to all template script/link tags.
- Offline pages limited to `/` and `/lists` with explicit precached assets (`sw.js:57-74`).

## Telegram Web App Pages

`frontend/webapp/*.html` are standalone Telegram Mini App pages (not Jinja2 — plain HTML loading the Telegram SDK), styled with their own `telegram-theme`/`app`/`forms` CSS and `--tg-theme-*` variables. Served alongside the bot ([[bot#Telegram Web App Integration]]).

- Pages: `index`, `add`, `addplan`, `edit`, `list`, `today`, `stats`, `summary`, `test`.
- Each loads `https://telegram.org/js/telegram-web-app.js` and uses `Telegram.WebApp` (`frontend/webapp/index.html:9`); JS bundled via the `webapp` entry → `webapp/static/js/dist/webapp.bundle.js`.

## Real-Time & Network Modules

Live UI updates ride a WebSocket client bundled from `budget/budgetWSClient`, complemented by the `shared/network/` connectivity-detection module (online/offline/degraded) consumed across pages. See [[realtime#WebSocket Endpoint & Token Handshake]] and [[api#Router Mounting & Versioning]].

- `network` entry (`frontend/shared/network/index.ts`) — zero-dependency, built first; ~13 TS files across `core/`, `features/`, `utils/`, `adapters/`, `types/`.
- `budgetWSClient` + `incrementalUpdates` bundles loaded in `base.html:383-384`; SW precaches `budgetWSClient.min.js` for offline `/lists`.

## Frontend Test Layout

Two test stacks: Vitest for unit/integration (happy-dom), Playwright for browser E2E. Vitest configs and the E2E suite live in separate trees, both driven from repo root via `npm run test:*`.

- Vitest: `config/vitest.config.ts`, tests under `frontend/tests/`, run with `npm run test:coverage`; coverage scoped to `frontend/**/static/js/**/*.ts`, E2E/`dist` excluded.
- Playwright: `config/playwright.config.ts`, specs under `tests/e2e/` (`*.spec.ts`), runs against `https://fbd.ikeniborn.ru` with an auth `setup` project; `npm run test:e2e:chromium` / `:full` (chromium+firefox+webkit+mobile).
- Type-check: `npm run type-check` (`tsc --noEmit -p config/tsconfig.json`); lint: `npm run lint` (ESLint).
