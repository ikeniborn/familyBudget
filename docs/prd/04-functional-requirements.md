## 4. Functional Requirements

### 📊 Project Phases Overview

| Phase | Status | FR Count | Description |
|-------|--------|----------|-------------|
| **Phase 1 (v1.0-v4.4.0)** | ✅ COMPLETED | 18 FR | Backend API + Web Analytics + Admin + Deployment |
| **Phase 2 (v5.0.0-beta)** | ✅ COMPLETED | 6 FR | Telegram Bot + ЦФО/МВЗ + Advanced Analytics UI |
| **Phase 3 (v5.1.0-beta)** | ✅ COMPLETED | 9 FR | Telegram Web Apps via Menu Button (8 HTML forms) |

### Phase 1 Implementation Summary (COMPLETED ✅)

**Web Analytics:** FR-010, FR-011, FR-012 (fully), FR-013, FR-014 (backend ready)
**Admin Features:** FR-020, FR-021, FR-051 (Monitoring Dashboard - NEW)
**Auth & Data:** FR-030, FR-031, FR-040, FR-041, FR-042
**Operations:** FR-050, FR-060
**API Extensions:** FR-052 (Health Checks - NEW), FR-053 (Hierarchy API - NEW)

**Total Phase 1:** 18 FR реализовано

### Phase 2 Implementation Summary (COMPLETED ✅)

**Telegram Bot:** FR-001, FR-002, FR-003, FR-004, FR-005, FR-006 (fully implemented)
**ЦФО/МВЗ Integration:** 10 new API endpoints, SCD Type 2 support
**Advanced Analytics UI:** FR-013 (Waterfall), FR-014 (Heatmap) - fully implemented

**Total Phase 2:** 6 FR реализовано

### Phase 3 Implementation Summary (COMPLETED ✅)

**Telegram Web Apps:** FR-070, FR-071, FR-072, FR-073, FR-074, FR-075, FR-076, FR-077, FR-078 (9 forms via Menu Button)
**Architecture:** Single page apps with modular JavaScript, Telegram SDK integration
**Technology:** Vanilla JS ES6+, Telegram Web Apps SDK, ~190KB bundle

**Total Phase 3:** 9 FR реализовано

### 🎉 Project Status

**Total Functional Requirements Implemented:** 33/33 (100%) ✅

---

### 4.1 Telegram Bot Features (✅ PHASE 2 - COMPLETED)

**СТАТУС:** Все FR в этом разделе реализованы в v5.0.0-beta. Telegram Bot полностью интегрирован с Backend API.

| ID | Название | Phase | Приоритет | Acceptance Criteria Count |
|----|----------|-------|-----------|---------------------------|
| FR-001 | Добавление расхода | Phase 2 | Critical | 7 |
| FR-002 | Добавление плана | Phase 2 | Critical | 3 |
| FR-003 | Просмотр итогов | Phase 2 | High | 4 |
| FR-004 | Корректировка записей | Phase 2 | High | 5 |
| FR-005 | Еженедельные отчеты | Phase 2 | High | 4 |
| FR-006 | Уведомления о превышении бюджета | Phase 2 | High | 4 |

#### FR-001: Telegram Bot - Добавление расхода

**Phase:** 2 (COMPLETED ✅)
**Приоритет:** Critical
**Категория:** telegram_bot
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.0.0-beta)

**Описание:**
Пользователь через Telegram бота может добавить фактический расход с указанием:
- Суммы
- ЦФО (выбор из справочника)
- МВЗ (выбор из справочника)
- Статьи расходов (выбор из иерархического справочника)
- Периода (выбор из справочника)
- Комментария (опционально)
- Даты транзакции (по умолчанию - текущая)

**User Story:**
Как пользователь семейного бюджета, я хочу быстро добавить расход через Telegram, чтобы не забыть зафиксировать трату.

