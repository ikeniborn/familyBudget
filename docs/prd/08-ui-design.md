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

#### Facts Management (`/facts`)

**Фильтрация транзакций:**
- **Пользователь** - dropdown со всеми пользователями системы
- **Категория** - иерархический dropdown с визуальными индикаторами:
  - Родительские категории (📂): disabled, bold, italic, background highlight
  - Дочерние категории (▸): доступны для выбора, с отступами `⤷`
- **Дата с/по** - text inputs с форматом ДД.ММ.ГГГГ
- **Финансовый центр (ЦФО)** - dropdown со всеми ЦФО
- **Центр затрат (МВЗ)** - dropdown со всеми МВЗ
- **Тип записи** - dropdown с опциями: Все/Факт/План (default: Факт)

**UI улучшения (v5.0.0-beta):**
- Исправлено обрезание текста в выпадающих списках (CSS: min-width: 150px)
- Улучшена визуальная иерархия категорий с цветовой дифференциацией
- Добавлены визуальные иконки для родителей (📂) и детей (▸)
- Более явные отступы для уровней вложенности (`⤷`)
- **Searchable Category Select (Tom Select v2.3.1):**
  - N-gram fuzzy search для быстрого поиска категорий по частичному совпадению (имя + полный путь)
  - **Dropdown:** Чистое иерархическое отображение с отступами и иконками (без дублирования путей)
  - **После выбора:** Отдельный элемент под полем отображает полный путь выбранной категории для контекста
  - Фильтрация только листовых категорий (родительские excluded из результатов)
  - Интегрировано в WebApp (Telegram Mini App) и Web Interface (Desktop)
  - Подсветка совпадений и ранжирование результатов по релевантности
  - Асинхронная инициализация с проверкой загрузки библиотеки (retry mechanism)

**Batch операции:**
- Множественный выбор транзакций (checkboxes)
- Массовое удаление выбранных записей
- Пагинация: 50 записей на страницу

---

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
| Searchable Select | Tom Select | 2.3.1 |
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

### 8.8 Modal Windows Architecture (Updated 2025-11-01)

**Решение:** Переиспользуемые Jinja2 компоненты для модальных окон

**Обоснование:**
- DRY principle - единая точка изменений для UI модальных окон
- Консистентный UX на всех страницах (index, facts, plan)
- Упрощение поддержки и тестирования
- Унифицированный UI pattern для выбора типа операции

#### 8.8.1 Компонентная структура

**Созданные компоненты:**

| Компонент | Файл | Назначение | Параметры |
|-----------|------|------------|-----------|
| `transaction_modal` | `components/modal_transaction.html` | Модальное окно создания транзакций | `modal_id` (default: 'modal_add_transaction') |
| `plan_modal` | `components/modal_plan.html` | Модальное окно создания планов | `modal_id` (default: 'modal_add_plan') |

**Использование:**
```jinja2
{% from "components/modal_transaction.html" import transaction_modal %}
{% from "components/modal_plan.html" import plan_modal %}

<!-- Создание модального окна с кастомным ID -->
{{ transaction_modal('create_modal') }}
{{ plan_modal('create_modal') }}
```

#### 8.8.2 UI Pattern: Кнопки выбора типа

**Старый подход (radio buttons):**
```html
<label class="label cursor-pointer gap-2">
    <input type="radio" name="record_type" value="expense" class="radio radio-error" checked />
    <span class="label-text">📤 Расход</span>
</label>
```

**Новый подход (кнопки с toggle):**
```html
<div class="grid grid-cols-2 gap-2">
    <label class="btn btn-outline btn-error transaction-type-btn btn-active" data-type="expense">
        <input type="radio" name="record_type" value="expense" class="hidden" checked />
        Расход
    </label>
    <label class="btn btn-outline btn-success transaction-type-btn" data-type="income">
        <input type="radio" name="record_type" value="income" class="hidden" />
        Доход
    </label>
</div>
```

**Преимущества нового подхода:**
- ✅ Визуально более понятный UI (кнопки vs radio)
- ✅ Лучший UX на мобильных устройствах (большая область клика)
- ✅ Консистентность с модальным окном "план"
- ✅ `btn-active` класс четко показывает активное состояние
- ✅ Hidden radio buttons сохраняют совместимость с формами

#### 8.8.3 JavaScript Integration

**Обработчики кнопок типа:**

