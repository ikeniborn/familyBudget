/**
 * P2PUIController - Manages P2P sync UI state machine.
 *
 * States: idle → initiator | scanner | relay-initiator | relay-responder → syncing → done | error
 *
 * iOS workarounds (R2):
 * - Detects PWA standalone mode and shows "use Safari" warning
 * - All QR screens include manual SDP copy-paste fallback
 * - Camera permission denial falls back to paste mode
 *
 * Channels (R3):
 * - QR scan: existing flow (fixed EXIF, jsQR fallback)
 * - URL share: SDP encoded in URL hash, shared via AirDrop/Web Share
 * - Relay code: 6-digit code via server relay (cross-platform iOS↔Android)
 *
 * @version 1.1.0
 */

import { P2PManager } from '../offline/p2p/P2PManager.js';
import { P2PSignaling } from '../offline/p2p/P2PSignaling.js';
import { P2PSyncProtocol } from '../offline/p2p/P2PSyncProtocol.js';
import { P2PMerge } from '../offline/p2p/P2PMerge.js';

const OFFER_TIMEOUT_SEC = 120;
const RELAY_POLL_INTERVAL_MS = 2000;

/**
 * Detect iOS device.
 * @returns {boolean}
 */
function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Detect PWA standalone mode (added to home screen).
 * @returns {boolean}
 */
function isPWAStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

class P2PUIController {
  constructor() {
    this.manager = null;
    this.signaling = null;
    this.protocol = null;
    this.merge = new P2PMerge();

    this._offerTimer = null;
    this._offerPayload = null;
    this._answerPayload = null;
    this._modal = null;

    // Relay channel state
    this._relayCode = null;
    this._relayPollTimer = null;

    // Camera scanning state
    this._cameraStream = null;
    this._scanTimer = null;

    // Expose globally for inline onclick handlers in templates
    window.p2pUI = this;

    // Check URL hash for incoming P2P payload (URL-share channel)
    this._checkURLHash();
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

    // Auto-handle pending URL-share payload
    const pendingType = sessionStorage.getItem('p2p_pending_type');
    if (pendingType === 'offer') {
      sessionStorage.removeItem('p2p_pending_type');
      await this.startResponder();
      const payload = sessionStorage.getItem('p2p_pending_payload');
      if (payload) {
        sessionStorage.removeItem('p2p_pending_payload');
        const input = document.getElementById('p2p-paste-input');
        if (input) input.value = payload;
        await this.processPastedCode();
      }
    } else if (pendingType === 'answer') {
      sessionStorage.removeItem('p2p_pending_type');
      const payload = sessionStorage.getItem('p2p_pending_payload');
      if (payload) {
        sessionStorage.removeItem('p2p_pending_payload');
        if (!this.manager) this._initManager();
        try {
          await this.signaling.processScannedAnswer(payload);
          this._waitForConnection();
        } catch (err) {
          this._showError('Неверный ответный код: ' + err.message);
        }
      }
    }
  }

  /**
   * Start as initiator: generate offer QR.
   */
  async startInitiator() {
    this._showIosPwaWarning();
    this._renderScreen('initiator');
    this._initManager();

    try {
      const qrContainer = document.getElementById('p2p-qr-container');
      const loadingEl = document.getElementById('p2p-qr-loading');

      this._offerPayload = await this.signaling.displayOfferQR(qrContainer);
      if (loadingEl) loadingEl.remove();

      // Show manual text
      const manualText = document.getElementById('p2p-manual-offer-text');
      if (manualText) manualText.value = this._offerPayload;

      // Show "scan answer" button after QR ready
      const scanBtn = document.getElementById('p2p-goto-scan-btn');
      if (scanBtn) scanBtn.classList.remove('hidden');

      // Start offer expiry countdown
      this._startOfferTimer();

      console.debug('[P2PUIController] Offer QR displayed');
    } catch (err) {
      console.error('[P2PUIController] Failed to create offer:', err);
      this._showError('Не удалось создать QR: ' + err.message);
    }
  }

  /**
   * Show scanner screen (initiator side, step 2).
   */
  showScanner() {
    this._stopOfferTimer();
    this._renderScreen('scanner-answer');
  }

  /**
   * Start as responder: scan initiator's offer QR.
   */
  startResponder() {
    this._showIosPwaWarning();
    this._renderScreen('scanner');
    this._initManager();
  }

