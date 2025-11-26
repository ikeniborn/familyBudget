# Быстрый старт: Тестовый сервер

## 🎯 Цель

Этот файл содержит краткую шпаргалку для работы с тестовым сервером Family Budget.

---

## 🔐 SSH подключение

### Первое подключение в сессии

```bash
# 1. Инициализация ssh-agent
budget-ssh

# 2. Подключение
ssh budget-test
```

### Последующие подключения

```bash
ssh budget-test    # Полный алиас
ssh test          # Короткий алиас
```

---

## 🚀 Deployment на test server

### Полный workflow

```bash
# 1. Подключиться
ssh budget-test

# 2. Перейти в repo
cd ~/familyBudget

# 3. Обновить код
git pull origin main

# 4. Деплой
sudo ./deploy.sh --profile full

# 5. Проверить
docker compose ps
docker compose logs backend --tail=50
```

### Одной командой (из локальной машины)

```bash
ssh budget-test 'cd ~/familyBudget && git pull origin main && sudo ./deploy.sh --profile full'
```

---

## 🧪 Тестирование

### Integration тесты

```bash
# С локальной машины
ssh budget-test 'cd ~/familyBudget && pytest -m integration'

# На сервере
ssh budget-test
cd ~/familyBudget
pytest -m integration -v
```

### E2E тесты

```bash
# С локальной машины
ssh budget-test 'cd ~/familyBudget && pytest -m e2e'

# С подробным выводом
ssh budget-test 'cd ~/familyBudget && pytest -m e2e -v --tb=short'
```

### Coverage report

```bash
# Запустить на сервере
ssh budget-test 'cd ~/familyBudget && pytest --cov=backend --cov-report=html'

# Скачать отчёт локально
scp -r budget-test:~/familyBudget/htmlcov ./coverage-report/

# Открыть локально
open ./coverage-report/index.html
```

---

## 📊 Мониторинг

### Логи сервисов

```bash
# Backend (следить в реальном времени)
ssh budget-test 'docker compose logs backend -f'

# Bot
ssh budget-test 'docker compose logs bot -f'

# PostgreSQL
ssh budget-test 'docker compose logs postgres --tail=50'

# Nginx
ssh budget-test 'docker compose logs nginx --tail=100'

# Все сервисы (последние 50 строк)
ssh budget-test 'docker compose logs --tail=50'
```

### Статус сервисов

```bash
# Статус контейнеров
ssh budget-test 'docker compose ps'

# Использование ресурсов
ssh budget-test 'docker stats --no-stream'

# Disk usage
ssh budget-test 'df -h /opt/budget'
```

---

## 🔧 Частые операции

### Только миграции БД

```bash
ssh budget-test 'cd ~/familyBudget && sudo ./deploy.sh --migrations-only'
```

### Перезапуск сервиса

```bash
# Один сервис
ssh budget-test 'docker compose restart backend'

# Все сервисы
ssh budget-test 'docker compose restart'
```

### Копирование файлов

```bash
# С локальной машины → test server
scp file.txt budget-test:/tmp/

# С test server → локальная машина
scp budget-test:/opt/budget/.env ./env.backup
scp budget-test:/opt/budget/backups/latest.sql.gz ./

# Директория (рекурсивно)
scp -r ./frontend/ budget-test:/tmp/frontend-backup/
```

---

## 🐛 Troubleshooting

### SSH не работает

```bash
# Проверить что ключ добавлен
ssh-add -l

# Проверить доступность сервера
ping 205.172.58.179
nc -zv 205.172.58.179 22

# Debug SSH
ssh -v budget-test

# Переинициализация
budget-ssh
```

### Сервисы не запускаются

```bash
# Проверить статус
ssh budget-test 'docker compose ps'

# Проверить логи последних ошибок
ssh budget-test 'docker compose logs backend --tail=100 | grep -i error'

# Полный перезапуск
ssh budget-test 'cd ~/familyBudget && sudo ./deploy.sh --profile full'
```

### БД проблемы

```bash
# Проверить что PostgreSQL работает
ssh budget-test 'docker compose exec postgres pg_isready'

# Текущая ревизия миграций
ssh budget-test 'cd ~/familyBudget/backend/db/migrations && alembic current'

# Проверить подключение к БД
ssh budget-test 'docker compose exec backend python -c "from backend.app.core.database import engine; print(engine.url)"'
```

---

## 📚 Дополнительная информация

- **Полная документация:** `/home/ikeniborn/Documents/Project/familyBudget/CLAUDE.md`
- **SSH документация:** `~/.ssh/README-budget-test.md`
- **Skills:** `/home/ikeniborn/Documents/Project/familyBudget/SKILLS.md`

---

**Последнее обновление:** 2025-11-26
