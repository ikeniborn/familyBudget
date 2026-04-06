## 4. Functional Requirements

### 📊 Project Phases Overview

| Phase | Status | FR Count | Description |
|-------|--------|----------|-------------|
| **Phase 1 (v1.0-v4.4.0)** | ✅ COMPLETED | 18 FR | Backend API + Web Analytics + Admin + Deployment |
| **Phase 2 (v5.0.0-beta)** | ✅ COMPLETED | 6 FR | Telegram Bot + Счета/Места затрат + Advanced Analytics UI |
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
**Счета/Места затрат Integration:** 10 new API endpoints, SCD Type 2 support
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
- Счет (выбор из справочника)
- Место затрат (выбор из справочника)
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
- Счет
- Место затрат
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

**Phase:** 1 ✅ **РЕАЛИЗОВАНО** + Enhancements (v5.2.0)
**Приоритет:** Critical
**Категория:** web_analytics

**Описание:**
Интерактивная столбчатая диаграмма, показывающая план и факт по периодам/статьям. Группировка: по периодам (месяцы) или по статьям верхнего уровня.

**Enhanced Features (v5.2.0):**
1. **План Distribution Logic:** План автоматически распределяется равномерно по периоду:
   - Для периода "месяц": План делится на количество дней месяца (среднее на день)
   - Для периодов "квартал"/"год": План делится на количество месяцев (среднее на месяц)
   - Несколько планов за период суммируются
2. **Cumulative Mode:** Переключение между режимами графика (normal/cumulative):
   - **Normal mode:** Значения за каждый период отдельно
   - **Cumulative mode (default):** Накопительный итог с начала периода
   - Выбор режима сохраняется в localStorage
3. **Enhanced Tooltip:** В cumulative mode tooltip показывает оба значения:
   - Значение за период
   - Накопительный итог

**Acceptance Criteria:**
1. Использование ECharts для визуализации
2. Два столбца на каждую категорию (План / Факт)
3. Фильтрация по датам, статьям, счетам, местам затрат
4. Отображение отклонения (абс. и %)
5. Адаптивность для мобильных устройств
6. ✅ **NEW:** План распределяется равномерно по всем дням/месяцам периода (нет пустых дней)
7. ✅ **NEW:** UI кнопки выбора режима графика (Накопительно / По периодам)
8. ✅ **NEW:** По умолчанию график открывается в накопительном режиме
9. ✅ **NEW:** Выбор пользователя сохраняется в localStorage
10. ✅ **NEW:** Tooltip в cumulative mode показывает значение за период И накопительный итог

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

#### FR-011.1: Веб - Динамика затрат - Накопительный режим

**Приоритет:** Medium
**Категория:** web_analytics
**Версия:** 5.1.0+

**Описание:**
Переключатель между обычным и накопительным режимом отображения динамики доходов и расходов. Аналогичен функционалу графика План&Факт (FR-010).

**Acceptance Criteria:**
1. Кнопка выбора режима "Накопительно/По периодам" под заголовком графика
2. localStorage сохранение выбранного режима между сессиями
3. В cumulative mode tooltip показывает оба значения: за период И накопительно
4. Backend API endpoint `/api/v1/analytics/trends` поддерживает параметр `chart_mode` (normal|cumulative)
5. Для каждой линии (Доходы, Расходы) накопительный расчет выполняется отдельно
6. UI синхронизация: кнопки визуально отображают активный режим

**Технические детали:**
- Frontend: аналогично реализации FR-010 (Plan-Fact cumulative mode)
- Backend: cumulative sum calculation для income/expense данных
- Default режим: cumulative (накопительно)

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
- Счета (плоский список)
- Места затрат (плоский список)
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
Администратор может просматривать и редактировать записи фактов всех пользователей в системе Family Budget. Реализована расширенная система фильтрации для удобного поиска и анализа транзакций.

**Acceptance Criteria:**
1. ✅ **Фильтрация транзакций** по:
   - Пользователю (user_id)
   - Категории/Статье (article_id) с иерархическим отображением
   - Периоду (date_from, date_to)
   - Типу записи (record_type: факт/план/все)
   - Финансовому центру (financial_center_id)
   - Центру затрат (cost_center_id)
   - Описанию/комментарию (search) - case-insensitive substring search
2. ✅ **Inline-редактирование** через HTMX
3. ✅ **Пагинация** (50 записей на страницу)
4. ✅ **Поиск по комментариям** (реализовано в версии 5.0.0-beta-20251112)
5. ✅ **Batch операции**: массовое удаление выбранных

**Реализовано в версии 5.0.0-beta (2025-11-02):**
- Backend: добавлены query параметры `financial_center_id`, `cost_center_id` в `/api/v1/admin/facts` и `/api/v1/admin/facts/count`
- Frontend: улучшен UI фильтров с визуальными индикаторами иерархии категорий
- Frontend: добавлен фильтр по типу записи (план/факт/все)
- CSS: исправлено обрезание текста в выпадающих списках (min-width: 150px)

**Реализовано в версии 5.0.0-beta-20251112:**
- Backend: добавлен параметр `search` в `GET /api/v1/admin/facts` endpoint (backend/app/api/v1/admin.py:975)
- Backend: добавлена фильтрация `WHERE description ILIKE %search%` с использованием pg_trgm GIN индексов
- Database: созданы GIN trigram индексы на ALL 96 партициях таблицы `t_f_budget_fact` для быстрого поиска (миграция 713fcefee450)
- Frontend: добавлено поле "Поиск по описанию" на страницах `/facts` и `/plan` (facts.html, plan.html)
- Frontend: поиск работает в режиме реального времени при вводе текста
- Performance: ILIKE queries оптимизированы через GIN indexes (~10x speedup на больших данных)

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
Все справочники (статьи, счета, места затрат, периоды) должны хранить историю изменений через SCD Type 2 подход.

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
**Last Updated:** 2025-11-05 (Responsive UI improvements)

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
6. **NEW:** Responsive UI с adaptive breakpoints (480px, 640px, 768px)
7. **NEW:** Truncate indicator "→" для длинных description (> 25 chars)
8. **NEW:** Modal popup для чтения полного текста description (click-to-expand)
9. **NEW:** Breadcrumb tooltips для вложенных категорий (через API ancestors)

**Dependencies:**
- GET `/api/v1/facts?date_from=...&date_to=...&limit=1000`
- GET `/api/v1/articles/{id}/ancestors?include_self=true` (для breadcrumb)

---

#### FR-073: Telegram Web Apps - Transaction List (list.html)

