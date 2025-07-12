import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockAxiosInstance = {
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
} as any;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  it('creates axios instance with correct configuration', () => {
    // Import inside test to avoid side effects
    jest.isolateModules(() => {
      require('../../services/apiClient');
    });

    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });
  });

  it('sets up request interceptor', () => {
    jest.isolateModules(() => {
      require('../../services/apiClient');
    });

    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
  });

  it('sets up response interceptor', () => {
    jest.isolateModules(() => {
      require('../../services/apiClient');
    });

    expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
  });

  describe('handleApiError', () => {
    let handleApiError: any;

    beforeEach(() => {
      jest.isolateModules(() => {
        const apiClientModule = require('../../services/apiClient');
        handleApiError = apiClientModule.handleApiError;
      });
    });

    it('handles error with response data', () => {
      const error = {
        response: {
          data: { message: 'API Error' },
        },
      } as any;

      const result = handleApiError(error);
      expect(result).toBe('API Error');
    });

    it('handles error without response data', () => {
      const error = {
        message: 'Network Error',
      } as any;

      const result = handleApiError(error);
      expect(result).toBe('Network Error');
    });

    it('handles error with no message', () => {
      const error = {} as any;

      const result = handleApiError(error);
      expect(result).toBe('Произошла неизвестная ошибка');
    });
  });
});