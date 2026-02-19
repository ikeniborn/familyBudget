# Cache Busting Strategy

**Версия:** 2.0 (v10.1.38+)
**Последнее обновление:** 2026-01-30

## Обзор

Cache busting обеспечивает мгновенное обновление статических файлов в браузере пользователя при деплое новой версии. Используется семантическая версия (semver) в качестве уникального идентификатора.

## Как это работает

### 1. Placeholder в Templates

Все статические ресурсы используют `?v=PLACEHOLDER` в development:

```html
<!-- Frontend bundles -->
<script src="/static/js/lists.min.js?v=PLACEHOLDER"></script>
<script src="/shared/db/pglite.min.js?v=PLACEHOLDER"></script>

<!-- CSS -->
<link href="/static/css/tailwind-daisyui.min.css?v=PLACEHOLDER" rel="stylesheet">

<!-- Service Worker -->
<script src="/sw.min.js?v=PLACEHOLDER"></script>
```

### 2. Автоматическая замена в CI/CD

В GitHub Actions CI/CD (`build-and-push.yml`) скрипт `cache_busting_ci.sh` заменяет все `?v=PLACEHOLDER` на текущую версию:

```bash
# Из VERSION файла (например: 10.1.38)
scripts/ci/cache_busting_ci.sh 10.1.38
```

**Результат:**
```html
<script src="/static/js/lists.min.js?v=10.1.38"></script>
<script src="/shared/db/pglite.min.js?v=10.1.38"></script>
```

### 3. Уникальность версий

Каждый деплой с новой версией создает уникальные URL:
- `lists.min.js?v=10.1.37` → старая версия (кешируется браузером)
- `lists.min.js?v=10.1.38` → новая версия (загружается заново)

## Файлы, участвующие в cache busting

### Templates (59 файлов)

**Web templates:**
- `frontend/web/templates/base.html` - базовый шаблон (JS/CSS)
- `frontend/web/templates/facts.html` - страница фактов
- `frontend/web/templates/plan.html` - планируемые транзакции
- `frontend/web/templates/lists.html` - списки покупок
- `frontend/web/templates/analytics.html` - аналитика
- `frontend/web/templates/settings.html` - настройки
- `frontend/web/templates/admin_*.html` - админ-панель (8 страниц)
- `frontend/web/templates/scripts/service-worker-registration.html` - SW регистрация

**Webapp (Telegram Mini App):**
- `frontend/webapp/index.html` - главная
- `frontend/webapp/add.html` - добавление транзакции
- `frontend/webapp/list.html` - список транзакций
- `frontend/webapp/stats.html` - статистика

*Полный список:* см. `scripts/ci/cache_busting_ci.sh:26-59`

### Статические файлы

**JavaScript bundles (минифицированные):**
- `frontend/web/static/js/lists.min.js` - Списки покупок
- `frontend/web/static/js/facts.min.js` - Факты (транзакции)
- `frontend/web/static/js/dashboard.min.js` - Дашборд
- `frontend/web/static/js/dist/bundle.js` - Основной bundle
- `frontend/web/static/js/dist/plan.bundle.js` - Планы
- `frontend/web/static/js/dist/components.bundle.js` - Компоненты
- `frontend/shared/db/pglite.min.js` - PGlite offline DB

**CSS (минифицированные):**
- `frontend/web/static/css/tailwind-daisyui.min.css` - Tailwind + DaisyUI
- `frontend/web/static/css/base.min.css` - Базовые стили
- `frontend/web/static/css/lists.min.css` - Стили списков
- `frontend/web/static/css/vendor/*.min.css` - Vendor библиотеки

**Service Worker:**
- `frontend/web/static/sw.min.js` - Service Worker для PWA

## Процесс деплоя с cache busting

### Локальная разработка

```bash
# 1. Разработка (используется ?v=PLACEHOLDER)
vim frontend/web/templates/base.html

# 2. Сборка frontend (минификация)
npm run build:prod

# 3. Обновление версии
echo "10.1.39" > VERSION
git add VERSION
git commit -m "chore: bump version to 10.1.39"

# 4. Push (запускает CI/CD)
git push origin test
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/build-and-push.yml
- name: Build frontend
  run: npm run build  # Собирает минифицированные файлы

- name: Cache busting
  run: |
    VERSION=$(cat VERSION)
    scripts/ci/cache_busting_ci.sh $VERSION
```

**Что происходит:**
1. Читается `VERSION` файл (10.1.39)
2. Запускается `cache_busting_ci.sh 10.1.39`
3. Во всех templates `?v=PLACEHOLDER` → `?v=10.1.39`
4. Docker образ собирается с обновленными templates
5. Образ пушится в ghcr.io с тегом `10.1.39`

