# Product Requirements Document (PRD)
## FamilyBudget - Система управления семейным бюджетом

**Версия:** 1.0
**Дата создания:** 2025-10-08
**Статус:** Final
**Автор:** AI System

---

## 📋 О документе

Этот Product Requirements Document (PRD) содержит полное описание системы FamilyBudget - веб-приложения для управления семейным бюджетом с Telegram-ботом для оперативного ввода данных и веб-интерфейсом для аналитики.

Документ разбит на логические разделы для удобства навигации и сопровождения.

---

## 📚 Структура документа

### 1. [Executive Summary](01-executive-summary.md)
**Размер:** ~100 строк | **Приоритет:** Critical

**Содержание:**
- Обзор проекта и целевая аудитория
- Постановка проблемы (Problem Statement)
- Краткое описание решения (Solution Summary)
- Ключевые функции (Key Features)
- Технологический стек
- Критерии успеха проекта

**Ключевые пункты:**
- Целевая аудитория: семьи из 2-5 человек
- Основная ценность: быстрый ввод через Telegram (< 1 мин) + наглядная аналитика
- 21 функциональное требование (FR)
- Tech stack: Python 3.11+, FastAPI, PostgreSQL 16+, HTMX, ECharts

---

### 2. [Product Overview](02-product-overview.md)
**Размер:** ~190 строк | **Приоритет:** High

**Содержание:**
- Видение продукта (Product Vision)
- Целевая аудитория (2 персоны)
- Пользовательские сценарии (User Stories)
- Конкурентный анализ
- Фазы развития продукта (MVP → Phase 2 → Phase 3)

**Ключевые пункты:**
- Принципы: Простота превыше функциональности, Telegram-first подход
- Персона 1: Обычный пользователь (25-45 лет, семья 2-5 человек)
- Персона 2: Администратор (power user, управление справочниками)
- 10+ user stories

---

### 3. [System Architecture](03-system-architecture.md)
**Размер:** ~416 строк | **Приоритет:** Critical

**Содержание:**
- Архитектура высокого уровня
- Архитектура компонентов (Telegram Bot, Backend API, Web UI)
- Диаграммы взаимодействия
- Архитектура данных (SCD Type 2, Closure Table)
- Интеграции и зависимости
- Масштабируемость

**Ключевые пункты:**
- Микросервисная архитектура (3 основных компонента)
- SCD Type 2 pattern для справочников (версионирование)
- Closure Table pattern для иерархии статей
- Асинхронные операции (бэкапы, уведомления)
- Поддержка 100+ пользователей на single VPS

---

### 4. [Functional Requirements](04-functional-requirements.md)
**Размер:** ~420 строк | **Приоритет:** Critical

**Содержание:**
- 21 функциональное требование (FR-001 до FR-060)
- Детальные User Stories для каждого FR
- Acceptance Criteria
- Зависимости между требованиями

**Основные группы требований:**
- **Telegram Bot** (FR-001 до FR-006): Ввод данных, уведомления, отчеты
- **Веб-интерфейс** (FR-010 до FR-024): Аналитика, CRUD, администрирование
- **Системные** (FR-030 до FR-060): Аутентификация, справочники, бэкапы, развертывание

**Критические требования:**
- FR-001: Быстрое добавление расходов через Telegram
- FR-010-014: 5 типов аналитических графиков
- FR-040: Иерархические справочники
- FR-041: SCD Type 2 историчность

---

### 5. [Non-Functional Requirements](05-non-functional-requirements.md)
**Размер:** ~80 строк | **Приоритет:** High

**Содержание:**
- Производительность (Performance)
- Масштабируемость (Scalability)
- Надежность (Reliability)
- Безопасность (Security)
- Удобство использования (Usability)
- Поддерживаемость (Maintainability)

**Ключевые метрики:**
- Время отклика API: < 500ms (p95)
- Время генерации графиков: < 2 сек
- Uptime: 99.5%
- Автоматическое восстановление из бэкапа: < 30 мин
- Время развертывания на VPS: < 10 мин

---

### 6. [Database Design](06-database-design.md)
**Размер:** ~300 строк | **Приоритет:** Critical

**Содержание:**
- Схема базы данных (4 основные таблицы)
- DDL statements для всех таблиц
- Индексы и constraints
- Триггеры для Closure Table
- Миграции (Alembic)

**Таблицы:**
- `t_d_user` - Пользователи (SCD Type 2)
- `t_d_article` - Статьи доходов/расходов (SCD Type 2 + Adjacency List)
- `t_d_article_hierarchy` - Closure Table для иерархии
- `t_f_fact` - Факты доходов/расходов (транзакции)

**Паттерны:**
- SCD Type 2: Версионирование с valid_from/valid_to
- Closure Table: Хранение всех путей в иерархии
- Партиционирование: t_f_fact по месяцам

---

### 7. [API Specification](07-api-specification.md)
**Размер:** ~288 строк | **Приоритет:** High

**Содержание:**
- REST API endpoints (40+ endpoints)
- Request/Response форматы
- Коды ошибок
- Webhooks (Telegram)

