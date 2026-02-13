---
name: doc-explorer
description: Интерактивное изучение документации проекта с guided tours, визуализацией и проверкой понимания
version: 1.1.0
author: Family Budget Team
tags: [documentation, onboarding, learning, interactive, visualization]
dependencies: [context-awareness, architecture-documentation]
architecture_refs:
  - $ref: ../../docs/architecture/README.md
  - $ref: ../../docs/diagrams/README.md
  - $ref: ../_shared/architecture-refs.yaml
user-invocable: true
context: fork
---

# Doc-Explorer - Interactive Documentation Learning

Интерактивный навык для изучения архитектуры проекта Family Budget с guided tours, визуализацией зависимостей и проверкой понимания.

---

## When to Use

**Используйте doc-explorer когда:**
- ✅ Новый разработчик в проекте (onboarding)
- ✅ Нужно разобраться в конкретной фиче
- ✅ Хотите понять data flow от frontend до DB
- ✅ Готовитесь к code review или архитектурному аудиту
- ✅ Нужна визуализация зависимостей

**НЕ используйте когда:**
- ❌ Нужно обновить документацию (используйте @skill:doc-sync)
- ❌ Ищете конкретный файл/функцию (используйте Grep/Glob)

---

## Quick Reference

### Learning Modes

| Mode | Duration | Purpose | Command |
|------|----------|---------|---------|
| **Quick Start** | 5 min | Основы проекта | `@skill:doc-explorer --quick-start` |
| **Feature Deep Dive** | 15-30 min | Детальное изучение фичи | `@skill:doc-explorer --feature <name>` |
| **Component Trace** | 10-20 min | Трассировка data flow | `@skill:doc-explorer --trace <component>` |
| **Architecture Quiz** | 10 min | Проверка понимания | `@skill:doc-explorer --quiz` |
| **Custom Tour** | Variable | Интерактивный тур | `@skill:doc-explorer` |

---

### Quick Start Tour (5 minutes)

**Что изучим:**
1. Tech stack (FastAPI, PostgreSQL, HTMX)
2. Ключевые паттерны (SCD Type 2, Closure Table, Shared Budget)
3. Структура директорий
4. Базовый data flow (создание транзакции)

**Output:**
- Mermaid diagram: System Overview (docs/diagrams/01-system-overview.md)
- Code examples: 3 ключевых файла
- Links: 5 important docs

**Details:** См. `@doc:quick-start-tour`

---

### Feature Deep Dive (15-30 minutes)

**Available features:**
- `transfers` - Transfer deduplication system
- `recurring-plans` - Recurring payments (MMDD encoding)
- `offline-sync` - Offline-first with Dexie.js
- `websocket` - Real-time updates via Redis Pub/Sub
- `authentication` - JWT + Telegram OAuth + WebAuthn

**Interactive flow:**
1. AskUserQuestion: Выбор фичи
2. Load architecture docs (endpoints, database, flows)
3. Show Mermaid diagrams
4. Walk through code examples
5. Quiz: 3-5 questions для проверки

**Details:** См. `@doc:feature-deep-dive`

---

### Component Trace (10-20 minutes)

**Trace options:**
- Frontend → Backend → Database
- API endpoint → Service → Model → DB
- User action → WebSocket → UI update

**Example trace (Transaction creation):**
```
User clicks "Add Transaction"
  ↓
frontend/web/templates/facts/modal.html (HTMX form)
  ↓ hx-post="/api/v1/facts"
backend/app/api/v1/endpoints/facts.py (POST /facts)
  ↓ FactService.create()
backend/app/services/fact_service.py (business logic)
  ↓ session.add(BudgetFact)
backend/app/models/fact.py (SQLAlchemy model)
  ↓ INSERT INTO t_f_budget_fact
PostgreSQL database
  ↓ WebSocket broadcast
backend/app/websocket.py (BudgetConnectionManager)
  ↓ budgetWSClient.handleEvent()
frontend/web/static/js/budgetWSClient.js (update UI)
```

**Interactive visualization:**
- Mermaid sequence diagram
- Code snippets at each step
- Links to documentation

