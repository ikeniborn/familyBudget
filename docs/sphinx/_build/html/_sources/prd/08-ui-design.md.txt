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
Bot: 🏦 Выберите Счет:
     [Семья] [Дети]

User: [Семья]
Bot: 📍 Выберите Место затрат:
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
     Счет: Сбербанк
     Место затрат: Дом
     Период: Октябрь 2025
     
     ⚠️ Внимание! Бюджет по статье "Продукты" выполнен на 85%
```

### 8.2 Web Interface Pages

#### Dashboard (`/`)

**Layout (v5.0.0-beta, 2025-11-07):**
- **Структура:** Одноколоночный layout на всю ширину экрана
- **Порядок блоков:**
  1. Быстрая статистика (ключевые метрики)
  2. Быстрые действия (горизонтальные кнопки с адаптивностью)
  3. Последние факты

**Ключевые метрики:**
- Текущий период
- Общий бюджет (план vs факт)
- Топ-5 категорий расходов
- Прогресс по основным статьям (progress bars)

**Быстрые действия:**
- **Layout:** Flex горизонтальный с адаптивностью
  - Мобильные устройства (< sm): вертикальное расположение кнопок
  - Десктоп (≥ sm): горизонтальное расположение с переносом
- **Кнопки:**
  - Панель аналитики (`/analytics`)
  - Добавить транзакцию (modal)
  - Добавить план (modal)
- **Telegram Bot блок:** Информация о быстром доступе через бота

**Последние факты:**
- **Отображение:** 5 последних транзакций
- **Ссылка:** "Посмотреть все транзакции" → `/facts` (не `/analytics`)

---

#### Analytics (`/analytics`)

**5 типов графиков:**
1. **План-факт** (Bar chart) - выбор периода, группировка
2. **Динамика** (Line chart) - несколько статей, zoom
3. **Структура** (Pie chart) - drill-down в подкатегории
4. **Waterfall** - бюджетный каскад
5. **Heatmap** - интенсивность по статьям×периодам

**Empty States (v5.0.0-beta, 2025-11-09):**

При отсутствии данных все графики показывают friendly empty state вместо ошибок:

- **Главная страница (`/`):**
  - Блок "Последние факты": информационное сообщение "Факты не найдены. Добавьте первый факт!"
  - При ошибке загрузки: сообщение об ошибке "Ошибка загрузки транзакций. Попробуйте обновить страницу."

- **Страница аналитики (`/analytics`):**
  - **График "План&Факт"**: 📊 "Нет данных" + "Добавьте транзакции или планы для просмотра графика"
  - **График "Динамика"**: 📈 "Нет данных" + "Добавьте транзакции для просмотра динамики"
  - **График "Структура"** (Pie): 🥧 "Нет данных" + "Добавьте транзакции для просмотра распределения по категориям"
  - **График "Waterfall"**: 💧 "Нет данных" + "Добавьте транзакции для просмотра денежного потока"
  - **График "Heatmap"**: 🔥 "Нет данных" + "Добавьте транзакции для просмотра тепловой карты"

- **Поведение:**
  - Empty state показывается ТОЛЬКО если `data.labels.length === 0` (полностью пустой ответ от API)
  - Графики с нулевыми значениями (например, все дни = 0.0) отображаются как обычно (нулевая линия на графике)
  - Backend endpoints возвращают пустые массивы при ошибках вместо HTTP 500
  - Переиспользуемая функция `createEmptyStateOption(icon, title, subtitle)` для генерации конфигурации ECharts

---

#### Admin Pages

- `/admin/articles` - CRUD статей с визуализацией дерева
- `/admin/cost_centers` - CRUD мест затрат
- `/admin/financial_centers` - CRUD счетов
- `/admin/periods` - CRUD периодов
- `/admin/users` - Управление пользователями (опционально)

#### Facts Management (`/facts`)

**Структура фильтров (v5.0.0-beta, 2025-11-05):**

Фильтры организованы в 3 уровня с визуальным разделением:

**Уровень 1 - Период:**
- Дата с (text input DD.MM.YYYY + CalendarWidget)
- Дата по (text input DD.MM.YYYY + CalendarWidget)
- Layout: grid-cols-2

**Уровень 2 - Основные фильтры:**
- **Тип категории** - dropdown с опциями: Все типы категорий/Расходы/Доходы (default: Все)
  - Динамическая фильтрация категорий: при изменении типа категории автоматически обновляется список доступных категорий
- **Категория** - иерархический dropdown (Choices.js) с визуальными индикаторами:
  - Родительские категории (📂): disabled, bold, italic, background highlight
  - Дочерние категории (▸): доступны для выбора, с отступами `⤷`
- **Счет** - dropdown со всеми счетами
- **Место затрат** - dropdown со всеми местами затрат
- Layout: grid-cols-4

**Уровень 3 - Дополнительные:**
- **Пользователь** - dropdown со всеми пользователями системы
- Layout: grid-cols-1
- **Примечание:** Фильтр "Тип записи" удален, так как страница /facts показывает только фактические транзакции (record_type='fact' hardcoded в API запросе)

**Plan page (/plan) структура:**
- Уровень 1: Дата с/по (grid-cols-2)
- Уровень 2: Основные фильтры (grid-cols-1 sm:grid-cols-2 lg:grid-cols-4)
  - Тип категории (Все типы категорий/Расходы/Доходы) - с динамической фильтрацией категорий
  - Категория
  - Счет
  - Место затрат
- Уровень 3: Дополнительно (grid-cols-1)
  - Пользователь
  - **Примечание:** Фильтр "Тип записи" удален, так как страница /plan показывает только плановые записи (record_type='plan' hardcoded в API запросе)

**UI улучшения (v5.0.0-beta):**
- Исправлено обрезание текста в выпадающих списках (CSS: min-width: 150px)
- Улучшена визуальная иерархия категорий с цветовой дифференциацией
- Добавлены визуальные иконки для родителей (📂) и детей (▸)
- Более явные отступы для уровней вложенности (`⤷`)
- **Searchable Category Select (Choices.js v11.1.0):**
  - Built-in Fuse.js fuzzy search (threshold 0.3, ignoreLocation: true) для быстрого поиска категорий
  - **Dropdown:** Показывает только листовые категории (родительские excluded из результатов)
  - **После выбора:** Отдельный элемент под полем отображает полный путь выбранной категории для контекста
  - **Сортировка:** По частоте использования (most used first), на основе статистики из t_article_usage_stats
  - **Статистика:** Обновляется daily at 00:00 UTC через APScheduler cron job
  - **Иерархия:** Полный путь загружается через `/api/v1/articles/{id}/ancestors?include_self=true`
  - Интегрировано в WebApp (Telegram Mini App) и Web Interface (Desktop)
  - Асинхронная инициализация с автоматической загрузкой категорий из API
  - **Смена типа категории (v5.0.0-beta fix):**
    - При смене типа (Расход ↔ Доход) используется метод `updateType()` вместо полного пересоздания компонента
    - Выбранная категория автоматически сбрасывается при смене типа для предотвращения несоответствия
    - Улучшенный метод `destroy()` с полной очисткой DOM для предотвращения ошибок реинициализации
    - Исправлена критичная ошибка в addplan.html: использовался `formState.factType` вместо `formState.planType`

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

#### 8.3.1 Analytics Page Refactoring (v5.1.2 - 2025-11-08)

**Changes Overview:**
- Упрощены фильтры (удалены Факт/План кроме План&Факт)
- Добавлен Custom Date Range picker
- Изменен grid layout (План-Факт full width, остальные 2x2)
- Обновлена heatmap (заголовок + динамические цвета)

##### Period Filter with Custom Range

**Обновление (2025-11-11):** Удален фильтр "Неделя". Доступные фильтры: Месяц, Квартал, Год, Произвольный.

```html
<div class="flex flex-col gap-3">
    <!-- Period buttons -->
    <div class="flex flex-wrap items-center gap-3">
        <label id="period-label" class="font-semibold text-sm">Период (для всех графиков):</label>
        <div class="btn-group">
            <button class="btn btn-sm btn-primary" id="filter-month" onclick="updatePeriod('month')">Месяц</button>
            <button class="btn btn-sm btn-outline" id="filter-quarter" onclick="updatePeriod('quarter')">Квартал</button>
            <button class="btn btn-sm btn-outline" id="filter-year" onclick="updatePeriod('year')">Год</button>
            <button class="btn btn-sm btn-outline" id="filter-custom" onclick="toggleCustomRange()">Произвольный</button>
        </div>
    </div>

    <!-- Custom range picker (hidden by default) -->
    <div id="custom-range-container" class="flex flex-wrap items-center gap-2" style="display: none;">
        <input type="text" id="date-from" class="input input-sm input-bordered w-32" placeholder="ДД.ММ.ГГГГ" readonly>
        <span class="text-sm">—</span>
        <input type="text" id="date-to" class="input input-sm input-bordered w-32" placeholder="ДД.ММ.ГГГГ" readonly>
        <button class="btn btn-sm btn-primary" onclick="applyCustomRange()">Применить</button>
        <button class="btn btn-sm btn-ghost" onclick="cancelCustomRange()">Отмена</button>
    </div>

    <!-- Period display text -->
    <div id="period-display" class="text-sm text-base-content/70">
        Период: последние 7 дней (02.11.2025 — 08.11.2025)
    </div>
