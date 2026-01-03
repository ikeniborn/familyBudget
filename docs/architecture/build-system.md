# Build System Architecture

**Last Updated:** 2025-12-27
**Version:** 5.7.0

## Overview

Family Budget uses a custom bash-based build system optimized for frontend asset delivery with advanced minification and gzip pre-compression.

**Total Build Impact:**
- Raw file size reduction: 10-15%
- Delivery size reduction: 60-70% (via gzip)
- Build time: ~15-20 seconds
- Expected Lighthouse performance score: >90

---

## Build Pipeline

### Full Build Sequence

```bash
npm run build
```

**Executes in order:**
1. `npm run build:css` - Tailwind CSS compilation
2. `npm run bundle` - Bundle shared modules (budgetShared.js)
3. `npm run minify:js` - Minify all JavaScript with advanced Terser
4. `npm run minify:css` - Minify all CSS with advanced cssnano
5. `npm run precompress` - Gzip pre-compression for nginx delivery

---

## 1. JavaScript Minification

**Tool:** Terser 5.36.0
**Config:** `.terserrc.json`
**Script:** `scripts/lib/minify.sh`

### Advanced Configuration

**Key optimizations in `.terserrc.json`:**
- **3-pass compression** (`passes: 3`) - Multiple optimization rounds for maximum compression
- **Top-level mangling disabled** (`toplevel: false`) - ⚠️ Prevents identifier conflicts between files
- **Console logging cleanup** (`drop_console: ["log", "info", "debug"]`) - 🔇 Removes debug logs from production
- **Unsafe optimizations** (`unsafe_arrows`, `unsafe_math`, etc.) - Aggressive but safe for modern browsers
- **Boolean to integer** (`booleans_as_integers: true`) - `true`→1, `false`→0 for smaller output
- **ECMAScript 2020** (`ecma: 2020`) - Use modern syntax features for better optimization

**⚠️ Important: toplevel minification disabled (v5.7.0+)**

After enabling `toplevel: true`, multiple minified files declared same identifiers (`const e`, `class t`) in global scope, causing "Identifier has already been declared" errors. Solution: disable toplevel to preserve original class/const names.

**Trade-off:** ~5-10% larger files, but prevents critical runtime errors.

**🔇 Console logging cleanup (v5.7.0+)**

Production builds automatically remove debug logging to reduce file size and improve security:
- **Removed**: `console.log()`, `console.info()`, `console.debug()`
- **Preserved**: `console.warn()`, `console.error()`, `console.group()`, `console.groupEnd()`

**Benefits**:
- Cleaner production console (only warnings and errors)
- Smaller file sizes (~2-5% additional reduction)
- No sensitive debug information leaked to production
- Source files unchanged - developers can still use console.log during development

**Development workflow**:
```javascript
// Source code (budgetWSClient.js)
console.log('[WS-WAKE] Wake Health Check');  // Visible in development
console.error('[WS] Connection failed');      // Visible in both dev and prod

// After minification (budgetWSClient.min.js)
// console.log removed automatically
console.error('[WS] Connection failed');      // Preserved
```

**Full configuration:**
```json
{
  "ecma": 2020,
  "compress": {
    "passes": 3,
    "booleans_as_integers": true,
    "drop_console": ["log", "info", "debug"],
    "unsafe_arrows": true,
    "unsafe_math": true
  },
  "mangle": {
    "toplevel": false
  },
  "format": {
    "wrap_iife": true
  },
  "toplevel": false
}
```

### Expected Reduction

| File | Original | Minified | Reduction |
|------|----------|----------|-----------|
| budgetShared.js | 45KB | 16KB | 64% |
| offlineManager.js | 38KB | 14KB | 63% |
| choicesCategoryTree.js | 50KB | 19KB | 62% |
| **Average** | - | - | **60-65%** |

**Additional gain over basic minification:** 3-8%

---

## 2. CSS Minification

**Tool:** cssnano 7.0.6 (via PostCSS)
**Config:** `postcss.config.js`
**Script:** `scripts/lib/minify.sh`

### Advanced Configuration

