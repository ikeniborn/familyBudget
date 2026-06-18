# Architecture

How the Family Budget backend boots: FastAPI app assembly, the middleware stack and its execution order, the Pydantic settings model, the APScheduler cron jobs, the Docker service topology, and the registry-first versioning/deploy flow.

## Application Assembly

The FastAPI app is created in `backend/app/main.py:251` with `default_response_class=ORJSONResponse`, version `4.0.0` (display only), and an async `lifespan` context manager. Logging is configured at import time before the app exists.

- Entry point: `backend/app/main.py`; container runs `uvicorn backend.app.main:app` (Dockerfile CMD, `--workers` from `WORKERS` env).
- `lifespan` (`main.py:50`) wires startup/shutdown: init DB, Redis pool + warmup, Redis WS Pub/Sub, Write-Behind worker, push session factory, scheduler, WS cleanup task, bot-username auto-fetch — torn down in reverse on shutdown.
- Static mounts: `/static`, `/webapp` (html=True), `/shared`, resolved via `FrontendPaths` (`backend/app/core/paths.py`).
- Jinja2 templates mounted from `FrontendPaths.WEB_TEMPLATES`; `register_filters` adds HTMX filters; `config` injected as a template global for feature flags.
- PWA `/sw.min.js` and `/manifest.json` read from `/app/` volume mounts, declared before routers so catch-all web routes don't shadow them.

## Router Wiring

Three routers are included in `main.py:412` in order: `health_router` (`/health`, `/ready`, `/ping`), `api_router` (prefix `/api/v1`), and `web_router` (HTML pages at `/`). Web router is last so its catch-all routes never shadow API or health paths.

- `api_router` aggregates ~40 sub-routers in `backend/app/api/v1/router.py` (auth, webauthn, articles, facts, users, analytics, admin, import, medicines, shopping, transfers, budget WebSocket, etc.).
- Ordering matters inside the aggregate: `facts_partials_router` is registered before `facts_router` so `/stats`, `/pagination` are not captured by `/{fact_id}` (`router.py:71`).
- See [[api]] for the full endpoint surface, [[auth]] for auth/webauthn routers, [[realtime]] for the budget WebSocket, [[medicine]] and [[import]] for those feature routers.

## Middleware Stack & Order

Middleware is registered in `main.py:302-317` via `add_middleware`. Starlette prepends each, so the LAST added is the OUTERMOST on requests. Registration order is CORS, CSP, Logging, JWT — execution (request-inbound) is the reverse: JWT → Logging → CSP → CORS → routes.

Request-inbound execution order (outermost first):

