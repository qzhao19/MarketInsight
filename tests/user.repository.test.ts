jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      $disconnect: jest.fn(),
      $transaction: jest.fn()
    }))
  };
});

import { PrismaClient } from '@prisma/client';
import {
  UserRepository,
  UserNotFoundException,
  UserAlreadyExistsException,
} from '../src/database/repositories/user.repository';
import { User } from '../src/types/task.types';


describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockPrisma: PrismaClient;
  let originalConsoleError: typeof console.error;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null // deletedAt attribute
  };

  beforeAll(() => {
    // keep raw console.error
    originalConsoleError = console.error;
    // replace console.error to a void function
    console.error = jest.fn();
  });

  afterAll(() => {
    // restore the original console.error after the test ends
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    userRepository = new UserRepository(mockPrisma);
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const newUser = { email: 'test@example.com', password: 'hashedpassword' };
      const result = await userRepository.createUser(newUser);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ 
        where: { email: newUser.email } 
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { ...newUser, deletedAt: null },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw UserAlreadyExistsException if user exists', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      
      const newUser = { email: 'test@example.com', password: 'hashedpassword' };
      
      await expect(userRepository.createUser(newUser))
        .rejects.toThrow(UserAlreadyExistsException);
      
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);

      const result = await userRepository.getUserById('user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1', deletedAt: null },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw UserNotFoundException when user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(userRepository.getUserById('non-existent-id')).rejects.toThrow(
        UserNotFoundException
      );
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found by email', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      const result = await userRepository.getUserByEmail('test@example.com');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com', deletedAt: null },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      (mockPrisma.user.update as jest.Mock).mockResolvedValue(updatedUser as any);

      const result = await userRepository.updateUser('user-1', { name: 'Updated Name' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
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
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);
      (mockPrisma.user.update as jest.Mock).mockResolvedValue(softDeletedUser as any);

      const result = await userRepository.softDeleteUser('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
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
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser as any);
      (mockPrisma.user.delete as jest.Mock).mockResolvedValue(mockUser as any);

      await userRepository.hardDeleteUser('user-1');
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });

  describe('getUserCampaigns', () => {
    it('should return campaigns for a user', async () => {
      const userWithCampaigns = { ...mockUser, campaigns: [{ id: 'campaign-1' }] };
      // Mock the internal getUserById call
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser as any);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(userWithCampaigns as any);

      const result = await userRepository.getUserCampaigns('user-1');

      expect(result).toEqual([{ id: 'campaign-1' }]);
    });
  });
  
  describe('getUserCount', () => {
    it('should return the count of non-deleted users', async () => {
      (mockPrisma.user.count as jest.Mock).mockResolvedValue(5);
      const result = await userRepository.getUserCount();

      expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
      expect(result).toBe(5);
    });
  });

  describe('transaction', () => {
    it('should execute a function within a transaction', async () => {
      const fn = jest.fn().mockResolvedValue('transaction result');
      (mockPrisma.$transaction as jest.Mock).mockImplementation(callback => callback(mockPrisma));

      const result = await userRepository.transaction(fn);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(fn).toHaveBeenCalledWith(mockPrisma);
      expect(result).toBe('transaction result');
    });
  });


});
