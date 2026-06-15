<<<<<<< HEAD
=======
---
review:
  spec_hash: 5354578b794e4c5c
  last_run: 2026-06-15
  phases:
    structure:    { status: passed }
    coverage:     { status: passed }
    clarity:      { status: passed }
    consistency:  { status: passed }
  findings:
    - id: F-001
      phase: clarity
      severity: WARNING
      section: "## Поведение"
      section_hash: cae49a5457a1b5c0
      text: "Несогласованный термин: «Итерация 4» в разделе «Списание остатков» против «Фаза 4» в «Декомпозиции» — одна сущность, два названия."
      verdict: fixed
      verdict_at: 2026-06-15
    - id: F-002
      phase: clarity
      severity: WARNING
      section: "## Поведение"
      section_hash: cae49a5457a1b5c0
      text: "Оценка «хватит на N дней» задана формулой только для schedule_type=daily; для every_n_days/weekdays критерий расчёта дней не определён."
      verdict: fixed
      verdict_at: 2026-06-15
    - id: F-003
      phase: clarity
      severity: INFO
      section: "## Модель данных"
      section_hash: e15d6a2ffe4b74a0
      text: "«Дубль для быстрого фильтра» (intake_log.patient_id): слово «быстрого» без критерия — денормализация-обоснование, безвредно."
      verdict: fixed
      verdict_at: 2026-06-15
chain:
  intent: null
---

>>>>>>> 58743c43 (docs: medicine tracking implementation spec)
# Семейная аптечка — спецификация реализации

**Дата:** 2026-06-15
**Статус:** утверждён дизайн, готов к написанию плана
**Базовый документ:** `docs/MEDICINE_TRACKING_DESIGN.md` (Вариант D). Эта спецификация углубляет его, закрывает открытые вопросы и фиксирует декомпозицию.

## Обзор

Гибридный модуль учёта лекарств: справочник + склад (аптечка) + курсы приёма + журнал + напоминания. Реализуется зеркалированием двух проверенных паттернов проекта:

- **`shopping_list`** (Header+Lines, shared-visibility, SCD, WebSocket broadcast) — для справочника, склада, курсов.
- **`scheduled_reminder`** (scheduler + advisory-lock + Telegram/Web-Push) — для напоминаний о приёме.

Отвергнутые альтернативы: обобщённый reminder-движок (преждевременная абстракция, риск для рабочего кода планов) и отдельный микросервис (лишняя инфраструктура при shared-family масштабе).

## Цели

- Видеть, какие лекарства есть дома, в каком количестве и срок годности.
- Назначать курс приёма конкретному члену семьи (включая детей без аккаунта).
- Слать напоминания (Telegram + Web Push) о каждом приёме с быстрыми кнопками в Telegram.
- Автоматически списывать остаток при отметке приёма; предлагать докупить, когда заканчивается.

## Закрытые решения (бывшие открытые вопросы)

| # | Вопрос | Решение |
|---|---|---|
| 1 | Интеграция с бюджетом (`t_f_budget_fact`) | **НЕ интегрируем.** `fact_id` из `t_f_medicine_stock` убран. `purchase_price` хранится только для аналитики внутри модуля. Find-or-create статьи и создание `BudgetFact` исключены. |
| 2 | Snooze по умолчанию + переопределение | **30 мин по умолчанию**, переопределяется на курсе через поле `snooze_minutes`. |
| 3 | Получатели одного напоминания | **Пациенту И опекуну всегда.** На каждый `intake_log` создаются записи `t_medicine_reminder` для `guardian_user_id` и (если есть) `patient.linked_user_id`. Дубль (опекун == залинкованный пользователь) гасится `UNIQUE(intake_log_id, recipient_user_id)`. |
| 4 | Лимит частоты приёмов | **Без жёсткого cap.** `intake_times` любой длины; soft-warning в UI при >6 приёмов/день. |
| 5 | Быстрые действия в Web Push | **Только Telegram inline-кнопки.** `sw.js` не дорабатываем (`actions[]`/`notificationaction` не реализованы в проекте). Web Push = клик открывает `/medicines`. |
| 6 | Связь «курс из аптечки» | **Мягко.** Курс ссылается на каталог `medicine_id`; селектор показывает каталог с пометкой наличия в аптечке. Если активного остатка нет — предупреждение + кнопка «добавить в аптечку», но создание НЕ блокируется (без 400). |
| 7 | Показ остатка на приёмах | **Да.** Агрегированный остаток по лекарству (Σ по упаковкам) + оценка «хватит на N приёмов/дней» на карточке курса и в списке «на сегодня». |
| 8 | Импорт CSV / Google Sheets | **Два раздельных импорта** (аптечка и курсы), каждый зеркалит shopping_list-флоу `analyze→map→preview→execute`. В импорте курсов пациент — **обязательная колонка** (find-or-create `family_member` по имени). |

