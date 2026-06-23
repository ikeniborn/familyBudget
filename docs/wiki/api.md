# API

The Family Budget backend is a FastAPI application that exposes a versioned REST API under `/api/v1`, a set of HTML page routes at the root (`/`), and unversioned operational endpoints (health, PWA assets). This page is the routing reference: it explains how routers are aggregated, the prefix/path conventions every client must follow, and what each resource group provides. Auth flows, import, medicine, and WebSocket details live on their own pages and are linked rather than duplicated. For the request lifecycle and middleware see [[architecture]].

## Routing & Versioning

All business endpoints live under the `/api/v1` prefix. A single `api_router = APIRouter(prefix="/api/v1")` in `backend/app/api/v1/router.py` aggregates every per-resource router via `include_router(...)`, and `main.py` mounts it alongside the health and web routers.

`backend/app/main.py` wires three top-level routers in order (`backend/app/main.py:412-414`):

- `health_router` — operational endpoints at the root (`/health`, `/ready`, `/health/detailed`, `/ping`), no `/api/v1` prefix (`backend/app/api/health.py`).
- `api_router` — all REST resources under `/api/v1` (`backend/app/api/v1/router.py`).
- `web_router` — server-rendered HTML pages at `/` (`backend/app/api/web/router.py`).

Per-resource routers declare their own `prefix` and `tags` (e.g. `APIRouter(prefix="/facts", tags=["Facts"])`), so the full path is `/api/v1` + resource prefix + route path. Routers exported from `backend/app/api/v1/endpoints/__init__.py` are re-imported and included by `router.py`. Ordering matters: `facts_partials_router` is intentionally included **before** `facts_router` so HTMX partial routes like `/facts/stats` are not shadowed by the `/facts/{fact_id}` catch-all (`backend/app/api/v1/router.py:74-80`).

PWA assets (`/sw.min.js`, `/manifest.json`) are registered directly on the app with `@app.api_route(...)` and `include_in_schema=False`, mounted before `web_router` so the page catch-all does not intercept them (`backend/app/main.py:360-411`).

## Conventions (prefixes & base-relative paths)

The `/api/v1` prefix is applied exactly once, by the aggregating `api_router`. Clients must address endpoints **base-relative** — the prefix is part of the client's base URL, not of each request path. Double-prefixing is a recurring bug class.

The Telegram bot's HTTP client sets a `base_url` that already ends in `/api/v1`, and `httpx` concatenates the request path onto it. Therefore every bot handler passes base-relative paths like `/facts`, `/articles`, `/medicine-intakes/{id}` — never `/api/v1/...`. Passing an already-prefixed path produces `/api/v1/api/v1/...` → 404. This was the root cause of the medicine-intake callback regression (commit `a539e1bf`): five `/api/v1`-prefixed paths in the medicine handler hit a doubled prefix and every Telegram "taken"/"skip"/"snooze" button failed. The fix stripped the prefix to match the base-relative convention used by every other handler; a regression test in `bot/tests/test_medicine_handler.py` guards it. See [[bot]] for the bot-side API client.

Other conventions:
- **Resource prefixes** use kebab-case for multi-word names: `/cost-centers`, `/financial-centers`, `/product-groups`, `/shopping-lists`, `/shopping-list-items`, `/recurring-plans`, `/family-members`.
- **Tags** group endpoints in the OpenAPI schema (auto-served by FastAPI at `/docs` and `/openapi.json`).
- **Auth** is enforced via dependency aliases declared in `backend/app/core/dependencies.py`: `CurrentUser` (authenticated), `CurrentAdmin` (admin only), and `CurrentUserOptional` (anonymous allowed, used by public/web routes). Endpoints opt in by annotating a parameter, e.g. `current_user: CurrentUser`. See [[auth]].

## Authentication Endpoints

Authentication lives under `/api/v1/auth` (`auth.py`, `auth_refresh.py`) and `/api/v1/webauthn` (`webauthn.py`). These cover Telegram OAuth, email/password login, two-factor flows, token refresh, and biometric (WebAuthn) registration/login. The endpoints are summarized here; the full flows are documented in [[auth]].

