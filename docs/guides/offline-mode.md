# Offline Mode User Guide

**Version:** 2.0 (v8.0+)
**Last Updated:** 2026-01-22

---

## Overview

Family Budget supports full offline functionality with automatic synchronization. Work without internet connection, and all changes will sync when you reconnect.

### Key Features
- ✅ Create, edit, delete transactions offline
- ✅ Manage shopping lists without internet
- ✅ View all data instantly from local database
- ✅ Automatic sync when connection restored
- ✅ Conflict resolution for concurrent edits
- ✅ Real-time updates across devices

---

## Improved Performance (v8.0+)

Starting with version 8.0, Family Budget uses PGlite (client-side PostgreSQL) to dramatically improve performance and reduce server load.

### Performance Benefits

| Feature | Before (API-only) | After (PGlite) | Improvement |
|---------|-------------------|----------------|-------------|
| Dashboard load | 500ms | 250ms | **50% faster** |
| Shopping lists | 300ms | 30ms | **90% faster** |
| Transaction history | 400ms | 50ms | **88% faster** |
| API calls | 100% | 5-20% | **80-95% reduction** |
| Offline support | Limited | Full | **Complete** |

### How It Works

1. **First Load:** Data downloaded from server and saved locally
2. **Subsequent Loads:** Instant from local database (no server request)
3. **Offline Changes:** Queued locally and synced when online
4. **Conflicts:** Automatically resolved or shown in UI
5. **Real-time Updates:** WebSocket keeps all devices in sync

### What Gets Cached Locally

- 📊 **Reference Data** - Budget categories, accounts, cost centers
- 💰 **Transactions** - Income, expenses, transfers
- 🛒 **Shopping Lists** - Lists and items
- 📅 **Recurring Plans** - Scheduled payments

**Note:** All data is encrypted and stored securely in your browser.

---

## Getting Started

### Enable Offline Mode

Offline mode is **enabled by default** in v8.0+. No configuration needed!

**To check status:**
1. Click the **PGlite icon** (🔍) in navigation bar
2. Look for "Status: ✓ Active" in diagnostic modal
3. Check "DB Size" and "Last Sync" timestamp

**To disable (not recommended):**
1. Open browser Developer Tools (F12)
2. Console tab
3. Run: `localStorage.setItem('PGLITE_ENABLED', 'false')`
4. Reload page

---

## Working Offline

### Supported Operations

#### ✅ Shopping Lists
- Create new shopping list
- Add items to list
- Mark items as completed
- Edit item details (quantity, notes)
- Delete items or entire lists

#### ✅ Transactions (Facts)
- Record income/expenses
- Edit transaction details
- Delete transactions
- View transaction history

#### ✅ Recurring Plans (View Only)
- View scheduled payments
- Check plan details

**Note:** Creating/editing recurring plans requires internet connection.

#### ✅ Viewing Data
- All reference data (categories, accounts)
- Transaction history
- Account balances
- Shopping lists
- Dashboard statistics

---

## How Sync Works

### Automatic Synchronization

1. **Create/Edit/Delete Offline:**
   - Changes saved to local pending queue
   - UI updates immediately (optimistic update)
   - Sync icon (🔄) appears in navigation

2. **Reconnect to Internet:**
   - Pending changes auto-sync to server
   - Server validates and saves changes
   - Local database updated with server response
   - Sync icon disappears when complete

3. **Conflict Resolution:**
   - If someone else edited the same item:
     - **Smart Merge** - Combines changes when possible
     - **Last Write Wins** - Newer timestamp wins
     - **Manual Resolution** - UI modal for complex conflicts

### Sync Indicators

| Icon | Meaning |
|------|---------|
| ✅ | Synced successfully |
| 🔄 | Sync in progress |
| ⚠️ | Sync warning (check details) |
| ❌ | Sync failed (will retry) |

---

## Conflict Resolution

### When Conflicts Occur

Conflicts happen when two users edit the same item while offline:

**Example:**
- User A marks "Milk" as completed offline
- User B changes quantity to "2L" offline
- Both reconnect → conflict detected

### Resolution Strategies

#### 1. **Smart Merge** (Shopping Lists)
- **is_completed:** OR logic (completed if either user marked it)
- **quantity:** MAX value (higher quantity wins)
- **position:** Server position preserved
- **Other fields:** Server wins

**Result:** "Milk" marked as completed with quantity "2L"

#### 2. **Last Write Wins** (Transactions)
- Compare `updated_at` timestamps
- Newer version overwrites older
- Conflict logged in diagnostic modal

#### 3. **Manual Resolution** (Rare)
- UI modal shows both versions
- User chooses which to keep
- Selected version saved to server

### Viewing Conflict History

1. Open **PGlite Diagnostic Modal** (🔍 icon)
2. Scroll to **"Conflict Resolution"** section
3. Check:
   - Conflict rate (target: <1%)
   - Total conflicts resolved
   - Server wins vs Client wins
   - Pending conflicts

---

## Performance Monitoring

### Check Performance Stats

1. Click **PGlite icon** (🔍) in navigation bar
2. Open **"API Calls Reduction"** section
3. View:
   - **Reduction %** - Should be 80-95% (green badge)
   - **API Calls Saved** - Total requests avoided
   - **Bandwidth Saved** - KB saved
   - **Speedup Factor** - How much faster PGlite is

### Module Breakdown

See performance by feature:
- **Shopping Lists** - 90%+ reduction
- **Facts** - 85%+ reduction
- **Recurring Plans** - 80%+ reduction
- **Dashboard** - 95%+ reduction

