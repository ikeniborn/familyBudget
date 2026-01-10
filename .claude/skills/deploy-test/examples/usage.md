# Примеры использования Deploy Test Skill

Этот skill автоматически выполняет деплой на тестовый сервер budget-test при определенных запросах.

## Автоматический вызов

Claude автоматически использует этот skill когда вы говорите:

### Вариант 1: Прямой запрос
```
Пользователь: "Задеплой на тестовый сервер"
```

**Что происходит:**
1. Claude автоматически запускает deploy-test skill
2. Выполняются все 7 шагов автоматически
3. Выводится детальный отчет

**Пример вывода:**
```
Начинаю автоматизированный деплой на budget-test...

[Шаг 1/7] Проверка SSH подключения к budget-test...
✅ SSH подключение установлено

[Шаг 2/7] Выполнение git pull в ветке test...
✅ Git pull выполнен успешно (3 файла обновлено)

[Шаг 3/7] Запуск deploy.sh...
✅ Deploy.sh завершен успешно (время: 3м 24с)

[Шаг 4/7] Анализ логов деплоя...
✅ Логи деплоя не содержат ошибок

[Шаг 5/7] Анализ логов контейнеров...
✅ Backend: 0 ошибок
✅ PostgreSQL: 0 ошибок
✅ Redis: 0 ошибок

[Шаг 6/7] Проверка статуса контейнеров...
✅ Все контейнеры healthy:
   - backend: running (healthy)
   - postgres: running (healthy)
   - redis: running (healthy)

[Шаг 7/7] Проверка запущенных процессов...
✅ Незавершенных процессов не обнаружено

========================================
✅ Деплой на budget-test завершен успешно!
========================================
Время выполнения: 3м 48с
```

### Вариант 2: Короткий запрос
```
Пользователь: "deploy-test"
```

**Эквивалентно:** "Задеплой на тестовый сервер"

### Вариант 3: Альтернативные формулировки
```
"Обновить код на budget-test"
"Сделай деплой на test"
"Проверь изменения на тестовом сервере"
"Запусти тестовый деплой"
```

## Сценарии использования

### Сценарий 1: Успешный деплой

**Запрос:**
```
Задеплой на тестовый сервер
```

**Действия Claude:**
1. Подключается к budget-test по SSH
2. Выполняет git pull
3. Запускает deploy.sh
4. Анализирует все логи
5. Проверяет контейнеры
6. Выводит итоговый отчет

**Результат:**
```
✅ Деплой завершен успешно!
- Все контейнеры healthy
- Логи без ошибок
- Время: 3м 24с
```

### Сценарий 2: Деплой с предупреждениями

**Запрос:**
```
Обновить код на budget-test
```

**Что обнаруживает Claude:**
- Backend logs: WARNING о медленном Redis
- Postgres: WARNING о высоком количестве подключений

**Вывод:**
```
⚠️ Деплой завершен с предупреждениями

Обнаружены warnings:
1. Backend: Redis connection slow (234ms)
   Рекомендация: Проверить Redis performance

2. PostgreSQL: High connection count (85/100)
   Рекомендация: Мониторить connection pool

Все сервисы работают, но требуют внимания.
```

### Сценарий 3: Деплой с ошибкой и автоисправлением

**Запрос:**
```
Сделай деплой на test
```

**Что обнаруживает Claude:**
- Backend контейнер unhealthy
- Ошибка: Database connection refused

**Действия Claude:**
```
❌ Обнаружена проблема: Backend unhealthy
   Причина: Database connection refused

🔧 Исправляю автоматически:
   1. Перезапускаю PostgreSQL...
      Команда: ssh budget-test "cd /opt/budget && docker compose restart postgres"
      ✅ PostgreSQL перезапущен

   2. Ожидаю готовности PostgreSQL (10 сек)...
      ✅ PostgreSQL healthy

   3. Перезапускаю Backend...
      Команда: ssh budget-test "cd /opt/budget && docker compose restart backend"
      ✅ Backend перезапущен

   4. Проверяю health...
      ✅ Backend healthy

✅ Проблема исправлена автоматически!
   Все сервисы работают корректно.
```

### Сценарий 4: Git конфликт

**Запрос:**
```
Задеплой на тестовый сервер
```

**Что обнаруживает Claude:**
- Git pull завершился с конфликтом

