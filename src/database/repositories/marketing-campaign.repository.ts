import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { TaskRepository } from './task.repository';
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
  UserNotFoundException, 
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

type AddTaskData = {
  campaignId: string;
  input: LLMInput;
  priority?: number;
  status?: TaskStatus; // default is PENDING
};

@Injectable()
export class MarketingCampaignRepository {
  constructor(private prisma: PrismaService) {}

  private handlePrismaError(error: unknown, context: string): never {
    if (error instanceof PrismaClientKnownRequestError) {
      // This will be thrown by `connect` if the user doesn't exist.
      if (error.code === 'P2025') {
        // The error message from Prisma can be cryptic, so we provide a clearer one.
        throw new UserNotFoundException('unknown (referenced in campaign creation)');
      }
    }
    // Re-throw custom exceptions
    if (error instanceof UserNotFoundException || error instanceof CampaignNotFoundException) {
      throw error;
    }
    console.error(context, error);
    throw new Error(`Database operation failed: ${context}`);
  }

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
          // Use `connect` to link to an existing user. This is transactional.
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
      throw this.handlePrismaError(
        error,
        `Failed to create campaign for user ${data.userId}`
      );
    }
  }

  /**
   * Retrieves a single campaign's basic information by its ID.
   * @param id The unique identifier of the marketing campaign.
   * @returns A Promise that resolves to the MarketingCampaign object.
   */
  async findCampaignById(id: string): Promise<MarketingCampaign> {
    try {
      const campaign = await this.prisma.marketingCampaign.findUnique({
        where: {id},
        include: {
          tasks: false, 
          user: false
        }
      });

      if (!campaign) {
        throw new CampaignNotFoundException(id);
      }

      // call the mapping function directly without any type casting
      return this.mapPrismaCampaignToDomain(
        { ...campaign, status: campaign.status as CampaignStatus },
        false,
        false
      );

    } catch(error) {
      throw this.handlePrismaError(
        error, 
        `Failed to get campaign with ID: ${id}`
      );
    }
  }

  /**
   * Retrieves a campaign and its associated tasks by ID，with optional pagination for tasks.
   * @param id The unique identifier of the marketing campaign.
   * @param taskOptions Options for paginating the tasks list (e.g., { skip: 0, take: 50 }).
   * @returns A Promise that resolves to the MarketingCampaign object, guaranteed to include the `tasks` array.
   */
  async findCampaignWithTasksById(
    id: string,
    taskOptions: { skip?: number; take?: number } = {},
  ): Promise<MarketingCampaign & { tasks: Task[] }> {
    try {
      const { skip = 0, take = 100 } = taskOptions; // Set a reasonable default limit

      const campaign = await this.prisma.marketingCampaign.findUnique({
        where: { id },
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
        throw new CampaignNotFoundException(id);
      }

      // mapping function handles the type conversion internally.
      // 'as' cast here is safe because we know 'tasks' is included.
      return this.mapPrismaCampaignToDomain(
        { ...campaign, status: campaign.status as CampaignStatus },
        true,
        false
      ) as MarketingCampaign & { tasks: Task[] };
    } catch (error) {
      throw this.handlePrismaError(
        error,
        `Failed to find campaign with tasks: ${id}`,
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
          userId,
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
      throw this.handlePrismaError(
        error,
        `Failed to find campaigns for user: ${userId}`,
      );
    }
  }

/**
 * Updates the status of a Campaign, enforcing valid state transitions.
 *
 * @param id Campaign ID
 * @param newStatus The target status for the campaign.
 * @param options Options to include related data in the response.
 * @returns A Promise resolving to the updated MarketingCampaign.
 */
  async updateCampaignStatus(
    id: string,
    newStatus: CampaignStatus,
    options: { includeTasks?: boolean } = {},
  ): Promise<MarketingCampaign> {
    try {
      // 1: perform a single query to get the current status.
      const campaign = await this.prisma.marketingCampaign.findUnique({
        where: { id },
        select: { status: true }, // Only fetch the status for validation.
      });

      if (!campaign) {
        throw new CampaignNotFoundException(id);
      }

      const currentStatus = campaign.status as CampaignStatus;

      // 2: perform all logical validations *before* any further DB operations.
      if (currentStatus !== newStatus) {
        // validate the transition only if the status is actually changing.
        if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
          throw new InvalidStatusTransitionException(
            currentStatus,
            newStatus,
          );
        }

        // if validation passes, perform a single UPDATE operation.
        // `update` call will return the fully updated object with included tasks.
        const updatedCampaign = await this.prisma.marketingCampaign.update({
          where: { id },
          data: { status: newStatus }, // Prisma automatically handles `updatedAt`
          include: { tasks: options.includeTasks ?? false },
        });
        
        return this.mapPrismaCampaignToDomain(
          // updatedCampaign,
          { ...updatedCampaign!, status: updatedCampaign!.status as CampaignStatus },
          options.includeTasks ?? false,
          false,
        );
      }

      // 3: handle the "no status change" case efficiently.
      // if we reach here, it means status is unchanged. We now fetch the full object if needed.
      const fullCampaign = await this.prisma.marketingCampaign.findUnique({
        where: { id },
        include: { tasks: options.includeTasks ?? false },
      });

      // campaign is guaranteed to exist from the first check.
      return this.mapPrismaCampaignToDomain(
        { ...fullCampaign!, status: fullCampaign!.status as CampaignStatus },
        options.includeTasks ?? false,
        false,
      );
    } catch (error) {
      throw this.handlePrismaError(
        error,
        `Failed to update campaign ${id} status to ${newStatus}`,
      );
    }
  }

  async addTaskToCampaign(id: string, task: AddTaskData): Promise<Task> {
    try {
      const campaign = await this.prisma.marketingCampaign.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!campaign) {
        throw new CampaignNotFoundException(id);
      }

      const createdTask = await this.prisma.task.create({
        data: {
          campaignId: id,
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
      throw this.handlePrismaError(
        error,
        `Failed to add task to campaign ${id}`,
      );
    }


  }


};

