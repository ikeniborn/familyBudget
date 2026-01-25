# Minification Audit Report

**Date:** 2026-01-25
**Branch:** dev/tabbed_modals_20260125121809
**Auditor:** Claude Sonnet 4.5

---

## Executive Summary

✅ **AUDIT PASSED**

All minified files are properly excluded from git and generated during Docker build.

**Key Findings:**
- ✅ .gitignore patterns correct for all minified files
- ✅ Only 1 tracked minified file (admin-facts-common.min.js - intentional exception)
- ✅ Vendor source files tracked, minified versions generated on build
- ✅ Complete minification pipeline in Docker build (CSS + Vendor + TypeScript)

---

## .gitignore Coverage

### CSS Minified Files

**Pattern:**
```gitignore
# Line 201-203
frontend/web/static/css/*.min.css
frontend/web/static/css/vendor/*.min.css
frontend/shared/static/css/*.min.css
```

**Covered Files (5):**
```
✓ frontend/web/static/css/tailwind-daisyui.min.css (244KB)
✓ frontend/web/static/css/custom.min.css (52KB)
✓ frontend/web/static/css/daisyui-overrides.min.css (33KB)
✓ frontend/web/static/css/choices-tailwind.min.css (43KB)
✓ frontend/web/static/css/loading-dots.min.css (9KB)
```

**Additional Pattern:**
```gitignore
# Line 207
frontend/web/static/css/tailwind-daisyui.css  # Intermediate file (unminified)
```

---

### JavaScript Minified Files

**Pattern:**
```gitignore
# Line 208-209
frontend/**/static/js/**/*.min.js
frontend/**/static/js/**/*.min.js.map
```

**Covered Files (41+):**
```
Dashboard Modules:
✓ frontend/web/static/js/dashboard.min.js (262KB)
✓ frontend/web/static/js/facts.min.js (122KB)
✓ frontend/web/static/js/transfers.min.js
✓ frontend/web/static/js/lists.min.js
✓ frontend/web/static/js/budgetShared.min.js

Offline Modules:
✓ frontend/web/static/js/offline/offlineManager.min.js
✓ frontend/web/static/js/offline/conflictResolver.min.js
✓ frontend/web/static/js/offline/idb.min.js
✓ frontend/web/static/js/offline/networkDetector.min.js
✓ frontend/web/static/js/offline/offlineShoppingManager.min.js
✓ frontend/web/static/js/offline/pushManager.min.js

Workers:
✓ frontend/web/static/js/workers/csvWorker.min.js
✓ frontend/web/static/js/workers/hierarchyWorker.min.js
✓ frontend/web/static/js/workers/pendingRecordsWorker.min.js
✓ frontend/web/static/js/workers/syncWorker.min.js
✓ frontend/web/static/js/workers/core/workerWrapper.min.js

Budget Modules:
✓ frontend/web/static/js/budget/budgetWSClient.min.js
✓ frontend/web/static/js/budget/incrementalUpdates.min.js

Utils:
✓ frontend/web/static/js/utils/logger.min.js
✓ frontend/web/static/js/utils/logsCollector.min.js
✓ frontend/web/static/js/utils/cacheMetricsCollector.min.js
✓ frontend/web/static/js/utils/performanceMonitor.min.js
✓ frontend/web/static/js/utils/modalKeyboardAdapter.min.js

Lists:
✓ frontend/web/static/js/lists/csvImporter.min.js
✓ frontend/web/static/js/lists/googleSheetsImporter.min.js
✓ frontend/web/static/js/lists/importManager.min.js

Shared:
✓ frontend/shared/static/js/budgetShared.min.js
✓ frontend/shared/static/js/calendar-widget.min.js
✓ frontend/shared/static/js/choicesCategoryTree.min.js
✓ frontend/shared/static/js/choicesProductGroupTree.min.js
✓ frontend/shared/static/js/dateFormatter.min.js
✓ frontend/shared/static/js/debugLog.min.js
✓ frontend/shared/static/js/reminders.min.js

Webapp:
✓ frontend/webapp/static/js/api.min.js
✓ frontend/webapp/static/js/app.min.js
✓ frontend/webapp/static/js/auth.min.js
✓ frontend/webapp/static/js/storage.min.js
✓ frontend/webapp/static/js/theme.min.js
✓ frontend/webapp/static/js/ui.min.js
✓ frontend/webapp/static/js/validators.min.js

Other:
✓ frontend/web/static/js/adminStatusFilter.min.js
✓ frontend/web/static/js/config/logging.min.js
✓ frontend/web/static/js/confirm-dialog.min.js
✓ frontend/web/static/js/data/DataLayer.min.js
✓ frontend/web/static/js/htmxWidgets.min.js
✓ frontend/web/static/js/monitoring/PerformanceMonitor.min.js
✓ frontend/web/static/js/navigationProgress.min.js
✓ frontend/web/static/js/network.min.js
✓ frontend/web/static/js/transfer.min.js
✓ frontend/web/static/js/webauthn-onboarding.min.js
```

