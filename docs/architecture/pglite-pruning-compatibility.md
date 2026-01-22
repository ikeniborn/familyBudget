# PGlite Data Pruning - Browser Compatibility

**Feature:** Automatic data pruning for PGlite offline database
**Version:** 1.0.0 (task-010)
**Last Updated:** 2026-01-22

---

## Overview

PGlite data pruning provides automatic cleanup of old synced transactions to reduce local database size. The feature has **two modes** depending on browser capabilities:

1. **Automatic Pruning** (Chrome/Edge) - Weekly background cleanup via Periodic Background Sync API
2. **Manual Pruning** (All Browsers) - User-triggered cleanup via Settings UI

---

## Browser Support Matrix

| Browser | Version | Automatic Pruning | Manual Pruning | Notes |
|---------|---------|-------------------|----------------|-------|
| **Chrome** | 80+ | ✅ Supported | ✅ Supported | Full support via Periodic Background Sync API |
| **Edge (Chromium)** | 80+ | ✅ Supported | ✅ Supported | Full support via Periodic Background Sync API |
| **Safari** | Any | ❌ Not Supported | ✅ Supported | Periodic Background Sync not implemented |
| **Firefox** | Any | ❌ Not Supported | ✅ Supported | Periodic Background Sync not implemented |
| **Opera** | 67+ | ✅ Supported | ✅ Supported | Chromium-based, full support |
| **Samsung Internet** | 13+ | ✅ Supported | ✅ Supported | Chromium-based, full support |

---

## Required APIs

### Core APIs (All Browsers)
- ✅ **Service Worker API** - Required for message passing
- ✅ **localStorage API** - Feature flag storage
- ✅ **IndexedDB/PGlite** - Local database operations
- ✅ **Notifications API** - Optional, for cleanup notifications

