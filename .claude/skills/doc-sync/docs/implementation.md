# Doc-Sync Implementation Guide

## Architecture

### Component Overview

```
doc-sync/
├── SKILL.md                    # Main specification
├── templates/                  # YAML generation templates
│   ├── endpoint-update.yaml
│   ├── table-update.yaml
│   └── changelog-entry.md
├── examples/                   # Usage examples
│   └── endpoint-sync.md
├── schemas/                    # JSON Schema validation
│   └── sync-output.schema.json
├── docs/                       # Implementation docs
│   └── implementation.md       # This file
└── rules/                      # Best practices
    └── best-practices.md
```

---

## Implementation Phases

### Phase 1: Git Diff Analysis (Week 1)

**Goal:** Parse git diff and categorize changed files

**Implementation:**
```python
import subprocess
from pathlib import Path
from typing import List, Dict

def analyze_git_diff(since_commit: str = "HEAD~1") -> Dict[str, List[str]]:
    """
    Анализирует git diff и категоризирует изменённые файлы.

    Returns:
        {
            "api_endpoints": ["backend/app/api/v1/endpoints/articles.py"],
            "database_models": ["backend/app/models/article.py"],
            "frontend_modules": ["frontend/web/static/js/modals/modalManager.ts"],
            "templates": ["frontend/web/templates/articles/list.html"]
        }
    """
    result = subprocess.run(
        ["git", "diff", since_commit, "--name-only"],
        capture_output=True,
        text=True
    )

    changed_files = result.stdout.strip().split("\n")

    categorized = {
        "api_endpoints": [],
        "database_models": [],
        "frontend_modules": [],
        "templates": [],
        "migrations": []
    }

    for file in changed_files:
        path = Path(file)

        if path.match("backend/app/api/v1/endpoints/*.py"):
            categorized["api_endpoints"].append(file)
        elif path.match("backend/app/models/*.py"):
            categorized["database_models"].append(file)
        elif path.match("frontend/web/static/js/**/*.ts"):
            categorized["frontend_modules"].append(file)
        elif path.match("frontend/web/templates/**/*.html"):
            categorized["templates"].append(file)
        elif path.match("backend/db/migrations/*.py"):
            categorized["migrations"].append(file)

    return categorized
```

**Testing:**
```bash
# Create test commit
git commit -m "test: add sample endpoint"

# Run analysis
python -c "from doc_sync import analyze_git_diff; print(analyze_git_diff())"

# Expected output:
# {
#   "api_endpoints": ["backend/app/api/v1/endpoints/articles.py"],
#   "database_models": [],
#   ...
# }
```

---

### Phase 2: Architecture Refs Mapping (Week 2)

**Goal:** Map changed files → affected documentation via architecture_refs

**Implementation:**
```python
import yaml
from pathlib import Path
from typing import List, Set

def load_architecture_refs() -> Dict[str, List[str]]:
    """
    Загружает architecture_refs из всех скиллов.

    Returns:
        {
            "backend/app/models/article.py": [
                "docs/architecture/database/dimensions.yaml#/tables/t_d_article"
            ],
            "backend/app/api/v1/endpoints/articles.py": [
                "docs/architecture/endpoints/articles.yaml"
            ]
        }
    """
    refs_map = {}
    skills_dir = Path(".claude/skills")

    for skill_md in skills_dir.glob("*/SKILL.md"):
        with open(skill_md, "r") as f:
            content = f.read()

        # Parse YAML frontmatter
        if content.startswith("---"):
            _, frontmatter, _ = content.split("---", 2)
            metadata = yaml.safe_load(frontmatter)

            if "architecture_refs" in metadata:
                # Extract code-to-docs mapping from skill
                # (This is simplified - real implementation needs AST parsing)
                refs_map.update(extract_refs_from_skill(skill_md.parent))

    return refs_map

def find_affected_docs(changed_file: str, refs_map: Dict) -> List[str]:
    """
    Находит затронутые документы для изменённого файла.
    """
    # Direct mapping
    docs = refs_map.get(changed_file, [])

    # Fuzzy matching (e.g., article.py → articles.yaml)
    filename = Path(changed_file).stem
    for doc_path in Path("docs/architecture").rglob("*.yaml"):
        if filename in doc_path.stem:
            docs.append(str(doc_path))

    return list(set(docs))
```

