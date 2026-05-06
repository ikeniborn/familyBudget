import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeDatabase } from '../../core/database';
import { FactRepository } from '../FactRepository';
import { resetTabId } from '../../utils/tabId';

const MY_TAB = 'tab-abc-123';
const OTHER_TAB = 'tab-xyz-789';

function mockSessionStorage(tabId: string) {
  sessionStorage.setItem('fb_tab_id', tabId);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
    key === 'fb_tab_id' ? tabId : null
  );
}

const baseServerFact = {
  id: 42,
  user_id: 1,
  article_id: 5,
  financial_center_id: 2,
  cost_center_id: null,
  record_type: 'expense' as const,
  amount: 500,
  currency: 'RUB',
  date: '2026-05-06',
  description: 'Test purchase',
  transfer_id: null,
  sync_hash: 'abc',
  created_at: '2026-05-06T10:00:00Z',
  updated_at: '2026-05-06T10:00:00Z',
};

describe('FactRepository', () => {
  let repo: FactRepository;

  beforeEach(async () => {
    resetTabId();
    const database = await initializeDatabase();
    await database.open();
    repo = new FactRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('upsertFromServer', () => {
    it('returns skipped when tab_origin_id matches own tab', async () => {
      mockSessionStorage(MY_TAB);
      const result = await repo.upsertFromServer({
        ...baseServerFact,
        tab_origin_id: MY_TAB,
      });
      expect(result).toBe('skipped');
    });

    it('returns created when fact does not exist in Dexie', async () => {
      mockSessionStorage(MY_TAB);
      const result = await repo.upsertFromServer({
        ...baseServerFact,
        tab_origin_id: OTHER_TAB,
      });
      expect(result).toBe('created');
    });

    it('returns updated when fact already exists by server id', async () => {
      mockSessionStorage(MY_TAB);
      // First create via API (simulates own tab write)
      await repo.createFromAPI({ ...baseServerFact, tab_origin_id: MY_TAB });

      // Now WS event arrives from other tab with changed fields (fact_updated scenario)
      const result = await repo.upsertFromServer({
        ...baseServerFact,
        amount: 600,
        description: 'Updated description',
        tab_origin_id: OTHER_TAB,
      });
      expect(result).toBe('updated');

      // Verify ALL changed fields applied (not just amount)
      const { db } = await import('../../core/database');
      const fact = await db.budgetFacts.where('id').equals(42).first();
      expect(fact?.amount).toBe(600);
      expect(fact?.comment).toBe('Updated description'); // mapped from description
    });

    it('propagates errors (no silent swallowing)', async () => {
      mockSessionStorage(MY_TAB);
      // Pass null id to trigger Dexie error during lookup
      await expect(
        repo.upsertFromServer({ ...baseServerFact, id: null as any, tab_origin_id: OTHER_TAB })
      ).rejects.toThrow();
    });
  });

  describe('createFromAPI', () => {
    it('stores fact with tab_origin_id set to current tab', async () => {
      mockSessionStorage(MY_TAB);
      const fact = await repo.createFromAPI({ ...baseServerFact });
      expect(fact.tab_origin_id).toBe(MY_TAB);
      expect(fact.sync_status).toBe('synced');
      expect(fact.id).toBe(42);
    });
  });

  describe('confirmPending', () => {
    it('atomically replaces temp_id with server_id', async () => {
      mockSessionStorage(MY_TAB);
      // Create an offline fact first
      const temp_id = await createTestPendingFact(repo);

      await repo.confirmPending(temp_id, 99);

      // Verify using low-level db (not repo) to check state
      const { db } = await import('../../core/database');
      const fact = await db.budgetFacts.where('temp_id').equals(temp_id).first();
      expect(fact?.id).toBe(99);
      expect(fact?.sync_status).toBe('synced');

      const pendingOps = await db.pendingOperations.where('temp_id').equals(temp_id).toArray();
      expect(pendingOps).toHaveLength(0);
    });
  });
});

async function createTestPendingFact(repo: FactRepository): Promise<string> {
  return repo.createOffline({
    user_id: 1,
    article_id: 5,
    financial_center_id: 2,
    cost_center_id: null,
    date: '2026-05-06',
    amount: 300,
    record_type: 'fact',
    comment: null,
    transfer_group_id: null,
    is_transfer: false,
    sync_hash: null,
  });
}