**Phase:** 3 (COMPLETED ✅)
**Приоритет:** High
**Категория:** telegram_web_apps
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.0-beta)
**Last Updated:** 2025-11-05 (Responsive UI improvements)

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
7. **NEW:** Responsive UI с adaptive breakpoints (480px, 640px, 768px)
8. **NEW:** Truncate indicator "→" для длинных description (> 25 chars)
9. **NEW:** Modal popup для чтения полного текста description (click-to-expand)
10. **NEW:** Breadcrumb tooltips для вложенных категорий (через API ancestors)

**Dependencies:**
- GET `/api/v1/facts` с query params
- GET `/api/v1/articles`
- GET `/api/v1/articles/{id}/ancestors?include_self=true` (для breadcrumb)

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
7. Recurring checkbox (UI готов, backend support - Planned Feature v7.0+)
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

### 4.10 Analytics Enhancements (v5.1.1 - COMPLETED ✅)

**Date:** 2025-11-06
**Branch:** `feature/analytics-filters-enhancement`
**Status:** ✅ COMPLETED

#### Summary

Расширение функциональности страницы `/analytics` с добавлением локальных фильтров для всех графиков, поддержкой реальных плановых данных из БД и улучшением визуализации Pie Chart.

#### Изменения в Backend API

##### 1. **GET `/api/v1/analytics/plan-fact`** - План&Факт

**Новый параметр:**
- `article_type`: `"income"` | `"expense"` (default: `"expense"`) - тип категории

**Изменения в логике:**
- Убран hardcoded псевдо-план (`plan = fact * 1.1`)
- Реализованы 2 отдельных запроса:
  - `WHERE record_type='fact' AND Article.type=article_type`
  - `WHERE record_type='plan' AND Article.type=article_type`
- Добавлена фильтрация по типу категории (JOIN с `t_d_article`)

**Response (обновлен):**
```json
{
  "labels": ["Пн", "Вт", ...],
  "plan": [реальные плановые данные из t_f_budget_fact],
  "fact": [фактические данные из t_f_budget_fact],
  "period": "week",
  "article_type": "expense"
}
```

##### 2. **GET `/api/v1/analytics/trends`** - Динамика расходов/доходов

**Новый параметр:**
- `record_type`: `"fact"` | `"plan"` (default: `"fact"`) - тип записей

**Изменения в логике:**
- Добавлен фильтр `WHERE Fact.record_type = record_type`
- Структура response сохранена (income, expense arrays)

**Response (обновлен):**
```json
{
  "dates": ["2025-11-01", ...],
  "income": [...],
  "expense": [...],
  "period_days": 30,
  "record_type": "fact"
}
```

##### 3. **GET `/api/v1/analytics/heatmap`** - Тепловая карта

**Новые параметры:**
- `article_type`: `"income"` | `"expense"` (default: `"expense"`) - тип категории
- `record_type`: `"fact"` | `"plan"` (default: `"fact"`) - тип записей

**Изменения в логике:**
- Изменен hardcoded `Article.type == "expense"` на параметр
- Добавлен фильтр `WHERE Fact.record_type = record_type`

**Response (обновлен):**
```json
{
  "weeks": [[Mon, Tue, ..., Sun], ...],
  "day_labels": ["Пн", "Вт", ...],
  "week_count": 13,
  "period_days": 90,
  "period": "quarter",
  "article_type": "expense",
  "record_type": "fact",
  "start_date": "2025-08-01",
  "end_date": "2025-10-31"
}
```

#### Изменения в Frontend (Web UI)

##### Локальные фильтры для графиков

**1. График "План&Факт":**
- Добавлен локальный фильтр типа категории: [Расходы] | [Доходы]
- По умолчанию: "Расходы"
- График всегда показывает 2 бара (план + факт) для выбранного типа
- Функция: `updatePlanFactType(type)`

**2. График "Динамика расходов":**
- Добавлен локальный фильтр типа записей: [Факт] | [План]
- По умолчанию: "Факт"
- График показывает только выбранный тип (plan ИЛИ fact)
- Функция: `updateTrendsRecordType(recordType)`

**3. График "Разбивка по категориям" (Pie Chart):**
- Существующий локальный фильтр сохранен: [Расходы] | [Доходы]
- **Новая логика TOP 5 + "Прочее":**
  - Если категорий > 5: показывает топ 5 + "Прочее" (агрегация остальных)
  - Если категорий ≤ 5: показывает все без "Прочее"
  - Специальный тултип для "Прочее":
    - Показывает список всех категорий из "Прочее"
    - Формат: название, сумма, процент
    - Сортировка от большего к меньшему
    - Max-height 200px с прокруткой
  - Обычный тултип: показывает топ 10 категорий

**4. График "Каскадная диаграмма" (Waterfall):**
- Без изменений в фильтрах
- **Русификация оси X:**
  - "Start" → "Начало"
  - "Total" → "Итого"

**5. График "Тепловая карта" (Heatmap):**
- Добавлены 2 локальных фильтра:
  - Тип категории: [Расходы] | [Доходы] (default: "Расходы")
  - Тип данных: [Факт] | [План] (default: "Факт")
- Функции: `updateHeatmapType(type)`, `updateHeatmapRecordType(recordType)`

##### Глобальные переменные (JavaScript)

Добавлены новые переменные для локальных фильтров:
```javascript
let currentPlanFactType = 'expense';
let currentTrendsRecordType = 'fact';
let currentHeatmapType = 'expense';
let currentHeatmapRecordType = 'fact';
```

##### UI/UX Improvements

- Все фильтры используют DaisyUI `btn-group` для консистентности
- ARIA states для accessibility (`aria-pressed`, `aria-labelledby`)
- Responsive layout (flex-wrap для мобильных устройств)
- Активная кнопка: `btn-primary`, неактивные: `btn-outline`

#### Architectural Notes

**Модель данных:**
- Факты и планы хранятся в одной таблице `t_f_budget_fact`
- Различаются полем `record_type`: `"fact"` | `"plan"`
- Текущие endpoint'ы НЕ фильтровали по `record_type` → смешивали данные

**Решение:**
- Backend: добавлены явные фильтры `WHERE Fact.record_type = ...`
- Frontend: локальные фильтры позволяют пользователю выбирать тип данных независимо для каждого графика

**Преимущества локальных фильтров:**
- Большая гибкость для пользователя
- Независимое управление каждым графиком
- Соответствует требованиям пользователя (из user story)

#### Testing Notes

- Визуальная проверка синтаксиса Python кода (ruff недоступен в sandbox)
- Frontend изменения проверены на корректность JavaScript синтаксиса
- Все новые endpoint параметры имеют default values для обратной совместимости

#### Files Changed

**Backend:**
- `backend/app/api/v1/analytics.py` (3 endpoints: plan-fact, trends, heatmap)

**Frontend:**
- `frontend/web/templates/analytics.html` (HTML + JavaScript + локальные фильтры)

