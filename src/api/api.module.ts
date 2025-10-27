import { Module } from '@nestjs/common';
import { UserApiModule } from './user/user.module';
// import { CampaignApiModule } from './campaign/campaign.module';

/**
 * Aggregate all API modules
 */
@Module({
  imports: [
    UserApiModule,
    // CampaignApiModule,
  ],
})
export class ApiModule {}