/**
 * P2PUIController - Manages P2P sync UI state machine.
 *
 * States: idle → initiator | scanner → syncing → done | error
 *
 * iOS workarounds (R2):
 * - Detects PWA standalone mode and shows "use Safari" warning
 * - All QR screens include manual SDP copy-paste fallback
 * - Camera permission denial falls back to paste mode
 *
 * @version 1.0.0
 */

import { P2PManager } from '../offline/p2p/P2PManager.js';
import { P2PSignaling } from '../offline/p2p/P2PSignaling.js';
import { P2PSyncProtocol } from '../offline/p2p/P2PSyncProtocol.js';
import { P2PMerge } from '../offline/p2p/P2PMerge.js';

const OFFER_TIMEOUT_SEC = 120;

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
   * Share offer payload via Web Share API (AirDrop / native iOS share sheet).
   */
  async shareOfferText() {
    await this._sharePayload(this._offerPayload, 'P2P Offer');
  }

  /**
   * Share answer payload via Web Share API.
   */
  async shareAnswerText() {
    await this._sharePayload(this._answerPayload, 'P2P Answer');
  }

  /**
   * Share payload via Web Share API. Falls back to clipboard copy.
   * @param {string|null} payload
   * @param {string} title
   */
  async _sharePayload(payload, title) {
    if (!payload) return;
    try {
      await navigator.share({ title, text: payload });
    } catch (err) {
      if (err.name === 'AbortError') return; // user dismissed share sheet
      // Share not supported or failed — fall back to clipboard
      try {
        await navigator.clipboard.writeText(payload);
        this._showToast('Код скопирован');
      } catch {
        this._showToast('Скопируйте текст вручную');
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

  /**
   * Cancel sync and close modal.
   */
  cancel() {
    this._stopOfferTimer();
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
   * Uses createImageBitmap with imageOrientation:'from-image' to auto-apply
   * EXIF rotation (iOS camera writes JPEG rotated 90°; new Image() ignores it).
   * @param {File} file
   * @returns {Promise<string|null>}
   */
  async _decodeWithJsQR(file) {
    try {
      // imageOrientation:'from-image' applies EXIF rotation before drawing
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
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
        bitmap.close();
      }
    } catch {
      return null;
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
        <div class="flex flex-col gap-3 w-full max-w-xs">
          <button class="btn btn-primary" onclick="window.p2pUI?.startInitiator()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Создать QR
          </button>
          <p class="text-xs text-center text-base-content/40 -mt-2">Показать этот экран другому устройству для сканирования</p>

          <button class="btn btn-outline" onclick="window.p2pUI?.startResponder()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            </svg>
            Сканировать QR
          </button>
          <p class="text-xs text-center text-base-content/40 -mt-2">Навести камеру на QR другого устройства</p>

          <button class="btn btn-ghost btn-sm" onclick="window.p2pUI?.cancel()">Отмена</button>
        </div>

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
        '<div class="flex flex-col items-center gap-6 p-4 pb-8 w-full">',
          // Primary: photo capture button
          '<div class="flex flex-col items-center gap-2 w-full max-w-xs">',
            '<p class="text-sm text-base-content/60 text-center">Сфотографируйте QR-код с экрана другого устройства</p>',
            '<input type="file" id="p2p-photo-input" accept="image/*" capture="environment" class="hidden">',
            '<button class="btn btn-primary w-full" onclick="document.getElementById(\'p2p-photo-input\').click()">',
              'Сфотографировать QR',
            '</button>',
          '</div>',
          // Answer QR section (shown after processing scanned offer)
          '<div id="p2p-answer-qr-section" class="hidden flex flex-col items-center gap-2 w-full">',
            '<div id="p2p-answer-qr-container" class="p2p-qr-container flex items-center justify-center bg-white rounded-xl">',
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
          '<div class="w-full max-w-xs">',
            '<p class="text-xs text-base-content/50 mb-1">Или вставьте код вручную:</p>',
            '<textarea id="p2p-paste-input" class="textarea textarea-bordered textarea-xs font-mono text-xs h-16 w-full" placeholder="Вставьте код..."></textarea>',
            '<button class="btn btn-xs btn-primary mt-1 w-full" onclick="window.p2pUI?.processPastedCode()">Подключиться</button>',
          '</div>',
          '<button class="btn btn-ghost btn-sm" onclick="window.p2pUI?.cancel()">Отмена</button>',
        '</div>',
      ].join('');

      // Wire photo capture input
      const photoInput = content.querySelector('#p2p-photo-input');
      if (photoInput) {
        photoInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) this._handlePhotoCapture(file);
        });
      }
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
