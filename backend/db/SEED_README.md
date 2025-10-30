# Database Seeding & Bootstrap

## Bootstrap: Create First Admin

⚠️ **ВАЖНО:** Этот скрипт нужно запустить **сразу после установки**, перед первым входом в систему!

Скрипт `create_first_admin.py` решает проблему "курицы и яйца" при первоначальной установке:
- Система требует наличие пользователя в БД перед аутентификацией
- Только администратор может создавать пользователей через admin panel
- Admin panel требует аутентификации (замкнутый круг!)

**Решение:** Bootstrap скрипт создает первого администратора из `ADMIN_TELEGRAM_ID` в `.env`.

### Использование:

```bash
# В production (Docker):
docker exec familybudget-backend bash -c "cd /app && PYTHONPATH=/app python backend/db/create_first_admin.py"

# Локально (если настроено окружение):
cd ~/familyBudget
python backend/db/create_first_admin.py
```

### Что делает скрипт:

1. Читает `ADMIN_TELEGRAM_ID` из `.env` (например, `740775802`)
2. Проверяет существование пользователя с этим Telegram ID
3. Если не существует - создает запись в `t_d_user`:
   - `telegram_id` = из `.env`
   - `is_admin` = `true`
   - `username`, `first_name`, `last_name` = placeholder (обновятся при первом входе)
   - SCD Type 2 fields: `is_current=true`, `valid_from`, `valid_to`
4. Если уже существует - выводит информацию о существующем админе

### Особенности:

- **Idempotent**: безопасно запускать многократно
- **Reads from .env**: использует `ADMIN_TELEGRAM_ID` из environment
- **Raw SQL**: избегает проблем с импортом ORM моделей
- **SCD Type 2**: корректная структура для dimension таблицы
- **Auto-update on login**: username/first_name/last_name обновятся из Telegram при первом входе

### После запуска:

1. Администратор может войти через Telegram OAuth:
   ```
   https://your-domain.com/api/v1/auth/telegram-login
   ```
2. Профиль автоматически обновится данными из Telegram (username, имя)
3. Администратор получит доступ к admin panel
4. Через admin panel можно создавать других пользователей

### Требования:

- База данных инициализирована (миграции применены)
- `ADMIN_TELEGRAM_ID` установлен в `.env`
- Docker контейнер backend запущен

---

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
