# Исследование: Dexie Diagnostics

**Дата:** 2026-02-17
**Ветка:** explore
**Статус:** Исследование завершено (v2 — перепроверено)

---

## 1. Обзор текущей реализации

Dexie Diagnostics — диагностическая панель для мониторинга состояния офлайн-БД (IndexedDB через Dexie.js). Представлена как модальное окно, открываемое тройным кликом по иконке базы данных в навбаре.

### Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `frontend/web/static/js/modules/uiComponents/modals/DexieDiagnosticModal.ts` (736 строк) | Основной компонент модального окна диагностики |
| `frontend/web/templates/scripts/dexie-indicator-manager.html` (257 строк) | Визуальный индикатор состояния в навбаре + тройной клик |
| `frontend/shared/db/dexie/DexieManager.ts` (1180 строк) | Основной менеджер БД, getters/setters для периодов |
| `frontend/shared/db/dexie/operations/referenceSync.ts` | Функции синхронизации справочников и планов |
| `build-all.js` | 41 бандл, содержит полный список entry points |

---

## 2. Система бандлов (реальная картина)

`build-all.js` строит 41 бандл через Vite поочерёдно. Ключевые для диагностики:

| Бандл | Entry point | Output файл |
|-------|------------|-------------|
| `dashboard` | `frontend/web/static/js/dashboard/index.ts` | `frontend/web/static/js/dashboard.min.js` |
| `lists` | `frontend/web/static/js/lists-bundle.ts` | `frontend/web/static/js/lists.min.js` |
| `facts` | `frontend/web/static/js/facts/index.ts` | `frontend/web/static/js/facts.min.js` |
| `plan` | `frontend/web/static/js/plan/index.ts` | `frontend/web/static/js/dist/plan.bundle.js` |
| `components` | `frontend/web/static/js/modules/uiComponents/index.iife.ts` | `frontend/web/static/js/dist/components.bundle.js` |
| `dexie` | `frontend/shared/db/dexie/index.ts` | `frontend/shared/db/dexie.min.js` |

> **Важно:** `components.bundle.js` собирается, но **не подключён ни в одном шаблоне**.

---

## 3. Текущие ползунки: факт и план

### Ползунок 1: Facts (Факты — в днях)

```typescript
// DexieDiagnosticModal.ts:460-472
<input type="range" min="30" max="180" step="30"
       value="${data.syncPeriod.facts}"
       id="sync-period-facts-slider"
       onchange="window.updateSyncPeriodFacts?.(this.value)">
// Метки: 30, 60, 90, 120, 150, 180 дней
```

**Хранение:** `localStorage['budget_dexie_sync_period_facts']`
**По умолчанию:** 90 дней
**Диапазон:** 30–180 дней, шаг 30
**Методы DexieManager:** `getSyncPeriodDays()` / `setSyncPeriodDays()`
**При изменении:** вызывается `pruneFacts(days)` — немедленная очистка старых записей.

---

### Ползунок 2: Plans (Планы — в месяцах)

```typescript
// DexieDiagnosticModal.ts:479-491
<input type="range" min="1" max="6" step="1"
       value="${data.syncPeriod.plans}"
       id="sync-period-plans-slider"
       onchange="window.updateSyncPeriodPlans?.(this.value)">
// Метки: 1, 2, 3, 4, 5, 6 месяцев
```

**Хранение:** `localStorage['budget_dexie_sync_period_plans']`
**По умолчанию:** 3 месяца
**Диапазон:** 1–6 месяцев, шаг 1
**Методы DexieManager:** `getSyncPeriodMonths()` / `setSyncPeriodMonths()`
**При изменении:** только сохраняет настройку, применяется при следующей синхронизации (не прунит немедленно).

---

## 4. Найденные баги

### Баг 1: syncPeriod.plans получает значение в днях вместо месяцев

В `DexieDiagnosticModal.ts:186-215`:

