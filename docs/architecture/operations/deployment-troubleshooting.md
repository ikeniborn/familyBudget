# Deployment Troubleshooting Guide

This guide helps diagnose and resolve common deployment issues in the Family Budget project.

---

## ⚠️ IMPORTANT: Registry-First Architecture (v9.0+)

**Since v9.0**, deployment uses **registry-first mode**:
- ✅ All building happens in GitHub Actions CI/CD
- ✅ Server only **pulls ready Docker images** from ghcr.io
- ❌ **No npm/Node.js required** on production server
- ❌ **No local building** (frontend, dependencies)

**Old troubleshooting sections** (npm installation, build errors) are **OBSOLETE** in v9.0.

See [Registry-First Migration Guide](#registry-first-migration-v90) below for updated workflows.

---

## ~~Network Hang During npm Installation~~ (OBSOLETE in v9.0)

**DEPRECATED:** This section applies to **legacy v8.x build mode only**.

In **v9.0+ registry-first mode**, npm is **NOT used** on production server:
- Frontend builds in GitHub Actions CI/CD
- Dependencies embedded in Docker images
- Server pulls ready images from ghcr.io

**If you see npm errors in v9.0**, your deployment is misconfigured. See [Registry-First Migration](#registry-first-migration-v90).

### Automatic Recovery (v6.5.5+)

The deployment script now includes automatic timeout and retry:

1. **Timeout after 15 minutes** → npm command killed (exit code 124)
2. **Wait 5-60 seconds** (exponential backoff: 5s → 10s → 20s)
3. **Retry** (up to 3 attempts total)
4. **Success on any attempt** → deployment continues
5. **Failure after 3 attempts** → deployment aborts with clear error

**Example output:**
```bash
[INFO] Installing npm packages (timeout: 900s, retry: 3x)...
[INFO] [1/3] npm ci...
# ... timeout after 15 minutes ...
[WARNING] Attempt 1 failed (exit code 124 - timeout). Retrying in 5 seconds...
[INFO] [2/3] npm ci...
# ... succeeds ...
[SUCCESS] npm ci (succeeded on attempt 2)
```

### Manual Diagnostics

If automatic recovery fails after 3 attempts, perform these checks:

#### 1. Check Network Connectivity

```bash
# Ping npm registry
ping -c 5 registry.npmjs.org

# HTTP connectivity test
curl -I https://registry.npmjs.org

# DNS resolution test
nslookup registry.npmjs.org
```

**Expected:** Successful responses within 1-2 seconds

**If fails:** Network/firewall issue preventing npm access

#### 2. Check npm Registry Configuration

```bash
# Verify registry URL
npm config get registry
# Expected: https://registry.npmjs.org/

# Check proxy settings (if corporate network)
npm config get proxy
npm config get https-proxy
```

**If proxy required:** Configure npm proxy:
```bash
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

#### 3. Check Disk Space

```bash
# Check available space
df -h /opt/budget
df -h ~/.npm

# Expected: At least 2GB free
```

**If low:** Clean npm cache:
```bash
npm cache clean --force
```

### Manual Workarounds

#### Workaround 1: Increase Timeout (Slow Network)

For very slow networks, increase the npm timeout:

```bash
# Set custom timeout (30 minutes instead of 15)
TIMEOUT_NPM_INSTALL=1800 sudo -E ./deploy.sh

# Or set permanently in .env
echo "TIMEOUT_NPM_INSTALL=1800" >> .env
sudo ./deploy.sh
```

#### Workaround 2: Pre-download Packages

Install packages manually before deployment:

```bash
# Navigate to repository
cd ~/familyBudget

# Install packages locally (with retry)
npm ci --prefer-offline --no-audit

# Verify node_modules created
ls -la node_modules/

# Deploy with sync-mode update (copies node_modules)
sudo ./deploy.sh --sync-mode update --cleanup-mode smart
```

#### Workaround 3: Use Mirror Registry

If npm registry is blocked, use a mirror:

```bash
# China mirror (Taobao)
npm config set registry https://registry.npmmirror.com

# Alternative: Yarn registry
npm config set registry https://registry.yarnpkg.com

# Deploy
sudo ./deploy.sh

# Restore default registry
npm config set registry https://registry.npmjs.org/
```

#### Workaround 4: Emergency Skip (Dangerous)

**WARNING:** Only use if /opt/budget/node_modules already exists and is up-to-date

```bash
# Skip npm install entirely
sudo ./deploy.sh --sync-mode skip
```

**Risks:**
- Outdated dependencies
- Missing new packages
- Version mismatches

### Prevention Strategies

#### 1. Enable Offline Mode

Configure npm to prefer offline cache:

```bash
# Already default in deploy.sh
npm ci --prefer-offline --no-audit
```

#### 2. Configure npm Cache

Pre-populate npm cache on slow networks:

```bash
# Set npm cache location
npm config set cache ~/.npm-cache

# Pre-download all dependencies
cd ~/familyBudget
npm ci

# Cache now populated - next install faster
```

#### 3. Monitor Network Quality

Before deployment, test network to npm registry:

```bash
# Simple connectivity test
time curl -I https://registry.npmjs.org

# Expected: < 2 seconds
# If > 5 seconds: Slow network - consider increasing timeout
```

### Related Configuration

**Environment variables** (optional override in .env or command line):

```bash
# npm timeout (seconds)
TIMEOUT_NPM_INSTALL=900   # Default: 15 minutes

# Retry attempts
MAX_RETRY_ATTEMPTS=3      # Default: 3 retries

# Retry delays (exponential backoff)
RETRY_BASE_DELAY=5        # Default: 5 seconds initial
RETRY_MAX_DELAY=60        # Default: 60 seconds maximum
```

**Example custom configuration:**
```bash
# .env file
TIMEOUT_NPM_INSTALL=1800  # 30 minutes for very slow networks
MAX_RETRY_ATTEMPTS=5      # 5 retries instead of 3
```

### See Also

- [Installation Resilience Framework](../installation-resilience.md) - Timeout and retry infrastructure
- [Architecture README](../README.md#deployment-resilience-v655) - v6.5.5 changes
- [Deploy Script](../../../deploy.sh) - Implementation details
- [Timeout Module](../../../scripts/lib/timeout.sh) - Retry logic

---

## Backup Automation Not Working

**Since:** v6.8.1 - Critical error visibility improved

### Symptoms

- ✅ Manual backup works: `sudo bash /opt/budget/scripts/backup.sh`
- ❌ Automatic daily backups do NOT run
- No backup files created for recent days (gaps in `/opt/budget/backups/`)
- S3 uploads do NOT happen automatically

### Root Cause

**cron package NOT installed** on the server

During deployment, `setup_backup_cron()` checks for `crontab` command:
- If NOT found → shows CRITICAL ERROR (v6.8.1+)
- Previously (v6.8.0 and earlier) → silent warning, easily missed

### Diagnostic Steps

**1. Check if cron is installed:**
```bash
which crontab
# Expected: /usr/bin/crontab
# If error: command not found → cron NOT installed
```

**2. Check cron daemon status:**
```bash
sudo systemctl status cron
# Expected: Active: active (running)
# If error: Unit cron.service not found → cron NOT installed
```

**3. Check crontab entries:**
```bash
sudo crontab -l
# Expected: 0 2 * * * /bin/bash /opt/budget/scripts/backup.sh ...
# If error: crontab: command not found → cron NOT installed
```

**4. Check backup logs:**
```bash
ls -lh /opt/budget/backups/logs/
# Should see daily logs: backup_YYYYMMDD.log
# If missing days → backups not running
```

### Solution

**Step 1: Install cron**
```bash
# On budget-prod server
sudo apt-get update
sudo apt-get install -y cron
sudo systemctl enable cron
sudo systemctl start cron
sudo systemctl status cron  # Verify running
```

**Step 2: Configure backup cron job**

**Option A: Re-run deployment (recommended)**
```bash
cd ~/familyBudget
git pull origin main  # Get latest with cron fixes
sudo ./deploy.sh
# deploy.sh will automatically call setup_backup_cron()
```

**Option B: Manual crontab configuration**
```bash
sudo crontab -e
# Add this line:
0 2 * * * /bin/bash /opt/budget/scripts/backup.sh >> /opt/budget/logs/backup.log 2>&1
```

**Step 3: Verify cron job configured**
```bash
sudo crontab -l | grep backup
# Expected output:
# 0 2 * * * /bin/bash /opt/budget/scripts/backup.sh >> /opt/budget/logs/backup.log 2>&1
```

**Step 4: Test automated backup**
```bash
# Option 1: Wait until 2:00 AM and check logs next day
cat /opt/budget/backups/logs/backup_$(date +%Y%m%d).log

# Option 2: Trigger cron manually for immediate test
sudo run-parts /etc/cron.daily  # If backup.sh is in cron.daily
# OR
sudo -i /bin/bash /opt/budget/scripts/backup.sh --verbose
```

### Prevention

**install.sh now installs cron automatically (v6.8.1+)**

New servers should run:
```bash
cd ~/familyBudget
sudo ./install.sh  # Installs cron + all dependencies
```

**Deployment warning improved (v6.8.1+)**

If cron missing, deployment shows:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: cron package NOT installed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  WITHOUT CRON:
  • Daily backups will NOT run automatically
  • S3 uploads will NOT happen
  • Risk of DATA LOSS

REQUIRED ACTION:
  sudo apt-get install -y cron && sudo systemctl enable cron
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Verification Checklist

After fixing, verify automation works:

- [ ] `which crontab` → returns `/usr/bin/crontab`
- [ ] `sudo systemctl status cron` → Active: active (running)
- [ ] `sudo crontab -l` → shows backup job at 2:00 AM
- [ ] Wait 24 hours, check `/opt/budget/backups/` for new backup file
- [ ] Check S3 bucket for new backup: `python3 scripts/s3_backup.py list --bucket <name>`

### See Also

- [Backup System Architecture](../backup-system.md#критические-зависимости) - Cron dependency details
- [Backup Operations Guide](backup-operations.md) - Daily/weekly checks

---

## Build Artifact Validation Failures

**Since:** v6.6.1 - Comprehensive artifact validation prevents stale asset deployment

### Symptoms

- Deployment aborts after frontend build with error:
  ```
  ▶ Validating Build Artifacts
  [INFO] Checking critical build artifacts...

  [ERROR] ❌ Missing: lists.min.js
  [ERROR] ❌ Bundle too small: budgetShared.min.js (234B, expected >1KB)

  ═══════════════════════════════════════════════════════════
        BUILD ARTIFACT VALIDATION FAILED
  ═══════════════════════════════════════════════════════════

  Some critical files are missing or invalid after build.
  Checksums will NOT be saved - next deploy will rebuild.

  DEPLOYMENT ABORTED
  ```

- Service Worker PLACEHOLDER not replaced:
  ```
  [ERROR] ❌ CACHE_VERSION_PLACEHOLDER still present in sw.min.js
  [ERROR]    Cache busting failed - PWA will not work correctly
  ```

- Legacy minification failure (hierarchyView.js or lists.css):
  ```
  [ERROR] Failed to minify hierarchyView.js
  [ERROR] This file is critical - cannot continue
  ```

### What Changed (v6.6.1)

**Before v6.6.1:**
- Frontend build checksums saved **immediately after build**
- If build succeeded but produced incomplete artifacts → checksums still saved
- Next deployment skipped rebuild → deployed stale/missing assets

**After v6.6.1:**
- Added comprehensive `validate_build_artifacts()` function
- Validates ALL critical files before saving checksums:
  - Service Worker: `sw.min.js` + `sw.min.js.gz`
  - CSS files: `tailwind-daisyui.min.css`, `custom.min.css`, `choices-tailwind.min.css`, `daisyui-overrides.min.css`
  - Bundles: `lists.min.js`, `budgetShared.min.js` (must be > 1KB)
  - Legacy files: `hierarchyView.min.js`, `lists.min.css`
  - PLACEHOLDER tokens replaced in Service Worker
- Checksums saved ONLY after successful validation
- Legacy minification failures now **abort deployment** (exit 1) instead of warnings

### Root Causes

#### 1. Vite Build Partial Failure

**Symptom:** Some bundles created, others missing or empty

**Causes:**
- TypeScript compilation errors (silently ignored by Vite)
- Memory exhaustion during build (OOM killer)
- Disk space full mid-build
- File permission issues

**Diagnostic:**
```bash
# Check TypeScript errors
npm run type-check

# Check disk space
df -h /opt/budget

# Check build logs
grep -E "ERROR|FAILED|fatal" /opt/budget/logs/deploy.log | tail -50

# Check bundle sizes
ls -lh /opt/budget/frontend/web/static/js/*.min.js
ls -lh /opt/budget/frontend/shared/static/js/*.min.js
```

#### 2. Legacy Minification Failure (Terser)

**Symptom:** `hierarchyView.min.js` or `lists.min.css` minification fails

**Causes:**
- Invalid JavaScript syntax in `hierarchyView.js`
- Invalid CSS syntax in `lists.css`
- Terser/PostCSS version incompatibility

**Diagnostic:**
```bash
# Check syntax manually
node --check frontend/web/static/js/lists/hierarchyView.js

# Try manual minification
npx terser frontend/web/static/js/lists/hierarchyView.js -o /tmp/test.min.js
```

#### 3. Cache Busting Failure (PLACEHOLDER not replaced)

**Symptom:** `CACHE_VERSION_PLACEHOLDER` still present in `sw.min.js`

**Causes:**
- `update-cache-busting.sh` failed
- `.cache-version` file not created
- `sed` replacement failed

**Diagnostic:**
```bash
# Check cache version file
cat /opt/budget/.cache-version

# Check Service Worker for PLACEHOLDER
grep -n "PLACEHOLDER" /opt/budget/sw.min.js

# Check update-cache-busting.sh logs
grep "update-cache-busting" /opt/budget/logs/deploy.log | tail -20
```

### Solutions

#### Quick Fix: Force Rebuild

```bash
# Clear checksums to force rebuild
sudo rm -f /opt/budget/.frontend_build_checksums
sudo rm -f /opt/budget/.docker_build_checksums

# Remove incomplete artifacts
sudo rm -f /opt/budget/sw.min.js
sudo rm -f /opt/budget/frontend/web/static/js/*.min.js
sudo rm -f /opt/budget/frontend/shared/static/js/*.min.js

# Deploy with --force-build flag
cd ~/familyBudget
sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch --force-build
```

#### Fix TypeScript Errors

If validation fails due to missing/empty bundles, check TypeScript:

```bash
cd ~/familyBudget

# Run type-check (same as pre-commit hook)
npm run type-check

# Fix errors in .ts files
vim frontend/web/static/js/offline/offlineManager.ts

# Verify fixes
npm run type-check

# Commit and deploy
git add .
git commit -m "fix: TypeScript errors"
git push origin test
ssh budget-test "cd ~/familyBudget && git pull && sudo bash deploy.sh"
```

#### Fix Legacy File Syntax

If `hierarchyView.js` or `lists.css` fails minification:

```bash
# Find syntax error
node --check frontend/web/static/js/lists/hierarchyView.js
# OR
npx postcss frontend/web/static/css/lists.css --use cssnano -o /tmp/test.min.css

# Fix syntax error
vim frontend/web/static/js/lists/hierarchyView.js

# Test minification manually
npx terser frontend/web/static/js/lists/hierarchyView.js -c -m -o /tmp/test.min.js

# Deploy
git add . && git commit -m "fix: hierarchyView.js syntax"
git push origin test
```

#### Fix Cache Busting

If PLACEHOLDER not replaced:

```bash
# Regenerate cache version
export CACHE_VERSION="v$(date -u +%Y%m%d_%H%M)"
echo "$CACHE_VERSION" > /opt/budget/.cache-version

# Fix ownership (if running with sudo)
sudo chown ikeniborn:ikeniborn /opt/budget/.cache-version

# Run cache busting manually
cd /opt/budget
bash scripts/update-cache-busting.sh

# Verify
grep "CACHE_VERSION" sw.min.js | head -1
# Expected: const CACHE_VERSION = "v20260111_0822";
```

### Prevention

#### 1. Always Run Type-Check Before Deploy

```bash
# Pre-commit hook runs this automatically (v7.1.0+)
npm run type-check

# If errors found:
# - Fix .ts files
# - Commit fixes
# - Then deploy
```

#### 2. Monitor Build Logs

```bash
# After deployment, check for warnings
grep -E "WARNING|WARN" /opt/budget/logs/deploy.log | tail -20

# Check bundle sizes
ls -lh /opt/budget/frontend/web/static/js/*.min.js
# All bundles should be > 1KB
```

#### 3. Test Locally Before Deploy

```bash
# On local machine
cd ~/familyBudget
npm run build

# Check artifacts created
ls -lh frontend/web/static/js/*.min.js
ls -lh sw.min.js

# Verify no PLACEHOLDER
grep "PLACEHOLDER" sw.min.js
# Expected: no output (empty)
```

### Validation Details

The `validate_build_artifacts()` function checks:

| Category | Files | Validation |
|----------|-------|------------|
| **Service Worker** | `sw.min.js`, `sw.min.js.gz` | Exists, non-empty, PLACEHOLDER replaced |
| **CSS** | `tailwind-daisyui.min.css`, `custom.min.css`, `choices-tailwind.min.css`, `daisyui-overrides.min.css` | Exists, non-empty |
| **Bundles** | `lists.min.js`, `budgetShared.min.js` | Exists, size > 1KB |
| **Legacy** | `hierarchyView.min.js`, `lists.min.css` | Exists, non-empty |

**Output Example (Success):**
```
▶ Validating Build Artifacts
[INFO] Checking critical build artifacts...

[SUCCESS] ✓ sw.min.js (10889B)
[SUCCESS] ✓ sw.min.js.gz (3517B)
[SUCCESS] ✓ tailwind-daisyui.min.css (182059B)
[SUCCESS] ✓ custom.min.css (44312B)
[SUCCESS] ✓ choices-tailwind.min.css (43450B)
[SUCCESS] ✓ daisyui-overrides.min.css (2048B)
[SUCCESS] ✓ lists.min.js (123914B)
[SUCCESS] ✓ budgetShared.min.js (42281B)
[SUCCESS] ✓ hierarchyView.min.js (19827B)
[SUCCESS] ✓ lists.min.css (19759B)
[SUCCESS] ✓ Service Worker version: v20260111_0822

[SUCCESS] All build artifacts validated successfully
[INFO] Saved frontend build checksums
[SUCCESS] Build artifacts validated and checksums saved
```

### See Also

- [Architecture README - v6.6.1](../README.md#2026-01-11-deploysh-critical-fixes---checksum-validation--cleanup-transparency-v661) - Complete changelog
- [Build System](../build-system.md) - Frontend build pipeline
- [PWA Architecture](../pwa.md) - Service Worker caching

---

## Troubleshooting Registry-First Deployments (v9.0+)

### Ошибка: "npm: command not found"

**Причина**: Legacy код пытается запустить npm на сервере

**Решение**:
1. Проверить версию deploy.sh: `grep "v9.0" deploy.sh`
2. Если v8.x, обновить до v9.0: `git pull origin test`
3. npm НЕ требуется на production сервере

**Проверка**:
```bash
# deploy.sh НЕ ДОЛЖЕН вызывать npm
grep -n "npm install" deploy.sh
# Ожидаемый вывод: нет совпадений (или только комментарии)
```

---

### Ошибка: "validate_build_artifacts failed"

**Причина**: Legacy функция проверяет локальные файлы на хосте

**Решение**:
1. Проверить что функция удалена: `grep -A5 "validate_build_artifacts()" deploy.sh`
2. Артефакты (sw.min.js, bundles) находятся ВНУТРИ Docker образа
3. Валидация происходит в CI/CD (quality-checks job)

**Проверка**:
```bash
# Образ содержит frontend
docker exec familybudget-backend ls -la /app/frontend/web/static/js/
# Ожидаемый вывод: sw.min.js, bundles/*, vendor/*
```

---

### Ошибка: "Frontend build failed"

**Причина**: Сервер пытается собрать frontend локально

**Решение**:
1. Frontend собирается в GitHub Actions (service-build job)
2. Проверить IMAGE_VERSIONS.json существует: `cat ~/familyBudget/IMAGE_VERSIONS.json`
3. Если файл отсутствует, выполнить: `git pull origin test`

**Проверка**:
```bash
# CI/CD создает IMAGE_VERSIONS.json
cat IMAGE_VERSIONS.json | jq '.backend.version'
# Ожидаемый вывод: "6.6.0" (или текущая версия)
```

---

### Ошибка: "Docker image not found in registry"

**Причина**: Образ не был собран в CI/CD или не push'нут в ghcr.io

**Решение**:
1. Проверить GitHub Actions workflow: https://github.com/ikeniborn/familyBudget/actions
2. Найти последний успешный build-and-push run
3. Проверить что все 5 образов push'нуты
4. Проверить VERSION файл: `cat VERSION`

**Проверка**:
```bash
# Проверить наличие образа в registry
docker pull ghcr.io/ikeniborn/familybudget-backend:$(cat VERSION)
# Ожидаемый вывод: Status: Downloaded newer image
```

---

### Миграция v8.x → v9.0

**Если у вас остались legacy функции**:

**1. Backup текущего deploy.sh**:
```bash
cp deploy.sh deploy.sh.v8.backup
```

**2. Pull latest version**:
```bash
git pull origin test
```

**3. Verify v9.0**:
```bash
# Проверить что legacy функции удалены
grep "repair_npm_environment" deploy.sh
# Ожидаемый вывод: только комментарий "REMOVED IN v9.0"
```

**4. Test deployment**:
```bash
sudo bash deploy.sh --sync-mode update --cleanup-mode smart
# Ожидаемое время: 2-3 минуты
```

**Breaking changes**: ОТСУТСТВУЮТ (полная обратная совместимость)

---

## Related Issues

### PostgreSQL Health Check Timeout

See: [Architecture README - v6.5.4](../README.md#2025-12-30-postgresql-health-check-timeout-fix---prevent-deployment-hang-v654)

### Service Worker Files Missing After Build

**Since:** v7.0.1 - Automatic file copying from .vite-build/

#### Symptoms

```
[WARNING] Service Worker files missing after build
[ERROR] ❌ Missing: sw.min.js.gz
```

- Build completes successfully
- Vite creates `sw.js` and `sw.js.gz` in `.vite-build/`
- Files not found in deployment root `/opt/budget/`
- Backend cannot serve Service Worker
- PWA offline mode broken

#### Root Cause

**File Location Mismatch:**
- **Vite output:** `.vite-build/sw.js` + `.vite-build/sw.js.gz` (vite.config.single.ts:74)
- **Backend expectation:** `/opt/budget/sw.min.js` + `/opt/budget/sw.min.js.gz` (v6.8.0+)
- **No automatic copy:** Files stayed in build directory

**Why This Happened:**
1. Vite v7.0.0 migration changed build output structure
2. Plugin order fix (2026-01-12) ensured .gz creation but not file placement
3. No copy step between Vite output and final serving location

#### Quick Fix (Manual)

**Before v7.0.1:**
```bash
# Manual copy required after each deployment
cd /opt/budget
sudo cp .vite-build/sw.js sw.min.js
sudo cp .vite-build/sw.js.gz sw.min.js.gz

# Verify
ls -lh sw.min.js sw.min.js.gz
```

**After v7.0.1:**
```bash
# Automatic copy - no manual intervention needed
# deploy.sh handles file copying at two checkpoints:
# 1. After npm run build:prod (primary)
# 2. During validation (fallback)
```

#### Automatic Fix (v7.0.1+)

Deploy script now includes automatic file copying:

**Primary Copy (deploy.sh:1445-1456):**
```bash
# Copy Service Worker files from .vite-build/ to final location
if [[ -f "$DEPLOY_DIR/.vite-build/sw.js" ]] && [[ -f "$DEPLOY_DIR/.vite-build/sw.js.gz" ]]; then
    cp "$DEPLOY_DIR/.vite-build/sw.js" "$DEPLOY_DIR/sw.min.js"
    cp "$DEPLOY_DIR/.vite-build/sw.js.gz" "$DEPLOY_DIR/sw.min.js.gz"
    print_message success "✓ Service Worker files copied: sw.min.js + sw.min.js.gz"
fi
```

**Fallback Copy (deploy.sh:1585-1596):**
```bash
# Retry during validation if files still missing
if [[ ! -f "$sw_min" ]] || [[ ! -f "$sw_min_gz" ]]; then
    if [[ -f "$DEPLOY_DIR/.vite-build/sw.js" ]] && [[ -f "$DEPLOY_DIR/.vite-build/sw.js.gz" ]]; then
        cp "$DEPLOY_DIR/.vite-build/sw.js" "$DEPLOY_DIR/sw.min.js"
        cp "$DEPLOY_DIR/.vite-build/sw.js.gz" "$DEPLOY_DIR/sw.min.js.gz"
        success "✓ Service Worker files copied from .vite-build/ (fallback)"
    fi
fi
```

#### Verification

**Check files exist:**
```bash
cd /opt/budget
ls -lh sw.min.js sw.min.js.gz .vite-build/sw.js*

# Expected output:
# -rw-r--r-- 1 root root  11K Jan 15 18:48 sw.min.js
# -rw-r--r-- 1 root root 3.8K Jan 15 18:48 sw.min.js.gz
# -rw-r--r-- 1 root root  11K Jan 15 18:48 .vite-build/sw.js
# -rw-r--r-- 1 root root 3.8K Jan 15 18:48 .vite-build/sw.js.gz
```

**Check deployment logs:**
```bash
tail -100 /opt/budget/logs/deploy.log | grep -i "service worker"

# Expected output (v7.0.1+):
# [INFO] Copying Service Worker files from .vite-build/ to deployment root...
# [SUCCESS] ✓ Service Worker files copied: sw.min.js + sw.min.js.gz
# [SUCCESS] Service Worker validated: sw.min.js (10659B) + sw.min.js.gz (3841B)
```

#### Prevention

**For v7.0.1+:** No action needed - automatic copy is built-in

**For older versions:** Upgrade to v7.0.1+ or manually copy files after each deployment

#### Impact

- ✅ No manual file copying needed
- ✅ Service Worker automatically available after deployment
- ✅ Fallback mechanism for robustness
- ✅ Both .js and .gz files handled together
- ✅ Proper logging for debugging

**Commit:** `48588fb5`

**See Also:**
- [Build System - Service Worker File Copying](../build-system.md#2026-01-15-automatic-service-worker-file-copying-v701)
- [PWA Architecture](../pwa.md) - Service Worker serving

### Service Worker Cache Busting Failures

**Since:** v6.8.1 - Automatic ownership fix + validation improvements

#### Symptoms

```
[STEP 1/2] Validating Service Worker version...
  ✗ Service Worker version mismatch!
  Expected: v20260103_0649
  Actual:   CACHE_VERSION="v20251230_2235"

[ERROR] CRITICAL: Failed to update cache busting versions!
```

- Service Worker не обновляется при деплое (5+ итераций)
- Версия в `sw.min.js` устаревшая (несколько дней назад)
- Деплой падает на этапе валидации cache busting

#### Root Cause

**Primary:** `.cache-version` file owned by `root:root` when running `sudo ./deploy.sh`

**Sequence:**
1. First deploy: `sudo ./deploy.sh` creates `.cache-version` as `root:root` ✓
2. Second deploy: `sudo ./deploy.sh` tries to overwrite → **silently fails** (permission denied)
3. `minify.sh` reads **stale version** from `.cache-version`
4. `sw.min.js` created with **old CACHE_VERSION**
5. Validation fails: expected ≠ actual

**Secondary (fixed in v6.8.1):** Validation script had critical bugs:
- Searched for `CACHE_VERSION_PLACEHOLDER` instead of `PLACEHOLDER` (never detected failures!)
- Complex regex for HTML templates caused edge cases

#### Quick Fix

```bash
# 1. Fix file ownership
sudo chown ikeniborn:ikeniborn /opt/budget/.cache-version

# 2. Remove old Service Worker (force regeneration)
sudo rm -f /opt/budget/sw.min.js /opt/budget/sw.min.js.gz

# 3. Deploy without sudo (recommended)
cd ~/familyBudget
git pull origin test
bash deploy.sh --sync-mode update --cleanup-mode smart --patch

# 4. Verify fix
ls -la /opt/budget/.cache-version /opt/budget/sw.min.js
cat /opt/budget/.cache-version
grep -o 'CACHE_VERSION="[^"]*"' /opt/budget/sw.min.js | head -1

# Expected: same version in both files, owned by ikeniborn:ikeniborn
```

#### Prevention (v6.8.1+)

Deployment script now automatically:
1. Fixes ownership when running with sudo: `chown $SUDO_USER:$SUDO_USER .cache-version`
2. Validates file content matches expected version
3. Logs file ownership for diagnostics
4. Fails fast on write errors

**Recommendation:** Run `deploy.sh` **without sudo** when possible

#### Validation Improvements (v6.8.1+)

1. **CRITICAL FIX:** Detects actual `PLACEHOLDER` token (not `CACHE_VERSION_PLACEHOLDER`)
2. Simplified regex for HTML templates (more reliable)
3. Shows found PLACEHOLDER line for debugging
4. `minify.sh` checks file staleness (ignores files > 5 minutes old)

#### Diagnostics

Check current state:

```bash
# File ownership
ls -la /opt/budget/.cache-version

# Version in file
cat /opt/budget/.cache-version

# Version in Service Worker
grep -o 'CACHE_VERSION="[^"]*"' /opt/budget/sw.min.js | head -1

# File age
stat /opt/budget/.cache-version

# Deploy logs
tail -100 /opt/budget/logs/deploy.log | grep -E "cache-version|CACHE_VERSION|ownership"
```

#### See Also

- [Architecture README - v6.5.3](../README.md#2025-12-30-cache-busting-system-fix-v2---execution-order-correction-v653) - Earlier cache busting fixes
- [PWA Architecture](../pwa.md) - Service Worker caching strategy

---

## Registry-First Migration (v9.0)

**Since:** v9.0.0 - Complete architecture overhaul

### What Changed

In **v9.0**, deployment architecture migrated from **build mode** (local building on server) to **registry-first mode** (pull ready images from GitHub Container Registry).

**Before v9.0 (Build Mode):**
```bash
Server workflow:
1. git pull (sync code)
2. npm ci (install dependencies)         ← TIME CONSUMING
3. npm run build (minify frontend)       ← TIME CONSUMING
4. docker compose build (build images)   ← TIME CONSUMING
5. docker compose up (start services)
Total: 5-7 minutes
```

**After v9.0 (Registry-First):**
```bash
Server workflow:
1. git pull (sync code)
2. docker compose pull (pull images)     ← FAST (2-3 min)
3. docker compose up (start services)
Total: 2-3 minutes
```

**Building happens in GitHub Actions CI/CD:**
- All builds: frontend minification, Docker image building
- Outputs: 5 Docker images pushed to ghcr.io
- Server: only pulls ready images

### What's NOT Required on Server Anymore

❌ **Removed in v9.0:**
- npm/Node.js installation
- Frontend build process (minification, bundling)
- `.npm-isolated/` directory (233 packages)
- Local Docker image building
- Host-based nginx configuration generation

✅ **Required on server:**
- Docker + Docker Compose
- Git (for syncing config files)
- Configuration files (docker-compose.yml, .env, VERSION)

### Common v9.0 Issues

#### Issue 1: "npm: command not found" (Expected!)

**Symptoms:**
```bash
bash: npm: command not found
```

**Cause:** npm is NO LONGER required in v9.0

**Solution:** This is **EXPECTED behavior**. Server doesn't need npm anymore.

**Verification:**
```bash
# Should NOT have npm
which npm
# Expected: (no output)

# Should have Docker
docker --version
# Expected: Docker version 20.10+
```

#### Issue 2: IMAGE_VERSIONS.json Not Found

**Symptoms:**
```bash
ERROR: IMAGE_VERSIONS.json not found in /opt/budget
```

**Cause:** File not synced from repository

**Solution:**
```bash
# Pull latest from git
cd ~/familyBudget
git pull origin main

# Verify file exists
cat IMAGE_VERSIONS.json

# Re-deploy
sudo ./deploy.sh
```

**Prevention:** Always `git pull` before deploying

#### Issue 3: Docker Image Not Found in Registry

**Symptoms:**
```bash
ERROR: Failed to pull ghcr.io/ikeniborn/familybudget-backend:10.0.51
Error response from daemon: manifest for ... not found
```

**Cause:** GitHub Actions build failed or VERSION mismatch

**Solution:**
```bash
# 1. Check GitHub Actions status
# Visit: https://github.com/ikeniborn/familyBudget/actions

# 2. Verify VERSION file matches built images
cat VERSION
# Example: 10.0.51

# 3. Check available tags in ghcr.io
# Visit: https://github.com/ikeniborn/familyBudget/pkgs/container/familybudget-backend

# 4. If build failed, re-trigger CI/CD:
git commit --allow-empty -m "chore: rebuild Docker images"
git push origin main

# 5. Wait for build to complete (~5-7 min)
# 6. Re-deploy
sudo ./deploy.sh
```

#### Issue 4: Nginx Configuration Not Updating

**Symptoms:** Nginx config changes not applied after deployment

**Cause:** In v9.0, nginx config is **embedded in Docker image**

**Solution:**
```bash
# 1. Edit templates in git repository
cd ~/familyBudget
vim nginx/conf.d/app-https.conf.template

# 2. Commit changes
git add nginx/conf.d/
git commit -m "fix(nginx): update configuration"
git push

# 3. Wait for GitHub Actions to rebuild nginx image (~2-3 min)

# 4. Deploy new image
sudo ./deploy.sh

# 5. Verify container restarted
docker ps | grep nginx
# Check "Created" time - should be recent
```

**IMPORTANT:** 
- Editing `/opt/budget/nginx/conf.d/*.conf` on server has **NO EFFECT**
- Configuration is processed by `docker-entrypoint.sh` inside container
- Templates are in image, not mounted from host

### Migration Checklist

If upgrading from v8.x to v9.0:

- [ ] Verify GitHub Actions CI/CD configured (`.github/workflows/build-and-push.yml`)
- [ ] Check Docker images exist in ghcr.io registry
- [ ] Remove `.npm-isolated/` from server (if exists): `rm -rf /opt/budget/.npm-isolated`
- [ ] Remove local `node_modules/` from server: `rm -rf /opt/budget/node_modules`
- [ ] Verify `IMAGE_VERSIONS.json` in repository
- [ ] Update `VERSION` file before deployment
- [ ] Pull latest code: `git pull origin main`
- [ ] Deploy: `sudo ./deploy.sh`
- [ ] Verify images pulled from registry (not built locally)
- [ ] Check deployment time (should be 2-3 min, not 5-7 min)

### Debugging Registry-First Deployment

```bash
# 1. Verify images available in registry
docker pull ghcr.io/ikeniborn/familybudget-backend:$(cat VERSION)
docker pull ghcr.io/ikeniborn/familybudget-nginx:$(cat VERSION)

# 2. Check IMAGE_VERSIONS.json content
cat IMAGE_VERSIONS.json | jq .

# 3. Verify .env has correct image versions
grep VERSION /opt/budget/.env

# 4. Check Docker Compose image references
grep "image:" docker-compose.yml

# 5. View deployment logs
tail -100 /opt/budget/logs/deploy.log

# 6. Check pulled images
docker images | grep familybudget

# 7. Verify container using correct image
docker inspect familybudget-backend | jq '.[0].Config.Image'
```

### Performance Comparison

| Metric | Build Mode (v8.x) | Registry-First (v9.0) |
|--------|-------------------|----------------------|
| Deployment time | 5-7 min | 2-3 min |
| Server CPU | High (npm build) | Low (pull only) |
| Server RAM | ~2GB (build) | ~500MB (pull) |
| Disk I/O | High (npm cache) | Low (image layers) |
| Network usage | npm registry | ghcr.io only |
| Server requirements | Node.js + npm | Docker only |
| Failure points | Network, build, cache | Network (retry-able) |

### See Also

- [CI/CD Architecture](../ci-cd-build-deploy.md) - Complete CI/CD pipeline documentation
- [Docker Architecture](../docker.md) - Multi-stage builds and image structure
- [Deployment Operations](../../prd/10-deployment-operations.md) - Deployment procedures
