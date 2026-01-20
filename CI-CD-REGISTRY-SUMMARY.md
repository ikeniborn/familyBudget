# Registry-First Architecture: CI/CD Integration (v9.0.0)

## Краткое описание

**BREAKING CHANGE:** Build mode полностью удален. Все сборки (минификация, Docker build, кэшбастинг) происходят ТОЛЬКО в GitHub Actions CI/CD. На сервере - только pull готовых образов из ghcr.io и запуск.

## BREAKING CHANGES (v8.0 → v9.0)

**Удалено:**
- ❌ Build mode (локальная сборка на сервере)
- ❌ Флаг `--use-registry` (теперь default и единственный режим)
- ❌ Флаг `--force-build` (нет локальной сборки)
- ❌ Флаг `--image-tag` (используется VERSION файл)
- ❌ Множественные теги (`test`, `sha-abc1234`, `latest`)
- ❌ npm/Node.js на сервере (не требуется)
- ❌ Кэшбастинг на сервере (перенесен в CI)

**Добавлено:**
- ✅ Registry-only mode (ЕДИНСТВЕННЫЙ режим)
- ✅ Только semver теги (6.6.0)
- ✅ Ручной VERSION bump (manual semver)
- ✅ 5 кастомных образов (backend, bot, nginx, redis, postgresql)
- ✅ Multi-stage Dockerfile с embedded frontend
- ✅ Кэшбастинг в GitHub Actions
- ✅ Автоматическая очистка старых образов (7 дней retention)
- ✅ Селективная пересборка образов (IMAGE_VERSIONS.json)

---

## Ключевые преимущества

**⚡ Скорость:**
- **v8.0 registry mode:** 2-3 минуты (pull + up)
- **v9.0 registry-only:** 2-3 минуты (ВСЕГДА)
- **v7.0 build mode:** 5-7 минут (УДАЛЕН)

**✅ Консистентность:**
- Те же образы что прошли CI/CD проверки (ESLint, TypeScript, pytest, Trivy)
- Гарантированное качество (все проверки в GitHub Actions)
- Production = Test = CI образы (одинаковые binaries)

**🚀 Простота:**
- Не требуется Node.js/npm на сервере
- Не требуется npm build на сервере
- Не требуется кэшбастинг на сервере
- Автоматическая очистка старых образов

**🔒 Безопасность:**
- Нет сборки на production (меньше риска)
- Образы проверены Trivy security scan
- Минимальная attack surface на сервере

**📦 5 кастомных образов:**
- `ghcr.io/ikeniborn/familybudget-backend:6.6.0`
- `ghcr.io/ikeniborn/familybudget-bot:6.6.0`
- `ghcr.io/ikeniborn/familybudget-nginx:6.6.0`
- `ghcr.io/ikeniborn/familybudget-redis:6.6.0`
- `ghcr.io/ikeniborn/familybudget-postgresql:6.6.0`

---

## Как это работает

### Workflow (Manual VERSION Bump)

```
Developer (local)                GitHub Actions               Server (budget-test/prod)
─────────────────                ──────────────               ─────────────────────────

1. Bump VERSION manually
   echo "6.6.1" > VERSION
   git add VERSION
   git commit -m "chore: bump to 6.6.1"
   git push origin test
                                    ↓
                              2. CI/CD starts (5-7 min)
                                 ├─ Cache busting (git hash)
                                 ├─ Frontend build (npm run build:prod)
                                 ├─ Docker build (5 images)
                                 │  ├─ backend (multi-stage + embedded frontend)
                                 │  ├─ bot
                                 │  ├─ nginx
                                 │  ├─ redis
                                 │  └─ postgresql
                                 ├─ Push to ghcr.io:6.6.1
                                 └─ Trivy security scan
                                    ↓
                                                        3. Server deployment (2-3 min)
                                                           ├─ Read VERSION file → 6.6.1
                                                           ├─ Pull 5 images from ghcr.io
                                                           ├─ docker compose up -d
                                                           ├─ Run migrations
                                                           ├─ Health checks
                                                           └─ Cleanup old images (7d retention)
```

### 1. Developer: Manual VERSION Bump

