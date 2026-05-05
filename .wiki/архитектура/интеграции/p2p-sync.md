---
wiki_sources: ["docs/architecture/p2p-sync.md"]
wiki_updated: 2026-05-05
wiki_status: stub
tags: ["offline-first", "PWA", "Service-Worker"]
aliases: ["P2P Sync", "WebRTC Sync", "QR Sync"]
---

# P2P Синхронизация

Peer-to-peer синхронизация данных между устройствами без интернета. Использует WebRTC RTCDataChannel с QR-кодом в качестве signaling-механизма (без промежуточного сервера).

## Основные характеристики

| Свойство | Значение |
|----------|----------|
| Протокол | WebRTC RTCDataChannel (DTLS encrypted) |
| Signaling | QR-код с SDP + ICE candidates |
| iOS | iOS 15+ Safari |
| Android | Chrome 80+ |
| Интернет | ❌ Не требуется |
| Relay-сервер | ❌ Не требуется |

### Процесс синхронизации

1. Устройство A создаёт offer, QR с SDP
2. Устройство B сканирует QR → создаёт answer, QR с answer SDP
3. Устройство A сканирует answer → RTCDataChannel OPEN
4. Двунаправленный обмен pending facts через протокол FACTS_START / facts / FACTS_END
5. Слияние через `P2PMerge.mergeFacts()`: дедупликация по content hash, LWW conflict resolution
6. Результат → DexieManager.bulkPut (sync_status=pending) → server sync loop

### Файлы

```
frontend/web/static/js/offline/p2p/
├── P2PManager.js     — WebRTC lifecycle + iOS ICE workaround
├── P2PSignaling.js   — QR + SDP exchange
├── P2PSyncProtocol.js — Протокол обмена данными
└── P2PMerge.js       — Слияние и conflict resolution
```

## Связанные концепции

- [[offline-first]]
- [[websocket-realtime]]
