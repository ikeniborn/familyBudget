# Deployment Troubleshooting Guide

This guide helps diagnose and resolve common deployment issues in the Family Budget project.

---

## Network Hang During npm Installation

**Since:** v6.5.5 - Automatic recovery enabled

### Symptoms
- Deployment hangs at "Installing npm packages..."
- No progress for 15+ minutes
- Terminal appears frozen
- No error messages visible

### Root Cause

Network issues with npm package registry (registry.npmjs.org):
- Slow network connection
- Packet loss / intermittent connectivity
- npm registry temporarily unavailable
- Corporate firewall / proxy issues
- DNS resolution problems

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

## Related Issues

### PostgreSQL Health Check Timeout

See: [Architecture README - v6.5.4](../README.md#2025-12-30-postgresql-health-check-timeout-fix---prevent-deployment-hang-v654)

### Cache Busting PLACEHOLDER Warnings

See: [Architecture README - v6.5.3](../README.md#2025-12-30-cache-busting-system-fix-v2---execution-order-correction-v653)
