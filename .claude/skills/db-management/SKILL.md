---
name: Database Management
description: Управление БД, миграциями, SCD Type 2 и Closure Table
version: 2.1.0
author: Family Budget Team
tags: [database, postgresql, alembic, migrations, scd-type-2, closure-table, shared-budget, toon-optimized]
dependencies: []
user-invocable: false
---

# Database Management Skill v2.1.0

Автоматизация управления базой данных, миграциями и работы с SCD Type 2 / Closure Table patterns.

## Когда использовать этот скил

Используй этот скил когда нужно:
- Создать новую миграцию Alembic
- Создать dimension модель с SCD Type 2
- Создать Closure Table для иерархии
- Сделать backup базы данных
- Проанализировать производительность БД
- Применить или откатить миграции

Скил автоматически вызывается при запросах типа:
- "Создай миграцию для добавления колонки X"
- "Создай новую dimension таблицу Y с SCD Type 2"
- "Создай Closure Table для иерархии Z"
- "Проанализируй производительность БД"

## Контекст проекта

Проект использует:
- **PostgreSQL 16+** как основная СУБД
- **Alembic 1.13+** для миграций базы данных
- **SQLModel 0.0.14** для ORM моделей
- **Async SQLAlchemy** для асинхронных операций
- **SCD Type 2** паттерн для dimension таблиц (историческое отслеживание)
- **Closure Table** паттерн для иерархических структур (категории)
- **Shared Family Budget** модель - все пользователи видят все записи (2-5 человек)

## Архитектурные паттерны

### SCD Type 2 (Slowly Changing Dimension Type 2)

Используется для dimension таблиц, где нужна полная история изменений:
- `t_d_user` - Пользователи
- `t_d_article` - Категории бюджета
- `t_d_financial_center` - Финансовые центры (ЦФО)
- `t_d_cost_center` - Центры возникновения затрат (МВЗ)

**Обязательные поля SCD Type 2:**
```python
class DimensionBase(SQLModel):
    id: Optional[int] = Field(default=None, primary_key=True)
    is_current: bool = Field(default=True, index=True)
    valid_from: datetime = Field(default_factory=datetime.utcnow, index=True)
    valid_to: datetime = Field(default=datetime(9999, 12, 31, 23, 59, 59), index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

### Closure Table

Используется для эффективных иерархических запросов:
- `t_d_article_hierarchy` - Иерархия категорий

**Структура Closure Table:**
```python
class ArticleHierarchy(SQLModel, table=True):
    __tablename__ = "t_d_article_hierarchy"

    ancestor_id: int = Field(foreign_key="t_d_article.id", primary_key=True)
    descendant_id: int = Field(foreign_key="t_d_article.id", primary_key=True)
    depth: int = Field(ge=0)  # 0 = self, 1 = direct child, etc.
```

## Команда: create-migration

Создать новую миграцию Alembic.

### Использование

```
Создай новую миграцию Alembic для добавления таблицы/колонки/индекса <описание>.
```

### Параметры

- **message**: Описание миграции (например: "Add email column to users")
- **autogenerate**: Автогенерация на основе изменений моделей (по умолчанию: true)

### Что делает

1. Генерирует новый файл миграции в `backend/db/migrations/versions/`
2. Заполняет `upgrade()` и `downgrade()` функции
3. Добавляет проверки для production safety
4. Валидирует миграцию перед коммитом

### Процесс создания миграции

```bash
# 1. Изменить SQLModel модель в backend/app/models/
# 2. Создать миграцию
cd backend
alembic revision --autogenerate -m "Add email column to users"

# 3. Проверить generated migration file в backend/db/migrations/versions/
# 4. Отредактировать если нужно (добавить default values, constraints)
# 5. Применить миграцию
alembic upgrade head

# 6. Откатить если нужно
alembic downgrade -1
```

### Шаблон миграции с production safety

```python
"""Add email column to users

Revision ID: abc123def456
Revises: prev_revision_id
Create Date: 2025-10-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers
revision: str = 'abc123def456'
down_revision: Union[str, None] = 'prev_revision_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply migration.

    PRODUCTION SAFETY:
    - Uses nullable column initially
    - Backfills data in separate step
    - Adds NOT NULL constraint after backfill
    """
    # Step 1: Add column as nullable
    op.add_column(
        't_d_user',
        sa.Column('email', sa.String(length=255), nullable=True)
    )

    # Step 2: Create index for performance
    op.create_index(
        'ix_t_d_user_email',
        't_d_user',
        ['email'],
        unique=False
    )

    # Step 3: Backfill existing rows (if needed)
    # op.execute("""
    #     UPDATE t_d_user
    #     SET email = CONCAT('user_', id, '@example.com')
    #     WHERE email IS NULL
    # """)

    # Step 4: Add NOT NULL constraint (after backfill)
    # op.alter_column('t_d_user', 'email', nullable=False)