**Acceptance Criteria:**
1. Бот запрашивает все обязательные поля последовательно
2. Справочники отображаются через inline-клавиатуры
3. Иерархия статей отображается корректно (дерево)
4. Валидация суммы (положительное число, до 2 знаков после запятой)
5. Подтверждение успешного добавления с итоговой информацией
6. Возможность отменить операцию командой /cancel
7. Запись привязывается к пользователю автоматически

**Dependencies:**
- FastAPI endpoint POST /api/v1/facts
- Справочники актуализированы

---

#### FR-002: Telegram Bot - Добавление плана

**Phase:** 2 (COMPLETED ✅)
**Приоритет:** Critical
**Категория:** telegram_bot
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.0.0-beta)

**Описание:**
Пользователь через Telegram бота может добавить плановую запись бюджета с указанием:
- Плановой суммы
- ЦФО
- МВЗ
- Статьи расходов
- Периода (на который планируется)
- Комментария

**User Story:**
Как пользователь, я хочу планировать бюджет на период, чтобы контролировать расходы.

**Acceptance Criteria:**
1. Аналогичный UX как для добавления расхода
2. Запись создается с типом "plan"
3. Возможность добавить несколько плановых записей на один период

---

#### FR-003: Telegram Bot - Просмотр итогов

**Phase:** 2 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_bot
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.0.0-beta)

**Описание:**
Пользователь может запросить у бота итоги по своим расходам:
- За текущий период
- За выбранный период
- Общие итоги (план vs факт)
- По конкретной статье

**User Story:**
Как пользователь, я хочу быстро узнать текущее состояние бюджета, чтобы понимать, сколько уже потрачено.

**Acceptance Criteria:**
1. Команда /summary показывает итоги за текущий период
2. Возможность выбрать период через inline-клавиатуру
3. Отображение: план, факт, остаток, процент выполнения
4. Группировка по статьям верхнего уровня

---

#### FR-004: Telegram Bot - Корректировка записей

**Phase:** 2 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_bot
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.0.0-beta)

**Описание:**
Пользователь может редактировать или удалять свои собственные записи (план/факт). Нельзя редактировать чужие записи.

**User Story:**
Как пользователь, я хочу исправить ошибочно введенную запись, чтобы данные были корректными.

**Acceptance Criteria:**
1. Команда /edit показывает последние 10 записей пользователя
2. Выбор записи через inline-клавиатуру
3. Возможность изменить любое поле или удалить запись
4. Запрет на редактирование чужих записей с сообщением об ошибке
5. Подтверждение перед удалением

---

#### FR-005: Telegram Bot - Еженедельные отчеты план-факт

**Phase:** 2 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_bot
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.0.0-beta)

**Описание:**
Каждую неделю (например, в воскресенье вечером) бот автоматически отправляет всем пользователям отчет по план-факту за прошедшую неделю.

**User Story:**
Как пользователь, я хочу получать регулярные отчеты, чтобы видеть динамику без необходимости запрашивать вручную.

**Acceptance Criteria:**
1. Отчет отправляется по расписанию (cron/schedule)
2. Формат: план, факт, отклонение (абс. и %), топ-3 статьи по расходам
3. Пользователь может отключить уведомления командой /settings
4. Возможность настроить день и время отправки (опционально в v2)

---

#### FR-006: Telegram Bot - Уведомление о превышении бюджета

**Phase:** 2 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_bot
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.0.0-beta)

**Описание:**
Когда фактические расходы по статье/периоду превышают план на определенный процент (например, 90%), бот отправляет уведомление пользователю.

**User Story:**
Как пользователь, я хочу получать предупреждения о превышении бюджета, чтобы вовремя скорректировать траты.

**Acceptance Criteria:**
1. Проверка выполняется при добавлении нового расхода
2. Порог предупреждения настраиваемый (по умолчанию 90%)
3. Уведомление содержит: статью, план, факт, процент
4. Не отправлять повторные уведомления для той же статьи/периода

---

---

### 4.2 Web Analytics Features (✅ PHASE 1 - COMPLETED)

#### FR-010: Веб - План-факт анализ (столбчатая диаграмма)

