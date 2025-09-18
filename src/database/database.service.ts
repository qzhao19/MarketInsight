import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { UserRepository } from "./repositories/user.repository";
import { MarketingCampaignRepository } from "./repositories/marketing-campaign.repository";
import { TaskRepository } from "./repositories/task.repository";

@Injectable()
export class DatabaseService {
  constructor(
    private readonly prisma: PrismaService,
    public readonly users: UserRepository,
    public readonly campaigns: MarketingCampaignRepository,
    public readonly tasks: TaskRepository,
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
        users: UserRepository;
        campaigns: MarketingCampaignRepository;
        tasks: TaskRepository;
      }
    ) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async (prisma) => {
      // Create new repository instances that are bound to the transactional prisma client
      const transactionalRepos = {
        users: new UserRepository(prisma as PrismaService),
        campaigns: new MarketingCampaignRepository(prisma as PrismaService),
        tasks: new TaskRepository(prisma as PrismaService),
      };
      return fn(transactionalRepos);
    });
  }
}
