# Product Requirements Document: Telegram Web Apps Interface

**Версия:** 2.0
**Дата:** 2025-10-25
**Проект:** Family Budget - Telegram Bot Interface
**Статус:** Implementation Complete (Phase 0-3) - Ready for Testing

---

## 1. Обзор

### 1.1. Цель документа

Данный документ описывает требования к миграции Telegram бота Family Budget с традиционного ConversationHandler интерфейса на современную архитектуру Telegram Web Apps (Mini Apps).

### 1.2. Бизнес-цели

- **Улучшение UX**: Богатый веб-интерфейс вместо последовательных текстовых сообщений
- **Снижение нагрузки на бота**: Логика UI переносится на клиент
- **Расширение возможностей**: Доступ к нативным возможностям (геолокация, камера, биометрия)
- **Упрощение разработки**: Использование стандартных веб-технологий
- **Масштабируемость**: Легче добавлять новые формы и функции

### 1.3. Целевая аудитория

- Существующие пользователи бота (миграция без breaking changes)
- Новые пользователи с ожиданием современного UI
- Разработчики, поддерживающие и расширяющие функционал

---

## 2. Архитектурное решение

### 2.1. Выбранный подход

| Параметр | Решение | Обоснование |
|----------|---------|-------------|
| **Точка входа** | Menu Button | Всегда видна, заменяет /start команду |
| **Охват форм** | Все 9 команд | Полная миграция для единообразного UX |
| **Hosting** | Backend (FastAPI) | Минимум инфраструктуры, простая интеграция |
| **UI Framework** | Vanilla JS | Легковесность, нативные Telegram компоненты |
| **Authentication** | Telegram initData | Встроенная авторизация Telegram |
| **Data Storage** | CloudStorage | Синхронизация между устройствами |

### 2.2. Альтернативные подходы (отклонены)

| Подход | Причина отклонения |
|--------|-------------------|
| Inline Keyboard + Web Apps | Дополнительный клик, сложнее UX |
| Direct Links | Сложно делиться, нет единой точки входа |
| React/Vue framework | Избыточно для простых форм, увеличивает размер |
| Separate frontend container | Усложняет инфраструктуру, CORS проблемы |

---

## 3. Функциональные требования

### 3.1. Web Apps Список

Все существующие команды бота мигрируются на Web Apps:

| № | Команда | Web App URL | Описание | Приоритет |
|---|---------|------------|----------|----------|
| 0 | Menu | `/webapp/index` | Главное меню с 9 кнопками | P0 |
| 1 | /add | `/webapp/add` | Добавить транзакцию (доход/расход) | P0 |
| 2 | /today | `/webapp/today` | Транзакции за сегодня | P1 |
| 3 | /stats | `/webapp/stats` | Статистика с графиками | P1 |
| 4 | /list | `/webapp/list` | Список транзакций с фильтрами | P1 |
| 5 | /edit | `/webapp/edit` | Редактирование транзакции | P1 |
| 6 | /delete | `/webapp/delete` | Удаление транзакции | P1 |
| 7 | /addplan | `/webapp/addplan` | Создание бюджетного плана | P2 |
| 8 | /summary | `/webapp/summary` | Сводка план vs факт | P2 |
| 9 | /search | `/webapp/search` | Расширенный поиск транзакций | P2 |

**Приоритеты:**
- **P0** - MVP (Menu + Add)
- **P1** - Phase 1 (основные функции просмотра и редактирования)
- **P2** - Phase 2 (расширенные функции планирования)

### 3.2. User Flow

#### 3.2.1. Главный Flow

```
1. Пользователь открывает бота
   ↓
2. Видит Menu Button "📱 Открыть приложение" (всегда видна)
   ↓
3. Нажимает Menu Button
   ↓
4. Открывается Web App с главным меню (9 кнопок)
   ↓
5. Выбирает действие (например, "💰 Добавить")
   ↓
6. Открывается форма добавления транзакции
   ↓
7. Заполняет форму:
   - Выбирает категорию (иерархический выбор)
   - Вводит сумму
   - Выбирает дату (опционально)
   - Добавляет описание (опционально)
   ↓
8. Нажимает MainButton "Сохранить"
   ↓
9. Данные отправляются на backend API
   ↓
10. Получает подтверждение (popup или alert)
    ↓
11. Может:
    - Вернуться в меню (BackButton)
    - Закрыть Web App
    - Продолжить работу (добавить еще)
```

#### 3.2.2. Alternative Flows

**Flow A: Быстрый доступ через Direct Link**
```
Пользователь → t.me/botname/add → Форма добавления (минуя меню)
```

**Flow B: Ошибка валидации**
```
Форма → Validation Error → Highlight поля → Пользователь исправляет → Retry
```

**Flow C: Offline режим**
```
No internet → Show error popup → "Нет подключения. Проверьте интернет."
```

### 3.3. Детальные требования к формам

#### 3.3.1. Web App: Main Menu (`/webapp/index`)

**Layout:**
```
┌─────────────────────────────┐
│     Family Budget           │  ← Header
├─────────────────────────────┤
│  💰 Добавить  📅 Сегодня  │
│  📈 Статистика             │  ← 3x3 grid
│  📋 Список    ✏️ Редактир. │
│  🗑️ Удалить   📊 План      │
│  📉 Сравнение  🔍 Поиск    │
└─────────────────────────────┘
```

