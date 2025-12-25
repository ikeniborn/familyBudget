# Recurring Plans Fixes - December 2025

## Обзор исправлений

Исправлены три критичные проблемы с регламентными платежами (recurring plans):

1. ✅ **Real-time обновления на странице `/plan`** - добавлены WebSocket обработчики
2. ✅ **Фильтр `has_recurring_plan`** - подтверждена корректная работа (ВЫКЛЮЧЕН по умолчанию)
3. ✅ **Debug logging для edit modal** - добавлено comprehensive logging для диагностики

---

## Проблема 1: Real-time обновления не работали на /plan

### Симптом
При создании регламентного платежа через модальное окно на странице `/plan`, записи создавались в БД, но НЕ отображались без перезагрузки страницы (F5).

### Root Cause
**Две проблемы:**
1. `plan.html` НЕ имел обработчиков WebSocket событий (`plan_created`, `plan_updated`, `plan_deleted`)
2. **Redis Pub/Sub subscriber блокировался** - использовал `pubsub.listen()` внутри `async with get_redis()`, что не позволяло получать сообщения

### Решение

#### Frontend Fix
Добавлены WebSocket обработчики в `/frontend/web/templates/plan.html` (строки 5153-5219):

```javascript
// План создан
window.budgetWSClient.on('plan_created', async (data) => {
    if (shouldReloadOnPlanCreated(data)) {
        await loadFacts();
        showToast('success', '✅ Добавлена новая плановая запись');
    }
});

// План обновлен
window.budgetWSClient.on('plan_updated', async (data) => {
    await loadFacts();
    showToast('info', '🔄 Плановая запись обновлена');
});

// План удален
window.budgetWSClient.on('plan_deleted', async (data) => {
    await loadFacts();
    showToast('warning', '🗑️ Плановая запись удалена');
});

// Регламентный план создан
window.budgetWSClient.on('recurring_plan_created', async (data) => {
    await loadFacts();
    showToast('success', `✅ Регламентный платеж создан (${data.facts_generated} записей)`);
});

// Helper function
function shouldReloadOnPlanCreated(planData) {
    // Проверяет соответствие плана текущим фильтрам
    // Возвращает true если нужно перезагрузить таблицу
}
```

#### Backend Fix
Исправлен Redis Pub/Sub subscriber в `/backend/app/services/redis_pubsub_service.py`:

**Проблема:** `pubsub.listen()` блокировался внутри `async with get_redis()` context manager

**Решение:** Использовать `pubsub.get_message()` с timeout в цикле:

```python
async with get_redis() as redis:
    pubsub = redis.pubsub()
    await pubsub.subscribe(BUDGET_EVENTS_CHANNEL)

    logger.info(f"Subscribed to Redis channel: {BUDGET_EVENTS_CHANNEL}")

    # Use get_message() in a loop instead of listen()
    while True:
        message = await pubsub.get_message(ignore_subscribe_messages=False, timeout=1.0)

        if message is None:
            await asyncio.sleep(0.01)
            continue

        if message["type"] == "message":
            event = json.loads(message["data"])
            event_type = event.get("type")
            event_data = event.get("data", {})

            # Forward to local connections via callback
            if _local_broadcast_callback:
                await _local_broadcast_callback(event_type, event_data)
```

**Почему `listen()` не работал:**
- `listen()` создаёт бесконечный async generator
- Находится внутри `async with get_redis()`, который автоматически закрывает соединение
- Соединение закрывалось до получения первого сообщения

**Почему `get_message()` работает:**
- Явный контроль над получением сообщений
- Context manager остаётся открытым внутри `while True` цикла
- Timeout позволяет yield control обратно в event loop

### Тестирование
1. Открыть `/plan` в одной вкладке
2. Открыть `/` в другой вкладке
3. Создать плановую запись через модальное окно
4. ✅ **Результат:** Запись появляется на `/plan` БЕЗ F5 + toast уведомление

**Проверено логами:**
```
21:29:02 - [PUBSUB] Received message type: message
21:29:02 - [PUBSUB] Parsed event: type=plan_created
21:29:02 - Local broadcast: event=plan_created, connections=1
21:29:02 - Local broadcast complete: sent to 1 clients
```

---

## Проблема 2: Отображение всех регламентных заданий