**Documentation:**
- `docs/prd/04-functional-requirements.md` (этот файл)

---

### 4.11 Analytics UI/UX Refactoring (v5.1.2 - COMPLETED ✅)

**Date:** 2025-11-08
**Branch:** `feature/analytics-refactoring`
**Status:** ✅ COMPLETED

#### Summary

Комплексный рефакторинг страницы `/analytics` с упрощением фильтров, улучшением UX и добавлением поддержки произвольных диапазонов дат. Основная цель - сделать интерфейс более интуитивным и гибким для пользователей.

#### Ключевые изменения

##### 1. Rolling Periods (Сдвигаемые периоды)

**Изменение логики периодов:**
- **Старая логика:** Календарные периоды (неделя = текущая неделя с Пн по Вс)
- **Новая логика:** Сдвигаемые периоды от текущей даты
  - `week` = последние 7 дней (сегодня - 6 дней)
  - `month` = последние 28 дней (4 недели)
  - `year` = последние 365 дней (12 месяцев)

**Backend изменения:**
- Обновлены все 5 analytics endpoints:
  - `/api/v1/analytics/plan-fact`
  - `/api/v1/analytics/trends`
  - `/api/v1/analytics/category-breakdown`
  - `/api/v1/analytics/waterfall`
  - `/api/v1/analytics/heatmap`

##### 2. Custom Date Range (Произвольный диапазон)

**Новый функционал:**
- Кнопка "Произвольный" в фильтре периодов
- Интеграция с существующим `CalendarWidget` (range picker mode)
- Конвертация между форматами DD.MM.YYYY ↔ YYYY-MM-DD через `DateFormatter`
- Текстовое отображение выбранного периода

**Backend API:**
- Добавлены опциональные параметры `date_from` и `date_to` (YYYY-MM-DD) во все endpoints
- Приоритет: custom range > period parameter
- Автоматическое определение группировки данных на основе длины диапазона

**Frontend UI:**
```html
<div id="custom-range-container" style="display: none;">
    <input type="text" id="date-from" readonly>
    <span>—</span>
    <input type="text" id="date-to" readonly>
    <button onclick="applyCustomRange()">Применить</button>
    <button onclick="cancelCustomRange()">Отмена</button>
</div>
<div id="period-display" class="text-sm">Период: последние 7 дней (02.11.2025 — 08.11.2025)</div>
```

##### 3. Упрощение фильтров Факт/План

**Изменения:**
- **Удалены** фильтры Факт/План из всех графиков кроме "План&Факт"
- Все остальные графики теперь показывают **только фактические данные**
- Hardcoded `record_type=fact` в API запросах для:
  - Динамика расходов (Trends)
  - Разбивка по категориям (Pie Chart)
  - Каскадная диаграмма (Waterfall)
  - Тепловая карта (Heatmap)

**Удалённые переменные и функции:**
```javascript
// Удалено:
let currentPieRecordType = 'fact';
let currentTrendsRecordType = 'fact';
let currentHeatmapRecordType = 'fact';
function updatePieRecordType(recordType) { ... }
function updateTrendsRecordType(recordType) { ... }
function updateHeatmapRecordType(recordType) { ... }
```

**Обоснование:**
- Упрощение UI - меньше кнопок и опций
- План&Факт имеет свой отдельный график для сравнения
- Для остальных графиков факт - наиболее важные данные

##### 4. Изменения Grid Layout

**Новая структура:**
- План&Факт: `col-span-full` (full width at top)
- Остальные 4 графика: `grid-cols-1 lg:grid-cols-2` (2x2 grid на lg+ экранах)

**Mobile responsive:**
- Mobile/Tablet: все графики в 1 колонку
- Desktop (lg+): План-Факт full width, остальные 2x2

##### 5. Heatmap Improvements

