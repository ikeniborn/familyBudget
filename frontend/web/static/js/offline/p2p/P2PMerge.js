/**
 * P2PMerge - Conflict resolution and deduplication for P2P sync.
 * Uses Web Crypto API (SubtleCrypto) for content hashing.
 *
 * Strategy: Last-Write-Wins (LWW) by updated_at for same temp_id conflicts.
 * Deduplication: same content_hash = duplicate (skip).
 * Budget facts are append-only — new temp_id = new entry.
 *
 * @version 1.0.0
 */

class P2PMerge {
  /**
   * Compute SHA-256 based content hash for a fact.
   * Format: SHA256(article_id|amount|date|comment|record_type) → 32-char hex prefix
   * @param {Object} fact
   * @returns {Promise<string>}
   */
  async contentHash(fact) {
    const parts = [
      String(fact.article_id ?? ''),
      String(fact.amount ?? ''),
      String(fact.date ?? ''),
      String(fact.comment ?? ''),
      String(fact.record_type ?? ''),
    ];
    const content = parts.join('|');
    const encoded = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Return first 32 hex chars (128-bit prefix) — sufficient for dedup
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  }

  /**
   * Merge remote facts into local facts set.
   * @param {Object[]} localFacts - Facts already in local Dexie DB
   * @param {Object[]} remoteFacts - Facts received from peer
   * @returns {Promise<{ toAdd: Object[], duplicates: number, conflicts: number }>}
   */
  async mergeFacts(localFacts, remoteFacts) {
    const localContentHashes = new Set(
      localFacts.map(f => f.content_hash).filter(Boolean)
    );
    const localByTempId = new Map(localFacts.map(f => [f.temp_id, f]));

    const toAdd = [];
    let duplicates = 0;
    let conflicts = 0;

    for (const remote of remoteFacts) {
      // Compute hash without mutating the input object
      const remoteHash = remote.content_hash || await this.contentHash(remote);

      // Duplicate by content hash — skip
      if (localContentHashes.has(remoteHash)) {
        duplicates++;
        console.debug('[P2PMerge] Duplicate (content hash):', remote.temp_id);
        continue;
      }

      // Conflict by temp_id — LWW
      const localMatch = localByTempId.get(remote.temp_id);
      if (localMatch) {
        const winner = this.resolveConflict(localMatch, remote);
        if (winner === remote) {
          toAdd.push({ ...remote, content_hash: remoteHash, sync_status: 'pending' });
          console.debug('[P2PMerge] Conflict: remote wins (newer):', remote.temp_id);
        } else {
          console.debug('[P2PMerge] Conflict: local wins (newer):', remote.temp_id);
        }
        conflicts++;
        continue;
      }

      // New fact — add
      toAdd.push({ ...remote, content_hash: remoteHash, sync_status: 'pending' });
    }

    console.debug('[P2PMerge] Result: toAdd=', toAdd.length, 'duplicates=', duplicates, 'conflicts=', conflicts);
    return { toAdd, duplicates, conflicts };
  }

  /**
   * Last-Write-Wins conflict resolver.
   * @param {Object} fact1
   * @param {Object} fact2
   * @returns {Object} The newer fact
   */
  resolveConflict(fact1, fact2) {
    const t1 = new Date(fact1.updated_at).getTime();
    const t2 = new Date(fact2.updated_at).getTime();
    return t1 >= t2 ? fact1 : fact2;
  }

  /**
   * Apply merge result to Dexie database.
   * @param {{ toAdd: Object[] }} mergeResult
   * @param {Function} getDB - Function returning Dexie DB instance
   * @returns {Promise<number>} Count of applied facts
   */
  async applyMerge(mergeResult, getDB) {
    if (mergeResult.toAdd.length === 0) {
      console.debug('[P2PMerge] Nothing to apply');
      return 0;
    }
    try {
      await getDB().budgetFacts.bulkPut(mergeResult.toAdd);
      console.debug('[P2PMerge] Applied', mergeResult.toAdd.length, 'facts to Dexie');
      return mergeResult.toAdd.length;
    } catch (err) {
      console.error('[P2PMerge] bulkPut failed:', err);
      throw err;
    }
  }
}

export { P2PMerge };
