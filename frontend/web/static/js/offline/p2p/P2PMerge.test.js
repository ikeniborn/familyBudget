/**
 * Unit tests for P2PMerge conflict resolution and deduplication.
 *
 * Run: node --experimental-vm-modules P2PMerge.test.js
 * Or via jest if configured.
 */

import { P2PMerge } from './P2PMerge.js';

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

async function runTests() {
  const merge = new P2PMerge();
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log('✅ PASS:', name);
      passed++;
    } catch (e) {
      console.error('❌ FAIL:', name);
      console.error('  ', e.message);
      failed++;
    }
  }

  function assert(condition, msg) {
    if (!condition) throw new Error('Assertion failed: ' + msg);
  }

  // ── contentHash tests ────────────────────────────────

  await test('contentHash produces consistent results for same fact', async () => {
    const fact = makeFact({ article_id: 42, amount: 9999, date: '2026-02-01', comment: 'coffee', record_type: 'fact' });
    const h1 = await merge.contentHash(fact);
    const h2 = await merge.contentHash(fact);
    assert(h1 === h2, 'Same fact should produce same hash');
    assert(h1.length === 32, 'Hash should be 32 chars');
  });

  await test('contentHash produces different results for different facts', async () => {
    const f1 = makeFact({ amount: 1000 });
    const f2 = makeFact({ amount: 2000 });
    const h1 = await merge.contentHash(f1);
    const h2 = await merge.contentHash(f2);
    assert(h1 !== h2, 'Different amounts should produce different hashes');
  });

  // ── resolveConflict tests ────────────────────────────

  await test('resolveConflict returns newer fact (fact2 newer)', () => {
    const older = makeFact({ updated_at: new Date('2026-01-01T09:00:00Z') });
    const newer = makeFact({ updated_at: new Date('2026-01-01T10:00:00Z') });
    const winner = merge.resolveConflict(older, newer);
    assert(winner === newer, 'Newer fact should win');
  });

  await test('resolveConflict returns newer fact (fact1 newer)', () => {
    const older = makeFact({ updated_at: new Date('2026-01-01T08:00:00Z') });
    const newer = makeFact({ updated_at: new Date('2026-01-01T12:00:00Z') });
    const winner = merge.resolveConflict(newer, older);
    assert(winner === newer, 'Newer fact should win when passed as first arg');
  });

  await test('resolveConflict returns fact1 when timestamps equal', () => {
    const ts = new Date('2026-01-15T10:00:00Z');
    const f1 = makeFact({ updated_at: ts });
    const f2 = makeFact({ updated_at: ts });
    const winner = merge.resolveConflict(f1, f2);
    assert(winner === f1, 'Should return fact1 when timestamps equal (>= semantics)');
  });

  // ── mergeFacts tests ─────────────────────────────────

  await test('mergeFacts: duplicate by content hash is skipped', async () => {
    const local = makeFact({ article_id: 1, amount: 100, date: '2026-01-01', comment: 'a', record_type: 'fact' });
    local.content_hash = await merge.contentHash(local);

    // Remote has same content but different temp_id
    const remote = makeFact({ article_id: 1, amount: 100, date: '2026-01-01', comment: 'a', record_type: 'fact' });
    remote.content_hash = local.content_hash;

    const result = await merge.mergeFacts([local], [remote]);
    assert(result.toAdd.length === 0, 'Duplicate should be skipped');
    assert(result.duplicates === 1, 'Should count 1 duplicate');
  });

  await test('mergeFacts: new fact from remote is added', async () => {
    const local = makeFact({ article_id: 10, amount: 5000 });
    const remote = makeFact({ article_id: 20, amount: 9999 }); // Different article

    const result = await merge.mergeFacts([local], [remote]);
    assert(result.toAdd.length === 1, 'New remote fact should be added');
    assert(result.toAdd[0].sync_status === 'pending', 'Added fact should be pending');
    assert(result.duplicates === 0, 'No duplicates');
  });

  await test('mergeFacts: conflict by temp_id resolved via LWW', async () => {
    const tempId = 'same-uuid-for-both';
    const localOlder = makeFact({
      temp_id: tempId,
      amount: 1000,
      updated_at: new Date('2026-01-01T09:00:00Z'),
    });
    const remoteNewer = makeFact({
      temp_id: tempId,
      amount: 2000,
      updated_at: new Date('2026-01-01T11:00:00Z'),
    });
    // Give different content hashes so it's not caught as duplicate
    localOlder.content_hash = await merge.contentHash(localOlder);
    remoteNewer.content_hash = await merge.contentHash(remoteNewer);

    const result = await merge.mergeFacts([localOlder], [remoteNewer]);
    assert(result.conflicts === 1, 'Should detect 1 conflict');
    // Remote is newer → should be in toAdd
    assert(result.toAdd.length === 1, 'Remote (newer) fact should be added');
    assert(result.toAdd[0].amount === 2000, 'Winner should be remote (newer) with amount=2000');
  });

  await test('mergeFacts: conflict by temp_id — local wins when newer', async () => {
    const tempId = 'conflict-local-wins';
    const localNewer = makeFact({
      temp_id: tempId,
      amount: 3000,
      updated_at: new Date('2026-01-01T15:00:00Z'),
    });
    const remoteOlder = makeFact({
      temp_id: tempId,
      amount: 1000,
      updated_at: new Date('2026-01-01T08:00:00Z'),
    });
    localNewer.content_hash = await merge.contentHash(localNewer);
    remoteOlder.content_hash = await merge.contentHash(remoteOlder);

    const result = await merge.mergeFacts([localNewer], [remoteOlder]);
    assert(result.conflicts === 1, 'Should detect 1 conflict');
    assert(result.toAdd.length === 0, 'Local wins → nothing to add from remote');
  });

  await test('mergeFacts: empty remote returns empty result', async () => {
    const local = makeFact();
    const result = await merge.mergeFacts([local], []);
    assert(result.toAdd.length === 0, 'No facts to add from empty remote');
    assert(result.duplicates === 0, 'No duplicates');
    assert(result.conflicts === 0, 'No conflicts');
  });

  await test('mergeFacts: multiple new facts all added', async () => {
    const localFacts = [makeFact({ article_id: 1 })];
    const remoteFacts = [
      makeFact({ article_id: 2, amount: 100 }),
      makeFact({ article_id: 3, amount: 200 }),
      makeFact({ article_id: 4, amount: 300 }),
    ];
    const result = await merge.mergeFacts(localFacts, remoteFacts);
    assert(result.toAdd.length === 3, 'All 3 new remote facts should be added');
  });

  // ── Summary ─────────────────────────────────────────

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