**Key optimizations:**
- **Advanced preset** (`preset: 'advanced'`) - Most aggressive optimizations
- **Reduce identifiers** (`reduceIdents`) - Minify animation/counter names
- **Merge rules** (`mergeRules`) - Combine duplicate selectors
- **CSS declaration sorting** (`cssDeclarationSorter`) - Consistent property order
- **Z-index safety** (`zindex: false`) - Don't modify z-index values

**Full configuration in `postcss.config.js`:**
```javascript
cssnano: {
  preset: ['advanced', {
    reduceIdents: true,
    mergeRules: true,
    cssDeclarationSorter: true,
    zindex: false  // Safety
  }]
}
```

### Expected Reduction

| File | Original | Minified | Reduction |
|------|----------|----------|-----------|
| style.css | 120KB | 65KB | 46% |
| components.css | 28KB | 15KB | 46% |
| **Average** | - | - | **50-60%** |

**Additional gain over default preset:** 5-15%

---

## 3. Bundling

**Script:** `scripts/lib/build-bundle.sh`
**Output:** `frontend/shared/static/js/budgetShared.js`

### Bundle Contents

**budgetShared.js combines:**
1. **DateFormatter** - Date formatting utilities (DD.MM.YYYY ↔ YYYY-MM-DD)
2. **CalendarWidget** - DaisyUI calendar picker (single/range mode)
3. **ChoicesCategoryTree** - Category selector with hierarchy support

**Bundle structure:**
```javascript
(function(window) {
    'use strict';

    // Module 1: DateFormatter
    class DateFormatter { ... }

    // Module 2: CalendarWidget
    class CalendarWidget { ... }

    // Module 3: ChoicesCategoryTree
    class ChoicesCategoryTree { ... }

    // Export namespace
    window.BudgetShared = {
        DateFormatter,
        CalendarWidget,
        ChoicesCategoryTree
    };

    // Legacy global exports
    window.DateFormatter = DateFormatter;
    window.CalendarWidget = CalendarWidget;
    window.ChoicesCategoryTree = ChoicesCategoryTree;
})(window);
```

**Bundle size:**
- Unminified: ~56KB
- Minified: ~25KB (55% reduction)
- Gzipped: ~7KB (87% reduction)

---

## 4. Gzip Pre-Compression

**Script:** `scripts/precompress-assets.sh`
**Compression level:** gzip -9 (maximum)
**nginx config:** `gzip_static on;`

### Process

1. Compress all `.min.js` files → `.min.js.gz`
2. Compress all `.min.css` files → `.min.css.gz`
3. Compress service worker → `sw.min.js.gz`
4. Compress PWA manifest → `manifest.json.gz`

### nginx Configuration

**Add to nginx config:**
```nginx
location ~* \.(js|css|json)$ {
    gzip_static on;           # Serve pre-compressed .gz files
    expires 1y;               # Long cache (files have version query params)
    add_header Cache-Control "public, immutable";
}
```

**How it works:**
1. Browser requests `/static/js/budgetShared.min.js` with `Accept-Encoding: gzip`
2. nginx checks if `/static/js/budgetShared.min.js.gz` exists
3. nginx serves `.gz` file directly (no runtime compression)
4. Browser decompresses automatically

### Expected Reduction

| Asset Type | Minified | Gzipped | Total Reduction |
|------------|----------|---------|-----------------|
| JavaScript | 100% | 35-40% | 60-65% |
| CSS | 100% | 25-30% | 70-75% |
| Service Worker | 100% | 30-35% | 65-70% |

**Average delivery reduction:** 60-70% vs minified files

---

## Build Commands

### Individual Steps

```bash
# CSS only
npm run build:css

# Bundle shared modules
npm run bundle

# Minify JavaScript only
npm run minify:js

# Minify CSS only
npm run minify:css

# Gzip pre-compression only
npm run precompress

# Validate minified files
npm run validate:minified
```

### Development Workflow

```bash
# Watch CSS changes (auto-rebuild)
npm run watch:css
```

### Full Build

```bash
# Complete production build
npm run build
```

---

## Development vs Production Build Requirements

### Development Mode (IMPORTANT)

**Rule:** During development, minification is NOT required. Only syntax validation is mandatory.

