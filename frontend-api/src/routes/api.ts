import { Router } from 'express';
import { backendApi } from '../services/backendApi';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Proxy routes to backend API
router.get('/users', async (_req, res, next) => {
  try {
    const data = await backendApi.getUsers();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/periods', async (req, res, next) => {
  try {
    const data = await backendApi.getPeriods(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/financial_centers', async (_req, res, next) => {
  try {
    const data = await backendApi.getFinancialCenters();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/cost_centers', async (_req, res, next) => {
  try {
    const data = await backendApi.getCostCenters();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/nomenclatures', async (_req, res, next) => {
  try {
    const data = await backendApi.getNomenclatures();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post('/registry', async (req, res, next) => {
  try {
    // Add user_id from session
    const data = {
      ...req.body,
      user_id: req.session?.user?.user_id,
    };
    const result = await backendApi.createRegistryEntry(data);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/registry/last', async (req, res, next) => {
  try {
    const { row_type_id, limit } = req.query;
    const data = await backendApi.getLastRegistryRows(
      Number(row_type_id),
      Number(limit) || 5
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Reports
router.get('/reports/:type', async (req, res, next) => {
  try {
    const data = await backendApi.getReport(req.params.type, req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Products routes
router.get('/products', async (req, res, next) => {
  try {
    const data = await backendApi.getProducts(req.query as any);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const data = await backendApi.createProduct(req.body);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.put('/products/:id', async (req, res, next) => {
  try {
    const data = await backendApi.updateProduct(Number(req.params.id), req.body);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    const data = await backendApi.deleteProduct(Number(req.params.id));
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post('/products/import/:type', async (req, res, next) => {
  try {
    const type = req.params.type as 'csv' | 'excel' | 'google-sheets';
    const data = await backendApi.importProducts(type, req.body);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;