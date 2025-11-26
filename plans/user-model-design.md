# User Model Design: SCD Type 1 + History

**Created:** 2025-11-26
**Status:** Design Complete
**Version:** 1.0

---

## Проблема текущей архитектуры (полный SCD Type 2)

### Текущая реализация

В настоящее время таблица `t_d_user` использует **полный SCD Type 2** подход:
- При любом изменении профиля (username, photo_url, is_admin, etc.) создаётся **новая версия** с новым `id`
- Старая версия закрывается: `is_current=False`, `valid_to=now()`
- Новая версия становится текущей: `is_current=True`, `valid_from=now()`, `valid_to=9999-12-31`

### Проблемы

#### 1. **FK нестабильность (КРИТИЧНО)**

**Симптомы:**
- FK в fact таблицах (`t_f_budget_fact.user_id`) указывают на конкретную версию пользователя
- При обновлении профиля (например, изменение username) создаётся новая версия с **новым `id`**
- Старые транзакции остаются связаны со **старой версией** пользователя (archived record)
- При отображении истории транзакций нужно делать сложные JOINs для получения **текущего** username

**Пример проблемы:**
```sql
-- Пользователь создан с id=1, username="john"
INSERT INTO t_d_user (id, telegram_id, username, is_current)
VALUES (1, 123456, 'john', TRUE);

-- Создана транзакция
INSERT INTO t_f_budget_fact (user_id, amount) VALUES (1, 100);

-- Пользователь обновил username на "john_doe"
-- SCD2 создаёт НОВУЮ версию:
INSERT INTO t_d_user (id, telegram_id, username, is_current)
VALUES (2, 123456, 'john_doe', TRUE);
UPDATE t_d_user SET is_current=FALSE, valid_to=now() WHERE id=1;

-- ПРОБЛЕМА: FK в t_f_budget_fact.user_id=1 теперь указывает на архивную версию!
-- Для отображения нужно найти текущую версию через telegram_id:
SELECT f.*, u.username
FROM t_f_budget_fact f
JOIN t_d_user u ON u.telegram_id = (
    SELECT telegram_id FROM t_d_user WHERE id = f.user_id
) AND u.is_current = TRUE;
```

**Последствия:**
- Сложные queries с subqueries для получения актуального username
- Невозможность использовать простой `JOIN t_d_user u ON u.id = f.user_id`
- Риск отображения устаревших данных при некорректных JOINs
- Потенциальные проблемы с CASCADE DELETE (FK указывают на archived records)

#### 2. **Раздувание основной таблицы**

**Симптомы:**
- Частые обновления профиля (username, photo_url, last_login_at) создают десятки версий
- Основная таблица `t_d_user` раздувается **историческими данными**, которые редко нужны
- Пример: 5 пользователей, 10 обновлений каждый = 50 records вместо 5

**Последствия:**
- Увеличение размера таблицы (storage overhead)
- Медленные queries: `WHERE is_current = TRUE` фильтрует 90% записей
- Index bloat: индексы содержат archived versions

#### 3. **Профильные данные НЕ являются бизнес-данными**

**Анализ:**
- `username`, `first_name`, `last_name`, `photo_url` - это **UI metadata** из Telegram
- Изменение username НЕ влияет на бизнес-логику (транзакции, права доступа)
- `is_admin`, `is_active` - это **access control флаги**, не требующие версионирования
- `last_login_at` - это **audit trail**, не требующий версионирования

**Вывод:**
Применение SCD Type 2 к профильным данным - **over-engineering**, создающий больше проблем, чем пользы.

---

## Предлагаемое решение: SCD Type 1 + History

### Архитектура

#### 1. **Основная таблица `t_d_user` (SCD Type 1)**

```sql
CREATE TABLE t_d_user (
    id SERIAL PRIMARY KEY,              -- Стабильный PK (НИКОГДА не меняется)
    telegram_id BIGINT UNIQUE NOT NULL, -- Business key

    -- Profile data (SCD Type 1 - in-place updates)
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    photo_url VARCHAR(512),

    -- Status flags (SCD Type 1)
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,

    -- Audit (SCD Type 1)
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()

    -- NOTE: NO SCD2 fields (valid_from, valid_to, is_current)
);
```

