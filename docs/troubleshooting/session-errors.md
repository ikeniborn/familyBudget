# Session Errors Troubleshooting Guide

**Last Updated:** 2025-09-13
**Version:** 1.0
**Scope:** Family Budget Session Management

## Overview

Это руководство поможет диагностировать и решить проблемы с сессиями в приложении Family Budget. После внедрения автоматической очистки сессий (ADR-005) большинство проблем решаются автоматически, но некоторые ситуации требуют ручного вмешательства.

## Quick Diagnostics

### 🚨 Emergency Commands

```bash
# Быстрая диагностика статуса контейнеров
docker ps | grep budget-

# Проверка Redis подключения
docker exec -it budget-redis redis-cli ping

# Проверка логов аутентификации
docker logs -f budget-backend --tail=50 | grep -i "session\|auth"

# Очистка всех сессий (крайняя мера)
docker exec -it budget-redis redis-cli FLUSHDB
```

## Common Session Errors

### 1. Error 401: "Not authenticated"

**Description:** Самая частая ошибка после обновления системы сессий.

#### Symptoms
```json
{
  "success": false,
  "error": "Not authenticated"
}
```
*HTTP Status: 401*

#### Automatic Resolution (NEW - 2025-09-13)

✅ **Система автоматически очищает невалидные сессии:**

1. **Невалидный user_id:** Автоматически очищается
   ```python
   # Система проверяет:
   try:
       user_id = int(user_id)
   except (TypeError, ValueError):
       # Автоматическая очистка
       await _clear_invalid_session(request)
   ```

2. **Пустые сессии:** Автоматически удаляются
   ```python
   if not user_id:
       await _clear_invalid_session(request)
   ```

3. **Cookie очистка:** Браузер автоматически получает команду удалить cookie

#### Manual Resolution

**Если проблема сохраняется:**

1. **Очистка браузерного кэша:**
   ```bash
   # Chrome DevTools (F12)
   Application > Storage > Clear Storage > Clear site data

   # Firefox DevTools (F12)
   Storage > Cookies > Delete all
   ```

2. **Проверка подключения к Redis:**
   ```bash
   docker exec -it budget-redis redis-cli
   > ping
   PONG
   > exit
   ```

3. **Перезапуск backend контейнера:**
   ```bash
   docker restart budget-backend
   ```

#### Prevention

- ✅ **Automatic:** Система предотвращает накопление невалидных сессий
- ✅ **Validation:** Строгая валидация данных при каждом запросе
- ✅ **Cleanup:** Автоматическое удаление поврежденных сессий

### 2. Session Not Persisting

**Description:** Сессия не сохраняется между запросами.

#### Symptoms
- Пользователь проходит аутентификацию, но сразу попадает на страницу входа
- Cookie `connect.sid` не появляется в браузере
- Логи показывают создание новых сессий при каждом запросе

#### Diagnosis

1. **Проверка Redis подключения:**
   ```bash
   docker exec budget-backend python -c "
   import redis.asyncio as redis
   import asyncio

   async def test():
       r = redis.from_url('redis://redis:6379/0')
       try:
           await r.ping()
           print('✅ Redis connection OK')
       except Exception as e:
           print(f'❌ Redis connection failed: {e}')
       finally:
           await r.aclose()

   asyncio.run(test())
   "
   ```

2. **Проверка SESSION_SECRET:**
   ```bash
   docker exec budget-backend env | grep SESSION_SECRET
   ```

#### Resolution

1. **Исправление Redis URL:**
   ```bash
   # В .env файле
   REDIS_URL=redis://budget-redis:6379/0
   ```

2. **Установка SESSION_SECRET:**
   ```bash
   # Генерация нового секрета
   openssl rand -hex 32

   # В .env файле
   SESSION_SECRET=your-generated-secret-here
   ```

3. **Перезапуск сервисов:**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### 3. Legacy Session Issues

**Description:** Проблемы с старыми форматами сессий.

#### Symptoms
- Ошибки при обращении к legacy сессиям
- Некорректное отображение данных пользователя
- Периодические ошибки валидации

#### Automatic Handling

✅ **Система автоматически обрабатывает legacy сессии:**

```python
# Автоматическая поддержка двух форматов
async def get_session(self, session_id: str):
    # Попытка загрузки express-session формата
    data = await self.redis.get(f"sess:{session_id}")
    if data:
        session_dict = json.loads(data)
        if "user" in session_dict:
            return SessionData(session_dict["user"])

    # Fallback к legacy формату
    data = await self.redis.get(f"session:{session_id}")
    if data:
        session_dict = json.loads(data)
        return SessionData(session_dict)
```

#### Manual Migration

**Если требуется принудительная миграция:**

