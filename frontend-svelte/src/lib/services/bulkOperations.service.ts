import { 
  periodsService as periodService,
  financialCentersService as financialCenterService,
  costCentersService as costCenterService,
  nomenclaturesService as nomenclatureService,
  productService
} from './index';
import type { 
  Period, 
  FinancialCenter, 
  CostCenter, 
  Nomenclature, 
  Product
} from '../types';
import { toastStore } from '../stores/toast.store';
import * as XLSX from 'xlsx';

// Types for bulk operations
export interface BulkOperationResult<T> {
  success: T[];
  errors: BulkOperationError[];
  warnings: BulkOperationWarning[];
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
}

export interface BulkOperationError {
  row: number;
  data: any;
  error: string;
  code: string;
}

export interface BulkOperationWarning {
  row: number;
  data: any;
  warning: string;
  code: string;
}

export interface BatchUpdateOperation {
  id: number;
  updates: Record<string, any>;
}

export interface ArchiveOptions {
  olderThanDays?: number;
  keepActive?: boolean;
  archiveLocation?: string;
}

export interface ImportOptions {
  skipValidation?: boolean;
  updateExisting?: boolean;
  dryRun?: boolean;
  chunkSize?: number;
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'json' | 'xml' | 'pdf';
  includeHeaders?: boolean;
  includeMetadata?: boolean;
  filterInactive?: boolean;
  customFields?: string[];
}

// Base bulk operations service
abstract class BaseBulkOperationsService<T extends Record<string, any>> {
  protected abstract entityName: string;
  protected abstract service: any;
  protected abstract validationType: string;
  protected abstract idField: keyof T;

  // Массовое создание записей
  async bulkCreate(
    data: Omit<T, typeof this.idField>[],
    userId: number,
    options: ImportOptions = {}
  ): Promise<BulkOperationResult<T>> {
    const {
      skipValidation = false,
      updateExisting = false,
      dryRun = false,
      chunkSize = 100
    } = options;

    const result: BulkOperationResult<T> = {
      success: [],
      errors: [],
      warnings: [],
      totalProcessed: data.length,
      successCount: 0,
      errorCount: 0,
      warningCount: 0
    };

    // Process in chunks
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      for (let j = 0; j < chunk.length; j++) {
        const rowIndex = i + j + 1;
        const item = chunk[j];

        try {
          // Basic validation (can be extended with specific validation logic)
          if (!skipValidation) {
            const validation = await this.validateItem(item, userId, false);

            if (!validation.isValid) {
              result.errors.push({
                row: rowIndex,
                data: item,
                error: validation.errors.join(', '),
                code: 'VALIDATION_ERROR'
              });
              result.errorCount++;
              continue;
            }

            if (validation.warnings.length > 0) {
              result.warnings.push({
                row: rowIndex,
                data: item,
                warning: validation.warnings.join(', '),
                code: 'VALIDATION_WARNING'
              });
              result.warningCount++;
            }
          }

          // Check if exists (for update mode)
          if (updateExisting) {
            const existing = await this.findExisting(item, userId);
            if (existing) {
              if (!dryRun) {
                const updated = await this.service.update(existing[this.idField], item);
                result.success.push(updated);
              }
              result.successCount++;
              continue;
            }
          }

          // Create new record
          if (!dryRun) {
            const created = await this.service.create({
              ...item,
              user_id: userId
            });
            result.success.push(created);
          }
          result.successCount++;

        } catch (error: any) {
          result.errors.push({
            row: rowIndex,
            data: item,
            error: error.message || 'Неизвестная ошибка',
            code: error.code || 'UNKNOWN_ERROR'
          });
          result.errorCount++;
        }
      }

      // Add delay between chunks to prevent overwhelming the server
      if (i + chunkSize < data.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return result;
  }

  // Batch update operations
  async batchUpdate(
    operations: BatchUpdateOperation[],
    userId: number,
    options: ImportOptions = {}
  ): Promise<BulkOperationResult<T>> {
    const { skipValidation = false, dryRun = false } = options;

    const result: BulkOperationResult<T> = {
      success: [],
      errors: [],
      warnings: [],
      totalProcessed: operations.length,
      successCount: 0,
      errorCount: 0,
      warningCount: 0
    };

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const rowIndex = i + 1;

      try {
        // Validation
        if (!skipValidation) {
          const validation = await this.validateItem(
            operation.updates,
            userId,
            true,
            operation.id
          );

          if (!validation.isValid) {
            result.errors.push({
              row: rowIndex,
              data: operation,
              error: validation.errors.join(', '),
              code: 'VALIDATION_ERROR'
            });
            result.errorCount++;
            continue;
          }

          if (validation.warnings.length > 0) {
            result.warnings.push({
              row: rowIndex,
              data: operation,
              warning: validation.warnings.join(', '),
              code: 'VALIDATION_WARNING'
            });
            result.warningCount++;
          }
        }

        // Perform update
        if (!dryRun) {
          const updated = await this.service.update(operation.id, operation.updates);
          result.success.push(updated);
        }
        result.successCount++;

      } catch (error: any) {
        result.errors.push({
          row: rowIndex,
          data: operation,
          error: error.message || 'Неизвестная ошибка',
          code: error.code || 'UNKNOWN_ERROR'
        });
        result.errorCount++;
      }
    }

    return result;
  }

