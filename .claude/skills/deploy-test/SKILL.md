---
name: deploy-test
description: Автоматизированный деплой на тестовый сервер budget-test с registry-first архитектурой (рекомендуется pull из ghcr.io, fallback на local build)
version: 9.1.2
author: Family Budget Team
tags: [deployment, automation, testing, ssh, budget-test, auto-recovery, error-handling, ci-cd, registry, registry-first, toon-optimized, hybrid-build]
dependencies: [monitoring]
context: fork
user-invocable: true
---

# Deploy Test Automation Skill v9.1.2

Автоматизирует весь процесс деплоя на тестовый сервер budget-test с:
- ✅ **Registry-Only Architecture** - все сборки в GitHub Actions CI/CD (v9.0+)
- ✅ **TOON Optimization** - экономия 464 токенов (44.9%) при обработке ошибок (v9.1+)
- ✅ Автоматическим обнаружением и классификацией ошибок
- ✅ Локальным исправлением кода (TypeScript, Python, npm)
- ✅ Автоматическим commit/push исправлений в ветку test
- ✅ Циклом повторных попыток с exponential backoff
- ✅ Детальным мониторингом и summary отчетами
- ✅ Timeout защитой для SSH команд (v2.0.1+)
- ✅ Автоматической очисткой старых Docker images (v9.0+)

## Когда использовать этот скил

Используй этот скил когда нужно:
- Задеплоить изменения на тестовый сервер budget-test
- Обновить код на тестовом сервере
- Проверить работу изменений в тестовой среде
- Автоматически проанализировать логи после деплоя
- Проверить состояние контейнеров после деплоя

Скил автоматически вызывается при запросах типа:
- "Задеплой на тестовый сервер"
- "Обновить код на budget-test"
- "Запусти deploy-test"
- "Сделай деплой на test"
- "Проверь изменения на тестовом сервере"

## Registry-First Deployment (v9.0+)

**Рекомендуемый режим:** Pull pre-built images из GitHub Container Registry

**Workflow (Registry Mode):**
1. **Manual VERSION bump** (в локальном репозитории):
   ```bash
   cd ~/familyBudget
   echo "10.0.50" > VERSION
   git add VERSION package.json package-lock.json
   git commit -m "chore: bump version to 10.0.50"
   git push origin test
   ```

2. **GitHub Actions CI/CD** (~5 минут):
   - Собирает ALL 5 Docker images с embedded frontend
   - Тегирует образы semver тегом из VERSION (10.0.50)
   - Пушит в ghcr.io/ikeniborn/familybudget-*:10.0.50

3. **Deployment на сервере:**
   ```bash
   ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart"
   # → Читает VERSION file → 10.0.50
   # → Пулит 5 images из ghcr.io
   # → docker compose up -d
   # → Auto-cleanup старых images (7 days)
   ```

**Fallback режим (Local Build):**
Если образы недоступны в registry или нужен быстрый деплой без CI/CD:
```bash
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart"
# Builds images locally, slower but always available
```

**ВАЖНО:**
- ✅ Навык deploy-test НЕ меняет VERSION автоматически (manual control)
- ✅ Поддержка hybrid mode: registry (fast) + local build (fallback)
- ✅ `--use-registry` рекомендуется для production/staging деплоев

## Registry-First Architecture (v9.0+)

**Hybrid Build Strategy:** Registry pull (recommended) + Local build (fallback)

**Архитектура:**
- ✅ **Registry Mode (--use-registry):** Pull pre-built images из ghcr.io
  - Fastest deploy: 2-3 min
  - Консистентность с CI/CD
  - Proверенные образы из pipeline
- ✅ **Local Build Mode:** Build images на сервере
  - Fallback если registry недоступен
  - Автоматическое определение изменений (checksums)
  - `--force-build` для принудительной пересборки
- ✅ **5 Custom Images:** backend, bot, nginx, redis, postgresql (all with embedded code)
- ✅ **Frontend Embedded:** No bind mounts, all в Docker images
- ✅ **Auto Cleanup:** Старые images удаляются (7 дней retention)
- ✅ **Version Tagging:** Semver tags from VERSION file

**Преимущества Registry Mode:**
- ✅ **Быстрый деплой:** 2-3 мин (vs 5-7 мин local build)
- ✅ **Консистентность:** те же образы что в CI/CD tests
- ✅ **Безопасность:** нет npm/Node.js на production сервере
- ✅ **Надежность:** проверенные образы из CI/CD pipeline
- ✅ **Прозрачность:** видимость версий в мониторинге (docker ps)

