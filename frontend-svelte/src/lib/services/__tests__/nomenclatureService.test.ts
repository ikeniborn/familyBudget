import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nomenclaturesService } from '../nomenclatures.service';
import type { Nomenclature } from '$types';

// Mock BaseService
vi.mock('../base.service', () => ({
  BaseService: vi.fn().mockImplementation(() => ({
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }))
}));

describe('Nomenclatures Service', () => {
  const mockNomenclature: Nomenclature = {
    nomenclature_id: 1,
    nomenclature_name: 'Test Nomenclature',
    bill_name: 'Test Bill',
    account_name: 'Test Account',
    operation_name: 'Test Operation',
    is_fact: true,
    is_active: true,
    user_id: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByUserId', () => {
    it('should fetch nomenclatures by user ID and map IDs correctly', async () => {
      const mockResponse = [mockNomenclature];
      vi.spyOn(nomenclaturesService, 'getAll').mockResolvedValue(mockResponse);

      const result = await nomenclaturesService.getByUserId(1);

      expect(nomenclaturesService.getAll).toHaveBeenCalledWith({ user_id: 1 });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...mockNomenclature,
        id: mockNomenclature.nomenclature_id
      });
    });

    it('should handle errors when fetching nomenclatures', async () => {
      vi.spyOn(nomenclaturesService, 'getAll').mockRejectedValue(new Error('API Error'));

      await expect(nomenclaturesService.getByUserId(1))
        .rejects.toThrow('API Error');
    });

    it('should throw generic error when error message is not available', async () => {
      vi.spyOn(nomenclaturesService, 'getAll').mockRejectedValue({});

      await expect(nomenclaturesService.getByUserId(1))
        .rejects.toThrow('Failed to fetch nomenclatures');
    });

    it('should handle empty response', async () => {
      vi.spyOn(nomenclaturesService, 'getAll').mockResolvedValue([]);

      const result = await nomenclaturesService.getByUserId(1);

      expect(result).toEqual([]);
    });
  });

  describe('exportToCsv', () => {
    it('should export nomenclatures to CSV format', async () => {
      const nomenclatures = [mockNomenclature];

      const csvResult = await nomenclaturesService.exportToCsv(nomenclatures);

      expect(csvResult).toContain('ID,Номенклатура,Статья бюджета,Название счета,Название операции,Факт,Статус,Дата создания');
      expect(csvResult).toContain('1,"Test Nomenclature","Test Bill","Test Account","Test Operation",Да,Активен');
    });

    it('should handle nomenclatures with is_fact false', async () => {
      const nomenclature = {
        ...mockNomenclature,
        is_fact: false,
        is_active: false
      };

      const csvResult = await nomenclaturesService.exportToCsv([nomenclature]);

      expect(csvResult).toContain('Нет,Неактивен');
    });

    it('should handle empty data', async () => {
      const csvResult = await nomenclaturesService.exportToCsv([]);

      const lines = csvResult.split('\n');
      expect(lines).toHaveLength(1); // Only header
      expect(lines[0]).toContain('ID,Номенклатура');
    });

    it('should format dates correctly', async () => {
      const csvResult = await nomenclaturesService.exportToCsv([mockNomenclature]);

      expect(csvResult).toContain('01.01.2024');
    });

    it('should handle missing created_at date', async () => {
      const nomenclature = {
        ...mockNomenclature,
        created_at: undefined
      };

      const csvResult = await nomenclaturesService.exportToCsv([nomenclature]);

      expect(csvResult).toContain('1,"Test Nomenclature","Test Bill","Test Account","Test Operation",Да,Активен,');
    });

    it('should escape quotes in text fields', async () => {
      const nomenclature = {
        ...mockNomenclature,
        nomenclature_name: 'Name with "quotes"',
        bill_name: 'Bill with "quotes"'
      };

      const csvResult = await nomenclaturesService.exportToCsv([nomenclature]);

      expect(csvResult).toContain('"Name with ""quotes"""');
      expect(csvResult).toContain('"Bill with ""quotes"""');
    });
  });

  describe('importFromCsv', () => {
    const csvData = `ID,Номенклатура,Статья бюджета,Название счета,Название операции,Факт,Статус,Дата создания
1,"Import Nomenclature","Import Bill","Import Account","Import Operation",Да,Активен,01.01.2024
2,"Another Nomenclature","Another Bill","Another Account","Another Operation",Нет,Неактивен,02.01.2024`;

    it('should import nomenclatures from CSV', async () => {
      const result = await nomenclaturesService.importFromCsv(csvData, 1);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        nomenclature_name: 'Import Nomenclature',
        bill_name: 'Import Bill',
        account_name: 'Import Account',
        operation_name: 'Import Operation',
        is_fact: true,
        is_active: true,
        user_id: 1
      });
      expect(result[1]).toMatchObject({
        nomenclature_name: 'Another Nomenclature',
        bill_name: 'Another Bill',
        account_name: 'Another Account',
        operation_name: 'Another Operation',
        is_fact: false,
        is_active: false,
        user_id: 1
      });
    });

    it('should handle CSV with quoted fields', async () => {
      const quotedCsvData = `ID,Номенклатура,Статья бюджета,Название счета,Название операции,Факт,Статус,Дата создания
1,"Name with, comma","Bill, with comma","Account, with comma","Operation, with comma",Да,Активен,01.01.2024`;

      const result = await nomenclaturesService.importFromCsv(quotedCsvData, 1);

      expect(result[0]).toMatchObject({
        nomenclature_name: 'Name with, comma',
        bill_name: 'Bill, with comma',
        account_name: 'Account, with comma',
        operation_name: 'Operation, with comma'
      });
    });

    it('should skip empty lines', async () => {
      const csvWithEmptyLines = `ID,Номенклатура,Статья бюджета,Название счета,Название операции,Факт,Статус,Дата создания

1,"Test","Bill","Account","Operation",Да,Активен,01.01.2024

2,"Test2","Bill2","Account2","Operation2",Нет,Неактивен,02.01.2024
`;

      const result = await nomenclaturesService.importFromCsv(csvWithEmptyLines, 1);

      expect(result).toHaveLength(2);
    });

    it('should handle empty CSV (only header)', async () => {
      const headerOnlyCsv = 'ID,Номенклатура,Статья бюджета,Название счета,Название операции,Факт,Статус,Дата создания';

      const result = await nomenclaturesService.importFromCsv(headerOnlyCsv, 1);

      expect(result).toEqual([]);
    });

    it('should parse boolean values correctly', async () => {
      const booleanTestCsv = `ID,Номенклатура,Статья бюджета,Название счета,Название операции,Факт,Статус,Дата создания
1,"Test1","Bill1","Account1","Operation1",Да,Активен,01.01.2024
2,"Test2","Bill2","Account2","Operation2",Нет,Неактивен,02.01.2024`;

      const result = await nomenclaturesService.importFromCsv(booleanTestCsv, 1);

      expect(result[0].is_fact).toBe(true);
      expect(result[0].is_active).toBe(true);
      expect(result[1].is_fact).toBe(false);
      expect(result[1].is_active).toBe(false);
    });

    it('should handle malformed CSV gracefully', async () => {
      const malformedCsv = `ID,Номенклатура,Статья бюджета,Название счета,Название операции,Факт,Статус,Дата создания
1,"Test","Bill","Account"`;

      const result = await nomenclaturesService.importFromCsv(malformedCsv, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        nomenclature_name: 'Test',
        bill_name: 'Bill',
        account_name: 'Account',
        operation_name: '', // Missing field should default to empty string
        user_id: 1
      });
    });

    it('should apply user_id to all imported items', async () => {
      const result = await nomenclaturesService.importFromCsv(csvData, 999);

      result.forEach(item => {
        expect(item.user_id).toBe(999);
      });
    });
  });

  describe('Service initialization', () => {
    it('should initialize with correct endpoint', () => {
      expect(nomenclaturesService).toBeDefined();
      // BaseService should be initialized with '/nomenclatures' endpoint
    });
  });
});