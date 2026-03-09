# Plan: Исправление модальной формы добавления факта на /facts

## Context

На странице `/facts` загружается только `facts.min.js`, без `dashboard.min.js`. Модал `modal_fact` рендерится в HTML через `{{ modal_fact('modal_fact') }}`, но при его открытии через fallback-функцию `openAddTransactionModal()` в `facts/adapters/windowExports.ts` не выполняется нужная инициализация:

1. **Tab navigation не работает** — radio button change listeners не установлены (`setupTabListeners()` не вызывается)
2. **Дата не заполняется** — fallback вызывает `setTransactionDate(0)` с неправильным селектором (`#modal_add_transaction`), а не `setFactDate(0)` для `modal_fact`
3. **Нет иконки календаря** — `CalendarWidget` не инициализируется при открытии

Дополнительно: `window.saveFactModal` не экспортируется из `facts.min.js`, хотя кнопка "Сохранить" в `modal_fact.html` использует `onclick="saveFactModal(this)"`.

**Решение**: Добавить инициализацию в `setupModalFactListeners()` через уже существующий `MutationObserver` — при открытии модала (`open` атрибут появился) выполнять:
- автозаполнение дат (`setFactDate(0)`, `setFactTransferDate(0)`)
- инициализацию `CalendarWidget` для полей даты
- установку radio button change listeners для tab switching

Также добавить `window.saveFactModal` в экспорты.

---

## Критические файлы

| Файл | Изменение |
|------|-----------|
| `frontend/web/static/js/facts/index.ts` | Обновить `setupModalFactListeners()`, добавить `initModalFactCalendars()`, `setupModalFactTabSwitching()` |
| `frontend/web/static/js/facts/adapters/windowExports.ts` | Добавить `window.saveFactModal` в `setupWindowExports()` |

---

## Детальный план изменений

### 1. `frontend/web/static/js/facts/index.ts`

#### 1.1 Добавить переменные для CalendarWidget instances (после импортов, вверху файла)
```typescript
/** CalendarWidget instances for modal_fact date inputs */
let modalFactDateCalendar: any = null;
let modalTransferDateCalendar: any = null;
```

#### 1.2 Добавить функцию `initModalFactCalendars()`
```typescript
function initModalFactCalendars(): void {
    const CalendarWidget = (window as any).BudgetShared?.CalendarWidget;
    if (!CalendarWidget) return;

    if (modalFactDateCalendar) {
        try { modalFactDateCalendar.destroy(); } catch (_) {}
        modalFactDateCalendar = null;
    }
    if (modalTransferDateCalendar) {
        try { modalTransferDateCalendar.destroy(); } catch (_) {}
        modalTransferDateCalendar = null;
    }

    const factDateInput = document.querySelector<HTMLInputElement>(
        '#modal_fact-tab-transaction input[name="fact_date"]'
    );
    if (factDateInput) {
        modalFactDateCalendar = new CalendarWidget({ inputElement: factDateInput, mode: 'single' });
    }

    const transferDateInput = document.querySelector<HTMLInputElement>(
        '#modal_fact-tab-transfer input[name="transfer_date"]'
    );
    if (transferDateInput) {
        modalTransferDateCalendar = new CalendarWidget({ inputElement: transferDateInput, mode: 'single' });
    }
}
```

#### 1.3 Добавить функцию `setupModalFactTabSwitching()`
```typescript
function setupModalFactTabSwitching(): void {
    const modal = document.getElementById('modal_fact');
    if (!modal) return;

    const tabRadios = modal.querySelectorAll<HTMLInputElement>('input[type="radio"][data-tab]');
    tabRadios.forEach(radio => {
        if (radio.dataset.tabListenerAttached) return;
        radio.dataset.tabListenerAttached = 'true';

        radio.addEventListener('change', () => {
            const activeTab = radio.dataset.tab;
            if (!activeTab) return;

            const activeTabInput = modal.querySelector<HTMLInputElement>('input[name="active_tab"]');
            if (activeTabInput) activeTabInput.value = activeTab;

            modal.querySelectorAll<HTMLElement>('.tab-content[data-tab]').forEach(content => {
                content.classList.toggle('hidden', content.dataset.tab !== activeTab);
            });
        });
    });
}
```

#### 1.4 Обновить `setupModalFactListeners()`
Добавить вызовы в блок `if (target.open)`:
```typescript
if (target.open) {
    // Modal opened - initialize form
    setFactDate(0);                  // Заполнить сегодняшнюю дату (transaction tab)
    setFactTransferDate(0);          // Заполнить сегодняшнюю дату (transfer tab)
    initModalFactCalendars();        // Создать иконки календаря
    setupModalFactTabSwitching();    // Включить переключение вкладок
}
```

### 2. `frontend/web/static/js/facts/adapters/windowExports.ts`

#### 2.1 Добавить `window.saveFactModal` в `setupWindowExports()`
```typescript
// Save fact modal (modal_fact save button uses onclick="saveFactModal(this)")
window.saveFactModal = saveFactModalFacts;
```

#### 2.2 Добавить функцию `saveFactModalFacts()`
```typescript
async function saveFactModalFacts(button: HTMLElement): Promise<void> {
    if ((button as HTMLButtonElement).disabled) return;

    const formId = (button as HTMLElement).dataset.formId || 'form_modal_fact';
    const modalId = (button as HTMLElement).dataset.modalId || 'modal_fact';
    const form = document.getElementById(formId) as HTMLFormElement;
    if (!form) return;

    const activeTabInput = form.querySelector<HTMLInputElement>('input[name="active_tab"]');
    const activeTab = activeTabInput?.value || 'transaction';

    if (activeTab === 'transfer') {
        // Delegate to transfers.min.js
        if (typeof (window as any).saveTransfer === 'function') {
            (window as any).saveTransfer(button);
        }
    } else {
        // Use facts controller createFact
        const event = new Event('submit', { bubbles: true, cancelable: true });
        await createFactAction(event);
        // Close modal on success
        const modal = document.getElementById(modalId) as HTMLDialogElement;
        modal?.close();
    }
}
```

---

## Сборка

После изменений собрать только `facts.min.js`:
```bash
VITE_ENTRY_NAME=facts \
VITE_ENTRY_INPUT=frontend/web/static/js/facts/index.ts \
VITE_ENTRY_OUTPUT=frontend/web/static/js/facts.min.js \
VITE_GLOBAL_NAME=FactsManager \
NODE_ENV=production \
npx vite build --config config/vite.config.single.ts
```

---

## Верификация

1. Открыть `https://fbd.ikeniborn.ru/facts`
2. Нажать FAB кнопку "➕ Факт" — откроется `modal_fact`
3. Проверить **поле даты**: должна появиться сегодняшняя дата (ДД.ММ.ГГГГ) и иконка 📅 открывающая календарь
4. Проверить **переключение вкладок**: нажать "Перевод" — содержимое должно переключиться на transfer tab, дата перевода заполнена сегодняшней датой с иконкой календаря
5. Нажать "Расход/Доход" — возврат к transaction tab
6. Ввести данные и нажать "Сохранить" — факт должен создаться, модал закрыться
