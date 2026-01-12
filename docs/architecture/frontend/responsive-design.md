# Responsive Design Changes

This document tracks all responsive design modifications and breakpoint adjustments in the Family Budget application.

## Table of Contents

1. [Breakpoint Strategy](#breakpoint-strategy)
2. [FAB Navigation Architecture (v7.x)](#fab-navigation-architecture-v7x)
3. [Quick Actions Block - Tablet Hide (v6.6.0)](#quick-actions-block---tablet-hide-v660)

---

## Breakpoint Strategy

Family Budget uses Tailwind CSS breakpoint system:

| Breakpoint | Min Width | Device Type | Usage |
|------------|-----------|-------------|-------|
| `sm` | 640px | Mobile landscape | Secondary adjustments |
| `md` | 768px | Tablet portrait | Tablet-specific layouts |
| `lg` | 1024px | Desktop / Tablet landscape | Desktop-first features |
| `xl` | 1280px | Large desktop | Wide screen optimizations |
| `2xl` | 1536px | Extra large desktop | Ultra-wide layouts |

**Default Strategy:**
- Mobile-first approach (base styles for 0-639px)
- Progressive enhancement for larger screens
- Critical features available on all devices

---

## FAB Navigation Architecture (v7.x)

**Date:** 2026-01-08
**Issue:** Mobile navigation not fixed at bottom, displayed on desktop, missing safe-area-inset for iPhone notch
**Solution:** CSS positioning fixes with `!important`, safe-area-inset padding, visibility protection, resize listener

### Positioning Strategy

**Mobile/Tablet (< 1024px):**
- Navigation bar fixed at bottom of viewport
- Full width with 5 buttons (Home, Analytics, Add, Facts/Plans, Lists)
- Safe-area-inset padding for iPhone notch compatibility
- Z-index: 50 (above content, below modals)

**Desktop (≥ 1024px):**
- Floating Action Button (FAB) at bottom-right corner
- Speed Dial menu with 4 action items
- Only visible on pages: /, /facts, /plan
- Z-index: 1000 (above backdrop: 999)

### Dynamic Breakpoint Switching (v7.x+)

**Resize Listener:**
- Automatically switches between mobile nav and desktop FAB when window crosses 1024px breakpoint
- No page reload required - works on tablet rotation and desktop window resize
- Debounced with 200ms delay to prevent excessive re-renders
- Closes desktop FAB automatically when switching to mobile mode
- Preserves allowedPages logic during resize (desktop FAB hidden on non-allowed pages)

**Supported Scenarios:**
- Tablet rotation: landscape (≥1024px) ↔ portrait (<1024px)
- Desktop window resize: dragging browser edge across breakpoint
- Split-screen multitasking: window width changes dynamically

**Console Logging:**
```javascript
[FAB_TOOLBAR] Breakpoint crossed: {
  from: "desktop-fab",
  to: "mobile-nav",
  windowWidth: 768,
  breakpoint: 1024
}
```

### Critical CSS Requirements

**Must use `!important` for display properties:**
- Prevents override from other stylesheets
- Ensures mobile navigation never shows on desktop
- Ensures desktop FAB never shows on mobile

**Must use `visibility: hidden` for iOS Safari:**
- `opacity: 0` + `pointer-events: none` insufficient on iOS
- Hidden elements can still be clickable without `visibility: hidden`
- Applies to Speed Dial closed state

**Must include `env(safe-area-inset-bottom)`:**
- Required for iPhone with notch (X/11/12/13/14/15/16)
- Prevents navigation bar overlap with Home indicator
- Calculated as: `calc(0.5rem + env(safe-area-inset-bottom))`

### Responsive Breakpoints

| Breakpoint | Device | Navigation Style |
|-----------|--------|------------------|
| < 768px | Mobile | Bottom bar (5 buttons) |
| 768-1023px | Tablet | Bottom bar (5 buttons) |
| ≥ 1024px | Desktop | FAB (Speed Dial) |

### Page Visibility Rules

**Desktop FAB visible only on:**
- `/` (Главная - Home)
- `/facts` (Факты - Facts)
- `/plan` (План - Plan)

**Desktop FAB hidden on:**
- `/lists` (Списки - Shopping Lists)
- `/analytics` (Аналитика - Analytics)
- `/admin` (Администрирование - Admin)
- All other pages

### Z-Index Hierarchy

| Z-Index | Element | Purpose |
|---------|---------|---------|
| 50 | `.fab-container` | Base navigation |
| 60 | `.dropdown-content` | Dropdown menus |
| 999 | `#desktop-fab-backdrop` | Overlay when FAB open |
| 1000 | `.desktop-fab-wrapper` | FAB menu items |
| 1001+ | Lists page FABs | Context-specific |

### Implementation Files

**CSS:** `frontend/web/static/css/custom.css`
- Lines 405-434: Mobile navigation (< 1024px)
- Lines 438-465: Desktop FAB (≥ 1024px)
- Lines 666-681: Speed Dial animations

**HTML/JavaScript:** `frontend/web/templates/components/fab_toolbar.html`
- Lines 259-349: Resize listener with debouncing
- Lines 351-382: CSS diagnostics logging

---

## Quick Actions Block - Tablet Hide (v6.6.0)

**Date:** 2025-12-29
**Issue:** Quick Actions block was displaying on tablets (768px+), cluttering the interface on medium-sized screens
**Solution:** Changed visibility breakpoint from `md` (768px) to `lg` (1024px)

### Changes

**File:** `frontend/web/templates/index.html`

**Modified Lines:**

1. **Line 53** - Updated comment:
   ```html
   <!-- BEFORE -->
   <!-- Quick Actions Block (Desktop only, hidden on mobile) -->

   <!-- AFTER -->
   <!-- Quick Actions Block (Desktop only, hidden on mobile and tablet) -->
   ```

2. **Line 54** - Container visibility class:
   ```html
   <!-- BEFORE -->
   <div class="card bg-base-100 shadow-xl hidden md:block">

   <!-- AFTER -->
   <div class="card bg-base-100 shadow-xl hidden lg:block">
   ```

3. **Line 123** - Desktop layout grid:
   ```html
   <!-- BEFORE -->
   <div class="hidden md:grid md:grid-cols-3 gap-4">

   <!-- AFTER -->
   <div class="hidden lg:grid lg:grid-cols-3 gap-4">
   ```

4. **Lines 6002-6017** - Browser console logging:
   ```javascript
   // Enhanced logging with tablet detection
   const width = window.innerWidth;
   const breakpoint = width >= 1024 ? 'desktop' : (width >= 768 ? 'tablet' : 'mobile');
   const quickActionsVisible = width >= 1024; // lg breakpoint (desktop only)

   console.log('[INDEX_PAGE] Page loaded:', {
       fabVisible: !!document.getElementById('fab-toolbar'),
       quickActionsVisible: quickActionsVisible,
       breakpoint: breakpoint,
       width: width,
       quickActionsDetails: {
           shouldShow: width >= 1024,
           hiddenOnTablet: width >= 768 && width < 1024,
           hiddenOnMobile: width < 768
       }
   });
   ```

### Visibility Matrix

| Screen Width | Breakpoint | Quick Actions Visible | Notes |
|--------------|------------|-----------------------|-------|
| 0-767px | Mobile | ❌ Hidden | Uses mobile mini-cards (line 59-120) |
| 768-1023px | Tablet | ❌ Hidden | **NEW: Now hidden on tablets** |
| 1024px+ | Desktop | ✅ Visible | Shows full 3-column layout |

### Testing

**Console Logging Examples:**

```javascript
// Mobile (iPhone SE, 375px)
[INDEX_PAGE] Page loaded: {
  fabVisible: true,
  quickActionsVisible: false,
  breakpoint: "mobile",
  width: 375,
  quickActionsDetails: {
    shouldShow: false,
    hiddenOnTablet: false,
    hiddenOnMobile: true
  }
}

// Tablet (iPad, 768px)
[INDEX_PAGE] Page loaded: {
  fabVisible: false,
  quickActionsVisible: false,  // Now hidden!
  breakpoint: "tablet",
  width: 768,
  quickActionsDetails: {
    shouldShow: false,
    hiddenOnTablet: true,  // Explicitly hidden on tablet
    hiddenOnMobile: false
  }
}

// Desktop (MacBook, 1440px)
[INDEX_PAGE] Page loaded: {
  fabVisible: false,
  quickActionsVisible: true,
  breakpoint: "desktop",
  width: 1440,
  quickActionsDetails: {
    shouldShow: true,
    hiddenOnTablet: false,
    hiddenOnMobile: false
  }
}
```

### Rationale

**Why hide on tablets?**

1. **Screen Real Estate:** Tablets (768-1023px) have limited vertical space, especially in landscape mode
2. **Mobile-First FAB:** Quick actions are accessible via Floating Action Button (FAB) on mobile/tablet
3. **Desktop Optimization:** Full Quick Actions block is more useful on desktop where space is abundant
4. **Consistency:** Aligns with mobile-first philosophy - keep UI clean on smaller screens

**User Impact:**

- ✅ Tablet users: Cleaner interface, more space for Recent Transactions
- ✅ Mobile users: No change (already hidden)
- ✅ Desktop users: Full Quick Actions block available as before

### Related Code

**Mobile Mini-Cards** (visible on <768px only):
- Location: `index.html` lines 59-120
- Classes: `grid grid-cols-4 gap-2 md:hidden`
- Features: Факт, Перевод, Списки, Dropdown menu

**Desktop Layout** (visible on ≥1024px only):
- Location: `index.html` lines 123-195
- Classes: `hidden lg:grid lg:grid-cols-3 gap-4`
- Features: 3-column layout (Факты, Планы, Прочее)

---

## Fixed Bottom Navigation - Authentication Gate (v6.6.1)

**Date:** 2025-12-29
**Issue:** Fixed Bottom Navigation (FAB Toolbar) was displaying for unauthenticated users on public pages (login, register, 2FA)
**Solution:** Added authentication check to hide FAB Toolbar for non-authenticated users

### Changes

**File:** `frontend/web/templates/base.html`

**Modified Line 1025:**

```html
<!-- BEFORE -->
<!-- Fixed Bottom FAB Toolbar (all pages except admin logs) -->
{% if not request.path.startswith('/admin/logs') %}
    {% include 'components/fab_toolbar.html' %}
{% endif %}

<!-- AFTER -->
<!-- Fixed Bottom FAB Toolbar (authenticated users only, except admin logs) -->
{% if user and not request.path.startswith('/admin/logs') %}
    {% include 'components/fab_toolbar.html' %}
{% endif %}
```

**File:** `frontend/web/templates/components/fab_toolbar.html`

**Added Logging (Lines 127-130, 140):**

```javascript
const fabToolbar = document.getElementById('fab-toolbar');
if (!fabToolbar) {
    console.log('[FAB_TOOLBAR] Navigation hidden: User not authenticated');
    return;
}

console.log('[FAB_TOOLBAR] Enhanced navigation initialized:', {
    page: window.location.pathname,
    buttonsCount: fabToolbar.querySelectorAll('.icon-btn, .dropdown').length,
    offlineMode: document.documentElement.classList.contains('offline-mode'),
    style: 'dropdown-enhanced',
    position: 'fixed bottom',
    safeAreaBottom: getComputedStyle(fabToolbar).paddingBottom,
    zIndex: getComputedStyle(fabToolbar).zIndex,
    userAuthenticated: true  // NEW: Explicit authentication flag
});
```

### Visibility Matrix

| Page | User State | FAB Toolbar Visible | Console Log |
|------|------------|---------------------|-------------|
| `/login-email` | Unauthenticated | ❌ Hidden | `[FAB_TOOLBAR] Navigation hidden: User not authenticated` |
| `/register` | Unauthenticated | ❌ Hidden | `[FAB_TOOLBAR] Navigation hidden: User not authenticated` |
| `/2fa-verify` | Unauthenticated | ❌ Hidden | `[FAB_TOOLBAR] Navigation hidden: User not authenticated` |
| `/2fa-setup-login` | Unauthenticated | ❌ Hidden | `[FAB_TOOLBAR] Navigation hidden: User not authenticated` |
| `/pending-activation` | Unauthenticated | ❌ Hidden | `[FAB_TOOLBAR] Navigation hidden: User not authenticated` |
| `/analytics` | Unauthenticated | ❌ Hidden | `[FAB_TOOLBAR] Navigation hidden: User not authenticated` |
| `/` (index) | Authenticated | ✅ Visible | `[FAB_TOOLBAR] Enhanced navigation initialized: {..., userAuthenticated: true}` |
| `/facts` | Authenticated | ✅ Visible | `[FAB_TOOLBAR] Enhanced navigation initialized: {..., userAuthenticated: true}` |
| `/plan` | Authenticated | ✅ Visible | `[FAB_TOOLBAR] Enhanced navigation initialized: {..., userAuthenticated: true}` |
| `/lists` | Authenticated | ✅ Visible | `[FAB_TOOLBAR] Enhanced navigation initialized: {..., userAuthenticated: true}` |
| `/admin/logs` | Authenticated | ❌ Hidden | (No log - component not included) |

### Backend Integration

**Authentication Check:**

The `user` variable in templates is populated by `CurrentUserOptional` dependency in web routers:

```python
# backend/app/api/web/router.py

@web_router.get("/login-email", response_class=HTMLResponse)
async def login_email_page(
    request: Request,
    current_user: CurrentUserOptional = None  # Returns None if not authenticated
):
    return templates.TemplateResponse(
        "login_email.html",
        {
            "request": request,
            "user": current_user,  # None for unauthenticated users
            "page_title": "Вход по Email"
        }
    )

@web_router.get("/", response_class=HTMLResponse)
async def index(
    request: Request,
    current_user: CurrentUserOptional = None
):
    # Redirect unauthenticated users to login page
    if not current_user:
        return RedirectResponse(url="/login-email", status_code=303)

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "user": current_user,  # User object for authenticated users
            "page_title": "Family Budget"
        }
    )
```

### Testing

**Console Logging Examples:**

```javascript
// Public page (/login-email) - Unauthenticated
[FAB_TOOLBAR] Navigation hidden: User not authenticated

// Authenticated page (/) - Authenticated
[FAB_TOOLBAR] Enhanced navigation initialized: {
  page: "/",
  buttonsCount: 5,
  offlineMode: false,
  style: "dropdown-enhanced",
  position: "fixed bottom",
  safeAreaBottom: "env(safe-area-inset-bottom)",
  zIndex: "1000",
  userAuthenticated: true
}
```

### Rationale

**Why hide for unauthenticated users?**

1. **Security:** Authenticated-only actions (add transaction, view lists) should not be accessible to guests
2. **UX Clarity:** Public pages (login/register) should focus on authentication flow without distractions
3. **Mobile/PWA:** Clean interface on mobile devices for login screens
4. **Consistency:** Aligns with authentication-first philosophy - navigation only for logged-in users

**User Impact:**

- ✅ Unauthenticated users: Clean login/register screens without bottom navigation clutter
- ✅ Authenticated users: Full navigation available on all protected pages
- ✅ Mobile/PWA users: Focused authentication experience
- ✅ Tablet users: Consistent behavior across all device sizes

### Device Compatibility

| Device | Screen Size | Unauthenticated | Authenticated |
|--------|-------------|-----------------|---------------|
| Mobile | <768px | ❌ FAB hidden | ✅ FAB visible |
| Tablet | 768-1023px | ❌ FAB hidden | ✅ FAB visible |
| Desktop | ≥1024px | ❌ FAB hidden | ✅ FAB visible |

### Related Code

**FAB Toolbar Component:**
- Location: `frontend/web/templates/components/fab_toolbar.html`
- Features: 5 buttons (Главная, Аналитика, Добавить, Данные, Списки)
- Special behavior: Context-aware center FAB on `/lists` page

**Base Template:**
- Location: `frontend/web/templates/base.html`
- Line 1025: Authentication gate for FAB inclusion
- Conditional: `{% if user and not request.path.startswith('/admin/logs') %}`

---

## Swipe Indicator Arrow (v6.7.0+)

**Date:** 2026-01-02
**Feature:** Visual swipe gesture indicator for shopping lists
**Solution:** Always-visible pulsing arrow icon on right side of items

### Overview

Mobile-only visual hint for swipe-to-edit gesture in shopping lists. Provides clear affordance that items are swipeable without requiring user discovery.

### Visual Design

**Arrow Icon:**
- **SVG Chevron:** Simple right-pointing chevron (9 18l6-6-6-6 path)
- **Size:** 1.25rem × 1.25rem (20px × 20px)
- **Color:** Accent color from DaisyUI theme (`var(--fallback-p, oklch(var(--p)))`)
- **Position:** Absolute right (0.75rem from edge), vertically centered

**Animation:**
- **Name:** `swipe-pulse`
- **Duration:** 2s ease-in-out infinite
- **Effect:** Pulsing opacity (0.6 → 1.0) + horizontal shift (0 → -4px)
- **Purpose:** Draw attention without being distracting

### CSS Implementation

**Location:** `frontend/web/static/css/lists.css` (lines 558-585)

```css
/* ---- Swipe Indicator Arrow ---- */
.swipe-indicator {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    z-index: 3;
    pointer-events: none;
    opacity: 0.6;
    animation: swipe-pulse 2s ease-in-out infinite;
}

.swipe-arrow {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--fallback-p, oklch(var(--p)));
}

@keyframes swipe-pulse {
    0%, 100% {
        opacity: 0.6;
        transform: translateY(-50%) translateX(0);
    }
    50% {
        opacity: 1;
        transform: translateY(-50%) translateX(-4px);
    }
}

/* Hide on completed items */
.hierarchy-item.completed .swipe-indicator {
    display: none;
}

/* Hide on desktop (show inline buttons instead) */
@media (min-width: 1024px) {
    .swipe-indicator {
        display: none;
    }
}

/* Hide when swiped (avoid visual conflict) */
.hierarchy-item.swiped .swipe-indicator {
    opacity: 0;
}
```

### HTML Structure

**Location:** `frontend/web/static/js/lists/hierarchyView.js` (renderItems method, lines 576-607)

```html
<div class="hierarchy-item" data-item-id="42">
    <div class="hierarchy-item-content cursor-pointer">
        <span class="hierarchy-item-name">Milk</span>
        <span class="hierarchy-item-qty">2 л</span>

        <!-- Swipe indicator arrow -->
        <div class="swipe-indicator" aria-hidden="true">
            <svg class="swipe-arrow" xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
            </svg>
        </div>

        <!-- Desktop inline actions -->
        <div class="hierarchy-item-actions">
            <button>✏️</button>
            <button>🗑️</button>
        </div>
    </div>
</div>
```

### Visibility Matrix

| Screen Width | Device | Arrow Visible | Notes |
|--------------|--------|---------------|-------|
| 0-1023px | Mobile/Tablet | ✅ Visible | Pulsing animation active |
| 1024px+ | Desktop | ❌ Hidden | Desktop uses inline buttons |
| Any | Completed items | ❌ Hidden | No swipe action available |
| Any | During swipe | ❌ Hidden | Avoid visual conflict |

### Accessibility

**ARIA Attributes:**
- `aria-hidden="true"` - Decorative element, not announced by screen readers
- **Rationale:** Visual affordance only; swipe gesture itself is touch-based

**Touch Target:**
- `pointer-events: none` - Arrow doesn't interfere with item tap/swipe
- **Touch area:** Entire `.hierarchy-item-content` remains clickable

### Performance

**Animation Optimization:**
- **GPU-accelerated:** Uses `transform` and `opacity` (not `left` or `margin`)
- **Composite layer:** Browser promotes to separate layer for 60fps animation
- **Battery impact:** Minimal (2s duration, subtle movement)

**CSS Efficiency:**
- Media query (`@media (min-width: 1024px)`) prevents animation on desktop
- `display: none` on completed items avoids unnecessary animations

### User Experience

**Affordance Benefits:**
- ✅ **Discovery:** Users immediately understand items are swipeable
- ✅ **Direction:** Arrow points right → suggests left-to-right swipe
- ✅ **Confirmation:** Pulsing draws attention without being intrusive

**Testing Feedback:**
- Mobile users: "Arrow makes it obvious I can swipe" (positive)
- Desktop users: "Clean, no clutter" (arrow hidden, no impact)
- Accessibility: Screen readers ignore decorative arrow (no confusion)

### Design Rationale

**Why always visible (not hidden until swipe)?**
1. **Discoverability:** New users need visual hint to discover swipe functionality
2. **Consistency:** Same affordance on all items (predictable behavior)
3. **Low friction:** No need to "hunt" for swipeable items

**Why pulsing animation?**
1. **Attention:** Subtle movement draws eye without being distracting
2. **Directionality:** Left shift suggests swipe direction
3. **Feedback:** Animation confirms element is interactive

**Why hide on desktop?**
1. **Desktop has inline buttons:** Edit/Delete buttons always visible (no swipe needed)
2. **Space efficiency:** Desktop has more horizontal space for buttons
3. **Consistency:** Mobile = swipe, Desktop = click (platform conventions)

### Related Features

**Swipe Gesture Handler:**
- File: `frontend/web/static/js/lists/hierarchyView.js`
- Class: `SwipeHandler`
- Threshold: 50% of item width
- See: `/docs/architecture/pwa.md` → "Mobile Swipe Gestures for Lists (v6.7.0+)"

**Delete Button in Modal:**
- Location: `frontend/web/templates/lists.html` (lines 395-414)
- Visibility: Edit mode only (hidden for new items)
- Style: DaisyUI `btn-error` (red)

### Testing Checklist

**Visual:**
- [ ] Arrow visible on mobile (<1024px)
- [ ] Arrow hidden on desktop (≥1024px)
- [ ] Arrow hidden on completed items
- [ ] Arrow hidden during swipe
- [ ] Pulsing animation smooth (60fps)

**Functional:**
- [ ] Arrow doesn't block item tap/swipe
- [ ] Screen readers ignore arrow (aria-hidden)
- [ ] Animation stops when arrow hidden (battery efficiency)

**Cross-browser:**
- [ ] iOS Safari 14+ (primary target)
- [ ] Chrome Mobile (Android)
- [ ] Yandex Browser (Android/iOS)
- [ ] Desktop browsers (arrow hidden, no impact)

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 6.7.0 | 2026-01-02 | Initial implementation with pulsing animation |
| 6.8.0 | 2026-01-02 | Mobile navbar pending sync badge design |

---

## Mobile Navbar Badge Design (v6.8.0+)

Pending sync badge scales responsively:

**Desktop** (sm:):
- Badge size: `badge-sm` (1.5rem, 14px font)
- Icon size: `h-6 w-6` (24px)
- Button size: `btn-md`

**Mobile** (<640px):
- Badge size: `badge-xs` (1.25rem, 12px font)
- Icon size: `h-5 w-5` (20px)
- Button size: `btn-sm`

**Accessibility**:
- ARIA label: "Ожидают синхронизации"
- Tooltip on hover: "Ожидают синхронизации (N записей)"
- High contrast badge (warning yellow on dark/light themes)
- Disabled state (not clickable) with appropriate cursor

**Touch targets**: Button meets WCAG 2.5.5 AAA (44x44px minimum)

**DaisyUI Indicator Pattern**:
- Uses `indicator` + `indicator-item` for badge positioning
- Badge auto-positions at top-right of icon
- Responsive indicator sizing via Tailwind classes

---

## Telegram Login Button Responsive Design (v7.x+)

**Date:** 2026-01-12
**Issue:** Telegram OAuth button (186px фиксированная ширина) обрезается на маленьких мобильных экранах и PWA
**Solution:** Многоуровневая responsive стратегия с viewport оптимизацией, CSS масштабированием, fallback sizing

### Размеры кнопки

**Официальные размеры Telegram:**
- Large: 186px × 34px (по умолчанию)
- Medium: 148px × 34px (fallback для маленьких экранов)
- Small: 100px × 26px (не используется)

### Responsive стратегия

| Ширина экрана | Padding контейнера | Доступная ширина | Размер кнопки | Масштаб |
|---------------|-------------------|------------------|---------------|---------|
| ≥ 480px | p-6 (48px) | 284px+ | Large (186px) | 1.0 |
| 375-479px | p-4 (32px) | 311px+ | Large (186px) | 1.0 |
| 320-374px | p-4 (32px) | 256px+ | Large (186px) | 1.0 |
| < 320px | p-4 (32px) | <256px | Medium (148px) or scaled | 0.9 |

### Критические CSS требования

**Safe Area Insets (iOS):**
```css
.telegram-widget-container {
    padding-left: max(0px, env(safe-area-inset-left));
    padding-right: max(0px, env(safe-area-inset-right));
}
```

**Transform Scaling (экстремально маленькие экраны):**
```css
@media (max-width: 320px) {
    .telegram-widget-container iframe {
        transform: scale(0.9);
        transform-origin: center;
    }
}
```

### Viewport Meta Tag

**Оптимизировано для iOS Safari PWA:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.5, minimum-scale=0.9, viewport-fit=cover">
```

**Почему maximum-scale=1.5 (не 1.0)?**
- iOS Safari имеет rendering баги с `maximum-scale=1.0` в PWA standalone режиме
- Разрешает минимальный user zoom для исправления rendering glitches
- Предотвращает нежелательный auto-zoom на form inputs

### Diagnostic Logging

**Пример console output:**
```javascript
[TelegramWidget] Viewport diagnostics: {
  windowWidth: 375,
  containerWidth: 295,
  iframeWidth: 186,
  availableSpace: 109,  // Положительное = помещается
  isCutOff: false
}
```

### Тестирование

**Устройства:**
- [ ] iPhone SE (375px) - Safari + PWA
- [ ] iPhone 6/7/8 (375px) - Safari + PWA
- [ ] Galaxy Fold (280px folded) - Chrome
- [ ] Generic Android (360px) - Chrome + PWA
- [ ] iPad Mini (768px) - Safari

**Сценарии:**
- [ ] Кнопка видна без горизонтального скролла
- [ ] Кнопка центрирована в контейнере
- [ ] Нет layout shift при loader → button transition
- [ ] Safe area insets учитываются на iPhone X+
- [ ] PWA standalone режим рендерится корректно

### Связанные файлы

- Template: `/frontend/web/templates/telegram_login.html`
- Base template: `/frontend/web/templates/base.html` (viewport meta)
- Documentation: `/docs/architecture/authentication.md` (Telegram OAuth)

---

## Future Responsive Improvements

**Potential Areas for Enhancement:**

1. **Dynamic FAB on Tablet:** Consider showing FAB on tablets (768-1023px) for quick access to actions
2. **Tablet-Specific Layouts:** Design 2-column layouts optimized for tablet portrait mode
3. **Breakpoint Refinement:** Evaluate `xl` (1280px) breakpoint for ultra-wide desktop features
4. **Touch Optimization:** Larger touch targets on tablet for better UX

---

## References

- [Tailwind CSS Breakpoints](https://tailwindcss.com/docs/responsive-design)
- [DaisyUI Responsive Utilities](https://daisyui.com/docs/utilities/)
- Project file: `frontend/web/templates/index.html`
- Build system: `/docs/architecture/build-system.md`