**Вывод:**
```
❌ Git pull завершился с конфликтом

Конфликтующие файлы:
- backend/app/config.py
- frontend/web/static/js/app.js

Предлагаю решения:

1. Stash изменения на сервере (рекомендую):
   ssh budget-test "cd ~/familyBudget && git stash && git pull origin test"

2. Hard reset (удалит локальные изменения на сервере):
   ssh budget-test "cd ~/familyBudget && git reset --hard origin/test"

3. Разрешить конфликты вручную:
   ssh budget-test
   cd ~/familyBudget
   git status
   # ... разрешить конфликты ...

Какой вариант использовать? Или хотите, чтобы я использовал вариант 1?
```

## Работа с ошибками

### Пример 1: SSH недоступен

**Запрос:**
```
Обновить код на budget-test
```

**Вывод:**
```
❌ Не удалось подключиться к budget-test

Ошибка: Connection timed out

Проверьте:
1. SSH ключи настроены:
   ssh-add -l

2. Сервер доступен:
   ping budget-test

3. SSH работает:
   ssh budget-test "echo OK"

Нужна помощь с настройкой SSH?
```

### Пример 2: Недостаточно места на диске

**Запрос:**
```
Задеплой на тестовый сервер
```

**Что обнаруживает Claude:**
- Deploy.sh ошибка: No space left on device

**Вывод:**
```
❌ Деплой прерван: недостаточно места на диске

Использование диска на budget-test:
Filesystem      Size  Used Avail Use%
/dev/sda1        50G   48G   2.0G  96%

🔧 Рекомендации:
1. Очистить старые Docker образы:
   ssh budget-test "docker system prune -a -f"

2. Очистить логи:
   ssh budget-test "journalctl --vacuum-time=7d"

3. Проверить размер директорий:
   ssh budget-test "du -sh /opt/budget/*"

Выполнить автоматическую очистку Docker?
```

## Интеграция с workflow

### Пример: Полный цикл разработки

**Шаг 1: Локальная разработка**
```
Пользователь: "Добавь валидацию email в форму регистрации"
Claude: [создает код, тесты]
```

**Шаг 2: Коммит**
```
Пользователь: "Закоммить изменения"
Claude: [git add, git commit с правильным сообщением]
```

**Шаг 3: Push**
```
Пользователь: "Запушить в test"
Claude: [git push origin test]
```

**Шаг 4: Автоматический деплой**
```
Пользователь: "Задеплой на тестовый сервер"
Claude: [автоматически выполняет deploy-test skill]
```

**Шаг 5: Проверка результата**
```
Claude (автоматически):
✅ Деплой завершен успешно!
✅ Валидация email работает корректно
✅ Все тесты прошли
```

## Детали выполнения

### Команды которые выполняет Claude

Когда вы говорите "Задеплой на тестовый сервер", Claude выполняет:

```bash
# Шаг 1: Проверка SSH
ssh budget-test "echo 'Connection OK'"

# Шаг 2: Git pull
ssh budget-test "cd ~/familyBudget && git fetch --all && git checkout test && git pull origin test"

# Шаг 3: Deploy
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch"

# Шаг 4: Анализ логов деплоя
ssh budget-test "tail -100 /opt/budget/logs/deploy.log"

# Шаг 5: Логи контейнеров
ssh budget-test "cd /opt/budget && docker compose logs backend --tail=50"
ssh budget-test "cd /opt/budget && docker compose logs postgres --tail=50"
ssh budget-test "cd /opt/budget && docker compose logs redis --tail=50"

# Шаг 6: Статус контейнеров
ssh budget-test "cd /opt/budget && docker compose ps --format json"

# Шаг 7: Процессы
ssh budget-test "ps aux | grep -E 'deploy|docker|npm|node' | grep -v grep"
```

### Локальные логи

Claude сохраняет все логи локально в:
```
logs/deploy-test/YYYYMMDD_HHMMSS/
```

Вы можете просмотреть их позже:
```
Пользователь: "Покажи логи последнего деплоя"
Claude: [читает и анализирует сохраненные логи]
```

## FAQ

**Q: Как часто можно запускать deploy-test?**
A: Сколько угодно раз. Skill безопасен и использует `--patch` режим.

**Q: Что если я хочу деплой без анализа логов?**
A: Используйте обычный deployment skill или выполните команды вручную.

**Q: Можно ли кастомизировать параметры деплоя?**
A: Да, укажите параметры явно:
```
"Задеплой на тестовый сервер с полной пересборкой"
→ Claude использует --build вместо --patch
```

**Q: Что если deploy-test не срабатывает автоматически?**
A: Проверьте что skill установлен в `.claude/skills/deploy-test/SKILL.md`

## Связанные skills

- **deployment** - базовый деплой
- **monitoring** - мониторинг после деплоя
- **testing** - тестирование перед деплоем
