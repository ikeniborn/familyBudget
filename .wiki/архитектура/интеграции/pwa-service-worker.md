---
wiki_sources: ["docs/architecture/core/build-system.md", "docs/architecture/core/dexie-integration.md"]
wiki_updated: 2026-05-05
wiki_status: stub
tags: ["PWA", "Service-Worker", "offline-first"]
aliases: ["PWA", "Service Worker", "SW", "CACHE_VERSION"]
---

# PWA и Service Worker

Progressive Web App архитектура с Service Worker для offline-поддержки и кеширования статических ресурсов. Service Worker автоматически версионируется при каждой сборке через Vite plugin.

## Основные характеристики

### CACHE_VERSION

Vite plugin `vite-plugin-sw-version.ts` при каждом `npm run build` инкрементирует `CACHE_VERSION` в `service-worker.js`. Это заставляет браузер обновить SW и инвалидировать старый кеш.

### Размещение файлов

- Service Worker собирается Vite → `.vite-build/sw.js`
- Автоматически копируется в `/opt/budget/sw.min.js` (deployment root)
- Backend обслуживает SW из этой директории

### Регистрация

Модуль `templates/scripts/service-worker-registration.html` — загружается ВТОРЫМ после `toast-manager.html` в base.html.

### Критичный порядок загрузки в base.html

```
1. toast-manager.html      — showToast() (всё зависит от него)
2. service-worker-registration.html — использует showToast
3. offline-manager-init.html + push-bell-manager.html + navbar-sync-badge.html
4. pwa-splash-screen.html
```

## Связанные концепции

- [[websocket-realtime]]
- [[offline-first]]
- [[cache-busting]]
