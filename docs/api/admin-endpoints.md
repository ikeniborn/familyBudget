# Admin API Endpoints Documentation

**Last Updated:** 2025-09-08  
**Version:** 1.0.0  
**Security Level:** Admin Only (User ID 1)

## Overview

This document describes the administrative API endpoints that require admin access privileges. All endpoints in this section are protected by the `require_admin_access` dependency and will return `403 Forbidden` for non-admin users.

## Authentication

All admin endpoints require:
1. **Valid session:** User must be authenticated
2. **Admin privileges:** `user.id === 1`
3. **Session cookie:** `connect.sid` cookie present

### Error Responses

```json
// Not authenticated
{
  "detail": "Not authenticated",
  "status_code": 401
}

// Not admin user
{
  "detail": "Admin access required", 
  "status_code": 403
}
```

## User Management Endpoints

### GET /api/users/
**Description:** Retrieve all users in the system (admin only)

**Request:**
```http
GET /api/users/ HTTP/1.1
Cookie: connect.sid=s%3A...
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "telegram_id": 123456789,
      "username": "admin_user",
      "first_name": "Admin",
      "last_name": "User",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": 2, 
      "telegram_id": 987654321,
      "username": "regular_user",
      "first_name": "Regular",
      "last_name": "User",
      "created_at": "2024-01-02T00:00:00Z",
      "updated_at": "2024-01-02T00:00:00Z"
    }
  ],
  "total": 2
}
```

**Security Notes:**
- Exposes all user data including Telegram IDs
- Should only be used for administrative purposes
- Consider pagination for large user bases

### GET /api/users/{user_id}
**Description:** Get detailed information about a specific user

**Parameters:**
- `user_id` (path): Integer ID of the user

**Request:**
```http
GET /api/users/2 HTTP/1.1
Cookie: connect.sid=s%3A...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "telegram_id": 987654321,
    "username": "regular_user", 
    "first_name": "Regular",
    "last_name": "User",
    "created_at": "2024-01-02T00:00:00Z",
    "updated_at": "2024-01-02T00:00:00Z",
    "stats": {
      "total_periods": 5,
      "total_transactions": 150,
      "last_activity": "2024-09-07T14:30:00Z"
    }
  }
}
```

**Error Responses:**
```json
// User not found
{
  "success": false,
  "error": "User not found",
  "status_code": 404
}
```

### DELETE /api/users/{user_id}
**Description:** Delete a user and all associated data

**Parameters:**
- `user_id` (path): Integer ID of the user to delete

**Request:**
```http
DELETE /api/users/2 HTTP/1.1
Cookie: connect.sid=s%3A...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "User deleted successfully",
    "deleted_user_id": 2,
    "deleted_records": {
      "periods": 5,
      "transactions": 150,
      "nomenclatures": 25,
      "cost_centers": 3,
      "financial_centers": 2
    }
  }
}
```

**Security Considerations:**
- **IRREVERSIBLE:** This operation permanently deletes all user data
- **Data Isolation:** Only deletes data belonging to the specified user
- **Admin Protection:** Cannot delete admin user (ID 1)
- **Cascade Delete:** Removes all related records automatically

**Error Responses:**
```json
// Cannot delete admin user
{
  "success": false,
  "error": "Cannot delete admin user",
  "status_code": 400
}

// User not found
{
  "success": false, 
  "error": "User not found",
  "status_code": 404
}
```

## System Settings Endpoints

### GET /api/admin/system-info
**Description:** Get system information and statistics

**Request:**
```http
GET /api/admin/system-info HTTP/1.1
Cookie: connect.sid=s%3A...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "system": {
      "version": "1.0.0",
      "environment": "production",
      "uptime": "7d 14h 32m",
      "database_version": "PostgreSQL 13.11"
    },
    "statistics": {
      "total_users": 25,
      "active_users_30d": 18,
      "total_transactions": 15420,
      "total_periods": 125,
      "database_size": "2.4GB"
    },
    "health": {
      "database": "healthy",
      "redis": "healthy", 
      "disk_usage": "65%",
      "memory_usage": "42%"
    }
  }
}
```

