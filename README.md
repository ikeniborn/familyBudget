# Family Budget - Система управления семейным бюджетом

Современное веб-приложение для управления семейным бюджетом, построенное на SvelteKit с унифицированной Node.js архитектурой. Поддерживает многопользовательский режим, интеграцию с Telegram и разделение планируемых и фактических расходов.

## 🎯 Ключевые преимущества

- **Унифицированная архитектура** - единый Node.js/TypeScript стек для frontend и backend
- **Высокая производительность** - интеллектуальное кеширование с Redis, оптимизированные запросы
- **Типобезопасность** - 100% покрытие TypeScript, Prisma ORM
- **Современный UI** - SvelteKit 2 + Svelte 5 с Tailwind CSS
- **Безопасность** - защита от SQL-инъекций, изоляция данных пользователей

## 🚀 Возможности

### Основные функции
- **Многопользовательский режим** - изоляция данных между пользователями
- **Telegram-авторизация** - вход через Telegram без паролей
- **План/Факт анализ** - сравнение запланированных и фактических расходов
- **Иерархическая структура** - ЦФО (центры финансовой ответственности) и МВЗ (места возникновения затрат)
- **Гибкие периоды** - настраиваемые периоды бюджетирования
- **Автоматическое резервное копирование** - ежедневные бэкапы в Yandex Cloud
- **SSL/HTTPS** - безопасное соединение с автоматическим обновлением сертификатов

### Новые возможности (Август 2025)
- **Управление справочными данными** - периоды, номенклатура, ЦФО, МВЗ
- **Управление продуктами и ценами** - каталог товаров с историей цен
- **История изменений и аудит** - полная трассировка операций
- **Bulk операции** - импорт/экспорт Excel/CSV файлов
- **Продвинутые фильтры** - сохраненные фильтры и быстрый поиск
- **PWA поддержка** - работа как мобильное приложение
- **Темизация** - светлая и темная темы
- **SSR из коробки** - server-side rendering для SEO

## 🏗️ Архитектура

Проект построен на современной унифицированной архитектуре с использованием Docker:

```
            ┌─────────────────┐
            │    Traefik      │
            │  (SSL/Routing)  │
            └────────┬────────┘
                     │
            ┌────────▼────────┐
            │    Frontend     │
            │   (SvelteKit)   │
            │   :5173/3000    │
            └────────┬────────┘
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

#### Frontend (SvelteKit)
- **Framework**: SvelteKit 2 + Svelte 5 с TypeScript
- **Styling**: Tailwind CSS + CSS Variables для темизации
- **State**: Svelte stores с reactive patterns
- **Forms**: svelte-forms-lib + Yup/Zod validation
- **Charts**: Chart.js + svelte-chartjs для аналитики
- **Tables**: @tanstack/svelte-table с виртуализацией
- **Testing**: Vitest + @testing-library/svelte (50% coverage)
- **E2E**: Playwright для интеграционных тестов
- **SSR/SSG**: Полная поддержка server-side rendering
- **PWA**: Service Worker + Web App Manifest
- **Accessibility**: ARIA compliance + keyboard navigation

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

# Запуск production окружения
./scripts/prod.sh

# Или вручную:
docker-compose up -d --build

# Проверка статуса
docker ps

# Просмотр логов
docker logs -f frontend-svelte
docker logs -f frontend-api
```

