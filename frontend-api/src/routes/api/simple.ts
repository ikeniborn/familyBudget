import express from 'express';
import { UserService } from '../../services/UserService';
import { ReferenceDataService } from '../../services/ReferenceDataService';
import { RegistryService } from '../../services/RegistryService';
import { ProductService } from '../../services/ProductService';
import { ReportService } from '../../services/ReportService';
import prisma from '../../database/prisma';

const router = express.Router();

// Initialize services
const userService = new UserService(prisma);
const referenceService = new ReferenceDataService(prisma);
const registryService = new RegistryService(prisma);
const productService = new ProductService(prisma);
const reportService = new ReportService(prisma);

// Simple middleware to get user ID
const getUserId = (req: express.Request): string | null => {
  return req.session?.user?.id?.toString() || req.headers['x-user-id']?.toString() || null;
};

// Health check
router.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'unified-api'
  });
});

// Reference data endpoints
router.get('/periods', async (_req, res) => {
  try {
    const periods = await referenceService.getPeriods();
    res.json(periods);
  } catch (error) {
    console.error('Error fetching periods:', error);
    res.status(500).json({ error: 'Failed to fetch periods' });
  }
});

router.get('/financial_centers', async (_req, res) => {
  try {
    const centers = await referenceService.getFinancialCenters();
    res.json(centers);
  } catch (error) {
    console.error('Error fetching financial centers:', error);
    res.status(500).json({ error: 'Failed to fetch financial centers' });
  }
});

router.get('/cost_centers', async (_req, res) => {
  try {
    const centers = await referenceService.getCostCenters();
    res.json(centers);
  } catch (error) {
    console.error('Error fetching cost centers:', error);
    res.status(500).json({ error: 'Failed to fetch cost centers' });
  }
});

router.get('/nomenclatures', async (_req, res) => {
  try {
    const nomenclatures = await referenceService.getNomenclatures();
    res.json(nomenclatures);
  } catch (error) {
    console.error('Error fetching nomenclatures:', error);
    res.status(500).json({ error: 'Failed to fetch nomenclatures' });
  }
});

router.get('/row_types', async (_req, res) => {
  try {
    const rowTypes = await referenceService.getRowTypes();
    res.json(rowTypes);
  } catch (error) {
    console.error('Error fetching row types:', error);
    res.status(500).json({ error: 'Failed to fetch row types' });
  }
});

// User endpoints
router.get('/users', async (_req, res) => {
  try {
    const users = await userService.getAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Registry endpoints (with user authentication)
router.get('/registry/last', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const rowTypeId = req.query.row_type_id ? parseInt(req.query.row_type_id as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

    const registries = await registryService.getLastRows(userId, rowTypeId, limit);
    res.json(registries);
  } catch (error) {
    console.error('Error fetching last registries:', error);
    res.status(500).json({ error: 'Failed to fetch registries' });
  }
});

router.post('/registry', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const {
      operationDate,
      periodId,
      financialCenterId,
      costCenterId,
      nomenclatureId,
      rowTypeId,
      costSum,
      comment
    } = req.body;

    const registry = await registryService.create({
      operationDate: new Date(operationDate),
      periodId: parseInt(periodId),
      financialCenterId: parseInt(financialCenterId),
      costCenterId: parseInt(costCenterId),
      nomenclatureId: parseInt(nomenclatureId),
      rowTypeId: parseInt(rowTypeId),
      costSum: parseFloat(costSum),
      comment
    }, userId);

    res.status(201).json(registry);
  } catch (error) {
    console.error('Error creating registry:', error);
    res.status(500).json({ error: 'Failed to create registry' });
  }
});

// Products endpoints
router.get('/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const category = req.query.category as string;

    const result = await productService.getProducts(page, limit, search, category);
    res.json(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/products/categories', async (_req, res) => {
  try {
    const categories = await productService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/products', async (req, res) => {
  try {
    const { name, category, unit, barcode, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const product = await productService.createProduct({
      name,
      category,
      unit,
      barcode,
      description
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Reports endpoints
router.get('/reports/budget-vs-actual', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const filters = {
      periodIds: req.query.periodIds ? [parseInt(req.query.periodIds as string)] : undefined,
      financialCenterIds: req.query.financialCenterIds ? [parseInt(req.query.financialCenterIds as string)] : undefined
    };

    const report = await reportService.getBudgetVsActualReport(userId, filters);
    res.json(report);
  } catch (error) {
    console.error('Error generating budget vs actual report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.get('/reports/period-summary', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const filters = {
      periodIds: req.query.periodIds ? [parseInt(req.query.periodIds as string)] : undefined
    };

    const report = await reportService.getPeriodSummaryReport(userId, filters);
    res.json(report);
  } catch (error) {
    console.error('Error generating period summary report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;