**Ключевые особенности:**
- `id` (PK) **стабилен** - НИКОГДА не создаётся новая версия
- FK в fact таблицах (`t_f_budget_fact.user_id`) всегда **валидны**
- Обновления - **in-place** (`UPDATE SET username='new' WHERE id=X`)
- Простые queries: `JOIN t_d_user u ON u.id = f.user_id` (NO subqueries!)

#### 2. **Таблица истории `t_d_user_history` (SCD Type 2)**

```sql
CREATE TABLE t_d_user_history (
    history_id SERIAL PRIMARY KEY,         -- Surrogate key для истории
    user_id INTEGER REFERENCES t_d_user(id), -- FK к основной таблице (стабильный)

    -- Snapshot всех полей (на момент изменения)
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    photo_url VARCHAR(512),
    is_admin BOOLEAN,
    is_active BOOLEAN,
    last_login_at TIMESTAMP,

    -- SCD Type 2 fields (temporal validity)
    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    is_current BOOLEAN DEFAULT TRUE,

    -- Audit metadata (что изменилось и кто)
    change_type VARCHAR(50),           -- CREATE/UPDATE/ROLE_CHANGE
    changed_fields TEXT[],             -- ['username', 'photo_url']
    changed_by_user_id INTEGER,        -- Кто сделал изменение (NULL для auto)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_history_user_id ON t_d_user_history(user_id);
CREATE INDEX idx_user_history_valid_from ON t_d_user_history(valid_from);
CREATE INDEX idx_user_history_is_current ON t_d_user_history(is_current);
CREATE INDEX idx_user_history_telegram_id ON t_d_user_history(telegram_id);
```

**Ключевые особенности:**
- Хранит **полную историю** всех изменений (кто, когда, что изменилось)
- FK `user_id` → `t_d_user.id` (стабильный PK, не меняется при обновлениях)
- Используется **только для аудита** и `GET /users/{id}/history` endpoint
- **НЕ участвует** в обычных queries (no JOINs в fact queries)

### Workflow обновления профиля

```python
# Пример: обновление username
async def update_user_profile(user_id: int, new_username: str):
    # 1. Сохранить старое состояние в историю (SCD2)
    old_user = await session.get(User, user_id)
    history = UserHistory(
        user_id=old_user.id,
        telegram_id=old_user.telegram_id,
        username=old_user.username,  # Старое значение
        is_admin=old_user.is_admin,
        is_current=False,  # Закрываем старую версию
        valid_from=old_user.updated_at,
        valid_to=datetime.utcnow(),
        change_type="UPDATE",
        changed_fields=["username"]
    )
    session.add(history)

    # 2. Обновить основную таблицу IN-PLACE (SCD1)
    old_user.username = new_username
    old_user.updated_at = datetime.utcnow()
    await session.commit()

    # 3. Создать новую текущую версию в истории
    current_history = UserHistory(
        user_id=old_user.id,
        telegram_id=old_user.telegram_id,
        username=new_username,  # Новое значение
        is_admin=old_user.is_admin,
        is_current=True,
        valid_from=old_user.updated_at,
        change_type="UPDATE",
        changed_fields=["username"]
    )
    session.add(current_history)
    await session.commit()
```

**Результат:**
- `t_d_user.id` НЕ изменился → FK в `t_f_budget_fact` остаются валидными
- История сохранена в `t_d_user_history` → можно посмотреть через API
- Простые queries: `JOIN t_d_user ON id = user_id` без сложностей

---

## Trade-offs (Pros & Cons)

### ✅ Pros (Преимущества)

#### 1. **Стабильные FK (КРИТИЧНО)**
- FK в fact таблицах (`t_f_budget_fact.user_id`) **НИКОГДА не устаревают**
- Простые queries: `JOIN t_d_user u ON u.id = f.user_id` (no subqueries)
- Гарантия referential integrity (CASCADE DELETE работает корректно)

#### 2. **Уменьшение раздувания основной таблицы**
- `t_d_user` содержит **только текущие данные** (5 users = 5 records)
- История вынесена в отдельную таблицу `t_d_user_history`
- Queries к основной таблице быстрее (нет фильтрации `WHERE is_current=TRUE`)

