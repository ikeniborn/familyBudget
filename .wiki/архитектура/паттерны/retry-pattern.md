---
wiki_sources: ["docs/architecture/patterns/retry-pattern.md", "docs/architecture/core/dexie-integration.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["retry-pattern", "offline-first"]
aliases: ["withRetry", "Exponential Backoff", "Retry Logic"]
---

# Retry Pattern

Централизованная утилита `withRetry<T>()` для выполнения асинхронных операций с автоматическим повтором и экспоненциальным backoff при временных сбоях. Применяется в sync-операциях Dexie и pending queue.

## Основные характеристики

```typescript
interface RetryOptions {
  maxAttempts?: number;      // default: 3
  baseDelay?: number;        // default: 2000ms
  operationName?: string;    // default: "operation"
  shouldRetry?: (error: Error) => boolean;  // default: () => true
}
```

### Формула задержки

`delay = baseDelay × 2^(attempt - 1)`

При `baseDelay = 2000ms`: попытка 1 немедленно, 2 через 2 с, 3 через 4 с, 4 через 8 с.

### Применение в проекте

| Операция | Файл | maxAttempts | baseDelay | shouldRetry |
|----------|------|-------------|-----------|-------------|
| syncFacts | factSync.ts | 3 | 2000ms | Skip 401/403 |
| syncRecurringPlans | factSync.ts | 3 | 2000ms | Skip 401/403 |
| fetchReferenceData | referenceSync.ts | 3 | 1000ms | Skip 401/403 |

### Best Practices

- Всегда указывать `operationName` для читаемых ошибок
- Не повторять 401/403 (auth errors — перманентные)
- Для UI-операций: `baseDelay: 500, maxAttempts: 2`
- Для фоновых sync: `baseDelay: 5000, maxAttempts: 10`

## Installation Resilience (Backend/Scripts)

Retry-паттерн также применяется в скриптах установки (`scripts/lib/timeout.sh`):

**Формула:** `delay = min(RETRY_BASE_DELAY × 2^(attempt-1), RETRY_MAX_DELAY)`

**Конфигурация (env vars):**
```bash
MAX_RETRY_ATTEMPTS=3       # количество попыток
RETRY_BASE_DELAY=5         # начальная задержка (сек)
RETRY_MAX_DELAY=60         # максимальная задержка (сек)
```

**Прогрессия:** попытка 1 → 5s, 2 → 10s, 3 → 20s, 4+ → 60s (cap)

**Специализированные обёртки:**
- `apt_with_retry()` — с очисткой кэша между попытками
- `npm_with_retry()` — с таймаутом TIMEOUT_NPM_INSTALL=900s
- `curl_with_retry()` — с таймаутом TIMEOUT_CURL=60s
- `execute_with_retry()` — generic wrapper

**Отличие от frontend:** install-retry не использует `shouldRetry()` для пропуска auth errors, т.к. работает в bash (не TS).

## Связанные концепции

- [[offline-first]]
