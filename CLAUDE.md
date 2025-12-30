# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget is a family budget management system with Telegram bot and web interface support. Built on FastAPI (backend), PostgreSQL (database), using Docker for deployment.

**Key Features:**
- 🔐 Authentication via Telegram OAuth
- 📊 Hierarchical budget categories (articles)
- 💰 Transaction tracking (income/expenses)
- 🤖 Telegram bot with Web Apps interface
- 🌐 Web interface (HTMX + Tailwind CSS + DaisyUI)
- 📈 Reports and statistics
- 🔄 Change history (SCD Type 1 + History tables)
- 📱 Transfer support (transfers between accounts)

## Terminology (UI ↔ Code)

| UI (Russian) | Code (English) | DB Table | Description |
|--------------|----------------|----------|-------------|
| **Счет** | `FinancialCenter` | `t_d_financial_center` | Bank accounts, wallets, cash |
| **Место затрат** | `CostCenter` | `t_d_cost_center` | Projects, departments, expense categories |
| **Статья** | `Article` | `t_d_article` | Budget categories (hierarchical) |
| **Транзакция** | `BudgetFact` | `t_f_budget_fact` | Income, expenses, transfers |

## Architecture

### Stack
- **Backend**: FastAPI 0.121.2 + SQLModel + asyncpg
- **Database**: PostgreSQL 16 + Alembic migrations
- **Bot**: python-telegram-bot 21.10
- **Frontend**: HTMX + Jinja2 + Tailwind CSS + DaisyUI
- **Deployment**: Docker Compose + bash scripts
- **Authentication**: JWT (httpOnly cookies) + Telegram OAuth

### Key Components

**1. Backend (FastAPI)**
- `backend/app/main.py` - Application entry point
- `backend/app/api/v1/router.py` - API v1 router
- `backend/app/api/web/router.py` - Web pages router
- `backend/app/core/config.py` - Settings (Pydantic Settings)
- `backend/app/db/session.py` - Database connection pool
- `backend/app/middleware/` - JWT auth, logging, CSP, validation

**2. Database Models (SQLModel)**
All models use **SCD Type 1** (in-place updates) + separate **History tables** (SCD Type 2):
- `Article` - Budget categories (hierarchical, shared across users)
- `ArticleHistory` - Article change history (SCD Type 2)
- `BudgetFact` - Facts (fact table)
- `BudgetFactHistory` - BudgetFact change history (SCD Type 2)
- `User` - Users (SCD Type 1 + UserHistory)
- `FinancialCenter` - Financial centers (accounts, wallets)
- `CostCenter` - Cost centers (projects, departments)
- `ArticleHierarchy` - Closure table for category hierarchy
- `Notification` - Notifications (broadcast support)
- `ImportStaging` - Staging table for Tinkoff import

**3. Database Migrations (Alembic)**
- `backend/db/migrations/env.py` - Alembic environment
- `backend/db/migrations/versions/` - Migration files
- Format: `YYYYMMDD_hash_description.py`
- **Important**: Migration 20251110 - baseline v5.1.0 (consolidated)

**4. Telegram Bot**
- `bot/bot.py` - Main bot handler
- `bot/utils/api_client.py` - Backend API client
- `bot/utils/telegram_auth.py` - Telegram OAuth
- `bot/utils/notification_service.py` - Push notifications
- `bot/jobs/weekly_report.py` - Weekly report job

**5. Frontend**
- **Web UI**: HTMX + Jinja2 templates + Tailwind CSS + DaisyUI
- **Telegram Web Apps**: Standalone HTML pages for Menu Button
- **Shared modules**: Category tree (Choices.js), calendar widget, date formatter

## Installation Script Architecture

**Main Script:** `install.sh` - System dependencies installation (Docker, Node.js, utilities)

**Since version 1.0.0:** Installation Resilience Framework added

### Resilience Components

**1. Timeout & Retry Infrastructure** (`scripts/lib/timeout.sh`)
- **Exponential backoff**: 5s → 10s → 20s → 40s → 60s (capped)
- **Configurable timeouts** via environment variables:
  - `TIMEOUT_APT_UPDATE=300` (5 min)
  - `TIMEOUT_APT_UPGRADE=600` (10 min)
  - `TIMEOUT_APT_INSTALL=600` (10 min)
  - `TIMEOUT_NPM_INSTALL=900` (15 min)
- **Retry configuration**:
  - `MAX_RETRY_ATTEMPTS=3`
  - `RETRY_BASE_DELAY=5`
  - `RETRY_MAX_DELAY=60`

**2. Network Pre-flight Checks** (`scripts/lib/network_health.sh`)
- Internet connectivity (ICMP ping to 8.8.8.8, 1.1.1.1, 208.67.222.222)
- DNS resolution (google.com, github.com, download.docker.com)
- Repository accessibility (archive.ubuntu.com, download.docker.com, deb.nodesource.com)

**3. Enhanced Error Reporting** (`scripts/lib/utils.sh`)
- Context-aware error messages with recovery suggestions
- Last 5 error lines extracted from log
- Operation-specific troubleshooting (APT, NPM, Docker)

### Core Functions

```bash
# Timeout & Retry
apt_with_retry install -y nodejs          # APT with retry + exponential backoff
npm_with_retry ci                         # NPM with timeout + retry
curl_with_retry -fsSL https://...         # Curl with timeout + retry

# Network Checks
network_preflight_check "false"           # Run pre-flight (warn mode)
suggest_network_fixes                     # Show troubleshooting steps

# Error Reporting
get_last_error_lines "$LOG_FILE" 5        # Last 5 errors from log
suggest_fix_apt_update                    # APT troubleshooting
suggest_fix_npm_install                   # NPM troubleshooting
```

### Usage Examples

**Basic installation** (uses defaults):
```bash
sudo ./install.sh
```

**Custom timeouts** (slow network):
```bash
TIMEOUT_APT_INSTALL=1200 TIMEOUT_NPM_INSTALL=1800 sudo -E ./install.sh
```

**Manual network check**:
```bash
source scripts/lib/network_health.sh
network_preflight_check "false"
```

### Docker GPG Key Validation (v1.1.0)

**Since version 1.1.0**: Comprehensive GPG key validation with retry and binary verification.

**Problem Solved:**
- Installation hung on interactive prompt "File exists. Overwrite? (y/N)"
- "gpg: no valid OpenPGP data found" error from corrupted key files
- No validation of existing keys before deletion

**Validation Pipeline (5 checkpoints):**

1. **Check existing key** → validate before removing (keep if valid, skip re-download)
2. **Download to temp file** → validate text format (not HTML error page)
3. **Convert to binary** (`gpg --dearmor`) → monitor stderr for errors
4. **Validate binary result** → check structure + gpg --list-keys
5. **Install to final location** → cleanup temp files

**Retry Strategy:**
- Max 3 attempts with exponential backoff (5s → 10s → 20s)
- Validates at EACH step (download, conversion, installation)
- Creates backup before replacing valid keys

**Functions:**

```bash
# Validate binary GPG key file structure
validate_gpg_key_file /etc/apt/keyrings/docker.gpg
# Returns: 0 if valid, 1 if invalid
# Checks: binary signature (magic bytes) + gpg --list-keys + error keywords

# Create timestamped backup
backup_gpg_key /etc/apt/keyrings/docker.gpg
# Creates: docker.gpg.backup.YYYYMMDD_HHMMSS
# Auto-cleanup: keeps only 5 most recent backups

# Setup Docker GPG key with comprehensive validation
setup_docker_gpg_key
# Full pipeline with retry: validate existing → download → convert → validate binary → install
```

**Usage:**

```bash
# Standard installation (automatic validation)
sudo ./install.sh

# Manual GPG key check
validate_gpg_key_file /etc/apt/keyrings/docker.gpg && echo "Valid" || echo "Invalid"

# Force fresh GPG key download (remove existing first)
sudo rm -f /etc/apt/keyrings/docker.gpg
sudo ./install.sh
```

**Location:** install.sh:241-632

### Repository Detection (v1.1.0)

**Since version 1.1.0**: Smart repository directory detection for error recovery.

**Problem Solved:**
- Confusing "Required template files are missing" error when install.sh run from wrong directory
- No guidance on how to fix template file issues
- Manual troubleshooting required to find correct repository path

