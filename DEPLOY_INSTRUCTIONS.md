# Инструкция по деплою Store Dropdown Z-Index Fix

## Шаг 1: Подключение к тестовому серверу

```bash
ssh budget-test
```

## Шаг 2: Переход в репозиторий

```bash
cd ~/familyBudget
```

## Шаг 3: Получение последних изменений из test branch

```bash
git pull origin test
```

**Ожидаемый результат:**
```
remote: Counting objects: 15, done.
remote: Compressing objects: 100% (15/15), done.
remote: Total 15 (delta 10), reused 0 (delta 0)
Unpacking objects: 100% (15/15), done.
From https://github.com/ikeniborn/familyBudget
 * branch            test       -> FETCH_HEAD
Updating 4160cc76..6d8d7df1
Fast-forward
 frontend/web/static/css/lists.css                  | 24 +++++++++
 frontend/web/static/css/modal-dropdowns-fix.css    | 23 ---------
 frontend/web/static/js/lists/listsManager.js       | 17 +++++++
 .../20251230_28cb68876eaf_add_recurring_plan_indexes.py | 70 ++++++++++++++++++++++
 docs/architecture/README.md                        | 40 ++++++++++++++
 sw.js                                              |  2 +-
 6 files changed, 152 insertions(+), 24 deletions(-)
```

## Шаг 4: Деплой с патч-режимом

```bash
sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch
```

**Важно:** Деплой автоматически выполнит:
- ✅ Синхронизацию файлов в /opt/budget
- ✅ npm run minify:css (минификация CSS)
- ✅ npm run minify:js (минификация JavaScript) ← **КРИТИЧНО!**
- ✅ Обновление Service Worker версии
- ✅ Применение миграции базы данных (индексы для recurring plans)
- ✅ Рестарт backend контейнера

**Ожидаемая длительность:** 3-5 минут

## Шаг 5: Проверка логов деплоя

```bash
tail -f /opt/budget/logs/deploy.log
```

**Проверьте что:**
- ✅ Нет ошибок ERROR или CRITICAL
- ✅ JavaScript minification завершена успешно
- ✅ Service Worker version обновлена до v20251230_1519
- ✅ Backend container перезапущен

**Пример успешного лога:**
```
[INFO] JavaScript files minified: 51
[SUCCESS] ✅ Minification completed successfully!
[INFO] Service Worker version: v20251230_1519
[SUCCESS] Deployment completed successfully!
```

## Шаг 6: Проверка в браузере

### 6.1 Очистка кеша браузера

**Chrome/Firefox:**
- Ctrl + Shift + R (hard refresh)
- Или Ctrl + F5

**Safari:**
- Cmd + Option + R

### 6.2 Проверка DevTools Console

1. Открыть https://budget-dev.ikeniborn.ru/lists
2. Открыть список → "Добавить товар"
3. Открыть DevTools (F12) → вкладка Console
4. Кликнуть dropdown "Магазин"

**Ожидаемые логи:**
```
[LISTS_MODAL] Store dropdown z-index fix initialized
[LISTS_MODAL] Store dropdown opened - z-index fix applied
```

### 6.3 Проверка Elements

1. DevTools → вкладка Elements
2. Найти `<dialog id="item-modal">`
3. Когда dropdown "Магазин" открыт, проверить классы

**Ожидается:**
```html
<dialog id="item-modal" class="modal modal-bottom sm:modal-middle store-dropdown-open">
```

### 6.4 Проверка z-index

1. В Elements найти `.choices__list--dropdown`
2. Правой кнопкой → Inspect → вкладка Computed
3. Найти `z-index`

**Ожидается:** `z-index: 1060`

### 6.5 Визуальная проверка

**✅ Должно быть:**
- Dropdown "Магазин" ПОЛНОСТЬЮ перекрывает поле "Группа" ниже
- Нет прозрачности
- Поле "Группа" НЕ видно сквозь dropdown

**❌ Не должно быть:**
- Поле "Группа" видно сквозь dropdown "Магазин"
- Прозрачность dropdown

## Шаг 7: Если проблема сохраняется

### 7.1 Проверить загрузку минифицированного JS

В DevTools Console выполнить:
```javascript
// Проверить что функция инициализации существует
window.listsManager
```

**Ожидается:** объект с методами `initStoreChoices`, `initProductGroupChoices`, и т.д.

### 7.2 Проверить загрузку CSS

```bash
curl -I https://budget-dev.ikeniborn.ru/static/css/lists.min.css
```

**Ожидается:** Status 200 OK

### 7.3 Проверить версию Service Worker

В DevTools → Application → Service Workers

**Ожидается:** Version `v20251230_1519`

## Откат (если что-то пошло не так)

```bash
cd ~/familyBudget
git checkout main
sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch
```

---

## Контрольный чеклист

- [ ] SSH подключение к budget-test успешно
- [ ] git pull origin test выполнен
- [ ] deploy.sh завершился без ошибок
- [ ] JavaScript minification прошла успешно (проверить лог)
- [ ] Service Worker версия = v20251230_1519
- [ ] Backend контейнер перезапущен
- [ ] Браузер кеш очищен (Ctrl + Shift + R)
- [ ] Console показывает логи [LISTS_MODAL]
- [ ] Modal имеет класс store-dropdown-open
- [ ] Dropdown z-index = 1060
- [ ] Визуально: Поле "Группа" НЕ видно сквозь dropdown "Магазин"

---

## Поддержка

Если проблема не решена после выполнения всех шагов, предоставьте:
1. Скриншот DevTools Console (показывающий отсутствие логов [LISTS_MODAL])
2. Скриншот DevTools Elements (показывающий отсутствие класса store-dropdown-open)
3. Последние 50 строк из /opt/budget/logs/deploy.log
4. Вывод команды: `curl -I https://budget-dev.ikeniborn.ru/static/js/lists/listsManager.min.js`
