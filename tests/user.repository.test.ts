import { PrismaClient } from '@prisma/client';
import {
  UserRepository,
  UserNotFoundException,
  UserAlreadyExistsException,
} from '../src/database/repositories/user.repository';
import { User } from '../src/types/task.types';
import { PrismaService } from '../src/database/prisma/prisma.service';

describe('UserRepository', () => {
  let userRepository: UserRepository;
  // type of mockPrismaService shoule be any 
  let mockPrismaService: any;
  let originalConsoleError: typeof console.error;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeAll(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    // 4. create a mock PrismaService object
    // this object needs to have the same structure as PrismaClient
    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    // inject the mocked service into the constructor of UserRepository
    userRepository = new UserRepository(mockPrismaService as PrismaService);
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.user.create as jest.Mock).mockResolvedValue(mockUser);

      const newUser = { email: 'test@example.com', password: 'hashedpassword' };
      const result = await userRepository.createUser(newUser);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: newUser.email },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: { ...newUser, deletedAt: null },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw UserAlreadyExistsException if user exists', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const newUser = { email: 'test@example.com', password: 'hashedpassword' };

      await expect(userRepository.createUser(newUser)).rejects.toThrow(
        UserAlreadyExistsException
      );

      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);

      const result = await userRepository.getUserById('user-1');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1', deletedAt: null },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw UserNotFoundException when user not found', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(userRepository.getUserById('non-existent-id')).rejects.toThrow(
        UserNotFoundException
      );
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found by email', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      const result = await userRepository.getUserByEmail('test@example.com');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com', deletedAt: null },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      // Mock the internal getUserById call
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue(updatedUser as any);

      const result = await userRepository.updateUser('user-1', { name: 'Updated Name' });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Updated Name' },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('softDeleteUser', () => {
    it('should soft delete user successfully', async () => {
      const softDeletedUser = {
        ...mockUser,
        deletedAt: new Date(),
        email: expect.stringContaining('deleted_'),
      };
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue(softDeletedUser as any);

      const result = await userRepository.softDeleteUser('user-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          deletedAt: expect.any(Date),
          email: expect.stringContaining('deleted_'),
        },
      });
      expect(result.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('hardDeleteUser', () => {
    it('should permanently delete a user', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser as any);
      (mockPrismaService.user.delete as jest.Mock).mockResolvedValue(mockUser as any);

      await userRepository.hardDeleteUser('user-1');
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });

  describe('getUserCampaigns', () => {
    it('should return campaigns for a user', async () => {
      const userWithCampaigns = { ...mockUser, campaigns: [{ id: 'campaign-1' }] };
      // Mock the internal getUserById call
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser as any);
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValueOnce(userWithCampaigns as any);

      const result = await userRepository.getUserCampaigns('user-1');

      expect(result).toEqual([{ id: 'campaign-1' }]);
    });
  });
  
  describe('getUserCount', () => {
    it('should return the count of non-deleted users', async () => {
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(5);
      const result = await userRepository.getUserCount();

      expect(mockPrismaService.user.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
      expect(result).toBe(5);
    });
  });

  // (softDeleteUser, hardDeleteUser, getUserCampaigns, getUserCount, transaction)
  describe('transaction', () => {
    it('should execute a function within a transaction', async () => {
      const fn = jest.fn().mockResolvedValue('transaction result');
      (mockPrismaService.$transaction as jest.Mock).mockImplementation(callback => callback(mockPrismaService));

      const result = await userRepository.transaction(fn);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(fn).toHaveBeenCalledWith(mockPrismaService);
      expect(result).toBe('transaction result');
    });
  });
});