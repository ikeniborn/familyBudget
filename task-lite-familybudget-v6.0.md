# Task Execution v6.0 - Family Budget Edition

**Назначение:** Адаптивный workflow для Family Budget проекта с SGR + Structured Output и lazy-loading skills

**Проект:** Family Budget - семейный бюджет с Telegram bot и PWA (FastAPI + PostgreSQL + HTMX + TypeScript)

---

## Задачи

Опишите задачу здесь.

**ОБЯЗАТЕЛЬНЫЕ ТРЕБОВАНИЯ ПРИ ЛЮБОЙ ЗАДАЧЕ:**

1. **📚 Pre-flight:** Изучить `/docs/architecture` перед началом изменений
2. **📝 Logging:** Всегда добавлять полное логирование:
   - Frontend: `console.log('[PREFIX]', ...)` в браузерной консоли
   - Backend: `logger.info(f"[PREFIX] ...")` в uvicorn логах
3. **🔍 Self-review:** После подготовки плана проанализировать результаты повторно:
   - Шаг за шагом проверить логику
   - Найти проблемные места и неточности
   - Скорректировать план при необходимости
4. **💡 Best practices:** Применять эффективные паттерны разработки и оптимизации
5. **❓ Clarification:** При планировании задавать вопросы для уточнения контекста
6. **📖 Documentation:** После всех изменений актуализировать `/docs/architecture`
7. **💾 Finalization:** По завершению обязательно коммит и пуш

---

## Execution Flow

### Data Flow
```
PHASE 0 → {project_context, complexity}
        ↓
PHASE 1 → {task_plan, execution_mode_recommendation}
        ↓
PHASE 2 → {approval} [conditional]
        ↓
PHASE 3 → [MODE SELECTION]
        ├─ Standard: {execution_results}
        └─ Ralph-Loop: {execution_results, iteration_count}
        ↓
PHASE 4 → {validation_results}
        ↓
PHASE 5 → {git_result}
```

---

### PHASE 0: Context & Complexity

**Skills:**
- `@skill:context-awareness` → {project_context}
- `@skill:adaptive-workflow` → {complexity, workflow_mode}

**Complexity levels:** minimal | standard | complex

**Project Context Detection:**
```json
{
  "project_type": "family_budget",
  "backend": "FastAPI 0.121.2 + PostgreSQL 16",
  "frontend": "HTMX + Tailwind CSS + DaisyUI + TypeScript",
  "build_system": "Vite 6.0.7",
  "deployment": "Docker Compose",
  "architecture_docs": "/docs/architecture/*.md"
}
```

---

### PHASE 1: Analysis & Planning (COT)

**Thinking:**
- `@skill:thinking-framework → @template:analysis`
- `@skill:thinking-framework → @template:decision` [if needed]

**Planning:**
- `@skill:structured-planning → @template:task-plan-lite` [minimal]
- `@skill:structured-planning → @template:task-plan` [standard/complex]

**Pre-planning checklist:**
1. ✅ Read relevant files from `/docs/architecture`
2. ✅ Identify affected components (backend/frontend/database)
3. ✅ Plan logging points (console + backend)
4. ✅ Identify validation commands
5. ✅ List files needing documentation updates

**Output:** {task_plan, execution_mode_recommendation}

---

### PHASE 2: Approval

**Conditional:** Skip for minimal complexity

**Skill:** `@skill:approval-gates → @template:approval-lite`

**Questions to clarify:**
- Backend/Frontend/Both?
- Database migrations needed?
- WebSocket events affected?
- Breaking changes expected?
- Testing strategy (manual/automated)?

**Output:** {approval} → yes/no/modify

---

### PHASE 3: Execution

**Mode Selection:**

Determine execution mode based on task characteristics:

**Decision Criteria:**
- Has automatic validation? (tests, linting, build, type-check)
- Multiple iterations expected? (>2 refinements)
- Completion detectable via validation output?
- Complexity = complex OR execution_steps > 5?

---