**Workflow (Registry Mode - Recommended):**
```bash
# 1. Developer bumps VERSION manually
echo "10.0.50" > VERSION
git add VERSION package.json package-lock.json
git commit -m "chore: bump version to 10.0.50"
git push origin test

# 2. GitHub Actions автоматически (~5 min):
#    - Выполняет cache busting (git hash)
#    - Собирает frontend (npm run build:prod)
#    - Создает 5 Docker images с embedded кодом
#    - Пушит в ghcr.io/ikeniborn/familybudget-*:10.0.50

# 3. Deploy на сервере:
./deploy.sh --use-registry --sync-mode update --cleanup-mode smart
#    - Читает VERSION file → 10.0.50
#    - Pull 5 images из ghcr.io
#    - docker compose up -d
#    - Migrations
#    - Health checks
#    - Cleanup old images (>7 days)
```

**Workflow (Local Build Mode - Fallback):**
```bash
# Deploy with local image building
./deploy.sh --sync-mode update --cleanup-mode smart
#    - Builds images locally (if changes detected)
#    - docker compose up -d
#    - Migrations
#    - Health checks
```

**IMPORTANT: Manual VERSION Bump Required**
- ✅ Developer MUST bump VERSION перед push
- ✅ GitHub Actions собирает образы с VERSION тегом
- ✅ Server может pull образы (`--use-registry`) или build локально
- ✅ Manual version control (no automatic increments)

**Rollback:**
```bash
# Откат на предыдущую версию (registry mode)
echo "10.0.49" > /opt/budget/VERSION
sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart

# Pull образов 10.0.49 из ghcr.io
# Перезапуск контейнеров
```

**Requirements (Registry Mode):**
- ✅ GitHub Actions build MUST complete successfully
- ✅ Images MUST exist in ghcr.io/ikeniborn/familybudget-*:${VERSION}
- ✅ VERSION file MUST exist in /opt/budget/

**Requirements (Local Build Mode):**
- ✅ Source code MUST be synced to /opt/budget/
- ✅ npm/Node.js environment configured (for frontend build)
- ✅ Docker build resources available

## TOON Optimization (v9.1+)

**Экономия токенов** при обработке error patterns с использованием TOON формата:

**Hybrid Output Format:**
```json
{
  "fixable_locally": [ /* JSON array (original) */ ],
  "toon": {
    "fixable_locally_toon": "fixable_locally[5]{pattern,category,fix_command,severity,retry_delay,description}:\n  TypeScript error TS[0-9]+:,typescript,npm run type-check && npm run build,medium,5,TypeScript compilation errors\n  ...",
    "token_savings": {
      "fixable_locally": "50.8%",
      "total": "44.9%"
    },
    "size_comparison": {
      "json_tokens": 1034,
      "toon_tokens": 570,
      "saved_tokens": 464
    }
  }
}
```

**Преимущества TOON:**
- ✅ **44.9% экономия токенов** (464 tokens saved)
- ✅ **100% backward compatible** (JSON arrays untouched)
- ✅ **Lossless conversion** (round-trip tested)
- ✅ **Human-readable** tabular format
- ✅ **Metadata included** (token savings transparency)

**Array Breakdown:**
| Array | JSON Tokens | TOON Tokens | Saved | Percent |
|-------|-------------|-------------|-------|---------|
| fixable_locally | 319 | 157 | 162 | 50.8% |
| fixable_remotely | 334 | 170 | 164 | 49.1% |
| not_fixable | 381 | 243 | 138 | 36.2% |
| **Total** | **1034** | **570** | **464** | **44.9%** |

**TOON Example (fixable_locally):**
```toon
fixable_locally[5]{pattern,category,fix_command,severity,retry_delay,description}:
  TypeScript error TS[0-9]+:,typescript,npm run type-check && npm run build,medium,5,TypeScript compilation errors
  SyntaxError: .* in .*\.py,python_syntax,black {file} && flake8 {file},high,10,Python syntax errors
  npm ERR! Missing dependencies,npm_deps,npm ci,medium,5,Missing npm dependencies
  ModuleNotFoundError: No module named,python_deps,pip install -r requirements.txt,medium,10,Missing Python dependencies
  error: pathspec '.*' did not match any file,git_pathspec,git reset HEAD && git add -A,low,5,Git pathspec errors
```

**Configuration:**
- Location: `.claude/skills/deploy-test/config/error-patterns.json`
- Version: 9.1.0
- Format: Hybrid JSON + TOON
- Testing: `node config/test-toon-hybrid.mjs`

## Автоматическое исправление ошибок (v2.0.0+)

Навык автоматически обнаруживает и исправляет следующие типы ошибок:

### Локальное исправление (с commit в test)

Исправления выполняются в локальном окружении с автоматическим commit и push в ветку test:

- **TypeScript errors** - `npm run type-check && npm run build` + commit
- **Python syntax** - `black` автоформатирование + commit
- **npm dependencies** - `npm ci` (чистая установка) + commit
- **Python dependencies** - `pip install -r requirements.txt` + commit
- **Git pathspec errors** - `git reset HEAD && git add -A` + commit