</div>
```

##### Grid Layout Structure

**Updated layout (2025-11-08):**

```html
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Plan vs Fact Chart (Full Width) -->
    <div class="card bg-base-100 shadow-lg col-span-full">
        <div class="card-body p-3">
            <h2 class="card-title text-base mb-1">📊 План&Факт</h2>
            <!-- Фильтр типа категории (Расходы/Доходы) -->
            <div id="chart-plan-fact" class="chart-container"></div>
        </div>
    </div>

    <!-- Trends Chart (2x2 grid item) -->
    <div class="card bg-base-100 shadow-lg">
        <div class="card-body p-3">
            <h2 class="card-title text-base mb-1">📈 Динамика расходов</h2>
            <!-- NO Факт/План filter - only shows fact data -->
            <div id="chart-trends" class="chart-container"></div>
        </div>
    </div>

    <!-- Category Breakdown Chart (2x2 grid item) -->
    <div class="card bg-base-100 shadow-lg">
        <div class="card-body p-3">
            <h2 class="card-title text-base mb-1">🥧 Разбивка по категориям</h2>
            <!-- Фильтр типа (Расходы/Доходы) -->
            <!-- NO Факт/План filter - only shows fact data -->
            <div id="chart-pie" class="chart-container"></div>
        </div>
    </div>

    <!-- Waterfall Chart (2x2 grid item) -->
    <div class="card bg-base-100 shadow-lg">
        <div class="card-body p-3">
            <h2 class="card-title text-base mb-1">💧 Каскадная диаграмма</h2>
            <div id="chart-waterfall" class="chart-container"></div>
        </div>
    </div>

    <!-- Heatmap Chart (2x2 grid item) -->
    <div class="card bg-base-100 shadow-lg">
        <div class="card-body p-3">
            <h2 class="card-title text-base mb-1">🔥 Тепловая карта</h2>
            <!-- Фильтр типа (Расходы/Доходы) -->
            <!-- NO Факт/План filter - only shows fact data -->
            <div id="chart-heatmap" class="chart-container"></div>
        </div>
    </div>
</div>
```

**Responsive behavior:**
- **Mobile/Tablet (< lg):** All charts stacked in 1 column
- **Desktop (lg+):** Plan-Fact full width, остальные 4 графика в 2x2 grid

##### Heatmap Color Scheme

**Updated implementation (2025-11-08):**

```javascript
// Dynamic color scheme based on article_type
const heatmapOption = {
    visualMap: {
        min: 0,
        max: maxValue,
        inRange: {
            // Red shades for expenses, green shades for income
            color: currentHeatmapType === 'expense'
                ? ['#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336']
                : ['#eef5ee', '#c8e6c9', '#81c784', '#4caf50', '#388e3c', '#2e7d32']
        }
    }
};
```

**Цветовая логика:**
- **Расходы (expense):** Красные оттенки от светло-розового (#ffebee) до темно-красного (#f44336)
- **Доходы (income):** Зеленые оттенки от светло-зеленого (#eef5ee) до темно-зеленого (#2e7d32)

---

#### 8.3.2 Mobile Adaptation & UI Improvements (v5.1.3 - 2025-11-13)

**Changes Overview:**
- Адаптация метрик на /facts и /notifications под мобильные устройства (breakpoint sm: 640px)
- Перенос кнопок "Накопительно/По периодам" в периметр графика План&Факт
- Переименование "План vs Факт" → "План&Факт" (13 вхождений в 7 файлах)

##### Metrics Responsive Behavior (/facts, /notifications)

**Implementation (2025-11-13):**

```html
<!-- Before: horizontal only -->
<div class="stats shadow w-full">

<!-- After: responsive (vertical on mobile, horizontal on sm+) -->
<div class="stats stats-vertical sm:stats-horizontal shadow w-full">
```

**Responsive behavior:**
- **Mobile (< sm: 640px):** Вертикальное расположение метрик (stats-vertical)
- **Desktop (≥ sm: 640px):** Горизонтальное расположение метрик (stats-horizontal)

**Rationale:** DaisyUI стандартный breakpoint sm (640px) для mobile/desktop разделения.

##### Plan-Fact Chart Mode Buttons Relocation

**Before (v5.1.2):**
- Кнопки "Накопительно/По периодам" находились в глобальных фильтрах (Global Type Filter card)
- Удалены из глобальной секции

**After (v5.1.3):**
- Кнопки перенесены ВНУТРЬ card графика План&Факт
- Расположены под заголовком "📊 План&Факт"
- Используют компактный размер (btn-sm) для экономии места

```html
<div class="card bg-base-100 shadow-lg">
    <div class="card-body p-3">
        <h2 class="card-title text-base mb-1">📊 План&Факт</h2>

        <!-- Chart Mode Filter (moved from global filters) -->
        <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="text-sm text-base-content/70">Режим:</span>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-sm btn-primary" id="chart-mode-cumulative" onclick="updateChartMode('cumulative')">Накопительно</button>
                <button class="btn btn-sm btn-outline" id="chart-mode-normal" onclick="updateChartMode('normal')">По периодам</button>
            </div>
            <span class="text-xs text-base-content/60" id="chart-mode-hint">Накопительный итог с начала периода</span>
        </div>

        <div id="chart-plan-fact" class="chart-container"></div>
    </div>