**Testing:**
```python
refs_map = load_architecture_refs()
affected = find_affected_docs("backend/app/api/v1/endpoints/articles.py", refs_map)
assert "docs/architecture/endpoints/articles.yaml" in affected
```

---

### Phase 3: Code Signature Extraction (Week 3-4)

**Goal:** Parse Python/TypeScript code and extract component signatures

**Implementation (FastAPI endpoints):**
```python
import ast
from typing import Optional, List, Dict

class EndpointVisitor(ast.NodeVisitor):
    """
    AST visitor для извлечения FastAPI endpoint signatures.
    """
    def __init__(self):
        self.endpoints = []

    def visit_FunctionDef(self, node):
        """
        Обрабатывает function definitions с декораторами @router.*
        """
        for decorator in node.decorator_list:
            if self.is_router_decorator(decorator):
                endpoint = self.extract_endpoint(node, decorator)
                self.endpoints.append(endpoint)

        self.generic_visit(node)

    def is_router_decorator(self, decorator):
        """
        Проверяет, является ли декоратор router.get/post/put/delete
        """
        if isinstance(decorator, ast.Call):
            if isinstance(decorator.func, ast.Attribute):
                return (decorator.func.value.id == "router" and
                        decorator.func.attr in ["get", "post", "put", "delete"])
        return False

    def extract_endpoint(self, func_node, decorator):
        """
        Извлекает endpoint signature из function definition и decorator.
        """
        # Extract path from decorator
        path = decorator.args[0].s if decorator.args else None

        # Extract HTTP method from decorator name
        method = decorator.func.attr.upper()

        # Extract query params from function signature
        query_params = []
        for arg in func_node.args.args:
            if arg.arg not in ["self", "current_user"]:
                param_info = self.extract_param_info(arg)
                query_params.append(param_info)

        # Extract response model from decorator kwargs
        response_model = None
        for keyword in decorator.keywords:
            if keyword.arg == "response_model":
                response_model = keyword.value.id

        # Extract docstring
        description = ast.get_docstring(func_node) or ""

        return {
            "path": f"/api/v1{path}",
            "method": method,
            "query_params": query_params,
            "response_model": response_model,
            "description": description.split("\n")[0],  # First line only
            "source_line": func_node.lineno
        }

    def extract_param_info(self, arg):
        """
        Извлекает информацию о параметре (type, required, description).
        """
        # This is simplified - real implementation needs type annotation parsing
        return {
            "name": arg.arg,
            "type": "string",  # TODO: Parse from annotation
            "required": False  # TODO: Check default value
        }

def extract_endpoint_signatures(file_path: str) -> List[Dict]:
    """
    Извлекает все endpoint signatures из Python файла.
    """
    with open(file_path, "r") as f:
        tree = ast.parse(f.read())

    visitor = EndpointVisitor()
    visitor.visit(tree)

    return visitor.endpoints
```

**Testing:**
```python
# Test on real endpoint file
endpoints = extract_endpoint_signatures("backend/app/api/v1/endpoints/articles.py")
assert len(endpoints) > 0
assert endpoints[0]["path"] == "/api/v1/articles"
assert endpoints[0]["method"] == "GET"
```

---

### Phase 4: YAML Generation (Week 5)

**Goal:** Generate YAML snippets from extracted signatures

**Implementation:**
```python
from jinja2 import Template
from pathlib import Path

def generate_endpoint_yaml(endpoint_signature: Dict, template_path: str) -> str:
    """
    Генерирует YAML snippet для endpoint из template.
    """
    with open(template_path, "r") as f:
        template = Template(f.read())

    # Format query params for YAML
    query_params_yaml = ""
    for param in endpoint_signature.get("query_params", []):
        required = "(required)" if param["required"] else "(optional)"
        query_params_yaml += f'    {param["name"]}: "{param["type"]} {required}"\n'

    return template.render(
        path=endpoint_signature["path"],
        method=endpoint_signature["method"],
        auth_level="user",  # TODO: Extract from dependencies
        query_params_yaml=query_params_yaml.strip(),
        request_body_yaml="# TODO: Extract from Pydantic schema",
        response_model_yaml=f"# Response model: {endpoint_signature.get('response_model', 'Unknown')}",
        source_file=endpoint_signature.get("source_file", "unknown"),
        source_line=endpoint_signature.get("source_line", 0),
        timestamp=datetime.now().isoformat()
    )
```

