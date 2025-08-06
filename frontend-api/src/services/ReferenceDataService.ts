import { BaseService } from './BaseService';
import { Period, FinancialCenter, CostCenter, Nomenclature, RowType, PrismaClient } from '../generated/prisma';

export class ReferenceDataService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Periods
  async getPeriods(): Promise<Period[]> {
    return this.prisma.period.findMany({
      orderBy: { date: 'desc' }
    });
  }

  async createPeriod(data: { date: Date; ruName: string }): Promise<Period> {
    return this.prisma.period.create({
      data
    });
  }

  async updatePeriod(id: number, data: { date?: Date; ruName?: string }): Promise<Period> {
    return this.prisma.period.update({
      where: { id },
      data
    });
  }

  async deletePeriod(id: number): Promise<Period> {
    // TODO: Uncomment when t_f_registry table is created
    // Check if period has related registry entries
    // const registryCount = await this.prisma.registry.count({
    //   where: { periodId: id }
    // });

    // if (registryCount > 0) {
    //   throw new Error(`Cannot delete period: ${registryCount} related transactions exist`);
    // }

    return this.prisma.period.delete({
      where: { id }
    });
  }

  async getPeriodById(id: number): Promise<Period | null> {
    return this.prisma.period.findUnique({
      where: { id }
    });
  }

  // Financial Centers
  async getFinancialCenters(): Promise<FinancialCenter[]> {
    return this.prisma.financialCenter.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createFinancialCenter(name: string): Promise<FinancialCenter> {
    return this.prisma.financialCenter.create({
      data: { name }
    });
  }

  // Cost Centers
  async getCostCenters(): Promise<CostCenter[]> {
    return this.prisma.costCenter.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createCostCenter(name: string): Promise<CostCenter> {
    return this.prisma.costCenter.create({
      data: { name }
    });
  }

  // Nomenclatures
  async getNomenclatures(): Promise<Nomenclature[]> {
    return this.prisma.nomenclature.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createNomenclature(data: {
    name: string;
    accountName: string;
    billName: string;
    operation: string;
    isBudget: boolean;
    isFact: boolean;
  }): Promise<Nomenclature> {
    return this.prisma.nomenclature.create({
      data
    });
  }

  // Row Types
  async getRowTypes(): Promise<RowType[]> {
    return this.prisma.rowType.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createRowType(name: string): Promise<RowType> {
    return this.prisma.rowType.create({
      data: { name }
    });
  }
}