</div>
```

**Rationale:**
- Кнопки режима графика относятся ТОЛЬКО к графику План&Факт, не к другим графикам
- Размещение внутри card улучшает визуальную группировку и UX
- Экономит место в глобальных фильтрах

##### Terminology Update: "План vs Факт" → "План&Факт"

**Files changed (7 files, 13 occurrences):**

| File | Occurrences | Changes |
|------|-------------|---------|
| `frontend/web/templates/analytics.html` | 2 | Заголовок графика, label фильтра режима |
| `frontend/webapp/summary.html` | 2 | `<title>`, page-title |
| `bot/handlers/summary.py` | 3 | Сообщения бота |
| `bot/README.md` | 1 | Документация команды `/summary` |
| `docs/prd/04-functional-requirements.md` | 4 | Технические описания FR-010 |
| `docs/prd/08-ui-design.md` | 1 | Описание empty state |

**Rationale:**
- Использование "&" (амперсанд) вместо "vs" делает название короче и лаконичнее
- Более нейтральная формулировка (не "противопоставление", а "связь")
- Единообразие терминологии во всем проекте

##### New Filters Implementation (v5.1.3 - Completed)

**1. CFO Filter (Финансовый центр)**

**HTML (Period Filter card):**
```html
<!-- CFO Filter (Financial Center) -->
<div class="flex flex-wrap items-center gap-3 mt-3">
    <label for="cfo-filter" class="font-semibold text-sm">Финансовый центр:</label>
    <select id="cfo-filter" class="select select-sm select-bordered w-full sm:w-64" onchange="updateCFOFilter()">
        <option value="all" selected>Все центры</option>
        <!-- Options loaded dynamically via loadCFOList() -->
    </select>
</div>
```

**JavaScript:**
- `loadCFOList()` - загружает список счетов из `/api/v1/financial-centers/list`
- `updateCFOFilter()` - обновляет глобальную переменную `currentCFOId`
- **Применяется:** Ко ВСЕМ графикам (при полной интеграции с backend)

**Status:** ✅ HTML + JS инициализация реализованы. Backend интеграция требует изменений в API endpoints (добавить параметр `cfo_id`).

---

**2. Category Filter (Фильтр по категориям)**

**HTML (Global Type Filter card):**
```html
<!-- Category Filter (multiple selection) -->
<div class="flex flex-col gap-2">
    <label for="categories-filter" class="font-semibold text-sm">Фильтр по категориям:</label>
    <select id="categories-filter" class="choices-category-tree" multiple data-placeholder="Выберите категории...">
        <!-- Options loaded via ChoicesCategoryTree -->
    </select>
    <p class="text-xs text-base-content/60">
        Применяется к: План&Факт, Разбивка по категориям, Тепловая карта
    </p>
</div>
```

**JavaScript:**
- `initCategoryFilter()` - инициализирует `BudgetShared.ChoicesCategoryTree` с multiselect
- `updateCategoryFilter(selectedArticles)` - обновляет `currentCategoryIds[]`
- **Библиотеки:** budgetShared.js (ChoicesCategoryTree), Choices.js
- **Применяется:** К Plan-Fact, Pie, Heatmap

**Status:** ✅ HTML + JS инициализация реализованы. Backend интеграция требует изменений в API endpoints (добавить параметр `article_ids[]`).

---

**3. Heatmap Zero Values Color (Белый для нулей)**

**Implementation (v5.1.3):**

```javascript
visualMap: {
    type: 'piecewise',  // Changed from default continuous
    pieces: [
        {
            value: 0,
            color: '#FFFFFF',  // White for zero values
            label: 'Нет данных (0)'
        },
        {
            min: 0.01,
            max: maxValue,
            color: null,  // Use inRange gradient
            label: 'Данные'
        }
    ],
    inRange: {
        // Red for expenses, green for income (non-zero values)
        color: currentGlobalType === 'expense'
            ? ['#ffebee', '#ffcdd2', '#ef9a9a', '#e57373', '#ef5350', '#f44336']
            : ['#eef5ee', '#c8e6c9', '#81c784', '#4caf50', '#388e3c', '#2e7d32']
    },
    calculable: true,
    orient: 'horizontal',
    left: 'center',
    bottom: '0%'
}
```

**Color Logic:**
- **0:** #FFFFFF (белый) - нет данных
- **> 0 (Расходы):** Красный градиент (#ffebee → #f44336)
- **> 0 (Доходы):** Зеленый градиент (#eef5ee → #2e7d32)

**Status:** ✅ Полностью реализовано. ECharts piecewise visualMap с явным белым цветом для нуля.

---

##### Backend Integration - Planned Enhancement (для полной функциональности фильтров)

**API Endpoints требуют обновления:**

1. `/api/v1/analytics/plan-fact` - добавить параметры `cfo_id`, `article_ids[]`
2. `/api/v1/analytics/pie` - добавить параметры `cfo_id`, `article_ids[]`
3. `/api/v1/analytics/heatmap` - добавить параметры `cfo_id`, `article_ids[]`
4. `/api/v1/analytics/trends` - добавить параметр `cfo_id`
5. `/api/v1/analytics/waterfall` - добавить параметр `cfo_id`

**Frontend функции (уже реализованы, ожидают backend):**
- `updateCFOFilter()` - вызывает перезагрузку графиков с `currentCFOId`
- `updateCategoryFilter()` - вызывает перезагрузку с `currentCategoryIds[]`

---

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

**Implementation (Updated 2025-11-05):**

**Webapp Transaction Lists (list.html, today.html):**

Реализованы адаптивные breakpoints для отображения транзакций:

| Breakpoint | Viewport | `.transaction-category` max-width | `.transaction-description` max-width |
|-----------|---------|-----------------------------------|-------------------------------------|
| **Base (< 480px)** | Small mobile | 180px (~20-25 chars) | 150px (~18-22 chars) |
| **480px+** | Mobile | 220px (~28-32 chars) | 200px (~25-30 chars) |
| **640px+** | Tablet | 300px (~40-45 chars) | 280px (~35-40 chars) |
| **768px+** | Desktop | 300px | 350px (~45-50 chars) |

**UX Improvements:**

1. **Truncate Indicator:**
   - Длинные description (> 25 символов) обрезаются с визуальным индикатором "→"
   - CSS класс `.truncated` применяется автоматически
   - Click-to-expand: Modal popup с полным текстом + Telegram haptic feedback

2. **Breadcrumb Tooltips:**
   - Вложенные категории показывают полный путь при hover/click
   - CSS класс `.has-breadcrumb` с dotted underline для индикации
   - Async загрузка ancestors через API: `GET /api/v1/articles/{id}/ancestors?include_self=true`
   - Формат tooltip: "Расходы › Продукты › Еда › Фастфуд"

3. **Responsive Container:**
   - Desktop (768px+): контейнер центрируется с `max-width: 600px`
   - Увеличенный padding для transaction items на tablet/desktop

**CSS Implementation:**

```css
/* Base mobile - критичный min-width для text-overflow */
.transaction-details {
    flex: 1;
    min-width: 0;  /* CRITICAL для работы text-overflow в flex */
    overflow: hidden;
}

