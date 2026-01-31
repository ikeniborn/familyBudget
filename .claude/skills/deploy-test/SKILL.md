---
name: deploy-test
description: Автоматизированный деплой на тестовый сервер budget-test с registry-first архитектурой и интеграцией GitHub Actions мониторинга
version: 9.2.0
author: Family Budget Team
tags: [deployment, automation, testing, ssh, budget-test, auto-recovery, error-handling, ci-cd, registry, registry-first, toon-optimized, github-actions]
dependencies: [monitoring]
context: fork
user-invocable: true
---

# Deploy Test Automation Skill v9.2.0

Автоматизирует весь процесс деплоя на тестовый сервер budget-test с:
- ✅ **Registry-Only Architecture** - все сборки в GitHub Actions CI/CD (v9.0+)
- ✅ **GitHub Actions Integration** - автоматический мониторинг завершения build (v9.2.0+)
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

2. **GitHub Actions CI/CD** (~15-30 минут):
   - Автоматический build triggered by push
   - Сборка 5 Docker images с embedded frontend
   - Push в ghcr.io/ikeniborn/familybudget-*:10.0.50
   - Security scan + quality checks

3. **[НОВЫЙ ШАГ] Мониторинг завершения GitHub Actions** (рекомендуется):
   ```bash
   # Автоматический (рекомендуется)
   bash deploy-test.sh --wait-for-build

   # Или вручную: https://github.com/ikeniborn/familyBudget/actions
   # Дождаться зеленого статуса ✅ для последнего run
   ```

4. **Deployment на сервере** (автоматический):
   - SSH подключение к budget-test
   - Git pull в ~/familyBudget
   - Pull Docker images из ghcr.io
   - docker compose up -d
   - Migrations + health checks
   - Auto-cleanup старых образов (>7 дней)

**ВАЖНО:**
- ✅ Навык deploy-test НЕ меняет VERSION автоматически (manual control)
- ✅ deploy.sh ТОЛЬКО pull образов из ghcr.io (no build on server)
- ✅ Сборка Docker images происходит ТОЛЬКО в GitHub Actions CI/CD

## Registry-First Architecture (v9.0+)

**Принцип:** Все сборки в CI/CD, сервер только pull + restart

**Архитектура:**
- ✅ **Registry Mode:** Pull pre-built images из ghcr.io
  - Всегда 2-3 мин (pull only, no build)
  - Консистентность с CI/CD тестами
  - Проверенные образы из pipeline
  - Безопасность: нет npm/Node.js на сервере
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

**IMPORTANT: Manual VERSION Bump Required**
- ✅ Developer MUST bump VERSION перед push
- ✅ GitHub Actions собирает образы с VERSION тегом
- ✅ Server ТОЛЬКО pull образов из ghcr.io (no build)
- ✅ Manual version control (no automatic increments)

**Rollback:**
```bash
# Откат на предыдущую версию
echo "10.0.49" > /opt/budget/VERSION
sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart

# Pull образов 10.0.49 из ghcr.io
# Перезапуск контейнеров
```

**Requirements:**
- ✅ GitHub Actions build MUST complete successfully
- ✅ Images MUST exist in ghcr.io/ikeniborn/familybudget-*:${VERSION}
- ✅ VERSION file MUST exist in /opt/budget/

## GitHub Actions Monitoring (v9.2.0+)

**Automatic monitoring (recommended):**

```bash
# Автоматическое ожидание завершения GitHub Actions
bash deploy-test.sh --wait-for-build

# Кастомный timeout (default: 30 min)
bash deploy-test.sh --wait-for-build --build-timeout 45
```

**Что происходит:**
1. [ЛОКАЛЬНО] Проверка gh CLI и аутентификации
2. [ЛОКАЛЬНО] Поиск последнего workflow run для ветки test
3. [ЛОКАЛЬНО] Polling каждые 15s с timeout защитой
4. Если успешен: продолжить деплой (SSH → git pull → deploy)
5. Если failed: abort с ссылкой на логи

**ВАЖНО:** Мониторинг происходит ДО подключения к серверу!

**Requirements:**
- GitHub CLI v2.0+ (`brew install gh` / `sudo apt install gh`)
- GitHub auth: `gh auth login`
- GitHub token с read permissions

**Manual monitoring (fallback):**

Если `gh` CLI недоступен:
1. Откройте https://github.com/ikeniborn/familyBudget/actions
2. Проверьте статус последнего workflow run для ветки test
3. Дождитесь зеленого ✅ статуса
4. Запустите deploy-test БЕЗ флага --wait-for-build

**Polling behavior:**
- Interval: 15 секунд между проверками
- Timeout: 30 минут (configurable via `--build-timeout`)
- Status display: `Прогресс: 2m 15s | Status: in_progress`
- Auto-abort on failure: Деплой немедленно останавливается если build fails

