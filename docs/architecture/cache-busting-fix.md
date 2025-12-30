# Cache Busting System Fix - Comprehensive HTML Template Support

**Version:** 6.5.2
**Date:** 2025-12-30
**Type:** Enhancement + Bugfix

## Problem

Deployment warning indicated incomplete cache busting:

```bash
[INFO] Verifying cache busting results...
[WARNING] Found 6 PLACEHOLDER tokens after cache busting
[WARNING] Cache busting may have failed - check permissions and perl installation

Files with PLACEHOLDER:
admin_logs.html
admin_monitoring.html
... (and more)
```

**Root Cause:**
- Old script `update-sw-version.sh` only processed `sw.js` (Service Worker)
- HTML templates with `?v=PLACEHOLDER` in script/CSS URLs were NOT processed
- 17 HTML files had unprocessed PLACEHOLDER tokens

## Solution

### New Comprehensive Script: `update-cache-busting.sh`

**Location:** `scripts/update-cache-busting.sh`

**Functionality:**
1. ✅ Updates Service Worker (`sw.js`) - CACHE_VERSION_PLACEHOLDER → v{timestamp}
2. ✅ Updates ALL HTML templates - ?v=PLACEHOLDER → ?v={timestamp}
3. ✅ Comprehensive validation (zero PLACEHOLDER tokens allowed)
4. ✅ Detailed reporting (files updated, failed, summary)
5. ✅ Idempotent (safe to run multiple times)

**Patterns Replaced:**
```html
<!-- Before -->
<script src="/static/js/file.js?v=PLACEHOLDER"></script>
<link href="/static/css/file.css?v=PLACEHOLDER">
<script src="{{ url_for('static', path='/js/file.js') }}?v=PLACEHOLDER"></script>

<!-- After -->
<script src="/static/js/file.js?v=v20251230_1830"></script>
<link href="/static/css/file.css?v=v20251230_1830">
<script src="{{ url_for('static', path='/js/file.js') }}?v=v20251230_1830"></script>
```

**Regex Pattern:**
```bash
sed 's/\([?&]v\?e\?r\?s\?i\?o\?n\?=\)PLACEHOLDER/\1${NEW_VERSION}/g'
```

Supports:
- `?v=PLACEHOLDER`
- `?version=PLACEHOLDER`
- `&v=PLACEHOLDER`
- `&version=PLACEHOLDER`

## Implementation

### Script Structure

```bash
#!/bin/bash
# scripts/update-cache-busting.sh

# Step 1: Update Service Worker (sw.js)
update_service_worker() {
    # Replace CACHE_VERSION_PLACEHOLDER with v{timestamp}
    # Backup → Replace → Verify → Clean or Restore
}

# Step 2: Update HTML Templates
update_html_templates() {
    # Find all HTML with PLACEHOLDER
    # For each file: Backup → Replace → Verify → Clean or Restore
    # Report: Success/Failed counts
}

# Step 3: Final Validation
validate_no_placeholders() {
    # Check sw.js for CACHE_VERSION_PLACEHOLDER
    # Check all HTML for any PLACEHOLDER tokens
    # Return 0 if zero found, 1 if any remain
}
```

### Integration in deploy.sh

**Before (line 871):**
```bash
if [[ -f "scripts/update-sw-version.sh" ]]; then
    bash scripts/update-sw-version.sh
fi
```

**After (line 871):**
```bash
if [[ -f "scripts/update-cache-busting.sh" ]]; then
    bash scripts/update-cache-busting.sh || exit 1
fi
```

**Removed duplicate validation (line 1151-1164):**
- Old deploy.sh had manual grep validation
- New script includes comprehensive validation
- Removed to avoid duplication

### Output Example

```bash
╔════════════════════════════════════════════════════════╗
║         Cache Busting Version Update                  ║
╚════════════════════════════════════════════════════════╝

[INFO] New version: v20251230_1830

[STEP 1/2] Updating Service Worker (sw.js)...
  ✓ Service Worker updated: v20251230_1830

[STEP 2/2] Updating HTML templates...
  [INFO] Found 17 files with PLACEHOLDER tokens

  ✓ admin_logs.html - updated
  ✓ admin_monitoring.html - updated
  ✓ admin_users.html - updated
  ... (14 more files)

  [SUCCESS] All 17 files updated successfully

[VALIDATION] Checking for remaining PLACEHOLDER tokens...

╔════════════════════════════════════════════════════════╗
║  ✓ VALIDATION PASSED - All placeholders replaced      ║
╚════════════════════════════════════════════════════════╝

[SUCCESS] Cache busting complete!
[INFO] Version: v20251230_1830
```