**Detection Methods (priority order):**

1. **Git repository root** (`git rev-parse --show-toplevel`) - MOST RELIABLE
2. **Walk up directory tree** (max 5 levels) looking for marker files - FALLBACK
3. **Common locations** (`~/familyBudget`, `~/Documents/familyBudget`, etc.) - LAST RESORT

**Marker Files:**
- `install.sh` (installation script)
- `.env.example` (environment template)
- `nginx/conf.d/app-http.conf.template` (nginx config template)

**Functions:**

```bash
# Auto-detect repository directory
detect_repo_directory "$(pwd)"
# Returns: repository path if found
# Exit code: 0 if found, 1 if not found
```

**Usage:**

```bash
# Auto-detection in error messages (automatic)
cd /wrong/directory
sudo ./install.sh
# Output: [SUCCESS] Repository found: /home/user/familyBudget
#         Suggested fix: cd /home/user/familyBudget && sudo ./install.sh

# Manual repository override via CLI
sudo ./install.sh --repo-dir ~/familyBudget

# Show help
./install.sh --help
```

**Location:** scripts/lib/utils.sh:202-349

### Troubleshooting Installation Failures

**Check installation log:**
```bash
tail -f /var/log/familybudget_install.log
```

**Common issues:**
1. **Network timeouts** → Increase timeout: `TIMEOUT_APT_INSTALL=1200 sudo -E ./install.sh`
2. **DNS failures** → Check /etc/resolv.conf, add `nameserver 8.8.8.8`
3. **Repository 404** → Check /etc/apt/sources.list for invalid repos
4. **npm hangs** → Kill zombie processes: `sudo pkill -9 -f npm`
5. **Docker GPG key** → Remove and retry: `sudo rm -f /etc/apt/keyrings/docker.gpg`

**See:** `/docs/architecture/installation-resilience.md` for comprehensive guide

## Development Commands

### Local Development

```bash
# Python virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run backend locally (requires PostgreSQL)
uvicorn backend.app.main:app --reload --port 8000

# Run bot locally
cd bot
python bot.py
```

### Database (Alembic)

```bash
# Create new migration (from backend/ directory)
cd backend
alembic revision --autogenerate -m "description of changes"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1

# Show current version
alembic current

# Show migration history
alembic history

# IMPORTANT: Before creating migration check env.py - it imports all models
```

### Frontend (Tailwind CSS + JS)

```bash
# Build Tailwind CSS
npm run build:css

# Watch mode (automatic rebuild)
npm run watch:css

# Minify JS
npm run minify:js

# Minify CSS
npm run minify:css

# Full build (CSS + JS + minify)
npm run build

# Validate minified files
npm run validate:minified
```

### Build System & Optimization (v5.6.0)

**Build pipeline** (as of 2025-12-26):
- **Minification**: Terser (JS) + cssnano (CSS) with advanced configs
- **Pre-compression**: Gzip -9 for all assets (60-70% delivery reduction)
- **Bundling**: budgetShared.js combines DateFormatter, CalendarWidget, ChoicesCategoryTree
- **Cache busting**: Automatic versioning via query parameters

**Configuration files:**
- `.terserrc.json` - Advanced JS minification (3-pass, toplevel mangling, unsafe optimizations)
- `postcss.config.js` - Advanced CSS minification (advanced preset, identifier reduction)

**Build commands:**
```bash
npm run build:css       # Tailwind CSS compilation
npm run bundle          # Bundle shared modules
npm run minify:js       # Minify JavaScript (uses .terserrc.json)
npm run minify:css      # Minify CSS (uses postcss.config.js)
npm run precompress     # Gzip pre-compression for all assets
npm run build           # Full build pipeline (all of the above)
```

**Performance benchmarks:**
- JS: 60-70% raw reduction, 75-80% gzipped
- CSS: 50-60% raw reduction, 70-75% gzipped
- Delivery: 60-70% reduction via pre-compressed .gz files
- Build time: ~15-20 seconds (full build)

**See:** `/docs/architecture/build-system.md` for detailed documentation

### Logging System (v5.6.0)

**Browser logging** (as of 2025-12-26):
- **Centralized Logger class** with environment-based control
- **Module-specific prefixes**: [PWA], [SW], [DB], [SYNC], [API], [PERF], [FORM]
- **Environment detection**: Auto-disable in production, full logging in development
- **Pre-configured loggers**: `window.logAPI`, `window.logDB`, `window.logSync`, etc.

**Configuration:** `frontend/web/static/js/config/logging.js`

**Usage:**
```javascript
// Use pre-configured logger
logAPI.info('Request started');
logAPI.time('API call');
// ... operation ...
logAPI.timeEnd('API call');

// Create custom logger
const logCustom = new Logger('[CUSTOM]', 'CUSTOM');
logCustom.info('Custom log message');

// Runtime control (debugging)
setLoggingLevel('API', false);  // Disable API logging
getLoggingStatus();             // Get current config
```

**Performance monitoring:**
- **PerformanceMonitor**: Automatic page load metrics + Core Web Vitals
- **Metrics tracked**: DNS, TCP, Request, Response, DOM processing, LCP, FID, CLS
- **Available via**: `window.perfMonitor.getMetrics()`

**See:** Logger class (`frontend/web/static/js/utils/logger.js`) and PerformanceMonitor (`frontend/web/static/js/utils/performanceMonitor.js`)

### Web Workers

**Location:** `frontend/web/static/js/workers/`

**Status:** Phases 1-5 Complete ✅
- ✅ Phase 1: Core Infrastructure (workerWrapper.js, cache busting)
- ✅ Phase 2: Hierarchy Worker (category tree processing)
- ✅ Phase 3: CSV Worker (Base64 encoding, CSV parsing)
- ✅ Phase 4: Sync Worker (parallel batch processing)
- ✅ Phase 5: Pending Records Worker (main page HTML generation)
- ❌ Analytics Worker (created but NOT integrated - async overhead issue)

**Performance Improvements:**
- Category hierarchy: 200-300ms → 50-100ms (70% faster)
- CSV 10MB encoding: 2-5s → 100-500ms (80-90% faster)
- Sync queue (100 items): Sequential 10-15s → Parallel 3-4s (4-6x faster)
- Pending records (50+ items): 50-200ms → 10-40ms (70-80% faster)

**Workers:**
- `workerWrapper.js` - Core wrapper with cache busting, feature flags, memory monitoring
- `hierarchyWorker.js` - Category tree processing (integrated in choicesCategoryTree.js)
- `csvWorker.js` - CSV parsing + Base64 encoding (integrated in csvImporter.js)
- `syncWorker.js` - Parallel sync processing (integrated in offlineManager.js)
- `pendingRecordsWorker.js` - Pending records HTML generation (integrated in index.html)
- `analyticsWorker.js` - Chart data processing (**REMOVED v5.6.0** - never integrated, async overhead issue)

**Feature Flag:**
```bash
# In .env
ENABLE_WEB_WORKERS=true  # Default: enabled
```

**Cache Busting:**
Workers automatically load with version parameter:
```html
<script src="/static/js/workers/core/workerWrapper.min.js?v=20251225_1830"></script>
```

**Testing:**
```bash
# Workers minified automatically with npm run minify:js
# Check worker status in browser console:
# ChoicesCategoryTree._workerWrapper.getStatus()
```

**See:** `/docs/architecture/web-workers.md` for detailed architecture

### Testing

```bash
# All tests
pytest

# Only unit tests
pytest -m unit

# Only integration tests
pytest -m integration

# E2E tests (Playwright)
npx playwright test
npx playwright test --ui  # Interactive mode

# With coverage
pytest --cov=backend --cov=bot --cov-report=html

# Specific test
pytest tests/unit/test_article_service.py::test_create_article

# Verbose mode
pytest -v -s
```

### Code Quality

```bash
# Linting (ruff)
ruff check backend/
ruff check --fix backend/  # Auto-fix

# Formatting (black)
black backend/
black --check backend/  # Check only

# Type checking (mypy)
mypy backend/

# All checks together
ruff check backend/ && black --check backend/ && mypy backend/
```

### Docker (Deployment)