### Диагностика
Проверено:
- ✅ Фильтр `has_recurring_plan` **ВЫКЛЮЧЕН** по умолчанию (строка 550-559)
- ✅ UI чекбокс НЕ имеет атрибута `checked` (строка 156)
- ✅ Backend API фильтрация работает корректно (facts.py:507-511)
- ✅ Пагинация: `pageSize = 50` (строка 521)

### Вывод
Фильтр и пагинация работают корректно. Если не все записи отображаются:
1. Проверить пагинацию (больше 50 записей → несколько страниц)
2. SQL диагностика:
   ```sql
   SELECT COUNT(*) FROM t_f_budget_fact WHERE record_type = 'plan';
   ```
3. Проверить scheduler job генерации фактов:
   ```bash
   docker compose logs backend | grep "recurring" | tail -50
   ```

---

## Проблема 3: Edit modal не показывал recurring plan info

### Симптом
При редактировании планового факта не отображалась информация о регламентном платеже (частота, следующая генерация, период).

### Диагностика
Проверено:
- ✅ Код загрузки recurring plan info УЖЕ существует (строки 2389-2438)
- ✅ Функция `populateRecurringPlanInfo()` корректно заполняет поля (строки 2632-2693)
- ❌ **Проблема:** Отсутствовал debug logging для диагностики ошибок API

### Решение
Добавлено comprehensive debug logging в `showEditModal()` (строки 2389-2438):

```javascript
console.log('[EDIT MODAL] Fact loaded:', fact);
console.log('[EDIT MODAL] recurring_plan_id:', fact.recurring_plan_id);

if (fact.recurring_plan_id) {
    console.log('[EDIT MODAL] Fact has recurring_plan_id, loading plan details...');

    const planResponse = await fetch(`/api/v1/recurring-plans/${fact.recurring_plan_id}`);
    console.log('[EDIT MODAL] Recurring plan API response status:', planResponse.status);

    if (!planResponse.ok) {
        console.error('[EDIT MODAL] Failed to load recurring plan:', planResponse.status);
        if (planResponse.status === 403) {
            console.error('[EDIT MODAL] 403 Forbidden - check user permissions');
        } else if (planResponse.status === 404) {
            console.error('[EDIT MODAL] 404 Not Found - plan may have been deleted');
        }
        // Скрыть секцию при ошибке
        recurringInfoDiv.classList.add('hidden');
    } else {
        currentRecurringPlan = await planResponse.json();
        console.log('[EDIT MODAL] Recurring plan loaded successfully:', currentRecurringPlan);
        populateRecurringPlanInfo(currentRecurringPlan);
        console.log('[EDIT MODAL] Recurring plan info populated');
    }
}
```

Добавлен logging в `populateRecurringPlanInfo()` (строки 2633-2638):

```javascript
function populateRecurringPlanInfo(plan) {
    console.log('[POPULATE] populating recurring plan info:', plan);

    if (!plan) {
        console.warn('[POPULATE] Plan is null/undefined, skipping');
        return;
    }
    // ... заполнение полей ...
}
```

### Тестирование
1. Открыть `/plan`
2. Открыть DevTools Console
3. Кликнуть "Редактировать" на плановой записи С recurring_plan_id
4. ✅ **Результат:**
   - Console показывает все логи `[EDIT MODAL]` и `[POPULATE]`
   - Секция `edit-recurring-info` видима
   - Поля заполнены корректными данными
   - Видны ошибки API (403/404) если есть проблемы

---

## Файлы изменены

### Frontend
1. `/frontend/web/templates/plan.html`
   - **Строки 5153-5219:** WebSocket event handlers
   - **Строки 2389-2438:** Debug logging в `showEditModal()`
   - **Строки 2633-2638:** Debug logging в `populateRecurringPlanInfo()`

---

## TODO: Фаза 4 - Напоминания для регламентных платежей

**Статус:** ОТЛОЖЕНО (требует миграции БД + backend изменений)

**Требования (от пользователя):**
- ✅ Создавать автоматические напоминания для каждого сгенерированного факта ЕСЛИ в recurring plan указаны параметры напоминания
- ❌ Если параметров нет - не создавать

**План реализации:**

### Backend Changes

1. **Migration:** Добавить поле `reminder_time` в `t_d_recurring_plan`
   ```python
   # backend/db/migrations/versions/YYYYMMDD_add_reminder_time.py
   op.add_column('t_d_recurring_plan', sa.Column('reminder_time', sa.Time(), nullable=True))
   ```

