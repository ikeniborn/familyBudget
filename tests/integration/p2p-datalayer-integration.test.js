/**
 * Integration test: P2PSyncProtocol → DataLayer → Dexie
 *
 * Tests the full P2P sync pipeline with a mock RTCDataChannel.
 * Validates that received facts are correctly persisted to IndexedDB.
 */

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

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log('✅ PASS:', name);
      passed++;
    } catch (e) {
      console.error('❌ FAIL:', name);
      console.error('  ', e.message, e.stack?.split('\n')[1] || '');
      failed++;
    }
  }

  function assert(condition, msg) {
    if (!condition) throw new Error(msg);
  }

  await test('Protocol: bidirectional fact exchange via mock DataChannel', async () => {
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

    assert(resultA.sent === 3, `A should have sent 3 facts, got ${resultA.sent}`);
    assert(resultB.sent === 2, `B should have sent 2 facts, got ${resultB.sent}`);
    assert(resultA.received.length === 2, `A should have received 2 facts from B`);
    assert(resultB.received.length === 3, `B should have received 3 facts from A`);
  });

  await test('Merge: received facts applied to mock Dexie DB', async () => {
    const merge = new P2PMerge();
    const mockDB = createMockDB();

    const localFacts = [makeFact(), makeFact()];
    const remoteFacts = [makeFact(), makeFact(), makeFact()]; // 3 new facts

    const mergeResult = await merge.mergeFacts(localFacts, remoteFacts);
    assert(mergeResult.toAdd.length === 3, `Should add 3 facts, got ${mergeResult.toAdd.length}`);

    const applied = await merge.applyMerge(mergeResult, () => mockDB);
    assert(applied === 3, `Should apply 3 facts, got ${applied}`);

    const stored = mockDB.budgetFacts.getAll();
    assert(stored.length === 3, `DB should have 3 stored facts, got ${stored.length}`);
    assert(stored.every(f => f.sync_status === 'pending'), 'All stored facts should have sync_status=pending');
  });

  await test('Merge: no duplicate facts after applying same remote twice', async () => {
    const merge = new P2PMerge();
    const mockDB = createMockDB();

    const remoteFacts = [makeFact({ article_id: 99, amount: 5000, date: '2026-01-01', comment: 'test', record_type: 'fact' })];

    // First sync
    const r1 = await merge.mergeFacts([], remoteFacts);
    await merge.applyMerge(r1, () => mockDB);

    // Second sync with same fact (should be deduplicated)
    const stored = mockDB.budgetFacts.getAll();
    stored.forEach(f => { f.content_hash = f.content_hash; }); // already has hash from first merge

    // Re-compute content hash for the stored facts
    for (const f of stored) {
      f.content_hash = await merge.contentHash(f);
    }
    // Also compute for remote
    for (const f of remoteFacts) {
      f.content_hash = await merge.contentHash(f);
    }

    const r2 = await merge.mergeFacts(stored, remoteFacts);
    assert(r2.toAdd.length === 0, 'Second sync should add 0 facts (duplicate)');
    assert(r2.duplicates === 1, 'Should count 1 duplicate');
  });

  await test('Protocol: empty facts list handled gracefully', async () => {
    const { managerA, managerB } = createMockManagerPair();
    const protoA = new P2PSyncProtocol(managerA);
    const protoB = new P2PSyncProtocol(managerB);

    const [resultA, resultB] = await Promise.all([
      protoA.initiateSync([]),
      protoB.initiateSync([]),
    ]);

    assert(resultA.sent === 0, 'A sent 0 facts');
    assert(resultB.sent === 0, 'B sent 0 facts');
    assert(resultA.received.length === 0, 'A received 0 facts');
    assert(resultB.received.length === 0, 'B received 0 facts');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
