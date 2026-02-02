# CI/CD Build & Deploy Pipeline - Registry-First Architecture

**Дата создания**: 2026-01-20
**Версия**: 2.0 (Registry-First)
**Статус**: Active
**Last Updated**: 2026-01-21

## Обзор

> **📖 Related Documentation:**
> - For **Testing & Validation workflows** (frontend tests, E2E, security, accessibility), see [ci-cd-pipeline.md
> - This document focuses on **Build & Deploy** processes (registry-first v9.0)

Family Budget использует **registry-first архитектуру**: все сборки (минификация, Docker build, кэшбастинг) происходят ТОЛЬКО в GitHub Actions CI/CD. На сервере - только pull готовых образов из GitHub Container Registry (ghcr.io) и запуск.

**BREAKING CHANGE (v9.0)**: Build mode полностью удален. Деплоймент скрипт поддерживает ТОЛЬКО pull образов из registry.

**Архитектура**: CI/CD-based delivery с обязательной Container Registry integration

## Ключевые изменения v9.0

**Удалено:**
- ❌ Локальная сборка на сервере (build mode)
- ❌ npm/Node.js на сервере (не требуется)
- ❌ Кэшбастинг на сервере (перенесен в CI)
- ❌ Множественные теги (test, sha-*, latest)
- ❌ Флаги --use-registry, --force-build, --image-tag

**Добавлено:**
- ✅ 5 кастомных образов (backend, bot, nginx, redis, postgresql)
- ✅ Multi-stage Dockerfile с embedded frontend
- ✅ Кэшбастинг в GitHub Actions
- ✅ Только semver теги (6.6.0)
- ✅ Автоматическая очистка старых образов (7 дней)
- ✅ Селективная пересборка (IMAGE_VERSIONS.json)

---

## CI/CD Workflows

### 1. Build and Push Docker Images (`build-and-push.yml`)

**Purpose**: Автоматическая сборка и публикация 5 Docker образов в ghcr.io при каждом push в test branch или создании git tag.

**Trigger**:
```yaml
on:
  push:
    branches: [test]
    tags: ['v*.*.*']
  workflow_dispatch:
    inputs:
      custom_tag:
        description: 'Custom image tag (optional)'
```

**Concurrency**: Только один workflow per branch (cancel-in-progress: true)

---

#### Job 1: Frontend Build

**Purpose**: Кэшбастинг и сборка frontend assets

**Steps**:
1. Checkout code с полной историей (fetch-depth: 0)
2. Setup Node.js 18 с npm cache
3. **Cache busting** (v10.0+: читает из VERSION файла):
   ```bash
   # v10.0+: Semantic versioning из VERSION файла
   CACHE_VERSION=$(cat VERSION | tr -d '[:space:]')
   bash scripts/ci/cache_busting_ci.sh "$CACHE_VERSION"
   # Обновляет ?v=PLACEHOLDER → ?v=10.0.23 в HTML templates

   # Legacy (до v10.0): git hash
   # CACHE_VERSION=$(git rev-parse --short HEAD)
   ```
   **Important:** VERSION файл должен быть обновлен вручную перед сборкой.
   Это обеспечивает строгий контроль версионирования и предсказуемость.

4. Install dependencies (`npm ci`)
5. Build frontend (`npm run build:prod`)
6. Check for changes (git diff)
7. Auto-commit built files (if changed) с `[skip ci]` tag

**Output**:
- Built files committed to test branch:
  - `frontend/web/static/js/dist/**`
  - `frontend/web/static/css/*.min.css`
  - Cache versions updated in templates

**Auto-commit message**:
```
chore(ci): auto-build frontend assets [skip ci]
```

**Note**: `[skip ci]` предотвращает infinite loop

**Cache Busting Script**: `scripts/ci/cache_busting_ci.sh`
- Заменяет PLACEHOLDER на git short hash
- Обрабатывает 26 HTML/template файлов
- Perl regex для CSS/JS путей

---

#### Job 2: Quality Checks

**Depends on**: frontend-build

**Purpose**: TypeScript, ESLint, Python mypy/ruff, unit tests

**Steps**:
1. Checkout code
2. Pull latest changes (чтобы получить frontend artifacts)
3. Setup Node.js 18
4. Install Node dependencies
5. **TypeScript type check** (`npm run type-check`)
6. **ESLint** (`npm run lint`)
7. Setup Python 3.11
8. Install Python dependencies
9. **Python mypy type check** (`mypy backend/`)
10. **Python ruff lint** (`ruff check backend/`)
11. **Unit tests** (`pytest tests/unit/ --cov`)
12. Upload coverage to Codecov

**Exit behavior**:
- Python checks: `continue-on-error: true` (не блокируют workflow)
- TypeScript/ESLint: блокирует workflow при ошибках
- Coverage upload: `fail_ci_if_error: false`

**ESLint Rules Strategy**:
- Все legacy code issues переведены в warnings (не errors)
- CI проходит без блокировки на legacy code
- Warnings видны в логах для постепенного исправления

---

#### Job 3: Build and Push (5 Images)

**Depends on**: quality-checks

**Purpose**: Сборка 5 Docker образов и публикация в ghcr.io

**Permissions**:
```yaml
permissions:
  contents: read
  packages: write
```

**Steps**:
1. Checkout code + pull latest changes
2. Read VERSION file
3. **Check image changes** (IMAGE_VERSIONS.json):
   ```bash
   bash scripts/ci/check_image_changes.sh backend  # build or skip?
   bash scripts/ci/check_image_changes.sh bot
   bash scripts/ci/check_image_changes.sh nginx
   bash scripts/ci/check_image_changes.sh redis
   bash scripts/ci/check_image_changes.sh postgresql
   ```
4. **Docker metadata** (для всех 5 образов):
   - Tags: ТОЛЬКО semver (6.6.0)
   - Labels: OCI-compliant metadata
5. Setup Docker Buildx
6. Login to ghcr.io
7. **Conditional builds** (только если изменения):
   - Build and push backend (if changes detected)
   - Build and push bot (if changes detected)
   - Build and push nginx (if changes detected)
   - Build and push redis (if changes detected)
   - Build and push postgresql (if changes detected)

**Image naming**:
- Backend: `ghcr.io/<owner>/familybudget-backend:6.6.0`
- Bot: `ghcr.io/<owner>/familybudget-bot:6.6.0`
- Nginx: `ghcr.io/<owner>/familybudget-nginx:6.6.0`
- Redis: `ghcr.io/<owner>/familybudget-redis:6.6.0`
- PostgreSQL: `ghcr.io/<owner>/familybudget-postgresql:6.6.0`

**Tags applied** (v9.0 - ТОЛЬКО semver):
```yaml
tags: |
  type=raw,value=${{ steps.version.outputs.VERSION }}
```

**Примеры тегов**:
- ✅ `6.6.0` (from VERSION file)
- ❌ `test` (УДАЛЕНО)
- ❌ `sha-abc1234` (УДАЛЕНО)
- ❌ `latest` (УДАЛЕНО)

**Build context**:
- Backend: `context: .`, `file: backend/Dockerfile`
- Bot: `context: .`, `file: bot/Dockerfile`
- Nginx: `context: nginx/`, `file: nginx/Dockerfile`
- Redis: `context: redis/`, `file: redis/Dockerfile`
- PostgreSQL: `context: postgres/`, `file: postgres/Dockerfile`

**Build args**:
```dockerfile
# backend/Dockerfile
VERSION=${{ steps.version.outputs.VERSION }}
PYTHON_VERSION=3.11
CACHE_VERSION=${{ env.CACHE_VERSION }}
```

**Cache strategy**:
- `cache-from: type=gha` (GitHub Actions cache)
- `cache-to: type=gha,mode=max`
- Layer cache между builds для скорости

**Multi-stage build (backend)**:
```dockerfile
# Stage 1: Python deps builder
FROM python:3.11-slim as python-builder
RUN pip install -r requirements.txt

# Stage 2: Frontend builder (НОВОЕ v9.0)
FROM node:18-alpine as frontend-builder
COPY frontend/ ./frontend/
RUN npm run build:prod

# Stage 3: Runtime (embedded frontend)
FROM python:3.11-slim
COPY --from=python-builder /opt/venv /opt/venv
COPY --from=frontend-builder /build/frontend/ /app/frontend/
```

**Selective rebuilding**:
- IMAGE_VERSIONS.json tracks git hash для каждого образа
- Skip сборки если нет изменений (экономия времени)
- Update hash после успешной сборки

---

#### Job 4: Security Scan

**Depends on**: build-push

**Purpose**: CVE scanning с Trivy на 5 собранных образах

**Permissions**:
```yaml
permissions:
  contents: read
  security-events: write
```

**Steps**:
1. Checkout code
2. Read VERSION
3. **Trivy scan** для каждого образа:
   - backend (format: SARIF, severity: CRITICAL,HIGH)
   - bot
   - nginx
   - redis
   - postgresql
4. Upload SARIF reports to GitHub Security tab

**Output**:
- SARIF reports uploaded to GitHub Code Scanning
- Vulnerabilities visible в Security → Code scanning tab

**Exit behavior**: `continue-on-error: true` (не блокирует workflow)

---

#### Job 5: Summary

**Depends on**: All previous jobs

**Condition**: `if: always()` (runs even if previous jobs failed)

**Purpose**: Итоговая сводка в GitHub Step Summary

**Output example**:
```markdown
## 🚀 CI/CD Pipeline Summary (v9.0)

**Version:** 6.6.0
**Commit:** abc1234567890def
**Branch/Tag:** test
**Cache Version:** abc1234

### Job Status
- Frontend Build: success ✅
- Quality Checks: success ✅
- Build & Push: success ✅ (5 images)
- Security Scan: success ✅

### Docker Images (Registry-First)
- ghcr.io/<owner>/familybudget-backend:6.6.0
- ghcr.io/<owner>/familybudget-bot:6.6.0
- ghcr.io/<owner>/familybudget-nginx:6.6.0
- ghcr.io/<owner>/familybudget-redis:6.6.0
- ghcr.io/<owner>/familybudget-postgresql:6.6.0

### Selective Build Results
- backend: built (changes detected)
- bot: skipped (no changes)
- nginx: skipped (no changes)
- redis: skipped (no changes)
- postgresql: skipped (no changes)
```

---

### 2. PR Quality Checks (`pr-checks.yml`)

**Purpose**: Валидация Pull Requests без сборки Docker образов

**Trigger**:
```yaml
on:
  pull_request:
    branches: [test, main]
    types: [opened, synchronize, reopened]
```

**Concurrency**: One workflow per PR

**Job**: quality-checks (single job)

**Steps**: Identical to main workflow Job 2 (TypeScript, ESLint, Python, tests)

**No Docker builds**: Только code validation, no image publishing

---

## Registry-First Deployment

### Image Pull from ghcr.io (v9.0 - ЕДИНСТВЕННЫЙ режим)

**deploy.sh** (simplified):
```bash
# ВСЕГДА registry mode, никаких флагов не требуется
./deploy.sh --sync-mode update --cleanup-mode smart
```

**Что происходит**:
1. Read VERSION file → `6.6.0`
2. Pull 5 images from ghcr.io:
   - `ghcr.io/<owner>/familybudget-backend:6.6.0`
   - `ghcr.io/<owner>/familybudget-bot:6.6.0`
   - `ghcr.io/<owner>/familybudget-nginx:6.6.0`
   - `ghcr.io/<owner>/familybudget-redis:6.6.0`
   - `ghcr.io/<owner>/familybudget-postgresql:6.6.0`
3. `docker compose up -d` (phased startup)
4. Run migrations
5. Health checks
6. **Cleanup old images** (>7 дней)

**Deployment time**: 2-3 минуты (ВСЕГДА)

---

### VERSION File (Manual Bump)

**ТРЕБОВАНИЕ**: VERSION файл ВСЕГДА bumps вручную (не автоматически)

**Примеры**:
```bash
# Feature release (minor)
echo "6.7.0" > VERSION
git add VERSION
git commit -m "feat: add shopping lists"
git push origin test

# Bug fix (patch)
echo "6.6.1" > VERSION
git add VERSION
git commit -m "fix: transfer deduplication"
git push origin test

# Breaking change (major)
echo "7.0.0" > VERSION
git add VERSION
git commit -m "BREAKING: ES modules migration"
git push origin test
```

**Semver Convention**:
- **MAJOR** (7.0.0): Breaking changes
- **MINOR** (6.7.0): New features (backwards-compatible)
- **PATCH** (6.6.1): Bug fixes

---

### Automatic Image Cleanup

**НОВОЕ в v9.0**: Автоматическое удаление старых Docker images

**Функция**: `cleanup_old_images()` в deploy.sh

**Когда запускается**: После успешного `docker compose up`

**Логика**:
1. Находит все Family Budget образы старше 7 дней
2. Исключает running containers из удаления
3. Удаляет старые образы
4. Логирует в `/opt/budget/logs/cleanup-history.log`

**Retention**: 7 дней (настраивается через `CLEANUP_RETENTION_DAYS`)

**Экономия дискового пространства**:
- 1 версия = ~1.2 GB (5 образов)
- 7 дней retention = ~7-8 GB
- Автоматическая очистка предотвращает disk full

**Log example**:
```
[2026-01-21T10:30:00Z] removed: ghcr.io/<owner>/familybudget-backend:6.5.0
[2026-01-21T10:30:01Z] removed: ghcr.io/<owner>/familybudget-bot:6.5.0
[2026-01-21T10:30:02Z] skipped: ghcr.io/<owner>/familybudget-backend:6.6.0 (running)
```

---

### Registry Functions (`scripts/lib/registry.sh`)

**Module location**: `scripts/lib/registry.sh`

#### pull_from_registry()

**Purpose**: Pull 5 Docker images from ghcr.io

**Usage**:
```bash
pull_from_registry  # Pulls all 5 images
```

**Algorithm**:
1. Read VERSION file → determine tag
2. Pull каждого образа: `docker pull ghcr.io/<owner>/familybudget-<service>:TAG`
3. Tag для docker-compose compatibility: `docker tag ... familybudget-<service>:TAG`
4. Log deployment history

**Services pulled** (v9.0):
- backend
- bot
- nginx
- redis
- postgresql

**Exit code**:
- 0: Success (all 5 images pulled)
- 1: Pull failed for at least one service

---

#### validate_registry_images()

**Purpose**: Проверка существования образов в registry **без pull**

**Usage**:
```bash
validate_registry_images  # Validates all 5 images
```

**Algorithm**:
1. For each service: `docker manifest inspect ghcr.io/<owner>/familybudget-<service>:TAG`
2. If any image missing: print error + exit 1

**Error output**:
```
✗ backend image NOT found in registry: ghcr.io/<owner>/familybudget-backend:6.6.0

Possible solutions:
  1. Check VERSION file matches GitHub Actions build
  2. Verify GitHub Actions workflow completed successfully
  3. Wait for CI/CD to finish building images (5-7 min)
```

---

#### log_deployment_history()

**Purpose**: Track deployment в лог файле

**Log location**: `/opt/budget/logs/deployment-history.log`

**Format** (v9.0):
```
[2026-01-21 10:30:00] mode=registry tag=6.6.1 result=success user=admin
[2026-01-20 22:15:00] mode=registry tag=6.6.0 result=success user=admin
```

**Retention**: Last 100 entries

---

### Modified Deployment Flow

**File**: `scripts/lib/services.sh` (функция `start_application_services()`)

**Registry-Only Mode** (v9.0):
```bash
# ВСЕГДА registry mode (no build option)
pull_from_registry  # Pull 5 images

# Docker Compose up (NO --build flag)
docker compose up -d --force-recreate backend bot nginx redis postgres
```

**Phased Startup**:
1. PostgreSQL (wait until healthy)
2. Redis (wait until healthy)
3. Backend (wait until healthy)
4. Migrations (Alembic upgrade head)
5. Bot + Nginx

**Health check timeouts**:
- PostgreSQL: 30s
- Redis: 10s
- Backend: 60s

---

### Server Deployment Process (v9.0+ Registry-First)

#### Критические изменения v9.0

**Что НЕ происходит на сервере:**
- ❌ NO npm/Node.js (не требуется для production)
- ❌ NO локальные builds (frontend, Docker)
- ❌ NO валидация артефактов на сервере
- ❌ NO кэшбастинг (выполнен в CI)

**Что происходит на сервере:**
- ✅ ТОЛЬКО pull from ghcr.io
- ✅ Запуск Docker контейнеров
- ✅ Миграции БД
- ✅ Health checks
- ✅ Cleanup старых образов

---

#### Deployment Flow (Step-by-Step)

**Команда**:
```bash
cd ~/familyBudget
git pull origin test
sudo bash deploy.sh --sync-mode update --cleanup-mode smart
```

**Что происходит:**

**1. Чтение IMAGE_VERSIONS.json**
- Файл содержит версии каждого сервиса
- Генерируется автоматически в CI/CD
- Пример:
  ```json
  {
    "backend": { "version": "6.6.0", "digest": "sha256:..." },
    "bot": { "version": "6.6.0", "digest": "sha256:..." },
    "nginx": { "version": "6.6.0", "digest": "sha256:..." },
    "redis": { "version": "6.6.0", "digest": "sha256:..." },
    "postgresql": { "version": "6.6.0", "digest": "sha256:..." }
  }
  ```

**2. Pull Docker Images from ghcr.io**
```bash
# Автоматически pull'ятся 5 образов
docker pull ghcr.io/ikeniborn/familybudget-backend:6.6.0
docker pull ghcr.io/ikeniborn/familybudget-bot:6.6.0
docker pull ghcr.io/ikeniborn/familybudget-nginx:6.6.0
docker pull ghcr.io/ikeniborn/familybudget-redis:6.6.0
docker pull ghcr.io/ikeniborn/familybudget-postgresql:6.6.0
```

**3. Генерация .env**
- Версии из IMAGE_VERSIONS.json → .env переменные
- Пример .env:
  ```bash
  BACKEND_VERSION=6.6.0
  BOT_VERSION=6.6.0
  NGINX_VERSION=6.6.0
  REDIS_VERSION=6.6.0
  POSTGRESQL_VERSION=6.6.0
  ```

**4. Phased Startup**
- **Phase 1**: PostgreSQL only
  - `docker compose up -d postgres`
  - Wait for healthy status (30s timeout)
- **Phase 1.2**: Redis only
  - `docker compose up -d redis`
  - Wait for healthy status (10s timeout)
- **Phase 1.5**: Backend only
  - `docker compose up -d backend`
  - Wait for healthy status (60s timeout)
- **Migration**: Alembic upgrade head
  - Runs in backend container
  - SQL DDL/DML changes applied
- **Phase 2**: Bot + Nginx
  - `docker compose up -d bot nginx`
  - Final health checks

**5. Health Checks**
- Verify all containers healthy
- Test backend health endpoint: `GET /health`
- Verify Service Worker version in HTML
- Log deployment success

**6. Cleanup**
- Remove old images (>7 days retention)
- Cleanup dangling images
- Log cleanup history

**Время деплоя**: ВСЕГДА 2-3 минуты (только pull + startup)

---

#### Что НЕ требуется на сервере (v9.0)

**Dependencies:**
- ❌ Node.js
- ❌ npm
- ❌ Python build tools (gcc, make)
- ❌ Build essentials
- ❌ Любые компиляторы

**Requirements:**
- ✅ Docker 20.10+
- ✅ Docker Compose v2
- ✅ Git (для git pull)
- ✅ ghcr.io access (GitHub Container Registry)

---

#### Legacy Functions Removed (v9.0)

**deploy.sh**:
- `repair_npm_environment()` - npm не требуется
- `validate_build_artifacts()` - артефакты в Docker образах
- npm install sync блок - зависимости в образах
- Pre-flight npm checks - заменено на Docker daemon check

**scripts/lib/services.sh**:
- `--build` flag logic - локальная сборка удалена
- Build strategy блок - всегда registry mode
- Registry mode check - registry mode единственный вариант

**Total removed**: ~345 строк legacy кода

---

## Workflow Execution Times

| Job | Approx Duration (v9.0) |
|-----|------------------------|
| Frontend Build (с cache busting) | 1m30s - 2m |
| Quality Checks | 1m - 1m20s |
| Build & Push (5 images, selective) | 2m - 4m |
| Security Scan (5 images) | 1m - 1m30s |
| Summary | 5s |

**Total CI/CD time**: ~5-8 минут (зависит от selective build)

**Server deployment time**: 2-3 минуты (ВСЕГДА, только pull)

---

## Docker Image Sizes & Optimization

**Production images (v9.0)**:
- **Backend**: ~500 MB (multi-stage + embedded frontend)
- **Bot**: ~400 MB
- **Nginx**: ~50 MB (nginx:alpine)
- **Redis**: ~40 MB (redis:7-alpine)
- **PostgreSQL**: ~250 MB (postgres:16-alpine)
- **Total**: ~1.2 GB на версию

**First deployment pull**: ~1.2 GB
**Subsequent deployments**: ~50-200 MB (только измененные слои)

**Optimization strategies**:
1. **.dockerignore**: Уменьшение build context на 30-50%
   - Исключает: .git, docs/, tests/, node_modules/, logs/, .env
2. **Multi-stage builds**: Separate builder и runtime stages
3. **Layer caching**: Dependencies cached отдельно от code
4. **Alpine base images**: Minimal size для nginx, redis, postgresql

**Build time (code change only)**: ~30-60 seconds (благодаря layer caching)

---

## Registry Credentials & Permissions

**Authentication**: `GITHUB_TOKEN` (automatic)

**Required secrets**: None (GITHUB_TOKEN provided automatically)

**Permissions**:
```yaml
permissions:
  contents: read    # Read repository code
  packages: write   # Push images to ghcr.io
```

**Registry visibility**: Inherits repository visibility
- Private repo → Private images
- Public repo → Public images

**Image pull**:
- Public images: ✅ Yes (unauthenticated)
- Private images: ❌ No (requires `docker login ghcr.io`)

**Server authentication** (для приватных репозиториев):
```bash
docker login ghcr.io
Username: <github_username>
Password: <github_personal_access_token>
```

---

## Deployment Scenarios

### Scenario 1: Test Server (Registry-Only)

**Server**: `budget-test`

**Workflow**:
1. Bump VERSION locally:
   ```bash
   echo "6.6.1" > VERSION
   git add VERSION
   git commit -m "chore: bump to 6.6.1"
   git push origin test
   ```
2. ⏳ GitHub Actions builds images → ghcr.io (5-8 min)
3. SSH to budget-test:
   ```bash
   ssh budget-test
   cd ~/familyBudget
   git pull origin test
   sudo ./deploy.sh --sync-mode update --cleanup-mode smart
   ```
4. Images pulled from ghcr.io:6.6.1 (2-3 min)

**Benefits**:
- ✅ Fast deployment (2-3 min)
- ✅ Consistent images (same as CI built)
- ✅ No Node.js/npm on server
- ✅ No build artifacts on server

---

### Scenario 2: Production Server (Registry-Only)

**Server**: `budget-prod`

**Workflow**:
1. **ОБЯЗАТЕЛЬНО**: Тестирование на budget-test (минимум 1 неделя)
2. После успешного теста → Production:
   ```bash
   ssh budget-prod
   cd ~/familyBudget
   git pull origin test
   sudo ./deploy.sh --sync-mode update --cleanup-mode smart
   ```
3. Использует ТОТ ЖЕ VERSION что на budget-test
4. Pull тех же образов из ghcr.io (проверенные)

**Benefits**:
- ✅ Консистентность: Те же образы что на test
- ✅ Безопасность: Нет сборки на production
- ✅ Скорость: 2-3 минуты
- ✅ Надежность: Образы проверены через CI/CD + test

---

### Scenario 3: Rollback (Emergency)

**Workflow**:
```bash
# Production сломан, быстрый откат
ssh budget-prod
echo "6.6.0" > /opt/budget/VERSION
sudo bash deploy.sh

# Что происходит:
# 1. Read VERSION → 6.6.0
# 2. Pull образов 6.6.0 из ghcr.io
# 3. docker compose up -d
# Время: 2-3 минуты
```

**Benefits**:
- ✅ Быстрый rollback без пересборки
- ✅ Образы всех предыдущих версий в ghcr.io
- ✅ Данные сохранены (postgres_data, redis_data)

---

## Troubleshooting

### Issue 1: VERSION файл не изменился

**Warning в GitHub Actions**:
```
VERSION не изменился (6.6.0), но есть коммиты.
Рекомендуется bump VERSION.
```

**Причина**: VERSION файл не был изменен перед push

**Решение**:
```bash
echo "6.6.1" > VERSION
git add VERSION
git commit --amend --no-edit
git push -f origin test
```

---

### Issue 2: Image Pull Fails

**Ошибка**:
```
✗ Failed to pull backend image: ghcr.io/<owner>/familybudget-backend:6.6.1
Error: manifest for ghcr.io/<owner>/familybudget-backend:6.6.1 not found
```

**Решения**:
1. Проверьте GitHub Actions:
   ```
   https://github.com/<owner>/familyBudget/actions
   # "Build and Push Docker Images" должен быть success
   ```

2. Проверьте VERSION bump committed:
   ```bash
   git log --oneline -1
   # Должен содержать VERSION 6.6.1
   ```

3. Проверьте наличие образа:
   ```bash
   docker manifest inspect ghcr.io/<owner>/familybudget-backend:6.6.1
   # Если "manifest unknown" - образ не собран
   ```

4. Для приватных репозиториев:
   ```bash
   docker login ghcr.io
   ```

---

### Issue 3: CI/CD Workflow Fails on ESLint

**Error**:
```
✖ 19041 problems (297 errors, 18744 warnings)
```

**Solution**: ESLint rules already configured as warnings (Phase 1 complete)

If new errors appear:
1. Check `eslint.config.js` rules
2. Add problematic rule as warning: `"rule-name": "warn"`
3. Commit and push

---

### Issue 4: Frontend Build Not Committed

**Symptom**: Quality checks fail, built files missing

**Cause**: Build changed but auto-commit didn't trigger

**Solution**:
1. Check frontend-build job logs
2. Verify `[skip ci]` в commit message
3. Manually trigger workflow: Actions → Build and Push → Run workflow

---

### Issue 5: Docker Build Cache Miss

**Symptom**: Build takes 5-8 min (should be ~2-3 min)

**Cause**: GitHub Actions cache invalidated

**Solution**: Normal behavior, cache will rebuild
- First build after cache clear: 5-8 min
- Subsequent builds: 2-4 min

---

### Issue 6: Старые образы не удаляются

**Symptom**: Много старых образов (>7 дней)

**Проверка**:
```bash
docker images | grep familybudget
```

**Решение**:
```bash
# Ручной запуск cleanup
cd /opt/budget
source deploy.sh
cleanup_old_images 7

# Или изменить retention
echo "CLEANUP_RETENTION_DAYS=3" >> .env
```

---

### Issue 7: Frontend статика не отдается

**Ошибка**:
```
404 Not Found: /static/css/tailwind-daisyui.min.css
```

**Причина**: Backend должен отдавать статику через FastAPI StaticFiles

**Решение**:
1. Проверьте frontend в backend образе:
   ```bash
   docker exec familybudget-backend ls -lh /app/frontend/web/static/css/
   ```

2. Проверьте backend логи:
   ```bash
   docker logs familybudget-backend | grep StaticFiles
   ```

3. Проверьте nginx (НЕ должно быть location /static/):
   ```bash
   docker exec familybudget-nginx cat /etc/nginx/conf.d/app-https.conf
   # НЕ должно быть: location /static/ { alias ... }
   ```

---

### Issue 8: Disk Space Full

**Ошибка**:
```
Error: write /var/lib/docker: no space left on device
```

**Решение**:
```bash
# Проверка места
df -h /var/lib/docker

# Удаление старых образов (>7 дней)
docker image prune -a --filter "until=168h"

# Удаление dangling images
docker image prune -f

# ОСТОРОЖНО: удаление unused volumes
docker volume prune -f
```

---

## Security Considerations

### Image Signing (Future Enhancement)

**Current**: Images not signed

**Planned**: Cosign integration
```yaml
- name: Sign image with Cosign
  run: cosign sign ghcr.io/<owner>/familybudget-backend:$TAG
```

---

### Secret Scanning

**Trivy**: Scans for secrets in images (всех 5)
**Gitleaks**: Scans git history

**Prevention**: Never commit secrets
- Use `.env` files (gitignored)
- Use GitHub Secrets для CI/CD
- Use environment variables в production

---

### Vulnerability Monitoring

**Automated**: Trivy scan on every push (5 images)

**Manual**: GitHub Security tab → Code scanning

**Response SLA**:
- CRITICAL: Fix within 24h
- HIGH: Fix within 1 week
- MEDIUM: Fix within 1 month

---

## Metrics & Monitoring

**Recommended metrics**:

1. **Deployment frequency**: Как часто images deployed
2. **Lead time**: Время от commit до deployment
3. **Change failure rate**: % of deployments causing issues
4. **Mean time to recovery**: Время до rollback/fix
5. **Image pull time**: Average pull time для 5 images
6. **Selective build ratio**: % of skipped builds

**GitHub Actions Insights**:
- Actions → Workflows → Build and Push → View runs
- Filter by status/branch/time

**Deployment history**:
```bash
# На сервере
tail -20 /opt/budget/logs/deployment-history.log
tail -20 /opt/budget/logs/cleanup-history.log
```

---

## Architecture Diagrams

### Build & Deploy Flow (v9.0)

```
Developer (local)          GitHub Actions (CI/CD)         Server (budget-test/prod)
─────────────────          ──────────────────────         ─────────────────────────

1. Bump VERSION
   echo "6.6.1" > VERSION
   git commit
   git push origin test
        │
        └──────────────────> 2. Cache Busting
                                bash cache_busting_ci.sh

                             3. Frontend Build
                                npm run build:prod

                             4. Check Image Changes
                                (IMAGE_VERSIONS.json)

                             5. Docker Build (5 images)
                                ├─ backend (multi-stage)
                                ├─ bot
                                ├─ nginx
                                ├─ redis
                                └─ postgresql

                             6. Push to ghcr.io:6.6.1

                             7. Trivy Security Scan (5)
                                       │
                                       └────────────────> 8. Pull Images
                                                             (ghcr.io:6.6.1)

                                                          9. docker compose up

                                                          10. Migrations

                                                          11. Health Checks

                                                          12. Cleanup (7d)
```

---

### Multi-Stage Dockerfile (backend)

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: python-builder                                     │
│ FROM python:3.11-slim                                       │
│ ├─ Install build dependencies (gcc, libpq-dev)             │
│ ├─ Create venv: /opt/venv                                  │
│ └─ pip install requirements.txt                            │
│     Size: ~300 MB (discarded)                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: frontend-builder                                   │
│ FROM node:18-alpine                                         │
│ ├─ CACHE_VERSION from git hash                             │
│ ├─ npm ci                                                   │
│ ├─ COPY frontend/ (source)                                 │
│ └─ npm run build:prod                                       │
│     Output: frontend/web/static/js/dist/*.min.js           │
│             frontend/web/static/css/*.min.css              │
│     Size: ~500 MB (discarded)                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: runtime                                            │
│ FROM python:3.11-slim                                       │
│ ├─ Install runtime deps (libpq5, curl, ca-certs)           │
│ ├─ COPY --from=python-builder /opt/venv                    │
│ ├─ COPY backend/ (source code)                             │
│ ├─ COPY --from=frontend-builder /build/frontend/ (BUILT!)  │
│ ├─ COPY --from=frontend-builder sw.min.js, manifest.json   │
│ ├─ Create appuser (non-root)                               │
│ ├─ mkdir logs/, uploads/                                   │
│ └─ CMD ["uvicorn", "backend.app.main:app"]                 │
│     Final Size: ~500 MB                                    │
└─────────────────────────────────────────────────────────────┘
```

**Key Points**:
- Frontend embedded в backend image (no bind mounts)
- Cache versions уже обновлены в CI
- Non-root user (appuser)
- Health check included

---

## Future Enhancements

### Phase 3: Blue-Green Deployment

**Plan**:
1. Deploy новой версии parallel к старой
2. Switch traffic через nginx upstream
3. Monitor metrics
4. Rollback if issues

### Phase 4: Canary Releases

**Plan**:
1. Deploy новой версии для 10% traffic
2. Gradually increase to 100%
3. Auto-rollback on error rate spike

### Phase 5: Image Promotion Pipeline

**Plan**:
1. test → staging → production tags
2. Manual approval gates
3. Automated smoke tests после promotion

---

## Related Documentation

- **CI/CD Summary**: [CI-CD-REGISTRY-SUMMARY.md](../../CI-CD-REGISTRY-SUMMARY.md)
- **Docker Architecture**: [docker.md](../core/docker.md) (v9.0 - NEW)
- **Build System**: [build-system.md](./build-system.md)
- **Deployment Troubleshooting**: [deployment-troubleshooting.md](./guides/deployment-troubleshooting.md)
- **Build Mode Archive**: [archive/README-ARCHIVE.md](../../archive/README-ARCHIVE.md)

---

**Last Updated**: 2026-01-21
**Maintainer**: Family Budget Team
**Version**: 2.0 (Registry-First Architecture)
**Breaking Changes**: Build mode removed, 5 custom images, semver-only tags