**Функциональность:**
- Все 9 кнопок всегда видны
- Цвета кнопок соответствуют Telegram theme
- Ripple эффект при нажатии
- Haptic feedback (light impact)
- При клике открывается соответствующий Web App

**API Calls:** Нет (только навигация)

---

#### 3.3.2. Web App: Add Transaction (`/webapp/add`)

**Поля формы:**

1. **Тип транзакции** (обязательно)
   - Toggle: "Расход" / "Доход"
   - Default: "Расход"

2. **Категория** (обязательно)
   - Hierarchical selection (parent → child → grandchild → leaf)
   - Breadcrumb navigation: `Продукты > Магазин > Магнит`
   - Показывать только is_current=true статьи
   - Фильтровать по типу (expense/income)
   - BackButton для возврата на уровень выше

3. **Сумма** (обязательно)
   - Input type: number, step=0.01
   - Placeholder: "0.00"
   - Currency symbol: "₽" (справа)
   - Min: 0.01, Max: 9999999.99
   - Auto-focus при открытии

4. **Дата** (опционально)
   - Date picker (native iOS/Android)
   - Default: Сегодня
   - Max: Сегодня (нельзя будущее)

5. **Описание** (опционально)
   - Textarea, max 500 symbols
   - Placeholder: "Опишите транзакцию..."
   - Counter: "0/500"

**MainButton:**
- Text: "Сохранить"
- Color: theme.button_color
- Enabled только когда все обязательные поля заполнены
- ShowProgress при отправке
- Haptic feedback: notification (success/error)

**Validation:**
```javascript
{
  category: required,
  amount: required, min: 0.01, max: 9999999.99,
  date: optional, max: today,
  description: optional, maxLength: 500
}
```

**API Call:**
```http
POST /api/v1/webapp/facts
Authorization: Bearer <jwt_from_initData>
Content-Type: application/json

{
  "article_id": 123,
  "amount": 500.50,
  "date": "2025-10-24",
  "description": "Продукты в Магните",
  "record_type": "fact"
}
```

**Success Response:**
```javascript
Telegram.WebApp.showAlert('✅ Транзакция добавлена!', () => {
  Telegram.WebApp.close(); // или вернуться в меню
});
```

**Error Handling:**
```javascript
catch (error) {
  if (error.status === 401) {
    Telegram.WebApp.showAlert('❌ Ошибка авторизации. Перезапустите бота.');
  } else if (error.status === 400) {
    // Show validation errors
    showFieldErrors(error.data.detail);
  } else {
    Telegram.WebApp.showAlert('❌ Ошибка сервера. Попробуйте позже.');
  }
}
```

---

#### 3.3.3. Web App: Today (`/webapp/today`)

**Layout:**
```
┌─────────────────────────────┐
│  📅 Транзакции сегодня      │  ← Header
│  24 окт 2025                │
├─────────────────────────────┤
│  💸 Расходы: -1,250.00 ₽   │  ← Summary
│  💰 Доходы:  +5,000.00 ₽   │
│  📊 Баланс:  +3,750.00 ₽   │
├─────────────────────────────┤
│  🛒 Продукты      -500.00 ₽│  ← Transaction list
│  Магнит                     │
│  12:30                      │
│                             │
│  🚇 Транспорт     -100.00 ₽│
│  Метро                      │
│  10:15                      │
│  ...                        │
└─────────────────────────────┘
│  ← Назад                    │  ← BackButton
└─────────────────────────────┘
```

**Функциональность:**
- Показать все транзакции за текущий день
- Группировать по времени (desc)
- Показывать emoji категории
- Цветовое кодирование (расход=red, доход=green)
- Pull-to-refresh для обновления
- Tap на транзакцию → Open edit/delete menu

**API Call:**
```http
GET /api/v1/webapp/facts?date_from=2025-10-24&date_to=2025-10-24
Authorization: Bearer <jwt>
```

**Empty State:**
```
┌─────────────────────────────┐
│  📅 Транзакции сегодня      │
├─────────────────────────────┤
│                             │
│     📭                      │
│  Нет транзакций за сегодня  │
│                             │
│  [Добавить транзакцию]     │
│                             │
└─────────────────────────────┘
```

---

#### 3.3.4. Web App: Stats (`/webapp/stats`)

**Компоненты:**

1. **Period Selector**
   - Tabs: "Сегодня" | "Неделя" | "Месяц" | "Год"
   - Custom range picker

2. **Summary Cards**
   ```
   ┌──────────┬──────────┬──────────┐
   │ Расходы  │  Доходы  │  Баланс  │
   │ 15,000 ₽ │ 50,000 ₽ │+35,000 ₽ │
   └──────────┴──────────┴──────────┘
   ```

3. **Charts**
   - Pie chart: Расходы по категориям
   - Bar chart: Расходы по дням
   - Line chart: Баланс динамика

4. **Top Categories**
   - List: Top 5 expense categories
   - % from total

**Charting Library:** Chart.js (lightweight, 60KB gzipped)