/* Адаптивные max-width с media queries */
@media (min-width: 480px) { ... }
@media (min-width: 640px) { ... }
@media (min-width: 768px) { ... }
```

**API Integration:**

- Новый endpoint используется: `GET /api/v1/articles/{id}/ancestors`
- Response: `ArticleListResponse` с массивом ancestors (root → article)
- Client-side функция: `loadCategoryPath(articleId)` в list.html/today.html

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
  - Факты: `btn btn-sm btn-success` (зеленая)
  - План: `btn btn-sm btn-info` (синяя)

#### 8.8.5 Форм-элементы модальных окон

**Общие компоненты:**

1. **Тип операции** - кнопки toggle (expense/income)
2. **Quick Amount Buttons** - быстрый выбор суммы
   - Факты: 100, 500, 1000, 5000
   - План: 5000, 10000, 20000, 50000
3. **Сумма** - number input (step=0.01, min=0.01)
4. **Категория** - CategoryTreeSelect с фильтрацией
5. **Счет** - select (required)
6. **Место затрат** - select (optional)
7. **Описание** - textarea (optional)

**Уникальные компоненты:**

**Факты:**
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

**2025-11-15 (v4 - Mobile Modal Optimization):**
- ✅ **CRITICAL FIX:** Исправлено растягивание модальных окон на мобильных устройствах (iOS Safari)
- ✅ **Проблема:** Адресная строка iOS Safari динамически скрывается при скролле, изменяя значение `vh` и вызывая "прыжки" модального окна
- ✅ **Решение:** Двойная стратегия фиксации высоты:
  - CSS: `dvh` (dynamic viewport height) для современных браузеров + fallback на CSS переменную `--real-vh`
  - JavaScript: Вычисление реальной высоты viewport через `window.innerHeight` с обновлением при resize/orientationchange
- ✅ **Высота модальных окон:**
  - Mobile (<640px): `max-height: 90dvh` (10% отступы = 5% сверху + 5% снизу)
  - Desktop (≥640px): `max-height: 95dvh` (5% отступы = 2.5% сверху + 2.5% снизу)
- ✅ **Дополнительно:**
  - Фиксированная позиция модального окна (`position: fixed`)
  - Блокировка скролла `body` при открытом модальном окне
  - Использование `!important` для переопределения DaisyUI стилей
- ✅ **Результат:** Модальные окна корректно отображаются на всех мобильных устройствах с фиксированными отступами

**2025-11-10 (v3 - Edit Modal Improvements):**
- ✅ **UX:** Исправлена ширина поля даты в modal_transaction.html (flex вместо grid-cols-2)
- ✅ **Загрузка данных:** Добавлена загрузка Счетов/Мест затрат в create modal для facts.html и plan.html
- ✅ **Edit Modal (facts.html):**
  - Добавлен переключатель типа категории (Доход/Расход) с динамической перезагрузкой списка
  - Заменен плоский список категорий на иерархический ChoicesCategoryTree
  - Добавлен CalendarWidget для выбора даты с иконкой
  - Переремещено поле "Описание" в конец формы (после Счет/Место затрат)
- ✅ **Edit Modal (plan.html):**
  - Заменен плоский список категорий на иерархический ChoicesCategoryTree
  - Порядок полей не изменен (как запрошено)
- ✅ **Обработка ошибок:** Toast уведомления при ошибках загрузки Счетов/Мест затрат

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
- [x] ~~Добавить иерархический выбор категорий в edit modal~~ (COMPLETED 2025-11-10)
- [x] ~~Добавить календарь для выбора даты в edit modal~~ (COMPLETED 2025-11-10)
- [x] ~~Исправить растягивание модальных окон на мобильных устройствах~~ (COMPLETED 2025-11-15)
- [ ] Рассмотреть создание единого базового компонента для обоих модальных окон
- [ ] Добавить валидацию на клиенте перед отправкой формы
- [ ] Улучшить accessibility (ARIA labels, keyboard navigation)

#### 8.8.9 Mobile Modal Optimization (Added 2025-11-15)

**Проблема:**

На мобильных устройствах (особенно iOS Safari) модальные окна некорректно отображались из-за динамического поведения адресной строки браузера:

1. **При первом открытии:** Адресная строка видна → `100vh` меньше → модальное окно с отступами ✅
2. **После скролла:** Адресная строка скрывается → `100vh` увеличивается → модальное окно растягивается на весь экран ❌

Это приводило к "прыжкам" модального окна и перекрытию кнопок управления.

**Техническое решение:**

Реализована **двойная стратегия** для максимальной совместимости со всеми браузерами:

**1. CSS (в `base.html`):**

```css
/* CSS переменная для реальной высоты viewport */
:root {
    --real-vh: 1vh;
}

/* Mobile (<640px) */
@media (max-width: 640px) {
    .modal {
        position: fixed !important;
        inset: 0;
    }

    .modal-box {
        /* Современные браузеры (Chrome 108+, Safari 15.4+) */
        max-height: 90dvh !important;

        /* Fallback для старых браузеров */
        max-height: calc(var(--real-vh, 1vh) * 90) !important;

        /* Центрирование */
        margin-top: auto !important;
        margin-bottom: auto !important;

        /* Прокрутка внутри */
        overflow-y: auto !important;
        overscroll-behavior: contain;
    }

    /* Блокировка скролла body */
    body:has(.modal[open]) {
        overflow: hidden;
        position: fixed;
        width: 100%;
    }
}

/* Desktop (≥640px) */
@media (min-width: 640px) {
    .modal-box {
        max-height: 95dvh !important;
        max-height: calc(var(--real-vh, 1vh) * 95) !important;
    }
}
```

**2. JavaScript (в `base.html`):**

```javascript
// Вычисление реальной высоты viewport для iOS Safari
function updateRealVH() {
    // window.innerHeight учитывает адресную строку
    const vh = window.innerHeight * 0.01;
    // Обновляем CSS переменную --real-vh
    document.documentElement.style.setProperty('--real-vh', `${vh}px`);
}

// Инициализация
updateRealVH();

// Обновление при изменении размера окна
window.addEventListener('resize', updateRealVH);

