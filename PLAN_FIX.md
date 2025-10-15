# PLAN_FIX.md - Детальный план доработок Phase 2

**Версия:** 1.0
**Дата создания:** 2025-10-14
**Статус:** Phase 2 Planning
**Основание:** [PRD_IMPLEMENTATION_COMPARISON.md](docs/PRD_IMPLEMENTATION_COMPARISON.md)

---

## 📊 EXECUTIVE SUMMARY

### Общая статистика недоработок

**Phase 1 Status (v4.4.0):** ✅ COMPLETED (Compliance: 83%)
- 18 из 24 FR реализовано
- 373 теста passed
- 43 API endpoints
- Production-ready для Backend + Web + Admin

**Phase 2 Goals (v5.0+):**
- 6 основных FR (Telegram Bot)
- 4 ЦФО/МВЗ integration задачи
- 2 Advanced Analytics UI задачи
- 3 Database optimization задачи
- 4 Performance & Load Testing задачи
- 5 Additional Features

**Всего задач в Phase 2:** ~24 задачи

**Оценка времени Phase 2:** 4-6 недель (1 developer full-time)

**Приоритет:** Telegram Bot (HIGH) → ЦФО/МВЗ (MEDIUM) → Analytics UI (MEDIUM) → Optimizations (LOW)

---

## 🎯 PHASE 2 ROADMAP

### Timeline Overview

```
Week 1-2:  Telegram Bot Core (FR-001, FR-002, FR-003)
Week 3:    Telegram Bot Extended (FR-004, FR-005, FR-006)
Week 4:    ЦФО/МВЗ Integration + Advanced Analytics UI
Week 5:    Database Optimizations + Performance Testing
Week 6:    Final Testing + Documentation + Deployment
```

**Start Date:** TBD
**Target Release:** v5.0.0

---

## 🔥 HIGH PRIORITY TASKS

### EPIC-001: Telegram Bot Implementation

**Описание:** Реализация полноценного Telegram бота для оперативного ввода данных через ConversationHandler.

**Business Value:** Критичная функциональность - основная ценность продукта (быстрый ввод < 1 мин)

**Preconditions:**
- ✅ Backend API готов (POST /api/v1/facts, GET /api/v1/articles)
- ✅ Database schema готова
- ✅ Authentication flow готов

**Dependencies:** None (все зависимости выполнены в Phase 1)

---

#### TASK-001: FR-001 - Telegram Bot: Добавление расхода

**Priority:** CRITICAL
**Estimated Time:** 8-10 hours
**Complexity:** HIGH

**Description:**
Реализовать ConversationHandler в Telegram боте для добавления фактических расходов через последовательный диалог с inline-клавиатурами.

**Technical Approach:**
1. Использовать python-telegram-bot v21.0+ с ConversationHandler
2. Состояния: START → AMOUNT → ARTICLE → COMMENT → CONFIRM
3. Inline keyboards для выбора статей (с поддержкой иерархии)
4. Валидация через Pydantic schemas
5. API calls: POST /api/v1/facts

**Implementation Steps:**
1. Setup Telegram bot framework (python-telegram-bot)
2. Implement ConversationHandler states
3. Create inline keyboards для статей (иерархия)
4. Integrate с Backend API (POST /api/v1/facts)
5. Add validation (amount, article_id)
6. Add /cancel command
7. Add success confirmation message

**Acceptance Criteria:**
- ✅ Бот запрашивает все обязательные поля последовательно
- ✅ Inline-клавиатуры для выбора статей
- ✅ Иерархия статей отображается корректно (parent → child)
- ✅ Валидация суммы (положительное число, до 2 знаков после запятой)
- ✅ Подтверждение успешного добавления с итоговой информацией
- ✅ Возможность отменить операцию командой /cancel
- ✅ Запись привязывается к пользователю автоматически (через Telegram user_id)

**Testing:**
- Unit tests: ConversationHandler states (10 tests)
- Integration tests: Bot + Backend API (5 tests)
- Manual testing: Real Telegram conversation flow

**Files to Create:**
- `bot/handlers/add_expense.py` - ConversationHandler logic
- `bot/keyboards/article_keyboard.py` - Inline keyboards
- `bot/utils/validators.py` - Input validation
- `bot/tests/test_add_expense.py` - Unit tests

