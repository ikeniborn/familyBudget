# OfflineManager Integration Testing Plan

**Phase 12: Integration Testing** - offlineManager TypeScript migration

**Критичность**: 🔴 ВЫСОКАЯ (Production-critical код, риск data loss)

**Время выполнения**: 4-5 часов (ручное тестирование на тестовом сервере)

---

## Цель

End-to-end тестирование всей системы offlineManager с включенными feature flags для проверки:

- ✅ Функциональность (CRUD operations, sync, network transitions)
- ✅ Data Integrity (NO data loss, NO duplicates, correct hashes)
- ✅ Performance (sync speed, memory usage, IndexedDB performance)
- ✅ Stress Testing (100+ operations, multiple tabs, network flapping)
- ✅ UI (toasts, badge, offline indicators)

---

## Предварительная подготовка

### 1. Развернуть на тестовом сервере

```bash
# На локальной машине
git checkout dev/offlinemanager_migration_20260114195856
npm run build
git push

# На сервере budget-test
cd /opt/budget
git pull origin dev/offlinemanager_migration_20260114195856
# Build уже выполнен локально, можно перезапустить контейнеры
docker compose restart
```

### 2. Включить все feature flags

Откройте Chrome DevTools Console на https://budget-test.yourdomain.com:

```javascript
// Включить все feature flags
window.offlineFeatureFlags.enable('useNewCoreState')
window.offlineFeatureFlags.enable('useNewFactsOps')
window.offlineFeatureFlags.enable('useNewTransfersOps')
window.offlineFeatureFlags.enable('useNewPlansOps')
window.offlineFeatureFlags.enable('useNewSyncEngine')
window.offlineFeatureFlags.enable('useNewNetworkState')
window.offlineFeatureFlags.enable('useNewWebSocket')
window.offlineFeatureFlags.enable('useNewUI')

// Проверить статус
window.offlineFeatureFlags.getStatus()
// Ожидаемый результат: все флаги true

// Перезагрузить страницу для применения
location.reload()
```

### 3. Подготовить тестовые данные

- Создать тестовую статью "TEST_ARTICLE_OFFLINE"
- Создать тестовый счёт "TEST_ACCOUNT_OFFLINE"
- Записать ID статьи и счёта для использования в тестах

---

## Functional Testing (1.5 часа)

### Test 1: Create Facts Offline → Online

**Цель**: Проверить создание факто в offline с последующей синхронизацией.

**Шаги**:

1. Отключить сеть (Chrome DevTools → Network → Offline)
2. Создать 10 фактов:
   - Доход: 5 фактов (разные суммы: 1000, 2000, 3000, 4000, 5000 руб)
   - Расход: 5 фактов (разные суммы: 500, 1000, 1500, 2000, 2500 руб)
   - Использовать TEST_ARTICLE_OFFLINE и TEST_ACCOUNT_OFFLINE
3. Проверить:
   - ✅ Все факты отображаются в UI
   - ✅ Toast "Сохранено локально" показан для каждого факта
   - ✅ Navbar badge показывает "10" pending items
4. Включить сеть (Chrome DevTools → Network → Online)
5. Дождаться автоматической синхронизации (~10-15 секунд)
6. Проверить:
   - ✅ Toast "Синхронизировано: 10 записей" показан
   - ✅ Navbar badge показывает "0" pending items
   - ✅ Все 10 фактов отображаются в UI
   - ✅ Проверить в базе данных:
     ```sql
     SELECT * FROM t_f_budget_fact
     WHERE article_name = 'TEST_ARTICLE_OFFLINE'
     AND created_at > NOW() - INTERVAL '1 hour'
     ORDER BY created_at DESC;
     ```
   - ✅ Должно быть 10 записей

**Критерий успеха**: NO data loss, все 10 фактов синхронизированы.

---

### Test 2: Create Transfers Offline → Online

**Цель**: Проверить создание переводов в offline.

**Шаги**:

1. Отключить сеть
2. Создать 5 переводов между счетами (по 1000 руб каждый)
3. Проверить:
   - ✅ Все переводы отображаются в UI
   - ✅ Toast "Сохранено локально" показан
   - ✅ Navbar badge показывает "5" pending items
4. Включить сеть
5. Дождаться синхронизации
6. Проверить:
   - ✅ Toast "Синхронизировано: 5 записей" показан
   - ✅ Navbar badge показывает "0"
   - ✅ Все 5 переводов в базе:
     ```sql
     SELECT * FROM t_f_budget_transfer
     WHERE created_at > NOW() - INTERVAL '1 hour'
     ORDER BY created_at DESC;
     ```