```bash
# IMPORTANT: Run from repository directory (~/familyBudget), NOT from /opt/budget

# Basic deployment (postgres + backend)
./deploy.sh

# Full deployment (+ nginx + bot + certbot)
./deploy.sh --profile full

# Rebuild images
./deploy.sh --build

# Foreground mode (real-time logs)
./deploy.sh --foreground

# Clean deployment (DELETES ALL DATA!)
./deploy.sh --clean

# Without migrations
./deploy.sh --no-migrate

# Docker Compose commands (from /opt/budget)
cd /opt/budget
docker compose ps                    # Status
docker compose logs -f backend       # Backend logs
docker compose restart backend       # Restart
docker compose down                  # Stop
docker compose exec backend bash     # Shell in container

# Diagnostics and logs
./logs.sh                   # Full diagnostics
./logs.sh --save            # Save to file
./logs.sh --quick           # Status only
./logs.sh --alert           # Critical issues only
./logs.sh --follow backend  # Live tail
```

### Docker Volume Management

**Since version 1.2.0:** PostgreSQL Docker volume создается автоматически при деплое.

**Автоматическое создание:**
```bash
# deploy.sh автоматически проверяет и создает volume если отсутствует
cd ~/familyBudget
sudo ./deploy.sh
# Output: "PostgreSQL volume created: budget_postgres_data" (только при первом запуске)
```

**Ручное управление:**
```bash
# Проверить существование volume
docker volume inspect budget_postgres_data

# Список всех volumes проекта
docker volume ls --filter "name=budget"

# Проверить размер и использование
docker system df -v | grep budget_postgres_data
```

**Troubleshooting:**
- **Сбой создания volume:** Проверьте Docker daemon status, disk space, permissions
- **Volume не найден после создания:** Проверьте `docker volume ls` (убедитесь что создание прошло успешно)

Смотрите `/docs/BACKUP_RESTORE.md` для процедур disaster recovery.

### Backup & Restore

```bash
# Backup PostgreSQL
./scripts/backup.sh

# Restore backup
./scripts/restore.sh /opt/budget/backups/backup_20251120.sql

# S3 backup (if S3 configured)
./scripts/s3_backup.py
```

### UFW Firewall for PostgreSQL

**Automatic Configuration:** `deploy.sh` automatically configures UFW rules for PostgreSQL based on `.env` variables.

**Environment Variables:**
- `POSTGRES_EXTERNAL_ACCESS` - Enable external PostgreSQL access (default: `false`)
- `POSTGRES_ALLOWED_IP` - IP address allowed to connect (required if `POSTGRES_EXTERNAL_ACCESS=true`)

**Behavior:**

```bash
# Scenario 1: External access DISABLED (default, most secure)
POSTGRES_EXTERNAL_ACCESS=false

# Result: All UFW rules for port 5432 are removed (internal Docker only)
# PostgreSQL accessible ONLY from Docker containers

# Scenario 2: External access ENABLED with specific IP
POSTGRES_EXTERNAL_ACCESS=true
POSTGRES_ALLOWED_IP=192.168.1.100

# Result: UFW rule created: allow from 192.168.1.100 to any port 5432
# Old rules automatically removed, new rule created

# Scenario 3: External access ENABLED but IP not set (ERROR)
POSTGRES_EXTERNAL_ACCESS=true
POSTGRES_ALLOWED_IP=

# Result: ERROR - deployment fails for security
# Message: "POSTGRES_ALLOWED_IP is not set! This would allow from ANY IP (security risk)"
```

**Manual Management:**

```bash
# Test UFW configuration function (without deploy)
cd ~/familyBudget
source scripts/lib/config.sh
source scripts/lib/utils.sh
source scripts/lib/firewall.sh
configure_ufw_for_postgres

# Check current UFW rules
sudo ufw status numbered
# Look for rules with port 5432

# Manually add rule (if not using deploy.sh)
sudo ufw allow from 192.168.1.100 to any port 5432 comment "PostgreSQL external access"

# Manually remove rule
sudo ufw status numbered  # Find rule number for port 5432
sudo ufw delete <rule-number>

# Verify PostgreSQL external connectivity
psql -h <server-ip> -U familybudget -d familybudget
# Should connect if IP allowed, timeout if blocked
```

**Security Notes:**
- ✅ **Recommended:** `POSTGRES_EXTERNAL_ACCESS=false` (internal only via Docker)
- ⚠️ **Use sparingly:** External access only for remote administration
- ❌ **Never:** Leave `POSTGRES_ALLOWED_IP` empty when `POSTGRES_EXTERNAL_ACCESS=true`
- 🔒 **Defense in depth:** UFW rules + Docker firewall (DOCKER-USER chain) both protect PostgreSQL

**Troubleshooting:**

```bash
# Check UFW status
sudo ufw status verbose

# Check Docker firewall (iptables)
sudo iptables -L DOCKER-USER -n -v --line-numbers

# Test PostgreSQL connectivity from external IP
# From allowed IP:
psql -h <server-ip> -U familybudget -d familybudget
# Should connect if rules correct

# From blocked IP:
psql -h <server-ip> -U familybudget -d familybudget
# Should timeout (no route / connection refused)

# Logs
tail -f /opt/budget/logs/deploy.log
# Look for "Configuring UFW Rules for PostgreSQL"
```

**See also:**
- `scripts/lib/firewall.sh` - Firewall configuration functions
- `deploy.sh` lines 1447-1456 - Automatic UFW configuration during deployment

## Testing Environment Workflow

**CRITICAL:** This is the ONLY approved process for testing changes on the test server (budget-test).

### Standard Testing Procedure

**Prerequisites:**
- SSH access configured for `budget-test` server
- Changes committed to `test` branch in local repository
- Test server has `~/familyBudget` repository cloned

**Step-by-Step Process:**

```bash
# 1. Connect to test server
ssh budget-test

# 2. Pull latest changes in test branch
cd ~/familyBudget
git pull origin test

# 3. Execute deployment with patch mode
sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch

# 4. Analyze terminal output during deployment
# Watch for:
# - Build errors
# - Migration failures
# - Container startup issues
# - Port conflicts

# 5. After successful completion, review deployment log
cat /opt/budget/logs/deploy.log
# Look for:
# - WARNING/ERROR entries
# - Failed health checks
# - Incomplete operations

# 6. Analyze running container logs
cd /opt/budget
docker compose logs -f backend     # Backend application logs
docker compose logs -f postgres    # Database logs
docker compose logs -f nginx       # Web server logs
docker compose logs -f bot         # Telegram bot logs

# Check for:
# - Python exceptions/tracebacks
# - SQL errors
# - Connection failures
# - Resource warnings (memory, CPU)
```

### Issue Resolution Workflow

**When issues are found:**

```bash
# 1. Document the issue
# - Screenshot error messages
# - Copy relevant log excerpts
# - Note reproduction steps

# 2. Fix locally in repository (NOT on server)
cd ~/familyBudget  # Local machine
# Edit files
# Test locally if possible

# 3. Commit and push to test branch
git add .
git commit -m "fix: description of fix"
git push origin test

# 4. Return to Step 1 (deploy on test server again)
```

### Post-Deployment Verification

**CRITICAL:** Always check for orphaned processes after deployment.

```bash
# Check for processes that should have stopped
ps aux | grep -E "(uvicorn|gunicorn|python.*bot\.py)" | grep -v grep

# Check Docker container status
docker compose ps

# Verify only expected containers are running:
# - postgres (always)
# - backend (always)
# - nginx (if --profile full)
# - bot (if --profile full)
# - certbot (if --profile full, may be stopped after cert renewal)

# Check for port conflicts
sudo netstat -tlnp | grep -E ":(5432|8000|80|443)"

# Check system resources
docker stats --no-stream

# Verify application health
curl -s http://localhost:8000/health | jq
curl -s http://localhost:8000/ready | jq
```

### Common Issues and Diagnostics

**Issue: Container fails to start**
```bash
# Check container logs
docker compose logs --tail=100 <container-name>

# Inspect container state
docker compose ps -a

# Check for port conflicts
sudo lsof -i :<port-number>
```

