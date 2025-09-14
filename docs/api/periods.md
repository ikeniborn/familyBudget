# API Documentation: Periods Management

## Overview

The Periods API provides endpoints for managing budget periods with automatic period code generation, timezone handling, and comprehensive CRUD operations. All operations support both user-specific and shared periods (admin-only).

## Base URL

```
Development: http://localhost:4000/api/periods
Production: https://your-domain.com/api/periods
```

## Authentication

All endpoints require session-based authentication via `connect.sid` cookie. Admin operations require additional role verification.

## Period Code Auto-Generation ✅ **NEW (v3.1.6)**

### Overview
Starting with v3.1.6, period codes are automatically generated using a sequential pattern when not explicitly provided. This eliminates constraint violation errors and ensures consistent code assignment.

### Generation Pattern
- **Format**: `2020XX` where XX is a sequential number (01, 02, 03, etc.)
- **Sequence**: Continues from the highest existing code, even with gaps
- **User Isolation**: Each user maintains independent code sequences
- **Shared Periods**: Use global sequence managed by admins

### Examples
```json
// First period created by user
{
  "code": "202001",
  "date": "2025-01-01T00:00:00Z",
  "ru_name": "2025 Янв"
}

// Second period created by same user
{
  "code": "202002",
  "date": "2025-02-01T00:00:00Z",
  "ru_name": "2025 Фев"
}

// If 202002 was deleted, next period gets:
{
  "code": "202003",
  "date": "2025-03-01T00:00:00Z",
  "ru_name": "2025 Мар"
}
```

## Endpoints

### GET /api/periods/

Get all periods (both shared and user-specific).

**Query Parameters:**
- `skip` (int, optional): Offset for pagination (default: 0)
- `limit` (int, optional): Number of records to return (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "202001",
      "date": "2025-01-01T00:00:00Z",
      "ru_name": "2025 Янв",
      "start_date": "2025-01-01T00:00:00Z",
      "end_date": "2025-01-31T23:59:59Z",
      "user_id": 1,
      "created_by": 1,
      "managed_by": 1,
      "created_at": "2025-09-14T12:00:00Z",
      "updated_at": "2025-09-14T12:00:00Z",
      "is_shared": false,
      "is_editable": true,
      "period_id": 1,
      "period_name": "2025 Янв",
      "period_year": 2025,
      "period_month": 1,
      "is_active": true
    }
  ],
  "total": 1
}
```

### GET /api/periods/current

Get current period based on today's date.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "202001",
    "date": "2025-01-01T00:00:00Z",
    "ru_name": "2025 Янв",
    // ... same structure as above
  }
}
```

### GET /api/periods/{period_id}

Get specific period by ID.

**Parameters:**
- `period_id` (int): Period identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "202001",
    // ... same structure as GET /api/periods/
  }
}
```

### POST /api/periods/

Create new period with automatic code generation.

**Request Body:**
```json
{
  "period_year": 2025,
  "period_month": 1,
  "period_name": "2025 Янв",
  "start_date": "2025-01-01T00:00:00",
  "end_date": "2025-01-31T23:59:59",
  "is_active": true
}
```

**Alternative Modern Format:**
```json
{
  "date": "2025-01-01T00:00:00Z",
  "ru_name": "2025 Янв",
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-01-31T23:59:59Z"
}
```

**Admin-Only Shared Period Creation:**
```json
{
  "date": "2025-01-01T00:00:00Z",
  "ru_name": "2025 Янв Shared",
  "user_id": null
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "code": "202002",
    "date": "2025-01-01T00:00:00Z",
    "ru_name": "2025 Янв",
    "start_date": "2025-01-01T00:00:00Z",
    "end_date": "2025-01-31T23:59:59Z",
    "user_id": 1,
    "created_by": 1,
    "managed_by": 1,
    "created_at": "2025-09-14T12:05:00Z",
    "updated_at": "2025-09-14T12:05:00Z",
    "is_shared": false,
    "is_editable": true,
    "period_id": 2,
    "period_name": "2025 Янв",
    "period_year": 2025,
    "period_month": 1,
    "is_active": true
  }
}
```

### PUT /api/periods/{period_id}

Update existing period.

**Parameters:**
- `period_id` (int): Period identifier

**Request Body (partial update supported):**
```json
{
  "ru_name": "2025 Январь (Updated)",
  "end_date": "2025-01-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Updated period data
  }
}
```

### DELETE /api/periods/{period_id}

Delete period (with dependency checking).

**Parameters:**
- `period_id` (int): Period identifier

**Success Response:**
```json
{
  "success": true,
  "data": {
    "message": "Period deleted successfully"
  }
}
```

## Error Handling

### Constraint Violation (409 Conflict)
```json
{
  "success": false,
  "error": "Period for date 2025-01-01 already exists (user-specific)"
}
```

### Missing Required Fields (422 Unprocessable Entity)
```json
{
  "success": false,
  "error": "Missing required fields: date and ru_name, or period_year and period_month"
}
```

### Period with Dependencies (409 Conflict)
```json
{
  "success": false,
  "error": "Невозможно удалить период '2025 Янв'. Существует 5 записей бюджета, связанных с этим периодом. Сначала удалите все связанные записи или перенесите их в другой период."
}
```

### Access Denied (403 Forbidden)
```json
{
  "success": false,
  "error": "Admin access required to create shared periods"
}
```

### Not Found (404 Not Found)
```json
{
  "success": false,
  "error": "Period not found or access denied"
}
```

### Invalid DateTime Format (422 Unprocessable Entity)
```json
{
  "success": false,
  "error": "Invalid datetime format: can't subtract offset-naive and offset-aware datetimes"
}
```

## Business Rules

### Period Code Generation
1. **Auto-generation**: Period codes are automatically generated if not provided
2. **Sequential pattern**: Follows `2020XX` format with sequential numbering
3. **Gap handling**: Continues from maximum existing code, ignoring gaps
4. **User isolation**: Each user has independent code sequences
5. **Uniqueness**: Period codes are globally unique across all periods

### Date Validation
1. **Duplicate prevention**: Cannot create periods with same date in same scope
2. **Timezone handling**: All datetimes converted to UTC for database storage
3. **Format support**: Accepts both ISO 8601 and legacy formats

### Permission Model
1. **User periods**: Users can CRUD their own periods
2. **Shared periods**: Only admins can create/edit/delete shared periods
3. **Admin privileges**: Admins can manage all periods (shared and user-specific)
4. **View access**: Users see both their periods and shared periods

### Data Isolation
1. **Scope separation**: User periods isolated by `user_id`
2. **Shared visibility**: Shared periods (`user_id=NULL`) visible to all users
3. **Admin access**: Admins can access all periods regardless of `user_id`

## Field Mappings

### Modern vs Legacy Fields
The API supports both modern and legacy field formats for backward compatibility:

| Modern Field | Legacy Field | Description |
|--------------|--------------|-------------|
| `date` | `period_year`, `period_month` | Period date |
| `ru_name` | `period_name` | Period name |
| `id` | `period_id` | Period identifier |
| `code` | N/A | Auto-generated period code |

### Response Fields Explanation
- `is_shared`: Boolean indicating if period is shared (`user_id=NULL`)
- `is_editable`: Boolean indicating if current user can edit this period
- `created_by`: User ID who created the period
- `managed_by`: User ID responsible for managing the period
- `code`: Auto-generated sequential period code

## Examples

### Create First Period for New User
```bash
curl -X POST http://localhost:4000/api/periods/ \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=session-id" \
  -d '{
    "period_year": 2025,
    "period_month": 1,
    "period_name": "2025 Январь",
    "start_date": "2025-01-01T00:00:00",
    "end_date": "2025-01-31T23:59:59"
  }'

