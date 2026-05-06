---
wiki_sources: ["docs/architecture/frontend/loading-patterns.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["HTMX", "TypeScript", "frontend", "performance"]
aliases: ["Phased Loading", "setButtonLoading", "loadFactsDebounced", "Фазовая загрузка"]
---

# Loading Patterns (Frontend)

Система фазовой загрузки данных и UI-паттерны для состояния загрузки кнопок/форм в Family Budget.

## Основные характеристики

### Фазовая последовательная загрузка

Данные загружаются в строго определённом порядке, чтобы каждая фаза могла использовать данные предыдущей:

| Фаза | Операции | Примечание |
|------|----------|------------|
| Phase 1 | users, financial centers, cost centers | Параллельно |
| Phase 2 | articles (категории) | После Phase 1 |
| Phase 3 | facts (транзакции) | После Phase 2 |

**Критично:** articles зависят от cost centers; facts зависят от articles для фильтрации/отображения.

### setButtonLoading()

Утилита для унифицированного состояния загрузки на кнопках:

```typescript
setButtonLoading(button, isLoading, loadingText?, originalText?)
```

**Заменяет:** ручной `classList.add('loading')` и прямую манипуляцию DOM.

**Паттерн применения:**
```typescript
const btn = document.getElementById('submit-btn');
setButtonLoading(btn, true, 'Сохранение...');
try {
  await saveData();
} finally {
  setButtonLoading(btn, false);
}
```

### loadFactsDebounced

Функция загрузки facts с debounce 300ms для предотвращения избыточных запросов при быстрых изменениях фильтров.

```typescript
const loadFactsDebounced = debounce(loadFacts, 300);
```

Применяется при: изменении дат фильтра, переключении финансовых центров, вводе в поля поиска.

### Spinner/Skeleton States

- **Кнопки:** DaisyUI класс `btn-loading` или кастомный spinner через `setButtonLoading()`
- **Таблицы:** Skeleton-rows при первоначальной загрузке
- **HTMX:** Стандартный `hx-indicator` для server-side rendered partial responses

## Связанные концепции

- [[base-template]]
- [[modal-система]]
- [[table-renderer]]
