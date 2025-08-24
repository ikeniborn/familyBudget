import { toastStore } from '../stores/toast.store';

// Types for audit system
export interface AuditLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE';
  user_id: number;
  user_name?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  changes?: FieldChange[];
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  timestamp: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface FieldChange {
  field: string;
  field_label?: string;
  old_value: any;
  new_value: any;
  change_type: 'added' | 'modified' | 'removed';
}

export interface DeletedRecord {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_data: Record<string, any>;
  deleted_by: number;
  deleted_at: string;
  deletion_reason?: string;
  can_restore: boolean;
  restored_at?: string;
  restored_by?: number;
}

export interface AuditReport {
  id: number;
  report_name: string;
  entity_types: string[];
  date_from: string;
  date_to: string;
  user_ids?: number[];
  actions?: string[];
  generated_by: number;
  generated_at: string;
  records_count: number;
  file_path?: string;
}

export interface ChangeApproval {
  id: number;
  entity_type: string;
  entity_id: number;
  proposed_changes: Record<string, any>;
  requested_by: number;
  requested_at: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  reviewed_by?: number;
  reviewed_at?: string;
  review_comments?: string;
  approval_deadline?: string;
  auto_approve?: boolean;
}

export interface AuditFilters {
  entityTypes?: string[];
  actions?: string[];
  userIds?: number[];
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

// Audit Service Class
class AuditService {
  // Log a change
  async logChange(
    entityType: string,
    entityId: number,
    action: AuditLog['action'],
    userId: number,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<AuditLog> {
    try {
      // Calculate field changes
      const changes = this.calculateFieldChanges(oldValues, newValues);
      
      // Get client information
      const clientInfo = this.getClientInfo();
      
      const auditLog: Omit<AuditLog, 'id' | 'timestamp'> = {
        entity_type: entityType,
        entity_id: entityId,
        action,
        user_id: userId,
        old_values: oldValues,
        new_values: newValues,
        changes,
        description,
        metadata,
        ...clientInfo
      };

      // In a real implementation, this would send to the backend
      // For now, store in localStorage for demo purposes
      const response = await this.storeAuditLog(auditLog);
      
      return response;
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      throw error;
    }
  }

  // Get audit history for an entity
  async getEntityHistory(
    entityType: string,
    entityId: number,
    limit = 50
  ): Promise<AuditLog[]> {
    try {
      // In a real implementation, this would be an API call
      const allLogs = this.getStoredAuditLogs();
      
      return allLogs
        .filter(log => log.entity_type === entityType && log.entity_id === entityId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get entity history:', error);
      return [];
    }
  }

  // Get audit logs with filters
  async getAuditLogs(filters: AuditFilters = {}): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    try {
      const {
        entityTypes = [],
        actions = [],
        userIds = [],
        dateFrom,
        dateTo,
        searchTerm,
        limit = 100,
        offset = 0
      } = filters;

      let logs = this.getStoredAuditLogs();

      // Apply filters
      if (entityTypes.length > 0) {
        logs = logs.filter(log => entityTypes.includes(log.entity_type));
      }

      if (actions.length > 0) {
        logs = logs.filter(log => actions.includes(log.action));
      }

      if (userIds.length > 0) {
        logs = logs.filter(log => userIds.includes(log.user_id));
      }

      if (dateFrom) {
        logs = logs.filter(log => new Date(log.timestamp) >= new Date(dateFrom));
      }

      if (dateTo) {
        logs = logs.filter(log => new Date(log.timestamp) <= new Date(dateTo));
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        logs = logs.filter(log => 
          log.description?.toLowerCase().includes(term) ||
          JSON.stringify(log.new_values).toLowerCase().includes(term) ||
          JSON.stringify(log.old_values).toLowerCase().includes(term)
        );
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = logs.length;
      const paginatedLogs = logs.slice(offset, offset + limit);

      return { logs: paginatedLogs, total };
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return { logs: [], total: 0 };
    }
  }

  // Store deleted record for potential restoration
  async storeDeletedRecord(
    entityType: string,
    entityId: number,
    entityData: Record<string, any>,
    userId: number,
    reason?: string
  ): Promise<DeletedRecord> {
    try {
      const deletedRecord: Omit<DeletedRecord, 'id'> = {
        entity_type: entityType,
        entity_id: entityId,
        entity_data: entityData,
        deleted_by: userId,
        deleted_at: new Date().toISOString(),
        deletion_reason: reason,
        can_restore: true
      };

      // Store in localStorage for demo
      const stored = this.storeDeletedRecordInternal(deletedRecord);
      
      // Also create audit log
      await this.logChange(
        entityType,
        entityId,
        'DELETE',
        userId,
        entityData,
        undefined,
        reason ? `Удалено: ${reason}` : 'Запись удалена'
      );

      return stored;
    } catch (error) {
      console.error('Failed to store deleted record:', error);
      throw error;
    }
  }

  // Get deleted records that can be restored
  async getDeletedRecords(entityType?: string): Promise<DeletedRecord[]> {
    try {
      const key = 'audit_deleted_records';
      const stored = localStorage.getItem(key);
      let records: DeletedRecord[] = stored ? JSON.parse(stored) : [];

      if (entityType) {
        records = records.filter(r => r.entity_type === entityType);
      }

      // Only return records that can still be restored
      records = records.filter(r => r.can_restore && !r.restored_at);

      return records.sort((a, b) => 
        new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
      );
    } catch (error) {
      console.error('Failed to get deleted records:', error);
      return [];
    }
  }

  // Restore a deleted record
  async restoreDeletedRecord(
    deletedRecordId: number,
    userId: number
  ): Promise<{ success: boolean; restoredData?: Record<string, any> }> {
    try {
      const key = 'audit_deleted_records';
      const stored = localStorage.getItem(key);
      const records: DeletedRecord[] = stored ? JSON.parse(stored) : [];

      const recordIndex = records.findIndex(r => r.id === deletedRecordId);
      if (recordIndex === -1) {
        throw new Error('Удаленная запись не найдена');
      }

      const record = records[recordIndex];
      if (!record.can_restore || record.restored_at) {
        throw new Error('Запись не может быть восстановлена');
      }

      // Mark as restored
      records[recordIndex] = {
        ...record,
        restored_at: new Date().toISOString(),
        restored_by: userId,
        can_restore: false
      };

      localStorage.setItem(key, JSON.stringify(records));

      // Log the restoration
      await this.logChange(
        record.entity_type,
        record.entity_id,
        'RESTORE',
        userId,
        undefined,
        record.entity_data,
        'Запись восстановлена из корзины'
      );

      return { success: true, restoredData: record.entity_data };
    } catch (error) {
      console.error('Failed to restore deleted record:', error);
      return { success: false };
    }
  }

  // Generate audit report
  async generateAuditReport(
    reportName: string,
    filters: AuditFilters,
    userId: number
  ): Promise<AuditReport> {
    try {
      const { logs, total } = await this.getAuditLogs({
        ...filters,
        limit: 10000 // Get all records for report
      });

      const report: Omit<AuditReport, 'id'> = {
        report_name: reportName,
        entity_types: filters.entityTypes || [],
        date_from: filters.dateFrom || '',
        date_to: filters.dateTo || '',
        user_ids: filters.userIds,
        actions: filters.actions,
        generated_by: userId,
        generated_at: new Date().toISOString(),
        records_count: total
      };

      // Store report metadata
      const storedReport = this.storeAuditReport(report, logs);

      toastStore.success(
        'Отчет сгенерирован',
        `Отчет "${reportName}" содержит ${total} записей`
      );

      return storedReport;
    } catch (error) {
      console.error('Failed to generate audit report:', error);
      throw error;
    }
  }

  // Request change approval
  async requestChangeApproval(
    entityType: string,
    entityId: number,
    proposedChanges: Record<string, any>,
    userId: number,
    autoApprove = false,
    deadline?: string
  ): Promise<ChangeApproval> {
    try {
      const approval: Omit<ChangeApproval, 'id'> = {
        entity_type: entityType,
        entity_id: entityId,
        proposed_changes: proposedChanges,
        requested_by: userId,
        requested_at: new Date().toISOString(),
        status: 'PENDING',
        approval_deadline: deadline,
        auto_approve: autoApprove
      };

      const stored = this.storeChangeApproval(approval);

      if (autoApprove) {
        // Auto-approve for demonstration
        setTimeout(() => {
          this.reviewChangeApproval(stored.id, 'APPROVED', userId, 'Автоматическое одобрение');
        }, 1000);
      }

      return stored;
    } catch (error) {
      console.error('Failed to request change approval:', error);
      throw error;
    }
  }

  // Review change approval
  async reviewChangeApproval(
    approvalId: number,
    status: 'APPROVED' | 'REJECTED',
    reviewerId: number,
    comments?: string
  ): Promise<ChangeApproval> {
    try {
      const key = 'audit_change_approvals';
      const stored = localStorage.getItem(key);
      const approvals: ChangeApproval[] = stored ? JSON.parse(stored) : [];

      const approvalIndex = approvals.findIndex(a => a.id === approvalId);
      if (approvalIndex === -1) {
        throw new Error('Запрос на изменение не найден');
      }

      const approval = approvals[approvalIndex];
      if (approval.status !== 'PENDING') {
        throw new Error('Запрос уже обработан');
      }

      // Update approval
      approvals[approvalIndex] = {
        ...approval,
        status,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_comments: comments
      };

      localStorage.setItem(key, JSON.stringify(approvals));

      // Log the approval decision
      await this.logChange(
        'change_approval',
        approvalId,
        status === 'APPROVED' ? 'UPDATE' : 'DELETE',
        reviewerId,
        { status: 'PENDING' },
        { status },
        `Изменение ${status === 'APPROVED' ? 'одобрено' : 'отклонено'}${comments ? `: ${comments}` : ''}`
      );

      return approvals[approvalIndex];
    } catch (error) {
      console.error('Failed to review change approval:', error);
      throw error;
    }
  }

  // Get pending approvals
  async getPendingApprovals(userId?: number): Promise<ChangeApproval[]> {
    try {
      const key = 'audit_change_approvals';
      const stored = localStorage.getItem(key);
      let approvals: ChangeApproval[] = stored ? JSON.parse(stored) : [];

      approvals = approvals.filter(a => a.status === 'PENDING');

      if (userId) {
        approvals = approvals.filter(a => a.requested_by === userId);
      }

      return approvals.sort((a, b) => 
        new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
      );
    } catch (error) {
      console.error('Failed to get pending approvals:', error);
      return [];
    }
  }

  // Export audit logs
  async exportAuditLogs(
    filters: AuditFilters,
    format: 'csv' | 'excel' | 'json' = 'csv'
  ): Promise<Blob> {
    try {
      const { logs } = await this.getAuditLogs({
        ...filters,
        limit: 10000
      });

      if (format === 'json') {
        return new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      }

      // CSV format
      const headers = [
        'Timestamp',
        'Entity Type',
        'Entity ID',
        'Action',
        'User ID',
        'Description',
        'Changes'
      ];

      const csvContent = [
        headers.join(','),
        ...logs.map(log => [
          log.timestamp,
          log.entity_type,
          log.entity_id,
          log.action,
          log.user_id,
          `"${log.description || ''}"`,
          `"${log.changes?.map(c => `${c.field}: ${c.old_value} → ${c.new_value}`).join('; ') || ''}"`
        ].join(','))
      ].join('\n');

      return new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw error;
    }
  }

  // Private helper methods
  private calculateFieldChanges(
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): FieldChange[] {
    const changes: FieldChange[] = [];

    if (!oldValues && !newValues) return changes;

    const allFields = new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {})
    ]);

