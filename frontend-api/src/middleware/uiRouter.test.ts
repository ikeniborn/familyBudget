import { Request, Response, NextFunction } from 'express';
import { uiRouterMiddleware } from './uiRouter';

describe('UI Router Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  const originalEnv = process.env.FRONTEND_URL;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      redirect: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  afterEach(() => {
    // Restore original environment variable
    process.env.FRONTEND_URL = originalEnv;
  });

  describe('uiRouterMiddleware', () => {
    it('should redirect to FRONTEND_URL when path is "/"', () => {
      process.env.FRONTEND_URL = 'https://app.test.com';
      mockRequest = { path: '/' };

      uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.redirect).toHaveBeenCalledWith('https://app.test.com');
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should redirect to FRONTEND_URL when path is empty string', () => {
      process.env.FRONTEND_URL = 'https://frontend.example.com';
      mockRequest = { path: '' };

      uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.redirect).toHaveBeenCalledWith('https://frontend.example.com');
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should use default URL when FRONTEND_URL is not set', () => {
      delete process.env.FRONTEND_URL;
      mockRequest = { path: '/' };

      uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.redirect).toHaveBeenCalledWith('https://app.example.com');
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should use default URL when FRONTEND_URL is empty', () => {
      process.env.FRONTEND_URL = '';
      mockRequest = { path: '/' };

      uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.redirect).toHaveBeenCalledWith('https://app.example.com');
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() for API paths', () => {
      process.env.FRONTEND_URL = 'https://app.test.com';
      mockRequest = { path: '/api/health' };

      uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    it('should call next() for static asset paths', () => {
      process.env.FRONTEND_URL = 'https://app.test.com';
      mockRequest = { path: '/static/js/main.js' };

      uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    it('should call next() for nested paths', () => {
      process.env.FRONTEND_URL = 'https://app.test.com';
      mockRequest = { path: '/dashboard/reports' };

      uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    it('should call next() for paths starting with /', () => {
      process.env.FRONTEND_URL = 'https://app.test.com';
      mockRequest = { path: '/login' };

      uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.redirect).not.toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    it('should handle various frontend URLs', () => {
      const testUrls = [
        'http://localhost:3000',
        'https://staging.example.com',
        'https://app.production.com/path',
        'http://192.168.1.100:8080',
      ];

      testUrls.forEach((url) => {
        process.env.FRONTEND_URL = url;
        mockRequest = { path: '/' };

        // Reset mocks
        (mockResponse.redirect as jest.Mock).mockClear();
        (nextFunction as jest.Mock).mockClear();

        uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(mockResponse.redirect).toHaveBeenCalledWith(url);
        expect(nextFunction).not.toHaveBeenCalled();
      });
    });

    it('should not modify request or response when calling next', () => {
      process.env.FRONTEND_URL = 'https://app.test.com';
      mockRequest = { path: '/api/test' };
      const originalRequest = { ...mockRequest };

      uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest).toEqual(originalRequest);
      expect(nextFunction).toHaveBeenCalledWith(); // No arguments
    });

    it('should handle edge case paths correctly', () => {
      const testCases = [
        { path: '//', shouldRedirect: false },
        { path: '/favicon.ico', shouldRedirect: false },
        { path: '/robots.txt', shouldRedirect: false },
        { path: '/manifest.json', shouldRedirect: false },
        { path: '/.well-known/security.txt', shouldRedirect: false },
      ];

      testCases.forEach(({ path, shouldRedirect }) => {
        process.env.FRONTEND_URL = 'https://app.test.com';
        mockRequest = { path };

        // Reset mocks
        (mockResponse.redirect as jest.Mock).mockClear();
        (nextFunction as jest.Mock).mockClear();

        uiRouterMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

        if (shouldRedirect) {
          expect(mockResponse.redirect).toHaveBeenCalledWith('https://app.test.com');
          expect(nextFunction).not.toHaveBeenCalled();
        } else {
          expect(mockResponse.redirect).not.toHaveBeenCalled();
          expect(nextFunction).toHaveBeenCalledTimes(1);
        }
      });
    });
  });
});