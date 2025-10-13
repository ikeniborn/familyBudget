# Family Budget Telegram Bot

Telegram bot для управления семейным бюджетом.

## Установка

### 1. Установите зависимости

```bash
pip install -r requirements.txt
```

### 2. Настройте окружение

Скопируйте `.env.example` в `.env` и заполните значения:

```bash
cp .env.example .env
```

Обязательные параметры:
- `TELEGRAM_BOT_TOKEN` - токен бота от @BotFather
- `BACKEND_API_URL` - URL backend API (по умолчанию: http://localhost:8000/api/v1)

### 3. Запустите бота

```bash
python main.py
```

Или используя Python модуль:

```bash
python -m bot.main
```

## Конфигурация

### Режимы работы

**Polling (по умолчанию):**
```env
USE_WEBHOOK=false
POLL_INTERVAL=1
POLL_TIMEOUT=10
```

**Webhook:**
```env
USE_WEBHOOK=true
WEBHOOK_URL=https://your-domain.com
WEBHOOK_PORT=8443
```

### Логирование

Настройте уровень логирования:
```env
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### Безопасность

Ограничьте доступ к боту определенными пользователями:
```env
ALLOWED_TELEGRAM_IDS=123456789,987654321
```

## Структура проекта

```
bot/
├── config/           # Конфигурация
│   └── settings.py   # Настройки из переменных окружения
├── handlers/         # Обработчики команд (TASK-029, TASK-030...)
├── utils/            # Утилиты
│   ├── logger.py     # Логирование
│   └── api_client.py # HTTP клиент для backend API
├── bot.py            # Инициализация бота
├── main.py           # Точка входа
├── requirements.txt  # Python зависимости
└── .env.example      # Пример конфигурации
```

## Команды (в разработке)

- `/start` - Авторизация и приветствие (TASK-029)
- `/add` - Добавить расход/доход (TASK-030)
- `/today` - Статистика за день (TASK-031)
- `/stats` - Общая статистика (TASK-032)

## Разработка

### Запуск в режиме разработки

```bash
# С подробным логированием
LOG_LEVEL=DEBUG python main.py
```

### Структура кода

- **bot.py**: `BotApplication` класс с инициализацией и управлением жизненным циклом
- **main.py**: Точка входа, graceful shutdown
- **config/settings.py**: Загрузка конфигурации из переменных окружения
- **utils/logger.py**: Настройка логирования
- **utils/api_client.py**: HTTP клиент для взаимодействия с backend

### Добавление новых команд

Новые обработчики команд добавляются в `bot.py` метод `register_handlers()`:

```python
def register_handlers(self):
    from bot.handlers.start import start_handler

    self.application.add_handler(CommandHandler("start", start_handler))
```

## Зависимости

- `python-telegram-bot[ext]==21.0` - Telegram Bot API
- `httpx>=0.24.0` - HTTP клиент
- `python-dotenv>=1.0.0` - Загрузка переменных окружения
- `python-json-logger>=2.0.7` - JSON логирование

## Архитектура

```
┌──────────────┐
│ Telegram Bot │
└──────┬───────┘
       │ (HTTP requests with JWT)
       ↓
┌──────────────┐
│ Backend API  │
│ (FastAPI)    │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ PostgreSQL   │
└──────────────┘
```

Бот взаимодействует с backend API используя JWT токены для аутентификации.
Токены получаются через Telegram OAuth при первом `/start`.

## Следующие шаги

- ✅ TASK-028: Bot initialization (completed)
- ⏭️ TASK-029: `/start` handler с авторизацией
- ⏭️ TASK-030: `/add` command с валидацией
- ⏭️ TASK-031: `/today` статистика
- ⏭️ TASK-032: `/stats` общая аналитика

## Лицензия

Proprietary - Family Budget Project