**API Calls:**
```http
GET /api/v1/webapp/stats/summary?period=month
GET /api/v1/webapp/stats/by-category?period=month
GET /api/v1/webapp/stats/by-day?period=month
```

---

#### 3.3.5. Web App: List (`/webapp/list`)

**Фильтры:**
```
┌─────────────────────────────┐
│  Тип: [Все ▼] Период: [▼]  │  ← Filter bar
│  Категория: [Все ▼]         │
├─────────────────────────────┤
│  🛒 Продукты      -500.00 ₽│  ← Transaction list
│  24 окт 12:30               │
│  ...                        │
├─────────────────────────────┤
│  [Загрузить еще]           │  ← Pagination
└─────────────────────────────┘
```

**Pagination:**
- Load 20 items initially
- Infinite scroll или "Load more" button
- Total count в заголовке: "Найдено: 152 транзакции"

**API Call:**
```http
GET /api/v1/webapp/facts?
  type=expense&
  date_from=2025-10-01&
  date_to=2025-10-31&
  category_id=123&
  limit=20&
  offset=0
```

---

#### 3.3.6. Web App: Edit (`/webapp/edit`)

**Flow:**
```
1. Search transaction (by date, category, amount)
   ↓
2. Select from results
   ↓
3. Edit form (same as Add, prefilled)
   ↓
4. Save changes
```

**Search Interface:**
```
┌─────────────────────────────┐
│  🔍 [Поиск транзакций...]  │  ← Search input
├─────────────────────────────┤
│  🛒 Продукты      -500.00 ₽│  ← Search results
│  24 окт 12:30               │
│  Магнит                     │
│  [Редактировать]           │
│  ...                        │
└─────────────────────────────┘
```

**Edit Form:**
- Prefill all fields from selected transaction
- Same validation as Add
- MainButton: "Сохранить изменения"
- Add "Удалить" danger button

**API Calls:**
```http
GET /api/v1/webapp/facts?search=<query>
PUT /api/v1/webapp/facts/{id}
DELETE /api/v1/webapp/facts/{id}
```

---

#### 3.3.7. Web App: Delete (`/webapp/delete`)

**Flow:**
```
1. Search transaction
   ↓
2. Select from results
   ↓
3. Confirm deletion (popup)
   ↓
4. Delete
```

**Confirmation Popup:**
```javascript
Telegram.WebApp.showConfirm(
  'Удалить транзакцию "Продукты, 500.00 ₽"?',
  (confirmed) => {
    if (confirmed) {
      deleteTransaction(id);
    }
  }
);
```

**API Call:**
```http
DELETE /api/v1/webapp/facts/{id}
```

---

#### 3.3.8. Web App: Add Plan (`/webapp/addplan`)

**Form Fields:**

1. **Категория** (обязательно)
   - Hierarchical selection (same as Add)

2. **Плановая сумма** (обязательно)
   - Input type: number, step=0.01

3. **Период** (обязательно)
   - Radio: "Месяц" | "Квартал" | "Год"
   - Date range picker для custom

4. **Повторяющийся** (опционально)
   - Checkbox: "Создавать автоматически каждый период"

**API Call:**
```http
POST /api/v1/webapp/facts
{
  "article_id": 123,
  "amount": 15000.00,
  "date": "2025-10-01", // period start
  "record_type": "plan"
}
```

---

#### 3.3.9. Web App: Summary (`/webapp/summary`)

**Layout:**
```
┌─────────────────────────────┐
│  📊 План vs Факт            │
│  Период: [Месяц ▼]          │
├─────────────────────────────┤
│  💸 РАСХОДЫ                 │
│  План:  15,000 ₽            │
│  Факт:  12,500 ₽            │
│  ✅ Экономия: 2,500 ₽ (17%)│
│                             │
│  🛒 Продукты                │
│  План:  10,000 ₽            │
│  Факт:   8,000 ₽            │
│  ✅ Экономия: 2,000 ₽ (20%)│
│  [Progress bar 80%]         │
│                             │
│  🚗 Транспорт               │
│  План:   5,000 ₽            │
│  Факт:   6,500 ₽            │
│  ⚠️ Превышение: 1,500 ₽ (30%)│
│  [Progress bar 130%]        │
└─────────────────────────────┘
```

**API Call:**
```http
GET /api/v1/webapp/facts?
  date_from=2025-10-01&
  date_to=2025-10-31&
  record_type=plan,fact
```

**Calculation:**
```javascript
// Group by category
const grouped = facts.reduce((acc, fact) => {
  if (!acc[fact.article_id]) {
    acc[fact.article_id] = { plan: 0, fact: 0 };
  }
  acc[fact.article_id][fact.record_type] += fact.amount;
  return acc;
}, {});

// Calculate diff
Object.entries(grouped).forEach(([id, data]) => {
  data.diff = data.plan - data.fact;
  data.percent = (data.fact / data.plan) * 100;
});
```

---

#### 3.3.10. Web App: Search (`/webapp/search`)

**Advanced Filters:**

1. **Date Range**
   - From: date picker
   - To: date picker

2. **Type**
   - Checkbox: "Расход" | "Доход" | "План"

