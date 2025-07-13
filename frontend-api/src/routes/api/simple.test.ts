import request from 'supertest';
import express from 'express';
import session from 'express-session';
import simpleRouter from './simple';
import { userFixtures, periodFixtures, financialCenterFixtures, costCenterFixtures, nomenclatureFixtures, rowTypeFixtures, registryFixtures, productFixtures } from '../../test/fixtures';

// Mock services
jest.mock('../../services/UserService');
jest.mock('../../services/ReferenceDataService');
jest.mock('../../services/RegistryService');
jest.mock('../../services/ProductService');
jest.mock('../../services/ReportService');
jest.mock('../../database/prisma', () => ({}));

describe('Simple API Routes', () => {
  let app: express.Application;
  let mockUserService: any;
  let mockReferenceService: any;
  let mockRegistryService: any;
  let mockProductService: any;
  let mockReportService: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
      })
    );
    app.use('/api', simpleRouter);

    // Reset mocks
    jest.clearAllMocks();

    // Create service mocks
    const { UserService } = require('../../services/UserService');
    const { ReferenceDataService } = require('../../services/ReferenceDataService');
    const { RegistryService } = require('../../services/RegistryService');
    const { ProductService } = require('../../services/ProductService');
    const { ReportService } = require('../../services/ReportService');

    mockUserService = {
      getAll: jest.fn(),
    };
    mockReferenceService = {
      getPeriods: jest.fn(),
      getFinancialCenters: jest.fn(),
      getCostCenters: jest.fn(),
      getNomenclatures: jest.fn(),
      getRowTypes: jest.fn(),
    };
    mockRegistryService = {
      getLastRows: jest.fn(),
      create: jest.fn(),
    };
    mockProductService = {
      getProducts: jest.fn(),
      getCategories: jest.fn(),
      createProduct: jest.fn(),
    };
    mockReportService = {
      getBudgetVsActualReport: jest.fn(),
      getPeriodSummaryReport: jest.fn(),
    };

    UserService.mockImplementation(() => mockUserService);
    ReferenceDataService.mockImplementation(() => mockReferenceService);
    RegistryService.mockImplementation(() => mockRegistryService);
    ProductService.mockImplementation(() => mockProductService);
    ReportService.mockImplementation(() => mockReportService);
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        service: 'unified-api',
      });
    });
  });

  describe('Reference Data Endpoints', () => {
    describe('GET /api/periods', () => {
      it('should return periods successfully', async () => {
        mockReferenceService.getPeriods.mockResolvedValue([periodFixtures.january2024]);

        const response = await request(app)
          .get('/api/periods')
          .expect(200);

        expect(response.body).toEqual([periodFixtures.january2024]);
        expect(mockReferenceService.getPeriods).toHaveBeenCalledTimes(1);
      });

      it('should handle service errors', async () => {
        mockReferenceService.getPeriods.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/periods')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to fetch periods' });
      });
    });

    describe('GET /api/financial_centers', () => {
      it('should return financial centers successfully', async () => {
        mockReferenceService.getFinancialCenters.mockResolvedValue([financialCenterFixtures.family]);

        const response = await request(app)
          .get('/api/financial_centers')
          .expect(200);

        expect(response.body).toEqual([financialCenterFixtures.family]);
        expect(mockReferenceService.getFinancialCenters).toHaveBeenCalledTimes(1);
      });

      it('should handle service errors', async () => {
        mockReferenceService.getFinancialCenters.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/financial_centers')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to fetch financial centers' });
      });
    });

    describe('GET /api/cost_centers', () => {
      it('should return cost centers successfully', async () => {
        mockReferenceService.getCostCenters.mockResolvedValue([costCenterFixtures.husband]);

        const response = await request(app)
          .get('/api/cost_centers')
          .expect(200);

        expect(response.body).toEqual([costCenterFixtures.husband]);
        expect(mockReferenceService.getCostCenters).toHaveBeenCalledTimes(1);
      });

      it('should handle service errors', async () => {
        mockReferenceService.getCostCenters.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/cost_centers')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to fetch cost centers' });
      });
    });

    describe('GET /api/nomenclatures', () => {
      it('should return nomenclatures successfully', async () => {
        mockReferenceService.getNomenclatures.mockResolvedValue([nomenclatureFixtures.food]);

        const response = await request(app)
          .get('/api/nomenclatures')
          .expect(200);

        expect(response.body).toEqual([nomenclatureFixtures.food]);
        expect(mockReferenceService.getNomenclatures).toHaveBeenCalledTimes(1);
      });

      it('should handle service errors', async () => {
        mockReferenceService.getNomenclatures.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/nomenclatures')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to fetch nomenclatures' });
      });
    });

    describe('GET /api/row_types', () => {
      it('should return row types successfully', async () => {
        mockReferenceService.getRowTypes.mockResolvedValue([rowTypeFixtures.plan]);

        const response = await request(app)
          .get('/api/row_types')
          .expect(200);

        expect(response.body).toEqual([rowTypeFixtures.plan]);
        expect(mockReferenceService.getRowTypes).toHaveBeenCalledTimes(1);
      });

      it('should handle service errors', async () => {
        mockReferenceService.getRowTypes.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/row_types')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to fetch row types' });
      });
    });
  });

  describe('User Endpoints', () => {
    describe('GET /api/users', () => {
      it('should return users successfully', async () => {
        mockUserService.getAll.mockResolvedValue([userFixtures.activeUser]);

        const response = await request(app)
          .get('/api/users')
          .expect(200);

        expect(response.body).toEqual([userFixtures.activeUser]);
        expect(mockUserService.getAll).toHaveBeenCalledTimes(1);
      });

      it('should handle service errors', async () => {
        mockUserService.getAll.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/users')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to fetch users' });
      });
    });
  });

  describe('Registry Endpoints', () => {
    describe('GET /api/registry/last', () => {
      it('should return last registries for authenticated user', async () => {
        mockRegistryService.getLastRows.mockResolvedValue([registryFixtures.planEntry]);

        const response = await request(app)
          .get('/api/registry/last')
          .set('x-user-id', '1')
          .expect(200);

        expect(response.body).toEqual([registryFixtures.planEntry]);
        expect(mockRegistryService.getLastRows).toHaveBeenCalledWith('1', undefined, 5);
      });

      it('should handle query parameters', async () => {
        mockRegistryService.getLastRows.mockResolvedValue([registryFixtures.planEntry]);

        await request(app)
          .get('/api/registry/last?row_type_id=1&limit=10')
          .set('x-user-id', '1')
          .expect(200);

        expect(mockRegistryService.getLastRows).toHaveBeenCalledWith('1', 1, 10);
      });

      it('should return 401 for unauthenticated user', async () => {
        const response = await request(app)
          .get('/api/registry/last')
          .expect(401);

        expect(response.body).toEqual({ error: 'User not authenticated' });
        expect(mockRegistryService.getLastRows).not.toHaveBeenCalled();
      });

      it('should handle service errors', async () => {
        mockRegistryService.getLastRows.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/registry/last')
          .set('x-user-id', '1')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to fetch registries' });
      });
    });

    describe('POST /api/registry', () => {
      const validRegistryData = {
        operationDate: '2024-01-15T00:00:00.000Z',
        periodId: '1',
        financialCenterId: '1',
        costCenterId: '1',
        nomenclatureId: '1',
        rowTypeId: '2',
        costSum: '4500',
        comment: 'Test registry entry',
      };

      it('should create registry for authenticated user', async () => {
        mockRegistryService.create.mockResolvedValue(registryFixtures.factEntry);

        const response = await request(app)
          .post('/api/registry')
          .set('x-user-id', '1')
          .send(validRegistryData)
          .expect(201);

        expect(response.body).toEqual(registryFixtures.factEntry);
        expect(mockRegistryService.create).toHaveBeenCalledWith(
          {
            operationDate: new Date('2024-01-15T00:00:00.000Z'),
            periodId: 1,
            financialCenterId: 1,
            costCenterId: 1,
            nomenclatureId: 1,
            rowTypeId: 2,
            costSum: 4500,
            comment: 'Test registry entry',
          },
          '1'
        );
      });

      it('should return 401 for unauthenticated user', async () => {
        const response = await request(app)
          .post('/api/registry')
          .send(validRegistryData)
          .expect(401);

        expect(response.body).toEqual({ error: 'User not authenticated' });
        expect(mockRegistryService.create).not.toHaveBeenCalled();
      });

      it('should handle service errors', async () => {
        mockRegistryService.create.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/registry')
          .set('x-user-id', '1')
          .send(validRegistryData)
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to create registry' });
      });
    });
  });

  describe('Product Endpoints', () => {
    describe('GET /api/products', () => {
      it('should return products successfully', async () => {
        const mockResult = {
          products: [productFixtures.milk],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        };
        mockProductService.getProducts.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/products')
          .expect(200);

        expect(response.body).toEqual(mockResult);
        expect(mockProductService.getProducts).toHaveBeenCalledWith(1, 20, undefined, undefined);
      });

      it('should handle query parameters', async () => {
        const mockResult = {
          products: [productFixtures.milk],
          pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
        };
        mockProductService.getProducts.mockResolvedValue(mockResult);

        await request(app)
          .get('/api/products?page=2&limit=10&search=milk&category=dairy')
          .expect(200);

        expect(mockProductService.getProducts).toHaveBeenCalledWith(2, 10, 'milk', 'dairy');
      });

      it('should handle service errors', async () => {
        mockProductService.getProducts.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/products')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to fetch products' });
      });
    });

    describe('GET /api/products/categories', () => {
      it('should return categories successfully', async () => {
        const mockCategories = ['Молочные продукты', 'Хлебобулочные изделия'];
        mockProductService.getCategories.mockResolvedValue(mockCategories);

        const response = await request(app)
          .get('/api/products/categories')
          .expect(200);

        expect(response.body).toEqual(mockCategories);
        expect(mockProductService.getCategories).toHaveBeenCalledTimes(1);
      });

      it('should handle service errors', async () => {
        mockProductService.getCategories.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/products/categories')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to fetch categories' });
      });
    });

    describe('POST /api/products', () => {
      const validProductData = {
        name: 'Test Product',
        category: 'Test Category',
        unit: 'шт',
        barcode: '1234567890',
        description: 'Test description',
      };

      it('should create product successfully', async () => {
        mockProductService.createProduct.mockResolvedValue(productFixtures.milk);

        const response = await request(app)
          .post('/api/products')
          .send(validProductData)
          .expect(201);

        expect(response.body).toEqual(productFixtures.milk);
        expect(mockProductService.createProduct).toHaveBeenCalledWith(validProductData);
      });

      it('should return 400 if name is missing', async () => {
        const invalidData = { ...validProductData };
        delete invalidData.name;

        const response = await request(app)
          .post('/api/products')
          .send(invalidData)
          .expect(400);

        expect(response.body).toEqual({ error: 'Product name is required' });
        expect(mockProductService.createProduct).not.toHaveBeenCalled();
      });

      it('should handle service errors', async () => {
        mockProductService.createProduct.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/products')
          .send(validProductData)
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to create product' });
      });
    });
  });

  describe('Report Endpoints', () => {
    describe('GET /api/reports/budget-vs-actual', () => {
      it('should return budget vs actual report for authenticated user', async () => {
        const mockReport = { budget: 5000, actual: 4500, variance: 500 };
        mockReportService.getBudgetVsActualReport.mockResolvedValue(mockReport);

        const response = await request(app)
          .get('/api/reports/budget-vs-actual')
          .set('x-user-id', '1')
          .expect(200);

        expect(response.body).toEqual(mockReport);
        expect(mockReportService.getBudgetVsActualReport).toHaveBeenCalledWith('1', {
          periodIds: undefined,
          financialCenterIds: undefined,
        });
      });

      it('should handle query parameters', async () => {
        const mockReport = { budget: 5000, actual: 4500, variance: 500 };
        mockReportService.getBudgetVsActualReport.mockResolvedValue(mockReport);

        await request(app)
          .get('/api/reports/budget-vs-actual?periodIds=1&financialCenterIds=1')
          .set('x-user-id', '1')
          .expect(200);

        expect(mockReportService.getBudgetVsActualReport).toHaveBeenCalledWith('1', {
          periodIds: [1],
          financialCenterIds: [1],
        });
      });

      it('should return 401 for unauthenticated user', async () => {
        const response = await request(app)
          .get('/api/reports/budget-vs-actual')
          .expect(401);

        expect(response.body).toEqual({ error: 'User not authenticated' });
        expect(mockReportService.getBudgetVsActualReport).not.toHaveBeenCalled();
      });

      it('should handle service errors', async () => {
        mockReportService.getBudgetVsActualReport.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/reports/budget-vs-actual')
          .set('x-user-id', '1')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to generate report' });
      });
    });

    describe('GET /api/reports/period-summary', () => {
      it('should return period summary report for authenticated user', async () => {
        const mockReport = { totalIncome: 10000, totalExpenses: 8000, savings: 2000 };
        mockReportService.getPeriodSummaryReport.mockResolvedValue(mockReport);

        const response = await request(app)
          .get('/api/reports/period-summary')
          .set('x-user-id', '1')
          .expect(200);

        expect(response.body).toEqual(mockReport);
        expect(mockReportService.getPeriodSummaryReport).toHaveBeenCalledWith('1', {
          periodIds: undefined,
        });
      });

      it('should handle query parameters', async () => {
        const mockReport = { totalIncome: 10000, totalExpenses: 8000, savings: 2000 };
        mockReportService.getPeriodSummaryReport.mockResolvedValue(mockReport);

        await request(app)
          .get('/api/reports/period-summary?periodIds=1')
          .set('x-user-id', '1')
          .expect(200);

        expect(mockReportService.getPeriodSummaryReport).toHaveBeenCalledWith('1', {
          periodIds: [1],
        });
      });

      it('should return 401 for unauthenticated user', async () => {
        const response = await request(app)
          .get('/api/reports/period-summary')
          .expect(401);

        expect(response.body).toEqual({ error: 'User not authenticated' });
        expect(mockReportService.getPeriodSummaryReport).not.toHaveBeenCalled();
      });

      it('should handle service errors', async () => {
        mockReportService.getPeriodSummaryReport.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .get('/api/reports/period-summary')
          .set('x-user-id', '1')
          .expect(500);

        expect(response.body).toEqual({ error: 'Failed to generate report' });
      });
    });
  });

  describe('getUserId helper function', () => {
    it('should get user ID from session', (done) => {
      app.use('/test-session', (req: any, res) => {
        req.session.user = { user_id: 123 };
        res.json({ userId: req.session?.user?.user_id?.toString() || null });
      });

      request(app)
        .get('/test-session')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.userId).toBe('123');
          done();
        });
    });

    it('should get user ID from headers', async () => {
      app.use('/test-header', (req, res) => {
        const userId = req.headers['x-user-id']?.toString() || null;
        res.json({ userId });
      });

      const response = await request(app)
        .get('/test-header')
        .set('x-user-id', '456')
        .expect(200);

      expect(response.body.userId).toBe('456');
    });
  });
});