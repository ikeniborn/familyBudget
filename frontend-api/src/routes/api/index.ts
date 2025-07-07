import express from 'express';
import simpleRoutes from './simple';

const router = express.Router();

// Mount simplified API routes for testing
router.use('/', simpleRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'frontend-api'
  });
});

export default router;