---
wiki_sources: ["docs/architecture/core/build-system.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["CI/CD", "TypeScript", "incremental-build"]
aliases: ["Vite", "Build System", "build-all.js", "TypeScript компиляция"]
---

# Vite Build System

Система сборки фронтенда на основе Vite (с v7.0.0, заменил Rollup). Компилирует TypeScript, минифицирует JS/CSS, выполняет gzip pre-compression. Оркестрируется скриптом `build-all.js` для 41 bundle.

## Основные характеристики

### Производительность (v11.1.0+)

| Сценарий | Время |
|----------|-------|
| Cold build (41 bundles) | 13–17 с |
| Incremental (1 файл изменён) | 0.5–2 с |
| CI warm (cache hit) | 8–12 с |
| Размер JS после gzip | −88% |
| Размер CSS после gzip | −85% |

### Конфигурация

- `vite.config.ts` — основная (multi-entry, IIFE output)
- `vite.config.single.ts` — для single-bundle сборок
- `config/tailwind.config.js`, `config/vitest.config.ts`, `config/playwright.config.ts` — в `config/`

### TypeScript (гибридный подход)

- Dev: `.ts` файлы с type-checking
- Build: Vite компилирует `.ts` → `.js` автоматически
- `tsconfig.json` в корне, strict mode включён
- 6 type definition файлов в `types/`
- Pre-commit hook: `npm run type-check` (блокирует коммит при ошибках)

### Важный паттерн: Dexie bundle load order

```html
<!-- КРИТИЧНЫЙ ПОРЯДОК в base.html -->
<script src="/static/shared/dexie.min.js?v={{version}}"></script>  <!-- 1. ПЕРВЫМ -->
<script src="/static/facts/facts.min.js?v={{version}}"></script>   <!-- 2. Зависит от window.Dexie -->
```

`window.Dexie` должен быть доступен ДО загрузки бандлов, которые наследуются от `Dexie` class.

### Service Worker Versioning

Vite plugin `vite-plugin-sw-version.ts` автоматически инкрементирует `CACHE_VERSION` в Service Worker при каждой сборке.

## Команды

```bash
npm run build              # Incremental build (только изменённые)
FORCE_REBUILD=true npm run build  # Полная пересборка
npm run type-check         # TypeScript без сборки
npm run build:css          # Tailwind + CSS минификация
```

## Связанные концепции

- [[incremental-build]]
- [[cache-busting]]
- [[ci-cd-pipeline]]
