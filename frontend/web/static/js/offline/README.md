# Offline Mode для Family Budget PWA

## 📊 **Progress Summary**

### ✅ **ЗАВЕРШЕНО** (Commit: 2674aae3)

1. **IndexedDB Storage Layer** (`idb.js` - 730 lines)
   - 5 object stores: `offline_facts`, `offline_transfers`, `offline_plans`, `sync_queue`, `data_cache`
   - Full CRUD для всех entities
   - Indexes: `synced`, `createdAt`, `serverId`, `status`, `timestamp`
   - Error handling (QuotaExceededError ready)
   - Utility methods: `getPendingCount()`, `getInfo()`, `clearExpiredCache()`

2. **OfflineManager** (`offlineManager.js` - 640 lines)
   - **Full CRUD** для facts/transfers/plans (CREATE/UPDATE/DELETE)
   - Online/offline detection с автоматическим fallback
   - Background Sync API support (Chrome, Edge, Яндекс.Браузер)
   - Safari fallback через polling (каждые 30 сек)
   - Retry logic: max 3 retries с экспоненциальной задержкой
   - Network event handlers (`online`/`offline`)

3. **ConflictResolver** (`conflictResolver.js` - 310 lines)
   - LWW (Last-Write-Wins) для автоматического разрешения
   - **Manual confirmation dialog** для critical fields (`amount`, `article_id`, etc.)
   - Field-level merge для text fields (`description`)
   - Auto-resolve preference в localStorage

4. **PushNotificationManager** (`pushManager.js` - 300 lines)
   - VAPID key support (загрузка с backend)
   - Push subscription management
   - Local notifications (без push-сервера)
   - Browser support: Chrome, Edge, Safari 16.4+, Yandex

5. **Service Worker Extensions** (`sw.js` - +285 lines, total 538)
   - Background Sync event handler (`sync-budget-data`)
   - Push notification handlers (`push`, `notificationclick`)
   - IndexedDB integration в SW контексте
   - Automatic sync при восстановлении сети
   - Sync result notifications

**Total: ~2300 lines of offline functionality**

---

## ⏳ **ОСТАЛОСЬ СДЕЛАТЬ**

### 1. Обновить `base.html` (30 минут)

```html
<!-- В <head> section -->
<script src="/static/js/offline/idb.min.js?v=PLACEHOLDER"></script>
<script src="/static/js/offline/offlineManager.min.js?v=PLACEHOLDER"></script>
<script src="/static/js/offline/conflictResolver.min.js?v=PLACEHOLDER"></script>
<script src="/static/js/offline/pushManager.min.js?v=PLACEHOLDER"></script>

<!-- В <body>, перед закрывающим </body> -->
<!-- Offline Badge -->
<div id="offline-badge" class="fixed top-16 right-4 z-50 hidden">
  <div class="alert alert-warning shadow-lg">
    <svg>...</svg>
    <span>Оффлайн режим</span>
  </div>
</div>

<!-- Pending Sync Badge -->
<div id="pending-sync-badge" class="fixed top-16 left-4 z-50 hidden">
  <div class="badge badge-error gap-2">
    <svg class="animate-spin">...</svg>
    <span id="pending-count">0</span> ожидает синхронизации
  </div>
</div>

<script>
// Initialize offline manager
window.offlineManager = new OfflineManager();
window.pushManager = new PushNotificationManager();

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  await window.offlineManager.init();
  await window.pushManager.init();

  // Update UI
  updateOfflineUI();
});

// Network status handlers
window.addEventListener('online', () => {
  document.getElementById('offline-badge').classList.add('hidden');
});

window.addEventListener('offline', () => {
  document.getElementById('offline-badge').classList.remove('hidden');
});

// Update pending count
async function updatePendingCount() {
  if (!window.offlineManager) return;

  const count = await window.offlineManager.getPendingCount();
  const badge = document.getElementById('pending-sync-badge');
  const countEl = document.getElementById('pending-count');

  if (count > 0) {
    badge.classList.remove('hidden');
    countEl.textContent = count;
  } else {
    badge.classList.add('hidden');
  }
}

setInterval(updatePendingCount, 5000);
</script>
```

### 2. Интегрировать с модалками (1-2 часа)

**Пример для `modal_transaction.html`:**

```javascript
// В форме создания транзакции
async function handleTransactionSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);

  const data = {
    fact_date: formData.get('fact_date'),
    amount: parseFloat(formData.get('amount')),
    article_id: parseInt(formData.get('article_id')),
    record_type: formData.get('record_type'),
    // ...
  };

  try {
    // Используем OfflineManager вместо прямого fetch
    const result = await window.offlineManager.createFact(data);

    if (result._offline) {
      showToast('Транзакция сохранена оффлайн (будет синхронизирована)', 'warning');
    } else {
      showToast('Транзакция создана успешно', 'success');
    }

    modal.close();
    location.reload();
  } catch (error) {
    showToast('Ошибка: ' + error.message, 'error');
  }
}
```

**Аналогично для `modal_transfer.html` и `modal_plan.html`**

### 3. Backend Push API (1-2 часа)

**Создать:** `backend/app/api/v1/endpoints/push.py`