- **`/api/v1/auth`** (`backend/app/api/v1/endpoints/auth.py`, `tags=["Authentication"]`) — Telegram login widget page (`GET /telegram-login`), `POST /telegram` OAuth exchange, email register/login, password set/change, 2FA setup/verify, backup codes, and account linking. Many `POST` routes; `GET` routes serve the login widget and status.
- **`/api/v1/auth/refresh`** (`backend/app/api/v1/endpoints/auth_refresh.py`) — `POST /refresh` exchanges a refresh token for a new access token. Same `/auth` prefix and `Authentication` tag.
- **`/api/v1/webauthn`** (`backend/app/api/v1/endpoints/webauthn.py`, `tags=["webauthn"]`) — biometric credential registration (`POST` begin/complete), authentication (`POST` begin/complete), `GET` registered credentials, and `DELETE` a credential.

## Core Resource Endpoints

The bulk of the API is conventional CRUD over budget domain resources, each on its own kebab-case prefix under `/api/v1`. Most follow `GET` (list) / `POST` (create) / `GET /{id}` / `PUT|PATCH /{id}` / `DELETE /{id}`, returning Pydantic schemas. The domain model behind these is described in [[domain]] and [[database]].

| Prefix | File | Notes |
|--------|------|-------|
| `/articles` | `articles.py` | Income/expense categories (hierarchical, Closure Table). CRUD + subtree/tree `GET` routes. |
| `/financial-centers` | `financial_centers.py` | ЦФО — accounts/wallets/cash. CRUD; several `PUT` routes (update, archive, restore). |
| `/cost-centers` | `cost_centers.py` | МВЗ — projects/departments/budget groups. CRUD; multiple `PUT` (update/archive/restore). |
| `/facts` | `facts.py` | Budget facts & plans (the central ledger). List/create/`GET /recent`, detail, `PUT`, `DELETE`, plus HTML row/partials (`/recent-html`, `/{id}/row-html`). |
| `/facts` (partials) | `facts_partials.py` | HTMX server-rendered fragments (`GET /stats`, `GET /pagination`), `tags=["Facts Partials (HTMX)"]`; included before main `facts` router. |
| `/transfers` | `transfers.py` | Money movement between financial centers — `POST` create, `DELETE` reverse. |
| `/recurring-plans` | `recurring_plans.py` | Recurring payment plans — CRUD, `GET /stats`, `POST /{id}/activate`, generation. |
| `/reminders` | `reminders.py` | Scheduled plan reminders keyed by `fact_id` — list, `POST/GET/PUT/DELETE /{fact_id}`. |
| `/notifications` | `notifications.py` | Budget notification history (broadcast support) — `POST` create, `GET` list/detail. |
| `/users` | `users.py` | User management — profile `GET/PATCH`, admin listing, activation, role changes. |
| `/family-members` | `family_members.py` | Family members (also used by Medicine) — list, create, `PATCH`, soft-archive `DELETE`. |
| `/consent` | `consent.py` | GDPR consent — `GET /status`, `POST ""` record, `POST /withdraw/{consent_type}`. |
| `/push` | `push.py` | Web Push (PWA) — `GET /vapid-key`, `POST /subscribe`, `POST /unsubscribe`, `POST /notify`. |
| `/stores` | `stores.py` | Shopping locations — CRUD + archive/restore. |
| `/product-groups` | `product_groups.py` | Hierarchical product categories — CRUD, `GET /{id}/subtree`, `PUT /{id}/move`. |
| `/shopping-lists` | `shopping_lists.py` | Shared shopping lists — CRUD + `PATCH` (e.g. completion). |
| `/shopping-list-items` | `shopping_list_items.py` | List items with batch operations. |

Shopping-list, product-group, and store endpoints power the `/lists` web page and follow a SHARED model (all lists visible to all users; only the creator may delete).

## Admin, Analytics & Operational Endpoints

Beyond user-facing CRUD, the API exposes admin tooling, analytics aggregation, export, and monitoring routers. These are aggregated by `router.py` alongside the resource routers and mostly require `CurrentAdmin`.