### POST /api/admin/maintenance-mode
**Description:** Enable/disable maintenance mode

**Request Body:**
```json
{
  "enabled": true,
  "message": "System maintenance in progress. Expected completion: 15:00 UTC"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "maintenance_mode": true,
    "message": "System maintenance in progress. Expected completion: 15:00 UTC",
    "enabled_by": 1,
    "enabled_at": "2024-09-08T14:30:00Z"
  }
}
```

## Data Management Endpoints

### POST /api/admin/backup
**Description:** Create a system backup

**Request Body:**
```json
{
  "backup_type": "full",
  "include_user_data": true,
  "compression": "gzip"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "backup_id": "backup_20240908_143000",
    "file_path": "/backups/backup_20240908_143000.sql.gz",
    "size": "1.2GB",
    "created_at": "2024-09-08T14:30:00Z",
    "checksum": "sha256:abc123..."
  }
}
```

### POST /api/admin/restore
**Description:** Restore from a backup

**Request Body:**
```json
{
  "backup_id": "backup_20240908_143000",
  "verify_checksum": true,
  "restore_user_data": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "restore_id": "restore_20240908_150000",
    "status": "completed",
    "restored_records": {
      "users": 25,
      "transactions": 15420,
      "periods": 125
    },
    "duration": "4m 32s"
  }
}
```

## Bulk Operations

### POST /api/admin/bulk-user-export
**Description:** Export user data in bulk

**Request Body:**
```json
{
  "user_ids": [2, 3, 5, 7],
  "format": "json",
  "include_transactions": true,
  "date_range": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "export_id": "export_20240908_143000",
    "file_path": "/exports/users_export_20240908_143000.json.gz",
    "size": "15.2MB",
    "user_count": 4,
    "record_count": 2840
  }
}
```

### POST /api/admin/bulk-user-import
**Description:** Import user data in bulk

**Request:** Multipart form data with file upload

**Response:**
```json
{
  "success": true,
  "data": {
    "import_id": "import_20240908_143000",
    "status": "completed",
    "imported_users": 4,
    "imported_records": 2840,
    "errors": [],
    "warnings": [
      "User ID 3 already exists, skipped"
    ]
  }
}
```

## Rate Limiting

Admin endpoints have relaxed rate limits but are still protected:

- **Standard endpoints:** 100 requests/minute
- **Bulk operations:** 10 requests/minute  
- **System operations:** 5 requests/minute

## Monitoring and Logging

All admin endpoint access is logged with:
- User ID and session information
- IP address and user agent
- Request timestamp and duration
- Response status and data size

**Log Format:**
```json
{
  "timestamp": "2024-09-08T14:30:00Z",
  "level": "INFO",
  "event": "admin_endpoint_access",
  "user_id": 1,
  "endpoint": "/api/users/",
  "method": "GET", 
  "ip_address": "192.168.1.100",
  "response_code": 200,
  "duration_ms": 45
}
```

## Security Best Practices

1. **Regular Audit:** Review admin access logs monthly
2. **Session Management:** Admin sessions expire after 4 hours of inactivity
3. **IP Restrictions:** Consider restricting admin access to specific IPs
4. **Two-Factor Auth:** Implement for admin user in future versions
5. **Backup Security:** Encrypt all backup files
6. **Access Monitoring:** Alert on suspicious admin activity

## Testing

All admin endpoints have comprehensive test coverage:

```bash
# Run admin API tests
docker exec budget-backend python -m pytest tests/test_admin_api.py -v

# Run security tests
docker exec budget-backend python -m pytest tests/security/ -v

# Run integration tests
docker exec budget-backend python -m pytest tests/integration/test_admin_workflows.py -v
```

## Changelog

**v1.0.0 (2024-09-08)**
- Initial admin API implementation
- User management endpoints
- System information endpoints
- Bulk operations support
- Comprehensive security model