// Обновление при изменении ориентации
window.addEventListener('orientationchange', () => {
    setTimeout(updateRealVH, 100);
});
```

**Высота модальных окон:**

| Breakpoint | max-height | Отступы | Распределение |
|-----------|------------|---------|---------------|
| **Mobile (<640px)** | `90dvh` / `calc(var(--real-vh) * 90)` | 10% | 5% сверху + 5% снизу |
| **Desktop (≥640px)** | `95dvh` / `calc(var(--real-vh) * 95)` | 5% | 2.5% сверху + 2.5% снизу |

**Преимущества решения:**

- ✅ Работает на **всех браузерах** (современные используют `dvh`, старые - JavaScript fallback)
- ✅ **Фиксированные отступы** независимо от состояния адресной строки
- ✅ **Нет "прыжков"** модального окна при скролле
- ✅ Корректное **вертикальное центрирование** через `margin: auto`
- ✅ **Блокировка скролла** основной страницы при открытом модальном окне
- ✅ Использование `!important` для **переопределения DaisyUI** стилей

**Совместимость:**

- **iOS Safari 15.4+:** Native `dvh` support
- **Chrome 108+:** Native `dvh` support
- **Старые браузеры:** JavaScript fallback через `--real-vh`

**Тестирование:**

Протестировано и работает на:
- ✅ iPhone Safari (iOS 15+)
- ✅ Android Chrome
- ✅ Desktop Safari
- ✅ Desktop Chrome/Firefox/Edge

**Файлы:**
- `frontend/web/templates/base.html` (строки 29-84, 400-423)

---

#### 8.8.10 Transfer Modal (Added 2025-11-24)

**Назначение:** Модальное окно для создания переводов между счетами.

**Статус реализации:** ✅ FULLY IMPLEMENTED (v5.1.4+)

**Компонент:** `frontend/web/templates/components/modal_transfer.html`

**Интеграция:**
- Dashboard (`index.html`) - Quick Actions кнопка "💸 Перевод между счетами"
- Facts page (`facts.html`) - Кнопка "Добавить перевод" в заголовке
- Plan page (`plan.html`) - Кнопка "Добавить перевод" в заголовке

---

**Структура модального окна:**

```html
<dialog id="modal_transfer" class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg">💸 Перевод между счетами</h3>

    <form id="form_modal_transfer">
      <!-- Дата перевода -->
      <div class="form-control">
        <label class="label">
          <span class="label-text">Дата перевода</span>
        </label>
        <input type="date" name="fact_date" class="input input-bordered" required />

        <!-- Кнопки быстрого выбора даты -->
        <div class="flex gap-2 mt-2">
          <button type="button" class="btn btn-xs btn-outline" data-quick-date="today">
            Сегодня
          </button>
          <button type="button" class="btn btn-xs btn-outline" data-quick-date="yesterday">
            Вчера
          </button>
          <button type="button" class="btn btn-xs btn-outline" data-quick-date="day-before">
            Позавчера
          </button>
        </div>
      </div>

      <!-- Сумма -->
      <div class="form-control">
        <label class="label">
          <span class="label-text">Сумма перевода</span>
        </label>
        <input type="number" name="amount" class="input input-bordered"
               step="0.01" min="0.01" required />
      </div>

      <!-- ОТКУДА (FROM) -->
      <div class="divider">Откуда</div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Счет списания</span>
        </label>
        <select name="from_cfo_id" class="select select-bordered" required>
          <option value="">Выберите счет...</option>
        </select>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Категория списания (debit)</span>
        </label>
        <select name="from_article_id" class="select select-bordered" required>
          <option value="">Выберите категорию...</option>
        </select>
      </div>

      <!-- КУДА (TO) -->
      <div class="divider">Куда</div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Счет пополнения</span>
        </label>
        <select name="to_cfo_id" class="select select-bordered" required>
          <option value="">Выберите счет...</option>
        </select>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Категория пополнения (credit)</span>
        </label>
        <select name="to_article_id" class="select select-bordered" required>
          <option value="">Выберите категорию...</option>
        </select>
      </div>

      <!-- Описание -->
      <div class="form-control">
        <label class="label">
          <span class="label-text">Описание (опционально)</span>
        </label>
        <textarea name="description" class="textarea textarea-bordered"
                  rows="2" placeholder="Комментарий к переводу..."></textarea>
      </div>

      <!-- Кнопки управления -->
      <div class="modal-action">
        <button type="button" class="btn" onclick="modal_transfer.close()">
          Отмена
        </button>
        <button type="submit" class="btn btn-primary">
          💸 Создать перевод
        </button>
      </div>
    </form>
  </div>
</dialog>
```

---

**JavaScript Integration:**

**1. ChoicesCategoryTree для категорий переводов:**

```javascript
// Инициализация для категорий списания (debit)
const fromCategoryTree = new BudgetShared.ChoicesCategoryTree('#from_article_id', {
    type: 'debit',  // Фильтрация по типу 'debit'
    onSelect: (article) => {
        console.log('Selected FROM category:', article);
    }
});

// Инициализация для категорий пополнения (credit)
const toCategoryTree = new BudgetShared.ChoicesCategoryTree('#to_article_id', {
    type: 'credit',  // Фильтрация по типу 'credit'
    onSelect: (article) => {
        console.log('Selected TO category:', article);
    }
});
```

**2. Быстрый выбор даты:**

```javascript
function setupQuickDateButtons() {
    const quickDateButtons = document.querySelectorAll('[data-quick-date]');
    const dateInput = document.querySelector('#form_modal_transfer input[name="fact_date"]');

    if (quickDateButtons.length === 0 || !dateInput) return;

    quickDateButtons.forEach(button => {
        button.addEventListener('click', function() {
            const quickDate = this.dataset.quickDate;
            const today = new Date();
            let targetDate;

            switch (quickDate) {
                case 'today':
                    targetDate = today;
                    break;
                case 'yesterday':
                    targetDate = new Date(today.setDate(today.getDate() - 1));
                    break;
                case 'day-before':
                    targetDate = new Date(today.setDate(today.getDate() - 2));
                    break;
            }

            // Установить дату в формате YYYY-MM-DD
            dateInput.value = BudgetShared.DateFormatter.formatForAPI(targetDate);
        });
    });
}
```

**3. Валидация и отправка формы:**

```javascript
function setupTransferForm() {
    const form = document.getElementById('form_modal_transfer');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const data = {
            fact_date: formData.get('fact_date'),
            amount: parseFloat(formData.get('amount')),
            from_cfo_id: parseInt(formData.get('from_cfo_id')),
            from_article_id: parseInt(formData.get('from_article_id')),
            to_cfo_id: parseInt(formData.get('to_cfo_id')),
            to_article_id: parseInt(formData.get('to_article_id')),
            description: formData.get('description') || null
        };

        // Client-side validation
        if (data.from_cfo_id === data.to_cfo_id) {
            showToast('Счета "Откуда" и "Куда" должны быть разными', 'error');
            return;
        }

        if (data.amount <= 0) {
            showToast('Сумма должна быть больше 0', 'error');
            return;
        }

        try {
            const response = await fetch('/api/v1/transfers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const result = await response.json();
                showToast('Перевод успешно создан', 'success');
                document.getElementById('modal_transfer').close();
                location.reload();  // Обновить страницу для отображения новых транзакций
            } else {
                const error = await response.json();
                showToast(error.detail || 'Ошибка создания перевода', 'error');
            }
        } catch (error) {
            console.error('Transfer creation error:', error);
            showToast('Ошибка соединения с сервером', 'error');
        }
    });
}
```

---

**Visual Feedback - Badge "🔁 Перевод":**

**Facts Page (`facts.html`):**

Факты, которые являются частью перевода (имеют `transfer_id`), отображаются с визуальным индикатором:

```html
<!-- В таблице транзакций -->
<tr>
  <td>
    {% if fact.transfer_id %}
      <span class="badge badge-info badge-sm">🔁 Перевод</span>
    {% endif %}
    {{ fact.description }}
  </td>
  <!-- Другие колонки -->
