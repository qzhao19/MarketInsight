import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AppConfigModule } from "../../config/config.module";
import { AppConfigService } from "../../config/config.service";
import { QueueService } from "./queue.service";

@Module({
  imports: [
    // Import ConfigModule to use AppConfigService
    AppConfigModule,

    // Configure Redis connection globally
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => ({
        connection: {
          host: configService.redisHost,
          port: configService.redisPort,
          password: configService.redisPassword,
          db: configService.redisDb,
        },
      }),
    }),
    
    // Configure Redis connection globally
    BullModule.registerQueueAsync({
      name: "campaign-processing",
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => ({
        name: configService.campaignQueueName,
        defaultJobOptions: {
          attempts: configService.queueJobRetryAttempts,
          backoff: {
            type: configService.queueJobRetryBackoffType,
            delay: configService.queueJobRetryBackoffDelay,
          },
          removeOnComplete: configService.queueKeepCompletedJobs,
          removeOnFail: configService.queueKeepFailedJobs,
        },
      }),
    }),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}