**Формат commit message:**
```
fix(deploy): auto-fix {category} errors

Automated fix triggered by deploy-test skill.

Error details:
{error_log_excerpt}

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Ошибки требующие ручного действия на сервере

**ВАЖНО:** Исправления применяются ТОЛЬКО локально с коммитом. Для следующих ошибок выводятся инструкции для ручного выполнения на сервере:

- **container unhealthy** - `ssh budget-test "cd /opt/budget && docker compose restart {service}"`
- **database connection** - `ssh budget-test "cd /opt/budget && docker compose restart postgres && sleep 10"`
- **redis connection** - `ssh budget-test "cd /opt/budget && docker compose restart redis && sleep 5"`
- **port conflict** - `ssh budget-test "cd /opt/budget && docker compose down && docker compose up -d"`
- **network missing** - `ssh budget-test "cd /opt/budget && docker compose down && docker compose up -d"`

### Неисправимые ошибки (требуют ручного вмешательства)

При обнаружении критических ошибок деплой останавливается с инструкциями:

- **No space left on device** - `docker system prune -a && docker volume prune`
- **Permission denied (sudo)** - проверить sudoers конфигурацию
- **Git permission errors** - `sudo chown -R $(whoami) /opt/budget`
- **Git authentication** - проверить SSH ключи (`ssh -T git@github.com`)
- **Merge conflicts** - разрешить конфликты вручную

## Алгоритм повторных попыток (v2.0.0+)

**Цикл восстановления (до 3 попыток):**

1. **Попытка деплоя** → ошибка
2. **Классификация ошибки** (error-patterns.json)
3. **Если FIXABLE_LOCALLY:**
   - Исправить код локально
   - Commit + push в test
   - Git pull на сервере
   - Повторный деплой
4. **Если FIXABLE_REMOTELY:**
   - Показать команду для ручного выполнения на сервере
   - Попытка продолжить без исправления (даем шанс следующей попытке)
   - **НЕ исправляет автоматически** (только локальные исправления с commit)
5. **Если NOT_FIXABLE:**
   - Показать инструкции для ручного исправления
   - ABORT
6. **Exponential backoff:** задержки 5s, 10s, 20s, ... (до 60s)
7. **Критические ошибки:** немедленный ABORT с abort_on_critical=true

**Встроенная логика навыка (автоматически):**
- ✅ Максимум 3 попытки деплоя
- ✅ Exponential backoff: 5s, 10s, 20s между попытками
- ✅ Auto-commit исправлений в ветку test (Conventional Commits)
- ✅ Auto-push исправлений в remote
- ✅ Retry после каждого исправления

**Примеры сценариев:**
```bash
# Сценарий 1: Успешный деплой с первой попытки
1. deploy-test навык вызван
2. SSH → git pull → deploy.sh --use-registry
3. Все контейнеры healthy
4. ✅ Деплой завершен

# Сценарий 2: Ошибка TypeScript, автоисправление
1. deploy-test навык вызван
2. SSH → git pull → deploy.sh --use-registry
3. ❌ Build failed: TypeScript error
4. Навык исправляет код локально
5. git commit + push исправления
6. Retry: deploy.sh --use-registry (попытка 2/3)
7. ✅ Деплой завершен

# Сценарий 3: Критическая ошибка (no space left)
1. deploy-test навык вызван
2. SSH → git pull → deploy.sh --use-registry
3. ❌ CRITICAL: No space left on device
4. Навык показывает инструкции для ручного исправления
5. ❌ Деплой прерван (не исправимо автоматически)
```

## Алгоритм работы

Этот skill выполняет следующие шаги автоматически:

## Интерактивное подтверждение (v9.0+)

**УДАЛЕНО:** Выбор типа версии (patch/minor/major) - версии меняются вручную

**НОВЫЙ WORKFLOW:**
1. Git pull загружает IMAGE_VERSIONS.json
2. Вывод таблицы версий с метаданными
3. Промпт: "Deploy these versions to budget-test? [Y/n]"
4. Если Y: продолжить деплой
5. Если N: немедленно отменить деплой
6. Non-interactive mode (pipe/redirect): авто-подтверждение

**Опции автоматического восстановления (управляются навыком, НЕ передаются в deploy.sh):**
- Навык автоматически обнаруживает ошибки и применяет исправления
- Retry логика встроена в навык (до 3 попыток)
- Auto-commit исправлений в ветку test
- Exponential backoff между попытками (5s, 10s, 20s)

**Фиксированные опции (всегда применяются навыком):**
- `--use-registry` - pull готовых образов из ghcr.io (РЕКОМЕНДУЕТСЯ)
- `--sync-mode update` - только обновление/добавление файлов
- `--cleanup-mode smart` - умная очистка старых образов

**Формирование итоговой команды (навык deploy-test):**
```bash
# Registry mode (по умолчанию в deploy-test)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart"

