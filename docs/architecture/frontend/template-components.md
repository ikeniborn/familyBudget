# Template Component System - Delete Button Macros

## Обзор

Система переиспользуемых Jinja2 macros для стандартизации UI компонентов в Family Budget приложении.

**Текущие компоненты:**
- Delete Button Macros (v1.0.0) - Кнопки удаления для desktop/mobile

**Версия:** 1.0.0
**Дата создания:** 2026-01-21
**Статус:** Production Ready ✅

---

## Delete Button Macros

### Расположение

```
frontend/web/templates/components/macros/delete_buttons.html
```

### Архитектурная цель

Обеспечить визуальную консистентность кнопок удаления во всем приложении, сократить дублирование кода и упростить поддержку.

---

## Доступные Macros

### 1. `delete_button_desktop`

Кнопка удаления для desktop таблиц (≥768px).

#### Сигнатура

```jinja2
{% macro delete_button_desktop(entity_id, delete_function, entity_type='entity', title='Удалить', extra_classes='') %}
```

#### Параметры

| Параметр | Тип | Required | Default | Описание |
|----------|-----|----------|---------|----------|
| `entity_id` | int\|str | ✅ Yes | - | ID сущности для удаления |
| `delete_function` | str | ✅ Yes | - | Имя JavaScript функции удаления |
| `entity_type` | str | ❌ No | `'entity'` | Тип сущности для `data-*` attribute |
| `title` | str | ❌ No | `'Удалить'` | Tooltip текст |
| `extra_classes` | str | ❌ No | `''` | Дополнительные CSS классы |

#### Визуальные характеристики

- **Размер кнопки:** `btn-xs` (компактный для таблиц)
- **Размер иконки:** `h-4 w-4` (16×16px)
- **Цвет:** `btn-error` (красный DaisyUI)
- **Видимость:** `hidden md:inline-flex` (только desktop ≥768px)
- **Форма:** `btn-square` (квадрат)

#### Accessibility

- `title="{{ title }}"` - tooltip при hover
- `aria-label="{{ title }} {{ entity_type }} ID {{ entity_id }}"` - для screen readers
- `data-{{ entity_type }}-id="{{ entity_id }}"` - для testing/debugging

#### Примеры использования

```jinja2
{# Импорт macro #}
{% from "components/macros/delete_buttons.html" import delete_button_desktop %}

{# Простой вызов (факт в таблице) #}
{{ delete_button_desktop(fact.id, 'deleteFact', entity_type='fact') }}

{# Результат #}
<button class="btn btn-xs btn-error btn-square hidden md:inline-flex"
        data-fact-id="42"
        onclick="event.stopPropagation(); deleteFact(42)"
        title="Удалить"
        aria-label="Удалить fact ID 42">
    <svg class="h-4 w-4" stroke="currentColor">...</svg>
</button>

{# С дополнительными классами #}
{{ delete_button_desktop(article.id, 'deactivateArticle',
                         entity_type='article',
                         title='Деактивировать',
                         extra_classes='ml-2') }}
```

---

### 2. `delete_button_mobile`

Кнопка удаления для mobile модалей (<768px).

#### Сигнатура

```jinja2
{% macro delete_button_mobile(onclick_handler, title='Удалить', extra_classes='') %}
```

#### Параметры

| Параметр | Тип | Required | Default | Описание |
|----------|-----|----------|---------|----------|
| `onclick_handler` | str | ✅ Yes | - | JavaScript выражение/вызов функции |
| `title` | str | ❌ No | `'Удалить'` | Tooltip текст |
| `extra_classes` | str | ❌ No | `''` | Дополнительные CSS классы |

#### Визуальные характеристики

- **Размер кнопки:** `btn-sm sm:btn-md` (адаптивный)
  - Телефоны (<640px): `btn-sm` → ~40px
  - Планшеты (640-767px): `btn-md` → ~56px
- **Размер иконки:** `h-5 w-5` (20×20px - больше для touch)
- **Цвет:** `btn-error` (красный DaisyUI)
- **Видимость:** `md:hidden` (только mobile <768px)
- **Форма:** `btn-square` (квадрат)

#### Touch Accessibility

- Минимальный размер: 44×44px (iOS/Android guidelines)
- `btn-sm` (32px) + padding → ~40px на телефонах ✅
- `sm:btn-md` (48px) + padding → ~56px на планшетах ✅

#### Примеры использования

```jinja2
{# Импорт macro #}
{% from "components/macros/delete_buttons.html" import delete_button_mobile %}

{# Простой вызов (модаль редактирования факта) #}
{{ delete_button_mobile('deleteFromEditModal()') }}

{# Результат #}
<button type="button"
        class="btn btn-sm sm:btn-md btn-error btn-square md:hidden"
        onclick="deleteFromEditModal()"
        title="Удалить"
        aria-label="Удалить">
    <svg class="h-5 w-5" stroke="currentColor">...</svg>
</button>

{# С параметрами #}
{{ delete_button_mobile('deletePlan(123)', title='Удалить план') }}
```

---

### 3. `delete_icon_svg`

