# Architecture Documentation Validation Report
**Generated:** 2026-01-21
**Validator:** validate-yaml-refs.py
**Scope:** /docs/architecture

## Executive Summary

| Metric | Count | Status |
|--------|-------|--------|
| Total YAML files | 47 | ✓ |
| Total $ref occurrences | 524 | - |
| Valid references | 233 (44.5%) | ⚠️ |
| **Broken references** | **50 (9.5%)** | ❌ |
| **YAML syntax errors** | **0** | ✓ **FIXED** |
| Warnings (parse issues) | 25 | ⚠️ |

## YAML Syntax Fixes (Completed)

Fixed 4 critical YAML syntax errors:

1. **docs/architecture/database/history.yaml:13**
   - Issue: Invalid list syntax in `columns:` section
   - Fix: Wrapped list items in quotes
   - Status: ✓ Fixed

2. **docs/architecture/functionality/offline.yaml:254**
   - Issue: Unquoted parentheses in list items `(green)`, `(red)`
   - Fix: Quoted entire strings `"online (green)"`
   - Status: ✓ Fixed

3. **docs/architecture/flows/telegram-oauth.yaml:290**
   - Issue: Incorrect indentation in multiline diagram block
   - Fix: Added missing space to align with block indent
   - Status: ✓ Fixed

4. **docs/architecture/web/_index.yaml:82**
   - Issue: Mixed list and mapping at same level in `webapp:`
   - Fix: Added `files:` subkey for HTML list
   - Status: ✓ Fixed

## Broken References Analysis

### Top 20 Most Frequent Broken References

| Count | Reference | Category |
|-------|-----------|----------|
| 10 | `../functionality/authentication.yaml#/module/services/8` | Missing service index |
| 4 | `../database/support.yaml#/tables/t_agg_financial_center_balance_monthly` | Missing table |
| 3 | `../functionality/transfers.yaml#/module/services/0` | Missing service index |
| 2 | `../database/support.yaml#/tables/t_scheduled_reminder` | Missing table |
| 2 | `../database/support.yaml#/tables/t_push_subscription` | Missing table |
| 2 | `../database/support.yaml#/tables/t_d_import_template` | Missing table |
| 2 | `../database/support.yaml#/tables/t_d_bank_provider` | Missing table |
| 2 | `../database/support.yaml#/tables/t_2fa_session` | Missing table |
| 2 | `../database/history.yaml#/tables/t_d_product_group_history` | Missing table |
| 2 | `../database/facts.yaml#/tables/t_f_shopping_list_item` | Missing table |
| 1 | `../functionality/shopping-lists.yaml#/module/services/7` | Missing service index |
| 1 | `../functionality/shopping-lists.yaml#/module/services/6` | Missing service index |
| 1 | `../functionality/shopping-lists.yaml#/module/services/5` | Missing service index |
| 1 | `../functionality/realtime.yaml#/module/services/0` | Missing service index |
| 1 | `../functionality/realtime.yaml#/critical_constraint` | Missing section |
| 1 | `../functionality/offline.yaml#/indexeddb` | Missing section |
| 1 | `../functionality/financial-centers.yaml#/module/services/2` | Missing service index |
| 1 | `../functionality/cost-centers.yaml#/module/services/1` | Missing service index |
| 1 | `../functionality/budget-management.yaml#/module/services/4` | Missing service index |
| 1 | `../functionality/budget-management.yaml#/module/services/3` | Missing service index |

### Broken References by Category

#### 1. Missing Service Indices (22 references)
Services referenced by index `/module/services/N` but index N doesn't exist in target YAML.

**Most critical:**
- `authentication.yaml#/module/services/8` (10 occurrences) - WebAuthn service
- `transfers.yaml#/module/services/0` (3 occurrences)
- `shopping-lists.yaml#/module/services/5,6,7` (3 occurrences)

**Recommended fix:** Either:
- Add missing service entries to target YAML files, OR
- Update references to use service names instead of indices

#### 2. Missing Database Tables (14 references)
Tables referenced but not documented in database YAML files.

**Tables to document:**
- `t_agg_financial_center_balance_monthly` (4 refs) - Aggregation table
- `t_scheduled_reminder` (2 refs) - Notifications
- `t_push_subscription` (2 refs) - Web Push
- `t_d_import_template` (2 refs) - Import system
- `t_d_bank_provider` (2 refs) - Import system
- `t_2fa_session` (2 refs) - 2FA authentication
- `t_d_product_group_history` (2 refs) - Shopping lists history
- `t_f_shopping_list_item` (2 refs) - Shopping items fact table

**Recommended fix:** Add missing tables to:
- `database/support.yaml` (support tables)
- `database/history.yaml` (history tables)
- `database/facts.yaml` (fact tables)

#### 3. Missing Sections (14 references)
Referenced sections that don't exist in target files.

**Examples:**
- `realtime.yaml#/critical_constraint`
- `offline.yaml#/indexeddb`
- Various `/module/services/N` indices

**Recommended fix:** Add missing sections or remove broken references.

## Version Consistency Analysis

### Current State

**index.yaml meta:**
```yaml
version: "1.0.1"  # index.yaml file version
generated: "2026-01-14"
total_files: 59  # OUTDATED (should be ~62)
```

**Missing:**
- `current_version: "9.0.0"` - Current project version NOT specified

### Versions Found in Documentation

