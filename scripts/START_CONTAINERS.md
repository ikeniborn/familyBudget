# Запуск контейнеров на dev сервере

## Проблема
```
⚠️  Backend container is NOT running
```

## Решение

### Вариант 1: Запустить контейнеры вручную

```bash
cd /opt/budget
docker-compose up -d
```

**Проверка:**
```bash
docker-compose ps
```

Должно быть:
```
NAME                 STATUS
budget-backend-1     Up X minutes
budget-postgres-1    Up X minutes
budget-nginx-1       Up X minutes (если есть)
```

### Вариант 2: Использовать deploy.sh (рекомендуется)

```bash
cd ~/familyBudget
./deploy.sh --profile full
```

Deploy script автоматически:
- Синхронизирует файлы в /opt/budget
- Применяет миграции
- Перезапускает контейнеры
- Проверяет статус

### Проверка после запуска

```bash
cd ~/familyBudget

# Проверка контейнеров
docker-compose -f /opt/budget/docker-compose.yml ps

# Проверка инфраструктуры
./scripts/check_import_setup.sh
```

**Ожидается:**
```
✅ Backend container is running
✅ Table t_import_staging exists
✅ import_router found in v1 router
✅ tinkoff_csv_parser.py exists
```

### Проверка миграций

После запуска контейнеров проверьте миграции:

```bash
cd /opt/budget
docker-compose exec backend alembic current
```

**Ожидается:** `e60f86fd6465 (head)`

**Если миграция не применена:**
```bash
docker-compose exec backend alembic upgrade head
```

### Проверка таблицы

```bash
cd /opt/budget
docker-compose exec postgres psql -U postgres -d familybudget -c "\d t_import_staging"
```

Должна показать структуру таблицы с 13 колонками.

### Просмотр логов

```bash
cd /opt/budget

# Все логи backend
docker-compose logs backend --tail=100

# Следить в реальном времени
docker-compose logs backend -f

# Только ошибки
docker-compose logs backend --tail=200 | grep -i error
```

### Если контейнеры не запускаются

#### Проверка портов
```bash
# Проверить занятость портов
sudo netstat -tulpn | grep -E ":(8000|5432|80|443)"
```

#### Проверка docker
```bash
# Статус docker
sudo systemctl status docker

# Перезапуск docker (если нужно)
sudo systemctl restart docker
```

#### Очистка старых контейнеров
```bash
cd /opt/budget
docker-compose down
docker-compose up -d
```

#### Полная пересборка (если проблемы)
```bash
cd /opt/budget
docker-compose down -v  # ⚠️ Удалит данные!
docker-compose up -d --build
```

### Автозапуск контейнеров при перезагрузке сервера

Docker compose автоматически запустит контейнеры если они были up:

```bash
cd /opt/budget
docker-compose up -d
```

После перезагрузки сервера они должны стартовать автоматически.

### Быстрая диагностика

```bash
# 1. Проверка контейнеров
cd /opt/budget && docker-compose ps

# 2. Если не запущены - запустить
docker-compose up -d

# 3. Проверка инфраструктуры
cd ~/familyBudget && ./scripts/check_import_setup.sh

# 4. Проверка миграций
cd /opt/budget && docker-compose exec backend alembic current

# 5. Если нужно - применить миграции
docker-compose exec backend alembic upgrade head
```

### После запуска контейнеров

1. ✅ Проверить статус: `docker-compose ps`
2. ✅ Проверить миграции: `alembic current`
3. ✅ Проверить таблицу: `\d t_import_staging`
4. ✅ Открыть https://budget-dev.ikeniborn.ru/import
5. ✅ Загрузить CSV файл
6. ✅ Проверить в консоли - должна быть детальная ошибка (если есть)

### Типичные ошибки

#### "Cannot connect to Docker daemon"
```bash
sudo systemctl start docker
```

#### "Port already in use"
```bash
# Найти процесс
sudo lsof -i :8000

# Остановить старый контейнер
docker-compose down
```

#### "No such file or directory: docker-compose.yml"
```bash
# Проверить что вы в /opt/budget
cd /opt/budget
ls docker-compose.yml
```

## Резюме команд

```bash
# Полный цикл запуска
cd /opt/budget
docker-compose down  # Остановить если были
docker-compose up -d  # Запустить
docker-compose ps     # Проверить
docker-compose exec backend alembic current  # Проверить миграции
docker-compose exec backend alembic upgrade head  # Применить миграции (если нужно)

# Проверка после запуска
cd ~/familyBudget
./scripts/check_import_setup.sh
```
