# Семейная аптечка — проектирование (Вариант D)

Гибридный модуль учёта лекарств: справочник + склад (аптечка) + курсы приёма + журнал + напоминания.
Реализуется по аналогии с существующим модулем `shopping_list` (Header+Lines, shared references, SCD).

## Цели

- Видеть, какие лекарства есть дома, в каком количестве и срок годности.
- Назначать курс приёма конкретному члену семьи.
- Слать напоминания (Telegram + Web Push) о каждом приёме с быстрыми кнопками.
- Автоматически списывать остаток при отметке приёма и предлагать докупить, когда заканчивается.
- Поддерживать детей и других членов семьи без собственного аккаунта.

## Сущности

### 1. `t_d_medicine` — справочник лекарств (Dimension, SCD Type 1 + history)

Один общий справочник на семью. Основная таблица хранит текущее состояние (SCD Type 1). Полная история изменений — отдельная таблица `t_d_medicine_history` (SCD Type 2, паттерн как `product_group_history`).

Удаление: **только soft-archive** (`is_active=False`). Hard delete запрещён, если есть связанные `stock`/`course` с `deleted_at IS NULL`.

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `name` | str(255) | Торговое название («Нурофен 200мг») |
| `inn` | str(255)? | МНН («Ibuprofen») — для группировки аналогов |
| `form` | enum | tablet / capsule / syrup / drops / ointment / spray / injection / other |
| `dosage` | str(100)? | «200 mg», «5 ml/доза» |
| `prescription_required` | bool | Рецептурный |
| `notes` | text? | Показания, противопоказания (свободно) |
| `creator_id` | FK user | Кто добавил |
| `created_at/updated_at` | datetime | |

### 2. `t_d_family_member` — члены семьи (включая детей без аккаунта)

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `linked_user_id` | FK user? | Если у члена семьи есть аккаунт |
| `guardian_user_id` | FK user | Кто опекун (для напоминаний, если у пациента нет своего канала) |
| `name` | str(255) | «Маша», «Бабушка» |
| `birth_date` | date? | Для расчёта дозировки по возрасту |
| `notes` | text? | Аллергии, особенности |
| `created_at/updated_at` | datetime | |

### 3. `t_f_medicine_stock` — аптечка (одна упаковка = одна запись)

Несколько записей на одно лекарство (разные сроки годности, разные упаковки).

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `medicine_id` | FK medicine | |
| `quantity_remaining` | Decimal(10,3) | Сколько осталось |
| `quantity_initial` | Decimal(10,3) | Сколько было при покупке |
| `unit` | str(50) | «шт», «мл», «доз» |
| `expiry_date` | date **indexed** | Срок годности — алерт <30 дней |
| `purchase_date` | date? | |
| `purchase_price` | Decimal(10,2)? | Цена покупки (заполняется до создания fact-записи) |
| `fact_id` | int? | Ссылка на `t_f_budget_fact` после интеграции (Итерация 4). До неё — NULL. |
| `location` | str(100)? | «Кухня, шкаф», «Аптечка в спальне» |
| `creator_id`, `version`, `deleted_at`, `last_modified_by`, `created_at`, `updated_at` | | как в `shopping_list_item` |

### 4. `t_f_medicine_course` — курс приёма

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `medicine_id` | FK medicine | |
| `patient_id` | FK family_member **обязательно** | Для кого из семьи |
| `prescribed_by` | str(255)? | Врач / самолечение |
| `dose_amount` | Decimal(10,3) | Сколько за приём |
| `dose_unit` | str(50) | |
| `intake_times` | JSON | `["08:00", "14:00", "20:00"]` — времена в SYSTEM_TIMEZONE; частота = `len(intake_times)` (не хранится отдельно) |
| `with_food` | enum? | before / with / after / any |
| `start_date` | date | Начало курса |
| `end_date` | date? | Конец курса (NULL = постоянный). При создании курса по «длительности» вычисляется на сервере. |
| `schedule_type` | enum | daily / every_n_days / weekdays |
| `schedule_config` | JSON? | `{"n": 2}` или `{"days": ["mon","wed","fri"]}` |
| `is_active` | bool | Идёт / завершён / приостановлен |
| `reminders_enabled` | bool | |
| `notification_channels` | JSON | `["telegram", "web_push"]` |
| `comment` | text? | |
| `deleted_at` | datetime? | Soft delete (архивация завершённого курса) |
| `creator_id`, `created_at`, `updated_at` | | |

### 5. `t_f_medicine_intake_log` — журнал приёма

