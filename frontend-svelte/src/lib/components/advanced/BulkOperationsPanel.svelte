<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { 
    periodBulkService, 
    financialCenterBulkService, 
    showBulkOperationResult,
    type BulkOperationResult,
    type ExportOptions,
    type ImportOptions,
    type ArchiveOptions,
    type BatchUpdateOperation
  } from '../../services/bulkOperations.service';
  import { toastStore } from '../../stores/toast.store';
  import Button from '../ui/Button.svelte';
  import Badge from '../ui/Badge.svelte';
  import Modal from '../ui/Modal.svelte';
  
  // Icons (using lucide-svelte equivalent or inline SVG)
  import {
    Upload,
    Download,
    FileSpreadsheet,
    FileJson,
    FileText,
    Archive,
    Edit,
    Trash2,
    AlertCircle,
    CheckCircle,
    Clock,
    Play,
    Pause,
    Settings,
    Eye,
    EyeOff
  } from 'lucide-svelte';

  export let entityType: 'periods' | 'financial_centers' | 'cost_centers' | 'nomenclatures' | 'products';
  export let selectedItems: number[] = [];
  export let data: any[] = [];
  export let userId: number;

  const dispatch = createEventDispatcher<{
    dataChange: void;
  }>();

  interface OperationProgress {
    total: number;
    completed: number;
    errors: number;
    status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
    currentOperation?: string;
  }

  let showPanel = false;
  let activeTab: 'import' | 'export' | 'batch' | 'archive' = 'import';
  let progress: OperationProgress = {
    total: 0,
    completed: 0,
    errors: 0,
    status: 'idle'
  };
  let lastResult: BulkOperationResult<any> | null = null;
  
  // Import settings
  let importOptions: ImportOptions = {
    skipValidation: false,
    updateExisting: false,
    dryRun: false,
    chunkSize: 100
  };
  
  // Export settings
  let exportOptions: ExportOptions = {
    format: 'csv',
    includeHeaders: true,
    includeMetadata: false,
    filterInactive: false
  };
  
  // Archive settings
  let archiveOptions: ArchiveOptions = {
    olderThanDays: 365,
    keepActive: true
  };
  
  // Batch update operations
  let batchOperations: BatchUpdateOperation[] = [];
  
  let fileInputRef: HTMLInputElement;

  // Get service for entity type
  function getService() {
    switch (entityType) {
      case 'periods':
        return periodBulkService;
      case 'financial_centers':
        return financialCenterBulkService;
      default:
        throw new Error(`Service not implemented for ${entityType}`);
    }
  }

  // Handle file import
  async function handleImport(file: File) {
    progress = {
      total: 1,
      completed: 0,
      errors: 0,
      status: 'running',
      currentOperation: 'Импорт файла...'
    };

    try {
      const service = getService();
      const result = await service.importFromFile(file, userId, importOptions);
      
      progress = {
        total: result.totalProcessed,
        completed: result.successCount,
        errors: result.errorCount,
        status: 'completed'
      };
      
      lastResult = result;
      showBulkOperationResult(result);
      dispatch('dataChange');
      
    } catch (error: any) {
      progress = { ...progress, status: 'error' };
      toastStore.error('Ошибка импорта', error.message);
    }
  }

  // Handle export
  async function handleExport() {
    try {
      const service = getService();
      const exportData = selectedItems.length > 0 
        ? data.filter(item => selectedItems.includes(item.id))
        : data;
      
      const blob = await service.exportToFile(exportData, exportOptions);
      
      // Download file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${entityType}_export_${new Date().toISOString().split('T')[0]}.${exportOptions.format}`;
      link.click();
      URL.revokeObjectURL(url);
      
      toastStore.success('Экспорт завершен', `Экспортировано записей: ${exportData.length}`);
      
    } catch (error: any) {
      toastStore.error('Ошибка экспорта', error.message);
    }
  }

  // Handle batch update
  async function handleBatchUpdate() {
    if (batchOperations.length === 0) {
      toastStore.error('Нет операций', 'Добавьте операции для выполнения');
      return;
    }

    progress = {
      total: batchOperations.length,
      completed: 0,
      errors: 0,
      status: 'running',
      currentOperation: 'Групповое обновление...'
    };

    try {
      const service = getService();
      const result = await service.batchUpdate(batchOperations, userId, {
        skipValidation: importOptions.skipValidation
      });
      
      progress = {
        total: result.totalProcessed,
        completed: result.successCount,
        errors: result.errorCount,
        status: 'completed'
      };
      
      lastResult = result;
      showBulkOperationResult(result);
      dispatch('dataChange');
      batchOperations = [];
      
    } catch (error: any) {
      progress = { ...progress, status: 'error' };
      toastStore.error('Ошибка группового обновления', error.message);
    }
  }

  // Handle archive
  async function handleArchive() {
    progress = {
      total: 1,
      completed: 0,
      errors: 0,
      status: 'running',
      currentOperation: 'Архивирование записей...'
    };

    try {
      const service = getService();
      const result = await service.archiveRecords(userId, archiveOptions);
      
      progress = {
        total: result.totalProcessed,
        completed: result.successCount,
        errors: result.errorCount,
        status: 'completed'
      };
      
      lastResult = result;
      showBulkOperationResult(result);
      dispatch('dataChange');
      
    } catch (error: any) {
      progress = { ...progress, status: 'error' };
      toastStore.error('Ошибка архивирования', error.message);
    }
  }

  // Add batch operation
  function addBatchOperation() {
    if (selectedItems.length === 0) {
      toastStore.error('Нет выбранных записей', 'Выберите записи для группового обновления');
      return;
    }

    const newOperations = selectedItems.map(id => ({
      id,
      updates: {}
    }));

    batchOperations = [...batchOperations, ...newOperations];
  }

  // Remove batch operation
  function removeBatchOperation(index: number) {
    batchOperations = batchOperations.filter((_, i) => i !== index);
  }

  // Handle file input change
  function handleFileInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      handleImport(file);
    }
  }

  $: percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