def downgrade() -> None:
    """
    Rollback migration.

    IMPORTANT: Test downgrade in staging before production!
    """
    # Drop index first
    op.drop_index('ix_t_d_user_email', table_name='t_d_user')

    # Drop column
    op.drop_column('t_d_user', 'email')
```

## Команда: create-dimension-model

Создать новую dimension модель с SCD Type 2.

### Использование

```
Создай новую dimension модель <ModelName> с SCD Type 2 для полей: <field1>, <field2>, ...
```

### Параметры

- **ModelName**: Название модели (PascalCase)
- **fields**: Список полей с типами (например: "name:str, balance:Decimal, is_active:bool")
- **table_name**: Название таблицы (по умолчанию: `t_d_{model_name_snake_case}`)

### Что делает

1. Создает SQLModel класс в `backend/app/models/{model_name}.py`
2. Наследует от `DimensionBase` (includes SCD Type 2 fields)
3. Добавляет indexes для is_current, valid_from, valid_to
4. Создает миграцию Alembic
5. Добавляет в `backend/app/models/__init__.py`

### Шаблон Dimension модели

```python
"""
{ModelName} model with SCD Type 2 versioning.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlmodel import Field, Relationship

from backend.app.models.base import DimensionBase


class {ModelName}(DimensionBase, table=True):
    """
    {ModelName} dimension table with SCD Type 2.

    Features:
    - Historical tracking of all changes
    - User data isolation
    - Soft delete support (is_current=False)

    SCD Type 2 Fields:
    - is_current: True for active version, False for historical
    - valid_from: Start of validity period
    - valid_to: End of validity period (9999-12-31 for current)
    - created_at: Original creation timestamp
    - updated_at: Last update timestamp
    """
    __tablename__ = "t_d_{model_name_snake}"

    # Business Key Fields (identify unique entity)
    user_id: int = Field(foreign_key="t_d_user.id", index=True)
    name: str = Field(max_length=255, index=True)

    # Additional Fields
    description: Optional[str] = Field(default=None, max_length=1000)
    is_global: bool = Field(default=False, description="Available to all users")

    # Relationships
    user: Optional["User"] = Relationship(back_populates="{model_name_plural}")

    # Indexes (automatically created via Field(index=True))
    # Additional composite indexes can be added in migration:
    # CREATE INDEX idx_{model_name}_user_name ON t_d_{model_name} (user_id, name) WHERE is_current = true;

    class Config:
        """SQLModel configuration."""
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "name": "Example {ModelName}",
                "description": "Description here",
                "is_global": False,
            }
        }
```

## Команда: create-closure-table

Создать Closure Table для новой иерархической структуры.

### Использование

```
Создай Closure Table для модели <ModelName> с поддержкой иерархии.
```

### Параметры

- **ModelName**: Название модели (например: Article, Category)
- **parent_field**: Название поля родителя (по умолчанию: parent_id)

### Что делает

1. Создает модель `{ModelName}Hierarchy` в `backend/app/models/hierarchy.py`
2. Добавляет поле `parent_id` в основную модель (если нет)
3. Создает indexes для эффективных запросов
4. Создает миграцию Alembic
5. Добавляет триггеры для автоматического обновления (опционально)

### Шаблон Closure Table модели

```python
"""
{ModelName}Hierarchy - Closure Table for {model_name} tree structure.