**Issue: Migration fails**
```bash
# Check migration status
docker compose exec backend alembic current
docker compose exec backend alembic history

# View migration logs
grep -A20 "Migration" /opt/budget/logs/deploy.log

# Manually run migrations (if safe)
docker compose exec backend alembic upgrade head
```

**Issue: Orphaned processes**
```bash
# Find orphaned Python processes
ps aux | grep python | grep -v docker

# Kill orphaned processes (be careful!)
sudo pkill -f "uvicorn.*familybudget"
sudo pkill -f "python.*bot\.py"

# Verify clean state
ps aux | grep -E "(uvicorn|gunicorn|python.*bot)" | grep -v grep
# Should return nothing
```

### Deployment Flags Explained

**Flags used in standard testing workflow:**

- `--sync-mode update`: Sync only changed files from repository to /opt/budget
  - Faster than full sync
  - Preserves .env and other local configs
  - Safe for incremental updates

- `--cleanup-mode smart`: Intelligent cleanup of old artifacts
  - Removes old Docker images (not used by running containers)
  - Cleans up temporary files
  - Preserves backups and logs
  - Safe for regular deployments

- `--patch`: Patch deployment (no rebuild unless necessary)
  - Restarts only changed services
  - Fast deployment (2-5 minutes vs 10-15 for full rebuild)
  - Preserves database and volumes
  - **Use for:** Code changes, config updates, minor fixes
  - **Don't use for:** Dependency changes, Dockerfile changes, major refactoring

### Test Branch Workflow

**IMPORTANT:** The `test` branch is for testing only. Never merge untested code to `main`.

```bash
# Local development workflow:
git checkout test
# Make changes
git add .
git commit -m "type: description"
git push origin test

# Test on budget-test server (see Standard Testing Procedure above)

# If tests pass, merge to main
git checkout main
git merge test
git push origin main

# If tests fail, return to development
git checkout test
# Fix issues
# Repeat cycle
```

### Performance Benchmarks (budget-test)

**Expected deployment times:**
- Patch deployment (`--patch`): 2-5 minutes
- Full rebuild (`--build`): 10-15 minutes
- Clean deployment (`--clean`): 15-20 minutes

**Expected container startup times:**
- postgres: 5-10 seconds
- backend: 10-15 seconds (includes migrations)
- nginx: 2-5 seconds
- bot: 5-10 seconds

**If deployment takes longer:** Check logs for issues (network, disk I/O, resource constraints).

### Emergency Procedures

**If deployment fails catastrophically:**

```bash
# 1. Stop all containers
cd /opt/budget
docker compose down

# 2. Check system resources
df -h          # Disk space
free -h        # Memory
docker system df  # Docker disk usage

# 3. Clean Docker system (if space issue)
docker system prune -a --volumes  # ⚠️ DELETES ALL DATA

# 4. Restore from backup (if data corrupted)
cd ~/familyBudget
./scripts/restore.sh /opt/budget/backups/latest.sql

# 5. Clean redeployment
sudo bash deploy.sh --clean --profile full
```

**If test server becomes unresponsive:**

```bash
# From local machine
ssh budget-test "sudo reboot"

# Wait 2-3 minutes, then reconnect
ssh budget-test

# Check services after reboot
cd /opt/budget
docker compose ps
```

### Checklist: Before Leaving Test Server

**Always verify before disconnecting SSH:**

- [ ] All expected containers are running (`docker compose ps`)
- [ ] No orphaned processes (`ps aux | grep python`)
- [ ] Application responds to health checks (`curl localhost:8000/health`)
- [ ] Logs show no errors (`docker compose logs --tail=50`)
- [ ] Disk space is adequate (`df -h`)
- [ ] No port conflicts (`sudo netstat -tlnp`)

**Clean exit:**
```bash
# Review final state
cd /opt/budget
docker compose ps
docker stats --no-stream

# Exit SSH
exit
```

## Important Concepts and Patterns

### SCD Type 1 + History Tables

**Since version 5.1.0 architecture changed:**
- **Main tables** (Article, User, etc.) contain ONLY current state (SCD Type 1)
- **History tables** (ArticleHistory, UserHistory, etc.) store ALL history (SCD Type 2)
- **Benefits**: Stable PK in fact tables, simple queries, performance

**Examples:**
```python
# Update Article (in-place)
article.name = "New Name"
await session.commit()  # UPDATE, not INSERT

# History is automatically recorded via database triggers or service layer
```

### Hierarchical Categories (Closure Table)

Articles use **Closure Table** pattern for efficient hierarchical queries:
- `ArticleHierarchy` - Closure table (ancestor_id, descendant_id, depth)
- Allows fast retrieval of: subtree, ancestors, breadcrumbs, depth

**Examples:**
```python
# Get all child categories
subtree = await article_service.get_subtree(article_id)

# Get all parent categories
ancestors = await article_service.get_ancestors(article_id)

# Breadcrumbs (from root to article)
breadcrumbs = await article_service.get_breadcrumbs(article_id)
```

### Shared Family Budget Model

**Data Model:** Project uses "Shared Family Budget" - all users see ALL data.

**Important features:**
- **Articles**: Shared across all users (READ for all, WRITE for admin only)
- **BudgetFact**: Shared - all users see all family transactions
- **FinancialCenter, CostCenter**: Shared - common directories for entire family
- **user_id in BudgetFact**: Indicates WHO created record, but does NOT restrict access

### Admin Authentication Bypass (v6.3.0+)

**Since version 6.3.0**: Admin users can login via email/password WITHOUT 2FA requirement.

**Purpose**: Emergency access for system recovery if 2FA device lost.

**Implementation**: `/api/v1/auth/login` endpoint checks `is_admin` flag after email/password validation. If admin, generates JWT tokens directly and skips 2FA session creation.

**Security**: Regular users ALWAYS require 2FA. Admin bypass restricted to `is_admin=True` only.

**Configuration**: Set ADMIN_EMAIL and ADMIN_PASSWORD in .env during setup.sh. Admin user created automatically by scripts/create_admin_user.py during deployment.

**Code Example:**
```python
# backend/app/api/v1/endpoints/auth.py
@router.post("/login")
async def login_email(
    request: Request,
    response: Response,
    data: EmailLoginRequest,
    ...
) -> EmailLoginResponse | AuthResponse:
    user = await authenticate_with_password(session, data.email, data.password)

    # Admin bypass: Skip 2FA for emergency access
    if user.is_admin:
        logger.info(f"[AUTH_EMAIL] Admin login bypass: user_id={user.id}, bypassing 2FA")
        access_token = create_access_token(user_id=user.id, ...)
        refresh_token, expires = create_refresh_token(user_id=user.id)
        # ... set cookies, store refresh token in DB
        return AuthResponse(
            user=...,
            message="Admin authentication successful (2FA bypassed)",
            access_token=access_token,
            refresh_token=refresh_token,
        )

    # Regular users: Require 2FA (existing logic)
    session_token = await create_2fa_session(session, user.id)
    return EmailLoginResponse(requires_2fa=True, session_token=session_token)
```

**Logging**: All admin logins logged with `[AUTH_EMAIL]` prefix. Failed attempts logged with IP address.

**Frontend Detection:**
```javascript
// frontend/web/templates/login_email.html
const data = await response.json();

// Admin bypass: AuthResponse has access_token + refresh_token
if (data.access_token && data.refresh_token) {
    console.log('[AUTH_EMAIL] Admin bypass detected - redirecting to dashboard');
    window.location.href = '/';
    return;
}

// Regular user: EmailLoginResponse has session_token + requires_2fa
if (data.session_token && data.requires_2fa) {
    console.log('[AUTH_EMAIL] Regular user - 2FA required');
    window.location.href = '/2fa-verify';
}
```

**Security Measures:**
- Strong password requirements (OWASP 2023: 24 chars, uppercase, lowercase, digit, special)
- Rate limiting (5 attempts/minute)
- Argon2id password hashing
- Comprehensive logging (success + failures with IP)

**See**: `/docs/architecture/authentication.md` for complete architecture and `/docs/architecture/admin-setup.md` for setup guide.

### WebAuthn Biometric Authentication (v6.5.0+)

**Since version 6.5.0**: Users can enable WebAuthn biometric authentication (TouchID/FaceID/Windows Hello) as an additional login method.

