# Authentication API Documentation

**Last Updated:** 2025-09-13
**Version:** 2.0
**Status:** Active

## Overview

Family Budget использует сессионную аутентификацию на основе Redis с поддержкой множественных методов входа. Система обеспечивает безопасную аутентификацию через Telegram и пароль с автоматической очисткой невалидных сессий.

## Authentication Methods

### 1. Telegram Authentication (Primary)

Основной метод аутентификации через Telegram Bot API.

**Endpoint:** `POST /api/auth/telegram`

**Request Body:**
```json
{
  "telegram_data": {
    "id": 123456789,
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe",
    "auth_date": 1692012345,
    "hash": "telegram_hash_signature"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user_id": 42,
    "username": "johndoe",
    "user_name": "John Doe",
    "auth_method": "telegram",
    "telegram_id": 123456789,
    "role": "user"
  }
}
```

### 2. Password Authentication (Secondary)

Альтернативный метод аутентификации через логин и пароль.

**Endpoint:** `POST /api/auth/password`

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "secure_password"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user_id": 42,
    "username": "johndoe",
    "user_name": "John Doe",
    "auth_method": "password",
    "role": "user"
  }
}
```

## Session Management

### Session Format

Family Budget поддерживает два формата сессий для обеспечения совместимости:

#### Express-Session Format (Primary)
```json
{
  "cookie": {
    "originalMaxAge": 2592000000,
    "expires": "2025-10-13T10:30:00.000Z",
    "secure": false,
    "httpOnly": true,
    "path": "/",
    "sameSite": "lax"
  },
  "user": {
    "user_id": 42,
    "username": "johndoe",
    "user_name": "John Doe",
    "auth_method": "telegram",
    "telegram_id": 123456789,
    "role": "user"
  }
}
```

#### Legacy Format (Fallback)
```json
{
  "user_id": 42,
  "username": "johndoe",
  "user_name": "John Doe",
  "auth_method": "telegram",
  "telegram_id": 123456789,
  "role": "user"
}
```

### Session Storage

**Redis Keys:**
- **Primary:** `sess:{session_id}` (express-session format)
- **Fallback:** `session:{session_id}` (legacy format)

**Session Cookie:**
- **Name:** `connect.sid` (configurable via `SESSION_COOKIE_NAME`)
- **Duration:** 30 days (configurable via `SESSION_EXPIRE_SECONDS`)
- **Security:** HttpOnly, SameSite=Lax
- **Secure:** true в production, false в development

### Automatic Session Cleanup (NEW - 2025-09-13)

Система автоматически выполняет очистку невалидных сессий для обеспечения стабильной аутентификации:

#### Validation Rules

1. **User ID Validation:**
   ```python
   # user_id должен быть валидным целым числом
   try:
       user_id = int(user_id)
   except (TypeError, ValueError):
       # Невалидный user_id - очистка сессии
       await _clear_invalid_session(request)
   ```

2. **Empty Session Detection:**
   ```python
   # Пустые сессии без user_id автоматически очищаются
   if not user_id:
       await _clear_invalid_session(request)
   ```

3. **Cookie Management:**
   ```python
   # При очистке сессии cookie удаляется из браузера
   if session_was_cleared:
       response.delete_cookie(
           key=settings.SESSION_COOKIE_NAME,
           path="/",
           secure=settings.ENVIRONMENT == "production",
           samesite="lax"
       )
   ```

#### Automatic Cleanup Process

1. **Request Processing:**
   - Загружается сессия из Redis
   - Выполняется валидация user_id
   - При невалидных данных - автоматическая очистка

2. **Session Cleaning:**
   ```python
   async def _clear_invalid_session(request: Request) -> None:
       """Clear invalid session data."""
       session = getattr(request.state, "session", None)
       if session:
           session.clear()  # Очистка данных сессии

       session_id = getattr(request.state, "session_id", None)
       if session_id:
           await session_store.delete_session(session_id)  # Удаление из Redis
   ```

3. **Cookie Removal:**
   - При очистке сессии cookie автоматически удаляется
   - Пользователь перенаправляется на страницу входа

#### Benefits

✅ **Zero Configuration:** Автоматическая работа без дополнительной настройки
✅ **Performance:** Очистка "мусорных" сессий снижает нагрузку на Redis
✅ **Security:** Удаление поврежденных сессий повышает безопасность
✅ **UX:** Прозрачная работа для пользователей

## API Endpoints

### Authentication Status

**Get Current User:**
```http
GET /api/auth/me
```

**Response (Authenticated):**
```json
{
  "success": true,
  "data": {
    "user_id": 42,
    "username": "johndoe",
    "user_name": "John Doe",
    "auth_method": "telegram",
    "telegram_id": 123456789,
    "role": "user"
  }
}
```

**Response (Not Authenticated):**
```json
{
  "success": false,
  "error": "Not authenticated"
}
```
*HTTP Status: 401*

### Logout

**Endpoint:** `POST /api/auth/logout`

**Response:**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

## Error Handling

### Common Authentication Errors

| HTTP Status | Error Message | Description | Solution |
|-------------|---------------|-------------|----------|
| 401 | `Not authenticated` | Сессия отсутствует или невалидна | Повторный вход |
| 401 | `Invalid session data` | Поврежденные данные сессии | Автоматическая очистка и повторный вход |
| 403 | `Access denied` | Недостаточно прав доступа | Обращение к администратору |
| 422 | `Validation error` | Неверные данные запроса | Проверка формата данных |

### Session-Related Errors (Updated 2025-09-13)

#### Invalid User ID
```python
# Обработка невалидного user_id
try:
    user_id = int(session.get("user_id"))