```javascript
function setupTransactionTypeButtons() {
    const typeButtons = document.querySelectorAll('.transaction-type-btn');

    typeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Убрать btn-active у всех кнопок
            typeButtons.forEach(btn => btn.classList.remove('btn-active'));

            // Добавить btn-active к текущей кнопке
            this.classList.add('btn-active');

            // Отметить соответствующий radio button
            const radio = this.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }

            // Перезагрузить категории с новым типом
            reloadCategoriesForType(this.dataset.type);
        });
    });
}
```

**CategoryTreeSelect Integration:**
- Динамическая фильтрация категорий по типу (expense/income)
- Автоматическая перезагрузка при смене типа операции
- Иерархическое отображение категорий с отступами

#### 8.8.4 Модальные окна на страницах

**Текущая реализация:**

| Страница | Модальное окно создания | Модальное окно редактирования | Статус |
|----------|------------------------|------------------------------|--------|
| `/` (index) | ✅ transaction_modal, plan_modal | - | ✅ Complete |
| `/facts` | ✅ transaction_modal | ✅ edit-modal | ✅ Complete |
| `/plan` | ✅ plan_modal | ✅ edit-modal | ✅ Complete |

**Позиция кнопок "Добавить":**
- Расположение: Header страницы, справа рядом с кнопками экспорта
- Стили:
  - Транзакции: `btn btn-sm btn-success` (зеленая)
  - План: `btn btn-sm btn-info` (синяя)

#### 8.8.5 Форм-элементы модальных окон

**Общие компоненты:**

1. **Тип операции** - кнопки toggle (expense/income)
2. **Quick Amount Buttons** - быстрый выбор суммы
   - Транзакции: 100, 500, 1000, 5000
   - План: 5000, 10000, 20000, 50000
3. **Сумма** - number input (step=0.01, min=0.01)
4. **Категория** - CategoryTreeSelect с фильтрацией
5. **ЦФО** - select (required)
6. **МВЗ** - select (optional)
7. **Описание** - textarea (optional)

**Уникальные компоненты:**

**Транзакции:**
- **Дата** - text input (DD.MM.YYYY) + shortcuts (Сегодня, Вчера)

**План:**
- **Период планирования** - 3 кнопки (текущий месяц +0, +1, +2)
- Hidden input: `plan_month` (YYYY-MM)

#### 8.8.6 API Integration

**Создание транзакции:**
```javascript
POST /api/v1/budget-facts
{
    "record_type": "fact",
    "fact_type": "expense",  // или "income"
    "amount": 1500.00,
    "article_id": 42,
    "financial_center_id": 1,
    "cost_center_id": 3,     // nullable
    "fact_date": "2025-11-01",
    "description": "..."     // nullable
}
```

**Создание плана:**
```javascript
POST /api/v1/budget-facts
{
    "record_type": "plan",
    "fact_type": "expense",  // или "income"
    "amount": 15000.00,
    "article_id": 42,
    "financial_center_id": 1,
    "cost_center_id": 3,     // nullable
    "plan_month": "2025-11",
    "description": "..."     // nullable
}
```

#### 8.8.7 Toast Notifications

**Реализация:**
```javascript
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} fixed top-4 right-4 w-96 z-50 shadow-lg`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}
```

**Типы:**
- `alert-success` - успешное создание
- `alert-error` - ошибка валидации/сервера
- `alert-info` - информационные сообщения

#### 8.8.8 Changelog

**2025-11-01 (v2 - Bug Fixes):**
- ✅ **CRITICAL FIX:** Исправлена ошибка `Cannot read properties of null (reading 'addEventListener')`
- ✅ Добавлены defensive checks для всех `addEventListener` вызовов
- ✅ Исправлены селекторы форм: `#form_modal_add_transaction` и `#form_modal_add_plan` (16 мест)
- ✅ Исправлены кнопки быстрого выбора суммы (100/500/1000/5000)
- ✅ Исправлены кнопки быстрого выбора даты (Сегодня/Вчера)
- ✅ Исправлена установка даты по умолчанию при открытии модального окна
- ✅ Добавлены проверки `periodButtons.length === 0` перед `forEach`

**2025-11-01 (v1):**
- ✅ Унифицирован UI модальных окон с кнопками вместо radio buttons
- ✅ Созданы переиспользуемые Jinja2 компоненты (modal_transaction, modal_plan)
- ✅ Добавлены модальные окна создания на страницы /facts и /plan
- ✅ Реализована интеграция CategoryTreeSelect с динамической фильтрацией
- ✅ Добавлены JavaScript обработчики для кнопок типа операции
- ✅ Реализованы toast notifications для feedback