  // Import from Excel/CSV
  async importFromFile(
    file: File,
    userId: number,
    options: ImportOptions = {}
  ): Promise<BulkOperationResult<T>> {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    let data: any[];
    
    try {
      if (fileExtension === 'csv') {
        data = await this.parseCSV(file);
      } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
        data = await this.parseExcel(file);
      } else {
        throw new Error('Неподдерживаемый формат файла. Используйте CSV или Excel.');
      }

      // Transform data to match entity structure
      const transformedData = await this.transformImportData(data, userId);
      
      return this.bulkCreate(transformedData, userId, options);
      
    } catch (error: any) {
      throw new Error(`Ошибка импорта: ${error.message}`);
    }
  }

  // Export to various formats
  async exportToFile(
    data: T[],
    options: ExportOptions
  ): Promise<Blob> {
    const { format, includeHeaders = true, includeMetadata = false, filterInactive = false } = options;

    let filteredData = data;
    
    // Filter inactive records if requested
    if (filterInactive) {
      filteredData = data.filter(item => item.is_active !== false);
    }

    switch (format) {
      case 'csv':
        return this.exportToCSV(filteredData, includeHeaders);
      case 'excel':
        return this.exportToExcel(filteredData, includeHeaders, includeMetadata);
      case 'json':
        return this.exportToJSON(filteredData, includeMetadata);
      case 'xml':
        return this.exportToXML(filteredData, includeMetadata);
      case 'pdf':
        return this.exportToPDF(filteredData, includeHeaders);
      default:
        throw new Error(`Неподдерживаемый формат экспорта: ${format}`);
    }
  }

  // Archive old records
  async archiveRecords(
    userId: number,
    options: ArchiveOptions = {}
  ): Promise<BulkOperationResult<T>> {
    const { olderThanDays = 365, keepActive = true } = options;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const allRecords = await this.service.getAll(userId);
    const recordsToArchive = allRecords.filter((record: any) => {
      const createdAt = new Date(record.created_at || record.updated_at || '1900-01-01');
      const isOld = createdAt < cutoffDate;
      const shouldArchive = keepActive ? !record.is_active && isOld : isOld;
      return shouldArchive;
    });

    const result: BulkOperationResult<T> = {
      success: [],
      errors: [],
      warnings: [],
      totalProcessed: recordsToArchive.length,
      successCount: 0,
      errorCount: 0,
      warningCount: 0
    };

    // For now, archiving means marking as inactive
    // In a real implementation, this might move records to an archive table
    for (const record of recordsToArchive) {
      try {
        const archived = await this.service.update(record[this.idField], {
          is_active: false,
          archived_at: new Date().toISOString()
        });
        result.success.push(archived);
        result.successCount++;
      } catch (error: any) {
        result.errors.push({
          row: 0,
          data: record,
          error: error.message,
          code: 'ARCHIVE_ERROR'
        });
        result.errorCount++;
      }
    }

    return result;
  }

  // Abstract methods to be implemented by specific services
  protected abstract findExisting(data: any, userId: number): Promise<T | null>;
  protected abstract transformImportData(data: any[], userId: number): Promise<Omit<T, typeof this.idField>[]>;
  protected abstract validateItem(
    data: any, 
    userId: number, 
    isUpdate: boolean, 
    id?: number
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;

  // Helper methods for file parsing
  private async parseCSV(file: File): Promise<any[]> {
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }
    
    return data;
  }

  private async parseExcel(file: File): Promise<any[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    return XLSX.utils.sheet_to_json(worksheet);
  }

  // Export methods
  private exportToCSV(data: T[], includeHeaders: boolean): Blob {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      ...(includeHeaders ? [headers.join(',')] : []),
      ...data.map(item => 
        headers.map(header => `"${String(item[header] || '')}"`).join(',')
      )
    ].join('\n');

    return new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  private exportToExcel(data: T[], includeHeaders: boolean, includeMetadata: boolean): Blob {
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: !includeHeaders });
    const workbook = XLSX.utils.book_new();
    
    XLSX.utils.book_append_sheet(workbook, worksheet, this.entityName);
    
    if (includeMetadata) {
      const metaData = [
        ['Экспортировано', new Date().toISOString()],
        ['Тип данных', this.entityName],
        ['Количество записей', data.length]
      ];
      const metaSheet = XLSX.utils.aoa_to_sheet(metaData);
      XLSX.utils.book_append_sheet(workbook, metaSheet, 'Метаданные');
    }
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  private exportToJSON(data: T[], includeMetadata: boolean): Blob {
    const exportData = includeMetadata ? {
      metadata: {
        exportedAt: new Date().toISOString(),
        entityType: this.entityName,
        recordCount: data.length
      },
      data
    } : data;

    return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  }

  private exportToXML(data: T[], includeMetadata: boolean): Blob {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<${this.entityName}s>\n`;
    
    if (includeMetadata) {
      xml += '  <metadata>\n';
      xml += `    <exportedAt>${new Date().toISOString()}</exportedAt>\n`;
      xml += `    <entityType>${this.entityName}</entityType>\n`;
      xml += `    <recordCount>${data.length}</recordCount>\n`;
      xml += '  </metadata>\n';
    }
    
    xml += '  <data>\n';
    data.forEach(item => {
      xml += `    <${this.entityName}>\n`;
      Object.entries(item).forEach(([key, value]) => {
        xml += `      <${key}>${String(value || '')}</${key}>\n`;
      });
      xml += `    </${this.entityName}>\n`;
    });
    xml += '  </data>\n';
    xml += `</${this.entityName}s>`;

    return new Blob([xml], { type: 'application/xml' });
  }

  private exportToPDF(data: T[], includeHeaders: boolean): Blob {
    // For PDF export, we'll create a simple HTML table and convert it
    // In a real implementation, you'd use a proper PDF library like jsPDF
    let html = '<html><head><title>Export</title></head><body>';
    html += `<h1>${this.entityName} Export</h1>`;
    html += '<table border="1" style="border-collapse: collapse; width: 100%;">';
    
    if (includeHeaders && data.length > 0) {
      html += '<thead><tr>';
      Object.keys(data[0]).forEach(key => {
        html += `<th style="padding: 8px; background-color: #f0f0f0;">${key}</th>`;
      });
      html += '</tr></thead>';
    }
    
    html += '<tbody>';
    data.forEach(item => {
      html += '<tr>';
      Object.values(item).forEach(value => {
        html += `<td style="padding: 8px;">${String(value || '')}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></body></html>';

    return new Blob([html], { type: 'text/html' });
  }
}

