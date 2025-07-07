import { registryService } from '../../services/registryService';
import { apiClient } from '../../services/apiClient';

jest.mock('../../services/apiClient');

describe('RegistryService', () => {
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLatestFacts', () => {
    it('fetches latest facts with default limit', async () => {
      const mockData = [
        { id: 1, operation_dttm: '2025-01-07', cost_sum: 100 },
        { id: 2, operation_dttm: '2025-01-06', cost_sum: 200 },
      ];
      mockApiClient.get.mockResolvedValue(mockData);

      const result = await registryService.getLatestFacts();

      expect(mockApiClient.get).toHaveBeenCalledWith('/registry/latest-facts', {
        params: { limit: 10 },
      });
      expect(result).toEqual(mockData);
    });

    it('fetches latest facts with custom limit', async () => {
      const mockData = [
        { id: 1, operation_dttm: '2025-01-07', cost_sum: 100 },
      ];
      mockApiClient.get.mockResolvedValue(mockData);

      const result = await registryService.getLatestFacts(5);

      expect(mockApiClient.get).toHaveBeenCalledWith('/registry/latest-facts', {
        params: { limit: 5 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('getLatestBudgets', () => {
    it('fetches latest budgets with default limit', async () => {
      const mockData = [
        { id: 3, period_id: 1, cost_sum: 1000 },
        { id: 4, period_id: 1, cost_sum: 2000 },
      ];
      mockApiClient.get.mockResolvedValue(mockData);

      const result = await registryService.getLatestBudgets();

      expect(mockApiClient.get).toHaveBeenCalledWith('/registry/latest-budgets', {
        params: { limit: 10 },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('createFact', () => {
    it('creates fact entry', async () => {
      const newFact = {
        operation_dttm: '2025-01-07',
        period_id: 1,
        financial_center_id: 1,
        nomenclature_id: 1,
        cost_sum: 150,
        row_type_id: 2,
      };
      const createdFact = { id: 5, ...newFact };
      mockApiClient.post.mockResolvedValue(createdFact);

      const result = await registryService.createFact(newFact);

      expect(mockApiClient.post).toHaveBeenCalledWith('/registry/fact', newFact);
      expect(result).toEqual(createdFact);
    });
  });

  describe('createBudget', () => {
    it('creates budget entry', async () => {
      const newBudget = {
        period_id: 1,
        financial_center_id: 1,
        nomenclature_id: 1,
        cost_sum: 5000,
        row_type_id: 1,
      };
      const createdBudget = { id: 6, ...newBudget };
      mockApiClient.post.mockResolvedValue(createdBudget);

      const result = await registryService.createBudget(newBudget);

      expect(mockApiClient.post).toHaveBeenCalledWith('/registry/budget', newBudget);
      expect(result).toEqual(createdBudget);
    });
  });

  describe('error handling', () => {
    it('handles API errors correctly', async () => {
      const error = new Error('API Error');
      mockApiClient.get.mockRejectedValue(error);

      await expect(registryService.getLatestFacts()).rejects.toThrow('API Error');
    });
  });
});