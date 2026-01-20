# Пример неудачного восстановления (disk space)

Этот пример демонстрирует обработку критической ошибки, которая не может быть исправлена автоматически.

## Сценарий

Сервер budget-test исчерпал место на диске из-за накопления старых Docker образов и логов. Deploy-test обнаружил критическую ошибку `No space left on device` и немедленно прервал деплой с инструкциями для ручного исправления.

## Вывод консоли

```
[2026-01-20 14:30:15] [INFO] =========================================
[2026-01-20 14:30:15] [INFO] Deploy-test v2.0.0 с автоматическим восстановлением
[2026-01-20 14:30:15] [INFO] Сервер: budget-test
[2026-01-20 14:30:15] [INFO] Ветка: test
[2026-01-20 14:30:15] [INFO] Макс. попыток: 3
[2026-01-20 14:30:15] [INFO] Лог файл: ./logs/deploy-test_20260120_143015.log
[2026-01-20 14:30:15] [INFO] =========================================

[2026-01-20 14:30:16] [INFO] Проверка SSH подключения к budget-test...
[2026-01-20 14:30:17] [SUCCESS] SSH подключение установлено

[2026-01-20 14:30:17] [INFO] =========================================
[2026-01-20 14:30:17] [INFO] Предварительная проверка локального кода
[2026-01-20 14:30:17] [INFO] =========================================
[2026-01-20 14:30:17] [INFO] Проверка TypeScript типов...
[2026-01-20 14:30:20] [SUCCESS] TypeScript type-check: OK
[2026-01-20 14:30:20] [INFO] Python linting: пропущено (flake8 не установлен)
[2026-01-20 14:30:20] [INFO] Проверка сборки фронтенда...
[2026-01-20 14:30:25] [SUCCESS] Frontend build: OK
[2026-01-20 14:30:25] [SUCCESS] Предварительная проверка пройдена успешно

[2026-01-20 14:30:25] [INFO] Выполнение git pull на сервере...
[2026-01-20 14:30:27] [SUCCESS] Git pull на сервере выполнен успешно

[2026-01-20 14:30:27] [INFO] =========================================
[2026-01-20 14:30:27] [INFO] Использование автоматического восстановления v2.0.0
[2026-01-20 14:30:27] [INFO] =========================================

[2026-01-20 14:30:27] [INFO]
[2026-01-20 14:30:27] [INFO] =========================================
[2026-01-20 14:30:27] [INFO] ПОПЫТКА 1 из 3
[2026-01-20 14:30:27] [INFO] =========================================
[2026-01-20 14:30:27] [INFO] Выполнение деплоя с проверками...
[2026-01-20 14:30:27] [INFO] Запуск деплоя...
[2026-01-20 14:30:27] [INFO] Команда деплоя: sudo bash deploy.sh --sync-mode update --cleanup-mode smart --version minor

[2026-01-20 14:30:35] [ERROR] Деплой завершился с ошибкой

ERROR: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: error mounting "/var/lib/docker/overlay2/..." to rootfs at "/opt/budget": mkdir /var/lib/docker/overlay2/.../merged: no space left on device: unknown

[2026-01-20 14:30:35] [WARNING] Деплой завершился с ошибкой на попытке 1

[2026-01-20 14:30:35] [INFO] Анализ логов деплоя...
[2026-01-20 14:30:35] [INFO] =========================================
[2026-01-20 14:30:35] [INFO] Классификация ошибки:
[2026-01-20 14:30:35] [INFO] =========================================
[2026-01-20 14:30:35] [INFO] Тип:         NOT_FIXABLE
[2026-01-20 14:30:35] [INFO] Категория:   disk_space
[2026-01-20 14:30:35] [INFO] Severity:    critical
[2026-01-20 14:30:35] [INFO] Описание:    Disk space exhausted
[2026-01-20 14:30:35] [INFO] =========================================

[2026-01-20 14:30:35] [ERROR] Обнаружена критическая ошибка, прерывание попыток

[2026-01-20 14:30:35] [ERROR] =========================================
[2026-01-20 14:30:35] [ERROR] ТРЕБУЕТСЯ РУЧНОЕ ИСПРАВЛЕНИЕ
[2026-01-20 14:30:35] [ERROR] =========================================
[2026-01-20 14:30:35] [ERROR] Категория: disk_space
[2026-01-20 14:30:35] [ERROR] Severity:  critical
[2026-01-20 14:30:35] [ERROR]
[2026-01-20 14:30:35] [ERROR] Инструкции:
[2026-01-20 14:30:35] [ERROR]   Free up disk space:
[2026-01-20 14:30:35] [ERROR]     docker system prune -a
[2026-01-20 14:30:35] [ERROR]     docker volume prune
[2026-01-20 14:30:35] [ERROR]     Check /opt/budget/logs/ for large files
[2026-01-20 14:30:35] [ERROR] =========================================

[2026-01-20 14:30:35] [ERROR] =========================================
[2026-01-20 14:30:35] [ERROR] ВСЕ ПОПЫТКИ ИСЧЕРПАНЫ
[2026-01-20 14:30:35] [ERROR] =========================================

[2026-01-20 14:30:35] [INFO] =========================================
[2026-01-20 14:30:35] [INFO] Генерация summary отчета
[2026-01-20 14:30:35] [INFO] =========================================
[2026-01-20 14:30:35] [INFO] Summary сохранен в: ./logs/summary_20260120_143015.md

# Deploy-test Summary v2.0.0

**Status:** FAILED
**Timestamp:** 2026-01-20 14:30:35
**Server:** budget-test
**Branch:** test

## Deployment Details

- **Version bump:** --version minor
- **Force build:** no
- **Max retry attempts:** 3
- **Attempts used:** 1
- **Auto-fix enabled:** true
- **Auto-commit enabled:** yes

## Logs

- Main log: `./logs/deploy-test_20260120_143015.log`
- Deploy output: `./logs/deploy_output_20260120_143015.log`
- Server deploy log: `./logs/server_deploy_20260120_143015.log`

## Failure Details

❌ Deployment failed after 1 attempt(s)
❌ Check logs for detailed error information

## Troubleshooting

1. Review error logs in `./logs/`
2. Check container status: `ssh budget-test "cd /opt/budget && docker compose ps"`
3. View container logs: `ssh budget-test "cd /opt/budget && docker compose logs --tail=100"`
4. Verify git status: `ssh budget-test "cd ~/familyBudget && git status"`

[2026-01-20 14:30:35] [ERROR] =========================================
[2026-01-20 14:30:35] [ERROR] ДЕПЛОЙ НЕ УДАЛСЯ ПОСЛЕ 1 ПОПЫТОК
[2026-01-20 14:30:35] [ERROR] =========================================
```

