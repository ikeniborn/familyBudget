# API

HTTP surface of Family Budget: a versioned `/api/v1` REST/JSON API, server-rendered HTML page routes, a Telegram Web App API, and unversioned health probes. This page catalogs the routes and the shared route plumbing. See [[auth#User Model & Auth Methods]], [[domain#Star Schema Overview]], [[medicine#Overview]], [[import#Pipeline Stages (Multi-Bank)]], and [[realtime]] for deep behavior.

## Router Mounting & Versioning

All JSON endpoints live under a single versioned router `api_router = APIRouter(prefix="/api/v1")` that aggregates every feature sub-router. Three top-level routers are mounted in `backend/app/main.py:412-414`.

- `health_router` — unversioned probes at `/health`, `/ready`, `/ping`, `/health/detailed` (`backend/app/api/health.py:26`).
- `api_router` — all REST + WebSocket + webapp endpoints under `/api/v1` (`backend/app/api/v1/router.py:48`).
- `web_router` — server-rendered HTML pages at `/` (`backend/app/api/web/router.py:12`).
- PWA assets `/sw.min.js` and `/manifest.json` are registered directly on the app before `web_router` (`backend/app/main.py:362,397`).
- Each feature router sets its own `prefix`/`tags`; `api_router.include_router` composes the full path (e.g. `/api/v1/articles`). `admin_logs_router` gets its prefix at include time: `prefix="/admin/logs"` (`router.py:89`).

## Common Dependencies

Shared FastAPI dependencies are re-exported from `backend/app/core/dependencies.py`. Route handlers inject the DB session and the authenticated user via `Annotated` type aliases rather than raw `Depends`.

- DB session: `get_session` (`backend/app/db/session.py:35`) yields an `AsyncSession`.
- Auth aliases (`backend/app/core/auth.py:188-190`): `CurrentUser` (required), `CurrentAdmin` (admin-only), `CurrentUserOptional` (`User | None`, used by HTML pages).
- Internal service-to-service calls: `InternalAPIKey` validates the `X-API-Key` header (`backend/app/core/internal_auth.py:14,49`).
- User isolation helpers (`apply_user_filter`, `ensure_user_owns_resource`, etc.) scope rows to the owner — see [[auth]].
- Auth enforcement happens at the edge in `JWTAuthMiddleware`, which whitelists `PUBLIC_PATHS`/`PUBLIC_PREFIXES` (health, `/api/v1/auth/*`) and otherwise requires a JWT cookie/bearer (`backend/app/middleware/jwt_middleware.py:48,75`). Details on [[auth#JWT Middleware]].

## Error Response Envelope

All error responses share one envelope: a top-level `detail` object containing `message`, `status_code`, optional `error_code`, and optional `details`. Handlers are registered in `backend/app/main.py:321-337` and emit `ORJSONResponse`.

- Schemas: `ErrorDetail` / `ErrorResponse` in `backend/app/schemas/errors.py:23,49`.
- `APIException` → structured body via `to_dict()` (`backend/app/middleware/error_handler.py:30`).
- `HTTPException` → `{message, status_code}` (`error_handler.py:78`).
- `SQLAlchemyError` → mapped: IntegrityError→409 `DB_CONSTRAINT_VIOLATION`, OperationalError→503 `DB_CONNECTION_ERROR`, else 500 `DATABASE_ERROR` (`error_handler.py:125`).
- Unhandled `Exception` → 500 `INTERNAL_ERROR`, internal details suppressed (`error_handler.py:209`).
- `get_common_responses(...)` injects standard OpenAPI error models into route docs (`errors.py:180`).

## Validation Errors

Pydantic / request validation failures return `422` with a distinct shape: `detail.message = "Validation error"` plus a `detail.errors[]` array of field-level objects (`field`, `message`, `type`, `location`). Handled in `backend/app/middleware/validation_error_handler.py:22`.

- Bound to both `RequestValidationError` and Pydantic `ValidationError` (`main.py:321-322`).
- Bare `ValueError` → `400` with `{message, type: "value_error"}` via `value_error_handler` (`validation_error_handler.py:107`).
- OpenAPI model: `ValidationErrorResponse` (`backend/app/schemas/errors.py:99`).

## Auth & Identity Endpoints

Authentication, WebAuthn biometrics, and consent. These are cataloged here but the flows (Telegram OAuth, email/2FA, refresh tokens, passkeys) are documented in [[auth#User Model & Auth Methods]].

- `/api/v1/auth` (`endpoints/auth.py`): `GET telegram-login`, `GET telegram-callback`, `POST telegram`, `POST refresh`, `POST logout`, `POST register`, `POST login`, `POST verify-2fa`, `POST setup-2fa`, `POST setup-and-verify-2fa`, `POST verify-2fa-setup`, `POST disable-2fa`, `POST backup-codes`, `POST add-email`, `POST set-password`, `POST link-telegram`, `GET methods`, `GET webauthn-status`.
- `/api/v1/auth/refresh` — token rotation (`endpoints/auth_refresh.py:17`); see [[auth#Refresh-Token Rotation]].
- `/api/v1/webauthn` (`endpoints/webauthn.py`): `POST register/options`, `POST register/verify`, `POST authenticate/options`, `POST authenticate/verify`, `GET credentials`, `DELETE credentials/{credential_id}`.
- `/api/v1/consent` (`endpoints/consent.py`): `GET status`, `POST ""`, `POST withdraw/{consent_type}` — GDPR; see [[auth#Consent Records (GDPR)]].

## Users Endpoints

User self-service and lookup. `/api/v1/users` (`endpoints/users.py`). Admin-level user management lives under `/api/v1/admin/users` (see [[#Admin Endpoints]]).

- `GET ""` (list), `GET /me`, `GET /{user_id}`, `POST ""` (create), `PUT /{user_id}`.
- `PATCH /me/notification-preferences`, `GET|PATCH /me/google-sheets-url`.
- `GET /telegram-ids`, `GET /timezones`.

## Domain Endpoints

Core budget domain: categories (articles), facts (transactions/plans), financial centers (ЦФО), cost centers (МВЗ), and transfers. Full semantics on [[domain#Star Schema Overview]].

- `/api/v1/articles` (`endpoints/articles.py`): CRUD + Closure-Table tree — `GET hierarchy`, `GET /{id}/subtree`, `GET /{id}/ancestors`.
- `/api/v1/facts` (`endpoints/facts.py`): `POST ""`, `GET ""`, `GET new`, `GET recent`, `GET summary`, `GET count`, `GET|PUT|DELETE /{fact_id}`, `POST batch-delete`; plus HTML partials `GET recent-html`, `GET /{fact_id}/row-html`. See also [[#HTMX Partial Endpoints]].
- `/api/v1/financial-centers` (`endpoints/financial_centers.py`) and `/api/v1/cost-centers` (`endpoints/cost_centers.py`): CRUD + `PUT /{id}/archive`, `PUT /{id}/restore`.
- `/api/v1/transfers` (`endpoints/transfers.py`): `POST ""`, `DELETE /{transfer_id}`.
- `/api/v1/recurring-plans` (`endpoints/recurring_plans.py`): CRUD + `GET stats`, `POST batch-delete`, `POST /{plan_id}/activate`.
- `/api/v1/reminders` (`endpoints/reminders.py`): `GET /`, plus per-fact `POST|GET|PUT|DELETE /{fact_id}`.

## Analytics Endpoints

Read-only aggregation for dashboards. `/api/v1/analytics` (`endpoints/analytics.py`) returns JSON or pre-rendered HTML fragments for HTMX.

- JSON: `GET quick-stats`, `GET plan-fact`, `GET trends`, `GET category-breakdown`, `GET waterfall`, `GET heatmap`, `GET heatmap-categories`, `GET plans/monthly-comparison`, `GET fact-hints`, `GET plan-hints`, `GET plans/filter-options`.
- HTML fragments: `GET quick-stats-html`, `GET account-balances-html`.

## Shopping Lists Endpoints

Shared shopping lists with stores, hierarchical product groups, and items. All under `/api/v1`.

- `/stores` (`endpoints/stores.py`): CRUD + archive/restore.
- `/product-groups` (`endpoints/product_groups.py`): CRUD + Closure-Table tree (`GET hierarchy`, `GET /{id}/subtree`, `GET /{id}/ancestors`, `PUT /{id}/move`) + archive/restore.
- `/shopping-lists` (`endpoints/shopping_lists.py`): CRUD + `GET /{id}/with-items`, archive/restore, `GET|PATCH /{id}/google-sheets-url`.
- `/shopping-list-items` (`endpoints/shopping_list_items.py`): CRUD + `GET products/suggest`, `GET check-duplicate`, `PUT /{id}/restore`, `POST batch-complete`, `POST batch-delete`.

## Import Endpoints

Multi-bank CSV / Google Sheets import with a staging-table review step. Mechanics on [[import#Pipeline Stages (Multi-Bank)]].

- `/api/v1/import` (`endpoints/import_endpoints.py`): banks CRUD, `POST upload`, `POST google-sheets/upload`, `GET files/{file_id}/analyze`, `GET files/{file_id}/preview`, `POST files/{file_id}/parse`, mappings.
- `/api/v1/staging` (`endpoints/staging.py`): user-level staging — `GET`, `PATCH|DELETE /{staging_id}`, `DELETE` (all), `POST bulk-delete`, `POST bulk-update`, `POST import`.
- `/api/v1/shopping-lists/import` (`endpoints/shopping_csv_import.py`): `POST analyze|preview|execute`.
- `/api/v1/shopping-lists/google-sheets` (`endpoints/google_sheets_import.py`): `POST fetch`.
- `/api/v1/import-templates` (`endpoints/import_templates.py`): CRUD for saved column mappings.

## Medicine Endpoints

Home medicine catalog, per-household stock (аптечка), and family members. Behavior on [[medicine#Overview]].

- `/api/v1/medicines` (`endpoints/medicines.py`): `GET ""`, `GET search`, `GET /{medicine_id}`, `POST ""`, `PATCH /{medicine_id}`, `DELETE /{medicine_id}`.
- `/api/v1/medicine-stock` (`endpoints/medicines.py:22`) — stock router (`medicine_stock_router`).
- `/api/v1/family-members` (`endpoints/family_members.py`): `GET ""`, `POST ""`, `PATCH /{member_id}`, `DELETE /{member_id}`.

## Notifications & Push Endpoints

In-app notification history and Web Push (PWA) subscriptions.

- `/api/v1/notifications` (`endpoints/notifications.py`): `POST ""`, `GET ""`, `GET check-duplicate` (broadcast-aware history).
- `/api/v1/push` (`endpoints/push.py`): `GET vapid-key`, `POST subscribe`, `POST unsubscribe`, `POST notify`.

## Realtime Endpoints

WebSocket-first live budget updates with a long-polling fallback. `/api/v1/budget` (`endpoints/budget_ws.py`). Transport and Redis Pub/Sub fan-out on [[realtime]].

- `POST /ws/token` (handshake token), `WEBSOCKET /ws`, `GET /ws/status`, `POST /ws/disconnect`, `GET /poll` (fallback, ~10s interval).

## Admin Endpoints

Admin-only management and monitoring. Guarded by `CurrentAdmin`.

- `/api/v1/admin` (`admin.py`): users management (`GET/POST/PUT/DELETE /users/...`, activate/deactivate, reset password/2FA/webauthn, `POST users/merge`, history, stats), articles & facts admin CRUD, `GET settings/timezone`, `GET redis-stats`.
- `/api/v1/admin/logs` (`endpoints/admin_logs.py`): `GET /` (aggregated logs), `POST browser` (client log ingest).
- `/api/v1/admin/staging` (`admin_staging.py`): admin view of import staging (CRUD, bulk ops, import).
- `/api/v1/admin/analytics` (`admin_analytics.py`): `GET overview`, `users-growth`, `transactions-trends`, `top-users`, `categories-breakdown`, `centers-usage`, `POST refresh-balance-aggregates`.
- `/api/v1/admin/cache-metrics` (`endpoints/cache_metrics.py`): `POST` (record), `GET` (report) — client-side cache monitoring.

## Export Endpoints

CSV export for user and admin scopes.

- `/api/v1/export` (`export.py`): `GET facts/csv`, `GET analytics/trends/csv`.
- `/api/v1/admin/export` (`admin_export.py`): `GET all-facts/csv` (admin, all users).

## HTMX Partial Endpoints

Server-rendered HTML fragments returned to HTMX clients (not JSON). Mounted before the main facts router so `/{fact_id}` does not shadow named paths (`router.py:68-71`). See [[frontend#HTMX + Tailwind/DaisyUI Stack]].

- `/api/v1/facts/table`, `/api/v1/facts/stats`, `/api/v1/facts/pagination` (`endpoints/facts_partials.py`).
- Inline fact HTML from the facts router: `GET facts/recent-html`, `GET facts/{fact_id}/row-html`.
- Analytics HTML fragments listed under [[#Analytics Endpoints]].

## Telegram Web App API

Dedicated endpoints for Telegram Web Apps, mounted at `/api/v1/webapp` (`backend/app/api/v1/webapp/__init__.py:25`). Web Apps reuse the standard `/api/v1/*` CRUD with a Bearer token; only `validate` is unique.

- `POST /api/v1/webapp/validate` — verifies Telegram `initData` and returns a JWT (`webapp/validate.py:41`). See [[auth#Telegram Mini App Auth]] and [[bot#Telegram Web App Integration]].
- `/api/v1/webapp/stats` (`webapp/stats.py:21`) — sub-router reserved for Phase 2+ statistics; currently declares no routes.

## Web HTML Page Routes

`web_router` serves Jinja2 templates at the site root for the PWA (`backend/app/api/web/router.py`). Pages use `CurrentUserOptional` (public/redirecting) or `CurrentUser`/`CurrentAdmin` (gated); they fetch data client-side via the REST API. See [[frontend#Telegram Web App Pages]].

- Public/auth: `GET /` (dashboard or redirect to `/login-email`), `/register`, `/login-email`, `/2fa-verify`, `/2fa-setup-login`, `/pending-activation`.
- Authenticated: `/facts`, `/plan`, `/analytics`, `/notifications`, `/import`, `/lists`, `/lists/{list_id}`, `/medicines/catalog`, `/medicines/stock`, `/security`, `/2fa-setup`.
- Admin: `/admin/users`, `/admin/articles`, `/admin/monitoring`, `/admin/dashboard`, `/admin/logs`, `/admin/financial-centers`, `/admin/cost-centers`, `/admin/stores`, `/admin/product-groups`.

## Health Endpoints

Unversioned liveness/readiness probes, exempt from JWT auth via the middleware whitelist. `health_router` (`backend/app/api/health.py:26`).

- `GET /health`, `GET /ready`, `GET /ping`, `GET /health/detailed` (DB + system metrics for monitoring).