---

### Phase 5: User Approval Flow (Week 6)

**Goal:** Preview updates and get user confirmation

**Implementation:**
```python
def preview_and_approve_update(doc_file: str, yaml_snippet: str) -> bool:
    """
    Показывает preview обновления и запрашивает подтверждение.
    """
    print(f"\n❓ Preview update for {doc_file}\n")
    print("Will add:")
    print(yaml_snippet)
    print("\nApply this update? (yes/no/edit)")

    response = input("> ").strip().lower()

    if response == "yes":
        return True
    elif response == "edit":
        # Open editor for manual modification
        edited_snippet = edit_in_editor(yaml_snippet)
        return True, edited_snippet
    else:
        return False

def apply_yaml_update(doc_file: str, yaml_snippet: str):
    """
    Применяет YAML snippet к документу.
    """
    # Backup original file
    backup_path = f"{doc_file}.backup"
    shutil.copy(doc_file, backup_path)

    try:
        # Parse existing YAML
        with open(doc_file, "r") as f:
            content = yaml.safe_load(f)

        # Insert new route (simplified)
        if "routes" in content:
            new_route = yaml.safe_load(yaml_snippet)
            content["routes"].append(new_route)

        # Write updated YAML
        with open(doc_file, "w") as f:
            yaml.dump(content, f, default_flow_style=False, sort_keys=False)

        print(f"✅ Updated {doc_file}")

    except Exception as e:
        # Restore backup on error
        shutil.copy(backup_path, doc_file)
        raise e
```

---

## Integration with Workflow

### PHASE 5C Hook

```python
# In git-workflow skill, after commit:

if phase == "5C":
    # Auto-invoke doc-sync
    result = run_skill("doc-sync", mode="sync")

    if result["updates_applied"]:
        # Create docs commit
        subprocess.run(["git", "add", "docs/"])
        subprocess.run([
            "git", "commit", "-m",
            "docs: sync with code changes\n\n" + result["changelog_entry"]
        ])
```

---

## Testing Strategy

### Unit Tests
```python
# tests/skills/test_doc_sync.py

def test_git_diff_analysis():
    result = analyze_git_diff()
    assert isinstance(result, dict)
    assert "api_endpoints" in result

def test_endpoint_extraction():
    endpoints = extract_endpoint_signatures("tests/fixtures/sample_endpoint.py")
    assert len(endpoints) == 1
    assert endpoints[0]["method"] == "GET"

def test_yaml_generation():
    yaml = generate_endpoint_yaml({
        "path": "/test",
        "method": "GET"
    })
    assert "path: \"/test\"" in yaml
```

### Integration Tests
```bash
# tests/integration/test_doc_sync_workflow.sh

# Setup: Create test repo with sample code
git init test-repo
cd test-repo

# Add sample endpoint
cat > backend/app/api/v1/endpoints/test.py << EOF
@router.get("/test")
async def test_endpoint():
    pass
EOF

git add .
git commit -m "feat: add test endpoint"

# Run doc-sync
python -m doc_sync --check

# Verify output
assert_output_contains "Missing component: GET /api/v1/test"
```

---

## Performance Considerations

### Optimization Strategies

1. **Caching:**
   - Cache architecture_refs map (rebuild only on skill changes)
   - Cache AST parse results (rebuild only on file changes)

2. **Incremental Processing:**
   - Process only changed files (not full codebase)
   - Skip unchanged documentation

3. **Parallel Processing:**
   - Parse multiple files concurrently (multiprocessing)

**Expected Performance:**
- Small changes (1-3 files): < 5 seconds
- Medium changes (5-10 files): < 15 seconds
- Large changes (>20 files): < 30 seconds

---

## Future Enhancements

### v1.1: TypeScript AST Parsing
- Use ts-morph library for TypeScript parsing
- Extract interface/type definitions
- Detect exported functions/classes

### v1.2: LSP Integration
- Use LSP for signature extraction (more reliable)
- Get hover documentation
- Find references

### v1.3: Auto-fix $ref Links
- Detect broken $ref links in YAML
- Auto-update when files move/rename
- Validate all $ref links in CI/CD
