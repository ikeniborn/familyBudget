---
name: fb-backend
description: >
  Backend development guide for the Family Budget project. Use this skill whenever you're writing, editing,
  or debugging Python backend code — adding new API endpoints, creating or modifying SQLModel models, writing
  Alembic migrations, implementing service logic, fixing bugs in authentication/authorization, working with
  WebSocket/Redis pub-sub, or writing backend tests.
  Trigger on: "add endpoint", "new model", "create migration", "fix API", "add service", "backend bug",
  "authentication issue", "database query", "WebSocket event", "Redis cache", "write test", "pytest",
  "SQLModel", "FastAPI route", "Pydantic schema", "alembic", "background job", "scheduler".
version: 1.0.0
author: Family Budget Team
tags:
  - backend
  - fastapi
  - sqlmodel
  - postgresql
user-invocable: true
---

# Family Budget — Backend Development

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI 0.121.2 |
| ORM | SQLModel 0.0.22 (SQLAlchemy 2.0 + Pydantic v2) |
| Database | PostgreSQL 16 via asyncpg 0.29.0 |
| Migrations | Alembic 1.14.0 |
| Caching | Redis ≥5.0.0 |
| Auth | JWT (python-jose) + Argon2 + TOTP + WebAuthn |
| Real-time | WebSocket + Redis Pub/Sub |
| Scheduler | APScheduler 3.11.0 |
| JSON | orjson (3-10× faster, used as default response class) |

## Project Structure

```
backend/app/
├── main.py                   ← FastAPI app, lifespan, middleware setup
├── scheduler.py              ← APScheduler cron jobs
├── api/
│   ├── v1/
│   │   ├── router.py         ← aggregates all v1 endpoint routers
│   │   └── endpoints/        ← 32+ endpoint modules (CRUD + WS + admin)
│   └── web/
│       └── router.py         ← Jinja2 page routes (HTMLResponse)
├── models/                   ← SQLModel ORM models (38 files)
├── schemas/                  ← Pydantic request/response schemas
├── services/                 ← business logic (45+ services)
├── db/
│   └── migrations/           ← Alembic (env.py + versions/)
├── core/
│   ├── config.py             ← Settings (pydantic-settings)
│   ├── dependencies.py       ← CurrentUser, CurrentAdmin, get_session
│   └── exceptions.py         ← APIException hierarchy
└── middleware/               ← JWT, CORS, logging, CSP, rate-limit
```

## Key Rules (read these first)

1. **Session is auto-transactional** — `get_session` commits on success, rolls back on error. Never call `session.commit()` inside an endpoint.
2. **Never call `session.commit()` in service functions** — services receive a session and operate within the endpoint's transaction.
3. **User isolation via `apply_user_filter()`** — always filter user-owned data by `current_user.id`; use `core/user_isolation.py`.
4. **Exception hierarchy** — raise `NotFoundException`, `ConflictException`, etc. from `core/exceptions.py`, never raw `HTTPException` in business logic.
5. **Schema separation** — separate `Create`, `Update`, `Response` Pydantic classes per domain; `model_config = ConfigDict(from_attributes=True)` on all `Response` schemas.
6. **Migrations are timestamp-named** — `YYYYMMDD_<hex>_<slug>.py`; never auto-generate migrations in production, always review generated SQL.
7. **orjson everywhere** — use `ORJSONResponse` for custom responses; default app response class is already orjson.
8. **Cache invalidation** — after every write that affects cached data, call the relevant `cache_service.invalidate_*()`.
9. **WebSocket broadcast** — after every write that clients may display in real-time, call the relevant `broadcast_*()` from `budget_ws.py`.
10. **Rate limiting** — use `@limiter.limit("X/minute")` on auth endpoints and any endpoint that can be abused.

## Reference Files

Load only what you need:

| Task | Read |
|------|------|
| Adding a new REST endpoint | `references/new-feature.md` |
| Creating/modifying a SQLModel model | `references/patterns.md#models` |
| Writing Pydantic schemas | `references/patterns.md#schemas` |
| Writing service logic | `references/patterns.md#services` |
| Creating an Alembic migration | `references/patterns.md#migrations` |
| Authentication / authorization | `references/patterns.md#auth` |
| WebSocket events / Redis Pub/Sub | `references/patterns.md#websocket` |
| Writing backend tests | `references/testing.md` |
| Background jobs / scheduler | `references/patterns.md#scheduler` |