#### 3. **Разделение concerns (Separation of Concerns)**
- **Основная таблица** - текущее состояние для бизнес-логики
- **История** - аудит и compliance (редко используется)
- Можно архивировать старую историю (partitioning, cold storage) без влияния на production

#### 4. **Производительность**
- Indexes на основной таблице компактнее (меньше records)
- JOINs к `t_d_user` быстрее (no index bloat)
- История используется редко → можно оптимизировать отдельно

#### 5. **Упрощение кода**
- Нет сложных subqueries для поиска текущей версии
- CRUD операции проще (`UPDATE` вместо `INSERT + UPDATE old version`)
- Меньше риска багов при работе с FK

### ❌ Cons (Недостатки)

#### 1. **Дополнительная таблица (overhead)**
- Нужна отдельная таблица `t_d_user_history` (storage overhead)
- Дополнительная логика для сохранения истории при каждом UPDATE
- Complexity миграции (трансформация из SCD2 → SCD1 + History)

#### 2. **Сложность миграции (РИСК)**
- Нужно трансформировать existing SCD2 data → SCD1 + History
- Обновление FK в fact таблицах (map old versioned id → stable id)
- Риск потери данных или нарушения integrity при миграции
- **Митигация:** Atomic migration, rollback plan, тестирование на staging

#### 3. **Дополнительная логика в Service Layer**
- При каждом UPDATE нужно создавать запись в `t_d_user_history`
- Больше кода в `UserService.update_profile()`
- **Митигация:** Централизованная логика в Service, unit tests

#### 4. **Не подходит для точных temporal queries**
- Если нужен точный snapshot пользователя **на момент транзакции** - придётся делать JOIN к истории
- Пример: "Какой был username пользователя 3 месяца назад?" → JOIN t_d_user_history
- **Но:** В нашем случае это не требуется (username - это UI metadata, не бизнес-данные)

---

## Решение: Какие поля SCD1, какие логируются в историю

### SCD Type 1 (in-place updates в `t_d_user`)

Все поля обновляются in-place:

| Поле | Тип | Описание | Обоснование SCD1 |
|------|-----|----------|------------------|
| `id` | INTEGER | Primary Key | Стабильный PK (НИКОГДА не меняется) |
| `telegram_id` | BIGINT | Business key | Уникальный идентификатор из Telegram (не меняется) |
| `username` | VARCHAR(255) | Telegram username | UI metadata, не влияет на бизнес-логику |
| `first_name` | VARCHAR(255) | Имя | UI metadata |
| `last_name` | VARCHAR(255) | Фамилия | UI metadata |
| `photo_url` | VARCHAR(512) | Аватар | UI metadata (часто меняется) |
| `is_admin` | BOOLEAN | Админ флаг | Access control (не требует версионирования) |
| `is_active` | BOOLEAN | Активность | Access control |
| `last_login_at` | TIMESTAMP | Последний вход | Audit trail (не требует версионирования) |
| `created_at` | TIMESTAMP | Дата создания | Timestamp (не меняется) |
| `updated_at` | TIMESTAMP | Дата обновления | Timestamp (обновляется при любом изменении) |

### Логируются в `t_d_user_history` (SCD Type 2)

**ВСЕ изменения** полей выше логируются в истории + metadata:

| Поле | Тип | Описание |
|------|-----|----------|
| `history_id` | SERIAL | PK истории (surrogate key) |
| `user_id` | INTEGER | FK → `t_d_user.id` (стабильный) |
| `telegram_id` | BIGINT | Snapshot business key |
| `username` | VARCHAR(255) | Snapshot username на момент изменения |
| `first_name` | VARCHAR(255) | Snapshot first_name |
| `last_name` | VARCHAR(255) | Snapshot last_name |
| `photo_url` | VARCHAR(512) | Snapshot photo_url |
| `is_admin` | BOOLEAN | Snapshot is_admin |
| `is_active` | BOOLEAN | Snapshot is_active |
| `last_login_at` | TIMESTAMP | Snapshot last_login_at |
| **SCD2 fields** |||
| `valid_from` | TIMESTAMP | Начало validity (когда изменение произошло) |
| `valid_to` | TIMESTAMP | Конец validity (9999-12-31 для текущей версии) |
| `is_current` | BOOLEAN | TRUE для текущей версии |
| **Audit metadata** |||
| `change_type` | VARCHAR(50) | Тип изменения: CREATE/UPDATE/ROLE_CHANGE |
| `changed_fields` | TEXT[] | Массив изменённых полей: ['username', 'photo_url'] |
| `changed_by_user_id` | INTEGER | Кто сделал изменение (NULL для auto) |
| `created_at` | TIMESTAMP | Timestamp создания записи истории |