  /**
   * Copy offer payload text to clipboard.
   */
  async copyOfferText() {
    if (!this._offerPayload) return;
    try {
      await navigator.clipboard.writeText(this._offerPayload);
      this._showToast('Код скопирован');
    } catch {
      this._showToast('Скопируйте текст вручную');
    }
  }

  /**
   * Copy answer payload text to clipboard.
   */
  async copyAnswerText() {
    if (!this._answerPayload) return;
    try {
      await navigator.clipboard.writeText(this._answerPayload);
      this._showToast('Ответный код скопирован');
    } catch {
      this._showToast('Скопируйте текст вручную');
    }
  }

  /**
   * Share offer payload via Web Share API as a URL (AirDrop / native iOS share sheet).
   * Recipient opens the link and the browser auto-detects the offer from the URL hash.
   */
  async shareOfferText() {
    const url = `${location.origin}${location.pathname}#p2p_offer=${encodeURIComponent(this._offerPayload)}`;
    await this._sharePayload(url, 'P2P Синхронизация', true);
  }

  /**
   * Share answer payload via Web Share API as a URL.
   */
  async shareAnswerText() {
    const url = `${location.origin}${location.pathname}#p2p_answer=${encodeURIComponent(this._answerPayload)}`;
    await this._sharePayload(url, 'P2P Ответ', true);
  }

  /**
   * Share payload via Web Share API. Falls back to clipboard copy.
   * @param {string|null} payload
   * @param {string} title
   * @param {boolean} [isUrl=false] - true when payload is a URL (use url: field)
   */
  async _sharePayload(payload, title, isUrl = false) {
    if (!payload) return;
    try {
      const shareData = isUrl ? { title, url: payload } : { title, text: payload };
      await navigator.share(shareData);
    } catch (err) {
      if (err.name === 'AbortError') return; // user dismissed share sheet
      // Share not supported or failed — fall back to clipboard
      try {
        await navigator.clipboard.writeText(payload);
        this._showToast('Ссылка скопирована');
      } catch {
        this._showToast('Скопируйте ссылку вручную');
      }
    }
  }

  /**
   * Process pasted code (manual fallback for both offer and answer).
   */
  async processPastedCode() {
    const input = document.getElementById('p2p-paste-input');
    if (!input || !input.value.trim()) {
      this._showToast('Вставьте код в поле');
      return;
    }
    const code = input.value.trim();

    try {
      if (!this.manager) this._initManager();
      // Use _offerPayload presence to determine role (same logic as _handleScannedQR)
      if (this._offerPayload) {
        // Initiator: pasted text is the responder's answer
        await this.signaling.processScannedAnswer(code);
        this._waitForConnection();
      } else {
        // Responder: pasted text is the initiator's offer
        const answerPayload = await this.signaling.processScannedOffer(code);
        this._answerPayload = answerPayload;
        this._showAnswerQR(answerPayload);
      }
    } catch (err) {
      console.error('[P2PUIController] processPastedCode error:', err);
      this._showError('Неверный код: ' + err.message);
    }
  }

  // ── Relay channel (6-digit code, cross-platform) ─────