**Quick Development Cycle:**
```bash
# ✅ REQUIRED: Syntax check only
python -m py_compile backend/app/main.py
node --check frontend/web/static/js/app.js

# ❌ NOT REQUIRED during development
npm run minify:js    # Skip during active development
npm run minify:css   # Skip during active development
```

**When to Skip Minification:**
- Local testing with `uvicorn --reload`
- Hot-reload development
- Iterative bug fixes
- PRD implementation drafts

**When Minification IS Required:**
1. Before committing to `main` branch
2. Before creating pull requests
3. Before deployment to staging/production
4. When testing Service Worker cache busting

**Rationale:**
- Minification adds 30-60 seconds to build time
- Development focuses on functionality first
- Syntax errors caught by linters/type checkers
- Final optimization happens in CI/CD pipeline

**Development workflow:**
```bash
# ✅ Quick iteration cycle
# 1. Edit code
vim frontend/web/static/js/app.js

# 2. Syntax check ONLY
node --check frontend/web/static/js/app.js

# 3. Test locally
uvicorn backend.app.main:app --reload

# 4. When ready to commit → THEN minify
npm run build
git add . && git commit -m "feat: new feature"
```

---

## Cache Busting

**Script:** `scripts/update-cache-busting.sh`
**Version:** 6.5.4+

### Overview

Cache busting system ensures browser cache invalidation on deployment by replacing PLACEHOLDER tokens with version timestamps.

**Files processed:**
1. Service Worker (`sw.min.js`) - `CACHE_VERSION` constant
2. HTML templates (17+ files) - `?v=PLACEHOLDER` query parameters

**Version format:** `v{YYYYMMDD}_{HHMM}` (e.g., `v20251230_1830`)

### PLACEHOLDER Token Validation

**Critical:** PLACEHOLDER tokens MUST be replaced before deployment.

**Files with PLACEHOLDER:**
- `frontend/web/static/js/service-worker.js` - `const CACHE_VERSION = 'PLACEHOLDER';`
- All HTML templates - `<script src="/static/js/file.js?v=PLACEHOLDER">`

**Replacement Process:**
1. `npm run build` minifies files
2. `scripts/update-cache-busting.sh` replaces PLACEHOLDER with timestamp
3. Script validates zero PLACEHOLDER tokens remain

**Example:**
```javascript
// Before (source file):
const CACHE_VERSION = 'PLACEHOLDER';  // ✅ Valid - will be replaced

// After minification + cache busting:
const CACHE_VERSION="v20250103_143022";  // ✅ Replaced by script
```

**HTML templates:**
```html
<!-- Before -->
<script src="/static/js/file.js?v=PLACEHOLDER"></script>

<!-- After -->
<script src="/static/js/file.js?v=v20250103_143022"></script>
```

### Execution Order (CRITICAL)

**Correct order in deploy.sh (v6.5.3+):**
```bash
# 1. Minify files first
npm run build  # Creates sw.min.js from sw.js

# 2. THEN run cache busting
bash scripts/update-cache-busting.sh  # Updates sw.min.js
```

**Why order matters:**
- Cache busting BEFORE minification → changes overwritten ❌
- Cache busting AFTER minification → changes preserved ✅

### Troubleshooting Cache Busting

#### Error: PLACEHOLDER token corrupted or missing

**Error message:**
```bash
[CRITICAL] Failed to update cache busting versions!
[ERROR] PLACEHOLDER still present after cache busting
```

**Cause:** Manual edits removed PLACEHOLDER or changed assignment pattern

**Fix:**
```bash
# 1. Restore PLACEHOLDER in correct format
const CACHE_VERSION = 'PLACEHOLDER';  // Must match exactly

# 2. Verify pattern
grep "const CACHE_VERSION = 'PLACEHOLDER'" frontend/web/static/js/service-worker.js

# 3. Re-run build
npm run build
bash scripts/update-cache-busting.sh
```

#### Error: sed pattern failed to replace PLACEHOLDER

**Symptoms:** Script reports success but PLACEHOLDER still exists

**Cause:** Quote style mismatch (single vs double quotes) or spacing issues

