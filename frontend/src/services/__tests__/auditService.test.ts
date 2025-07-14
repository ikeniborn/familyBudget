import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  auditService,
  AuditLog,
  DeletedRecord,
  ChangeApproval,
  AuditFilters,
  AuditReport
} from '../auditService';

// Mock BroadcastChannel
class BroadcastChannelMock {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  constructor(name: string) {
    this.name = name;
  }
  
  postMessage = jest.fn();
  close = jest.fn();
  
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  dispatchEvent = jest.fn();
}

global.BroadcastChannel = BroadcastChannelMock as any;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Reset audit service state
    auditService.clearAuditLogs();
  });

  describe('logChange', () => {
    it('should log a create action', async () => {
      const result = await auditService.logChange(
        'periods',
        1,
        'CREATE',
        1,
        undefined,
        { period_name: 'Jan 2024' },
        {
          ip_address: '127.0.0.1',
          user_agent: 'Test Browser'
        }
      );
      
      expect(result).toMatchObject({
        entity_type: 'periods',
        entity_id: 1,
        action: 'CREATE',
        user_id: 1,
        new_values: { period_name: 'Jan 2024' },
        metadata: {
          ip_address: '127.0.0.1',
          user_agent: 'Test Browser'
        }
      });
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should log an update action with changes', async () => {
      const oldValues = { period_name: 'Jan 2024', is_active: true };
      const newValues = { period_name: 'January 2024', is_active: false };
      
      const result = await auditService.logChange(
        'periods',
        1,
        'UPDATE',
        1,
        oldValues,
        newValues
      );
      
      expect(result.changes).toHaveLength(2);
      expect(result.changes).toContainEqual({
        field: 'period_name',
        old_value: 'Jan 2024',
        new_value: 'January 2024',
        change_type: 'modified'
      });
      expect(result.changes).toContainEqual({
        field: 'is_active',
        old_value: true,
        new_value: false,
        change_type: 'modified'
      });
    });

    it('should log a delete action', async () => {
      const result = await auditService.logChange(
        'periods',
        1,
        'DELETE',
        1,
        { period_name: 'Jan 2024' }
      );
      
      expect(result.action).toBe('DELETE');
      expect(result.old_values).toEqual({ period_name: 'Jan 2024' });
    });

    it('should generate description for actions', async () => {
      const result = await auditService.logChange(
        'periods',
        1,
        'CREATE',
        1,
        undefined,
        { period_name: 'Jan 2024' }
      );
      
      expect(result.description).toContain('Создан periods #1');
    });

    it('should broadcast audit log', async () => {
      await auditService.logChange('periods', 1, 'CREATE', 1);
      
      expect(BroadcastChannelMock.prototype.postMessage).toHaveBeenCalledWith({
        type: 'AUDIT_LOG_ADDED',
        log: expect.objectContaining({
          entity_type: 'periods',
          action: 'CREATE'
        })
      });
    });
  });

  describe('getAuditLogs', () => {
    beforeEach(async () => {
      // Create some test logs
      await auditService.logChange('periods', 1, 'CREATE', 1);
      await auditService.logChange('periods', 1, 'UPDATE', 1);
      await auditService.logChange('financial_centers', 2, 'CREATE', 2);
    });

    it('should get all audit logs', async () => {
      const result = await auditService.getAuditLogs({});
      
      expect(result.logs).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by entity type', async () => {
      const result = await auditService.getAuditLogs({
        entityTypes: ['periods']
      });
      
      expect(result.logs).toHaveLength(2);
      expect(result.logs.every(log => log.entity_type === 'periods')).toBe(true);
    });

    it('should filter by action', async () => {
      const result = await auditService.getAuditLogs({
        actions: ['CREATE']
      });
      
      expect(result.logs).toHaveLength(2);
      expect(result.logs.every(log => log.action === 'CREATE')).toBe(true);
    });

    it('should filter by user', async () => {
      const result = await auditService.getAuditLogs({
        userIds: [1]
      });
      
      expect(result.logs).toHaveLength(2);
    });

    it('should search in logs', async () => {
      await auditService.logChange(
        'periods',
        3,
        'CREATE',
        1,
        undefined,
        { period_name: 'Special Period' }
      );
      
      const result = await auditService.getAuditLogs({
        searchTerm: 'Special'
      });
      
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].new_values.period_name).toBe('Special Period');
    });

    it('should apply pagination', async () => {
      const result = await auditService.getAuditLogs({
        limit: 2,
        offset: 1
      });
      
      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(3);
    });
  });

  describe('getEntityHistory', () => {
    it('should get history for specific entity', async () => {
      await auditService.logChange('periods', 1, 'CREATE', 1);
      await auditService.logChange('periods', 1, 'UPDATE', 1);
      await auditService.logChange('periods', 2, 'CREATE', 1);
      
      const history = await auditService.getEntityHistory('periods', 1);
      
      expect(history).toHaveLength(2);
      expect(history.every(log => log.entity_id === 1)).toBe(true);
    });

    it('should return history in chronological order', async () => {
      await auditService.logChange('periods', 1, 'CREATE', 1);
      await new Promise(resolve => setTimeout(resolve, 10));
      await auditService.logChange('periods', 1, 'UPDATE', 1);
      
      const history = await auditService.getEntityHistory('periods', 1);
      
      expect(history[0].action).toBe('CREATE');
      expect(history[1].action).toBe('UPDATE');
    });
  });

  describe('trackDeletion', () => {
    it('should track deleted record', async () => {
      const entityData = {
        period_id: 1,
        period_name: 'Jan 2024',
        is_active: true
      };
      
      const result = await auditService.trackDeletion(
        'periods',
        1,
        entityData,
        1,
        'No longer needed'
      );
      
      expect(result).toMatchObject({
        entity_type: 'periods',
        entity_id: 1,
        entity_data: entityData,
        deleted_by: 1,
        deletion_reason: 'No longer needed',
        can_restore: true
      });
      expect(result.id).toBeDefined();
      expect(result.deleted_at).toBeDefined();
    });

    it('should persist deleted records', async () => {
      await auditService.trackDeletion('periods', 1, {}, 1);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'audit_deleted_records',
        expect.any(String)
      );
    });
  });

  describe('getDeletedRecords', () => {
    beforeEach(async () => {
      await auditService.trackDeletion('periods', 1, { name: 'Test 1' }, 1);
      await auditService.trackDeletion('periods', 2, { name: 'Test 2' }, 1);
      await auditService.trackDeletion('financial_centers', 3, { name: 'Test 3' }, 1);
    });

    it('should get all deleted records', async () => {
      const records = await auditService.getDeletedRecords();
      
      expect(records).toHaveLength(3);
    });

    it('should filter by entity type', async () => {
      const records = await auditService.getDeletedRecords('periods');
      
      expect(records).toHaveLength(2);
      expect(records.every(r => r.entity_type === 'periods')).toBe(true);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const records = await auditService.getDeletedRecords(
        undefined,
        yesterday.toISOString(),
        tomorrow.toISOString()
      );
      
      expect(records).toHaveLength(3);
    });
  });

  describe('restoreDeletedRecord', () => {
    it('should restore deleted record', async () => {
      const deletedRecord = await auditService.trackDeletion(
        'periods',
        1,
        { period_name: 'Jan 2024' },
        1
      );
      
      const result = await auditService.restoreDeletedRecord(
        deletedRecord.id,
        1
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ period_name: 'Jan 2024' });
      
      // Check if removed from deleted records
      const remaining = await auditService.getDeletedRecords();
      expect(remaining).toHaveLength(0);
    });

    it('should log restore action', async () => {
      const deletedRecord = await auditService.trackDeletion(
        'periods',
        1,
        { period_name: 'Jan 2024' },
        1
      );
      
      await auditService.restoreDeletedRecord(deletedRecord.id, 1);
      
      const logs = await auditService.getAuditLogs({
        actions: ['RESTORE']
      });
      
      expect(logs.logs).toHaveLength(1);
      expect(logs.logs[0].entity_id).toBe(1);
    });

    it('should fail if record not found', async () => {
      await expect(
        auditService.restoreDeletedRecord('non-existent', 1)
      ).rejects.toThrow('Deleted record not found');
    });

    it('should fail if not restorable', async () => {
      const deletedRecord = await auditService.trackDeletion(
        'periods',
        1,
        { period_name: 'Jan 2024' },
        1
      );
      
      // Mark as not restorable
      const records = await auditService.getDeletedRecords();
      records[0].can_restore = false;
      localStorageMock.setItem.mockClear();
      localStorageMock.getItem.mockReturnValue(JSON.stringify(records));
      
      await expect(
        auditService.restoreDeletedRecord(deletedRecord.id, 1)
      ).rejects.toThrow('Record cannot be restored');
    });
  });

  describe('createChangeApproval', () => {
    it('should create change approval request', async () => {
      const proposedChanges = {
        budget_limit: 100000
      };
      
      const result = await auditService.createChangeApproval(
        'cost_centers',
        1,
        'UPDATE',
        proposedChanges,
        1,
        'Increase budget limit',
        [2, 3] // Approvers
      );
      
      expect(result).toMatchObject({
        entity_type: 'cost_centers',
        entity_id: 1,
        action: 'UPDATE',
        proposed_changes: proposedChanges,
        requested_by: 1,
        reason: 'Increase budget limit',
        required_approvers: [2, 3],
        status: 'PENDING'
      });
      expect(result.expires_at).toBeDefined();
    });

    it('should set expiration date', async () => {
      const result = await auditService.createChangeApproval(
        'cost_centers',
        1,
        'UPDATE',
        {},
        1,
        '',
        [],
        7 // 7 days
      );
      
      const expirationDate = new Date(result.expires_at);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 7);
      
      expect(expirationDate.getDate()).toBe(expectedDate.getDate());
    });
  });

  describe('reviewChangeApproval', () => {
    let approvalId: string;
    
    beforeEach(async () => {
      const approval = await auditService.createChangeApproval(
        'cost_centers',
        1,
        'UPDATE',
        { budget_limit: 100000 },
        1,
        'Test',
        [2, 3]
      );
      approvalId = approval.id;
    });

    it('should approve change request', async () => {
      const result = await auditService.reviewChangeApproval(
        approvalId,
        'APPROVED',
        2,
        'Looks good'
      );
      
      expect(result).toMatchObject({
        status: 'APPROVED',
        reviewed_by: 2,
        review_comments: 'Looks good'
      });
      expect(result.reviewed_at).toBeDefined();
    });

    it('should reject change request', async () => {
      const result = await auditService.reviewChangeApproval(
        approvalId,
        'REJECTED',
        2,
        'Too high'
      );
      
      expect(result.status).toBe('REJECTED');
    });

    it('should fail if already reviewed', async () => {
      await auditService.reviewChangeApproval(approvalId, 'APPROVED', 2);
      
      await expect(
        auditService.reviewChangeApproval(approvalId, 'APPROVED', 3)
      ).rejects.toThrow('Approval request is not pending');
    });
  });

  describe('getPendingApprovals', () => {
    beforeEach(async () => {
      await auditService.createChangeApproval(
        'cost_centers',
        1,
        'UPDATE',
        {},
        1,
        'Test 1',
        [2]
      );
      await auditService.createChangeApproval(
        'cost_centers',
        2,
        'UPDATE',
        {},
        1,
        'Test 2',
        [3]
      );
      await auditService.createChangeApproval(
        'cost_centers',
        3,
        'UPDATE',
        {},
        1,
        'Test 3',
        [2, 3]
      );
    });

    it('should get pending approvals for user', async () => {
      const approvals = await auditService.getPendingApprovals(2);
      
      expect(approvals).toHaveLength(2);
    });

    it('should not include expired approvals', async () => {
      // Create an expired approval
      const expiredApproval = await auditService.createChangeApproval(
        'cost_centers',
        4,
        'UPDATE',
        {},
        1,
        'Expired',
        [2],
        -1 // Expire immediately
      );
      
      const approvals = await auditService.getPendingApprovals(2);
      
      expect(approvals.find(a => a.id === expiredApproval.id)).toBeUndefined();
    });
  });

  describe('generateAuditReport', () => {
    beforeEach(async () => {
      // Create various audit logs
      await auditService.logChange('periods', 1, 'CREATE', 1);
      await auditService.logChange('periods', 1, 'UPDATE', 1);
      await auditService.logChange('periods', 1, 'DELETE', 2);
      await auditService.logChange('financial_centers', 1, 'CREATE', 1);
    });

    it('should generate audit report', async () => {
      const report = await auditService.generateAuditReport({});
      
      expect(report).toMatchObject({
        total_changes: 4,
        changes_by_action: {
          CREATE: 2,
          UPDATE: 1,
          DELETE: 1
        },
        changes_by_entity: {
          periods: 3,
          financial_centers: 1
        },
        changes_by_user: {
          '1': 3,
          '2': 1
        }
      });
      expect(report.generated_at).toBeDefined();
    });

    it('should filter report by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const report = await auditService.generateAuditReport({
        dateFrom: yesterday.toISOString()
      });
      
      expect(report.total_changes).toBe(4);
    });
  });

  describe('exportAuditLogs', () => {
    beforeEach(async () => {
      await auditService.logChange(
        'periods',
        1,
        'CREATE',
        1,
        undefined,
        { period_name: 'Jan 2024' }
      );
    });

    it('should export to CSV format', async () => {
      const blob = await auditService.exportAuditLogs({}, 'csv');
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv');
      
      const text = await blob.text();
      expect(text).toContain('timestamp');
      expect(text).toContain('entity_type');
      expect(text).toContain('periods');
    });

    it('should export to JSON format', async () => {
      const blob = await auditService.exportAuditLogs({}, 'json');
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
      
      const text = await blob.text();
      const data = JSON.parse(text);
      
      expect(data).toHaveLength(1);
      expect(data[0].entity_type).toBe('periods');
    });
  });

  describe('Real-time synchronization', () => {
    it('should sync audit logs across instances', async () => {
      const channel = new BroadcastChannel('audit_sync');
      
      await auditService.logChange('periods', 1, 'CREATE', 1);
      
      expect(BroadcastChannelMock.prototype.postMessage).toHaveBeenCalledWith({
        type: 'AUDIT_LOG_ADDED',
        log: expect.objectContaining({
          entity_type: 'periods'
        })
      });
    });
  });

  describe('detectChanges', () => {
    it('should detect field changes', () => {
      const oldValues = {
        name: 'Old Name',
        value: 100,
        active: true,
        tags: ['tag1', 'tag2']
      };
      
      const newValues = {
        name: 'New Name',
        value: 100,
        active: false,
        tags: ['tag1', 'tag3']
      };
      
      const changes = auditService.detectChanges(oldValues, newValues);
      
      expect(changes).toHaveLength(3);
      expect(changes).toContainEqual({
        field: 'name',
        old_value: 'Old Name',
        new_value: 'New Name',
        change_type: 'modified'
      });
      expect(changes).toContainEqual({
        field: 'active',
        old_value: true,
        new_value: false,
        change_type: 'modified'
      });
    });

    it('should detect added fields', () => {
      const oldValues = { name: 'Test' };
      const newValues = { name: 'Test', description: 'New field' };
      
      const changes = auditService.detectChanges(oldValues, newValues);
      
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        field: 'description',
        new_value: 'New field',
        change_type: 'added'
      });
    });

    it('should detect removed fields', () => {
      const oldValues = { name: 'Test', description: 'Will be removed' };
      const newValues = { name: 'Test' };
      
      const changes = auditService.detectChanges(oldValues, newValues);
      
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        field: 'description',
        old_value: 'Will be removed',
        change_type: 'removed'
      });
    });
  });
});