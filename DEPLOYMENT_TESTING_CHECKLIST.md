# Deployment Testing Checklist

**Дата:** 2025-11-28
**Commit:** 448eab01
**Фокус:** Корректное управление изменениями при деплое (bind mount architecture)

---

## Что исправлено

### ✅ PostgreSQL Critical Directories Management

**Проблема:** Постоянное "⚠️ PostgreSQL Atomic Repair: 11 missing directories" при каждом деплое.

**Root Cause:**
- Bind mount архитектура: PostgreSQL создает критичные директории ТОЛЬКО при initdb
- Функция repair_postgres_directories_atomic() показывала warning даже когда все OK

**Решение:**
```bash
# scripts/lib/postgres.sh:164-171
# SILENT SUCCESS когда все директории присутствуют
if [[ ${#missing_dirs[@]} -eq 0 ]]; then
    # ✅ No output (everything is normal)
    return 0
fi

# Warning показывается ТОЛЬКО при реальном repair
```

**Expected Behavior:**
- ✅ При нормальном деплое (все директории на месте) → NO output
- ⚠️ При проблемах (missing directories) → Detailed warning с объяснением

---

### ✅ Race Conditions Prevention

**Проблема:** chown -R запускался даже когда PostgreSQL running → риск corruption.

**Решение:**
```bash
# scripts/lib/postgres.sh:494-507
# SAFETY GATE: Check PostgreSQL status FIRST
if [[ "$postgres_is_running" == "true" ]]; then
    info "PostgreSQL is running - skipping ALL filesystem modifications"
    success "Validation skipped safely (PostgreSQL active)"
    return 0
fi

# PostgreSQL stopped → safe to proceed
```

**Expected Behavior:**
- ✅ Если PostgreSQL running → Skip ALL filesystem modifications
- ✅ Если PostgreSQL stopped → Safe to chown -R

---

### ✅ Bot PTBUserWarning Fixed

**Проблема:** Warnings при запуске бота из-за missing ConversationHandler parameters.

**Решение:**
```python
# bot/handlers/*.py
ConversationHandler(
    # ... states ...
    per_user=True,     # Each user has independent state
    per_chat=True,     # Each chat has separate state
    per_message=False,  # Callbacks from any message
)
```

**Expected Behavior:**
- ✅ Бот запускается БЕЗ PTBUserWarning
- ✅ ConversationHandler работает корректно (multi-user support)

---

## Testing Plan

### PHASE 1: Local Repository Update

```bash
# На вашей локальной машине (dev environment)
cd ~/Documents/Project/familyBudget

# Проверить текущий статус
git status
git log --oneline -5

# Expected:
# 448eab01 fix: resolve PostgreSQL directories deletion and Bot PTBUserWarning issues
# (HEAD -> dev)
```

---

### PHASE 2: Deploy to budget-test

```bash
# 1. SSH на тестовый сервер
ssh budget-test

# 2. Обновить код из репозитория
cd ~/familyBudget  # ИЛИ ваш путь к репозиторию
git pull origin dev

# Verify commit
git log --oneline -1
# Expected: 448eab01 fix: resolve PostgreSQL directories deletion and Bot PTBUserWarning issues

# 3. Деплой с умными опциями
sudo bash deploy.sh --sync-mode update --cleanup-mode smart
```

---

### PHASE 3: Validation Checks

#### 3.1 Check Deployment Logs

```bash
# Проверить логи деплоя (НЕ должно быть "11 missing directories")
cat /opt/budget/logs/deploy.log | tail -100

# ✅ EXPECTED (normal flow - directories present):
# [INFO] Detected initialized PostgreSQL database (PG_VERSION exists)
# [INFO] PostgreSQL not running - safe to repair
# ← НЕТ WARNING о missing directories! Silent success return.

# ⚠️ EXPECTED (только если реально есть проблема - directories missing BEFORE stop):
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [WARNING] ⚠️  PostgreSQL Atomic Repair: Detected N missing critical directories
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ← Это означает РЕАЛЬНУЮ проблему (директории были удалены внешним процессом)
# (с детальным объяснением root cause и списком missing директорий)
```

#### 3.2 Check Container Status

```bash
cd /opt/budget

# Все контейнеры должны быть healthy
docker compose ps

# ✅ EXPECTED:
# familybudget-postgres   running   healthy
# familybudget-backend    running   healthy
# familybudget-bot        running   healthy (если --profile full)
```

