---
wiki_sources:
  - "docs/architecture/overview.yaml"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links:
  - "[[dexie-module]]"
  - "[[websocket-клиент]]"
  - "[[window-exports]]"
  - "[[transfers-module]]"
  - "[[recurring-plans]]"
tags:
  - family-budget
  - architecture
  - frontend
aliases:
  - "Dashboard Module"
  - "dashboard"
  - "DashboardState"
---

# Dashboard — модуль главной страницы

Основной TypeScript ES Module для управления бюджетом на главной странице (`/`). Включает модальные окна для создания транзакций и планов (v9.0 — tabbed modals).

## Основные характеристики

| Параметр | Значение |
|----------|---------|
| Bundle | `frontend/web/static/js/dashboard.min.js` |
| Размер | ~143KB minified / ~26KB gzip |
| LOC | ~1900 |
| Язык | TypeScript |

## Архитектура модуля

```
dashboard/
├── core/DashboardState.ts           — State management
├── features/factsManager.ts         — Dexie analytics queries
├── features/editModal/formPopulation.ts — Заполнение edit modal
├── features/modalFact/              — Tabbed modal для транзакций (v9.0)
├── features/modalPlan/              — Tabbed modal для планов (v9.0)
├── features/fab/contextModal.ts     — FAB (+ кнопка) открывает нужный modal
├── types/analytics.d.ts             — TypeScript типы для аналитики
└── adapters/windowExports.ts        — Window exports для onclick
```

## Tabbed Modals (v9.0, 2026-01-25)

**modalFact:** 2 вкладки — Transaction (расход/доход) + Transfer (перевод между счетами)
- FormData кеширование при переключении вкладок
- Интеграция с ChoicesCategoryTree
- Skeleton loader для UX

**modalPlan:** 2 вкладки — Transaction + Transfer; 3 режима — regular, recurring, reminder
- Recurring settings: monthly/quarterly/yearly, preview
- MMDD кодирование для yearly-частоты

**FAB (+ кнопка):** Контекстное открытие — на `/` и `/facts` открывает modalFact, на `/plan` — modalPlan.

## Зависимости

```
dashboard → budgetShared (ChoicesCategoryTree, CalendarWidget)
         → budgetWSClient (real-time обновления)
         → dexie (DexieManager, analytics queries)
         → performanceMonitor
```

## Ключевые паттерны

**Lazy initialization (Transfer Modal):**
```typescript
// Инициализация только при первом открытии
window.openFactTransferModal = async () => {
    await window.initTransferModal(); // ждём загрузки данных
    openModal();
};
```

**isInitialized flag:** предотвращает дублирующую инициализацию при множественных вызовах.

## Связанные концепции

- [[dexie-module]] — analytics queries, offline data
- [[websocket-клиент]] — real-time обновления
- [[window-exports]] — паттерн экспорта onclick-функций
- [[transfers-module]] — Transfer вкладка в modalFact/modalPlan
- [[recurring-plans]] — Recurring настройки в modalPlan

## История изменений

| Версия | Изменения |
|--------|-----------|
| v9.0.0 | Tabbed modals (Phase 1-5): modalFact + modalPlan |
| v7.0.0 | Миграция на TypeScript ES Modules |
| task-011 | Dashboard query optimization (85% faster через Dexie) |