**Phase:** 1 ✅ **РЕАЛИЗОВАНО**
**Приоритет:** Critical
**Категория:** web_analytics

**Описание:**
Интерактивная столбчатая диаграмма, показывающая план и факт по периодам/статьям. Группировка: по периодам (месяцы) или по статьям верхнего уровня.

**Acceptance Criteria:**
1. Использование ECharts для визуализации
2. Два столбца на каждую категорию (План / Факт)
3. Фильтрация по датам, статьям, ЦФО, МВЗ
4. Отображение отклонения (абс. и %)
5. Адаптивность для мобильных устройств

---

#### FR-011: Веб - Динамика затрат (линейный график)

**Приоритет:** Critical  
**Категория:** web_analytics

**Описание:**
Линейный график показывает динамику фактических затрат по периодам. Возможность наложить несколько линий для сравнения статей.

**Acceptance Criteria:**
1. Использование ECharts
2. Ось X - периоды (месяцы/недели), ось Y - суммы
3. Возможность выбрать до 5 статей для отображения
4. Zoom и pan функциональность
5. Tooltip с детальной информацией

---

#### FR-012: Веб - Структура расходов (круговая диаграмма)

**Приоритет:** High  
**Категория:** web_analytics

**Описание:**
Круговая диаграмма (pie chart) показывает распределение расходов по статьям за выбранный период.

**Acceptance Criteria:**
1. Использование ECharts
2. Группировка по статьям верхнего уровня
3. Процентное соотношение и абсолютные суммы
4. Drill-down: клик на сегмент показывает подстатьи
5. Легенда с возможностью скрыть/показать категории

---

#### FR-013: Веб - Waterfall для бюджета

**Phase:** 1/2 ✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО** (Backend + UI completed in v5.0.0-beta)
**Приоритет:** High
**Категория:** web_analytics
**Implementation Status:** ✅ FULLY IMPLEMENTED (Backend in Phase 1, UI in v5.0.0-beta)

**Описание:**
Waterfall диаграмма показывает последовательное изменение бюджета: начальный план → корректировки → факт → остаток.

**Acceptance Criteria:**
1. Использование ECharts
2. Положительные и отрицательные изменения разными цветами
3. Итоговый столбец показывает финальный результат
4. Фильтрация по периоду и статье

---

#### FR-014: Веб - Heatmap (тепловая карта)

**Phase:** 1/2 ✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО** (Backend + UI completed in v5.0.0-beta)
**Приоритет:** Medium
**Категория:** web_analytics
**Implementation Status:** ✅ FULLY IMPLEMENTED (Backend in Phase 1, UI in v5.0.0-beta)

**Описание:**
Тепловая карта показывает интенсивность расходов: Оси: периоды (недели/месяцы) × статьи, цвет - сумма расходов.

**Acceptance Criteria:**
1. Использование ECharts
2. Цветовая шкала от минимума (светлый) к максимуму (темный)
3. Tooltip с точными суммами
4. Возможность выбрать временной интервал (неделя/месяц/квартал)

---

---

### 4.3 Admin CRUD Features (✅ PHASE 1 - COMPLETED)

#### FR-020: Веб - CRUD справочников (только для администратора)

**Приоритет:** Critical  
**Категория:** web_admin

**Описание:**
Администратор может управлять справочниками через веб-интерфейс:
- Статьи расходов (иерархия дерева)
- ЦФО (плоский список)
- МВЗ (плоский список)
- Периоды (плоский список)

**User Story:**
Как администратор, я хочу управлять справочниками через удобный веб-интерфейс, чтобы не работать напрямую с базой данных.

**Acceptance Criteria:**
1. Доступ только для пользователя с флагом is_admin=true
2. HTMX-формы для создания, редактирования, деактивации записей
3. При редактировании SCD2: старая версия закрывается, создается новая
4. Для статей: визуализация дерева, возможность перетаскивания (drag-and-drop опционально)
5. Валидация уникальности кодов
6. Soft delete: установка valid_to вместо физического удаления

