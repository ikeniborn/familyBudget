---
wiki_sources:
  - "docs/architecture/features/transfers-system.md"
wiki_updated: 2026-05-06
wiki_status: stub
wiki_outgoing_links:
  - "[[websocket-клиент]]"
  - "[[offline-first]]"
  - "[[transfers-api]]"
  - "[[dashboard-module]]"
tags:
  - family-budget
  - architecture
  - frontend
  - transfers
aliases:
  - "transfer.js"
  - "Transfer Module"
  - "transfers frontend"
---

# Transfers — модуль переводов

Модуль переводов обеспечивает перемещение денег между финансовыми центрами с поддержкой двух режимов: фактический (немедленный) и плановый (на конкретный месяц). Реализует принцип двойной записи — каждый перевод создаёт две записи в БД.

## Основные характеристики

| Параметр | Значение |
|----------|----------|
| Статус | Production (v5.3.0+) |
| Основной файл | `frontend/web/templates/index.html` (обработчик формы) |
| Вспомогательный JS | `frontend/web/static/js/transfer.js` (инициализация, валидация) |
| Modal компонент | `frontend/web/templates/components/modal_transfer.html` |
| API эндпоинт | `POST /api/v1/transfers` |

## Типы переводов

### Фактический перевод (fact)
- Поле даты: `transfer_date` (формат DD.MM.YYYY)
- `record_type = "fact"`, `fact_date` из введённой даты
- Отображает date picker в модальном окне

### Плановый перевод (plan)
- Поле периода: `transfer_plan_month` (скрытый input, формат YYYY-MM)
- `record_type = "plan"`, `fact_date` автоматически = `YYYY-MM-01`
- Отображает 3 кнопки выбора месяца (текущий, следующий, +2)
- UI: секция `transfer-period-section-plan`

## Ключевые функции (index.html)

| Функция | Назначение |
|---------|-----------|
| `setTransferRecordType(type)` | Переключение fact/plan: показывает нужные поля, очищает `transfer_date` при plan |
| `setupTransferPeriodButtons()` | Инициализирует 3 кнопки периода, вызывается через `setTimeout(..., 0)` для defer DOM |
| `openFactTransferModal()` | Открывает модальное с режимом fact, сбрасывает FC filter |
| `openPlanTransferModal()` | Открывает модальное с режимом plan, сбрасывает FC filter |
| `saveTransfer(button)` | Обёртка, вызывает `requestSubmit()` на форме |

## Архитектура валидации (двухуровневая)

**Layer 1 — Client-side (index.html:4815, ACTIVE):**
- Авторитетный обработчик `submit` на `#form_transfer`
- Для plan: проверяет `transfer_plan_month`, конструирует `transfer_date = YYYY-MM-01`
- Для fact: проверяет `transfer_date`, форматирует через `BudgetShared.DateFormatter`
- Guard `isSubmitting` против двойного клика

**Layer 2 — Client-side (transfer.js, DISABLED с commit 7ca1f426):**
- `handleTransferSubmit()` и регистрация на форму закомментированы
- Причина отключения: двойная регистрация вызывала дублирующие ошибки и toast

**Layer 3 — Server-side (backend):**
- Pydantic схема + бизнес-логика (FC не должны совпадать)
- Дедупликация через `sync_hash`

## Критические паттерны

### Очистка transfer_date при plan режиме
При переключении в plan режим `transfer_date` **обязательно очищается** (`value = ''`) и `disabled = true`. Это предотвращает отправку текущей даты (например, 25-го числа) вместо 1-го числа месяца.

### Сброс FC filter при открытии модального окна
`fromCategoryTree.options.financialCenterId = null` и аналогично для `toCategoryTree` — предотвращает "фантомный выбор категории" из предыдущего открытия.

### Восстановление кнопки при повторном открытии
При открытии `openPlanTransferModal()` кнопка сохранения принудительно восстанавливается с fallback-текстом, чтобы спиннер не "застрял" после предыдущего submit.

## WebSocket интеграция

После успешного создания backend отправляет событие `transfer_created`. Frontend (`IncrementalUpdates`) обрабатывает:
- `refreshMetrics()` — обновляет балансы
- `refreshTransfers()` — обновляет виджет последних переводов

Никакого ручного `htmx.ajax()` не требуется — WebSocket покрывает обновление UI.

## Связанные концепции

- [[websocket-клиент]]
- [[offline-first]]
- [[transfers-api]] — backend эндпоинты `POST/PUT/DELETE /api/v1/transfers`
- [[dashboard-module]] — modalFact/modalPlan содержат Transfer вкладку
