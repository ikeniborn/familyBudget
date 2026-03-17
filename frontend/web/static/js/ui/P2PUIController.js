/**
 * P2PUIController - Manages P2P sync UI state machine.
 *
 * States: idle → relay-initiator | relay-responder → syncing → done | error
 *
 * Channels:
 * - Relay code: 6-digit code via server relay (cross-platform iOS↔Android)
 *
 * @version 1.2.0
 */

import { P2PManager } from '/static/js/offline/p2p/P2PManager.js?v=PLACEHOLDER';
import { P2PSyncProtocol } from '/static/js/offline/p2p/P2PSyncProtocol.js?v=PLACEHOLDER';
import { P2PMerge } from '/static/js/offline/p2p/P2PMerge.js?v=PLACEHOLDER';

// ── SDP payload encoding helpers (relay transport) ───────────────────────────

const RELAY_PAYLOAD_PREFIX = 'P2P1:';

/**
 * Encode UTF-8 string to base64 (Unicode-safe).
 * @param {string} str
 * @returns {string}
 */
function _toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binStr = '';
  for (let i = 0; i < bytes.length; i++) {
    binStr += String.fromCharCode(bytes[i]);
  }
  return btoa(binStr);
}

/**
 * Decode base64 to UTF-8 string (Unicode-safe).
 * @param {string} b64
 * @returns {string}
 */
