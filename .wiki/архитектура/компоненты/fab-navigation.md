---
wiki_sources: ["docs/architecture/frontend/responsive-design.md", "docs/architecture/frontend/speed-dial-unified.md"]
wiki_updated: 2026-05-05
wiki_status: stub
tags: ["Tailwind", "DaisyUI", "HTMX"]
aliases: ["FAB", "Floating Action Button", "Speed Dial"]
---

# FAB Navigation (Floating Action Button)

Компонент навигации для добавления транзакций. На мобильных устройствах — отдельная кнопка "+" с speed dial меню (выше навигационного бара). На десктопе — единственная кнопка FAB в правом нижнем углу с backdrop overlay.

## Основные характеристики

### Мобильный (< 1024px)

- **Навигационный бар** (низ экрана): 5 прямых ссылок без dropdown. Z-index: 50
- **FAB "+"** (правый нижний угол, выше навбара): speed dial без backdrop. Z-index: 40
- Safe-area-inset padding для iPhone notch

### Десктопный (≥ 1024px)

- Speed Dial с 4 action items
- Backdrop overlay при открытии
- Z-index: 1000 (backdrop: 999)
- Меню открывается вверх

### Управление видимостью по страницам

FAB скрыт на `/analytics` (нет смысла добавлять транзакции). На `/lists` — используется собственный FAB из `lists.html`, отдельный от `fab_toolbar.html`.

## Связанные концепции

- [[modal-система]]
- [[responsive-design]]
