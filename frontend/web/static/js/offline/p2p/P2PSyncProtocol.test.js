/**
 * Unit tests for P2PSyncProtocol message chunking and reconstruction.
 */

import { P2PSyncProtocol, MSG_TYPES } from './P2PSyncProtocol.js';

// Mock P2PManager
function makeMockManager() {
  const sent = [];
  return {
    state: 'connected',
    onMessage: null,
    send(data) { sent.push(data); },
    getSent() { return sent; },
  };
}

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
      console.error('  ', e.message);
      failed++;
    }
  }

  function assert(condition, msg) {
    if (!condition) throw new Error('Assertion failed: ' + msg);
  }

  const CHUNK_SIZE = 10 * 1024;

  // ── chunkMessage tests ───────────────────────────────

  await test('chunkMessage: small string produces 1 chunk', () => {
    const manager = makeMockManager();
    const proto = new P2PSyncProtocol(manager);
    const small = 'x'.repeat(100);
    const chunks = proto.chunkMessage(small, 'tid1');
    assert(chunks.length === 1, 'Small string should produce 1 chunk');
    const parsed = JSON.parse(chunks[0]);
    assert(parsed.type === MSG_TYPES.FACT_CHUNK, 'Type should be fact_chunk');
    assert(parsed.seq === 0, 'Seq should be 0');
    assert(parsed.total === 1, 'Total should be 1');
    assert(parsed.id === 'tid1', 'Transfer ID should match');
  });

  await test('chunkMessage: large string produces multiple chunks', () => {
    const manager = makeMockManager();
    const proto = new P2PSyncProtocol(manager);
    const large = 'a'.repeat(CHUNK_SIZE * 2.5); // 25KB → 3 chunks
    const chunks = proto.chunkMessage(large, 'tid2');
    assert(chunks.length === 3, 'Should produce 3 chunks');
    chunks.forEach((c, i) => {
      const p = JSON.parse(c);
      assert(p.seq === i, `Chunk ${i} seq should be ${i}`);
      assert(p.total === 3, 'Total should be 3');
    });
  });

  // ── addChunk tests ────────────────────────────────────

  await test('addChunk: single chunk returns data immediately', () => {
    const manager = makeMockManager();
    const proto = new P2PSyncProtocol(manager);
    const chunks = proto.chunkMessage('hello world', 'tid3');
    const parsed = JSON.parse(chunks[0]);
    const result = proto.addChunk(parsed);
    assert(result === 'hello world', 'Should return original string');
  });

  await test('addChunk: multiple chunks reconstructed in order', () => {
    const manager = makeMockManager();
    const proto = new P2PSyncProtocol(manager);
    const original = 'b'.repeat(CHUNK_SIZE * 2 + 500);
    const chunks = proto.chunkMessage(original, 'tid4');
    assert(chunks.length === 3, 'Should be 3 chunks');

    // Add out of order: 2, 0, 1
    const r0 = proto.addChunk(JSON.parse(chunks[2])); // seq=2
    assert(r0 === null, 'Should return null after chunk 2');
    const r1 = proto.addChunk(JSON.parse(chunks[0])); // seq=0
    assert(r1 === null, 'Should return null after chunk 0');
    const r2 = proto.addChunk(JSON.parse(chunks[1])); // seq=1
    assert(r2 === original, 'Should reconstruct full string after chunk 1');
  });

  await test('addChunk: duplicate chunk ignored', () => {
    const manager = makeMockManager();
    const proto = new P2PSyncProtocol(manager);
    const data = 'test'.repeat(3000); // ~12KB → 2 chunks
    const chunks = proto.chunkMessage(data, 'tid5');
    const r1 = proto.addChunk(JSON.parse(chunks[0]));
    proto.addChunk(JSON.parse(chunks[0])); // duplicate
    const r2 = proto.addChunk(JSON.parse(chunks[1]));
    assert(r2 === data, 'Should reconstruct correctly despite duplicate');
  });

  // ── serializeFact / deserializeFact tests ────────────

  await test('serializeFact → deserializeFact round-trip', () => {
    const manager = makeMockManager();
    const proto = new P2PSyncProtocol(manager);
    const original = {
      temp_id: 'abc-123',
      user_id: 5,
      article_id: 42,
      financial_center_id: 1,
      cost_center_id: null,
      date: '2026-02-20',
      amount: 12345,
      record_type: 'fact',
      comment: 'test comment',
      transfer_group_id: null,
      is_transfer: false,
      sync_status: 'pending',
      content_hash: 'aabbcc',
      created_at: new Date('2026-02-20T08:00:00Z'),
      updated_at: new Date('2026-02-20T09:00:00Z'),
    };
    const serialized = proto.serializeFact(original);
    assert(serialized.temp_id === 'abc-123', 'temp_id preserved');
    assert(serialized.amount === 12345, 'amount preserved');
    assert(typeof serialized.created_at === 'string', 'Date serialized to string');

    const deserialized = proto.deserializeFact(serialized);
    assert(deserialized.id === null, 'id should be null after deserialize');
    assert(deserialized.sync_status === 'pending', 'sync_status should be pending');
    assert(deserialized.created_at instanceof Date, 'created_at should be Date');
  });

  // ── Summary ─────────────────────────────────────────
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
