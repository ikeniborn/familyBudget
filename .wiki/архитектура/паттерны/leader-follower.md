---
wiki_sources: ["docs/architecture/core/websocket.md"]
wiki_updated: 2026-05-05
wiki_status: stub
tags: ["WebSocket"]
aliases: ["Leader-Follower Pattern", "Multi-Tab Coordination"]
---

# Leader-Follower (Multi-Tab)

Паттерн координации WebSocket-соединений между несколькими вкладками браузера. Только одна вкладка создаёт WebSocket (Leader), остальные получают события через BroadcastChannel.

## Основные характеристики

- **Leader**: первая открытая вкладка, создаёт WebSocket-соединение
- **Followers**: остальные вкладки, слушают BroadcastChannel
- Leader транслирует heartbeat каждые 3 секунды
- Fallback: Long Polling, если WebSocket недоступен

### iOS-специфика

На iOS Web Locks API ненадёжен, поэтому принудительно `isLeader = true` для каждой вкладки — каждая создаёт собственное WebSocket-соединение. Ping-интервал на iOS: 8 с (против 15 с на других платформах).

## Связанные концепции

- [[websocket-realtime]]
