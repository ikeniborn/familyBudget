/**
 * P2PSignaling - QR-code based SDP exchange for WebRTC signaling.
 * Uses vendor/qr-creator.js for QR rendering (imported as ES module).
 * Includes manual SDP text fallback for iOS PWA permission denial (R2 mitigation).
 *
 * Protocol version prefix: 'P2P1:' in QR payload.
 * Payload format: P2P1:<base64(JSON({sdp, candidates}))>
 *
 * @version 1.1.0
 */

import QrCreator from '/static/js/vendor/qr-creator.js';

const QR_PAYLOAD_PREFIX = 'P2P1:';

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
 * Render QR code into element using vendor QrCreator library.
 * @param {HTMLElement} element
 * @param {string} data
 */
function renderQR(element, data) {
  element.innerHTML = '';
  const canvas = document.createElement('canvas');
  element.appendChild(canvas);
  QrCreator.render({
    text: data,
    radius: 0.5,
    ecLevel: 'L',  // Low ECC → fewer modules → each module larger → easier to scan
    fill: '#000000',
    back: '#ffffff',
    size: 400,     // High-res canvas for Retina screens
  }, canvas);
}

class P2PSignaling {
  /**
   * @param {import('./P2PManager.js').P2PManager} p2pManager
   */
  constructor(p2pManager) {
    this.manager = p2pManager;
  }

  /**
   * Decompress base64 QR payload back to string.
   * @param {string} compressed
   * @returns {string}
   */
  decompressSDP(compressed) {
    if (!compressed.startsWith(QR_PAYLOAD_PREFIX)) {
      throw new Error('Invalid P2P QR payload: missing P2P1: version prefix');
    }
    return _fromBase64(compressed.slice(QR_PAYLOAD_PREFIX.length));
  }

  /**
   * Strip verbose SDP lines not needed for DataChannel-only connections.
   * @param {string} sdp
   * @returns {string}
   */
  _stripSDP(sdp) {
    return sdp.split('\r\n')
      .filter(line =>
        !line.startsWith('a=extmap') &&
        !line.startsWith('a=msid-semantic') &&
        !line.startsWith('a=ssrc') &&
        !line.startsWith('a=rtcp-fb') &&
        !line.startsWith('a=rtpmap') &&
        !line.startsWith('a=fmtp') &&
        line.trim() !== ''
      )
      .join('\r\n');
  }

  /**
   * Build QR payload with SDP + ICE candidates.
   * Strips verbose SDP lines and keeps only host candidates (local network)
   * to minimise QR payload size and maximise scan reliability.
   * @param {string} sdp
   * @param {RTCIceCandidate[]} candidates
   * @returns {string} QR-ready payload string
   */
  buildPayload(sdp, candidates) {
    const strippedSdp = this._stripSDP(sdp);

    // For local network sync, host candidates are sufficient.
    // Excluding srflx/relay reduces payload by ~30-50%.
    const hostCandidates = candidates.filter(c => {
      const parts = c.candidate.split(' ');
      return parts[7] === 'host';
    });
    const usedCandidates = hostCandidates.length > 0 ? hostCandidates : candidates;

    const payload = JSON.stringify({
      sdp: strippedSdp,
      candidates: usedCandidates.map(c => ({
        candidate: c.candidate,
        sdpMid: c.sdpMid,
        sdpMLineIndex: c.sdpMLineIndex,
      })),
    });
    return QR_PAYLOAD_PREFIX + _toBase64(payload);
  }

  /**
   * Parse QR payload into { sdp, candidates }.
   * @param {string} qrData
   * @returns {{ sdp: string, candidates: Array }}
   */
  parsePayload(qrData) {
    const raw = this.decompressSDP(qrData.trim());
    try {
      const parsed = JSON.parse(raw);
      return { sdp: parsed.sdp || raw, candidates: parsed.candidates || [] };
    } catch {
      return { sdp: raw, candidates: [] };
    }
  }

  /**
   * Generate offer QR and display in container element.
   * @param {HTMLElement} containerElement
   * @returns {Promise<string>} QR payload (for manual fallback copy)
   */
  async displayOfferQR(containerElement) {
    const offerSdp = await this.manager.createOffer();
    console.debug('[P2PSignaling] Waiting for ICE candidates...');
    const candidates = await this.manager.gatherICECandidates();

    const qrData = this.buildPayload(offerSdp, candidates);
    renderQR(containerElement, qrData);
    console.debug('[P2PSignaling] Offer QR rendered, payload length:', qrData.length);
    return qrData;
  }

  /**
   * Process scanned QR offer (responder side).
   * Applies remote offer, creates answer, returns answer QR payload.
   * @param {string} qrData - Scanned QR data from initiator
   * @returns {Promise<string>} Answer QR payload
   */
  async processScannedOffer(qrData) {
    const { sdp: offerSdp, candidates } = this.parsePayload(qrData);
    const answerSdp = await this.manager.createAnswer(offerSdp);

    if (candidates.length > 0) {
      await this.manager.addICECandidates(candidates);
    }

    console.debug('[P2PSignaling] Waiting for local ICE candidates (answer)...');
    const localCandidates = await this.manager.gatherICECandidates();

    const answerPayload = this.buildPayload(answerSdp, localCandidates);
    console.debug('[P2PSignaling] Answer payload ready, length:', answerPayload.length);
    return answerPayload;
  }

  /**
   * Process scanned answer QR (initiator side, completes handshake).
   * @param {string} qrData - Scanned QR data from responder
   * @returns {Promise<void>}
   */
  async processScannedAnswer(qrData) {
    const { sdp: answerSdp, candidates } = this.parsePayload(qrData);
    await this.manager.setAnswer(answerSdp);
    if (candidates.length > 0) {
      await this.manager.addICECandidates(candidates);
    }
    console.debug('[P2PSignaling] Handshake complete');
  }

  /**
   * Get manual SDP text for copy-paste fallback (R2 mitigation for iOS PWA).
   * @param {string} sdp
   * @param {RTCIceCandidate[]} [candidates=[]]
   * @returns {string}
   */
  getManualSDPText(sdp, candidates = []) {
    return this.buildPayload(sdp, candidates);
  }

  /**
   * Parse manually pasted SDP text.
   * @param {string} text
   * @returns {{ sdp: string, candidates: Array }}
   */
  parseManualSDP(text) {
    return this.parsePayload(text.trim());
  }

  /**
   * Render QR code into DOM element.
   * @param {HTMLElement} element
   * @param {string} data
   */
  renderQR(element, data) {
    renderQR(element, data);
  }
}

export { P2PSignaling };
