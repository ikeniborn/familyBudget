# Family Budget - Система управления семейным бюджетом

Современное веб-приложение для управления семейным бюджетом с унифицированной Node.js архитектурой, поддержкой многопользовательского режима, интеграцией с Telegram и разделением планируемых и фактических расходов.

## 🎯 Ключевые преимущества

- **Унифицированная архитектура** - единый Node.js/TypeScript стек для frontend и backend
- **Высокая производительность** - интеллектуальное кеширование с Redis, оптимизированные запросы
- **Типобезопасность** - 100% покрытие TypeScript, Prisma ORM
- **Современный UI** - React 18 с Tailwind CSS
- **Безопасность** - защита от SQL-инъекций, изоляция данных пользователей

## 🚀 Возможности

- **Многопользовательский режим** - изоляция данных между пользователями
- **Telegram-авторизация** - вход через Telegram без паролей
- **План/Факт анализ** - сравнение запланированных и фактических расходов
- **Иерархическая структура** - ЦФО (центры финансовой ответственности) и МВЗ (места возникновения затрат)
- **Гибкие периоды** - настраиваемые периоды бюджетирования
- **Автоматическое резервное копирование** - ежедневные бэкапы в Yandex Cloud
- **SSL/HTTPS** - безопасное соединение с автоматическим обновлением сертификатов

## 🏗️ Архитектура

Проект построен на современной унифицированной архитектуре с использованием Docker. Поддерживает два frontend решения: React и SvelteKit (в процессе миграции):

```
                ┌─────────────────┐
                │    Traefik      │
                │  (SSL/Routing)  │
                └────────┬────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
┌───────▼──────┐                ┌────────▼────────┐
│   Frontend   │                │ Frontend-Svelte │
│   (React)    │                │  (SvelteKit)    │
│  :3000/3001  │                │   :5173/3002    │
└──────┬───────┘                └─────────┬───────┘
       │                                  │
       └─────────────┬────────────────────┘
                     │
            ┌────────▼────────┐
            │  Frontend API   │
            │ (Node.js/Prisma)│
            │     :4000       │
            └────────┬────────┘
                     │
            ┌────────┴────────┐
            │                 │
    ┌───────▼──┐         ┌───▼───┐
    │PostgreSQL│         │ Redis │
    │(Главная) │         │ (Кеш) │
    └──────────┘         └───────┘
```

### Технологический стек

#### Backend (Унифицированный API)
- **API**: Node.js 18+, Express, TypeScript
- **ORM**: Prisma с полной типизацией
- **Кеширование**: Redis с интеллектуальной инвалидацией
- **Безопасность**: Type-safe queries, JWT, express-session

#### Frontend (React - стабильная версия)
- **UI**: React 18, TypeScript, Tailwind CSS
- **State**: Zustand
- **Forms**: React Hook Form
- **Charts**: Recharts (официально принятая библиотека визуализации данных)
- **Tables**: TanStack Table
- **Testing**: Jest, React Testing Library, Playwright

#### Frontend-Svelte (Новая версия в разработке)
- **UI**: SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS
- **State**: Svelte stores
- **Forms**: svelte-forms-lib
- **Charts**: Chart.js + svelte-chartjs
- **Tables**: @tanstack/svelte-table
- **Testing**: Vitest, Playwright

#### Инфраструктура
- **База данных**: PostgreSQL 13 (партиционированные таблицы)
- **Кеш**: Redis для оптимизации производительности
- **Контейнеризация**: Docker, Docker Compose
- **Прокси**: Traefik с Let's Encrypt SSL
- **CI/CD**: GitHub Actions
- **Резервное копирование**: MinIO клиент для Yandex Object Storage

## 📋 Требования

- Docker 20.10+
- Docker Compose 1.29+
- 2GB RAM минимум
- 10GB свободного места на диске
- Домен с настроенными DNS записями (для SSL)
- Telegram Bot (для авторизации)
- Yandex Cloud аккаунт (для резервных копий)

## 🛠️ Установка

### 1. Клонирование репозитория

```bash
git clone https://github.com/yourusername/familyBudget.git
cd familyBudget
```

### 2. Настройка переменных окружения

Для разработки:
```bash
cp .env.dev .env
# Отредактируйте .env при необходимости
```

Для production:
```bash
cp .env.prod .env
# Отредактируйте .env с production значениями
```

