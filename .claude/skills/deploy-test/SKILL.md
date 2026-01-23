---
name: deploy-test
description: Автоматизированный деплой на тестовый сервер budget-test с registry-only архитектурой (все сборки в GitHub Actions CI/CD)
version: 9.0.0
author: Family Budget Team
tags: [deployment, automation, testing, ssh, budget-test, auto-recovery, error-handling, ci-cd, registry, registry-only]
dependencies: [monitoring]
context: fork
user-invocable: true
---

# Deploy Test Automation Skill v9.0.0

Автоматизирует весь процесс деплоя на тестовый сервер budget-test с:
- ✅ **Registry-Only Architecture** - все сборки в GitHub Actions CI/CD (v9.0+)
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

## Registry-First Versioning (v9.0+)

**КРИТИЧЕСКИ ВАЖНО:** VERSION должен обновляться ВРУЧНУЮ перед git push:

**Workflow:**
1. Обновить VERSION локально (в репозитории):
   ```bash
   cd ~/familyBudget
   echo "10.0.5" > VERSION
   git add VERSION
   git commit -m "chore: bump version to 10.0.5"
   git push origin test
   ```

2. GitHub Actions автоматически (~5 минут):
   - Собирает измененные Docker образы
   - Обновляет IMAGE_VERSIONS.json
   - Пушит образы в ghcr.io

3. Деплой с подтверждением версий:
   ```bash
   ./deploy-test.sh
   # → Показывает таблицу версий из IMAGE_VERSIONS.json
   # → Запрашивает: "Deploy these versions? [Y/n]"
   # → Пулит образы из ghcr.io
   # → docker compose up -d
   ```

**ВАЖНО:** Навык deploy-test НЕ меняет версии автоматически.

## Registry-Only Architecture (v9.0+)

**BREAKING CHANGE:** Build mode удален. Все сборки происходят ТОЛЬКО в GitHub Actions CI/CD.

**Архитектура:**
- ✅ Весь build (минификация, cache busting, упаковка) в GitHub Actions
- ✅ На сервере: только pull готовых Docker images из ghcr.io
- ✅ 5 кастомных образов: backend, bot, nginx, redis, postgresql
- ✅ Frontend embedded в backend Docker image
- ✅ Автоматическая очистка старых images (7 дней retention)
- ✅ IMAGE_VERSIONS.json содержит версию для каждого сервиса
- ✅ Автоматический вывод версий перед деплоем
- ✅ Интерактивное подтверждение обязательно
- ✅ Non-interactive режим авто-подтверждает (для CI/CD)

**Преимущества:**
- ✅ **Быстрый деплой:** 2-3 мин (vs 5-7 мин build mode)
- ✅ **Консистентность:** те же образы что в CI/CD
- ✅ **Безопасность:** нет npm/Node.js на production сервере
- ✅ **Надежность:** проверенные образы из CI/CD pipeline
- ✅ **Прозрачность:** видимость версий в мониторинге (docker ps)

**Workflow:**
```bash
# 1. Developer bumps VERSION manually
echo "6.6.1" > VERSION
git add VERSION
git commit -m "chore: bump version to 6.6.1"
git push origin test

# 2. GitHub Actions автоматически:
#    - Выполняет cache busting (git hash)
#    - Собирает frontend (npm run build:prod)
#    - Создает 5 Docker images с embedded кодом
#    - Пушит в ghcr.io/ikeniborn/familybudget-*:6.6.1

# 3. Deploy на сервере:
./deploy.sh --sync-mode update --cleanup-mode smart --version patch
#    - Читает VERSION file → 6.6.1
#    - Pull 5 images из ghcr.io
#    - docker compose up -d
#    - Migrations
#    - Health checks
#    - Cleanup old images (>7 days)
```

**IMPORTANT: Manual VERSION Bump Required**
- ✅ Developer MUST bump VERSION перед push
- ✅ GitHub Actions собирает образы с VERSION тегом
- ✅ Server pull образы по VERSION
- ❌ Automatic version increment removed (manual control)

**Rollback:**
```bash
# Откат на предыдущую версию
echo "6.6.0" > /opt/budget/VERSION
sudo bash deploy.sh

# Pull образов 6.6.0 из ghcr.io
# Перезапуск контейнеров
```

**Requirements:**
- ✅ GitHub Actions build MUST complete successfully
- ✅ Images MUST exist in ghcr.io/ikeniborn/familybudget-*:${VERSION}
- ✅ VERSION file MUST exist in /opt/budget/

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

**Новые опции v2.0.0:**
```bash
# Управление повторами
--max-retries N         # Максимум попыток (default: 3)
--retry-delay N         # Базовая задержка (default: 5s)

# Управление проверками
--skip-local-validation # Пропустить предварительную проверку кода
--no-auto-commit        # Не коммитить исправления автоматически
--rollback-on-fail      # Откатить на предыдущую версию при ошибке
```

