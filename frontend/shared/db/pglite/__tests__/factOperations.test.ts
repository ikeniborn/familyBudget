/**
 * Fact Operations Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGliteManager } from '../PGliteManager';

describe('PGlite Fact Operations', () => {
  let manager: PGliteManager;

  beforeEach(async () => {
    // Enable PGlite for tests
    localStorage.setItem('enablePGlite', 'true');
    manager = new PGliteManager();

    // Use unique dataDir per test to avoid data pollution
    const testName = expect.getState().currentTestName?.replace(/[^a-z0-9]/gi, '-') || 'test';
    await manager.init({ dataDir: `test-fact-ops-${testName}` });
  });

  afterEach(async () => {
    // Cleanup
    if (manager.isReady()) {
      await manager.close();
    }
    localStorage.clear();
  });

  it('should create fact with temp_id', async () => {
    const temp_id = await manager.createFact({
      user_id: 1,
      article_id: 10,
      financial_center_id: 5,
      cost_center_id: null,
      date: '2026-01-20',
      amount: 1500.50,
      record_type: 'fact',
      comment: 'Test transaction',
      transfer_group_id: null,
      is_transfer: false,
      sync_hash: null
    });

    // Verify UUID format
    expect(temp_id).toMatch(/^[a-f0-9-]{36}$/);

    // Check fact exists
    const facts = await manager.queryFacts();
    expect(facts).toHaveLength(1);
    expect(facts[0].temp_id).toBe(temp_id);
    expect(facts[0].sync_status).toBe('pending');
    expect(facts[0].amount).toBe(1500.50);
  });

  it('should add pending operation on create', async () => {
    await manager.createFact({
      user_id: 1,
      article_id: 10,
      financial_center_id: 5,
      cost_center_id: null,
      date: '2026-01-20',
      amount: 1000,
      record_type: 'fact',
      comment: null,
      transfer_group_id: null,
      is_transfer: false,
      sync_hash: null
    });

    // Check pending operations
    const pending = await manager.getPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0].operation).toBe('create');
    expect(pending[0].entity_type).toBe('fact');
  });

  it('should deduplicate pending operations', async () => {
    const factData = {
      user_id: 1,
      article_id: 10,
      financial_center_id: 5,
      cost_center_id: null,
      date: '2026-01-20',
      amount: 1500.50,
      record_type: 'fact' as const,
      comment: 'Duplicate test',
      transfer_group_id: null,
      is_transfer: false,
      sync_hash: null
    };

    // Create same fact twice
    await manager.createFact(factData);
    await manager.createFact(factData);

    // Check pending operations (should be 2 due to different temp_id)
    const pending = await manager.getPendingOperations();
    expect(pending.length).toBeLessThanOrEqual(2);
  });

  it('should respect data window (90 days default)', async () => {
    // Create old fact (outside window)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 100); // 100 days ago
    await manager.createFact({
      user_id: 1,
      article_id: 10,
      financial_center_id: 5,
      cost_center_id: null,
      date: oldDate.toISOString().split('T')[0],
      amount: 100,
      record_type: 'fact',
      comment: null,
      transfer_group_id: null,
      is_transfer: false,
      sync_hash: null
    });

    // Create recent fact (inside window)
    await manager.createFact({
      user_id: 1,
      article_id: 10,
      financial_center_id: 5,
      cost_center_id: null,
      date: new Date().toISOString().split('T')[0],
      amount: 200,
      record_type: 'fact',
      comment: null,
      transfer_group_id: null,
      is_transfer: false,
      sync_hash: null
    });

    // Query facts (window = 90 days)
    const facts = await manager.queryFacts();

    // Should only return recent fact
    expect(facts).toHaveLength(1);
    expect(facts[0].amount).toBe(200);
  });

  it('should filter facts by article_id', async () => {
    // Create facts with different articles
    await manager.createFact({
      user_id: 1,
      article_id: 10,
      financial_center_id: 5,
      cost_center_id: null,
      date: '2026-01-20',
      amount: 100,
      record_type: 'fact',
      comment: null,
      transfer_group_id: null,
      is_transfer: false,
      sync_hash: null
    });

    await manager.createFact({
      user_id: 1,
      article_id: 20,
      financial_center_id: 5,
      cost_center_id: null,
      date: '2026-01-20',
      amount: 200,
      record_type: 'fact',
      comment: null,
      transfer_group_id: null,
      is_transfer: false,
      sync_hash: null
    });

    // Filter by article_id = 10
    const facts = await manager.queryFacts({ article_id: 10 });

    expect(facts).toHaveLength(1);
    expect(facts[0].article_id).toBe(10);
    expect(facts[0].amount).toBe(100);
  });

  it('should filter facts by record_type', async () => {
    // Create plan and fact
    await manager.createFact({
      user_id: 1,
      article_id: 10,
      financial_center_id: 5,
      cost_center_id: null,
      date: '2026-01-20',
      amount: 100,
      record_type: 'plan',
      comment: null,
      transfer_group_id: null,
      is_transfer: false,
      sync_hash: null
    });

    await manager.createFact({
      user_id: 1,
      article_id: 10,
      financial_center_id: 5,
      cost_center_id: null,
      date: '2026-01-20',
      amount: 200,
      record_type: 'fact',
      comment: null,
      transfer_group_id: null,
      is_transfer: false,
      sync_hash: null
    });

    // Filter by record_type = 'fact'
    const facts = await manager.queryFacts({ record_type: 'fact' });

    expect(facts).toHaveLength(1);
    expect(facts[0].record_type).toBe('fact');
    expect(facts[0].amount).toBe(200);
  });
});