```bash
# Скрипт миграции legacy сессий
docker exec -it budget-redis redis-cli --eval - <<'EOF'
local keys = redis.call('KEYS', 'session:*')
for i=1,#keys do
    local old_key = keys[i]
    local session_id = string.sub(old_key, 9)  -- Remove 'session:' prefix
    local new_key = 'sess:' .. session_id

    local data = redis.call('GET', old_key)
    if data then
        -- Wrap in express-session format
        local wrapped = '{"cookie":{"originalMaxAge":2592000000,"secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"user":' .. data .. '}'
        redis.call('SET', new_key, wrapped)
        redis.call('EXPIRE', new_key, 2592000)  -- 30 days
    end
end
return #keys
EOF
```

### 4. Cookie Security Issues

**Description:** Проблемы с настройками безопасности cookies.

#### Symptoms
- Cookies не устанавливаются в production
- HTTPS ошибки
- SameSite warnings в браузере

#### Resolution

1. **Production настройки:**
   ```python
   # В production.env
   ENVIRONMENT=production
   CORS_ORIGINS=https://yourdomain.com
   ```

2. **Development настройки:**
   ```python
   # В development.env
   ENVIRONMENT=development
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   ```

3. **Проверка настроек cookies:**
   ```python
   # Автоматические настройки based on environment
   secure = settings.ENVIRONMENT == "production"
   samesite = "lax"  # Совместимость с iframe
   httponly = True   # XSS защита
   ```

## Advanced Diagnostics

### Redis Session Analysis

```bash
# Подключение к Redis CLI
docker exec -it budget-redis redis-cli

# Просмотр всех сессий
> KEYS sess:*
> KEYS session:*

# Анализ конкретной сессии
> GET sess:your-session-id
> TTL sess:your-session-id

# Статистика сессий
> INFO keyspace
> MEMORY USAGE sess:your-session-id
```

### Session Data Validation

```bash
# Проверка формата данных сессии
docker exec budget-backend python -c "
import json
import redis.asyncio as redis
import asyncio

async def validate_session(session_id):
    r = redis.from_url('redis://redis:6379/0')
    try:
        # Проверка express-session формата
        data = await r.get(f'sess:{session_id}')
        if data:
            session_data = json.loads(data)
            print('Express-session format:', session_data)

            if 'user' in session_data:
                user_data = session_data['user']
                user_id = user_data.get('user_id') or user_data.get('id')
                print(f'User ID: {user_id} (type: {type(user_id)})')

                try:
                    int(user_id)
                    print('✅ User ID is valid')
                except:
                    print('❌ User ID is invalid')

        # Проверка legacy формата
        data = await r.get(f'session:{session_id}')
        if data:
            session_data = json.loads(data)
            print('Legacy format:', session_data)
    finally:
        await r.aclose()

# Замените на реальный session_id
asyncio.run(validate_session('your-session-id'))
"
```

### Performance Monitoring

```bash
# Мониторинг производительности Redis
docker exec -it budget-redis redis-cli --latency-history

# Мониторинг активных соединений
docker exec -it budget-redis redis-cli CLIENT LIST

# Статистика команд
docker exec -it budget-redis redis-cli --stat
```

## Error Scenarios and Solutions

### Scenario 1: Mass User Re-authentication

**Situation:** После обновления системы сессий многие пользователи переаутентифицируются.

**Expected Behavior:** ✅ Нормальное поведение
- Пользователи с невалидными сессиями будут автоматически переаутентифицированы
- Система автоматически очистит поврежденные данные
- Новые сессии будут стабильными

**Communication Script:**
```
Уважаемые пользователи!

В рамках улучшения безопасности системы была обновлена система аутентификации.
Если вы видите страницу входа, просто войдите в систему заново.

Все ваши данные сохранены и будут доступны после повторного входа.

Спасибо за понимание!
```

### Scenario 2: Redis Memory Issues

**Situation:** Redis потребляет слишком много памяти из-за накопления сессий.

**Solution:**
```bash
# Анализ использования памяти
docker exec -it budget-redis redis-cli MEMORY USAGE session:*

# Очистка просроченных сессий
docker exec -it budget-redis redis-cli --eval - <<'EOF'
local keys = redis.call('KEYS', 'sess:*')
local expired = 0
for i=1,#keys do
    local ttl = redis.call('TTL', keys[i])
    if ttl == -1 then  -- No expiration set
        redis.call('EXPIRE', keys[i], 2592000)  -- Set 30 days
    elseif ttl == -2 then  -- Key doesn't exist
        expired = expired + 1
    end
end
return expired
EOF

# Установка автоматической очистки
docker exec -it budget-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Scenario 3: Development Environment Issues

**Situation:** Проблемы с сессиями в development окружении.

**Quick Reset:**
```bash
# Полная очистка development окружения
docker-compose down -v
docker-compose up -d

# Пересоздание только Redis
docker-compose down redis
docker volume rm familybudget_redis_data
docker-compose up -d redis