**Exit scenarios:**
- ✅ `completed:success` → Продолжить деплой
- ❌ `completed:failure` → Abort с ссылкой на GitHub Actions logs
- ❌ `completed:cancelled` → Abort (build cancelled by user)
- ⏱️ Timeout → Abort после 30 минут (configurable)

**Non-interactive mode:**
- Stdin не является терминалом → auto-decline без подтверждения
- Используется для CI/CD pipelines где ручное подтверждение невозможно
- Деплой прерывается если gh CLI недоступен

**Example output:**
```
=========================================
Мониторинг GitHub Actions build
=========================================
Workflow: build-and-push.yml
Branch:   test
Timeout:  30 минут

Run ID: 12345678
Status: in_progress

Ожидание завершения GitHub Actions build...
Отслеживать прогресс: https://github.com/ikeniborn/familyBudget/actions/runs/12345678

Прогресс: 2m 15s | Status: in_progress
Прогресс: 2m 30s | Status: in_progress
...
Прогресс: 8m 45s | Status: completed

✅ GitHub Actions build успешно завершен (8m 45s)
```

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

**Базовая команда (Registry-First):**
```bash
# Pull готовых образов из ghcr.io (VERSION уже обновлена вручную в Шаге 1)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart"
```

**Дополнительные сценарии:**
```bash
# С явным указанием image tag (если нужна конкретная версия)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --image-tag 10.0.50 --sync-mode update --cleanup-mode smart"

# Пропустить git sync (если код уже актуальный)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode skip --cleanup-mode smart"
```

**Параметры:**
- `--use-registry` - pull Docker images из ghcr.io (обязательно для Registry-First)
- `--sync-mode update` - обновление кода через git pull (default для budget-test)
- `--cleanup-mode smart` - умная очистка старых images (7 дней retention)
- `--image-tag TAG` - явное указание тега (опционально, автоопределяется из VERSION)

**Что происходит:**
1. Синхронизация кода в /opt/budget (git pull)
2. Чтение VERSION из файла (например: 10.0.50)
3. **Pull готовых Docker images** из ghcr.io:
   - `ghcr.io/ikeniborn/familybudget-backend:10.0.50`
   - `ghcr.io/ikeniborn/familybudget-bot:10.0.50`
   - `ghcr.io/ikeniborn/familybudget-nginx:10.0.50`
   - `ghcr.io/ikeniborn/familybudget-redis:10.0.50`
   - `ghcr.io/ikeniborn/familybudget-postgresql:10.0.50`
4. Перезапуск контейнеров (docker compose up -d)
5. Применение миграций БД
6. Health checks
7. Cleanup старых images (7 дней retention)

**ВАЖНО:**
- ✅ VERSION должна быть обновлена вручную ПЕРЕД деплоем (Шаг 1)
- ✅ Сборка Docker images происходит ТОЛЬКО в GitHub Actions CI/CD
- ✅ deploy.sh на сервере ТОЛЬКО pull образов + restart контейнеров
- ✅ Деплой ВСЕГДА занимает 2-3 мин (pull only, no build)

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

### Пример 1: Рекомендуемый workflow с мониторингом CI/CD

```
Пользователь: "Задеплой на тестовый сервер"

Claude:
1. Проверяю что VERSION обновлена... ✅
2. Мониторинг GitHub Actions build...
   - Run ID: 12345678
   - Status: in_progress
   - Прогресс: 5m 30s | Status: in_progress
   - Прогресс: 8m 45s | Status: completed
   ✅ GitHub Actions build успешно завершен (8m 45s)

3. Проверяю SSH подключение... ✅
4. Выполняю git pull... ✅
5. Подтверждаю версии деплоя... ✅
6. Запускаю deploy.sh --use-registry... ✅
7. Проверяю контейнеры... ✅

✅ Деплой завершен успешно! Все сервисы работают корректно.
```

### Пример 2: Деплой без мониторинга (текущее поведение)

```
Пользователь: "Обновить код на budget-test"

Claude:
1. Проверяю SSH подключение... ✅
2. Выполняю git pull... ✅
3. Подтверждаю версии деплоя... ✅
4. Запускаю deploy.sh --use-registry... ✅

✅ Деплой завершен успешно!
```

### Пример 3: gh CLI недоступен - fallback на manual confirmation

```
Пользователь: "Задеплой с --wait-for-build"

Claude:
⚠️ GitHub CLI (gh) не установлен или не аутентифицирован
Автоматический мониторинг GitHub Actions недоступен.

GitHub Actions build status cannot be verified automatically.
Продолжить деплой без проверки CI/CD? [y/N]

Пользователь: y

1. Проверяю SSH подключение... ✅
2. Выполняю git pull... ✅
...
```

