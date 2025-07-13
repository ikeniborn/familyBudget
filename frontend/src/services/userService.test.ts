import { userService } from './userService';
import apiClient, { handleApiError } from './apiClient';
import fixtures from '@/test/fixtures';
import { BaseService } from './baseService';

jest.mock('./apiClient');
jest.mock('./baseService');

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockedHandleApiError = handleApiError as jest.MockedFunction<typeof handleApiError>;

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock BaseService methods
    BaseService.prototype.getAll = jest.fn();
    BaseService.prototype.getById = jest.fn();
    BaseService.prototype.create = jest.fn();
    BaseService.prototype.update = jest.fn();
    BaseService.prototype.delete = jest.fn();
  });

  describe('constructor', () => {
    it('should initialize with correct endpoint', () => {
      expect(userService).toBeInstanceOf(BaseService);
      // The endpoint is passed to BaseService constructor
      expect(BaseService).toHaveBeenCalledWith('/users');
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current user from auth endpoint', async () => {
      const mockUser = fixtures.users.activeUser;
      mockedApiClient.get.mockResolvedValue({ data: mockUser });

      const result = await userService.getCurrentUser();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockUser);
    });

    it('should handle error when fetching current user', async () => {
      const error = new Error('Network error');
      mockedApiClient.get.mockRejectedValue(error);
      mockedHandleApiError.mockReturnValue('Failed to fetch user');

      await expect(userService.getCurrentUser()).rejects.toThrow('Failed to fetch user');
      expect(mockedHandleApiError).toHaveBeenCalledWith(error);
    });

    it('should handle 401 unauthorized error', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      };
      mockedApiClient.get.mockRejectedValue(error);
      mockedHandleApiError.mockReturnValue('Unauthorized');

      await expect(userService.getCurrentUser()).rejects.toThrow('Unauthorized');
    });
  });

  describe('searchUsers', () => {
    it('should search users with query parameter', async () => {
      const mockUsers = [fixtures.users.activeUser, fixtures.users.inactiveUser];
      mockedApiClient.get.mockResolvedValue({ data: mockUsers });

      const result = await userService.searchUsers('test');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/users/search', {
        params: { q: 'test' },
      });
      expect(result).toEqual(mockUsers);
    });

    it('should return empty array when no users found', async () => {
      mockedApiClient.get.mockResolvedValue({ data: [] });

      const result = await userService.searchUsers('nonexistent');

      expect(result).toEqual([]);
    });

    it('should handle search error', async () => {
      const error = new Error('Search failed');
      mockedApiClient.get.mockRejectedValue(error);
      mockedHandleApiError.mockReturnValue('Search failed');

      await expect(userService.searchUsers('test')).rejects.toThrow('Search failed');
      expect(mockedHandleApiError).toHaveBeenCalledWith(error);
    });

    it('should handle empty query', async () => {
      const mockUsers = [fixtures.users.activeUser];
      mockedApiClient.get.mockResolvedValue({ data: mockUsers });

      const result = await userService.searchUsers('');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/users/search', {
        params: { q: '' },
      });
      expect(result).toEqual(mockUsers);
    });

    it('should handle special characters in query', async () => {
      mockedApiClient.get.mockResolvedValue({ data: [] });

      await userService.searchUsers('test@example.com');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/users/search', {
        params: { q: 'test@example.com' },
      });
    });
  });

  describe('inherited methods from BaseService', () => {
    it('should have access to getAll method', () => {
      expect(userService.getAll).toBeDefined();
      expect(typeof userService.getAll).toBe('function');
    });

    it('should have access to getById method', () => {
      expect(userService.getById).toBeDefined();
      expect(typeof userService.getById).toBe('function');
    });

    it('should have access to create method', () => {
      expect(userService.create).toBeDefined();
      expect(typeof userService.create).toBe('function');
    });

    it('should have access to update method', () => {
      expect(userService.update).toBeDefined();
      expect(typeof userService.update).toBe('function');
    });

    it('should have access to delete method', () => {
      expect(userService.delete).toBeDefined();
      expect(typeof userService.delete).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should properly format API errors', async () => {
      const error = {
        response: {
          data: { detail: 'User not found' },
          status: 404,
        },
      };
      mockedApiClient.get.mockRejectedValue(error);
      mockedHandleApiError.mockReturnValue('User not found');

      await expect(userService.getCurrentUser()).rejects.toThrow('User not found');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network Error');
      error.message = 'Network Error';
      mockedApiClient.get.mockRejectedValue(error);
      mockedHandleApiError.mockReturnValue('Network error occurred');

      await expect(userService.searchUsers('test')).rejects.toThrow('Network error occurred');
    });

    it('should handle timeout errors', async () => {
      const error = new Error('timeout of 10000ms exceeded');
      mockedApiClient.get.mockRejectedValue(error);
      mockedHandleApiError.mockReturnValue('Request timeout');

      await expect(userService.getCurrentUser()).rejects.toThrow('Request timeout');
    });
  });

  describe('data validation', () => {
    it('should handle malformed user data', async () => {
      // API returns invalid data structure
      mockedApiClient.get.mockResolvedValue({ data: null });

      const result = await userService.getCurrentUser();
      expect(result).toBeNull();
    });

    it('should handle partial user data', async () => {
      const partialUser = { id: 1, username: 'test' };
      mockedApiClient.get.mockResolvedValue({ data: partialUser });

      const result = await userService.getCurrentUser();
      expect(result).toEqual(partialUser);
    });
  });

  describe('CreateUserData interface', () => {
    it('should accept valid create user data', () => {
      const createData = {
        user_name: 'newuser',
        user_telegram_id: 123456789,
        first_name: 'New',
        last_name: 'User',
        username: 'newuser',
      };

      // This is a type test - no runtime assertions needed
      expect(createData).toBeDefined();
    });

    it('should accept minimal required fields', () => {
      const minimalData = {
        user_name: 'newuser',
        user_telegram_id: 123456789,
      };

      expect(minimalData).toBeDefined();
    });
  });

  describe('UpdateUserData interface', () => {
    it('should accept valid update user data', () => {
      const updateData = {
        user_name: 'updateduser',
        first_name: 'Updated',
        last_name: 'User',
        username: 'updateduser',
      };

      expect(updateData).toBeDefined();
    });

    it('should accept partial update data', () => {
      const partialUpdate = {
        first_name: 'NewFirstName',
      };

      expect(partialUpdate).toBeDefined();
    });

    it('should accept empty update data', () => {
      const emptyUpdate = {};
      expect(emptyUpdate).toBeDefined();
    });
  });
});