# Руководство по устранению ошибки 401 при доступе к /settings

## 📋 Описание проблемы

**Симптомы:**
- Администраторы получают ошибку **401 (Unauthorized)** при попытке доступа к `/settings`
- В логах видны ошибки аутентификации
- API `/api/auth/me` возвращает 401 даже при действительной сессии

**Затронутые пользователи:**
- Пользователи с ролью `admin`
- Доступ к любым настройкам системы (`/settings/*`)

## 🔍 Диагностика

### Шаг 1: Проверка статуса контейнеров
```bash
# Проверяем статус всех контейнеров
docker ps -a | grep budget-

# Ожидаемый результат: все контейнеры должны быть UP
```

### Шаг 2: Проверка backend API
```bash
# Тестируем API аутентификации без cookies
docker exec budget-backend curl -s -w "HTTP Status: %{http_code}\n" http://localhost:4000/api/auth/me

# Ожидаемый результат: HTTP Status: 401 (это нормально без аутентификации)
```

### Шаг 3: Проверка сетевого соединения
```bash
# Проверяем связь frontend → backend
docker exec budget-frontend wget -qO- --server-response http://budget-backend:4000/health 2>&1

# Ожидаемый результат: {"status":"healthy",...} и HTTP/1.1 200 OK
```

### Шаг 4: Проверка пользователей-администраторов
```bash
# Проверяем наличие админов в БД
docker exec budget-postgres psql -U budget -d budgetdb -c "SELECT user_id, user_name, user_role FROM t_d_user WHERE user_role = 'admin';"

# Ожидаемый результат: список пользователей с ролью 'admin'
```

### Шаг 5: Проверка Redis сессий
```bash
# Проверяем активные сессии
docker exec budget-redis redis-cli KEYS "*"

# Проверяем данные конкретной сессии
docker exec budget-redis redis-cli GET "sess:session-id"
```

## 🔧 Решение проблемы

### Решение выполнено в рамках ADR-008
**Файл исправления:** `/frontend-svelte/src/hooks.server.ts`

**Основные изменения:**

1. **Улучшена обработка форматов cookies:**
```typescript
// Поддержка различных форматов session ID
let sessionId = connectSid || familyBudgetSid;

if (sessionId) {
  // Удаляем префиксы и суффиксы
  sessionId = sessionId.replace(/^s:/, '').replace(/\..*$/, '');
}
```

2. **Правильное формирование cookie headers:**
```typescript
const cookieHeader = connectSid
  ? `connect.sid=${connectSid}`
  : familyBudgetSid
  ? `familybudget.sid=${familyBudgetSid}`
  : `connect.sid=s:${sessionId}`;
```

3. **Унифицированная обработка ответов API:**
```typescript
if (userData.success && userData.user) {
  event.locals.user = userData.user;
} else if (userData.id || userData.user_id) {
  event.locals.user = {
    id: userData.id || userData.user_id,
    user_id: userData.user_id || userData.id,
    username: userData.username || userData.user_name,
    role: userData.role || userData.user_role || 'user',
    // ...
  };
}
```

### Применение исправления

```bash
# 1. Перезапустите frontend контейнер
docker restart budget-frontend

# 2. Подождите запуска
sleep 10

# 3. Проверьте статус
docker ps -a | grep budget-frontend
```

## ✅ Проверка исправления

### 1. Проверка API аутентификации
```bash
# Логи должны показывать успешные запросы
docker logs budget-frontend --tail=10

# Ожидаемые логи:
# [PROXY] GET /api/auth/me <- 200
```

### 2. Проверка доступа к настройкам
```bash
# Тестируем доступ без авторизации (должен быть редирект)
curl -s -w "HTTP Status: %{http_code}\n" http://localhost:5173/settings

# Ожидаемый результат: HTTP Status: 303 (редирект на логин)
```

### 3. Проверка логирования в development
Если `NODE_ENV=development`, в логах frontend должны появиться:
```
[Auth Debug] User loaded: { userId: 1, role: 'admin', sessionId: 'a9ebccca...' }
```

## 🚨 Если проблема не решена

### Дополнительная диагностика

#### 1. Проверка environment переменных
```bash
# Проверяем BACKEND_URL в frontend контейнере
docker exec budget-frontend env | grep BACKEND_URL

# Должно быть: BACKEND_URL=http://budget-backend:4000
```

#### 2. Детальная проверка логов
```bash
# Frontend логи с детализацией
docker logs budget-frontend --tail=50

# Backend логи
docker logs budget-backend --tail=50

# Поиск ошибок аутентификации
docker logs budget-backend 2>&1 | grep -i "auth\\|401\\|unauthorized"
```

#### 3. Проверка формата session cookies
```bash
# Проверяем формат cookies в браузере (Developer Tools → Application → Cookies)
# Должны быть: connect.sid или familybudget.sid
```

#### 4. Ручное тестирование API
```bash
# Получаем session ID из браузера и тестируем API напрямую
docker exec budget-backend curl -s \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -w "HTTP Status: %{http_code}\n" \
  http://localhost:4000/api/auth/me
```

### Альтернативные решения

#### 1. Полная перезагрузка системы
```bash
docker-compose down
docker-compose up -d
```

#### 2. Очистка cookies и повторная авторизация
- Очистите cookies в браузере
- Выполните повторный вход в систему
- Проверьте доступ к `/settings`

#### 3. Проверка сессий в Redis
```bash
# Удалите все сессии (ОСТОРОЖНО: все пользователи будут разлогинены)
docker exec budget-redis redis-cli FLUSHALL

# Выполните повторный вход
```

## 📊 Мониторинг и предотвращение

### Автоматические проверки
```bash
# Создайте скрипт мониторинга
cat > /home/ikeniborn/Documents/Project/familyBudget/scripts/monitor-auth.sh << 'EOF'
#!/bin/bash
echo "=== Проверка состояния аутентификации ==="
echo "1. Контейнеры:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep budget-

echo -e "\n2. Backend health:"
docker exec budget-backend curl -s http://localhost:4000/health | jq .

echo -e "\n3. API auth endpoint:"
docker exec budget-backend curl -s -w "Status: %{http_code}\n" http://localhost:4000/api/auth/me

echo -e "\n4. Frontend logs (последние 5 строк):"
docker logs budget-frontend --tail=5

echo -e "\n5. Redis сессии:"
docker exec budget-redis redis-cli KEYS "*" | wc -l | xargs echo "Активных сессий:"
EOF

chmod +x /home/ikeniborn/Documents/Project/familyBudget/scripts/monitor-auth.sh
```

### Регулярные проверки
```bash
# Запускайте еженедельно
./scripts/monitor-auth.sh
```

## 📚 Связанная документация

- [ADR-008: Исправление авторизации администратора](/docs/architecture/adr-008-admin-settings-auth-fix.md)
- [ADR-006: Role-Based Access Control](/docs/architecture/adr-006-role-based-access-control.md)
- [API Authentication Guide](/docs/api/authentication.md)
- [Docker Development Guide](/docs/deployment/docker-setup.md)

## 🔗 Полезные команды

```bash
# Быстрая диагностика всех компонентов
./scripts/dev.sh --health-check

# Полный перезапуск в случае проблем
docker-compose down && docker-compose up -d

# Проверка конфигурации
docker exec budget-frontend cat /app/src/hooks.server.ts | grep -A 10 -B 5 "backendUrl"

# Логи всех сервисов
docker-compose logs -f --tail=20
```

---

**Последнее обновление:** 16.09.2025
**Версия документа:** 1.0
**Применимо к версии:** v3.3.3+