import { Injectable } from "@nestjs/common";
import { User } from "../../types/database.types";
import { PrismaService } from "../prisma/prisma.service";
import { 
  UserAlreadyExistsException, 
  UserNotFoundException,
} from "../../common/exceptions/database.exceptions";
import {
  CreateUserData,
  UpdateUserData,
  ListUsersOptions,
  PaginatedUsersResponse,
} from "../../types/database/user.types"

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
   * @private
   */
  private generateDeletedEmail(id: string): string {
      return `deleted_${id}_${Date.now()}@deleted.local`;
  }

  /**
   * Generates a unique username for deleted users
   * @private
   */
  private generateDeletedUsername(id: string): string {
      return `deleted_${id}_${Date.now()}`;
  }

  /**
   * Creates a new user
   * @param data - User data including email, name, and password
   * @returns The created user
   * @throws UserAlreadyExistsException if a user with the email already exists
   */
  public async createUser(data: CreateUserData): Promise<User> {
      try {
        const [existsByEmail, existsByUsername] = await Promise.all([
          // Only check active users
          this.prisma.user.findFirst({ 
            where: { email: data.email, deletedAt: null },
            select: { id: true }
          }),
          this.prisma.user.findFirst({ 
            where: { username: data.username, deletedAt: null },
            select: { id: true }
          })
        ]);

        // Check email uniqueness
        if (existsByEmail) {
          throw new UserAlreadyExistsException(
            `User with email "${data.email}" already exists`,
            "email"
          );
        }
        
        // Check username uniqueness
        if (existsByUsername) {
          throw new UserAlreadyExistsException(
            `User with username "${data.username}" already exists`,
            "username"
          );
        }

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
      // findUnique only accepts unique fields (id, email, username)
      const user = await this.prisma.user.findUnique({ 
        where: { id } 
      });
      
      // Only find non-deleted users
      if (!user || user.deletedAt !== null) {
        throw new UserNotFoundException(id);
      }
      return user as User;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to find user by ID: ${id}`);
    }
  }

  /**
   * Finds a user by their username
   * @param id - The user's unique username
   * @returns The found user
   * @throws UserNotFoundException if no user with the username exists
   */
  public async findUserByUsername(username: string): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({ 
        where: { username } 
      });
      
      // Only find non-deleted users
      if (!user || user.deletedAt !== null) {
        throw new UserNotFoundException(username);
      }

      return user as User;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to find user by username: ${username}`);
    }
  }


  /**
   * Finds a user by their email address
   * @param email - The user's email address
   * @returns The found user or null if not found
   */
  public async findUserByEmail(email: string): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({ 
        where: { email } 
      });

      // Only find non-deleted users
      if (!user || user.deletedAt !== null) {
        throw new UserNotFoundException(email);
      }
      
      return user as User;
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
      // Verify the user exists and is not soft-delete 
      const currentUser = await this.findUserById(id);

      if (data.username && data.username !== currentUser.username) {
        const existingUser = await this.prisma.user.findUnique({
          where: { username: data.username },
          select: { id: true }
        });

        // Check if username is taken by another active user
        if (existingUser && existingUser.id !== id) {
          throw new UserAlreadyExistsException(
            `Username "${data.username}" is already taken`,
            "username"
          );
        }
      }

      // Update the user (only with provided fields)
      const updatedUser = await this.prisma.user.update({ 
        where: { id }, 
        data 
      });
      return updatedUser as User;

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
          username: this.generateDeletedUsername(id),
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
  public async findManyUsersByOptions(
    options: ListUsersOptions = {}
  ): Promise<PaginatedUsersResponse> {
    try {
      // Extract and validate pagination parameters
      const skip = Math.max(0, options.skip ?? 0); // Ensure non-negative
      const take = Math.min(100, Math.max(1, options.take ?? 20)); // Clamp between 1-100

      // Build where clause with filters
      // By default, exclude soft-deleted users unless explicitly included
      const whereClause: any = {
        deletedAt: options.where?.includeDeleted ? undefined : null,
      };

      // Add exact match filters
      if (options.where?.email) {
        whereClause.email = options.where.email;
      }

      if (options.where?.username) {
        whereClause.username = options.where.username;
      }

      // Add search filter (case-insensitive search in email or username)
      if (options.where?.searchTerm) {
        whereClause.OR = [
          { email: { contains: options.where.searchTerm, mode: "insensitive" } },
          { username: { contains: options.where.searchTerm, mode: "insensitive" } },
        ];
      }

      // Build orderBy clause
      const orderByField = options.orderBy?.field ?? 'createdAt';
      const orderByDirection = options.orderBy?.direction ?? 'desc';
      const orderBy = { [orderByField]: orderByDirection };

      // Build include clause for relations 
      const include: any = {};
      if (options.include?.campaigns) {
        if (typeof options.include.campaigns === 'boolean') {
          include.campaigns = options.include.campaigns;
        } else {
          // campaigns with filters
          const campaignConfig = options.include.campaigns;
          include.campaigns = {
            take: Math.min(50, campaignConfig.take ?? 10), // Limit to 50
            orderBy: { [campaignConfig.orderBy ?? 'createdAt']: 'desc' },
          };

          // Add campaign status filter if specified
          if (campaignConfig.where?.status) {
            include.campaigns.where = { status: campaignConfig.where?.status };
          }
        }
      }

      //  Execute queries in parallel for better performance
      const [users, totalCount] = await Promise.all([
        this.prisma.user.findMany({
          skip,
          take,
          where: whereClause,
          include: Object.keys(include).length > 0 ? include : undefined,
          orderBy,
        }),
        this.prisma.user.count({ where: whereClause }),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / take);
      const currentPage = Math.floor(skip / take) + 1;
      const hasMore = skip + take < totalCount;

      // Return paginated response
      return {
        data: users as User[],
        pagination: {
          total: totalCount,
          skip,
          take,
          hasMore,
          totalPages,
          currentPage,
        },
      };
    } catch (error) {
      throw this.prisma.handlePrismaError(error, "Failed to list users with options");
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
      throw this.prisma.handlePrismaError(error, "Failed to find user count");
    }
  }
}

