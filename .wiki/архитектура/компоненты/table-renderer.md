---
wiki_sources: ["docs/architecture/frontend/table-optimization.md", "docs/architecture/frontend/table-optimization-patterns.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["TypeScript", "frontend", "XSS", "DaisyUI", "security"]
aliases: ["TableFormatters", "TableRenderer", "Client-Side Rendering", "escapeHtml", "table-optimization"]
---

# Table Renderer (Client-Side JSON Rendering)

Система клиентского рендеринга таблиц через JSON-данные с разделением ответственности между `TableFormatters` (форматирование ячеек) и `TableRenderer` (рендеринг строк и карточек). Заменяет HTMX server-side HTML partials.

## Основные характеристики

### XSS-защита (CVE-INTERNAL-2026-001)

**escapeHtml()** — обязательная утилита для экранирования пользовательских данных перед вставкой в DOM:

```typescript
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;  // Безопасное экранирование через textContent
  return div.innerHTML;
}
```

**Правило:** Всегда использовать `escapeHtml()` для любых данных пришедших от пользователя перед вставкой через `innerHTML`.

### TableFormatters (статический класс)

| Метод | Назначение | Пример |
|-------|-----------|--------|
| `getArticleColorClass(type)` | CSS-класс цвета по типу статьи | `expense` → `text-error font-bold` |
| `formatAmount(amount, type)` | Форматирование суммы с цветом | `-1 500 ₽` красным |
| `truncateText(text, maxLen)` | Усечение длинных строк с `...` | `"Длинное наз..."` |
| `formatDate(dateStr)` | Форматирование даты | `"23.12.25"` |

**Цветовое кодирование сумм:**
- `expense` → `text-error font-bold`
- `income` → `text-success font-bold`
- `transfer` → `text-info font-bold`
- Unknown → `text-warning font-bold`

**Иконки статусов:** 🔔 (запланировано), 🔄 (повторяющееся), ☁️ (синхронизировано). Иконка удаления — SVG trash (не emoji).

### TableRenderer (статический класс)

| Метод | Назначение |
|-------|-----------|
| `renderDesktopTable(data, config)` | HTML для `<table>` (Desktop ≥1024px) |
| `renderMobileCard(item, config)` | HTML карточки (Mobile <1024px) |
| `renderEmptyState(message)` | Состояние пустой таблицы |

### Архитектурный сдвиг

**До:** Сервер рендерит HTML partial → HTMX вставляет в DOM
**После:** Сервер возвращает JSON → клиент рендерит через TableRenderer

**Преимущества:**
- Разделение данных и представления
- TypeScript type safety для данных
- Возможность кэширования JSON на клиенте
- Гибкость форматирования без изменения backend

### Результаты рефакторинга

- `-271` строк общей кодовой базы
- Устранена XSS-уязвимость (innerHTML без экранирования)
- Консистентное форматирование во всех таблицах проекта

## Связанные концепции

- [[loading-patterns]]
- [[base-template]]
