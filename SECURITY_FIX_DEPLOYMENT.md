# Security Fix Deployment Guide

## Overview

Branch: `security/critical-fixes`
Commit: `858c5c9`
Severity: **CRITICAL + HIGH + MEDIUM**

**Fixes Applied:**
1. **CRITICAL:** CORS wildcard blocking (prevents CSRF attacks)
2. **HIGH:** Secure cookie environment-aware (prevents cookie theft)
3. **MEDIUM:** HSTS header enabled (prevents SSL stripping)
4. **Setup:** ALLOWED_ORIGINS generation with Telegram origins

---

## Deployment Steps

### Step 1: Manual .env Edit (ONE-TIME)

**⚠️ IMPORTANT:** This manual edit is required ONLY for this deployment. Future deployments will use setup.sh with correct ALLOWED_ORIGINS.

```bash
# SSH to server or edit directly
sudo nano /opt/budget/.env

# Line 113: Change FROM:
ALLOWED_ORIGINS=http://localhost:8000,https://your-domain.com

# TO:
ALLOWED_ORIGINS=https://budget-dev.ikeniborn.ru,https://web.telegram.org,https://oauth.telegram.org

# Save: Ctrl+O, Enter, Ctrl+X
```

**Verification:**
```bash
grep "ALLOWED_ORIGINS" /opt/budget/.env
# Expected: ALLOWED_ORIGINS=https://budget-dev.ikeniborn.ru,https://web.telegram.org,https://oauth.telegram.org
```

### Step 2: Deploy Code Changes

```bash
# 1. Pull latest code
cd ~/familyBudget
git checkout webapp
git pull origin webapp
git merge security/critical-fixes  # Or wait for PR merge

# 2. Deploy with smart cleanup
sudo ./deploy.sh --sync-mode mirror --profile full

# Smart cleanup will:
# - Keep PostgreSQL running (no data loss)
# - Rebuild backend/bot images
# - Restart services (~10 sec downtime)
```

### Step 3: Verify Deployment

**Test 1: CORS Blocked**
```bash
curl -I -H "Origin: https://evil.com" \
     https://budget-dev.ikeniborn.ru/api/v1/facts
# Expected: No Access-Control-Allow-Origin header OR 403
```

**Test 2: HSTS Present**
```bash
curl -I https://budget-dev.ikeniborn.ru | grep Strict-Transport
# Expected: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Test 3: Auth Works**
- Visit: https://budget-dev.ikeniborn.ru
- Click "Login with Telegram"
- Should work without CORS errors

**Test 4: WebApp Accessible**
- Open Telegram bot
- Try any WebApp command (e.g., /add)
- Should load without CORS errors

**Test 5: Logs Clean**
```bash
docker compose -f /opt/budget/docker-compose.yml logs --tail=50 backend | grep -i error
# Expected: No new errors related to CORS, cookies, or HSTS
```

---

## What Changed

### backend/app/core/config.py
- Added `Field` validator for CORS_ORIGINS
- Blocks wildcard "*" with ValueError
- Parses comma-separated string to list
- Added `APP_ENV` and `SSL_TYPE` fields

### backend/app/api/v1/endpoints/auth.py
- Secure cookie flag now environment-aware
- `secure=True` in production with SSL
- `secure=False` in development (HTTP)

### backend/app/middleware/csp_middleware.py
- HSTS header enabled in production
- Checks `APP_ENV == "production"` AND `SSL_TYPE == "letsencrypt"`
- Header: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

### setup.sh
- ALLOWED_ORIGINS now includes Telegram origins
- `https://web.telegram.org,https://oauth.telegram.org`
- Applied to all deployment profiles (full, basic)

---

## Rollback Plan

**If something breaks:**

```bash
# 1. Restore old .env
sudo cp /opt/budget/.env.backup /opt/budget/.env

# 2. Revert code
cd ~/familyBudget
git checkout webapp
git revert 858c5c9
git push origin webapp

# 3. Redeploy
sudo ./deploy.sh --sync-mode mirror --profile full

# Recovery time: ~3 minutes
```

---

## Security Impact

### Before Fix (Vulnerable):
- ❌ Any website could steal user data (CORS wildcard)
- ❌ Cookies could break in dev mode (hardcoded secure=True)
- ❌ SSL stripping attacks possible (no HSTS)

### After Fix (Secure):
- ✅ Only allowed origins can access API
- ✅ Cookies work in dev AND production
- ✅ Browsers enforce HTTPS (HSTS)

**Attack Scenarios Mitigated:**
1. **CSRF Attack:** Malicious website → Family Budget API ✅ BLOCKED
2. **Cookie Theft:** MITM attack → steal cookies ✅ PREVENTED (secure flag)
3. **SSL Stripping:** Downgrade HTTPS → HTTP ✅ PREVENTED (HSTS)

---

## Monitoring

**Watch for 24 hours:**
- Auth success rate (should be >95%)
- Error rate (should be <1%)
- User complaints (should be zero)
- CORS errors in browser console (should be zero)

**Alerts:**
```bash
# Check auth failures
docker compose -f /opt/budget/docker-compose.yml logs backend | grep "403\|401" | wc -l

# Check CORS errors
docker compose -f /opt/budget/docker-compose.yml logs backend | grep -i cors | wc -l
```

---

## Future Deployments

**✅ NO manual .env edit needed!**

setup.sh will automatically generate correct ALLOWED_ORIGINS for all future deployments:
- `https://${DOMAIN},https://web.telegram.org,https://oauth.telegram.org`

---

## Questions?

**Issue:** "Login doesn't work after deployment"
- Check: ALLOWED_ORIGINS includes `https://budget-dev.ikeniborn.ru`
- Check: Browser console for CORS errors
- Fix: Re-edit /opt/budget/.env with correct origins

**Issue:** "WebApp shows CORS error"
- Check: ALLOWED_ORIGINS includes `https://web.telegram.org`
- Fix: Add Telegram origins to /opt/budget/.env

**Issue:** "Backend won't start"
- Check: ALLOWED_ORIGINS is not empty
- Check: No wildcard "*" in ALLOWED_ORIGINS
- Fix: Set at least one valid origin

---

**Deployment Date:** 2025-11-13
**Deployed By:** Claude Code Security Audit
**Status:** ✅ Ready for Production
