## 8. User Interface Design

### 8.1 Telegram Bot Interface

**Команды:**

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие и регистрация пользователя |
| `/add_expense` | Добавление фактического расхода |
| `/add_plan` | Добавление плановой записи |
| `/summary` | Просмотр итогов |
| `/edit` | Корректировка записей |
| `/settings` | Настройки уведомлений |
| `/help` | Справка |
| `/cancel` | Отмена текущей операции |

**ConversationHandler States:**

```python
# add_expense flow
ASK_AMOUNT = 0
ASK_ARTICLE = 1
ASK_FC = 2
ASK_CC = 3
ASK_PERIOD = 4
ASK_COMMENT = 5
CONFIRM = 6
```

**Пример диалога добавления расхода:**

```
User: /add_expense
Bot: 💰 Введите сумму расхода:

User: 1500
Bot: 📝 Выберите статью расходов:
     [Продукты] [Транспорт] [Развлечения] [➡️ Еще...]

User: [Продукты]
Bot: 📝 Уточните категорию:
     [Еда] [Напитки] [Хозтовары] [⬅️ Назад]

User: [Еда]
Bot: 🏢 Выберите ЦФО:
     [Семья] [Дети]

User: [Семья]
Bot: 🏭 Выберите МВЗ:
     [Дом] [Транспорт] [Образование]

User: [Дом]
Bot: 📅 Выберите период:
     [Октябрь 2025] [Ноябрь 2025]

User: [Октябрь 2025]
Bot: 💬 Добавить комментарий? (или /skip)

User: /skip
Bot: ✅ Расход добавлен:
     Сумма: 1500 руб
     Статья: Еда (Продукты)
     ЦФО: Семья
     МВЗ: Дом
     Период: Октябрь 2025
     
     ⚠️ Внимание! Бюджет по статье "Продукты" выполнен на 85%
```

### 8.2 Web Interface Pages

#### Dashboard (`/`)

**Ключевые метрики:**
- Текущий период
- Общий бюджет (план vs факт)
- Топ-5 категорий расходов
- Прогресс по основным статьям (progress bars)

---

#### Analytics (`/analytics`)

**5 типов графиков:**
1. **План-факт** (Bar chart) - выбор периода, группировка
2. **Динамика** (Line chart) - несколько статей, zoom
3. **Структура** (Pie chart) - drill-down в подкатегории
4. **Waterfall** - бюджетный каскад
5. **Heatmap** - интенсивность по статьям×периодам

---

#### Admin Pages

- `/admin/articles` - CRUD статей с визуализацией дерева
- `/admin/cost_centers` - CRUD МВЗ
- `/admin/financial_centers` - CRUD ЦФО
- `/admin/periods` - CRUD периодов
- `/admin/users` - Управление пользователями (опционально)

### 8.3 Analytics Charts Specifications

#### Chart 1: План-факт анализ (ECharts Bar)

```javascript
const option = {
  title: { text: 'План-факт анализ' },
  tooltip: { trigger: 'axis' },
  legend: { data: ['План', 'Факт'] },
  xAxis: {
    type: 'category',
    data: ['Продукты', 'Транспорт', 'Развлечения', 'Услуги']
  },
  yAxis: { type: 'value' },
  series: [
    {
      name: 'План',
      type: 'bar',
      data: [15000, 8000, 5000, 3000]
    },
    {
      name: 'Факт',
      type: 'bar',
      data: [12500, 7800, 6000, 2900]
    }
  ]
};
```

#### Chart 2: Динамика затрат (ECharts Line)

```javascript
const option = {
  title: { text: 'Динамика затрат' },
  tooltip: { trigger: 'axis' },
  legend: { data: ['Продукты', 'Транспорт'] },
  xAxis: {
    type: 'category',
    data: ['Янв', 'Фев', 'Мар', 'Апр', 'Май']
  },
  yAxis: { type: 'value' },
  series: [
    {
      name: 'Продукты',
      type: 'line',
      data: [12000, 13500, 12800, 14000, 13200]
    },
    {
      name: 'Транспорт',
      type: 'line',
      data: [7000, 7500, 7200, 8000, 7800]
    }
  ]
};
```

