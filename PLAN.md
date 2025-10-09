# Family Budget - Implementation Plan v1.0

**Project:** Family Budget Management System
**Status:** Planning Completed - Ready for Implementation
**Date:** 2025-10-09
**Estimated Duration:** 8-10 weeks (405 hours)
**Team:** 1 developer (sequential execution)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Scope](#project-scope)
3. [Implementation Roadmap](#implementation-roadmap)
4. [Epics & Tasks Breakdown](#epics--tasks-breakdown)
5. [Critical Paths & Dependencies](#critical-paths--dependencies)
6. [Risk Management](#risk-management)
7. [Success Criteria](#success-criteria)
8. [Quick Start Guide](#quick-start-guide)

---

## Executive Summary

### Project Overview

Family Budget - система управления семейным бюджетом с интеграцией Telegram и веб-интерфейсом для аналитики. Проект включает 21 функциональное требование, 7 нефункциональных требований, разбитых на 6 эпиков и 69 задач.

### Key Metrics

| Metric | Value |
|--------|-------|
| **Total Epics** | 6 |
| **Total Tasks** | 69 |
| **Estimated Effort** | 405 hours |
| **Timeline** | 8-10 weeks |
| **Functional Requirements** | 21 |
| **Non-Functional Requirements** | 7 |
| **Identified Risks** | 7 (1 CRITICAL, 3 HIGH) |

### Technology Stack

- **Backend:** FastAPI + SQLModel + PostgreSQL 16+
- **Frontend:** HTMX + Jinja2 + ECharts 5.5+
- **Bot:** python-telegram-bot 20.x
- **Deployment:** Docker Compose + Bash automation
- **Auth:** Telegram OAuth + JWT (7 days)

---

## Project Scope

### Functional Requirements (21 FR)

<details>
<summary><b>Core Features</b></summary>

1. **FR-AUTH-001:** Авторизация через Telegram OAuth
2. **FR-USER-001:** Управление пользователями (admin/user roles)
3. **FR-CAT-001:** Управление категориями (иерархия)
4. **FR-CAT-002:** SCD Type 2 для статей справочника
5. **FR-FACT-001:** Регистрация доходов/расходов
6. **FR-FACT-002:** Редактирование фактов
7. **FR-FACT-003:** Удаление фактов
8. **FR-BOT-001:** Telegram bot команды (/start, /add, /today, /stats)
9. **FR-BOT-002:** Быстрое добавление через inline keyboard
10. **FR-WEB-001:** Веб-интерфейс для аналитики
11. **FR-WEB-002:** Графики (bar, line, pie, waterfall, heatmap)
12. **FR-WEB-003:** Фильтры по периодам
13. **FR-REPORT-001:** Месячные отчеты
14. **FR-REPORT-002:** Годовые отчеты
15. **FR-ADMIN-001:** Админ-панель управления пользователями
16. **FR-ADMIN-002:** Управление глобальными категориями
17. **FR-BACKUP-001:** Автоматический S3 backup
18. **FR-DEPLOY-001:** One-command deployment (install.sh, setup.sh, deploy.sh)
19. **FR-SECURITY-001:** JWT с httpOnly cookies
20. **FR-SECURITY-002:** User isolation (WHERE user_id = current_user)
21. **FR-LOGS-001:** Structured logging

</details>

### Non-Functional Requirements (7 NFR)

| ID | Category | Requirement |
|----|----------|-------------|
| **NFR-PERF-001** | Performance | API response < 500ms (95th percentile) |
| **NFR-PERF-002** | Performance | Analytics page load < 2s |
| **NFR-SCALE-001** | Scalability | Support 100+ users, 10k+ facts/month |
| **NFR-SEC-001** | Security | HMAC-SHA256 Telegram OAuth validation |
| **NFR-SEC-002** | Security | PostgreSQL external access via UFW IP restriction |
| **NFR-MAINT-001** | Maintainability | Code coverage ≥70% |
| **NFR-DEPLOY-001** | Deployment | Containerized (Docker Compose) |

---

## Implementation Roadmap

### Phase 1: Database Foundation (Week 1-2) - 60-80h
**Epic:** EPIC-001
**Priority:** CRITICAL
**Status:** Not Started

**Deliverables:**
- ✅ SCD Type 2 dimension tables (users, articles)
- ✅ Fact table with partitioning
- ✅ Closure Table for hierarchical categories
- ✅ PostgreSQL triggers for hierarchy maintenance
- ✅ Initial data migration scripts

**Critical Tasks:**
- TASK-001: Dimension tables DDL (15h)
- TASK-002: Fact table DDL (12h)
- ⚠️ TASK-003: Closure Table implementation (20h) - **HIGH RISK**

---

### Phase 2: Backend Core (Week 2-3) - 60-80h
**Epic:** EPIC-002
**Priority:** CRITICAL
**Status:** Not Started
**Dependencies:** EPIC-001

**Deliverables:**
- ✅ FastAPI application structure
- ✅ SQLModel models with SCD2 support
- ✅ Telegram OAuth endpoint with HMAC validation
- ✅ JWT middleware
- ✅ CRUD endpoints for facts, articles, users
- ✅ User isolation layer
- ✅ Unit tests (70%+ coverage)

**Critical Tasks:**
- ⚠️ TASK-012: Telegram OAuth endpoint (15h) - **CRITICAL SECURITY**
- TASK-013: JWT middleware (10h)
- TASK-016: CRUD facts endpoints (12h)

---

### Phase 3: Telegram Bot (Week 3-4) - 50-60h
**Epic:** EPIC-003
**Priority:** HIGH
**Status:** Not Started
**Dependencies:** EPIC-002

**Deliverables:**
- ✅ Bot registration & webhook setup
- ✅ Command handlers (/start, /add, /today, /stats)
- ✅ Inline keyboard для быстрого добавления
- ✅ Integration с backend API
- ✅ Error handling & logging

**Key Tasks:**
- TASK-028: Bot initialization (8h)
- TASK-029: /start handler с авторизацией (10h)
- TASK-030: /add command с валидацией (12h)

---

### Phase 4: Web Analytics (Week 4-5) - 50-60h
**Epic:** EPIC-004
**Priority:** MEDIUM
**Status:** Not Started
**Dependencies:** EPIC-002

**Deliverables:**
- ✅ HTMX web UI
- ✅ Jinja2 templates
- ✅ ECharts integration (5 типов графиков)
- ✅ Фильтры по периодам
- ✅ Responsive design

**Key Tasks:**
- TASK-037: HTMX base layout (8h)
- TASK-040: ECharts bar/line charts (10h)
- TASK-041: Pie/waterfall charts (8h)

---

### Phase 5: Admin & Automation (Week 5-6) - 60-70h
**Epic:** EPIC-005
**Priority:** MEDIUM
**Status:** Not Started
**Dependencies:** EPIC-002, EPIC-003

**Deliverables:**
- ✅ Admin panel для управления users
- ✅ Global articles management
- ✅ S3 backup automation (cron + systemd)
- ✅ Monitoring & health checks
- ✅ Integration tests

**Key Tasks:**
- TASK-048: Admin users CRUD (12h)
- TASK-051: S3 backup script (10h)
- TASK-052: Cron setup (6h)

---

### Phase 6: Deployment (Week 6-7) - 50-60h
**Epic:** EPIC-006
**Priority:** HIGH
**Status:** Not Started
**Dependencies:** EPIC-001 to EPIC-005

**Deliverables:**
- ✅ install.sh (Docker, UFW setup)
- ✅ setup.sh (interactive configuration)
- ✅ deploy.sh (container orchestration)
- ✅ backup.sh (manual backup utility)
- ✅ docker-compose.yml production config
- ✅ E2E tests
- ✅ Documentation (README, API docs)

**Critical Tasks:**
- ⚠️ TASK-061: setup.sh с UFW IP restriction (12h) - **RISK-007 mitigation**
- TASK-059: install.sh (10h)
- TASK-060: docker-compose.yml (10h)

---

## Epics & Tasks Breakdown

### EPIC-001: Database Foundation (8 tasks)

| Task ID | Task Name | Effort | Complexity | Risk |
|---------|-----------|--------|------------|------|
| TASK-001 | Dimension tables DDL (SCD2) | 15h | HIGH | - |
| TASK-002 | Fact table DDL | 12h | MEDIUM | - |
| TASK-003 | Closure Table | 20h | VERY HIGH | ⚠️ RISK-001 |
| TASK-004 | Triggers для SCD2 | 10h | MEDIUM | - |
| TASK-005 | Triggers для Closure Table | 12h | HIGH | - |
| TASK-006 | Indexes | 8h | MEDIUM | - |
| TASK-007 | Initial migration scripts | 6h | LOW | - |
| TASK-008 | Unit tests для triggers | 7h | MEDIUM | - |

**Total:** 60-80 hours

---

### EPIC-002: Backend Core (19 tasks)

<details>
<summary><b>Expand Tasks</b></summary>

| Task ID | Task Name | Effort | Complexity | Risk |
|---------|-----------|--------|------------|------|
| TASK-009 | FastAPI app structure | 6h | LOW | - |
| TASK-010 | SQLModel models | 10h | MEDIUM | - |
| TASK-011 | Database connection pool | 4h | LOW | - |
| TASK-012 | Telegram OAuth endpoint | 15h | HIGH | ⚠️ RISK-002 |
| TASK-013 | JWT middleware | 10h | MEDIUM | - |
| TASK-014 | User context injection | 6h | MEDIUM | - |
| TASK-015 | Articles CRUD endpoints | 10h | MEDIUM | - |
| TASK-016 | Facts CRUD endpoints | 12h | MEDIUM | - |
| TASK-017 | Users CRUD endpoints | 8h | MEDIUM | - |
| TASK-018 | SCD2 service layer | 12h | HIGH | - |
| TASK-019 | Hierarchy query service | 10h | HIGH | - |
| TASK-020 | Input validation (Pydantic) | 8h | MEDIUM | - |
| TASK-021 | Error handling middleware | 6h | LOW | - |
| TASK-022 | Structured logging | 5h | LOW | - |
| TASK-023 | OpenAPI documentation | 4h | LOW | - |
| TASK-024 | Unit tests (models) | 10h | MEDIUM | - |
| TASK-025 | Unit tests (endpoints) | 12h | MEDIUM | - |
| TASK-026 | Unit tests (auth) | 8h | HIGH | - |
| TASK-027 | Integration tests | 14h | MEDIUM | - |

**Total:** 60-80 hours

</details>

---

### EPIC-003: Telegram Bot (10 tasks)
**Total:** 50-60 hours

### EPIC-004: Web Analytics (10 tasks)
**Total:** 50-60 hours

### EPIC-005: Admin & Automation (11 tasks)
**Total:** 60-70 hours

### EPIC-006: Deployment (11 tasks)
**Total:** 50-60 hours

---

## Critical Paths & Dependencies

### Critical Path 1: Database Foundation → Backend Core

```
EPIC-001 (Database) → EPIC-002 (Backend)
├─ TASK-001 (Dimension tables) ──┐
├─ TASK-002 (Fact table) ────────┼→ TASK-010 (SQLModel models)
└─ TASK-003 (Closure Table) ─────┘
```

**Why Critical:** Backend не может быть реализован без готовой схемы БД. SCD2 tables и Closure Table - фундамент всей системы.

---

### Critical Path 2: Backend Core → Telegram Bot / Web UI

```
EPIC-002 (Backend) → EPIC-003 (Telegram Bot)
                   → EPIC-004 (Web Analytics)

├─ TASK-012 (OAuth) ──────→ TASK-029 (/start handler)
├─ TASK-013 (JWT) ─────────→ TASK-037 (Web auth)
└─ TASK-016 (Facts CRUD) ──→ TASK-030 (/add command)
                           → TASK-040 (Charts data)
```

**Why Critical:** Bot и Web UI зависят от готового API. Telegram OAuth - общая точка аутентификации.

---

### Critical Path 3: Security Implementation

```
RISK-002 (Telegram OAuth) → TASK-012 (OAuth endpoint)
                          → TASK-026 (Auth unit tests)

RISK-007 (PostgreSQL security) → TASK-061 (setup.sh + UFW)
```

**Why Critical:** Нельзя деплоить систему без решения критических рисков безопасности.

---

## Risk Management

### CRITICAL Risks

#### RISK-007: PostgreSQL External Access Security
**Severity:** CRITICAL | **Probability:** MEDIUM | **Status:** Mitigation Planned

**Description:**
Открытие PostgreSQL порта 5432 без ограничений создает критическую уязвимость.

**Mitigation Strategy:**
```bash
# setup.sh интерактивный промпт
read -p "Нужен внешний доступ к PostgreSQL? (y/n): " PG_EXTERNAL

if [ "$PG_EXTERNAL" = "y" ]; then
    read -p "Введите IP адрес для доступа: " ALLOWED_IP

    # UFW: allow ONLY from specific IP
    ufw allow from $ALLOWED_IP to any port 5432

    # docker-compose.yml conditional port mapping
    POSTGRES_PORTS="5432:5432"
else
    POSTGRES_PORTS=""  # No external access
fi
```

**Validation:**
- Unit test: setup.sh с различными вариантами
- Manual: `ufw status` после setup
- Manual: попытка подключения с другого IP (должна fail)

**Related Tasks:** TASK-061 (setup.sh implementation)

---

### HIGH Risks

#### RISK-002: Telegram OAuth Vulnerability
**Severity:** HIGH | **Probability:** MEDIUM | **Status:** Mitigation Planned

**Description:**
Неправильная валидация hash в Telegram OAuth может привести к аутентификации злоумышленника.

**Mitigation Strategy:**
```python
import hmac
import hashlib

def validate_telegram_auth(data: dict, bot_token: str) -> bool:
    # 1. Extract hash
    received_hash = data.pop('hash', None)

    # 2. Create data string
    data_check_string = '\n'.join([f"{k}={v}" for k, v in sorted(data.items())])

    # 3. Compute secret key
    secret_key = hashlib.sha256(bot_token.encode()).digest()

    # 4. Compute HMAC
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    # 5. Compare
    return hmac.compare_digest(computed_hash, received_hash)
```

**Validation:**
- Unit tests: valid/invalid hash cases
- Unit tests: missing fields, tampered data
- Manual: попытка подделать hash

**Related Tasks:** TASK-012 (OAuth endpoint), TASK-026 (Auth tests)

---

#### RISK-001: Closure Table Complexity
**Severity:** HIGH | **Probability:** HIGH | **Status:** Mitigation Planned

**Description:**
Closure Table паттерн сложен в реализации. Ошибки в triggers могут привести к inconsistent hierarchy.

**Mitigation Strategy:**
1. **Triggers с валидацией:**
   ```sql
   CREATE OR REPLACE FUNCTION update_article_hierarchy()
   RETURNS TRIGGER AS $$
   BEGIN
       -- Self-reference
       INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
       VALUES (NEW.id, NEW.id, 0);

       -- Copy parent's ancestors
       IF NEW.parent_id IS NOT NULL THEN
           -- Check depth limit
           IF (SELECT MAX(depth) FROM t_d_article_hierarchy WHERE descendant_id = NEW.parent_id) >= 10 THEN
               RAISE EXCEPTION 'Max hierarchy depth (10) exceeded';
           END IF;

           INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
           SELECT ancestor_id, NEW.id, depth + 1
           FROM t_d_article_hierarchy
           WHERE descendant_id = NEW.parent_id;
       END IF;

       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Materialized Path Fallback:**
   - Хранить `path` (e.g., "1.2.5") в `t_d_article` для простых queries
   - Closure Table для сложных рекурсивных запросов

3. **Comprehensive Testing:**
   - Unit tests: 20+ test cases для hierarchy operations
   - Edge cases: circular references, max depth, orphaned nodes

**Related Tasks:** TASK-003 (Closure Table), TASK-005 (Triggers), TASK-008 (Unit tests)

---

## Success Criteria

### Functional Success

- [ ] Все 21 FR реализованы и протестированы
- [ ] Acceptance criteria пройдены для всех 69 задач
- [ ] E2E тесты покрывают основные user flows

### Quality Success

- [ ] Code coverage ≥70% (pytest --cov)
- [ ] No CRITICAL/HIGH security vulnerabilities
- [ ] All unit tests pass (pytest)
- [ ] Integration tests pass

### Security Success

- [ ] RISK-002: Telegram OAuth hash validation работает корректно
- [ ] RISK-007: PostgreSQL доступен только с approved IP (UFW configured)
- [ ] JWT tokens validated с httpOnly cookies
- [ ] No SQL injection vulnerabilities (SQLModel ORM enforced)

### Performance Success

- [ ] API response time < 500ms (95th percentile)
- [ ] Analytics page load < 2s
- [ ] Database queries optimized (EXPLAIN ANALYZE)

### Deployment Success

- [ ] One-command deployment: `./install.sh && ./setup.sh && ./deploy.sh`
- [ ] Docker containers start и remain healthy
- [ ] Telegram bot responds to /start
- [ ] Web UI accessible и functional

### Documentation Success

- [ ] README.md с quick start guide
- [ ] API docs (OpenAPI/Swagger)
- [ ] setup.sh parameters documented
- [ ] Telegram bot commands reference

---

## Quick Start Guide

### Step 1: Review Planning Documents

```bash
# Comprehensive master plan
cat workflow/05_master_plan.xml | less

# Developer execution guide with code examples
cat workflow/05_execution_guide.md | less

# Project summary
cat workflow/05_summary.xml | less
```

### Step 2: Setup Development Environment

```bash
# Install Docker & Docker Compose
sudo apt update
sudo apt install -y docker.io docker-compose

# Install PostgreSQL client
sudo apt install -y postgresql-client

# Setup Python 3.11+ virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install fastapi sqlmodel uvicorn python-telegram-bot pytest pytest-cov
```

### Step 3: Start Implementation - EPIC-001

**First Task: TASK-001 (Dimension Tables DDL)**

```sql
-- File: backend/db/migrations/001_dimension_tables.sql

-- Users dimension with SCD Type 2
CREATE TABLE t_d_user (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE,

    -- SCD Type 2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    UNIQUE(telegram_id, is_current) WHERE is_current = TRUE
);

-- Articles dimension with SCD Type 2 + hierarchy
CREATE TABLE t_d_article (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES t_d_user(id),
    parent_id INT REFERENCES t_d_article(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('income', 'expense')),
    is_global BOOLEAN DEFAULT FALSE,

    -- SCD Type 2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE
);

-- Closure Table for hierarchy
CREATE TABLE t_d_article_hierarchy (
    ancestor_id INT REFERENCES t_d_article(id) ON DELETE CASCADE,
    descendant_id INT REFERENCES t_d_article(id) ON DELETE CASCADE,
    depth INT NOT NULL,
    PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_hierarchy_descendant ON t_d_article_hierarchy(descendant_id);
CREATE INDEX idx_hierarchy_depth ON t_d_article_hierarchy(depth);
```

**Acceptance Criteria for TASK-001:**
- [ ] Dimension tables created with SCD2 fields
- [ ] UNIQUE constraints на is_current = TRUE
- [ ] Foreign keys configured
- [ ] Indexes created
- [ ] Migration script runs without errors

**Estimated Time:** 15 hours

---

### Step 4: Continue with TASK-002, TASK-003, ...

Follow the detailed task list in `workflow/03_detailed_plan.xml` or `workflow/05_execution_guide.md`.

---

## Appendix

### Detailed Planning Artifacts

All detailed planning artifacts are available in the `workflow/` directory:

- **workflow/execution_log.xml** - Full execution log
- **workflow/01_analysis.xml** - Deep PRD analysis (FR, NFR, Risks, Q&A)
- **workflow/02_strategic_plan.xml** - Strategic plan with 6 epics
- **workflow/03_detailed_plan.xml** - Detailed 69 tasks breakdown
- **workflow/05_master_plan.xml** - Consolidated master plan
- **workflow/05_execution_guide.md** - Developer execution guide
- **workflow/05_summary.xml** - Project summary

### Key Decisions

**Q-001: setup.sh Parameters**
- **Decision:** Interactive flow with prompts
- **Mandatory:** TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_ID, DOMAIN
- **Auto-generated:** POSTGRES_PASSWORD, JWT_SECRET
- **Interactive:** PostgreSQL external access (with IP for UFW), SSL type

**Q-002: Implementation Priority**
- **Decision:** 6-phase sequential roadmap
- **Context:** 1 developer, no deadlines, sequential execution
- **Phases:** Database → Backend → Bot → Web → Admin → Deployment

---

**Document Version:** 1.0
**Last Updated:** 2025-10-09
**Status:** ✅ Planning Complete - Ready for Implementation