3. **Category**
   - Multi-select tree (с поддержкой иерархии)

4. **Amount Range**
   - Min: number input
   - Max: number input

5. **Description**
   - Text search (fuzzy)

**Search Button:**
```
[🔍 Найти транзакции]
```

**API Call:**
```http
POST /api/v1/webapp/facts/search
{
  "date_from": "2025-01-01",
  "date_to": "2025-10-24",
  "types": ["fact", "plan"],
  "category_ids": [1, 2, 3],
  "amount_min": 100,
  "amount_max": 10000,
  "description": "магнит"
}
```

**Results:**
- Same layout as List
- Show match highlights
- Export button (CSV/Excel)

---

## 4. Нефункциональные требования

### 4.1. Performance

| Метрика | Требование | Измерение |
|---------|-----------|-----------|
| **Time to Interactive** | < 1.5 sec | Lighthouse |
| **First Contentful Paint** | < 1 sec | Lighthouse |
| **Bundle Size** | < 200 KB (gzipped) | webpack-bundle-analyzer |
| **API Response Time** | < 300 ms (p95) | Backend metrics |
| **Frame Rate** | 60 FPS | Chrome DevTools |

**Оптимизации:**
- Minify JS/CSS
- Lazy load non-critical scripts
- Use CDN for telegram-web-app.js
- Implement service worker для offline
- Cache API responses в CloudStorage

### 4.2. Security

**Authentication:**
```javascript
// Client-side (untrusted)
const user = Telegram.WebApp.initDataUnsafe.user;

// Server-side (trusted)
function validateInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return hash === calculatedHash;
}
```

**Security Headers:**
```
Content-Security-Policy: default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

**Data Validation:**
- Всегда валидировать initData на backend
- Проверять auth_date (не старше 1 часа)
- Используйте prepared statements для SQL
- Sanitize user inputs (XSS protection)
- Rate limiting: 100 req/min per user

### 4.3. Accessibility

**WCAG 2.1 Level AA:**
- Все inputs имеют labels
- Color contrast ratio ≥ 4.5:1
- Touch targets ≥ 44x44 px
- Keyboard navigation support
- Screen reader support (aria-labels)

**Telegram Accessibility:**
- Используйте semantic HTML
- Provide alt text для images
- Use descriptive button texts
- Support dynamic font sizes
- Test with VoiceOver/TalkBack

### 4.4. Compatibility

**Browsers:**
- iOS Safari 14+
- Android Chrome 90+
- Desktop Telegram (Chromium-based)

**Devices:**
- iPhone 8+ (iOS 14+)
- Android 8+ devices
- Tablet support (responsive)
- No IE11 support (deprecated)

**Telegram Versions:**
- Bot API 8.0+ (Fullscreen, DeviceStorage)
- PTB 20.x (Menu Button)
- Check feature support:
  ```javascript
  if (Telegram.WebApp.isVersionAtLeast('8.0')) {
    // Use fullscreen
  }
  ```

### 4.5. Monitoring & Analytics

**Metrics to track:**

1. **Usage Metrics**
   - Web App opens per day
   - Form submissions per Web App
   - Average session duration
   - Bounce rate per Web App

2. **Performance Metrics**
   - Load time (p50, p95, p99)
   - API response time
   - Error rate
   - Crash rate

3. **Business Metrics**
   - Transactions created per day
   - Active users (DAU, MAU)
   - Retention rate (D1, D7, D30)
   - Feature adoption rate

**Tools:**
- Backend: Prometheus + Grafana
- Frontend: Google Analytics или Amplitude
- Error tracking: Sentry
- Log aggregation: ELK stack

---

## 5. Технические спецификации

### 5.1. Backend API

#### 5.1.1. Authentication Endpoint

```http
POST /api/v1/webapp/validate
Content-Type: application/json

{
  "initData": "query_id=...&user={...}&auth_date=1234567890&hash=..."
}

Response 200:
{
  "valid": true,
  "user": {
    "id": 740775802,
    "first_name": "Ivan",
    "username": "ikeniborn"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}

Response 401:
{
  "detail": "Invalid initData signature"
}
```

#### 5.1.2. Facts API (Transactions)

**List Facts:**
```http
GET /api/v1/webapp/facts?
  date_from=2025-10-01&
  date_to=2025-10-31&
  type=fact&
  category_id=123&
  limit=20&
  offset=0

Authorization: Bearer <token>

Response 200:
{
  "facts": [
    {
      "id": 456,
      "article_id": 123,
      "article_name": "Продукты",
      "amount": -500.00,
      "date": "2025-10-24",
      "description": "Магнит",
      "record_type": "fact",
      "created_at": "2025-10-24T12:30:00Z"
    },
    ...
  ],
  "total": 152,
  "limit": 20,
  "offset": 0
}
```

**Create Fact:**
```http
POST /api/v1/webapp/facts
Authorization: Bearer <token>
Content-Type: application/json

{
  "article_id": 123,
  "amount": 500.50,
  "date": "2025-10-24",
  "description": "Продукты в Магните",
  "record_type": "fact"
}

Response 201:
{
  "id": 789,
  "article_id": 123,
  "amount": -500.50,
  "date": "2025-10-24",
  "description": "Продукты в Магните",
  "record_type": "fact",
  "created_at": "2025-10-24T14:20:00Z"
}

Response 400:
{
  "detail": [
    {
      "loc": ["body", "amount"],
      "msg": "Amount must be positive",
      "type": "value_error"
    }
  ]
}
```

**Update Fact:**
```http
PUT /api/v1/webapp/facts/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 600.00,
  "description": "Продукты в Пятёрочке"
}

