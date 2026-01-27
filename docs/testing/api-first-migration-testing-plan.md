# API-First Migration Testing Plan

## Цель
Проверить корректность работы API-First архитектуры с Opt-In PGlite после миграции.

## Тестовая среда
- **Браузер:** Chrome/Edge 120+ (для полной функциональности)
- **Режим:** Incognito (для чистого состояния localStorage)
- **DevTools:** Console открыт для логов

## Pre-Test Checklist
- [ ] Код собран: `npm run build:prod`
- [ ] Frontend deployed (если требуется)
- [ ] Backend запущен и доступен
- [ ] DevTools Console открыт

---

## Сценарий 1: Первый запуск (enablePGlite=false)

**Цель:** Проверить что система работает в режиме API-only по умолчанию.

### Шаги:
1. Открыть Incognito окно
2. Открыть приложение (например, `/dashboard`)
3. Открыть DevTools → Application → Local Storage
4. Проверить: `enablePGlite` отсутствует или `false`
5. Открыть modal_fact (добавление транзакции)
6. Проверить селекты (Счета, Статьи, Места затрат)

### Ожидаемый результат:
- ✅ `enablePGlite` = `false` или отсутствует
- ✅ `pgliteActive` = `false` или отсутствует
- ✅ PGlite индикатор **скрыт** (не видим в navbar)
- ✅ modal_fact открывается и селекты **заполнены данными из API**
- ✅ Console логи: `[DATA_LAYER] API returned { count: X, source: 'API' }`
- ✅ Нет ошибок в Console

### Проверка DataLayer:
```javascript
// В Console:
localStorage.getItem('enablePGlite') // null или "false"
localStorage.getItem('pgliteActive')  // null или "false"
```

---

## Сценарий 2: Background init (enablePGlite=true, pgliteActive=false)

**Цель:** Проверить что PGlite инициализируется в фоне, но API используется для запросов.

### Шаги:
1. Продолжить с Сценария 1 (или перезагрузить)
2. Перейти в Settings
3. Включить "Включить PGlite" (toggle)
4. Обновить страницу (Ctrl+R)
5. **Сразу после загрузки** открыть modal_fact
6. Наблюдать за PGlite индикатором (navbar, правый верхний угол)
7. Ждать 10-20 секунд

### Ожидаемый результат:

**Фаза 1: Сразу после перезагрузки (0-5 секунд)**
- ✅ `enablePGlite` = `true`
- ✅ `pgliteActive` = `false`
- ✅ PGlite индикатор **видим**, **желтый с пульсацией** (initializing)
- ✅ modal_fact открывается и селекты **заполнены из API** (не блокируется)
- ✅ Console логи:
  ```
  [APP] Starting PGlite background initialization...
  [DB_INIT] Starting background initialization...
  [DB_INIT] Step 1/5: Initialize database
  [DATA_LAYER] API returned { count: X, source: 'API' }
  ```

**Фаза 2: После инициализации (5-15 секунд)**
- ✅ Console логи:
  ```
  [DB_INIT] Step 2/5: Run migrations
  [DB_INIT] Step 3/5: Initialize ConflictManager
  [DB_INIT] Step 4/5: Sync reference data
  [DB_INIT] Step 5/5: Validate readiness
  [VALIDATION] Starting validation suite...
  [VALIDATION] ✅ Schema version correct
  [VALIDATION] ✅ Reference data loaded
  [VALIDATION] ✅ Query tests passed
  [VALIDATION] ✅ Performance acceptable
  [DB_INIT] Background initialization complete
  ```
- ✅ PGlite индикатор становится **зеленым кликабельным** (ready)
- ✅ Toast появляется: "🚀 Локальная база данных готова!"
- ✅ Toast показывает статистику (статей, счетов, производительность)
- ✅ Toast имеет кнопки: [Переключиться] [Позже] [Подробнее]

**Фаза 3: Проверка Settings**
- Перейти в Settings
- ✅ Секция PGlite показывает alert "Локальная БД готова к использованию!"
- ✅ Кнопка "Активировать локальную БД" видима
- ✅ Показана диагностика (количество данных, производительность)

### Проверка state:
```javascript
// В Console:
window.PGlite.getState().then(state => console.log(state))
// Ожидаем:
// {
//   initializationStatus: "ready",
//   isInitialized: true,
//   validationResults: { allPassed: true, ... },
//   ...
// }
```

---

## Сценарий 3: Opt-in активация

**Цель:** Проверить что переключение на PGlite работает корректно.

### Шаги:
1. Продолжить с Сценария 2 (ready state)
2. **Вариант A:** Кликнуть на зеленый индикатор в navbar
3. **Вариант B:** Кликнуть "Переключиться" в Toast
4. **Вариант C:** Кликнуть "Активировать локальную БД" в Settings
5. Подтвердить в диалоге
6. Дождаться перезагрузки страницы
7. После перезагрузки открыть modal_fact

### Ожидаемый результат:

**Перед перезагрузкой:**
- ✅ Toast: "Переключение на локальную БД выполнено. Страница будет перезагружена."
- ✅ Страница перезагружается через 1.5 секунды

**После перезагрузки:**
- ✅ `enablePGlite` = `true`
- ✅ `pgliteActive` = `true`
- ✅ PGlite индикатор **зеленый (active idle)** (не пульсирует)
- ✅ modal_fact селекты **заполнены из PGlite** (< 10ms)
- ✅ Console логи:
  ```
  [DATA_LAYER] getFinancialCenters { usePGlite: true }
  [DATA_LAYER] Using PGlite
  [DATA_LAYER] PGlite returned { count: X, source: 'PGlite', durationMs: 5.2 }
  ```

