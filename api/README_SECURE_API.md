# Secure Budget API

## Overview

This is the secure version of the Budget API with the following improvements:
- **SQL Injection Prevention**: All queries use parameterized statements
- **User Context Validation**: All endpoints require and validate user context
- **Connection Pooling**: Better performance with database connection pooling
- **Proper Error Handling**: Meaningful error messages without exposing sensitive data

## Key Security Features

### 1. Parameterized Queries
All SQL queries now use parameterized statements ($1, $2, etc.) instead of string interpolation:

```python
# SECURE (new)
await db.fetchone("SELECT * FROM t_d_user WHERE user_id = $1", user_id)

# VULNERABLE (old)
await connection.select(f"SELECT * FROM t_d_user WHERE user_id = '{user_id}'")
```

### 2. User Authentication
All endpoints (except /health) require X-User-Id header:

```bash
# Will fail with 401
curl http://localhost:8888/users

# Will succeed
curl -H "X-User-Id: 1" http://localhost:8888/users
```

### 3. User Data Isolation
Users can only access their own data:

```bash
# User 1 trying to access user 2's data will get 403 Forbidden
curl -H "X-User-Id: 1" http://localhost:8888/users/2
```

## Testing

### Running Security Tests

```bash
# Start the API with secure mode
export SECURE_API=true
docker-compose -f docker-compose.dev.yaml up -d

# Run security tests
cd api
python test_security.py
```

### Manual Testing

```bash
# Test SQL injection (should fail)
curl -H "X-User-Id: 1" "http://localhost:8888/users/1' OR '1'='1"

# Test missing auth (should return 401)
curl http://localhost:8888/users

# Test health check (should work without auth)
curl http://localhost:8888/health
```

## Migration from Legacy API

### 1. Environment Variable
Set `SECURE_API=true` in your environment:

```bash
# .env file
SECURE_API=true
```

### 2. Update Frontend API
The Frontend API must pass user ID in headers:

```javascript
headers: {
  'X-User-Id': req.session.userId,
  'Content-Type': 'application/json'
}
```

### 3. Test Thoroughly
- Run security tests
- Check all endpoints work correctly
- Verify user isolation

## API Changes

### Request Headers
All requests must include:
```
X-User-Id: <user_id_from_session>
```

### Response Status Codes
- `200` - Success
- `401` - Missing or invalid user ID
- `403` - Forbidden (accessing another user's data)
- `404` - Resource not found
- `422` - Validation error
- `500` - Server error

### Error Response Format
```json
{
  "detail": "Error message"
}
```

## Performance Improvements

1. **Connection Pooling**: 10-20 persistent connections
2. **Prepared Statements**: Faster query execution
3. **Async/Await**: Non-blocking I/O operations
4. **Health Checks**: Built-in health monitoring

## Rollback Instructions

If you need to rollback to the legacy API:

1. Set `SECURE_API=false` in environment
2. Restart the services
3. Note: This will disable all security features!

## Future Improvements

1. Add rate limiting
2. Implement API key authentication
3. Add request/response logging
4. Add metrics collection
5. Implement caching layer