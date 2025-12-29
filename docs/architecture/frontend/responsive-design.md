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