**Purpose**: Provide passwordless biometric login while maintaining backward compatibility with existing authentication methods (Telegram OAuth, Email+Password).

**Architecture**: WebAuthn as **optional parallel method** (NOT replacing existing flows)

**Supported Authenticators**: Platform authenticators only (TouchID, FaceID, Windows Hello - no hardware keys like YubiKey)

**User Flow**:
1. User registers via Telegram OAuth OR Email+Password (existing flows)
2. After login, navigate to Settings → Security → "Добавить биометрию"
3. WebAuthn credential enrolled (public key stored in database)
4. Next login: Identifier-first approach shows available methods (WebAuthn button if enrolled)
5. User clicks "Use TouchID/FaceID" → biometric prompt → logged in

**Database Tables**:
- `t_d_webauthn_credential` - Public keys, sign counts, device metadata
- `t_f_webauthn_challenge` - Temporary challenges (10-min TTL, single-use)
- `t_f_webauthn_audit_log` - Comprehensive audit trail

**API Endpoints** (`backend/app/api/v1/endpoints/webauthn.py`):
- `POST /api/v1/webauthn/register/options` - Generate registration challenge (requires JWT, 5 req/min)
- `POST /api/v1/webauthn/register/verify` - Verify credential registration (requires JWT, 5 req/min)
- `POST /api/v1/webauthn/authenticate/options` - Generate auth challenge (public, 10 req/min)
- `POST /api/v1/webauthn/authenticate/verify` - Verify auth and issue JWT tokens (public, 10 req/min)
- `GET /api/v1/webauthn/credentials` - List user's credentials (requires JWT)
- `DELETE /api/v1/webauthn/credentials/{credential_id}` - Revoke credential (requires JWT + password/TOTP)
- `GET /api/v1/auth/methods?identifier=email` - Check available auth methods (public)

**Security Features**:
- **Challenge-response**: 10-min expiry, single-use, ownership validation
- **Sign count validation**: Detects cloned credentials (auto-revoke on regression)
- **Origin validation**: Prevents phishing (RP ID verification)
- **Audit logging**: All registration/authentication events logged
- **Rate limiting**: 5-10 requests/minute depending on endpoint

**Browser Support**:
| Browser | Platform | Support |
|---------|----------|---------|
| Safari 14+ | iOS 14+ | ✅ TouchID / FaceID |
| Chrome 70+ | Android 9+ | ✅ Fingerprint / Face |
| Chrome 90+ | macOS | ✅ TouchID |
| Edge 90+ | Windows 10+ | ✅ Windows Hello |

**Configuration** (`.env`):
```bash
# Production
WEBAUTHN_RP_ID=familybudget.example.com
WEBAUTHN_RP_NAME="Family Budget"
WEBAUTHN_ORIGIN=https://familybudget.example.com

# Development
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:8000
```

**Code Example** (service layer):
```python
# backend/app/services/webauthn_service.py

# Registration
options = await create_registration_challenge(session, user, ip, user_agent)
credential = await verify_and_store_credential(
    session, user, challenge, credential_data, device_name, ip, user_agent
)

# Authentication
options = await create_authentication_challenge(session, identifier)
user, access_token, refresh_token = await verify_authentication_and_issue_tokens(
    session, challenge, credential_data, ip, user_agent
)

# Sign count regression detection (cloned credential)
if new_sign_count > 0 and new_sign_count <= stored_count:
    logger.critical("[WEBAUTHN_SERVICE] ⚠️ CLONED CREDENTIAL DETECTED")
    cred.is_revoked = True  # Auto-revoke
    await broadcast_webauthn_credential_compromised(user.id, credential_id, "sign_count_regression")
    raise ValueError("Credential compromised")
```

**WebSocket Integration** (`backend/app/api/v1/endpoints/budget_ws.py`):
- `webauthn_credential_added` - Real-time notification after credential registration
- `webauthn_credential_revoked` - Real-time notification after credential deletion
- `webauthn_credential_compromised` - Security alert for cloned credentials (includes push notification)

**Scheduled Cleanup** (`backend/app/scheduler.py`):
- Hourly job to delete expired challenges (10-min TTL)
- Prevents table bloat in `t_f_webauthn_challenge`

**Troubleshooting**:
- **"NotAllowedError" on iOS**: User gesture timeout (iOS Safari 15.5+ freebie counter quirk) - Fix: Call `navigator.credentials.get()` directly in click handler
- **"Credential compromised"**: Sign count regression (cloned authenticator detected) - Fix: Credential auto-revoked, user must use password/Telegram and re-register

**See**: Plan file at `.claude/plans/giggly-imagining-puffin.md` for complete implementation details.

### User Notification Preferences (v6.4.0+)

**Since version 6.4.0**: Users can independently control Web Push and Telegram bot notifications.

**Purpose**: Give users fine-grained control over notification delivery channels while maintaining backward compatibility.

**Architecture**: Two boolean fields in User model (SCD Type 1 + UserHistory):
- `enable_push_notifications` (default: TRUE)
- `enable_telegram_notifications` (default: TRUE)

**Storage**: User table (`t_d_user`) with partial index for performance:
```sql
CREATE INDEX idx_user_notifications_enabled
ON t_d_user(id)
WHERE enable_push_notifications = TRUE OR enable_telegram_notifications = TRUE;
```

**API Endpoint**: `PATCH /api/v1/users/me/notification-preferences`

**Example Usage**:
```bash
# Disable Web Push, keep Telegram enabled
curl -X PATCH "/api/v1/users/me/notification-preferences?enable_push=false&enable_telegram=true" \
  -H "Authorization: Bearer $TOKEN"
```

**Notification Filtering**: Applied in service layer BEFORE sending notifications:

**NotificationService** (`backend/app/services/notification_service.py`):
- `send_weekly_reports()`: Checks `enable_telegram_notifications` before sending
- `check_all_budget_thresholds()`: Filters telegram_ids by preference

**ReminderService** (`backend/app/services/reminder_service.py`):
- `send_reminder()`: Checks BOTH `enable_push_notifications` and `enable_telegram_notifications` before sending
- Optimization: Checks preferences at `send_reminder()` level (user already loaded) to avoid duplicate DB queries

**Frontend Implementation**:

1. **Notifications Page** (`/notifications`):
   - Accessible on mobile devices (removed desktop-only restriction)
   - Settings section with 2 DaisyUI toggles (Push + Telegram)
   - Auto-save on toggle change via API
   - Success/error messages with 3-second auto-hide
   - Notifications List hidden on mobile (`hidden md:block`)

2. **Push Bell Button** (`base.html`):
   - Visual indicator only (NOT toggle)
   - Shows enabled bell OR muted bell icon based on `enable_push_notifications`
   - onclick navigates to `/notifications` page
   - Tooltip changes: "Настройки уведомлений (вкл)" / "(выкл)"
   - Reduced opacity (50%) when disabled

**Logging Prefixes**:
- `[USER_PREF]` - API preference updates
- `[NOTIF_FILTER]` - Service layer filtering (skipped users)
- `[NOTIF_SETTINGS]` - Frontend settings page
- `[PUSH_BELL]` - Frontend bell button state

**Affected Notifications**: ALL notification types respect preferences (v6.4.0+):
- `budget_threshold` - Budget threshold alerts
- `budget_exceeded` - Budget exceeded warnings
- `weekly_report` - Weekly summaries
- `plan_reminder` - Scheduled reminders

**Scope**: Applies to ALL notifications including existing `ScheduledReminder` records (checked at send time, not creation time).

**Backward Compatibility**: Default values TRUE for both fields → Existing users receive all notifications as before (opt-out model).

**Edge Case**: If user disables BOTH channels → No notifications sent (allowed, UI should show warning).

**See**: `/docs/architecture/notifications.md` for complete architecture, testing strategy, and deployment guide.

### Recurring Plans: Yearly Frequency Encoding

**Since version 6.2.0**: Yearly recurring plans use MMDD encoding for `frequency_value`.

**Encoding scheme**:
- Format: `(month * 100) + day`
- Range: 101 (Jan 1) to 1231 (Dec 31)
- Examples: 115 = Jan 15, 315 = Mar 15, 615 = Jun 15, 1231 = Dec 31