function _fromBase64(b64) {
  try {
    const binStr = atob(b64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return atob(b64);
  }
}

/**
 * Build encoded relay payload from SDP + ICE candidates.
 * Format: P2P1:<base64(JSON({sdp, candidates}))>
 * @param {string} sdp
 * @param {RTCIceCandidate[]} candidates
 * @returns {string}
 */
function _buildRelayPayload(sdp, candidates) {
  const payload = JSON.stringify({
    sdp,
    candidates: candidates.map(c => ({
      candidate: c.candidate,
      sdpMid: c.sdpMid,
      sdpMLineIndex: c.sdpMLineIndex,
    })),
  });
  return RELAY_PAYLOAD_PREFIX + _toBase64(payload);
}

/**
 * Parse encoded relay payload back to { sdp, candidates }.
 * @param {string} encoded
 * @returns {{ sdp: string, candidates: Array }}
 */
function _parseRelayPayload(encoded) {
  if (!encoded.startsWith(RELAY_PAYLOAD_PREFIX)) {
    throw new Error('Invalid relay payload: missing version prefix');
  }
  const raw = _fromBase64(encoded.slice(RELAY_PAYLOAD_PREFIX.length));
  try {
    const parsed = JSON.parse(raw);
    return { sdp: parsed.sdp || raw, candidates: parsed.candidates || [] };
  } catch {
    return { sdp: raw, candidates: [] };
  }
}

const OFFER_TIMEOUT_SEC = 120;
const RELAY_POLL_INTERVAL_MS = 2000;

// Module-level flag: iOS mic warning acknowledged at most once per page load.
// Avoids repeated warning when user opens multiple sync sessions.
let _iosMicAcknowledged = false;

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

class P2PUIController {
  constructor() {
    this.manager = null;
    this.protocol = null;
    this.merge = new P2PMerge();

    this._offerTimer = null;
    this._offerPayload = null;
    this._modal = null;

    // Relay channel state
    this._relayCode = null;
    this._relayPollTimer = null;

    // Expose globally for inline onclick handlers in templates
    window.p2pUI = this;
  }

  /**
   * Open the P2P sync modal with role selection.
   * Loads pending facts count to show actual sync status.
   */
  async open() {
    if (!this._checkWebRTCSupport()) return;
    this._showModal();
    this._renderRoleSelect(null); // render immediately with loading state

    // Load actual pending count async
    try {
      const dataLayer = window.dataLayer || window.DataLayer?.getInstance?.();
      let pendingCount = 0;
      if (dataLayer && typeof dataLayer.getPendingFactsForP2P === 'function') {
        const pending = await dataLayer.getPendingFactsForP2P();
        pendingCount = pending.length;
      }
      this._renderRoleSelect(pendingCount);
    } catch {
      this._renderRoleSelect(0);
    }
  }

  // ── Relay channel (6-digit code, cross-platform) ─────

  /**
   * Start as relay initiator: create offer, POST to relay, show code.
   * On iOS: shows mic permission explanation first (iOS WebRTC R1 workaround).
   */
  async startRelayInitiator() {
    if (isIOS() && !_iosMicAcknowledged) {
      this._renderIosMicWarning('initiator');
      return;
    }
    await this._proceedRelayInitiator();
  }

  /** @private */
  async _proceedRelayInitiator() {
    this._renderScreen('relay-code');
    this._initManager();

    try {
      // Build offer payload using direct P2PManager calls (no QR dependency)
      const offerSdp = await this.manager.createOffer();
      const candidates = await this.manager.gatherICECandidates();
      this._offerPayload = _buildRelayPayload(offerSdp, candidates);

      const res = await fetch('/api/v1/p2p/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: this._offerPayload }),
      });
      if (!res.ok) throw new Error('Сервер недоступен (' + res.status + ')');
      const { code } = await res.json();
      this._relayCode = code;

      const codeEl = document.getElementById('p2p-relay-code-display');
      if (codeEl) codeEl.textContent = code;

      this._startRelayCountdown();
      this._startRelayPoll(code);
      console.debug('[P2PUIController] Relay offer created, code=', code);
    } catch (err) {
      console.error('[P2PUIController] startRelayInitiator error:', err);
      this._showError('Не удалось создать код: ' + err.message);
    }
  }

  /**
   * Start as relay responder: show code entry screen.
   * On iOS: shows mic permission explanation first (iOS WebRTC R1 workaround).
   */
  startRelayResponder() {
    if (isIOS() && !_iosMicAcknowledged) {
      this._renderIosMicWarning('responder');
      return;
    }
    this._renderScreen('relay-enter');
    this._initManager();
  }

  /**
   * Called when user confirms iOS mic permission request.
   * Marks warning as acknowledged and proceeds with the selected role.
   * @param {'initiator'|'responder'} role
   */
  async confirmIosMic(role) {
    _iosMicAcknowledged = true;
    if (role === 'initiator') {
      await this._proceedRelayInitiator();
    } else {
      this._renderScreen('relay-enter');
      this._initManager();
    }
  }

  /**
   * Submit entered relay code: fetch offer, build answer, POST answer.
   */
  async submitRelayCode() {
    const input = document.getElementById('p2p-relay-input');
    const code = input ? input.value.trim().toUpperCase() : '';
    if (code.length !== 6) {
      this._showToast('Код должен содержать 6 символов');
      return;
    }

    try {
      const offerRes = await fetch(`/api/v1/p2p/relay/${code}`);
      if (offerRes.status === 404) {
        this._showToast('Код не найден или истёк срок');
        return;
      }
      if (!offerRes.ok) throw new Error('Ошибка сервера (' + offerRes.status + ')');

      const offerData = await offerRes.json();
      const { sdp: offerSdp, candidates: offerCandidates } = _parseRelayPayload(offerData.payload);
      const answerSdp = await this.manager.createAnswer(offerSdp);
      if (offerCandidates.length > 0) {
        await this.manager.addICECandidates(offerCandidates);
      }
      const localCandidates = await this.manager.gatherICECandidates();
      const answerPayload = _buildRelayPayload(answerSdp, localCandidates);

      const answerRes = await fetch(`/api/v1/p2p/relay/${code}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: answerPayload }),
      });
      if (!answerRes.ok) throw new Error('Не удалось отправить ответ (' + answerRes.status + ')');

      console.debug('[P2PUIController] Relay answer sent for code=', code);
      this._waitForConnection();
    } catch (err) {
      console.error('[P2PUIController] submitRelayCode error:', err);
      this._showError('Ошибка: ' + err.message);
    }
  }

  /**
   * Poll for answer SDP at 2s interval.
   * @param {string} code
   */
  _startRelayPoll(code) {
    this._relayPollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/p2p/relay/${code}/answer`);
        if (res.status === 200) {
          this._stopRelayPoll();
          const data = await res.json();
          const { sdp: answerSdp, candidates: answerCandidates } = _parseRelayPayload(data.payload);
          await this.manager.setAnswer(answerSdp);
          if (answerCandidates.length > 0) {
            await this.manager.addICECandidates(answerCandidates);
          }
          this._waitForConnection();
        } else if (res.status === 404) {
          // Code expired
          this._stopRelayPoll();
          this._showError('Код истёк. Создайте новый.');
        }
        // 202 = still waiting, keep polling
      } catch (err) {
        console.warn('[P2PUIController] relay poll error:', err);
      }
    }, RELAY_POLL_INTERVAL_MS);
  }

  _stopRelayPoll() {
    if (this._relayPollTimer) {
      clearInterval(this._relayPollTimer);
      this._relayPollTimer = null;
    }
  }

  /**
   * Start 120s countdown on relay-code screen.
   */
  _startRelayCountdown() {
    let remaining = OFFER_TIMEOUT_SEC;
    const timerEl = document.getElementById('p2p-relay-timer');
    const progressEl = document.getElementById('p2p-relay-progress');

    const tick = setInterval(() => {
      remaining--;
      if (timerEl) timerEl.textContent = remaining + 's';
      if (progressEl) progressEl.value = Math.round((remaining / OFFER_TIMEOUT_SEC) * 100);
      if (remaining <= 0) {
        clearInterval(tick);
        this._stopRelayPoll();
        this._showError('Время истекло. Создайте новый код.');
      }
    }, 1000);
    // Keep reference so cancel() can clean up
    this._offerTimer = tick;
  }

  /**
   * Cancel sync and close modal.
   */
  cancel() {
    this._stopOfferTimer();
    this._stopRelayPoll();
    if (this.manager) {
      this.manager.onStateChange = null;
      this.manager.onError = null;
      this.manager.cleanup();
      this.manager = null;
    }
    // Hide status overlay if shown (e.g. cancelled during connecting phase)
    const overlay = document.getElementById('p2p-status-overlay');
    if (overlay) overlay.classList.add('hidden');
    this._closeModal();
    console.debug('[P2PUIController] Sync cancelled');
  }

  /**
   * Close status overlay after successful sync.
   */
  closeStatus() {
    document.getElementById('p2p-status-overlay')?.classList.add('hidden');
    this._closeModal();
  }

  // ── Private: initialization ──────────────────────────

  _initManager() {
    if (this.manager) this.manager.cleanup();
    this.manager = new P2PManager();
    this.protocol = new P2PSyncProtocol(this.manager);

    this.manager.onStateChange = (state) => {
      console.debug('[P2PUIController] Manager state:', state);
      if (state === 'connected') {
        this._onConnected();
      } else if (state === 'error') {
        this._showError('Соединение прервано');
      }
    };
  }

  // ── Private: WebRTC support check ───────────────────

  _checkWebRTCSupport() {
    if (!window.RTCPeerConnection) {
      this._showToast('P2P синхронизация не поддерживается в этом браузере');
      return false;
    }
    return true;
  }

  // ── Private: connection lifecycle ───────────────────

  _waitForConnection() {
    // Close modal so the status overlay (z-9500) is fully visible
    this._closeModal();
    // Manager's onStateChange will call _onConnected when connected
    this._showStatusOverlay('connecting');
  }

  async _onConnected() {
    // Immediately null callbacks to prevent RTCPeerConnection close events
    // (fired when peer closes connection after sync) from overwriting the
    // sync result with a false 'Соединение прервано' error mid-await.
    if (this.manager) {
      this.manager.onStateChange = null;
      this.manager.onError = null;
    }

    console.debug('[P2PUIController] P2P connected — starting sync');
    this._updateStatusOverlay('syncing');
    this._stopOfferTimer();

    try {
      // Get pending facts from DataLayer
      const dataLayer = window.dataLayer || window.DataLayer?.getInstance?.();
      let pendingFacts = [];
      if (dataLayer && typeof dataLayer.getPendingFactsForP2P === 'function') {
        pendingFacts = await dataLayer.getPendingFactsForP2P();
      } else {
        console.warn('[P2PUIController] DataLayer.getPendingFactsForP2P not available');
      }

      // Get all local facts for merge comparison
      let localFacts = [];
      if (dataLayer && typeof dataLayer.getAllFactsForP2PMerge === 'function') {
        localFacts = await dataLayer.getAllFactsForP2PMerge();
      }

      this._updateProgress(20, 'Отправляем данные...');

      // Sync via protocol
      const { sent, received } = await this.protocol.initiateSync(pendingFacts);

      this._updateProgress(70, 'Объединяем данные...');

      // Merge received facts
      const mergeResult = await this.merge.mergeFacts(localFacts, received);

      if (mergeResult.toAdd.length > 0 && dataLayer?.applyP2PSyncResult) {
        await dataLayer.applyP2PSyncResult(mergeResult.toAdd);
      }

      this._updateProgress(100, 'Готово');
      this._updateStatusStats(sent, received.length, mergeResult.toAdd.length, mergeResult.duplicates);
      this._updateStatusOverlay('success');

    } catch (err) {
      console.error('[P2PUIController] Sync error:', err);
      this._showError(err.message);
    } finally {
      if (this.manager) {
        // Null callbacks before cleanup to prevent false error state on RTCPeerConnection close events
        this.manager.onStateChange = null;
        this.manager.onError = null;
        this.manager.cleanup();
        this.manager = null;
      }
    }
  }

  // ── Private: offer timer ─────────────────────────────

  _stopOfferTimer() {
    if (this._offerTimer) {
      clearInterval(this._offerTimer);
      this._offerTimer = null;
    }
  }

  // ── Private: iOS mic warning ─────────────────────────

  /**
   * Render iOS microphone permission explanation screen.
   * iOS WebRTC requires getUserMedia({audio}) to gather host ICE candidates.
   * No audio is recorded — mic is immediately stopped after permission granted.
   * @param {'initiator'|'responder'} role - Role to continue after user confirms
   * @private
   */
  _renderIosMicWarning(role) {
    if (role !== 'initiator' && role !== 'responder') return;
    const content = document.getElementById('p2p-modal-content');
    if (!content) return;
    content.innerHTML = `
      <div class="flex flex-col items-center gap-5 p-6 text-center">
        <div class="p-3 rounded-full bg-warning/20">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z"/>
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-base">Нужен доступ к микрофону</h3>
          <p class="text-sm text-base-content/70 mt-2">
            iOS требует разрешения на микрофон для установки P2P соединения.<br>
            <span class="text-xs text-base-content/50 mt-1 block">Звук не записывается и не передаётся — доступ нужен только для технической инициализации соединения.</span>
          </p>
        </div>
        <button class="btn btn-primary w-full max-w-xs" onclick="window.p2pUI?.confirmIosMic('${role}')">
          Разрешить и продолжить
        </button>
        <button class="btn btn-ghost btn-sm" onclick="window.p2pUI?.cancel()">Отмена</button>
      </div>
    `;
  }

  // ── Private: modal ───────────────────────────────────

  _showModal() {
    if (this._modal) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'p2p-modal-wrapper';
    wrapper.innerHTML = '<div id="p2p-modal-content" class="p-4"></div>';
    document.body.appendChild(wrapper);
    this._modal = wrapper;

    // Close on backdrop click
    wrapper.addEventListener('click', (e) => {
      if (e.target === wrapper) this.cancel();
    });
  }

  _closeModal() {
    if (this._modal) {
      this._modal.remove();
      this._modal = null;
    }
  }

  /**
   * Render role selection screen.
   * @param {number|null} pendingCount - null = loading state
   */
  _renderRoleSelect(pendingCount) {
    const content = document.getElementById('p2p-modal-content');
    if (!content) return;

    const isLoading = pendingCount === null;
    const hasPending = !isLoading && pendingCount > 0;

    const statusBadge = isLoading
      ? `<span class="loading loading-dots loading-xs"></span>`
      : hasPending
        ? `<span class="badge badge-warning badge-sm">${pendingCount} ожидают</span>`
        : `<span class="badge badge-success badge-sm">Синхронизировано</span>`;

    const pendingLabel = isLoading
      ? `<span class="text-base-content/40 text-xs">Проверяем...</span>`
      : hasPending
        ? `<span class="text-warning text-xs font-medium">${pendingCount} ${pendingCount === 1 ? 'запись' : pendingCount < 5 ? 'записи' : 'записей'} не отправлено</span>`
        : `<span class="text-success text-xs">Все данные синхронизированы</span>`;

    content.innerHTML = `
      <div class="flex flex-col items-center gap-4 py-4 px-2">

        <div class="text-center">
          <h3 class="text-lg font-bold">P2P Синхронизация</h3>
          <p class="text-xs text-base-content/50 mt-0.5">Синхронизация через 6-значный код</p>
        </div>

        <!-- Current status card -->
        <div class="bg-base-200 rounded-xl px-4 py-3 w-full max-w-xs">
          <div class="flex items-center justify-between">
            <span class="text-sm text-base-content/60">Локальные данные</span>
            ${statusBadge}
          </div>
          <div class="mt-1">${pendingLabel}</div>
        </div>

        <!-- Action buttons -->
        <div class="flex flex-col gap-2 w-full max-w-xs">

          <div class="flex flex-col gap-2">
            <button class="btn btn-primary flex-row h-auto min-h-[3.5rem] py-2 gap-3 text-sm justify-start px-4" onclick="window.p2pUI?.startRelayInitiator()">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
              </svg>
              <div class="flex flex-col items-start">
                <span class="font-medium">Получить код</span>
                <span class="text-xs opacity-70">Создать сессию и показать код</span>
              </div>
            </button>

            <button class="btn btn-outline flex-row h-auto min-h-[3.5rem] py-2 gap-3 text-sm justify-start px-4" onclick="window.p2pUI?.startRelayResponder()">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              </svg>
              <div class="flex flex-col items-start">
                <span class="font-medium">Ввести код</span>
                <span class="text-xs opacity-70">Подключиться по коду с другого устройства</span>
              </div>
            </button>
          </div>

          <button class="btn btn-ghost btn-sm mt-1" onclick="window.p2pUI?.cancel()">Отмена</button>
        </div>

      </div>
    `;
  }

  _renderScreen(screenName) {
    const content = document.getElementById('p2p-modal-content');
    if (!content) return;

    if (screenName === 'relay-code') {
      content.innerHTML = [
        '<div class="flex flex-col items-center gap-5 p-4 pb-8 w-full">',
          '<div class="text-center">',
            '<p class="text-sm text-base-content/60 mb-1">Код для подключения</p>',
            '<div id="p2p-relay-code-display" class="text-5xl font-mono font-bold tracking-[0.3em] text-primary py-3 px-4 bg-base-200 rounded-2xl select-all">',
              '<span class="loading loading-dots loading-md"></span>',
            '</div>',
            '<p class="text-xs text-base-content/40 mt-2">Продиктуйте или покажите этот код другому устройству</p>',
          '</div>',
          '<div class="flex flex-col items-center gap-1 w-full max-w-xs">',
            '<div class="flex items-center gap-2 text-sm text-base-content/50">',
              '<span class="loading loading-ring loading-xs"></span>',
              '<span>Ожидание подключения...</span>',
            '</div>',
            '<div class="flex items-center gap-2 w-full mt-1">',
              '<progress id="p2p-relay-progress" class="progress progress-primary flex-1" value="100" max="100"></progress>',
              '<span id="p2p-relay-timer" class="text-xs font-mono text-base-content/40 w-10 text-right">120s</span>',
            '</div>',
          '</div>',
          '<button class="btn btn-ghost btn-sm" onclick="window.p2pUI?.cancel()">Отмена</button>',
        '</div>',
      ].join('');
    } else if (screenName === 'relay-enter') {
      content.innerHTML = [
        '<div class="flex flex-col items-center gap-5 p-4 pb-8 w-full">',
          '<div class="text-center">',
            '<h3 class="font-semibold text-base">Ввести код</h3>',
            '<p class="text-xs text-base-content/50 mt-1">Введите 6-значный код с другого устройства</p>',
          '</div>',
          '<input id="p2p-relay-input" type="text" maxlength="6" autocomplete="off" autocapitalize="characters"',
            ' spellcheck="false" inputmode="text"',
            ' class="input input-bordered input-lg text-center font-mono tracking-[0.4em] uppercase w-full max-w-xs text-2xl"',
            ' placeholder="XXXXXX"',
            ' oninput="this.value=this.value.toUpperCase()">',
          '<button class="btn btn-primary w-full max-w-xs" onclick="window.p2pUI?.submitRelayCode()">',
            'Подключиться',
          '</button>',
          '<button class="btn btn-ghost btn-sm" onclick="window.p2pUI?.cancel()">Отмена</button>',
        '</div>',
      ].join('');

      // Auto-focus the input
      setTimeout(() => document.getElementById('p2p-relay-input')?.focus(), 50);
    }
  }

  // ── Private: status overlay ──────────────────────────

  _showStatusOverlay(phase) {
    const overlay = document.getElementById('p2p-status-overlay');
    if (overlay) overlay.classList.remove('hidden');
    this._updateStatusOverlay(phase);
  }

  _updateStatusOverlay(phase) {
    const phases = ['connecting', 'syncing', 'success', 'error'];
    phases.forEach(p => {
      const el = document.getElementById('p2p-status-' + p);
      if (el) el.classList.toggle('hidden', p !== phase);
    });
    const cancelBtn = document.getElementById('p2p-status-cancel-btn');
    const closeBtn = document.getElementById('p2p-status-close-btn');
    if (phase === 'success' || phase === 'error') {
      cancelBtn?.classList.add('hidden');
      closeBtn?.classList.remove('hidden');
    } else {
      cancelBtn?.classList.remove('hidden');
      closeBtn?.classList.add('hidden');
    }
    if (phase === 'success') {
      document.getElementById('p2p-sync-stats')?.classList.remove('hidden');
    }
  }

  _updateProgress(pct, label) {
    const bar = document.getElementById('p2p-progress-bar');
    const lbl = document.getElementById('p2p-progress-label');
    if (bar) bar.value = pct;
    if (lbl) lbl.textContent = label;
  }

  _updateStatusStats(sent, received, merged, duplicates) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('p2p-stat-sent', sent);
    set('p2p-stat-received', received);
    set('p2p-stat-merged', merged);
    set('p2p-stat-duplicates', duplicates);
  }

  _showError(message) {
    const errMsg = document.getElementById('p2p-error-message');
    if (errMsg) errMsg.textContent = message;
    this._showStatusOverlay('error');
  }

  // ── Private: toast ───────────────────────────────────

  _showToast(message) {
    if (window.showToast) {
      window.showToast(message, 'info');
    } else {
      console.info('[P2PUIController]', message);
    }
  }
}

// Initialize singleton
const p2pUIController = new P2PUIController();

export { P2PUIController, p2pUIController };
