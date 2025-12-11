# Bot Refactoring Plan

**Дата анализа:** 2025-12-09
**Версия:** 1.0
**Статус:** Draft
**Автор:** Claude Code Analysis

---

## Содержание

1. [Обзор](#обзор)
2. [Критические проблемы](#критические-проблемы)
3. [Легаси код](#легаси-код)
4. [Дублирование кода](#дублирование-кода)
5. [План рефакторинга](#план-рефакторинга)
6. [Детальные задачи](#детальные-задачи)
7. [Риски и митигация](#риски-и-митигация)

---

## Обзор

### Анализируемая кодовая база

```
bot/
├── bot.py                    # Инициализация приложения (312 строк)
├── main.py                   # Entry point (111 строк)
├── config/
│   └── settings.py           # Конфигурация (94 строки)
├── handlers/
│   ├── add_plan.py           # /addplan command (726 строк)
│   ├── delete.py             # /delete command (289 строк)
│   ├── edit.py               # /edit command (755 строк)
│   ├── export.py             # /export command (193 строки)
│   ├── help.py               # /help command (146 строк)
│   ├── list.py               # /list command (318 строк)
│   ├── search.py             # /search command (250 строк)
│   ├── settings.py           # /settings command (403 строки)
│   ├── start.py              # /start command (212 строк)
│   ├── summary.py            # /summary command (496 строк)
│   └── today.py              # /today command (229 строк)
├── jobs/
│   └── weekly_report.py      # Weekly report job (254 строки)
└── utils/
    ├── api_client.py         # Backend API client (788 строк)
    ├── logger.py             # Logging configuration (71 строка)
    ├── notification_service.py # Notifications (294 строки)
    ├── scheduler.py          # APScheduler (196 строк)
    ├── session.py            # Session management (157 строк)
    ├── telegram_auth.py      # Telegram OAuth (153 строки)
    └── validators.py         # Input validation (355 строк)
```

**Общий объём:** ~5,600 строк кода

### Статус кодовой базы

| Аспект | Оценка | Комментарий |
|--------|--------|-------------|
| Безопасность | ✅ Хорошо | HMAC-SHA256, JWT, правильная авторизация |
| Структура | ✅ Хорошо | Чёткое разделение на handlers/utils/jobs |
| DRY principle | ⚠️ Требует улучшения | Значительное дублирование кода |
| Тестируемость | ⚠️ Средне | Сложные зависимости в handlers |
| Документация | ✅ Хорошо | Docstrings во всех модулях |

---

## Критические проблемы

### CRIT-001: Отсутствует файл `handlers/add.py`

**Серьёзность:** 🔴 Критическая
**Файл:** `bot/handlers/add_plan.py:221`

**Описание:**
Модуль `add_plan.py` импортирует функцию из несуществующего файла:

```python
# add_plan.py:221
from bot.handlers.add import build_article_keyboard
```

**Последствия:**
- `ImportError` при выполнении команды `/addplan`
- Бот не может создавать бюджетные планы
- RuntimeError в production

**Решение:**
Создать файл `bot/handlers/add.py` с функцией `build_article_keyboard()` или перенести функцию в `utils/keyboards.py`.

**Приоритет:** P0 — исправить немедленно

---

### CRIT-002: Pagination offset не работает в `/list`

**Серьёзность:** 🔴 Высокая
**Файлы:** `bot/handlers/list.py:91-95`, `bot/utils/api_client.py:122-172`

**Описание:**
Handler передаёт `offset` параметр, но API client его игнорирует:

```python
# list.py:91-95
response = await api_client.list_facts(
    token=token,
    limit=PAGE_SIZE,
    offset=offset  # <-- Не используется!
)

# api_client.py:147-155 - offset НЕ передаётся в params
params = {}
if date_from:
    params["date_from"] = date_from
# ... offset отсутствует
```

**Последствия:**
- Пагинация в `/list` не работает
- Всегда показывается первая страница
- UX проблема для пользователей с большим количеством транзакций

**Решение:**
Добавить `offset` параметр в `api_client.list_facts()`:

```python
if offset:
    params["offset"] = offset
```

**Приоритет:** P0 — исправить немедленно

---

## Легаси код

### LEGACY-001: Устаревший menu_callback_handler

**Серьёзность:** 🟡 Средняя
**Файлы:** `bot/handlers/start.py:197-212`, `bot/bot.py:95-96`

**Описание:**
Handler помечен как устаревший, но всё ещё регистрируется:

```python
# start.py:197-211
async def menu_callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Legacy menu callback handler - no longer used.
    Inline keyboard menu was replaced with Telegram Menu Button (WebApp).
    """
    # ...

# bot.py:95-96
self.application.add_handler(CallbackQueryHandler(menu_callback_handler, pattern="^menu:"))
```

**Рекомендация:**
Удалить handler и регистрацию. WebApp полностью заменил inline menu.

**Действия:**
1. Удалить `menu_callback_handler()` из `start.py`
2. Удалить регистрацию из `bot.py:95-96`
3. Удалить импорт `menu_callback_handler` из `bot.py:78`

---

### LEGACY-002: Неактивный weekly_report job

**Серьёзность:** 🟢 Низкая
**Файл:** `bot/jobs/weekly_report.py:42-67`

**Описание:**
Функция содержит early return, делая 200+ строк недостижимыми:

```python
async def send_weekly_reports(bot: Bot, user_telegram_ids: List[int] = None):
    logger.debug("Weekly report job skipped - feature not implemented...")
    return  # <-- Всё ниже недостижимо

    # 200+ строк preserved for future development
```

**Рекомендация:**
Оставить как есть если планируется реализация. Scheduler запускает задачу и логирует debug — это не влияет на работу бота.

**Альтернатива:**
Вынести недостижимый код в отдельный файл `weekly_report_draft.py` или добавить в документацию.

---

## Дублирование кода

### DUP-001: Проверка аутентификации (12+ мест)

**Серьёзность:** 🟡 Средняя
**Затронутые файлы:** Все handlers

**Текущее состояние:**

```python
# Повторяется в каждом handler:
if not SessionManager.is_authenticated(context):
    await update.message.reply_text(
        "❌ Требуется авторизация.\n\n"
        "Используйте /start для входа в систему."
    )
    logger.warning(f"Unauthenticated /command attempt from user {user.id}")
    return ConversationHandler.END
```

**Решение:**
Создать декоратор `@require_auth` в `utils/session.py`:

```python
import functools
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

def require_auth(func):
    """
    Decorator for handlers requiring authentication.

    Usage:
        @require_auth
        async def my_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
            # Handler code - user is guaranteed to be authenticated
            pass
    """
    @functools.wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user

        if not SessionManager.is_authenticated(context):
            await update.message.reply_text(
                "❌ Требуется авторизация.\n\n"
                "Используйте /start для входа в систему."
            )
            if user:
                logger.warning(f"Unauthenticated attempt from user {user.id}")
            return ConversationHandler.END

        return await func(update, context)

    return wrapper
```

**Использование после рефакторинга:**

```python
from bot.utils.session import require_auth

@require_auth
async def today_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Код без проверки аутентификации — декоратор сделал это
    user = update.effective_user
    logger.info(f"/today command from user {user.id}")
    # ...
```

---

### DUP-002: validate_date дублирование

**Серьёзность:** 🟡 Средняя
**Файлы:** `utils/validators.py:115-223`, `handlers/add_plan.py:61-162`

**Описание:**
`validate_plan_date()` копирует 70% кода из `validate_date()`. Единственное отличие — разрешение будущих дат.

**Решение:**
Рефакторинг `validate_date()` с параметром:

```python
def validate_date(
    date_str: str,
    allow_future: bool = False,
    max_future_years: int = 5
) -> date:
    """
    Validate and parse date input.

    Args:
        date_str: User input string
        allow_future: Allow future dates (default: False)
        max_future_years: Max years in future if allow_future=True (default: 5)

    Returns:
        date: Validated date object
    """
    # ... existing parsing logic ...

    # Validate: future dates
    if not allow_future and parsed_date > today:
        raise ValidationError(
            "❌ Дата не может быть в будущем",
            field="date"
        )

    if allow_future and parsed_date > today + timedelta(days=365 * max_future_years):
        raise ValidationError(
            f"❌ Дата плана не может быть более {max_future_years} лет вперед",
            field="date"
        )

    return parsed_date
```

**Использование:**

```python
# В add_plan.py
plan_date = validate_date(user_input, allow_future=True, max_future_years=5)

# В других handlers (факты)
fact_date = validate_date(user_input)  # allow_future=False по умолчанию
```

---

### DUP-003: warnings.filterwarnings в 7 файлах

**Серьёзность:** 🟢 Низкая
**Файлы:** add_plan.py, summary.py, list.py, delete.py, edit.py, settings.py, search.py

**Текущее состояние:**

```python
import warnings

# Suppress PTBUserWarning for per_message=False with CallbackQueryHandler
warnings.filterwarnings("ignore", message=".*per_message.*CallbackQueryHandler.*", category=UserWarning)
```

**Решение:**
Централизовать в `handlers/__init__.py`:

```python
# handlers/__init__.py
"""
Telegram bot command handlers.

Suppresses PTBUserWarning for ConversationHandlers using per_message=False.
"""
import warnings

warnings.filterwarnings(
    "ignore",
    message=".*per_message.*CallbackQueryHandler.*",
    category=UserWarning
)
```

Удалить из всех handler файлов.

---

### DUP-004: API client методы

**Серьёзность:** 🟢 Низкая
**Файл:** `utils/api_client.py`

**Дублирующиеся методы:**
- `get_user_facts()` (174-220) ≈ `list_facts()` (122-172)
- `get_articles()` (328-370) ≈ `list_articles()` (372-410)

**Решение:**
Удалить `get_user_facts()`, использовать `list_facts()` везде. Аналогично для articles.

---

### DUP-005: Форматирование транзакций

**Серьёзность:** 🟢 Низкая
**Файлы:** edit.py, list.py, search.py, today.py

**Решение:**
Создать `utils/formatters.py`:

```python
"""
Formatting utilities for bot messages.
"""
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional

from bot.utils.validators import format_amount, format_date


def format_fact_line(
    fact: Dict,
    article: Dict,
    show_id: bool = True,
    show_description: bool = True
) -> str:
    """
    Format single fact for display.

    Args:
        fact: Fact dictionary from API
        article: Article dictionary from API
        show_id: Include fact ID in output
        show_description: Include description in output

    Returns:
        str: Formatted fact line (Markdown)
    """
    fact_id = fact.get("id")
    fact_date_str = fact.get("fact_date", "")
    amount = Decimal(str(fact.get("amount", "0")))
    description = fact.get("description", "")

    article_name = article.get("name", f"Article #{fact.get('article_id')}")
    article_type = article.get("type", "unknown")
    record_type = fact.get("record_type", "fact")

    # Format date
    try:
        date_obj = date.fromisoformat(fact_date_str)
        formatted_date = format_date(date_obj)
    except (ValueError, TypeError):
        formatted_date = fact_date_str[:10]

    # Emojis
    type_emoji = "💵" if article_type == "income" else "💸"
    record_marker = "📅" if record_type == "plan" else ""

    # Build line
    line = f"{record_marker}{type_emoji} **{formatted_date}** | {article_name}: {format_amount(abs(amount))} ₽"

    if show_description and description:
        line += f"\n   _{description}_"

    if show_id:
        line += f"\n   `ID: {fact_id}`"

    return line


def format_facts_list(
    facts: List[Dict],
    articles_map: Dict[int, Dict],
    title: str = "📝 **Список фактов**",
    show_pagination: bool = False,
    page: int = 0,
    total: int = 0,
    page_size: int = 10
) -> str:
    """
    Format list of facts for display.

    Args:
        facts: List of fact dictionaries
        articles_map: Article lookup map {id: article}
        title: Message title
        show_pagination: Show pagination info
        page: Current page (0-indexed)
        total: Total facts count
        page_size: Items per page

    Returns:
        str: Formatted message (Markdown)
    """
    message_parts = [title]

    if show_pagination and total > 0:
        start = page * page_size + 1
        end = min((page + 1) * page_size, total)
        message_parts.append(f"_Показано {start}-{end} из {total}_")

    message_parts.append("")

    for fact in facts:
        article_id = fact.get("article_id")
        article = articles_map.get(article_id, {})
        message_parts.append(format_fact_line(fact, article))
        message_parts.append("")

    return "\n".join(message_parts)
```

---

## План рефакторинга

### Фаза 1: Критические исправления (P0)

| ID | Задача | Файлы | Оценка |
|----|--------|-------|--------|
| CRIT-001 | Создать `handlers/add.py` | add.py, add_plan.py | 2-4 часа |
| CRIT-002 | Исправить pagination offset | api_client.py, list.py | 30 мин |

### Фаза 2: Легаси код (P1)

| ID | Задача | Файлы | Оценка |
|----|--------|-------|--------|
| LEGACY-001 | Удалить menu_callback_handler | start.py, bot.py | 15 мин |

### Фаза 3: Дублирование (P2)

| ID | Задача | Файлы | Оценка |
|----|--------|-------|--------|
| DUP-001 | Создать @require_auth декоратор | session.py, все handlers | 2 часа |
| DUP-002 | Рефакторинг validate_date | validators.py, add_plan.py | 1 час |
| DUP-003 | Централизовать warnings | handlers/__init__.py | 30 мин |

### Фаза 4: Оптимизация (P3)

| ID | Задача | Файлы | Оценка |
|----|--------|-------|--------|
| DUP-004 | Удалить дублирующие методы API | api_client.py | 1 час |
| DUP-005 | Создать utils/formatters.py | formatters.py, handlers | 3 часа |

---

## Детальные задачи

### Задача: CRIT-001 — Создание handlers/add.py

**Файл:** `bot/handlers/add.py`

**Минимальная реализация:**

```python
"""
/add command handler for adding facts (income/expense).

Implements multi-step conversation flow for adding facts:
1. Article selection (inline keyboard)
2. Amount input (with validation)
3. Date input (with validation)
4. Description input (optional)
5. Financial/Cost center selection (optional)
6. Confirmation
"""
import warnings

warnings.filterwarnings("ignore", message=".*per_message.*CallbackQueryHandler.*", category=UserWarning)

from typing import Dict, List

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager

logger = get_logger(__name__)


def build_article_keyboard(articles: List[Dict]) -> InlineKeyboardMarkup:
    """
    Build inline keyboard for article selection.

    Groups articles by type (income/expense) with headers.

    Args:
        articles: List of article dictionaries from API

    Returns:
        InlineKeyboardMarkup: Keyboard with article buttons
    """
    keyboard = []

    # Group by type
    income_articles = [a for a in articles if a.get("type") == "income"]
    expense_articles = [a for a in articles if a.get("type") == "expense"]

    # Income section
    if income_articles:
        keyboard.append([
            InlineKeyboardButton("💵 ДОХОДЫ", callback_data="header:income")
        ])
        for article in income_articles:
            keyboard.append([
                InlineKeyboardButton(
                    f"  {article['name']}",
                    callback_data=f"article:{article['id']}"
                )
            ])

    # Expense section
    if expense_articles:
        keyboard.append([
            InlineKeyboardButton("💸 РАСХОДЫ", callback_data="header:expense")
        ])
        for article in expense_articles:
            keyboard.append([
                InlineKeyboardButton(
                    f"  {article['name']}",
                    callback_data=f"article:{article['id']}"
                )
            ])

    # Cancel button
    keyboard.append([
        InlineKeyboardButton("❌ Отмена", callback_data="cancel")
    ])

    return InlineKeyboardMarkup(keyboard)


# TODO: Implement full /add conversation handler
# See add_plan.py for reference implementation

# Placeholder for conversation handler
# add_conversation_handler = ConversationHandler(...)
```

**После создания:**
1. Проверить импорт в `add_plan.py:221`
2. Добавить регистрацию в `bot.py` (если нужен полный /add handler)
3. Протестировать `/addplan` команду

---

### Задача: CRIT-002 — Исправление pagination

**Файл:** `bot/utils/api_client.py`

**Изменения в методе `list_facts()`:**

```python
async def list_facts(
    self,
    token: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    article_id: Optional[int] = None,
    limit: int = 1000,
    offset: int = 0  # Добавить параметр
) -> Dict[str, Any]:
    """
    List user's facts with filtering and pagination.

    Args:
        token: JWT access token
        date_from: Start date filter (ISO format: YYYY-MM-DD)
        date_to: End date filter (ISO format: YYYY-MM-DD)
        article_id: Filter by article ID
        limit: Maximum number of records to return
        offset: Number of records to skip (for pagination)  # Добавить

    Returns:
        Dict containing facts list and pagination info
    """
    try:
        params = {}
        if date_from:
            params["date_from"] = date_from
        if date_to:
            params["date_to"] = date_to
        if article_id:
            params["article_id"] = article_id
        if limit:
            params["limit"] = limit
        if offset:  # Добавить эту проверку
            params["offset"] = offset

        response = await self.client.get(
            "/facts",
            params=params,
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()

        return response.json()
    # ...
```

---

## Риски и митигация

### Риск 1: Регрессии при рефакторинге

**Вероятность:** Средняя
**Влияние:** Высокое

**Митигация:**
- Запускать тесты после каждого изменения
- Рефакторинг небольшими PR
- Code review перед merge

### Риск 2: Несовместимость с backend API

**Вероятность:** Низкая
**Влияние:** Высокое

**Митигация:**
- Проверить поддержку `offset` в backend API `/facts`
- Тестировать на staging перед production

### Риск 3: Потеря функциональности при удалении legacy

**Вероятность:** Низкая
**Влияние:** Среднее

**Митигация:**
- Проверить логи на использование `menu:` callback
- Мониторинг после удаления

---

## Checklist перед началом рефакторинга

- [ ] Создать feature branch `refactor/bot-cleanup`
- [ ] Убедиться что все тесты проходят (`pytest bot/tests/`)
- [ ] Проверить поддержку offset в backend API
- [ ] Сделать backup текущего состояния

## Checklist после рефакторинга

- [ ] Все тесты проходят
- [ ] `/addplan` работает корректно
- [ ] `/list` pagination работает
- [ ] Логи не содержат ошибок импорта
- [ ] Документация обновлена

---

## История изменений

| Дата | Версия | Автор | Описание |
|------|--------|-------|----------|
| 2025-12-09 | 1.0 | Claude Code | Первоначальный анализ |