**Details:** См. `@doc:component-trace`

---

### Architecture Quiz (10 minutes)

**Quiz categories:**
- Database schema (SCD Type 2, Closure Table)
- API patterns (Shared Budget, JWT auth)
- Frontend patterns (HTMX, Dexie.js offline)
- Data flows (WebSocket, offline sync)

**Question types:**
- Multiple choice (4 options)
- Code completion (fill in the blank)
- Architecture decision (explain why)

**Scoring:**
- 80%+ - Excellent understanding
- 60-79% - Good, review weak areas
- <60% - Study recommended docs

**Details:** См. `@doc:architecture-quiz`

---

## Documentation

**Navigation layer** - все детали в отдельных файлах.

### Core Documentation

| Document | Purpose | Reference |
|----------|---------|-----------|
| **Quick Start Tour** | 5-minute overview | `@doc:quick-start-tour` |
| **Feature Deep Dive** | Detailed feature learning | `@doc:feature-deep-dive` |
| **Component Trace** | Data flow tracing | `@doc:component-trace` |
| **Architecture Quiz** | Knowledge assessment | `@doc:architecture-quiz` |

**Location:** `docs/` directory

---

### Templates

| Template | Purpose | Reference |
|----------|---------|-----------|
| **tour-template** | Guided tour structure | `@template:tour-template` |
| **quiz-template** | Quiz question format | `@template:quiz-template` |

**Location:** `templates/` directory

---

### Examples

| Example | Scenario | Reference |
|---------|----------|-----------|
| **Onboarding Tour** | New developer first day | `@example:onboarding-tour` |
| **Transfer Feature** | Deep dive into transfers | `@example:transfer-feature` |

**Location:** `examples/` directory

---

### Config

| Config | Purpose | Reference |
|--------|---------|-----------|
| **features** | Available features catalog | `@config:features` |
| **quiz-questions** | Quiz question bank | `@config:quiz-questions` |

**Location:** `config/` directory

---

## Interactive Features

### AskUserQuestion Integration

**Example: Feature selection**
```typescript
AskUserQuestion({
  questions: [{
    question: "Какую фичу хотите изучить?",
    header: "Feature",
    options: [
      {
        label: "Transfers (Recommended)",
        description: "Transfer deduplication with double-entry bookkeeping"
      },
      {
        label: "Recurring Plans",
        description: "MMDD encoding for recurring payments"
      },
      {
        label: "Offline Sync",
        description: "Dexie.js offline-first architecture"
      }
    ]
  }]
})
```

### Mermaid Visualization

**Automatic diagram rendering:**
- Load from `docs/diagrams/*.md`
- Render in-line during tour
- Interactive navigation (click to zoom)

**Available diagrams:**
- System Overview (C4 Context)
- Authentication Flows
- Database Schema (39 tables)
- Data Flows (transactions, offline sync)
- Frontend Architecture
- Backend API layers
- CI/CD Pipeline

---

## Learning Paths

### Path 1: Backend Developer (30 min)

1. Quick Start (5 min)
2. Database Schema tour (10 min)
   - SCD Type 2 pattern
   - Closure Table for hierarchy
3. API Endpoints tour (10 min)
   - Shared Budget model
   - JWT authentication
4. Quiz: Backend fundamentals (5 min)

**Recommendation:** Deep dive into `transfers` or `recurring-plans`

---

### Path 2: Frontend Developer (25 min)

1. Quick Start (5 min)
2. Frontend Architecture tour (10 min)
   - HTMX partial rendering
   - Dexie.js offline storage
   - WebSocket real-time updates
3. Component Trace: Transaction creation (5 min)
4. Quiz: Frontend patterns (5 min)

**Recommendation:** Deep dive into `offline-sync` or `websocket`

---

### Path 3: Full-Stack Onboarding (60 min)

1. Quick Start (5 min)
2. System Overview (10 min)
   - C4 diagram walkthrough
   - Tech stack explanation
3. Feature Deep Dive: Transfers (20 min)
4. Component Trace: Transaction flow (10 min)
5. Database + API tour (10 min)
6. Quiz: Full-stack (5 min)

