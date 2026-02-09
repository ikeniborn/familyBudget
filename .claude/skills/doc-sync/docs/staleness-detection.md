# Staleness Detection Algorithms

Детальное описание алгоритмов обнаружения устаревания документации.

---

## Overview

**4 типа staleness issues:**
1. Missing component (HIGH)
2. Signature mismatch (MEDIUM)
3. Outdated timestamp (LOW)
4. Deprecated component (MEDIUM)

---

## Algorithm 1: Missing Component Detection

**Definition:** Компонент существует в коде, но отсутствует в документации.

**Detection logic:**
```python
def detect_missing_components(code_signatures, docs_content):
    missing = []

    for signature in code_signatures:
        # Check if component exists in docs
        if not find_in_docs(signature.path, docs_content):
            missing.append({
                "type": "missing_component",
                "severity": "high",
                "component": signature.path,
                "file": signature.source_file,
                "line": signature.source_line
            })

    return missing
```

**Example:**
```python
# Code: backend/app/api/v1/endpoints/articles.py
@router.get("/articles/search")  # ← Exists in code
async def search_articles(...):
    pass

# Docs: docs/architecture/endpoints/articles.yaml
routes:
  - path: "/api/v1/articles"      # ← No /search route!
    method: GET
```

**Issue:**
```
⚠️ Missing component: GET /api/v1/articles/search
   Severity: HIGH
   File: backend/app/api/v1/endpoints/articles.py:45
   Recommendation: Add route documentation
```

---

## Algorithm 2: Signature Mismatch Detection

**Definition:** Компонент существует, но signatures не совпадают.

**Detection logic:**
```python
def detect_signature_mismatch(code_signature, docs_content):
    mismatches = []

    docs_signature = find_in_docs(code_signature.path, docs_content)
    if not docs_signature:
        return []  # Handled by missing_component

    # Compare query params
    code_params = set(code_signature.query_params)
    docs_params = set(docs_signature.query_params)

    added = code_params - docs_params
    removed = docs_params - code_params

    if added or removed:
        mismatches.append({
            "type": "signature_mismatch",
            "severity": "medium",
            "component": code_signature.path,
            "diff": {
                "added_params": list(added),
                "removed_params": list(removed)
            }
        })

    return mismatches
```

**Example:**
```python
# Code: backend/app/api/v1/endpoints/articles.py
@router.get("/articles")
async def get_articles(
    type: Optional[str] = None,
    parent_id: Optional[int] = None,
    validate_hierarchy: bool = False  # ← NEW param
):
    pass

# Docs: docs/architecture/endpoints/articles.yaml
query_params:
  type: "income | expense (optional)"
  parent_id: "integer (optional)"
  # ← Missing validate_hierarchy!
```

**Issue:**
```
⚠️ Signature mismatch: GET /api/v1/articles
   Severity: MEDIUM
   Diff:
     Added params: validate_hierarchy
   Recommendation: Update query_params documentation
```

---

## Algorithm 3: Outdated Timestamp Detection

**Definition:** Code modified значительно позже документации (>7 days threshold).

**Detection logic:**
```python
def detect_outdated_docs(code_file, docs_file, threshold_days=7):
    code_mtime = os.path.getmtime(code_file)
    docs_mtime = os.path.getmtime(docs_file)

    age_diff = (code_mtime - docs_mtime) / 86400  # Convert to days

    if age_diff > threshold_days:
        return {
            "type": "outdated_timestamp",
            "severity": "low",
            "code_file": code_file,
            "docs_file": docs_file,
            "code_age": datetime.fromtimestamp(code_mtime),
            "docs_age": datetime.fromtimestamp(docs_mtime),
            "age_diff_days": int(age_diff)
        }

    return None
```

**Example:**
```
Code: backend/app/models/article.py
  Last modified: 2026-02-09 (today)

Docs: docs/architecture/database/dimensions.yaml
  Last modified: 2026-01-15 (25 days ago)
```

**Issue:**
```
⚠️ Outdated description: t_d_article
   Severity: LOW
   Code modified: 2026-02-09 (today)
   Docs modified: 2026-01-15 (25 days ago)
   Age diff: 25 days
   Recommendation: Review documentation for accuracy
```

---

## Algorithm 4: Deprecated Component Detection

**Definition:** Компонент документирован, но удалён из кода.

**Detection logic:**
```python
def detect_deprecated_components(docs_content, code_signatures):
    deprecated = []

    for doc_component in docs_content:
        # Check if component exists in code
        if not find_in_code(doc_component.path, code_signatures):
            # Check git history to confirm deletion
            git_log = subprocess.run(
                ["git", "log", "--all", "--", doc_component.source_file],
                capture_output=True
            )

            if "delete" in git_log.stdout.decode():
                deprecated.append({
                    "type": "deprecated_component",
                    "severity": "medium",
                    "component": doc_component.path,
                    "docs_file": doc_component.file,
                    "last_seen_commit": extract_commit_sha(git_log)
                })

    return deprecated
```

**Example:**
```yaml
# Docs: docs/architecture/endpoints/analytics.yaml
routes:
  - path: "/api/v1/legacy/stats"  # ← Documented
    method: GET

# Code: (no matching endpoint in codebase)
# Git: Deleted in commit abc123 (2 weeks ago)
```

**Issue:**
```
⚠️ Deprecated component: GET /api/v1/legacy/stats
   Severity: MEDIUM
   File: docs/architecture/endpoints/analytics.yaml:120
   Last seen: commit abc123 (2 weeks ago)
   Recommendation: Remove from documentation or mark as deprecated
```

---

## Severity Levels

| Severity | Description | Action Required |
|----------|-------------|-----------------|
| **HIGH** | Critical inconsistency | Fix immediately |
| **MEDIUM** | Significant mismatch | Fix before PR |
| **LOW** | Minor staleness | Fix when convenient |

**High severity triggers:**
- Missing component (new endpoint not documented)
- Deprecated component (endpoint removed, docs not updated)

**Medium severity triggers:**
- Signature mismatch (params changed)

**Low severity triggers:**
- Outdated timestamp (code > 7 days newer than docs)

---

## Configuration

**Thresholds (configurable in config/):**
```json
{
  "staleness_criteria": {
    "outdated_timestamp": {
      "threshold_days": 7
    },
    "signature_mismatch": {
      "ignore_optional_params": false,
      "ignore_default_values": false
    }
  }
}
```

**Ignore patterns:**
```json
{
  "ignore": {
    "files": [
      "backend/app/api/v1/endpoints/health.py",
      "backend/app/api/v1/endpoints/internal/*.py"
    ],
    "components": [
      "/api/v1/health",
      "/api/v1/internal/*"
    ]
  }
}
```

---

## Performance Optimization

**Caching:**
- File mtimes cached (invalidate on git pull)
- AST parse results cached (invalidate on file change)
- Docs content cached (invalidate on docs change)

**Incremental detection:**
- Only analyze changed files (from git diff)
- Skip validation for unchanged components

**Expected performance:**
- 10 files: ~2 seconds
- 50 files: ~8 seconds
- 100 files: ~15 seconds