## Архитектурные инварианты (из кода проекта)

- **Время** — naive `datetime` в `SYSTEM_TIMEZONE` во всех полях (как `ScheduledReminder`). Сравнение в scheduler: `now_local().replace(tzinfo=None)`.
- **Видимость** — shared: вся семья = все пользователи. `patient_id` нужен для назначения/напоминаний, не для изоляции. Любой взрослый видит и редактирует всё.
- **Дети без аккаунта** — отдельная таблица `t_d_family_member`; CHECK `telegram_id OR email IS NOT NULL` в `t_d_user` не ослабляем.
- **Миграции** — raw SQL через `op.execute`; первый `down_revision = 524e09e9f39a` (текущий head).
- **WebSocket** — `_broadcast_and_buffer(event_type: str, data: dict)` в `budget_ws.py`; плоский типизированный broadcast (без каналов/подписок), все клиенты получают все события — как `shopping_list_*`.
- **Bot→API** — `bot/utils/api_client.py` (httpx + JWT Bearer); callbacks через `CallbackQueryHandler`.

## Модель данных

### 1. `t_d_medicine` — справочник (Dimension, SCD Type 1 + history)

Один общий справочник на семью. Текущее состояние в основной таблице; полная история — `t_d_medicine_history` (паттерн `product_group_history`). Удаление — только soft-archive (`is_active=False`); hard delete запрещён при наличии связанных `stock`/`course` с `deleted_at IS NULL`.

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `name` | str(255) | Торговое название («Нурофен 200мг») |
| `inn` | str(255)? | МНН — группировка аналогов |
| `form` | enum | tablet/capsule/syrup/drops/ointment/spray/injection/other |
| `dosage` | str(100)? | «200 mg», «5 ml/доза» |
| `prescription_required` | bool | |
| `notes` | text? | Свободный текст |
| `is_active` | bool | soft-archive |
| `creator_id` | FK user | |
| `created_at/updated_at` | datetime | |

### 2. `t_d_family_member` — члены семьи

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `linked_user_id` | FK user? | Если у члена семьи есть аккаунт |
| `guardian_user_id` | FK user, NOT NULL | Опекун — куда летят напоминания всегда |
| `name` | str(255) | «Маша», «Бабушка» |
| `birth_date` | date? | Расчёт дозировки по возрасту |
| `notes` | text? | Аллергии, особенности |
| `created_at/updated_at` | datetime | |

### 3. `t_f_medicine_stock` — аптечка (одна упаковка = одна запись)

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `medicine_id` | FK medicine | |
| `quantity_remaining` | Decimal(10,3) | Остаток |
| `quantity_initial` | Decimal(10,3) | При покупке |
| `unit` | str(50) | «шт», «мл», «доз» |
| `expiry_date` | date **indexed** | Алерт при <30 дней |
| `purchase_date` | date? | |
| `purchase_price` | Decimal(10,2)? | Только аналитика модуля (НЕ бюджет) |
| `location` | str(100)? | «Кухня, шкаф» |
| `creator_id`, `version`, `deleted_at`, `last_modified_by`, `created_at`, `updated_at` | | как `shopping_list_item` |

> **Дельта от базового дока:** поле `fact_id` удалено (нет интеграции с бюджетом).

### 4. `t_f_medicine_course` — курс приёма

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `medicine_id` | FK medicine | |
| `patient_id` | FK family_member, NOT NULL | Для кого |
| `prescribed_by` | str(255)? | Врач / самолечение |
| `dose_amount` | Decimal(10,3) | За приём |
| `dose_unit` | str(50) | |
| `intake_times` | JSON | `["08:00","14:00","20:00"]` в SYSTEM_TIMEZONE; частота = `len(intake_times)` |
| `with_food` | enum? | before/with/after/any |
| `start_date` | date | |
| `end_date` | date? | NULL = постоянный; при создании «по длительности» вычисляется на сервере |
| `schedule_type` | enum | daily/every_n_days/weekdays |
| `schedule_config` | JSON? | `{"n":2}` или `{"days":["mon","wed","fri"]}` |
| `is_active` | bool | идёт / завершён / приостановлен |
| `reminders_enabled` | bool | |
| `notification_channels` | JSON | `["telegram","web_push"]` |
| `snooze_minutes` | int, default 30 | **Новое поле** — переопределение snooze на курсе |
| `comment` | text? | |
| `deleted_at` | datetime? | soft delete завершённого курса |
| `creator_id`, `created_at`, `updated_at` | | |

