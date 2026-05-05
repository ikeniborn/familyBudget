---
wiki_sources: ["docs/architecture/frontend/base-template-structure.md", "docs/architecture/README.md"]
wiki_updated: 2026-05-05
wiki_status: stub
tags: ["HTMX", "Tailwind", "DaisyUI"]
aliases: ["base.html", "Base Template", "Модульная декомпозиция"]
---

# Base Template (base.html)

Базовый Jinja2-шаблон, от которого наследуются все страницы приложения. В v7.x декомпозирован с 2884 строк до 1355 строк (−53%) путём вынесения inline JS/CSS в модульные компоненты.

## Основные характеристики

### Модульная структура (v7.x)

**JavaScript модули** (`templates/scripts/`):
- `toast-manager.html` — showToast(), showToastWithAction() **[ПЕРВЫМ]**
- `service-worker-registration.html` — PWA Service Worker **[ВТОРЫМ]**
- `offline-manager-init.html` — Offline режим
- `push-bell-manager.html` — Push notifications
- `navbar-sync-badge.html` — Sync badge
- `pwa-splash-screen.html` — PWA Splash

**Критичный порядок загрузки** — нарушение вызывает ReferenceError.

**Компоненты** (`templates/components/`):
- `user_dropdown_menu.html` — единый macro desktop/mobile
- `cookie_consent_banner.html`, `push_permission_banner.html`, `sw_update_modal.html`

### Что остаётся inline

- Dark Mode IIFE (FOUC prevention)
- `handleLogout()`, `setButtonLoading()` (onclick в HTML navbar)
- `updateRealVH()` (iOS Safari viewport fix)
- PWA Splash Screen CSS (критичен для Fast First Paint)

### WebSocket auto-connect (v11.4.2)

```javascript
window.budgetWSClient = new BudgetWSClient();
setTimeout(() => {
  if (window.budgetWSClient?.enabled) {
    window.budgetWSClient.connect();
  }
}, 1000); // 1s — ожидание инициализации offlineManager
```

## Связанные концепции

- [[pwa-service-worker]]
- [[websocket-realtime]]