**Known Risks:**
- ⚠️ Inline keyboard pagination для больших иерархий
- ⚠️ Concurrent conversations (multiple users)
- ⚠️ Telegram API rate limits

---

#### TASK-002: FR-002 - Telegram Bot: Добавление плана

**Priority:** CRITICAL
**Estimated Time:** 4-6 hours
**Complexity:** MEDIUM

**Description:**
Аналогичный ConversationHandler для добавления плановых записей бюджета.

**Technical Approach:**
- Reuse код из TASK-001 (95% similarity)
- Различие: record_type = "plan" вместо "fact"
- API call: POST /api/v1/facts (с record_type="plan")

**Implementation Steps:**
1. Copy and adapt add_expense.py → add_plan.py
2. Modify для plann type (record_type="plan")
3. Update confirmation message
4. Add integration tests

**Acceptance Criteria:**
- ✅ Аналогичный UX как для добавления расхода
- ✅ Запись создается с типом "plan"
- ✅ Возможность добавить несколько плановых записей на один период

**Estimated Time:** 4-6 hours (faster due to code reuse)

---

#### TASK-003: FR-003 - Telegram Bot: Просмотр итогов

**Priority:** HIGH
**Estimated Time:** 6-8 hours
**Complexity:** MEDIUM

**Description:**
Команда /summary для просмотра итогов (план vs факт) через Telegram бот.

**Technical Approach:**
1. API call: GET /api/v1/facts/summary
2. Format response as Telegram message
3. Use inline keyboard для выбора периода
4. Display: план, факт, остаток, процент выполнения

**Implementation Steps:**
1. Create summary command handler
2. Fetch data from API (GET /api/v1/facts/summary)
3. Format response (plan, fact, deviation, %)
4. Add period selection via inline keyboard
5. Add grouping by top-level articles

**Acceptance Criteria:**
- ✅ Команда /summary показывает итоги за текущий период
- ✅ Возможность выбрать период через inline-клавиатуру
- ✅ Отображение: план, факт, остаток, процент выполнения
- ✅ Группировка по статьям верхнего уровня

**Files to Create:**
- `bot/handlers/summary.py`
- `bot/utils/formatter.py` - Format summary data
- `bot/tests/test_summary.py`

---

#### TASK-004: FR-004 - Telegram Bot: Корректировка записей

**Priority:** HIGH
**Estimated Time:** 8-10 hours
**Complexity:** HIGH

**Description:**
Команда /edit для редактирования/удаления собственных записей через Telegram.

**Technical Approach:**
1. GET /api/v1/facts (last 10, user-filtered)
2. Inline keyboard с последними записями
3. Edit flow: выбор поля → новое значение
4. Delete flow: подтверждение → DELETE /api/v1/facts/{id}
5. Security: проверка user_id (backend уже проверяет)

**Implementation Steps:**
1. Create edit command handler
2. Fetch user's last 10 facts (GET /api/v1/facts?limit=10)
3. Display inline keyboard с записями
4. Implement edit flow (ConversationHandler)
5. Implement delete flow с подтверждением
6. Add security checks (user_id matching)

**Acceptance Criteria:**
- ✅ Команда /edit показывает последние 10 записей пользователя
- ✅ Выбор записи через inline-клавиатуру
- ✅ Возможность изменить любое поле или удалить запись
- ✅ Запрет на редактирование чужих записей (403 от backend)
- ✅ Подтверждение перед удалением

**Known Risks:**
- ⚠️ Concurrent edits (race condition)
- ⚠️ Long-running conversations (timeout)

---

#### TASK-005: FR-005 - Telegram Bot: Еженедельные отчеты

**Priority:** HIGH
**Estimated Time:** 6-8 hours
**Complexity:** MEDIUM

**Description:**
Автоматическая отправка еженедельных отчетов (план vs факт) всем пользователям по расписанию.

**Technical Approach:**
1. Cron job или APScheduler (Python)
2. Fetch all users (GET /api/v1/admin/users)
3. For each user: fetch summary (GET /api/v1/facts/summary)
4. Send Telegram message
5. User opt-out: /settings command

**Implementation Steps:**
1. Setup APScheduler для periodic tasks
2. Create weekly_report.py job
3. Fetch all users
4. For each user: generate report, send via Telegram
5. Implement /settings command (opt-in/opt-out)
6. Add logging and error handling

