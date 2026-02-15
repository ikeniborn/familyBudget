# Mobile Adaptation: Admin Reference Pages

## Context

**Problem:** 4 из 6 справочников админ-панели недоступны на мобильных устройствах (< 768px):
- Категории (`/admin/articles`)
- Места затрат (`/admin/cost-centers`)
- Счета (`/admin/financial-centers`)
- Пользователи (`/admin/users`)

**Root Causes:**
1. Пункты меню скрыты на мобильных (`hidden md:block` в `user_dropdown_menu.html`)
2. Страницы показывают alert "Страница недоступна на мобильных" (`mobile_restriction_alert()`)
3. Основной контент скрыт на мобильных (`<div class="hidden md:block">`)

**Current State:**
- 2 справочника (Магазины, Группы товаров) частично адаптированы (без alert, но с минимальной оптимизацией)
- Табличная структура не оптимальна для мобильных экранов (12+ колонок для Users)

**Goal:** Сделать все 6 справочников полностью доступными и удобными на мобильных устройствах, сохранив весь функционал (CRUD, фильтры, поиск).

---

## Recommended Approach

### Core Strategy

**Dual-Layout Pattern:** Desktop (≥768px) = таблицы, Mobile (<768px) = карточки

```html
<!-- Mobile Cards (NEW) -->
<div class="md:hidden space-y-4" id="mobile-container">
    <!-- Card-based layout for touch devices -->
</div>

<!-- Desktop Table (EXISTING, wrapped) -->
<div class="hidden md:block">
    <table class="table">...</table>
</div>
```

### Mobile Card Structure (Reusable Template)

```html
<div class="card bg-base-100 shadow-md border border-base-300">
    <div class="card-body p-4 space-y-3">
        <!-- Header: Name + Status Badge -->
        <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold text-base flex-1">{name}</h3>
            <span class="badge badge-warning badge-sm">📦 архив</span>
        </div>

        <!-- Info Grid: Key-Value Pairs -->
        <div class="grid grid-cols-2 gap-2 text-sm">
            <div><span class="text-base-content/60">Код:</span> {code}</div>
            <div><span class="text-base-content/60">Создан:</span> {date}</div>
        </div>

        <!-- Actions Row -->
        <div class="flex gap-2 pt-2 border-t border-base-300">
            <button class="btn btn-sm btn-primary flex-1">✏️ Изменить</button>
        </div>
    </div>
</div>
```

### Hierarchical Pages (Categories, Product Groups)

**Visual Indentation via Left Margin:**
```html
<div class="card border-l-4 border-success"
     style="margin-left: {{ level * 1.5 }}rem;">
    <!-- level 0 = 0rem, level 1 = 1.5rem, level 2 = 3rem -->
</div>
```

**Parent Context Indicator:**
```html
{% if item.parent_id %}
<div class="text-xs text-base-content/60">↳ Подкатегория</div>
{% endif %}
```

### Mobile Filters (Collapsible)

```html
<div class="md:hidden collapse collapse-arrow bg-base-200 mb-4">
    <input type="checkbox" id="mobile-filters-toggle" />
    <div class="collapse-title text-sm font-medium">🔍 Фильтры и поиск</div>
    <div class="collapse-content space-y-3">
        <!-- Vertical stacked filters -->
    </div>
</div>
```

---

## Critical Files

### 1. Mobile Menu Navigation

**File:** `frontend/web/templates/components/user_dropdown_menu.html`

**Changes (Lines 157-159, 166, 168):**
```diff
-<li class="hidden md:block" data-offline-hidden="true"><a href="/admin/articles" data-nav-item>📁 Категории</a></li>
-<li class="hidden md:block" data-offline-hidden="true"><a href="/admin/cost-centers" data-nav-item>💼 Места затрат</a></li>
-<li class="hidden md:block" data-offline-hidden="true"><a href="/admin/financial-centers" data-nav-item>🏢 Счета</a></li>
+<li data-offline-hidden="true"><a href="/admin/articles" data-nav-item>📁 Категории</a></li>
+<li data-offline-hidden="true"><a href="/admin/cost-centers" data-nav-item>💼 Места затрат</a></li>
+<li data-offline-hidden="true"><a href="/admin/financial-centers" data-nav-item>🏢 Счета</a></li>

-<li class="hidden md:block" data-offline-hidden="true"><a href="/admin/users" data-nav-item>👥 Пользователи</a></li>
+<li data-offline-hidden="true"><a href="/admin/users" data-nav-item>👥 Пользователи</a></li>
```

