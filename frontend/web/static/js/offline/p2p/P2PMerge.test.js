/**
 * Unit tests for P2PMerge conflict resolution and deduplication.
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { P2PMerge } from './P2PMerge.js';

// Polyfill Web Crypto API for Node.js test environment
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

// ── Helpers ─────────────────────────────────────────────

function makeFact(overrides = {}) {
  return {
    temp_id: 'test-uuid-' + Math.random().toString(36).slice(2),
    user_id: 1,
    article_id: 100,
    financial_center_id: 1,
    cost_center_id: null,
    date: '2026-01-15',
    amount: 5000, // 50.00 in cents
    record_type: 'fact',
    comment: 'test',
    transfer_group_id: null,
    is_transfer: false,
    sync_status: 'pending',
    content_hash: null,
    created_at: new Date('2026-01-15T10:00:00Z'),
    updated_at: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────

describe('P2PMerge', () => {
  let merge;

  beforeAll(() => {
    merge = new P2PMerge();
  });

  describe('contentHash', () => {
    it('produces consistent results for same fact', async () => {
      const fact = makeFact({ article_id: 42, amount: 9999, date: '2026-02-01', comment: 'coffee', record_type: 'fact' });
      const h1 = await merge.contentHash(fact);
      const h2 = await merge.contentHash(fact);
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(32);
    });

    it('produces different results for different facts', async () => {
      const f1 = makeFact({ amount: 1000 });
      const f2 = makeFact({ amount: 2000 });
      const h1 = await merge.contentHash(f1);
      const h2 = await merge.contentHash(f2);
      expect(h1).not.toBe(h2);
    });
  });

  describe('resolveConflict', () => {
    it('returns newer fact (fact2 newer)', () => {
      const older = makeFact({ updated_at: new Date('2026-01-01T09:00:00Z') });
      const newer = makeFact({ updated_at: new Date('2026-01-01T10:00:00Z') });
      expect(merge.resolveConflict(older, newer)).toBe(newer);
    });

    it('returns newer fact (fact1 newer)', () => {
      const older = makeFact({ updated_at: new Date('2026-01-01T08:00:00Z') });
      const newer = makeFact({ updated_at: new Date('2026-01-01T12:00:00Z') });
      expect(merge.resolveConflict(newer, older)).toBe(newer);
    });

    it('returns fact1 when timestamps equal', () => {
      const ts = new Date('2026-01-15T10:00:00Z');
      const f1 = makeFact({ updated_at: ts });
      const f2 = makeFact({ updated_at: ts });
      expect(merge.resolveConflict(f1, f2)).toBe(f1);
    });
  });

  describe('mergeFacts', () => {
    it('duplicate by content hash is skipped', async () => {
      const local = makeFact({ article_id: 1, amount: 100, date: '2026-01-01', comment: 'a', record_type: 'fact' });
      local.content_hash = await merge.contentHash(local);

      const remote = makeFact({ article_id: 1, amount: 100, date: '2026-01-01', comment: 'a', record_type: 'fact' });
      remote.content_hash = local.content_hash;

      const result = await merge.mergeFacts([local], [remote]);
      expect(result.toAdd).toHaveLength(0);
      expect(result.duplicates).toBe(1);
    });

    it('new fact from remote is added', async () => {
      const local = makeFact({ article_id: 10, amount: 5000 });
      const remote = makeFact({ article_id: 20, amount: 9999 });

      const result = await merge.mergeFacts([local], [remote]);
      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0].sync_status).toBe('pending');
      expect(result.duplicates).toBe(0);
    });

    it('conflict by temp_id resolved via LWW (remote wins)', async () => {
      const tempId = 'same-uuid-for-both';
      const localOlder = makeFact({ temp_id: tempId, amount: 1000, updated_at: new Date('2026-01-01T09:00:00Z') });
      const remoteNewer = makeFact({ temp_id: tempId, amount: 2000, updated_at: new Date('2026-01-01T11:00:00Z') });
      localOlder.content_hash = await merge.contentHash(localOlder);
      remoteNewer.content_hash = await merge.contentHash(remoteNewer);

      const result = await merge.mergeFacts([localOlder], [remoteNewer]);
      expect(result.conflicts).toBe(1);
      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0].amount).toBe(2000);
    });

    it('conflict by temp_id — local wins when newer', async () => {
      const tempId = 'conflict-local-wins';
      const localNewer = makeFact({ temp_id: tempId, amount: 3000, updated_at: new Date('2026-01-01T15:00:00Z') });
      const remoteOlder = makeFact({ temp_id: tempId, amount: 1000, updated_at: new Date('2026-01-01T08:00:00Z') });
      localNewer.content_hash = await merge.contentHash(localNewer);
      remoteOlder.content_hash = await merge.contentHash(remoteOlder);

      const result = await merge.mergeFacts([localNewer], [remoteOlder]);
      expect(result.conflicts).toBe(1);
      expect(result.toAdd).toHaveLength(0);
    });

    it('empty remote returns empty result', async () => {
      const local = makeFact();
      const result = await merge.mergeFacts([local], []);
      expect(result.toAdd).toHaveLength(0);
      expect(result.duplicates).toBe(0);
      expect(result.conflicts).toBe(0);
    });

    it('multiple new facts all added', async () => {
      const localFacts = [makeFact({ article_id: 1 })];
      const remoteFacts = [
        makeFact({ article_id: 2, amount: 100 }),
        makeFact({ article_id: 3, amount: 200 }),
        makeFact({ article_id: 4, amount: 300 }),
      ];
      const result = await merge.mergeFacts(localFacts, remoteFacts);
      expect(result.toAdd).toHaveLength(3);
    });

    it('does not mutate input remoteFacts', async () => {
      const local = makeFact({ article_id: 1 });
      const remote = makeFact({ article_id: 2, amount: 999 });
      const originalHash = remote.content_hash; // null

      await merge.mergeFacts([local], [remote]);
      expect(remote.content_hash).toBe(originalHash); // still null — not mutated
    });
  });
});
