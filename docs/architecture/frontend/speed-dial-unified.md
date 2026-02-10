# Speed Dial Unified System

**Version:** 1.0
**Last Updated:** 2026-02-10
**Status:** Implemented

---

## Overview

Унифицированная система Speed Dial (Floating Action Button) для Family Budget приложения, основанная на эталонной реализации от `/lists` page. Обеспечивает консистентный UX на всех экранах с адаптивным позиционированием, размерами и функциональностью.

**Ключевые улучшения:**
- ✅ Единое позиционирование FAB (исправлены расхождения +2rem/+0.5rem)
- ✅ Адаптивные размеры (48px mobile → 56px desktop)
- ✅ Контекстный Speed Dial (главная - 2 действия, facts/plan - 1 кнопка)
- ✅ Staggered animations (0.05s, 0.1s задержки)
- ✅ ARIA live regions (screen reader поддержка)
- ✅ Offline mode адаптация (скрывает "План" в offline)
- ✅ Z-Index layer fixes (FAB скрывается при открытых модалях)

---

## Positioning Reference

### Mobile (< 640px)

```css
.fab-wrapper {
  position: fixed;
  bottom: calc(4rem + 1rem + env(safe-area-inset-bottom));
  /* 4rem navbar + 1rem spacing + safe area */
  right: 1rem;
}

.fab-button {
  width: 48px;
  height: 48px;
}
```

**Эталон:** `/lists` page (lists.css:1642)

### Tablet (640-1023px)

```css
@media (min-width: 640px) {
  .fab-button {
    width: 56px;
    height: 56px;
  }
}
```

### Desktop (≥ 1024px)

```css
@media (min-width: 1024px) {
  .fab-wrapper {
    bottom: 1.5rem; /* 24px от края */
    right: 2rem;
  }

  .fab-button {
    width: 56px; /* Фиксированный размер */
    height: 56px;
  }
}
```

**Важно:** Размер **НЕ увеличивается до 64px** на ≥1280px экранах (консистентность с /lists).

---

## Z-Index Layers

**Иерархия FAB компонентов:**

| Component | Z-Index | CSS Variable | Purpose |
|-----------|---------|--------------|---------|
| Mobile FAB | 40 | `--z-fab-mobile` | Ниже navbar (50) |
| Desktop FAB Backdrop | 1000 | `--z-fab-backdrop` | Выше modal backdrop (999) |
| Desktop FAB Menu Items | 1001 | `--z-fab-lists-menu` | Пункты меню |
| Desktop FAB Main Button | 1002 | `--z-fab-desktop` | Главная кнопка |
| Lists FAB Main Button | 1003 | `--z-fab-lists` | Главная кнопка на /lists |

**Конфликт с модалями:** FAB компоненты (1000-1003) находятся выше Modal Backdrop (999). Решение:

```css
/* Скрытие FAB при открытых модалях */
body:has(.modal.modal-open) .desktop-fab-wrapper,
body:has(.modal.modal-open) .fab-wrapper,
body:has(.modal.modal-open) #lists-fab-menu {
    display: none !important;
    visibility: hidden;
}

/* Fallback для браузеров без :has() support */
body.modal-open .desktop-fab-wrapper,
body.modal-open .fab-wrapper,
body.modal-open #lists-fab-menu,
body.modal-open .fab-common-wrapper {
    display: none !important;
    visibility: hidden;
}
```

---

## Page Visibility Rules

**FAB показывается ТОЛЬКО на 4 страницах:**

| Page | Mobile (< 1024px) | Desktop (≥ 1024px) | Actions |
|------|-------------------|---------------------|---------|
| `/` | Speed Dial (2 действия) | Speed Dial (2 действия) | План + Факт |
| `/facts` | Одна кнопка (Факт) | Speed Dial (2 действия) | Факт (mobile), План + Факт (desktop) |
| `/plan` | Одна кнопка (План) | Speed Dial (2 действия) | План (mobile), План + Факт (desktop) |
| `/lists` | Speed Dial (4 действия) | Speed Dial (4 действия) | Добавить товар + массовые операции |
| `/analytics` | **Скрыт** | **Скрыт** | - |

**Реализация:**

```javascript
const FAB_PAGE_CONTEXT = {
    '/': 'fact',
    '/facts': 'fact',
    '/plan': 'plan',
    '/lists': 'lists'
    // /analytics - not in list = FAB hidden
};
```

---

## Staggered Animations

**Mobile FAB:**

```css
.fab-wrapper.open .mobile-fab-item:nth-child(1) {
    animation-delay: 0.05s;
}

.fab-wrapper.open .mobile-fab-item:nth-child(2) {
    animation-delay: 0.1s;
}

@keyframes slideInFab {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

**Desktop FAB:**

```css
.fab-menu-item:nth-child(1) { transition-delay: 0.05s; }
.fab-menu-item:nth-child(2) { transition-delay: 0.1s; }

