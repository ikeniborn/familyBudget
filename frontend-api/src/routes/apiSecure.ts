import { Router } from 'express';
import { backendApiSecure, setUserContext } from '../services/backendApiSecure';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Middleware to set user context for all requests
router.use((req, _res, next): void => {
  if (req.session?.user?.user_id) {
    setUserContext(req.session.user.user_id.toString());
  }
  next();
});

// Users routes
router.get('/users', async (_req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getUsers();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/users/:id', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getUser(parseInt(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Periods routes
router.get('/periods', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getPeriods(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/periods/:id', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getPeriod(parseInt(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Financial Centers routes
router.get('/financial_centers', async (_req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getFinancialCenters();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/financial_centers/:id', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getFinancialCenter(parseInt(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Cost Centers routes
router.get('/cost_centers', async (_req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getCostCenters();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/cost_centers/:id', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getCostCenter(parseInt(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Nomenclatures routes
router.get('/nomenclatures', async (_req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getNomenclatures();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/nomenclatures/:id', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getNomenclature(parseInt(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Row Types routes
router.get('/row_types', async (_req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getRowTypes();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/row_types/:id', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getRowType(parseInt(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Registry routes
router.post('/registry', async (req, res, next): Promise<void> => {
  try {
    // Add user_id from session to the data
    const data = {
      ...req.body,
      user_id: req.session.user?.user_id
    };
    const result = await backendApiSecure.createRegistryEntry(data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/registry/last_row', async (req, res, next): Promise<void> => {
  try {
    const { row_type_id, limit_rows } = req.query;
    const data = await backendApiSecure.getLastRegistryRows(
      row_type_id ? parseInt(row_type_id as string) : undefined,
      limit_rows ? parseInt(limit_rows as string) : 5
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Reports routes
router.get('/report/budget/row_type_nomenclature', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getBudgetRowTypeNomenclatureReport(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/report/compare/row_type_nomenclature', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getCompareRowTypeNomenclatureReport(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/report/compare/row_type_operation', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getCompareRowTypeOperationReport(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/report/compare/row_type_bill', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getCompareRowTypeBillReport(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/report/compare/row_type_account', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getCompareRowTypeAccountReport(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/report/budget/total', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getBudgetTotalReport(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/report/budget/bill_account', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getBudgetBillAccountReport(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Products routes (placeholder for future implementation)
router.get('/products', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getProducts(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/products/:id', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.getProduct(parseInt(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.createProduct(req.body);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.put('/products/:id', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.updateProduct(parseInt(req.params.id), req.body);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.delete('/products/:id', async (req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.deleteProduct(parseInt(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post('/products/import/:type', async (req, res, next): Promise<void> => {
  try {
    const type = req.params.type as 'csv' | 'excel' | 'google-sheets';
    const data = await backendApiSecure.importProducts(type, req.body);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Health check route
router.get('/health', async (_req, res, next): Promise<void> => {
  try {
    const data = await backendApiSecure.healthCheck();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;