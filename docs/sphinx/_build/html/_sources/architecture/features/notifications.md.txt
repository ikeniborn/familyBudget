# Notification Architecture

## Overview

Family Budget notification system provides multi-channel user communication via Web Push and Telegram Bot. As of version 6.4.0, users can control their notification preferences independently for each channel.

## Notification Channels

### 1. Web Push (VAPID)
- **Protocol**: Web Push API with VAPID authentication
- **Client**: Service Worker (`sw.js`) + Push Manager (`pushManager.js`)
- **Delivery**: Browser notifications (desktop + mobile PWA)
- **Persistence**: Subscription stored in `t_push_subscription` table
- **User Control**: `User.enable_push_notifications` (boolean)

### 2. Telegram Bot
- **Protocol**: Telegram Bot API (python-telegram-bot library)
- **Client**: Family Budget Bot (@familybudget_bot)
- **Delivery**: Telegram messages to user's account
- **Persistence**: `User.telegram_id` (bigint, nullable)
- **User Control**: `User.enable_telegram_notifications` (boolean)

## Notification Types

| Type | Description | Channels | Frequency | Affected by Preferences |
|------|-------------|----------|-----------|------------------------|
| `budget_threshold` | Budget reaches 90% of plan | Telegram | Real-time | ✅ Yes |
| `budget_exceeded` | Budget exceeds 100% of plan | Telegram | Real-time | ✅ Yes |
| `weekly_report` | Weekly summary of transactions | Telegram | Every Monday 9:00 | ✅ Yes |
| `plan_reminder` | Reminder about planned transaction | Both | Scheduled (user-defined) | ✅ Yes |

**All notification types** respect user preferences as of v6.4.0.

## User Notification Preferences (v6.4.0+)

### Database Schema

**Main Table**: `t_d_user`

```sql
ALTER TABLE t_d_user
ADD COLUMN enable_push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN enable_telegram_notifications BOOLEAN NOT NULL DEFAULT TRUE;
```

**History Table**: `t_d_user_history` (SCD Type 2)

```sql
ALTER TABLE t_d_user_history
ADD COLUMN enable_push_notifications BOOLEAN,
ADD COLUMN enable_telegram_notifications BOOLEAN;
```

**Performance Index**:

```sql
CREATE INDEX idx_user_notifications_enabled
ON t_d_user(id)
WHERE enable_push_notifications = TRUE OR enable_telegram_notifications = TRUE;
```

### Business Rules

1. **Default Values**: Both fields default to `TRUE` for backward compatibility
2. **Independence**: Each channel can be enabled/disabled independently
3. **Granularity**: Simple global toggles (not per-notification-type)
4. **Scope**: Applies to ALL notifications including existing `ScheduledReminder` records
5. **Storage**: User model (SCD Type 1 + History)
6. **Validation**: At least one channel SHOULD be enabled (no database constraint, UI warning recommended)

### Migration Strategy

**Backward Compatibility**:
- Existing users: Both preferences default to `TRUE` → All notifications enabled
- New users: Both preferences default to `TRUE` → All notifications enabled
- Opt-out model: Users must explicitly disable channels

**Zero Downtime Deployment**:
1. Apply migration (adds columns with `DEFAULT TRUE`)
2. Deploy backend code (preferences filtering)
3. Deploy frontend code (settings UI)
4. No service interruption required

## API Endpoints

### Update Notification Preferences

**Endpoint**: `PATCH /api/v1/users/me/notification-preferences`

**Authentication**: Required (any authenticated user)

**Query Parameters**:
- `enable_push` (boolean, optional): Enable/disable Web Push notifications
- `enable_telegram` (boolean, optional): Enable/disable Telegram notifications

**Validation**:
- At least one parameter must be provided
- Returns 400 Bad Request if both parameters are null

**Example Request**:
```bash
PATCH /api/v1/users/me/notification-preferences?enable_push=false&enable_telegram=true
```

**Example Response** (200 OK):
```json
{
  "id": 1,
  "telegram_id": 123456789,
  "email": "user@example.com",
  "enable_push_notifications": false,
  "enable_telegram_notifications": true,
  ...
}
```

**Logging**:
```
[USER_PREF] User 1 updated notification preferences: push:true→false, telegram:true→true
```

### Get Current User (includes preferences)

**Endpoint**: `GET /api/v1/users/me`

**Response includes**:
```json
{
  "enable_push_notifications": true,
  "enable_telegram_notifications": true
}
```

## Backend Implementation

### Service Layer Filtering

#### NotificationService

**File**: `backend/app/services/notification_service.py`

**Method**: `send_weekly_reports()` (lines 254-269)

```python
for user in users:
    # FILTER: Check Telegram notifications enabled
    if not user.enable_telegram_notifications:
        logger.debug(
            f"[NOTIF_FILTER] Skipping weekly report for user {user.id}: "
            "Telegram notifications disabled"
        )
        continue

    if user.telegram_id:
        success = await self.send_telegram_message(...)
```

**Method**: `check_all_budget_thresholds()` (lines 319-325)

