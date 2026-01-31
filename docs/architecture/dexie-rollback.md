# Dexie Migration Rollback Procedure

**Дата создания:** 2026-01-31
**Версия:** 1.0
**Статус:** Active

---

## Обзор

Этот документ описывает процедуру отката миграции PGlite → Dexie.js в случае критических проблем в production.

---

## Условия для Rollback

### Критические (Немедленный откат)

- 🔴 **Data Loss:** Потеря пользовательских данных
- 🔴 **Application Crash:** Приложение не загружается
- 🔴 **Auth Failure:** Пользователи не могут войти
- 🔴 **Sync Broken:** Синхронизация не работает для >50% пользователей

### Major (Откат в течение 24 часов)

- 🟡 **Performance:** Dashboard load >400ms (деградация >50%)
- 🟡 **Offline Mode:** Offline CRUD не работает для >10% пользователей
- 🟡 **Migration Failure:** Миграция данных не работает для >20% пользователей

### Minor (Оценка необходимости отката)

- 🟢 **UI Glitches:** Визуальные проблемы (не блокирующие)
- 🟢 **Edge Cases:** Редкие сценарии не работают

---

## Rollback Процедура

### Предварительные проверки

```bash
# 1. Проверить текущую версию в production
ssh budget-prod
cd /opt/budget
git log -1 --oneline
# Ожидаемый output: commit hash с меткой "v11.0.0" или выше

# 2. Проверить состояние контейнеров
docker-compose ps
# Все контейнеры должны быть Up

# 3. Проверить логи
tail -n 100 /opt/budget/logs/backend.log
# Искать ошибки связанные с Dexie
```

### Шаг 1: Остановить Production

```bash
ssh budget-prod
cd /opt/budget

# Остановить все сервисы
docker-compose down

# Проверить что все контейнеры остановлены
docker ps -a | grep budget
```

**Время:** ~2 минуты
**Downtime:** Начинается

### Шаг 2: Откатить Код

```bash
# Откатить на последнюю PGlite версию
git fetch origin
git checkout v10.1.56-pglite-last

# Проверить что откат выполнен
git log -1 --oneline
# Ожидаемый output: v10.1.56-pglite-last tag
```

**Время:** ~1 минута

### Шаг 3: Откатить Dependencies

```bash
# Восстановить package-lock.json (PGlite dependencies)
npm ci

# Проверить что PGlite установлен
npm list @electric-sql/pglite
# Ожидаемый output: @electric-sql/pglite@0.3.14
```

**Время:** ~3-5 минут (зависит от npm registry)

### Шаг 4: Rebuild Frontend

```bash
# Собрать frontend с PGlite
npm run build:prod

# Проверить что build успешен
ls -lh frontend/web/static/dist/
# Должны быть файлы: main.*.js, vendor.*.js
```

**Время:** ~2-3 минуты

### Шаг 5: Перезапустить Production

```bash
# Запустить все сервисы
docker-compose up -d

# Проверить статус
docker-compose ps
# Все контейнеры должны быть Up и Healthy
```

**Время:** ~2-3 минуты
**Downtime:** Заканчивается

### Шаг 6: Верификация

```bash
# 1. Проверить доступность приложения
curl -I https://budget-prod.example.com
# Ожидаемый output: HTTP 200 OK

# 2. Проверить логи backend
docker-compose logs --tail=50 backend
# НЕ должно быть ошибок

# 3. Проверить PGlite в браузере
# - Открыть https://budget-prod.example.com
# - DevTools → Console
# - Выполнить: localStorage.getItem('pgliteActive')
# - Ожидаемый output: "true" (если был включен)

# 4. Проверить Dashboard
# - Загрузить dashboard
# - Проверить что данные отображаются
# - Проверить что нет ошибок в Console

# 5. Проверить Offline режим (если PGlite был включен)
# - Settings → Offline Mode → Enabled
# - Создать транзакцию offline
# - Восстановить соединение
# - Проверить что транзакция синхронизировалась
```

**Время:** ~10-15 минут

### Шаг 7: Уведомление

```bash
# 1. Отправить уведомление пользователям (если необходимо)
# - "Приложение временно откачено на предыдущую версию"
# - "Все ваши данные сохранены"
# - "Работа над исправлением ведется"

# 2. Создать issue в GitHub
# - Описать причину rollback
# - Прикрепить логи
# - Назначить ответственного

# 3. Обновить статус в monitoring
# - Status page: "Incident resolved"
```

---

## Полное Время Rollback

| Этап | Время | Downtime |
|------|-------|----------|
| Шаг 1: Stop production | 2 мин | ✅ Начало |
| Шаг 2: Git checkout | 1 мин | ✅ |
| Шаг 3: npm ci | 3-5 мин | ✅ |
| Шаг 4: Build | 2-3 мин | ✅ |
| Шаг 5: Start production | 2-3 мин | ❌ Конец |
| Шаг 6: Verification | 10-15 мин | ❌ |
| **ИТОГО** | **20-30 минут** | **10-15 минут** |