**Технический долг:**
- [x] ~~Добавить defensive programming для DOM queries~~ (COMPLETED 2025-11-01)
- [ ] Рассмотреть создание единого базового компонента для обоих модальных окон
- [ ] Добавить валидацию на клиенте перед отправкой формы
- [ ] Улучшить accessibility (ARIA labels, keyboard navigation)

---

### 8.9 JavaScript Best Practices (Added 2025-11-01)

#### 8.9.1 Defensive Programming for DOM Queries

**Problem:** `Cannot read properties of null (reading 'addEventListener')` errors occur when elements don't exist in DOM.

**Solution:** Always check for existence before operations.

**Pattern 1: Check NodeList length**
```javascript
function setupEventListeners() {
    const buttons = document.querySelectorAll('.my-button');

    // ✅ GOOD: Check length before forEach
    if (buttons.length === 0) return;

    buttons.forEach(button => {
        button.addEventListener('click', handleClick);
    });
}
```

**Pattern 2: Check single element**
```javascript
function initializeForm() {
    const formElement = document.getElementById('my-form');

    // ✅ GOOD: Check existence before accessing
    if (!formElement) return;

    formElement.addEventListener('submit', handleSubmit);
}
```

**Pattern 3: Optional chaining for nested properties**
```javascript
const currentType = document.querySelector('input[name="type"]:checked')?.value || 'default';
```

#### 8.9.2 Form ID Naming Convention

**Convention:** Modal form IDs must follow pattern `form_{{ modal_id }}`

**Example:**
```jinja2
{# Modal macro with modal_id parameter #}
{% macro transaction_modal(modal_id='modal_add_transaction') %}
<dialog id="{{ modal_id }}" class="modal">
    <form id="form_{{ modal_id }}">  {# ← ID: form_modal_add_transaction #}
        <!-- form fields -->
    </form>
</dialog>
{% endmacro %}
```

**JavaScript selectors:**
```javascript
// ✅ CORRECT
const form = document.getElementById('form_modal_add_transaction');
const input = document.querySelector('#form_modal_add_transaction input[name="amount"]');

// ❌ WRONG (will fail)
const form = document.getElementById('form_add_transaction');
```

#### 8.9.3 Event Listener Best Practices

**Rule 1:** Always validate element existence
```javascript
// ❌ BAD
document.querySelector('.button').addEventListener('click', handler);

// ✅ GOOD
const button = document.querySelector('.button');
if (button) {
    button.addEventListener('click', handler);
}
```

**Rule 2:** Use early returns for clarity
```javascript
function setupButtons() {
    const buttons = document.querySelectorAll('.btn');
    if (buttons.length === 0) return;  // Early return

    // Main logic here
    buttons.forEach(btn => {
        btn.addEventListener('click', handleClick);
    });
}
```

**Rule 3:** Combine checks when multiple conditions exist
```javascript
function setupPlanPeriodButtons() {
    const buttons = document.querySelectorAll('.period-btn');
    const hiddenInput = document.querySelector('input[name="plan_month"]');

    // Check ALL conditions before proceeding
    if (!hiddenInput || buttons.length === 0) return;

    // Safe to proceed
}
```

#### 8.9.4 Error Prevention Checklist

Before adding event listeners:
- [ ] Check if element/NodeList exists
- [ ] Verify correct selector syntax
- [ ] Confirm element is rendered (not in hidden modal)
- [ ] Test in browser console first
- [ ] Add defensive checks in production code

---

### 8.10 Date Format Standard (Added 2025-11-01)

**Решение:** Единый формат даты **DD.MM.YYYY** для всех интерфейсов

**Обоснование:**
- Консистентность UX - один формат на всех страницах
- Привычный формат для русскоязычных пользователей
- Независимость от настроек браузера (нативные `type="date"` показывают MM/DD/YYYY или DD.MM.YYYY)
- Контроль над валидацией и форматированием

#### 8.10.1 Централизованная библиотека DateFormatter

**Файл:** `web/static/js/dateFormatter.js` и `webapp/static/js/dateFormatter.js`

**Ключевые методы:**

