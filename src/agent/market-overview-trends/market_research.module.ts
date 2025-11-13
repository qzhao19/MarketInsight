import { Module } from '@nestjs/common';
import { MarketResearchService } from './market_research.service';
import { LLModelModule } from '../../llm/model.module';
import { AppConfigModule } from '../../config/config.module';

@Module({
  imports: [
    LLModelModule,
    AppConfigModule,
  ],
  providers: [
    MarketResearchService,
  ],
  exports: [
    MarketResearchService,
  ],
})
export class MarketResearchModule {}