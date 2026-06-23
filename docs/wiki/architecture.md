# Architecture

Family Budget is a family budget management system with a Telegram bot and a Progressive Web App. It is built on FastAPI (async backend), PostgreSQL, Redis, and a Telegram bot, all packaged as Docker images and deployed behind an nginx reverse proxy.

## System Components

The system is composed of five Docker services — PostgreSQL, Redis, FastAPI backend, Telegram bot, and nginx — defined in `docker-compose.yml`. The backend serves both the REST API and the HTMX web UI; the bot is a separate process talking to the backend over the internal Docker network.

- **postgres** — PostgreSQL 16 (`ghcr.io/ikeniborn/familybudget-postgresql`), the system of record. Tuned via `command:` flags (`shared_buffers`, `pg_stat_statements`, `max_locks_per_transaction=256`). Data lives in the external `budget_postgres_data` volume; backups in `postgres_backups`. See [[database#SQLAlchemy Models & Session]].
- **redis** — Redis (`ghcr.io/ikeniborn/familybudget-redis`) used for caching and WebSocket Pub/Sub sync across workers. `allkeys-lru` eviction, AOF persistence (`redis_data`). See [[realtime#Redis Pub/Sub Fan-out]].
- **backend** — FastAPI 0.121.2 app (`backend/app/main.py`), entry `uvicorn backend.app.main:app`. Serves REST API at `/api/v1`, web pages at `/`, health at `/health`, and mounts static assets. See [[api#Core Resource Endpoints]].
- **bot** — python-telegram-bot 21.10 process (`bot/main.py`). Only started under the Compose `full` profile. Calls the backend at `http://backend:8000/api/v1`. See [[bot#Command Handlers]].
- **nginx** — reverse proxy / TLS terminator (`ghcr.io/ikeniborn/familybudget-nginx`), `full` profile only. Entry point for all HTTP/HTTPS traffic.

All services share the `familybudget` bridge network (subnet `172.28.0.0/16`).

## Service Topology

Service startup order is enforced by Compose `depends_on` health conditions: postgres and redis must be healthy before backend starts, backend must be healthy before bot and nginx start. nginx is the only public entry point; the bot reaches the backend purely over the internal network.

```
Internet ──HTTPS──> nginx ──> backend (uvicorn :8000) ──> postgres
                                  │                   └──> redis
Telegram ──polling──> bot ──HTTP──> backend (internal: backend:8000)
```

- `postgres` (healthcheck `pg_isready`) and `redis` (`redis-cli ping`) gate the backend.
- `backend` healthcheck runs `python /app/healthcheck.py`; nginx and bot wait on `service_healthy`.
- The bot uses **long polling** by default (`drop_pending_updates=True`); it reaches the backend via the internal service name `backend:8000`, never the public domain. The public `DOMAIN` is used only to build Web App URLs (`bot/bot.py:195`).
- Ports `5432`/`6379` are published on the host but firewalled by UFW; only `80`/`443` (nginx) are meant to be reachable externally.

## Request Flow

Incoming HTTPS requests terminate at nginx (`nginx/conf.d/app-https.conf.template`), which proxies everything to the `backend` upstream (`upstream.conf.template`, `backend:8000`, keepalive 32). nginx does almost no static serving — FastAPI's `StaticFiles` mounts serve assets.

- **WebSocket** `/api/v1/budget/ws` — dedicated nginx location with `Upgrade`/`Connection` headers and a 24h read timeout; access log disabled (JWT travels in the URL). See [[realtime#WebSocket Endpoint]].
- **API** `/api/` → backend; **`/health`**, **`/docs`**, **`/openapi.json`** → backend.
- **`/webapp/`** — Telegram Web App pages, served from the backend `StaticFiles` mount with relaxed `X-Frame-Options` and Telegram-specific CSP/CORS so Telegram can iframe them.
- **`/shared/`** and **`/static/`** — shared and web static assets, served by the backend (`app.mount` in `backend/app/main.py:342-349`); nginx adds cache headers.
- **`/`** (catch-all) → backend web router, which renders Jinja2/HTMX templates (`backend/app/api/web/router.py`); unauthenticated users are redirected to `/login-email`.
- **PWA**: `/sw.min.js` and `/manifest.json` are served by dedicated backend routes (`backend/app/main.py:362`, `:396`), not nginx, to avoid Docker bind-mount inode issues and force Service-Worker revalidation (`Cache-Control: no-cache`).

## Middleware Stack

The FastAPI app wires middleware and exception handlers in `backend/app/main.py`. Because Starlette executes middleware in reverse registration order, the last-added `JWTAuthMiddleware` runs first on each request; CORS (added first) runs outermost.

Registration order (`backend/app/main.py:302-337`):

1. `CORSMiddleware` — origins from `settings.CORS_ORIGINS`, `allow_credentials=True`.
2. `CSPMiddleware` — Content-Security-Policy / XSS hardening.
3. `LoggingMiddleware` — request tracing (placed before JWT).
4. `JWTAuthMiddleware` — authentication; runs first at request time. See [[auth#JWT Tokens & Refresh]].

Exception handlers are ordered specific → generic: validation errors, custom `APIException`, FastAPI `HTTPException`, `SQLAlchemyError`, `ValueError`, and a catch-all `Exception` handler. A SlowAPI `limiter` is attached to `app.state` for per-endpoint rate limiting. Responses default to `ORJSONResponse` for high-performance JSON.

## Application Lifespan

The `lifespan` async context manager (`backend/app/main.py:50`) runs ordered startup and shutdown. Most subsystems (Redis cache, Pub/Sub, write-behind worker) degrade gracefully — a failure is logged as a warning and the app continues in a reduced mode rather than crashing.

Startup sequence: init DB → init Redis pool + warmup → init Redis WebSocket Pub/Sub (multi-worker) → start write-behind worker (`WRITE_BEHIND_ENABLED`) → set push-notification session factory → start the background scheduler → start the WebSocket cleanup task → auto-fetch `TELEGRAM_BOT_USERNAME` from the Telegram API if unset.

Shutdown reverses this: stop WebSocket cleanup, stop scheduler, stop write-behind worker, close Redis Pub/Sub and pool, close DB connections.

## Background Scheduler

The backend runs an in-process `AsyncIOScheduler` (APScheduler) started during lifespan via `start_scheduler()` (`backend/app/scheduler.py`). To keep cron jobs single-fire when running multiple uvicorn workers, every job wraps its work in a transaction-scoped PostgreSQL advisory lock (`pg_try_advisory_xact_lock`) so only one worker executes.

Registered jobs (cron in `SYSTEM_TIMEZONE`):

- `recalculate_article_usage_stats` — daily 00:00 (calls SQL `recalculate_article_usage_stats()`).
- `refresh_balance_aggregates` — daily 01:00.
- `generate_recurring_facts` — daily 02:00; invalidates cache and broadcasts a WebSocket event on new facts. See [[domain#Recurring Plans]].
- `medicine_maintenance` — daily 03:00 (intake generation, late-marking, expiry alerts). See [[medicine#Reminders]].
- `check_budget_thresholds` — daily 18:00 (FR-006 notifications).
- `send_weekly_reports` — Mondays 09:00 (FR-005).
- `send_plan_reminders` — every 5 min (Telegram + Web Push). See [[realtime#Push Notifications]].
- `medicine_reminder_dispatch` — every 5 min.
- `cleanup_expired_webauthn_challenges` — hourly. See [[auth#WebAuthn Biometrics]].

Job defaults: `coalesce=True`, `max_instances=1`, `misfire_grace_time=3600`. The Telegram bot runs its **own** separate APScheduler (`bot/utils/scheduler.py`, started in `bot/bot.py:234`) for bot-side jobs.

## Frontend

The frontend has three Vite-bundled source roots under `frontend/` plus a tests root, all served by the FastAPI backend rather than nginx. The web PWA uses HTMX + Tailwind CSS + DaisyUI with server-rendered Jinja2 templates; client logic ships as IIFE bundles. See [[frontend#Build & Test]].

- `frontend/web/` — main Progressive Web App (Jinja2 templates, CSS sources, `static/js` bundle output), mounted at `/static`.
- `frontend/shared/` — shared TypeScript (network adapters, window exports) bundled into the web output and also served at `/shared`.
- `frontend/webapp/` — Telegram Web App pages, mounted at `/webapp` (`html=True`).
- `frontend/tests/` — Vitest unit/integration tests.

Public functions for inline `onclick` are exposed through the window-exports pattern (`frontend/shared/network/adapters/windowExports.ts`). Bundles are referenced with a `?v=PLACEHOLDER` query that CI rewrites to the real version for cache busting.

## Deployment & CI/CD

The project is registry-first: GitHub Actions builds and pushes versioned Docker images to GHCR, and the server only pulls ready images — builds never run on the server. `VERSION` (currently `0.8.7`) is the single source of truth; `IMAGE_VERSIONS.json` records the per-image version, commit hash, and the source paths that trigger a rebuild.

- **CI** (`.github/workflows/build-and-push.yml`, "Build → Push → Deploy → Test") triggers on pushes to `test` (and `v*.*.*` tags) touching `VERSION`, `backend/`, `bot/`, `nginx/`, `redis/`, `postgres/`, `frontend/`, `scripts/`, or packaging files. It checks the `VERSION` change, builds only the images whose paths changed, pushes to `ghcr.io/ikeniborn/familybudget-*`, then deploys and tests.
- **Per-image versions**: `IMAGE_VERSIONS.json` maps each image (`backend`, `bot`, `nginx`, `redis`, `postgresql`) to its `paths`; touching a path in that list forces that single image to rebuild.
- **Production deploy** (`.github/workflows/deploy-prod.yml`, manual `workflow_dispatch`) ships code/config to the prod server over SSH and pulls images per `IMAGE_VERSIONS.json` — no rebuild. Default profile `full`.
- **Server deploy** (`deploy.sh`): validates prerequisites, syncs repo → `/opt/budget`, pulls GHCR images, starts services, waits for healthy, runs Alembic migrations, and configures UFW. `--profile full` enables nginx + bot; `--clean` removes volumes (destructive).
- **Git flow**: feature branches `dev/*` → PR into `test` (CI gate) → `prod`. See the project `CLAUDE.md` for the full versioning and deploy rules.

Environments: Production `https://fb.ikeniborn.ru/`, Development `https://fbd.ikeniborn.ru/`.
