---
name: doc-sync
description: Автоматическая синхронизация кода и документации с обнаружением устаревших файлов и генерацией updates
version: 1.0.0
author: Family Budget Team
tags: [documentation, sync, validation, automation, yaml, ast-parsing]
dependencies: [git-workflow, context-awareness, thinking-framework]
architecture_refs:
  - $ref: ../../docs/architecture/README.md
  - $ref: ../../docs/architecture/guides/change-checklist.yaml
  - $ref: ../_shared/architecture-refs.yaml
user-invocable: true
context: fork
changelog:
  - version: 1.0.0
    date: 2026-02-09
    changes:
      - "Initial release"
      - "Git diff analysis → component detection"
      - "Code-to-docs mapping via architecture_refs"
      - "AST parsing for API endpoints and database models"
      - "YAML auto-update with preview"
      - "Changelog generation for docs/architecture/README.md"
---

# Doc-Sync - Documentation Synchronization Skill

Автоматизирует синхронизацию кода и документации в проекте Family Budget с обнаружением устаревших файлов, валидацией соответствия code ↔ docs и генерацией обновлений.

---

## When to Use

**PHASE 5C (Documentation + Summary)** - после git commit, перед завершением задачи.

**Используйте doc-sync когда:**
- ✅ Завершили feature/fix с изменениями в коде
- ✅ Изменили API endpoints, database schema, frontend components
- ✅ Хотите проверить соответствие code ↔ docs
- ✅ Готовы к автоматическому обновлению YAML документации

**НЕ используйте когда:**
- ❌ Trivial changes (typo fix, comment update)
- ❌ Только изменения в документации (без code changes)
- ❌ Work in progress (код не готов к документированию)

**Workflow integration:**
```
PHASE 5A: Git commit → @skill:git-workflow
   ↓
PHASE 5C: Documentation → @skill:doc-sync
   ↓ (if docs updated)
PHASE 5C: Commit docs → @skill:git-workflow [docs only]
   ↓
PHASE 5B: PR automation → @skill:pr-automation
```

---

## Core Functionality

### 1. Git Diff Analysis
**Цель:** Определить изменённые компоненты из последнего коммита

**Процесс:**
```bash
# Получить изменённые файлы
git diff HEAD~1 --name-only

# Категоризация изменений:
- backend/app/api/v1/endpoints/*.py → API endpoints
- backend/app/models/*.py → Database models
- backend/db/migrations/*.py → Database migrations
- frontend/web/static/js/**/*.ts → Frontend modules
- frontend/web/templates/**/*.html → Jinja2 templates
```

**Output:**
```json
{
  "changed_components": [
    {
      "type": "api_endpoint",
      "file": "backend/app/api/v1/endpoints/articles.py",
      "affected_docs": [
        "docs/architecture/endpoints/articles.yaml",
        "docs/architecture/functionality/budget-management.yaml"
      ]
    },
    {
      "type": "database_model",
      "file": "backend/app/models/article.py",
      "affected_docs": [
        "docs/architecture/database/dimensions.yaml"
      ]
    }
  ]
}
```

---

### 2. Code-to-Docs Mapping
**Цель:** Найти связанную документацию через architecture_refs

**Алгоритм:**
1. Парсинг изменённого файла → extraction компонентов (classes, functions, routes)
2. Поиск упоминаний в `architecture_refs` всех скиллов
3. Grep по docs/architecture/ для поиска references
4. Построение dependency graph: code → docs

**Mapping Rules:**

| Code Pattern | Documentation File | Extraction Method |
|-------------|-------------------|-------------------|
| `@router.get("/articles")` | `endpoints/articles.yaml#/routes/0` | FastAPI decorator parsing |
| `class Article(Base)` | `database/dimensions.yaml#/tables/t_d_article` | SQLAlchemy model parsing |
| `export function openModal()` | `web/js-modules.yaml#/modules/modalManager` | TypeScript export parsing |
| `{% extends "base.html" %}` | `web/templates.yaml#/templates/articles` | Jinja2 template parsing |

---

### 3. Code Signature Extraction

**3.1 API Endpoints (FastAPI)**

**Метод:** AST parsing декораторов `@router.get/post/put/delete`