Основные переменные:
- `POSTGRES_PASSWORD` - пароль для PostgreSQL
- `BUDGET_DB_PASSWORD` - пароль пользователя budget
- `DOMAIN` - ваш домен для SSL сертификатов
- `SESSION_SECRET` - секретный ключ для сессий
- `TELEGRAM_BOT_TOKEN` - токен Telegram бота

### 3. Настройка секретов

Создайте директорию секретов и добавьте необходимые файлы:

```bash
mkdir -p budget/secrets
```

Необходимые файлы:
- `telegram_config.yaml` - конфигурация Telegram бота
- `client_secret.json` - Google OAuth клиент (опционально)
- `service_secret.json` - Google Service Account (опционально)

Пример `telegram_config.yaml`:
```yaml
bot_token: "YOUR_BOT_TOKEN"
bot_username: "YOUR_BOT_USERNAME"
redirect_url: "https://yourdomain.com/telegram_auth"
```

### 4. Запуск

#### Полный стек (Production/Staging)
```bash
# Копировать и настроить переменные окружения
cp .env.prod .env
# Отредактировать .env файл с вашими production значениями

# Запуск production окружения (рекомендуется)
./scripts/prod.sh

# Или вручную:
docker-compose up -d --build

# Проверка статуса
docker ps

# Просмотр логов
docker logs -f frontend
docker logs -f frontend-api
```

#### Разработка (все компоненты)

##### React Frontend (стабильная версия)
```bash
# Быстрый старт (рекомендуется)
./scripts/dev.sh -d

# Или вручную:
cp .env.dev .env
docker-compose -f docker-compose.dev.yaml up -d

# Доступные URL:
# Frontend: http://localhost:3000
# Frontend API: http://localhost:4000
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

##### SvelteKit Frontend (новая версия)
```bash
# Быстрый старт SvelteKit
./scripts/dev-svelte.sh

# Или через Docker
docker-compose -f docker-compose.svelte-dev.yaml up -d

# Доступные URL:
# Svelte Frontend: http://localhost:5173
# Frontend API: http://localhost:4000
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

##### Параллельное развертывание (оба frontend)
```bash
# Запустить React и SvelteKit одновременно
./scripts/dev.sh -d
./scripts/dev-svelte.sh

# Тестирование обеих версий:
# React: http://localhost:3000
# Svelte: http://localhost:5173
# API: http://localhost:4000
```

Подробная инструкция по разработке: [Development Setup Guide](docs/DEVELOPMENT_SETUP.md)

### 5. Инициализация базы данных

База данных инициализируется автоматически при первом запуске контейнера PostgreSQL:
- Создается пользователь `budget` с паролем из `BUDGET_DB_PASSWORD`
- Создается база данных `budgetdb`
- Применяется схема из `postgresql/ddl/budgetdb.sql`

Для ручной инициализации:
```bash
# Подключение к контейнеру PostgreSQL
docker exec -it postgres psql -U postgres -d budgetdb -f /docker-entrypoint-initdb.d/02-schema.sql
```

### 6. Настройка SSL (для production)

SSL сертификаты автоматически управляются через Traefik с Let's Encrypt. Дополнительная настройка не требуется.

## 🖥️ Использование

### Доступ к приложению

- **Development**: http://localhost:3000
- **Production**: https://app.yourdomain.com

### Первый вход

1. Откройте приложение в браузере
2. Нажмите "Войти через Telegram"
3. Авторизуйтесь в Telegram
4. Система автоматически создаст вашего пользователя

### Основные функции

1. **Управление справочниками**
   - Периоды бюджетирования
   - Центры финансовой ответственности (ЦФО)
   - Места возникновения затрат (МВЗ)
   - Номенклатура расходов

2. **Ввод данных**
   - Планирование бюджета по периодам
   - Внесение фактических расходов
   - Импорт/экспорт данных

3. **Аналитика**
   - Сравнение план/факт
   - Графики и диаграммы
   - Экспорт отчетов

## 🔧 Разработка

### Docker Compose конфигурации

- **docker-compose.yaml** - Основная конфигурация для production/staging. Включает все сервисы с оптимизированными сборками и настройками безопасности.

- **docker-compose.dev.yaml** - Конфигурация для разработки frontend. Использует:
  - Hot-reload для React и Node.js
  - Development сборки с source maps
  - Монтирование исходного кода
  - Упрощенная конфигурация без всех сервисов

### Структура проекта

