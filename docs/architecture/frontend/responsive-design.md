# Responsive Design Changes

This document tracks all responsive design modifications and breakpoint adjustments in the Family Budget application.

## Table of Contents

1. [Breakpoint Strategy](#breakpoint-strategy)
2. [Quick Actions Block - Tablet Hide (v6.6.0)](#quick-actions-block---tablet-hide-v660)

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