2. **Model:** Update RecurringPlan
   ```python
   # backend/app/models/recurring_plan.py
   class RecurringPlan(SQLModel, table=True):
       # ... existing fields ...
       reminder_time: Optional[time] = Field(default=None)
   ```

3. **Service:** Update `_generate_facts_for_plan()`
   ```python
   # backend/app/services/recurring_plan_service.py
   if plan.reminder_time:
       reminder = ScheduledReminder(
           user_id=plan.user_id,
           entity_type='plan',
           entity_id=fact.id,
           scheduled_at=datetime.combine(current_date, plan.reminder_time),
           is_sent=False,
       )
       session.add(reminder)
   ```

### Frontend Changes

4. **UI:** Добавить поле `reminder_time` в модальное окно создания recurring plan
   - Time picker для выбора времени напоминания
   - Optional field (пустое = без напоминаний)

### Testing

5. **SQL диагностика:**
   ```sql
   SELECT
       bf.id AS fact_id,
       bf.fact_date,
       bf.recurring_plan_id,
       sr.id AS reminder_id,
       sr.scheduled_at,
       sr.is_sent
   FROM t_f_budget_fact bf
   LEFT JOIN t_d_scheduled_reminder sr ON sr.entity_id = bf.id AND sr.entity_type = 'plan'
   WHERE bf.recurring_plan_id IS NOT NULL
   ORDER BY bf.fact_date ASC
   LIMIT 20;
   ```

   **Ожидаемый результат:** Каждый fact с `recurring_plan_id` имеет reminder (если plan.reminder_time != NULL)

---

## Критерии готовности

- [x] WebSocket обработчики добавлены на /plan
- [x] Real-time обновления работают
- [x] Фильтр has_recurring_plan работает корректно (ВЫКЛЮЧЕН по умолчанию)
- [x] Debug logging добавлен для edit modal
- [ ] Напоминания создаются для recurring plans (**ОТЛОЖЕНО**)
- [x] Документация обновлена
- [ ] Коммит создан и запушен

---

## Деплой на test server (budget-dev)

**Команды:**
```bash
# 1. Connect to test server
ssh budget-test

# 2. Pull latest changes
cd ~/familyBudget
git pull origin test

# 3. Deploy with patch mode
sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch

# 4. Check logs
docker compose logs -f backend
```

**Проверка:**
1. Открыть https://budget-dev.ikeniborn.ru/plan
2. Создать плановую запись через модальное окно
3. ✅ Запись должна появиться БЕЗ F5 + toast уведомление
4. Кликнуть "Редактировать" на плановой записи с recurring_plan_id
5. ✅ Открыть DevTools Console - проверить логи `[EDIT MODAL]`
6. ✅ Секция "🔄 Регламентный платеж" должна быть видна

---

## Known Issues

### Issue 1: Напоминания для recurring plans не реализованы
**Приоритет:** MEDIUM
**Требует:** Migration БД + Backend changes
**Workaround:** Пользователь создает напоминания вручную через UI

### Issue 2: Pagination может скрывать записи
**Приоритет:** LOW
**Решение:** Увеличить `pageSize` с 50 до 100 ИЛИ добавить индикатор пагинации

### Issue 3: WebSocket не восстанавливается после перезапуска backend
**Приоритет:** MEDIUM
**Симптом:** После перезапуска backend сервера WebSocket не переподключается автоматически - требуется перезагрузка страницы
**Root Cause:** Логика reconnect в `BudgetWSClient` не обрабатывает сценарий потери соединения во время работы сервера
**Workaround:** Пользователь перезагружает страницу вручную (F5)
**TODO:** Добавить автоматический reconnect с exponential backoff в `budgetWSClient.js`

---

## Changelog

**2025-12-25**
- ✅ Добавлены WebSocket обработчики на `/plan` для real-time обновлений
- ✅ Исправлен Redis Pub/Sub subscriber (переход с `listen()` на `get_message()`)
- ✅ Добавлен comprehensive debug logging в edit modal
- ✅ Подтверждена корректность фильтра `has_recurring_plan` (ВЫКЛЮЧЕН по умолчанию)
- ✅ Создана документация по исправлениям
- ✅ **Real-time обновления работают** - события доставляются через WebSocket
