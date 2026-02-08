---
name: test-code
description: Автоматизация тестирования изменений (syntax, quality, runtime, dependencies, e2e) с адаптивным выбором тестов на основе git diff
version: 1.0.0
author: Family Budget Team
tags:
  - testing
  - validation
  - quality-assurance
  - automation
dependencies:
  - thinking-framework
  - context-awareness
  - error-handling
  - git-workflow
architecture_refs:
  - $ref: ../../docs/architecture/operations/deployment-troubleshooting.md
  - $ref: ../_shared/validation-logic.md
  - $ref: ../_shared/syntax-commands.json
user-invocable: false
---

# Test Code - Comprehensive Testing Framework

Навык для комплексного тестирования изменений в проекте Family Budget с 7-stage testing pipeline, адаптивным выбором тестов на основе git diff анализа, интерактивными auto-fix proposals и TOON optimization для больших test suites.

---

## When to Use

**PHASE 4 (Validation)** - после code execution, перед git commit.

**Используйте test-code когда:**
- ✅ Завершили разработку feature/fix
- ✅ Готовы к validation перед commit
- ✅ Нужен полный coverage analysis (syntax → quality → runtime → e2e)
- ✅ Хотите автоматически обнаружить и исправить type errors, linting issues, failing tests

**НЕ используйте когда:**
- ❌ Trivial changes (typo fix, comment update)
- ❌ Work in progress (code не готов к тестированию)
- ❌ Хотите запустить только один вид тестов (используйте pytest/vitest напрямую)

**Workflow integration:**
```
PHASE 3: Execution → Code changes complete
   ↓
PHASE 4: Validation → @skill:test-code
   ↓ (if passed)
PHASE 5A: Git commit
   ↓ (if failed)
@skill:error-handling OR @skill:rollback-recovery
```

---

## Documentation

**Navigation layer** - все детали в отдельных файлах.

### Core Documentation

| Document | Purpose | File |
|----------|---------|------|
| **Pipeline Stages** | Описание всех 7 stages (Context Detection → Auto-fix) | `@doc:pipeline-stages` |
| **Adaptive Testing** | Git diff analysis, test selection logic, duration estimates | `@doc:adaptive-testing` |
| **Output Format** | JSON структура, TOON format, token savings | `@doc:output-format` |
| **Integration** | Input/output dependencies, workflow integration | `@doc:integration` |

**Reference:** `docs/` directory

---

### Templates

| Template | Purpose | File |
|----------|---------|------|
| **test-input** | Input template для git diff context и test categories | `@template:test-input` |
| **test-output** | Output template для test results с TOON support | `@template:test-output` |
| **autofix-proposal** | Template для auto-fix proposals | `@template:autofix-proposal` |

**Reference:** `templates/` directory

---

### Schemas

| Schema | Purpose | File |
|--------|---------|------|
| **test-input** | JSON Schema для валидации test-input.json | `@schema:test-input` |
| **test-output** | JSON Schema для валидации test-output.json | `@schema:test-output` |
| **autofix-proposal** | JSON Schema для валидации autofix-proposal.json | `@schema:autofix-proposal` |

**Reference:** `schemas/` directory

---

### Examples

| Example | Scenario | File |
|---------|----------|------|
| **Backend Validation** | Backend changes validation workflow (pytest + e2e) | `@example:backend-validation` |
| **Frontend Validation** | Frontend changes validation workflow (vitest + e2e) | `@example:frontend-validation` |
| **E2E Validation** | E2E testing workflow (Playwright, always runs) | `@example:e2e-validation` |
| **Failing Tests Fix** | Fixing 28 known failing tests с auto-fix proposals | `@example:failing-tests-fix` |

**Reference:** `examples/` directory

---

### Rules

| Document | Purpose | File |
|----------|---------|------|
| **Best Practices** | Testing strategies, coverage thresholds, common pitfalls, performance tips | `@rules:best-practices` |

**Reference:** `rules/` directory

---

## Quick Reference

### 7-Stage Pipeline

1. **Context Detection** - Git diff analysis → test selection
2. **Syntax Validation** - Python, TypeScript, JSON, YAML
3. **Quality Checks** - ruff, mypy, eslint, black
4. **Runtime Testing** - pytest, vitest (coverage thresholds)
5. **Dependency Validation** - lockfile, security audit
6. **E2E Testing** - Playwright (8 tests × 6 browsers, ~5-6 min)
7. **Auto-fix Execution** - Interactive proposals

**Full description:** См. `@doc:pipeline-stages`

---

### Adaptive Testing Logic

| Changes | Tests | Duration |
|---------|-------|----------|
| Backend only | pytest + e2e | 8-10 min |
| Frontend only | vitest + type-check + e2e | 6-8 min |
| Both | pytest + vitest + e2e | 9-11 min |
| Dependencies | lockfile + security + tests | 7-9 min |
| CI/CD | ALL tests | 10-15 min |

**Note:** E2E тесты **ВСЕГДА** запускаются (user requirement)

**Full logic:** См. `@doc:adaptive-testing`

---

### Key Features

**Adaptive Testing:**
- ✅ Git diff analysis → выбор релевантных тестов
- ✅ Backend → pytest + e2e
- ✅ Frontend → vitest + type-check + e2e

**Auto-fix Proposals:**
- ✅ Syntax errors (TypeScript)
- ✅ Linting errors (ruff, eslint)
- ✅ Type checking errors (где поддерживается)
- ✅ Known failing tests (28 tests в conftest.py)

**TOON Optimization:**
- ✅ 40-50% token savings для >= 5 test results
- ✅ Автоматическая генерация TOON format

**Coverage Thresholds:**
- ✅ Backend: 30.0% lines
- ✅ Frontend: 4.0% lines, 32.0% functions

---

## Integration

**Input Dependencies:**
- `thinking-framework` - Analysis thinking для test strategy
- `context-awareness` - Project context (tools, frameworks)
- `git-workflow` - Git diff context

**Output Consumers:**
- `error-handling` - Critical test failures
- `rollback-recovery` - Откат при failed validation
- `git-workflow` - Commit fixes после auto-fix
- `User` - Review results + approve auto-fixes

**Full integration:** См. `@doc:integration`

---

## Version History

### v1.0.0 (2026-02-08)

- ✅ Initial release
- ✅ 7-stage testing pipeline
- ✅ Adaptive testing на основе git diff
- ✅ Interactive auto-fix proposals
- ✅ TOON format support (40-50% token savings)
- ✅ E2E always enabled (user requirement)
- ✅ Known failing tests detection (28 tests)
- ✅ Documentation decomposition (pipeline-stages, adaptive-testing, output-format, integration)

---

**Author:** Family Budget Team
**License:** MIT
**Support:** См. `examples/` для real-world scenarios, `rules/best-practices.md` для testing strategies