    for (const field of allFields) {
      const oldValue = oldValues?.[field];
      const newValue = newValues?.[field];

      if (oldValue === undefined && newValue !== undefined) {
        changes.push({
          field,
          old_value: null,
          new_value: newValue,
          change_type: 'added'
        });
      } else if (oldValue !== undefined && newValue === undefined) {
        changes.push({
          field,
          old_value: oldValue,
          new_value: null,
          change_type: 'removed'
        });
      } else if (oldValue !== newValue) {
        changes.push({
          field,
          old_value: oldValue,
          new_value: newValue,
          change_type: 'modified'
        });
      }
    }

    return changes;
  }

  private getClientInfo(): Pick<AuditLog, 'ip_address' | 'user_agent' | 'session_id'> {
    return {
      user_agent: navigator.userAgent,
      session_id: this.getSessionId(),
      // IP address would typically be set by the backend
      ip_address: undefined
    };
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('audit_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('audit_session_id', sessionId);
    }
    return sessionId;
  }

  // Storage methods (in a real implementation, these would be API calls)
  private storeAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const key = 'audit_logs';
    const stored = localStorage.getItem(key);
    const logs: AuditLog[] = stored ? JSON.parse(stored) : [];

    const newLog: AuditLog = {
      ...log,
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString()
    };

