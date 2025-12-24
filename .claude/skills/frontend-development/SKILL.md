---
name: Frontend Development
description: Автоматизация создания frontend компонентов (HTMX + Tailwind + DaisyUI + WebSocket)
version: 3.0.0
author: Family Budget Team
tags: [frontend, htmx, tailwind, daisyui, websocket, jinja2]
dependencies: [api-development, websocket-realtime]
architecture_refs:
  - $ref: ../../docs/architecture/web/templates.yaml
  - $ref: ../../docs/architecture/web/htmx-triggers.yaml
  - $ref: ../../docs/architecture/web/js-modules.yaml
  - $ref: ../../docs/architecture/frontend/modal-performance.yaml
---

# Frontend Development Skill

Автоматизация создания frontend компонентов с HTMX, Tailwind CSS, DaisyUI и WebSocket интеграцией.

## When to Use

- Создать новый modal dialog
- Добавить HTMX trigger для API endpoint
- Создать новый JavaScript модуль
- Интегрировать WebSocket события
- Добавить Tailwind/DaisyUI компонент

## Architecture Context

**References:**
- Templates: [$ref](../../docs/architecture/web/templates.yaml)
- HTMX Triggers: [$ref](../../docs/architecture/web/htmx-triggers.yaml)
- JS Modules: [$ref](../../docs/architecture/web/js-modules.yaml)
- Performance: [$ref](../../docs/architecture/frontend/modal-performance.yaml)

**Key Patterns:**
- **HTMX partial rendering** - NO full page reload
- **Tailwind utility-first CSS** - NO custom CSS
- **DaisyUI components** - Pre-built UI components
- **WebSocket real-time updates** - Live data sync
- **Offline-first** - IndexedDB for offline support

## Commands

### Command: create-modal

**Usage:**
```
Создай modal dialog для создания/редактирования <ResourceName> с HTMX и WebSocket интеграцией.
```

**What It Does:**
1. Creates Jinja2 template extending base.html
2. Adds HTMX attributes (hx-post, hx-target, hx-swap)
3. Adds DaisyUI modal structure
4. Integrates WebSocket broadcast listener
5. Adds loading states (hx-indicator)

**Template Reference:**
- `templates/htmx-template.html` - Base Jinja2 + HTMX template
- `templates/tailwind-component.html` - Tailwind/DaisyUI modal

**Example:**
- `examples/modal-implementation.md` - Real Article modal

### Command: add-htmx-trigger

**Usage:**
```
Добавь HTMX trigger для endpoint POST /api/v1/<resource> с WebSocket broadcast.
```

**What It Does:**
1. Add hx-post/hx-get attribute to HTML element
2. Configure hx-target for partial update
3. Add hx-swap strategy (innerHTML/outerHTML/beforeend)
4. Integrate WebSocket listener for real-time updates
5. Add loading states

**Template Reference:**
- `templates/htmx-trigger-example.html`

### Command: add-ws-integration

**Usage:**
```
Интегрируй WebSocket события для <event-name> в frontend.
```

**What It Does:**
1. Add event handler to budgetWSClient.js
2. Update UI elements on event receive
3. Handle offline queue if needed

**Template Reference:**
- `templates/ws-client-integration.js`

## Validation Checklist

- [ ] Template extends base.html
- [ ] HTMX attributes configured (hx-*, hx-target, hx-swap)
- [ ] Tailwind classes used (NO custom CSS)
- [ ] DaisyUI components used correctly
- [ ] WebSocket integration added if needed
- [ ] Responsive design (mobile-first)
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Minified JS built (`npm run minify:js`)
- [ ] Built CSS (`npm run build:css`)
- [ ] HTMX trigger registered in htmx-triggers.yaml

## Common Mistakes

**Forgot to minify JS:**
- **Symptom**: Production bundle huge, unoptimized
- **Fix**: `npm run minify:js`
- **Reference**: [$ref](../../docs/architecture/guides/change-checklist.yaml#/checklists/ui_change)

**HTMX trigger without target:**
- **Symptom**: Full page reload instead of partial update
- **Fix**: Add `hx-target="#element-id"`

**Custom CSS instead of Tailwind:**
- **Symptom**: Inconsistent styling, CSS bloat
- **Fix**: Use Tailwind utility classes

## Related Skills

- **api-development**: Create API endpoints first
- **websocket-realtime**: Add real-time updates
- **testing**: Create e2e tests with Playwright

## Quick Links

- Modal Performance Optimization: [$ref](../../docs/architecture/frontend/modal-performance.yaml)
- HTMX Triggers Mapping: [$ref](../../docs/architecture/web/htmx-triggers.yaml)
- JS Modules: [$ref](../../docs/architecture/web/js-modules.yaml)