**Validation**:
- Pydantic validator checks month (1-12) and day validity for month
- PostgreSQL CHECK constraint enforces range 101-1231 for yearly
- February 29 NOT allowed (avoids leap year complexity)
- Invalid dates rejected: Apr 31, Feb 30, month 13, etc.

**Frontend Implementation**:
- Yearly uses separate month/day selects (not single number input)
- JavaScript encodes to MMDD via `updateYearlyFrequencyValue()`
- JavaScript decodes for display via `getFrequencyDisplayText()`
- Preview shows: "Ежегодно, 15 марта"
- Client-side validation prevents invalid combinations (e.g., Feb 31)

**Backend Implementation**:
- `_calculate_next_occurrence()` decodes MMDD, calculates next year's date
- Algorithm: If current date >= target date this year, use next year
- `_get_frequency_display()` decodes to human-readable Russian text
- Comprehensive logging with `[CALC_NEXT]` and `[VALIDATION]` prefixes

**Example calculation**:
```python
# March 15 every year (frequency_value=315)
_calculate_next_occurrence(from_date=date(2025, 1, 1))
# → date(2025, 3, 15)  # Before March 15 this year

_calculate_next_occurrence(from_date=date(2025, 3, 20))
# → date(2026, 3, 15)  # After March 15 this year
```

**Logging**:
```python
# Backend validation
logger.info("[VALIDATION] yearly frequency_value=315 validated (month=3, day=15)")

# Backend calculation
logger.info("[CALC_NEXT] Yearly: decoded frequency_value=315 → month=3, day=15, from_date=2025-01-01")
logger.info("[CALC_NEXT] Yearly: 2025-01-01 → 2025-03-15")

# Frontend
console.log('[PLAN] updateYearlyFrequencyValue: month=3, day=15')
console.log('[PLAN] Encoded frequency_value: 315 (MMDD format)')
console.log('[PLAN] Yearly decoded: 315 → 15 марта')
```

**Related Files**:
- Backend: `backend/app/schemas/recurring_plan.py` (lines 127-175)
- Backend: `backend/app/services/recurring_plan_service.py` (lines 756-807)
- Frontend: `frontend/web/templates/components/modal_plan.html` (lines 155-187)
- Frontend: `frontend/web/templates/plan.html` (lines 2722-2743, 4358-4424, 4486-4516)
- Migration: `backend/db/migrations/versions/20251226_e8e69b30e4db_*.py`
- Documentation: `/docs/architecture/recurring-plans.md`

**Supported frequency types** (as of v6.2.0):
- `monthly` - Every Nth day of month (1-28)
- `quarterly` - Every Nth day of quarter (1-28)
- `yearly` - Every year on specific date (MMDD format)

**Removed frequency types** (as of v6.2.0):
- `daily` - Removed (too granular for budget planning)
- `weekly` - Removed (too granular for budget planning)

### Recurring Plans: Notification Integration (v6.4.0+)

**Since version 6.4.0**: Recurring plans support automatic reminder creation for each generated BudgetFact.

**Purpose**: Enable users to receive notifications before scheduled recurring payments (rent, subscriptions, bills).

**Architecture**: Uses existing `ScheduledReminder` infrastructure (same as one-time plans).

**How it works**:
1. User creates recurring plan with `enable_reminder=true` and sets `reminder_hour:reminder_minute`
2. System creates separate `ScheduledReminder` for EACH generated `BudgetFact` (not one for entire plan)
3. Reminders created immediately when facts are generated (3 months ahead initially + new facts from scheduler job)
4. Reminder datetime = `fact_date` + `reminder_hour:reminder_minute` in SYSTEM_TIMEZONE

**Database Schema** (RecurringPlan model):
```python
enable_reminder: bool = Field(
    default=False,
    description="Whether to create reminders for each generated fact"
)
reminder_hour: Optional[int] = Field(
    default=None, ge=0, le=23,
    description="Hour of reminder time (0-23) in SYSTEM_TIMEZONE"
)
reminder_minute: Optional[int] = Field(
    default=None, ge=0, le=59,
    description="Minute of reminder time (0-59) in SYSTEM_TIMEZONE"
)
```

**Validation**: CHECK constraint ensures complete reminder time:
```sql
CHECK (
  (enable_reminder = false) OR
  (enable_reminder = true AND reminder_hour IS NOT NULL AND reminder_minute IS NOT NULL)
)
```

**Business Logic** (`RecurringPlanService._create_reminders_for_facts()`):
- Skips facts in the past (`fact_date < today`)
- Skips if reminder datetime already passed (`reminder_datetime <= now`)
- Idempotent: Skips if `ScheduledReminder` already exists for fact
- Links reminder to fact via `fact_id` (ScheduledReminder.fact_id → BudgetFact.id)

**Example Usage**:
```python
# Create monthly recurring plan with reminders at 09:00
data = RecurringPlanCreate(
    article_id=5,
    financial_center_id=1,
    frequency_type="monthly",
    frequency_value=5,  # 5th of each month
    start_date=date(2025, 1, 5),
    occurrences_count=12,
    amount=Decimal("50000.00"),
    description="Monthly rent",
    enable_reminder=True,
    reminder_hour=9,
    reminder_minute=0,
)

# Result: Creates 3 BudgetFact records (3 months ahead) + 3 ScheduledReminder records
# Each reminder triggers at: fact_date 09:00:00
```

**Frontend Integration**:
- Checkbox toggle in `modal_add_plan` reveals time picker fields
- Validation prevents submission if reminder enabled but time not set
- Success toast displays reminder time: "Регулярный платеж создан! Сгенерировано записей: 3. Напоминания в 09:00"

**Display**:
- UI shows 🔔 bell icon next to facts that have reminders
- Recent transactions card updated via API (not WebSocket payload) to include reminder data

**Logging Prefixes**:
- Backend: `[RECURRING_REMINDER]`, `[RECURRING_PLAN]`
- Frontend: `[PLAN]` (form events, validation, encoding)

**Related Files**:
- Migration: `backend/db/migrations/versions/20251227_d1e6f4a267d5_add_recurring_plan_reminder_settings.py`
- Backend model: `backend/app/models/recurring_plan.py` (lines 160-179)
- Backend schema: `backend/app/schemas/recurring_plan.py` (lines 114-134, 348-368)
- Backend service: `backend/app/services/recurring_plan_service.py` (lines 622-725)
- Frontend: `frontend/web/templates/plan.html` (lines 1308-1323, 3506-3524, 3537-3569)

**See**: `/docs/architecture/recurring-plans.md` for complete documentation.

### Transfer Deduplication (Offline Sync & Duplicate Prevention)

**Added in version 5.4.1** - Critical fix to prevent duplicate transfer creation.

**Problem Solved:**
- Frontend double-submission (multiple clicks, network retries, race conditions)
- Offline sync repeated clicks
- Multiple form submissions creating duplicate transfers

**Architecture:**

Transfers use **sync_hash + content_hash** deduplication pattern (same as Facts):

```python
# Migration: 20251214_v7h8i9j0k1l2_add_deduplication_hashes.py
# Added to t_f_budget_fact and t_f_budget_fact_history:
- sync_hash: VARCHAR(32) NULL - MD5(content_hash|user_id|created_date)
- content_hash: VARCHAR(32) NULL - MD5(article_id|amount|fact_date|description|record_type)
```

**Deduplication Logic in transfers.py:143-241:**

1. **Check for duplicate** (if `is_offline_sync=true` AND `sync_hash` provided):
   ```python
   # Search for existing transfer with same sync_hash < 24 hours
   duplicate_stmt = select(BudgetFact).where(
       BudgetFact.sync_hash == transfer.sync_hash,
       BudgetFact.is_offline_sync == True,
       BudgetFact.transfer_id.isnot(None),
       BudgetFact.created_at >= datetime.utcnow() - timedelta(days=1)
   )
   ```

2. **Return existing transfer** (idempotent response):
   ```python
   if existing_fact:
       # Load both expense and income facts via transfer_id
       # Return TransferResponse with existing transfer_id + fact IDs
       return TransferResponse(
           transfer_id=existing_transfer_id,
           expense_fact_id=expense_fact.id,
           income_fact_id=income_fact.id,
           ...
       )
   ```

