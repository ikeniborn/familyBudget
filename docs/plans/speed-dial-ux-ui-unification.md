# Speed Dial UX/UI Унификация - План Реализации

**Версия:** 1.0 (Reviewed)
**Дата создания:** 2026-02-09
**Статус:** Ready for Approval
**Estimated Effort:** 9-13 часов (5 phases)

---

## Executive Summary

**Проблема:** Speed Dial компонент имеет несогласованное поведение на разных страницах - разные координаты, размеры и функциональность.

**Решение:** Унификация Speed Dial с использованием эталонной реализации от `/lists` page:
- ✅ Единое позиционирование (исправление +2rem/+0.5rem расхождений)
- ✅ Адаптивные размеры (48px mobile → 56px desktop)
- ✅ Контекстный Speed Dial (/ - 2 действия, /facts - 1 кнопка, /plan - 1 кнопка)
- ✅ Staggered animation для плавного появления
- ✅ ARIA live regions для accessibility
- ✅ Offline mode адаптация

**Impact:**
- **UX:** Консистентный опыт на всех экранах
- **Accessibility:** Screen reader поддержка через ARIA live regions
- **Performance:** Staggered animations + GPU acceleration
- **Maintenance:** Унифицированный код, единый naming pattern

---

## Обнаруженные Критические Расхождения

| Параметр | Текущее (fab_toolbar) | Эталон (/lists) | Исправление |
|----------|----------------------|-----------------|-------------|
| **Mobile bottom position** | `calc(7rem + safe-area)` | `calc(4rem + 1rem + safe-area)` | **-2rem** (на 32px ниже) |
| **Desktop bottom position** | `2rem` | `1.5rem` | **-0.5rem** (на 8px ниже) |
| **Mobile FAB size** | 56px | 48px | **-8px** (мельче) |
| **Desktop FAB size** | 56px → 64px (≥1280px) | 56px (фиксированный) | ✓ Фиксировать 56px |
| **Accessibility** | ❌ Нет ARIA live region | - | ✅ Добавить |
| **Offline mode** | ❌ Desktop FAB не адаптируется | - | ✅ Скрывать "План" в offline |

---

## Context

### Проблема
На текущий момент Speed Dial компонент имеет несогласованное поведение на разных страницах приложения Family Budget:

1. **Разное позиционирование** - FAB имеет различные координаты на разных экранах (главная, facts, plan, lists)
2. **Непоследовательные размеры** - размеры кнопок не унифицированы между mobile/tablet/desktop
3. **Неполная функциональность** - на некоторых страницах FAB открывает модаль напрямую вместо Speed Dial меню
4. **Z-index конфликты** - при открытии Speed Dial возможны наложения с другими элементами (модали, navbar)
5. **Показ на всех страницах** - FAB отображается даже там, где не нужен (например, /analytics)

### Цель
Унифицировать Speed Dial компонент для создания консистентного UX на всех экранах приложения:
- Единое позиционирование (эталон: страница `/lists`)
- Адаптивные размеры в зависимости от breakpoint
- Полная функциональность Speed Dial меню на всех поддерживаемых страницах
- Корректная работа z-index слоёв
- Показ Speed Dial только на 4 целевых страницах: `/`, `/facts`, `/plan`, `/lists`

### Почему это важно
- **UX консистентность** - пользователи получат одинаковый опыт на всех экранах
- **Predictability** - FAB всегда в одном месте, одного размера
- **Accessibility** - правильные размеры кнопок для touch targets (Material Design: min 48px)
- **Maintenance** - унифицированный код проще поддерживать

### Принятые Решения (User Requirements)

| Требование | Решение | Обоснование |
|------------|---------|-------------|
| **Mobile Layout** | Bottom navigation + FAB над ним | Навигация между страницами + быстрые действия |
| **Facts/Plan Pages** | Контекстный Speed Dial | /facts - одна кнопка (Факт), /plan - одна кнопка (План), / - Speed Dial (2 действия) |
| **Desktop Sizing** | Фиксированный 56px (эталон от /lists) | Упрощает поддержку, консистентность с /lists page |
| **Animations** | Staggered animation (0.05s, 0.1s) | Плавное появление пунктов меню, улучшает UX |

