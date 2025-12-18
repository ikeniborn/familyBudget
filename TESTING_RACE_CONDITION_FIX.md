# Testing: Shopping Lists Race Condition Fix

## Commit
- **Branch:** test
- **Commit:** 80352c50
- **Title:** fix(lists): eliminate race condition in item creation

## Changes Made
- Modified `frontend/web/static/js/lists/listsManager.js` (handleSaveItem function)
- Removed post-response array push for online CREATE operations
- Added offline mode detection: `result.tempId && !result.id`
- SSE handler now exclusively manages UI updates for online creates

## Manual Testing Commands

### 1. Deploy to Test Server

```bash
# From repository
cd ~/familyBudget

# Push to remote
git push origin test

# SSH to test server
ssh budget-test

# Pull and deploy
cd ~/familyBudget
git pull origin test
sudo bash deploy.sh --sync-mode update --cleanup-mode smart --profile full

# Monitor deployment
sudo bash logs.sh
```

### 2. Verify Deployment

```bash
# Check container status
cd /opt/budget
docker compose ps

# Check backend logs for errors
docker compose logs --tail=50 backend | grep -i error

# Check if listsManager.js was synced
ls -lh /opt/budget/frontend/web/static/js/lists/listsManager.js

# Verify file modification time (should be recent)
stat /opt/budget/frontend/web/static/js/lists/listsManager.js
```

### 3. Browser Testing

#### Test Case 1: Online CREATE (Main Fix)
**Purpose:** Verify no duplicate when creating item online

1. Open: https://budget-test.ikeniborn.ru/lists
2. Click on any shopping list
3. Click "📝 Добавить товар" (Add item button)
4. Fill form:
   - Product: "Test Product"
   - Store: Select any
   - Group: Select any
   - Quantity: 1
5. Click "Save"
6. **Expected:** Item appears ONCE in the list
7. **Check:** Count items with same name in table/cards
8. Repeat 3-4 times rapidly (test multiple creates)
9. **Expected:** Each item appears exactly once

#### Test Case 2: Delete Item
**Purpose:** Verify deleting one item doesn't remove duplicates (there shouldn't be any)

1. From Test Case 1, create 2 items with different names
2. Click delete (🗑️) on the first item
3. **Expected:** Only first item disappears, second remains
4. Refresh page
5. **Expected:** Only second item exists

#### Test Case 3: Offline CREATE
**Purpose:** Verify offline mode still works (immediate display)

1. Open DevTools → Network tab
2. Set to "Offline" mode
3. Click "📝 Добавить товар"
4. Fill form with different product name
5. Click "Save"
6. **Expected:** Item appears immediately with offline indicator
7. Go back online (disable offline mode)
8. Wait for sync
9. **Expected:** Offline item syncs, tempId replaced with server ID

#### Test Case 4: Edit Item (No Regression)
**Purpose:** Verify EDIT still works

1. Click edit (✏️) on any item
2. Change product name
3. Click "Save"
4. **Expected:** Item updates correctly, no duplicate created

#### Test Case 5: Multi-Tab Sync
**Purpose:** Verify SSE broadcasts work

1. Open two browser tabs: Tab A and Tab B
2. Both tabs: open same shopping list
3. Tab A: Create new item
4. **Expected:** Item appears in Tab A immediately (via SSE)
5. **Expected:** Item appears in Tab B within 1 second (via SSE)
6. **Expected:** Both tabs show exactly 1 copy of the item

#### Test Case 6: Mobile View
**Purpose:** Verify fix works on mobile

1. Open Chrome DevTools → Device Toolbar (mobile emulation)
2. Resize to mobile width (e.g., iPhone 12)
3. Repeat Test Case 1
4. **Expected:** Item appears once in mobile card view

### 4. Debug Logging

If issues occur, enable debug logging:

```javascript
// In browser console
localStorage.setItem('DEBUG', 'true');
location.reload();

// Create item and watch console
// Look for:
// - "[ListsManager] Added item from SSE: {id}"
// - "[ListsManager] Item already exists, updating instead: {id}" (should NOT appear for new creates)
```

### 5. Monitoring After Deploy

```bash
# Watch for race condition logs (should not appear anymore)
docker compose logs -f backend | grep -i "shopping.*item"

# Watch SSE events
docker compose logs -f backend | grep -i "broadcast_item_created"

# Check for errors
docker compose logs backend | grep -i "error" | tail -20
```

## Success Criteria

- [ ] ✅ Creating one item shows exactly one copy in UI (desktop)
- [ ] ✅ Creating one item shows exactly one copy in UI (mobile)
- [ ] ✅ Deleting one item removes only that item
- [ ] ✅ Offline mode creates show immediately with tempId
- [ ] ✅ Offline sync replaces tempId with server ID
- [ ] ✅ Edit operations still work (no regression)
- [ ] ✅ Multi-tab sync works (both tabs see same item count)
- [ ] ✅ Rapid creates (5x) produce 5 items, not 10
- [ ] ✅ No JavaScript errors in browser console
- [ ] ✅ No backend errors in logs

## Rollback Plan

If issues occur:

```bash
# On test server
cd ~/familyBudget
git revert 80352c50
git push origin test

# Redeploy
sudo bash deploy.sh --sync-mode update --profile full
```

## Known Trade-offs

1. **Slight latency increase:** Items now appear when SSE arrives (~10-100ms delay)
   - Previous behavior: instant (but created duplicates)
   - New behavior: small delay (but guaranteed correctness)

2. **Dependency on SSE:** If SSE connection drops, items won't appear until page refresh
   - Mitigation: SSE has auto-reconnect with exponential backoff
   - Users can manually refresh if needed

## Validation Checklist

After manual testing:

- [ ] Ran all 6 test cases above
- [ ] Checked browser console (no errors)
- [ ] Checked backend logs (no errors)
- [ ] Verified SSE events are being broadcast
- [ ] Confirmed no duplicates in any scenario
- [ ] Tested on both desktop and mobile views
- [ ] Verified offline mode still functions

## Next Steps

1. Complete manual testing on budget-test
2. If all tests pass → deploy to production
3. Monitor production logs for 48 hours
4. If issues → rollback and investigate
5. If stable → mark as resolved
