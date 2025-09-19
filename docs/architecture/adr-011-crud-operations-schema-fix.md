# ADR-011: CRUD Operations Schema Fix for Reference Modules

## Status
Accepted

## Date
2025-09-19

## Context

All settings pages in the Family Budget application were experiencing critical CRUD operation failures:

1. **Period Creation (500 Error)**: Attempting to use non-existent `created_by` and `managed_by` fields
2. **Financial Centers (422 Error)**: Required `user_id` field not sent by frontend
3. **Cost Centers (422 Error)**: Required `user_id` field not sent by frontend
4. **Articles (400 Error)**: ArticleStats instantiation with non-existent fields

These errors completely prevented users from creating new reference data entries, making the application's core functionality unusable.

## Decision

We have decided to:

1. **Remove Non-Existent Fields**: Eliminate references to fields that don't exist in database models
2. **Standardize Schema Pattern**: Make `user_id` optional in all creation schemas
3. **Session-Based User ID**: Always set `user_id` from authenticated session context, never from request payload
4. **Fix Schema Instantiation**: Ensure all Pydantic models are instantiated with correct fields only

## Consequences

### Positive

- ✅ All CRUD operations work correctly
- ✅ Consistent API patterns across all reference modules
- ✅ Simplified frontend - no need to track user_id
- ✅ Better security - user_id always from trusted session
- ✅ Improved error messages and debugging

### Negative

- ⚠️ API contract change (though backward compatible)
- ⚠️ Documentation needs updating

### Neutral

- Frontend doesn't send user_id anymore (was already the case for most modules)
- Backend always derives user_id from session (was already partially implemented)

## Implementation

### Schema Changes

```python
# Before
class FinancialCenterCreate(FinancialCenterBase):
    user_id: int = Field(..., description="User ID")  # Required

# After
class FinancialCenterCreate(FinancialCenterBase):
    user_id: Optional[int] = Field(None, description="User ID (set automatically from session)")
```

### Endpoint Pattern

```python
@router.post("/")
async def create_item(
    item_data: ItemCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("user_id")
    # Always use user_id from session, ignore any from payload
    db_item = Item(..., user_id=user_id)
```

### Fixed Files

1. `/backend-fastapi/app/api/v1/endpoints/periods.py`
2. `/backend-fastapi/app/schemas/*.py` (all reference module schemas)
3. `/backend-fastapi/app/api/v1/endpoints/articles.py`

## Validation

- ✅ All schema tests passing
- ✅ Integration tests created and passing
- ✅ Manual testing completed
- ✅ No security regressions

## References

- Issue Screenshots: `/home/ikeniborn/Pictures/Screenshots/`
- Test Results: `/tests/CRUD_FIXES_TEST_SUMMARY.md`
- Implementation Plan: `/requests/plan.xml`
- Results Report: `/requests/result.md`