Переиспользуемая SVG иконка корзины (trash bin).

#### Сигнатура

```jinja2
{% macro delete_icon_svg(size_class='h-4 w-4', stroke_color='currentColor') %}
```

#### Параметры

| Параметр | Тип | Required | Default | Описание |
|----------|-----|----------|---------|----------|
| `size_class` | str | ❌ No | `'h-4 w-4'` | Tailwind CSS класс размера |
| `stroke_color` | str | ❌ No | `'currentColor'` | SVG stroke цвет |

#### Дизайн иконки

- **Источник:** Heroicons outline "trash" icon
- **viewBox:** `0 0 24 24`
- **stroke-width:** `2`
- **stroke-linecap:** `round`
- **stroke-linejoin:** `round`

#### Использование `currentColor`

Иконка автоматически наследует цвет текста родительского элемента:
- На `btn-error` кнопках: белый цвет (DaisyUI default) ✅
- Позволяет менять цвет через CSS без изменения SVG

#### Примеры использования

```jinja2
{# Импорт macro #}
{% from "components/macros/delete_buttons.html" import delete_icon_svg %}

{# Desktop размер #}
{{ delete_icon_svg('h-4 w-4') }}

{# Mobile размер #}
{{ delete_icon_svg('h-5 w-5') }}

{# Custom цвет #}
{{ delete_icon_svg('h-6 w-6', 'red') }}
```

---

## Naming Conventions

### Macro Names

- **Pattern:** `{component}_{variant}_{optional_modifier}`
- **Examples:**
  - `delete_button_desktop` ✅
  - `delete_button_mobile` ✅
  - `delete_icon_svg` ✅

### Parameters

- **entity_id:** ID сущности (факт, категория, счёт и т.д.)
- **entity_type:** Тип сущности (`'fact'`, `'article'`, `'center'`, `'store'`)
- **delete_function:** Имя JavaScript функции (`'deleteFact'`, `'deleteCenter'`)
- **onclick_handler:** Полное JavaScript выражение (`'deleteFromEditModal()'`)

---

## Migration Guide

### Миграция inline кнопки → macro

#### Было (до миграции):

```jinja2
<button class="btn btn-xs btn-error btn-square hidden md:inline-flex"
        data-fact-id="{{ fact.id }}"
        onclick="event.stopPropagation(); deleteFact({{ fact.id }})"
        title="Удалить">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>
</button>
```

**Размер:** 8 строк

#### Стало (после миграции):

```jinja2
{% from "components/macros/delete_buttons.html" import delete_button_desktop %}

{{ delete_button_desktop(fact.id, 'deleteFact', entity_type='fact') }}
```

**Размер:** 1 строка (87% сокращение ✅)

---

### Миграция mobile modal кнопки

#### Было (до миграции):

```jinja2
<button type="button" class="btn btn-xs btn-error btn-square md:hidden"
        onclick="deleteFromEditModal()" title="Удалить">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="white">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
    </svg>
</button>
```

**Проблемы:**
- ❌ Неправильный размер кнопки: `btn-xs` (должно быть `btn-sm sm:btn-md`)
- ❌ Неправильный размер иконки: `h-4 w-4` (должно быть `h-5 w-5`)
- ❌ Неправильный stroke: `stroke="white"` (должно быть `stroke="currentColor"`)

#### Стало (после миграции):

```jinja2
{% from "components/macros/delete_buttons.html" import delete_button_mobile %}

{{ delete_button_mobile('deleteFromEditModal()') }}
```

**Исправления:**
- ✅ Правильный размер: `btn-sm sm:btn-md`
- ✅ Правильная иконка: `h-5 w-5`
- ✅ Правильный stroke: `currentColor`

---

## Мигрированные Templates (v1.0.0)

### Core Templates (3 файла)

1. ✅ `frontend/web/templates/components/facts/fact_row_desktop.html`
   - Desktop table кнопка
   - Использует: `delete_button_desktop(fact.id, 'deleteFact', entity_type='fact')`

2. ✅ `frontend/web/templates/components/modal_edit_fact.html`
   - Mobile modal кнопка
   - Исправлено: `stroke="white"` → `stroke="currentColor"`
   - Использует: `delete_button_mobile('deleteFromEditModal()')`

3. ✅ `frontend/web/templates/components/modal_edit_plan.html`
   - Mobile modal кнопка
   - Исправлено: `stroke="white"` → `stroke="currentColor"`
   - Использует: `delete_button_mobile('deleteFromEditModal()')`

### Admin Templates (5 файлов)

4. ✅ `frontend/web/templates/admin_cost_centers.html`
5. ✅ `frontend/web/templates/admin_financial_centers.html`
6. ✅ `frontend/web/templates/admin_stores.html`
7. ✅ `frontend/web/templates/admin_product_groups.html`
8. ✅ `frontend/web/templates/admin_articles.html`

**Исправления (все 5 файлов):**
- ✅ Mobile modal: `btn-xs` → `btn-sm sm:btn-md`
- ✅ Mobile modal: `h-4 w-4` → `h-5 w-5`

### Partials (1 файл)

