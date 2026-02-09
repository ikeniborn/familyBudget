# Z-Index Layering System

## Overview
Centralized reference for all z-index values in Family Budget app.
Uses CSS custom properties (variables) for maintainability.

## Complete Hierarchy (13 Layers)

| Layer | CSS Variable | Value | Components | Use Cases |
|-------|--------------|-------|-----------|-----------|
| Admin Overlays | --z-admin | 99999 | Loading overlay, admin modals | Emergency UI |
| Autocomplete | --z-autocomplete | 9999 | Choices.js dropdown, Calendar | Form inputs |
| Calendar Modal | --z-calendar-modal | 2000 | Flatpickr (modal context) | Date pickers in modals |
| Dialog Modals | --z-dialog | 1050 | DaisyUI .dialog, .modal | Confirmation prompts |
| Lists FAB Menu | --z-fab-lists | 1001-1003 | Lists page FAB buttons | Context actions |
| Desktop FAB | --z-fab-desktop | 1002 | .fab-wrapper | Main actions (≥1024px) |
| FAB Backdrop | --z-fab-backdrop | 1000 | .fab-common-backdrop | Desktop FAB overlay |
| Toast Backdrop | --z-toast | 1000 | Toast notifications | User feedback |
| Modal Backdrops | --z-modal-backdrop | 999 | .modal-backdrop, cookie consent | Overlay dimming |
| Standard Modals | --z-modal | 900 | Generic modals | Content overlays |
| Dropdown Menus | --z-dropdown | 60 | DaisyUI dropdowns | Navigation menus |
| Mobile Navbar | --z-navbar | 50 | .fab-container | Bottom navigation |
| Mobile FAB | --z-fab-mobile | 40 | .fab-wrapper | Action button (<1024px) |
| Base Content | --z-base | 1 | Regular content | Default layer |

## Component Details

### FAB Navigation System (3 Components)

#### Mobile FAB (.fab-wrapper)
- **CSS Variable:** `var(--z-fab-mobile)`
- **Value:** 40
- **Breakpoint:** < 1024px
- **Position:** Bottom-right, above navbar
- **File:** `custom.css` lines 387-389
- **Rationale:** Below mobile navbar (50) to prevent navbar occlusion

#### Desktop FAB (.fab-wrapper)
- **CSS Variable:** `var(--z-fab-desktop)`
- **Value:** 1002 (FIXED: was 1000, updated in v11.4.13)
- **Breakpoint:** ≥ 1024px
- **Position:** Bottom-right corner
- **File:** `custom.css` line 963, `z-index-variables.css` line 37
- **Rationale:** Above FAB backdrop (1000) but below modal backdrop (999). Prevents FAB being clickable over modals.
- **Critical Fix:** Z-index conflict with modal backdrop (999) resolved. FAB now correctly positioned below modal layer.

#### Lists FAB (.lists-fab-menu)
- **CSS Variable:** `var(--z-fab-lists)`
- **Value:** 1001 (menu), 1003 (main button)
- **Context:** /lists page only
- **File:** `fab_buttons.html` lines 20-81
- **Rationale:** Slightly above desktop FAB for page-specific priority

#### FAB Common System (.fab-common-* v11.4.13+)
- **Purpose:** Standardized FAB design for /, /facts, /plan pages
- **Components:**
  - `.fab-common-wrapper` - Main container (z-index: var(--z-fab-desktop))
  - `.fab-common-main-btn` - Primary action button (adaptive 48→56→64px)
  - `.fab-common-action-btn` - Speed Dial menu items
  - `.fab-common-backdrop` - Semi-transparent overlay (z-index: 1000)
- **Features:**
  - Adaptive sizing: 48px mobile, 56px desktop, 64px XL
  - Speed Dial animations with staggered cascade (0.05s, 0.1s delays)
  - Backdrop overlay with 0.3s opacity transition
  - Main button 90° rotation on open
  - Badge labels (desktop only, hidden on mobile)
- **File:** `custom.css` lines ~989-1200
- **Migration:** Replaced hardcoded desktop-fab-wrapper styles, added backdrop support

### Modal System

**Dialog Modals** (--z-dialog: 1050)
- DaisyUI `.dialog` and `.modal` components
- Higher than standard modals for critical prompts
- Use `!important` to override inline styles

**Standard Modals** (--z-modal: 900)
- Generic modal overlays
- Below dialog modals (1050)
- Above navigation (60)

**Modal Backdrops** (--z-modal-backdrop: 999)
- Dimming overlay behind modals
- Between desktop FAB (1000) and standard modals (900)
- Ensures backdrops never obscure active modals

### Autocomplete & Dropdowns

**Autocomplete** (--z-autocomplete: 9999)
- Choices.js dropdown, Flatpickr calendar
- Highest non-admin z-index
- Must be above all modals to prevent clipping

**Dropdown Menus** (--z-dropdown: 60)
- DaisyUI dropdown components
- Above mobile navbar (50)
- Below modals (900)

## CSS Variables Reference

**Location:** `frontend/web/static/css/z-index-variables.css`

