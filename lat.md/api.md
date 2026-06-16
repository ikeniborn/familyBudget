# API

REST API at `/api/v1/` plus WebSocket endpoint for real-time updates. Web page routes at `/` serve HTMX partial HTML.

## REST API

All endpoints under `backend/app/api/v1/endpoints/`. Standard patterns: GET (list + detail), POST (create), PUT/PATCH (update), DELETE (soft-delete where applicable). Pydantic schemas in `backend/app/schemas/` for request/response validation.

Authentication via Bearer JWT in `Authorization` header. See [[auth#JWT Tokens]].

## Key Endpoint Groups

Main resource groups exposed by the REST API.

### Facts (`/api/v1/facts`)

CRUD for [[domain#Budget Fact]]. Supports filtering by date range, article, cost center, financial center. Partial HTML responses for HTMX table updates via `facts_partials.py`.

### Articles (`/api/v1/articles`)

CRUD for [[domain#Article (Budget Category)]]. Tree operations use [[database#Closure Table]]. Returns hierarchy-aware responses.

### Cost Centers (`/api/v1/cost_centers`)

Admin-only write; read for all users. See [[domain#Cost Center]].

### WebSocket (`/api/v1/budget_ws`)

Real-time event stream per user. Client connects with JWT, receives JSON events on budget changes. See [[realtime#WebSocket Protocol]].

### Transfers (`/api/v1/transfers`)

P2P money transfers between users. Creates paired debit/credit facts atomically.

### Import (`/api/v1/import*`)

CSV import pipeline: upload → analyze columns → map to articles → stage → execute. Supports generic CSV, Tinkoff CSV, Google Sheets. Services: `csv_analyzer.py`, `csv_column_matcher.py`, `import_executor.py`.

### Notifications + Push

Web Push subscriptions and in-app notifications. Service: `notification_service.py`, `push_service.py`.

### Medicines (`/api/v1/medicines`, `/medicine-stock`, `/family-members`)

Medicine inventory, shared across all family users (no per-user filtering). Catalog CRUD + `/medicines/search`; DELETE = soft-archive (200, blocked 409 while active stock exists). Stock CRUD with soft-delete (DELETE → 204) + expiry filter (`?expiring_in_days=`). Family members CRUD with soft-archive. Mutations broadcast `medicine_catalog_changed` / `medicine_stock_changed` / `medicine_family_member_changed` via [[realtime#WebSocket Protocol]]. Web pages: `/medicines/catalog`, `/medicines/stock`. Daily expiry-alert job: `medicine_alert_service.py`. See [[database#Medicine Tracking (Phase 1)]].

## Web Routes

HTML page routes in `backend/app/api/web/`. Return full Jinja2 templates or HTMX partials. No JSON — only HTML fragments for HTMX swap targets.

## Rate Limiting & Caching

Cache layer via Redis. Service: `backend/app/services/cache_service.py`. Metrics exposed at `/api/v1/cache_metrics`.