    logs.push(newLog);
    
    // Keep only last 1000 logs to prevent storage overflow
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }

    localStorage.setItem(key, JSON.stringify(logs));
    return newLog;
  }

  private getStoredAuditLogs(): AuditLog[] {
    const key = 'audit_logs';
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  private storeDeletedRecordInternal(record: Omit<DeletedRecord, 'id'>): DeletedRecord {
    const key = 'audit_deleted_records';
    const stored = localStorage.getItem(key);
    const records: DeletedRecord[] = stored ? JSON.parse(stored) : [];

    const newRecord: DeletedRecord = {
      ...record,
      id: Date.now() + Math.random()
    };

    records.push(newRecord);
    localStorage.setItem(key, JSON.stringify(records));
    return newRecord;
  }

  private storeAuditReport(report: Omit<AuditReport, 'id'>, logs: AuditLog[]): AuditReport {
    const key = 'audit_reports';
    const stored = localStorage.getItem(key);
    const reports: AuditReport[] = stored ? JSON.parse(stored) : [];

    const newReport: AuditReport = {
      ...report,
      id: Date.now() + Math.random(),
      file_path: `audit_report_${Date.now()}.json`
    };

    reports.push(newReport);
    localStorage.setItem(key, JSON.stringify(reports));

    // Store report data separately
    localStorage.setItem(`audit_report_data_${newReport.id}`, JSON.stringify(logs));

    return newReport;
  }

  private storeChangeApproval(approval: Omit<ChangeApproval, 'id'>): ChangeApproval {
    const key = 'audit_change_approvals';
    const stored = localStorage.getItem(key);
    const approvals: ChangeApproval[] = stored ? JSON.parse(stored) : [];

    const newApproval: ChangeApproval = {
      ...approval,
      id: Date.now() + Math.random()
    };

    approvals.push(newApproval);
    localStorage.setItem(key, JSON.stringify(approvals));
    return newApproval;
  }
}

// Export singleton instance
export const auditService = new AuditService();