### Speed Dial Mapping

| Страница | Mobile (< 1024px) | Desktop (≥ 1024px) | Действия |
|----------|-------------------|---------------------|----------|
| `/` | Speed Dial (2 действия) | Speed Dial (2 действия) | План + Факт |
| `/facts` | Одна кнопка | Speed Dial (2 действия) | Только Факт (mobile), План + Факт (desktop) |
| `/plan` | Одна кнопка | Speed Dial (2 действия) | Только План (mobile), План + Факт (desktop) |
| `/lists` | Speed Dial (4 действия) | Speed Dial (4 действия) | Добавить товар + массовые операции |
| `/analytics` | Скрыт | Скрыт | - |

## Критические Расхождения (Обнаружены при проверке)

### 1. Позиционирование FAB на mobile

| Компонент | Текущая позиция | Эталон (/lists) | Расхождение |
|-----------|-----------------|-----------------|-------------|
| `.fab-wrapper` (custom.css:868) | `calc(7rem + safe-area)` | `calc(4rem + 1rem + safe-area)` | **+2rem лишние** |
| `.desktop-fab-wrapper` (custom.css:1170) | `calc(4rem + 1rem + safe-area)` | `calc(4rem + 1rem + safe-area)` | ✓ Соответствует |

**Impact:** FAB на главной странице находится **на 32px выше** чем на /lists

### 2. Позиционирование FAB на desktop

| Компонент | Текущая позиция | Эталон (/lists) | Расхождение |
|-----------|-----------------|-----------------|-------------|
| `.fab-wrapper` (custom.css:877) | `bottom: 2rem` | `bottom: 1.5rem` | **+0.5rem лишние** |
| Lists FAB (lists.css:1629) | `bottom: 1.5rem` | - | ✓ Эталон |

**Impact:** Desktop FAB на главной на **8px выше** чем на /lists

### 3. Размеры FAB

| Breakpoint | Текущий размер | Эталон (/lists) | Расхождение |
|------------|----------------|-----------------|-------------|
| < 640px | 56px | 48px | **+8px** |
| 640-1023px | 56px | 56px | ✓ Соответствует |
| 1024-1279px | 56px | 56px | ✓ Соответствует |
| ≥ 1280px | 64px | 64px | ✓ Соответствует |

**Impact:** Mobile FAB на главной **крупнее на 8px** чем эталон

### 4. Naming Inconsistency

| Файл | Используемые имена классов |
|------|----------------------------|
| fab_toolbar.html | `.fab-wrapper`, `.desktop-fab-wrapper`, `.fab-common-wrapper` |
| fab_buttons.html | `.lists-fab-menu`, `.lists-fab-main`, `.lists-fab-backdrop` |
| custom.css | `.mobile-fab-menu`, `.fab-button`, `.fab-common-action-btn` |

**Impact:** Трудно поддерживать, нет единого naming pattern

### 5. Рекомендации из fab-speed-dial-analysis.md

**Документация указывает на проблемы:**
1. ⚠️ Разное поведение FAB на разных страницах (Speed Dial vs прямой вызов)
2. ⚠️ Desktop FAB НЕ адаптируется к offline режиму
3. ⚠️ Отсутствие ARIA live regions для screen readers
4. ⚠️ Naming consistency проблемы

**Все эти проблемы должны быть исправлены в рамках унификации.**

## Complexity Assessment

**Level:** Complex (score: 0.88/1.0)

**Факторы сложности:**
- 8 файлов для изменения (HTML templates, CSS, TypeScript)
- 4 компонента (Universal FAB, Lists FAB, CSS system, JS controllers)
- Breaking changes (positioning, z-index, page visibility logic)
- Cross-page consistency требования
- Z-index layer conflict risks

**Workflow:** Phase-based decomposition с checkpoint между фазами

## Critical Files

### Frontend Templates
- `frontend/web/templates/components/fab_toolbar.html` (629 lines)
  - Universal FAB для главной, facts, plan
  - Mobile bottom navigation
  - Desktop Speed Dial

- `frontend/web/templates/components/lists/fab_buttons.html` (79 lines)
  - **ЭТАЛОННАЯ РЕАЛИЗАЦИЯ**
  - Lists-specific FAB с правильным позиционированием
  - Speed Dial с 4 действиями

