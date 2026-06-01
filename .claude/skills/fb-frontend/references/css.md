# CSS Patterns

## Load Order (fixed — don't change)

```html
<!-- In base.html — order is critical -->
<link rel="stylesheet" href="tailwind-daisyui.min.css">     <!-- 1. Tailwind + DaisyUI -->
<link rel="stylesheet" href="daisyui-overrides.min.css">    <!-- 2. Conflict fixes -->
<link rel="stylesheet" href="custom.min.css">               <!-- 3. Project styles -->
<!-- 4. Feature CSS (page-specific only) -->
<link rel="stylesheet" href="plan.min.css">
```

Changing this order breaks DaisyUI component overrides.

---

## Custom Class Prefix: `fb-`

Project-specific utility classes are defined in `daisyui-overrides.css` with `fb-` prefix:

| Class | Purpose |
|-------|---------|
| `fb-loading-text` | Loading state text |
| `fb-loading-dots` | Animated dots |
| `fb-loading-overlay` | Full-element overlay during async ops |
| `fb-icon-primary` | SVG icon color helper |
| `fb-icon-success` | SVG icon color helper |
| `fb-dropdown-z-high` | Z-index fix for dropdowns inside modals |

Add new `fb-*` classes to `daisyui-overrides.css`, not `custom.css`.

---

## Dynamic Classes → safelist

If you add a Tailwind class via `classList.add('text-red-500')`, Tailwind's purge won't find it in templates. Add it to `config/tailwind.config.js`:

```javascript
// config/tailwind.config.js
module.exports = {
    safelist: [
        'text-red-500',
        'text-green-500',
        'bg-warning',
        'border-error',
        // add dynamic classes here
    ],
    // ...
}
```

After editing `tailwind.config.js`, rebuild CSS: `npm run build:css`.

---

## Responsive Design

Mobile-first. Test in order: 375px → 768px → 1280px.

Standard grid:
```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

Table overflow on mobile:
```html
<div class="overflow-x-auto">
    <table class="table table-zebra w-full">...
```

Hide/show per breakpoint:
```html
<span class="hidden sm:inline">Desktop label</span>
<span class="sm:hidden">Mobile label</span>
```

---

## DaisyUI Component Reference

Most-used components in this project:

| Need | DaisyUI class |
|------|--------------|
| Primary button | `btn btn-primary` |
| Ghost button | `btn btn-ghost` |
| Small button | `btn btn-sm` |
| Text input | `input input-bordered` |
| Select | `select select-bordered` |
| Checkbox | `checkbox` |
| Modal | `modal` + `modal-box` |
| Loading spinner | `loading loading-spinner` |
| Stats block | `stats` + `stat` |
| Collapse | `collapse collapse-arrow` |
| Table | `table table-zebra` |
| Badge | `badge badge-primary` |
| Alert | `alert alert-warning` |

Theme colors (use semantic names, not hex):
- `bg-primary`, `text-primary`
- `bg-base-100`, `bg-base-200`, `bg-base-300`
- `text-base-content`, `text-base-content/70`

---

## Feature CSS File

When a feature needs styles beyond Tailwind:

1. Create `frontend/web/static/css/[feature].css`
2. Add to `package.json`:
   ```json
   "minify:[feature]": "postcss frontend/web/static/css/[feature].css -o frontend/web/static/css/[feature].min.css -u cssnano"
   ```
3. Add to `build:css` script chain
4. Include in template `head_extra` block (after `custom.min.css`)

`.min.css` files are `.gitignore`d — generated at build time, never committed.

---

## DaisyUI Override Pattern

When DaisyUI's `.loading` class conflicts with your custom loading state:

```css
/* daisyui-overrides.css */
/* Reset DaisyUI spinner behavior for specific elements */
.nav-item.loading,
.icon-btn.loading {
    pointer-events: auto !important;
    display: flex !important;
    animation: none !important;
    background-image: none !important;
}
```

Don't fight DaisyUI globally — only override specific compound selectors.