**ТРЕБОВАНИЕ:** VERSION файл ВСЕГДА bumps вручную перед push.

```bash
# Локально
echo "6.6.1" > VERSION  # ОБЯЗАТЕЛЬНО ручной bump
git add VERSION
git commit -m "chore: bump version to 6.6.1"
git push origin test
```

**Semver Convention:**
- **MAJOR** (7.0.0): Breaking changes
- **MINOR** (6.7.0): New features
- **PATCH** (6.6.1): Bug fixes

### 2. GitHub Actions: CI/CD Build (5-7 min)

При push в `test` branch или создании git tag:

1. **Cache Busting (CI)**
   ```bash
   CACHE_VERSION=$(git rev-parse --short HEAD)
   bash scripts/ci/cache_busting_ci.sh "$CACHE_VERSION"
   # Обновляет ?v=PLACEHOLDER → ?v=abc1234 в HTML templates
   ```

2. **Frontend Build**
   ```bash
   npm ci
   npm run build:prod
   # Минификация CSS/JS уже с обновленными cache versions
   ```

3. **Docker Build (multi-stage)**
   ```dockerfile
   # backend/Dockerfile:
   # Stage 1: Python deps builder
   # Stage 2: Frontend builder (npm run build:prod)
   # Stage 3: Runtime (COPY --from=frontend-builder)
   ```

4. **Push to ghcr.io**
   ```
   ghcr.io/ikeniborn/familybudget-backend:6.6.1
   ghcr.io/ikeniborn/familybudget-bot:6.6.1
   ghcr.io/ikeniborn/familybudget-nginx:6.6.1
   ghcr.io/ikeniborn/familybudget-redis:6.6.1
   ghcr.io/ikeniborn/familybudget-postgresql:6.6.1
   ```

5. **Conditional Builds (IMAGE_VERSIONS.json)**
   - Проверяет git hash для каждого образа
   - Skip сборки если нет изменений
   - Пересобирает только измененные образы

6. **Security Scan**
   ```bash
   trivy image ghcr.io/ikeniborn/familybudget-backend:6.6.1
   # CVE scanning, vulnerability report
   ```

### 3. Server: Registry Pull (2-3 min)

```bash
# SSH на budget-test
ssh budget-test
cd ~/familyBudget
git pull origin test

# Деплой (ВСЕГДА registry mode)
sudo ./deploy.sh --sync-mode update --cleanup-mode smart

# Что происходит:
# 1. Читает VERSION файл → 6.6.1
# 2. Pull 5 образов из ghcr.io:6.6.1
# 3. docker compose up -d
# 4. Run migrations
# 5. Health checks
# 6. Cleanup старых образов (>7 дней)
```

---

## Как использовать

### Вариант 1: Через deploy-test skill (рекомендуется)

```
Пользователь: "Задеплой на тестовый сервер"
```

Claude автоматически:
1. Проверит SSH подключение
2. Сделает git pull на сервере
3. Запустит `deploy.sh --sync-mode update --cleanup-mode smart`
4. Проанализирует логи
5. Проверит статус контейнеров
6. Выведет итоговый отчет

**Интерактивный диалог больше НЕ спрашивает про --use-registry** (default behavior)

### Вариант 2: Вручную (на сервере)

```bash
# SSH на budget-test
ssh budget-test
cd ~/familyBudget
git pull origin test

# Деплой (registry mode - ЕДИНСТВЕННЫЙ режим)
sudo ./deploy.sh --sync-mode update --cleanup-mode smart
```

**Дополнительные опции:**
```bash
# С версионированием (VERSION bump на сервере)
sudo ./deploy.sh --version patch  # 6.6.0 → 6.6.1

# Verbose режим
sudo ./deploy.sh --verbose
```

### Вариант 3: VERSION Bump Workflow

**ВАЖНО:** VERSION файл ВСЕГДА bumps вручную (не автоматически)