# С дополнительными опциями (если нужно)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart [--image-tag TAG]"
```

**ВАЖНО для deploy-test навыка:**
- ✅ Всегда используется `--use-registry` (быстрый деплой, консистентность с CI/CD)
- ✅ VERSION должна быть обновлена вручную ПЕРЕД вызовом навыка
- ✅ GitHub Actions должен успешно завершить build образов
- ❌ НЕ используются опции version bump (--patch/--minor/--major) в registry mode

### Шаг 1: Проверка SSH подключения
```bash
ssh budget-test "echo 'Connection OK'"
```

**Что проверяется:**
- SSH ключи настроены
- Сервер доступен
- Права доступа корректны

**При ошибке:**
- Предложить пользователю проверить SSH ключи
- Показать команду для ручного подключения

### Шаг 2: Git pull в ветке test
```bash
ssh budget-test "cd ~/familyBudget && git fetch --all && git checkout test && git pull origin test"
```

**Что проверяется:**
- Ветка test существует
- Нет незакоммиченных изменений
- Pull прошел успешно

**При ошибке:**
- Показать статус git
- Предложить решение конфликтов
- Дать команды для ручного исправления

### Шаг 3: Запуск deploy.sh

**Базовая команда (Registry Mode - РЕКОМЕНДУЕТСЯ для budget-test):**
```bash
# Pull готовых образов из ghcr.io (VERSION уже обновлена вручную)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart"
```

**Registry Mode - различные сценарии:**
```bash
# Стандартный деплой (VERSION уже bumped вручную перед push)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart"

# С явным указанием image tag
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --image-tag 10.0.50 --sync-mode update --cleanup-mode smart"
```

**Local Build Mode (FALLBACK - если registry недоступен):**
```bash
# Bug fixes (patch bump: 10.0.50 → 10.0.51) + local build
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch"

# New features (minor bump: 10.0.50 → 10.1.0) + local build
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --minor"

# Breaking changes (major bump: 10.0.50 → 11.0.0) + local build
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --major"

# Explicit version + local build
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --version 10.1.0"

# No version change + local build (если нужно)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --no-version"
```

**Параметры:**
- `--sync-mode update` - только обновление/добавление файлов (безопасно)
- `--cleanup-mode smart` - умная очистка старых образов

**Опции версионирования:**
- `--patch` - patch bump (X.Y.Z → X.Y.Z+1)
- `--minor` - minor bump (X.Y.Z → X.Y+1.0) - по умолчанию
- `--major` - major bump (X.Y.Z → X+1.0.0)
- `--version X.Y.Z` - установить конкретную версию (например `--version 10.1.0`)
- `--no-version` - пропустить version bump (оставить текущую версию)

**Опциональные параметры:**
- `--force-build` - принудительная пересборка frontend (игнорирует checksums)
  - Используется когда автоматическое определение изменений не сработало
  - Или для тестирования без изменения файлов
- `--use-registry` - pull Docker images из ghcr.io вместо локальной сборки
  - Требует наличие образов в GitHub Container Registry
  - Ускоряет деплой (~2-3 мин вместо 5-7 мин)
  - Автоопределение тега из VERSION file
- `--image-tag TAG` - явное указание тега для registry pull
  - Работает только с `--use-registry`
  - Примеры: `--image-tag test`, `--image-tag 10.0.50`

**Что происходит (Registry Mode - рекомендуется):**
С опцией `--use-registry`:
1. Синхронизация кода в /opt/budget (git pull)
2. Чтение VERSION из файла (например: 10.0.50)
3. **Pull готовых Docker images** из ghcr.io:
   - `ghcr.io/ikeniborn/familybudget-backend:10.0.50`
   - `ghcr.io/ikeniborn/familybudget-bot:10.0.50`
   - `ghcr.io/ikeniborn/familybudget-nginx:10.0.50`
   - И т.д.
4. Перезапуск контейнеров (docker compose up -d)
5. Применение миграций БД
6. Health checks
7. Cleanup старых images (7 дней retention)

**Что происходит (Local Build Mode - fallback):**
БЕЗ опции `--use-registry`:
1. Синхронизация кода в /opt/budget
2. Version bump (если указан --patch/--minor/--major)
3. Синхронизация VERSION → package.json
4. Автоопределение изменений frontend (checksums)
5. **Сборка Docker images локально** (если изменения обнаружены)
6. Перезапуск контейнеров
7. Миграции БД
8. Health checks

**ВАЖНО:**
- ✅ Registry mode: VERSION уже должна быть обновлена вручную ПЕРЕД деплоем
- ✅ Local build mode: VERSION можно bump на сервере через --patch/--minor/--major
- ⚠️ Registry mode + version bump опции: VERSION изменится, но образы НЕ будут собраны (используются старые из ghcr.io)

**Примеры комбинаций:**

**Registry Mode (рекомендуется для тестового сервера):**
```bash
# Стандартный деплой из registry (VERSION уже обновлена вручную)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart"