| Метод | Назначение | Пример |
|-------|-----------|--------|
| `formatForDisplay(isoDate)` | API → Display | `'2025-11-01'` → `'01.11.2025'` |
| `formatForAPI(displayDate)` | Display → API | `'01.11.2025'` → `'2025-11-01'` |
| `today()` | Текущая дата (display) | `'01.11.2025'` |
| `todayISO()` | Текущая дата (API) | `'2025-11-01'` |
| `isValidDisplayFormat(str)` | Валидация формата | `'01.11.2025'` → `true` |
| `formatDateTime(date)` | С временем | `'01.11.2025 15:30'` |
| `parse(dateStr)` | Парсинг в Date | `'01.11.2025'` → Date object |

#### 8.10.2 HTML Input Fields

**Старый подход (нативный):**
```html
<!-- ❌ Проблема: формат зависит от браузера/локали -->
<input type="date" name="fact_date" required />
```

**Новый подход (унифицированный):**
```html
<!-- ✅ Решение: текстовое поле с форматированием -->
<input type="text" name="fact_date" required
       class="input input-bordered"
       placeholder="ДД.ММ.ГГГГ" />
```

#### 8.10.3 JavaScript Integration

**Паттерн 1: Отправка данных на API**
```javascript
const formData = new FormData(event.target);
const data = {
    fact_date: DateFormatter.formatForAPI(formData.get('fact_date'))
};
// Отправляется YYYY-MM-DD формат на backend
```

**Паттерн 2: Получение данных от API**
```javascript
const fact = await response.json();
document.getElementById('edit-date').value = DateFormatter.formatForDisplay(fact.fact_date);
// Отображается DD.MM.YYYY формат в поле
```

**Паттерн 3: Отображение в таблицах**
```javascript
facts.forEach(fact => {
    const formattedDate = DateFormatter.formatForDisplay(fact.fact_date);
    html += `<td>${formattedDate}</td>`;
});
```

**Паттерн 4: Быстрые кнопки (Сегодня, Вчера)**
```javascript
function setTransactionDate(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    dateInput.value = `${dd}.${mm}.${yyyy}`;
}
```

#### 8.10.4 Валидация

**Client-side:**
```javascript
if (!DateFormatter.isValidDisplayFormat(dateStr)) {
    showToast('Неверный формат даты (ДД.ММ.ГГГГ)', 'error');
    return;
}
```

**Server-side (FastAPI):**
- Backend всегда ожидает `YYYY-MM-DD` (ISO 8601)
- Pydantic автоматически парсит в Python `date` объект
- Валидация: не может быть в будущем (для фактов), не старше 10 лет

#### 8.10.5 Унифицированные страницы

**Изменены следующие файлы:**

| Файл | Поля ввода | Отображение | Статус |
|------|-----------|-------------|--------|
| `web/templates/facts.html` | Фильтры (2), Edit modal (1) | Таблица | ✅ Complete |
| `web/templates/plan.html` | Фильтры (2), Edit modal (1) | Таблица | ✅ Complete |
| `web/templates/notifications.html` | Фильтры (2) | - | ✅ Complete |
| `web/templates/components/modal_transaction.html` | Create modal (1) | - | ✅ Complete |
| `webapp/add.html` | Input (1) | - | ✅ Complete |
| `webapp/edit.html` | Input (1) | - | ✅ Complete |
| `webapp/list.html` | Фильтры (2) | Таблица (DD.MM.YYYY HH:MM) | ✅ Complete |

#### 8.10.6 API Contract

**Request (Frontend → Backend):**
```json
{
  "fact_date": "2025-11-01"
}
```

**Response (Backend → Frontend):**
```json
{
  "fact_date": "2025-11-01"
}
```

**Формат:** ISO 8601 (YYYY-MM-DD) - стандарт для JSON/REST API

#### 8.10.7 CalendarWidget Component (Added 2025-11-02)

**Решение:** DaisyUI Native Date Picker - календарный виджет без внешних зависимостей.

**Архитектура:**
- **Компонент:** `CalendarWidget` (vanilla JavaScript class)
- **Расположение:** `web/static/js/calendar-widget.js` + `webapp/static/js/calendar-widget.js`
- **Стили:** `web/static/css/calendar-widget.css` + `webapp/static/css/calendar-widget.css`
- **Зависимости:** Только Tailwind CSS + DaisyUI (уже используется в проекте)

**Функциональность:**