</tr>
```

**Dashboard (`index.html`):**

В блоке "Последние факты" аналогично отображается badge для переводов.

---

**Validation Rules:**

**Client-side (JavaScript):**
1. `from_cfo_id != to_cfo_id` - Счета должны быть разными
2. `amount > 0` - Сумма больше нуля
3. `fact_date <= today()` - Дата не в будущем (handled by `<input type="date" max="...">`)

**Server-side (Backend API):**
1. `from_article.type == 'debit'` - Категория списания имеет тип 'debit'
2. `to_article.type == 'credit'` - Категория пополнения имеет тип 'credit'
3. Все правила из client-side validation
4. Atomic transaction - обе транзакции создаются вместе или обе откатываются

---

**API Endpoint:**

**POST /api/v1/transfers**

См. документацию в `07-api-specification.md`, раздел 7.10.

---

**Dependencies:**

**JavaScript Modules:**
- `BudgetShared.DateFormatter` - форматирование дат (API ↔ UI)
- `BudgetShared.ChoicesCategoryTree` - иерархический выбор категорий с фильтрацией по типу

**CSS:**
- DaisyUI modal, form-control, divider, badge components
- Mobile optimization (наследуется от section 8.8.9)

**Backend:**
- POST /api/v1/transfers endpoint
- GET /api/v1/articles?type=debit/credit для загрузки категорий
- GET /api/v1/financial-centers для загрузки счетов

---

**User Flow:**

1. **Открытие модального окна:**
   - Нажатие на кнопку "💸 Перевод между счетами" (Dashboard Quick Actions)
   - ИЛИ кнопка "Добавить перевод" на страницах Facts/Plan

2. **Заполнение формы:**
   - Выбор даты (вручную или через quick buttons)
   - Ввод суммы
   - Выбор Счета "Откуда" и категории списания (type='debit')
   - Выбор Счета "Куда" и категории пополнения (type='credit')
   - Опционально: комментарий

3. **Валидация:**
   - Client-side: Счета разные, сумма > 0
   - Server-side: типы категорий корректны (debit/credit)

4. **Создание перевода:**
   - Отправка POST /api/v1/transfers
   - Atomic создание 2 транзакций с одинаковым transfer_id
   - Toast notification об успехе/ошибке
   - Reload страницы для отображения новых данных

5. **Отображение результата:**
   - Обе транзакции видны в таблице Facts
   - Badge "🔁 Перевод" для визуальной индикации
   - Связь через transfer_id (для future features: переход к связанной транзакции)

---

**Файлы:**
- `frontend/web/templates/components/modal_transfer.html` - Компонент модального окна
- `frontend/web/static/js/transfer.js` - JavaScript логика (если отдельный файл)
- `frontend/shared/static/js/budgetShared.js` - Общие модули (DateFormatter, ChoicesCategoryTree)
- `backend/app/api/v1/endpoints/transfers.py` - Backend API endpoint

---

**Changelog:**

**2025-11-24 (v5.1.4+):**
- ✅ Реализовано модальное окно переводов
- ✅ Интеграция ChoicesCategoryTree для debit/credit категорий
- ✅ Добавлены quick date buttons (Сегодня/Вчера/Позавчера)
- ✅ Visual feedback badge "🔁 Перевод" для транзакций
- ✅ Client-side и server-side validation
- ✅ Atomic транзакции с общим transfer_id

**Технический долг:**
- [ ] Добавить кнопку "Посмотреть связанную транзакцию" в Facts table (переход к парной транзакции по transfer_id)
- [ ] Рассмотреть возможность bulk transfer (массовый перевод по списку)
- [ ] Добавить фильтр "Только переводы" на странице Facts
- [ ] Реализовать отмену перевода (удаление обеих связанных транзакций)

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

**2025-11-07 (Dashboard Layout Improvements + Article Type Filter Backend Fix):**
- ✅ **BUG FIX:** Исправлена фильтрация категорий по типу на /facts и /plan
  - **Проблема:** При выборе типа категории (Доходы/Расходы) фильтр не работал - выводился весь список категорий
  - **Root Cause:** API endpoint `/api/v1/admin/articles` не принимал параметр `type` в Query parameters
  - **Решение:** Добавлен параметр `type: str | None = Query(None)` в endpoint и фильтрация `query.where(Article.type == type)`
  - **Файлы:** `backend/app/api/v1/admin.py:543, 566`
- ✅ **UX IMPROVEMENT:** Изменён layout главной страницы Dashboard (/)
  - Переход с двухколоночного на одноколоночный layout (удалён `lg:grid-cols-2`)
  - Изменён порядок блоков: Быстрая статистика → Быстрые действия → Последние факты
  - Быстрые действия теперь горизонтальные с адаптивностью:
    - Мобильные (< sm): вертикальное расположение (`flex-col`)
    - Десктоп (≥ sm): горизонтальное с переносом (`flex-row flex-wrap`)
  - Убрано `w-full` у кнопок быстрых действий (естественная ширина)
  - Добавлено `w-full` к divider и alert блоку Telegram Bot
  - **Файлы:** `frontend/web/templates/index.html:33-90`
- ✅ **BUG FIX:** Исправлена ссылка "Посмотреть все транзакции" на Dashboard
  - **Проблема:** Ссылка вела на `/analytics` вместо `/facts`
  - **Решение:** Изменён href с `/analytics` на `/facts`
  - **Файлы:** `backend/app/api/v1/endpoints/facts.py:428`

**2025-11-05 (Article Type Filter + Record Type Filter Removal):**
- ✅ **FEATURE:** Добавлен фильтр "Тип категории" (article_type) в /plan и /facts
  - Динамическая фильтрация категорий по типу (Расходы/Доходы/Все)
  - Автоматическая перезагрузка списка категорий при изменении типа
  - Добавлена функция reloadArticleFilter() для динамической загрузки
  - Обновлен admin-facts-common.js для синхронизации article_type
- ✅ **REFACTOR:** Удален фильтр "Тип записи" (record_type) из UI
  - /plan всегда показывает только планы (record_type='plan' hardcoded)
  - /facts всегда показывает только факты (record_type='fact' hardcoded)
  - Изменен layout Основных фильтров: grid-cols-3 → grid-cols-4
  - Изменен layout Дополнительных фильтров: grid-cols-2 → grid-cols-1

**2025-11-05 (Filters Layout Refactoring + CalendarWidget Range Fix):**
- ✅ **UX IMPROVEMENT:** Реорганизация фильтров на трех уровнях с визуальным разделением
  - **Уровень 1 - Период:** Дата с/по (grid-cols-2, side by side)
  - **Уровень 2 - Основные фильтры:** Тип категории, Категория, Счет, Место затрат (grid-cols-4)
  - **Уровень 3 - Дополнительные:** Пользователь (grid-cols-1)
  - Визуальное разделение через borders, backgrounds и section titles
- ✅ **BUG FIX:** Исправлено дублирование DateFormatter в base.html
  - **Проблема:** `Identifier 'DateFormatter' has already been declared` в консоли браузера
  - **Root Cause:** DateFormatter подключался и в base.html:183 и в facts.html:260, plan.html:250
  - **Решение:** Удалено подключение из base.html, оставлены только в страницах с cache busting
- ✅ **BUG FIX:** Исправлена инициализация календаря для поля "Дата по"
  - **Проблема:** У поля "Дата по" отсутствовала кнопка календаря (только у "Дата с")
  - **Root Cause:** CalendarWidget._createTriggerButton() создавал кнопку только для startInputElement в range mode
  - **Решение:** Добавлен метод _createButtonForInput() для создания кнопок для обоих полей
  - Обновлен _attachEventListeners() для обработки кликов по обеим кнопкам
  - Обновлен "click outside" handler для учета endTriggerButton
- ✅ **FRONTEND:** Обновлены файлы
  - `web/templates/base.html` - удалено дублирование dateFormatter.js
  - `web/templates/facts.html` - новая трехуровневая структура фильтров
  - `web/templates/plan.html` - новая трехуровневая структура фильтров
  - `web/static/js/calendar-widget.js` - исправление range picker button creation
- ✅ **DOCS:** Обновлена docs/prd/08-ui-design.md с новой структурой фильтров
- ✅ **VALIDATION:** Проверен синтаксис JavaScript через `node --check`
- ✅ **Изменено файлов:** 4
- ✅ **Scope:** Web Interface (Desktop) - /facts и /plan страницы
- ✅ **Бенефиты:**
  - ✅ Улучшенная визуальная иерархия фильтров - легче ориентироваться
  - ✅ Приоритизация по важности (даты первыми, доп. фильтры последними)
  - ✅ Консистентный UI с четким разделением секций
  - ✅ Исправлена критическая JS ошибка (DateFormatter duplication)
  - ✅ Календарь работает корректно для обоих полей дат

**2025-11-04 (WebApp Auth Timing Fix - Race Condition):**
- ✅ **BUG FIX:** Исправлена race condition с window.auth в webapp
  - **Проблема:** `[ChoicesCategoryTree] Missing or invalid auth parameter. Please provide auth instance with getToken() method`
  - **Root Cause:** Race condition - `window.auth` устанавливался ПОСЛЕ `app.init()`, но `pageInit()` вызывается ВНУТРИ `app.init()`
  - **Контекст:** Последовательность выполнения:
    ```
    app.js:157 → new BudgetApp()
    app.js:158 → await app.init() {
      app.js:62   → await window.pageInit() {
        add.html:319 → await loadCategories() {
          add.html:474 → new ChoicesCategoryTree({auth: window.auth}) ← undefined!
        }
      }
    }
    app.js:161 → window.auth = app.auth  ← Слишком поздно!
    ```
  - **Решение:** Переместить установку `window.auth` ПЕРЕД `await app.init()`
- ✅ **FRONTEND:** Обновлен webapp/static/js/app.js
  - Переместил `window.app = app` и `window.auth = app.auth` перед `await app.init()` (строки 161-162)
  - Добавлен комментарий объясняющий timing requirement
  - Теперь `window.auth` доступен когда `pageInit()` вызывается внутри `init()`
- ✅ **VALIDATION:** Проверен синтаксис JavaScript через `node --check`
- ✅ **Изменено файлов:** 1 (webapp/static/js/app.js)
- ✅ **Scope:** Критическое исправление timing/race condition для auth
- ✅ **Бенефиты:**
  - ✅ window.auth доступен в правильный момент (до pageInit)
  - ✅ ChoicesCategoryTree получает валидный auth instance
  - ✅ Bearer token аутентификация работает в webapp
  - ✅ Загрузка категорий в webapp функционирует корректно

**2025-11-04 (Choices.js querySelector Fix - setupPathDisplay):**
- ✅ **BUG FIX:** Исправлена ошибка querySelector в setupPathDisplay()
  - **Проблема:** `SyntaxError: '#form_modal_add_transaction select[name="article_id"]-path' is not a valid selector`
  - **Root Cause:** Использовался `this.selector` (сложный CSS селектор) вместо `this.element.id` для построения селектора
  - **Контекст:** Если `selector = '#form select[name="x"]'`, то `${selector}-path` создает невалидный CSS
  - **Решение:** Изменено на `#${this.element.id}-path` (использует простой ID элемента)
