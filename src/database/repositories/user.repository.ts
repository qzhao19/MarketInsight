import { User as PrismaUser } from '@prisma/client';
import { Injectable } from "@nestjs/common";
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
import { SafeUser } from '../../types/database/repository.types';

// User lookup criteria types
type UserQueryById = { id: string };
type UserQueryByEmail = { email: string };
type UserQueryByUsername = { username: string };
type UserQueryCriteria = UserQueryById | UserQueryByEmail | UserQueryByUsername;

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
   */
  private generateDeletedEmail(id: string): string {
      return `deleted_${id}_${Date.now()}@deleted.local`;
  }

  /**
   * Generates a unique username for deleted users
   */
  private generateDeletedUsername(id: string): string {
      return `deleted_${id}_${Date.now()}`;
  }

  /**
   * Removes password field from user object
   */
  private excludePassword(user: PrismaUser): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }


  /**
   * Removes password field from array of user objects
   */
  private excludePasswordFromUsers(users: PrismaUser[]): SafeUser[] {
    return users.map(user => this.excludePassword(user));
  }
  
  /**
   * Creates a new user
   */
  public async createUser(data: CreateUserData): Promise<SafeUser> {
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
          `User with email "${data.email}" already exists`, "email"
        );
      }
      
      // Check username uniqueness
      if (existsByUsername) {
        throw new UserAlreadyExistsException(
          `User with username "${data.username}" already exists`, "username"
        );
      }

      const user = await this.prisma.user.create({ 
        data: { ...data, deletedAt: null } 
      });
      //  Remove password before returning
      return this.excludePassword(user);
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to create user: ${data.email}`);
    }
  }

  /**
   * Gets a human-readable identifier from user criteria
   */
  private extractQueryIdentifier(criteria: UserQueryCriteria): string {
    if ("id" in criteria) return criteria.id;
    if ("email" in criteria) return criteria.email;
    if ("username" in criteria) return criteria.username;
    return "unknown"
  }

  /**
   * Internal method to find a user by various criteria
   */
  private async findUserByCriteria(
    criteria: UserQueryCriteria,
    includePassword: boolean = false
  ): Promise<PrismaUser | SafeUser> {
    try {
      // Prisma's findUnique only accepts unique fields
      const user: PrismaUser | null = await this.prisma.user.findUnique({ 
        where: criteria 
      });

      // Only return non-deleted users
      if (!user || user.deletedAt !== null) {
        const identifier = this.extractQueryIdentifier(criteria);
        throw new UserNotFoundException(identifier);
      }

      // Return user with or without password based on flag
      return includePassword ? user : this.excludePassword(user);
    } catch (error) {
      const identifier = this.extractQueryIdentifier(criteria);
      throw this.prisma.handlePrismaError(
        error, 
        `Failed to find user: ${identifier}`
      );
    }
  }

  /**
   * Finds a user by their ID
   */
  public async findUserById(id: string): Promise<SafeUser> {
    return this.findUserByCriteria({ id }) as Promise<SafeUser>;
  }

  /**
   * Finds a user by their username
   */
  public async findUserByUsername(username: string): Promise<SafeUser> {
    return this.findUserByCriteria({ username }) as Promise<SafeUser>;
  }

  /**
   * Finds a user by their email address
   */
  public async findUserByEmail(email: string): Promise<SafeUser> {
    return this.findUserByCriteria({ email }) as Promise<SafeUser>;
  }

  /**
   * Finds a user by ID and returns WITH password (for authentication)
   */
  public async findUserByIdWithPassword(id: string): Promise<PrismaUser> {
    return this.findUserByCriteria({ id }, true) as Promise<PrismaUser>;
  }

  /**
   * Finds a user by email and returns WITH password (for authentication)
   */
  public async findUserByEmailWithPassword(email: string): Promise<PrismaUser> {
    return this.findUserByCriteria({ email }, true) as Promise<PrismaUser>;
  }

  /**
   * Finds a user by username and returns WITH password (for authentication)
   */
  public async findUserByUsernameWithPassword(username: string): Promise<PrismaUser> {
    return this.findUserByCriteria({ username }, true) as Promise<PrismaUser>;
  }

  /**
   * Updates a user's information
   */
  public async updateUser(id: string, data: UpdateUserData): Promise<SafeUser> {
    try {
      // Verify the user exists and is not soft-delete 
      await this.findUserById(id);

      // Parallel checks
      const checks: Promise<any>[] = [];
      
      // If username is being updated, and only check active user
      if (data.username) {
        checks.push(
          this.prisma.user.findFirst({
            where: { username: data.username, deletedAt: null, id: { not: id } },
            select: { id: true }
          }).then(user => ({ field: 'username', user, value: data.username }))
        );
      }

      // If email is being updated
      if (data.email) {
        checks.push(
          this.prisma.user.findFirst({
            where: { email: data.email, deletedAt: null, id: { not: id } },
            select: { id: true }
          }).then(user => ({ field: 'email', user, value: data.email }))
        );
      }

      // Execute all checks in parallel
      if (checks.length > 0) {
        const results = await Promise.all(checks);
        for (const { field, user, value } of results) {
          if (user) {
            throw new UserAlreadyExistsException(
              `${field.charAt(0).toUpperCase() + field.slice(1)} "${value}" is already taken`,
              field
            );
          }
        }
      }

      // Update the user (only with provided fields)
      const updatedUser: PrismaUser = await this.prisma.user.update({ 
        where: { id }, data 
      });
      
      // Remove password before returning
      return this.excludePassword(updatedUser);
    } catch (error) {
      // if the user doesn't exist, Prisma throws P2025
      throw this.prisma.handlePrismaError(error, `Failed to update user: ${id}`);
    }
  }

  /**
   * Soft deletes a user by marking them as deleted without removing from database
   */
  public async softDeleteUser(id: string): Promise<SafeUser> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          email: this.generateDeletedEmail(id),
          username: this.generateDeletedUsername(id),
        },
      });
      return this.excludePassword(user);
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to soft delete user: ${id}`);
    }
  }

  /**
   * Permanently deletes a user from the database
   */
  public async hardDeleteUser(id: string): Promise<SafeUser> {
    try {
      const user = await this.prisma.user.delete({ where: { id } });
      return this.excludePassword(user);
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to hard delete user: ${id}`);
    }
  }

  /**
   * Lists users with pagination and include options
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

          // Build campaign where clause, exclude deleted
          const campaignWhere: any = { deletedAt: null }

          // Add campaign status filter if specified
          if (campaignConfig.where?.status) {
            campaignWhere.status = campaignConfig.where?.status
          }

          include.campaigns = {
            take: Math.min(50, campaignConfig.take ?? 10),
            orderBy: { [campaignConfig.orderBy ?? 'createdAt']: 'desc' },
            where: campaignWhere,
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
        }) as Promise<PrismaUser[]>,
        this.prisma.user.count({ where: whereClause }),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / take);
      const currentPage = Math.floor(skip / take) + 1;
      const hasMore = skip + take < totalCount;

      // Return paginated response
      return {
        data: this.excludePasswordFromUsers(users),
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
   */
  public async findUserCount(): Promise<number> {
    try {
      return await this.prisma.user.count({ where: { deletedAt: null } });
    } catch (error) {
      throw this.prisma.handlePrismaError(error, "Failed to find user count");
    }
  }
}

