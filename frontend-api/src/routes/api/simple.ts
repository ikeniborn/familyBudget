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
  return req.session?.user?.user_id?.toString() || req.headers['x-user-id']?.toString() || null;
};

// Health check
router.get('/health', (_req, res): void => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'unified-api'
  });
});

// Reference data endpoints
router.get('/periods', async (_req, res): Promise<void> => {
  try {
    const periods = await referenceService.getPeriods();
    
    // Transform periods to match frontend expectations
    const transformedPeriods = periods.map(period => ({
      ...period,
      period_id: period.id,
      period_dt: period.date,
      period_ru_name: period.ruName,
      period_name: period.ruName,
      period_year: period.date.getFullYear(),
      period_month: period.date.getMonth() + 1
    }));
    
    res.json(transformedPeriods);
  } catch (error) {
    console.error('Error fetching periods:', error);
    res.status(500).json({ error: 'Failed to fetch periods' });
  }
});

router.post('/periods', async (req, res): Promise<void> => {
  try {
    const { 
      period_name, 
      period_year, 
      period_month,
      period_dt,
      period_ru_name 
    } = req.body;
    
    // Support both old format (from frontend) and new format
    let date: Date;
    let ruName: string;
    
    if (period_year && period_month) {
      // Old format from frontend
      date = new Date(period_year, period_month - 1, 1);
      ruName = period_name || `${period_month}/${period_year}`;
    } else if (period_dt && period_ru_name) {
      // New format
      date = new Date(period_dt);
      ruName = period_ru_name;
    } else if (req.body.date && req.body.ruName) {
      // Direct format
      date = new Date(req.body.date);
      ruName = req.body.ruName;
    } else {
      res.status(400).json({ 
        error: 'Either (period_year and period_month) or (period_dt and period_ru_name) or (date and ruName) are required' 
      });
      return;
    }

    const period = await referenceService.createPeriod({
      date,
      ruName
    });

    // Transform response to match frontend expectations
    const response = {
      ...period,
      period_id: period.id,
      period_dt: period.date,
      period_ru_name: period.ruName,
      period_name: period.ruName,
      period_year: period.date.getFullYear(),
      period_month: period.date.getMonth() + 1
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating period:', error);
    res.status(500).json({ error: 'Failed to create period' });
  }
});

router.put('/periods/:id', async (req, res): Promise<void> => {
  try {
    const periodId = parseInt(req.params.id);
    const { 
      period_name, 
      period_year, 
      period_month,
      period_dt,
      period_ru_name 
    } = req.body;
    
    // Build update data
    const updateData: { date?: Date; ruName?: string } = {};
    
    if (period_year && period_month) {
      // Old format from frontend
      updateData.date = new Date(period_year, period_month - 1, 1);
      updateData.ruName = period_name || `${period_month}/${period_year}`;
    } else if (period_dt && period_ru_name) {
      // New format
      updateData.date = new Date(period_dt);
      updateData.ruName = period_ru_name;
    } else if (req.body.date && req.body.ruName) {
      // Direct format
      updateData.date = new Date(req.body.date);
      updateData.ruName = req.body.ruName;
    }

    const period = await referenceService.updatePeriod(periodId, updateData);

    // Transform response to match frontend expectations
    const response = {
      ...period,
      period_id: period.id,
      period_dt: period.date,
      period_ru_name: period.ruName,
      period_name: period.ruName,
      period_year: period.date.getFullYear(),
      period_month: period.date.getMonth() + 1
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating period:', error);
    res.status(500).json({ error: 'Failed to update period' });
  }
});

router.delete('/periods/:id', async (req, res): Promise<void> => {
  try {
    const periodId = parseInt(req.params.id);
    
    // Check if period exists
    const period = await referenceService.getPeriodById(periodId);
    if (!period) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    // Try to delete the period (will check for related transactions)
    try {
      await referenceService.deletePeriod(periodId);
      res.status(204).send();
    } catch (deleteError: any) {
      // If deletion fails due to related transactions, return appropriate error
      if (deleteError.message?.includes('related transactions')) {
        res.status(400).json({ 
          error: deleteError.message,
          detail: 'Period has related transactions and cannot be deleted'
        });
      } else {
        throw deleteError;
      }
    }
  } catch (error) {
    console.error('Error deleting period:', error);
    res.status(500).json({ error: 'Failed to delete period' });
  }
});

router.get('/financial_centers', async (_req, res): Promise<void> => {
  try {
    const centers = await referenceService.getFinancialCenters();
    res.json(centers);
  } catch (error) {
    console.error('Error fetching financial centers:', error);
    res.status(500).json({ error: 'Failed to fetch financial centers' });
  }
});

router.get('/cost_centers', async (_req, res): Promise<void> => {
  try {
    const centers = await referenceService.getCostCenters();
    res.json(centers);
  } catch (error) {
    console.error('Error fetching cost centers:', error);
    res.status(500).json({ error: 'Failed to fetch cost centers' });
  }
});

router.get('/nomenclatures', async (_req, res): Promise<void> => {
  try {
    const nomenclatures = await referenceService.getNomenclatures();
    res.json(nomenclatures);
  } catch (error) {
    console.error('Error fetching nomenclatures:', error);
    res.status(500).json({ error: 'Failed to fetch nomenclatures' });
  }
});

router.get('/row_types', async (_req, res): Promise<void> => {
  try {
    const rowTypes = await referenceService.getRowTypes();
    res.json(rowTypes);
  } catch (error) {
    console.error('Error fetching row types:', error);
    res.status(500).json({ error: 'Failed to fetch row types' });
  }
});

// User endpoints
router.get('/users', async (_req, res): Promise<void> => {
  try {
    const users = await userService.getAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Registry endpoints (with user authentication)
router.get('/registry/last', async (req, res): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
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

router.post('/registry', async (req, res): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
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
router.get('/products', async (req, res): Promise<void> => {
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

router.get('/products/categories', async (_req, res): Promise<void> => {
  try {
    const categories = await productService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/products', async (req, res): Promise<void> => {
  try {
    const { name, category, unit, barcode, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Product name is required' });
      return;
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
router.get('/reports/budget-vs-actual', async (req, res): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
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

router.get('/reports/period-summary', async (req, res): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
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