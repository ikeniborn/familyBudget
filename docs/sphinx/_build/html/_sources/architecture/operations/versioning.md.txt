# Versioning Strategy

**Last Updated:** 2026-01-24
**Version:** 10.0.0+

## Overview

Family Budget использует **единую систему версионирования** на основе Semantic Versioning:
- **VERSION файл** - единый источник истины для всех компонентов
- **Semantic Versioning (X.Y.Z)** - формат версии
- **Manual version bump** - строгий контроль версий разработчиком

**Важное изменение (v10.0+)**: Cache busting теперь использует semantic version из VERSION файла вместо timestamp.

---

## VERSION File

**Location**: `/VERSION` (root directory)
**Format**: Semantic versioning (X.Y.Z)
**Example**: `10.0.23`

### Structure

```
10.0.23
│  │  └─ Patch: Bug fixes, minor changes
│  └──── Minor: New features, backward compatible
└─────── Major: Breaking changes
```

---

## Usage: Где Используется VERSION

VERSION файл является единым источником истины для всех компонентов системы:

### 1. Docker Image Tags

```bash
# Docker images used in production
ghcr.io/ikeniborn/familybudget-backend:10.0.23
ghcr.io/ikeniborn/familybudget-bot:10.0.23
ghcr.io/ikeniborn/familybudget-nginx:10.0.23
ghcr.io/ikeniborn/familybudget-redis:10.0.23
ghcr.io/ikeniborn/familybudget-postgresql:10.0.23
```

### 2. Cache Busting (НОВОЕ v10.0+)

**HTML templates** - query parameters для static assets:
```html
<!-- frontend/web/templates/base.html -->
<script src="/static/js/app.min.js?v=10.0.23"></script>
<link rel="stylesheet" href="/static/css/style.min.css?v=10.0.23">
```

**Service Worker** - cache name:
```javascript
// frontend/web/static/workers/core/sw.ts
const CACHE_VERSION = "10.0.23";
const CACHE_NAME = `budget-v${CACHE_VERSION}`;
```

**До v10.0 (legacy)**: Cache busting использовал timestamp `v20260124_1530`

### 3. Build Metadata

**GitHub Actions** - build info:
```yaml
# .github/workflows/build-and-push.yml
VERSION=$(cat VERSION)
echo "Building version: $VERSION"
```

**Backend API** - version endpoint:
```python
# backend/app/api/v1/endpoints/system.py
@router.get("/version")
def get_version():
    with open("VERSION") as f:
        return {"version": f.read().strip()}
```

### 4. Environment Configuration

**.env файл** - docker compose:
```bash
VERSION=10.0.23
```

**package.json** - npm package metadata:
```json
{
  "version": "10.0.23"
}
```

---

## Update Process

### 1. Manual Version Bump

VERSION **ВСЕГДА** обновляется вручную разработчиком:

```bash
# Increment patch version (bug fixes)
echo "10.0.24" > VERSION

# Increment minor version (new features)
echo "10.1.0" > VERSION

# Increment major version (breaking changes)
echo "11.0.0" > VERSION
```

**Важно**: Автоматическое обновление VERSION намеренно отключено для строгого контроля версий.

### 2. Commit

```bash
git add VERSION
git commit -m "chore: bump version to 10.0.24"
```

**Commit message convention:**
- `chore: bump version to X.Y.Z` - version bump

### 3. Push & CI/CD

```bash
git push origin test
```

**GitHub Actions автоматически**:
1. Читает VERSION файл
2. Валидирует формат semantic versioning
3. Применяет cache busting ко всем templates (`?v=10.0.24`)
4. Обновляет Service Worker CACHE_VERSION
5. Собирает Docker images с tags из VERSION
6. Загружает images в ghcr.io

### 4. Deployment

```bash
# На сервере
cd /opt/budget
git pull
docker compose pull  # Pulls images with VERSION tag
docker compose up -d
```

---

## Validation

### CI/CD Pipeline

**Automatic validation** в `.github/workflows/build-and-push.yml`:

```yaml
- name: Cache busting
  run: |
    # Проверка существования VERSION файла
    if [[ ! -f VERSION ]]; then
      echo "❌ VERSION file not found"
      exit 1
    fi

    CACHE_VERSION=$(cat VERSION | tr -d '[:space:]')

    # Валидация semantic versioning (X.Y.Z)
    if [[ ! "$CACHE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "❌ Invalid VERSION format: $CACHE_VERSION"
      echo "   Expected: X.Y.Z (e.g., 10.0.23)"
      exit 1
    fi
```

**Build fails если**:
- VERSION файл отсутствует
- Формат невалиден (не X.Y.Z)
- VERSION не изменился при push в test branch (optional warning)

### Manual Validation

```bash
# Проверить формат VERSION
VERSION_CONTENT=$(cat VERSION | tr -d '[:space:]')
if [[ "$VERSION_CONTENT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "✅ VERSION format valid: $VERSION_CONTENT"
else
    echo "❌ VERSION format invalid: $VERSION_CONTENT"
fi

# Проверить что cache busting применился
grep -r "?v=$VERSION_CONTENT" frontend/web/templates/ | head -5
```

---

## Migration from Timestamp to Semantic Versioning

### До v10.0: Timestamp-Based Cache Versioning

**Старый подход**:
```bash
CACHE_VERSION="v$(date -u +%Y%m%d_%H%M)"  # v20260124_1530
```

**Проблемы**:
- Непредсказуемость: версия зависит от времени запуска CI
- Дублирование: повторные сборки создают разные версии
- Несоответствие: Docker tags использовали VERSION (semantic), а cache busting - timestamp

### v10.0+: Semantic Versioning для Всех Компонентов

**Новый подход**:
```bash
CACHE_VERSION=$(cat VERSION | tr -d '[:space:]')  # 10.0.23
```

**Преимущества**:
- **Единый источник**: VERSION файл для всех компонентов
- **Предсказуемость**: версия не зависит от времени сборки
- **Контроль**: manual bump требует осознанного решения
- **Consistency**: Docker tags и cache versions совпадают

### Backward Compatibility

Во время переходного периода (v10.0 - v10.1) поддерживаются **оба формата**:

**Semantic versioning** (рекомендуется):
```
10.0.23
```

**Legacy timestamp** (deprecated):
```
v20260124_1530
```

### Regex Patterns

**scripts/ci/cache_busting_ci.sh**:
```bash
# Поддержка обоих форматов
if [[ ! "$CACHE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && \
   [[ ! "$CACHE_VERSION" =~ ^v[0-9a-f_]+$ ]]; then
    echo "❌ Invalid version format"
    exit 1
fi
```

**Perl regex** в замене:
```perl
# Matches: 10.0.23 (semantic) OR v20260124_1530 (legacy)
s{\?v=(PLACEHOLDER|v?[0-9a-f_]+|[0-9]+\.[0-9]+\.[0-9]+)}{\?v=${version}}g
```

### Migration Timeline

- **v10.0**: Введение semantic versioning из VERSION файла для cache busting
- **v10.0 - v10.1**: Поддержка обоих форматов (smooth migration)
- **v10.2+**: Удаление legacy timestamp support

---

## Best Practices

### 1. Always Bump VERSION Before Changes

```bash
# ❌ WRONG
git add frontend/web/static/js/app.ts
git commit -m "feat: add new feature"
git push

# ✅ CORRECT
echo "10.0.24" > VERSION
git add VERSION
git commit -m "chore: bump version to 10.0.24"
git push

# Then make changes
git add frontend/web/static/js/app.ts
git commit -m "feat: add new feature"
git push
```

### 2. Semantic Version Increments

**Patch (X.Y.Z)**: Bug fixes, minor changes
```bash
# Example: 10.0.23 → 10.0.24
- Fix cache busting regex pattern
- Update documentation typo
- Optimize Service Worker logic
```

**Minor (X.Y.0)**: New features, backward compatible
```bash
# Example: 10.0.23 → 10.1.0
- Add new API endpoint
- Introduce new frontend component
- Add WebSocket feature
```

**Major (X.0.0)**: Breaking changes
```bash
# Example: 10.0.23 → 11.0.0
- Change API response format
- Remove deprecated endpoints
- Database schema breaking change
```

### 3. One VERSION Per Feature Branch

