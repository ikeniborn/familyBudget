#!/bin/bash

# Скрипт для тестирования JWT авторизации
# Убеждаемся, что .env.dev скопирован в .env и контейнеры запущены

BASE_URL="http://localhost:4000/api/auth"

echo "=== Тестирование JWT системы авторизации ==="
echo

# 1. Проверяем доступность паролей
echo "1. Проверка доступности авторизации по паролю..."
curl -s -X GET "$BASE_URL/check-password-enabled" | jq . || echo "Ошибка подключения"
echo

# 2. Регистрация нового пользователя
echo "2. Регистрация нового пользователя (testuser)..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "userName": "Тестовый пользователь",
    "userEmail": "test@example.com", 
    "username": "testuser",
    "password": "testpassword123"
  }')

echo "Ответ регистрации:"
echo $REGISTER_RESPONSE | jq . || echo $REGISTER_RESPONSE
echo

# Извлекаем токены из ответа регистрации
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.tokens.accessToken // empty')
REFRESH_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.tokens.refreshToken // empty')

if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
  echo "✓ Токен доступа получен: ${ACCESS_TOKEN:0:50}..."
  echo "✓ Refresh токен получен: ${REFRESH_TOKEN:0:50}..."
  echo
  
  # 3. Проверяем токен через /me
  echo "3. Проверка токена через /api/auth/me..."
  curl -s -X GET "$BASE_URL/me" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq . || echo "Ошибка JWT"
  echo
  
  # 4. Обновление токенов
  echo "4. Обновление токенов..."
  REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")
  
  echo "Новые токены:"
  echo $REFRESH_RESPONSE | jq . || echo $REFRESH_RESPONSE
  echo
  
  # 5. Выход из системы
  echo "5. Выход из системы (аннулирование refresh токена)..."
  curl -s -X POST "$BASE_URL/logout" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq . || echo "Ошибка"
  echo
else
  echo "❌ Не удалось зарегистрировать пользователя"
fi

# 6. Попытка входа
echo "6. Вход в систему с логином и паролем..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpassword123"
  }')

echo "Ответ входа:"
echo $LOGIN_RESPONSE | jq . || echo $LOGIN_RESPONSE
echo

# 7. Попытка доступа без токена
echo "7. Попытка доступа к защищенному ресурсу без токена..."
curl -s -X GET "$BASE_URL/me" | jq . || echo "Ошибка"
echo

echo "=== Тестирование завершено ==="