3. **Create new transfer** (if no duplicate found):
   ```python
   # Save sync_hash and content_hash to BOTH facts (expense + income)
   expense_fact = BudgetFact(
       ...,
       sync_hash=transfer.sync_hash,
       content_hash=transfer.content_hash,
   )
   income_fact = BudgetFact(
       ...,
       sync_hash=transfer.sync_hash,  # Same hash for both facts
       content_hash=transfer.content_hash,
   )
   ```

**Why sync_hash is SAME for both facts:**
- Transfer creates 2 BudgetFact records (expense + income)
- Both facts belong to same logical transfer operation
- Same `sync_hash` allows duplicate detection on EITHER fact
- Both facts share same `transfer_id` for linking

**Testing Deduplication:**

```bash
# 1. Create transfer with sync_hash
curl -X POST http://localhost:8000/api/v1/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from_financial_center_id": 1,
    "to_financial_center_id": 2,
    "from_article_id": 10,
    "to_article_id": 20,
    "amount": 100.00,
    "transfer_date": "2025-12-25",
    "is_offline_sync": true,
    "sync_hash": "abc123unique456hash789"
  }'

# Response: {"transfer_id": 100, "expense_fact_id": 200, "income_fact_id": 201, ...}

# 2. Repeat SAME request → should return EXISTING transfer
curl -X POST ... (same payload)

# Response: {"transfer_id": 100, ...}  # Same IDs (no new transfer created!)

# 3. Check database - should have exactly 2 BudgetFact records
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT id, transfer_id, sync_hash FROM t_f_budget_fact WHERE transfer_id = 100;"

# Expected: 2 rows (expense + income), both with same sync_hash

# 4. Check logs - second request should log deduplication
docker compose logs backend | grep "\[DEDUP\]"
# Expected: [DEDUP] Transfer duplicate detected: sync_hash=abc123..., existing_transfer_id=100
```

**Comparison with facts.py:**

| Feature | facts.py (single record) | transfers.py (2 records) |
|---------|--------------------------|--------------------------|
| Deduplication check | ✅ Yes (lines 111-173) | ✅ Yes (lines 173-241) |
| sync_hash usage | ✅ Per-record hash | ✅ Same hash for expense + income |
| content_hash usage | ✅ Per-record content | ✅ Same content for both facts |
| Idempotent response | ✅ Returns existing fact | ✅ Returns existing transfer |
| Time window | ✅ 24 hours | ✅ 24 hours |
| Write-Behind support | ✅ Yes (async via Redis) | ⚠️ No (sync write only) |

**Future Enhancement:**
- Add Write-Behind pattern to transfers.py for async writes (like facts.py)
- Would reduce latency from ~50ms to ~10ms for transfer creation

**Related Files:**
- `backend/app/schemas/transfer.py:69-78` - sync_hash/content_hash fields
- `backend/app/api/v1/endpoints/transfers.py:173-241` - Deduplication logic
- `backend/db/migrations/versions/20251214_v7h8i9j0k1l2_add_deduplication_hashes.py` - Migration

### JWT Authentication

- JWT tokens in **httpOnly cookies** (security)
- Middleware `JWTAuthMiddleware` automatically validates tokens
- Refresh tokens in DB (`RefreshToken` model)
- Telegram OAuth for login (`/auth/telegram` endpoint)

### Background Jobs (Scheduler)

- APScheduler for periodic tasks
- `backend/app/scheduler.py` - Scheduler configuration
- `bot/jobs/` - Job functions

**Example jobs:**
- Weekly report (every Monday)
- Database cleanup
- SSL certificate renewal check

## Critical Best Practices

### SQLAlchemy 2.0 AsyncSession

**CRITICALLY IMPORTANT:** Always use `await` for all async AsyncSession methods.

**Correct:**
```python
# Async methods require await
await session.execute(query)
await session.commit()
await session.delete(obj)
await session.refresh(obj)
```

**INCORRECT (RuntimeWarning):**
```python
# ❌ WITHOUT await - coroutine created but NOT executed!
session.delete(obj)  # RuntimeWarning: coroutine 'AsyncSession.delete' was never awaited
await session.commit()  # Commits empty transaction - nothing deleted!
```

**Consequences of missing `await`:**
- RuntimeWarning in logs
- Coroutines don't execute
- `commit()` commits empty transaction
- Data remains in DB (despite success logs)
- Very difficult to catch (code runs, logs write, but nothing happens)

### History Tables: Complete Field Copying

**Rule:** When creating records in History tables (`BudgetFactHistory`, `ArticleHistory`, etc.) MUST copy ALL fields from main table, including nullable fields.

**Why this is important:**
- History tables should preserve data snapshot at time of change
- NOT NULL constraints in History table are stricter than in main table (for data quality)
- Missing field = constraint violation = transaction rollback

**Example (BudgetFactHistory):**
```python
# ✅ CORRECT - all fields copied
fact_history = BudgetFactHistory(
    fact_id=fact.id,
    user_id=fact.user_id,
    article_id=fact.article_id,
    financial_center_id=fact.financial_center_id,  # nullable, but copy
    cost_center_id=fact.cost_center_id,            # nullable, but copy
    amount=fact.amount,
    fact_date=fact.fact_date,
    description=fact.description,
    record_type=fact.record_type,  # ⚠️ REQUIRED! NOT NULL in history
    transfer_id=fact.transfer_id,  # nullable, but copy for completeness
    valid_from=datetime.utcnow(),
    is_current=True,
    change_type="CREATE",
)

# ❌ INCORRECT - record_type missing
# → IntegrityError: null value in column "record_type"
```

### WebSocket Single Worker Requirement (Legacy - Now Redis Enabled)

**NOTE:** Multi-worker support added via Redis Pub/Sub in backend v5.x+

**Legacy constraint (v1.x-v4.x):**
- WebSocket used in-memory BudgetConnectionManager (no cross-worker sync)
- WORKERS=1 was mandatory to prevent event loss

**Current architecture (v5.x+):**
- **Redis Pub/Sub** synchronizes events between workers
- Multi-worker deployment supported (configure WORKERS in .env)
- Fallback to in-memory if Redis unavailable (single worker only)

**Configuration:**
- `docker-compose.yml`: `--workers 1` (default, safe for all setups)
- `setup.sh`: WORKERS configurable via .env
- Redis: Optional but recommended for scaling

**For scaling:**
- Set `REDIS_ENABLED=true` in .env
- Configure WORKERS > 1 for load balancing
- Redis Pub/Sub handles event broadcasting across workers

### Testing: Verify DB After Operations

**Rule:** After data modification operations (CREATE/UPDATE/DELETE) ALWAYS verify actual DB state, not just HTTP status codes.

**Why HTTP 200 != Successful Operation:**
- Async coroutines may not execute (see above)
- Logging happens BEFORE commit (may rollback after)
- Middleware may catch errors and return 200

**Best practice testing workflow:**

```bash
# 1. Execute operation via API
curl -X DELETE https://example.com/api/v1/admin/articles/45

# 2. ✅ REQUIRED: Verify DB
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT COUNT(*) FROM t_d_article WHERE id = 45;"

# 3. Check logs for warnings/errors
docker compose logs backend | grep -A10 "DELETE.*articles/45" | grep -i "warning\|error"

# 4. For DELETE operations: check History tables
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT change_type, COUNT(*) FROM t_d_article_history WHERE article_id = 45 GROUP BY change_type;"
```

### Service Worker Updates

**Since:** v6.4.1 (changed to manual update with "new" text indicator)
**Previous:** v6.4.0 (star icon), v5.4.0-v6.3.0 (auto-reload)
**Status:** ✅ Active

**Strategy:** Manual update with simple text indicator - users control when to apply updates.

**Key Features:**
- ✅ Simple "new" text indicator in header (no icon, no badge)
- ✅ User clicks to manually reload and apply update
- ✅ Silent first install (no notification)
- ✅ Update checks every 1 hour + on page load
- ✅ `skipWaiting()` + `clients.claim()` for immediate activation
- ✅ Version tracking via localStorage prevents unnecessary reloads
- ✅ Comprehensive logging with `[SW_UPDATE]` prefix

