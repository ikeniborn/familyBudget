# Core Functionality - Doc-Sync Pipeline

Детальное описание 7 stages pipeline для синхронизации кода и документации.

---

## Stage 1: Git Diff Analysis

**Цель:** Определить изменённые компоненты из последнего коммита

**Процесс:**
```bash
git diff HEAD~1 --name-only
```

**Категоризация:**
- `backend/app/api/v1/endpoints/*.py` → API endpoints
- `backend/app/models/*.py` → Database models
- `backend/db/migrations/*.py` → Database migrations
- `frontend/web/static/js/**/*.ts` → Frontend modules
- `frontend/web/templates/**/*.html` → Jinja2 templates

**Output:**
```json
{
  "changed_components": [
    {
      "type": "api_endpoint",
      "file": "backend/app/api/v1/endpoints/articles.py",
      "affected_docs": ["docs/architecture/endpoints/articles.yaml"]
    }
  ]
}
```

---

## Stage 2: Code-to-Docs Mapping

**Алгоритм:**
1. Парсинг изменённого файла → extraction компонентов
2. Поиск упоминаний в `architecture_refs` всех скиллов
3. Grep по docs/architecture/ для поиска references
4. Построение dependency graph: code → docs

**Mapping Rules:**

| Code Pattern | Documentation File |
|-------------|-------------------|
| `@router.get("/articles")` | `endpoints/articles.yaml#/routes/0` |
| `class Article(Base)` | `database/dimensions.yaml#/tables/t_d_article` |
| `export function openModal()` | `web/js-modules.yaml#/modules/modalManager` |

---

## Stage 3: Signature Extraction

### 3.1 FastAPI Endpoints

**Метод:** AST parsing декораторов `@router.get/post/put/delete`

**Example:**
```python
@router.get("/articles", response_model=ArticleListResponse)
async def get_articles(
    type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    ...
```

**Extracted:**
```json
{
  "path": "/api/v1/articles",
  "method": "GET",
  "auth": "user",
  "query_params": ["type"],
  "response_model": "ArticleListResponse"
}
```

### 3.2 SQLAlchemy Models

**Метод:** AST parsing class definitions и Column attributes

**Example:**
```python
class Article(Base):
    __tablename__ = "t_d_article"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
```

**Extracted:**
```json
{
  "table": "t_d_article",
  "columns": [
    {"name": "id", "type": "Integer", "nullable": false, "pk": true},
    {"name": "name", "type": "String(255)", "nullable": false}
  ]
}
```

### 3.3 TypeScript Modules

**Метод:** Regex parsing exports (v1.0), AST parsing (planned v1.1)

**Example:**
```typescript
export function openModal(modalId: string): void { ... }
export class ModalManager { ... }
```

**Extracted:**
```json
{
  "module": "modalManager",
  "exports": {
    "functions": ["openModal"],
    "classes": ["ModalManager"]
  }
}
```

---

## Stage 4: Staleness Detection

**Критерии:**
1. **Missing component** - код есть, docs нет (HIGH)
2. **Signature mismatch** - параметры не совпадают (MEDIUM)
3. **Outdated timestamp** - code mtime > docs mtime + 7 days (LOW)
4. **Deprecated component** - docs есть, код удалён (MEDIUM)

**Detection pseudocode:**
```python
if code_signature.path not in docs_content:
    issue = "missing_component" (HIGH)
elif code_signature.query_params != docs_content.query_params:
    issue = "signature_mismatch" (MEDIUM)
elif code_mtime > docs_mtime + 7 days:
    issue = "outdated_timestamp" (LOW)
```

---

## Stage 5: YAML Auto-Update

**Генерация snippets из templates:**

**Template variables:**
- `{path}` - API endpoint path
- `{method}` - HTTP method
- `{auth_level}` - Authentication level
- `{query_params_yaml}` - Query params (formatted)
- `{source_file}` - Source code file
- `{timestamp}` - Detection timestamp

**Generated snippet:**
```yaml
- path: "/api/v1/articles/search"
  method: GET
  auth: user
  description: "TODO: Add description"
  query_params:
    q: "string - search query"
  # Auto-generated on 2026-02-09 19:30:15
  # TODO: Verify response schema
```

---

## Stage 6: User Approval

**Preview flow:**
```
🔍 Doc-Sync found 1 undocumented endpoint:

  ➕ NEW: GET /api/v1/articles/search
     File: backend/app/api/v1/endpoints/articles.py:45
     Docs: docs/architecture/endpoints/articles.yaml

     Preview:
     [YAML snippet]

❓ Apply this update? (yes/no/edit)
```

**Actions:**
- `yes` - Apply update
- `no` - Skip update
- `edit` - Open editor for manual modification

**Safeguards:**
- Backup original YAML before modification
- Rollback on parse errors
- Preserve manual comments

---

## Stage 7: Changelog Generation

**Template:**
```markdown
### 2026-02-09: [Git commit subject]

- **Change:** [Git commit body]
- **Modified files:** [List]
- **Updated documentation:** [List]
- **Components affected:**
  - API endpoints: [List]
  - Database tables: [List]
```

**Significance badges:**
- 🔧 MINOR - Bug fixes, small improvements
- ⭐ MAJOR - New features
- ⚠️ BREAKING - Breaking changes

**Auto-detection:**
- Breaking: `BREAKING CHANGE:` in commit body
- Major: `feat:` in commit subject
- Minor: `fix:`, `docs:`, `refactor:` in commit subject

---

## Implementation Notes

**Performance:**
- Stage 1-2: < 1 second (git operations)
- Stage 3: 2-5 seconds (AST parsing 10-20 files)
- Stage 4: < 1 second (comparison)
- Stage 5: 1-2 seconds (template rendering)
- Stage 6: User-dependent (approval wait)
- Stage 7: < 1 second (markdown generation)

**Total:** ~5-10 seconds + user approval time

**Error handling:**
- AST parse errors → fallback to regex
- YAML parse errors → skip file, log warning
- Git errors → exit with error message
- Template errors → use default template
