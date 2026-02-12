# Frontend & UI тест-план: v11.4.45 → v11.4.50

## Критичные изменения для UI

- 🔧 **v11.4.49**: Фикс StaticCacheMiddleware (500 ошибки устранены)
- 📦 **v11.4.46**: Cache-Control headers (правильное кеширование)

**Время тестирования:** ~10 минут

---

## 🌐 Тест 1: Загрузка статических файлов (3 мин)

### Было (v11.4.48):
- ❌ 500 Internal Server Error на `/static/*` файлы
- ❌ CSS/JS не загружаются
- ❌ Страница без стилей

### Стало (v11.4.49+):
- ✅ Статические файлы загружаются
- ✅ Стили применяются корректно

### Как проверить:

**Браузер (Chrome/Firefox DevTools):**
1. Открыть https://fbd.ikeniborn.ru/
2. F12 → Network tab → Refresh (Ctrl+Shift+R)
3. Фильтр: CSS, JS

**Проверить:**
- [ ] Все CSS файлы: **200 OK** (не 500)
- [ ] Все JS файлы: **200 OK** (не 500)
- [ ] output.css загружен: **зеленый статус**
- [ ] main.js загружен: **зеленый статус**
- [ ] Нет красных (failed) файлов в Network

**Console tab:**
- [ ] Нет ошибок вида `Failed to load resource: the server responded with a status of 500`

**Визуально:**
- [ ] Страница выглядит нормально (есть стили)
- [ ] Кнопки имеют цвета
- [ ] Шрифты загружены

---

## 📦 Тест 2: Cache-Control заголовки (5 мин)

### Было (v11.4.45):
- ❌ Версионированные файлы не кешировались
- ❌ При обновлении приложения старые файлы продолжали использоваться

### Стало (v11.4.46+):
- ✅ Версионированные файлы: 1 год кеш (immutable)
- ✅ Service Worker: no-cache (всегда свежий)
- ✅ manifest.json: 1 час кеш

### Как проверить:

**Browser DevTools (Network tab):**

1. **Версионированные файлы** (CSS/JS с `?v=11.4.50`):
   ```
   Click на файл → Headers tab → Response Headers
   ```
   - [ ] `Cache-Control: max-age=31536000, immutable`
   - [ ] Параметр URL: `?v=11.4.50`

2. **Service Worker** (`sw.js`):
   ```
   Network → sw.js → Headers
   ```
   - [ ] `Cache-Control: no-cache, must-revalidate`

3. **Manifest** (`manifest.json`):
   ```
   Network → manifest.json → Headers
   ```
   - [ ] `Cache-Control: max-age=3600`

**Или через curl:**
```bash
# Версионированный файл
curl -I https://fbd.ikeniborn.ru/static/css/output.css?v=11.4.50 | grep -i cache

# Service Worker
curl -I https://fbd.ikeniborn.ru/sw.js | grep -i cache

# Manifest
curl -I https://fbd.ikeniborn.ru/manifest.json | grep -i cache
```

---

## 🔄 Тест 3: Service Worker обновление (2 мин)

### Было:
- ⚠️ Service Worker мог кешироваться браузером
- ⚠️ Обновления приложения не применялись

### Стало:
- ✅ Service Worker всегда загружается свежий (no-cache)

### Как проверить:

**Browser DevTools:**
1. F12 → Application tab → Service Workers
2. Проверить:
   - [ ] Service Worker зарегистрирован
   - [ ] Source: `/sw.js`
   - [ ] Status: **activated and is running**

**Тест обновления:**
1. Application → Service Workers → **Unregister**
2. Refresh страницу (F5)
3. Проверить:
   - [ ] Service Worker снова зарегистрировался автоматически
   - [ ] Версия актуальная

---

## 🎨 Тест 4: Визуальная регрессия (3 мин)

### Проверка UI элементов:

**Главная страница:**
- [ ] Logo отображается
- [ ] Навигация (меню) работает
- [ ] Кнопки имеют правильные цвета (DaisyUI theme)
- [ ] Модальные окна открываются корректно
- [ ] Формы стилизованы

**Responsive (мобильная версия):**
1. DevTools → Toggle device toolbar (Ctrl+Shift+M)
2. Выбрать: iPhone 12 Pro
3. Проверить:
   - [ ] Мобильное меню работает
   - [ ] Контент адаптируется под экран
   - [ ] Нет горизонтальной прокрутки

**Темная тема** (если есть):
- [ ] Переключение темы работает
- [ ] Стили применяются корректно

---

## 🚀 Тест 5: Производительность (2 мин)

### Network Performance:

**Browser DevTools (Network tab):**
1. Disable cache ✓
2. Hard refresh (Ctrl+Shift+R)
3. Проверить размеры:
   - [ ] output.css < 500 KB
   - [ ] JavaScript chunks загружаются
   - [ ] Total page size < 2 MB

**Lighthouse (опционально):**
1. DevTools → Lighthouse tab
2. Run: Performance, Best Practices
3. Проверить:
   - [ ] Performance score > 80
   - [ ] No console errors

---

## 📊 Финальный чеклист

### Критичные проверки:

| Тест | Статус | Примечание |
|------|--------|------------|
| **Статические файлы загружаются** | ☐ | Нет 500 ошибок |
| **CSS применяется корректно** | ☐ | Страница стилизована |
| **JS работает без ошибок** | ☐ | Console чистая |
| **Cache-Control для версионированных** | ☐ | max-age=31536000 |
| **Cache-Control для sw.js** | ☐ | no-cache |
| **Cache-Control для manifest** | ☐ | max-age=3600 |
| **Service Worker активен** | ☐ | activated and running |
| **UI выглядит правильно** | ☐ | Нет визуальных багов |
| **Мобильная версия работает** | ☐ | Responsive корректный |

### ✅ Критерий успеха:

**Frontend готов к production, если:**
- ✅ Все статические файлы загружаются (9/9)
- ✅ Нет ошибок в Browser Console
- ✅ Cache-Control заголовки корректны (3/3)
- ✅ UI выглядит нормально на desktop и mobile

---

## 🐛 Если что-то не работает:

### Проблема: 500 ошибка на static files
**Решение:** Проверить логи backend:
```bash
ssh budget-test "docker logs familybudget-backend --tail 100 | grep -i error"
```

### Проблема: Старые файлы загружаются после деплоя
**Решение:**
1. Hard refresh: Ctrl+Shift+R
2. Очистить кеш браузера
3. Проверить параметр версии `?v=11.4.50` в URL

### Проблема: Service Worker не обновляется
**Решение:**
1. Application → Service Workers → Unregister
2. Refresh страницу
3. Проверить заголовок `Cache-Control: no-cache` для sw.js

---

**Время выполнения:** ~15 минут
**Инструменты:** Browser DevTools (F12)
**Браузеры:** Chrome, Firefox, Safari (iOS)