```python
# FILTER: Only users with Telegram notifications enabled
telegram_ids = [
    u.telegram_id for u in users
    if u.telegram_id and u.enable_telegram_notifications
]
```

#### ReminderService

**File**: `backend/app/services/reminder_service.py`

**Method**: `send_reminder()` (lines 338-365)

```python
# Send Telegram notification (check user preference)
telegram_sent = False
if user.telegram_id:
    if user.enable_telegram_notifications:
        telegram_sent = await self._send_telegram(user.telegram_id, message)
    else:
        logger.info(
            f"[NOTIF_FILTER] Skipping Telegram reminder for user {user.id}: "
            "Telegram notifications disabled"
        )

# Send Web Push notification (check user preference)
web_push_sent = False
if user.enable_push_notifications:
    web_push_sent = await self._send_web_push_to_user(...)
else:
    logger.info(
        f"[NOTIF_FILTER] Skipping Web Push reminder for user {user.id}: "
        "Push notifications disabled"
    )
```

**Key Design Decision**: Check preferences at `send_reminder()` level (where user is already available) to avoid duplicate DB queries.

## Frontend Implementation

### Notifications Settings Page

**File**: `frontend/web/templates/notifications.html`

**Mobile Accessibility**:
- Page now accessible on mobile devices (removed `mobile_restriction_alert`)
- Notifications List hidden on mobile (`hidden md:block`)
- Settings section visible on all devices

**Settings UI** (lines 22-70):
```html
<div class="card bg-base-100 shadow-lg">
    <h2>⚙️ Настройки уведомлений</h2>

    <!-- Loading Indicator -->
    <div id="settings-loading">...</div>

    <!-- Settings Form -->
    <div id="settings-form" style="display: none;">
        <!-- Push Toggle -->
        <input type="checkbox" id="enable-push" class="toggle toggle-primary"
               onchange="saveNotificationPreferences()" />

        <!-- Telegram Toggle -->
        <input type="checkbox" id="enable-telegram" class="toggle toggle-primary"
               onchange="saveNotificationPreferences()" />

        <!-- Status Message -->
        <div id="settings-status">...</div>
    </div>
</div>
```

**JavaScript Functions** (lines 547-644):
- `loadNotificationPreferences()`: Fetch from `/api/v1/users/me`, update UI
- `saveNotificationPreferences()`: PATCH to `/api/v1/users/me/notification-preferences`, auto-save on toggle
- `showSettingsStatus()`: Show success/error message (3-second auto-hide)

**User Flow**:
1. Page loads → Shows loading spinner
2. Fetch user preferences from API → Update toggle states
3. Hide spinner, show form
4. User changes toggle → Auto-save to API
5. Show success message "✓ Настройки сохранены"
6. On error: Revert toggle state, show error message

### Push Bell Button

**File**: `frontend/web/templates/base.html`

**Button State** (lines 682-708):
```html
<button id="push-bell-btn" onclick="navigateToNotificationSettings()">
    <svg id="push-bell-icon">
        <!-- Enabled bell icon (default) -->
        <path id="bell-enabled-icon" d="..." />

        <!-- Muted bell icon (shown when disabled) -->
        <path id="bell-muted-icon" style="display: none;" d="..." />
    </svg>
</button>
<span id="push-bell-tooltip">Настройки уведомлений</span>
```

**Behavior**:
- **Click**: Navigates to `/notifications` page (NOT toggle)
- **Icon**: Shows enabled bell OR muted bell based on `enable_push_notifications`
- **Tooltip**: "Настройки уведомлений (вкл)" or "Настройки уведомлений (выкл)"
- **Opacity**: Reduced (50%) when disabled

**State Update** (lines 1588-1625):
```javascript
async function updatePushBellState() {
    const response = await fetch('/api/v1/users/me');
    const user = await response.json();
    const pushEnabled = user.enable_push_notifications ?? true;

    if (pushEnabled) {
        // Show enabled bell icon
        enabledIcon.style.display = 'block';
        mutedIcon.style.display = 'none';
        bellButton.classList.remove('text-base-content/50');
    } else {
        // Show muted bell icon
        enabledIcon.style.display = 'none';
        mutedIcon.style.display = 'block';
        bellButton.classList.add('text-base-content/50');
    }
}
```

**Initialization**:
- Called 1 second after `budgetPushManager.init()` completes
- Ensures DOM is fully ready before updating button state

## Logging Strategy

All preference-related operations use prefixed logging for easy filtering:

| Prefix | Context | Example |
|--------|---------|---------|
| `[USER_PREF]` | API preference updates | `User 1 updated: push:true→false` |
| `[NOTIF_FILTER]` | Service layer filtering | `Skipping user 5: Telegram disabled` |
| `[NOTIF_SETTINGS]` | Frontend settings page | `Preferences saved successfully` |
| `[PUSH_BELL]` | Frontend bell button | `User push preference: false` |

**Log Analysis**:
```bash
# Find all preference updates
docker compose logs backend | grep "\[USER_PREF\]"

# Find skipped notifications
docker compose logs backend | grep "\[NOTIF_FILTER\]"

# Count users with disabled Telegram
docker compose logs backend | grep "\[NOTIF_FILTER\].*Telegram" | wc -l
```

