---
wiki_sources:
  - "backend/app/middleware/logging_middleware.py"
wiki_updated: 2026-05-06
wiki_status: stub
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "Logging Middleware"
---

# LoggingMiddleware — структурированное логирование запросов

Starlette middleware для структурированного логирования HTTP запросов/ответов с Correlation ID tracing.

## Основные характеристики

**Базовый класс:** `BaseHTTPMiddleware`
**Logger:** `StructuredLogger` (кастомный JSON-форматтер)

**Что логируется:**
- Request: method, path, IP, user-agent, correlation_id
- Response: status code, duration (ms)
- Errors: stack traces при исключениях

**Correlation ID:**
- Извлекается из `X-Correlation-ID` заголовка или генерируется (`uuid4`)
- Проставляется в response headers
- Доступен в логах для трассировки цепочки запросов

## Связанные концепции

- [[реализация/middleware/jwt-middleware.md]]
- [[реализация/middleware/csp-middleware.md]]