**Recommendation:** Repeat with different feature

---

## Safety Rules

**What NOT to do:**
- ❌ NEVER execute code during tour (read-only mode)
- ❌ NEVER modify documentation files
- ❌ NEVER skip user questions (interactive learning)

**Best practices:**
- ✅ Start with Quick Start (5 min overview)
- ✅ Use AskUserQuestion for personalization
- ✅ Show Mermaid diagrams before code
- ✅ Link to relevant docs at each step

---

## Integration

**Input Dependencies:**
- `context-awareness` - Project structure detection
- `architecture-documentation` - YAML docs parsing

**Output:**
- Interactive learning experience
- Knowledge assessment results
- Recommended learning paths

**Workflow Position:**
```
New developer joins
   ↓
@skill:doc-explorer --quick-start
   ↓
Choose learning path (backend/frontend/full-stack)
   ↓
Feature deep dives
   ↓
Quiz validation
   ↓
Ready for development!
```

---

## TOON Optimization (v1.1+)

**Экономия токенов** при хранении конфигураций с использованием TOON формата:

**Hybrid Output Format:**
```json
{
  "features": [ /* JSON array untouched for backward compatibility */ ],
  "toon": {
    "features_toon": "features[6]{id,name,category,...}:\ntransfers\tTransfer System\t...",
    "token_savings": "62.2%",
    "json_tokens": 1551,
    "toon_tokens": 586,
    "saved_tokens": 965
  }
}
```

**Преимущества TOON:**
- ✅ **45.0% средняя экономия токенов** (1947 tokens saved)
  - features.json: 965 tokens (62.2% savings)
  - quiz-questions.json: 982 tokens (27.9% savings)
- ✅ **100% backward compatible** (JSON arrays untouched)
- ✅ **Lossless conversion** (round-trip tested)
- ✅ **Automatic generation** (node config/generate-toon.mjs)

**When to Use:**
- Read >= 5 features → Use TOON (62.2% savings)
- Read >= 5 quiz questions → Use TOON (27.9% savings)
- Read < 5 items → Use JSON (TOON overhead не стоит экономии)

**How to Update:**
```bash
cd .claude/skills/doc-explorer
node config/generate-toon.mjs
```

**Configuration:**
- Location: `.claude/skills/doc-explorer/config/`
- Files: features.json, quiz-questions.json
- Format: Hybrid JSON + TOON
- Testing: Round-trip conversion validated

---

## Version History

### v1.1.0 (2026-02-10)
**TOON Optimization:**
- ✅ **Hybrid Output Format**: features.json and quiz-questions.json include TOON representations alongside JSON
- ✅ **Token Savings**: 1947 tokens (45.0% average) reduction in configuration files
- ✅ **Lossless Conversion**: Round-trip tested for data integrity
- ✅ **Backward Compatibility**: JSON arrays remain unchanged, TOON is additive

**Configuration Enhancements:**
- Added generate-toon.mjs script for automatic TOON generation
- Created _shared/toon-utils.mjs for TOON conversion utilities
- Updated metadata versions to 1.1.0

**TOON Coverage:**
- features.json: 6 features, 62.2% token savings
- quiz-questions.json: 16 questions, 27.9% token savings

### v1.0.0 (2026-02-09)

**Features:**
- ✅ Quick Start tour (5 min)
- ✅ Feature Deep Dive (15-30 min)
- ✅ Component Trace (10-20 min)
- ✅ Architecture Quiz (10 min)
- ✅ AskUserQuestion integration
- ✅ Mermaid diagram rendering
- ✅ 3 learning paths (backend/frontend/full-stack)

**Limitations:**
- ⚠️ Static quiz questions (no adaptive difficulty)
- ⚠️ No progress tracking across sessions
- ⚠️ No code execution playground

**Roadmap:**
- 🔜 v1.1: Adaptive quiz difficulty
- 🔜 v1.2: Progress tracking
- 🔜 v1.3: Interactive code examples

---

**Author:** Family Budget Team
**Support:** См. `examples/` для real-world tours, `docs/` для detailed guides