```bash
# Feature release (minor)
echo "6.7.0" > VERSION
git add VERSION
git commit -m "feat: add shopping lists feature"
git push origin test

# Bug fix (patch)
echo "6.6.1" > VERSION
git add VERSION
git commit -m "fix: correct transfer deduplication"
git push origin test

# Breaking change (major)
echo "7.0.0" > VERSION
git add VERSION
git commit -m "BREAKING: migrate to ES modules"
git push origin test
```

---

## Автоматическая очистка старых образов

**НОВОЕ в v9.0:** Автоматическое удаление старых Docker images после каждого деплоя.

### Как работает

```bash
# В deploy.sh после успешного docker compose up:
cleanup_old_images 7  # Retention: 7 дней
```

**Логика:**
1. Находит все Family Budget образы старше 7 дней
2. Исключает running containers из удаления
3. Удаляет старые образы
4. Логирует в `/opt/budget/logs/cleanup-history.log`

**Пример:**
```
[2026-01-21T10:30:00Z] removed: ghcr.io/ikeniborn/familybudget-backend:6.5.0
[2026-01-21T10:30:01Z] removed: ghcr.io/ikeniborn/familybudget-bot:6.5.0
[2026-01-21T10:30:02Z] skipped: ghcr.io/ikeniborn/familybudget-backend:6.6.0 (running)
```

**Экономия дискового пространства:**
- Backend image: ~500 MB
- Bot image: ~400 MB
- Nginx image: ~50 MB
- Redis image: ~40 MB
- PostgreSQL image: ~250 MB
- **Total:** ~1.2 GB на версию

При retention 7 дней и 1 деплое в день: **Экономия ~7 GB** после недели

**Настройка retention:**
```bash
# В .env
CLEANUP_RETENTION_DAYS=7  # Default: 7 дней
```

---

## Rollback

### Вариант 1: Откат через VERSION файл (быстрый)

```bash
# На сервере
echo "6.6.0" > /opt/budget/VERSION
sudo bash deploy.sh

# Что происходит:
# 1. Читает VERSION → 6.6.0
# 2. Pull образов 6.6.0 из ghcr.io (если нет локально)
# 3. docker compose up -d
# Время: 2-3 минуты
```

### Вариант 2: Откат через git (полный)

```bash
# На сервере
cd ~/familyBudget
git log --oneline -5
# abc1234 fix: broken feature (CURRENT)
# def5678 feat: working version (ROLLBACK TO THIS)

git reset --hard def5678
git push -f origin test  # Опасно! Только для test сервера

sudo bash deploy.sh
# Pull образов версии из def5678 коммита
```

### Вариант 3: Аварийный откат (локальные образы)

```bash
# Если registry недоступен
docker images | grep familybudget
# ghcr.io/ikeniborn/familybudget-backend:6.6.0
# ghcr.io/ikeniborn/familybudget-backend:6.5.0  ← откатимся

# Ручной запуск с предыдущей версией
VERSION=6.5.0 docker compose up -d
```

---

## Что изменилось в файлах (v9.0)

### Новые файлы:
1. **`scripts/ci/cache_busting_ci.sh`** - CI-совместимый cache busting
2. **`scripts/ci/check_image_changes.sh`** - Определение какие образы пересобирать
3. **`.dockerignore`** - Оптимизация Docker build context (30-50% меньше)
4. **`IMAGE_VERSIONS.json`** - Версионирование каждого образа отдельно
5. **`nginx/Dockerfile`** - Кастомный nginx образ
6. **`redis/Dockerfile`** - Кастомный redis образ
7. **`postgres/Dockerfile`** - Кастомный postgresql образ
8. **`docker-compose.dev.yml`** - Dev overrides для локальной разработки
9. **`archive/README-ARCHIVE.md`** - Документация build mode (бэкап)

### Полностью переписанные файлы:
1. **`backend/Dockerfile`** - Multi-stage build (python-builder → frontend-builder → runtime)
2. **`.github/workflows/build-and-push.yml`** - 5 образов, semver tags, cache busting
3. **`docker-compose.yml`** - Удалены build секции, только registry images
4. **`deploy.sh`** - Удалено 451 строк build logic, добавлен cleanup_old_images()
5. **`scripts/lib/registry.sh`** - Pull 5 образов вместо 2

