/**
 * P2PUIController - Manages P2P sync UI state machine.
 *
 * States: idle → relay-initiator | relay-responder → syncing → done | error
 *
 * Channels:
 * - Relay code: 6-digit code via server relay (cross-platform iOS↔Android)
 *
 * @version 1.3.0
 */

import { P2PManager } from '/static/js/offline/p2p/P2PManager.js?v=PLACEHOLDER';
import { P2PSyncProtocol } from '/static/js/offline/p2p/P2PSyncProtocol.js?v=PLACEHOLDER';
import { P2PMerge } from '/static/js/offline/p2p/P2PMerge.js?v=PLACEHOLDER';

import {
  renderIosMicWarning,
  renderRoleSelect,
  renderRelayCodeScreen,
  renderRelayEnterScreen,
  renderModal,
} from '/static/js/ui/P2PTemplates.js?v=PLACEHOLDER';

import {
  createRelayOffer,
  getRelayOffer,
  postRelayAnswer,
  pollRelayAnswer,
} from '/static/js/ui/P2PRelayService.js?v=PLACEHOLDER';

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

      const { code } = await createRelayOffer(this._offerPayload);
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
      let offerData;
      try {
        offerData = await getRelayOffer(code);
      } catch (err) {
        if (err.notFound) {
          this._showToast('Код не найден или истёк срок');
          return;
        }
        throw err;
      }

      const { sdp: offerSdp, candidates: offerCandidates } = _parseRelayPayload(offerData.payload);
      const answerSdp = await this.manager.createAnswer(offerSdp);
      if (offerCandidates.length > 0) {
        await this.manager.addICECandidates(offerCandidates);
      }
      const localCandidates = await this.manager.gatherICECandidates();
      const answerPayload = _buildRelayPayload(answerSdp, localCandidates);

      await postRelayAnswer(code, answerPayload);

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
        const { status, data } = await pollRelayAnswer(code);
        if (status === 200) {
          this._stopRelayPoll();
          const { sdp: answerSdp, candidates: answerCandidates } = _parseRelayPayload(data.payload);
          await this.manager.setAnswer(answerSdp);
          if (answerCandidates.length > 0) {
            await this.manager.addICECandidates(answerCandidates);
          }
          this._waitForConnection();
        } else if (status === 404) {
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
    content.innerHTML = renderIosMicWarning(role);
  }

  // ── Private: modal ───────────────────────────────────

  _showModal() {
    if (this._modal) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'p2p-modal-wrapper';
    wrapper.innerHTML = renderModal();
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
    content.innerHTML = renderRoleSelect(pendingCount);
  }

  _renderScreen(screenName) {
    const content = document.getElementById('p2p-modal-content');
    if (!content) return;

    if (screenName === 'relay-code') {
      content.innerHTML = renderRelayCodeScreen(null, OFFER_TIMEOUT_SEC);
    } else if (screenName === 'relay-enter') {
      content.innerHTML = renderRelayEnterScreen();

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