Каждый плановый приём + статус.

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `course_id` | FK course CASCADE | |
| `patient_id` | FK family_member | Дублируем для быстрого фильтра |
| `scheduled_at` | datetime | Когда запланирован приём (naive datetime в SYSTEM_TIMEZONE, как в `ScheduledReminder`) |
| `taken_at` | datetime? | Когда фактически принят (NULL = не отмечено) |
| `status` | enum | scheduled / taken / skipped / late |
| `dose_taken` | Decimal(10,3)? | Если отличается от плановой |
| `stock_id` | FK stock? | Из какой упаковки приняли (для списания) |
| `comment` | text? | |
| `marked_by` | int? FK `t_d_user.id` | Кто отметил приём (родитель за ребёнка) |
| `version` | int | Optimistic locking — конкурентные отметки от разных взрослых |
| `created_at`, `updated_at` | | |

Индексы: `(patient_id, scheduled_at)`, `(course_id, scheduled_at)`, `(status)`.
Constraints: `UNIQUE (course_id, scheduled_at)` — идемпотентность генерации.
Soft delete не нужен (журнал неизменный).

### 6. `t_medicine_reminder` — напоминания

Копия паттерна `t_scheduled_reminder`. Одна запись = один пуш для одного `intake_log`.

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `intake_log_id` | int indexed | FK на intake_log (без UNIQUE — может быть несколько получателей на один приём) |
| `recipient_user_id` | int FK `t_d_user.id`, NOT NULL | Кому слать. Для пациента без `linked_user_id` → `family_member.guardian_user_id`. |
| `reminder_datetime` | datetime indexed | Naive в SYSTEM_TIMEZONE |
| `status` | str(20) | pending / sent / failed / cancelled |
| `sent_at`, `telegram_sent`, `web_push_sent`, `error_message`, `retry_count` | | как в `ScheduledReminder` |

Constraints: `UNIQUE (intake_log_id, recipient_user_id)` — один пуш одному получателю на один приём.
На один `intake_log` создаются отдельные записи для пациента (если есть аккаунт) и для опекуна.

## Архитектурные решения

### Видимость
Семья = все пользователи (как `shopping_list` — shared). `patient_id` нужен только для назначения и напоминаний, не для изоляции. Любой взрослый видит и редактирует всё.

### Дети без аккаунта
Используем отдельную таблицу `t_d_family_member` (не ослабляем CHECK `telegram_id OR email IS NOT NULL` в `t_d_user`).
`linked_user_id` опционально связывает с реальным пользователем, `guardian_user_id` обязателен — туда летят напоминания, если у пациента нет своего канала.

### Списание остатков
При `mark_intake_taken`:
- Если в запросе указан `stock_id` → списываем именно из этой упаковки атомарно (`SELECT … FOR UPDATE`, `quantity_remaining -= dose_amount`).
- Если `stock_id` **не** указан → сервис сам выбирает упаковку по FIFO: `medicine_id = course.medicine_id AND quantity_remaining > 0 AND deleted_at IS NULL ORDER BY expiry_date ASC LIMIT 1`.
- Если подходящих остатков нет → запись о приёме создаётся без `stock_id` + уведомление «закончилось X» + опц. автодобавление в `shopping_list`.

### Генерация intake_log
Не хранить весь курс на год вперёд. Ночной cron-job:
- Генерит `intake_log` на 7 дней вперёд для всех активных курсов.
- Сразу создаёт `t_medicine_reminder` на каждый log (по одной записи на каждого получателя — пациент и/или опекун).
- Идемпотентность через UNIQUE `(course_id, scheduled_at)`.
- При открытии дашборда сервис догенеривает пропущенные дни (если пользователь не открывал приложение дольше недели) и переводит просроченные `scheduled` → `late`, если `scheduled_at < now() - 24h`.

### Напоминания
- Переиспользуем существующий диспетчер `backend/app/scheduler.py` (он уже опрашивает `ScheduledReminder.get_due_reminders` и шлёт через telegram + web_push).
- В `scheduler.py` добавляем параллельный цикл по `t_medicine_reminder` — тот же паттерн `get_due → send → mark_sent`.
- Сервис рассылки (`MedicineReminderService.send`) переиспользует telegram-bot и web-push-клиент из `ReminderService`.
- Inline-кнопки в пуше: «Принял ✅» / «Пропустить» / «Отложить 30 мин» → callback → API → update `intake_log`.
- Snooze: создаёт новую запись в `t_medicine_reminder` с `reminder_datetime = now() + 30 мин` (значение по умолчанию, конфигурируется на уровне курса).

### Алерты по сроку годности
Ежедневный job в `scheduler.py`: выборка stock-записей с `expiry_date <= today + 30 days AND quantity_remaining > 0 AND deleted_at IS NULL`. Отправка пуша + значок на странице аптечки. Расширение `notifications.py`.

## API эндпоинты

Новый файл `backend/app/api/v1/endpoints/medicines.py` (можно разбить на несколько):

```
# Справочник
GET/POST/PATCH/DELETE  /api/v1/medicines
GET                    /api/v1/medicines/search?q=

# Члены семьи
GET/POST/PATCH/DELETE  /api/v1/family-members

# Аптечка (stock)
GET    /api/v1/medicine-stock?expiring_in_days=30&low_stock=true
POST   /api/v1/medicine-stock
PATCH  /api/v1/medicine-stock/{id}
DELETE /api/v1/medicine-stock/{id}

# Курсы
GET/POST/PATCH/DELETE  /api/v1/medicine-courses
POST   /api/v1/medicine-courses/{id}/pause
POST   /api/v1/medicine-courses/{id}/complete

# Журнал приёма
GET    /api/v1/medicine-intakes?patient_id=&date=today
POST   /api/v1/medicine-intakes/{id}/take    # отметить принятым
POST   /api/v1/medicine-intakes/{id}/skip
POST   /api/v1/medicine-intakes/{id}/snooze  # отложить на 30 мин
```

## Frontend (web)

Страницы:
1. `/medicines` — дашборд: «Сегодня надо принять» (сгруппировано по члену семьи) + «Истекает в этом месяце» + «Заканчивается».
2. `/medicines/catalog` — справочник лекарств.
3. `/medicines/stock` — аптечка с фильтрами по сроку годности.
4. `/medicines/courses` — список активных/завершённых курсов.
5. `/medicines/courses/{id}` — карточка курса + календарь приёма + журнал.

Real-time: WebSocket-канал `medicine:all` (shared, как `shopping_lists`) — отметка приёма мгновенно обновляет UI у всех. Клиент фильтрует события по `patient_id` для отображения только релевантного члена семьи.

Bundle: новые IIFE-entry-points в `frontend/web/`, по образцу `shopping_lists.ts`.

## Bot (Telegram)

Команды:
- `/medicines` — открыть Web App с дашбордом.
- `/taken` — быстрая отметка ближайшего приёма.

Пуш-уведомление:

```
💊 Пора принять: Нурофен 200мг
👤 Маша  ⏰ 14:00
1 таблетка после еды
[✅ Принял] [⏭ Пропустить] [🕐 Отложить 30 мин]
```

## План реализации

**Итерация 1 — MVP «Аптечка»:**
- Миграции: `t_d_medicine`, `t_d_family_member`, `t_f_medicine_stock` + history.
- API + страница аптечки + алерт по сроку годности.
- *Цель: видим, что есть дома и что скоро истекает.*

**Итерация 2 — Курсы:**
- Миграции: `t_f_medicine_course`, `t_f_medicine_intake_log`.
- API курсов + генерация intake_log на 7 дней.
- Дашборд «приём на сегодня» по членам семьи.

**Итерация 3 — Напоминания:**
- Миграция: `t_medicine_reminder`.
- Расширение `backend/app/scheduler.py` новым циклом диспетчеризации.
- Inline-кнопки в Telegram + Web Push.

**Итерация 4 — Интеграции:**
- Списание остатков при отметке приёма.
- Автодобавление «закончилось» в `shopping_list`.
- Интеграция расходов аптечки с `t_f_budget_fact`: заводим отдельную статью в `t_d_article` («Медицина / Лекарства»). При добавлении stock с `purchase_price` сервис создаёт fact-запись с этой статьёй. Связь храним через nullable `fact_id` в `t_f_medicine_stock` (избегаем дублирования цены).
- Аналитика: сколько потрачено на лекарства за месяц, кто чаще болеет.

## Открытые вопросы

1. **Связь с бюджетом** — расход на аптеке должен автоматически приходить в `t_f_budget_fact` (через nullable `fact_id` в stock)?
2. **«Отложить» напоминание** — значение по умолчанию (15 / 30 / 60 мин) и можно ли переопределить на уровне курса?
3. **Несколько получателей одного напоминания** — слать всегда и пациенту, и опекуну, или только опекуну если у пациента нет аккаунта?
4. **`frequency_per_day` без ограничений** — позволяем любые `intake_times` (например, каждые 2 часа = 8+ приёмов) или ставим soft-limit на UI?

## Связанные документы

- `lat.md/database.md` — паттерны Header+Lines, SCD, Closure Table.
- `lat.md/architecture.md` — общая архитектура.
- `backend/app/models/shopping_list.py`, `shopping_list_item.py` — образец Header+Lines.
- `backend/app/models/scheduled_reminder.py` — образец напоминаний.
- `backend/app/scheduler.py` — диспетчер due-reminders (расширяется в Итерации 3).
- `backend/app/services/reminder_service.py` — образец сервиса (get_due / send / mark_sent).