### Деплой на сервер

```bash
# Деплой pull'ит образ с тегом 10.1.39
docker compose pull backend
docker compose up -d backend

# Браузер получает файлы с новыми версиями:
# /static/js/lists.min.js?v=10.1.39 (новый URL, обходит кеш)
```

## Преимущества

### ✅ Мгновенное обновление

Браузер видит новый URL (`?v=10.1.39` вместо `?v=10.1.38`) и загружает файл заново, игнорируя кеш.

### ✅ Агрессивное кеширование

Можно использовать долгий кеш (1 год) для статических файлов:

```nginx
# nginx/conf.d/cache.conf
location ~ \.(js|css)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Файлы с `?v=10.1.38` кешируются навсегда (immutable), но при новой версии URL меняется.

### ✅ Rollback friendly

При откате к предыдущей версии:
```bash
# Откат VERSION
echo "10.1.37" > VERSION
git commit -m "chore: rollback to 10.1.37"
git push

# CI/CD пересобирает образ с ?v=10.1.37
# Браузер загружает старые, но рабочие файлы
```

## Troubleshooting

### Проблема: Пользователи видят старую версию JS после деплоя

**Диагностика:**
```bash
# Проверить версию в template
ssh budget-test
grep "lists.min.js?v=" /opt/budget/frontend/web/templates/lists.html
# Должно быть: lists.min.js?v=10.1.38 (текущая версия)
```

**Решение 1: Hard refresh**
```javascript
// Попросить пользователя сделать Ctrl+Shift+R
// Или через DevTools: Disable cache + Reload
```

**Решение 2: Проверить cache busting в CI/CD**
```bash
# Проверить логи GitHub Actions
gh run view <run-id> --log | grep "cache_busting_ci.sh"

# Убедиться, что PLACEHOLDER заменен
gh run view <run-id> --log | grep "Updated.*files"
```

### Проблема: TypeError после деплоя (старый код в кеше)

**Причина:** Браузер загрузил HTML с новой версией, но JS с старой (из кеша).

**Решение:** Добавить в base.html meta-тег no-cache для HTML:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
```

**Долгосрочное решение:** Service Worker с network-first стратегией для HTML.

### Проблема: Разные версии на разных страницах

**Причина:** Файл не попал в список `cache_busting_ci.sh:26-59`.

**Решение:**
```bash
# Добавить файл в скрипт
vim scripts/ci/cache_busting_ci.sh

# В массив files=(...)
files=(
    # ...
    "frontend/web/templates/new_page.html"  # Добавить здесь
)
```

## Critical Fix (v6.5.3): Execution Order

**Date:** 2025-12-29
**Issue:** Cache busting ran BEFORE minification, causing PLACEHOLDER to persist in production

### Problem

**Original flow (v6.5.2 - BROKEN):**
1. ❌ update-cache-busting.sh updated `sw.js` (source)
2. ❌ npm run build minified `sw.js` → `sw.min.js`
3. ❌ Result: `sw.min.js` still had PLACEHOLDER (minified from old sw.js)

### Solution

**Fixed flow (v6.5.3):**
1. ✅ npm run build minifies `sw.js` → `sw.min.js`
2. ✅ update-cache-busting.sh updates `sw.min.js` (minified version)
3. ✅ Script re-compresses `sw.min.js.gz`
4. ✅ Result: Both minified versions have correct timestamp

**Changes:**
- Removed cache busting from deploy.sh line 865-883 (pre-build)
- Added cache busting at line 1090-1108 (post-build, after npm run build)
- Changed `SW_FILE="sw.js"` → `SW_FILE="sw.min.js"` in update-cache-busting.sh
- Added `SW_FILE_GZ="sw.min.js.gz"` re-compression

---

## Quote Compatibility Fix (v6.5.4)

**Date:** 2025-12-30
**Type:** Bugfix (Critical)
**Issue:** Sed pattern incompatibility with minified syntax

### Problem

Deployment failed because sed pattern only supported single quotes `'...'`, but Terser minification produces double quotes `"..."`.

**Root Cause:**
- Sed pattern: `const CACHE_VERSION = '\(CACHE_VERSION_PLACEHOLDER\|v[^']*\)';`
- Minified syntax: `const CACHE_VERSION="v20251229_2003";` (double quotes, no spaces)
- Pattern mismatch → replacement failed → deployment aborted

### Solution

Updated sed pattern to support BOTH quote styles and spacing variations.

**Before:**
```bash
sed -i.tmp "s/const CACHE_VERSION = '\(CACHE_VERSION_PLACEHOLDER\|v[^']*\)';/const CACHE_VERSION = '${NEW_VERSION}';/" "$SW_FILE"
```

