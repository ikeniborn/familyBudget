# PRD Documentation Index

Техническая документация проекта Family Budget.

## Обзор документов

| № | Документ | Описание |
|---|----------|----------|
| 01 | [Executive Summary](01-executive-summary.md) | Обзор проекта, статус, критерии успеха |
| 02 | [Product Overview](02-product-overview.md) | Видение продукта, целевая аудитория, user journeys |
| 03 | [System Architecture](03-system-architecture.md) | Архитектура, компоненты, data flows |
| 04 | [Functional Requirements](04-functional-requirements.md) | Функциональные требования (Phase 1-3) |
| 05 | [Non-Functional Requirements](05-non-functional-requirements.md) | Performance, security, scalability |
| 06 | [Database Design](06-database-design.md) | Схема БД, модели, миграции |
| 07 | [API Specification](07-api-specification.md) | REST API endpoints (43 шт) |
| 08 | [UI Design](08-ui-design.md) | UI/UX дизайн (Bot, Web, WebApp) |
| 09 | [Security & Authentication](09-security-authentication.md) | JWT, Telegram OAuth, безопасность |
| 10 | [Deployment & Operations](10-deployment-operations.md) | Docker, VPS setup, мониторинг |
| 11 | [Testing Strategy](11-testing-strategy.md) | Unit, integration, E2E тесты |
| 13 | [Appendices](13-appendices.md) | Глоссарий, дополнительные материалы |
| 14 | [Caching Strategy](14-caching-strategy.md) | Performance optimization, кэширование |
| 15 | [Code Style Guidelines](15-code-style-guidelines.md) | Стандарты кода, комментирование |
| 16 | [Changelog & Release Management](16-changelog-release-management.md) | Версионирование, release notes |

## Быстрая навигация

### Для разработчиков

- **Начало работы**: [01-executive-summary.md](01-executive-summary.md)
- **Архитектура**: [03-system-architecture.md](03-system-architecture.md)
- **API**: [07-api-specification.md](07-api-specification.md)
- **База данных**: [06-database-design.md](06-database-design.md)
- **Стиль кода**: [15-code-style-guidelines.md](15-code-style-guidelines.md)

### Для DevOps

- **Деплой**: [10-deployment-operations.md](10-deployment-operations.md)
- **Безопасность**: [09-security-authentication.md](09-security-authentication.md)
- **Performance**: [14-caching-strategy.md](14-caching-strategy.md)
- **Тестирование**: [11-testing-strategy.md](11-testing-strategy.md)

### Для дизайнеров

- **UI/UX**: [08-ui-design.md](08-ui-design.md)
- **User Journeys**: [02-product-overview.md](02-product-overview.md)

## Структура функциональных требований

Документ [04-functional-requirements.md](04-functional-requirements.md) организован по фазам:

| Фаза | Версия | Описание | FR Count |
|------|--------|----------|----------|
| Phase 1 | v1.0-v4.4.0 | Backend API, Web Analytics, Admin, Deployment | 18 |
| Phase 2 | v5.0.0-beta | Telegram Bot, Счет/Место затрат, Advanced Analytics | 6 |
| Phase 3 | v5.1.0-beta | Telegram Web Apps (8 форм через Menu Button) | 9 |

**Всего:** 33 FR реализовано (100%)

## UI Design структура

Документ [08-ui-design.md](08-ui-design.md) содержит 12 секций:

- **8.1** Telegram Bot Interface
- **8.2** Web Interface Pages
- **8.3** Analytics Charts Specifications
- **8.4** HTMX Integration Patterns
- **8.5** Responsive Design
- **8.6** UI Framework Stack
- **8.7** DaisyUI Components Mapping
- **8.8** Modal Windows Architecture
- **8.9** JavaScript Best Practices
- **8.10** Date Format Standard
- **8.11** Dark Mode Implementation
- **8.12** Migration Status

## Связанная документация

| Директория | Содержимое |
|------------|------------|
| [../audits/](../audits/) | Security audit, notifications audit, offline mode analysis |
| [../guides/](../guides/) | Импорт из Tinkoff, PR labels, troubleshooting |
| [../technical/](../technical/) | Технические решения (date input) |
| [../troubleshooting/](../troubleshooting/) | Решение проблем (mobile zoom) |

## Статус проекта

- **Версия приложения:** v6.8.0+
- **API endpoints:** 43
- **Тесты:** 373 (unit + integration + e2e)
- **Success Score:** 100%

---

**Дата обновления:** 2025-01-03
