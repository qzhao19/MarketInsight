import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { 
  MarketingCampaign, 
  CampaignStatus, 
  LLMInput, 
  LLMResult, 
  Task,
  TaskStatus,
  User
} from '../../types/domain.types';
import { CampaignNotFoundException, UserNotFoundException } from '../../common/exceptions';

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


@Injectable()
export class MarketingCampaignRepository {
  constructor(private prisma: PrismaService) {}

  private handlePrismaError(error: unknown, context: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // This will be thrown by `connect` if the user doesn't exist.
      if (error.code === 'P2025') {
        // The error message from Prisma can be cryptic, so we provide a clearer one.
        throw new UserNotFoundException('unknown (referenced in campaign creation)');
      }
    }
    // Re-throw custom exceptions
    if (error instanceof UserNotFoundException) {
      throw error;
    }
    console.error(context, error);
    throw new Error(`Database operation failed: ${context}`);
  }

  /**
   * Maps a Prisma campaign object to our domain model.
   */
  private mapPrismaCampaignToDomain(
    campaign: Prisma.MarketingCampaignGetPayload<{ include: { tasks?: boolean; user?: boolean } }>,
    includeTasks: boolean,
    includeUser: boolean
  ): MarketingCampaign | null {
    if (!campaign) return null;

    return {
      ...campaign,
      status: campaign.status as CampaignStatus,
      tasks: (includeTasks && campaign.tasks) ? (campaign.tasks as unknown as Task[]) : undefined,
      user: (includeUser && campaign.user) ? (campaign.user as User) : undefined,
    };
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
      // build a default campaign params
      const defaultCampaignData: Prisma.MarketingCampaignCreateInput = {
        user: { connect: { id: data.userId }},
        name: data.name,
        description: data.description ?? '',
        status: data.status ?? CampaignStatus.DRAFT,
        tasks: data.tasks && data.tasks.length > 0
          ? {
              create: data.tasks.map(task => ({
                input: task.input as unknown as Prisma.JsonObject,
                result: task.result as unknown as Prisma.JsonObject,
                priority: task.priority ?? 0,
                status: task.status ?? 'PENDING',
              }))
            }
          : undefined
      };

      const campaign = await this.prisma.marketingCampaign.create({
        data: defaultCampaignData,
        include: { tasks: true, user: true }
      });

      return this.mapPrismaCampaignToDomain(campaign, true, true) as MarketingCampaign;
      
    } catch(error) {
      throw new CampaignNotFoundException(
        `Failed to create campaign for user ${data.userId}: ${error}`
      );
    }
  }


};