---

#### FR-021: Веб - Просмотр и редактирование фактов

**Приоритет:** High  
**Категория:** web_admin

**Описание:**
Администратор может просматривать и редактировать записи фактов всех пользователей. Обычный пользователь видит только свои записи.

**Acceptance Criteria:**
1. Таблица с фильтрацией по: пользователю, периоду, статье, типу (план/факт)
2. Inline-редактирование через HTMX
3. Пагинация (50 записей на страницу)
4. Поиск по комментариям
5. Batch операции: массовое удаление выбранных

---

### 4.4 Authentication & Authorization

#### FR-030: Авторизация через Telegram Login Widget

**Приоритет:** Critical  
**Категория:** auth

**Описание:**
Пользователь авторизуется на веб-сайте через официальный Telegram Login Widget. После успешной авторизации создается JWT токен для сессии.

**Acceptance Criteria:**
1. Использование официального Telegram Login Widget
2. Валидация hash от Telegram согласно документации
3. Создание или обновление пользователя в БД
4. JWT токен с временем жизни 7 дней
5. Refresh token механизм (опционально для v2)
6. Сохранение токена в httpOnly cookie

---

#### FR-031: Простая RBAC модель

**Приоритет:** High  
**Категория:** auth

**Описание:**
Два уровня доступа:
- Администратор (is_admin=true): полный доступ ко всем функциям
- Пользователь (is_admin=false): доступ только к своим данным и аналитике

**Acceptance Criteria:**
1. Единственный администратор определяется в переменной окружения
2. Проверка прав на уровне API endpoints (декоратор @require_admin)
3. UI не показывает админские разделы обычным пользователям
4. Попытка доступа к админским эндпоинтам возвращает 403 Forbidden

---

### 4.5 Data Management

#### FR-040: Иерархические справочники (дерево)

**Приоритет:** Critical  
**Категория:** database

**Описание:**
Справочники (особенно статьи расходов) должны поддерживать иерархическую структуру. Пример: Продукты → Еда → Молочные продукты → Молоко

**Технический подход:**
Использование pattern "Closure Table" или PostgreSQL ltree для представления дерева. Рекомендуется Closure Table для простоты запросов.

**Acceptance Criteria:**
1. Поддержка произвольной глубины вложенности
2. Эффективные запросы для получения поддерева
3. Эффективные запросы для получения пути от корня до узла
4. Ограничения целостности на уровне БД

---

#### FR-041: SCD Type 2 для всех справочников

**Приоритет:** Critical  
**Категория:** database

**Описание:**
Все справочники (статьи, ЦФО, МВЗ, периоды) должны хранить историю изменений через SCD Type 2 подход.

**Acceptance Criteria:**
1. Каждая запись имеет: valid_from, valid_to, is_current
2. При обновлении: старая запись закрывается (valid_to=NOW()), создается новая
3. Создать представления (views) для актуальных записей: v_d_article_current, v_d_cost_center_current и т.д.
4. Приложение работает с представлениями для выборки актуальных данных
5. Факты ссылаются на ID записи справочника (не меняется при обновлении)

---

#### FR-042: Изоляция данных (app-level)

**Приоритет:** Medium  
**Категория:** database

**Описание:**
Row-Level Security НЕ используется. Изоляция данных пользователей обеспечивается на уровне приложения (FastAPI) через фильтрацию WHERE user_id = current_user.

**Обоснование:**
Упрощение архитектуры для домашнего проекта с малым количеством пользователей.

**Acceptance Criteria:**
1. FastAPI middleware автоматически добавляет фильтр user_id к запросам
2. Администратор может видеть все данные (без фильтра)

---

### 4.6 Operations Features

#### FR-050: Автоматическое резервное копирование в Яндекс Object Storage

**Приоритет:** Critical  
**Категория:** backup

**Описание:**
Ежедневное резервное копирование PostgreSQL с локальным хранением и загрузкой в Яндекс Object Storage.