### CSS Styles
- `frontend/web/static/css/custom.css` (lines 305-1088)
  - FAB Container styles (~350 lines)
  - **КРИТИЧЕСКАЯ ПРОБЛЕМА:** `.fab-wrapper` использует `bottom: calc(7rem + safe-area)` вместо эталонных `calc(4rem + 1rem + safe-area)` от /lists
  - Mobile/Desktop responsive breakpoints
  - Z-index layering

- `frontend/web/static/css/lists.css` (lines 1425-1716)
  - FAB sizing (~100 lines)
  - Speed Dial menu (~200 lines)
  - **ЭТАЛОННЫЕ СТИЛИ:**
    - `bottom: calc(4rem + 1rem + env(safe-area-inset-bottom))` для mobile
    - `bottom: 1.5rem` для desktop (НЕ 2rem как в custom.css!)

- `frontend/web/static/css/z-index-variables.css` (71 lines)
  - 13-layer z-index hierarchy
  - CSS custom properties

### JavaScript
- `frontend/web/static/js/components/desktopFab.ts` (114 lines)
  - toggleDesktopFabMenu()
  - closeDesktopFabMenu()
  - initDesktopFab()

- `frontend/web/static/js/lists/listsManager/ui/fabManager.ts` (29 lines)
  - toggleListsFAB()
  - **ЭТАЛОННАЯ ЛОГИКА**

### Documentation
- `docs/explore/fab-speed-dial-analysis.md` (570 lines)
- `docs/explore/fab-visual-schema.md` (695 lines)
- `docs/architecture/frontend/z-index-layering.md` (276 lines)

## Implementation Plan

### Phase 1: Анализ и Унификация CSS Позиционирования

**Цель:** Создать единую систему позиционирования FAB на всех экранах

**Задачи:**

1. **Audit текущего позиционирования**
   - Измерить координаты FAB на каждой странице (/, facts, plan, lists)
   - Определить эталонные значения (reference: `/lists` page)
   - Выявить расхождения в responsive breakpoints

2. **Создать унифицированные CSS классы**
   ```css
   /* ЭТАЛОННЫЕ КООРДИНАТЫ (из lists.css:1642, 1646) */
   .fab-unified-position {
     position: fixed;
     bottom: calc(4rem + 1rem + env(safe-area-inset-bottom)); /* 4rem navbar + 1rem spacing + safe area */
     right: 1rem;
   }

   /* Desktop позиционирование (из lists.css:1629) */
   @media (min-width: 1024px) {
     .fab-unified-position {
       bottom: 1.5rem; /* 24px от края на desktop - ИСПРАВЛЕНИЕ: было 2rem */
       right: 1.5rem;
     }
   }

   /* Адаптивные размеры (эталон от /lists) */
   @media (max-width: 639px) {
     .fab-unified-size {
       width: 48px;
       height: 48px;
     } /* Mobile - ИСПРАВЛЕНИЕ: было 56px */
   }
   @media (min-width: 640px) and (max-width: 1023px) {
     .fab-unified-size {
       width: 56px;
       height: 56px;
     } /* Tablet */
   }
   @media (min-width: 1024px) {
     .fab-unified-size {
       width: 56px;
       height: 56px;
     } /* Desktop - фиксированный 56px */
   }
   ```

3. **Исправить расхождения в custom.css**
   ```css
   /* БЫЛО (custom.css:868): */
   .fab-wrapper {
     bottom: calc(7rem + env(safe-area-inset-bottom)); /* НЕПРАВИЛЬНО: +2rem лишние */
   }

   /* СТАЛО: */
   .fab-wrapper {
     bottom: calc(4rem + 1rem + env(safe-area-inset-bottom)); /* ЭТАЛОН от /lists */
   }

   /* БЫЛО (custom.css:877): */
   @media (min-width: 1024px) {
     .fab-wrapper {
       bottom: 2rem; /* НЕПРАВИЛЬНО: на 8px выше */
     }
   }

   /* СТАЛО: */
   @media (min-width: 1024px) {
     .fab-wrapper {
       bottom: 1.5rem; /* ЭТАЛОН от /lists */
     }
   }

   /* БЫЛО (custom.css:882): */
   .fab-button {
     width: 56px;  /* НЕПРАВИЛЬНО: на mobile должно быть 48px */
     height: 56px;
   }

   /* СТАЛО: */
   .fab-button {
     width: 48px;  /* ЭТАЛОН от /lists */
     height: 56px;
   }

   @media (min-width: 640px) {
     .fab-button {
       width: 56px;  /* Tablet и выше */
       height: 56px;
     }
   }
   ```

