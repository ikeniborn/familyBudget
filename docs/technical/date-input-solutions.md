# Date Input Solutions - Техническая документация

**Версия:** 2.0 (Platform-Specific Solutions)
**Дата:** 2025-11-02
**Статус:** Production Ready

---

## Оглавление

1. [Обзор решений](#1-обзор-решений)
2. [DateFormatter API](#2-dateformatter-api)
3. [WebApp Solution (Mobile) - Native Date Input](#3-webapp-solution-mobile---native-date-input)
4. [Web Interface Solution (Desktop) - CalendarWidget](#4-web-interface-solution-desktop---calendarwidget)
5. [Best Practices](#5-best-practices)
6. [Common Patterns](#6-common-patterns)

---

## 1. Обзор решений

### 1.1 Платформо-специфичный подход

Family Budget использует **Hybrid Solution** - оптимальную UX для каждой платформы:

| Платформа | Решение | Формат | Файлы |
|-----------|---------|--------|-------|
| **WebApp** (Mobile) | Native `<input type="date">` | YYYY-MM-DD | `webapp/add.html`, `webapp/edit.html` |
| **Web Interface** (Desktop) | CalendarWidget (DaisyUI) | DD.MM.YYYY | `web/templates/*.html` |

### 1.2 Архитектурные принципы

**1. Единый формат для API:** YYYY-MM-DD (ISO 8601)
- Backend всегда ожидает и возвращает YYYY-MM-DD
- Все даты в JSON API в формате ISO 8601

**2. Платформо-специфичное отображение:**
- WebApp: нативный date picker ОС (iOS/Android)
- Web: кастомный CalendarWidget с DD.MM.YYYY

**3. Централизованное форматирование:**
- `DateFormatter.js` - единый источник истины для конвертации дат
- Поддержка обоих форматов: DD.MM.YYYY ↔ YYYY-MM-DD

**4. Local Timezone:**
- Все даты используют LOCAL timezone (MSK, UTC+3)
- НЕ используется UTC (проблемы с `.toISOString()`)

### 1.3 Преимущества подхода

**WebApp (Mobile) - Native Date Input:**
- ✅ Оптимизированный нативный date picker для каждой мобильной ОС (iOS, Android)
- ✅ Touch-friendly UX - привычный интерфейс для пользователей
- ✅ Без дополнительного JS (~0KB overhead)
- ✅ Автоматическая валидация браузером
- ✅ Сохранены quick date shortcuts ("Сегодня", "Вчера", "Позавчера")

**Web Interface (Desktop) - CalendarWidget:**
- ✅ Улучшенный UX для desktop - визуальный календарь
- ✅ Range picker для фильтров "дата с/по"
- ✅ Без внешних зависимостей (DaisyUI Native)
- ✅ Полный контроль над UI/UX
- ✅ Легковесность - ~15KB (JS + CSS)

---

## 2. DateFormatter API

**Расположение:**
- `webapp/static/js/dateFormatter.js`
- `web/static/js/dateFormatter.js` (синхронизированы)

### 2.1 Базовые методы форматирования

#### `formatForAPI(displayDate)`

Конвертирует пользовательский формат (DD.MM.YYYY) в API формат (YYYY-MM-DD).

**Сигнатура:**
```javascript
static formatForAPI(displayDate: string): string
```

**Параметры:**
- `displayDate` - дата в формате DD.MM.YYYY

**Возвращает:** строка в формате YYYY-MM-DD или пустая строка при ошибке

**Примеры:**
```javascript
DateFormatter.formatForAPI('27.10.2025')  // => '2025-10-27'
DateFormatter.formatForAPI('01.01.2025')  // => '2025-01-01'
DateFormatter.formatForAPI('invalid')     // => ''
DateFormatter.formatForAPI('')            // => ''
```

**Использование:**
```javascript
// В форме создания транзакции
const formData = {
    fact_date: DateFormatter.formatForAPI(displayDate)  // DD.MM.YYYY → YYYY-MM-DD
};

await fetch('/api/v1/facts', {
    method: 'POST',
    body: JSON.stringify(formData)
});
```

---

#### `formatForDisplay(isoDate)`

Конвертирует API формат (YYYY-MM-DD) в пользовательский формат (DD.MM.YYYY).

**Сигнатура:**
```javascript
static formatForDisplay(isoDate: string): string
```

**Параметры:**
- `isoDate` - дата в формате YYYY-MM-DD

**Возвращает:** строка в формате DD.MM.YYYY или пустая строка при ошибке

**Примеры:**
```javascript
DateFormatter.formatForDisplay('2025-10-27')  // => '27.10.2025'
DateFormatter.formatForDisplay('2025-01-01')  // => '01.01.2025'
DateFormatter.formatForDisplay('invalid')     // => ''
DateFormatter.formatForDisplay('')            // => ''
```

**Использование:**
```javascript
// Отображение даты из API в таблице
const response = await fetch('/api/v1/facts');
const data = await response.json();

data.facts.forEach(fact => {
    const displayDate = DateFormatter.formatForDisplay(fact.fact_date);
    console.log(displayDate);  // '27.10.2025'
});
```

---

#### `today()`

Возвращает текущую дату в формате DD.MM.YYYY.

**Сигнатура:**
```javascript
static today(): string
```

**Возвращает:** строка в формате DD.MM.YYYY (LOCAL timezone)

**Примеры:**
```javascript
DateFormatter.today()  // => '02.11.2025' (сегодня в LOCAL timezone)
```

**Использование:**
```javascript
// Установить дату по умолчанию в текстовом input
const dateInput = document.getElementById('date-input');
dateInput.value = DateFormatter.today();
```

---

#### `todayISO()`

Возвращает текущую дату в формате YYYY-MM-DD для API.

**Сигнатура:**
```javascript
static todayISO(): string
```

**Возвращает:** строка в формате YYYY-MM-DD (LOCAL timezone)

**⚠️ ВАЖНО:** Использует LOCAL timezone, НЕ UTC!

**Примеры:**
```javascript
DateFormatter.todayISO()  // => '2025-11-02' (сегодня в LOCAL timezone)
```

**Использование:**
```javascript
// Фильтр по умолчанию "сегодня"
const filters = {
    date_from: DateFormatter.todayISO(),
    date_to: DateFormatter.todayISO()
};
```

**❌ НЕПРАВИЛЬНО (UTC проблема):**
```javascript
// НЕ используй это - возвращает UTC дату!
const dateFrom = new Date().toISOString().split('T')[0];
// Проблема: 02.11.2025 01:00 MSK → '2025-11-01' (неправильно!)
```

---

### 2.2 Методы для Native Date Input (NEW)

Эти методы добавлены для поддержки `<input type="date">` в WebApp.

#### `setNativeDateInput(inputElement, displayDate)`

Устанавливает значение для native date input, конвертируя DD.MM.YYYY → YYYY-MM-DD.

**Сигнатура:**
```javascript
static setNativeDateInput(inputElement: HTMLInputElement, displayDate: string): void
```

**Параметры:**
- `inputElement` - элемент `<input type="date">`
- `displayDate` - дата в формате DD.MM.YYYY

**Примеры:**
```javascript
const dateInput = document.getElementById('fact-date');

DateFormatter.setNativeDateInput(dateInput, '02.11.2025');
// Устанавливает inputElement.value = '2025-11-02'

DateFormatter.setNativeDateInput(dateInput, 'invalid');
// Устанавливает inputElement.value = '' (очистка)
```

**Использование:**
```javascript
// В форме редактирования транзакции
function populateFormFields(fact) {
    const dateInput = document.getElementById('fact-date');

    // fact.fact_date = '2025-11-02' (из API)
    // Конвертируем в DD.MM.YYYY и устанавливаем в native input
    const displayDate = DateFormatter.formatForDisplay(fact.fact_date);
    DateFormatter.setNativeDateInput(dateInput, displayDate);
}
```

---

#### `getNativeDateInput(inputElement)`

Получает значение из native date input, конвертируя YYYY-MM-DD → DD.MM.YYYY.

**Сигнатура:**
```javascript
static getNativeDateInput(inputElement: HTMLInputElement): string
```

**Параметры:**
- `inputElement` - элемент `<input type="date">`

**Возвращает:** строка в формате DD.MM.YYYY или пустая строка

**Примеры:**
```javascript
const dateInput = document.getElementById('fact-date');
// dateInput.value = '2025-11-02' (native format)

const displayDate = DateFormatter.getNativeDateInput(dateInput);
// => '02.11.2025'
```

**Использование:**
```javascript
// Получить дату для отображения
function getSelectedDate() {
    const dateInput = document.getElementById('fact-date');
    const displayDate = DateFormatter.getNativeDateInput(dateInput);

    console.log('Выбранная дата:', displayDate);  // '02.11.2025'

    // Для отправки в API конвертируем обратно
    const apiDate = DateFormatter.formatForAPI(displayDate);
    return apiDate;  // '2025-11-02'
}
```

---

#### `initNativeDateInput(inputElement)`

Инициализирует native date input с текущей датой (сегодня).

**Сигнатура:**
```javascript
static initNativeDateInput(inputElement: HTMLInputElement): void
```

**Параметры:**
- `inputElement` - элемент `<input type="date">`

**Примеры:**
```javascript
const dateInput = document.getElementById('fact-date');

DateFormatter.initNativeDateInput(dateInput);
// Устанавливает inputElement.value = '2025-11-02' (сегодня)
```

**Использование:**
```javascript
// В форме добавления транзакции (webapp/add.html)
function setupDateInput() {
    const dateInput = document.getElementById('fact-date');

    // Установить дату по умолчанию (сегодня)
    DateFormatter.initNativeDateInput(dateInput);
    formState.factDate = dateInput.value;  // Already in YYYY-MM-DD format

    dateInput.addEventListener('input', () => {
        // Native date input value is already in YYYY-MM-DD format
        formState.factDate = dateInput.value;
    });
}
```

---

### 2.3 Методы валидации

#### `isValidDisplayFormat(dateStr)`

Проверяет валидность даты в формате DD.MM.YYYY.

**Сигнатура:**
```javascript
static isValidDisplayFormat(dateStr: string): boolean
```

**Параметры:**
- `dateStr` - дата в формате DD.MM.YYYY

**Возвращает:** `true` если дата валидна

**Примеры:**
```javascript
DateFormatter.isValidDisplayFormat('27.10.2025')  // => true
DateFormatter.isValidDisplayFormat('32.10.2025')  // => false (day > 31)
DateFormatter.isValidDisplayFormat('29.02.2023')  // => false (не високосный год)
DateFormatter.isValidDisplayFormat('29.02.2024')  // => true (високосный год)
DateFormatter.isValidDisplayFormat('2025-10-27')  // => false (неверный формат)
```

**Использование:**
```javascript
// Валидация пользовательского ввода
function validateDateInput() {
    const dateInput = document.getElementById('date-input');
    const dateValue = dateInput.value;

    if (!DateFormatter.isValidDisplayFormat(dateValue)) {
        showError('Неверный формат даты (ДД.ММ.ГГГГ)');
        return false;
    }

    return true;
}
```

---

#### `isValidISOFormat(dateStr)`

Проверяет валидность даты в формате YYYY-MM-DD.

**Сигнатура:**
```javascript
static isValidISOFormat(dateStr: string): boolean
```

**Параметры:**
- `dateStr` - дата в формате YYYY-MM-DD

**Возвращает:** `true` если дата валидна

**Примеры:**
```javascript
DateFormatter.isValidISOFormat('2025-10-27')  // => true
DateFormatter.isValidISOFormat('2025-10-32')  // => false (day > 31)
DateFormatter.isValidISOFormat('27.10.2025')  // => false (неверный формат)
```

---

### 2.4 Дополнительные методы

#### `formatDateTime(date)`

Форматирует дату и время для отображения.

**Сигнатура:**
```javascript
static formatDateTime(date: Date | string): string
```

**Параметры:**
- `date` - объект Date или ISO строка

**Возвращает:** строка в формате DD.MM.YYYY HH:MM

**Примеры:**
```javascript
const date = new Date('2025-10-27T15:30:00');
DateFormatter.formatDateTime(date)  // => '27.10.2025 15:30'

DateFormatter.formatDateTime('2025-10-27T15:30:00')  // => '27.10.2025 15:30'
```

**Использование:**
```javascript
// Отображение времени создания транзакции
function renderTransaction(fact) {
    const createdAt = DateFormatter.formatDateTime(fact.created_at);
    return `Создано: ${createdAt}`;  // 'Создано: 27.10.2025 15:30'
}
```

---

#### `formatForDisplayWithMonthName(isoDate)`

Форматирует дату с русским названием месяца (ДД месяца ГГГГ).

**Сигнатура:**
```javascript
static formatForDisplayWithMonthName(isoDate: string): string
```

**Параметры:**
- `isoDate` - дата в формате YYYY-MM-DD

**Возвращает:** строка в формате "ДД месяца ГГГГ"

**Примеры:**
```javascript
DateFormatter.formatForDisplayWithMonthName('2025-10-27')  // => '27 октября 2025'
DateFormatter.formatForDisplayWithMonthName('2025-01-01')  // => '1 января 2025'
```

**Использование:**
```javascript
// Красивое отображение даты в уведомлениях
function renderNotification(notification) {
    const dateStr = DateFormatter.formatForDisplayWithMonthName(notification.period_start);
    return `Уведомление за ${dateStr}`;  // 'Уведомление за 27 октября 2025'
}
```

---

## 3. WebApp Solution (Mobile) - Native Date Input

### 3.1 Архитектура

**Расположение:** `webapp/add.html`, `webapp/edit.html`

**Ключевые решения:**
- Использование нативного `<input type="date">` для оптимальной mobile UX
- Интеграция с DateFormatter для работы с обоими форматами
- Quick Date Shortcuts для быстрого выбора ("Сегодня", "Вчера", "Позавчера")
- Haptic feedback для улучшения UX (Telegram WebApp)

**Формат:**
- **Input value:** YYYY-MM-DD (native format)
- **State storage:** YYYY-MM-DD (готово для API)
- **Display:** нативный date picker ОС

### 3.2 HTML структура

```html
<!-- Quick Date Shortcuts -->
<div class="quick-amount-buttons" style="margin-bottom: 8px;">
    <button type="button" class="quick-amount-btn" data-days="0">Сегодня</button>
    <button type="button" class="quick-amount-btn" data-days="-1">Вчера</button>
    <button type="button" class="quick-amount-btn" data-days="-2">Позавчера</button>
</div>

<!-- Native Date Input -->
<input
    type="date"
    id="fact-date"
    class="form-input"
    required
>
<span class="error-message" id="date-error"></span>
```

**⚠️ ВАЖНО:**
- `type="date"` - НЕ "text"!
- НЕ устанавливай `placeholder` для native date input
- НЕ устанавливай `pattern` - браузер валидирует автоматически

### 3.3 JavaScript интеграция

#### Пример 1: Форма добавления транзакции (webapp/add.html:397)

```javascript
let formState = {
    factType: 'expense',
    amount: null,
    categoryId: null,
    factDate: null  // Хранится в формате YYYY-MM-DD
};

function setupDateInput() {
    const dateInput = document.getElementById('fact-date');

    // Установить дату по умолчанию (сегодня)
    DateFormatter.initNativeDateInput(dateInput);
    formState.factDate = dateInput.value;  // Already in YYYY-MM-DD format

    // Обработчик изменений
    dateInput.addEventListener('input', () => {
        // Native date input value is already in YYYY-MM-DD format
        formState.factDate = dateInput.value;

        // Очистить ошибку
        document.getElementById('date-error').textContent = '';
        dateInput.classList.remove('input-error');
    });

    // Валидация при потере фокуса
    dateInput.addEventListener('blur', () => {
        // Native date input automatically validates format
        if (!dateInput.value) {
            document.getElementById('date-error').textContent = 'Дата обязательна';
            dateInput.classList.add('input-error');
        }
    });
}

// Вызов при инициализации страницы
window.pageInit = async function(budgetApp) {
    setupDateInput();
    setupQuickDateButtons();
    // ... остальная инициализация
};
```

**Ключевые моменты:**
1. `initNativeDateInput()` устанавливает сегодняшнюю дату
2. `dateInput.value` уже в формате YYYY-MM-DD (готово для API)
3. Нет необходимости в форматировании при отправке

---

#### Пример 2: Quick Date Shortcuts (webapp/add.html:422)

```javascript
function setupQuickDateButtons() {
    const buttons = document.querySelectorAll('.quick-amount-buttons button[data-days]');
    const dateInput = document.getElementById('fact-date');

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const daysOffset = parseInt(button.dataset.days);
            const date = new Date();
            date.setDate(date.getDate() + daysOffset);

            // Format for native date input (YYYY-MM-DD)
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const isoDate = `${year}-${month}-${day}`;

            // Set value for native date input (accepts YYYY-MM-DD)
            dateInput.value = isoDate;
            formState.factDate = isoDate;

            // Clear error
            document.getElementById('date-error').textContent = '';
            dateInput.classList.remove('input-error');

            // Haptic feedback
            app.ui.hapticLight();
        });
    });
}
```

**Ключевые моменты:**
1. `data-days` атрибут: 0 = сегодня, -1 = вчера, -2 = позавчера
2. Форматирование напрямую в YYYY-MM-DD (без DateFormatter)
3. Haptic feedback для улучшения UX

---

#### Пример 3: Форма редактирования транзакции (webapp/edit.html)

```javascript
function populateFormFields() {
    // ... заполнение других полей

    // Date (native date input accepts YYYY-MM-DD)
    const dateInput = document.getElementById('fact-date');
    dateInput.value = formState.factDate;  // Already in YYYY-MM-DD format from API
}

function setupDateInput() {
    const dateInput = document.getElementById('fact-date');

    // No need to initialize with today - will be populated from API

    dateInput.addEventListener('input', () => {
        formState.factDate = dateInput.value;  // Already in YYYY-MM-DD format

        document.getElementById('date-error').textContent = '';
        dateInput.classList.remove('input-error');
    });
}
```

**Ключевые моменты:**
1. При редактировании НЕ инициализируем с сегодняшней датой
2. Просто устанавливаем значение из API (уже YYYY-MM-DD)
3. Нет необходимости в конвертации

---

### 3.4 Отправка в API

```javascript
async function submitForm() {
    // Validate
    if (!formState.factDate) {
        showError('Дата обязательна');
        return;
    }

    // Prepare data
    const formData = {
        article_id: formState.categoryId,
        amount: formState.amount,
        fact_date: formState.factDate,  // Already in YYYY-MM-DD format!
        description: formState.description,
        financial_center_id: formState.financialCenterId,
        cost_center_id: formState.costCenterId,
        record_type: 'fact'
    };

    // Submit
    const response = await fetch('/api/v1/facts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    });

    // Handle response
    if (response.ok) {
        showSuccess('Транзакция добавлена');
        // Redirect to list
        window.location.href = '/webapp/index.html';
    }
}
```

**⚠️ ВАЖНО:**
- `formState.factDate` уже в формате YYYY-MM-DD
- НЕ нужно вызывать `DateFormatter.formatForAPI()`
- Готово для отправки в API без конвертации

---

## 4. Web Interface Solution (Desktop) - CalendarWidget

### 4.1 Архитектура

**Расположение:**
- `web/static/js/calendar-widget.js` (~600 lines)
- `web/static/css/calendar-widget.css` (~200 lines)

**Ключевые возможности:**
- Single Date Picker mode (для форм добавления/редактирования)
- Range Picker mode (для фильтров "дата с/по")
- Интеграция с DateFormatter (DD.MM.YYYY формат)
- Русская локализация (названия месяцев, дней)
- Keyboard navigation (ESC, Enter, Arrow keys)
- Click outside to close
- DaisyUI styling (Tailwind CSS)
- Без внешних зависимостей

**Формат:**
- **Input value:** DD.MM.YYYY (display format)
- **Internal:** Date objects
- **API conversion:** через DateFormatter

### 4.2 CalendarWidget API

#### Constructor Options

```javascript
new CalendarWidget(options)
```

**Options:**

| Опция | Тип | Обязательно | Описание |
|-------|-----|-------------|----------|
| `mode` | string | Нет (по умолчанию 'single') | Режим: 'single' или 'range' |
| `inputElement` | HTMLElement | Да (для single) | Input элемент для single mode |
| `startInputElement` | HTMLElement | Да (для range) | Start input для range mode |
| `endInputElement` | HTMLElement | Да (для range) | End input для range mode |
| `onSelect` | Function | Нет | Callback при выборе даты |
| `defaultDate` | Date | Нет | Дата по умолчанию (single mode) |
| `minDate` | Date | Нет | Минимальная дата |
| `maxDate` | Date | Нет | Максимальная дата |

---

### 4.3 Single Date Picker

#### Пример 1: Базовое использование (web/templates/facts.html:316)

```html
<!-- HTML -->
<input
    type="text"
    id="edit-date"
    name="fact_date"
    placeholder="ДД.ММ.ГГГГ"
    class="input input-bordered w-full"
    required
>
```

```javascript
// JavaScript (в DOMContentLoaded)
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация CalendarWidget для edit modal (Single Date Picker)
    new CalendarWidget({
        mode: 'single',
        inputElement: document.getElementById('edit-date'),
        onSelect: (date) => {
            console.log('Выбрана дата для edit modal:', date);
            // date в формате DD.MM.YYYY, готово для отображения
            // Для API: DateFormatter.formatForAPI(date)
        }
    });
});
```

**Что происходит:**
1. CalendarWidget автоматически создает кнопку-триггер рядом с input
2. При клике на кнопку открывается календарь
3. При выборе даты input заполняется в формате DD.MM.YYYY
4. Вызывается callback `onSelect` с датой в формате DD.MM.YYYY

---

#### Пример 2: Modal с отложенной инициализацией

**⚠️ ВАЖНО:** Для modal окон инициализацию нужно выполнять ПОСЛЕ загрузки DOM модалки!

```javascript
// ❌ НЕПРАВИЛЬНО - modal DOM еще не загружен
document.addEventListener('DOMContentLoaded', function() {
    const createDateInput = document.querySelector('#form_create_modal input[name="fact_date"]');
    new CalendarWidget({
        mode: 'single',
        inputElement: createDateInput  // null! Modal еще не в DOM
    });
});

// ✅ ПРАВИЛЬНО - инициализация после загрузки категорий (web/templates/facts.html:408)
async function loadArticles() {
    try {
        // ... загрузка категорий ...

        // Инициализация CalendarWidget для create modal (после загрузки категорий)
        const createDateInput = document.querySelector('#form_create_modal input[name="fact_date"]');
        if (createDateInput) {
            new CalendarWidget({
                mode: 'single',
                inputElement: createDateInput,
                onSelect: (date) => {
                    console.log('Выбрана дата для create modal:', date);
                }
            });
        }
    } catch (error) {
        console.error('Error loading articles:', error);
    }
}
```

**Ключевые моменты:**
1. Проверяй существование элемента: `if (createDateInput)`
2. Инициализируй после загрузки контента (например, в `loadArticles()`)
3. Modal должен быть в DOM перед инициализацией

---

#### Пример 3: Отправка в API

```javascript
async function createFact(e) {
    e.preventDefault();

    // Получить значение из input
    const dateInput = document.getElementById('edit-date');
    const displayDate = dateInput.value;  // '27.10.2025'

    // Валидация
    if (!DateFormatter.isValidDisplayFormat(displayDate)) {
        showToast('Неверный формат даты (ДД.ММ.ГГГГ)', 'error');
        return;
    }

    // Конвертация для API
    const apiDate = DateFormatter.formatForAPI(displayDate);  // '2025-10-27'

    // Prepare data
    const formData = {
        article_id: parseInt(document.getElementById('edit-category').value),
        amount: parseFloat(document.getElementById('edit-amount').value),
        fact_date: apiDate,  // YYYY-MM-DD format
        description: document.getElementById('edit-description').value,
        record_type: 'fact'
    };

    // Submit
    const response = await fetch('/api/v1/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    });

    if (response.ok) {
        showToast('Транзакция создана', 'success');
        await loadFacts();
    }
}
```

**Ключевые моменты:**
1. Input value в формате DD.MM.YYYY
2. Валидация: `isValidDisplayFormat()`
3. Конвертация: `formatForAPI()` перед отправкой
4. API получает YYYY-MM-DD

---

### 4.4 Range Picker

#### Пример 1: Фильтры "дата с/по" (web/templates/facts.html:306)

```html
<!-- HTML -->
<div class="form-control">
    <label class="label"><span class="label-text">Дата с:</span></label>
    <input
        type="text"
        id="filter-date-from"
        placeholder="ДД.ММ.ГГГГ"
        class="input input-bordered input-sm"
    >
</div>

<div class="form-control">
    <label class="label"><span class="label-text">Дата по:</span></label>
    <input
        type="text"
        id="filter-date-to"
        placeholder="ДД.ММ.ГГГГ"
        class="input input-bordered input-sm"
    >
</div>

<button class="btn btn-primary btn-sm" onclick="applyFilters()">
    Применить фильтры
</button>
```

```javascript
// JavaScript (в DOMContentLoaded)
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация CalendarWidget для фильтров дат (Range Picker)
    new CalendarWidget({
        mode: 'range',
        startInputElement: document.getElementById('filter-date-from'),
        endInputElement: document.getElementById('filter-date-to'),
        onSelect: (startDate, endDate) => {
            console.log('Выбран диапазон дат:', startDate, endDate);
            // startDate, endDate в формате DD.MM.YYYY

            // Опционально: автоматически применить фильтры
            // applyFilters();
        }
    });
});
```

**Что происходит:**
1. CalendarWidget создает одну кнопку между двумя inputs
2. При клике открывается календарь для выбора диапазона
3. Сначала выбирается start date, затем end date
4. Оба inputs заполняются в формате DD.MM.YYYY
5. Вызывается callback `onSelect(startDate, endDate)`

---

#### Пример 2: Auto-apply фильтры (web/templates/notifications.html)

```javascript
// Автоматическое применение фильтров при выборе диапазона
new CalendarWidget({
    mode: 'range',
    startInputElement: document.getElementById('filter-date-from'),
    endInputElement: document.getElementById('filter-date-to'),
    onSelect: (startDate, endDate) => {
        console.log('Выбран диапазон дат:', startDate, endDate);

        // Автоматически применить фильтры
        applyFilters();  // Auto-apply on selection
    }
});

function applyFilters() {
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;

    // Конвертация для API
    const filters = {
        date_from: dateFrom ? DateFormatter.formatForAPI(dateFrom) : null,
        date_to: dateTo ? DateFormatter.formatForAPI(dateTo) : null
    };

    // Fetch с фильтрами
    loadNotifications(filters);
}
```

**Ключевые моменты:**
1. `onSelect` вызывается с обеими датами сразу
2. Можно автоматически применять фильтры
3. Конвертация в YYYY-MM-DD для API

---

#### Пример 3: Range validation

```javascript
function applyFilters() {
    const dateFromInput = document.getElementById('filter-date-from');
    const dateToInput = document.getElementById('filter-date-to');

    const dateFrom = dateFromInput.value;
    const dateTo = dateToInput.value;

    // Валидация формата
    if (dateFrom && !DateFormatter.isValidDisplayFormat(dateFrom)) {
        showToast('Неверный формат даты "с" (ДД.ММ.ГГГГ)', 'error');
        return;
    }

    if (dateTo && !DateFormatter.isValidDisplayFormat(dateTo)) {
        showToast('Неверный формат даты "по" (ДД.ММ.ГГГГ)', 'error');
        return;
    }

    // Валидация диапазона
    if (dateFrom && dateTo) {
        const from = DateFormatter.parse(dateFrom);
        const to = DateFormatter.parse(dateTo);

        if (from > to) {
            showToast('Дата "с" не может быть позже даты "по"', 'error');
            return;
        }
    }

    // Применить фильтры
    const filters = {
        date_from: dateFrom ? DateFormatter.formatForAPI(dateFrom) : null,
        date_to: dateTo ? DateFormatter.formatForAPI(dateTo) : null
    };

    loadFacts(filters);
}
```

**Ключевые моменты:**
1. Валидация формата каждой даты
2. Валидация логики диапазона (from <= to)
3. Использование `DateFormatter.parse()` для сравнения

---

### 4.5 Keyboard Navigation

CalendarWidget поддерживает keyboard navigation:

| Клавиша | Действие |
|---------|----------|
| `ESC` | Закрыть календарь |
| `Enter` | Выбрать дату (если в фокусе) |
| `Arrow Up` | Предыдущая неделя |
| `Arrow Down` | Следующая неделя |
| `Arrow Left` | Предыдущий день |
| `Arrow Right` | Следующий день |

**Пример реализации:**

```javascript
// В calendar-widget.js
_attachEventListeners() {
    // ... другие слушатели ...

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!this.isOpen) return;

        if (e.key === 'Escape') {
            this.close();
        }

        if (e.key === 'Enter') {
            // Select focused date
            this._selectFocusedDate();
        }

        // Arrow navigation
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            this._navigateWithArrows(e.key);
        }
    });
}
```

---

## 5. Best Practices

### 5.1 Выбор решения (WebApp vs Web)

**Используй Native Date Input (WebApp) когда:**
- ✅ Целевая платформа - мобильные устройства (iOS, Android)
- ✅ Интеграция с Telegram WebApp
- ✅ Нужна минимальная нагрузка (0KB overhead)
- ✅ Хочешь нативный UX для каждой ОС

**Используй CalendarWidget (Web) когда:**
- ✅ Целевая платформа - desktop браузеры
- ✅ Нужен range picker для фильтров
- ✅ Требуется кастомизация UI
- ✅ Нужна визуальная обратная связь (календарь)

### 5.2 DateFormatter - правила использования

**✅ ВСЕГДА:**
1. Используй `formatForAPI()` перед отправкой в backend
2. Используй `formatForDisplay()` для отображения дат из API
3. Используй `todayISO()` (НЕ `.toISOString()`) для текущей даты
4. Валидируй даты с `isValidDisplayFormat()` или `isValidISOFormat()`

**❌ НИКОГДА:**
1. НЕ используй `.toISOString()` - возвращает UTC (проблемы с timezone)
2. НЕ конвертируй даты вручную - используй DateFormatter
3. НЕ смешивай форматы в одном контексте
4. НЕ валидируй даты регулярными выражениями - используй методы валидации

**Примеры:**

```javascript
// ✅ ПРАВИЛЬНО
const apiDate = DateFormatter.formatForAPI(displayDate);
const displayDate = DateFormatter.formatForDisplay(apiDate);
const today = DateFormatter.todayISO();

// ❌ НЕПРАВИЛЬНО
const apiDate = displayDate.split('.').reverse().join('-');  // Хрупко!
const displayDate = apiDate.split('-').reverse().join('.');  // Хрупко!
const today = new Date().toISOString().split('T')[0];        // UTC проблема!
```

### 5.3 Native Date Input - правила

**✅ ВСЕГДА:**
1. Используй `type="date"` (НЕ "text")
2. Инициализируй с `DateFormatter.initNativeDateInput()`
3. Храни state в формате YYYY-MM-DD (готово для API)
4. Валидируй обязательность (не пустое значение)

**❌ НИКОГДА:**
1. НЕ устанавливай `placeholder` для native date input
2. НЕ устанавливай `pattern` - браузер валидирует автоматически
3. НЕ конвертируй value перед отправкой - уже в YYYY-MM-DD

**Примеры:**

```javascript
// ✅ ПРАВИЛЬНО
<input type="date" id="fact-date" required>

DateFormatter.initNativeDateInput(dateInput);
formState.factDate = dateInput.value;  // Already YYYY-MM-DD

// ❌ НЕПРАВИЛЬНО
<input type="date" placeholder="ДД.ММ.ГГГГ" pattern="...">  // НЕ нужен placeholder/pattern!

dateInput.value = DateFormatter.today();  // Неправильный формат!
```

### 5.4 CalendarWidget - правила

**✅ ВСЕГДА:**
1. Используй `type="text"` для inputs с CalendarWidget
2. Устанавливай `placeholder="ДД.ММ.ГГГГ"`
3. Инициализируй ПОСЛЕ загрузки DOM (особенно для modals)
4. Конвертируй через `DateFormatter.formatForAPI()` перед отправкой

**❌ НИКОГДА:**
1. НЕ инициализируй calendar до загрузки DOM элементов
2. НЕ используй `type="date"` с CalendarWidget
3. НЕ забывай про валидацию формата

**Примеры:**

```javascript
// ✅ ПРАВИЛЬНО
<input type="text" id="date-input" placeholder="ДД.ММ.ГГГГ">

// После загрузки DOM
const dateInput = document.getElementById('date-input');
if (dateInput) {  // Проверка существования
    new CalendarWidget({
        mode: 'single',
        inputElement: dateInput
    });
}

// ❌ НЕПРАВИЛЬНО
<input type="date" id="date-input">  // Конфликт с CalendarWidget!

// До загрузки DOM
new CalendarWidget({
    inputElement: document.getElementById('not-loaded-yet')  // null!
});
```

### 5.5 Timezone - критически важно

**⚠️ ПРОБЛЕМА UTC:**

```javascript
// ❌ НЕПРАВИЛЬНО - UTC проблема
const dateFrom = new Date().toISOString().split('T')[0];
// 02.11.2025 01:00 MSK → '2025-11-01' (неправильно!)
```

**✅ РЕШЕНИЕ - LOCAL timezone:**

```javascript
// ✅ ПРАВИЛЬНО - DateFormatter.todayISO()
const dateFrom = DateFormatter.todayISO();
// 02.11.2025 01:00 MSK → '2025-11-02' (правильно!)

// Внутри DateFormatter.todayISO():
static todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;  // LOCAL timezone
}
```

**Всегда используй:**
- `DateFormatter.todayISO()` для текущей даты (YYYY-MM-DD)
- `DateFormatter.today()` для текущей даты (DD.MM.YYYY)

---

## 6. Common Patterns

### 6.1 Pattern: Форма добавления с quick shortcuts (WebApp)

```html
<!-- HTML -->
<label class="form-label">Дата</label>
<div class="quick-date-buttons">
    <button type="button" class="btn-quick-date" data-days="0">Сегодня</button>
    <button type="button" class="btn-quick-date" data-days="-1">Вчера</button>
    <button type="button" class="btn-quick-date" data-days="-2">Позавчера</button>
</div>
<input type="date" id="fact-date" required>
```

```javascript
// JavaScript
function setupQuickDateButtons() {
    const buttons = document.querySelectorAll('.btn-quick-date');
    const dateInput = document.getElementById('fact-date');

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const daysOffset = parseInt(button.dataset.days);
            const date = new Date();
            date.setDate(date.getDate() + daysOffset);

            // Format YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            dateInput.value = `${year}-${month}-${day}`;
            formState.factDate = dateInput.value;
        });
    });
}

function setupDateInput() {
    const dateInput = document.getElementById('fact-date');
    DateFormatter.initNativeDateInput(dateInput);
    formState.factDate = dateInput.value;

    dateInput.addEventListener('input', () => {
        formState.factDate = dateInput.value;
    });
}
```

---

### 6.2 Pattern: Range filter с auto-apply (Web)

```html
<!-- HTML -->
<input type="text" id="filter-date-from" placeholder="ДД.ММ.ГГГГ">
<input type="text" id="filter-date-to" placeholder="ДД.ММ.ГГГГ">
```

```javascript
// JavaScript
new CalendarWidget({
    mode: 'range',
    startInputElement: document.getElementById('filter-date-from'),
    endInputElement: document.getElementById('filter-date-to'),
    onSelect: (startDate, endDate) => {
        // Auto-apply filters
        applyFilters();
    }
});

function applyFilters() {
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;

    const filters = {
        date_from: dateFrom ? DateFormatter.formatForAPI(dateFrom) : null,
        date_to: dateTo ? DateFormatter.formatForAPI(dateTo) : null
    };

    loadData(filters);
}
```

---

### 6.3 Pattern: Modal с отложенной инициализацией (Web)

```javascript
// Инициализация ПОСЛЕ загрузки контента modal
async function loadCategories() {
    // ... загрузка данных ...

    // Теперь modal в DOM - можно инициализировать
    const modalDateInput = document.querySelector('#modal input[name="date"]');
    if (modalDateInput) {
        new CalendarWidget({
            mode: 'single',
            inputElement: modalDateInput,
            onSelect: (date) => {
                console.log('Selected:', date);
            }
        });
    }
}
```

---

### 6.4 Pattern: Validation перед submit

```javascript
async function submitForm() {
    const dateInput = document.getElementById('date-input');
    const dateValue = dateInput.value;

    // WebApp (native date input) - проверка на пустоту
    if (dateInput.type === 'date') {
        if (!dateValue) {
            showError('Дата обязательна');
            return;
        }
        // Native input value already in YYYY-MM-DD
        const apiDate = dateValue;
    }

    // Web (CalendarWidget) - проверка формата
    if (dateInput.type === 'text') {
        if (!dateValue) {
            showError('Дата обязательна');
            return;
        }
        if (!DateFormatter.isValidDisplayFormat(dateValue)) {
            showError('Неверный формат даты (ДД.ММ.ГГГГ)');
            return;
        }
        const apiDate = DateFormatter.formatForAPI(dateValue);
    }

    // Submit with apiDate (YYYY-MM-DD)
    await submitToAPI({ fact_date: apiDate });
}
```

---

### 6.5 Pattern: Load и populate form

```javascript
async function loadAndPopulateForm(factId) {
    // Fetch from API
    const response = await fetch(`/api/v1/facts/${factId}`);
    const fact = await response.json();

    // fact.fact_date = '2025-11-02' (YYYY-MM-DD from API)

    // WebApp (native date input)
    if (dateInput.type === 'date') {
        dateInput.value = fact.fact_date;  // Already YYYY-MM-DD
    }

    // Web (CalendarWidget)
    if (dateInput.type === 'text') {
        const displayDate = DateFormatter.formatForDisplay(fact.fact_date);
        dateInput.value = displayDate;  // '02.11.2025'
    }
}
```

---

## 7. Заключение

### 7.1 Ключевые выводы

1. **Платформо-специфичный подход** обеспечивает оптимальную UX для каждой платформы
2. **DateFormatter** - единый источник истины для конвертации дат
3. **Native Date Input** оптимален для мобильных устройств (0KB, нативный UX)
4. **CalendarWidget** оптимален для desktop (визуальный календарь, range picker)
5. **LOCAL timezone** критически важен для корректной работы с датами

### 7.2 Связанные документы

- **PRD:** `docs/prd/08-ui-design.md` (раздел 8.10.7)
- **Исходный код:**
  - `webapp/static/js/dateFormatter.js`
  - `web/static/js/dateFormatter.js`
  - `web/static/js/calendar-widget.js`
  - `web/static/css/calendar-widget.css`
- **Примеры использования:**
  - `webapp/add.html` (native date input)
  - `webapp/edit.html` (native date input)
  - `web/templates/facts.html` (CalendarWidget single + range)
  - `web/templates/plan.html` (CalendarWidget range)
  - `web/templates/notifications.html` (CalendarWidget range)

### 7.3 Поддержка и вопросы

При возникновении вопросов обратитесь к:
1. Этой документации
2. PRD (docs/prd/08-ui-design.md)
3. Исходному коду (inline комментарии)
4. CLAUDE.md (общие инструкции проекта)

---

**Документ подготовлен:** Claude Code
**Последнее обновление:** 2025-11-02
**Версия документа:** 1.0
