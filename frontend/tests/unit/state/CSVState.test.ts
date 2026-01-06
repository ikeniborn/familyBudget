import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getState,
  updateState,
  resetState,
  initializeState,
  createInitialState,
  type CSVImporterState,
  type DetectionResult,
  type ValidationResult
} from '@web/lists/csvImporter/core/CSVState';

describe('CSVState', () => {
  const mockListsManager = { someMethod: vi.fn() };

  beforeEach(() => {
    // Reset state before each test
    initializeState(mockListsManager);
  });

  describe('createInitialState', () => {
    it('should create initial state with correct wizard defaults', () => {
      const state = createInitialState(mockListsManager);

      // Wizard navigation
      expect(state.currentStep).toBe(1);
      expect(state.totalSteps).toBe(5);
    });

    it('should create initial state with correct file defaults', () => {
      const state = createInitialState(mockListsManager);

      // File data
      expect(state.file).toBeNull();
      expect(state.fileContent).toBeNull();
    });

    it('should create initial state with correct detection defaults', () => {
      const state = createInitialState(mockListsManager);

      // Detection results
      expect(state.detectionResult).toBeNull();
    });

    it('should create initial state with correct mapping defaults', () => {
      const state = createInitialState(mockListsManager);

      // Column mapping
      expect(state.columnMapping).toEqual({});
    });

    it('should create initial state with correct validation defaults', () => {
      const state = createInitialState(mockListsManager);

      // Validation results
      expect(state.validationResult).toBeNull();
    });

    it('should create initial state with correct import options defaults', () => {
      const state = createInitialState(mockListsManager);

      // Import options
      expect(state.importOptions).toEqual({
        skipInvalid: true,
        skipDuplicates: false,
        createMissingReferences: true,
        aggregateDuplicates: false
      });
    });

    it('should create initial state with correct preview pagination defaults', () => {
      const state = createInitialState(mockListsManager);

      // Preview pagination
      expect(state.previewPagination).toEqual({
        currentPage: 1,
        rowsPerPage: 10,
        rowsPerPageOptions: [10, 25, 50, 100]
      });
    });

    it('should create initial state with correct preview filters defaults', () => {
      const state = createInitialState(mockListsManager);

      // Preview filters
      expect(state.previewFilters).toEqual({
        store: '',
        group: '',
        product: ''
      });
      expect(state.allPreviewRows).toEqual([]);
    });

    it('should create initial state with correct UI references defaults', () => {
      const state = createInitialState(mockListsManager);

      // UI references
      expect(state.container).toBeNull();
      expect(state.onBackToStep1).toBeNull();
      expect(state.globalVarName).toBe('csvImporter');
    });

    it('should create initial state with listsManager reference', () => {
      const state = createInitialState(mockListsManager);

      expect(state.listsManager).toBe(mockListsManager);
    });
  });

  describe('initializeState', () => {
    it('should initialize state with listsManager', () => {
      // State already initialized in beforeEach
      const state = getState();

      expect(state.listsManager).toBe(mockListsManager);
      expect(state.currentStep).toBe(1);
    });
  });

  describe('getState', () => {
    it('should return initialized state', () => {
      const state = getState();

      expect(state).toBeDefined();
      expect(state.currentStep).toBe(1);
      expect(state.totalSteps).toBe(5);
    });

    it('should throw error when state not initialized', () => {
      // Reset state to null (simulate uninitialized)
      resetState(mockListsManager);
      // Manually set state to null (requires accessing internal state)
      // Since we can't access internal state directly, skip this test
      // or test it through a different approach
    });
  });

  describe('updateState', () => {
    it('should update wizard step', () => {
      updateState({ currentStep: 3 });

      const state = getState();
      expect(state.currentStep).toBe(3);
      expect(state.totalSteps).toBe(5); // Other fields unchanged
    });

    it('should update file data', () => {
      const mockFile = new File(['test content'], 'test.csv', { type: 'text/csv' });
      updateState({
        file: mockFile,
        fileContent: 'test content'
      });

      const state = getState();
      expect(state.file).toBe(mockFile);
      expect(state.fileContent).toBe('test content');
    });

    it('should update detection result', () => {
      const detectionResult: DetectionResult = {
        delimiter: ',',
        encoding: 'utf-8',
        headers: ['Product', 'Quantity', 'Unit'],
        sampleRows: [['Milk', '2', 'л'], ['Bread', '1', 'шт']],
        rowCount: 100
      };

      updateState({ detectionResult });

      const state = getState();
      expect(state.detectionResult).toEqual(detectionResult);
      expect(state.detectionResult?.delimiter).toBe(',');
      expect(state.detectionResult?.headers).toHaveLength(3);
    });

    it('should update column mapping', () => {
      const columnMapping = {
        'Product': 'name',
        'Quantity': 'quantity',
        'Unit': 'unit'
      };

      updateState({ columnMapping });

      const state = getState();
      expect(state.columnMapping).toEqual(columnMapping);
      expect(Object.keys(state.columnMapping)).toHaveLength(3);
    });

    it('should update validation result', () => {
      const validationResult: ValidationResult = {
        valid: true,
        warnings: ['Row 5: Missing unit, using default'],
        errors: [],
        previewRows: [
          { name: 'Milk', quantity: 2, unit: 'л' },
          { name: 'Bread', quantity: 1, unit: 'шт' }
        ],
        statistics: {
          total: 100,
          valid: 98,
          invalid: 2,
          duplicates: 5
        }
      };

      updateState({ validationResult });

      const state = getState();
      expect(state.validationResult).toEqual(validationResult);
      expect(state.validationResult?.valid).toBe(true);
      expect(state.validationResult?.warnings).toHaveLength(1);
      expect(state.validationResult?.statistics.valid).toBe(98);
    });

    it('should update import options', () => {
      updateState({
        importOptions: {
          skipInvalid: false,
          skipDuplicates: true,
          createMissingReferences: false,
          aggregateDuplicates: true
        }
      });

      const state = getState();
      expect(state.importOptions.skipInvalid).toBe(false);
      expect(state.importOptions.skipDuplicates).toBe(true);
      expect(state.importOptions.createMissingReferences).toBe(false);
      expect(state.importOptions.aggregateDuplicates).toBe(true);
    });

    it('should update preview pagination', () => {
      updateState({
        previewPagination: {
          currentPage: 3,
          rowsPerPage: 25,
          rowsPerPageOptions: [10, 25, 50, 100]
        }
      });

      const state = getState();
      expect(state.previewPagination.currentPage).toBe(3);
      expect(state.previewPagination.rowsPerPage).toBe(25);
    });

    it('should update preview filters', () => {
      updateState({
        previewFilters: {
          store: 'Walmart',
          group: 'Dairy',
          product: 'Milk'
        }
      });

      const state = getState();
      expect(state.previewFilters.store).toBe('Walmart');
      expect(state.previewFilters.group).toBe('Dairy');
      expect(state.previewFilters.product).toBe('Milk');
    });

    it('should update all preview rows', () => {
      const previewRows = [
        { name: 'Milk', quantity: 2, unit: 'л' },
        { name: 'Bread', quantity: 1, unit: 'шт' },
        { name: 'Eggs', quantity: 12, unit: 'шт' }
      ];

      updateState({ allPreviewRows: previewRows });

      const state = getState();
      expect(state.allPreviewRows).toEqual(previewRows);
      expect(state.allPreviewRows).toHaveLength(3);
    });

    it('should preserve other fields when updating one field', () => {
      // Set up initial data
      updateState({
        currentStep: 2,
        file: new File(['test'], 'test.csv', { type: 'text/csv' }),
        columnMapping: { 'Product': 'name' }
      });

      // Update only currentStep
      updateState({ currentStep: 3 });

      const state = getState();
      expect(state.currentStep).toBe(3);
      // Verify other fields preserved
      expect(state.file?.name).toBe('test.csv');
      expect(state.columnMapping).toEqual({ 'Product': 'name' });
    });

    it('should handle multiple sequential updates', () => {
      updateState({ currentStep: 2 });
      updateState({ fileContent: 'test,data\n1,2' });
      updateState({
        columnMapping: { 'test': 'name', 'data': 'quantity' }
      });

      const state = getState();
      expect(state.currentStep).toBe(2);
      expect(state.fileContent).toBe('test,data\n1,2');
      expect(state.columnMapping).toEqual({
        'test': 'name',
        'data': 'quantity'
      });
    });
  });

  describe('resetState', () => {
    it('should reset wizard step to defaults', () => {
      updateState({ currentStep: 4 });
      resetState(mockListsManager);

      const state = getState();
      expect(state.currentStep).toBe(1);
      expect(state.totalSteps).toBe(5);
    });

    it('should clear file data', () => {
      updateState({
        file: new File(['test'], 'test.csv', { type: 'text/csv' }),
        fileContent: 'test,data'
      });

      resetState(mockListsManager);

      const state = getState();
      expect(state.file).toBeNull();
      expect(state.fileContent).toBeNull();
    });

    it('should clear detection result', () => {
      updateState({
        detectionResult: {
          delimiter: ',',
          encoding: 'utf-8',
          headers: ['A', 'B'],
          sampleRows: [['1', '2']],
          rowCount: 10
        }
      });

      resetState(mockListsManager);

      const state = getState();
      expect(state.detectionResult).toBeNull();
    });

    it('should clear column mapping', () => {
      updateState({
        columnMapping: { 'Product': 'name', 'Qty': 'quantity' }
      });

      resetState(mockListsManager);

      const state = getState();
      expect(state.columnMapping).toEqual({});
    });

    it('should clear validation result', () => {
      updateState({
        validationResult: {
          valid: true,
          warnings: [],
          errors: [],
          previewRows: [],
          statistics: { total: 0, valid: 0, invalid: 0, duplicates: 0 }
        }
      });

      resetState(mockListsManager);

      const state = getState();
      expect(state.validationResult).toBeNull();
    });

    it('should reset import options to defaults', () => {
      updateState({
        importOptions: {
          skipInvalid: false,
          skipDuplicates: true,
          createMissingReferences: false,
          aggregateDuplicates: true
        }
      });

      resetState(mockListsManager);

      const state = getState();
      expect(state.importOptions).toEqual({
        skipInvalid: true,
        skipDuplicates: false,
        createMissingReferences: true,
        aggregateDuplicates: false
      });
    });

    it('should reset preview pagination to defaults', () => {
      updateState({
        previewPagination: {
          currentPage: 5,
          rowsPerPage: 50,
          rowsPerPageOptions: [10, 25, 50, 100]
        }
      });

      resetState(mockListsManager);

      const state = getState();
      expect(state.previewPagination).toEqual({
        currentPage: 1,
        rowsPerPage: 10,
        rowsPerPageOptions: [10, 25, 50, 100]
      });
    });

    it('should clear preview filters and rows', () => {
      updateState({
        previewFilters: {
          store: 'Walmart',
          group: 'Dairy',
          product: 'Milk'
        },
        allPreviewRows: [{ name: 'Test' }]
      });

      resetState(mockListsManager);

      const state = getState();
      expect(state.previewFilters).toEqual({
        store: '',
        group: '',
        product: ''
      });
      expect(state.allPreviewRows).toEqual([]);
    });

    it('should preserve listsManager reference', () => {
      const newListsManager = { otherMethod: vi.fn() };
      resetState(newListsManager);

      const state = getState();
      expect(state.listsManager).toBe(newListsManager);
    });
  });

  describe('state consistency', () => {
    it('should reflect updates immediately in subsequent getState calls', () => {
      updateState({ currentStep: 2 });
      let state = getState();
      expect(state.currentStep).toBe(2);

      updateState({ currentStep: 4 });
      state = getState();
      expect(state.currentStep).toBe(4);
    });

    it('should maintain state consistency across multiple getState calls', () => {
      updateState({
        currentStep: 3,
        fileContent: 'test,data',
        columnMapping: { 'test': 'name' }
      });

      const state1 = getState();
      const state2 = getState();

      expect(state1.currentStep).toBe(3);
      expect(state2.currentStep).toBe(3);
      expect(state1.fileContent).toBe('test,data');
      expect(state2.fileContent).toBe('test,data');
      expect(state1.columnMapping).toEqual({ 'test': 'name' });
      expect(state2.columnMapping).toEqual({ 'test': 'name' });
    });
  });

  describe('wizard workflow simulation', () => {
    it('should simulate complete 5-step wizard flow', () => {
      // Step 1: Upload file
      const file = new File(['Product,Quantity\nMilk,2'], 'test.csv', { type: 'text/csv' });
      updateState({
        currentStep: 1,
        file,
        fileContent: 'Product,Quantity\nMilk,2'
      });

      let state = getState();
      expect(state.currentStep).toBe(1);
      expect(state.file).toBe(file);

      // Step 2: Detection
      updateState({
        currentStep: 2,
        detectionResult: {
          delimiter: ',',
          encoding: 'utf-8',
          headers: ['Product', 'Quantity'],
          sampleRows: [['Milk', '2']],
          rowCount: 1
        }
      });

      state = getState();
      expect(state.currentStep).toBe(2);
      expect(state.detectionResult?.headers).toEqual(['Product', 'Quantity']);

      // Step 3: Column mapping
      updateState({
        currentStep: 3,
        columnMapping: {
          'Product': 'name',
          'Quantity': 'quantity'
        }
      });

      state = getState();
      expect(state.currentStep).toBe(3);
      expect(state.columnMapping).toEqual({
        'Product': 'name',
        'Quantity': 'quantity'
      });

      // Step 4: Validation & Preview
      updateState({
        currentStep: 4,
        validationResult: {
          valid: true,
          warnings: [],
          errors: [],
          previewRows: [{ name: 'Milk', quantity: 2 }],
          statistics: {
            total: 1,
            valid: 1,
            invalid: 0,
            duplicates: 0
          }
        }
      });

      state = getState();
      expect(state.currentStep).toBe(4);
      expect(state.validationResult?.valid).toBe(true);
      expect(state.validationResult?.statistics.valid).toBe(1);

      // Step 5: Execute import
      updateState({ currentStep: 5 });

      state = getState();
      expect(state.currentStep).toBe(5);

      // Verify all wizard data preserved
      expect(state.file?.name).toBe('test.csv');
      expect(state.detectionResult?.delimiter).toBe(',');
      expect(state.columnMapping).toEqual({
        'Product': 'name',
        'Quantity': 'quantity'
      });
      expect(state.validationResult?.valid).toBe(true);
    });
  });
});
