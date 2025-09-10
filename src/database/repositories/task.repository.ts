import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { 
  Task, 
  TaskStatus, 
  LLMInput, 
  LLMResult, 
  CampaignStatus
} from '../../types/domain.types';
import { TaskNotFoundException, CampaignNotFoundException } from '../../common/exceptions';

// Define more specific types for method inputs
type CreateTaskData = {
  campaignId: string;
  input: LLMInput;
  priority?: number;
  status?: TaskStatus; // default is PENDING
};

type UpdateTaskData = Partial<{
  status: TaskStatus;
  priority: number;
  input: LLMInput;
  result: LLMResult | null;
  error: string | null;
}>;

type ListTasksOptions = {
  skip?: number;
  take?: number;
  // use Prisma's Where type to enhance flexibility
  where?: { 
    campaignId?: string;
    status?: TaskStatus;
    priority?: number;
    createdAt?: {
      gte?: Date; // "greater than or equal to"
      lte?: Date; // "less than or equal to"
    };
  };
  orderBy?: Array<{
    field: 'createdAt' | 'priority' | 'updatedAt';
    direction: 'asc' | 'desc';
  }>;

  includeCampaign?: boolean;
};


@Injectable()
export class TaskRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Maps a Prisma Task object to the domain Task model.
   * It correctly handles type casting for enums and JSON fields, and conditionally
   * includes the related campaign object.
   *
   * @param task - The Prisma Task object, potentially including the campaign relation.
   * @param includeCampaign - A flag to determine if the campaign should be in the final object.
   * @returns The mapped domain Task object, or null if the input is null.
   */
  private mapPrismaTaskToDomain(
    task: Prisma.TaskGetPayload<{ include: { campaign?: boolean } }>,
    includeCampaign: boolean = true
  ): Task | null {
    if (!task) {
      return null;
    }

    // 1. Destructure to separate the campaign from the rest of the task properties.
    // This avoids the type conflict during the initial spread.
    const { campaign, ...restOfTask } = task;

    // 2. Create the base domain task, casting its own properties to the correct domain types.
    const domainTask: Task = {
      ...restOfTask,
      status: restOfTask.status as TaskStatus,
      input: restOfTask.input as unknown as LLMInput,
      result: restOfTask.result as LLMResult | null,
    };

    // 3. Conditionally map and add the campaign object if requested and available.
    if (includeCampaign && campaign) {
      domainTask.campaign = {
        ...campaign,
        status: campaign.status as CampaignStatus,
      };
    }

    return domainTask;
  }

  /**
   * Creates a new task in the database associated with a marketing campaign.
   * 
   * @param task The data required to create the task, including `campaignId` and `input`.
   * @param includeCampaign - Whether to load the related MarketingCampaign object
   * @returns A `Promise` that resolves to the newly created `Task` object.
   */
  public async createTask(task: CreateTaskData, includeCampaign: boolean = false): Promise<Task> {
    try {
      // check if campaign activities exists
      // still keep following code even handlePrismaError can catch such error
      const campaignExists = await this.prisma.marketingCampaign.findUnique({
        where: {id: task.campaignId},
        select: {id: true}
      });

      if (!campaignExists) {
        throw new CampaignNotFoundException(task.campaignId);
      }

      const newTask = await this.prisma.task.create({
        data: {
          campaignId: task.campaignId,
          input: task.input as unknown as Prisma.JsonObject,
          priority: task.priority ?? 1,
          status: task.status ?? TaskStatus.PENDING,
        },
        include: { campaign: includeCampaign }
      });

      // use the centralized mapper, passing the include flag
      return this.mapPrismaTaskToDomain(newTask, includeCampaign) as Task;

    } catch (error) {
      throw this.prisma.handlePrismaError(
        error, 
        `Failed to create task for campaign ${task.campaignId}`
      );
    }
  }

  /**
   * Get task by its ID, optionally including its associated marketing campaign.
   * 
   * @param id - The task ID
   * @param includeCampaign - Whether to load the related MarketingCampaign object
   * @returns A `Promise` that resolves to the deleted `Task` object.
   */
  public async findTaskById(id: string, includeCampaign: boolean = true): Promise<Task> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id },
        include: { campaign: includeCampaign}
      });

      if (!task) {
        throw new TaskNotFoundException(id);
      }

      // return Prisma.MarketingCampaign type 
      return this.mapPrismaTaskToDomain(task, includeCampaign) as Task;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to find task by ID: ${id}`);
    }
  }

  /**
   * This function selectively updates fields of a task based on the `data` object.
   * 
   * @param id - The unique identifier of the task to update.
   * @param data - An object containing the task fields to be updated.
   * @param includeCampaign - Optional. If true, the related MarketingCampaign will be included in the returned Task object. Defaults to true.
   * @returns A `Promise` that resolves to the updated `Task` object.
   * @throws TaskNotFoundException If the task with the specified ID does not exist.
   */
  public async updateTask(
    id: string, 
    data: UpdateTaskData, 
    includeCampaign: boolean = true
  ): Promise<Task> {
    try {
      // define var of Prisma.TaskUpdateInput type 
      const updateData: Prisma.TaskUpdateInput = {};

      // build object for existed atributes
      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.error !== undefined) updateData.error = data.error;
      if (data.input !== undefined) {
        updateData.input = data.input as unknown as Prisma.JsonObject;
      }
      if (data.result !== undefined) {
        updateData.result = data.result as unknown as Prisma.JsonObject;
      }

      // handle empty update
      if (Object.keys(updateData).length === 0) {
        console.warn(`Attempted to update task ${id} with empty data. No action taken.`);
        return this.findTaskById(id, includeCampaign);
      }

      const updatedTask = await this.prisma.task.update({
        where: { id },
        data: updateData,
        include: { campaign: includeCampaign }
      });

      return this.mapPrismaTaskToDomain(updatedTask, includeCampaign) as Task;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to update task: ${id}`);
    }
  }

  /**
   * Deletes a task by its ID.
   * 
   * @param id - The ID of the task to delete.
   * @param includeCampaign - Whether to load the related MarketingCampaign object.
   * @returns A `Promise` that resolves to the deleted `Task` object.
   */
  public async deleteTask(id: string, includeCampaign: boolean): Promise<Task> {
    try {
      const deletedTask = await this.prisma.task.delete({
        where: { id },
        include: { campaign: includeCampaign }
      });

      return this.mapPrismaTaskToDomain(deletedTask, includeCampaign) as Task;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to delete task: ${id}`);
    }
  }

  /**
   * Retrieves a list of tasks based on flexible filtering
   * @param options - The options for filtering, sorting, and pagination.
   * @returns A `Promise` that resolves to an array of `Task` objects.
   */
  public async findManyTasksByOptions(options: ListTasksOptions = {}): Promise<Task[]> {
    const {
      skip = 0,
      take = 20,
      where = {},
      orderBy = [{ field: 'createdAt', direction: 'desc' }],
      includeCampaign = true, // default not load campaign
    } = options;

    try {
      // build sorting condition
      const orderByObj = orderBy.map(sort => ({
        [sort.field]: sort.direction,
      }));

      const tasks = await this.prisma.task.findMany({
        where,
        skip,
        take,
        orderBy: orderByObj,
        include: { campaign: includeCampaign }
      });

      return tasks
        .map(task => this.mapPrismaTaskToDomain(task, includeCampaign))
        .filter(Boolean) as Task[];

    } catch (error) {
      throw this.prisma.handlePrismaError(error, 'Failed to list tasks');
    }
  }
}


