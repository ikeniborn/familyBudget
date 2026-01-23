# Logging Best Practices

## Обзор

Этот документ описывает лучшие практики безопасного логирования для проекта Family Budget.

## PII Protection (Защита персональных данных)

### Правила логирования PII

**НИКОГДА не логируйте следующие данные напрямую:**
- Email адреса
- Телефонные номера
- Физические адреса
- Пароли (даже хешированные)
- Токены и API ключи
- Данные кредитных карт
- Telegram IDs (в production)

### Использование hash_email_for_logging()

**Backend (Python):**
```python
from backend.app.core.logging_utils import hash_email_for_logging

# ❌ НЕ ПРАВИЛЬНО
logger.info(f"User login: email={user_email}")

# ✅ ПРАВИЛЬНО
logger.info(f"User login: email_hash={hash_email_for_logging(user_email)}")
```

**Что делает функция:**
- Создает SHA256 хеш email адреса
- Возвращает первые 8 символов хеша
- Нормализует email (lowercase) для консистентности
- Обеспечивает достаточную энтропию для различения пользователей

**Примеры:**
```python
hash_email_for_logging("user@example.com")  # → "b4c9a289"
hash_email_for_logging("USER@EXAMPLE.COM")  # → "b4c9a289" (тот же хеш)
```

### Идентификация пользователей в логах

**Используйте:**
- `user_id` (целое число) - основной идентификатор
- `email_hash` - для корреляции с email без раскрытия
- `telegram_id` (только в dev/test) - для отладки

**Пример:**
```python
logger.info(
    f"[AUTH_EMAIL] Failed login: email_hash={hash_email_for_logging(data.email)}, "
    f"ip={request.client.host}"
)
```

## Stack Trace Security

### Generic Error Messages для клиента

**Проблема:**
```python
# ❌ НЕ ПРАВИЛЬНО - раскрывает технические детали
except Exception as e:
    error_msg = f"Unexpected error: {str(e)}"
    return {"error": error_msg}  # Клиент видит stack trace детали
```

**Решение:**
```python
# ✅ ПРАВИЛЬНО
except Exception as e:
    # Полный лог для debugging (только в server logs)
    logger.error(f"[OPERATION] Error: plan_id={plan_id}", exc_info=True)

    # Generic message для клиента
    return {
        "error": "An unexpected error occurred. Please try again later."
    }
```

### Когда использовать exc_info=True

**✅ Используйте:**
- В backend логах (server-side only)
- Для debugging и мониторинга
- В error handlers

**❌ НЕ используйте:**
- В API responses для клиента
- В frontend логах (может раскрыть структуру кода)
- В production alerts пользователям

## Frontend Security

### XSS Prevention

**❌ НЕ ПРАВИЛЬНО:**
```javascript
// ОПАСНО - позволяет XSS атаку
statusEl.innerHTML = `<span>Error: ${error.message}</span>`;
```

**✅ ПРАВИЛЬНО:**
```javascript
// Безопасно - использует textContent
statusEl.innerHTML = '';
const span = document.createElement('span');
span.textContent = `Error: ${error.message}`;  // textContent экранирует HTML
statusEl.appendChild(span);
```

### Secure Random Generation

**❌ НЕ ПРАВИЛЬНО:**
```javascript
// Math.random() предсказуем
const sessionId = `${Date.now()}-${Math.random().toString(36)}`;
```

**✅ ПРАВИЛЬНО:**
```javascript
// crypto.getRandomValues() криптографически стойкий
const randomBytes = new Uint8Array(8);
crypto.getRandomValues(randomBytes);
const randomPart = Array.from(randomBytes)
    .map(byte => byte.toString(36))
    .join('')
    .substring(0, 13);
const sessionId = `${Date.now()}-${randomPart}`;
```

## Password Security

### Validation Error Messages

**❌ НЕ ПРАВИЛЬНО:**
```python
# Может логировать части пароля в error message
logger.error(f"Password validation failed: {error_message}")
```

**✅ ПРАВИЛЬНО:**
```python
# Generic message без деталей пароля
logger.error("Password validation failed. Please check password requirements.")
```

### Никогда не логируйте:
- Сырые пароли (plain text)
- Частичные пароли
- Пароли в error messages
- Хеши паролей (даже bcrypt/argon2)

## Testing Security

### Тестовые логи (CI/CD)

**❌ НЕ ПРАВИЛЬНО:**
```python
# print() попадает в CI/CD артефакты
print(f"Testing user: {test_user.email}")
```

**✅ ПРАВИЛЬНО:**
```python
import logging
logger = logging.getLogger(__name__)

# logger.debug() можно контролировать уровнем логирования
logger.debug(f"Testing user: user_id={test_user.id}")
```

### Тестовые данные

**Используйте:**
- Фиктивные email адреса (`test@example.com`)
- Тестовые ID вместо реальных
- Mock данные для production-подобных сценариев

## GitHub Actions Security

### Minimal Permissions

**❌ НЕ ПРАВИЛЬНО:**
```yaml
# Отсутствие permissions → максимальные права по умолчанию
jobs:
  build:
    runs-on: ubuntu-latest
```

**✅ ПРАВИЛЬНО:**
```yaml
permissions:
  contents: read  # Минимальные права

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read  # Job-level permissions
```

**Principle of Least Privilege:**
- Всегда указывайте минимально необходимые permissions
- Используйте job-level permissions для точного контроля
- Избегайте `write` прав без необходимости

## Monitoring и Alerts

### Безопасные метрики

**Логируйте:**
- Количество неудачных попыток входа (без email)
- IP адреса подозрительных запросов
- Временные метрики (response times)
- Error rates (без stack traces)

**НЕ логируйте:**
- Email адреса в alert messages
- Sensitive data в метриках
- Full error messages в production alerts

## Compliance

### GDPR / Privacy

Логирование email и других PII требует:
- Законного основания (legitimate interest)
- Информирования пользователей (privacy policy)
- Права на удаление (retention policies)

**Наш подход:**
- Используем `hash_email_for_logging()` вместо plain email
- Удаляем логи через 30 дней (retention policy)
- Не храним sensitive data в permanent logs

## Чеклист безопасного логирования

- [ ] Используется `hash_email_for_logging()` вместо plain email
- [ ] `exc_info=True` только в backend логах, не в client responses
- [ ] Generic error messages для пользователей
- [ ] Нет паролей или токенов в логах
- [ ] `crypto.getRandomValues()` для генерации ID
- [ ] `textContent` вместо `innerHTML` для user-generated content
- [ ] `logger.debug()` вместо `print()` в тестах
- [ ] GitHub Actions с minimal permissions
- [ ] Нет userAgent в глобальных конфигах

## См. также

- [Authentication](../authentication.md) - JWT и OAuth security
- [Frontend Security](../frontend/security.md) - XSS prevention
- [CI/CD Security](../ci-cd-build-deploy.md) - Pipeline security
