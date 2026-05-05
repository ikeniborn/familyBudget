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

## Связанные концепции

- [[offline-first]]