- **`/api/v1/admin`** (`backend/app/api/v1/admin.py`) — core admin operations (`tags=["Admin"]`).
- **`/api/v1/admin/analytics`** (`admin_analytics.py`) — system-wide analytics for the admin dashboard.
- **`/api/v1/admin/export`** (`admin_export.py`) and **`/api/v1/export`** (`export.py`) — admin and user data export.
- **`/api/v1/admin/logs`** (`admin_logs.py`) — `GET /` aggregated logs (browser + container) and `POST /browser` to ingest client logs. Mounted with an explicit `prefix="/admin/logs"` in `router.py`.
- **`/api/v1/admin/cache-metrics`** (`cache_metrics.py`) — `POST` to report and `GET` to read client-side cache metrics (`tags=["Admin", "Monitoring", "Cache Metrics"]`).
- **`/api/v1/analytics`** (`analytics.py`) — user-facing analytics powering the `/analytics` page.
- **`/api/v1/staging`** and **`/api/v1/admin/staging`** — multi-bank CSV import staging (`staging.py`, `admin_staging.py`); part of the import pipeline — see [[import]].
- **`/api/v1/example`** (`example_protected.py`) — reference endpoints demonstrating the `CurrentUser` / `CurrentAdmin` dependency pattern (not a product feature).

## Feature-Specific Endpoints (linked)

Two feature areas ship their own routers and are documented on dedicated pages. They are still mounted under `/api/v1` by the same aggregating router; only summaries appear here.

- **Import** — multi-bank CSV import, Google Sheets import, import templates, and the staging workflow (`import_endpoints.py`, `google_sheets_import.py`, `import_templates.py`, `shopping_csv_import.py`, `staging.py`, `admin_staging.py`). Full reference: [[import]].
- **Medicine** — medicine catalog/stock, courses, intakes, and medicine import (`medicines.py`, `medicine_courses.py`, `medicine_import.py`). Note the base-relative `/medicine-intakes/{id}` path used by bot callbacks. Full reference: [[medicine]].

## Realtime & WebApp Endpoints

Real-time budget updates and Telegram Web App support are served by dedicated routers under `/api/v1`. The WebSocket transport and its long-polling fallback are detailed in [[realtime]].

- **`/api/v1/budget`** (`budget_ws.py`, `tags=["budget-websocket"]`) — `POST /ws/token` to mint a short-lived WebSocket token, `WS /ws` for the bidirectional channel, plus `GET`/`POST` long-polling fallback routes. Backed by Redis Pub/Sub. See [[realtime]].
- **`/api/v1/webapp`** (`backend/app/api/v1/webapp/`, `tags=["Web Apps"]`) — Telegram Web App support: `POST /validate` verifies Telegram `initData`, and `/stats` provides Web App statistics. Consumed by the Telegram Web App pages; see [[bot]] and [[frontend]].

## Web Page Routes (HTML)

`web_router` (`backend/app/api/web/router.py`, `tags=["Web UI"]`) serves the HTML pages of the PWA at the root path (`/`), distinct from the JSON API under `/api/v1`. Each route returns a Jinja2 `TemplateResponse` and the pages fetch data from the REST API client-side (HTMX). Auth is enforced per page via `CurrentUser`, `CurrentAdmin`, or `CurrentUserOptional`.

Representative routes (all `GET`, `response_class=HTMLResponse`):

- **Public / optional auth**: `/` (dashboard, redirects to `/login-email` when anonymous), `/login-email`, `/register`, `/2fa-verify`, `/2fa-setup-login`, `/pending-activation`, `/analytics`, `/facts`, `/plan`, `/notifications`.
- **Authenticated (`CurrentUser`)**: `/security`, `/2fa-setup`, `/import`, `/lists`, `/lists/{list_id}`, `/admin/articles`, `/admin/financial-centers`, `/admin/cost-centers`, `/admin/stores`, `/admin/product-groups`, and the medicine pages (`/medicines`, `/medicines/catalog`, `/medicines/stock`, `/medicines/patients`, `/medicines/courses`, `/medicines/courses/{course_id}`).
- **Admin only (`CurrentAdmin`)**: `/admin/users`, `/admin/monitoring`, `/admin/dashboard`, `/admin/logs`.

These templates and the bundling pipeline that feeds them are described in [[frontend]].