**Группы endpoints:**
- Health & Monitoring (4 endpoints)
- Authentication (2 endpoints)
- Users (2 endpoints)
- Articles (6 endpoints)
- Facts (5 endpoints)
- Analytics (6 endpoints)
- Admin (10+ endpoints)

**Особенности:**
- OpenAPI/Swagger документация
- JWT authentication (HTTP-only cookies)
- CORS настройки
- Rate limiting (future)

---

### 8. [UI Design](08-ui-design.md)
**Размер:** ~288 строк | **Приоритет:** High

**Содержание:**
- Дизайн-система
- Структура страниц (7 основных страниц)
- Компоненты (HTMX)
- Графики (ECharts конфигурации)
- Адаптивность

**Страницы:**
1. Dashboard - Главная страница с quick stats
2. Analytics - Детальная аналитика с 5 типами графиков
3. Transactions - Список транзакций (CRUD)
4. Articles - Управление статьями (только admin)
5. Budget Plan - Планирование бюджета
6. Profile - Профиль пользователя
7. Settings - Настройки (admin)

**Технологии:**
- HTMX для динамического обновления
- TailwindCSS для стилизации
- ECharts 5.5+ для графиков
- Jinja2 темплейты

---

### 9. [Security & Authentication](09-security-authentication.md)
**Размер:** ~266 строк | **Приоритет:** Critical

**Содержание:**
- Модель аутентификации (Telegram OAuth + JWT)
- Безопасность данных
- Сетевая безопасность (UFW, Docker networks)
- Механизмы защиты
- Compliance требования
- Security Checklist

**Ключевые механизмы:**
- Telegram Login Widget с HMAC-SHA256 валидацией
- JWT токены (7 дней expiration)
- HTTP-only cookies
- UFW firewall с IP whitelist
- Изоляция PostgreSQL (internal network)
- Encrypted secrets (.env с 600 permissions)

**Угрозы:**
- OWASP Top 10 покрытие
- XSS, CSRF, SQL Injection защита
- Brute force protection
- Data isolation (WHERE user_id = current_user)

---

### 10. [Deployment & Operations](10-deployment-operations.md)
**Размер:** ~378 строк | **Приоритет:** Critical

**Содержание:**
- Инфраструктура (VPS требования)
- Docker конфигурация
- Deployment процесс (3 bash скрипта)
- Мониторинг и логирование
- Backup стратегия
- Операционные процедуры

**Deployment скрипты:**
1. **install.sh** - Установка Docker, UFW, системные зависимости
2. **setup.sh** - Интерактивная настройка .env, UFW конфигурация
3. **deploy.sh** - Build, запуск контейнеров, миграции

**Backup:**
- Локально: ежедневно (retention 7 дней)
- S3 (Yandex): еженедельно (retention 28 дней)
- Автоматическое тестирование восстановления

**Мониторинг:**
- Health check endpoints
- Structured JSON logging
- Docker logs centralization
- Disk space monitoring

---

### 11. [Testing Strategy](11-testing-strategy.md)
**Размер:** ~133 строк | **Приоритет:** High

**Содержание:**
- Виды тестов (Unit, Integration, E2E, Manual)
- Покрытие тестами
- CI/CD интеграция
- Test fixtures

**Структура тестов:**
- **Unit tests**: Модели, утилиты, валидаторы
- **Integration tests**: API endpoints, services, database
- **E2E tests**: 8 test classes (user journeys, admin journeys)
- **Manual tests**: Deployment workflow, backup/restore

**E2E test coverage:**
- User Journey: 11-step workflow (categories → transactions → analytics)
- Budget Planning Journey
- Analytics Exploration (все 6 типов графиков)
- Admin User Management
- Admin Global Articles
- Admin System Monitoring
- Security & Access Control

---

### 12. [Risk Management](12-risk-management.md)
**Размер:** ~167 строк | **Приоритет:** High

**Содержание:**
- Идентификация рисков (8 основных рисков)
- Оценка вероятности и impact
- Митигация стратегии
- Contingency планы

**Критические риски:**
- **RISK-001**: Потеря данных (High impact)
  - Митигация: Автоматические бэкапы, тестирование восстановления
- **RISK-002**: Проблемы масштабирования (Medium impact)
  - Митигация: Индексы, партиционирование, caching
- **RISK-007**: Несанкционированный доступ к PostgreSQL (High impact)
  - Митигация: UFW firewall, internal network, IP whitelist

**Категории рисков:**
- Технические риски (4)
- Операционные риски (2)
- Безопасности риски (2)

---

### 13. [Appendices](13-appendices.md)
**Размер:** ~138 строк | **Приоритет:** Reference

**Содержание:**
- Глоссарий терминов
- Сокращения и аббревиатуры
- Справочные данные
- Примеры конфигураций
- Change Log

**Полезная информация:**
- Определение терминов (SCD Type 2, Closure Table, JWT, etc.)
- Список всех аббревиатур (FR, NFR, API, etc.)
- Примеры .env конфигурации
- История изменений документа

---

## 🎯 Быстрая навигация