1. **Single Date Picker Mode:**
   - Для форм создания/редактирования транзакций (add.html, edit.html, modal_transaction.html)
   - Календарная иконка рядом с текстовым инпутом
   - Выбор одной даты
   - Автоматическое заполнение инпута в формате DD.MM.YYYY

2. **Range Picker Mode:**
   - Для фильтров "дата с/по" (facts.html, plan.html, notifications.html)
   - Один виджет для выбора диапазона дат
   - Visual feedback для выбранного диапазона
   - Автоматическое заполнение обоих инпутов

3. **Quick Date Shortcuts:**
   - Сохранены существующие кнопки "Сегодня", "Вчера", "Позавчера"
   - Работают параллельно с календарным виджетом

**Интеграция:**
```javascript
// Single date picker
new CalendarWidget({
    mode: 'single',
    inputElement: document.getElementById('fact-date'),
    onSelect: (date) => {
        // date в формате DD.MM.YYYY
        formState.factDate = DateFormatter.formatForAPI(date);
    }
});

// Range picker
new CalendarWidget({
    mode: 'range',
    startInputElement: document.getElementById('filter-date-from'),
    endInputElement: document.getElementById('filter-date-to'),
    onSelect: (startDate, endDate) => {
        // Даты в формате DD.MM.YYYY
        applyFilters();
    }
});
```

**UX Features:**
- Touch-friendly для Telegram WebApp (mobile)
- Keyboard navigation (ESC, Enter, Arrow keys)
- Click outside to close
- Русская локализация (месяцы, дни)
- Поддержка темной темы (DaisyUI)
- Responsive design (breakpoints для mobile/desktop)
- Accessibility (ARIA labels, focus states)

**Платформо-специфичные решения (Added 2025-11-02):**

**WebApp (Telegram Mini App) - Native Date Input:**
- `webapp/add.html` - `<input type="date">` для fact_date
- `webapp/edit.html` - `<input type="date">` для fact_date
- Преимущества:
  - ✅ Оптимизированный нативный date picker для каждой мобильной ОС (iOS, Android)
  - ✅ Touch-friendly UX - привычный интерфейс для пользователей
  - ✅ Без дополнительного JS (~0KB overhead)
  - ✅ Автоматическая валидация браузером
  - ✅ Сохранены quick date shortcuts ("Сегодня", "Вчера", "Позавчера")

**Web Interface (Desktop) - CalendarWidget:**
- `web/templates/facts.html` - фильтры дата с/по (range) + edit modal fact_date (single) + create modal fact_date (single)
- `web/templates/plan.html` - фильтры дата с/по (range)
- `web/templates/notifications.html` - фильтры дата с/по (range)
- Преимущества:
  - ✅ Улучшенный UX для desktop - визуальный календарь
  - ✅ Range picker для фильтров "дата с/по"
  - ✅ Без внешних зависимостей (DaisyUI Native)
  - ✅ Полный контроль над UI/UX
  - ✅ Легковесность - ~15KB (JS + CSS)

**DateFormatter расширение:**
- `setNativeDateInput(input, displayDate)` - установить значение для native date input
- `getNativeDateInput(input)` - получить значение из native date input
- `initNativeDateInput(input)` - инициализировать с сегодняшней датой
- Поддержка обоих форматов: DD.MM.YYYY (отображение) ↔ YYYY-MM-DD (native input value)

#### 8.10.8 Changelog

**2025-11-03 (TomSelect Reliability & Search Improvements):**
- ✅ **RELIABILITY:** Переход на локальную копию TomSelect (v2.3.1)
  - Скачана библиотека в `webapp/static/js/vendor/tom-select.complete.min.js` и `web/static/js/vendor/`
  - Убраны CDN ссылки из всех HTML файлов (add.html, addplan.html, edit.html, base.html)
  - Удален CDN wait logic из `tomSelectCategoryTree.js` - библиотека доступна сразу
  - **Бенефит:** Устранена ошибка "Failed to load after 20 attempts", надежная загрузка без зависимости от CDN
- ✅ **UX IMPROVEMENT:** Упрощено отображение листовых категорий в dropdown
  - Было: Отступы (›››) + иконки для всех элементов
  - Стало: Листовые элементы БЕЗ отступов и иконок (только название), родительские с отступами (disabled)
  - Полный путь отображается под полем выбора после выбора категории
  - **Бенефит:** Чистый UI, легче найти нужную категорию, контекст сохранен
