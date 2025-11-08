# Database Migrations (Alembic)

Инкрементальные миграции БД для Production Mode.

## ⚠️ НЕ ИСПОЛЬЗУЕТСЯ ДО РЕЛИЗА v5.0.0!

В Development Mode используйте `backend/db/schema/` для полной пересоздания БД.

## Production Mode (ПОСЛЕ v5.0.0)

### Создать миграцию:
```bash
alembic revision -m "add_user_preferences"
```

### Применить миграции:
```bash
alembic upgrade head
```

### Откатить:
```bash
alembic downgrade -1
```

См. полные правила в `CLAUDE.md`.