**Acceptance Criteria:**
1. Ежедневный pg_dump в сжатом формате (.sql.gz)
2. Локальное хранение последних 7 дней
3. Еженедельная загрузка в Яндекс Object Storage
4. Retention policy в S3: 4 недели
5. Bash скрипт с логированием и уведомлениями об ошибках
6. Cron задача для автоматического запуска

---

#### FR-060: Bash скрипты для автоматического развертывания на VPS

**Приоритет:** Critical  
**Категория:** deployment

**Описание:**
Полностью автоматизированное развертывание приложения на VPS через bash скрипты. Скрипты должны:
- Установить все необходимые пакеты (Docker, Docker Compose, PostgreSQL client и т.д.)
- Настроить firewall (UFW)
- Создать структуру директорий
- Настроить переменные окружения
- Запустить Docker Compose
- Настроить cron для бэкапов

**Acceptance Criteria:**
1. Скрипт install.sh устанавливает все зависимости
2. Скрипт setup.sh настраивает конфигурацию (интерактивный ввод параметров)
3. Скрипт deploy.sh разворачивает приложение
4. Поддержка Ubuntu 20.04+ / Debian 11+
5. Проверка пререквизитов (права sudo, интернет и т.д.)
6. Rollback механизм при ошибках
7. Логирование всех действий
8. Документация с пошаговой инструкцией

---

### 4.4 Telegram Web Apps Features (✅ PHASE 3 - COMPLETED)

**СТАТУС:** Все FR в этом разделе реализованы в v5.1.0-beta. Telegram Web Apps доступны через Menu Button с 8 интерактивными HTML формами.

| ID | Название | Phase | Приоритет | Acceptance Criteria Count |
|----|----------|-------|-----------|---------------------------|
| FR-070 | Main Menu (index.html) | Phase 3 | Critical | 5 |
| FR-071 | Add Transaction (add.html) | Phase 3 | Critical | 7 |
| FR-072 | Today's View (today.html) | Phase 3 | High | 5 |
| FR-073 | Transaction List (list.html) | Phase 3 | High | 6 |
| FR-074 | Edit/Delete Transaction (edit.html) | Phase 3 | High | 6 |
| FR-075 | Statistics (stats.html) | Phase 3 | High | 5 |
| FR-076 | Add Plan (addplan.html) | Phase 3 | High | 6 |
| FR-077 | Summary Plan vs Fact (summary.html) | Phase 3 | High | 6 |
| FR-078 | Advanced Search (search.html) | Phase 3 | Medium | 7 |

#### FR-070: Telegram Web Apps - Main Menu (index.html)

**Phase:** 3 (COMPLETED ✅)
**Приоритет:** Critical
**Категория:** telegram_web_apps
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.0-beta)

**Описание:**
Главное меню Web Apps с 3x3 grid layout, Quick Stats widget и навигацией ко всем 8 формам.

**User Story:**
Как пользователь, я хочу видеть главное меню с быстрым доступом ко всем функциям и текущим балансом за сегодня.

**Acceptance Criteria:**
1. 3x3 grid layout с 7 активными пунктами меню (9-й слот пустой)
2. Quick Stats widget показывает доходы/расходы/баланс за сегодня
3. Персонализированное приветствие (Telegram user.first_name)
4. Haptic feedback на все клики
5. API integration с `/api/v1/facts` для Quick Stats

**Dependencies:**
- Telegram Web Apps SDK
- Backend API `/api/v1/facts`

---

#### FR-071: Telegram Web Apps - Add Transaction (add.html)

**Phase:** 3 (COMPLETED ✅)
**Приоритет:** Critical
**Категория:** telegram_web_apps
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.0-beta)

**Описание:**
Форма быстрого добавления транзакции (расход/доход) с segmented control, quick amount buttons, и inline validation.

**User Story:**
Как пользователь, я хочу быстро добавить транзакцию через визуальную форму, быстрее чем через текстовые команды бота.