Closure Table pattern stores all ancestor-descendant relationships,
enabling O(1) hierarchical queries without recursion.
"""

from typing import Optional

from sqlmodel import Field, SQLModel


class {ModelName}Hierarchy(SQLModel, table=True):
    """
    Closure table for {model_name} hierarchy.

    Stores all ancestor-descendant pairs with depth.

    Example:
        Food (id=1)
          └─ Groceries (id=2)
               └─ Organic (id=3)

    Rows in closure table:
        (1, 1, 0)  # Food → Food (self)
        (1, 2, 1)  # Food → Groceries (direct child)
        (1, 3, 2)  # Food → Organic (grandchild)
        (2, 2, 0)  # Groceries → Groceries (self)
        (2, 3, 1)  # Groceries → Organic (direct child)
        (3, 3, 0)  # Organic → Organic (self)

    Usage:
        # Get all descendants of Food
        SELECT descendant_id FROM {model_name}_hierarchy WHERE ancestor_id = 1

        # Get all ancestors of Organic
        SELECT ancestor_id FROM {model_name}_hierarchy WHERE descendant_id = 3

        # Get direct children of Food
        SELECT descendant_id FROM {model_name}_hierarchy WHERE ancestor_id = 1 AND depth = 1
    """
    __tablename__ = "t_d_{model_name_snake}_hierarchy"

    # Primary Key: composite (ancestor_id, descendant_id)
    ancestor_id: int = Field(
        foreign_key="t_d_{model_name_snake}.id",
        primary_key=True,
        description="Ancestor (parent) node ID"
    )
    descendant_id: int = Field(
        foreign_key="t_d_{model_name_snake}.id",
        primary_key=True,
        description="Descendant (child) node ID"
    )

    # Depth: number of levels between ancestor and descendant
    depth: int = Field(
        ge=0,
        description="Distance between nodes (0=self, 1=direct child, etc.)"
    )

    # Indexes for efficient queries
    # - (ancestor_id, depth) for getting children at specific level
    # - (descendant_id, depth) for getting ancestors at specific level
    # - (depth) for getting all nodes at specific level
```

### Миграция для Closure Table

```python
def upgrade() -> None:
    """Create closure table with indexes and triggers."""

    # 1. Add parent_id to main table (if not exists)
    op.add_column(
        't_d_{model_name_snake}',
        sa.Column('parent_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_{model_name}_parent',
        't_d_{model_name_snake}',
        't_d_{model_name_snake}',
        ['parent_id'],
        ['id']
    )

    # 2. Create closure table
    op.create_table(
        't_d_{model_name_snake}_hierarchy',
        sa.Column('ancestor_id', sa.Integer(), nullable=False),
        sa.Column('descendant_id', sa.Integer(), nullable=False),
        sa.Column('depth', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['ancestor_id'], ['t_d_{model_name_snake}.id']),
        sa.ForeignKeyConstraint(['descendant_id'], ['t_d_{model_name_snake}.id']),
        sa.PrimaryKeyConstraint('ancestor_id', 'descendant_id')
    )

    # 3. Create indexes for efficient queries
    op.create_index(
        'ix_{model_name}_hierarchy_ancestor_depth',
        't_d_{model_name_snake}_hierarchy',
        ['ancestor_id', 'depth']
    )
    op.create_index(
        'ix_{model_name}_hierarchy_descendant_depth',
        't_d_{model_name_snake}_hierarchy',
        ['descendant_id', 'depth']
    )
    op.create_index(
        'ix_{model_name}_hierarchy_depth',
        't_d_{model_name_snake}_hierarchy',
        ['depth']
    )

    # 4. Initialize closure table (self-references for existing rows)
    op.execute("""
        INSERT INTO t_d_{model_name_snake}_hierarchy (ancestor_id, descendant_id, depth)
        SELECT id, id, 0
        FROM t_d_{model_name_snake}
        WHERE is_current = true
    """)


def downgrade() -> None:
    """Drop closure table and parent_id."""
    op.drop_index('ix_{model_name}_hierarchy_depth', table_name='t_d_{model_name_snake}_hierarchy')
    op.drop_index('ix_{model_name}_hierarchy_descendant_depth', table_name='t_d_{model_name_snake}_hierarchy')
    op.drop_index('ix_{model_name}_hierarchy_ancestor_depth', table_name='t_d_{model_name_snake}_hierarchy')
    op.drop_table('t_d_{model_name_snake}_hierarchy')
    op.drop_constraint('fk_{model_name}_parent', 't_d_{model_name_snake}', type_='foreignkey')
    op.drop_column('t_d_{model_name_snake}', 'parent_id')
```

## Команда: backup-database

Создать backup базы данных.

### Использование

```
Создай backup базы данных и загрузи в S3/локальное хранилище.
```

### Что делает

1. Использует `scripts/backup.sh` для создания dump
2. Сжимает dump (gzip)
3. Загружает в S3 (если настроено)
4. Сохраняет локально в `backups/`
5. Ротация старых backup'ов (хранит последние 7 дней)

```bash
# Manual backup
cd /opt/budget
./scripts/backup.sh

# Automated backup (cron)
# Добавлено через setup_automation.sh
0 2 * * * /opt/budget/scripts/backup.sh
```

## Команда: analyze-performance

Анализировать производительность базы данных.

### Использование

```
Проанализируй производительность базы данных: медленные запросы, missing indexes, table bloat.
```

### Что делает

1. Находит медленные запросы (> 1s)
2. Находит missing indexes
3. Анализирует table bloat
4. Проверяет vacuum statistics
5. Генерирует рекомендации

```bash
cd backend
python db/analyze_performance.py
```

### Скрипт анализа

```python
"""
Database performance analysis.