**Note:** First page load will show 0% reduction (initial sync required).

---

## Troubleshooting

### Problem: "PGlite not initialized"

**Cause:** Browser doesn't support required features (IndexedDB/OPFS).

**Solution:**
1. Update browser to latest version:
   - Chrome 120+
   - Edge 120+
   - Firefox 115+
   - Safari 16+
2. Disable browser extensions that block storage
3. Check "Allow sites to save data" in browser settings
4. Exit Private/Incognito mode

---

### Problem: Slow Performance

**Cause:** Large database (>100MB) on slower browser (Firefox/Safari).

**Solution:**
1. Open **PGlite Diagnostic Modal**
2. Check **"Data Cleanup Metrics"**
3. Click **"Clear Old Data"** to remove transactions older than 6 months
4. Or use **"Clear Database"** and re-sync from server

**Note:** Chrome/Edge use OPFS (faster), Firefox/Safari use IndexedDB (slower).

---

### Problem: Sync Stuck

**Symptoms:** Sync icon (🔄) spinning indefinitely.

**Solution:**
1. Check internet connection
2. Refresh page (F5)
3. If still stuck:
   - Open browser console (F12)
   - Look for error messages
   - Contact support with error details

---

### Problem: Conflicts Not Resolving

**Cause:** Server rejected changes (validation error).

**Solution:**
1. Open **PGlite Diagnostic Modal**
2. Check **"Conflict Resolution" → Pending Conflicts**
3. Click **"View Details"** for each conflict
4. Resolve manually or discard client changes

---

### Problem: Data Out of Sync

**Symptoms:** Different data on phone vs desktop.

**Solution:**
1. Open **PGlite Diagnostic Modal** on both devices
2. Check **"Last Sync"** timestamp
3. On device with older timestamp:
   - Refresh page
   - Wait for sync to complete
   - Verify timestamps match

---

## Data Management

### Clear Local Database

**When to clear:**
- Database corrupted
- Want fresh start
- Switching user accounts

**How to clear:**
1. Open **PGlite Diagnostic Modal** (🔍 icon)
2. Scroll to bottom
3. Click **"Clear Database"** button
4. Confirm action
5. Page will reload and re-sync from server

**⚠️ Warning:** Pending changes will be lost! Ensure all changes synced before clearing.

---

### Data Cleanup (Pruning)

**Automatic Cleanup:**
- Transactions older than configured retention period (default: 90 days)
- Runs weekly on Chrome/Edge 120+ (manual on Firefox/Safari)
- Configurable retention: 30-365 days

**Manual Cleanup:**
1. Open **PGlite Diagnostic Modal**
2. Check **"Data Cleanup Metrics"**
3. Click **"Clean Old Data"**
4. Select retention period
5. Confirm deletion

**Note:** Server data is never deleted (only local cache).

---

## Browser Compatibility

| Browser | Backend | Offline Support | Performance |
|---------|---------|-----------------|-------------|
| Chrome 120+ | OPFS | ✅ Full | ⚡ Fastest |
| Edge 120+ | OPFS | ✅ Full | ⚡ Fastest |
| Firefox 115+ | IndexedDB | ✅ Full | ⚙️ Good |
| Safari 16+ | IndexedDB | ✅ Full | ⚙️ Good |
| iOS Safari | IndexedDB | ✅ Full | ⚙️ Good |
| Chrome Mobile | OPFS | ✅ Full | ⚡ Fast |

**Best Performance:** Chrome or Edge 120+ (uses OPFS)
**Good Performance:** Firefox, Safari (uses IndexedDB)

---

## Privacy & Security

### Data Storage

- **Location:** Browser's private storage (OPFS or IndexedDB)
- **Encryption:** Data encrypted at rest
- **Access:** Only your browser can access data
- **Persistence:** Survives browser restart
- **Sync:** Only syncs to YOUR Family Budget account

### Data Safety

- ✅ Server is source of truth
- ✅ Local database is cache only
- ✅ Clearing local data doesn't affect server
- ✅ Re-sync always possible
- ✅ No data shared with third parties

---

## FAQ

### Q: Does offline mode use more battery?

**A:** No. PGlite uses less battery than making network requests.

---

### Q: How much storage does PGlite use?

**A:** Typically 5-50 MB depending on your data:
- Small budget (100 transactions): ~5 MB
- Medium budget (1000 transactions): ~20 MB
- Large budget (10000+ transactions): ~50 MB

Check **PGlite Diagnostic Modal → DB Size** for exact size.

---

### Q: Can I use offline mode on multiple devices?

**A:** Yes! Each device has its own local database. Changes sync via server.

---

### Q: What happens if I edit same item on 2 devices offline?

**A:** Conflict resolution kicks in:
1. Both devices queue changes locally
2. First device to reconnect syncs to server
3. Second device detects conflict
4. Smart merge or manual resolution
5. Final state synced to all devices

---

### Q: Is offline mode required?

**A:** No. You can disable it in browser console:
```javascript
localStorage.setItem('PGLITE_ENABLED', 'false');
location.reload();
```

All features work without offline mode (slower, requires internet).

---

### Q: Does offline mode work in Private/Incognito mode?

**A:** No. Private mode doesn't allow persistent storage (Safari, Firefox).
Chrome/Edge may work but data is cleared when closing window.

---

## Support

**Questions?** Contact support at support@familybudget.example.com

**Bug reports:** Include:
1. Browser + version
2. Error message (if any)
3. Steps to reproduce
4. Screenshot of PGlite Diagnostic Modal

---

**Enjoy fast, reliable offline budgeting! 🚀**
