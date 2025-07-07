import { BaseService } from './BaseService';
import { Registry, PrismaClient } from '../generated/prisma';

interface CreateRegistryInput {
  operationDate: Date;
  periodId: number;
  financialCenterId: number;
  costCenterId: number;
  nomenclatureId: number;
  rowTypeId: number;
  costSum: number;
  comment?: string;
}

export class RegistryService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async create(data: CreateRegistryInput, userId: string): Promise<Registry> {
    return this.withUser(userId, async (userIdInt) => {
      return this.prisma.registry.create({
        data: {
          ...data,
          userId: userIdInt
        },
        include: {
          period: true,
          financialCenter: true,
          costCenter: true,
          nomenclature: true,
          rowType: true,
          user: true
        }
      });
    });
  }
  
  async getLastRows(
    userId: string,
    rowTypeId?: number,
    limit: number = 5
  ): Promise<Registry[]> {
    return this.withUser(userId, async (userIdInt) => {
      return this.prisma.registry.findMany({
        where: {
          userId: userIdInt,
          ...(rowTypeId && { rowTypeId })
        },
        include: {
          period: true,
          financialCenter: true,
          costCenter: true,
          nomenclature: true,
          rowType: true
        },
        orderBy: { id: 'desc' },
        take: limit
      });
    });
  }

  async getByPeriod(
    userId: string,
    periodId: number,
    rowTypeId?: number
  ): Promise<Registry[]> {
    return this.withUser(userId, async (userIdInt) => {
      return this.prisma.registry.findMany({
        where: {
          userId: userIdInt,
          periodId,
          ...(rowTypeId && { rowTypeId })
        },
        include: {
          period: true,
          financialCenter: true,
          costCenter: true,
          nomenclature: true,
          rowType: true
        },
        orderBy: { operationDate: 'desc' }
      });
    });
  }

  async update(
    id: number,
    data: Partial<CreateRegistryInput>,
    userId: string
  ): Promise<Registry> {
    return this.withUser(userId, async (userIdInt) => {
      return this.prisma.registry.update({
        where: { 
          id,
          userId: userIdInt // Ensure user can only update their own records
        },
        data,
        include: {
          period: true,
          financialCenter: true,
          costCenter: true,
          nomenclature: true,
          rowType: true
        }
      });
    });
  }

  async delete(id: number, userId: string): Promise<Registry> {
    return this.withUser(userId, async (userIdInt) => {
      return this.prisma.registry.delete({
        where: { 
          id,
          userId: userIdInt // Ensure user can only delete their own records
        }
      });
    });
  }
}