**Extracted fields:**
```python
# Source: backend/app/api/v1/endpoints/articles.py
@router.get("/articles", response_model=ArticleListResponse)
async def get_articles(
    type: Optional[str] = None,
    parent_id: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    ...

# Extracted signature:
{
  "path": "/api/v1/articles",
  "method": "GET",
  "auth": "user",
  "query_params": ["type", "parent_id"],
  "response_model": "ArticleListResponse",
  "dependencies": ["get_current_user"]
}
```

**Validation против YAML:**
```yaml
# docs/architecture/endpoints/articles.yaml
routes:
  - path: "/api/v1/articles"
    method: GET
    auth: user
    query_params:
      type: "income | expense (optional)"
      parent_id: "integer (optional)"
```

**Check:**
- ✅ Path matches
- ✅ Method matches
- ✅ Auth matches
- ⚠️ Query params documented (check types)

---

**3.2 Database Models (SQLAlchemy)**

**Метод:** AST parsing class definitions и Column attributes

**Extracted fields:**
```python
# Source: backend/app/models/article.py
class Article(Base):
    __tablename__ = "t_d_article"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    type = Column(Enum("income", "expense"), nullable=False)
    parent_id = Column(Integer, ForeignKey("t_d_article.id"))
    is_active = Column(Boolean, default=True)

# Extracted schema:
{
  "table": "t_d_article",
  "columns": [
    {"name": "id", "type": "Integer", "nullable": false, "pk": true},
    {"name": "name", "type": "String(255)", "nullable": false},
    {"name": "type", "type": "Enum", "nullable": false},
    {"name": "parent_id", "type": "Integer", "nullable": true, "fk": "t_d_article.id"},
    {"name": "is_active", "type": "Boolean", "nullable": true, "default": true}
  ]
}
```

**Validation против YAML:**
```yaml
# docs/architecture/database/dimensions.yaml
tables:
  t_d_article:
    columns:
      - name: id
        type: integer
        constraints: [primary_key]
      - name: name
        type: varchar(255)
        constraints: [not_null]
```

**Check:**
- ✅ Table name matches
- ✅ Columns present
- ⚠️ Column types match (Integer vs integer)
- ⚠️ Constraints documented

---

**3.3 Frontend Modules (TypeScript)**

**Метод:** TypeScript AST parsing exports

**Extracted fields:**
```typescript
// Source: frontend/web/static/js/modals/modalManager.ts
export function openModal(modalId: string): void {
    ...
}

export function closeModal(modalId: string): void {
    ...
}

export interface ModalOptions {
    title: string;
    size: 'sm' | 'md' | 'lg';
}

// Extracted exports:
{
  "module": "modalManager",
  "exports": {
    "functions": ["openModal", "closeModal"],
    "interfaces": ["ModalOptions"]
  }
}
```

**Validation против YAML:**
```yaml
# docs/architecture/web/js-modules.yaml
modules:
  modalManager:
    file: frontend/web/static/js/modals/modalManager.ts
    exports:
      - openModal(modalId: string)
      - closeModal(modalId: string)
```

---

### 4. Staleness Detection

**Критерии устаревания документации:**

1. **Missing component** - компонент в коде, но нет в docs
2. **Signature mismatch** - параметры не совпадают
3. **Outdated description** - Last modified code > Last modified docs
4. **Deprecated component** - компонент в docs, но удалён из кода

**Detection logic:**
```python
def detect_staleness(code_signature, docs_content):
    issues = []

    # Check 1: Missing documentation
    if code_signature.path not in docs_content:
        issues.append({
            "type": "missing_component",
            "severity": "high",
            "message": f"Endpoint {code_signature.path} not documented"
        })

    # Check 2: Signature mismatch
    if code_signature.query_params != docs_content.query_params:
        issues.append({
            "type": "signature_mismatch",
            "severity": "medium",
            "message": "Query params differ",
            "diff": compare_params(code_signature.query_params, docs_content.query_params)
        })

    # Check 3: Outdated timestamp
    if code_mtime > docs_mtime:
        issues.append({
            "type": "outdated",
            "severity": "low",
            "message": f"Code modified {days_ago(code_mtime)} days ago, docs {days_ago(docs_mtime)} days ago"
        })

    return issues
```

---

### 5. YAML Auto-Update

**Генерация YAML snippets для обновления документации:**