## Performance Considerations

### Database Optimization

**Partial Index**:
```sql
CREATE INDEX idx_user_notifications_enabled
ON t_d_user(id)
WHERE enable_push_notifications = TRUE OR enable_telegram_notifications = TRUE;
```

**Purpose**: Efficiently find users with at least one notification channel enabled (for scheduler jobs)

**Impact**:
- Small index size (~10% of table if most users keep notifications enabled)
- Fast lookups for notification filtering
- No impact on regular user CRUD operations

### Query Performance

**Before**:
```sql
SELECT * FROM t_d_user WHERE is_active = TRUE;
```

**After**:
```sql
SELECT * FROM t_d_user
WHERE is_active = TRUE AND enable_telegram_notifications = TRUE;
```

**Estimated Improvement**: 5-10% faster (fewer rows processed)

## Edge Cases

### 1. Both Channels Disabled
**Scenario**: User disables both push and Telegram notifications

**Handling**: Allowed (no validation preventing this)

**Impact**: User receives NO notifications

**UI Recommendation**: Show warning message in settings page

### 2. Existing ScheduledReminder Records
**Scenario**: Reminder created before migration, fires after migration

**Handling**: Checks user preferences at send time (not creation time)

**Impact**: If user disabled notifications AFTER creating reminder, reminder NOT sent

### 3. User Without telegram_id
**Scenario**: Email-only user (no Telegram account)

**Handling**: `enable_telegram_notifications` stored but has no effect

**Impact**: User can only receive push notifications

### 4. Concurrent Preference Updates
**Scenario**: User opens `/notifications` in 2 tabs, updates different preferences

**Handling**: Last write wins (race condition acceptable)

**Impact**: Final state reflects most recent update

## Testing

### Database Migration Testing
```bash
# Apply migration
alembic upgrade head

# Verify columns exist
psql -c "SELECT column_name, data_type, column_default FROM information_schema.columns
         WHERE table_name = 't_d_user'
         AND column_name IN ('enable_push_notifications', 'enable_telegram_notifications');"
```

### API Endpoint Testing
```bash
# Get user preferences
curl -X GET http://localhost:8000/api/v1/users/me -H "Authorization: Bearer $TOKEN" | jq

# Update preferences
curl -X PATCH "http://localhost:8000/api/v1/users/me/notification-preferences?enable_push=false&enable_telegram=false" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Notification Filtering Testing
```bash
# Disable Telegram notifications
curl -X PATCH "...?enable_telegram=false" -H "Authorization: Bearer $TOKEN"

# Trigger weekly report job (manually or wait for scheduler)
# Check logs:
docker compose logs backend | grep "\[NOTIF_FILTER\]"

# Expected: "Skipping user X: Telegram notifications disabled"
```

## Deployment Checklist

### Pre-Deployment
- [ ] Create database backup: `./scripts/backup.sh`
- [ ] Test migration locally: `alembic upgrade head`
- [ ] Verify backend API with curl/Postman
- [ ] Test frontend on Chrome, Safari, Yandex Browser
- [ ] Verify mobile responsiveness (iPhone, Android)
- [ ] Check backend logs for proper prefixes

### Deployment Steps
1. Stop application: `docker compose down`
2. Backup database: `./scripts/backup.sh`
3. Deploy code: `sudo ./deploy.sh --sync-mode update --cleanup-mode smart --patch`
4. Apply migration: `docker compose exec backend alembic upgrade head`
5. Verify migration success
6. Monitor logs: `docker compose logs -f backend | grep -E "\[USER_PREF\]|\[NOTIF_FILTER\]"`

### Post-Deployment Verification
- [ ] Notifications page loads without errors
- [ ] Settings section visible and functional
- [ ] Push bell button shows correct state
- [ ] API returns preference fields
- [ ] Preferences save successfully
- [ ] Existing users have TRUE for both fields
- [ ] Scheduler jobs filter users correctly

### Rollback Plan
```bash
# Revert migration
docker compose exec backend alembic downgrade -1

# Restore from backup (if needed)
./scripts/restore.sh /opt/budget/backups/backup_YYYYMMDD.sql
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 6.4.0 | 2025-12-27 | Added user notification preferences (enable_push_notifications, enable_telegram_notifications) |
| 6.3.0 | 2025-12-26 | Admin authentication bypass (2FA optional for admins) |
| 6.2.0 | 2025-12-26 | Yearly recurring plans with MMDD encoding |
| 5.7.0 | 2025-12-25 | WebSocket diagnostics modal, wake detection |
| 5.6.0 | 2025-12-25 | Build system optimization, logging framework |

## Related Documentation

- [PWA Architecture](/docs/architecture/pwa.md) - Push notification implementation details
- [Telegram Bot](/docs/architecture/telegram-bot.md) - Telegram notification delivery
- [User Model](/backend/app/models/user.py) - User schema with notification preferences
- [CLAUDE.md](/CLAUDE.md) - Developer guide with notification preferences section
