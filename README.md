# Family Budget - Система управления семейным бюджетом

Веб-приложение для управления семейным бюджетом с поддержкой многопользовательского режима, интеграцией с Telegram и разделением планируемых и фактических расходов.

## 🚀 Возможности

- **Многопользовательский режим** - изоляция данных между пользователями
- **Telegram-авторизация** - вход через Telegram без паролей
- **План/Факт анализ** - сравнение запланированных и фактических расходов
- **Иерархическая структура** - ЦФО (центры финансовой ответственности) и МВЗ (места возникновения затрат)
- **Гибкие периоды** - настраиваемые периоды бюджетирования
- **Автоматическое резервное копирование** - ежедневные бэкапы в Yandex Cloud
- **SSL/HTTPS** - безопасное соединение с автоматическим обновлением сертификатов

## 🏗️ Архитектура

Проект построен на микросервисной архитектуре с использованием Docker:

```
┌─────────────────┐     ┌─────────────────┐
│    Traefik      │────▶│   Frontend      │
│  (SSL/Routing)  │     │    (React)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │              ┌────────▼────────┐
         │              │  Frontend API   │
         │              │   (Node.js)     │
         │              └────────┬────────┘
         │                       │
         │              ┌────────▼────────┐
         └─────────────▶│   Budget API    │
                        │   (FastAPI)     │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │   PostgreSQL    │
                        │  (Partitioned)  │
                        └─────────────────┘
```

### Технологический стек

#### Backend
- **API**: Python 3.9, FastAPI, asyncpg
- **BFF**: Node.js, Express, TypeScript

#### Frontend
- **UI**: React 18, TypeScript, Tailwind CSS
- **State**: Zustand
- **Forms**: React Hook Form
- **Charts**: Recharts
- **Tables**: TanStack Table
- **Testing**: Jest, React Testing Library, Playwright

#### Инфраструктура
- **База данных**: PostgreSQL 13 (партиционированные таблицы)
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

Скопируйте и отредактируйте файлы окружения:

```bash
cp web_dev.env.example web_dev.env
cp web.env.example web.env
```

Основные переменные:
- `POSTGRES_PASSWORD` - пароль для PostgreSQL
- `APP_PATH` - путь к приложению
- `DOMAIN` - ваш домен для SSL сертификатов

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
cp .env.example web.env
# Отредактировать web.env файл с вашими production значениями

# Запуск production окружения (рекомендуется)
./scripts/prod.sh

# Или вручную:
docker-compose --env-file web.env up -d --build

# Проверка статуса
docker ps

# Просмотр логов
docker logs -f frontend
docker logs -f frontend-api
docker logs -f budget-api
```

#### Разработка (все компоненты)
```bash
# Быстрый старт (рекомендуется)
./scripts/dev.sh -d

# Или вручную:
cp .env.development .env
docker-compose -f docker-compose.dev.yaml up -d

# Доступные URL:
# Frontend: http://localhost:3000
# Frontend API: http://localhost:4000
# Backend API: http://localhost:8888
# PostgreSQL: localhost:5432
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
├── api/                    # FastAPI backend
│   ├── budget_api.py      # Основное приложение
│   ├── utils/             # Вспомогательные модули
│   └── requirements.txt   # Зависимости
├── frontend/              # React frontend (new)
│   ├── src/              # Исходный код
│   │   ├── components/   # UI компоненты
│   │   ├── pages/       # Страницы приложения
│   │   ├── services/    # API сервисы
│   │   └── stores/      # State management
│   ├── e2e/             # E2E тесты
│   └── package.json     # Зависимости
├── frontend-api/         # Node.js BFF
│   ├── src/             # Исходный код
│   └── package.json     # Зависимости
├── postgresql/            # База данных
│   ├── ddl/             # Схема БД
│   └── backup/          # Скрипты резервного копирования
├── scripts/              # Скрипты миграции
│   └── migration/       # Скрипты развертывания
├── docs/                # Документация
│   ├── UI_MIGRATION_GUIDE.md
│   └── DEPLOYMENT_GUIDE.md
├── .env.example         # Пример переменных окружения
├── .env.development     # Переменные для разработки
├── docker-compose.yaml  # Production конфигурация
└── docker-compose.dev.yaml  # Frontend разработка
```

### Форматирование кода

```bash
# Установка зависимостей для разработки
pip install black flake8

# Форматирование
black . --line-length=180

# Проверка стиля
flake8 . --max-line-length=180
```

### Работа с контейнерами

```bash
# Перезапуск сервиса
sudo docker restart budget-ui

# Просмотр логов
sudo docker logs -f budget-api

# Вход в контейнер
sudo docker exec -it budget-api bash

# Пересборка конкретного сервиса
sudo docker-compose -f docker-compose-dev.yaml build budget-api
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

**Основная таблица:**
- `t_f_registry` - Реестр операций (партиционирована по годам)

### Резервное копирование

Автоматическое резервное копирование настроено через cron:
- PostgreSQL: ежедневно в 00:00
- CouchDB: ежедневно в 01:00

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

- [Development Setup Guide](docs/DEVELOPMENT_SETUP.md) - Настройка окружения разработки
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - Руководство по развертыванию
- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md) - Описание переменных окружения
- [API Optimization Plan](docs/API_OPTIMIZATION_PLAN.md) - План оптимизации API архитектуры
- [Secure API Guide](api/README_SECURE_API.md) - Безопасная версия API
- [UI Migration Guide](docs/UI_MIGRATION_GUIDE.md) - Миграция со Streamlit на React

## 📝 Лицензия

MIT License - см. файл LICENSE для деталей.

## 👥 Авторы

- Ваше имя (@yourusername)

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