4. **Применить к fab_toolbar.html**
   - Обновить `.fab-wrapper` и `.desktop-fab-wrapper`
   - Заменить inline styles на unified classes
   - Сохранить safe-area-inset поддержку для iOS notch

**Выходные артефакты:**
- Updated `custom.css` с `.fab-unified-position`, `.fab-unified-size`
- Updated `fab_toolbar.html` с новыми классами
- Checklist расхождений до/после

**Validation:**
```bash
# Visual regression test
npm run test:e2e:chromium -- test_visual_regression.spec.ts

# Manual check на всех breakpoints
# Mobile: 375px, 640px
# Tablet: 768px
# Desktop: 1024px, 1280px, 1920px
```

---

### Phase 2: Z-Index Layer Verification и Исправление Конфликтов

**Цель:** Гарантировать корректную работу z-index слоёв при открытии Speed Dial

**Задачи:**

1. **Audit z-index конфликтов**
   - Проверить все 13 слоёв из `z-index-variables.css`
   - Идентифицировать конфликты:
     - Mobile FAB (40) vs Navbar (50) ✓ правильно
     - Desktop FAB (1002) vs Backdrop (1000) ✓ правильно
     - Lists FAB (1003) vs Modal Backdrop (999) ⚠️ **потенциальный конфликт**
   - Проверить, что FAB скрывается когда модаль открыта

2. **Исправить конфликты**
   ```css
   /* Ensure FAB hides when modal is open */
   body.modal-open .fab-wrapper,
   body.modal-open .desktop-fab-wrapper,
   body.modal-open .lists-fab-menu {
     display: none !important;
   }
   ```

3. **Добавить z-index classes в templates**
   ```html
   <!-- fab_toolbar.html -->
   <div class="fab-wrapper" style="z-index: var(--z-fab-mobile);">

   <div class="desktop-fab-wrapper" style="z-index: var(--z-fab-desktop);">

   <!-- fab_buttons.html -->
   <div class="lists-fab-main" style="z-index: var(--z-fab-lists);">
   ```

**Выходные артефакты:**
- Updated `z-index-variables.css` (если нужны новые слои)
- Updated templates с explicit z-index classes
- Test scenarios для каждого layer conflict

**Validation:**
```typescript
// E2E test: FAB + Modal interaction
test('FAB hides when modal opens', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.fab-wrapper')).toBeVisible();

  await page.click('button[onclick*="openModalFact"]');
  await expect(page.locator('#modal_fact')).toBeVisible();
  await expect(page.locator('.fab-wrapper')).toBeHidden();
});
```

---

### Phase 3: Унификация Функциональности Speed Dial Меню

**Цель:** Контекстный Speed Dial с сохранением bottom navigation для навигации между страницами

**Пользовательские требования:**
- ✅ **Mobile Layout:** Bottom navigation остаётся + дополнительный FAB над ним (текущее поведение на главной)
- ✅ **Facts/Plan Pages:** Контекстный Speed Dial (/facts - только Факт, /plan - только План)
- ✅ **Desktop Sizing:** Эталон от /lists (56px для всех desktop экранов)
- ✅ **Animations:** Staggered animation для пунктов меню (0.05s, 0.1s задержки)

**Задачи:**

