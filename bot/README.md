# Family Budget Telegram Bot 🤖

**Version:** 5.0.1
**Phase:** 2 - Telegram Bot + ЦФО/МВЗ Integration

Полнофункциональный Telegram bot для управления семейным бюджетом с поддержкой планирования, финансовых центров (ЦФО), центров возникновения затрат (МВЗ), автоматическими отчетами и уведомлениями.

## ✨ Возможности

### 🎯 8 Основных Команд (Phase 2)

**Аутентификация:**
- `/start` - Авторизация через Telegram OAuth (HMAC-SHA256 валидация)

**Управление транзакциями:**
- `/add` - Добавить транзакцию (расход/доход) с multi-step conversation
  - Выбор типа записи (доход/расход)
  - Выбор статьи бюджета (иерархический справочник)
  - Выбор ЦФО (Financial Center) - опционально
  - Выбор МВЗ (Cost Center) - опционально
  - Ввод суммы, даты, описания
  - Подтверждение и создание

- `/addplan` - Добавить плановую запись бюджета
  - Аналогичный workflow как /add
  - Создает запись с типом "plan" вместо "fact"
  - Планирование бюджета на будущие периоды

- `/edit` - Редактировать или удалить последние 10 транзакций
  - Показывает последние 10 записей пользователя
  - Inline-клавиатура для выбора записи
  - Возможность изменить поля или удалить запись
  - Подтверждение перед удалением

**Аналитика и отчеты:**
- `/summary` - Просмотр итогов план vs факт
  - Выбор периода через inline-клавиатуру
  - Сравнение плановых и фактических показателей
  - Группировка по статьям верхнего уровня
  - Процент выполнения плана
  - Drill-down по категориям

- `/today` - Статистика за сегодня
  - Доходы/расходы за текущий день
  - Список транзакций по типам
  - Индикатор баланса (📈/📉)

- `/stats` - Общая статистика за всё время
  - Общие доходы/расходы/баланс
  - Топ-5 категорий расходов с процентами
  - Все категории доходов с процентами
  - Период покрытия данных

**Настройки:**
- `/settings` - Настройки уведомлений и отчетов
  - Включение/отключение еженедельных отчетов
  - Настройка порога уведомлений о превышении бюджета
  - Конфигурация времени отправки отчетов

### 🤖 Автоматические функции

**Еженедельные отчеты:**
- Автоматическая отправка каждое воскресенье в 20:00
- Сводка план vs факт за прошедшую неделю
- Топ-3 статьи по расходам
- Возможность отключения через `/settings`

**Уведомления о превышении бюджета:**
- Проверка при добавлении каждой транзакции
- Уведомление при превышении 90% плана (настраиваемый порог)
- Показывает статью, план, факт, процент
- Предотвращение дублирования уведомлений

### 🗂️ Дополнительные команды

- `/help` - Справка по всем командам
- `/list` - Список транзакций с пагинацией (10 на страницу)
- `/delete` - Удалить транзакцию по ID (с подтверждением)
- `/search` - Поиск транзакций по описанию или категории
- `/export` - Экспорт транзакций в CSV (UTF-8 с BOM для Excel)

### 🏦 ЦФО/МВЗ Integration (NEW in v5.0.0-beta)

**ЦФО (Финансовые Центры):**
- Отслеживание счетов, кошельков, наличных
- Выбор через inline-клавиатуру при создании транзакции
- Опциональное поле - можно пропустить
- SCD Type 2 поддержка (историческое отслеживание)

**МВЗ (Центры Возникновения Затрат):**
- Отслеживание проектов, отделов, бюджетных групп
- Выбор через inline-клавиатуру при создании транзакции
- Опциональное поле - можно пропустить
- SCD Type 2 поддержка (историческое отслеживание)

**Преимущества:**
- Полная прозрачность расходов по центрам
- Группировка транзакций по финансовым объектам
- Backward compatible (опциональные поля)

## 🚀 Быстрый старт

### Требования

- Python 3.11+
- Backend API запущен (см. `../backend/`)
- Telegram Bot Token (получите у @BotFather)
- PostgreSQL база данных с миграциями

### Установка

1. **Установите зависимости:**
```bash
cd bot/
pip install -r requirements.txt
```

2. **Настройте окружение:**
```bash
cp .env.example .env
```