# Registry с явным image tag (для отката или специфичной версии)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --image-tag 10.0.50 --sync-mode update --cleanup-mode smart"

# Registry + skip sync (если код уже синхронизирован)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode skip --cleanup-mode smart"
```

**Local Build Mode (fallback, если registry недоступен):**
```bash
# Деплой без изменения версии + принудительная пересборка
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --no-version --force-build"

# Patch bump + local build + принудительная пересборка
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch --force-build"

# Explicit version + local build
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --version 10.1.0"
```

**❌ НЕ РЕКОМЕНДУЕТСЯ (несовместимая комбинация):**
```bash
# Registry + version bump = образы не пересобираются!
# VERSION изменится, но pull попытается загрузить старую версию из registry
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --patch --sync-mode update --cleanup-mode smart"
```

### Шаг 4: Анализ логов деплоя
```bash
ssh budget-test "tail -100 /opt/budget/logs/deploy.log"
```

**Что анализируется:**
- Успешность синхронизации
- Ошибки при сборке образов
- Статус запуска контейнеров
- Health check результаты

**Паттерны ошибок:**
- `ERROR` - критические ошибки
- `FAILED` - неудачные операции
- `fatal` - фатальные ошибки
- `Permission denied` - проблемы с правами

### Шаг 5: Анализ логов контейнеров
```bash
# Backend
ssh budget-test "cd /opt/budget && docker compose logs backend --tail=50"

# PostgreSQL
ssh budget-test "cd /opt/budget && docker compose logs postgres --tail=50"

# Redis
ssh budget-test "cd /opt/budget && docker compose logs redis --tail=50"
```

**Что анализируется:**
- Python exceptions и tracebacks
- Database connection errors
- Redis connection issues
- Application startup errors

**Паттерны ошибок:**
- `Traceback` - Python исключения
- `ERROR` - ошибки приложения
- `Exception` - необработанные исключения
- `ConnectionError` - проблемы с подключением

### Шаг 6: Проверка статуса контейнеров
```bash
ssh budget-test "cd /opt/budget && docker compose ps --format json"
```

**Что проверяется:**
- Все контейнеры running
- Health status = healthy
- Нет exited или restarting контейнеров

**При проблемах:**
- Показать unhealthy контейнеры
- Предложить перезапуск
- Показать логи проблемных контейнеров

### Шаг 7: Проверка запущенных процессов
```bash
ssh budget-test "ps aux | grep -E 'deploy|docker|npm|node' | grep -v grep"
```

**Что проверяется:**
- Нет зависших процессов деплоя
- Нет дублирующихся процессов
- Все процессы завершились корректно

**Признаки проблем:**
- Процессы старше 5 минут
- Множество одинаковых процессов
- Зависшие npm/node процессы

## Обработка ошибок и автоисправление

### Ошибка: SSH подключение не удается
**Действия:**
1. Показать пользователю ошибку
2. Предложить проверить:
   - `ssh-add -l` - список ключей
   - `ssh budget-test` - ручное подключение
3. Дать инструкцию по настройке SSH

### Ошибка: Git pull завершился с конфликтами
**Действия:**
1. Показать конфликтующие файлы
2. Предложить варианты:
   - Stash изменений на сервере
   - Hard reset на сервере (если тестовая среда)
   - Разрешить конфликты вручную
3. Дать команды для исправления

### Ошибка: Deploy.sh завершился с ошибкой
**Действия:**
1. Извлечь конкретную ошибку из логов
2. Анализировать причину:
   - Проблемы с правами
   - Недостаток места на диске
   - Ошибки Docker
   - Проблемы с сетью
3. Предложить решение
4. Если возможно - исправить автоматически

### Ошибка: Контейнеры unhealthy
**Автоисправление:**
```bash
# Перезапуск unhealthy контейнеров
ssh budget-test "cd /opt/budget && docker compose restart <service>"
```

**Если не помогло:**
1. Показать логи контейнера
2. Проверить health endpoint
3. Предложить полный перезапуск
4. Проверить dependencies (postgres, redis)

### Ошибка: Зависшие процессы
**Автоисправление:**
```bash
# Завершить зависшие процессы (только если >5 минут)
ssh budget-test "pkill -9 -f '<process_name>'"
```

**Осторожно:**
- Не убивать активные процессы
- Проверить что процесс действительно завис
- Показать какие процессы будут завершены

## Отчет после деплоя

После завершения всех шагов, скил создает структурированный отчет:

### ✅ Успешный деплой
```
========================================
✅ Деплой на budget-test завершен успешно
========================================

📊 Статус выполнения:
✅ SSH подключение установлено
✅ Git pull выполнен успешно
✅ Deploy.sh завершен без ошибок
✅ Логи деплоя чистые
✅ Все контейнеры healthy
✅ Нет зависших процессов