---

### PGlite Bundles

**Pattern:**
```gitignore
# Line 211-213
frontend/shared/db/assets/
frontend/shared/db/*.min.js
frontend/shared/db/*.min.js.map
```

**Covered Files:**
```
✓ frontend/shared/db/pglite.min.js
```

---

### Service Worker

**Pattern:**
```gitignore
# Line 215-217
sw.min.js
sw.min.js.map
sw.min.js.gz
```

**Covered Files:**
```
✓ frontend/web/static/sw.min.js (24KB)
```

---

## Tracked Minified File (Intentional Exception)

### admin-facts-common.min.js

**Exception Pattern:**
```gitignore
# Line 226-228
# Standalone utility scripts (not built by Vite) - TRACKED в git
# Эти файлы минифицируются вручную и должны быть в git
!frontend/**/static/js/admin-facts-common.min.js
```

**File Details:**
```
Source:    frontend/web/static/js/admin-facts-common.js (2.2 KB)
Minified:  frontend/web/static/js/admin-facts-common.min.js (787 bytes)
Tracked:   ✓ Yes (intentional)
Why:       Standalone utility script, minified manually
Usage:     Admin pages (not part of main build pipeline)
```

**Rationale:**
This is a standalone utility that:
- Is not processed by Vite/build-all.js
- Is minified manually (not part of automated build)
- Is used directly in admin HTML templates
- Must be tracked to avoid breaking admin pages

---

## Vendor Files Strategy

### Source Files (Tracked in Git)

**CSS:**
```
✓ frontend/web/static/css/vendor/choices.css (29KB, tracked)
```

**JavaScript:**
```
✓ frontend/web/static/js/vendor/choices.js (104KB, tracked)
✓ frontend/web/static/js/vendor/echarts.js (1.4MB, tracked)
✓ frontend/web/static/js/vendor/htmx.js (80KB, tracked)
✓ frontend/web/static/js/vendor/qr-creator.js (18KB, tracked)
```

### Minified Files (Generated on Build)

**CSS:**
```
✓ frontend/web/static/css/vendor/choices.min.css (24KB, ignored)
```

**JavaScript:**
```
✓ frontend/web/static/js/vendor/choices.min.js (74KB, ignored)
✓ frontend/web/static/js/vendor/echarts.min.js (1.1MB, ignored)
✓ frontend/web/static/js/vendor/htmx.min.js (60KB, ignored)
✓ frontend/web/static/js/vendor/qr-creator.min.js (14KB, ignored)
```

**Strategy Benefits:**
- ✅ Source control for vendor libraries (can track changes, rollback)
- ✅ No git bloat from minified versions
- ✅ Reproducible builds (always same minification)
- ✅ Fresh minification with each Docker build

---

## Docker Build Minification Pipeline

### Stage 2: Frontend Builder (backend/Dockerfile:26-60)

**Full Pipeline:**
```dockerfile
# Stage 2: Frontend builder
FROM node:18-alpine as frontend-builder

# ... setup ...

# Минификация и сборка
RUN npm run build:prod
```

**npm run build:prod Pipeline:**
```bash
npm run build:prod
├── npm run build:css
│   ├── npm run build:tailwind        # Generate tailwind-daisyui.css
│   ├── npm run minify:tailwind       # → tailwind-daisyui.min.css
│   ├── npm run minify:overrides      # → daisyui-overrides.min.css
│   ├── npm run minify:custom-css     # → custom.min.css
│   ├── npm run minify:choices        # → choices-tailwind.min.css
│   └── npm run minify:vendor-css     # → vendor/choices.min.css
├── npm run build:vendor
│   ├── npm run minify:vendor-css     # → vendor/choices.min.css
│   └── npm run minify:vendor-js      # → vendor/*.min.js (via scripts/minify-vendor.js)
└── npm run bundle
    └── node build-all.js             # Vite build for all TypeScript modules
```

---

## Minification Tools

### CSS Minification

**Tool:** PostCSS + cssnano

**Command:**
```bash
postcss [source.css] -u cssnano -o [output.min.css]
```

**Configuration:** postcss.config.js
```javascript
module.exports = {
  plugins: {
    cssnano: {
      preset: ['default', {
        discardComments: { removeAll: true }
      }]
    }
  }
};
```

---

### JavaScript Minification

**Tool:** Vite (Rollup + Terser)

**Command:**
```bash
node build-all.js  # Runs Vite for each module
```

