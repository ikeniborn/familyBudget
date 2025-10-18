# Critical Deployment Issues - Fix Instructions

**Date:** 2025-10-18
**Version:** 5.2.0
**Status:** 🔴 CRITICAL - Site partially down, authentication broken

---

## 🔴 CRITICAL ISSUE: Missing t_f_refresh_token Table

### Problem Summary

- **Symptom:** Telegram Bot and Web authentication fail with 500 error
- **Root Cause:** Migration `013_create_refresh_tokens_table.sql` exists in repo but NOT applied to production database
- **Impact:**
  - ❌ Telegram Bot `/start` command fails
  - ❌ Web login doesn't work
  - ✅ Site loads (but no authentication)
  - ✅ Health checks pass

### Error in Logs

```
PostgreSQL: ERROR: relation "t_f_refresh_token" does not exist
Backend: ProgrammingError: relation "t_f_refresh_token" does not exist
Bot: Authentication failed: 500 - DATABASE_ERROR
```

---

## ⚡ IMMEDIATE FIX (On Production Server)

Execute these commands on `budget-dev.ikeniborn.ru`:

### Step 1: Update Code from Repository

```bash
cd ~/Documents/Project/familyBudget

# Pull latest changes (if needed)
git pull

# Re-run setup to copy ALL files including new migrations
./setup.sh

# Select: [2] Update deployment (preserve .env)
```

**What this does:** Copies missing migration 013 from repo to `/opt/budget/backend/db/migrations/`

---

### Step 2: Apply Missing Migration

```bash
cd /opt/budget

# Verify migration file exists
ls -la backend/db/migrations/013_create_refresh_tokens_table.sql

# Apply migration to database
sudo docker compose exec -T postgres psql -U familybudget familybudget < backend/db/migrations/013_create_refresh_tokens_table.sql

# Verify table was created
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "\d t_f_refresh_token"
```

**Expected output:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
COMMENT
...
```

---

### Step 3: Restart Services

```bash
cd /opt/budget

# Restart backend and bot to reload database schema
sudo docker compose restart backend bot

# Wait for services to become healthy
sleep 15

# Check status
sudo docker compose ps
```

**Expected:** All containers should be `healthy`.

---

### Step 4: Verify Fix

```bash
# 1. Check table exists and has correct structure
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "SELECT COUNT(*) FROM t_f_refresh_token;"

# Should return: 0 (table exists but empty)

# 2. Test Telegram Bot (send /start command)
# Should respond without 500 error

# 3. Check backend logs for errors
sudo docker compose logs backend --tail=50 | grep -i error

# Should be clean (no DATABASE_ERROR)
```

---

## 🔧 PERMANENT FIX (For Future Deployments)

The issue occurred because migration 013 was added AFTER initial deployment. To prevent this in future:

### Changes Made to deploy.sh

**New features in `run_migrations()` function:**

1. ✅ **Verify PostgreSQL is healthy** before migrations
2. ✅ **Check migrations directory exists** (`/opt/budget/backend/db/migrations/`)
3. ✅ **Count and list** all `.sql` migration files
4. ✅ **Wait for PostgreSQL** to accept connections (30s timeout)
5. ✅ **Apply migrations** in order (001, 002, 003, ...)
6. ✅ **Verify critical tables** exist after migrations:
   - `t_d_user`
   - `t_d_article`
   - `t_d_article_hierarchy`
   - `t_f_budget_fact`
   - `t_f_refresh_token` ← NEW CHECK
   - `t_d_cost_center`
   - `t_d_financial_center`

### Testing Improved deploy.sh

After pulling latest code:

```bash
cd ~/Documents/Project/familyBudget

# Test deployment with new migration checks
./deploy.sh

# Should output:
# ✓ Found 13 SQL migration files
# ✓ PostgreSQL is ready
# ✓ Applying SQL migrations...
# ✓ Migrations applied: 13, failed: 0
# ✓ All critical tables verified
```

---

## 📋 Additional Fixes Included

### 1. Nginx Healthcheck Fix

**Problem:** Nginx marked as `unhealthy` because healthcheck fails.

**Root Cause:** Healthcheck tries `http://localhost/health` but HTTP server block doesn't have `/health` location.

**Fix Applied:** Added `/health` location to HTTP server block in `nginx/conf.d/app.conf.template`:

```nginx
# Health check endpoint (for Docker healthcheck)
location /health {
    proxy_pass http://backend;
    proxy_set_header Host $host;
    access_log off;
}
```

