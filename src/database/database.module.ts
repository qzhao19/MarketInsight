import { Module } from "@nestjs/common";
import { PrismaModule } from './prisma/prisma.module';
import { CampaignRepository } from "./repositories/campaign.repository";
import { UserRepository } from "./repositories/user.repository";
import { TaskRepository } from "./repositories/task.repository";
import { DatabaseService } from "./database.service";


@Module({
  imports: [PrismaModule],  
  providers: [
    CampaignRepository,
    UserRepository,
    TaskRepository,
  ],
  exports: [
    DatabaseService
  ],
})
export class DatabaseModule {}