### Обновленные файлы:
1. **`nginx/conf.d/app-https.conf.template`** - Удалена секция /static/ (backend отдает)
2. **`.claude/skills/deploy-test/SKILL.md`** - v9.0.0, registry-only
3. **`.claude/skills/deploy-prod/SKILL.md`** - v9.0.0, production safety requirements
4. **`CI-CD-REGISTRY-SUMMARY.md`** - Этот документ (v9.0.0)

### Удаленные возможности:
- ~~`deploy.sh --force-build`~~ (нет локальной сборки)
- ~~`deploy.sh --use-registry`~~ (default behavior)
- ~~`deploy.sh --image-tag`~~ (используется VERSION файл)
- ~~npm build на сервере~~ (все в CI)
- ~~cache busting на сервере~~ (все в CI)
- ~~Bind mounts для кода в docker-compose.yml~~ (код в образах)

### Сохраненные volumes:
✅ `postgres_data` - данные PostgreSQL
✅ `redis_data` - данные Redis
✅ `./logs` - логи приложения
✅ `./uploads` - загруженные файлы
✅ `nginx_cache` - кэш nginx

---

## Требования для deployment (v9.0)

### GitHub (CI/CD):
- ✅ GitHub Actions workflow успешно завершился
- ✅ Образы опубликованы в ghcr.io:${VERSION}
- ✅ VERSION файл bump вручную перед push
- ✅ Trivy security scan прошел

### Server (budget-test/prod):
- ✅ Docker установлен (версия 20.10+)
- ✅ Docker Compose V2 (версия 2.0+)
- ✅ Docker аутентифицирован в ghcr.io (для приватных репозиториев):
  ```bash
  docker login ghcr.io
  Username: <github_username>
  Password: <github_personal_access_token>
  ```
- ✅ VERSION файл существует в /opt/budget/VERSION
- ❌ npm/Node.js НЕ требуются (все в CI)

---

## Production Safety Requirements

**CRITICAL для production (budget-prod):**

1. ✅ **ОБЯЗАТЕЛЬНО тестирование на budget-test** (минимум 1 неделя)
2. ✅ Проверка всех критических функций на тесте
3. ✅ Анализ логов budget-test на ошибки
4. ✅ Мониторинг метрик (CPU, memory, disk)
5. ✅ GitHub Actions build MUST complete successfully
6. ✅ Images MUST exist in ghcr.io:${VERSION}
7. ✅ VERSION совпадает с протестированным на budget-test

**Workflow (Production-Safe):**
```bash
# 1. Test на budget-test (1 неделя)
ssh budget-test
cd ~/familyBudget
sudo ./deploy.sh --version patch
# ... Тестирование 1 неделя ...
# ... Мониторинг логов, метрик ...
# ... Проверка всех функций ...

# 2. После успешного теста → Production
ssh budget-prod
cd ~/familyBudget
sudo ./deploy.sh  # Использует ТОТ ЖЕ VERSION
```

**Преимущества:**
- ✅ Консистентность: Те же образы что на test (проверены)
- ✅ Безопасность: Нет сборки на production
- ✅ Надежность: Образы проверены через CI/CD + test сервер

---

## Примеры workflow

### Workflow 1: Feature Release

```bash
# Локально
echo "6.7.0" > VERSION
git add VERSION backend/ frontend/
git commit -m "feat: add shopping lists feature"
git push origin test

# ⏳ Ждем GitHub Actions (5-7 мин)
# Проверяем: https://github.com/user/familyBudget/actions

# Деплой на budget-test
ssh budget-test
cd ~/familyBudget
git pull origin test
sudo ./deploy.sh

# Тестирование (1 неделя)
# ...

# Деплой на budget-prod
ssh budget-prod
cd ~/familyBudget
git pull origin test
sudo ./deploy.sh
```

**Результат:** Консистентный деплой одинаковых образов на test и prod

### Workflow 2: Hotfix (patch release)

```bash
# Локально
echo "6.6.1" > VERSION
git add VERSION backend/
git commit -m "fix: correct transfer deduplication bug"
git push origin test

# ⏳ GitHub Actions (5-7 мин)

# Деплой на budget-test (проверка hotfix)
ssh budget-test
cd ~/familyBudget
git pull origin test
sudo ./deploy.sh

# После проверки → Production
ssh budget-prod
cd ~/familyBudget
git pull origin test
sudo ./deploy.sh
```