**Примеры использования:**
```bash
# Деплой с 5 попытками и задержкой 10s
./deploy-test.sh --version patch --max-retries 5 --retry-delay 10

# Без автокоммита (исправления не пушатся)
./deploy-test.sh --version minor --no-auto-commit

# Пропустить локальную проверку
./deploy-test.sh --skip-local-validation

# Комбинация опций
./deploy-test.sh --version patch --max-retries 3 --skip-local-validation
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

**Опции автоматического восстановления (v2.0.0):**
- `--max-retries N` - максимум попыток деплоя (default: 3)
- `--retry-delay N` - базовая задержка между попытками (default: 5s)
- `--skip-local-validation` - пропустить предварительную проверку кода
- `--no-auto-commit` - не коммитить исправления автоматически
- `--rollback-on-fail` - откатить на предыдущую версию при ошибке

**Фиксированные опции (всегда применяются):**
- `--sync-mode update` - только обновление/добавление файлов
- `--cleanup-mode smart` - умная очистка старых образов

**Формирование итоговой команды:**
```bash
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart [--version TYPE] [OPTIONS]"
```

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

**Базовая команда (БЕЗ изменения версии - default v7.0+):**
```bash
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --version patch"
```

**С версионированием (v7.0+ синтаксис):**
```bash
# Bug fixes (patch bump: 6.6.0 → 6.6.1)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --version patch"

# New features (minor bump: 6.6.0 → 6.7.0)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --version minor"

# Breaking changes (major bump: 6.6.0 → 7.0.0)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --version major"
```

**Параметры:**
- `--sync-mode update` - только обновление/добавление файлов (безопасно)
- `--cleanup-mode smart` - умная очистка старых образов
- `--version TYPE` - версионирование (TYPE = patch|minor|major)
  - **ВАЖНО:** С v7.0+ версия НЕ меняется если опция не указана (explicit control)
  - Старый `--patch` deprecated (используйте `--version patch`)

**Опциональные параметры:**
- `--force-build` - принудительная пересборка frontend (игнорирует checksums)
  - Используется когда автоматическое определение изменений не сработало
  - Или для тестирования без изменения файлов
- `--set-version X.Y.Z` - явное указание версии (например `--set-version 7.0.0`)
- `--use-registry` - pull Docker images из ghcr.io вместо локальной сборки (v8.0+)
  - Требует наличие образов в GitHub Container Registry
  - Ускоряет деплой (~2-3 мин вместо 5-7 мин)
  - Автоопределение тега из git branch/VERSION/hash
- `--image-tag TAG` - явное указание тега для registry pull (v8.0+)
  - Работает только с `--use-registry`
  - Примеры: `--image-tag test`, `--image-tag 6.6.0`, `--image-tag sha-abc1234`

**Что происходит:**
- Синхронизация кода в /opt/budget
- Автоматическая синхронизация VERSION → package.json (если mismatch)
- Version bump (если указан --version TYPE)
- Синхронизация .npm-isolated/package.json после version bump
- Автоматическое определение необходимости пересборки frontend (checksums)
- Пересборка Docker образов (если нужно)
- Перезапуск контейнеров
- Health checks

**Примеры комбинаций:**
```bash
# Деплой без изменения версии + принудительная пересборка
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --force-build"

# Patch bump + принудительная пересборка
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --version patch --force-build"

# Явная версия
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --set-version 7.1.0"

# Registry mode: pull pre-built images (v8.0+)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart"

# Registry mode с явным тегом
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --image-tag test --sync-mode update --cleanup-mode smart"

# Registry mode + version bump (version bump без пересборки образов)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --version patch --sync-mode update --cleanup-mode smart"
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

### v9.0.0 (2026-01-21)
**BREAKING CHANGES:**
- ❌ **Build mode REMOVED**: Only registry mode supported
- ❌ **`--force-build` flag REMOVED**: All builds in GitHub Actions
- ❌ **`--use-registry` flag REMOVED**: Registry is now DEFAULT and ONLY mode
- ✅ **Manual VERSION bump REQUIRED**: Developer must bump VERSION before push
- ✅ **5 images pulled**: backend, bot, nginx, redis, postgresql (all custom)

**Registry-First Architecture:**
- All build (minification, cache busting, packaging) in GitHub Actions CI/CD
- Server only pulls ready Docker images from ghcr.io
- Frontend embedded in backend Docker image (no bind mounts)
- Custom images for ALL services (Redis, PostgreSQL, Nginx included)
- Only semver tags (6.6.0) - no "test", "sha-", "latest"

**Automatic Cleanup:**
- Old Docker images cleanup after deployment (7 days retention)
- Saves ~7GB disk space per week (1 deploy/day scenario)
- Running containers protected from deletion

**Workflow Changes:**
1. Developer bumps VERSION locally
2. GitHub Actions builds ALL 5 images
3. Server pulls images by VERSION tag
4. docker compose up -d
5. Automatic cleanup of old images

**Removed Options:**
- ~~`--force-build`~~ (removed in v9.0)
- ~~`--use-registry`~~ (default behavior)
- ~~`--image-tag TAG`~~ (VERSION file used)
- ~~`--skip-local-validation`~~ (no local build)

**New Requirements:**
- GitHub Actions MUST complete successfully before deployment
- VERSION file MUST be bumped manually
- Images MUST exist in ghcr.io before deployment

**Rollback:**
```bash
# Change VERSION file and redeploy
echo "6.6.0" > /opt/budget/VERSION
sudo bash deploy.sh
```

**See also:**
- `.github/workflows/build-and-push.yml` - CI/CD pipeline
- `docker-compose.yml` - Registry images configuration
- `docs/architecture/ci-cd-build-deploy.md` - Updated architecture

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