**Optional:** Also update Line 168 (Системные логи) if user requests it.

---

### 2. Page Templates (Priority Order)

#### Phase 1: Simple Pages (Start Here)

**2.1 Accounts** - `frontend/web/templates/admin_financial_centers.html`
- **Complexity:** LOW (5 columns, flat table)

**Template Changes:**

1. **Line 3:** Remove import of mobile_alert macro
```diff
-{% from "components/mobile_alert.html" import mobile_restriction_alert %}
```

2. **Lines 8-12:** Remove mobile restriction alert and hidden wrapper
```diff
-<!-- Mobile restriction alert (from macro) -->
-{{ mobile_restriction_alert() }}
-
-<!-- Main content (hidden on mobile) -->
-<div class="hidden md:block space-y-6">
+<!-- Main content -->
+<div class="space-y-6">
```

3. **Line 35 (in card-body):** Add mobile cards container BEFORE table container
```html
<!-- NEW: Mobile cards container -->
<div id="centers-cards-container" class="md:hidden space-y-4"></div>

<!-- Existing: Desktop table container (add responsive class) -->
<div id="centers-table-container" class="hidden md:block min-h-[200px]">
```

4. **Line 42:** Remove duplicate closing div (artifact from removing wrapper)
```diff
-</div>
 </div>
```

**JavaScript Changes (lines 111-532):**

1. **After line 165 (after loadCenters function):** Add mobile card rendering function (~50 lines)
2. **Line 168 (renderCentersTable):** Keep as-is (desktop table)
3. **Line 123 (onStatusFilterChange):** Add call to renderMobileCards
4. **Line 154 (loadCenters success):** Add call to renderMobileCards

**Card Fields:** Name, Code, Description, Created Date, Actions (Edit, Archive/Restore if admin)

**2.2 Stores** - `frontend/web/templates/admin_stores.html`
- **Complexity:** LOW (already partial responsive)
- **Changes:**
  1. Improve existing structure (already no alert/hiding)
  2. Add mobile card layout to replace `hidden md:table-cell` pattern
  3. Update JavaScript rendering
- **Card Fields:** Name, Address, Code, Status, Actions

#### Phase 2: Medium Complexity

**2.3 Cost Centers** - `frontend/web/templates/admin_cost_centers.html`
- **Complexity:** MEDIUM (6 columns, financial centers multiselect)
- **Changes:**
  1. Remove mobile alert (line ~9)
  2. Remove `hidden md:block` wrapper
  3. Add mobile cards with badge list for financial centers
  4. Update JavaScript rendering
- **Card Fields:** Name, Code, Financial Centers (badges), Description, Created, Actions
- **Special:** Financial centers shown as badge list instead of table cell

#### Phase 3: High Complexity (Hierarchical)

**2.4 Product Groups** - `frontend/web/templates/admin_product_groups.html`
- **Complexity:** HIGH (hierarchical tree structure)
- **Changes:**
  1. Remove mobile restrictions (no alert currently, but minimal responsive)
  2. Add hierarchical mobile cards with left margin indentation
  3. Show parent context ("↳ Подкатегория")
  4. Update JavaScript to preserve tree structure in cards
- **Card Fields:** Name, Code, Parent (if any), Status, Level indicator, Actions
- **Hierarchy Rendering:** `style="margin-left: {{ level * 1.5 }}rem;"`

**2.5 Categories** - `frontend/web/templates/admin_articles.html`
- **Complexity:** VERY HIGH (complex hierarchy + type filters + 6+ columns)