Checks:
- Slow queries from pg_stat_statements
- Missing indexes recommendations
- Table bloat
- Vacuum statistics
"""

import asyncio
from sqlalchemy import text
from backend.app.db.session import get_async_session


async def analyze_slow_queries():
    """Find queries taking > 1 second."""
    query = text("""
        SELECT
            query,
            calls,
            total_exec_time / 1000 as total_time_sec,
            mean_exec_time / 1000 as mean_time_sec,
            max_exec_time / 1000 as max_time_sec
        FROM pg_stat_statements
        WHERE mean_exec_time > 1000  -- > 1 second
        ORDER BY mean_exec_time DESC
        LIMIT 20
    """)

    async with get_async_session() as session:
        result = await session.execute(query)
        rows = result.fetchall()

        print("🐌 SLOW QUERIES (mean > 1s):")
        for row in rows:
            print(f"\n  Query: {row.query[:100]}...")
            print(f"  Calls: {row.calls}")
            print(f"  Mean: {row.mean_time_sec:.2f}s")
            print(f"  Max: {row.max_time_sec:.2f}s")


async def check_missing_indexes():
    """Find tables that might benefit from indexes."""
    query = text("""
        SELECT
            schemaname,
            tablename,
            seq_scan,
            seq_tup_read,
            idx_scan,
            seq_tup_read / seq_scan as avg_seq_read
        FROM pg_stat_user_tables
        WHERE seq_scan > 0
        ORDER BY seq_tup_read DESC
        LIMIT 20
    """)

    async with get_async_session() as session:
        result = await session.execute(query)
        rows = result.fetchall()

        print("\n📊 TABLES WITH SEQUENTIAL SCANS:")
        for row in rows:
            if row.seq_scan > row.idx_scan * 10:  # 10x more seq scans than index scans
                print(f"\n  Table: {row.tablename}")
                print(f"  Sequential scans: {row.seq_scan}")
                print(f"  Rows read: {row.seq_tup_read}")
                print(f"  ⚠️  Consider adding index!")


if __name__ == "__main__":
    asyncio.run(analyze_slow_queries())
    asyncio.run(check_missing_indexes())
```

## Проверочный чеклист

### После создания миграции:

- [ ] Migration file создан в `backend/db/migrations/versions/`
- [ ] `upgrade()` и `downgrade()` функции корректны
- [ ] Добавлены default values для новых колонок
- [ ] Добавлены indexes для foreign keys
- [ ] Протестирована миграция на dev БД
- [ ] Миграция безопасна для production (nullable columns, backfill, constraints)

### После создания Dimension модели:

- [ ] Модель наследует `DimensionBase`
- [ ] Добавлены SCD Type 2 поля (is_current, valid_from, valid_to)
- [ ] Добавлены indexes для is_current и valid_from/valid_to
- [ ] Создана миграция Alembic
- [ ] Добавлена в `__init__.py`
- [ ] Endpoint использует `SCD2Service.create_new_version()`

### После создания Closure Table:

- [ ] Модель Hierarchy создана
- [ ] Добавлено поле parent_id в основную модель
- [ ] Созданы indexes (ancestor_id+depth, descendant_id+depth, depth)
- [ ] Инициализированы self-references для существующих строк
- [ ] HierarchyService работает корректно

## Связанные скилы

- **api-development**: для создания CRUD endpoints для новых моделей
- **testing**: для создания тестов миграций и SCD Type 2
- **deployment**: для применения миграций на production

## Примеры использования

### Пример 1: Добавить новую колонку

```
Создай миграцию для добавления колонки "email" (VARCHAR 255, nullable) в таблицу t_d_user.
Добавь index на email для ускорения поиска.
```

### Пример 2: Создать новую dimension таблицу

```
Создай новую dimension модель "PaymentMethod" с SCD Type 2.
Поля: user_id (int), name (str), type (str: card/cash/bank), is_global (bool).
```

### Пример 3: Анализ производительности

```
Проанализируй производительность БД:
- Найди запросы медленнее 1 секунды
- Найди таблицы с большим количеством sequential scans
- Предложи missing indexes
```

## Часто задаваемые вопросы

**Q: Когда использовать SCD Type 2?**

A: Для dimension таблиц, где нужна история изменений: User, Article, FinancialCenter, CostCenter. НЕ используй для fact таблиц (BudgetFact).

**Q: Как откатить миграцию на production?**

A:
```bash
# Проверь текущую revision
alembic current

# Откат на одну версию назад
alembic downgrade -1

# Откат на конкретную revision
alembic downgrade abc123def456
```

**Q: Как обновить Closure Table при изменении parent_id?**

A: Используй `HierarchyService` - он автоматически обновляет все транзитивные связи. НЕ обновляй closure table напрямую через SQL!

## TOON Optimization (v2.1+)

**Экономия токенов** при хранении migration templates с использованием TOON формата:

**Hybrid Output Format:**
```json
{
  "scd_type2_migration_steps": [
    {
      "step": 1,
      "action": "add_version_columns",
      "sql_snippet": "ALTER TABLE {table} ADD COLUMN valid_from...",
      "description": "Add SCD Type 2 temporal columns"
    },
    ...
  ],
  "toon": {
    "scd_type2_migration_steps_toon": "scd_type2_migration_steps[6]{step,action,sql_snippet,description}:\n  1,add_version_columns,ALTER TABLE {table} ADD COLUMN valid_from...,Add SCD Type 2 temporal columns\n  ...",
    "token_savings": {
      "scd_type2_migration_steps": "32.8%",
      "total": "33.0%"
    },
    "size_comparison": {
      "json_tokens": 895,
      "toon_tokens": 600,
      "saved_tokens": 295
    }
  }
}
```

**Преимущества TOON:**
- ✅ **33.0% экономия токенов** (295 tokens saved)
- ✅ **100% backward compatible** (JSON arrays untouched)
- ✅ **Lossless conversion** (round-trip tested)
- ✅ **Human-readable** migration step tables

**Migration Templates Breakdown:**
| Template Type | Steps | JSON Tokens | TOON Tokens | Saved | Percent |
|---------------|-------|-------------|-------------|-------|---------|
| SCD Type 2 | 6 | 393 | 264 | 129 | 32.8% |
| Closure Table | 4 | 272 | 189 | 83 | 30.5% |
| Shared Budget | 4 | 230 | 147 | 83 | 36.1% |
| **Total** | **14** | **895** | **600** | **295** | **33.0%** |

**Configuration:**
- Location: `.claude/skills/db-management/config/migration-templates.json`
- Version: 2.1.0
- Format: Hybrid JSON + TOON
- Testing: `node config/test-toon-hybrid.mjs`

## Changelog

### v2.1.0 (2026-01-24)
**TOON Optimization:**
- ✅ **Hybrid Output Format**: migration-templates.json includes TOON representations alongside JSON
- ✅ **Token Savings**: 295 tokens (33.0%) reduction in migration template configuration
- ✅ **Lossless Conversion**: Round-trip tested for data integrity
- ✅ **Backward Compatibility**: JSON arrays remain unchanged, TOON is additive

**Migration Templates Enhancements:**
- Extracted 6 SCD Type 2 migration steps to config/migration-templates.json
- Extracted 4 Closure Table migration steps
- Extracted 4 Shared Budget migration steps
- Standardized template structure (step, action, sql_snippet, description)

**Template Coverage:**
- SCD Type 2: add_version_columns, add_is_current_index, add_version_index, add_valid_period_index, create_history_table, add_history_trigger
- Closure Table: create_hierarchy_table, add_self_reference, add_depth_index, add_descendant_index
- Shared Budget: add_user_id_column, set_default_user, add_not_null_constraint, add_user_index

**Configuration:**
- `config/migration-templates.json` v2.1.0 with TOON metadata
- Token savings: 295 tokens (33.0% reduction)
- Testing: Round-trip validation ensures lossless conversion

### v2.0.0 (Initial)
**Core Features:**
- Alembic migration templates
- SCD Type 2 versioning patterns
- Closure Table hierarchy management
- Shared Family Budget model setup
- PostgreSQL optimization patterns