### Performance проверка:
```javascript
// В Console - замерить время загрузки
const start = performance.now();
// Открыть modal_fact
// После загрузки:
console.log('Load time:', performance.now() - start, 'ms');
// Ожидаем: < 50ms (PGlite значительно быстрее API)
```

### Проверка что синхронизация работает:
- Индикатор периодически становится **синим с пульсацией** (syncing)
- После синхронизации возвращается к **зеленому (active idle)**

---

## Сценарий 4: PGlite пустая, но активна

**Цель:** Проверить graceful degradation когда PGlite активна, но данных нет.

### Подготовка:
1. Продолжить с Сценария 3 (pgliteActive=true)
2. Открыть DevTools → Application → IndexedDB
3. Удалить базу `idb://pglite` (Delete database)
4. Обновить страницу

### Шаги:
1. После перезагрузки открыть modal_fact
2. Проверить селекты

### Ожидаемый результат:
- ✅ `enablePGlite` = `true`
- ✅ `pgliteActive` = `true`
- ✅ PGlite индикатор может показать **красный (error)** или **синий (syncing)**
- ✅ modal_fact селекты **заполнены из API** (fallback)
- ✅ Console логи:
  ```
  [DATA_LAYER] getFinancialCenters { usePGlite: true }
  [DATA_LAYER] Using PGlite
  [DATA_LAYER] PGlite returned empty, using API fallback
  [DATA_LAYER] API fallback returned { count: X }
  ```
- ✅ Нет критических ошибок (graceful degradation)
- ✅ Пользователь **может работать** через API

---

## Сценарий 5: Validation failed

**Цель:** Проверить поведение когда validation suite не проходит.

### Подготовка (требует модификации кода):
1. Временно изменить `EXPECTED_SCHEMA_VERSION` в `validationSuite.ts` на неверное значение (например, 999)
2. Пересобрать: `npm run build:prod`
3. Очистить localStorage и IndexedDB

### Шаги:
1. Установить `enablePGlite=true`
2. Обновить страницу
3. Наблюдать за индикатором и Console

### Ожидаемый результат:
- ✅ Console логи:
  ```
  [DB_INIT] Starting background initialization...
  [DB_INIT] Step 5/5: Validate readiness
  [VALIDATION] Starting validation suite...
  [VALIDATION] Schema version mismatch: 3 !== 999
  [DB_INIT] Background initialization failed
  ```
- ✅ PGlite индикатор **красный (error)**
- ✅ Toast: "Не удалось инициализировать локальную БД. Работа продолжается через сервер."
- ✅ `initializationStatus` = `error`
- ✅ modal_fact работает через API (не блокируется)
- ✅ Пользователь **может продолжить работу**

### Cleanup:
1. Откатить изменение `EXPECTED_SCHEMA_VERSION`
2. Пересобрать: `npm run build:prod`

---

## Performance Metrics

### Цели производительности:

| Метрика | Target | Как измерить |
|---------|--------|--------------|
| Background init time | < 15s | `[DB_INIT] Background initialization complete` timestamp |
| Validation suite time | < 3s | `[VALIDATION] Suite completed` duration |
| API request time (baseline) | < 300ms | `[DATA_LAYER] API returned` durationMs |
| PGlite query time | < 10ms | `[DATA_LAYER] PGlite returned` durationMs |
| UI blocking time | 0ms | Пользователь может работать сразу после login |

### Измерение:
```javascript
// В Console после каждого сценария:
performance.getEntriesByType('measure').forEach(m => {
  console.log(m.name, m.duration);
});
```

---

## Regression Checklist

### DataLayer методы (все должны работать через API):
- [ ] `getArticles()` - API fallback работает
- [ ] `getFinancialCenters()` - API fallback работает
- [ ] `getCostCenters()` - API fallback работает
- [ ] `getFacts()` - API fallback работает
- [ ] `getShoppingLists()` - API fallback работает
- [ ] `getRecurringPlans()` - API fallback работает

### UI компоненты:
- [ ] modal_fact открывается и работает
- [ ] modal_plan открывается и работает
- [ ] Settings PGlite секция работает
- [ ] PGlite индикатор корректно обновляется
- [ ] Toast notifications показываются

### State transitions:
- [ ] not_started → initializing → validating → ready
- [ ] ready → active (после opt-in)
- [ ] active → syncing → active (синхронизация)
- [ ] active → error → active (временная ошибка)

---

## Critical Issues Checklist

### Блокеры (должны быть исправлены):
- [ ] Пользователь НЕ МОЖЕТ открыть modal_fact при enablePGlite=true
- [ ] Селекты пустые при pgliteActive=false
- [ ] Бесконечная пульсация индикатора (initializing зависает)
- [ ] Validation suite никогда не завершается
- [ ] Ошибка в Console блокирует UI

### Предупреждения (можно исправить позже):
- [ ] Background init медленнее 20 секунд
- [ ] PGlite запросы медленнее 50ms
- [ ] Индикатор не обновляется (нужно обновить страницу)
- [ ] Toast не закрывается кнопкой

---

## Sign-off

После прохождения всех 5 сценариев:

**Тестировщик:** _________________
**Дата:** _________________
**Результат:** ☐ PASS  ☐ FAIL

**Комментарии:**
```
[Заполнить после тестирования]
```

**Найденные баги:**
```
1. [Номер бага] [Описание] [Критичность]
2. ...
```