#### Chart 3: Структура расходов (ECharts Pie)

```javascript
const option = {
  title: { text: 'Структура расходов' },
  tooltip: { trigger: 'item' },
  series: [
    {
      name: 'Расходы',
      type: 'pie',
      radius: '50%',
      data: [
        { value: 12500, name: 'Продукты' },
        { value: 7800, name: 'Транспорт' },
        { value: 6000, name: 'Развлечения' },
        { value: 2900, name: 'Услуги' }
      ],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }
  ]
};
```

#### Chart 4: Waterfall бюджета (ECharts Waterfall)

```javascript
const option = {
  title: { text: 'Бюджет Waterfall' },
  tooltip: { trigger: 'axis' },
  series: [
    {
      type: 'bar',
      stack: 'total',
      data: [
        { value: 30000, itemStyle: { color: '#4CAF50' } },  // Начальный бюджет
        { value: -12500, itemStyle: { color: '#F44336' } }, // Продукты
        { value: -7800, itemStyle: { color: '#F44336' } },  // Транспорт
        { value: 9700, itemStyle: { color: '#2196F3' } }   // Остаток
      ]
    }
  ]
};
```

#### Chart 5: Heatmap расходов (ECharts Heatmap)

```javascript
const option = {
  title: { text: 'Интенсивность расходов' },
  tooltip: { position: 'top' },
  xAxis: {
    type: 'category',
    data: ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4']
  },
  yAxis: {
    type: 'category',
    data: ['Продукты', 'Транспорт', 'Развлечения', 'Услуги']
  },
  visualMap: {
    min: 0,
    max: 10000,
    calculable: true,
    inRange: {
      color: ['#e0f2f1', '#00695c']
    }
  },
  series: [
    {
      type: 'heatmap',
      data: [
        [0, 0, 3500], [0, 1, 2000], [0, 2, 1500],
        [1, 0, 3200], [1, 1, 1800], [1, 2, 1700]
      ]
    }
  ]
};
```

### 8.4 HTMX Integration Patterns

**Pattern 1: hx-get для partial update**

```html
<div hx-get="/api/v1/facts" 
     hx-trigger="load" 
     hx-swap="innerHTML">
  Загрузка...
</div>
```

**Pattern 2: hx-post для формы**

```html
<form hx-post="/api/v1/articles" 
      hx-swap="outerHTML">
  <input type="text" name="code" placeholder="Код">
  <input type="text" name="name" placeholder="Название">
  <button type="submit">Сохранить</button>
</form>
```

**Pattern 3: hx-swap для замены контента**

```html
<button hx-get="/analytics/chart/plan-fact" 
        hx-target="#chart-container" 
        hx-swap="innerHTML">
  Показать план-факт
</button>

<div id="chart-container"></div>
```

### 8.5 Responsive Design

**Breakpoints:**
- **Mobile:** < 768px (sm)
- **Tablet:** 768px - 1024px (md/lg)
- **Desktop:** > 1024px (xl)

**Mobile-first approach:**
Стили сначала для мобильных устройств, затем media queries для больших экранов.

---

### 8.6 UI Framework Stack (Updated 2025-10-19)

**Решение:** Tailwind CSS 3.4+ + DaisyUI 4.x

**Обоснование:**
- shadcn/ui несовместим с HTMX + Jinja2 (требует React/Vue)
- DaisyUI предоставляет 50+ готовых компонентов на базе Tailwind
- Полная совместимость с существующей HTMX архитектурой
- Сокращение CSS кода на 85% (с 981 до ~150 строк)
- Поддержка dark mode из коробки

**Технологический стек:**

| Компонент | Технология | Версия |
|-----------|------------|--------|
| CSS Framework | Tailwind CSS | 3.4+ |
| UI Components | DaisyUI | 4.12+ |
| Frontend Interactivity | HTMX | 1.9.10 |
| Charts Library | ECharts | 5.5+ |
| Template Engine | Jinja2 | 3.1+ |
| Backend | FastAPI | 0.115+ |

