import { PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { User, MarketingCampaign } from '../../types/task.types';

const prisma = new PrismaClient();

// Custom exceptions
export class UserNotFoundException extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`);
    this.name = 'UserNotFoundException';
  }
}

export class UserAlreadyExistsException extends Error {
  constructor(email: string) {
    super(`User with email ${email} already exists`);
    this.name = 'UserAlreadyExistsException';
  }
}

// Define more specific types for method inputs to improve clarity and type safety.
type CreateUserData = {
    email: string;
    name?: string;
    password: string;
};
type UpdateUserData = Partial<Omit<CreateUserData, 'email'>> & { email?: string };
type ListUsersOptions = { skip?: number; take?: number; includeCampaigns?: boolean };

/**
 * User Repository - implements all database operations related to the User entity
 */
export class UserRepository {
  private prisma: PrismaClient;

  /**
   * Creates a new UserRepository instance
   * @param prismaClient - Optional Prisma client for dependency injection
   */
  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Centralized error handler for Prisma operations
   * @param error - The caught error
   * @param context - Description of the operation that failed
   */
  private handlePrismaError(error: unknown, context: string): never {
    console.error(`${context}:`, error);
    
    if (error instanceof UserNotFoundException || error instanceof UserAlreadyExistsException) {
      throw error; // Re-throw our custom exceptions without modification
    }
    
    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          throw new UserAlreadyExistsException(
            error.meta?.target ? String(error.meta.target) : 'unknown'
          );
        case 'P2025':
          throw new UserNotFoundException('unknown');
        default:
          throw new Error(`Database error (${error.code}): ${error.message}`);
      }
    }
    throw error instanceof Error ? error : new Error(`${context}: ${String(error)}`);
  }

  /**
   * Generates a unique email for deleted users to maintain the unique constraint
   * @param id - The user's unique ID
   * @returns A unique email string
   */
  private generateDeletedEmail(id: string): string {
      return `deleted_${id}_${Date.now()}@deleted.local`;
  }

  /**
   * Creates a new user
   * @param data - User data including email, name, and password
   * @returns The created user
   * @throws UserAlreadyExistsException if a user with the email already exists
   */
  async createUser(data: CreateUserData): Promise<User> {
      try {
        const exists = await this.prisma.user.findUnique({ where: { email: data.email } });
        if (exists) throw new UserAlreadyExistsException(data.email);

        const user = await this.prisma.user.create({ 
          data: {
            ...data,
            deletedAt: null // Ensure the user starts as not deleted
          } 
        });
        return user as User;
      } catch (error) {
        throw this.handlePrismaError(error, `Failed to create user: ${data.email}`);
      }
  }

  /**
   * Finds a user by their ID
   * @param id - The user's unique ID
   * @returns The found user
   * @throws UserNotFoundException if no user with the ID exists
   */
  async getUserById(id: string): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({ 
        where: { id, deletedAt: null } // Only find non-deleted users
      });
      
      if (!user) throw new UserNotFoundException(id);
      return user as User;
    } catch (error) {
      throw this.handlePrismaError(error, `Failed to get user by ID: ${id}`);
    }
  }

  /**
   * Finds a user by their email address
   * @param email - The user's email address
   * @returns The found user or null if not found
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({ 
        where: { email, deletedAt: null } // Only find non-deleted users
      });
      return user as User | null;
    } catch (error) {
      throw this.handlePrismaError(error, `Failed to get user by email: ${email}`);
    }
  }

  /**
   * Updates a user's information
   * @param id - The user's unique ID
   * @param data - Object with fields to update
   * @returns The updated user
   * @throws UserNotFoundException if no user with the ID exists
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    try {
      // Check if user exists first (will throw if not found)
      await this.getUserById(id);
      
      const user = await this.prisma.user.update({ 
        where: { id }, 
        data 
      });
      return user as User;
    } catch (error) {
      throw this.handlePrismaError(error, `Failed to update user: ${id}`);
    }
  }

  /**
   * Soft deletes a user by marking them as deleted without removing from database
   * @param id - The user's unique ID
   * @returns The updated user with deletedAt timestamp
   */
  async softDeleteUser(id: string): Promise<User> {
    try {
      // First check if the user exists
      await this.getUserById(id);
      
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          email: this.generateDeletedEmail(id),
        },
      });
      return user as User;
    } catch (error) {
      throw this.handlePrismaError(error, `Failed to soft delete user: ${id}`);
    }
  }

  /**
   * Permanently deletes a user from the database
   * @param id - The user's unique ID
   * @returns The deleted user
   */
  async hardDeleteUser(id: string): Promise<User> {
    try {
      // First check if the user exists (will throw if not found)
      await this.getUserById(id);
      
      const user = await this.prisma.user.delete({ where: { id } });
      return user as User;
    } catch (error) {
      throw this.handlePrismaError(error, `Failed to hard delete user: ${id}`);
    }
  }

  /**
   * Lists users with pagination
   * @param options - Pagination and include options
   * @returns Array of users matching criteria
   */
  async listUsers(options: ListUsersOptions = {}): Promise<User[]> {
    const { skip = 0, take = 20, includeCampaigns = false } = options;
    try {
      const users = await this.prisma.user.findMany({
        skip,
        take,
        where: { deletedAt: null },
        include: { campaigns: includeCampaigns },
        orderBy: { createdAt: 'desc' },
      });
      return users as User[];
    } catch (error) {
      throw this.handlePrismaError(error, 'Failed to list users');
    }
  }

  /**
   * Gets all marketing campaigns associated with a user
   * @param userId - The user's unique ID
   * @returns Array of marketing campaigns
   * @throws UserNotFoundException if no user with the ID exists
   */
  async getUserCampaigns(userId: string): Promise<MarketingCampaign[]> {
    try {
      // First check if the user exists (will throw if not found)
      await this.getUserById(userId);
      
      const userWithCampaigns = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { campaigns: { orderBy: { createdAt: 'desc' } } },
      });
      return (userWithCampaigns?.campaigns || []) as MarketingCampaign[];
    } catch (error) {
      throw this.handlePrismaError(error, `Failed to get campaigns for user: ${userId}`);
    }
  }

  /**
   * Gets the total count of non-deleted users
   * @returns The count of users
   */
  async getUserCount(): Promise<number> {
    try {
      return await this.prisma.user.count({ where: { deletedAt: null } });
    } catch (error) {
      throw this.handlePrismaError(error, 'Failed to get user count');
    }
  }

  /**
   * Execute operations within a transaction
   * @param fn - Function to execute inside transaction
   * @returns Result of the function
   */
  async transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return await fn(tx as unknown as PrismaClient);
    });
  }

  /**
   * Closes the Prisma connection
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }


}

