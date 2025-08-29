import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma.service';
import { 
  Task, 
  TaskStatus, 
  LLMInput, 
  LLMResult, 
  MarketingCampaign,
  CampaignStatus
} from '../../types/task.types';

// define exception 
export class TaskNotFoundException extends Error {
  constructor(taskId: string) {
    super(`Task with ID ${taskId} not found`);
    this.name = 'TaskNotFoundException';
  }
}

export class CampaignNotFoundException extends Error {
  constructor(campaignId: string) {
    super(`Marketing campaign with ID ${campaignId} not found`);
    this.name = 'CampaignNotFoundException';
  }
}

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
  status?: TaskStatus;
  priority?: number;
  orderBy?: {
    field: 'createdAt' | 'priority' | 'updatedAt';
    direction: 'asc' | 'desc';
  };
};


@Injectable()
export class TaskRepository {
  constructor(private prisma: PrismaService) {}

  private handlePrismaError(error: unknown, context: string): never {
    console.error(`${context}:`, error);

    // throw custom exception
    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2025': 
          throw new TaskNotFoundException('unknown');
        case 'P2003':
          // foreign-key constraint failed: the referenced campaign does not exist
          let campaignId = 'unknown';
          if ((error.meta?.field_name as string)?.includes('campaignId')) {
            if (typeof error.meta?.model === 'string') {
              // Prisma error meta sometimes includes model and target
              campaignId = (error.meta?.target as string) || 'unknown';
            }
          }
          throw new CampaignNotFoundException(campaignId);
        default:
          throw new Error(`Database error (${error.code}): ${error.message}`);
      } 
    }
    throw error instanceof Error ? error : new Error(`${context}: ${String(error)}`);
  }

  /**
   * @param task 
   * @param includeCampaign 
   * @returns 
   */
  private mapPrismaTaskToDomain(
    task: Prisma.TaskGetPayload<{ include: { campaign: true } }>,
    includeCampaign: boolean = true
  ): Task | null {

    if (!task) return null;

    const campaign = task.campaign
      ? {
        ...task.campaign,
        status: task.campaign.status as CampaignStatus,
       }
      : undefined;
    
    return {
      ...task,
      input: task.input as unknown as LLMInput,
      result: task.result as unknown as LLMResult | null,
      status: task.status as TaskStatus,
      campaign: campaign,
    };
  }

  /**
   * @param task 
   * @returns 
   */
  async createTask(task: CreateTaskData): Promise<Task> {
    try {
      // check campaign activities exists
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
      });

      // return a created object by db, make sure JSON attibutes is correct
      return {
        ...newTask,
        input: newTask.input as unknown as LLMInput,
        result: newTask.result as unknown as LLMResult | null,
        // cast status to your TaskStatus type
        status: newTask.status as TaskStatus, 
      };

    } catch (error) {
      throw this.handlePrismaError(
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
   */
  async getTaskById(id: string, includeCampaign: boolean = true): Promise<Task> {
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
      throw this.handlePrismaError(error, `Failed to get task by ID: ${id}`);
    }
  }

  /**
   * 
   * @param id 
   * @param data 
   * @param includeCampaign 
   * @returns 
   */
  async updateTask(
    id: string, 
    data: UpdateTaskData, 
    includeCampaign: boolean = true
  ): Promise<Task> {
    try {
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

      const updatedTask = await this.prisma.task.update({
        where: { id },
        data: updateData,
        include: { campaign: includeCampaign }
      });

      return this.mapPrismaTaskToDomain(updatedTask, includeCampaign) as Task;
    } catch (error) {
      throw this.handlePrismaError(error, `Failed to update task: ${id}`);
    }
  }



}


