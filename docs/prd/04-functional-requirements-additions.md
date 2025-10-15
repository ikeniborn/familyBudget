## 4.7 Additional Features (Phase 1 - NEW)

### NEW Features реализованные в Phase 1 (не планировались в исходном PRD v1.0)

---

#### FR-051: Real-time Monitoring Dashboard

**Phase:** 1 ✅ **РЕАЛИЗОВАНО**
**Приоритет:** High
**Категория:** admin_monitoring

**Описание:**
Real-time dashboard для мониторинга состояния системы, доступный администраторам. Использует Server-Sent Events (SSE) для обновления данных каждые 5 секунд.

**User Story:**
Как администратор, я хочу видеть текущее состояние системы в real-time, чтобы быстро реагировать на проблемы.

**Acceptance Criteria:**
1. ✅ Real-time обновление через SSE (Server-Sent Events)
2. ✅ Отображение статуса Docker контейнеров
3. ✅ Database connection pool metrics
4. ✅ Recent logs (последние 100 строк)
5. ✅ System metrics (CPU, memory, disk)
6. ✅ Quick actions: restart services, view logs

**Технологии:**
- HTMX для dynamic UI
- Server-Sent Events (SSE) для real-time updates
- Jinja2 templates
- TailwindCSS

**Endpoints:**
- GET /admin/monitoring (HTML page)
- GET /admin/monitoring/stream (SSE stream)

**Implementation Status:** ✅ COMPLETED (TASK-054)

---

#### FR-052: Enhanced Health Check Endpoints

**Phase:** 1 ✅ **РЕАЛИЗОВАНО**
**Приоритет:** Medium
**Категория:** operations

**Описание:**
Comprehensive health check endpoints для мониторинга состояния приложения, совместимые с Kubernetes readiness/liveness probes.

**User Story:**
Как DevOps engineer, я хочу проверять здоровье приложения через HTTP endpoints, чтобы автоматизировать мониторинг.

**Acceptance Criteria:**
1. ✅ GET /health - Basic health check (200 OK)
2. ✅ GET /health/detailed - Detailed health info (database, uptime, metrics)
3. ✅ GET /ready - Readiness probe (K8s compatible)
4. ✅ GET /ping - Ping endpoint (response: "pong")
5. ✅ JSON response format
6. ✅ Database connectivity check

**Response Examples:**
```json
// /health
{"status": "ok", "database": true}

// /health/detailed
{
  "status": "healthy",
  "database": {"connected": true, "pool_size": 5},
  "uptime_seconds": 3600,
  "version": "4.4.0"
}
```

**Implementation Status:** ✅ COMPLETED (TASK-053)

---

#### FR-053: Hierarchy API Endpoints

**Phase:** 1 ✅ **РЕАЛИЗОВАНО**
**Приоритет:** Medium
**Категория:** api_extensions

**Описание:**
Специальные API endpoints для работы с иерархией статей, использующие Closure Table pattern для эффективных запросов.

**User Story:**
Как frontend developer, я хочу получать subtree и breadcrumb path через API, чтобы отображать иерархические структуры.

**Acceptance Criteria:**
1. ✅ GET /api/v1/articles/{id}/subtree - Получить все дочерние статьи (любая глубина)
2. ✅ GET /api/v1/articles/{id}/ancestors - Получить путь от корня (breadcrumbs)
3. ✅ Query parameter: include_self (default: true)
4. ✅ Response includes depth level для каждого узла
5. ✅ Efficient queries (O(1) complexity через Closure Table)
6. ✅ User isolation (current_user.id filter)

**Query Examples:**
```
GET /api/v1/articles/5/subtree?include_self=true
→ Returns: [self, all children, all grandchildren, ...]

GET /api/v1/articles/15/ancestors
→ Returns: [root, parent, grandparent, ...]  (ordered by depth DESC)
```

**Implementation Status:** ✅ COMPLETED (TASK-019)

---

### 4.8 Phase 2 Roadmap - ЦФО/МВЗ Integration

#### FR-070: ЦФО/МВЗ Integration (PLANNED)

**Phase:** 2 ⏳ **PLANNED**
**Приоритет:** Medium
**Категория:** database_extension

**Описание:**
Интеграция Cost Centers (МВЗ) и Financial Centers (ЦФО) в API и UI. Таблицы уже созданы в БД, но не используются в Phase 1.

**Текущий статус:**
- ✅ Database tables: t_d_financial_center, t_d_cost_center созданы
- ✅ SCD Type 2 pattern реализован
- ❌ API endpoints: не реализованы
- ❌ UI: не реализованы
- ❌ Facts integration: t_f_budget_fact не содержит FK на ЦФО/МВЗ

**Acceptance Criteria (для Phase 2):**
1. ⏳ API endpoints для CRUD ЦФО/МВЗ
2. ⏳ UI для управления ЦФО/МВЗ (admin only)
3. ⏳ Добавить FK в t_f_budget_fact: financial_center_id, cost_center_id
4. ⏳ Migration для существующих данных
5. ⏳ Integration tests

**Dependencies:**
- Требуется для полной реализации FR-001, FR-002 (Telegram Bot)

---

