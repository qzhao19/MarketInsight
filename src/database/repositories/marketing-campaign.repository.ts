import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { 
  MarketingCampaign, 
  CampaignStatus, 
  LLMInput, 
  LLMResult, 
  Task,
  TaskStatus,
  User,
  VALID_TRANSITIONS
} from '../../types/domain.types';
import { 
  CampaignNotFoundException, 
  InvalidStatusTransitionException 
} from '../../common/exceptions';

// define input type 
type CreateCampaignData = {
  userId: string,
  name: string,
  description?: string;
  status?: CampaignStatus;
  tasks?: Array<{
    input: LLMInput;
    result?:LLMResult;
    priority?: number;
    status?: TaskStatus;
  }>;
};

type UpdateCampaignData = {
  name?: string;
  description?: string;
  status?: CampaignStatus;
};

type AddTaskData = {
  campaignId: string;
  input: LLMInput;
  priority?: number;
  status?: TaskStatus; // default is PENDING
};


@Injectable()
export class MarketingCampaignRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Maps a Prisma campaign object to our domain model.
   */
  private mapPrismaCampaignToDomain(
    campaign: Partial<Prisma.MarketingCampaignGetPayload<{ include: { tasks?: boolean; user?: boolean } }>> &
      Omit<MarketingCampaign, 'tasks' | 'user'>,
    includeTasks: boolean,
    includeUser: boolean
  ): MarketingCampaign {
    // basic attributes mapping
    const baseCampaign: Omit<MarketingCampaign, 'tasks' | 'user'> = {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status as CampaignStatus,
      userId: campaign.userId,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt
    };

    // add relvent task and user attribute only when need
    const result: MarketingCampaign = baseCampaign;
    if (includeTasks && campaign.tasks) {
      result.tasks = campaign.tasks as unknown as Task[];
    }
    if (includeUser && campaign.user) {
      result.user = campaign.user as User;
    }

    return result;
  }

  /**
   * Creates a new marketing campaign and optionally creates 
   * its sub-tasks in a single transaction.
   * 
   * @param data new campaign, including an optional array of tasks.
   * @returns A Promise that resolves to the newly created MarketingCampaign
   */
  async createCampaign(data: CreateCampaignData): Promise<MarketingCampaign> {
    try {
      const campaign = await this.prisma.marketingCampaign.create({
        data: {
          user: { connect: { id: data.userId } },
          name: data.name,
          description: data.description ?? '',
          status: data.status ?? CampaignStatus.DRAFT,
          // The nested `create` for tasks is also part of the same transaction.
          tasks:
            data.tasks && data.tasks.length > 0
              ? {
                  create: data.tasks.map((task) => ({
                    input: task.input as unknown as Prisma.JsonObject,
                    result: (task.result as unknown as Prisma.JsonObject) ?? Prisma.JsonNull,
                    priority: task.priority ?? 0,
                    status: task.status ?? TaskStatus.PENDING,
                  })),
                }
              : undefined,
        },
        // Include related tasks to return the complete object.
        include: { tasks: true, user: true },
      });

      // Ensure campaign.status is cast to CampaignStatus to satisfy type requirements
      return this.mapPrismaCampaignToDomain(
        { ...campaign, status: campaign.status as CampaignStatus },
        true,
        true
      ) as MarketingCampaign;
    } catch (error) {
      // Delegate error handling to a centralized function for consistency.
      throw this.prisma.handlePrismaError(
        error,
        `Failed to create campaign for user ${data.userId}`
      );
    }
  }

  /**
   * Retrieves a single campaign's basic information by its ID.
   * @param campaignId The unique identifier of the marketing campaign.
   * @returns A Promise that resolves to the MarketingCampaign object.
   */
  async findCampaignById(campaignId: string): Promise<MarketingCampaign> {
    try {
      const campaign = await this.prisma.marketingCampaign.findUnique({
        where: { id: campaignId },
        include: {
          tasks: false, 
          user: false
        }
      });

      if (!campaign) {
        throw new CampaignNotFoundException(campaignId);
      }

      // call the mapping function directly without any type casting
      return this.mapPrismaCampaignToDomain(
        { ...campaign, status: campaign.status as CampaignStatus },
        false,
        false
      );

    } catch(error) {
      throw this.prisma.handlePrismaError(
        error, 
        `Failed to get campaign with ID: ${campaignId}`
      );
    }
  }

  /**
   * Retrieves a campaign and its associated tasks by ID，with optional pagination for tasks.
   * @param campaignId The unique identifier of the marketing campaign.
   * @param taskOptions Options for paginating the tasks list (e.g., { skip: 0, take: 50 }).
   * @returns A Promise that resolves to the MarketingCampaign object, guaranteed to include the `tasks` array.
   */
  async findCampaignWithTasksById(
    campaignId: string,
    taskOptions: { skip?: number; take?: number } = {},
  ): Promise<MarketingCampaign & { tasks: Task[] }> {
    try {
      const { skip = 0, take = 100 } = taskOptions; // Set a reasonable default limit

      const campaign = await this.prisma.marketingCampaign.findUnique({
        where: { id: campaignId },
        include: {
          // include tasks with sorting and pagination
          tasks: {
            orderBy: { createdAt: 'asc' },
            skip,
            take,
          },
          // not include the user object for this query
          user: false,
        },
      });

      if (!campaign) {
        throw new CampaignNotFoundException(campaignId);
      }

      // mapping function handles the type conversion internally.
      // 'as' cast here is safe because we know 'tasks' is included.
      return this.mapPrismaCampaignToDomain(
        { ...campaign, status: campaign.status as CampaignStatus },
        true,
        false
      ) as MarketingCampaign & { tasks: Task[] };
    } catch (error) {
      throw this.prisma.handlePrismaError(
        error,
        `Failed to find campaign with tasks: ${campaignId}`,
      );
    }
  }

  /**
   * Finds all campaigns for a specific user, with support for pagination and status filtering.
   *
   * @param userId The unique identifier of the user.
   * @param options Options for pagination and filtering by campaign status.
   * @returns A Promise that resolves to an array of MarketingCampaign objects, each including its tasks.
   */
  async findManyCampaigsByUserId(
    userId: string, 
    options: {
      skip?: number; 
      take?: number; 
      statusList?: string[]
    } = {}
  ): Promise<MarketingCampaign[]> {

    try {
      const { skip = 0, take = 20, statusList } = options;
      const campaigns = await this.prisma.marketingCampaign.findMany({
        where: {
          userId: userId,
          // add the status filte if it's provided and not empty
          ...(statusList && statusList.length > 0
            ? { status: { in: statusList } }
            : {}),
        },
        skip,
        take,
        orderBy: {
          createdAt: 'asc' 
        },
        include: {
          // include all tasks for each campaign.
          user: false,
        }
      });

      // Map each Prisma result to our domain model.
      return campaigns.map((campaign) =>
        this.mapPrismaCampaignToDomain(
          // spread and cast are necessary to align Prisma's string status with our enum.
          { ...campaign, status: campaign.status as CampaignStatus },
          true, // includeTasks
          false, // includeUser (already known)
        ),
      );

    } catch (error) {
      throw this.prisma.handlePrismaError(
        error,
        `Failed to find campaigns for user: ${userId}`,
      );
    }
  }

  /**
   * Updates a campaign with the provided data.
   * It can update any field (name, description, status, etc.) and will
   * enforce status transition rules if the status is being changed.
   *
   * @param id The ID of the campaign to update.
   * @param data An object containing the fields to update.
   * @param options Options to include related data in the response.
   * @returns A Promise resolving to the updated MarketingCampaign.
   */
  async updateCampaign(
    campaignId: string,
    data: UpdateCampaignData,
    options: { includeTasks?: boolean } = {},
  ): Promise<MarketingCampaign> {
    try {
      // 1: If the status is being updated, validate the transition first.
      if (data.status !== undefined) {
        const currentCampaign = await this.prisma.marketingCampaign.findUnique({
          where: { id: campaignId },
          select: { status: true },
        });

        if (!currentCampaign) {
          throw new CampaignNotFoundException(campaignId);
        }

        const currentStatus = currentCampaign.status as CampaignStatus;

        // Only validate if the status is actually different.
        if (
          data.status !== currentStatus &&
          !VALID_TRANSITIONS[currentStatus]?.includes(data.status)
        ) {
          throw new InvalidStatusTransitionException(currentStatus, data.status);
        }
      }

      // 2: Perform a single update operation with all the provided data.
      // This is more efficient as it combines validation and update logic.
      const updatedCampaign = await this.prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          ...data, // Spread all fields from the input data.
          // Prisma automatically handles the `updatedAt` field if configured with @updatedAt.
        },
        include: { tasks: options.includeTasks ?? false },
      });

      // 3: Map the Prisma result to our domain model and return.
      return this.mapPrismaCampaignToDomain(
        { ...updatedCampaign, status: updatedCampaign.status as CampaignStatus },
        options.includeTasks ?? false,
        false,
      );
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to update campaign ${campaignId}`);
    }
  }
  
  /**
   * addTaskToCampaign   
   * @param campaignId The ID of the campaign to which the task will be added.
   * @param task The data for the new task.
   * @returns The newly created Task object.
   */
  async addTaskToCampaign(campaignId: string, task: AddTaskData): Promise<Task> {
    try {
      const campaign = await this.prisma.marketingCampaign.findUnique({
        where: { id: campaignId },
        select: { id: true, status: true },
      });
      if (!campaign) {
        throw new CampaignNotFoundException(campaignId);
      }

      if (campaign.status === 'ARCHIVED') {
        throw new Error(`Cannot add tasks to an archived campaign (ID: ${campaignId})`);
      }

      const createdTask = await this.prisma.task.create({
        data: {
          campaignId: campaignId,
          input: task.input as unknown as Prisma.JsonObject,
          priority: task.priority ?? 0,
          status: task.status ?? TaskStatus.PENDING,
        },
      });

      return {
        ...createdTask,
        input: createdTask.input as unknown as LLMInput,
        result: createdTask.result as unknown as LLMResult,
      } as Task;

    } catch (error) {
      throw this.prisma.handlePrismaError(
        error,
        `Failed to add task to campaign ${campaignId}`,
      );
    }
  }

  /**
   * Deletes a campaign and all its associated tasks.
   * @param campaignId The ID of the campaign to delete.
   * @returns A promise that resolves with the ID of the deleted campaign and the count of deleted tasks.
   * @throws {CampaignNotFoundException} If no campaign with the given ID is found.   
   */
  async deleteCampaignAndTasks(campaignId: string): Promise<{
    deletedCampaignId: string;
    deletedTasksCount: number;
  }> {
    // 1. Check if campaign exists
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true }
    });

    if (!campaign) {
      throw new CampaignNotFoundException(campaignId);
    }

    // 2. Delete all associated tasks
    const { count: deletedTasksCount } = await this.prisma.task.deleteMany({
      where: { campaignId }
    });

    // 3. Delete the campaign itself
    await this.prisma.marketingCampaign.delete({
      where: { id: campaignId }
    });

    return {
      deletedCampaignId: campaignId,
      deletedTasksCount
    };
  }

};

