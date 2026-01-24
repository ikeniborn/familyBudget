# Settings Page Implementation - PGlite UI Access

**Date:** 2026-01-24
**Version:** v10.0.15+
**Status:** ✅ Implemented

---

## 📋 Overview

Реализован полноценный доступ к странице настроек приложения с UI для управления PGlite (offline mode).

---

## 🎯 Implemented Features

### 1. Backend Route
**File:** `backend/app/api/web/router.py`

Добавлен новый маршрут:
```python
@web_router.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request, current_user: CurrentUser)
```

**URL:** `http://localhost:8000/settings`

**Authentication:** Required (CurrentUser dependency)

---

### 2. Navigation Menu

#### Desktop Menu
**File:** `frontend/web/templates/partials/navbar_center_menu.html`

Добавлен пункт "⚙️ Настройки" в dropdown "📂 Прочее":
- Позиция: Первый пункт в секции "Прочее"
- URL: `/settings`
- Active state: Автоматически подсвечивается при `/settings` в URL

#### Mobile Menu
**File:** `frontend/web/templates/components/user_dropdown_menu.html`

Добавлен пункт "⚙️ Настройки" в mobile menu:
- Позиция: Первый пункт в секции "📂 Прочее"
- URL: `/settings`
- Visibility: Показывается на всех размерах экрана

---

### 3. Settings Page UI

**File:** `frontend/web/templates/settings.html`

Страница содержит:

#### PGlite Configuration Section
- **Enable/Disable Toggle** - Включение/отключение PGlite
- **Data Window Slider** - Окно данных (30-365 дней)
- **Auto-sync Interval** - Интервал автосинхронизации (5 мин)
- **Diagnostic Button** - Кнопка "🔍 Диагностика"

#### Automatic Data Cleanup (Pruning)
- **Enable Auto-Pruning Toggle** - Включение автоочистки
- **Retention Window Slider** - Окно хранения (30-365 дней)
- **Last Pruned Info** - Информация о последней очистке
- **Manual Cleanup Button** - Кнопка "Очистить старые данные сейчас"
- **Browser Compatibility Warning** - Предупреждение для неподдерживаемых браузеров

---

### 4. PGlite Diagnostic Modal

**Component:** `PGliteDiagnosticModal` from `window.UIComponents`

**Access Methods:**
1. Via Settings Page → "🔍 Диагностика" button
2. Via browser console: `openPGliteDiagnostic()`

**Diagnostic Information:**

#### Status Overview
- ✓ Status (Active/Inactive)
- 💾 DB Size (KB/MB/GB)
- 🔄 Last Sync timestamp
- ⚙️ Sync Status (idle/syncing/error)

#### Table Statistics
- 📁 Articles count
- 🏢 Financial Centers count
- 💼 Cost Centers count

#### Performance Metrics
- ⚡ Average Query Time (ms)
- 📊 Total Queries Tracked

#### API Calls Reduction (task-015 Phase 5)
- 📉 Reduction % (target: ≥80%)
- 💾 API Calls Saved
- 📡 Bandwidth Saved (KB)
- ⚡ Speedup Factor (PGlite vs API)

**Module Breakdown:**
- 🛒 Shopping Lists
- 💰 Facts
- 📅 Recurring Plans
- 📊 Dashboard

#### Data Cleanup Metrics (task-010)
- 🗑️ Last Pruned timestamp
- 📊 Total Pruned records
- ⏰ Next Cleanup estimate

#### Conflict Resolution (task-009)
- ⚔️ Conflict Rate % (target: <1%)
- 📊 Total Conflicts
- ✅ Resolved Conflicts
- ⏳ Pending Conflicts
- 🏆 Server Wins vs Client Wins

---

## 🔧 Technical Implementation

### Dependencies Added

**File:** `frontend/web/templates/settings.html`

```html
<!-- Performance Monitor (required by PGliteDiagnosticModal) -->
<script src="/static/js/monitoring/PerformanceMonitor.min.js?v=PLACEHOLDER"></script>

<!-- UI Components Bundle (includes PGliteDiagnosticModal) -->
<script src="/static/js/dist/components.bundle.js?v=PLACEHOLDER"></script>
```

### Global Function Alias

```javascript
// Create global alias for openPGliteDiagnostic
const openPGliteDiagnostic = window.UIComponents.openPGliteDiagnostic;
```

**Available as:**
- `openPGliteDiagnostic()` - Direct function call
- `window.UIComponents.openPGliteDiagnostic()` - Full path

---

## 🧪 Testing

### Manual Testing Steps

1. **Start application:**
   ```bash
   # Development mode
   uvicorn backend.app.main:app --reload
   ```

2. **Login to application**
   - Navigate to `http://localhost:8000`
   - Login with credentials

3. **Access Settings Page:**

   **Desktop:**
   - Click "📂 Прочее" dropdown
   - Click "⚙️ Настройки"
   - URL should be `/settings`

   **Mobile:**
   - Click hamburger menu (☰)
   - Scroll to "📂 Прочее" section
   - Click "⚙️ Настройки"