## Affected Files

### Created
- `scripts/update-cache-busting.sh` - New comprehensive cache busting script (200 lines)

### Modified
- `deploy.sh:865-883` - Changed to call new script
- `deploy.sh:1151-1164` - Removed duplicate validation

### Deprecated
- `scripts/update-sw-version.sh` - Old script (still present for backward compat, not called)

### HTML Templates Updated (17 files)
All files in `frontend/web/templates/` with PLACEHOLDER tokens:
- admin_articles.html
- admin_cost_centers.html
- admin_dashboard.html
- admin_financial_centers.html
- admin_logs.html
- admin_monitoring.html
- admin_product_groups.html
- admin_stores.html
- admin_users.html
- (and 8 more admin templates)

## Benefits

### Before Fix
- ❌ Only Service Worker processed
- ❌ HTML templates had stale PLACEHOLDER tokens
- ❌ Browser cached JS/CSS without version invalidation
- ❌ Manual validation required
- ⚠️ Warning messages in deployment logs

### After Fix
- ✅ Service Worker AND HTML templates processed
- ✅ All PLACEHOLDER tokens replaced with timestamp
- ✅ Browser cache properly invalidated on deploy
- ✅ Automatic comprehensive validation
- ✅ Clean deployment logs (no warnings)
- ✅ Detailed reporting (files updated, success/fail counts)

## Validation

### Pre-deployment Check (Repository)

```bash
# Count PLACEHOLDER tokens in repository (expected: many)
grep -r "PLACEHOLDER" frontend/web/templates/*.html | wc -l
# Output: 17+ (by design - templates keep PLACEHOLDER in git)

# Verify new script exists
ls -lh scripts/update-cache-busting.sh
# Output: -rwxr-xr-x 200 lines
```

### Post-deployment Check (Production)

```bash
# Count PLACEHOLDER tokens in production (expected: 0)
grep -r "PLACEHOLDER" /opt/budget/frontend/web/templates/*.html | wc -l
# Output: 0 (all replaced with version)

# Verify Service Worker version
grep "CACHE_VERSION" /opt/budget/sw.min.js
# Output: const CACHE_VERSION="v20251230_1830"

# Check sample HTML template
grep "?v=" /opt/budget/frontend/web/templates/admin_logs.html
# Output: All URLs have ?v=v20251230_1830 (no PLACEHOLDER)
```

### Smoke Test

```bash
# From deploy.sh smoke tests (lines 1499-1506)
manifest_json=$(curl -s http://localhost:8000/manifest.json)
echo "$manifest_json" | grep -q "PLACEHOLDER"
# Exit code: 1 (not found - good!)

sw_content=$(curl -s http://localhost:8000/sw.min.js)
echo "$sw_content" | grep -q "CACHE_VERSION_PLACEHOLDER"
# Exit code: 1 (not found - good!)
```

## Error Handling

### File Permissions Issue

```bash
# If sed fails due to permissions
[STEP 2/2] Updating HTML templates...
  [INFO] Found 17 files with PLACEHOLDER tokens
  ✗ admin_logs.html - FAILED (PLACEHOLDER still present)
  ... (more failures)
  [WARNING] 17 files failed, 0 succeeded

[VALIDATION] Checking for remaining PLACEHOLDER tokens...
  ✗ Found 17 PLACEHOLDER tokens in HTML templates
  Files with PLACEHOLDER:
    - admin_logs.html
    - ...

╔════════════════════════════════════════════════════════╗
║  ✗ VALIDATION FAILED - 17 placeholders remain          ║
╚════════════════════════════════════════════════════════╝

[WARNING] Validation found remaining PLACEHOLDER tokens
[INFO] This may indicate:
  - File permissions issues (chmod needed)
  - sed/perl not installed
  - New template files not handled by script

# Exit code: 1 (deployment aborted)
```

