# Archived Migrations

Эта директория содержит миграции, которые были объединены (consolidated) с другими миграциями в процессе разработки.

## Политика архивирования

**Важно:** Архивные миграции **НЕ ПРИМЕНЯЮТСЯ** при deployment. Они сохранены только для истории.

---

## Список архивных миграций

### 010_add_record_type_to_budget_fact.sql

**Дата архивирования:** 2025-10-31
**Причина:** Functionality integrated into `006_create_t_f_budget_fact.sql`

**Описание:**
Эта миграция добавляла поле `record_type` в таблицу `t_f_budget_fact` через ALTER TABLE.

**Что изменилось:**
Поле `record_type` теперь создается **сразу** при создании таблицы в миграции 006:
- `record_type VARCHAR(10) DEFAULT 'fact' NOT NULL`
- CHECK constraints для validation
- Indexes для performance

**Для fresh deployments:**
Миграция 010 больше не нужна - все включено в 006.

**История:**
Изначально record_type был добавлен как отдельная миграция для поддержки плановых транзакций (plan vs fact). В процессе разработки было решено упростить структуру и включить это поле сразу в CREATE TABLE, так как проект находится в фазе развертывания с нуля.

---

## Когда создаются архивные миграции?

Миграции архивируются когда:
1. Проект в фазе **DEVELOPMENT** (до production release)
2. Миграция consolidируется с более ранней миграцией
3. Нет production данных, которые нужно мигрировать
4. Изменение упрощает структуру БД

После production release - архивирование прекращается, используется версионирование.

---

## См. также

- `/backend/db/migrations/README.md` - Active migrations
- `/docs/prd/06-database-design.md` - Database schema documentation
- `/CLAUDE.md` - Development workflow rules