**Acceptance Criteria:**
- ✅ Отчет отправляется по расписанию (воскресенье 20:00)
- ✅ Формат: план, факт, отклонение (абс. и %), топ-3 статьи по расходам
- ✅ Пользователь может отключить уведомления командой /settings
- ✅ (Optional) Настройка дня и времени отправки

**Files to Create:**
- `bot/jobs/weekly_report.py`
- `bot/handlers/settings.py`
- `bot/utils/scheduler.py`

---

#### TASK-006: FR-006 - Telegram Bot: Уведомления о превышении бюджета

**Priority:** HIGH
**Estimated Time:** 6-8 hours
**Complexity:** MEDIUM

**Description:**
Автоматические уведомления при превышении плана на 90%+.

**Technical Approach:**
1. Trigger: после добавления расхода (POST /api/v1/facts)
2. Backend logic: check plan vs fact
3. If fact >= plan * 0.9: send notification
4. Store notification history (avoid duplicates)

**Implementation Steps:**
1. Add backend logic: check_budget_threshold()
2. Implement notification service
3. Send Telegram message when threshold reached
4. Store notification history (table: t_notification)
5. Add настраиваемый порог (default: 90%)

**Acceptance Criteria:**
- ✅ Проверка выполняется при добавлении нового расхода
- ✅ Порог предупреждения настраиваемый (по умолчанию 90%)
- ✅ Уведомление содержит: статью, план, факт, процент
- ✅ Не отправлять повторные уведомления для той же статьи/периода

**Database Changes:**
```sql
CREATE TABLE t_notification (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES t_d_user(id),
    article_id INT REFERENCES t_d_article(id),
    notification_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### EPIC-002: ЦФО/МВЗ Integration

**Описание:** Интеграция Cost Centers (МВЗ) и Financial Centers (ЦФО) в API и UI.

**Business Value:** Дополнительная категоризация расходов для крупных семей/организаций.

**Preconditions:**
- ✅ Database tables: t_d_financial_center, t_d_cost_center созданы
- ✅ SCD Type 2 pattern реализован

**Status:** Tables created but not integrated in Phase 1

---

#### TASK-007: ЦФО/МВЗ API Endpoints

**Priority:** MEDIUM
**Estimated Time:** 6-8 hours
**Complexity:** MEDIUM

**Description:**
Создать REST API endpoints для CRUD операций с ЦФО и МВЗ.

**Endpoints to Create:**
```
Financial Centers:
- GET    /api/v1/financial-centers      # List all (current user)
- POST   /api/v1/financial-centers      # Create
- GET    /api/v1/financial-centers/{id} # Get one
- PUT    /api/v1/financial-centers/{id} # Update (SCD2)
- DELETE /api/v1/financial-centers/{id} # Soft delete

Cost Centers:
- GET    /api/v1/cost-centers
- POST   /api/v1/cost-centers
- GET    /api/v1/cost-centers/{id}
- PUT    /api/v1/cost-centers/{id}
- DELETE /api/v1/cost-centers/{id}
```

**Implementation Steps:**
1. Create Pydantic schemas (FinancialCenterCreate, FinancialCenterResponse)
2. Create API endpoints (similar to Articles endpoints)
3. Apply SCD Type 2 через SCD2Service
4. Add user isolation (current_user.id)
5. Add integration tests (CRUD + SCD2)

**Acceptance Criteria:**
- ✅ 10 новых endpoints (5 для ЦФО, 5 для МВЗ)
- ✅ SCD Type 2 корректно работает
- ✅ User isolation enforced
- ✅ OpenAPI documentation updated
- ✅ Integration tests (15 tests)

**Files to Create:**
- `backend/app/api/v1/financial_centers.py`
- `backend/app/api/v1/cost_centers.py`
- `backend/app/schemas/financial_center.py`
- `backend/app/schemas/cost_center.py`
- `backend/tests/integration/test_financial_centers.py`

---

#### TASK-008: Add ЦФО/МВЗ FK to Facts Table

**Priority:** MEDIUM
**Estimated Time:** 4-6 hours
**Complexity:** HIGH (database migration)

**Description:**
Добавить foreign keys в t_f_budget_fact для связи с ЦФО и МВЗ.

**Database Changes:**
```sql
ALTER TABLE t_f_budget_fact
ADD COLUMN financial_center_id INTEGER REFERENCES t_d_financial_center(id),
ADD COLUMN cost_center_id INTEGER REFERENCES t_d_cost_center(id);