- ✅ **FRONTEND:** Исправлены оба файла ChoicesCategoryTree
  - `web/static/js/choicesCategoryTree.js:220` - `querySelector(\`${this.selector}-path\`)` → `querySelector(\`#${this.element.id}-path\`)`
  - `webapp/static/js/choicesCategoryTree.js:237` - `querySelector(\`${this.selector}-path\`)` → `querySelector(\`#${this.element.id}-path\`)`
- ✅ **VALIDATION:** Проверен синтаксис JavaScript через `node --check`
- ✅ **Изменено файлов:** 2
- ✅ **Scope:** Критическое исправление path display селектора
- ✅ **Бенефиты:**
  - ✅ Path display элемент теперь корректно находится/создается
  - ✅ Устранена ошибка блокирующая инициализацию компонента

**2025-11-04 (Choices.js classNames API Fix - InvalidCharacterError):**
- ✅ **BUG FIX:** Исправлена ошибка InvalidCharacterError при инициализации Choices.js
  - **Проблема:** `InvalidCharacterError: The token provided ('choices choices-tailwind') contains HTML space characters`
  - **Root Cause:** В конфигурации classNames использовались строки с пробелами вместо массивов
  - **Контекст:** `classList.add()` не принимает строки с пробелами - требует отдельные аргументы или массив
  - **Решение:** Изменены все classNames со строк на массивы строк
- ✅ **FRONTEND:** Исправлены оба файла ChoicesCategoryTree
  - `web/static/js/choicesCategoryTree.js:185` - `containerOuter: 'choices choices-tailwind'` → `['choices', 'choices-tailwind']`
  - `webapp/static/js/choicesCategoryTree.js:202` - `containerOuter: 'choices choices-telegram'` → `['choices', 'choices-telegram']`
  - Все остальные classNames также переведены на массивы для консистентности
- ✅ **VALIDATION:** Проверен синтаксис JavaScript через `node --check`
- ✅ **AUDIT:** Проверены все HTML файлы - inline Choices.js не найден
- ✅ **Изменено файлов:** 2
  - `web/static/js/choicesCategoryTree.js` (17 classNames → arrays)
  - `webapp/static/js/choicesCategoryTree.js` (17 classNames → arrays)
- ✅ **Scope:** Критическое исправление Choices.js v11.1.0 API compliance
- ✅ **Бенефиты:**
  - ✅ Устранена ошибка блокирующая загрузку категорий
  - ✅ Соответствие официальному Choices.js API
  - ✅ Предотвращены аналогичные ошибки в будущем

**2025-11-04 (Choices.js Migration Completion - Auth Architecture Fix):**
- ✅ **CRITICAL FIX:** Разделены ChoicesCategoryTree версии для webapp и web
  - **Проблема:** webapp получал 401 Unauthorized при загрузке категорий
  - **Root Cause:** webapp использует Bearer token auth (Telegram initData), web использует httpOnly cookies
  - **Решение:** Создали две архитектурно разные версии компонента
- ✅ **webapp/static/js/choicesCategoryTree.js (Webapp version):**
  - Требует обязательный `auth` parameter в constructor
  - Валидирует наличие `auth.getToken()` метода при инициализации
  - Использует `Authorization: Bearer ${token}` header для всех API запросов
  - Удален `credentials: 'include'` (не работает в Telegram Web App)
- ✅ **web/static/js/choicesCategoryTree.js (Web version):**
  - НЕ требует `auth` parameter (аутентификация через cookies)
  - Использует `credentials: 'include'` для httpOnly cookies (Telegram Login Widget)
  - Tailwind CSS styling (`choices-tailwind` class, gray-500 text colors)
- ✅ **FRONTEND:** Обновлены webapp HTML файлы (3 файла)
  - `webapp/add.html:476` - добавлен `auth: window.auth` parameter
  - `webapp/edit.html:595` - добавлен `auth: window.auth` parameter
  - `webapp/addplan.html:617` - добавлен `auth: window.auth` parameter