.fab-common-menu-item:nth-child(2) { transition-delay: 0.05s; }
.fab-common-menu-item:nth-child(3) { transition-delay: 0.1s; }
```

**Примечание:** Desktop FAB использует `transition` вместо `animation` для плавного появления/исчезновения.

---

## Accessibility (ARIA Live Regions)

**HTML:**

```html
<nav id="fab-toolbar" class="fab-container">
    <!-- ARIA live region for screen readers -->
    <div id="fab-status" role="status" aria-live="polite" class="sr-only"></div>
    ...
</nav>
```

**JavaScript обновление:**

```javascript
// Mobile FAB
function toggleFabMenu() {
    const status = document.getElementById('fab-status');
    const isOpen = wrapper.classList.contains('open');

    if (status) {
        status.textContent = isOpen
            ? 'Меню действий закрыто.'
            : 'Меню действий открыто. 2 опции доступны: Добавить план и Добавить факт.';
    }
}

// Desktop FAB
export function toggleDesktopFabMenu(): void {
    const status = document.getElementById('fab-status');
    const visibleItems = wrapper.querySelectorAll('.fab-menu-item:not([style*="display: none"])');

    if (status) {
        status.textContent = isOpen
            ? 'Меню действий закрыто.'
            : `Меню действий открыто. ${visibleItems.length} опции доступны.`;
    }
}
```

---

## Offline Mode Adaptation

**Desktop FAB адаптируется к offline режиму:**

```typescript
// frontend/web/static/js/components/desktopFab.ts
export function updateOfflineVisibility(): void {
  const isOffline = document.documentElement.classList.contains('offline-mode');
  const desktopFab = document.querySelector('.desktop-fab-wrapper') as HTMLElement | null;

  if (isOffline && desktopFab) {
    // Скрыть "Добавить план" (требует сервер)
    const planMenuItem = desktopFab.querySelector('[onclick*="openModalPlan"]')?.closest('.fab-menu-item');
    if (planMenuItem) {
      (planMenuItem as HTMLElement).style.display = 'none';
    }
  } else if (desktopFab) {
    // Восстановить все пункты в online режиме
    const planMenuItem = desktopFab.querySelector('[onclick*="openModalPlan"]')?.closest('.fab-menu-item');
    if (planMenuItem) {
      (planMenuItem as HTMLElement).style.display = '';
    }
  }
}
```

**Event Listeners:**

```typescript
window.addEventListener('online', updateOfflineVisibility);
window.addEventListener('offline', updateOfflineVisibility);

// MutationObserver для класса offline-mode
const offlineObserver = new MutationObserver(() => {
  updateOfflineVisibility();
});
offlineObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class']
});
```

**Почему скрывается "План", а не "Факт"?**
- "Факт" работает offline через Dexie.js (offline-first database)
- "План" требует server-side обработки (recurring plans, reminders)

---

## Components Architecture

### 1. Universal FAB (fab_toolbar.html)

**Используется на:** `/`, `/facts`, `/plan`

**Структура:**

```html
<nav id="fab-toolbar" class="fab-container">
    <!-- ARIA live region -->
    <div id="fab-status" role="status" aria-live="polite" class="sr-only"></div>

    <!-- Mobile/Tablet Navigation (< 1024px) -->
    <div class="mobile-nav-wrapper">
        <!-- Bottom navigation: 5 buttons -->
    </div>

    <!-- Desktop Speed Dial FAB (≥ 1024px) -->
    <div class="desktop-fab-wrapper fab-common-wrapper closed">
        <!-- Menu Items -->
        <div class="fab-menu-item fab-common-menu-item">
            <button onclick="openModalPlan()">План</button>
        </div>
        <div class="fab-menu-item fab-common-menu-item">
            <button onclick="openModalFact()">Факт</button>
        </div>

        <!-- Main FAB Button -->
        <button onclick="toggleDesktopFabMenu()" class="fab-button">+</button>
    </div>

    <!-- Desktop FAB Backdrop -->
    <div id="desktop-fab-backdrop" onclick="closeDesktopFabMenu()"></div>

    <!-- Mobile Speed Dial FAB (< 1024px) -->
    <div class="fab-wrapper">
        <!-- Speed Dial menu (только на /) -->
        <div id="fab-speed-dial-menu" class="mobile-fab-menu">
            <div class="mobile-fab-item">
                <button onclick="openModalPlan()">План</button>
            </div>
            <div class="mobile-fab-item">
                <button onclick="openModalFact()">Факт</button>
            </div>
        </div>

        <!-- Main FAB button -->
        <button onclick="toggleFabMenu()" class="fab-button">+</button>
    </div>