**Mode A: Standard Execution** (default)

**Execute:** task_plan.execution_steps

**Project-specific commands:**
```bash
# Backend validation
ruff check backend/                    # Linting
mypy backend/                          # Type checking
pytest                                 # Unit tests
pytest -m integration                  # Integration tests

# Frontend validation
npm run type-check                     # TypeScript
npm run build                          # Vite build
node --check <file.js>                 # Syntax check

# Database
alembic revision --autogenerate        # Create migration
alembic upgrade head                   # Apply migrations

# Deployment
docker compose ps                      # Check containers
docker compose logs backend            # Check logs
```

**Review:** `@skill:code-review` [if complexity != minimal]

**Output:** {execution_results}

---

**Mode B: Ralph-Loop Execution** (conditional)

**Trigger Conditions:**
- Automatic validation available (tests/linting/build/type-check)
- Multiple iterations expected (refinement task)
- Clear completion promise detectable via validation
- Complexity = complex OR execution_steps > 5

**Setup:**
1. Confirm with user: "This task benefits from ralph-loop. Proceed?"
2. Define completion promise from validation output
3. Set max iterations (default: 20-50 based on complexity)

**Command:**
```bash
/ralph-loop "{task_plan.task_name}" \
  --completion-promise "{promise}" \
  --max-iterations {N}
```

**Loop Workflow:**
```
ITERATION N:
├─ Execute execution_steps[]
├─ Run validation command
├─ Check completion promise in validation output
│  ├─ Found → Claude outputs completion promise text → EXIT LOOP
│  └─ Not found → Continue to next iteration
└─ Claude sees previous work in files/git → Self-corrects
```

**Important:** Claude outputs completion promise text directly (not wrapped in tags) when condition is completely TRUE.

**Exit Conditions:**
- Completion promise detected in validation output
- Max iterations reached
- Manual cancellation via `/cancel-ralph`

**Output:** {execution_results, iteration_count}

---

### PHASE 4: Validation

**Skills:**
- `@skill:validation-framework → @template:validation-lite` [minimal]
- `@skill:validation-framework → @template:validation-full` [standard/complex]

**Project-specific validation checklist:**

**Backend changes:**
- [ ] `ruff check backend/` → No errors
- [ ] `pytest` → All passed
- [ ] Alembic migration created (if DB schema changed)
- [ ] Backend logs checked (docker compose logs backend)
- [ ] API endpoints tested (curl/httpie)

**Frontend changes:**
- [ ] `npm run type-check` → Found 0 errors
- [ ] `npm run build` → Build complete
- [ ] Browser console → No errors
- [ ] Manual UI testing → Works as expected
- [ ] Service Worker updated (if static files changed)

**Database changes:**
- [ ] Migration tested (alembic upgrade head)
- [ ] Rollback tested (alembic downgrade -1)
- [ ] Data integrity verified (SQL queries)

**Deployment:**
- [ ] `docker compose ps` → All containers healthy
- [ ] Health check → `curl http://localhost:8000/health`
- [ ] Logs clean → No errors/warnings

**Documentation:**
- [ ] `/docs/architecture` updated with changes
- [ ] CLAUDE.md updated (if new patterns added)
- [ ] README.md updated (if user-facing changes)

**On FAILED:**
- `@skill:error-handling` (retry max 2)
- `@skill:rollback-recovery` (if exhausted)

**Output:** {validation_results} → PASSED/FAILED

---

### PHASE 5: Finalization

**Skills:**
- `@skill:git-workflow → @template:commit`
- `@skill:git-workflow → @template:task-summary`