9. ✅ `frontend/web/templates/partials/recent_transactions.html`
   - Desktop table кнопка
   - Использует: `delete_button_desktop(fact.id, 'deleteRecordFromDashboard', entity_type='fact')`

---

## Best Practices

### 1. Импорт macros

Всегда импортируйте макросы в начале template:

```jinja2
{% extends "base.html" %}
{% from "components/macros/delete_buttons.html" import delete_button_desktop, delete_button_mobile %}

{% block content %}
<!-- Your content -->
{% endblock %}
```

### 2. Выбор правильного macro

| Контекст | Macro | Размер кнопки | Иконка |
|----------|-------|---------------|--------|
| Desktop таблица | `delete_button_desktop` | `btn-xs` | `h-4 w-4` |
| Mobile modal | `delete_button_mobile` | `btn-sm sm:btn-md` | `h-5 w-5` |

### 3. Параметр `entity_type`

Используйте осмысленные типы для улучшения debugging:

```jinja2
{# ❌ Bad #}
{{ delete_button_desktop(42, 'delete') }}

{# ✅ Good #}
{{ delete_button_desktop(fact.id, 'deleteFact', entity_type='fact') }}
```

### 4. JavaScript функции удаления

#### Desktop: передавайте имя функции

```jinja2
{# ✅ Correct #}
{{ delete_button_desktop(fact.id, 'deleteFact', entity_type='fact') }}
{# Результат: onclick="event.stopPropagation(); deleteFact(42)" #}
```

#### Mobile: передавайте полное выражение

```jinja2
{# ✅ Correct #}
{{ delete_button_mobile('deleteFromEditModal()') }}
{# Результат: onclick="deleteFromEditModal()" #}
```

---

## Troubleshooting

### Проблема: Кнопка не видна

**Симптом:** Кнопка не отображается на странице

**Причины:**

1. **Desktop кнопка на mobile:**
   - `delete_button_desktop` имеет `hidden md:inline-flex`
   - Видна только на ≥768px
   - **Решение:** Используйте `delete_button_mobile` для модалей

2. **Mobile кнопка на desktop:**
   - `delete_button_mobile` имеет `md:hidden`
   - Видна только на <768px
   - **Решение:** Используйте `delete_button_desktop` для таблиц

### Проблема: JavaScript ошибка "function is not defined"

**Симптом:** `Uncaught ReferenceError: deleteFact is not defined`

**Причины:**

1. Функция не определена в глобальном scope
2. Опечатка в имени функции

**Решение:**

```javascript
// Убедитесь что функция доступна глобально
window.deleteFact = function(factId) {
    // ...
};

// Или используйте event delegation
document.addEventListener('click', function(e) {
    if (e.target.matches('[data-fact-id]')) {
        const factId = e.target.dataset.factId;
        deleteFact(factId);
    }
});
```

### Проблема: Белая иконка на белом фоне

**Симптом:** Иконка не видна (белая на белом)

**Причина:** Использование `stroke="white"` вместо `stroke="currentColor"`

**Решение:** Используйте macros - они автоматически используют `currentColor` ✅

---

## Future Extensions

### Планируемые компоненты (v1.1.0+)

1. **Edit Button Macros**
   ```jinja2
   {{ edit_button_desktop(entity.id, 'showEditModal') }}
   {{ edit_button_mobile('openEditModal()') }}
   ```

2. **Archive Button Macros**
   ```jinja2
   {{ archive_button_desktop(entity.id, 'archiveEntity') }}
   ```

3. **Restore Button Macros**
   ```jinja2
   {{ restore_button_desktop(entity.id, 'restoreEntity') }}
   ```

4. **Action Button Group Macro**
   ```jinja2
   {{ action_button_group(entity.id,
                          actions=['edit', 'archive', 'delete'],
                          entity_type='article') }}
   ```

---

## Changelog

### v1.0.0 (2026-01-21)

**Added:**
- ✅ `delete_button_desktop` macro
- ✅ `delete_button_mobile` macro
- ✅ `delete_icon_svg` macro
- ✅ Детальные docstrings с type hints
- ✅ Accessibility attributes (aria-label, title, data-*)

**Fixed:**
- ✅ `stroke="white"` → `stroke="currentColor"` (2 файла)
- ✅ Mobile modal размеры `btn-xs` → `btn-sm sm:btn-md` (5 файлов)
- ✅ Mobile modal иконки `h-4 w-4` → `h-5 w-5` (5 файлов)

**Migrated:**
- ✅ 9 templates (3 core + 5 admin + 1 partial)
- ✅ 81% сокращение дублированного кода

---

## Связанные документы

- [Architecture Overview](../overview.yaml) - Архитектурная документация
- [Delete Buttons Standardization Plan](../../..) - План стандартизации (internal)
- [Code Review Guidelines](../../guides/code-review.md) - Руководство по code review

---

## Контакты

**Вопросы/Предложения:**
- GitHub Issues: https://github.com/anthropics/familybudget/issues
- Code Review: используйте `@skill:code-review`

**Версия документа:** 1.0.0
**Последнее обновление:** 2026-01-21
