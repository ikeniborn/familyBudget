# Browser DevTools Testing Guide

## Цель: Проверка Cache-Control, статических файлов и Service Worker

**Время:** ~10 минут
**Инструменты:** Chrome/Firefox DevTools
**URL:** https://fbd.ikeniborn.ru/

---

## 📝 Подготовка

1. **Открыть браузер** (Chrome или Firefox)
2. **Открыть DevTools:**
   - Windows/Linux: `F12` или `Ctrl+Shift+I`
   - Mac: `Cmd+Option+I`
3. **Перейти на сайт:** https://fbd.ikeniborn.ru/
4. **Авторизоваться** (если требуется)

---

## ✅ Тест 1: Cache-Control заголовки (5 мин)

### Шаг 1: Открыть Network tab

1. DevTools → **Network** tab
2. ✅ Поставить галочку **Disable cache** (важно!)
3. Нажать **Ctrl+Shift+R** (hard refresh)

### Шаг 2: Проверить статические файлы

**Найти файлы в списке:**
- `output.css?v=11.4.50` (или другая версия)
- `main.js?v=11.4.50`
- `sw.js`
- `manifest.json`

### Шаг 3: Проверить заголовки для каждого файла

**Для версионированных файлов (CSS/JS с ?v=...):**

1. Click на файл `output.css?v=11.4.50`
2. **Headers** tab → **Response Headers**
3. Найти `Cache-Control`

**Ожидается:**
```
Cache-Control: max-age=31536000, immutable
```

**Проверить:**
- [ ] `max-age=31536000` (1 год = 365 дней × 24 часа × 3600 сек)
- [ ] `immutable` (файл неизменяемый)

**Скриншот для справки:**
```
Response Headers:
  cache-control: max-age=31536000, immutable
  content-type: text/css
  content-length: 123456
```

---

**Для Service Worker (sw.js):**

1. Click на `sw.js`
2. **Headers** tab → **Response Headers**
3. Найти `Cache-Control`

**Ожидается:**
```
Cache-Control: no-cache, must-revalidate
```

**Проверить:**
- [ ] `no-cache` (не кешировать в браузере)
- [ ] `must-revalidate` (всегда проверять с сервером)

**Зачем:** Service Worker должен всегда загружаться свежий, чтобы обновления приложения применялись сразу.

---

**Для manifest.json:**

1. Click на `manifest.json`
2. **Headers** tab → **Response Headers**
3. Найти `Cache-Control`

**Ожидается:**
```
Cache-Control: max-age=3600
```

**Проверить:**
- [ ] `max-age=3600` (1 час = 3600 секунд)

**Зачем:** manifest.json кешируется на 1 час для производительности, но не на год.

---

### Шаг 4: Проверить невероsionированные файлы (если есть)

**Примеры:** `favicon.ico`, `robots.txt`, статические изображения без `?v=`

**Ожидается:**
```
Cache-Control: max-age=3600, must-revalidate
```

**Проверить:**
- [ ] `max-age=3600` (1 час)
- [ ] `must-revalidate` (проверять актуальность)

---

## ✅ Тест 2: Статические файлы загрузка (3 мин)

### Шаг 1: Проверить статус код файлов

**В Network tab:**

1. Фильтр: **CSS** (или используйте поиск по `.css`)
2. Проверить столбец **Status**

**Проверить:**
- [ ] Все CSS файлы: **200** (не 404, не 500)
- [ ] output.css?v=11.4.50: **200 OK**

3. Фильтр: **JS**
4. Проверить столбец **Status**

**Проверить:**
- [ ] Все JS файлы: **200** (не 404, не 500)
- [ ] main.js?v=11.4.50: **200 OK**

### Шаг 2: Проверить Console на ошибки

**DevTools → Console tab**

**Проверить:**
- [ ] Нет ошибок типа `Failed to load resource: 500 (Internal Server Error)`
- [ ] Нет ошибок типа `Failed to load resource: 404 (Not Found)`
- [ ] Нет красных сообщений об ошибках загрузки CSS/JS

**Если есть ошибки:**
- Скопировать текст ошибки
- Проверить какой файл не загружается

### Шаг 3: Визуальная проверка

**Проверить на странице:**
- [ ] Страница стилизована (есть цвета, шрифты)
- [ ] Кнопки имеют правильные стили
- [ ] Нет "голого" HTML (без CSS)
- [ ] JavaScript работает (интерактивные элементы работают)

---

## ✅ Тест 3: Service Worker (5 мин)

### Шаг 1: Открыть Application tab

**DevTools → Application tab**

Слева в меню найти:
```
Application
  └─ Service Workers
```

### Шаг 2: Проверить регистрацию

**Проверить:**
- [ ] Service Worker зарегистрирован
- [ ] Source: `/sw.js` или полный URL
- [ ] Status: **activated and is running**

