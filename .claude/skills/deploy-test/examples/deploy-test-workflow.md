# Пример использования команды deploy-test

## Базовый деплой на тестовый сервер

### 1. Простой деплой

```bash
# Запуск автоматизированного деплоя
cd /home/ikeniborn/Documents/Project/familyBudget
bash .claude/skills/deploy-test/templates/deploy-test.sh
```

**Что происходит:**
1. Проверка SSH подключения к `budget-test`
2. Git pull в ветке `test` в `~/familyBudget`
3. Запуск `deploy.sh --sync-mode update --cleanup-mode smart --version patch`
4. Анализ логов деплоя (`/opt/budget/logs/deploy.log`)
5. Анализ логов контейнеров (backend, postgres, redis)
6. Проверка статуса контейнеров
7. Проверка незавершенных процессов

**Вывод:**
```
[INFO] =========================================
[INFO] Начало автоматизированного деплоя на тестовый сервер
[INFO] Сервер: budget-test
[INFO] Ветка: test
[INFO] Лог файл: ./logs/deploy-test_20260110_143022.log
[INFO] =========================================
[SUCCESS] SSH подключение установлено
[SUCCESS] Git pull в ветке test - OK
[SUCCESS] Деплой выполнен успешно
[SUCCESS] Логи деплоя не содержат ошибок
[SUCCESS] Логи backend не содержат критических ошибок
[SUCCESS] Логи postgres не содержат критических ошибок
[SUCCESS] Логи redis не содержат критических ошибок
[SUCCESS] Все контейнеры работают корректно
[SUCCESS] Незавершенных процессов деплоя не обнаружено
[INFO] =========================================
[SUCCESS] Деплой завершен успешно!
[INFO] Логи сохранены в: ./logs
```

### 2. Деплой с автоматическим исправлением проблем

```bash
# Запуск с флагом --auto-fix
bash .claude/skills/deploy-test/templates/deploy-test.sh --auto-fix
```

**Что происходит дополнительно:**
- Автоматический перезапуск unhealthy контейнеров
- Повторная попытка деплоя при ошибках
- Автоматическое завершение зависших процессов (>5 минут)

**Пример вывода с исправлением:**
```
[WARNING] Обнаружены нездоровые контейнеры:
backend (unhealthy)
[INFO] Попытка исправления проблемы: container_unhealthy
[INFO] Перезапуск нездоровых контейнеров...
[SUCCESS] Перезапуск контейнеров - OK
```

### 3. Детальный режим (verbose)

```bash
# Запуск с подробными логами
bash .claude/skills/deploy-test/templates/deploy-test.sh --verbose
```

**Вывод:**
- Полный вывод всех команд SSH
- Полные логи деплоя в реальном времени
- Детализация каждого шага

### 4. Проверка без выполнения (dry-run)

```bash
# Показать что будет сделано без реального выполнения
bash .claude/skills/deploy-test/templates/deploy-test.sh --dry-run
```

**Вывод:**
```
[INFO] [DRY-RUN] Would execute: ssh budget-test 'cd ~/familyBudget && git fetch --all && git checkout test && git pull origin test'
[INFO] [DRY-RUN] Would execute: cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --version patch
[INFO] [DRY-RUN] Would analyze: cat /opt/budget/logs/deploy.log | tail -100
[INFO] [DRY-RUN] Would check logs for: backend
[INFO] [DRY-RUN] Would check logs for: postgres
[INFO] [DRY-RUN] Would check logs for: redis
[INFO] [DRY-RUN] Would check container status
[INFO] [DRY-RUN] Would check running processes
```

## Сценарии использования

### Сценарий 1: Быстрый тест изменений

**Задача:** Протестировать изменения на тестовом сервере после коммита

```bash
# 1. Локальные изменения и коммит
git add .
git commit -m "fix: исправление бага в списках покупок"
git push origin test

# 2. Автоматический деплой на тестовый сервер
bash .claude/skills/deploy-test/templates/deploy-test.sh

# 3. Проверка результата
# Логи автоматически анализируются и сохраняются в ./logs/
```

**Время выполнения:** 2-5 минут

### Сценарий 2: Проблемный деплой

**Задача:** Деплой завершился с ошибками, нужно исправить

```bash
# 1. Запуск с автоматическим исправлением
bash .claude/skills/deploy-test/templates/deploy-test.sh --auto-fix --verbose

# 2. Анализ сохраненных логов
cat logs/deploy-test_*.log
cat logs/server_deploy_*.log
cat logs/container_backend_*.log

# 3. Исправление проблем локально
vim backend/app/main.py

# 4. Коммит и повторный деплой
git add .
git commit -m "fix: исправление ошибки деплоя"
git push origin test
bash .claude/skills/deploy-test/templates/deploy-test.sh
```