Отредактируйте `.env`:
```ini
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
ALLOWED_TELEGRAM_IDS=  # Опционально: whitelist (через запятую)

# Backend API
BACKEND_API_URL=http://localhost:8000/api/v1

# Bot Configuration
USE_WEBHOOK=false
POLL_INTERVAL=1
POLL_TIMEOUT=30
LOG_LEVEL=INFO
```

3. **Запустите backend API** (если еще не запущен):
```bash
cd ../backend/
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

4. **Запустите бота:**
```bash
python main.py
```

Для debug-режима:
```bash
LOG_LEVEL=DEBUG python main.py
```

### Первый запуск

1. Откройте Telegram и найдите вашего бота
2. Отправьте `/start` для авторизации
3. После успешной авторизации появятся все команды
4. Протестируйте `/add` для создания первой транзакции
5. Используйте `/summary` для просмотра статистики

## 📁 Архитектура проекта

```
bot/
├── config/
│   └── settings.py              # Конфигурация (Pydantic Settings)
├── handlers/
│   ├── start.py                 # /start - OAuth аутентификация
│   ├── add.py                   # /add - Добавление транзакции (35KB)
│   ├── add_plan.py              # /addplan - Добавление плана (24KB)
│   ├── summary.py               # /summary - План vs факт (16KB)
│   ├── edit.py                  # /edit - Редактирование (25KB)
│   ├── today.py                 # /today - Статистика за день
│   ├── stats.py                 # /stats - Общая статистика
│   ├── settings.py              # /settings - Настройки (13KB)
│   ├── help.py                  # /help - Справка
│   ├── list.py                  # /list - Список с пагинацией
│   ├── delete.py                # /delete - Удаление транзакции
│   ├── search.py                # /search - Поиск
│   └── export.py                # /export - Экспорт в CSV
├── utils/
│   ├── api_client.py            # HTTP клиент для Backend API (httpx)
│   ├── session.py               # Управление JWT токенами
│   ├── telegram_auth.py         # OAuth HMAC-SHA256 валидация
│   ├── scheduler.py             # APScheduler для еженедельных отчетов
│   ├── notification_service.py  # Уведомления о превышении бюджета
│   ├── logger.py                # Структурированное логирование
│   └── validators.py            # Валидация пользовательского ввода
├── jobs/
│   └── weekly_report.py         # Задача еженедельного отчета
├── tests/
│   └── integration/             # Интеграционные тесты бота
├── bot.py                       # Основной класс BotApplication
├── main.py                      # Точка входа + graceful shutdown
├── requirements.txt             # Python зависимости
├── .env.example                 # Шаблон конфигурации
├── .gitignore                   # Git ignore правила
└── README.md                    # Этот файл
```

### Ключевые компоненты

**BotApplication (bot.py):**
- Инициализация Telegram Application
- Регистрация всех handlers
- Настройка scheduler для автоматических задач
- Error handling
- Graceful shutdown

**Scheduler (utils/scheduler.py):**
- APScheduler для фоновых задач
- Еженедельные отчеты (CronTrigger: воскресенье 20:00)
- Timezone-aware (UTC)

**Notification Service (utils/notification_service.py):**
- Проверка превышения бюджета в реальном времени
- Дедупликация уведомлений
- Настраиваемые пороги

**API Client (utils/api_client.py):**
- Async httpx client
- JWT аутентификация через cookies
- Retry logic с экспоненциальной задержкой
- Централизованная обработка ошибок

## 📊 Детали команд

### /start - Авторизация

**Workflow:**
1. Пользователь отправляет `/start`
2. Бот запрашивает Telegram OAuth данные (id, first_name, username, auth_date, hash)
3. Валидация HMAC-SHA256 hash
4. Создание/обновление пользователя в БД
5. Получение JWT токена
6. Сохранение токена в `context.user_data`

**Безопасность:**
- HMAC-SHA256 валидация согласно Telegram документации
- JWT токены с 7-дневным сроком действия
- HTTP-only cookies на backend

### /add - Добавить транзакцию

**Multi-step Conversation (ConversationHandler):**
1. **RECORD_TYPE**: Выбор типа (доход/расход) через inline-клавиатуру
2. **ARTICLE**: Выбор статьи бюджета (иерархический справочник)
3. **FINANCIAL_CENTER**: Выбор ЦФО (опционально, можно пропустить)
4. **COST_CENTER**: Выбор МВЗ (опционально, можно пропустить)
5. **AMOUNT**: Ввод суммы (валидация: положительное число, до 2 знаков)
6. **DATE**: Ввод даты (форматы: "сегодня", "вчера", "13.10", "13.10.2025")
7. **DESCRIPTION**: Ввод описания (опционально)
8. **CONFIRMATION**: Подтверждение и создание

**Возможности:**
- Отмена на любом шаге (`/cancel`)
- Валидация на каждом шаге
- Inline-клавиатуры для выбора
- Пропуск опциональных полей (кнопка "Пропустить")
- Предпросмотр перед созданием

### /addplan - Добавить план

**Аналогичный workflow как /add:**
- Те же шаги, но создает запись с `record_type="plan"`
- Используется для планирования бюджета на будущие периоды
- Позволяет создавать несколько плановых записей на один период

### /summary - План&Факт

**Multi-step Conversation:**
1. **PERIOD_SELECTION**: Выбор периода через inline-клавиатуру
   - Текущий месяц
   - Текущий квартал
   - Текущий год
   - Пользовательский период
2. **CUSTOM_DATES** (если выбран custom): Ввод начальной и конечной даты
3. **DISPLAY_SUMMARY**: Отображение сводки

**Отображаемые данные:**
- Таблица план vs факт по статьям верхнего уровня
- Отклонение (абсолютное и процентное)
- Прогресс-бары для визуализации
- Drill-down: клик на категорию показывает подкатегории

### /edit - Редактировать/Удалить

**Multi-step Conversation:**
1. **SELECT_TRANSACTION**: Показывает последние 10 транзакций пользователя
2. **EDIT_MENU**: Меню действий (изменить сумму/дату/описание/удалить)
3. **EDIT_FIELD**: Ввод нового значения (в зависимости от выбора)
4. **CONFIRMATION**: Подтверждение изменений или удаления

**Безопасность:**
- Пользователь видит только свои транзакции
- Нельзя редактировать чужие записи
- Подтверждение перед удалением

### /settings - Настройки

**Меню настроек (inline-клавиатура):**
1. **Еженедельные отчеты**: Вкл/Выкл
2. **Уведомления о бюджете**: Вкл/Выкл
3. **Порог уведомления**: 80% / 90% / 100%
4. **Время отчета**: 20:00 / 21:00 / 22:00 (воскресенье)

**Хранение:**
- Настройки в `context.user_data`
- Персистентность через `persistence` в Application

## 🔧 Конфигурация

### Переменные окружения

| Переменная | Обязательна | По умолчанию | Описание |
|-----------|------------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | ✅ | - | Токен от @BotFather |
| `ALLOWED_TELEGRAM_IDS` | ❌ | `` | User IDs whitelist (через запятую) |
| `BACKEND_API_URL` | ✅ | `http://localhost:8000/api/v1` | Backend API URL |
| `USE_WEBHOOK` | ❌ | `false` | Webhook mode (вместо polling) |
| `WEBHOOK_URL` | ❌ | `` | Public webhook URL |
| `WEBHOOK_LISTEN` | ❌ | `0.0.0.0` | Webhook listen address |
| `WEBHOOK_PORT` | ❌ | `8443` | Webhook port |
| `POLL_INTERVAL` | ❌ | `1` | Polling interval (секунды) |
| `POLL_TIMEOUT` | ❌ | `30` | Polling timeout (секунды) |
| `LOG_LEVEL` | ❌ | `INFO` | Logging level (DEBUG/INFO/WARNING/ERROR) |

