import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../core/database/prisma.service";
import { 
  Campaign, 
  CampaignStatus,
  Task,
  TaskStatus,
  VALID_TRANSITIONS,
} from "../../../common/types/database/entity.types";
import { 
  CampaignNotFoundException, 
  InvalidStatusTransitionException,
  UserNotFoundException 
} from "../../../common/exceptions/database.exceptions";
import {
  CreateCampaignData,
  UpdateCampaignData,
  UpdateTaskData,
  ListCampaignsOptions,
  ListTasksOptions,
  ListTasksByCampaignWithOptions,
  PaginatedCampaignsResponse,
  PaginatedTasksResponse,
  AggregateCampaignResultData,
} from "../types/campaign.types";
import { CampaignMapper } from "../domains/campaign.mapper";


@Injectable()
export class CampaignRepository {
  private readonly logger = new Logger(CampaignRepository.name);

  constructor(private prisma: PrismaService) {}

  // ==================== Campaign CRUD ====================

  /**
   * Creates a new marketing campaign and optionally creates 
   */
  public async createCampaign(data: CreateCampaignData): Promise<Campaign> {
    try {
      // Valid user exists
      const userExists = await this.prisma.user.findUnique({
        where: {id: data.userId},
        select: {id: true},
      });

      if (!userExists) {
        throw new UserNotFoundException(data.userId);
      }

      // Simple creation without tasks
      const newCampaign = await this.prisma.campaign.create({
        data: {
          userId: data.userId,
          name: data.name,
          description: data.description,
          status: data.status ?? CampaignStatus.DRAFT,
          input: data.input as unknown as Prisma.JsonObject,
        },
      });

      // Map to domain model
      const domainCampaign = CampaignMapper.mapPrismaCampaignToDomainCampaign(
        newCampaign as any
      );
      this.logger.log(`Campaign created: ${newCampaign.id}`);

      if (!domainCampaign) {
        throw new Error("Failed to map campaign to domain model");
      }

      return domainCampaign;
    } catch (error) {
      throw this.prisma.handlePrismaError(
        error,
        `Failed to create campaign for user ${data.userId}`
      );
    }
  }

