# Articles Reference Module Documentation

## Overview
The Articles reference module provides comprehensive management of article categories used for nomenclature grouping in the Family Budget application. Articles can be either shared (system-wide) or user-specific.

## API Endpoints

### Base URL
```
/api/articles/
```

### Authentication
All endpoints require authentication via session cookie (`connect.sid`).

### Endpoints

#### 1. GET /api/articles/
Get all articles (shared and user-specific).

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Maximum records to return (default: 100)
- `is_active` (bool, optional): Filter by active status

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "HOUSEHOLD",
      "name": "Домашние расходы",
      "description": "Товары для дома и быта",
      "is_active": true,
      "user_id": null,
      "created_by": null,
      "managed_by": null,
      "created_at": "2025-09-15T20:57:30.847859+00:00",
      "updated_at": null,
      "is_shared": true,
      "is_editable": true
    }
  ],
  "total": 10
}
```

#### 2. GET /api/articles/stats
Get article statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 10,
    "active": 10,
    "inactive": 0,
    "shared": 10,
    "user_specific": 0
  }
}
```

#### 3. GET /api/articles/{article_id}
Get specific article by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "HOUSEHOLD",
    "name": "Домашние расходы",
    "is_shared": true,
    "is_editable": true,
    // ... other fields
  }
}
```

#### 4. POST /api/articles/
Create new article.

**Request Body:**
```json
{
  "code": "NEWCODE",
  "name": "New Article",
  "description": "Optional description",
  "is_active": true,
  "user_id": null  // null for shared article (admin only)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 11,
    "code": "NEWCODE",
    "name": "New Article",
    // ... created article data
  }
}
```

#### 5. PUT /api/articles/{article_id}
Update existing article.

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "is_active": false
}
```

#### 6. DELETE /api/articles/{article_id}
Delete an article.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Article deleted successfully"
  }
}
```

#### 7. POST /api/articles/bulk-delete
Delete multiple articles.

**Request Body:**
```json
{
  "article_ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Successfully deleted 3 articles",
    "deleted_count": 3
  }
}
```

## Frontend Component

### Location
`frontend-svelte/src/routes/(protected)/settings/articles/+page.svelte`

### Features
- **CRUD Operations**: Full create, read, update, delete functionality
- **Statistics Display**: Real-time statistics cards showing article counts
- **Filtering**: Filter by active/inactive and shared/personal
- **Search**: Real-time search across article fields
- **Permission-based UI**: Shows edit/delete buttons based on user permissions
- **Modal Forms**: Clean modal interfaces for create/edit operations
- **Bulk Operations**: Support for bulk delete (admin only)

### Service
The frontend service (`articles.service.ts`) provides a clean API interface:

```typescript
articlesService.getAll(skip?, limit?, isActive?)
articlesService.getById(id)
articlesService.getStats()
articlesService.create(articleData)
articlesService.update(id, articleData)
articlesService.delete(id)
articlesService.bulkDelete(ids)
```

## Permissions

### Admin Users
- Can create, edit, and delete shared articles (user_id = null)
- Can create, edit, and delete their own articles
- Can perform bulk operations

### Regular Users
- Can view shared articles but cannot edit/delete them
- Can create, edit, and delete their own articles
- Cannot create shared articles
- Cannot perform bulk operations on shared articles

## Database Schema

### Table: `t_d_article`
| Column | Type | Description |
|--------|------|-------------|
| article_id | INTEGER | Primary key |
| article_code | VARCHAR | Unique article code |
| article_name | VARCHAR | Article name |
| description | TEXT | Optional description |
| is_active | BOOLEAN | Active status |
| user_id | INTEGER | NULL for shared, user ID for personal |
| created_by | INTEGER | User who created the article |
| managed_by | INTEGER | User who last managed the article |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

## Authentication Requirements

### Login Credentials
For testing, use the following credentials:
- **Username**: admin
- **Password**: admin
- **Role**: Administrator (full access)

### Session Management
The application uses session cookies (`connect.sid`) for authentication. After logging in at `/login`, the session is maintained across all API calls.

## Testing

### Running Tests
```bash
# Backend API tests
docker exec budget-backend python -m pytest tests/backend/test_articles_api.py -v

# Frontend component tests
docker exec budget-frontend npm run test articles.test.ts

# Integration tests
docker exec budget-backend python -m pytest tests/integration/test_articles_integration.py -v
```

### Test Coverage
- **Backend**: 31 tests covering all endpoints and edge cases
- **Frontend**: 30 tests covering UI components and interactions
- **Integration**: 8 tests covering end-to-end workflows
- **Total**: 69 tests with 1,910 lines of test code

## Common Issues and Solutions

### Issue: Cannot edit/create articles
**Solution**: Ensure you are logged in with proper credentials. The admin password has been set to 'admin'.

### Issue: 401 Unauthorized errors
**Solution**: Clear browser cookies and login again at http://localhost:5173/login

### Issue: Articles not showing
**Solution**: Check that the backend service is running and database migrations are applied.

## Version History

### v3.5.0 (2025-09-16)
- Initial implementation of articles reference module
- Full CRUD operations with permission-based access control
- Comprehensive test coverage (69 tests, 1,910 lines)
- Fixed authentication issues for admin users
- Added support for shared and user-specific articles
- Implemented bulk operations for administrators