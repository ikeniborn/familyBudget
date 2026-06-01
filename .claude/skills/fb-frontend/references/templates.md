# Jinja2 Template Patterns

## Base Template Structure

All pages extend `base.html`. Key blocks available:

| Block | Purpose |
|-------|---------|
| `title` | `<title>` content |
| `head_extra` | Extra `<link>` tags in `<head>` |
| `content` | Main page body |
| `scripts` | JS `<script>` tags at bottom |

```jinja2
{% extends "base.html" %}

{% block title %}Page Name{% endblock %}

{% block head_extra %}
<link rel="stylesheet" href="{{ url_for('static', path='css/feature.min.css') }}?v=PLACEHOLDER">
{% endblock %}

{% block content %}
<!-- page body here -->
{% endblock %}

{% block scripts %}
<script src="{{ url_for('static', path='js/feature.min.js') }}?v=PLACEHOLDER"></script>
{% endblock %}
```

---

## DaisyUI Modal with Tabs

Use this pattern for create/edit modals with multiple sections. See `components/modal_fact.html` as the canonical example.

```html
<!-- In templates/components/modal_myfeature.html -->
{% macro modal_myfeature(modal_id='modal_myfeature') %}
<dialog id="{{ modal_id }}" class="modal">
    <div class="modal-box w-11/12 max-w-2xl">

        <!-- Close button -->
        <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>

        <!-- Title -->
        <h3 class="font-bold text-lg mb-4" id="{{ modal_id }}_title">Add Item</h3>

        <!-- Tab switchers (radio-based, no JS needed for switching) -->
        <div role="tablist" class="tabs tabs-boxed mb-4">
            <input type="radio" name="{{ modal_id }}_tabs" role="tab"
                   class="tab" aria-label="General" checked />
            <div role="tabpanel" class="tab-content pt-4">
                <!-- General tab content -->
                <div class="form-control mb-3">
                    <label class="label"><span class="label-text">Name</span></label>
                    <input type="text" id="{{ modal_id }}_name"
                           class="input input-bordered w-full" />
                </div>
            </div>

            <input type="radio" name="{{ modal_id }}_tabs" role="tab"
                   class="tab" aria-label="Advanced" />
            <div role="tabpanel" class="tab-content pt-4">
                <!-- Advanced tab content -->
            </div>
        </div>

        <!-- Hidden field to track editing state -->
        <input type="hidden" id="{{ modal_id }}_item_id" value="" />

        <!-- Footer actions -->
        <div class="modal-action">
            <button onclick="MyFeatureManager.saveItem()"
                    class="btn btn-primary" id="{{ modal_id }}_save_btn">
                Save
            </button>
            <form method="dialog">
                <button class="btn btn-ghost">Cancel</button>
            </form>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
{% endmacro %}
```

Include in page template:
```jinja2
{% from "components/modal_myfeature.html" import modal_myfeature %}
...
{{ modal_myfeature() }}
```

Open/close from JS:
```typescript
// Open
(document.getElementById('modal_myfeature') as HTMLDialogElement).showModal();
// Close
(document.getElementById('modal_myfeature') as HTMLDialogElement).close();
```

---

## Confirm Modal

Standard confirmation dialog used across the project. Always include on pages with delete actions.

```jinja2
{% from "components/confirm_modal.html" import confirm_modal %}
{{ confirm_modal() }}
```

Trigger from JS:
```typescript
// utils/confirmModal.ts pattern
export function showConfirmModal(
    message: string,
    onConfirm: () => void
): void {
    const modal = document.getElementById('confirm_modal') as HTMLDialogElement;
    const msgEl = document.getElementById('confirm_modal_message');
    const confirmBtn = document.getElementById('confirm_modal_confirm');

    if (msgEl) msgEl.textContent = message;
    if (confirmBtn) {
        confirmBtn.onclick = () => { modal.close(); onConfirm(); };
    }
    modal.showModal();
}
```

---

## Filters Section Pattern

Collapsible filter panel used on facts, plan, dashboard:

```html
<div class="collapse collapse-arrow bg-base-200 rounded-box">
    <input type="checkbox" id="filters-toggle" class="peer" />
    <label for="filters-toggle"
           class="collapse-title text-base font-medium cursor-pointer select-none">
        Filters
    </label>
    <div class="collapse-content">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">

            <!-- Date range -->
            <div class="form-control">
                <label class="label"><span class="label-text">From</span></label>
                <input type="date" id="filter-date-from" class="input input-bordered input-sm" />
            </div>
            <div class="form-control">
                <label class="label"><span class="label-text">To</span></label>
                <input type="date" id="filter-date-to" class="input input-bordered input-sm" />
            </div>

            <!-- Dropdown (Choices.js) -->
            <div class="form-control">
                <label class="label"><span class="label-text">User</span></label>
                <select id="filter-user" class="select select-bordered select-sm w-full"></select>
            </div>

        </div>

        <div class="flex gap-2 mt-4">
            <button data-action="apply-filters" class="btn btn-primary btn-sm">Apply</button>
            <button data-action="reset-filters" class="btn btn-ghost btn-sm">Reset</button>
        </div>
    </div>
</div>
```

---

## Stats Bar Pattern

DaisyUI stats used for summary numbers:

```html
<div class="stats stats-horizontal shadow w-full overflow-x-auto">
    <div class="stat">
        <div class="stat-title">Total</div>
        <div class="stat-value text-primary" id="stat-total">—</div>
        <div class="stat-desc" id="stat-total-desc"></div>
    </div>
    <div class="stat">
        <div class="stat-title">Count</div>
        <div class="stat-value" id="stat-count">—</div>
    </div>
</div>
```

Populate from JS:
```typescript
const totalEl = document.getElementById('stat-total');
if (totalEl) totalEl.textContent = formatCurrency(stats.total);
```

---

## Empty State Pattern

```jinja2
{% from "components/shared/empty_state.html" import empty_state %}
{{ empty_state(
    container_id='items-empty',
    icon='📭',
    title='No items yet',
    description='Add your first item to get started'
) }}
```

Toggle visibility from JS:
```typescript
const empty = document.getElementById('items-empty');
const table = document.getElementById('items-table');
if (items.length === 0) {
    empty?.classList.remove('hidden');
    table?.classList.add('hidden');
} else {
    empty?.classList.add('hidden');
    table?.classList.remove('hidden');
}
```
