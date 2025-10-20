import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TaskNotFoundException, CampaignNotFoundException } from "../../common/exceptions/database.exceptions";
import { Task } from "../../types/database/entities.types";
import { 
  CreateTaskData, 
  UpdateTaskData, 
  ListTasksOptions, 
  PaginatedTasksResponse 
} from "../../types/database/task.types"
import { EntityMapper } from "../mappers/entity.mapper";


@Injectable()
export class TaskRepository {
  
  /**
   * Initializes the service with a PrismaService
   */
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new task in the database associated with a marketing campaign.
   */
  public async createTask(
    task: CreateTaskData, 
    includeCampaign: boolean = false
  ): Promise<Task> {
    try {
      // Check if campaign activities exists
      const campaignExists = await this.prisma.campaign.findUnique({
        where: { id: task.campaignId },
        select: { id: true }
      });

      if (!campaignExists) {
        throw new CampaignNotFoundException(task.campaignId);
      }

      const newTask = await this.prisma.task.create({
        data: {
          campaignId: task.campaignId,
          input: task.input as unknown as Prisma.JsonObject,
          priority: task.priority,
          status: task.status,
        },
        include: { campaign: includeCampaign }
      });

      // use the centralized mapper, passing the include flag
      return EntityMapper.mapPrismaTaskToDomainTask(newTask) as Task;

    } catch (error) {
      throw this.prisma.handlePrismaError(
        error, 
        `Failed to create task for campaign ${task.campaignId}`
      );
    }
  }

  /**
   * Get task by its ID, optionally including its associated marketing campaign.
   */
  public async findTaskById(
    id: string, 
    includeCampaign: boolean = false
  ): Promise<Task> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id },
        include: { campaign: includeCampaign}
      });

      if (!task) {
        throw new TaskNotFoundException(id);
      }

      // return Prisma.Campaign type 
      return EntityMapper.mapPrismaTaskToDomainTask(task) as Task;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to find task by ID: ${id}`);
    }
  }

  /**
   * This function selectively updates fields of a task based on the `data` object.
   */
  public async updateTask(
    id: string, 
    data: UpdateTaskData, 
    includeCampaign: boolean = false
  ): Promise<Task> {
    try {
      // define var of Prisma.TaskUpdateInput type 
      const updateData: Prisma.TaskUpdateInput = {};

      // build object for existed atributes
      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.input !== undefined) {
        updateData.input = data.input as unknown as Prisma.JsonObject;
      }

      // Handle explicit null cases
      if (data.error !== undefined) {
        updateData.error = data.error === null
          ? null
          : updateData.error = data.error;
      }
      
      if (data.result !== undefined) {
        updateData.result = data.result === null 
          ? Prisma.JsonNull 
          : data.result as unknown as Prisma.JsonObject;
      }

      // Handle empty update
      if (Object.keys(updateData).length === 0) {
        console.warn(`Attempted to update task ${id} with empty data. No action taken.`);
        return this.findTaskById(id, includeCampaign);
      }

      const updatedTask = await this.prisma.task.update({
        where: { id },
        data: updateData,
        include: { campaign: includeCampaign }
      });

      return EntityMapper.mapPrismaTaskToDomainTask(updatedTask) as Task;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to update task: ${id}`);
    }
  }

  /**
   * Deletes a task by its ID.
   */
  public async deleteTask(
    id: string, 
    includeCampaign: boolean = false
  ): Promise<Task> {
    try {
      const deletedTask = await this.prisma.task.delete({
        where: { id },
        include: { campaign: includeCampaign }
      });
      return EntityMapper.mapPrismaTaskToDomainTask(deletedTask) as Task;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to delete task: ${id}`);
    }
  }

  // Helper methods for building query clauses
  private buildWhereClause(
    where: ListTasksOptions["where"] = {}
  ): Prisma.TaskWhereInput {
    const whereClause: Prisma.TaskWhereInput = {};

    if (where?.campaignId) whereClause.campaignId = where.campaignId;
    if (where?.status) whereClause.status = where.status;
    if (where?.priority) whereClause.priority = where.priority;
    if (where?.priorityRange) {
      whereClause.priority = { 
        ...(where.priorityRange.gte !== undefined && { gte: where.priorityRange.gte }),
        ...(where.priorityRange.lte !== undefined && { lte: where.priorityRange.lte }),
      };
    }
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
    if (where?.hasError !== undefined) {
      whereClause.error = where.hasError ? { not: null } : null;
    }
    if (where?.hasResult !== undefined) {
      whereClause.result = where.hasResult ? { not: Prisma.JsonNull } : { equals: Prisma.JsonNull };
    }
    if (where?.searchError) whereClause.error =  where.searchError;
    return whereClause;
  }

  private buildOrderByClause(
    orderBy: ListTasksOptions["orderBy"]
  ): Prisma.TaskOrderByWithRelationInput {
    const orderByField = orderBy?.field ?? "createdAt";
    const orderByDirection = orderBy?.direction ?? "desc";
    return { [orderByField]: orderByDirection };;
  }

  private buildIncludeClause(
    includeOptions: ListTasksOptions["include"]
  ): Prisma.TaskInclude | undefined {

    const include: any = {};
    if (includeOptions?.campaign) {
      if (typeof includeOptions.campaign === "boolean") {
        include.campaign = true;
      } else {
        include.campaign = {
          select: includeOptions.campaign.select
        };
      }
    }
    return Object.keys(include).length > 0 ? include : undefined;
  }

  /**
   * Retrieves a paginated list of tasks with flexible filtering, sorting, and relations.
   */
  public async findManyTasksByOptions(
    options: ListTasksOptions = {}
  ): Promise<PaginatedTasksResponse> {
    try {
      // Extract and validate pagination parameters
      const skip = Math.max(0, options.skip ?? 0);
      const take = Math.min(100, Math.max(1, options.take ?? 20));

      // Build where clause
      const whereClause = this.buildWhereClause(options.where);
      const orderByOptions = this.buildOrderByClause(options.orderBy);
      const includeOptions = this.buildIncludeClause(options.include);

      // Execute queries in parallel
      const [tasks, totalCount] = await Promise.all([
        this.prisma.task.findMany({
          skip,
          take,
          where: whereClause,
          include: includeOptions,
          orderBy: orderByOptions,
        }),
        this.prisma.task.count({ where: whereClause }),
      ]);
      
      // Create a mapped task list
      const mappedTasks = EntityMapper.mapPrismaTasksToDomainTasks(tasks as any);

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
}