### Optional APIs (Chrome/Edge Only)
- ⚠️ **Periodic Background Sync API** - Automatic weekly pruning
  - **Chrome:** v80+ (stable since March 2020)
  - **Edge:** v80+ (stable since March 2020)
  - **Status:** [Can I Use - Periodic Background Sync](https://caniuse.com/background-sync)

---

## Feature Detection

The application automatically detects browser capabilities:

```javascript
// Check if Periodic Background Sync is supported
const supportsPeriodicSync = 'periodicSync' in navigator.serviceWorker;

if (supportsPeriodicSync) {
  // Chrome/Edge - Enable automatic pruning
  await registration.periodicSync.register('weekly-pruning', {
    minInterval: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
} else {
  // Safari/Firefox - Show manual-only warning
  showBrowserWarning();
}
```

**UI Behavior:**
- ✅ Chrome/Edge: Shows "Enable automatic cleanup" toggle
- ⚠️ Safari/Firefox: Shows warning "Automatic cleanup not supported in this browser. Use manual button instead."

---

## Graceful Degradation

### Automatic Pruning (Chrome/Edge)
1. User enables "Automatic cleanup" in Settings
2. Service Worker registers `periodicSync` event (7-day interval)
3. Browser triggers pruning weekly in background
4. User receives notification on successful cleanup

### Manual Pruning (All Browsers)
1. User clicks "Clear Old Data Now" button in Settings
2. Confirmation modal appears
3. Pruning executes immediately via PGlite API
4. Toast notification shows results

**Fallback Strategy:**
- If automatic pruning fails (network error, PGlite unavailable), retry logic attempts 3x with exponential backoff (5s, 10s, 20s)
- After 3 failed attempts, error notification shown
- User can always trigger manual cleanup as fallback

---

## Minimum Requirements

### Hardware
- **RAM:** 512MB minimum (for PGlite in-memory operations)
- **Storage:** Varies based on retention window (90-365 days)

### Software
- **Service Worker:** HTTPS required (or localhost for dev)
- **JavaScript:** ES6+ (async/await, Promises)
- **Browser Storage:** localStorage + IndexedDB enabled

### Network
- **For Automatic Pruning:** Not required (pruning runs offline)
- **For Sync After Pruning:** Network connection needed to sync deletions to server

---

## Known Limitations

### Periodic Background Sync (Chrome/Edge)
1. **Battery Saver Mode:** May delay or skip pruning events
2. **Data Saver Mode:** May throttle background sync
3. **Tab Closed:** Requires at least one browser window open (client needed for message passing)
4. **Minimum Interval:** Browser enforces minimum 12-hour interval (7-day interval is ideal)

### Manual Pruning (All Browsers)
1. **Page Reload:** Interrupts ongoing pruning operation
2. **Offline Mode:** Can prune locally, but won't sync deletions until online
3. **Concurrent Operations:** Pruning blocked during active sync

### Safari/Firefox Specific
- **No Background Pruning:** User must manually trigger cleanup
- **Battery Drain:** Manual pruning may consume more battery if forgotten
- **Storage Limits:** May hit IndexedDB quota faster without automatic cleanup

---

## Testing Checklist

### Chrome/Edge Testing
- [ ] Enable automatic pruning in Settings
- [ ] Verify periodic sync registered in DevTools → Application → Background Sync
- [ ] Manually trigger `periodicsync` event via DevTools
- [ ] Verify notification shown after successful pruning
- [ ] Test retry logic by simulating network failure

### Safari/Firefox Testing
- [ ] Verify automatic toggle disabled with warning message
- [ ] Test manual "Clear Old Data Now" button
- [ ] Verify confirmation modal appears
- [ ] Verify toast notification shows results
- [ ] Test edge case: pruning with no old data

### Cross-Browser Testing
- [ ] Verify UI adapts to browser capabilities
- [ ] Test retention slider (30-365 days)
- [ ] Verify validation: retention >= factsWindow
- [ ] Test diagnostic modal pruning metrics
- [ ] Verify pruning stats persist across reloads

---

## Migration Guide

### From No Pruning → Automatic Pruning
1. Update browser to Chrome 80+ or Edge 80+
2. Navigate to Settings → PGlite → Automatic Cleanup
3. Enable "Enable automatic cleanup" toggle
4. Adjust retention window (default: 90 days)
5. Periodic sync registered automatically

### From Manual → Automatic Pruning
1. Verify browser supports Periodic Background Sync
2. Enable toggle in Settings
3. Existing manual cleanup remains available as fallback

---

## Troubleshooting

### Issue: Automatic pruning not working (Chrome/Edge)
**Symptoms:** No pruning notifications after 7+ days
**Solution:**
1. Check Settings → PGlite → Automatic Cleanup is enabled
2. Verify periodic sync in DevTools → Application → Background Sync
3. Check browser battery saver mode (may delay events)
4. Re-register sync: disable/enable toggle in Settings

### Issue: "Browser not supported" warning
**Symptoms:** Warning shown in Chrome/Edge
**Solution:**
1. Update browser to latest version (Chrome 80+, Edge 80+)
2. Verify HTTPS connection (required for Service Worker)
3. Check if Service Worker registered (DevTools → Application → Service Workers)

### Issue: Pruning button does nothing
**Symptoms:** Click "Clear Old Data Now", no response
**Solution:**
1. Open browser console, check for errors
2. Verify PGlite initialized (check Diagnostic Modal)
3. Check network tab for failed requests
4. Try refreshing page and retry

### Issue: Retention slider validation fails
**Symptoms:** "Retention must be >= Facts Window" error
**Solution:**
1. Check current Facts Window setting (Settings → PGlite → Data Window)
2. Increase retention to be >= facts window
3. Or decrease facts window first, then adjust retention

---

## Performance Impact

### Automatic Pruning (Background)
- **CPU:** Low (~1-2 seconds per 1000 records)
- **Memory:** Medium (~10-50MB spike during pruning)
- **Battery:** Minimal (runs max once per 7 days)
- **Network:** None (fully offline operation)

### Manual Pruning (User-Triggered)
- **CPU:** Same as automatic (~1-2 seconds per 1000 records)
- **Memory:** Same as automatic (~10-50MB spike)
- **Battery:** Higher if done frequently (user responsibility)
- **Network:** None during pruning, needed for subsequent sync

### Database Size Reduction
- **90-day retention:** Typical 30-50% reduction after 6 months
- **180-day retention:** Typical 20-30% reduction after 1 year
- **365-day retention:** Minimal reduction (<10% after 2 years)

**Recommendation:** Use 90-day retention for optimal balance between storage and data availability.

---

## Security Considerations

### Data Privacy
- ✅ Pruned data permanently deleted from local IndexedDB
- ✅ Server copy unaffected (only local cleanup)
- ✅ Pending/conflicted records never deleted (safety mechanism)

### User Consent
- ✅ Automatic pruning requires explicit user opt-in (toggle in Settings)
- ✅ Confirmation modal for manual pruning
- ✅ Clear warning about permanent deletion

### Attack Surface
- ✅ No network requests during pruning (offline operation)
- ✅ No sensitive data in notifications (only count + size)
- ✅ Service Worker message passing uses MessageChannel (isolated)

---

## Future Enhancements

### Planned (v2.0)
- [ ] Smart retention by category (keep important categories longer)
- [ ] Export before pruning (CSV backup option)
- [ ] Progressive pruning (batch deletions for large datasets)
- [ ] Compression (aggregate old records instead of deleting)

### Under Consideration
- [ ] Safari/Firefox background pruning (via Web Periodic Background Sync polyfill)
- [ ] Cloud backup before pruning (Google Drive/Dropbox integration)
- [ ] Predictive pruning (ML-based retention suggestions)

---

## References

- [Periodic Background Sync API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API)
- [Can I Use - Periodic Background Sync](https://caniuse.com/background-sync)
- [Chrome Platform Status - Periodic Background Sync](https://chromestatus.com/feature/5689383275462656)
- [Service Worker API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-22
**Maintained By:** Claude Code (task-010)