**Configuration:** vite.config.ts
```typescript
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

---

### Vendor JavaScript Minification

**Tool:** Terser (via scripts/minify-vendor.js)

**Command:**
```bash
npm run minify:vendor-js
```

**Script:** scripts/minify-vendor.js
```javascript
const Terser = require('terser');
const files = [
  'frontend/web/static/js/vendor/choices.js',
  'frontend/web/static/js/vendor/echarts.js',
  'frontend/web/static/js/vendor/htmx.js',
  'frontend/web/static/js/vendor/qr-creator.js'
];

// Parallel minification with Promise.all
```

---

## Verification Commands

### Check .gitignore Coverage

```bash
# Test all minified files
for file in $(find frontend -name "*.min.css" -o -name "*.min.js" | grep -v node_modules | grep -v vendor); do
  if git check-ignore -q "$file"; then
    echo "✓ $file (ignored)"
  else
    echo "✗ $file (NOT IGNORED)"
  fi
done | grep "NOT IGNORED"
```

**Expected Result:** No output (all files ignored)

---

### Check Tracked Minified Files

```bash
git ls-files | grep -E "\.min\.(css|js)$" | grep -v vendor
```

**Expected Result:**
```
frontend/web/static/js/admin-facts-common.min.js
```

---

### Verify Docker Build Includes Minification

```bash
docker build -f backend/Dockerfile --target frontend-builder -t test-frontend .
docker run --rm test-frontend ls -lh frontend/web/static/css/
docker run --rm test-frontend ls -lh frontend/web/static/js/vendor/
```

**Expected:** All .min.css and .min.js files present

---

## Potential Issues & Mitigations

### Issue 1: Missing Minified Files in Docker Image

**Symptom:** CSS/JS files not loading in production

**Check:**
```bash
docker exec -it backend-container ls -lh /app/frontend/web/static/css/
```

**Fix:**
```bash
# Rebuild frontend stage
docker-compose build backend --no-cache
```

---

### Issue 2: Stale Minified Files in Git

**Symptom:** Git shows changes in .min.css/.min.js files

**Check:**
```bash
git status | grep "\.min\."
```

**Fix:**
```bash
# Remove from git tracking
git rm --cached frontend/web/static/css/*.min.css
git rm --cached frontend/web/static/js/**/*.min.js

# Commit changes
git commit -m "chore: remove minified files from git tracking"
```

---

### Issue 3: Vendor Files Not Minified

**Symptom:** Vendor files not found in Docker image

**Check:**
```bash
ls -lh frontend/web/static/js/vendor/*.min.js
```

**Fix:**
```bash
# Run vendor minification
npm run build:vendor

# Verify output
ls -lh frontend/web/static/js/vendor/
```

---

## Summary

### ✅ All Requirements Met

1. **All minified files excluded from git:**
   - CSS: 5 files (tailwind, custom, overrides, choices, loading-dots)
   - JS: 40+ files (dashboard, facts, transfers, workers, utils, etc.)
   - Vendor: 5 files (choices, echarts, htmx, qr-creator)
   - PGlite: 1 file (pglite.min.js)
   - Service Worker: 1 file (sw.min.js)

2. **Source files tracked in git:**
   - Vendor source files: 5 files (choices.js, echarts.js, htmx.js, qr-creator.js, choices.css)
   - TypeScript source files: 100+ files (all .ts files)
   - CSS source files: 5 files (tailwind.input.css, custom.css, etc.)

3. **Complete minification pipeline in Docker build:**
   - Stage 2 (frontend-builder): Runs `npm run build:prod`
   - CSS minification: PostCSS + cssnano
   - JS minification: Vite (Rollup + Terser)
   - Vendor minification: Terser (parallel execution)

4. **Exception properly documented:**
   - admin-facts-common.min.js tracked (intentional)
   - Clear comment in .gitignore explaining why

---

## Recommendations

### Optional Improvements

1. **Add Build Verification:**
   ```dockerfile
   # In backend/Dockerfile after npm run build:prod
   RUN echo "Verifying minified files..." && \
       test -f frontend/web/static/css/tailwind-daisyui.min.css && \
       test -f frontend/web/static/js/dashboard.min.js && \
       test -f frontend/web/static/js/vendor/htmx.min.js && \
       echo "✅ All minified files present"
   ```

2. **Add Size Reporting:**
   ```bash
   npm run build:prod && npm run analyze-size
   ```
   Create `analyze-size` script to report bundle sizes

3. **Add Pre-Commit Hook:**
   ```bash
   # .husky/pre-commit
   if git diff --cached --name-only | grep -E "\.min\.(css|js)$" | grep -v admin-facts-common; then
     echo "ERROR: Minified files should not be committed"
     exit 1
   fi
   ```

---

**Audit Status:** ✅ PASSED

**Audited By:** Claude Sonnet 4.5
**Date:** 2026-01-25
**Files Checked:** 50+ minified files
**Issues Found:** 0
**Exceptions:** 1 (admin-facts-common.min.js - intentional)
