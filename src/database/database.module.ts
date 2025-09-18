import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { MarketingCampaignRepository } from "./repositories/marketing-campaign.repository";
import { UserRepository } from "./repositories/user.repository";
import { TaskRepository } from "./repositories/task.repository";
import { DatabaseService } from "./database.service";


@Module({
  providers: [
    PrismaService,
    MarketingCampaignRepository,
    UserRepository,
    TaskRepository,
    DatabaseService
  ],
  exports: [
    DatabaseService
  ],
})
export class DatabaseModule {}