**Example: New endpoint detected**

```yaml
# Generated snippet for docs/architecture/endpoints/articles.yaml

# ⚠️ AUTO-GENERATED - Review before commit
# Source: backend/app/api/v1/endpoints/articles.py:45
# Detected: 2026-02-09 19:30:15

routes:
  # ---------------------------------------------------------------------------
  # SEARCH (NEW - Auto-detected)
  # ---------------------------------------------------------------------------
  - path: "/api/v1/articles/search"
    method: GET
    auth: user
    description: "Search articles by query (NEEDS DESCRIPTION)"
    query_params:
      q: "string - search query"
      type: "income | expense (optional)"
    response:
      status: 200
      body:
        articles: "array of article objects"
        total: "integer - total count"
    service:
      $ref: "../functionality/budget-management.yaml#/module/services/1"
    # TODO: Add service reference
    # TODO: Verify response schema
```

**User interaction:**
```
🔍 Doc-Sync found 1 undocumented endpoint:

  ➕ NEW: GET /api/v1/articles/search
     File: backend/app/api/v1/endpoints/articles.py:45
     Docs: docs/architecture/endpoints/articles.yaml

     Preview:
     [Generated YAML snippet above]

❓ Apply this update? (yes/no/edit)
```

---

### 6. Changelog Generation

**Автоматическое обновление docs/architecture/README.md:**

**Template:**
```markdown
## Recent Changes

### 2026-02-09: [Brief description from git commit message]

- **Change:** [Extracted from git diff]
- **Modified files:**
  - [List of changed code files]
- **Updated documentation:**
  - [List of updated YAML files]
- **Components affected:**
  - API endpoints: [List]
  - Database tables: [List]
  - Frontend modules: [List]
```

**Generation logic:**
```python
def generate_changelog_entry(git_commit, changed_components, updated_docs):
    entry = f"### {datetime.now().strftime('%Y-%m-%d')}: {git_commit.subject}\n\n"
    entry += f"- **Change:** {git_commit.body}\n"
    entry += f"- **Modified files:**\n"
    for file in changed_components:
        entry += f"  - {file.path}\n"

    entry += f"- **Updated documentation:**\n"
    for doc in updated_docs:
        entry += f"  - {doc.path}\n"

    # Group by component type
    entry += f"- **Components affected:**\n"
    api_endpoints = [c for c in changed_components if c.type == "api_endpoint"]
    if api_endpoints:
        entry += f"  - API endpoints: {', '.join([c.name for c in api_endpoints])}\n"

    return entry
```

---

## Commands

### Command: sync
**Default command** - запускается автоматически в PHASE 5C

**Usage:**
```
@skill:doc-sync
```

**What It Does:**
1. Анализирует git diff → определяет изменённые компоненты
2. Находит связанную документацию через architecture_refs
3. Извлекает signatures из кода (AST parsing)
4. Валидирует соответствие code ↔ docs
5. Генерирует YAML snippets для обновления
6. Запрашивает подтверждение user (preview + approve)
7. Применяет updates к YAML файлам
8. Обновляет changelog в docs/architecture/README.md
9. Создаёт git commit "docs: sync with code changes"

**Output:**
```json
{
  "analysis": {
    "changed_files": 3,
    "affected_docs": 2,
    "staleness_issues": 1
  },
  "updates": [
    {
      "file": "docs/architecture/endpoints/articles.yaml",
      "action": "add_route",
      "preview": "[YAML snippet]",
      "approved": true
    }
  ],
  "changelog_entry": "[Generated entry]",
  "commit_sha": "abc123..."
}
```

---

### Command: check
**Dry-run mode** - только проверка, без изменений

**Usage:**
```
@skill:doc-sync --check
```

**What It Does:**
1. Анализирует git diff
2. Обнаруживает staleness issues
3. Показывает preview updates (БЕЗ применения)
4. Выводит summary report

**Output:**
```
🔍 Documentation Sync Check

📊 Summary:
  Changed files: 3
  Affected docs: 2

⚠️ Staleness Issues:
  1. Missing component: GET /api/v1/articles/search
     File: docs/architecture/endpoints/articles.yaml

  2. Signature mismatch: POST /api/v1/articles
     Diff: Added query param 'validate_hierarchy'
     File: docs/architecture/endpoints/articles.yaml

💡 Recommendations:
  Run '@skill:doc-sync' to apply updates
```

