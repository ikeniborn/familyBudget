---
wiki_sources: ["docs/architecture/frontend/modal-architecture.md", "docs/architecture/features/transfers-system.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["HTMX", "Tailwind", "DaisyUI"]
aliases: ["Modal Architecture", "Tab-Based Modals", "modal_fact", "modal_plan"]
---

# Модальная система (Modal Architecture)

Табовая архитектура модальных окон для создания и редактирования транзакций (facts) и планов (plans). Каждая модалка содержит два таба: **Transaction** (обычная транзакция) и **Transfer** (перевод между счетами).

## Основные характеристики

### modal_fact (фактические транзакции)

| Таб | Селектор | Поля |
|-----|---------|------|
| Transaction | `#modal_fact-tab-transaction` | financial_center, article, cost_center, amount, date |
| Transfer | `#modal_fact-tab-transfer` | from/to FC, from/to article, amount, date |

### modal_plan (планируемые транзакции)

| Таб | Селектор | Поля |
|-----|---------|------|
| Transaction | `#modal_plan-tab-transaction` | financial_center, article, cost_center, amount, period |
| Transfer | `#modal_plan-tab-transfer` | from/to FC, from/to article, amount, period |

### Загрузка дропдаунов

Централизованная функция `loadFinancialCenters(targetSelectors?)` в `categoryLoader.ts`:
- Использует DataLayer (Dexie-first с API fallback)
- Поддерживает явные селекторы для Transfer-табов
- Автоматическая валидация пустых списков

### CategoryTreeSelect

- Transaction tabs: `state.transactionCategoryTreeSelect` / `state.planCategoryTreeSelect`
- Transfer FROM: `state.factTransferFromCategoryTree` (expense)
- Transfer TO: `state.factTransferToCategoryTree` (income)

## Связанные концепции

- [[fab-navigation]]
- [[transfer-service]]