CREATE INDEX idx_fact_financial_center ON t_f_budget_fact(financial_center_id);
CREATE INDEX idx_fact_cost_center ON t_f_budget_fact(cost_center_id);
```

**Migration Strategy:**
1. Create migration script (010_add_centers_fk.sql)
2. Add columns (nullable initially)
3. Create default ЦФО/МВЗ for existing records
4. Update existing facts с default center_id
5. Add NOT NULL constraint (опционально)

**Acceptance Criteria:**
- ✅ Миграция выполняется без ошибок
- ✅ Существующие данные не повреждены
- ✅ Indexes созданы
- ✅ FK constraints работают

**Rollback Plan:**
```sql
ALTER TABLE t_f_budget_fact
DROP COLUMN financial_center_id,
DROP COLUMN cost_center_id;
```

---

#### TASK-009: ЦФО/МВЗ UI (Admin Panel)

**Priority:** MEDIUM
**Estimated Time:** 8-10 hours
**Complexity:** MEDIUM

**Description:**
Создать веб-интерфейс для управления ЦФО и МВЗ (admin only).

**Pages to Create:**
1. /admin/financial-centers (list + CRUD)
2. /admin/cost-centers (list + CRUD)

**Implementation Steps:**
1. Create Jinja2 templates (HTMX)
2. Create CRUD forms (similar to Articles)
3. Add SCD2 history view (optional)
4. Add to admin navigation menu
5. Add frontend validation

**Acceptance Criteria:**
- ✅ Admin может создавать, редактировать, удалять ЦФО/МВЗ
- ✅ HTMX для dynamic updates
- ✅ SCD Type 2 работает (новая версия при UPDATE)
- ✅ Responsive design (mobile-friendly)

**Files to Create:**
- `backend/app/api/web/financial_centers.py`
- `backend/app/api/web/cost_centers.py`
- `backend/app/templates/admin/financial_centers.html`
- `backend/app/templates/admin/cost_centers.html`

---

#### TASK-010: Integrate ЦФО/МВЗ в Fact Forms

**Priority:** MEDIUM
**Estimated Time:** 4-6 hours
**Complexity:** LOW

**Description:**
Добавить поля ЦФО и МВЗ в формы создания/редактирования фактов.

**Changes:**
1. Update Fact schema (add financial_center_id, cost_center_id)
2. Update API endpoint POST /api/v1/facts (accept new fields)
3. Update frontend forms (add select dropdowns)
4. Update Telegram Bot (add to ConversationHandler states)

**Acceptance Criteria:**
- ✅ Формы содержат dropdowns для ЦФО/МВЗ
- ✅ Validation: ЦФО/МВЗ должны принадлежать current_user
- ✅ Telegram Bot использует ЦФО/МВЗ
- ✅ Integration tests updated

---

### EPIC-003: Advanced Analytics UI

**Описание:** Завершение реализации Waterfall и Heatmap UI (backend уже готов).

**Preconditions:**
- ✅ Backend endpoints: GET /api/v1/analytics/waterfall, GET /api/v1/analytics/heatmap

---

#### TASK-011: FR-013 - Waterfall Chart UI

**Priority:** MEDIUM
**Estimated Time:** 6-8 hours
**Complexity:** MEDIUM

**Description:**
Создать полноценный UI для Waterfall диаграммы с drill-down функциональностью.

**Technical Approach:**
1. ECharts Waterfall configuration
2. HTMX для фильтрации (период, статья)
3. Drill-down: клик на столбец → детализация
4. Color coding: positive (green), negative (red)

**Implementation Steps:**
1. Create waterfall.html template
2. Configure ECharts Waterfall chart
3. Add HTMX filters (period, article)
4. Implement drill-down (show sub-articles)
5. Add responsive design

**Acceptance Criteria:**
- ✅ Использование ECharts
- ✅ Положительные и отрицательные изменения разными цветами
- ✅ Итоговый столбец показывает финальный результат
- ✅ Фильтрация по периоду и статье
- ✅ Drill-down: клик → детализация

**Files:**
- `backend/app/templates/analytics/waterfall.html`
- `backend/app/static/js/waterfall_chart.js`

---

#### TASK-012: FR-014 - Heatmap UI

**Priority:** MEDIUM
**Estimated Time:** 6-8 hours
**Complexity:** MEDIUM

**Description:**
Создать полноценный UI для Heatmap (тепловая карта расходов).

**Technical Approach:**
1. ECharts Heatmap configuration
2. Axes: периоды (X) × статьи (Y)
3. Color scale: min (light) → max (dark)
4. Tooltip с точными суммами

**Implementation Steps:**
1. Create heatmap.html template
2. Configure ECharts Heatmap
3. Add period selection (week/month/quarter)
4. Add color scale legend
5. Add tooltip с детальной информацией

**Acceptance Criteria:**
- ✅ Использование ECharts
- ✅ Цветовая шкала от минимума к максимуму
- ✅ Tooltip с точными суммами
- ✅ Возможность выбрать временной интервал

---

## ⚙️ MEDIUM PRIORITY TASKS

### EPIC-004: Database Optimizations

**Описание:** Опциональные оптимизации БД (views, performance tuning).

---

#### TASK-013: Create Database Views для SCD Type 2

**Priority:** LOW
**Estimated Time:** 2-3 hours
**Complexity:** LOW

**Description:**
Создать views для актуальных записей (is_current=TRUE).

**Views to Create:**
```sql
CREATE VIEW v_d_article_current AS
SELECT * FROM t_d_article WHERE is_current = TRUE;