**Commit message format (Conventional Commits):**
```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Types:** feat | fix | refactor | docs | test | chore | perf

**Scopes:** backend | frontend | db | deployment | docs

**Post-commit actions:**
```bash
git push origin test                   # Push to test branch
# If approved → merge to main
```

**Output:** {git_result} + summary

---

## Error Handling

**Skill:** `@skill:error-handling`

| Error Type | Action | Max Retries | Notes |
|------------|--------|-------------|-------|
| SYNTAX_ERROR | BLOCKING, fix immediately | 2 | |
| TYPE_ERROR | BLOCKING, fix immediately | 2 | TypeScript/mypy errors |
| VALIDATION_FAILED | RETRY | 2 | Tests/linting failed |
| MIGRATION_FAILED | STOP, rollback | 0 | Alembic error |
| BUILD_FAILED | RETRY | 2 | npm run build error |
| PRD_CONFLICT | ASK user | 0 | |
| APPROVAL_REJECTED | STOP | 0 | |
| GIT_FAILED | STOP | 0 | |
| RALPH_MAX_ITERATIONS | STOP, report progress | 0 | Ralph-loop exhausted |
| RALPH_STUCK_LOOP | Cancel ralph, ASK user | 0 | Same error 3+ iterations |

**On retry exhaustion:**
**Skill:** `@skill:rollback-recovery`

**Rollback strategy:**
```bash
# Git rollback
git reset --hard HEAD~1

# Database rollback
alembic downgrade -1

# Docker rollback
docker compose down
docker compose up -d
```

---

## Skills & Plugins Reference

### Workflow Skills (Universal)

| Tool | Type | Phase | Purpose |
|------|------|-------|---------|
| context-awareness | Skill | 0 | Detect project context |
| adaptive-workflow | Skill | 0 | Determine complexity |
| thinking-framework | Skill | 1 | COT reasoning |
| structured-planning | Skill | 1 | Create task plan |
| approval-gates | Skill | 2 | User approval [conditional] |
| ralph-loop | Plugin | 3 | Iterative execution [conditional] |
| code-review | Skill | 3 | Quality checks [conditional] |
| validation-framework | Skill | 4 | Verify acceptance criteria |
| error-handling | Skill | 4 | Handle failures |
| rollback-recovery | Skill | 4 | Rollback on errors |
| git-workflow | Skill | 5 | Commit + summary |

### Domain Skills (Family Budget Specific)

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| api-development | REST API endpoints creation | Adding new API routes |
| authentication-security | JWT, OAuth, WebAuthn | Auth features |
| bot-development | Telegram bot commands | Bot functionality |
| db-management | Migrations, SCD Type 2, Closure Table | Database changes |
| deployment | Docker, nginx, certbot | Deployment tasks |
| frontend-development | HTMX + Tailwind + DaisyUI + WebSocket | UI components |
| monitoring | Logs, diagnostics, troubleshooting | Debug issues |
| testing | pytest, playwright, integration tests | Test creation |
| websocket-realtime | WebSocket events, SSE, Redis Pub/Sub | Real-time features |
| advanced-patterns | SCD Type 2, Closure Table, transfers | Complex DB patterns |

---

## Key Principles

**SGR (Structured Generation & Reasoning):**
- Thinking (hidden COT) → Structured Output (JSON)
- Each phase produces structured data
- Chain: thinking → plan → execute → validate → commit

**Data Flow:**
- PHASE N output → PHASE N+1 input
- Dependencies: validation uses task_plan.acceptance_criteria
- Adaptive: complexity drives workflow mode

**Lazy Loading:**
- minimal: 7 workflow skills (~300 lines from skills)
- standard: 9 workflow skills + 1-2 domain skills (~500 lines)
- complex: 10 workflow skills + 3-5 domain skills (~800 lines)

**Family Budget Specifics:**
- Always check /docs/architecture before changes
- Add logging prefixes: `[AUTH]`, `[WS_BULK]`, `[DEDUP]`, `[SW_UPDATE]`, etc.
- Preserve SCD Type 1 + History pattern for database changes
- Follow TypeScript hybrid approach (.ts in dev, .js in prod)
- Use Vite for builds (not manual minification)
- Test on budget-test server before production

---

## Ralph-Loop Integration Examples

### Example 1: Fix TypeScript Errors (Ralph-Loop)

**Task:** "Fix all TypeScript compilation errors in frontend"

**Mode Selection:**
- ✓ Automatic validation: `npm run type-check`
- ✓ Iterations expected: Unknown (could be many)
- ✓ Completion detectable: "Found 0 errors" in output
- ✓ Complexity: standard/complex
- → **Recommend ralph-loop**

**Command:**
```bash
/ralph-loop "Fix all TypeScript compilation errors in frontend" \
  --completion-promise "Found 0 errors" \
  --max-iterations 30
