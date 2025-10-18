# Инструкция по доставке v5.2.0 на Production

## Статус: ✅ Готово к доставке

**Commit:** `7d8e96167b31ab13844bf3f62adae628df258d54`
**Ветка:** `telegram`
**Дата подготовки:** 2025-10-18

---

## Шаг 1: Отправить изменения в remote repository (опционально)

```bash
# На сервере разработки (если используется git remote)
cd /home/ikeniborn/Documents/Project/familyBudget

# Проверить текущий commit
git log -1 --oneline

# Отправить в remote
git push origin telegram

# Или если remote не настроен - пропустить этот шаг
```

---

## Шаг 2: Доставка на production сервер

### Вариант A: Через git pull (если production имеет доступ к git remote)

```bash
# На production сервере
cd /путь/к/familyBudget

# Создать резервную ветку (для rollback)
git branch backup-before-v5.2.0-$(date +%Y%m%d-%H%M%S)

# Загрузить обновления
git fetch origin
git pull origin telegram

# Проверить что нужный commit загружен
git log -1 --oneline
# Должен быть: 7d8e961 feat: Family Budget v5.2.0...
```

### Вариант B: Через rsync (если git remote недоступен)

```bash
# На сервере разработки
cd /home/ikeniborn/Documents/Project

# Синхронизировать с production (замените на свой production сервер)
rsync -avz --exclude '.git' \
    --exclude 'backups' \
    --exclude '.env' \
    --exclude 'data' \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    familyBudget/ user@production-server:/путь/к/familyBudget/

# Или создать архив для ручной загрузки
cd /home/ikeniborn/Documents/Project/familyBudget
tar -czf ../familybudget-v5.2.0.tar.gz \
    --exclude='.git' \
    --exclude='backups' \
    --exclude='.env' \
    --exclude='data' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    .

echo "Архив создан: /home/ikeniborn/Documents/Project/familybudget-v5.2.0.tar.gz"
echo "Загрузите его на production сервер и распакуйте"
```

### Вариант C: Через git patch (если git доступен локально)

```bash
# На сервере разработки - создать patch
cd /home/ikeniborn/Documents/Project/familyBudget
git format-patch -1 HEAD
# Создаст файл: 0001-feat-Family-Budget-v5.2.0...patch

# Скопировать .patch файл на production сервер

# На production сервере - применить patch
cd /путь/к/familyBudget
git apply 0001-feat-Family-Budget-v5.2.0...patch
git add .
git commit -m "feat: Family Budget v5.2.0 (applied from patch)"
```

---

## Шаг 3: Проверка доставки

```bash
# На production сервере
cd /путь/к/familyBudget

# Проверить что все файлы на месте
ls -la web/templates/telegram_login.html
ls -la docs/deployment/PRODUCTION_UPDATE_v5.2.0.md
ls -la CHANGELOG_v5.2.0.md

# Проверить изменения в deploy.sh
grep -n "setup_backup_cron" deploy.sh
# Должны быть строки: 1324-1399 (функция) и 1815 (вызов)

# Проверить изменения в auth.py
grep -n "telegram-login" backend/app/api/v1/endpoints/auth.py
# Должны быть GET endpoints
```

---

## Шаг 4: Резервное копирование (ОБЯЗАТЕЛЬНО!)

```bash
# На production сервере
cd /путь/к/familyBudget

# Создать резервную копию БД перед деплоем
./scripts/backup.sh --verbose

# Проверить что бэкап создан
ls -lh backups/backup_*.sql.gz | tail -1

# Запомнить имя файла для возможного rollback
BACKUP_FILE=$(ls -t backups/backup_*.sql.gz | head -1)
echo "Backup created: $BACKUP_FILE"
```

---

## Шаг 5: Проверка конфигурации .env

