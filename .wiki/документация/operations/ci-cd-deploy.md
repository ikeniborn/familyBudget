---
wiki_sources:
  - "docs/architecture/operations/ci-cd-build-deploy.md"
  - "docs/architecture/core/build-system.md"
  - "docs/architecture/operations/versioning.md"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links:
  - "[[build-system]]"
  - "[[dexie-module]]"
tags:
  - family-budget
  - architecture
  - operations
  - deployment
aliases:
  - "CI/CD"
  - "деплой"
  - "deploy"
  - "Docker"
  - "GitHub Actions"
---

# CI/CD и деплой

Registry-first архитектура (v9.0.0+): все сборки выполняются в GitHub Actions CI/CD, сервер только получает готовые Docker-образы из `ghcr.io`. Никаких локальных сборок на сервере.

## Основные характеристики

**Среды:**
| Среда | URL | Назначение |
|-------|-----|-----------|
| Production | https://fb.ikeniborn.ru/ | Живые пользователи |
| Development | https://fbd.ikeniborn.ru/ | Тестирование фич |

**Рабочая директория на сервере:** `/opt/budget`

## Версионирование

**Файл `VERSION`** — единственный источник истины. Формат: semantic versioning `X.Y.Z`.

Pre-commit hook синхронизирует `package.json` и `package-lock.json` с `VERSION`.

CI/CD валидирует формат: `^[0-9]+\.[0-9]+\.[0-9]+$`. При невалидном формате — build fails.

`IMAGE_VERSIONS.json` — обновляется автоматически CI/CD (commit с `[skip ci]`) после каждого успешного билда.

## GitHub Actions Pipeline

**Триггер:** Push в любую ветку с изменением `VERSION`.

**Шаги:**
1. Checkout
2. Restore build cache (node_modules, .vite, .build-cache)
3. `npm ci` (из кеша за 5–10s, или полный за 2–3 мин)
4. `npm run build` (инкрементально — только изменённые бандлы)
5. Docker build (5 образов с embedded frontend)
6. Push в `ghcr.io`
7. Update `IMAGE_VERSIONS.json`

**5 Docker-образов:**
- `backend` — FastAPI + frontend статика
- `bot` — Telegram bot
- `nginx` — reverse proxy
- `postgres` — PostgreSQL 16
- `redis` — кеш и Pub/Sub

## Деплой на сервер

```bash
ssh budget-test
cd /opt/budget
./deploy.sh
```

`deploy.sh` выполняет:
1. `git pull`
2. Проверка нужна ли пересборка frontend (checksum detection)
3. `docker compose pull` (получить образы из registry)
4. `docker compose up -d` (rolling update)
5. Health checks
6. Service Worker validation

**ЗАПРЕЩЕНО:** Запускать `npm run build` или docker build на сервере.

## Incremental frontend build (v11.1.0+)

`build-all.js` использует MD5-хеши для определения изменённых бандлов:
- `.build-cache/` — 41 хеш-файл (32 bytes каждый)
- `FORCE_REBUILD=true npm run build` — принудительная полная пересборка

**Важный gotcha:** При изменении импортируемого модуля (не entrypoint), хеш entrypoint не изменится — нужен `FORCE_REBUILD=true`.

## Cache busting

Все статические файлы подключаются с `?v=PLACEHOLDER`. CI заменяет placeholder на реальную версию из `VERSION`. 34 HTML-шаблона обновляются автоматически.

## Backup и восстановление

- Локальные бэкапы: 7 дней
- S3 бэкапы (Яндекс Object Storage): 28 дней
- Скрипты: `scripts/backup.sh`, `scripts/restore.sh`

**ЗАПРЕЩЕНО:** Удалять Docker volumes без явного одобрения пользователя (необратимая потеря данных).