</script>

{#if !showPanel}
  <Button on:click={() => showPanel = true} class="flex items-center gap-2">
    <Settings class="h-4 w-4" />
    Массовые операции
  </Button>
{:else}
  <Modal bind:open={showPanel} title="Массовые операции" size="xl">
    <div class="space-y-6">
      <!-- Progress Indicator -->
      {#if progress.status !== 'idle'}
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">
              {progress.currentOperation || 'Обработка...'}
            </span>
            <div class="flex items-center gap-2">
              {#if progress.status === 'running'}
                <Clock class="h-4 w-4 text-blue-600 animate-spin" />
              {:else if progress.status === 'completed'}
                <CheckCircle class="h-4 w-4 text-green-600" />
              {:else if progress.status === 'error'}
                <AlertCircle class="h-4 w-4 text-red-600" />
              {/if}
            </div>
          </div>
          
          <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              class="h-2 rounded-full transition-all duration-300 {
                progress.status === 'error' ? 'bg-red-600' : 
                progress.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'
              }"
              style="width: {percentage}%"
            />
          </div>
          
          <div class="flex justify-between text-xs text-gray-600">
            <span>Обработано: {progress.completed}/{progress.total}</span>
            {#if progress.errors > 0}
              <span class="text-red-600">Ошибок: {progress.errors}</span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Tabs -->
      <div class="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          on:click={() => activeTab = 'import'}
          class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors {
            activeTab === 'import'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }"
        >
          <Upload class="h-4 w-4" />
          <span class="hidden sm:inline">Импорт</span>
        </button>
        <button
          on:click={() => activeTab = 'export'}
          class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors {
            activeTab === 'export'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }"
        >
          <Download class="h-4 w-4" />
          <span class="hidden sm:inline">Экспорт</span>
        </button>
        <button
          on:click={() => activeTab = 'batch'}
          class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors {
            activeTab === 'batch'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }"
        >
          <Edit class="h-4 w-4" />
          <span class="hidden sm:inline">Групповое обновление</span>
        </button>
        <button
          on:click={() => activeTab = 'archive'}
          class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors {
            activeTab === 'archive'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }"
        >
          <Archive class="h-4 w-4" />
          <span class="hidden sm:inline">Архивирование</span>
        </button>
      </div>

      <!-- Import Tab -->
      {#if activeTab === 'import'}
        <div class="space-y-4">
          <h3 class="text-lg font-medium">Импорт данных</h3>
          
          <!-- Import options -->
          <div class="grid grid-cols-2 gap-4">
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={importOptions.skipValidation}
              />
              <span>Пропустить валидацию</span>
            </label>
            
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={importOptions.updateExisting}
              />
              <span>Обновлять существующие</span>
            </label>
            
            <label class="flex items-center space-x-2">
              <input
                type="checkbox"
                bind:checked={importOptions.dryRun}
              />
              <span>Тестовый запуск</span>
            </label>
          </div>

          <!-- File upload -->
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              bind:this={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              on:change={handleFileInputChange}
              class="hidden"
            />
            
            <Upload class="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p class="text-gray-600 mb-2">
              Перетащите файл сюда или нажмите для выбора
            </p>
            <p class="text-sm text-gray-500 mb-4">
              Поддерживаются форматы: CSV, Excel (.xlsx, .xls)
            </p>
            
            <Button on:click={() => fileInputRef?.click()}>
              Выбрать файл
            </Button>
          </div>
        </div>
      {/if}

      <!-- Export Tab -->
      {#if activeTab === 'export'}
        <div class="space-y-4">
          <h3 class="text-lg font-medium">Экспорт данных</h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Формат</label>
              <select
                bind:value={exportOptions.format}
                class="w-full border rounded-lg px-3 py-2"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            
            <div class="space-y-2">
              <label class="flex items-center space-x-2">
                <input
                  type="checkbox"
                  bind:checked={exportOptions.includeHeaders}
                />
                <span>Включить заголовки</span>
              </label>
              
              <label class="flex items-center space-x-2">
                <input
                  type="checkbox"
                  bind:checked={exportOptions.includeMetadata}
                />
                <span>Включить метаданные</span>
              </label>
              
              <label class="flex items-center space-x-2">
                <input
                  type="checkbox"
                  bind:checked={exportOptions.filterInactive}
                />
                <span>Только активные записи</span>
              </label>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p class="font-medium">
                {selectedItems.length > 0 
                  ? `Экспорт выбранных записей (${selectedItems.length})`
                  : `Экспорт всех записей (${data.length})`
                }
              </p>
              <p class="text-sm text-gray-600">
                Формат: {exportOptions.format.toUpperCase()}
              </p>
            </div>
            
            <Button variant="default" class="bg-green-600 hover:bg-green-700" on:click={handleExport}>
              <Download class="h-4 w-4 mr-2" />
              Экспорт
            </Button>
          </div>
        </div>
      {/if}

      <!-- Batch Update Tab -->
      {#if activeTab === 'batch'}
        <div class="space-y-4">
          <h3 class="text-lg font-medium">Групповое обновление</h3>
          
          <div class="flex items-center gap-4">
            <Button on:click={addBatchOperation}>
              Добавить выбранные ({selectedItems.length})
            </Button>
            
            <span class="text-sm text-gray-600">
              Операций в очереди: {batchOperations.length}
            </span>
          </div>

          {#if batchOperations.length > 0}
            <div class="space-y-2">
              <h4 class="font-medium">Операции:</h4>
              <div class="max-h-40 overflow-y-auto space-y-1">
                {#each batchOperations as op, index}
                  <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>ID: {op.id}</span>
                    <button
                      on:click={() => removeBatchOperation(index)}
                      class="text-red-600 hover:text-red-800"
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                {/each}
              </div>
              
              <Button 
                variant="default"
                class="w-full bg-orange-600 hover:bg-orange-700"
                on:click={handleBatchUpdate}
              >
                Выполнить групповое обновление
              </Button>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Archive Tab -->
      {#if activeTab === 'archive'}
        <div class="space-y-4">
          <h3 class="text-lg font-medium">Архивирование</h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">
                Архивировать записи старше (дней)
              </label>
              <input
                type="number"
                bind:value={archiveOptions.olderThanDays}
                class="w-full border rounded-lg px-3 py-2"
              />
            </div>
            
            <div class="flex items-center">
              <label class="flex items-center space-x-2">
                <input
                  type="checkbox"
                  bind:checked={archiveOptions.keepActive}
                />
                <span>Сохранить активные записи</span>
              </label>
            </div>
          </div>

          <Button 
            variant="default" 
            class="w-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2"
            on:click={handleArchive}
          >
            <Archive class="h-4 w-4" />
            Начать архивирование
          </Button>
        </div>
      {/if}

      <!-- Results -->
      {#if lastResult}
        <div class="p-4 bg-gray-50 rounded-lg">
          <h4 class="font-medium mb-2">Результат последней операции:</h4>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span class="text-green-600">Успешно: {lastResult.successCount}</span>
            </div>
            <div>
              <span class="text-red-600">Ошибок: {lastResult.errorCount}</span>
            </div>
            <div>
              <span class="text-yellow-600">Предупреждений: {lastResult.warningCount}</span>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </Modal>
{/if}