**Fix:**
```bash
# Check current syntax in minified file
grep "CACHE_VERSION" frontend/web/static/js/sw.min.js

# Script supports both patterns (v6.5.4+):
# const CACHE_VERSION="v..."  (minified, double quotes, no spaces)
# const CACHE_VERSION = 'v...'  (source, single quotes, with spaces)

# Verify script version
head -10 scripts/update-cache-busting.sh | grep "Version"
# Should be v6.5.4 or higher
```

#### Error: File permissions prevent replacement

**Symptoms:** Script shows "FAILED" for multiple files

**Diagnosis:**
```bash
# Check file permissions
ls -l frontend/web/templates/*.html
# Should be: -rw-r--r-- (644)

# Check if script can write
touch /opt/budget/frontend/web/templates/test.txt
# If fails → permission issue
```

**Fix:**
```bash
# Fix permissions
chmod 644 frontend/web/templates/*.html
chmod 644 frontend/web/static/js/sw.min.js

# Re-run cache busting
bash scripts/update-cache-busting.sh
```

#### Error: Missing sed/perl

**Symptoms:** Command not found errors

**Fix:**
```bash
# Check if sed installed
which sed
# Expected: /usr/bin/sed

# Install if missing
sudo apt-get install -y sed

# Re-run deployment
cd ~/familyBudget
sudo ./deploy.sh --patch
```

### Validation Command

**Post-deployment check:**
```bash
# Verify zero PLACEHOLDER tokens in production
grep -r "PLACEHOLDER" /opt/budget/frontend/web/templates/*.html | wc -l
# Expected output: 0

# Check Service Worker version
grep "CACHE_VERSION" /opt/budget/frontend/web/static/js/sw.min.js
# Expected output: const CACHE_VERSION="v20250103_..."
```

**Pre-deployment check (repository):**
```bash
# Source files SHOULD have PLACEHOLDER (by design)
grep -r "PLACEHOLDER" frontend/web/templates/*.html | wc -l
# Expected output: 17+ (templates keep PLACEHOLDER in git)
```

### Related Files

**Created:**
- `scripts/update-cache-busting.sh` - Comprehensive cache busting (v6.5.2+)

**Deprecated:**
- `scripts/update-sw-version.sh` - Old SW-only script (not called by deploy.sh)

**Modified:**
- `deploy.sh` - Integrates cache busting post-build

**See:** `/docs/architecture/cache-busting-fix.md` for complete troubleshooting guide (to be merged)

---

## Performance Benchmarks

**Build times (local development machine):**
- CSS compilation (Tailwind): ~2-3 seconds
- Module bundling: ~1 second
- JS minification: ~5-7 seconds
- CSS minification: ~2-3 seconds
- Gzip pre-compression: ~3-5 seconds
- **Total:** ~15-20 seconds

**File size benchmarks:**

| Metric | Before Optimization | After Optimization | Improvement |
|--------|---------------------|-------------------|-------------|
| Total JS (raw) | 2.3MB | 2.05MB | 11% |
| Total JS (gzipped) | 650KB | 450KB | 31% |
| Total CSS (raw) | 384KB | 325KB | 15% |
| Total CSS (gzipped) | 95KB | 70KB | 26% |
| **Total delivery** | **745KB** | **520KB** | **30%** |

---

## Configuration Files

### .terserrc.json

Advanced JavaScript minification. See section 1 above.

**Location:** `/home/ikeniborn/Documents/Project/familyBudget/.terserrc.json`

### postcss.config.js

Advanced CSS minification via cssnano. See section 2 above.

**Location:** `/home/ikeniborn/Documents/Project/familyBudget/postcss.config.js`

### .cssnanorc.json (Optional)

Alternative cssnano configuration format. Currently unused (postcss.config.js takes precedence).

**Location:** `/home/ikeniborn/Documents/Project/familyBudget/.cssnanorc.json`

---

## Troubleshooting

### Issue: Minified JS breaks application

**Symptoms:** Application doesn't load, console shows syntax errors

**Diagnosis:**
```bash
# Check source file syntax
node -c frontend/web/static/js/yourfile.js

# Check minified file syntax
node -c frontend/web/static/js/yourfile.min.js
```

