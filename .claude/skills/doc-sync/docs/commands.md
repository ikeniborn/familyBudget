# Commands Reference - Doc-Sync

Detailed usage guide for all doc-sync commands.

---

## Command: sync (default)

**Usage:**
```bash
@skill:doc-sync
@skill:doc-sync --since HEAD~3  # Analyze last 3 commits
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
      "approved": true
    }
  ],
  "changelog_entry": "[Generated entry]",
  "commit_sha": "abc123..."
}
```

**Exit codes:**
- `0` - Success (all updates applied)
- `1` - Failure (parse errors, git errors)
- `2` - User rejected all updates

---

## Command: check (dry-run)

**Usage:**
```bash
@skill:doc-sync --check
@skill:doc-sync --check --verbose  # Show detailed diff
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
     Severity: HIGH
     File: docs/architecture/endpoints/articles.yaml

  2. Signature mismatch: POST /api/v1/articles
     Severity: MEDIUM
     Diff: Added query param 'validate_hierarchy'
     File: docs/architecture/endpoints/articles.yaml

💡 Recommendations:
  Run '@skill:doc-sync' to apply updates
```

**Flags:**
- `--verbose` - Show full diff for each mismatch
- `--json` - Output as JSON (for CI/CD integration)

**Exit codes:**
- `0` - No issues found (docs up-to-date)
- `1` - Issues found (docs need update)

---

## Command: validate (full scan)

**Usage:**
```bash
@skill:doc-sync --validate
@skill:doc-sync --validate --fix  # Auto-fix safe issues
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

**Flags:**
- `--fix` - Auto-fix safe issues (outdated timestamps, missing TODOs)
- `--report` - Generate HTML report (validation-report.html)

**Exit codes:**
- `0` - All valid
- `1` - Errors found (manual fix required)
- `2` - Warnings only (optional fix)

**Performance:**
- Small project (<100 files): ~10 seconds
- Medium project (100-500 files): ~30 seconds
- Large project (>500 files): ~60 seconds

---

## Advanced Options

### --since COMMIT
Analyze changes since specific commit

```bash
@skill:doc-sync --since HEAD~5
@skill:doc-sync --since abc1234
@skill:doc-sync --since main
```

### --files FILE1 FILE2...
Limit analysis to specific files

```bash
@skill:doc-sync --files backend/app/api/v1/endpoints/articles.py
```

### --skip-approval
Skip user approval (auto-approve all updates)

```bash
@skill:doc-sync --skip-approval  # ⚠️ Use with caution!
```

**Use case:** CI/CD automation (with review in PR)

### --backup-dir DIR
Custom backup directory

```bash
@skill:doc-sync --backup-dir /tmp/doc-sync-backups
```

**Default:** `.doc-sync-backups/`

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Doc-Sync Check

on: [pull_request]

jobs:
  doc-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check docs sync
        run: |
          @skill:doc-sync --check --json > doc-sync-report.json
          if [ $? -ne 0 ]; then
            echo "❌ Documentation out of sync!"
            cat doc-sync-report.json
            exit 1
          fi
```

### Pre-commit Hook Example

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run doc-sync check before commit
@skill:doc-sync --check --quiet

if [ $? -ne 0 ]; then
    echo "⚠️ Documentation needs update. Run '@skill:doc-sync' to fix."
    echo "Or commit with --no-verify to skip this check."
    exit 1
fi
```

---

## Troubleshooting

### "Git diff empty" error
**Cause:** No committed changes to analyze

**Fix:**
```bash
# Commit code changes first
git add backend/app/api/v1/endpoints/articles.py
git commit -m "feat: add search endpoint"

# Then run doc-sync
@skill:doc-sync
```

### "AST parse error" warning
**Cause:** Invalid Python syntax in source file

**Fix:**
- Fix syntax errors in source code
- Or skip file: `@skill:doc-sync --skip-errors`

### "YAML parse error" warning
**Cause:** Invalid YAML syntax in docs

**Fix:**
- Validate YAML: `yamllint docs/architecture/endpoints/articles.yaml`
- Fix syntax errors
- Re-run doc-sync

### "No affected docs found" message
**Cause:** Code changes not mapped to documentation

**Fix:**
- Add architecture_refs to relevant skill
- Or manually specify docs: `@skill:doc-sync --docs docs/architecture/endpoints/articles.yaml`