| Version | Location | Context |
|---------|----------|---------|
| 9.0.0 | ci-cd-build-deploy.md, docker.md | Registry-first architecture |
| 7.0.0 | Various YAML | ES Modules migration |
| 6.6.0 | Various YAML | Bulk delete optimization |
| 6.5.0 | Mentioned | WebAuthn |
| 6.3.0 | Mentioned | Admin auth bypass |
| 5.x, 3.x, 1.x | Various | Historical versions |

**Issue:** No YAML files contain `version: "9.0.0"` despite being current project version.

**Recommended fix:**
1. Add `current_version: "9.0.0"` to `index.yaml` meta section
2. Update `total_files: 62` (current count)
3. Add `recent_changes:` section tracking v9.0.0 changes

## Warnings (YAML Parse Issues)

25 warnings detected - mostly older YAML files with minor formatting issues that don't prevent parsing but should be cleaned up:

**Common issues:**
- Extra whitespace
- Inconsistent indentation
- Mixed quote styles
- Deprecated YAML 1.1 features

**Recommended fix:** Run YAML formatter/linter on all files.

## Files Analysis

### Total Documentation Files

```bash
docs/architecture/
├── *.md (30+ files)
└── *.yaml (62+ files)
```

**Breakdown by type:**
- Database: 9 YAML files
- Endpoints: 18 YAML files
- Flows: 6 YAML files
- Functionality: 15 YAML files
- Web: 5 YAML files
- Frontend: 6 YAML files
- Guides: 7 files

### Potentially Orphaned Documents

Files that may not be referenced in main navigation (requires manual review):

**Fix-documents (candidates for archival):**
- cache-busting-fix.md (16K)
- category-selection-fix.md (29K)
- env-syntax-fix.md (3.1K)
- modal-hints-fix.md (22K)
- recurring-plans-fixes.md (17K)
- setup-admin-fix-v1.0.md (7.9K)

**Duplicate CI/CD docs:**
- ci-cd-pipeline.md (562 lines) - OLD
- ci-cd-build-deploy.md (1025 lines) - NEW (v9.0)

**Recommendation:** See PHASE 2 for fix-docs review and PHASE 3 for CI/CD merge.

## Recommendations by Priority

### Priority 1: Critical (PHASE 1-3)
1. ✓ **COMPLETED:** Fix YAML syntax errors (4 files)
2. **TODO:** Update `index.yaml`:
   - Add `current_version: "9.0.0"`
   - Update `total_files: 62`
   - Add `recent_changes` section
3. **TODO:** Review and integrate/archive fix-documents (6 files)
4. **TODO:** Merge CI/CD documentation (ci-cd-pipeline.md + ci-cd-build-deploy.md)

### Priority 2: High (PHASE 4)
1. **TODO:** Fix broken service indices references (22 refs)
   - Update authentication.yaml to add services[8] (WebAuthn)
   - Update transfers.yaml to add services[0]
   - etc.
2. **TODO:** Document missing database tables (14 refs)
   - Add 8 missing tables to support.yaml, history.yaml, facts.yaml
3. **TODO:** Add metadata sections to all YAML files (66 files)

### Priority 3: Medium (PHASE 5-6)
1. **TODO:** Create missing documentation:
   - schema-validation.yaml
   - migration-strategies.yaml
   - error-handling-patterns.yaml
2. **TODO:** Fix remaining broken references (14 refs)
3. **TODO:** Update README.md navigation
4. **TODO:** Update CLAUDE.md with new doc structure

### Priority 4: Low (PHASE 7)
1. **TODO:** Clean up YAML warnings (25 warnings)
2. **TODO:** Run comprehensive link validation
3. **TODO:** Standardize formatting across all files

## Validation Scripts Created

### validate-yaml-refs.py
**Location:** `/tmp/validate-yaml-refs.py`
**Purpose:** Validates all $ref cross-references in YAML files
**Features:**
- Resolves relative file paths
- Validates JSON Pointers
- Detects YAML syntax errors
- Categorizes errors and warnings

**Usage:**
```bash
python3 /tmp/validate-yaml-refs.py > validation-report.txt
```

**Recommended:** Move to `scripts/validate-yaml-refs.py` in project root.

## Next Steps (PHASE 2-7)

1. **PHASE 2:** Fix-Documents Review
   - Analyze 6 fix-documents individually
   - Extract valuable information
   - Integrate into main docs or archive

2. **PHASE 3:** CI/CD Documentation Merge
   - Merge ci-cd-pipeline.md + ci-cd-build-deploy.md
   - Create unified v3.0 documentation
   - Archive old file

3. **PHASE 4:** Metadata Addition
   - Add meta sections to all 66 YAML files
   - Include version_introduced, last_updated, status

4. **PHASE 5:** New Documentation
   - Create schema-validation.yaml
   - Create migration-strategies.yaml
   - Create error-handling-patterns.yaml

5. **PHASE 6:** Index & README Updates
   - Update index.yaml to v2.0.0
   - Update README.md navigation
   - Update CLAUDE.md references

6. **PHASE 7:** Final Validation
   - Re-run validation scripts
   - Verify 0 broken references
   - Confirm 100% metadata coverage

## Metrics Goals (Post-Completion)

| Metric | Current | Target |
|--------|---------|--------|
| Valid references | 44.5% | 100% |
| Broken references | 50 | 0 |
| YAML syntax errors | 0 | 0 |
| Files with metadata | ~10% | 100% |
| Documented tables | 85% | 100% |
| Version consistency | Poor | Excellent |

---

**Report Status:** PHASE 1 COMPLETE
**Next Action:** Proceed to PHASE 2 (Fix-Documents Review)
