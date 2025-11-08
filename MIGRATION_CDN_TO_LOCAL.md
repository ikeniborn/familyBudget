# CDN to Local Vendor Migration

**Date:** 2025-11-07
**Version:** 5.0.0-beta
**Branch:** feature/cdn-to-local-migration

---

## Summary

Migrated all critical CDN dependencies to local vendor files for better performance, security, and offline capability.

**Before:** 1334KB (184KB local + 1150KB CDN)
**After:** 1161KB (1161KB local + 0KB CDN except Telegram SDK)

---

## Changes

### 1. npm Build System

**Files Created:**
- `tailwind.config.js` - Tailwind CSS + DaisyUI configuration
- `frontend/web/static/css/tailwind.input.css` - Tailwind input file

**Files Updated:**
- `package.json` - Added Tailwind CSS, DaisyUI, and build scripts

**Build Command:**
```bash
npm run build:css  # Builds Tailwind + DaisyUI to vendor/tailwind-daisyui.min.css
```

---

### 2. Vendor Files Downloaded

| Library | Version | Size | Location |
|---------|---------|------|----------|
| **HTMX** | 1.9.10 | 47KB | `frontend/web/static/js/vendor/htmx.min.js` |
| **ECharts** | 5.5.0 | 1006KB | `frontend/web/static/js/vendor/echarts.min.js` |
| **Tailwind CSS + DaisyUI** | 3.4.0 + 4.12.14 | 108KB | `frontend/web/static/css/vendor/tailwind-daisyui.min.css` |

**Total:** 1161KB (all minified)

---

### 3. HTML Templates Updated

**frontend/web/templates/base.html:**
- ❌ Removed: CDN Tailwind CSS (`cdn.tailwindcss.com`)
- ❌ Removed: CDN DaisyUI (`cdn.jsdelivr.net`)
- ❌ Removed: CDN HTMX (`unpkg.com`)
- ❌ Removed: Inline Tailwind config (migrated to `tailwind.config.js`)
- ✅ Added: Local Tailwind+DaisyUI (`/static/css/vendor/tailwind-daisyui.min.css?v=PLACEHOLDER`)
- ✅ Added: Local HTMX (`/static/js/vendor/htmx.min.js?v=PLACEHOLDER`)

**frontend/web/templates/analytics.html:**
- ❌ Removed: CDN ECharts
- ✅ Added: Local ECharts (`/static/js/vendor/echarts.min.js?v=PLACEHOLDER`)

**frontend/web/templates/admin_dashboard.html:**
- ❌ Removed: CDN ECharts
- ✅ Added: Local ECharts (`/static/js/vendor/echarts.min.js?v=PLACEHOLDER`)