1. **Рефакторинг fab_toolbar.html - Контекстный подход**
   - **Текущее поведение:**
     - `/` - Speed Dial на mobile ✓ (2 действия: План + Факт)
     - `/facts` - Direct modal link в bottom nav ✗
     - `/plan` - Direct modal link в bottom nav ✗

   - **Целевое поведение (Контекстный Speed Dial):**
     - `/` - Speed Dial с 2 действиями (План + Факт)
     - `/facts` - Одна кнопка FAB (только Факт) - Speed Dial не нужен
     - `/plan` - Одна кнопка FAB (только План) - Speed Dial не нужен

   - **Изменения:**
     ```html
     <!-- Главная страница: Speed Dial с 2 действиями -->
     <div class="fab-wrapper" data-page="/">
       <button onclick="toggleMobileFabMenu()" class="fab-main">
         <svg>+</svg>
       </button>
       <div class="mobile-fab-menu closed">
         <div class="fab-menu-item"><button onclick="openModalPlan()">План</button></div>
         <div class="fab-menu-item"><button onclick="openModalFact()">Факт</button></div>
       </div>
     </div>

     <!-- /facts: Одна кнопка (Speed Dial не нужен) -->
     <div class="fab-wrapper" data-page="/facts">
       <button onclick="openModalFact()" class="fab-main">
         <svg>📄</svg>
       </button>
     </div>

     <!-- /plan: Одна кнопка (Speed Dial не нужен) -->
     <div class="fab-wrapper" data-page="/plan">
       <button onclick="openModalPlan()" class="fab-main">
         <svg>📅</svg>
       </button>
     </div>
     ```

2. **Desktop: Speed Dial для всех страниц**
   - **Desktop всегда показывает Speed Dial** (даже для /facts и /plan)
   - **Причина:** На desktop больше места, удобнее иметь быстрый доступ к обоим действиям
   - **Размер:** 56px для всех desktop экранов (эталон от /lists)

   ```html
   <!-- Desktop FAB (≥ 1024px) - всегда Speed Dial -->
   <div class="desktop-fab-wrapper" data-size="56">
     <!-- 2 действия для всех страниц -->
     <div class="fab-menu-item">
       <button onclick="openModalPlan()">План</button>
     </div>
     <div class="fab-menu-item">
       <button onclick="openModalFact()">Факт</button>
     </div>
   </div>
   ```