#### 3.3 Check PostgreSQL Health

```bash
# Проверить логи PostgreSQL (НЕ должно быть FATAL errors)
docker compose logs postgres | tail -50

# ✅ EXPECTED (no errors):
# database system is ready to accept connections
# (no "could not open directory" errors)

# Проверить подключение
docker compose exec postgres pg_isready -U familybudget

# ✅ EXPECTED:
# /var/run/postgresql:5432 - accepting connections
```

#### 3.4 Check Critical Directories

```bash
# Проверить структуру директорий (все должны существовать)
sudo ls -la /opt/budget/data/postgres/ | grep "^d"

# ✅ EXPECTED (все критичные директории присутствуют):
# drwx------ 70 postgres  pg_notify
# drwx------ 70 postgres  pg_dynshmem
# drwx------ 70 postgres  pg_stat
# drwx------ 70 postgres  pg_tblspc
# drwx------ 70 postgres  pg_logical
# drwx------ 70 postgres  base
# drwx------ 70 postgres  global
# ... и т.д.
```

#### 3.5 Check Bot Warnings

```bash
# Проверить логи бота (НЕ должно быть PTBUserWarning)
docker compose logs bot | grep -i "warning\|ptb"

# ✅ EXPECTED (no PTBUserWarning):
# (пустой вывод ИЛИ только info-level messages)

# ❌ OLD BEHAVIOR (fixed):
# PTBUserWarning: If 'per_message=False', 'CallbackQueryHandler' will not be tracked...
```

---

### PHASE 4: Functional Testing

#### 4.1 Test Telegram Bot Commands

```bash
# Отправить команды боту через Telegram:
/start
/addplan
# ... follow conversation flow ...

# ✅ EXPECTED:
# - Бот отвечает на команды
# - ConversationHandler работает корректно
# - Можно создать/редактировать/удалить транзакции
# - Нет ошибок в логах
```

#### 4.2 Test Web Interface

```bash
# Открыть в браузере:
http://<budget-test-ip>:8000/

# ✅ EXPECTED:
# - Страница загружается
# - Можно авторизоваться через Telegram
# - Список транзакций отображается
# - CRUD операции работают
```

#### 4.3 Test Database Operations

```bash
# Проверить что БД работает
docker compose exec postgres psql -U familybudget -d familybudget -c "SELECT COUNT(*) FROM t_f_budget_fact;"

# ✅ EXPECTED:
# count
# -------
#   123
# (1 row)
```

---

### PHASE 5: Re-Deploy Test (Critical!)

**Это ключевой тест:** Проверить что повторный деплой НЕ показывает ложных warnings.

```bash
# На budget-test
cd ~/familyBudget

# Повторный деплой БЕЗ изменений в коде
sudo bash deploy.sh --sync-mode update --cleanup-mode smart

# ✅ EXPECTED в логах:
# [INFO] No code changes detected
# [INFO] PostgreSQL is stopped - safe to validate and fix permissions
# [SUCCESS] PostgreSQL permissions validated: 70:70 (recursive)
# ← НЕТ "11 missing directories" warning!

# Проверить что PostgreSQL запустился
docker compose ps postgres
# ✅ EXPECTED: healthy
```

---

### PHASE 6: Stress Test (Deploy с --cleanup-mode smart несколько раз подряд)

```bash
# На budget-test
for i in {1..3}; do
    echo "=== Deploy iteration $i ==="
    sudo bash deploy.sh --sync-mode update --cleanup-mode smart
    sleep 5
    docker compose ps | grep postgres
    echo ""
done

# ✅ EXPECTED:
# - Все 3 деплоя проходят успешно
# - НЕТ "11 missing directories" warnings
# - PostgreSQL всегда healthy после каждого деплоя
```

---

## Success Criteria

### ✅ PASS Criteria

1. **Deployment Logs:**
   - ✅ НЕТ "PostgreSQL Atomic Repair: 11 missing directories" при нормальном деплое
   - ✅ Warning показывается ТОЛЬКО при реальных проблемах

2. **Container Status:**
   - ✅ familybudget-postgres: healthy
   - ✅ familybudget-backend: healthy
   - ✅ familybudget-bot: healthy (если --profile full)

