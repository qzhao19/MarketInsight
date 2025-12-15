import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CampaignService } from "./services/campaign.service";
import { CampaignController } from "./campaign.controller";
import { CampaignRepository } from "./repositories/campaign.repository";
import { CampaignProcessor } from "./processors/campaign.processor";
import { QueueModule } from "../../core/job/queue.module";
import { AgentModule } from "../../core/agent/agent.module";
import { PrismaModule } from "../../core/database/prisma.module";

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    AgentModule,
    BullModule.registerQueue({
      name: "campaign-processing",
    }),
  ],
  controllers: [CampaignController],
  providers: [
    CampaignService,
    CampaignRepository,
    CampaignProcessor,
  ],
  exports: [CampaignService],
})
export class CampaignModule {}