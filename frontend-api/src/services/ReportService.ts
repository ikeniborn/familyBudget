import { BaseService } from './BaseService';
import { PrismaClient } from '../generated/prisma';

interface ReportFilters {
  periodIds?: number[];
  financialCenterIds?: number[];
  costCenterIds?: number[];
  nomenclatureIds?: number[];
  rowTypeIds?: number[];
  startDate?: Date;
  endDate?: Date;
}

interface BudgetVsActualData {
  nomenclature: string;
  budgetSum: number;
  actualSum: number;
  variance: number;
  variancePercent: number;
}

interface PeriodSummary {
  periodName: string;
  totalBudget: number;
  totalActual: number;
  variance: number;
  variancePercent: number;
}

export class ReportService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Budget vs Actual Report
  async getBudgetVsActualReport(
    userId: string,
    filters: ReportFilters
  ): Promise<BudgetVsActualData[]> {
    return this.withUser(userId, async (userIdInt) => {
      const where = {
        userId: userIdInt,
        ...(filters.periodIds?.length && {
          periodId: { in: filters.periodIds }
        }),
        ...(filters.financialCenterIds?.length && {
          financialCenterId: { in: filters.financialCenterIds }
        }),
        ...(filters.costCenterIds?.length && {
          costCenterId: { in: filters.costCenterIds }
        }),
        ...(filters.nomenclatureIds?.length && {
          nomenclatureId: { in: filters.nomenclatureIds }
        }),
        ...(filters.startDate && filters.endDate && {
          operationDate: {
            gte: filters.startDate,
            lte: filters.endDate
          }
        })
      };

      // Get budget data (row_type_id = 1 for budget)
      const budgetData = await this.prisma.registry.groupBy({
        by: ['nomenclatureId'],
        where: {
          ...where,
          rowTypeId: 1 // Budget
        },
        _sum: {
          costSum: true
        },
        _count: true
      });

      // Get actual data (row_type_id = 2 for actual)
      const actualData = await this.prisma.registry.groupBy({
        by: ['nomenclatureId'],
        where: {
          ...where,
          rowTypeId: 2 // Actual
        },
        _sum: {
          costSum: true
        },
        _count: true
      });

      // Get nomenclature names
      const nomenclatureIds = [
        ...new Set([
          ...budgetData.map(b => b.nomenclatureId),
          ...actualData.map(a => a.nomenclatureId)
        ])
      ];

      const nomenclatures = await this.prisma.nomenclature.findMany({
        where: {
          id: { in: nomenclatureIds }
        },
        select: {
          id: true,
          name: true
        }
      });

      const nomenclatureMap = new Map(
        nomenclatures.map(n => [n.id, n.name])
      );

      // Combine budget and actual data
      const result: BudgetVsActualData[] = [];
      const processedIds = new Set<number>();

      budgetData.forEach(budget => {
        const actual = actualData.find(a => a.nomenclatureId === budget.nomenclatureId);
        const budgetSum = Number(budget._sum.costSum || 0);
        const actualSum = Number(actual?._sum.costSum || 0);
        const variance = actualSum - budgetSum;
        const variancePercent = budgetSum > 0 ? (variance / budgetSum) * 100 : 0;

        result.push({
          nomenclature: nomenclatureMap.get(budget.nomenclatureId) || 'Unknown',
          budgetSum,
          actualSum,
          variance,
          variancePercent
        });

        processedIds.add(budget.nomenclatureId);
      });

      // Add actual-only entries (no budget)
      actualData.forEach(actual => {
        if (!processedIds.has(actual.nomenclatureId)) {
          const actualSum = Number(actual._sum.costSum || 0);
          
          result.push({
            nomenclature: nomenclatureMap.get(actual.nomenclatureId) || 'Unknown',
            budgetSum: 0,
            actualSum,
            variance: actualSum,
            variancePercent: 100
          });
        }
      });

      return result.sort((a, b) => a.nomenclature.localeCompare(b.nomenclature));
    });
  }

  // Period Summary Report
  async getPeriodSummaryReport(
    userId: string,
    filters: ReportFilters
  ): Promise<PeriodSummary[]> {
    return this.withUser(userId, async (userIdInt) => {
      const where = {
        userId: userIdInt,
        ...(filters.periodIds?.length && {
          periodId: { in: filters.periodIds }
        }),
        ...(filters.financialCenterIds?.length && {
          financialCenterId: { in: filters.financialCenterIds }
        }),
        ...(filters.costCenterIds?.length && {
          costCenterId: { in: filters.costCenterIds }
        }),
        ...(filters.nomenclatureIds?.length && {
          nomenclatureId: { in: filters.nomenclatureIds }
        })
      };

      // Get data grouped by period and row type
      const periodData = await this.prisma.registry.groupBy({
        by: ['periodId', 'rowTypeId'],
        where,
        _sum: {
          costSum: true
        }
      });

      // Get period names
      const periodIds = [...new Set(periodData.map(p => p.periodId))];
      const periods = await this.prisma.period.findMany({
        where: {
          id: { in: periodIds }
        },
        select: {
          id: true,
          ruName: true
        }
      });

      const periodMap = new Map(
        periods.map(p => [p.id, p.ruName])
      );

      // Process data by period
      const periodSummaries = new Map<number, { budget: number; actual: number }>();

      periodData.forEach(data => {
        const periodId = data.periodId;
        const sum = Number(data._sum.costSum || 0);
        
        if (!periodSummaries.has(periodId)) {
          periodSummaries.set(periodId, { budget: 0, actual: 0 });
        }

        const summary = periodSummaries.get(periodId)!;
        
        if (data.rowTypeId === 1) { // Budget
          summary.budget += sum;
        } else if (data.rowTypeId === 2) { // Actual
          summary.actual += sum;
        }
      });

      // Convert to result format
      const result: PeriodSummary[] = [];
      
      periodSummaries.forEach((summary, periodId) => {
        const variance = summary.actual - summary.budget;
        const variancePercent = summary.budget > 0 ? (variance / summary.budget) * 100 : 0;

        result.push({
          periodName: periodMap.get(periodId) || 'Unknown',
          totalBudget: summary.budget,
          totalActual: summary.actual,
          variance,
          variancePercent
        });
      });

      return result.sort((a, b) => a.periodName.localeCompare(b.periodName));
    });
  }

  // Detailed transactions report
  async getDetailedTransactionsReport(
    userId: string,
    filters: ReportFilters,
    page: number = 1,
    limit: number = 50
  ) {
    return this.withUser(userId, async (userIdInt) => {
      const skip = (page - 1) * limit;
      
      const where = {
        userId: userIdInt,
        ...(filters.periodIds?.length && {
          periodId: { in: filters.periodIds }
        }),
        ...(filters.financialCenterIds?.length && {
          financialCenterId: { in: filters.financialCenterIds }
        }),
        ...(filters.costCenterIds?.length && {
          costCenterId: { in: filters.costCenterIds }
        }),
        ...(filters.nomenclatureIds?.length && {
          nomenclatureId: { in: filters.nomenclatureIds }
        }),
        ...(filters.rowTypeIds?.length && {
          rowTypeId: { in: filters.rowTypeIds }
        }),
        ...(filters.startDate && filters.endDate && {
          operationDate: {
            gte: filters.startDate,
            lte: filters.endDate
          }
        })
      };

      const [transactions, total] = await Promise.all([
        this.prisma.registry.findMany({
          where,
          include: {
            period: true,
            financialCenter: true,
            costCenter: true,
            nomenclature: true,
            rowType: true
          },
          orderBy: {
            operationDate: 'desc'
          },
          skip,
          take: limit
        }),
        this.prisma.registry.count({ where })
      ]);

      return {
        transactions,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    });
  }

  // Financial center breakdown
  async getFinancialCenterBreakdown(
    userId: string,
    filters: ReportFilters
  ) {
    return this.withUser(userId, async (userIdInt) => {
      const where = {
        userId: userIdInt,
        ...(filters.periodIds?.length && {
          periodId: { in: filters.periodIds }
        }),
        ...(filters.rowTypeIds?.length && {
          rowTypeId: { in: filters.rowTypeIds }
        }),
        ...(filters.startDate && filters.endDate && {
          operationDate: {
            gte: filters.startDate,
            lte: filters.endDate
          }
        })
      };

      const breakdown = await this.prisma.registry.groupBy({
        by: ['financialCenterId'],
        where,
        _sum: {
          costSum: true
        },
        _count: true
      });

      // Get financial center names
      const centerIds = breakdown.map(b => b.financialCenterId);
      const centers = await this.prisma.financialCenter.findMany({
        where: {
          id: { in: centerIds }
        },
        select: {
          id: true,
          name: true
        }
      });

      const centerMap = new Map(centers.map(c => [c.id, c.name]));

      return breakdown.map(item => ({
        financialCenter: centerMap.get(item.financialCenterId) || 'Unknown',
        totalSum: Number(item._sum.costSum || 0),
        transactionCount: item._count
      })).sort((a, b) => b.totalSum - a.totalSum);
    });
  }

  // Monthly trend analysis
  async getMonthlyTrend(
    userId: string,
    filters: ReportFilters
  ) {
    return this.withUser(userId, async (userIdInt) => {
      const where = {
        userId: userIdInt,
        ...(filters.financialCenterIds?.length && {
          financialCenterId: { in: filters.financialCenterIds }
        }),
        ...(filters.costCenterIds?.length && {
          costCenterId: { in: filters.costCenterIds }
        }),
        ...(filters.nomenclatureIds?.length && {
          nomenclatureId: { in: filters.nomenclatureIds }
        }),
        ...(filters.startDate && filters.endDate && {
          operationDate: {
            gte: filters.startDate,
            lte: filters.endDate
          }
        })
      };

      // Group by period and row type for trend analysis
      const trendData = await this.prisma.registry.groupBy({
        by: ['periodId', 'rowTypeId'],
        where,
        _sum: {
          costSum: true
        },
        orderBy: {
          periodId: 'asc'
        }
      });

      // Get period information
      const periodIds = [...new Set(trendData.map(t => t.periodId))];
      const periods = await this.prisma.period.findMany({
        where: {
          id: { in: periodIds }
        },
        select: {
          id: true,
          ruName: true,
          date: true
        },
        orderBy: {
          date: 'asc'
        }
      });

      // const periodMap = new Map(periods.map(p => [p.id, p]));

      // Process trend data
      const trendMap = new Map<number, { budget: number; actual: number }>();

      trendData.forEach(data => {
        const periodId = data.periodId;
        const sum = Number(data._sum.costSum || 0);
        
        if (!trendMap.has(periodId)) {
          trendMap.set(periodId, { budget: 0, actual: 0 });
        }

        const trend = trendMap.get(periodId)!;
        
        if (data.rowTypeId === 1) { // Budget
          trend.budget += sum;
        } else if (data.rowTypeId === 2) { // Actual
          trend.actual += sum;
        }
      });

      // Convert to result format
      return periods.map(period => {
        const trend = trendMap.get(period.id) || { budget: 0, actual: 0 };
        const variance = trend.actual - trend.budget;
        
        return {
          period: period.ruName,
          date: period.date,
          budget: trend.budget,
          actual: trend.actual,
          variance,
          variancePercent: trend.budget > 0 ? (variance / trend.budget) * 100 : 0
        };
      });
    });
  }
}