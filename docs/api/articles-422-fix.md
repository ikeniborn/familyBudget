# Articles 422 Error Fix Documentation

**Version:** 3.7.1
**Date:** 2025-09-17
**Issue:** 422 Unprocessable Entity error when creating articles

## Problem Description

Users were unable to create articles on the `/settings/articles` page, receiving a 422 (Unprocessable Entity) HTTP error.

## Root Cause Analysis

The error occurred due to a mismatch between frontend and backend expectations:

1. **Frontend Issue**: The frontend was sending `user_id: null` in the article creation payload
2. **Backend Schema**: The `ArticleCreate` schema required `user_id` as a mandatory field
3. **Backend Logic**: The backend actually retrieves `user_id` from the session, not from the request payload

## Solution Implementation

### 1. Backend Schema Update

Modified `backend-fastapi/app/schemas/article.py`:

```python
# Before
class ArticleCreate(ArticleBase):
    """Article creation schema."""
    user_id: int = Field(..., description="User ID")

# After
class ArticleCreate(ArticleBase):
    """Article creation schema."""
    user_id: Optional[int] = Field(None, description="User ID")
    managed_by: Optional[int] = Field(None, description="Manager user ID")
```

### 2. Frontend Payload Cleanup

Removed `user_id` from the frontend article creation payload in `frontend-svelte/src/routes/(protected)/settings/articles/+page.svelte`:

```typescript
// Before
const response = await articlesService.create({
  code: formData.code,
  name: formData.name,
  description: formData.description || undefined,
  is_active: formData.is_active,
  user_id: formData.user_id  // <-- Removed
});

// After
const response = await articlesService.create({
  code: formData.code,
  name: formData.name,
  description: formData.description || undefined,
  is_active: formData.is_active
});
```

### 3. Backend Endpoint Behavior

The backend endpoint (`app/api/v1/endpoints/articles.py`) already correctly:
- Extracts `user_id` from the current session
- Sets `user_id` automatically when creating articles
- Ensures data isolation by user

## Testing

Created comprehensive test suites:
- `tests/frontend/article-creation-fix.test.ts` - Tests article creation without user_id
- Verified payload structure
- Confirmed successful article creation
- Tested error handling

## Security Considerations

- User isolation is maintained - backend always uses session user_id
- No risk of cross-user data contamination
- Schema validation still enforces required fields (code, name)

## Migration Notes

No database migration required - this is a schema/API contract fix only.

## Verification Steps

1. Navigate to `/settings/articles`
2. Click "Создать статью" (Create Article)
3. Fill in the form:
   - Code: Any unique code (e.g., "TEST")
   - Name: Any name
   - Description: Optional
   - Active status: Check/uncheck as needed
4. Click "Создать" (Create)
5. Article should be created successfully without 422 error

## Related Files

- `backend-fastapi/app/schemas/article.py`
- `backend-fastapi/app/api/v1/endpoints/articles.py`
- `frontend-svelte/src/routes/(protected)/settings/articles/+page.svelte`
- `frontend-svelte/src/lib/services/articles.service.ts`