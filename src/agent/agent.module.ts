import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AppConfigModule } from '../config/config.module';
import { MarketResearchModule } from './market-overview-trends/market_research.module';

@Module({
  imports: [
    AppConfigModule,
    MarketResearchModule,
  ],
  providers: [
    AgentService
  ],
  exports: [
    AgentService,
  ],
})
export class AgentModule {}