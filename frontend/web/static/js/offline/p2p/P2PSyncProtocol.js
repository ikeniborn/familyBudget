/**
 * P2PSyncProtocol - Message protocol for fact exchange over RTCDataChannel.
 * Handles serialization, chunking (RTCDataChannel 16KB limit), and sync orchestration.
 *
 * @version 1.0.0
 */

const CHUNK_SIZE = 10 * 1024; // 10KB per chunk
const PROTOCOL_VERSION = '1.0';

const MSG_TYPES = {
  FACTS_START: 'facts_start',
  FACT_CHUNK: 'fact_chunk',
  FACTS_END: 'facts_end',
  ACK: 'ack',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
};

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback using crypto.getRandomValues() for older browsers without randomUUID
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

class P2PSyncProtocol {
  /**
   * @param {import('./P2PManager.js').P2PManager} p2pManager
   */
  constructor(p2pManager) {
    this.manager = p2pManager;
    /** @type {Object.<string, {chunks: Array<string|null>, total: number, received: number}>} */
    this._chunks = {};
    this._receiverFacts = [];
    this._receivingActive = false;
  }

  /**
   * Serialize a LocalBudgetFact for P2P transmission.
   * @param {Object} fact
   * @returns {Object}
   */
  serializeFact(fact) {
    return {
      temp_id: fact.temp_id,
      user_id: fact.user_id,
      article_id: fact.article_id,
      financial_center_id: fact.financial_center_id ?? null,
      cost_center_id: fact.cost_center_id ?? null,
      date: fact.date,
      amount: fact.amount,
      record_type: fact.record_type,
      comment: fact.comment ?? null,
      transfer_group_id: fact.transfer_group_id ?? null,
      is_transfer: fact.is_transfer ?? false,
      sync_status: fact.sync_status,
      content_hash: fact.content_hash ?? null,
      created_at: fact.created_at instanceof Date ? fact.created_at.toISOString() : fact.created_at,
      updated_at: fact.updated_at instanceof Date ? fact.updated_at.toISOString() : fact.updated_at,
    };
  }

  /**
   * Deserialize received fact data, restoring Date fields.
   * @param {Object} data
   * @returns {Object}
   */
  deserializeFact(data) {
    return {
      ...data,
      id: null,
      sync_status: 'pending',
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      synced_at: null,
    };
  }

  /**
   * Split JSON string into chunks for RTCDataChannel.
   * @param {string} jsonString
   * @param {string} transferId
   * @returns {string[]} Serialized chunk messages
   */
  chunkMessage(jsonString, transferId) {
    const chunks = [];
    const total = Math.ceil(jsonString.length / CHUNK_SIZE);
    for (let i = 0; i < total; i++) {
      const data = jsonString.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      chunks.push(JSON.stringify({
        type: MSG_TYPES.FACT_CHUNK,
        id: transferId,
        seq: i,
        total,
        data,
      }));
    }
    return chunks;
  }

  /**
   * Accumulate an incoming chunk. Returns reconstructed string when all chunks received.
   * @param {Object} chunkMsg
   * @returns {string|null}
   */
  addChunk(chunkMsg) {
    const { id, seq, total, data } = chunkMsg;
    if (!this._chunks[id]) {
      this._chunks[id] = { chunks: new Array(total).fill(null), total, received: 0 };
    }
    const entry = this._chunks[id];
    if (entry.chunks[seq] === null) {
      entry.chunks[seq] = data;
      entry.received++;
    }
    if (entry.received === entry.total) {
      const result = entry.chunks.join('');
      delete this._chunks[id];
      return result;
    }
    return null;
  }

  /**
   * Send facts array to connected peer via DataChannel.
   * @param {Object[]} facts
   * @returns {Promise<void>}
   */
  async sendFacts(facts) {
    const transferId = uuid();
    const serialized = facts.map(f => this.serializeFact(f));

    this.manager.send(JSON.stringify({
      type: MSG_TYPES.FACTS_START,
      version: PROTOCOL_VERSION,
      total_facts: serialized.length,
      transfer_id: transferId,
    }));

    for (let i = 0; i < serialized.length; i++) {
      const factJson = JSON.stringify({ type: 'fact', index: i, fact: serialized[i] });
      if (factJson.length <= CHUNK_SIZE) {
        this.manager.send(factJson);
      } else {
        const factTransferId = uuid();
        const chunks = this.chunkMessage(factJson, factTransferId);
        for (const chunk of chunks) {
          this.manager.send(chunk);
        }
      }
      // Yield to event loop every 10 facts
      if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }

    this.manager.send(JSON.stringify({
      type: MSG_TYPES.FACTS_END,
      transfer_id: transferId,
      checksum: serialized.length,
    }));

    console.debug('[P2PSyncProtocol] Sent', serialized.length, 'facts');
  }

  /**
   * Setup receiver to collect incoming facts.
   * @param {(facts: Object[]) => void} onComplete
   */
  setupReceiver(onComplete) {
    this._receiverFacts = [];
    this._receivingActive = false;
    let expectedCount = 0;

    const prevOnMessage = this.manager.onMessage;

    this.manager.onMessage = (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        console.warn('[P2PSyncProtocol] Invalid JSON received');
        return;
      }

      if (msg.type === MSG_TYPES.FACTS_START) {
        this._receivingActive = true;
        expectedCount = msg.total_facts;
        this._receiverFacts = [];
        console.debug('[P2PSyncProtocol] Receiving', expectedCount, 'facts from peer');

      } else if (msg.type === 'fact') {
        if (this._receivingActive) {
          this._receiverFacts.push(this.deserializeFact(msg.fact));
        }

      } else if (msg.type === MSG_TYPES.FACT_CHUNK) {
        const reconstructed = this.addChunk(msg);
        if (reconstructed) {
          try {
            const factMsg = JSON.parse(reconstructed);
            if (factMsg.type === 'fact' && this._receivingActive) {
              this._receiverFacts.push(this.deserializeFact(factMsg.fact));
            }
          } catch (e) {
            console.error('[P2PSyncProtocol] Failed to parse reconstructed chunk:', e);
          }
        }

      } else if (msg.type === MSG_TYPES.FACTS_END) {
        this._receivingActive = false;
        console.debug('[P2PSyncProtocol] Received', this._receiverFacts.length, '/', expectedCount, 'facts');
        this.manager.onMessage = prevOnMessage;
        onComplete(this._receiverFacts);

      } else if (msg.type === MSG_TYPES.PING) {
        this.manager.send(JSON.stringify({ type: MSG_TYPES.PONG, ts: msg.ts }));

      } else if (msg.type === MSG_TYPES.ERROR) {
        console.error('[P2PSyncProtocol] Peer error:', msg.message);
      }
    };
  }

  /**
   * Initiate full bidirectional sync with peer.
   * @param {Object[]} localPendingFacts
   * @returns {Promise<{ sent: number, received: Object[] }>}
   */
  async initiateSync(localPendingFacts) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('P2P sync timeout after 60s'));
      }, 60000);

      this.setupReceiver((receivedFacts) => {
        clearTimeout(timeout);
        resolve({ sent: localPendingFacts.length, received: receivedFacts });
      });

      this.sendFacts(localPendingFacts).catch(err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Send ping to check connection health.
   */
  ping() {
    this.manager.send(JSON.stringify({ type: MSG_TYPES.PING, ts: Date.now() }));
  }
}

export { P2PSyncProtocol, MSG_TYPES };