```bash
# Feature branch
git checkout -b feature/new-feature
echo "10.1.0" > VERSION  # Bump once at start
git add VERSION
git commit -m "chore: bump version to 10.1.0"

# Work on feature...
git commit -m "feat: implement new feature"
git commit -m "test: add tests for new feature"

# Merge to test
git checkout test
git merge feature/new-feature
git push
```

### 4. Check VERSION in PR Reviews

**Reviewer checklist**:
- [ ] VERSION файл обновлен
- [ ] Версия соответствует типу изменений (patch/minor/major)
- [ ] Версия не конфликтует с другими PR

---

## Troubleshooting

### Issue 1: Build Fails "VERSION file not found"

**Symptom**:
```
❌ VERSION file not found
Error: Process completed with exit code 1
```

**Solution**:
```bash
echo "10.0.23" > VERSION
git add VERSION
git commit -m "chore: add VERSION file"
git push
```

### Issue 2: Build Fails "Invalid VERSION format"

**Symptom**:
```
❌ Invalid VERSION format: 10.0
   Expected: X.Y.Z (e.g., 10.0.23)
```

**Solution**:
```bash
# ❌ WRONG
echo "10.0" > VERSION

# ✅ CORRECT
echo "10.0.0" > VERSION
```

### Issue 3: Cache Not Invalidating

**Symptom**: Browser serves old cached files after deployment

**Solution**:
```bash
# 1. Verify VERSION was updated
cat VERSION

# 2. Check cache busting applied in templates
grep -r "?v=$(cat VERSION)" frontend/web/templates/ | head -5

# 3. Verify Service Worker CACHE_VERSION
grep "CACHE_VERSION" frontend/web/static/sw.min.js

# 4. Force browser cache clear (user)
Ctrl+Shift+R (hard reload)
```

### Issue 4: Docker Images Not Found

**Symptom**:
```
Error response from daemon: manifest for ghcr.io/.../backend:10.0.99 not found
```

**Solution**:
```bash
# 1. Check GitHub Actions build logs
https://github.com/ikeniborn/familyBudget/actions

# 2. Verify VERSION matches built images
cat VERSION  # Should match failed pull

# 3. Check IMAGE_VERSIONS.json
cat IMAGE_VERSIONS.json | jq '.backend.current_version'

# 4. Re-run build if needed
git push origin test --force
```

### Issue 5: Версия на странице мониторинга показывает старую версию

**Причина**: `.env` файл в `/opt/budget/` не синхронизирован с VERSION файлом.

**Решение**:
```bash
# 1. Проверить текущие версии
cat VERSION
grep VERSION .env

# 2. Синхронизировать вручную если отличаются
echo "VERSION=$(cat VERSION)" >> .env

# 3. Перезапустить контейнеры
docker compose down && docker compose up -d
```

**Проверка**:
```bash
curl -s https://domain/health/detailed | jq .version
```

---

## Автоматическая синхронизация VERSION

### При деплое через deploy.sh происходит:

1. **Sync code** → копирование кода в /opt/budget
2. **VERSION → package.json sync** → если VERSION ≠ package.json
3. **package.json → .npm-isolated sync** → если package.json изменился
4. **Version bump** (если указан --version TYPE)
   - Обновляется VERSION файл
   - Обновляется package.json
   - Синхронизируется .npm-isolated/package.json
   - Обновляется .env
5. **.env VERSION sync** (ВСЕГДА)
   - Проверяется наличие VERSION в .env
   - Если VERSION отсутствует, пустой или отличается - синхронизируется
   - Предотвращает fallback к значению 4.0.0 в docker-compose

### Проверка синхронизации

```bash
# Проверить текущие версии
cat VERSION
grep version package.json
grep VERSION .env
grep version .npm-isolated/package.json
```

Все 4 файла должны иметь одинаковую версию.

---

## Related Documentation

- `/docs/architecture/build-system.md` - Build pipeline с cache busting
- `/docs/architecture/ci-cd-build-deploy.md` - CI/CD процесс
- `/docs/architecture/docker.md` - Docker multi-stage builds
- `/docs/architecture/pwa.md` - Service Worker cache management

## References

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Docker Image Tags Best Practices](https://docs.docker.com/engine/reference/commandline/tag/)
- [HTTP Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
