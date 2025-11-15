# 15. Code Style Guidelines

## Философия: Минималистичный самодокументируемый код

**Ключевой принцип:** Код должен быть самодокументируемым. Хорошие имена переменных/функций и правильная структура лучше комментариев.

**Цель:** Читаемый, поддерживаемый код без избыточных комментариев.

---

## Правила комментирования

### ✅ ПИСАТЬ комментарии ТОЛЬКО для:

1. **Сложной бизнес-логики** - алгоритмы, формулы, неочевидные решения
2. **Критичных решений** - почему выбран этот подход, обоснование
3. **Workarounds и временных решений** - FIXME, TODO с объяснением
4. **API endpoints** - краткое описание назначения (1-2 строки в docstring)
5. **Регулярные выражения** - что паттерн ищет
6. **Сложные SQL запросы** - что запрос делает и почему так
7. **Docstrings для публичных функций/классов** - краткие, без очевидностей

### ❌ НЕ ПИСАТЬ комментарии для:

1. **Очевидных операций** - `# Создаем пользователя` над `user = User()`
2. **Переменных с понятными именами** - код самодокументируется
3. **Пересказа кода на естественном языке**
4. **Закомментированного кода** - удалять, не оставлять (используйте git history)
5. **Устаревших комментариев** - обновлять или удалять при изменении кода
6. **Дублирования информации из type hints**

---

## Примеры

### 1. Именование вместо комментариев

```python
# ❌ ПЛОХО
def calc(d, m, y):  # Вычисляет количество дней
    ...

# ✅ ХОРОШО
def calculate_days_in_period(start_date: date, end_date: date, include_weekends: bool) -> int:
    ...
```

### 2. Декомпозиция вместо комментариев

```python
# ❌ ПЛОХО - блок с комментариями
def process_data(data):
    # Валидация данных
    if not data or len(data) == 0:
        raise ValueError("No data provided")

    # Фильтрация активных записей
    active = [d for d in data if d.is_active]

    # Группировка по категориям
    by_category = {}
    for item in active:
        if item.category not in by_category:
            by_category[item.category] = []
        by_category[item.category].append(item)

    return by_category

# ✅ ХОРОШО - самодокументируемые функции
def process_data(data: list[Record]) -> dict[str, list[Record]]:
    validate_data(data)
    active_records = filter_active_records(data)
    return group_by_category(active_records)

def validate_data(data: list[Record]) -> None:
    if not data:
        raise ValueError("No data provided")

def filter_active_records(data: list[Record]) -> list[Record]:
    return [record for record in data if record.is_active]

def group_by_category(records: list[Record]) -> dict[str, list[Record]]:
    result = {}
    for record in records:
        result.setdefault(record.category, []).append(record)
    return result
```

### 3. Комментарии - "Почему", не "Что"

```python
# ❌ ПЛОХО - объясняет ЧТО делает код (очевидно из кода)
# Получаем текущего пользователя
current_user = get_current_user()

# Проверяем, является ли пользователь администратором
if current_user.is_admin:
    # Разрешаем доступ
    return True

# ✅ ХОРОШО - объясняет ПОЧЕМУ (неочевидная причина)
# FIXME: Workaround для bug в SQLAlchemy 1.4.x - explicit refresh required
# Issue: https://github.com/sqlalchemy/sqlalchemy/issues/1234
session.refresh(user)

# ✅ ХОРОШО - объясняет архитектурное решение
# Use closure table for O(1) hierarchy queries instead of recursive CTE
# Precomputed ancestor-descendant pairs enable fast subtree retrieval
descendants = get_subtree(article_id)
```

### 4. Type Hints вместо комментариев типов

```python
# ❌ ПЛОХО - дублирование информации
def get_facts(article_id, start, end):
    """
    Get budget facts for article in date range.

    Args:
        article_id: ID статьи (int)
        start: Начальная дата (date)
        end: Конечная дата (date)

    Returns:
        Список фактов (list of BudgetFact)
    """
    ...

# ✅ ХОРОШО - type hints вместо Args/Returns
def get_facts(
    article_id: int,
    start: date,
    end: date
) -> list[BudgetFact]:
    """Get budget facts for article in date range."""
    ...
```

### 5. Краткие полезные Docstrings

```python
# ❌ ПЛОХО - очевидная информация, многословность
def create_user(email: str, password: str) -> User:
    """
    Creates a new user.

    This function creates a new user with the provided email and password.
    It takes an email and password as parameters and returns a User object.
    The email must be unique and the password will be hashed before storage.
    """
    ...

# ✅ ХОРОШО - краткая полезная информация
def create_user(email: str, password: str) -> User:
    """Create user with hashed password. Raises ValueError if email exists."""
    ...
```

### 6. Удалять, не комментировать

```python
# ❌ ПЛОХО - закомментированный код (мусор)
def calculate_total(facts: list[BudgetFact]) -> Decimal:
    total = sum(f.amount for f in facts)
    # old_total = Decimal(0)
    # for fact in facts:
    #     if fact.is_active:
    #         old_total += fact.amount
    # return old_total
    return total

# ✅ ХОРОШО - чистый код (старый код в git history)
def calculate_total(facts: list[BudgetFact]) -> Decimal:
    return sum(f.amount for f in facts)
```

