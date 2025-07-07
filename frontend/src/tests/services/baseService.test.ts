import { BaseService } from '../../services/baseService';
import { apiClient } from '../../services/apiClient';

jest.mock('../../services/apiClient');

interface TestModel {
  id: number;
  name: string;
}

class TestService extends BaseService<TestModel> {
  constructor() {
    super('/test');
  }
}

describe('BaseService', () => {
  let service: TestService;
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

  beforeEach(() => {
    service = new TestService();
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('fetches all items', async () => {
      const mockData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      mockApiClient.get.mockResolvedValue(mockData);

      const result = await service.getAll();

      expect(mockApiClient.get).toHaveBeenCalledWith('/test');
      expect(result).toEqual(mockData);
    });

    it('handles errors', async () => {
      const error = new Error('Failed to fetch');
      mockApiClient.get.mockRejectedValue(error);

      await expect(service.getAll()).rejects.toThrow('Failed to fetch');
    });
  });

  describe('getById', () => {
    it('fetches item by id', async () => {
      const mockData = { id: 1, name: 'Item 1' };
      mockApiClient.get.mockResolvedValue(mockData);

      const result = await service.getById(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/test/1');
      expect(result).toEqual(mockData);
    });
  });

  describe('create', () => {
    it('creates new item', async () => {
      const newItem = { name: 'New Item' };
      const createdItem = { id: 3, name: 'New Item' };
      mockApiClient.post.mockResolvedValue(createdItem);

      const result = await service.create(newItem);

      expect(mockApiClient.post).toHaveBeenCalledWith('/test', newItem);
      expect(result).toEqual(createdItem);
    });
  });

  describe('update', () => {
    it('updates existing item', async () => {
      const updatedItem = { id: 1, name: 'Updated Item' };
      mockApiClient.put.mockResolvedValue(updatedItem);

      const result = await service.update(1, updatedItem);

      expect(mockApiClient.put).toHaveBeenCalledWith('/test/1', updatedItem);
      expect(result).toEqual(updatedItem);
    });
  });

  describe('delete', () => {
    it('deletes item', async () => {
      mockApiClient.delete.mockResolvedValue(undefined);

      await service.delete(1);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/test/1');
    });
  });

  describe('custom endpoints', () => {
    it('makes get request to custom endpoint', async () => {
      const mockData = { custom: 'data' };
      mockApiClient.get.mockResolvedValue(mockData);

      const result = await service.get('/custom-endpoint', { param: 'value' });

      expect(mockApiClient.get).toHaveBeenCalledWith('/test/custom-endpoint', {
        params: { param: 'value' },
      });
      expect(result).toEqual(mockData);
    });

    it('makes post request to custom endpoint', async () => {
      const payload = { data: 'value' };
      const response = { success: true };
      mockApiClient.post.mockResolvedValue(response);

      const result = await service.post('/custom-action', payload);

      expect(mockApiClient.post).toHaveBeenCalledWith('/test/custom-action', payload);
      expect(result).toEqual(response);
    });
  });
});