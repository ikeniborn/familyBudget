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
      mockApiClient.get.mockResolvedValue({ data: mockData });

      const result = await service.getAll();

      expect(mockApiClient.get).toHaveBeenCalledWith('/test', { params: undefined });
      expect(result).toEqual(mockData);
    });

    it('handles errors', async () => {
      const error = new Error('Failed to fetch');
      mockApiClient.get.mockRejectedValue(error);

      await expect(service.getAll()).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('fetches item by id', async () => {
      const mockData = { id: 1, name: 'Item 1' };
      mockApiClient.get.mockResolvedValue({ data: mockData });

      const result = await service.getById(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/test/1');
      expect(result).toEqual(mockData);
    });
  });

  describe('create', () => {
    it('creates new item', async () => {
      const newItem = { name: 'New Item' };
      const createdItem = { id: 3, name: 'New Item' };
      mockApiClient.post.mockResolvedValue({ data: createdItem });

      const result = await service.create(newItem);

      expect(mockApiClient.post).toHaveBeenCalledWith('/test', newItem);
      expect(result).toEqual(createdItem);
    });
  });

  describe('update', () => {
    it('updates existing item', async () => {
      const updatedItem = { id: 1, name: 'Updated Item' };
      mockApiClient.put.mockResolvedValue({ data: updatedItem });

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

  describe('pagination', () => {
    it('gets paginated data with default params', async () => {
      const mockData = {
        data: [{ id: 1, name: 'Item 1' }],
        total: 1,
        page: 1,
        totalPages: 1
      };
      mockApiClient.get.mockResolvedValue({ data: mockData });

      const result = await service.getPaginated();

      expect(mockApiClient.get).toHaveBeenCalledWith('/test', { params: {} });
      expect(result).toEqual(mockData);
    });

    it('gets paginated data with custom params', async () => {
      const mockData = {
        data: [{ id: 1, name: 'Item 1' }],
        total: 10,
        page: 2,
        totalPages: 5
      };
      mockApiClient.get.mockResolvedValue({ data: mockData });

      const result = await service.getPaginated({ page: 2, limit: 2 });

      expect(mockApiClient.get).toHaveBeenCalledWith('/test', { 
        params: { page: 2, limit: 2 } 
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('patch', () => {
    it('patches existing item', async () => {
      const patchData = { name: 'Patched Item' };
      const updatedItem = { id: 1, name: 'Patched Item' };
      mockApiClient.patch.mockResolvedValue({ data: updatedItem });

      const result = await service.patch(1, patchData);

      expect(mockApiClient.patch).toHaveBeenCalledWith('/test/1', patchData);
      expect(result).toEqual(updatedItem);
    });
  });
});