/**
 * Integration test: P2PSyncProtocol → DataLayer → Dexie
 *
 * Tests the full P2P sync pipeline with a mock RTCDataChannel.
 * Validates that received facts are correctly persisted to IndexedDB.
 */

import { describe, it, expect } from 'vitest';
import { P2PSyncProtocol } from '../../frontend/web/static/js/offline/p2p/P2PSyncProtocol.js';
import { P2PMerge } from '../../frontend/web/static/js/offline/p2p/P2PMerge.js';

// ── Mock infrastructure ──────────────────────────────────

/**
 * Mock RTCDataChannel pair (two managers connected in-memory).
 */
function createMockManagerPair() {
  const managerA = { state: 'connected', onMessage: null, _sent: [] };
  const managerB = { state: 'connected', onMessage: null, _sent: [] };

  managerA.send = (data) => {
    managerA._sent.push(data);
    // Deliver to B asynchronously
    setTimeout(() => {
      if (managerB.onMessage) managerB.onMessage(data);
    }, 0);
  };

  managerB.send = (data) => {
    managerB._sent.push(data);
    setTimeout(() => {
      if (managerA.onMessage) managerA.onMessage(data);
    }, 0);
  };

  return { managerA, managerB };
}

/**
 * Mock Dexie DB instance.
 */
function createMockDB() {
  const store = new Map();
  return {
    budgetFacts: {
      where: (field) => ({
        equals: (val) => ({
          toArray: async () => [...store.values()].filter(f => f[field] === val),
        }),
      }),
      filter: (fn) => ({
        toArray: async () => [...store.values()].filter(fn),
      }),
      bulkPut: async (facts) => {
        facts.forEach(f => store.set(f.temp_id, f));
        return facts.length;
      },
      getAll: () => [...store.values()],
    },
  };
}

function makeFact(overrides = {}) {
  return {
    temp_id: 'fact-' + Math.random().toString(36).slice(2),
    user_id: 1,
    article_id: 10 + Math.floor(Math.random() * 5),
    financial_center_id: 1,
    cost_center_id: null,
    date: '2026-02-01',
    amount: Math.floor(Math.random() * 10000),
    record_type: 'fact',
    comment: 'integration test',
    transfer_group_id: null,
    is_transfer: false,
    sync_status: 'pending',
    content_hash: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────

describe('P2P DataLayer Integration', () => {
  it('Protocol: bidirectional fact exchange via mock DataChannel', async () => {
    const { managerA, managerB } = createMockManagerPair();
    const protoA = new P2PSyncProtocol(managerA);
    const protoB = new P2PSyncProtocol(managerB);

    const factsA = [makeFact(), makeFact(), makeFact()];
    const factsB = [makeFact(), makeFact()];

    // A sends to B, B sends to A simultaneously
    const [resultA, resultB] = await Promise.all([
      protoA.initiateSync(factsA),
      protoB.initiateSync(factsB),
    ]);

    expect(resultA.sent).toBe(3);
    expect(resultB.sent).toBe(2);
    expect(resultA.received.length).toBe(2);
    expect(resultB.received.length).toBe(3);
  });

  it('Merge: received facts applied to mock Dexie DB', async () => {
    const merge = new P2PMerge();
    const mockDB = createMockDB();

    const localFacts = [makeFact(), makeFact()];
    const remoteFacts = [makeFact(), makeFact(), makeFact()]; // 3 new facts

    const mergeResult = await merge.mergeFacts(localFacts, remoteFacts);
    expect(mergeResult.toAdd.length).toBe(3);

    const applied = await merge.applyMerge(mergeResult, () => mockDB);
    expect(applied).toBe(3);

    const stored = mockDB.budgetFacts.getAll();
    expect(stored.length).toBe(3);
    expect(stored.every(f => f.sync_status === 'pending')).toBe(true);
  });

  it('Merge: no duplicate facts after applying same remote twice', async () => {
    const merge = new P2PMerge();
    const mockDB = createMockDB();

    const remoteFacts = [makeFact({ article_id: 99, amount: 5000, date: '2026-01-01', comment: 'test', record_type: 'fact' })];

    // First sync
    const r1 = await merge.mergeFacts([], remoteFacts);
    await merge.applyMerge(r1, () => mockDB);

    // Re-compute content hashes for stored and remote facts
    const stored = mockDB.budgetFacts.getAll();
    for (const f of stored) {
      f.content_hash = await merge.contentHash(f);
    }
    for (const f of remoteFacts) {
      f.content_hash = await merge.contentHash(f);
    }

    const r2 = await merge.mergeFacts(stored, remoteFacts);
    expect(r2.toAdd.length).toBe(0);
    expect(r2.duplicates).toBe(1);
  });

  it('Protocol: empty facts list handled gracefully', async () => {
    const { managerA, managerB } = createMockManagerPair();
    const protoA = new P2PSyncProtocol(managerA);
    const protoB = new P2PSyncProtocol(managerB);

    const [resultA, resultB] = await Promise.all([
      protoA.initiateSync([]),
      protoB.initiateSync([]),
    ]);

    expect(resultA.sent).toBe(0);
    expect(resultB.sent).toBe(0);
    expect(resultA.received.length).toBe(0);
    expect(resultB.received.length).toBe(0);
  });
});