**Критерий успеха**: NO data loss, все 5 переводов синхронизированы.

---

### Test 3: Create Recurring Plans Offline → Online

**Цель**: Проверить создание повторяющихся планов в offline.

**Шаги**:

1. Отключить сеть
2. Создать 3 recurring plans:
   - Ежемесячный план: "Коммунальные платежи" (1500 руб)
   - Еженедельный план: "Продукты" (1000 руб)
   - Ежедневный план: "Обед" (300 руб)
3. Проверить:
   - ✅ Все планы отображаются в UI
   - ✅ Navbar badge показывает "3"
4. Включить сеть
5. Дождаться синхронизации
6. Проверить:
   - ✅ Toast "Синхронизировано: 3 записей"
   - ✅ Navbar badge показывает "0"
   - ✅ Все 3 плана в базе:
     ```sql
     SELECT * FROM t_f_recurring_plan
     WHERE created_at > NOW() - INTERVAL '1 hour'
     ORDER BY created_at DESC;
     ```

**Критерий успеха**: NO data loss, все 3 плана синхронизированы.

---

### Test 4: Update Fact Offline → Online

**Цель**: Проверить обновление факта в offline.

**Шаги**:

1. Создать факт online (1000 руб)
2. Отключить сеть
3. Обновить сумму на 2000 руб
4. Проверить:
   - ✅ UI показывает 2000 руб
   - ✅ Toast "Сохранено локально"
   - ✅ Navbar badge показывает "1"
5. Включить сеть
6. Дождаться синхронизации
7. Проверить:
   - ✅ Toast "Синхронизировано: 1 записей"
   - ✅ Сумма в базе = 2000 руб

**Критерий успеха**: Update синхронизирован корректно.

---

### Test 5: Delete Fact Offline → Online

**Цель**: Проверить удаление факта в offline.

**Шаги**:

1. Создать факт online
2. Отключить сеть
3. Удалить факт
4. Проверить:
   - ✅ Факт исчез из UI
   - ✅ Navbar badge показывает "1"
5. Включить сеть
6. Дождаться синхронизации
7. Проверить:
   - ✅ Toast "Синхронизировано: 1 записей"
   - ✅ Факт удалён из базы

**Критерий успеха**: Delete синхронизирован корректно.

---

### Test 6: Network Flapping (on/off/on/off)

**Цель**: Проверить стабильность при нестабильной сети.

**Шаги**:

1. Создать 5 фактов offline
2. Включить сеть → через 2 секунды отключить сеть
3. Создать ещё 5 фактов offline
4. Включить сеть → через 2 секунды отключить сеть
5. Создать ещё 5 фактов offline
6. Включить сеть окончательно
7. Дождаться синхронизации
8. Проверить:
   - ✅ Все 15 фактов синхронизированы
   - ✅ NO duplicates
   - ✅ NO console errors

**Критерий успеха**: Queue не теряется при flapping, NO data loss.

---

## Data Integrity Testing (1 час)

### Test 7: No Duplicates

**Цель**: Проверить, что deduplication работает корректно.

**Шаги**:

1. Создать факт offline (1000 руб)
2. НЕ включая сеть, создать ещё один такой же факт (1000 руб, та же статья, тот же счёт, та же дата)
3. Включить сеть
4. Дождаться синхронизации
5. Проверить базу:
   ```sql
   SELECT content_hash, sync_hash, COUNT(*)
   FROM t_f_budget_fact
   WHERE article_name = 'TEST_ARTICLE_OFFLINE'
   AND amount = 1000
   AND created_at > NOW() - INTERVAL '1 hour'
   GROUP BY content_hash, sync_hash;
   ```
6. Проверить:
   - ✅ Должна быть **1 запись** (deduplication сработал)
   - ✅ НЕТ дубликатов с одинаковым content_hash

**Критерий успеха**: Deduplication работает, NO duplicates.

---

### Test 8: Sync Hash Verification

**Цель**: Проверить корректность sync_hash (MD5(content_hash|user_id|created_date)).

**Шаги**:

1. Создать факт offline
2. Включить сеть, дождаться синхронизации
3. Проверить в IndexedDB (Chrome DevTools → Application → IndexedDB → syncQueue):
   - ✅ Item status = 'completed'
   - ✅ sync_hash заполнен (32 символа hex)
4. Проверить в базе:
   ```sql
   SELECT id, sync_hash, content_hash, user_id, created_at::date
   FROM t_f_budget_fact
   WHERE article_name = 'TEST_ARTICLE_OFFLINE'
   ORDER BY created_at DESC LIMIT 1;
   ```
