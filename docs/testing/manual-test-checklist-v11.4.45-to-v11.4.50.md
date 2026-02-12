# Ручной тест-план: v11.4.45 → v11.4.50

## Критичные изменения

- ✅ **v11.4.50**: Healthcheck бота восстановлен
- 🔧 **v11.4.49**: StaticCacheMiddleware фикс
- 🐍 **v11.4.47**: PYTHONPATH для distroless
- 📦 **v11.4.46**: Cache-Control middleware

---

## 🔴 Тест 1: Bot Container (5 мин)

### 1.1 PYTHONPATH и импорты
```bash
ssh budget-test "docker exec familybudget-bot /usr/bin/python3.11 -c 'import sys; print(sys.path)'"
```
**Ожидается:** `/opt/venv/lib/python3.11/site-packages:/app`

```bash
ssh budget-test "docker exec familybudget-bot /usr/bin/python3.11 -c 'import bot.main; print(\"OK\")'"
```
**Ожидается:** `OK`

### 1.2 Логи бота
```bash
ssh budget-test "docker logs familybudget-bot --tail 50"
```
**Проверить:** Нет ошибок импорта, есть сообщения о запуске polling

### 1.3 Healthcheck
```bash
ssh budget-test "docker ps --filter name=bot --format '{{.Status}}'"
```
**Ожидается:** `Up Xs (healthy)`

```bash
ssh budget-test "docker inspect familybudget-bot --format='{{.State.Health.Status}}'"
```
**Ожидается:** `"healthy"`

**✅ Критерий:** Bot запущен, healthcheck работает, нет ошибок импорта

---

## 🔴 Тест 2: Static Files & Cache-Control (10 мин)

### 2.1 Статические файлы доступны
```bash
curl -I https://fbd.ikeniborn.ru/static/css/output.css?v=11.4.50
```
**Ожидается:** `HTTP/2 200`

### 2.2 Версионированные файлы (1 год кеш)
```bash
curl -I https://fbd.ikeniborn.ru/static/css/output.css?v=11.4.50 | grep -i cache-control
```
**Ожидается:** `max-age=31536000, immutable`

### 2.3 Service Worker (no-cache)
```bash
curl -I https://fbd.ikeniborn.ru/sw.js | grep -i cache-control
```
**Ожидается:** `no-cache, must-revalidate`

### 2.4 manifest.json (1 час кеш)
```bash
curl -I https://fbd.ikeniborn.ru/manifest.json | grep -i cache-control
```
**Ожидается:** `max-age=3600`

### 2.5 Логи backend (нет ошибок middleware)
```bash
ssh budget-test "docker logs familybudget-backend --tail 100 | grep -i 'AttributeError\|500'"
```
**Ожидается:** Пусто (нет ошибок)

**✅ Критерий:** Все файлы доступны, заголовки корректны, нет 500 ошибок

---

## 🔴 Тест 3: Nginx Cache (2 мин)

### 3.1 Deploy script функция
```bash
ssh budget-test "grep -n 'clear_nginx_cache' /opt/budget/scripts/lib/services.sh"
```
**Ожидается:** Найдена функция

### 3.2 Nginx cache директория
```bash
ssh budget-test "docker exec familybudget-nginx ls -la /var/cache/nginx/"
```
**Ожидается:** Пустая или минимальные файлы

**✅ Критерий:** Функция очистки есть, cache директория чистая

---

## 🟡 Тест 4: Regression (5 мин)

### 4.1 Web приложение
**Браузер:** https://fbd.ikeniborn.ru/
**Проверить:** Страница загружается, нет JS ошибок в консоли

### 4.2 API Health
```bash
curl -s https://fbd.ikeniborn.ru/api/v1/health | jq '.'
```
**Ожидается:** `{"status": "ok"}`

### 4.3 Telegram bot
**Telegram:** Отправить `/start` боту
**Ожидается:** Бот отвечает

**✅ Критерий:** Основная функциональность работает

---

## 📊 Финальный чеклист

| Тест | Статус | Примечание |
|------|--------|------------|
| Bot PYTHONPATH | ☐ |  |
| Bot импорт модулей | ☐ |  |
| Bot healthcheck | ☐ |  |
| Static files HTTP 200 | ☐ |  |
| Cache-Control версионированные | ☐ |  |
| Cache-Control Service Worker | ☐ |  |
| Cache-Control manifest | ☐ |  |
| Backend без ошибок | ☐ |  |
| Nginx cache функция | ☐ |  |
| Web app загружается | ☐ |  |
| API health работает | ☐ |  |
| Telegram bot отвечает | ☐ |  |

---

## ✅ Критерий готовности к production

**Деплой в production возможен, если:**
- ✅ Все тесты в чеклисте пройдены (12/12)
- ✅ Healthcheck стабилен 24+ часа на test server
- ✅ Нет критичных ошибок в логах

**Время выполнения:** ~25 минут

**Следующий шаг:** После успешного прохождения → деплой в production