```css
:root {
  /* Admin Layer */
  --z-admin: 99999;

  /* Form Controls */
  --z-autocomplete: 9999;
  --z-calendar-modal: 2000;

  /* Modals */
  --z-dialog: 1050;
  --z-modal-backdrop: 999;
  --z-modal: 900;

  /* FAB System */
  --z-fab-lists: 1003;
  --z-fab-lists-menu: 1001;
  --z-fab-desktop: 1002;
  --z-fab-backdrop: 1000;
  --z-fab-mobile: 40;

  /* Toast */
  --z-toast: 1000;

  /* Navigation */
  --z-dropdown: 60;
  --z-navbar: 50;

  /* Base */
  --z-base: 1;
}
```

**Usage Example:**
```css
.desktop-fab-wrapper {
  z-index: var(--z-fab-desktop); /* 1000 */
}
```

## Design Principles

### 1. Responsive Breakpoint Separation
- Mobile FAB (40) vs Desktop FAB (1000) prevents conflicts
- Media query at 1024px switches z-index contexts

### 2. Modal Priority Stacking
- Dialog modals (1050) > Desktop FAB (1000) > Modal backdrop (999)
- Ensures critical prompts always visible

### 3. Context-Specific Layering
- Lists FAB (1001-1003) slightly above desktop FAB (1000)
- Page-specific components get higher priority

### 4. Admin Override
- Admin overlays (99999) trump all user UI
- Emergency state handling

### 5. Consistency via CSS Variables
- Single source of truth in `z-index-variables.css`
- Easy to update, prevents drift

## Migration from Hardcoded Values

**Before (hardcoded):**
```css
.desktop-fab-wrapper {
  z-index: 1000;
}
```

**After (CSS variables):**
```css
.desktop-fab-wrapper {
  z-index: var(--z-fab-desktop);
}
```

**Benefits:**
- Centralized updates (change once, apply everywhere)
- Self-documenting (variable names explain purpose)
- Prevents accidental conflicts

## Deprecated Components

### ⚠️ .mobile-fab-wrapper (z-index: 998)
- **Status:** REMOVED in v11.0 (this update)
- **Replaced by:** `.fab-wrapper` (z-index: 40)
- **File:** `custom.css` lines 736-852 (DELETED)
- **Reason:** Restructured FAB system in v7.x, old class no longer used
- **Migration:** Use `.fab-wrapper` for mobile FAB (< 1024px)

## Troubleshooting

### FAB Hidden Behind Modal
**Symptom:** Desktop FAB not visible when modal open

**Check:**
1. Modal backdrop z-index = 999 (should be BELOW FAB at 1000)
2. Desktop FAB using `var(--z-fab-desktop)` (not hardcoded 998)
3. No conflicting `!important` rules

**Fix:** Ensure modal backdrop uses `--z-modal-backdrop: 999`

### Dropdown Cut Off by Navbar
**Symptom:** Dropdown menu hidden behind mobile navbar

**Check:**
1. Dropdown z-index = 60 (should be ABOVE navbar at 50)
2. Navbar using `var(--z-navbar): 50`

**Fix:** Ensure dropdown uses `--z-dropdown: 60`

### Calendar Widget Hidden in Modal
**Symptom:** Flatpickr calendar clipped by modal boundaries

**Check:**
1. Calendar z-index = 9999 (autocomplete layer)
2. Modal context calendar = 2000 (calendar-modal layer)

**Fix:** Use `--z-calendar-modal: 2000` for modals, `--z-autocomplete: 9999` for regular pages

### Autocomplete Dropdown Behind Everything
**Symptom:** Choices.js dropdown not visible

**Check:**
1. Autocomplete z-index = 9999 (highest non-admin)
2. Container has `position: relative` (establishes stacking context)

**Fix:** Ensure parent container doesn't create new stacking context with lower z-index

## Testing Checklist

**Cross-Browser (Chrome, Safari, Firefox, Edge):**
- [ ] Mobile FAB visible above navbar on < 1024px
- [ ] Desktop FAB visible above modal backdrop on ≥ 1024px
- [ ] Lists FAB menu opens without overlap issues
- [ ] Modals appear above FAB when open
- [ ] Dropdown menus not clipped by navbar
- [ ] Calendar widget visible in modals
- [ ] Autocomplete dropdown appears above all content
- [ ] Toast notifications visible

**Responsive Breakpoints:**
- [ ] FAB z-index switches at 1024px (40 → 1000)
- [ ] No overlap at exactly 1024px width
- [ ] iPad landscape (1024px) behaves as desktop
- [ ] Mobile portrait/landscape correct stacking

**Edge Cases:**
- [ ] Multiple modals stacked correctly
- [ ] FAB + modal + dropdown all visible simultaneously
- [ ] Admin overlay appears above everything
- [ ] Page transitions don't cause z-index conflicts

## Implementation Files

**CSS Variables:**
- `frontend/web/static/css/z-index-variables.css`

**Updated Files:**
- `frontend/web/static/css/custom.css` (FAB system)
- `frontend/web/static/css/daisyui-overrides.css` (modals, dropdowns)
- `frontend/web/static/css/lists.css` (autocomplete)
- `frontend/web/static/css/calendar-widget.css` (calendar)
- `frontend/web/templates/components/fab_buttons.html` (lists FAB)
- `frontend/web/templates/base.html` (include z-index-variables.css)

## References
- **Implementation:** custom.css, fab_buttons.html
- **Responsive behavior:** /docs/architecture/frontend/responsive-design.md
- **Mobile patterns:** /docs/architecture/pwa.md
- **Component architecture:** /docs/architecture/frontend/modal-architecture.md
