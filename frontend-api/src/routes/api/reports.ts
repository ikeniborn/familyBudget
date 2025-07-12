import express from 'express';
import { ReportService } from '../../services/ReportService';
import prisma from '../../database/prisma';

const router = express.Router();
const reportService = new ReportService(prisma);

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

// Helper function to parse report filters from query params
const parseFilters = (query: any) => {
  const filters: any = {};
  
  if (query.periodIds) {
    filters.periodIds = Array.isArray(query.periodIds) 
      ? query.periodIds.map((id: string) => parseInt(id))
      : [parseInt(query.periodIds)];
  }
  
  if (query.financialCenterIds) {
    filters.financialCenterIds = Array.isArray(query.financialCenterIds)
      ? query.financialCenterIds.map((id: string) => parseInt(id))
      : [parseInt(query.financialCenterIds)];
  }
  
  if (query.costCenterIds) {
    filters.costCenterIds = Array.isArray(query.costCenterIds)
      ? query.costCenterIds.map((id: string) => parseInt(id))
      : [parseInt(query.costCenterIds)];
  }
  
  if (query.nomenclatureIds) {
    filters.nomenclatureIds = Array.isArray(query.nomenclatureIds)
      ? query.nomenclatureIds.map((id: string) => parseInt(id))
      : [parseInt(query.nomenclatureIds)];
  }
  
  if (query.rowTypeIds) {
    filters.rowTypeIds = Array.isArray(query.rowTypeIds)
      ? query.rowTypeIds.map((id: string) => parseInt(id))
      : [parseInt(query.rowTypeIds)];
  }
  
  if (query.startDate) {
    filters.startDate = new Date(query.startDate);
  }
  
  if (query.endDate) {
    filters.endDate = new Date(query.endDate);
  }
  
  return filters;
};

// GET /api/reports/budget-vs-actual - Budget vs Actual Report
router.get('/budget-vs-actual', getUserId, async (req, res): Promise<void> => {
  try {
    const filters = parseFilters(req.query);
    const report = await reportService.getBudgetVsActualReport(req.userId!, filters);
    res.json(report);
  } catch (error) {
    console.error('Error generating budget vs actual report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/reports/period-summary - Period Summary Report
router.get('/period-summary', getUserId, async (req, res): Promise<void> => {
  try {
    const filters = parseFilters(req.query);
    const report = await reportService.getPeriodSummaryReport(req.userId!, filters);
    res.json(report);
  } catch (error) {
    console.error('Error generating period summary report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/reports/transactions - Detailed Transactions Report
router.get('/transactions', getUserId, async (req, res): Promise<void> => {
  try {
    const filters = parseFilters(req.query);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const report = await reportService.getDetailedTransactionsReport(
      req.userId!,
      filters,
      page,
      limit
    );
    
    res.json(report);
  } catch (error) {
    console.error('Error generating transactions report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/reports/financial-center-breakdown - Financial Center Breakdown
router.get('/financial-center-breakdown', getUserId, async (req, res): Promise<void> => {
  try {
    const filters = parseFilters(req.query);
    const report = await reportService.getFinancialCenterBreakdown(req.userId!, filters);
    res.json(report);
  } catch (error) {
    console.error('Error generating financial center breakdown:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/reports/monthly-trend - Monthly Trend Analysis
router.get('/monthly-trend', getUserId, async (req, res): Promise<void> => {
  try {
    const filters = parseFilters(req.query);
    const report = await reportService.getMonthlyTrend(req.userId!, filters);
    res.json(report);
  } catch (error) {
    console.error('Error generating monthly trend report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// POST /api/reports/custom - Custom Report with Complex Filters
router.post('/custom', getUserId, async (req, res): Promise<void> => {
  try {
    const { reportType, filters, options } = req.body;
    
    if (!reportType) {
      res.status(400).json({ error: 'Report type is required' });
      return;
    }
    
    let report;
    
    switch (reportType) {
      case 'budget-vs-actual':
        report = await reportService.getBudgetVsActualReport(req.userId!, filters);
        break;
        
      case 'period-summary':
        report = await reportService.getPeriodSummaryReport(req.userId!, filters);
        break;
        
      case 'transactions':
        report = await reportService.getDetailedTransactionsReport(
          req.userId!,
          filters,
          options?.page || 1,
          options?.limit || 50
        );
        break;
        
      case 'financial-center-breakdown':
        report = await reportService.getFinancialCenterBreakdown(req.userId!, filters);
        break;
        
      case 'monthly-trend':
        report = await reportService.getMonthlyTrend(req.userId!, filters);
        break;
        
      default:
        res.status(400).json({ error: 'Invalid report type' });
        return;
    }
    
    res.json(report);
  } catch (error) {
    console.error('Error generating custom report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;