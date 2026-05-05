---
wiki_sources: ["docs/architecture/operations/ci-cd-build-deploy.md", "docs/architecture/operations/versioning.md", "docs/architecture/core/build-system.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["CI/CD", "GitHub-Actions", "Docker", "nginx"]
aliases: ["CI/CD Pipeline", "GitHub Actions", "build-and-push.yml"]
---

# CI/CD Pipeline

Автоматизированный pipeline сборки и доставки на основе GitHub Actions. Запускается при каждом push в `test` branch. Реализует Registry-First Architecture: все сборки в CI, на сервере — только pull.

## Основные характеристики

### Структура pipeline

**Job 1: Frontend Build** (параллельно запускается первым)
1. Checkout кода
2. Cache busting: замена `PLACEHOLDER` → версия из `VERSION`
3. `npm ci` + `npm run build:prod`
4. Auto-commit built files с `[skip ci]`

**Job 2: Quality Checks** (depends on: frontend-build)
1. `npm run type-check` (TypeScript) — блокирует workflow при ошибках
2. `npm run lint` (ESLint) — legacy issues как warnings
3. `mypy backend/` + `ruff check backend/` — continue-on-error
4. `pytest tests/unit/ --cov`

**Job 3: Build and Push** (depends on: quality-checks)
1. Проверка IMAGE_VERSIONS.json — пересобирать ли образ
2. Сборка 5 Docker образов с multi-stage builds
3. Push в ghcr.io с semver тегом (только `X.Y.Z`)

### Триггеры

```yaml
on:
  push:
    branches: [test]
    tags: ['v*.*.*']
  workflow_dispatch:
    inputs:
      custom_tag: ...
```

Concurrency: `cancel-in-progress: true` — только один workflow на branch одновременно.

### Auto-commit механизм

Frontend Build коммитит собранные файлы обратно в `test` branch с `[skip ci]` для предотвращения бесконечного цикла. Job 3 делает `git pull` перед сборкой образов.

### Деплой на сервер

```bash
ssh budget-test
cd /opt/budget
./deploy.sh
# Внутри: git pull → docker pull ghcr.io/... → docker compose up -d → migrations
```

## Связанные концепции

- [[registry-first]]
- [[multi-stage-build]]
- [[семантическое-версионирование]]
- [[incremental-build]]