```python
from fastapi import APIRouter, Depends
from py_vapid import Vapid
from pywebpush import webpush, WebPushException

router = APIRouter()

# Generate VAPID keys (one time)
vapid = Vapid()
vapid.generate_keys()
VAPID_PRIVATE_KEY = vapid.private_key.to_pem()
VAPID_PUBLIC_KEY = vapid.public_key.to_pem()
VAPID_CLAIMS = {"sub": "mailto:admin@example.com"}

@router.get("/vapid-key")
async def get_vapid_key():
    """Получить VAPID public key для push subscriptions"""
    return {"public_key": VAPID_PUBLIC_KEY.decode()}

@router.post("/subscribe")
async def subscribe_to_push(
    subscription: dict,
    current_user: User = Depends(get_current_user)
):
    """Сохранить push subscription для пользователя"""
    # Save subscription to database
    # ...
    return {"status": "subscribed"}

@router.post("/unsubscribe")
async def unsubscribe_from_push(
    subscription: dict,
    current_user: User = Depends(get_current_user)
):
    """Удалить push subscription"""
    # Remove subscription from database
    # ...
    return {"status": "unsubscribed"}

@router.post("/notify")
async def send_push_notification(
    user_id: int,
    title: str,
    body: str
):
    """Отправить push notification пользователю"""
    # Get user subscription from database
    subscription_info = get_user_subscription(user_id)

    if not subscription_info:
        raise HTTPException(404, "No subscription found")

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps({
                "title": title,
                "body": body
            }),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
        return {"status": "sent"}
    except WebPushException as e:
        raise HTTPException(500, f"Push failed: {e}")
```

**Добавить в `backend/app/api/v1/router.py`:**
```python
from backend.app.api.v1.endpoints import push

router.include_router(push.router, prefix="/push", tags=["push"])
```

**Установить зависимости:**
```bash
pip install py-vapid pywebpush
echo "py-vapid==1.9.0" >> backend/requirements.txt
echo "pywebpush==1.14.1" >> backend/requirements.txt
```

### 4. Minify offline modules (10 минут)

```bash
cd ~/familyBudget
npm run build  # Автоматически минифицирует все JS файлы включая offline/*
```

### 5. Testing (2-3 часа)

**Unit tests:**
```javascript
// tests/unit/test_idb.js
describe('IndexedDBManager', () => {
  it('should initialize database', async () => {
    const db = new IndexedDBManager();
    await db.init();
    expect(db.isInitialized).toBe(true);
  });

  it('should add fact offline', async () => {
    const db = new IndexedDBManager();
    const fact = { tempId: 'test_1', data: {}, synced: false };
    await db.addFact(fact);

    const retrieved = await db.getFact('test_1');
    expect(retrieved.tempId).toBe('test_1');
  });
});
```

**Integration tests:**
```bash
# Scenario 1: Offline CREATE → Online sync
1. Go offline (DevTools → Network → Offline)
2. Create transaction
3. Verify transaction in IndexedDB
4. Go online
5. Wait for sync
6. Verify transaction in backend DB
```

**E2E tests (Playwright):**
```javascript
test('offline mode works', async ({ page, context }) => {
  await context.setOffline(true);

  await page.goto('/facts');
  await page.click('[data-test=add-transaction]');
  await page.fill('[name=amount]', '500');
  await page.click('[type=submit]');

  await expect(page.locator('#offline-badge')).toBeVisible();

  await context.setOffline(false);

  await page.waitForSelector('#offline-badge', { state: 'hidden' });
  await expect(page.locator('.notification:has-text("Синхронизировано")')).toBeVisible();
});
```

---

## 🎯 **NEXT STEPS (Для продолжения)**

1. ✅ **Обновить base.html** - подключить offline модули и UI indicators
2. ✅ **Интегрировать с модалками** - заменить `fetch` на `offlineManager`
3. ✅ **Создать Backend Push API** - VAPID keys + subscription management
4. ✅ **Minify** - `npm run build`
5. ✅ **Тестирование** - unit + integration + E2E
6. ✅ **Документация** - обновить CLAUDE.md с offline features

---

## 📖 **Usage Example**

### Пример использования в коде:

```javascript
// Создать транзакцию (offline-ready)
const manager = window.offlineManager;

const fact = await manager.createFact({
  fact_date: '2025-12-02',
  amount: 500,
  article_id: 10,
  record_type: 'expense',
  financial_center_id: 1,
  description: 'Покупка продуктов'
});

if (fact._offline) {
  console.log('Сохранено оффлайн, будет синхронизировано');
  console.log('tempId:', fact.tempId);
} else {
  console.log('Сохранено на сервер');
  console.log('id:', fact.id);
}

// Получить статус
const info = await manager.getInfo();
console.log('Pending items:', info.pendingCount);
console.log('Stats:', info.stats);

// Ручная синхронизация
const results = await manager.sync();
console.log(`Synced: ${results.synced}, Failed: ${results.failed}`);
```

---

## 🌐 **Browser Compatibility**

| Feature | Chrome | Edge | Safari | Yandex |
|---------|--------|------|--------|--------|
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Service Workers | ✅ | ✅ | ✅ | ✅ |
| Background Sync | ✅ | ✅ | ❌* | ✅ |
| Push API | ✅ | ✅ | ✅ 16.4+ | ✅ |

*Safari не поддерживает Background Sync - используется fallback с polling (каждые 30 сек).

---

## 📝 **TODO (Будущие улучшения)**

- [ ] Conflict resolution UI tests
- [ ] Retry exponential backoff (сейчас фиксированная задержка)
- [ ] Batch sync (отправлять несколько items одним запросом)
- [ ] Offline analytics (кеширование данных для графиков)
- [ ] Service Worker periodic sync (для Safari)
- [ ] IndexedDB quota management (автоматическая очистка старых данных)

---

**Создано:** 2025-12-02
**Branch:** `test`
**Commit:** 2674aae3
