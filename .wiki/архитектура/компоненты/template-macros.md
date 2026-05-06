---
wiki_sources: ["docs/architecture/frontend/template-components.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["Jinja2", "HTMX", "Tailwind", "DaisyUI", "frontend"]
aliases: ["Jinja2 Macros", "Delete Button", "delete_button_desktop", "delete_button_mobile", "delete_icon_svg"]
---

# Template Macros (Jinja2)

Система переиспользуемых Jinja2-макросов для стандартизации UI-компонентов, особенно кнопок удаления. Устраняет дублирование кода в 9 шаблонах.

## Основные характеристики

### Макросы удаления

Три основных макроса, определённых в общем файле макросов:

#### delete_button_desktop

Кнопка удаления для десктопного представления (≥1024px), видима при hover на строке таблицы:

```jinja2
{{ macros.delete_button_desktop(
    entity_id=fact.id,
    delete_function="deleteFact",
    entity_type="fact",
    title="Удалить транзакцию",
    extra_classes=""
) }}
```

#### delete_button_mobile

Кнопка удаления для мобильного представления (<1024px), размещается в карточке:

```jinja2
{{ macros.delete_button_mobile(
    onclick_handler="deleteFact({{ fact.id }})",
    title="Удалить",
    extra_classes="btn-sm"
) }}
```

#### delete_icon_svg

SVG-иконка корзины без обёртки в кнопку (для кастомного встраивания):

```jinja2
{{ macros.delete_icon_svg(size_class="w-4 h-4", stroke_color="currentColor") }}
```

**Почему SVG, а не emoji:** Emoji 🗑️ отображается непоследовательно в разных браузерах/ОС, SVG — всегда идентично.

### Применение

Шаблоны, использующие макросы:
- `facts.html`, `plan.html`, `budget.html`
- `articles.html`, `financial_centers.html`, `cost_centers.html`
- `transfers.html` и другие (9 шаблонов мигрировано)

### Результаты

- **-87%** кода для delete-кнопок (дублирующийся inline HTML → единый макрос)
- Консистентный UX: одинаковые анимации, размеры, hover-состояния
- Единая точка изменения стиля кнопок

### Связь с Window Exports

Delete-функции (`deleteFact`, `deletePlan` и т.д.) экспортируются через `adapters/windowExports.ts` для доступа из onclick-атрибутов шаблонов. Макросы ссылаются на эти window-функции по имени как строку.

## Связанные концепции

- [[base-template]]
- [[fab-navigation]]
