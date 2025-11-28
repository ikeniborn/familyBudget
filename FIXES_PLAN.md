# План исправления проблем деплоя

**Дата:** 2025-11-28
**Автор:** Claude Code
**Версия:** 1.0

---

## Проблема 1: PostgreSQL Critical Directories Deletion

### Root Cause

**Архитектурная проблема:** Использование bind mount вместо Docker managed volume + race conditions при рекурсивных операциях с permissions.

**Детали:**
1. **Bind mount** (`/opt/budget/data/postgres` → container `/var/lib/postgresql/data`)
   - PostgreSQL создает критические директории ТОЛЬКО при первой инициализации (initdb)
   - При последующих запусках НЕ проверяет наличие критических директорий
   - Если директория отсутствует → FATAL: "could not open directory"

2. **Race conditions:**
   - `chown -R` на `/opt/budget/data/postgres` во время работы PostgreSQL
   - Может удалить временные файлы/директории
   - Особенно опасно для `pg_notify`, `pg_dynshmem`, `pg_stat_tmp`

3. **Incomplete initialization:**
   - Если PostgreSQL упал во время initdb (OOM, crash)
   - Некоторые директории остаются несозданными
   - PostgreSQL НЕ завершит инициализацию при следующем запуске

### Решение

#### Вариант A: Улучшить текущую архитектуру (РЕКОМЕНДУЕТСЯ)

**Преимущества:**
- ✅ Не требует переноса данных
- ✅ Быстрое внедрение
- ✅ Обратная совместимость

**Изменения:**

1. **Предотвращение race conditions в validate_postgres_permissions_always()**

```bash
# postgres.sh:457
validate_postgres_permissions_always() {
    # ...

    # CRITICAL SAFEGUARD: НИКОГДА не запускать chown -R если PostgreSQL работает!
    if [[ "$postgres_is_running" == "true" ]]; then
        success "PostgreSQL is running - skipping recursive permission check"
        info "Permissions will be validated on next deployment when PostgreSQL stops"
        return 0  # ← SKIP recursive chown
    fi

    # PostgreSQL остановлен - безопасно проверить права
    info "PostgreSQL is stopped - verifying permissions recursively..."
    sudo chown -R $target_uid:$target_gid "$postgres_data_dir" 2>/dev/null
}
```

**Проблема:** Уже есть эта проверка! Но она работает некорректно.

**FIX:** Переместить проверку РАНЬШЕ в коде (до ANY операций с файловой системой).

2. **Добавить health check ДО изменения permissions**

```bash
# Новая функция в postgres.sh
check_postgres_directories_before_permissions() {
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    # Skip if PostgreSQL is running (NO filesystem modifications allowed!)
    if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q | grep -q .; then
        return 0
    fi

    # Check if ALL critical directories exist
    local critical_dirs=("pg_notify" "pg_tblspc" "pg_dynshmem" "pg_stat" ...)
    local missing=()

    for dir in "${critical_dirs[@]}"; do
        [[ ! -d "$postgres_data_dir/$dir" ]] && missing+=("$dir")
    done

    # If ANY missing → repair BEFORE permissions change
    if [[ ${#missing[@]} -gt 0 ]]; then
        warning "Missing ${#missing[@]} critical directories - repairing BEFORE permissions change"
        repair_postgres_directories_atomic
    fi
}
```

3. **Улучшить repair_postgres_directories_atomic() - сделать SILENT если все OK**

```bash
# postgres.sh:67
repair_postgres_directories_atomic() {
    # ... existing checks ...

    # If all directories present, no action needed
    if [[ ${#missing_dirs[@]} -eq 0 ]]; then
        # ✅ SILENT SUCCESS (no output if everything is OK)
        return 0
    fi

    # Only show warning if ACTUALLY repairing
    warning "⚠️  PostgreSQL Atomic Repair: Detected ${#missing_dirs[@]} missing critical directories"
    # ... repair logic ...
}
```

**Результат:**
- ✅ Нет ложных "11 missing directories" при каждом деплое
- ✅ Warning показывается ТОЛЬКО при реальной проблеме
- ✅ Race conditions устранены

#### Вариант B: Migra к Docker managed volume (ДОЛГОСРОЧНОЕ РЕШЕНИЕ)

**Преимущества:**
- ✅ Docker автоматически управляет permissions
- ✅ Нет race conditions с host filesystem
- ✅ Лучшая производительность

**Недостатки:**
- ❌ Требует миграцию существующих данных
- ❌ Breaking change для существующих деплоев

**Миграция:**

```yaml
# docker-compose.yml
volumes:
  postgres_data:
    driver: local
    # REMOVE bind mount options - use Docker managed volume
```

```bash
# Migration script
sudo docker compose down postgres
sudo docker volume create familybudget_postgres_data
sudo cp -a /opt/budget/data/postgres/* /var/lib/docker/volumes/familybudget_postgres_data/_data/
sudo docker compose up -d postgres
```

**Рекомендация:** Вариант B - для будущих версий (v6.0+). Вариант A - для hotfix.

---

## Проблема 2: Bot PTBUserWarning - ConversationHandler

### Root Cause

ConversationHandler с CallbackQueryHandler требует явного указания параметров `per_message`, `per_user`, `per_chat`.

