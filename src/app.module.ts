import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/config.module"; 
import { CampaignModule } from "./modules/campaign/campaign.module";
import { UserModule } from "./modules/user/user.module";

@Module({
  imports: [
    AppConfigModule,
    CampaignModule,
    UserModule,
  ],
  controllers: [], 
  providers: [],
})
export class AppModule {}