**Special Requirements:**
1. Hierarchical tree structure (parent-child relationships)
2. Type filter (Income/Expense/Debit/Credit)
3. Search input
4. Financial centers assignment (leaf categories only)
5. User ownership

**Template Changes:**

1. Remove mobile alert and hidden wrapper (same as Accounts)
2. Add collapsible mobile filter panel:
```html
<!-- Mobile Filters (collapsible) -->
<div class="md:hidden collapse collapse-arrow bg-base-200 mb-4">
    <input type="checkbox" id="mobile-filters-toggle" />
    <div class="collapse-title text-sm font-medium">🔍 Фильтры и поиск</div>
    <div class="collapse-content space-y-3">
        <!-- Type Select -->
        <select id="type-filter-mobile" class="select select-bordered select-sm w-full" onchange="updateTypeFilter(this.value)">
            <option value="all">📋 Все типы</option>
            <option value="income">💰 Доход</option>
            <option value="expense">💸 Расход</option>
            <option value="debit">📤 Списание</option>
            <option value="credit">📥 Пополнение</option>
        </select>

        <!-- Search Input -->
        <input type="text" id="search-mobile" placeholder="Поиск..." class="input input-bordered input-sm w-full" oninput="handleSearch(this.value)" />

        <!-- Status Buttons -->
        <div class="btn-group btn-group-vertical w-full">
            <button class="btn btn-sm btn-active" id="status-all-mobile" onclick="updateStatusFilter('all')">📋 Все</button>
            <button class="btn btn-sm" id="status-active-mobile" onclick="updateStatusFilter('active')">✅ Активные</button>
            <button class="btn btn-sm" id="status-archived-mobile" onclick="updateStatusFilter('archived')">📦 Архивные</button>
        </div>
    </div>
</div>
```

3. Add mobile cards and desktop table containers

**JavaScript Hierarchical Rendering:**
```javascript
function renderArticleCards(articles) {
    // Build parent-child map
    const articleMap = new Map();
    const rootArticles = [];

    articles.forEach(art => {
        articleMap.set(art.id, { ...art, children: [] });
    });

    articles.forEach(art => {
        if (art.parent_id) {
            const parent = articleMap.get(art.parent_id);
            if (parent) {
                parent.children.push(articleMap.get(art.id));
            }
        } else {
            rootArticles.push(articleMap.get(art.id));
        }
    });

    // Recursive render
    function renderWithChildren(article, level = 0) {
        const borderColor = {
            'income': 'border-success',
            'expense': 'border-error',
            'debit': 'border-info',
            'credit': 'border-warning'
        }[article.type] || 'border-base-300';

        const parentInfo = article.parent_id ? `
            <div class="text-xs text-base-content/60">↳ Подкатегория</div>
        ` : '';

        let html = `
            <div class="card bg-base-100 shadow-md border-l-4 ${borderColor}"
                 style="margin-left: ${level * 1.5}rem;">
                <div class="card-body p-4 space-y-2">
                    <div class="flex items-start justify-between gap-2">
                        <h3 class="font-semibold text-base flex-1">${article.name}</h3>
                        <span class="badge badge-sm">${getTypeIcon(article.type)}</span>
                    </div>
                    ${parentInfo}
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div><span class="text-base-content/60">Код:</span> ${article.code || '—'}</div>
                        <div><span class="text-base-content/60">Уровень:</span> ${level + 1}</div>
                    </div>
                    <div class="flex gap-2 pt-2 border-t">
                        <button class="btn btn-sm btn-primary flex-1" onclick="showEditModal(${article.id})">
                            ✏️ Изменить
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Render children recursively
        if (article.children && article.children.length > 0) {
            article.children.forEach(child => {
                html += renderWithChildren(child, level + 1);
            });
        }

        return html;
    }

    let html = '';
    rootArticles.forEach(art => {
        html += renderWithChildren(art, 0);
    });

    return html;
}
```

**Card Fields:** Name, Type (badge), Code, Financial Centers, Owner, Level, Parent indicator, Actions
**Border Color Coding:** green (income) / red (expense) / blue (debit) / yellow (credit)

#### Phase 4: Very High Complexity

**2.6 Users** - `frontend/web/templates/admin_users.html`
- **Complexity:** VERY HIGH (12+ columns, stats cards, complex action menu)

**Table Columns (Desktop):**
1. Telegram ID
2. Email
3. Photo (avatar)
4. Username
5. First Name
6. Role (admin/user)
7. Two-Factor Auth (enabled/disabled)
8. Biometric (WebAuthn)
9. Status (active/inactive)
10. Last Login
11. Created Date
12. Actions (dropdown with 7+ items)

**Template Changes:**

1. **Stats Cards:** Already responsive (`stats stats-vertical lg:stats-horizontal`) - NO CHANGES NEEDED

2. **Mobile User Cards:** Complex structure with avatar, badges, contact info, stats, dropdown

**JavaScript Card Rendering Example:**
```javascript
function renderUserCards(users) {
    const container = document.getElementById('users-cards-container');

    // Apply filters (same as desktop)
    let filteredUsers = users;
    if (currentStatusFilter === 'active') {
        filteredUsers = users.filter(u => u.is_active !== false);
    } else if (currentStatusFilter === 'inactive') {
        filteredUsers = users.filter(u => u.is_active === false);
    }

    if (filteredUsers.length === 0) {
        container.innerHTML = '<div class="text-center py-8">Пользователи не найдены</div>';
        return;
    }

    let html = '';
    filteredUsers.forEach(user => {
        const isActive = user.is_active !== false;
        const statusBadge = isActive ? '' : '<span class="badge badge-error badge-xs">Неактивен</span>';
        const adminBadge = user.is_admin ? '<span class="badge badge-warning badge-xs">🔑 Админ</span>' : '';
        const twoFactorBadge = user.two_factor_enabled ? '<span class="badge badge-success badge-xs">2FA</span>' : '';
        const biometricBadge = user.webauthn_enabled ? '<span class="badge badge-info badge-xs">👆 Биометрия</span>' : '';

        const photoUrl = user.photo_url || '';
        const avatarHtml = photoUrl ? `
            <img src="${photoUrl}" alt="${user.first_name}" />
        ` : `
            <span class="text-lg">${user.first_name ? user.first_name[0].toUpperCase() : '?'}</span>
        `;

        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('ru-RU') : '—';
        const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '—';

        html += `
            <div class="card bg-base-100 shadow-md border border-base-300">
                <div class="card-body p-4 space-y-3">
                    <!-- Avatar + Name + Badges -->
                    <div class="flex items-start gap-3">
                        <div class="avatar${!photoUrl ? ' placeholder' : ''}">
                            <div class="w-12 h-12 rounded-full ${!photoUrl ? 'bg-neutral-focus text-neutral-content' : ''}">
                                ${avatarHtml}
                            </div>
                        </div>
                        <div class="flex-1">
                            <h3 class="font-semibold text-base">${user.first_name || 'Без имени'}</h3>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${adminBadge}
                                ${twoFactorBadge}
                                ${biometricBadge}
                                ${statusBadge}
                            </div>
                        </div>
                    </div>

                    <!-- Contact Info -->
                    <div class="space-y-1 text-sm">
                        ${user.telegram_id ? `<div>📱 Telegram: <span class="font-mono">${user.telegram_id}</span></div>` : ''}
                        ${user.email ? `<div>📧 Email: <span class="text-xs">${user.email}</span></div>` : ''}
                        ${user.username ? `<div>👤 Username: @${user.username}</div>` : ''}
                    </div>

                    <!-- Stats Grid -->
                    <div class="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-base-300">
                        <div><span class="text-base-content/60">Создан:</span> ${createdDate}</div>
                        <div><span class="text-base-content/60">Вход:</span> ${lastLogin}</div>
                        <div><span class="text-base-content/60">Фактов:</span> <span class="font-semibold">${user.facts_count || 0}</span></div>
                        <div><span class="text-base-content/60">ID:</span> <span class="font-mono">${user.id}</span></div>
                    </div>

                    <!-- Action Dropdown (opens upward to prevent cutoff) -->
                    <div class="dropdown dropdown-top w-full pt-2 border-t border-base-300">
                        <button class="btn btn-sm btn-primary w-full">
                            ⚙️ Действия
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>
                        <ul class="dropdown-content menu p-2 shadow-xl bg-base-100 rounded-box w-full mb-2 z-10">
                            <li><a onclick="showEditModal(${user.id})">✏️ Редактировать</a></li>
                            ${isActive ? `
                                <li><a onclick="deactivateUser(${user.id})">⏸️ Деактивировать</a></li>
                            ` : `
                                <li><a onclick="activateUser(${user.id})">▶️ Активировать</a></li>
                            `}
                            ${user.is_admin ? `
                                <li><a onclick="removeAdminRole(${user.id})">👤 Снять роль админа</a></li>
                            ` : `
                                <li><a onclick="grantAdminRole(${user.id})">🔑 Назначить админом</a></li>
                            `}
                            <li><a onclick="refreshTelegramData(${user.id})">🔄 Обновить из Telegram</a></li>
                            ${user.two_factor_enabled ? `
                                <li><a onclick="reset2FA(${user.id})">🔓 Сбросить 2FA</a></li>
                            ` : ''}
                            <li><a onclick="resetPassword(${user.id})">🔑 Сбросить пароль</a></li>
                            ${user.webauthn_enabled ? `
                                <li><a onclick="resetWebAuthn(${user.id})">👆 Сбросить биометрию</a></li>
                            ` : ''}
                            <li class="divider"></li>
                            <li><a onclick="deleteUser(${user.id})" class="text-error">🗑️ Удалить</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}
```

**Key Features:**
- **Avatar:** 48px circle with photo or initials placeholder
- **Badges:** Admin, 2FA, Biometric, Status (stacked horizontally)
- **Contact Info:** Telegram ID, Email, Username (conditional display)
- **Stats Grid:** 2x2 grid with Created, Last Login, Facts Count, User ID
- **Dropdown:** Opens upward (`dropdown-top`) with 7+ conditional actions
- **Full Width:** Button and dropdown take full card width for easy touch

---

## JavaScript Architecture Analysis

### Current Architecture (Embedded in Templates)

**Key Finding:** JavaScript is embedded in `{% block extra_scripts %}` in each template, not in separate `.js` files.

**Example from admin_financial_centers.html (lines 111-532):**
```javascript
// Global state
let centersData = [];
let currentStatusFilter = 'all';

// Single render function (DESKTOP ONLY currently)
function renderCentersTable(centers) {
    const container = document.getElementById('centers-table-container');

    // Filter by status
    let filteredCenters = centers;
    if (currentStatusFilter === 'active') {
        filteredCenters = centers.filter(c => c.is_active !== false);
    } else if (currentStatusFilter === 'archived') {
        filteredCenters = centers.filter(c => c.is_active === false);
    }

    // Build HTML string (desktop table)
    let html = `<div class="overflow-x-auto"><table class="table">...</table></div>`;
    container.innerHTML = html;
}

// Status filter callback (used by adminStatusFilter.js)
window.onStatusFilterChange = function(status) {
    currentStatusFilter = status;
    renderCentersTable(centersData);  // ← Only desktop rendering
};
```

**Existing Utilities:**
- `/static/js/utils/deleteButtonUtils.js` - `renderDeleteButtonDesktop()` function
- `/static/js/adminStatusFilter.js` - Status filter component (all/active/archived)
- `/static/js/confirm-dialog.min.js` - Confirmation dialogs

---

## Dual Rendering Pattern (NEW)

### HTML Structure Changes

**BEFORE (Desktop Only):**
```html
<div class="card bg-base-100 shadow-lg">
    <div class="card-body">
        <!-- Header + Status Filter -->

        <div id="centers-table-container" class="min-h-[200px]">
            <!-- Desktop table rendered here via JS -->
        </div>
    </div>
</div>
```

**AFTER (Desktop + Mobile):**
```html
<div class="card bg-base-100 shadow-lg">
    <div class="card-body">
        <!-- Header + Status Filter -->

        <!-- NEW: Mobile cards container -->
        <div id="centers-cards-container" class="md:hidden space-y-4"></div>

        <!-- Existing: Desktop table container -->
        <div id="centers-table-container" class="hidden md:block min-h-[200px]">
            <!-- Desktop table rendered here via JS -->
        </div>
    </div>
</div>
```

### JavaScript Pattern (ADD to existing code)

**1. Add Mobile Card Rendering Function:**
```javascript
// NEW: Render mobile cards
function renderMobileCards(centers) {
    const container = document.getElementById('centers-cards-container');

    // Apply same filter logic as desktop table
    let filteredCenters = centers;
    if (currentStatusFilter === 'active') {
        filteredCenters = centers.filter(c => c.is_active !== false);
    } else if (currentStatusFilter === 'archived') {
        filteredCenters = centers.filter(c => c.is_active === false);
    }

    if (filteredCenters.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-base-content/60">Записи не найдены</div>';
        return;
    }

    let html = '';
    filteredCenters.forEach(center => {
        const isArchived = center.is_active === false;
        const archivedBadge = isArchived ? '<span class="badge badge-warning badge-sm">📦 архив</span>' : '';
        const createdDate = center.created_at ? new Date(center.created_at).toLocaleDateString('ru-RU') : '—';

        html += `
            <div class="card bg-base-100 shadow-md border border-base-300">
                <div class="card-body p-4 space-y-3">
                    <div class="flex items-start justify-between gap-2">
                        <h3 class="font-semibold text-base flex-1">${center.name}</h3>
                        ${archivedBadge}
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div><span class="text-base-content/60">Код:</span> <span class="font-mono">${center.code || '—'}</span></div>
                        <div><span class="text-base-content/60">Создан:</span> ${createdDate}</div>
                    </div>
                    ${center.description ? `<p class="text-sm text-base-content/70">${center.description}</p>` : ''}
                    <div class="flex gap-2 pt-2 border-t border-base-300">
                        <button class="btn btn-sm btn-primary flex-1" onclick="showEditModal(${center.id})">
                            ✏️ Изменить
                        </button>
                        ${isAdmin && !isArchived ? `
                            <button class="btn btn-sm btn-warning" onclick="archiveCenter(${center.id})" title="Архивировать">
                                📦
                            </button>
                        ` : ''}
                        ${isAdmin && isArchived ? `
                            <button class="btn btn-sm btn-success" onclick="restoreCenter(${center.id})" title="Восстановить">
                                ♻️
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}
```

**2. Update Desktop Table Rendering (wrap in hidden md:block):**
```javascript
// MODIFIED: Wrap table in responsive div
function renderCentersTable(centers) {
    const container = document.getElementById('centers-table-container');

    // ... existing filter logic ...

    // CHANGE: Wrap table in div (responsive hiding handled by container now)
    let html = `
        <div class="overflow-x-auto">
            <table class="table table-zebra table-sm">
                <!-- existing table markup -->
            </table>
        </div>
    `;

    container.innerHTML = html;
}
```

**3. Update Status Filter Callback (call both renderers):**
```javascript
// MODIFIED: Re-render both mobile and desktop
window.onStatusFilterChange = function(status) {
    currentStatusFilter = status;
    renderCentersTable(centersData);   // Desktop table
    renderMobileCards(centersData);    // Mobile cards
};
```

**4. Update Load Function (call both renderers):**
```javascript
// MODIFIED: Render both views on initial load
async function loadCenters() {
    // ... existing fetch logic ...

    centersData = data.financial_centers || [];

    renderCentersTable(centersData);   // Desktop table
    renderMobileCards(centersData);    // Mobile cards ← ADD THIS
}
```

### Import deleteButtonUtils.js

**Add to template `{% block extra_scripts %}`:**
```html
<script src="/static/js/utils/deleteButtonUtils.js?v=PLACEHOLDER"></script>
<script src="/static/js/confirm-dialog.min.js?v=PLACEHOLDER"></script>
<script src="/static/js/adminStatusFilter.js?v=PLACEHOLDER"></script>
```

---

## Implementation Order

### Phase 1: Foundation (30 min)
1. Update mobile menu - remove `hidden md:block` from 4 menu items
2. Test menu navigation (all links should be visible and clickable on mobile)

### Phase 2: Simple Pages (1.5 hours)
3. **Accounts** - Add mobile cards, dual rendering
4. **Stores** - Improve existing partial responsive
5. **Cost Centers** - Add mobile cards with FC badges

### Phase 3: Complex Pages (2 hours)
6. **Product Groups** - Hierarchical cards with indentation
7. **Categories** - Hierarchical cards + collapsible filters + type coding

### Phase 4: Very Complex (1.5 hours)
8. **Users** - Stack stats, user cards with avatars, dropdown menu

### Phase 5: Testing (30 min)
9. Cross-device testing (iPhone SE, iPad, desktop)
10. Accessibility audit (ARIA, keyboard, touch targets ≥44px)

**Total Estimated Time:** 5.5 hours

---

## Verification

### Manual Testing Checklist

**Per Page (repeat for all 6 pages):**

1. **Mobile Menu Access**
   - [ ] Open mobile menu on phone (<768px)
   - [ ] Verify menu item visible (no `hidden md:block`)
   - [ ] Click link navigates to page (no 404)

2. **Mobile Card Layout (<768px)**
   - [ ] Cards render (desktop table hidden)
   - [ ] All key fields visible
   - [ ] No horizontal scroll
   - [ ] Touch targets ≥44px (buttons, links)
   - [ ] Spacing comfortable (not cramped)

3. **Desktop Table Layout (≥768px)**
   - [ ] Table renders (mobile cards hidden)
   - [ ] Layout unchanged from before
   - [ ] All columns visible

4. **Functionality**
   - [ ] Status filter works (all/active/archived)
   - [ ] Search works (if applicable)
   - [ ] Edit modal opens
   - [ ] Create modal opens
   - [ ] Archive/Restore works
   - [ ] Delete works (with confirmation)

5. **Special Features (if applicable)**
   - [ ] **Categories/Product Groups:** Hierarchical indentation clear, parent context visible
   - [ ] **Categories:** Type filter works, border colors correct
   - [ ] **Cost Centers:** Financial centers badges readable
   - [ ] **Users:** Stats stack vertically, dropdown-top opens upward, avatar displays

### Breakpoint Testing

| Viewport | Device | Expected Behavior |
|----------|--------|-------------------|
| 375x667 | iPhone SE | Mobile cards only, filters collapsible, no scroll |
| 390x844 | iPhone 12 Pro | Mobile cards only |
| 768x1024 | iPad Mini (portrait) | Desktop table visible |
| 1024x768 | iPad (landscape) | Desktop table visible |
| 1920x1080 | Desktop | Desktop table visible |

### Accessibility Checks

- [ ] All buttons have ARIA labels or visible text
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus visible on interactive elements
- [ ] Screen reader announces card content correctly
- [ ] Color contrast passes WCAG AA (text ≥4.5:1)

### Cross-Browser Testing

- [ ] Chrome Android (mobile)
- [ ] Safari iOS (mobile)
- [ ] iPad Safari (tablet)
- [ ] Desktop Chrome/Firefox/Safari

---

## Key Findings from Investigation

### Missing Mobile Delete Buttons

**Issue:** Stores and Product Groups templates are missing `delete_button_mobile` macro in edit modals.

**Evidence from Agent Investigation:**
```
| Feature | Categories | Cost Centers | Accounts | Stores | Product Groups | Users |
| Mobile Delete Button | YES | YES | YES | NO | NO | NO |
```

**Impact:** On mobile devices, users cannot delete items from edit modal (no delete button visible).

**Solution:** Add `{{ delete_button_mobile('deleteXFromEditModal()') }}` to edit modal's modal-action div.

**Files Affected:**
- `frontend/web/templates/admin_stores.html` - Line ~100 (edit modal actions)
- `frontend/web/templates/admin_product_groups.html` - Edit modal actions

---

### Hierarchical Rendering Complexity

**Categories and Product Groups** use tree structures that require special handling:

**Current Desktop Implementation (admin_articles.html):**
- Uses recursive Jinja2 template rendering OR
- Builds HTML tree with indentation using HTML entities (`&nbsp;` etc.)

**Mobile Card Approach:**
- Cannot use recursive templates (cards rendered via JavaScript)
- **Solution:** Flatten tree with level indicators

**Example Card for Child Category:**
```html
<div class="card border-l-4 border-success" style="margin-left: 1.5rem;">
    <div class="card-body p-4 space-y-3">
        <h3>Продукты питания</h3>
        <div class="text-xs text-base-content/60">
            ↳ Подкатегория "Расходы"
        </div>
        <!-- Level 1 indentation via margin-left -->
    </div>
</div>
```

**JavaScript Pattern for Hierarchy:**
```javascript
function renderCategoryCards(categories) {
    // Build parent-child map
    const categoryMap = {};
    const rootCategories = [];

    categories.forEach(cat => {
        categoryMap[cat.id] = cat;
        if (!cat.parent_id) {
            rootCategories.push(cat);
        }
    });

    // Recursive render with level tracking
    function renderWithChildren(category, level = 0) {
        let html = renderCategoryCard(category, level);

        // Find children
        const children = categories.filter(c => c.parent_id === category.id);
        children.forEach(child => {
            html += renderWithChildren(child, level + 1);
        });

        return html;
    }

    let html = '';
    rootCategories.forEach(cat => {
        html += renderWithChildren(cat, 0);
    });

    return html;
}
```

---

## Risks & Mitigations

### Risk 1: Hierarchical Tree Rendering on Mobile
**Impact:** Categories and Product Groups use complex tree structures
**Mitigation:** Use left margin indentation + parent context text ("↳ Подкатегория")

### Risk 2: Filter State Synchronization
**Impact:** Filters applied on mobile should persist when switching to desktop
**Mitigation:** Centralized `currentFilters` state object, `syncFilterUI()` function

### Risk 3: Touch Target Size
**Impact:** Buttons/links <44px hard to tap on mobile
**Mitigation:** Use DaisyUI `btn-sm` (min 44px) + full-width buttons in cards

### Risk 4: Performance (Many Cards)
**Impact:** Rendering 100+ cards on mobile may be slow
**Mitigation:** Add pagination or infinite scroll if needed (future enhancement)

### Risk 5: JavaScript Errors Break Both Views
**Impact:** Bug in rendering code affects desktop + mobile
**Mitigation:** Separate `renderDesktopTable()` and `renderMobileCards()` functions, test independently

---

## Success Criteria

✅ All 6 reference pages accessible via mobile menu
✅ Mobile card layout renders correctly (<768px)
✅ Desktop table layout unchanged (≥768px)
✅ All CRUD operations work on mobile
✅ Filters/search functional on mobile
✅ Hierarchical relationships visible (Categories, Product Groups)
✅ Touch targets ≥44px
✅ No horizontal scroll on mobile
✅ Accessibility passes (keyboard, screen reader, ARIA)

---

## Files Summary

**Templates (7 files):**
1. `frontend/web/templates/components/user_dropdown_menu.html` - Mobile menu (lines 157-159, 166)
2. `frontend/web/templates/admin_financial_centers.html` - Accounts
3. `frontend/web/templates/admin_stores.html` - Stores
4. `frontend/web/templates/admin_cost_centers.html` - Cost Centers
5. `frontend/web/templates/admin_product_groups.html` - Product Groups
6. `frontend/web/templates/admin_articles.html` - Categories
7. `frontend/web/templates/admin_users.html` - Users

**Components (No changes needed):**
- `frontend/web/templates/components/status_filter.html` - Already responsive
- `frontend/web/templates/components/macros/delete_buttons.html` - Already has mobile variant

**Removed Components:**
- Usage of `mobile_restriction_alert()` macro removed from 4 pages (Categories, Cost Centers, Accounts, Users)