**Acceptance Criteria:**
1. Segmented control для выбора типа (Расход/Доход)
2. Quick amount buttons (100, 500, 1000, 5000)
3. Amount input с валидацией (positive, <= 9999999.99)
4. Category selection (иерархический список, scrollable)
5. Date picker (max: today)
6. Description textarea (200 символов, опционально)
7. MainButton "Сохранить" → POST `/api/v1/facts` → tg.close()

**Dependencies:**
- POST `/api/v1/facts`
- GET `/api/v1/articles?is_current=true`

---

#### FR-072: Telegram Web Apps - Today's View (today.html)

**Phase:** 3 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_web_apps
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.0-beta)

**Описание:**
Просмотр всех транзакций за сегодня с summary card и списком транзакций.

**User Story:**
Как пользователь, я хочу видеть все транзакции за сегодня в удобном списке с итогами.

**Acceptance Criteria:**
1. Summary card: доходы/расходы/баланс за сегодня
2. Transaction list (sorted by created_at DESC)
3. Color-coded amounts (green для доходов, red для расходов)
4. Click на транзакцию → edit.html?id=X
5. Empty state с кнопкой "Добавить транзакцию" → add.html

**Dependencies:**
- GET `/api/v1/facts?date_from=...&date_to=...&limit=1000`

---

#### FR-073: Telegram Web Apps - Transaction List (list.html)

**Phase:** 3 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_web_apps
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.0-beta)

**Описание:**
Полный список транзакций с collapsible filters и pagination.

**User Story:**
Как пользователь, я хочу просматривать все транзакции с фильтрами по дате, типу, категории.

**Acceptance Criteria:**
1. Collapsible filters panel (expand/collapse)
2. Date range filter
3. Type dropdown (все/расход/доход)
4. Category dropdown (динамическая загрузка)
5. Search input (description)
6. Pagination (20 items per page) с controls (Prev/Next, N/Total)

**Dependencies:**
- GET `/api/v1/facts` с query params
- GET `/api/v1/articles`

---

#### FR-074: Telegram Web Apps - Edit/Delete Transaction (edit.html)

**Phase:** 3 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_web_apps
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.0-beta)

**Описание:**
Unified форма для редактирования и удаления транзакций.

**User Story:**
Как пользователь, я хочу редактировать или удалить транзакцию в одном месте.

**Acceptance Criteria:**
1. Load transaction by ID (query param ?id=X)
2. Pre-fill all fields (type, amount, category, description, date)
3. Form validation (same as add.html)
4. MainButton "Сохранить изменения" → PUT `/api/v1/facts/{id}`
5. Delete button (red, bottom) с confirm dialog → DELETE `/api/v1/facts/{id}`
6. BackButton → history.back()

**Dependencies:**
- GET `/api/v1/facts` (search by ID)
- PUT `/api/v1/facts/{id}`
- DELETE `/api/v1/facts/{id}`

---

#### FR-075: Telegram Web Apps - Statistics (stats.html)

**Phase:** 3 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_web_apps
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.0-beta)

**Описание:**
Статистика по категориям с period selector и Top 5 breakdowns.

**User Story:**
Как пользователь, я хочу видеть breakdown расходов/доходов по категориям за выбранный период.

**Acceptance Criteria:**
1. Period selector (4 options: День/Неделя/Месяц/Год)
2. Summary card (income/expense/balance за период)
3. Top 5 expense categories с progress bars и percentages
4. Top 5 income categories (аналогично)
5. Empty state с кнопкой "Добавить транзакцию"

**Dependencies:**
- GET `/api/v1/facts?date_from=...&date_to=...&limit=10000`
- GET `/api/v1/articles`
- Client-side aggregation

---

#### FR-076: Telegram Web Apps - Add Plan (addplan.html)

**Phase:** 3 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_web_apps
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.0-beta)

**Описание:**
Форма создания бюджетного плана с period selector и auto date calculation.

**User Story:**
Как пользователь, я хочу создавать бюджетные планы на месяц/квартал/год через удобную форму.

