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

### 1. `t_d_medicine` — справочник лекарств (Dimension, SCD Type 1)

Один общий справочник на семью. История — отдельная таблица `t_d_medicine_history` (паттерн как `product_group_history`).

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
| `purchase_price` | Decimal(10,2)? | Опц. — связь с фактами расходов |
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
| `frequency_per_day` | int | 1–6 раз в день |
| `intake_times` | JSON | `["08:00", "14:00", "20:00"]` |
| `with_food` | enum? | before / with / after / any |
| `start_date` | date | Начало курса |
| `end_date` | date? | Конец курса (NULL = постоянный) |
| `duration_days` | int? | Длительность (альтернатива end_date) |
| `schedule_type` | enum | daily / every_n_days / weekdays |
| `schedule_config` | JSON? | `{"n": 2}` или `{"days": ["mon","wed","fri"]}` |
| `is_active` | bool | Идёт / завершён / приостановлен |
| `reminders_enabled` | bool | |
| `notification_channels` | JSON | `["telegram", "web_push"]` |
| `comment` | text? | |
| `creator_id`, `created_at`, `updated_at` | | |

### 5. `t_f_medicine_intake_log` — журнал приёма

Каждый плановый приём + статус.

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `course_id` | FK course CASCADE | |
| `patient_id` | FK family_member | Дублируем для быстрого фильтра |
| `scheduled_at` | datetime | Когда запланирован приём |
| `taken_at` | datetime? | Когда фактически принят (NULL = не отмечено) |
| `status` | enum | scheduled / taken / skipped / late |
| `dose_taken` | Decimal? | Если отличается от плановой |
| `stock_id` | FK stock? | Из какой упаковки приняли (для списания) |
| `comment` | text? | |
| `marked_by` | FK user | Кто отметил приём (родитель за ребёнка) |
| `created_at`, `updated_at` | | |

Индексы: `(patient_id, scheduled_at)`, `(course_id, scheduled_at)`, `(status)`.

### 6. `t_medicine_reminder` — напоминания

Копия паттерна `t_scheduled_reminder`. Одна запись = один пуш для одного `intake_log`.

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `intake_log_id` | int unique | One-to-one с приёмом |
| `recipient_user_id` | FK user | Кому слать (пациент или опекун) |
| `reminder_datetime` | datetime indexed | |
| `status` | str(20) | pending / sent / failed / cancelled |
| `sent_at`, `telegram_sent`, `web_push_sent`, `error_message`, `retry_count` | | как в `ScheduledReminder` |

Можно создать несколько записей на один `intake_log` — отдельная для пациента и для опекуна.

## Архитектурные решения

### Видимость
Семья = все пользователи (как `shopping_list` — shared). `patient_id` нужен только для назначения и напоминаний, не для изоляции. Любой взрослый видит и редактирует всё.

### Дети без аккаунта
Используем отдельную таблицу `t_d_family_member` (не ослабляем CHECK `telegram_id OR email IS NOT NULL` в `t_d_user`).
`linked_user_id` опционально связывает с реальным пользователем, `guardian_user_id` обязателен — туда летят напоминания, если у пациента нет своего канала.

### Списание остатков
При `mark_intake_taken`:
- Если `stock_id` указан → `stock.quantity_remaining -= dose_amount` атомарно (SELECT FOR UPDATE).
- FIFO по `expiry_date` — выбираем упаковку с ближайшим сроком.
- Если остатков нет → уведомление «закончилось X» + опц. автодобавление в `shopping_list`.

### Генерация intake_log
Не хранить весь курс на год вперёд. Ночной cron-job (как `bot/jobs/weekly_report.py`):
- Генерит `intake_log` на 7 дней вперёд для всех активных курсов.
- Сразу создаёт `t_medicine_reminder` на каждый log.
- Идемпотентность: UNIQUE на `(course_id, scheduled_at)`.

### Напоминания
- Переиспользуем механизм `ScheduledReminder` (есть `is_due()`, `mark_sent()`, telegram + web_push).
- Новый job `bot/jobs/medicine_reminders.py`: каждую минуту берёт `status='pending' AND reminder_datetime <= now()`, шлёт, ставит статус.
- Inline-кнопки в пуше: «Принял ✅» / «Пропустить» / «Отложить 30 мин» → callback → API → update `intake_log`.

### Алерты по сроку годности
Ежедневный job: `expiry_date <= today + 30 days` → пуш + значок на странице аптечки. Расширение `notifications.py`.

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

Real-time: WebSocket-канал `medicine:{family}` — отметка приёма мгновенно обновляет UI у всех.

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
- Cron-job `bot/jobs/medicine_reminders.py`.
- Inline-кнопки в Telegram + Web Push.

**Итерация 4 — Интеграции:**
- Списание остатков при отметке приёма.
- Автодобавление «закончилось» в `shopping_list`.
- Интеграция расходов аптечки с `t_f_budget_fact` (article = «Медицина»).
- Аналитика: сколько потрачено на лекарства за месяц, кто чаще болеет.

## Открытые вопросы

1. **Расписание** — поддерживаем сложные схемы (через день, по нечётным дням недели) или только N раз в день? *(см. `schedule_type` в курсе)*
2. **Один справочник или у каждого свой?** *(рекомендация: один общий — как `t_d_store`)*
3. **Связь с бюджетом** — расход на аптеке должен автоматически приходить в `t_f_budget_fact`?
4. **«Отложить» напоминание** — на сколько по умолчанию (15 / 30 / 60 мин)?
5. **Несколько получателей одного напоминания** — слать и пациенту, и опекуну?

## Связанные документы

- `lat.md/database.md` — паттерны Header+Lines, SCD, Closure Table.
- `lat.md/architecture.md` — общая архитектура.
- `backend/app/models/shopping_list.py`, `shopping_list_item.py` — образец Header+Lines.
- `backend/app/models/scheduled_reminder.py` — образец напоминаний.
- `bot/jobs/weekly_report.py` — образец cron-job.