```typescript
// Строка 187 — читает ДНИ
const syncPeriodDays = pglite.getSyncPeriodDays?.() ?? 90;

// Строки 211-215 — НЕПРАВИЛЬНО присваивает оба поля из syncPeriodDays
const data: DiagnosticData = {
  ...baseData,
  syncPeriod: {
    facts: syncPeriodDays,    // ✅ Правильно: дни для факта
    plans: syncPeriodDays     // ❌ ОШИБКА: должно быть pglite.getSyncPeriodMonths?.() ?? 3
  },
```

**Эффект:** Слайдер Plans (диапазон 1–6) получает значение 90 (дни). HTML `<input type="range">` зажимает value к max=6, поэтому слайдер визуально всегда в крайнем правом положении вместо реального значения (обычно 3).

### Баг 2: Единица измерения в таблице статистики для Plans

В `DexieDiagnosticModal.ts:403-405`:

```typescript
<tr>
  <td>Plans</td>
  <td>${data.tableStats.plans}
      <span class="text-xs opacity-60">(${data.syncPeriod.plans} days)</span>  // ← "days" неверно
  </td>
</tr>
```

Plans хранится в месяцах, а подпись говорит `days`. Нужно `months`.

---

## 5. Текущая логика загрузки планов: симметричный диапазон

Функция `calculateFullMonthsRange(months)` в `referenceSync.ts:310–336` создаёт **симметричный** диапазон — N месяцев в прошлое И N месяцев в будущее от текущей даты:

```typescript
function calculateFullMonthsRange(months: number): { fromDate: string; toDate: string } {
  const today = new Date();

  // N месяцев НАЗАД (начало месяца)
  const fromDate = new Date(today.getFullYear(), today.getMonth() - months, 1);

  // N месяцев ВПЕРЁД (конец месяца)
  const toDate = new Date(today.getFullYear(), today.getMonth() + months + 1, 0);

  return { fromDate: formatDate(fromDate), toDate: formatDate(toDate) };
}
```

**Пример при months=3 (сегодня: 2026-02-17):**
- `from_date`: 2025-11-01 (3 месяца назад)
- `to_date`: 2026-05-31 (3 месяца вперёд)

API запрос: `GET /api/v1/recurring-plans?from_date=2025-11-01&to_date=2026-05-31&limit=100`

Один ползунок управляет **одновременно** глубиной истории и горизонтом будущего. Пользователь не может настроить их независимо.

---

## 6. Требуемые изменения: три ползунка

Нужно разделить единственный ползунок "Plans" на два:

### Предлагаемые три ползунка

| # | Ползунок | Назначение | Диапазон | Шаг | Ключ localStorage |
|---|----------|-----------|---------|-----|---------------------|
| 1 | **Facts** | Хранение фактических транзакций | 30–180 дней | 30 | `budget_dexie_sync_period_facts` _(существует)_ |
| 2 | **Plans History** | История прошлых планов (месяцев до сегодня) | 1–6 месяцев | 1 | `budget_dexie_sync_period_plans_history` _(новый)_ |
| 3 | **Plans Future** | Загрузка будущих планов (месяцев вперёд) | 1–6 месяцев | 1 | `budget_dexie_sync_period_plans_future` _(новый)_ |

### Как должна измениться `calculateFullMonthsRange`

```typescript
// ТЕКУЩАЯ (симметричная):
calculateFullMonthsRange(months: number)
// → from: today - N months, to: today + N months

// НОВАЯ (асимметричная):
calculatePlansRange(historyMonths: number, futureMonths: number)
// → from: начало месяца historyMonths назад
// → to: конец месяца futureMonths вперёд
```

**Пример с history=2, future=4 (сегодня: 2026-02-17):**
- `from_date`: 2025-12-01 (2 месяца назад)
- `to_date`: 2026-06-30 (4 месяца вперёд)

### Миграция legacy-ключа при разделении

Текущий ключ `budget_dexie_sync_period_plans` нужно мигрировать в два новых. Функция `migrateSyncPeriodSettings()` (`DexieManager.ts:147–177`) уже обрабатывает миграцию старого legacy-ключа `budget_dexie_sync_period` — нужно добавить второй шаг миграции для нового разделения.

---

## 7. Доступность диагностики на страницах (проверено по шаблонам)

### Индикатор в навбаре

В `base.html:1095-1100`:

```jinja
{% if user %}
{% include 'scripts/dexie-indicator-manager.html' %}
{% endif %}
```