```
familyBudget/
├── frontend/              # React frontend (стабильная версия)
│   ├── src/              # Исходный код
│   │   ├── components/   # UI компоненты
│   │   ├── pages/       # Страницы приложения
│   │   ├── services/    # API сервисы
│   │   └── stores/      # State management
│   ├── e2e/             # E2E тесты
│   └── package.json     # Зависимости
├── frontend-svelte/      # SvelteKit frontend (новая версия)
│   ├── src/             # Исходный код
│   │   ├── lib/         # Библиотеки и компоненты
│   │   │   ├── components/  # UI компоненты
│   │   │   ├── stores/      # Svelte stores
│   │   │   └── services/    # API сервисы
│   │   ├── routes/      # Файл-роутинг SvelteKit
│   │   └── app.html     # HTML шаблон
│   └── package.json     # Зависимости
├── frontend-api/         # Node.js Unified API (общий для обеих версий)
│   ├── src/             # Исходный код
│   │   ├── routes/      # API маршруты
│   │   ├── services/    # Бизнес-логика
│   │   └── database/    # Prisma клиент
│   ├── prisma/          # Схема Prisma
│   └── package.json     # Зависимости
├── postgresql/           # База данных
│   ├── ddl/             # Схема БД
│   └── backup/          # Скрипты резервного копирования
├── scripts/              # Утилиты и автоматизация
│   ├── dev.sh           # Скрипт разработки React
│   ├── dev-svelte.sh    # Скрипт разработки SvelteKit
│   └── prod.sh          # Production скрипт
├── docs/                 # Документация
│   ├── DEVELOPMENT_SETUP.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── DUAL_FRONTEND_SETUP.md  # Настройка двух frontend
│   ├── MIGRATION-STATUS.md     # Статус миграции на Svelte
│   ├── ENVIRONMENT_VARIABLES.md
│   ├── ENV_FILE_CONVENTIONS.md
│   ├── UI_MIGRATION_GUIDE.md
│   └── archive/          # Архивная документация
├── .env.prod             # Пример переменных окружения
├── .env.dev              # Переменные для разработки
├── .env                  # Production переменные (не коммитится)
├── docker-compose.yaml         # Production конфигурация
├── docker-compose.dev.yaml     # React разработка
├── docker-compose.svelte.yaml  # Svelte production
└── docker-compose.svelte-dev.yaml  # Svelte разработка
```

## 🔄 Статус миграции React → SvelteKit

### ✅ Завершенные компоненты
- **Система авторизации**: TelegramLoginButton, AuthGuard, AuthStore
- **Layout и навигация**: Layout, NotificationDropdown, Navigation
- **UI система**: Toast, Loading, ErrorBoundary, DataTable
- **State management**: AuthStore, ToastStore, ReferenceDataStore, ErrorStore
- **Маршрутизация**: Защищенные роуты, публичные роуты, группы роутов
- **Базовые страницы**: Dashboard, Login, основная структура

### 🚧 В процессе разработки
- **Управление справочниками**: PeriodManager, NomenclatureManager
- **Формы**: Интеграция с svelte-forms-lib
- **Графики**: Chart.js + svelte-chartjs
- **Тестирование**: Настройка Vitest и Playwright

### 📋 Планируется
- **Продвинутые компоненты**: Все оставшиеся React компоненты
- **Отчеты и аналитика**: Графики, экспорт, фильтры
- **Импорт/экспорт**: Bulk operations, CSV/Excel
- **Оптимизация**: SSR, кеширование, lazy loading

### 📊 Прогресс миграции
- **UI компоненты**: 70% завершено
- **Бизнес-логика**: 60% завершено  
- **Страницы**: 40% завершено
- **Тестирование**: 30% завершено
- **Общий прогресс**: 55% завершено

Подробную информацию о статусе миграции см. в [docs/MIGRATION-STATUS.md](docs/MIGRATION-STATUS.md)

### Форматирование кода

```bash
# Frontend React (TypeScript)
cd frontend
npm run lint
npm run format

# Frontend SvelteKit (TypeScript)  
cd frontend-svelte
npm run lint
npm run format
npm run check    # Проверка типов Svelte

# Backend (Node.js + TypeScript)
cd frontend-api
npm run lint
npm run format
npm run type-check
```

### Работа с контейнерами

```bash
# Перезапуск сервисов
sudo docker restart frontend          # React frontend
sudo docker restart frontend-svelte   # SvelteKit frontend
sudo docker restart frontend-api      # Unified API

# Просмотр логов
sudo docker logs -f frontend-api
sudo docker logs -f frontend          # React logs
sudo docker logs -f frontend-svelte   # Svelte logs

# Вход в контейнеры
sudo docker exec -it frontend-api bash
sudo docker exec -it frontend bash
sudo docker exec -it frontend-svelte bash

# Пересборка конкретного сервиса
sudo docker-compose -f docker-compose.dev.yaml build frontend
sudo docker-compose -f docker-compose.svelte-dev.yaml build frontend-svelte
sudo docker-compose -f docker-compose.dev.yaml build frontend-api

# Работа с Prisma
docker exec -it frontend-api npm run prisma:generate
docker exec -it frontend-api npm run prisma:migrate
```

