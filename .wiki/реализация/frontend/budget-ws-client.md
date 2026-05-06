---
wiki_sources:
  - "frontend/web/static/js/budget/budgetWSClient/index.ts"
  - "frontend/web/static/js/budget/budgetWSClient/core/connectionManager.ts"
  - "frontend/web/static/js/budget/budgetWSClient/core/WSState.ts"
  - "frontend/web/static/js/budget/budgetWSClient/multiTab/leaderElection.ts"
  - "frontend/web/static/js/budget/budgetWSClient/fallback/longPolling.ts"
wiki_updated: 2026-05-06
wiki_status: developing
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "budgetWSClient"
  - "WebSocket Client"
---

# budgetWSClient — TypeScript WebSocket клиент с multi-tab поддержкой

TypeScript-модуль для WebSocket real-time соединения с FastAPI бэкендом. Поддерживает multi-tab leader election (BroadcastChannel), long polling fallback, mobile wake recovery, и health checks. Организован как barrel export (`index.ts`).

## Основные характеристики

**Расположение:** `frontend/web/static/js/budget/budgetWSClient/`
**Bundle:** `budgetWSClient.bundle.js`

**Структура модуля:**
```
core/
  WSState.ts         — глобальный state (getState, updateState, resetState)
  connectionManager.ts — connect/disconnect/reconnect lifecycle
  featureFlags.ts    — runtime feature flags
fallback/
  longPolling.ts     — HTTP long polling fallback
  pollRetry.ts       — exponential backoff
features/
  healthCheck.ts     — ping/pong
  rttMeasurement.ts  — round-trip time
  statusIndicator.ts — UI badge (connected/disconnected)
integration/
  eventHandlers.ts   — dispatch WS events → HTMX/DOM handlers
  eventRegistration.ts — регистрация обработчиков
  syncHandler.ts     — offline sync через Dexie
  uploadHandler.ts   — upload после reconnect
multiTab/
  leaderElection.ts  — BroadcastChannel Leader/Follower
  followerSync.ts    — follower получает события от leader
  tabCoordination.ts — cross-tab message routing
mobile/
  browserDetection.ts — Safari/iOS детекция
  wakeRecovery.ts    — reconnect после sleep
  navigationDetection.ts — reconnect при navigate
adapters/
  windowExports.ts   — экспорт в window.* для onclick
```

**Публичный API (index.ts exports):**
- `getState()`, `updateState()`, `resetState()`, `createInitialState()`
- `connect()`, `disconnect()`, `reconnect()`, `forceReconnect()`, `on()`, `off()`
- `supportsMultiTab()`, `initMultiTab()`, `tryBecomeLeader()`, `tryBecomeLeaderWithTimeout()`
- `startFollowerMode()`, `stopFollowerMode()`, `updateConnectionStatus()`
- `handleChannelMessage()`, `broadcastWSEvent()`, `requestStatus()`
- `startLongPolling()`, `stopLongPolling()`, `calculateRetryDelay()`, `isRetryableError()`

**connectionManager.ts:**
- `logHistory(event, details)` — хранит последние 20 событий в WSState.connectionHistory
- `closeExistingConnection()` — закрывает WS или останавливает polling
- Reconnect logic: `scheduleReconnect()`, `forceReconnect()`

## Связанные концепции

- [[реализация/api/budget-websocket.md]]
- [[реализация/frontend/dexie-manager.md]]
