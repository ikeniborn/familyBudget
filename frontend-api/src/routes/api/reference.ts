import express from 'express';
import { ReferenceDataService } from '../../services/ReferenceDataService';
import prisma from '../../database/prisma';

const router = express.Router();
const referenceService = new ReferenceDataService(prisma);

// Periods
router.get('/periods', async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const periods = await referenceService.getPeriods();
    res.json(periods);
  } catch (error) {
    console.error('Error fetching periods:', error);
    res.status(500).json({ error: 'Failed to fetch periods' });
  }
});

router.post('/periods', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { date, ruName } = req.body;
    
    if (!date || !ruName) {
      res.status(400).json({ error: 'date and ruName are required' });
      return;
    }

    const period = await referenceService.createPeriod({
      date: new Date(date),
      ruName
    });

    res.status(201).json(period);
  } catch (error) {
    console.error('Error creating period:', error);
    res.status(500).json({ error: 'Failed to create period' });
  }
});

// Financial Centers
router.get('/financial_centers', async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const centers = await referenceService.getFinancialCenters();
    res.json(centers);
  } catch (error) {
    console.error('Error fetching financial centers:', error);
    res.status(500).json({ error: 'Failed to fetch financial centers' });
  }
});

router.post('/financial_centers', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { name } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const center = await referenceService.createFinancialCenter(name);
    res.status(201).json(center);
  } catch (error) {
    console.error('Error creating financial center:', error);
    res.status(500).json({ error: 'Failed to create financial center' });
  }
});

// Cost Centers
router.get('/cost_centers', async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const centers = await referenceService.getCostCenters();
    res.json(centers);
  } catch (error) {
    console.error('Error fetching cost centers:', error);
    res.status(500).json({ error: 'Failed to fetch cost centers' });
  }
});

router.post('/cost_centers', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { name } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const center = await referenceService.createCostCenter(name);
    res.status(201).json(center);
  } catch (error) {
    console.error('Error creating cost center:', error);
    res.status(500).json({ error: 'Failed to create cost center' });
  }
});

// Nomenclatures
router.get('/nomenclatures', async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const nomenclatures = await referenceService.getNomenclatures();
    res.json(nomenclatures);
  } catch (error) {
    console.error('Error fetching nomenclatures:', error);
    res.status(500).json({ error: 'Failed to fetch nomenclatures' });
  }
});

router.post('/nomenclatures', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { name, accountName, billName, operation, isBudget, isFact } = req.body;
    
    if (!name || !accountName || !billName || !operation || 
        isBudget === undefined || isFact === undefined) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const nomenclature = await referenceService.createNomenclature({
      name,
      accountName,
      billName,
      operation,
      isBudget,
      isFact
    });

    res.status(201).json(nomenclature);
  } catch (error) {
    console.error('Error creating nomenclature:', error);
    res.status(500).json({ error: 'Failed to create nomenclature' });
  }
});

// Row Types
router.get('/row_types', async (_req: express.Request, res: express.Response): Promise<void> => {
  try {
    const rowTypes = await referenceService.getRowTypes();
    res.json(rowTypes);
  } catch (error) {
    console.error('Error fetching row types:', error);
    res.status(500).json({ error: 'Failed to fetch row types' });
  }
});

router.post('/row_types', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { name } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const rowType = await referenceService.createRowType(name);
    res.status(201).json(rowType);
  } catch (error) {
    console.error('Error creating row type:', error);
    res.status(500).json({ error: 'Failed to create row type' });
  }
});

export default router;