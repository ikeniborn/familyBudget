# Исправление ошибки 422 при добавлении операции

## Проблема
При попытке добавить расход через форму `/fact` возникала ошибка HTTP 422 (Unprocessable Entity).

## Причина
Несоответствие имен полей между фронтендом и бэкендом:

### Фронтенд отправлял:
- `operation_dttm` - дата операции
- `comment_description` - комментарий  
- `cost_center_id` - МВЗ (может быть undefined)

### Бэкенд ожидал:
- `operation_date` - дата операции
- `comment` - комментарий
- `cost_center_id` - МВЗ (обязательное поле)

## Решение

### Изменения в `backend-fastapi/app/api/v1/endpoints/registry.py`:

1. **Обновлены схемы Pydantic:**
   - `RegistryCreate`: изменены имена полей для соответствия фронтенду
   - `RegistryUpdate`: аналогичные изменения для консистентности
   - `cost_center_id` сделан опциональным (Optional[int])

2. **Обновлены эндпоинты:**
   - `create_registry_entry`: добавлена трансформация полей перед сохранением
   - `create_bulk_registry_entries`: аналогичная трансформация для массового создания
   - `update_registry_entry`: трансформация полей при обновлении

3. **Маппинг полей:**
   ```python
   # Map frontend field names to database column names
   entry_dict["operation_date"] = entry_dict.pop("operation_dttm")
   entry_dict["comment"] = entry_dict.pop("comment_description", None)
   
   # Remove None values for optional fields
   if entry_dict.get("cost_center_id") is None:
       entry_dict.pop("cost_center_id", None)
   ```

## Дополнительные изменения в БД

### Проблема с cost_center_id
Поле `cost_center_id` в таблице `t_f_registry` было обязательным (NOT NULL), что вызывало ошибку при попытке создания записи без указания МВЗ.

### Решение
Выполнена миграция БД:
```sql
ALTER TABLE t_f_registry ALTER COLUMN cost_center_id DROP NOT NULL;
```

Обновлена модель SQLAlchemy:
```python
cost_center_id = Column(Integer, ForeignKey("t_d_cost_center.cost_center_id"), nullable=True)
```

## Проблема с форматом даты

### Дополнительная проблема
Фронтенд отправлял дату в формате строки `YYYY-MM-DD`, а бэкенд ожидал объект `datetime`.

### Решение
Добавлен валидатор Pydantic для автоматического преобразования форматов даты:
```python
@validator('operation_dttm', pre=True)
def parse_operation_date(cls, value):
    """Convert string date to datetime."""
    if isinstance(value, str):
        try:
            return datetime.strptime(value, '%Y-%m-%d')
        except ValueError:
            return datetime.fromisoformat(value)
    elif isinstance(value, date) and not isinstance(value, datetime):
        return datetime.combine(value, datetime.min.time())
    return value
```

## Результат
Форма добавления операции теперь работает корректно:
- Имена полей синхронизированы между фронтендом и бэкендом
- МВЗ является опциональным полем
- Даты автоматически конвертируются в нужный формат
- Данные успешно сохраняются в базу данных

## Дата исправления
2025-09-03