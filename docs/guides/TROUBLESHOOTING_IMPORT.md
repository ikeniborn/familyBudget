# Troubleshooting: Tinkoff Import 500 Error

## Проблема
При загрузке CSV файла в `/import` возникает ошибка:
```
POST /api/v1/import/tinkoff-csv 500 (Internal Server Error)
```

## Диагностика

### Шаг 1: Проверка infrastructure на сервере

SSH на dev сервер и запустите helper script:

```bash
cd ~/familyBudget
./scripts/check_import_setup.sh
```

Скрипт проверит:
- ✅ Статус Alembic миграций
- ✅ Наличие таблицы `t_import_staging`
- ✅ Структуру таблицы
- ✅ Количество записей в staging
- ✅ Подключение import router

### Шаг 2: Проверка миграций

```bash
cd ~/familyBudget
docker compose exec backend alembic current
```

**Ожидаемый результат:**
```
e60f86fd6465 (head)
```

Если текущая ревизия **НЕ** `e60f86fd6465`, то миграция `t_import_staging` не применена!

### Шаг 3: Применение миграций

```bash
cd ~/familyBudget
docker compose exec backend alembic upgrade head
```

**Проверка:**
```bash
docker compose exec postgres psql -U postgres -d familybudget -c "\d t_import_staging"
```

Должна быть таблица с колонками:
- id (bigint)
- user_id (integer)
- tinkoff_date (date)
- tinkoff_amount (varchar)
- tinkoff_category (varchar)
- tinkoff_mcc (varchar)
- tinkoff_description (text)
- tinkoff_card (varchar)
- article_id (integer)
- financial_center_id (integer)
- cost_center_id (integer)
- is_selected (boolean)
- created_at (timestamp with time zone)

### Шаг 4: Проверка логов backend

```bash
docker compose logs backend --tail=100 -f
```

Загрузите CSV файл и смотрите логи в реальном времени.

**Типичные ошибки:**

#### Ошибка: "relation t_import_staging does not exist"
**Решение:** Применить миграции (Шаг 3)

#### Ошибка: "ModuleNotFoundError: No module named 'backend.app.services.tinkoff_csv_parser'"
**Решение:**
```bash
cd ~/familyBudget
./deploy.sh --profile full
```

#### Ошибка: "column X does not exist"
**Решение:** Миграция применена частично. Откатить и применить заново:
```bash
docker compose exec backend alembic downgrade -1
docker compose exec backend alembic upgrade head
```

### Шаг 5: Проверка frontend кода

Проверьте в консоли браузера подробности ошибки:

```javascript
// После deploy обновлённой версии увидите:
Server error response: { detail: "..." }
```

Это даст точное сообщение об ошибке от backend.

## Быстрое исправление

### Если миграция не применена:

```bash
cd ~/familyBudget
git pull
./deploy.sh --profile full
```

### Если нужна только миграция:

```bash
cd ~/familyBudget
git pull
./deploy.sh --migrations-only
```

### Проверка после fix:

1. Зайти на https://budget-dev.ikeniborn.ru/import
2. Открыть Console (F12)
3. Загрузить CSV файл
4. Должно быть:
   - ✅ Нет 500 ошибок
   - ✅ Показывается статистика загрузки
   - ✅ Появляется таблица staging с транзакциями

## Полезные команды

### Просмотр всех миграций
```bash
docker compose exec backend alembic history
```

### Просмотр текущей миграции
```bash
docker compose exec backend alembic current
```

### Проверка staging таблицы
```bash
docker compose exec postgres psql -U postgres -d familybudget -c "SELECT * FROM t_import_staging LIMIT 5;"
```

### Очистка staging (для тестов)
```bash
docker compose exec postgres psql -U postgres -d familybudget -c "DELETE FROM t_import_staging;"
```

### Перезапуск backend
```bash
docker compose restart backend
```

## Проверка после исправления

1. ✅ `./scripts/check_import_setup.sh` - все проверки passed
2. ✅ Консоль браузера - детальное сообщение об ошибке (если есть)
3. ✅ Успешная загрузка CSV файла
4. ✅ Отображение staging таблицы с транзакциями

## Контакты

Если проблема не решена, предоставьте:
- Output от `./scripts/check_import_setup.sh`
- Backend logs: `docker compose logs backend --tail=50`
- Console error с подробностями