```

**Loop Behavior:**
```
Iteration 1: Fix 8 errors → npm run type-check → Found 15 errors → Continue
Iteration 2: Fix 10 errors → npm run type-check → Found 5 errors → Continue
Iteration 3: Fix 5 errors → npm run type-check → Found 0 errors → Output promise → EXIT
```

---

### Example 2: Add Shopping List Endpoint (Standard)

**Task:** "Add GET /api/v1/shopping-lists endpoint with pagination"

**Mode Selection:**
- ✗ Single-pass task (create file, write code, test manually)
- ✗ Manual verification needed (curl testing)
- → **Use standard execution**

**Workflow:**
```
Phase 1: Planning
  - Read docs/architecture/endpoints/shopping-lists.md
  - Plan logging points ([API_LISTS])
  - Identify validation (pytest, curl)

Phase 3: Execution
  1. Create backend/app/api/v1/shopping_lists.py ✓
  2. Add route to main.py ✓
  3. Create test_shopping_lists.py ✓
  4. Add logging ✓

Phase 4: Validation
  - pytest → All passed ✓
  - curl http://localhost:8000/api/v1/shopping-lists → 200 OK ✓
  - Update docs/architecture/endpoints/shopping-lists.md ✓
```

---

### Example 3: Migrate Module to TypeScript (Ralph-Loop)

**Task:** "Migrate offlineManager.js to TypeScript with full type coverage"

**Mode Selection:**
- ✓ Automatic validation: `npm run type-check && npm run build`
- ✓ Iterations expected: Many type errors to fix
- ✓ Completion detectable: "Found 0 errors" + "build complete"
- ✓ Complexity: complex
- → **Recommend ralph-loop**

**Command:**
```bash
/ralph-loop "Migrate offlineManager to TypeScript with zero errors" \
  --completion-promise "Found 0 errors" \
  --max-iterations 40
```

**Loop Behavior:**
```
Iteration 1: Rename .js → .ts, add basic types → type-check → 47 errors → Continue
Iteration 2: Fix Promise types → type-check → 32 errors → Continue
Iteration 3: Fix IndexedDB types → type-check → 18 errors → Continue
...
Iteration 8: Fix last any types → type-check → 0 errors → build → Success → EXIT
```

---

### Example 4: Fix Backend Linting (Ralph-Loop)

**Task:** "Fix all ruff linting errors in backend/"

**Mode Selection:**
- ✓ Automatic validation: `ruff check backend/`
- ✓ Iterations expected: Multiple files affected
- ✓ Completion detectable: "All checks passed!"
- ✓ Complexity: standard
- → **Recommend ralph-loop**

**Command:**
```bash
/ralph-loop "Fix all ruff linting errors in backend" \
  --completion-promise "All checks passed!" \
  --max-iterations 20
```

**Loop Behavior:**
```
Iteration 1: Fix imports → ruff check → 23 errors → Continue
Iteration 2: Fix line length → ruff check → 9 errors → Continue
Iteration 3: Fix unused vars → ruff check → All checks passed! → EXIT
```

---

## Project-Specific Completion Promises

**TypeScript:**
```
"Found 0 errors"
```

**Vite Build:**
```
"build complete in"
```

**Backend Tests:**
```
"passed"
" 0 failed"
```

**Ruff Linting:**
```
"All checks passed!"
```

**Alembic Migration:**
```
"Running upgrade"
```

**Docker Deployment:**
```
"Started"
"Healthy"
```

---

## Testing Workflow

**Budget-test server (CRITICAL):**

```bash
# 1. Connect to test server
ssh budget-test

