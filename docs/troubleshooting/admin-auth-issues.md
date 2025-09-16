# Admin Authentication Issues - Comprehensive Troubleshooting Guide

## 📋 Overview

This guide provides comprehensive troubleshooting steps for all admin authentication related issues in the Family Budget system. It covers the most common problems admin users face when trying to access protected administrative features.

## 🚨 Common Admin Authentication Issues

### 1. 401 Unauthorized Error on /settings
**Symptoms:**
- Admin users get "401 Unauthorized" when accessing `/settings`
- Settings page redirects to login despite valid admin session
- Console shows authentication failures

**Quick Fix:**
```bash
# Restart frontend container to reload configuration
docker restart budget-frontend

# Check if issue persists
curl -s -w "HTTP Status: %{http_code}\n" http://localhost:5173/settings
```

**Root Causes & Solutions:** See [Detailed 401 Fix Section](#detailed-401-troubleshooting)

### 2. Admin Features Not Visible in UI
**Symptoms:**
- Settings icon missing from navigation
- Admin-only menu items not appearing
- User appears to have admin role but UI shows regular user features

**Quick Fix:**
```bash
# Verify admin role in database
docker exec budget-postgres psql -U budget -d budgetdb -c "
SELECT user_id, user_name, user_role, created_at
FROM t_d_user
WHERE user_role = 'admin';
"

# Clear browser cache and cookies
# Re-login to refresh session data
```

### 3. Session Persistence Issues
**Symptoms:**
- Admin users frequently logged out
- Session expires too quickly
- Need to re-authenticate repeatedly

**Quick Fix:**
```bash
# Check Redis session store
docker exec budget-redis redis-cli KEYS "*" | wc -l
echo "Active sessions count above"

# Verify session configuration
docker exec budget-backend env | grep SESSION
```

### 4. Backend Connectivity Problems
**Symptoms:**
- Intermittent authentication failures
- Long delays on admin pages
- Network timeout errors

**Quick Fix:**
```bash
# Test backend connectivity
docker exec budget-frontend curl -s -w "Time: %{time_total}s\nStatus: %{http_code}\n" http://budget-backend:4000/health
```

## 🔍 Detailed 401 Troubleshooting

### Phase 1: Initial Diagnostics

#### Step 1: Verify System Status
```bash
# Check all containers are running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep budget-

# Expected output: All containers should show "Up" status
```

#### Step 2: Test Backend API Directly
```bash
# Test backend health
docker exec budget-backend curl -s http://localhost:4000/health

# Expected: {"status":"healthy","version":"3.3.3","timestamp":"..."}
```

#### Step 3: Verify Admin Users Exist
```bash
# Check admin users in database
docker exec budget-postgres psql -U budget -d budgetdb -c "
SELECT
  user_id,
  user_name,
  user_role,
  is_active,
  created_at,
  last_login
FROM t_d_user
WHERE user_role = 'admin'
ORDER BY last_login DESC;
"
```

#### Step 4: Check Session Store
```bash
# Verify Redis is working
docker exec budget-redis redis-cli ping
# Expected: PONG

# Check active sessions
docker exec budget-redis redis-cli KEYS "sess:*"
```

### Phase 2: Session Cookie Investigation

#### Step 1: Inspect Browser Cookies
1. Open browser Developer Tools (F12)
2. Go to Application → Storage → Cookies → `http://localhost:5173`
3. Look for cookies: `connect.sid` or `familybudget.sid`
4. Copy the cookie value for testing

#### Step 2: Test Session Cookie Format
```bash
# Test with your actual cookie value
COOKIE_VALUE="your-cookie-value-here"

# Test API with cookie
docker exec budget-backend curl -s \
  -H "Cookie: connect.sid=$COOKIE_VALUE" \
  -w "HTTP Status: %{http_code}\n" \
  http://localhost:4000/api/auth/me
```

#### Step 3: Validate Session Data
```bash
# If you have session ID (after 's:' prefix)
SESSION_ID="extracted-session-id"

# Check session content in Redis
docker exec budget-redis redis-cli GET "sess:$SESSION_ID"
```

### Phase 3: Advanced Diagnostics

#### Step 1: Enable Development Logging
```bash
# Set development environment
docker exec -it budget-frontend sh -c 'export NODE_ENV=development && npm run dev'

# Watch logs for authentication debugging
docker logs -f budget-frontend | grep -i auth
```

#### Step 2: Network Connectivity Deep Dive
```bash
# Test frontend → backend connectivity
docker exec budget-frontend nslookup budget-backend
docker exec budget-frontend ping -c 3 budget-backend
docker exec budget-frontend telnet budget-backend 4000

# Test different backend URL formats
docker exec budget-frontend curl -s -w "Status: %{http_code}\n" http://budget-backend:4000/health
docker exec budget-frontend curl -s -w "Status: %{http_code}\n" http://localhost:4000/health
```

#### Step 3: Trace Authentication Flow
```bash
# Enable detailed logging and trace a login
docker exec budget-frontend npm run dev &
docker exec budget-backend uvicorn app.main:app --reload --host 0.0.0.0 --port 4000 --log-level debug &

# Monitor logs during authentication
docker logs -f budget-frontend --tail=20 &
docker logs -f budget-backend --tail=20 &
```

## 🔧 Solution Implementation

### Fix 1: Session Handling Enhancement (ADR-008)

**Files to check:**
- `/frontend-svelte/src/hooks.server.ts`

**Key improvements:**
```typescript
// Ensure this logic exists in hooks.server.ts
let sessionId = connectSid || familyBudgetSid;

// Handle different cookie formats
if (sessionId) {
  sessionId = sessionId.replace(/^s:/, '').replace(/\..*$/, '');
}

// Proper cookie header formation
const cookieHeader = connectSid
  ? `connect.sid=${connectSid}`
  : familyBudgetSid
  ? `familybudget.sid=${familyBudgetSid}`
  : `connect.sid=s:${sessionId}`;
```

### Fix 2: Backend URL Configuration (ADR-009)

**Files to check:**
- `/frontend-svelte/src/hooks.server.ts`
- Environment variables

**Key configuration:**
```typescript
// Smart backend URL detection
const backendUrl = process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'http://budget-backend:4000'  // Docker internal
    : 'http://localhost:4000'       // Development
  );
```

### Fix 3: Network Connectivity Validation

**Add connectivity check:**
```typescript
// Validate backend connectivity before auth requests
async function validateBackendConnectivity(url) {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
```

## 🧪 Testing & Validation

### Automated Test Suite
```bash
# Run comprehensive authentication tests
docker exec budget-backend python -m pytest tests/backend/test_admin_settings_auth.py -v
docker exec budget-frontend npm run test admin-settings-auth.test.ts

# Run connectivity tests
docker exec budget-backend python -m pytest tests/backend/test_backend_url_connectivity.py -v
docker exec budget-frontend npm run test backend-url-config.test.ts

# Run integration tests
docker exec budget-backend python -m pytest tests/integration/test_admin_auth_integration.py -v
```

### Manual Validation Steps
```bash
# Step 1: Clear all cookies and restart
docker-compose down
docker-compose up -d
# Clear browser cookies
# Login as admin user

# Step 2: Test settings access
curl -s -w "HTTP Status: %{http_code}\n" http://localhost:5173/settings

# Step 3: Verify admin features
# Check that settings icon is visible in UI
# Verify admin can access all reference data pages

# Step 4: Test session persistence
# Login, wait 10 minutes, check if still authenticated
# Refresh page multiple times, verify no re-authentication needed
```

## 📊 Monitoring & Prevention

### Health Check Script
```bash
# Create monitoring script
cat > /home/ikeniborn/Documents/Project/familyBudget/scripts/admin-auth-monitor.sh << 'EOF'
#!/bin/bash
echo "=== Admin Authentication Health Check ==="

# 1. Container status
echo "1. Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep budget-

# 2. Admin users count
echo -e "\n2. Admin Users:"
docker exec budget-postgres psql -U budget -d budgetdb -tA -c "
SELECT COUNT(*) || ' admin users found'
FROM t_d_user
WHERE user_role = 'admin' AND is_active = true;
"

# 3. Active sessions
echo -e "\n3. Active Sessions:"
docker exec budget-redis redis-cli KEYS "sess:*" | wc -l | xargs echo "Active sessions:"

# 4. Backend connectivity
echo -e "\n4. Backend Connectivity:"
docker exec budget-frontend curl -s -w "Response time: %{time_total}s\nStatus: %{http_code}\n" http://budget-backend:4000/health

# 5. Settings page accessibility
echo -e "\n5. Settings Page Test:"
curl -s -w "HTTP Status: %{http_code}\n" http://localhost:5173/settings | tail -1

echo -e "\n=== Health Check Complete ==="
EOF

chmod +x /home/ikeniborn/Documents/Project/familyBudget/scripts/admin-auth-monitor.sh
```

### Regular Monitoring
```bash
# Run weekly
./scripts/admin-auth-monitor.sh

# Set up automated alerts (optional)
(crontab -l 2>/dev/null; echo "0 9 * * 1 /home/ikeniborn/Documents/Project/familyBudget/scripts/admin-auth-monitor.sh") | crontab -
```

### Metrics to Track
- **Admin login success rate**: Should be > 98%
- **Settings page response time**: Should be < 2 seconds
- **Session persistence rate**: Should be > 95%
- **Backend connectivity uptime**: Should be > 99.5%

## 🎯 Preventive Measures

### 1. Regular System Maintenance
```bash
# Weekly maintenance routine
docker system prune -f
docker exec budget-redis redis-cli FLUSHDB  # Clear old sessions
docker restart budget-frontend budget-backend  # Refresh connections
```

### 2. Configuration Validation
```bash
# Monthly configuration check
./scripts/admin-auth-monitor.sh > /tmp/auth-check.log
grep -i error /tmp/auth-check.log && echo "Issues found!" || echo "All systems normal"
```

### 3. User Role Auditing
```bash
# Monthly admin user audit
docker exec budget-postgres psql -U budget -d budgetdb -c "
SELECT
  user_name,
  user_role,
  last_login,
  CASE
    WHEN last_login < NOW() - INTERVAL '30 days' THEN 'Inactive'
    ELSE 'Active'
  END as status
FROM t_d_user
WHERE user_role = 'admin'
ORDER BY last_login DESC;
"
```

## 📚 Related Documentation

### Architecture Decision Records
- [ADR-008: Admin Settings Auth Fix](/docs/architecture/adr-008-admin-settings-auth-fix.md) - Session handling improvements
- [ADR-009: Backend URL Configuration Fix](/docs/architecture/adr-009-backend-url-configuration-fix.md) - Network connectivity fix
- [ADR-006: Role-Based Access Control](/docs/architecture/adr-006-role-based-access-control.md) - RBAC implementation

### API Documentation
- [Authentication API](/docs/api/authentication.md) - Auth endpoint documentation
- [Session Management](/docs/api/session-management.md) - Session handling details
- [Access Control](/docs/api/access-control.md) - Permission system

### Troubleshooting Guides
- [Admin Settings 401 Fix](/docs/troubleshooting/admin-settings-401-fix.md) - Specific 401 error guide
- [Session Errors](/docs/troubleshooting/session-errors.md) - Session-related issues

### Testing Documentation
- [Test Coverage](/docs/testing/test-coverage.md) - Authentication test details

## 🆘 Emergency Procedures

### Critical System Recovery
```bash
# If admin authentication completely fails:

# 1. Full system restart
docker-compose down
docker system prune -f
docker-compose up -d

# 2. Database consistency check
docker exec budget-postgres psql -U budget -d budgetdb -c "
SELECT 'Admin users: ' || COUNT(*) FROM t_d_user WHERE user_role = 'admin';
SELECT 'Active sessions: ' || COUNT(*) FROM information_schema.tables WHERE table_name = 'sessions';
"

# 3. Emergency admin user creation (if needed)
docker exec budget-backend python -c "
from app.core.database import get_db
from app.models.user import User
from app.core.security import get_password_hash
import asyncio

async def create_emergency_admin():
    async for db in get_db():
        admin = User(
            username='emergency_admin',
            password_hash=get_password_hash('temp_password_123'),
            role='admin',
            is_active=True
        )
        db.add(admin)
        await db.commit()
        print('Emergency admin created: username=emergency_admin, password=temp_password_123')
        break

asyncio.run(create_emergency_admin())
"

# 4. Test emergency access
# Login with emergency_admin / temp_password_123
# Change password immediately after login
```

### Contact Information
- **System Administrator**: Check internal documentation
- **Development Team**: See project contributors
- **Emergency Escalation**: Follow company incident response procedures

---

**Document Version**: 1.0
**Last Updated**: 16.09.2025
**Applicable Version**: v3.3.3+
**Review Schedule**: Monthly