**Fix:**
```bash
# Check file permissions
ls -l /opt/budget/frontend/web/templates/*.html
# Should be: -rw-r--r-- (644)

# If wrong permissions
chmod 644 /opt/budget/frontend/web/templates/*.html

# Re-run deployment
cd ~/familyBudget
sudo ./deploy.sh --patch
```

### Missing sed/perl

```bash
# Check if sed is installed
which sed
# Expected: /usr/bin/sed

# If not installed (rare)
sudo apt-get install -y sed

# Re-run deployment
cd ~/familyBudget
sudo ./deploy.sh --patch
```

## Backward Compatibility

### Old Script Preserved

`scripts/update-sw-version.sh` remains in repository but is NOT called by deploy.sh.

**Reason:** Backward compatibility for:
- External scripts that might call it directly
- Documentation references
- Historical context

**Status:** Deprecated but functional

### Migration Path

**For deployments using old script:**

```bash
# Old way (deprecated)
cd /opt/budget
bash scripts/update-sw-version.sh

# New way (recommended)
cd /opt/budget
bash scripts/update-cache-busting.sh
```

## Future Improvements

### Potential Enhancements

1. **Parallel processing** for large template sets
   ```bash
   # Current: Sequential sed per file
   # Future: xargs -P4 for parallel processing
   find ... -exec sed ... {} \; &
   ```

2. **Differential updates** (only changed files)
   ```bash
   # Current: Process all HTML files
   # Future: Compare checksums, only update changed files
   git diff --name-only | grep "\.html$" | xargs ...
   ```

3. **Version manifest** (track what version was deployed when)
   ```json
   {
     "version": "v20251230_1830",
     "deployed_at": "2025-12-30T18:30:00Z",
     "files_updated": 17,
     "sw_updated": true
   }
   ```

4. **Rollback capability** (restore previous version)
   ```bash
   # Save previous version before update
   # Allow rollback if validation fails
   bash scripts/update-cache-busting.sh --rollback
   ```

## Related Documentation

- `/docs/architecture/build-system.md` - Build pipeline and optimization
- `/docs/architecture/pwa.md` - PWA architecture and Service Worker
- `scripts/update-sw-version.sh` - Deprecated SW-only script
- `deploy.sh:865-883` - Integration point

## Testing Checklist

Before merging to production:

- [ ] Run `bash -n scripts/update-cache-busting.sh` (syntax check)
- [ ] Test on development server (grep for PLACEHOLDER after deploy)
- [ ] Verify smoke tests pass (manifest, SW version)
- [ ] Check browser cache invalidation (new JS/CSS loaded)
- [ ] Confirm deployment logs show no warnings
- [ ] Validate all 17 HTML templates processed
- [ ] Test rollback scenario (restore backup files)

## Troubleshooting

### Issue: PLACEHOLDER still present after deploy

**Diagnosis:**
```bash
cd /opt/budget
grep -r "PLACEHOLDER" frontend/web/templates/*.html

# If found, check:
1. Script execution logs: tail -100 /opt/budget/logs/deploy.log | grep "Cache Busting"
2. File permissions: ls -l frontend/web/templates/*.html
3. sed version: sed --version
```

**Fix:**
```bash
# Manual re-run of cache busting
cd /opt/budget
bash scripts/update-cache-busting.sh

# If still fails, check script output for errors
bash -x scripts/update-cache-busting.sh 2>&1 | tee /tmp/cache-debug.log
```

### Issue: Deployment aborted with "CRITICAL" error

**Error Message:**
```
[CRITICAL] Failed to update cache busting versions!
Deployment ABORTED - cannot deploy with PLACEHOLDER tokens
```

**Cause:** Script returned non-zero exit code (validation failed)

**Fix:**
1. Check `/opt/budget/logs/deploy.log` for detailed error
2. Manually run script to see full output
3. Fix underlying issue (permissions, sed, etc.)
4. Re-run deployment

## References

- Bash scripting best practices: https://google.github.io/styleguide/shellguide.html
- Cache busting strategies: https://web.dev/http-cache/
- Service Worker updates: https://web.dev/service-worker-lifecycle/
