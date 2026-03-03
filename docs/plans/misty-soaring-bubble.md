# P2P Signaling: Multi-Platform Exchange Plan

## Context

QR-сканирование ненадёжно на iOS (EXIF-баг, отсутствие BarcodeDetector). Исследование выявило:
- **Web Bluetooth** — заблокирован Apple (Will Not Implement навсегда)
- **Web NFC** — Android Chrome 89+ only, iOS заблокирован
- **Web Share Target** — Android only, iOS не поддерживает
- **Proximity/Nearby API** — не существует в браузере
- **URL + AirDrop** — iOS-to-iOS и Android-to-Android через Web Share API
- **Relay с кодом** — единственное кроссплатформенное решение (iOS ↔ Android)

Цель: три параллельных канала передачи SDP, каждый оптимален для своей платформы.

---

## Стратегия по платформам

| Канал | iOS→iOS | Android→Android | iOS→Android |
|---|:---:|:---:|:---:|
| QR-сканирование (текущий) | ✅ (EXIF исправлен) | ✅ (BarcodeDetector) | ❌ |
| **URL через AirDrop/Share** | ✅ новый | ✅ новый | ❌ AirDrop только iOS |
| **Relay 6-значный код** | ✅ новый | ✅ новый | ✅ новый |
| Web NFC | ❌ | (опционально v2) | ❌ |

---

## Канал A: URL-based (iOS↔iOS, Android↔Android)

**Принцип:** SDP кодируется в URL-хэш `/#p2p_offer=<payload>`, передаётся через
нативный share sheet (AirDrop на iOS, Share на Android). Принимающее устройство
открывает ссылку в браузере, JS определяет параметр и авто-подставляет код.

**Не требует изменений бэкенда.**

### Изменения frontend

**`P2PUIController.js`:**

1. Изменить `shareOfferText()`:
```js
async shareOfferText() {
  const url = `${location.origin}/#p2p_offer=${encodeURIComponent(this._offerPayload)}`;
  await this._sharePayload(url, 'P2P Синхронизация', true);
}
```

2. Изменить `shareAnswerText()` аналогично с `#p2p_answer=`.

3. Добавить `_checkURLHash()` — вызывается при инициализации модуля:
```js
_checkURLHash() {
  const hash = location.hash;
  const offerMatch = hash.match(/#p2p_offer=(.+)/);
  const answerMatch = hash.match(/#p2p_answer=(.+)/);
  if (offerMatch || answerMatch) {
    // Сохранить в sessionStorage, показать ненавязчивый баннер
    const payload = decodeURIComponent((offerMatch || answerMatch)[1]);
    sessionStorage.setItem('p2p_pending_payload', payload);
    sessionStorage.setItem('p2p_pending_type', offerMatch ? 'offer' : 'answer');
    history.replaceState(null, '', location.pathname); // убрать hash из URL
    this._showIncomingBanner();
  }
}
```

4. Добавить `_showIncomingBanner()` — показывает toast/баннер "Получен P2P-запрос" с кнопкой "Открыть". При нажатии — открывает модаль в нужном режиме с предзаполненным полем paste.

5. В `open()` / `startResponder()` / `startInitiator()` — проверять `sessionStorage` на наличие pending payload.

---

## Канал B: Relay с 6-значным кодом (кроссплатформенный)

**Принцип:**
```
Device A → POST /api/v1/p2p/relay  → { code: "XK7P2Q" }  (TTL 120s в Redis)
Device B → вводит код XK7P2Q → GET /api/v1/p2p/relay/XK7P2Q  ← offer SDP
Device B → обрабатывает → POST /api/v1/p2p/relay/XK7P2Q/answer
Device A → polling 2s → GET /api/v1/p2p/relay/XK7P2Q/answer  ← answer SDP
── прямой WebRTC P2P DataChannel ──
```

### Backend: `backend/app/api/v1/endpoints/p2p.py`

Расширить существующий файл (сейчас 48 строк, только `/config`).

**4 новых эндпоинта** (без аутентификации — коды эфемерны, неизвестны):

```python
POST   /api/v1/p2p/relay
       body: { offer_sdp: str, candidates: list }
       → { code: "XK7P2Q" }
       Redis: SET p2p:relay:{code}:offer {json} EX 120

GET    /api/v1/p2p/relay/{code}
       → { offer_sdp: str, candidates: list } | 404

POST   /api/v1/p2p/relay/{code}/answer
       body: { answer_sdp: str, candidates: list }
       → 200
       Redis: SET p2p:relay:{code}:answer {json} EX 120

GET    /api/v1/p2p/relay/{code}/answer
       → { answer_sdp: str, candidates: list } | 202 (ещё нет)
```

**Redis паттерн** (из `cache_service.py`):
```python
async with get_redis() as redis:
    await redis.set(key, json_dumps(data), ex=120)
```

**Генерация кода:**
```python
import secrets, string
def _generate_relay_code() -> str:
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
```

