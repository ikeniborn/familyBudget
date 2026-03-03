/**
 * Unit tests for P2PSyncProtocol message chunking and reconstruction.
 */

import { describe, it, expect } from 'vitest';
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

const CHUNK_SIZE = 10 * 1024;

describe('P2PSyncProtocol', () => {
  describe('chunkMessage', () => {
    it('small string produces 1 chunk', () => {
      const manager = makeMockManager();
      const proto = new P2PSyncProtocol(manager);
      const small = 'x'.repeat(100);
      const chunks = proto.chunkMessage(small, 'tid1');
      expect(chunks.length).toBe(1);
      const parsed = JSON.parse(chunks[0]);
      expect(parsed.type).toBe(MSG_TYPES.FACT_CHUNK);
      expect(parsed.seq).toBe(0);
      expect(parsed.total).toBe(1);
      expect(parsed.id).toBe('tid1');
    });

    it('large string produces multiple chunks', () => {
      const manager = makeMockManager();
      const proto = new P2PSyncProtocol(manager);
      const large = 'a'.repeat(CHUNK_SIZE * 2.5); // 25KB → 3 chunks
      const chunks = proto.chunkMessage(large, 'tid2');
      expect(chunks.length).toBe(3);
      chunks.forEach((c, i) => {
        const p = JSON.parse(c);
        expect(p.seq).toBe(i);
        expect(p.total).toBe(3);
      });
    });
  });

  describe('addChunk', () => {
    it('single chunk returns data immediately', () => {
      const manager = makeMockManager();
      const proto = new P2PSyncProtocol(manager);
      const chunks = proto.chunkMessage('hello world', 'tid3');
      const parsed = JSON.parse(chunks[0]);
      const result = proto.addChunk(parsed);
      expect(result).toBe('hello world');
    });

    it('multiple chunks reconstructed in order', () => {
      const manager = makeMockManager();
      const proto = new P2PSyncProtocol(manager);
      const original = 'b'.repeat(CHUNK_SIZE * 2 + 500);
      const chunks = proto.chunkMessage(original, 'tid4');
      expect(chunks.length).toBe(3);

      // Add out of order: 2, 0, 1
      expect(proto.addChunk(JSON.parse(chunks[2]))).toBeNull(); // seq=2
      expect(proto.addChunk(JSON.parse(chunks[0]))).toBeNull(); // seq=0
      expect(proto.addChunk(JSON.parse(chunks[1]))).toBe(original); // seq=1 → complete
    });

    it('duplicate chunk ignored', () => {
      const manager = makeMockManager();
      const proto = new P2PSyncProtocol(manager);
      const data = 'test'.repeat(3000); // ~12KB → 2 chunks
      const chunks = proto.chunkMessage(data, 'tid5');
      proto.addChunk(JSON.parse(chunks[0]));
      proto.addChunk(JSON.parse(chunks[0])); // duplicate
      expect(proto.addChunk(JSON.parse(chunks[1]))).toBe(data);
    });
  });

  describe('serializeFact / deserializeFact', () => {
    it('round-trip preserves all fields', () => {
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
      expect(serialized.temp_id).toBe('abc-123');
      expect(serialized.amount).toBe(12345);
      expect(typeof serialized.created_at).toBe('string');

      const deserialized = proto.deserializeFact(serialized);
      expect(deserialized.id).toBeNull();
      expect(deserialized.sync_status).toBe('pending');
      expect(deserialized.created_at).toBeInstanceOf(Date);
    });
  });
});