# Перезапуск backend для переподключения
docker restart budget-backend
```

## Prevention Best Practices

### 1. Monitoring Setup

```bash
# Создание monitoring скрипта
cat > scripts/session-health-check.sh << 'EOF'
#!/bin/bash
echo "=== Family Budget Session Health Check ==="
echo "Timestamp: $(date)"

echo -e "\n📊 Redis Status:"
docker exec budget-redis redis-cli ping

echo -e "\n📈 Session Statistics:"
TOTAL_SESSIONS=$(docker exec budget-redis redis-cli eval "return #redis.call('KEYS', 'sess:*')" 0)
LEGACY_SESSIONS=$(docker exec budget-redis redis-cli eval "return #redis.call('KEYS', 'session:*')" 0)
echo "Express-session format: $TOTAL_SESSIONS"
echo "Legacy format: $LEGACY_SESSIONS"

echo -e "\n💾 Memory Usage:"
docker exec budget-redis redis-cli INFO memory | grep used_memory_human

echo -e "\n⏰ TTL Check (sample):"
SAMPLE_KEY=$(docker exec budget-redis redis-cli eval "local keys = redis.call('KEYS', 'sess:*'); return keys[1]" 0)
if [ "$SAMPLE_KEY" != "" ]; then
    TTL=$(docker exec budget-redis redis-cli TTL "$SAMPLE_KEY")
    echo "Sample session TTL: $TTL seconds"
fi

echo -e "\n✅ Health check completed"
EOF

chmod +x scripts/session-health-check.sh
```

### 2. Automated Cleanup

```bash
# Создание cleanup скрипта
cat > scripts/session-cleanup.sh << 'EOF'
#!/bin/bash
echo "🧹 Starting session cleanup..."

# Удаление сессий без TTL
CLEANED=$(docker exec budget-redis redis-cli --eval - <<'LUA'
local keys = redis.call('KEYS', 'sess:*')
local cleaned = 0
for i=1,#keys do
    local ttl = redis.call('TTL', keys[i])
    if ttl == -1 then
        redis.call('EXPIRE', keys[i], 2592000)
        cleaned = cleaned + 1
    end
end
return cleaned
LUA
)

echo "✅ Set TTL for $CLEANED sessions"

# Очистка legacy сессий старше 30 дней
LEGACY_CLEANED=$(docker exec budget-redis redis-cli --eval - <<'LUA'
local keys = redis.call('KEYS', 'session:*')
local cleaned = 0
for i=1,#keys do
    redis.call('EXPIRE', keys[i], 86400)  -- 1 day to migrate
    cleaned = cleaned + 1
end
return cleaned
LUA
)

echo "✅ Marked $LEGACY_CLEANED legacy sessions for migration"
echo "🎉 Cleanup completed"
EOF

chmod +x scripts/session-cleanup.sh
```

### 3. Cron Job Setup

```bash
# Добавление в cron для автоматического мониторинга
(crontab -l 2>/dev/null; echo "0 */6 * * * /path/to/familyBudget/scripts/session-health-check.sh >> /var/log/session-health.log 2>&1") | crontab -

# Еженедельная очистка
(crontab -l 2>/dev/null; echo "0 3 * * 0 /path/to/familyBudget/scripts/session-cleanup.sh >> /var/log/session-cleanup.log 2>&1") | crontab -
```

## Emergency Procedures

### Complete Session Reset

**⚠️ ВНИМАНИЕ: Все пользователи будут разлогинены**

```bash
# 1. Создание backup
docker exec budget-redis redis-cli BGSAVE

# 2. Очистка всех сессий
docker exec budget-redis redis-cli FLUSHDB

# 3. Перезапуск backend
docker restart budget-backend

# 4. Уведомление пользователей
echo "✅ All sessions cleared. Users need to re-authenticate."
```

### Redis Recovery

**Если Redis недоступен:**

```bash
# 1. Проверка статуса
docker ps | grep redis

# 2. Перезапуск Redis
docker restart budget-redis

# 3. Если контейнер не запускается
docker logs budget-redis --tail=50

# 4. Пересоздание с потерей данных (крайняя мера)
docker-compose down redis
docker volume rm familybudget_redis_data
docker-compose up -d redis
```

## Related Documentation

- [ADR-005: Улучшение системы обработки сессий](../architecture/adr-005-session-handling-improvements.md)
- [Authentication API Documentation](../api/authentication.md)
- [Test Coverage Report](../quality/test-coverage-session.md)
- [Main README - Common Issues](../../README.md#common-issues--solutions)

## Support Contacts

**For Development Issues:**
- Check logs: `docker logs -f budget-backend --tail=100`
- Run health check: `./scripts/session-health-check.sh`
- GitHub Issues: Create issue with logs and error details

**For Production Issues:**
- Follow emergency procedures above
- Contact system administrator
- Check monitoring dashboard: http://localhost:5173/admin/metrics

---

**Document Version:** 1.0
**Last Tested:** 2025-09-13
**Next Review:** 2025-12-13