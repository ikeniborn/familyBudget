# Family Budget Management System

Система управления семейным бюджетом с интеграцией Google Sheets и Telegram.

## Описание

Микросервисное приложение для учета семейных финансов с возможностью:
- Многопользовательского доступа через Telegram авторизацию
- Интеграции с Google Sheets для визуализации данных
- Автоматизации отчетности через Google Apps Script
- Уведомлений через Telegram бота

## Технологический стек

- **Backend**: FastAPI (Python 3.x) с JWT аутентификацией
- **Frontend**: Streamlit с Telegram OAuth
- **Базы данных**: PostgreSQL, CouchDB
- **Кэширование**: Redis с настраиваемым TTL
- **Инфраструктура**: Docker, Docker Compose, Traefik
- **SSL/TLS**: Let's Encrypt (автоматическое обновление)
- **Интеграции**: Google Apps Script, Telegram API, Trello API

## Быстрый старт

### Требования
- Docker и Docker Compose
- 2GB свободной памяти
- Порты: 80, 443, 5432, 5984, 8501, 8888

### Установка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd familyBudget
```

2. Создайте файл окружения:
```bash
cp .env.example .env
# Отредактируйте .env с вашими настройками
# Обязательно укажите TRAEFIK_DOMAIN и ACME_EMAIL
```

3. Запустите приложение:
```bash
cd web
docker-compose up -d
```

4. Проверьте статус:
```bash
docker-compose ps
docker-compose logs -f
```

### Доступ к сервисам

- **UI**: https://budget.yourdomain.com
- **API**: https://api.yourdomain.com/docs
- **CouchDB**: https://notes.yourdomain.com
- **Traefik Dashboard**: https://traefik.yourdomain.com

## Архитектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Traefik   │────▶│ Streamlit UI│────▶│ FastAPI API │
│  (SSL/TLS)  │     │   (:8501)   │     │   (:8888)   │
│ Let's Encrypt│     └─────────────┘     └─────────────┘
└─────────────┘                                │
       │                                       ├─────────────┐
       │            ┌─────────────┐            │             │
       └───────────▶│  PostgreSQL  │◀───────────┘     ┌──────▼──────┐
                    │   (:5432)    │                   │    Redis    │
                    └─────────────┘                   │   (:6379)   │
                                                      └─────────────┘
```

## Структура проекта

```
familyBudget/
├── api/                   # FastAPI backend
├── app/budget/            # Streamlit frontend
├── db/                    # Конфигурации БД
├── service/               # Traefik и сервисы
├── docker-compose.yaml    # Основная конфигурация
├── .env.example           # Пример переменных окружения
├── google/                 # Google Apps Script
│   └── src/               # Исходники GAS
├── home/                   # Домашние скрипты
└── pihome/                # Raspberry Pi конфигурации
```

## Разработка

### Локальная разработка
```bash
# Запуск в режиме разработки
docker-compose -f docker-compose-dev.yaml up -d

# Просмотр логов
docker-compose logs -f budget-api
docker-compose logs -f budget-ui
docker-compose logs -f traefik

# Форматирование кода
black . --line-length=180

# Генерация пароля для Traefik dashboard
./service/traefik/generate-password.sh admin yourpassword
```

### База данных
```bash
# Подключение к PostgreSQL
psql -h localhost -p 5432 -U budget -d budgetdb

# Бэкап базы данных
cd web/db/postgresql/backup
./postgres-backup.sh
```

## Конфигурация

### Основные переменные окружения

```env
# PostgreSQL
POSTGRES_DB=budgetdb
POSTGRES_USER=budget
POSTGRES_PASSWORD=your_password

# Traefik
TRAEFIK_DOMAIN=yourdomain.com
ACME_EMAIL=your-email@example.com

# API
API_URL=https://api.yourdomain.com
JWT_SECRET_KEY=your-secret-key

# Telegram
TELEGRAM_BOT_TOKEN=your_token
```

## Безопасность

- Все сервисы работают в изолированной Docker сети
- Автоматический SSL/TLS через Traefik с Let's Encrypt
- Двухфакторная аутентификация: Telegram OAuth + JWT токены
- Rate limiting для защиты API
- Security headers для всех сервисов
- Ограничения ресурсов для каждого контейнера
- Все секреты вынесены в единый .env файл

## Мониторинг

- Healthcheck для всех сервисов
- Traefik dashboard с метриками
- Структурированные логи для всех сервисов
- Docker logs централизованы

## Лицензия

Proprietary - All rights reserved