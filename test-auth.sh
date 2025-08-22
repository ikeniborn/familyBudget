#!/bin/bash

echo "=== Тест авторизации Family Budget ==="
echo "Время запуска: $(date)"

echo -e "\n1. Проверка доступности сервисов:"
echo "Frontend (5173):"
curl -I http://localhost:5173 2>/dev/null | head -1

echo "API (4000):"
curl -I http://localhost:4000 2>/dev/null | head -1

echo -e "\n2. Проверка health check API:"
curl -s http://localhost:4000/health | jq . 2>/dev/null || curl -s http://localhost:4000/health

echo -e "\n3. Тест страницы логина:"
login_response=$(curl -s http://localhost:5173/login)
if echo "$login_response" | grep -q "ДОМАШНИЙ"; then
    echo "✅ Страница логина загружается корректно"
else
    echo "❌ Проблема с загрузкой страницы логина"
fi

echo -e "\n4. Проверка редиректа на защищенные страницы:"
dashboard_response=$(curl -s -L http://localhost:5173/dashboard)
if echo "$dashboard_response" | grep -q "login\|ДОМАШНИЙ"; then
    echo "✅ Редирект с защищенных страниц работает"
else
    echo "❌ Возможна проблема с защитой страниц"
fi

echo -e "\n5. Проверка логов frontend на ошибки:"
echo "Последние 10 строк логов frontend:"
docker logs frontend-dev --tail 10

echo -e "\n=== Результат: Готов к тестированию в браузере ==="
echo "Откройте http://localhost:5173/login в браузере"
echo "Откройте консоль разработчика (F12)"
echo "Нажмите кнопку 'Войти (Тест)' и следите за логами"