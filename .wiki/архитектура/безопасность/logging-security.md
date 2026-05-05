---
wiki_sources: ["docs/architecture/security/logging-best-practices.md", "docs/architecture/core/authentication.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["JWT"]
aliases: ["Logging Security", "PII Protection", "hash_email_for_logging"]
---

# Безопасность логирования

Практики защиты персональных данных (PII) в логах backend. Ключевой принцип: в logs попадают только хеши идентификаторов, не raw данные.

## Основные характеристики

### PII — никогда не логировать напрямую

- Email адреса
- Телефонные номера, физические адреса
- Пароли (даже хешированные)
- Токены и API ключи
- Telegram IDs (в production)

### Утилита hash_email_for_logging()

```python
from backend.app.core.logging_utils import hash_email_for_logging

# ❌ Запрещено
logger.info(f"User login: email={user_email}")

# ✅ Правильно
logger.info(f"User login: email_hash={hash_email_for_logging(user_email)}")
```

Функция: SHA256 → первые 8 символов. Нормализует email (lowercase). Достаточная энтропия для различения пользователей без раскрытия PII.

### Идентификаторы в логах

- `user_id` (int) — основной идентификатор
- `email_hash` — для корреляции без раскрытия
- `telegram_id` — только в dev/test окружении

### Клиентские сообщения об ошибках

```python
# ✅ Правильно: generic message для клиента + полный лог для сервера
except Exception as e:
    logger.error(f"[OPERATION] Error: plan_id={plan_id}", exc_info=True)
    return {"error": "Internal server error"}  # Не раскрывать детали
```

## Связанные концепции

- [[аутентификация]]