### Настройка Webhook (опционально)

Для production рекомендуется использовать webhook вместо polling:

1. Настройте reverse proxy (nginx):
```nginx
location /bot {
    proxy_pass http://localhost:8443;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

2. Получите SSL сертификат (Let's Encrypt)

3. Настройте `.env`:
```ini
USE_WEBHOOK=true
WEBHOOK_URL=https://yourdomain.com/bot
WEBHOOK_PORT=8443
```

## 🔒 Безопасность

**Аутентификация:**
- Telegram OAuth с HMAC-SHA256 валидацией
- JWT токены с ограниченным сроком действия (7 дней)
- HTTP-only cookies на backend
- Refresh token механизм (в разработке - TASK-020)

**Изоляция данных:**
- Пользователи видят только свои данные
- Backend контролирует доступ на уровне API
- Опциональный whitelist через `ALLOWED_TELEGRAM_IDS`

**Валидация ввода:**
- Весь пользовательский ввод валидируется
- Защита от SQL injection (ORM)
- Защита от XSS (Telegram автоматически экранирует)

**Error handling:**
- Graceful degradation при ошибках API
- Понятные сообщения об ошибках для пользователя
- Детальные логи для разработчика
- Сокрытие чувствительной информации

## 🛠️ Разработка

### Добавление новой команды

1. **Создайте handler в `bot/handlers/`:**

```python
from telegram import Update
from telegram.ext import ContextTypes
from bot.utils.session import SessionManager
from bot.utils.logger import get_logger

