import React, { useState, useRef } from 'react';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import {
  BulkOperationResult,
  ExportOptions,
  ImportOptions,
  ArchiveOptions,
  BatchUpdateOperation,
  periodBulkService,
  financialCenterBulkService,
  showBulkOperationResult
} from '../../services/bulkOperationsService';
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
} from 'lucide-react';

interface BulkOperationsPanelProps {
  entityType: 'periods' | 'financial_centers' | 'cost_centers' | 'nomenclatures' | 'products';
  selectedItems: number[];
  data: any[];
  onDataChange: () => void;
  userId: number;
}

interface OperationProgress {
  total: number;
  completed: number;
  errors: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  currentOperation?: string;
}

export const BulkOperationsPanel: React.FC<BulkOperationsPanelProps> = ({
  entityType,
  selectedItems,
  data,
  onDataChange,
  userId
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'batch' | 'archive'>('import');
  const [progress, setProgress] = useState<OperationProgress>({
    total: 0,
    completed: 0,
    errors: 0,
    status: 'idle'
  });
  const [lastResult, setLastResult] = useState<BulkOperationResult<any> | null>(null);
  
  // Import settings
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    skipValidation: false,
    updateExisting: false,
    dryRun: false,
    chunkSize: 100
  });
  
  // Export settings
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeHeaders: true,
    includeMetadata: false,
    filterInactive: false
  });
  
  // Archive settings
  const [archiveOptions, setArchiveOptions] = useState<ArchiveOptions>({
    olderThanDays: 365,
    keepActive: true
  });
  
  // Batch update operations
  const [batchOperations, setBatchOperations] = useState<BatchUpdateOperation[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get service for entity type
  const getService = () => {
    switch (entityType) {
      case 'periods':
        return periodBulkService;
      case 'financial_centers':
        return financialCenterBulkService;
      default:
        throw new Error(`Service not implemented for ${entityType}`);
    }
  };

  // Handle file import
  const handleImport = async (file: File) => {
    setProgress({
      total: 1,
      completed: 0,
      errors: 0,
      status: 'running',
      currentOperation: 'Импорт файла...'
    });

    try {
      const service = getService();
      const result = await service.importFromFile(file, userId, importOptions);
      
      setProgress({
        total: result.totalProcessed,
        completed: result.successCount,
        errors: result.errorCount,
        status: 'completed'
      });
      
      setLastResult(result);
      showBulkOperationResult(result);
      onDataChange();
      
    } catch (error: any) {
      setProgress(prev => ({ ...prev, status: 'error' }));
      toast({
        title: 'Ошибка импорта',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Handle export
  const handleExport = async () => {
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
      
      toast({
        title: 'Экспорт завершен',
        description: `Экспортировано записей: ${exportData.length}`
      });
      
    } catch (error: any) {
      toast({
        title: 'Ошибка экспорта',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Handle batch update
  const handleBatchUpdate = async () => {
    if (batchOperations.length === 0) {
      toast({
        title: 'Нет операций',
        description: 'Добавьте операции для выполнения',
        variant: 'destructive'
      });
      return;
    }

    setProgress({
      total: batchOperations.length,
      completed: 0,
      errors: 0,
      status: 'running',
      currentOperation: 'Групповое обновление...'
    });

    try {
      const service = getService();
      const result = await service.batchUpdate(batchOperations, userId, {
        skipValidation: importOptions.skipValidation
      });
      
      setProgress({
        total: result.totalProcessed,
        completed: result.successCount,
        errors: result.errorCount,
        status: 'completed'
      });
      
      setLastResult(result);
      showBulkOperationResult(result);
      onDataChange();
      setBatchOperations([]);
      
    } catch (error: any) {
      setProgress(prev => ({ ...prev, status: 'error' }));
      toast({
        title: 'Ошибка группового обновления',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Handle archive
  const handleArchive = async () => {
    setProgress({
      total: 1,
      completed: 0,
      errors: 0,
      status: 'running',
      currentOperation: 'Архивирование записей...'
    });

    try {
      const service = getService();
      const result = await service.archiveRecords(userId, archiveOptions);
      
      setProgress({
        total: result.totalProcessed,
        completed: result.successCount,
        errors: result.errorCount,
        status: 'completed'
      });
      
      setLastResult(result);
      showBulkOperationResult(result);
      onDataChange();
      
    } catch (error: any) {
      setProgress(prev => ({ ...prev, status: 'error' }));
      toast({
        title: 'Ошибка архивирования',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Add batch operation
  const addBatchOperation = () => {
    if (selectedItems.length === 0) {
      toast({
        title: 'Нет выбранных записей',
        description: 'Выберите записи для группового обновления',
        variant: 'destructive'
      });
      return;
    }

    const newOperations = selectedItems.map(id => ({
      id,
      updates: {}
    }));

    setBatchOperations([...batchOperations, ...newOperations]);
  };

  // Progress indicator
  const ProgressIndicator = () => {
    if (progress.status === 'idle') return null;

    const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

    return (
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {progress.currentOperation || 'Обработка...'}
          </span>
          <div className="flex items-center gap-2">
            {progress.status === 'running' && <Clock className="h-4 w-4 text-blue-600 animate-spin" />}
            {progress.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
            {progress.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
          </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              progress.status === 'error' ? 'bg-red-600' : 
              progress.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-gray-600">
          <span>Обработано: {progress.completed}/{progress.total}</span>
          {progress.errors > 0 && (
            <span className="text-red-600">Ошибок: {progress.errors}</span>
          )}
        </div>
      </div>
    );
  };

  if (!showPanel) {
    return (
      <button
        onClick={() => setShowPanel(true)}
        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <Settings className="h-4 w-4" />
        Массовые операции
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Массовые операции</h2>
          <button
            onClick={() => setShowPanel(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <ProgressIndicator />

          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
            {[
              { id: 'import', label: 'Импорт', icon: Upload },
              { id: 'export', label: 'Экспорт', icon: Download },
              { id: 'batch', label: 'Групповое обновление', icon: Edit },
              { id: 'archive', label: 'Архивирование', icon: Archive }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white shadow-sm text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Импорт данных</h3>
              
              {/* Import options */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={importOptions.skipValidation}
                    onChange={(e) => setImportOptions({
                      ...importOptions,
                      skipValidation: e.target.checked
                    })}
                  />
                  <span>Пропустить валидацию</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={importOptions.updateExisting}
                    onChange={(e) => setImportOptions({
                      ...importOptions,
                      updateExisting: e.target.checked
                    })}
                  />
                  <span>Обновлять существующие</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={importOptions.dryRun}
                    onChange={(e) => setImportOptions({
                      ...importOptions,
                      dryRun: e.target.checked
                    })}
                  />
                  <span>Тестовый запуск</span>
                </label>
              </div>

              {/* File upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(file);
                  }}
                  className="hidden"
                />
                
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  Перетащите файл сюда или нажмите для выбора
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Поддерживаются форматы: CSV, Excel (.xlsx, .xls)
                </p>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Выбрать файл
                </button>
              </div>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Экспорт данных</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Формат</label>
                  <select
                    value={exportOptions.format}
                    onChange={(e) => setExportOptions({
                      ...exportOptions,
                      format: e.target.value as any
                    })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeHeaders}
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        includeHeaders: e.target.checked
                      })}
                    />
                    <span>Включить заголовки</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeMetadata}
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        includeMetadata: e.target.checked
                      })}
                    />
                    <span>Включить метаданные</span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={exportOptions.filterInactive}
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        filterInactive: e.target.checked
                      })}
                    />
                    <span>Только активные записи</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">
                    {selectedItems.length > 0 
                      ? `Экспорт выбранных записей (${selectedItems.length})`
                      : `Экспорт всех записей (${data.length})`
                    }
                  </p>
                  <p className="text-sm text-gray-600">
                    Формат: {exportOptions.format.toUpperCase()}
                  </p>
                </div>
                
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Экспорт
                </button>
              </div>
            </div>
          )}

          {/* Batch Update Tab */}
          {activeTab === 'batch' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Групповое обновление</h3>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={addBatchOperation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Добавить выбранные ({selectedItems.length})
                </button>
                
                <span className="text-sm text-gray-600">
                  Операций в очереди: {batchOperations.length}
                </span>
              </div>

              {batchOperations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Операции:</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {batchOperations.map((op, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span>ID: {op.id}</span>
                        <button
                          onClick={() => setBatchOperations(
                            batchOperations.filter((_, i) => i !== index)
                          )}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={handleBatchUpdate}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Выполнить групповое обновление
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Archive Tab */}
          {activeTab === 'archive' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Архивирование</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Архивировать записи старше (дней)
                  </label>
                  <input
                    type="number"
                    value={archiveOptions.olderThanDays}
                    onChange={(e) => setArchiveOptions({
                      ...archiveOptions,
                      olderThanDays: parseInt(e.target.value)
                    })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                
                <div className="flex items-center">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={archiveOptions.keepActive}
                      onChange={(e) => setArchiveOptions({
                        ...archiveOptions,
                        keepActive: e.target.checked
                      })}
                    />
                    <span>Сохранить активные записи</span>
                  </label>
                </div>
              </div>

              <button
                onClick={handleArchive}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Начать архивирование
              </button>
            </div>
          )}

          {/* Results */}
          {lastResult && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Результат последней операции:</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-green-600">Успешно: {lastResult.successCount}</span>
                </div>
                <div>
                  <span className="text-red-600">Ошибок: {lastResult.errorCount}</span>
                </div>
                <div>
                  <span className="text-yellow-600">Предупреждений: {lastResult.warningCount}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};