3. **Добавить Staggered Animation**
   ```css
   /* custom.css - Staggered animation для Speed Dial пунктов */
   .fab-menu-item:nth-child(1) {
     animation: fabItemAppear 0.3s ease-out forwards;
     animation-delay: 0.05s;
   }

   .fab-menu-item:nth-child(2) {
     animation: fabItemAppear 0.3s ease-out forwards;
     animation-delay: 0.1s;
   }

   @keyframes fabItemAppear {
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

4. **Обновить TypeScript логику**
   ```typescript
   // frontend/web/static/js/components/mobileFab.ts
   export function toggleMobileFabMenu(): void {
     const currentPage = window.location.pathname;
     const menu = document.querySelector(`.mobile-fab-menu[data-page="${currentPage}"]`);
     const backdrop = document.querySelector('.fab-common-backdrop');

     if (!menu) return; // Нет Speed Dial на этой странице

     menu?.classList.toggle('closed');
     backdrop?.classList.toggle('hidden');

     // Staggered animation для пунктов
     if (!menu.classList.contains('closed')) {
       const items = menu.querySelectorAll('.fab-menu-item');
       items.forEach((item, index) => {
         setTimeout(() => {
           item.classList.add('visible');
         }, index * 50); // 50ms delay per item
       });
     }
   }
   ```

5. **Добавить ARIA live region для accessibility**
   ```html
   <!-- Добавить в fab_toolbar.html для screen readers -->
   <div id="fab-status" role="status" aria-live="polite" class="sr-only"></div>
   ```

   ```typescript
   // Обновить toggleMobileFabMenu() в mobileFab.ts
   export function toggleMobileFabMenu(): void {
     const currentPage = window.location.pathname;
     const menu = document.querySelector(`.mobile-fab-menu[data-page="${currentPage}"]`);
     const backdrop = document.querySelector('.fab-common-backdrop');
     const status = document.getElementById('fab-status');

     if (!menu) return;

     const isOpen = !menu.classList.contains('closed');
     menu?.classList.toggle('closed');
     backdrop?.classList.toggle('hidden');

     // Accessibility: объявить состояние для screen readers
     if (status) {
       status.textContent = isOpen
         ? 'Меню действий открыто. 2 опции доступны.'
         : 'Меню действий закрыто.';
     }

     // Staggered animation для пунктов
     if (!menu.classList.contains('closed')) {
       const items = menu.querySelectorAll('.fab-menu-item');
       items.forEach((item, index) => {
         setTimeout(() => {
           item.classList.add('visible');
         }, index * 50);
       });
     }
   }
   ```

6. **Добавить offline mode адаптацию для Desktop FAB**
   ```typescript
   // Новая функция в desktopFab.ts
   export function updateOfflineVisibility(): void {
     const isOffline = document.documentElement.classList.contains('offline-mode');
     const desktopFab = document.querySelector('.desktop-fab-wrapper');

     if (isOffline && desktopFab) {
       // Скрыть "Добавить план" (требует сервер)
       // Оставить "Добавить факт" (работает offline через Dexie.js)
       const planMenuItem = desktopFab.querySelector('[onclick*="openModalPlan"]')?.closest('.fab-menu-item');
       if (planMenuItem) {
         planMenuItem.style.display = 'none';
       }
     } else if (desktopFab) {
       // Восстановить все пункты в online режиме
       const planMenuItem = desktopFab.querySelector('[onclick*="openModalPlan"]')?.closest('.fab-menu-item');
       if (planMenuItem) {
         planMenuItem.style.display = '';
       }
     }
   }

   // Вызывать при изменении online/offline статуса
   window.addEventListener('online', updateOfflineVisibility);
   window.addEventListener('offline', updateOfflineVisibility);
   document.addEventListener('DOMContentLoaded', updateOfflineVisibility);
   ```

7. **Проверить полноту действий**
   - **Desktop FAB (все страницы):** ✓ План, ✓ Факт (Speed Dial всегда)
   - **Mobile FAB:**
     - `/` - ✓ План, ✓ Факт (Speed Dial)
     - `/facts` - ✓ Факт (одна кнопка)
     - `/plan` - ✓ План (одна кнопка)
   - **Lists FAB:** ✓ Добавить товар, ✓ Удалить, ✓ Отметить все, ✓ Снять отметки
   - **Accessibility:** ✓ ARIA live region для screen readers

**Выходные артефакты:**
- Updated `fab_toolbar.html` с контекстным Speed Dial
- New `mobileFab.ts` module с Staggered animation logic
- Updated `custom.css` с animation keyframes
- Updated `desktopFab.ts` (унифицированный размер 56px)

**Validation:**
```bash
# Unit test для toggleMobileFabMenu()
npm test -- mobileFab.test.ts

# E2E test для разных страниц
npm run test:e2e -- test_mobile_navigation.spec.ts