CREATE VIEW v_d_financial_center_current AS
SELECT * FROM t_d_financial_center WHERE is_current = TRUE;

CREATE VIEW v_d_cost_center_current AS
SELECT * FROM t_d_cost_center WHERE is_current = TRUE;
```

**Benefits:**
- Simplified queries (no need to filter by is_current)
- Consistent naming convention

**Trade-offs:**
- Marginal performance improvement
- Added complexity (views to maintain)

**Recommendation:** OPTIONAL (current approach works well)

---

#### TASK-014: Add SCD Type 2 Database Triggers (Optional)

**Priority:** LOW
**Estimated Time:** 4-6 hours
**Complexity:** MEDIUM

**Description:**
Альтернативный подход: использовать database triggers вместо Python service layer для SCD Type 2.

**Pros:**
- Automatic versioning at database level
- Slightly faster

**Cons:**
- Harder to test (PL/pgSQL)
- Less flexible
- Debugging complexity

**Recommendation:** SKIP (Python service layer более maintainable)

---

#### TASK-015: Database Performance Tuning

**Priority:** LOW
**Estimated Time:** 4-6 hours
**Complexity:** MEDIUM

**Description:**
Performance analysis и оптимизация database queries.

**Tasks:**
1. Run EXPLAIN ANALYZE на медленных queries
2. Add missing indexes (if any)
3. Optimize JOIN queries
4. Consider partitioning (t_f_budget_fact by year)
5. Vacuum analyze

**Metrics to Improve:**
- Query response time: current unknown → target < 100ms (p95)
- Index usage: identify unused indexes

---

## 🧪 PERFORMANCE & LOAD TESTING

### EPIC-005: Performance & Load Testing

**Описание:** Load testing для проверки NFR (response time, throughput).

---

#### TASK-016: Setup Load Testing Framework

**Priority:** MEDIUM
**Estimated Time:** 4-6 hours
**Complexity:** MEDIUM

**Tools:**
- Locust or k6 для HTTP load testing
- pytest-benchmark для Python performance tests

**Scenarios:**
1. Concurrent API requests (100 users)
2. Heavy analytics queries (waterfall, heatmap)
3. Concurrent fact creation (10 req/sec)

---

#### TASK-017: API Performance Testing

**Priority:** MEDIUM
**Estimated Time:** 6-8 hours
**Complexity:** MEDIUM

**Goals:**
- API response time: < 500ms (p95)
- Analytics queries: < 2 sec
- Throughput: 100 req/sec

**Test Scenarios:**
1. GET /api/v1/facts (1000 records)
2. GET /api/v1/analytics/waterfall (heavy query)
3. POST /api/v1/facts (concurrent writes)

---

#### TASK-018: Database Load Testing

**Priority:** MEDIUM
**Estimated Time:** 4-6 hours
**Complexity:** MEDIUM

**Test Scenarios:**
1. INSERT performance (1000 facts/sec)
2. Complex JOIN queries (articles + hierarchy + facts)
3. Concurrent SCD Type 2 updates

---

#### TASK-019: Telegram Bot Load Testing

**Priority:** LOW
**Estimated Time:** 4-6 hours
**Complexity:** MEDIUM

**Scenarios:**
1. Concurrent conversations (100 users)
2. Rapid command execution (/summary 100 times)
3. Telegram API rate limits testing

---

## 🌟 ADDITIONAL FEATURES (LOW PRIORITY)

### TASK-020: JWT Refresh Token Mechanism

**Priority:** LOW
**Estimated Time:** 4-6 hours
**Complexity:** MEDIUM

**Description:**
Implement refresh token для продления JWT tokens без повторной авторизации.

**Current:** JWT 7 days expiration → user re-login
**Target:** Refresh token (30 days) → automatic token renewal

**Endpoint:** POST /api/v1/auth/refresh

---

### TASK-021: Admin Dashboard Analytics

**Priority:** LOW
**Estimated Time:** 6-8 hours
**Complexity:** MEDIUM

**Description:**
Enhanced admin dashboard с системной аналитикой:
- Total users, facts, articles
- Growth metrics (new users/week)
- Most active users
- Popular categories

---

### TASK-022: Export Data (CSV/Excel/PDF)

**Priority:** LOW
**Estimated Time:** 6-8 hours
**Complexity:** MEDIUM

**Description:**
Export functionality для facts и analytics.

**Formats:**
- CSV (pandas)
- Excel (openpyxl)
- PDF (ReportLab or WeasyPrint)

**Endpoints:**
- GET /api/v1/facts/export?format=csv
- GET /api/v1/analytics/export?type=waterfall&format=pdf

---

### TASK-023: Multi-Currency Support

**Priority:** LOW
**Estimated Time:** 10-12 hours
**Complexity:** HIGH

**Description:**
Support для multiple currencies с автоматической конвертацией.

**Changes:**
1. Add currency field to t_f_budget_fact
2. Integrate currency API (e.g., exchangerate-api.com)
3. Store exchange rates in database
4. Convert amounts при отображении

---

### TASK-024: Alembic Migration Framework

**Priority:** LOW
**Estimated Time:** 4-6 hours
**Complexity:** MEDIUM

**Description:**
Переход с raw SQL migrations на Alembic для better version control.

**Benefits:**
- Auto-generate migrations
- Rollback support
- Migration history tracking

---

## 📅 DETAILED TIMELINE & DEPENDENCIES

### Week 1-2: Telegram Bot Core

**Day 1-2:** TASK-001 (FR-001 - Добавление расхода)
**Day 3:** TASK-002 (FR-002 - Добавление плана)
**Day 4-5:** TASK-003 (FR-003 - Просмотр итогов)
**Day 6-7:** Testing & bug fixes

**Dependencies:** None

**Deliverables:**
- Working Telegram Bot для добавления расходов/планов
- /summary command
- Integration tests

---

### Week 3: Telegram Bot Extended

**Day 8-9:** TASK-004 (FR-004 - Корректировка записей)
**Day 10-11:** TASK-005 (FR-005 - Еженедельные отчеты)
**Day 12-13:** TASK-006 (FR-006 - Уведомления)
**Day 14:** Testing & documentation

**Dependencies:** TASK-001, TASK-002, TASK-003

**Deliverables:**
- Edit functionality
- Automated reports
- Budget threshold notifications

---

### Week 4: ЦФО/МВЗ + Analytics UI

**Day 15-16:** TASK-007 (ЦФО/МВЗ API)
**Day 17:** TASK-008 (Database migration)
**Day 18-19:** TASK-009 (ЦФО/МВЗ UI)
**Day 20:** TASK-010 (Integration)
**Day 21:** TASK-011 & TASK-012 (Waterfall + Heatmap UI)

**Dependencies:** None (parallel work possible)

**Deliverables:**
- ЦФО/МВЗ fully integrated
- Waterfall + Heatmap UI complete

---

### Week 5: Optimizations & Performance

**Day 22-23:** TASK-016, TASK-017 (Performance testing setup + execution)
**Day 24:** TASK-018 (Database load testing)
**Day 25:** TASK-013 (Database views - optional)
**Day 26:** Performance tuning based on test results

**Dependencies:** All core features implemented

**Deliverables:**
- Performance test results
- Identified bottlenecks
- Optimization recommendations

---

### Week 6: Final Testing & Release

**Day 27-28:** End-to-end testing (all features)
**Day 29:** Bug fixes
**Day 30:** Documentation updates (API docs, README, CHANGELOG)
**Day 31:** Production deployment (v5.0.0)
**Day 32:** Post-release monitoring

**Dependencies:** All tasks completed

**Deliverables:**
- v5.0.0 release
- Updated documentation
- Production deployment

---

## ✅ ACCEPTANCE CRITERIA (PHASE 2 COMPLETE)

### Must-Have (для релиза v5.0.0):

- ✅ All 6 Telegram Bot FR реализованы и протестированы
- ✅ ЦФО/МВЗ integration (API + UI + Database)
- ✅ Waterfall + Heatmap UI complete
- ✅ 50+ new tests added (bringing total to 420+)
- ✅ Performance testing executed (results documented)
- ✅ Documentation updated (PRD, API docs, README)

### Nice-to-Have (можно отложить до v5.1):

- ⏳ Database views (TASK-013)
- ⏳ Refresh token (TASK-020)
- ⏳ Admin dashboard analytics (TASK-021)
- ⏳ Export functionality (TASK-022)
- ⏳ Multi-currency (TASK-023)

---

## 🚨 RISKS & MITIGATION

### Risk 1: Telegram API Rate Limits

**Probability:** MEDIUM
**Impact:** HIGH
**Mitigation:**
- Implement rate limiting in bot
- Use message batching
- Monitor Telegram API usage

---

### Risk 2: Database Migration Failure (TASK-008)

**Probability:** LOW
**Impact:** HIGH
**Mitigation:**
- Test migration on staging environment
- Create full database backup before migration
- Prepare rollback script
- Run migration during low-traffic window

---

### Risk 3: Performance Degradation

**Probability:** MEDIUM
**Impact:** MEDIUM
**Mitigation:**
- Early performance testing (Week 5)
- Optimize queries before release
- Consider caching (Redis) if needed

---

### Risk 4: Scope Creep

**Probability:** MEDIUM
**Impact:** MEDIUM
**Mitigation:**
- Stick to defined Phase 2 scope
- Move nice-to-have features to v5.1
- Regular progress reviews

---

## 📊 SUCCESS METRICS

### KPIs для Phase 2:

1. **Feature Completion:** 24/24 tasks completed (100%)
2. **Test Coverage:** 420+ tests (vs 373 in Phase 1)
3. **Performance:** API response time < 500ms (p95)
4. **User Adoption:** Telegram Bot usage > 80% of users
5. **Bug Rate:** < 5 critical bugs in first month post-release

---

## 📖 DOCUMENTATION UPDATES

### Documents to Update:

1. **PRD (docs/prd/)** - Mark Phase 2 as COMPLETED
2. **API Documentation** - Add new endpoints (ЦФО/МВЗ)
3. **README.md** - Update with Telegram Bot usage
4. **CLAUDE.md** - Add Telegram Bot development notes
5. **CHANGELOG.md** - Document v5.0.0 changes
6. **Task Reports** - Create TASK-XXX_COMPLETION.md for each task

---

## 🎯 CONCLUSION

Phase 2 development plan охватывает **24 задачи** с общей оценкой **~160-200 hours** (4-6 недель full-time).

**Critical Path:** Telegram Bot (FR-001 до FR-006) → ЦФО/МВЗ Integration → Performance Testing → Release

**Flexibility:** Tasks можно выполнять частично параллельно (например, ЦФО/МВЗ независимо от Telegram Bot).

**Recommendation:** Start с TASK-001 (Telegram Bot: Добавление расхода) - это highest value feature.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-14
**Status:** ✅ Planning Complete, Ready for Phase 2 Kickoff
**Next Action:** Get stakeholder approval → Start TASK-001
