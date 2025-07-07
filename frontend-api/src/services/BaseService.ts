import { PrismaClient } from '../generated/prisma';

export abstract class BaseService {
  constructor(protected prisma: PrismaClient) {}
  
  protected async withUser<T>(
    userId: string,
    operation: (userId: number) => Promise<T>
  ): Promise<T> {
    return operation(parseInt(userId));
  }
  
  protected validateUserId(userId: string): number {
    const userIdInt = parseInt(userId);
    if (isNaN(userIdInt) || userIdInt <= 0) {
      throw new Error('Invalid user ID');
    }
    return userIdInt;
  }
}