**Solutions:**
1. Disable aggressive optimizations in `.terserrc.json`:
   ```json
   {
     "compress": {
       "unsafe_arrows": false,
       "unsafe_math": false
     }
   }
   ```

2. Check for global variable conflicts (reserved names in `.terserrc.json`)

3. Test in different browsers (Chrome, Firefox, Safari)

### Issue: Minified CSS looks wrong

**Symptoms:** Styles broken, animations don't work, incorrect colors

**Diagnosis:**
```bash
# Compare before/after
diff frontend/web/static/css/style.css frontend/web/static/css/style.min.css
```

**Solutions:**
1. Disable identifier reduction:
   ```javascript
   reduceIdents: false
   ```

2. Check vendor prefixes (autoprefixer may conflict)

3. Verify z-index values unchanged (`zindex: false` should prevent this)

### Issue: Build hangs

**Symptoms:** npm run build never completes

**Diagnosis:**
```bash
# Check for zombie processes
ps aux | grep -E "(terser|postcss|node)"

# Kill zombies
pkill -9 -f terser
pkill -9 -f postcss
```

**Solutions:**
1. Reduce timeout in `scripts/lib/minify.sh` (currently 60s)
2. Check for infinite loops in source files
3. Clear npm cache: `npm cache clean --force`

### Issue: nginx not serving .gz files

**Symptoms:** No size reduction in network tab, missing Content-Encoding header

**Diagnosis:**
```bash
# Check if .gz files exist
find frontend/web/static -name "*.gz" | head -5

# Test nginx config
nginx -t

# Check with curl
curl -H "Accept-Encoding: gzip" -I http://localhost/static/js/budgetShared.min.js
# Should see: Content-Encoding: gzip
```

**Solutions:**
1. Verify `gzip_static on;` in nginx.conf
2. Check file permissions on .gz files: `chmod 644 *.gz`
3. Restart nginx: `docker compose restart nginx`
4. Check nginx error logs: `docker compose logs nginx`

---

## Future Improvements

### Short-term
- [ ] Add bundle size analysis dashboard
- [ ] Implement code-splitting by page/feature
- [ ] Add source map generation for debugging (dev only)
- [ ] Create automated visual regression testing

### Medium-term
- [ ] Migrate to esbuild for 10-100x faster builds
- [ ] Implement differential loading (modern vs legacy bundles)
- [ ] Add real user monitoring (RUM) for performance metrics
- [ ] Tree-shaking optimization for vendor libraries

### Long-term
- [ ] Evaluate frontend framework migration (Vue 3 / React)
- [ ] Implement HTTP/3 and early hints
- [ ] Add edge caching strategy (CDN)
- [ ] Progressive hydration for faster TTI

---

## Related Documentation

- [Frontend Optimization Summary](frontend-optimization-summary.md) - Overview of all optimization phases
- [Web Workers](web-workers.md) - Worker architecture and performance gains
- [PWA](pwa.md) - Service worker caching strategy
- [Caching Strategy](caching-strategy.md) - Multi-layer caching approach
- [CLAUDE.md](/CLAUDE.md) - Build system usage in development workflow

---

## Change Log

**2025-12-27 (v5.7.0):**
- 🔇 **Console logging cleanup**: Configured Terser to drop console.log/info/debug in production
- ⚠️ **Fixed toplevel minification**: Disabled toplevel to prevent identifier conflicts between files
- Added comprehensive documentation for console dropping and toplevel limitations
- Preserves console.warn and console.error for production debugging
- Additional ~2-5% file size reduction from console removal

**2025-12-26 (v5.6.0):**
- Added advanced Terser configuration (3-8% additional compression)
- Added advanced cssnano configuration (5-15% additional compression)
- Implemented gzip pre-compression (60-70% delivery reduction)
- Updated build pipeline with all optimizations
- Created comprehensive build documentation

**2025-11-08 (v5.3.0):**
- Added timeout protection to prevent zombie processes
- Added Web Workers directory to minification pipeline
- Improved error handling and reporting

**2025-11-05 (v1.0.0):**
- Initial build system implementation
- Basic Terser and cssnano integration
- Bundle creation for budgetShared.js