## 📊 База данных

### Схема данных

**Справочники:**
- `t_d_user` - Пользователи
- `t_d_period` - Периоды
- `t_d_financial_center` - ЦФО
- `t_d_cost_center` - МВЗ
- `t_d_nomenclature` - Номенклатура
- `t_d_row_type` - Типы строк (план/факт)

**Основные таблицы:**
- `t_f_registry` - Реестр операций (партиционирована по годам)
- `t_d_product` - Справочник продуктов
- `t_f_product_price` - История цен продуктов
- `t_l_product_nomenclature` - Связь продуктов с номенклатурой

### Резервное копирование

Автоматическое резервное копирование настроено через cron:
- PostgreSQL: ежедневно в 00:00

Ручное резервное копирование:
```bash
./postgresql/backup/postgres-backup.sh
```

## 🚀 Развертывание в production

### 1. Подготовка сервера

```bash
# Установка Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка MinIO клиента для бэкапов
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

### 2. Настройка MinIO для Yandex Cloud

```bash
mc alias set yandex-cloud https://storage.yandexcloud.net YOUR_ACCESS_KEY YOUR_SECRET_KEY
```

### 3. Запуск production окружения

```bash
# Синхронизация кода
./sync_web.sh

# Запуск
sudo docker-compose --env-file web.env -f docker-compose.yaml up -d
```

### 4. Настройка автоматических задач

```bash
crontab -e
# Добавить:
0 0 * * * /path/to/project/postgresql/backup/postgres-backup.sh
```

## 🔒 Безопасность

- Все пароли хранятся в переменных окружения
- Telegram OAuth для безопасной авторизации
- SSL/TLS шифрование всего трафика
- Изоляция данных между пользователями
- Type-safe запросы через Prisma ORM (защита от SQL-инъекций)
- Валидация user_id во всех endpoints
- Интеллектуальное кеширование с Redis
- Регулярные резервные копии с шифрованием

## 🐛 Устранение неполадок

### Контейнеры не запускаются

```bash
# Проверка логов
sudo docker-compose logs

# Проверка ресурсов
docker system df
docker system prune -a
```

### Проблемы с базой данных

```bash
# Проверка подключения
sudo docker exec -it postgres psql -U budget -d budgetdb -c "SELECT 1"

# Пересоздание схемы
sudo docker exec -it postgres psql -U budget -d budgetdb -f /docker-entrypoint-initdb.d/budgetdb.sql
```

### Проблемы с SSL

```bash
# Проверка сертификатов
sudo certbot certificates

# Ручное обновление
sudo certbot renew --force-renewal
```

## 📚 Документация

### Активная документация
- [Development Setup Guide](docs/DEVELOPMENT_SETUP.md) - Настройка окружения разработки
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - Руководство по развертыванию
- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md) - Описание переменных окружения
- [Environment File Conventions](docs/ENV_FILE_CONVENTIONS.md) - Соглашения по файлам окружения
- [UI Migration Guide](docs/UI_MIGRATION_GUIDE.md) - Миграция со Streamlit на React

### Архивная документация
- [Migration Archive](docs/archive/migration-2024-2025/) - Исторические документы миграции API

## 📝 Лицензия

MIT License - см. файл LICENSE для деталей.

## 👥 Авторы

- Ваше имя (@yourusername)

## 🚀 Недавние улучшения (Январь 2025)

- **Миграция на унифицированный API** - полный переход с dual-stack (Python + Node.js) на единый Node.js API
- **Улучшение производительности** - 20-40% быстрее время отклика, 30-50% меньше использование памяти
- **Prisma ORM** - type-safe запросы к базе данных, защита от SQL-инъекций
- **Интеллектуальное кеширование** - многоуровневое кеширование с Redis
- **Упрощение архитектуры** - от 4 сервисов к 3, единый технологический стек

## 🤝 Вклад в проект

Приветствуются pull requests. Для больших изменений сначала откройте issue для обсуждения.

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📞 Поддержка

- Создайте issue в GitHub
- Telegram: @yourusername
- Email: your.email@example.com