// Specific implementations for each entity type
class PeriodBulkOperationsService extends BaseBulkOperationsService<Period> {
  protected entityName = 'periods';
  protected service = periodService;
  protected validationType = 'period';
  protected idField: keyof Period = 'period_id';

  protected async findExisting(data: any, userId: number): Promise<Period | null> {
    const periods = await this.service.getAll(userId);
    return periods.find((p: Period) => 
      p.period_year === data.period_year && p.period_month === data.period_month
    ) || null;
  }

  protected async transformImportData(data: any[], userId: number): Promise<Omit<Period, 'period_id'>[]> {
    return data.map(row => ({
      period_name: row['Название'] || row['period_name'] || row['name'],
      period_year: parseInt(row['Год'] || row['period_year'] || row['year']),
      period_month: parseInt(row['Месяц'] || row['period_month'] || row['month']),
      period_order: parseInt(row['Порядок'] || row['period_order'] || row['order'] || '1'),
      is_active: (row['Активен'] || row['is_active'] || row['active'] || 'true').toLowerCase() === 'true',
      user_id: userId
    }));
  }

  protected async validateItem(
    data: any, 
    userId: number, 
    isUpdate: boolean, 
    id?: number
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.period_name || data.period_name.trim() === '') {
      errors.push('Название периода обязательно');
    }

