import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  BaseBulkOperationsService,
  periodBulkService,
  financialCenterBulkService,
  ImportOptions,
  ExportOptions,
  ArchiveOptions,
  BatchUpdateOperation,
  showBulkOperationResult
} from '../bulkOperationsService';
import { Period, FinancialCenter } from '../referenceDataService';
import * as XLSX from 'xlsx';

// Mock dependencies
jest.mock('xlsx');
jest.mock('../referenceDataService');
jest.mock('../../components/ui/use-toast', () => ({
  toast: jest.fn()
}));

// Mock file reader
global.FileReader = jest.fn(() => ({
  readAsArrayBuffer: jest.fn(),
  readAsText: jest.fn(),
  addEventListener: jest.fn((event: string, handler: Function) => {
    if (event === 'load') {
      setTimeout(() => {
        handler({ target: { result: 'mock data' } });
      }, 0);
    }
  }),
  result: null
})) as any;

describe('BulkOperationsService', () => {
  let mockService: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock base service methods
    mockService = {
      getAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ period_id: 1 }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined)
    };
  });

  describe('bulkCreate', () => {
    it('should create multiple items', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const data = [
        { period_name: 'Jan 2024' },
        { period_name: 'Feb 2024' }
      ];
      
      const result = await bulkService.bulkCreate(data, 1);
      
      expect(mockService.create).toHaveBeenCalledTimes(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.totalProcessed).toBe(2);
    });

    it('should handle validation errors', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const data = [
        { period_name: '' }, // Invalid
        { period_name: 'Feb 2024' }
      ];
      
      const result = await bulkService.bulkCreate(data, 1, {
        skipValidation: false
      });
      
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].error).toContain('Validation failed');
    });

    it('should skip validation when configured', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const data = [{ period_name: '' }];
      
      const result = await bulkService.bulkCreate(data, 1, {
        skipValidation: true
      });
      
      expect(mockService.create).toHaveBeenCalled();
      expect(result.successCount).toBe(1);
    });

    it('should update existing items when configured', async () => {
      mockService.getAll.mockResolvedValue([
        { period_id: 1, period_name: 'Jan 2024' }
      ]);
      
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const data = [{ period_name: 'Jan 2024' }];
      
      const result = await bulkService.bulkCreate(data, 1, {
        updateExisting: true
      });
      
      expect(mockService.update).toHaveBeenCalled();
      expect(mockService.create).not.toHaveBeenCalled();
      expect(result.successCount).toBe(1);
    });

    it('should handle chunked processing', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const data = Array(25).fill(null).map((_, i) => ({
        period_name: `Period ${i}`
      }));
      
      const result = await bulkService.bulkCreate(data, 1, {
        chunkSize: 10
      });
      
      expect(result.totalProcessed).toBe(25);
      expect(result.successCount).toBe(25);
    });

    it('should perform dry run without creating', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const data = [{ period_name: 'Test' }];
      
      const result = await bulkService.bulkCreate(data, 1, {
        dryRun: true
      });
      
      expect(mockService.create).not.toHaveBeenCalled();
      expect(result.dryRun).toBe(true);
      expect(result.successCount).toBe(1);
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple items', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const operations: BatchUpdateOperation[] = [
        { id: 1, updates: { is_active: false } },
        { id: 2, updates: { is_active: false } }
      ];
      
      const result = await bulkService.bulkUpdate(operations, 1);
      
      expect(mockService.update).toHaveBeenCalledTimes(2);
      expect(result.successCount).toBe(2);
    });

    it('should handle update errors', async () => {
      mockService.update.mockRejectedValueOnce(new Error('Update failed'));
      
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const operations: BatchUpdateOperation[] = [
        { id: 1, updates: { is_active: false } },
        { id: 2, updates: { is_active: false } }
      ];
      
      const result = await bulkService.bulkUpdate(operations, 1);
      
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].error).toBe('Update failed');
    });
  });

  describe('bulkDelete', () => {
    it('should delete multiple items', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const ids = [1, 2, 3];
      
      const result = await bulkService.bulkDelete(ids, 1);
      
      expect(mockService.delete).toHaveBeenCalledTimes(3);
      expect(result.successCount).toBe(3);
    });

    it('should continue on delete errors', async () => {
      mockService.delete
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce(undefined);
      
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const ids = [1, 2, 3];
      
      const result = await bulkService.bulkDelete(ids, 1);
      
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
    });
  });

  describe('importFromFile', () => {
    it('should import from CSV file', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const mockFile = new File(['header1,header2\nvalue1,value2'], 'test.csv', {
        type: 'text/csv'
      });
      
      // Mock FileReader to return CSV data
      const mockFileReader = {
        readAsText: jest.fn(),
        addEventListener: jest.fn((event: string, handler: Function) => {
          if (event === 'load') {
            setTimeout(() => {
              handler({
                target: {
                  result: 'period_name,period_year,period_month\nJan 2024,2024,1\nFeb 2024,2024,2'
                }
              });
            }, 0);
          }
        })
      };
      
      global.FileReader = jest.fn(() => mockFileReader) as any;
      
      const result = await bulkService.importFromFile(mockFile, 1);
      
      expect(result.totalProcessed).toBe(2);
      expect(mockService.create).toHaveBeenCalledTimes(2);
    });

    it('should import from Excel file', async () => {
      const mockFile = new File([''], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      // Mock XLSX
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      };
      
      (XLSX.read as jest.Mock).mockReturnValue(mockWorkbook);
      (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
        { period_name: 'Jan 2024', period_year: 2024, period_month: 1 },
        { period_name: 'Feb 2024', period_year: 2024, period_month: 2 }
      ]);
      
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      // Mock FileReader for Excel
      const mockFileReader = {
        readAsArrayBuffer: jest.fn(),
        addEventListener: jest.fn((event: string, handler: Function) => {
          if (event === 'load') {
            setTimeout(() => {
              handler({ target: { result: new ArrayBuffer(0) } });
            }, 0);
          }
        })
      };
      
      global.FileReader = jest.fn(() => mockFileReader) as any;
      
      const result = await bulkService.importFromFile(mockFile, 1);
      
      expect(XLSX.read).toHaveBeenCalled();
      expect(result.totalProcessed).toBe(2);
    });

    it('should handle unsupported file types', async () => {
      const mockFile = new File([''], 'test.txt', { type: 'text/plain' });
      
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      await expect(bulkService.importFromFile(mockFile, 1))
        .rejects.toThrow('Unsupported file type');
    });

    it('should validate imported data', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const mockFile = new File([''], 'test.csv', { type: 'text/csv' });
      
      // Mock FileReader with invalid data
      const mockFileReader = {
        readAsText: jest.fn(),
        addEventListener: jest.fn((event: string, handler: Function) => {
          if (event === 'load') {
            setTimeout(() => {
              handler({
                target: {
                  result: 'period_name\n' // Missing required fields
                }
              });
            }, 0);
          }
        })
      };
      
      global.FileReader = jest.fn(() => mockFileReader) as any;
      
      const result = await bulkService.importFromFile(mockFile, 1, {
        skipValidation: false
      });
      
      expect(result.errorCount).toBeGreaterThan(0);
    });
  });

  describe('exportToFile', () => {
    it('should export to CSV format', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const data: Period[] = [
        { period_id: 1, period_name: 'Jan 2024', period_year: 2024, period_month: 1 } as Period,
        { period_id: 2, period_name: 'Feb 2024', period_year: 2024, period_month: 2 } as Period
      ];
      
      const blob = await bulkService.exportToFile(data, { format: 'csv' });
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv');
    });

    it('should export to Excel format', async () => {
      const mockBuffer = new ArrayBuffer(0);
      (XLSX.utils.json_to_sheet as jest.Mock).mockReturnValue({});
      (XLSX.utils.book_new as jest.Mock).mockReturnValue({});
      (XLSX.utils.book_append_sheet as jest.Mock).mockReturnValue(undefined);
      (XLSX.write as jest.Mock).mockReturnValue(mockBuffer);
      
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const data = [{ period_id: 1 }];
      
      const blob = await bulkService.exportToFile(data, { format: 'excel' });
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('should export to JSON format', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const data = [{ period_id: 1, period_name: 'Test' }];
      
      const blob = await bulkService.exportToFile(data, { format: 'json' });
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('should filter inactive records when configured', async () => {
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const data = [
        { period_id: 1, is_active: true },
        { period_id: 2, is_active: false }
      ];
      
      const blob = await bulkService.exportToFile(data, {
        format: 'json',
        filterInactive: true
      });
      
      const text = await blob.text();
      const exported = JSON.parse(text);
      
      expect(exported).toHaveLength(1);
      expect(exported[0].period_id).toBe(1);
    });
  });

  describe('archiveRecords', () => {
    it('should archive old records', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000); // 400 days ago
      
      mockService.getAll.mockResolvedValue([
        { period_id: 1, created_at: oldDate.toISOString(), is_active: true },
        { period_id: 2, created_at: now.toISOString(), is_active: true },
        { period_id: 3, created_at: oldDate.toISOString(), is_active: false }
      ]);
      
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const result = await bulkService.archiveRecords(1, {
        olderThanDays: 365,
        keepActive: false
      });
      
      expect(mockService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ is_active: false, _archived: true }),
        1
      );
      expect(result.successCount).toBe(1);
    });

    it('should keep active records when configured', async () => {
      const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      
      mockService.getAll.mockResolvedValue([
        { period_id: 1, created_at: oldDate.toISOString(), is_active: true },
        { period_id: 2, created_at: oldDate.toISOString(), is_active: false }
      ]);
      
      const bulkService = new BaseBulkOperationsService(
        'periods',
        'period_id',
        mockService
      );
      
      const result = await bulkService.archiveRecords(1, {
        olderThanDays: 365,
        keepActive: true
      });
      
      expect(mockService.update).toHaveBeenCalledTimes(1);
      expect(mockService.update).toHaveBeenCalledWith(
        2,
        expect.anything(),
        1
      );
    });
  });

  describe('showBulkOperationResult', () => {
    it('should show success toast for all successful operations', () => {
      const { toast } = require('../../components/ui/use-toast');
      
      showBulkOperationResult({
        successCount: 10,
        errorCount: 0,
        warningCount: 0,
        totalProcessed: 10,
        errors: [],
        warnings: []
      });
      
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Операция завершена успешно',
          description: 'Успешно обработано: 10 записей'
        })
      );
    });

    it('should show warning toast for partial success', () => {
      const { toast } = require('../../components/ui/use-toast');
      
      showBulkOperationResult({
        successCount: 8,
        errorCount: 2,
        warningCount: 0,
        totalProcessed: 10,
        errors: [
          { index: 0, error: 'Error 1' },
          { index: 1, error: 'Error 2' }
        ],
        warnings: []
      });
      
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Операция завершена с ошибками',
          variant: 'destructive'
        })
      );
    });
  });

  describe('Entity-specific services', () => {
    it('should create period bulk service', () => {
      expect(periodBulkService).toBeInstanceOf(BaseBulkOperationsService);
      expect(periodBulkService.entityType).toBe('periods');
    });

    it('should create financial center bulk service', () => {
      expect(financialCenterBulkService).toBeInstanceOf(BaseBulkOperationsService);
      expect(financialCenterBulkService.entityType).toBe('financial_centers');
    });
  });
});