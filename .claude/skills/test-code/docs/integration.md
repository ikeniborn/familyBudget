# Integration Points

Интеграция test-code skill с другими навыками и workflow.

---

## Input Dependencies

### 1. thinking-framework

**Purpose:** Analysis thinking для test strategy selection

**When:** STAGE 0 (Context Detection) - определение какие тесты запускать

**Example:**
```
Question: Should we run E2E tests if only backend changed?
Answer: Yes (always per requirements)
```

**Integration:**
```
@skill:thinking-framework → analysis thinking
   ↓
@skill:test-code → STAGE 0 (uses reasoning for test selection)
```

---

### 2. context-awareness

**Purpose:** Project context (language, frameworks, testing tools)

**When:** STAGE 0 (Context Detection) - определение доступных test runners

**Example:**
```
Project context:
- Language: Python 3.11, TypeScript 5.3
- Frameworks: FastAPI, HTMX
- Testing tools: pytest, vitest, Playwright
```

**Integration:**
```
@skill:context-awareness → project_context
   ↓
@skill:test-code → STAGE 0 (adapts tests to project tools)
```

---

### 3. git-workflow

**Purpose:** Git diff context для adaptive testing

**When:** STAGE 0 (Context Detection) - анализ git diff --name-only

**Example:**
```bash
git diff --name-only HEAD
> backend/app/api/v1/endpoints/articles.py
```

**Integration:**
```
@skill:git-workflow → git diff context
   ↓
@skill:test-code → STAGE 0 (selects pytest + e2e)
```

---

## Output Consumers

### 1. error-handling

**Purpose:** Обработка критических test failures

**When:** STAGE 6 (Result Analysis) - если status == "failed"

**Example:**
```
test-code status: failed (E2E tests failed)
   ↓
@skill:error-handling → trigger rollback-recovery
```

**Integration:**
```
@skill:test-code → {test_results: {status: "failed"}}
   ↓
@skill:error-handling → handle failure scenario
```

---

### 2. rollback-recovery

**Purpose:** Откат изменений при failed validation

**When:** Critical failures (coverage drop, E2E failures, security vulnerabilities)

**Example:**
```
test-code: Coverage dropped from 45% to 28%
   ↓
@skill:rollback-recovery → git restore changes
```

**Integration:**
```
@skill:test-code → {critical_issues: ["Coverage drop"]}
   ↓
@skill:rollback-recovery → rollback changes
```

---

### 3. git-workflow

**Purpose:** Commit fixes после auto-fix execution

**When:** STAGE 7 (Auto-fix Execution) - после успешного auto-fix

**Example:**
```
test-code: Applied ruff --fix (2 fixes)
   ↓
@skill:git-workflow → commit with message "fix: apply ruff auto-fix"
```

**Integration:**
```
@skill:test-code → STAGE 7 (auto-fix applied)
   ↓
@skill:git-workflow → git commit -m "fix: apply ruff auto-fix"
```

---

### 4. User

**Purpose:** Review test results + approve auto-fixes

**When:** STAGE 6 (Result Analysis) + STAGE 7 (Auto-fix Execution)

**Example:**
```
test-code: Show test summary
   ↓
User: Approves ruff --fix
   ↓
test-code: Apply fix
```

**Integration:**
```
@skill:test-code → {test_results, autofix_proposals}
   ↓
User → Review + Approve
   ↓
@skill:test-code → Execute auto-fixes
```

---

## Workflow Integration Example

```
PHASE 4: Validation
   ↓
@skill:test-code
   ├─ STAGE 0: Context Detection
   │    └─ Input: @skill:git-workflow (git diff)
   │    └─ Input: @skill:context-awareness (project context)
   ├─ STAGE 1-5: Execute tests
   ├─ STAGE 6: Result Analysis
   │    └─ Output: {test_results} → if failed → @skill:error-handling
   └─ STAGE 7: Auto-fix Execution
        └─ Output: {fixes_applied} → @skill:git-workflow (commit fixes)
        └─ Output: {rollback_needed} → @skill:rollback-recovery
```

---

## Data Flow

### Input Flow

```
PHASE 0 (Context Awareness)
   ↓
{project_context} → test-code STAGE 0
   ↓
PHASE 1 (Planning)
   ↓
{task_plan} → test-code (знает какие файлы изменены)
   ↓
PHASE 3 (Execution)
   ↓
{code_changes} → test-code STAGE 0 (git diff analysis)
```

### Output Flow

```
test-code STAGE 6 (Result Analysis)
   ↓
{test_results: {
  status: "failed",
  critical_issues: [...],
  autofix_proposals: [...]
}}
   ↓
User Review → Approval
   ↓
test-code STAGE 7 (Auto-fix)
   ↓
{fixes_applied} → git-workflow (commit)
```

---

## Dependencies Matrix

| Skill | Provides to test-code | Consumes from test-code |
|-------|----------------------|-------------------------|
| **thinking-framework** | Analysis thinking | - |
| **context-awareness** | Project context | - |
| **git-workflow** | Git diff context | Commit fixes |
| **error-handling** | - | Critical failures |
| **rollback-recovery** | - | Rollback triggers |
| **User** | Approval decisions | Test results + proposals |

---

## Execution Order

1. **Pre-execution:**
   - context-awareness → Detect project tools
   - thinking-framework → Analyze test strategy
   - git-workflow → Provide git diff

2. **Execution:**
   - test-code → Run all 7 stages

3. **Post-execution:**
   - User → Review results + approve auto-fixes
   - git-workflow → Commit fixes (if applied)
   - error-handling → Handle failures (if any)
   - rollback-recovery → Rollback changes (if critical)
