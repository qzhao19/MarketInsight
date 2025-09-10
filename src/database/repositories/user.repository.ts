import { Injectable } from '@nestjs/common';
import { User } from '../../types/domain.types';
import { PrismaService } from '../prisma/prisma.service';
import { UserAlreadyExistsException, UserNotFoundException } from '../../common/exceptions';

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
@Injectable() 
export class UserRepository {

  /**
   * Initializes the service with a PrismaService
   */
  constructor(private prisma: PrismaService) {}

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
  public async createUser(data: CreateUserData): Promise<User> {
      try {
        const exists = await this.prisma.user.findUnique({ 
          where: { email: data.email } 
        });
        if (exists) throw new UserAlreadyExistsException(data.email);

        const user = await this.prisma.user.create({ 
          data: {
            ...data,
            deletedAt: null // ensure the user starts as not deleted
          } 
        });
        return user as User;
      } catch (error) {
        throw this.prisma.handlePrismaError(error, `Failed to create user: ${data.email}`);
      }
  }

  /**
   * Finds a user by their ID
   * @param id - The user's unique ID
   * @returns The found user
   * @throws UserNotFoundException if no user with the ID exists
   */
  public async findUserById(id: string): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({ 
        where: { id, deletedAt: null } // Only find non-deleted users
      });
      
      if (!user) throw new UserNotFoundException(id);
      return user as User;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to find user by ID: ${id}`);
    }
  }

  /**
   * Finds a user by their email address
   * @param email - The user's email address
   * @returns The found user or null if not found
   */
  public async findUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({ 
        where: { email, deletedAt: null } // Only find non-deleted users
      });
      return user as User | null;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to find user by email: ${email}`);
    }
  }

  /**
   * Updates a user's information
   * @param id - The user's unique ID
   * @param data - Object with fields to update
   * @returns The updated user
   * @throws UserNotFoundException if no user with the ID exists
   */
  public async updateUser(id: string, data: UpdateUserData): Promise<User> {
    try {
      const user = await this.prisma.user.update({ 
        where: { id, deletedAt: null }, 
        data 
      });
      return user as User;
    } catch (error) {
      // if the user doesn't exist, Prisma throws P2025
      throw this.prisma.handlePrismaError(error, `Failed to update user: ${id}`);
    }
  }

  /**
   * Soft deletes a user by marking them as deleted without removing from database
   * @param id - The user's unique ID
   * @returns The updated user with deletedAt timestamp
   */
  public async softDeleteUser(id: string): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          email: this.generateDeletedEmail(id),
        },
      });
      return user as User;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to soft delete user: ${id}`);
    }
  }

  /**
   * Permanently deletes a user from the database
   * @param id - The user's unique ID
   * @returns The deleted user
   */
  public async hardDeleteUser(id: string): Promise<User> {
    try {
      const user = await this.prisma.user.delete({ where: { id } });
      return user as User;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to hard delete user: ${id}`);
    }
  }

  /**
   * Lists users with pagination
   * @param options - Pagination and include options
   * @returns Array of users matching criteria
   */
  public async findManyUsersByOptions(options: ListUsersOptions = {}): Promise<User[]> {
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
      throw this.prisma.handlePrismaError(error, 'Failed to list users');
    }
  }

  /**
   * Gets the total count of non-deleted users
   * @returns The count of users
   */
  public async findUserCount(): Promise<number> {
    try {
      return await this.prisma.user.count({ where: { deletedAt: null } });
    } catch (error) {
      throw this.prisma.handlePrismaError(error, 'Failed to find user count');
    }
  }
}

