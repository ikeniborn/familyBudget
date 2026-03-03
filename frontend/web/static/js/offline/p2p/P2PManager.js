/**
 * P2PManager - WebRTC RTCPeerConnection lifecycle wrapper
 * Manages RTCDataChannel for offline peer-to-peer sync between devices.
 *
 * iOS R1 fix: getUserMedia({audio:true}) is called before createOffer()
 * to unblock host ICE candidates on Safari (known iOS WebRTC limitation).
 *
 * @version 1.0.0
 */

// Module-level flag: getUserMedia for iOS ICE unblock is done at most once per page load.
// Avoids repeated permission prompts when user opens multiple sync sessions.
let _iceUnblockDone = false;

const P2P_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const ICE_GATHER_TIMEOUT_MS = 5000;
const DATA_CHANNEL_LABEL = 'p2p-sync';
const BUFFERED_AMOUNT_THRESHOLD = 64 * 1024; // 64KB

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

class P2PManager {
  constructor() {
    /** @type {'idle'|'connecting'|'connected'|'error'|'closed'} */
    this.state = 'idle';
    /** @type {RTCPeerConnection|null} */
    this.peerConnection = null;
    /** @type {RTCDataChannel|null} */
    this.dataChannel = null;

    /** @type {((data: string) => void)|null} */
    this.onMessage = null;
    /** @type {((newState: string) => void)|null} */
    this.onStateChange = null;
    /** @type {((error: Error) => void)|null} */
    this.onError = null;

    /** @type {MediaStream|null} */
    this._iceUnblockStream = null;
    /** @type {RTCIceCandidate[]} */
    this._iceCandidates = [];
    /** @type {Function|null} */
    this._iceGatherResolve = null;
  }

