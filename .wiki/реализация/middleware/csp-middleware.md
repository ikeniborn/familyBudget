---
wiki_sources:
  - "backend/app/middleware/csp_middleware.py"
wiki_updated: 2026-05-06
wiki_status: developing
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "CSP Middleware"
---

# CSPMiddleware — Content Security Policy и security headers

Starlette middleware для добавления CSP и security-заголовков ко всем ответам. Поддерживает два режима: web UI и Telegram WebApp (`/webapp/*`).

## Основные характеристики

**Базовый класс:** `BaseHTTPMiddleware`

**Режим Web UI** (путь не начинается с `/webapp`):
- `Content-Security-Policy`: разрешает CDN (tailwindcss, unpkg, jsdelivr), Telegram widget, inline scripts/styles
- `frame-src`: `oauth.telegram.org` и `*.telegram.org` (для Telegram OAuth iframe)
- `frame-ancestors 'none'` — запрет встраивания в iframe
- `X-Frame-Options: DENY`

**Режим Telegram WebApp** (`/webapp/*`):
- CSP с `frame-ancestors https://web.telegram.org https://*.telegram.org` — позволяет Telegram встраивать в iframe
- `unsafe-inline` для scripts и styles (требование WebApp)
- `X-Frame-Options` не устанавливается (CSP frame-ancestors достаточно)

**Общие security headers:**
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` — только в production + `SSL_TYPE=letsencrypt`

## Связанные концепции

- [[реализация/middleware/jwt-middleware.md]]