**Изменения:**
- Заголовок: "Тепловая карта расходов/доходов" → "Тепловая карта"
- Динамическая цветовая схема:
  - **Расходы (expense):** красные оттенки (#ffebee → #f44336)
  - **Доходы (income):** зеленые оттенки (#eef5ee → #2e7d32)

**Implementation:**
```javascript
visualMap: {
    inRange: {
        color: currentHeatmapType === 'expense'
            ? ['#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336']
            : ['#eef5ee', '#c8e6c9', '#81c784', '#4caf50', '#388e3c', '#2e7d32']
    }
}
```

#### API Changes

**Все endpoints теперь поддерживают:**

1. **Опциональные параметры period OR custom range:**
   - `period`: `"week"` | `"month"` | `"year"` (optional)
   - `date_from`: `YYYY-MM-DD` (optional)
   - `date_to`: `YYYY-MM-DD` (optional)

2. **Приоритет параметров:**
   - Если `date_from` и `date_to` указаны → используется custom range
   - Иначе если `period` указан → используется rolling period
   - Иначе → ошибка 400

3. **Обратная совместимость:**
   - Старые запросы с только `period` продолжают работать
   - Новые запросы могут использовать custom range

#### Frontend Architecture

**Новые функции загрузки данных:**
```javascript
// Custom range loaders (5 functions):
async function loadPlanFactDataCustom(dateFrom, dateTo) { ... }
async function loadTrendsDataCustom(dateFrom, dateTo) { ... }
async function loadPieDataCustom(type, dateFrom, dateTo) { ... }
async function loadWaterfallDataCustom(dateFrom, dateTo) { ... }
async function loadHeatmapDataCustom(dateFrom, dateTo) { ... }

// Period display:
function updatePeriodDisplay(period) {
    // Shows: "Период: последние 7 дней (02.11.2025 — 08.11.2025)"
}
```

**State management:**
```javascript
let customRangeActive = false;
let customDateFrom = null;  // DD.MM.YYYY
let customDateTo = null;
let rangePicker = null;  // CalendarWidget instance
```

#### Files Changed

**Backend:**
- `backend/app/api/v1/analytics.py` (+240/-108 lines)
  - 5 endpoints обновлены с поддержкой rolling periods и custom ranges

**Frontend:**
- `frontend/web/templates/analytics.html` (extensive changes)
  - HTML: кнопка "Произвольный", custom range picker UI, period display
  - JavaScript: custom range logic, удалены факт/план фильтры, heatmap colors
  - Grid layout: Plan-Fact full width, остальные 2x2

**Documentation:**
- `docs/prd/04-functional-requirements.md` (этот файл)
- `docs/prd/08-ui-design.md` (обновлено)

#### Testing Notes

- ✅ Python syntax проверен через `python3 -m py_compile`
- ✅ JavaScript syntax проверен вручную (нет ссылок на удаленные переменные/функции)
- ✅ Все изменения обратно совместимы (default values для новых параметров)
- ⚠️ Manual testing recommended: custom range picker, period display, heatmap colors

---

### ⚡ Analytics Improvements v5.0.1-beta (2025-11-08)

**Дата:** 2025-11-08
**Статус:** ✅ COMPLETED
**Commits:** `a7d07da7`, `d2e7c404`

#### 1. Глобальный фильтр типа (Расходы/Доходы)

**Проблема:**
- Каждый график (Plan-Fact, Pie Chart, Heatmap) имел свой локальный фильтр
- Пользователь должен был переключать фильтр 3 раза для каждого изменения
- Несогласованное состояние фильтров между графиками

**Решение:**
- Создан единый глобальный фильтр под фильтром периодов
- Применяется одновременно к: Plan-Fact, Category Breakdown (Pie), Heatmap
- Удалены локальные фильтры из каждого графика

**Implementation:**

**HTML (frontend/web/templates/analytics.html):**
```html
<!-- Global Type Filter (applies to Plan-Fact, Pie Chart, Heatmap) -->
<div class="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-base-300">
    <label id="global-type-label" class="font-semibold text-sm">Тип (для графиков):</label>
    <div class="btn-group">
        <button class="btn btn-sm btn-primary" id="global-type-expense" onclick="updateGlobalType('expense')">Расходы</button>
        <button class="btn btn-sm btn-outline" id="global-type-income" onclick="updateGlobalType('income')">Доходы</button>
    </div>
</div>
```

**JavaScript:**
```javascript
// Consolidated global type variable (replaces currentPlanFactType, currentHeatmapType)
let currentGlobalType = 'expense';

// New unified function (replaces 3 local update functions)
function updateGlobalType(type) {
    currentGlobalType = type;
    currentPieType = type;  // Keep for Pie chart compatibility

    // Update active button and ARIA states
    document.querySelectorAll('#global-type-expense, #global-type-income').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
        btn.setAttribute('aria-pressed', 'false');
    });
    const activeBtn = document.getElementById(`global-type-${type}`);
    activeBtn.classList.remove('btn-outline');
    activeBtn.classList.add('btn-primary');
    activeBtn.setAttribute('aria-pressed', 'true');

    // Reload charts that depend on global type filter
    if (customRangeActive) {
        const isoFrom = DateFormatter.toISO(customDateFrom);
        const isoTo = DateFormatter.toISO(customDateTo);
        loadPlanFactDataCustom(isoFrom, isoTo);
        loadPieDataCustom(type, isoFrom, isoTo);
        loadHeatmapDataCustom(isoFrom, isoTo);
    } else {
        loadPlanFactData(periodMapping[currentPeriod].planFact);
        loadPieData(type, currentPeriod);
        loadHeatmapData(periodMapping[currentPeriod].heatmap);
    }
}
```

**Удалены:**
- 3 локальные функции: `updatePlanFactType()`, `updatePieType()`, `updateHeatmapType()`
- 2 переменные: `currentPlanFactType`, `currentHeatmapType`
- 3 блока HTML с локальными кнопками фильтра

#### 2. Новая Grid Layout (Responsive 2-Column)

**Проблема:**
- Все графики были в одну колонку на больших экранах
- Неэффективное использование горизонтального пространства
- Plan-Fact занимал слишком много места

**Решение:**
- **Plan vs Fact + Trends (Динамика расходов):** side by side в одной строке (2 колонки на lg+ экранах)
- **Pie Chart + Waterfall (Каскадная диаграмма):** side by side в одной строке (2 колонки на lg+ экранах)
- **Heatmap (Тепловая карта):** в конце, full width (`col-span-full`)

**Before:**
```html
<!-- All charts: col-span-full (full width) -->
<div class="card bg-base-100 shadow-lg col-span-full">...</div>
```

**After:**
```html
<!-- Plan-Fact Chart (Left column) -->
<div class="card bg-base-100 shadow-lg">...</div>

<!-- Trends Chart (Right column) -->
<div class="card bg-base-100 shadow-lg">...</div>

<!-- Pie Chart (Left column) -->
<div class="card bg-base-100 shadow-lg">...</div>

<!-- Waterfall Chart (Right column) -->
<div class="card bg-base-100 shadow-lg">...</div>

<!-- Heatmap Chart (Full Width) -->
<div class="card bg-base-100 shadow-lg col-span-full">...</div>
```

**CSS Grid:**
```html
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
    <!-- Plan-Fact and Trends in row 1 -->
    <!-- Pie and Waterfall in row 2 -->
    <!-- Heatmap full width at bottom -->
</div>
```

**Mobile Responsive:**
- Mobile/Tablet: все графики в 1 колонку (grid-cols-1)
- Desktop (lg+): 2 колонки для первых 4 графиков, Heatmap full width

#### 3. Динамическая агрегация Heatmap по периоду

**Проблема:**
- Heatmap всегда агрегировал данные по неделям (days × weeks)
- Для week period (7 дней) было избыточно показывать weeks
- Для year period (365 дней) weeks было недостаточно детально

**Решение:**
- **Week period (7 дней):** агрегация по дням (horizontal, single row)
- **Month period (28 дней):** агрегация по неделям (days × weeks) - без изменений
- **Quarter period:** агрегация по неделям (days × weeks)
- **Year period (365 дней):** агрегация по месяцам (days/weeks × months)
- **Custom period:** auto-определение агрегации по количеству дней:
  - ≤7 дней → daily aggregation (horizontal)
  - 7-30 дней → weekly aggregation (days × weeks)
  - >30 дней → monthly aggregation (weeks/days × months)

**Backend Changes (backend/app/api/v1/analytics.py):**

**Добавлен параметр aggregation:**
```python
# Determine aggregation type based on period or custom range
if period == "week":
    aggregation = "day"
elif period == "month":
    aggregation = "week"
elif period == "quarter":
    aggregation = "week"
else:  # year
    aggregation = "month"

# For custom ranges, auto-determine
if date_from and date_to:
    days_diff = (end_date - start_date).days + 1
    if days_diff <= 7:
        aggregation = "day"
    elif days_diff <= 30:
        aggregation = "week"
    else:
        aggregation = "month"
```

**Новая структура ответа:**
```python
return {
    "data": data,        # 2D array: [row][col] where row=yAxis, col=xAxis
    "xAxis": xAxis,      # Labels for X-axis (horizontal)
    "yAxis": yAxis,      # Labels for Y-axis (vertical)
    "aggregation": aggregation,  # "day", "week", or "month"
    "period": period,
    "article_type": article_type,
    "record_type": record_type,
    "start_date": start_date.isoformat(),
    "end_date": end_date.isoformat()
}
```

**Старая структура (deprecated):**
```python
# REMOVED:
{
    "weeks": weeks_data,     # 2D array
    "day_labels": [...],     # Fixed labels
    "week_count": len(weeks_data)
}
```

**Aggregation Examples:**

1. **Daily aggregation (week period):**
   - X-axis: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
   - Y-axis: [""]  # Single row
   - Data: [[mon_value], [tue_value], ..., [sun_value]]

2. **Weekly aggregation (month period):**
   - X-axis: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
   - Y-axis: ["Н1", "Н2", "Н3", "Н4"]
   - Data: [[week1_mon, week1_tue, ...], [week2_mon, ...], ...]

3. **Monthly aggregation (year period):**
   - X-axis: ["1", "2", "3", ..., "31"]  # Days of month
   - Y-axis: ["Янв", "Фев", "Мар", ..., "Дек"]
   - Data: [[jan_day1, jan_day2, ...], [feb_day1, ...], ...]

**Frontend Changes (frontend/web/templates/analytics.html):**

**Обновлена updateHeatmapChart() функция:**
```javascript
function updateHeatmapChart(data) {
    // Transform data to ECharts format: [xIndex, yIndex, value]
    const heatmapData = [];
    data.data.forEach((row, yIndex) => {
        row.forEach((value, xIndex) => {
            heatmapData.push([xIndex, yIndex, value]);
        });
    });

    // Dynamic chart height based on aggregation type
    const rowHeight = data.aggregation === 'day' ? 80 : 30;
    const dynamicHeight = Math.max(300, data.yAxis.length * rowHeight + 150);

    // Dynamic title with aggregation info
    const aggregationMap = {
        day: 'по дням',
        week: 'по неделям',
        month: 'по месяцам'
    };
    const aggregationLabel = aggregationMap[data.aggregation] || '';

    const option = {
        title: {
            text: `Тепловая карта (${periodLabel}, ${aggregationLabel})`,
            ...
        },
        xAxis: {
            data: data.xAxis,  // Dynamic labels
            ...
        },
        yAxis: {
            data: data.yAxis,  // Dynamic labels
            ...
        },
        tooltip: {
            formatter: function(params) {
                const xLabel = data.xAxis[params.value[0]];
                const yLabel = data.yAxis[params.value[1]];
                const amount = params.value[2].toFixed(2);

                // Dynamic tooltip based on aggregation
                if (data.aggregation === 'day') {
                    return `<strong>${xLabel}</strong><br/>${typeLabelSingular}: ${amount} ₽`;
                } else if (data.aggregation === 'week') {
                    return `<strong>${xLabel}, ${yLabel}</strong><br/>${typeLabelSingular}: ${amount} ₽`;
                } else {
                    return `<strong>${yLabel}, ${xLabel}</strong><br/>${typeLabelSingular}: ${amount} ₽`;
                }
            }
        },
        ...
    };
}
```

**Удалены:**
- Hardcoded `data.day_labels` references
- Fixed week labels generation
- Static chart height calculation

#### Files Changed

**Backend:**
- `backend/app/api/v1/analytics.py` (+133/-71 lines)
  - Heatmap endpoint: добавлена динамическая агрегация по периоду
  - Новая структура ответа (data/xAxis/yAxis/aggregation)

**Frontend:**
- `frontend/web/templates/analytics.html` (+44/-82 lines)
  - HTML: добавлен глобальный фильтр типа, удалены локальные фильтры
  - Grid layout: changed to 2-column responsive layout
  - JavaScript: updateGlobalType() функция, обновлена updateHeatmapChart()

**Documentation:**
- `docs/prd/04-functional-requirements.md` (этот файл)

#### Testing

- ✅ Python syntax: `python3 -m py_compile backend/app/api/v1/analytics.py`
- ✅ JavaScript syntax: node --check (extracted script block)
- ✅ Git commits: `a7d07da7`, `d2e7c404`
- ⚠️ Manual testing recommended:
  - Глобальный фильтр типа применяется ко всем 3 графикам
  - Heatmap агрегация меняется при переключении периодов
  - Grid layout responsive на mobile/tablet/desktop
  - Custom range mode работает с новой агрегацией

---

### 4.12 Analytics Rolling Periods (v5.1.3 - IN PROGRESS)

**Версия:** v5.1.3-beta
**Дата начала:** 2025-11-09
**Статус:** 🔄 IN PROGRESS
**Branch:** `feature/analytics-rolling-periods`

#### Описание

Реализация rolling periods (скользящих периодов) для страницы аналитики с поддержкой квартала, ISO номеров недель и пропорциональных бюджетов. Основная цель - показывать актуальные данные относительно текущей даты, а не фиксированные календарные периоды.

#### Изменения в периодах

**До (v5.1.2):**
- Неделя: 7 дней назад (произвольный период)
- Месяц: 28 дней назад
- Год: 365 дней назад
- Недели нумеровались просто "Неделя 1", "Неделя 2"

**После (v5.1.3):**
- **Неделя**: 4 календарные недели (Пн-Вс), текущая неделя неполная (до сегодня)
- **Месяц**: 4 календарные недели (аналогично неделе)
- **Квартал**: 3 rolling месяца (текущий + 2 предыдущих, текущий неполный)
- **Год**: 12 rolling месяцев (текущий + 11 предыдущих, текущий неполный)
- **Custom**: сохранена логика auto-detection (day/week/month агрегация)
- **ISO Week Numbers**: формат "Н45 25" (неделя 45, 2025 год)

#### Ключевые улучшения

1. **Rolling Periods**: Все периоды теперь "скользящие" относительно текущей даты
2. **Incomplete Current Period**: Текущая неделя/месяц показываются до сегодняшнего дня (не до конца периода)
3. **Proportional Budget**: Бюджет делится пропорционально дням в периоде
4. **ISO Week Numbers**: Стандартные номера недель по ISO 8601
5. **Quarter Period**: Новый период "Квартал" (3 месяца)
6. **Calendar Alignment**: Недели всегда начинаются с понедельника

#### Backend Changes

**Новый модуль: `backend/app/utils/date_helpers.py`** (+234 lines)

Утилитные функции для работы с датами и периодами:

```python
def get_iso_week_number(target_date: date) -> str
    """Возвращает ISO номер недели в формате 'Н45 25'"""

def get_week_bounds(target_date: date) -> Tuple[date, date]
    """Возвращает границы календарной недели (Пн-Вс)"""

def get_rolling_weeks(num_weeks: int, end_date: date, include_incomplete: bool = True) -> List[Tuple[date, date, str]]
    """Возвращает последние N календарных недель с ISO labels"""

def get_rolling_months(num_months: int, end_date: date, include_incomplete: bool = True) -> List[Tuple[date, date, str]]
    """Возвращает последние N календарных месяцев с русскими названиями"""

def get_proportional_budget(monthly_budget: Decimal, days_in_period: int, days_in_month: int = 30) -> Decimal
    """Рассчитывает пропорциональный бюджет для периода"""

def get_month_name_short_ru(month: int) -> str
    """Возвращает короткое название месяца (3 буквы) на русском"""

def get_quarter_bounds(target_date: date) -> Tuple[date, date, str]
    """Возвращает границы rolling квартала (3 месяца)"""
```

**Изменения в `backend/app/api/v1/analytics.py`** (~500 lines changed)

Все 5 endpoints обновлены с новой логикой периодов:

##### 1. **GET `/api/v1/analytics/plan-fact`** - План&Факт
- ✅ Week period: 4 календарные недели с ISO labels ("Н42 25", "Н43 25", ...)
- ✅ Month period: 4 календарные недели (аналогично week)
- ✅ Quarter period: 3 rolling месяца с агрегацией по месяцам ("Сен 2025", "Окт 2025", "Ноя 2025")
- ✅ Year period: 12 rolling месяцев ("Дек 2024", "Янв 2025", ..., "Ноя 2025")
- ✅ Proportional budget для неполных периодов

##### 2. **GET `/api/v1/analytics/trends`** - Динамика расходов/доходов
- ✅ Аналогичные изменения периодов и агрегации
- ✅ ISO week labels для week/month
- ✅ Month names для quarter/year

##### 3. **GET `/api/v1/analytics/category-breakdown`** - Разбивка по категориям
- ✅ Обновлены границы периодов (используют rolling logic)
- ✅ Агрегация остается прежней (сумма за весь период)

##### 4. **GET `/api/v1/analytics/waterfall`** - Waterfall диаграмма
- ✅ Week period drill-down: показывает 4 календарные недели с ISO labels
- ✅ Month period drill-down: показывает 4 календарные недели
- ✅ Quarter period drill-down: показывает 3 месяца
- ✅ Year period drill-down: показывает 12 месяцев
- ✅ Python-level aggregation вместо SQL GROUP BY (для гибкости с ISO weeks)

##### 5. **GET `/api/v1/analytics/heatmap`** - Тепловая карта
- ✅ Week period: 1 неделя × 7 дней (single_week aggregation)
  - yAxis: ISO week label ("Н45 25")
  - xAxis: дни недели ("Пн", "Вт", ..., "Вс")
- ✅ Month period: 4 недели × 7 дней
  - yAxis: ISO week labels ("Н42 25", "Н43 25", ...)
  - xAxis: дни недели
- ✅ Quarter period: 3 месяца × недели
  - yAxis: месяцы ("Сен 2025", "Окт 2025", "Ноя 2025")
  - xAxis: недели месяца
- ✅ Year period: 12 месяцев × недели
  - yAxis: месяцы ("Дек 2024", "Янв 2025", ...)
  - xAxis: недели месяца

#### Frontend Changes

**`frontend/web/templates/analytics.html`** (~150 lines changed)

**HTML:**
- ✅ Добавлена кнопка "Квартал" в period filter
```html
<button class="btn btn-sm btn-outline" id="filter-quarter" data-period="quarter">
    Квартал
</button>
```

**JavaScript:**
- ✅ Удален `periodMapping` object (backend теперь обрабатывает все периоды напрямую)
- ✅ Обновлена функция `updatePeriodDisplay()` с обработкой квартала
```javascript
case 'quarter':
    const quarterStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    text = `Выбран квартал: ${formatDate(quarterStart)} — ${formatDate(today)}`;
    break;
```
- ✅ Все вызовы API теперь передают период напрямую (без маппинга)
- ✅ Уменьшен размер pie chart на 10%: `radius: ['35%', '63%']` (было `['40%', '70%']`)
- ✅ Исправлен null в heatmap title (добавлена валидация и fallback значения)
```javascript
const periodLabel = periodMap[data.period] || data.period || 'Период';
const aggregationLabel = aggregationMap[data.aggregation] || 'агрегация';
const subtitleText = (data.start_date && data.end_date)
    ? `${data.start_date} — ${data.end_date}`
    : '';
```

#### Testing

**Unit Tests:** `tests/unit/backend/utils/test_date_helpers.py` (+280 lines)
- ✅ 31 тестов для всех 7 функций date_helpers.py
- ✅ Test coverage: ISO weeks, rolling periods, proportional budgets, edge cases
- ✅ Markers: `@pytest.mark.unit` для быстрого запуска
- ⚠️ Тесты созданы, требуется окружение с pytest для запуска

**Validation:**
- ✅ Python syntax: `python3 -m py_compile backend/app/utils/date_helpers.py`
- ✅ Python syntax: `python3 -m py_compile backend/app/api/v1/analytics.py`
- ✅ Test file syntax: `python3 -m py_compile tests/unit/backend/utils/test_date_helpers.py`

**Manual Testing Checklist:**
- ⚠️ Проверить кнопку "Квартал" показывает 3 месяца
- ⚠️ Проверить ISO week numbers отображаются корректно ("Н45 25")
- ⚠️ Проверить waterfall drill-down работает для всех периодов
- ⚠️ Проверить heatmap показывает правильную агрегацию
- ⚠️ Проверить plan-fact пропорционально делит бюджет
- ⚠️ Проверить pie chart уменьшен на 10%
- ⚠️ Проверить heatmap title без null

#### Files Changed

**Backend:**
- `backend/app/utils/date_helpers.py` (+234 lines, NEW)
- `backend/app/api/v1/analytics.py` (~500 lines changed)

**Frontend:**
- `frontend/web/templates/analytics.html` (~150 lines changed)

**Tests:**
- `tests/unit/backend/utils/__init__.py` (+0 lines, NEW)
- `tests/unit/backend/utils/test_date_helpers.py` (+280 lines, NEW)

**Documentation:**
- `docs/prd/04-functional-requirements.md` (этот файл)

#### Dependencies

- Python stdlib: `datetime`, `calendar`, `typing`
- Decimal для точных вычислений бюджета
- ISO 8601 week numbering (`date.isocalendar()`)

#### Technical Decisions

**Почему rolling periods?**
- Более актуальные данные (всегда относительно сегодня)
- Лучше для аналитики трендов (всегда последние N периодов)
- Predictable behavior (всегда знаешь, что увидишь)

**Почему ISO week numbers?**
- Международный стандарт (ISO 8601)
- Недели всегда Пн-Вс (удобно для пользователей)
- Уникальная нумерация (неделя + год)

**Почему incomplete current period?**
- Честное отображение данных (не вводит в заблуждение)
- Правильное сравнение с предыдущими периодами
- Proportional budget показывает реальный темп трат

**Почему убрали periodMapping?**
- Backend теперь сам определяет правильную агрегацию
- Меньше путаницы (один period = одна агрегация)
- Проще поддерживать и тестировать

#### Migration Notes

**Breaking Changes:**
- ⚠️ API response format НЕ изменился (обратная совместимость)
- ⚠️ Labels в response изменились (ISO weeks вместо "Неделя N")
- ⚠️ Количество точек на графиках изменилось (4 недели вместо 7/13)

**Data Migration:**
- ✅ Не требуется (изменения только в логике вычислений)
- ✅ Все существующие данные остаются валидными

#### Known Issues

- ⚠️ Heatmap для года может быть высоким (12 месяцев × недели)
- ⚠️ Custom period logic не изменена (может конфликтовать с rolling logic)

#### Future Enhancements

- 📅 Добавить "Half Year" период (6 месяцев)
- 📅 Customizable week start day (Пн vs Вс)
- 📅 Fiscal year support (не календарный год)
- 📅 Compare periods (текущий квартал vs предыдущий)

---

### FR-080: Переводы между счетами

**Phase:** 4 (COMPLETED ✅)
**Приоритет:** High
**Категория:** transfers
**Implementation Status:** ✅ FULLY IMPLEMENTED (v5.1.4+)
**Branch:** `feature/ui-improvements-and-transfers`

**Описание:**
Пользователи могут выполнять переводы средств между разными счетами, например "Из кошелька в банк" или "Из сбережений на повседневные расходы". Каждый перевод создает 2 связанные транзакции (списание с источника + пополнение получателя), объединенные через `transfer_id`.

**User Story:**
Как пользователь семейного бюджета, я хочу переводить деньги между своими счетами (кошелек, банк, сбережения), чтобы отслеживать движение средств и видеть реальный баланс каждого счета.

**Acceptance Criteria:**

1. **Модальное окно переводов:**
   - Открывается через кнопку "💸 Перевод между счетами" в Quick Actions на dashboard
   - Также доступно на страницах Facts и Plan
   - Содержит поля: дата, сумма, FROM (Счет + категория), TO (Счет + категория), описание (опционально)

2. **Валидация:**
   - FROM Счет != TO Счет (нельзя перевести самому себе)
   - Amount > 0 (положительная сумма)
   - FROM category имеет тип `debit` (списание)
   - TO category имеет тип `credit` (пополнение)
   - Дата перевода <= сегодня (нельзя создавать будущие переводы)

3. **Atomic создание 2 транзакций:**
   - **FROM fact:** `record_type=fact`, `article_id` (type=debit), `amount` (отрицательное), `financial_center_id` (источник), `transfer_id` (уникальный ID)
   - **TO fact:** `record_type=fact`, `article_id` (type=credit), `amount` (положительное), `financial_center_id` (получатель), `transfer_id` (тот же ID)
   - Обе транзакции создаются в одной транзакции БД (atomic)

4. **Категории переводов:**
   - Пользователи создают собственные категории с типами `debit` и `credit`
   - Иерархическая структура поддерживается (подкатегории)
   - Коды генерируются автоматически: ART-{seq} (через `generate_code()`)
   - Выбор только листовых категорий (через подстрочный поиск)

5. **Visual feedback:**
   - Badge "🔁 Перевод" отображается рядом с транзакциями, имеющими `transfer_id != NULL`
   - Клик по badge показывает связанную транзакцию
   - В списке транзакций (Facts/Plan pages) переводы визуально выделены

6. **Quick Actions button:**
   - Кнопка "💸 Перевод между счетами" добавлена в Quick Actions на dashboard
   - Стиль: `btn btn-outline btn-secondary`
   - Расположена после кнопки "Добавить план"

7. **Date preselection:**
   - Кнопки быстрого выбора даты: "Сегодня", "Вчера", "Позавчера"
   - При клике дата автоматически заполняется
   - Calendar widget синхронизируется с выбранной датой

**Dependencies:**
- Backend: POST `/api/v1/transfers` endpoint (backend/app/api/v1/endpoints/transfers.py)
- Database: `transfer_id` field в `t_f_budget_fact` (nullable INTEGER)
- Database: CHECK constraint обновлен для поддержки типов `debit` и `credit`
- Frontend: Transfer modal (frontend/web/templates/components/modal_transfer.html)
- Frontend: Transfer JS logic (frontend/web/static/js/transfer.js)
- Shared: ChoicesCategoryTree component для выбора категорий

**Implementation Details:**

**Backend (backend/app/api/v1/endpoints/transfers.py):**
```python
@router.post("/", response_model=TransferResponse)
async def create_transfer(
    data: TransferCreate,
    session: AsyncSession,
    current_user: CurrentUser
):
    # 1. Validate from_cfo != to_cfo
    # 2. Validate from_article.type == 'debit'
    # 3. Validate to_article.type == 'credit'
    # 4. Generate unique transfer_id (max + 1)
    # 5. Create 2 BudgetFact records atomically
    # 6. Return TransferResponse with both facts
```

**Database (Alembic migration):**
```sql
-- Add transfer_id field
ALTER TABLE t_f_budget_fact ADD COLUMN transfer_id INTEGER NULL;
CREATE INDEX ix_budget_fact_transfer_id ON t_f_budget_fact(transfer_id);

-- Update CHECK constraint for article types
ALTER TABLE t_d_article DROP CONSTRAINT t_d_article_type_check;
ALTER TABLE t_d_article ADD CONSTRAINT t_d_article_type_check
    CHECK (type IN ('income', 'expense', 'debit', 'credit'));
```

**Frontend (modal_transfer.html):**
- CalendarWidget для выбора даты (range picker mode)
- ChoicesCategoryTree для FROM article (type='debit')
- ChoicesCategoryTree для TO article (type='credit')
- Dropdowns для FROM/TO financial centers
- Quick date buttons: сегодня, вчера, позавчера
- MainButton "Создать перевод" → POST `/api/v1/transfers`

**Обоснование архитектурных решений:**

1. **Почему debit/credit вместо income/expense?**
   - Семантическая ясность: "debit" явно означает списание, "credit" - пополнение
   - Разделение переводов и обычных транзакций в аналитике
   - Пользователи создают специализированные категории для переводов

2. **Почему 2 отдельные транзакции вместо одной?**
   - Симметрия: каждая транзакция имеет свой Счет, Место затрат, категорию
   - Простота аналитики: переводы суммируются как обычные транзакции
   - SCD Type 2 compatibility: можно изменять категории независимо

3. **Почему transfer_id nullable?**
   - Обратная совместимость: существующие транзакции остаются валидными
   - Опциональность: не все транзакции являются переводами

4. **Почему пользователи создают категории сами?**
   - Гибкость: каждая семья использует свои названия ("Из кошелька", "С карты")
   - Иерархия: можно группировать переводы (например "Переводы → Сбережения")
   - Кодировка ART-{seq}: переиспользование существующей логики генерации кодов

**Testing Notes:**
- Unit tests: `tests/unit/backend/api/test_transfers.py`
- Integration tests: `tests/integration/test_transfer_flow.py`
- E2E tests: `tests/e2e/test_transfer_modal.py`
- Manual testing checklist:
  - ✅ Создать перевод через modal
  - ✅ Проверить 2 транзакции созданы с одинаковым transfer_id
  - ✅ Проверить badge "🔁 Перевод" отображается
  - ✅ Проверить аналитика включает обе транзакции
  - ✅ Проверить валидация (same CFO, negative amount, wrong types)

**Related Documents:**
- docs/prd/06-database-design.md - секция 6.3.1 Transfer Support Fields
- docs/prd/07-api-specification.md - POST /api/v1/transfers endpoint
- docs/prd/08-ui-design.md - Transfer modal UI specification
- CLAUDE.md - Shared Family Budget Model, SCD Type 2 pattern

---

### 4.13 Analytics Calendar-Based Periods (v5.1.4 - COMPLETED)

**Версия:** v5.1.4
**Дата:** 2025-11-11
**Статус:** ✅ COMPLETED
**Branch:** `feature/calendar-based-periods`

#### Описание

Переход от rolling periods к calendar-based periods для предустановленных фильтров (Месяц/Квартал/Год) в аналитике. Основная цель - анализировать данные по календарным границам (от 1 числа месяца, начала квартала, января) вместо скользящих периодов относительно текущей даты. Custom range сохраняет rolling logic с обновленными порогами агрегации.

#### Изменения в периодах

**До (v5.1.3 - rolling periods):**
- **Месяц**: 4 rolling недели (~28 дней назад → сегодня)
- **Квартал**: 3 rolling месяца (текущий + 2 назад)
- **Год**: 12 rolling месяцев (текущий + 11 назад)

**После (v5.1.4 - calendar-based):**
- **Месяц**: Текущий календарный месяц (от 1 числа → сегодня или последний день)
- **Квартал**: Текущий календарный квартал (от первого месяца → сегодня или последний день)
- **Год**: Текущий календарный год (от 1 января → сегодня или 31 декабря)
- **Custom**: Rolling-based с обновленными порогами агрегации:
  - ≤7 дней → по дням
  - 8-31 день → по дням (было: недели)
  - 32-91 день → по неделям (было: 93 дня)
  - 92-365 дней → по месяцам
  - >365 дней → по годам

#### Backend Changes

**Новые функции в `backend/app/utils/date_helpers.py`** (+110 lines)

```python
def get_current_calendar_month(target_date: date) -> Tuple[date, date]
    """Возвращает границы текущего календарного месяца (1 число → конец месяца)"""

def get_current_calendar_quarter(target_date: date) -> Tuple[date, date]
    """Возвращает границы текущего календарного квартала (Q1-Q4)"""

def get_current_calendar_year(target_date: date) -> Tuple[date, date]
    """Возвращает границы текущего календарного года (янв 1 → дек 31)"""
```

**Изменения в `backend/app/api/v1/analytics.py`** (~200 lines changed)

Все 5 endpoints обновлены с calendar-based logic для предустановленных периодов:

##### Endpoints
1. **GET `/api/v1/analytics/plan-fact`** - заменена rolling logic на calendar
2. **GET `/api/v1/analytics/trends`** - заменена rolling logic на calendar
3. **GET `/api/v1/analytics/category-breakdown`** - заменена rolling logic на calendar
4. **GET `/api/v1/analytics/waterfall`** - заменена rolling logic на calendar
5. **GET `/api/v1/analytics/heatmap`** - заменена rolling logic на calendar

##### Custom Range Thresholds (обновлены во всех endpoints)
- **Старые пороги:** ≤30 дней, ≤93 дней
- **Новые пороги:** ≤31 дней, ≤91 дней, ≤365 дней, >365 дней
- **Агрегация для 8-31 дней:** по дням (было: по неделям)

#### Frontend Changes

**`frontend/web/templates/analytics.html`** (~30 lines changed)

**JavaScript - функция `updatePeriodDisplay()`:**

```javascript
case 'month':
    // Текущий календарный месяц (от 1 числа до сегодня)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    text = `Выбран месяц: ${formatDate(monthStart)} — ${formatDate(today)}`;
    break;

case 'quarter':
    // Текущий календарный квартал (Q1-Q4)
    const quarterNum = Math.floor(today.getMonth() / 3) + 1;
    const quarterStart = new Date(today.getFullYear(), (quarterNum - 1) * 3, 1);
    text = `Выбран квартал Q${quarterNum}: ${formatDate(quarterStart)} — ${formatDate(today)}`;
    break;

case 'year':
    // Текущий календарный год (от 1 января до сегодня)
    const yearStart = new Date(today.getFullYear(), 0, 1);
    text = `Выбран год ${today.getFullYear()}: ${formatDate(yearStart)} — ${formatDate(today)}`;
    break;
```

#### Files Changed

**Backend:**
- `backend/app/utils/date_helpers.py` (+110 lines - 3 новые функции)
- `backend/app/api/v1/analytics.py` (~200 lines changed - 5 endpoints + custom range thresholds)

**Frontend:**
- `frontend/web/templates/analytics.html` (~30 lines changed - updatePeriodDisplay function)

**Documentation:**
- `docs/prd/04-functional-requirements.md` (этот файл)

#### Technical Decisions

**Почему calendar-based для предустановленных фильтров?**
- Бизнес-требование: анализ по календарным границам (месяц = ноябрь 2025, год = 2025)
- Easier comparison: "ноябрь vs октябрь" понятнее чем "последние 28 дней"
- Alignment с бухгалтерией: отчеты за календарные периоды

**Почему rolling для custom range?**
- Гибкость: пользователь выбирает любой диапазон
- Auto-detection: система определяет оптимальную агрегацию
- Last selected date: rolling от последней выбранной даты

**Почему обновили пороги custom range?**
- 31 день вместо 30: полный февраль (28-29 дней) + запас
- 91 день вместо 93: ровно 13 недель = 1 квартал
- Добавлен >365: support для multi-year диапазонов

#### Validation

- ✅ Python syntax: `python3 -m py_compile backend/app/utils/date_helpers.py`
- ✅ Python syntax: `python3 -m py_compile backend/app/api/v1/analytics.py`

#### Breaking Changes

- ⚠️ Предустановленные фильтры теперь показывают календарные границы вместо rolling
- ⚠️ Количество точек на графиках изменилось (дни месяца вместо недель)
- ✅ API response format остался совместимым

#### Migration Notes

**Data Migration:**
- ✅ Не требуется (изменения только в логике)

---