3. **PostgreSQL:**
   - ✅ Нет FATAL errors в логах
   - ✅ pg_isready возвращает success
   - ✅ Все критичные директории присутствуют

4. **Bot:**
   - ✅ Нет PTBUserWarning при запуске
   - ✅ ConversationHandler команды работают (/addplan, /edit, etc.)

5. **Re-Deploy:**
   - ✅ Повторный деплой НЕ показывает ложных warnings
   - ✅ PostgreSQL остаётся healthy

### ❌ FAIL Criteria (требуется fix)

1. **Deployment Logs:**
   - ❌ "11 missing directories" warning появляется ПРИ КАЖДОМ деплое (false alarm - FIXED!)
   - ❌ "11 missing directories" warning появляется ДАЖЕ КОГДА PostgreSQL healthy и running

2. **Container Status:**
   - ❌ PostgreSQL unhealthy или restarting
   - ❌ Backend/Bot unhealthy

3. **PostgreSQL:**
   - ❌ FATAL: could not open directory "pg_notify"
   - ❌ pg_isready возвращает ошибку

4. **Bot:**
   - ❌ PTBUserWarning в логах
   - ❌ ConversationHandler не работает

---

## Rollback Plan (если тесты провалились)

```bash
# На budget-test
cd ~/familyBudget

# Откатить commit
git revert 448eab01
# ИЛИ
git reset --hard HEAD~1

# Деплой предыдущей версии
sudo bash deploy.sh --sync-mode update --cleanup-mode smart

# Проверить что всё работает
docker compose ps
docker compose logs postgres | tail -20
```

---

## Next Steps After Successful Testing

### 1. Deploy to Production

```bash
# На production сервере
ssh budget-prod

cd ~/familyBudget
git pull origin dev

# Backup ПЕРЕД production деплоем
sudo bash scripts/backup.sh

# Deploy
sudo bash deploy.sh --sync-mode update --cleanup-mode smart --profile full

# Validate
sudo bash logs.sh
```

### 2. Monitor for 24 hours

```bash
# Проверять логи регулярно
watch -n 300 'docker compose logs postgres | tail -20'

# Проверять health
watch -n 60 'docker compose ps'
```

### 3. Mark as Stable

```bash
# Создать tag для стабильной версии
git tag -a v5.1.1 -m "fix: PostgreSQL directories management + Bot warnings"
git push origin v5.1.1
```

---

## Documentation Updates (после успешного тестирования)

### Файлы для обновления:

1. ✅ **CLAUDE.md** - уже обновлено (секция PostgreSQL Data Directory)
2. ✅ **docker-compose.yml** - уже обновлено (комментарии о bind mount)
3. ✅ **FIXES_PLAN.md** - детальный анализ проблем и решений
4. ✅ **POSTGRESQL_STORAGE_RESEARCH.md** - исследование storage опций

### Новые файлы:

- ✅ **DEPLOYMENT_TESTING_CHECKLIST.md** - этот файл (для будущих деплоев)

---

## Contacts & Support

**При проблемах:**
1. Проверить `/opt/budget/logs/deploy.log`
2. Запустить `sudo bash logs.sh --save`
3. Проверить Docker logs: `docker compose logs postgres backend bot`
4. Отправить диагностику для анализа

**Полезные команды:**
```bash
# Полная диагностика
sudo bash logs.sh

# Сохранить диагностику в файл
sudo bash logs.sh --save

# Live tail логов
docker compose logs -f postgres

# Проверить health
curl http://localhost:8000/health
```

---

## Changelog

### v5.1.1 (2025-11-28) - Commit 448eab01

**Fixed:**
- PostgreSQL critical directories management (silent success when all OK)
- Race conditions prevention (SAFETY GATE in validate_postgres_permissions_always)
- Bot PTBUserWarning (added per_user/per_chat/per_message to ConversationHandlers)

**Added:**
- Comprehensive documentation about bind mount architecture
- Detailed troubleshooting guide in CLAUDE.md
- PostgreSQL storage research document

**Changed:**
- repair_postgres_directories_atomic() - silent when all directories present
- validate_postgres_permissions_always() - skip modifications if PostgreSQL running

---

**Ready for Testing:** ✅
**Next Step:** Deploy to budget-test and validate
