# Hotfix: Shopping List Legacy temp_id Support (v11.6.1)

**Date:** 2026-02-13
**Status:** Fixed
**Severity:** Medium (affects 8 legacy shopping lists on production)

## Problem

**Symptom:** Old shopping lists (created before PR #416, 2026-02-13) не отображаются после открытия.

**Root Cause:**
1. Legacy lists have `temp_id = NULL` in database (created before temp_id unification)
2. `getListTempId()` returned `0` for legacy lists (fallback when temp_id not found)
3. `DataLayer.getShoppingListItemsFromAPI()` sent `shopping_list_temp_id=0` to backend
4. Backend query failed to find list with `temp_id=0` → returned empty response
5. Frontend displayed "List not found" or empty list

**Affected Lists:**
- 8 active shopping lists on production without temp_id
- Created between 2026-01-24 and 2026-02-12 (before PR #416)

## Solution

**Approach:** Backward compatible heuristic without database migration.

### Changes

#### 1. `listIdUtils.ts` - Centralized heuristic utilities (NEW)

**File:** `frontend/web/static/js/lists/utils/listIdUtils.ts` (new file)

**Purpose:** Centralized utilities for distinguishing temp_id from server_id.

**Key exports:**
- `LIST_ID_HEURISTIC_THRESHOLD = 10_000` - Configurable threshold constant
- `getListIdType(listId)` - Returns 'temp_id', 'server_id', or 'invalid'
- `isValidListId(listId)` - Validates list ID (positive integer check)
- `getApiParameterName(listId)` - Returns correct API parameter name
- `debugLogListIdHeuristic()` - Conditional debug logging (dev only)

**Rationale:**
- Eliminates magic numbers (10000 → constant)
- Centralized validation and error handling
- Runtime type safety (invalid ID detection)
- Conditional logging (production-safe)

---

#### 2. `stateManager.ts` - Enhanced getListTempId with validation

**File:** `frontend/web/static/js/lists/listsManager/core/stateManager.ts`

**Changes:**
- Added `isValidListId()` validation at entry point
- Added validation for resolved ID before returning
- Enhanced error handling with fallback to serverId
- Removed hardcoded 0 return (security improvement)

**Before:**
```typescript
return dexieList?.temp_id || 0; // Returns 0 for legacy lists
```

**After:**
```typescript
if (!isValidListId(serverId)) {
  throw new Error(`Invalid server ID: ${serverId}`);
}
// ... logic ...
const resolvedId = dexieList?.temp_id || serverId;
if (!isValidListId(resolvedId)) {
  console.error(`Resolved invalid ID: ${resolvedId}`);
  return serverId; // Safe fallback
}
return resolvedId;
```

**Security improvements:**
- Rejects invalid IDs (0, negative, NaN)
- Double validation (input + output)
- Never returns 0 (unsafe value)

---

#### 3. `DataLayer.ts` - Centralized heuristic with error handling

**File:** `frontend/web/static/js/data/DataLayer.ts`

**Changes:**
- Uses `getApiParameterName()` from listIdUtils
- Added `isValidListId()` validation
- Conditional debug logging (dev only, no production pollution)
- Try-catch fallback for heuristic failures

**Before:**
```typescript
params.set('shopping_list_temp_id', listTempId.toString()); // Always uses temp_id
```

**After:**
```typescript
if (!isValidListId(listTempId)) {
  throw new Error(`Invalid list ID: ${listTempId}`);
}

try {
  const paramName = getApiParameterName(listTempId); // Centralized heuristic
  params.set(paramName, listTempId.toString());
  debugLogListIdHeuristic(listTempId, paramName); // Dev only
} catch (error) {
  // Fallback: use temp_id parameter (safer default)
  console.error('Heuristic failed, using temp_id parameter:', error);
  params.set('shopping_list_temp_id', listTempId.toString());
}
```

**Benefits:**
- No hardcoded magic numbers
- Production-safe logging
- Graceful fallback on heuristic failure
- Centralized logic (DRY principle)

---

## Testing

### Unit Tests

**File:** `backend/tests/api/test_shopping_list_items_legacy_fix.py`

**Test Cases:**
1. ✅ `test_legacy_list_without_temp_id` - Load items from legacy list (temp_id = NULL)
2. ✅ `test_new_list_with_temp_id` - Load items from new list (with temp_id)
3. ✅ `test_heuristic_parameter_selection` - Verify heuristic selects correct API parameter
4. ✅ `test_migration_scenario` - Mixed legacy/new lists work simultaneously

### Manual Testing

**Test on dev environment:**

```bash
# 1. Open dev environment
https://fbd.ikeniborn.ru/lists

# 2. Open legacy list (id < 10000, e.g., id=35 "777")
# Expected: List opens, items load correctly

# 3. Check browser console
# Expected: [DATA_LAYER] Using shopping_list_id (legacy): 35

# 4. Check backend logs
docker compose logs backend | grep "LIST_ITEMS.*shopping_list_id=35"
# Expected: [LIST_ITEMS] Using server_id parameter (legacy): shopping_list_id=35

# 5. Open new list (id >= 10000, e.g., id=38 "123312")
# Expected: List opens, items load correctly

# 6. Check browser console
# Expected: [DATA_LAYER] Using shopping_list_temp_id: 3720601214556604
```

---

## Deployment

### Files Changed

**v11.6.1 - Initial hotfix:**
1. `frontend/web/static/js/lists/listsManager/core/stateManager.ts` (+3 lines)
2. `frontend/web/static/js/data/DataLayer.ts` (+13 lines)
3. `backend/tests/api/test_shopping_list_items_legacy_fix.py` (+241 lines, new file)
4. `docs/hotfixes/shopping-list-legacy-temp-id-fix.md` (+219 lines, new file)

**v11.6.2 - Code review improvements:**
5. `frontend/web/static/js/lists/utils/listIdUtils.ts` (+185 lines, new file)
6. `frontend/web/static/js/lists/utils/listIdUtils.test.ts` (+165 lines, new file)
7. `backend/tests/integration/test_legacy_lists_workflow.py` (+295 lines, new file)
8. Updated: stateManager.ts (+15 lines for validation)
9. Updated: DataLayer.ts (+10 lines for centralized heuristic)
10. Updated: docs/hotfixes (updated with v11.6.2 changes)

### Backward Compatibility

✅ **Fully backward compatible**
- New lists (with temp_id) work as before
- Legacy lists (without temp_id) now work correctly
- No database migration required
- No API changes required (backend already supports both parameters)

### Rollout Plan

1. Deploy frontend changes to dev environment
2. Manual testing on 8 legacy lists
3. Monitor browser console and backend logs
4. If successful, deploy to production
5. No rollback needed (backward compatible)

---

## Verification

### Success Criteria

✅ Legacy list (id=35 "777") opens and displays items
✅ Browser console shows: `[DATA_LAYER] Using shopping_list_id (legacy): 35`
✅ Backend logs show: `[LIST_ITEMS] Using server_id parameter (legacy)`
✅ New list (id=38 "123312") opens and displays items
✅ Browser console shows: `[DATA_LAYER] Using shopping_list_temp_id: 3720601214556604`
✅ No errors in browser console or backend logs

### Database Query

```sql
-- Verify legacy lists count
SELECT COUNT(*) as legacy_lists
FROM t_f_shopping_list
WHERE temp_id IS NULL AND is_active = true;
-- Expected: 8

-- List legacy lists
SELECT id, name, temp_id, created_at
FROM t_f_shopping_list
WHERE temp_id IS NULL AND is_active = true
ORDER BY created_at DESC;
```

---

## Future Work

**Optional:** Database migration to assign temp_id to legacy lists.

**Migration SQL:**
```sql
-- Assign temp_id to legacy lists (optional, not required for hotfix)
UPDATE t_f_shopping_list
SET temp_id = floor(random() * 9007199254740991)::bigint
WHERE temp_id IS NULL;
```

**Rationale for NOT migrating now:**
- Hotfix works without migration (backward compatible heuristic)
- Migration is risky (large random numbers, potential collisions)
- 8 legacy lists is small dataset, no performance impact
- Heuristic is simple and reliable (< 10000 check)

**If migration needed later:**
- Test on dev environment first
- Verify no temp_id collisions
- Update frontend to remove heuristic (always use temp_id parameter)
- Deploy after successful testing

---

## Related

- **PR #416:** fix/shopping-list-temp-id-unification
- **Commit:** 62459c25 "fix(shopping-lists): унификация ID для shopping lists на temp_id"
- **Documentation:** docs/architecture/features/shopping-lists.md

---

## Timeline

- **2026-02-13 10:00** - PR #416 merged (temp_id unification)
- **2026-02-13 13:21** - First new list created with temp_id (id=38)
- **2026-02-13 14:30** - Discovery: legacy lists (id < 35) not loading
- **2026-02-13 15:00** - Root cause analysis: getListTempId returns 0
- **2026-02-13 15:30** - Hotfix implemented and tested
- **2026-02-13 16:00** - Ready for deployment

---

**Author:** Claude Code Team
**Reviewers:** ikeniborn
**Approved:** Pending manual testing