# Response: period with code "202001" (first in sequence)
```

### Create Subsequent Period
```bash
curl -X POST http://localhost:4000/api/periods/ \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=session-id" \
  -d '{
    "period_year": 2025,
    "period_month": 2,
    "period_name": "2025 Февраль",
    "start_date": "2025-02-01T00:00:00",
    "end_date": "2025-02-28T23:59:59"
  }'

# Response: period with code "202002" (next in sequence)
```

### Admin Create Shared Period
```bash
curl -X POST http://localhost:4000/api/periods/ \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=admin-session-id" \
  -d '{
    "date": "2025-03-01T00:00:00Z",
    "ru_name": "2025 Март (Общий)",
    "user_id": null
  }'

# Response: shared period with auto-generated code
```

### Handle Duplicate Error
```bash
# Try to create period with existing date
curl -X POST http://localhost:4000/api/periods/ \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=session-id" \
  -d '{
    "period_year": 2025,
    "period_month": 1,
    "period_name": "2025 Январь Дубликат",
    "start_date": "2025-01-01T00:00:00",
    "end_date": "2025-01-31T23:59:59"
  }'

# Response: 409 Conflict with descriptive error message
```

## Testing

### Constraint Validation Testing
```bash
# Test auto-generation sequence
docker exec budget-backend python -m pytest tests/test_periods_constraint.py::TestPeriodCodeAutoGeneration -v

# Test constraint violations
docker exec budget-backend python -m pytest tests/test_periods_constraint.py::TestPeriodConstraintValidation -v

# Test user isolation
docker exec budget-backend python -m pytest tests/test_periods_constraint.py::TestPeriodUserIsolation -v
```

### API Integration Testing
```bash
# Test full CRUD cycle
docker exec budget-backend python -m pytest tests/backend/test_periods_api.py -v

# Test period creation flow
docker exec budget-backend python -m pytest tests/test_periods_constraint.py::TestPeriodCodeAutoGeneration::test_period_code_sequential_generation -v
```

## Performance Considerations

### Auto-generation Performance
- **Query overhead**: ~2-5ms per creation for sequence number lookup
- **Optimization**: Consider caching max sequence numbers for high-frequency usage
- **Scalability**: Current pattern supports up to 99 periods per sequence

### Database Indexes
- `period_code`: Unique index for fast lookups
- `date, user_id`: Composite index for duplicate checking
- `user_id`: Index for user isolation queries

## Version History

### v3.1.6 (2025-09-14)
- ✅ **Added**: Automatic period code generation
- ✅ **Fixed**: Constraint violation errors during period creation
- ✅ **Added**: Comprehensive test coverage (558 lines)
- ✅ **Added**: Gap handling in sequence generation
- ✅ **Added**: User isolation for period codes

### v3.1.5 (2025-09-14)
- ✅ **Fixed**: Period deletion with dependency checking
- ✅ **Fixed**: SQLAlchemy detached session errors

### v3.1.2 (2025-09-14)
- ✅ **Added**: Auto-generated period names
- ✅ **Added**: Smart date calculations
- ✅ **Fixed**: Period creation API serialization

### v3.2.0 (2025-09-13)
- ✅ **Added**: Unified API response format
- ✅ **Added**: Enhanced error handling
- ✅ **Added**: Legacy field compatibility

## Related Documentation
- [ADR-006: Period Code Auto-Generation](../architecture/adr-006-period-code-generation.md)
- [ADR-005: Timezone Handling](../architecture/adr-005-timezone-handling.md)
- [API Error Handling Guide](error-handling.md)
- [Test Coverage Report](../testing/test-coverage.md)

---

*Last Updated: 2025-09-14*
*Version: v3.1.6*
*Contact: [Development Team](mailto:dev@familybudget.com)*