1. **JWTAuthMiddleware** (`middleware/jwt_middleware.py`) — always extracts the JWT from the `access_token` cookie or `Bearer` header, sets `request.state.user_id`/`telegram_id` when valid. Whitelists `PUBLIC_PATHS`/`PUBLIC_PREFIXES`; protected paths without a valid token get a content-negotiated 401 (HTMX `HX-Redirect`, API JSON, browser 303 redirect to `/api/v1/auth/telegram-login`). See [[auth]].
2. **LoggingMiddleware** (`middleware/logging_middleware.py`) — generates/propagates a correlation ID (`X-Correlation-ID`), logs request + response with duration, re-raises exceptions to handlers.
3. **CSPMiddleware** (`middleware/csp_middleware.py`) — sets Content-Security-Policy (separate policy for `/webapp/*` Telegram iframes vs web UI CDNs), plus `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, and HSTS in production with Let's Encrypt.
4. **CORSMiddleware** — allows `settings.CORS_ORIGINS` with credentials.

On the response path the order is inverted, so CSP/CORS headers are applied after the inner handlers run.

## Rate Limiting

A slowapi `Limiter` keyed on client IP lives in `backend/app/middleware/rate_limiter.py`. It is attached to `app.state.limiter` (`main.py:298`), not run as middleware; per-endpoint `@limiter.limit(...)` decorators enforce limits. `RateLimitExceeded` → 429 via `_rate_limit_exceeded_handler`.

- `get_client_ip` prefers `X-Forwarded-For` then `X-Real-IP` (behind nginx), falling back to the socket address.
- Default limit `200/minute`; fully disabled when `ENVIRONMENT=test` to avoid 429s during rapid test runs.

## Exception Handlers

Handlers are registered specific-to-generic in `main.py:321-337`; FastAPI dispatches to the most specific matching type. All return `ORJSONResponse` with a `{"detail": {...}}` shape. Custom exception classes live in `backend/app/core/exceptions.py`.

| Exception | Handler | Status |
|-----------|---------|--------|
| `RequestValidationError`, `ValidationError` | `validation_exception_handler` | 422 (field-level `errors[]`) |
| `APIException` (+ subclasses) | `api_exception_handler` | per `status_code` |
| `HTTPException` | `http_exception_handler` | per status |
| `SQLAlchemyError` | `database_exception_handler` | 409 / 503 / 500 by type |
| `ValueError` | `value_error_handler` | 400 |
| `Exception` | `generic_exception_handler` | 500 (details hidden) |

- `APIException` hierarchy: `BadRequest`(400), `Unauthorized`(401), `Forbidden`(403), `NotFound`(404), `Conflict`(409), `UnprocessableEntity`(422), `InternalServer`(500), `Database`, `ServiceUnavailable`(503).
- Validation/value handlers in `middleware/validation_error_handler.py`; the rest in `middleware/error_handler.py`, which logs with the correlation ID.

## Configuration Model

`backend/app/core/config.py` defines a Pydantic-Settings `Settings` class loaded from env / `.env`. Access is via `get_settings()` (`@lru_cache` singleton). `VERSION` is read at import from `/app/VERSION` (Docker) or repo `VERSION`, so version updates need only a worker restart.

- Required (no default): `DATABASE_URL`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_ID`, `API_INTERNAL_KEY`.
- `CORS_ORIGINS` accepts CSV / JSON / list (`parse_cors_origins`); a validator rejects `*` and empty lists (credentialed CORS hardening).
- `SYSTEM_TIMEZONE` validated against IANA `available_timezones()`; drives the scheduler and new-user defaults.
- Feature/perf knobs: Redis cache TTLs, `WRITE_BEHIND_*`, `ENABLE_WEB_WORKERS`, `WS_RTT_THRESHOLD_MS`, VAPID push keys, WebAuthn RP settings (see [[auth]]), `SSL_TYPE`, `LOG_LEVEL`/`LOG_FORMAT`.

## Dependencies & Isolation Helpers

`backend/app/core/dependencies.py` re-exports the DI surface: `get_settings`, `get_session` (see [[database]]), auth dependencies (`CurrentUser`, `CurrentUserOptional`, `CurrentAdmin`), the internal-API guard, and user-isolation helpers.

- **Internal auth** (`core/internal_auth.py`): `verify_internal_api_key` checks the `X-Api-Key` header against `API_INTERNAL_KEY` for bot→backend calls; exposed as the `InternalAPIKey` dependency. See [[bot]].
- **User isolation** (`core/user_isolation.py`): `apply_user_filter` appends `WHERE user_id = current_user.id` (admins bypass); `can_access_resource` / `ensure_user_owns_resource` (403) / `get_user_id_for_create` enforce per-resource ownership.
- `get_cache_metrics_service` returns a lazy `CacheMetricsService` singleton for admin monitoring.

## Logging & JSON

Structured logging is configured once at module load in `main.py:46` via `setup_logging(level, format)` (`core/logging.py`). JSON format (default) uses `CustomJsonFormatter`, adding timestamp, level, logger, module/function/line and request context (`correlation_id`, method, path) when present.