logger = get_logger(__name__)

async def my_command_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler for /mycommand"""
    # Проверка аутентификации
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text("❌ Требуется авторизация. Отправьте /start")
        return

    # Получение токена
    token = SessionManager.get_token(context)

    # Ваша бизнес-логика
    try:
        # Пример запроса к API
        from bot.utils.api_client import get_api_client
        api_client = await get_api_client()
        response = await api_client.get("/endpoint", token=token)

        await update.message.reply_text(f"✅ Результат: {response}")
    except Exception as e:
        logger.error(f"Error in my_command: {e}")
        await update.message.reply_text("❌ Произошла ошибка")
```

2. **Зарегистрируйте в `bot/bot.py`:**

```python
from bot.handlers.my_command import my_command_handler

# В методе register_handlers():
self.application.add_handler(CommandHandler("mycommand", my_command_handler))
logger.info("Registered /mycommand handler")
```

### Создание ConversationHandler

Для multi-step команд:

```python
from telegram.ext import ConversationHandler, CommandHandler, MessageHandler, filters

# Определите состояния
STATE1, STATE2, STATE3 = range(3)

async def start_conversation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Entry point"""
    await update.message.reply_text("Шаг 1: Введите значение")
    return STATE1

async def process_state1(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Process STATE1"""
    value = update.message.text
    context.user_data['value1'] = value

    await update.message.reply_text("Шаг 2: Введите еще одно значение")
    return STATE2

async def process_state2(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Process STATE2"""
    value = update.message.text
    context.user_data['value2'] = value

    # Финализация
    await update.message.reply_text("✅ Готово!")
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel conversation"""
    await update.message.reply_text("❌ Отменено")
    return ConversationHandler.END

# Создайте ConversationHandler
my_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("mycommand", start_conversation)],
    states={
        STATE1: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_state1)],
        STATE2: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_state2)],
    },
    fallbacks=[CommandHandler("cancel", cancel)],
    name="my_conversation",
    persistent=False
)
```

### Тестирование

**Валидация синтаксиса:**
```bash
python3 -m py_compile bot/handlers/*.py
python3 -m py_compile bot/utils/*.py
python3 -m py_compile bot/*.py
```

**Интеграционные тесты:**
```bash
cd bot/tests/integration/
pytest -v
```

**Ручное тестирование:**
1. Запустите backend: `cd backend && uvicorn backend.app.main:app --reload`
2. Запустите бота: `cd bot && python main.py`
3. Откройте Telegram и найдите бота
4. Протестируйте каждую команду

**Тестирование с mock API:**
```python
# tests/integration/test_handlers.py
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_add_command():
    with patch('bot.utils.api_client.get_api_client') as mock_client:
        mock_client.return_value.post = AsyncMock(return_value={"id": 1})
        # Ваши тесты
```

### Логирование

**Структурированное логирование:**

```python
from bot.utils.logger import get_logger

logger = get_logger(__name__)

# Уровни логирования
logger.debug("Детальная информация")
logger.info("Общая информация")
logger.warning("Предупреждение")
logger.error("Ошибка", exc_info=True)

# С контекстом
logger.info(f"User {user_id} created transaction {transaction_id}")
```

**Уровни логирования:**
- `DEBUG`: Все запросы к API, детали conversation state
- `INFO`: Старт/стоп бота, выполнение команд
- `WARNING`: Некритичные ошибки, retry attempts
- `ERROR`: Критичные ошибки, exceptions

**Настройка уровня:**
```bash
LOG_LEVEL=DEBUG python main.py
```

## 🚨 Troubleshooting

### Бот не отвечает

**Проверьте:**
1. Правильность `TELEGRAM_BOT_TOKEN` в `.env`
2. Backend API запущен и доступен (`curl http://localhost:8000/health`)
3. Логи бота на наличие ошибок
4. Пользователь в `ALLOWED_TELEGRAM_IDS` (если настроено)
5. Интернет-соединение (для Telegram API)

### Авторизация не работает

**Проверьте:**
1. Backend endpoint `/api/v1/auth/telegram` доступен
2. `TELEGRAM_BOT_TOKEN` совпадает в backend и боте
3. Логи backend (HMAC валидация может падать)
4. Время на сервере синхронизировано (важно для OAuth)

### Команды возвращают ошибки

**Проверьте:**
1. Доступность backend API из бота
2. Валидность JWT токена (срок действия 7 дней)
3. Права доступа пользователя (is_admin для админских команд)
4. Логи backend для деталей ошибки
5. Сеть между ботом и backend

### Еженедельные отчеты не приходят

**Проверьте:**
1. Scheduler запущен (логи при старте бота)
2. Настройки пользователя (`/settings` → еженедельные отчеты включены)
3. Логи scheduler (ошибки выполнения задачи)
4. Timezone настроен правильно (UTC по умолчанию)

### Уведомления о превышении не приходят

**Проверьте:**
1. Notification service инициализирован (логи при старте)
2. Настройки пользователя (`/settings` → уведомления включены)
3. Порог превышения (по умолчанию 90%)
4. Логи notification service

## 📈 Метрики и статистика

**Размер кодовой базы:**
- **Всего:** ~4,500 LOC
- **Handlers:** ~3,800 LOC (13 файлов)
- **Utils:** ~500 LOC (7 файлов)
- **Config & Main:** ~200 LOC

**Реализовано:**
- **Команд:** 13 (8 основных + 5 дополнительных)
- **Conversation Handlers:** 8 multi-step потоков
- **Автоматических задач:** 2 (еженедельные отчеты, уведомления)
- **API интеграций:** 15+ endpoints
- **Тестов:** Валидация синтаксиса 100%

**Dependencies:**
- `python-telegram-bot` 20.x - Telegram Bot API wrapper
- `httpx` - Async HTTP клиент
- `python-dotenv` - Environment management
- `pydantic-settings` - Type-safe configuration
- `APScheduler` - Background jobs

## 📚 Дополнительные ресурсы

**Документация проекта:**
- [Main README](../README.md) - Обзор всего проекта
- [Backend API Documentation](../docs/api/API_DOCUMENTATION.md) - API reference
- [PRD](../docs/prd/README.md) - Product Requirements
- [CHANGELOG](../CHANGELOG.md) - История изменений

**Telegram Bot API:**
- [Official Documentation](https://core.telegram.org/bots/api)
- [python-telegram-bot Docs](https://docs.python-telegram-bot.org/)
- [Telegram Bot FAQ](https://core.telegram.org/bots/faq)

**Best Practices:**
- Используйте ConversationHandler для multi-step команд
- Всегда валидируйте пользовательский ввод
- Обрабатывайте ошибки gracefully
- Логируйте все важные события
- Тестируйте каждую команду перед деплоем

## 🎉 Roadmap

**v5.1.0 (Planned - ЭТАП 3):**
- [ ] JWT Refresh Token mechanism (TASK-020)
- [ ] Enhanced export functionality (PDF, Excel) (TASK-022)
- [ ] Admin dashboard analytics (TASK-021)

**v5.2.0 (Planned - ЭТАП 5):**
- [ ] Multi-currency support (TASK-023)
- [ ] Custom report builder
- [ ] Budget templates

**v6.0.0 (Future):**
- [ ] Machine learning budget predictions
- [ ] OCR receipt scanning
- [ ] Multi-user family budgets
- [ ] Mobile app integration

## 📄 Лицензия

Часть проекта Family Budget.

---

**🤖 Создано с помощью [Claude Code](https://claude.com/claude-code)**

Co-Authored-By: Claude <noreply@anthropic.com>
