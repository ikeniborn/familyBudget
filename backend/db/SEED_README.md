# Database Seeding

## Global References Seed Script

Скрипт `seed_global_references.py` заполняет базу данных default global справочниками.

### Что заполняется:

1. **Global Articles (Категории):**
   - Доходы: Зарплата, Премия, Подработка, Возврат долга
   - Расходы: Продукты, Транспорт, Коммунальные услуги, Развлечения, Здоровье, Образование, Одежда, Кафе и рестораны, Подарки, Прочее

2. **Global Financial Centers (ЦФО - Центры Финансовой Ответственности):**
   - Наличные
   - Банковская карта
   - Сбербанк, Тинькофф, Альфа-Банк
   - Электронный кошелек

3. **Global Cost Centers (МВЗ - Места Возникновения Затрат):**
   - Общий
   - Семейный бюджет, Личные расходы
   - Ремонт, Отпуск, Накопления

### Использование:

```bash
# Из корня проекта
python backend/db/seed_global_references.py

# Или из backend/db/
python seed_global_references.py
```

### Особенности:

- **Idempotent**: можно запускать многократно без дубликатов
- **Async**: использует async SQLAlchemy для производительности
- **Admin User**: автоматически создает system admin пользователя (telegram_id=1000000001) если не существует
- **Hierarchy Support**: для Articles создается иерархия (parent-child)
- **Logging**: детальное логирование всех операций

### Требования:

- База данных инициализирована (миграции применены)
- Файл `.env` с настройками БД (DATABASE_URL)
- Python 3.11+
- Зависимости: `sqlmodel`, `asyncpg`, `sqlalchemy[asyncio]`

### После запуска:

Все пользователи увидят созданные global справочники:
- В API: `GET /api/v1/articles?limit=100` (вернет user's + global)
- В API: `GET /api/v1/financial-centers?limit=100`
- В API: `GET /api/v1/cost-centers?limit=100`

### Примечания:

- Global records имеют `is_global=TRUE`
- Только administrators могут создавать/изменять/удалять global records
- User-specific records имеют `is_global=FALSE` (default)
- Все records используют SCD Type 2 versioning