**frontend/webapp/*.html (9 files):**
- ✅ Kept: Telegram Web App SDK on CDN (official API, auto-updates)

---

### 4. Deployment Integration

**deploy.sh:**
- ✅ Already runs `npm run build` (line 372)
- ✅ Automatically executes Tailwind CSS build through updated `package.json`
- ✅ No changes needed

**cache_busting.sh:**
- ✅ Already supports `vendor/*.js` and `vendor/*.css` through regex (lines 68-69)
- ✅ New vendor files automatically versioned

---

## Testing

**Unit Tests Created:**
- `tests/unit/test_vendor_integration.py` - 17 tests covering:
  - Vendor files existence
  - HTML templates updated
  - Build configuration
  - Cache busting integration

**Run Tests:**
```bash
pytest tests/unit/test_vendor_integration.py -v
```

---

## Deployment

### Development

```bash
cd ~/familyBudget
git checkout feature/cdn-to-local-migration
npm install          # Install dependencies
npm run build:css    # Build Tailwind CSS
```

### Production

```bash
cd ~/familyBudget
git checkout feature/cdn-to-local-migration
./deploy.sh --profile full
```

**Automatic Steps:**
1. Syncs code to `/opt/budget`
2. Runs `npm install`
3. Runs `npm run build` (includes `build:css`)
4. Updates cache versions (`?v=TIMESTAMP`)
5. Builds Docker images
6. Starts services

---

## Verification

### Check Vendor Files Exist

```bash
ls -lh frontend/web/static/js/vendor/
# htmx.min.js (47K)
# echarts.min.js (1006K)
# choices.min.js (74K) - existing

ls -lh frontend/web/static/css/vendor/
# tailwind-daisyui.min.css (108K)
# choices.min.css (7.6K) - existing
```

### Check HTML Templates

```bash
# No CDN links (except Telegram SDK)
grep -r "cdn.tailwindcss.com\|cdn.jsdelivr.net\|unpkg.com" frontend/web/templates/
# Should return: 0 matches

# Local vendor paths exist
grep -r "vendor.*?v=PLACEHOLDER" frontend/web/templates/base.html
# Should return: htmx.min.js, tailwind-daisyui.min.css
```

### Check Cache Busting Works

```bash
# After deploy.sh, check versions updated
grep "?v=" /opt/budget/frontend/web/templates/base.html
# Should show timestamps like: ?v=20251107_2350
```

---

## Rollback (if needed)

```bash
git checkout webapp  # Return to webapp branch
./deploy.sh --profile full
```

---

## Benefits

### Performance
- ✅ Faster page load (no external DNS lookups)
- ✅ Fewer HTTP requests (bundled CSS)
- ✅ Better caching control (cache busting)

### Security
- ✅ No CDN supply chain attacks
- ✅ Content Security Policy compliance
- ✅ No external dependencies failures

### Reliability
- ✅ Works offline
- ✅ No CDN downtime impact
- ✅ Version control of all assets

---

## Notes

- **Telegram Web App SDK** intentionally kept on CDN (official API, always up-to-date)
- **Tailwind CSS** now built at deploy time (production-ready)
- **Choices.js** already local (no changes)
- **Cache busting** automatic for all vendor files

---

## Troubleshooting

### "tailwindcss: not found" during build

**Problem:**
```bash
sh: 1: tailwindcss: not found
```

**Cause:** Direct `tailwindcss` command not in PATH (only in `node_modules/.bin/`)

**Solution:** Use `npx tailwindcss` instead (automatically finds in node_modules)

**Fixed in:** package.json lines 7-8
```json
"build:css": "npx tailwindcss -i ... -o ... --minify"
"watch:css": "npx tailwindcss -i ... -o ... --watch"
```

### Verify build works

```bash
npm run build:css
# Should output: "Done in ~1500ms"

ls -lh frontend/web/static/css/vendor/tailwind-daisyui.min.css
# Should be: ~108-114KB
```

### "could not determine executable to run" during deployment

**Problem:**
```bash
npm error could not determine executable to run
warningMinification failed or skipped, continuing with unminified assets
```

**Cause:** `tailwindcss` (and other npm packages) not installed - `node_modules` missing or incomplete

**Root Cause:** Deploy script should NOT install dependencies - that's install.sh's job

**Solution:**

**Architecture change - Separation of concerns:**

1. **install.sh** - Handles ALL dependency installation (run once):
   - Installs Node.js 20.x LTS + npm
   - Runs `npm install` in repository (`~/familyBudget`)
   - Creates `~/familyBudget/node_modules`

2. **deploy.sh** - Only uses dependencies (run on every deployment):
   - Syncs `~/familyBudget` → `/opt/budget` (includes `node_modules`)
   - Checks `node_modules` exists (error if missing)
   - Runs `npm run build` (Tailwind CSS + minification)

**Fixed in:**
- `install.sh` lines 415-494, 628-632 - Added Node.js/npm installation
- `deploy.sh` lines 363-386 - Removed npm install, added check
- `package.json` line 7 - Use `npx tailwindcss` (previous fix)

**Deployment workflow:**
```bash
# 1. First time setup (or after package.json changes)
cd ~/familyBudget
sudo ./install.sh
# → Installs Node.js, npm, runs npm install

# 2. Every deployment
cd ~/familyBudget
./deploy.sh --profile full
# → Syncs code + node_modules, runs npm run build
```

**When to re-run install.sh:**
- First time setup
- After `package.json` changes (new dependencies)
- If deploy fails with "could not determine executable to run"
- After Node.js version upgrade

### "could not determine executable to run" with tailwindcss@4.x

**Problem:**
```bash
npm error could not determine executable to run
verbose pkgid tailwindcss@4.1.17
```

**Cause:** npm installed Tailwind CSS 4.x instead of 3.x due to version ranges

**Why this happened:**
- `package.json` had `"tailwindcss": "^3.4.0"`
- Symbol `^` allows minor version updates
- npm installed newer 4.x version (breaking changes!)
- Tailwind CSS 4.x has completely different CLI API

**Solution:** Pin exact versions (remove `^` and `~`)

**Fixed in:** package.json lines 28-39
```json
"devDependencies": {
  "tailwindcss": "3.4.15",  // ← Exact version, not ^3.4.0
  "daisyui": "4.12.14",     // ← All versions pinned
  "@tailwindcss/forms": "0.5.9",
  ...
}
```

**Why pin versions:**
- **Predictability:** Same versions in dev/staging/production
- **No surprises:** Breaking changes won't auto-install
- **Reproducibility:** `npm install` always installs exact versions
- **Production best practice:** Version ranges for libraries, exact versions for apps

**Re-install after version fix:**
```bash
cd ~/familyBudget
rm -rf node_modules package-lock.json
npm install
npm run build:css  # Should work now
```

**Verify correct version:**
```bash
npm list tailwindcss
# Should show: tailwindcss@3.4.15 (not 4.x)
```

---

**Migration Status:** ✅ COMPLETE
**Tested:** ✅ Unit tests passed
**Ready for Merge:** ✅ YES