4. **Test PGlite Configuration:**
   - Toggle "Включить PGlite" → should show/hide settings
   - Move "Окно данных" slider → should update value display
   - Check localStorage: `localStorage.getItem('PGLITE_ENABLED')`

5. **Test Diagnostic Modal:**
   - Click "🔍 Диагностика" button
   - Modal should open with all sections visible
   - Check data is loaded (not just spinners)
   - Verify sections:
     - Status Overview (4 cards)
     - Table Statistics (3 columns)
     - Performance Metrics (2 rows)
     - API Calls Reduction (if data available)
     - Data Cleanup Metrics (if enabled)
     - Conflict Resolution (if conflicts exist)

6. **Test Pruning Controls:**
   - Toggle "Включить автоочистку"
   - Should show/hide retention controls
   - Move "Окно хранения" slider
   - Click "Очистить старые данные сейчас"
   - Confirm dialog should appear

7. **Browser Console Test:**
   ```javascript
   // Should work without errors
   openPGliteDiagnostic();

   // Should show same modal
   window.UIComponents.openPGliteDiagnostic();

   // Check PGlite status
   await window.PGlite.isPGliteEnabled();
   ```

---

## 📝 Files Modified

### Backend
- ✅ `backend/app/api/web/router.py` - Added `/settings` route

### Frontend Templates
- ✅ `frontend/web/templates/partials/navbar_center_menu.html` - Added desktop menu item
- ✅ `frontend/web/templates/components/user_dropdown_menu.html` - Added mobile menu item
- ✅ `frontend/web/templates/settings.html` - Added script dependencies and global alias

---

## 🚀 Deployment

### Build Requirements

Before deploying, ensure all bundles are built:

```bash
# Build all TypeScript bundles (including components.bundle.js)
npm run build

# Or build production bundles
npm run build:prod
```

**Critical bundles:**
- `frontend/web/static/js/dist/components.bundle.js` (UIComponents)
- `frontend/web/static/js/monitoring/PerformanceMonitor.min.js` (PerformanceMonitor)
- `frontend/shared/db/pglite.min.js` (PGlite core)

### Cache Busting

Cache busting is automatic in CI/CD:
- `?v=PLACEHOLDER` replaced with version/commit hash
- Handled by `scripts/ci/cache_busting_ci.sh`

---

## 🔍 Troubleshooting

### Problem: openPGliteDiagnostic is not defined

**Cause:** `components.bundle.js` not loaded

**Solution:**
1. Check browser console for 404 errors
2. Verify bundle exists: `ls frontend/web/static/js/dist/components.bundle.js`
3. Rebuild bundles: `npm run build`

---

### Problem: Diagnostic modal shows spinners forever

**Cause:** PGlite not initialized

**Solution:**
1. Check PGlite is enabled: `localStorage.getItem('PGLITE_ENABLED')`
2. Reload page to initialize PGlite
3. Check browser console for PGlite errors

---

### Problem: PerformanceMonitor is not defined

**Cause:** `PerformanceMonitor.min.js` not loaded

**Solution:**
1. Verify bundle exists: `ls frontend/web/static/js/monitoring/PerformanceMonitor.min.js`
2. Rebuild: `npm run build`
3. Check `<script>` tag order in `settings.html` (PerformanceMonitor before components.bundle)

---

### Problem: Settings menu not visible

**Cause:** User not authenticated or route not registered

**Solution:**
1. Verify user is logged in
2. Check route in backend: `http://localhost:8000/docs` → `/settings` endpoint
3. Restart backend: `uvicorn backend.app.main:app --reload`

---

## 📚 Related Documentation

- `/docs/guides/offline-mode.md` - User guide for offline mode
- `/docs/architecture/pglite-integration.md` - PGlite architecture
- `/docs/architecture/pglite-pruning-compatibility.md` - Pruning system
- `frontend/web/static/js/modules/uiComponents/modals/PGliteDiagnosticModal.ts` - Modal component source

---

## ✅ Acceptance Criteria

- [x] Backend route `/settings` registered and accessible
- [x] Desktop menu shows "⚙️ Настройки" in "📂 Прочее" dropdown
- [x] Mobile menu shows "⚙️ Настройки" in "📂 Прочее" section
- [x] Settings page renders without errors
- [x] PGlite toggle works (enable/disable)
- [x] Data window slider updates localStorage
- [x] "🔍 Диагностика" button opens modal
- [x] Diagnostic modal shows all sections
- [x] Pruning controls work (toggle, slider, manual cleanup)
- [x] `openPGliteDiagnostic()` callable from console
- [x] No 404 errors for bundles
- [x] No JavaScript errors in console
- [x] Mobile responsive layout works

---

## 🎉 Summary

Settings page successfully implemented with full PGlite UI access. Users can now:
- Configure offline mode settings via UI
- View comprehensive PGlite diagnostics
- Manage automatic data cleanup
- Monitor performance metrics
- Track conflict resolution stats

**Access:** Desktop/Mobile → "📂 Прочее" → "⚙️ Настройки"
