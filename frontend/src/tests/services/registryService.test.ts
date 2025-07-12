import { registryService } from '../../services/registryService';
import { apiClient } from '../../services/apiClient';

jest.mock('../../services/apiClient');

describe('RegistryService', () => {
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFacts', () => {
    it('fetches facts', async () => {
      const mockData = [
        { id: 1, operation_dttm: '2025-01-07', cost_sum: 100, row_type_id: 1 },
        { id: 2, operation_dttm: '2025-01-06', cost_sum: 200, row_type_id: 1 },
      ];
      mockApiClient.get.mockResolvedValue({ data: mockData });

      const result = await registryService.getFacts();

      expect(mockApiClient.get).toHaveBeenCalledWith('/registry', {
        params: { row_type_id: 1 },
      });
      expect(result).toEqual(mockData);
    });

    it('fetches facts with filters', async () => {
      const mockData = [
        { id: 1, operation_dttm: '2025-01-07', cost_sum: 100, row_type_id: 1 },
      ];
      mockApiClient.get.mockResolvedValue({ data: mockData });

      const result = await registryService.getFacts({ period_id: 1 });

      expect(mockApiClient.get).toHaveBeenCalledWith('/registry', {
        params: { period_id: 1, row_type_id: 1 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('getBudget', () => {
    it('fetches budget entries', async () => {
      const mockData = [
        { id: 3, period_id: 1, cost_sum: 1000, row_type_id: 2 },
        { id: 4, period_id: 1, cost_sum: 2000, row_type_id: 2 },
      ];
      mockApiClient.get.mockResolvedValue({ data: mockData });

      const result = await registryService.getBudget();

      expect(mockApiClient.get).toHaveBeenCalledWith('/registry', {
        params: { row_type_id: 2 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('create', () => {
    it('creates registry entry', async () => {
      const newEntry = {
        operation_dttm: '2025-01-07',
        period_id: 1,
        financial_center_id: 1,
        nomenclature_id: 1,
        cost_sum: 150,
        row_type_id: 1,
      };
      const createdEntry = { id: 5, ...newEntry };
      mockApiClient.post.mockResolvedValue({ data: createdEntry });

      const result = await registryService.create(newEntry);

      expect(mockApiClient.post).toHaveBeenCalledWith('/registry', newEntry);
      expect(result).toEqual(createdEntry);
    });
  });

  describe('getSummaryByPeriod', () => {
    it('gets summary by period', async () => {
      const mockData = {
        total_facts: 1500,
        total_budget: 2000,
        variance: -500,
        variance_percent: -25
      };
      mockApiClient.get.mockResolvedValue({ data: mockData });

      const result = await registryService.getSummaryByPeriod(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/registry/summary/period/1');
      expect(result).toEqual(mockData);
    });
  });

  describe('error handling', () => {
    it('handles API errors correctly', async () => {
      const error = new Error('API Error');
      mockApiClient.get.mockRejectedValue(error);

      await expect(registryService.getFacts()).rejects.toThrow();
    });
  });
});