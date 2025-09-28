import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { MarketResearchService } from './market-overview-trends/market_research.service';
import { ModelModule } from '../model/model.module';

@Module({
  imports: [
    ModelModule,
  ],
  providers: [
    AgentService,
    MarketResearchService,
  ],
  exports: [
    AgentService,
  ],
})
export class AgentModule {}