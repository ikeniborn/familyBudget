# Инструкция по тестированию кнопки входа

## Проблема
Кнопка "Войти" на странице авторизации не реагирует на клики.

## Внесенные изменения

### 1. Добавлено отладочное логирование
В файл `/src/routes/login/+page.svelte` добавлено подробное логирование:
- Логирование клика по кнопке
- Проверка переменных окружения (browser, dev, loading)
- Вызов функций авторизации

### 2. Исправлен текст кнопки  
Теперь кнопка показывает "Войти (Тест)" в режиме разработки, что соответствует скриншоту.

### 3. Улучшено логирование в утилитах OAuth
Добавлено подробное логирование в функции `startTelegramOAuth` и `authService.startTelegramOAuth`.

## Шаги для тестирования

### 1. Откройте приложение в браузере
```
http://localhost:5173/login
```

### 2. Откройте консоль разработчика
- Chrome/Firefox: F12 или Ctrl+Shift+I
- Перейдите на вкладку "Console"

### 3. Нажмите кнопку "Войти (Тест)"
Если кнопка работает корректно, вы должны увидеть в консоли:
```
Кнопка входа нажата!
browser: true
dev: true  
loading: false
shouldUseMockAuth(): true
Запуск Telegram OAuth с botName: familybudget_test_bot
returnUrl: undefined
authService.startTelegramOAuth вызвана!
startTelegramOAuth вызвана!
Development mode: Using mock Telegram auth
Mock data: {...}
Redirecting to: http://localhost:5173/auth/callback#tgAuthResult=...
```

### 4. Проверьте редирект
После клика должен произойти автоматический редирект на страницу `/auth/callback` с mock данными.

### 5. Альтернативный способ тестирования
Если браузер недоступен, выполните в консоли браузера этот код:

```javascript
// Вставьте этот код в консоль браузера на странице логина
const loginButton = document.querySelector('.login-button');
if (loginButton) {
    console.log('✅ Кнопка найдена:', loginButton.textContent);
    loginButton.addEventListener('click', (e) => {
        console.log('🔥 КЛИК ЗАРЕГИСТРИРОВАН!', e);
    });
    loginButton.click(); // Симулируем клик
} else {
    console.log('❌ Кнопка не найдена');
}
```

## Возможные проблемы и решения

### Кнопка не реагирует на клики
1. **Проверьте JavaScript ошибки** в консоли браузера
2. **Убедитесь что контейнер запущен:**
   ```bash
   docker ps | grep frontend-dev
   ```
3. **Перезапустите контейнер разработки:**
   ```bash
   docker restart frontend-dev
   ```

### Логирование не появляется
1. **Очистите кеш браузера** (Ctrl+Shift+R)
2. **Проверьте что изменения применились:**
   ```bash
   docker exec frontend-dev cat /app/src/routes/login/+page.svelte | grep "console.log"
   ```
3. **Обновите страницу** полностью (F5)

### Редирект не происходит  
1. **Проверьте настройки блокировщика popup/redirect** в браузере
2. **Убедитесь что backend API запущен:**
   ```bash
   docker ps | grep frontend-api-dev
   ```

## Отладочные команды

### Проверка статуса контейнеров
```bash
docker ps | grep -E "(frontend-dev|frontend-api-dev)"
```

### Просмотр логов контейнера
```bash
docker logs -f frontend-dev
```

### Проверка доступности страниц
```bash
curl -I http://localhost:5173/login
curl -I http://localhost:4000/health  # Проверка API
```

## Очистка после тестирования

После завершения тестирования можно удалить отладочные логи для чистоты кода:
1. Удалите `console.log` сообщения из `+page.svelte`
2. Удалите отладочные логи из `telegram-oauth.ts` 
3. Удалите отладочные логи из `auth.service.ts`

## Контакты для поддержки

Если проблема не решена после выполнения всех шагов, проверьте:
- Статус всех Docker контейнеров
- Логи ошибок в контейнерах
- Сетевые настройки Docker
- Версии зависимостей в package.json