# Changelog - Family Budget

Все значимые изменения в проекте документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
проект следует [Semantic Versioning](https://semver.org/lang/ru/).

---

## [Unreleased]

### Added (2025-10-19)

#### 🎨 UI Framework Migration: Tailwind CSS + DaisyUI

**Решение:** Мигрировали веб-интерфейс на Tailwind CSS 3.4+ + DaisyUI 4.12+

**Обоснование:**
- shadcn/ui несовместим с HTMX + Jinja2 (требует React/Vue)
- DaisyUI - HTMX-совместимая альтернатива с 50+ готовыми компонентами
- Сокращение CSS кода на 85%: с 981 строк до ~150 строк
- Поддержка dark mode из коробки

**Компоненты:**
- Tailwind CSS 3.4+ (utility-first CSS framework)
- DaisyUI 4.12+ (UI component library)
- Сохранена архитектура: HTMX 1.9.10 + Jinja2 + FastAPI

**Мигрированные страницы:**
- ✅ `web/templates/base.html` - navbar, footer, dark mode toggle
- ✅ `web/templates/analytics.html` - 5 charts, filters, btn-groups
- ✅ `web/templates/admin_dashboard.html` - stats, charts, forms

**Файлы:**
- `web/static/css/style.legacy.css` - backup исходного CSS (для отката)
- `web/static/css/custom.css` - новый кастомный CSS (150 строк)
- `web/MIGRATION_SUMMARY.md` - детальная документация миграции (19KB)

**DaisyUI компоненты (12 используются):**
- navbar, menu, dropdown
- btn, btn-group
- card, stats
- table, form-control, input, select
- modal, badge, alert, footer

**Цветовая схема:**
```javascript
{
  primary: "#4CAF50",    // Green (success, income)
  secondary: "#2196F3",  // Blue (info, links)
  accent: "#ff9800",     // Orange (highlights)
  neutral: "#333333",    // Dark gray
  error: "#f44336"       // Red (expense, errors)
}
```

#### 🌙 Dark Mode

**Функциональность:**
- Theme toggle в navbar (sun/moon иконки)
- Компонент: DaisyUI `swap swap-rotate`
- Persistence: localStorage сохраняет выбор пользователя
- Auto-load: тема загружается при старте страницы
- Темы: light (default), dark

**Реализация:**
- JavaScript в `base.html` для управления темой
- CSS переменные автоматически применяются к ECharts

**Файлы:**
- `web/templates/base.html:155-180` - JavaScript для dark mode

#### 📊 Responsive Charts

**Обновления:**
- Charts теперь используют Tailwind grid (responsive)
- Mobile breakpoint: 300px height (вместо 400px)
- Desktop: 400px height
- Grid: 1 column (mobile) → 2 columns (lg desktop)

**Файлы:**
- `web/templates/analytics.html` - responsive chart layout
- `web/templates/admin_dashboard.html` - responsive stats grid

### Changed (2025-10-19)

#### CSS Architecture

**До:**
- `web/static/css/style.css` - 981 строк vanilla CSS
- Custom styles для каждого компонента
- Много дублирования кода

**После:**
- `web/static/css/custom.css` - 150 строк кастомного CSS
- Tailwind utility classes в HTML
- DaisyUI компоненты из коробки
- Сокращение на 85%

#### PRD Documentation

**Обновлено:**
- `docs/prd/08-ui-design.md` - добавлены секции 8.6-8.9:
  - 8.6 UI Framework Stack
  - 8.7 DaisyUI Components Mapping
  - 8.8 Dark Mode Implementation
  - 8.9 Migration Status

**Добавлено:**
- Таблица компонентов (UI Element → DaisyUI mapping)
- Цветовая палитра DaisyUI theme
- JavaScript примеры для dark mode
- Migration status таблица

### Deprecated (2025-10-19)

- `web/static/css/style.css` → переименован в `style.legacy.css` (backup)
- Vanilla CSS классы: `.navbar`, `.card`, `.btn-primary`, `.modal`, `.form-group` и др.

### Pending (Next Steps)

**High Priority:**
- [ ] Мигрировать `admin_users.html` (table, modals, forms)
- [ ] Мигрировать `admin_articles.html` (table, tree-view, modals)
- [ ] Мигрировать `admin_facts.html` (table, filters, pagination)

**Medium Priority:**
- [ ] Мигрировать `admin_financial_centers.html` (CRUD)
- [ ] Мигрировать `admin_cost_centers.html` (CRUD)
- [ ] Мигрировать `admin_monitoring.html` (stats, charts)

**Optimization:**
- [ ] Production build: заменить CDN на Tailwind CLI (50-100KB vs 3MB)
- [ ] Performance testing
- [ ] Accessibility audit (WCAG AA)
- [ ] Удалить `style.legacy.css` после полной миграции

**Patterns готовы:**
См. `/web/MIGRATION_SUMMARY.md` для детальных примеров кода.

---

## [5.0.0-beta] - 2025-10-15

### Added
- Telegram Bot интерфейс (python-telegram-bot 20.x)
- FastAPI Backend (REST API + Web UI)
- PostgreSQL 16 база данных
- HTMX frontend для веб-интерфейса
- ECharts 5.5 для аналитических графиков
- Docker Compose deployment
- SCD Type 2 для dimension таблиц
- Closure Table для иерархии категорий
- Telegram OAuth аутентификация
- JWT в httpOnly cookies
- User data isolation
- 5 типов аналитических графиков
- Admin CRUD страницы
- Backup system (local + Yandex S3)
- Deploy scripts (install.sh, setup.sh, deploy.sh)

### Technical Stack
- Python 3.11+
- FastAPI 0.115+
- python-telegram-bot 21+
- PostgreSQL 16+
- HTMX 1.9.10
- ECharts 5.5+
- Docker & Docker Compose
- Nginx (reverse proxy)

---

## Project Information

**Project Name:** Family Budget
**Version:** 5.0.0-beta
**License:** MIT
**Repository:** https://github.com/user/familyBudget

**Key Documents:**
- `README.md` - основная документация
- `START.md` - quick start guide (русский)
- `CLAUDE.md` - инструкции для Claude Code
- `docs/prd/` - Product Requirements Documents
- `web/MIGRATION_SUMMARY.md` - UI migration guide

**Contributors:**
- User (Product Owner)
- Claude Code (Development Assistant)

---

**Последнее обновление:** 2025-10-19
