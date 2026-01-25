# Legacy Cleanup Checklist

Дата: 2026-01-25
Ветка: `dev/tabbed_modals_20260125121809`

**ВАЖНО:** Удалять только после успешного тестирования новых модалов (PHASE 6)

---

## ⚠️ Файлы для удаления (PHASE 7)

### HTML Templates (3 файла)

- [ ] `frontend/web/templates/components/modal_transaction.html`
  - **Замена:** modal_fact.html (вкладка "Расход/Доход")
  - **Размер:** ~200 строк
  - **Зависимости:** Проверить использование в старых страницах

- [ ] `frontend/web/templates/components/modal_plan.html` (старый)
  - **Замена:** modal_plan_new.html → modal_plan.html
  - **Размер:** ~180 строк
  - **Действие:** Переименовать modal_plan → modal_plan_old, modal_plan_new → modal_plan

- [ ] `frontend/web/templates/components/modal_transfer.html`
  - **Замена:** modal_fact.html (вкладка "Перевод") + modal_plan_new.html (вкладка "Перевод")
  - **Размер:** ~250 строк
  - **Зависимости:** Проверить использование transfers модуля

---

## 🔍 TypeScript Modules для проверки

### ⚠️ Частичное переиспользование (НЕ удалять)

Следующие модули переиспользуются новыми модалами, НЕ удалять:

- ✅ `frontend/web/static/js/dashboard/features/addTransaction/categoryLoader.ts`
  - **Использование:** loadTransactionCategories(), loadFinancialCenters(), loadCostCenters()
  - **Статус:** Активно используется modalFact и modalPlan
  - **Действие:** ОСТАВИТЬ

- ✅ `frontend/web/static/js/dashboard/features/addTransaction/factHints.ts`
  - **Использование:** loadFactHints() для transaction tab hints
  - **Статус:** Активно используется modalFact
  - **Действие:** ОСТАВИТЬ

- ✅ `frontend/web/static/js/dashboard/features/addPlan/planHints.ts`
  - **Использование:** loadPlanHints() для transaction tab hints
  - **Статус:** Активно используется modalPlan
  - **Действие:** ОСТАВИТЬ

### ❌ Потенциально избыточные модули

**Проверить необходимость после тестирования:**

- [ ] `frontend/web/static/js/dashboard/features/addTransaction/index.ts`
  - **Функции:** openAddTransactionModal(), closeAddTransactionModal()
  - **Замена:** openModalFact(), closeModalFact()
  - **Проверка:** Используется ли на других страницах (не index.html, facts.html)?
  - **Если НЕТ:** Удалить

- [ ] `frontend/web/static/js/dashboard/features/addPlan/index.ts`
  - **Функции:** openAddPlanModal(), closeAddPlanModal()
  - **Замена:** openModalPlan(), closeModalPlan()
  - **Проверка:** Используется ли на других страницах (не plan.html)?
  - **Если НЕТ:** Удалить

- [ ] `frontend/web/static/js/transfers/` (весь модуль)
  - **Функции:** openFactTransferModal(), openPlanTransferModal()
  - **Замена:** modal_fact (вкладка "Перевод"), modal_plan (вкладка "Перевод")
  - **Проверка:** Используется ли на странице transfers (если такая есть)?
  - **Если НЕТ:** Удалить или оставить для совместимости

---

## 🗑️ Window Exports для удаления

После успешного тестирования проверить и удалить из `windowExports.ts`:

- [ ] `window.openAddTransactionModal` → заменён на `window.openModalFact`
- [ ] `window.closeAddTransactionModal` → заменён на `window.closeModalFact`
- [ ] `window.openAddPlanModal` → заменён на `window.openModalPlan`
- [ ] `window.closeAddPlanModal` → заменён на `window.closeModalPlan`
- [ ] `window.openFactTransferModal` → заменён на `window.openModalFact`
- [ ] `window.openPlanTransferModal` → заменён на `window.openModalPlan`
- [ ] `window.toggleDesktopFAB` → удалён (FAB упрощён)
- [ ] `window.toggleMobileFAB` → удалён (FAB упрощён)

---

## 📋 Проверка зависимостей перед удалением

### Команды для проверки использования

```bash
# Проверить использование modal_transaction.html
grep -r "modal_transaction" frontend/web/templates/ --include="*.html"

# Проверить использование modal_transfer.html
grep -r "modal_transfer" frontend/web/templates/ --include="*.html"

# Проверить использование openAddTransactionModal
grep -r "openAddTransactionModal" frontend/web/ --include="*.html" --include="*.ts" --include="*.js"

# Проверить использование openFactTransferModal
grep -r "openFactTransferModal" frontend/web/ --include="*.html" --include="*.ts"

# Проверить использование toggleDesktopFAB
grep -r "toggleDesktopFAB\|toggleMobileFAB" frontend/web/ --include="*.html"
```