Индикатор **доступен на всех страницах** для авторизованных пользователей.

---

### Открытие диагностики по тройному клику

`dexie-indicator-manager.html:244-247` вызывает `window.openDexieDiagnostic()`:

```javascript
if (typeof window.openDexieDiagnostic === 'function') {
    window.openDexieDiagnostic();
} else {
    console.error('[DEXIE_INDICATOR] openDexieDiagnostic not available on window');
}
```

`window.openDexieDiagnostic` регистрируется в двух бандлах:
- **`dashboard.min.js`** — через `initWindowExports()` в `dashboard/index.ts:249`
- **`lists.min.js`** — через `Object.assign(window, windowExports)` в `lists-bundle.ts:250`

---

### Какие страницы загружают эти бандлы

Проверено по всем шаблонам в `frontend/web/templates/`:

| Страница | Загружаемые бандлы | `openDexieDiagnostic` |
|---------|-------------------|----------------------|
| `/` (index.html) | `facts.min.js` + **`dashboard.min.js`** | ✅ Да |
| `/plan` (plan.html) | `admin-facts-common.min.js` + **`dashboard.min.js`** + `plan.bundle.js` | ✅ Да |
| `/lists` (lists.html) | **`lists.min.js`** | ✅ Да |
| `/facts` (facts.html) | `admin-facts-common.min.js` + `facts.min.js` | ❌ Нет |
| `/analytics` | только `echarts.min.js` | ❌ Нет |
| `/notifications` | нет бандлов | ❌ Нет |
| `/security_settings` | нет бандлов | ❌ Нет |
| admin_dashboard | только `echarts.min.js` | ❌ Нет |
| остальные admin | только confirm-dialog / утилиты | ❌ Нет |

> **Важно:** `components.bundle.js` (`window.UIComponents`) **не загружается ни в одном шаблоне**, несмотря на то что собирается. Использовать этот бандл для решения проблемы не получится без добавления его в `base.html`.

**Итог:** Тройной клик работает на `/`, `/plan`, `/lists`. На **`/facts` и всех остальных страницах** — ошибка в консоли.

---

## 8. Загрузка в localStorage — механизм

Настройки хранятся в `localStorage` (браузер пользователя), **не** в IndexedDB:

```
localStorage keys:
  budget_dexie_sync_period_facts     → number (дни: 30–180)
  budget_dexie_sync_period_plans     → number (месяцы: 1–6)
  budget_dexie_sync_period           → legacy key (до v11.5.0)
```

**Миграция legacy** при `DexieManager.init()`:

```typescript
// DexieManager.ts:147–177
private migrateSyncPeriodSettings(): void {
  // Если budget_dexie_sync_period_facts или _plans уже есть → пропустить
  // Если есть legacy budget_dexie_sync_period → конвертировать
  // Если нет ничего → установить defaults (facts=90, plans=3)
}
```

Настройки **глобальны для браузера** — изменение на любой странице применяется к синхронизации везде. Это корректное поведение.

---

## 9. Схема IndexedDB

### Таблица `recurringPlans`

```typescript
// Индексы: id, user_id, article_id, financial_center_id, is_active
interface LocalRecurringPlan {
  id?: number;
  user_id: number;
  article_id: number;
  financial_center_id: number;
  cost_center_id?: number | null;
  amount: number;       // В центах (cents)
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: Date;
  end_date?: Date | null;
  is_active: boolean;
  created_at: Date;
}
```

В таблице **нет поля `date`** — фильтрация по датам происходит на уровне API через `from_date`/`to_date`. Локально все загруженные планы хранятся без разделения на "исторические" и "будущие".

### Таблица `syncMetadata`

```typescript
interface LocalSyncMetadata {
  entity_type: string;              // 'recurring_plans', 'articles', etc.
  last_sync_timestamp: Date | null;
  sync_version: number;
  total_records: number;
}
```

После разделения ползунков потребуется добавить два entity_type:
- `recurring_plans_history`
- `recurring_plans_future`

---

## 10. Состояния индикатора

