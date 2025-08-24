<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    auditService, 
    type AuditLog,
    type DeletedRecord,
    type ChangeApproval,
    type AuditFilters
  } from '../../services/audit.service';
  import { toastStore } from '../../stores/toast.store';
  import Button from '../ui/Button.svelte';
  import Badge from '../ui/Badge.svelte';
  import Input from '../ui/Input.svelte';
  import Select from '../ui/Select.svelte';
  
  // Icons
  import {
    History,
    RotateCcw,
    Download,
    FileText,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    RefreshCw,
    Search,
    ChevronDown,
    ChevronRight,
    Trash2,
    Edit,
    Plus
  } from 'lucide-svelte';

  export let entityType: string | undefined = undefined;
  export let entityId: number | undefined = undefined;
  export let userId: number;

  let activeTab: 'history' | 'deleted' | 'approvals' = 'history';
  let auditLogs: AuditLog[] = [];
  let deletedRecords: DeletedRecord[] = [];
  let pendingApprovals: ChangeApproval[] = [];
  let loading = false;
  let expandedLogs = new Set<number>();
  
  // Filters
  let filters: AuditFilters = {
    entityTypes: entityType ? [entityType] : [],
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
    limit: 100,
    offset: 0
  };

  onMount(() => {
    loadData();
  });

  $: if (entityType || entityId || filters) {
    loadData();
  }

  async function loadData() {
    loading = true;
    
    try {
      if (entityType && entityId) {
        // Load history for specific entity
        const history = await auditService.getEntityHistory(entityType, entityId);
        auditLogs = history;
      } else {
        // Load all audit logs with filters
        const { logs } = await auditService.getAuditLogs(filters);
        auditLogs = logs;
      }
      
      // Load deleted records
      const deleted = await auditService.getDeletedRecords(entityType);
      deletedRecords = deleted;
      
      // Load pending approvals
      const approvals = await auditService.getPendingApprovals(userId);
      pendingApprovals = approvals;
      
    } catch (error) {
      console.error('Failed to load audit data:', error);
      toastStore.error('Ошибка', 'Не удалось загрузить данные аудита');
    } finally {
      loading = false;
    }
  }

  function toggleLogExpansion(logId: number) {
    if (expandedLogs.has(logId)) {
      expandedLogs.delete(logId);
    } else {
      expandedLogs.add(logId);
    }
    expandedLogs = new Set(expandedLogs); // Trigger reactivity
  }

  async function restoreDeletedRecord(recordId: number) {
    try {
      const result = await auditService.restoreDeletedRecord(recordId, userId);
      
      if (result.success) {
        toastStore.success('Успешно', 'Запись восстановлена');
        loadData(); // Reload data
      } else {
        toastStore.error('Ошибка', 'Не удалось восстановить запись');
      }
    } catch (error: any) {
      toastStore.error('Ошибка', error.message);
    }
  }

  async function reviewApproval(
    approvalId: number, 
    status: 'APPROVED' | 'REJECTED',
    comments?: string
  ) {
    try {
      await auditService.reviewChangeApproval(approvalId, status, userId, comments);
      
      toastStore.success(
        'Решение принято',
        `Изменение ${status === 'APPROVED' ? 'одобрено' : 'отклонено'}`
      );
      
      loadData(); // Reload data
    } catch (error: any) {
      toastStore.error('Ошибка', error.message);
    }
  }

  async function exportAuditLogs() {
    try {
      const blob = await auditService.exportAuditLogs(filters, 'csv');
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toastStore.success('Экспорт завершен', 'Логи аудита экспортированы');
    } catch (error: any) {
      toastStore.error('Ошибка экспорта', error.message);
    }
  }

  function getActionIcon(action: AuditLog['action']) {
    switch (action) {
      case 'CREATE':
        return Plus;
      case 'UPDATE':
        return Edit;
      case 'DELETE':
        return Trash2;
      case 'ARCHIVE':
        return Clock;
      case 'RESTORE':
        return RotateCcw;
      default:
        return FileText;
    }
  }

  function getActionColor(action: AuditLog['action']) {
    switch (action) {
      case 'CREATE':
        return 'text-green-600';
      case 'UPDATE':
        return 'text-blue-600';
      case 'DELETE':
        return 'text-red-600';
      case 'ARCHIVE':
        return 'text-orange-600';
      case 'RESTORE':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  }

  function getActionLabel(action: AuditLog['action']) {
    const labels = {
      CREATE: 'Создано',
      UPDATE: 'Обновлено',
      DELETE: 'Удалено',
      ARCHIVE: 'Архивировано',
      RESTORE: 'Восстановлено'
    };
    return labels[action] || action;
  }

  function formatFieldChange(change: any) {
    const { field, old_value, new_value, change_type } = change;
    
    if (change_type === 'added') {
      return `${field}: добавлено "${new_value}"`;
    } else if (change_type === 'removed') {
      return `${field}: удалено "${old_value}"`;
    } else {
      return `${field}: "${old_value}" → "${new_value}"`;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'EXPIRED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-semibold flex items-center gap-2">
      <History class="h-6 w-6" />
      История и аудит
    </h2>
    
    <div class="flex items-center gap-2">
      <Button
        on:click={loadData}
        disabled={loading}
        variant="default"
        class="flex items-center gap-2"
      >
        <RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
        Обновить
      </Button>
      
      <Button
        on:click={exportAuditLogs}
        variant="default"
        class="bg-green-600 hover:bg-green-700 flex items-center gap-2"
      >
        <Download class="h-4 w-4" />
        Экспорт
      </Button>
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label class="block text-sm font-medium mb-2">Поиск</label>
        <div class="relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            bind:value={filters.searchTerm}
            placeholder="Поиск в логах..."
            class="pl-10"
          />
        </div>
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-2">С даты</label>
        <Input
          type="date"
          bind:value={filters.dateFrom}
        />
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-2">По дату</label>
        <Input
          type="date"
          bind:value={filters.dateTo}
        />
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-2">Лимит</label>
        <Select bind:value={filters.limit}>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </Select>
      </div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex space-x-1 bg-gray-100 p-1 rounded-lg">
    <button
      on:click={() => activeTab = 'history'}
      class="flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 {
        activeTab === 'history'
          ? 'bg-white shadow-sm text-blue-600'
          : 'text-gray-600 hover:text-gray-900'
      }"
    >
      История изменений
      {#if auditLogs.length > 0}
        <Badge variant="secondary" className="ml-1">
          {auditLogs.length}
        </Badge>
      {/if}
    </button>
    <button
      on:click={() => activeTab = 'deleted'}
      class="flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 {
        activeTab === 'deleted'
          ? 'bg-white shadow-sm text-blue-600'
          : 'text-gray-600 hover:text-gray-900'
      }"
    >
      Удаленные записи
      {#if deletedRecords.length > 0}
        <Badge variant="secondary" className="ml-1">
          {deletedRecords.length}
        </Badge>
      {/if}
    </button>
    <button
      on:click={() => activeTab = 'approvals'}
      class="flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 {
        activeTab === 'approvals'
          ? 'bg-white shadow-sm text-blue-600'
          : 'text-gray-600 hover:text-gray-900'
      }"
    >
      Ожидают одобрения
      {#if pendingApprovals.length > 0}
        <Badge variant="secondary" className="ml-1">
          {pendingApprovals.length}
        </Badge>
      {/if}
    </button>
  </div>

  <!-- Content -->
  <div class="space-y-4">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <RefreshCw class="h-8 w-8 animate-spin text-blue-600" />
      </div>
    {:else}
      <!-- History Tab -->
      {#if activeTab === 'history'}
        <div class="space-y-4">
          {#if auditLogs.length === 0}
            <div class="text-center py-12 text-gray-500">
              <History class="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>Нет записей в истории изменений</p>
            </div>
          {:else}
            {#each auditLogs as log}
              {@const isExpanded = expandedLogs.has(log.id)}
              {@const ActionIcon = getActionIcon(log.action)}
              <div class="border rounded-lg p-4 space-y-3">
                <div 
                  class="flex items-center justify-between cursor-pointer"
                  on:click={() => toggleLogExpansion(log.id)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => e.key === 'Enter' && toggleLogExpansion(log.id)}
                >
                  <div class="flex items-center gap-3">
                    <ActionIcon class="h-4 w-4 {getActionColor(log.action)}" />
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-medium">{getActionLabel(log.action)}</span>
                        <Badge variant="outline">{log.entity_type}</Badge>
                        <span class="text-sm text-gray-600">ID: {log.entity_id}</span>
                      </div>
                      <div class="text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleString('ru-RU')}
                        {#if log.user_name}
                          <span> • {log.user_name}</span>
                        {/if}
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    {#if log.changes && log.changes.length > 0}
                      <Badge variant="secondary">{log.changes.length} изменений</Badge>
                    {/if}
                    {#if isExpanded}
                      <ChevronDown class="h-4 w-4 text-gray-400" />
                    {:else}
                      <ChevronRight class="h-4 w-4 text-gray-400" />
                    {/if}
                  </div>
                </div>
                
                {#if log.description}
                  <p class="text-sm text-gray-700 ml-7">{log.description}</p>
                {/if}
                
                {#if isExpanded}
                  <div class="ml-7 space-y-3 pt-3 border-t">
                    {#if log.changes && log.changes.length > 0}
                      <div>
                        <h4 class="font-medium text-sm mb-2">Изменения:</h4>
                        <div class="space-y-1">
                          {#each log.changes as change}
                            <div class="text-sm p-2 bg-gray-50 rounded">
                              {formatFieldChange(change)}
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}
                    
                    {#if log.old_values}
                      <div>
                        <h4 class="font-medium text-sm mb-2">Старые значения:</h4>
                        <pre class="text-xs p-2 bg-red-50 rounded overflow-x-auto">
{JSON.stringify(log.old_values, null, 2)}
                        </pre>
                      </div>
                    {/if}
                    
                    {#if log.new_values}
                      <div>
                        <h4 class="font-medium text-sm mb-2">Новые значения:</h4>
                        <pre class="text-xs p-2 bg-green-50 rounded overflow-x-auto">
{JSON.stringify(log.new_values, null, 2)}
                        </pre>
                      </div>
                    {/if}
                    
                    {#if log.metadata}
                      <div>
                        <h4 class="font-medium text-sm mb-2">Метаданные:</h4>
                        <div class="text-xs text-gray-600 space-y-1">
                          {#if log.ip_address}
                            <div>IP: {log.ip_address}</div>
                          {/if}
                          {#if log.user_agent}
                            <div>User Agent: {log.user_agent}</div>
                          {/if}
                          {#if log.session_id}
                            <div>Сессия: {log.session_id}</div>
                          {/if}
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {/if}

      <!-- Deleted Records Tab -->
      {#if activeTab === 'deleted'}
        <div class="space-y-4">
          {#if deletedRecords.length === 0}
            <div class="text-center py-12 text-gray-500">
              <Trash2 class="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>Нет удаленных записей для восстановления</p>
            </div>
          {:else}
            {#each deletedRecords as record}
              <div class="border rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <Trash2 class="h-5 w-5 text-red-600" />
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-medium">Удаленная запись</span>
                        <Badge variant="outline">{record.entity_type}</Badge>
                        <span class="text-sm text-gray-600">ID: {record.entity_id}</span>
                      </div>
                      <div class="text-sm text-gray-500">
                        Удалено: {new Date(record.deleted_at).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  </div>
                  
                  {#if record.can_restore}
                    <Button
                      on:click={() => restoreDeletedRecord(record.id)}
                      variant="default"
                      class="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                    >
                      <RotateCcw class="h-4 w-4" />
                      Восстановить
                    </Button>
                  {/if}
                </div>
                
                {#if record.deletion_reason}
                  <p class="text-sm text-gray-700 mb-3">
                    Причина: {record.deletion_reason}
                  </p>
                {/if}
                
                <details class="text-sm">
                  <summary class="cursor-pointer text-blue-600 hover:text-blue-800">
                    Показать данные записи
                  </summary>
                  <pre class="mt-2 p-2 bg-gray-50 rounded overflow-x-auto text-xs">
{JSON.stringify(record.entity_data, null, 2)}
                  </pre>
                </details>
              </div>
            {/each}
          {/if}
        </div>
      {/if}

      <!-- Approvals Tab -->
      {#if activeTab === 'approvals'}
        <div class="space-y-4">
          {#if pendingApprovals.length === 0}
            <div class="text-center py-12 text-gray-500">
              <CheckCircle class="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>Нет запросов на одобрение изменений</p>
            </div>
          {:else}
            {#each pendingApprovals as approval}
              <div class="border rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <AlertTriangle class="h-5 w-5 text-yellow-600" />
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-medium">Запрос на изменение</span>
                        <Badge variant="outline">{approval.entity_type}</Badge>
                        <span class="text-sm text-gray-600">ID: {approval.entity_id}</span>
                      </div>
                      <div class="text-sm text-gray-500">
                        Запрошено: {new Date(approval.requested_at).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  </div>
                  
                  <Badge className="{getStatusColor(approval.status)}">
                    {approval.status}
                  </Badge>
                </div>
                
                <div class="space-y-3">
                  <div>
                    <h4 class="font-medium text-sm mb-2">Предлагаемые изменения:</h4>
                    <pre class="text-xs p-2 bg-blue-50 rounded overflow-x-auto">
{JSON.stringify(approval.proposed_changes, null, 2)}
                    </pre>
                  </div>
                  
                  {#if approval.status === 'PENDING'}
                    <div class="flex gap-2">
                      <Button
                        on:click={() => reviewApproval(approval.id, 'APPROVED')}
                        variant="default"
                        class="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                      >
                        <CheckCircle class="h-4 w-4" />
                        Одобрить
                      </Button>
                      <Button
                        on:click={() => reviewApproval(approval.id, 'REJECTED')}
                        variant="destructive"
                        class="flex items-center gap-2"
                      >
                        <XCircle class="h-4 w-4" />
                        Отклонить
                      </Button>
                    </div>
                  {/if}
                  
                  {#if approval.review_comments}
                    <div class="p-2 bg-gray-50 rounded">
                      <span class="text-sm font-medium">Комментарий: </span>
                      <span class="text-sm">{approval.review_comments}</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>