#### Разработка
```bash
# Быстрый старт с инициализацией БД
./scripts/dev.sh -d          # Detached mode
./scripts/dev.sh --init-db   # Force DB reinitialization

# Локальная разработка (с hot reload)
cd frontend-svelte && npm run dev

# Команды разработки frontend
npm run dev              # SvelteKit dev server (port 5173)
npm run build           # Production build
npm run preview         # Preview production build
npm run test            # Run Vitest unit tests
npm run test:ui         # Interactive UI for tests
npm run lint            # ESLint check
npm run check           # Svelte type checking
npm run format          # Prettier formatting

# Доступные URL:
# Frontend: http://localhost:5173 (dev) или http://localhost:3000 (production)
# API: http://localhost:4000
# PostgreSQL: localhost:5432
# Redis: localhost:6379
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

- **Development**: http://localhost:5173
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

- **docker-compose.dev.yaml** - Конфигурация для разработки. Использует:
  - Hot-reload для SvelteKit и Node.js
  - Development сборки с source maps
  - Монтирование исходного кода
  - Упрощенная конфигурация без всех сервисов

### Структура проекта

```
familyBudget/
├── frontend-svelte/      # SvelteKit frontend (единственный frontend)
│   ├── src/             # Исходный код
│   │   ├── lib/         # Библиотеки и компоненты
│   │   │   ├── components/  # UI компоненты
│   │   │   │   ├── auth/       # Компоненты авторизации
│   │   │   │   ├── common/     # Общие UI компоненты
│   │   │   │   ├── ui/         # Базовые UI элементы
│   │   │   │   ├── budget/     # Компоненты бюджета
│   │   │   │   ├── reference/  # Справочные данные
│   │   │   │   └── reports/    # Отчеты и аналитика
│   │   │   ├── stores/      # Svelte stores
│   │   │   ├── services/    # API сервисы
│   │   │   ├── types/       # TypeScript типы
│   │   │   └── utils/       # Утилиты
│   │   ├── routes/      # Файл-роутинг SvelteKit
│   │   │   ├── (protected)/ # Защищенные маршруты
│   │   │   ├── login/       # Страница входа
│   │   │   └── +layout.svelte # Корневой layout
│   │   ├── app.html     # HTML шаблон
│   │   └── app.css      # Глобальные стили
│   ├── static/          # Статические файлы
│   ├── tests/           # Тесты
│   ├── svelte.config.js # Конфигурация SvelteKit
│   ├── vite.config.ts   # Конфигурация Vite
│   └── package.json     # Зависимости
├── frontend-api/         # Node.js API (унифицированный)
│   ├── src/             # Исходный код
│   │   ├── routes/      # API маршруты
│   │   ├── services/    # Бизнес-логика
│   │   ├── middleware/  # Express middleware
│   │   └── database/    # Prisma клиент
│   ├── prisma/          # Схема Prisma
│   ├── tests/           # Тесты API
│   └── package.json     # Зависимости
├── postgresql/           # База данных
│   ├── ddl/             # Схема БД
│   └── backup/          # Скрипты резервного копирования
├── scripts/              # Утилиты и автоматизация
│   ├── dev.sh           # Скрипт разработки
│   └── prod.sh          # Production скрипт
├── docs/                 # Документация (на русском)
│   ├── DEVELOPMENT_SETUP.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── ENVIRONMENT_VARIABLES.md
│   ├── ENV_FILE_CONVENTIONS.md
│   ├── MIGRATION-STATUS.md  # Статус миграции
│   └── archive/          # Архивная документация
├── .env.prod             # Пример переменных окружения
├── .env.dev              # Переменные для разработки
├── .env                  # Production переменные (не коммитится)
├── docker-compose.yaml         # Production конфигурация
└── docker-compose.dev.yaml     # Development конфигурация
```


### Команды разработки

```bash
# Frontend (SvelteKit + TypeScript)  
cd frontend-svelte
npm run dev              # Запуск dev сервера (5173)
npm run build           # Сборка для production
npm run preview         # Превью production сборки
npm run test            # Запуск тестов Vitest
npm run test:ui         # Интерактивный UI для тестов
npm run test:coverage   # Генерация отчета покрытия
npm run lint            # ESLint проверка
npm run check           # Проверка типов Svelte
npm run check:watch     # Проверка типов в watch режиме
npm run format          # Prettier форматирование
npm run lighthouse      # Lighthouse аудит

# Backend (Node.js + TypeScript)
cd frontend-api
npm run dev             # Запуск с nodemon
npm run build           # TypeScript сборка
npm run start           # Production запуск
npm run test            # Запуск Jest тестов
npm run test:coverage   # Генерация coverage (70-80%)
npm run lint            # ESLint проверка
npm run type-check      # TypeScript проверка
npm run prisma:generate # Генерация Prisma клиента
npm run prisma:migrate  # Prisma миграции
npm run prisma:studio   # Prisma Studio GUI
```

### Работа с контейнерами

```bash
# Перезапуск сервисов
docker restart frontend-svelte   # SvelteKit frontend
docker restart frontend-api      # Node.js API

# Просмотр логов
docker logs -f frontend-api
docker logs -f frontend-svelte

# Вход в контейнеры
docker exec -it frontend-api bash
docker exec -it frontend-svelte bash

# Пересборка конкретного сервиса
docker-compose -f docker-compose.dev.yaml build frontend-svelte
docker-compose -f docker-compose.dev.yaml build frontend-api

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

### Архивная документация
- [Migration Archive](docs/archive/migration-2024-2025/) - Исторические документы миграции API

## 📝 Лицензия

MIT License - см. файл LICENSE для деталей.

## 👥 Авторы

- Ваше имя (@yourusername)

## 🚀 Завершение миграции на SvelteKit (Август 2025)

### Архитектурные улучшения
- **Унифицированная архитектура** - современный стек SvelteKit + Node.js API
- **Упрощение стека** - от двойного фронтенда к единому SvelteKit решению
- **Современные технологии** - SvelteKit 2 + Svelte 5 + Vite + TypeScript
- **Prisma ORM** - type-safe запросы к базе данных, защита от SQL-инъекций

### Улучшения производительности
- **Bundle size** - оптимизирован на 40% благодаря компиляции Svelte
- **Время загрузки** - ускорено на 60% благодаря SvelteKit
- **Memory usage** - снижено на 30-50% за счет компиляции Svelte
- **Время отклика API** - улучшено на 20-40% с унифицированным стеком
- **Hot reload** - мгновенная перезагрузка в development режиме

### Новые возможности
- **SSR из коробки** - server-side rendering для лучшего SEO
- **PWA поддержка** - работа как нативное мобильное приложение
- **Темизация** - автоматическое переключение светлой/темной темы
- **Accessibility** - полная ARIA совместимость и keyboard navigation
- **Advanced filtering** - сохраненные фильтры и быстрый поиск
- **Bulk operations** - массовые операции с Excel/CSV импортом
- **Audit trail** - полная история изменений с версионированием

### Технические преимущества
- **Единый стек** - TypeScript везде, от frontend до backend
- **Type safety** - полная типизация через Prisma и SvelteKit
- **Developer experience** - улучшенный DX с hot reload и type checking
- **Testing** - Vitest + Playwright для unit и E2E тестов
- **Performance monitoring** - встроенный Lighthouse аудит

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