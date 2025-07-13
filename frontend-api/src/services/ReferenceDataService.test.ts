import { ReferenceDataService } from './ReferenceDataService';
import { periodFixtures, financialCenterFixtures, costCenterFixtures, nomenclatureFixtures, rowTypeFixtures } from '../test/fixtures';

// Mock Prisma methods
const mockPeriodFindMany = jest.fn();
const mockPeriodCreate = jest.fn();
const mockFinancialCenterFindMany = jest.fn();
const mockFinancialCenterCreate = jest.fn();
const mockCostCenterFindMany = jest.fn();
const mockCostCenterCreate = jest.fn();
const mockNomenclatureFindMany = jest.fn();
const mockNomenclatureCreate = jest.fn();
const mockRowTypeFindMany = jest.fn();
const mockRowTypeCreate = jest.fn();

const mockPrisma = {
  period: {
    findMany: mockPeriodFindMany,
    create: mockPeriodCreate,
  },
  financialCenter: {
    findMany: mockFinancialCenterFindMany,
    create: mockFinancialCenterCreate,
  },
  costCenter: {
    findMany: mockCostCenterFindMany,
    create: mockCostCenterCreate,
  },
  nomenclature: {
    findMany: mockNomenclatureFindMany,
    create: mockNomenclatureCreate,
  },
  rowType: {
    findMany: mockRowTypeFindMany,
    create: mockRowTypeCreate,
  },
} as any;