### Примеры типов изменений (change_type)

| change_type | Описание | Когда происходит |
|-------------|----------|------------------|
| `CREATE` | Создание нового пользователя | Первый вход через Telegram Login Widget |
| `UPDATE` | Обновление профиля | Изменение username/first_name/last_name/photo_url |
| `ROLE_CHANGE` | Изменение прав | Админ активирует/деактивирует пользователя, меняет is_admin |
| `LOGIN` | Вход в систему | Обновление last_login_at (опционально логируем) |

**Стратегия логирования:**
- **ВСЕГДА логировать:** CREATE, UPDATE (profile changes), ROLE_CHANGE (is_admin, is_active changes)
- **Опционально логировать:** LOGIN (last_login_at changes) - можно отключить чтобы не раздувать историю

---

## Сравнение с текущей архитектурой

| Аспект | Текущий SCD2 | Новый SCD1 + History | Улучшение |
|--------|--------------|---------------------|-----------|
| **FK стабильность** | ❌ FK устаревают при обновлениях | ✅ FK всегда валидны | ⭐⭐⭐ |
| **Размер основной таблицы** | ❌ Раздувается историей (50 records для 5 users) | ✅ Компактная (5 records для 5 users) | ⭐⭐⭐ |
| **Queries к основной таблице** | ❌ Нужен фильтр `WHERE is_current=TRUE` | ✅ Прямые queries (no filters) | ⭐⭐ |
| **JOINs к fact таблицам** | ❌ Сложные subqueries для текущей версии | ✅ Простые JOINs | ⭐⭐⭐ |
| **История изменений** | ✅ Хранится в основной таблице | ✅ Хранится отдельно | ➖ |
| **Сложность миграции** | - | ❌ Высокая (трансформация данных) | - |
| **Overhead (storage)** | ➖ | ❌ Дополнительная таблица | - |
| **Производительность** | ❌ Index bloat, медленные queries | ✅ Компактные indexes, быстрые queries | ⭐⭐ |
| **Код Service Layer** | ✅ Простой (используем SCD2Service) | ❌ Больше логики (история вручную) | - |

**Итог:** Новая архитектура решает **критическую проблему** (FK стабильность) и улучшает производительность, но требует сложной миграции и дополнительного кода.

---

## Выводы и рекомендации

### ✅ Рекомендуется внедрить SCD1 + History подход

**Обоснование:**
1. **FK стабильность** - критично для integrity и производительности fact queries
2. **Уменьшение раздувания** - основная таблица остаётся компактной
3. **Separation of concerns** - история используется редко, можно архивировать
4. **Профильные данные - это UI metadata** - не требуют полного SCD2

### ⚠️ Риски и митигация

**Риск:** Сложная миграция (трансформация SCD2 → SCD1 + History)
**Митигация:**
- Atomic migration в одной транзакции
- Обязательный backup БД перед миграцией
- Тестирование на staging с production данными
- Rollback plan (Alembic downgrade + restore from backup)

**Риск:** Дополнительная логика в Service Layer
**Митигация:**
- Централизованный `UserService.update_profile()` метод
- Unit tests для проверки корректности логирования истории
- Code review перед деплоем

### 📋 Следующие шаги

1. ✅ Design document утверждён
2. → **Phase 1:** Создать модели User (SCD1) и UserHistory (SCD2)
3. → **Phase 2:** Alembic миграция (трансформация данных)
4. → **Phase 3:** User Service + API endpoints
5. → **Phase 5:** Integration testing + deploy

---

**Status:** ✅ Design Complete
**Approved:** Ready for implementation