## Что произошло

1. **Попытка 1:** Деплой завершился с критической ошибкой `No space left on device`
2. **Классификация:** Ошибка определена как `NOT_FIXABLE` категории `disk_space` с severity `critical`
3. **Abort on critical:** Поскольку `abort_on_critical=true` в retry-config.json, деплой немедленно прерван
4. **Manual action:** Выведены инструкции для ручного исправления

## Ручное исправление

Подключиться к серверу и освободить место:

```bash
# 1. Подключиться к серверу
ssh budget-test

# 2. Проверить использование диска
df -h

# Вывод:
# Filesystem      Size  Used Avail Use% Mounted on
# /dev/sda1        50G   49G  100M  99% /

# 3. Очистить Docker (основной потребитель)
docker system prune -a

# WARNING! This will remove:
#   - all stopped containers
#   - all networks not used by at least one container
#   - all images without at least one container associated to them
#   - all build cache
# Are you sure you want to continue? [y/N] y
#
# Deleted Images:
# ...
# Total reclaimed space: 15.2GB

# 4. Очистить неиспользуемые volumes
docker volume prune

# WARNING! This will remove anonymous local volumes not used by at least one container.
# Are you sure you want to continue? [y/N] y
#
# Total reclaimed space: 2.3GB

# 5. Очистить старые логи
cd /opt/budget/logs
du -sh *
# 3.2G  deploy.log
# 1.5G  backend.log
# 890M  frontend.log

# Удалить старые логи (оставить последние 100 строк)
for log in *.log; do
    tail -n 100 "$log" > "$log.tmp" && mv "$log.tmp" "$log"
done

# 6. Проверить освобожденное место
df -h

# Вывод:
# Filesystem      Size  Used Avail Use% Mounted on
# /dev/sda1        50G   28G   20G  59% /

# 7. Повторить деплой
cd ~/familyBudget
bash .claude/skills/deploy-test/templates/deploy-test.sh --version minor
```

## Результат после исправления

```
[2026-01-20 14:45:10] [SUCCESS] =========================================
[2026-01-20 14:45:10] [SUCCESS] ДЕПЛОЙ ЗАВЕРШЕН УСПЕШНО!
[2026-01-20 14:45:10] [SUCCESS] =========================================
```

## Рекомендации

1. **Мониторинг диска:** Настроить автоматический мониторинг с алертами при достижении 80% использования
2. **Автоматическая очистка:** Настроить cron job для еженедельной очистки Docker образов
3. **Ротация логов:** Настроить logrotate для автоматической ротации логов деплоя
4. **Увеличение диска:** Рассмотреть возможность увеличения размера диска с 50GB до 100GB

## Почему автоматическое исправление невозможно

- **Безопасность:** `docker system prune -a` удаляет ВСЕ неиспользуемые образы, что может быть нежелательно
- **Данные:** Автоматическое удаление логов может потерять важную диагностическую информацию
- **Sudo требуется:** Очистка системных директорий требует sudo привилегий
- **Риск потери данных:** Лучше требовать ручного подтверждения для деструктивных операций