5. Вручную проверить sync_hash:
   ```javascript
   // В консоли
   const contentHash = 'abc123'; // из БД
   const userId = 1; // из БД
   const createdDate = '2025-01-14'; // из БД
   const combined = `${contentHash}|${userId}|${createdDate}`;
   const syncHash = md5(combined); // Использовать библиотеку MD5
   console.log('Expected sync_hash:', syncHash);
   ```

**Критерий успеха**: sync_hash корректен, соответствует формуле.

---

### Test 9: IndexedDB Cleanup After Sync

**Цель**: Проверить, что completed items удаляются из IndexedDB.

**Шаги**:

1. Создать 10 фактов offline
2. Включить сеть, дождаться синхронизации
3. Дождаться 10 секунд (cleanup interval)
4. Проверить IndexedDB (syncQueue table):
   - ✅ Должно быть **0 completed items** (cleaned up)
   - ✅ Все pending items синхронизированы

**Критерий успеха**: Cleanup работает, completed items удалены.

---

## Performance Testing (1 час)

### Test 10: Sync Queue Performance (100 records)

**Цель**: Проверить скорость синхронизации большой очереди.

**Шаги**:

1. Отключить сеть
2. Создать 100 фактов (можно написать скрипт в консоли):
   ```javascript
   async function createBulkFacts(count) {
     for (let i = 0; i < count; i++) {
       await window.offlineManager.createFact({
         article_id: TEST_ARTICLE_ID,
         financial_center_id: TEST_ACCOUNT_ID,
         amount: Math.random() * 1000,
         record_type: 'fact',
         fact_date: new Date().toISOString(),
       });
     }
   }
   createBulkFacts(100);
   ```
3. Включить сеть
4. Засечь время синхронизации (начало - "Онлайн", конец - "Синхронизировано: 100 записей")
5. Проверить:
   - ✅ Время синхронизации < 30 секунд
   - ✅ NO console errors
   - ✅ Все 100 фактов в базе

**Критерий успеха**: Sync time < 30 seconds для 100 records.

---

### Test 11: Memory Usage

**Цель**: Проверить потребление памяти.

**Шаги**:

1. Открыть Chrome DevTools → Performance → Memory
2. Сделать heap snapshot (baseline)
3. Создать 100 фактов offline
4. Включить сеть, дождаться синхронизации
5. Сделать ещё один heap snapshot
6. Сравнить heap size:
   - ✅ Увеличение памяти ≤ 10% от baseline

**Критерий успеха**: Memory usage ≤ baseline + 10%.

---

### Test 12: IndexedDB Write Performance

**Цель**: Проверить скорость записи в IndexedDB.

**Шаги**:

1. Отключить сеть
2. Создать 10 фактов, измерить время каждой записи:
   ```javascript
   async function measureWrite() {
     const times = [];
     for (let i = 0; i < 10; i++) {
       const start = performance.now();
       await window.offlineManager.createFact({ /* ... */ });
       const end = performance.now();
       times.push(end - start);
     }
     console.log('Write times (ms):', times);
     console.log('Average write time:', times.reduce((a, b) => a + b) / times.length);
   }
   measureWrite();
   ```
3. Проверить:
   - ✅ Average write time ≤ 50ms per write

**Критерий успеха**: IndexedDB write ≤ 50ms per write.

---

## Stress Testing (1.5 часа)

### Test 13: Rapid Create/Update/Delete (100 operations)

**Цель**: Проверить стабильность при быстрых операциях.

**Шаги**:

1. Отключить сеть
2. Выполнить 100 операций в цикле:
   ```javascript
   async function stressTest() {
     const factIds = [];

     // Create 50 facts
     for (let i = 0; i < 50; i++) {
       const fact = await window.offlineManager.createFact({ /* ... */ });
       factIds.push(fact.temp_id);
     }

     // Update 25 facts
     for (let i = 0; i < 25; i++) {
       await window.offlineManager.updateFact(factIds[i], { amount: 999 });
     }

     // Delete 25 facts
     for (let i = 25; i < 50; i++) {
       await window.offlineManager.deleteFact(factIds[i]);
     }
   }
   stressTest();
   ```
3. Включить сеть
4. Дождаться синхронизации
5. Проверить:
   - ✅ NO console errors
   - ✅ В базе 25 фактов (50 created - 25 deleted)
   - ✅ Все 25 имеют amount = 999 (updated)

**Критерий успеха**: NO errors, корректный результат.

---

### Test 14: Multiple Tabs Concurrent Operations

**Цель**: Проверить работу с несколькими вкладками.

**Шаги**:

1. Отключить сеть во всех вкладках
2. Открыть 3 вкладки приложения
3. В каждой вкладке создать 10 фактов
4. Включить сеть во всех вкладках
5. Дождаться синхронизации
6. Проверить:
   - ✅ Все 30 фактов синхронизированы
   - ✅ NO duplicates
   - ✅ NO conflicts

**Критерий успеха**: Multiple tabs работают корректно, NO conflicts.

---

### Test 15: Network Flapping During Sync

**Цель**: Проверить устойчивость к потере сети во время синхронизации.

**Шаги**:

1. Создать 50 фактов offline
2. Включить сеть
3. Через 2 секунды после начала синхронизации отключить сеть
4. Через 5 секунд включить сеть
5. Дождаться завершения синхронизации
6. Проверить:
   - ✅ Все 50 фактов синхронизированы
   - ✅ NO data loss
   - ✅ Retry logic сработал корректно

**Критерий успеха**: NO data loss при flapping во время sync.

---

## UI Testing (30 минут)

### Test 16: Toast Notifications

**Цель**: Проверить корректность toast уведомлений.

**Шаги**:

1. Offline → Online переход:
   - ✅ Toast "Работаем оффлайн" показан при offline
   - ✅ Toast "Соединение восстановлено" показан при online (без pending items)
   - ✅ Toast "Онлайн. Синхронизировано: X записей" показан при online (с pending items)
2. Degraded соединение:
   - ✅ Toast "Соединение нестабильно" показан
3. Offline save:
   - ✅ Toast "Сохранено локально. Синхронизируем при восстановлении связи." показан
   - ✅ Кнопка "Включить офлайн режим" работает

**Критерий успеха**: Все toasts корректны, без дублирования (debounce работает).

---

### Test 17: Navbar Badge

**Цель**: Проверить correct count в navbar badge.

**Шаги**:

1. Создать 5 фактов offline
2. Проверить:
   - ✅ Badge показывает "5"
3. Включить сеть
4. Проверить:
   - ✅ Badge меняется на "0" после синхронизации

**Критерий успеха**: Badge показывает correct count.

---

### Test 18: Offline Indicators

**Цель**: Проверить offline индикаторы в UI.

**Шаги**:

1. Отключить сеть
2. Проверить:
   - ✅ Красный индикатор "Offline" отображается
3. Включить сеть
4. Проверить:
   - ✅ Индикатор меняется на "Online" (зелёный)

**Критерий успеха**: Индикаторы корректны.

---

## Отчёт о результатах тестирования

После выполнения всех тестов заполнить отчёт:

### Summary

| Категория | Тестов | Passed | Failed | Critical Failures |
|-----------|--------|--------|--------|-------------------|
| Functional | 6 | ? | ? | ? |
| Data Integrity | 3 | ? | ? | ? |
| Performance | 3 | ? | ? | ? |
| Stress | 3 | ? | ? | ? |
| UI | 3 | ? | ? | ? |
| **TOTAL** | **18** | **?** | **?** | **?** |

### Critical Failures (если есть)

1. **Test #X: [название]**
   - Ожидалось: [описание]
   - Получилось: [описание]
   - Критичность: 🔴 ВЫСОКАЯ / 🟡 СРЕДНЯЯ / 🟢 НИЗКАЯ
   - Action: [что нужно исправить]

### Validation Criteria

- ✅ / ❌ **NO DATA LOSS** при offline → online переходе
- ✅ / ❌ **NO DUPLICATES** после синхронизации
- ✅ / ❌ **Conflicts** разрешаются корректно
- ✅ / ❌ **Pending operations** сохраняются между перезагрузками
- ✅ / ❌ **IndexedDB integrity** проверена
- ✅ / ❌ **Verification** после create operations
- ✅ / ❌ **Sync time** < 30 seconds для 100 records
- ✅ / ❌ **Memory usage** ≤ baseline + 10%
- ✅ / ❌ **IndexedDB write** ≤ 50ms per write
- ✅ / ❌ **NO console errors**

### Рекомендация

- ✅ **READY FOR PRODUCTION** - Все тесты passed, critical criteria выполнены
- ⚠️ **NEEDS FIXES** - Есть failed tests, требуются исправления
- ❌ **NOT READY** - Critical failures, миграцию откатить

---

## Результаты (заполнить после тестирования)

**Дата тестирования**: [YYYY-MM-DD]
**Тестировщик**: [Имя]
**Сервер**: budget-test
**Git branch**: dev/offlinemanager_migration_20260114195856
**Git commit**: [hash]

**Итоговый вердикт**: ✅ READY / ⚠️ NEEDS FIXES / ❌ NOT READY

**Комментарии**:
