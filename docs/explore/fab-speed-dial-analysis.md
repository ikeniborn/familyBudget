# FAB (Floating Action Button) & Speed Dial - Анализ реализации

**Дата создания:** 2026-02-09
**Версия приложения:** v11.4+
**Цель:** Сравнительный анализ реализации кнопок Speed Dial на всех экранах приложения Family Budget

---

## Содержание

1. [Обзор системы FAB](#обзор-системы-fab)
2. [Сравнительная таблица реализаций](#сравнительная-таблица-реализаций)
3. [Детальный анализ компонентов](#детальный-анализ-компонентов)
4. [Стили и визуальное оформление](#стили-и-визуальное-оформление)
5. [Z-Index иерархия](#z-index-иерархия)
6. [Рекомендации по улучшению](#рекомендации-по-улучшению)

---

## Обзор системы FAB

Приложение использует **адаптивную систему FAB** с двумя режимами работы:

### Мобильный режим (< 1024px)
- **Bottom Navigation Bar** - фиксированная нижняя панель навигации с 5 кнопками
- **Mobile FAB** - отдельная плавающая кнопка "+" для создания записей (главная страница)
- **Lists FAB** - специализированная FAB для страницы списков покупок

### Desktop режим (≥ 1024px)
- **Desktop FAB (Speed Dial)** - плавающая кнопка с меню действий
- **Lists FAB (Speed Dial)** - расширенное меню для массовых операций

---

## Сравнительная таблица реализаций

| Критерий | **fab_toolbar.html** <br/>(Универсальный компонент) | **fab_buttons.html** <br/>(Списки покупок) | **Admin страницы** |
|----------|---------------------------------------------------|-------------------------------------------|-------------------|
| **Используется на страницах** | `/` (главная), `/facts`, `/plan` | `/lists` | `/admin_*` (stores, logs, product_groups) |
| **Мобильная навигация** | ✅ Bottom Nav Bar (5 кнопок) | ✅ Bottom Nav Bar (из base.html) | ❌ Отсутствует |
| **Desktop FAB** | ✅ Speed Dial (2 действия) | ✅ Speed Dial (4 действия) | ❌ Toolbar кнопки |
| **Mobile FAB** | ✅ Speed Dial (`/` только) <br/> Прямой вызов модалки (`/facts`, `/plan`) | ✅ Два типа FAB:<br/>1. Создание списка (Landing)<br/>2. Массовые операции (Detail) | ❌ |
| **Breakpoint адаптации** | 1024px | 1024px | N/A |
| **Z-Index (mobile)** | `var(--z-fab-mobile)` = 40 | `var(--z-fab-lists)` = 1003 | N/A |
| **Z-Index (desktop)** | `var(--z-fab-desktop)` = 1002 | `var(--z-fab-lists)` = 1003 | N/A |
| **Позиция (mobile)** | `right: 1rem; bottom: calc(7rem + safe-area)` | `right: 1rem; bottom: calc(4rem + 1rem + safe-area)` | N/A |
| **Позиция (desktop)** | `right: 1.5rem; bottom: 1.5rem` | `right: 1.5rem; bottom: 1.5rem` | N/A |
| **Размер FAB (mobile)** | 48px (< 640px) → 56px (≥ 640px) | 48px | N/A |
| **Размер FAB (desktop)** | 56px → 64px (≥ 1280px) | 56px → 64px (≥ 1280px) | N/A |
| **Анимация** | ✅ Вращение иконки 45° (Speed Dial) | ✅ Вращение иконки 90° | N/A |
| **Backdrop затемнение** | ✅ `rgba(0,0,0,0.3)` | ✅ `rgba(0,0,0,0.3)` | N/A |
| **Offline режим** | ✅ Скрывает онлайн-кнопки в Bottom Nav | ❌ Не применяется | N/A |
| **Контекстное поведение** | ✅ Speed Dial на `/`<br/>Прямая модалка на `/facts`, `/plan` | ✅ Landing View: создание списка<br/>Detail View: массовые операции | ❌ |
| **Поддержка iOS safe area** | ✅ `env(safe-area-inset-bottom)` | ✅ `env(safe-area-inset-bottom)` | N/A |
| **Keyboard навигация** | ✅ Escape закрывает меню | ✅ Escape закрывает меню | ❌ |
| **Accessibility** | ✅ `aria-label`, focus states | ✅ `aria-label`, focus states | ⚠️ Частично |
| **Reduced motion** | ✅ `prefers-reduced-motion` | ✅ `prefers-reduced-motion` | ❌ |

---

## Детальный анализ компонентов

### 1. fab_toolbar.html (Универсальный компонент)

**Расположение:** `frontend/web/templates/components/fab_toolbar.html`

#### Мобильная навигация (< 1024px)

```html
<!-- Bottom Navigation Bar -->
<div class="mobile-nav-wrapper">
  <div class="nav-container">
    <a href="/" class="icon-btn">Главная</a>
    <a href="/analytics" class="icon-btn" data-online-only>Аналитика</a>
    <a href="/facts" class="icon-btn" data-online-only>Факт</a>
    <a href="/plan" class="icon-btn" data-online-only>План</a>
    <a href="/lists" class="icon-btn">Списки</a>
  </div>
</div>
```

**Особенности:**
- 5 кнопок навигации (Главная, Аналитика, Факт, План, Списки)
- `data-online-only` - скрывает кнопки в offline режиме
- Фиксированная позиция `bottom: 0`
- Высота: ~64px (с учетом padding и safe area)

#### Desktop FAB (≥ 1024px)

```html
<!-- Speed Dial Menu -->
<div class="desktop-fab-wrapper fab-common-wrapper closed">
  <!-- Menu Items (появляются выше кнопки) -->
  <div class="fab-menu-item">
    <span class="badge">Добавить план</span>
    <button onclick="openModalPlan()">📅</button>
  </div>
  <div class="fab-menu-item">
    <span class="badge">Добавить факт</span>
    <button onclick="openModalFact()">📄</button>
  </div>

  <!-- Main FAB Button -->
  <button onclick="toggleDesktopFabMenu()" class="fab-button">+</button>
</div>
```

**Особенности:**
- 2 действия в Speed Dial меню
- Вращение иконки на 45° при открытии
- Staggered animation (каскадная анимация с задержками 0.05s, 0.1s)
- Backdrop затемнение фона при открытии

#### Mobile FAB (< 1024px, только на главной `/`)

```html
<!-- Mobile Speed Dial для главной страницы -->
<div class="fab-wrapper">
  <div id="fab-speed-dial-menu" style="display: none;">
    <div class="mobile-fab-item">
      <span class="mobile-fab-label">Добавить план</span>
      <button onclick="openModalPlan()">📅</button>
    </div>
    <div class="mobile-fab-item">
      <span class="mobile-fab-label">Добавить факт</span>
      <button onclick="openModalFact()">📄</button>
    </div>
  </div>

  <button onclick="toggleFabMenu()" class="fab-button">+</button>
</div>
```

**Особенности:**
- Отображается **только на главной странице** (`/`)
- На `/facts` и `/plan` - прямой вызов модалки без Speed Dial
- Позиция: `right: 1rem; bottom: calc(7rem + safe-area)`
- Вращение иконки на 45° при открытии

---

### 2. fab_buttons.html (Списки покупок)

**Расположение:** `frontend/web/templates/components/lists/fab_buttons.html`

#### Landing View FAB (создание списка)

```html
<!-- FAB для создания списка (ALL devices) -->
<button id="create-list-fab"
        onclick="openCreateListModal()"
        class="lists-fab-menu fixed bottom-6 right-6">
  +
</button>
```

**Особенности:**
- Простая кнопка без Speed Dial
- Видна на **всех устройствах** (desktop + mobile)
- Позиция: `right: 1rem; bottom: calc(4rem + 1rem + safe-area)` (mobile)
- Размер: 48px (mobile) → 56px (desktop) → 64px (≥1280px)

#### Detail View FAB (массовые операции)

```html
<!-- FAB Speed Dial для массовых операций (ALL devices) -->
<div id="lists-fab-menu" class="fab-menu closed">
  <!-- Main FAB button (⋮ вертикальные точки) -->
  <button onclick="toggleListsFAB()" class="fab-main">⋮</button>

  <!-- Speed Dial items -->
  <div class="fab-item">
    <span class="badge">Добавить товар</span>
    <button onclick="openAddItemModal()">+</button>
  </div>
  <div class="fab-item">
    <span class="badge">Удалить выполненные</span>
    <button onclick="deleteCompletedWithConfirm()">🗑️</button>
  </div>
  <div class="fab-item">
    <span class="badge">Отметить все</span>
    <button onclick="markAllCompletedWithConfirm()">✅</button>
  </div>
  <div class="fab-item">
    <span class="badge">Снять все отметки</span>
    <button onclick="unmarkAllCompletedWithConfirm()">❌</button>
  </div>
</div>
```

**Особенности:**
- **4 действия** в Speed Dial меню
- Иконка: вертикальные точки (⋮) вращаются на **90°** при открытии
- Видна на **всех устройствах** (desktop + mobile)
- Позиция аналогична Landing View FAB
- Staggered animation с 4 задержками

---

### 3. Admin страницы (stores, logs, product_groups)

**Кнопки действий:** Интегрированы в **toolbar/header** страницы

```html
<!-- admin_stores.html -->
<button class="btn btn-sm btn-success" onclick="showCreateModal()">
  + Новый магазин
</button>

<!-- admin_logs.html -->
<!-- Нет FAB - используются фильтры и селекторы -->

<!-- admin_product_groups.html -->
<button class="btn btn-sm btn-success" onclick="showCreateModal()">
  + Новая группа
</button>
```

**Особенности:**
- **НЕТ FAB** - используются inline кнопки в toolbar
- Desktop-ориентированный интерфейс
- Мобильная версия: страница `/admin_logs` скрыта (показывает alert)

---

## Стили и визуальное оформление

### Material Design размеры (custom.css)

| Размер экрана | Размер FAB | Размер иконки | Применение |
|---------------|------------|---------------|------------|
| **< 640px** (mobile) | 48px | 24px | Компактный для мобильных |
| **640px - 1279px** (tablet/desktop) | 56px | 24px | Стандартный Material Design |
| **≥ 1280px** (large desktop) | 64px | 28px | Увеличенный для больших экранов |

### Стили из custom.css

```css
/* FAB Button - Material Design Elevation 6 */
.fab-button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: oklch(var(--p)) !important;
  color: oklch(var(--pc)) !important;

  box-shadow:
    0 3px 5px -1px rgba(0, 0, 0, 0.2),
    0 6px 10px 0 rgba(0, 0, 0, 0.14),
    0 1px 18px 0 rgba(0, 0, 0, 0.12);
}

/* Hover - Elevation 8 */
.fab-button:hover {
  box-shadow:
    0 5px 5px -3px rgba(0, 0, 0, 0.2),
    0 8px 10px 1px rgba(0, 0, 0, 0.14),
    0 3px 14px 2px rgba(0, 0, 0, 0.12);
  transform: scale(1.05);
}

/* Active - Elevation 12 */
.fab-button:active {
  box-shadow:
    0 7px 8px -4px rgba(0, 0, 0, 0.2),
    0 12px 17px 2px rgba(0, 0, 0, 0.14),
    0 5px 22px 4px rgba(0, 0, 0, 0.12);
  transform: scale(0.95);
}
```

### Стили из lists.css (специфичные для /lists)

```css
/* Lists FAB - Desktop adaptive sizing */
@media (min-width: 1024px) {
  #create-list-fab,
  .fab-main {
    width: 56px !important;
    height: 56px !important;
    border-radius: 50% !important;
  }
}

@media (min-width: 1280px) {
  #create-list-fab,
  .fab-main {
    width: 64px !important;
    height: 64px !important;
  }
}
```

### Анимации

#### 1. Speed Dial открытие/закрытие

```css
/* Closed state */
.fab-menu.closed .fab-item {
  opacity: 0;
  transform: scale(0.5) translateY(20px);
  pointer-events: none;
}

/* Open state */
.fab-menu.open .fab-item {
  opacity: 1;
  transform: scale(1) translateY(0);
  pointer-events: auto;
}

/* Staggered animation */
.fab-item:nth-child(1) { transition-delay: 0.05s; }
.fab-item:nth-child(2) { transition-delay: 0.1s; }
.fab-item:nth-child(3) { transition-delay: 0.15s; }
.fab-item:nth-child(4) { transition-delay: 0.2s; }
```

#### 2. Вращение иконки

```css
/* Universal FAB (fab_toolbar.html) - 45° rotation */
.desktop-fab-wrapper.open .fab-button svg {
  transform: rotate(45deg);
}

/* Lists FAB (fab_buttons.html) - 90° rotation */
.fab-menu.open .fab-main {
  transform: rotate(90deg);
}
```

#### 3. Backdrop затемнение

```css
/* Desktop FAB Backdrop */
.fab-common-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  opacity: 0;
  pointer-events: none;
  z-index: var(--z-fab-backdrop); /* 1000 */
  transition: opacity 0.3s ease-out;
}

.fab-common-wrapper.open ~ .fab-common-backdrop {
  opacity: 1 !important;
  pointer-events: auto !important;
}
```

---

## Z-Index иерархия

### Централизованная система (z-index-variables.css)

```css
:root {
  /* FAB Navigation System */
  --z-fab-lists: 1003;      /* Lists page FAB main button (⋮) */
  --z-fab-lists-menu: 1001; /* Lists page FAB menu items */
  --z-fab-desktop: 1002;    /* Desktop FAB (≥1024px) */
  --z-fab-backdrop: 1000;   /* Desktop FAB backdrop */
  --z-fab-mobile: 40;       /* Mobile FAB (<1024px, below navbar) */

  /* Navigation & Dropdowns */
  --z-navbar: 50;           /* Mobile bottom navbar */

  /* Modal System */
  --z-dialog: 1050;         /* DaisyUI dialog/modal */
  --z-modal-backdrop: 999;  /* Backdrop overlay */
}
```

### Визуальная иерархия

```
Layer 13: Admin Panel (99999)
Layer 12: Autocomplete (9999)
Layer 11: Calendar Modal (2000)
Layer 10: Dialog/Modal (1050)
Layer 9:  Lists FAB Main (1003)
Layer 8:  Desktop FAB (1002)
Layer 7:  Lists FAB Menu (1001)
Layer 6:  FAB Backdrop (1000)
Layer 5:  Modal Backdrop (999)
Layer 4:  Dropdown (60)
Layer 3:  Navbar (50)
Layer 2:  Mobile FAB (40)
Layer 1:  Base Content (1)
```

### Критические правила

1. **Mobile FAB** (`z-index: 40`) всегда **ниже navbar** (`z-index: 50`)
2. **Desktop FAB** (`z-index: 1002`) **выше backdrop** (`z-index: 1000`)
3. **Lists FAB** имеет **наивысший z-index среди FAB** (`z-index: 1003`)
4. **Все FAB ниже модалок** (modal backdrop `z-index: 999`)

---

## Рекомендации по улучшению

### 1. Унификация поведения

**Проблема:** Разное поведение FAB на разных страницах

| Страница | Mobile FAB поведение |
|----------|----------------------|
| `/` | Speed Dial меню |
| `/facts` | Прямой вызов modal_fact |
| `/plan` | Прямой вызов modal_plan |
| `/lists` | Speed Dial (Detail View) или прямой вызов (Landing View) |

**Рекомендация:**
- Унифицировать логику: либо везде Speed Dial, либо везде прямой вызов
- Предложение: Speed Dial на **всех страницах** для консистентности

### 2. Оптимизация z-index

**Проблема:** Lists FAB имеет самый высокий z-index (1003), но используется только на одной странице

**Рекомендация:**
```css
/* Предложение: единый z-index для всех FAB */
:root {
  --z-fab-all-pages: 1002;  /* Единый z-index для fab_toolbar и fab_buttons */
  --z-fab-menu: 1001;       /* Меню Speed Dial */
  --z-fab-backdrop: 1000;   /* Backdrop */
}
```

### 3. Accessibility улучшения

**Текущее состояние:**
- ✅ `aria-label` на кнопках
- ✅ Keyboard navigation (Escape)
- ⚠️ Отсутствует live region для screen readers при открытии/закрытии меню

**Рекомендация:**
```html
<!-- Добавить ARIA live region -->
<div id="fab-status" role="status" aria-live="polite" class="sr-only"></div>

<script>
function toggleFabMenu() {
  const isOpen = wrapper.classList.contains('open');
  const status = document.getElementById('fab-status');
  status.textContent = isOpen
    ? 'Меню действий открыто. 2 опции доступны.'
    : 'Меню действий закрыто.';
}
</script>
```

### 4. Производительность

**Текущее состояние:**
- ✅ GPU acceleration через `transform: translateZ(0)`
- ✅ `will-change` при hover/active
- ⚠️ Множественные event listeners без debounce

**Рекомендация:**
```javascript
// Debounce для resize listener (fab_toolbar.html)
let resizeTimeout;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(applyFabPageContext, 200);
});
```

### 5. Consistency в naming

**Проблема:** Разные naming conventions:
- `fab-wrapper` (mobile FAB на `/`)
- `desktop-fab-wrapper` (desktop FAB на `/`, `/facts`, `/plan`)
- `lists-fab-menu` (FAB на `/lists`)
- `fab-common-wrapper` (CSS класс для desktop FAB)

**Рекомендация:**
```css
/* Предложение: унифицированный naming */
.fab-mobile-wrapper       /* Мобильная FAB обертка */
.fab-desktop-wrapper      /* Desktop FAB обертка */
.fab-speed-dial-menu      /* Speed Dial меню */
.fab-backdrop             /* Backdrop */
```

### 6. Offline mode индикация

**Текущее состояние:**
- ✅ Bottom Nav скрывает онлайн-кнопки
- ❌ Desktop FAB **НЕ адаптируется** к offline режиму

**Рекомендация:**
```javascript
// Добавить offline адаптацию для Desktop FAB
function updateOfflineVisibility() {
  const isOffline = document.documentElement.classList.contains('offline-mode');
  const desktopFab = document.querySelector('.desktop-fab-wrapper');

  if (isOffline && desktopFab) {
    // Скрыть "Добавить план" (требует сервер)
    // Оставить "Добавить факт" (работает offline через Dexie.js)
    const planMenuItem = desktopFab.querySelector('[onclick*="openModalPlan"]').closest('.fab-menu-item');
    planMenuItem.style.display = isOffline ? 'none' : '';
  }
}
```

### 7. Touch optimization

**Текущее состояние:**
- ✅ Минимальный размер 48px (WCAG 2.1 Level AA)
- ✅ `-webkit-tap-highlight-color: transparent`
- ⚠️ Нет haptic feedback на мобильных

**Рекомендация:**
```javascript
// Добавить вибрацию при открытии Speed Dial (если поддерживается)
function toggleFabMenu() {
  if (navigator.vibrate) {
    navigator.vibrate(10); // 10ms короткая вибрация
  }
  // ... existing code
}
```

---

## Заключение

### Сильные стороны текущей реализации

1. ✅ **Адаптивность** - корректная работа на всех размерах экранов
2. ✅ **Material Design** - следование гайдлайнам (elevation, размеры, анимации)
3. ✅ **iOS safe area** - полная поддержка notch/home indicator
4. ✅ **Accessibility** - базовая поддержка ARIA и keyboard navigation
5. ✅ **Performance** - GPU acceleration и `will-change` оптимизации
6. ✅ **Централизованный z-index** - единая система управления слоями

### Области для улучшения

1. ⚠️ **Унификация поведения** - разное поведение FAB на разных страницах
2. ⚠️ **Offline адаптация** - Desktop FAB не адаптируется к offline режиму
3. ⚠️ **Accessibility** - отсутствие live regions для screen readers
4. ⚠️ **Naming consistency** - разные naming conventions в разных компонентах
5. ⚠️ **Admin страницы** - отсутствие FAB (можно добавить для consistency)

### Метрики

| Метрика | Значение |
|---------|----------|
| **Количество FAB компонентов** | 3 (fab_toolbar, mobile FAB, lists FAB) |
| **Breakpoints** | 2 (1024px, 1280px) |
| **Z-Index слоев** | 13 слоев (от 1 до 99999) |
| **Размеры FAB** | 48px / 56px / 64px |
| **Анимации** | 5 типов (fade, scale, rotate, slide, elevation) |
| **Поддержка устройств** | ✅ Mobile, Tablet, Desktop, iOS notch |

---

**Версия документа:** 1.0
**Автор:** Claude Sonnet 4.5
**Дата последнего обновления:** 2026-02-09