Response 200:
{
  "id": 789,
  "article_id": 123,
  "amount": -600.00,
  "date": "2025-10-24",
  "description": "Продукты в Пятёрочке",
  ...
}
```

**Delete Fact:**
```http
DELETE /api/v1/webapp/facts/{id}
Authorization: Bearer <token>

Response 204: No Content
```

#### 5.1.3. Articles API (Categories)

```http
GET /api/v1/webapp/articles?type=expense&is_current=true
Authorization: Bearer <token>

Response 200:
{
  "articles": [
    {
      "id": 1,
      "name": "Продукты",
      "type": "expense",
      "parent_id": null,
      "level": 0,
      "has_children": true
    },
    {
      "id": 2,
      "name": "Магазин",
      "type": "expense",
      "parent_id": 1,
      "level": 1,
      "has_children": true
    },
    {
      "id": 3,
      "name": "Магнит",
      "type": "expense",
      "parent_id": 2,
      "level": 2,
      "has_children": false
    },
    ...
  ]
}
```

#### 5.1.4. Stats API

```http
GET /api/v1/webapp/stats/summary?period=month
Authorization: Bearer <token>

Response 200:
{
  "period": {
    "start": "2025-10-01",
    "end": "2025-10-31"
  },
  "income": {
    "total": 50000.00,
    "count": 2
  },
  "expense": {
    "total": -15000.00,
    "count": 45
  },
  "balance": 35000.00
}
```

```http
GET /api/v1/webapp/stats/by-category?period=month&type=expense
Authorization: Bearer <token>

Response 200:
{
  "categories": [
    {
      "id": 1,
      "name": "Продукты",
      "total": -8000.00,
      "count": 25,
      "percent": 53.3
    },
    {
      "id": 5,
      "name": "Транспорт",
      "total": -4000.00,
      "count": 15,
      "percent": 26.7
    },
    ...
  ],
  "total": -15000.00
}
```

### 5.2. Frontend Structure

```
backend/webapp/
├── index.html              # Main menu (P0)
├── add.html                # Add transaction (P0)
├── today.html              # Today's transactions (P1)
├── stats.html              # Statistics (P1)
├── list.html               # Transaction list (P1)
├── edit.html               # Edit transaction (P1)
├── delete.html             # Delete transaction (P1)
├── addplan.html            # Create plan (P2)
├── summary.html            # Plan vs Fact (P2)
├── search.html             # Advanced search (P2)
└── static/
    ├── js/
    │   ├── telegram-web-app.js      # Telegram SDK (CDN)
    │   ├── app.js                   # Core app logic
    │   ├── api.js                   # API client
    │   ├── auth.js                  # Authentication
    │   ├── ui.js                    # UI helpers
    │   ├── theme.js                 # Theme management
    │   ├── storage.js               # CloudStorage wrapper
    │   └── validators.js            # Form validation
    ├── css/
    │   ├── app.css                  # Main styles
    │   ├── telegram-theme.css       # Telegram theme variables
    │   └── forms.css                # Form styles
    └── img/
        └── icons/
            ├── add.svg
            ├── stats.svg
            └── ...
```

### 5.3. Key JavaScript Modules

#### 5.3.1. app.js - Core App

```javascript
/**
 * Core application initialization
 */
class BudgetApp {
  constructor() {
    this.tg = window.Telegram.WebApp;
    this.api = new APIClient();
    this.auth = new Auth();
  }

  async init() {
    // 1. Initialize Telegram Web App
    this.tg.ready();

    // 2. Setup theme
    this.applyTheme(this.tg.themeParams);
    this.tg.onEvent('themeChanged', () => {
      this.applyTheme(this.tg.themeParams);
    });

    // 3. Validate authentication
    const isValid = await this.auth.validate(this.tg.initData);
    if (!isValid) {
      this.tg.showAlert('❌ Ошибка авторизации');
      this.tg.close();
      return;
    }

    // 4. Setup UI
    this.setupMainButton();
    this.setupBackButton();

    // 5. Load data
    await this.loadInitialData();

    // 6. Enable haptic feedback
    this.tg.HapticFeedback.impactOccurred('light');
  }

  applyTheme(themeParams) {
    document.documentElement.style.setProperty('--tg-theme-bg-color', themeParams.bg_color);
    document.documentElement.style.setProperty('--tg-theme-text-color', themeParams.text_color);
    // ... all 16 color parameters
  }

  setupMainButton() {
    // Will be customized per form
  }

  setupBackButton() {
    this.tg.BackButton.onClick(() => {
      // Navigate back or close
      if (window.history.length > 1) {
        window.history.back();
      } else {
        this.tg.close();
      }
    });
  }
}

