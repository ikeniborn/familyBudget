import express from 'express';
import { ReferenceDataService } from '../../services/ReferenceDataService';
import prisma from '../../database/prisma';

const router = express.Router();
const referenceService = new ReferenceDataService(prisma);

// Periods
router.get('/periods', async (_req: express.Request, res: express.Response): Promise<void> => {
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

router.post('/periods', async (req: express.Request, res: express.Response): Promise<void> => {
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