    if (!data.period_year || isNaN(data.period_year)) {
      errors.push('Год должен быть числом');
    }

    if (!data.period_month || isNaN(data.period_month) || data.period_month < 1 || data.period_month > 12) {
      errors.push('Месяц должен быть числом от 1 до 12');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

class FinancialCenterBulkOperationsService extends BaseBulkOperationsService<FinancialCenter> {
  protected entityName = 'financial_centers';
  protected service = financialCenterService;
  protected validationType = 'financial_center';
  protected idField: keyof FinancialCenter = 'financial_center_id';

  protected async findExisting(data: any, userId: number): Promise<FinancialCenter | null> {
    const centers = await this.service.getAll(userId);
    return centers.find((fc: FinancialCenter) => 
      fc.financial_center_name === data.financial_center_name
    ) || null;
  }

  protected async transformImportData(data: any[], userId: number): Promise<Omit<FinancialCenter, 'financial_center_id'>[]> {
    return data.map(row => ({
      financial_center_name: row['Название'] || row['financial_center_name'] || row['name'],
      financial_center_description: row['Описание'] || row['financial_center_description'] || row['description'],
      financial_center_order: parseInt(row['Порядок'] || row['financial_center_order'] || row['order'] || '1'),
      parent_id: row['Родитель ID'] || row['parent_id'] || null,
      is_active: (row['Активен'] || row['is_active'] || row['active'] || 'true').toLowerCase() === 'true',
      user_id: userId
    }));
  }

  protected async validateItem(
    data: any, 
    userId: number, 
    isUpdate: boolean, 
    id?: number
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.financial_center_name || data.financial_center_name.trim() === '') {
      errors.push('Название ЦФО обязательно');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Export service instances
export const periodBulkService = new PeriodBulkOperationsService();
export const financialCenterBulkService = new FinancialCenterBulkOperationsService();

// Utility function for showing bulk operation results
export function showBulkOperationResult<T>(result: BulkOperationResult<T>): void {
  const { successCount, errorCount, warningCount, totalProcessed } = result;
  
  if (errorCount === 0) {
    toastStore.success(
      'Операция завершена успешно',
      `Обработано: ${totalProcessed}, Успешно: ${successCount}${warningCount > 0 ? `, Предупреждений: ${warningCount}` : ''}`
    );
  } else {
    toastStore.error(
      'Операция завершена с ошибками',
      `Обработано: ${totalProcessed}, Успешно: ${successCount}, Ошибок: ${errorCount}`
    );
  }
}