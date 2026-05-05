---
wiki_sources: ["docs/architecture/optimization/cache-busting.md", "docs/architecture/operations/versioning.md", "docs/architecture/core/build-system.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["cache-busting", "CI/CD", "semantic-versioning"]
aliases: ["Cache Busting", "Cache Invalidation", "?v= параметр"]
---

# Cache Busting

Механизм принудительной инвалидации браузерного кеша статических файлов при каждом деплое. Использует семантическую версию из файла `VERSION` в качестве query-параметра `?v=X.Y.Z`.

## Основные характеристики

### Принцип работы

**В исходниках (development):**
```html
<script src="/static/js/lists.min.js?v=PLACEHOLDER"></script>
```

**После CI/CD:**
```html
<script src="/static/js/lists.min.js?v=10.1.38"></script>
```

Скрипт `scripts/ci/cache_busting_ci.sh` заменяет `PLACEHOLDER` на значение из `VERSION` файла. Обрабатывает 59 HTML-шаблонов.

### Версионирование (v10.0+)

До v10.0 использовался timestamp `v20260124_1530`. С v10.0 — semantic version `X.Y.Z` из файла `/VERSION`, который является единым источником истины для:
- Docker image tags
- Cache-busting параметров в HTML
- Service Worker `CACHE_VERSION`
- `package.json` (синхронизируется pre-commit hook)
- `.env` (синхронизируется при деплое)

### Service Worker Cache

Vite plugin `vite-plugin-sw-version.ts` автоматически инкрементирует `CACHE_VERSION` в Service Worker при каждом `npm run build`. Это заставляет браузер загрузить новую версию SW и инвалидировать старый кеш.

### Важное правило

Если изменяется только `.ts`-файл (импортируемый модуль, не entry-point), CI-кеш incremental build не обнаружит изменение. Необходим `FORCE_REBUILD=true npm run build`.

## Применение в контексте Family Budget

Pre-commit hook автоматически синхронизирует `package.json` и `package-lock.json` с `VERSION`. VERSION обновляется разработчиком вручную перед каждым релизом — автоматический bump намеренно отключён.

## Связанные концепции

- [[семантическое-версионирование]]
- [[incremental-build]]
- [[registry-first]]