**Acceptance Criteria:**
1. Quick amount buttons (5k, 10k, 20k, 50k)
2. Amount input с валидацией
3. Category selection
4. Period selector (Месяц/Квартал/Год/Свой)
5. Auto date calculation для preset periods
6. Custom period с date pickers (start < end validation)
7. Recurring checkbox (UI готов, backend support TODO Phase 4+)
8. MainButton "Сохранить план" → POST `/api/v1/facts` с record_type="plan"

**Dependencies:**
- POST `/api/v1/facts` (record_type="plan")
- GET `/api/v1/articles`

---

#### FR-077: Telegram Web Apps - Summary Plan vs Fact (summary.html)

**Phase:** 3 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_web_apps
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.0-beta)

**Описание:**
Сводка план vs факт по категориям с progress bars и color indicators.

**User Story:**
Как пользователь, я хочу видеть насколько я выполнил бюджетный план по каждой категории.

**Acceptance Criteria:**
1. Period selector (Месяц/Квартал/Год)
2. Total summary card (plan/fact/diff для расходов и доходов)
3. Category breakdown sections (Расходы / Доходы)
4. Per-category display: План | Факт | Разница | Progress bar
5. Color indicators (green = economy/exceeded, red = overspent/underperformed)
6. Empty state "Создайте план для сравнения"

**Dependencies:**
- GET `/api/v1/facts?date_from=...&date_to=...&limit=10000`
- GET `/api/v1/articles`
- Client-side aggregation и grouping

**Calculation Logic:**
- Expenses: plan - fact > 0 → экономия (green)
- Income: fact - plan > 0 → превышение плана (green)
- Progress bar: percent = (fact / plan) * 100

---

#### FR-078: Telegram Web Apps - Advanced Search (search.html)

**Phase:** 3 (COMPLETED ✅)
**Приоритет:** Medium
**Категория:** telegram_web_apps
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.0-beta)

**Описание:**
Расширенный поиск транзакций с множественными фильтрами и CSV export.

**User Story:**
Как пользователь, я хочу искать транзакции по множественным критериям и экспортировать результаты в Excel.

**Acceptance Criteria:**
1. 5 типов фильтров: Date range, Type checkboxes, Category dropdown, Amount range, Description search
2. Search button "🔍 Найти транзакции"
3. Results section с count header
4. Export button "📥 Экспорт в CSV"
5. CSV generation (client-side) с BOM для Excel compatibility
6. Hybrid filtering (backend: date/category, client: types/amount/description)
7. Click result → edit.html?id=X

**Dependencies:**
- GET `/api/v1/facts?date_from=...&date_to=...&article_id=...&limit=10000`
- GET `/api/v1/articles`

**Export Format:**
- CSV columns: Дата, Категория, Описание, Тип, Сумма
- BOM ('\ufeff') для корректного открытия в Excel
- Auto-download через blob URL

---

### 4.5 Architecture Notes (Telegram Web Apps)

**Location:** `/webapp/`

**Technology Stack:**
- Telegram Web Apps SDK
- Vanilla JavaScript ES6+ (модульная архитектура)
- 7 Core Modules: app.js, api.js, auth.js, ui.js, validators.js, theme.js, storage.js
- 3 CSS Modules: telegram-theme.css, app.css, forms.css
- Bundle Size: ~190KB total

**Authentication Flow:**
1. Telegram SDK provides `initData` → `/api/v1/webapp/validate`
2. Backend validates HMAC, returns JWT token
3. Frontend stores token, uses `Authorization: Bearer <token>` header

**Architecture Decisions:**
- No endpoint duplication: используем `/api/v1/facts` и `/api/v1/articles`
- Single new endpoint: `/api/v1/webapp/validate` (initData validation)
- Delete function integrated в edit.html (no separate delete.html)
- Client-side period calculations (month/quarter/year)
- Hybrid filtering (backend reduces data, client filters)
- Client-side CSV export (no backend endpoint)

---