---

## Когда комментарии ОБЯЗАТЕЛЬНЫ

### 1. Сложные алгоритмы и формулы

```python
def calculate_installment(amount: Decimal, annual_rate: Decimal, months: int) -> Decimal:
    """Calculate monthly installment using annuity formula."""
    # Annuity coefficient: i * (1 + i)^n / ((1 + i)^n - 1)
    # where i = monthly interest rate, n = number of months
    monthly_rate = annual_rate / 12 / 100
    coefficient = (monthly_rate * (1 + monthly_rate) ** months) / \
                  ((1 + monthly_rate) ** months - 1)
    return amount * coefficient
```

### 2. Workarounds, FIXME, TODO

```python
# TODO: Migrate to async SQLAlchemy 2.0 syntax when aiomysql supports it
# Tracking: https://github.com/aio-libs/aiomysql/issues/XXX
session.execute(text(query))

# FIXME: Временное решение до рефакторинга hierarchy service
# Workaround для предотвращения циклических зависимостей при импорте
from backend.app.services import scd2_service
```

### 3. Сложные регулярные выражения

```python
# Match Telegram bot command format: /command@botname args
# Examples: /start, /add@budget_bot, /summary 2024-01
COMMAND_PATTERN = re.compile(r'^/([a-z_]+)(?:@[a-z_]+)?\s*(.*)', re.IGNORECASE)
```

### 4. Архитектурные решения и оптимизации

```python
async def create_new_version(session: AsyncSession, old_record, updates):
    """Create SCD Type 2 new version by closing old and creating new."""
    # Close old version atomically BEFORE creating new to prevent
    # race condition where two records have is_current=True
    old_record.is_current = False
    old_record.valid_to = datetime.utcnow()

    new_record = old_record.__class__(**updates)
    session.add(new_record)
    await session.commit()
    return new_record
```

### 5. API endpoints (краткий docstring)

```python
@router.post("/facts", response_model=FactResponse)
async def create_fact(data: FactCreate, current_user: CurrentUser):
    """
    Create budget fact.

    Validates: amount > 0, fact_date <= today, article exists and active.
    """
    ...
```

---

## Практические советы

### ✅ DO:

1. **Используйте описательные имена**
   - `user_active_subscriptions` вместо `uas`
   - `calculate_monthly_installment` вместо `calc_mi`
   - `is_eligible_for_discount` вместо `check_discount`

2. **Разбивайте большие функции**
   - Одна функция = одна ответственность
   - Если функция > 20-30 строк - возможно нужна декомпозиция
   - Каждая маленькая функция с понятным именем - самодокументация

3. **Применяйте type hints везде**
   ```python
   def process(data: list[Record], filter_func: Callable[[Record], bool]) -> dict[str, int]:
       ...
   ```

4. **Пишите краткие docstrings**
   - Одна строка для простых функций
   - Добавляйте важные детали: исключения, побочные эффекты, ограничения

5. **Объясняйте "почему", не "что"**
   - Код показывает "что" (что делает)
   - Комментарий объясняет "почему" (почему так сделано)

### ❌ DON'T:

1. **Не дублируйте код в комментариях**
   ```python
   # ❌ ПЛОХО
   # Проверяем, больше ли amount нуля
   if amount > 0:
       ...
   ```

2. **Не оставляйте закомментированный код**
   - Используйте git для истории изменений
   - Удаляйте мёртвый код сразу

3. **Не игнорируйте устаревшие комментарии**
   - При изменении кода - обновите или удалите комментарии
   - Устаревший комментарий хуже отсутствия комментария

4. **Не объясняйте очевидное**
   ```python
   # ❌ ПЛОХО
   # Увеличиваем counter на 1
   counter += 1
   ```

5. **Не используйте комментарии вместо рефакторинга**
   - Если код сложный и требует много комментариев - упростите код
   - Декомпозиция > комментарии

---

## Золотое правило

> **Если нужен комментарий, чтобы объяснить "что делает код" - улучшите код.**
>
> **Комментарии нужны только для объяснения "почему код делает это именно так".**

---

## Checklist перед коммитом

- [ ] Удалены все закомментированные блоки кода
- [ ] Нет очевидных комментариев (пересказ кода)
- [ ] Type hints добавлены для всех функций
- [ ] Имена переменных/функций понятны без комментариев
- [ ] Docstrings краткие и полезные
- [ ] Комментарии объясняют "почему", не "что"
- [ ] FIXME/TODO имеют контекст и ссылки на issues

---

## Ссылки

- [PEP 8 - Style Guide for Python Code](https://peps.python.org/pep-0008/)
- [Google Python Style Guide - Comments](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)
- [Clean Code by Robert Martin](https://www.oreilly.com/library/view/clean-code-a/9780136083238/)

---

**Помните:** Лучший комментарий - это его отсутствие за счёт хорошего кода.