### Сценарий 3: Мониторинг после деплоя

**Задача:** Убедиться что деплой не оставил зависших процессов

```bash
# 1. Деплой
bash .claude/skills/deploy-test/templates/deploy-test.sh

# 2. Проверка через 5 минут (автоматически выполняется в скрипте)
# - Анализ логов контейнеров
# - Проверка статуса контейнеров
# - Проверка зависших процессов

# 3. Просмотр сохраненных логов
ls -lh logs/
cat logs/container_status_*.json
```

### Сценарий 4: Ночной деплой (cron)

**Задача:** Автоматический деплой каждую ночь в 2:00

```bash
# Добавить в crontab
crontab -e

# Добавить строку:
0 2 * * * cd /home/ikeniborn/Documents/Project/familyBudget && bash .claude/skills/deploy-test/templates/deploy-test.sh --auto-fix >> logs/cron-deploy.log 2>&1
```

## Анализ логов

### Структура логов

После выполнения деплоя создаются следующие файлы:

```
logs/
├── deploy-test_20260110_143022.log          # Основной лог скрипта
├── deploy_output_20260110_143022.log        # Вывод команды deploy.sh
├── server_deploy_20260110_143022.log        # Логи /opt/budget/logs/deploy.log
├── container_backend_20260110_143022.log    # Логи контейнера backend
├── container_postgres_20260110_143022.log   # Логи контейнера postgres
├── container_redis_20260110_143022.log      # Логи контейнера redis
└── container_status_20260110_143022.json    # Статус контейнеров (JSON)
```

### Поиск проблем в логах

```bash
# Поиск ошибок во всех логах
grep -i "error\|exception\|fatal" logs/deploy-test_*.log

# Поиск предупреждений
grep -i "warning" logs/deploy-test_*.log

# Анализ статуса контейнеров
cat logs/container_status_*.json | jq '.'

# Поиск зависших процессов
grep "зависшие процессы" logs/deploy-test_*.log
```

## Интеграция с Claude Code

### Использование как команды

Добавьте алиас в `.bashrc` или `.zshrc`:

```bash
alias deploy-test="cd /home/ikeniborn/Documents/Project/familyBudget && bash .claude/skills/deploy-test/templates/deploy-test.sh"
```

Теперь можно запускать из любой директории:

```bash
deploy-test
deploy-test --auto-fix
deploy-test --verbose
```

### Автоматический вызов из Claude Code

Когда пользователь говорит:
- "Задеплой на тестовый сервер"
- "Обновить код на budget-test"
- "Проверить деплой на тесте"

Claude Code автоматически вызовет:
```bash
bash .claude/skills/deploy-test/templates/deploy-test.sh
```

## Troubleshooting

### Проблема: SSH подключение не удается

**Решение:**
```bash
# Проверить SSH ключи
ssh-add -l

# Добавить ключ если нужно
ssh-add ~/.ssh/id_rsa

# Проверить подключение вручную
ssh budget-test
```

### Проблема: Git pull завершается с конфликтами

**Решение:**
```bash
# Подключиться к серверу вручную
ssh budget-test

# Разрешить конфликты
cd ~/familyBudget
git status
git stash  # или разрешить конфликты вручную
git pull origin test
```

### Проблема: Деплой зависает

**Решение:**
```bash
# Запустить в verbose режиме
bash .claude/skills/deploy-test/templates/deploy-test.sh --verbose

# Или проверить процессы на сервере
ssh budget-test "ps aux | grep deploy"
```

### Проблема: Контейнеры unhealthy

**Решение:**
```bash
# Автоматическое исправление
bash .claude/skills/deploy-test/templates/deploy-test.sh --auto-fix

# Или вручную
ssh budget-test "cd /opt/budget && docker compose restart"
```

## Связанные команды

- `deploy.sh` - Основной скрипт деплоя
- `logs.sh` - Просмотр логов сервисов
- `setup.sh` - Синхронизация кода
- `install.sh` - Установка зависимостей

## Полезные ссылки

- [deployment/SKILL.md](../SKILL.md) - Основная документация по деплою
- [docs/architecture/guides/deployment-troubleshooting.md](../../../docs/architecture/guides/deployment-troubleshooting.md) - Troubleshooting guide
- [CLAUDE.md](../../../CLAUDE.md) - Инструкции для Claude Code