---

## Data Recovery

### Scenario 1: Пользователь потерял offline данные

**Проблема:** После rollback пользователь не видит свои offline изменения

**Решение:**
1. Offline данные хранятся в IndexedDB (`idb://pglite`)
2. После rollback PGlite должен восстановить доступ к этим данным
3. Если данные не восстанавливаются автоматически:
   - Попросить пользователя открыть DevTools → Application → IndexedDB
   - Проверить наличие `pglite` database
   - Если database пуста → данные потеряны (требуется initial sync from server)

**Митигация:** Initial Sync from Server восстановит synced данные (но pending операции будут потеряны)

### Scenario 2: Миграция Dexie частично выполнена

**Проблема:** Пользователь запустил Dexie версию, миграция началась но не завершилась

**Решение:**
1. Проверить `localStorage.getItem('pglite_to_dexie_migrated')`
2. Если `'true'` → миграция завершена, данные в Dexie
3. Если `'false'` или `null` → миграция не завершена, данные в PGlite
4. После rollback:
   - Очистить Dexie database: `indexedDB.deleteDatabase('FamilyBudgetDB')`
   - Очистить migration flag: `localStorage.removeItem('pglite_to_dexie_migrated')`
   - PGlite должен снова работать с исходными данными

**Митигация:** Migration backup позволяет восстановить pending операции

---

## Rollback Scripts

### Автоматический Rollback Script

```bash
#!/bin/bash
# rollback-to-pglite.sh
# Usage: ./rollback-to-pglite.sh

set -e

echo "🔄 Starting rollback to PGlite (v10.1.56)..."

# 1. Stop production
echo "⏸️  Stopping production services..."
docker-compose down

# 2. Git checkout
echo "📦 Rolling back code to v10.1.56-pglite-last..."
git fetch origin
git checkout v10.1.56-pglite-last

# 3. Install dependencies
echo "📥 Restoring PGlite dependencies..."
npm ci

# 4. Rebuild frontend
echo "🏗️  Rebuilding frontend..."
npm run build:prod

# 5. Restart production
echo "🚀 Restarting production services..."
docker-compose up -d

# 6. Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# 7. Verification
echo "✅ Verifying rollback..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://budget-prod.example.com)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Rollback successful! Application is UP."
else
  echo "❌ Rollback failed! HTTP code: $HTTP_CODE"
  exit 1
fi

echo "🎉 Rollback completed successfully!"
```

### Manual Rollback Checklist

```markdown
- [ ] 1. Остановить production (docker-compose down)
- [ ] 2. Откатить код (git checkout v10.1.56-pglite-last)
- [ ] 3. Восстановить dependencies (npm ci)
- [ ] 4. Rebuild frontend (npm run build:prod)
- [ ] 5. Запустить production (docker-compose up -d)
- [ ] 6. Проверить HTTP 200 OK
- [ ] 7. Проверить логи (нет ошибок)
- [ ] 8. Проверить Dashboard в браузере
- [ ] 9. Проверить PGlite в DevTools
- [ ] 10. Уведомить пользователей
- [ ] 11. Создать GitHub issue
- [ ] 12. Обновить monitoring status
```

---

## Post-Rollback Actions

### Немедленно (в течение 1 часа)

1. **Анализ причины rollback**
   - Собрать логи backend/frontend
   - Проанализировать ошибки
   - Определить root cause

2. **Уведомление команды**
   - Сообщить разработчикам
   - Создать incident report
   - Назначить ответственного за fix

3. **Monitoring усиление**
   - Увеличить частоту мониторинга логов
   - Настроить alerts для критических ошибок

### В течение 24 часов

1. **Root Cause Analysis (RCA)**
   - Документировать что пошло не так
   - Определить как можно было предотвратить
   - Обновить тестирование

2. **Исправление проблемы**
   - Создать hotfix ветку
   - Реализовать исправление
   - Тестирование на budget-test

3. **Обновление документации**
   - Обновить rollback процедуру (если необходимо)
   - Добавить известные проблемы в документацию

### В течение 1 недели

1. **Повторная попытка миграции**
   - После исправления проблемы
   - Дополнительное тестирование на budget-test
   - Постепенный rollout (если возможно)

2. **Lessons Learned**
   - Документировать уроки
   - Обновить процессы разработки
   - Улучшить тестирование

---

## Контакты

**В случае проблем с rollback:**

- **Lead Developer:** ikeniborn
- **GitHub Issues:** https://github.com/ikeniborn/familyBudget/issues
- **Production Logs:** `/opt/budget/logs/backend.log`

---

## История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-01-31 | 1.0 | Первая версия rollback процедуры |
