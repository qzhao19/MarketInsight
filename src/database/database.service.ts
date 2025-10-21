import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { UserRepository } from "./repositories/user.repository";
import { CampaignRepository } from "./repositories/campaign.repository";
import { TaskRepository } from "./repositories/task.repository";

@Injectable()
export class DatabaseService {
  constructor(
    private readonly prisma: PrismaService,
    public readonly user: UserRepository,
    public readonly campaign: CampaignRepository,
    public readonly task: TaskRepository,
  ) {}

  /**
   * Executes a transactional operation involving multiple repositories.
   * This method provides transactional instances of repositories to the callback function.
   * 
   * @param fn The function to execute within the transaction. It receives an object
   *           containing instances of repositories that are bound to the transaction.
   * @returns The result of the transactional function.
   * 
   * @example
   * await databaseService.transaction(async (tx) => {
   *   const user = await tx.users.createUser(...);
   *   await tx.campaigns.createCampaign({ userId: user.id, ... });
   * });
   */
  async transaction<T>(
    fn: (
      tx: {
        user: UserRepository;
        campaign: CampaignRepository;
        task: TaskRepository;
      }
    ) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (prisma) => {
      // Create new repository instances that are bound to the transactional prisma client
      const transactionalRepos = {
        user: new UserRepository(prisma as PrismaService),
        campaign: new CampaignRepository(prisma as PrismaService),
        task: new TaskRepository(prisma as PrismaService),
      };
      return fn(transactionalRepos);
    });
  }
}