🐳 Статус контейнеров:
✅ backend: running (healthy)
✅ postgres: running (healthy)
✅ redis: running (healthy)

📝 Важные логи:
- /opt/budget/logs/deploy.log - последние 20 строк

⏱️ Время деплоя: 3м 24с
```

### ⚠️ Деплой с предупреждениями
```
========================================
⚠️ Деплой на budget-test завершен с предупреждениями
========================================

📊 Статус выполнения:
✅ SSH подключение установлено
✅ Git pull выполнен успешно
✅ Deploy.sh завершен без ошибок
⚠️ Обнаружены warnings в логах backend
✅ Все контейнеры healthy
✅ Нет зависших процессов

⚠️ Предупреждения:
1. Backend logs (backend/app/main.py:45):
   WARNING: Redis connection slow (234ms)

2. Postgres logs:
   WARNING: High connection count (85/100)

📝 Рекомендации:
- Проверить Redis performance
- Мониторить connection pool

⏱️ Время деплоя: 4м 12с
```

### ❌ Деплой с ошибками
```
========================================
❌ Деплой на budget-test завершился с ошибками
========================================

📊 Статус выполнения:
✅ SSH подключение установлено
✅ Git pull выполнен успешно
❌ Deploy.sh завершился с ошибкой
❌ Backend контейнер unhealthy
✅ Нет зависших процессов

❌ Критические ошибки:
1. Deploy.sh error (код: 1):
   Error: Failed to start backend container

2. Backend container (unhealthy):
   ERROR: Database connection refused
   Connection to postgres:5432 failed

🔧 Действия для исправления:
1. Проверить PostgreSQL:
   ssh budget-test "cd /opt/budget && docker compose logs postgres"

2. Проверить сетевое подключение:
   ssh budget-test "cd /opt/budget && docker compose exec backend ping postgres"

3. Перезапустить PostgreSQL:
   ssh budget-test "cd /opt/budget && docker compose restart postgres"

4. Повторить деплой после исправления

⏱️ Время деплоя: 2м 48с (прерван)
```

## Сохранение логов

Все логи автоматически сохраняются локально для анализа:

```
logs/deploy-test/
├── YYYYMMDD_HHMMSS/
│   ├── 01_ssh_check.log           # SSH проверка
│   ├── 02_git_pull.log            # Git pull вывод
│   ├── 03_deploy.log              # Deploy.sh вывод
│   ├── 04_deploy_server.log       # /opt/budget/logs/deploy.log
│   ├── 05_backend_logs.log        # Backend контейнер
│   ├── 06_postgres_logs.log       # Postgres контейнер
│   ├── 07_redis_logs.log          # Redis контейнер
│   ├── 08_container_status.json   # Статус контейнеров
│   ├── 09_processes.log           # Запущенные процессы
│   └── summary.md                 # Итоговый отчет
```

## Интеграция с другими скилами

### Используются:
- **monitoring** - анализ логов и метрик

### Вызывается автоматически:
- При фразах "задеплой на тестовый сервер"
- Из других скилов при тестировании изменений

## Примеры использования

### Пример 1: Простой деплой
```
Пользователь: "Задеплой на тестовый сервер"

Claude:
1. Проверяю SSH подключение... ✅
2. Выполняю git pull... ✅
3. Запускаю deploy.sh... ✅
4. Анализирую логи... ✅
5. Проверяю контейнеры... ✅
6. Проверяю процессы... ✅

✅ Деплой завершен успешно! Все сервисы работают корректно.
```

### Пример 2: Деплой с ошибкой и исправлением
```
Пользователь: "Обновить код на budget-test"

Claude:
1. Проверяю SSH подключение... ✅
2. Выполняю git pull... ✅
3. Запускаю deploy.sh... ✅
4. Анализирую логи... ⚠️ Обнаружена ошибка
5. Проверяю контейнеры... ❌ Backend unhealthy

❌ Проблема: Backend container unhealthy
   Причина: Database connection refused

🔧 Исправляю автоматически:
   - Перезапускаю PostgreSQL... ✅
   - Перезапускаю Backend... ✅
   - Проверяю health... ✅

✅ Проблема исправлена! Все сервисы работают.
```

### Пример 3: Множественные проблемы
```
Пользователь: "Сделай деплой на test"

Claude:
1. Проверяю SSH подключение... ✅
2. Выполняю git pull... ❌ Конфликт

⚠️ Обнаружен конфликт в файле: backend/app/config.py

Предлагаю решения:
1. Stash изменения на сервере (рекомендую)
2. Hard reset (удалит локальные изменения)
3. Разрешить вручную