**Update Flow (Summary):**

1. Deploy new version → CACHE_VERSION updated
2. Browser detects update (hourly check OR page reload)
3. New SW installs and activates immediately (skipWaiting + claim)
4. "new" text indicator appears in header (fade-in + pulse animation)
5. User clicks "new" → page reloads → on new version

**Console Logging:**
```bash
[SW_UPDATE] 🔔 UPDATE AVAILABLE: v20251227_1530 → v20251227_1630
[SW_UPDATE] Showing "new" text indicator with fade-in animation
[SW_UPDATE] ✨ "new" text indicator now visible with pulse animation
[SW_UPDATE] User can click on "new" to reload and apply update
```

**Testing:**
```bash
# Update version
scripts/update-sw-version.sh

# Minify and deploy
npm run minify:js

# Reload page in browser
# Verify "new" indicator appears in header
# Click "new" to apply update
```

**Benefits:**
- ✅ User controls update timing (no data loss from unsaved forms)
- ✅ Minimal, unobtrusive UI (simple text, no icon)
- ✅ Prevents unnecessary reloads
- ✅ Multi-tab support

**See:**
- `/docs/architecture/pwa.md` - Full PWA documentation with detailed update flow
- `sw.js` lines 68-160 - Service worker install/activate events
- `frontend/web/templates/base.html` lines 774-785, 1490-1547 - Update indicator UI

### Wake Detection for Mobile (v5.7.0+)

**Purpose:** Service Worker participates in WebSocket recovery after long sleep on iOS/mobile devices.

**Problem:** iOS suspends JavaScript when screen is off 5+ minutes, WebSocket dies but recovery mechanisms may not fire.

**Solution:** Service Worker acts as backup wake detection mechanism (Layer 2 of 5-layer strategy).

**How it works:**
1. Page sends `pageWake` message to SW on visibility change
2. SW broadcasts `PAGE_WAKE` to all clients via `postMessage`
3. Clients trigger `_performWakeHealthCheck()` to verify/restore WebSocket

**Implementation (sw.js:324-338):**
```javascript
if (event.data.action === 'pageWake') {
    self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'PAGE_WAKE',
                timestamp: Date.now(),
                source: 'sw'
            });
        });
    });
}
```

**Client-side (budgetWSClient.js:110-122):**
```javascript
// Listen for SW wake messages
navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'PAGE_WAKE') {
        if (this.isLeader && document.visibilityState === 'visible') {
            this._performWakeHealthCheck();
        }
    }
});

// Notify SW on visibility change
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        navigator.serviceWorker.controller.postMessage({
            action: 'pageWake',
            timestamp: Date.now()
        });
    }
});
```

**Benefit:** Backup mechanism if Visibility API doesn't fire after long sleep.

**Complete 5-layer strategy:** See `/docs/architecture/pwa.md` → "WebSocket Recovery After Long Sleep"

### WebSocket Diagnostics Modal (v5.7.0+)

**Since version 5.7.0:** WebSocket diagnostic alert replaced with scrollable DaisyUI modal.

**Problem Solved:**
- Native `alert()` didn't support scrolling on iOS Safari 18+ / Yandex Browser
- Close button appeared below viewport (inaccessible)

**Solution:**
- DaisyUI modal with 90dvh max-height
- Singleton pattern (modal created once, content updated)
- Comprehensive logging via Logger class ([WS_DIAG] prefix)

**Trigger:** Triple-tap on WebSocket badge (#budget-sse-status-indicator)

**Implementation:**
- Modal HTML: `base.html` (around line 1993)
- JavaScript: `budgetWSClient.js`, `showDiagnostics()` method (line 2032)
- Logging: Uses existing Logger class (logger.js)

**Key Features:**
- Mobile-first design (works on iOS Safari, Yandex Browser)
- Dark mode compatible
- Graceful fallback to alert() if modal unavailable
- Console logging for remote debugging

**See:** `/docs/architecture/pwa.md` → "WebSocket Diagnostics Modal" for detailed documentation

### Navigation Detection for RTT Filtering (v5.8.0+)

**Since version 5.8.0:** RTT warnings are suppressed during page navigation/reload to prevent false positives.

**Problem Solved:**
- False "slow connection" warnings when navigating between pages (`/facts` → `/plan`)
- RTT spikes during WebSocket reconnection triggered warnings on fast networks

**Solution:**
- Navigation detection window (10 seconds after page load)
- RTT measurements filtered when `isNavigating = true`
- Badge updates skipped during navigation window

**Implementation:**
- Flag: `isNavigating` (true for 10s after page load)
- Auto-clears via timer
- Comprehensive logging: `[NAV]`, `[RTT_FILTER]`

**Configuration:**
- `NAVIGATION_WINDOW = 10000` (10 seconds)
- Adjustable in budgetWSClient.js:126-128

**Behavior:**
- 0-10s after page load: RTT warnings suppressed
- After 10s: Normal RTT monitoring (shows warnings if genuinely slow)
- Each navigation restarts the window

**Testing:**
Console filter: `NAV|RTT_FILTER|WS_RTT`

**Expected Console Output:**
```
[NAV] Navigation window started { duration: "10000ms" }
[RTT_FILTER] RTT measurement skipped (navigating)
[NAV] Navigation window ended { elapsed: "10000ms" }
[WS_RTT] RTT measured { current: "180ms", rolling_avg: "180ms" }
```

**Benefits:**
- Zero false positives during navigation
- Genuine slow connections still detected (after 10s)
- Clean user experience on mobile

**Files Modified:**
- `frontend/web/static/js/budget/budgetWSClient.js` (~80 lines)
- `frontend/web/static/js/utils/logger.js` (2 loggers added)
- `frontend/web/static/js/config/logging.js` (2 modules added)

**See:** `/docs/architecture/pwa.md` → "Navigation Detection for RTT Filtering" for complete documentation
**See:** `/docs/architecture/websocket.md` for WebSocket architecture and RTT monitoring details

## Workflow for Updating Application

**Critical to understand three directories:**
1. **Repository** (`~/familyBudget`) - Source code, git clone
2. **Deployment** (`/opt/budget`) - Working copy for Docker
3. **Docker volumes** - DB data, logs (persistent)

**Correct workflow:**
```bash
# 1. Update code in repository
cd ~/familyBudget
git pull origin main

# 2. Sync to /opt/budget
./setup.sh

# 3. Apply changes
./deploy.sh --profile full
```

**Common mistakes:**
```bash
# ❌ INCORRECT (copies itself to itself)
cd /opt/budget
./setup.sh

# ✅ CORRECT
cd ~/familyBudget  # Repository
./setup.sh         # Copies to /opt/budget
```

## API Endpoints

### Authentication
- `POST /auth/telegram` - Telegram OAuth login
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout

### REST API v1
- `/api/v1/articles` - CRUD categories
- `/api/v1/facts` - CRUD transactions
- `/api/v1/financial-centers` - CRUD financial centers
- `/api/v1/cost-centers` - CRUD cost centers
- `/api/v1/users` - User management (admin)
- `/api/v1/admin/logs` - Admin logs viewing (admin-only)
- `/api/v1/admin/logs/browser` - Browser logs ingestion (all users)

### Web Pages (HTMX)
- `/` - Home page
- `/transactions` - Transactions list
- `/statistics` - Statistics dashboard
- `/admin` - Admin panel
- `/admin/logs` - System logs viewer (admin-only, desktop/tablet)

### Telegram Web Apps
- `/webapp/` - Main menu
- `/webapp/add.html` - Add transaction
- `/webapp/history.html` - Transaction history
- `/webapp/stats.html` - Statistics

### Health Checks
- `/ping` - Simple ping
- `/health` - Basic health check
- `/ready` - Readiness probe
- `/health/detailed` - Detailed diagnostics

## Documentation

| Document | For |
|----------|-----|
| [START.md](START.md) | 🔧 Administrators (installation) |
| [CLAUDE.md](CLAUDE.md) | 👨‍💻 Developers |
| [docs/prd/](docs/prd/) | 📋 Product Requirements |
| [docs/guides/](docs/guides/) | 📖 User guides |
| `/docs` (Swagger) | 🔌 API documentation |
