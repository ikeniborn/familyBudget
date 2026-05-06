---
wiki_sources:
  - "docs/architecture/core/build-system.md"
wiki_updated: 2026-05-06
wiki_status: mature
wiki_outgoing_links:
  - "[[dexie-module]]"
  - "[[ci-cd-deploy]]"
tags:
  - family-budget
  - architecture
  - frontend
  - build
aliases:
  - "Vite"
  - "build система"
  - "сборка"
---

# Build System (Vite)

Family Budget использует Vite как систему сборки с TypeScript-компиляцией, минификацией и gzip pre-compression. Мигрирован с Rollup в v7.0.0.

## Основные характеристики

| Метрика | Значение |
|---------|---------|
| Холодная сборка | 13–17 секунд |
| Инкрементальная сборка | 0.5–2 секунды (v11.1.0+) |
| CI с кешем | 8–12 секунд |
| Бандлов | 41 |
| Сжатие JS | ~88% (minified + gzip) |

## Конфигурационные файлы

- `vite.config.ts` — основная конфигурация (multi-entry, IIFE format)
- `vite.config.single.ts` — для одиночных бандлов
- `build-all.js` — оркестратор 41 бандла с incremental builds
- `vite-plugin-sw-version.ts` — автоинкремент CACHE_VERSION Service Worker

**Формат вывода:** IIFE (не ES modules) — для работы в browser через `window.*`.

## Инкрементальные сборки (v11.1.0+)

Hash-based detection: пересобирает только изменённые бандлы.

```bash
npm run build               # Инкрементально (только изменённые)
FORCE_REBUILD=true npm run build  # Полная пересборка всех 41
```

**Кеш-файлы:** `.build-cache/` — MD5-хеш для каждого бандла (41 файл × 32 bytes).

**ВАЖНО:** Если изменён импортируемый модуль (не entrypoint), инкрементальный кеш не обновится автоматически — нужен `FORCE_REBUILD=true`.

## Pipeline сборки

```
Source (.ts) → TypeScript compiler (tsc --noEmit)
            → Vite build (.ts → .js)
            → Minification (Terser JS, cssnano CSS)
            → Gzip pre-compression
            → Output (.min.js, .min.css, .gz)
            → nginx (serving pre-compressed)
```

**Minification:**
- JS: Terser (3 passes, drops `console.log/info/debug`, unsafe_arrows)
- CSS: cssnano (rule merging, identifier reduction)
- Gzip: vite-plugin-compression (60–70% дополнительного сжатия)

## TypeScript интеграция (v7.1.0+)

**Strict mode** + 6 type definition файлов:
| Файл | Содержание |
|------|-----------|
| `types/api.d.ts` | API-responses, network types |
| `types/models.d.ts` | Domain models (User, BudgetFact, Article) |
| `types/global.d.ts` | Window namespace extensions |
| `types/indexeddb.d.ts` | IndexedDB schema |
| `types/navigator.d.ts` | Browser APIs |
| `types/telegram.d.ts` | Telegram WebApp types |

**Path aliases:**
```json
"@web/*": ["frontend/web/static/js/*"],
"@shared/*": ["frontend/shared/static/js/*"]
```

## Pre-commit hook

```bash
# .husky/pre-commit
npm run type-check
```

TypeScript-ошибки блокируют коммит. Пропустить для WIP: `SKIP_TESTS=1`.

## Cache busting (v10.0+)

Версия из файла `VERSION` (semantic versioning X.Y.Z) заменяет `?v=PLACEHOLDER` в 34 HTML-шаблонах. CI/CD валидирует формат regex `^[0-9]+\.[0-9]+\.[0-9]+$`.

## Dexie bundle: критический порядок загрузки

```html
<script src="dexie.min.js"></script>  <!-- 1. ПЕРВЫМ — window.Dexie = constructor -->
<script src="facts.min.js"></script>  <!-- 2. Наследует Dexie через window.Dexie -->
```

`dexie.min.js` использует async import с синхронным placeholder (`window.Dexie = null`) для предотвращения race condition. При ошибке — fallback stub с методами-заглушками.

## CI/CD кеш (GitHub Actions, v11.1.0+)

```yaml
path: node_modules, .vite, .build-cache
key: ${{ runner.os }}-build-${{ hashFiles('package-lock.json', 'config/vite.config*.ts', 'build-all.js') }}
```

Тёплый билд: 8–12s vs 2.5–3.5 мин (холодный). Размер кеша ~210–270MB.

## Связанные концепции

- [[dexie-module]] — критический порядок загрузки бандлов
- [[ci-cd-deploy]] — GitHub Actions использует build cache этой системы

## Миграция команд (v7.0.0)

| Старая команда | Новая команда |
|----------------|--------------|
| `npm run bundle` | `npm run build` |
| `npm run minify:js` | (автоматически в build) |
| `npm run precompress` | (автоматически в build) |
