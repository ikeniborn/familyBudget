# Deployment Skill

Автоматизация процесса деплоя приложения Family Budget.

## Быстрый старт

### Деплой на тестовый сервер

```bash
# Простой деплой
bash .claude/skills/deployment/templates/deploy-test.sh

# С автоматическим исправлением проблем
bash .claude/skills/deployment/templates/deploy-test.sh --auto-fix

# Создать алиас для быстрого доступа
echo "alias deploy-test='cd ~/familyBudget && bash .claude/skills/deployment/templates/deploy-test.sh'" >> ~/.bashrc
source ~/.bashrc

# Использовать алиас
deploy-test
deploy-test --auto-fix
```

## Доступные команды

### 1. deploy-test.sh

**Назначение:** Автоматизированный деплой на тестовый сервер `budget-test`

**Что делает:**
- ✅ Проверяет SSH подключение
- ✅ Git pull в ветке test
- ✅ Запускает deploy.sh с оптимальными параметрами
- ✅ Анализирует логи деплоя и контейнеров
- ✅ Проверяет статус контейнеров
- ✅ Проверяет незавершенные процессы
- ✅ Автоматически исправляет проблемы (с --auto-fix)

**Опции:**
- `--auto-fix` - Автоматическое исправление проблем
- `--verbose` - Детальный вывод
- `--dry-run` - Показать что будет сделано без выполнения

**Примеры:**
```bash
bash .claude/skills/deployment/templates/deploy-test.sh
bash .claude/skills/deployment/templates/deploy-test.sh --auto-fix
bash .claude/skills/deployment/templates/deploy-test.sh --verbose
bash .claude/skills/deployment/templates/deploy-test.sh --dry-run
```

**Создаваемые логи:**
```
logs/
├── deploy-test_YYYYMMDD_HHMMSS.log          # Основной лог
├── deploy_output_YYYYMMDD_HHMMSS.log        # Вывод deploy.sh
├── server_deploy_YYYYMMDD_HHMMSS.log        # Логи /opt/budget/logs/deploy.log
├── container_backend_YYYYMMDD_HHMMSS.log    # Логи backend
├── container_postgres_YYYYMMDD_HHMMSS.log   # Логи postgres
├── container_redis_YYYYMMDD_HHMMSS.log      # Логи redis
└── container_status_YYYYMMDD_HHMMSS.json    # Статус контейнеров
```

## Документация

- [SKILL.md](SKILL.md) - Полная документация deployment skill
- [examples/deploy-test-workflow.md](examples/deploy-test-workflow.md) - Примеры использования deploy-test
- [templates/docker-compose-service.yml](templates/docker-compose-service.yml) - Шаблон docker-compose сервиса

## Типичные сценарии

### Сценарий 1: Быстрый тест изменений

```bash
# 1. Локальные изменения
git add .
git commit -m "fix: исправление"
git push origin test

# 2. Деплой
deploy-test

# 3. Результат автоматически анализируется
```

### Сценарий 2: Проблемный деплой

```bash
# 1. Деплой с автофиксом
deploy-test --auto-fix --verbose

# 2. Анализ логов
cat logs/deploy-test_*.log

# 3. Исправление проблем локально
vim backend/app/main.py

# 4. Повторный деплой
git commit -am "fix: исправление"
git push origin test
deploy-test
```

### Сценарий 3: Ночной автоматический деплой

```bash
# Добавить в crontab
crontab -e

# Добавить:
0 2 * * * cd ~/familyBudget && bash .claude/skills/deployment/templates/deploy-test.sh --auto-fix >> logs/cron-deploy.log 2>&1
```

## Troubleshooting

### SSH подключение не удается

```bash
# Проверить ключи
ssh-add -l
ssh-add ~/.ssh/id_rsa

# Проверить подключение
ssh budget-test
```

### Git pull завершается с конфликтами

```bash
# Разрешить конфликты на сервере
ssh budget-test
cd ~/familyBudget
git stash
git pull origin test
```

### Контейнеры unhealthy

```bash
# Автоматическое исправление
deploy-test --auto-fix

# Или вручную
ssh budget-test "cd /opt/budget && docker compose restart"
```

## Связанные файлы

- `~/familyBudget/deploy.sh` - Основной скрипт деплоя
- `~/familyBudget/setup.sh` - Синхронизация кода
- `/opt/budget/logs/deploy.log` - Логи деплоя на сервере
- `/opt/budget/docker-compose.yml` - Docker Compose конфигурация

## Полезные команды

```bash
# Статус деплоя
cat logs/deploy-test_*.log | grep -E "SUCCESS|ERROR"

# Последние логи всех сервисов
for service in backend postgres redis; do
    echo "=== $service ==="
    cat logs/container_${service}_*.log | tail -10
done

# Статус контейнеров
cat logs/container_status_*.json | jq '.'

# Очистка старых логов (>7 дней)
find logs/ -name "deploy-test_*" -mtime +7 -delete
find logs/ -name "container_*" -mtime +7 -delete
```

## Вклад

При создании новых шаблонов деплоя:
1. Создайте файл в `templates/`
2. Добавьте пример в `examples/`
3. Обновите `SKILL.md`
4. Добавьте тесты

## Лицензия

MIT