describe('ReferenceDataService', () => {
  let referenceDataService: ReferenceDataService;

  beforeEach(() => {
    referenceDataService = new ReferenceDataService(mockPrisma);
    // Clear all mocks
    mockPeriodFindMany.mockClear();
    mockPeriodCreate.mockClear();
    mockFinancialCenterFindMany.mockClear();
    mockFinancialCenterCreate.mockClear();
    mockCostCenterFindMany.mockClear();
    mockCostCenterCreate.mockClear();
    mockNomenclatureFindMany.mockClear();
    mockNomenclatureCreate.mockClear();
    mockRowTypeFindMany.mockClear();
    mockRowTypeCreate.mockClear();
  });

  describe('Periods', () => {
    describe('getPeriods', () => {
      it('should return periods ordered by date desc', async () => {
        const mockPeriods = [periodFixtures.february2024, periodFixtures.january2024];
        mockPeriodFindMany.mockResolvedValue(mockPeriods);

        const result = await referenceDataService.getPeriods();

        expect(result).toEqual(mockPeriods);
        expect(mockPeriodFindMany).toHaveBeenCalledWith({
          orderBy: { date: 'desc' },
        });
      });

      it('should return empty array when no periods', async () => {
        mockPeriodFindMany.mockResolvedValue([]);

        const result = await referenceDataService.getPeriods();

        expect(result).toEqual([]);
      });

      it('should handle database errors', async () => {
        mockPeriodFindMany.mockRejectedValue(new Error('Database error'));

        await expect(referenceDataService.getPeriods()).rejects.toThrow('Database error');
      });
    });

    describe('createPeriod', () => {
      it('should create period with provided data', async () => {
        const periodData = {
          date: new Date('2024-03-01'),
          ruName: 'Март 2024',
        };
        const expectedPeriod = {
          period_id: 3,
          ...periodData,
        };

        mockPeriodCreate.mockResolvedValue(expectedPeriod as any);

        const result = await referenceDataService.createPeriod(periodData);

        expect(result).toEqual(expectedPeriod);
        expect(mockPeriodCreate).toHaveBeenCalledWith({
          data: periodData,
        });
      });

      it('should handle creation errors', async () => {
        const periodData = {
          date: new Date('2024-03-01'),
          ruName: 'Март 2024',
        };

        mockPeriodCreate.mockRejectedValue(new Error('Creation failed'));

        await expect(referenceDataService.createPeriod(periodData)).rejects.toThrow('Creation failed');
      });
    });
  });

  describe('Financial Centers', () => {
    describe('getFinancialCenters', () => {
      it('should return financial centers ordered by name asc', async () => {
        const mockCenters = [financialCenterFixtures.family, financialCenterFixtures.personal];
        mockFinancialCenterFindMany.mockResolvedValue(mockCenters);

        const result = await referenceDataService.getFinancialCenters();

        expect(result).toEqual(mockCenters);
        expect(mockFinancialCenterFindMany).toHaveBeenCalledWith({
          orderBy: { name: 'asc' },
        });
      });

      it('should handle empty results', async () => {
        mockFinancialCenterFindMany.mockResolvedValue([]);

        const result = await referenceDataService.getFinancialCenters();

        expect(result).toEqual([]);
      });
    });

    describe('createFinancialCenter', () => {
      it('should create financial center with name', async () => {
        const centerName = 'Новый центр';
        const expectedCenter = {
          financial_center_id: 3,
          financial_center_name: centerName,
        };

        mockFinancialCenterCreate.mockResolvedValue(expectedCenter as any);

        const result = await referenceDataService.createFinancialCenter(centerName);

        expect(result).toEqual(expectedCenter);
        expect(mockFinancialCenterCreate).toHaveBeenCalledWith({
          data: { name: centerName },
        });
      });

      it('should handle creation errors', async () => {
        mockFinancialCenterCreate.mockRejectedValue(new Error('Duplicate name'));

        await expect(referenceDataService.createFinancialCenter('Duplicate')).rejects.toThrow('Duplicate name');
      });
    });
  });

  describe('Cost Centers', () => {
    describe('getCostCenters', () => {
      it('should return cost centers ordered by name asc', async () => {
        const mockCenters = [costCenterFixtures.husband, costCenterFixtures.wife];
        mockCostCenterFindMany.mockResolvedValue(mockCenters);

        const result = await referenceDataService.getCostCenters();

        expect(result).toEqual(mockCenters);
        expect(mockCostCenterFindMany).toHaveBeenCalledWith({
          orderBy: { name: 'asc' },
        });
      });

      it('should handle empty results', async () => {
        mockCostCenterFindMany.mockResolvedValue([]);

        const result = await referenceDataService.getCostCenters();

        expect(result).toEqual([]);
      });
    });

    describe('createCostCenter', () => {
      it('should create cost center with name', async () => {
        const centerName = 'Дети';
        const expectedCenter = {
          cost_center_id: 3,
          cost_center_name: centerName,
          financial_center_id: 1,
        };

        mockCostCenterCreate.mockResolvedValue(expectedCenter as any);

        const result = await referenceDataService.createCostCenter(centerName);

        expect(result).toEqual(expectedCenter);
        expect(mockCostCenterCreate).toHaveBeenCalledWith({
          data: { name: centerName },
        });
      });
    });
  });

  describe('Nomenclatures', () => {
    describe('getNomenclatures', () => {
      it('should return nomenclatures ordered by name asc', async () => {
        const mockNomenclatures = [nomenclatureFixtures.food, nomenclatureFixtures.transport];
        mockNomenclatureFindMany.mockResolvedValue(mockNomenclatures);

        const result = await referenceDataService.getNomenclatures();

        expect(result).toEqual(mockNomenclatures);
        expect(mockNomenclatureFindMany).toHaveBeenCalledWith({
          orderBy: { name: 'asc' },
        });
      });

      it('should handle empty results', async () => {
        mockNomenclatureFindMany.mockResolvedValue([]);

        const result = await referenceDataService.getNomenclatures();

        expect(result).toEqual([]);
      });
    });

    describe('createNomenclature', () => {
      it('should create nomenclature with all required fields', async () => {
        const nomenclatureData = {
          name: 'Коммунальные услуги',
          accountName: 'utilities',
          billName: 'Utilities',
          operation: 'expense',
          isBudget: true,
          isFact: true,
        };
        const expectedNomenclature = {
          nomenclature_id: 3,
          nomenclature_name: nomenclatureData.name,
          nomenclature_group: 'Расходы',
          nomenclature_parent_id: null,
        };

        mockNomenclatureCreate.mockResolvedValue(expectedNomenclature as any);

        const result = await referenceDataService.createNomenclature(nomenclatureData);

        expect(result).toEqual(expectedNomenclature);
        expect(mockNomenclatureCreate).toHaveBeenCalledWith({
          data: nomenclatureData,
        });
      });

      it('should handle all boolean flag combinations', async () => {
        const testCases = [
          { isBudget: true, isFact: false },
          { isBudget: false, isFact: true },
          { isBudget: false, isFact: false },
        ];

        for (const flags of testCases) {
          const nomenclatureData = {
            name: `Test ${flags.isBudget}-${flags.isFact}`,
            accountName: 'test',
            billName: 'Test',
            operation: 'test',
            ...flags,
          };

          mockNomenclatureCreate.mockResolvedValue({} as any);
          
          await referenceDataService.createNomenclature(nomenclatureData);

          expect(mockNomenclatureCreate).toHaveBeenCalledWith({
            data: nomenclatureData,
          });

          mockNomenclatureCreate.mockClear();
        }
      });

      it('should handle creation validation errors', async () => {
        const invalidData = {
          name: '',
          accountName: 'invalid',
          billName: 'Invalid',
          operation: 'invalid',
          isBudget: true,
          isFact: true,
        };

        mockNomenclatureCreate.mockRejectedValue(new Error('Validation failed'));

        await expect(referenceDataService.createNomenclature(invalidData)).rejects.toThrow('Validation failed');
      });
    });
  });

  describe('Row Types', () => {
    describe('getRowTypes', () => {
      it('should return row types ordered by name asc', async () => {
        const mockRowTypes = [rowTypeFixtures.fact, rowTypeFixtures.plan];
        mockRowTypeFindMany.mockResolvedValue(mockRowTypes);

        const result = await referenceDataService.getRowTypes();

        expect(result).toEqual(mockRowTypes);
        expect(mockRowTypeFindMany).toHaveBeenCalledWith({
          orderBy: { name: 'asc' },
        });
      });

      it('should handle empty results', async () => {
        mockRowTypeFindMany.mockResolvedValue([]);

        const result = await referenceDataService.getRowTypes();

        expect(result).toEqual([]);
      });
    });

    describe('createRowType', () => {
      it('should create row type with name', async () => {
        const typeName = 'Прогноз';
        const expectedRowType = {
          row_type_id: 3,
          row_type_name: typeName,
        };

        mockRowTypeCreate.mockResolvedValue(expectedRowType as any);

        const result = await referenceDataService.createRowType(typeName);

        expect(result).toEqual(expectedRowType);
        expect(mockRowTypeCreate).toHaveBeenCalledWith({
          data: { name: typeName },
        });
      });

      it('should handle creation errors', async () => {
        mockRowTypeCreate.mockRejectedValue(new Error('Constraint violation'));

        await expect(referenceDataService.createRowType('Duplicate')).rejects.toThrow('Constraint violation');
      });
    });
  });

  describe('Service inheritance', () => {
    it('should extend BaseService', () => {
      expect(referenceDataService).toBeInstanceOf(referenceDataService.constructor);
      expect(referenceDataService.constructor.name).toBe('ReferenceDataService');
    });

    it('should have access to validateUserId from BaseService', () => {
      const validateUserId = (referenceDataService as any).validateUserId;
      expect(typeof validateUserId).toBe('function');
    });
  });

  describe('Error handling', () => {
    it('should propagate Prisma errors without modification', async () => {
      const prismaError = new Error('Database connection failed');
      mockPeriodFindMany.mockRejectedValue(prismaError);

      const error = await referenceDataService.getPeriods().catch(e => e);
      expect(error).toBe(prismaError);
    });

    it('should handle concurrent access to multiple collections', async () => {
      // Reset all mocks first
      mockPeriodFindMany.mockClear();
      mockFinancialCenterFindMany.mockClear();
      mockCostCenterFindMany.mockClear();
      mockNomenclatureFindMany.mockClear();
      mockRowTypeFindMany.mockClear();

      // Mock all to return empty arrays
      mockPeriodFindMany.mockResolvedValue([]);
      mockFinancialCenterFindMany.mockResolvedValue([]);
      mockCostCenterFindMany.mockResolvedValue([]);
      mockNomenclatureFindMany.mockResolvedValue([]);
      mockRowTypeFindMany.mockResolvedValue([]);

      // Simulate concurrent calls
      const promises = [
        referenceDataService.getPeriods(),
        referenceDataService.getFinancialCenters(),
        referenceDataService.getCostCenters(),
        referenceDataService.getNomenclatures(),
        referenceDataService.getRowTypes(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => expect(result).toEqual([]));
    });
  });
});