- ✅ **FEATURE:** Fuzzy subsequence matching (как в IDE)
  - Добавлен метод `isSubsequence()` для поиска подпоследовательностей
  - Пример: поиск "прд" находит "продукты", "едф" находит "еда фаст"
  - Приоритеты: точное начало (1.0) > substring (0.85) > subsequence (0.7) > n-gram (до 0.7)
  - **Бенефит:** Быстрый поиск категорий без необходимости точного написания
- ✅ **IMPROVEMENT:** Улучшен n-gram matching
  - Threshold снижен с 0.3 до 0.2 (больше результатов)
  - Вес увеличен с 0.5 до 0.7 (выше приоритет)
  - **Бенефит:** Лучше работает для опечаток и частичных совпадений
- ✅ **FIX:** Улучшен updatePathDisplay() с defensive checks
  - Добавлены проверки существования `pathDisplayElement` и `flatNodes`
  - Добавлено debug logging для диагностики
  - **Бенефит:** Стабильное отображение полного пути, проще отлаживать
- ✅ **CACHE BUSTING:** Обновлены версии скриптов до `?v=20251103_1549`
- ✅ **Изменено файлов:** 8
  - JS: `webapp/static/js/tomSelectCategoryTree.js` (major refactoring)
  - HTML webapp: `add.html`, `addplan.html`, `edit.html` (local TomSelect)
  - HTML web: `base.html` (local TomSelect)
  - Vendor: `webapp/static/js/vendor/tom-select.complete.min.js`, `web/static/js/vendor/` (new files)
  - CSS: `webapp/static/css/tom-select.css`, `web/static/css/tom-select.css` (copied from CDN)
- ✅ **Scope:** WebApp (Telegram Mini App) + Web Interface (Desktop)

**2025-11-03 (TomSelect Category Tree UX Improvements):**
- ✅ **UX IMPROVEMENT:** Улучшен интерфейс выбора категорий (TomSelectCategoryTree)
- ✅ **FIX:** Убрано избыточное отображение полного пути в dropdown списке
  - Было: Иерархия с отступами + дублирующий fullPath под каждой категорией
  - Стало: Чистое иерархическое отображение с иконками (без дублирования)
- ✅ **FEATURE:** Добавлено отображение контекста выбранной категории
  - Отдельный элемент под полем выбора показывает полный путь: "Расходы › Продукты › Еда"
  - Помогает избежать путаницы между одноименными категориями из разных веток
- ✅ **FIX:** Исправлен fuzzy search по категориям
  - Переключено с DOM parsing на options API для корректной передачи данных
  - Теперь поиск работает по имени категории И полному пути
- ✅ **FIX:** Исправлена ошибка "TomSelect is not defined"
  - Добавлен retry mechanism с async/await для ожидания загрузки библиотеки (до 1 сек)
  - Fallback: показать стандартный select если TomSelect не загрузился
- ✅ **Изменено файлов:** 11
  - JS: `webapp/static/js/tomSelectCategoryTree.js`, `web/static/js/tomSelectCategoryTree.js`
  - HTML webapp: `add.html`, `addplan.html`, `edit.html`
  - HTML web: `facts.html`, `plan.html`, `components/modal_transaction.html`, `components/modal_plan.html`
  - CSS: `webapp/static/css/tom-select-telegram.css`, `web/static/css/tom-select-tailwind.css`
- ✅ **Scope:** WebApp (Telegram Mini App) + Web Interface (Desktop)

**2025-11-02 (CalendarWidget Implementation):**
- ✅ **FEATURE:** Реализован календарный виджет для всех форм с датами
- ✅ **Компонент:** CalendarWidget (DaisyUI Native) - без внешних зависимостей
- ✅ **Функциональность:**
  - Single date picker для форм создания/редактирования (webapp/add.html, webapp/edit.html, модалки)
  - Range picker для фильтров "дата с/по" (facts, plan, notifications)
  - Сохранены quick date shortcuts ("Сегодня", "Вчера", "Позавчера")
- ✅ **UX Features:**
  - Touch-friendly для Telegram WebApp (mobile)
  - Keyboard navigation (ESC, Enter, Arrow keys)
  - Click outside to close
  - Русская локализация (месяцы, дни)
  - Поддержка темной темы (DaisyUI)
  - Responsive design (mobile/desktop)
  - Accessibility (ARIA labels)
