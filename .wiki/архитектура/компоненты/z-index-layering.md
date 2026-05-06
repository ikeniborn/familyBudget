---
wiki_sources: ["docs/architecture/frontend/z-index-layering.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["CSS", "Tailwind", "DaisyUI", "PWA", "frontend"]
aliases: ["Z-Index System", "z-index-variables", "CSS Custom Properties", "Layering"]
---

# Z-Index Layering System

Централизованная 13-слойная система управления z-index через CSS custom properties. Исключает конфликты наложения между модалками, FAB, тостами и другими оверлеями.

## Основные характеристики

### Слои (от нижнего к верхнему)

Все переменные определены в `frontend/web/static/css/z-index-variables.css`:

| CSS Custom Property | Значение | Компонент |
|---------------------|---------|-----------|
| `--z-fab-mobile` | 40 | FAB на мобиле (Speed Dial) |
| `--z-modal` | 900 | Модальные окна |
| `--z-modal-backdrop` | 999 | Backdrop модалок |
| `--z-fab-backdrop` | 1000 | FAB backdrop (Speed Dial) |
| `--z-fab-desktop` | 1002 | FAB на десктопе |
| `--z-dialog` | 1050 | `<dialog>` элементы |
| `--z-autocomplete` | 9999 | Выпадающие списки автокомплита |
| `--z-admin` | 99999 | Панель администратора, toast-уведомления |

### Принцип использования

```css
/* Вместо magic numbers */
.modal { z-index: var(--z-modal); }
.toast-container { z-index: var(--z-admin); }
.autocomplete-dropdown { z-index: var(--z-autocomplete); }
```

### Критичные точки пересечения

**FAB vs Modal:**
- FAB mobile (40) < Modal (900): корректно, FAB скрывается под модалкой
- FAB desktop (1002) > Modal backdrop (999): FAB остаётся поверх backdrop

**Autocomplete vs Dialog:**
- Autocomplete (9999) > Dialog (1050): дропдаун Choices.js виден поверх любых диалогов

**Toast vs Всё:**
- Toast (99999 = `--z-admin`) поверх любых оверлеев, включая WebAuthn prompt

### Добавление нового слоя

При добавлении нового z-indexed компонента:
1. Добавить переменную в `z-index-variables.css`
2. Выбрать значение исходя из таблицы слоёв
3. Использовать `var(--z-xxx)` в компонентном CSS (не magic number)
4. Документировать в этой странице

## Связанные концепции

- [[fab-navigation]]
- [[modal-система]]
- [[pwa-service-worker]]