---

### Command: validate
**Validate ALL documentation** - полная проверка всей документации

**Usage:**
```
@skill:doc-sync --validate
```

**What It Does:**
1. Сканирует весь codebase (не только git diff)
2. Валидирует ВСЕ YAML файлы против кода
3. Обнаруживает deprecated components
4. Генерирует comprehensive report

**Output:**
```
📋 Full Documentation Validation

✅ Valid: 45 components
⚠️ Warnings: 3 components
❌ Errors: 1 component

Errors:
  1. Deprecated component in docs
     Component: GET /api/v1/legacy/stats
     File: docs/architecture/endpoints/analytics.yaml:120
     Issue: Endpoint removed from code in commit abc123

Warnings:
  1. Outdated description
     Component: t_d_article
     File: docs/architecture/database/dimensions.yaml:15
     Issue: Code modified 14 days ago, docs 45 days ago
```

---

## Validation Checklist

**Pre-execution validation:**
- [ ] Git repository clean (no uncommitted changes except docs)
- [ ] architecture_refs.yaml exists and valid
- [ ] docs/architecture/ directory exists

**Post-execution validation:**
- [ ] All updated YAML files valid (yaml.safe_load succeeds)
- [ ] No broken $ref links
- [ ] Changelog entry added to README.md
- [ ] Git commit created with "docs:" prefix

**Code parsing validation:**
- [ ] FastAPI decorators parsed correctly (@router.*)
- [ ] SQLAlchemy models extracted (Column definitions)
- [ ] TypeScript exports detected (export function/class/interface)

**Staleness detection validation:**
- [ ] Missing components detected
- [ ] Signature mismatches reported
- [ ] Deprecated components identified

---

## Safety Rules

**What NOT to do:**
- ❌ NEVER modify code files (только docs)
- ❌ NEVER delete documentation without user confirmation
- ❌ NEVER commit without user approval (preview first)
- ❌ NEVER parse untrusted code (injection risk)
- ❌ NEVER overwrite manual descriptions with auto-generated text

**Safeguards:**
- ✅ Preview mode by default (user approval required)
- ✅ Backup original YAML before modification
- ✅ Rollback on parse errors
- ✅ Preserve manual comments in YAML

---

## Integration

**Input Dependencies:**
- `git-workflow` - Git diff context, commit messages
- `context-awareness` - Project structure, language detection
- `thinking-framework` - Analysis thinking for component mapping

**Output Consumers:**
- `git-workflow` - Commit docs updates
- `pr-automation` - Include docs changes in PR
- `User` - Review and approve updates

**Workflow Position:**
```
PHASE 5A: Code commit
   ↓
PHASE 5C: @skill:doc-sync → Generate updates
   ↓
User approval
   ↓
PHASE 5C: @skill:git-workflow → Commit docs
   ↓
PHASE 5B: @skill:pr-automation → Create PR
```

---

## Version History

### v1.0.0 (2026-02-09)

- ✅ Initial release
- ✅ Git diff analysis → component detection
- ✅ Code-to-docs mapping via architecture_refs
- ✅ AST parsing for FastAPI endpoints
- ✅ AST parsing for SQLAlchemy models
- ✅ AST parsing for TypeScript modules
- ✅ YAML auto-update with preview
- ✅ Changelog generation
- ✅ Staleness detection (missing, mismatch, outdated, deprecated)
- ✅ Three modes: sync, check, validate

---

## Limitations & Future Work

**Current Limitations:**
- ⚠️ Python AST parsing only (no JS/TS AST yet - using regex)
- ⚠️ No support for Jinja2 template validation
- ⚠️ Manual $ref links not auto-updated
- ⚠️ No LSP integration (planned for v2.0)

**Roadmap:**
- 🔜 v1.1: TypeScript AST parsing via ts-morph
- 🔜 v1.2: LSP integration for signature extraction
- 🔜 v1.3: Jinja2 template validation
- 🔜 v2.0: Auto-fix $ref links, TOON format support

---

**Author:** Family Budget Team
**License:** MIT
**Support:** См. `examples/` для real-world scenarios, `rules/best-practices.md` для documentation strategies
