# P2P Synchronization Architecture

Peer-to-peer sync between devices without internet using WebRTC RTCDataChannel + QR signaling.

## Overview

| Property | Value |
|----------|-------|
| Protocol | WebRTC RTCDataChannel (DTLS encrypted) |
| Signaling | QR-code encoded SDP + ICE candidates |
| iOS priority | ✅ iOS 15+ Safari |
| Android | ✅ Android Chrome 80+ |
| Internet required | ❌ No |
| Server relay required | ❌ No (pure P2P) |

## Data Flow

```
Device A (Initiator)              Device B (Responder)
─────────────────────             ──────────────────────
1. P2PManager.createOffer()
2. iOS ICE unblock (getUserMedia)
3. Wait 3s for ICE candidates
4. P2PSignaling.buildPayload(sdp, candidates)
5. QrCreator.render(payload)
   [QR code displayed]
                                  6. Camera scan QR → qrData
                                  7. P2PSignaling.processScannedOffer(qrData)
                                  8. P2PManager.createAnswer(offerSdp)
                                  9. iOS ICE unblock (getUserMedia)
                                 10. Wait 3s for ICE candidates
                                 11. P2PSignaling.buildPayload(answerSdp, candidates)
                                 12. QrCreator.render(answerPayload)
                                     [Answer QR displayed]
13. Scan answer QR
14. P2PSignaling.processScannedAnswer(qrData)
15. RTCPeerConnection state: connected
    ─── RTCDataChannel OPEN ────────────────────────────
16. P2PSyncProtocol.initiateSync(pendingFacts)
    → FACTS_START message
    → fact messages (chunked if >10KB)
    → FACTS_END message
                                 17. setupReceiver() collects facts
                                 18. P2PSyncProtocol.initiateSync(ownPendingFacts)
                                     (bidirectional exchange)
19. P2PMerge.mergeFacts(local, received)
    → dedup by content hash
    → LWW conflict resolution
    → toAdd = new facts
20. DataLayer.applyP2PSyncResult(toAdd)
    → DexieManager.bulkPut (sync_status=pending)
    → Regular server sync loop picks them up
```

## File Structure

```
frontend/web/static/js/offline/p2p/
├── P2PManager.js        # WebRTC lifecycle + iOS ICE workaround
├── P2PSignaling.js      # QR + SDP exchange (no server needed)
├── P2PSyncProtocol.js   # Message format, chunking, sync orchestration
├── P2PMerge.js          # LWW conflict resolver + content hash dedup
├── P2PMerge.test.js     # Unit tests: merge, LWW, dedup
└── P2PSyncProtocol.test.js  # Unit tests: chunking, serialization

frontend/web/static/js/ui/
└── P2PUIController.js   # UI state machine: modal, QR display, scanner

frontend/web/templates/p2p/
├── p2p-initiator.html   # QR display screen with manual copy fallback
├── p2p-scanner.html     # Camera scanner + answer QR + paste fallback
└── p2p-status.html      # Sync progress overlay

frontend/web/static/css/
└── p2p.css              # QR container, scanner overlay, modal styles

backend/app/api/v1/endpoints/
└── p2p.py               # GET /api/v1/p2p/config (STUN servers, feature flags)

docs/architecture/
└── p2p-sync.md          # This file

tests/
├── manual/p2p-ios-safari.test.js      # Manual iOS Safari test checklist
└── integration/p2p-datalayer-integration.test.js  # Integration tests
```

## iOS Workarounds

### R1: Host ICE Candidates Blocked on iOS Safari

**Problem:** iOS Safari does not gather host (local network) ICE candidates until
a `getUserMedia()` stream is acquired. Without host candidates, WebRTC connection
fails on local networks (no STUN/TURN relay available without internet).

**Solution:** In `P2PManager.getUnblockMediaStream()`:
```javascript
// Called before createOffer() and createAnswer()
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
stream.getTracks().forEach(track => track.stop()); // Stop immediately
```

**Failure mode:** If user denies microphone permission, the workaround is skipped
gracefully. Connection may still work via STUN-discovered candidates (server-reflexive),
but local network P2P is less reliable. Manual SDP paste is the fallback.