**По умолчанию:**
- `per_user=True` - каждый пользователь имеет свой conversation
- `per_chat=True` - каждый чат имеет свой conversation
- `per_message=False` - НЕ используется message_id для tracking

**Проблема:** При `per_message=False` + `CallbackQueryHandler` → python-telegram-bot выдает warning.

### Решение

#### Добавить явные параметры во все ConversationHandler

**Затронутые файлы:**
1. `bot/handlers/add_plan.py:689` - addplan_conversation_handler
2. `bot/handlers/list.py:299` - list_conversation_handler
3. `bot/handlers/delete.py:267` - delete_conversation_handler
4. `bot/handlers/search.py:235` - search_conversation_handler
5. `bot/handlers/edit.py:727` - edit_conversation_handler

**Исправление:**

```python
# bot/handlers/add_plan.py:689
addplan_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("addplan", addplan_command)],
    states={
        SELECT_ARTICLE: [CallbackQueryHandler(article_selected)],
        ENTER_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, amount_entered)],
        # ...
    },
    fallbacks=[CommandHandler("cancel", cancel_command)],
    name="addplan_conversation",
    persistent=False,
    # ✅ FIX: Add explicit parameters
    per_user=True,   # Each user has separate conversation
    per_chat=True,   # Each chat has separate conversation
    per_message=False,  # Do NOT use message_id for tracking (callbacks can come from any message)
)
```

**Объяснение параметров:**

- `per_user=True`: Каждый пользователь может иметь свою активную транзакцию add/edit
- `per_chat=True`: В групповых чатах каждый чат имеет отдельный conversation state
- `per_message=False`: Callback buttons могут быть в разных сообщениях (не привязываемся к message_id)

**Альтернатива:** Если хотим привязку к конкретному сообщению (более строгий режим):

```python
per_message=True  # Callback ТОЛЬКО от сообщения с keyboard
```

Но это может сломать UX если пользователь удалит сообщение с кнопками.

---

## План выполнения

### Phase 1: PostgreSQL Fixes (PRIORITY: HIGH)

**Задачи:**
1. ✅ Модифицировать `repair_postgres_directories_atomic()` - убрать warning если all OK
2. ✅ Добавить проверку BEFORE permissions change в `validate_postgres_permissions_always()`
3. ✅ Убедиться что `chown -R` НЕ запускается если PostgreSQL running
4. ✅ Добавить комментарии в код о WHY это происходит
5. ✅ Обновить документацию (CLAUDE.md) о bind mount vs Docker volume

**Acceptance Criteria:**
- ✅ Деплой с `--cleanup-mode smart` НЕ показывает "11 missing directories" если всё OK
- ✅ Warning показывается ТОЛЬКО если реально есть проблема
- ✅ PostgreSQL стартует без ошибок после деплоя
- ✅ Нет race conditions при `chown -R`

### Phase 2: Bot Warnings (PRIORITY: MEDIUM)

**Задачи:**
1. ✅ Добавить `per_user=True, per_chat=True, per_message=False` в addplan_conversation_handler
2. ✅ То же для list_conversation_handler
3. ✅ То же для delete_conversation_handler
4. ✅ То же для search_conversation_handler
5. ✅ То же для edit_conversation_handler

**Acceptance Criteria:**
- ✅ Нет PTBUserWarning при запуске бота
- ✅ ConversationHandler работает корректно (multi-user support)
- ✅ Callbacks обрабатываются правильно

### Phase 3: Testing (PRIORITY: HIGH)

**Задачи:**
1. ✅ Деплой на budget-test с `--cleanup-mode smart`
2. ✅ Проверить что нет "missing directories" warning
3. ✅ Проверить что PostgreSQL healthy
4. ✅ Проверить что бот запускается без warnings
5. ✅ Протестировать /addplan, /list, /delete, /search, /edit команды

**Acceptance Criteria:**
- ✅ Деплой проходит чисто без ложных warnings
- ✅ PostgreSQL работает стабильно
- ✅ Бот работает без warnings
- ✅ Все команды функционируют корректно

---

## Risks & Mitigations

### Risk 1: Bind mount migration (Вариант B)

**Risk:** Потеря данных при миграции на Docker managed volume

**Mitigation:**
- Создать backup ПЕРЕД миграцией
- Протестировать на budget-test
- Документировать rollback процедуру

### Risk 2: ConversationHandler параметры

**Risk:** Изменение `per_message` может сломать существующий UX

**Mitigation:**
- Использовать `per_message=False` (текущее поведение)
- Протестировать все conversation flows
- Если нужен `per_message=True` - документировать breaking change

---

## Sources

Решения основаны на:
- [PostgreSQL Docker: FATAL: could not open directory "pg_notify" - Stack Overflow](https://stackoverflow.com/questions/72516726/fatal-could-not-open-directory-pg-notify-no-such-file-or-directory)
- [Docker volume mount bug · Issue #579 · docker-library/postgres](https://github.com/docker-library/postgres/issues/579)
- [ConversationHandler - python-telegram-bot v21.5 Documentation](https://docs.python-telegram-bot.org/en/v21.5/telegram.ext.conversationhandler.html)
- [Issue #1781: CallbackQueryHandler will not be tracked for every message](https://github.com/python-telegram-bot/python-telegram-bot/issues/1781)
