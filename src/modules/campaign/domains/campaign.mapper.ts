import { User as PrismaUser, Prisma } from "@prisma/client";
import { CampaignInput, CampaignResult, TaskResult } from "../../../common/types/database/llm.types"
import { SafeUser, Task, TaskStatus, Campaign, CampaignStatus } from "../../../common/types/database/entity.types"


/**
 * Centralized entity mapping utilities.
 */
export class CampaignMapper {
  /**
   * Removes password field from user object.
   */
  static excludePasswordFromUser(user: PrismaUser): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as unknown as SafeUser;
  }

  /**
   * Maps a Prisma Task to domain Task model.
   */
  static mapPrismaTaskToDomainTask(
    prismaTask: Prisma.TaskGetPayload<{ include: { campaign?: boolean } }>,
  ): Task | null {
    if (!prismaTask) {
      return null;
    }
    // Destructure to separate the campaign from the rest of the task properties.
    const { campaign, ...taskWithoutCampaign } = prismaTask;

    // Create the base domain task, casting its own properties to the correct domain types.
    const domainTask: Task = {
      ...taskWithoutCampaign,
      status: taskWithoutCampaign.status as TaskStatus,
      result: taskWithoutCampaign.result as TaskResult | null,
    };

    // Conditionally map and add the campaign object if requested and available.
    if (campaign) {
      domainTask.campaign = {
        ...campaign,
        status: campaign.status as CampaignStatus,
        input: campaign.input as unknown as CampaignInput,
        result: campaign.result as CampaignResult | null,
      };
    }
    return domainTask;
  }

  /**
   * Batch mapping for multiple tasks.
   */
  static mapPrismaTasksToDomainTasks(
    prismaTasks: Prisma.TaskGetPayload<{ include: { campaign?: boolean } }>[]
  ): Task[] {
    return prismaTasks
      .map(task => CampaignMapper.mapPrismaTaskToDomainTask(task))
      .filter(Boolean) as Task[];
  }

  /**
   * Maps a Prisma Campaign to domain Campaign model.
   */
  static mapPrismaCampaignToDomainCampaign(
    prismaCampaign: (
      | Prisma.CampaignGetPayload<object>
      | Prisma.CampaignGetPayload<{ include: { tasks: true } }>  // ✅ Campaign + tasks
      | Prisma.CampaignGetPayload<{ include: { user: true } }>  // ✅ Campaign + user
      | Prisma.CampaignGetPayload<{ include: { tasks: true; user: true } }>  // ✅ Campaign + tasks + user
    ) | null
  ): Campaign | null {
    if (!prismaCampaign) {
      return null;
    }

    // Destructure to separate the task and user from the rest of the campaign properties.
    const { tasks, user, ...campaignWithoutTaskUser } = prismaCampaign as any;

    // Create the base domain campaign
    const domainCampaign: Campaign = {
      ...campaignWithoutTaskUser,
      status: campaignWithoutTaskUser.status as CampaignStatus,
      input: campaignWithoutTaskUser.input as unknown as CampaignInput,
      result: campaignWithoutTaskUser.result as unknown as CampaignResult | null,
    };
    
    // Conditionally map and add the tasks object
    if (tasks) {
      domainCampaign.tasks = tasks
        .map((task: any) => CampaignMapper.mapPrismaTaskToDomainTask(task as any))
        .filter(Boolean) as Task[];
    }

    // Conditionally map and add the user object
    if (user) {
      domainCampaign.user = CampaignMapper.excludePasswordFromUser(user) as SafeUser;
    }
    return domainCampaign;
  }

  /**
   * Batch mapping for multiple campaigns.
   */
  static mapPrismaCampaignsToDomainCampaigns(
    prismaCampaigns: (
      | Prisma.CampaignGetPayload<object>
      | Prisma.CampaignGetPayload<{ include: { tasks: true } }>  // Campaign + tasks
      | Prisma.CampaignGetPayload<{ include: { user: true } }>  // Campaign + user
      | Prisma.CampaignGetPayload<{ include: { tasks: true; user: true } }>  // Campaign + tasks + user
    )[]
  ): Campaign[] {
    return prismaCampaigns
      .map(campaign => CampaignMapper.mapPrismaCampaignToDomainCampaign(campaign))
      .filter(Boolean) as Campaign[];
  }
}
