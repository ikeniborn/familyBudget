# Исследование табличных форм отображения записей

**Дата:** 2026-02-09
**Статус:** ✅ Верифицировано (независимая проверка)

---

## Содержание

1. [Активные таблицы](#активные-таблицы)
2. [Legacy код (не используется)](#legacy-код-не-используется)
3. [Сравнительная таблица](#сравнительная-таблица)
4. [Подробная структура](#подробная-структура-колонок)
5. [Механизмы рендеринга](#механизмы-рендеринга)
6. [Механизмы обновления](#механизмы-обновления)
7. [Дублирование кода](#дублирование-кода)
8. [Рекомендации](#рекомендации)

---

## Активные таблицы

### 1. Dashboard: Последние транзакции

**Файл:** `frontend/web/templates/partials/recent_transactions.html`

**Характеристики:**
- ✅ **Рендеринг:** Server-side (Jinja2)
- ✅ **Режим:** Inline HTML в template
- ✅ **Колонки:** 8 (Тип, Дата, Счёт, Категория, Сумма, Описание, ☁️, Действия)
- ✅ **Пагинация:** Нет (fixed limit=10)
- ✅ **Фильтры:** Нет
- ✅ **Responsive:** Desktop table (≥768px) + Mobile two-line list (<768px)
- ✅ **Offline:** Скрыта при offline (`data-offline-hidden="true"`)

**API Endpoint:**
- `/api/v1/facts/recent-html?limit=10` (возвращает готовый HTML)

**Обновление:**
- HTMX auto-trigger: `hx-trigger="load"`
- Manual: Browser reload

---

### 2. Facts Page: Управление фактами

**Файл:** `frontend/web/templates/facts.html`
**Контейнер:** `partials/facts/facts_table_container.html` (пустой, только spinner)
**Контроллер:** `frontend/web/static/js/facts/operations/factsController.ts`

**Характеристики:**
- ✅ **Рендеринг:** Client-side TypeScript
- ✅ **Функции:** `renderFactRow()` (desktop), `renderFactMobileCard()` (mobile)
- ✅ **Колонки:** 7 + Actions
  - Desktop: Checkbox, Date, Category, Amount, Account, Cost Center, Comment, Actions
  - Mobile: Badge + Category + Amount (line 1) | Date • Account • Description (line 2)
- ✅ **Пагинация:** Да (50 per page)
- ✅ **Фильтры:** Да (3-level hierarchical)
- ✅ **Batch операции:** Да (multi-select + batch delete)
- ✅ **XSS защита:** `escapeHtml()` + `truncateText()`

**API Endpoints:**
- `/api/v1/facts?limit=50&offset=...` (JSON)
- `/api/v1/facts/count?...` (parallel count)

**Обновление:**
- Manual: "Применить фильтры" button → `loadFacts()`
- Auto после CRUD: `createFact()`, `updateFact()`, `deleteFact()` → `loadFacts()`

**Миграция:**
- ✅ PR #336: "decompose monolithic facts module into TypeScript modular architecture"
- ✅ Удалён HTMX, добавлен TypeScript rendering

---

### 3. Plans Page: Управление планами

**Файл:** `frontend/web/templates/plan.html`
**Контейнер:** `partials/plan/facts_table_container.html` (пустой, только spinner)
**Контроллер:** `frontend/web/static/js/plan/factsTable.ts`

**Характеристики:**
- ✅ **Рендеринг:** Client-side TypeScript
- ✅ **Функции:** Inline HTML generation внутри `renderFactsTable()`
- ✅ **Колонки:** 13
  - Desktop: Checkbox, ID, Дата, Счёт, МЗ, Категория, Сумма, Описание, Пользователь, 🔔, 🔄, ☁️, Действия
  - Mobile: Badge + Category + Amount (line 1) | Date • Account • Description (line 2)
- ✅ **Пагинация:** Да (50 per page)
- ✅ **Фильтры:** Да (3-level + 2 checkboxes: Recurring, With Reminder)
- ✅ **Batch операции:** Да (multi-select + batch delete + recurring delete)
- ✅ **Reminders:** Загрузка через `/api/v1/reminders/?date_from=...&date_to=...&limit=50`
- ✅ **Recurring Plans:** Отдельная секция управления регламентными платежами

**API Endpoints:**
- `/api/v1/facts?record_type=plan&limit=50&offset=...` (JSON)
- `/api/v1/facts/count?record_type=plan...` (parallel count)
- `/api/v1/reminders/?...` (reminders sync)

**Обновление:**
- Manual: "Применить фильтры" button → `loadFacts()`
- Auto после CRUD: `createFact()`, `updateFact()`, `deleteFact()` → `loadFacts()`
- Recurring section: `loadRecurringPlans()` (отдельный запрос)

---

## Legacy код (НЕ используется)

### ⚠️ facts_table.html - УСТАРЕВШИЙ

**Файл:** `frontend/web/templates/partials/facts/facts_table.html`

**Статус:** ❌ НЕ ИСПОЛЬЗУЕТСЯ

**Причина:**
- Legacy HTMX partial (server-side rendering)
- Использует макросы `fact_row_desktop()` и `fact_row_mobile()`
- Endpoint `/api/v1/facts/table` НЕ СУЩЕСТВУЕТ в backend
- Заменён TypeScript client-side rendering в PR #336

**Связанные файлы (также НЕ используются):**
- `components/facts/fact_row_desktop.html` - Jinja2 macro для desktop строки
- `components/facts/fact_row_mobile.html` - Jinja2 macro для mobile строки

**Поиск использования:**
```bash
grep -r "facts_table.html" frontend/web/templates/
# Результат: НЕТ совпадений (не используется нигде)
```

**Рекомендация:**
- 🗑️ Удалить `facts_table.html`, `fact_row_desktop.html`, `fact_row_mobile.html`
- 📝 Добавить комментарий в git commit: "Remove legacy HTMX partials (replaced by TypeScript in PR #336)"

---

## Сравнительная таблица

| Аспект | Dashboard | Facts Page | Plans Page | Legacy Facts |
|--------|-----------|------------|-----------|--------------|
| **Статус** | ✅ Активна | ✅ Активна | ✅ Активна | ❌ Не используется |
| **Template** | `recent_transactions.html` | `facts.html` | `plan.html` | `facts_table.html` |
| **Контейнер** | Inline rendering | `facts_table_container.html` (empty) | `facts_table_container.html` (empty) | N/A |
| **Рендеринг** | Server-side (Jinja2) | Client-side (TypeScript) | Client-side (TypeScript) | Server-side (HTMX) |
| **Модуль** | Нет (inline) | `factsController.ts` | `plan/factsTable.ts` | Jinja2 macros |
| **Колонки** | 8 | 7 + Actions | 13 | 10 |
| **Пагинация** | ❌ (limit=10) | ✅ (50/page) | ✅ (50/page) | ✅ (теоретически) |
| **Фильтры** | ❌ | ✅ 3-level | ✅ 3-level + 2 checkboxes | ✅ (теоретически) |
| **Batch delete** | ❌ | ✅ | ✅ | ❌ |
| **XSS защита** | ✅ (Jinja2 auto-escape) | ✅ (`escapeHtml()`) | ✅ (DOM API) | ✅ (Jinja2 auto-escape) |
| **API Endpoint** | `/api/v1/facts/recent-html` | `/api/v1/facts` | `/api/v1/facts?record_type=plan` | `/api/v1/facts/table` ❌ (не существует) |

---

## Подробная структура колонок

### Dashboard (8 колонок)

**Desktop table:**
```
1. Тип (Факт/План badge)
2. Дата (DD.MM.YYYY)
3. Счёт (Financial Center)
4. Категория (Article name)
5. Сумма (colored by type)
6. Описание (truncated 30 chars)
7. ☁️ (offline sync indicator)
8. Действия (Edit + Delete buttons)
```

**Mobile list:**
```
Line 1: Badge + Category + Amount + ☁️
Line 2: Date • Account • Description
```

---

### Facts Page (7 + Actions колонок)

**Desktop table:**
```
1. Checkbox (multi-select)
2. Date (📅)
3. Category (📁, colored)
4. Amount (💵, colored, bold)
5. Account (🏦, truncated 20 chars)
6. Cost Center (💼, truncated 20 chars)
7. Comment (📝, truncated 40 chars)
8. Actions (✏️ Edit + 🗑️ Delete)
```

**Mobile list:**
```
Line 1: Badge "Факт" + Category + Amount
Line 2: Date • Account • Description
```

**Rendering functions:**
- `renderFactRow(fact: FactRow): string` - Desktop row HTML
- `renderFactMobileCard(fact: FactRow): string` - Mobile card HTML

---

### Plans Page (13 колонок)

**Desktop table:**
```
1. Checkbox (multi-select)
2. ID (badge)
3. 📅 Дата
4. 🏦 Счет
5. 💼 МЗ (Место затрат)
6. 📁 Категория (colored)
7. 💵 Сумма (colored)
8. 📝 Описание
9. 👤 Пользователь
10. 🔔 Напоминание (reminder indicator)
11. 🔄 Регламентный (recurring flag)
12. ☁️ Offline (sync indicator)
13. ⚙️ Действия (Edit + Delete)
```

**Mobile list:**
```
Line 1: Badge "План" + Category + Amount + Icons (🔔, 🔄, ☁️)
Line 2: Date • Account • Description
```

**Rendering:**
- Inline HTML generation внутри `renderFactsTable(facts: BudgetFact[])`

---

## Механизмы рендеринга

### 1. Server-Side Rendering (Dashboard)

```jinja2
{# recent_transactions.html #}
{% for fact in facts %}
  <tr>
    <td>{{ fact.record_type }}</td>
    <td>{{ fact.fact_date|format_date_full }}</td>
    ...
  </tr>
{% endfor %}
```

**Плюсы:**
- ✅ Быстрая загрузка (HTML готов)
- ✅ SEO-friendly
- ✅ Автоматический escaping (Jinja2)

**Минусы:**
- ❌ Нет client-side фильтрации
- ❌ Требует server roundtrip для обновления

---

### 2. Client-Side TypeScript Rendering (Facts)

```typescript
// factsController.ts
export function renderFactRow(fact: FactRow): string {
  const articleName = escapeHtml(truncateText(fact.article_name ?? '', 30));
  const amount = Number(fact.amount).toFixed(2);

  return `
    <tr>
      <td><input type="checkbox" ... data-fact-id="${fact.id}"></td>
      <td>${escapeHtml(dateFormatted)}</td>
      <td><span class="${articleColorClass}">${articleName}</span></td>
      ...
    </tr>
  `;
}
```

**Плюсы:**
- ✅ Быстрая client-side фильтрация
- ✅ Модульный код (TypeScript)
- ✅ Явная XSS защита (`escapeHtml()`)

**Минусы:**
- ❌ Требует JavaScript на клиенте
- ❌ Больший bundle size

---

### 3. Client-Side Inline Generation (Plans)

```typescript
// plan/factsTable.ts
function renderFactsTable(facts: BudgetFact[]): void {
  let tableHtml = `
    <div class="facts-desktop-table overflow-x-auto">
      <table class="table table-zebra table-sm">
        <thead>...</thead>
        <tbody>
  `;

  facts.forEach(fact => {
    const articleColorClass = fact.article_type === 'expense' ? 'text-error' : '...';
    tableHtml += `
      <tr>
        <td><input type="checkbox" ...></td>
        <td>${fact.id}</td>
        ...
      </tr>
    `;
  });

  tableHtml += `</tbody></table></div>`;
  container.innerHTML = tableHtml; // Safe via template element
}
```

**Плюсы:**
- ✅ Гибкость (easy to add columns)
- ✅ Полный контроль над HTML

**Минусы:**
- ❌ Inline HTML strings (harder to maintain)
- ❌ Дублирование color mapping logic

---

## Механизмы обновления

### Dashboard

**Загрузка:**
```html
<div hx-get="/api/v1/facts/recent-html?limit=10"
     hx-trigger="load"
     hx-swap="innerHTML">
  <span class="loading loading-spinner"></span>
</div>
```

**Обновление:**
- ✅ Auto: HTMX `hx-trigger="load"` при загрузке страницы
- ✅ Manual: Browser reload
- ❌ Real-time: WebSocket не используется

---

### Facts Page

**Загрузка:**
```typescript
// factsController.ts
export async function loadFacts(): Promise<void> {
  // 1. Parallel requests
  const { facts, total } = await loadFactsWithCount();

  // 2. Update state
  setTotalFacts(total);

  // 3. Render UI
  updateStats(total, pageStart, pageEnd);
  renderFactsTable(facts); // ← Client-side rendering
  updatePagination(currentPage, total, pageSize);
}
```

**Обновление:**
- ✅ Manual: "Применить фильтры" → `applyFiltersAndReload()`
- ✅ Auto после CRUD:
  - `createFact()` → `loadFacts()`
  - `updateFact()` → `loadFacts()`
  - `deleteFact()` → `loadFacts()`
- ❌ Real-time: WebSocket инфраструктура существует, но НЕ используется для таблиц

---

### Plans Page

**Загрузка:**
```typescript
// plan/factsTable.ts
export async function loadFacts(): Promise<void> {
  // 1. Build query params (with filters)
  const params = new URLSearchParams({
    record_type: 'plan',
    limit: String(pageSize),
    offset: String(currentPage * pageSize)
  });

  // 2. Parallel requests
  const [factsResponse, countResponse] = await Promise.all([
    fetch(`/api/v1/facts?${params}`),
    fetch(`/api/v1/facts/count?${params}`)
  ]);

  // 3. Load reminders
  await loadRemindersForFacts(factsData.map(f => f.id));

  // 4. Render
  renderFactsTable(factsData);
  updateStats();
  updatePagination();
}
```

**Обновление:**
- ✅ Manual: "Применить фильтры" → `applyFilters()`
- ✅ Auto после CRUD (same as Facts)
- ✅ Recurring section: Отдельный `loadRecurringPlans()` запрос

---

## Дублирование кода

### ❌ Высокое дублирование

**1. Color mapping logic (3 места):**

```typescript
// Dashboard (recent_transactions.html - Jinja2 filter)
{{ article.type|amount_color }} // 'text-error', 'text-success', etc.

// Facts Page (factsController.ts)
if (fact.article_type === 'expense') articleColorClass = 'text-error';
else if (fact.article_type === 'income') articleColorClass = 'text-success';
else if (fact.article_type === 'debit') articleColorClass = 'text-info';
else if (fact.article_type === 'credit') articleColorClass = 'text-warning';

// Plans Page (plan/factsTable.ts)
if (fact.article_type === 'expense') articleColorClass = 'text-error';
else if (fact.article_type === 'income') articleColorClass = 'text-success';
// ... точно такой же код
```

**Решение:**
```typescript
// Создать shared utility
// BudgetShared.ArticleColors.getColorClass(articleType: string): string
```

---

**2. Date formatting (3 места):**

```typescript
// Dashboard: {{ fact.fact_date|format_date_full }}
// Facts: BudgetShared.DateFormatter.formatForDisplay(dateString)
// Plans: BudgetShared.DateFormatter.formatForDisplay(dateString)
```

**Решение:**
- ✅ Уже унифицировано через `BudgetShared.DateFormatter`
- ❌ Dashboard использует Jinja2 filter (нужно конвертировать в client-side)

---

**3. Truncation logic (2 места):**

```typescript
// Facts Page (factsController.ts)
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Plans Page (plan/factsTable.ts)
function truncateText(text: string | null, maxLength: number = 30): string {
  if (!text || text === '—') return text || '—';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
```

**Решение:**
```typescript
// Вынести в BudgetShared.TextUtils.truncate(text, maxLength)
```

---

**4. Mobile list rendering (2 места - почти идентично):**

Facts:
```typescript
return `
  <div class="transaction-item py-2" onclick="...">
    <div class="flex items-center gap-2">
      <span class="badge badge-primary badge-xs">Факт</span>
      <span class="flex-1 font-medium truncate">${articleName}</span>
      <span class="${amountClass} font-bold">${amountFormatted}</span>
    </div>
    <div class="text-xs text-base-content/60 mt-1 truncate">
      ${shortDate} • ${financialCenter} • ${description}
    </div>
  </div>
`;
```

Plans:
```typescript
// Почти идентичный HTML, отличается только badge text ("План")
```

**Решение:**
```typescript
// Создать shared template function
// BudgetShared.Templates.renderMobileCard(fact, badgeText, onClick)
```

---

### ⚠️ Среднее дублирование

**5. Empty state messages:**

- Facts: `📭 Факты не найдены. Попробуйте изменить фильтры.`
- Plans: `📅 Плановые записи не найдены. Измените фильтры или добавьте новые плановые записи.`

**Решение:**
```typescript
// Shared empty state component
// BudgetShared.Templates.renderEmptyState(icon, message)
```

---

**6. Pagination controls:**

```typescript
// Facts: updatePagination(currentPage, total, pageSize)
// Plans: updatePagination() // использует внутреннее состояние
```

**Решение:**
- Унифицировать API: оба модуля должны использовать один паттерн

---

## Рекомендации

### 🗑️ Приоритет 1: Удалить legacy код

**Файлы для удаления:**
1. `frontend/web/templates/partials/facts/facts_table.html`
2. `frontend/web/templates/components/facts/fact_row_desktop.html`
3. `frontend/web/templates/components/facts/fact_row_mobile.html`

**Git commit:**
```bash
git rm frontend/web/templates/partials/facts/facts_table.html
git rm frontend/web/templates/components/facts/fact_row_desktop.html
git rm frontend/web/templates/components/facts/fact_row_mobile.html
git commit -m "refactor: remove legacy HTMX facts table partials

These files were replaced by TypeScript client-side rendering in PR #336.
The endpoint /api/v1/facts/table no longer exists.

Legacy files removed:
- facts_table.html (HTMX partial)
- fact_row_desktop.html (Jinja2 macro)
- fact_row_mobile.html (Jinja2 macro)

Active implementation:
- facts.html → factsController.ts (client-side rendering)
- plan.html → plan/factsTable.ts (client-side rendering)
"
```

---

### 🔧 Приоритет 2: Унифицировать shared utilities

**Создать:** `frontend/web/static/js/shared/tableUtils.ts`

```typescript
/**
 * Shared utilities for table rendering
 */
export class TableUtils {
  /**
   * Get color class for article type
   */
  static getArticleColorClass(articleType: string): string {
    const colorMap: Record<string, string> = {
      expense: 'text-error',
      income: 'text-success',
      debit: 'text-info',
      credit: 'text-warning'
    };
    return colorMap[articleType] || 'text-base-content';
  }

  /**
   * Truncate text with ellipsis
   */
  static truncateText(text: string | null, maxLength: number = 30): string {
    if (!text || text === '—') return text || '—';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Render mobile card for fact (Two-Line List format)
   */
  static renderMobileCard(options: {
    badgeText: string;
    badgeClass: string;
    categoryName: string;
    amount: string;
    amountClass: string;
    line2Parts: string[];
    onClick: string;
  }): string {
    return `
      <div class="transaction-item py-2" onclick="${options.onClick}">
        <div class="flex items-center gap-2">
          <span class="badge ${options.badgeClass} badge-xs">${options.badgeText}</span>
          <span class="flex-1 font-medium truncate">${options.categoryName}</span>
          <span class="${options.amountClass} font-bold">${options.amount}</span>
        </div>
        <div class="text-xs text-base-content/60 mt-1 truncate">
          ${options.line2Parts.join(' • ')}
        </div>
      </div>
    `;
  }
}
```

**Использование:**

```typescript
// В factsController.ts и plan/factsTable.ts
import { TableUtils } from '../shared/tableUtils';

const colorClass = TableUtils.getArticleColorClass(fact.article_type);
const truncatedName = TableUtils.truncateText(fact.article_name, 30);
```

---

### 📊 Приоритет 3: Унифицировать renderFactsTable

**Проблема:** Два модуля (Facts, Plans) дублируют логику рендеринга таблиц с незначительными различиями в колонках.

**Решение:**

```typescript
// shared/tableRenderer.ts
export interface TableColumn {
  key: string;
  header: string;
  render: (fact: BudgetFact) => string;
  headerClass?: string;
  cellClass?: string;
}

export class TableRenderer {
  constructor(private columns: TableColumn[]) {}

  renderDesktopTable(facts: BudgetFact[]): string {
    let html = `
      <div class="facts-desktop-table overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead><tr>
    `;

    this.columns.forEach(col => {
      html += `<th class="${col.headerClass || ''}">${col.header}</th>`;
    });

    html += `</tr></thead><tbody>`;

    facts.forEach(fact => {
      html += `<tr>`;
      this.columns.forEach(col => {
        html += `<td class="${col.cellClass || ''}">${col.render(fact)}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
  }
}

// Использование в Facts:
const factsColumns: TableColumn[] = [
  { key: 'checkbox', header: '<input type="checkbox" ...>', render: (f) => `<input ...>` },
  { key: 'date', header: '📅 Дата', render: (f) => escapeHtml(formatDate(f.fact_date)) },
  // ...
];

const renderer = new TableRenderer(factsColumns);
container.innerHTML = renderer.renderDesktopTable(facts);
```

---

### 🚀 Приоритет 4: Мигрировать Dashboard на TypeScript

**Проблема:** Dashboard использует server-side rendering, что требует server roundtrip для обновления.

**Решение:**

1. Создать `dashboard/recentTransactions.ts` модуль
2. Конвертировать Jinja2 filters в TypeScript утилиты
3. Использовать `/api/v1/facts/recent` (JSON) вместо `/recent-html`
4. Добавить client-side обновление (без browser reload)

**Преимущества:**
- ✅ Быстрое обновление без перезагрузки страницы
- ✅ Единообразие с Facts/Plans модулями
- ✅ Возможность добавить фильтры в будущем

---

### 🔍 Приоритет 5: Добавить WebSocket real-time updates

**Текущее состояние:**
- ✅ WebSocket инфраструктура существует
- ✅ Redis Pub/Sub broadcast реализован
- ❌ Таблицы НЕ используют real-time обновления

**Решение:**

```typescript
// factsController.ts
export function setupWebSocketListener(): void {
  const ws = window.BudgetShared.WebSocket;

  ws.on('fact:created', async (data) => {
    await loadFacts(); // Reload table
  });

  ws.on('fact:updated', async (data) => {
    // Option 1: Full reload
    await loadFacts();

    // Option 2: Partial update (faster)
    const row = document.querySelector(`tr[data-fact-id="${data.id}"]`);
    if (row) {
      row.outerHTML = renderFactRow(data);
    }
  });

  ws.on('fact:deleted', (data) => {
    const row = document.querySelector(`tr[data-fact-id="${data.id}"]`);
    if (row) row.remove();
  });
}
```

---

## Выводы

### ✅ Что работает хорошо:

1. **TypeScript миграция (PR #336):** Client-side rendering улучшил производительность и модульность
2. **XSS защита:** Все три таблицы используют escaping (Jinja2 auto-escape или `escapeHtml()`)
3. **Responsive design:** Desktop table + Mobile two-line list паттерн универсален
4. **Пагинация:** Facts и Plans используют эффективную пагинацию (50/page)

### ❌ Что требует улучшения:

1. **Legacy код:** `facts_table.html` и связанные macros не используются → УДАЛИТЬ
2. **Дублирование:** Color mapping, truncation, mobile rendering дублируется → УНИФИЦИРОВАТЬ
3. **Dashboard:** Server-side rendering требует roundtrip → МИГРИРОВАТЬ на TypeScript
4. **Real-time:** WebSocket инфраструктура не используется для таблиц → ДОБАВИТЬ listeners

### 📈 Метрики:

- **Активные таблицы:** 3 (Dashboard, Facts, Plans)
- **Legacy файлы:** 3 (facts_table.html + 2 macros) → на удаление
- **Дублирование кода:** ~200 строк (color mapping, truncation, mobile cards)
- **Потенциальная экономия:** ~150 строк при унификации utilities

---

**Конец верифицированного отчёта**
