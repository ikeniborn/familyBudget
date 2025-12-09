# PostgreSQL Volume Migration: Bind Mount → Docker Managed

## Целевая архитектура

| Volume | Тип | Причина |
|--------|-----|---------|
| `postgres_data` | Docker managed | Автоматическое управление permissions, нет repair-функций |
| `postgres_backups` | Bind mount | Прямой доступ к бэкапам с хоста |

## Это РАЗОВАЯ миграция

Скрипт автоматически проверяет, была ли миграция выполнена ранее, и откажется запускаться повторно.

## Текущая ситуация на production

Docker создал volume `budget_postgres_data` с bind mount options:
- Данные физически в `/opt/budget/data/postgres`
- Volume использует `driver_opts: device: /opt/budget/data/postgres`
- Это **bind mount volume**, а не Docker managed volume

После миграции:
- Данные будут в Docker managed volume `/var/lib/docker/volumes/budget_postgres_data/_data/`
- Оригинальные данные сохранены в `/opt/budget/data/postgres.backup`
- `docker-compose.yml` будет использовать `external: true` volume

## Prerequisites

- Root access (`sudo`)
- PostgreSQL container running and healthy (для SQL backup)
- Disk space: 2x текущего размера данных (~200 MB для текущего production)
- Запуск из директории репозитория (`~/familyBudget`)

## Миграция

**ВАЖНО:** Все скрипты запускаются из директории репозитория (`~/familyBudget`), НЕ из `/opt/budget`.

```bash
# Перейти в директорию репозитория
cd ~/familyBudget

# 0. Проверить текущий статус
sudo ./scripts/migrate_to_docker_volume.sh --check

# 1. Backup в S3 (ОБЯЗАТЕЛЬНО!)
./scripts/backup.sh --force-s3

# 2. Миграция
sudo ./scripts/migrate_to_docker_volume.sh

# 3. Обновить репозиторий (docker-compose.yml с external volume)
git pull origin main  # или test branch

# 4. Deploy
sudo bash deploy.sh --sync-mode update --cleanup-mode smart

# 5. Проверка (из /opt/budget, где работает docker-compose)
cd /opt/budget
docker compose ps
docker compose exec postgres pg_isready -U familybudget
curl -f http://localhost:8000/health

# 6. Проверить что volume теперь Docker managed
docker volume inspect budget_postgres_data --format '{{.Options}}'
# Должен вернуть: map[] (пустой, без device)
```

## Что делает скрипт миграции

1. **Pre-checks**: Проверяет root, Docker, существование volume, тип volume (bind mount)
2. **SQL Backup**: Создаёт `pg_dump` в `/opt/budget/backups/pre_migration_*.sql.gz`
3. **docker-compose.yml backup**: Сохраняет текущий compose файл
4. **Stop services**: Останавливает все контейнеры (`docker compose down`)
5. **Create temp volume**: Создаёт временный Docker managed volume
6. **Copy data**: Копирует данные из старого volume в временный (rsync с checksums)
7. **Verify**: Проверяет file count и критические директории PostgreSQL
8. **Swap volumes**: Удаляет старый bind mount volume, создаёт новый с тем же именем
9. **Backup bind mount dir**: Перемещает `/opt/budget/data/postgres` → `/opt/budget/data/postgres.backup`

## Rollback

```bash
cd ~/familyBudget
sudo ./scripts/migrate_to_docker_volume.sh --rollback
```

Rollback:
1. Останавливает сервисы
2. Удаляет новый Docker managed volume
3. Восстанавливает `/opt/budget/data/postgres` из backup
4. Восстанавливает `docker-compose.yml` из backup
5. Требует повторный deploy со старым compose файлом

## Проверка статуса

```bash
cd ~/familyBudget
sudo ./scripts/migrate_to_docker_volume.sh --check
```

Показывает:
- Тип volume (bind mount или Docker managed)
- Размер данных и file count
- Наличие backup директории
- Конфигурация docker-compose.yml
- Статус PostgreSQL контейнера

## Что меняется

**До миграции (docker-compose.yml на сервере):**
```yaml
postgres_data:
  driver: local
  driver_opts:
    type: none
    o: bind
    device: /opt/budget/data/postgres  # Bind mount
```

**После миграции (docker-compose.yml в репозитории):**
```yaml
postgres_data:
  external: true
  name: budget_postgres_data  # Docker managed volume
```

**Изменения:**
- Данные: `/opt/budget/data/postgres` → Docker volume `budget_postgres_data`
- Оригинал: сохранён в `/opt/budget/data/postgres.backup`
- Бэкапы: остаются в `/opt/budget/backups` (bind mount, без изменений)
- Repair-функции в deploy.sh: пропускаются автоматически (не нужны для Docker managed)

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Потеря данных при копировании | Низкая | SQL backup + file count verification + оригинал в backup |
| Downtime | 100% | Планировать на низкую нагрузку (5-10 минут) |
| Rollback не работает | Низкая | Оригинальные данные сохранены, docker-compose.yml backup |
| Disk space | Низкая | Pre-check требует 2x данных |

## Backward Compatibility

Существующие bind mount installations работают без миграции. Миграция опциональна, но рекомендуется для:
- Упрощения deploy (нет repair-функций)
- Лучшей изоляции данных
- Автоматического управления permissions

## Troubleshooting

### Volume не удаляется

```bash
# Проверить что нет запущенных контейнеров
docker ps -a | grep postgres

# Принудительно остановить
docker compose down --remove-orphans

# Повторить миграцию
sudo ./scripts/migrate_to_docker_volume.sh
```

### PostgreSQL не запускается после миграции

```bash
# Проверить логи
docker compose logs postgres

# Проверить данные в volume
docker run --rm -v budget_postgres_data:/data alpine ls -la /data/

# Если данные отсутствуют - rollback
sudo ./scripts/migrate_to_docker_volume.sh --rollback
```

### File count mismatch

Скрипт остановится и не удалит старый volume. Данные остаются нетронутыми.

```bash
# Проверить temp volume
docker run --rm -v budget_postgres_data_migration_temp:/data alpine find /data -type f | wc -l

# Удалить temp volume и повторить
docker volume rm budget_postgres_data_migration_temp
sudo ./scripts/migrate_to_docker_volume.sh
```