  /**
   * Start as relay initiator: create offer, POST to relay, show code.
   */
  async startRelayInitiator() {
    this._showIosPwaWarning();
    this._renderScreen('relay-code');
    this._initManager();

    try {
      // Build offer payload by reusing displayOfferQR with a throwaway container
      const tempEl = document.createElement('div');
      this._offerPayload = await this.signaling.displayOfferQR(tempEl);
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
   */
  startRelayResponder() {
    this._showIosPwaWarning();
    this._renderScreen('relay-enter');
    this._initManager();
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
      const answerPayload = await this.signaling.processScannedOffer(offerData.payload);
      this._answerPayload = answerPayload;

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
          await this.signaling.processScannedAnswer(data.payload);
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

  // ── URL hash channel ──────────────────────────────────

  /**
   * Check URL hash for incoming P2P payload (set by shareOfferText/shareAnswerText).
   * Saves payload to sessionStorage and shows an unobtrusive banner.
   * Called once at construction time.
   */
  _checkURLHash() {
    const hash = location.hash;
    const offerMatch = hash.match(/#p2p_offer=(.+)/);
    const answerMatch = hash.match(/#p2p_answer=(.+)/);
    if (!offerMatch && !answerMatch) return;

    let payload;
    try {
      payload = decodeURIComponent((offerMatch || answerMatch)[1]);
    } catch {
      // Malformed URI component — silently ignore to avoid crashing the module
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }

    sessionStorage.setItem('p2p_pending_payload', payload);
    sessionStorage.setItem('p2p_pending_type', offerMatch ? 'offer' : 'answer');
    history.replaceState(null, '', location.pathname + location.search);
    this._showIncomingBanner(offerMatch ? 'offer' : 'answer');
  }

  /**
   * Show a non-modal banner notifying about an incoming P2P payload.
   * @param {'offer'|'answer'} type
   */
  _showIncomingBanner(type) {
    if (document.getElementById('p2p-incoming-banner')) return;

    const label = type === 'offer' ? 'P2P-запрос синхронизации' : 'P2P-ответ на синхронизацию';
    const banner = document.createElement('div');
    banner.id = 'p2p-incoming-banner';
    banner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9600] '
      + 'flex items-center gap-3 bg-primary text-primary-content '
      + 'rounded-xl shadow-xl px-4 py-3 text-sm font-medium '
      + 'animate-bounce-once max-w-sm w-[calc(100%-2rem)]';
    banner.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 10h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z"/>
      </svg>
      <span class="flex-1">Получен ${label}</span>
      <button class="btn btn-xs btn-ghost text-primary-content"
        onclick="document.getElementById('p2p-incoming-banner')?.remove(); window.p2pUI?.open()">
        Открыть
      </button>
      <button class="btn btn-xs btn-ghost text-primary-content"
        onclick="document.getElementById('p2p-incoming-banner')?.remove(); sessionStorage.removeItem('p2p_pending_payload'); sessionStorage.removeItem('p2p_pending_type');">
        ✕
      </button>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 30000);
  }

  /**
   * Cancel sync and close modal.
   */
  cancel() {
    this._stopCameraScanning();
    this._stopOfferTimer();
    this._stopRelayPoll();
    if (this.manager) {
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
    this.signaling = new P2PSignaling(this.manager);
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

  // ── Private: iOS warnings ────────────────────────────

  _showIosPwaWarning() {
    if (isIOS() && isPWAStandalone()) {
      const warn = document.getElementById('p2p-ios-pwa-warning');
      if (warn) warn.classList.remove('hidden');
    }
  }

  // ── Private: live camera scanning ────────────────────

  /**
   * Start live camera stream and continuously scan for QR codes.
   * Primary: BarcodeDetector (Chrome 83+, Android WebView).
   * Fallback: jsQR (pure JS, iOS Safari).
   * On permission denial shows the camera error state with a photo-fallback button.
   * @param {HTMLVideoElement} videoEl
   */
  async _startCameraScanning(videoEl) {
    if (!navigator.mediaDevices?.getUserMedia) {
      this._showCameraError();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      // Guard: user may have cancelled while the permission dialog was open
      if (!this._modal) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      this._cameraStream = stream;
      videoEl.srcObject = stream;

      const useDetector = typeof BarcodeDetector !== 'undefined';
      const detector = useDetector ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
      const canvas = useDetector ? null : document.createElement('canvas');
      const ctx = canvas ? canvas.getContext('2d') : null;
      let busy = false;
      let frameCount = 0;

      const scan = async () => {
        if (!this._cameraStream || !this._scanTimer) return;
        if (videoEl.readyState < videoEl.HAVE_ENOUGH_DATA || busy) return;
        frameCount++;
        // BarcodeDetector: every tick (native, fast); jsQR: every 2nd tick (JS)
        if (!detector && frameCount % 2 !== 0) return;
        busy = true;
        try {
          let result = null;
          if (detector) {
            const codes = await detector.detect(videoEl);
            if (codes.length > 0) result = codes[0].rawValue;
          } else if (typeof window.jsQR === 'function') {
            canvas.width = videoEl.videoWidth || 320;
            canvas.height = videoEl.videoHeight || 240;
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(imageData.data, imageData.width, imageData.height);
            result = code?.data || null;
          }
          if (result && this._scanTimer) {
            this._stopCameraScanning();
            await this._handleScannedQR(result);
          }
        } catch { /* ignore individual frame errors */ }
        busy = false;
      };

      // 200ms interval = 5fps — sufficient for steady QR, light on CPU
      this._scanTimer = setInterval(scan, 200);
    } catch (err) {
      console.warn('[P2PUIController] Camera access denied:', err.message);
      this._showCameraError();
    }
  }

  /**
   * Show camera error state and reveal the photo-fallback button.
   */
  _showCameraError() {
    document.getElementById('p2p-camera-error')?.classList.remove('hidden');
    const video = document.getElementById('p2p-camera-video');
    if (video?.parentElement) video.parentElement.classList.add('hidden');
  }

  /**
   * Stop live camera scanning and release the media stream.
   */
  _stopCameraScanning() {
    if (this._scanTimer) {
      clearInterval(this._scanTimer);
      this._scanTimer = null;
    }
    if (this._cameraStream) {
      this._cameraStream.getTracks().forEach(t => t.stop());
      this._cameraStream = null;
    }
  }

  // ── Private: QR scanning (photo capture) ─────────────

  /**
   * Decode QR from a captured photo file.
   * Primary: BarcodeDetector (Chrome 83+, Android WebView; NOT available on iOS Safari).
   * Fallback: jsQR (pure JS, loaded globally via vendor/jsqr.min.js) — handles iOS.
   * @param {File} file
   */
  async _handlePhotoCapture(file) {
    try {
      if (typeof BarcodeDetector !== 'undefined') {
        // Native path — fast, no canvas needed
        const bitmap = await createImageBitmap(file);
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        let barcodes;
        try {
          barcodes = await detector.detect(bitmap);
        } finally {
          bitmap.close();
        }
        if (barcodes.length > 0) {
          await this._handleScannedQR(barcodes[0].rawValue);
          return;
        }
        // BarcodeDetector found nothing — try jsQR before giving up
      }

      // jsQR fallback: draw photo to canvas → getImageData → decode
      if (typeof window.jsQR === 'function') {
        const result = await this._decodeWithJsQR(file);
        if (result) {
          await this._handleScannedQR(result);
          return;
        }
        this._showToast('QR не распознан — попробуйте ещё раз');
        return;
      }

      this._showToast('QR не распознан — вставьте код вручную');
    } catch (err) {
      console.error('[P2PUIController] Photo QR decode error:', err);
      this._showToast('Ошибка: ' + err.message);
    }
  }

  /**
   * Decode QR from File using jsQR library via canvas.
   * Tries createImageBitmap with imageOrientation:'from-image' (iOS 15+ / Chrome)
   * to auto-apply EXIF rotation. Falls back to plain createImageBitmap if the
   * imageOrientation option is unsupported (older iOS Safari).
   * @param {File} file
   * @returns {Promise<string|null>}
   */
  async _decodeWithJsQR(file) {
    // Try with EXIF rotation first (iOS 15+ / Chrome).
    // If imageOrientation option is unsupported, fall back to plain createImageBitmap.
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      try {
        bitmap = await createImageBitmap(file);
      } catch {
        return null;
      }
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height);
      return code ? code.data : null;
    } finally {
      bitmap.close?.();
    }
  }

  async _handleScannedQR(qrData) {
    try {
      if (!this.manager) this._initManager();

      // Use _offerPayload presence to determine role:
      // Initiator has _offerPayload set (just showed offer QR, now scanning answer).
      // Responder has _offerPayload = null (scanning initiator's offer for the first time).
      if (this._offerPayload) {
        // Initiator: scanned responder's answer QR
        await this.signaling.processScannedAnswer(qrData);
        this._waitForConnection();
      } else {
        // Responder: scanned initiator's offer QR
        const answerPayload = await this.signaling.processScannedOffer(qrData);
        this._answerPayload = answerPayload;
        this._showAnswerQR(answerPayload);
      }
    } catch (err) {
      console.error('[P2PUIController] QR scan processing error:', err);
      this._showError('Ошибка обработки QR: ' + err.message);
    }
  }

  _showAnswerQR(answerPayload) {
    this._stopCameraScanning();
    const section = document.getElementById('p2p-answer-qr-section');
    const container = document.getElementById('p2p-answer-qr-container');
    const manualText = document.getElementById('p2p-manual-answer-text');
    if (section) section.classList.remove('hidden');
    if (container && this.signaling) this.signaling.renderQR(container, answerPayload);
    if (manualText) manualText.value = answerPayload;
    this._waitForConnection();
  }

  // ── Private: connection lifecycle ───────────────────

  _waitForConnection() {
    this._stopCameraScanning();
    // Close modal so the status overlay (z-9500) is fully visible
    this._closeModal();
    // Manager's onStateChange will call _onConnected when connected
    this._showStatusOverlay('connecting');
  }

  async _onConnected() {
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

      // Auto-close after 3s
      setTimeout(() => this.closeStatus(), 3000);

    } catch (err) {
      console.error('[P2PUIController] Sync error:', err);
      this._showError(err.message);
    } finally {
      if (this.manager) {
        this.manager.cleanup();
        this.manager = null;
      }
    }
  }

  // ── Private: offer timer ─────────────────────────────

  _startOfferTimer() {
    let remaining = OFFER_TIMEOUT_SEC;
    const timerEl = document.getElementById('p2p-offer-timer');
    const progressEl = document.getElementById('p2p-offer-progress');

    this._offerTimer = setInterval(() => {
      remaining--;
      if (timerEl) timerEl.textContent = remaining + 's';
      if (progressEl) progressEl.value = Math.round((remaining / OFFER_TIMEOUT_SEC) * 100);
      if (remaining <= 0) {
        this._stopOfferTimer();
        this._showError('Время истекло. Начните заново.');
      }
    }, 1000);
  }

  _stopOfferTimer() {
    if (this._offerTimer) {
      clearInterval(this._offerTimer);
      this._offerTimer = null;
    }
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
          <p class="text-xs text-base-content/50 mt-0.5">Без интернета · WebRTC · QR-коды</p>
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

          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1">
              <button class="btn btn-primary btn-sm whitespace-nowrap" onclick="window.p2pUI?.startInitiator()">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Создать QR
              </button>
              <p class="text-xs text-center text-base-content/40">Показать QR другому устройству</p>
            </div>

            <div class="flex flex-col gap-1">
              <button class="btn btn-secondary btn-sm whitespace-nowrap" onclick="window.p2pUI?.startRelayInitiator()">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                </svg>
                Получить код
              </button>
              <p class="text-xs text-center text-base-content/40">6-значный код для iOS↔Android</p>
            </div>

            <div class="flex flex-col gap-1">
              <button class="btn btn-outline btn-sm whitespace-nowrap" onclick="window.p2pUI?.startResponder()">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                </svg>
                Сканировать QR
              </button>
              <p class="text-xs text-center text-base-content/40">Навести камеру на QR</p>
            </div>

            <div class="flex flex-col gap-1">
              <button class="btn btn-outline btn-sm whitespace-nowrap" onclick="window.p2pUI?.startRelayResponder()">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
                Ввести код
              </button>
              <p class="text-xs text-center text-base-content/40">Ввести код с другого устройства</p>
            </div>
          </div>

          <button class="btn btn-ghost btn-sm mt-1" onclick="window.p2pUI?.cancel()">Отмена</button>
        </div>

        ${isIOS() ? '<p class="text-xs text-center text-base-content/30 px-2">iOS: «Создать QR» и «Получить код» запрашивают доступ к микрофону — это нужно для P2P соединения по локальной сети</p>' : ''}

      </div>
    `;
  }

  _renderScreen(screenName) {
    const content = document.getElementById('p2p-modal-content');
    if (!content) return;

    // Inline screens (avoids extra fetch for offline usage)
    if (screenName === 'initiator') {
      content.innerHTML = document.getElementById('p2p-initiator-template')?.innerHTML
        || [
          '<div class="flex flex-col items-center gap-4 p-4 pb-8 w-full">',
            '<div id="p2p-qr-container" class="p2p-qr-container flex items-center justify-center bg-white rounded-2xl">',
              '<div id="p2p-qr-loading"><span class="loading loading-ring loading-lg"></span></div>',
            '</div>',
            '<div class="flex gap-2 w-full max-w-xs">',
              '<button class="btn btn-ghost btn-sm flex-1" onclick="window.p2pUI?.cancel()">Отмена</button>',
              '<button id="p2p-goto-scan-btn" class="btn btn-primary btn-sm flex-1 hidden justify-center" onclick="window.p2pUI?.showScanner()">Сканировать ответ</button>',
            '</div>',
            '<div class="w-full max-w-xs">',
              '<p class="text-xs text-base-content/50 mb-1">Или передайте код вручную:</p>',
              '<textarea id="p2p-manual-offer-text" class="textarea textarea-bordered textarea-xs font-mono text-xs h-16 w-full" readonly></textarea>',
              '<div class="flex gap-1 mt-1">',
                '<button class="btn btn-xs btn-outline flex-1" onclick="window.p2pUI?.copyOfferText()">Скопировать</button>',
                navigator.share
                  ? '<button class="btn btn-xs btn-primary flex-1" onclick="window.p2pUI?.shareOfferText()">Поделиться</button>'
                  : '',
              '</div>',
            '</div>',
          '</div>',
        ].join('');
    } else if (screenName === 'scanner' || screenName === 'scanner-answer') {
      content.innerHTML = [
        '<div class="flex flex-col items-center gap-4 p-4 pb-8 w-full">',
          // Live camera view
          '<div id="p2p-camera-wrapper" class="relative w-full max-w-xs">',
            '<div class="p2p-scanner-overlay rounded-xl overflow-hidden bg-black" style="aspect-ratio:1/1;position:relative">',
              '<video id="p2p-camera-video" class="w-full h-full object-cover" autoplay playsinline muted></video>',
              '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">',
                '<div style="width:9rem;height:9rem;border:2px solid oklch(var(--p,65% 0.27 264)/0.85);border-radius:0.5rem"></div>',
              '</div>',
            '</div>',
            // Camera error/fallback
            '<div id="p2p-camera-error" class="hidden" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:oklch(var(--b2,100% 0 0));border-radius:0.75rem;gap:0.75rem;padding:1rem">',
              '<svg xmlns="http://www.w3.org/2000/svg" style="width:2rem;height:2rem;color:oklch(var(--wa,80% 0.15 85))" fill="none" viewBox="0 0 24 24" stroke="currentColor">',
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>',
              '</svg>',
              '<p class="text-xs text-center text-base-content/60">Нет доступа к камере</p>',
              '<button class="btn btn-xs btn-primary" onclick="document.getElementById(\'p2p-photo-input\').click()">Сфотографировать QR</button>',
            '</div>',
          '</div>',
          // Hidden file input (fallback)
          '<input type="file" id="p2p-photo-input" accept="image/*" capture="environment" class="hidden">',
          // Answer QR section (shown after processing scanned offer)
          '<div id="p2p-answer-qr-section" class="hidden flex flex-col items-center gap-2 w-full">',
            '<div class="divider text-xs">Шаг 2: Покажите QR первому устройству</div>',
            '<div id="p2p-answer-qr-container" class="p2p-qr-container flex items-center justify-center bg-white rounded-2xl shadow-md">',
              '<span class="loading loading-ring loading-lg"></span>',
            '</div>',
            '<div class="w-full max-w-xs">',
              '<textarea id="p2p-manual-answer-text" class="textarea textarea-bordered textarea-xs font-mono text-xs h-16 w-full" readonly></textarea>',
              '<div class="flex gap-1 mt-1">',
                '<button class="btn btn-xs btn-outline flex-1" onclick="window.p2pUI?.copyAnswerText()">Скопировать</button>',
                navigator.share
                  ? '<button class="btn btn-xs btn-primary flex-1" onclick="window.p2pUI?.shareAnswerText()">Поделиться</button>'
                  : '',
              '</div>',
            '</div>',
          '</div>',
          // Paste fallback
          '<div class="collapse collapse-arrow bg-base-200 w-full max-w-xs">',
            '<input type="checkbox">',
            '<div class="collapse-title text-sm font-medium">Вставить код вручную</div>',
            '<div class="collapse-content">',
              '<textarea id="p2p-paste-input" class="textarea textarea-bordered textarea-xs font-mono text-xs h-16 w-full" placeholder="Вставьте код..."></textarea>',
              '<button class="btn btn-xs btn-primary mt-1 w-full" onclick="window.p2pUI?.processPastedCode()">Подключиться</button>',
            '</div>',
          '</div>',
          '<button class="btn btn-ghost btn-sm" onclick="window.p2pUI?.cancel()">Отмена</button>',
        '</div>',
      ].join('');

      // Start live camera scanning
      const videoEl = content.querySelector('#p2p-camera-video');
      if (videoEl) this._startCameraScanning(videoEl);

      // Wire photo input fallback
      const photoInput = content.querySelector('#p2p-photo-input');
      if (photoInput) {
        photoInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) this._handlePhotoCapture(file);
        });
      }
    } else if (screenName === 'relay-code') {
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
    this._updateStatusOverlay('error');
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
