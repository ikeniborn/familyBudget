---
name: deploy-test
description: Автоматизированный деплой на тестовый сервер budget-test
version: 1.0.0
author: Family Budget Team
tags: [deployment, automation, testing, ssh, budget-test]
dependencies: [monitoring]
context: fork
user-invocable: true
---

# Deploy Test Automation Skill

Автоматизирует весь процесс деплоя на тестовый сервер budget-test с полным анализом логов и проверкой состояния.

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

## Использование версионирования (v7.0+)

**Базовый деплой (БЕЗ изменения версии):**
```bash
./deploy-test.sh
```

**С версионированием:**
```bash
# Bug fixes (patch: 6.6.0 → 6.6.1)
./deploy-test.sh --version patch

# New features (minor: 6.6.0 → 6.7.0)
./deploy-test.sh --version minor

# Breaking changes (major: 6.6.0 → 7.0.0)
./deploy-test.sh --version major
```

**Дополнительные опции:**
```bash
# С автоисправлением и версионированием
./deploy-test.sh --auto-fix --version patch

# С подробными логами
./deploy-test.sh --verbose --version minor

# Dry-run (показать что будет сделано)
./deploy-test.sh --dry-run --version patch
```

**ВАЖНО:** С версии v7.0+ версия НЕ меняется автоматически. Для изменения версии используйте опцию `--version TYPE`.

## Алгоритм работы

Этот skill выполняет следующие шаги автоматически:

### Шаг 0: Интерактивный выбор опций деплоя

Перед началом деплоя Claude запрашивает параметры через AskUserQuestion.

**Условие показа диалога:**
- Показать диалог если пользователь НЕ указал явно параметры в запросе
- Пропустить диалог если параметры указаны явно (например: "деплой с версией minor", "deploy --version patch --force-build")

**Примеры явного указания параметров:**
- "задеплой с версией patch" → версия=patch, показать только вопрос про доп. опции
- "деплой --version minor --force-build" → версия=minor, force-build=да, пропустить диалог
- "деплой на тест" → показать полный диалог
- "обновить на budget-test" → показать полный диалог

**AskUserQuestion - Вопрос 1: Тип версии**
```json
{
  "question": "Какой тип версии использовать для деплоя?",
  "header": "Version",
  "options": [
    {"label": "patch (Recommended)", "description": "Bug fixes: 6.6.0 → 6.6.1"},
    {"label": "minor", "description": "New features: 6.6.0 → 6.7.0"},
    {"label": "major", "description": "Breaking changes: 6.6.0 → 7.0.0"},
    {"label": "none", "description": "Без изменения версии"}
  ],
  "multiSelect": false
}
```

**AskUserQuestion - Вопрос 2: Дополнительные опции**
```json
{
  "question": "Какие дополнительные опции применить?",
  "header": "Options",
  "options": [
    {"label": "Стандартный деплой (Recommended)", "description": "Без дополнительных опций"},
    {"label": "--force-build", "description": "Принудительная пересборка frontend"},
    {"label": "--verbose", "description": "Детальный вывод всех операций"},
    {"label": "--dry-run", "description": "Показать план без выполнения"}
  ],
  "multiSelect": true
}
```

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