**Скриншот для справки:**
```
Service Workers
  https://fbd.ikeniborn.ru/
    Source: /sw.js
    Status: #12345 activated and is running
    □ Offline
    □ Update on reload
```

### Шаг 3: Проверить версию и обновление

**Действия:**

1. Нажать **Update** (кнопка рядом со статусом)
2. Подождать 2-3 секунды
3. Проверить, что статус остался **activated and is running**

**Проверить:**
- [ ] После Update статус не изменился на "waiting" или "redundant"
- [ ] Новая версия активировалась (если была)

### Шаг 4: Тест offline режима (опционально)

**Действия:**

1. Поставить галочку ✅ **Offline**
2. Попробовать обновить страницу (F5)

**Проверить:**
- [ ] Страница загружается из кеша Service Worker
- [ ] Появляется сообщение о offline режиме (если реализовано)

3. Убрать галочку **Offline**
4. Обновить страницу (F5)

**Проверить:**
- [ ] Страница обновилась с сервера
- [ ] Service Worker синхронизировал данные (если реализовано)

### Шаг 5: Проверить кеш Service Worker

**Application tab → Cache Storage** (слева в меню)

**Проверить:**
- [ ] Есть кеш (например, `v1` или `familybudget-cache`)
- [ ] В кеше есть статические файлы (CSS, JS, HTML)

**Действия:**

1. Развернуть Cache Storage
2. Click на кеш (например, `v1`)
3. Проверить список закешированных файлов

**Ожидается:**
```
Cache: v1
  ├─ https://fbd.ikeniborn.ru/
  ├─ https://fbd.ikeniborn.ru/static/css/output.css
  ├─ https://fbd.ikeniborn.ru/static/js/main.js
  └─ ...
```

---

## 📊 Чеклист результатов

### Cache-Control заголовки:

| Файл | Ожидается | Статус |
|------|-----------|--------|
| output.css?v=11.4.50 | max-age=31536000, immutable | ☐ |
| main.js?v=11.4.50 | max-age=31536000, immutable | ☐ |
| sw.js | no-cache, must-revalidate | ☐ |
| manifest.json | max-age=3600 | ☐ |
| Невероsionированные | max-age=3600, must-revalidate | ☐ |

### Статические файлы:

| Проверка | Статус |
|----------|--------|
| Все CSS файлы: 200 OK | ☐ |
| Все JS файлы: 200 OK | ☐ |
| Нет 500 ошибок в Console | ☐ |
| Страница стилизована | ☐ |

### Service Worker:

| Проверка | Статус |
|----------|--------|
| Зарегистрирован | ☐ |
| Status: activated and running | ☐ |
| Update работает | ☐ |
| Offline режим работает | ☐ |
| Cache Storage заполнен | ☐ |

---

## 🐛 Troubleshooting

### Проблема: Cache-Control заголовок отсутствует

**Решение:**
1. Проверить, что используется версия 11.4.49+
2. Проверить логи backend:
   ```bash
   ssh budget-test "docker logs familybudget-backend --tail 50"
   ```
3. Искать ошибки StaticCacheMiddleware

### Проблема: 500 ошибка на статических файлах

**Решение:**
1. Проверить версию (должна быть 11.4.49+)
2. Проверить логи на AttributeError:
   ```bash
   ssh budget-test "docker logs familybudget-backend | grep AttributeError"
   ```
3. Если ошибка есть - откатиться на предыдущую версию

### Проблема: Service Worker не регистрируется

**Решение:**
1. Проверить Cache-Control для sw.js (должен быть no-cache)
2. Console tab → проверить ошибки регистрации
3. Application tab → Service Workers → Unregister
4. Refresh страницу (F5)

### Проблема: Старые файлы загружаются после обновления

**Решение:**
1. Hard refresh: **Ctrl+Shift+R**
2. Проверить параметр версии в URL (должен быть ?v=11.4.50)
3. Очистить кеш браузера: DevTools → Network → **Disable cache** ✓
4. Проверить Service Worker Cache Storage → Delete cache

---

## 📸 Скриншоты для отчета

**Рекомендуется сделать скриншоты:**

1. **Network tab** с заголовками Cache-Control
   - Версионированный файл (output.css)
   - Service Worker (sw.js)
   - manifest.json

2. **Console tab** - нет ошибок

3. **Application → Service Workers** - статус activated

4. **Application → Cache Storage** - список файлов

---

## ✅ Критерии успеха

**Тесты пройдены, если:**

✅ Все Cache-Control заголовки корректны (5/5)
✅ Все статические файлы загружаются с 200 OK
✅ Нет ошибок в Console
✅ Service Worker зарегистрирован и активен
✅ Cache Storage содержит файлы

**После успешного прохождения → можно деплоить в production**
