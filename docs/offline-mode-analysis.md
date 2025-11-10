# Анализ оффлайн-режима для Family Budget

**Дата:** 2025-11-10
**Версия:** 1.0
**Статус:** Проектирование
**Автор:** Claude Code Analysis

---

## Executive Summary

Этот документ предоставляет комплексный анализ возможности реализации полноценного оффлайн-режима (Full CRUD) для системы управления семейным бюджетом Family Budget.

**Ключевые выводы:**
- ✅ Текущая архитектура готова к добавлению offline режима
- ✅ Модульная структура (api.js, storage.js) позволяет минимально инвазивную интеграцию
- ⚠️ Telegram Web Apps имеют ограничения: CloudStorage (4MB), NO Service Workers на iOS
- ⚠️ Shared Budget модель требует продуманного conflict resolution
- 📊 Рекомендация: **Hybrid Approach** (read + CREATE offline) как оптимальный старт

**Выбор пользователя:** Full CRUD с conflict resolution

---

## Содержание

1. [Текущая архитектура](#1-текущая-архитектура)
2. [Telegram Web Apps ограничения](#2-telegram-web-apps-ограничения)
3. [Сравнение вариантов реализации](#3-сравнение-вариантов-реализации)
4. [Архитектурное решение Full CRUD](#4-архитектурное-решение-full-crud)
5. [Conflict Resolution стратегия](#5-conflict-resolution-стратегия)
6. [Sequence Diagrams](#6-sequence-diagrams)
7. [UI Changes](#7-ui-changes)
8. [Риски и митигации](#8-риски-и-митигации)
9. [Оценка трудозатрат](#9-оценка-трудозатрат)
10. [Roadmap реализации](#10-roadmap-реализации)

---

## 1. Текущая архитектура

### 1.1 Frontend структура

**Расположение:** `/frontend/webapp/`

**8 HTML форм:**
- `index.html` - Main Menu (3x3 grid) + Quick Stats
- `add.html` - Add Transaction form (самый частый use case)
- `today.html` - Today's transactions list
- `list.html` - Transaction list с фильтрами
- `edit.html` - Edit/Delete transaction (unified)
- `stats.html` - Statistics by category (client-side aggregation)
- `addplan.html` - Create budget plan
- `summary.html` - Plan vs Fact comparison

### 1.2 JavaScript модули (7 core)

**Расположение:** `/frontend/webapp/static/js/`

#### 1. **api.js** (218 строк) - API Client
```javascript
class APIClient {
  async request(endpoint, options = {}) {
    // JWT Bearer auth
    // Error handling
    // ✅ КЛЮЧЕВАЯ ТОЧКА ИНТЕГРАЦИИ для offline cache layer
  }

  // Facts CRUD
  async listFacts(params = {})
  async createFact(data)
  async updateFact(id, data)
  async deleteFact(id)

  // Reference data
  async listArticles(params = {})
}
```

**Ключевые точки интеграции:**
- `request()` метод (строка 28) - единая точка для всех API вызовов
- Обработка network errors (строка 64-69) - уже есть try-catch
- `APIError` класс (строка 206) - можно расширить для offline errors

#### 2. **storage.js** (199 строк) - CloudStorage wrapper
```javascript
class Storage {
  async getJSON(key)  // Promise-based
  async setJSON(key, value)
  async getItem(key)
  async setItem(key, value)
  async getKeys()
  async removeItem(key)
}
```

**Готово к использованию:**
- Promise-based API (не callback-based)
- JSON serialization/deserialization
- Error handling

#### 3. **auth.js** (158 строк) - Authentication
```javascript
class Auth {
  async validate()  // JWT token from initData
  async saveTokenToStorage()
  async loadTokenFromStorage()
  getToken()
}
```

#### 4. **app.js** (166 строк) - Core initialization
```javascript
class BudgetApp {
  async init() {
    // 1. Telegram WebApp SDK init
    // 2. Theme setup
    // 3. Authentication
    // 4. Page-specific init (window.pageInit)
  }
}
```

#### 5-7. **ui.js, validators.js, theme.js** - UI utilities

**Итого:** ~190KB bundle (development), ~125KB (production minified + gzip)

### 1.3 Текущее использование storage

**Что хранится:**
- `access_token` - JWT token (7 дней lifetime) в CloudStorage

**Что НЕ хранится локально:**
- Reference data (categories, financial_centers, cost_centers)
- Transaction data (facts)
- Aggregate data (stats)

**Характеристики:**
- Каждый раз загружается с backend
- NO offline fallback
- NO cache layer

### 1.4 API Flows

#### Добавление транзакции (add.html)

```
1. При загрузке:
   GET /api/v1/articles?is_current=true  (~100 категорий, ~8KB)
   GET /api/v1/financial-centers          (~10 ЦФО, ~2KB)
   GET /api/v1/cost-centers                (~10 МВЗ, ~2KB)

2. При сохранении:
   POST /api/v1/facts
   Body: {
     article_id, fact_date, amount, description,
     record_type, financial_center_id, cost_center_id
   }
```

**Частота:** ~10 транзакций/день

#### Просмотр today's facts (today.html)

```
1. При загрузке:
   GET /api/v1/articles                     (~8KB)
   GET /api/v1/facts?date_from=2025-11-10
                    &date_to=2025-11-10
                    &limit=1000              (~5-10 транзакций, ~2KB)

2. Client-side aggregation:
   calculateSummary(facts)  // Доходы/расходы/баланс
```

**Client-side aggregation уже реализована!** (today.html:373)

#### Статистика (stats.html)

```
GET /api/v1/facts?date_from=...&date_to=...&limit=10000

Client-side:
  calculateSummary(facts)
  calculateCategoryBreakdown(facts, 'expense')
  calculateCategoryBreakdown(facts, 'income')
```

**Client-side aggregation показывает паттерн для offline analytics!**

### 1.5 Данные для offline работы

#### Reference Data (справочники)
- `t_d_article` - Статьи расходов/доходов (~100 записей, ~8KB JSON)
- `t_d_financial_center` - ЦФО (~10 записей, ~2KB JSON)
- `t_d_cost_center` - МВЗ (~10 записей, ~2KB JSON)

**Итого:** ~12KB reference data

**Характеристики:**
- Read-only для обычных пользователей
- Редко изменяются (раз в месяц?)
- SCD Type 2 (историчность)

#### Transaction Data (факты)

**Объемы:**
- 300 транзакций/месяц для семьи
- ~60KB JSON для месяца
- ~200KB JSON для квартала
- ~720KB JSON для года

**Для offline work нужно:**
- Current month facts: ~60KB
- Reference data: ~12KB
- **Итого:** ~80KB **легко помещается в CloudStorage (4MB limit)**

---

## 2. Telegram Web Apps ограничения

### 2.1 CloudStorage limits (официальная документация 2025)

**Лимиты:**
- **Maximum items:** 1,024 items per user
- **Key length:** 1-128 characters
- **Value length:** 0-4,096 characters
- **Итого:** ~4MB максимум (1024 × 4KB)

**Что помещается:**
- ✅ Reference data (~12KB) - 3 keys
- ✅ Current month facts (~60KB) - 1 key (JSON array)
- ✅ Sync queue (~10KB для 100 операций) - 1 key
- ✅ Offline metadata (~1KB) - 1 key
- **Итого:** ~85KB из 4MB available

**Вывод:** CloudStorage достаточно для offline work

### 2.2 Service Workers - НЕ ПОДДЕРЖИВАЮТСЯ на iOS!

**Критическая информация (GitHub issue #27, July 2024):**

> Service Workers are not functioning in Telegram Mini Apps when accessed on **iOS devices**, while the same Mini App with Service Workers works correctly on Android and macOS devices.

**Последствия:**
- ❌ NO background sync на iOS
- ❌ NO push notifications from Service Worker
- ❌ NO offline cache API

**Workaround:**
- Использовать DeviceStorage (5 MB per user) как альтернативу
- Manual sync при window.addEventListener('online')
- Foreground sync only

### 2.3 Альтернативные storage solutions

**DeviceStorage** (Telegram API)
- 5 MB per user
- Persistent local storage (like localStorage)
- Integrated within Telegram client

**SecureStorage** (Telegram API)
- 10 items per user
- System Keychain (iOS) / Keystore (Android)
- For tokens, secrets, auth state

**IndexedDB** (Standard Web API)
- Вероятно доступен (как стандартный browser API)
- Асинхронный, подходит для больших объемов
- Fallback если CloudStorage недостаточно

**Рекомендация:**
1. CloudStorage для metadata и небольших данных
2. IndexedDB для facts cache (если > 100KB)
3. SecureStorage для чувствительных данных (если нужно)

### 2.4 Network Detection

**Доступные API:**
```javascript
// Online/offline events
window.addEventListener('online', () => {
  console.log('Network restored');
  offlineManager.sync();
});

window.addEventListener('offline', () => {
  console.log('Network lost');
  offlineManager.enableOfflineMode();
});

// Connection quality
navigator.connection.effectiveType  // '4g', '3g', '2g', 'slow-2g'
```

**Ограничения:**
- Events могут запаздывать
- False positives (показывает online, но сервер недоступен)

**Best Practice:**
- Комбинировать events + API errors (fetch timeout)

---

## 3. Сравнение вариантов реализации

### 3.1 MVP Offline (read-only cache)

**Scope:**
- Offline просмотр today's facts
- Offline просмотр statistics
- NO CREATE/UPDATE/DELETE offline

**Архитектура:**
```javascript
// В api.js:request()
try {
  const response = await fetch(url, options);
  // Cache successful GET responses
  if (method === 'GET') {
    await storage.setJSON(`cache:${cacheKey}`, data);
  }
  return data;
} catch (error) {
  if (isNetworkError(error) && method === 'GET') {
    // Fallback to cache
    const cached = await storage.getJSON(`cache:${cacheKey}`);
    if (cached) {
      showOfflineBadge();
      return cached;
    }
  }
  throw error;
}
```

**Трудозатраты:** ~6 часов
- api.js: cache layer (~80 строк)
- app.js: cacheReferenceData() (~50 строк)
- UI: offline badge (~20 строк)
- **Итого:** ~200 строк кода

**Преимущества:**
- ✅ Простая реализация
- ✅ NO breaking changes
- ✅ Progressive enhancement
- ✅ Покрывает просмотр данных

**Недостатки:**
- ❌ Нельзя добавлять транзакции offline (самый частый use case!)
- ❌ Cache может быть stale (нет TTL)
- ❌ NO sync механизм

**Вывод:** Недостаточно для Family Budget use cases

---

### 3.2 Hybrid Approach (read + CREATE offline)

**Scope:**
- Offline cache для просмотра (today/week/month)
- Offline CREATE новых транзакций ✅
- NO offline UPDATE/DELETE (require online)

**Обоснование:**
- 90% use case - добавление новой транзакции (add.html)
- 10% use case - редактирование/удаление (edit.html)
- UPDATE/DELETE могут подождать до восстановления сети

**Архитектура:**
```javascript
class OfflineManager {
  async createFact(data) {
    if (!navigator.onLine) {
      // Offline: save to queue
      const tempId = `offline_${Date.now()}`;
      const queueItem = {
        id: tempId,
        operation: 'create',
        data: data,
        timestamp: Date.now(),
        clientId: this.getClientId()
      };

      await this.addToQueue(queueItem);
      ui.showMessage('Транзакция сохранена. Отправим при восстановлении сети.');

      return { id: tempId, ...data, _offline: true };
    }

    // Online: send immediately
    return await api.createFact(data);
  }

  async sync() {
    const queue = await this.getQueue();
    for (const item of queue) {
      try {
        if (item.operation === 'create') {
          const result = await api.createFact(item.data);
          await this.removeFromQueue(item.id);
          console.log(`Synced offline fact: ${item.id} → ${result.id}`);
        }
      } catch (error) {
        console.error(`Sync failed for ${item.id}:`, error);
        // Оставляем в очереди, попробуем позже
      }
    }
  }
}

// Auto-sync при восстановлении сети
window.addEventListener('online', () => {
  offlineManager.sync();
});
```

**Трудозатраты:** ~2-3 дня
- api.js: cache + queue layer (~200 строк)
- storage.js: queue management (~100 строк)
- app.js: network detection + auto-sync (~80 строк)
- UI: offline indicators, pending badge (~50 строк)
- Testing: offline scenarios (~100 строк)
- **Итого:** ~500 строк кода

**Преимущества:**
- ✅ Покрывает 90% use cases
- ✅ Простая conflict resolution (только CREATE, no conflicts)
- ✅ Средняя сложность
- ✅ Оптимальное соотношение польза/сложность

**Недостатки:**
- ❌ NO offline UPDATE/DELETE
- ⚠️ Sync queue может расти (если долго offline)

**Вывод:** **Рекомендуется** как оптимальный старт

---

### 3.3 Full CRUD (выбор пользователя)

**Scope:**
- Offline cache для просмотра
- Offline CREATE, UPDATE, DELETE ✅
- Sync queue с conflict resolution
- Eventual consistency

**Архитектура:** См. раздел 4

**Трудозатраты:** ~1-2 недели
- Offline storage layer (~400 строк)
- Sync engine с conflict resolution (~300 строк)
- Queue management (~150 строк)
- UI improvements (~100 строк)
- Testing (~300 строк)
- **Итого:** ~1500 строк кода

**Преимущества:**
- ✅ Полный CRUD offline
- ✅ Graceful degradation
- ✅ Лучший UX

**Недостатки:**
- ❌ Высокая сложность реализации
- ❌ Conflict resolution для shared budget
- ⚠️ NO background sync (Service Workers недоступны на iOS)
- ⚠️ Требуется тщательное тестирование

**Вывод:** Максимальная функциональность, высокая сложность

---

## 4. Архитектурное решение Full CRUD

### 4.1 Offline Storage Layer

**Цель:** Прозрачный offline cache для facts + reference data

**Структура данных в CloudStorage:**

```javascript
// Schema
{
  // Reference data (cached for 24h)
  "cache:articles": {
    data: Article[],
    timestamp: 1730000000,
    ttl: 86400000  // 24 hours
  },

  "cache:financial_centers": {
    data: FinancialCenter[],
    timestamp: 1730000000,
    ttl: 86400000
  },

  "cache:cost_centers": {
    data: CostCenter[],
    timestamp: 1730000000,
    ttl: 86400000
  },

  // Facts cache (by period)
  "cache:facts:2025-11": {
    data: Fact[],  // Текущий месяц
    timestamp: 1730000000,
    ttl: 3600000  // 1 hour (чаще обновляется)
  },

  // Sync queue
  "offline:queue": [
    {
      id: "offline_1730000001_create",
      operation: "create",
      entity: "fact",
      data: { article_id: 10, amount: 100, ... },
      timestamp: 1730000001,
      clientId: "user123_device456",
      version: 1,
      status: "pending"  // pending | syncing | failed
    },
    {
      id: "offline_1730000002_update",
      operation: "update",
      entity: "fact",
      factId: 42,
      data: { amount: 150 },
      originalData: { amount: 100 },  // Для rollback
      timestamp: 1730000002,
      clientId: "user123_device456",
      version: 2,
      status: "pending"
    },
    {
      id: "offline_1730000003_delete",
      operation: "delete",
      entity: "fact",
      factId: 43,
      originalData: { ... },  // Для восстановления
      timestamp: 1730000003,
      clientId: "user123_device456",
      version: 3,
      status: "pending"
    }
  ],

  // Metadata
  "offline:metadata": {
    clientId: "user123_device456",
    lastSyncTime: 1730000000,
    pendingOps: 3,
    isOnline: false
  }
}
```

**Объем данных:**
- Reference data: ~12KB
- Facts (current month): ~60KB
- Sync queue (100 операций): ~10KB
- Metadata: ~1KB
- **Итого:** ~85KB из 4MB available ✅

### 4.2 Offline Manager класс

```javascript
/**
 * OfflineManager - управление offline режимом и sync queue
 */
class OfflineManager {
  constructor(storage, api) {
    this.storage = storage;
    this.api = api;
    this.clientId = this.getOrCreateClientId();
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;

    // Network listeners
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Get or create unique client ID для version vectors
   */
  getOrCreateClientId() {
    const stored = localStorage.getItem('clientId');
    if (stored) return stored;

    const clientId = `user_${Date.now()}_${Math.random().toString(36)}`;
    localStorage.setItem('clientId', clientId);
    return clientId;
  }

  /**
   * CREATE fact (offline или online)
   */
  async createFact(data) {
    if (!this.isOnline) {
      return await this.createFactOffline(data);
    }

    try {
      return await this.api.createFact(data);
    } catch (error) {
      if (this.isNetworkError(error)) {
        return await this.createFactOffline(data);
      }
      throw error;
    }
  }

  async createFactOffline(data) {
    const tempId = `offline_${Date.now()}_create`;
    const queueItem = {
      id: tempId,
      operation: 'create',
      entity: 'fact',
      data: data,
      timestamp: Date.now(),
      clientId: this.clientId,
      version: await this.getNextVersion(),
      status: 'pending'
    };

    await this.addToQueue(queueItem);

    // Обновить local cache (optimistic update)
    await this.addFactToLocalCache(queueItem);

    return { id: tempId, ...data, _offline: true };
  }

  /**
   * UPDATE fact (offline или online)
   */
  async updateFact(factId, data) {
    if (!this.isOnline) {
      return await this.updateFactOffline(factId, data);
    }

    try {
      return await this.api.updateFact(factId, data);
    } catch (error) {
      if (this.isNetworkError(error)) {
        return await this.updateFactOffline(factId, data);
      }
      throw error;
    }
  }

  async updateFactOffline(factId, data) {
    // Получить original data для rollback
    const originalFact = await this.getFactById(factId);
    if (!originalFact) {
      throw new Error(`Fact ${factId} not found in local cache`);
    }

    const queueItem = {
      id: `offline_${Date.now()}_update_${factId}`,
      operation: 'update',
      entity: 'fact',
      factId: factId,
      data: data,
      originalData: originalFact,
      timestamp: Date.now(),
      clientId: this.clientId,
      version: await this.getNextVersion(),
      status: 'pending'
    };

    await this.addToQueue(queueItem);

    // Optimistic update
    await this.updateFactInLocalCache(factId, data);

    return { id: factId, ...originalFact, ...data, _offline: true };
  }

  /**
   * DELETE fact (offline или online)
   */
  async deleteFact(factId) {
    if (!this.isOnline) {
      return await this.deleteFactOffline(factId);
    }

    try {
      return await this.api.deleteFact(factId);
    } catch (error) {
      if (this.isNetworkError(error)) {
        return await this.deleteFactOffline(factId);
      }
      throw error;
    }
  }

  async deleteFactOffline(factId) {
    const originalFact = await this.getFactById(factId);
    if (!originalFact) {
      throw new Error(`Fact ${factId} not found`);
    }

    const queueItem = {
      id: `offline_${Date.now()}_delete_${factId}`,
      operation: 'delete',
      entity: 'fact',
      factId: factId,
      originalData: originalFact,
      timestamp: Date.now(),
      clientId: this.clientId,
      version: await this.getNextVersion(),
      status: 'pending'
    };

    await this.addToQueue(queueItem);

    // Optimistic delete (soft delete локально)
    await this.softDeleteFactInLocalCache(factId);

    return null;
  }

  /**
   * SYNC queue при восстановлении сети
   */
  async sync() {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return;
    }

    this.syncInProgress = true;
    console.log('[Offline] Starting sync...');

    try {
      const queue = await this.getQueue();

      // Sort by timestamp (FIFO)
      queue.sort((a, b) => a.timestamp - b.timestamp);

      for (const item of queue) {
        try {
          await this.syncItem(item);
        } catch (error) {
          console.error(`Failed to sync ${item.id}:`, error);

          // Mark as failed
          item.status = 'failed';
          item.error = error.message;
          await this.updateQueueItem(item);
        }
      }

      // Cleanup synced items
      await this.cleanupQueue();

      // Update metadata
      await this.updateMetadata({ lastSyncTime: Date.now() });

      console.log('[Offline] Sync completed');
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync single queue item
   */
  async syncItem(item) {
    console.log(`[Offline] Syncing ${item.operation} ${item.id}...`);

    item.status = 'syncing';
    await this.updateQueueItem(item);

    switch (item.operation) {
      case 'create':
        return await this.syncCreateFact(item);
      case 'update':
        return await this.syncUpdateFact(item);
      case 'delete':
        return await this.syncDeleteFact(item);
      default:
        throw new Error(`Unknown operation: ${item.operation}`);
    }
  }

  async syncCreateFact(item) {
    const result = await this.api.createFact(item.data);

    // Обновить local cache: заменить temporary ID на server ID
    await this.replaceOfflineFactWithServerFact(item.id, result);

    // Remove from queue
    await this.removeFromQueue(item.id);

    console.log(`[Offline] Created fact: ${item.id} → ${result.id}`);
    return result;
  }

  async syncUpdateFact(item) {
    try {
      // Попытка обновить на сервере
      const result = await this.api.updateFact(item.factId, item.data);

      // Sync успешен
      await this.updateFactInLocalCache(item.factId, result);
      await this.removeFromQueue(item.id);

      console.log(`[Offline] Updated fact: ${item.factId}`);
      return result;

    } catch (error) {
      // Conflict detection: HTTP 409 или fact not found
      if (error.status === 409 || error.status === 404) {
        console.warn(`[Conflict] Fact ${item.factId} was modified or deleted on server`);

        // Conflict resolution strategy
        return await this.resolveConflict(item, error);
      }
      throw error;
    }
  }

  async syncDeleteFact(item) {
    try {
      await this.api.deleteFact(item.factId);

      // Удалить из local cache
      await this.removeFactFromLocalCache(item.factId);
      await this.removeFromQueue(item.id);

      console.log(`[Offline] Deleted fact: ${item.factId}`);

    } catch (error) {
      if (error.status === 404) {
        // Уже удалено на сервере - не ошибка
        await this.removeFactFromLocalCache(item.factId);
        await this.removeFromQueue(item.id);
        console.log(`[Offline] Fact ${item.factId} already deleted on server`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Network error detection
   */
  isNetworkError(error) {
    return (
      error.message.includes('network') ||
      error.message.includes('fetch') ||
      error.status === 0 ||
      !navigator.onLine
    );
  }

  /**
   * Queue management
   */
  async getQueue() {
    return await this.storage.getJSON('offline:queue') || [];
  }

  async addToQueue(item) {
    const queue = await this.getQueue();
    queue.push(item);
    await this.storage.setJSON('offline:queue', queue);

    // Update pending count
    await this.updateMetadata({ pendingOps: queue.length });
  }

  async removeFromQueue(itemId) {
    const queue = await this.getQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    await this.storage.setJSON('offline:queue', filtered);

    await this.updateMetadata({ pendingOps: filtered.length });
  }

  async updateQueueItem(updatedItem) {
    const queue = await this.getQueue();
    const index = queue.findIndex(item => item.id === updatedItem.id);
    if (index !== -1) {
      queue[index] = updatedItem;
      await this.storage.setJSON('offline:queue', queue);
    }
  }

  async cleanupQueue() {
    const queue = await this.getQueue();
    const pending = queue.filter(item => item.status === 'pending' || item.status === 'failed');
    await this.storage.setJSON('offline:queue', pending);
  }

  /**
   * Version management (для conflict detection)
   */
  async getNextVersion() {
    const metadata = await this.getMetadata();
    const nextVersion = (metadata.version || 0) + 1;
    await this.updateMetadata({ version: nextVersion });
    return nextVersion;
  }

  async getMetadata() {
    return await this.storage.getJSON('offline:metadata') || {
      clientId: this.clientId,
      lastSyncTime: 0,
      pendingOps: 0,
      version: 0,
      isOnline: navigator.onLine
    };
  }

  async updateMetadata(updates) {
    const metadata = await this.getMetadata();
    Object.assign(metadata, updates);
    await this.storage.setJSON('offline:metadata', metadata);
  }

  /**
   * Event handlers
   */
  async handleOnline() {
    console.log('[Offline] Network restored');
    this.isOnline = true;
    await this.updateMetadata({ isOnline: true });

    // Auto-sync
    await this.sync();

    // Refresh cache
    await this.refreshCache();
  }

  async handleOffline() {
    console.log('[Offline] Network lost');
    this.isOnline = false;
    await this.updateMetadata({ isOnline: false });
  }

  /**
   * Cache management (будут реализованы в следующих секциях)
   */
  async addFactToLocalCache(fact) { /* ... */ }
  async updateFactInLocalCache(factId, data) { /* ... */ }
  async softDeleteFactInLocalCache(factId) { /* ... */ }
  async removeFactFromLocalCache(factId) { /* ... */ }
  async replaceOfflineFactWithServerFact(offlineId, serverFact) { /* ... */ }
  async getFactById(factId) { /* ... */ }
  async refreshCache() { /* ... */ }
}
```

### 4.3 Integration с api.js

**Модификация api.js:**

```javascript
class APIClient {
  constructor(auth) {
    this.auth = auth;
    this.baseURL = window.location.origin;
    this.offlineManager = null;  // Будет установлен позже
  }

  setOfflineManager(offlineManager) {
    this.offlineManager = offlineManager;
  }

  // OVERRIDE CRUD methods для offline support
  async createFact(data) {
    if (this.offlineManager) {
      return await this.offlineManager.createFact(data);
    }
    // Fallback: standard online request
    return this.request('/facts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateFact(id, data) {
    if (this.offlineManager) {
      return await this.offlineManager.updateFact(id, data);
    }
    return this.request(`/facts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteFact(id) {
    if (this.offlineManager) {
      return await this.offlineManager.deleteFact(id);
    }
    return this.request(`/facts/${id}`, {
      method: 'DELETE'
    });
  }

  // READ methods с offline cache
  async listFacts(params = {}) {
    try {
      const data = await this.request('/facts?' + new URLSearchParams(params));

      // Cache successful response
      if (this.offlineManager) {
        await this.offlineManager.cacheFactsResponse(params, data);
      }

      return data;
    } catch (error) {
      // Offline fallback
      if (this.offlineManager && this.offlineManager.isNetworkError(error)) {
        const cached = await this.offlineManager.getCachedFacts(params);
        if (cached) {
          console.log('[Offline] Using cached facts');
          return cached;
        }
      }
      throw error;
    }
  }

  async listArticles(params = {}) {
    try {
      const data = await this.request('/articles?' + new URLSearchParams(params));

      if (this.offlineManager) {
        await this.offlineManager.cacheArticles(data);
      }

      return data;
    } catch (error) {
      if (this.offlineManager && this.offlineManager.isNetworkError(error)) {
        const cached = await this.offlineManager.getCachedArticles();
        if (cached) {
          console.log('[Offline] Using cached articles');
          return cached;
        }
      }
      throw error;
    }
  }
}
```

**Initialization в app.js:**

```javascript
class BudgetApp {
  async init() {
    // ... existing init code ...

    // Step 6.5: Initialize Offline Manager
    this.storage = new Storage(this.tg);
    this.offlineManager = new OfflineManager(this.storage, this.api);
    this.api.setOfflineManager(this.offlineManager);

    console.log('App: Offline manager initialized');

    // ... rest of init code ...
  }
}
```

---

## 5. Conflict Resolution стратегия

### 5.1 Сравнение стратегий

#### CRDT (Conflict-Free Replicated Data Types)
**Используется:** Notion, Figma, Automerge, Yjs

**Преимущества:**
- Автоматическое слияние без координации
- Идеально для offline-first
- Eventual consistency

**Недостатки:**
- Высокая сложность реализации
- Больший overhead (metadata для каждого поля)
- Overkill для Family Budget

#### OT (Operational Transformation)
**Используется:** Google Docs

**Преимущества:**
- Strong consistency
- Меньший overhead

**Недостатки:**
- Требует центральный сервер
- Не работает offline
- НЕ подходит для нашего случая

#### LWW (Last-Write-Wins)
**Используется:** Redis, Amazon DynamoDB

**Преимущества:**
- Простая реализация
- Низкий overhead

**Недостатки:**
- Возможна потеря данных (последний выигрывает)

### 5.2 Выбранная стратегия: LWW + Field-level Merge

**Обоснование:**
- Family Budget - 2-5 пользователей (низкая вероятность конфликтов)
- Большинство полей независимы (amount, description, date)
- Редко редактируется одна транзакция двумя пользователями одновременно

**Алгоритм:**

```javascript
async resolveConflict(offlineItem, serverError) {
  console.log(`[Conflict] Resolving conflict for ${offlineItem.id}`);

  // 1. Fetch current server version
  let serverFact;
  try {
    const result = await this.api.listFacts({ limit: 1000 });
    serverFact = result.facts.find(f => f.id === offlineItem.factId);
  } catch (error) {
    console.error('[Conflict] Cannot fetch server version:', error);
    throw new Error('Conflict resolution failed: cannot fetch server data');
  }

  if (!serverFact) {
    // Fact был удален на сервере
    console.warn('[Conflict] Fact was deleted on server');

    // Strategy: Rollback offline change
    await this.rollbackChange(offlineItem);
    await this.removeFromQueue(offlineItem.id);

    ui.showWarning('Транзакция была удалена другим пользователем. Ваши изменения отменены.');
    return null;
  }

  // 2. Compare versions
  const offlineData = offlineItem.data;
  const serverData = {
    amount: serverFact.amount,
    article_id: serverFact.article_id,
    fact_date: serverFact.fact_date,
    description: serverFact.description
  };

  // 3. Field-level merge strategy
  const merged = {};

  // Amount: Use latest timestamp
  if (offlineData.amount !== serverData.amount) {
    // Сравнить timestamps (если доступно) или спросить пользователя
    merged.amount = await this.resolveFi ld(
      'amount',
      offlineData.amount,
      serverData.amount,
      offlineItem.timestamp,
      serverFact.updated_at
    );
  } else {
    merged.amount = serverData.amount;
  }

  // Article: Last-Write-Wins
  if (offlineData.article_id !== serverData.article_id) {
    merged.article_id = offlineItem.timestamp > new Date(serverFact.updated_at).getTime()
      ? offlineData.article_id
      : serverData.article_id;
  } else {
    merged.article_id = serverData.article_id;
  }

  // Description: Concatenate if both changed
  if (offlineData.description !== offlineItem.originalData.description &&
      serverData.description !== offlineItem.originalData.description) {
    merged.description = `${offlineData.description}\n---\n${serverData.description}`;
    console.log('[Conflict] Merged descriptions');
  } else {
    merged.description = offlineData.description || serverData.description;
  }

  // Date: LWW
  merged.fact_date = offlineItem.timestamp > new Date(serverFact.updated_at).getTime()
    ? offlineData.fact_date
    : serverData.fact_date;

  // 4. Apply merged version
  try {
    const result = await this.api.updateFact(offlineItem.factId, merged);

    await this.updateFactInLocalCache(offlineItem.factId, result);
    await this.removeFromQueue(offlineItem.id);

    ui.showWarning('Конфликт разрешен: изменения объединены.');
    console.log('[Conflict] Resolved and merged:', merged);

    return result;

  } catch (error) {
    console.error('[Conflict] Merge failed:', error);
    throw error;
  }
}

/**
 * Resolve single field conflict
 */
async resolveField(fieldName, offlineValue, serverValue, offlineTimestamp, serverTimestamp) {
  // LWW strategy by default
  const offlineTime = offlineTimestamp;
  const serverTime = new Date(serverTimestamp).getTime();

  if (offlineTime > serverTime) {
    console.log(`[Conflict] ${fieldName}: Using offline value (newer)`);
    return offlineValue;
  } else {
    console.log(`[Conflict] ${fieldName}: Using server value (newer)`);
    return serverValue;
  }

  // Optional: Manual resolution via UI (для critical fields)
  // return await this.askUserToResolve(fieldName, offlineValue, serverValue);
}

/**
 * Rollback offline change (восстановить original data)
 */
async rollbackChange(item) {
  if (item.operation === 'update') {
    await this.updateFactInLocalCache(item.factId, item.originalData);
    console.log(`[Conflict] Rolled back update for fact ${item.factId}`);
  } else if (item.operation === 'delete') {
    await this.addFactToLocalCache(item.originalData);
    console.log(`[Conflict] Restored deleted fact ${item.factId}`);
  }
}
```

### 5.3 UI для conflict resolution (опционально)

**Manual resolution popup:**

```javascript
async askUserToResolve(fieldName, offlineValue, serverValue) {
  return new Promise((resolve) => {
    app.ui.showPopup({
      title: 'Конфликт изменений',
      message: `Поле "${fieldName}" было изменено другим пользователем.\n\nВаше значение: ${offlineValue}\nНа сервере: ${serverValue}\n\nЧто использовать?`,
      buttons: [
        {
          type: 'default',
          text: 'Мое значение',
          id: 'offline'
        },
        {
          type: 'default',
          text: 'Серверное значение',
          id: 'server'
        },
        {
          type: 'destructive',
          text: 'Отменить изменения',
          id: 'cancel'
        }
      ]
    }, (buttonId) => {
      if (buttonId === 'offline') {
        resolve(offlineValue);
      } else if (buttonId === 'server') {
        resolve(serverValue);
      } else {
        resolve(null);  // Cancel - use server value
      }
    });
  });
}
```

---

## 6. Sequence Diagrams

### 6.1 Offline CREATE flow

```
User                    add.html            OfflineManager          CloudStorage         UI
 |                         |                      |                      |                  |
 |  Fill form              |                      |                      |                  |
 |-----------------------=>|                      |                      |                  |
 |                         |                      |                      |                  |
 |  Click "Save"           |                      |                      |                  |
 |-----------------------=>|                      |                      |                  |
 |                         |                      |                      |                  |
 |                         | createFact(data)     |                      |                  |
 |                         |--------------------->|                      |                  |
 |                         |                      |                      |                  |
 |                         |                      | Check navigator.onLine = false          |
 |                         |                      |                      |                  |
 |                         |                      | Generate tempId      |                  |
 |                         |                      | "offline_1730_create"|                  |
 |                         |                      |                      |                  |
 |                         |                      | Create queue item    |                  |
 |                         |                      | {operation: 'create',|                  |
 |                         |                      |  data, timestamp}    |                  |
 |                         |                      |                      |                  |
 |                         |                      | addToQueue(item)     |                  |
 |                         |                      |--------------------->|                  |
 |                         |                      |                      | Store in         |
 |                         |                      |                      | 'offline:queue'  |
 |                         |                      |                      |                  |
 |                         |                      | addFactToLocalCache()|                  |
 |                         |                      |--------------------->|                  |
 |                         |                      |                      | Update           |
 |                         |                      |                      | 'cache:facts:...'|
 |                         |                      |                      |                  |
 |                         | Return {id: tempId, ..., _offline: true}     |                  |
 |                         |<---------------------|                      |                  |
 |                         |                      |                      |                  |
 |                         | showMessage()        |                      |                  |
 |                         |---------------------------------------------------------------->|
 |                         |                      |                      |      "Транзакция |
 |                         |                      |                      | сохранена. Отправим|
 |                         |                      |                      | при восстановлении|
 |                         |                      |                      |           сети."  |
 |  See success message    |                      |                      |                  |
 |<------------------------|                      |                      |                  |
 |                         |                      |                      |                  |
 |  Reset form             |                      |                      |                  |
 |<------------------------|                      |                      |                  |
```

### 6.2 Online restoration and SYNC flow

```
Browser Event       OfflineManager       CloudStorage        Backend API          UI
      |                   |                    |                   |                |
navigator.onLine = true   |                    |                   |                |
      |                   |                    |                   |                |
      | 'online' event    |                    |                   |                |
      |------------------>|                    |                   |                |
      |                   |                    |                   |                |
      |                   | handleOnline()     |                   |                |
      |                   |                    |                   |                |
      |                   | sync()             |                   |                |
      |                   |                    |                   |                |
      |                   | getQueue()         |                   |                |
      |                   |------------------->|                   |                |
      |                   |                    | Return queue[]    |                |
      |                   |<-------------------|                   |                |
      |                   |                    |                   |                |
      |                   | Sort by timestamp  |                   |                |
      |                   |                    |                   |                |
      |                   | For each item:     |                   |                |
      |                   |                    |                   |                |
      |                   | syncItem(item)     |                   |                |
      |                   |                    |                   |                |
      |                   |   if operation == 'create':            |                |
      |                   |     POST /api/v1/facts                 |                |
      |                   |--------------------------------------->|                |
      |                   |                    |                   | Validate       |
      |                   |                    |                   | Create fact    |
      |                   |                    |                   | Return {id: 42}|
      |                   |<---------------------------------------|                |
      |                   |                    |                   |                |
      |                   | replaceOfflineFactWithServerFact()     |                |
      |                   |------------------->|                   |                |
      |                   |                    | Update cache:     |                |
      |                   |                    | tempId -> id 42   |                |
      |                   |                    |                   |                |
      |                   | removeFromQueue()  |                   |                |
      |                   |------------------->|                   |                |
      |                   |                    | Remove item       |                |
      |                   |                    |                   |                |
      |                   |   if operation == 'update':            |                |
      |                   |     PUT /api/v1/facts/{id}             |                |
      |                   |--------------------------------------->|                |
      |                   |                    |                   | Check version  |
      |                   |                    |                   | Update fact    |
      |                   |<---------------------------------------|                |
      |                   |                    | ИЛИ 409 Conflict   |                |
      |                   |                    |                   |                |
      |                   |   if 409:          |                   |                |
      |                   |     resolveConflict(item)              |                |
      |                   |--------------------------------------->|                |
      |                   |                    | Fetch server fact |                |
      |                   |<---------------------------------------|                |
      |                   | Field-level merge  |                   |                |
      |                   |                    |                   |                |
      |                   |     PUT /api/v1/facts/{id} (merged)    |                |
      |                   |--------------------------------------->|                |
      |                   |<---------------------------------------|                |
      |                   |                    |                   |                |
      |                   | cleanupQueue()     |                   |                |
      |                   |------------------->|                   |                |
      |                   |                    | Remove synced items                |
      |                   |                    |                   |                |
      |                   | updateMetadata({lastSyncTime})         |                |
      |                   |------------------->|                   |                |
      |                   |                    |                   |                |
      |                   | showMessage()      |                   |                |
      |                   |------------------------------------------------------->|
      |                   |                    |                   | "Синхронизация|
      |                   |                    |                   |    завершена" |
```

### 6.3 Conflict Detection and Resolution

```
OfflineManager         Backend API         Storage            UI
      |                     |                 |                |
syncUpdateFact(item)        |                 |                |
      |                     |                 |                |
      | PUT /facts/{id}     |                 |                |
      |-------------------->|                 |                |
      |                     | Check:          |                |
      |                     | - Fact exists?  |                |
      |                     | - Version match?|                |
      |                     |                 |                |
      |                     | IF modified:    |                |
      |     409 Conflict    |                 |                |
      |<--------------------|                 |                |
      |                     |                 |                |
resolveConflict(item)       |                 |                |
      |                     |                 |                |
      | GET /facts (find by ID)              |                |
      |-------------------->|                 |                |
      |  Return serverFact  |                 |                |
      |<--------------------|                 |                |
      |                     |                 |                |
      | Compare fields:     |                 |                |
      | - amount: offline vs server          |                |
      | - article_id: LWW   |                 |                |
      | - description: merge|                 |                |
      |                     |                 |                |
      | merged = {          |                 |                |
      |   amount: resolve(), |                |                |
      |   article_id: LWW,  |                 |                |
      |   description: concat                 |                |
      | }                   |                 |                |
      |                     |                 |                |
      | PUT /facts/{id} (merged)             |                |
      |-------------------->|                 |                |
      |      Success        |                 |                |
      |<--------------------|                 |                |
      |                     |                 |                |
      | updateCache(merged) |                 |                |
      |------------------------------------->|                |
      |                     |                 |                |
      | showWarning()       |                 |                |
      |------------------------------------------------------->|
      |                     |                 | "Конфликт     |
      |                     |                 | разрешен"     |
```

---

## 7. UI Changes

### 7.1 Offline Indicator

**Header badge при offline:**

```html
<!-- В каждой HTML форме добавить: -->
<div class="page-header">
  <div class="page-title">Добавить транзакцию</div>
  <div class="offline-badge" id="offline-badge" style="display: none;">
    📡 Оффлайн режим
  </div>
</div>

<style>
.offline-badge {
  position: absolute;
  top: 8px;
  right: 16px;
  padding: 4px 12px;
  background-color: #ff9500;
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
</style>

<script>
// В app.js
window.addEventListener('offline', () => {
  document.getElementById('offline-badge').style.display = 'block';
});

window.addEventListener('online', () => {
  document.getElementById('offline-badge').style.display = 'none';
});
</script>
```

### 7.2 Pending Operations Badge

**На index.html (Main Menu):**

```html
<button class="menu-item" onclick="window.location.href='/webapp/add.html'">
  <div class="menu-icon">➕</div>
  <div class="menu-label">Добавить</div>
  <div class="pending-badge" id="pending-badge" style="display: none;">
    <span id="pending-count">0</span>
  </div>
</button>

<style>
.pending-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background-color: #ff3b30;
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 700;
}
</style>

<script>
// Update pending count
async function updatePendingBadge() {
  const metadata = await app.offlineManager.getMetadata();
  const badge = document.getElementById('pending-badge');
  const count = document.getElementById('pending-count');

  if (metadata.pendingOps > 0) {
    count.textContent = metadata.pendingOps;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

// Poll every 5 seconds
setInterval(updatePendingBadge, 5000);
</script>
```

### 7.3 Offline Transaction Indicator

**В today.html и list.html - показывать offline facts с badge:**

```javascript
function createTransactionItem(fact) {
  // ... existing code ...

  if (fact._offline) {
    // Add offline indicator
    const offlineBadge = document.createElement('span');
    offlineBadge.className = 'offline-transaction-badge';
    offlineBadge.textContent = '⏳ Ожидает синхронизации';
    offlineBadge.style.cssText = `
      display: inline-block;
      padding: 2px 8px;
      background-color: #ff9500;
      color: white;
      border-radius: 8px;
      font-size: 10px;
      margin-left: 8px;
    `;

    category.appendChild(offlineBadge);
  }

  // ... rest of code ...
}
```

### 7.4 Sync Progress Toast

**При синхронизации:**

```javascript
// В OfflineManager.sync()
async sync() {
  const queue = await this.getQueue();

  if (queue.length === 0) {
    console.log('[Offline] Nothing to sync');
    return;
  }

  // Show toast
  app.ui.showToast(`Синхронизация ${queue.length} операций...`);

  // ... sync logic ...

  // Success toast
  app.ui.showToast('Синхронизация завершена', 'success');
}
```

### 7.5 Conflict Resolution Dialog

**Пример UI для manual conflict resolution:**

```javascript
app.ui.showPopup({
  title: 'Конфликт изменений',
  message: `Транзакция была изменена другим пользователем.\n\nВаша сумма: 500 ₽\nНа сервере: 600 ₽\n\nВыберите действие:`,
  buttons: [
    {
      type: 'default',
      text: 'Использовать мою сумму',
      id: 'mine'
    },
    {
      type: 'default',
      text: 'Использовать серверную сумму',
      id: 'server'
    },
    {
      type: 'destructive',
      text: 'Отменить мои изменения',
      id: 'cancel'
    }
  ]
}, (buttonId) => {
  // Handle user choice
});
```

---

## 8. Риски и митигации

### 8.1 Технические риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| **CloudStorage size limit (4MB)** | Низкая | Средний | Использовать IndexedDB для facts если > 100KB. Ограничить offline cache (только current month). |
| **Service Workers НЕ работают на iOS** | Критическая | Высокий | **Уже учтено:** NO background sync, только foreground manual sync при 'online' event. |
| **Conflict resolution потеря данных** | Средняя | Высокий | LWW + field-level merge. Сохранять originalData для rollback. Manual resolution UI для critical conflicts. |
| **Sync queue может расти (долго offline)** | Низкая | Средний | Лимит 100 операций в очереди. Показывать warning если > 50. Cleanup failed items после 7 дней. |
| **Optimistic updates могут быть отменены при sync** | Средняя | Низкий | Показывать "Ожидает синхронизации" badge. Rollback с notification если sync failed. |
| **Multiple devices одного пользователя** | Средняя | Средний | ClientId для каждого device. Version vectors для conflict detection. |
| **Network detection false positives** | Средняя | Низкий | Комбинировать `navigator.onLine` + API error detection (fetch timeout). |

### 8.2 Бизнес риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| **Пользователи не понимают offline mode** | Средняя | Низкий | Четкие UI indicators (offline badge, pending count). Onboarding toast при первом offline использовании. |
| **Ожидание instant sync** | Средняя | Низкий | Показывать sync progress. Toast notifications "Синхронизировано N операций". |
| **Конфликты между членами семьи** | Низкая | Средний | Family Budget - low concurrency (2-5 users). LWW достаточно. Показывать manual resolution UI только для critical conflicts. |
| **Потеря данных из-за cache eviction** | Очень низкая | Критический | CloudStorage persistent (не очищается browser). Sync queue в separate key. Periodic backup в SecureStorage. |

### 8.3 UX риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| **Запутывающие offline indicators** | Низкая | Низкий | Minimalist design: simple badge "📡 Оффлайн". Pending count badge "3" без текста. |
| **Непонятно когда sync произойдет** | Средняя | Низкий | Автоматически при 'online' event. Manual "Sync Now" button в settings. |
| **Страх потери данных** | Средняя | Средний | Сохранять offline transactions сразу. Показывать "Сохранено локально" сообщение. |

---

## 9. Оценка трудозатрат

### 9.1 Full CRUD реализация (поэтапно)

#### Фаза 1: Core Offline Infrastructure (Week 1)

**Задачи:**
1. Создать `OfflineManager` класс (~400 строк)
   - CloudStorage integration
   - Queue management (add/remove/update)
   - Version management
   - ClientId generation
2. Модифицировать `api.js` для offline support (~150 строк)
   - Override CRUD methods
   - Cache GET responses
   - Network error detection
3. Добавить network detection в `app.js` (~80 строк)
   - Online/offline event listeners
   - Auto-sync trigger
4. Unit tests для OfflineManager (~200 строк)

**Трудозатраты:** 5-6 дней (40-48 часов)

#### Фаза 2: CRUD Operations Offline (Week 2)

**Задачи:**
1. Implement offline CREATE (~100 строк)
   - createFactOffline()
   - addFactToLocalCache()
   - addToQueue()
2. Implement offline UPDATE (~120 строк)
   - updateFactOffline()
   - updateFactInLocalCache()
   - originalData для rollback
3. Implement offline DELETE (~100 строк)
   - deleteFactOffline()
   - softDeleteFactInLocalCache()
4. Cache management (~150 строк)
   - cacheFactsResponse()
   - getCachedFacts()
   - refreshCache()
   - TTL expiration
5. Integration tests (~150 строк)

**Трудозатраты:** 5-6 дней (40-48 часов)

#### Фаза 3: Sync Engine (Week 3)

**Задачи:**
1. Implement sync() method (~150 строк)
   - syncItem() dispatcher
   - syncCreateFact()
   - syncUpdateFact()
   - syncDeleteFact()
2. Error handling и retry logic (~100 строк)
   - Mark failed items
   - Exponential backoff (если нужно)
3. Conflict detection (~80 строк)
   - HTTP 409 handling
   - Version mismatch detection
4. Integration tests для sync (~150 строк)

**Трудозатраты:** 4-5 дней (32-40 часов)

#### Фаза 4: Conflict Resolution (Week 4)

**Задачи:**
1. Implement resolveConflict() method (~200 строк)
   - Fetch server version
   - Field-level merge (LWW)
   - Description concatenation
2. Rollback mechanism (~80 строк)
   - rollbackChange()
   - Restore originalData
3. (Optional) Manual resolution UI (~100 строк)
   - askUserToResolve()
   - Popup dialog
4. E2E tests для conflicts (~200 строк)

**Трудозатраты:** 4-5 дней (32-40 часов)

#### Фаза 5: UI Improvements (Week 5)

**Задачи:**
1. Offline badge в header (~30 строк)
2. Pending operations badge (~50 строк)
3. Offline transaction indicator (~40 строк)
4. Sync progress toast (~30 строк)
5. Settings: manual sync button (~30 строк)
6. CSS стили для всех UI элементов (~100 строк)

**Трудозатраты:** 2-3 дня (16-24 часа)

#### Фаза 6: Testing & Bugfixes (Week 6)

**Задачи:**
1. Manual testing на разных devices (iOS, Android)
2. Edge cases testing:
   - Долго offline (несколько дней)
   - Большая sync queue (>50 операций)
   - Multiple devices sync одновременно
   - Network interruptions во время sync
3. Performance testing
4. Bugfixes

**Трудозатраты:** 5 дней (40 часов)

### 9.2 Итоговая оценка

**Общее время:** 5-6 недель (200-240 часов)

**Breakdown:**
- Разработка: 160-200 часов
- Тестирование: 40 часов

**Team size:** 1 разработчик

**Risk buffer:** +20% (добавить 1 неделю на непредвиденные проблемы)

**Итого:** **6-7 недель**

---

## 10. Roadmap реализации

### 10.1 MVP Approach (Hybrid - рекомендуется как старт)

**Scope:** Read + CREATE offline (NO UPDATE/DELETE)

**Timeline:** 2-3 недели

**Преимущества:**
- Покрывает 90% use cases
- Меньше рисков (no conflict resolution)
- Faster time to market
- Можно итеративно добавить UPDATE/DELETE позже

**Roadmap:**
1. **Week 1:** Core Infrastructure + CREATE offline
2. **Week 2:** Sync engine (only CREATE sync) + UI improvements
3. **Week 3:** Testing + Bugfixes + Production deploy

### 10.2 Full CRUD Approach (выбор пользователя)

**Scope:** Full CRUD offline + Conflict Resolution

**Timeline:** 6-7 недель

**Roadmap:**
```
Week 1: Core Offline Infrastructure
  - OfflineManager class
  - Queue management
  - api.js modifications
  - Network detection

Week 2: CRUD Operations Offline
  - CREATE offline
  - UPDATE offline
  - DELETE offline
  - Cache management

Week 3: Sync Engine
  - Sync dispatcher
  - syncCreateFact()
  - syncUpdateFact()
  - syncDeleteFact()

Week 4: Conflict Resolution
  - resolveConflict() implementation
  - LWW + field-level merge
  - Rollback mechanism
  - Manual resolution UI (optional)

Week 5: UI Improvements
  - Offline indicators
  - Pending badges
  - Sync progress
  - Settings UI

Week 6-7: Testing & Production
  - Manual testing (iOS, Android)
  - Edge cases
  - Performance testing
  - Bugfixes
  - Production deploy
```

### 10.3 Incremental Rollout Strategy

**Stage 1:** Beta testing (2 семьи, 1 неделя)
- Собрать feedback
- Выявить edge cases
- Проверить UX понятность

**Stage 2:** Limited rollout (10% пользователей, 2 недели)
- Мониторинг ошибок
- Performance metrics
- Conflict resolution статистика

**Stage 3:** Full rollout (100% пользователей)
- Gradual increase: 10% → 30% → 50% → 100%

---

## 11. Заключение

### 11.1 Ключевые выводы

✅ **Текущая архитектура готова:**
- Модульная структура (api.js, storage.js)
- Client-side aggregation уже реализована
- Storage wrapper готов к использованию

⚠️ **Ограничения Telegram Web Apps:**
- CloudStorage: 4MB (достаточно для Family Budget)
- NO Service Workers на iOS (no background sync)
- Manual sync only

✅ **Full CRUD реализуем:**
- LWW + field-level merge для conflict resolution
- Optimistic updates + sync queue
- 6-7 недель разработки

### 11.2 Рекомендация

**Начать с Hybrid Approach (read + CREATE offline):**

**Причины:**
1. Покрывает 90% use cases (добавление транзакций - самый частый сценарий)
2. Меньше рисков (no UPDATE/DELETE conflicts)
3. Faster time to market (2-3 недели)
4. Можно итеративно добавить UPDATE/DELETE позже на основе user feedback

**Затем при необходимости:**
- Добавить offline UPDATE (еще 2 недели)
- Добавить offline DELETE (еще 1 неделя)
- Implement conflict resolution (еще 2 недели)

**Итого:** Incremental rollout с постепенным усложнением

### 11.3 Следующие шаги

**Если одобрено - начать с:**
1. Создать feature branch `feature/offline-mode`
2. Implement OfflineManager base class (Week 1)
3. Add CREATE offline support (Week 1-2)
4. Testing на dev environment (Week 2)
5. Beta testing с 2 семьями (Week 3)

**Документация для реализации:**
- [Technical Specification для разработчика] (создать отдельный документ)
- [API Documentation для offline endpoints] (если нужны изменения в backend)
- [Testing Scenarios] (edge cases для QA)

---

**Автор:** Claude Code
**Дата создания:** 2025-11-10
**Статус:** Ready for Review
**Версия:** 1.0