> **Дельта от базового дока:** добавлено поле `snooze_minutes int default 30`.

### 5. `t_f_medicine_intake_log` — журнал приёма

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `course_id` | FK course CASCADE | |
<<<<<<< HEAD
| `patient_id` | FK family_member | Дубль для быстрого фильтра |
=======
| `patient_id` | FK family_member | Денормализация под индекс `(patient_id, scheduled_at)` — фильтр без join к course |
>>>>>>> 58743c43 (docs: medicine tracking implementation spec)
| `scheduled_at` | datetime | Плановое время (naive, SYSTEM_TIMEZONE) |
| `taken_at` | datetime? | Факт приёма (NULL = не отмечено) |
| `status` | enum | scheduled/taken/skipped/late |
| `dose_taken` | Decimal(10,3)? | Если отличается от плановой |
| `stock_id` | FK stock? | Из какой упаковки списали |
| `comment` | text? | |
| `marked_by` | FK `t_d_user.id`? | Кто отметил (родитель за ребёнка) |
| `version` | int | Optimistic locking — конкурентные отметки |
| `created_at`, `updated_at` | | |

Индексы: `(patient_id, scheduled_at)`, `(course_id, scheduled_at)`, `(status)`.
Constraint: `UNIQUE(course_id, scheduled_at)` — идемпотентность генерации.
Soft delete не нужен (журнал неизменный).

### 6. `t_medicine_reminder` — напоминания

Копия паттерна `t_scheduled_reminder`. Одна запись = один пуш одному получателю на один приём.

| Поле | Тип | Описание |
|---|---|---|
| `id` | int PK | |
| `intake_log_id` | int indexed | FK на intake_log (без UNIQUE на сам ключ) |
| `recipient_user_id` | FK `t_d_user.id`, NOT NULL | Кому слать |
| `reminder_datetime` | datetime indexed | naive, SYSTEM_TIMEZONE |
| `status` | str(20) | pending/sent/failed/cancelled |
| `sent_at`, `telegram_sent`, `web_push_sent`, `error_message`, `retry_count` | | как `ScheduledReminder` |

Constraint: `UNIQUE(intake_log_id, recipient_user_id)` — один пуш одному получателю на приём; гасит дубль когда опекун совпадает с залинкованным пользователем пациента.

## Поведение

### Связь аптечка ↔ курс ↔ приём
- **Курс** ссылается на каталог `medicine_id` (а не на конкретную упаковку): курс длиннее одной пачки, при опустошении продолжается на следующей.
- **Создание курса (мягкая связь):** селектор лекарства показывает каталог; элементы с активным остатком (`quantity_remaining > 0`) помечены и подняты наверх. Если у выбранного лекарства остатка нет — предупреждение «нет в аптечке» + кнопка «добавить в аптечку». Создание не блокируется.
- **Остаток на приёмах:** на карточке курса и в списке «на сегодня» показываем агрегат
  `remaining = Σ stock.quantity_remaining WHERE medicine_id = course.medicine_id AND deleted_at IS NULL AND quantity_remaining > 0`
<<<<<<< HEAD
  и оценку: `хватит на ⌊remaining / dose_amount⌋ приёмов` (≈ дней = приёмы / `len(intake_times)` для `schedule_type=daily`). Это read-only агрегат, отдельных полей не хранит.
=======
  и оценку: `приёмов_хватит = ⌊remaining / dose_amount⌋`, `≈ дней = ⌊приёмов_хватит / приёмов_в_день⌋`, где `приёмов_в_день` зависит от расписания: `daily` → `len(intake_times)`; `every_n_days` → `len(intake_times) / n`; `weekdays` → `len(intake_times) * len(days) / 7`. Это read-only агрегат, отдельных полей не хранит.
>>>>>>> 58743c43 (docs: medicine tracking implementation spec)
- **Фактическое списание** — Фаза 4 (`intake_log.stock_id`, FIFO по `expiry_date`).

### Получатели напоминаний
На каждый `intake_log` создаются reminder-записи для `patient.guardian_user_id` **и** для `patient.linked_user_id` (если задан). Совпадение получателей дедуплицируется `UNIQUE(intake_log_id, recipient_user_id)`.

### Snooze
Callback `med:snooze:{log_id}` → создаётся новая запись `t_medicine_reminder` с `reminder_datetime = now_local() + course.snooze_minutes`, `status='pending'`. Исходная запись помечается `sent`. Лейбл Telegram-кнопки подставляет фактический интервал курса (`«🕐 Отложить {snooze_minutes} мин»`).

### Отметка приёма и конкурентность
`take`/`skip` используют optimistic locking по `intake_log.version`: при расхождении версии API возвращает `409 Conflict` (два взрослых отметили один приём). Клиент перечитывает лог и показывает актуальный статус.

### Web Push payload
Все пуши модуля задают `data.url = "/medicines"` и `data.type = "medicine_reminder"` / `"medicine_expiry"` — **не** `"sync_completed"` (иначе `sw.js` увёл бы на `/facts`). Кнопок-действий в Web Push нет: клик открывает дашборд.

<<<<<<< HEAD
### Списание остатков (Итерация 4)
=======
### Списание остатков (Фаза 4)
>>>>>>> 58743c43 (docs: medicine tracking implementation spec)
При `POST /medicine-intakes/{id}/take`:
- если задан `stock_id` → списываем из этой упаковки атомарно (`SELECT … FOR UPDATE`, `quantity_remaining -= dose_taken`);
- если не задан → FIFO: `medicine_id = course.medicine_id AND quantity_remaining > 0 AND deleted_at IS NULL ORDER BY expiry_date ASC LIMIT 1`;
- если подходящих остатков нет → лог создаётся без `stock_id` + уведомление «закончилось X» + автодобавление в `shopping_list`.

### Генерация intake_log
Ночной maintenance-job (не храним курс на год вперёд):
- генерит `intake_log` на 7 дней вперёд для всех активных курсов;
- создаёт `t_medicine_reminder` на каждый log — только при `course.reminders_enabled=True` и по каналам из `course.notification_channels` (по записи на каждого получателя);
- идемпотентность через `UNIQUE(course_id, scheduled_at)`;
- переводит просроченные `scheduled → late` при `scheduled_at < now() - 24h`;
- lazy-backfill: при открытии дашборда сервис догенеривает пропущенные дни (если приложение не открывали дольше недели).

### Алерты по сроку годности
Тот же ежедневный job: выборка stock с `expiry_date <= today + 30d AND quantity_remaining > 0 AND deleted_at IS NULL` → пуш + значок на странице аптечки. Пуш шлётся **напрямую** broadcast-рассылкой (telegram + web-push) по паттерну `NotificationService.check_all_budget_thresholds` — `t_medicine_reminder` для этого НЕ требуется (он только для приёмов по курсу).

## Сервисы и API

Слой повторяет `shopping_list_service` + `reminder_service`. Сервисы: `MedicineService`, `FamilyMemberService`, `MedicineStockService`, `MedicineCourseService`, `MedicineIntakeService`, `MedicineReminderService`. Все мутации → broadcast типизированных событий `medicine_*` через `_broadcast_and_buffer` (см. секцию Frontend).

`DELETE /family-members/{id}` — soft-archive; hard-delete блокируется при наличии курсов с `deleted_at IS NULL` (как у `medicine`). `DELETE /medicines/{id}` — soft-archive (`is_active=False`), блок при связанных `stock`/`course` с `deleted_at IS NULL`.

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
POST   /api/v1/medicine-intakes/{id}/take
POST   /api/v1/medicine-intakes/{id}/skip
POST   /api/v1/medicine-intakes/{id}/snooze