# Visual regression для Staggered animation
npm run test:e2e:chromium -- test_visual_regression.spec.ts --update-snapshots
```

---

### Phase 4: Ограничение Показа Speed Dial на Целевых Страницах

**Цель:** Speed Dial показывается ТОЛЬКО на `/`, `/facts`, `/plan`, `/lists` (убрать с /analytics и других)

**Задачи:**

1. **Обновить FAB_PAGE_CONTEXT**
   ```typescript
   // До:
   const FAB_PAGE_CONTEXT = {
     '/': 'fact',
     '/facts': 'fact',
     '/plan': 'plan',
     '/lists': 'lists'
     // /analytics НЕ в списке
   };

   // После:
   const ALLOWED_FAB_PAGES = ['/', '/facts', '/plan', '/lists'];

   function shouldShowFAB(): boolean {
     const currentPath = window.location.pathname;
     return ALLOWED_FAB_PAGES.includes(currentPath);
   }
   ```

2. **Добавить visibility logic в templates**
   ```html
   <!-- fab_toolbar.html -->
   <nav id="fab-toolbar" class="fab-container" data-fab-pages="/,/facts,/plan,/lists">
     ...
   </nav>

   <script>
   document.addEventListener('DOMContentLoaded', () => {
     const fabToolbar = document.getElementById('fab-toolbar');
     const allowedPages = fabToolbar.dataset.fabPages.split(',');
     const currentPath = window.location.pathname;

     if (!allowedPages.includes(currentPath)) {
       fabToolbar.style.display = 'none';
     }
   });
   </script>
   ```

3. **HTMX hx-swap handling**
   - При HTMX navigation убедиться что FAB показывается/скрывается динамически
   - Добавить `htmx:afterSwap` event listener

**Выходные артефакты:**
- Updated `fab_toolbar.html` с visibility logic
- Updated TypeScript modules (если требуется)
- Test coverage для всех страниц

**Validation:**
```typescript
// E2E test
test('FAB visibility on different pages', async ({ page }) => {
  // Показывается на целевых страницах
  await page.goto('/');
  await expect(page.locator('#fab-toolbar')).toBeVisible();

  await page.goto('/facts');
  await expect(page.locator('#fab-toolbar')).toBeVisible();

  await page.goto('/plan');
  await expect(page.locator('#fab-toolbar')).toBeVisible();

  await page.goto('/lists');
  await expect(page.locator('#lists-fab-menu')).toBeVisible();

  // Скрыт на остальных
  await page.goto('/analytics');
  await expect(page.locator('#fab-toolbar')).toBeHidden();
});
```

---

### Phase 5: Documentation и Visual Regression Tests

**Цель:** Задокументировать унифицированную систему и добавить автотесты для предотвращения регрессий

**Задачи:**

1. **Создать документацию**
   ```markdown
   # Speed Dial Unified System

   ## Positioning Reference
   - Mobile (< 640px): 48px, bottom-right, 80px above navbar
   - Tablet (640-1023px): 56px, bottom-right, 80px above navbar
   - Desktop (1024-1279px): 56px, bottom-right, 24px from edge
   - XL Desktop (≥ 1280px): 64px, bottom-right, 24px from edge

   ## Z-Index Layers
   - Mobile FAB: var(--z-fab-mobile) = 40
   - Desktop FAB: var(--z-fab-desktop) = 1002
   - Lists FAB: var(--z-fab-lists) = 1003
   - Backdrop: var(--z-fab-backdrop) = 1000

   ## Allowed Pages
   - /
   - /facts
   - /plan
   - /lists

   ## Components
   - Universal FAB (fab_toolbar.html) - главная, facts, plan
   - Lists FAB (fab_buttons.html) - списки покупок
   ```

2. **Обновить существующую документацию**
   - `docs/explore/fab-speed-dial-analysis.md` - добавить раздел "Unified System"
   - `docs/architecture/frontend/z-index-layering.md` - обновить FAB z-index примеры
   - `docs/architecture/frontend/responsive-design.md` - добавить FAB responsive sizes

3. **Добавить Visual Regression Tests**
   ```typescript
   // tests/e2e/webapp/test_visual_regression.spec.ts

   test.describe('Speed Dial Visual Regression', () => {
     test('FAB positioning on home page', async ({ page }) => {
       await page.goto('/');
       await expect(page.locator('#fab-toolbar')).toHaveScreenshot('fab-home.png');
     });

     test('FAB positioning on lists page', async ({ page }) => {
       await page.goto('/lists');
       await expect(page.locator('#lists-fab-menu')).toHaveScreenshot('fab-lists.png');
     });

     test('Speed Dial open state', async ({ page }) => {
       await page.goto('/');
       await page.click('.desktop-fab-wrapper button');
       await expect(page.locator('.desktop-fab-wrapper')).toHaveScreenshot('fab-open.png');
     });
   });
   ```

4. **Создать migration guide**
   - Для разработчиков: как использовать unified FAB classes
   - Breaking changes: что изменилось в API
   - Examples: code snippets для новых компонентов

**Выходные артефакты:**
- New `docs/architecture/frontend/speed-dial-unified.md`
- Updated existing docs (3 files)
- Visual regression test suite (3+ tests)
- Migration guide for developers

**Validation:**
```bash
# Generate baseline screenshots
npm run test:e2e:chromium -- test_visual_regression.spec.ts --update-snapshots

# Run visual regression tests
npm run test:e2e:chromium -- test_visual_regression.spec.ts

# Verify documentation
markdown-lint docs/architecture/frontend/speed-dial-unified.md
```

---

## Phase Dependencies

```
Phase 1 (CSS унификация) → Phase 2 (Z-index fix) → Phase 3 (Функциональность) → Phase 4 (Visibility) → Phase 5 (Docs)
                           ↓                         ↓
                        Можно параллельно          Зависит от Phase 1-2
