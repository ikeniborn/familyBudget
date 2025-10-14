# Family Budget API Documentation

**Version:** 4.4.0
**Base URL:** `http://localhost:8000` (development) | `https://your-domain.com` (production)
**API Prefix:** `/api/v1`

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Quick Start](#quick-start)
- [API Endpoints](#api-endpoints)
  - [Health & Monitoring](#health--monitoring)
  - [Authentication](#authentication-endpoints)
  - [Users](#users)
  - [Articles (Budget Categories)](#articles-budget-categories)
  - [Facts (Transactions)](#facts-transactions)
  - [Analytics & Reporting](#analytics--reporting)
  - [Admin Endpoints](#admin-endpoints)
- [Request/Response Format](#requestresponse-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Webhooks](#webhooks)

---

## Overview

The Family Budget API is a RESTful API for managing personal finances with support for:

- **Hierarchical budget categories** (Articles with parent-child relationships)
- **Transaction tracking** (Facts with date, amount, description)
- **Multi-dimensional analysis** (Financial centers, cost centers)
- **Advanced analytics** (Trends, breakdowns, waterfall charts, heatmaps)
- **Telegram bot integration** (Telegram authentication and webhooks)
- **SCD Type 2 versioning** (Historical tracking of changes)

### Key Features

- ✅ JWT-based authentication
- ✅ User isolation (multi-tenant)
- ✅ Admin and regular user roles
- ✅ Global and user-specific categories
- ✅ Real-time analytics
- ✅ Comprehensive error handling
- ✅ OpenAPI/Swagger documentation

---

## Authentication

### Method: JWT (JSON Web Tokens)

The API uses JWT tokens stored in HTTP-only cookies for authentication.

#### Authentication Flow

1. **Telegram Authentication**: Users authenticate via Telegram bot
2. **JWT Token Generation**: Server generates JWT token
3. **Cookie Storage**: Token stored in `access_token` cookie
4. **Request Authentication**: Token automatically sent with each request

#### Token Details

- **Cookie Name:** `access_token`
- **Token Type:** JWT
- **Expiration:** 7 days (default, configurable)
- **Algorithm:** HS256

#### Authentication Headers

No manual authentication headers required - cookies are used automatically.

```http
Cookie: access_token=eyJhbGciOiJIUzI1NiIs...
```

---

## Quick Start

### 1. Authenticate

```bash
# Authenticate via Telegram (returns JWT cookie)
curl -X POST https://api.example.com/api/v1/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123456789,
    "first_name": "John",
    "username": "johndoe",
    "auth_date": 1634567890,
    "hash": "telegram_hash_here"
  }'
```

### 2. Create a Budget Category

```bash
curl -X POST https://api.example.com/api/v1/articles \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "code": "FOOD",
    "name": "Food & Dining",
    "type": "expense",
    "parent_id": null
  }'
```

### 3. Add a Transaction

```bash
curl -X POST https://api.example.com/api/v1/facts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "article_id": 1,
    "fact_date": "2025-10-14",
    "amount": 50.75,
    "description": "Grocery shopping"
  }'
```

### 4. View Analytics

```bash
curl https://api.example.com/api/v1/analytics/quick-stats \
  -b cookies.txt
```

---

## API Endpoints

### Health & Monitoring

#### GET /health
**Description:** Basic health check
**Authentication:** Not required
**Response:** `200 OK`

```json
{
  "status": "healthy",
  "timestamp": "2025-10-14T12:00:00Z",
  "version": "4.4.0"
}
```

#### GET /health/detailed
**Description:** Detailed health check with system metrics
**Authentication:** Not required
**Response:** `200 OK`

```json
{
  "status": "healthy",
  "timestamp": "2025-10-14T12:00:00Z",
  "version": "4.4.0",
  "uptime_seconds": 3600.5,
  "components": {
    "database": {
      "status": "up",
      "message": "Database operational. Users: 10, Facts: 1234",
      "latency_ms": 15.3
    }
  },
  "system": {
    "platform": "Linux",
    "python_version": "3.11.0",
    "cpu_percent": 25.5,
    "memory_percent": 45.2
  }
}
```

#### GET /ready
**Description:** Readiness check for load balancers
**Authentication:** Not required
**Response:** `200 OK` (ready) | `503 Service Unavailable` (not ready)

#### GET /ping
**Description:** Simple ping endpoint
**Authentication:** Not required
**Response:** `200 OK`

```json
{
  "message": "pong",
  "timestamp": "2025-10-14T12:00:00Z"
}
```

---

### Authentication Endpoints

#### POST /api/v1/auth/telegram
**Description:** Authenticate user via Telegram
**Authentication:** Not required
**Request Body:**

```json
{
  "id": 123456789,
  "first_name": "John",
  "last_name": "Doe",
  "username": "johndoe",
  "photo_url": "https://...",
  "auth_date": 1634567890,
  "hash": "telegram_hash"
}
```

**Response:** `200 OK`

```json
{
  "user": {
    "id": 1,
    "telegram_id": 123456789,
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "is_admin": false
  },
  "message": "Authentication successful"
}
```

**Sets Cookie:** `access_token` (JWT)

#### POST /api/v1/auth/logout
**Description:** Logout user (clear JWT cookie)
**Authentication:** Required
**Response:** `200 OK`

```json
{
  "message": "Logged out successfully"
}
```

---

### Users

#### GET /api/v1/users/me
**Description:** Get current user profile
**Authentication:** Required
**Response:** `200 OK`

```json
{
  "id": 1,
  "telegram_id": 123456789,
  "username": "johndoe",
  "first_name": "John",
  "last_name": "Doe",
  "is_admin": false,
  "is_current": true,
  "valid_from": "2025-10-14T12:00:00Z",
  "valid_to": "9999-12-31T23:59:59Z"
}
```

#### PUT /api/v1/users/me
**Description:** Update current user profile
**Authentication:** Required
**Request Body:**

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "username": "johndoe_updated"
}
```

**Response:** `200 OK` (returns updated user)

---

### Articles (Budget Categories)

Articles represent budget categories (income/expense). They support hierarchical structure (parent-child) and SCD Type 2 versioning.

#### GET /api/v1/articles
**Description:** List all articles for current user
**Authentication:** Required
**Query Parameters:**
- `type` (optional): Filter by type (`income` or `expense`)
- `is_current` (optional): Filter by current version (default: `true`)

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "user_id": 1,
    "parent_id": null,
    "code": "FOOD",
    "name": "Food & Dining",
    "type": "expense",
    "is_global": false,
    "is_current": true,
    "valid_from": "2025-10-14T12:00:00Z",
    "valid_to": "9999-12-31T23:59:59Z"
  }
]
```

#### POST /api/v1/articles
**Description:** Create new article
**Authentication:** Required
**Request Body:**

```json
{
  "code": "FOOD",
  "name": "Food & Dining",
  "type": "expense",
  "parent_id": null
}
```

**Response:** `201 Created`

#### GET /api/v1/articles/{id}
**Description:** Get article by ID
**Authentication:** Required
**Response:** `200 OK`

#### PUT /api/v1/articles/{id}
**Description:** Update article (creates new version with SCD Type 2)
**Authentication:** Required
**Request Body:** Same as POST

**Response:** `200 OK`

**Note:** Updates create a new version. Old version's `valid_to` is set to now, new version's `valid_from` is now.

#### DELETE /api/v1/articles/{id}
**Description:** Soft delete article (sets `is_current` to false)
**Authentication:** Required
**Response:** `204 No Content`

#### GET /api/v1/articles/{id}/hierarchy
**Description:** Get article with children (tree structure)
**Authentication:** Required
**Response:** `200 OK`

```json
{
  "id": 1,
  "code": "FOOD",
  "name": "Food & Dining",
  "type": "expense",
  "children": [
    {
      "id": 2,
      "code": "GROCERIES",
      "name": "Groceries",
      "type": "expense",
      "children": []
    }
  ]
}
```

---

### Facts (Transactions)

Facts represent actual income/expense transactions.

#### GET /api/v1/facts
**Description:** List all facts for current user
**Authentication:** Required
**Query Parameters:**
- `article_id` (optional): Filter by article
- `start_date` (optional): Filter by date range (YYYY-MM-DD)
- `end_date` (optional): Filter by date range (YYYY-MM-DD)
- `limit` (optional): Limit results (default: 100)
- `offset` (optional): Offset for pagination

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "user_id": 1,
    "article_id": 1,
    "fact_date": "2025-10-14",
    "amount": 50.75,
    "description": "Grocery shopping",
    "created_at": "2025-10-14T12:00:00Z",
    "updated_at": "2025-10-14T12:00:00Z"
  }
]
```

#### POST /api/v1/facts
**Description:** Create new fact
**Authentication:** Required
**Request Body:**

```json
{
  "article_id": 1,
  "fact_date": "2025-10-14",
  "amount": 50.75,
  "description": "Grocery shopping",
  "financial_center_id": null,
  "cost_center_id": null
}
```

**Response:** `201 Created`

#### GET /api/v1/facts/{id}
**Description:** Get fact by ID
**Authentication:** Required
**Response:** `200 OK`

#### PUT /api/v1/facts/{id}
**Description:** Update fact
**Authentication:** Required
**Request Body:** Same as POST

**Response:** `200 OK`

#### DELETE /api/v1/facts/{id}
**Description:** Delete fact
**Authentication:** Required
**Response:** `204 No Content`

---

### Analytics & Reporting

#### GET /api/v1/analytics/quick-stats
**Description:** Get quick statistics for dashboard
**Authentication:** Required
**Response:** `200 OK`

```json
{
  "today": {
    "income": 0.0,
    "expense": 120.50,
    "balance": -120.50
  },
  "month": {
    "income": 5000.0,
    "expense": 2345.75,
    "balance": 2654.25
  }
}
```

#### GET /api/v1/analytics/trends
**Description:** Get spending trends over time
**Authentication:** Required
**Query Parameters:**
- `days` (optional): Number of days (default: 30, max: 365)

**Response:** `200 OK`

```json
{
  "dates": ["2025-10-01", "2025-10-02", ...],
  "income": [0, 5000, 0, ...],
  "expense": [50.75, 120.00, 85.50, ...],
  "period_days": 30
}
```

#### GET /api/v1/analytics/plan-fact
**Description:** Get plan vs fact comparison
**Authentication:** Required
**Query Parameters:**
- `period` (optional): Time period (`week`, `month`, `year`, default: `month`)

**Response:** `200 OK`

```json
{
  "labels": ["1", "2", "3", ...],
  "plan": [110.0, 121.0, 132.0, ...],
  "fact": [100.0, 110.0, 120.0, ...],
  "period": "month"
}
```

#### GET /api/v1/analytics/category-breakdown
**Description:** Get category breakdown for pie chart
**Authentication:** Required
**Query Parameters:**
- `type` (required): Transaction type (`income` or `expense`)
- `period` (optional): Time period (`week`, `month`, `year`, `all`, default: `month`)

**Response:** `200 OK`

```json
{
  "categories": ["Food", "Transport", "Housing"],
  "amounts": [450.50, 200.00, 1200.00],
  "percentages": [24.3, 10.8, 64.9],
  "total": 1850.50,
  "type": "expense",
  "period": "month"
}
```

#### GET /api/v1/analytics/waterfall
**Description:** Get cumulative flow data for waterfall chart
**Authentication:** Required
**Response:** `200 OK`

```json
{
  "labels": ["Jan", "Feb", "Mar", ...],
  "income": [5000, 5000, 5200, ...],
  "expense": [2500, 2800, 2600, ...],
  "balance": [2500, 4700, 7300, ...],
  "year": 2025
}
```

#### GET /api/v1/analytics/heatmap
**Description:** Get spending patterns for heatmap
**Authentication:** Required
**Response:** `200 OK`

```json
{
  "weeks": [
    [10.5, 20.0, 15.5, 30.0, 25.0, 50.0, 40.0],
    [...]
  ],
  "day_labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "week_count": 12,
  "period_days": 90
}
```

---

### Admin Endpoints

**Note:** All admin endpoints require `is_admin=true` in user profile.

#### GET /api/v1/admin/users
**Description:** List all users (admin only)
**Authentication:** Required (Admin)
**Query Parameters:**
- `search` (optional): Search by username
- `limit` (optional): Limit results
- `offset` (optional): Offset for pagination

**Response:** `200 OK`

```json
{
  "users": [
    {
      "id": 1,
      "telegram_id": 123456789,
      "username": "johndoe",
      "is_admin": false,
      "created_at": "2025-10-14T12:00:00Z"
    }
  ],
  "total": 10,
  "limit": 100,
  "offset": 0
}
```

#### GET /api/v1/admin/users/{id}
**Description:** Get user by ID (admin only)
**Authentication:** Required (Admin)
**Response:** `200 OK`

#### GET /api/v1/admin/users/{id}/stats
**Description:** Get user statistics (admin only)
**Authentication:** Required (Admin)
**Response:** `200 OK`

```json
{
  "user_id": 1,
  "articles_count": 15,
  "facts_count": 234,
  "total_income": 25000.00,
  "total_expense": 18500.50,
  "balance": 6499.50,
  "first_fact_date": "2025-01-01",
  "last_fact_date": "2025-10-14"
}
```

#### GET /api/v1/admin/stats
**Description:** Get system statistics (admin only)
**Authentication:** Required (Admin)
**Response:** `200 OK`

```json
{
  "users": {
    "total_users": 100,
    "active_users": 85,
    "admin_users": 5
  },
  "articles": {
    "total_articles": 500,
    "global_articles": 50
  },
  "facts": {
    "total_facts": 15000,
    "facts_today": 120,
    "facts_this_month": 3500
  }
}
```

#### GET /api/v1/admin/activity
**Description:** Get recent activity (admin only)
**Authentication:** Required (Admin)
**Query Parameters:**
- `days` (optional): Number of days (default: 7)

**Response:** `200 OK`

```json
{
  "period_days": 7,
  "daily_stats": [
    {
      "date": "2025-10-14",
      "new_users": 5,
      "new_facts": 450,
      "active_users": 85
    }
  ]
}
```

#### GET /api/v1/admin/users/top
**Description:** Get top users by activity (admin only)
**Authentication:** Required (Admin)
**Query Parameters:**
- `limit` (optional): Limit results (default: 10)
- `by` (optional): Metric (`facts_count`, `income`, `expense`, default: `facts_count`)

**Response:** `200 OK`

```json
{
  "users": [
    {
      "id": 1,
      "username": "johndoe",
      "metric_value": 1234
    }
  ],
  "metric": "facts_count",
  "limit": 10
}
```

#### POST /api/v1/admin/articles/global
**Description:** Create global article (admin only)
**Authentication:** Required (Admin)
**Request Body:** Same as regular article creation

**Response:** `201 Created`

#### GET /api/v1/admin/articles/global
**Description:** List all global articles (admin only)
**Authentication:** Required (Admin)
**Response:** `200 OK`

#### PUT /api/v1/admin/articles/global/{id}
**Description:** Update global article (admin only)
**Authentication:** Required (Admin)
**Response:** `200 OK`

#### DELETE /api/v1/admin/articles/global/{id}
**Description:** Delete global article (admin only)
**Authentication:** Required (Admin)
**Response:** `204 No Content`

---

## Request/Response Format

### Request Format

```http
POST /api/v1/facts HTTP/1.1
Host: api.example.com
Content-Type: application/json
Cookie: access_token=eyJhbGciOiJI...

{
  "article_id": 1,
  "fact_date": "2025-10-14",
  "amount": 50.75,
  "description": "Grocery shopping"
}
```

### Response Format

**Success Response:**

```json
{
  "id": 1,
  "article_id": 1,
  "fact_date": "2025-10-14",
  "amount": 50.75,
  "description": "Grocery shopping",
  "created_at": "2025-10-14T12:00:00Z"
}
```

**Error Response:**

```json
{
  "detail": {
    "message": "Article not found",
    "status_code": 404,
    "error_code": "NOT_FOUND",
    "details": {
      "article_id": 999
    }
  }
}
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `204 No Content` - Request successful (no response body)
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Constraint violation (duplicate, etc.)
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service temporarily unavailable

### Error Response Structure

```json
{
  "detail": {
    "message": "Human-readable error message",
    "status_code": 404,
    "error_code": "NOT_FOUND",
    "details": {
      "additional": "context"
    }
  }
}
```

### Common Error Codes

- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Request validation failed
- `AUTHENTICATION_REQUIRED` - Authentication required
- `PERMISSION_DENIED` - Insufficient permissions
- `DATABASE_ERROR` - Database operation failed
- `INTERNAL_ERROR` - Unexpected server error

---

## Rate Limiting

**Status:** Not implemented (planned for future versions)

Rate limiting will be implemented in future versions to prevent abuse:
- Regular users: 100 requests/minute
- Admin users: 1000 requests/minute

---

## Webhooks

### Telegram Bot Webhook

**Endpoint:** `/api/v1/webhooks/telegram`
**Method:** `POST`
**Authentication:** Telegram signature verification

Receives updates from Telegram Bot API.

---

## Interactive API Documentation

### Swagger UI

Access interactive API documentation at:

**URL:** `http://localhost:8000/docs`

Features:
- ✅ Try out API endpoints directly from browser
- ✅ View request/response schemas
- ✅ Authentication support
- ✅ Real-time testing

### ReDoc

Alternative documentation interface:

**URL:** `http://localhost:8000/redoc`

Features:
- ✅ Clean, readable interface
- ✅ Searchable documentation
- ✅ Code samples in multiple languages

---

## SDK & Client Libraries

**Status:** Official SDKs planned for:
- Python
- JavaScript/TypeScript
- Go

Community SDKs welcome!

---

## Support & Contact

- **Issues:** [GitHub Issues](https://github.com/your-org/familybudget/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/familybudget/discussions)
- **Email:** support@example.com

---

## Changelog

### Version 4.4.0 (2025-10-14)
- ✅ Added waterfall and heatmap analytics
- ✅ Improved error handling
- ✅ Added correlation ID tracing
- ✅ Enhanced admin endpoints

### Version 4.0.0 (2025-10-13)
- ✅ Complete database schema redesign
- ✅ SCD Type 2 versioning for articles and users
- ✅ Multi-dimensional fact table
- ✅ Hierarchical article structure
- ✅ Comprehensive analytics endpoints

---

**Last Updated:** 2025-10-14
**API Version:** 4.4.0
**Documentation Version:** 1.0
