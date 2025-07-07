# Migration Guide: Secure Budget API

## Overview

This guide explains how to migrate from the vulnerable budget_api.py to the secure budget_api_secure.py.

## Key Changes

### 1. SQL Injection Prevention
- All SQL queries now use parameterized queries ($1, $2, etc.)
- No string interpolation in SQL queries
- Safe handling of user input

### 2. User Context Validation
- All endpoints require X-User-Id header
- User can only access their own data
- Proper HTTP status codes (401, 403, 404)

### 3. Connection Pooling
- Database connections are pooled for better performance
- Automatic connection management
- Proper cleanup on shutdown

### 4. Improved Error Handling
- Proper exception handling
- Meaningful error messages
- Logging for debugging

## Migration Steps

### Step 1: Update Frontend API

Update `frontend-api/src/routes/api.ts` to pass user ID in headers:

```typescript
// Add to all API calls
const headers = {
  'X-User-Id': req.session.userId,
  'Content-Type': 'application/json'
};

const response = await fetch(`${BACKEND_API_URL}/users`, {
  headers
});
```

### Step 2: Update Docker Configuration

Update `api/Dockerfile` to use the new secure API:

```dockerfile
# Change the CMD line
CMD ["uvicorn", "budget_api_secure:app", "--host", "0.0.0.0", "--port", "8888"]
```

### Step 3: Test in Development

1. Update docker-compose.dev.yaml:
```yaml
budget-api:
  command: "uvicorn budget_api_secure:app --host 0.0.0.0 --port 8888 --reload"
```

2. Test all endpoints:
```bash
# Start development environment
./scripts/dev.sh -d

# Test API
curl -H "X-User-Id: 1" http://localhost:8888/users
```

### Step 4: Deploy to Production

1. Build new image:
```bash
docker-compose --env-file web.env build budget-api
```

2. Deploy with zero downtime:
```bash
# Start new container
docker-compose --env-file web.env up -d --no-deps budget-api

# Verify health
curl http://localhost:8888/health

# Remove old container
docker rm -f budget-api-old
```

## Testing Checklist

- [ ] All endpoints return data only for authenticated user
- [ ] SQL injection attempts are blocked
- [ ] Invalid user IDs return 403 Forbidden
- [ ] Missing resources return 404 Not Found
- [ ] Health check endpoint works
- [ ] Connection pooling improves performance

## Rollback Plan

If issues occur:

1. Update Dockerfile to use old API:
```dockerfile
CMD ["uvicorn", "budget_api:app", "--host", "0.0.0.0", "--port", "8888"]
```

2. Rebuild and restart:
```bash
docker-compose --env-file web.env up -d --build budget-api
```

## Performance Improvements

The new API includes:
- Connection pooling (10-20 connections)
- Prepared statements (faster query execution)
- Proper indexing hints in queries
- Reduced memory usage

## Security Improvements

1. **SQL Injection**: All queries are parameterized
2. **Access Control**: User-based data isolation
3. **Input Validation**: Pydantic models validate input
4. **Error Messages**: No sensitive data in errors
5. **Logging**: Audit trail for all operations