except (TypeError, ValueError):
    # Автоматическая очистка сессии
    await _clear_invalid_session(request)
    return None
```

#### Empty Sessions
```python
# Обработка пустых сессий
if not user_id:
    # Сессия существует, но нет user_id - невалидная сессия
    await _clear_invalid_session(request)
    return None
```

#### Legacy Format Support
```python
# Поддержка старых форматов
user_id = session.get("user_id") or session.get("id")
user_name = session.get("user_name") or session.get("name")
```

## Security Features

### Session Security

1. **HttpOnly Cookies:** Защита от XSS атак
2. **Secure Flag:** HTTPS в production окружении
3. **SameSite:** Защита от CSRF атак
4. **Automatic Expiration:** Сессии автоматически истекают через 30 дней
5. **Data Validation:** Строгая валидация user_id и других данных (NEW)
6. **Automatic Cleanup:** Удаление поврежденных сессий (NEW)

### Data Isolation

Все API endpoints (кроме `/auth/*`) требуют аутентификации и автоматически фильтруют данные по `user_id`:

```python
@router.get("/periods/")
async def get_periods(current_user: dict = Depends(get_current_user)):
    """Get periods filtered by current user_id."""
    return await period_service.get_user_periods(current_user["user_id"])
```

### Rate Limiting

Рекомендуется внедрение rate limiting для authentication endpoints:

```python
# Рекомендуемые лимиты:
# /api/auth/telegram: 10 requests per minute
# /api/auth/password: 5 requests per minute
# /api/auth/me: 60 requests per minute
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_SECRET` | Required | Секретный ключ для подписи сессий |
| `SESSION_COOKIE_NAME` | `connect.sid` | Имя сессионного cookie |
| `SESSION_EXPIRE_SECONDS` | `2592000` | Время жизни сессии (30 дней) |
| `REDIS_URL` | `redis://redis:6379/0` | URL подключения к Redis |
| `PASSWORD_AUTH_ENABLED` | `true` | Включение аутентификации по паролю |
| `TELEGRAM_BOT_TOKEN` | Required | Token Telegram бота |

### Production Settings

```python
# production.env
SESSION_SECRET=your-very-secure-secret-key-here
REDIS_URL=redis://redis-server:6379/0
ENVIRONMENT=production
CORS_ORIGINS=https://yourdomain.com
```

## Usage Examples

### Frontend Integration (SvelteKit)

#### Check Authentication Status
```typescript
import { authStore } from '$lib/stores/auth.store.js';

// Проверка состояния аутентификации
authStore.subscribe(({ user, loading }) => {
  if (loading) {
    // Показать загрузку
    return;
  }

  if (!user) {
    // Перенаправить на страницу входа
    goto('/login');
    return;
  }

  // Пользователь аутентифицирован
  console.log('User ID:', user.user_id);
});
```

#### API Calls with Session
```typescript
// Все API вызовы автоматически включают session cookie
async function getPeriodsSecure() {
  const response = await fetch('/api/periods/', {
    credentials: 'include'  // Важно: включить cookies
  });

  if (response.status === 401) {
    // Сессия невалидна - перенаправление на вход
    goto('/login');
    return;
  }

  return await response.json();
}
```

### Backend Integration (FastAPI)

#### Protected Endpoint
```python
from app.core.dependencies import get_current_user

@router.get("/protected-data")
async def get_protected_data(current_user: dict = Depends(get_current_user)):
    """Protected endpoint that requires authentication."""
    user_id = current_user["user_id"]

    # Все данные автоматически фильтруются по user_id
    data = await service.get_user_data(user_id)
    return {"success": True, "data": data}
```

#### Custom Session Validation
```python
from app.core.session import get_current_user_from_session

async def custom_auth_check(request: Request):
    """Custom authentication check with additional validation."""
    user = await get_current_user_from_session(request)

    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Дополнительные проверки
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return user
```

## Migration Guide

### From Legacy Session Format

Система автоматически поддерживает legacy формат сессий. При первом доступе пользователя его сессия будет обновлена до нового формата.

**Automatic Migration Process:**
1. Загружается сессия в legacy формате
2. Данные валидируются по новым правилам
3. При сохранении используется express-session формат
4. Legacy сессия остается в Redis как fallback

### Code Migration

**Old Code:**
```python
# Старый способ получения user_id
user_id = session.get("id")  # Могло быть None или невалидным
```

**New Code:**
```python
# Новый способ с автоматической валидацией
user = await get_current_user_from_session(request)
if user:
    user_id = user["user_id"]  # Гарантированно валидное целое число
```

## Troubleshooting

### Common Issues

1. **Session Not Persisting**
   - Проверьте подключение к Redis
   - Убедитесь в корректности `SESSION_SECRET`
   - Проверьте настройки cookies в браузере

2. **401 Errors After Session Fixes**
   - Нормальное поведение для пользователей с поврежденными сессиями
   - Пользователи будут автоматически переаутентифицированы
   - Очистка браузерного кэша может ускорить процесс

3. **Legacy Session Issues**
   - Система автоматически обработает legacy сессии
   - При проблемах выполните: `docker exec budget-backend redis-cli FLUSHDB`
   - Все пользователи будут переаутентифицированы

### Debug Commands

```bash
# Проверка сессий в Redis
docker exec -it budget-redis redis-cli
> KEYS sess:*
> GET sess:your-session-id

# Проверка логов сессий
docker logs -f budget-backend --tail=100 | grep -i session

# Тестирование аутентификации
curl -b "connect.sid=your-session-id" http://localhost:4000/api/auth/me
```

## Related Documentation

- [ADR-005: Улучшение системы обработки сессий](../architecture/adr-005-session-handling-improvements.md)
- [Session Error Troubleshooting](../troubleshooting/session-errors.md)
- [Test Coverage Report](../quality/test-coverage-session.md)
- [API Security Guide](security-changes.md)

## Changelog

### Version 2.0 (2025-09-13)
- ✅ **NEW:** Автоматическая очистка невалидных сессий
- ✅ **NEW:** Строгая валидация user_id как целого числа
- ✅ **NEW:** Автоматическое управление cookies при очистке сессий
- ✅ **NEW:** Comprehensive test coverage (35 tests, 89% coverage)
- ✅ **IMPROVED:** Legacy format support with validation
- ✅ **FIXED:** 401 "Not authenticated" errors in settings pages

### Version 1.0 (2025-09-12)
- Initial implementation of session-based authentication
- Telegram and password authentication support
- Basic Redis session storage
- Express-session format compatibility