- ✅ **Интеграция:** 8 форм (webapp: 2, web: 6)
- ✅ **Файлы:**
  - `web/static/js/calendar-widget.js` (новый)
  - `web/static/css/calendar-widget.css` (новый)
  - `webapp/static/js/calendar-widget.js` (портирован)
  - `webapp/static/css/calendar-widget.css` (портирован)
  - `web/templates/base.html` (добавлены подключения)
  - `web/templates/facts.html` (инициализация виджетов)
  - `web/templates/plan.html` (инициализация виджетов)
  - `web/templates/notifications.html` (инициализация виджетов)
  - `webapp/add.html` (подключения + инициализация)
  - `webapp/edit.html` (подключения + инициализация)
- ✅ **Размер:** ~15KB (JS + CSS)

**2025-11-02 (Platform-Specific Date Input Solutions):**
- ✅ **IMPROVEMENT:** Переход на платформо-специфичные решения для оптимальной UX
- ✅ **WebApp (Mobile) - Native Date Input:**
  - Заменен CalendarWidget на `<input type="date">` для webapp/add.html и webapp/edit.html
  - Преимущества: нативный date picker ОС (iOS, Android), оптимальный touch UX, 0KB overhead
  - Сохранены quick date shortcuts ("Сегодня", "Вчера", "Позавчера") для быстрого выбора
- ✅ **Web Interface (Desktop) - CalendarWidget:**
  - Оставлен CalendarWidget для web/templates (facts.html, plan.html, notifications.html)
  - Преимущества: визуальный календарь для desktop, range picker для фильтров
- ✅ **DateFormatter расширение:**
  - `setNativeDateInput(input, displayDate)` - установить значение для native input (DD.MM.YYYY → YYYY-MM-DD)
  - `getNativeDateInput(input)` - получить значение из native input (YYYY-MM-DD → DD.MM.YYYY)
  - `initNativeDateInput(input)` - инициализировать с сегодняшней датой
  - Поддержка двух форматов: DD.MM.YYYY (отображение) ↔ YYYY-MM-DD (native input value)
- ✅ **CRITICAL FIX:** Исправлена инициализация CalendarWidget в web interface модалке создания транзакции
  - Проблема: виджет инициализировался до загрузки DOM модалки
  - Решение: перенос инициализации в loadArticles() (после загрузки категорий)
- ✅ **Файлы:**
  - `webapp/static/js/dateFormatter.js` - добавлены 3 метода для native input
  - `webapp/add.html` - изменен на native date input + обновлена логика setupDateInput()
  - `webapp/edit.html` - изменен на native date input + обновлена логика
  - `web/templates/facts.html` - исправлена инициализация create modal calendar
- ✅ **Rationale:** Hybrid solution - оптимальная UX для каждой платформы (mobile vs desktop)

**2025-11-01 (Bug Fixes - Update/Delete Transactions):**
- ✅ **CRITICAL FIX:** Исправлена 500 ошибка при обновлении транзакции (строка 672)
- ✅ **Проблема:** Frontend отправлял отрицательный amount для расходов, backend ожидает ВСЕГДА положительное (gt=0)
- ✅ **Решение:** Убран неправильный знак в updateData - `amount: formState.amount` вместо `amount: formState.factType === 'income' ? formState.amount : -formState.amount`
- ✅ **Важно:** Тип операции (доход/расход) определяется по article_type категории, НЕ по знаку amount
- ✅ **CRITICAL FIX:** Убраны вызовы несуществующего app.ui.hapticSuccess() (строки 630, 681)
- ✅ **Решение:** Haptic feedback для success автоматически вызывается внутри showSuccess()
- ✅ **FIX:** Улучшена обработка ошибок при обновлении и удалении (строки 637-639, 687-689)
- ✅ Добавлено console.error для логирования ошибок в DevTools
- ✅ Исправлено отображение "[object Object]" → корректный текст ошибки (error.detail || error.message || String(error))
- ✅ **CRITICAL FIX:** Исправлен селектор кнопок быстрого выбора суммы (строка 466)
- ✅ **Проблема:** При клике на кнопки выбора даты ("Сегодня", "Вчера", "Позавчера") срабатывал обработчик кнопок суммы, устанавливая NaN
- ✅ **Решение:** Добавлен фильтр [data-amount] к селектору `.querySelectorAll('.quick-amount-btn[data-amount]')`
- ✅ Файл: webapp/edit.html (5 исправлений)