  /**
   * Updates a campaign with the provided data.
   */
  public async updateCampaign(
    campaignId: string,
    data: UpdateCampaignData,
    includeTasks: boolean = false,
    includeUser: boolean = false
  ): Promise<Campaign> {
    try {
      // Verify campaign exists before attempting to update
      const campaignExists = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id:true, status: true },
      });

      if (!campaignExists) {
        throw new CampaignNotFoundException(campaignId);
      }

      // Only validate if the status is actually different and being updated
      const currentStatus = campaignExists.status as CampaignStatus;
      if (
        data.status !== undefined &&
        data.status !== currentStatus &&
        !VALID_TRANSITIONS[currentStatus]?.includes(data.status)
      ) {
        throw new InvalidStatusTransitionException(currentStatus, data.status);
      }

      // Prepare update data
      const updateData: Prisma.CampaignUpdateInput = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) {
        updateData.description = data.description === null 
        ? null
        : data.description;
      }
      if (data.status !== undefined) updateData.status = data.status;
      if (data.input !== undefined) {
        updateData.input = data.input as unknown as Prisma.JsonObject;
      }
      if (data.result !== undefined) {
        updateData.result = data.result === null 
          ? Prisma.JsonNull 
          : data.result as unknown as Prisma.JsonObject;
      }

      // Update campaign with optional relations
      const updatedCampaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: updateData,
        include: {
          tasks: includeTasks,
          user: includeUser,
        },
      });

      // Map to domain model
      const domainCampaign = CampaignMapper.mapPrismaCampaignToDomainCampaign(
        updatedCampaign as any
      );
      if (!domainCampaign) {
        throw new Error("Failed to map campaign to domain model");
      }

      return domainCampaign;
    } catch (error) {
      throw this.prisma.handlePrismaError(
        error,
        `Failed to update campaign with ID: ${campaignId}`
      );
    }
  }

  /**
   * Deletes a campaign with the provided campaignId
   */
  public async deleteCampaignWithTasks(campaignId: string): Promise<Campaign> {
    try {
      // Check if campaign exists
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { tasks: true }
      });

      if (!campaign) {
        throw new CampaignNotFoundException(campaignId);
      }

      // Use transcation to ensure atomic deletion
      await this.prisma.$transaction(async (tx) => {
        // Delete all associated tasks
        await tx.task.deleteMany({
          where: { campaignId }
        });

        // Delete the campaign
        await tx.campaign.delete({
          where: { id: campaignId }
        })
      });
      this.logger.log(`Campaign ${campaignId} and ${campaign.tasks.length} tasks deleted`);

      return CampaignMapper.mapPrismaCampaignToDomainCampaign(campaign) as Campaign;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to delete campaign: ${campaignId}`);
    }    
  }

  /**
   * Soft delete a campaign (mark as archived)
   */
  public async softDeleteCampaign(campaignId: string): Promise<Campaign> {
    return this.updateCampaign(campaignId, {
      status: CampaignStatus.ARCHIVED,
    });
  }

  /**
   * Retrieves a single campaign's basic information by its ID.
   */
  public async findCampaignById(
    campaignId: string,
    includeTasks: boolean = false,
    includeUser: boolean = false
  ): Promise<Campaign> {
    try {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          tasks: includeTasks, 
          user: includeUser
        }
      });

      if (!campaign) {
        throw new CampaignNotFoundException(campaignId);
      }

      // call the mapping function directly without any type casting
      return CampaignMapper.mapPrismaCampaignToDomainCampaign(campaign) as Campaign;
    } catch (error) {
      throw this.prisma.handlePrismaError(
        error, 
        `Failed to get campaign with ID: ${campaignId}`
      );
    }
  }

  /**
   * Gets tasks for a campaign
   */
  public async findManyTasksByCampaignWithOptions(
    campaignId: string,
    options: Omit<ListTasksByCampaignWithOptions, "campaignId">
  ): Promise<PaginatedTasksResponse> {
    try {
      // Extract and validate pagination parameters
      const skip = Math.max(0, options.skip ?? 0);
      const take = Math.min(100, Math.max(1, options.take ?? 20));
    
      // Build where clause
      const  whereClause: Prisma.TaskWhereInput = { campaignId };
      if (options.where) {
        if (options.where.statusIn && options.where.statusIn.length > 0) {
          whereClause.status = { in: options.where.statusIn };
          if (options.where.status) {
            this.logger.warn(
              `Both status and statusIn provided for campaign ${campaignId}. ` +
              `statusIn takes precedence.`
            );
          }
        } else if (options.where.status) {
          whereClause.status = options.where.status;
        }
        if (options.where.priority) whereClause.priority = options.where.priority;
        if (options.where.priorityRange) {
          whereClause.priority = {
            ...(options.where.priorityRange.gte !== undefined && { gte: options.where.priorityRange.gte }),
            ...(options.where.priorityRange.lte !== undefined && { lte: options.where.priorityRange.lte }),
          };
        }
        if (options.where.hasResult !== undefined) {
          whereClause.result = options.where.hasResult 
            ? { not: Prisma.JsonNull } 
            : { equals: Prisma.JsonNull };
        }
      }

      const orderByField = options.orderBy?.field ?? "createdAt";
      const orderByDirection = options.orderBy?.direction ?? "desc";
      const orderByOptions = { [orderByField]: orderByDirection}

      // Execute queries in parallel
      const [tasks, totalCount] = await Promise.all([
        this.prisma.task.findMany({
          skip,
          take,
          where: whereClause,
          orderBy: orderByOptions,
        }),
        this.prisma.task.count({ where: whereClause }),
      ]);

      // Create a mapped task list
      const mappedTasks = CampaignMapper.mapPrismaTasksToDomainTasks(tasks as any);

      // Calculate pagination metadata
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / take) : 0;
      const currentPage = totalCount > 0 ? Math.floor(skip / take) + 1 : 1;
      const hasMore = skip + take < totalCount;
      
      return {
        data: mappedTasks,
        pagination: {
          total: totalCount,
          skip,
          take,
          hasMore,
          totalPages,
          currentPage,
        },
      } 
    } catch (error) {
      throw this.prisma.handlePrismaError(error, "Failed to list tasks with options");
    }
  }

  /**
   * Retrieves a paginated list of tasks across multiple campaigns
   * Useful for global task management and user task overview
   */
  public async findManyTasksByUserWithOptions(
    userId: string,
    options: ListTasksOptions = {}
  ): Promise<PaginatedTasksResponse> {
    try {
      // 
      const skip = Math.max(0, options.skip ?? 0);
      const take = Math.min(100, Math.max(1, options.take ?? 20));

      // Build where clause and filter by user through campaign relation
      const whereClause: Prisma.TaskWhereInput = {};
      whereClause.campaign = { userId: userId };
      if (options.where) {
        // Campaign filters
        // Single campaign: must belong to userId
        if (options.where.campaignId) {
          whereClause.campaignId = options.where.campaignId;
        } else if (options.where.campaignIds && options.where.campaignIds.length > 0) {
          // Multiple campaigns: all must belong to userId
          whereClause.campaignId = { in: options.where.campaignIds };
        }
        
        // Task status filters
        if (options.where.statusIn && options.where.statusIn.length > 0) {
          whereClause.status = { in: options.where.statusIn };
          if (options.where.status) {
            this.logger.warn(
              `Both status and statusIn provided for user ${userId}. ` +
              `statusIn takes precedence.`
            );
          }
        } else if (options.where.status) {
          whereClause.status = options.where.status;
        }
        // Priority filters
        if (options.where.priority !== undefined) whereClause.priority = options.where.priority;
        if (options.where.priorityRange) {
          whereClause.priority = {
            ...(options.where.priorityRange.gte !== undefined && { gte: options.where.priorityRange.gte }),
            ...(options.where.priorityRange.lte !== undefined && { lte: options.where.priorityRange.lte }),
          };
        }

        // Result filter
        if (options.where.hasResult !== undefined) {
          whereClause.result = options.where.hasResult
            ? { not: Prisma.JsonNull }
            : { equals: Prisma.JsonNull };
        }

        // Date range filters
        if (options.where.createdAt) {
          whereClause.createdAt = {
            ...(options.where.createdAt.gte && { gte: options.where.createdAt.gte }),
            ...(options.where.createdAt.lte && { lte: options.where.createdAt.lte }),
          };
        }
        if (options.where.updatedAt) {
          whereClause.updatedAt = {
            ...(options.where.updatedAt.gte && { gte: options.where.updatedAt.gte }),
            ...(options.where.updatedAt.lte && { lte: options.where.updatedAt.lte }),
          };
        }
      }

      // Build order by clause
      const orderByField = options.orderBy?.field ?? "createdAt";
      const orderByDirection = options.orderBy?.direction ?? "desc";
      const orderByClause = { [orderByField]: orderByDirection };

      // Execute queries in parallel
      const [tasks, totalCount] = await Promise.all([
        this.prisma.task.findMany({
          skip,
          take,
          where: whereClause,
          orderBy: orderByClause,
          include: {
            campaign: true, // Include campaign info for context
          },
        }),
        this.prisma.task.count({ where: whereClause }),
      ]);

      // Map to domain tasks
      const mappedTasks = CampaignMapper.mapPrismaTasksToDomainTasks(tasks as any);

      // Calculate pagination metadata
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / take) : 0;
      const currentPage = totalCount > 0 ? Math.floor(skip / take) + 1 : 1;
      const hasMore = skip + take < totalCount;

      return {
        data: mappedTasks,
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
      throw this.prisma.handlePrismaError(
        error,
        "Failed to list tasks with options"
      );
    } 

  }

  /**
   * Retrieves a paginated list of campaigns with flexible filtering, sorting, and relations.
   */
  public async findManyCampaignsByOptions(
    options: ListCampaignsOptions = {}
  ): Promise<PaginatedCampaignsResponse> {
    try {
      // Extract and validate pagination parameters
      const skip = Math.max(0, options.skip ?? 0);
      const take = Math.min(100, Math.max(1, options.take ?? 20));

      // Build query clauses
      const whereClause = this.buildWhereClause(options.where);
      const orderByClause = this.buildOrderByClause(options.orderBy);
      const includeClause = this.buildIncludeClause(options.include);

      // Execute queries in parallel for better performance
      const [campaigns, totalCount] = await Promise.all([
        this.prisma.campaign.findMany({
          skip,
          take,
          where: whereClause,
          include: includeClause,
          orderBy: orderByClause,
        }),
        this.prisma.campaign.count({ where: whereClause }),
      ]);

      // Map Prisma campaigns to domain campaigns
      const mappedCampaigns = CampaignMapper.mapPrismaCampaignsToDomainCampaigns(
        campaigns
      );

      // Calculate pagination metadata
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / take) : 0;
      const currentPage = totalCount > 0 ? Math.floor(skip / take) + 1 : 1;
      const hasMore = skip + take < totalCount;

      return {
        data: mappedCampaigns,
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
      throw this.prisma.handlePrismaError(
        error,
        "Failed to list campaigns with options"
      );
    }
  }

  // ==================== Task Operations (Internal) ====================
  
  /**
   * Updates a task
   */
  public async updateTask(taskId: string, data: UpdateTaskData): Promise<Task> {
    try {
      const updateData: Prisma.TaskUpdateInput = {};

      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.result !== undefined) {
        updateData.result = data.result === null
          ? Prisma.JsonNull
          : data.result as unknown as Prisma.JsonObject;
      }

      if (Object.keys(updateData).length === 0) {
        this.logger.warn(`Attempted to update task ${taskId} with empty data. No action taken.`)
        const task = await this.prisma.task.findUnique({ 
          where: { id: taskId },
        });
        if (!task) {
          throw new Error(`Task with ID ${taskId} not found`);
        }
        return CampaignMapper.mapPrismaTaskToDomainTask(task as any) as Task;
      }

      const updatedTask = await this.prisma.task.update({
        where: { id: taskId },
        data: updateData,
      });
      return CampaignMapper.mapPrismaTaskToDomainTask(updatedTask as any) as Task;

    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to update task: ${taskId}`);    }
  }

  // ==================== Aggregate Operations ====================
  public async aggregateCampaignResult(
    data: AggregateCampaignResultData
  ): Promise<Campaign> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Verifiy campaign exists
        const campaign = await tx.campaign.findUnique({
          where: { id: data.campaignId },
          select: { id: true, status: true }
        });

        if (!campaign) {
          throw new CampaignNotFoundException(data.campaignId);
        }

        // Update campaign with results ans status
        await tx.campaign.update({
          where: { id: data.campaignId },
          data: {
            result: data.result as unknown as Prisma.JsonObject,
            status: CampaignStatus.COMPLETED,
          }
        });

        // Batch create tasks
        if (data.tasks.length > 0) {
          await tx.task.createMany({
            data: data.tasks.map((task, index) => ({
              campaignId: data.campaignId,
              priority: task.priority ?? index + 1,
              status: task.result.status === 'success' ? TaskStatus.SUCCESS : TaskStatus.FAILED,
              result: task.result as unknown as Prisma.JsonObject
            })),
          });
        }
        // Fetch and return campaign with tasks
        return tx.campaign.findUnique({
          where: { id: data.campaignId },
          include: { tasks: true },
        });
      });

      if (!result) {
        throw new CampaignNotFoundException(data.campaignId);
      }
      this.logger.log(`Campaign ${data.campaignId} completed with ${data.tasks.length} tasks`);
      return CampaignMapper.mapPrismaCampaignToDomainCampaign(result) as Campaign;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to save campaign result: ${data.campaignId}`);
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * Helper methods for building query clauses
   */
  private buildWhereClause(
    where: ListCampaignsOptions["where"] = {}
  ): Prisma.CampaignWhereInput {

    const whereClause: Prisma.CampaignWhereInput = {};

    // Basic filters
    if (where?.userId) whereClause.userId = where.userId;
    if (where?.statusIn && where.statusIn.length > 0) {
      whereClause.status = { in: where.statusIn };
      if (where?.status) {
        this.logger.warn(
          `Both status and statusIn provided. statusIn takes precedence. ` +
          `status=${where.status} ignored.`
        );
      }
    } else if (where?.status) {
      whereClause.status = where.status;
    }

    // Name filters
    if (where?.name || where?.nameContains) {
      const nameConditions: Prisma.StringFilter[] = [];
      if (where?.name) {
        nameConditions.push({ equals: where.name.trim() });
      }
      if (where?.nameContains) {
        nameConditions.push({ contains: where.nameContains.trim() });
      }
      // If both conditions exist, require both (AND logic)
      if (nameConditions.length === 2) {
        whereClause.AND = [
          { name: nameConditions[0] },
          { name: nameConditions[1] },
        ];
      } else {
        whereClause.name = nameConditions[0];
      }
    }

    // Description filters
    if (where?.descriptionContains) {
      whereClause.description = { contains: where.descriptionContains.trim() };
    } else if (where?.hasDescription !== undefined) {
      whereClause.description = where.hasDescription ? { not: null } : null;
    }

    // Date range filters
    if (where?.createdAt) {
      whereClause.createdAt = {
        ...(where.createdAt.gte && { gte: where.createdAt.gte }),
        ...(where.createdAt.lte && { lte: where.createdAt.lte }),
      };
    }
    if (where?.updatedAt) {
      whereClause.updatedAt = {
        ...(where.updatedAt.gte && { gte: where.updatedAt.gte }),
        ...(where.updatedAt.lte && { lte: where.updatedAt.lte }),
      };
    }
    
    // Tasks filter
    if (where?.hasTasks !== undefined) {
      whereClause.tasks = where.hasTasks ? { some: {} } : { none: {} };
    }

    if (where?.hasResult !== undefined) {
      whereClause.result = where.hasResult 
        ? { not: Prisma.JsonNull } 
        : { equals: Prisma.JsonNull };
    }
    
    // Soft delete filter
    if (where?.isDeleted !== undefined) {
      whereClause.deletedAt = where.isDeleted ? { not: null } : null;
    }
    return whereClause;
  }

  private buildOrderByClause(
    orderBy: ListCampaignsOptions["orderBy"]
  ): Prisma.CampaignOrderByWithRelationInput {
    const orderByField = orderBy?.field ?? "createdAt";
    const orderByDirection = orderBy?.direction ?? "desc";
    return { [orderByField]: orderByDirection };
  }

  private buildIncludeClause(
    includeOptions: ListCampaignsOptions["include"]
  ): Prisma.CampaignInclude | undefined {
    if (!includeOptions) return undefined;

    const include: Prisma.CampaignInclude = {};

      // Handle user inclusion
    if (includeOptions.user) {
      include.user = typeof includeOptions.user === "boolean" 
        ? true 
        : { select: includeOptions.user.select };
    }

    // Handle tasks inclusion with nested options
    if (includeOptions.tasks) {
      if (typeof includeOptions.tasks === "boolean") {
        include.tasks = true;
      } else {
        const tasksInclude: any = {};

        // Select specific fields
        // If select is provided, only use select
        if (includeOptions.tasks.select) {
          tasksInclude.select = includeOptions.tasks.select;
        } else {
          // Filter tasks
          if (includeOptions.tasks.where) {
            const taskWhere: Prisma.TaskWhereInput = {};
            const tw = includeOptions.tasks.where;
            
            if (tw.status) taskWhere.status = tw.status;
            if (tw.statusIn) taskWhere.status = { in: tw.statusIn };
            if (tw.priority) taskWhere.priority = tw.priority;
            if (tw.priorityRange) {
              taskWhere.priority = {
                ...(tw.priorityRange.gte !== undefined && { gte: tw.priorityRange.gte }),
                ...(tw.priorityRange.lte !== undefined && { lte: tw.priorityRange.lte }),
              };
            }
            if (tw.hasResult !== undefined) {
              taskWhere.result = tw.hasResult 
                ? { not: Prisma.JsonNull } 
                : { equals: Prisma.JsonNull };
            }
            tasksInclude.where = taskWhere;
          }
        }

        // Order tasks
        if (includeOptions.tasks.orderBy) {
          const taskOrderByField = includeOptions.tasks.orderBy.field ?? "createdAt";
          const taskOrderByDirection = includeOptions.tasks.orderBy.direction ?? "desc";
          tasksInclude.orderBy = { [taskOrderByField]: taskOrderByDirection };
        }
        
        // Paginate tasks
        if (includeOptions.tasks.skip !== undefined) { tasksInclude.skip = includeOptions.tasks.skip; }
        if (includeOptions.tasks.take !== undefined) { tasksInclude.take = includeOptions.tasks.take; }
        
        include.tasks = tasksInclude;
      }
    }
    return Object.keys(include).length > 0 ? include : undefined;
  }
};