// Initialize app
const app = new BudgetApp();
app.init();
```

#### 5.3.2. api.js - API Client

```javascript
/**
 * API client for backend communication
 */
class APIClient {
  constructor() {
    this.baseURL = window.location.origin;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}/api/v1/webapp${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new APIError(response.status, error.detail);
    }

    return response.json();
  }

  // Facts endpoints
  async listFacts(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/facts?${query}`);
  }

  async createFact(data) {
    return this.request('/facts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateFact(id, data) {
    return this.request(`/facts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteFact(id) {
    return this.request(`/facts/${id}`, {
      method: 'DELETE'
    });
  }

  // Articles endpoints
  async listArticles(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/articles?${query}`);
  }

  // Stats endpoints
  async getStatsSummary(period) {
    return this.request(`/stats/summary?period=${period}`);
  }

  async getStatsByCategory(period, type) {
    return this.request(`/stats/by-category?period=${period}&type=${type}`);
  }
}

class APIError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}
```

#### 5.3.3. auth.js - Authentication

```javascript
/**
 * Telegram initData validation and JWT management
 */
class Auth {
  constructor() {
    this.token = null;
  }

  async validate(initData) {
    try {
      const response = await fetch('/api/v1/webapp/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      this.token = data.access_token;

      // Store token in CloudStorage for reuse
      await window.Telegram.WebApp.CloudStorage.setItem('access_token', this.token);

      return true;
    } catch (error) {
      console.error('Auth validation failed:', error);
      return false;
    }
  }

  getToken() {
    return this.token;
  }

  async loadTokenFromCache() {
    return new Promise((resolve) => {
      window.Telegram.WebApp.CloudStorage.getItem('access_token', (error, value) => {
        if (error) {
          resolve(null);
        } else {
          this.token = value;
          resolve(value);
        }
      });
    });
  }
}
```

#### 5.3.4. ui.js - UI Helpers

```javascript
/**
 * UI helper functions
 */
class UI {
  static showLoading(buttonText = 'Загрузка...') {
    const tg = window.Telegram.WebApp;
    tg.MainButton.setText(buttonText);
    tg.MainButton.showProgress();
    tg.MainButton.disable();
  }

  static hideLoading(buttonText = 'Сохранить') {
    const tg = window.Telegram.WebApp;
    tg.MainButton.hideProgress();
    tg.MainButton.setText(buttonText);
    tg.MainButton.enable();
  }

  static showSuccess(message, callback) {
    window.Telegram.WebApp.showAlert(message, callback);
    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
  }

  static showError(message) {
    window.Telegram.WebApp.showAlert(message);
    window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
  }

  static confirmAction(message, onConfirm) {
    window.Telegram.WebApp.showConfirm(message, (confirmed) => {
      if (confirmed) {
        onConfirm();
      }
    });
  }

  static formatAmount(amount) {
    return new Intl.NumberFormat('ru-RU', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));
  }

  static formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }
}
```

#### 5.3.5. validators.js - Form Validation

```javascript
/**
 * Form validation utilities
 */
class Validators {
  static required(value, fieldName) {
    if (!value || value.trim() === '') {
      return `Поле "${fieldName}" обязательно`;
    }
    return null;
  }

  static amount(value) {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      return 'Сумма должна быть больше 0';
    }
    if (num > 9999999.99) {
      return 'Сумма слишком большая';
    }
    return null;
  }

  static date(value) {
    const date = new Date(value);
    const today = new Date();
    if (date > today) {
      return 'Дата не может быть в будущем';
    }
    return null;
  }

  static maxLength(value, max, fieldName) {
    if (value && value.length > max) {
      return `Поле "${fieldName}" не должно превышать ${max} символов`;
    }
    return null;
  }

  static validateForm(formData, rules) {
    const errors = {};

    for (const [field, validators] of Object.entries(rules)) {
      const value = formData[field];

      for (const validator of validators) {
        const error = validator(value);
        if (error) {
          errors[field] = error;
          break; // Stop at first error for field
        }
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }
}
```

---

## 6. Migration Strategy

### 6.1. Phased Rollout

**Phase 0: Preparation (Week 1)** ✅ **ЗАВЕРШЕНО**
- [x] Setup webapp/ directory structure
- [x] Implement initData validation endpoint
- [x] Create base HTML template
- [x] Implement core JS modules (app.js, api.js, auth.js, ui.js)
- [x] Setup static files serving in FastAPI
- [x] Configure CSP headers
- [x] Write unit tests for backend validation

**Phase 1: MVP - Menu + Add (Week 2)** ✅ **ЗАВЕРШЕНО**
- [x] Create index.html (main menu)
- [x] Create add.html (add transaction form)
- [x] Implement hierarchical article selection
- [x] Setup Menu Button in bot
- [ ] Integration testing (pending)
- [ ] Deploy to staging
- [ ] Beta testing with 5-10 users
- [ ] Fix critical bugs
- [ ] Deploy to production (canary release: 10% users)

**Phase 2: Core Forms (Week 3-4)** ✅ **ЗАВЕРШЕНО**
- [x] Implement today.html
- [x] Implement list.html
- [x] Implement edit.html
- [x] ~~Implement delete.html~~ (integrated into edit.html)
- [x] Implement stats.html (basic, without charts)
- [ ] Integration testing (pending)
- [ ] Deploy to staging
- [ ] Beta testing
- [ ] Deploy to production (50% users)

**Phase 3: Advanced Forms (Week 5-6)** ✅ **ЗАВЕРШЕНО**
- [x] Implement addplan.html
- [x] Implement summary.html
- [x] Implement search.html
- [ ] ~~Enhance stats.html (charts)~~ (deferred to Phase 4)
- [ ] Integration testing (pending)
- [ ] Deploy to staging
- [ ] Beta testing
- [ ] Deploy to production (100% users)

**Phase 4: Cleanup (Week 7)**
- [ ] Remove old ConversationHandlers from bot
- [ ] Remove unused bot handlers code
- [ ] Update bot /help command
- [ ] Update documentation
- [ ] Performance optimization
- [ ] Final testing
- [ ] Post-launch monitoring

### 6.2. Rollback Plan

**Критерии для rollback:**
- Error rate > 5%
- Web App crash rate > 10%
- User complaints > 20% of active users
- Critical security vulnerability discovered

**Rollback process:**
1. Disable Menu Button (revert to /start)
2. Re-enable old ConversationHandlers
3. Notify users via broadcast message
4. Investigate and fix issues
5. Re-deploy with fixes
6. Resume gradual rollout

### 6.3. Backward Compatibility

**During migration:**
- Keep old /start command working
- Support both ConversationHandler and Web Apps simultaneously
- Feature flag: `WEB_APPS_ENABLED=true/false` per user
- Gradual rollout: Start with power users, then expand

**User Data:**
- No migration needed (same backend API)
- CloudStorage keys: `webapp.*` prefix for Web App data
- Existing bot session data: Keep for fallback

---

## 7. Testing Strategy

### 7.1. Unit Tests

**Backend:**
```python
# tests/test_webapp_validation.py
def test_validate_init_data_valid():
    init_data = generate_valid_init_data()
    result = validate_init_data(init_data)
    assert result['valid'] == True

def test_validate_init_data_invalid_hash():
    init_data = generate_init_data_with_invalid_hash()
    with pytest.raises(HTTPException) as exc:
        validate_init_data(init_data)
    assert exc.value.status_code == 401

def test_validate_init_data_expired():
    init_data = generate_expired_init_data()
    with pytest.raises(HTTPException) as exc:
        validate_init_data(init_data)
    assert exc.value.detail == "InitData expired"
```

**Frontend:**
```javascript
// tests/validators.test.js
describe('Validators', () => {
  test('required validator', () => {
    expect(Validators.required('', 'Name')).toBe('Поле "Name" обязательно');
    expect(Validators.required('value', 'Name')).toBe(null);
  });

  test('amount validator', () => {
    expect(Validators.amount('0')).toBe('Сумма должна быть больше 0');
    expect(Validators.amount('100.50')).toBe(null);
    expect(Validators.amount('99999999')).toBe('Сумма слишком большая');
  });
});
```

### 7.2. Integration Tests

```python
# tests/test_webapp_flow.py
async def test_add_transaction_flow(client, test_user):
    # 1. Validate initData
    init_data = generate_init_data(test_user)
    response = await client.post('/api/v1/webapp/validate', json={'initData': init_data})
    assert response.status_code == 200
    token = response.json()['access_token']

    # 2. Get articles
    response = await client.get('/api/v1/webapp/articles', headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 200
    articles = response.json()['articles']
    assert len(articles) > 0

    # 3. Create transaction
    fact_data = {
        'article_id': articles[0]['id'],
        'amount': 500.00,
        'date': '2025-10-24',
        'description': 'Test transaction',
        'record_type': 'fact'
    }
    response = await client.post('/api/v1/webapp/facts', json=fact_data, headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 201

    # 4. Verify transaction created
    fact_id = response.json()['id']
    response = await client.get(f'/api/v1/webapp/facts/{fact_id}', headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 200
```

### 7.3. E2E Tests (Playwright)

```javascript
// tests/e2e/add-transaction.spec.js
test('Add transaction flow', async ({ page }) => {
  // 1. Open bot and click Menu Button
  await page.goto('https://t.me/your_bot');
  await page.click('[data-testid="menu-button"]');

  // 2. Wait for Web App to open
  await page.waitForSelector('#webapp-menu');

  // 3. Click "Add" button
  await page.click('#btn-add');

  // 4. Fill form
  await page.fill('#amount', '500.00');
  await page.click('#category-selector');
  await page.click('[data-category-id="3"]'); // Select "Магнит"
  await page.fill('#description', 'Test transaction');

  // 5. Submit
  await page.click('#main-button');

  // 6. Verify success message
  await expect(page.locator('.tg-alert')).toHaveText(/Транзакция добавлена/);
});
```

### 7.4. Manual Testing Checklist

**Pre-launch checklist:**

- [ ] iOS Safari (latest 2 versions)
  - [ ] Light theme
  - [ ] Dark theme
  - [ ] Portrait orientation
  - [ ] Landscape orientation
  - [ ] SafeArea insets correct

- [ ] Android Chrome (latest 2 versions)
  - [ ] Light theme
  - [ ] Dark theme
  - [ ] Portrait orientation
  - [ ] Landscape orientation

- [ ] Desktop Telegram
  - [ ] Windows
  - [ ] macOS
  - [ ] Linux

- [ ] Features
  - [ ] Menu Button opens Web App
  - [ ] All 9 menu buttons work
  - [ ] Add transaction form validation
  - [ ] Hierarchical article selection
  - [ ] Date picker works
  - [ ] MainButton state changes correctly
  - [ ] BackButton navigates back
  - [ ] Theme switches (light/dark)
  - [ ] Haptic feedback works
  - [ ] CloudStorage persists data
  - [ ] Offline mode shows error
  - [ ] Pull-to-refresh works

- [ ] Security
  - [ ] InitData validation works
  - [ ] Invalid initData rejected
  - [ ] Expired initData rejected
  - [ ] JWT token required for API
  - [ ] User can only access own data

- [ ] Performance
  - [ ] Time to Interactive < 1.5s
  - [ ] Smooth scrolling (60 FPS)
  - [ ] No memory leaks
  - [ ] Bundle size < 200 KB

---

## 8. Success Metrics

### 8.1. Launch Criteria

**Must have (Go/No-Go):**
- [ ] All P0 features implemented and tested
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Zero critical bugs
- [ ] Beta testing completed (>90% positive feedback)
- [ ] Rollback plan tested
- [ ] Monitoring dashboards ready

**Nice to have:**
- [ ] All P1 features implemented
- [ ] Accessibility audit passed
- [ ] Documentation complete
- [ ] Video tutorial recorded

### 8.2. Post-Launch KPIs

**Week 1:**
- Web App adoption rate > 50%
- Error rate < 2%
- Average session duration > 2 min
- Form completion rate > 80%

**Month 1:**
- Web App adoption rate > 80%
- DAU/MAU ratio > 30%
- Transaction creation rate +20% vs old bot
- User satisfaction score > 4.5/5

**Quarter 1:**
- Web App adoption rate > 95%
- All users migrated
- Old ConversationHandlers removed
- 5+ new features added (using Web Apps architecture)

---

## 9. Risks & Mitigation

### 9.1. Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Performance issues on low-end devices** | Medium | High | Optimize bundle size, lazy loading, service worker |
| **initData validation fails** | Low | Critical | Extensive testing, fallback to /start command |
| **CloudStorage quota exceeded** | Low | Medium | Implement cache eviction, use DeviceStorage |
| **API rate limiting** | Medium | Medium | Client-side throttling, CloudStorage cache |
| **Browser compatibility issues** | Medium | High | Polyfills, feature detection, graceful degradation |

### 9.2. Business Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **User resistance to new UI** | Medium | High | Gradual rollout, keep old /start as fallback, user education |
| **Increased support load** | High | Medium | Comprehensive /help, video tutorials, FAQ |
| **Development timeline overrun** | Medium | Medium | Phased rollout, MVP first, P1/P2 features later |
| **Security vulnerability** | Low | Critical | Security audit, penetration testing, bug bounty |

### 9.3. Mitigation Actions

1. **Extensive Beta Testing**
   - Recruit 20-30 beta testers
   - Collect feedback via in-app survey
   - Fix critical issues before production

2. **Gradual Rollout**
   - Week 1: 10% users (power users)
   - Week 2: 30% users
   - Week 3: 60% users
   - Week 4: 100% users

3. **Comprehensive Documentation**
   - User guide with screenshots
   - Video tutorial (2-3 min)
   - FAQ section
   - In-app hints (first time use)

4. **24/7 Monitoring**
   - Real-time error tracking (Sentry)
   - Performance monitoring (Grafana)
   - User feedback channel (Telegram group)
   - On-call engineer (first 2 weeks)

---

## 10. Appendix

### 10.1. Glossary

- **Web App / Mini App**: Web-based application running inside Telegram
- **initData**: Initialization data from Telegram containing user info and hash
- **Menu Button**: Customizable button replacing /start command
- **MainButton**: Primary action button at bottom of Web App
- **BackButton**: Navigation button in Web App header
- **CloudStorage**: Telegram's synchronized storage (1024 items per user)
- **DeviceStorage**: Local persistent storage (5 MB per user)
- **ConversationHandler**: Python Telegram Bot pattern for multi-step dialogs

### 10.2. References

- [Telegram Web Apps Documentation](https://core.telegram.org/bots/webapps)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Python Telegram Bot Library](https://python-telegram-bot.org/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### 10.3. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-24 | Claude Code | Initial PRD creation |
| 2.0 | 2025-10-25 | Claude Code | Phase 0-3 implementation complete. 8 Web Apps pages готовы, ready for testing. Delete.html интегрирован в edit.html. Chart.js deferred to Phase 4. |

### 10.4. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | TBD | | |
| Tech Lead | TBD | | |
| Security Lead | TBD | | |
| QA Lead | TBD | | |

---

**Document Status:** ✅ Implementation Complete (Phase 0-3)
**Next Phase:** Phase 4 - Cleanup & Optimization
**Testing Status:** Ready for Manual Testing
**Last Updated:** 2025-10-25