### Workflow 3: Emergency Rollback

```bash
# Production сломан, нужен быстрый откат
ssh budget-prod
echo "6.6.0" > /opt/budget/VERSION
sudo bash deploy.sh

# Pull образов 6.6.0 из ghcr.io
# Перезапуск контейнеров
# Время: 2-3 минуты
```

---

## Troubleshooting

### Проблема 1: VERSION файл не изменился

**Ошибка:**
```
GitHub Actions Warning: VERSION не изменился (6.6.0), но есть коммиты.
Рекомендуется bump VERSION.
```

**Решение:**
```bash
# Bump VERSION вручную
echo "6.6.1" > VERSION  # patch bump для bug fix
git add VERSION
git commit --amend --no-edit
git push -f origin test
```

### Проблема 2: Image pull fails

**Ошибка:**
```
✗ Failed to pull backend image: ghcr.io/ikeniborn/familybudget-backend:6.6.1
Error response from daemon: manifest for ghcr.io/ikeniborn/familybudget-backend:6.6.1 not found
```

**Решения:**
1. Проверьте GitHub Actions:
   ```
   https://github.com/user/familyBudget/actions
   # Build and Push Docker Images должен быть success
   ```

2. Проверьте наличие образа:
   ```bash
   docker manifest inspect ghcr.io/ikeniborn/familybudget-backend:6.6.1
   # Если "manifest unknown" - образ не собран
   ```

3. Убедитесь что VERSION bump committed:
   ```bash
   git log --oneline -1
   # Должен содержать VERSION 6.6.1
   ```

4. Для приватных репозиториев - аутентификация:
   ```bash
   docker login ghcr.io
   Username: <github_username>
   Password: <github_personal_access_token>
   ```

### Проблема 3: CI/CD workflow не запустился

**Причина:** Workflow триггерится только при push в test branch.

**Решение:**
```bash
# Убедитесь что push в правильную ветку
git branch  # Должен быть test
git push origin test

# Или вручную запустите workflow
# GitHub → Actions → Build and Push Docker Images → Run workflow
```

### Проблема 4: Старые образы не удаляются

**Проверка:**
```bash
# На сервере
docker images | grep familybudget
# Если много старых образов (>7 дней)
```

**Решение:**
```bash
# Ручной запуск cleanup
cd /opt/budget
source deploy.sh
cleanup_old_images 7

# Или изменить retention в .env
echo "CLEANUP_RETENTION_DAYS=3" >> .env
```

### Проблема 5: Frontend статика не отдается

**Ошибка:**
```
404 Not Found: /static/css/tailwind-daisyui.min.css
```

**Причина:** Backend должен отдавать статику через FastAPI StaticFiles (не nginx)

**Решение:**
1. Проверьте что frontend в backend образе:
   ```bash
   docker exec familybudget-backend ls -lh /app/frontend/web/static/css/
   # Должен показать файлы
   ```

2. Проверьте backend логи:
   ```bash
   docker logs familybudget-backend | grep StaticFiles
   ```

3. Проверьте nginx конфигурацию (НЕ должно быть location /static/):
   ```bash
   docker exec familybudget-nginx cat /etc/nginx/conf.d/app-https.conf
   # НЕ должно быть: location /static/ { alias ... }
   ```

### Проблема 6: Disk space full

**Ошибка:**
```
Error response from daemon: write /var/lib/docker: no space left on device
```

**Решение:**
```bash
# Проверка места
df -h /var/lib/docker

# Удаление всех старых образов
docker image prune -a --filter "until=168h"  # Старше 7 дней

# Удаление dangling images
docker image prune -f

# Удаление unused volumes (ОСТОРОЖНО!)
docker volume prune -f
```

---

## Размеры образов (v9.0)