- `StructuredLogger` and `get_logger(__name__)` are the standard logger entry points; `log.info("msg", **fields)` injects fields via `extra`.
- `core/logging_utils.py`: `hash_email_for_logging` emits an 8-char SHA-256 prefix to avoid logging PII.
- JSON serialization (`core/json_utils.py`): `ORJSONResponse` (app default) and `dumps`/`loads` use orjson with a stdlib fallback and a `default_serializer` handling `Decimal`/datetime/UUID/Pydantic; orjson availability is logged at startup.

## Scheduler

`backend/app/scheduler.py` runs an `AsyncIOScheduler` started/stopped by `lifespan`. Each multi-worker run guards against duplicate execution with a transaction-scoped PostgreSQL advisory lock (`advisory_xact_lock`, `pg_try_advisory_xact_lock`) on a dedicated lock-holder session. Job defaults: `coalesce=True`, `max_instances=1`, `misfire_grace_time=3600`.

Registered jobs (timezone = `SYSTEM_TIMEZONE`):

| Job | Schedule | Lock |
|-----|----------|------|
| `recalculate_article_usage_stats` | daily 00:00 | 1001 |
| `refresh_balance_aggregates` | daily 01:00 | 1006 |
| `generate_recurring_facts` | daily 02:00 (+ cache invalidate + WS broadcast) | 1007 |
| `medicine_maintenance` (expiry alerts) | daily 03:00 | 1010 |
| `check_budget_thresholds` | daily 18:00 | 1004 |
| `send_weekly_reports` | Mon 09:00 | 1003 |
| `send_plan_reminders` (Telegram + Web Push) | every 5 min | 1005 |
| `cleanup_expired_webauthn_challenges` | hourly | 1008 |

- Recurring-fact generation broadcasts `recurring_plan_facts_generated` over WebSocket — see [[realtime]].
- `LOCK_ID_MEDICINE_DISPATCH=1009` is reserved for a future Phase 3 5-minute job — see [[medicine]].

## Docker Topology

`docker-compose.yml` defines five services on the `familybudget` bridge network (`172.28.0.0/16`), all pulling pre-built images from `ghcr.io/ikeniborn/familybudget-*`. `bot` and `nginx` are gated behind the `full` Compose profile.

- **postgres** — PostgreSQL 16, tuned via `-c` flags incl. `pg_stat_statements` and `max_locks_per_transaction=256`; data on external volume `budget_postgres_data`. See [[database]].
- **redis** — caching + WebSocket Pub/Sub, `allkeys-lru`, AOF persistence, password-protected. See [[realtime]].
- **backend** — FastAPI/uvicorn (`WORKERS` default 1), `depends_on` postgres+redis healthy; healthcheck `python /app/healthcheck.py`; receives DB/JWT/Telegram/Redis/VAPID/WebAuthn env.
- **bot** (`full`) — Telegram bot, talks to `http://backend:8000/api/v1` with `API_INTERNAL_KEY`. See [[bot]].
- **nginx** (`full`) — TLS entrypoint on 80/443, mounts `/etc/letsencrypt` read-only; config baked into the image and templated by entrypoint with `DOMAIN`.

## Versioning & Deploy

`VERSION` (currently `0.7.10`) is the single source of truth, auto-incremented by one patch step per change; a pre-commit hook syncs `package.json`/`package-lock.json`. CI/CD (`build-and-push.yml`) builds images and writes per-service tags into `IMAGE_VERSIONS.json`. The server only pulls — no local builds (registry-first, v9.0+).

- `IMAGE_VERSIONS.json` holds independent versions + content hash + `paths[]` per service (backend/bot/nginx/redis/postgresql); touching a path triggers that image's rebuild.
- `deploy.sh` (run from the git repo, not `/opt/budget`): validates firewall + git sync, rsyncs code to `/opt/budget`, auto-syncs `VERSION`→`package.json`/`.env`, pulls images per `IMAGE_VERSIONS.json`, recreates only changed services, runs Alembic migrations (see [[database]]). Deploy target: `ssh budget-test` → `cd /opt/budget` → `./deploy.sh`.
- Lint/type config in `pyproject.toml` (pyright, ruff line-length 120, mypy); CI quality-checks gate image builds.
