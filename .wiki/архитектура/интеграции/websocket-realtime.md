---
wiki_sources: ["docs/architecture/core/websocket.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["WebSocket", "Redis"]
aliases: ["WebSocket", "Real-Time Updates", "BudgetWSClient", "Redis Pub/Sub"]
---

# WebSocket Real-Time Updates

Система real-time обновлений браузера через WebSocket с Redis Pub/Sub на backend. Обеспечивает мгновенное отображение изменений данных на всех подключённых клиентах.

## Основные характеристики

### Конфигурация

```javascript
NAVIGATION_WINDOW = 10000;    // 10 с подавления RTT после перезагрузки
RTT_THRESHOLD = 2000;         // Порог медленного соединения
RTT_WINDOW_SIZE = 5;          // Rolling average window
CLIENT_PING_INTERVAL = 15000; // Ping каждые 15 с (8 с на iOS)
```

### Lifecycle подключения

**После авторизации (v11.4.2):**
```javascript
// base.html
window.budgetWSClient = new BudgetWSClient();
setTimeout(() => {
  if (window.budgetWSClient?.enabled) window.budgetWSClient.connect();
}, 1000); // 1с — ожидание инициализации offlineManager
```

**Reconnection (Exponential Backoff):**
- Первая попытка: 1 с (500 мс для navigation-triggered close)
- Максимальная задержка: 30 с
- Максимум попыток: 10
- Сброс при успешном подключении

### Коды закрытия

| Код | Значение | Действие |
|-----|---------|---------|
| 1000 | Normal close | Reconnect с backoff |
| 4001 | Auth error | Отключить reconnect |
| 4029 | Connection limit | Достигнут максимум попыток |

### Batch Delete Events (v6.6.0)

Вместо N индивидуальных событий при массовом удалении — одно summary-событие:
- `facts_batch_deleted: {fact_ids, deleted_count, record_type?}`
- `recurring_plans_batch_deleted: {plan_ids, deleted_count}`

Инициатор: 1 toast-уведомление. Другие клиенты: silent auto-reload.

### Multi-Tab Coordination

Паттерн [[leader-follower]]: первая вкладка = Leader (WebSocket), остальные = Followers (BroadcastChannel). На iOS — каждая вкладка создаёт своё соединение.

### RTT Filtering

RTT-измерения фильтруются в течение 10 секунд после загрузки страницы (navigation window), чтобы избежать ложных предупреждений о медленном соединении при WebSocket reconnect.

## Связанные концепции

- [[leader-follower]]
- [[pwa-service-worker]]
- [[offline-first]]
