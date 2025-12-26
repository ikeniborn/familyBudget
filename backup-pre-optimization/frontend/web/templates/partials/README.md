# HTMX Partials Templates

This directory is intended for Jinja2 templates that render HTML fragments for HTMX endpoints.

## Planned Structure

```
partials/
├── quick_stats.html       # Dashboard quick stats widget
├── account_balances.html  # Account balances widget
└── recent_transactions.html # Recent transactions list
```

## Usage Pattern

Backend endpoints in `backend/app/api/v1/analytics.py` should render these templates:

```python
from fastapi.templating import Jinja2Templates
from pathlib import Path

TEMPLATE_DIR = Path(__file__).parent.parent.parent.parent.parent / "frontend/web/templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

@router.get("/quick-stats-html")
async def get_quick_stats_html(request: Request, ...):
    stats_data = await compute_stats(...)
    return templates.TemplateResponse(
        "partials/quick_stats.html",
        {"request": request, "stats": stats_data}
    )
```

## Migration Plan

1. Create template file in this directory
2. Move HTML from f-strings in Python to template
3. Pass computed data as template context
4. Test rendering matches original output

## Status

- [x] quick_stats.html - Complex responsive grid with 5 breakpoints
- [x] account_balances.html - Balance formatting with mobile/desktop values
- [x] recent_transactions.html - Desktop table + mobile list view

## Custom Jinja2 Filters

Filters are registered in `backend/app/utils/template_filters.py`:

| Filter | Description | Example |
|--------|-------------|---------|
| `format_money_mobile` | k/M abbreviations | "125k", "1.5M" |
| `format_money_desktop` | Space separators | "125 000" |
| `format_pct` | Percentage | "85%" |
| `balance_color` | CSS class for sign | "text-success" |
| `amount_color` | CSS class for type | "text-error font-bold" |
| `format_money_recent` | +/- sign by type | "+1 234", "-500" |
| `format_date_full` | DD.MM.YYYY | "15.12.2024" |
| `format_date_short` | DD.MM | "15.12" |

## Migration from f-strings (TODO)

Current backend endpoints use f-string HTML generation. Migration to templates requires:

### Step 1: Update endpoint signature
```python
# Before
@router.get("/quick-stats-html", response_class=HTMLResponse)
async def get_quick_stats_html(...) -> str:

# After
from starlette.requests import Request
@router.get("/quick-stats-html")
async def get_quick_stats_html(request: Request, ...):
```

### Step 2: Prepare template data
```python
stats = [
    {"icon": "💰", "title": "Доходы", "plan": month_plan_income, "fact": month_income, ...},
    {"icon": "💸", "title": "Расходы", "plan": month_plan_expense, "fact": month_expense, ...},
]
```

### Step 3: Return TemplateResponse
```python
from backend.app.main import templates
return templates.TemplateResponse(
    "partials/quick_stats.html",
    {"request": request, "stats": stats}
)
```

**Note:** Templates are ready, migration postponed to reduce risk.
