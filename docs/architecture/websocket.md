# WebSocket Architecture

## Overview

Family Budget uses WebSocket for real-time bidirectional communication between browser and server. This document describes the WebSocket implementation, including RTT monitoring and navigation detection.

## RTT Monitoring

### Navigation Detection for RTT Filtering (v5.8.0+)

**Purpose:** Prevent false "slow connection" warnings during page navigation/reload.

**Problem:**
During full page reload (`/facts` → `/plan`), WebSocket closes and reconnects, causing temporary RTT spikes that trigger false warnings.

**Solution:**
RTT measurements are filtered during navigation window (first 10 seconds after page load) to prevent false "slow connection" warnings during WebSocket reconnection.

### Implementation

**Location:** `budgetWSClient.js` lines 121+, 1217+

**Navigation Detection:**
- `isNavigating = true` on page load
- Skip RTT warnings when navigating
- Auto-clear flag after 10 seconds
- Comprehensive logging

**RTT Filtering Logic:**
```javascript
// FILTER 1: Skip if navigating (page load window)
const skipNavigating = this.isNavigating;

// FILTER 2: Skip anomalous first measurement (> 4000ms)
const skipAnomalous = this._rttMeasurements.length === 0 && rtt > RTT_THRESHOLD * 2;

if (skipNavigating) {
    this._log('RTT_FILTER', 'debug', 'RTT measurement skipped (navigating)');
} else if (skipAnomalous) {
    this._log('RTT_FILTER', 'debug', 'RTT measurement skipped (anomalous first)');
} else {
    // Store measurement and calculate rolling average
    this._rttMeasurements.push(rtt);
    this._rttRollingAverage = average(this._rttMeasurements);
}
```

### Logging Prefixes

| Prefix | Purpose | Examples |
|--------|---------|----------|
| `[NAV]` | Navigation detection events | Window start/end |
| `[RTT_FILTER]` | RTT filtering decisions | Skip/measure decisions |
| `[WS_RTT]` | RTT measurements | Actual measurements when stored |

### Configuration

**Constants:**
```javascript
NAVIGATION_WINDOW = 10000;     // 10 seconds suppression window
RTT_THRESHOLD = 2000;          // Slow connection threshold (ms)
RTT_WINDOW_SIZE = 5;           // Rolling average window
CLIENT_PING_INTERVAL = 15000;  // Ping every 15s (8s on iOS)
```

### Testing

**Console Filter:**
```
NAV|RTT_FILTER|WS_RTT
```

**Expected Behavior:**
1. Page loads → `[NAV] Navigation window started`
2. Pong received during first 10s → `[RTT_FILTER] skipped (navigating)`
3. After 10s → `[NAV] Navigation window ended`
4. Subsequent pongs → `[WS_RTT] RTT measured`

## Connection Lifecycle

### Page Navigation

**Current Behavior:**
1. User navigates (`/facts` → `/plan`)
2. `beforeunload` fires → WebSocket closes
3. Page reloads completely (MPA)
4. WebSocket reconnects (~500-2000ms gap)
5. **Navigation detection active** → RTT warnings suppressed
6. After 10s → Normal RTT monitoring resumes

### Multi-Tab Coordination

**Leader-Follower Pattern:**
- First tab = Leader (creates WebSocket)
- Other tabs = Followers (use BroadcastChannel)
- Leader broadcasts heartbeat every 3s
- Fallback: Long Polling if WebSocket fails

### iOS Specific Handling

**Issues:**
- Web Locks API unreliable on iOS
- Each tab creates own WebSocket
- More frequent pings (8s vs 15s)

**Solution:**
- Force `isLeader = true` on iOS
- Accept multiple connections
- Shorter ping interval keeps connection alive

## Error Handling

### Connection Failures

| Close Code | Meaning | Action |
|------------|---------|--------|
| 1000 | Normal close | Reconnect with backoff |
| 1001 | Going away | Reconnect |
| 1005 | No status (iOS wake) | Reconnect with increased delay |
| 1006 | Abnormal close | Reconnect |
| 4001 | Auth error | Disable reconnection |
| 4029 | Connection limit | Max attempts reached |

### Reconnection Strategy

**Exponential Backoff:**
- First attempt: 1s (500ms for navigation-triggered close)
- Max delay: 30s
- Max attempts: 10
- Reset on successful connection

## WebSocket Events

### Batch Delete Summary Events (v6.6.0+)

**Purpose:** Reduce toast notification spam by broadcasting single summary event for batch operations instead of individual events per item.

**Problem Solved:**
- N deletions previously triggered N individual WebSocket events → N toast notifications (голубые/blue toasts)
- Poor UX during mass deletion operations

**Solution:**
- Batch delete operations now broadcast SINGLE summary event
- Clients receive one event with aggregate data (item IDs + count)
- Result: 1 success toast instead of N individual toasts

**Events Table:**

| Event | Payload | Description | Pages |
|-------|---------|-------------|-------|
| `facts_batch_deleted` | `{fact_ids: int[], deleted_count: int, record_type?: str}` | Summary event for bulk fact deletion | `/plan`, `/facts` (index.html) |
| `recurring_plans_batch_deleted` | `{plan_ids: int[], deleted_count: int}` | Summary event for bulk recurring plan deletion | `/plan` |

**Implementation Details:**

1. **Backend (`budget_ws.py`):**
   - `broadcast_facts_batch_deleted(fact_ids, deleted_count, record_type=None)` - Broadcast fact batch delete summary
   - `broadcast_recurring_plans_batch_deleted(plan_ids, deleted_count)` - Broadcast recurring plan batch delete summary

2. **Frontend Handlers:**
   - **plan.html:**
     - `facts_batch_deleted` - Filters by `record_type === 'plan'`, reloads plan facts table
     - `recurring_plans_batch_deleted` - Reloads recurring plans list (if section expanded)
   - **index.html:**
     - `facts_batch_deleted` - Filters by `record_type !== 'plan'`, reloads dashboard

3. **Notification Strategy:**
   - **Initiating client:** Shows SINGLE success toast (e.g., "✅ Удалено: 10 записей")
   - **Other clients:** NO toast, silent auto-reload only
   - Eliminates notification spam across all connected clients

**Backward Compatibility:**
- Individual events (`fact_deleted`, `recurring_plan_deleted`) still exist for non-batch operations
- Clients handle both individual and batch events

**Related Endpoints:**
- `POST /api/v1/facts/batch-delete` - Bulk fact deletion (max 100)
- `POST /api/v1/recurring-plans/batch-delete` - Bulk recurring plan deletion (max 100)

## Related Documentation

See `/docs/architecture/pwa.md` for complete PWA architecture, including:
- WebSocket Recovery After Long Sleep (5-layer strategy)
- Navigation Detection for RTT Filtering (detailed)
- WebSocket Diagnostics Modal
- Service Worker integration

## Version History

- **v5.8.0:** Navigation detection for RTT filtering
- **v5.7.0:** 5-layer wake recovery strategy
- **v5.4.0:** Multi-tab coordination
- **v2.0.0:** WebSocket replaces SSE
