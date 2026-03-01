/**
 * Manual test checklist for P2P sync on iOS Safari.
 *
 * PURPOSE: Validate iOS-specific workarounds (R1, R2, R5).
 * DEVICE: iPhone or iPad with iOS 15+.
 * BROWSER: Safari (NOT added to Home Screen / PWA standalone).
 *
 * Run manually: Open this file and follow the checklist in the comments.
 * Log results below in the RESULTS section.
 */

const TEST_PLAN = {
  environment: {
    device: 'iPhone / iPad (iOS 15+)',
    browser: 'Safari browser (not PWA standalone)',
    url: 'https://fb.ikeniborn.ru',
  },

  tests: [
    {
      id: 'IOS-01',
      name: 'P2P button visible in navbar',
      steps: [
        '1. Open https://fb.ikeniborn.ru in Safari',
        '2. Log in',
        '3. Check navbar for wifi/P2P icon button',
      ],
      expectedResult: 'P2P button visible (WebRTC + HTTPS detected)',
      workaround: 'None',
    },
    {
      id: 'IOS-02',
      name: 'iOS ICE workaround (R1): getUserMedia unblocks host ICE candidates',
      steps: [
        '1. Open Safari DevTools (Connect to Mac via USB, Safari → Develop → iPhone)',
        '2. Click P2P button → "Create QR"',
        '3. Watch console for "[P2PManager] iOS ICE unblock: getUserMedia succeeded"',
        '4. Watch console for "[P2PManager] ICE candidate gathered: host"',
        '5. Verify QR code appears within 5 seconds',
      ],
      expectedResult: 'getUserMedia success logged, host ICE candidates gathered, QR displayed',
      workaround: 'R1: getUserMedia({audio:true}) before createOffer()',
    },
    {
      id: 'IOS-03',
      name: 'QR code is scannable from another device',
      steps: [
        '1. On iOS: Click P2P → "Create QR"',
        '2. On Android (Chrome): Click P2P → "Scan QR"',
        '3. Point Android camera at iOS QR code',
        '4. Watch for connection establishment on both devices',
      ],
      expectedResult: 'QR scanned, WebRTC connection established, sync completes',
      workaround: 'None',
    },
    {
      id: 'IOS-04',
      name: 'iOS PWA standalone mode warning (R2)',
      steps: [
        '1. Add app to Home Screen (Share → Add to Home Screen)',
        '2. Open from Home Screen (standalone mode)',
        '3. Click P2P button',
        '4. Verify warning shown: "На iOS PWA используйте Safari браузер"',
      ],
      expectedResult: 'Warning banner displayed in standalone mode',
      workaround: 'R2: UI guidance to use Safari browser',
    },
    {
      id: 'IOS-05',
      name: 'Manual SDP fallback (R2): camera permission denied',
      steps: [
        '1. In Safari Settings → deny camera for fb.ikeniborn.ru',
        '2. Click P2P → "Scan QR"',
        '3. Verify "Камера недоступна" shown',
        '4. Verify "Вставить код вручную" section is auto-opened',
        '5. From initiator device, copy SDP text',
        '6. Paste in "Вставить код" field, click "Подключиться"',
      ],
      expectedResult: 'Manual paste fallback works, connection established without camera',
      workaround: 'R5: manual SDP paste fallback',
    },
    {
      id: 'IOS-06',
      name: 'Full bidirectional sync: iOS ↔ Android',
      steps: [
        '1. On iOS: add 3 facts while offline (sync_status=pending in DevTools → IndexedDB)',
        '2. On Android: add 2 different facts while offline',
        '3. Bring devices together (no internet needed)',
        '4. iOS: Click P2P → "Create QR"',
        '5. Android: Click P2P → "Scan QR" → scan iOS QR',
        '6. Android shows answer QR',
        '7. iOS: Click "Сканировать ответ →" → scan Android answer QR',
        '8. Wait for sync completion overlay',
      ],
      expectedResult: 'iOS gets 2 Android facts + Android gets 3 iOS facts. Status overlay shows correct counts.',
      workaround: 'None (nominal flow)',
    },
    {
      id: 'IOS-07',
      name: 'Deduplication: same fact not duplicated',
      steps: [
        '1. On iOS: add 1 fact online (sync_status=synced)',
        '2. On Android: same fact (synced from server)',
        '3. Run P2P sync between devices',
        '4. Verify fact count does NOT increase',
      ],
      expectedResult: 'Status overlay shows "Дубликатов: 1", no new facts added',
      workaround: 'None (P2PMerge content hash dedup)',
    },
  ],
};

// ── RESULTS (fill in after testing) ─────────────────────

const RESULTS = {
  'IOS-01': { status: 'TODO', notes: '' },
  'IOS-02': { status: 'TODO', notes: '' },
  'IOS-03': { status: 'TODO', notes: '' },
  'IOS-04': { status: 'TODO', notes: '' },
  'IOS-05': { status: 'TODO', notes: '' },
  'IOS-06': { status: 'TODO', notes: '' },
  'IOS-07': { status: 'TODO', notes: '' },
};

export { TEST_PLAN, RESULTS };