# Импорт CSV / Google Sheets (Фаза 5)
POST   /api/v1/medicine-stock/import/analyze       # detect columns + auto-mapping
POST   /api/v1/medicine-stock/import/preview       # dry-run: ошибки/предупреждения по строкам
POST   /api/v1/medicine-stock/import/execute       # find-or-create medicine + создать stock
POST   /api/v1/medicine-stock/google-sheets/fetch  # url → public CSV-export → base64
POST   /api/v1/medicine-courses/import/analyze
POST   /api/v1/medicine-courses/import/preview
POST   /api/v1/medicine-courses/import/execute     # find-or-create medicine + family_member + создать courses
POST   /api/v1/medicine-courses/google-sheets/fetch
```

## Импорт CSV + Google Sheets (Фаза 5)

Два независимых импорта, оба зеркалят готовый флоу shopping_list: `analyze → (map) → preview (dry-run) → execute`. Переиспользуем существующую инфраструктуру:
- `services/google_sheets_parser.py` — `parse_google_sheets_url` + `fetch_google_sheets_as_csv` (публичный CSV-export через httpx, без API-ключа; лист должен быть «доступен по ссылке»).
- `services/csv_detector.py`, `csv_column_matcher.py`, `csv_validator.py`, `csv_security.py` (санитайзинг CSV-инъекций).
- Фронт: новые визарды по образцу `frontend/web/static/js/lists/CSVImporter.js` и `googleSheetsImporter.js` (5 шагов).

**Импорт аптечки (stock).** Колонки: `name` (обяз.), `inn?`, `form?`, `dosage?`, `quantity` (обяз.), `unit` (обяз.), `expiry_date?`, `purchase_date?`, `purchase_price?`, `location?`. На `execute`: find-or-create `t_d_medicine` по `(name, dosage)`; создаётся запись `t_f_medicine_stock`.

**Импорт курсов (course).** Колонки: `patient` (**обяз.**), `medicine` (обяз.), `dose_amount` (обяз.), `dose_unit`, `intake_times` (обяз., напр. `08:00;20:00`), `schedule_type?`, `start_date` (обяз.), `end_date?`, `with_food?`, `notification_channels?`. На `execute`: find-or-create `t_d_family_member` по `name`, find-or-create `t_d_medicine`, создаётся `t_f_medicine_course`. Связь со стоком — мягкая (решение #6): строки без остатка не блокируются, помечаются предупреждением в preview.

Preview — строго dry-run (без записей в БД), отчёт ошибок/предупреждений построчно (как `shopping_csv_import.preview`). `execute` идемпотентен по find-or-create справочников.

## Scheduler (`backend/app/scheduler.py`)

Два новых job по паттерну `advisory_xact_lock` + `CronTrigger`:

- **`LOCK_ID_MEDICINE_DISPATCH = 1009`** — каждые 5 мин. `MedicineReminderService.get_due → send (telegram + web_push) → mark_sent`. Точная копия `send_plan_reminders_job`; переиспользует telegram-клиент и web-push из `ReminderService`.
- **`LOCK_ID_MEDICINE_MAINTENANCE = 1010`** — ежедневно (предложить 03:00, после `generate_recurring_facts` в 02:00). Объединяет: (а) генерацию `intake_log`+`reminder` на 7 дней, (б) `scheduled → late`, (в) expiry-alert. Собирается инкрементально: Фаза 1 заводит job только с частью (в); Фаза 2 добавляет (а)+(б).

## Frontend (web)

Страницы:
1. `/medicines` — дашборд: «Сегодня надо принять» (по членам семьи, с остатком и «хватит на N») + «Истекает в этом месяце» + «Заканчивается».
2. `/medicines/catalog` — справочник.
3. `/medicines/stock` — аптечка с фильтрами по сроку годности + кнопка импорта (CSV / Google Sheets).
4. `/medicines/courses` — активные/завершённые курсы + кнопка импорта (CSV / Google Sheets).
5. `/medicines/courses/{id}` — карточка курса (остаток + «хватит на N приёмов/дней») + календарь + журнал.

Селектор лекарства в форме курса: каталог, in-stock элементы помечены/подняты; при отсутствии остатка — предупреждение + кнопка «добавить в аптечку».
Импорт-визарды (stock и courses) — по образцу `CSVImporter.js` / `googleSheetsImporter.js`, 5 шагов, с dry-run preview.

Real-time: типизированные события `medicine_*` (`medicine_stock_changed`, `medicine_course_changed`, `medicine_intake_marked`, …) в общий broadcast-поток через `_broadcast_and_buffer`. Каналов/подписок в проекте НЕТ — все подключённые клиенты получают все события (как `shopping_list_*`); фильтрация по `patient_id` выполняется на клиенте. Bundles: новые IIFE-entry-points в `frontend/web/` по образцу `shopping_lists.ts`; публичные функции через `windowExports.ts`.

## Bot (Telegram)

`bot/handlers/medicine.py`:
- `/medicines` — открыть Web App (`WebAppInfo`, как `start.py`).
- `/taken` — быстрая отметка ближайшего приёма.
- `CallbackQueryHandler(pattern="^med:")` — `med:take:{id}` / `med:skip:{id}` / `med:snooze:{id}` → `api_client` (JWT) → соответствующий POST.

Пуш-уведомление:
```
💊 Пора принять: Нурофен 200мг
👤 Маша  ⏰ 14:00
1 таблетка после еды
[✅ Принял] [⏭ Пропустить] [🕐 Отложить {snooze_minutes} мин]
```

Интервал в кнопке «Отложить» подставляется из `course.snooze_minutes` (default 30).

## Декомпозиция (5 фаз, каждая независимо shippable)

**Фаза 1 — MVP «Аптечка»**
- Миграции: `t_d_medicine` (+history), `t_d_family_member`, `t_f_medicine_stock`.
- CRUD API: medicines, family-members, medicine-stock (soft-archive + блок удаления при связях).
- Страницы `/medicines/catalog`, `/medicines/stock`.
- Daily expiry-alert (maintenance-job, часть «в») + значок в UI.
- *Цель: видим, что есть дома и что скоро истекает.*

**Фаза 2 — Курсы**
- Миграции: `t_f_medicine_course`, `t_f_medicine_intake_log`.
- CRUD курсов + pause/complete; мягкая связь с аптечкой в форме курса (решение #6).
- Генерация intake_log на 7 дней + lazy-backfill + `scheduled → late` (maintenance-job «а»,«б»).
- Дашборд `/medicines` «приём на сегодня» по членам семьи + показ остатка и «хватит на N» (решение #7).

**Фаза 3 — Напоминания**
- Миграция: `t_medicine_reminder`.
- Dispatch-job (`LOCK_ID_MEDICINE_DISPATCH = 1009`).
- Fan-out получателей (пациент + опекун).
- Telegram inline-кнопки + callbacks; Web Push click-to-open `/medicines`; snooze.

**Фаза 4 — Интеграции (без бюджета)**
- Списание остатков (FIFO / `FOR UPDATE`) при отметке приёма.
- Автодобавление «закончилось» в `shopping_list`.
- Аналитика трат внутри модуля по `purchase_price` (без `t_f_budget_fact`).

**Фаза 5 — Импорт (CSV + Google Sheets)** *(зависит только от Фаз 1–2; можно делать параллельно Фазам 3–4)*
- Импорт аптечки (stock) и импорт курсов — раздельные визарды `analyze→map→preview→execute`.
- Переиспользование `google_sheets_parser`, `csv_detector/column_matcher/validator/security`.
- Импорт курсов: пациент — обязательная колонка (find-or-create `family_member`).

## Тестирование

- **pytest:** модели и миграции; идемпотентность генерации (`UNIQUE(course_id, scheduled_at)`); FIFO-списание + конкурентность (`version`); fan-out получателей + дедуп (`UNIQUE(intake_log_id, recipient_user_id)`); snooze (новая reminder-запись на `now+snooze_minutes`); `scheduled → late`; агрегат остатка + оценка «хватит на N»; импорт: парсинг, dry-run preview, find-or-create medicine/family_member, обязательность колонки `patient`, санитайзинг CSV-инъекций.
- **Vitest:** дашборд и фильтр по члену семьи; обновление по WebSocket; визард импорта (шаги analyze→preview→execute).
- **e2e (Playwright):** отметка приёма с real-time обновлением; импорт курсов через CSV; брейкпоинты 375/768/1280px.

## Вне объёма (YAGNI)

- Интеграция с `t_f_budget_fact` (явно исключена решением #1).
- Web Push action-кнопки (`actions[]` в `sw.js`).
- Обобщённый reminder-движок.

## Связанные документы

- `docs/MEDICINE_TRACKING_DESIGN.md` — базовый дизайн (Вариант D).
- `backend/app/models/shopping_list.py`, `shopping_list_item.py` — образец Header+Lines + shared + SCD.
- `backend/app/models/scheduled_reminder.py`, `backend/app/services/reminder_service.py`, `backend/app/scheduler.py` — образец напоминаний и диспетчеризации.
- `backend/app/api/v1/endpoints/budget_ws.py` — WebSocket broadcast.
- `bot/handlers/start.py`, `bot/utils/api_client.py`, `sw.js` — Web App launch, bot→API, push-click.
- `backend/app/services/google_sheets_parser.py` — fetch Google Sheets как public CSV.
- `backend/app/api/v1/endpoints/shopping_csv_import.py`, `services/csv_detector.py`, `csv_column_matcher.py`, `csv_validator.py`, `csv_security.py` — образец import-флоу analyze→preview→execute.
- `frontend/web/static/js/lists/CSVImporter.js`, `googleSheetsImporter.js` — образец frontend import-визарда.
