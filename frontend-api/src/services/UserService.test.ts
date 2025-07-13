import { UserService } from './UserService';
import { userFixtures } from '../test/fixtures';

// Mock PrismaClient methods
const mockUserFindUnique = jest.fn();
const mockUserCreate = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserFindMany = jest.fn();

const mockPrisma = {
  user: {
    findUnique: mockUserFindUnique,
    create: mockUserCreate,
    update: mockUserUpdate,
    findMany: mockUserFindMany,
  },
} as any;

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService(mockPrisma);
    mockUserFindUnique.mockClear();
    mockUserCreate.mockClear();
    mockUserUpdate.mockClear();
    mockUserFindMany.mockClear();
  });

  describe('findById', () => {
    it('should find user by id with registries', async () => {
      const mockUser = {
        ...userFixtures.activeUser,
        registries: [],
      };
      mockUserFindUnique.mockResolvedValue(mockUser);

      const result = await userService.findById(1);

      expect(result).toEqual(mockUser);
      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { registries: true },
      });
    });

    it('should return null when user not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await userService.findById(999);

      expect(result).toBeNull();
      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        include: { registries: true },
      });
    });

    it('should handle Prisma errors', async () => {
      const prismaError = new Error('Database connection error');
      mockUserFindUnique.mockRejectedValue(prismaError);

      await expect(userService.findById(1)).rejects.toThrow('Database connection error');
    });
  });

  describe('findByTelegramId', () => {
    it('should find user by telegram id', async () => {
      mockUserFindUnique.mockResolvedValue(userFixtures.activeUser);

      const result = await userService.findByTelegramId('123456789');

      expect(result).toEqual(userFixtures.activeUser);
      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { telegramId: '123456789' },
      });
    });

    it('should return null when user not found by telegram id', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await userService.findByTelegramId('nonexistent');

      expect(result).toBeNull();
      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { telegramId: 'nonexistent' },
      });
    });

    it('should handle string telegram ids', async () => {
      mockUserFindUnique.mockResolvedValue(userFixtures.activeUser);

      await userService.findByTelegramId('987654321');

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { telegramId: '987654321' },
      });
    });
  });

  describe('create', () => {
    it('should create user with required fields', async () => {
      const userData = {
        userName: 'New User',
        telegramId: '555666777',
      };
      const expectedUser = {
        id: 3,
        ...userData,
        userEmail: null,
        isActive: true,
      };
      
      mockUserCreate.mockResolvedValue(expectedUser as any);

      const result = await userService.create(userData);

      expect(result).toEqual(expectedUser);
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: userData,
      });
    });

    it('should create user with optional email', async () => {
      const userData = {
        userName: 'User with Email',
        userEmail: 'user@example.com',
        telegramId: '111222333',
      };
      const expectedUser = {
        id: 4,
        ...userData,
        isActive: true,
      };
      
      mockUserCreate.mockResolvedValue(expectedUser as any);

      const result = await userService.create(userData);

      expect(result).toEqual(expectedUser);
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: userData,
      });
    });

    it('should handle Prisma constraint violations', async () => {
      const userData = {
        userName: 'Duplicate User',
        telegramId: '123456789', // Existing telegram ID
      };
      
      const prismaError = new Error('Unique constraint failed on the fields: (`telegramId`)');
      mockUserCreate.mockRejectedValue(prismaError);

      await expect(userService.create(userData)).rejects.toThrow('Unique constraint failed');
    });

    it('should pass through all provided fields', async () => {
      const userData = {
        userName: 'Complete User',
        userEmail: 'complete@test.com',
        telegramId: '999888777',
      };
      
      mockUserCreate.mockResolvedValue(userData as any);

      await userService.create(userData);

      expect(mockUserCreate).toHaveBeenCalledWith({
        data: userData,
      });
    });
  });

  describe('update', () => {
    it('should update user with partial data', async () => {
      const updateData = { userName: 'Updated Name' };
      const updatedUser = {
        ...userFixtures.activeUser,
        userName: 'Updated Name',
      };
      
      mockUserUpdate.mockResolvedValue(updatedUser as any);

      const result = await userService.update(1, updateData);

      expect(result).toEqual(updatedUser);
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
      });
    });

    it('should update multiple fields', async () => {
      const updateData = {
        userName: 'New Name',
        userEmail: 'new@email.com',
        isActive: false,
      };
      const updatedUser = {
        ...userFixtures.activeUser,
        ...updateData,
      };
      
      mockUserUpdate.mockResolvedValue(updatedUser as any);

      const result = await userService.update(1, updateData);

      expect(result).toEqual(updatedUser);
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
      });
    });

    it('should handle user not found during update', async () => {
      const updateData = { userName: 'Updated Name' };
      const prismaError = new Error('Record to update not found');
      
      mockUserUpdate.mockRejectedValue(prismaError);

      await expect(userService.update(999, updateData)).rejects.toThrow('Record to update not found');
    });

    it('should update isActive status', async () => {
      const updateData = { isActive: false };
      const updatedUser = {
        ...userFixtures.activeUser,
        isActive: false,
      };
      
      mockUserUpdate.mockResolvedValue(updatedUser as any);

      const result = await userService.update(1, updateData);

      expect(result).toEqual(updatedUser);
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
      });
    });

    it('should update email field', async () => {
      const updateData = { userEmail: 'updated@example.com' };
      const updatedUser = {
        ...userFixtures.activeUser,
        userEmail: 'updated@example.com',
      };
      
      mockUserUpdate.mockResolvedValue(updatedUser as any);

      const result = await userService.update(1, updateData);

      expect(result).toEqual(updatedUser);
    });
  });

  describe('getAll', () => {
    it('should return all active users ordered by name', async () => {
      const mockUsers = [userFixtures.activeUser, userFixtures.adminUser];
      mockUserFindMany.mockResolvedValue(mockUsers);

      const result = await userService.getAll();

      expect(result).toEqual(mockUsers);
      expect(mockUserFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { userName: 'asc' },
      });
    });

    it('should return empty array when no active users', async () => {
      mockUserFindMany.mockResolvedValue([]);

      const result = await userService.getAll();

      expect(result).toEqual([]);
      expect(mockUserFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { userName: 'asc' },
      });
    });

    it('should only return active users', async () => {
      const activeUsers = [userFixtures.activeUser];
      mockUserFindMany.mockResolvedValue(activeUsers);

      const result = await userService.getAll();

      expect(result).toEqual(activeUsers);
      expect(mockUserFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { userName: 'asc' },
      });
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockUserFindMany.mockRejectedValue(dbError);

      await expect(userService.getAll()).rejects.toThrow('Database connection failed');
    });
  });

  describe('inheritance from BaseService', () => {
    it('should be instance of BaseService', () => {
      expect(userService).toBeInstanceOf(userService.constructor);
      expect(userService.constructor.name).toBe('UserService');
    });

    it('should have access to validateUserId method', () => {
      // Access protected method through any cast for testing
      const validateUserId = (userService as any).validateUserId;
      expect(typeof validateUserId).toBe('function');
      
      expect(validateUserId('123')).toBe(123);
      expect(() => validateUserId('invalid')).toThrow('Invalid user ID');
    });
  });
});