**After:**
```bash
# Support both single/double quotes and with/without spaces (minified vs source syntax)
sed -i.tmp "s/const CACHE_VERSION[[:space:]]*=[[:space:]]*[\"']\(CACHE_VERSION_PLACEHOLDER\|v[^\"']*\)[\"'];/const CACHE_VERSION=\"${NEW_VERSION}\";/" "$SW_FILE"
```

**Improvements:**
- `[[:space:]]*` - Supports spaces/tabs (0 or more) around `=`
- `[\"']` - Supports BOTH double and single quotes
- `[^\"']*` - Captures version until any quote
- Always replaces with double quotes (compatible with minified syntax)

**Test Results:**
- ✅ Minified syntax: `const CACHE_VERSION="v20251229_2003";` → Updated
- ✅ Source syntax: `const CACHE_VERSION = 'v20251229_2003';` → Updated
- ✅ PLACEHOLDER: `const CACHE_VERSION = 'CACHE_VERSION_PLACEHOLDER';` → Updated

**Affected Files:**
- `scripts/update-cache-busting.sh:50-51` - Updated sed pattern
- `scripts/update-cache-busting.sh:55-56` - Updated grep check (uses `-E` flag)

---

## Best Practices

### 1. Всегда использовать PLACEHOLDER в исходниках

```html
<!-- ✅ ПРАВИЛЬНО -->
<script src="/static/js/lists.min.js?v=PLACEHOLDER"></script>

<!-- ❌ НЕПРАВИЛЬНО (hardcoded version) -->
<script src="/static/js/lists.min.js?v=10.1.38"></script>
```

### 2. Bump VERSION перед каждым деплоем

```bash
# Автоматически обновляет package.json
echo "10.1.39" > VERSION
git add VERSION
git commit -m "chore: bump version to 10.1.39"
```

### 3. Проверить замену перед деплоем

```bash
# В GitHub Actions логах
scripts/ci/cache_busting_ci.sh <version>
# Expected: ✅ Updated 59 files

# Если ошибки - проверить regex в cache_busting_ci.sh:79-84
```

### 4. Рекомендовать hard refresh после критичных изменений

```markdown
## Deployment Notes (v10.1.38)
**Breaking changes:** PGlite API изменен (await getPGliteManager)

**Для пользователей:** После деплоя сделать hard refresh (Ctrl+Shift+R)
```

### 5. Мониторить ошибки в Sentry/логах

```python
# backend/app/middleware/error_handler.py
# Логировать версию клиента при ошибках
@app.exception_handler(Exception)
async def log_client_version(request, exc):
    client_version = request.headers.get("X-Client-Version", "unknown")
    logger.error(f"Error with client version {client_version}", exc_info=exc)
```

## Интеграция с навыками

### deploy-test skill

**Рекомендация:** Добавить автоматическую проверку cache busting:

```bash
# В .claude/skills/deploy-test/SKILL.md
## Post-Deployment Checklist
- [ ] Версия в templates соответствует VERSION файлу
- [ ] Hard refresh рекомендован в changelog (для breaking changes)
```

### monitoring skill

**Рекомендация:** Добавить мониторинг версий клиентов:

```bash
# Проверить, сколько пользователей на старой версии
ssh budget-test
grep "lists.min.js" /opt/budget/logs/nginx/access.log | \
  grep -oP '\?v=\K[0-9.]+' | sort | uniq -c
```

## Связанные документы

- [CI/CD Build & Deploy](./ci-cd-build-deploy.md) - Процесс сборки
- [Docker Multi-Stage](./docker.md) - Как включаются files в образ
- [PWA Architecture](./pwa.md) - Service Worker caching strategy
- [Deployment Troubleshooting](./guides/deployment-troubleshooting.md) - Проблемы деплоя

## История изменений

**v2.0 (10.1.38)** - 2026-01-30
- Обновлена документация для включения в проект
- Добавлены best practices для deploy навыков
- Документирован процесс troubleshooting
- Интегрированы критические исправления из cache-busting-fix.md (v6.5.3-6.5.4)

**v6.5.4** - 2025-12-30
- Исправлена несовместимость sed паттерна с минифицированным синтаксисом (двойные кавычки)
- Обновлена проверка grep для поддержки обоих стилей кавычек

**v6.5.3** - 2025-12-29
- Исправлен порядок выполнения: cache busting теперь запускается ПОСЛЕ минификации
- Скрипт обновляет sw.min.js вместо sw.js

**v1.0 (10.0.0)** - 2026-01-20
- Первая версия cache busting с semver
- Миграция с timestamp на semantic versioning
