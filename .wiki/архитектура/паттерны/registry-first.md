---
wiki_sources: ["docs/architecture/core/docker.md", "docs/architecture/operations/ci-cd-build-deploy.md", "docs/architecture/operations/versioning.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["Docker", "CI/CD", "GitHub-Actions", "nginx"]
aliases: ["Registry-First Architecture", "Registry-First CI/CD"]
---

# Registry-First Architecture

Архитектурный паттерн, при котором все Docker-образы собираются исключительно в GitHub Actions CI/CD и публикуются в GitHub Container Registry (ghcr.io). На производственном сервере выполняется только pull готовых образов — локальные сборки полностью исключены.

## Основные характеристики

| Свойство | Значение |
|----------|----------|
| Введён | v9.0.0 (2026-01-21) |
| Сборка | Только GitHub Actions |
| Registry | ghcr.io (GitHub Container Registry) |
| Теги | Только semver (например, `6.6.0`) |
| Образы | 5 кастомных (backend, bot, nginx, redis, postgresql) |
| Время деплоя | 2–3 мин (только pull, без build) |

### Процесс доставки

```
git push → GitHub Actions:
  1. Frontend Build (cache busting)
  2. Quality Checks (TypeScript, ESLint, pytest)
  3. Build & Push 5 Docker images → ghcr.io

Сервер (deploy.sh):
  git pull → docker pull ghcr.io/... → docker compose up -d → migrations
```

### Selective Rebuilding (IMAGE_VERSIONS.json)

Каждый из 5 образов пересобирается только при изменении соответствующих путей:

```json
{
  "backend": {
    "version": "6.6.0",
    "hash": "abc1234",
    "paths": ["backend/", "frontend/", "package.json"]
  }
}
```

Если хеш не изменился — образ не пересобирается, что экономит 2–4 минуты CI.

### Требования к серверу

Для работы на сервере достаточно:
- ✅ Docker + Docker Compose
- ✅ Доступ к ghcr.io

Не требуется:
- ❌ Node.js / npm
- ❌ Python build tools (gcc, make)
- ❌ Любые компиляторы

## Применение в контексте Family Budget

5 кастомных образов с multi-stage Dockerfiles:

| Образ | Базовый | Размер | Особенность |
|-------|---------|--------|-------------|
| familybudget-backend | python:3.11-slim + node:18-alpine | ~400 MB | Embedded frontend, distroless runtime |
| familybudget-bot | python:3.11-slim | ~320 MB | Distroless runtime |
| familybudget-nginx | nginx:alpine | ~50 MB | Reverse proxy + TLS |
| familybudget-redis | redis:7-alpine | ~40 MB | In-memory + pub/sub |
| familybudget-postgresql | postgres:16-alpine | ~250 MB | Primary DB |

## Связанные концепции

- [[multi-stage-build]]
- [[семантическое-версионирование]]
- [[ci-cd-pipeline]]