| Состояние | Цвет | Анимация | Триггер |
|-----------|------|----------|---------|
| `not_started` | — | — | Dexie не используется |
| `initializing` | Жёлтый | Пульс | Инициализация БД |
| `validating` | Жёлтый | Пульс | Проверка структуры |
| `ready` | Зелёный | Нет | БД готова, не активна |
| `active` | Зелёный | Пульс | БД активна, idle |
| `syncing` | Синий | Вращение | Синхронизация |
| `error` | Красный | Нет | Ошибка (авто-восстановление через 5с) |

---

## 11. Структура DiagnosticData — текущая и целевая

**Текущая:**
```typescript
syncPeriod: {
  facts: number;   // дни (из getSyncPeriodDays)
  plans: number;   // БАГ: получает значение в днях вместо месяцев
};
```

**Целевая (после разделения):**
```typescript
syncPeriod: {
  facts: number;         // дни (getSyncPeriodDays)
  plansHistory: number;  // месяцы (getSyncPeriodPlansHistory — новый)
  plansFuture: number;   // месяцы (getSyncPeriodPlansFuture — новый)
};
```

---

## 12. Полная таблица необходимых изменений

### Для разделения ползунка Plans (2 → 3 ползунка)

| Файл | Изменение |
|------|-----------|
| `DexieManager.ts` | Добавить `getSyncPeriodPlansHistory()`, `getSyncPeriodPlansFuture()`, их setters |
| `DexieManager.ts` | Обновить `migrateSyncPeriodSettings()` для нового разделения |
| `referenceSync.ts` | Переименовать/изменить `calculateFullMonthsRange()` → `calculatePlansRange(historyMonths, futureMonths)` |
| `referenceSync.ts` | Обновить `syncRecurringPlans()` и `initialReferenceSync()` |
| `DexieDiagnosticModal.ts:187-215` | Исправить баг: `plans: syncPeriodDays` → `plansHistory: pglite.getSyncPeriodPlansHistory?.() ?? 2` |
| `DexieDiagnosticModal.ts` | Заменить один ползунок Plans на два (History + Future) |
| `DexieDiagnosticModal.ts:403-405` | Исправить подпись `days` → `months` в строке таблицы Plans |
| `DexieDiagnosticModal.ts` | Добавить методы для двух новых ползунков (display + update) |
| `DexieDiagnosticModal.ts:711-734` | Экспортировать 4 новых window-функции вместо 2 |

### Для доступности диагностики на `/facts` и остальных страницах

| Вариант | Файл | Изменение | Плюс | Минус |
|---------|------|-----------|------|-------|
| **A (рекомендуется)** | `build-all.js` + `base.html` | Добавить micro-bundle `dexie-diagnostic` (~50 KB), подключить в `base.html` | Минимальный размер | Нужен новый бандл |
| **B** | `base.html` | Подключить `components.bundle.js` (уже собирается), вызывать `window.UIComponents.openDexieDiagnostic()` | Ничего не нужно собирать | Тяжёлый бандл на всех страницах |
| **C** | `base.html` | Inline lazy-import через `import()` | Нет нового бандла | Требует ES modules поддержки |

---

## 13. Выводы

1. **Два ползунка реализованы** (`Facts` + `Plans`), но с двумя багами:
   - `syncPeriod.plans` получает значение в днях вместо месяцев (строка 214)
   - Подпись в таблице показывает `days` вместо `months` для Plans (строка 405)

2. **Симметричный диапазон планов** — один ползунок задаёт одновременно глубину истории и горизонт будущего. Разделение на два ползунка требует изменений в `DexieManager`, `referenceSync.ts` и `DexieDiagnosticModal.ts`.

3. **Диагностика доступна только на трёх страницах** из ~17:
   - ✅ `/` — через `dashboard.min.js`
   - ✅ `/plan` — через `dashboard.min.js`
   - ✅ `/lists` — через `lists.min.js`
   - ❌ `/facts`, `/analytics`, `/notifications`, `/security_settings`, все admin-страницы

4. **`components.bundle.js` не используется** ни в одном шаблоне, хотя собирается системой сборки.

5. **localStorage настройки глобальны** — корректное поведение. Изменение с любой страницы применяется везде.