Выбери вариант или я использую вариант 1?
```

## Best Practices

### 1. Всегда проверяй состояние перед действиями
- SSH подключение перед git pull
- Git статус перед pull
- Контейнеры перед перезапуском

### 2. Детальное логирование
- Сохраняй все выводы команд
- Timestamp для каждого действия
- Структурированные отчеты

### 3. Безопасное исправление
- Не убивай процессы без подтверждения
- Не делай hard reset без предупреждения
- Предлагай варианты вместо автоматических действий

### 4. Информативная обратная связь
- Эмодзи для визуального статуса (✅ ⚠️ ❌)
- Прогресс выполнения в реальном времени
- Понятные сообщения об ошибках
- Конкретные команды для исправления

## Troubleshooting

Специфичные для deploy-test проблемы:

### SSH timeout
**Причина:** Сервер недоступен или долго отвечает
**Решение:** Увеличить timeout, проверить сеть

### Git pull зависает
**Причина:** Большой размер изменений или медленная сеть
**Решение:** Использовать `--depth 1` для shallow pull

### Deploy.sh зависает
**Причина:** Docker операции долго выполняются
**Решение:** Увеличить timeout, мониторить процессы

## Связанные скилы

- **monitoring** - мониторинг сервисов
- **testing** - тестирование перед деплоем
- **deploy-prod** - деплой на production сервер

## Changelog

### v9.1.2 (2026-01-26)
**Registry-First Workflow Documentation (Critical Fix):**
- 🔥 **Шаг 3: Запуск deploy.sh**: Полностью переписан для Registry-First подхода
- 🔥 **"Что происходит"**: Критическое исправление - разделено на Registry Mode vs Local Build Mode
- ✅ **Registry Mode (default для deploy-test)**: Только pull готовых образов из ghcr.io, БЕЗ сборки
- ✅ **Local Build Mode**: Сборка на сервере как fallback (если registry недоступен)
- ✅ **Базовая команда**: Изменена с `--patch` на `--use-registry` (рекомендуемый режим)
- ✅ **VERSION управление**: Четко указано что VERSION обновляется вручную ПЕРЕД деплоем в registry mode
- ❌ **Удалены устаревшие опции**: `--max-retries`, `--retry-delay`, `--skip-local-validation` (не поддерживаются deploy.sh)
- ⚠️ **Добавлено предупреждение**: Registry + version bump = несовместимая комбинация

**Ключевое изменение философии:**
- **БЫЛО (неверно)**: "deploy.sh собирает версию и пересобирает образы на сервере"
- **СТАЛО (верно)**: "deploy.sh pull готовые образы по VERSION из ghcr.io (сборка в GitHub Actions)"

**Impact:**
- Навык теперь корректно отражает Registry-First архитектуру v9.0+
- Пользователи поймут что VERSION должна быть обновлена вручную ПЕРЕД деплоем
- Избежание ошибок при использовании несовместимых комбинаций опций

### v9.1.1 (2026-01-26)
**Documentation Corrections (Part 1 - Options):**
- ✅ **Fixed deploy.sh options**: Corrected version bump syntax (--patch/--minor/--major + --version X.Y.Z)
- ✅ **Removed `--set-version`**: Replaced with correct `--version X.Y.Z` syntax
- ✅ **Clarified hybrid build mode**: Registry-first (recommended) + local build (fallback available)
- ✅ **Updated v9.0.0 changelog**: Removed incorrect claims that `--use-registry` and `--image-tag` were removed
- ✅ **Corrected examples**: All command examples now use current deploy.sh syntax
- ✅ **Updated workflow descriptions**: Accurate representation of registry + local build support

**Documentation Corrections (Part 2 - Registry-First Workflow):**
- ✅ **Шаг 3: Запуск deploy.sh**: Полностью переписан для Registry-First архитектуры
- ✅ **"Что происходит"**: Разделено на Registry Mode vs Local Build Mode
- ✅ **Registry Mode (рекомендуется)**: Только pull образов из ghcr.io, БЕЗ сборки на сервере
- ✅ **Local Build Mode**: Сборка локально как fallback (если registry недоступен)
- ✅ **Базовая команда**: Изменена с version bump на `--use-registry` (рекомендуемый режим)
- ✅ **Примеры команд**: Приоритет Registry Mode, Local Build как fallback
- ✅ **Устаревшие опции**: Удалены примеры с `--max-retries`, `--skip-local-validation` (не поддерживаются deploy.sh)
- ✅ **Важное замечание**: Registry + version bump = несовместимая комбинация (образы не пересобираются)

**Ключевые изменения описания:**
- ❌ **БЫЛО**: "Version bump если указан --version TYPE, сборка образов если нужно"
- ✅ **СТАЛО**: "Registry mode: pull готовых образов по VERSION из ghcr.io (VERSION обновлена вручную)"
- ❌ **БЫЛО**: Примеры с --patch/--minor/--major как базовые команды
- ✅ **СТАЛО**: --use-registry как базовая команда, version bump только для local build fallback

**No Code Changes:**
- Implementation unchanged, only documentation corrections to match actual deploy.sh behavior

### v9.1.0 (2026-01-24)
**TOON Optimization:**
- ✅ **Hybrid Output Format**: error-patterns.json now includes TOON representations alongside JSON
- ✅ **Token Savings**: 464 tokens (44.9%) reduction in error pattern processing
- ✅ **Lossless Conversion**: Round-trip tested for data integrity
- ✅ **Backward Compatibility**: JSON arrays remain unchanged, TOON is additive

**Error Pattern Enhancements:**
- `fixable_locally`: 162 tokens saved (50.8% reduction)
- `fixable_remotely`: 164 tokens saved (49.1% reduction)
- `not_fixable`: 138 tokens saved (36.2% reduction)

**Configuration:**
- `config/error-patterns.json` v9.1.0 with TOON metadata
- Simplified `manual_action` fields for TOON compatibility
- Token savings metadata in JSON for transparency

**Testing:**
- Round-trip tests validate lossless TOON conversion
- TOON validation ensures syntactic correctness
- Token savings verified against predictions

### v9.0.0 (2026-01-21)
**Registry-First Architecture:**
- ✅ **Hybrid Build Mode**: Support both registry pull (`--use-registry`) and local build (`--force-build`)
- ✅ **Registry Recommended**: GitHub Actions builds images → server pulls from ghcr.io (faster)
- ✅ **Local Build Available**: Fallback option if registry unavailable or for testing
- ✅ **5 Custom Images**: backend, bot, nginx, redis, postgresql (all with embedded code)
- ✅ **Frontend Embedded**: No bind mounts, all code in Docker images
- ✅ **Version Tagging**: Semver tags from VERSION file (10.0.50, 10.1.0, etc.)

**Workflow (Registry Mode - Recommended):**
1. Developer bumps VERSION manually: `echo "10.0.50" > VERSION && git commit && git push`
2. GitHub Actions CI/CD (~5 min):
   - Builds ALL 5 images with frontend embedded
   - Tags with VERSION (10.0.50)
   - Pushes to ghcr.io/ikeniborn/familybudget-*:10.0.50
3. Server deployment:
   - `./deploy.sh --use-registry --sync-mode update --cleanup-mode smart`
   - Pulls images from ghcr.io by VERSION tag
   - docker compose up -d
   - Auto-cleanup old images (7 days retention)

**Workflow (Local Build Mode - Fallback):**
1. Developer commits code changes
2. Server deployment:
   - `./deploy.sh --sync-mode update --cleanup-mode smart`
   - Builds Docker images locally with detected changes
   - docker compose up -d

**Available Options:**
- ✅ `--use-registry` - Pull images from ghcr.io (recommended, faster)
- ✅ `--image-tag TAG` - Specify custom image tag for registry pull
- ✅ `--force-build` - Force local frontend rebuild (checksums bypass)
- ✅ `--patch/--minor/--major` - Version bump options
- ✅ `--version X.Y.Z` - Set explicit version
- ✅ `--no-version` - Skip version bump

**Automatic Cleanup:**
- Old Docker images removed after deployment (7 days retention)
- Saves ~7GB disk space per week (1 deploy/day scenario)
- Running containers protected from deletion

**Requirements (Registry Mode):**
- GitHub Actions MUST complete successfully before deployment
- Images MUST exist in ghcr.io/ikeniborn/familybudget-*:${VERSION}
- VERSION file MUST match available image tags

**Rollback:**
```bash
# Change VERSION to previous version and redeploy
echo "10.0.49" > /opt/budget/VERSION
sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart
```

**See also:**
- `.github/workflows/build-and-push.yml` - CI/CD pipeline
- `docker-compose.yml` - Image configuration
- `docs/architecture/ci-cd-build-deploy.md` - Architecture docs
- `docs/architecture/docker.md` - Multi-stage Dockerfiles

### v8.0.0 (2026-01-20)
**DEPRECATED:** Build mode support removed in v9.0.0
- Container Registry Integration (now the only mode)
- `--use-registry` flag (now default behavior)
- `--image-tag TAG` flag (replaced by VERSION file)

### v2.0.1 (2026-01-20)
**Bug Fixes:**
- Add timeout protection for SSH commands to prevent hanging
- `analyze_container_logs()`: 60s timeout for docker logs (prevents SIGKILL on large logs)
- `analyze_deploy_logs()`: 30s timeout for deploy log reading
- `check_container_status()`: 30s timeout for container status check
- `check_running_processes()`: 20s timeout for process listing
- Add SSH connection timeout (10s) for all remote commands
- Non-critical timeouts continue execution instead of failing deployment

**Impact:**
- Fixes exit code 1/137 (SIGKILL) when postgres logs are too large
- Improves reliability of post-deployment analysis
- Prevents memory exhaustion during log retrieval

### v2.0.0 (2026-01-19)
**Major Features:**
- Automatic error recovery with local code fixes
- Auto-commit and push to test branch
- Retry loop with exponential backoff
- Detailed monitoring and summary reports