### По приоритетам

**Critical Priority (обязательны к прочтению):**
- [Executive Summary](01-executive-summary.md) - Обзор проекта
- [System Architecture](03-system-architecture.md) - Архитектура системы
- [Functional Requirements](04-functional-requirements.md) - Функциональные требования
- [Database Design](06-database-design.md) - Дизайн БД
- [Security & Authentication](09-security-authentication.md) - Безопасность
- [Deployment & Operations](10-deployment-operations.md) - Развертывание

**High Priority (важны для понимания):**
- [Product Overview](02-product-overview.md) - Видение продукта
- [Non-Functional Requirements](05-non-functional-requirements.md) - NFR
- [API Specification](07-api-specification.md) - API
- [UI Design](08-ui-design.md) - Дизайн интерфейса
- [Testing Strategy](11-testing-strategy.md) - Тестирование
- [Risk Management](12-risk-management.md) - Управление рисками

**Reference:**
- [Appendices](13-appendices.md) - Справочная информация

---

### По ролям

**Для Product Manager:**
- [Executive Summary](01-executive-summary.md)
- [Product Overview](02-product-overview.md)
- [Functional Requirements](04-functional-requirements.md)
- [Risk Management](12-risk-management.md)

**Для Tech Lead / Architect:**
- [System Architecture](03-system-architecture.md)
- [Database Design](06-database-design.md)
- [Non-Functional Requirements](05-non-functional-requirements.md)
- [Security & Authentication](09-security-authentication.md)

**Для Backend Developer:**
- [Functional Requirements](04-functional-requirements.md)
- [API Specification](07-api-specification.md)
- [Database Design](06-database-design.md)
- [Security & Authentication](09-security-authentication.md)

**Для Frontend Developer:**
- [UI Design](08-ui-design.md)
- [API Specification](07-api-specification.md)
- [Functional Requirements](04-functional-requirements.md)

**Для DevOps:**
- [Deployment & Operations](10-deployment-operations.md)
- [Security & Authentication](09-security-authentication.md)
- [Non-Functional Requirements](05-non-functional-requirements.md)

**Для QA Engineer:**
- [Testing Strategy](11-testing-strategy.md)
- [Functional Requirements](04-functional-requirements.md)
- [Non-Functional Requirements](05-non-functional-requirements.md)

---

## 📊 Статистика документа

**Общий размер:** ~3188 строк (разбито на 14 файлов)

**Распределение по разделам:**
- Executive Summary: 100 строк (3%)
- Product Overview: 190 строк (6%)
- System Architecture: 416 строк (13%)
- Functional Requirements: 420 строк (13%)
- Non-Functional Requirements: 80 строк (3%)
- Database Design: 300 строк (9%)
- API Specification: 288 строк (9%)
- UI Design: 288 строк (9%)
- Security & Authentication: 266 строк (8%)
- Deployment & Operations: 378 строк (12%)
- Testing Strategy: 133 строк (4%)
- Risk Management: 167 строк (5%)
- Appendices: 138 строк (4%)

**Ключевые метрики:**
- Функциональных требований: 21
- API endpoints: 40+
- Таблиц БД: 4
- Типов графиков: 6
- Bash скриптов для развертывания: 3
- Идентифицированных рисков: 8

---

## 🔄 Версионирование

**Текущая версия:** 1.0
**Статус:** Final
**Последнее обновление:** 2025-10-14

**История изменений:**
- 2025-10-14: Разбиение на модули, создание этого README
- 2025-10-08: Первоначальная версия (монолитный PRD.md)

---

## 📝 Как использовать этот документ

1. **Для первого знакомства с проектом:**
   - Начните с [Executive Summary](01-executive-summary.md)
   - Затем прочитайте [Product Overview](02-product-overview.md)
   - Изучите [System Architecture](03-system-architecture.md)

2. **Для детального изучения функциональности:**
   - Откройте [Functional Requirements](04-functional-requirements.md)
   - Посмотрите примеры в [UI Design](08-ui-design.md)
   - Изучите [API Specification](07-api-specification.md)

3. **Для имплементации:**
   - Изучите [Database Design](06-database-design.md)
   - Прочитайте [Security & Authentication](09-security-authentication.md)
   - Следуйте [Deployment & Operations](10-deployment-operations.md)

4. **Для тестирования:**
   - Откройте [Testing Strategy](11-testing-strategy.md)
   - Проверьте [Functional Requirements](04-functional-requirements.md) на Acceptance Criteria
   - Учтите риски из [Risk Management](12-risk-management.md)

---

## 🔗 Связанные документы

- **Основная документация проекта:** [docs/README.md](../README.md)
- **API документация:** [docs/api/API_DOCUMENTATION.md](../api/API_DOCUMENTATION.md)
- **E2E тесты:** [docs/testing/E2E_TESTS.md](../testing/E2E_TESTS.md)
- **Deployment документация:** [docs/deployment/](../deployment/)
- **Task reports:** [docs/tasks/](../tasks/)

---

**Поддержка:** Для вопросов по PRD создайте issue в проекте
