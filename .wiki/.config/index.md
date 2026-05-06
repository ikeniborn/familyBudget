# Wiki Index

<!-- Этот файл обновляется автоматически при ingest/init/query --save -->

## Страницы по доменам

### документация/frontend

- `.wiki/документация/frontend/dexie-module.md` — Dexie — модуль офлайн-базы данных (mature)
- `.wiki/документация/frontend/websocket-клиент.md` — WebSocket клиент (budgetWSClient) (mature)
- `.wiki/документация/frontend/build-system.md` — Build System (Vite) (mature)
- `.wiki/документация/frontend/dashboard-module.md` — Dashboard — модуль главной страницы (developing)
- `.wiki/документация/frontend/transfers-module.md` — Transfers — модуль переводов (stub)

### документация/api

- `.wiki/документация/api/transfers-api.md` — Transfers API — эндпоинт переводов (stub)
- `.wiki/документация/api/facts-api.md` — Facts API — эндпоинт транзакций (developing)

### документация/backend

- `.wiki/документация/backend/аутентификация.md` — Аутентификация (mature)
- `.wiki/документация/backend/recurring-plans.md` — Recurring Plans — повторяющиеся транзакции (developing)

### документация/database

- `.wiki/документация/database/budget-fact.md` — BudgetFact — модель транзакций и переводов (stub)

### документация/patterns

- `.wiki/документация/patterns/scd-closure-table.md` — SCD и Closure Table — паттерны базы данных (developing)
- `.wiki/документация/patterns/window-exports.md` — Window Exports Pattern (developing)
- `.wiki/документация/patterns/offline-first.md` — Offline-First паттерн (developing)

### документация/operations

- `.wiki/документация/operations/ci-cd-deploy.md` — CI/CD и деплой (developing)

### реализация/api

- `.wiki/реализация/api/facts-endpoint.md` — Facts API — CRUD транзакций, write-behind, partition pruning (mature)
- `.wiki/реализация/api/budget-websocket.md` — Budget WebSocket — real-time события, Redis Pub/Sub, long polling (mature)
- `.wiki/реализация/api/sync-endpoint.md` — Sync API — offline-first delta sync для Dexie/PGlite (developing)
- `.wiki/реализация/api/auth-endpoint.md` — Auth API — Telegram OAuth, Email+2FA, WebAuthn, token rotation (mature)
- `.wiki/реализация/api/transfers-endpoint.md` — Transfers API — переводы между CFO, дедупликация sync_hash (developing)

### реализация/services

- `.wiki/реализация/services/write-behind.md` — Write-Behind Service — async PostgreSQL via Redis queue (mature)
- `.wiki/реализация/services/redis-ws-manager.md` — Redis WS Manager — multi-worker WebSocket Pub/Sub (mature)
- `.wiki/реализация/services/auth-service.md` — Auth Service — user lookups, JWT tokens, Argon2id (developing)
- `.wiki/реализация/services/cache-service.md` — Cache Service — Read-Through Redis кэш с graceful degradation (developing)
- `.wiki/реализация/services/scd2-service.md` — SCD2 Service — generic versioning для Article/User (developing)
- `.wiki/реализация/services/recurring-plan-service.md` — Recurring Plan Service — генерация BudgetFact по расписанию (developing)

### реализация/models

- `.wiki/реализация/models/budget-fact.md` — BudgetFact — fact table транзакций, партицирование, offline sync (mature)
- `.wiki/реализация/models/user.md` — User — SCD Type 1 + UserHistory, Telegram OAuth + Email+2FA (mature)

### реализация/middleware

- `.wiki/реализация/middleware/jwt-middleware.md` — JWTAuthMiddleware — Cookie/Bearer + smart 401 responses (mature)
- `.wiki/реализация/middleware/csp-middleware.md` — CSPMiddleware — Content-Security-Policy, security headers (developing)
- `.wiki/реализация/middleware/logging-middleware.md` — LoggingMiddleware — Correlation ID, structured JSON (stub)

### реализация/bot

- `.wiki/реализация/bot/start-handler.md` — Bot /start — Telegram OAuth аутентификация + WebApp (developing)
- `.wiki/реализация/bot/summary-handler.md` — Bot /summary — план vs факт с inline keyboard, APIClient (developing)

### реализация/frontend

- `.wiki/реализация/frontend/budget-ws-client.md` — budgetWSClient — TypeScript WS клиент, multi-tab, long polling (developing)
- `.wiki/реализация/frontend/dexie-manager.md` — DexieManager — offline-first IndexedDB, sync, pruning (developing)
- `.wiki/реализация/frontend/dashboard-module.md` — Dashboard — window.Dashboard.*, addTransaction, editModal (developing)