```

## Estimated Effort

- **Phase 1:** 2-3 часа (CSS audit + унификация + адаптивные размеры)
- **Phase 2:** 1.5-2 часа (Z-index verification + fixes)
- **Phase 3:** 2-3 часа (Контекстный Speed Dial + Staggered animation + TypeScript)
  - Контекстный подход ПРОЩЕ чем полный Speed Dial на всех страницах
  - /facts и /plan - одна кнопка (экономия времени)
- **Phase 4:** 1-2 часа (Visibility logic)
- **Phase 5:** 2-3 часа (Documentation + visual regression tests)

**Total:** 9-13 часов (на 1 час меньше благодаря контекстному подходу)

## Rollback Plan

**Checkpoint после каждой фазы:**
- Phase 1 checkpoint: CSS changes only (easy rollback)
- Phase 2 checkpoint: Z-index isolated (no functional changes)
- Phase 3 checkpoint: New TypeScript module (can be disabled)
- Phase 4 checkpoint: Visibility logic (conditional rendering)
- Phase 5 checkpoint: Documentation only (no code changes)

**Rollback procedure:**
```bash
# Rollback to specific phase
git checkout HEAD~N  # N = number of commits since phase start

# Or rollback specific files
git checkout HEAD -- frontend/web/static/css/custom.css
```

## Success Criteria

✅ **Phase 1:**
- [ ] FAB имеет одинаковое позиционирование на всех 4 страницах
- [ ] Размеры: Mobile 48px, Tablet 56px, Desktop 56px (эталон от /lists)
- [ ] Bottom navigation остаётся на mobile + FAB дополнительно над ним
- [ ] Visual regression tests проходят

✅ **Phase 2:**
- [ ] Нет z-index конфликтов при открытии Speed Dial
- [ ] FAB скрывается когда модаль открыта
- [ ] FAB (z-index: 40) ниже navbar (z-index: 50) на mobile
- [ ] E2E tests для layer interactions проходят

✅ **Phase 3:**
- [ ] **Контекстный Speed Dial работает:**
  - `/` - Speed Dial с 2 действиями (План + Факт)
  - `/facts` - Одна кнопка (только Факт) на mobile
  - `/plan` - Одна кнопка (только План) на mobile
  - Desktop - всегда Speed Dial для всех страниц
- [ ] **Staggered animation** для пунктов меню (задержки 0.05s, 0.1s)
- [ ] **ARIA live region** для screen readers работает
- [ ] **Offline mode:** Desktop FAB скрывает "План" в offline режиме
- [ ] Все кнопки функциональны (открывают модали)
- [ ] Unit tests для toggleMobileFabMenu() и updateOfflineVisibility() проходят

✅ **Phase 4:**
- [ ] FAB показывается ТОЛЬКО на /, /facts, /plan, /lists
- [ ] На /analytics FAB скрыт
- [ ] HTMX navigation корректно обновляет видимость

✅ **Phase 5:**
- [ ] Документация актуальна (включая контекстный подход)
- [ ] Visual regression tests добавлены (включая Staggered animation)
- [ ] Migration guide создан

## Risks and Mitigation

**Risk 1:** Breaking existing CSS на production
- **Mitigation:** Phase-based rollout с checkpoint между фазами
- **Test coverage:** Visual regression tests перед каждым deploy

**Risk 2:** Z-index конфликты с модалями
- **Mitigation:** Explicit testing всех layer interactions в Phase 2
- **Fallback:** `body.modal-open` класс для принудительного hide

**Risk 3:** HTMX navigation не обновляет FAB visibility
- **Mitigation:** Event listeners на `htmx:afterSwap`
- **Test coverage:** E2E tests для всех page transitions

## References

- **ЭТАЛОННАЯ РЕАЛИЗАЦИЯ:** `/lists` page (`fab_buttons.html`)
- **Explore документация:** `docs/explore/fab-speed-dial-analysis.md`
- **Z-Index система:** `docs/architecture/frontend/z-index-layering.md`
- **Responsive design:** `docs/architecture/frontend/responsive-design.md`
- **Material Design FAB:** https://m3.material.io/components/floating-action-button
