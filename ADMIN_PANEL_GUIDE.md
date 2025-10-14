# Family Budget - Admin Panel Guide

**Version:** 1.0
**Last Updated:** 2025-10-14
**Target Audience:** System administrators, project maintainers

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Admin Dashboard](#admin-dashboard)
4. [Users Management](#users-management)
5. [Articles Management](#articles-management)
6. [Facts Management](#facts-management)
7. [System Monitoring](#system-monitoring)
8. [API Reference](#api-reference)
9. [Security](#security)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is the Admin Panel?

The Family Budget Admin Panel provides comprehensive administrative tools for managing users, categories (articles), financial transactions (facts), and system monitoring. Admin users have elevated privileges to:

- View and manage all users in the system
- Grant or revoke admin privileges
- Manage global article categories (shared across all users)
- View, edit, and delete any financial transaction
- Monitor system health and performance
- Access detailed statistics and analytics

### Key Features

**Users Management:**
- View all registered users
- Grant/revoke admin privileges
- View user statistics (facts count, articles count, last activity)
- Track user history with SCD Type 2 versioning

**Articles Management:**
- Create, update, and delete article categories
- Manage hierarchical category structures
- Create global categories (available to all users)
- Track category changes with SCD Type 2 versioning

**Facts Management:**
- View all financial transactions
- Filter by user, category, date range
- Edit or delete any transaction
- Batch delete multiple transactions
- Paginated data access

**System Monitoring:**
- Real-time health checks
- System resource monitoring (CPU, memory, disk)
- Database statistics and latency
- Component status indicators
- Auto-refresh dashboard

---

## Getting Started

### Prerequisites

- Family Budget application installed and running
- Admin privileges granted to your user account
- Access to the web interface

### Accessing the Admin Panel

1. **Login to Family Budget**
   ```
   Navigate to: http://your-domain.com
   Click "Login" and authenticate via Telegram
   ```

2. **Navigate to Admin Section**
   - Admin menu items appear in the navigation bar
   - Available pages:
     - Admin: Users
     - Admin: Articles
     - Admin: Facts
     - Admin: Monitoring

### Admin Privileges

**How to become an admin:**

1. **First User:** The first user to register is automatically admin
2. **Via Database:** Manually set `is_admin=True` in database
3. **Via Existing Admin:** Another admin can grant you privileges

**Security Note:** Always maintain at least one admin user. The system prevents demoting the last admin.

---

## Admin Dashboard

### Navigation Menu

```
┌──────────────────────────────────────────────────┐
│  💰 Family Budget                                │
│  [Dashboard] [Analytics] [Admin: Users] [Admin: │
│   Articles] [Admin: Facts] [Admin: Monitoring]   │
└──────────────────────────────────────────────────┘
```

**Regular Users See:**
- Dashboard
- Analytics

**Admin Users See:**
- Dashboard
- Analytics
- Admin: Users ← Admin-only
- Admin: Articles ← Admin-only
- Admin: Facts ← Admin-only
- Admin: Monitoring ← Admin-only

---

## Users Management

### Overview

Manage all registered users, grant or revoke admin privileges, and view user statistics.

**Access:** `/admin/users`

### Features

#### 1. Users List

**Displays:**
- Telegram ID
- Username
- First Name / Last Name
- Admin Status
- Current Version (is_current)
- Valid From / Valid To dates

**Actions:**
- View user details
- Edit user (grant/revoke admin)
- View statistics

**Example:**
```
┌─────────────────────────────────────────────────────────────┐
│ User Management                                   [+ Add]    │
├─────────────────────────────────────────────────────────────┤
│ ID │ Username   │ Name        │ Admin │ Current │ Actions  │
├────┼────────────┼─────────────┼───────┼─────────┼──────────┤
│ 1  │ alice      │ Alice Smith │ ✓     │ ✓       │ [Edit]   │
│ 2  │ bob        │ Bob Jones   │ ✗     │ ✓       │ [Edit]   │
│ 3  │ charlie    │ Charlie Doe │ ✗     │ ✓       │ [Edit]   │
└────┴────────────┴─────────────┴───────┴─────────┴──────────┘
```

#### 2. Grant Admin Privileges

**Steps:**
1. Click "Edit" next to user
2. Check "Admin" checkbox
3. Click "Save"

**Result:**
- New user version created (SCD Type 2)
- Old version marked as `is_current=False`
- New version has `is_admin=True`

**API Call:**
```bash
curl -X PUT http://localhost:8000/api/v1/admin/users/2 \
  -H "Content-Type: application/json" \
  -d '{"is_admin": true}'
```

#### 3. Revoke Admin Privileges

**Steps:**
1. Click "Edit" next to user
2. Uncheck "Admin" checkbox
3. Click "Save"

**Protection:** Cannot revoke if user is the last admin

**Result:**
- New user version created
- `is_admin=False` in new version

#### 4. User Statistics

**View:**
- Total facts (financial transactions)
- Total articles (categories)
- Last fact date (last activity)

**Access:** Click "Statistics" or navigate to `/admin/users/stats/summary`

**Example:**
```
┌──────────────────────────────────────────────────┐
│ User Statistics                                  │
├──────────────────────────────────────────────────┤
│ Username   │ Facts │ Articles │ Last Activity   │
├────────────┼───────┼──────────┼─────────────────┤
│ alice      │ 342   │ 25       │ 2025-10-14      │
│ bob        │ 156   │ 18       │ 2025-10-12      │
│ charlie    │ 89    │ 12       │ 2025-10-10      │
└────────────┴───────┴──────────┴─────────────────┘
```

### API Endpoints

**GET /api/v1/admin/users**
```bash
# Get all users
curl http://localhost:8000/api/v1/admin/users

# Filter by current users only
curl http://localhost:8000/api/v1/admin/users?is_current=true

# Include historical versions
curl http://localhost:8000/api/v1/admin/users?is_current=false
```

**GET /api/v1/admin/users/{user_id}**
```bash
# Get specific user
curl http://localhost:8000/api/v1/admin/users/1
```

**PUT /api/v1/admin/users/{user_id}**
```bash
# Grant admin privileges
curl -X PUT http://localhost:8000/api/v1/admin/users/2 \
  -H "Content-Type: application/json" \
  -d '{"is_admin": true}'

# Revoke admin privileges
curl -X PUT http://localhost:8000/api/v1/admin/users/2 \
  -H "Content-Type: application/json" \
  -d '{"is_admin": false}'
```

**GET /api/v1/admin/users/stats/summary**
```bash
# Get statistics for all users
curl http://localhost:8000/api/v1/admin/users/stats/summary
```

---

## Articles Management

### Overview

Manage income and expense categories (articles) for the entire system. Create global categories available to all users or user-specific categories.

**Access:** `/admin/articles`

### Features

#### 1. Articles List

**Displays:**
- Article ID
- Name
- Type (income/expense)
- Global (shared) or User-specific
- Parent category
- Current version status

**Hierarchical Display:**
```
Income
└── Salary
└── Freelance
    └── Web Development
    └── Consulting

Expenses
└── Food
    └── Groceries
    └── Restaurants
└── Transport
    └── Gas
    └── Public Transit
```

**Example:**
```
┌──────────────────────────────────────────────────────────────┐
│ Articles Management                                [+ Add]    │
├──────────────────────────────────────────────────────────────┤
│ ID │ Name           │ Type    │ Global │ Parent │ Actions   │
├────┼────────────────┼─────────┼────────┼────────┼───────────┤
│ 1  │ Salary         │ income  │ ✓      │ -      │ [Edit][X] │
│ 2  │ Food           │ expense │ ✓      │ -      │ [Edit][X] │
│ 3  │ Groceries      │ expense │ ✓      │ 2      │ [Edit][X] │
│ 4  │ Restaurants    │ expense │ ✗      │ 2      │ [Edit][X] │
└────┴────────────────┴─────────┴────────┴────────┴───────────┘
```

#### 2. Create New Article

**Steps:**
1. Click "+ Add Article"
2. Fill form:
   - Name: Category name
   - Type: Income or Expense
   - Parent: (optional) Select parent category
   - Global: Check if shared across all users
3. Click "Create"

**Validation:**
- Parent must exist
- Parent and child must have same type
- Name must be unique within parent

**Example:**
```json
{
  "name": "Healthcare",
  "type": "expense",
  "is_global": true,
  "parent_id": null
}
```

#### 3. Update Article

**Steps:**
1. Click "Edit" next to article
2. Modify:
   - Name
   - Parent (change hierarchy)
3. Click "Save"

**Result:**
- New article version created (SCD Type 2)
- Old version marked as `is_current=False`
- Type and Global flag cannot be changed

**API Call:**
```bash
curl -X PUT http://localhost:8000/api/v1/admin/articles/3 \
  -H "Content-Type: application/json" \
  -d '{"name": "Food & Beverages"}'
```

#### 4. Delete Article

**Steps:**
1. Click "Delete" (X) next to article
2. Confirm deletion

**Protection:** Cannot delete if article has active children

**Result:**
- Soft delete (deactivate)
- `is_current=False`
- `valid_to=NOW()`
- Record preserved for historical data

#### 5. Filters

**Available Filters:**
- **Current Only:** Show only active articles
- **Global Only:** Show only global articles
- **User-specific Only:** Show only user articles
- **Type:** Filter by income/expense

**Example:**
```bash
# Global articles only
curl "http://localhost:8000/api/v1/admin/articles?is_global=true"

# User-specific articles
curl "http://localhost:8000/api/v1/admin/articles?is_global=false"

# Include historical versions
curl "http://localhost:8000/api/v1/admin/articles?is_current=false"
```

### API Endpoints

**GET /api/v1/admin/articles**
```bash
# Get all articles
curl http://localhost:8000/api/v1/admin/articles

# Filter by global
curl "http://localhost:8000/api/v1/admin/articles?is_global=true"

# Filter by current
curl "http://localhost:8000/api/v1/admin/articles?is_current=true"
```

**POST /api/v1/admin/articles**
```bash
# Create global article
curl -X POST http://localhost:8000/api/v1/admin/articles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Healthcare",
    "type": "expense",
    "is_global": true,
    "parent_id": null
  }'

# Create child article
curl -X POST http://localhost:8000/api/v1/admin/articles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Medicine",
    "type": "expense",
    "is_global": true,
    "parent_id": 5
  }'
```

**PUT /api/v1/admin/articles/{article_id}**
```bash
# Update article name
curl -X PUT http://localhost:8000/api/v1/admin/articles/5 \
  -H "Content-Type: application/json" \
  -d '{"name": "Health & Medicine"}'

# Change parent
curl -X PUT http://localhost:8000/api/v1/admin/articles/8 \
  -H "Content-Type: application/json" \
  -d '{"parent_id": 5}'
```

**DELETE /api/v1/admin/articles/{article_id}**
```bash
# Deactivate article (soft delete)
curl -X DELETE http://localhost:8000/api/v1/admin/articles/5
```

---

## Facts Management

### Overview

View, edit, and delete financial transactions (facts) for all users. Powerful filtering and batch operations.

**Access:** `/admin/facts`

### Features

#### 1. Facts List

**Displays:**
- Fact ID
- User
- Article (category)
- Amount
- Date
- Description

**Pagination:**
- Default: 50 facts per page
- Max: 500 facts per page

**Example:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ Facts Management                                            [Delete Selected] │
├────────────────────────────────────────────────────────────────────────────┤
│ □ │ ID  │ User   │ Article      │ Amount    │ Date       │ Description   │
├───┼─────┼────────┼──────────────┼───────────┼────────────┼───────────────┤
│ □ │ 342 │ alice  │ Groceries    │ $125.50   │ 2025-10-14 │ Weekly shop   │
│ □ │ 341 │ bob    │ Salary       │ $5,000.00 │ 2025-10-01 │ October pay   │
│ □ │ 340 │ alice  │ Gas          │ $45.00    │ 2025-10-13 │ Fill up       │
└───┴─────┴────────┴──────────────┴───────────┴────────────┴───────────────┘

Showing 1-50 of 1,234 facts  [<] [1] [2] [3] ... [25] [>]
```

#### 2. Filters

**Available Filters:**
- **User:** Filter by specific user
- **Article:** Filter by category
- **Date From:** Start date (YYYY-MM-DD)
- **Date To:** End date (YYYY-MM-DD)
- **Limit:** Results per page (1-500)
- **Offset:** Pagination offset

**Example:**
```bash
# Facts for specific user
curl "http://localhost:8000/api/v1/admin/facts?user_id=1"

# Facts in date range
curl "http://localhost:8000/api/v1/admin/facts?date_from=2025-10-01&date_to=2025-10-31"

# Pagination
curl "http://localhost:8000/api/v1/admin/facts?limit=50&offset=0"

# Combined filters
curl "http://localhost:8000/api/v1/admin/facts?user_id=1&date_from=2025-10-01&limit=100"
```

#### 3. Edit Fact

**Steps:**
1. Click "Edit" next to fact
2. Modify:
   - Amount
   - Date
   - Description
   - Article (category)
3. Click "Save"

**Result:**
- Fact updated in-place (no versioning)
- Changes immediate

**API Call:**
```bash
curl -X PUT http://localhost:8000/api/v1/admin/facts/342 \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 130.00,
    "description": "Weekly shop + extras"
  }'
```

#### 4. Delete Single Fact

**Steps:**
1. Click "Delete" (X) next to fact
2. Confirm deletion

**Result:**
- Physical delete (permanent)
- Record removed from database
- Cannot be recovered

**API Call:**
```bash
curl -X DELETE http://localhost:8000/api/v1/admin/facts/342
```

#### 5. Batch Delete Facts

**Steps:**
1. Check boxes next to facts to delete
2. Click "Delete Selected"
3. Confirm batch deletion

**Limit:** Maximum 500 facts per batch

**Result:**
- All selected facts deleted
- Returns count of deleted records

**API Call:**
```bash
curl -X POST http://localhost:8000/api/v1/admin/facts/batch-delete \
  -H "Content-Type: application/json" \
  -d '[342, 341, 340]'
```

#### 6. Facts Count

**Purpose:** Get total count for pagination

**API Call:**
```bash
# Total facts
curl http://localhost:8000/api/v1/admin/facts/count

# Filtered count
curl "http://localhost:8000/api/v1/admin/facts/count?user_id=1&date_from=2025-10-01"
```

**Response:**
```json
{
  "total": 1234
}
```

### API Endpoints

**GET /api/v1/admin/facts**
```bash
# Basic query
curl http://localhost:8000/api/v1/admin/facts

# With filters
curl "http://localhost:8000/api/v1/admin/facts?user_id=1&article_id=5&date_from=2025-10-01&date_to=2025-10-31&limit=100&offset=0"
```

**GET /api/v1/admin/facts/count**
```bash
# Get total count
curl http://localhost:8000/api/v1/admin/facts/count

# Filtered count
curl "http://localhost:8000/api/v1/admin/facts/count?user_id=1"
```

**PUT /api/v1/admin/facts/{fact_id}**
```bash
# Update fact
curl -X PUT http://localhost:8000/api/v1/admin/facts/342 \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 150.00,
    "fact_date": "2025-10-15",
    "description": "Updated description",
    "article_id": 6
  }'
```

**DELETE /api/v1/admin/facts/{fact_id}**
```bash
# Delete single fact
curl -X DELETE http://localhost:8000/api/v1/admin/facts/342
```

**POST /api/v1/admin/facts/batch-delete**
```bash
# Batch delete
curl -X POST http://localhost:8000/api/v1/admin/facts/batch-delete \
  -H "Content-Type: application/json" \
  -d '[342, 341, 340]'
```

---

## System Monitoring

### Overview

Real-time monitoring dashboard displaying system health, resource usage, and database statistics.

**Access:** `/admin/monitoring`

**Auto-Refresh:** Every 5 seconds

### Dashboard Sections

#### 1. System Status Overview

**Displays:**
- Overall health indicator (Healthy/Degraded/Unhealthy)
- Application version
- Uptime (hours and days)
- Current timestamp

**Example:**
```
┌──────────────────────────────────────────────────┐
│ System Status                   ● System Healthy │
├──────────────────────────────────────────────────┤
│ 📦 v4.0.0    ⏱️ 125.5h    🕐 14:23:45           │
│ Version       Uptime        Current Time         │
└──────────────────────────────────────────────────┘
```

#### 2. Component Health

**Monitors:**
- Database connectivity
- Database latency (milliseconds)
- Status messages

**Example:**
```
┌──────────────────────────────────────────────────┐
│ Component Health                  [🔄 Refresh]   │
├──────────────────────────────────────────────────┤
│ ✓ Database                              [UP]     │
│ Database operational. Users: 5, Facts: 342       │
│ Latency: 12.50 ms                                │
└──────────────────────────────────────────────────┘
```

#### 3. System Resources

**Monitors:**
- CPU usage (%)
- Memory usage (%)
- Disk usage (%)
- Platform information

**Color Coding:**
- Green (<70%): Normal
- Orange (70-85%): Elevated
- Red (≥85%): High

**Example:**
```
┌──────────────────────────────────────────────────┐
│ System Resources        Last updated: 14:23:45   │
├──────────────────────────────────────────────────┤
│ 💻 CPU Usage                            15.2%    │
│ ████░░░░░░░░░░░░░░░░░░░░  15.2%                 │
│ Cores: 8                                         │
│                                                  │
│ 💾 Memory Usage                         52.5%    │
│ ████████████░░░░░░░░░░░░  52.5%                 │
│ 8.4 GB / 16.0 GB                                 │
│                                                  │
│ 💿 Disk Usage                           50.1%    │
│ ████████████░░░░░░░░░░░░  50.1%                 │
│ 250.3 GB / 500.0 GB                              │
│                                                  │
│ 🖥️ Platform                        Linux         │
│ Ubuntu 22.04.3 LTS                               │
│ Python 3.11.5                                    │
└──────────────────────────────────────────────────┘
```

#### 4. Database Statistics

**Displays:**
- Total users count
- Total facts count
- Database latency
- Connection status

**Example:**
```
┌──────────────────────────────────────────────────┐
│ Database Statistics                              │
├──────────────────────────────────────────────────┤
│ 👥 5         📊 342      ⚡ 12.5 ms    🟢 UP    │
│ Users        Facts       Latency       Status    │
└──────────────────────────────────────────────────┘
```

### Features

**Auto-Refresh:**
- Updates every 5 seconds automatically
- Pause/resume capability
- Manual refresh button

**Real-Time Updates:**
- Live data from `/health/detailed` endpoint
- Minimal latency
- Efficient API calls

**Visual Indicators:**
- Pulsing status dots
- Color-coded progress bars
- Status badges

### API Endpoints

**GET /health**
```bash
# Basic health check (liveness)
curl http://localhost:8000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-14T14:23:45Z",
  "version": "4.0.0"
}
```

**GET /ready**
```bash
# Readiness probe (for load balancers)
curl http://localhost:8000/ready
```

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": true
  },
  "timestamp": "2025-10-14T14:23:45Z"
}
```

**GET /health/detailed**
```bash
# Comprehensive diagnostics
curl http://localhost:8000/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "version": "4.0.0",
  "uptime_seconds": 451800.5,
  "timestamp": "2025-10-14T14:23:45Z",
  "components": {
    "database": {
      "status": "up",
      "message": "Database operational. Users: 5, Facts: 342",
      "latency_ms": 12.5
    }
  },
  "system": {
    "cpu_percent": 15.2,
    "cpu_count": 8,
    "memory_percent": 52.5,
    "memory_total_gb": 16.0,
    "memory_used_gb": 8.4,
    "disk_percent": 50.1,
    "disk_total_gb": 500.0,
    "disk_used_gb": 250.3,
    "platform": "Linux",
    "platform_version": "Ubuntu 22.04.3 LTS",
    "python_version": "3.11.5"
  }
}
```

**GET /ping**
```bash
# Minimal ping endpoint
curl http://localhost:8000/ping
```

**Response:**
```json
{
  "message": "pong",
  "timestamp": "2025-10-14T14:23:45Z"
}
```

---

## API Reference

### Authentication

All admin API endpoints require:
1. **Authentication:** Valid JWT token in cookie
2. **Authorization:** User must have `is_admin=True`

**HTTP Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Not authenticated (no JWT or invalid JWT)
- `403 Forbidden` - Authenticated but not admin
- `404 Not Found` - Resource not found
- `400 Bad Request` - Invalid request data

### Base URL

```
Production: https://your-domain.com
Development: http://localhost:8000
```

### Endpoints Summary

**Users:**
- `GET /api/v1/admin/users` - List all users
- `GET /api/v1/admin/users/{user_id}` - Get specific user
- `PUT /api/v1/admin/users/{user_id}` - Update user
- `GET /api/v1/admin/users/stats/summary` - User statistics

**Articles:**
- `GET /api/v1/admin/articles` - List all articles
- `POST /api/v1/admin/articles` - Create article
- `PUT /api/v1/admin/articles/{article_id}` - Update article
- `DELETE /api/v1/admin/articles/{article_id}` - Deactivate article

**Facts:**
- `GET /api/v1/admin/facts` - List all facts
- `GET /api/v1/admin/facts/count` - Get facts count
- `PUT /api/v1/admin/facts/{fact_id}` - Update fact
- `DELETE /api/v1/admin/facts/{fact_id}` - Delete fact
- `POST /api/v1/admin/facts/batch-delete` - Batch delete

**Health:**
- `GET /health` - Basic health check
- `GET /ready` - Readiness probe
- `GET /health/detailed` - Comprehensive diagnostics
- `GET /ping` - Minimal ping

### OpenAPI Documentation

Interactive API documentation available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Security

### Admin Access Control

**Permission Model:**
```
User Roles:
├─ Regular User (is_admin=False)
│  ├─ Access own data
│  ├─ View dashboard
│  └─ View analytics
│
└─ Admin User (is_admin=True)
   ├─ All regular user permissions
   ├─ Access all users' data
   ├─ Manage users (grant/revoke admin)
   ├─ Manage global articles
   ├─ Edit/delete any fact
   ├─ View system monitoring
   └─ Access admin endpoints
```

**Enforcement:**
- Admin check in `get_current_admin()` dependency
- Returns 403 Forbidden for non-admin users
- Returns 401 Unauthorized for unauthenticated users

### Authentication Flow

```
1. User authenticates via Telegram OAuth
   ↓
2. JWT token generated and set in httpOnly cookie
   ↓
3. JWT middleware validates token on each request
   ↓
4. User loaded from database
   ↓
5. Admin check: user.is_admin == True
   ↓
6. If True: Access granted
   If False: 403 Forbidden
```

### Best Practices

**1. Principle of Least Privilege**
- Only grant admin to trusted users
- Regularly review admin list
- Remove admin access when no longer needed

**2. Maintain Multiple Admins**
- Always have at least 2 admin users
- System prevents demoting last admin
- Reduces single point of failure

**3. Audit Logging**
- Monitor admin actions (planned for future)
- Track who changed what and when
- Maintain audit trail

**4. Secure Communication**
- Use HTTPS in production
- Protect JWT tokens (httpOnly cookies)
- Set appropriate cookie security flags

**5. IP Restrictions**
- Consider restricting admin panel to internal IPs
- Use VPN for remote admin access
- Implement rate limiting

### Data Protection

**SCD Type 2 Versioning:**
- Users and articles use SCD Type 2
- Historical versions preserved
- Can track changes over time
- Audit trail built-in

**Physical vs. Soft Delete:**
- Facts: Physical delete (permanent)
- Users/Articles: Soft delete (deactivate)
- Be careful with fact deletions!

---

## Troubleshooting

### Common Issues

#### 1. "403 Forbidden" Error

**Problem:** User cannot access admin panel

**Solutions:**
- Verify user has `is_admin=True` in database
- Check JWT token is valid
- Clear cookies and re-login
- Ask existing admin to grant privileges

**Check Admin Status:**
```sql
SELECT id, username, is_admin, is_current
FROM t_d_user
WHERE telegram_id = YOUR_TELEGRAM_ID
  AND is_current = TRUE;
```

#### 2. "Cannot demote last admin"

**Problem:** Trying to revoke admin from last admin user

**Solution:**
- Grant admin to another user first
- Then revoke from original admin
- System requires at least 1 admin

#### 3. "Cannot delete article with children"

**Problem:** Trying to delete parent article

**Solution:**
- Delete child articles first
- Or change child articles' parent
- Bottom-up deletion order

#### 4. Monitoring Dashboard Not Refreshing

**Problem:** Auto-refresh stopped working

**Solutions:**
- Click manual "Refresh" button
- Check browser console for errors
- Verify `/health/detailed` endpoint works
- Check network connectivity

**Test Endpoint:**
```bash
curl http://localhost:8000/health/detailed
```

#### 5. Batch Delete Limit Exceeded

**Problem:** "Cannot delete more than 500 facts at once"

**Solution:**
- Split deletion into batches of 500
- Use multiple API calls
- Consider date range filters

#### 6. SCD Type 2 Confusion

**Problem:** Multiple versions of same user/article

**Explanation:**
- SCD Type 2 creates new version on update
- Old version: `is_current=False`, `valid_to` set
- New version: `is_current=True`, `valid_to=NULL`
- Both versions exist in database

**Query Current Version:**
```sql
SELECT * FROM t_d_user
WHERE telegram_id = 123456789
  AND is_current = TRUE;
```

**Query All Versions:**
```sql
SELECT * FROM t_d_user
WHERE telegram_id = 123456789
ORDER BY valid_from DESC;
```

### Getting Help

**Resources:**
- GitHub Issues: Report bugs and feature requests
- Documentation: This guide
- API Docs: `/docs` endpoint
- Code: Review source code

**Contact:**
- Project maintainer
- System administrator
- Development team

---

## Appendix

### Glossary

**Admin:** User with `is_admin=True` flag, elevated privileges

**Article:** Category for financial transactions (income or expense)

**Fact:** Financial transaction (amount, date, description)

**SCD Type 2:** Slowly Changing Dimension Type 2 - versioning strategy that preserves historical data

**is_current:** Flag indicating current version of record

**Global Article:** Category shared across all users

**Soft Delete:** Marking record as inactive without physical deletion

**Physical Delete:** Permanently removing record from database

### Related Documentation

- `README.md` - Project overview
- `PLAN.md` - Implementation plan
- `TASK-048_COMPLETION.md` - Users CRUD UI
- `TASK-049_COMPLETION.md` - Articles management
- `TASK-050_COMPLETION.md` - Facts management
- `TASK-053_COMPLETION.md` - Health check endpoints
- `TASK-054_COMPLETION.md` - Monitoring dashboard
- `TASK-055_COMPLETION.md` - Integration tests
- `TASK-056_COMPLETION.md` - Admin permissions

---

**Document Version:** 1.0
**Last Updated:** 2025-10-14
**Maintained By:** Claude Code
**Status:** ✅ Complete

---

**For questions or feedback, please contact the project maintainers.**