---

## 🎯 Стратегия удаления (PHASE 7)

### Шаг 1: Переименование (после тестирования)

```bash
# Переименовать modal_plan
mv frontend/web/templates/components/modal_plan.html \
   frontend/web/templates/components/modal_plan_old.html

mv frontend/web/templates/components/modal_plan_new.html \
   frontend/web/templates/components/modal_plan.html
```

### Шаг 2: Проверка зависимостей

Выполнить все команды из секции "Проверка зависимостей".

**Если результаты пустые** → можно удалять
**Если найдены упоминания** → проверить контекст использования

### Шаг 3: Удаление файлов (только если нет зависимостей)

```bash
# Удалить старые модалы
rm frontend/web/templates/components/modal_transaction.html
rm frontend/web/templates/components/modal_plan_old.html
rm frontend/web/templates/components/modal_transfer.html
```

### Шаг 4: Удаление TypeScript модулей (опционально)

```bash
# Если addTransaction/index.ts не используется
rm frontend/web/static/js/dashboard/features/addTransaction/index.ts

# Если addPlan/index.ts не используется
rm frontend/web/static/js/dashboard/features/addPlan/index.ts

# Если transfers/ не используется
rm -rf frontend/web/static/js/transfers/
```

**ВАЖНО:** НЕ удалять categoryLoader.ts, factHints.ts, planHints.ts - они активно используются!

### Шаг 5: Очистка windowExports.ts

Удалить старые экспорты из `frontend/web/static/js/dashboard/adapters/windowExports.ts`:

```typescript
// УДАЛИТЬ (если не используются):
// window.openAddTransactionModal = ...;
// window.closeAddTransactionModal = ...;
// window.openAddPlanModal = ...;
// window.closeAddPlanModal = ...;
// window.openFactTransferModal = ...;
// window.openPlanTransferModal = ...;
// window.toggleDesktopFAB = ...;
// window.toggleMobileFAB = ...;
```

### Шаг 6: Пересборка

```bash
cd frontend/web/static/js
npm run build
```

### Шаг 7: Тестирование регрессии

- [ ] Открытие modal_fact на /, /facts
- [ ] Открытие modal_plan на /plan
- [ ] FAB кнопка работает
- [ ] Переключение вкладок
- [ ] Сохранение транзакций/переводов/планов
- [ ] Hints работают
- [ ] Нет JavaScript ошибок в console

---

## ⚡ Быстрая проверка (для начала)

Перед полным удалением, выполнить экспресс-проверку:

```bash
# 1. Проверить импорты в templates
grep -r "from.*modal_transaction\|from.*modal_transfer\|from.*modal_plan" \
  frontend/web/templates/ --include="*.html" | grep -v modal_plan_new | grep -v modal_fact

# 2. Проверить window функции в HTML
grep -r "openAddTransactionModal\|openFactTransferModal\|toggleDesktopFAB" \
  frontend/web/templates/ --include="*.html"

# 3. Проверить TypeScript imports
grep -r "from.*addTransaction.*index\|from.*addPlan.*index\|from.*transfers" \
  frontend/web/static/js/ --include="*.ts" | grep -v node_modules
```

**Если все 3 команды вернули пустой результат** → можно безопасно удалять

---

## 📊 Потенциальная экономия

После удаления legacy файлов:

- **HTML templates:** ~630 строк кода
- **TypeScript (если безопасно):** ~800-1500 строк кода
- **window exports:** 8 функций
- **Упрощение архитектуры:** Меньше дублирования логики

**Итого:** ~1430-2130 строк legacy кода можно удалить

---

## ✅ Чеклист выполнения PHASE 7

- [ ] PHASE 6 завершена (тестирование успешно)
- [ ] Переименовать modal_plan_new → modal_plan
- [ ] Проверить зависимости (grep команды)
- [ ] Удалить HTML templates (если безопасно)
- [ ] Удалить TypeScript modules (если безопасно)
- [ ] Очистить windowExports.ts
- [ ] Пересобрать TypeScript
- [ ] Тестирование регрессии
- [ ] Обновить документацию
- [ ] Закоммитить изменения

**Статус:** ⏳ Ожидает завершения PHASE 6 (тестирование)
