import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import {
  AuditLog,
  DeletedRecord,
  ChangeApproval,
  AuditFilters,
  auditService
} from '../../services/auditService';
import {
  History,
  Eye,
  RotateCcw,
  Download,
  Calendar,
  User,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit,
  Plus
} from 'lucide-react';

interface AuditHistoryViewerProps {
  entityType?: string;
  entityId?: number;
  userId: number;
}

export const AuditHistoryViewer: React.FC<AuditHistoryViewerProps> = ({
  entityType,
  entityId,
  userId
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'deleted' | 'approvals'>('history');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [deletedRecords, setDeletedRecords] = useState<DeletedRecord[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ChangeApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  
  // Filters
  const [filters, setFilters] = useState<AuditFilters>({
    entityTypes: entityType ? [entityType] : [],
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
    limit: 100,
    offset: 0
  });

  useEffect(() => {
    loadData();
  }, [entityType, entityId, filters]);

  const loadData = async () => {
    setLoading(true);
    
    try {
      if (entityType && entityId) {
        // Load history for specific entity
        const history = await auditService.getEntityHistory(entityType, entityId);
        setAuditLogs(history);
      } else {
        // Load all audit logs with filters
        const { logs } = await auditService.getAuditLogs(filters);
        setAuditLogs(logs);
      }
      
      // Load deleted records
      const deleted = await auditService.getDeletedRecords(entityType);
      setDeletedRecords(deleted);
      
      // Load pending approvals
      const approvals = await auditService.getPendingApprovals(userId);
      setPendingApprovals(approvals);
      
    } catch (error) {
      console.error('Failed to load audit data:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить данные аудита',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleLogExpansion = (logId: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const restoreDeletedRecord = async (recordId: number) => {
    try {
      const result = await auditService.restoreDeletedRecord(recordId, userId);
      
      if (result.success) {
        toast({
          title: 'Успешно',
          description: 'Запись восстановлена'
        });
        loadData(); // Reload data
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось восстановить запись',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const reviewApproval = async (
    approvalId: number, 
    status: 'APPROVED' | 'REJECTED',
    comments?: string
  ) => {
    try {
      await auditService.reviewChangeApproval(approvalId, status, userId, comments);
      
      toast({
        title: 'Решение принято',
        description: `Изменение ${status === 'APPROVED' ? 'одобрено' : 'отклонено'}`
      });
      
      loadData(); // Reload data
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const exportAuditLogs = async () => {
    try {
      const blob = await auditService.exportAuditLogs(filters, 'csv');
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Экспорт завершен',
        description: 'Логи аудита экспортированы'
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка экспорта',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getActionIcon = (action: AuditLog['action']) => {
    switch (action) {
      case 'CREATE':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'UPDATE':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'DELETE':
        return <Trash2 className="h-4 w-4 text-red-600" />;
      case 'ARCHIVE':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'RESTORE':
        return <RotateCcw className="h-4 w-4 text-purple-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionLabel = (action: AuditLog['action']) => {
    const labels = {
      CREATE: 'Создано',
      UPDATE: 'Обновлено',
      DELETE: 'Удалено',
      ARCHIVE: 'Архивировано',
      RESTORE: 'Восстановлено'
    };
    return labels[action] || action;
  };

  const formatFieldChange = (change: any) => {
    const { field, old_value, new_value, change_type } = change;
    
    if (change_type === 'added') {
      return `${field}: добавлено "${new_value}"`;
    } else if (change_type === 'removed') {
      return `${field}: удалено "${old_value}"`;
    } else {
      return `${field}: "${old_value}" → "${new_value}"`;
    }
  };

  // Render audit log entry
  const renderAuditLog = (log: AuditLog) => {
    const isExpanded = expandedLogs.has(log.id);
    
    return (
      <div key={log.id} className="border rounded-lg p-4 space-y-3">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleLogExpansion(log.id)}
        >
          <div className="flex items-center gap-3">
            {getActionIcon(log.action)}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{getActionLabel(log.action)}</span>
                <Badge variant="outline">{log.entity_type}</Badge>
                <span className="text-sm text-gray-600">ID: {log.entity_id}</span>
              </div>
              <div className="text-sm text-gray-500">
                {new Date(log.timestamp).toLocaleString('ru-RU')}
                {log.user_name && <span> • {log.user_name}</span>}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {log.changes && log.changes.length > 0 && (
              <Badge variant="secondary">{log.changes.length} изменений</Badge>
            )}
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
        
        {log.description && (
          <p className="text-sm text-gray-700 ml-7">{log.description}</p>
        )}
        
        {isExpanded && (
          <div className="ml-7 space-y-3 pt-3 border-t">
            {log.changes && log.changes.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Изменения:</h4>
                <div className="space-y-1">
                  {log.changes.map((change, index) => (
                    <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                      {formatFieldChange(change)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {log.old_values && (
              <div>
                <h4 className="font-medium text-sm mb-2">Старые значения:</h4>
                <pre className="text-xs p-2 bg-red-50 rounded overflow-x-auto">
                  {JSON.stringify(log.old_values, null, 2)}
                </pre>
              </div>
            )}
            
            {log.new_values && (
              <div>
                <h4 className="font-medium text-sm mb-2">Новые значения:</h4>
                <pre className="text-xs p-2 bg-green-50 rounded overflow-x-auto">
                  {JSON.stringify(log.new_values, null, 2)}
                </pre>
              </div>
            )}
            
            {log.metadata && (
              <div>
                <h4 className="font-medium text-sm mb-2">Метаданные:</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  {log.ip_address && <div>IP: {log.ip_address}</div>}
                  {log.user_agent && <div>User Agent: {log.user_agent}</div>}
                  {log.session_id && <div>Сессия: {log.session_id}</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render deleted record
  const renderDeletedRecord = (record: DeletedRecord) => {
    return (
      <div key={record.id} className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-red-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Удаленная запись</span>
                <Badge variant="outline">{record.entity_type}</Badge>
                <span className="text-sm text-gray-600">ID: {record.entity_id}</span>
              </div>
              <div className="text-sm text-gray-500">
                Удалено: {new Date(record.deleted_at).toLocaleString('ru-RU')}
              </div>
            </div>
          </div>
          
          {record.can_restore && (
            <button
              onClick={() => restoreDeletedRecord(record.id)}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Восстановить
            </button>
          )}
        </div>
        
        {record.deletion_reason && (
          <p className="text-sm text-gray-700 mb-3">
            Причина: {record.deletion_reason}
          </p>
        )}
        
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
            Показать данные записи
          </summary>
          <pre className="mt-2 p-2 bg-gray-50 rounded overflow-x-auto text-xs">
            {JSON.stringify(record.entity_data, null, 2)}
          </pre>
        </details>
      </div>
    );
  };

  // Render approval request
  const renderApprovalRequest = (approval: ChangeApproval) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'PENDING': return 'text-yellow-600 bg-yellow-100';
        case 'APPROVED': return 'text-green-600 bg-green-100';
        case 'REJECTED': return 'text-red-600 bg-red-100';
        case 'EXPIRED': return 'text-gray-600 bg-gray-100';
        default: return 'text-gray-600 bg-gray-100';
      }
    };

    return (
      <div key={approval.id} className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Запрос на изменение</span>
                <Badge variant="outline">{approval.entity_type}</Badge>
                <span className="text-sm text-gray-600">ID: {approval.entity_id}</span>
              </div>
              <div className="text-sm text-gray-500">
                Запрошено: {new Date(approval.requested_at).toLocaleString('ru-RU')}
              </div>
            </div>
          </div>
          
          <Badge className={getStatusColor(approval.status)}>
            {approval.status}
          </Badge>
        </div>
        
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-2">Предлагаемые изменения:</h4>
            <pre className="text-xs p-2 bg-blue-50 rounded overflow-x-auto">
              {JSON.stringify(approval.proposed_changes, null, 2)}
            </pre>
          </div>
          
          {approval.status === 'PENDING' && (
            <div className="flex gap-2">
              <button
                onClick={() => reviewApproval(approval.id, 'APPROVED')}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Одобрить
              </button>
              <button
                onClick={() => reviewApproval(approval.id, 'REJECTED')}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Отклонить
              </button>
            </div>
          )}
          
          {approval.review_comments && (
            <div className="p-2 bg-gray-50 rounded">
              <span className="text-sm font-medium">Комментарий: </span>
              <span className="text-sm">{approval.review_comments}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <History className="h-6 w-6" />
          История и аудит
        </h2>
        
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
          
          <button
            onClick={exportAuditLogs}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Экспорт
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Поиск</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                placeholder="Поиск в логах..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">С даты</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">По дату</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Лимит</label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'history', label: 'История изменений', count: auditLogs.length },
          { id: 'deleted', label: 'Удаленные записи', count: deletedRecords.length },
          { id: 'approvals', label: 'Ожидают одобрения', count: pendingApprovals.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${
              activeTab === tab.id
                ? 'bg-white shadow-sm text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <Badge variant="secondary" className="ml-1">
                {tab.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {activeTab === 'history' && (
              <div className="space-y-4">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <History className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>Нет записей в истории изменений</p>
                  </div>
                ) : (
                  auditLogs.map(renderAuditLog)
                )}
              </div>
            )}

            {activeTab === 'deleted' && (
              <div className="space-y-4">
                {deletedRecords.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Trash2 className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>Нет удаленных записей для восстановления</p>
                  </div>
                ) : (
                  deletedRecords.map(renderDeletedRecord)
                )}
              </div>
            )}

            {activeTab === 'approvals' && (
              <div className="space-y-4">
                {pendingApprovals.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>Нет запросов на одобрение изменений</p>
                  </div>
                ) : (
                  pendingApprovals.map(renderApprovalRequest)
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};