- ✅ **FRONTEND:** Завершена миграция web/templates/index.html
  - Заменен `tomSelectCategoryTree.js` на `choicesCategoryTree.js`
  - Заменен класс `TomSelectCategoryTree` → `ChoicesCategoryTree` (2 места)
  - Добавлены Choices.js CSS и JS импорты
- ✅ **CACHE BUSTING:** Обновлены версии до `?v=20251104_0835` (12 файлов)
- ✅ **Изменено файлов:** 5
  - JS components: `webapp/static/js/choicesCategoryTree.js` (auth support)
  - HTML webapp: `add.html`, `edit.html`, `addplan.html` (auth parameter)
  - HTML web: `web/templates/index.html` (Choices.js migration complete)
- ✅ **Scope:** Финальное исправление миграции TomSelect → Choices.js
- ✅ **Бенефиты:**
  - ✅ webapp теперь корректно аутентифицируется через Bearer token
  - ✅ web продолжает работать через httpOnly cookies
  - ✅ Архитектурно правильное разделение auth логики
  - ✅ Четкая документация различий между webapp и web версиями

**2025-11-04 (Choices.js API Fix - web/templates/index.html):**
- ✅ **BUG FIX:** Исправлена ошибка querySelector в web/templates/index.html
  - **Проблема:** `Failed to execute 'querySelector' on 'Document': '[object HTMLSelectElement]' is not a valid selector`
  - **Root Cause:** Использовался старый API ChoicesCategoryTree с передачей DOM элемента вместо CSS селектора
  - **Решение:** Обновлена инициализация на новый Choices.js API
- ✅ **FRONTEND:** Переписана функция loadCategories() (web/templates/index.html:286-328)
  - Destroy existing instances перед пересозданием (`destroy()` метод)
  - Передача CSS селектора строкой вместо DOM элемента
  - Удалены deprecated параметры: `emptyOptionText`, `showEmptyOption`, `indentChar`, `parentPrefix`, `leafPrefix`
  - Удалена ручная загрузка категорий (компонент загружает автоматически)
  - Удален вызов `.init()` (вызывается автоматически в конструкторе)
- ✅ **FRONTEND:** Реализована динамическая фильтрация категорий
  - При смене типа операции (расход/доход) пересоздается компонент с новым типом
  - Используется существующий паттерн из webapp/add.html
- ✅ **CLEANUP:** Удалена глобальная переменная `allCategories` (не требуется)
- ✅ **Изменено файлов:** 2
  - HTML web: `web/templates/index.html` (loadCategories refactoring)
  - Docs: `docs/prd/08-ui-design.md` (changelog)
- ✅ **Scope:** Завершение миграции Choices.js в web/templates/index.html
- ✅ **Бенефиты:**
  - ✅ Устранена критическая ошибка загрузки категорий в модальных окнах
  - ✅ Унифицирован API использования ChoicesCategoryTree
  - ✅ Динамическая фильтрация категорий при смене типа операции
  - ✅ Упрощенный и более поддерживаемый код

**2025-11-03 (Migration from TomSelect to Choices.js):**
- ✅ **BREAKING CHANGE:** Полная миграция с TomSelect v2.3.1 на Choices.js v11.1.0
  - **Причина:** TomSelect не поддерживает text input для поиска (dropdown-only mode)
  - **Решение:** Choices.js с built-in Fuse.js fuzzy search и поддержкой text input
- ✅ **BACKEND:** Добавлена таблица t_article_usage_stats
  - Хранит pre-calculated usage statistics (usage_count) для каждой категории
  - Обновляется daily at 00:00 UTC через APScheduler cron job
  - PostgreSQL function `recalculate_article_usage_stats()` - TRUNCATE + INSERT pattern
  - Indexes: `usage_count DESC` для быстрой сортировки
- ✅ **BACKEND:** Создана модель ArticleUsageStats (SQLModel)
  - `article_id` (PK, FK to t_d_article)
  - `usage_count` (INT, default 0)
  - `last_updated` (TIMESTAMP)
- ✅ **BACKEND:** Обновлен API `/api/v1/articles`
  - LEFT JOIN с ArticleUsageStats для получения usage_count
  - Новый параметр `sort_by` (usage_count | name, default: usage_count)
  - Поле `usage_count` добавлено в ArticleResponse schema
  - Сортировка: по частоте использования (DESC), затем по имени (ASC)
- ✅ **BACKEND:** APScheduler integration
  - `backend/app/scheduler.py` - cron job daily at 00:00 UTC
  - Интеграция в `main.py` lifespan (startup/shutdown)
  - Dependency: `apscheduler==3.10.4` добавлен в requirements.txt
- ✅ **FRONTEND:** Скачан Choices.js v11.1.0 локально
  - `webapp/static/js/vendor/choices.min.js` (74 KB)
  - `webapp/static/css/vendor/choices.min.css` (7.6 KB)
  - `web/static/js/vendor/choices.min.js` и `web/static/css/vendor/choices.min.css`
- ✅ **FRONTEND:** Удалены все TomSelect файлы (8 файлов)
  - JS: `tomSelectCategoryTree.js`, `tom-select.complete.min.js` (webapp + web)
  - CSS: `tom-select.css`, `tom-select-telegram.css`, `tom-select-tailwind.css`
- ✅ **FRONTEND:** Создан новый компонент ChoicesCategoryTree (webapp + web)
  - API: `/api/v1/articles?sort_by=usage_count` для загрузки категорий
  - Fuzzy search через built-in Fuse.js (threshold 0.3, ignoreLocation: true)
  - Показывает только leaf categories (parent categories excluded)
  - Full path display через `/api/v1/articles/{id}/ancestors?include_self=true`
  - Асинхронная инициализация с error handling
- ✅ **FRONTEND:** Кастомные стили для Choices.js
  - `webapp/static/css/choices-telegram.css` - Telegram theme (CSS variables)
  - `web/static/css/choices-tailwind.css` - Tailwind CSS integration (@apply directives)
- ✅ **FRONTEND:** Обновлены все формы (11 файлов)
  - WebApp: `add.html`, `edit.html`, `addplan.html`
  - Web: `base.html`, `facts.html`, `plan.html`
  - Замена TomSelectCategoryTree на ChoicesCategoryTree
  - Упрощенная инициализация (type, showLeafOnly, onCategoryChange callback)
- ✅ **Изменено файлов:** 29 (backend + frontend)
  - Backend (9): migrations, models, schemas, API endpoints, scheduler, requirements.txt
  - Frontend (20): HTML forms, JS components, CSS styles, vendor files
- ✅ **Scope:** WebApp (Telegram Mini App) + Web Interface (Desktop)
- ✅ **Бенефиты:**
  - ✅ Text input для поиска (главная проблема TomSelect решена)
  - ✅ Сортировка по частоте использования (most used categories first)
  - ✅ Fuzzy search через встроенный Fuse.js
  - ✅ Более чистый API (меньше параметров конструктора)
  - ✅ Лучшая производительность (pre-calculated statistics)

**2025-11-03 [HISTORICAL] (TomSelect Reliability & Search Improvements):**
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
- Факты за "сегодня" не отображались из-за неправильного dateFrom

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