```bash
# На production сервере
cd /путь/к/familyBudget
source .env

# Обязательные переменные
echo "POSTGRES_USER: $POSTGRES_USER"
echo "POSTGRES_DB: $POSTGRES_DB"
echo "TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:0:10}..."
echo "JWT_SECRET: ${JWT_SECRET:0:10}..."

# Опциональные для S3 (рекомендуется)
echo "S3_BUCKET_NAME: ${S3_BUCKET_NAME:-NOT SET}"
echo "AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}..."
```

**Если S3 не настроен:**
```bash
# Редактировать .env
nano .env

# Добавить (см. docs/deployment/BACKUP_RESTORE.md для деталей):
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalr...
S3_BUCKET_NAME=familybudget-backups-production
S3_ENDPOINT_URL=https://storage.yandexcloud.net
```

---

## Шаг 6: Применение обновлений

```bash
# На production сервере
cd /путь/к/familyBudget

# Запустить деплой
./deploy.sh

# Процесс займёт 2-5 минут
# Будут выполнены:
# - Проверка prerequisites
# - Валидация .env
# - Сборка образов (если нужно)
# - Запуск контейнеров
# - Миграция 013 (создание t_f_refresh_token)
# - Установка cron job для бэкапов
# - Настройка UFW firewall (интерактивно)
# - SSL настройка (если нужно)
```

---

## Шаг 7: После деплоя - переход к тестированию

После успешного завершения `./deploy.sh` выполните следующие проверки:

```bash
# 1. Проверить статус контейнеров
docker compose ps

# 2. Проверить логи на ошибки
docker compose logs backend | grep ERROR
docker compose logs bot | grep ERROR

# 3. Проверить healthcheck
curl http://localhost:8000/health
```

**Далее переходите к тестированию согласно TODO листу:**
1. ✅ Проверить что миграция 013 применилась
2. ✅ Проверить nginx healthcheck статус
3. ✅ Проверить UFW правила (80, 443)
4. ✅ Протестировать Telegram Bot авторизацию (/start)
5. ✅ Протестировать Web авторизацию через Widget
6. ✅ Протестировать автоматический бэкап

**Детальные инструкции по тестированию:**
См. `docs/deployment/PRODUCTION_UPDATE_v5.2.0.md`, раздел "Верификация обновлений"

---

## Rollback план (если что-то пошло не так)

### Быстрый откат к предыдущей версии

```bash
# Остановить сервисы
docker compose down

# Откатиться к резервной ветке
git checkout backup-before-v5.2.0-*

# Восстановить БД из бэкапа
BACKUP_FILE="backups/backup_20251018_HHMMSS.sql.gz"  # Файл из Шага 4

docker compose up -d postgres
source .env
docker compose exec -T postgres psql -U $POSTGRES_USER -d postgres -c "DROP DATABASE IF EXISTS $POSTGRES_DB;"
docker compose exec -T postgres psql -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $POSTGRES_DB;"
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# Запустить все сервисы
docker compose up -d

# Проверить статус
docker compose ps
curl http://localhost:8000/health
```

**Полные инструкции по rollback:**
См. `docs/deployment/PRODUCTION_UPDATE_v5.2.0.md`, раздел "Rollback"

---

## Что включено в v5.2.0

### Phase 1: Critical Fixes
- ✅ Migration 013 - таблица refresh tokens
- ✅ Nginx healthcheck endpoint
- ✅ UFW firewall auto-config

### Phase 2: Web Auth
- ✅ Telegram Login Widget
- ✅ Auto-fetch bot username
- ✅ GET endpoints для web login

### Phase 3: Backups
- ✅ Cron job auto-installation
- ✅ S3 integration
- ✅ Backup/restore documentation

**Полный список изменений:** `CHANGELOG_v5.2.0.md`

---

## Контакты

При возникновении проблем:
1. Проверьте логи: `docker compose logs -f`
2. Проверьте документацию в `docs/deployment/`
3. Используйте rollback план если необходимо

---

**Статус:** ✅ Готово к доставке и деплою
**Следующий шаг:** Доставка на production → Деплой → Тестирование