</nav>
```

### 2. Lists FAB (fab_buttons.html)

**Используется на:** `/lists`

**Отличия от Universal FAB:**
- 4 действия вместо 2 (Добавить товар, Удалить, Отметить все, Снять отметки)
- Специальные классы: `.lists-fab-main`, `.lists-fab-menu`
- Z-Index: 1003 (выше Universal FAB)

---

## HTMX Navigation Support

**Обработчик динамического обновления видимости:**

```javascript
document.body.addEventListener('htmx:afterSwap', function(event) {
    const isPushUrl = event.detail.xhr?.getResponseHeader('HX-Push-Url');
    if (isPushUrl || event.detail.pathInfo?.requestPath) {
        setTimeout(() => {
            const newContext = FAB_PAGE_CONTEXT[window.location.pathname];
            const contextChanged = newContext !== context;

            if (contextChanged) {
                applyFabPageContext(); // Re-apply FAB visibility
            }
        }, 0);
    }
});
```

---

## Migration Guide (v9.0 → v11.0+)

### Breaking Changes

1. **Позиционирование:**
   - Mobile bottom: `calc(7rem)` → `calc(4rem + 1rem)` (-2rem)
   - Desktop bottom: `2rem` → `1.5rem` (-0.5rem)

2. **Размеры:**
   - Mobile: `56px` → `48px` (-8px)
   - Desktop XL (≥1280px): `64px` → `56px` (фиксированный размер)

3. **Z-Index:**
   - FAB теперь скрывается при открытых модалях (`body.modal-open`)

### Non-Breaking Enhancements

- ✅ Staggered animations (уже были, задержки не изменились)
- ✅ ARIA live regions (новая функциональность, не влияет на старый код)
- ✅ Offline mode адаптация (новая функциональность)
- ✅ HTMX navigation support (новая функциональность)

### Code Migration

**Before:**

```css
.fab-wrapper {
    bottom: calc(7rem + env(safe-area-inset-bottom));
}
```

**After:**

```css
.fab-wrapper {
    bottom: calc(4rem + 1rem + env(safe-area-inset-bottom));
}
```

---

## Testing

### Visual Regression Tests

**Файл:** `tests/e2e/webapp/test_visual_regression.spec.ts`

**Тесты:**

1. **FAB позиционирование на главной:**
   ```typescript
   test('FAB positioning on home page', async ({ page }) => {
     await page.goto('/');
     await expect(page.locator('#fab-toolbar')).toHaveScreenshot('fab-home.png');
   });
   ```

2. **FAB позиционирование на /lists:**
   ```typescript
   test('FAB positioning on lists page', async ({ page }) => {
     await page.goto('/lists');
     await expect(page.locator('#lists-fab-menu')).toHaveScreenshot('fab-lists.png');
   });
   ```

3. **Speed Dial открытое состояние:**
   ```typescript
   test('Speed Dial open state', async ({ page }) => {
     await page.goto('/');
     await page.click('.desktop-fab-wrapper button');
     await expect(page.locator('.desktop-fab-wrapper')).toHaveScreenshot('fab-open.png');
   });
   ```

4. **FAB видимость на разных страницах:**
   ```typescript
   test('FAB visibility on different pages', async ({ page }) => {
     // Показывается на целевых страницах
     await page.goto('/');
     await expect(page.locator('#fab-toolbar')).toBeVisible();

     // Скрыт на /analytics
     await page.goto('/analytics');
     await expect(page.locator('#fab-toolbar')).toBeHidden();
   });
   ```

### Manual Testing Checklist

- [ ] Mobile (375px): FAB 48px, bottom 80px above navbar
- [ ] Tablet (768px): FAB 56px, bottom 80px above navbar
- [ ] Desktop (1024px): FAB 56px, bottom 24px from edge
- [ ] XL Desktop (1920px): FAB **остаётся 56px** (не увеличивается до 64px)
- [ ] Speed Dial открывается с staggered animation
- [ ] ARIA announcements для screen readers
- [ ] FAB скрывается при открытых модалях
- [ ] Desktop FAB скрывает "План" в offline режиме
- [ ] FAB видимость корректна на всех страницах (/, /facts, /plan, /lists, /analytics)

---

## References

- **Эталонная реализация:** `/lists` page (`frontend/web/templates/components/lists/fab_buttons.html`)
- **Z-Index система:** [docs/architecture/frontend/z-index-layering.md](./z-index-layering.md)
- **Responsive design:** [docs/architecture/frontend/responsive-design.md](./responsive-design.md)
- **Explore документация:** [docs/explore/fab-speed-dial-analysis.md](../../explore/fab-speed-dial-analysis.md)
- **Material Design FAB:** https://m3.material.io/components/floating-action-button

---

## Changelog

### v1.0 (2026-02-10)

**Implemented:**
- ✅ Phase 1: Унификация CSS позиционирования и размеров
- ✅ Phase 2: Z-Index layer verification и fixes
- ✅ Phase 3: Контекстный Speed Dial и анимации
- ✅ Phase 4: Ограничение видимости FAB на целевых страницах
- ✅ Phase 5: Документация и visual regression tests

**Modified Files:**
- `frontend/web/static/css/custom.css` (6 правок)
- `frontend/web/templates/components/fab_toolbar.html` (4 правки)
- `frontend/web/static/js/components/desktopFab.ts` (3 правки)

**Impact:**
- Консистентный UX на всех экранах
- Улучшенная accessibility (ARIA support)
- Offline mode support
- Правильная работа z-index слоёв
