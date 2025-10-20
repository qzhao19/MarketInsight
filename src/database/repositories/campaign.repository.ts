import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { 
  Campaign, 
  CampaignStatus, 
  VALID_TRANSITIONS,
} from "../../types/database/entities.types";
import { 
  CampaignNotFoundException, 
  InvalidStatusTransitionException,
  UserNotFoundException 
} from "../../common/exceptions/database.exceptions";
import {
  CreateCampaignData,
  UpdateCampaignData,
  ListCampaignsOptions,
  PaginatedCampaignsResponse,
} from "../../types/database/campaign.types";
import { EntityMapper } from "../mappers/entity.mapper";


@Injectable()
export class CampaignRepository {
  constructor(private prisma: PrismaService) {}

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
        },
      });

      // Map to domain model
      const domainCampaign = EntityMapper.mapPrismaCampaignToDomainCampaign(
        newCampaign as any
      );

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
      return EntityMapper.mapPrismaCampaignToDomainCampaign(campaign) as Campaign;

    } catch (error) {
      throw this.prisma.handlePrismaError(
        error, 
        `Failed to get campaign with ID: ${campaignId}`
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
      const domainCampaign = EntityMapper.mapPrismaCampaignToDomainCampaign(
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
  public async deleteCampaign(campaignId: string): Promise<Campaign> {
    try {
      // Check if campaign exists
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true }
      });

      if (!campaign) {
        throw new CampaignNotFoundException(campaignId);
      }

      const deletedCampaign = await this.prisma.campaign.delete({
        where: { id: campaignId }
      });

      const domainCampaign = EntityMapper.mapPrismaCampaignToDomainCampaign(
        deletedCampaign as any
      );
      if (!domainCampaign) {
        throw new Error("Failed to map campaign to domain model");
      }
      return domainCampaign;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to delete campaign: ${campaignId}`);
    }    
  }

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
            if (tw.hasError !== undefined) {
              taskWhere.error = tw.hasError ? { not: null } : null;
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
        if (includeOptions.tasks.skip !== undefined) {
          tasksInclude.skip = includeOptions.tasks.skip;
        }
        if (includeOptions.tasks.take !== undefined) {
          tasksInclude.take = includeOptions.tasks.take;
        }
        
        include.tasks = tasksInclude;
      }
    }
    return Object.keys(include).length > 0 ? include : undefined;
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
      const mappedCampaigns = EntityMapper.mapPrismaCampaignsToDomainCampaigns(
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

};

