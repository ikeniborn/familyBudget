import { BaseService } from './BaseService';
import { User, PrismaClient } from '../generated/prisma';

export class UserService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { registries: true }
    });
  }
  
  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramId }
    });
  }

  async create(userData: {
    userName: string;
    userEmail?: string;
    telegramId: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: userData
    });
  }

  async update(id: number, userData: {
    userName?: string;
    userEmail?: string;
    isActive?: boolean;
  }): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: userData
    });
  }

  async getAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { isActive: true },
      orderBy: { userName: 'asc' }
    });
  }
}