**Production images:**
- **Backend:** ~500 MB (с embedded frontend)
- **Bot:** ~400 MB
- **Nginx:** ~50 MB (nginx:alpine)
- **Redis:** ~40 MB (redis:7-alpine)
- **PostgreSQL:** ~250 MB (postgres:16-alpine)
- **Total:** ~1.2 GB на версию

**First deployment pull:** ~1.2 GB
**Subsequent deployments:** ~50-200 MB (только измененные слои)

**Disk space planning:**
- 1 версия: 1.2 GB
- 7 дней retention (1 deploy/день): ~7-8 GB
- **Рекомендуется:** Минимум 20 GB для /var/lib/docker

---

## Deployment History

Все деплои логируются в `/opt/budget/logs/deployment-history.log`:

```
[2026-01-21 10:30:00] mode=registry tag=6.6.1 result=success user=admin
[2026-01-20 22:15:00] mode=registry tag=6.6.0 result=success user=admin
[2026-01-20 21:00:00] mode=registry tag=6.5.0 result=success user=admin
```

**Cleanup history:** `/opt/budget/logs/cleanup-history.log`:
```
[2026-01-21T10:30:05Z] removed: ghcr.io/ikeniborn/familybudget-backend:6.5.0
[2026-01-21T10:30:06Z] removed: ghcr.io/ikeniborn/familybudget-bot:6.5.0
[2026-01-21T10:30:07Z] skipped: ghcr.io/ikeniborn/familybudget-backend:6.6.1 (running)
```

---

## Ссылки на документацию

- **CI/CD архитектура:** `docs/architecture/ci-cd-build-deploy.md`
- **Docker архитектура:** `docs/architecture/docker.md`
- **Registry module:** `scripts/lib/registry.sh`
- **Deploy-test skill:** `.claude/skills/deploy-test/SKILL.md`
- **Deploy-prod skill:** `.claude/skills/deploy-prod/SKILL.md`
- **GitHub Actions workflows:** `.github/workflows/build-and-push.yml`
- **Deployment troubleshooting:** `docs/architecture/guides/deployment-troubleshooting.md`
- **Build mode archive:** `archive/README-ARCHIVE.md`

---

## Rollback к Build Mode (Emergency)

**ТОЛЬКО для критических ситуаций**, если registry-only mode полностью сломан:

```bash
# На сервере
cd ~/familyBudget
git fetch origin archive/build-mode-backup
git checkout archive/build-mode-backup

# Deploy со старым deploy.sh (с build logic)
sudo bash deploy.sh

# Данные сохранены (postgres_data, redis_data)
```

**Документация build mode:** `archive/README-ARCHIVE.md`

---

## Итого (v9.0)

**Что получили:**
1. ⚡ **Всегда быстро:** Деплой ВСЕГДА 2-3 минуты (только pull)
2. ✅ **Надежнее:** Образы прошли CI/CD + test сервер проверку
3. 🚀 **Проще:** Нет npm/Node.js на сервере, нет build logic
4. 🔒 **Безопаснее:** Нет сборки на production, Trivy scan
5. 📦 **5 образов:** Полный контроль над всеми сервисами
6. 🔄 **Auto-cleanup:** Автоматическая очистка старых образов (7d)
7. 🎯 **Селективная сборка:** Пересборка только измененных образов

**Breaking Changes:**
- ❌ Build mode удален (используйте archive ветку для отката)
- ❌ --use-registry флаг удален (default behavior)
- ❌ npm на сервере больше не требуется

**Migration Guide:**
1. Убедитесь что все деплои проходят через GitHub Actions
2. Удалите Node.js/npm с production сервера (опционально)
3. Обновите deployment scripts (deploy.sh v9.0)
4. Настройте auto-cleanup retention (CLEANUP_RETENTION_DAYS)

**Как начать использовать:**
1. ✅ Bump VERSION вручную перед push
2. ✅ Push → GitHub Actions собирает образы
3. ✅ Деплой на budget-test → тестирование 1 неделя
4. ✅ Деплой на budget-prod → консистентные образы
5. ✅ Наслаждайтесь скоростью и надежностью 🎉

---

**Версия документа:** 2.0 (Registry-Only Architecture)
**Дата:** 2026-01-21
**Автор:** Claude Sonnet 4.5
