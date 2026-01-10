# Пример использования команды deploy-prod

## Базовый деплой на production сервер

### 1. Простой деплой

```bash
# Запуск автоматизированного деплоя
cd /home/ikeniborn/Documents/Project/familyBudget
bash .claude/skills/deploy-prod/templates/deploy-prod.sh
```

**Что происходит:**
1. Проверка SSH подключения к `budget-prod`
2. Git pull в ветке `prod` в `~/familyBudget`
3. Запуск `deploy.sh --sync-mode update --cleanup-mode smart --patch`
4. Анализ логов деплоя (`/opt/budget/logs/deploy.log`)
5. Анализ логов контейнеров (backend, postgres, redis)
6. Проверка статуса контейнеров
7. Проверка незавершенных процессов

**Вывод:**
```
[INFO] =========================================
[INFO] Начало автоматизированного деплоя на production сервер
[INFO] Сервер: budget-prod
[INFO] Ветка: prod
[INFO] Лог файл: ./logs/deploy-prod_20260110_143022.log
[INFO] =========================================
[SUCCESS] SSH подключение установлено
[SUCCESS] Git pull в ветке prod - OK
[INFO] Запуск деплоя...
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
bash .claude/skills/deploy-prod/templates/deploy-prod.sh --auto-fix
```

**Особенности:**
- Автоматически перезапускает unhealthy контейнеры
- Повторяет деплой при ошибках
- Завершает зависшие процессы (>5 минут)

**Пример с автоисправлением:**
```
[WARNING] Обнаружены нездоровые контейнеры:
backend: unhealthy
[INFO] Попытка исправления проблемы: container_unhealthy
[INFO] Перезапуск нездоровых контейнеров...
[SUCCESS] Перезапуск контейнеров - OK
```

### 3. Детальный режим (verbose)

```bash
bash .claude/skills/deploy-prod/templates/deploy-prod.sh --verbose
```

**Особенности:**
- Показывает полный вывод всех команд
- Полезно для debugging
- Логи сохраняются с полными деталями

### 4. Режим проверки (dry-run)

```bash
bash .claude/skills/deploy-prod/templates/deploy-prod.sh --dry-run
```

**Особенности:**
- Показывает что будет выполнено без реального выполнения
- Безопасная проверка перед реальным деплоем
- Полезно для тестирования скрипта

**Вывод:**
```
[INFO] [DRY-RUN] Would execute: ssh budget-prod 'cd ~/familyBudget && git fetch --all && git checkout prod && git pull origin prod'
[INFO] [DRY-RUN] Would execute: cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch
[INFO] [DRY-RUN] Would analyze: cat /opt/budget/logs/deploy.log | tail -100
```

## Сценарии использования

### Сценарий 1: Регулярный деплой после тестирования

```bash
# 1. Убедитесь, что изменения протестированы на budget-test
ssh budget-test "cd /opt/budget && docker compose ps"

# 2. Сделайте деплой на production
bash .claude/skills/deploy-prod/templates/deploy-prod.sh
```

### Сценарий 2: Деплой с автоматическим исправлением

```bash
# Для production рекомендуется автоисправление
bash .claude/skills/deploy-prod/templates/deploy-prod.sh --auto-fix --verbose
```

### Сценарий 3: Проверка перед деплоем

```bash
# Сначала dry-run для проверки
bash .claude/skills/deploy-prod/templates/deploy-prod.sh --dry-run

# Затем реальный деплой
bash .claude/skills/deploy-prod/templates/deploy-prod.sh
```

### Сценарий 4: Запланированный деплой (cron)

```bash
# Добавить в crontab для регулярных деплоев (осторожно на production!)
# Например, каждый день в 2:00 AM
0 2 * * * cd /home/ikeniborn/Documents/Project/familyBudget && bash .claude/skills/deploy-prod/templates/deploy-prod.sh --auto-fix >> logs/cron-deploy-prod.log 2>&1
```

## Анализ логов

### Структура логов

```
logs/deploy-prod/
├── YYYYMMDD_HHMMSS/
│   ├── deploy-prod_YYYYMMDD_HHMMSS.log        # Основной лог
│   ├── deploy_output_YYYYMMDD_HHMMSS.log      # Вывод deploy.sh
│   ├── server_deploy_YYYYMMDD_HHMMSS.log      # Логи /opt/budget/logs/deploy.log
│   ├── container_backend_YYYYMMDD_HHMMSS.log  # Логи backend
│   ├── container_postgres_YYYYMMDD_HHMMSS.log # Логи postgres
│   ├── container_redis_YYYYMMDD_HHMMSS.log    # Логи redis
│   └── container_status_YYYYMMDD_HHMMSS.json  # Статус контейнеров
```

### Анализ ошибок

```bash
# Посмотреть последний основной лог
tail -50 logs/deploy-prod_*.log | grep -E "ERROR|WARNING"

# Посмотреть логи деплоя
cat logs/deploy_output_*.log

# Анализ логов контейнеров
cat logs/container_backend_*.log | grep -i error
cat logs/container_postgres_*.log | grep -i error
cat logs/container_redis_*.log | grep -i error

# Статус контейнеров (JSON)
cat logs/container_status_*.json | jq .
```

## Интеграция с Git workflow

### Pre-deployment checklist

```bash
# 1. Проверить что все тесты прошли
pytest

# 2. Проверить что изменения закоммичены
git status

# 3. Создать тег релиза (опционально)
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3

# 4. Запустить деплой
bash .claude/skills/deploy-prod/templates/deploy-prod.sh
```

## Настройка алиаса

Для удобства создайте алиас:

```bash
echo "alias deploy-prod='cd /home/ikeniborn/Documents/Project/familyBudget && bash .claude/skills/deploy-prod/templates/deploy-prod.sh'" >> ~/.bashrc
source ~/.bashrc
```

Теперь можно использовать просто:

```bash
deploy-prod
deploy-prod --auto-fix
deploy-prod --verbose
```

## Troubleshooting

### Проблема: SSH подключение не удалось

**Решение:**
1. Проверить SSH ключи: `ssh-add -l`
2. Попробовать ручное подключение: `ssh budget-prod`
3. Проверить ~/.ssh/config

### Проблема: Git pull завершился с конфликтами

**Решение:**
```bash
# Подключиться к серверу
ssh budget-prod

# Посмотреть конфликтующие файлы
cd ~/familyBudget
git status

# Вариант 1: Stash изменений (ОСТОРОЖНО!)
git stash
git pull origin prod

# Вариант 2: Hard reset (ОСТОРОЖНО на production!)
git reset --hard origin/prod
```

### Проблема: Контейнеры unhealthy после деплоя

**Решение:**
```bash
# Использовать auto-fix
bash .claude/skills/deploy-prod/templates/deploy-prod.sh --auto-fix

# Или вручную
ssh budget-prod "cd /opt/budget && docker compose restart backend"
```

## Best Practices

1. **Всегда тестируйте на budget-test перед деплоем на production**
2. **Используйте --dry-run перед реальным деплоем**
3. **Мониторьте логи после деплоя**
4. **Делайте backup перед критическими изменениями**
5. **Используйте git tags для версионирования релизов**
6. **Документируйте изменения в CHANGELOG.md**
7. **ОСТОРОЖНО с --auto-fix на production - проверяйте что исправляется**
