import express from 'express';
import { RegistryService } from '../../services/RegistryService';
import prisma from '../../database/prisma';

const router = express.Router();
const registryService = new RegistryService(prisma);

// Middleware to get user ID from session or header
const getUserId = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const userId = req.session?.user?.user_id || req.headers['x-user-id'];
  
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }
  
  req.userId = userId.toString();
  next();
};

// GET /api/registry/last - Get last registry entries
router.get('/last', getUserId, async (req, res): Promise<void> => {
  try {
    const { row_type_id, limit } = req.query;
    const rowTypeId = row_type_id ? parseInt(row_type_id as string) : undefined;
    const limitNum = limit ? parseInt(limit as string) : 5;

    const registries = await registryService.getLastRows(
      req.userId!,
      rowTypeId,
      limitNum
    );

    res.json(registries);
  } catch (error) {
    console.error('Error fetching last registries:', error);
    res.status(500).json({ error: 'Failed to fetch registries' });
  }
});

// GET /api/registry/period/:periodId - Get registries by period
router.get('/period/:periodId', getUserId, async (req, res): Promise<void> => {
  try {
    const periodId = parseInt(req.params.periodId);
    if (isNaN(periodId)) {
      res.status(400).json({ error: 'Invalid period ID' });
      return;
    }

    const { row_type_id } = req.query;
    const rowTypeId = row_type_id ? parseInt(row_type_id as string) : undefined;

    const registries = await registryService.getByPeriod(
      req.userId!,
      periodId,
      rowTypeId
    );

    res.json(registries);
  } catch (error) {
    console.error('Error fetching registries by period:', error);
    res.status(500).json({ error: 'Failed to fetch registries' });
  }
});

// POST /api/registry - Create new registry entry
router.post('/', getUserId, async (req, res): Promise<void> => {
  try {
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

    // Validate required fields
    if (!operationDate || !periodId || !financialCenterId || !costCenterId || 
        !nomenclatureId || !rowTypeId || costSum === undefined) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const registry = await registryService.create({
      operationDate: new Date(operationDate),
      periodId: parseInt(periodId),
      financialCenterId: parseInt(financialCenterId),
      costCenterId: parseInt(costCenterId),
      nomenclatureId: parseInt(nomenclatureId),
      rowTypeId: parseInt(rowTypeId),
      costSum: parseFloat(costSum),
      comment
    }, req.userId!);

    res.status(201).json(registry);
  } catch (error) {
    console.error('Error creating registry:', error);
    res.status(500).json({ error: 'Failed to create registry' });
  }
});

// PUT /api/registry/:id - Update registry entry
router.put('/:id', getUserId, async (req, res): Promise<void> => {
  try {
    const registryId = parseInt(req.params.id);
    if (isNaN(registryId)) {
      res.status(400).json({ error: 'Invalid registry ID' });
      return;
    }

    const updateData = { ...req.body };
    if (updateData.operationDate) {
      updateData.operationDate = new Date(updateData.operationDate);
    }
    if (updateData.costSum) {
      updateData.costSum = parseFloat(updateData.costSum);
    }

    const registry = await registryService.update(registryId, updateData, req.userId!);
    res.json(registry);
  } catch (error) {
    console.error('Error updating registry:', error);
    res.status(500).json({ error: 'Failed to update registry' });
  }
});

// DELETE /api/registry/:id - Delete registry entry
router.delete('/:id', getUserId, async (req, res): Promise<void> => {
  try {
    const registryId = parseInt(req.params.id);
    if (isNaN(registryId)) {
      res.status(400).json({ error: 'Invalid registry ID' });
      return;
    }

    await registryService.delete(registryId, req.userId!);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting registry:', error);
    res.status(500).json({ error: 'Failed to delete registry' });
  }
});

export default router;