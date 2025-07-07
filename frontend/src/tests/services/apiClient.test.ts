import axios from 'axios';
import { apiClient } from '../../services/apiClient';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates axios instance with correct base URL', () => {
    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: expect.stringContaining('/api'),
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });
  });

  it('handles successful responses', async () => {
    const mockData = { id: 1, name: 'Test' };
    const mockResponse = { data: mockData };
    
    mockedAxios.create.mockReturnValue({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn((success) => {
          const result = success(mockResponse);
          expect(result).toEqual(mockData);
        }) },
      },
    } as any);

    apiClient;
  });

  it('handles error responses with message', async () => {
    const errorMessage = 'API Error';
    const mockError = {
      response: {
        data: { detail: errorMessage },
      },
    };

    mockedAxios.create.mockReturnValue({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn((_, error) => {
          return error(mockError).catch((err: any) => {
            expect(err.message).toBe(errorMessage);
          });
        }) },
      },
    } as any);

    apiClient;
  });

  it('handles network errors', async () => {
    const mockError = new Error('Network Error');

    mockedAxios.create.mockReturnValue({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn((_, error) => {
          return error(mockError).catch((err: any) => {
            expect(err.message).toBe('Network Error');
          });
        }) },
      },
    } as any);

    apiClient;
  });

  it('adds request interceptor for logging', () => {
    const mockConfig = { url: '/test', method: 'GET' };
    
    mockedAxios.create.mockReturnValue({
      interceptors: {
        request: { use: jest.fn((interceptor) => {
          const result = interceptor(mockConfig);
          expect(result).toEqual(mockConfig);
        }) },
        response: { use: jest.fn() },
      },
    } as any);

    apiClient;
  });
});