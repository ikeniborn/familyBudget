# Adding a New Page / Feature Bundle

## Checklist

1. [ ] Create feature folder under `frontend/web/static/js/[feature]/`
2. [ ] Register bundle in `build-all.js`
3. [ ] Create Jinja2 template
4. [ ] Add FastAPI route
5. [ ] Wire up CSS (if feature needs its own)

---

## Step 1 — Create Feature Folder

Minimum required files:

```
js/[feature]/
├── index.ts              ← entry point
├── core/
│   ├── [Feature]State.ts
│   └── stateManager.ts
├── operations/
│   └── [feature]Controller.ts
├── integration/
│   └── [feature]API.ts
├── adapters/
│   ├── windowExports.ts
│   └── eventDelegation.ts
└── types/
    ├── models.ts
    └── globals.d.ts
```

Copy structure from `frontend/web/static/js/facts/` — it's the canonical example.

---

## Step 2 — Register Bundle in build-all.js

Open `build-all.js` and add an entry to the bundles array:

```javascript
// In the BUNDLES array:
{
    name: 'myfeature',
    input: 'frontend/web/static/js/myfeature/index.ts',
    output: 'frontend/web/static/js/myfeature.min.js',
    globalName: 'MyFeatureApp'
}
```

`globalName` becomes the IIFE wrapper name — pick something unique that won't clash with other globals.

Rebuild:
```bash
npm run bundle
# or just this bundle:
BUNDLE_FILTER=myfeature npm run bundle
```

---

## Step 3 — Jinja2 Template

Create `frontend/web/templates/myfeature.html`:

```jinja2
{% extends "base.html" %}
{% from "components/confirm_modal.html" import confirm_modal %}

{% block title %}My Feature{% endblock %}

{% block content %}
<div class="container mx-auto px-4 py-6 space-y-6">

    <!-- Page header -->
    <div class="flex items-center justify-between flex-wrap gap-4">
        <h1 class="text-2xl font-bold">My Feature</h1>
        <button data-action="add-item" class="btn btn-primary">
            <svg .../>Add
        </button>
    </div>

    <!-- Dynamic content container (populated by JS) -->
    <div id="items-container" class="min-h-[200px]">
        <div class="text-center py-12">
            <span class="loading loading-spinner loading-lg"></span>
        </div>
    </div>

</div>

{{ confirm_modal() }}
{% endblock %}

{% block scripts %}
<script src="{{ url_for('static', path='js/myfeature.min.js') }}?v=PLACEHOLDER"></script>
{% endblock %}
```

The `?v=PLACEHOLDER` token is replaced by CI with the real version hash for cache busting.

---

## Step 4 — FastAPI Route

Add to `backend/app/api/web/endpoints/`:

```python
# backend/app/api/web/endpoints/myfeature.py
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="frontend/web/templates")

@router.get("/myfeature", response_class=HTMLResponse)
async def myfeature_page(request: Request):
    return templates.TemplateResponse(
        "myfeature.html",
        {"request": request}
    )
```

Register in `backend/app/api/web/router.py`:
```python
from .endpoints import myfeature
router.include_router(myfeature.router, tags=["pages"])
```

---

## Step 5 — Feature CSS (optional)

Only if the feature has styles beyond Tailwind utilities:

1. Create `frontend/web/static/css/myfeature.css`
2. Add minify script to `package.json`:
   ```json
   "minify:myfeature": "postcss frontend/web/static/css/myfeature.css -o frontend/web/static/css/myfeature.min.css -u cssnano"
   ```
3. Add `<link>` in `myfeature.html` (after `custom.min.css`):
   ```html
   <link rel="stylesheet" href="{{ url_for('static', path='css/myfeature.min.css') }}?v=PLACEHOLDER">
   ```

---

## Bundle Troubleshooting

**`window.MyFeatureApp` is undefined after load:**
- Check `globalName` in `build-all.js` matches what you're calling
- Verify `myfeature.min.js` loaded (check Network tab)

**Changes not reflected after `npm run bundle`:**
- You edited an imported module, not the entry file
- Fix: `FORCE_REBUILD=true npm run bundle`

**TypeScript errors blocking commit:**
- Pre-commit hook runs `npm run type-check` automatically
- Fix all errors before committing; bypass only for WIP: `SKIP_TESTS=1 git commit`