# 2. Pull latest code
cd ~/familyBudget && git pull origin test

# 3. Deploy with patch mode (fast, 2-5 min)
sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch

# 4. Verify deployment
docker compose ps
curl -s http://localhost:8000/health | jq

# 5. Check logs for errors
docker compose logs -f backend
```

**See:** `/docs/architecture/guides/deployment-troubleshooting.md` for complete guide

---

## Documentation Update Pattern

**After ANY change, update relevant docs:**

```bash
# Architecture docs to check
docs/architecture/README.md           # If new component added
docs/architecture/endpoints/*.yaml    # If API changed
docs/architecture/database/*.yaml     # If schema changed
docs/architecture/*.md               # Relevant feature docs
CLAUDE.md                            # If new pattern added
README.md                            # If user-facing change
```

**Update structure:**
```markdown
## Recent Changes

### YYYY-MM-DD: Feature Name (vX.Y.Z)
- **Change:** What changed
- **Problem:** What issue was solved
- **Solution:** How it was solved
- **Impact:** Performance/UX improvements
- **Files Modified:** List of files
- **Testing:** How to test
- **Commits:** git hash
```

---

## Logging Prefix Standards

**Use consistent prefixes for easy log filtering:**

| Prefix | Component | Example |
|--------|-----------|---------|
| `[AUTH]` | Authentication | `[AUTH] Email login successful` |
| `[AUTH_WEBAUTHN]` | WebAuthn | `[AUTH_WEBAUTHN] Credential verified` |
| `[WS_BULK]` | WebSocket bulk events | `[WS_BULK] Broadcasting 50 fact deletions` |
| `[DEDUP]` | Deduplication | `[DEDUP] Call #3 waiting for lock` |
| `[SW_UPDATE]` | Service Worker | `[SW_UPDATE] New version detected: v20260107` |
| `[RECURRING_PLAN]` | Recurring plans | `[RECURRING_PLAN] Creating payment for Jan 2026` |
| `[BULK_DELETE]` | Bulk operations | `[BULK_DELETE] Deleted 100 records in 2.3s` |
| `[NAV]` | Navigation | `[NAV] Detected navigation to /facts` |
| `[RTT_FILTER]` | RTT filtering | `[RTT_FILTER] Skipping event (duplicate)` |

**Example usage:**

**Frontend:**
```javascript
console.log('[WS_BULK] Received batch delete event:', data);
```

**Backend:**
```python
logger.info(f"[BULK_DELETE] Deleting {len(ids)} records")
```

---

## Emergency Rollback

**If something breaks in production:**

```bash
# 1. SSH to server
ssh budget-prod

# 2. Check logs
docker compose logs backend --tail 100

# 3. Rollback to previous version
cd ~/familyBudget
git log --oneline -5                  # Find previous commit
git reset --hard <commit_hash>
sudo bash deploy.sh --patch

# 4. Database rollback (if needed)
docker compose exec postgres psql -U familybudget -d familybudget
# Inside psql:
# \c familybudget
# SELECT version_num FROM alembic_version;
# Exit psql
docker compose exec backend alembic downgrade <previous_version>

# 5. Verify
curl http://localhost:8000/health
docker compose logs backend
```

---

## Summary

**This template provides:**
- ✅ Adaptive workflow (minimal/standard/complex)
- ✅ Ralph-loop integration for iterative tasks
- ✅ Family Budget specific validation commands
- ✅ Project-specific skills (workflow + domain)
- ✅ Comprehensive error handling
- ✅ Documentation update patterns
- ✅ Testing workflow for budget-test server
- ✅ Logging prefix standards
- ✅ Emergency rollback procedures

**Always remember:**
1. Read `/docs/architecture` before starting
2. Add comprehensive logging
3. Self-review plans before execution
4. Update documentation after changes
5. Commit and push when complete

---

**Version:** 6.0
**Last Updated:** 2026-01-08
**Maintainer:** Family Budget Team
