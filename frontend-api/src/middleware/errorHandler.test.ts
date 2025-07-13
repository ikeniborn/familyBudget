import { Request, Response, NextFunction } from 'express';
import { errorHandler, ApiError } from './errorHandler';

// Mock console.error to prevent noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
    
    // Clear console.error mock
    (console.error as jest.Mock).mockClear();
  });

  describe('errorHandler', () => {
    it('should handle ApiError with custom status code', () => {
      const error: ApiError = new Error('Custom error message');
      error.statusCode = 400;

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Custom error message',
          statusCode: 400,
          timestamp: expect.any(String),
        },
      });
    });

    it('should use default 500 status code when statusCode is not provided', () => {
      const error = new Error('Regular error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Regular error',
          statusCode: 500,
          timestamp: expect.any(String),
        },
      });
    });

    it('should use default message when error message is empty', () => {
      const error: ApiError = new Error('');
      error.statusCode = 404;

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal Server Error',
          statusCode: 404,
          timestamp: expect.any(String),
        },
      });
    });

    it('should log error with console.error', () => {
      const error: ApiError = new Error('Test error');
      error.statusCode = 422;
      error.stack = 'Error stack trace';

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(console.error).toHaveBeenCalledWith(
        'Error 422: Test error',
        'Error stack trace'
      );
    });

    it('should handle error without stack trace', () => {
      const error: ApiError = new Error('No stack error');
      error.statusCode = 400;
      delete error.stack;

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(console.error).toHaveBeenCalledWith(
        'Error 400: No stack error',
        undefined
      );
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return valid ISO timestamp', () => {
      const error = new Error('Test error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      const jsonCallArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      const timestamp = jsonCallArgs.error.timestamp;

      // Verify it's a valid ISO string
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
      expect(typeof timestamp).toBe('string');
    });

    it('should handle various HTTP status codes', () => {
      const testCases = [
        { statusCode: 400, message: 'Bad Request' },
        { statusCode: 401, message: 'Unauthorized' },
        { statusCode: 403, message: 'Forbidden' },
        { statusCode: 404, message: 'Not Found' },
        { statusCode: 422, message: 'Unprocessable Entity' },
        { statusCode: 500, message: 'Internal Server Error' },
      ];

      testCases.forEach(({ statusCode, message }) => {
        const error: ApiError = new Error(message);
        error.statusCode = statusCode;

        // Reset mocks
        (mockResponse.status as jest.Mock).mockClear();
        (mockResponse.json as jest.Mock).mockClear();

        errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(statusCode);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: {
            message,
            statusCode,
            timestamp: expect.any(String),
          },
        });
      });
    });

    it('should not call next function', () => {
      const error = new Error('Test error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle error with statusCode 0', () => {
      const error: ApiError = new Error('Zero status error');
      error.statusCode = 0;

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      // Should use default 500 since 0 is falsy
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('should handle ApiError interface correctly', () => {
      // Test that the interface works as expected
      const error: ApiError = {
        name: 'ApiError',
        message: 'API specific error',
        statusCode: 400,
      };

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'API specific error',
          statusCode: 400,
          timestamp: expect.any(String),
        },
      });
    });

    it('should preserve original error properties', () => {
      const error: ApiError = new Error('Original error');
      error.statusCode = 418; // I'm a teapot
      const originalName = error.name;
      const originalMessage = error.message;

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      // Verify original error wasn't modified
      expect(error.name).toBe(originalName);
      expect(error.message).toBe(originalMessage);
      expect(error.statusCode).toBe(418);
    });
  });
});