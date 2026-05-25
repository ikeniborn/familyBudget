# Architecture

Family Budget is a multi-layer web application with Telegram bot integration, built on FastAPI + PostgreSQL + Docker Compose.

## Components

Four runtime services compose the system.

### Backend (FastAPI)

REST API + WebSocket server. Handles authentication, business logic, real-time events. Runs with multiple Uvicorn workers — stateless except for WebSocket connections, which are coordinated via [[realtime#Redis Pub/Sub]].

Entry point: `backend/app/main.py`. Router tree: `api/v1/endpoints/` (REST) + `api/web/` (HTML page routes).

### Frontend (PWA)

Progressive Web App served by the backend. HTMX drives partial HTML updates; TypeScript bundles handle complex UI logic. Supports offline via Dexie.js IndexedDB sync. See [[frontend#Architecture]].

### Telegram Bot

python-telegram-bot 21.x handler tree. Reads same DB as backend via shared SQLModel models. Scheduled jobs for weekly reports and reminders. See [[bot#Architecture]].

### Database (PostgreSQL 16)

Star schema with dimension tables (articles, cost centers, financial centers) and fact table (`t_f_budget_fact`). History tracked via [[database#SCD Type 2]] and [[database#SCD Type 1 with History]]. Hierarchy via [[database#Closure Table]].

## Deployment

```
dev/*  →  PR  →  test (fbd.ikeniborn.ru)  →  PR  →  prod (fb.ikeniborn.ru)
```

VERSION file is the single source of truth. CI builds Docker images on VERSION change. Deploy: `ssh budget-test → cd /opt/budget → ./deploy.sh`. Never branch from `prod` — always from `test` or `dev/*`.

## Data Flow

```
Browser/Bot → FastAPI → PostgreSQL
                ↕            ↕
            Redis Pub/Sub  (events)
                ↕
         WebSocket clients
```

Write-behind cache (Redis → PostgreSQL) for high-frequency writes. See [[realtime#Write-Behind Cache]].