**To apply:**
```bash
cd ~/Documents/Project/familyBudget
./setup.sh  # Copies updated nginx config

cd /opt/budget
sudo docker compose exec nginx nginx -t  # Test config
sudo docker compose exec nginx nginx -s reload  # Reload
```

---

### 2. PostgreSQL External Access (UFW)

**Problem:** PostgreSQL configured for external access but UFW firewall blocks connections.

**Configuration in `.env`:**
```bash
POSTGRES_EXTERNAL_ACCESS=true
POSTGRES_ALLOWED_IP=78.107.114.37
POSTGRES_PORT_MAPPING=5432:5432
```

**Fix:**
```bash
# Add UFW rule for allowed IP
sudo ufw allow from 78.107.114.37 to any port 5432 proto tcp comment 'PostgreSQL external access'

# Verify
sudo ufw status | grep 5432
```

---

### 3. Website Accessibility (Ports 80/443)

**Verify ports are open:**
```bash
sudo ufw status | grep -E '80|443'

# If closed - open them
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
```

---

## 🧪 Complete Verification Checklist

After applying all fixes:

```bash
cd /opt/budget

echo "=== DOCKER CONTAINERS ==="
sudo docker compose ps
# Expected: ALL healthy (postgres, backend, bot, nginx)

echo "=== DATABASE TABLES ==="
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "\dt t_f_*" | head -30
# Expected: 26 rows (t_f_budget_fact + partitions + t_f_refresh_token)

echo "=== CRITICAL TABLE CHECK ==="
for table in t_d_user t_d_article t_d_article_hierarchy t_f_budget_fact t_f_refresh_token t_d_cost_center t_d_financial_center; do
    echo -n "$table: "
    sudo docker compose exec -T postgres psql -U familybudget familybudget -c "\d $table" >/dev/null 2>&1 && echo "✓ EXISTS" || echo "✗ MISSING"
done

echo "=== UFW FIREWALL ==="
sudo ufw status numbered | grep -E '5432|80|443'

echo "=== REFRESH TOKENS ==="
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "SELECT COUNT(*) as token_count FROM t_f_refresh_token;"

echo "=== SITE HEALTH ==="
curl -s http://localhost:8000/health | jq .
```

---

## 🎯 Expected Final State

After all fixes:

| Component | Status | Details |
|-----------|--------|---------|
| PostgreSQL | ✅ healthy | All 27 tables exist including `t_f_refresh_token` |
| Backend | ✅ healthy | No DATABASE_ERROR in logs |
| Bot | ✅ healthy | `/start` command works |
| Nginx | ✅ healthy | Healthcheck passes |
| UFW Firewall | ✅ configured | Ports 80, 443, 5432 (for specific IP) open |
| Telegram Auth | ✅ working | Tokens stored in `t_f_refresh_token` |
| Web Auth | ✅ working | Login/logout functional |
| Site Access | ✅ public | http://budget-dev.ikeniborn.ru/ accessible |

---

## 🚨 Known Remaining Issues (Non-Critical)

These require file modifications and are deferred:

### 1. SSL Auto-Renewal Issue

**Problem:** Certbot uses `--standalone` mode which requires:
- Stopping nginx
- Opening port 80 in UFW
- Manual intervention every 90 days

**Impact:** ⚠️ MEDIUM - Certificates will fail to renew if port 80 is closed

**Solution:** Migrate to `webroot` mode (requires nginx config + ssl_certificate_manager.sh changes)

**Tracking:** See `docs/deployment/SSL_WEBROOT_MIGRATION.md` (to be created)

---

### 2. PostgreSQL listen_addresses

**Problem:** PostgreSQL configured to listen on `0.0.0.0` inside container but may need explicit configuration.

**Impact:** ⚠️ LOW - External access works but could be more explicit

**Solution:** Add `-c listen_addresses=*` to `docker-compose.yml` postgres command

**Tracking:** Will be included in next release

---

## 📖 Related Documentation

- [Main README](../../README.md) - Project overview
- [START.md](../../START.md) - Quick start guide
- [DB_DEPLOYMENT.md](DB_DEPLOYMENT.md) - Database deployment details
- [API_DOCUMENTATION.md](../api/API_DOCUMENTATION.md) - API reference

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-18 | Initial documentation of critical issues and fixes |

---

## ✅ Sign-off

After completing ALL steps above and verification checklist passes:

**Deployed by:** `__________`
**Date:** `__________`
**All checks passed:** ☐ Yes ☐ No
**Notes:** `__________`