### Пример 4: Build failed - деплой прерван

```
Пользователь: "Задеплой с мониторингом"

Claude:
1. Мониторинг GitHub Actions build...
   - Run ID: 12345679
   - Status: in_progress
   - Прогресс: 3m 20s | Status: in_progress
   - Прогресс: 5m 15s | Status: completed

❌ GitHub Actions build завершился с ошибкой: failure
Проверьте логи: https://github.com/ikeniborn/familyBudget/actions/runs/12345679

❌ Деплой прерван: GitHub Actions build не завершился успешно
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

### v9.2.0 (2026-01-31)
**GitHub Actions Integration:**
- ✅ **--wait-for-build flag**: Автоматический мониторинг GitHub Actions CI/CD
- ✅ **gh CLI integration**: Polling workflow status с timeout защитой (default: 30 min)
- ✅ **Smart fallback**: Manual confirmation если gh CLI недоступен
- ✅ **Pre-deployment check**: Мониторинг происходит ПЕРЕД SSH подключением
- ✅ **Build timeout**: Configurable via --build-timeout (default: 30 min)
- ✅ **Detailed logging**: Показывает run ID, status, conclusion, elapsed time
- ✅ **Error handling**: Автоматический abort если build fails/timeout
- ✅ **Non-interactive mode**: Auto-decline в non-interactive окружении

**Workflow improvements:**
- Шаг 0.5 (NEW): Мониторинг GitHub Actions завершения ПЕРЕД SSH
- Enhanced version confirmation с build status verification
- Прямая ссылка на GitHub Actions run для manual inspection

**Requirements:**
- GitHub CLI (`gh`) v2.0+ для автоматического мониторинга
- Fallback на manual confirmation если gh недоступен
- Полная backward compatibility (default behavior без изменений)

**Configuration:**
- `config/ci-integration.json` v9.2.0: Мониторинг параметры
- `config/preflight-checks.json`: Добавлена проверка gh CLI (check #8)
- Polling interval: 15 секунд
- Default timeout: 30 минут
- Status mapping: completed_success, completed_failure, in_progress, unknown

**Implementation:**
- `check_github_cli()`: Проверка наличия и аутентификации gh CLI
- `get_latest_workflow_run()`: Получение последнего workflow run для ветки
- `wait_for_github_actions()`: Polling loop с timeout защитой
- `ask_user_confirmation()`: Интерактивное подтверждение (fallback)

**Impact:**
- Безопасный деплой: образы гарантированно существуют в registry
- Прозрачность: видимость статуса build в реальном времени
- Гибкость: opt-in через флаг, не меняет default behavior
- User experience: четкий feedback о прогрессе build

### v9.1.3 (2026-01-26)
**Registry-Only Documentation (Critical Simplification):**
- 🔥 **Удалены ВСЕ упоминания Local Build Mode** (deploy.sh больше не собирает на сервере)
- 🔥 **Удалены устаревшие опции**: `--patch`, `--minor`, `--major`, `--version X.Y.Z`, `--no-version`, `--force-build`
- ✅ **Шаг 3: Запуск deploy.sh**: Только Registry-First команды, никаких fallback сценариев
- ✅ **"Что происходит"**: Упрощено - только pull образов + restart контейнеров
- ✅ **Технический контекст**: Убрана секция "Fallback режим (Local Build)"
- ✅ **Registry-First Architecture**: Убраны описания Hybrid Build Strategy и Local Build Mode
- ✅ **Workflow**: Убран "Workflow (Local Build Mode - Fallback)"
- ✅ **Requirements**: Объединены в одну секцию (только Registry Mode требования)
- ✅ **Available Options**: Только `--use-registry`, `--image-tag`, `--sync-mode`, `--cleanup-mode`

**Ключевое изменение философии:**
- **БЫЛО (v9.1.2)**: "Registry Mode (рекомендуется) + Local Build Mode (fallback)"
- **СТАЛО (v9.1.3)**: "Registry-Only (единственный режим), сборка ТОЛЬКО в GitHub Actions CI/CD"

**Пользовательское требование:**
> "скрипт деплоя больше не должен собирать версии, только доставлять новые образы и перезапускать контейнеры"

**Impact:**
- deploy-test SKILL теперь отражает исключительно Registry-First подход
- Нет упоминаний опций, которые не используются на практике
- Документация соответствует реальному workflow (VERSION вручную → CI/CD build → server pull)

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

**Available Options:**
- ✅ `--use-registry` - Pull images from ghcr.io (обязательная опция)
- ✅ `--image-tag TAG` - Specify custom image tag for registry pull (optional)
- ✅ `--sync-mode MODE` - Code sync mode: update (default) | skip | mirror | clean
- ✅ `--cleanup-mode MODE` - Cleanup old images: smart (default) | full | skip

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
