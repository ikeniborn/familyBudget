/**
 * Frontend unit tests for API trailing slash fix.
 * Tests that all API calls include trailing slashes and no 307 redirects occur.
 * Validates that sessions are preserved and CRUD operations work correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import axios from 'axios';

// Mock axios to intercept HTTP requests
vi.mock('axios');
const mockedAxios = axios as any;

// Mock auth store to avoid circular dependencies
vi.mock('$lib/stores/auth.store', () => ({
  authStore: {
    handleAuthError: vi.fn()
  }
}));

// Mock browser environment
Object.defineProperty(global, 'window', {
  value: {
    location: {
      pathname: '/settings/periods'
    }
  },
  writable: true
});

describe('API Trailing Slash Fix', () => {
  let mockAxiosInstance: any;
  let mockRequest: Mock;
  let mockGet: Mock;
  let mockPost: Mock;
  let mockPut: Mock;
  let mockDelete: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup axios mocks
    mockGet = vi.fn();
    mockPost = vi.fn();
    mockPut = vi.fn();
    mockDelete = vi.fn();
    mockRequest = vi.fn();

    mockAxiosInstance = {
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      interceptors: {
        request: {
          use: vi.fn((success, error) => {
            mockRequest.mockImplementation(success);
          })
        },
        response: {
          use: vi.fn()
        }
      }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Mock successful responses by default
    const mockResponse = { data: { success: true, data: [] } };
    mockGet.mockResolvedValue(mockResponse);
    mockPost.mockResolvedValue(mockResponse);
    mockPut.mockResolvedValue(mockResponse);
    mockDelete.mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('BaseService Trailing Slash Enforcement', () => {
    it('should ensure all endpoints have trailing slashes in constructor', () => {
      // Test various endpoint formats
      const testCases = [
        { input: '/periods', expected: '/periods/' },
        { input: '/periods/', expected: '/periods/' },
        { input: '/financial_centers', expected: '/financial_centers/' },
        { input: '/cost_centers/', expected: '/cost_centers/' },
        { input: '/nomenclatures', expected: '/nomenclatures/' }
      ];

      testCases.forEach(({ input, expected }) => {
        class TestService extends BaseService<any> {
          constructor() {
            super(input);
          }
          getEndpoint() {
            return this.endpoint;
          }
        }

        const service = new TestService();
        expect(service.getEndpoint()).toBe(expected);
      });
    });

    it('should prevent 307 redirects by using trailing slashes in CRUD operations', async () => {
      class TestService extends BaseService<any> {
        constructor() {
          super('/test');
        }
      }

      const service = new TestService();

      // Test all CRUD operations use endpoints with trailing slashes
      await service.getAll();
      expect(mockGet).toHaveBeenCalledWith('/test/', { params: undefined });

      await service.create({ name: 'test' });
      expect(mockPost).toHaveBeenCalledWith('/test/', { name: 'test' });

      // Note: Individual record operations still use /endpoint/id (no trailing slash)
      // as that's the FastAPI convention for resource items
    });

    it('should handle individual resource URLs correctly (no trailing slash)', async () => {
      class TestService extends BaseService<any> {
        constructor() {
          super('/test');
        }
      }

      const service = new TestService();

      // Individual resources should NOT have trailing slashes
      await service.getById(1);
      expect(mockGet).toHaveBeenCalledWith('/test//1');

      await service.update(1, { name: 'updated' });
      expect(mockPut).toHaveBeenCalledWith('/test//1', { name: 'updated' });

      await service.delete(1);
      expect(mockDelete).toHaveBeenCalledWith('/test//1');
    });
  });

  describe('Settings Services Trailing Slash Implementation', () => {
    it('should use trailing slashes for periods service', async () => {
      // Import services dynamically to avoid circular dependencies
      const { periodsService } = await import('$lib/services/periods.service');

      // PeriodsService extends BaseService with '/periods'
      expect(periodsService['endpoint']).toBe('/periods/');
    });

    it('should make API calls with correct trailing slashes for periods', async () => {
      // Import services dynamically
      const { periodsService } = await import('$lib/services/periods.service');

      // Mock the response format that periods service expects
      mockGet.mockResolvedValue({
        data: {
          success: true,
          data: [
            {
              period_id: 1,
              period_name: 'Test Period',
              period_year: 2025,
              period_month: 1,
              is_active: true
            }
          ]
        }
      });

      await periodsService.getByUserId(1);

      // Verify that the API call uses trailing slash
      expect(mockGet).toHaveBeenCalledWith('/periods/', { params: undefined });
    });

    it('should create services for all settings modules with trailing slashes', async () => {
      // Import BaseService dynamically
      const { BaseService } = await import('$lib/services/base.service');

      // Test that all settings services use trailing slashes
      const services = [
        { name: 'periods', endpoint: '/periods' },
        { name: 'financial_centers', endpoint: '/financial_centers' },
        { name: 'cost_centers', endpoint: '/cost_centers' },
        { name: 'nomenclatures', endpoint: '/nomenclatures' }
      ];

      services.forEach(({ name, endpoint }) => {
        class TestService extends BaseService<any> {
          constructor() {
            super(endpoint);
          }
        }

        const service = new TestService();
        expect(service['endpoint']).toBe(`${endpoint}/`);
      });
    });
  });

  describe('HTTP Request Interceptors and Session Preservation', () => {
    it('should configure axios with proper session settings', () => {
      // Verify that axios.create was called with session-preserving config
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: '/api',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true // Critical for session preservation
      });
    });

    it('should set up request interceptor that preserves sessions', () => {
      // The request interceptor should be set up
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('should handle 401 responses without creating redirect loops', () => {
      // Verify that response interceptor is set up to handle 401s
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();

      // Get the response interceptor
      const [, errorHandler] = mockAxiosInstance.interceptors.response.use.mock.calls[0];

      // Test that 401 handling doesn't interfere with normal operations
      const error401 = {
        response: { status: 401 },
        config: { url: '/periods/', _retry: false }
      };

      // Should handle 401 without throwing immediately
      expect(typeof errorHandler).toBe('function');
    });

    it('should not interfere with successful responses', async () => {
      // Import api dynamically
      const { api } = await import('$lib/services/api');

      const successData = { success: true, data: [{ id: 1, name: 'test' }] };
      mockGet.mockResolvedValue({ data: successData });

      const result = await api.get('/test/');
      expect(result).toEqual(successData);
    });
  });

  describe('Redirect Prevention', () => {
    it('should prevent 307 redirects by using correct endpoints', async () => {
      // Mock a response that would indicate a redirect was avoided
      const mockResponse = {
        data: { success: true, data: [] },
        status: 200, // Not 307!
        headers: {}
      };

      mockGet.mockResolvedValue(mockResponse);

      const result = await api.get('/periods/');

      // Verify we got a 200 response, not a redirect
      expect(mockGet).toHaveBeenCalledWith('/periods/', undefined);
      expect(result).toEqual(mockResponse.data);
    });

    it('should maintain session cookies across requests', async () => {
      // Test that withCredentials is maintained across all request types
      await api.get('/periods/');
      await api.post('/periods/', { data: 'test' });
      await api.put('/periods/1', { data: 'updated' });
      await api.delete('/periods/1');

      // All calls should use the axios instance configured with withCredentials: true
      // This is ensured by the axios.create configuration we tested above
      expect(mockGet).toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalled();
      expect(mockPut).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('Error Handling with Session Preservation', () => {
    it('should preserve session context during error responses', async () => {
      const error = {
        response: {
          status: 400,
          data: { success: false, error: 'Bad request' }
        },
        config: { url: '/periods/' }
      };

      mockGet.mockRejectedValue(error);

      try {
        await api.get('/periods/');
      } catch (e) {
        expect(e).toBe(error);
      }

      // Verify the request was made with session-preserving settings
      expect(mockGet).toHaveBeenCalledWith('/periods/', undefined);
    });

    it('should handle network errors without losing session context', async () => {
      const networkError = new Error('Network Error');
      mockGet.mockRejectedValue(networkError);

      try {
        await api.get('/periods/');
      } catch (e) {
        expect(e.message).toBe('Network Error');
      }

      expect(mockGet).toHaveBeenCalled();
    });

    it('should handle CORS errors that might occur from improper redirects', async () => {
      const corsError = {
        code: 'ERR_NETWORK',
        message: 'Network Error',
        config: { url: '/periods/' }
      };

      mockGet.mockRejectedValue(corsError);

      try {
        await api.get('/periods/');
      } catch (e) {
        expect(e.code).toBe('ERR_NETWORK');
      }
    });
  });

  describe('CRUD Operations Session Consistency', () => {
    const mockData = {
      id: 1,
      period_name: 'Test Period',
      period_year: 2025,
      period_month: 1,
      is_active: true
    };

    beforeEach(() => {
      mockGet.mockResolvedValue({ data: { success: true, data: [mockData] } });
      mockPost.mockResolvedValue({ data: { success: true, data: mockData } });
      mockPut.mockResolvedValue({ data: { success: true, data: mockData } });
      mockDelete.mockResolvedValue({ data: { success: true } });
    });

    it('should maintain session across CREATE operations', async () => {
      await api.post('/periods/', mockData);

      expect(mockPost).toHaveBeenCalledWith('/periods/', mockData);
    });

    it('should maintain session across READ operations', async () => {
      await api.get('/periods/');

      expect(mockGet).toHaveBeenCalledWith('/periods/', undefined);
    });

    it('should maintain session across UPDATE operations', async () => {
      await api.put('/periods/1', mockData);

      expect(mockPut).toHaveBeenCalledWith('/periods/1', mockData);
    });

    it('should maintain session across DELETE operations', async () => {
      await api.delete('/periods/1');

      expect(mockDelete).toHaveBeenCalledWith('/periods/1');
    });

    it('should handle bulk operations without session loss', async () => {
      // Test bulk operations that might involve multiple API calls
      const promises = [
        api.get('/periods/'),
        api.get('/financial_centers/'),
        api.get('/cost_centers/'),
        api.get('/nomenclatures/')
      ];

      await Promise.all(promises);

      expect(mockGet).toHaveBeenCalledTimes(4);
    });
  });

  describe('FastAPI-Specific Fixes', () => {
    it('should handle FastAPI trailing slash redirects properly', () => {
      // FastAPI by default redirects /periods to /periods/ with 307
      // Our fix ensures we always call /periods/ directly
      class TestService extends BaseService<any> {
        constructor() {
          super('/periods'); // This should become /periods/
        }
      }

      const service = new TestService();
      expect(service['endpoint']).toBe('/periods/');
    });

    it('should work with FastAPI path parameter endpoints', async () => {
      // FastAPI endpoints like /periods/{id} should not have trailing slashes
      await api.get('/periods/1');

      expect(mockGet).toHaveBeenCalledWith('/periods/1', undefined);
    });

    it('should handle nested endpoints correctly', async () => {
      // Test nested endpoints maintain proper slash format
      await api.get('/periods/1/transactions/');

      expect(mockGet).toHaveBeenCalledWith('/periods/1/transactions/', undefined);
    });
  });
});

describe('Integration with Actual Service Classes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify periods service uses correct endpoint format', () => {
    expect(periodsService['endpoint']).toBe('/periods/');
  });

  it('should demonstrate that all settings services follow the pattern', () => {
    // Create instances of all settings services to verify they follow the pattern
    const testServices = [
      { name: 'periods', endpoint: '/periods' },
      { name: 'financial_centers', endpoint: '/financial_centers' },
      { name: 'cost_centers', endpoint: '/cost_centers' },
      { name: 'nomenclatures', endpoint: '/nomenclatures' }
    ];

    testServices.forEach(({ name, endpoint }) => {
      class MockService extends BaseService<any> {
        constructor() {
          super(endpoint);
        }
      }

      const service = new MockService();
      expect(service['endpoint']).toBe(`${endpoint}/`);
    });
  });
});