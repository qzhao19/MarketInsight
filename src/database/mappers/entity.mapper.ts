import { User as PrismaUser, Prisma } from "@prisma/client";
import { 
  Task, 
  TaskStatus, 
  Campaign, 
  CampaignStatus, 
  SafeUser,
  LLMInput,
  LLMResult 
} from "../../types/database/entities.types";

/**
 * Centralized entity mapping utilities.
 */
export class EntityMapper {
  /**
   * Removes password field from user object.
   */
  static excludePasswordFromUser(user: PrismaUser): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Batch mapping for multiple users.
   */
  static excludePasswordFromUsers(users: PrismaUser[]): SafeUser[] {
    return users.map(user => EntityMapper.excludePasswordFromUser(user));
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
      input: taskWithoutCampaign.input as unknown as LLMInput,
      result: taskWithoutCampaign.result as unknown as LLMResult | null,
    };

    // Conditionally map and add the campaign object if requested and available.
    if (campaign) {
      domainTask.campaign = {
        ...campaign,
        status: campaign.status as CampaignStatus,
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
      .map(task => EntityMapper.mapPrismaTaskToDomainTask(task))
      .filter(Boolean) as Task[];
  }

  /**
   * Maps a Prisma Campaign to domain Campaign model.
   */
  static mapPrismaCampaignToDomainCampaign(
    campaign: (
      | Prisma.CampaignGetPayload<object>
      | Prisma.CampaignGetPayload<{ include: { tasks: true } }>  // ✅ Campaign + tasks
      | Prisma.CampaignGetPayload<{ include: { user: true } }>  // ✅ Campaign + user
      | Prisma.CampaignGetPayload<{ include: { tasks: true; user: true } }>  // ✅ Campaign + tasks + user
    ) | null
  ): Campaign | null {
    if (!campaign) {
      return null;
    }

    // Destructure to separate the task and user from the rest of the campaign properties.
    const { tasks, user, ...campaignWithoutTaskUser } = campaign as any;

    // Create the base domain campaign
    const domainCampaign: Campaign = {
      ...campaignWithoutTaskUser,
      status: campaignWithoutTaskUser.status as CampaignStatus,
    };
    
    // Conditionally map and add the tasks object
    if (tasks) {
      domainCampaign.tasks = tasks
        .map((task: any) => EntityMapper.mapPrismaTaskToDomainTask(task as any))
        .filter(Boolean) as Task[];
    }

    // Conditionally map and add the user object
    if (user) {
      domainCampaign.user = EntityMapper.excludePasswordFromUser(user) as SafeUser;
    }
    return domainCampaign;
  }
}