**Валидация:** Pydantic-схемы `RelayOfferRequest`, `RelayAnswerRequest`.

**Rate limiting:** максимум 10 активных relay на IP (опционально, можно v2).

**Файл:** `backend/app/api/v1/endpoints/p2p.py` — только расширить, не создавать новый.
**Подключение:** уже есть в `backend/app/api/v1/router.py` (p2p_router включён).

### Frontend: `P2PUIController.js`

**Новые поля конструктора:**
```js
this._relayCode = null;
this._relayPollTimer = null;
```

**Новые методы:**

`startRelayInitiator()`:
- Вызывает `_initManager()`, создаёт offer
- POST `/api/v1/p2p/relay` → получает code
- Рендерит экран `relay-code` с большим кодом
- Запускает `_startRelayPoll(code)` для ожидания answer

`startRelayResponder()`:
- Рендерит экран `relay-enter` (поле ввода кода)

`submitRelayCode()`:
- Читает введённый код
- GET `/api/v1/p2p/relay/{code}` → получает offer
- Обрабатывает offer, создаёт answer
- POST `/api/v1/p2p/relay/{code}/answer`
- `_waitForConnection()`

`_startRelayPoll(code)`:
```js
const RELAY_POLL_INTERVAL_MS = 2000;
this._relayPollTimer = setInterval(async () => {
  const res = await fetch(`/api/v1/p2p/relay/${code}/answer`);
  if (res.status === 200) {
    this._stopRelayPoll();
    const data = await res.json();
    await this.signaling.processScannedAnswer(/* ... */);
    this._waitForConnection();
  }
}, RELAY_POLL_INTERVAL_MS);
```

`_stopRelayPoll()` — clearInterval.

В `cancel()` добавить `this._stopRelayPoll()`.

**Новые экраны в `_renderScreen()`:**

`relay-code` — показывает:
- Большой код (крупный шрифт, легко прочитать/продиктовать)
- Таймер обратного отсчёта 120s
- Статус "Ожидание подключения..."

`relay-enter` — показывает:
- Поле ввода 6 символов (автоупперкейс)
- Кнопка "Подключиться"

**Обновить `_renderRoleSelect()`** — добавить в блок кнопок:
```
[Создать QR]           ← существующий startInitiator()
[Получить код]         ← новый startRelayInitiator()
[Сканировать QR]       ← существующий startResponder()
[Ввести код]           ← новый startRelayResponder()
```

---

## Файлы для изменения

| Файл | Изменение |
|---|---|
| `backend/app/api/v1/endpoints/p2p.py` | +4 relay эндпоинта, +Pydantic схемы |
| `frontend/web/static/js/ui/P2PUIController.js` | +relay flow, +URL hash detection, +share URL |

### Не требуют изменений
- `P2PManager.js` — WebRTC остаётся как есть
- `P2PSignaling.js` — buildPayload/parsePayload используются как есть
- `P2PSyncProtocol.js` — не меняется
- `manifest.json` — share_target на iOS не работает, не добавляем
- `router.py` — p2p_router уже подключён

---

## Порядок реализации

1. **Backend relay** (p2p.py: +60 строк) — можно задеплоить независимо
2. **Frontend relay flow** (P2PUIController.js: +80 строк) — новые экраны и методы
3. **URL hash sharing** (P2PUIController.js: +30 строк) — улучшение shareOfferText/shareAnswerText
4. **Incoming banner** (P2PUIController.js: +20 строк) — отображение входящего P2P

---

## Верификация

1. **Relay код**: Device A → "Получить код" → код отображается → Device B → "Ввести код" → вводит → подключение
2. **URL share iOS→iOS**: Device A → "Поделиться" → AirDrop → Device B открывает ссылку → баннер "Входящий P2P" → tap → подключение
3. **QR (существующий)**: фотографирует QR → jsQR с EXIF корректирует → подключение
4. **Тест polling**: `GET /api/v1/p2p/relay/{code}/answer` до и после POST answer → 202 / 200
5. **TTL**: через 120с код становится невалидным → 404

---

## Web NFC (опционально v2, Android-to-Android)

Если `'NDEFReader' in window` (Chrome Android 89+):
- В экране `relay-code`: кнопка "Записать на NFC" — пишет код в NDEF запись
- В экране `relay-enter`: кнопка "Прочитать NFC" — читает код и подставляет
- Не влияет на iOS, не ломает существующий flow
- Реализуется после основного relay flow

---

## Итоговые сценарии

| Сценарий | Канал | Backend | Frontend |
|---|---|---|---|
| iPhone → iPhone (рядом) | URL + AirDrop | — | shareOfferText() → URL |
| iPhone → iPhone (не рядом) | Relay код | ✅ | startRelayInitiator() |
| Android → Android | QR или Relay код | ✅ (новый) | оба пути |
| iPhone → Android | Relay код | ✅ | startRelayInitiator() |