**File:** `frontend/web/static/js/offline/p2p/P2PManager.js:getUnblockMediaStream()`

---

### R2: iOS PWA Standalone Mode Permission Issues

**Problem:** When app is installed via "Add to Home Screen" and opened in standalone
PWA mode, iOS may deny camera/microphone permissions even if granted in Safari.
This breaks both the getUserMedia ICE workaround (R1) and QR scanning (R5).

**Solution (primary):** Show UI guidance:
> "На iOS PWA используйте Safari браузер, а не «добавленное на экран» приложение"

**Solution (fallback):** Manual SDP text copy-paste:
1. Initiator copies base64-encoded payload text
2. Responder pastes into "Вставить код вручную" field
3. Connection established without any camera/mic usage

**Detection:** `window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true`

**File:** `frontend/web/static/js/ui/P2PUIController.js:_showIosPwaWarning()`

---

### R5: QR Scanning Camera Permission

**Problem:** QR scanning requires `getUserMedia({video: true})` which may be denied.

**Solution:** Manual SDP text paste (same as R2 fallback). The paste input is always
visible in the scanner screen; the camera view is a progressive enhancement.

**File:** `frontend/web/static/js/ui/P2PUIController.js:_startCamera()`

---

## Conflict Resolution

Budget facts are **append-only** — conflicts are rare but handled:

| Case | Detection | Resolution |
|------|-----------|------------|
| Exact duplicate | Same `content_hash` | Skip remote fact |
| Same fact, different version | Same `temp_id`, different `content_hash` | LWW: keep `updated_at` newer |
| New fact from peer | Different `temp_id` | Add to local DB |

**Content hash:** SHA-256 prefix 32 chars of `article_id|amount|date|comment|record_type`

**LWW:** `new Date(fact1.updated_at) >= new Date(fact2.updated_at) ? fact1 : fact2`

## Message Protocol

RTCDataChannel carries JSON messages. Large payloads are chunked (10KB per chunk):

```
FACTS_START  → { type, version, total_facts, transfer_id }
fact         → { type: "fact", index: N, fact: {...} }      ← per fact
fact_chunk   → { type: "fact_chunk", id, seq, total, data } ← chunked large fact
FACTS_END    → { type, transfer_id, checksum }
```

Both devices exchange simultaneously (bidirectional). Sequence:
1. A sends FACTS_START → facts → FACTS_END
2. B sends FACTS_START → facts → FACTS_END (simultaneously)
3. Each device collects and merges what it received

## QR Payload Format

```
P2P1:<base64(UTF-8(JSON({ sdp: "...", candidates: [{candidate, sdpMid, sdpMLineIndex}] })))>
```

- Prefix `P2P1:` for version detection
- SDP lines stripped: `a=extmap`, `a=msid-semantic`, `a=ssrc`, `a=rtcp-fb`
- Typical payload: 800-1200 chars (fits in QR version 10, ~400x400px at 200dpi)

## Troubleshooting

### No ICE candidates gathered (iOS)

**Symptom:** QR appears but connection never establishes, DevTools shows 0 ICE candidates.

**Fix:** Open in Safari browser (not PWA). Check console for
`[P2PManager] iOS ICE unblock: getUserMedia denied` — user needs to allow microphone.

---

### Camera not working on iOS

**Symptom:** "Камера недоступна" shown immediately.

**Fix 1:** Safari Settings → Privacy → Camera → Allow for fb.ikeniborn.ru
**Fix 2:** Use manual paste fallback (always available)

---

### Connection established but sync times out

**Symptom:** Status shows "Устанавливаем соединение..." → timeout after 60s.

**Likely cause:** Both devices are initiators, or QR scan failed silently.

**Fix:** One device presses "Create QR", other presses "Scan QR". If QR scan
unreliable, use manual paste mode.

---

### WebRTC blocked by corporate/school network

**Symptom:** ICE candidates gathered (host) but connection fails (no STUN).

**Fix:** P2P sync uses local network only (host ICE candidates). If both devices
are on the same WiFi, STUN is not needed. Check that both are on same LAN.