**2025-11-01 (Edit Transaction - Quick Date Buttons):**
- ✅ Добавлены кнопки быстрого выбора даты: "Сегодня", "Вчера", "Позавчера"
- ✅ Консистентность UX с формой добавления транзакции (webapp/add.html)
- ✅ HTML разметка: 3 кнопки с data-days атрибутами (0, -1, -2)
- ✅ JavaScript: функция setupQuickDateButtons() с haptic feedback
- ✅ Автоматическое форматирование даты в DD.MM.YYYY для отображения
- ✅ Файл: webapp/edit.html

**2025-11-01 (Edit Transaction Fixes):**
- ✅ **CRITICAL FIX:** Исправлено определение типа операции при загрузке транзакции (используется article_type из API вместо знака amount)
- ✅ **CRITICAL FIX:** Исправлен сброс выбранной категории при смене типа операции (добавлен formState.categoryId = null)
- ✅ Исправлены опечатки в заголовках: title и h1 ("Редактировать транзакцию")
- ✅ Исправлены опечатки в UI элементах: кнопка удаления (🗑), счетчики символов (/ 200), кнопка сохранения (СОХРАНИТЬ ИЗМЕНЕНИЯ)
- ✅ Исправлены опечатки в сообщениях: success/error messages, confirm dialog
- ✅ Файл: webapp/edit.html (13 исправлений)

**2025-11-01 (Timezone Fix):**
- ✅ **CRITICAL FIX:** Исправлена проблема с UTC vs LOCAL timezone
- ✅ `DateFormatter.todayISO()` - заменен `.toISOString()` на локальное форматирование
- ✅ Исправлены 6 файлов webapp: today.html, index.html, add.html, summary.html, stats.html, addplan.html
- ✅ Все даты теперь используют LOCAL timezone вместо UTC

**Проблема:**
- `.toISOString()` возвращает UTC время, что приводит к смещению дат
- Пример: 02.11.2025 01:00 MSK → `toISOString()` → "2025-11-01" (неправильно!)
- Транзакции за "сегодня" не отображались из-за неправильного dateFrom

**Решение:**
```javascript
// ❌ Старый код (UTC)
const dateFrom = new Date().toISOString().split('T')[0];

// ✅ Новый код (LOCAL)
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const dateFrom = `${year}-${month}-${day}`;
```

**2025-11-01:**
- ✅ Адаптирован DateFormatter для формата DD.MM.YYYY (с точками вместо дефисов)
- ✅ Портирован DateFormatter в `web/static/js/`
- ✅ Заменены все `type="date"` → `type="text"` в модальных окнах и фильтрах
- ✅ Обновлены JavaScript функции для конвертации дат
- ✅ Обновлено отображение дат в таблицах (facts, plan)
- ✅ Унифицирован формат на всех страницах (webapp + web/templates)

**Преимущества внедрения:**
- ✅ Единый формат везде (100% consistency)
- ✅ Независимость от локали браузера
- ✅ Улучшенная валидация на клиенте
- ✅ Централизованное управление форматированием
- ✅ Корректная работа с LOCAL timezone (MSK, UTC+3)

**Технический долг:**
- [ ] Добавить маску ввода для автоформатирования (DD.MM.YYYY)
- ✅ Добавить календарный виджет для удобства выбора (Реализовано 2025-11-02)
- [ ] Рассмотреть поддержку других форматов ввода (DD/MM/YYYY)

---

### 8.11 Dark Mode Implementation (Renumbered from 8.10)

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

### 8.12 Migration Status (Updated 2025-11-01, Renumbered from 8.11)

**✅ Completed:**

| Page | Status | Components Migrated |
|------|--------|---------------------|
| `base.html` | ✅ Complete | navbar, footer, dark mode toggle |
| `analytics.html` | ✅ Complete | cards, charts, filters, btn-groups |
| `admin_dashboard.html` | ✅ Complete | stats, charts, forms, selects |
| `index.html` | ✅ Complete | modal components (transaction, plan) |
| `facts.html` | ✅ Complete | modal components, CategoryTreeSelect |
| `plan.html` | ✅ Complete | modal components, CategoryTreeSelect |
| Custom CSS | ✅ Complete | custom.css (150 lines vs 981 original) |
| **Modal Components** | ✅ Complete | Reusable Jinja2 macros, unified UI |

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

