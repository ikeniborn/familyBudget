---
wiki_sources:
  - "docs/architecture/core/websocket.md"
  - "docs/architecture/overview.yaml"
  - "docs/architecture/features/transfers-system.md"
wiki_updated: 2026-05-06
wiki_status: mature
wiki_outgoing_links:
  - "[[dexie-module]]"
  - "[[аутентификация]]"
tags:
  - family-budget
  - architecture
  - frontend
  - realtime
aliases:
  - "budgetWSClient"
  - "BudgetWSClient"
  - "WebSocket клиент"
---

# WebSocket клиент (budgetWSClient)

Модуль `budgetWSClient` обеспечивает real-time двустороннюю коммуникацию между браузером и сервером. Реализует Dexie sync protocol, multi-tab координацию и fallback на Long Polling.

## Основные характеристики

| Параметр | Значение |
|----------|----------|
| Bundle | `frontend/web/static/js/budget/budgetWSClient.min.js` |
| Размер | ~75KB minified / ~14KB gzip |
| LOC | 1450 |
| Версия | 2.0.0 |

## Архитектура модуля

```
core/connectionManager.ts   — жизненный цикл WebSocket-соединения
integration/syncHandler.ts  — обработка sync_initial и sync_incremental
integration/uploadHandler.ts — загрузка изменений клиента с retry
integration/eventHandlers.ts — диспетчеризация событий
types/events.ts             — TypeScript-интерфейсы событий
```

## WebSocket события

| Событие | Тип | Описание |
|---------|-----|---------|
| `fact_created/updated/deleted` | Транзакция | CRUD над фактами |
| `transfer_created/deleted` | Транзакция | Операции переводов |
| `facts_batch_deleted` | Batch | Массовое удаление (v6.6.0+) |
| `recurring_plans_batch_deleted` | Batch | Массовое удаление планов |
| `sync_initial` | Sync | Начальная синхронизация reference data |
| `sync_incremental` | Sync | Дельта-обновления |
| `sync_client_changes_response` | Sync | Ответ на загрузку изменений |

**Batch события (v6.6.0+):** Вместо N индивидуальных событий — одно сводное (payload: `{ids: int[], count: int}`). Это устраняет спам toast-уведомлений при массовых операциях.

## Multi-tab координация (Leader-Follower)

- Первая вкладка = Leader (создаёт WebSocket)
- Остальные вкладки = Followers (используют BroadcastChannel)
- Leader транслирует heartbeat каждые 3 секунды
- **iOS-исключение:** `isLeader = true` принудительно (Web Locks API ненадёжен на iOS), интервал пинга 8s (vs 15s на desktop)

## Стратегия переподключения

**Exponential backoff:**
- Первая попытка: 1s (500ms при навигационном закрытии)
- Максимальная задержка: 30s
- Максимум попыток: 10
- Сброс при успешном соединении

**Коды закрытия:**
| Код | Значение | Действие |
|-----|---------|---------|
| 1000 | Нормальное закрытие | Переподключение с backoff |
| 4001 | Auth error | Переподключение отключено |
| 4029 | Лимит соединений | Макс. попыток достигнут |

## RTT мониторинг (v5.8.0+)

Фильтры для предотвращения ложных предупреждений «медленное соединение»:
- **Navigation filter:** Измерения подавляются первые 10 секунд после загрузки страницы (WebSocket только переподключился)
- **Anomalous first filter:** Skip если RTT > 4000ms при первом измерении

Константы: `NAVIGATION_WINDOW=10000ms`, `RTT_THRESHOLD=2000ms`, `RTT_WINDOW_SIZE=5`

## Ключевые баги и фиксы

**v11.3.7 — WebSocket не подключается после авторизации:**
- Причина: `_isOfflineModeActive()` возвращал `true` до завершения инициализации `offlineManager`
- Фикс: проверка флага `sessionStorage.just_logged_in` для пропуска offline-проверки

**v11.4.2 — NO_SOCKET состояние:**
- Причина: `connect()` не вызывался автоматически при создании instance
- Фикс: auto-connect с задержкой 1 секунда (даёт время offlineManager инициализироваться)

```javascript
window.budgetWSClient = new BudgetWSClient();
setTimeout(() => {
  if (window.budgetWSClient?.enabled) window.budgetWSClient.connect();
}, 1000);
```

## Обработка события transfer_created (IncrementalUpdates)

При получении события `transfer_created` frontend выполняет:
```javascript
case 'transfer_created':
    await incrementalUpdates.refreshMetrics();    // обновить балансы
    await incrementalUpdates.refreshTransfers();  // обновить виджет переводов
    break;
```

Ручной `htmx.ajax()` не требуется — WebSocket покрывает обновление UI. Это исключает двойные toast-уведомления, которые возникали когда response-handler вызывал refresh дополнительно к WebSocket.

## Верификация состояния

Тройной клик на зелёный индикатор WebSocket → WebSocket Diagnostics:
- Connected: true, WS State: OPEN, Leader: true, MultiTab Initialized: true