**CDN (Development):**
```html
<!-- Tailwind CSS Play CDN -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- DaisyUI -->
<link href="https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css" rel="stylesheet" />
```

**Production Build (Recommended):**
```bash
# Install
npm install -D tailwindcss daisyui

# Build
npx tailwindcss -i web/static/css/input.css -o web/static/css/output.css --minify

# Result: ~50-100KB (vs 3MB CDN)
```

---

### 8.7 DaisyUI Components Mapping

**Используемые компоненты:**

| UI Element | Vanilla CSS (old) | DaisyUI Component | Benefits |
|------------|-------------------|-------------------|----------|
| Navigation | `.navbar` | `navbar` + `menu` | Dropdown, mobile hamburger |
| Buttons | `.btn-primary` | `btn btn-primary` | Variants (outline, ghost, disabled) |
| Cards | `.card` | `card bg-base-100 shadow-lg` | Consistent spacing, hover effects |
| Stats | `.stat-card` | `stats` + `stat` | Structured metric displays |
| Tables | `.data-table` | `table table-zebra table-compact` | Zebra stripes, responsive |
| Forms | `.form-group` | `form-control` + `input` | Label integration, validation states |
| Modals | `.modal` | `modal` + `modal-box` | Native `<dialog>`, ESC key support |
| Badges | `.badge` | `badge badge-primary` | Color variants, sizes |
| Alerts | `.alert` | `alert alert-warning` | Icons, dismissible, variants |
| Dropdowns | Custom JS | `dropdown` + `dropdown-content` | Built-in positioning |
| Button Groups | Custom CSS | `btn-group` | Active state management |
| Footer | Custom CSS | `footer footer-center` | Pre-styled layout |

**Color Palette (DaisyUI theme):**
```javascript
{
  "primary": "#4CAF50",    // Green (success, income)
  "secondary": "#2196F3",  // Blue (info, links)
  "accent": "#ff9800",     // Orange (highlights)
  "neutral": "#333333",    // Dark gray (text)
  "base-100": "#ffffff",   // White (backgrounds)
  "success": "#4CAF50",    // Green
  "warning": "#ff9800",    // Orange
  "error": "#f44336"       // Red (expense, errors)
}
```

---

### 8.8 Dark Mode Implementation

**Theme Toggle:**
- Расположение: navbar-end (рядом с user info)
- Компонент: DaisyUI `swap swap-rotate`
- Иконки: Sun (light) / Moon (dark)
- Persistence: localStorage

**JavaScript:**
```javascript
// Load theme from localStorage
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// Save on change
themeController.addEventListener('change', (e) => {
  const theme = e.target.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
});
```

**Supported Themes:**
- `light` (default) - светлая тема
- `dark` - темная тема

**ECharts Integration:**
DaisyUI CSS переменные автоматически применяются к графикам через цветовую схему.

---

### 8.9 Migration Status (2025-10-19)

**✅ Completed:**

| Page | Status | Components Migrated |
|------|--------|---------------------|
| `base.html` | ✅ Complete | navbar, footer, dark mode toggle |
| `analytics.html` | ✅ Complete | cards, charts, filters, btn-groups |
| `admin_dashboard.html` | ✅ Complete | stats, charts, forms, selects |
| Custom CSS | ✅ Complete | custom.css (150 lines vs 981 original) |

**📝 Pending (Pattern-ready):**

| Page | Priority | Components Needed |
|------|----------|-------------------|
| `admin_users.html` | High | table, modals, forms |
| `admin_articles.html` | High | table, tree-view (custom), modals |
| `admin_facts.html` | High | table, filters, pagination |
| `admin_financial_centers.html` | Medium | table, forms, modals |
| `admin_cost_centers.html` | Medium | table, forms, modals |
| `admin_monitoring.html` | Low | stats, charts |

**Migration Patterns:**
See `/web/MIGRATION_SUMMARY.md` for detailed migration guide with code examples.

**CSS Code Reduction:**
- Before: 981 lines (style.css)
- After: ~150 lines (custom.css + DaisyUI)
- Reduction: **85%**

---

