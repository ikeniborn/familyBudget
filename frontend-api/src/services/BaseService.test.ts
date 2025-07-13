import { BaseService } from './BaseService';
import { PrismaClient } from '../generated/prisma';

// Create a concrete implementation for testing
class TestService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async testWithUser<T>(userId: string, operation: (userId: number) => Promise<T>): Promise<T> {
    return this.withUser(userId, operation);
  }

  testValidateUserId(userId: string): number {
    return this.validateUserId(userId);
  }

  get testPrisma() {
    return this.prisma;
  }
}

describe('BaseService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;
  let testService: TestService;

  beforeEach(() => {
    mockPrisma = {
      $disconnect: jest.fn(),
    } as any;
    
    testService = new TestService(mockPrisma);
  });

  describe('constructor', () => {
    it('should initialize with prisma client', () => {
      expect(testService.testPrisma).toBe(mockPrisma);
    });
  });

  describe('withUser', () => {
    it('should execute operation with parsed user ID', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await testService.testWithUser('123', mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledWith(123);
    });

    it('should handle string user ID conversion', async () => {
      const mockOperation = jest.fn().mockResolvedValue('result');
      
      await testService.testWithUser('456', mockOperation);
      
      expect(mockOperation).toHaveBeenCalledWith(456);
    });

    it('should propagate operation errors', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      await expect(testService.testWithUser('123', mockOperation))
        .rejects.toThrow('Operation failed');
      
      expect(mockOperation).toHaveBeenCalledWith(123);
    });

    it('should handle async operations correctly', async () => {
      const mockOperation = jest.fn().mockImplementation(async (userId: number) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `User ${userId} processed`;
      });
      
      const result = await testService.testWithUser('789', mockOperation);
      
      expect(result).toBe('User 789 processed');
      expect(mockOperation).toHaveBeenCalledWith(789);
    });
  });

  describe('validateUserId', () => {
    it('should return valid positive integer user ID', () => {
      expect(testService.testValidateUserId('123')).toBe(123);
      expect(testService.testValidateUserId('1')).toBe(1);
      expect(testService.testValidateUserId('999')).toBe(999);
    });

    it('should throw error for invalid user IDs', () => {
      expect(() => testService.testValidateUserId('0'))
        .toThrow('Invalid user ID');
      
      expect(() => testService.testValidateUserId('-1'))
        .toThrow('Invalid user ID');
      
      expect(() => testService.testValidateUserId('abc'))
        .toThrow('Invalid user ID');
      
      expect(() => testService.testValidateUserId(''))
        .toThrow('Invalid user ID');
      
      // parseInt('12.5') returns 12, which is valid
      expect(testService.testValidateUserId('12.5')).toBe(12);
    });

    it('should throw error for non-numeric strings', () => {
      expect(() => testService.testValidateUserId('user123'))
        .toThrow('Invalid user ID');
      
      expect(() => testService.testValidateUserId('null'))
        .toThrow('Invalid user ID');
      
      expect(() => testService.testValidateUserId('undefined'))
        .toThrow('Invalid user ID');
    });

    it('should throw error for special values', () => {
      expect(() => testService.testValidateUserId('NaN'))
        .toThrow('Invalid user ID');
      
      expect(() => testService.testValidateUserId('Infinity'))
        .toThrow('Invalid user ID');
      
      expect(() => testService.testValidateUserId('-Infinity'))
        .toThrow('Invalid user ID');
    });

    it('should handle whitespace', () => {
      expect(testService.testValidateUserId(' 123 ')).toBe(123);
      expect(testService.testValidateUserId('123\n')).toBe(123);
      expect(testService.testValidateUserId('\t123')).toBe(123);
    });

    it('should reject zero and negative numbers', () => {
      expect(() => testService.testValidateUserId('0'))
        .toThrow('Invalid user ID');
      
      expect(() => testService.testValidateUserId('-5'))
        .toThrow('Invalid user ID');
      
      expect(() => testService.testValidateUserId('-999'))
        .toThrow('Invalid user ID');
    });
  });

  describe('integration', () => {
    it('should work when validateUserId is used with withUser', async () => {
      const mockOperation = jest.fn().mockResolvedValue('validated');
      
      const result = await testService.testWithUser('123', async (userId) => {
        const validatedId = testService.testValidateUserId(userId.toString());
        return mockOperation(validatedId);
      });
      
      expect(result).toBe('validated');
      expect(mockOperation).toHaveBeenCalledWith(123);
    });

    it('should handle validation errors in withUser context', async () => {
      await expect(
        testService.testWithUser('invalid', async (userId) => {
          testService.testValidateUserId(userId.toString());
          return 'should not reach here';
        })
      ).rejects.toThrow('Invalid user ID');
    });
  });
});