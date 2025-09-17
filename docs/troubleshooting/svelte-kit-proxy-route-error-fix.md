# SvelteKit Proxy Route ENOENT Error Fix

## Issue Description
**Error:** `500 Internal Server Error - ENOENT: no such file or directory, stat '/app/.svelte-kit/types/src/routes/proxy+page.ts'`
**Date Resolved:** 2025-09-17
**Version:** v3.6.1

## Root Cause
The error was caused by a corrupted `.svelte-kit` build cache directory containing stale references to a non-existent `/src/routes/proxy+page.ts` file. This corruption persisted across container restarts because:

1. The cache directory was locked by running Node.js processes
2. Multiple `npm run dev` processes were running on different ports (5173, 5174)
3. SvelteKit's type generation created a phantom `proxy+page.ts` file without corresponding source

## Symptoms
- 500 Internal Server Error on homepage
- Application unable to start
- Error message: `ENOENT: no such file or directory, stat '/app/.svelte-kit/types/src/routes/proxy+page.ts'`
- Multiple development servers running simultaneously

## Solution

### Immediate Fix
Execute the following commands in sequence:

```bash
# 1. Kill all duplicate processes
docker exec budget-frontend pkill -f "npm run dev" || true
docker exec budget-frontend pkill -f "vite" || true

# 2. Remove corrupted cache
docker exec budget-frontend rm -rf .svelte-kit/
docker exec budget-frontend rm -rf build/
docker exec budget-frontend rm -rf .vite/
docker exec budget-frontend rm -rf node_modules/.vite/

# 3. Clean npm cache
docker exec budget-frontend npm cache clean --force

# 4. Reinstall dependencies
docker exec budget-frontend npm install

# 5. Regenerate SvelteKit types
docker exec budget-frontend npm run sync

# 6. Start development server
docker exec budget-frontend npm run dev
```

### Alternative Solution (if above doesn't work)
```bash
# Full container restart
docker-compose down
docker-compose up -d
docker exec budget-frontend npm run dev
```

## Prevention

### Best Practices
1. **Always stop existing processes** before starting new ones
2. **Use container restart** instead of running multiple dev servers
3. **Clean cache periodically** when experiencing route-related errors
4. **Monitor for duplicate processes** with `docker exec budget-frontend ps aux | grep npm`

### Automated Prevention
Added test suite (`/frontend-svelte/src/test/proxy-route-cache.test.ts`) that:
- Validates route structure consistency
- Checks for orphaned type files
- Ensures no phantom proxy routes exist
- Verifies clean cache state after sync

## Technical Details

### Why This Happened
1. SvelteKit generates TypeScript type definitions for all routes in `.svelte-kit/types/`
2. A corrupted cache or interrupted build process created a `proxy+page.ts` type file
3. No corresponding source file exists in `/src/routes/proxy+page.svelte`
4. SvelteKit tried to stat the generated type file, causing ENOENT error

### What the Fix Does
1. **Process Cleanup:** Kills locked processes to unlock cache files
2. **Cache Removal:** Completely removes corrupted `.svelte-kit` directory
3. **Fresh Generation:** Rebuilds route types from scratch based on actual source files
4. **Clean Start:** Ensures only valid routes have generated types

## Verification

### Check if Fixed
```bash
# Should return 200 or 302 (redirect to login)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/

# Should not contain proxy route
docker exec budget-frontend ls .svelte-kit/types/src/routes/ | grep proxy || echo "No proxy files"

# Should show clean logs
docker logs --tail 50 budget-frontend | grep -i error
```

### Run Tests
```bash
# Run cache validation tests
docker exec budget-frontend npm run test proxy-route-cache.test.ts
```

## Related Files
- `/requests/analyses.xml` - Root cause analysis
- `/requests/plan.xml` - Fix execution plan
- `/tests/frontend/proxy-route-cache-test.ts` - Prevention tests
- `/frontend-svelte/src/test/proxy-route-cache.test.ts` - Validation tests

## Lessons Learned
1. **SvelteKit cache can become corrupted** when processes are terminated improperly
2. **Multiple dev servers** can cause file locking issues
3. **Force cleaning cache** is sometimes necessary for route-related errors
4. **Proper process management** prevents most cache corruption issues