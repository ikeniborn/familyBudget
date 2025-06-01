# Family Budget Management System

Система управления семейным бюджетом с интеграцией Google Sheets и Telegram.

## Описание

Микросервисное приложение для учета семейных финансов с возможностью:
- Многопользовательского доступа через Telegram авторизацию
- Интеграции с Google Sheets для визуализации данных
- Автоматизации отчетности через Google Apps Script
- Уведомлений через Telegram бота

## Технологический стек

- **Backend**: FastAPI (Python 3.x)
- **Frontend**: Streamlit
- **Базы данных**: PostgreSQL, CouchDB
- **Инфраструктура**: Docker, Docker Compose, HAProxy
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
cp web/web.env.example web/web.env
# Отредактируйте web/web.env с вашими настройками
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
- **API**: https://budget.yourdomain.com:8888/docs
- **CouchDB**: https://notes.yourdomain.com
- **HAProxy Stats**: https://haproxy.yourdomain.com/stats

## Архитектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   HAProxy   │────▶│ Streamlit UI│────▶│ FastAPI API │
│   (SSL)     │     │   (:8501)   │     │   (:8888)   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌─────────────┐            │
                    │  PostgreSQL  │◀───────────┘
                    │   (:5432)    │
                    └─────────────┘
```

## Структура проекта

```
familyBudget/
├── web/                    # Основное веб-приложение
│   ├── api/               # FastAPI backend
│   ├── app/budget/        # Streamlit frontend
│   ├── db/                # Конфигурации БД
│   ├── service/           # HAProxy и сервисы
│   └── docker-compose.yaml
├── google/                 # Google Apps Script
│   └── src/               # Исходники GAS
├── home/                   # Домашние скрипты
└── pihome/                # Raspberry Pi конфигурации
```

## Разработка

### Локальная разработка
```bash
# Запуск в режиме разработки
cd web
docker-compose -f docker-compose-dev.yaml up -d

# Просмотр логов
docker-compose logs -f budget-api
docker-compose logs -f budget-ui

# Форматирование кода
black . --line-length=180
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

# API
API_URL=http://10.5.0.3:8888

# Telegram
TELEGRAM_BOT_TOKEN=your_token
```

## Безопасность

- Все сервисы работают в изолированной Docker сети
- SSL/TLS через HAProxy с Let's Encrypt
- Авторизация через Telegram OAuth
- Ограничения ресурсов для каждого контейнера

## Мониторинг

- Healthcheck для всех сервисов
- HAProxy statistics dashboard
- Docker logs централизованы

## Лицензия

Proprietary - All rights reserved