  /**
   * iOS R1 FIX: Acquire dummy audio stream to unblock host ICE candidates on iOS Safari.
   * Immediately stops all tracks after acquisition. Silently skips on permission denial.
   * @returns {Promise<void>}
   */
  async getUnblockMediaStream() {
    if (!isIOS()) return;
    if (_iceUnblockDone) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this._iceUnblockStream = stream;
      stream.getTracks().forEach(track => track.stop());
      _iceUnblockDone = true;
      console.debug('[P2PManager] iOS ICE unblock: getUserMedia succeeded, tracks stopped');
    } catch (err) {
      _iceUnblockDone = true; // don't retry on denial
      console.warn('[P2PManager] iOS ICE unblock: getUserMedia denied or unavailable:', err.message);
    }
  }

  /**
   * Initialize RTCPeerConnection with STUN servers.
   * @returns {Promise<void>}
   */
  async initConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this._iceCandidates = [];

    this.peerConnection = new RTCPeerConnection({ iceServers: P2P_STUN_SERVERS });
    this.setState('connecting');

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this._iceCandidates.push(event.candidate);
        console.debug('[P2PManager] ICE candidate gathered:', event.candidate.type);
      } else {
        console.debug('[P2PManager] ICE gathering complete, total:', this._iceCandidates.length);
        if (this._iceGatherResolve) {
          this._iceGatherResolve(this._iceCandidates);
          this._iceGatherResolve = null;
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const cs = this.peerConnection.connectionState;
      console.debug('[P2PManager] Connection state:', cs);
      if (cs === 'connected') {
        this.setState('connected');
      } else if (cs === 'failed' || cs === 'disconnected') {
        this.setState('error');
        if (this.onError) this.onError(new Error('RTCPeerConnection ' + cs));
      } else if (cs === 'closed') {
        this.setState('closed');
      }
    };

    // Responder side: receive incoming data channel
    this.peerConnection.ondatachannel = (event) => {
      console.debug('[P2PManager] Received remote data channel');
      this.setupDataChannel(event.channel);
    };

    console.debug('[P2PManager] RTCPeerConnection initialized');
  }

  /**
   * Create RTCDataChannel (initiator side).
   * @returns {RTCDataChannel}
   */
  createDataChannel() {
    if (!this.peerConnection) throw new Error('P2PManager: call initConnection() first');
    const channel = this.peerConnection.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
      maxRetransmits: 10,
    });
    this.setupDataChannel(channel);
    return channel;
  }

  /**
   * Setup RTCDataChannel event handlers (both initiator and responder sides).
   * @param {RTCDataChannel} channel
   */
  setupDataChannel(channel) {
    channel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_THRESHOLD;

    channel.onopen = () => {
      console.debug('[P2PManager] DataChannel open');
      this.dataChannel = channel;
      this.setState('connected');
    };

    channel.onclose = () => {
      console.debug('[P2PManager] DataChannel closed');
      if (this.state === 'connected') this.setState('closed');
    };

    channel.onerror = (err) => {
      console.error('[P2PManager] DataChannel error:', err);
      this.setState('error');
      if (this.onError) this.onError(new Error('DataChannel error'));
    };

    channel.onmessage = (event) => {
      if (this.onMessage) {
        try {
          this.onMessage(event.data);
        } catch (e) {
          console.error('[P2PManager] onMessage handler error:', e);
        }
      }
    };

    this.dataChannel = channel;
  }

  /**
   * Create SDP offer (initiator). Applies iOS ICE unblock first.
   * @returns {Promise<string>} Local SDP offer string
   */
  async createOffer() {
    if (!this.peerConnection) await this.initConnection();
    await this.getUnblockMediaStream();
    this.createDataChannel();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    console.debug('[P2PManager] Offer created');
    return offer.sdp;
  }

  /**
   * Create SDP answer (responder). Applies offer from initiator.
   * @param {string} offerSdp - Remote SDP offer string
   * @returns {Promise<string>} Local SDP answer string
   */
  async createAnswer(offerSdp) {
    if (!this.peerConnection) await this.initConnection();
    await this.peerConnection.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    await this.getUnblockMediaStream();
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    console.debug('[P2PManager] Answer created');
    return answer.sdp;
  }

  /**
   * Set remote SDP answer (initiator side, after responder scanned QR).
   * @param {string} answerSdp - Remote SDP answer string
   * @returns {Promise<void>}
   */
  async setAnswer(answerSdp) {
    if (!this.peerConnection) throw new Error('P2PManager: no peer connection');
    await this.peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    console.debug('[P2PManager] Remote answer set');
  }

  /**
   * Wait for ICE candidates to be gathered (with timeout).
   * @returns {Promise<RTCIceCandidate[]>}
   */
  async gatherICECandidates() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('[P2PManager] ICE gather timeout, returning', this._iceCandidates.length, 'candidates');
        this._iceGatherResolve = null;
        resolve(this._iceCandidates);
      }, ICE_GATHER_TIMEOUT_MS);

      if (this.peerConnection && this.peerConnection.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        resolve(this._iceCandidates);
        return;
      }

      this._iceGatherResolve = (candidates) => {
        clearTimeout(timeout);
        resolve(candidates);
      };
    });
  }

  /**
   * Add remote ICE candidates from peer.
   * @param {Array<{candidate: string, sdpMid: string, sdpMLineIndex: number}>} candidates
   * @returns {Promise<void>}
   */
  async addICECandidates(candidates) {
    for (const c of candidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn('[P2PManager] Failed to add ICE candidate:', e.message);
      }
    }
  }

  /**
   * Send data over DataChannel. Throws if channel not open.
   * @param {string} data
   */
  send(data) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel not open (state: ' + (this.dataChannel?.readyState ?? 'null') + ')');
    }
    this.dataChannel.send(data);
  }

  /**
   * Close connection and release all resources.
   */
  cleanup() {
    if (this._iceUnblockStream) {
      this._iceUnblockStream.getTracks().forEach(t => t.stop());
      this._iceUnblockStream = null;
    }
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this._iceCandidates = [];
    this._iceGatherResolve = null;
    this.setState('closed');
    console.debug('[P2PManager] Cleanup complete');
  }

  /**
   * Update state and notify callback.
   * @param {string} newState
   */
  setState(newState) {
    if (this.state === newState) return;
    const old = this.state;
    this.state = newState;
    console.debug('[P2PManager] State:', old, '→', newState);
    if (this.onStateChange) this.onStateChange(newState);
  }
}

export { P2PManager };
